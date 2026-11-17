#!/usr/bin/env python3
"""v3.54.5 — where a board draws the detailed scorer's verdicts: for one house and one run, the scorer's rows with the
place of each marker (the model's hole; for a MISSING opening, the place the SOURCE has it). Reads the scorer's output;
scores nothing.   marks.py <score json> <house> <run name> <reference json> <run dir> <out json>"""
import importlib.util, json, os, sys
spec = importlib.util.spec_from_file_location('sd', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'score-detail.py'))
sd = importlib.util.module_from_spec(spec); spec.loader.exec_module(sd)
score, house, run, refp, rundir, out = sys.argv[1:7]
x = json.load(open(score))['houses'][house][run]
ref = sd.ref_openings(json.load(open(refp)))
mp = os.path.join(rundir, 'measured-v3545.json')
holes = {o['id']: o for o in (json.load(open(mp)).get('openings') or [])} if os.path.exists(mp) else {}
objs = (json.load(open(mp)).get('objects') or {}) if os.path.exists(mp) else {}
W = json.load(open(mp)).get('exteriorWalls') if os.path.exists(mp) else None
for r in x.get('rows', []):
    o = holes.get(r.get('scene'))
    if o is not None and o.get('alongM') is not None:
        r['markAlongM'] = o['alongM'] + o['widthM'] / 2; r['markY'] = o['bottomY'] + o['heightM'] / 2
    elif o is not None and W and r.get('scene') in objs:
        b = objs[r['scene']]; s = r['side']
        along = b['x0'] - W['x0'] if s == 'FRONT' else W['x1'] - b['x1'] if s == 'REAR' else W['z1'] - b['z1'] if s == 'LEFT' else b['z0'] - W['z0']
        width = (b['x1'] - b['x0']) if s in ('FRONT', 'REAR') else (b['z1'] - b['z0'])
        r['markAlongM'] = along + width / 2; r['markY'] = o['bottomY'] + o['heightM'] / 2
    else:
        q = next((q for q in ref[r['side']]['openings'] if q['id'] == r.get('ref')), None)
        if q and 'alongM' in q:
            r['markAlongM'] = q['alongM'] + q['widthM'] / 2; r['markY'] = q['bottomY'] + q['heightM'] / 2
json.dump(x, open(out, 'w'), indent=1)
