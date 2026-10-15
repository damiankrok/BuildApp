#!/usr/bin/env python3
"""
p9_mislabel.py — 005R-ROUTER preregistration P9, ELEVATION_MISLABELLED_RISK (RESEARCH ONLY).

    python3 -I research/analyzer-005r-router/p9_mislabel.py <out.json>

Counts PERSPECTIVE_RENDER assets whose bytes the publisher's page structure files as an elevation (005R
role-truth.json, basis STRUCTURE = the elevation tab), over (a) the 005R corpus through the incumbent's own roles
(V0a-routes.json) and (b) the sealed development packages of the replay rows. The structure is a hint, not truth.
"""
import collections
import json
import sys

R = 'stage-reports/artifacts/analyzer-005r'
truth = {r['assetId']: r for r in json.load(open(f'{R}/roles/role-truth.json'))['rows']}
by_sha = {r['variantSha256']: r['roleTruth'] for r in truth.values()}
corpus = collections.Counter()
for r in json.load(open(f'{R}/contenders/V0a-routes.json'))['rows']:
    corpus[f"{truth.get(r['assetId'], {}).get('roleTruth')}->{r.get('v0Document')}"] += 1
dev = collections.Counter()
rows = 0
for c in json.load(open('research/analyzer-005q-chain/cases.json'))['cases']:
    if c['mode'] != 'EXTRACT':
        continue
    p = json.load(open(c['package']))
    if 'dobredomy.pl' in p['canonicalUrl']:
        continue
    rows += 1
    for a in p['assets']:
        if a['roles']['document'] != 'PERSPECTIVE_RENDER':
            continue
        t = sorted({by_sha[v['byteHash']] for v in a['variants'] if v['byteHash'] in by_sha}) or ['NOT_IN_005R_CORPUS']
        dev['+'.join(t)] += 1
out = {'schema': 'research.005r-router.p9.0.1', 'note': 'structure is the publisher filing (hint), not truth',
       'corpus005R_truthToIncumbentDocument': dict(sorted(corpus.items())),
       'corpus005R_structuralElevationsFiledAsPerspective': corpus.get('TECHNICAL_ELEVATION->PERSPECTIVE_RENDER', 0),
       'corpus005R_structuralElevations': sum(v for k, v in corpus.items() if k.startswith('TECHNICAL_ELEVATION->')),
       'devRows': rows, 'devPerspectiveAssetsByStructure': dict(sorted(dev.items())),
       'ELEVATION_MISLABELLED_RISK': corpus.get('TECHNICAL_ELEVATION->PERSPECTIVE_RENDER', 0) + dev.get('TECHNICAL_ELEVATION', 0)}
json.dump(out, open(sys.argv[1], 'w'), indent=1, sort_keys=True)
print(json.dumps(out, sort_keys=True))
