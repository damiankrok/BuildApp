#!/usr/bin/env python3
"""v3.54.5 — the detailed scorer: a compiled scene against a per-side, per-opening source reference.

  /usr/bin/python3 -I score-detail.py --list <list> --refs <dir> --runs name=<dir> [--runs name=<dir> …] --out <json>

For every house of the list and every named run root it reads `<root>/<house>/measured-v3545.json` (what the COMPILED
scene measures: `measureScene` of this revision — walls' extents, roof top, every hole of an exterior wall with the side
it faces) and, when present, `<root>/<house>/house.json` (the register of views). The reference is
`<refs>/<house>.json` (REFERENCE_FORMAT.md). Nothing here reads an API answer, and nothing is fitted: the scene is not
turned, mirrored or scaled to the reference, and an opening is only ever compared with a reference opening of the SAME
side and the SAME storey.

What it measures (each with its own denominator):
  extents      width and depth of the walls against the printed overall dimensions
  height       top of the roof above ±0,00 against the section's ridge mark
  sides        per published side: openings matched / reference openings (a blind side: no opening built there)
  openings     matched, missing, false; per matched opening the error of the centre along the side, of the centre
               height, of the width, of the height and of the bottom edge; OK when all are within tolerance
Tolerances come from what the source can tell (the reference's own pixel uncertainty at the picture's scale) with a
floor, and are fixed in TOL below — frozen in the protocol before a confirmation is scored.
"""
import json, os, sys, statistics

SCORER = 'v3545-detail/1'
TOL = {
    'extentM': 0.35, 'extentShare': 0.04,      # walls' width/depth against a printed overall dimension
    'ridgeM': 0.45,                             # roof top against the section's ridge mark
    'posFloorM': 0.30,                          # centre along the side, centre height, bottom edge: at least this
    'sizeFloorM': 0.25, 'sizeShare': 0.15,      # width, height: at least this, or this share of the reference size
    'uncertaintyFactor': 2.0,                   # … or this many times the reference's own uncertainty in metres
    'gateM': 0.80, 'gateShare': 0.60,           # how far two centres may be apart along the side to be one opening at all
    'levelSlackM': 0.60,                        # a hole belongs to the highest storey whose floor is at most this above its bottom
    'sideHalf': 0.5,                            # a side counts as built when at least this share of its openings is matched
}
SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT']
DOORS = {'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR'}

def arg(name, many=False):
    vals = [sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == f'--{name}' and i + 1 < len(sys.argv)]
    return vals if many else (vals[0] if vals else None)

def ref_openings(ref):
    """The reference's wall openings in metres, per side; None for a side whose scale is not known."""
    floors = [0.0] + sorted(ref.get('levels', {}).get('upperFloorLevelsM') or [])
    out = {}
    for side in SIDES:
        s = (ref.get('sides') or {}).get(side) or {}
        if s.get('status') != 'PUBLISHED':
            out[side] = {'status': s.get('status') or 'NOT_PUBLISHED', 'openings': [], 'metric': False, 'blind': False}
            continue
        metric = s.get('sideLengthBasis') in ('PRINTED_ON_PLAN', 'DERIVED_FROM_PLAN') and s.get('wallRightPx') and s.get('sideLengthM')
        ppm = (s['wallRightPx'] - s['wallLeftPx']) / s['sideLengthM'] if metric else None
        ops = []
        for o in s.get('openings') or []:
            if o.get('kind') == 'ROOF_WINDOW':
                continue  # lies in a slope, not in a wall: counted by the historical scorer, not measured here
            b = o['boxPx']
            x0, x1 = sorted([b['x0'], b['x1']]); y0, y1 = sorted([b['y0'], b['y1']])
            r = {'id': o['id'], 'kind': o.get('kind'), 'level': int(o.get('level') or 0), 'occluded': bool(o.get('occluded')), 'inDormer': bool(o.get('inDormer'))}
            if metric:
                along = (x0 - s['wallLeftPx']) / ppm
                width = (x1 - x0) / ppm
                if s.get('mirroredAgainstPlan'):
                    along = s['sideLengthM'] - along - width
                r.update({'alongM': along, 'widthM': width, 'heightM': (y1 - y0) / ppm, 'bottomY': (s['zeroRowPx'] - y1) / ppm, 'uM': (o.get('uncertainPx') or 4) / ppm})
            ops.append(r)
        out[side] = {'status': 'PUBLISHED', 'openings': ops, 'metric': bool(metric), 'blind': bool(s.get('blind')), 'floors': floors}
    return out

def scene_level(bottom, floors):
    lv = 0
    for i, f in enumerate(floors):
        if f <= bottom + TOL['levelSlackM']:
            lv = i
    return lv

def score_house(ref, measured, house_doc):
    res = {'scorer': SCORER, 'model': measured is not None}
    R = ref_openings(ref)
    published = [s for s in SIDES if R[s]['status'] == 'PUBLISHED']
    res['sidesPublished'] = len(published)
    if measured is None or not measured.get('exteriorWalls'):
        n = sum(len(R[s]['openings']) for s in published)
        res.update({'extents': None, 'height': None, 'openings': {'reference': n, 'matched': 0, 'ok': 0, 'missing': n, 'false': 0, 'built': 0}, 'sidesBuilt': 0, 'sides': {}, 'errors': {}})
        return res
    W = measured['exteriorWalls']
    ov = ref.get('overall') or {}
    def near(a, b):
        return abs(a - b) <= max(TOL['extentM'], TOL['extentShare'] * b)
    if ov.get('basis') in ('PRINTED_ON_PLAN', 'PAGE_TEXT') and ov.get('widthM') and ov.get('depthM'):
        res['extents'] = {'ok': near(W['widthM'], ov['widthM']) and near(W['depthM'], ov['depthM']), 'widthM': W['widthM'], 'depthM': W['depthM'], 'refWidthM': ov['widthM'], 'refDepthM': ov['depthM']}
    else:
        res['extents'] = {'ok': None, 'widthM': W['widthM'], 'depthM': W['depthM'], 'note': 'NOT_ASSESSABLE: the source prints no overall dimension'}
    ridge = (ref.get('levels') or {}).get('ridgeAboveZeroM')
    top = measured.get('roofTopY')
    res['height'] = {'ok': (top is not None and abs(top - ridge) <= TOL['ridgeM']) if ridge else None, 'roofTopM': top, 'refRidgeM': ridge, **({} if ridge else {'note': 'NOT_ASSESSABLE: no ridge height in the source'})}
    used = set()
    sides = {}
    rows = []
    tot = {'reference': 0, 'matched': 0, 'ok': 0, 'missing': 0, 'false': 0, 'built': 0, 'presenceOnly': 0}
    for side in published:
        info = R[side]
        floors = info['floors']
        scene = []
        for o in measured.get('openings') or []:
            if o.get('side') == side:
                scene.append({**o, 'slanted': False})
            elif o.get('side') is None:
                # a hole in a splayed wall faces two sides at once: its projection on this side, never its width
                b = (measured.get('objects') or {}).get(o['id'])
                if not b: continue
                if side in ('FRONT', 'REAR'):
                    along = b['x0'] - W['x0'] if side == 'FRONT' else W['x1'] - b['x1']; width = b['x1'] - b['x0']
                else:
                    along = W['z1'] - b['z1'] if side == 'LEFT' else b['z0'] - W['z0']; width = b['z1'] - b['z0']
                scene.append({**o, 'alongM': along, 'widthM': width, 'slanted': True})
        scene = [o for o in scene if o['id'] not in used]
        refs = info['openings']
        pairs = []
        if info['metric']:
            for r in refs:
                rc = r['alongM'] + r['widthM'] / 2
                for o in scene:
                    if scene_level(o['bottomY'], floors) != r['level']:
                        continue
                    d = abs(o['alongM'] + o['widthM'] / 2 - rc)
                    if d <= max(TOL['gateM'], TOL['gateShare'] * r['widthM']):
                        pairs.append((d + 0.5 * abs((o['bottomY'] + o['heightM'] / 2) - (r['bottomY'] + r['heightM'] / 2)), r['id'], o['id']))
        else:
            # no scale for this side: order along the side only, storey by storey
            for lv in sorted({r['level'] for r in refs}):
                rr = [r for r in refs if r['level'] == lv]
                oo = sorted([o for o in scene if scene_level(o['bottomY'], floors) == lv], key=lambda o: o['alongM'])
                for i, r in enumerate(rr[:len(oo)]):
                    pairs.append((i, r['id'], oo[i]['id']))
        pairs.sort()
        mr, mo = {}, {}
        for _, rid, oid in pairs:
            if rid in mr or oid in mo: continue
            mr[rid] = oid; mo[oid] = rid
        ok = 0
        for r in refs:
            o = next((x for x in scene if x['id'] == mr.get(r['id'])), None)
            row = {'side': side, 'ref': r['id'], 'level': r['level'], 'kind': r['kind'], 'scene': o['id'] if o else None}
            if o is None:
                row['result'] = 'MISSING'
            elif not info['metric'] or r['occluded'] or o['slanted']:
                row['result'] = 'PRESENT'
                row['why'] = 'no scale for this side' if not info['metric'] else 'occluded on the source' if r['occluded'] else 'in a splayed wall: seen foreshortened'
                tot['presenceOnly'] += 1
                if info['metric']:
                    row['dAlong'] = round(o['alongM'] + o['widthM'] / 2 - (r['alongM'] + r['widthM'] / 2), 3)
            else:
                u = TOL['uncertaintyFactor'] * r['uM']
                e = {'dAlong': o['alongM'] + o['widthM'] / 2 - (r['alongM'] + r['widthM'] / 2), 'dCentreY': (o['bottomY'] + o['heightM'] / 2) - (r['bottomY'] + r['heightM'] / 2), 'dWidth': o['widthM'] - r['widthM'], 'dHeight': o['heightM'] - r['heightM'], 'dBottom': o['bottomY'] - r['bottomY']}
                tp = max(TOL['posFloorM'], u)
                tw = max(TOL['sizeFloorM'], TOL['sizeShare'] * r['widthM'], u)
                th = max(TOL['sizeFloorM'], TOL['sizeShare'] * r['heightM'], u)
                bad = [k for k, t in (('dAlong', tp), ('dCentreY', tp), ('dWidth', tw), ('dHeight', th), ('dBottom', tp)) if abs(e[k]) > t]
                kind_ok = (o.get('kind') == 'UNKNOWN') or ((r['kind'] in DOORS) == (o.get('kind') == 'DOOR'))
                row.update({k: round(v, 3) for k, v in e.items()})
                row.update({'refWidthM': round(r['widthM'], 2), 'refHeightM': round(r['heightM'], 2), 'kindAgrees': kind_ok, 'result': 'OK' if not bad else 'OFF', **({'off': bad} if bad else {})})
                if not bad: ok += 1
            rows.append(row)
        false = [o for o in scene if o['id'] not in mo and not o['slanted']]
        for o in scene:
            if o['id'] in mo: used.add(o['id'])
        for o in false:
            rows.append({'side': side, 'ref': None, 'scene': o['id'], 'result': 'FALSE', 'alongM': round(o['alongM'], 2), 'widthM': o['widthM'], 'bottomY': o['bottomY']})
        n = len(refs)
        built = (len(mr) >= TOL['sideHalf'] * n and n > 0) or (n == 0 and info['blind'] and len(false) == 0)
        sides[side] = {'reference': n, 'matched': len(mr), 'ok': ok, 'false': len(false), 'blind': info['blind'], 'metric': info['metric'], 'built': bool(built)}
        tot['reference'] += n; tot['matched'] += len(mr); tot['ok'] += ok; tot['missing'] += n - len(mr); tot['false'] += len(false)
    tot['built'] = len([o for o in (measured.get('openings') or [])])
    res['openings'] = tot
    res['sides'] = sides
    res['sidesBuilt'] = sum(1 for s in sides.values() if s['built'])
    def dist(key):
        v = sorted(abs(r[key]) for r in rows if r.get('result') in ('OK', 'OFF') and key in r)
        if not v: return None
        return {'n': len(v), 'median': round(statistics.median(v), 3), 'p90': round(v[min(len(v) - 1, int(0.9 * len(v)))], 3), 'max': round(v[-1], 3)}
    res['errors'] = {k: dist(k) for k in ('dAlong', 'dCentreY', 'dWidth', 'dHeight', 'dBottom')}
    res['rows'] = rows
    if house_doc:
        v = (house_doc.get('verification') or {})
        res['register'] = {x['side']: {'state': x['state'], 'registered': x.get('registered'), 'build': x.get('build')} for x in v.get('views') or []}
        acc = [s for s in published if (res['register'].get(s) or {}).get('state') in ('READ_COMPLETE', 'PARTIAL', 'UNREADABLE')]
        res['sidesAccounted'] = len(acc)
        res['fits'] = {}
        for o in v.get('openings') or []:
            res['fits'][o['fit']] = res['fits'].get(o['fit'], 0) + 1
    return res

def main():
    refs_dir = arg('refs'); runs = dict(x.split('=', 1) for x in arg('runs', True))
    out = {'scorer': SCORER, 'tolerances': TOL, 'houses': {}}
    for line in open(arg('list')):
        if not line.strip(): continue
        house = line.split()[0]
        rp = os.path.join(refs_dir, house + '.json')
        if not os.path.exists(rp): continue
        ref = json.load(open(rp))
        out['houses'][house] = {}
        for name, root in runs.items():
            mp = os.path.join(root, house, 'measured-v3545.json')
            hp = os.path.join(root, house, 'house.json')
            measured = json.load(open(mp)) if os.path.exists(mp) else None
            doc = json.load(open(hp)) if os.path.exists(hp) else None
            out['houses'][house][name] = score_house(ref, measured, doc)
    json.dump(out, open(arg('out'), 'w'), indent=1)
    names = list(runs)
    print('house'.ljust(30), ' | '.join(n.ljust(40) for n in names))
    for house, r in out['houses'].items():
        cells = []
        for n in names:
            x = r[n]
            if not x['model']:
                cells.append('no model'.ljust(40)); continue
            o = x['openings']; e = x['extents']; h = x['height']
            f = lambda v: 'ok' if v is True else 'NO' if v is False else 'n/a'
            cells.append(f"ext {f(e['ok'])} h {f(h['ok'])} sides {x['sidesBuilt']}/{x['sidesPublished']} open ok {o['ok']} match {o['matched']}/{o['reference']} false {o['false']}".ljust(40))
        print(house[:30].ljust(30), ' | '.join(cells))

if __name__ == '__main__':
    main()
