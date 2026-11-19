#!/usr/bin/env python3
"""v3.54.14 — a board per house: rows ORIGINAL | SKETCH (automatic, API JSON -> local drawing) | variants (model sides),
columns FRONT, EAST, REAR, WEST; a second board of the views from above / axonometrics; a third of the storey cuts beside
the source plan. Publisher pictures stay outside Git (the board is written to the private directory given).
    /usr/bin/python3 -I compose-board.py <run dir with source-package/observation-graph/facade-alignment> <cache dir>
        <sketch dir> <views dir> <out prefix> <plan png or -> label …
"""
import sys, json, hashlib, io, os
from PIL import Image, ImageDraw
run, cache, sketches, views, out, plan, *labels = sys.argv[1:]
pkg = json.load(open(os.path.join(run, 'source-package.json'))); g = json.load(open(os.path.join(run, 'observation-graph.json')))
al = json.load(open(os.path.join(run, 'facade-alignment.json')))
SIDES = ['FRONT', 'EAST', 'REAR', 'WEST']
def original(facade):
    v = next((x for x in al['views'] if x['facade'] == facade), None)
    if not v: return None
    f = next(x for x in g['coordinateFrames'] if x['id'] == v['frameId'])
    a = next(x for x in pkg['assets'] if x['id'] == f['assetId']); var = next(x for x in a['variants'] if x['byteHash'] == f['variantByteHash'])
    return Image.open(io.BytesIO(open(os.path.join(cache, hashlib.sha256(var['url'].encode()).hexdigest()[:32] + '.bin'), 'rb').read())).convert('RGB')
TILE = {'FRONT': 0, 'EAST': 1, 'REAR': 2, 'WEST': 3}
def model_side(label, facade):
    p = os.path.join(views, f'SIDES-{label}.png')
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGB'); w = im.width // 4
    return im.crop((TILE[facade] * w, 0, (TILE[facade] + 1) * w, im.height))
CW, CH, HEAD = 360, 170, 16
rows = [('ORIGINAL', original), ('SKETCH (API JSON -> local drawing)', lambda f: Image.open(os.path.join(sketches, f'{f}.png')).convert('RGB') if os.path.exists(os.path.join(sketches, f'{f}.png')) else None)] + [(l, (lambda l: lambda f: model_side(l, f))(l)) for l in labels]
board = Image.new('RGB', (110 + 4 * (CW + 6), len(rows) * (CH + HEAD + 6) + 24), 'white'); d = ImageDraw.Draw(board)
for c, s in enumerate(SIDES): d.text((110 + c * (CW + 6), 4), s, fill=(0, 0, 0))
for r, (name, get) in enumerate(rows):
    y = 24 + r * (CH + HEAD + 6); d.text((4, y + CH // 2), name[:16], fill=(40, 40, 160)); 
    if len(name) > 16: d.text((4, y + CH // 2 + 12), name[16:34], fill=(40, 40, 160))
    for c, s in enumerate(SIDES):
        im = get(s); x = 110 + c * (CW + 6)
        if im is None: d.rectangle((x, y, x + CW, y + CH), fill=(230, 230, 230)); d.text((x + 8, y + 8), 'none', fill=(80, 80, 80)); continue
        im.thumbnail((CW, CH)); board.paste(im, (x + (CW - im.width) // 2, y + (CH - im.height) // 2))
board.save(out + '-sides.png')
# around
tiles = [Image.open(os.path.join(views, f'AROUND-{l}.png')).convert('RGB') for l in labels if os.path.exists(os.path.join(views, f'AROUND-{l}.png'))]
if tiles:
    W = max(t.width for t in tiles); H = sum(t.height + HEAD for t in tiles)
    b2 = Image.new('RGB', (W, H), 'white'); d2 = ImageDraw.Draw(b2); y = 0
    for l, t in zip(labels, tiles): d2.text((4, y + 2), f'{l}: TOP, front-right, front-left, rear-left, rear-right', fill=(40, 40, 160)); b2.paste(t, (0, y + HEAD)); y += t.height + HEAD
    b2.save(out + '-around.png')
# interior
cuts = [(l, sorted(f for f in os.listdir(views) if f.startswith('CUT-') and f.endswith(f'-{l}.png'))) for l in labels]
ims = []
if plan != '-' and os.path.exists(plan): ims.append(('SOURCE PLAN', Image.open(plan).convert('RGB')))
for l, fs in cuts:
    for f in fs: ims.append((f'{l} {f.split("-")[1]}-{f.split("-")[2]}', Image.open(os.path.join(views, f)).convert('RGB')))
if ims:
    S = 420; b3 = Image.new('RGB', (len(ims) * (S + 6) + 6, S + HEAD + 12), 'white'); d3 = ImageDraw.Draw(b3)
    for i, (n, im) in enumerate(ims):
        im.thumbnail((S, S)); b3.paste(im, (6 + i * (S + 6), HEAD + 6)); d3.text((6 + i * (S + 6), 2), n, fill=(40, 40, 160))
    b3.save(out + '-interior.png')
print('boards', out)
