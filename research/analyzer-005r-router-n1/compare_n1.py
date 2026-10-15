#!/usr/bin/env python3
"""
compare_n1.py — BUILDPLAN-ANALYZER-005R-ROUTER-N1-ADOPT predicates P1-P7 for two replay labels (RESEARCH ONLY).

    python3 -I research/analyzer-005r-router-n1/compare_n1.py predicates <A dir> <B dir> <out.json> [--rows a,b]
    python3 -I research/analyzer-005r-router-n1/compare_n1.py determinism <A dir> <B dir> <out.json> [--rows a,b]

<A dir>/<B dir> are directories holding one sub-directory per DEV row (run-case.ts outputs, outside Git). A row may be
redirected to another directory by an `A-override:<dir>` argument (R0fix rows). Implements preregistration.md §4
exactly; nothing here is tuned after a challenger run. Writes numbers and ids only.
"""
import gzip
import json
import os
import sys

# §4 P5'/P7': the ONLY clock/time telemetry stripped. Fixed from the incumbent alone (R0 vs R0rev, 37 rows, before any
# challenger run): this is the only summary leaf that differs between two runs of the same code on the same input.
CLOCK_FIELDS = (('recogniser', 'ms'),)
# §4 P5': identity-carrying summary fields, which may differ ONLY because the graph identity differs; each is backed
# by a content predicate (P4' graph, P3 metric content, P6 candidate content, counts.observations = R0 - removed).
IDENTITY_FIELDS = ('observationGraphHash', 'metricEvidenceHash', 'candidateHash')
# Fields whose values carry graph identity inside metric evidence / candidate content (blanked before P3 and P6).
BLANK_EXACT = {'id', 'contentHash'}
BLANK_PREFIX = ('observationGraph', 'metricEvidence', 'structuralLayout', 'hypothesisSet', 'featureGraph')
# The five deterministic facade extractors (packages/source-analyzer/src/extractors/elevation.ts ELEVATION_EXTRACTORS).
FACADE_EXTRACTOR_PREFIX = 'cv.'
REFUSAL_PREFIX = 'facade observations on the perspective render '
VISION_FACADE_GAP = 'a facade decomposition vision pass on asset '
PRE_GATE_GAPS = ('the bytes of asset ', 'the raster of asset ')


def load(p, gz=False):
    if not os.path.exists(p):
        return None
    with (gzip.open(p, 'rt', encoding='utf8') if gz else open(p, encoding='utf8')) as f:
        return json.load(f)


def canon(x):
    return json.dumps(x, sort_keys=True, separators=(',', ':'))


def blank(x):
    if isinstance(x, dict):
        return {k: ('<blank>' if (k in BLANK_EXACT or k.startswith(BLANK_PREFIX)) and isinstance(v, str) else blank(v)) for k, v in x.items()}
    if isinstance(x, list):
        return [blank(v) for v in x]
    return x


def strip_clock(summary):
    s = json.loads(canon(summary))
    for path in CLOCK_FIELDS:
        node = s
        for k in path[:-1]:
            node = node.get(k, {}) if isinstance(node, dict) else {}
        if isinstance(node, dict):
            node.pop(path[-1], None)
    return s


def graph_diff(ga, gb):
    """P4': every difference between two graphs, each either typed (perspective-asset anchored) or UNEXPECTED."""
    fa = {f['id']: f for f in ga['coordinateFrames']}
    fb = {f['id']: f for f in gb['coordinateFrames']}
    unexpected = []
    if canon(sorted(fa.values(), key=lambda f: f['id'])) != canon(sorted(fb.values(), key=lambda f: f['id'])):
        unexpected.append({'type': 'FRAMES_CHANGED'})
    persp_frames = {fid for fid, f in fa.items() if f['roles']['document'] == 'PERSPECTIVE_RENDER' and f['roles']['projection'] != 'ORTHOGRAPHIC_ELEVATION'}
    persp_assets = {fa[fid]['assetId'] for fid in persp_frames}
    for k in sorted(set(ga) | set(gb)):
        if k in ('coordinateFrames', 'observations', 'relations', 'unresolved', 'extractors', 'conflicts', 'id', 'contentHash'):
            continue
        if canon(ga.get(k)) != canon(gb.get(k)):
            unexpected.append({'type': 'TOP_LEVEL_CHANGED', 'key': k})
    oa = {o['id']: o for o in ga['observations']}
    ob = {o['id']: o for o in gb['observations']}
    typed = {'T1_observationRemoved': 0, 'T2_relationRemoved': 0, 'T3_gapRemoved': {}, 'T4_refusalAdded': 0, 'T5_extractorRemoved': [], 'T6_conflictRemoved': 0}
    removed_obs = set()
    for oid, o in oa.items():
        if oid not in ob:
            if o['frameId'] in persp_frames:
                typed['T1_observationRemoved'] += 1
                removed_obs.add(oid)
            else:
                unexpected.append({'type': 'ORTHOGRAPHIC_OBSERVATION_REMOVED', 'id': oid, 'kind': o['kind'], 'frameId': o['frameId']})
        elif canon(o) != canon(ob[oid]):
            unexpected.append({'type': 'OBSERVATION_CHANGED', 'id': oid, 'kind': o['kind']})
    for oid, o in ob.items():
        if oid not in oa:
            unexpected.append({'type': 'OBSERVATION_ADDED', 'id': oid, 'kind': o['kind'], 'frameId': o['frameId']})
    on_persp_b = sum(1 for o in ob.values() if o['frameId'] in persp_frames)
    if on_persp_b:
        unexpected.append({'type': 'OBSERVATIONS_LEFT_ON_PERSPECTIVE', 'count': on_persp_b})
    ra = {canon(r): r for r in ga['relations']}
    rb = {canon(r): r for r in gb['relations']}
    for k, r in ra.items():
        if k not in rb:
            if r.get('from') in removed_obs or r.get('to') in removed_obs:
                typed['T2_relationRemoved'] += 1
            else:
                unexpected.append({'type': 'RELATION_REMOVED', 'kind': r.get('kind'), 'from': r.get('from'), 'to': r.get('to')})
    for k, r in rb.items():
        if k not in ra:
            unexpected.append({'type': 'RELATION_ADDED', 'kind': r.get('kind')})
    ua = {canon(u): u for u in ga['unresolved']}
    ub = {canon(u): u for u in gb['unresolved']}
    for k, u in ua.items():
        if k in ub:
            continue
        what = u.get('what', '')
        if u.get('assetId') in persp_assets and not what.startswith(PRE_GATE_GAPS):
            cat = 'VISION_FACADE_GAP' if what == VISION_FACADE_GAP + u['assetId'] else 'FOUND_NOTHING_GAP' if what.startswith('any observation at all on asset') else f"EXTRACTOR_GAP_{u.get('status')}"
            typed['T3_gapRemoved'][cat] = typed['T3_gapRemoved'].get(cat, 0) + 1
        else:
            unexpected.append({'type': 'GAP_REMOVED', 'status': u.get('status'), 'assetId': u.get('assetId'), 'what': what[:80]})
    refused = set()
    for k, u in ub.items():
        if k in ua:
            continue
        aid = u.get('assetId')
        if u.get('status') == 'NOT_ATTEMPTED' and aid in persp_assets and u.get('what') == REFUSAL_PREFIX + aid and aid not in refused:
            refused.add(aid)
            typed['T4_refusalAdded'] += 1
        else:
            unexpected.append({'type': 'GAP_ADDED', 'status': u.get('status'), 'assetId': aid, 'what': u.get('what', '')[:80]})
    missing_refusals = sorted(persp_assets - refused)
    if missing_refusals:
        unexpected.append({'type': 'PERSPECTIVE_ASSET_WITHOUT_REFUSAL', 'count': len(missing_refusals)})
    ea = {canon(e): e for e in ga['extractors']}
    eb = {canon(e): e for e in gb['extractors']}
    for k, e in ea.items():
        if k not in eb:
            # a facade extractor may go undeclared only where it read nothing but perspective frames
            if e['name'].startswith(FACADE_EXTRACTOR_PREFIX) and e['kind'] == 'DETERMINISTIC_CV' and not any(f['roles']['document'] == 'ELEVATION' or (f['roles']['document'] == 'PERSPECTIVE_RENDER' and f['roles']['projection'] == 'ORTHOGRAPHIC_ELEVATION') for f in fa.values()):
                typed['T5_extractorRemoved'].append(e['name'])
            else:
                unexpected.append({'type': 'EXTRACTOR_REMOVED', 'name': e['name']})
    for k, e in eb.items():
        if k not in ea:
            unexpected.append({'type': 'EXTRACTOR_ADDED', 'name': e['name']})
    ca = {canon(c): c for c in ga.get('conflicts', [])}
    cb = {canon(c): c for c in gb.get('conflicts', [])}
    for k, c in ca.items():
        if k not in cb:
            if any(x in removed_obs for x in c.get('observationIds', [])):
                typed['T6_conflictRemoved'] += 1
            else:
                unexpected.append({'type': 'CONFLICT_REMOVED'})
    for k in cb:
        if k not in ca:
            unexpected.append({'type': 'CONFLICT_ADDED'})
    removed_by_kind = {}
    for oid in removed_obs:
        removed_by_kind[oa[oid]['kind']] = removed_by_kind.get(oa[oid]['kind'], 0) + 1
    return {'perspectiveFrames': len(persp_frames), 'perspectiveAssets': len(persp_assets), 'typed': typed, 'removedByKind': dict(sorted(removed_by_kind.items())),
            'unexpectedCount': len(unexpected), 'unexpected': unexpected[:50], 'orthographicFramesUnchanged': all(
                canon(sorted((o for o in oa.values() if o['frameId'] == fid), key=lambda o: o['id'])) == canon(sorted((o for o in ob.values() if o['frameId'] == fid), key=lambda o: o['id'])) for fid in fa if fid not in persp_frames)}


def compare_row(a, b):
    r = {}
    fa, fb = load(f'{a}/failure.json'), load(f'{b}/failure.json')
    ma = open(f'{a}/model.json', 'rb').read() if os.path.exists(f'{a}/model.json') else None
    mb = open(f'{b}/model.json', 'rb').read() if os.path.exists(f'{b}/model.json') else None
    if fa or fb:
        # P1 for a typed refusal: the same code, reason code and message; the relied-on source is checked in P4'/P2
        r['P1'] = bool(fa and fb and fa['code'] == fb['code'] and fa['reasonCode'] == fb['reasonCode'] and fa['message'] == fb['message'])
        r['outcome'] = f"REFUSED {fa['code'] if fa else '-'}/{fb['code'] if fb else '-'} {fa['reasonCode'] if fa else '-'}"
    else:
        r['P1'] = ma is not None and ma == mb
        r['outcome'] = 'MODEL' if ma is not None else 'MISSING_OUTPUT'
    ga, gb = load(f'{a}/observation-graph.json.gz', True), load(f'{b}/observation-graph.json.gz', True)
    if ga is None or gb is None:
        r['P2'] = r['P4prime'] = None
        r['note'] = 'graph missing on one side'
        return r
    d = graph_diff(ga, gb)
    r['graph'] = d
    r['P2'] = d['orthographicFramesUnchanged'] and not any(u['type'] == 'FRAMES_CHANGED' for u in d['unexpected'])
    r['P4prime'] = d['unexpectedCount'] == 0 and d['typed']['T4_refusalAdded'] == d['perspectiveAssets']
    if fa or fb:
        r['P3'] = None  # §4 P3: a typed refusal keeps no metric evidence content; NOT_MEASURED, never PASS
        r['P5prime'] = r['P6'] = None
        return r
    xa, xb = load(f'{a}/metric-evidence.json.gz', True), load(f'{b}/metric-evidence.json.gz', True)
    r['P3'] = None if xa is None or xb is None else canon(blank(xa)) == canon(blank(xb))
    sa, sb = strip_clock(load(f'{a}/summary.json')), strip_clock(load(f'{b}/summary.json'))
    diffs = []
    for k in sorted(set(sa) | set(sb)):
        if k in IDENTITY_FIELDS:
            continue
        if k == 'counts':
            ca, cb = dict(sa['counts']), dict(sb['counts'])
            if ca.pop('observations', None) - d['typed']['T1_observationRemoved'] != cb.pop('observations', None):
                diffs.append('counts.observations != R0 - removed perspective observations')
            if canon(ca) != canon(cb):
                diffs.append('counts.*')
        elif canon(sa.get(k)) != canon(sb.get(k)):
            diffs.append(k)
    r['P5prime'] = not diffs
    r['P5diff'] = diffs
    ca, cb = load(f'{a}/candidate.json.gz', True), load(f'{b}/candidate.json.gz', True)
    r['P6'] = ca is not None and cb is not None and canon(blank(ca)) == canon(blank(cb))
    pa, pb = load(f'{a}/perf.json'), load(f'{b}/perf.json')
    if pa and pb:
        r['perf'] = {'observationMs': [pa['timings'].get('observationMs'), pb['timings'].get('observationMs')], 'totalMs': [pa['totalMs'], pb['totalMs']], 'peakRssMB': [pa['peakRssMB'], pb['peakRssMB']]}
    return r


def determinism_row(a, b):
    """P7': the same semantic normalisation for both pairs (R0/R0rev and N1v/N1vshuf): byte identity of model, failure,
    graph, metric evidence and candidate; summary identical after stripping CLOCK_FIELDS only."""
    out = {}
    for f in ('model.json', 'failure.json'):
        pa, pb = f'{a}/{f}', f'{b}/{f}'
        if os.path.exists(pa) or os.path.exists(pb):
            out[f] = os.path.exists(pa) and os.path.exists(pb) and open(pa, 'rb').read() == open(pb, 'rb').read()
    for f in ('observation-graph.json.gz', 'metric-evidence.json.gz', 'candidate.json.gz'):
        pa, pb = f'{a}/{f}', f'{b}/{f}'
        if os.path.exists(pa) or os.path.exists(pb):
            out[f] = os.path.exists(pa) and os.path.exists(pb) and gzip.open(pa).read() == gzip.open(pb).read()
    if os.path.exists(f'{a}/summary.json') or os.path.exists(f'{b}/summary.json'):
        sa, sb = load(f'{a}/summary.json'), load(f'{b}/summary.json')
        out['summary.json'] = sa is not None and sb is not None and canon(strip_clock(sa)) == canon(strip_clock(sb))
    out['P7prime'] = bool(out) and all(out.values())
    return out


def main():
    mode, da, db, outp = sys.argv[1:5]
    rows = sys.argv[sys.argv.index('--rows') + 1].split(',') if '--rows' in sys.argv else None
    overrides = [a.split(':', 1)[1] for a in sys.argv if a.startswith('A-override:')]
    cases = sorted(set(os.listdir(da)) & set(os.listdir(db)))
    cases = [c for c in cases if os.path.isdir(f'{da}/{c}') and (rows is None or c in rows)]
    def a_dir(c):
        for o in overrides:
            if os.path.isdir(f'{o}/{c}'):
                return f'{o}/{c}'
        return f'{da}/{c}'
    fn = compare_row if mode == 'predicates' else determinism_row
    res = {c: fn(a_dir(c), f'{db}/{c}') for c in cases}
    keys = ['P1', 'P2', 'P3', 'P4prime', 'P5prime', 'P6'] if mode == 'predicates' else ['P7prime']
    summary = {k: {'pass': sum(1 for r in res.values() if r.get(k) is True), 'fail': sorted(c for c, r in res.items() if r.get(k) is False), 'notMeasured': sorted(c for c, r in res.items() if r.get(k) is None)} for k in keys}
    if mode == 'predicates':
        summary['unexpectedTotal'] = sum(r.get('graph', {}).get('unexpectedCount', 0) for r in res.values())
        summary['observationsRemoved'] = sum(r.get('graph', {}).get('typed', {}).get('T1_observationRemoved', 0) for r in res.values())
        summary['refusalsAdded'] = sum(r.get('graph', {}).get('typed', {}).get('T4_refusalAdded', 0) for r in res.values())
        gaps = {}
        for r in res.values():
            for k, v in r.get('graph', {}).get('typed', {}).get('T3_gapRemoved', {}).items():
                gaps[k] = gaps.get(k, 0) + v
        summary['gapsRemovedByCategory'] = dict(sorted(gaps.items()))
    json.dump({'schema': 'research.005r-router-n1.compare.1', 'mode': mode, 'a': da, 'aOverrides': overrides, 'b': db, 'rows': len(res), 'summary': summary, 'perRow': res}, open(outp, 'w'), indent=1, sort_keys=True)
    print(json.dumps({'rows': len(res), 'summary': summary}, sort_keys=True))


if __name__ == '__main__':
    main()
