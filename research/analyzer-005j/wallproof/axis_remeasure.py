#!/usr/bin/env python3
"""axis_remeasure.py - post-review re-measurement of the REAL_DEV gap questions on the wall axis (RESEARCH ONLY, 005J).

    python -I -B axis_remeasure.py --ckpt <model.pt> --real <real corpus.json> --real-renders <dir>
                                   --truth <research/analyzer-005i-boundary-bakeoff/truth/real> --out <json>

Post-review A2: the 005I truth segments lie on the OUTER FACE of the exterior wall (the truth outline), so the 005J strip
(segment +/- 0.18 m) was half outside the building. This moves every segment of a REAL_DEV gap question (NORMAL frames
only, where the truth outline is in frame pixels) inward by half a typical exterior wall (0.22 m) - inward being the
side on which the moved midpoint falls inside the truth outline - and applies wall_referee.decide() unchanged. The
face-placed answer is recomputed beside it on the same questions, so the two columns differ only by placement.
The offset is a fixed constant, not fitted to any answer; nothing here reads an expected answer to place a strip.
"""
import argparse
import json
import math
import os
import sys
from collections import Counter, defaultdict

import numpy as np
import torch
from PIL import Image
from shapely.geometry import Point, Polygon

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wall_referee  # noqa: E402
import wallnet  # noqa: E402

HALF_WALL_M = 0.22


def shift_segment(a, b, d, ext):
    (ax, ay), (bx, by) = a, b
    L = math.hypot(bx - ax, by - ay) or 1.0
    nx, ny = -(by - ay) / L, (bx - ax) / L
    mx, my = (ax + bx) / 2, (ay + by) / 2
    s = 1.0 if ext.contains(Point(mx + nx * d, my + ny * d)) else -1.0
    return [(ax + s * nx * d, ay + s * ny * d), (bx + s * nx * d, by + s * ny * d)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ckpt', required=True)
    ap.add_argument('--real', required=True)
    ap.add_argument('--real-renders', required=True)
    ap.add_argument('--truth', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    ck = torch.load(a.ckpt, weights_only=False)
    model = wallnet.build(ck['arch'])
    model.load_state_dict(ck['state'])
    model.eval()
    torch.set_num_threads(1)
    r = json.load(open(a.real))
    scenes = {s['sceneId']: s for s in r['scenes']}
    rows = []
    preds = {}
    for q in r['questions']:
        if q['set'] != 'REAL_DEV' or q['transform'] != 'NORMAL' or q['cls'] not in wall_referee.CLASSES:
            continue
        sc = scenes[q['sceneId']]
        ext = Polygon(json.load(open(os.path.join(a.truth, f"{q['house']}.json")))['exterior']).buffer(0)
        if q['sceneId'] not in preds:
            preds[q['sceneId']] = wallnet.predict(model, np.array(Image.open(os.path.join(a.real_renders, f"{q['sceneId']}.png")).convert('L')))
        pred, ppm = preds[q['sceneId']], sc['pxPerM']
        d = HALF_WALL_M * ppm
        tgt = q['targetPx']
        if isinstance(tgt, dict):
            moved = {k: shift_segment(v[0], v[-1], d, ext) for k, v in tgt.items()}
        else:
            moved = shift_segment(tgt[0], tgt[-1], d, ext)
        face = wall_referee.decide(q['cls'], pred, tgt, ppm)
        axis = wall_referee.decide(q['cls'], pred, moved, ppm)
        rows.append({'qid': q['qid'], 'house': q['house'], 'cls': q['cls'], 'expected': q['expected'],
                     'face': {'answer': face[0], 'conf': face[1]}, 'axis': {'answer': axis[0], 'conf': axis[1]}})

    def tally(key):
        out = defaultdict(Counter)
        for x in rows:
            ans, conf = x[key]['answer'], x[key]['conf']
            c = out[x['cls']]
            c['n'] += 1
            if ans == 'UNRESOLVED':
                c['unresolved'] += 1
            elif ans == x['expected']:
                c['right'] += 1
                c['rightConfident'] += int(conf is not None and conf >= 0.8)
            else:
                c['wrong'] += 1
                c['wrongConfident'] += int(conf is not None and conf >= 0.8)
        return {k: dict(v) for k, v in sorted(out.items())}
    res = {'model': ck['arch'], 'halfWallM': HALF_WALL_M, 'questions': len(rows), 'face': tally('face'), 'axis': tally('axis'), 'rows': rows}
    json.dump(res, open(a.out, 'w'), indent=1)
    for k in ('face', 'axis'):
        print(k, json.dumps(res[k]))


if __name__ == '__main__':
    main()
