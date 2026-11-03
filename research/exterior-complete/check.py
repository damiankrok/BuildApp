# EXTERIOR-COMPLETE acceptance checker: model.json + result-summary.json against expectations.json (private script)
import json, math, os, sys
EXP = json.load(open('/home/user/BuildApp/stage-reports/artifacts/exterior-complete/expectations.json'))['houses']
def key_of(dirname):
    for k in EXP:
        if k in dirname: return k
def side_of(x0, z0, x1, z1, bb, tol=0.8):
    X0, Z0, X1, Z1 = bb
    if abs(z1 - z0) < abs(x1 - x0):
        z = (z0 + z1) / 2
        return 'front' if z - Z0 < tol else 'rear' if Z1 - z < tol else 'inner'
    x = (x0 + x1) / 2
    return 'side' if x - X0 < tol or X1 - x < tol else 'inner'
def box_side(fp, bb):
    X0, Z0, X1, Z1 = bb
    cx = (fp['minX'] + fp['maxX']) / 2; cz = (fp['minZ'] + fp['maxZ']) / 2
    if fp['maxZ'] <= Z0 + 0.6 or cz < Z0 + 1.0: return 'front'
    if fp['minZ'] >= Z1 - 0.6 or cz > Z1 - 1.0: return 'rear'
    if cx < X0 + 1.0 or cx > X1 - 1.0 or fp['maxX'] <= X0 + 0.6 or fp['minX'] >= X1 - 0.6: return 'side'
    return 'inner'
def check(run):
    k = key_of(run); exp = EXP.get(k, {})
    out = {'house': k, 'checks': {}, 'defects': {}}
    if not os.path.exists(f'{run}/model.json'):
        f = json.load(open(f'{run}/failure.json')); out['model'] = False; out['failure'] = f.get('code') + '/' + str((f.get('diagnostics') or {}).get('firstFailure'))
        for c in exp: out['checks'][c] = 'FAIL(no model)'
        return out
    m = json.load(open(f'{run}/model.json')); s = json.load(open(f'{run}/result-summary.json'))
    out['model'] = True
    lv = {l['id']: l for l in m['levels']}
    g = [w for w in m['walls'] if w['levelId'] == m['levels'][0]['id'] and w.get('kind') == 'EXTERIOR']
    xs = [p['x'] for w in g for p in (w['start'], w['end'])]; zs = [p['z'] for w in g for p in (w['start'], w['end'])]
    if not xs:
        xs = [p['x'] for w in m['walls'] for p in (w['start'], w['end'])]; zs = [p['z'] for w in m['walls'] for p in (w['start'], w['end'])]
    bb = (min(xs), min(zs), max(xs), max(zs))
    walls = {w['id']: w for w in m['walls']}
    ops = {o['id']: o for o in m['openings']}
    def oside(o):
        w = walls.get(o['wallId']);
        return side_of(w['start']['x'], w['start']['z'], w['end']['x'], w['end']['z'], bb) if w else '?'
    doors = []
    for d in m['doors']:
        o = ops.get(d.get('openingId'))
        if not o: continue
        panels = (d.get('assembly') or {}).get('panels') or []
        gate = d.get('usage') == 'GARAGE'
        doors.append({'side': oside(o), 'w': o['width'], 'gate': gate, 'panelOnly': bool(panels) and all(p['kind'] == 'PANEL' for p in panels), 'usage': d.get('usage')})
    wins = [{'side': oside(ops[w['openingId']]), 'w': ops[w['openingId']]['width']} for w in m['windows'] if w.get('openingId') in ops]
    # main roof orientation
    ridge = None; kind = None
    mains = [r for r in m['roofs'] if r['kind'] != 'FLAT' and r['id'] == 'roof-main'] or [r for r in m['roofs'] if r['kind'] != 'FLAT']
    if mains:
        ridge = 'PARALLEL' if mains[0].get('ridgeAxis') == 'X' else 'ACROSS'; kind = mains[0]['kind']
    elif m['roofPlanes']:
        big = [p for p in m['roofPlanes'] if p['id'].startswith('roof-main')] or m['roofPlanes']
        ends = [p for p in big if 'end' in p['id']]
        side = [p for p in big if 'end' not in p['id']]
        d = (side or big)[0]['downslope']
        ridge = 'PARALLEL' if abs(d['z']) > abs(d['x']) else 'ACROSS'; kind = 'HIP' if ends else 'GABLE'
    asm = [a.get('kind') for a in m.get('assemblies', [])]
    # EC-E3 checker correction: a pergola's posts are posts (role PERGOLA_POST), and posts/canopies are judged on their
    # side, like balconies (the first version counted any POST/COLUMN anywhere and no pergola at all)
    posts = [l for l in m['linearSolids'] if l.get('role') in ('POST', 'COLUMN', 'PERGOLA_POST')]
    def lside(l):
        b = l.get('base') or l.get('start') or {'x': 0, 'z': 0}
        return box_side({'minX': b['x'], 'maxX': b['x'], 'minZ': b['z'], 'maxZ': b['z']}, bb)
    pergolas = {}
    for l in m['linearSolids']:
        if l.get('role') == 'PERGOLA_POST': pergolas.setdefault(l['id'].split('-post-')[0], []).append(lside(l))
    rings = sorted(set(w['id'].split('-w')[0] for w in m['walls'] if w['id'].startswith('ring-') and w['levelId'] == m['levels'][0]['id']))
    has = {}
    has['ridge'] = ridge; has['roofKind'] = kind
    has['gate'] = [d['side'] for d in doors if d['gate'] or (d['w'] >= 2.2 and d['panelOnly'])]
    has['gateAsDoor'] = [d['side'] for d in doors if d['w'] >= 2.2 and not d['gate']]
    has['entrance'] = [d['side'] for d in doors if 0.8 <= d['w'] <= 2.1 and not d['gate'] and d['side'] != 'inner']
    has['frontWindow'] = any(w['side'] == 'front' for w in wins)
    has['balcony'] = [box_side(b['footprint'], bb) for b in m['balconies']]
    has['railing'] = [side_of(r['start']['x'], r['start']['z'], r['end']['x'], r['end']['z'], (bb[0] - 3, bb[1] - 3, bb[2] + 3, bb[3] + 3), tol=4) for r in m['railings']]
    has['dormer'] = asm.count('DORMER') + sum(1 for r in m['roofs'] if 'dormer' in r['id'])
    has['canopy'] = [a for a in asm if a in ('CANOPY', 'PERGOLA', 'CARPORT', 'ENTRANCE')] + [max(set(v), key=v.count) for v in pergolas.values()]
    has['posts'] = [lside(l) for l in posts]
    has['wing'] = rings
    has['rooflights'] = len(m['rooflights']); has['chimneys'] = len(m['chimneys'])
    out['has'] = has
    for c, v in exp.items():
        if c == 'ridge': ok = ridge == v
        elif c == 'roofKind': ok = kind == v
        elif c in ('gate',): ok = v in has['gate']
        elif c == 'entrance': ok = v in has['entrance']
        elif c == 'frontWindow': ok = has['frontWindow']
        elif c in ('balcony', 'railing'): ok = v in has[c]
        elif c == 'dormer': ok = has['dormer'] > 0
        elif c == 'canopy': ok = any(x == v or x in ('CANOPY', 'PERGOLA', 'CARPORT', 'ENTRANCE') for x in has['canopy'])
        elif c == 'posts': ok = v in has['posts']
        elif c == 'wing': ok = len(rings) > 1
        elif c in ('rooflights', 'chimneys'): ok = has[c] >= v
        else: ok = False
        out['checks'][c] = 'PASS' if ok else 'FAIL'
    p = s.get('preview') or {}
    comp = p.get('completeness') or {}
    refused = []
    if os.path.exists(f'{run}/program.json'):
        prog = json.load(open(f'{run}/program.json')); cmds = prog['commands'] if isinstance(prog, dict) else prog
        ids = set(o['id'] for v in m.values() if isinstance(v, list) for o in v if isinstance(o, dict) and 'id' in o) | {m['building']['id'], m['id']}
        refused = [c['id'] for c in cmds if c.get('id') and c['type'].startswith(('create', 'cut', 'place')) and c['id'] not in ids]
    out['defects'] = {'outcome': p.get('outcome') or s.get('outcome'), 'refusals': comp.get('modelRefusals', len(refused)), 'refused': refused[:6], 'gateAsDoor': has['gateAsDoor']}
    return out
if __name__ == '__main__':
    tot = ok = 0; rows = []
    for run in sys.argv[1:]:
        r = check(run); rows.append(r)
        n = sum(1 for v in r['checks'].values() if v == 'PASS'); tot += len(r['checks']); ok += n
        fails = [c for c, v in r['checks'].items() if v != 'PASS']
        print(f"{(r['house'] or run)[:24]:24} {n}/{len(r['checks'])} model={r['model']} {r.get('failure','')} fails={fails} {r['defects'] if r['model'] else ''}")
    print('TOTAL', ok, '/', tot)
    if os.environ.get('OUT'): json.dump(rows, open(os.environ['OUT'], 'w'), indent=1)
