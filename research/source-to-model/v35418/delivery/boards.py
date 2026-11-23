#!/usr/bin/env python3
"""v3.54.18 — the comparison board of one house (private output; publisher drawings never go into Git).

Rows: one per source elevation the run read (by frame). Columns: źródło | szkic | baseline | po zmianie | oddany — the model
columns are that side's tile of the SIDES render (the analyzer's neutral renderer, one camera set / palette / lighting for
every model: research/source-to-model/v35418/render.ts). Below: the axonometrics and the storey cuts of each variant.
Every tile is also written as its own PNG (tiles/<house>/...) at full resolution so windows can be judged.

  boards.py <house.json> <out dir>
house.json: { "house", "title", "publisher", "set", "url", "sources": <dir with index.json from export_sources.py>,
              "sketchRun": <run dir whose sketches/by-frame + facades.json are shown>,
              "variants": [ { "key": "baseline", "label": ..., "kind": "LIVE|REPLAY|KONTROLA|HOST", "render": <dir>, "name": <prefix>, "commit": ..., "revision": ... }, ... ] }
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

spec = json.load(open(sys.argv[1]))
out = sys.argv[2]
house = spec['house']
tiles_dir = os.path.join(out, 'tiles', house)
os.makedirs(tiles_dir, exist_ok=True)
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
PL = {'FRONT': 'front', 'RIGHT': 'prawa', 'REAR': 'tył', 'LEFT': 'lewa'}
try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
    SMALL = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    BIG = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception:
    FONT = SMALL = BIG = ImageFont.load_default()

def load(p):
    return Image.open(p).convert('RGB') if p and os.path.exists(p) else None

def side_tiles(variant):
    """Split the SIDES render into its four tiles; also AROUND into five."""
    res = {}
    im = load(os.path.join(variant['render'], f"{variant['name']}-SIDES.png"))
    if im:
        w = im.width // 4
        for i, s in enumerate(SIDES):
            t = im.crop((i * w, 0, (i + 1) * w, im.height))
            t.save(os.path.join(tiles_dir, f"{variant['key']}-{s}.png"))
            res[s] = t
    ar = load(os.path.join(variant['render'], f"{variant['name']}-AROUND.png"))
    if ar:
        w = ar.width // 5
        for i, n in enumerate(['TOP', 'AXO-front-right', 'AXO-front-left', 'AXO-rear-left', 'AXO-rear-right']):
            t = ar.crop((i * w, 0, (i + 1) * w, ar.height))
            t.save(os.path.join(tiles_dir, f"{variant['key']}-{n}.png"))
            res[n] = t
    return res

variants = spec['variants']
tiles = {v['key']: side_tiles(v) for v in variants}
src_index = {i['asset']: i for i in json.load(open(os.path.join(spec['sources'], 'index.json'))) if 'file' in i}
fac_path = os.path.join(spec['sketchRun'], 'facades.json')
facades = json.load(open(fac_path))['facades'] if os.path.exists(fac_path) else []

def source_of(frame_id):
    stem = frame_id.replace('frame-', '')
    best = None
    for k, v in src_index.items():
        if stem.startswith(k) or k.startswith(stem[:len(k)]) or k in stem:
            if best is None or len(k) > len(best[0]): best = (k, v)
    return os.path.join(spec['sources'], best[1]['file']) if best else None

CW, CH, PAD, HEAD = 520, 360, 14, 64
cols = ['źródło (oryginał wydawcy)', 'szkic (odczyt API → JSON → rysunek lokalny)'] + [f"{v['label']} [{v['kind']}]" for v in variants]
rows = [f for f in facades]
n_extra = 2  # axonometric row, storey row
W = PAD + len(cols) * (CW + PAD)
H = HEAD + 40 + len(rows) * (CH + 56) + n_extra * (CH + 56) + 60
board = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(board)
d.text((PAD, 10), f"{spec['title']} — {spec['publisher']} — zbiór {spec['set']}", fill='black', font=BIG)
for i, c in enumerate(cols):
    d.text((PAD + i * (CW + PAD), HEAD), c, fill='black', font=SMALL)

def paste(im, x, y):
    if im is None:
        d.rectangle((x, y, x + CW, y + CH), fill=(236, 236, 236))
        d.text((x + 10, y + 10), 'brak', fill=(90, 90, 90), font=FONT)
        return
    t = im.copy(); t.thumbnail((CW, CH))
    board.paste(t, (x + (CW - t.width) // 2, y + (CH - t.height) // 2))
    d.rectangle((x, y, x + CW, y + CH), outline=(200, 200, 200))

y = HEAD + 30
index = {'house': house, 'rows': [], 'variants': [{k: v[k] for k in v if k not in ('render',)} for v in variants]}
for f in rows:
    tail = f['frameId'][-10:]
    side = f.get('side')
    label = f"elewacja „{f['label']}” → strona modelu: {PL.get(side, 'nie zarejestrowana')} ({f.get('sideBasis') or '—'})"
    d.text((PAD, y), label[:150], fill='black', font=SMALL)
    d.text((PAD, y + 18), ("werdykt: " + f.get('verdict', '') + "; otwory zweryf. %d, przyjęte %d, odrzucone źródłem %d, nierozstrz. %d; okna dach. %d; kominy %d; strefy wykończ. %d" % (f['openings']['verified'], f['openings']['adopted'], f['openings']['refusedBySource'], f['openings']['undecided'], f['roofWindows']['built'], f['chimneys']['built'], f['finishes']['zonesApplied']))[:170], fill=(70, 70, 70), font=SMALL)
    yy = y + 40
    src = source_of(f['frameId'])
    s_im = load(src)
    if s_im:
        # the tile is a view copy (at most 1400 px wide); the publisher's own bytes are in houses/<house>/sources
        tv = s_im.copy(); tv.thumbnail((1400, 1400)); tv.save(os.path.join(tiles_dir, f"source-{tail}.png"))
    paste(s_im, PAD, yy)
    sk = load(os.path.join(spec['sketchRun'], 'sketches', 'by-frame', f"{tail}.png"))
    if sk: sk.save(os.path.join(tiles_dir, f"sketch-{tail}.png"))
    paste(sk, PAD + (CW + PAD), yy)
    for j, v in enumerate(variants):
        paste(tiles[v['key']].get(side) if side else None, PAD + (2 + j) * (CW + PAD), yy)
    index['rows'].append({'frame': tail, 'label': f['label'], 'side': side, 'verdict': f.get('verdict'), 'source': f"tiles/{house}/source-{tail}.png" if s_im else None, 'sketch': f"tiles/{house}/sketch-{tail}.png" if sk else None})
    y += CH + 56
# axonometric row and storey row
for title, pick in (('perspektywa (aksonometria od frontu z prawej)', 'AXO-front-right'), ('rzut kondygnacji 0 bez dachu (przekrój na 1,2 m)', None)):
    d.text((PAD, y), title, fill='black', font=SMALL)
    yy = y + 40
    for j, v in enumerate(variants):
        if pick: im = tiles[v['key']].get(pick)
        else:
            im = load(os.path.join(v['render'], f"{v['name']}-STOREY-0.png"))
            if im: im.save(os.path.join(tiles_dir, f"{v['key']}-STOREY-0.png"))
        paste(im, PAD + (2 + j) * (CW + PAD), yy)
    y += CH + 56
os.makedirs(os.path.join(out, 'boards'), exist_ok=True)
board.save(os.path.join(out, 'boards', f'{house}-board.png'))
json.dump(index, open(os.path.join(out, 'boards', f'{house}-board.json'), 'w'), indent=1, ensure_ascii=False)
print(house, 'board', board.size, 'rows', len(rows))
