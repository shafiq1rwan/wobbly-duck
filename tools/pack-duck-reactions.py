"""Pack generated four-frame reaction strips at the original duck's scale.

Usage: python tools/pack-duck-reactions.py <land-strip.png> <hurt-strip.png>
Trims padding and applies one shared scale, preserving squash/recoil differences.
"""
from pathlib import Path
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets-src/duck-reactions-v1'
PREVIEWS = ROOT / 'docs/assets/duck-reactions-v1'


def split(path):
    image = Image.open(path).convert('RGBA')
    a = np.asarray(image)
    mask = a[:, :, 3] > 64
    occupied = mask.sum(axis=0) > 10
    edges = np.diff(np.r_[False, occupied, False].astype(int))
    spans = [(x0, x1) for x0, x1 in zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)) if x1 - x0 > 100]
    assert len(spans) == 4, f'Expected four separate frames, found {spans}'
    frames = []
    for x0, x1 in spans:
        ys, xs = np.nonzero(mask[:, x0:x1])
        x0 = int(x0)
        box = (max(0, x0 + int(xs.min()) - 3), max(0, int(ys.min()) - 3), min(image.width, x0 + int(xs.max()) + 4), min(image.height, int(ys.max()) + 4))
        crop = image.crop(box)
        clean = np.asarray(crop).copy()
        clean[clean[:, :, 3] <= 16] = 0
        frames.append(Image.fromarray(clean))
    return frames


OUT.mkdir(parents=True, exist_ok=True)
PREVIEWS.mkdir(parents=True, exist_ok=True)
reference = Image.open(ROOT / 'assets-src/duck-sheet.png').convert('RGBA').crop((0, 0, 256, 256))
ref_box = reference.getbbox()
land, hurt = [split(path) for path in sys.argv[1:]]
# Shared scale from the settled Land pose; never normalize individual poses.
scale = (ref_box[2] - ref_box[0]) / (land[-1].width - 6)
scale = min(scale, 244 / max(frame.width for frame in land + hurt), 236 / max(frame.height for frame in land + hurt))
centre_x = (ref_box[0] + ref_box[2]) / 2
baseline = ref_box[3]
for name, frames, duration in [('land', land, 100), ('hurt', hurt, 80)]:
    sheet = Image.new('RGBA', (1024, 256))
    preview_frames = []
    for i, frame in enumerate(frames):
        size = (round(frame.width * scale), round(frame.height * scale))
        resized = frame.convert('RGBa').resize(size, Image.Resampling.LANCZOS).convert('RGBA')
        ox = round(centre_x - size[0] / 2)
        oy = round(baseline - size[1])
        assert 0 <= ox and ox + size[0] <= 256 and 0 <= oy and oy + size[1] <= 256, 'Clipped frame'
        sheet.alpha_composite(resized, (i * 256 + ox, oy))
        preview = Image.new('RGBA', (256, 256), '#8ED8FF')
        preview.alpha_composite(resized, (ox, oy))
        preview_frames.append(preview.convert('RGB'))
    sheet.save(OUT / f'duck-{name}-sheet.png', optimize=True)
    preview_frames[0].save(PREVIEWS / f'{name}-preview.gif', save_all=True, append_images=preview_frames[1:], duration=[duration] * 3 + [500], loop=0)
    print(f'{name}: 1024x256, 4 frames, shared scale={scale:.4f}, baseline={baseline}, pivot=(131,146)')
