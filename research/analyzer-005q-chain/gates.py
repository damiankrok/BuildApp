#!/usr/bin/env python3
"""gates.py - BUILDPLAN-ANALYZER-005Q-CHAIN safety gates G1-G5 (RESEARCH ONLY; definitions: preregistration.md §6).

  python3 -I research/analyzer-005q-chain/gates.py --baseline <C0 house score> --variant <X house score> \
      [--labels <label-score-primary.json>] --out <gates-X.json>

Reads two score_houses.py outputs (and optionally the label scores) and evaluates, per gate, PASS / FAIL with the rows
that decide it. It never reads a published figure itself: the footprint residual it uses is the one score_houses
computed offline through holdout/verdict.mjs (the production solver itself also receives the published footprint in every
variant — addendum C, C-1). Nothing here chooses a gate; it only computes the preregistered ones.

Addendum C (post-review corrections; the first-scored values are kept beside the corrected ones):
  G2c sheet clause on BOTH axes (B-01), new against C0's sheet; sheets without TRUE_SCALE get an anisotropy clause
      (|mppY/mppX - 1| > 3 % at confidence >= 0.5) new against C0 — `c_newFalseConfident`; the first-scored X-only
      clause is kept as `c_xOnlyFirstScored`.
  G2d per element (A1): every new or changed SOURCE_EXACT element (collection:id = interpretation) against C0 —
      `d_sourceExactChanged`; the first-scored per-row count is kept as `d_sourceExactIncrease`.
  G2b' (B-05): OCR tokens stated as a printed READ number on more than one segment, more than in C0.
  G2a' (A5): part of G2's pass for the variants that claim it (C3, C4), as addendum A required.
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
    # addendum C (C-5): a failure is MINOR when only the footprint (<= 0.1 m2) and opening widths (<= 1 cm, same kinds,
    # hosts and count) differ; the gate itself is unchanged, the split is reported beside it
    def minor(f):
        d = f.get('diff') or {}
        if f['why'] != 'SEMANTIC_MODEL' or not set(d) <= {'footprintM2', 'openings'}:
            return False
        if 'footprintM2' in d and (None in d['footprintM2'] or abs(d['footprintM2'][0] - d['footprintM2'][1]) > 0.1):
            return False
        if 'openings' in d:
            a, b = d['openings']
            if a is None or b is None or len(a) != len(b):
                return False
            pa, pb = sorted(x.split(':') for x in a), sorted(x.split(':') for x in b)
            pa.sort(key=lambda x: (x[0], x[2], float(x[1]))); pb.sort(key=lambda x: (x[0], x[2], float(x[1])))
            if any(x[0] != y[0] or x[2] != y[2] or abs(float(x[1]) - float(y[1])) > 0.0101 for x, y in zip(pa, pb)):
                return False
        return True
    for f in g1:
        f['minor'] = minor(f)
    byte_only = sorted(c for c in known_good if g(brows, c) and g(vrows, c) and g(brows, c).get('modelSha256') != g(vrows, c).get('modelSha256') and semantic(g(brows, c)) == semantic(g(vrows, c)))
    # addendum C (C-4): the summary does not see room outlines, wall endpoints or opening offsets; rows whose model bytes
    # changed under an identical summary are changes below summary resolution, not trace-only changes
    out['G1'] = {'pass': not g1, 'failures': g1, 'materialFailures': sorted(f['case'] for f in g1 if not f['minor']), 'minorFailures': sorted(f['case'] for f in g1 if f['minor']),
                 'changesBelowSummaryResolution': byte_only}
    # G2
    # addendum B: G2a/G2a' are evaluated on the EXTRACT rows (a source-metrics challenger cannot reach the sealed legacy
    # evidence of the SOLVE_ONLY_LEGACY rows); those rows are reported apart, unchanged from C0.
    sda = {r['case']: (r.get('evidenceGates') or {}).get('scaleDependentAnchors', 0) for r in vrows if r.get('evidenceGates') and r.get('mode') == 'EXTRACT'}
    soa = {r['case']: (r.get('evidenceGates') or {}).get('scaleOrientedAnchors', 0) for r in vrows if r.get('evidenceGates') and r.get('mode') == 'EXTRACT'}
    legacy = {r['case']: (r.get('evidenceGates') or {}).get('scaleDependentAnchors', 0) for r in vrows if r.get('evidenceGates') and r.get('mode') != 'EXTRACT'}
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
    x_only = list(false_conf)
    if labels:
        base_sheets = {s['sheet']: s for s in (labels.get('baseline') or {}).get('sheets', [])}

        def flag(s, key):
            return bool((s.get('frame') or {}).get(key))
        for s in labels.get('sheets', []):
            f = s.get('frame') or {}
            b = base_sheets.get(s['sheet'], {})
            if f.get('falseConfidentScaleXOnly', f.get('falseConfidentScale')):
                x_only.append({'sheet': s['sheet'], 'registrationErrVsTrueScale': f.get('registrationErrVsTrueScale')})
            if flag(s, 'falseConfidentScale') and not flag(b, 'falseConfidentScale'):
                false_conf.append({'sheet': s['sheet'], 'errX': f.get('registrationErrVsTrueScale'), 'errY': f.get('registrationErrVsTrueScaleY')})
            elif f.get('trueScale005O') is None and flag(s, 'anisotropicConfidentScale') and not flag(b, 'anisotropicConfidentScale'):
                false_conf.append({'sheet': s['sheet'], 'anisotropy': f.get('anisotropy'), 'noTrueScale': True})
    exact_changed = []
    for v in vrows:
        b = g(brows, v['case'])
        if not b or not v.get('model'):
            continue
        sb, sv = (b.get('model') or {}).get('sourceExact') or {}, v['model'].get('sourceExact') or {}
        ch = {k: [sb.get(k), x] for k, x in sv.items() if sb.get(k) != x}
        if ch:
            exact_changed.append({'case': v['case'], 'changed': ch})
    multi = {v['case']: (v.get('evidenceGates') or {}).get('multiAssertedTokens', 0) for v in vrows if v.get('evidenceGates')}
    multi_base = {b['case']: (b.get('evidenceGates') or {}).get('multiAssertedTokens', 0) for b in brows if b.get('evidenceGates')}
    multi_new = {k: [multi_base.get(k, 0), n] for k, n in multi.items() if n > multi_base.get(k, 0)}
    claims_orientation = var.get('label') in ('C3', 'C4')
    out['G2'] = {
        'pass': sum(sda.values()) == 0 and sum(mis.values()) == 0 and not false_conf and not exact_changed and not multi_new and (not claims_orientation or sum(soa.values()) == 0),
        'c_xOnlyFirstScored': x_only, 'd_sourceExactChanged': exact_changed, "b2_multiAssertedTokens": multi_new,
        'a_scaleDependentAnchors': {k: v for k, v in sda.items() if v}, 'a_total': sum(sda.values()),
        'a2_scaleOrientedAnchors': {k: v for k, v in soa.items() if v}, 'a2_total': sum(soa.values()), 'a_legacyRowsUnreachable': legacy,
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
        if labels is not None:
            labels = dict(labels, baseline=ls['variants'].get(base['label']))
    out = evaluate(base, var, labels)
    json.dump(out, open(a.out, 'w'), indent=1, sort_keys=True)
    print(json.dumps({'variant': out['variant'], 'G1': out['G1']['pass'], 'G1failures': len(out['G1']['failures']), 'G1material': len(out['G1']['materialFailures']), 'G2': out['G2']['pass'], 'G2a': out['G2']['a_total'], 'G2a2': out['G2']['a2_total'],
                      'G2b': len(out['G2']['b_inkFirstMismatch']), "G2b'": len(out['G2']['b2_multiAssertedTokens']), 'G2c': len(out['G2']['c_newFalseConfident']), 'G2d': len(out['G2']['d_sourceExactChanged']), 'G3': out['G3']['pass'], 'G3changes': len(out['G3']['changes']),
                      'G5changed': len(out['G5']['changedRefusalsOrDecisions']), 'admissible': out['admissible']}))


if __name__ == '__main__':
    main()
