"""Turn a white-background duck strip into a transparent, eye-aligned spritesheet.

Usage:  python tools/process-duck-strip.py <strip.png> <out_dir>
Needs:  pip install pillow numpy

Frames are detected as columns separated by white space. The background is removed by flood
fill from the image border (so pale belly colours inside the outline are kept), and every frame
is aligned on the duck's eye. Output: <out_dir>/duck-sheet.png (256x256 cells, 2048 px wide)
plus meta.json and preview.png. Copy duck-sheet.png to public/assets/ and update the pivot and
frame list in src/art/duckSprite.ts if the poses change.
"""
import sys, json
from collections import deque
from PIL import Image
import numpy as np

src, out_dir = sys.argv[1], sys.argv[2]
rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = rgb.shape
mn = rgb.min(axis=2)

# 1) Background = near-white pixels connected to the image border (flood fill), so the
#    pale belly/cheek inside the outline is never touched.
loose = mn > 200
bg = np.zeros((H, W), bool)
q = deque()
for x in range(W):
    for y in (0, H - 1):
        if loose[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if loose[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and loose[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; q.append((ny, nx))

# 2) Alpha: opaque inside; in the background region, un-blend from white so anti-aliased
#    outline edges become semi-transparent navy instead of a white halo.
NAVY = np.array([30, 40, 70], np.float32)
alpha = np.ones((H, W), np.float32)
lum = rgb.mean(axis=2)
a_bg = np.clip((255 - lum) / (255 - NAVY.mean()), 0, 1)
alpha[bg] = a_bg[bg]
alpha[alpha < 0.04] = 0
out = rgb.copy()
edge = bg & (alpha > 0)
a3 = alpha[edge][:, None]
out[edge] = np.clip((rgb[edge] - (1 - a3) * 255) / a3, 0, 255)
rgba = np.dstack([out, alpha * 255]).astype(np.uint8)

# 3) Frames = column runs of visible pixels.
cols = (alpha > 0.1).any(axis=0)
runs, start = [], None
for x, v in enumerate(cols):
    if v and start is None: start = x
    if not v and start is not None: runs.append((start, x)); start = None
if start is not None: runs.append((start, W))
runs = [r for r in runs if r[1] - r[0] > 50]
print('frames', runs)

# 4) Eye per frame = small, isolated dark blob (outline is one big connected ring).
def components(mask):
    seen = np.zeros_like(mask); comps = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]: continue
        pts = []; dq = deque([(y0, x0)]); seen[y0, x0] = True
        while dq:
            y, x = dq.popleft(); pts.append((y, x))
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny, nx = y+dy, x+dx
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; dq.append((ny, nx))
        comps.append(np.array(pts))
    return comps

dark = (rgb.max(axis=2) < 90) & ~bg
frames = []
for x0, x1 in runs:
    sub = dark[:, x0:x1]
    cands = [c for c in components(sub) if 60 < len(c) < 2500]
    def score(c):
        h = np.ptp(c[:,0]) + 1; w = np.ptp(c[:,1]) + 1
        return abs(h / w - 1.2) + (0 if len(c) > 150 else 1)
    eye = min(cands, key=score)
    ey, ex = eye[:, 0].mean(), eye[:, 1].mean() + x0
    ys = np.nonzero((alpha[:, x0:x1] > 0.1).any(axis=1))[0]
    frames.append(dict(x0=x0, x1=x1, y0=int(ys.min()), y1=int(ys.max()) + 1, eye=(float(ex), float(ey)), eyeSize=len(eye)))
for f in frames: print(f)

# 5) Common cell: every frame placed so its eye lands on the same cell point.
left = max(f['eye'][0] - f['x0'] for f in frames)
right = max(f['x1'] - f['eye'][0] for f in frames)
top = max(f['eye'][1] - f['y0'] for f in frames)
bottom = max(f['y1'] - f['eye'][1] for f in frames)
pad = 6
src_w, src_h = left + right + 2 * pad, top + bottom + 2 * pad
CELL = 256
scale = min((CELL - 4) / src_w, (CELL - 4) / src_h)
print('src cell', src_w, src_h, 'scale', scale)

img = Image.fromarray(rgba, 'RGBA')
COLS = 8  # power-of-two sheet width (2048) so mipmaps work; 2 cells unused
sheet = Image.new('RGBA', (CELL * COLS, CELL), (0, 0, 0, 0))
eye_cell = None
for i, f in enumerate(frames):
    ex, ey = f['eye']
    box = (int(round(ex - left - pad)), int(round(ey - top - pad)),
           int(round(ex - left - pad + src_w)), int(round(ey - top - pad + src_h)))
    crop = img.crop(box)
    nw, nh = round(src_w * scale), round(src_h * scale)
    # premultiplied resize avoids dark fringes
    crop = crop.convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
    ox, oy = (CELL - nw) // 2, (CELL - nh) // 2
    sheet.paste(crop, (i * CELL + ox, oy))
    eye_cell = (ox + (left + pad) * scale, oy + (top + pad) * scale)
sheet.save(f'{out_dir}/duck-sheet.png', optimize=True)

# Visible bounds (union across frames) in cell coordinates — used to place the pivot/collider.
arr = np.asarray(sheet)[:, :, 3]
u = np.zeros((CELL, CELL), bool)
for i in range(len(frames)): u |= arr[:, i*CELL:(i+1)*CELL] > 25
ys, xs = np.nonzero(u)
meta = dict(cell=CELL, frames=len(frames), eye=eye_cell, bounds=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())])
json.dump(meta, open(f'{out_dir}/meta.json', 'w'), indent=1); print(meta)

# Preview on water blue with eye crosshair
prev = Image.new('RGBA', sheet.size, (67, 189, 240, 255)); prev.alpha_composite(sheet)
from PIL import ImageDraw
d = ImageDraw.Draw(prev)
for i in range(len(frames)):
    cx = i * CELL + eye_cell[0]; d.line([(cx, 0), (cx, CELL)], fill=(255,0,0,120)); d.line([(i*CELL, eye_cell[1]), ((i+1)*CELL, eye_cell[1])], fill=(255,0,0,120))
prev.crop((0, 0, CELL * len(frames), CELL)).save(f'{out_dir}/preview.png')
