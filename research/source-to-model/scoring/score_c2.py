# v3.51 C2 scorer (measures frozen in FROZEN-C2.json): the final feature graph against the final model.
# usage: score_c2.py <runs-root> [out.json]
import collections, json, os, sys
DOORS = {'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR'}
def main(argv):
    root = argv[1]; T = collections.Counter(); rows = []
    for h in sorted(os.listdir(root)):
        d = os.path.join(root, h)
        if not os.path.isdir(d): continue
        if not os.path.exists(os.path.join(d, 'feature-graph.json')):
            T['NO_MODEL'] += 1; continue
        m = json.load(open(os.path.join(d, 'model.json'))); g = json.load(open(os.path.join(d, 'feature-graph.json')))
        lv = {l['id']: l['elevation'] for l in m['levels']}
        walls = {w['id']: w for w in m['walls']}
        mo = {o['id']: o for o in m['openings']}
        for s in g['solved']:
            if s['family'] != 'OPENING': continue
            oid = s['id'][5:] if s['id'].startswith('feat-') else s['id']
            p = {k: v['value'] for k, v in s['parameters'].items()}
            app = s.get('application')
            o = mo.get(oid)
            built = None
            if o:
                el = lv.get(walls.get(o['wallId'], {}).get('levelId'), 0)
                built = {'width': o['width'], 'sillY': el + o['sill'], 'headY': el + o['sill'] + o['height'], 'kind': o['kind']}
            same = built is not None and all(abs(built[k] - p[k]) <= 1e-4 for k in ('width', 'sillY', 'headY'))
            if app is None:
                v = 'MISSING_STATE' if same else 'STALE'
                if built is None and s.get('provenance') == 'UNRESOLVED': v = 'MISSING_STATE'
            elif app['state'] == 'AS_ACCEPTED':
                v = 'CONSISTENT' if same else 'STALE'
            elif app['state'] == 'FITTED':
                a = app.get('applied') or {}
                v = 'EXPLICIT_DIFFERENCE' if built is not None and all(abs(built[k] - a.get(k, 1e9)) <= 1e-4 for k in ('width', 'sillY', 'headY')) else 'STALE'
            else:
                v = 'EXPLICIT_DIFFERENCE' if built is None else 'STALE'
            T[('TRACE_FINAL', v)] += 1; T[('TRACE_FINAL', 'n')] += 1
            if app and app.get('acceptedKind') and built:
                want = 'DOOR' if app['acceptedKind'] in DOORS else 'WINDOW'
                T[('KIND_AGREES', 'OK' if want == built['kind'] else 'DIFFERS')] += 1
            rows.append({'project': h, 'opening': oid, 'graph': p, 'model': built, 'application': app, 'verdict': v})
        for o in m['openings']:
            w = walls.get(o['wallId'], {})
            if o['kind'] != 'DOOR' or w.get('kind') != 'EXTERIOR': continue
            v = 'ON_ACCESS' if o['sill'] <= 0.05 else 'OFF_ACCESS'
            T[('DOOR_ON_ACCESS', v)] += 1; T[('DOOR_ON_ACCESS', 'n')] += 1
            if v == 'OFF_ACCESS': rows.append({'project': h, 'opening': o['id'], 'sill': o['sill'], 'verdict': 'DOOR_OFF_ACCESS'})
    for k, v in sorted(T.items(), key=str): print(k, v)
    if len(argv) > 2: json.dump({'totals': {('|'.join(k) if isinstance(k, tuple) else k): v for k, v in T.items()}, 'rows': rows}, open(argv[2], 'w'), indent=1)
if __name__ == '__main__':
    main(sys.argv)
