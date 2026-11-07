# v3.45 scorer, skill 1+2 (view type, storey, side): annotations vs the production decision on the same bytes.
# usage: score_views.py <views-annotations.json> <runs-root> [out.json]
# Production decision per image = the observation graph's frame roles for that byte hash; an image the graph does not carry
# was not routed as a drawing (NOT_ROUTED). Interior views are correct when NOT_ROUTED or routed as perspective.
import json, sys, glob, os, collections
ann = json.load(open(sys.argv[1]))['rows']; root = sys.argv[2]
ALIAS = {'przed-1316': 'bakopy', 'przed-1318': 'zefiranty'}
graphs = {}
for p in glob.glob(os.path.join(root, '**', 'observation-graph.json'), recursive=True):
    h = os.path.basename(os.path.dirname(p)); graphs[ALIAS.get(h, h)] = json.load(open(p))
DOC = {'PERSPECTIVE_RENDER': 'EXTERIOR_PERSPECTIVE', 'FLOOR_PLAN': 'FLOOR_PLAN', 'ELEVATION': 'ORTHOGRAPHIC_ELEVATION',
       'SECTION': 'TECHNICAL_SECTION', 'SITE_PLAN': 'SITE_PLAN', 'ROOF_PLAN': 'ROOF_PLAN', 'INTERIOR': 'INTERIOR_PERSPECTIVE'}
def truth_cls(r):
    c = r['view']['class']; return c
rows = []; missing = set()
for r in ann:
    g = graphs.get(r['project'])
    if g is None: missing.add(r['project']); continue
    fr = [f for f in g['coordinateFrames'] if f.get('variantByteHash') == r['sha256']]
    if fr:
        ro = fr[0]['roles']; pc = DOC.get(ro.get('document'), ro.get('document')); ps = ro.get('storey'); pv = ro.get('view')
    else: pc, ps, pv = 'NOT_ROUTED', None, None
    t = r['view']['class']
    # an interior image is handled correctly when it is not routed as a drawing
    pce = 'INTERIOR_PERSPECTIVE' if (t == 'INTERIOR_PERSPECTIVE' and pc == 'NOT_ROUTED') else pc
    rows.append({'project': r['project'], 'sha256': r['sha256'], 'assetId': r['assetId'], 'truth': t, 'pred': pce, 'predRaw': pc,
                 'truthStorey': r['view']['storey'], 'predStorey': ps, 'truthSide': r['view']['side'], 'predSide': pv})
classes = sorted({x['truth'] for x in rows} | {x['pred'] for x in rows})
conf = collections.defaultdict(collections.Counter)
for x in rows: conf[x['truth']][x['pred']] += 1
def prf(c):
    tp = conf[c][c]; fp = sum(conf[t][c] for t in conf if t != c); fn = sum(v for k, v in conf[c].items() if k != c)
    p = tp / (tp + fp) if tp + fp else None; rcl = tp / (tp + fn) if tp + fn else None
    f = 2 * p * rcl / (p + rcl) if p and rcl else 0.0
    return {'n': tp + fn, 'tp': tp, 'fp': fp, 'fn': fn, 'precision': p, 'recall': rcl, 'f1': f}
truthc = sorted({x['truth'] for x in rows})
per = {c: prf(c) for c in truthc}
macro = sum(per[c]['f1'] for c in truthc) / len(truthc)
# storey on floor plans; side on elevations (UNDECIDED excluded from the side score, counted)
st = [x for x in rows if x['truth'] == 'FLOOR_PLAN']
stc = collections.Counter((x['truthStorey'], x['predStorey']) for x in st)
sd = [x for x in rows if x['truth'] == 'ORTHOGRAPHIC_ELEVATION' and x['truthSide'] != 'UNDECIDED']
MAPS = {'FRONT': 'FRONT', 'REAR': 'REAR', 'SIDE_UNSPECIFIED': 'SIDE', 'LEFT': 'SIDE', 'RIGHT': 'SIDE'}
sdc = collections.Counter((x['truthSide'], MAPS.get(x['predSide'], x['predSide'])) for x in sd)
out = {'n': len(rows), 'projects': len({x['project'] for x in rows}), 'missingRuns': sorted(missing),
       'confusion': {t: dict(conf[t]) for t in truthc}, 'perClass': per, 'macroF1': macro,
       'storey': {'n': len(st), 'correct': sum(v for (a, b), v in stc.items() if a == b), 'pairs': {f'{a}->{b}': v for (a, b), v in stc.items()}},
       'side': {'n': len(sd), 'correct': sum(v for (a, b), v in sdc.items() if a == b), 'pairs': {f'{a}->{b}': v for (a, b), v in sdc.items()},
                'undecidedExcluded': sum(1 for x in rows if x['truthSide'] == 'UNDECIDED')},
       'errors': [x for x in rows if x['truth'] != x['pred'] or (x['truth'] == 'FLOOR_PLAN' and x['truthStorey'] != x['predStorey'])]}
if len(sys.argv) > 3: json.dump(out, open(sys.argv[3], 'w'), indent=1)
print('N', out['n'], 'projects', out['projects'], 'macroF1 %.4f' % macro, 'missing', out['missingRuns'])
for c in truthc: print(' %-24s n=%3d P=%s R=%s F1=%.3f' % (c, per[c]['n'], per[c]['precision'] and round(per[c]['precision'], 3), per[c]['recall'] and round(per[c]['recall'], 3), per[c]['f1']))
print('confusion'); [print(' ', t, dict(conf[t])) for t in truthc]
print('storey', out['storey']); print('side', out['side'])
