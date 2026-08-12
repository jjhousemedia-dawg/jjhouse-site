# Hero substrate video — Blender spec

**For the layer the ink reveals under HOUSE.** Spec §5: surface minimal, substrate
maximal, colour lives down here. This document is the contract between JJ's Blender
scene and the site, so the render lines up with the live wordmark at every viewport.

Last updated 2026-08-11.

---

## The one rule that makes alignment work

**Do not retype HOUSE in Blender.** Import the outlines instead:

```
File → Import → Scalable Vector Graphics (.svg) → docs/assets/wordmark-house.svg
```

That file is the site's exact mark — Zalando Sans Expanded **Black** (900) with the
site's −0.018 em tracking already baked into the letter positions. Typing the text
fresh means matching tracking by eye in Blender's own spacing units, and it will
drift. The import comes in as curves; convert to mesh and it is geo-nodes food.

If other text ever needs setting inside the scene, the matching static instance is
**`ZalandoSansExpanded-Black.ttf`** (family "Zalando Sans Expanded", style "Black").
Blender cannot load the variable font. The Expanded cut, not plain Zalando Sans, not
SemiExpanded.

## Frame

| | |
|---|---|
| Resolution | **3840 × 2160** (UHD 16:9) |
| Camera | **Orthographic**, mark dead centre |
| Frame rate | 24 or 30 fps, whichever the sim likes |
| Length | 8–12 s, **seamless loop** |
| View transform | Standard (or grade to taste) — export **sRGB**, colours ship as rendered |

## Framing the mark

The mark's aspect is **4433 : 742** (5.973 : 1). Frame it so the letters span **90%
of frame width, centred**:

```
letter band:  3456 × 578 px
horizontal:   x = 192 → 3648   (5% margin each side)
vertical:     y = 791 → 1369   (centred on frame middle)
```

Easiest way in: import the SVG, origin to geometry, drop it at world centre, then set
the ortho camera scale until the mark touches 90% of the frame width. Everything else
in the scene hangs off that.

## The field around the letters

Fill the whole frame — no alpha, no letter-shaped crop. Keep the field **near-black**
outside the letterforms: site-side, the video's edges dissolve into the dark water
plate, and a dark field makes that seam invisible (this is also the reference's look —
their reveal video is mostly black with events in it). Keep the important detail
inside the central ~90% × ~60%; the extreme edges may fade or crop.

One pass is enough for this asset — beauty only. The erode mask comes from the fluid
sim at runtime, not from a matte. (The two-pass beauty+matte note in SITE-SPEC §5
applies to the surface-layer job, not this.)

## What the site does with it (so you know why the numbers matter)

The composite shader maps the video's letter band onto the live wordmark's measured
screen rectangle — uniform scale, no stretch — every frame. Because the mapping is
runtime, alignment is exact on every viewport and the 90% band number is the only
thing that has to be true in the render. Outside the video's reach the water plate
continues, with a soft blend at the video's edge.

## Delivery

Master: ProRes 422 or a PNG sequence, full quality. Drop it anywhere in
`C:\Users\jjhou\jjhouse-site` (a `_masters\` folder is fine — it can stay untracked)
and say so; the web encodes (H.264/H.265/AV1 at sane bitrates) and the shader wiring
happen from there. Do not pre-compress for web.
