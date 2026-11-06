"""E13: per changed exterior opening, the PRZED and PO evidence the models carry (callout printed or not, provenance of
height/sill/kind), so each change can be judged against the source. Usage: opening-evidence.py PRZED_ROOT PO_ROOT out.json"""
import json, os, sys, importlib.util
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('regress', os.path.join(here, 'regress.py'))
R = importlib.util.module_from_spec(spec); spec.loader.exec_module(R)
ra, rb, out = sys.argv[1:4]
rows = []
for h in sorted(os.listdir(rb)):
    a, b = os.path.join(ra, h), os.path.join(rb, h)
    if not (os.path.isfile(os.path.join(a, 'model.json')) and os.path.isfile(os.path.join(b, 'model.json'))): continue
    ma, mb = json.load(open(os.path.join(a, 'model.json'))), json.load(open(os.path.join(b, 'model.json')))
    ev = lambda m: {o['id']: o.get('evidence', {}) for o in m['openings']}
    eva, evb = ev(ma), ev(mb)
    oa, ob = R.openings(ma), R.openings(mb)
    used = set()
    for o in oa:
        c = [(abs(p['at'] - o['at']), i) for i, p in enumerate(ob) if i not in used and p['side'] == o['side'] and p['level'] == o['level'] and abs(p['at'] - o['at']) <= R.MATCH_M]
        p = None
        if c:
            _, i = min(c); used.add(i); p = ob[i]
        same = p and p['kind'] == o['kind'] and all(abs(p[k] - o[k]) <= R.DIM_M for k in ('w', 'h', 'sill'))
        if same: continue
        rows.append({'house': h, 'side': o['side'], 'level': o['level'], 'at': o['at'], 'przed': {k: o[k] for k in ('id', 'kind', 'w', 'h', 'sill')}, 'po': ({k: p[k] for k in ('id', 'kind', 'w', 'h', 'sill')} if p else None),
                     'przedWhy': eva[o['id']].get('interpretation', ''), 'przedProps': eva[o['id']].get('properties', {}), 'poWhy': evb[p['id']].get('interpretation', '') if p else '', 'poProps': evb[p['id']].get('properties', {}) if p else {}})
    for i, p in enumerate(ob):
        if i not in used:
            rows.append({'house': h, 'side': p['side'], 'level': p['level'], 'at': p['at'], 'przed': None, 'po': {k: p[k] for k in ('id', 'kind', 'w', 'h', 'sill')}, 'przedWhy': '', 'przedProps': {}, 'poWhy': evb[p['id']].get('interpretation', ''), 'poProps': evb[p['id']].get('properties', {})})
json.dump(rows, open(out, 'w'), indent=1)
print(len(rows))
