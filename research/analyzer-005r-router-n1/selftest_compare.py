#!/usr/bin/env python3
"""
selftest_compare.py — harness self-test of compare_n1.graph_diff on INCUMBENT graphs only (RESEARCH ONLY).

    python3 -I research/analyzer-005r-router-n1/selftest_compare.py <R0 row dir>

Builds, in memory, the graph the preregistered gate should produce from an R0 graph (perspective observations and
their relations removed, non-pre-gate gaps of perspective assets removed, one refusal per perspective asset added),
and four mutants of it. The ideal transform must pass P4' with 0 unexpected; every mutant must fail. No challenger
output is read.
"""
import copy, gzip, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from compare_n1 import graph_diff, REFUSAL_PREFIX, PRE_GATE_GAPS

g = json.load(gzip.open(os.path.join(sys.argv[1], 'observation-graph.json.gz'), 'rt'))
persp = {f['id'] for f in g['coordinateFrames'] if f['roles']['document'] == 'PERSPECTIVE_RENDER' and f['roles']['projection'] != 'ORTHOGRAPHIC_ELEVATION'}
assets = {f['assetId'] for f in g['coordinateFrames'] if f['id'] in persp}
def ideal():
    b = copy.deepcopy(g)
    gone = {o['id'] for o in b['observations'] if o['frameId'] in persp}
    b['observations'] = [o for o in b['observations'] if o['id'] not in gone]
    b['relations'] = [r for r in b['relations'] if r.get('from') not in gone and r.get('to') not in gone]
    b['unresolved'] = [u for u in b['unresolved'] if not (u.get('assetId') in assets and not u['what'].startswith(PRE_GATE_GAPS))]
    b['unresolved'] += [{'assetId': a, 'id': 'gap-x-' + a, 'reason': 'r', 'status': 'NOT_ATTEMPTED', 'what': REFUSAL_PREFIX + a} for a in sorted(assets)]
    return b
res = {}
d = graph_diff(g, ideal()); res['ideal'] = (d['unexpectedCount'] == 0 and d['typed']['T4_refusalAdded'] == len(assets), d['typed']['T1_observationRemoved'])
m = ideal(); ortho = next(o for o in m['observations'] if o['frameId'] not in persp); m['observations'].remove(ortho)
d = graph_diff(g, m); res['mutant_orthographic_removed'] = d['unexpectedCount'] > 0
m = ideal(); m['unresolved'] = [u for u in m['unresolved'] if not u['what'].startswith(REFUSAL_PREFIX)][:-0 or None]; m['unresolved'] = [u for u in m['unresolved'] if not u['what'].startswith(REFUSAL_PREFIX)]
d = graph_diff(g, m); res['mutant_no_refusal'] = d['unexpectedCount'] > 0
m = ideal(); m['unresolved'].append({'assetId': sorted(assets)[0], 'id': 'gap-fake', 'reason': 'r', 'status': 'MISSING', 'what': 'any observation at all on asset ' + sorted(assets)[0]})
d = graph_diff(g, m); res['mutant_fake_missing'] = d['unexpectedCount'] > 0
m = ideal(); o = copy.deepcopy(next(o for o in g['observations'] if o['frameId'] in persp)); m['observations'].append(o)
d = graph_diff(g, m); res['mutant_perspective_observation_kept'] = d['unexpectedCount'] > 0
nonp = [u for u in g['unresolved'] if u.get('assetId') not in assets]
if nonp:
    m = ideal(); m['unresolved'] = [u for u in m['unresolved'] if u != nonp[0]]
    d = graph_diff(g, m); res['mutant_orthographic_gap_removed'] = d['unexpectedCount'] > 0
print(json.dumps({'row': os.path.basename(sys.argv[1].rstrip('/')), 'perspectiveAssets': len(assets), **{k: v for k, v in res.items()}}))
ok = res['ideal'][0] and all(v for k, v in res.items() if k != 'ideal')
sys.exit(0 if ok else 1)
