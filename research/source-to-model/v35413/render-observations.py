#!/usr/bin/env python3
"""v3.54.13 — a control preview of appearance observations: each region drawn in the product palette, as a flat
sketch (left) and over its source picture (right). It shows what LOCAL receives; nothing is read back from it.

    /usr/bin/python3 -I research/source-to-model/v35413/render-observations.py <observations.json> <out dir> FACADE=<source.png> …
"""
import json, os, sys
from PIL import Image, ImageDraw
obs = json.load(open(sys.argv[1])); out = sys.argv[2]
src = dict(a.split('=', 1) for a in sys.argv[3:])
PAL = {'LIGHT_RENDER': (236, 233, 226), 'DARK_RENDER': (70, 70, 72), 'TIMBER': (196, 140, 82), 'GLASS': (160, 190, 210), 'ROOF': (95, 90, 85), 'METAL': (140, 140, 140), 'UNKNOWN': (255, 0, 255), 'BACKGROUND': (255, 255, 255)}
os.makedirs(out, exist_ok=True)
for o in obs:
    f = o['facade']; W, H = o['source']['imageWidth'], o['source']['imageHeight']
    sk = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(sk)
    order = sorted(o['regions'], key=lambda r: -abs(sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(r['outline'], r['outline'][1:] + r['outline'][:1]))))
    for r in order:
        d.polygon([tuple(p) for p in r['outline']], fill=PAL.get(r['class'], (255, 0, 255)), outline=(30, 30, 30))
    if f in src:
        base = Image.open(src[f]).convert('RGB').resize((W, H))
        ov = Image.blend(base, sk, 0.55)
        dd = ImageDraw.Draw(ov)
        for r in order: dd.line([tuple(p) for p in r['outline']] + [tuple(r['outline'][0])], fill=(255, 0, 0), width=2)
        both = Image.new('RGB', (W * 2 + 10, H), 'white'); both.paste(sk, (0, 0)); both.paste(ov, (W + 10, 0))
    else:
        both = sk
    both.save(os.path.join(out, f'{f}.png'))
    print(f, len(o['regions']), [(r['regionId'], r['class'], r.get('hostHint'), r['visibility']) for r in o['regions']])
