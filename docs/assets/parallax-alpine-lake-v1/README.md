# Alpine lake environment v1

Unused alternative environment, generated on 2026-10-14 with the built-in image tool.
Style references: `assets-src/parallax-no-outline-v2/{clouds,distant-rocks,palm-islands}.png`.

The tropical islands become pine-covered grassy islets; distant rocks become rounded
snow-capped blue mountains. The original rounded forms, colour-defined edges, simple
cel shading and outline-free scenery treatment carry through the set.

## Deliverables

Sources: `assets-src/parallax-alpine-lake-v1/`. All three are 1536 x 1024 RGBA PNGs.

| File | Role | Suggested scroll factor | Visible solid baseline Y |
| --- | --- | --- | --- |
| clouds.png | Far white/icy-blue cloud clusters | 0.025 | 728 |
| distant-mountains.png | Pastel blue mountain clusters with snow caps | 0.06 | 660 |
| pine-islands.png | Near green islands with rounded evergreens and shoreline stones | 0.12 | 758 |

Open [preview.html](preview.html) locally for desktop and portrait composition studies
with independent layer toggles. Sky and water in that preview are illustrative CSS,
not replacement game assets. Exact prompts are in [prompts.json](prompts.json).

## Integration notes

These are separate transparent layers, not a seamless painted background. Repeat with
spacing and preserve aspect ratio. Place island shores just behind the procedural water,
with mountains further away and clouds behind both. Keep background contrast lower than
the duck, food and obstacles.

The generated files retain soft translucent colour fringes outside the main silhouettes,
similar to the reference PNGs, despite requests for crisp contours. Solid-content bounds
use alpha >= 240; do not use the full alpha bounding box to derive the shoreline.
The pine layer has a barely visible alpha value of 1 on its left edge. These are art
alternatives for review; check fringes on the intended sky before runtime optimisation.

No runtime manifest, preloads, game code or active palette were changed. When integrating,
add appropriately cropped/resized WebPs through `tools/optimize-images.py`, then verify
desktop/portrait gameplay and debug colliders. Typecheck and production build pass.
