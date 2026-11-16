"""v3.54.3 — one row per house for the frozen confirmation (PROTOCOL_V3543 §4), scorer version 3543.1.

  /usr/bin/python3 -I confirm_score.py --selftest
  /usr/bin/python3 -I confirm_score.py <run dir of one house> <reference.json>   -> JSON row

Reads a run directory as second-house.ts (A0/A1) or consult-run.ts (R/C) writes it: model.json (absent = no model),
consult.json (absent = no consultation) and result-summary.json. The reference is a `refs-confirm/<house>.json`:
`metricCertain.overallWidthM/overallDepthM` (printed dimensions; null when the plan prints none) and `roofFeatures`.

Per property, never one grade:
  size      the ground slabs' bounding box against the printed overall dimensions, per axis, in the model's own scale;
            classes as PROTOCOL_V3541 §5 (OK <= 3 %, NEAR <= 10 %, WRONG above) on the worse axis; NO_REFERENCE when the
            plan prints no overall dimension (page text is not a printed dimension).
  dormers   roof_features.score against the reference's dormers (same side, share intervals overlapping >= 0.3 IoU; no
            rotation, no mirroring): MATCH / PARTIAL / MISMATCH / NO_DORMER_EITHER, with the missing and the false ones listed.
  loop      what the consultation did, read from consult.json: looks, proposals by state, features kept, rollbacks.
The fixed-frame outline IoU of v3.54.2 is NOT computed: the confirmation references of v3.54.3 hold no outline polygon
(the reader was asked for printed dimensions and roof features, the two properties this stage corrects).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'v3542'))
import roof_features as rf  # noqa: E402
from score import bbox, ground_polygons, size_class  # noqa: E402

VERSION = '3543.1'


def score_house(run_dir, ref):
    row = {'scorer': VERSION, 'house': ref.get('house')}
    mp = os.path.join(run_dir, 'model.json')
    cp = os.path.join(run_dir, 'consult.json')
    consult = json.load(open(cp)) if os.path.exists(cp) else None
    if consult is not None:
        looks = consult.get('geometry') or []
        states = {}
        for c in ((consult.get('sourceCheck') or {}).get('corrections') or []):
            states[c['state']] = states.get(c['state'], 0) + 1
        row['loop'] = {
            'local': (consult.get('local') or {}).get('status'),
            'final': (consult.get('final') or {}).get('status'),
            'looks': [f"{g.get('decision')}[{g.get('status')}]" for g in looks],
            'corrections': states,
            'features': [f.get('id') for f in (consult.get('roofFeatures') or [])],
            'boundary': [f"{b.get('decision')}" for b in ([consult['boundary']] if isinstance(consult.get('boundary'), dict) else (consult.get('boundary') or []))],
            'sourceCheck': (consult.get('sourceCheck') or {}).get('status'),
            'usd': consult.get('usd'),
        }
    if not os.path.exists(mp):
        row['outcome'] = 'NO_MODEL'
        refd = [f for f in ref.get('roofFeatures') or [] if rf.DORMER_KINDS.get(f.get('kind'), 'x') != 'x']
        row['dormers'] = {'status': 'NO_MODEL', 'refDormers': len(refd)}
        row['size'] = None
        return row
    model = json.load(open(mp))
    row['outcome'] = 'MODEL'
    mc = ref.get('metricCertain') or {}
    rw = (mc.get('overallWidthM') or {}).get('value')
    rd = (mc.get('overallDepthM') or {}).get('value')
    polys = ground_polygons(model)
    if polys:
        mw, md = bbox(polys)
        row['widthM'], row['depthM'] = round(mw, 3), round(md, 3)
        ew = abs(mw - rw) / rw if rw else None
        ed = abs(md - rd) / rd if rd else None
        row['refWidthM'], row['refDepthM'] = rw, rd
        row['errWidth'] = None if ew is None else round(ew, 3)
        row['errDepth'] = None if ed is None else round(ed, 3)
        worst = max([e for e in (ew, ed) if e is not None], default=None)
        row['size'] = 'NO_REFERENCE' if worst is None else size_class(worst)
    else:
        row['size'] = None
    d = rf.score(model, ref)
    row['dormers'] = {k: d.get(k) for k in ('status', 'refDormers', 'modelDormers', 'matched', 'missing', 'false', 'kindAgreed', 'ownRoofWings')}
    return row


def selftest():
    import tempfile
    ok = True

    def check(name, cond):
        nonlocal ok
        print(('ok   ' if cond else 'FAIL ') + name)
        ok = ok and cond

    slab = lambda w, d: {'levels': [{'id': 'L0', 'index': 0}], 'slabs': [{'levelId': 'L0', 'polygon': [{'x': 0, 'z': 0}, {'x': w, 'z': 0}, {'x': w, 'z': d}, {'x': 0, 'z': d}]}]}
    ref = {'house': 'h', 'metricCertain': {'overallWidthM': {'value': 10.0}, 'overallDepthM': {'value': 8.0}}, 'roofFeatures': []}
    with tempfile.TemporaryDirectory() as t:
        check('no model.json is NO_MODEL, never a size', score_house(t, ref)['outcome'] == 'NO_MODEL' and score_house(t, ref)['size'] is None)
        json.dump(slab(10.2, 8.0), open(os.path.join(t, 'model.json'), 'w'))
        r = score_house(t, ref)
        check('2 % on the worse axis is OK', r['size'] == 'OK' and r['errWidth'] == 0.02)
        json.dump(slab(10.0, 7.3), open(os.path.join(t, 'model.json'), 'w'))
        check('8.75 % on the worse axis is NEAR', score_house(t, ref)['size'] == 'NEAR')
        json.dump(slab(12.0, 8.0), open(os.path.join(t, 'model.json'), 'w'))
        check('20 % is WRONG', score_house(t, ref)['size'] == 'WRONG')
        check('a plan that prints no overall dimension has NO_REFERENCE, not a class', score_house(t, {'house': 'h', 'metricCertain': {'overallWidthM': None, 'overallDepthM': None}, 'roofFeatures': []})['size'] == 'NO_REFERENCE')
        check('a house with no dormer on either side says so', score_house(t, ref)['dormers']['status'] == 'NO_DORMER_EITHER')
        check('a reference dormer the model lacks is a MISMATCH with one missing', (lambda d: d['status'] == 'MISMATCH' and len(d['missing']) == 1)(score_house(t, {**ref, 'roofFeatures': [{'kind': 'GABLE_DORMER', 'side': 'FRONT', 'alongShare': [0.4, 0.6]}]})['dormers']))
        check('a wing, a porch canopy and roof windows in the reference are not dormers', score_house(t, {**ref, 'roofFeatures': [{'kind': 'CROSS_GABLE_WING', 'side': 'FRONT'}, {'kind': 'PORCH_CANOPY_OPEN', 'side': 'FRONT'}, {'kind': 'ROOF_WINDOW', 'side': 'REAR'}, {'kind': 'CHIMNEY_COUNT'}]})['dormers']['status'] == 'NO_DORMER_EITHER')
    print('SELFTEST', 'PASSED' if ok else 'FAILED')
    return ok


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(0 if selftest() else 1)
    print(json.dumps(score_house(sys.argv[1], json.load(open(sys.argv[2])))))
