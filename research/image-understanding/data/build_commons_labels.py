"""IU-01: turn the anonymised-sheet labels of the Commons OOD set into data/labels-commons.json (text only: hash,
label, flags, licence and title from the Commons manifest — attribution facts, no pixels)."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from iu.classes import CODE
work = sys.argv[1]
idx = {it['idx']: it for it in json.load(open(os.path.join(work, 'commons-label-index.json')))}
man = {r['sha256']: r for r in json.load(open(os.path.join(work, 'commons', 'commons-manifest.json')))}
rows = []
for line in open(os.path.join(work, 'commons-labels-raw.txt')):
    if line.startswith('#') or not line.strip():
        continue
    p = line.split()
    it = idx[int(p[0])]
    m = man.get(it['sha'], {})
    rows.append({'sha256': it['sha'], 'file': os.path.basename(it['path']), 'label': CODE[p[1]], 'hard': 'h' in p[2:],
                 'labelStatus': 'DISPUTED' if '?' in p[2:] else 'CONFIRMED', 'labelSource': 'AGENT_VISUAL_PIXELS_ONLY',
                 'licence': m.get('licence'), 'title': m.get('title'), 'descriptionUrl': m.get('descriptionUrl')})
rows.sort(key=lambda r: r['sha256'])
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'labels-commons.json')
json.dump({'schema': 'iu01-labels-commons-v1', 'note': 'Wikimedia Commons, Public Domain / CC0 / CC BY / CC BY-SA only; labelled from anonymised sheets before any model was run on them; TEST_OOD only. DISPUTED = ambiguous (multi-view sheets, paintings, borderline section/elevation) and reported separately.', 'rows': rows}, open(out, 'w'), indent=0)
from collections import Counter
print(len(rows), Counter(r['label'] for r in rows), Counter(r['labelStatus'] for r in rows))
