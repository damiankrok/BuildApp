"""N7-COUNCIL-FIX-02 (research only): compare two canonical models geometry by geometry, not by hash.

    python3 -I research/analyzer-n7-fix02/model_diff.py <before/model.json> <after/model.json>

Prints counts (rings, exterior/interior walls, slabs, openings, windows, doors, roofs, roof planes, rooms, stairs),
exterior wall thickness per ring, the walls that appear/disappear, and the inner clear dimensions of every ring.
"""
import json, sys
from collections import Counter


def load(p):
    return json.load(open(p))


def summary(m):
    walls = m.get('walls', [])
    ext = [w for w in walls if w.get('kind') == 'EXTERIOR']
    inn = [w for w in walls if w.get('kind') == 'INTERIOR']
    rings = m.get('wallRings', [])
    return {
        'wallRings': len(rings), 'exteriorWalls': len(ext), 'interiorWalls': len(inn), 'slabs': len(m.get('slabs', [])),
        'openings': len(m.get('openings', [])), 'windows': len(m.get('windows', [])), 'doors': len(m.get('doors', [])),
        'roofs': len(m.get('roofs', [])), 'roofPlanes': len(m.get('roofPlanes', [])), 'rooms': len(m.get('rooms', [])),
        'stairs': len(m.get('stairs', [])), 'rooflights': len(m.get('rooflights', [])), 'chimneys': len(m.get('chimneys', [])),
        'exteriorThickness': dict(Counter(round(w['thickness'], 3) for w in ext)),
        'roomArea': round(sum(r.get('area', 0) or 0 for r in m.get('rooms', [])), 2),
    }


def rings(m):
    """Each ring's walls: outer extent and thickness (the clear inner span is outer - 2t)."""
    walls = {w['id']: w for w in m.get('walls', [])}
    out = {}
    for r in m.get('wallRings', []):
        ws = [walls[i] for i in r.get('wallIds', []) if i in walls]
        if not ws:
            continue
        xs = [p[k] for w in ws for p in (w['start'], w['end']) for k in ('x',)]
        zs = [p[k] for w in ws for p in (w['start'], w['end']) for k in ('z',)]
        t = ws[0]['thickness']
        out[r['id']] = {'outer': (round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3)), 't': round(t, 3), 'inner': (round(max(xs) - min(xs) - 2 * t, 3), round(max(zs) - min(zs) - 2 * t, 3))}
    return out


def main():
    a, b = load(sys.argv[1]), load(sys.argv[2])
    sa, sb = summary(a), summary(b)
    for k in sa:
        if sa[k] != sb[k]:
            print(f'  {k}: {sa[k]} -> {sb[k]}')
    ra, rb = rings(a), rings(b)
    for k in sorted(set(ra) | set(rb)):
        if ra.get(k) != rb.get(k):
            print(f'  ring {k}: {ra.get(k)} -> {rb.get(k)}')
    ida = {w['id'] for w in a.get('walls', [])}
    idb = {w['id'] for w in b.get('walls', [])}
    if ida - idb:
        print('  walls gone:', sorted(ida - idb))
    if idb - ida:
        print('  walls new:', sorted(idb - ida))
    for key in ('openings', 'roofs', 'slabs', 'rooms'):
        x = {o['id'] for o in a.get(key, [])}
        y = {o['id'] for o in b.get(key, [])}
        if x != y:
            print(f'  {key} gone {sorted(x - y)} new {sorted(y - x)}')
    print('  summary after:', json.dumps(sb))


if __name__ == '__main__':
    main()
