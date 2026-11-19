#!/usr/bin/env python3
"""v3.54.16 §12 — decisions/<house>.json for the gallery: every executor record of a run (sketch channel and review
loop) with its status and its reason or measure, and the delivered revision's quality. Reads a run directory
(corrections.json + quality.json) or a host result (result.json with sourceCheck).
    /usr/bin/python3 -I decisions.py <delivery dir> <house>=<run dir or result.json> …"""
import json, os, sys
d, *specs = sys.argv[1:]
os.makedirs(os.path.join(d, 'decisions'), exist_ok=True)
for spec in specs:
    house, src = spec.split('=', 1)
    if src.endswith('.json'):
        sc = json.load(open(src)).get('sourceCheck') or {}
        records = [(r.get('stage', 'RUN'), x) for r in sc.get('correctionRuns') or [] for x in r.get('records') or []]
        quality = sc.get('quality')
    else:
        c = json.load(open(os.path.join(src, 'corrections.json')))
        records = [('SKETCH', x) for x in (c.get('sketchChannel') or {}).get('records') or []]
        records += [(r.get('stage', 'LOOK'), x) for r in c.get('runs') or [] for x in r.get('records') or []]
        quality = (json.load(open(os.path.join(src, 'quality.json'))) or {}).get('quality')
    rows = []
    for stage, x in records:
        why = x.get('why') or ''
        for k in ('gate', 'measure'):
            if isinstance(x.get(k), dict) and x[k].get('why'): why += ' | ' + x[k]['why']
        rows.append({'stage': stage, 'proposalId': x.get('proposalId', ''), 'operation': x.get('operation', ''), 'targetId': str(x.get('targetId', '')), 'status': x.get('status', ''), 'why': why})
    json.dump({'house': house, 'quality': quality, 'decisions': rows}, open(os.path.join(d, 'decisions', f'{house}.json'), 'w'), indent=1)
    print(house, len(rows), (quality or {}).get('state'))
