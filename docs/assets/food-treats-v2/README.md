# Treat collectibles v2

Created 2026-10-14 with the built-in image generation tool. User requested a playful collectible-art direction inspired by Cookie Run: Kingdom, in Wobbly Duck's own style, plus pickup effects. Original food icons served as the only image references; no other game's assets were used.

## Assets

Sources: `assets-src/food-treats-v2/{corn,peas,bonus-corn}.png`.
Runtime: `public/assets/food-{corn,peas,bonus-corn}-v2.webp`, transparent 96×96, centre pivot (48,48).
In use through `CONFIG.food.kinds`, including matching page preloads and corn HUD/menu icons. Original v1 files retained.

- Corn puff: 1 point, scale 0.5.
- Sweet pea pearls: 1 point, scale 0.5.
- Golden corn bundle: 5 points, scale 0.78, distinct three-kernel silhouette.

This set uses the user-requested matching-colour outlines and restrained pale flat highlights. Intentional art direction exception to the default no-highlight asset rule.

## Effects

Existing bob now includes a gentle squash/stretch pulse. On pickup, collision deactivates immediately and the same pooled image expands, rises and fades over 0.26 seconds. Coloured sparkles and a small expanding ring use the existing particle pool. The bonus has more sparkles and a larger ring. Existing sounds, scoring and spawn patterns retained. All new tuning is in `CONFIG.food`. No per-pickup sprites, tweens or timers are allocated.

Checks: `node tools/verify-food-pickups.cjs` covers single scoring, all values, crate-top collection, effect expiry, reset and reuse; ring expansion, world scrolling, expiry and reset. Browser-based desktop/mobile play testing was unavailable in this session and still needs visual confirmation.

## Corn prompt

Use case: stylized-concept. Create ONE original collectible icon for Wobbly Duck, a cheerful 2D river runner. Art direction: playful plump treat-like food, rounded chunky silhouette, a restrained pale highlight and one darker lower-right shade, thick smooth outline in a darker shade of the food's own colour. Match the supplied food reference's simple cartoon construction and outline treatment, but make it feel softer, juicier and more rewarding. Our original design; no branding or recognizable assets from other games. Transparent square 1024x1024 PNG with true alpha, object centered occupying roughly 75% canvas, safe padding, readable at 40 pixels. No realistic texture, no 3D, no glow baked outside sprite, no floating sparkles, text, borders, shadow or checkerboard. No face or eyes. Only one compact icon.Subject: one sweetcorn PUFF, a pillowy golden corn kernel with a broad rounded triangular top and small ivory tip, pleasantly inflated soft silhouette. Bright buttery yellow base, golden shade, warm golden-brown outline. One small rounded cream reflection patch at upper-left, simple and flat, not a glossy rendered surface. Keep it clearly identifiable as a corn kernel, not a candy-corn triangle. Cute collectible snack shape.

## Peas prompt

Use case: stylized-concept. Create ONE original collectible icon for Wobbly Duck, a cheerful 2D river runner. Art direction: playful plump treat-like food, rounded chunky silhouette, a restrained pale highlight and one darker lower-right shade, thick smooth outline in a darker shade of the food's own colour. Match the supplied food reference's simple cartoon construction and outline treatment, but make it feel softer, juicier and more rewarding. Our original design; no branding or recognizable assets from other games. Transparent square 1024x1024 PNG with true alpha, object centered occupying roughly 75% canvas, safe padding, readable at 40 pixels. No realistic texture, no 3D, no glow baked outside sprite, no floating sparkles, text, borders, shadow or checkerboard. No face or eyes. Only one compact icon.Subject: THREE plump sweet green PEA PEARLS nestled in a compact triangular cluster, one at top and two at bottom, slightly overlapping. Bright fresh green base, deeper green lower-right crescent shade, dark leaf-green outlines. Each pea has ONE small pale mint rounded reflection patch at upper left. Puffed soft edible treat, simple round forms. No leaves, stems, pod, face or eyes. Same simple icon silhouette as reference.

## Bonus prompt

Use case: stylized-concept. Create ONE original collectible icon for Wobbly Duck, a cheerful 2D river runner. Art direction: playful plump treat-like food, rounded chunky silhouette, a restrained pale highlight and one darker lower-right shade, thick smooth outline in a darker shade of the food's own colour. Match the supplied food reference's simple cartoon construction and outline treatment, but make it feel softer, juicier and more rewarding. Our original design; no branding or recognizable assets from other games. Transparent square 1024x1024 PNG with true alpha, object centered occupying roughly 75% canvas, safe padding, readable at 40 pixels. No realistic texture, no 3D, no glow baked outside sprite, no floating sparkles, text, borders, shadow or checkerboard. No face or eyes. Only one compact icon.Subject: GOLDEN CORN BUNDLE bonus collectible. Exactly THREE plump golden corn kernels nestled in a compact triangular cluster, one above and two below, their pale ivory tips visible. Same rounded inflated corn-kernel shapes as reference, buttery yellow fills, amber lower-right shades and warm golden-brown outlines. Each has one small cream highlight upper-left. This is a special version of the single corn pickup, visually distinguished by three kernels and a fuller silhouette. No ribbon, crown, badge, stars or extra surrounding objects.

