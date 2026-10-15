#!/usr/bin/env python3
"""
a2_propagate.py — 005R addendum A2 (POST-HOC sensitivity, RESEARCH ONLY).

    python3 -I a2_propagate.py <truth.json> <out-truth-a2.json>

An UNKNOWN-truth asset inherits the truth role of its lineage group when the group's structurally labelled members
carry exactly one role; its basis becomes LINEAGE_PROPAGATED (never STRUCTURE, so V0a structure-only scores are
unaffected). Everything else is unchanged. Scoring is then re-run with score_roles.py on this file.
"""
import json
import sys


def main(src, dst):
    t = json.load(open(src))
    roles = {}
    for r in t['rows']:
        if r['roleTruth'] not in ('UNKNOWN', 'TRUTH_CONFLICT'):
            roles.setdefault(r['lineageGroup'], set()).add(r['roleTruth'])
    n = 0
    for r in t['rows']:
        g = roles.get(r['lineageGroup'], set())
        if r['roleTruth'] == 'UNKNOWN' and len(g) == 1:
            r['roleTruth'], r['basis'], r['independentOfV0'] = next(iter(g)), 'LINEAGE_PROPAGATED', False
            n += 1
    t['addendum'] = 'A2 lineage-propagated truth (post-hoc sensitivity)'
    json.dump(t, open(dst, 'w'), indent=1, sort_keys=True)
    print('propagated', n)


if __name__ == '__main__':
    main(*sys.argv[1:3])
