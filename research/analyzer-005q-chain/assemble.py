#!/usr/bin/env python3
"""assemble.py - BUILDPLAN-ANALYZER-005Q-CHAIN artifact assembly (RESEARCH ONLY).

  python3 -I research/analyzer-005q-chain/assemble.py --work /home/user/work005q-chain \
      --labels C0,C1,C2,C3,N1,C4,C1N1 --out stage-reports/artifacts/analyzer-005q-chain

Writes, from the scored replays (numbers, ids and texts only — no pixel, no page):
  paired-matrix/paired-matrix.json        per variant: label totals (PRIMARY, SENSITIVITY, per sheet), house totals, gates
  paired-matrix/rows.json                 per row x variant: outcome, verdict, footprint residual, scale, registration and
                                          SOURCE_EXACT census of the selected plan, first difference vs C0
  source-provenance/provenance.json       per variant: evidence origins (READ / CHAIN_CORRECTED / DERIVED / INK_FIRST),
                                          registration anchors by origin, scale-dependent and scale-oriented anchors
  performance/performance.json            per variant: extraction / solver wall time and peak RSS per row (contended)
"""
import argparse, gzip, json, os, re, statistics
from collections import Counter


def load(p):
    return json.loads(gzip.open(p).read()) if p.endswith('.gz') else json.load(open(p))


def logstat(p):
    if not os.path.exists(p):
        return None
    m = re.search(r'exit (\S+) wall ([\d.]+) peakRssKb (\d+)', open(p).read())
    return {'exit': m.group(1), 'wallS': float(m.group(2)), 'peakRssMB': round(int(m.group(3)) / 1024)} if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--labels', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    labels = a.labels.split(',')
    W = a.work
    lab = {m: load(f'{W}/lab/label-score-{m}.json') for m in ('primary', 'sensitivity') if os.path.exists(f'{W}/lab/label-score-{m}.json')}
    house = {L: load(f'{W}/score-{L}.json') for L in labels}
    gates = {L: load(f'{W}/gates-{L}.json') for L in labels if os.path.exists(f'{W}/gates-{L}.json')}
    keys = ['labels', 'correctPrintedBound', 'correctPrintedBoundVerified', 'correctPrintedBoundUnverified', 'correctPrintedBoundSpanImplausible', 'spuriousCertainty', 'spuriousCertaintyWithSpanAudit',
            'wrongWhenAsserted', 'scaleDependentAnchor', 'scaleDependentValueEqualsTruth', 'soundAbstention', 'binding:CORRECT', 'binding:WRONG', 'bindingExclQuestionable:CORRECT', 'bindingExclQuestionable:WRONG']
    pm = {'schema': 'buildapp.005q-chain.paired-matrix', 'version': 1, 'variants': {}}
    for L in labels:
        v = {'label': {}, 'house': house[L]['summary'] | {}, 'gates': None}
        v['house'].pop('vsBaseline', None)
        if 'vsBaseline' in house[L]['summary']:
            vb = house[L]['summary']['vsBaseline']
            v['houseVsC0'] = {k: (len(x) if isinstance(x, list) else x) for k, x in vb.items() if k != 'knownGoodBaseline'}
        for m, d in lab.items():
            var = d['variants'].get(L)
            if not var:
                continue
            for grp in ('MAIN', 'SMOKE'):
                t = var['totals'].get(grp, {})
                v['label'][f'{m}:{grp}'] = {**{k: t.get(k, 0) for k in keys}, 'firstBad': {k.split(':', 1)[1]: n for k, n in sorted(t.items()) if k.startswith('firstBad:')}}
            v['label'][f'{m}:perSheet'] = {s['sheet']: {k: s.get('counts', {}).get(k, 0) for k in ('labels', 'correctPrintedBound', 'spuriousCertainty', 'scaleDependentAnchor')} | {'falseConfidentScale': (s.get('frame') or {}).get('falseConfidentScale'), 'registrationErrVsTrueScale': (s.get('frame') or {}).get('registrationErrVsTrueScale')} for s in var['sheets'] if 'counts' in s}
        if L in gates:
            g = gates[L]
            v['gates'] = {'G1': g['G1']['pass'], 'G1failures': [f['case'] for f in g['G1']['failures']], 'G1material': g['G1']['materialFailures'], 'G1minor': g['G1']['minorFailures'],
                          'G2': g['G2']['pass'], 'G2a': g['G2']['a_total'], "G2a'": g['G2']['a2_total'],
                          'G2b': sum(g['G2']['b_inkFirstMismatch'].values()), "G2b'": g['G2']['b2_multiAssertedTokens'], 'G2c': g['G2']['c_newFalseConfident'], 'G2cXOnlyFirstScored': g['G2']['c_xOnlyFirstScored'],
                          'G2d': [x['case'] for x in g['G2']['d_sourceExactChanged']], 'G2dCountFirstScored': g['G2']['d_sourceExactIncrease'], 'G3': g['G3']['pass'], 'G3changes': len(g['G3']['changes']),
                          'G5changed': [c['case'] for c in g['G5']['changedRefusalsOrDecisions']], 'admissible': g['admissible']}
        pm['variants'][L] = v
    os.makedirs(f'{a.out}/paired-matrix', exist_ok=True)
    json.dump(pm, open(f'{a.out}/paired-matrix/paired-matrix.json', 'w'), indent=1, sort_keys=True)
    # rows
    rows = {}
    for L in labels:
        for r in house[L]['rows']:
            m = r.get('model') or {}
            ex = sum(n for k, n in (m.get('evidenceStatus') or {}).items() if k.endswith(':SOURCE_EXACT'))
            sel = (r.get('metric') or {}).get(r.get('frame') or '', {})
            rows.setdefault(r['case'], {})[L] = {'outcome': r.get('outcome'), 'code': r.get('code'), 'verdict': r.get('verdict'), 'footprintResidualPct': r.get('footprintResidualPct'),
                                                'scaleCmPerPx': r.get('scaleCmPerPx'), 'storeys': m.get('storeys'), 'footprintM2': m.get('footprintM2'), 'sourceExact': ex,
                                                'selectedRegistration': {k: sel.get(k) for k in ('mppX', 'mppY', 'confidence', 'anchors')} if sel else None,
                                                'modelChangedVsC0': (r.get('vsBaseline') or {}).get('modelChanged'), 'semanticVsC0': (r.get('vsBaseline') or {}).get('modelSemantic') is not None if r.get('vsBaseline') else None}
    json.dump({'schema': 'buildapp.005q-chain.rows', 'version': 1, 'rows': rows}, open(f'{a.out}/paired-matrix/rows.json', 'w'), indent=1, sort_keys=True)
    # descriptive (not a preregistered gate): the selected plan frame's registration moving > 3 % from C0 on ANY row, or
    # its anisotropy |mppY/mppX - 1| exceeding 3 % where C0's did not. G2c sees a scale move only on a truth sheet or through
    # the footprint residual of a row C0 completed within 6 %; this census shows the moves G2c cannot see.
    for L in labels:
        if L == 'C0':
            continue
        moved = []
        for case, per in sorted(rows.items()):
            b, v = (per.get('C0') or {}).get('selectedRegistration'), (per.get(L) or {}).get('selectedRegistration')
            if not b or not v or not b.get('mppX') or not v.get('mppX'):
                continue
            dx, dy = v['mppX'] / b['mppX'] - 1, (v['mppY'] / b['mppY'] - 1) if b.get('mppY') and v.get('mppY') else 0
            an_b = abs(b['mppY'] / b['mppX'] - 1) if b.get('mppY') else 0
            an_v = abs(v['mppY'] / v['mppX'] - 1) if v.get('mppY') else 0
            if max(abs(dx), abs(dy)) > 0.03 or (an_v > 0.03 and an_b <= 0.03):
                moved.append({'case': case, 'dMppX': round(dx, 4), 'dMppY': round(dy, 4), 'anisotropy': [round(an_b, 4), round(an_v, 4)],
                              'outcome': [per['C0'].get('outcome'), per[L].get('outcome')], 'residualPct': [per['C0'].get('footprintResidualPct'), per[L].get('footprintResidualPct')]})
        pm['variants'][L]['registrationMovesOver3pct'] = moved
    json.dump(pm, open(f'{a.out}/paired-matrix/paired-matrix.json', 'w'), indent=1, sort_keys=True)
    # provenance
    prov = {}
    for L in labels:
        c = Counter()
        anc = Counter()
        for case in sorted(os.listdir(f'{W}/runs/{L}')):
            p = f'{W}/runs/{L}/{case}/extract/metric-evidence.json.gz'
            if not os.path.exists(p):
                continue
            mm = load(p)
            ev = {e['id']: e for e in mm['evidence']}
            for e in mm['evidence']:
                if e['kind'] != 'LINEAR_DIMENSION':
                    continue
                why = (e.get('derivation') or {}).get('why', '')
                c['INK_FIRST' if why.startswith('INK_FIRST') else e['origin'] + ('+dependsOnScale' if (e.get('derivation') or {}).get('dependsOnScale') else '')] += 1
            for r in mm['coordinateRegistrations']:
                for an in r['anchors']:
                    e = ev.get(an['evidenceIds'][0], {})
                    why = (e.get('derivation') or {}).get('why', '')
                    anc[f"{an['kind']}:{'INK_FIRST' if why.startswith('INK_FIRST') else e.get('origin')}{'+dependsOnScale' if (e.get('derivation') or {}).get('dependsOnScale') else ''}"] += 1
        prov[L] = {'linearDimensionEvidence': dict(c), 'registrationAnchors': dict(anc)}
    os.makedirs(f'{a.out}/source-provenance', exist_ok=True)
    json.dump({'schema': 'buildapp.005q-chain.provenance', 'version': 1, 'rowsCovered': 'the 45 EXTRACT rows', 'variants': prov}, open(f'{a.out}/source-provenance/provenance.json', 'w'), indent=1, sort_keys=True)
    # performance (contended: 3 workers on 4 vCPU; the ACCEL memo makes challenger extraction cheaper than C0's)
    perf = {}
    for L in labels + ['C0dup']:
        ex, so = [], []
        d = f'{W}/runs/{L}'
        if not os.path.isdir(d):
            continue
        for case in sorted(os.listdir(d)):
            e, s = logstat(f'{d}/{case}/extract.log'), logstat(f'{d}/{case}/solve.log')
            if e:
                ex.append(e)
            if s:
                so.append(s)
        perf[L] = {'rows': len(so), 'extractWallSMedian': round(statistics.median(x['wallS'] for x in ex), 1) if ex else None, 'extractPeakRssMBMax': max((x['peakRssMB'] for x in ex), default=None),
                   'solveWallSMedian': round(statistics.median(x['wallS'] for x in so), 1) if so else None, 'solvePeakRssMBMax': max((x['peakRssMB'] for x in so), default=None)}
    os.makedirs(f'{a.out}/performance', exist_ok=True)
    json.dump({'schema': 'buildapp.005q-chain.performance', 'version': 1, 'machine': 'x86_64, 4 vCPU, Node 22.22.2, recogniser WASM 1 thread; replays contended (3 workers + 1); challengers with the ring-callout memo (ACCEL), C0 without',
               'note': 'contended replay timings only; no challenger survived G1-G5, so the preregistered uncontended A/B/B/A comparison (G6) was not run; Node 18 and the ARM64 phone are UNMEASURED', 'variants': perf}, open(f'{a.out}/performance/performance.json', 'w'), indent=1, sort_keys=True)
    print('assembled', labels)


if __name__ == '__main__':
    main()
