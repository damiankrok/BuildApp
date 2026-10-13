#!/usr/bin/env python3
"""strip_external.py - BUILDPLAN-ANALYZER-005P (RESEARCH ONLY): each case's sealed metric evidence with every external
reading and ensemble record removed from its numeric lattices, written OUTSIDE the repository, for the production
strip-external control (review E5): with no external reader, plan resolver 1.5.0 must decide every case as 1.4.0 did.

  python3 -I research/analyzer-005p/strip_external.py --cases research/analyzer-005o/cases.json --out /home/user/work005p/stripped
"""
import argparse, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--cases', required=True)
ap.add_argument('--out', required=True)
a = ap.parse_args()
if os.path.abspath(a.out).startswith(os.path.abspath(os.path.join(HERE, '..', '..'))):
    sys.exit('stripped evidence lives outside the repository')
os.makedirs(a.out, exist_ok=True)
for c in json.load(open(a.cases))['cases']:
    m = json.load(open(c['metrics']))
    n = 0
    for l in m.get('numericLattices', []):
        n += ('external' in l) + ('ensemble' in l)
        l.pop('external', None)
        l.pop('ensemble', None)
    json.dump(m, open(os.path.join(a.out, c['case'] + '.json'), 'w'))
    print(f"{c['case']:24s} removed {n}")
