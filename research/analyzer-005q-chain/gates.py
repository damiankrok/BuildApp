#!/usr/bin/env python3
"""gates.py - BUILDPLAN-ANALYZER-005Q-CHAIN safety gates G1-G5 (RESEARCH ONLY; definitions: preregistration.md §6).

  python3 -I research/analyzer-005q-chain/gates.py --baseline <C0 house score> --variant <X house score> \
      [--labels <label-score-primary.json>] --out <gates-X.json>

Reads two score_houses.py outputs (and optionally the label scores) and evaluates, per gate, PASS / FAIL with the rows
that decide it. It never reads a published figure itself: the footprint residual it uses is the one score_houses
computed offline through holdout/verdict.mjs. Nothing here chooses a gate; it only computes the preregistered ones.
"""
import argparse, json

CONTROLS = ['rarytasy-g2e', 'rarytasy-eoze', 'eoze-legacy-every', 'eoze-legacy-area', 'dom-pod-jarzabem', 'kosacce-clean', 'kosacce-tracked',
            'kosacce-area-alone', 'A06', 'A07', 'marcowki', 'dom-w-zurawkach', 'dom-miniaturka', 'dom-w-tymianku', 'dom-w-daliach']


def g(rows, case):
    return next((r for r in rows if r['case'] == case), None)


def semantic(r):
    m = (r or {}).get('model')
    if not m:
        return None
    return {k: m.get(k) for k in ('storeys', 'levelHeights', 'walls', 'openings', 'rooms', 'terraces', 'roofs', 'footprintM2', 'balconies', 'stairs')}


def evaluate(base, var, labels=None):
    brows, vrows = base['rows'], var['rows']
    known_good = sorted({r['case'] for r in brows if r.get('verdict') == 'PASS'} | set(CONTROLS))
    out = {'variant': var['label'], 'baseline': base['label'], 'knownGood': known_good}
    # G1
    g1 = []
    for c in known_good:
        b, v = g(brows, c), g(vrows, c)
        if not b or not v:
            g1.append({'case': c, 'why': 'NO_RUN'})
            continue
        if b.get('verdict') != v.get('verdict') or b.get('outcome') != v.get('outcome'):
            g1.append({'case': c, 'why': 'VERDICT_OR_OUTCOME', 'was': [b.get('outcome'), b.get('verdict')], 'now': [v.get('outcome'), v.get('verdict')]})
            continue
        sb, sv = semantic(b), semantic(v)
        if sb != sv:
            g1.append({'case': c, 'why': 'SEMANTIC_MODEL', 'diff': {k: [sb.get(k) if sb else None, sv.get(k) if sv else None] for k in (sb or sv) if (sb or {}).get(k) != (sv or {}).get(k)}})
    byte_only = sorted(c for c in known_good if g(brows, c) and g(vrows, c) and g(brows, c).get('modelSha256') != g(vrows, c).get('modelSha256') and semantic(g(brows, c)) == semantic(g(vrows, c)))
    out['G1'] = {'pass': not g1, 'failures': g1, 'byteOnlyModelChanges': byte_only}
    # G2
    sda = {r['case']: (r.get('evidenceGates') or {}).get('scaleDependentAnchors', 0) for r in vrows if r.get('evidenceGates')}
    soa = {r['case']: (r.get('evidenceGates') or {}).get('scaleOrientedAnchors', 0) for r in vrows if r.get('evidenceGates')}
    mis = {r['case']: (r.get('evidenceGates') or {}).get('inkFirstMismatch', 0) for r in vrows if r.get('evidenceGates')}
    false_conf = []
    for v in vrows:
        b = g(brows, v['case'])
        if not b or v.get('outcome') != 'COMPLETED' or v.get('footprintResidualPct') is None:
            continue
        rv = abs(v['footprintResidualPct'])
        rb = abs(b['footprintResidualPct']) if b.get('footprintResidualPct') is not None and b.get('outcome') == 'COMPLETED' else None
        if rv > 6 and (rb is None or rb <= 6):
            false_conf.append({'case': v['case'], 'residualPct': v['footprintResidualPct'], 'baseline': [b.get('outcome'), b.get('footprintResidualPct')]})
    exact_up = []
    for v in vrows:
        b = g(brows, v['case'])
        if not b or not v.get('model') or not b.get('model'):
            continue
        ev = sum(n for k, n in v['model']['evidenceStatus'].items() if k.endswith(':SOURCE_EXACT'))
        eb = sum(n for k, n in b['model']['evidenceStatus'].items() if k.endswith(':SOURCE_EXACT'))
        if ev > eb:
            exact_up.append({'case': v['case'], 'sourceExact': [eb, ev]})
    if labels:
        lf = [s for s in labels.get('sheets', []) if (s.get('frame') or {}).get('falseConfidentScale')]
        false_conf += [{'sheet': s['sheet'], 'registrationErrVsTrueScale': s['frame'].get('registrationErrVsTrueScale')} for s in lf]
    out['G2'] = {
        'pass': sum(sda.values()) == 0 and sum(mis.values()) == 0 and not false_conf and not exact_up,
        'a_scaleDependentAnchors': {k: v for k, v in sda.items() if v}, 'a_total': sum(sda.values()),
        'a2_scaleOrientedAnchors': {k: v for k, v in soa.items() if v}, 'a2_total': sum(soa.values()),
        'b_inkFirstMismatch': {k: v for k, v in mis.items() if v}, 'c_newFalseConfident': false_conf, 'd_sourceExactIncrease': exact_up,
        'e_note': 'changed refusals are classified by hand from their decision paths (G5 list)',
    }
    # G3
    g3 = []
    for v in vrows:
        b = g(brows, v['case'])
        if not b:
            continue
        sv, sb = v.get('semantics') or {}, b.get('semantics') or {}
        for k in ('terraces', 'bodies', 'wideOpenings', 'completions'):
            if sv.get(k) != sb.get(k):
                g3.append({'case': v['case'], 'what': k, 'was': sb.get(k), 'now': sv.get(k)})
        mv, mb = v.get('model') or {}, b.get('model') or {}
        for k in ('rooms', 'walls'):
            if mv and mb and mv.get(k) != mb.get(k):
                g3.append({'case': v['case'], 'what': k, 'was': mb.get(k), 'now': mv.get(k)})
    out['G3'] = {'pass': not g3, 'changes': g3}
    # G5
    changed = []
    for v in vrows:
        b = g(brows, v['case'])
        if b and (v.get('outcome') != b.get('outcome') or v.get('code') != b.get('code') or v.get('decisionPath') != b.get('decisionPath')):
            changed.append({'case': v['case'], 'was': [b.get('outcome'), b.get('code'), b.get('verdict')], 'now': [v.get('outcome'), v.get('code'), v.get('verdict')], 'decisionPathChanged': v.get('decisionPath') != b.get('decisionPath')})
    out['G5'] = {'changedRefusalsOrDecisions': changed, 'note': 'every entry needs a hand explanation in the report; no reconstruction code differs between variants (G5 by construction)'}
    out['admissible'] = out['G1']['pass'] and out['G2']['pass'] and out['G3']['pass']
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--baseline', required=True)
    ap.add_argument('--variant', required=True)
    ap.add_argument('--labels')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    base, var = json.load(open(a.baseline)), json.load(open(a.variant))
    labels = None
    if a.labels:
        ls = json.load(open(a.labels))
        labels = ls['variants'].get(var['label'])
    out = evaluate(base, var, labels)
    json.dump(out, open(a.out, 'w'), indent=1, sort_keys=True)
    print(json.dumps({'variant': out['variant'], 'G1': out['G1']['pass'], 'G1failures': len(out['G1']['failures']), 'G2': out['G2']['pass'], 'G2a': out['G2']['a_total'], 'G2a2': out['G2']['a2_total'],
                      'G2b': len(out['G2']['b_inkFirstMismatch']), 'G2c': len(out['G2']['c_newFalseConfident']), 'G2d': len(out['G2']['d_sourceExactIncrease']), 'G3': out['G3']['pass'], 'G3changes': len(out['G3']['changes']),
                      'G5changed': len(out['G5']['changedRefusalsOrDecisions']), 'admissible': out['admissible']}))


if __name__ == '__main__':
    main()
