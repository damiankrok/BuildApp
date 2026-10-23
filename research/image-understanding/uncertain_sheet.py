"""IU-01: contact sheet of the images the final system (C2) did not ACCEPT correctly — UNKNOWN, REVIEW and wrong
ACCEPTs — from results/per-image.json, per evaluation set. Pixels: written outside the repository only."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iu.paths import refuse_inside_repo
WORK = os.environ.get('IU_WORK', '/home/user/workiu01')
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(WORK, 'results', 'uncertain')
refuse_inside_repo(out, 'contact sheets of source images')
from PIL import Image, ImageDraw
from iu.backbones import open_image
dirs = ['/home/user/work005r/corpus/images', os.path.join(WORK, 'derived'), os.path.join(WORK, 'synth005r'), os.path.join(WORK, 'commons')]
index = {}
for d in dirs:
    if os.path.isdir(d):
        for f in os.listdir(d):
            index.setdefault(f.split('.')[0], os.path.join(d, f))
recs = json.load(open(os.path.join(WORK, 'results', 'per-image.json')))
os.makedirs(out, exist_ok=True)
COLOR = {'ACCEPT': (200, 30, 30), 'REVIEW': (220, 140, 0), 'UNKNOWN': (90, 90, 200)}
for s in sorted({r['set'] for r in recs}):
    sel = [r for r in recs if r['set'] == s and not (r['decision'] == 'ACCEPT' and r['predicted'] == r['truth'])]
    if not sel:
        continue
    T, cols = 240, 6
    rows = (len(sel) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * T, rows * (T + 40)), 'white'); d = ImageDraw.Draw(sheet)
    for i, r in enumerate(sel):
        p = index.get(r['inputSha256'])
        x, y = (i % cols) * T, (i // cols) * (T + 40)
        if p:
            im = open_image(p); im.thumbnail((T - 8, T - 8)); sheet.paste(im, (x + 4, y + 4))
        c = COLOR[r['decision']]
        d.rectangle([x + 1, y + 1, x + T - 2, y + T + 38], outline=c, width=3)
        d.text((x + 6, y + T - 4), f"{r['decision']} {r['predicted'][:18]} {r['calibratedConfidence']}", fill=c)
        d.text((x + 6, y + T + 10), f"truth {r['truth'][:20]}", fill=(40, 40, 40))
        d.text((x + 6, y + T + 22), (' '.join(x_ for x_ in r['reason'] if x_ != 'CONFIDENT'))[:40], fill=(110, 110, 110))
    sheet.save(os.path.join(out, f'{s}.jpg'), quality=85)
    print(s, len(sel))
