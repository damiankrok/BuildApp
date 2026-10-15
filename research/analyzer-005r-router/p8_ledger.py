#!/usr/bin/env python3
"""
p8_ledger.py — 005R-ROUTER preregistration P8 from ledger.ts dumps (RESEARCH ONLY).

    python3 -I research/analyzer-005r-router/p8_ledger.py <ledger dir> <out.json>

Per row: R0 (or R0fix) vs N1 ledger records (evidenceId, disposition, reason, stage, what); P8 holds when nothing is
added and every removed record names evidence on a perspective frame. Also: model hash, cameras, violations.
"""
import glob
import gzip
import json
import os
import sys


def main(d, outp):
    out = {}
    for f in sorted(glob.glob(os.path.join(d, 'N1-*.json.gz'))):
        c = os.path.basename(f)[3:-8]
        base = next((p for p in (os.path.join(d, f'R0fix-{c}.json.gz'), os.path.join(d, f'R0-{c}.json.gz')) if os.path.exists(p)), None)
        if base is None:
            continue
        a, b = json.load(gzip.open(base, 'rt')), json.load(gzip.open(f, 'rt'))
        rec = lambda L: {json.dumps({k: r.get(k) for k in ('evidenceId', 'disposition', 'reason', 'stage', 'what')}, sort_keys=True) for r in (L['records'] if isinstance(L, dict) and 'records' in L else L)}
        ra, rb = rec(a['ledger']), rec(b['ledger'])
        removed = [json.loads(x) for x in ra - rb]
        persp = set(a['perspectiveEvidenceIds'])
        out[c] = {'baseline': os.path.basename(base).split('-')[0], 'modelEqual': a['modelHash'] == b['modelHash'], 'camerasEqual': a['cameras'] == b['cameras'],
                  'camerasSolved': sum(x['solved'] for x in a['cameras']), 'violationsN1': len(b['violations']['ledger']) + len(b['violations']['graph']),
                  'removed': len(removed), 'added': len(rb - ra), 'P8': not (rb - ra) and all(r['evidenceId'] in persp for r in removed),
                  'removedUsedAsCorroboration': sum(1 for r in removed if r['disposition'] == 'USED_AS_CORROBORATION')}
    json.dump(out, open(outp, 'w'), indent=1, sort_keys=True)
    print(json.dumps({'rows': len(out), 'P8': sum(r['P8'] for r in out.values()), 'cameras': sum(r['camerasSolved'] for r in out.values()), 'usedAsCorroborationRemoved': sum(r['removedUsedAsCorroboration'] for r in out.values())}))


if __name__ == '__main__':
    main(*sys.argv[1:3])
