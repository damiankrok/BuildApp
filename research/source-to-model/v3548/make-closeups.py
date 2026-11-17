#!/usr/bin/env python3
"""v3.54.8 — close-ups ŹRÓDŁO | <models…> of the features this stage repairs, in the elevation's own frame.

    /usr/bin/python3 -I research/source-to-model/v3548/make-closeups.py <frames dir> <pictures dir> <out.png> <label,label,…>

<frames dir> is board-frames.ts's output: one PNG per side and model, each drawn in the registered frame of its
elevation, so a pixel of the source is the same place of every model; <pictures dir> holds the publisher's pictures,
found by byte hash. The windows are fixed here in metres of the house (along the side from its left end as seen from
outside, height above ±0): the frame's left and right legs, the ridge joint, the railing and the slab under the right
leg, the portal band, the rear raked glazings. Every model is cropped by the same window. The board stays outside Git.
"""
import hashlib
import json
import os
import sys

from PIL import Image, ImageDraw

frames_dir, pics_dir, out, labels = sys.argv[1:5]
labels = labels.split(',')
index = json.load(open(os.path.join(frames_dir, 'index.json')))
by_hash = {}
for f in os.listdir(pics_dir):
    p = os.path.join(pics_dir, f)
    if os.path.isfile(p):
        by_hash[hashlib.sha256(open(p, 'rb').read()).hexdigest()] = p

# (title, side, along from, along to, y from, y to) — metres
WINDOWS = [
    ('front: left leg to the ground', 'FRONT', -0.4, 1.8, -0.4, 5.6),
    ('front: ridge joint', 'FRONT', 2.2, 5.7, 6.0, 8.4),
    ('front: right leg on the slab, glass railing', 'FRONT', 5.4, 8.6, 2.0, 5.8),
    ('front: band over loggia and portal', 'FRONT', 2.8, 12.4, 1.6, 3.8),
    ('rear: raked glazings and their heads', 'REAR', 4.6, 11.6, 2.6, 6.9),
    ('rear: ridge joint', 'REAR', 6.3, 9.8, 6.0, 8.4),
]
CELL_H = 300
rows = []
for title, side, a0, a1, y0, y1 in WINDOWS:
    items = [x for x in index if x['side'] == side]
    if not items:
        continue
    fr = items[0]['frame']
    m = fr['mPerPx']

    def px(a, y):
        return ((a - fr['alongAtPx0']) / m, fr['zeroRowPx'] - y / abs(m))

    xs = sorted([px(a0, 0)[0], px(a1, 0)[0]])
    ys = sorted([px(0, y0)[1], px(0, y1)[1]])
    box = (int(xs[0]), int(ys[0]), int(xs[1]), int(ys[1]))
    cells = []
    src = by_hash.get(items[0]['sourceByteHash'])
    if src:
        cells.append(('ŹRÓDŁO', Image.open(src).convert('RGB').crop(box)))
    for lab in labels:
        it = next((x for x in items if x['label'] == lab), None)
        if it:
            cells.append((lab, Image.open(os.path.join(frames_dir, it['file'])).convert('RGB').crop(box)))
    rows.append((title, cells))

W = 0
out_rows = []
for title, cells in rows:
    scaled = []
    for lab, im in cells:
        k = CELL_H / max(1, im.height)
        scaled.append((lab, im.resize((max(1, int(im.width * k)), CELL_H))))
    w = sum(im.width for _, im in scaled) + 8 * (len(scaled) + 1)
    W = max(W, w)
    out_rows.append((title, scaled))
H = sum(CELL_H + 40 for _ in out_rows) + 8
board = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(board)
y = 8
for title, scaled in out_rows:
    d.text((8, y), title, fill='black')
    x = 8
    for lab, im in scaled:
        d.text((x, y + 14), lab, fill='black')
        board.paste(im, (x, y + 30))
        x += im.width + 8
    y += CELL_H + 40
board.save(out)
print(out, board.size)
