#!/usr/bin/env python3
"""v3.54.11 — material at the visible surface, against `zone-refs-marcowki.json` (written before any scoring).

    /usr/bin/python3 -I research/source-to-model/v35411/zone-refs.py <refs.json> <out.json> label=<scene.json> …

For each reference point a ray is cast through the compiled scene from the viewer's side (FRONT: from z = −50 towards
+z; REAR: from z = +80 towards −z) at (x, y); the first surface hit is the one seen. A finish region lies on its wall's
face: within 2 cm of the nearest hit, a SURFACE_REGION wins. The hit's material is classed by its colour (luminance,
warmth) — the same rule for every model, so LOCAL's own materials and H's style profile are comparable — or GLASS.
Reports per point: the object id, its part, its material and colour, the class, and whether it is the wanted one.
"""
import json
import sys


def classify(mat):
    if mat is None:
        return 'NONE'
    if 'glass' in mat['id'].lower():
        return 'GLASS'
    c = mat.get('color') or mat.get('baseColor') or '#cccccc'
    r, g, b = (int(c[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if r - b > 0.15 and lum < 0.75:
        return 'WOOD'
    return 'DARK' if lum < 0.4 else 'LIGHT'


def hit(tri, ox, oy, oz, dz):
    # ray (ox, oy, oz) + t·(0, 0, dz); Möller–Trumbore specialised to a z-ray
    (ax, ay, az), (bx, by, bz), (cx, cy, cz) = tri
    e1 = (bx - ax, by - ay, bz - az)
    e2 = (cx - ax, cy - ay, cz - az)
    d = (0.0, 0.0, dz)
    p = (d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0])
    det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]
    if abs(det) < 1e-12:
        return None
    inv = 1 / det
    s = (ox - ax, oy - ay, oz - az)
    u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv
    if u < -1e-9 or u > 1 + 1e-9:
        return None
    q = (s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0])
    v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv
    if v < -1e-9 or u + v > 1 + 1e-9:
        return None
    t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv
    return t if t > 0 else None


def main():
    refs = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    res = {'schema': 'buildapp.v35411-zone-refs/1', 'refs': sys.argv[1], 'models': {}}
    lines = []
    for spec in sys.argv[3:]:
        label, path = spec.split('=', 1)
        b = json.load(open(path))
        mats = {m['id']: m for m in (b.get('materials') or b['scene'].get('materials', []))}
        meshes = b['scene']['meshes']
        rows = []
        for p in refs['points']:
            oz, dz = (-50.0, 1.0) if p['side'] == 'FRONT' else (80.0, -1.0)
            hits = []
            for m in meshes:
                v = m['positions']
                idx = m.get('indices')
                tris = range(0, len(idx), 3) if idx else range(0, len(v) // 3, 3)
                for i in tris:
                    if idx:
                        a, bb, c = idx[i], idx[i + 1], idx[i + 2]
                    else:
                        a, bb, c = i, i + 1, i + 2
                    tri = [(v[3 * k], v[3 * k + 1], v[3 * k + 2]) for k in (a, bb, c)]
                    t = hit(tri, p['x'], p['y'], oz, dz)
                    if t is not None:
                        hits.append((t, m))
            if not hits:
                rows.append({**p, 'got': 'NONE', 'ok': False})
                continue
            hits.sort(key=lambda h: h[0])
            near = [h for h in hits if h[0] - hits[0][0] <= 0.02]
            pick = next((h for h in near if h[1].get('part') == 'SURFACE_REGION'), near[0])[1]
            mat = mats.get(pick.get('materialId'))
            cls = classify(mat)
            rows.append({'id': p['id'], 'side': p['side'], 'element': p['element'], 'want': p['want'], 'got': cls, 'ok': cls == p['want'], 'objectId': pick['objectId'], 'part': pick.get('part'), 'materialId': pick.get('materialId'), 'color': (mat or {}).get('color')})
        res['models'][label] = {'met': sum(r['ok'] for r in rows), 'of': len(rows), 'rows': rows}
        lines.append(f"{label}: {sum(r['ok'] for r in rows)}/{len(rows)}")
        for r in rows:
            lines.append(f"   {'OK' if r['ok'] else 'NO'}  {r['id']:18} want {r['want']:5} got {r['got']:5} {r.get('objectId', '-')} ({r.get('part', '-')}, {r.get('materialId', '-')})")
    json.dump(res, open(out, 'w'), indent=1, ensure_ascii=False)
    open(out.replace('.json', '.txt'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
