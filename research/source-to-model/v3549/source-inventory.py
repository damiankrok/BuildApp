#!/usr/bin/env python3
"""v3.54.9 — the source inventory of one run: every picture of the source package, its role and storey, its size as
sent to each reading step, and what the run took from it.

    /usr/bin/python3 -I research/source-to-model/v3549/source-inventory.py <source-package.json> <run dir> <out.json>

<run dir> holds `answers/*.json` (each step's record: the pictures it sent, with their sent size and byte hash) and
`observations.json` (the pictures the description kept, with their original size and reduction). Not sent is not absent:
a picture the package has and no step sent is listed as NOT_SENT with its role.
"""
import glob
import json
import os
import sys

pkg, run, out = sys.argv[1:4]
sp = json.load(open(pkg))
steps = {}
for f in sorted(glob.glob(os.path.join(run, 'answers', '*.json'))):
    steps[os.path.basename(f)[:-5]] = json.load(open(f))
obs = json.load(open(os.path.join(run, 'observations.json')))
kept = {p['assetId']: p for p in (obs.get('pictures') or obs.get('source', {}).get('pictures') or [])}
o = obs.get('observations', {})
read_from = {}
for kind in ('outlines', 'elevations', 'dimensions', 'levels', 'roofs'):
    for x in o.get(kind, []):
        pid = x.get('picture')
        if pid:
            read_from.setdefault(pid, set()).add(kind)
rows = []
for a in sp['assets']:
    r = a['roles']
    sent = [{'step': k, 'width': p['sentWidth'], 'height': p['sentHeight'], 'sha256': p.get('sha256', '')} for k, s in steps.items() for p in s['pictures'] if p['assetId'] == a['id']]
    k = kept.get(a['id'])
    rows.append({
        'assetId': a['id'], 'document': r['document'], 'storey': r.get('storey'), 'view': r.get('view'),
        'picture': k['id'] if k else None, 'level': k.get('level') if k else None,
        'original': {'width': round(k['widthPx'] * k.get('reduction', 1)), 'height': round(k['heightPx'] * k.get('reduction', 1))} if k else None,
        'byteHash': k.get('byteHash') if k else None,
        'sent': sent, 'readInto': sorted(read_from.get(k['id'], [])) if k else [],
        'state': 'NOT_SENT' if not sent else ('READ' if k and read_from.get(k['id']) else 'SENT_NOT_READ' if not k else 'KEPT_NOT_READ'),
    })
json.dump({'package': sp.get('id'), 'pageHash': sp.get('pageHash'), 'steps': sorted(steps), 'pictures': rows}, open(out, 'w'), indent=1, ensure_ascii=False)
for x in rows:
    print(f"{x['document']:20s} {str(x['storey']):14s} {str(x['picture']):5s} {x['state']:15s} {','.join(s['step'] + ':' + str(s['width']) for s in x['sent'])[:70]:70s} read {','.join(x['readInto'])}")
