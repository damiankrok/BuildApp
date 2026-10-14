#!/usr/bin/env python3
"""explain_g5.py - BUILDPLAN-ANALYZER-005Q-CHAIN: decision-path explanation of every changed refusal/decision (G5).

  python3 -I research/analyzer-005q-chain/explain_g5.py --work /home/user/work005q-chain --labels C1,C2,C3,N1,C4,C1N1 \
      --out stage-reports/artifacts/analyzer-005q-chain/house-semantic-delta/G5-explanations.json

For each row the gate lists, it records the first decision stage whose outcome or reading differs from C0 (stage order as
recorded by score_houses.py), both readings, and what moved upstream in the selected plan frame: registration presence,
anchor count, metres per pixel X/Y, scale. The mechanism class is computed from those facts (addendum C, C-1: plus the production solver's own use of the
published footprint, which every variant receives — the class PUBLISHED_AREA_REFUSAL comes first when it applies):
  PUBLISHED_AREA_REFUSAL the variant's run is refused by the layout gate's FOOTPRINT_AREA_WRONG and C0's is not
  REGISTRATION_LOST     the selected frame had a registration under C0 and has none (or a different frame) now
  REGISTRATION_MOVED    the registration exists in both and mpp moved by more than 0.1 %
  STATEMENTS_ONLY       the registration is unchanged (<= 0.1 %); only the stated values / statements changed
  NO_PLAN_FRAME         neither run selected a plan frame (failure before the metric)
"""
import argparse, json


def rel(a, b):
    return None if not a or not b else abs(b / a - 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--labels', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    base = {r['case']: r for r in json.load(open(f'{a.work}/score-C0.json'))['rows']}
    out = {'schema': 'buildapp.005q-chain.g5-explanations', 'version': 1, 'variants': {}}
    for L in a.labels.split(','):
        gates = json.load(open(f'{a.work}/gates-{L}.json'))
        rows = {r['case']: r for r in json.load(open(f'{a.work}/score-{L}.json'))['rows']}
        lst = []
        for ch in gates['G5']['changedRefusalsOrDecisions']:
            c = ch['case']
            b, v = base[c], rows[c]
            dp_b, dp_v = b.get('decisionPath') or {}, v.get('decisionPath') or {}
            first = None
            for st in list(dict.fromkeys(list(dp_b) + list(dp_v))):
                if dp_b.get(st) != dp_v.get(st):
                    first = {'stage': st, 'was': dp_b.get(st), 'now': dp_v.get(st)}
                    break
            sb = (b.get('metric') or {}).get(b.get('frame') or '', {}) if b.get('frame') else {}
            sv = (v.get('metric') or {}).get(v.get('frame') or '', {}) if v.get('frame') else {}
            reg_b = sb.get('mppX') is not None
            reg_v = sv.get('mppX') is not None
            if v.get('gateBlocking') == 'FOOTPRINT_AREA_WRONG' and b.get('gateBlocking') != 'FOOTPRINT_AREA_WRONG':
                mech = 'PUBLISHED_AREA_REFUSAL'
            elif not b.get('frame') and not v.get('frame'):
                mech = 'NO_PLAN_FRAME'
            elif reg_b and (not reg_v or b.get('frame') != v.get('frame')):
                mech = 'REGISTRATION_LOST'
            elif reg_b and reg_v and max(rel(sb['mppX'], sv['mppX']) or 0, rel(sb.get('mppY'), sv.get('mppY')) or 0) > 0.001:
                mech = 'REGISTRATION_MOVED'
            else:
                mech = 'STATEMENTS_ONLY'
            lst.append({'case': c, 'was': ch['was'], 'now': ch['now'], 'mechanism': mech, 'firstDifferingDecision': first,
                        'selectedFrame': [b.get('frame'), v.get('frame')],
                        'registration': [{k: sb.get(k) for k in ('mppX', 'mppY', 'anchors', 'confidence')} if sb else None,
                                         {k: sv.get(k) for k in ('mppX', 'mppY', 'anchors', 'confidence')} if sv else None],
                        'scaleCmPerPx': [b.get('scaleCmPerPx'), v.get('scaleCmPerPx')],
                        'publishedFigure': [b.get('publishedFigure'), v.get('publishedFigure')], 'gateBlocking': [b.get('gateBlocking'), v.get('gateBlocking')]})
        out['variants'][L] = lst
    json.dump(out, open(a.out, 'w'), indent=1, sort_keys=True)
    for L, lst in out['variants'].items():
        print(L, [(x['case'], x['mechanism'], (x['firstDifferingDecision'] or {}).get('stage')) for x in lst])


if __name__ == '__main__':
    main()
