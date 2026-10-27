"""IU-03B control-set evaluation, run ONCE after the freeze: IU-03A VETO_ONLY (A) against the frozen variant (FROZEN,
see the preregistration) on the same rows, both caption scenarios. Fits and tunes nothing.

    $PY iu3b/evaluate_control.py --rows <ctrl-rows.json> --collect <jsonl> --legacy-real <json> --legacy-adverse <json> --out <json>

Numbers: non-elevations reaching the facade extractor (by truth and style, Wilson 95 %), near-frontal perspectives
reaching it, single elevations kept, what stage 2 cost and how often it ran, every masked-test skip on a
non-elevation (a trigger miss), the projection state on the full image and inside the mask per truth group
(confirmed perspective / confirmed orthographic / inconclusive), and every recorded conflict.
"""
import json, os, sys
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo, arg_value
if __name__ == '__main__':
    refuse_inside_repo(arg_value('--out', ''), 'IU-03B control results')  # before anything heavy is imported
from iu3 import scores
from iu3.evaluate import wilson
from iu3b import veto

FROZEN = {'masked': 'classic', 'base': False, 'trigger': True}
VARIANTS = {'A': {}, 'FROZEN': FROZEN}


def group(r):
    if r['routeTruth']:
        return 'ELEVATION'
    if r['label'] == 'EXTERIOR_PERSPECTIVE':
        return 'PERSPECTIVE_NEAR_FRONTAL' if r.get('kind') == 'NEAR_FRONTAL' else 'PERSPECTIVE_OTHER'
    return 'MULTI_VIEW' if r.get('multiView') else r['label']


def state3(s):
    return {'PERSPECTIVE_EVIDENT': 'CONFIRMED_PERSPECTIVE', 'ORTHOGRAPHIC_SUPPORTED': 'CONFIRMED_ORTHOGRAPHIC', 'NOT_SINGLE_FACADE': 'NOT_SINGLE_FACADE'}.get(s, 'INCONCLUSIVE')


def summarise(items):
    el = [x for x in items if x['truth']]
    non = [x for x in items if not x['truth']]
    nf = [x for x in non if x['group'] == 'PERSPECTIVE_NEAR_FRONTAL']
    routed = [x for x in non if x['facade']]
    return {'n': len(items), 'elevations': len(el), 'elevationsKept': sum(x['facade'] for x in el), 'elevationKeptWilson': wilson(sum(x['facade'] for x in el), len(el)),
            'nonElevations': len(non), 'nonElevationsRouted': len(routed), 'unsafeWilson': wilson(len(routed), len(non)),
            'routedByGroup': dict(Counter(x['group'] for x in routed)), 'nearFrontal': len(nf), 'nearFrontalRouted': sum(x['facade'] for x in nf),
            'nearFrontalRoutedWilson': wilson(sum(x['facade'] for x in nf), len(nf)),
            'elevationsLostBy': dict(Counter(x['reason'] for x in el if not x['facade'])), 'maskedTestRan': sum(x['maskedRan'] for x in items),
            'triggerMissesOnNonElevations': [x['key'][:24] for x in non if 'MASKED_TEST_SKIPPED: no trigger' in x['diagnostics']],
            'conflictsRecorded': sum(1 for x in items if x['conflict'])}


def main():
    out = arg_value('--out'); refuse_inside_repo(out, 'IU-03B control results')
    rows = json.load(open(arg_value('--rows')))
    col = {}
    for l in open(arg_value('--collect')):
        d = json.loads(l); col[d['key']] = d
    rows, P, unm, missing = scores.evidence(rows)
    assert not missing, f'{len(missing)} control rows without classifier evidence'
    legacy = {s: {x['key']: (x['route'], x['roles']) for x in json.load(open(arg_value(f'--legacy-{s.lower()}')))} for s in ('REAL', 'ADVERSE')}
    res = {'frozen': FROZEN, 'scenarios': {}, 'projectionStates': {}}
    per = []
    for scen in ('ADVERSE', 'REAL'):
        res['scenarios'][scen] = {}
        for name, cfg in VARIANTS.items():
            items = []
            for r, p in zip(rows, P):
                if r['key'] not in legacy[scen]:
                    continue
                lr, roles = legacy[scen][r['key']]
                d = veto.decide(list(p), col[r['key']], legacy_route=lr, roles=roles, **cfg)
                assert d['roles'] is roles, 'a variant changed the roles it was handed'
                items.append({'key': r['key'], 'set': r['set'], 'style': r.get('style') or r['source'], 'truth': r['routeTruth'], 'group': group(r), 'pElevation': round(float(p[1]), 3),
                              **{k: d[k] for k in ('facade', 'reason', 'maskedRan', 'triggers', 'conflict', 'diagnostics')}})
            by = {'ALL': summarise(items)}
            for s in sorted({x['set'] for x in items}):
                by[s] = summarise([x for x in items if x['set'] == s])
            for st in sorted({x['style'] for x in items}):
                by['style:' + st] = summarise([x for x in items if x['style'] == st])
            res['scenarios'][scen][name] = by
            if scen == 'ADVERSE':
                per += [dict(x, variant=name) for x in items]
    T = defaultdict(Counter)
    for r in rows:
        c = col[r['key']]
        g = f"{group(r)}/{r.get('style') or r['source']}"
        T[g]['n'] += 1; T[g]['full:' + state3(c['full']['state'])] += 1
        T[g]['mask:' + ('CONFIRMED_PERSPECTIVE' if veto._masked_evident(c['classic'], False) else state3(c['classic']['state']) if c['classic']['state'] != 'PERSPECTIVE_EVIDENT' else 'INCONCLUSIVE')] += 1
    res['projectionStates'] = {k: dict(v) for k, v in sorted(T.items())}
    secs = sorted(col[r['key']]['seconds']['classic'] for r in rows)
    res['stage2Seconds'] = {'median': secs[len(secs) // 2], 'p95': secs[int(0.95 * (len(secs) - 1))], 'max': secs[-1], 'note': 'desktop CPU, measured inside collect.py (parallel workers)'}
    res['perImageAdverse'] = per
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    json.dump(res, open(out, 'w'), indent=1)
    for scen, v in res['scenarios'].items():
        for name, by in v.items():
            a = by['ALL']
            print(scen, name, {k: a[k] for k in ('n', 'elevations', 'elevationsKept', 'elevationKeptWilson', 'nonElevations', 'nonElevationsRouted', 'unsafeWilson', 'routedByGroup',
                                                 'nearFrontal', 'nearFrontalRouted', 'maskedTestRan', 'triggerMissesOnNonElevations', 'conflictsRecorded')})


if __name__ == '__main__':
    main()
