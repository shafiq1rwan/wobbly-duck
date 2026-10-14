"""Build the game's runtime images from the high-res sources in assets-src/.

Usage:  python tools/optimize-images.py          (run from the repo root)
Needs:  pip install pillow

Each entry crops away empty rows, caps the height at what the game can actually display
(world height x max render zoom 2), and writes a WebP into public/assets/. Sources stay in
assets-src/ (versioned, never shipped). Add new runtime images to MANIFEST rather than copying
PNGs into public/.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src')
OUT = os.path.join(ROOT, 'public', 'assets')

# source, output, crop rows (top, bottom) or None, max height in px or None, WebP quality
MANIFEST = [
    ('duck-sheet.png', 'duck-sheet.webp', None, None, 90),
    # Duck skins for the shop (same 2048x256 layout as the duck sheet), from Codex's variants.
    ('duck-variants-v1/pekin-sheet.png', 'duck-pekin.webp', None, None, 90),
    ('duck-variants-v1/khaki-sheet.png', 'duck-khaki.webp', None, None, 90),
    ('duck-variants-v1/mallard-sheet.png', 'duck-mallard.webp', None, None, 90),
    ('duck-variants-v2/tufted-sheet.png', 'duck-tufted.webp', None, None, 90),
    ('duck-variants-v2/wigeon-sheet.png', 'duck-wigeon.webp', None, None, 90),
    ('duck-variants-v2/mandarin-sheet.png', 'duck-mandarin.webp', None, None, 90),
    # Four-frame reaction sheets: preserve 256x256 cells.
    ('duck-reactions-v1/duck-land-sheet.png', 'duck-land-sheet.webp', None, None, 90),
    ('duck-reactions-v1/duck-hurt-sheet.png', 'duck-hurt-sheet.webp', None, None, 90),
    # Food collectibles: preserve square canvas and centre pivot.
    ('food-collectibles-v1/corn.png', 'food-corn.webp', None, 96, 90),
    ('food-collectibles-v1/peas.png', 'food-peas.webp', None, 96, 90),
    ('food-collectibles-v1/seed.png', 'food-seed.webp', None, 96, 90),
    ('food-treats-v2/corn.png', 'food-corn-v2.webp', None, 96, 90),
    ('food-treats-v2/peas.png', 'food-peas-v2.webp', None, 96, 90),
    ('food-treats-v2/bonus-corn.png', 'food-bonus-corn-v2.webp', None, 96, 90),
    # Obstacles v3 (in use for log and crate): chubby log, flat front-on crate. Already packed by Codex.
    ('obstacles-duck-style-v3/log.png', 'obstacle-log-v3.webp', None, None, 90),
    ('obstacles-duck-style-v3/box.png', 'obstacle-box-v3.webp', None, None, 90),
    # Optional obstacle art with outlines matching each material's colour.
    ('obstacles-colour-outline-v2/log.png', 'obstacle-log-v2.webp', (233, 515), 64, 90),
    ('obstacles-colour-outline-v2/box.png', 'obstacle-box-v2.webp', (257, 1067), 160, 90),
    ('obstacles-colour-outline-v2/rock.png', 'obstacle-rock-v2.webp', None, 192, 90),
    ('obstacles-colour-outline-v2/mid-air-loop.png', 'obstacle-loop-v2.webp', (118, 1116), 320, 90),
    # Corn-kernel collectibles (split by tools/split-kernel-sheet.py): square, body centred.
    ('kernels-v1/yellow.png', 'kernel-yellow.webp', None, 160, 90),
    ('kernels-v1/orange.png', 'kernel-orange.webp', None, 160, 90),
    ('kernels-v1/honey.png', 'kernel-honey.webp', None, 160, 90),
    ('kernels-v1/pink.png', 'kernel-pink.webp', None, 160, 90),
    ('kernels-v1/purple.png', 'kernel-purple.webp', None, 160, 90),
    ('kernels-v1/ice.png', 'kernel-ice.webp', None, 160, 90),
    ('kernels-v1/rainbow.png', 'kernel-rainbow.webp', None, 160, 90),
    ('kernels-v1/crown.png', 'kernel-crown.webp', None, 160, 90),
    # Lily pads (4 variants, bottom-aligned 256x160 cells) and the frog hop (6 frames, 192x192),
    # packed from the owner's strips by tools/pack-strip.py.
    ('lilypad-v1/lily-pads.png', 'lily-pads.webp', None, None, 90),
    ('frog-v1/frog-hop.png', 'frog-hop.webp', None, None, 90),
    # Parallax layers: crop to the opaque band (bottom row = art baseline).
    ('parallax-no-outline-v2/clouds.png', 'bg-clouds.webp', (485, 752), 300, 85),
    ('parallax-no-outline-v2/distant-rocks.png', 'bg-rocks.webp', (427, 662), 240, 85),
    ('parallax-no-outline-v2/palm-islands.png', 'bg-palms.webp', (303, 756), 400, 85),
    ('river-background-v1/willow-banks.png', 'bg-river-willows.webp', (470, 748), 320, 85),
    ('river-background-v1/reed-banks.png', 'bg-river-reeds.webp', (322, 689), 160, 85),
]


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    total_in = total_out = 0
    for src, out, crop, max_h, quality in MANIFEST:
        src_path = os.path.join(SRC, src)
        out_path = os.path.join(OUT, out)
        im = Image.open(src_path).convert('RGBA')
        if crop:
            im = im.crop((0, crop[0], im.width, crop[1]))
        if max_h and im.height > max_h:
            im = im.resize((round(im.width * max_h / im.height), max_h), Image.LANCZOS)
        im.save(out_path, 'WEBP', quality=quality, alpha_quality=100, method=6)
        a, b = os.path.getsize(src_path), os.path.getsize(out_path)
        total_in += a
        total_out += b
        print(f'{out:20s} {im.width}x{im.height}  {a // 1024:5d} KB -> {b // 1024:4d} KB')
    print(f'{"total":20s} {total_in // 1024:16d} KB -> {total_out // 1024:4d} KB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
