# Rock obstacle

Generated on 2026-10-14 with the built-in image generation tool. Style reference: matching-colour crate, `assets-src/obstacles-colour-outline-v2/box.png`. Grey-blue rounded boulder with darker slate outlines, matching the user's obstacle-outline preference.

Source: `assets-src/obstacles-colour-outline-v2/rock.png`.
Runtime export: `public/assets/obstacle-rock-v2.webp`, 256×192, real alpha.
Intended pivot/waterline: (128,136), normalized origin (0.5,0.708333). Suggested scale 0.5. No water is painted in; the game water overlay should cover the lower portion. Optional asset, not spawned in gameplay yet. Validate collision bounds against the visible body when integrating.

## Prompt

Use case: stylized-concept. Create ONE rock obstacle sprite for Wobbly Duck, matching the supplied wooden crate reference's simple rounded cartoon shapes, thick smooth outline and restrained flat shading. Reference is art style only; do not include wood or a crate. Transparent PNG with true alpha, landscape 4:3 canvas, ideally 1024x768 (downscaled to 256x192 for game). Single broad squat river boulder, front/side view for a side-scrolling 2D game, gently asymmetrical rounded top and shoulders, broad stable slightly flattened base, clearly solid and heavy, no spikes. Centre the rock horizontally at x512. Visible bounds approximately x72..952 and y72..736. Imaginary waterline at y544 (70.83% of canvas height), with substantial rock above it and a smaller rounded lower part below; DO NOT DRAW the waterline or any water. Base slate grey-blue #7389A6, one darker grey-blue #5A6F89 flat shade along lower-right face, one simple subtle upper-left facet. OUTLINE dark slate grey-blue #485C73, related to the rock's own colour, not navy, black or brown. Same thick rounded contour as the matching-colour obstacle set, around 3% of rock width. Two restrained curved facet lines at most, matching slate outline colour, no fine cracks, texture or moss. Clean flat 2D cartoon, not glossy or realistic, no gradients, grain, 3D or drop shadow. No ducks, water, foam, plants, extra rocks, text, labels, borders, background or checkerboard. Entire rock visible with safe transparent edge padding.

