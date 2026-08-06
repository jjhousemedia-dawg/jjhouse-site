# jj.house — read this before touching anything

If you are an AI session picking this repo up, read this whole file first. It is short.
**The code in this repo does not represent the current direction.** Large parts of it are dead
and are only still here because deleting things is JJ's call, not yours.

---

## STOP — things that are dead. Do not build on, extend, or take inspiration from any of these.

| Dead | Where it still lives | Why |
|---|---|---|
| **The first-person camera-rig homepage** — POV hands holding a camera, framing a 3D house on a dune | `src/components/HouseHero.astro`, `public/house*.glb`, `rig*.glb`, `neon.glb`, `ticker.glb` | It was the previous concept. JJ moved off it after feedback. It is not the front door and its ideas do not carry into the new one. |
| **The shot-list post-it and its checkboxes** | `public/postit/*.webp`, the `jjvisits` cookie in `src/layouts/Base.astro` | Part of the same dead concept. |
| **The four role routes** — `/director`, `/producer`, `/vfx-edit`, `/for-fun` | `src/pages/*.astro`, `src/layouts/Base.astro` nav | Splitting the work by which hat JJ wore is **the exact problem the rebuild exists to solve.** Do not recreate role-based navigation in any form. |
| **Role-keyed data** | `src/data/reels.json` | Superseded by `src/data/projects.json`, which is project-first with a `roles` array. Never read `reels.json`. |
| **The navy palette** `#10142e` | `src/styles/global.css`, `Base.astro` theme-color | The site is black and white now. See house rules below. |
| **The planet hero and the test pages** | `PlanetHero.astro`, `camera-test`, `glyph-test`, `journey-test`, `planet-test` | Experiments from the old build. |
| **YouTube and Vimeo embeds as the player** | `ReelSection.astro` | Work moves to self-hosted Mux. YouTube's end screen is a competitor's exit door on a page whose whole premise is a curated sequence. |

If a task seems to call for any of the above, you have misread the brief. Stop and ask JJ.

---

## What this site actually is

A single **narrative endless scroll**, black and white, that argues one idea and then proves it with work.
It is not a gallery, not a grid, and not sorted by job title.

**The thesis, in JJ's own words:** things change on the way to getting made. Some of that change is the
piece working out what it actually is, and some is attrition. From the inside they look identical.
Telling them apart, early enough to act, is most of the job.

That is a **judgment** claim, not a reliability claim. It is why the range across producing, editing,
VFX, directing and strategy is an argument rather than a list — he learned every job because the gap
opens somewhere different every time.

The direction is called **BECOMING**. Reference site for mechanics only, never for copy: `noth.in`.

---

## Where the truth lives

**`docs/SITE-SPEC.md`, in this repo.** Canonical. Beats, copy with lock status, mechanic specs,
data notes, open questions. **Read it before writing anything.** It lives here rather than on JJ's
Mac precisely so that a session working in the code cannot miss it.

`02 Areas/Career/JJ.house Website/` on JJ's MacBook holds the strategy history — Strategy v1, v2,
v3 and an addendum. Those are the **reasoning record only**. They are superseded, and v1 and v2 each
contain a fabrication JJ caught. Read them for history, never for instructions.

Project memory carries the same state under `jjhouse-website` and `jjhouse-infrastructure`.

---

## Current state

Branch **`rebuild/scroll`** holds the real direction:

- `src/pages/index.astro` — ten-beat scroll: arrival, premise, aside, reel, work, Little Dot, how I work, now, come in
- `src/pages/work.astro` — 45-project archive, the `View all ↳` destination
- `src/data/projects.json` — project-first, one entry per project with a `roles` array
- `src/layouts/Scroll.astro`, `src/styles/scroll.css` — monochrome system

Placeholders in there are deliberate and marked: the hero WebGL surface, the reel video, the Now
beat, every per-project anecdote, and the beat 05 project selection.

---

## House rules

**Colour.** The site is black and white. Colour exists **only inside the work** — inside project
media, nowhere else. No accent colours, no coloured buttons, no coloured links. The rule only
works if it is absolute.

**Voice.** Write in JJ's real register: flowing sentences with commas, load-bearing analogies, dry
parentheticals, honest uncertainty. **No em-dashes. No "it's not X, it's Y" parallels. No sentence
fragments for punch. No "here's the thing".** Every studio site on earth is written in ad-fragment
voice and that is exactly what this one is avoiding. The style guide is
`JJ_House_Writing_Style_Guide.md`.

Reliable tell, true of every draft so far: **when copy fails here, it went abstract.** Stay concrete.

**Never invent biography.** Nothing about JJ's life, projects, credits or history goes into copy
unless he said it or it is in the verified credit roster. This has gone wrong twice and he caught
both. Where a line needs a detail you do not have, **leave a bracket.**

**Hero, if you build it.** Minimal near-dead surface layer with all the flavour underneath, revealed
by dragging and refilling like foam closing over water. Surface can be flat SVG or 3D rendered to
read as 2D. The substrate is Blender geo-nodes work, in colour. **This is not the old 3D house.**

---

## Working with JJ

He is not comfortable in a terminal. Give GUI steps, or exactly one copy-paste block with no prose
mixed into it — he once pasted a whole message including file contents into PowerShell.

He works on the **PC** (`C:\Users\jjhou\jjhouse-site`) and keeps docs on the **MacBook**.
He pushes via **GitHub Desktop**. Nothing touches `main` without his say-so; preview branches only.

He iterates at word level and responds far better to options with tradeoffs than to a finished verdict.
