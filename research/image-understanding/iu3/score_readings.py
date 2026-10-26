"""IU-03A part B: are the facade readings RIGHT, not just more? Each reading of each variant is matched to the
house's openings as the PLAN places them (the RAW run's model openings: placed from plan gaps, independent of the
elevation pixels — their count is identical across the variants, which the output checks) on the same facade and storey.

  correct    along-facade overlap >= 50 % of the shorter interval with a plan opening
  unmatched  no such plan opening: a false opening, or one the plan lacks (reported, not hidden)
  duplicate  a second reading on a plan opening already matched in the same view

    python3 -I iu3/score_readings.py <extract-*.json ...>    (prints JSON)
"""
import json, sys
from collections import defaultdict


def overlap(a, b):
    lo, hi = max(a[0], b[0]), min(a[1], b[1])
    return max(0.0, hi - lo) / max(1e-6, min(a[1] - a[0], b[1] - b[0]))


def score(res):
    plan = res['results']['RAW']['openings']
    out = {}
    for name, r in res['results'].items():
        seen = defaultdict(set)
        c = u = d = 0
        per_view = defaultdict(lambda: {'correct': 0, 'unmatched': 0, 'duplicate': 0})
        positions = []
        for x in r['readings']:
            cand = [i for i, o in enumerate(plan) if o['facade'] == x['facade'] and o['storeyIndex'] == x['storeyIndex'] and overlap((x['from'], x['to']), tuple(o['interval'])) >= 0.5]
            v = per_view[x['frameId'][-10:]]
            if not cand:
                u += 1; v['unmatched'] += 1; status = 'UNMATCHED'
            elif all(i in seen[x['frameId']] for i in cand):
                d += 1; v['duplicate'] += 1; status = 'DUPLICATE'
            else:
                i = next(i for i in cand if i not in seen[x['frameId']]); seen[x['frameId']].add(i); c += 1; v['correct'] += 1; status = 'CORRECT'
                o = plan[i]
                positions.append({'centreErrorM': round(abs((x['from'] + x['to']) / 2 - sum(o['interval']) / 2), 3), 'widthErrorM': round(abs((x['to'] - x['from']) - (o['interval'][1] - o['interval'][0])), 3)})
        out[name] = {'readings': len(r['readings']), 'correct': c, 'unmatched': u, 'duplicate': d,
                     'views': len(r['facadeViews']), 'byRegistration': dict(__import__('collections').Counter(v['registration'] for v in r['facadeViews'])),
                     'medianCentreErrorM': sorted(p['centreErrorM'] for p in positions)[len(positions) // 2] if positions else None,
                     'modelOpenings': len(r['openings']), 'perView': dict(per_view)}
    return out


if __name__ == '__main__':
    res = {}
    for p in sys.argv[1:]:
        d = json.load(open(p)); res[d['house']] = score(d)
    tot = defaultdict(lambda: defaultdict(int))
    for h, s in res.items():
        for name, v in s.items():
            for k in ('readings', 'correct', 'unmatched', 'duplicate', 'views', 'modelOpenings'):
                tot[name][k] += v[k]
    print(json.dumps({'houses': res, 'total': tot}, indent=1))
