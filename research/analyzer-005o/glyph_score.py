#!/usr/bin/env python3
"""glyph_score.py - BUILDPLAN-ANALYZER-005O: score the frozen readers and the M1 consensus rule on the glyph corpus.

  python3 -I research/analyzer-005o/glyph_score.py --reads /home/user/work005o/glyph-reads.json \
      --manifest stage-reports/artifacts/analyzer-005o/glyph-corpus-manifest.json --out stage-reports/artifacts/analyzer-005o/glyph-corpus-results.json

Per family (the split unit) and pooled: EXACT for the classic token, the lattice, PP-OCRv6's top value and the
ensemble's reading; confident-wrong for the lattice (CLEAR/SUPPORTED) and for a corroborating external value;
TOP-K recall (printed value anywhere among token, lattice paths and the external top 5); and the label-level
outcome of M1's rule (preregistration section 3): the confident readers' values K; |K| = 1 -> that value is stated,
|K| >= 2 -> ABSTAIN. A stated wrong value is the false-confident outcome. 95 % Wilson intervals and a family-cluster
bootstrap (seed 5050).
"""
import argparse, json, random, re
from collections import defaultdict

INT = re.compile(r'^[1-9]\d{1,4}$')


def v(t):
    return int(t) if isinstance(t, str) and INT.match(t) else None


def wilson(k, n, z=1.96):
    if n == 0:
        return [None, None]
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    h = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5)
    return [round((c - h) / d, 4), round((c + h) / d, 4)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reads', required=True)
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    man = {r['id']: r for r in json.load(open(a.manifest))['rows']}
    rows = []
    for r in json.load(open(a.reads))['rows']:
        m = man[r['id']]
        T = int(m['text'])
        lat = r.get('lattice') or {}
        ext = r.get('external') or {}
        ens = r.get('ensemble') or {}
        tok = v(r.get('token'))
        lat_v = lat.get('asReadValueCm')
        lat_conf = lat_v if lat.get('ocrClass') in ('CLEAR', 'SUPPORTED') else None
        ext_top = v((ext.get('topK') or [{}])[0].get('text')) if ext else None
        dec = ens.get('decision')
        ext_v = (ens.get('external') or {}).get('valueCm')
        ext_corr = ext_v if (dec in ('AGREES', 'LEADS') or (dec == 'CONTESTS' and (ens.get('rival') or {}).get('witness') == 'EXTERNAL')) else None
        K = {x for x in (tok, lat_conf, ext_corr) if x is not None}
        m1 = 'ABSTAIN' if len(K) != 1 else ('CORRECT' if T in K else 'WRONG')
        frozen = 'ABSTAIN' if tok is None else ('CORRECT' if tok == T else 'WRONG')
        ens_read = ens.get('asReadValueCm') if ens else lat_v
        ens_conf = ens.get('ocrClass') in ('CLEAR', 'SUPPORTED') if ens else False
        topk = {tok, lat_v} | {x.get('text') and v(x['text']) for x in ext.get('topK', [])}
        rows.append({'id': r['id'], 'family': m['family'], 'lookalike': m['lookalike'], 'truth': T, 'turn': m['turn'], 'cap': m['cap'],
                     'token': tok, 'lattice': lat_v, 'latticeConfident': lat_conf, 'externalTop': ext_top, 'externalCorroborating': ext_corr, 'ensemble': ens_read, 'ensembleConfident': ens_conf,
                     'decision': dec, 'm1': m1, 'frozenTokenAsPrinted': frozen, 'recall': T in topk})

    def tally(rs):
        n = len(rs)
        out = {'n': n}
        for f in ('token', 'lattice', 'externalTop', 'ensemble'):
            k = sum(1 for r in rs if r[f] == r['truth'])
            out[f'exact_{f}'] = [k, round(k / n, 4) if n else None, wilson(k, n)]
        lc = [r for r in rs if r['latticeConfident'] is not None]
        ec = [r for r in rs if r['externalCorroborating'] is not None]
        nc = [r for r in rs if r['ensembleConfident']]
        out['latticeConfidentWrong'] = [sum(1 for r in lc if r['latticeConfident'] != r['truth']), len(lc)]
        out['externalCorroboratingWrong'] = [sum(1 for r in ec if r['externalCorroborating'] != r['truth']), len(ec)]
        out['ensembleConfidentWrong'] = [sum(1 for r in nc if r['ensemble'] != r['truth']), len(nc)]
        for f in ('m1', 'frozenTokenAsPrinted'):
            c = {o: sum(1 for r in rs if r[f] == o) for o in ('CORRECT', 'ABSTAIN', 'WRONG')}
            out[f] = {**c, 'wrongCI': wilson(c['WRONG'], n), 'wrongWhenStated': round(c['WRONG'] / max(1, c['CORRECT'] + c['WRONG']), 4)}
        out['topKRecall'] = [sum(1 for r in rs if r['recall']), n]
        return out

    fams = defaultdict(list)
    for r in rows:
        fams[r['family']].append(r)
    # post-review LMP-10: 7 font files are about 5 typeface designs (Liberation Sans regular and italic are one design,
    # DejaVu Sans and Sans Mono one superfamily); the bootstrap is reported clustered both ways
    DESIGN = {'F1-dejavu-sans': 'dejavu', 'F5-dejavu-mono': 'dejavu', 'F2-liberation-sans': 'liberation', 'F4-liberation-italic-condensed': 'liberation',
              'F3-freesans-oblique': 'freesans', 'F6-courier10': 'courier', 'F7-charter': 'charter'}

    def cluster_ci(key):
        groups = defaultdict(list)
        for r in rows:
            groups[key(r)].append(r)
        rng = random.Random(5050)
        names = sorted(groups)
        b = []
        for _ in range(10000):
            s = [x for f in (rng.choice(names) for _ in names) for x in groups[f]]
            b.append(sum(1 for r in s if r['m1'] == 'WRONG') / len(s))
        b.sort()
        return [round(b[250], 4), round(b[9750], 4)], len(names)
    boot_ci, _ = cluster_ci(lambda r: r['family'])
    design_ci, n_designs = cluster_ci(lambda r: DESIGN[r['family']])
    doc = {'schema': 'buildapp.005o.glyph-corpus-results', 'families': len(fams), 'labels': len(rows), 'pooled': tally(rows), 'lookalikeSubset': tally([r for r in rows if r['lookalike']]),
           'byFamily': {f: tally(fams[f]) for f in sorted(fams)}, 'byTurn': {t: tally([r for r in rows if r['turn'] == t]) for t in ('UPRIGHT', 'CW', 'CCW')},
           'm1WrongFamilyClusterCI': boot_ci, 'm1WrongDesignClusterCI': design_ci, 'typefaceDesigns': n_designs,
           'm1Wrong': [r for r in rows if r['m1'] == 'WRONG'], 'missingCandidate': [r['id'] for r in rows if not r['recall']]}
    json.dump(doc, open(a.out, 'w'), indent=1, sort_keys=True)
    p = doc['pooled']
    print(json.dumps({k: p[k] for k in p}, indent=0))
    print('m1 wrong family-cluster CI', doc['m1WrongFamilyClusterCI'], 'design-cluster CI', doc['m1WrongDesignClusterCI'], n_designs, 'designs')


if __name__ == '__main__':
    main()
