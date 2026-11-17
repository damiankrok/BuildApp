#!/usr/bin/env python3
"""v3.54.5 — the detailed scorer against synthetic scenes: what it must not let pass.
   /usr/bin/python3 -I research/source-to-model/v3545/score-detail-selfcheck.py"""
import importlib.util, os, sys, copy
spec = importlib.util.spec_from_file_location('sd', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'score-detail.py'))
sd = importlib.util.module_from_spec(spec); spec.loader.exec_module(sd)
side = lambda ops, blind=False: {'status': 'PUBLISHED', 'wallLeftPx': 100, 'wallRightPx': 1100, 'sideLengthM': 10.0, 'sideLengthBasis': 'PRINTED_ON_PLAN', 'zeroRowPx': 500, 'ridgeRowPx': 0, 'blind': blind, 'openings': ops}
op = lambda i, x0, y0, x1, y1, level=0, kind='WINDOW': {'id': i, 'kind': kind, 'level': level, 'boxPx': {'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1}, 'uncertainPx': 4}
ref = {'overall': {'widthM': 10, 'depthM': 8, 'basis': 'PRINTED_ON_PLAN'}, 'levels': {'ridgeAboveZeroM': 7.0, 'upperFloorLevelsM': [3.0]},
       'sides': {'FRONT': side([op('F1', 300, 300, 420, 410), op('F2', 700, 290, 800, 500, kind='DOOR'), op('F3', 300, 60, 420, 160, level=1)]), 'RIGHT': side([], blind=True), 'REAR': {'status': 'NOT_PUBLISHED'}, 'LEFT': side([op('L1', 500, 300, 600, 400)])}}
W = {'x0': 0, 'x1': 10, 'y0': 0, 'y1': 5, 'z0': 0, 'z1': 8, 'widthM': 10, 'depthM': 8}
hole = lambda i, s, along, w, bottom, h, kind='WINDOW': {'id': i, 'kind': kind, 'side': s, 'alongM': along, 'widthM': w, 'heightM': h, 'bottomY': bottom, 'topY': bottom + h}
good = {'exteriorWalls': W, 'roofTopY': 7.0, 'objects': {}, 'openings': [hole('a', 'FRONT', 2.0, 1.2, 0.9, 1.1), hole('b', 'FRONT', 6.0, 1.0, 0.0, 2.1, 'DOOR'), hole('c', 'FRONT', 2.0, 1.2, 3.4, 1.0), hole('d', 'LEFT', 4.0, 1.0, 1.0, 1.0)]}
checks = []
def check(name, cond): checks.append((name, bool(cond)))
r = sd.score_house(ref, good, None)
check('a correct scene: every reference opening OK, all published sides built, a blind side with nothing on it built', r['openings']['ok'] == 4 and r['openings']['false'] == 0 and r['sidesBuilt'] == 3 and r['sidesPublished'] == 3)
m = copy.deepcopy(good); m['openings'][0]['side'] = 'REAR'
r = sd.score_house(ref, m, None)
check('a hole on another side is not matched: the reference opening is MISSING', r['openings']['matched'] == 3 and any(x['ref'] == 'F1' and x['result'] == 'MISSING' for x in r['rows']))
m = copy.deepcopy(good); m['openings'][2]['bottomY'] = 0.9; m['openings'][2]['topY'] = 1.9
r = sd.score_house(ref, m, None)
check('a hole on the wrong storey is not matched to the upper window: MISSING and FALSE', any(x['ref'] == 'F3' and x['result'] == 'MISSING' for x in r['rows']) and r['openings']['false'] == 1)
m = copy.deepcopy(good); m['openings'][0]['widthM'] = 0.6
r = sd.score_house(ref, m, None)
check('a window cut at half its width is matched and OFF by width — a count would have passed it', any(x['ref'] == 'F1' and x['result'] == 'OFF' and 'dWidth' in x['off'] for x in r['rows']) and r['openings']['ok'] == 3)
m = copy.deepcopy(good); m['openings'].append(hole('e', 'RIGHT', 3.0, 1.0, 1.0, 1.0))
r = sd.score_house(ref, m, None)
check('a hole on a side the source shows blind is FALSE and the side is not built', r['sides']['RIGHT']['false'] == 1 and not r['sides']['RIGHT']['built'])
m = copy.deepcopy(good); m['openings'].append(hole('f', 'REAR', 3.0, 1.0, 1.0, 1.0))
r = sd.score_house(ref, m, None)
check('a hole on a side with no published elevation is neither OK nor FALSE: it cannot be assessed', r['openings']['false'] == 0 and r['openings']['ok'] == 4)
m = copy.deepcopy(good); m['openings'] = [dict(o, alongM=10 - o['alongM'] - o['widthM']) if o['side'] == 'FRONT' else o for o in m['openings']]
r = sd.score_house(ref, m, None)
check('a mirrored front is not turned back to fit: its openings are off or missing', r['sides']['FRONT']['ok'] == 0)
m = copy.deepcopy(good); m['roofTopY'] = 16.8; m['exteriorWalls'] = dict(W, widthM=12.0)
r = sd.score_house(ref, m, None)
check('a roof ten metres too high and walls two metres too wide fail HEIGHT and EXTENTS', r['height']['ok'] is False and r['extents']['ok'] is False)
r = sd.score_house(ref, None, None)
check('no model: nothing passes, every reference opening is missing', r['openings']['missing'] == 4 and r['model'] is False)
u = copy.deepcopy(ref); u['sides']['LEFT']['sideLengthBasis'] = 'UNKNOWN'
r = sd.score_house(u, good, None)
check('a side whose length the source does not give is scored for presence only, never as a correct size', any(x['ref'] == 'L1' and x['result'] == 'PRESENT' for x in r['rows']) and r['openings']['ok'] == 3)
for name, ok in checks: print('PASS' if ok else 'FAIL', name)
sys.exit(0 if all(ok for _, ok in checks) else 1)
