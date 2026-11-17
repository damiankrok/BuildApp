#!/usr/bin/env python3
"""v3.54.6 — Marcówki GE: three independent readings, each replayed twice, compared stage by stage.

    /usr/bin/python3 -I research/source-to-model/v3546/marcowki-compare.py <marcowki dir> <truth json> <out json>

<marcowki dir> holds M1..M3 (live), R1a..R3b (replays), LOCAL; every run dir is <run>/marcowki-ge. Reads only the
run artefacts; writes one JSON with: per stage the payload hash (prompt hash + the hashes of the pictures sent) and
the raw answer hash; the hashes of observations, geometry, model, scene and the decision; what each run built
(bodies, roofs, garage, openings per side); the first stage at which two runs differ; opening differences between
runs in millimetres; and each run against the sealed source truth (fidelity, separate from repeatability).
"""
import hashlib
import json
import os
import sys

SCHEMA = 'buildapp.v3546-marcowki-compare/1'
STEPS = ['INVENTORY', 'PLAN', 'FACADES', 'REVIEW-1']
MATCH_ALONG_M = 0.6      # two holes are one opening when their middles are this close along one side
TRUTH_OK_M = 0.3         # against the truth: middle and width within this, bottom and top within this


def sha(b):
    return hashlib.sha256(b).hexdigest()


def stable(x):
    return json.dumps(x, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def load(p):
    return json.load(open(p)) if os.path.exists(p) else None


def run_info(d):
    out = {'stages': {}, 'hashes': {}, 'built': {}}
    for step in STEPS:
        a = load(os.path.join(d, 'answers', f'{step}.json'))
        if a is None:
            continue
        pics = sorted(p['sha256'] for p in a.get('pictures', []))
        out['stages'][step] = {
            'payload': sha((a.get('promptSha256', '') + '|' + '|'.join(pics)).encode())[:16],
            'answer': sha(stable(a.get('answer')))[:16],
            'pictures': len(pics),
            'inputTokens': (a.get('usage') or {}).get('inputTokens'),
            'outputTokens': (a.get('usage') or {}).get('outputTokens'),
            'requestId': a.get('requestId'),
        }
    obs = load(os.path.join(d, 'observations.json'))
    house = load(os.path.join(d, 'house.json'))
    summ = load(os.path.join(d, 'summary.json')) or {}
    trace = load(os.path.join(d, 'trace.json')) or {}
    for name, f in [('model', 'model.json'), ('scene', 'scene.json')]:
        p = os.path.join(d, f)
        out['hashes'][name] = sha(open(p, 'rb').read())[:16] if os.path.exists(p) else None
    out['hashes']['observations'] = sha(stable(obs.get('observations'))).__str__()[:16] if obs else None
    out['hashes']['geometry'] = sha(stable(house.get('geometry')))[:16] if house and house.get('geometry') else None
    arb = trace.get('arbitration') or {}
    out['decision'] = {'accepted': summ.get('accepted'), 'code': summ.get('decisionCode'), 'partial': summ.get('partial')}
    out['hashes']['decision'] = sha(stable([arb.get('accepted'), arb.get('code'), [(f.get('fact'), f.get('localOk'), f.get('describedOk')) for f in arb.get('findings', [])]]))[:16]
    out['cost'] = {'requests': summ.get('requests'), 'usd': summ.get('spentUsd'), 'seconds': summ.get('seconds')}
    g = (house or {}).get('geometry') or {}
    bodies = []
    for b in g.get('bodies', []):
        xs = [p['x'] for p in b['outline']]
        zs = [p['z'] for p in b['outline']]
        r = b.get('roof') or {}
        rv = lambda k: (r.get(k) or {}).get('value') if isinstance(r.get(k), dict) else r.get(k)
        bodies.append({'id': b['id'], 'role': b['role'], 'storeys': b['storeys'], 'x': [round(min(xs), 3), round(max(xs), 3)], 'z': [round(min(zs), 3), round(max(zs), 3)], 'roof': r.get('kind'), 'ridgeAxis': r.get('ridgeAxis'), 'pitchDeg': rv('pitchDeg'), 'ridgeY': rv('ridgeY'), 'eavesY': rv('eavesY')})
    m = load(os.path.join(d, 'measured.json')) or load(os.path.join(d, 'measured-v3545.json')) or {}
    ext = m.get('exteriorWalls') or {}
    out['built'] = {
        'front': ((obs or {}).get('observations') or {}).get('front', {}).get('planEdge'),
        'bodies': bodies,
        'garage': any(b['role'] == 'GARAGE' for b in bodies),
        'extent': {k: ext.get(k) for k in ('x0', 'x1', 'z0', 'z1', 'widthM', 'depthM')},
        'roofTopY': m.get('roofTopY'),
        'openings': sorted(({'side': o['side'], 'kind': o['kind'], 'alongM': o['alongM'], 'widthM': o['widthM'], 'bottomY': o['bottomY'], 'topY': o['topY'], 'id': o['id']} for o in m.get('openings', []) if o.get('side')), key=lambda o: (o['side'], o['alongM'] or 0)),
    }
    return out


def pair_openings(a, b):
    """Holes of two runs matched side by side by their middles; what is in one only is named."""
    rows = []
    for side in ['FRONT', 'RIGHT', 'REAR', 'LEFT']:
        A = [o for o in a if o['side'] == side]
        B = [o for o in b if o['side'] == side]
        used = set()
        for o in A:
            c = o['alongM'] + o['widthM'] / 2
            best = None
            for j, q in enumerate(B):
                if j in used:
                    continue
                d = abs(q['alongM'] + q['widthM'] / 2 - c)
                if d <= MATCH_ALONG_M and (best is None or d < best[0]):
                    best = (d, j)
            if best is None:
                rows.append({'side': side, 'only': 'A', 'kind': o['kind'], 'alongM': o['alongM']})
                continue
            used.add(best[1])
            q = B[best[1]]
            rows.append({'side': side, 'kindA': o['kind'], 'kindB': q['kind'], 'dCentreMm': round(1000 * ((q['alongM'] + q['widthM'] / 2) - c)), 'dWidthMm': round(1000 * (q['widthM'] - o['widthM'])), 'dBottomMm': round(1000 * (q['bottomY'] - o['bottomY'])), 'dTopMm': round(1000 * (q['topY'] - o['topY']))})
        for j, q in enumerate(B):
            if j not in used:
                rows.append({'side': side, 'only': 'B', 'kind': q['kind'], 'alongM': q['alongM']})
    return rows


def against_truth(built, truth):
    ext = built['extent']
    if ext.get('x0') is None:
        return None
    x0, x1, z0, z1 = ext['x0'], ext['x1'], ext['z0'], ext['z1']
    side_of = {'FRONT': 'FRONT', 'REAR': 'REAR', 'WEST': 'LEFT', 'EAST': 'RIGHT'}
    along = {'FRONT': lambda a: a - x0, 'REAR': lambda a: x1 - a, 'RIGHT': lambda a: a - z0, 'LEFT': lambda a: z1 - a}
    holes = [dict(o, used=False) for o in built['openings']]
    rows = []
    for t in truth:
        v = t['value']
        side = side_of.get(v.get('facade'))
        if not side:
            continue
        i0, i1 = sorted(along[side](q) for q in v['interval'])
        c = (i0 + i1) / 2
        cand = [h for h in holes if h['side'] == side and not h['used'] and abs(h['alongM'] + h['widthM'] / 2 - c) <= MATCH_ALONG_M]
        cand.sort(key=lambda h: abs(h['alongM'] + h['widthM'] / 2 - c))
        if not cand:
            rows.append({'truth': t['id'], 'side': side, 'result': 'MISSING'})
            continue
        h = cand[0]
        h['used'] = True
        d = {'dCentre': h['alongM'] + h['widthM'] / 2 - c, 'dWidth': h['widthM'] - (i1 - i0), 'dBottom': h['bottomY'] - v['sillY'], 'dTop': h['topY'] - v['headY']}
        ok = all(abs(x) <= TRUTH_OK_M + t.get('uncertainty', {}).get('m', 0) for x in d.values())
        rows.append({'truth': t['id'], 'side': side, 'result': 'OK' if ok else 'OFF', **{k: round(x, 3) for k, x in d.items()}})
    false = [{'side': h['side'], 'kind': h['kind'], 'alongM': h['alongM']} for h in holes if not h['used']]
    return {'reference': len(rows), 'matched': sum(r['result'] != 'MISSING' for r in rows), 'ok': sum(r['result'] == 'OK' for r in rows), 'false': len(false), 'rows': rows, 'falseHoles': false}


def first_difference(a, b):
    for step in STEPS:
        sa, sb = a['stages'].get(step), b['stages'].get(step)
        if sa is None and sb is None:
            continue
        if (sa or {}).get('payload') != (sb or {}).get('payload'):
            return f'{step}: the request differs (payload)'
        if (sa or {}).get('answer') != (sb or {}).get('answer'):
            return f'{step}: same request, different answer'
    for k in ['observations', 'geometry', 'model', 'scene', 'decision']:
        if a['hashes'].get(k) != b['hashes'].get(k):
            return f'{k}: differs with every answer the same'
    return 'none: identical'


def main():
    root, truth_path, out_path = sys.argv[1:4]
    truth = [x for x in json.load(open(truth_path))['items'] if x['kind'] == 'OPENING']
    runs = {}
    for name in ['LOCAL', 'M1', 'M2', 'M3', 'R1a', 'R1b', 'R2a', 'R2b', 'R3a', 'R3b']:
        d = os.path.join(root, name, 'marcowki-ge')
        if os.path.isdir(d):
            runs[name] = run_info(d)
    out = {'schema': SCHEMA, 'runs': runs, 'replays': {}, 'between': {}, 'truth': {}}
    for n in ['1', '2', '3']:
        live = runs.get(f'M{n}')
        for k in ['a', 'b']:
            r = runs.get(f'R{n}{k}')
            if live and r:
                out['replays'][f'M{n}~R{n}{k}'] = {'answersSame': all(live['stages'][s]['answer'] == r['stages'].get(s, {}).get('answer') for s in live['stages']), 'hashesSame': {h: live['hashes'][h] == r['hashes'][h] for h in live['hashes']}, 'first': first_difference(live, r)}
    for a, b in [('M1', 'M2'), ('M1', 'M3'), ('M2', 'M3')]:
        if a in runs and b in runs:
            rows = pair_openings(runs[a]['built']['openings'], runs[b]['built']['openings'])
            out['between'][f'{a}~{b}'] = {'first': first_difference(runs[a], runs[b]), 'openingsPaired': sum('only' not in r for r in rows), f'only{a}': sum(r.get('only') == 'A' for r in rows), f'only{b}': sum(r.get('only') == 'B' for r in rows), 'kindChanged': sum('only' not in r and r['kindA'] != r['kindB'] for r in rows), 'maxCentreMm': max([abs(r['dCentreMm']) for r in rows if 'only' not in r] or [0]), 'rows': rows}
    for name, r in runs.items():
        out['truth'][name] = against_truth(r['built'], truth)
    json.dump(out, open(out_path, 'w'), indent=1, ensure_ascii=False)
    print('run    model            scene            decision                     openings  truth ok/matched/false  cost')
    for name, r in runs.items():
        t = out['truth'][name] or {}
        print(f"{name:6} {str(r['hashes']['model']):16} {str(r['hashes']['scene']):16} {str(r['decision']['accepted']) + ' ' + str(r['decision']['code']):28} {len(r['built']['openings']):8}  {t.get('ok')}/{t.get('matched')}/{t.get('false')} of {t.get('reference')}        {r['cost']}")
    for k, v in out['replays'].items():
        print('replay', k, 'answers same' if v['answersSame'] else 'ANSWERS DIFFER', '|', v['first'])
    for k, v in out['between'].items():
        print('between', k, '|', v['first'], '| paired', v['openingsPaired'], 'only', [v[x] for x in v if x.startswith('only')], 'kind changed', v['kindChanged'], 'max centre diff', v['maxCentreMm'], 'mm')


if __name__ == '__main__':
    main()
