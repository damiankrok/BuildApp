#!/usr/bin/env python3
"""wall_referee.py - the proof wall/opening model read as a referee on gap questions (RESEARCH ONLY, 005J).

    python -I -B wall_referee.py --ckpt <model.pt> --synth <synth corpus.json> --synth-renders <dir>
                                 --real <real corpus.json> --real-renders <dir> --items <items-all.jsonl> --out <run.jsonl>

A per-pixel BACKGROUND / WALL / OPENING map is an observation, not an answer. This turns it into closed answers for the
four question classes that are about a stretch of wall line, with rules fixed BEFORE the run was scored (below), so the
map can be scored by the same scorer as the VLMs. The model runs on the SOURCE drawing at its own scale (the render or
the real frame under the question's transform), never on the overlay image; the question's geometry says where to look.

Pre-registered rules. A strip = the question segment buffered across by 0.18 m (half a typical exterior wall plus
margin), using the drawing's px/m. Shares are pixel fractions of the strip.
  OPENING_VS_PATTERN      opening >= 0.50 -> OPENING (conf = opening share); opening <= 0.10 and wall <= 0.20 -> PATTERN
                          (conf = 1 - opening - wall); otherwise UNRESOLVED.
  WALL_CONTINUATION       the gap strip runs from A's inner end to B's inner end. A and B must each be >= 0.40 wall,
                          else UNRESOLVED. gap opening >= 0.50 -> CONTINUES (conf = opening share); gap background
                          >= 0.80 -> TERMINATES (conf = background share); otherwise UNRESOLVED. (NOT_SAME_WALL is never
                          claimed by this rule.)
  OPEN_SIDE_VS_OPENINGS   along the stretch: opening >= 0.20 and (opening + wall) >= 0.35 -> SEVERAL_OPENINGS
                          (conf = opening + wall); background >= 0.85 -> ONE_OPEN_SIDE (conf = background); else UNRESOLVED.
  CANOPY_PERGOLA_VS_WALL  wall + opening >= 0.60 -> WALL (conf = that share); wall + opening <= 0.10 -> NOT_WALL
                          (conf = 1 - that share); otherwise UNRESOLVED.
Every other class: not asked (the map does not speak to regions, letters or storeys).
"""
import argparse
import json
import math
import os
import sys

import numpy as np
import torch
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wallnet  # noqa: E402

CLASSES = ('OPENING_VS_PATTERN', 'WALL_CONTINUATION', 'OPEN_SIDE_VS_OPENINGS', 'CANOPY_PERGOLA_VS_WALL')
HALF_M = 0.18


def strip_mask(shape, a, b, half_px):
    m = Image.new('L', (shape[1], shape[0]), 0)
    (ax, ay), (bx, by) = a, b
    L = math.hypot(bx - ax, by - ay) or 1.0
    nx, ny = -(by - ay) / L * half_px, (bx - ax) / L * half_px
    ImageDraw.Draw(m).polygon([(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)], fill=1)
    return np.array(m, dtype=bool)


def shares(pred, mask):
    n = max(1, int(mask.sum()))
    return {'bg': float(((pred == 0) & mask).sum()) / n, 'wall': float(((pred == 1) & mask).sum()) / n, 'open': float(((pred == 2) & mask).sum()) / n}


def decide(cls, pred, tgt, ppm):
    half = max(3.0, HALF_M * ppm)
    if cls == 'OPENING_VS_PATTERN':
        s = shares(pred, strip_mask(pred.shape, tgt[0], tgt[-1], half))
        if s['open'] >= 0.5:
            return 'OPENING', s['open'], s
        if s['open'] <= 0.10 and s['wall'] <= 0.20:
            return 'PATTERN', 1 - s['open'] - s['wall'], s
        return 'UNRESOLVED', None, s
    if cls == 'WALL_CONTINUATION':
        A, B = tgt['A'], tgt['B']
        sa = shares(pred, strip_mask(pred.shape, A[0], A[1], half))
        sb = shares(pred, strip_mask(pred.shape, B[0], B[1], half))
        # the gap: from A's end nearest B to B's end nearest A
        a_end = min(A, key=lambda p: min(math.dist(p, q) for q in B))
        b_end = min(B, key=lambda p: math.dist(p, a_end))
        sg = shares(pred, strip_mask(pred.shape, a_end, b_end, half))
        s = {'A': sa, 'B': sb, 'gap': sg}
        if sa['wall'] < 0.4 or sb['wall'] < 0.4:
            return 'UNRESOLVED', None, s
        if sg['open'] >= 0.5:
            return 'CONTINUES', sg['open'], s
        if sg['bg'] >= 0.8:
            return 'TERMINATES', sg['bg'], s
        return 'UNRESOLVED', None, s
    if cls == 'OPEN_SIDE_VS_OPENINGS':
        s = shares(pred, strip_mask(pred.shape, tgt[0], tgt[-1], half))
        if s['open'] >= 0.20 and s['open'] + s['wall'] >= 0.35:
            return 'SEVERAL_OPENINGS', s['open'] + s['wall'], s
        if s['bg'] >= 0.85:
            return 'ONE_OPEN_SIDE', s['bg'], s
        return 'UNRESOLVED', None, s
    if cls == 'CANOPY_PERGOLA_VS_WALL':
        s = shares(pred, strip_mask(pred.shape, tgt[0], tgt[-1], half))
        w = s['wall'] + s['open']
        if w >= 0.6:
            return 'WALL', w, s
        if w <= 0.10:
            return 'NOT_WALL', 1 - w, s
        return 'UNRESOLVED', None, s
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ckpt', required=True)
    ap.add_argument('--synth', required=True)
    ap.add_argument('--synth-renders', required=True)
    ap.add_argument('--real', required=True)
    ap.add_argument('--real-renders', required=True)
    ap.add_argument('--items', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--name', default=None)
    a = ap.parse_args()
    ck = torch.load(a.ckpt, weights_only=False)
    model = wallnet.build(ck['arch'])
    model.load_state_dict(ck['state'])
    model.eval()
    torch.set_num_threads(1)
    name = a.name or f"wall-{ck['arch']}-structured"
    wanted = {}
    for l in open(a.items):
        it = json.loads(l)
        if it['mode'] == 'CANDIDATE_OVERLAY' and it['cls'] in CLASSES:
            wanted[it['qid']] = it
    jobs = []
    s = json.load(open(a.synth))
    scenes = {x['sceneId']: x for x in s['scenes']}
    for q in s['questions']:
        if q['qid'] in wanted:
            sc = scenes[q['sceneId']]
            jobs.append((q, os.path.join(a.synth_renders, f"{sc['sceneId']}.png"), sc['style']['pxPerM']))
    r = json.load(open(a.real))
    rscenes = {x['sceneId']: x for x in r['scenes']}
    for q in r['questions']:
        if q['qid'] in wanted:
            sc = rscenes[q['sceneId']]
            jobs.append((q, os.path.join(a.real_renders, f"{sc['sceneId']}.png"), sc['pxPerM']))
    cache = {}
    with open(a.out, 'w') as fh:
        for q, png, ppm in jobs:
            if png not in cache:
                cache.clear()
                cache[png] = wallnet.predict(model, np.array(Image.open(png).convert('L')))
            ans, conf, s = decide(q['cls'], cache[png], q['targetPx'], ppm)
            it = wanted[q['qid']]
            fh.write(json.dumps({'qid': q['qid'], 'mode': 'CANDIDATE_OVERLAY', 'model': name, 'imageSha256': it['imageSha256'],
                                 'structured': {'answer': ans, 'confidence': None if conf is None else round(conf, 4), 'shares': s}}) + '\n')
    print(len(jobs), 'questions ->', a.out)


if __name__ == '__main__':
    main()
