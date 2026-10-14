#!/usr/bin/env python3
"""score.py - BUILDPLAN-ANALYZER-005Q-OCR scorer (RESEARCH ONLY; never imported by production).

  python3 -I research/analyzer-005q-ocr/score.py --work /home/user/work005q-ocr \
      --out stage-reports/artifacts/analyzer-005q-ocr

Truth meets the contenders only here. Inputs (all outside Git): $W/manifest, $W/contenders, $W/truth, 005O's prior
blind transcription ($W005O/labels) and TRUE_SCALE (label-rows.json, used ONLY for the false-confident-scale check);
the committed 005O murajach inventory. Output: numbers, values and page boxes only (no pixel, no crop, no page text dump).
Rules: preregistration.md §2-§4. Pure functions are in binding.py (tested by test_binding.py).
"""
import argparse, json, os, re, statistics, sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from binding import (INT, axis_of, center, contains, corroborating, on_line, segment_at, assign_blind,  # noqa: E402
                     truth_binding, same_segment, scale_cluster, short_side)

W005O = '/home/user/work005o'


def load(p):
    return json.load(open(p))


def prior_truth(frame_id):
    """005O blind double transcription (AGREED only) of the statement crops of this frame."""
    man = [r for r in load(f'{W005O}/labels/manifest.json')['crops'] if 'key' in r and r['frameId'] == frame_id]
    tr = load(f'{W005O}/labels/truth.json')['truth']
    out = []
    for r in man:
        t = tr.get(r['key'])
        if t and t.get('status') == 'AGREED':
            out.append({'box': r['box'], 'orientation': r['orientation'], 'value': t['value'], 'evidenceId': r['evidenceId']})
    return out


def true_scale(frame_id):
    v = [r['trueScale'] for r in load(f'{W005O}/label-rows.json') if r.get('frame') == frame_id and r.get('trueScale')]
    return statistics.median(v) if v else None


def classify(value):
    if value is None:
        return None
    if INT.match(value):
        return 'INT'
    if re.fullmatch(r'[0-9]+[.,][0-9]+', value):
        return 'DECIMAL_OR_AREA'
    return 'TEXT'


def strip_sep(t):
    return re.sub(r'^[\s.,]+|[\s.,]+$', '', t or '')


def local_status(r1, p1, r2):
    """Addendum A: separators stripped at both ends; LOCAL_DOUBLE_READ on agreement; R1_CONFIDENT when R1 reads an
    integer at mean p >= 0.98 and R2 gives no DIFFERENT digit string of the same length."""
    a, b = strip_sep(r1), strip_sep(r2)
    if a == '' and b == '':
        return 'UNREADABLE', None
    if a != '' and a == b:
        return 'LOCAL_DOUBLE_READ', a
    if INT.match(a) and p1 >= 0.98 and not (len(b) == len(a) and b != a):
        return 'R1_CONFIDENT', a
    return 'AMBIGUOUS_READ', None


def build_items(con, tru, prior, sensitivity):
    """Truth items: tier-A prior transcriptions first, then local double reads, smallest box first; a location that
    covers the centres of two accepted items is a MERGED box (never an item)."""
    locs = []
    for p in prior:
        locs.append({'tier': 'A', 'box': p['box'], 'axis': axis_of(p['orientation']), 'value': p['value'], 'status': 'PRIOR_TRANSCRIPTION', 'origin': 'PRIOR'})
    for it in tru['items']:
        status, value = local_status(it['r1']['text'], it['r1']['meanP'], it['r2'])
        if it['origin'] == 'LINE_WINDOW' and status not in ('LOCAL_DOUBLE_READ', 'R1_CONFIDENT'):
            continue  # an empty band is not a location
        locs.append({'tier': 'B' if status != 'R1_CONFIDENT' else 'C', 'box': it['box'], 'axis': it['axis'], 'value': value, 'status': status, 'origin': it['origin'], 'orientation': it['orientation'], 'r1': it['r1']['text'], 'r2': it['r2']})
    if not sensitivity:
        for l in locs:
            if l['tier'] == 'C':
                l['tier'], l['status'], l['value'] = 'B', 'AMBIGUOUS_READ', None
    area = lambda b: max(0, b['x1'] - b['x0']) * max(0, b['y1'] - b['y0'])
    locs.sort(key=lambda l: (l['tier'], area(l['box'])))
    items = []
    merged = 0
    for l in locs:
        inside = [i for i in items if i['axis'] == l['axis'] and contains(l['box'], center(i['box']))]
        if len(inside) >= 2:
            merged += 1
            continue
        host = inside[0] if inside else next((i for i in items if i['axis'] == l['axis'] and contains(i['box'], center(l['box']))), None)
        if host:
            host['reads'].append({'tier': l['tier'], 'status': l['status'], 'value': l['value'], 'origin': l['origin']})
            continue
        items.append({'box': l['box'], 'axis': l['axis'], 'reads': [{'tier': l['tier'], 'status': l['status'], 'value': l['value'], 'origin': l['origin']}], 'orientation': l.get('orientation')})
    for i in items:
        a = [r for r in i['reads'] if r['tier'] == 'A']
        b = {r['value'] for r in i['reads'] if r['tier'] == 'B' and r['status'] == 'LOCAL_DOUBLE_READ'}
        cc = {r['value'] for r in i['reads'] if r['tier'] == 'C'}
        i['r1Confident'] = sorted(cc)
        if a:
            i['value'], i['truth'] = a[0]['value'], 'PRIOR_TRANSCRIPTION'
            i['localAgreement'] = 'AGREES' if b == {a[0]['value']} else 'NO_LOCAL' if not b else 'CONFLICTS'
        elif len(b) == 1:
            i['value'], i['truth'] = b.pop(), 'LOCAL_DOUBLE_READ'
        elif len(b) > 1:
            i['value'], i['truth'] = None, 'AMBIGUOUS_READ'
        elif len(cc) == 1:
            i['value'], i['truth'] = next(iter(cc)), 'R1_CONFIDENT'
        elif len(cc) > 1:
            i['value'], i['truth'] = None, 'AMBIGUOUS_READ'
        else:
            st = {r['status'] for r in i['reads']}
            i['value'], i['truth'] = None, 'AMBIGUOUS_READ' if 'AMBIGUOUS_READ' in st else 'UNREADABLE'
        i['origins'] = sorted({r['origin'] for r in i['reads']})
        i['kind'] = classify(i['value'])
    return items, merged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--mode', choices=['primary', 'sensitivity'], default='primary')
    a = ap.parse_args()
    corpus = load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corpus.json'))['sheets']
    inventory = load('stage-reports/artifacts/analyzer-005o/baseline-first-bad.json')['cases']['dom-w-murajach']
    sheets_out, records = [], []
    agg = Counter()
    conf = defaultdict(Counter)
    for s in corpus:
        sid = s['id']
        con = load(f"{a.work}/contenders/{sid}.json")
        tru = load(f"{a.work}/truth/{sid}.json")
        man = load(f"{a.work}/manifest/{sid}.json")
        metrics = load(man['metrics'])
        prior = prior_truth(s['frameId'])
        items, merged = build_items(con, tru, prior, a.mode == 'sensitivity')
        h_page = tru['labelHeightPx']
        chains = con['chains']
        lines = chains + [dict(r, id=r['id']) for r in con['runs']]
        # dimension labels: integer value on a frozen line or a ticked run
        for i in items:
            h = short_side(i['box'])
            i['h'] = h
            i['onLine'] = [c['id'] for c in lines if on_line(c, i['box'], i['axis'], h)]
            if i['kind'] == 'INT':
                i['class'] = 'DIMENSION' if i['onLine'] else 'NOT_A_DIMENSION:OFF_LINE'
            elif i['kind'] == 'DECIMAL_OR_AREA':
                i['class'] = 'NOT_A_DIMENSION:DECIMAL_OR_AREA'
            elif i['kind'] == 'TEXT':
                i['class'] = 'NOT_A_DIMENSION:TEXT'
            else:
                i['class'] = i['truth']  # UNREADABLE / AMBIGUOUS_READ
        dims = [i for i in items if i['class'] == 'DIMENSION']
        # binding truth (line-internal proportionality; preregistration §2)
        for i in dims:
            i['bindingTruth'] = truth_binding(i, dims, chains)
        # --- B0: sealed lattices (the incumbent's crops), classic tokens, sealed binding and statement value
        b0 = con['b0']
        tok_by_id = {t['id']: t for t in metrics['ocrTokens'] if t['frameId'] == s['frameId']}
        ev_by_id = {e['id']: e for e in metrics['evidence'] if e.get('frameId') == s['frameId']}
        seg_of_ev = {}
        for ch in metrics['chains']:
            if ch['frameId'] != s['frameId']:
                continue
            for g in ch['segments']:
                if g.get('evidenceId'):
                    seg_of_ev[g['evidenceId']] = {'axis': ch['axis'], 'baselinePx': ch['baselinePx'], 'fromPx': g['fromPx'], 'toPx': g['toPx'], 'origin': g.get('origin'), 'valueCm': g.get('valueCm')}
        b0_bind = []  # (token box, axis, segment, statement value, origin)
        for eid, seg in seg_of_ev.items():
            e = ev_by_id.get(eid)
            if not e or len(e.get('ocrTokenIds', [])) != 1:
                continue
            t = tok_by_id.get(e['ocrTokenIds'][0])
            if t:
                b0_bind.append({'box': t['box'], 'axis': axis_of(t['orientation']), 'seg': seg, 'value': e.get('value'), 'origin': e.get('origin'), 'tokenText': t.get('text')})
        # --- B1: best turn per box
        b1 = []
        for bx in con['b1']:
            best = max(bx['reads'], key=lambda r: r['p']) if bx['reads'] else None
            if best:
                b1.append({'box': {k: bx[k] for k in ('x0', 'x1', 'y0', 'y1')}, 'raw': bx['raw'], 'axis': axis_of(best['orientation']), 'orientation': best['orientation'], 'top': best['top'], 'corr': corroborating(best), 'rival': [r for r in bx['reads'] if r is not best]})
        classic = [t for t in con['classic'] if t['glyphs'] >= 2]
        # --- per truth dimension label
        rows = []
        for i in dims:
            c = center(i['box'])
            m0 = [l for l in b0 if axis_of(l['orientation']) == i['axis'] and (contains(i['box'], center(l['box'])) or contains(l['box'], c))]
            m1 = [x for x in b1 if x['axis'] == i['axis'] and contains(x['box'], c)]
            mc = [t for t in classic if axis_of(t['orientation']) == i['axis'] and (contains(i['box'], center(t['box'])) or contains(t['box'], c))]
            mb = [x for x in b0_bind if x['axis'] == i['axis'] and (contains(i['box'], center(x['box'])) or contains(x['box'], c))]
            r = {'value': i['value'], 'truth': i['truth'], 'axis': i['axis'], 'box': i['box'], 'origins': i['origins'], 'bindingTruth': i['bindingTruth']['status']}
            # B0
            r['b0Detected'] = bool(m0)
            r['b0ClassicToken'] = bool(mc)
            ext = [l['external'] for l in m0 if l.get('external')]
            corr0 = [e for e in ext if corroborating({'p': e['p'], 'stable': e['stable'], 'greedy': e['greedy'], 'top': e['top']})]
            r['b0Value'] = corr0[0]['top'] if corr0 else None
            r['b0ValueCorrect'] = r['b0Value'] == i['value'] if r['b0Value'] is not None else None
            r['b0ClassicText'] = mc[0]['text'] if mc else None
            if mb:
                seg = mb[0]['seg']
                r['b0Statement'] = {'value': mb[0]['value'], 'origin': mb[0]['origin'], 'tokenText': mb[0]['tokenText']}
                r['b0Binding'] = 'CORRECT' if i['bindingTruth']['status'] == 'TRUTH' and same_segment(seg, i['bindingTruth']['segment']) else 'WRONG' if i['bindingTruth']['status'] == 'TRUTH' else 'NO_TRUTH'
            else:
                r['b0Statement'] = None
                r['b0Binding'] = 'NOT_BOUND'
            # B1
            r['b1Detected'] = bool(m1)
            corr1 = [x for x in m1 if x['corr']]
            r['b1Value'] = corr1[0]['top'] if corr1 else None
            r['b1ValueCorrect'] = r['b1Value'] == i['value'] if r['b1Value'] is not None else None
            r['b1Merged'] = bool(m1) and not corr1 and any(len(x['top']) > len(i['value']) for x in m1)
            if corr1 and i.get('orientation') and i['truth'] == 'LOCAL_DOUBLE_READ':
                r['b1OrientationCorrect'] = corr1[0]['orientation'] == i['orientation']
            # first-bad class for the incumbent
            if not mc and not m0:
                r['b0Loss'] = 'NEVER_PROPOSED'
            elif mc and not m0:
                r['b0Loss'] = 'TOKEN_NOT_ON_A_CHAIN'
            elif r['b0Value'] is None:
                r['b0Loss'] = 'READ_NOT_CORROBORATED'
            elif not r['b0ValueCorrect']:
                r['b0Loss'] = 'READ_WRONG'
            elif r['b0Binding'] == 'NOT_BOUND':
                r['b0Loss'] = 'READ_RIGHT_NOT_BOUND'
            elif r['b0Binding'] == 'WRONG':
                r['b0Loss'] = 'READ_RIGHT_BOUND_WRONG'
            elif r['b0Statement'] and r['b0Statement']['value'] is not None and str(int(round(r['b0Statement']['value']))) != i['value']:
                r['b0Loss'] = 'STATEMENT_VALUE_REWRITTEN'
            else:
                r['b0Loss'] = 'NONE'
            rows.append(r)
        # --- B2: blind binding on the union of corroborating candidates (one per ink)
        cands = []
        for l in b0:
            e = l.get('external')
            if e and corroborating({'p': e['p'], 'stable': e['stable'], 'greedy': e['greedy'], 'top': e['top']}) and INT.match(e['top']):
                cands.append({'box': l['box'], 'axis': axis_of(l['orientation']), 'values': {e['top']}, 'src': {'B0'}})
        for x in b1:
            if not (x['corr'] and INT.match(x['top'])):
                continue
            host = next((c for c in cands if c['axis'] == x['axis'] and (contains(x['box'], center(c['box'])) or contains(c['box'], center(x['raw'])))), None)
            if host:
                host['values'].add(x['top'])
                host['src'].add('B1')
            else:
                cands.append({'box': x['raw'], 'axis': x['axis'], 'values': {x['top']}, 'src': {'B1'}})
        assign = assign_blind(cands, chains, h_page)
        b2rows = []
        for r, i in zip(rows, dims):
            c = center(i['box'])
            k = next((n for n, cd in enumerate(cands) if cd['axis'] == i['axis'] and (contains(i['box'], center(cd['box'])) or contains(cd['box'], c))), None)
            if k is None:
                r['b2'] = 'NO_CANDIDATE'
                continue
            asg = assign[k]
            r['b2Sources'] = sorted(cands[k]['src'])
            r['b2Contested'] = len(cands[k]['values']) > 1
            if asg['status'] != 'BOUND':
                r['b2'] = asg['status']
            elif i['bindingTruth']['status'] != 'TRUTH':
                r['b2'] = 'BOUND_NO_TRUTH'
            else:
                r['b2'] = 'CORRECT' if same_segment(asg['segment'], i['bindingTruth']['segment']) else 'WRONG'
        # B2 false bindings: candidates bound to a segment that do not correspond to a truth dimension label
        false_b2 = []
        for n, cd in enumerate(cands):
            if assign[n]['status'] != 'BOUND':
                continue
            if any(cd['axis'] == i['axis'] and (contains(i['box'], center(cd['box'])) or contains(cd['box'], center(i['box']))) for i in dims):
                continue
            host = next((i for i in items if contains(i['box'], center(cd['box'])) or contains(cd['box'], center(i['box']))), None)
            false_b2.append({'values': sorted(cd['values']), 'src': sorted(cd['src']), 'box': cd['box'], 'truthClass': host['class'] if host else 'NO_TRUTH_ITEM'})
        # B1 false detections: corroborating integer readings not on a truth dimension label
        false_b1 = Counter()
        for x in b1:
            if not (x['corr'] and INT.match(x['top'])):
                continue
            if any(x['axis'] == i['axis'] and contains(x['box'], center(i['box'])) for i in dims):
                continue
            host = next((i for i in items if contains(x['box'], center(i['box']))), None)
            false_b1[host['class'] if host else 'NO_TRUTH_ITEM'] += 1
        # --- scale evidence (scorer only compares with TRUE_SCALE)
        ts = true_scale(s['frameId'])

        def scale_from(pairs):
            res = {}
            for ax in ('HORIZONTAL', 'VERTICAL'):
                res[ax] = scale_cluster([p for p in pairs if p['axis'] == ax])
            hx, vx = res['HORIZONTAL'], res['VERTICAL']
            res['axisConsistent'] = bool(hx and vx and abs(hx['scale'] / vx['scale'] - 1) <= 0.02)
            for ax in ('HORIZONTAL', 'VERTICAL'):
                if res[ax] and ts:
                    res[ax]['errVsTrueScale'] = round(res[ax]['scale'] / ts - 1, 4)
            res['falseConfident'] = bool(res['axisConsistent'] and ts and any(res[ax] and abs(res[ax]['scale'] / ts - 1) > 0.03 for ax in ('HORIZONTAL', 'VERTICAL')))
            return res
        b2pairs = []
        for n, cd in enumerate(cands):
            if assign[n]['status'] == 'BOUND' and len(cd['values']) == 1:
                g = assign[n]['segment']
                b2pairs.append({'axis': cd['axis'], 'value': int(next(iter(cd['values']))), 'px': g['toPx'] - g['fromPx'], 'line': round(g['baselinePx'])})
        sol = next((m for m in metrics['metricSolutions'] if m['frameId'] == s['frameId']), None)
        anchors = next((r for r in metrics['coordinateRegistrations'] if r.get('frameId') == s['frameId']), None)
        anchor_origins = Counter()
        if anchors:
            for an in anchors.get('anchors', []):
                for eid in an.get('evidenceIds', []):
                    anchor_origins[ev_by_id.get(eid, {}).get('origin', '?')] += 1
        scale = {'trueScale005O': ts, 'B2': scale_from(b2pairs),
                 'B0MetricSolution': {'cmPerPixelX': sol['cmPerPixelX'], 'cmPerPixelY': sol['cmPerPixelY'], 'confidence': sol.get('confidence'), 'relation': sol.get('relation')} if sol else None,
                 'B0RegistrationAnchorsByOrigin': dict(anchor_origins)}
        if sol and ts:
            scale['B0MetricSolution']['errVsTrueScale'] = round(sol['cmPerPixelX'] / ts - 1, 4)
        # --- truth quality
        tq = Counter(i.get('localAgreement') for i in items if i['truth'] == 'PRIOR_TRANSCRIPTION')
        r1cal = Counter(('AGREES' if i['r1Confident'] == [i['value']] else 'CONFLICTS' if i['r1Confident'] else 'NONE') for i in items if i['truth'] == 'PRIOR_TRANSCRIPTION')
        summ = {
            'sheet': sid, 'case': s['case'], 'role': s['role'], 'family': s['family'], 'lineage': s['lineage'], 'smoke': bool(s.get('smoke')),
            'items': len(items), 'mergedLocations': merged, 'itemClasses': dict(Counter(i['class'] for i in items)),
            'dimensionLabels': len(dims), 'truthTier': dict(Counter(i['truth'] for i in dims)),
            'bindingTruth': dict(Counter(i['bindingTruth']['status'] for i in dims)),
            'b0Proposals': len(b0), 'b1Boxes': len(con['b1']), 'b1Corroborating': sum(1 for x in b1 if x['corr']),
            'b0Detected': sum(r['b0Detected'] for r in rows), 'b1Detected': sum(r['b1Detected'] for r in rows),
            'b1OnlyDetected': sum(1 for r in rows if r['b1Detected'] and not r['b0Detected']),
            'b0OnlyDetected': sum(1 for r in rows if r['b0Detected'] and not r['b1Detected']),
            'b0ValueCorrect': sum(1 for r in rows if r['b0ValueCorrect']), 'b0ValueWrong': sum(1 for r in rows if r['b0ValueCorrect'] is False),
            'b1ValueCorrect': sum(1 for r in rows if r['b1ValueCorrect']), 'b1ValueWrong': sum(1 for r in rows if r['b1ValueCorrect'] is False),
            'b1NewCorrectValues': sum(1 for r in rows if r['b1ValueCorrect'] and not r['b0Detected']),
            'b1OrientationCorrect': sum(1 for r in rows if r.get('b1OrientationCorrect') is True), 'b1OrientationWrong': sum(1 for r in rows if r.get('b1OrientationCorrect') is False),
            'b0Loss': dict(Counter(r['b0Loss'] for r in rows)),
            'b0Binding': dict(Counter(r['b0Binding'] for r in rows)), 'b2': dict(Counter(r.get('b2') for r in rows)),
            'b2FalseBindings': len(false_b2), 'b2FalseBindingClasses': dict(Counter(f['truthClass'] for f in false_b2)),
            'b1FalseDetections': dict(false_b1), 'scale': scale, 'truthQualityTierAvsLocal': dict(tq), 'r1ConfidentVsTierA': dict(r1cal),
        }
        if s['frameId'] == inventory['selectedFrame']:
            inv = []
            for p in inventory['perPrintedDimension']:
                v = str(p['printed'])
                hit = [r for r in rows if r['value'] == v]
                inv.append({'printed': v, 'class005O': p['class'], 'truthItemFound': bool(hit), 'b0Detected': any(r['b0Detected'] for r in hit), 'b0ValueCorrect': any(r['b0ValueCorrect'] for r in hit), 'b1Detected': any(r['b1Detected'] for r in hit), 'b1ValueCorrect': any(r['b1ValueCorrect'] for r in hit), 'b2': [r.get('b2') for r in hit]})
            summ['murajachInventoryCheck'] = inv
        sheets_out.append(summ)
        for r in rows:
            records.append({'sheet': sid, 'case': s['case'], 'variantByteHash': man['variantByteHash'], 'frameId': s['frameId'], **r})
        for k in ('dimensionLabels', 'b0Detected', 'b1Detected', 'b1OnlyDetected', 'b0OnlyDetected', 'b0ValueCorrect', 'b0ValueWrong', 'b1ValueCorrect', 'b1ValueWrong', 'b1NewCorrectValues', 'b2FalseBindings'):
            agg[(('SMOKE' if s.get('smoke') else 'MAIN'), k)] += summ[k]
        for k in ('b0Loss', 'b0Binding', 'b2', 'b1FalseDetections', 'bindingTruth', 'truthTier', 'truthQualityTierAvsLocal', 'r1ConfidentVsTierA', 'itemClasses'):
            for kk, vv in summ[k].items():
                conf[(('SMOKE' if s.get('smoke') else 'MAIN'), k)][str(kk)] += vv
    os.makedirs(a.out, exist_ok=True)
    totals = {}
    for (grp, k), v in agg.items():
        totals.setdefault(grp, {})[k] = v
    for (grp, k), v in conf.items():
        totals.setdefault(grp, {})[k] = dict(v)
    json.dump({'schema': 'buildapp.005q-ocr.score', 'version': 1, 'mode': a.mode, 'totals': totals, 'sheets': sheets_out}, open(os.path.join(a.out, f'label-chain-score-{a.mode}.json'), 'w'), indent=1, sort_keys=True)
    json.dump({'schema': 'buildapp.005q-ocr.label-records', 'version': 1, 'records': records}, open(os.path.join(a.work, f'label-records-{a.mode}.json'), 'w'), indent=1, sort_keys=True)
    print(json.dumps(totals, indent=1, sort_keys=True))


if __name__ == '__main__':
    main()
