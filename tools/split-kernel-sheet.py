"""Split the corn-kernel collectibles sheet into one centred PNG per kernel.

Usage:  python tools/split-kernel-sheet.py          (run from the repo root)
Needs:  pip install pillow numpy

Input:  assets-src/corn-collectibles.png — transparent, 4 columns x 2 rows, in the order of NAMES.
Output: assets-src/kernels-v1/<name>.png — 320x320 each, every kernel at the same scale, with its
        body (largest connected shape) centred so arcs of mixed kernels line up. Decorations
        (sparkles, snowflakes, crown) are kept. Then run tools/optimize-images.py.
"""
import os
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'corn-collectibles.png')
OUT = os.path.join(ROOT, 'assets-src', 'kernels-v1')
NAMES = ['yellow', 'orange', 'honey', 'pink', 'purple', 'ice', 'rainbow', 'crown']
CANVAS = 320
BODY_HEIGHT = 156  # target body height in the 320 canvas (≈ 78 px after the 160 px export)


def runs(mask_1d, min_len=8):
    out, start = [], None
    for i, v in enumerate(mask_1d):
        if v and start is None:
            start = i
        if not v and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(mask_1d)))
    return [r for r in out if r[1] - r[0] >= min_len]


def largest_component(mask):
    seen = np.zeros_like(mask)
    best = None
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        pts = []
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if best is None or len(pts) > len(best):
            best = pts
    return np.array(best)


def main():
    im = Image.open(SRC).convert('RGBA')
    alpha = np.asarray(im)[:, :, 3] > 40
    cols, rows = runs(alpha.any(axis=0)), runs(alpha.any(axis=1))
    assert len(cols) == 4 and len(rows) == 2, (cols, rows)

    cells = []
    for r in rows:
        for c in cols:
            sub = alpha[r[0]:r[1], c[0]:c[1]]
            body = largest_component(sub)
            # Body height without decorations: use rows of the body only (crown is attached, so
            # take the lower 85% of the shape's height as a robust "kernel" measure).
            h = body[:, 0].max() - body[:, 0].min() + 1
            c_y = body[:, 0].min() + h * 0.55 + r[0]
            cx = (body[:, 1].min() + body[:, 1].max()) / 2 + c[0]
            cells.append((cx, c_y, h, (c[0], r[0], c[1], r[1])))
    scale = BODY_HEIGHT / float(np.median([cell[2] for cell in cells]))
    os.makedirs(OUT, exist_ok=True)
    for name, (cx, cy, _, bounds) in zip(NAMES, cells):
        # Keep only this kernel's grid cell, so neighbours never bleed into the tile.
        isolated = Image.new('RGBA', im.size, (0, 0, 0, 0))
        isolated.paste(im.crop(bounds), bounds[:2])
        half = CANVAS / 2 / scale
        box = (round(cx - half), round(cy - half), round(cx + half), round(cy + half))
        tile = isolated.crop(box).convert('RGBa').resize((CANVAS, CANVAS), Image.LANCZOS).convert('RGBA')
        tile.save(os.path.join(OUT, f'{name}.png'), optimize=True)
        print(f'{name:8s} -> assets-src/kernels-v1/{name}.png')


if __name__ == '__main__':
    main()
