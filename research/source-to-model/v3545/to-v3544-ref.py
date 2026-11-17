#!/usr/bin/env python3
"""v3.54.5 — a detailed reference (REFERENCE_FORMAT.md, version 1.1) as the reference the historical six-group scorer
of v3.54.4 reads (`research/source-to-model/v3544/score.ts`). Mechanical: counts and shares of what the detailed
reference already holds; nothing is added.   to-v3544-ref.py <detail dir> <out dir>"""
import json, os, sys
SIDES = ['FRONT', 'REAR', 'LEFT', 'RIGHT']
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for name in sorted(os.listdir(src)):
    if not name.endswith('.json'): continue
    d = json.load(open(os.path.join(src, name)))
    lv = d.get('levels') or {}
    garage = {'side': 'NONE', 'alongShare': None}
    sides = {}
    for s in SIDES:
        x = (d.get('sides') or {}).get(s) or {}
        pub = x.get('status') == 'PUBLISHED'
        ops = [o for o in (x.get('openings') or []) if o.get('kind') != 'ROOF_WINDOW']
        sides[s] = {'elevationPublished': pub, 'openingsGround': len([o for o in ops if int(o.get('level') or 0) == 0]) if pub else None, 'openingsUpper': len([o for o in ops if int(o.get('level') or 0) >= 1]) if pub else None,
                    'dormers': [{'kind': 'WALL' if 'WALL' in q.get('kind', '') or q.get('kind') == 'CROSS_GABLE' else 'ROOF', 'form': 'SHED' if q.get('kind') in ('SHED', 'BOX') else 'GABLE'} for q in (x.get('dormers') or [])],
                    'balconies': len([f for f in (x.get('otherFeatures') or []) if f.get('kind') == 'BALCONY']), 'roofWindows': len([o for o in (x.get('openings') or []) if o.get('kind') == 'ROOF_WINDOW'])}
        for o in ops:
            if o.get('kind') == 'GARAGE_DOOR' and garage['side'] == 'NONE' and x.get('wallRightPx') and x.get('wallLeftPx') is not None:
                w = x['wallRightPx'] - x['wallLeftPx']
                b = o['boxPx']
                a = sorted([(b['x0'] - x['wallLeftPx']) / w, (b['x1'] - x['wallLeftPx']) / w])
                garage = {'side': s, 'alongShare': [round(max(0, a[0]), 3), round(min(1, a[1]), 3)]}
    ref = {'house': d['house'], 'publisher': d.get('publisher') or '', 'url': d.get('url'), 'packageContentHash': d.get('packageContentHash'), 'reader': d.get('reader'), 'readOn': d.get('readOn'),
           'derivedFrom': 'buildapp.v3545.detail-reference (to-v3544-ref.py)', 'frontPlanEdge': d.get('frontPlanEdge'),
           'overall': {'widthM': (d.get('overall') or {}).get('widthM'), 'depthM': (d.get('overall') or {}).get('depthM'), 'basis': (d.get('overall') or {}).get('basis')},
           'heights': {'buildingHeightM': (d.get('heights') or {}).get('buildingHeightM'), 'ridgeAboveGroundFloorM': lv.get('ridgeAboveZeroM'), 'terrainBelowGroundFloorM': lv.get('terrainBelowZeroM')},
           'bodies': [{'name': b.get('name'), 'role': b.get('role'), 'roof': b.get('roof'), 'ridge': b.get('ridge'), 'levels': b.get('levels')} for b in (d.get('bodies') or [])],
           'garageDoor': garage, 'sides': sides, 'chimneys': d.get('chimneys')}
    json.dump(ref, open(os.path.join(out, name), 'w'), indent=1)
    print(name, 'garage', garage['side'], 'bodies', len(ref['bodies']), {s: (sides[s]['openingsGround'], sides[s]['openingsUpper'], len(sides[s]['dormers'])) for s in SIDES})
