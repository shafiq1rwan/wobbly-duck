"""Pack a transparent sprite strip (frames side by side, separated by empty columns) into a
spritesheet of equal cells, each frame scaled uniformly and aligned the same way.

Usage:
  python tools/pack-strip.py <in.png> <out.png> --cell 192x192 --source-cell 420x420 [--align center|bottom]

  --source-cell  size (in source pixels) of the box every frame is centred in before scaling;
                 must fit the largest frame. The scale is cell / source-cell for all frames.
  --align        center: bounding-box centre on the cell centre (animations moved in code).
                 bottom: bounding-box bottom centre at the cell's bottom (things resting on water).
Needs: pip install pillow numpy
"""
import argparse

import numpy as np
from PIL import Image


def runs(mask_1d, min_len=6):
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--cell', required=True)
    ap.add_argument('--source-cell', required=True)
    ap.add_argument('--align', choices=['center', 'bottom'], default='center')
    args = ap.parse_args()
    cw, ch = map(int, args.cell.split('x'))
    sw, sh = map(int, args.source_cell.split('x'))

    im = Image.open(args.src).convert('RGBA')
    alpha = np.asarray(im)[:, :, 3] > 30
    frames = runs(alpha.any(axis=0))
    sheet = Image.new('RGBA', (cw * len(frames), ch), (0, 0, 0, 0))
    for i, (x0, x1) in enumerate(frames):
        rows = np.nonzero(alpha[:, x0:x1].any(axis=1))[0]
        y0, y1 = rows.min(), rows.max() + 1
        fw, fh = x1 - x0, y1 - y0
        assert fw <= sw and fh <= sh, f'frame {i} ({fw}x{fh}) larger than --source-cell'
        box = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
        px = (sw - fw) // 2
        py = (sh - fh) // 2 if args.align == 'center' else sh - fh - 2
        box.paste(im.crop((x0, y0, x1, y1)), (px, py))
        cell = box.convert('RGBa').resize((cw, ch), Image.LANCZOS).convert('RGBA')
        sheet.paste(cell, (i * cw, 0))
        print(f'frame {i}: {fw}x{fh}')
    sheet.save(args.dst, optimize=True)
    print(f'{len(frames)} frames -> {args.dst} ({sheet.width}x{sheet.height}), scale {cw / sw:.3f}')


if __name__ == '__main__':
    main()
