#!/usr/bin/env python3
"""v3.54.17 — applies TRIAL_SELECTION.md as written: per publisher, a seeded walk over its pool, families seen before
skipped, acquisition only, the acceptance rules on the acquired package. Writes <work>/selection.json (every opened
candidate and its reason). No analysis and no request to a model happens here.
    /usr/bin/python3 -I research/source-to-model/v35417/trial/select-trial.py <freeze commit> <work dir>
"""
import hashlib, json, os, re, subprocess, sys
commit, work = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
seen = {l.strip() for l in open(os.path.join(here, 'seen-families.txt')) if l.strip()}
fam = lambda n: re.sub(r'(-(i|ii|iii|iv|v|vi|vii|viii|ix|x|\d+[a-z]?|g\d?e?|oze|t|n|p|a|b|duo|plus|lux|bis))+$', '', n.lower())
def family(url):
    n = url.rstrip('/').split('/')[-1]
    n = re.sub(r',\d+\.html$', '', n)
    n = re.sub(r'-m[0-9a-f]{10,}$', '', n)
    return fam(n)
out = {'commit': commit, 'rule': 'TRIAL_SELECTION.md', 'publishers': {}}
# v3.54.17: the ARCHON pool is exhausted by the exclusions, so the Studio Atrium walk gives both families (TRIAL_SELECTION.md)
want = {'studioatrium': 2, 'lipinscy': 2, 'archon': 2, 'dobredomy': 2}
# v3.54.19 R2 (NEW-F): a second, later walk — its own seed label and one accepted house a pool (environment, default = the first walk)
LABEL = os.environ.get('TRIAL_LABEL', 'V35419-TRIAL')
if os.environ.get('TRIAL_WANT'): want = {k: int(os.environ['TRIAL_WANT']) for k in want}
os.makedirs(work, exist_ok=True)
POOLS = (('studioatrium', 'studioatrium-pool.txt'), ('lipinscy', 'lipinscy-pool.txt'), ('archon', 'archon-pool.txt'), ('dobredomy', 'dobredomy-pool.txt'))
# v3.54.19 correction before any analysis: `select.py <commit> <work> archon=archon-pool-2.txt` walks one publisher's replaced pool
if len(sys.argv) > 3: POOLS = tuple(tuple(a.split('=')) for a in sys.argv[3:])
for publisher, pool_file in POOLS:
    pool = [l.strip() for l in open(os.path.join(here, pool_file)) if l.strip()]
    seed = hashlib.sha256(f'{commit}:{LABEL}:{publisher}'.encode()).hexdigest()
    start = int(seed, 16) % len(pool)
    rec = {'seed': seed, 'start': start, 'poolSize': len(pool), 'opened': [], 'chosen': None}
    opened = 0
    for step in range(len(pool)):
        url = pool[(start + step) % len(pool)]
        core = lambda u: '-'.join(t for t in family(u).split('-') if not re.fullmatch(r'(i|ii|iii|iv|v|vi|vii|viii|ix|x|\d+[a-z]?|bis|sz|oze|t|n|p|a|b|duo|plus|lux|g\d?[a-z]?e?)', t))
        if any(core(url) == core(a) for a in rec.get('accepted', [])):
            rec['opened'].append({'url': url, 'opened': False, 'refused': f'a variant of the accepted family {core(url)}'})
            continue
        if family(url) in seen or core(url) in seen:
            rec['opened'].append({'url': url, 'opened': False, 'refused': f'family {family(url)} seen before'})
            continue
        if opened >= 14: break
        opened += 1
        name = re.sub(r'[^a-z0-9-]+', '-', family(url))
        pkg = os.path.join(work, f'{publisher}-{name}.package.json')
        r = subprocess.run(['npx', 'vite-node', 'packages/source-package/scripts/acquire.ts', '--', url, '--out', pkg, '--cache', os.path.join(work, 'cache'), '--quiet'], capture_output=True, text=True, timeout=900)
        if r.returncode != 0 or not os.path.exists(pkg):
            rec['opened'].append({'url': url, 'opened': True, 'refused': 'acquisition failed: ' + (r.stderr or r.stdout)[-300:]})
            continue
        p = json.load(open(pkg))
        roles = [a['roles'] for a in p['assets']]
        views = [r['view'] for r in roles if r['document'] == 'ELEVATION' and r['view'] in ('FRONT', 'REAR', 'SIDE_LEFT', 'SIDE_RIGHT', 'SIDE_UNSPECIFIED')]
        why = []
        if not any(r['document'] == 'FLOOR_PLAN' and r.get('storey') == 'GROUND' for r in roles): why.append('no ground-floor plan')
        if len(views) < 3: why.append(f'{len(views)} labelled elevations')
        # v3.54.18 pre-analysis correction 1: PROTOCOL §1 is a HOUSE project — a page that publishes no usable area (a garage, an outbuilding) is outside the scope
        # v3.54.19 PROTOCOL §2: a dwelling — a published usable area of at least 60 m2 and no garage in the name
        ua = [f for f in p.get('publishedFacts', []) if f.get('key') == 'usable_area']
        def num(f):
            try: return float(str(f.get('value', f.get('raw', ''))).replace(',', '.').split()[0])
            except Exception: return None
        if not ua: why.append('no published usable area (not a dwelling)')
        elif all((num(f) or 0) < 60 for f in ua): why.append('published usable area below 60 m2 (not a dwelling)')
        if 'garaz' in url.lower(): why.append('a garage by name')
        size = sum(os.path.getsize(os.path.join(work, 'cache', f)) for f in os.listdir(os.path.join(work, 'cache'))) if os.path.isdir(os.path.join(work, 'cache')) else 0
        if size > 250e6: why.append('the cached package exceeds the disk budget')
        entry = {'url': url, 'opened': True, 'package': os.path.basename(pkg), 'elevations': views, 'plans': [r.get('storey') for r in roles if r['document'] == 'FLOOR_PLAN'], 'sections': sum(1 for r in roles if r['document'] == 'SECTION')}
        if why:
            entry['refused'] = '; '.join(why)
            rec['opened'].append(entry)
            continue
        rec['opened'].append(entry)
        rec.setdefault('accepted', []).append(url)
        rec['chosen'] = rec['accepted'][0]
        if len(rec['accepted']) >= want.get(publisher, 1): break
    out['publishers'][publisher] = rec
    print(publisher, rec['chosen'] or 'NONE ACCEPTED', f"({sum(1 for o in rec['opened'] if o.get('opened'))} opened)")
json.dump(out, open(os.path.join(work, 'selection.json' if len(sys.argv) <= 3 else 'selection-' + '-'.join(p for p, _ in POOLS) + '.json'), 'w'), indent=1)
