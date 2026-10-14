# Wobbly Duck parallax assets — duck style v1

Created using the built-in image generation tool. The existing duck-sheet.png was the primary style reference; background.png supplied only the tropical theme and palette.

Final assets: clouds.png, distant-rocks.png, palm-islands.png. Each PNG is 1536 × 1024 with genuine alpha transparency. No game source files or existing artwork were changed.

Project copies: C:\Users\shafiq.irwan\Documents\wobble-duck\public\assets\parallax-duck-style-v1

## Integration for Claude

Use a sky colour/gradient behind these layers and the existing procedural water in front. These are scenery, not obstacles. Load with BASE_URL-relative paths. Keep the duck's current sprite, controls and physics.

| Back to front | File | Source baseline Y (pixels) | Suggested world tile width | World baseline Y | Scroll factor |
| --- | --- | --- | --- | --- | --- |
| Clouds | clouds.png | 747 | 1900 | 435 | 0.025 |
| Distant rocks | distant-rocks.png | 657 | 1800 | 443 | 0.06 |
| Palm islands | palm-islands.png | 751 | 1280 | 459 | 0.12 |
| Duck | existing sprite | existing pivot | existing scale | existing physics | existing |
| Water | existing Water renderer | — | — | CONFIG.water.restY | existing |

Baselines above are measured from generated PNGs, not the requested prompt coordinates. Use them to avoid accidental vertical misalignment. Placement formula: scale = tileWorldWidth / 1536; layerTop = worldBaselineY - sourceBaselineY * scale. World tile height = 1024 * scale. All values are starting points for tuning.

Tile each layer horizontally across the current camera view with its own world-distance factor. Keep tile width consistent across desktop and mobile; let the existing camera determine the visible world area. Do not independently stretch width and height. Preserve each image's alpha; do not remove black-looking transparent pixels by colour key.

Horizontal edge alpha is 0 for rocks and islands, at most 1/255 for clouds. The silhouettes have empty edge spacing so repeats have transparent gaps rather than cut-off objects. Preview the moving tile joins at target scale before integration.

For Phaser TileSprite, remember tile offsets are in source pixels: tilePositionX = (view.left + totalWorldDistance * scrollFactor) / scale. Draw sky, clouds, rocks and islands behind gameplay; extend a solid ocean fill underneath water for tall screens. Avoid layering the old complete background over these new layers.

## Preview

Open preview.html in a browser. It includes the actual duck, animation, independent layer toggles and desktop/mobile framing. Preview uses illustrative water; it does not modify or run the game.

## Generation

Exact final prompts are recorded in prompts.json. All three layers explicitly use the duck's thick navy outlines, rounded proportions and simple cel shading. The earlier painterly drafts were discarded.

