#!/usr/bin/env python3
"""v3.54.21 — the blind grading packs (PROTOCOL §3 C). Per house two pictures:
  exterior/<house>.png — the publisher's elevations and perspectives (the truth), then VARIANT X and VARIANT Y, each as its four
      side views, the top with four axonometrics, and the ROOF FROM ABOVE with its joins drawn (same renderer for both);
  interior/<house>.png — the publisher's ground plan twice, with X's and with Y's ground-storey walls drawn on it.
Which variant is X is drawn at random per house (seeded by the house and the pack's seed) and written to <key file>, which is
NOT inside the pack. A variant without a model is a white panel saying so.
  grader_pack.py <delivery dir> <pack dir> <manifest.json> <key file> <variant key A> <variant key B> [seed]"""
import hashlib, json, os, random, sys
from PIL import Image, ImageDraw, ImageFont
D, OUT, man, KEY, VA, VB = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3])), sys.argv[4], sys.argv[5], sys.argv[6]
SEED = sys.argv[7] if len(sys.argv) > 7 else 'v35421'
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
W = 2500
os.makedirs(os.path.join(OUT, 'exterior'), exist_ok=True); os.makedirs(os.path.join(OUT, 'interior'), exist_ok=True)
key = {}

def band(title, ims, height=None):
    hh = height or max(i.height for i in ims)
    r = Image.new('RGB', (W, hh + 50), 'white'); ImageDraw.Draw(r).text((10, 8), title, fill='black', font=F)
    x = 0
    for i in ims:
        r.paste(i, (x, 50)); x += i.width + 5
    return r

for h in man['houses']:
    name = h['house']
    vs = [v['key'] for v in h['variants'] if v['key'] in (VA, VB)]
    if len(vs) < 2: continue
    random.Random(int(hashlib.sha256((SEED + ':' + name).encode()).hexdigest(), 16)).shuffle(vs)
    key[name] = {'X': vs[0], 'Y': vs[1]}
    src = os.path.join(D, 'houses', name, 'sources')
    idx = [i for i in json.load(open(os.path.join(src, 'index.json'))) if 'file' in i]
    def pics(pred, width, n):
        out = []
        for i in idx:
            if not pred(i.get('roles', {})): continue
            im = Image.open(os.path.join(src, i['file'])).convert('RGB')
            if im.width < 240: continue
            out.append(im.resize((width, max(1, int(im.height * width / im.width)))))
        return out[:n]
    rows = []
    el = pics(lambda r: r.get('document') == 'ELEVATION', 620, 4)
    if el: rows.append(band('ŹRÓDŁO: elewacje wydawcy (kolejność jak w pakiecie)', el))
    pe = pics(lambda r: r.get('projection') == 'PERSPECTIVE' or 'PERSPECTIVE' in str(r.get('document')) or r.get('document') == 'VISUALIZATION', 620, 4)
    if pe: rows.append(band('ŹRÓDŁO: perspektywy wydawcy (jakościowo: bryła i połączenia dachów; nie do mierzenia)', pe))
    ren = os.path.join(D, 'houses', name, 'renders')
    for lab in ('X', 'Y'):
        k = key[name][lab]
        if not os.path.exists(os.path.join(ren, f'{k}-SIDES.png')):
            r = Image.new('RGB', (W, 120), 'white'); ImageDraw.Draw(r).text((10, 40), f'WARIANT {lab}: BRAK MODELU', fill='red', font=F); rows.append(r); continue
        for kind, title in (('SIDES', 'elewacje modelu: FRONT | PRAWA | TYŁ | LEWA'), ('AROUND', 'z góry i cztery aksonometrie')):
            im = Image.open(os.path.join(ren, f'{k}-{kind}.png')).convert('RGB'); im = im.resize((W, int(im.height * W / im.width)))
            rows.append(band(f'WARIANT {lab} — {title}', [im]))
        rp = os.path.join(ren, f'{k}-ROOFPLAN.png')
        if os.path.exists(rp):
            im = Image.open(rp).convert('RGB')
            # blind: the roof plan's own title line names the variant (roof_plan.py draws it at the top) — blanked here
            ImageDraw.Draw(im).rectangle([0, 0, im.width, 44], fill='white')
            im.thumbnail((900, 900))
            rows.append(band(f'WARIANT {lab} — dach z góry (czerwone = kosz, pomarańczowe = dojście do ściany, czarne = kalenica, niebieskie = naroże; front u dołu)', [im]))
    o = Image.new('RGB', (W, sum(r.height for r in rows)), 'white'); y = 0
    for r in rows: o.paste(r, (0, y)); y += r.height
    o.save(os.path.join(OUT, 'exterior', f'{name}.png'))
    panels = []
    for lab in ('X', 'Y'):
        p = os.path.join(D, 'houses', name, 'overlay', f'{key[name][lab]}-plan-overlay.png')
        if os.path.exists(p):
            im = Image.open(p).convert('RGB'); im.thumbnail((1250, 1250))
        else:
            im = Image.new('RGB', (1250, 600), 'white'); ImageDraw.Draw(im).text((40, 260), 'BRAK MODELU (nic do nałożenia)', fill='black', font=F)
        q = Image.new('RGB', (1270, im.height + 60), 'white'); ImageDraw.Draw(q).text((10, 10), f'WARIANT {lab}', fill='black', font=F); q.paste(im, (10, 55)); panels.append(q)
    Wd = Image.new('RGB', (2540, max(p.height for p in panels)), 'white')
    Wd.paste(panels[0], (0, 0)); Wd.paste(panels[1], (1270, 0))
    Wd.save(os.path.join(OUT, 'interior', f'{name}.png'))
json.dump(key, open(KEY, 'w'), indent=1)
print('packs:', sorted(key))
