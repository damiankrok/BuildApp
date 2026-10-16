#!/usr/bin/env python3
"""
e_strict.py — 005R-EXTERIOR addendum E, POST-HOC sensitivity after the independent audit (RESEARCH ONLY).

    python3 -I research/analyzer-005r-exterior/addenda/e_strict.py

Does not change B1 or any sealed rule. It recounts B1's TECHNICALLY_CORROBORATED proposals under the audit's stricter
reading and writes results/addendum-e-strict.json:

  GARAGE_ENCLOSED  the plan schedule, the printed garage area and the door specification are on the SAME publisher
                   page as the categories and the description; they are one printed fact, not an orthographic reading.
                   Strictly they are PUBLISHER_SPEC_SHEET_CONSISTENCY, never technical corroboration.
  TERRACE          production TERRACE is "the recess floor at the threshold". Strictly it counts only when (a) the
                   edition has frame-sighted production features (not MODEL_ONLY), (b) at least one recess of the
                   edition is NOT denied by production ("a zone, not a recess"), and (c) the claim is a product CATEGORY
                   (the bare description token "taras" is positive in every edition and discriminates nothing).
"""
import collections
import json
import os
import sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, R)
from common import dump  # noqa: E402

m = json.load(open(os.path.join(R, 'results/corpus-manifest.json')))
b1 = json.load(open(os.path.join(R, 'results/proposals-B1.json')))
rows = []
for p in b1['proposals']:
    if p['scope'] != 'EDITION' or p['verificationStatus'] != 'TECHNICALLY_CORROBORATED':
        continue
    e = m['editions'][p['projectEditionId']]
    t = e['technical'] or {}
    if p['featureClass'] == 'GARAGE_ENCLOSED':
        strict, why = 'PUBLISHER_SPEC_SHEET_CONSISTENCY', 'schedule, area and door spec are the same publisher page'
    elif p['featureClass'] == 'TERRACE':
        sighted = t.get('featureSource') == 'FEATURE_GRAPH' and any(f['frames'] for f in t['features'] if f['featureClass'] == 'TERRACE')
        recesses = [f for f in t.get('features', []) if f['productionFamily'] == 'RECESS']
        live_recess = any(not f['productionDeniesRecess'] for f in recesses)
        category = e['publisherClaims']['category'].get('TERRACE') == 'POSITIVE'
        ok = sighted and live_recess and category
        strict = 'TECHNICALLY_CORROBORATED_STRICT' if ok else 'WEAK'
        why = f"sighted={sighted} undeniedRecess={live_recess} categoryClaim={category}"
    else:
        strict, why = 'UNCHANGED', ''
    rows.append({'edition': p['projectEditionId'], 'family': e['family'], 'class': p['featureClass'], 'strict': strict, 'basis': why})
rows.sort(key=lambda r: (r['class'], r['edition']))
summary = collections.Counter(f"{r['class']}:{r['strict']}" for r in rows)
out = {'schema': 'research.005r-exterior.addendum-e.0.1', 'posthoc': True, 'rows': rows, 'summary': dict(sorted(summary.items())),
       'strictFamilies': {c: len({r['family'] for r in rows if r['class'] == c and r['strict'] == 'TECHNICALLY_CORROBORATED_STRICT'}) for c in ('GARAGE_ENCLOSED', 'TERRACE')}}
dump(out, os.path.join(R, 'results/addendum-e-strict.json'))
print(json.dumps(out['summary']), out['strictFamilies'])
for r in rows:
    print(r)
