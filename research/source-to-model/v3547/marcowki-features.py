#!/usr/bin/env python3
"""v3.54.7 — Marcówki GE: the characteristic features of each model against the sealed source truth.

    /usr/bin/python3 -I research/source-to-model/v3547/marcowki-features.py <features.json> <truth json> <out json>

<features.json> comes from measure-features.ts (one entry per model: LOCAL, H before review, H after, delivered).
Every check is a feature the Master Plan v3.54.7 §4 names: the front and rear gable frame (presence, extent across the
gable, depth), the front and rear loggia (a slab in the recess, no free supports, its extent), the portal head (the
garage roof edge over the entrance: its top and soffit), the garage door, the shape and place of the three gable
glazings, and the left side (its wall and both openings). Tolerances are fixed HERE, before any comparison, from the
precision of the source: the elevations are registered at 0.017 m/px with a residual under 0.1 m, the plan at 0.02
m/px; a reading is within source precision when it is within TOL_POS of the truth. Nothing here is tuned to a result.
"""
import json
import sys

TOL_POS = 0.30     # m: ends, middles and widths along a side; tops and sills (two elevation pixels + registration)
TOL_DEPTH = 0.15   # m: the depth of a frame or a recess (plan precision ~0.02 m/px, a return 0.61 m)
TOL_Y = 0.15       # m: the portal head's top and soffit (printed level marks)


def near(a, b, tol=TOL_POS):
    return a is not None and b is not None and abs(a - b) <= tol


def truth_items(path):
    t = json.load(open(path))
    return {i['id']: i['value'] for i in t['items']}


def along(side, x, W):
    # the scene ruler's "along": from the left end of the walls as a viewer outside sees them
    return {'FRONT': x - W['x0'], 'REAR': W['x1'] - x, 'LEFT': W['z1'] - x, 'RIGHT': x - W['z0']}[side]


def span(side, lo, hi, W):
    a = sorted([along(side, lo, W), along(side, hi, W)])
    return a


def check_model(m, T):
    if not m or not m.get('walls'):
        return {'built': False}
    W = m['walls']
    sides = {s['side']: s for s in m['sides']}
    rows = []

    def row(feature, ok, truth, model, unknown=False):
        rows.append({'feature': feature, 'ok': None if unknown else bool(ok), 'truth': truth, 'model': model})

    main_x = (0.0, 7.9)
    # gable frames
    for side in ('FRONT', 'REAR'):
        f = sides.get(side, {}).get('frame')
        want = span(side, *main_x, W)
        if not f:
            row(f'{side.lower()} gable frame', False, f'frame across {want[0]:.2f}–{want[1]:.2f} m along, 1.00 m deep', 'none')
            continue
        ok = near(f['alongFrom'], want[0]) and near(f['alongTo'], want[1])
        row(f'{side.lower()} gable frame extent', ok, f'{want[0]:.2f}–{want[1]:.2f} m along', f"{f['alongFrom']:.2f}–{f['alongTo']:.2f} m ({f['pieces']} piece(s))")
        row(f'{side.lower()} gable frame depth', near(f['depthM'], 1.0, TOL_DEPTH), '1.00 m (returns 0.61 m wide, 1.00 m deep)', f"{f['depthM']:.2f} m")
    # loggias / balconies in the recesses
    for side, tid in (('FRONT', 'T2-BALCONY-FRONT'), ('REAR', 'T2-BALCONY-REAR')):
        tv = T[tid]
        want = span(side, tv['x'][0], tv['x'][1], W)
        bs = sides.get(side, {}).get('balconies', [])
        upper = [b for b in bs if b['alongTo'] > want[0] and b['alongFrom'] < want[1]]
        if not upper:
            row(f'{side.lower()} loggia', False, f'slab in the recess {want[0]:.2f}–{want[1]:.2f} m, no supports', 'none')
            continue
        b = upper[0]
        row(f'{side.lower()} loggia in the recess', b['recessed'] and b['posts'] == 0, 'in the plane of the returns, no free supports', f"{'recessed' if b['recessed'] else str(b['projectsM']) + ' m out'}, {b['posts']} post(s)")
        row(f'{side.lower()} loggia extent', near(b['alongFrom'], want[0]) and near(b['alongTo'], want[1]), f'{want[0]:.2f}–{want[1]:.2f} m', f"{b['alongFrom']:.2f}–{b['alongTo']:.2f} m")
    # the portal head: the garage's flat roof edge over the front, its top and soffit
    ph = T['T2-PORTAL-HEAD']
    flats = [r for r in m.get('flatRoofs', []) if r['z0'] <= 0.5]
    if flats:
        r = flats[0]
        row('portal head (garage roof edge) top', near(r['y1'], ph['fasciaTopY'], TOL_Y), f"{ph['fasciaTopY']:.2f} m", f"{r['y1']:.2f} m")
        row('portal head soffit', near(r['y0'], ph['fasciaSoffitY'], TOL_Y), f"{ph['fasciaSoffitY']:.2f} m (a band 0.79 m deep)", f"{r['y0']:.2f} m", unknown=False)
    else:
        row('portal head (garage roof edge)', False, f"top {ph['fasciaTopY']} m, soffit {ph['fasciaSoffitY']} m", 'no flat roof reaching the front plane')
    # openings
    holes = m.get('openings', [])

    def hole_at(side, a0, a1):
        c = (a0 + a1) / 2
        cands = [h for h in holes if h['side'] == side and h['alongM'] is not None and abs(h['alongM'] + h['widthM'] / 2 - c) <= max(TOL_POS, (a1 - a0) / 2)]
        return sorted(cands, key=lambda h: abs(h['alongM'] + h['widthM'] / 2 - c))[0] if cands else None

    gd = T['T2-OPEN-GARAGE-DOOR']
    a = span('FRONT', *gd['interval'], W)
    h = hole_at('FRONT', *a)
    row('garage door', h is not None and near(h['alongM'], a[0]) and near(h['widthM'], gd['widthM']) and near(h['topY'], gd['headY']), f"{a[0]:.2f}+{gd['widthM']:.2f} m, head {gd['headY']}", f"{h['alongM']:.2f}+{h['widthM']:.2f} m, head {h['topY']:.2f}" if h else 'none')
    for tid, side in (('T2-OPEN-FRONT-GABLE', 'FRONT'), ('T2-OPEN-REAR-GABLE-W', 'REAR'), ('T2-OPEN-REAR-GABLE-E', 'REAR')):
        tv = T[tid]
        a = span(side, *tv['interval'], W)
        shaped = [s for s in sides.get(side, {}).get('shapedOpenings', []) if abs((s['alongFrom'] + s['alongTo']) / 2 - (a[0] + a[1]) / 2) <= TOL_POS + (a[1] - a[0]) / 2]
        far = tv.get('headFarY') or tv.get('headYFar') or tv.get('farHeadY')
        if not shaped:
            plain = hole_at(side, *a)
            row(f'{tid[8:].lower()} raked glazing', False, f"{a[0]:.2f}–{a[1]:.2f} m, sill {tv['sillY']}, head {tv['headY']}→{far}", f"a level hole {plain['alongM']:.2f}+{plain['widthM']:.2f} m" if plain else 'none')
            continue
        s = shaped[0]
        hi = max(s['leftTopY'], s['rightTopY'])
        lo = min(s['leftTopY'], s['rightTopY'])
        ok = near(s['alongFrom'], a[0]) and near(s['alongTo'], a[1]) and near(hi, tv['headY']) and (far is None or near(lo, far))
        row(f'{tid[8:].lower()} raked glazing', ok, f"{a[0]:.2f}–{a[1]:.2f} m, head {tv['headY']}→{far}", f"{s['alongFrom']:.2f}–{s['alongTo']:.2f} m, head {hi:.2f}→{lo:.2f}")
    # the left side: its wall and both openings
    for tid in ('T2-OPEN-WEST-LIVING', 'T2-OPEN-WEST-KITCHEN'):
        tv = T[tid]
        a = span('LEFT', *tv['interval'], W)
        h = hole_at('LEFT', *a)
        row(f'left {tid.split("-")[-1].lower()} window', h is not None and near(h['alongM'], a[0]) and near(h['widthM'], tv['widthM']), f"{a[0]:.2f}+{tv['widthM']:.2f} m", f"{h['alongM']:.2f}+{h['widthM']:.2f} m" if h else 'none')
    met = sum(1 for r in rows if r['ok'])
    return {'built': True, 'met': met, 'of': sum(1 for r in rows if r['ok'] is not None), 'rows': rows}


def main():
    feats, truth, out = sys.argv[1:4]
    F = json.load(open(feats))
    T = truth_items(truth)
    res = {'schema': 'buildapp.v3547-marcowki-features/1', 'tolerances': {'posM': TOL_POS, 'depthM': TOL_DEPTH, 'yM': TOL_Y}, 'models': {}}
    for label, m in F.items():
        res['models'][label] = {'note': m.get('note'), 'modelHash': m.get('modelHash'), **check_model(m, T)}
    json.dump(res, open(out, 'w'), indent=1)
    for label, r in res['models'].items():
        print(f"{label:24s} {r.get('met', '-')}/{r.get('of', '-')}")
        for row in r.get('rows', []):
            print(f"   {'OK ' if row['ok'] else ('?  ' if row['ok'] is None else 'NO ')} {row['feature']:36s} truth {row['truth']:48s} model {row['model']}")


main()
