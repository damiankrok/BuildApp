"""v3.54.1 boards ŹRÓDŁO | A | B | H for the private package (never committed: they show publishers' pictures).

  /usr/bin/python3 -I board4.py --pics <exported pictures dir> --title <house> --out <png> \
      --col "A=<run dir>=<one-line score>" --col "B=..." --col "H1=..."  (one row each)

Row ŹRÓDŁO: the largest floor plan and the largest elevation (or exterior picture) of the page, as exported for the
reference readers. Every other row: that run's scene sheet (scene-all-sides.png, the same cameras for every strategy),
or the refusal written where there is no model.
"""
import argparse, json, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('--pics', required=True)
ap.add_argument('--title', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--col', action='append', default=[])
a = ap.parse_args()

W = 1800
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font = ImageFont.truetype(FONT, 22) if os.path.exists(FONT) else ImageFont.load_default()
small = ImageFont.truetype(FONT, 18) if os.path.exists(FONT) else ImageFont.load_default()

def fit(im, w, h):
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))))

def source_row():
    idx = json.load(open(os.path.join(a.pics, 'index.json')))
    pics = [p for p in idx['pictures'] if p.get('file')]
    plans = [p for p in pics if p.get('doc') == 'FLOOR_PLAN']
    views = [p for p in pics if p.get('doc') == 'ELEVATION'] or [p for p in pics if p.get('doc') == 'PERSPECTIVE_RENDER']
    row = Image.new('RGB', (W, 560), 'white')
    x = 0
    for group in (plans, views):
        if not group:
            continue
        best = max(group, key=lambda p: p['origPx'][0] * p['origPx'][1])
        im = fit(Image.open(os.path.join(a.pics, best['file'])).convert('RGB'), W // 2 - 8, 560)
        row.paste(im, (x, 0))
        x += W // 2
    return row

def run_row(d):
    p = os.path.join(d, 'scene-all-sides.png')
    if os.path.exists(p):
        return fit(Image.open(p).convert('RGB'), W, 900)
    row = Image.new('RGB', (W, 120), (245, 245, 245))
    r = json.load(open(os.path.join(d, 'run.json'))) if os.path.exists(os.path.join(d, 'run.json')) else {}
    ImageDraw.Draw(row).text((16, 40), 'BRAK MODELU: ' + str(r.get('code') or r.get('outcome') or '')[:80], fill='black', font=font)
    return row

rows = [('ŹRÓDŁO — największy rzut i elewacja strony (tylko do prywatnej paczki)', source_row())]
for spec in a.col:
    name, d, score = (spec.split('=', 2) + ['', ''])[:3]
    rows.append((f'{name}: {score}', run_row(d)))
Ht = sum(r.height + 40 for _, r in rows) + 44
board = Image.new('RGB', (W, Ht), 'white')
dr = ImageDraw.Draw(board)
dr.text((10, 8), a.title, fill='black', font=font)
y = 44
for label, r in rows:
    dr.text((10, y + 8), label[:140], fill=(20, 20, 20), font=small)
    board.paste(r, (0, y + 36))
    y += r.height + 40
board.save(a.out)
print('board', a.out)
