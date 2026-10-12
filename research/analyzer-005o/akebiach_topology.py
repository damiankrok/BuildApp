#!/usr/bin/env python3
"""akebiach_topology.py - BUILDPLAN-ANALYZER-005O topology gate T (RESEARCH ONLY; diagnostic, no kernel executed).

  python3 -I research/analyzer-005o/akebiach_topology.py --run /home/user/work005n/blind10/out-2 \
      --raster /home/user/work005n/blind10/cache/96e49a2c01e6d624b5424188608f10d9.bin \
      --out stage-reports/artifacts/analyzer-005o/akebiach-topology.json

The question (brief section 2, T): on the SAME accepted line set, is there a missing low-level graph operation -
noding (two observed walls that touch but are not split/joined), polygonization (a closed cycle of observed walls not
turned into a face), dangle handling - that a JSTS / Clipper2 / polygon-clipping operation would supply?

Measured here, from the sealed run's plan digest (the accepted wall bands of the selected plan frame) and the sealed
raster (ink fill of the boxes where the source draws the projection's side piers):
  1. the endpoint gaps of the projection's rear-wall bands and the wing walls to the nearest accepted band,
  2. the ink fill of the two side piers (present in the source, absent from the band set),
  3. the snap tolerance a noder would need to close the projection and the distance at which the same snap first
     joins the pergola posts north of it (a false closure of the rear terrace),
  4. whether ANY snap closes the projection without bridging the 4.01 m terrace door (it cannot: the door is a
     138 px hole in the rear wall, so the face exists only if a semantic gap decision closes it).
Only numbers leave the process; the raster stays outside the repository.
"""
import argparse, hashlib, json, math
from PIL import Image


def seg_of(b):
    x = b['bounds']
    if b['axis'] == 'H':
        y = (x['y0'] + x['y1']) / 2
        return ((x['x0'], y), (x['x1'], y))
    xm = (x['x0'] + x['x1']) / 2
    return ((xm, x['y0']), (xm, x['y1']))


def point_seg(p, s):
    (x1, y1), (x2, y2) = s
    dx, dy = x2 - x1, y2 - y1
    t = 0 if dx == dy == 0 else max(0, min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(p[0] - (x1 + t * dx), p[1] - (y1 + t * dy))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', required=True)
    ap.add_argument('--raster', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    dg = json.load(open(f'{a.run}/plan-diagnostics/digest.json'))
    plan = next(p for p in dg['plans'] if p['frameId'] == dg['selectedPlanFrameId'])
    bands = plan['bands']
    segs = [seg_of(b) for b in bands]
    mpp = (plan['scale']['mppX'] + plan['scale']['mppY']) / 2

    def find(x0, x1, y0, y1):
        return next(i for i, b in enumerate(bands) if (b['bounds']['x0'], b['bounds']['x1'], b['bounds']['y0'], b['bounds']['y1']) == (x0, x1, y0, y1))

    named = {'rear-W': find(386, 418, 194, 209), 'rear-E': find(556, 588, 194, 209), 'wing-W': find(337, 369, 228, 243), 'wing-E': find(605, 734, 228, 243),
             'core-W': find(377, 402, 243, 392), 'core-E': find(589, 597, 243, 595), 'pergola-W': find(374, 387, 116, 147), 'pergola-E': find(586, 600, 116, 147)}

    def gap(i, end, others):
        p = segs[i][end]
        return min((point_seg(p, segs[j]), j) for j in others)

    core = [named['core-W'], named['core-E']]
    gaps = {
        'rearW_westEnd_to_coreW': gap(named['rear-W'], 0, [named['core-W']])[0],
        'rearE_eastEnd_to_coreE': gap(named['rear-E'], 1, [named['core-E']])[0],
        'wingW_eastEnd_to_coreW': gap(named['wing-W'], 1, [named['core-W']])[0],
        'wingE_westEnd_to_coreE': gap(named['wing-E'], 0, [named['core-E']])[0],
        'rearW_to_pergolaW': min(point_seg(segs[named['pergola-W']][1], segs[named['rear-W']]), point_seg(segs[named['rear-W']][0], segs[named['pergola-W']])),
        'rearE_to_pergolaE': min(point_seg(segs[named['pergola-E']][1], segs[named['rear-E']]), point_seg(segs[named['rear-E']][1], segs[named['pergola-E']])),
        'door_hole_rearW_to_rearE': segs[named['rear-E']][0][0] - segs[named['rear-W']][1][0],
    }
    # the side piers in the source ink (dark <= 128), where the rear wall turns into the core's side walls
    im = Image.open(a.raster).convert('L')
    piers = {'pier-W': (370, 194, 386, 243), 'pier-E': (589, 194, 605, 243)}
    ink = {}
    for k, (x0, y0, x1, y1) in piers.items():
        px = [im.getpixel((x, y)) for y in range(y0, y1) for x in range(x0, x1)]
        ink[k] = {'box': [x0, y0, x1, y1], 'darkShare': round(sum(1 for v in px if v <= 128) / len(px), 4),
                  'inAcceptedBands': any(b['bounds']['x0'] <= x0 + 2 and b['bounds']['x1'] >= x1 - 2 and b['bounds']['y0'] <= y0 + 2 and b['bounds']['y1'] >= y1 - 2 for b in bands)}
    close_tol = max(gaps['rearW_westEnd_to_coreW'], gaps['rearE_eastEnd_to_coreE'])
    false_tol = min(gaps['rearW_to_pergolaW'], gaps['rearE_to_pergolaE'])
    doc = {
        'schema': 'buildapp.005o.akebiach-topology', 'frame': dg['selectedPlanFrameId'], 'wallPx': plan['wallPx'], 'cmPerPx': round(100 * mpp, 4), 'acceptedBands': len(bands),
        'rasterSha256': hashlib.sha256(open(a.raster, 'rb').read()).hexdigest(),
        'gapsPx': {k: round(v, 2) for k, v in gaps.items()}, 'gapsM': {k: round(v * mpp, 3) for k, v in gaps.items()},
        'piers': ink,
        'snapToCloseProjectionPx': round(close_tol, 2), 'snapAtWhichPergolaJoinsPx': round(false_tol, 2),
        'snapWindowPx': [round(close_tol, 2), round(false_tol, 2)], 'snapWindowWalls': [round(close_tol / plan['wallPx'], 2), round(false_tol / plan['wallPx'], 2)],
        'toleranciesInUsePx': {'decomposition_0.6wall': round(0.6 * plan['wallPx'], 2), 'outline': 4, 'cornerJoinedReach': 24},
        'doorClosesOnlyBySemanticGapDecision': gaps['door_hole_rearW_to_rearE'] > 3 * plan['wallPx'],
        'verdict': 'NO_KERNEL_BOTTLENECK',
        'why': 'every junction touches in the ink (piers dark in the source) but the piers are missing from the accepted band set (a band-extraction miss upstream of any graph); a noder closes the projection only with a snap above every tolerance in use and inside a window one house wide below the pergola false closure, and even then only if the 4.01 m door - a 138 px hole in the rear wall - is first classified as a closing segment, which is a semantic gap decision no kernel makes',
    }
    json.dump(doc, open(a.out, 'w'), indent=1, sort_keys=True)
    print(json.dumps(doc, indent=1))


if __name__ == '__main__':
    main()
