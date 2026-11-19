#!/usr/bin/env python3
"""v3.54.16 — a board per house: the ORIGINAL elevation with the model's openings drawn on it through the analyzer's own
registration, BEFORE (v3.54.15 delivered) and AFTER (v3.54.16 with the executor's patches), FRONT RIGHT REAR LEFT.
Red: the model's openings; the source underneath is the reference. Private delivery only (publisher pictures).
    /usr/bin/python3 -I compose-overlay.py <overlays dir> <house> <out png>
"""
import json, os, sys
from PIL import Image, ImageDraw
src, house, out = sys.argv[1:]
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
CW, CH, HEAD, LEFT = 420, 220, 22, 120
rows = [('BEFORE v3.54.15', os.path.join(src, f'{house}-before')), ('AFTER v3.54.16', os.path.join(src, f'{house}-after'))]
b = Image.new('RGB', (LEFT + 4 * (CW + 6), 26 + len(rows) * (CH + HEAD)), 'white'); d = ImageDraw.Draw(b)
d.text((4, 6), f'{house}: source elevation + model openings (red) through the registration', fill=(0, 0, 0))
for c, s in enumerate(SIDES): d.text((LEFT + c * (CW + 6), 14), s, fill=(0, 0, 0))
for r, (name, dd) in enumerate(rows):
    y = 26 + r * (CH + HEAD)
    d.text((4, y + CH // 2), name, fill=(40, 40, 160))
    for c, s in enumerate(SIDES):
        x = LEFT + c * (CW + 6); p = os.path.join(dd, f'overlay-{s}.png')
        if not os.path.exists(p):
            d.rectangle((x, y, x + CW, y + CH), fill=(232, 232, 232)); d.text((x + 6, y + 6), 'no registered view', fill=(80, 80, 80)); continue
        im = Image.open(p).convert('RGB'); im.thumbnail((CW, CH)); b.paste(im, (x, y))
        views = json.load(open(os.path.join(dd, 'outcome.json'))).get('views', [])
        if any(v['side'] == s and not v['heights'] for v in views):
            d.rectangle((x, y + CH - 14, x + CW, y + CH), fill=(200, 130, 0)); d.text((x + 4, y + CH - 13), 'registered for positions only: heights not read (boxes drawn at no datum)', fill=(255, 255, 255))
os.makedirs(os.path.dirname(out), exist_ok=True); b.save(out); print('overlay', out)
