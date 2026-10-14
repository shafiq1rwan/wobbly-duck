# Wobbly Duck parallax — no outlines v2

The navy outer contours, internal dividing strokes and baseline strokes were removed from all three scenery layers using the built-in image generation tool. Rounded cartoon shapes, colours and simple cel shading are retained. The duck itself was not edited.

Project assets: C:\Users\shafiq.irwan\Documents\wobble-duck\public\assets\parallax-no-outline-v2
Each PNG is 1536 × 1024 with genuine alpha transparency. Both horizontal edge columns and corners are fully transparent. The outlined v1 files remain available; no game source code was changed.

## Placement for Claude

Draw sky, clouds, distant rocks, palm islands, duck and existing procedural water in that order. These are scenery, not obstacles.

| File | Source baseline Y | Suggested world tile width | World baseline Y | Scroll factor |
| --- | --- | --- | --- | --- |
| clouds.png | 744 | 1900 | 435 | 0.025 |
| distant-rocks.png | 655 | 1800 | 443 | 0.06 |
| palm-islands.png | 749 | 1280 | 459 | 0.12 |

Source baselines are measured from the edited images; use these instead of v1 values. Scale = tileWorldWidth / 1536. Layer top = worldBaselineY - sourceBaselineY × scale. Keep aspect ratio and alpha. Horizontally repeat each layer with its own scroll factor across the current camera view.

For Phaser TileSprite, offsets are source pixels: tilePositionX = (view.left + totalWorldDistance × scrollFactor) / scale. Use BASE_URL-relative load paths. Keep the existing water renderer and ocean fill for tall screens.

## Preview and prompts

Open preview.html for animated desktop/mobile previews with the original duck and layer toggles. Water is illustrative. Exact edit prompts are in prompts.json.

