# v3.45: PRZED | PO overlays on every annotated section (originals, private), and room-number sheets.
import json, os, sys, subprocess
from PIL import Image
R = '/home/user/rd'; T = f'{R}/tools/overlay.py'
po = sys.argv[1] if len(sys.argv) > 1 else f'{R}/po2'
out = f'{R}/overlays'
for split, przed in (('dev', f'{R}/links/przed-dev'), ('eval', f'{R}/eval')):
    views = json.load(open(f'{R}/labels/views-{split}.json'))['rows']
    lines = {l.split()[0]: l.strip() for l in open(f'{R}/labels/levels-{split}.txt') if l.strip() and not l.startswith('#')}
    for p, line in lines.items():
        secs = [r for r in views if r['project'] == p and r['view']['class'] == 'TECHNICAL_SECTION']
        if not secs: continue
        fr = {f['sha256']: f['path'] for f in json.load(open(f'{R}/frames/{p}.json'))}
        for r in secs[:1]:
            img = fr.get(r['sha256'])
            if not img: continue
            panels = []
            for tag, runs in (('PRZED', przed), ('PO', po)):
                ev = f'{runs}/{p}/metric-evidence.json'
                if not os.path.exists(ev): continue
                o = f'{out}/_{tag}.png'
                subprocess.run(['/usr/bin/python3', T, 'section', img, ev, r['sha256'], line, o], check=True)
                im = Image.open(o); panels.append((tag, im))
            if len(panels) != 2: continue
            W = Image.new('RGB', (sum(i.width for _, i in panels) + 10, max(i.height for _, i in panels)), (255, 255, 255))
            x = 0
            for _, i in panels: W.paste(i, (x, 0)); x += i.width + 10
            W.save(f'{out}/section-{split}-{p[:40]}.png'); print('ok', split, p[:40])
