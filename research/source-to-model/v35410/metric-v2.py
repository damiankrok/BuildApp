#!/usr/bin/env python3
"""v3.54.9 — Marcówki GE: scorer version 2, kept BESIDE the 27 rows of v3.54.8 (marcowki-detail.py), never in their place.

    /usr/bin/python3 -I research/source-to-model/v3549/metric-v2.py <features.json> <truth json> <out json> \
        [label=<model.json>[,<house.json>] …] [--inventory <inventory.json>]

<features.json> comes from measure-features.ts (one entry per label). The truth is the sealed source truth
(research/marcowki-v2/marcowki-source-truth-v2.json). Per label it reports:

1. `rows27`: the v3.54.8 detailed rows exactly as marcowki-detail.py scores them (imported, not copied), so the old
   27 features stay comparable across stages.
2. `glazing`: each raked glazing (T2-OPEN-FRONT-GABLE, T2-OPEN-REAR-GABLE-W/-E) at BOTH its ends, each end compared at
   its own place (the high end is the one nearer the main ridge, T2-ROOF-MAIN ridgeX) — so a head mirrored left for
   right fails both ends even when its two heights are right — and its head angle atan2(Δh, span) against the source's
   atan2(headY − headFarY, widthM). The old rows took min/max of the two heights and could not see a mirror.
3. `interior` (needs the model): per storey the rooms of the model against the source's room polygons (T2-ROOM-*):
   matched (best IoU ≥ 0.3, one to one), missing, extra, merged (one model room over ≥ 2 source rooms), per matched
   room its shape error (1 − IoU) and, separately, its area error (m², the model polygon against the source polygon —
   area is a check, not the fit); floor coverage (the union of the model's rooms over the source's); the partitions,
   the doors in them, the passage topology (rooms joined by doors: components); the upper floor's openings against
   the source's stair shaft (T2-STAIR-TOPOLOGY).
4. `storeys` (with --inventory): per storey the plan pictures available, sent (which step), read into what, and built.

The model is registered to the truth frame by its exterior walls' extent (x east of the west outer face, z north of the
front outer plane); the residual of that registration is reported, and a model that needs a mirror is NOT mirrored
here (its rooms then simply do not match). Tolerances are fixed here before any comparison: TOL_Y as v3.54.8 (0.15 m),
TOL_ANGLE 2.5° (two pixels of 0.017 m over a 2.34 m span ≈ 0.8°, plus the registration), IOU_MATCH 0.3.
"""
import importlib.util
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('detail3548', os.path.join(HERE, '..', 'v3548', 'marcowki-detail.py'))
detail = importlib.util.module_from_spec(spec)
spec.loader.exec_module(detail)

SCORER = 'buildapp.v3549-marcowki-metric/2'
TOL_Y = 0.15
TOL_ANGLE = 2.5
IOU_MATCH = 0.3
GRID = 0.05


def inside(poly, x, z):
    c = False
    n = len(poly)
    for i in range(n):
        x1, z1 = poly[i]
        x2, z2 = poly[(i + 1) % n]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            c = not c
    return c


def area(poly):
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))) / 2


def cells(poly, holes=()):
    xs = [p[0] for p in poly]
    zs = [p[1] for p in poly]
    out = set()
    i0, i1 = int(math.floor(min(xs) / GRID)), int(math.ceil(max(xs) / GRID))
    j0, j1 = int(math.floor(min(zs) / GRID)), int(math.ceil(max(zs) / GRID))
    for i in range(i0, i1):
        for j in range(j0, j1):
            x, z = (i + 0.5) * GRID, (j + 0.5) * GRID
            if inside(poly, x, z) and not any(inside(h, x, z) for h in holes):
                out.add((i, j))
    return out


def iou(a, b):
    u = len(a | b)
    return len(a & b) / u if u else 0.0


def glazing(f, I):
    W = f.get('walls')
    sides = {s['side']: s for s in f.get('sides', [])}
    ridge = I['T2-ROOF-MAIN']['value']['ridgeX']
    out = []
    for tid, side in (('T2-OPEN-FRONT-GABLE', 'FRONT'), ('T2-OPEN-REAR-GABLE-W', 'REAR'), ('T2-OPEN-REAR-GABLE-E', 'REAR')):
        tv = I[tid]['value']
        lo_x, hi_x = tv['interval']
        high_x = lo_x if abs(lo_x - ridge) < abs(hi_x - ridge) else hi_x
        low_x = hi_x if high_x == lo_x else lo_x
        angle_t = math.degrees(math.atan2(tv['headY'] - tv['headFarY'], tv['widthM']))
        rec = {'id': tid, 'truth': {'highEndAlong': None, 'highY': tv['headY'], 'lowY': tv['headFarY'], 'angleDeg': round(angle_t, 2), 'callout': tv.get('printedCallout')}}
        if not W:
            out.append({**rec, 'built': False})
            continue
        a_hi, a_lo = detail.along(side, high_x, W), detail.along(side, low_x, W)
        rec['truth']['highEndAlong'] = round(a_hi, 3)
        rec['truth']['lowEndAlong'] = round(a_lo, 3)
        mid = (a_hi + a_lo) / 2
        sh = [x for x in sides.get(side, {}).get('shapedOpenings', []) or [] if abs((x['alongFrom'] + x['alongTo']) / 2 - mid) <= 0.15 + abs(a_hi - a_lo) / 2]
        x = sorted(sh, key=lambda q: abs((q['alongFrom'] + q['alongTo']) / 2 - mid))[0] if sh else None
        if not x:
            out.append({**rec, 'built': False, 'ok': False, 'why': 'no raked glazing built there'})
            continue
        # the model's height at each of the source's two ends: the end of the built glazing nearer that place
        at = lambda a: x['leftTopY'] if abs(a - x['alongFrom']) <= abs(a - x['alongTo']) else x['rightTopY']
        y_hi, y_lo = at(a_hi), at(a_lo)
        span_m = abs(x['alongTo'] - x['alongFrom'])
        angle_m = math.degrees(math.atan2(y_hi - y_lo, span_m)) if span_m > 0 else None
        e_hi, e_lo = abs(y_hi - tv['headY']), abs(y_lo - tv['headFarY'])
        e_ang = abs(angle_m - angle_t) if angle_m is not None else None
        rec.update({'built': True, 'model': {'id': x['id'], 'alongFrom': x['alongFrom'], 'alongTo': x['alongTo'], 'yAtHighEnd': round(y_hi, 3), 'yAtLowEnd': round(y_lo, 3), 'angleDeg': None if angle_m is None else round(angle_m, 2)},
                    'error': {'highEnd': round(e_hi, 3), 'lowEnd': round(e_lo, 3), 'angleDeg': None if e_ang is None else round(e_ang, 2)},
                    'ok': {'highEnd': e_hi <= TOL_Y, 'lowEnd': e_lo <= TOL_Y, 'angle': e_ang is not None and e_ang <= TOL_ANGLE, 'sense': (y_hi > y_lo) == (tv['headY'] > tv['headFarY'])}})
        out.append(rec)
    return out


def interior(model, I):
    levels = {l['id']: l['index'] for l in model.get('levels', [])}
    ext = [w for w in model.get('walls', []) if w.get('kind') != 'INTERIOR']
    if not ext:
        return {'built': False}
    x0 = min(min(w['start']['x'], w['end']['x']) for w in ext)
    z0 = min(min(w['start']['z'], w['end']['z']) for w in ext)
    x1 = max(max(w['start']['x'], w['end']['x']) for w in ext)
    z1 = max(max(w['start']['z'], w['end']['z']) for w in ext)
    T = lambda p: (p['x'] - x0, p['z'] - z0)
    reg = {'modelExtent': [round(x1 - x0, 3), round(z1 - z0, 3)], 'truthExtent': [12.05, 14.60], 'residual': [round(x1 - x0 - 12.05, 3), round(z1 - z0 - 14.60, 3)]}
    truth_rooms = [i for k, i in I.items() if k.startswith('T2-ROOM-')]
    shaft = I['T2-STAIR-TOPOLOGY']['value']['shaft']
    shaft_poly = [(shaft['x'][0], shaft['z'][0]), (shaft['x'][1], shaft['z'][0]), (shaft['x'][1], shaft['z'][1]), (shaft['x'][0], shaft['z'][1])]
    out = {'built': True, 'registration': reg, 'storeys': []}
    walls = model.get('walls', [])
    for storey in (0, 1):
        lid = [k for k, v in levels.items() if v == storey]
        rooms = [r for r in model.get('rooms', []) if r.get('levelId') in lid and len(r.get('polygon', [])) >= 3]
        mr = [{'id': r['id'], 'name': r.get('name') or r.get('usage'), 'poly': [T(p) for p in r['polygon']], 'holes': [[T(p) for p in h] for h in r.get('holes', []) or []]} for r in rooms]
        for r in mr:
            r['cells'] = cells(r['poly'], r['holes'])
            r['area'] = len(r['cells']) * GRID * GRID
        tr = [{'id': i['id'], 'label': i['value']['label'], 'poly': [tuple(p) for p in i['value']['polygon']], 'area': i['value']['polygonAreaM2'], 'published': i['value'].get('publishedAreaM2')} for i in truth_rooms if i['value']['storey'] == storey]
        for t in tr:
            t['cells'] = cells(t['poly'])
        pairs = sorted(((iou(m['cells'], t['cells']), mi, ti) for mi, m in enumerate(mr) for ti, t in enumerate(tr)), reverse=True)
        used_m, used_t, matched = set(), set(), []
        for v, mi, ti in pairs:
            if v < IOU_MATCH or mi in used_m or ti in used_t:
                continue
            used_m.add(mi)
            used_t.add(ti)
            m, t = mr[mi], tr[ti]
            matched.append({'truth': t['id'], 'label': t['label'], 'model': m['id'], 'iou': round(v, 3), 'shapeError': round(1 - v, 3), 'areaModelM2': round(m['area'], 2), 'areaTruthM2': t['area'], 'areaErrorM2': round(m['area'] - t['area'], 2), 'publishedM2': t['published']})
        merged = []
        for mi, m in enumerate(mr):
            over = [t['id'] for t in tr if len(m['cells'] & t['cells']) >= 0.3 * max(1, len(t['cells']))]
            if len(over) >= 2:
                merged.append({'model': m['id'], 'over': over})
        truth_union = set().union(*[t['cells'] for t in tr]) if tr else set()
        model_union = set().union(*[m['cells'] for m in mr]) if mr else set()
        inner = [w for w in walls if w.get('kind') == 'INTERIOR' and w.get('levelId') in lid]
        inner_ids = {w['id'] for w in inner}
        doors = [o for o in model.get('openings', []) if o.get('wallId') in inner_ids and o.get('kind') == 'DOOR']
        # the passage graph: two rooms joined where a door's centre, stepped 0.3 m to each side of its wall, falls in each
        edges = set()
        for d in doors:
            w = next(x for x in inner if x['id'] == d['wallId'])
            ax, az = T(w['start'])
            bx, bz = T(w['end'])
            L = math.hypot(bx - ax, bz - az) or 1
            t = d['offset'] + d['width'] / 2
            cx, cz = ax + (bx - ax) * t / L, az + (bz - az) * t / L
            nx, nz = -(bz - az) / L, (bx - ax) / L
            side = []
            for s in (0.3, -0.3):
                px, pz = cx + nx * s, cz + nz * s
                hit = [m['id'] for m in mr if inside(m['poly'], px, pz)]
                side.append(hit[0] if hit else None)
            if side[0] and side[1] and side[0] != side[1]:
                edges.add(tuple(sorted(side)))
        parent = {m['id']: m['id'] for m in mr}

        def find(a):
            while parent[a] != a:
                a = parent[a]
            return a
        for a, b in edges:
            parent[find(a)] = find(b)
        comps = len({find(m['id']) for m in mr}) if mr else 0
        slabs = [s for s in model.get('slabs', []) if s.get('levelId') in lid]
        holes = [[T(p) for p in h] for s in slabs for h in (s.get('holes') or [])]
        hole_iou = max((iou(cells(h), cells(shaft_poly)) for h in holes), default=None) if storey == 1 else None
        out['storeys'].append({
            'storey': storey,
            'modelRooms': len(mr), 'truthRooms': len(tr),
            'matched': matched,
            'missing': [t['id'] + ' ' + t['label'] for ti, t in enumerate(tr) if ti not in used_t],
            'extra': [m['id'] for mi, m in enumerate(mr) if mi not in used_m],
            'merged': merged,
            'meanShapeError': round(sum(x['shapeError'] for x in matched) / len(matched), 3) if matched else None,
            'meanAbsAreaErrorM2': round(sum(abs(x['areaErrorM2']) for x in matched) / len(matched), 2) if matched else None,
            'floorCoverage': round(len(model_union & truth_union) / len(truth_union), 3) if truth_union else None,
            'floorOutsideSource': round(len(model_union - truth_union) * GRID * GRID, 2),
            'partitions': len(inner), 'doors': len(doors), 'passages': len(edges), 'components': comps,
            'slabOpenings': len(holes), 'stairShaftIoU': None if hole_iou is None else round(hole_iou, 3),
        })
    return out


def storeys(inv):
    plans = [p for p in inv.get('pictures', []) if p.get('document') in ('PLAN', 'FLOOR_PLAN') or str(p.get('document', '')).endswith('PLAN')]
    by = {}
    for p in plans:
        k = str(p.get('storey'))
        e = by.setdefault(k, {'available': 0, 'sentTo': set(), 'readInto': set(), 'states': []})
        e['available'] += 1
        for s in p.get('sent', []):
            e['sentTo'].add(s['step'])
        for r in p.get('readInto', []) or []:
            e['readInto'].add(r)
        e['states'].append(p.get('state'))
    return {k: {'available': v['available'], 'sentTo': sorted(v['sentTo']), 'readInto': sorted(v['readInto']), 'states': v['states']} for k, v in sorted(by.items())}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    feats_path, truth_path, out_path = args[0], args[1], args[2]
    extra = dict(a.split('=', 1) for a in args[3:] if '=' in a)
    inv = None
    if '--inventory' in sys.argv:
        inv = json.load(open(sys.argv[sys.argv.index('--inventory') + 1]))
    I = detail.items(truth_path)
    feats = json.load(open(feats_path))
    res = {'schema': SCORER, 'tolerances': {'TOL_Y': TOL_Y, 'TOL_ANGLE_DEG': TOL_ANGLE, 'IOU_MATCH': IOU_MATCH, 'GRID_M': GRID}, 'models': {}}
    if inv:
        res['storeys'] = storeys(inv)
    for label, f in feats.items():
        s27 = detail.score(f, I)
        rec = {'rows27': {'met': s27.get('met'), 'of': s27.get('of'), 'unassessable': s27.get('unassessable'), 'rows': s27.get('rows')}, 'glazing': glazing(f, I)}
        if label in extra:
            model = json.load(open(extra[label].split(',')[0]))
            rec['interior'] = interior(model, I)
            if ',' in extra[label]:
                h = json.load(open(extra[label].split(',')[1]))
                gi = (h.get('geometry') or {}).get('interior') or {}
                rec['interiorPlacement'] = {'status': gi.get('status'), 'note': gi.get('note'), 'transform': gi.get('transform'), 'dropped': [d for l in gi.get('levels', []) for d in l.get('dropped', [])]}
        res['models'][label] = rec
    json.dump(res, open(out_path, 'w'), indent=1, ensure_ascii=False)
    lines = []
    for label, r in res['models'].items():
        g = r['glazing']
        gs = '; '.join(f"{x['id'][8:]}: " + (f"hi {x['model']['yAtHighEnd']}/{x['truth']['highY']} lo {x['model']['yAtLowEnd']}/{x['truth']['lowY']} ∠{x['model']['angleDeg']}°/{x['truth']['angleDeg']}° {'OK' if all(x['ok'].values()) else 'NO'}" if x.get('built') else 'not built') for x in g)
        lines.append(f"{label}: 27-rows {r['rows27']['met']}/{r['rows27']['of']} | glazing {gs}")
        for s in (r.get('interior') or {}).get('storeys', []):
            lines.append(f"   storey {s['storey']}: rooms {s['modelRooms']}/{s['truthRooms']} matched {len(s['matched'])} missing {len(s['missing'])} extra {len(s['extra'])} merged {len(s['merged'])} shape {s['meanShapeError']} area±{s['meanAbsAreaErrorM2']} m² cover {s['floorCoverage']} partitions {s['partitions']} doors {s['doors']} passages {s['passages']} comps {s['components']} shaft {s['stairShaftIoU']}")
    open(out_path.replace('.json', '.txt'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
