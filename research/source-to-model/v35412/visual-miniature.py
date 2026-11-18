#!/usr/bin/env python3
"""v3.54.12 — VISUAL_MINIATURE: is it recognisably this house? A fixed identity card, scored per feature as
PRESERVED / APPROXIMATE / MISSING / CONTRADICTORY. Separate from METRIC_EVIDENCE: nothing here sets a measured value,
EXACT, quantities-usable or closes a metric defect, and the historical scorers stay as they are (diagnostics).

    /usr/bin/python3 -I research/source-to-model/v35412/visual-miniature.py <identity.json> <features.json> <zone-refs.json|-> <out.json> [label …]
    /usr/bin/python3 -I research/source-to-model/v35412/visual-miniature.py --self-test

<features.json> from research/source-to-model/v35411/measure-features.ts (`sides`, `openings`, `flatRoofs`, `walls`,
`portal`); <zone-refs.json> from v35411/zone-refs.py on the same labels ("-" when none: zone features MISSING_INPUT,
reported, never dropped). The denominator is the whole card for every model: a feature the model did not build is
MISSING, it is not removed from the count.

Verdict: NOT_RECOGNISABLE when any critical feature is MISSING or CONTRADICTORY; else RECOGNISABLE with the counts.
The tolerances are the card's (an executor's proposal, not an OWNER requirement).
"""
import json
import sys

STATES = ('PRESERVED', 'APPROXIMATE', 'MISSING', 'CONTRADICTORY')


def within(v, want, tol):
    return abs(v - want) <= tol


def grade_interval(got, want, tol):
    """two ends against two ends: PRESERVED within tol, APPROXIMATE within 2·tol."""
    e = max(abs(got[0] - want[0]), abs(got[1] - want[1]))
    if e <= tol:
        return 'PRESERVED', e
    if e <= 2 * tol:
        return 'APPROXIMATE', e
    return None, e


def overlap(a, b):
    return max(0.0, min(a[1], b[1]) - max(a[0], b[0]))


def side(m, name):
    return next((s for s in m.get('sides', []) if s['side'] == name), {})


def score_feature(f, m, zones):
    c = f['check']
    if c == 'envelopeWidth':
        w = m.get('walls', {}).get('widthM')
        if w is None:
            return 'MISSING', 'no walls measured'
        st = 'PRESERVED' if within(w, f['expect'], f['tol']) else 'APPROXIMATE' if within(w, f['expect'], 2 * f['tol']) else 'CONTRADICTORY'
        two = len(m.get('flatRoofs', [])) > 0
        if not two:
            return 'MISSING', f'width {w:.2f}, no lower flat-roofed wing'
        return st, f'width {w:.2f} (want {f["expect"]}), a flat-roofed wing beside the gable body'
    if c == 'garageSide':
        rs = m.get('flatRoofs', [])
        if not rs:
            return 'MISSING', 'no flat roof (garage wing) built'
        best = max(rs, key=lambda r: r['x1'] - r['x0'])
        got = (best['x0'], best['x1'])
        w = m.get('walls', {}).get('widthM', 12.05)
        mirrored = (w - got[1], w - got[0])
        g, e = grade_interval(got, f['expect'], f['tol'])
        if g:
            return g, f'{best["id"]} along {got[0]:.2f}-{got[1]:.2f} (want {f["expect"][0]}-{f["expect"][1]}, error {e:.2f})'
        if grade_interval(mirrored, f['expect'], f['tol'])[0]:
            return 'CONTRADICTORY', f'{best["id"]} along {got[0]:.2f}-{got[1]:.2f}: the garage is on the other side (mirror)'
        return 'CONTRADICTORY', f'{best["id"]} along {got[0]:.2f}-{got[1]:.2f}, not where the source has it'
    if c == 'roofGable':
        # read from the model itself (its roof records), never from a band probe: a gable seen on its end from the front
        # has its ridge along Z (perpendicular to the front plane), i.e. sloped planes falling along ±X
        mod = m.get('_model')
        top = m.get('walls', {}).get('y1')
        if mod is None or top is None:
            return 'MISSING', 'MISSING_INPUT: no model given for the roof (--model label=path)'
        slopes = []
        for r in mod.get('roofs', []):
            if r.get('kind') in ('GABLE', 'HIP', 'SHED', 'MONO') and (r.get('pitchDeg') or 0) > 5:
                slopes.append((r['kind'], r.get('ridgeAxis'), r['pitchDeg'], r['id']))
        for q in mod.get('roofPlanes', []):
            if (q.get('pitchDeg') or 0) > 5:
                d = q.get('downslope') or {}
                axis = 'Z' if abs(d.get('x', 0)) > abs(d.get('z', 0)) else 'X'
                slopes.append(('PLANE', axis, q['pitchDeg'], q['id']))
        if not slopes:
            return 'CONTRADICTORY', f'no pitched roof (top {top:.2f})'
        gable = [x for x in slopes if x[0] == 'GABLE'] or [x for x in slopes if x[0] == 'PLANE']
        kinds = {x[0] for x in slopes}
        axes = {x[1] for x in gable}
        if (kinds == {'PLANE'} and len(gable) < 2) or axes != {'Z'}:
            return 'CONTRADICTORY', f'roof {sorted(kinds)} with ridge axis {sorted(axes)}: not a gable with its ridge perpendicular to the front'
        pitch = max(x[2] for x in gable)
        ok_p = within(pitch, f['expectPitch'], f['tolPitch'])
        ok_r = within(top, f['expectRidgeY'], f['tolRidgeY'])
        st = 'PRESERVED' if ok_p and ok_r else 'APPROXIMATE'
        return st, f'gable ({", ".join(x[3] for x in gable)}), ridge along Z, pitch {pitch:g} (want {f["expectPitch"]}), ridge {top:.2f} (want {f["expectRidgeY"]})'
    if c == 'frame':
        fr = side(m, f['side']).get('frame')
        if not fr or fr.get('pitchDeg') is None:
            return 'MISSING', f'no gable frame on {f["side"]}'
        g, e = grade_interval((fr['alongFrom'], fr['alongTo']), f['expect'], f['tol'])
        d = fr.get('depthM') or 0.0
        if not g:
            return 'CONTRADICTORY', f'frame along {fr["alongFrom"]:.2f}-{fr["alongTo"]:.2f}, not over the main body'
        if not within(d, f['expectDepth'], f['tolDepth']):
            g = 'APPROXIMATE' if within(d, f['expectDepth'], 2 * f['tolDepth']) else 'MISSING'
        return g, f'frame along {fr["alongFrom"]:.2f}-{fr["alongTo"]:.2f}, {d:.2f} m deep, band {fr.get("bandVQ1")}'
    if c == 'loggia':
        s = side(m, f['side'])
        bs = s.get('balconies', [])
        if not bs:
            return 'MISSING', f'no loggia/balcony on {f["side"]}'
        b = max(bs, key=lambda q: overlap((q['alongFrom'], q['alongTo']), f['expect']))
        g, e = grade_interval((b['alongFrom'], b['alongTo']), f['expect'], f['tol'])
        rail = any(r.get('infill') == 'GLASS' for r in s.get('railings', []))
        if not g:
            return 'APPROXIMATE' if overlap((b['alongFrom'], b['alongTo']), f['expect']) > 0 else 'CONTRADICTORY', f'{b["id"]} {b["alongFrom"]:.2f}-{b["alongTo"]:.2f} (want {f["expect"]})'
        if not b.get('recessed', False):
            g = 'APPROXIMATE'
        if not rail:
            g = 'APPROXIMATE'
        return g, f'{b["id"]} {b["alongFrom"]:.2f}-{b["alongTo"]:.2f}, recessed {b.get("recessed")}, glass railing {rail}'
    if c in ('raked', 'rakedPair'):
        want = [f['expect']] if c == 'raked' else f['expect']
        got = side(m, f['side']).get('shapedOpenings', [])
        out, worst = [], 'PRESERVED'
        for w in want:
            cand = [o for o in got if overlap((o['alongFrom'], o['alongTo']), w) > 0]
            if not cand:
                worst = 'MISSING'
                out.append(f'{w}: none')
                continue
            o = max(cand, key=lambda q: overlap((q['alongFrom'], q['alongTo']), w))
            g, e = grade_interval((o['alongFrom'], o['alongTo']), w, f['tol'])
            raked = abs(o['leftTopY'] - o['rightTopY']) > 0.5
            if not raked:
                g = 'CONTRADICTORY'
            if c == 'raked' and f.get('expectHigh') == 'LEFT' and o['leftTopY'] < o['rightTopY']:
                g = 'CONTRADICTORY'
            g = g or 'APPROXIMATE'
            if STATES.index(g) > STATES.index(worst):
                worst = g
            out.append(f'{o["id"]} {o["alongFrom"]:.2f}-{o["alongTo"]:.2f} heads {o["leftTopY"]:.2f}/{o["rightTopY"]:.2f}')
        return worst, '; '.join(out)
    if c == 'opening':
        ops = [o for o in m.get('openings', []) if o['side'] == f['side'] and o['widthM'] >= f['minWidth'] and o['bottomY'] < 0.5]
        cand = [o for o in ops if overlap((o['alongM'], o['alongM'] + o['widthM']), f['expect']) > 0]
        if not cand:
            return 'MISSING', f'no opening >= {f["minWidth"]} m on {f["side"]} over {f["expect"]}'
        o = max(cand, key=lambda q: overlap((q['alongM'], q['alongM'] + q['widthM']), f['expect']))
        g, e = grade_interval((o['alongM'], o['alongM'] + o['widthM']), f['expect'], f['tol'])
        return g or 'APPROXIMATE', f'{o["id"]} {o["alongM"]:.2f}+{o["widthM"]:.2f} (want {f["expect"]}, error {e:.2f})'
    if c in ('zone', 'zonesAll'):
        if zones is None:
            return 'MISSING', 'MISSING_INPUT: no zone-point measure given for this model'
        pts = zones
        if c == 'zone':
            sel = [p for p in pts if p['id'] in f['points']]
            ok = sum(1 for p in sel if p['ok'])
            st = 'PRESERVED' if ok == len(sel) else 'APPROXIMATE' if ok else 'MISSING'
            return st, f'{ok}/{len(sel)} points of the right class ({", ".join(p["id"] + ":" + p["got"] for p in sel)})'
        ok = sum(1 for p in pts if p['ok'])
        share = ok / max(len(pts), 1)
        st = 'PRESERVED' if share >= f['minShare'] else 'APPROXIMATE' if share >= f['minShare'] / 2 else 'MISSING'
        return st, f'{ok}/{len(pts)} zone points of the right class'
    if c == 'noFalseLarge':
        bad = []
        for o in m.get('openings', []):
            if o['widthM'] < f['minWidth']:
                continue
            iv = (o['alongM'], o['alongM'] + o['widthM'])
            if not any(overlap(iv, a) >= 0.5 * o['widthM'] for a in f['allowed'].get(o['side'], [])):
                bad.append(f'{o["id"]} {o["side"]} {iv[0]:.2f}+{o["widthM"]:.2f}')
        return ('CONTRADICTORY', 'large opening(s) without a source: ' + '; '.join(bad)) if bad else ('PRESERVED', 'none')
    raise ValueError(f'unknown check {c}')


def zone_points(zr, label):
    if zr is None:
        return None
    rows = zr.get(label) or zr.get('models', {}).get(label)
    if rows is None:
        return None
    rows = rows.get('rows', rows.get('points', [])) if isinstance(rows, dict) else rows
    return [{'id': r['id'], 'ok': bool(r.get('ok')), 'got': str(r.get('got') or r.get('gotClass'))} for r in rows]


def score_model(card, m, zones):
    rows, counts = [], {s: 0 for s in STATES}
    for f in card['features']:
        st, why = score_feature(f, m, zones)
        counts[st] += 1
        rows.append({'id': f['id'], 'critical': f.get('critical', False), 'state': st, 'why': why})
    crit = [r['id'] for r in rows if r['critical'] and r['state'] in ('MISSING', 'CONTRADICTORY')]
    return {'verdict': 'NOT_RECOGNISABLE' if crit else 'RECOGNISABLE', 'criticalFailures': crit, 'counts': counts, 'of': len(rows), 'rows': rows}


def self_test():
    card = {'features': [
        {'id': 'G', 'check': 'garageSide', 'side': 'FRONT', 'expect': [7.9, 12.05], 'tol': 0.6, 'critical': True},
        {'id': 'F', 'check': 'frame', 'side': 'FRONT', 'expect': [0, 7.9], 'expectDepth': 1.0, 'tol': 0.6, 'tolDepth': 0.3, 'critical': True},
        {'id': 'L', 'check': 'noFalseLarge', 'minWidth': 2.0, 'allowed': {'FRONT': [[8.55, 11.3]]}, 'critical': True}]}
    good = {'walls': {'widthM': 12.05}, 'flatRoofs': [{'id': 'g', 'x0': 7.9, 'x1': 12.05}],
            'sides': [{'side': 'FRONT', 'frame': {'alongFrom': 0, 'alongTo': 7.9, 'depthM': 1.0, 'pitchDeg': 40}}],
            'openings': [{'id': 'd', 'side': 'FRONT', 'alongM': 8.56, 'widthM': 2.75, 'bottomY': 0}]}
    r = score_model(card, good, None)
    assert r['verdict'] == 'RECOGNISABLE' and r['counts']['PRESERVED'] == 3, r
    mirror = json.loads(json.dumps(good))
    mirror['flatRoofs'] = [{'id': 'g', 'x0': 0.0, 'x1': 4.15}]
    r = score_model(card, mirror, None)
    assert r['rows'][0]['state'] == 'CONTRADICTORY' and 'mirror' in r['rows'][0]['why'] and r['verdict'] == 'NOT_RECOGNISABLE', r
    noframe = json.loads(json.dumps(good))
    noframe['sides'][0]['frame'] = None
    r = score_model(card, noframe, None)
    assert r['rows'][1]['state'] == 'MISSING' and r['of'] == 3 and r['verdict'] == 'NOT_RECOGNISABLE', r
    shifted = json.loads(json.dumps(good))
    shifted['openings'][0]['alongM'] = 8.05  # the OWNER's accepted simplification: the door moved toward the wall edge
    r = score_model(card, shifted, None)
    assert r['verdict'] == 'RECOGNISABLE', r
    falsel = json.loads(json.dumps(good))
    falsel['openings'].append({'id': 'x', 'side': 'FRONT', 'alongM': 1.0, 'widthM': 3.0, 'bottomY': 0})
    r = score_model(card, falsel, None)
    assert r['rows'][2]['state'] == 'CONTRADICTORY', r
    card2 = {'features': [{'id': 'R', 'check': 'roofGable', 'expectPitch': 40, 'tolPitch': 5, 'expectRidgeY': 7.95, 'tolRidgeY': 0.5, 'critical': True}]}
    gz = {'walls': {'y1': 7.9}, '_model': {'roofs': [{'id': 'r', 'kind': 'GABLE', 'ridgeAxis': 'Z', 'pitchDeg': 40}]}}
    assert score_model(card2, gz, None)['rows'][0]['state'] == 'PRESERVED'
    gx = {'walls': {'y1': 7.9}, '_model': {'roofs': [{'id': 'r', 'kind': 'GABLE', 'ridgeAxis': 'X', 'pitchDeg': 40}]}}
    assert score_model(card2, gx, None)['rows'][0]['state'] == 'CONTRADICTORY'
    planes = {'walls': {'y1': 7.95}, '_model': {'roofPlanes': [{'id': 'a', 'pitchDeg': 40, 'downslope': {'x': 1, 'z': 0}}, {'id': 'b', 'pitchDeg': 40, 'downslope': {'x': -1, 'z': 0}}]}}
    assert score_model(card2, planes, None)['rows'][0]['state'] == 'PRESERVED'
    print('self-test OK: a ridge parallel to the front is CONTRADICTORY; mirror -> CONTRADICTORY, missing frame keeps the denominator, accepted door shift stays recognisable, a new large opening is caught')


def main():
    if '--self-test' in sys.argv:
        self_test()
        return
    args = sys.argv[1:]
    models = {}
    while '--model' in args:
        i = args.index('--model')
        lab, path = args[i + 1].split('=', 1)
        models[lab] = json.load(open(path))
        del args[i:i + 2]
    card_p, feat_p, zr_p, out_p, *labels = args
    card = json.load(open(card_p))
    feats = json.load(open(feat_p))
    feats = feats.get('models', feats)
    zr = None if zr_p == '-' else json.load(open(zr_p))
    labels = labels or [k for k in feats if isinstance(feats[k], dict) and 'sides' in feats[k]]
    res = {'schema': 'buildapp.v35412-visual-miniature/1', 'card': card_p, 'tolerancesAreExecutorProposal': True, 'models': {}}
    for lab in labels:
        m = feats[lab]
        if not isinstance(m, dict) or 'sides' not in m:
            continue
        if lab in models:
            m = dict(m, _model=models[lab])
        r = score_model(card, m, zone_points(zr, lab))
        res['models'][lab] = r
        c = r['counts']
        print(f"{lab:22s} {r['verdict']:17s} preserved {c['PRESERVED']}, approximate {c['APPROXIMATE']}, missing {c['MISSING']}, contradictory {c['CONTRADICTORY']} of {r['of']}" + (f"  critical: {', '.join(r['criticalFailures'])}" if r['criticalFailures'] else ''))
        for row in r['rows']:
            if row['state'] != 'PRESERVED':
                print(f"   {row['state']:13s} {row['id']:26s} {row['why']}")
    open(out_p, 'w').write(json.dumps(res, ensure_ascii=False, indent=1) + '\n')


if __name__ == '__main__':
    main()
