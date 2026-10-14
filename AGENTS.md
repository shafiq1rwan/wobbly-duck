# Wobbly Duck — agent guide

Instructions for coding agents (Codex, Claude Code, …) working in this repo. Read this first,
then the doc that matches your task:

- UI, HUD, menus → [docs/UI_SPEC.md](docs/UI_SPEC.md) (reference: [docs/reference/ui-reference.png](docs/reference/ui-reference.png))
- Art and audio assets → [docs/ASSET_SPEC.md](docs/ASSET_SPEC.md)
- The twist (Duckling Parade) → [docs/DUCKLING_PARADE.md](docs/DUCKLING_PARADE.md)
- Analytics / Poki Game Events → [docs/ANALYTICS.md](docs/ANALYTICS.md)
- Overview, scripts, Poki build and versions → [README.md](README.md)

## The game

A 2D side-scrolling endless runner for desktop and mobile browsers, published on Poki. A chubby
yellow duck floats on an endless river; the world scrolls right-to-left. The player jumps
(Space / W / ↑, or tap the left half; again in the air for a double jump) and dashes
(D / →, or tap the right half) to avoid logs, rocks, crates and crate stacks, and collects eight
kinds of corn kernel. Lost ducklings join a parade that multiplies the score; lily pads bounce the
duck high. Scores add up to a bank that buys duck skins. Sessions are short and restarting is
instant.

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
npm run build:poki  # Poki build (real SDK, no debug, no credit) into dist-poki/ + wobbly-duck-poki-v<version>-<commit>.zip
```

Add `?debug` to the URL to draw collision shapes, log Game Events (`[measure] …`) and expose the
scene as `window.__scene`. Debug code is compiled out of the Poki build (`import.meta.env.MODE === 'poki'`).
The build version (`package.json` version + commit, `-dirty` with uncommitted changes) is injected as
`__APP_VERSION__` and shown on the menu.

## Stack and layout

Phaser 3.90 (rendering, scenes, sprites, animation; aliased to its official build without Matter
physics), TypeScript (strict), Vite 7. No Phaser physics: movement and collisions are hand-written.

```
index.html               DOM overlay markup (menus, HUD)
src/main.ts              Phaser game config, version label
src/fonts.css            Fredoka @font-face (Latin woff2 only)
src/config.ts            ALL gameplay tuning (speeds, jump, buoyancy, dash, water, spawning, colours)
src/core/                Viewport (DPR, resize, camera framing), InputManager, Storage, Audio (Web Audio sfx)
src/platform/            Portal adapter — LocalPlatform (fake ads) in dev, PokiPlatform in `--mode poki`
src/art/duckSprite.ts    Duck sheet layout: frame size, pivot, scale, animations
src/game/                Duck (controller), DuckView (visuals + squash/stretch), Spring, Water (waves +
                         ripples), Splashes (droplets, speed lines), CameraShake, DashMeter,
                         ObstacleManager (log/crate/rock/crate stack), FoodManager, LilyPads (bounce
                         pads + frogs), Parade (ducklings), BestMarker (best-distance flag), Skins
                         (owned/worn skins), Confetti (party poppers + confetti), Analytics (Poki Game
                         Events), ScorePopups, Patterns (handcrafted patterns + Spawner, difficulty
                         tiers), Background (parallax + tropical→lake biome)
src/scenes/              BootScene (loading), GameScene (state machine + loop)
src/ui/UI.ts + style.css DOM menus and HUD
assets-src/              High-res source art (versioned, NOT shipped)
public/assets/           Optimised runtime assets — generated WebPs (everything here ships)
tools/                   Asset processing scripts (not shipped)
docs/                    Specs and reference images (not shipped)
```

## Architecture rules

- **World units.** 1 unit ≈ 1 CSS px at the 1280×720 reference. The water rest line is
  `CONFIG.water.restY` (470). The duck's anchor is world x = 0; the camera puts it at 27% (narrow
  screens) to 33% (wide screens) of the visible width, zoomed so ~660 units of height show.
- **Tuning lives in `src/config.ts`.** Don't hard-code gameplay numbers elsewhere.
- **Collision is separate from visuals.** `Duck.collider` is a fixed circle and obstacles use
  fixed hit boxes. Squash, stretch, rotation and sprite changes happen only in view code and must
  never resize hitboxes.
- **Controllers vs views.** `Duck` (physics/state, no Phaser imports) vs `DuckView` (sprite,
  animation). Effects read one-frame flags (`justJumped`, `justLanded`, `justDashed`); they can be
  raised by input or physics and are cleared once, at the **end** of `GameScene.update`.
- **Physics is sub-stepped** (≤ 1/120 s) in `GameScene.update`. Use `dt`, never frame counts.
- **Input** goes through `InputManager` actions (`jump`, `dash`, `confirm`, `pause`): keys, taps on
  the canvas halves, and the touch JUMP / DASH buttons (`InputManager.press`). Phaser's own input
  plugin is disabled. The first-run coach (`GameScene.coach`) eases the river to a stop
  (`timeScale`) until the player does the move; bots that call `duck.requestJump()` directly must
  set `learnedJump` / `learnedDash` in storage first.
- **UI is a DOM overlay**, not Phaser text. It respects safe areas via CSS `env()`.
- **Platform code stays in `src/platform/`.** Don't call any portal SDK from gameplay code,
  and don't invent SDK method names — use the official Poki documentation when integrating.
- **Patterns are timed in seconds of travel** (`src/game/Patterns.ts`), so fairness holds at any
  speed. The Spawner enforces obstacle spacing across patterns (`spawner.minObstacleGap`,
  `afterCrateGap`, `afterPadGap`, `beforeStackGap` / `afterStackGap`) and fills open water with a corn
  trail, planning ~3 s ahead so nothing pops in. Food arcs use the simulated jump (single, double, pad
  bounce), so they always match the real trajectory. Food can rest only on crates and crate stacks
  (`lid` / `stackLid`, collected by smashing or flying over); above logs/rocks use `crown` at jump
  height. A new obstacle's height and spacing should be checked against the jump physics and with
  an in-game bot (single vs double jump vs dash), including wave bobbing.
- **Ads and analytics go through `platform`**: `commercialBreak` before every run and resume,
  `rewardedBreak` for the revive (audio muted in the `onStart` callback, input ignored while
  `adPlaying`), `gameplayStarted`/`Stopped` never twice in a row, and Game Events only via
  `src/game/Analytics.ts`.
- **Pool, don't allocate**, in per-frame code (obstacles, particles, effects).
- Keep it simple: no new frameworks, state libraries or abstractions without a clear need.

## Assets workflow

Specs, sizes, pivots and file names are in [docs/ASSET_SPEC.md](docs/ASSET_SPEC.md). In short:

- **Loading speed matters (Poki).** Put source art in `assets-src/`, add it to the MANIFEST in
  `tools/optimize-images.py` (crop, max height, WebP quality) and run
  `python tools/optimize-images.py` — it writes WebPs to `public/assets/`. Never copy raw PNGs into
  `public/`. Load files in `BootScene.preload` with `` `${import.meta.env.BASE_URL}assets/<file>` ``
  and add a matching `<link rel="preload" as="image">` in `index.html`. Art not needed at the start
  (skins, lake scenery) loads on demand instead and gets no preload. Art that isn't used goes in the
  script's `UNUSED` list, so it never ships.
- **Duck skins** (shop) are sheets with the same layout as `duck-sheet.png` (2048×256, eight 256 cells,
  six poses, same eye alignment). To add one: a MANIFEST entry in `tools/optimize-images.py`
  (→ `public/assets/duck-<id>.webp`) and an entry in `CONFIG.skins` (id, name, file, price). Skins load
  on demand, so they don't need an `index.html` preload.
- Use transparent PNGs with real alpha. A strip on a white background can be converted with
  `python tools/process-duck-strip.py <strip.png> <out_dir>`.
- **Never put notes or docs in `public/`** — Vite copies the whole folder into the build.
- After swapping art, check `?debug`: hitboxes must still match the visible body.

## Art direction is the owner's call

- Don't change the active look — background layers, water/sky colours, palette, duck, UI style —
  unless the project owner asked for that change. Deliver new or alternative art as **unused**
  assets (sources in `assets-src/`, a note in `docs/assets/`, a row in `docs/ASSET_LOG.md`) and let
  the owner decide. The current scenery is clouds + distant rocks + palm islands over blue ocean; from 450 m each run
  drifts into a lake biome (pine islands, green mountains, teal water — `CONFIG.lake`).
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
| 3 Endless | log/crate/rock/crate stack, dash-smash, patterns + tiers, corn kernels, Duckling Parade, double jump, lily pads + frogs, lake biome | done |
| — Engagement | score bank + skins shop, best-distance flag, new-record party, watch-an-ad revive, tip cards | done |
| 4 Polish | logo image, music, duckling art, more skins (Codex), seagull obstacle (art exists) | in progress |
| 5 Publishing | Poki SDK, ad breaks, Game Events, version label, slim build, zip | done — approved on Poki |
