#!/usr/bin/env python3
"""prod_vs_harness.py -- BUILDPLAN-ANALYZER-005Q: per-row output hashes of several replays (RESEARCH ONLY).

    python3 research/analyzer-005q/prod_vs_harness.py --work /home/user/work005q \
        --labels S0,N1a,PROD2,PROD2-rep --pairs N1a=PROD2,PROD2=PROD2-rep,S0=PROD2 \
        --out stage-reports/artifacts/analyzer-005q/prod-vs-harness.json

For every case of cases.json and every replay label, the sha-256 of each output file the solver writes (model,
program, failure, trace, digest, unresolved, provenance; wall-clock logs excluded) is recorded, and for each pair the
rows whose files differ are listed by file. Only hashes and file names are written: no output content, no path.
"""
import argparse
import hashlib
import json
import os

FILES = ['model.json', 'program.json', 'failure.json', 'analysis-trace.json', 'plan-diagnostics/digest.json', 'unresolved.json', 'provenance.json', 'result-summary.json']


def sha(path):
    if not os.path.exists(path):
        return None
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--labels', required=True)
    ap.add_argument('--pairs', default='')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    cases = json.load(open(os.path.join(here, 'cases.json')))['cases']
    labels = [x for x in a.labels.split(',') if x]
    rows = []
    for c in cases:
        cid = c['case']
        row = {'case': cid, 'hashes': {}}
        for lab in labels:
            d = os.path.join(a.work, 'runs', lab, cid)
            row['hashes'][lab] = {f: sha(os.path.join(d, f)) for f in FILES if sha(os.path.join(d, f)) is not None}
        rows.append(row)
    pairs = []
    for p in [x for x in a.pairs.split(',') if x]:
        left, right = p.split('=')
        diffs = []
        missing = []
        for r in rows:
            lh, rh = r['hashes'].get(left, {}), r['hashes'].get(right, {})
            if not lh or not rh:
                missing.append(r['case'])
                continue
            files = sorted(f for f in set(lh) | set(rh) if lh.get(f) != rh.get(f))
            if files:
                diffs.append({'case': r['case'], 'files': files})
        pairs.append({'left': left, 'right': right, 'rows': len(rows) - len(missing), 'identicalRows': len(rows) - len(missing) - len(diffs), 'differing': diffs, 'missing': missing})
    out = {'stage': 'BUILDPLAN-ANALYZER-005Q', 'kind': 'per-row output hashes of solver-only replays on sealed inputs', 'files': FILES, 'labels': labels, 'pairs': pairs, 'rows': rows}
    with open(a.out, 'w') as f:
        json.dump(out, f, indent=1)
        f.write('\n')
    for p in pairs:
        print(f"{p['left']} vs {p['right']}: {p['identicalRows']}/{p['rows']} identical; differing {[d['case'] for d in p['differing']]}; missing {p['missing']}")


if __name__ == '__main__':
    main()
