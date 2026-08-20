# jj.house — the eclipse beat

**Build spec for the Blender marsh project. Version 1, 2026-08-19.**
Supersedes the seven-segment plan in `03_CONTEXT/PROJECT_CONTEXT.md` §4 and the water-room
description in the site's `docs/SITE-SPEC.md`.

---

## 1. What the visitor experiences

The reel plays full-bleed. As they scroll it recedes into one-point perspective down a channel in a
Southern Delaware marsh at late afternoon, its reflection in the water beneath it. Keep scrolling
and a solar eclipse dials in — not on a timer, but **driven by the scroll the way an Apple product
page turns a shoe**. Scroll up and it unwinds. Stop anywhere and the scene keeps living: reeds
sway, water moves, and the reel keeps looping. Reach totality and the page hands off to WORKS.

Two rules govern everything below:

> **The reel does its 30-second loop irrespective of anything else.**
> **The eclipse is a position, not a playback.**

---

## 2. The architecture — who owns what

The shot is split along **two independent time axes**. This is the whole design.

| | AMBIENT time | ECLIPSE time |
|---|---|---|
| driven by | the wall clock, always advancing | scroll **position**, 0 → 1 |
| never | scrubbed, paused or reversed | plays on its own |
| carries | reeds, water, cloud drift, the reel loop | sun, moon, corona, sky colour, light level |
| lives in | **Blender** (the plates) | **the browser** (a blend factor) |

Because eclipse time is a position rather than a playhead, scrubbing backwards is free, there is
nothing to wait for, and **the page never needs a scroll lock** — by the time someone has scrolled
past the span they are already at totality.

### Why the seven-segment plan is dead

The original chain was `BASE → T1 → PARTIAL → T2 → CRESCENT → T3 → TOTALITY`, seven clips of 720
frames, swapped only at loop boundaries. It was built and shipped to a test page. It works, and it
takes **90 seconds** to reach totality, because a segment that may only change at a boundary cannot
respond to scroll faster than one loop. That is not a tuning problem, it is what the model is.
JJ ruled it out on 2026-08-19.

---

## 3. The one number

```
L = 720 frames = 30.000 seconds @ 24.000 fps = 16 bars @ 128 BPM
1 bar = exactly 45 frames
```

Unchanged, and still load-bearing. Every animated element's period must divide 720 — the Botaniq
wind loop is 120 frames, and 720 = 6 × 120. The music bed, the reel cut and the plates are all
phase-locked to it. **24.000 exact, not 23.976.**

---

## 4. What Blender delivers

### 4.1 The plates

Each plate is **720 frames of the identical animation**, differing only in lighting. Same seed,
same frame range, same camera, same everything. The browser cross-fades between them.

| | name | when |
|---|---|---|
| 1 | `PLATE_DAY` | **required** — render this first |
| 2 | `PLATE_TOTALITY` | **recommended** — this is what turns the eclipse on |
| 3 | `PLATE_CRESCENT` | optional — art direction exact at all three keys |

Plus, regardless of how many plates get rendered:

| | name | why |
|---|---|---|
| ★ | `REF_CRESCENT` — **one single frame**, crescent lighting | the browser's colour trim is fitted to it. Load-bearing. See §6. |

### 4.2 The two AOVs — order these on the same render, they are nearly free

On the DAY plate at minimum:

- **Normal pass** — the water surface normal. The browser uses its deviation from flat as a 2D
  ripple offset, which is how it reflects *both* the reel and the sun accurately.
- **Object Index or Cryptomatte for `ENV_Water`** — tells the browser which pixels are water.

Both come out of the same Cycles render as extra outputs, so they should add close to nothing.
**Time one frame with and without to confirm before committing to 720.** Half resolution is fine
for both; precision matters far less here than you would expect.

### 4.3 ⛔ Hold-outs — the most important instruction in this document

The plates must **NOT** contain:

**a) The visible sun, moon or corona.** Keep the sun as an *illumination* source so the reeds and
water are lit correctly, but remove its visible disc and its specular glitter on the water.
- If the Nishita sky's `sun_disc` is doing the work, switch it off and add a Sun lamp to carry the
  light.
- There is already a separate `SUN_Disc` object in `40_SKY`. Disable its **Camera** and **Glossy**
  ray visibility, keep Diffuse on.

**b) The reel image.** Keep `REEL_Screen` as an emissive plane at plausible average luminance — a
flat mid value, or a heavily blurred stand-in — so its bounce light and broad glow really are in
the plate. Then disable its **Camera** and **Glossy** ray visibility, so no crisp image and no
crisp reflection are baked in.

Why this matters: anything baked into a plate is frozen. A baked sun cannot follow the dial. A
baked reel means **any change to the cut invalidates every frame of every plate** — and the reel
cut is not finally settled ("Stone Island" may still turn up, and a UHD re-master is open). The
browser draws both and reflects both, so both stay live for free.

### 4.4 Format

- 1920×1080 for now; render higher and downsample as with the wordmark video.
- Master to EXR or DNxHR HQX, then a web ladder matching the wordmark: AV1 10-bit, HEVC 10-bit,
  H.264, plus a poster. bt709, keyint 120, faststart, muted.
- **Loop seam verified**: frame 720 must cut to frame 1 invisibly. Render two passes back to back
  and watch the join.
- `ffprobe -count_frames` must report exactly 720.

---

## 5. What must not change

The browser is written against these. If any of them moves, tell the web side.

- `L = 720`, 24.000 fps.
- **The camera is fixed.** Do not animate `CAM_Main` (currently at `(0, −10, 1.5)`, 40 mm on a
  36 mm sensor, level).
- **The waterline stays put.** The browser mirrors reflections about a fixed horizon.
- **The sun's screen position stays put.** The browser draws the disc pair there. Measured from the
  reference stills at **86% across, 17% down, radius 3.1% of frame width** — confirm and lock this,
  or send the real numbers.
- `REEL_Screen`'s position and size, since the browser composites the reel onto that rectangle.
  Its current placeholder at `(0, 120, 13)`, 40 m wide, works out to **68.4% of frame width,
  centred 32.5% down**. That is much larger than the reference stills suggest — **needs
  reconciling**, and it is a real open question, not a rounding issue.

---

## 6. The measurements that decided this

All three reference stills were compared numerically, with the sun and its water glade masked out.
The grade used was an *optimal monotone per-channel LUT*, meaning **the best any colour grade could
possibly do** — better than one done by hand. Error is RMS out of 255.

**First, a validity check.** Contrast-invariant gradient-orientation matching puts all three stills
at the same geometry, agreement 0.86–0.89, peak within one pixel at 960×540 and identical for both
comparisons, which is a resampling artifact rather than motion. **The stills differ in light only,
so these numbers measure light and nothing else.**

| approach | frames | error |
|---|---|---|
| 1 plate, graded to totality | 720 | **16.6** |
| 2 plates, straight cross-dissolve | 1,440 | **25.6** at the midpoint |
| 2 plates + colour trim | 1,440 | **8.5** at the midpoint |
| 3 plates | 2,160 | exact at every key |

For scale, the raw gap between the day and totality looks is 83.3.

**Finding 1 — one plate cannot reach totality.** 16.6 is a hard ceiling even with the target in
hand to fit against, and the error concentrates exactly where the eye goes: sky and clouds (15.2)
and the reed banks (18.0). A global per-channel map cannot dim the sky while keeping the reeds
warm, and it turns the pink clouds grey. Those are the two most beautiful things in the totality
reference.

**Finding 2 — a straight dissolve between two plates goes through grey, and no amount of tuning
fixes it.** Mean saturation: day 0.323, totality 0.259, and **the real crescent 0.498**. The
crescent is *more* saturated than either endpoint, so it sits outside the line joining them. No
linear blend can ever reach it. This is the single most important technical finding here: **never
ship a naive lerp between plates.**

**Finding 3 — a per-channel trim curve recovers it completely and costs nothing.** Saturation goes
0.212 → 0.498, an exact match, and error drops 25.6 → 8.5. Validated held-out: the curve was fitted
on half the pixels and scored 8.5 on the other half, identical to its score on the pixels it was
fitted to. It is a real colour transform, not memorisation.

**This is why `REF_CRESCENT` is on the deliverables list.** The trim needs something to be fitted
against — but only **one frame**, not 720. One still buys most of the third plate's value.

---

## 7. The recommended path

The three options are **rungs on a ladder, not a fork. The browser code is identical for all of
them.** Option 1 is option 2 with the second plate missing.

1. **`PLATE_DAY` only.** 720 frames. The reel recedes into a living marsh that loops. No eclipse.
   Ship-able, and not a failure.
2. **`PLATE_DAY` + `PLATE_TOTALITY` + `REF_CRESCENT` still.** 1,440 frames + 1. The whole beat.
   **This is the recommendation.**
3. **Add `PLATE_CRESCENT`.** 2,160 frames. Art direction exact at every key.

**Order of work:**

1. Render `PLATE_DAY` with the hold-outs and the two AOVs. Ship it. The site goes live with a
   working reel beat and no eclipse dependency.
2. Time one frame properly first. `720 × seconds-per-frame` is the whole cost model —
   at 60 s/frame that is 12 hours per plate. **Decide 4K vs 6K from a measured frame, not a guess.**
3. Render `REF_CRESCENT` — one frame, minutes.
4. Render `PLATE_TOTALITY` when there is machine time. The eclipse turns on with a config change.

Nothing built at rung 1 is thrown away at rung 2 or 3.

---

## 8. What the browser already does

Live on `preview/blockout-wire` at `/reel-lab`, verified by 24 headless assertions plus 35 on the
audio clock.

- Damped scroll follower, `tau` 0.12 s. Position-mapped, instantly reversible, settles on release.
- Cross-fades the backdrops by eclipse progress, ready to take real plates in place of stills.
- **Draws the sun, moon and corona once and blits them twice** — into the sky, and mirrored,
  stretched and band-displaced into the water. One source, two placements, so the reflection can
  never disagree with the dial. Composited additively, which is what specular light on water is:
  at totality the corona adds light and the opaque moon adds none, so the disc reads dark by being
  the one place no light arrives.
- Composites the reel onto its rectangle plus a rippled reflection, looping on the audio clock,
  independent of the dial.
- Five-stem audio bed, re-voiced per stage, crossfading on bar lines (1.875 s), with the totality
  ping quantised to the next downbeat.

When the plates arrive, the stand-in stills are swapped for them and the water distortion map
replaces the hand-tuned ripple. Nothing else changes.

---

## 9. Open questions for JJ

1. **4K or 6K.** Blocked on a measured frame time.
2. **`REEL_Screen` size and position.** The placeholder reads at 68.4% of frame width; the
   reference stills imply something much smaller. Which is right?
3. **How many plates**, per §7. Recommendation is two plus the crescent still.
4. **Stone Island.** Still never located on any drive. If it turns up it wants a slot in the cut —
   which is now cheap, because the reel is not baked into anything.
