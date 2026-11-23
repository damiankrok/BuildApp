#!/usr/bin/env python3
"""Export a package's drawings from the byte cache as PNG files + one contact sheet (private; outside the repo).
   export_sources.py <package.json> <cache dir> <out dir>"""
import hashlib, io, json, os, sys
from PIL import Image, ImageDraw
pkg, cache, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
p = json.load(open(pkg))
tiles = []
index = []
for a in p['assets']:
    r = a['roles']
    if r['document'] not in ('ELEVATION', 'FLOOR_PLAN', 'SECTION', 'VISUALIZATION', 'SITE_PLAN') and r['projection'] not in ('PERSPECTIVE',):
        continue
    v = next((x for x in a['variants'] if x['id'] == a.get('selectedVariantId')), a['variants'][0])
    path = None
    for key in (hashlib.sha256(v['url'].encode()).hexdigest()[:32],):
        for ext in ('.bin', ''):
            q = os.path.join(cache, key + ext)
            if os.path.exists(q): path = q
    if not path:
        index.append({'asset': a['id'], 'roles': r, 'missing': True}); continue
    try:
        im = Image.open(path); im.load(); im = im.convert('RGB')
    except Exception as e:
        index.append({'asset': a['id'], 'roles': r, 'undecodable': str(e)[:80]}); continue
    name = f"{r['document']}-{r['view']}-{r['storey']}-{a['id'][-10:]}.png".replace('NOT_APPLICABLE', 'na').replace('UNKNOWN', 'unk')
    im.save(os.path.join(out, name))
    index.append({'asset': a['id'], 'file': name, 'roles': r, 'size': im.size, 'caption': a.get('caption', '')[:80], 'byteHash': v.get('byteHash')})
    t = im.copy(); t.thumbnail((620, 460))
    tiles.append((f"{r['document']} {r['view']} {r['storey']} {im.size[0]}x{im.size[1]}", t))
json.dump(index, open(os.path.join(out, 'index.json'), 'w'), indent=1)
cols = 3
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 640, rows * 490), 'white')
d = ImageDraw.Draw(sheet)
for i, (label, t) in enumerate(tiles):
    x, y = (i % cols) * 640 + 10, (i // cols) * 490 + 8
    d.text((x, y), label, fill='black')
    sheet.paste(t, (x, y + 16))
sheet.save(os.path.join(out, 'contact.png'))
print(len(tiles), 'tiles', [i for i in index if i.get('missing') or i.get('undecodable')][:3])
