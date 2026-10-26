"""IU-03A: run the router and FacadeGeometryEvidence on the mandatory negatives and check each against the behaviour
its case requires (iu3/negatives.py). Every elevation is captioned "elevation" (the ADVERSE scenario), so LEGACY sends
everything to the facade extractor and the test is whether the pixels stop what must be stopped and keep the rest.

    $PY iu3/negatives_eval.py --neg <dir> --t-veto 0.6 --out <json outside the repo>
"""
import json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo, arg_value
if __name__ == '__main__':
    refuse_inside_repo(arg_value('--out', ''), 'negatives results')  # before anything heavy is imported
from iu.backbones import offline_guard
from iu2 import data, pipeline
from iu3 import route, scores, evidence as fge


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    i = ix * iy
    return i / max(1, (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i)


def cover(a, b):
    """share of box a inside box b"""
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    return ix * iy / max(1, (a[2] - a[0]) * (a[3] - a[1]))


def check(r, ev):
    it = ev['items']; ops = it['openings']; gt = [o['rect'] for o in r.get('openings', [])]
    case = r['case']
    added = [o for o in ops if o['independentlyDetected'] and not any(iou(o['rect'], g) > 0.3 for g in gt)]
    kept = sum(1 for g in gt if any(iou(o['rect'], g) > 0.3 for o in ops))
    res = {'gtOpenings': len(gt), 'kept': kept, 'addedIndependent': len(added), 'ground': it['groundLine']['state']}
    if case == 'N1_WHITE_ON_WHITE':
        res['pass'] = len(added) == 0
    elif case == 'N2_TREE_BEFORE_WINDOW':
        hits = [o for o in ops if iou(o['rect'], r['occludedWindow']) > 0.2]
        res['claimedIndependent'] = sum(o['independentlyDetected'] for o in hits)
        res['pass'] = res['claimedIndependent'] == 0
    elif case == 'N3_TREE_REFLECTION':
        hits = [o for o in ops if cover(o['rect'], r['reflectedWindow']) > 0.5]
        res['piecesInReflectedWindow'] = len(hits)
        res['pass'] = len(hits) <= 1 and len(added) == 0
        res['missed'] = len(hits) == 0
    elif case == 'N4_GARAGE_GATE':
        g = [o['rect'] for o in r['openings'] if o['kind'] == 'GATE'][0]
        hits = [o for o in ops if iou(o['rect'], g) > 0.3]
        res['gateAs'] = [o['kind'] + ('/grounded' if o['reachesGround'] else '') for o in hits]
        res['pass'] = bool(hits) and all(o['kind'] != 'WINDOW_OR_GLAZING' for o in hits)
    elif case == 'N5_DARK_ON_DARK':
        rd = it.get('ridge', {}).get('row'); ev_rows = [e['row'] for e in it.get('eaves', [])]
        res['ridgeErrPx'] = None if rd is None else abs(rd - r['ridgeRow'])
        res['eaveErrPx'] = [abs(x - r['eaveRow']) for x in ev_rows]
        res['eaveStates'] = [e.get('state') for e in it.get('eaves', [])]
        res['pass'] = res['ridgeErrPx'] is not None and res['ridgeErrPx'] <= 6 and all(st == 'UNCERTAIN' or err <= 6 for st, err in zip(res['eaveStates'], res['eaveErrPx'])) and len(added) == 0
    elif case == 'N6_BALCONY_RAIL':
        rail = [o for o in ops if cover(o['rect'], r['railBand']) > 0.5 and o['kind'] == 'WINDOW_OR_GLAZING' and not any(iou(o['rect'], g) > 0.3 for g in gt)]
        res['railAsWindow'] = len(rail)
        res['pass'] = len(rail) == 0
    elif case == 'N9_GROUND_MISSING':
        res['adapterInjects'] = fge.silhouette_polygon_for_solver(ev) is not None
        res['pass'] = it['groundLine']['state'] != 'OBSERVED'
    return res


def main():
    offline_guard()
    neg, out, t_veto = arg_value('--neg'), arg_value('--out'), float(arg_value('--t-veto'))
    refuse_inside_repo(out, 'negatives results')
    man = json.load(open(os.path.join(neg, 'manifest.json')))['rows']
    rows = [data._row(key=r['id'], tag=arg_value('--tag', 'iu3neg'), source='NEG', split='NEG', project=r['id'], label=r['label'], multiView=r['label'] == 'OTHER',
                      hard=r['case'] == 'N7_NEAR_FRONTAL', path=os.path.join(neg, r['file']), **{k: v for k, v in r.items() if k not in ('label', 'file')}) for r in man]
    keep, P, unm, missing = scores.evidence(rows)
    assert not missing, missing
    w = os.path.join(data.WORK1, 'weights', 'iu02')
    res = []
    for r, p, u in zip(keep, P, unm):
        rgb, meta = pipeline.load(r['path'])
        o = pipeline.run(rgb, meta, w, 'UPERNET')
        v = route.veto_only('FACADE', {'document': 'ELEVATION'}, list(p), u, t_veto)
        s = route.strict_iu02(list(p), o['projection']['state'])
        row = {'id': r['key'], 'case': r['case'], 'truth': r['label'], 'expect': r['expect'], 'pElevation': round(float(p[1]), 3),
               'projectionUnmasked': u, 'projectionMasked': o['projection']['state'],
               'LEGACY': 'FACADE', 'VETO_ONLY': v.route, 'vetoDiagnostics': v.diagnostics, 'STRICT_IU02': s.route}
        if r['label'] == 'ORTHOGRAPHIC_ELEVATION':
            ev = fge.evidence(rgb, o['seg'], o['projection'], o['arrays'], meta)
            row['evidence'] = check(r, ev)
            row['routerKeepsElevation'] = v.facade
        else:
            row['pass'] = not v.facade
        res.append(row)
        print(row['id'], row['VETO_ONLY'], row['STRICT_IU02'], row.get('evidence', {}).get('pass', row.get('pass')), {k: x for k, x in row.get('evidence', {}).items() if k not in ('pass',)}, flush=True)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    json.dump(res, open(out, 'w'), indent=1)


if __name__ == '__main__':
    main()
