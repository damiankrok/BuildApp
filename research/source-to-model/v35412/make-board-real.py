#!/usr/bin/env python3
"""v3.54.12 — boards ŹRÓDŁO | SZKIC | <models…> | WYBRANY per side, all in the original elevation's own pixel frame.

    /usr/bin/python3 -I research/source-to-model/v35412/make-board-real.py <frames dir> <pictures dir> <out.png> \
        <label,label,…> <chosen label> [SIDE=<sketch registered by similarity> …]

<frames dir> is board-frames.ts's output; <pictures dir> holds the publisher's elevations, found by byte hash. A
sketch column shows the OWNER's sketch mapped into the original's frame by the SIMILARITY of register-sketch.py
(uniform scale, rotation, shift) — never stretched to fit; where its proportions differ from the original, the
difference stays visible. A side without a sketch shows "brak szkicu (oryginał w B)". The chosen column repeats the
chosen model's render under its own heading. The board stays outside Git.
"""
import hashlib
import json
import os
import sys

from PIL import Image, ImageDraw

frames_dir, pics_dir, out, labels, chosen = sys.argv[1:6]
sketches = dict(a.split('=', 1) for a in sys.argv[6:])
labels = labels.split(',')
index = json.load(open(os.path.join(frames_dir, 'index.json')))
by_hash = {}
for f in os.listdir(pics_dir):
    p = os.path.join(pics_dir, f)
    if os.path.isfile(p):
        by_hash[hashlib.sha256(open(p, 'rb').read()).hexdigest()] = p
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
COL_W = 440
HEAD = 30


def blank(w, h, text):
    im = Image.new('RGB', (w, h), (236, 236, 236))
    ImageDraw.Draw(im).text((20, h // 2 - 6), text, fill=(90, 90, 90))
    return im


rows = []
for side in SIDES:
    items = {x['label']: x for x in index if x['side'] == side}
    if not items:
        continue
    first = next(iter(items.values()))
    src_path = by_hash.get(first['sourceByteHash'])
    if not src_path:
        raise SystemExit(f'{side}: source picture {first["sourceByteHash"][:8]} not in {pics_dir}')
    src = Image.open(src_path).convert('RGB')
    cols = [('ZRODLO (oryginal wydawcy)', src)]
    if side in sketches:
        cols.append(('SZKIC OWNER-a (podobienstwo, bez rozciagania)', Image.open(sketches[side]).convert('RGB')))
    else:
        cols.append(('SZKIC', blank(src.width, src.height, 'brak szkicu - w B ta strona to oryginal')))
    for l in labels:
        cols.append((l, Image.open(os.path.join(frames_dir, items[l]['file'])).convert('RGB')))
    cols.append((f'WYBRANY = {chosen}', Image.open(os.path.join(frames_dir, items[chosen]['file'])).convert('RGB')))
    rows.append((side, cols))

ncol = max(len(c) for _, c in rows)
scaled = [(side, [(n, im.resize((COL_W, int(im.height * COL_W / im.width)))) for n, im in cols]) for side, cols in rows]
H = sum(HEAD + max(im.height for _, im in cols) + 14 for _, cols in scaled) + 10
board = Image.new('RGB', (COL_W * ncol + 8 * (ncol + 1), H), 'white')
d = ImageDraw.Draw(board)
y = 6
for side, cols in scaled:
    for k, (name, im) in enumerate(cols):
        x = 8 + k * (COL_W + 8)
        d.text((x, y), side, fill=(0, 0, 0))
        d.text((x, y + 13), name, fill=(40, 40, 160) if name.startswith('WYBRANY') else (0, 0, 0))
        board.paste(im, (x, y + HEAD))
        if name.startswith('WYBRANY'):
            d.rectangle((x - 2, y + HEAD - 2, x + im.width + 1, y + HEAD + im.height + 1), outline=(40, 40, 160), width=2)
    y += HEAD + max(im.height for _, im in cols) + 14
board.save(out)
print(out, board.size)
