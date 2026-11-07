# v3.45 skill 3 on sections: printed numbers (levels m, angles deg, vertical dimensions cm) vs the metric evidence the
# production reader emitted on the same section bytes. Exact match: same group and the same printed value.
# usage: score_levels.py <levels-annotations.txt> <views-annotations.json> <runs-root> [out.json]
import json, sys, glob, os, collections
lev_txt, views, root = sys.argv[1:4]
ALIAS = {'przed-1316': 'bakopy', 'przed-1318': 'zefiranty'}
runs = {}
for p in glob.glob(os.path.join(root, '**', 'metric-evidence.json'), recursive=True):
    h = os.path.basename(os.path.dirname(p)); runs[ALIAS.get(h, h)] = os.path.dirname(p)
secsha = {}
for r in json.load(open(views))['rows']:
    if r['view']['class'] == 'TECHNICAL_SECTION': secsha.setdefault(r['project'], []).append(r['sha256'])
GROUP = {'R': 'LEVEL', 'E': 'LEVEL', 'F': 'LEVEL', 'f': 'LEVEL', 'T': 'LEVEL', 'O': 'LEVEL', 'A': 'ANGLE', 'H': 'HEIGHT'}
ann = {}
for line in open(lev_txt):
    if line.startswith('#') or not line.strip(): continue
    p = line.split(); items = []
    for t in p[1:]:
        v, k = t.rsplit(':', 1); ill = k.endswith('!'); k = k.rstrip('!')
        items.append({'value': float(v), 'kind': k, 'group': GROUP[k], 'legible': not ill})
    ann[p[0]] = items
def pred_group(e):
    if e['kind'] == 'LEVEL_DATUM': return 'LEVEL', e['value']
    if e['kind'] == 'ANGLE': return 'ANGLE', e['value']
    if e['kind'] == 'LINEAR_DIMENSION':
        v = e['value']; u = e.get('unit')
        return 'HEIGHT', round(v * 100, 1) if u == 'm' else v
    return None, None
tol = {'LEVEL': 0.005, 'ANGLE': 0.5, 'HEIGHT': 0.5}
tot = collections.Counter(); per = []
for h, items in sorted(ann.items()):
    if h not in runs:
        for it in items: tot[('miss_norun', it['group'])] += 1
        per.append({'project': h, 'run': None}); continue
    m = json.load(open(runs[h] + '/metric-evidence.json'))
    shas = set(secsha.get(h, []))
    preds = [e for e in m['evidence'] if e.get('variantByteHash') in shas]
    P = []
    for e in preds:
        g, v = pred_group(e)
        if g: P.append({'group': g, 'value': v, 'raw': e.get('rawText'), 'id': e['id'], 'origin': e.get('origin'), 'confidence': e.get('confidence'), 'box': e.get('textBox')})
    used = set(); rows = []
    for it in items:
        hit = next((i for i, q in enumerate(P) if i not in used and q['group'] == it['group'] and abs(q['value'] - it['value']) <= tol[it['group']]), None)
        if hit is not None: used.add(hit)
        rows.append({**it, 'read': hit is not None, 'pred': P[hit]['raw'] if hit is not None else None})
        key = ('legible' if it['legible'] else 'illegible', it['group'])
        tot[key + ('n',)] += 1; tot[key + ('hit',)] += hit is not None
    extra = [q for i, q in enumerate(P) if i not in used]
    for q in extra: tot[('extra', q['group'])] += 1
    per.append({'project': h, 'items': rows, 'additions': extra})
out = {'totals': {'|'.join(map(str, k)): v for k, v in sorted(tot.items())}, 'projects': per}
for g in ('LEVEL', 'ANGLE', 'HEIGHT'):
    n = tot[('legible', g, 'n')]; hit = tot[('legible', g, 'hit')]
    print(f'{g:7s} legible n={n:3d} read={hit:3d} recall={hit / n if n else 0:.3f}  wrong/added={tot[("extra", g)]}  illegible n={tot[("illegible", g, "n")]} read={tot[("illegible", g, "hit")]}')
bykind = collections.Counter(); bykindhit = collections.Counter()
for p in per:
    for it in p.get('items', []):
        if it['legible']: bykind[it['kind']] += 1; bykindhit[it['kind']] += it['read']
print('levels by kind', {k: f'{bykindhit[k]}/{bykind[k]}' for k in bykind})
for p in per:
    if p.get('additions'): print('  ADDED', p['project'][:28], [(q['group'], q['value'], q['raw']) for q in p['additions']])
if len(sys.argv) > 4: json.dump(out, open(sys.argv[4], 'w'), indent=1)
