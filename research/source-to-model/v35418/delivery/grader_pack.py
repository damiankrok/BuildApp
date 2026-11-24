#!/usr/bin/env python3
"""Blind grading pack: per house one image = the publisher's elevations (from the delivery's sources) + variant X + variant Y
(SIDES and AROUND renders, same renderer); which of baseline/final is X is drawn at random and kept in key.json (not given)."""
import json, os, random, sys, hashlib
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]          # delivery dir (make_delivery output)
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
man = json.load(open(sys.argv[3]))
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
key = {}
for h in man['houses']:
    name = h['house']
    # the pair graded and the draw's seed may be named (R2: delivered1349 against r2, a draw of its own)
    rng = random.Random(int(hashlib.sha256((os.environ.get('GRADER_SEED', 'grader') + ':' + name).encode()).hexdigest(), 16))
    vs = [v['key'] for v in h['variants'] if v['key'] in tuple(os.environ.get('GRADER_KEYS', 'baseline,final').split(','))]
    if len(vs) < 2: continue
    rng.shuffle(vs)
    key[name] = {'X': vs[0], 'Y': vs[1]}
    src = os.path.join(D, 'houses', name, 'sources')
    idx = [i for i in json.load(open(os.path.join(src, 'index.json'))) if i.get('roles', {}).get('document') == 'ELEVATION' and 'file' in i]
    ims = []
    for i in idx:
        im = Image.open(os.path.join(src, i['file'])).convert('RGB')
        if im.width < 240: continue
        s = 620 / im.width
        ims.append(im.resize((620, max(1, int(im.height * s)))))
    W = 2500
    rows = []
    if ims:
        hh = max(i.height for i in ims)
        r = Image.new('RGB', (W, hh + 50), 'white'); d = ImageDraw.Draw(r); d.text((10, 8), 'ŹRÓDŁO: elewacje wydawcy (kolejność jak w pakiecie)', fill='black', font=F)
        x = 0
        for i in ims[:4]:
            r.paste(i, (x, 50)); x += 625
        rows.append(r)
    for lab in ('X', 'Y'):
        ren = os.path.join(D, 'houses', name, 'renders')
        for kind in ('SIDES', 'AROUND'):
            p = os.path.join(ren, f'{key[name][lab]}-{kind}.png')
            if not os.path.exists(p):
                r = Image.new('RGB', (W, 120), 'white'); ImageDraw.Draw(r).text((10, 40), f'WARIANT {lab}: BRAK MODELU (NO_MODEL)', fill='red', font=F); rows.append(r); break
            im = Image.open(p).convert('RGB'); im = im.resize((W, int(im.height * W / im.width)))
            r = Image.new('RGB', (W, im.height + 50), 'white'); ImageDraw.Draw(r).text((10, 8), f'WARIANT {lab} — {"elewacje modelu: FRONT | PRAWA | TYŁ | LEWA" if kind == "SIDES" else "z góry i cztery aksonometrie"}', fill='black', font=F); r.paste(im, (0, 50)); rows.append(r)
    H = sum(r.height for r in rows)
    o = Image.new('RGB', (W, H), 'white'); y = 0
    for r in rows: o.paste(r, (0, y)); y += r.height
    o.save(os.path.join(OUT, f'{name}.png'))
json.dump(key, open(os.path.join(os.path.dirname(OUT.rstrip('/')), 'grader-key.json'), 'w'), indent=1)
print('packs:', sorted(key))
