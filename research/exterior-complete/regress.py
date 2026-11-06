"""EXTERIOR-COMPLETE E12: a regression detector beside the acceptance checker (`check.py`).

`check.py` scores 70 frozen expectations; a check that was FAIL stays FAIL when the model loses the one door it had, and a
net +1 can hide a lost entrance or a slab that has no source. This compares a PRZED run with a PO run of the same house
element by element and names every change in what a facade carries:

  - doors and openings per side and kind, with their positions along the side (a door that moved more than 0.3 m, or
    vanished, is a loss; one that appeared is an addition to be checked against the source);
  - members that need a source of their own: balconies, railings, terraces, returns, pergolas, canopies, chimneys;
  - the production compiler's ERRORs (compile-diagnostics.json, when the run wrote one);
  - the body: wall rings' bounding box and the ground footprint area.

It decides nothing. Every line is a question for a person looking at the board: was the old element right, is the new
one in the source? Usage: python3 -I regress.py <przed-run-dir> <po-run-dir> [...pairs]   (or --roots PRZED_ROOT PO_ROOT)
"""
import json, os, sys

SIDE_TOL = 0.8


def load(d):
    p = os.path.join(d, 'model.json')
    if not os.path.exists(p):
        f = os.path.join(d, 'failure.json')
        return None, (json.load(open(f)).get('code') if os.path.exists(f) else 'no model')
    return json.load(open(p)), None


def bbox(m):
    lv0 = m['levels'][0]['id']
    g = [w for w in m['walls'] if w['levelId'] == lv0 and w.get('kind') == 'EXTERIOR'] or m['walls']
    xs = [p['x'] for w in g for p in (w['start'], w['end'])]
    zs = [p['z'] for w in g for p in (w['start'], w['end'])]
    return min(xs), min(zs), max(xs), max(zs)


def side_of(w, bb):
    (x0, z0, x1, z1) = bb
    a, b = w['start'], w['end']
    if abs(b['z'] - a['z']) < abs(b['x'] - a['x']):
        z = (a['z'] + b['z']) / 2
        return 'front' if z - z0 < SIDE_TOL else 'rear' if z1 - z < SIDE_TOL else 'inner'
    x = (a['x'] + b['x']) / 2
    return 'west' if x - x0 < SIDE_TOL else 'east' if x1 - x < SIDE_TOL else 'inner'


def openings(m):
    bb = bbox(m)
    walls = {w['id']: w for w in m['walls']}
    out = []
    for o in m['openings']:
        w = walls.get(o['wallId'])
        if not w or w.get('kind') != 'EXTERIOR':
            continue
        side = side_of(w, bb)
        a, b = w['start'], w['end']
        L = max(1e-9, ((b['x'] - a['x']) ** 2 + (b['z'] - a['z']) ** 2) ** 0.5)
        t = (o.get('offset', 0) + o.get('width', 0) / 2) / L
        cx, cz = a['x'] + (b['x'] - a['x']) * t, a['z'] + (b['z'] - a['z']) * t
        along = cx if side in ('front', 'rear', 'inner') and abs(b['z'] - a['z']) < abs(b['x'] - a['x']) else cz
        out.append({'side': side, 'kind': o.get('kind'), 'w': round(o.get('width', 0), 2), 'at': round(along, 2), 'level': w['levelId'], 'id': o['id']})
    return out


MEMBERS = ['balconies', 'railings', 'terraces', 'pergolas', 'canopies', 'chimneys', 'rooflights']
SINGULAR = {'balconies': 'balcony', 'railings': 'railing', 'terraces': 'terrace', 'pergolas': 'pergola', 'canopies': 'canopy', 'chimneys': 'chimney', 'rooflights': 'rooflight', 'returns': 'return'}


def members(m):
    r = {k: sorted(x['id'] for x in m.get(k, [])) for k in MEMBERS}
    r['returns'] = sorted(w['id'] for w in m['walls'] if 'return' in w['id'])
    return r


def errors(d):
    p = os.path.join(d, 'compile-diagnostics.json')
    if not os.path.exists(p):
        return None
    diags = json.load(open(p))
    diags = diags if isinstance(diags, list) else diags.get('diagnostics', [])
    return sorted(f"{x.get('code')}:{x.get('elementId') or x.get('subjectId') or ''}" for x in diags if x.get('severity') == 'ERROR')


def compare(a_dir, b_dir):
    a, fa = load(a_dir)
    b, fb = load(b_dir)
    name = os.path.basename(b_dir.rstrip('/'))
    lines = []
    if a is None or b is None:
        if (a is None) != (b is None):
            lines.append(f'MODEL {"lost" if b is None else "gained"} ({fa or "model"} -> {fb or "model"})')
        return name, lines
    oa, ob = openings(a), openings(b)
    used = set()
    for o in oa:
        match = next((i for i, p in enumerate(ob) if i not in used and p['side'] == o['side'] and p['kind'] == o['kind'] and p['level'] == o['level'] and abs(p['at'] - o['at']) <= 0.3), None)
        if match is None:
            moved = next((i for i, p in enumerate(ob) if i not in used and p['side'] == o['side'] and p['kind'] == o['kind'] and p['level'] == o['level']), None)
            lines.append(f"LOST {o['kind']} {o['side']} {o['level']} w{o['w']} at {o['at']}" + (f" (nearest same kind at {ob[moved]['at']})" if moved is not None else ''))
        else:
            used.add(match)
    for i, p in enumerate(ob):
        if i not in used:
            lines.append(f"ADDED {p['kind']} {p['side']} {p['level']} w{p['w']} at {p['at']}")
    ma, mb = members(a), members(b)
    for k in ma:
        for x in sorted(set(mb[k]) - set(ma[k])):
            lines.append(f'ADDED {SINGULAR[k]} {x} (needs a source)')
        for x in sorted(set(ma[k]) - set(mb[k])):
            lines.append(f'LOST {SINGULAR[k]} {x}')
    ea, eb = errors(a_dir), errors(b_dir)
    if eb is not None:
        if ea is None:
            lines.append(f'COMPILE ERRORS (PO) {len(eb)}: {", ".join(eb[:6])}{" ..." if len(eb) > 6 else ""}')
        elif ea != eb:
            lines.append(f'COMPILE ERRORS {len(ea)} -> {len(eb)}: +{sorted(set(eb) - set(ea))[:4]} -{sorted(set(ea) - set(eb))[:4]}')
    ba, bb_ = bbox(a), bbox(b)
    if max(abs(p - q) for p, q in zip(ba, bb_)) > 0.05:
        lines.append(f'BODY bbox {tuple(round(v, 2) for v in ba)} -> {tuple(round(v, 2) for v in bb_)}')
    return name, lines


if __name__ == '__main__':
    args = sys.argv[1:]
    pairs = []
    if args and args[0] == '--roots':
        ra, rb = args[1], args[2]
        for h in sorted(os.listdir(rb)):
            if os.path.isdir(os.path.join(rb, h)) and os.path.isdir(os.path.join(ra, h)):
                pairs.append((os.path.join(ra, h), os.path.join(rb, h)))
    else:
        pairs = list(zip(args[0::2], args[1::2]))
    total = 0
    for a, b in pairs:
        name, lines = compare(a, b)
        print(f'{name}: {"SAME" if not lines else ""}')
        for l in lines:
            print('   ' + l)
        total += len(lines)
    print(f'CHANGES {total}')
