#!/usr/bin/env python3
"""
p8_n1.py — BUILDPLAN-ANALYZER-005R-ROUTER-N1-ADOPT P8 (ledger + cameras) from ledger.ts dumps (RESEARCH ONLY).

    python3 -I research/analyzer-005r-router-n1/p8_n1.py <baseline dump dir> <challenger dump dir> <out.json>

Baseline dumps are `<R0|R0fix>-<row>.json.gz` (R0fix preferred, as everywhere in this stage); challenger dumps are
`<label>-<row>.json.gz` (any single label). Per row (preregistration.md §4 P8), all must hold:
  - the solver's model hash is identical;
  - cameras identical (frame, solved, residual) — every solved perspective camera is preserved;
  - ledger violations and feature-graph violations identical in content (a pre-existing one stays, none is added);
  - no ledger record is added;
  - every removed record names evidence that lay on a perspective frame in the baseline;
  - the challenger ledger holds 0 USED_AS_CORROBORATION records whose evidence lay on a perspective frame.
Reported, never a target: removed records by disposition (USED_AS_CORROBORATION count included).
"""
import glob
import gzip
import json
import os
import sys

KEYS = ('evidenceId', 'evidenceKind', 'disposition', 'reason', 'stage', 'what', 'authority')


def records(dump):
    led = dump['ledger']
    return led['records'] if isinstance(led, dict) and 'records' in led else led


def main(base_dir, chal_dir, outp):
    out = {}
    for f in sorted(glob.glob(os.path.join(chal_dir, '*.json.gz'))):
        label, row = os.path.basename(f)[:-8].split('-', 1)
        base = next((p for p in (os.path.join(base_dir, f'R0fix-{row}.json.gz'), os.path.join(base_dir, f'R0-{row}.json.gz')) if os.path.exists(p)), None)
        if base is None:
            out[row] = {'P8': None, 'note': 'no baseline dump'}
            continue
        a, b = json.load(gzip.open(base, 'rt')), json.load(gzip.open(f, 'rt'))
        key = lambda r: json.dumps({k: r.get(k) for k in KEYS}, sort_keys=True)
        ra, rb = {key(r): r for r in records(a)}, {key(r): r for r in records(b)}
        persp = set(a['perspectiveEvidenceIds'])
        removed = [ra[k] for k in ra if k not in rb]
        added = [rb[k] for k in rb if k not in ra]
        by_disp = {}
        for r in removed:
            by_disp[r['disposition']] = by_disp.get(r['disposition'], 0) + 1
        left_persp_corrob = sum(1 for r in rb.values() if r['disposition'] == 'USED_AS_CORROBORATION' and (r['evidenceId'] in persp or r['evidenceId'] in set(b['perspectiveEvidenceIds'])))
        checks = {
            'modelEqual': a['modelHash'] == b['modelHash'],
            'camerasEqual': a['cameras'] == b['cameras'],
            'violationsEqual': json.dumps(a['violations'], sort_keys=True) == json.dumps(b['violations'], sort_keys=True),
            'noneAdded': not added,
            'removedAllPerspective': all(r['evidenceId'] in persp for r in removed),
            'noPerspectiveCorroborationLeft': left_persp_corrob == 0,
        }
        out[row] = {'baseline': os.path.basename(base).split('-')[0], 'challenger': label, **checks, 'P8': all(checks.values()),
                    'camerasSolved': [sum(1 for c in a['cameras'] if c['solved']), sum(1 for c in b['cameras'] if c['solved'])],
                    'cameras': len(a['cameras']), 'violations': len(a['violations'].get('ledger', [])) + len(a['violations'].get('graph', [])),
                    'featureGraphHashEqual': a.get('featureGraphHash') == b.get('featureGraphHash'),
                    'removed': len(removed), 'removedByDisposition': dict(sorted(by_disp.items())), 'added': len(added),
                    'challengerPerspectiveEvidence': len(b['perspectiveEvidenceIds'])}
    rows = [r for r in out.values() if r.get('P8') is not None]
    summary = {'rows': len(out), 'P8pass': sum(1 for r in rows if r['P8']), 'P8fail': sorted(k for k, r in out.items() if r.get('P8') is False),
               'camerasSolvedBaseline': sum(r['camerasSolved'][0] for r in rows), 'camerasSolvedChallenger': sum(r['camerasSolved'][1] for r in rows),
               'usedAsCorroborationRemoved': sum(r['removedByDisposition'].get('USED_AS_CORROBORATION', 0) for r in rows),
               'recordsAdded': sum(r['added'] for r in rows)}
    json.dump({'schema': 'research.005r-router-n1.p8.1', 'summary': summary, 'perRow': out}, open(outp, 'w'), indent=1, sort_keys=True)
    print(json.dumps(summary, sort_keys=True))


if __name__ == '__main__':
    main(*sys.argv[1:4])
