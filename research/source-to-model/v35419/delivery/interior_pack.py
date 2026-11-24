#!/usr/bin/env python3
"""v3.54.19 — the interior grading pack: per house ONE picture — the publisher's ground plan with variant X's ground-storey
walls drawn on it beside the same plan with variant Y's (blue: the model's exterior walls, red: its interior walls, green:
interior doors, cyan: exterior openings). Which of baseline1351 / final is X is drawn at random per house and kept in
key.json (not given to the grader). A variant without a model is a white panel saying so.
  interior_pack.py <delivery dir> <out dir> <manifest.json>"""
import hashlib, json, os, random, sys
from PIL import Image, ImageDraw, ImageFont
D, OUT, man = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
os.makedirs(OUT, exist_ok=True)
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
key = {}
for h in man['houses']:
    name = h['house']
    vs = [v['key'] for v in h['variants'] if v['key'] in ('baseline1351', 'final')]
    if len(vs) < 2: continue
    random.Random(int(hashlib.sha256(('interior:' + name).encode()).hexdigest(), 16)).shuffle(vs)
    key[name] = {'X': vs[0], 'Y': vs[1]}
    panels = []
    for lab in ('X', 'Y'):
        p = os.path.join(D, 'houses', name, 'overlay', f'{key[name][lab]}-plan-overlay.png')
        if os.path.exists(p):
            im = Image.open(p).convert('RGB'); im.thumbnail((1250, 1250))
        else:
            im = Image.new('RGB', (1250, 600), 'white'); ImageDraw.Draw(im).text((40, 260), 'BRAK MODELU (nic do nałożenia)', fill='black', font=F)
        q = Image.new('RGB', (1270, im.height + 60), 'white'); ImageDraw.Draw(q).text((10, 10), f'WARIANT {lab}', fill='black', font=F); q.paste(im, (10, 55)); panels.append(q)
    W = Image.new('RGB', (2540, max(p.height for p in panels)), 'white')
    W.paste(panels[0], (0, 0)); W.paste(panels[1], (1270, 0))
    W.save(os.path.join(OUT, f'{name}.png'))
json.dump(key, open(os.path.join(OUT, 'key.json'), 'w'), indent=1)
print(len(key), 'houses')
