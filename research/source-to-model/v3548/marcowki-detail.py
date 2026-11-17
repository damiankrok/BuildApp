#!/usr/bin/env python3
"""v3.54.8 — Marcówki GE: the detailed façade score, kept BESIDE the historical 16 features (marcowki-features.py), never
in their place.

    /usr/bin/python3 -I research/source-to-model/v3548/marcowki-detail.py <features.json> <truth json> <out json> [--faults]

<features.json> comes from measure-features.ts (v3.54.8: sides with frame properties and railings, the front portal
profile). The truth is the sealed source truth (research/marcowki-v2/marcowki-source-truth-v2.json): every target below
names the item it comes from. What the old metric did not score and this one does: the frame band's width (vertical and
across the slope), its inner contour, the joint at the ridge (continuous, nothing above the roof), the end of EACH leg,
the railing's infill and top, the continuity of the front band over the loggia and the portal, the slab's full extent,
both head heights of the raked glazings and the rear living glazing's head, and extra pieces.

Tolerances are fixed HERE, before any comparison, from the source's precision (elevations 0.017 m/px registered with a
residual under 0.1 m): a band within TOL_BAND (three pixels and the registration), a height within TOL_Y, a place along a
side within TOL_ALONG; the ridge joint within TOL_JOINT. A row whose truth the source leaves UNRESOLVED is reported with
its raw error and scored as unassessable (ok = None), never as met. Nothing here is tuned to a result.

--faults: the metric's own check — each named defect injected into a copy of the first model's measures must turn its
row from OK to NO (bars for glass; a frame with the right extent and the wrong band; a corner standing above the ridge;
the band missing over the portal).
"""
import copy
import json
import math
import sys

TOL_BAND = 0.10   # m: a band's width (3 px at 0.017 m/px + registration)
TOL_Y = 0.15      # m: a leg's end, a head, a soffit, a band's top (printed level marks, 2 px + registration)
TOL_ALONG = 0.15  # m: a slab's or a railing's end along its side
TOL_JOINT = 0.05  # m: how far the frame may stand above the roof at the ridge
PORTAL_SHARE = 0.9  # the share of the band's probes that must find it, soffit and top within TOL_Y


def items(path):
    t = json.load(open(path))
    return {i['id']: i for i in t['items']}


def along(side, x, W):
    return {'FRONT': x - W['x0'], 'REAR': W['x1'] - x}[side]


def span(side, lo, hi, W):
    return sorted([along(side, lo, W), along(side, hi, W)])


def score(m, I):
    if not m or not m.get('walls'):
        return {'built': False, 'rows': []}
    W = m['walls']
    sides = {s['side']: s for s in m['sides']}
    rows = []

    def row(feature, target, value, err, ok, source):
        rows.append({'feature': feature, 'target': target, 'model': value, 'error': None if err is None else round(err, 3), 'ok': ok, 'truth': source})

    def num(feature, target, value, tol, source, unresolved=False):
        if value is None:
            return row(feature, target, None, None, False if not unresolved else None, source)
        e = abs(value - target)
        row(feature, target, value, e, None if unresolved else e <= tol, source)

    verge = I['T2-ROOF-VERGE-MEMBER']['value'] if 'value' in I['T2-ROOF-VERGE-MEMBER'] else {}
    band_v = 0.82  # T2-ROOF-VERGE-MEMBER locators: 48–49 px vertical = 0.82 m on the front elevation
    band_perp = 0.64  # T2-UNRES-VERGE-DEPTH: "only the face width 0.64 is measured"
    pitch = I['T2-ROOF-MAIN']['value'].get('pitchDeg', 40) if isinstance(I['T2-ROOF-MAIN'].get('value'), dict) else 40
    ridge = I['T2-ROOF-MAIN']['value']['ridgeY']
    del verge
    for side, legs in (('FRONT', (0.0, I['T2-RECESS-FRONT-ATTIC']['value']['eastReturnBaseY'])), ('REAR', (0.0, 0.0))):
        f = sides.get(side, {}).get('frame')
        s = side.lower()
        if not f:
            row(f'{s} frame', 'present', 'none', None, False, 'T2-ASSEMBLY-%s-GABLE-FRAME' % side)
            continue
        row(f'{s} frame pieces', 1, f['pieces'], None, f['pieces'] == 1, 'one assembly (T2-ASSEMBLY-*-GABLE-FRAME)')
        num(f'{s} frame band (vertical)', band_v, f.get('bandVQ1'), TOL_BAND, 'T2-ROOF-VERGE-MEMBER (48–49 px)')
        num(f'{s} frame band (across the slope)', band_perp, f.get('bandPerp'), TOL_BAND, 'T2-UNRES-VERGE-DEPTH face width')
        # the inner contour at a quarter of the gable: the roof's top there minus the vertical band
        q1 = f['alongFrom'] + 0.25 * (f['alongTo'] - f['alongFrom'])
        apex_truth = (f['alongFrom'] + f['alongTo']) / 2
        inner = ridge - abs(apex_truth - q1) * math.tan(math.radians(pitch)) - band_v
        num(f'{s} frame inner contour at ¼', round(inner, 3), f.get('innerQ1'), TOL_Y, 'T2-LEVEL-RIDGE, T2-ROOF-MAIN pitch, band')
        row(f'{s} frame joint at the ridge', 'continuous, ≤ %.2f m above the roof, at the ridge' % TOL_JOINT, {'continuous': f.get('apexContinuous'), 'protrusionM': f.get('protrusionM'), 'apexAlong': f.get('apexAlong')},
            None if f.get('protrusionM') is None else abs(f['protrusionM']),
            bool(f.get('apexContinuous')) and f.get('protrusionM') is not None and f['protrusionM'] <= TOL_JOINT and f.get('apexAlong') is not None and abs(f['apexAlong'] - apex_truth) <= TOL_ALONG,
            'T2-ASSEMBLY-*-GABLE-FRAME: the rakes meet at the ridge')
        num(f'{s} frame left leg end', legs[0], f.get('legLeftBottom'), TOL_Y, 'returns to the ground (T2-RECESS-*)')
        num(f'{s} frame right leg end', legs[1], f.get('legRightBottom'), TOL_Y, 'T2-RECESS-FRONT-ATTIC eastReturnBaseY' if side == 'FRONT' else 'T2-RECESS-REAR east return to the ground')
    # railings: infill and top; the top is reported, its height is UNRESOLVED in the truth
    for side, tid in (('FRONT', 'T2-RAILING-FRONT'), ('REAR', 'T2-RAILING-REAR')):
        tv = I[tid]['value']
        a = span(side, tv['x'][0], tv['x'][1], W)
        rs = [r for r in sides.get(side, {}).get('railings', []) if r['alongTo'] > a[0] and r['alongFrom'] < a[1]]
        s = side.lower()
        row(f'{s} railings over the slab', 1, len(rs), None, len(rs) == 1, tid)
        r = rs[0] if rs else None
        row(f'{s} railing infill', tv['infill'], r['infill'] if r else None, None, (r is not None and r['infill'] == tv['infill']), tid)
        num(f'{s} railing top', tv['topY'], r['topY'] if r else None, TOL_Y, f'{tid} (height: T2-UNRES-RAILING-HEIGHT)', unresolved=True)
    # the front band over the loggia and the portal: one band from x 3.25 to 12.05, soffit 2.28, top 3.07
    fb = I['T2-FACADE-FRONT-BAND']['value']
    a = span('FRONT', fb['x'][0], fb['x'][1], W)
    probes = [p for p in m.get('portal', []) if a[0] + 0.2 <= p['a'] <= a[1] - 0.2]
    hit = [p for p in probes if p['soffit'] is not None and abs(p['soffit'] - fb['y'][0]) <= TOL_Y and p['top'] is not None and p['top'] >= fb['y'][1] - TOL_Y]
    share = len(hit) / len(probes) if probes else 0.0
    soff = sorted(p['soffit'] for p in probes if p['soffit'] is not None)
    row('front band continuity (loggia + portal)', f'{a[0]:.2f}–{a[1]:.2f} m, soffit {fb["y"][0]}, top {fb["y"][1]}', f'{len(hit)}/{len(probes)} probes; soffit median {soff[len(soff) // 2]:.2f}' if soff else f'0/{len(probes)} probes', None, share >= PORTAL_SHARE, 'T2-FACADE-FRONT-BAND')
    # the front slab's full extent
    bf = I['T2-BALCONY-FRONT']['value']
    a = span('FRONT', bf['x'][0], bf['x'][1], W)
    bs = [b for b in sides.get('FRONT', {}).get('balconies', []) if b['alongTo'] > a[0] and b['alongFrom'] < a[1]]
    if bs:
        b = bs[0]
        e = max(abs(b['alongFrom'] - a[0]), abs(b['alongTo'] - a[1]))
        row('front slab full extent', f'{a[0]:.2f}–{a[1]:.2f} m', f"{b['alongFrom']:.2f}–{b['alongTo']:.2f} m", e, e <= TOL_ALONG, 'T2-BALCONY-FRONT')
    else:
        row('front slab full extent', f'{a[0]:.2f}–{a[1]:.2f} m', None, None, False, 'T2-BALCONY-FRONT')
    # heads: both ends of each raked glazing; the rear living glazing's head
    for tid, side in (('T2-OPEN-FRONT-GABLE', 'FRONT'), ('T2-OPEN-REAR-GABLE-W', 'REAR'), ('T2-OPEN-REAR-GABLE-E', 'REAR')):
        tv = I[tid]['value']
        a = span(side, *tv['interval'], W)
        sh = [x for x in sides.get(side, {}).get('shapedOpenings', []) if abs((x['alongFrom'] + x['alongTo']) / 2 - (a[0] + a[1]) / 2) <= TOL_ALONG + (a[1] - a[0]) / 2]
        x = sorted(sh, key=lambda q: abs((q['alongFrom'] + q['alongTo']) / 2 - (a[0] + a[1]) / 2))[0] if sh else None
        hi = max(x['leftTopY'], x['rightTopY']) if x else None
        lo = min(x['leftTopY'], x['rightTopY']) if x else None
        num(f'{tid[8:].lower()} head high end', tv['headY'], hi, TOL_Y, tid)
        num(f'{tid[8:].lower()} head low end', tv['headFarY'], lo, TOL_Y, tid)
    rg = I['T2-OPEN-REAR-GLAZING']['value']
    a = span('REAR', *rg['interval'], W)
    hs = [h for h in m.get('openings', []) if h['side'] == 'REAR' and h['alongM'] is not None and h['bottomY'] < 1.0 and h['alongM'] < a[1] and h['alongM'] + h['widthM'] > a[0]]
    top = max((h['topY'] for h in hs), default=None)
    num('rear living glazing head', rg['headY'], top, TOL_Y, 'T2-OPEN-REAR-GLAZING 470/230')
    met = sum(1 for r in rows if r['ok'] is True)
    of = sum(1 for r in rows if r['ok'] is not None)
    return {'built': True, 'met': met, 'of': of, 'unassessable': sum(1 for r in rows if r['ok'] is None), 'rows': rows}


def faults(m, I):
    """Each defect injected into a copy of a model's measures, and the row it must turn from OK to NO."""
    out = []

    def case(name, row_name, mutate):
        base = {r['feature']: r['ok'] for r in score(m, I)['rows']}
        mm = copy.deepcopy(m)
        mutate(mm)
        got = {r['feature']: r['ok'] for r in score(mm, I)['rows']}
        out.append({'fault': name, 'row': row_name, 'before': base.get(row_name), 'after': got.get(row_name), 'detected': base.get(row_name) is True and got.get(row_name) is False})

    side = lambda mm, s: next(x for x in mm['sides'] if x['side'] == s)

    def bars(mm):
        for r in side(mm, 'FRONT')['railings']:
            r['infill'] = 'BARS'

    def wide(mm):
        f = side(mm, 'FRONT')['frame']
        f['bandVQ1'] = f['bandVQ1'] + 0.35  # extent, pieces and depth untouched: only the band
        f['bandPerp'] = f['bandPerp'] + 0.27

    def corner(mm):
        f = side(mm, 'FRONT')['frame']
        f['protrusionM'] = 0.4
        f['apexContinuous'] = False

    def noband(mm):
        for p in mm['portal']:
            if p['a'] > 7.9:
                p['soffit'] = None
                p['top'] = None

    case('bars instead of glass', 'front railing infill', bars)
    case('right extent, wrong band width', 'front frame band (vertical)', wide)
    case('a corner standing above the ridge', 'front frame joint at the ridge', corner)
    case('no band over the portal', 'front band continuity (loggia + portal)', noband)
    return out


def main():
    feats, truth, out = sys.argv[1:4]
    F = json.load(open(feats))
    I = items(truth)
    res = {'schema': 'buildapp.v3548-marcowki-detail/1', 'tolerances': {'bandM': TOL_BAND, 'yM': TOL_Y, 'alongM': TOL_ALONG, 'jointM': TOL_JOINT, 'portalShare': PORTAL_SHARE}, 'models': {}}
    for label, m in F.items():
        res['models'][label] = {'note': m.get('note'), 'modelHash': m.get('modelHash'), **score(m, I)}
    if '--faults' in sys.argv:
        first = next(iter(F))
        res['faults'] = {'on': first, 'cases': faults(F[first], I)}
    json.dump(res, open(out, 'w'), indent=1, ensure_ascii=False)
    for label, r in res['models'].items():
        print(f"{label:24s} {r.get('met', '-')}/{r.get('of', '-')} (+{r.get('unassessable', 0)} unassessable)")
        for row in r.get('rows', []):
            mark = 'OK ' if row['ok'] else ('?  ' if row['ok'] is None else 'NO ')
            print(f"   {mark} {row['feature']:42s} target {str(row['target'])[:46]:46s} model {str(row['model'])[:60]}")
    for c in res.get('faults', {}).get('cases', []):
        print(f"fault {c['fault']:36s} {c['row']:40s} {c['before']} -> {c['after']}  detected={c['detected']}")


main()
