#!/usr/bin/env python3
"""v3.54.13 — a board: rows are sides, columns are pictures in the same original-elevation frame (sources, sketches,
observation previews, model renders). A missing picture is a grey cell saying why.

    /usr/bin/python3 -I research/source-to-model/v35413/make-board.py <out.png> <col width> SIDES=FRONT,REAR,RIGHT,LEFT \
        "Title|FRONT=path;REAR=path|crop x0,y0,x1,y1" …
"""
import sys
from PIL import Image, ImageDraw
out, colw = sys.argv[1], int(sys.argv[2])
sides = sys.argv[3].split('=', 1)[1].split(',')
cols = []
for spec in sys.argv[4:]:
    parts = spec.split('|')
    title, paths = parts[0], dict(p.split('=', 1) for p in parts[1].split(';') if p)
    crop = tuple(int(v) for v in parts[2].split(',')) if len(parts) > 2 and parts[2] else None
    cols.append((title, paths, crop))
cells = []
for s in sides:
    row = []
    for title, paths, crop in cols:
        p = paths.get(s)
        if p:
            im = Image.open(p).convert('RGB')
            if crop: im = im.crop(crop)
        else:
            im = None
        row.append((title, im))
    cells.append((s, row))
ref = next(im for _, row in cells for _, im in row if im is not None)
h = int(ref.height * colw / ref.width)
head = 28
board = Image.new('RGB', (len(cols) * (colw + 6) + 6, len(sides) * (h + head + 6) + 6), 'white')
d = ImageDraw.Draw(board)
for r, (s, row) in enumerate(cells):
    y = 6 + r * (h + head + 6)
    for c, (title, im) in enumerate(row):
        x = 6 + c * (colw + 6)
        d.text((x, y), s, fill=(0, 0, 0)); d.text((x, y + 12), title, fill=(40, 40, 160) if 'ODDANY' in title else (0, 0, 0))
        if im is None:
            d.rectangle((x, y + head, x + colw, y + head + h), fill=(236, 236, 236)); d.text((x + 8, y + head + h // 2), 'brak (nie ma tego wejscia)', fill=(90, 90, 90))
        else:
            board.paste(im.resize((colw, int(im.height * colw / im.width))), (x, y + head))
        if 'ODDANY' in title: d.rectangle((x - 2, y + head - 2, x + colw + 1, y + head + h + 1), outline=(40, 40, 160), width=2)
board.save(out); print(out, board.size)
