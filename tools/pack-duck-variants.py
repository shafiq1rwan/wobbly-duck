"""Pack generated transparent strips into the reference duck's eye-aligned cells.

Usage: python tools/pack-duck-variants.py <reference.png> <strip.png> <output.png>
Only trims transparent padding, scales uniformly, and aligns frames; no art is redrawn.
"""
import sys
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image


def components(mask):
    seen = np.zeros(mask.shape, dtype=bool)
    found = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        queue = deque([(int(y), int(x))])
        seen[y, x] = True
        pixels = []
        while queue:
            cy, cx = queue.popleft()
            pixels.append((cy, cx))
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        if len(pixels) >= 15:
            points = np.asarray(pixels)
            found.append((len(pixels), points))
    return found


def eye(image):
    a = np.asarray(image).astype(int)
    navy = (a[:, :, 0] < 55) & (a[:, :, 1] < 75) & (a[:, :, 2] > a[:, :, 0] + 15) & (a[:, :, 2] < 165) & (a[:, :, 3] > 180)
    candidates = []
    for count, points in components(navy):
        y, x = points.mean(axis=0)
        height, width = points.max(axis=0) - points.min(axis=0) + 1
        if 30 <= count <= 1200 and 0.65 < width / height < 1.45 and x > image.width * 0.5 and y < image.height * 0.65:
            candidates.append((count, (float(x), float(y))))
    assert candidates, 'No isolated eye found'
    return max(candidates)[1]


reference_path, strip_path, output_path = sys.argv[1:]
reference = Image.open(reference_path).convert('RGBA')
strip = Image.open(strip_path).convert('RGBA')
arr = np.asarray(strip).copy()
objects = sorted([points for count, points in components(arr[:, :, 3] > 64) if count > 3000], key=lambda p: p[:, 1].min())
assert len(objects) == 6, f'Expected 6 ducks, found {len(objects)}'
frames = []
ratios = []
for i, points in enumerate(objects):
    y0, x0 = points.min(axis=0)
    y1, x1 = points.max(axis=0) + 1
    box = (max(0, int(x0) - 3), max(0, int(y0) - 3), min(strip.width, int(x1) + 3), min(strip.height, int(y1) + 3))
    frame = strip.crop(box)
    clean = np.asarray(frame).copy()
    clean[clean[:, :, 3] <= 16] = 0
    frame = Image.fromarray(clean)
    ref = reference.crop((i * 256, 0, (i + 1) * 256, 256))
    ref_points = np.argwhere(np.asarray(ref)[:, :, 3] > 64)
    ref_width = ref_points[:, 1].max() - ref_points[:, 1].min() + 1
    ratios.append(ref_width / (x1 - x0))
    frames.append((frame, eye(frame), eye(ref)))
scale = float(np.median(ratios))
# Keep tiny crests or wider poses inside their cells, without changing per-frame scale.
for frame, source_eye, target_eye in frames:
    ex, ey = source_eye
    tx, ty = target_eye
    scale = min(scale, (tx - 2) / ex, (254 - tx) / (frame.width - ex),
                (ty - 2) / ey, (254 - ty) / (frame.height - ey))
sheet = Image.new('RGBA', (2048, 256))
for i, (frame, source_eye, target_eye) in enumerate(frames):
    width, height = round(frame.width * scale), round(frame.height * scale)
    resized = frame.convert('RGBa').resize((width, height), Image.Resampling.LANCZOS).convert('RGBA')
    ox = round(target_eye[0] - source_eye[0] * width / frame.width)
    oy = round(target_eye[1] - source_eye[1] * height / frame.height)
    assert ox >= 0 and oy >= 0 and ox + width <= 256 and oy + height <= 256, f'Frame {i} would clip'
    sheet.alpha_composite(resized, (i * 256 + ox, oy))
Path(output_path).parent.mkdir(parents=True, exist_ok=True)
sheet.save(output_path, optimize=True)
assert sheet.crop((1536, 0, 2048, 256)).getbbox() is None
print(f'{output_path}: {sheet.size}, 6 eye-aligned frames, alpha, 2 empty cells; scale={scale:.4f}')
