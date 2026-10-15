#!/usr/bin/env python3
"""
compare.py — 005R-ROUTER preregistered predicates P1–P7 (+P4 detail) for two replay labels (RESEARCH ONLY).

    python3 -I research/analyzer-005r-router/compare.py <work dir> <labelA> <labelB> <out.json> [--rows a,b]

Implements preregistration.md §4 as amended by addendum A (identity-carrying ids and hashes blanked, then byte
comparison). Reads only the run outputs under <work>/runs/<label>/<case>/ (outside Git); writes numbers and ids only.
"""
import gzip
import json
import os
import sys

BLANK_EXACT = {'id', 'contentHash'}
BLANK_PREFIX = ('observationGraph', 'metricEvidence', 'structuralLayout', 'hypothesisSet', 'featureGraph')


def load(p, gz=False):
    if not os.path.exists(p):
        return None
    with (gzip.open(p, 'rt', encoding='utf8') if gz else open(p, encoding='utf8')) as f:
        return json.load(f)


def blank(x):
    if isinstance(x, dict):
        return {k: ('<blank>' if (k in BLANK_EXACT or k.startswith(BLANK_PREFIX)) and isinstance(v, str) else blank(v)) for k, v in x.items()}
    if isinstance(x, list):
        return [blank(v) for v in x]
    return x


def canon(x):
    return json.dumps(x, sort_keys=True, separators=(',', ':'))


def graph_parts(g):
    frames = {f['id']: f for f in g['coordinateFrames']}
    persp = {fid for fid, f in frames.items() if f['roles']['projection'] == 'PERSPECTIVE'}
    obs = {}
    for o in g['observations']:
        obs.setdefault(o['frameId'], {})[o['id']] = canon(o)
    rel = {r['id']: canon(r) for r in g['relations']} if g['relations'] and 'id' in g['relations'][0] else {canon(r): canon(r) for r in g['relations']}
    unres = {canon(u): u for u in g['unresolved']}
    obs_frame = {o['id']: o['frameId'] for o in g['observations']}
    return frames, persp, obs, rel, unres, obs_frame, {canon(e) for e in g['extractors']}


def compare_row(a_dir, b_dir):
    r = {}
    fa, fb = load(f'{a_dir}/failure.json'), load(f'{b_dir}/failure.json')
    ma, mb = (open(f'{a_dir}/model.json', 'rb').read() if os.path.exists(f'{a_dir}/model.json') else None), (open(f'{b_dir}/model.json', 'rb').read() if os.path.exists(f'{b_dir}/model.json') else None)
    if fa or fb:
        r['P1'] = bool(fa and fb and fa['code'] == fb['code'] and fa['reasonCode'] == fb['reasonCode'] and fa['message'] == fb['message'])
        r['outcome'] = f"FAILED {fa['code'] if fa else '-'}/{fb['code'] if fb else '-'}"
    else:
        r['P1'] = ma is not None and ma == mb
        r['outcome'] = 'COMPLETED' if ma is not None else 'MISSING_OUTPUT'
    ga, gb = load(f'{a_dir}/observation-graph.json.gz', True), load(f'{b_dir}/observation-graph.json.gz', True)
    if ga is None or gb is None:
        r['P2'] = r['P4'] = None
        return r
    A, B = graph_parts(ga), graph_parts(gb)
    frames_eq = canon(sorted(A[0].values(), key=lambda f: f['id'])) == canon(sorted(B[0].values(), key=lambda f: f['id']))
    ortho = [fid for fid in A[0] if fid not in A[1]]
    r['P2'] = frames_eq and all(A[2].get(fid, {}) == B[2].get(fid, {}) for fid in ortho)
    removed = {oid for fid in A[2] for oid in A[2][fid] if oid not in B[2].get(fid, {})}
    added = {oid for fid in B[2] for oid in B[2][fid] if oid not in A[2].get(fid, {})}
    persp_obs_b = sum(len(B[2].get(fid, {})) for fid in B[1])
    rel_removed = [k for k in A[3] if k not in B[3]]
    rel_added = [k for k in B[3] if k not in A[3]]
    rel_ok = all(any(A[5].get(end) in A[1] for end in (json.loads(A[3][k]).get('from'), json.loads(A[3][k]).get('to'))) for k in rel_removed) and not rel_added
    un_added = [B[4][k] for k in B[4] if k not in A[4]]
    un_removed = [A[4][k] for k in A[4] if k not in B[4]]
    persp_assets = {A[0][fid]['assetId'] for fid in A[1]}
    ok_added = len(un_added) == len(persp_assets) and all(u['status'] == 'NOT_ATTEMPTED' and u['what'].startswith('facade observations on the perspective render ') and u.get('assetId') in persp_assets for u in un_added)
    ok_removed = all(u['status'] == 'MISSING' and u.get('assetId') in persp_assets and u['what'].startswith('any observation at all on asset') for u in un_removed)
    ext_ok = B[6] <= A[6] and all('"cv.' in e for e in A[6] - B[6])
    r['P4'] = bool(not added and all(A[5][o] in A[1] for o in removed) and persp_obs_b == 0 and rel_ok and ok_added and ok_removed and ext_ok)
    # POST-HOC sensitivity (never a verdict): P4' accepts every removed gap that is anchored to a perspective asset
    r['P4posthoc'] = bool(not added and all(A[5][o] in A[1] for o in removed) and persp_obs_b == 0 and rel_ok and ok_added and all(u.get('assetId') in persp_assets for u in un_removed) and ext_ok)
    r['unresolvedRemovedKinds'] = sorted({(u['status'], u['what'].split(' at (')[0][:60]) for u in un_removed})
    r['P4detail'] = {'perspectiveFrames': len(A[1]), 'perspectiveAssets': len(persp_assets), 'observationsRemoved': len(removed), 'observationsAdded': len(added), 'perspectiveObservationsInB': persp_obs_b,
                     'relationsRemoved': len(rel_removed), 'relationsAdded': len(rel_added), 'unresolvedAdded': len(un_added), 'unresolvedRemoved': len(un_removed), 'extractorsRemoved': sorted(json.loads(e)['name'] for e in A[6] - B[6])}
    kinds = {}
    for fid in A[1]:
        for o in A[2].get(fid, {}).values():
            k = json.loads(o)['kind']
            kinds[k] = kinds.get(k, 0) + 1
    r['removedByKind'] = dict(sorted(kinds.items()))
    if fa or fb:
        r['P3'] = (fa or {}).get('metricEvidenceHash') is not None and (fb or {}).get('metricEvidenceHash') is not None or None
        return r
    xa, xb = load(f'{a_dir}/metric-evidence.json.gz', True), load(f'{b_dir}/metric-evidence.json.gz', True)
    r['P3'] = None if xa is None or xb is None else canon(blank(xa)) == canon(blank(xb))
    sa, sb = load(f'{a_dir}/summary.json'), load(f'{b_dir}/summary.json')
    allowed = {'observationGraphHash', 'metricEvidenceHash', 'candidateHash', 'jobId'}
    diff = sorted(k for k in set(sa) | set(sb) if k not in allowed and k != 'counts' and canon(sa.get(k)) != canon(sb.get(k)))
    cdiff = sorted(k for k in set(sa['counts']) | set(sb['counts']) if k != 'observations' and sa['counts'].get(k) != sb['counts'].get(k))
    r['P5'] = not diff and not cdiff
    r['P5diff'] = diff + [f'counts.{k}' for k in cdiff]
    # POST-HOC sensitivity (never a verdict): P5' drops wall-clock `ms` fields, which differ between any two runs
    def no_ms(x):
        return {k: no_ms(v) for k, v in x.items() if k != 'ms'} if isinstance(x, dict) else [no_ms(v) for v in x] if isinstance(x, list) else x
    r['P5posthoc'] = not [k for k in diff if canon(no_ms(sa.get(k))) != canon(no_ms(sb.get(k)))] and not cdiff
    ca, cb = load(f'{a_dir}/candidate.json.gz', True), load(f'{b_dir}/candidate.json.gz', True)
    r['P6'] = canon(blank(ca)) == canon(blank(cb))
    pa, pb = load(f'{a_dir}/perf.json'), load(f'{b_dir}/perf.json')
    r['observationMs'] = [pa['timings']['observationMs'], pb['timings']['observationMs']]
    r['peakRssMB'] = [pa['peakRssMB'], pb['peakRssMB']]
    return r


def identical_row(a_dir, b_dir):
    """P7: byte identity of model, graph, summary (minus wall-clock fields already stripped), metric evidence."""
    out = {}
    for f in ('model.json', 'observation-graph.json.gz', 'summary.json', 'metric-evidence.json.gz', 'candidate.json.gz', 'failure.json'):
        pa, pb = f'{a_dir}/{f}', f'{b_dir}/{f}'
        if not os.path.exists(pa) and not os.path.exists(pb):
            continue
        if f.endswith('.gz'):
            out[f] = os.path.exists(pa) and os.path.exists(pb) and gzip.open(pa).read() == gzip.open(pb).read()
        elif f == 'summary.json':
            a, b = load(pa), load(pb)
            for x in (a, b):
                x.pop('timings', None) if x else None
            out[f] = canon(a) == canon(b)
        else:
            out[f] = os.path.exists(pa) and os.path.exists(pb) and open(pa, 'rb').read() == open(pb, 'rb').read()
    return out


def main():
    work, la, lb, outp = sys.argv[1:5]
    rows = sys.argv[sys.argv.index('--rows') + 1].split(',') if '--rows' in sys.argv else None
    mode = 'identical' if '--identical' in sys.argv else 'predicates'
    base_a, base_b = f'{work}/runs/{la}', f'{work}/runs/{lb}'
    cases = sorted(set(os.listdir(base_a)) & set(os.listdir(base_b)))
    if rows:
        cases = [c for c in cases if c in rows]
    res = {c: (identical_row if mode == 'identical' else compare_row)(f'{base_a}/{c}', f'{base_b}/{c}') for c in cases}
    keys = sorted({k for r in res.values() for k in r if k.startswith('P') and 'detail' not in k and 'diff' not in k} | ({'model.json', 'observation-graph.json.gz', 'summary.json', 'metric-evidence.json.gz', 'candidate.json.gz'} if mode == 'identical' else set()))
    summary = {k: {'pass': sum(1 for r in res.values() if r.get(k) is True), 'fail': sorted(c for c, r in res.items() if r.get(k) is False), 'notMeasured': sorted(c for c, r in res.items() if r.get(k) is None and k in r)} for k in keys}
    json.dump({'schema': 'research.005r-router.compare.0.1', 'a': la, 'b': lb, 'mode': mode, 'rows': len(res), 'summary': summary, 'perRow': res}, open(outp, 'w'), indent=1, sort_keys=True)
    print(json.dumps({'rows': len(res), 'summary': summary}, sort_keys=True))


if __name__ == '__main__':
    main()
