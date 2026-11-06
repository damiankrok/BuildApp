"""EXTERIOR-COMPLETE regression detector, v2 (E13) — beside the acceptance checker (`check.py`).

`check.py` scores 70 frozen expectations: a check that was FAIL stays FAIL when a model loses the one door it had, and
a net +1 can hide a lost entrance or a slab with no source. This compares a PRZED run with a PO run of the same house
element by element. MATCHING and CORRECTNESS are kept apart: an exterior opening is matched to its counterpart by side,
storey and position (within MATCH_M along its wall); everything that then differs is reported — its kind, width,
height, sill, host wall — so "matched" never means "unchanged". Members, walls and roof planes are matched by id and
compared field by field; roof edges are counted by kind; a run missing on one side, or a model turned into a failure,
is reported as such. A run is SAME only when nothing below differs (beyond DIM_M of rounding).

It decides nothing: every line is a question for a person looking at the board and the source.

Usage: python3 -I regress.py <przed-run> <po-run> [...pairs]   |   --roots PRZED_ROOT PO_ROOT   [--json out.json]
"""
import json, os, sys

SIDE_TOL = 0.8   # how close to the bounding box a wall must be to be on a side
MATCH_M = 0.3    # how far along a side an opening may move and still be the same opening (matching only)
DIM_M = 0.03     # a dimension change smaller than this is rounding, not a change


def load(d):
    p = os.path.join(d, 'model.json')
    if os.path.exists(p):
        return json.load(open(p)), None
    f = os.path.join(d, 'failure.json')
    if os.path.exists(f):
        x = json.load(open(f))
        return None, f"{x.get('code')}/{(x.get('diagnostics') or {}).get('firstFailure')}"
    return None, 'NO_RUN_OUTPUT'


def bbox(m):
    lv0 = m['levels'][0]['id']
    g = [w for w in m['walls'] if w['levelId'] == lv0 and w.get('kind') == 'EXTERIOR' and 'return' not in w['id']] or m['walls']
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
        a, b = w['start'], w['end']
        L = max(1e-9, ((b['x'] - a['x']) ** 2 + (b['z'] - a['z']) ** 2) ** 0.5)
        t = (o.get('offset', 0) + o.get('width', 0) / 2) / L
        cx, cz = a['x'] + (b['x'] - a['x']) * t, a['z'] + (b['z'] - a['z']) * t
        horiz = abs(b['z'] - a['z']) < abs(b['x'] - a['x'])
        out.append({'id': o['id'], 'side': side_of(w, bb), 'level': w['levelId'], 'at': round(cx if horiz else cz, 2), 'kind': o.get('kind'), 'w': o.get('width', 0), 'h': o.get('height', 0), 'sill': o.get('sill', 0), 'wall': o['wallId']})
    return out


def describe(o):
    return f"{o['kind']} {o['side']} {o['level']} at {o['at']} w{o['w']:.2f} h{o['h']:.2f} sill{o['sill']:.2f}"


MEMBERS = ['balconies', 'railings', 'terraces', 'pergolas', 'canopies', 'chimneys', 'rooflights', 'roofs', 'roofPlanes', 'slabs', 'platforms', 'linearSolids']
# E13: a roof plane is its boundary, datum and downslope; a roof its pitch, eaves offset and overhang — without them a
# ridge moved by 0.4 m reads as SAME
GEOM_KEYS = ('footprint', 'polygon', 'path', 'start', 'end', 'vertices', 'outline', 'height', 'thickness', 'pitch', 'pitchDeg', 'ridgeHeight', 'baseOffset', 'topOffset', 'eaveOffset', 'overhang', 'boundary', 'datum', 'downslope', 'ridgeAxis', 'width', 'length', 'depth')


def geometry(x):
    return json.dumps({k: x[k] for k in GEOM_KEYS if k in x}, sort_keys=True)


def close(a, b):
    """Two geometry texts equal up to DIM_M on every number."""
    import re
    na, nb = re.findall(r'-?\d+\.?\d*(?:e-?\d+)?', a), re.findall(r'-?\d+\.?\d*(?:e-?\d+)?', b)
    if re.sub(r'-?\d+\.?\d*(?:e-?\d+)?', '#', a) != re.sub(r'-?\d+\.?\d*(?:e-?\d+)?', '#', b) or len(na) != len(nb):
        return False
    return all(abs(float(p) - float(q)) <= DIM_M for p, q in zip(na, nb))


def errors(d):
    p = os.path.join(d, 'compile-diagnostics.json')
    if not os.path.exists(p):
        return None
    diags = json.load(open(p))
    diags = diags if isinstance(diags, list) else diags.get('diagnostics', [])
    out = {}
    for x in diags:
        if x.get('severity') == 'ERROR':
            out[x.get('code')] = out.get(x.get('code'), 0) + 1
    return out


def compare(a_dir, b_dir):
    a, fa = load(a_dir)
    b, fb = load(b_dir)
    lines = []
    if a is None or b is None:
        if a is None and b is None:
            if fa != fb:
                lines.append(f'FAILURE CHANGED {fa} -> {fb}')
        else:
            lines.append(f'MODEL {"LOST" if b is None else "GAINED"} ({fa or "model"} -> {fb or "model"})')
        return lines
    oa, ob = openings(a), openings(b)
    used = set()
    for o in oa:
        cands = [(abs(p['at'] - o['at']), i) for i, p in enumerate(ob) if i not in used and p['side'] == o['side'] and p['level'] == o['level'] and abs(p['at'] - o['at']) <= MATCH_M]
        if not cands:
            lines.append(f'LOST opening {describe(o)}')
            continue
        _, i = min(cands)
        used.add(i)
        p = ob[i]
        diffs = []
        if p['kind'] != o['kind']:
            diffs.append(f"kind {o['kind']} -> {p['kind']}")
        for k, name in (('w', 'width'), ('h', 'height'), ('sill', 'sill')):
            if abs(p[k] - o[k]) > DIM_M:
                diffs.append(f'{name} {o[k]:.2f} -> {p[k]:.2f}')
        if abs(p['at'] - o['at']) > DIM_M:
            diffs.append(f"moved {o['at']} -> {p['at']}")
        if p['wall'] != o['wall']:
            diffs.append(f"host {o['wall']} -> {p['wall']}")
        if diffs:
            lines.append(f"CHANGED opening {o['side']} {o['level']} at {o['at']}: " + '; '.join(diffs))
    for i, p in enumerate(ob):
        if i not in used:
            lines.append(f'ADDED opening {describe(p)}')
    for k in MEMBERS:
        ia = {x['id']: x for x in a.get(k, [])}
        ib = {x['id']: x for x in b.get(k, [])}
        for x in sorted(set(ib) - set(ia)):
            lines.append(f'ADDED {k} {x} (needs a source)')
        for x in sorted(set(ia) - set(ib)):
            lines.append(f'LOST {k} {x}')
        for x in sorted(set(ia) & set(ib)):
            if not close(geometry(ia[x]), geometry(ib[x])):
                lines.append(f'CHANGED {k} {x} geometry')
    wa = {w['id']: w for w in a['walls'] if w.get('kind') == 'EXTERIOR'}
    wb = {w['id']: w for w in b['walls'] if w.get('kind') == 'EXTERIOR'}
    for x in sorted(set(wb) - set(wa)):
        lines.append(f'ADDED exterior wall {x}')
    for x in sorted(set(wa) - set(wb)):
        lines.append(f'LOST exterior wall {x}')
    for x in sorted(set(wa) & set(wb)):
        if not close(geometry(wa[x]), geometry(wb[x])):
            lines.append(f'CHANGED exterior wall {x} geometry')
    ka, kb = {}, {}
    for e in a.get('roofEdges', []):
        ka[e.get('kind')] = ka.get(e.get('kind'), 0) + 1
    for e in b.get('roofEdges', []):
        kb[e.get('kind')] = kb.get(e.get('kind'), 0) + 1
    if ka != kb:
        lines.append(f'ROOF EDGES {dict(sorted(ka.items()))} -> {dict(sorted(kb.items()))}')
    ea, eb = errors(a_dir), errors(b_dir)
    if eb is not None and ea is not None and ea != eb:
        lines.append(f'COMPILE ERRORS {ea} -> {eb}')
    elif eb and ea is None:
        lines.append(f'COMPILE ERRORS (PO only) {eb}')
    ba, bb_ = bbox(a), bbox(b)
    if max(abs(p - q) for p, q in zip(ba, bb_)) > 0.05:
        lines.append(f'BODY bbox {tuple(round(v, 2) for v in ba)} -> {tuple(round(v, 2) for v in bb_)}')
    return lines


if __name__ == '__main__':
    args = [x for x in sys.argv[1:]]
    out_json = None
    if '--json' in args:
        i = args.index('--json')
        out_json = args[i + 1]
        del args[i:i + 2]
    pairs = []
    if args and args[0] == '--roots':
        ra, rb = args[1], args[2]
        names = sorted(set(h for h in os.listdir(ra) if os.path.isdir(os.path.join(ra, h))) | set(h for h in os.listdir(rb) if os.path.isdir(os.path.join(rb, h))))
        pairs = [(os.path.join(ra, h), os.path.join(rb, h)) for h in names]
    else:
        pairs = list(zip(args[0::2], args[1::2]))
    total = 0
    record = {}
    for a, b in pairs:
        name = os.path.basename(b.rstrip('/'))
        if not os.path.isdir(a) or not os.path.isdir(b):
            lines = [f'RUN {"MISSING IN PO" if not os.path.isdir(b) else "MISSING IN PRZED"}']
        else:
            lines = compare(a, b)
        record[name] = lines
        print(f'{name}: {"SAME" if not lines else ""}')
        for l in lines:
            print('   ' + l)
        total += len(lines)
    print(f'CHANGES {total}')
    if out_json:
        json.dump(record, open(out_json, 'w'), indent=1)
