#!/usr/bin/env python3
"""trainset.py - wall / opening masks for the commercial-clean wall-model proof (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B trainset.py --out <dir> --seed-base 70000 --seeds 6 [--families all]

Renders the Visual Referee generator's scenes (vrgen.py: BuildPlan's own synthetic drawings, generated here, owned by
BuildPlan, no third-party pixels) together with exact label masks from the same semantic geometry:
  0 background, 1 wall (union of wall solids), 2 opening (the wall-line rectangle of every drawn opening: window, door,
  sliding, garage door - not an OPEN side).
and side masks used only by the scorer: terrace/patio/driveway regions, dimension-line strokes, text boxes.
No ResPlan, CubiCasa or other third-party data enters this set (licence findings: stage report section B).
"""
import argparse
import json
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'synthetic'))
import vrgen  # noqa: E402

EXTERNAL_ROLES = {'TERRACE', 'PORCH', 'PERGOLA', 'DRIVEWAY', 'CARPORT', 'COURTYARD', 'ROOF_PROJECTION', 'UNDERCUT', 'STEPS', 'OUTSIDE'}


def masks_for(scene, transform, info):
    W, H = info['size']
    M = info['map']
    st = scene.st
    pieces, sym, dimg = scene.compile()
    lab = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(lab)
    for w in scene.walls:
        ax, ay = w['a']
        bx, by = w['b']
        L = math.hypot(bx - ax, by - ay)
        ux, uy = (bx - ax) / L, (by - ay) / L
        nx, ny = -uy, ux
        t = w['t']
        for s0, s1, kind in w['ops']:
            if kind == 'OPEN':
                continue
            P = lambda s, o: (ax + ux * s + nx * o, ay + uy * s + ny * o)
            d.polygon([M(P(s0, -t / 2)), M(P(s1, -t / 2)), M(P(s1, t / 2)), M(P(s0, t / 2))], fill=2)
    for pc in pieces:
        d.polygon([M(p) for p in pc['pts']], fill=1)
    ext = Image.new('L', (W, H), 0)
    de = ImageDraw.Draw(ext)
    for r in scene.regions:
        if r['role'] in EXTERNAL_ROLES:
            de.polygon([M(p) for p in r['pts']], fill=1)
    dim = Image.new('L', (W, H), 0)
    dd = ImageDraw.Draw(dim)
    for l in dimg:
        pts = [M(p) for p in l['pts']]
        dd.line(pts, fill=1, width=5)
    txt = Image.new('L', (W, H), 0)
    dt = ImageDraw.Draw(txt)
    for t in scene.texts:
        x, y = M(t['pos'])
        size = t['size'] * st['pxPerM']
        w = size * 0.62 * len(t['s'])
        if t['vertical']:
            dt.rectangle([x - size, y - w / 2, x + size, y + w / 2], fill=1)
        else:
            dt.rectangle([x - w / 2, y - size, x + w / 2, y + size], fill=1)
    return np.array(lab), np.array(ext), np.array(dim), np.array(txt)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--seed-base', type=int, default=70000)
    ap.add_argument('--seeds', type=int, default=6)
    ap.add_argument('--families', default='all')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    fams = list(vrgen.FAMILIES) if a.families == 'all' else a.families.split(',')
    index = []
    for fi, fam in enumerate(fams):
        for k in range(a.seeds):
            seed = a.seed_base + 1000 * fi + k
            style = vrgen.sample_style(random.Random(seed * 7 + 1))
            for variant in ('A', 'B'):
                tf = random.Random(seed * 13 + (variant == 'B')).choice(vrgen.TRANSFORMS)
                rng = random.Random(seed)
                sc, _ = vrgen.FAMILIES[fam](rng, style, variant)
                sid = f'{fam}-{seed}-{variant}-{tf}'
                png = os.path.join(a.out, f'{sid}.png')
                info = vrgen.render(sc, tf, png)
                lab, ext, dim, txt = masks_for(sc, tf, info)
                np.savez_compressed(os.path.join(a.out, f'{sid}.npz'), label=lab, external=ext, dim=dim, text=txt)
                index.append({'id': sid, 'family': fam, 'seed': seed, 'variant': variant, 'transform': tf, 'size': info['size'], 'style': style})
    json.dump({'generator': 'vrgen ' + vrgen.GENERATOR_VERSION, 'seedBase': a.seed_base, 'seeds': a.seeds, 'items': index}, open(os.path.join(a.out, 'index.json'), 'w'))
    print(len(index), 'renders')


if __name__ == '__main__':
    main()
