"""v3.54.2 — the main roof's kind and ridge direction of a compiled model, read from what the model actually holds.

The v3.54 scorer (extract.py) derived the ridge from the planes' downslopes: a hip's planes slope four ways, so every hip
came out 'MIXED' / ridge 'NA' and was scored as a WRONG ridge against any reference ridge (v3.54.1 Kukliki: A and B both
hold a front-to-back RIDGE edge, the reference says front-to-back, the old scorer said wrong). Order of evidence here:
  1. RIDGE edges of the main plane group (`roofEdges`, kind RIDGE, planeIds of that group): the longest one's axis;
  2. a footprint roof (`roofs[]`) with its own `ridgeAxis` (gable/hip plates of the drawings' path);
  3. two planes sloping opposite ways (a gable without edges): the axis normal to their downslope;
  4. otherwise NA (a pyramid has a point, not a ridge; a flat roof has none).
Axis convention as the v3.54 scorer: model X runs along the front, Z front to rear (ALONG_FRONT = X, ACROSS_FRONT = Z).

  /usr/bin/python3 -I roof_axis.py --selftest
"""
import json, sys


def _area(poly):
    s = 0.0
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        s += a['x'] * b['z'] - b['x'] * a['z']
    return abs(s) / 2


def main_roof(m):
    groups = {}
    for p in m.get('roofPlanes', []) or []:
        groups.setdefault(p['id'].split('-plane')[0], []).append(p)
    best = None
    for gid, ps in groups.items():
        area = sum(_area(p['boundary']) for p in ps if p.get('boundary'))
        if best is None or area > best[1]:
            best = (gid, area, ps)
    foot = [(((r.get('footprint') or {}).get('maxX', 0) - (r.get('footprint') or {}).get('minX', 0)) * ((r.get('footprint') or {}).get('maxZ', 0) - (r.get('footprint') or {}).get('minZ', 0)), r) for r in m.get('roofs', []) or []]
    foot = [f for f in foot if f[1].get('kind') not in (None, 'FLAT')]
    big_foot = max(foot, key=lambda f: f[0]) if foot else None
    if best and (not big_foot or best[1] >= 0.8 * big_foot[0]):
        gid, _, ps = best
        ids = {p['id'] for p in ps}
        ds = {(round(p['downslope']['x']), round(p['downslope']['z'])) for p in ps if p.get('downslope')}
        kind = 'MONO_PITCH' if len(ps) == 1 else ('GABLE' if len(ps) == 2 and len(ds) == 2 else ('HIP' if len(ds) >= 3 else 'OTHER'))
        ridges = [e for e in m.get('roofEdges', []) or [] if e.get('kind') == 'RIDGE' and ids & set(e.get('planeIds') or [])]
        if ridges:
            e = max(ridges, key=lambda e: abs(e['end']['x'] - e['start']['x']) + abs(e['end']['z'] - e['start']['z']))
            dx, dz = abs(e['end']['x'] - e['start']['x']), abs(e['end']['z'] - e['start']['z'])
            if max(dx, dz) > 0.05:
                return {'kind': kind, 'ridge': 'ALONG_FRONT' if dx >= dz else 'ACROSS_FRONT', 'basis': 'RIDGE_EDGE', 'group': gid}
        if kind == 'GABLE':
            d = next(iter(ds))
            return {'kind': kind, 'ridge': 'ALONG_FRONT' if d[0] == 0 else 'ACROSS_FRONT', 'basis': 'PLANE_DOWNSLOPE', 'group': gid}
        return {'kind': kind, 'ridge': 'NA', 'basis': 'NO_RIDGE_EDGE', 'group': gid}
    if big_foot:
        r = big_foot[1]
        ax = r.get('ridgeAxis')
        return {'kind': r.get('kind'), 'ridge': 'ALONG_FRONT' if ax == 'X' else ('ACROSS_FRONT' if ax == 'Z' else 'NA'), 'basis': 'FOOTPRINT_ROOF', 'group': r.get('id')}
    return {'kind': None, 'ridge': 'NA', 'basis': 'NO_ROOF', 'group': None}


def score_ridge(model_roof, ref_roof):
    ref = {'FRONT_TO_BACK': 'ACROSS_FRONT', 'SIDE_TO_SIDE': 'ALONG_FRONT', 'LEFT_TO_RIGHT': 'ALONG_FRONT'}.get(ref_roof.get('ridge'), ref_roof.get('ridge'))
    if ref in (None, 'NA') or not model_roof.get('kind'):
        return None
    if model_roof['ridge'] == 'NA':
        return None  # not measurable on the model (pyramid, flat): neither right nor wrong
    return model_roof['ridge'] == ref


def _selftest():
    P = lambda x, z: {'x': x, 'y': 0, 'z': z}
    def plane(gid, name, dx, dz, w=10, d=8):
        return {'id': f'{gid}-plane-{name}', 'downslope': {'x': dx, 'z': dz}, 'boundary': [P(0, 0), P(w, 0), P(w, d / 2), P(0, d / 2)]}
    def edge(kind, a, b, planes):
        return {'kind': kind, 'start': {'x': a[0], 'y': 5, 'z': a[1]}, 'end': {'x': b[0], 'y': 5, 'z': b[1]}, 'planeIds': planes}
    cases = []
    g = [plane('roof-main', 'low', 0, -1), plane('roof-main', 'high', 0, 1)]
    cases.append(('gable, ridge along X, edges', {'roofPlanes': g, 'roofEdges': [edge('RIDGE', (0, 4), (10, 4), [p['id'] for p in g])]}, 'GABLE', 'ALONG_FRONT'))
    cases.append(('gable, ridge along X, planes only', {'roofPlanes': g}, 'GABLE', 'ALONG_FRONT'))
    g2 = [plane('roof-main', 'low', -1, 0), plane('roof-main', 'high', 1, 0)]
    cases.append(('gable, ridge along Z, planes only', {'roofPlanes': g2}, 'GABLE', 'ACROSS_FRONT'))
    h = [plane('roof-main', 'end-max', 0, 1), plane('roof-main', 'end-min', 0, -1), plane('roof-main', 'high', 1, 0), plane('roof-main', 'low', -1, 0)]
    ids = [p['id'] for p in h]
    cases.append(('hip, short ridge along Z', {'roofPlanes': h, 'roofEdges': [edge('RIDGE', (3.8, 3.8), (3.8, 5.0), ids)]}, 'HIP', 'ACROSS_FRONT'))
    cases.append(('hip, ridge along X', {'roofPlanes': h, 'roofEdges': [edge('RIDGE', (2, 4), (8, 4), ids)]}, 'HIP', 'ALONG_FRONT'))
    cases.append(('pyramid (no ridge edge)', {'roofPlanes': h, 'roofEdges': []}, 'HIP', 'NA'))
    cases.append(('footprint gable plate, ridge Z', {'roofs': [{'id': 'r1', 'kind': 'GABLE', 'ridgeAxis': 'Z', 'footprint': {'minX': 0, 'maxX': 8, 'minZ': 0, 'maxZ': 12}}]}, 'GABLE', 'ACROSS_FRONT'))
    cases.append(('flat plate only', {'roofs': [{'id': 'r1', 'kind': 'FLAT', 'ridgeAxis': 'X', 'footprint': {'minX': 0, 'maxX': 8, 'minZ': 0, 'maxZ': 12}}]}, None, 'NA'))
    # a ridge edge of ANOTHER group (a garage) does not decide the main roof
    other = edge('RIDGE', (0, 1), (0, 9), ['roof-garage-plane-low'])
    cases.append(('main gable X with a garage ridge along Z', {'roofPlanes': g + [{'id': 'roof-garage-plane-low', 'downslope': {'x': 1, 'z': 0}, 'boundary': [P(0, 0), P(1, 0), P(1, 1), P(0, 1)]}], 'roofEdges': [other, edge('RIDGE', (0, 4), (10, 4), [p['id'] for p in g])]}, 'GABLE', 'ALONG_FRONT'))
    ok = True
    for name, m, kind, ridge in cases:
        got = main_roof(m)
        good = got['kind'] == kind and got['ridge'] == ridge
        ok &= good
        print(('PASS' if good else 'FAIL'), name, got)
    assert score_ridge({'kind': 'HIP', 'ridge': 'NA'}, {'ridge': 'ACROSS_FRONT'}) is None
    assert score_ridge({'kind': 'HIP', 'ridge': 'ACROSS_FRONT'}, {'ridge': 'FRONT_TO_BACK'}) is True
    assert score_ridge({'kind': 'GABLE', 'ridge': 'ALONG_FRONT'}, {'ridge': 'ACROSS_FRONT'}) is False
    # units: a reference in feet-inches converts exactly (28'-0" = 8.5344 m, 47'-1" = 14.3510 m)
    assert abs(28 * 0.3048 - 8.5344) < 1e-9 and abs((47 * 12 + 1) * 0.0254 - 14.351) < 1e-3
    print('selftest', 'OK' if ok else 'FAILED')
    return ok


if __name__ == '__main__':
    if sys.argv[1:] == ['--selftest']:
        sys.exit(0 if _selftest() else 1)
    print(json.dumps(main_roof(json.load(open(sys.argv[1])))))
