"""IU-03A routing evaluation: LEGACY vs STRICT_IU02 vs VETO_ONLY on one set of rows and one caption scenario.

    $PY iu3/evaluate.py dev  [--out <json outside the repo>]       chooses t_veto on DEVELOPMENT data (the IU-02 FINAL
                                                                    images) by the rule below, and writes it
    $PY iu3/evaluate.py test --t-veto <frozen> --rows <rows.json> --legacy-real <json> --legacy-adverse <json> --out <json>

Selection rule (fixed before the test set exists): t_veto is a threshold on P(not an elevation). On the grid
0.40..0.95 take the LARGEST t_veto (the fewest vetoes, so the most elevations kept) at which no non-elevation of the
ADVERSE dev scenario reaches the facade extractor; if none reaches zero, the t with the fewest. Nothing is tuned on
the test set.
"""
import json, math, os, sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo, arg_value
from iu.backbones import offline_guard
from iu3 import route, scores

GRID = [round(0.40 + 0.05 * i, 2) for i in range(12)]


def wilson(k, n, z=1.96):
    if n == 0:
        return None
    p = k / n; d = 1 + z * z / n; c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, c - h), 4), round(min(1.0, c + h), 4)]


def truth_of(r):
    return 'MULTI_VIEW' if r.get('multiView') else (r.get('originalLabel') or r['label'])


def summarise(rows, decisions):
    el = [i for i, r in enumerate(rows) if r['routeTruth']]
    non = [i for i, r in enumerate(rows) if not r['routeTruth']]
    unsafe = [i for i in non if decisions[i].facade]
    kept = [i for i in el if decisions[i].facade]
    hard = [i for i in non if rows[i].get('hard') and truth_of(rows[i]) == 'EXTERIOR_PERSPECTIVE']
    out = {'n': len(rows), 'singleElevations': len(el), 'elevationsRouted': len(kept), 'elevationCoverage': round(len(kept) / len(el), 4) if el else None,
           'elevationCoverageWilson': wilson(len(kept), len(el)), 'nonElevations': len(non), 'nonElevationsRouted': len(unsafe),
           'unsafeRateWilson': wilson(len(unsafe), len(non)), 'unsafeByTruth': dict(Counter(truth_of(rows[i]) for i in unsafe)),
           'nearFrontalPerspectives': len(hard), 'nearFrontalRouted': sum(1 for i in hard if decisions[i].facade),
           'routes': dict(Counter(d.route for d in decisions)),
           'elevationsLostBy': dict(Counter(decisions[i].route for i in el if not decisions[i].facade))}
    diag = Counter(x.split(':')[0] for d in decisions for x in d.diagnostics)
    if diag:
        out['diagnostics'] = dict(diag)
    return out


def run(rows, P, unm, masked, legacy_routes, t_veto):
    res = {}
    lg, st, vo = [], [], []
    for r, p, u in zip(rows, P, unm):
        lr, roles = legacy_routes.get(r['key'], ('NOT_IN_PACKAGE', None))
        lg.append(route.legacy(lr, roles))
        st.append(route.strict_iu02(list(p), (masked.get(r['key']) or {}).get('state')))
        d = route.veto_only(lr, roles, list(p), u, t_veto)
        assert d.roles is roles, 'VETO_ONLY changed the roles it was handed'
        vo.append(d)
    for name, dec in (('LEGACY', lg), ('STRICT_IU02', st), ('VETO_ONLY', vo)):
        res[name] = summarise(rows, dec)
    return res, vo


def load_legacy(path):
    return {x['key']: (x['route'], x['roles']) for x in json.load(open(path))}


def main():
    offline_guard()
    mode = sys.argv[1]
    out = arg_value('--out'); refuse_inside_repo(out, 'IU-03A routing results')
    W3 = os.environ.get('IU_WORK3', '/home/user/workiu03')
    if mode == 'dev':
        import iu2_final
        rows = iu2_final.final_rows(['FINAL_LOC', 'FINAL_SYNTH', 'FINAL_ARCHON', 'IU01_TEST'])
        real, adverse = load_legacy(os.path.join(W3, 'legacy-real.json')), load_legacy(os.path.join(W3, 'legacy-adverse.json'))
    else:
        rows = json.load(open(arg_value('--rows')))
        real, adverse = load_legacy(arg_value('--legacy-real')), load_legacy(arg_value('--legacy-adverse'))
    rows, P, unm, missing = scores.evidence(rows)
    # STRICT_IU02 needs the projection inside the building mask for its candidates (IU-02's own rule, computed here
    # exactly as iu2_final did; cached per image)
    import iu2_train as T
    cand = {rows[i]['key'] for i in range(len(rows)) if int(P[i].argmax()) == 1 and P[i][1] >= 0.60}
    masked = T.masked_state(rows, cand)
    res = {'missing': len(missing), 'scenarios': {}}
    if mode == 'dev':
        grid = {}
        for t in GRID:
            r, _ = run(rows, P, unm, masked, adverse, t)
            v = r['VETO_ONLY']
            grid[t] = {'falseVetoRate': round(1 - v['elevationCoverage'], 4), 'unsafe': v['nonElevationsRouted'], 'nearFrontalRouted': v['nearFrontalRouted']}
        zero = [t for t in GRID if grid[t]['unsafe'] == 0]
        t_veto = max(zero) if zero else min(GRID, key=lambda t: (grid[t]['unsafe'], -t))
        res['grid'] = grid; res['tVeto'] = t_veto; res['rule'] = __doc__.split('Selection rule')[1].split('Nothing')[0].strip()
    else:
        t_veto = float(arg_value('--t-veto'))
        res['tVeto'] = t_veto
    for scen, legacy_routes, subset in (('REAL_CAPTIONS', real, lambda r: r['key'] in real), ('ADVERSE_CAPTIONS', adverse, lambda r: True)):
        idx = [i for i, r in enumerate(rows) if subset(r)]
        sub = [rows[i] for i in idx]
        r, vo = run(sub, [P[i] for i in idx], [unm[i] for i in idx], masked, legacy_routes, t_veto)
        by_set = {}
        for s in sorted({x['set'] for x in sub}):
            j = [k for k, x in enumerate(sub) if x['set'] == s]
            rs, _ = run([sub[k] for k in j], [P[idx[k]] for k in j], [unm[idx[k]] for k in j], masked, legacy_routes, t_veto)
            by_set[s] = rs
        res['scenarios'][scen] = {'ALL': r, 'bySet': by_set,
                                  'perImage': [{'key': x['key'][:16], 'set': x['set'], 'truth': truth_of(x), 'hard': bool(x.get('hard')), 'veto': d.route, 'facade': d.facade,
                                                'diagnostics': d.diagnostics} for x, d in zip(sub, vo)]}
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    json.dump(res, open(out, 'w'), indent=1)
    print(json.dumps({'tVeto': t_veto, 'grid': res.get('grid')}))
    for scen, v in res['scenarios'].items():
        for name in ('LEGACY', 'STRICT_IU02', 'VETO_ONLY'):
            a = v['ALL'][name]
            print(scen, name, {k: a[k] for k in ('n', 'singleElevations', 'elevationsRouted', 'elevationCoverage', 'nonElevationsRouted', 'unsafeByTruth', 'nearFrontalRouted', 'elevationsLostBy')})


if __name__ == '__main__':
    main()
