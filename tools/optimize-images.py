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
    # Food collectibles: preserve square canvas and centre pivot.
    ('food-collectibles-v1/corn.png', 'food-corn.webp', None, 96, 90),
    ('food-collectibles-v1/peas.png', 'food-peas.webp', None, 96, 90),
    ('food-collectibles-v1/seed.png', 'food-seed.webp', None, 96, 90),
    # Optional obstacle art with outlines matching each material's colour.
    ('obstacles-colour-outline-v2/log.png', 'obstacle-log-v2.webp', (233, 515), 64, 90),
    ('obstacles-colour-outline-v2/box.png', 'obstacle-box-v2.webp', (257, 1067), 160, 90),
    ('obstacles-colour-outline-v2/mid-air-loop.png', 'obstacle-loop-v2.webp', (118, 1116), 320, 90),
    # Parallax layers: crop to the opaque band (bottom row = art baseline).
    ('parallax-no-outline-v2/clouds.png', 'bg-clouds.webp', (485, 752), 300, 85),
    ('parallax-no-outline-v2/distant-rocks.png', 'bg-rocks.webp', (427, 662), 240, 85),
    ('parallax-no-outline-v2/palm-islands.png', 'bg-palms.webp', (303, 756), 400, 85),
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
