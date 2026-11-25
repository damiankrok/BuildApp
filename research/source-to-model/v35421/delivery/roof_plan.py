#!/usr/bin/env python3
"""v3.54.21 — the roof of a model from above WITH ITS JOINTS, drawn from the model file alone (0 USD): every roof plane's
polygon (a parametric gable or flat roof as its rectangle and ridge), the walls' outline under it, and every roof edge
by kind — VALLEY red, RIDGE black, HIP dark blue, ABUTMENT orange (a lower roof against a wall), EAVE / VERGE grey. A model
whose roofs are not joined shows no red line: that is the picture's point. Heights at the ends of the valleys are written.

    /usr/bin/python3 -I roof_plan.py <model.json> <out.png> [title]
"""
import json, math, sys
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else ''
raw = json.load(open(src))
m = raw.get('model', raw)
W = 900
pts = []
for w in m.get('walls', []): pts += [(w['start']['x'], w['start']['z']), (w['end']['x'], w['end']['z'])]
for p in m.get('roofPlanes', []): pts += [(q['x'], q['z']) for q in p['boundary']]
for r in m.get('roofs', []):
    f = r['footprint']; pts += [(f['minX'], f['minZ']), (f['maxX'], f['maxZ'])]
if not pts:
    Image.new('RGB', (W, 200), 'white').save(out); sys.exit(0)
x0, x1 = min(p[0] for p in pts) - 1, max(p[0] for p in pts) + 1
z0, z1 = min(p[1] for p in pts) - 1, max(p[1] for p in pts) + 1
k = (W - 40) / max(x1 - x0, 1e-6)
H = int((z1 - z0) * k) + 90
im = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(im)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13); bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
except Exception: font = bold = ImageFont.load_default()
# the front (z = 0) at the foot of the picture, as a plan is drawn
P = lambda x, z: (20 + (x - x0) * k, H - 50 - (z - z0) * k)
shade = {(0, -1): (214, 208, 200), (0, 1): (188, 182, 174), (-1, 0): (201, 195, 187), (1, 0): (176, 170, 162)}
for p in m.get('roofPlanes', []):
    ds = (round(p['downslope']['x']), round(p['downslope']['z']))
    d.polygon([P(q['x'], q['z']) for q in p['boundary']], fill=shade.get(ds, (205, 200, 192)), outline=(150, 146, 140))
for r in m.get('roofs', []):
    f = r['footprint']
    if r['kind'] == 'FLAT':
        d.rectangle([P(f['minX'], f['maxZ']), P(f['maxX'], f['minZ'])], fill=(225, 225, 228), outline=(120, 120, 125))
        continue
    if r.get('ridgeAxis') == 'X':
        mid = (f['minZ'] + f['maxZ']) / 2
        d.polygon([P(f['minX'], f['minZ']), P(f['maxX'], f['minZ']), P(f['maxX'], mid), P(f['minX'], mid)], fill=shade[(0, -1)], outline=(150, 146, 140))
        d.polygon([P(f['minX'], mid), P(f['maxX'], mid), P(f['maxX'], f['maxZ']), P(f['minX'], f['maxZ'])], fill=shade[(0, 1)], outline=(150, 146, 140))
        d.line([P(f['minX'], mid), P(f['maxX'], mid)], fill=(0, 0, 0), width=3)
    else:
        mid = (f['minX'] + f['maxX']) / 2
        d.polygon([P(f['minX'], f['minZ']), P(mid, f['minZ']), P(mid, f['maxZ']), P(f['minX'], f['maxZ'])], fill=shade[(-1, 0)], outline=(150, 146, 140))
        d.polygon([P(mid, f['minZ']), P(f['maxX'], f['minZ']), P(f['maxX'], f['maxZ']), P(mid, f['maxZ'])], fill=shade[(1, 0)], outline=(150, 146, 140))
        d.line([P(mid, f['minZ']), P(mid, f['maxZ'])], fill=(0, 0, 0), width=3)
# exterior walls under the roofs (dashed look: thin blue)
for w in m.get('walls', []):
    if w.get('kind') == 'EXTERIOR': d.line([P(w['start']['x'], w['start']['z']), P(w['end']['x'], w['end']['z'])], fill=(70, 110, 190), width=1)
COL = {'VALLEY': ((210, 30, 30), 5), 'RIDGE': ((0, 0, 0), 3), 'HIP': ((30, 50, 140), 3), 'ABUTMENT': ((235, 140, 20), 4), 'ROOF_STEP': ((235, 140, 20), 4), 'EAVE': ((120, 120, 120), 1), 'VERGE': ((120, 120, 120), 1), 'BOUNDARY': ((120, 120, 120), 1)}
count = {}
for e in m.get('roofEdges', []):
    c, wd = COL.get(e['kind'], ((120, 120, 120), 1))
    d.line([P(e['start']['x'], e['start']['z']), P(e['end']['x'], e['end']['z'])], fill=c, width=wd)
    count[e['kind']] = count.get(e['kind'], 0) + 1
    if e['kind'] == 'VALLEY':
        for q in (e['start'], e['end']):
            x, y = P(q['x'], q['z']); d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=c); d.text((x + 6, y - 14), f"{q['y']:.2f} m", fill=c, font=font)
legend = f"kosze (VALLEY): {count.get('VALLEY', 0)}   kalenice: {count.get('RIDGE', 0) + sum(1 for r in m.get('roofs', []) if r['kind'] != 'FLAT')}   naroża (HIP): {count.get('HIP', 0)}   dojścia do ściany (ABUTMENT): {count.get('ABUTMENT', 0)}   dachy parametryczne: {len(m.get('roofs', []))}   połacie: {len(m.get('roofPlanes', []))}"
d.text((20, H - 42), legend, fill=(20, 20, 20), font=font)
d.text((20, H - 22), 'czerwone = kosz (obie połacie na jednej wysokości), pomarańczowe = niższy dach dochodzi do ściany, czarne = kalenica; front u dołu', fill=(90, 90, 90), font=font)
if title: d.text((20, 6), title, fill=(20, 20, 20), font=bold)
im.save(out)
print(out, legend)
