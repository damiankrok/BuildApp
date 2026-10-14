#!/usr/bin/env python3
"""score_labels.py - BUILDPLAN-ANALYZER-005Q-CHAIN label/binding-level scorer (RESEARCH ONLY; never imported by production).

  python3 -I research/analyzer-005q-chain/score_labels.py --runs /home/user/work005q-chain/runs --labels C0,C1,... \
      --mode primary|sensitivity --out stage-reports/artifacts/analyzer-005q-chain/paired-matrix

Truth meets the variants only here. Truth = 005Q-OCR's frozen truth on the same 9 sheets (same source crops and ledger):
its items (tier A 005O double transcription + tier B local double read; tier C R1_CONFIDENT only in --mode sensitivity),
its classes (DIMENSION on a frozen line) and its line-internal binding truth (TICK marks only, addendum C), rebuilt with
005Q-OCR's own functions (research/analyzer-005q-ocr/score.py, binding.py), unchanged. Each variant is read only from
the metric evidence its own replay extracted (runs/<label>/<case>/extract/metric-evidence.json.gz).

Per truth dimension label, from the variant's evidence on the label's frame:
  reader      the ensemble reading (readingOf) of the lattice record(s) on the ink, both quarter turns; CORRECT/WRONG/
              NONE/ROTATIONAL_TWIN (two corroborating turns with different integer values)
  decision    the final label-assignment status of the ink (BOUND / UNASSIGNED / AMBIGUOUS / NO_DECISION)
  statement   the LINEAR_DIMENSION evidence bound to the ink's token (via ocrTokenIds): origin, value, segment,
              derivation.dependsOnScale, and whether it is a registration anchor
  printed     the value the statement asserts AS PRINTED: origin READ without dependsOnScale (a CHAIN_CORRECTED or
              scale-dependent value is counted separately as scale-dependent, never as asserted)
  first-bad   NEVER_PROPOSED / NOT_ON_A_CHAIN / READ_NOT_CORROBORATED / ROTATIONAL_TWIN_AMBIGUOUS / READ_WRONG /
              READ_RIGHT_NOT_BOUND:<UNASSIGNED|AMBIGUOUS|NO_DECISION|BOUND_NO_STATEMENT> / READ_RIGHT_BOUND_WRONG /
              SCALE_DEPENDENT_VALUE (statement not asserted as printed) / PRINTED_VALUE_WRONG / NONE
and the explicit abstentions a variant records (UnresolvedMetric entries naming the ink's token, or — addendum C, review
B-08 — a chain segment the variant marked `labelled` without evidence under the ink) as SOUND_ABSTENTION.
Addendum C (post-review corrections; the preregistered columns are kept unchanged beside the corrected ones):
  correctPrintedBound is split into ...Verified (binding truth CORRECT) and ...Unverified (no binding truth) — B-02;
  spanRatio = stated value / segment px / TRUE_SCALE and spanImplausible (|ratio - 1| > 3 %) are an AUDIT column (truth
  scale, never a gate input of a challenger); spuriousCertaintyWithSpanAudit adds asserted values on an implausible span;
  binding counts are also reported without the 2 questionable binding truths (truth segment > 3 % off TRUE_SCALE) — B-03;
  the frame's false-confident scale is evaluated on BOTH axes, and sheets without TRUE_SCALE get an anisotropy flag
  (|mppY/mppX - 1| > 3 % at confidence >= 0.5) — B-01.
Correlation: S2/S3 are one publisher package; S5 is the smoke sheet (reported apart); copies are never pooled as
independent truth. Output: numbers, values and page boxes only.
"""
import argparse, gzip, json, os, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OCR = os.path.join(HERE, '..', 'analyzer-005q-ocr')
sys.path.insert(0, OCR)
from binding import INT, axis_of, center, contains, on_line, same_segment, short_side, truth_binding  # noqa: E402
import score as ocrscore  # noqa: E402  (005Q-OCR scorer: build_items, prior_truth, true_scale, classify)

W = '/home/user/work005q-ocr'


def load(p):
    if p.endswith('.gz'):
        return json.loads(gzip.open(p).read())
    return json.load(open(p))


def truth_dims(sheet, mode):
    sid = sheet['id']
    con = load(f'{W}/contenders/{sid}.json')
    tru = load(f'{W}/truth/{sid}.json')
    prior = ocrscore.prior_truth(sheet['frameId'])
    items, _ = ocrscore.build_items(con, tru, prior, mode == 'sensitivity')
    chains = con['chains']
    lines = chains + [dict(r, id=r['id']) for r in con['runs']]
    for i in items:
        i['h'] = short_side(i['box'])
        i['onLine'] = [c['id'] for c in lines if on_line(c, i['box'], i['axis'], i['h'])]
        i['class'] = 'DIMENSION' if i['kind'] == 'INT' and i['onLine'] else 'OTHER'
    dims = [i for i in items if i['class'] == 'DIMENSION']
    for i in dims:
        i['bindingTruth'] = truth_binding(i, dims, chains)
    return dims, ocrscore.true_scale(sheet['frameId'])


def overlaps(i, box, axis):
    c = center(i['box'])
    return axis == i['axis'] and (contains(i['box'], center(box)) or contains(box, c))


def corroborating_value(lat):
    """The ensemble reading of one lattice record when its class is CLEAR/SUPPORTED and it states an integer without a
    leading zero (the frozen ensemble's own confident output); None otherwise."""
    e = lat.get('ensemble')
    txt = (e or {}).get('asRead', lat.get('asRead'))
    cls = (e or {}).get('ocrClass', lat.get('ocrClass'))
    if cls in ('CLEAR', 'SUPPORTED') and txt and INT.match(txt) and not txt.startswith('0'):
        return txt
    return None


def on_labelled_unresolved(metrics, fid, item):
    """Addendum C (B-08): the ink sits, along its own axis and within 2.2 label heights of the baseline, on a chain segment
    the variant marked `labelled` without stating anything (an explicit abstention, C2's labelled-unresolved span)."""
    b = item['box']
    cx, cy = (b['x0'] + b['x1']) / 2, (b['y0'] + b['y1']) / 2
    h = short_side(b)
    for ch in metrics['chains']:
        if ch['frameId'] != fid or ch['axis'] != item['axis']:
            continue
        along, across = (cx, cy) if ch['axis'] == 'HORIZONTAL' else (cy, cx)
        if abs(across - ch['baselinePx']) > 2.2 * h:
            continue
        if any(g.get('labelled') and not g.get('evidenceId') and g['fromPx'] <= along <= g['toPx'] for g in ch['segments']):
            return True
    return False


def truth_segment_questionable(i, ts):
    """Preregistration §1: a binding truth whose segment is > 3 % from TRUE_SCALE is questionable."""
    bt = i['bindingTruth']
    if bt['status'] != 'TRUTH' or not ts:
        return False
    sg = bt['segment']
    px = abs(sg['toPx'] - sg['fromPx'])
    return px > 0 and abs(int(i['value']) / px / ts - 1) > 0.03


def score_sheet(sheet, metrics, dims, ts):
    fid = sheet['frameId']
    toks = {t['id']: t for t in metrics['ocrTokens'] if t['frameId'] == fid}
    lats = [l for l in metrics.get('numericLattices', []) if l['frameId'] == fid]
    evs = {e['id']: e for e in metrics['evidence'] if e.get('frameId') == fid}
    seg_of = {}
    for ch in metrics['chains']:
        if ch['frameId'] != fid:
            continue
        for g in ch['segments']:
            if g.get('evidenceId'):
                seg_of[g['evidenceId']] = {'axis': ch['axis'], 'baselinePx': ch['baselinePx'], 'fromPx': g['fromPx'], 'toPx': g['toPx']}
    reg = [r for r in metrics['coordinateRegistrations'] if r.get('frameId') == fid]
    anchor_ev = Counter()
    for r in reg:
        for a in r.get('anchors', []):
            for e in a.get('evidenceIds', []):
                anchor_ev[e] += 1
    topo = next((t for t in metrics.get('dimensionTopology', []) if t['frameId'] == fid), None)
    decisions = (topo or {}).get('assignment', {}).get('final') or (topo or {}).get('assignment', {}).get('legacy') or []
    unresolved = [u for u in metrics.get('unresolved', []) if u.get('frameId') == fid]
    rows = []
    for i in dims:
        r = {'value': i['value'], 'truth': i['truth'], 'axis': i['axis'], 'box': i['box'], 'bindingTruth': i['bindingTruth']['status']}
        ml = [l for l in lats if overlaps(i, l['box'], axis_of(l['orientation']))]
        corr = sorted({v for v in (corroborating_value(l) for l in ml) if v})
        r['latticeRecords'] = len(ml)
        r['reader'] = 'NONE' if not corr else 'ROTATIONAL_TWIN' if len(corr) > 1 else ('CORRECT' if corr[0] == i['value'] else 'WRONG')
        r['readerValues'] = corr
        mt = [t for t in toks.values() if overlaps(i, t['box'], axis_of(t['orientation']))]
        md = [d for d in decisions if overlaps(i, d['box'], axis_of(d['orientation']))]
        st = sorted({d['status'] for d in md})
        r['decision'] = 'BOUND' if 'BOUND' in st else ('AMBIGUOUS' if 'AMBIGUOUS' in st else ('UNASSIGNED' if 'UNASSIGNED' in st else 'NO_DECISION'))
        tok_ids = {t['id'] for t in mt}
        stm = [e for e in evs.values() if e.get('kind') == 'LINEAR_DIMENSION' and e['id'] in seg_of and set(e.get('ocrTokenIds', [])) & tok_ids]
        stm.sort(key=lambda e: e['id'])
        if stm:
            e = stm[0]
            dep = bool((e.get('derivation') or {}).get('dependsOnScale'))
            r['statement'] = {'id': e['id'], 'origin': e['origin'], 'value': e['value'], 'dependsOnScale': dep, 'anchor': anchor_ev[e['id']] > 0, 'rawText': e.get('rawText')}
            seg = seg_of[e['id']]
            if i['bindingTruth']['status'] == 'TRUTH':
                r['binding'] = 'CORRECT' if same_segment(seg, i['bindingTruth']['segment']) else 'WRONG'
            else:
                r['binding'] = 'NO_TRUTH'
            asserted = e['origin'] == 'READ' and not dep
            r['printed'] = None if not asserted else str(int(round(e['value'])))
            r['scaleDependent'] = not asserted
            r['scaleDependentValueEqualsTruth'] = (not asserted) and str(int(round(e['value']))) == i['value']
            px = abs(seg['toPx'] - seg['fromPx'])
            r['spanPx'] = px
            r['spanRatio'] = round(e['value'] / px / ts, 4) if ts and px > 0 else None
        else:
            r['statement'] = None
            r['binding'] = 'NOT_BOUND'
            r['printed'] = None
            r['scaleDependent'] = False
        r['abstention'] = any(set(u.get('ocrTokenIds', [])) & tok_ids for u in unresolved if 'unattached' not in u['id']) or (
            r['statement'] is None and on_labelled_unresolved(metrics, fid, i))
        r['bindingTruthQuestionable'] = truth_segment_questionable(i, ts)
        # first bad decision on the path ink -> statement
        if not mt and not ml:
            fb = 'NEVER_PROPOSED'
        elif not ml:
            fb = 'NOT_ON_A_CHAIN'
        elif r['reader'] == 'NONE':
            fb = 'READ_NOT_CORROBORATED'
        elif r['reader'] == 'ROTATIONAL_TWIN' and r['printed'] != i['value']:
            fb = 'ROTATIONAL_TWIN_AMBIGUOUS'
        elif r['reader'] == 'WRONG':
            fb = 'READ_WRONG'
        elif r['statement'] is None:
            fb = 'READ_RIGHT_NOT_BOUND:' + ('BOUND_NO_STATEMENT' if r['decision'] == 'BOUND' else r['decision'])
        elif r['binding'] == 'WRONG':
            fb = 'READ_RIGHT_BOUND_WRONG'
        elif r['scaleDependent']:
            fb = 'SCALE_DEPENDENT_VALUE'
        elif r['printed'] != i['value']:
            fb = 'PRINTED_VALUE_WRONG'
        else:
            fb = 'NONE'
        r['firstBad'] = fb
        r['spuriousCertainty'] = r['printed'] is not None and (r['printed'] != i['value'] or r['binding'] == 'WRONG')
        r['correctPrintedBound'] = r['printed'] == i['value'] and r['binding'] in ('CORRECT', 'NO_TRUTH')
        r['correctPrintedBoundVerified'] = r['printed'] == i['value'] and r['binding'] == 'CORRECT'
        r['correctPrintedBoundUnverified'] = r['printed'] == i['value'] and r['binding'] == 'NO_TRUTH'
        r['spanImplausible'] = r.get('spanRatio') is not None and abs(r['spanRatio'] - 1) > 0.03
        r['spuriousCertaintyWithSpanAudit'] = r['spuriousCertainty'] or (r['printed'] is not None and r['spanImplausible'])
        r['scaleDependentAnchor'] = bool(r['statement'] and r['scaleDependent'] and r['statement']['anchor'])
        rows.append(r)
    # frame level
    anchors_by_origin = Counter()
    for r in reg:
        for a in r.get('anchors', []):
            for eid in a.get('evidenceIds', []):
                e = evs.get(eid) or next((x for x in metrics['evidence'] if x['id'] == eid), None)
                o = (e or {}).get('origin', '?')
                if e and (e.get('derivation') or {}).get('dependsOnScale') and o == 'READ':
                    o = 'READ_DEPENDS_ON_SCALE'
                anchors_by_origin[o] += 1
    sol = next((m for m in metrics.get('metricSolutions', []) if m['frameId'] == fid), None)
    frame = {'registration': bool(reg), 'anchorsByOrigin': dict(anchors_by_origin),
             'registrationMppX': reg[0]['metresPerPixelX'] if reg else None, 'registrationConfidence': reg[0]['confidence'] if reg else None,
             'solution': {'relation': sol['relation'], 'confidence': sol['confidence'], 'cmPerPixelX': sol['cmPerPixelX'], 'independentWitnesses': sol.get('independentWitnesses')} if sol else None,
             'trueScale005O': ts}
    if reg and ts:
        # preregistered implementation (X only) kept as falseConfidentScaleXOnly; addendum C (B-01): both axes
        ex = reg[0]['metresPerPixelX'] * 100 / ts - 1
        ey = (reg[0]['metresPerPixelY'] * 100 / ts - 1) if reg[0].get('metresPerPixelY') else 0.0
        conf = (reg[0]['confidence'] or 0) >= 0.5
        frame['registrationErrVsTrueScale'] = round(ex, 4)
        frame['registrationErrVsTrueScaleY'] = round(ey, 4)
        frame['falseConfidentScaleXOnly'] = abs(ex) > 0.03 and conf
        frame['falseConfidentScale'] = max(abs(ex), abs(ey)) > 0.03 and conf
    if reg and reg[0].get('metresPerPixelY'):
        an = reg[0]['metresPerPixelY'] / reg[0]['metresPerPixelX'] - 1
        frame['anisotropy'] = round(an, 4)
        frame['anisotropicConfidentScale'] = abs(an) > 0.03 and (reg[0]['confidence'] or 0) >= 0.5
    return rows, frame


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--runs', required=True)
    ap.add_argument('--labels', required=True)
    ap.add_argument('--mode', choices=['primary', 'sensitivity'], default='primary')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    corpus = load(os.path.join(OCR, 'corpus.json'))['sheets']
    truth = {s['id']: truth_dims(s, a.mode) for s in corpus}
    out = {'schema': 'buildapp.005q-chain.label-score', 'version': 1, 'mode': a.mode, 'variants': {}}
    for label in a.labels.split(','):
        sheets, recs = [], []
        tot = defaultdict(Counter)
        for s in corpus:
            p = os.path.join(a.runs, label, s['case'], 'extract', 'metric-evidence.json.gz')
            if not os.path.exists(p):
                sheets.append({'sheet': s['id'], 'status': 'MISSING_RUN'})
                continue
            metrics = load(p)
            dims, ts = truth[s['id']]
            rows, frame = score_sheet(s, metrics, dims, ts)
            grp = 'SMOKE' if s.get('smoke') else 'MAIN'
            c = Counter()
            for r in rows:
                c['labels'] += 1
                c['firstBad:' + r['firstBad']] += 1
                c['reader:' + r['reader']] += 1
                c['decision:' + r['decision']] += 1
                c['binding:' + r['binding']] += 1
                c['correctPrintedBound'] += r['correctPrintedBound']
                c['correctPrintedBoundVerified'] += r['correctPrintedBoundVerified']
                c['correctPrintedBoundUnverified'] += r['correctPrintedBoundUnverified']
                c['correctPrintedBoundSpanImplausible'] += r['correctPrintedBound'] and r['spanImplausible']
                c['spuriousCertaintyWithSpanAudit'] += r['spuriousCertaintyWithSpanAudit']
                if not r['bindingTruthQuestionable']:
                    c['bindingExclQuestionable:' + r['binding']] += 1
                c['spuriousCertainty'] += r['spuriousCertainty']
                c['scaleDependentAnchor'] += r['scaleDependentAnchor']
                c['scaleDependentValueEqualsTruth'] += bool(r.get('scaleDependentValueEqualsTruth'))
                c['soundAbstention'] += r['abstention']
                if r['statement'] and r['statement']['origin'] == 'READ' and not r['statement']['dependsOnScale'] and r['printed'] != r['value']:
                    c['wrongWhenAsserted'] += 1
            tot[grp].update(c)
            sheets.append({'sheet': s['id'], 'case': s['case'], 'family': s['family'], 'lineage': s['lineage'], 'role': s['role'], 'smoke': bool(s.get('smoke')), 'counts': dict(c), 'frame': frame})
            for r in rows:
                recs.append({'sheet': s['id'], 'case': s['case'], **r})
        out['variants'][label] = {'totals': {k: dict(v) for k, v in tot.items()}, 'sheets': sheets}
        os.makedirs(a.out, exist_ok=True)
        json.dump({'label': label, 'mode': a.mode, 'records': recs}, open(os.path.join(a.out, f'label-records-{label}-{a.mode}.json'), 'w'), indent=1, sort_keys=True)
    json.dump(out, open(os.path.join(a.out, f'label-score-{a.mode}.json'), 'w'), indent=1, sort_keys=True)
    for label, v in out['variants'].items():
        print(label, json.dumps(v['totals'].get('MAIN', {}), sort_keys=True))


if __name__ == '__main__':
    main()
