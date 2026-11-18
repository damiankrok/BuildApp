#!/usr/bin/env python3
"""v3.54.10 — Marcówki GE: scorer version 3, BESIDE versions 1 (27 rows, v3.54.8) and 2 (v3.54.9), never in their place.

    /usr/bin/python3 -I research/source-to-model/v35410/metric-v3.py <features.json> <truth json> <out json> \
        [label=<model.json>[,<house.json>] …] [--inventory <inventory.json>]

Everything version 2 reports is reported unchanged (imported, not copied): the 27 rows, both ends and the angle of each
raked glazing, the interior per storey. Version 3 adds, with tolerances fixed here before any comparison:

1. `glazing3`: per raked glazing its built width against the source interval (the rough opening the callout prints:
   234/303 → 2.34 m), both jambs against the source's interval ends, and the head angle (as v2).
2. `terrace`: the rear living glazing (T2-OPEN-REAR-GLAZING, 470/230): both jambs, width, sill, head and the number of
   leaves — the plan draws two gaps with one mullion stub between (two leaves); a pane count derived from the width
   (round(width/0.9) = 5) is a convention, not the source, and is scored as wrong.
3. `zones` (needs the house document): the finish zones per side — material, tone, extent — and the palette's
   consistency: one material id per (material, tone), every zone surface region pointing at one of them. The sealed
   truth holds NO finish zones, so this block is descriptive (no pass/fail): it says what was assigned, not whether the
   source agrees.
4. `chimneys`: the chimneys of the model against T2-CHIMNEY-1/-2 (built or not; x interval when built).

TOL_X 0.15 m (a jamb), TOL_Y 0.15 m (as v2), TOL_ANGLE 2.5° (as v2), TOL_W 0.15 m (a width).
"""
import importlib.util
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('metric3549', os.path.join(HERE, 'metric-v2.py'))
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)
detail = v2.detail

SCORER = 'buildapp.v35410-marcowki-metric/3'
TOL_X = 0.15
TOL_Y = 0.15
TOL_W = 0.15


def glazing3(f, I):
    out = []
    W = f.get('walls')
    for g in v2.glazing(f, I):
        tv = I[g['id']]['value']
        rec = {'id': g['id'], 'callout': tv.get('printedCallout'), 'truthWidthM': tv['widthM'], 'built': g.get('built', False)}
        if g.get('built') and W:
            side = tv['facade']
            lo, hi = detail.span(side, tv['interval'][0], tv['interval'][1], W)
            a0, a1 = sorted([g['model']['alongFrom'], g['model']['alongTo']])
            w = a1 - a0
            rec.update({'model': {'alongFrom': round(a0, 3), 'alongTo': round(a1, 3), 'widthM': round(w, 3), 'angleDeg': g['model']['angleDeg']},
                        'error': {'width': round(abs(w - tv['widthM']), 3), 'jambA': round(abs(a0 - lo), 3), 'jambB': round(abs(a1 - hi), 3), 'highEnd': g['error']['highEnd'], 'lowEnd': g['error']['lowEnd'], 'angleDeg': g['error']['angleDeg']},
                        'ok': {'width': abs(w - tv['widthM']) <= TOL_W, 'jambs': abs(a0 - lo) <= TOL_X and abs(a1 - hi) <= TOL_X, **g['ok']}})
        out.append(rec)
    return out


def terrace(f, I, model):
    tv = I['T2-OPEN-REAR-GLAZING']['value']
    W = f.get('walls')
    rec = {'id': 'T2-OPEN-REAR-GLAZING', 'truth': {'interval': tv['interval'], 'widthM': tv['widthM'], 'sillY': tv['sillY'], 'headY': tv['headY'], 'leaves': 2}}
    if not W:
        return {**rec, 'built': False}
    lo, hi = detail.span('REAR', tv['interval'][0], tv['interval'][1], W)
    cands = [o for o in f.get('openings', []) if o.get('side') == 'REAR' and o.get('bottomY', 9) < 1.0 and o['alongM'] < hi and o['alongM'] + o['widthM'] > lo]
    if not cands:
        return {**rec, 'built': False, 'why': 'no opening built on the rear ground storey over the source interval'}
    o = max(cands, key=lambda q: min(hi, q['alongM'] + q['widthM']) - max(lo, q['alongM']))
    a0, a1 = o['alongM'], o['alongM'] + o['widthM']
    leaves = None
    if model:
        same = [q for q in model.get('openings', []) if abs(q['width'] - o['widthM']) < 0.01 and abs(q['sill'] - o['bottomY']) < 0.02 and abs(q['height'] - o['heightM']) < 0.02]
        ids = {q['id'] for q in same}
        for d in model.get('doors', []):
            if d['openingId'] in ids:
                leaves = len(d.get('assembly', {}).get('panels', [])) or 1
        for w in model.get('windows', []):
            if w['openingId'] in ids:
                leaves = w.get('divisions', 1)
    err = {'jambA': round(abs(a0 - lo), 3), 'jambB': round(abs(a1 - hi), 3), 'width': round(abs(o['widthM'] - tv['widthM']), 3), 'sill': round(abs(o['bottomY'] - tv['sillY']), 3), 'head': round(abs(o['topY'] - tv['headY']), 3)}
    return {**rec, 'built': True, 'model': {'alongFrom': round(a0, 3), 'alongTo': round(a1, 3), 'widthM': o['widthM'], 'sillY': o['bottomY'], 'headY': o['topY'], 'leaves': leaves, 'kind': o.get('kind')},
            'error': err, 'ok': {'jambs': err['jambA'] <= TOL_X and err['jambB'] <= TOL_X, 'width': err['width'] <= TOL_W, 'sill': err['sill'] <= TOL_Y, 'head': err['head'] <= TOL_Y, 'leaves': leaves == 2}}


def zones(house, model):
    zs = ((house or {}).get('geometry') or {}).get('zones') or []
    by = {}
    for z in zs:
        by.setdefault(z['side'], []).append({'id': z['id'], 'level': z['level'], 'material': z['material'], 'tone': z['tone'], 'alongM': [round(z['a0'], 2), round(z['a1'], 2)], 'heightM': [round(z['b0'], 2), round(z['b1'], 2)], 'basis': z['basis']})
    mats = {m['id']: m for m in (model or {}).get('materials', [])}
    regions = [r for r in (model or {}).get('surfaceRegions', []) if str(r.get('materialId', '')).startswith('mat-zone-')]
    pairs = {(z['material'], z['tone']) for z in zs}
    ids = {f"mat-zone-{m}-{t}".lower() for m, t in pairs}
    consistent = all(r['materialId'] in mats for r in regions) and all(i in mats for i in ids)
    colours = {i: mats[i].get('color') or mats[i].get('baseColor') for i in ids if i in mats}
    return {'descriptive': True, 'zones': len(zs), 'bySide': by, 'materials': sorted(ids), 'colours': colours, 'zoneRegions': len(regions), 'paletteConsistent': consistent}


def chimneys(model, I):
    out = []
    ch = (model or {}).get('chimneys', [])
    for tid in ('T2-CHIMNEY-1', 'T2-CHIMNEY-2'):
        out.append({'id': tid, 'truth': I[tid].get('value')})
    return {'truth': out, 'modelChimneys': [{'id': c['id'], **{k: c[k] for k in c if k in ('x', 'z', 'width', 'depth', 'top', 'topY', 'footprint')}} for c in ch]}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    feats_path, truth_path, out_path = args[0], args[1], args[2]
    extra = dict(a.split('=', 1) for a in args[3:] if '=' in a)
    I = detail.items(truth_path)
    feats = json.load(open(feats_path))
    res = {'schema': SCORER, 'tolerances': {'TOL_X': TOL_X, 'TOL_Y': TOL_Y, 'TOL_W': TOL_W, 'TOL_ANGLE_DEG': v2.TOL_ANGLE}, 'models': {}}
    lines = []
    for label, f in feats.items():
        model = house = None
        if label in extra:
            parts = extra[label].split(',')
            model = json.load(open(parts[0]))
            if len(parts) > 1:
                house = json.load(open(parts[1]))
        s27 = detail.score(f, I)
        rec = {'rows27': {'met': s27.get('met'), 'of': s27.get('of')}, 'glazing3': glazing3(f, I), 'terrace': terrace(f, I, model)}
        if model:
            rec['interior'] = v2.interior(model, I)
            rec['chimneys'] = chimneys(model, I)
        if house:
            rec['zones'] = zones(house, model)
        res['models'][label] = rec
        t = rec['terrace']
        ts = (f"{t['model']['alongFrom']}..{t['model']['alongTo']} ({t['model']['widthM']}×{round(t['model']['headY'] - t['model']['sillY'], 3)}) leaves {t['model']['leaves']} " + ('OK' if all(t['ok'].values()) else 'NO ' + ','.join(k for k, v in t['ok'].items() if not v))) if t.get('built') else 'not built'
        gs = '; '.join(f"{g['id'][8:]}: w {g['model']['widthM']}/{g['truthWidthM']} ∠{g['model']['angleDeg']}° " + ('OK' if all(g['ok'].values()) else 'NO ' + ','.join(k for k, v in g['ok'].items() if not v)) if g.get('built') else f"{g['id'][8:]}: not built" for g in rec['glazing3'])
        lines.append(f"{label}: 27-rows {rec['rows27']['met']}/{rec['rows27']['of']} | terrace {ts} | {gs}")
        if 'zones' in rec:
            z = rec['zones']
            lines.append(f"   zones {z['zones']} ({', '.join(f'{s}:{len(v)}' for s, v in sorted(z['bySide'].items()))}) materials {z['materials']} consistent {z['paletteConsistent']}")
        for s in (rec.get('interior') or {}).get('storeys', []):
            lines.append(f"   storey {s['storey']}: rooms {s['modelRooms']}/{s['truthRooms']} matched {len(s['matched'])} missing {len(s['missing'])} merged {len(s['merged'])} cover {s['floorCoverage']} partitions {s['partitions']} doors {s['doors']} comps {s['components']} shaft {s['stairShaftIoU']}")
        if 'chimneys' in rec:
            lines.append(f"   chimneys model {len(rec['chimneys']['modelChimneys'])} / source 2")
    json.dump(res, open(out_path, 'w'), indent=1, ensure_ascii=False)
    open(out_path.replace('.json', '.txt'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
