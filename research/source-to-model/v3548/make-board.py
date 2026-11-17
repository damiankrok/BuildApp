#!/usr/bin/env python3
"""v3.54.7 — boards ŹRÓDŁO | <models…> per side, in the elevation's own frame, with a close-up of the main body.

    /usr/bin/python3 -I research/source-to-model/v3547/make-board.py <frames dir> <frames house.json> <pictures dir> <out.png> <label,label,…>

<frames dir> is board-frames.ts's output (index.json and one PNG per side and model); <pictures dir> holds the
publisher's elevation pictures, found by their byte hash (the house document's `byteHash`). Every column of a row is
the same frame: a pixel of the source is the same place of every model. The board stays outside Git.
"""
import hashlib
import json
import os
import sys

from PIL import Image, ImageDraw

frames_dir, frames_doc, pics_dir, out, labels = sys.argv[1:6]
labels = labels.split(',')
index = json.load(open(os.path.join(frames_dir, 'index.json')))
doc = json.load(open(frames_doc))
by_hash = {}
for f in os.listdir(pics_dir):
    p = os.path.join(pics_dir, f)
    if os.path.isfile(p):
        by_hash[hashlib.sha256(open(p, 'rb').read()).hexdigest()] = p
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
COL_W = 520
rows = []
for side in SIDES:
    items = [x for x in index if x['side'] == side]
    if not items:
        continue
    src = by_hash.get(items[0]['sourceByteHash'])
    if not src:
        continue
    el = next(e for e in doc['observations']['elevations'] if e['id'] == items[0]['elevation'])
    s = Image.open(src).convert('RGB')
    renders = {x['label']: Image.open(os.path.join(frames_dir, x['file'])).convert('RGB') for x in items}
    cols = [('ZRODLO (source)', s)] + [(l, renders[l]) for l in labels if l in renders]
    # the close-up: the main body as this elevation reads it, with a margin
    mb = next((b for b in el['bodies'] if b['bodyId'] == 'main'), None) or (el['bodies'][0] if el['bodies'] else None)
    crop = None
    if mb:
        x0, x1 = mb['leftX'], mb['rightX']
        y0 = mb['ridgeY'] if mb['ridgeY'] is not None else 0
        y1 = el['groundY']
        m = 0.08 * (x1 - x0)
        crop = (max(0, int(x0 - m)), max(0, int(y0 - m)), min(s.width, int(x1 + m)), min(s.height, int(y1 + m)))
    rows.append((side, cols, crop))
if not rows:
    raise SystemExit('no registered side')
ncol = max(len(c) for _, c, _ in rows)
cells = []
for side, cols, crop in rows:
    full = [c[1].resize((COL_W, int(c[1].height * COL_W / c[1].width))) for c in cols]
    close = [c[1].crop(crop).resize((COL_W, int((crop[3] - crop[1]) * COL_W / (crop[2] - crop[0])))) for c in cols] if crop else []
    cells.append((side, [c[0] for c in cols], full, close))
H = sum(max(i.height for i in f) + (max(i.height for i in c) if c else 0) + 40 for _, _, f, c in cells) + 10
board = Image.new('RGB', (COL_W * ncol + 10 * (ncol + 1), H), 'white')
d = ImageDraw.Draw(board)
y = 5
for side, names, full, close in cells:
    for k, (name, im) in enumerate(zip(names, full)):
        x = 10 + k * (COL_W + 10)
        d.text((x, y), f'{side} — {name}', fill=(0, 0, 0))
        board.paste(im, (x, y + 16))
    y += 16 + max(i.height for i in full) + 4
    if close:
        for k, im in enumerate(close):
            board.paste(im, (10 + k * (COL_W + 10), y))
        y += max(i.height for i in close)
    y += 20
board.save(out)
print(out, board.size)
