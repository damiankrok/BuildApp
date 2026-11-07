# v3.45: view annotations (developer, non-blind) from roles-<split>.txt + frames/<house>.json -> labels/views-<split>.json
import json, sys, collections
split = sys.argv[1]
CLS = {'X': ('EXTERIOR_PERSPECTIVE', None, None), 'I': ('INTERIOR_PERSPECTIVE', None, None), 'O': ('OTHER', None, None),
       'G': ('FLOOR_PLAN', 'GROUND', None), 'U': ('FLOOR_PLAN', 'UPPER', None), 'A': ('FLOOR_PLAN', 'ATTIC', None),
       'B': ('FLOOR_PLAN', 'BASEMENT', None), 'P': ('ROOF_PLAN', None, None),
       'F': ('ORTHOGRAPHIC_ELEVATION', None, 'FRONT'), 'R': ('ORTHOGRAPHIC_ELEVATION', None, 'REAR'),
       'S': ('ORTHOGRAPHIC_ELEVATION', None, 'SIDE'), 'E': ('ORTHOGRAPHIC_ELEVATION', None, 'UNDECIDED'),
       'C': ('TECHNICAL_SECTION', None, None), 'T': ('SITE_PLAN', None, None), '?': ('UNDECIDED', None, None)}
rows = []
for line in open(f'/home/user/rd/labels/roles-{split}.txt'):
    p = line.split()
    if not p: continue
    house = p[0]; fr = json.load(open(f'/home/user/rd/frames/{house}.json'))
    lab = dict(t.split(':') for t in p[1:])
    assert len(lab) == len(fr), (house, len(lab), len(fr))
    for i, f in enumerate(fr):
        c = lab[str(i)]; illegible = c.endswith('!'); c = c.rstrip('!')
        cl, st, side = CLS[c]
        rows.append({'project': house, 'split': split.upper(), 'sha256': f['sha256'], 'assetId': f['assetId'], 'url': f['url'],
                     'view': {'class': cl, 'storey': st, 'side': side, 'legible': not illegible},
                     'basis': 'image content (contact sheet, full size where needed)',
                     'annotator': 'developer (non-blind: knew the DEV houses from earlier stages)'})
json.dump({'schema': 'buildapp.reading-annotations.views/1', 'rows': rows}, open(f'/home/user/rd/labels/views-{split}.json', 'w'), indent=1)
print(len(rows), collections.Counter(r['view']['class'] for r in rows))
