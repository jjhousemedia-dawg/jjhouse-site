/**
 * eclipse-stage.js — the eclipse dial.
 *
 * ── The model, and why it changed (JJ, 2026-08-19) ────────────────────────────
 *
 * The first version stepped through seven pre-rendered segments and could only
 * swap at loop boundaries. That is the faithful reading of the original segment
 * plan, and it is also why it took ninety seconds to reach totality: a segment
 * that may only change at a boundary cannot respond to scroll faster than one
 * loop. The ruling is that the visitor must feel like they are driving it, the
 * way an Apple product page feels, so the segment model goes.
 *
 * What replaces it separates the shot into TWO INDEPENDENT TIME AXES:
 *
 *   AMBIENT TIME   wall clock, always advancing, never scrubbed.
 *                  Reeds, water, cloud drift — and the reel, which does its
 *                  720-frame loop no matter what the scroll is doing.
 *
 *   ECLIPSE TIME   a pure function of scroll POSITION, 0..1, instantly
 *                  reversible. Sun, moon, sky colour, light level, stars.
 *
 * Because eclipse time is a position and not a playhead, scrubbing backwards is
 * free, there is nothing to wait for, and — the part worth noticing — the page
 * never needs a scroll lock. By the time you have scrolled past the eclipse span
 * you ARE at totality; there is no state to trap the visitor in.
 *
 * Release behaviour comes from damping, not from playback: `e` chases the scroll
 * position through a frame-rate-independent exponential follower, so letting go
 * settles rather than stops dead, while the ambient layer keeps breathing.
 *
 * ── What this asks of the render ─────────────────────────────────────────────
 *
 * Not seven segments. Three ambient loops of the SAME 720-frame animation under
 * the three art-directed lighting keys (day / crescent / totality), cross-faded
 * by `e`; the sun, moon and corona held out as a separate scrubbable element.
 * That is 2,160 frames instead of 5,040, and it is the only shape that supports
 * instant bidirectional scrub. See the note in reel-lab.astro.
 */

export const ORDER = ['BASE', 'PARTIAL', 'CRESCENT', 'TOTALITY'];

/** Rising thresholds, and the lower values they fall back through. */
const UP   = [0, 0.18, 0.52, 0.86];
const DOWN = [0, 0.12, 0.46, 0.80];

export class EclipseScrub {
  /**
   * @param {import('./reelbed.js').ReelBed} bed
   * @param {{tau?:number, onStage?:Function, onTotality?:Function, onLeaveTotality?:Function}} opts
   *   tau — follower time constant in seconds. 0.12 reads as weighted but immediate;
   *   0 is a hard 1:1 lock to the scrollbar, which feels twitchy on a trackpad.
   */
  constructor(bed, opts = {}) {
    this.bed   = bed;
    this.tau   = opts.tau ?? 0.12;
    this.onStage        = opts.onStage || (() => {});
    this.onTotality     = opts.onTotality || (() => {});
    this.onLeaveTotality= opts.onLeaveTotality || (() => {});

    this.e       = 0;   // damped eclipse progress, what you render
    this.eTarget = 0;   // raw scroll-derived progress
    this.index   = 0;   // committed stage index, hysteretic
    this.unlocked= false;
    this._last   = null;
  }

  get stage() { return ORDER[this.index]; }

  /** Called from scroll. 0..1 across the eclipse span. */
  request(p) { this.eTarget = Math.max(0, Math.min(1, p)); }

  /** Jump with no damping — for a resize, or restoring scroll position on load. */
  snap(p) { this.request(p); this.e = this.eTarget; }

  /**
   * Call every rAF with the timestamp. Advances the follower, commits stage
   * changes through hysteresis, and hands the audio its new voicing.
   * ReelBed.setStage does the bar-line quantising, so the music still only ever
   * changes on the beat — within 1.875 s, not within 30 s.
   */
  update(nowMs) {
    const dt = this._last === null ? 0.016 : Math.min(0.1, (nowMs - this._last) / 1000);
    this._last = nowMs;

    // Frame-rate independent exponential follower.
    this.e += (this.eTarget - this.e) * (this.tau > 0 ? 1 - Math.exp(-dt / this.tau) : 1);
    if (Math.abs(this.eTarget - this.e) < 0.0005) this.e = this.eTarget;

    // Hysteresis: rise on UP, fall on DOWN, so a hand resting on the boundary
    // cannot flap the arrangement back and forth.
    let i = this.index;
    while (i < ORDER.length - 1 && this.e >= UP[i + 1]) i++;
    while (i > 0 && this.e < DOWN[i]) i--;
    if (i !== this.index) {
      this.index = i;
      this.bed.setStage(this.stage);     // quantised to the next bar line inside ReelBed
      this.onStage(this.stage);
    }

    const nowTotal = this.e >= 0.985;
    if (nowTotal && !this.unlocked) { this.unlocked = true;  this.onTotality(); }
    if (!nowTotal && this.unlocked && this.e < 0.94) { this.unlocked = false; this.onLeaveTotality(); }

    return this.e;
  }
}

/**
 * TotalityPing — one-shot B natural (MIDI 83), the dorian 6.
 *
 * Consonant over both Dm9 and G6/9 but outside both scroll pitch sets, so it reads
 * as arrival rather than as another scroll note. The only element in the mix with a
 * long reverb tail. Quantised to the next downbeat: a beat of delay is invisible and
 * landing on the beat is the difference between a sound effect and a moment.
 */
export class TotalityPing {
  constructor(bed) { this.bed = bed; this.ir = null; }

  _impulse(seconds = 3.6, decay = 2.6) {
    const ctx = this.bed.ctx;
    const n   = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < ctx.sampleRate * 0.02 ? 0.15 : 1);
      }
    }
    return buf;
  }

  /** Schedule the ping on the next bar line. Returns the AudioContext time it fires. */
  fire({ midi = 83, gain = 0.5 } = {}) {
    const bed = this.bed;
    if (!bed.started) return null;
    const ctx = bed.ctx;
    const at  = bed.nextBar();
    const f   = 440 * Math.pow(2, (midi - 69) / 12);   // 987.767 Hz for MIDI 83

    if (!this.ir) this.ir = this._impulse();
    const verb = ctx.createConvolver(); verb.buffer = this.ir;
    const wet  = ctx.createGain(); wet.gain.value = 0.9;
    const dry  = ctx.createGain(); dry.gain.value = 0.7;
    verb.connect(wet).connect(bed.master);
    dry.connect(bed.master);

    // Two partials, so it rings like struck metal instead of reading as a test tone.
    [[f, gain, 2.2], [f * 2, gain * 0.22, 1.4]].forEach(([freq, g, dur]) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0, at);
      amp.gain.linearRampToValueAtTime(g, at + 0.006);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(amp); amp.connect(dry); amp.connect(verb);
      osc.start(at); osc.stop(at + dur + 0.1);
    });
    return at;
  }
}
