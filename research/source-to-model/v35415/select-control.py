#!/usr/bin/env python3
"""v3.54.15 — applies CONTROL_SELECTION.md (the v3.54.14 rule, its own seed and exclusions) as written: seeded walk over the pool, acquisition only, the acceptance
rules on the inventory and the page's facts. Writes selection.json (every opened candidate and its reason).
    /usr/bin/python3 -I research/source-to-model/v35414/select-new-house.py <base sha> <work dir>
"""
import hashlib, json, os, re, subprocess, sys
base, work = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
pool = [l.strip() for l in open(os.path.join(here, '../v35414/lipinscy-pool.txt')) if l.strip()]
seen = {l.strip() for l in open(os.path.join(here, 'control-excluded.txt')) if l.strip()}
fam = lambda name: re.sub(r'-(i|ii|iii|iv|v|vi|vii|viii|ix|x)$', '', name)
excluded = {fam(s) for s in seen}
seed = hashlib.sha256(f'{base}:V35415-CONTROL'.encode()).hexdigest()
start = int(seed, 16) % len(pool)
out = {'seed': seed, 'start': start, 'poolSize': len(pool), 'opened': [], 'chosen': None}
os.makedirs(work, exist_ok=True)
opened = 0
for step in range(len(pool)):
    url = pool[(start + step) % len(pool)]
    name = url.rstrip('/').split('/')[-1]
    if fam(name) in excluded:
        out['opened'].append({'url': url, 'opened': False, 'refused': f'family {fam(name)} excluded (seen in development)'})
        continue
    if opened >= 25: break
    opened += 1
    pkg = os.path.join(work, f'{name}.package.json')
    r = subprocess.run(['npx', 'vite-node', 'packages/source-package/scripts/acquire.ts', '--', url.rstrip('/'), '--out', pkg, '--cache', os.path.join(work, 'cache'), '--quiet'], capture_output=True, text=True, timeout=600)
    if r.returncode != 0 or not os.path.exists(pkg):
        out['opened'].append({'url': url, 'opened': True, 'refused': 'acquisition failed: ' + (r.stderr or r.stdout)[-300:]}); continue
    p = json.load(open(pkg))
    roles = [a['roles'] for a in p['assets']]
    facts = {f['key']: f.get('value') for f in p.get('publishedFacts', [])}
    desc = ' '.join(s.get('text', '') for s in (p.get('publishedSpecifications') or []) if s.get('key') == 'description').lower()
    views = {r['view'] for r in roles if r['document'] == 'ELEVATION'}
    has = lambda doc, **kw: any(r['document'] == doc and all(r[k] == v for k, v in kw.items()) for r in roles)
    upper_named = bool(re.search(r'piętr|poddasze użytkowe|dwukondygnac', desc))
    why = []
    if not has('SECTION'): why.append('no section')
    if not {'FRONT', 'REAR', 'SIDE_LEFT', 'SIDE_RIGHT'} <= views: why.append(f'elevations {sorted(views)}')
    if not has('FLOOR_PLAN', storey='GROUND'): why.append('no ground-floor plan')
    if upper_named and not has('FLOOR_PLAN', storey='UPPER'): why.append('a storey above is named but no upper plan')
    fa, pitch = facts.get('footprint_area'), facts.get('roof_pitch')
    if fa is None or fa > 160: why.append(f'footprint {fa}')
    if pitch is None or pitch < 20: why.append(f'roof pitch {pitch}')
    if 'dwuspadow' not in desc: why.append('no gable roof named')
    if 'garaż' in desc: why.append('a garage named')
    for w in ('wielospadow', 'kopertow', 'płaski'):
        if w in desc: why.append(f'"{w}" named')
    entry = {'url': url, 'opened': True, 'packageId': p['id'], 'contentHash': p['contentHash'], 'pageHash': p.get('pageHash'), 'assets': len(p['assets']), 'facts': facts, 'elevationViews': sorted(views), 'upperNamed': upper_named, 'refused': '; '.join(why) or None}
    out['opened'].append(entry)
    print(name, '->', entry['refused'] or 'ACCEPTED', flush=True)
    if not why:
        out['chosen'] = entry; break
    else:
        os.remove(pkg)
json.dump(out, open(os.path.join(work, 'selection.json'), 'w'), indent=1, ensure_ascii=False)
print('chosen:', out['chosen'] and out['chosen']['url'])
