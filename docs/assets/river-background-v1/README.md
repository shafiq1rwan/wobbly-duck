# Calm river background v1

Generated 2026-10-14 with the built-in image generation tool. New outline-free pastel freshwater scenery: willow-lined grassy banks and low cattail/reed patches. Sources in `assets-src/river-background-v1/`; optimized WebPs in `public/assets/`.

## Active layers

- Existing clouds retained: `bg-clouds.webp`, height 150 world units, parallax 0.025.
- `bg-river-willows.webp`: 1536×278, source rows 470..747, height 160, gap 180, sink 6, parallax 0.045.
- `bg-river-reeds.webp`: 670×160, source rows 322..688, height 75, gap 260, sink 8, parallax 0.09.

Configured in `src/config.ts`, loaded automatically by `BootScene`, with matching page preloads. Old palms/rocks preserved but no longer active. Existing repeating-layer renderer retained; objects have transparent horizontal margins and separated clusters, avoiding cut-off objects at image joins. Willow edge alpha max=1/255, reeds edge alpha=0; the faint willow alpha is visually negligible.

Sky now fades from soft blue #81CDEB to pale #DAF0DC; animated water uses turquoise #46C4BD with #2BB4B0 depth shading, pale green-blue surface tint and soft foam. Background stays muted for obstacle visibility. No water is baked into the art, so the existing renderer extends it on portrait screens.

## Visual checks

`willows-alpha-check.png` and `reeds-alpha-check.png` composite the final exports over the actual horizon colour to verify the transparent cutouts. The image viewer showed the RGB data in fully transparent pixels as a glow; the matte previews confirm the actual alpha has no visible halo. Browser-based desktop/portrait testing was unavailable in this session and still needs play testing. Collision and gameplay tuning were not changed.

## Willow original prompt

Use case: stylized-concept. Asset type: transparent parallax background layer for Wobbly Duck, a flat 2D cartoon side-scrolling river runner. Calm pastel rounded shapes, simple solid colour fills with at most one restrained shade, NO outlines, no realistic textures, no gradients, no 3D, no glossy highlights, no shadows. Low contrast scenery, clearly less saturated than bright yellow duck and brown obstacles. True alpha transparency everywhere outside the scenery; NO sky or water painted in. Wide landscape canvas ideally 1536x1024. Art in a narrow horizontal strip across the lower-middle of the canvas, with all objects rooted on EXACTLY ONE straight horizontal baseline at y760. Everything below that baseline transparent. Leave generous empty transparent top area and at least 100px fully transparent padding on BOTH left/right edges, no object touches any image edge. Do not crop objects. No text, borders, game characters, food or dangerous-looking foreground obstacles. Not a full illustration, just background scenery. Layer: DISTANT WILLOW RIVERBANKS. Three separated low grassy bank clusters spread across the strip, each with gentle rounded shoreline, two or three small deciduous willow trees. Soft drooping rounded umbrella canopies, simplified curved hanging foliage masses, muted sage green #97BEA3 and blue-green #86ADA0 leaves, small warm grey-brown trunks, pale soft green #AECBB1 grassy banks. One cluster slightly larger with one taller willow at centre-right, other clusters lower. Maximum tree height about 300px, bank thickness only 25px. Silhouette reads as a friendly quiet freshwater river, not tropical ocean. No palm trees, mountains, buildings, bridge, flowers, individual leaves or water reflections. Separate clusters with transparent gaps of about 80px. Keep trees small and calm.

## Selected willow cleanup prompt

Edit this background layer. Remove ALL diffuse haze, glow, blur, shadow, fog and semi-transparent halos around the three tree-and-bank clusters. Everything outside the actual crisp silhouettes of the trees, trunks, bushes and land MUST have alpha=0, including all left/right edge columns and all areas above and below the art. The tree and bank interior fills should be solid opaque flat pastel colours. Keep the three clusters' shapes, positions, baseline and palette. Crisp flat 2D cartoon cutouts, clean anti-aliased edges only, no mist of any kind. No outlines. Preserve fully transparent gaps between clusters; each island is separate. Same canvas. Do not add background, lighting effects or any other objects.

## Reeds prompt

Use case: stylized-concept. Transparent parallax sprite asset for a friendly flat 2D river game. Three separate little grassy shoreline patches in one wide horizontal row, on exactly one flat baseline at y750 on1536x1024 canvas. Each low pale sage-green grassy mound has a few broad rounded reeds and two or three soft cattail stems with muted tan-brown rounded tops, tiny rounded bushes. Left patch medium, middle patch small, right patch slightly larger. Maximum plant height180px, mound thickness20px. All patches fully visible and isolated, at least100px transparent padding on left/right edges and transparent gaps between patches. NO sky, water, reflections, glow, fog, haze, outlines, shadows, buildings, ducks, text or details. Real alpha=0 everywhere outside plants/land. Opaque pastel green and muted brown flat fills, clean antialiased edges. Simple rounded cartoon vector-like shapes, calm low contrast. A small environmental background layer, not foreground obstacles, no bright saturated colours or large rocks. All roots/base bottom edges align to the same horizontal row; lower canvas is empty transparent.

