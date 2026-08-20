/**
 * reelbed.js — audio engine for the jj.house reel bed.
 *
 * Five stems, 16 bars @ 128 BPM, exactly 1,440,000 samples @ 48 kHz
 * = 30.000 s = 720 frames @ 24 fps.
 * Audio is the master clock. Video follows it. Never the other way round.
 *
 *   const bed = new ReelBed('/reel-lab/audio/');
 *   await bed.load();
 *   document.addEventListener('click', () => bed.start(), { once: true });
 *   bed.setStage('PARTIAL');
 *   requestAnimationFrame(function f(){ bed.syncVideo(video); requestAnimationFrame(f); });
 *
 * No dependencies. Plain Web Audio.
 *
 * Origin: written in the 2026-08-18 Mac session (JJH Reel 2026/04_WEB/reelbed.js).
 * Two fixes applied on the way into the repo, both marked [FIX] below.
 */

export const LOOP_SAMPLES = 1_440_000;   // at the 48 kHz authoring rate
export const SOURCE_RATE  = 48_000;
export const LOOP_SECONDS = LOOP_SAMPLES / SOURCE_RATE;   // 30.000 exactly
export const LOOP_FRAMES  = 720;
export const FPS          = 24;
export const BPM          = 128;
export const BARS         = 16;
export const BAR_SECONDS  = LOOP_SECONDS / BARS;          // 1.875

const STEMS = ['01_pulse', '02_bass', '03_pad', '04_motif', '05_bloom'];
export { STEMS };

export const STAGES = {
  BASE:     ['03_pad'],
  PARTIAL:  ['01_pulse', '02_bass', '03_pad'],
  CRESCENT: ['01_pulse', '02_bass', '03_pad', '04_motif'],
  TOTALITY: ['01_pulse', '02_bass', '03_pad', '04_motif', '05_bloom'],
};

export class ReelBed {
  constructor(baseUrl = '/audio/', opts = {}) {
    this.baseUrl = baseUrl;
    this.ctx     = null;
    this.buffers = new Map();
    this.sources = new Map();
    this.gains   = new Map();
    this.master  = null;
    this.t0      = null;            // AudioContext time of loop-position 0
    this.stage   = opts.stage || 'BASE';
    this.started = false;
    this.warnings = [];

    // [FIX] The loop is 30.000 s of wall clock, always. The original computed
    // LOOP_SAMPLES / ctx.sampleRate, which is only right when the context happens
    // to run at 48 kHz. On a 44.1 kHz context (common on Windows and on phones)
    // decodeAudioData resamples the stems to 1,323,000 samples — still 30 s — but
    // the old maths returned 32.65 s and every stem would have looped long.
    this.loopSec = LOOP_SECONDS;
  }

  /** Fetch + decode all five stems. Safe to call before any user gesture. */
  async load() {
    const AC = window.AudioContext || window.webkitAudioContext;
    // Ask for the authoring rate. Ignored by browsers that don't support the hint,
    // which is fine — loopSec no longer depends on getting it.
    try { this.ctx = new AC({ sampleRate: SOURCE_RATE }); }
    catch { this.ctx = new AC(); }

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;                 // muted by default — browsers require it
    this.master.connect(this.ctx.destination);

    const expected = Math.round(this.ctx.sampleRate * LOOP_SECONDS);

    await Promise.all(STEMS.map(async (name) => {
      const res = await fetch(`${this.baseUrl}${name}.opus`);
      if (!res.ok) throw new Error(`reelbed: cannot fetch ${name} (${res.status})`);
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());

      // Assertion, not a comment. A codec that pads the file will drift the
      // master clock a few ms per pass and desync the picture within a minute.
      // [FIX] compared against the context's own rate, not a hardcoded 48 kHz count.
      if (Math.abs(buf.length - expected) > 1) {
        const msg = `${name}: ${buf.length} samples, expected ${expected} `
                  + `(${buf.length > expected ? '+' : ''}${buf.length - expected}) — re-encode this file`;
        this.warnings.push(msg);
        console.warn(`reelbed: ${msg}`);
      }
      this.buffers.set(name, buf);
    }));
    return this;
  }

  /** Must be called from a user gesture. Starts all five stems sample-locked. */
  async start(when = null) {
    if (this.started) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const t = when ?? this.ctx.currentTime + 0.08;   // small lead so all five arm together
    this.t0 = t;

    for (const name of STEMS) {
      const src  = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      src.buffer    = this.buffers.get(name);
      src.loop      = true;
      src.loopStart = 0;
      // NEVER buffer.duration — that inherits any codec padding.
      src.loopEnd   = this.loopSec;
      gain.gain.value = this._targetGain(name, this.stage);
      src.connect(gain).connect(this.master);
      src.start(t);                                   // identical t ⇒ locked forever
      this.sources.set(name, src);
      this.gains.set(name, gain);
    }
    this.started = true;
  }

  /** Fade the master in/out. The reel plays muted until someone asks for sound. */
  setMuted(muted, seconds = 0.4) {
    const g = this.master.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(muted ? 0 : 1, now + seconds);
    this.muted = muted;
  }

  /**
   * Change eclipse stage. Holds the current voicing until the next bar line, then
   * crossfades over half a bar.
   *
   * [FIX] The original ramped from `now` to `barLine + halfBar`, so the arrangement
   * actually started changing the instant the scroll handler fired and merely
   * *finished* near a bar line. That is the opposite of the intent in the spec
   * ("transitions crossfade the stem set at the bar line") and it is audible: the
   * pad thins out mid-phrase. Now the gain is pinned until the bar line and the
   * ramp happens entirely inside the following half bar.
   */
  setStage(stage, { atBarLine = true } = {}) {
    if (!STAGES[stage]) throw new Error(`reelbed: unknown stage ${stage}`);
    const prev = this.stage;
    this.stage = stage;
    if (!this.started || stage === prev) return;

    const now   = this.ctx.currentTime;
    const start = atBarLine
      ? this.t0 + Math.ceil((now - this.t0) / BAR_SECONDS) * BAR_SECONDS
      : now;
    const end = start + BAR_SECONDS * 0.5;

    for (const name of STEMS) {
      const g = this.gains.get(name).gain;
      const target = this._targetGain(name, stage);
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.setValueAtTime(g.value, Math.max(start, now));   // hold through to the bar line
      g.linearRampToValueAtTime(target, Math.max(end, now + 0.01));
    }
    return { start, end };
  }

  _targetGain(name, stage) { return STAGES[stage].includes(name) ? 1 : 0; }

  /** Current gain of one stem, for meters. */
  stemGain(name) { const g = this.gains.get(name); return g ? g.gain.value : 0; }

  /** Position within the loop, 0..1. This is the master clock. */
  phase() {
    if (!this.started) return 0;
    return (((this.ctx.currentTime - this.t0) % this.loopSec) + this.loopSec) % this.loopSec / this.loopSec;
  }

  /** Seconds until the loop wraps. */
  toLoopEnd() { return (1 - this.phase()) * this.loopSec; }

  /** AudioContext time of the next loop boundary. */
  nextBoundary() {
    if (!this.started) return this.ctx.currentTime;
    const n = Math.ceil((this.ctx.currentTime - this.t0) / this.loopSec);
    return this.t0 + n * this.loopSec;
  }

  /** AudioContext time of the next bar line. */
  nextBar() {
    if (!this.started) return this.ctx.currentTime;
    const n = Math.ceil((this.ctx.currentTime - this.t0) / BAR_SECONDS);
    return this.t0 + n * BAR_SECONDS;
  }

  /** Convenience for driving picture. */
  frame() { return Math.floor(this.phase() * LOOP_FRAMES) % LOOP_FRAMES; }
  bar()   { return Math.floor(this.phase() * BARS) + 1; }
  /** How many complete loops since start — for the "vary on a longer cycle" trick. */
  pass()  { return this.started ? Math.floor((this.ctx.currentTime - this.t0) / this.loopSec) : 0; }

  /**
   * Nudge a <video> toward the audio clock. Call every rAF.
   * Corrects with playbackRate, never with seeks — seeking visibly stutters.
   */
  syncVideo(video, { tolerance = 0.020, maxRate = 0.015, hardSeek = 0.35 } = {}) {
    if (!this.started || video.readyState < 2 || !video.duration) return 0;
    const want = this.phase() * video.duration;
    let err = want - video.currentTime;
    // shortest way round the loop
    if (err >  video.duration / 2) err -= video.duration;
    if (err < -video.duration / 2) err += video.duration;

    if (Math.abs(err) > hardSeek) {
      // A 0.5% rate nudge shaves ~5 ms per second, so anything past a third of a
      // second would take minutes to claw back. Past that, take the visible cut.
      video.currentTime = want;
    } else if (Math.abs(err) > tolerance) {
      // The reel is muted, so there is no pitch artefact to protect and a 1.5%
      // rate change is invisible. At the old 0.5% cap a tenth of a second of
      // drift took twenty seconds to claw back.
      video.playbackRate = 1 + Math.max(-maxRate, Math.min(maxRate, err * 0.5));
    } else {
      video.playbackRate = 1;
    }
    return err;
  }
}

/*
 * Why no Tone.js for the bed:
 *
 * All five stems are one fixed length with identical loop points, so starting them
 * at the same AudioContext time locks them together permanently — the hardware clock
 * does the work and no scheduler can drift. Tone.Transport would add a JS-side clock
 * on top of a problem that doesn't have one.
 *
 * Tone.js IS worth pulling in for the scroll instrument, where you need quantised
 * scheduling (next 16th = 117.1875 ms at 128 BPM). If you do, drive Tone from this
 * engine's phase() rather than running Tone.Transport as a second source of truth.
 */
