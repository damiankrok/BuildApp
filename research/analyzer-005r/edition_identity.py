#!/usr/bin/env python3
"""
edition_identity.py — 005R §5.2 edition-identity measurements (RESEARCH ONLY).

    python3 -I edition_identity.py <corpus-manifest.json> <truth.json> <out.json>

Cross-edition shared assets (byte-identical bytes published by ≥ 2 editions), shared lineage groups (near-duplicates
across editions), the overlap between OWNER's anchor edition and the dev row named "rarytasy-g2e" (G2E-5), and the
same for every pair of Rarytasy editions; by truth role.
"""
import itertools
import json
import sys

ANCHOR, DEVROW, EOZE = 'archon:m3ea28300f9b3e', 'archon:m84f2903cb8e14', 'archon:m738275b7537b0'


def main(man_p, truth_p, out_p):
    m = json.load(open(man_p))
    truth = {r['assetId']: r['roleTruth'] for r in json.load(open(truth_p))['rows']}
    shared = [a for a in m['assets'] if len(a['editions']) > 1]
    by_role = {}
    for a in shared:
        by_role[truth.get(a['assetId'], 'UNKNOWN')] = by_role.get(truth.get(a['assetId'], 'UNKNOWN'), 0) + 1
    groups = {}
    for a in m['assets']:
        groups.setdefault(a['lineageGroup'], set()).update(a['editions'])
    cross_groups = sum(1 for e in groups.values() if len(e) > 1)
    ed_bytes = {k: set(v['variantSha256']) for k, v in m['editions'].items()}
    ed_groups = {}
    for a in m['assets']:
        for e in a['editions']:
            ed_groups.setdefault(e, set()).add(a['lineageGroup'])

    def overlap(x, y):
        return {'bytesX': len(ed_bytes.get(x, ())), 'bytesY': len(ed_bytes.get(y, ())), 'sharedBytes': len(ed_bytes.get(x, set()) & ed_bytes.get(y, set())),
                'sharedLineageGroups': len(ed_groups.get(x, set()) & ed_groups.get(y, set()))}
    rary = sorted(k for k, v in m['editions'].items() if 'rarytas' in v['family'])
    pairs = {f'{x}|{y}': overlap(x, y) for x, y in itertools.combinations(rary, 2)}
    shared_pairs = sum(1 for v in pairs.values() if v['sharedBytes'] > 0)
    out = {'schema': 'research.005r.edition-identity.0.1',
           'assetsSharedAcrossEditions': len(shared), 'sharedByTruthRole': by_role,
           'assetsSharedAcrossFamilies': sum(1 for a in m['assets'] if len(a['families']) > 1),
           'lineageGroupsSpanningEditions': cross_groups, 'lineageGroups': len(groups),
           'anchorVsDevRowG2E5': overlap(ANCHOR, DEVROW), 'anchorVsEoze': overlap(ANCHOR, EOZE), 'devRowVsEoze': overlap(DEVROW, EOZE),
           'rarytasyEditions': len(rary), 'rarytasyPairsSharingBytes': shared_pairs, 'rarytasyPairs': len(pairs),
           'maxEditionsPublishingOneAsset': max(len(a['editions']) for a in m['assets'])}
    json.dump(out, open(out_p, 'w'), indent=1, sort_keys=True)
    print(json.dumps({k: v for k, v in out.items()}, indent=1))


if __name__ == '__main__':
    main(*sys.argv[1:4])
