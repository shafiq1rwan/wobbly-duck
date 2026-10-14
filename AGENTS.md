# Wobbly Duck — agent guide

Instructions for coding agents (Codex, Claude Code, …) working in this repo. Read this first,
then the doc that matches your task:

- UI, HUD, menus → [docs/UI_SPEC.md](docs/UI_SPEC.md) (reference: [docs/reference/ui-reference.png](docs/reference/ui-reference.png))
- Art and audio assets → [docs/ASSET_SPEC.md](docs/ASSET_SPEC.md)
- The twist (Duckling Parade) → [docs/DUCKLING_PARADE.md](docs/DUCKLING_PARADE.md)

## The game

A 2D side-scrolling endless runner for desktop and mobile browsers, aimed at Poki. A chubby
yellow duck floats on an endless river; the world scrolls right-to-left. The player jumps
(Space / W / ↑, swipe up) and dashes (D / →, swipe right) to avoid logs, rocks and crates and
to collect food (corn kernels, peas, and rare big corn). Sessions are short and restarting is instant.

Design pillars — check every change against these:

1. Extremely simple controls; responsive over realistic.
2. The duck feels soft and alive (squash and stretch, wobble); water interaction is satisfying.
3. Collisions are fair and readable on small screens; the background never competes with obstacles.
4. Fun within the first 10 seconds; no unnecessary systems.

## Commands

```bash
npm install
npm run dev         # http://localhost:5173 (LAN URL is printed for phone testing)
npm run typecheck   # must pass before you finish
npm run build       # typecheck + production build into dist/
```

Add `?debug` to the URL to draw collision shapes and expose the scene as `window.__scene`.

## Stack and layout

Phaser 3.90 (rendering, scenes, sprites, animation), TypeScript (strict), Vite 7. No Phaser
physics: movement and collisions are hand-written.

```
index.html               DOM overlay markup (menus, HUD)
src/main.ts              Phaser game config
src/config.ts            ALL gameplay tuning (speeds, jump, buoyancy, dash, water, spawning, colours)
src/core/                Viewport (DPR, resize, camera framing), InputManager, Storage, Audio (Web Audio sfx)
src/platform/            Portal adapter — no-op locally; Poki SDK goes here in Phase 5
src/art/duckSprite.ts    Duck sheet layout: frame size, pivot, scale, animations
src/game/                Duck (controller), DuckView (visuals + squash/stretch), Spring, Water (waves +
                         ripples), Splashes (droplets, speed lines), CameraShake, DashMeter,
                         ObstacleManager (log/crate/rock), FoodManager, Parade (ducklings),
                         ScorePopups, Patterns (handcrafted
                         patterns + Spawner, difficulty tiers), Background
src/scenes/              BootScene (loading), GameScene (state machine + loop)
src/ui/UI.ts + style.css DOM menus and HUD
assets-src/              High-res source art (versioned, NOT shipped)
public/assets/           Optimised runtime assets — generated WebPs (everything here ships)
tools/                   Asset processing scripts (not shipped)
docs/                    Specs and reference images (not shipped)
```

## Architecture rules

- **World units.** 1 unit ≈ 1 CSS px at the 1280×720 reference. The water rest line is
  `CONFIG.water.restY` (470). The duck's anchor is world x = 0; the camera puts it at 27% of
  the visible width.
- **Tuning lives in `src/config.ts`.** Don't hard-code gameplay numbers elsewhere.
- **Collision is separate from visuals.** `Duck.collider` is a fixed circle and obstacles use
  fixed hit boxes. Squash, stretch, rotation and sprite changes happen only in view code and must
  never resize hitboxes.
- **Controllers vs views.** `Duck` (physics/state, no Phaser imports) vs `DuckView` (sprite,
  animation). Effects read one-frame flags (`justJumped`, `justLanded`, `justDashed`); they can be
  raised by input or physics and are cleared once, at the **end** of `GameScene.update`.
- **Physics is sub-stepped** (≤ 1/120 s) in `GameScene.update`. Use `dt`, never frame counts.
- **Input** goes through `InputManager` actions (`jump`, `dash`, `confirm`, `pause`). Phaser's
  own input plugin is disabled.
- **UI is a DOM overlay**, not Phaser text. It respects safe areas via CSS `env()`.
- **Platform code stays in `src/platform/`.** Don't call any portal SDK from gameplay code,
  and don't invent SDK method names — use the official Poki documentation when integrating.
- **Patterns are timed in seconds of travel** (`src/game/Patterns.ts`), so fairness holds at any
  speed. Obstacles that must be jumped stay ≥ 1.3 s apart; leave ≥ 1.5 s after a crate. Food arcs
  use the simulated jump, so they always match the real trajectory. Food can rest only on crates
  (`lid`, collected by smashing); above logs/rocks use `crown` at jump height.
- **Pool, don't allocate**, in per-frame code (obstacles, particles, effects).
- Keep it simple: no new frameworks, state libraries or abstractions without a clear need.

## Assets workflow

Specs, sizes, pivots and file names are in [docs/ASSET_SPEC.md](docs/ASSET_SPEC.md). In short:

- **Loading speed matters (Poki).** Put source art in `assets-src/`, add it to the MANIFEST in
  `tools/optimize-images.py` (crop, max height, WebP quality) and run
  `python tools/optimize-images.py` — it writes WebPs to `public/assets/`. Never copy raw PNGs into
  `public/`. Load files in `BootScene.preload` with `` `${import.meta.env.BASE_URL}assets/<file>` ``
  and add a matching `<link rel="preload" as="image">` in `index.html`.
- Use transparent PNGs with real alpha. A strip on a white background can be converted with
  `python tools/process-duck-strip.py <strip.png> <out_dir>`.
- **Never put notes or docs in `public/`** — Vite copies the whole folder into the build.
- After swapping art, check `?debug`: hitboxes must still match the visible body.

## Art direction is the owner's call

- Don't change the active look — background layers, water/sky colours, palette, duck, UI style —
  unless the project owner asked for that change. Deliver new or alternative art as **unused**
  assets (sources in `assets-src/`, a note in `docs/assets/`, a row in `docs/ASSET_LOG.md`) and let
  the owner decide. The current scenery is clouds + distant rocks + palm islands over blue ocean.
- Art-only tasks shouldn't edit game code; integration happens separately.

## Known gotchas

- **Phaser frames:** `texture.add(name, …)` makes the first added frame the texture's
  *default*. Anything that wants the whole image must then pass `'__BASE'` explicitly, and code
  that adds a frame should always reference it by name (see `Background.ts`).
- **Encoding:** save source files as UTF-8 **without BOM**. A previous edit produced mojibake
  in comments (`Ã—` for `×`).
- **Several agents edit this repo.** Before editing, re-read the file (it may have changed),
  keep diffs focused, and don't revert someone else's work. If something looks wrong, report it.

## Verify before you finish

1. `npm run typecheck` passes (and `npm run build` for asset or config changes).
2. Play at 1280×720 and at a portrait phone size (e.g. 390×844); no console errors.
3. With `?debug`, collision shapes line up with the art.
4. Restart, pause/resume and the game-over flow still work.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 Prototype | canvas, water, buoyancy, jump, dash, log, collision, restart | done |
| — Art pass | duck spritesheet, parallax scenery, UI restyle | done |
| 2 Game feel | squash/stretch springs, ripples, splashes, synth sound effects, mute toggle | done |
| 3 Endless | log/crate/rock, dash-smash crates, handcrafted patterns, food collectibles, speed ramp + tiers, game-over food | done — awaiting feedback |
| 4 Polish | final UI per UI_SPEC, music, mobile tuning, performance | — |
| 5 Publishing | build/asset optimisation, Poki SDK, submission tests | — |
