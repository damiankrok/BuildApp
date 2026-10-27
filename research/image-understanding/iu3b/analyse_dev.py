"""IU-03B: what each variant would do on the DEVELOPMENT images (IU-02 FINAL, IU-03A test sets, synthetic, LoC,
Commons, negatives — all already seen; none of this is a blind result).

Variants (all keep the LEGACY route under ADVERSE captions = every image captioned "elevation"):
  A        IU-03A VETO_ONLY: unmasked projection EVIDENT/NOT_SINGLE, or P(not elevation) >= 0.60
  B        A + projection inside the classical (sky/foliage-free) mask: PERSPECTIVE_EVIDENT -> STOP
  B_S(z,d) A + inside the classical mask, a family with enough well-spread edges, z >= z and distortion >= d px -> STOP
  ..._T    the masked test runs only when a trigger fires (classifier not sure, full test INCONCLUSIVE, foliage)

    $PY iu3b/analyse_dev.py --rows <dev-rows.json> --collect <dev-collect.jsonl> [--upernet <jsonl>] --out <json>
"""
import json, os, sys
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from iu.paths import refuse_inside_repo, arg_value
if __name__ == '__main__':
    refuse_inside_repo(arg_value('--out', ''), 'IU-03B dev analysis')  # before anything heavy is imported
from iu3 import scores
from iu3b import veto

E = 1


def main():
    out = arg_value('--out'); refuse_inside_repo(out, 'IU-03B dev analysis')
    rows = json.load(open(arg_value('--rows')))
    col = {}
    for l in open(arg_value('--collect')):
        d = json.loads(l); col[d['key']] = d
    if arg_value('--upernet'):
        for l in open(arg_value('--upernet')):
            d = json.loads(l)
            if d['key'] in col and 'upernet' in d: col[d['key']]['upernet'] = d['upernet']
    # the IU-03A test negatives share file names with the dev ones; their features are stored under the plain id
    for r in rows:
        if r['tag'] == 'iu3tneg' and r['key'].endswith('-t'):
            r['devKey'], r['key'] = r['key'], r['key'][:-2]
    rows, P, unm, missing = scores.evidence(rows)
    for r in rows:
        r['key'] = r.pop('devKey', r['key'])
    print('missing classifier evidence', len(missing))
    items = [(r, P[i], col[r['key']]) for i, r in enumerate(rows) if r['key'] in col]
    res = {'n': len(items), 'variants': {}}
    configs = [('A', {}), ('B', {'masked': 'classic'})]
    for z in (4.0, 5.0, 6.0):
        for d in (1.0, 1.5, 2.0, 3.0):
            configs.append((f'B_S(z{z},d{d})', {'masked': 'classic', 'z': z, 'd': d}))
    configs += [('B1', {'masked': 'classic', 'base': False}), ('B1_T', {'masked': 'classic', 'base': False, 'trigger': True})]
    configs += [('B_T', {'masked': 'classic', 'trigger': True}), ('B_S(z5.0,d1.5)_T', {'masked': 'classic', 'z': 5.0, 'd': 1.5, 'trigger': True})]
    if any('upernet' in c for _, _, c in items):
        configs += [('D', {'masked': 'upernet'}), ('D1', {'masked': 'upernet', 'base': False}), ('D_S(z5.0,d1.0)', {'masked': 'upernet', 'z': 5.0, 'd': 1.0}),
                    ('A@D', {'sub': 1}), ('B1@D', {'masked': 'classic', 'base': False, 'sub': 1})]
    for name, cfg in configs:
        on_d = cfg.get('masked') == 'upernet' or cfg.pop('sub', 0)
        sub = [(r, p, c) for r, p, c in items if not on_d or 'upernet' in c]
        stats = defaultdict(Counter); ran = 0
        lost, leaked = [], []
        for r, p, c in sub:
            d = veto.decide(list(p), c, **cfg)
            ran += d['maskedRan']
            el = r['routeTruth']; s = r['devSet']
            stats[s]['elev' if el else 'non'] += 1
            if d['facade']:
                stats[s]['elevKept' if el else 'nonRouted'] += 1
                if not el: leaked.append((r['key'][:24], r['label'], s, d['reason']))
            elif el:
                lost.append((r['key'][:24], s, d['reason']))
            if not el and r.get('hard'):
                stats[s]['nearFrontal'] += 1; stats[s]['nearFrontalRouted'] += int(d['facade'])
        tot = Counter()
        for v in stats.values(): tot.update(v)
        res['variants'][name] = {'n': len(sub), 'maskedTestRan': ran, 'total': dict(tot), 'bySet': {k: dict(v) for k, v in stats.items()},
                                 'elevLostReasons': dict(Counter(x[2] for x in lost)), 'leaked': leaked[:40], 'lostSample': lost[:40]}
        print(f"{name:22s} n {len(sub):5d} masked-run {ran:5d} | elevations kept {tot['elevKept']}/{tot['elev']} | non-elevations routed {tot['nonRouted']}/{tot['non']} | near-frontal routed {tot['nearFrontalRouted']}/{tot['nearFrontal']}")
    json.dump(res, open(out, 'w'), indent=1)


if __name__ == '__main__':
    main()
