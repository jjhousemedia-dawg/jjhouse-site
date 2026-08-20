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

## Current state — as of 2026-08-19

Branch **`preview/blockout-wire`** is the active build. `rebuild/scroll` is superseded (do not
build on it). `main` is old production; nothing touches it without JJ's say-so.

`docs/SITE-SPEC.md` was last updated 2026-08-06 and **predates the 2026-08-17 rounds** — it is
still canonical for the mechanics and prohibitions, but where it disagrees with the code on this
branch or with this section, the code and this section win. The 8/17 rounds, in git history and in
project memory (`jjhouse-website`):

- **Beats cut by JJ:** 02 premise statement, 03 aside, 07b MORPH, 08 NOW, the credit-ticker role
  cycling, "( the other half )", "Tell me what you can already see." None of these come back
  without JJ initiating it. The page currently carries **no thesis copy at all** — deliberate.
- **Live:** hero "I work with brands and artists on films and campaigns." · positional theme flip
  (light above the reel midpoint, dark below, both directions, via a composited `body::before`
  overlay crossfade) · ( connect ) with "Meeting request →" (Google Calendar booking link) +
  "Email me" · persistent "Menu ::" fab on every page · ( how I work ) is JJ's verbatim copy —
  do not normalize its lowercase open or missing period · finished stories on UTKM, AMIRI Pacific
  Flat, Field Journal (`story` arrays in `projects.json`).
- **Mobile pass (rounds 6-8):** coarse-pointer tap targets · safe-area insets · archive rows
  restack under 46rem · WORKS ghost letters scale to viewport · reel recede is a rAF lerp (NO CSS
  transition — reintroducing one brings back the phone jitter) · touch ink: **one finger scrolls
  and never paints; two fingers paint**, per-finger stroke chains, thinner-than-mouse stamps ·
  the two-finger hint is **paired ambient wisps in the sim itself** (erode.js TOUCHY branch) —
  an explicit dots-and-label invite existed for a few hours on 8/17 and JJ cut it; do not bring
  UI hints back. Feel is live-tunable from any preview URL:
  `?touchr=&touchf=` (finger stroke radius/force factors, defaults 0.2/0.5) and
  `?wispr=&wispf=` (wisp factors, defaults 0.05/0.4). When JJ settles on numbers, bake them into
  `erode.js` defaults.
- **Work overlay (2026-08-19, sixnfive.com reference):** featured cards and every
  archive row open the project as a full-viewport overlay (`WorkOverlay.astro`)
  instead of navigating away — archive rows no longer hand visitors to
  youtube.com. The host's player (youtube-nocookie / player.vimeo, white
  progress bar, minimal chrome) embeds immediately; content is lifted from the
  project's own static /work/ page (fetch + parse — one source of truth, no
  AJAX endpoint, still pure static). The exit is the scroll: opacity maps over
  a 72svh tail zone with a ( keep scrolling ) cue, bottom releases you back to
  the page you left, at the spot you left it. URL pushStates to /work/slug
  while open; ESC and the back button quietly work; scroll is the only
  VISIBLE exit (all four calls ruled by JJ 8/19). Story-less projects show
  clean — title, roles, player — never the bracket scaffold. The overlay rides
  its own Lenis instance; the page Lenis stops underneath, menu-fab (z 900)
  stays above the overlay (z 800).
- **Remaining real gaps:** 04-A line beside the reel · 06-C Little Dot story · hero second clause
  (workshop with JJ — sensibilities, not operations) · ( connect ) closing line · Field Journal
  hero videos + comic pages (on JJ's external drive) · featured-six confirmation + credit fixes.

**Vercel:** project `jjhouse-site`, per-branch previews. Per-deployment URLs freeze at their
commit — always use the branch alias
`jjhouse-site-git-preview-blockout-wire-jj-2698s-projects.vercel.app` (login-gated; JJ views
signed into vercel.com).

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

He has GitHub Desktop clones on **both machines** — `C:\Users\jjhou\jjhouse-site` on the PC and
`/Users/johnhouse/Documents/GitHub/jjhouse-site` on the Mac — and pushes via **GitHub Desktop**.
Nothing touches `main` without his say-so; preview branches only.

The working loop (proven on the Mac, 2026-08-17; same shape on the PC): the AI session edits a
clone or its own checkout, verifies the build passes (`npm run build`), delivers changed files
into JJ's local clone, and **JJ reviews the diff in GitHub Desktop, commits, and pushes** — that
review is the gate. GitHub Desktop clones default to `main`: confirm the clone is on
`preview/blockout-wire` (Current Branch dropdown) before delivering files into it. If a session
has shell access to the clone, treat git as read-only (`status`/`log`/`diff`); index-writing
commands have left stale `.git/index.lock` files behind on sandboxed mounts.

He iterates at word level and responds far better to options with tradeoffs than to a finished verdict.
