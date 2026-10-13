#!/usr/bin/env python3
"""compare_runs.py - BUILDPLAN-ANALYZER-005P byte-level comparison of two replay labels (RESEARCH ONLY).

  python3 -I research/analyzer-005p/compare_runs.py --a /home/user/work005p/runs/P0-frozen --b /home/user/work005p/runs/P0H

Per case: the SHA-256 of every JSON a replay writes (model.json, program.json, result-summary.json, failure.json,
analysis-trace.json, plan-diagnostics/digest.json). Traces are written with zeroed clocks by the offline solver, so
byte identity is the criterion. Prints the cases that differ and which files; exit 1 if any differs.
"""
import argparse, hashlib, json, os, sys

FILES = ('model.json', 'program.json', 'result-summary.json', 'failure.json', 'analysis-trace.json', 'plan-diagnostics/digest.json')


def digest(run, case):
    out = {}
    for f in FILES:
        p = os.path.join(run, case, f)
        out[f] = hashlib.sha256(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--a', required=True)
    ap.add_argument('--b', required=True)
    ap.add_argument('--json')
    a = ap.parse_args()
    cases = sorted(d for d in os.listdir(a.a) if os.path.isdir(os.path.join(a.a, d)))
    rows, differ = [], 0
    for c in cases:
        da, db = digest(a.a, c), digest(a.b, c) if os.path.isdir(os.path.join(a.b, c)) else None
        diff = sorted(f for f in FILES if db is None or da[f] != db[f])
        rows.append({'case': c, 'identical': not diff, 'differs': diff, 'a': da, 'b': db})
        if diff:
            differ += 1
            print(f'DIFF {c}: {", ".join(diff)}')
    print(f'{len(cases) - differ}/{len(cases)} identical ({os.path.basename(a.a)} vs {os.path.basename(a.b)})')
    if a.json:
        json.dump({'a': a.a, 'b': a.b, 'rows': rows}, open(a.json, 'w'), indent=1, sort_keys=True)
    sys.exit(1 if differ else 0)


if __name__ == '__main__':
    main()
