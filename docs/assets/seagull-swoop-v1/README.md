# Swooping seagull v1

Unused obstacle art generated on 2026-10-14 using the built-in image tool.
Style reference: `assets-src/duck-sheet.png`. Exact prompt: [prompt.txt](prompt.txt).

Source: `assets-src/seagull-swoop-v1/seagull.png`.

One left-facing seagull in a swooping flight pose, with a rounded ivory body,
blue-grey wings, orange beak and thick navy outline matching the duck.
The PNG has genuine alpha transparency. This is a single pose, not an animation sheet.

The water shadow and preceding `!` warning should be independent effects so they can
appear before the bird and move separately. Neither is baked into the bird sprite.

No game integration, hitbox or gameplay tuning is included. Keep collision bounds
separate from wing visuals; choose gameplay size and a fixed body collider during
integration. Export a suitably sized WebP through `tools/optimize-images.py` when
approved for use, then check small-screen readability and debug collisions.
