"""Pack six generated 3x2 flight poses into equal eye-aligned cells.

Only crops, uniformly scales and translates the generated art; no pixels are redrawn.
Usage: python tools/pack-seagull-flight.py input.png output.png
"""
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def eye_anchor(frame):
    a = np.asarray(frame)
    mask = (a[:, :, 0] < 45) & (a[:, :, 1] < 65) & (a[:, :, 2] < 120) & (a[:, :, 3] > 200)
    seen = np.zeros(mask.shape, bool)
    candidates = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        queue = deque([(int(y), int(x))])
        seen[y, x] = True
        points = []
        while queue:
            cy, cx = queue.popleft()
            points.append((cy, cx))
            for ny, nx in ((cy-1, cx), (cy+1, cx), (cy, cx-1), (cy, cx+1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        p = np.asarray(points)
        ey, ex = p.mean(axis=0)
        h, w = p.max(axis=0) - p.min(axis=0) + 1
        if 40 <= len(p) <= 2400 and w < frame.width*.14 and h < frame.height*.18 and frame.width*.12 < ex < frame.width*.4 and frame.height*.35 < ey < frame.height*.8:
            candidates.append((len(p), (float(ex), float(ey))))
    assert candidates, 'Could not find isolated eye; inspect source before packing'
    return max(candidates)[1]


source = Image.open(sys.argv[1]).convert('RGBA')
assert source.width % 3 == 0 and source.height % 2 == 0
sw, sh = source.width // 3, source.height // 2
frames = []
for i in range(6):
    cell = source.crop(((i % 3)*sw, (i // 3)*sh, (i % 3+1)*sw, (i // 3+1)*sh))
    frames.append((cell, eye_anchor(cell)))
target = (62, 145)
scale = min(0.46*512/sw, 0.46*512/sh)
for cell, (ex, ey) in frames:
    bounds = cell.getchannel('A').getbbox()
    x0, y0, x1, y1 = bounds
    for extent, available in ((ex-x0, target[0]-3), (x1-ex, 253-target[0]), (ey-y0, target[1]-3), (y1-ey, 253-target[1])):
        if extent > 0:
            scale = min(scale, available/extent)
sheet = Image.new('RGBA', (1536, 256))
for i, (cell, (ex, ey)) in enumerate(frames):
    x0, y0, x1, y1 = cell.getchannel('A').getbbox()
    crop = cell.crop((x0, y0, x1, y1))
    width, height = round(crop.width*scale), round(crop.height*scale)
    resized = crop.convert('RGBa').resize((width, height), Image.Resampling.LANCZOS).convert('RGBA')
    ox = round(target[0]-(ex-x0)*width/crop.width)
    oy = round(target[1]-(ey-y0)*height/crop.height)
    assert ox >= 0 and oy >= 0 and ox+width <= 256 and oy+height <= 256, f'Frame {i} clips'
    sheet.alpha_composite(resized, (i*256+ox, oy))
    print(f'Frame {i}: source eye ({ex:.1f}, {ey:.1f}), output eye {target}')
out = Path(sys.argv[2])
out.parent.mkdir(parents=True, exist_ok=True)
sheet.save(out, optimize=True)
metadata = {'file': out.name, 'width': 1536, 'height': 256, 'frameWidth': 256, 'frameHeight': 256, 'frames': 6, 'frameRate': 10, 'repeat': -1, 'eyeAnchor': list(target), 'facing': 'left', 'scale': scale}
out.with_suffix('.json').write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
print(f'Saved {out}, uniform scale {scale:.4f}')
