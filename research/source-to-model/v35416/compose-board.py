#!/usr/bin/env python3
"""v3.54.16 §12 — a board per house: rows SOURCE | SKETCH (the API's contours drawn locally, with its verdict:
ACCEPTED / PARTIAL / REJECTED / UNCHECKED / MISSING_SOURCE) | each variant's model (L0, L-M, L-MS …) | DELIVERED, columns
FRONT, RIGHT, REAR, LEFT; a second board of the views from above and four axonometrics; a third of each storey without
its roof. Publisher pictures stay outside Git (the boards are written to the private delivery).
    /usr/bin/python3 -I compose-board.py <delivery dir> <house> <delivered label or -> <label> …
"""
import json, os, sys
from PIL import Image, ImageDraw

delivery, house, delivered, *labels = sys.argv[1:]
views = os.path.join(delivery, 'boards', house, 'views')
sk = os.path.join(delivery, 'sketches', house)
src = os.path.join(delivery, 'sources', house)
out = os.path.join(delivery, 'boards', house, house)
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
TILE = {'FRONT': 0, 'RIGHT': 1, 'REAR': 2, 'LEFT': 3}
COLOUR = {'ACCEPTED': (30, 130, 60), 'PARTIAL': (200, 130, 0), 'REJECTED': (190, 30, 30), 'UNCHECKED': (110, 110, 110), 'MISSING_SOURCE': (110, 110, 110), 'FAILED': (190, 30, 30)}
index = json.load(open(os.path.join(delivery, 'sketches', 'index.json')))['houses'].get(house, [])
verdict = {r['side']: r for r in index}

def source(side):
    for ext in ('.jpg', '.png'):
        p = os.path.join(src, side + ext)
        if os.path.exists(p): return Image.open(p).convert('RGB')
def sketch(side):
    p = os.path.join(sk, side + '.png')
    return Image.open(p).convert('RGB') if os.path.exists(p) else None
def model_side(label):
    def get(side):
        p = os.path.join(views, f'SIDES-{label}.png')
        if not os.path.exists(p): return None
        im = Image.open(p).convert('RGB'); w = im.width // 4
        return im.crop((TILE[side] * w, 0, (TILE[side] + 1) * w, im.height))
    return get

CW, CH, HEAD, LEFT = 330, 160, 30, 128
rows = [('SOURCE', source), ('SKETCH (API -> local)', sketch)] + [(l, model_side(l)) for l in labels]
if delivered != '-': rows.append((f'DELIVERED ({delivered})', model_side(delivered)))
board = Image.new('RGB', (LEFT + 4 * (CW + 6), len(rows) * (CH + HEAD + 6) + 28), 'white'); d = ImageDraw.Draw(board)
d.text((4, 6), house, fill=(0, 0, 0))
for c, s in enumerate(SIDES): d.text((LEFT + c * (CW + 6), 8), s, fill=(0, 0, 0))
for r, (name, get) in enumerate(rows):
    y = 28 + r * (CH + HEAD + 6)
    for i in range(0, len(name), 18): d.text((4, y + CH // 2 + (i // 18) * 12), name[i:i + 18], fill=(40, 40, 160))
    for c, s in enumerate(SIDES):
        x = LEFT + c * (CW + 6); im = get(s)
        if get is sketch:
            v = verdict.get(s, {}); tag = v.get('verdict', 'MISSING_SOURCE')
            d.rectangle((x, y + CH + 2, x + CW, y + CH + HEAD - 4), fill=COLOUR.get(tag, (110, 110, 110)))
            props = v.get('properties') or {}
            d.text((x + 4, y + CH + 4), tag + ('  ' + ' '.join(f"{k[:4]}:{str(props[k])[:4]}" for k in ('form', 'finish', 'vertical', 'registration') if k in props) if props else ''), fill=(255, 255, 255))
        if im is None:
            d.rectangle((x, y, x + CW, y + CH), fill=(232, 232, 232)); d.text((x + 8, y + 8), 'none' if get is not sketch else verdict.get(s, {}).get('verdict', 'none'), fill=(80, 80, 80)); continue
        im.thumbnail((CW, CH)); board.paste(im, (x + (CW - im.width) // 2, y + (CH - im.height) // 2))
board.save(out + '-sides.png')
tiles = [(l, Image.open(os.path.join(views, f'AROUND-{l}.png')).convert('RGB')) for l in labels if os.path.exists(os.path.join(views, f'AROUND-{l}.png'))]
if tiles:
    W = max(t.width for _, t in tiles); H = sum(t.height + HEAD for _, t in tiles)
    b2 = Image.new('RGB', (W, H), 'white'); d2 = ImageDraw.Draw(b2); y = 0
    for l, t in tiles: d2.text((4, y + 8), f'{house} {l}: from above, front-right, front-left, rear-left, rear-right', fill=(40, 40, 160)); b2.paste(t, (0, y + HEAD)); y += t.height + HEAD
    b2.save(out + '-perspective.png')
cuts = []
for l in labels:
    for f in sorted(x for x in os.listdir(views) if x.startswith('CUT-') and x.endswith(f'-{l}.png')):
        cuts.append((f"{l} {f[4:-len(l) - 5]}", Image.open(os.path.join(views, f)).convert('RGB')))
if cuts:
    S = 380; b3 = Image.new('RGB', (len(cuts) * (S + 6) + 6, S + HEAD + 12), 'white'); d3 = ImageDraw.Draw(b3)
    for i, (n, im) in enumerate(cuts):
        im.thumbnail((S, S)); b3.paste(im, (6 + i * (S + 6), HEAD + 6)); d3.text((6 + i * (S + 6), 8), f'{n} (storey without its roof)', fill=(40, 40, 160))
    b3.save(out + '-storeys.png')
print('board', out)
