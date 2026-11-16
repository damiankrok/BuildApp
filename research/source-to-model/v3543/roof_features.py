"""v3.54.3 — secondary roof features of a compiled model against a source-only reference (scorer version 3543.1).

The v3.54.2 scorer reads the MAIN roof (kind, ridge direction). A main ridge that agrees says nothing about a dormer that
is missing, so this module reads what else the model's roof holds, from the representations the repo really emits:
  - DORMER assemblies (`assemblies[kind=DORMER]`: dormerType, hostPlaneIds, footprintOnRoof) — `createDormer`;
  - roof planes of a body other than the main roof's (`roof-<mass>-plane-*`): a wing or cross gable with its own roof;
  - rooflights and chimneys, counted (they are not dormers and must never be scored as one);
  - the main roof as a footprint roof (`roofs[]`) or as planes (`roofPlanes` of the largest group), via roof_axis.py.
A dormer's SIDE is the side its host plane slopes down to (FRONT = z falling, the model frame's front at z = 0); its
place is its footprint's extent along that side as shares of the lowest storey's wall outline there, left to right as seen
from outside (FRONT and RIGHT grow with the coordinate, REAR and LEFT run against it).

Against a reference (`roofFeatures`: kind, side, alongShare) a model dormer matches a reference dormer on the same side
whose interval it overlaps by at least OVERLAP (intersection over union of the two share intervals) — no rotation, no
mirroring, no nearest-side rescue. Reported: reference dormers, model dormers, matched, missing, false, kind agreement.
Without `alongShare` in the reference only side and count are compared (presence and topology, no invented accuracy).

  /usr/bin/python3 -I roof_features.py --selftest
  /usr/bin/python3 -I roof_features.py <model.json> [<reference.json>]
"""
import json, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'v3542'))
from roof_axis import main_roof  # noqa: E402

VERSION = '3543.1'
OVERLAP = 0.3
DORMER_KINDS = {'GABLE_DORMER': 'GABLE', 'SHED_DORMER': 'SHED', 'FLAT_DORMER': 'FLAT', 'WALL_DORMER_GABLE': 'GABLE', 'WALL_DORMER_SHED': 'SHED', 'DORMER': None}


def _side(down):
    x, z = down['x'], down['z']
    if abs(z) >= abs(x):
        return 'FRONT' if z < 0 else 'REAR'
    return 'RIGHT' if x > 0 else 'LEFT'


def _main_extent(m, group):
    """The side's wall width the reference's shares are of: the lowest storey's slab extent (the walls' outline);
    failing that, the main roof's own extent."""
    levels = sorted(m.get('levels') or [], key=lambda l: l['index'])
    xs, zs = [], []
    if levels:
        for s in m.get('slabs') or []:
            if s.get('levelId') == levels[0]['id']:
                xs += [q['x'] for q in s.get('polygon') or []]
                zs += [q['z'] for q in s.get('polygon') or []]
    if not xs:
        for p in m.get('roofPlanes') or []:
            if group and p['id'].startswith(group + '-plane'):
                xs += [q['x'] for q in p['boundary']]
                zs += [q['z'] for q in p['boundary']]
        for r in m.get('roofs') or []:
            if r.get('id') == group and r.get('footprint'):
                f = r['footprint']
                xs += [f['minX'], f['maxX']]
                zs += [f['minZ'], f['maxZ']]
    return (min(xs), max(xs), min(zs), max(zs)) if xs else None


def _share(side, lo, hi, ext):
    x0, x1, z0, z1 = ext
    if side in ('FRONT', 'REAR'):
        a, b = (lo - x0) / (x1 - x0), (hi - x0) / (x1 - x0)
    else:
        a, b = (lo - z0) / (z1 - z0), (hi - z0) / (z1 - z0)
    if side in ('REAR', 'LEFT'):
        a, b = 1 - b, 1 - a
    return [round(a, 3), round(b, 3)]


def features_of(m):
    """The model's roof beyond its main planes."""
    mr = main_roof(m)
    ext = _main_extent(m, mr.get('group'))
    planes = {p['id']: p for p in m.get('roofPlanes') or []}
    dormers = []
    dormer_plane_ids = set()
    for a in m.get('assemblies') or []:
        if a.get('kind') != 'DORMER':
            continue
        host = planes.get((a.get('hostPlaneIds') or [None])[0])
        fp = a.get('footprintOnRoof') or []
        d = {'id': a['id'], 'type': a.get('dormerType'), 'hostPlaneId': host['id'] if host else None, 'side': _side(host['downslope']) if host else None}
        if host and fp and ext:
            along_x = d['side'] in ('FRONT', 'REAR')
            vals = [q['x'] if along_x else q['z'] for q in fp]
            d['alongShare'] = _share(d['side'], min(vals), max(vals), ext)
        dormers.append(d)
    for a in m.get('assemblies') or []:
        if a.get('kind') == 'ROOF' and any(a['id'].startswith(d['id']) for d in dormers):
            dormer_plane_ids |= set(a.get('planeIds') or [])
    wings = sorted({p['id'].split('-plane')[0] for p in planes.values() if '-plane' in p['id'] and p['id'].split('-plane')[0] != mr.get('group') and p['id'] not in dormer_plane_ids})
    return {'scorer': VERSION, 'mainRoof': mr, 'dormers': sorted(dormers, key=lambda d: d['id']), 'ownRoofWings': wings,
            'rooflights': len(m.get('rooflights') or []), 'chimneys': len(m.get('chimneys') or [])}


def _iou(a, b):
    inter = max(0.0, min(a[1], b[1]) - max(a[0], b[0]))
    union = max(a[1], b[1]) - min(a[0], b[0])
    return inter / union if union > 0 else 0.0


def score(m, ref):
    """Model dormers against the reference's dormer-family features; everything else is counted, not matched."""
    f = features_of(m)
    want = [r for r in (ref.get('roofFeatures') or []) if r.get('kind') in DORMER_KINDS]
    left = list(f['dormers'])
    matched, missing, kind_ok = [], [], 0
    for r in want:
        best = None
        for d in left:
            if d['side'] != r.get('side'):
                continue
            ov = _iou(d['alongShare'], r['alongShare']) if d.get('alongShare') and r.get('alongShare') else None
            if ov is not None and ov < OVERLAP:
                continue
            if best is None or (ov or 0) > (best[1] or 0):
                best = (d, ov)
        if best is None:
            missing.append({'kind': r['kind'], 'side': r.get('side'), 'alongShare': r.get('alongShare')})
            continue
        d, ov = best
        left.remove(d)
        same = DORMER_KINDS[r['kind']] in (None, d['type'])
        kind_ok += 1 if same else 0
        matched.append({'id': d['id'], 'refKind': r['kind'], 'modelType': d['type'], 'side': d['side'], 'overlap': None if ov is None else round(ov, 3), 'kindAgrees': same,
                        'centreOffShare': None if not (d.get('alongShare') and r.get('alongShare')) else round(abs(sum(d['alongShare']) / 2 - sum(r['alongShare']) / 2), 3),
                        'widthRatio': None if not (d.get('alongShare') and r.get('alongShare')) else round((d['alongShare'][1] - d['alongShare'][0]) / max(1e-9, r['alongShare'][1] - r['alongShare'][0]), 3)})
    false = [{'id': d['id'], 'type': d['type'], 'side': d['side'], 'alongShare': d.get('alongShare')} for d in left]
    status = 'NO_DORMER_EITHER' if not want and not f['dormers'] else ('MATCH' if not missing and not false and kind_ok == len(matched) else ('PARTIAL' if matched else 'MISMATCH'))
    return {'scorer': VERSION, 'refDormers': len(want), 'modelDormers': len(f['dormers']), 'matched': matched, 'missing': missing, 'false': false, 'kindAgreed': kind_ok, 'status': status,
            'modelRooflights': f['rooflights'], 'modelChimneys': f['chimneys'], 'ownRoofWings': f['ownRoofWings']}


# ---------------------------------------------------------------------------------------------------------------------
# self-test on synthetic models in the repo's real representations (written for the test; no project's data)
# ---------------------------------------------------------------------------------------------------------------------

def _plane(pid, down, pts):
    return {'id': pid, 'downslope': {'x': down[0], 'z': down[1]}, 'pitchDeg': 40, 'boundary': [{'x': x, 'z': z} for x, z in pts]}


def _gable_planes(x0=0, x1=12, z0=0, z1=8):
    zr = (z0 + z1) / 2
    return [_plane('roof-main-plane-low', (0, -1), [(x0, z0), (x0, zr), (x1, zr), (x1, z0)]), _plane('roof-main-plane-high', (0, 1), [(x0, zr), (x0, z1), (x1, z1), (x1, zr)])]


def _dormer(did, host, x0, x1, z0, z1, typ='GABLE'):
    return [{'id': did, 'kind': 'DORMER', 'dormerType': typ, 'hostPlaneIds': [host], 'footprintOnRoof': [{'x': x0, 'z': z0}, {'x': x1, 'z': z0}, {'x': x1, 'z': z1}, {'x': x0, 'z': z1}]},
            {'id': did + '-roof-assembly', 'kind': 'ROOF', 'planeIds': [did + '-roof-l', did + '-roof-r']}]


def selftest():
    ok = True

    def check(name, cond):
        nonlocal ok
        print(('ok   ' if cond else 'FAIL ') + name)
        ok = ok and cond

    ridge = [{'id': 'roof-main-ridge', 'kind': 'RIDGE', 'planeIds': ['roof-main-plane-low', 'roof-main-plane-high'], 'start': {'x': 0, 'z': 4}, 'end': {'x': 12, 'z': 4}}]
    # 1. a footprint gable with nothing on it (the drawings' path's plain roof)
    legacy = {'roofs': [{'id': 'roof-main', 'kind': 'GABLE', 'ridgeAxis': 'X', 'footprint': {'minX': 0, 'maxX': 12, 'minZ': 0, 'maxZ': 8}}], 'roofPlanes': [], 'assemblies': [], 'rooflights': [{}, {}], 'chimneys': [{}]}
    f = features_of(legacy)
    check('footprint gable, no feature: no dormer; rooflights and chimneys counted, never dormers', f['dormers'] == [] and f['rooflights'] == 2 and f['chimneys'] == 1 and f['mainRoof']['ridge'] == 'ALONG_FRONT')
    check('no dormer in model or reference: NO_DORMER_EITHER', score(legacy, {'roofFeatures': [{'kind': 'ROOF_WINDOW', 'side': 'REAR'}]})['status'] == 'NO_DORMER_EITHER')
    # 2. the same gable as planes, with a gable dormer on the front slope
    dorm_planes = [_plane('dormer-front-c50-roof-l', (-1, 0), [(4.2, 0.5), (6, 0.5), (6, 3), (4.2, 1.4)]), _plane('dormer-front-c50-roof-r', (1, 0), [(6, 0.5), (7.8, 0.5), (7.8, 1.4), (6, 3)])]
    with_dormer = {'roofs': [], 'roofPlanes': _gable_planes() + dorm_planes, 'roofEdges': ridge, 'assemblies': _dormer('dormer-front-c50', 'roof-main-plane-low', 4.2, 7.8, 0.5, 3.0), 'rooflights': [], 'chimneys': []}
    f = features_of(with_dormer)
    check('plane gable + dormer: main roof still GABLE along the front (the dormer\'s planes are not the main group)', f['mainRoof']['kind'] == 'GABLE' and f['mainRoof']['ridge'] == 'ALONG_FRONT')
    check('dormer read: FRONT, 35–65 % of the side, GABLE; its planes are not a wing', f['dormers'][0]['side'] == 'FRONT' and f['dormers'][0]['alongShare'] == [0.35, 0.65] and f['ownRoofWings'] == [])
    ref = {'roofFeatures': [{'kind': 'WALL_DORMER_GABLE', 'side': 'FRONT', 'alongShare': [0.35, 0.65]}, {'kind': 'ROOF_WINDOW', 'side': 'REAR'}, {'kind': 'CHIMNEY_COUNT', 'count': 3}]}
    s = score(with_dormer, ref)
    check('matches the reference dormer: MATCH, overlap 1, kind agrees', s['status'] == 'MATCH' and s['matched'][0]['overlap'] == 1.0 and s['kindAgreed'] == 1)
    check('a plain roof against that reference: the dormer is MISSING (a right main ridge does not hide it)', score(legacy, ref)['status'] == 'MISMATCH' and len(score(legacy, ref)['missing']) == 1)
    check('a dormer the reference does not show is FALSE', score(with_dormer, {'roofFeatures': []})['false'][0]['id'] == 'dormer-front-c50')
    # 3. rotation and mirror are not rescued
    rear = dict(with_dormer, assemblies=_dormer('dormer-rear-c50', 'roof-main-plane-high', 4.2, 7.8, 5.0, 7.5))
    s = score(rear, ref)
    check('the dormer on the REAR against a FRONT reference: one missing and one false, no nearest-side rescue', len(s['missing']) == 1 and len(s['false']) == 1)
    check('REAR shares run against x (seen from outside)', features_of(dict(with_dormer, assemblies=_dormer('d', 'roof-main-plane-high', 1.2, 3.6, 5, 7)))['dormers'][0]['alongShare'] == [0.7, 0.9])
    off = dict(with_dormer, assemblies=_dormer('dormer-front-c20', 'roof-main-plane-low', 1.2, 3.6, 0.5, 3.0))
    s = score(off, {'roofFeatures': [{'kind': 'GABLE_DORMER', 'side': 'FRONT', 'alongShare': [0.7, 0.9]}]})
    check('a mirrored place (20 % instead of 80 %) does not match', s['status'] == 'MISMATCH' and len(s['missing']) == 1 and len(s['false']) == 1)
    s = score(dict(with_dormer, assemblies=_dormer('dormer-front-c50', 'roof-main-plane-low', 4.2, 7.8, 0.5, 3.0, 'SHED')), ref)
    check('right place, wrong kind: PARTIAL, kind disagreement reported', s['status'] == 'PARTIAL' and s['matched'][0]['kindAgrees'] is False)
    # 4. a hipped roof (four planes) and a wing with its own roof are not dormers
    hip = {'roofs': [], 'roofPlanes': _gable_planes() + [_plane('roof-main-plane-end-min', (-1, 0), [(0, 0), (0, 8), (4, 4)]), _plane('roof-main-plane-end-max', (1, 0), [(12, 0), (8, 4), (12, 8)])], 'roofEdges': ridge, 'assemblies': []}
    f = features_of(hip)
    check('hip: HIP, ridge along the front, no dormer', f['mainRoof']['kind'] == 'HIP' and f['mainRoof']['ridge'] == 'ALONG_FRONT' and f['dormers'] == [])
    wing = {'roofs': [], 'roofPlanes': _gable_planes() + [_plane('roof-wing-plane-low', (-1, 0), [(4, -3), (5, -3), (5, 0), (4, 0)]), _plane('roof-wing-plane-high', (1, 0), [(5, -3), (6, -3), (6, 0), (5, 0)])], 'roofEdges': ridge, 'assemblies': []}
    f = features_of(wing)
    check('a cross-gable wing is an own-roof wing, never a dormer', f['dormers'] == [] and f['ownRoofWings'] == ['roof-wing'])
    check('a reference without shares compares side and count only', score(with_dormer, {'roofFeatures': [{'kind': 'GABLE_DORMER', 'side': 'FRONT'}]})['status'] == 'MATCH')
    print('SELFTEST', 'PASSED' if ok else 'FAILED')
    return ok


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(0 if selftest() else 1)
    model = json.load(open(sys.argv[1]))
    print(json.dumps(score(model, json.load(open(sys.argv[2]))) if len(sys.argv) > 2 else features_of(model), indent=1))
