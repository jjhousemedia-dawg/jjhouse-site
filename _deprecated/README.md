# Deprecated — the previous concept

Everything in here belongs to the **first-person camera-rig** version of jj.house: POV hands
holding a camera, framing a 3D house on a dune, with a shot-list post-it and four role-based
routes (`/director`, `/producer`, `/vfx-edit`, `/for-fun`).

**That concept is dead.** JJ moved off it after feedback. It is kept here rather than deleted
because it is real work and deleting is his call, and because `HouseHero.astro` may find a home
somewhere later.

**Nothing in this folder is a guide to the current direction.** Do not extend it, do not copy
patterns from it, and above all do not recreate role-based navigation — sorting the work by
which hat JJ wore is the exact problem the rebuild exists to solve.

`reels.json` in here is the old role-keyed data. It is superseded by `src/data/projects.json`,
which is project-first. Never read `reels.json`.

See `CLAUDE.md` at the repo root.

## Assets

`public/` in here holds the dead concept's assets: `house.glb`, `house_anchored.glb`, `rig.glb`,
`rig_raw.glb`, `neon.glb`, `ticker.glb`, the `postit/` shot-list art, the `planet/` textures and
the `clouds/` plates.

`_backups/` is JJ's hand-versioned copies from before the repo had git. Git does that job now.

Deliberately **kept** in the live `public/`: `favicon.svg`, `thumbs/` (real project stills) and
`clips/` (real footage) — those may still be useful to the rebuild.
