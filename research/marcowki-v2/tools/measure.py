#!/usr/bin/env python3
"""Consolidated forensic scans behind MARCOWKI_SOURCE_TRUTH_V2 (evaluation tooling; never imported by production).

Usage: python3 research/marcowki-v2/tools/measure.py <source-package.json> <byte-cache-dir> <work-dir>

1. decodes every variant of the package from the byte cache into <work-dir>/src-images/<w>x<h>-<slug>.png
   (the same decode the atlas uses, so the pixel locators in the truth JSON refer to these files),
2. runs the four scan scripts in tools/scans/ with MARCOWKI_IMG_DIR pointing at that directory:
   plans.py   - chain frames, wall bands and gaps of the two dimensioned 853 px plans
   plans2.py  - outer-wall gap scans (openings), return stubs in the 100 zones, internal wall histograms, stair ladders
   section.py - datum rows, roof lines, garage roof, stair steps on the section
   elev.py    - material-class row/column scans of the four 1280 px renders (bands, returns, verge, fascias, openings)
Each script prints its measurements; the numbers quoted in the truth set are these prints, corrected for the scan
origins noted in the scripts. Nothing here reads packages/reference-marcowki.
"""
import io, json, os, subprocess, sys
from PIL import Image
pkg, cache, work = sys.argv[1], sys.argv[2], sys.argv[3]
img_dir = os.path.join(work, 'src-images'); os.makedirs(img_dir, exist_ok=True)
P = json.load(open(pkg))
n = 0
for a in P['assets']:
    for v in a['variants']:
        h = v.get('byteHash') or v.get('hash')
        if not h: continue
        cand = [os.path.join(cache, h + '.bin'), os.path.join(cache, h[:32] + '.bin')]
        src = next((c for c in cand if os.path.exists(c)), None)
        if not src: continue
        try:
            im = Image.open(io.BytesIO(open(src, 'rb').read())).convert('RGB')
        except Exception:
            continue
        slug = os.path.splitext(os.path.basename(v.get('url', a['id'])))[0][:70]
        out = os.path.join(img_dir, f'{im.width}x{im.height}-{slug}.png')
        if not os.path.exists(out): im.save(out)
        n += 1
print(f'decoded {n} variants into {img_dir}')
env = dict(os.environ, MARCOWKI_IMG_DIR=img_dir)
here = os.path.dirname(os.path.abspath(__file__))
for s in ('plans.py', 'plans2.py', 'section.py', 'elev.py'):
    print(f'\n===== {s} =====')
    subprocess.run([sys.executable, os.path.join(here, 'scans', s)], env=env, check=False)
