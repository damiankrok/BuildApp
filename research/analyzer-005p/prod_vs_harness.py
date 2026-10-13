#!/usr/bin/env python3
"""prod_vs_harness.py - BUILDPLAN-ANALYZER-005P: the production implementation against the harness variant it implements.

  python3 -I research/analyzer-005p/prod_vs_harness.py --prod /home/user/work005p/runs/PROD --harness /home/user/work005p/runs/N1 --out <json>

Per case: every decision field 005O's scorer reads (outcome, failure code, frame, scale, decision path, semantics), the
model and program after removing exactly the resolver version string ('1.4.0' -> '1.5.0' in the solver version), the
failure message, and the trace after removing what 1.5.0 adds and nothing else: `resolverVersion`, the new
`conflictDoubted` key, and SOURCE_CONFLICT_REVIEW entries (listed separately). Exit 1 if anything else differs.
"""
import argparse, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'analyzer-005o'))
import score as S  # noqa: E402

def norm_model(p):
    if not os.path.exists(p):
        return None
    return open(p).read().replace('resolver.1.5.0', 'resolver.1.4.0').replace('"plan-resolver":"1.5.0"', '"plan-resolver":"1.4.0"')

def norm_trace(p):
    if not os.path.exists(p):
        return None, []
    t = json.load(open(p))
    reviews = [e for e in t['entries'] if e.get('substage') == 'SOURCE_CONFLICT_REVIEW']
    entries = []
    for e in t['entries']:
        if e.get('substage') == 'SOURCE_CONFLICT_REVIEW':
            continue
        c = {k: v for k, v in e.get('counts', {}).items() if k not in ('resolverVersion', 'conflictDoubted')}
        entries.append({**e, 'counts': c})
    return json.dumps({**t, 'entries': entries}, sort_keys=True), reviews

def norm_digest(p):
    if not os.path.exists(p):
        return None
    d = json.load(open(p))
    for k in ('challenge', 'resolution'):
        if isinstance(d.get(k), dict):
            d[k] = {kk: vv for kk, vv in d[k].items() if kk not in ('resolverVersion', 'conflictDoubted')}
    return json.dumps(d, sort_keys=True)

ap = argparse.ArgumentParser()
ap.add_argument('--prod', required=True)
ap.add_argument('--harness', required=True)
ap.add_argument('--out')
a = ap.parse_args()
rows, bad = [], 0
for c in sorted(x for x in os.listdir(a.prod) if os.path.isdir(os.path.join(a.prod, x))):
    P, H = os.path.join(a.prod, c), os.path.join(a.harness, c)
    op, oh = S.outcome(P), S.outcome(H)
    keys = ('outcome', 'code', 'frame', 'scale', 'semantics', 'failureMessage')
    dec_p = {k: op.get(k) for k in keys}
    dec_h = {k: oh.get(k) for k in keys}
    strip = lambda dp: {s: {k: v for k, v in r.items() if k not in ('resolverVersion',)} for s, r in dp.items()}
    tp, reviews = norm_trace(os.path.join(P, 'analysis-trace.json'))
    th, _ = norm_trace(os.path.join(H, 'analysis-trace.json'))
    diffs = [k for k in keys if dec_p[k] != dec_h[k]]
    if strip(op.get('decisionPath', {})) != strip(oh.get('decisionPath', {})):
        diffs.append('decisionPath')
    for name, f in (('model', 'model.json'), ('program', 'program.json')):
        if norm_model(os.path.join(P, f)) != norm_model(os.path.join(H, f)):
            diffs.append(name)
    if norm_digest(os.path.join(P, 'plan-diagnostics', 'digest.json')) != norm_digest(os.path.join(H, 'plan-diagnostics', 'digest.json')):
        diffs.append('digest')
    if tp != th:
        diffs.append('trace')
    rows.append({'case': c, 'identicalDecisions': not diffs, 'differs': diffs, 'withdrawnReviews': [r.get('counts') for r in reviews]})
    if diffs:
        bad += 1
        print('DIFF', c, diffs)
    if reviews:
        print('REVIEW', c, json.dumps(reviews[0].get('counts'))[:600])
print(f'{len(rows) - bad}/{len(rows)} production = harness (normalised as documented)')
if a.out:
    json.dump(rows, open(a.out, 'w'), indent=1, sort_keys=True)
sys.exit(1 if bad else 0)
