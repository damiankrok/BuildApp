#!/usr/bin/env python3
"""m4_orientation_diag.py - BUILDPLAN-ANALYZER-005O addendum A: orientation by the reader's own posterior (diagnostic).

  python3 -I research/analyzer-005o/m4_orientation_diag.py --work /home/user/work005o \
      --out stage-reports/artifacts/analyzer-005o/m4-orientation-diag.json

Decision level only (preregistration addendum A): for every recorded quarter-turn orientation decision, count the
dimension observations on that chain whose ensemble reading corroborates, per orientation; corroborating readings in
exactly one orientation decide it. Scored against the transcription truth's orientation of the chain's legacy
statements (a token-orientation crop both transcribers read upside down = the token orientation was wrong).
"""
import argparse, json, os
from collections import Counter, defaultdict

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FLIP = {'ROTATED_CW': 'ROTATED_CCW', 'ROTATED_CCW': 'ROTATED_CW'}


def corroborating(o):
    e = (o.get('ocr') or {}).get('ensemble') or {}
    return e.get('decision') in ('AGREES', 'LEADS') or (e.get('decision') == 'CONTESTS' and e.get('externalStable') and (e.get('externalPosterior') or 0) >= 0.9)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    cases = json.load(open(os.path.join(REPO, 'research/analyzer-005o/cases.json')))['cases']
    truth = json.load(open(os.path.join(a.work, 'labels', 'truth.json')))['truth']
    tby = defaultdict(list)
    for v in truth.values():
        if v['status'] == 'AGREED' and all(u is not None for u in v['upsideDown']):
            tby[(v['case'], v['evidenceId'])].append(v)
    rows, seen = [], set()
    for c in cases:
        if c['metrics'] in seen:
            continue
        seen.add(c['metrics'])
        m = json.load(open(c['metrics']))
        ev = {e['id']: e for e in m['evidence']}
        tok = {t['id']: t for t in m['ocrTokens']}
        obs_by_chain = defaultdict(list)
        for o in m.get('dimensionObservations', []):
            obs_by_chain[o['chainId']].append(o)
        # truth orientation per chain from its legacy statements
        chain_truth = defaultdict(Counter)
        for e in ev.values():
            if e.get('kind') != 'LINEAR_DIMENSION' or len(e.get('ocrTokenIds', [])) != 1 or not e.get('chainId'):
                continue
            t = tok.get(e['ocrTokenIds'][0])
            for tv in tby.get((c['case'], e['id']), []):
                if t and t.get('orientation') in FLIP and tv['upsideDown'][0] == tv['upsideDown'][1]:
                    chain_truth[e['chainId']][FLIP[t['orientation']] if tv['upsideDown'][0] else t['orientation']] += 1
        for sol in m.get('metricSolutions', []):
            for d in sol.get('orientationDecisions', []):
                cands = {x['orientation'] for x in d['candidates']}
                if cands != {'ROTATED_CW', 'ROTATED_CCW'}:
                    continue
                per = Counter(o['orientation'] for o in obs_by_chain.get(d['chainId'], []) if corroborating(o))
                with_reads = [k for k in ('ROTATED_CW', 'ROTATED_CCW') if per[k] > 0]
                m4 = with_reads[0] if len(with_reads) == 1 else None
                tc = chain_truth.get(d['chainId'])
                tr = tc.most_common(1)[0][0] if tc and len(tc) == 1 else ('CONFLICTING' if tc else None)
                rows.append({'case': c['case'], 'family': c['family'], 'frame': sol['frameId'], 'chain': d['chainId'], 'incumbent': d['chosen'], 'decidedBy': d['decidedBy'],
                             'corroborating': dict(per), 'm4': m4, 'changed': m4 is not None and m4 != d['chosen'], 'truth': tr})
    def judge(r, field):
        if r['truth'] in (None, 'CONFLICTING') or r[field] is None:
            return 'UNKNOWN'
        return 'RIGHT' if r[field] == r['truth'] else 'WRONG'
    for r in rows:
        r['incumbentVsTruth'] = judge(r, 'incumbent')
        r['m4VsTruth'] = judge(r, 'm4')
    changed = [r for r in rows if r['changed']]
    doc = {'schema': 'buildapp.005o.m4-orientation-diag', 'decisions': len(rows), 'm4Decides': sum(1 for r in rows if r['m4']), 'changed': len(changed),
           'changedVsTruth': dict(Counter(r['m4VsTruth'] for r in changed)), 'incumbentVsTruth': dict(Counter(r['incumbentVsTruth'] for r in rows)),
           'm4VsTruthWhereDecides': dict(Counter(r['m4VsTruth'] for r in rows if r['m4'])),
           'changedByDecidedBy': dict(Counter(r['decidedBy'] for r in changed)), 'changedRows': changed,
           'murajach': [r for r in rows if r['case'] == 'dom-w-murajach' and r['changed']]}
    json.dump(doc, open(a.out, 'w'), indent=1, sort_keys=True)
    print(json.dumps({k: v for k, v in doc.items() if k not in ('changedRows',)}, indent=1))


if __name__ == '__main__':
    main()
