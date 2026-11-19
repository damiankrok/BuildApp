#!/usr/bin/env python3
"""v3.54.16 §7 — the sketch delivery: sketches/<house>/{FRONT,REAR,LEFT,RIGHT}.{png,svg,json} with raw/, normalized/,
rejected/ (reason codes) and MISSING_SOURCE.json, from a run's checked sketches (run/sketches*, verdict per property) and,
for a side the run did not sketch, the sketch-only read (UNCHECKED). Publisher pictures are copied to sources/<house>/
for the boards and the gallery (private ZIP only, never Git).
    /usr/bin/python3 -I assemble-sketches.py <out dir> <house>=<run dir or ->,<sketch-only dir or ->,<package.json>,<cache dir> …
"""
import hashlib, json, os, re, shutil, sys

out, *specs = sys.argv[1:]
SIDE_OF = {'FRONT': 'FRONT', 'EAST': 'RIGHT', 'REAR': 'REAR', 'WEST': 'LEFT'}
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
CODES = [(r'^not a polygon', 'NOT_A_POLYGON'), (r'outside the picture', 'OUTSIDE_PICTURE'), (r'^unknown form', 'UNKNOWN_FORM'), (r'^class ', 'UNKNOWN_CLASS'), (r'^kind .* read as OTHER', 'KIND_READ_AS_OTHER'), (r'^kind ', 'UNKNOWN_KIND'), (r"roof's own polygon", 'ROOF_POLYGON_AS_WALL'), (r'wrong type', 'WRONG_FIELD_TYPE'), (r'^not a list', 'NOT_A_LIST')]
code = lambda why: next((c for p, c in CODES if re.search(p, why or '')), 'OTHER')
index = {'schema': 'buildapp.sketch-delivery.v35416', 'houses': {}}

for spec in specs:
    house, rest = spec.split('=', 1)
    run, only, pkgp, cache = rest.split(',')
    d = os.path.join(out, 'sketches', house)
    for sub in ('raw', 'normalized', 'rejected'): os.makedirs(os.path.join(d, sub), exist_ok=True)
    src = os.path.join(out, 'sources', house); os.makedirs(src, exist_ok=True)
    pkg = json.load(open(pkgp))
    byhash = {v['byteHash']: v for a in pkg['assets'] for v in a['variants']}
    def copy_source(byte_hash, side):
        v = byhash.get(byte_hash)
        if not v: return None
        p = os.path.join(cache, hashlib.sha256(v['url'].encode()).hexdigest()[:32] + '.bin')
        if not os.path.exists(p): return None
        ext = '.png' if open(p, 'rb').read(4) == b'\x89PNG' else '.jpg'
        dst = os.path.join(src, side + ext); shutil.copyfile(p, dst); return os.path.relpath(dst, out)
    checked = {}
    if run != '-' and os.path.exists(os.path.join(run, 'sketches.json')):
        s = json.load(open(os.path.join(run, 'sketches.json')))
        g = json.load(open(os.path.join(run, 'observation-graph.json')))
        frames = {f['id']: f for f in g['coordinateFrames']}
        for x in s['reading']['sketches']:
            side = SIDE_OF[x['facade']]
            checked[side] = {'facade': x['facade'], 'frame': frames.get(x['frameId']), 'x': x}
    onlysum = {}
    if only != '-' and os.path.exists(os.path.join(only, 'summary.json')):
        for e in json.load(open(os.path.join(only, 'summary.json')))['summary']: onlysum[e['side']] = e
    rows, missing = [], []
    for side in SIDES:
        row = {'side': side}
        if side in checked and checked[side]['x'].get('sketch'):
            c = checked[side]; x = c['x']; check = x.get('check') or {}
            base = os.path.join(run, 'sketches', c['facade'])
            for ext in ('png', 'svg'): shutil.copyfile(f'{base}.{ext}', os.path.join(d, f'{side}.{ext}'))
            raw = os.path.join(run, 'sketches', 'raw', f"{c['facade']}.json")
            if os.path.exists(raw): shutil.copyfile(raw, os.path.join(d, 'raw', f'{side}.json'))
            sketch = x['sketch']; verdict = check.get('verdict', 'NONE'); props = check.get('properties'); why = check.get('why', '')
            row.update({'origin': 'RUN_CHECKED', 'facade': c['facade'], 'frameId': x['frameId'], 'verdict': verdict, 'properties': props, 'why': why})
            row['source'] = copy_source(c['frame']['variantByteHash'], side) if c['frame'] else None
        elif side in onlysum and onlysum[side].get('status') == 'UNCHECKED':
            e = onlysum[side]
            for ext in ('png', 'svg'): shutil.copyfile(os.path.join(only, f'{side}.{ext}'), os.path.join(d, f'{side}.{ext}'))
            if os.path.exists(os.path.join(only, 'raw', f'{side}.json')): shutil.copyfile(os.path.join(only, 'raw', f'{side}.json'), os.path.join(d, 'raw', f'{side}.json'))
            sketch = json.load(open(os.path.join(only, f'{side}.json')))['sketch']
            why = ('the run registered no view of this side' if run != '-' else 'LOCAL built no model, so no view was registered') + '; read directly from the labelled elevation; nothing to check its proportions against'
            if e.get('sideNote'): why += '; ' + e['sideNote']
            row.update({'origin': 'SKETCH_ONLY', 'frameId': e['assetId'], 'verdict': 'UNCHECKED', 'properties': None, 'why': why, 'source': copy_source(e['sourceByteHash'], side)})
        else:
            reason = (onlysum.get(side) or {}).get('why') or (checked.get(side, {}).get('x', {}).get('failed')) or 'no elevation of this side in the source'
            row.update({'origin': 'NONE', 'verdict': 'MISSING_SOURCE' if side not in checked and (onlysum.get(side) or {}).get('status', 'MISSING_SOURCE') == 'MISSING_SOURCE' else 'FAILED', 'why': reason})
            missing.append({'side': side, 'status': row['verdict'], 'why': reason}); rows.append(row); continue
        acc = sketch.get('account') or {}
        json.dump({'side': side, 'verdict': row['verdict'], 'properties': row.get('properties'), 'why': row['why'], 'sketch': sketch}, open(os.path.join(d, f'{side}.json'), 'w'), indent=1)
        json.dump(sketch, open(os.path.join(d, 'normalized', f'{side}.json'), 'w'), indent=1)
        refused = [{'path': e['path'], 'part': e['part'], 'form': e['form'], 'code': code(e.get('reason')), 'reason': e.get('reason')} for e in acc.get('elements', []) if e.get('fate') == 'REFUSED']
        normalized = [e['path'] for e in acc.get('elements', []) if e.get('fate') == 'NORMALIZED']
        json.dump({'side': side, 'sketchVerdict': row['verdict'], 'sketchRejected': row['verdict'] == 'REJECTED', 'why': row['why'] if row['verdict'] == 'REJECTED' else None, 'refusedElements': refused, 'normalizedElements': normalized, 'completeness': acc.get('completeness'), 'response': acc.get('response')}, open(os.path.join(d, 'rejected', f'{side}.json'), 'w'), indent=1)
        row.update({'refused': len(refused), 'normalized': len(normalized), 'completeness': acc.get('completeness'), 'counts': {k: len(sketch.get(k) or []) for k in ('walls', 'openings', 'roofs', 'elements')}})
        rows.append(row)
    if missing: json.dump({'house': house, 'missing': missing}, open(os.path.join(d, 'MISSING_SOURCE.json'), 'w'), indent=1)
    index['houses'][house] = rows
    print(house, ' '.join(f"{r['side']}:{r['verdict']}" for r in rows))
json.dump(index, open(os.path.join(out, 'sketches', 'index.json'), 'w'), indent=1)
