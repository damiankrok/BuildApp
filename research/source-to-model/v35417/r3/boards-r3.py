#!/usr/bin/env python3
"""v3.54.17 R3 — the before/after board of one run from what boards-r3.ts wrote: per elevation of the source a row
(original | sketch from the real read | LOCAL before | delivered), the model's tile chosen by the side the run REGISTERED
that elevation as (an elevation the publisher labels "front" may stand on the model's right: Alaska is turned).
   /usr/bin/python3 -I boards-r3.py <boards dir> <house> <run dir>"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

_TTF = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT = ImageFont.truetype(_TTF, 14) if os.path.exists(_TTF) else ImageFont.load_default()
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
H = 240


def fit(path, w):
    if not path or not os.path.exists(path):
        im = Image.new('RGB', (w, H), (236, 236, 236))
        ImageDraw.Draw(im).text((8, 8), 'brak', fill=(60, 60, 60), font=FONT)
        return im
    im = Image.open(path).convert('RGB')
    k = min(H / im.height, w / im.width)
    im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))))
    out = Image.new('RGB', (w, H), (255, 255, 255))
    out.paste(im, ((w - im.width) // 2, (H - im.height) // 2))
    return out


def tile(sides_png, side):
    if not sides_png or not os.path.exists(sides_png) or side not in SIDES:
        return None
    im = Image.open(sides_png).convert('RGB')
    t = im.width // 4
    i = SIDES.index(side)
    p = sides_png.replace('-SIDES.png', f'-{side}.png')
    im.crop((i * t, 0, (i + 1) * t, im.height)).save(p)
    return p


def main(root, house, run):
    d = os.path.join(root, house)
    idx = json.load(open(os.path.join(d, 'index.json')))
    reg = {}
    for e in json.load(open(os.path.join(run, 'events.json'))):
        if e.get('kind') == 'SKETCH_REGISTRATION' and e.get('status') == 'REGISTERED':
            reg[e['frameId']] = e['side']
    rows = []
    for s in idx['sides']:
        if s.get('status') != 'SKETCHED':
            continue
        side = reg.get(s.get('frameId'))
        label = f"elewacja „{s['side']}” → strona modelu {side or 'nie zarejestrowana'}"
        b = tile(os.path.join(d, idx['before']), side) if idx.get('before') else None
        f = tile(os.path.join(d, idx['final']), side) if idx.get('final') else None
        rows.append((label, [fit(os.path.join(d, s['source']) if s.get('source') else None, 420), fit(os.path.join(d, s['sketch']) if s.get('sketch') else None, 420), fit(b, 300), fit(f, 300)]))
    W = 10 + 420 + 10 + 420 + 10 + 300 + 10 + 300 + 10
    out = Image.new('RGB', (W, 34 + len(rows) * (H + 30)), (255, 255, 255))
    dr = ImageDraw.Draw(out)
    x = 10
    for t, w in [('źródło (oryginał)', 420), ('szkic z prawdziwego odczytu', 420), ('przed korektą (LOCAL)' if idx.get('before') else 'przed korektą: LOCAL odmówił', 300), ('dostarczony model', 300)]:
        dr.text((x, 8), t, fill=(0, 0, 0), font=FONT)
        x += w + 10
    y = 34
    for label, cells in rows:
        dr.text((10, y), label, fill=(0, 0, 0), font=FONT)
        x = 10
        for c in cells:
            out.paste(c, (x, y + 22))
            x += c.width + 10
        y += H + 30
    p = os.path.join(d, f'{house}-board-r3.png')
    out.save(p, optimize=True)
    print(p, len(rows))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
