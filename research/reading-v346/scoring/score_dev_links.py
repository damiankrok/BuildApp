# v3.46 scorer for the small DEV link set (annotations/dev-links.json, frozen before scoring).
#   SECTION_DIMENSION_ENDS - the reader's LINEAR_DIMENSION on the section whose text box holds the sign: its value, and
#                            its two end rows (measured geometry) against the annotated ends, each within
#                            max(toleranceRowsPx, the item's uncertaintyPx). Results: ENDS_OK, VALUE_OK_ENDS_OFF,
#                            WRONG_VALUE, NOT_READ, NO_RUN.
#   RELATION               - each relation's check, run on the canonical model: OK, WRONG, NO_MODEL.
# usage: score_dev_links.py <dev-links.json> <views.json>[,more] <runs-root> [out.json]
import collections, glob, json, os, sys

ALIAS = {'przed-1316': 'bakopy', 'przed-1318': 'zefiranty'}


def section_shas(view_files):
    out = collections.defaultdict(set)
    for f in view_files:
        for r in json.load(open(f))['rows']:
            if r['view']['class'] == 'TECHNICAL_SECTION':
                out[r['project']].add(r['sha256'])
    return out


def runs_of(root):
    out = {}
    for p in glob.glob(os.path.join(root, '**', 'metric-evidence.json'), recursive=True):
        d = os.path.dirname(p)
        out[ALIAS.get(os.path.basename(d), os.path.basename(d))] = d
    return out


def ends(item, ev, tol):
    x, y = item['at']
    here = [e for e in ev if e['kind'] == 'LINEAR_DIMENSION' and e.get('textBox') and e['textBox']['x0'] - 6 <= x <= e['textBox']['x1'] + 6 and e['textBox']['y0'] - 6 <= y <= e['textBox']['y1'] + 6]
    if not here:
        return {'result': 'NOT_READ'}
    e = here[0]
    v = e['value'] * 100 if e.get('unit') == 'm' else e['value']
    g = e.get('measuredGeometry') or {}
    rows = sorted([g['a']['y'], g['b']['y']]) if g.get('type') == 'SEGMENT' else None
    out = {'value': v, 'rows': rows, 'provenance': (e.get('provenance') or {}).get('name')}
    if abs(v - item['value']) > 0.5:
        out['result'] = 'WRONG_VALUE'
    elif rows and abs(rows[0] - item['top']) <= tol and abs(rows[1] - item['bottom']) <= tol:
        out['result'] = 'ENDS_OK'
    else:
        out['result'] = 'VALUE_OK_ENDS_OFF'
    if rows:
        out['offPx'] = [round(rows[0] - item['top'], 1), round(rows[1] - item['bottom'], 1)]
    return out


def relation(item, d):
    mp = os.path.join(d, 'model.json')
    if not os.path.exists(mp):
        return {'result': 'NO_MODEL'}
    m = json.load(open(mp))
    rid = item['id']
    if rid == 'wing-roof-form':
        planes = [p for p in m.get('roofPlanes', []) if p['id'].startswith('roof-attached-0')]
        flat = [r for r in m.get('roofs', []) if r['id'] == 'roof-attached-0' and r.get('kind') == 'FLAT']
        along_x = planes and all(abs(p['downslope']['x']) < 1e-6 and abs(abs(p['downslope']['z']) - 1) < 1e-6 for p in planes)
        return {'result': 'OK' if planes and not flat and along_x else 'WRONG', 'planes': len(planes), 'flat': bool(flat)}
    if rid == 'attic-floor':
        upper_rooms = [r for r in m['rooms'] if r.get('levelId') != m['levels'][0]['id']]
        uppers = [l['elevation'] for l in m['levels'][1:]]
        ok = not upper_rooms and all(abs(e - 3.34) <= 0.05 for e in uppers)
        return {'result': 'OK' if ok else 'WRONG', 'upperLevels': uppers, 'upperRooms': len(upper_rooms)}
    if rid in ('east-window-heights', 'rear-window-heights'):
        side = 'east' if rid.startswith('east') else 'rear'
        hs = [o['height'] for o in m['openings'] if f'-0-{side}-' in o['id'] and o.get('kind') == 'WINDOW' and o.get('sill', 0) > 0.1]
        spread = max(hs) - min(hs) if hs else None
        return {'result': 'OK' if hs and spread <= 0.15 else 'WRONG', 'heights': [round(h, 2) for h in hs]}
    return {'result': 'UNSCORED'}


def main(argv):
    ann = json.load(open(argv[1]))
    shas = section_shas(argv[2].split(','))
    runs = runs_of(argv[3])
    tol0 = ann['categories']['SECTION_DIMENSION_ENDS']['toleranceRowsPx']
    rows, T = [], collections.Counter()
    for it in ann['items']:
        d = runs.get(it['project'])
        if it['cat'] == 'SECTION_DIMENSION_ENDS':
            if not d:
                r = {'result': 'NO_RUN'}
            else:
                ev = [e for e in json.load(open(os.path.join(d, 'metric-evidence.json')))['evidence'] if e.get('variantByteHash') in shas[it['project']]]
                r = ends(it, ev, max(tol0, it.get('uncertaintyPx', 0)))
        else:
            r = relation(it, d) if d else {'result': 'NO_RUN'}
        T[(it['cat'], r['result'])] += 1
        T[(it['cat'], 'n')] += 1
        rows.append({**{k: it[k] for k in ('cat', 'project') if k in it}, 'ref': it.get('value', it.get('id')), **r})
    for k, v in sorted(T.items()):
        print(f'{k[0]:24s} {k[1]:18s} {v}')
    if len(argv) > 4:
        json.dump({'totals': {f'{a}|{b}': v for (a, b), v in T.items()}, 'rows': rows}, open(argv[4], 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv)
