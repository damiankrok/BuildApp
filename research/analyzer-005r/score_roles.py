#!/usr/bin/env python3
"""
score_roles.py — 005R Task-A scorer (RESEARCH ONLY). Preregistration §5.1.

    python3 -I score_roles.py <truth.json> <out.json> <contender.json> [<contender.json> ...]

For every contender, split (EVAL headline, DEV in-sample) and unit (lineage group = one row per near-duplicate group,
the asset with the smallest id; asset = every scored asset):
  confusion (truth × output incl. UNKNOWN), per-class precision / recall / coverage, selective risk with Wilson 95 % and
  a family-cluster bootstrap (2 000 resamples, seed 5005), risk-coverage over the contender's own score,
  interior→exterior leakage, technical↔marketing confusions, duplicate correlation, per-family and per-publisher rows.
V0a is additionally scored on basis = STRUCTURE only (its slug/caption inputs overlap the other bases). DobreDomy slider
assets (truth PICTORIAL_UNSPECIFIED) are scored only for technical-vs-pictorial errors.
"""
import json
import math
import random
import sys

EXT_EVIDENCE = {'EXTERIOR_RENDER', 'EXTERIOR_PHOTO', 'TECHNICAL_ELEVATION'}
INTERIOR = {'INTERIOR_RENDER', 'INTERIOR_PHOTO'}
SEED, B = 5005, 2000


def wilson(k, n, z=1.96):
    if n == 0:
        return [None, None]
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, c - h), 4), round(min(1.0, c + h), 4)]


def cluster_boot(rows, key='family'):
    fams = sorted({r[key] for r in rows})
    by = {f: [r for r in rows if r[key] == f] for f in fams}
    rng = random.Random(SEED)
    vals = []
    for _ in range(B):
        pick = [rng.choice(fams) for _ in fams]
        res = [r for f in pick for r in by[f] if r['resolved']]
        if res:
            vals.append(sum(1 for r in res if r['out'] != r['truth']) / len(res))
    if not vals:
        return [None, None]
    vals.sort()
    return [round(vals[int(0.025 * len(vals))], 4), round(vals[min(len(vals) - 1, int(0.975 * len(vals)))], 4)]


def metrics(rows):
    res = [r for r in rows if r['resolved']]
    wrong = [r for r in res if r['out'] != r['truth']]
    classes = sorted({r['truth'] for r in rows} | {r['out'] for r in res})
    conf = {}
    for r in rows:
        conf.setdefault(r['truth'], {})
        o = r['out'] if r['resolved'] else 'UNKNOWN'
        conf[r['truth']][o] = conf[r['truth']].get(o, 0) + 1
    per = {}
    for c in classes:
        tp = sum(1 for r in res if r['truth'] == c and r['out'] == c)
        pred = sum(1 for r in res if r['out'] == c)
        n = sum(1 for r in rows if r['truth'] == c)
        cov = sum(1 for r in res if r['truth'] == c)
        per[c] = {'truthN': n, 'resolvedN': cov, 'correct': tp, 'predicted': pred, 'precision': round(tp / pred, 4) if pred else None,
                  'recall': round(tp / n, 4) if n else None, 'coverage': round(cov / n, 4) if n else None, 'wrongAs': sorted({r['out'] for r in res if r['truth'] == c and r['out'] != c})}
    # risk-coverage over the contender's own score (None scores rank last)
    ranked = sorted(res, key=lambda r: (-(r['score'] if isinstance(r['score'], (int, float)) else -1), r['assetId']))
    curve, k = [], 0
    for i, r in enumerate(ranked, 1):
        k += r['out'] != r['truth']
        if i in (1, 5, 10, 20, 50, 100, 200, 400, 800) or i == len(ranked):
            curve.append({'resolved': i, 'coverage': round(i / len(rows), 4) if rows else None, 'risk': round(k / i, 4)})
    leak = [r['assetId'] for r in rows if r['truth'] in INTERIOR and r['resolved'] and r['out'] in EXT_EVIDENCE]
    tech_mkt = [r['assetId'] for r in res if {r['truth'], r['out']} == {'TECHNICAL_ELEVATION', 'EXTERIOR_RENDER'}]
    return {
        'n': len(rows), 'resolved': len(res), 'coverage': round(len(res) / len(rows), 4) if rows else None,
        'wrong': len(wrong), 'selectiveRisk': round(len(wrong) / len(res), 4) if res else None, 'wilson95': wilson(len(wrong), len(res)),
        'familyBootstrap95': cluster_boot(rows), 'families': len({r['family'] for r in rows}),
        'confusion': conf, 'perClass': per, 'riskCoverage': curve,
        'interiorToExteriorRoutes': len(leak), 'interiorToExteriorAssets': leak[:50],
        'technicalVsMarketing': len(tech_mkt), 'technicalVsMarketingAssets': tech_mkt[:50],
        'wrongExamples': [{'assetId': r['assetId'], 'truth': r['truth'], 'out': r['out'], 'family': r['family']} for r in wrong[:60]],
    }


def main(truth_p, out_p, *cont_ps):
    truth = {r['assetId']: r for r in json.load(open(truth_p))['rows']}
    report = {'schema': 'research.005r.role-scores.0.1', 'humanLabels': 'HUMAN_LABELS_NOT_RUN', 'contenders': {}}
    for cp in cont_ps:
        c = json.load(open(cp))
        name = c['meta']['contender']
        outs = {r['assetId']: r for r in c['rows']}
        crep = {'meta': c['meta']}
        for split in ('EVAL', 'DEV'):
            base = []
            for aid, t in sorted(truth.items()):
                if t['split'] != split or not t['scoredSize'] or t['roleTruth'] in ('UNKNOWN', 'TRUTH_CONFLICT', 'PICTORIAL_UNSPECIFIED'):
                    continue
                o = outs.get(aid, {'role': 'UNKNOWN', 'resolved': False, 'score': None})
                pub = t['editions'][0].split(':')[0]
                base.append({'assetId': aid, 'truth': t['roleTruth'], 'out': o['role'] if o['resolved'] else 'UNKNOWN', 'resolved': bool(o['resolved']),
                             'score': o.get('score'), 'v0doc': o.get('v0Document'), 'family': t['family'], 'group': t['lineageGroup'], 'basis': t['basis'], 'publisher': pub})
            groups = {}
            for r in base:
                groups.setdefault(r['group'], []).append(r)
            per_group = [sorted(g, key=lambda r: r['assetId'])[0] for g in groups.values()]
            multi = [g for g in groups.values() if len(g) > 1]
            disagree = sum(1 for g in multi if len({(r['out'], r['resolved']) for r in g}) > 1)
            s = {'lineageGroup': metrics(per_group), 'asset': metrics(base),
                 'duplicateCorrelation': {'groupsWithSeveralAssets': len(multi), 'groupsWithDifferentOutputs': disagree},
                 'byPublisher': {p: metrics([r for r in per_group if r['publisher'] == p]) for p in sorted({r['publisher'] for r in per_group})}}
            # DobreDomy slider: truth only says "a visualisation" (interior/exterior not structural): technical-vs-pictorial only
            pu = [(aid, outs.get(aid, {})) for aid, t in sorted(truth.items()) if t['split'] == split and t['scoredSize'] and t['roleTruth'] == 'PICTORIAL_UNSPECIFIED']
            dist = {}
            for _, o in pu:
                k = o.get('role', 'UNKNOWN') if o.get('resolved') else 'UNKNOWN'
                dist[k] = dist.get(k, 0) + 1
            s['pictorialUnspecified'] = {'n': len(pu), 'outputs': dist, 'technicalErrors': sum(v for k, v in dist.items() if k in ('FLOOR_PLAN', 'TECHNICAL_ELEVATION', 'SECTION', 'SITE_PLAN', 'DETAIL'))}
            if name == 'V0a':
                s['structureBasisOnly'] = metrics([r for r in per_group if r['basis'] == 'STRUCTURE'])
                # reviewer A-3: V0a never RESOLVES an interior to exterior evidence, but production analyze.ts:164 feeds
                # every PERSPECTIVE_RENDER into the facade extractors — that consumer leakage is the incumbent's real
                # interior→exterior route and is counted here, separately from the router metric above
                pc = [r for r in per_group if r['truth'] in INTERIOR and r['v0doc'] == 'PERSPECTIVE_RENDER']
                s['interiorToExteriorRoutes_perspectiveConsumer'] = {'lineageGroups': len(pc), 'families': len({r['family'] for r in pc}),
                                                                     'assets': sum(1 for r in base if r['truth'] in INTERIOR and r['v0doc'] == 'PERSPECTIVE_RENDER'),
                                                                     'interiorGroups': sum(1 for r in per_group if r['truth'] in INTERIOR)}
            s['byFamily'] = {f: {k: v for k, v in metrics([r for r in per_group if r['family'] == f]).items() if k in ('n', 'resolved', 'wrong', 'interiorToExteriorRoutes')}
                             for f in sorted({r['family'] for r in per_group})}
            crep[split] = s
        report['contenders'][name] = crep
    json.dump(report, open(out_p, 'w'), indent=1, sort_keys=True)
    for name, c in report['contenders'].items():
        e = c['EVAL']['lineageGroup']
        print(f"{name:5s} EVAL groups n={e['n']} resolved={e['resolved']} cov={e['coverage']} risk={e['selectiveRisk']} wilson={e['wilson95']} boot={e['familyBootstrap95']} int→ext={e['interiorToExteriorRoutes']}")


if __name__ == '__main__':
    main(*sys.argv[1:])
