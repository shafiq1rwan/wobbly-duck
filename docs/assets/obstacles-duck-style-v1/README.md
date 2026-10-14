# Wobbly Duck obstacle assets — duck style v1

Generated with the built-in image generation tool, using the existing public/assets/duck-sheet.png as the primary art style reference. Each sprite uses navy outlines, rounded shapes, warm colours and simple shading.

- log.png: horizontal wooden log with a pale cut end.
- mid-air-loop.png: upright golden hoop. The centre is fully transparent so the duck can jump through.
- box.png: closed wooden crate with an X brace.

Project copies: C:\Users\shafiq.irwan\Documents\wobble-duck\public\assets\obstacles-duck-style-v1
No game source or existing art was modified.

## Measured texture bounds

PNG dimensions include transparent padding. These bounds use pixels with alpha >=16. All horizontal edges and corners checked are fully transparent.

| Sprite | PNG dimensions | Visible rectangle x,y,width,height |
| --- | --- | --- |
| Log | 2172 × 724 | 420,240,1333,269 |
| Loop | 1254 × 1254 | 273,123,710,987 |
| Box | 1254 × 1254 | 182,263,891,799 |

Use a Phaser texture frame with these source rectangles, or account for transparent padding explicitly. Preserve aspect ratio when scaling. The tool chose these actual output dimensions; do not assume the prompt's requested size.

Suggested initial visible world sizes: log 124 × 25; box width 78, proportional height about 70; hoop height 160, proportional width about 115. These are tuning starting points, not physics requirements. The generated log is slimmer than the current procedural 124 × 36 log, so Claude should adjust its collision box to match the new visible art.

Keep floating log/box collision shapes slightly inset for forgiving gameplay. Place their lower portion beneath the existing water overlay; no water effects are baked into the assets. Align their centres using their framed sprite, not the full padded PNG.

The loop is a pass-through hoop: its hole is NOT a solid rectangular collision region. If used as a hazard, collide against the rim with an oval/annular test; if used as a bonus gate, trigger a reward once when the duck crosses through its opening. Do not make the transparent centre lethal.

The current implementation only spawns logs; Claude still needs to wire in the new PNGs and any new box/loop behaviours.

Exact generation prompts are in prompts.json; machine-readable source bounds and transparency checks are in asset-metadata.json.

