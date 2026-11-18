#!/usr/bin/env python3
"""v3.54.12 — which published picture is this? Pair an OWNER-supplied image (an original or a sketch) with the
source package's pictures by CONTENT, not by file name or order.

    /usr/bin/python3 -I research/source-to-model/v35412/match-picture.py <package.json> <cache dir> <image> [<image> …]
    /usr/bin/python3 -I research/source-to-model/v35412/match-picture.py --self-test

Each image is trimmed of uniform borders (screenshot bars, a caption strip below a flat band is reported, not cut),
then compared with every ELEVATION / PERSPECTIVE_RENDER variant of the package: grey thumbnails at a common size
(normalised cross-correlation) and the left-right flipped candidate too (a high flipped score is a mirror warning).
Prints the ranking with the margin to the second; a small margin is reported as AMBIGUOUS, never decided. The
registration on building points (register-sketch.py) is the proof; this only proposes the pair.
"""
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image, ImageOps

THUMB = (128, 64)


def trim(im, tol=12):
    g = np.asarray(im.convert('L'), float)
    h, w = g.shape
    def flat_row(r):
        return g[r].std() < tol / 3
    def flat_col(c):
        return g[:, c].std() < tol / 3
    top, bot, lef, rig = 0, h, 0, w
    while top < bot - 8 and flat_row(top):
        top += 1
    while bot - 1 > top + 8 and flat_row(bot - 1):
        bot -= 1
    while lef < rig - 8 and flat_col(lef):
        lef += 1
    while rig - 1 > lef + 8 and flat_col(rig - 1):
        rig -= 1
    return im.crop((lef, top, rig, bot)), (lef, top, rig, bot)


def thumb(im):
    g = ImageOps.grayscale(im).resize(THUMB, Image.BILINEAR)
    a = np.asarray(g, float)
    a -= a.mean()
    n = np.linalg.norm(a)
    return a / n if n else a


def ncc(a, b):
    return float((a * b).sum())


def candidates(pkg, cache_dir):
    sys.path.insert(0, '')
    out = []
    byhash = {}
    for f in os.listdir(cache_dir):
        if f.endswith('.bin'):
            p = os.path.join(cache_dir, f)
            byhash[hashlib.sha256(open(p, 'rb').read()).hexdigest()] = p
    for a in pkg['assets']:
        if a['roles']['document'] not in ('ELEVATION', 'PERSPECTIVE_RENDER'):
            continue
        for v in a['variants']:
            p = byhash.get(v['byteHash'])
            if p:
                out.append((a['id'], v['id'], v['byteHash'], p))
    return out


def rank(img, cands):
    q, box = trim(img.convert('RGB'))
    tq = thumb(q)
    rows = []
    for aid, vid, h, p in cands:
        c, _ = trim(Image.open(p).convert('RGB'))
        tc = thumb(c)
        rows.append({'asset': aid, 'variant': vid, 'hash': h, 'ncc': round(ncc(tq, tc), 4), 'nccFlipped': round(ncc(tq, thumb(ImageOps.mirror(c))), 4)})
    rows.sort(key=lambda r: -r['ncc'])
    return rows, box


def self_test():
    rng = np.random.default_rng(3)
    base = Image.fromarray((rng.uniform(0, 255, (60, 120, 3))).astype('uint8')).resize((480, 240), Image.NEAREST)
    other = Image.fromarray((rng.uniform(0, 255, (60, 120, 3))).astype('uint8')).resize((480, 240), Image.NEAREST)
    shot = Image.new('RGB', (520, 330), (0, 0, 0))
    shot.paste(base.resize((500, 250)), (10, 40))
    tq, _ = trim(shot)
    t1, t2 = thumb(base), thumb(other)
    a, b = ncc(thumb(tq), t1), ncc(thumb(tq), t2)
    assert a > 0.9 and b < 0.3, (a, b)
    assert ncc(thumb(ImageOps.mirror(tq)), t1) < 0.5
    print(f'self-test OK: a screenshot with bars matches its picture ({a:.3f}) and not another ({b:.3f}); the mirror does not match')


def main():
    if '--self-test' in sys.argv:
        self_test()
        return
    pkg = json.load(open(sys.argv[1]))
    cands = candidates(pkg, sys.argv[2])
    res = {}
    for p in sys.argv[3:]:
        img = Image.open(p)
        rows, box = rank(img, cands)
        top = rows[:5]
        margin = top[0]['ncc'] - top[1]['ncc'] if len(top) > 1 else 1.0
        same_asset = len(top) > 1 and top[0]['asset'] == top[1]['asset']
        state = 'MATCH' if (margin > 0.08 or same_asset) and top[0]['ncc'] > 0.5 else 'AMBIGUOUS'
        mirror = top[0]['nccFlipped'] > top[0]['ncc']
        res[os.path.basename(p)] = {'size': list(img.size), 'sha256': hashlib.sha256(open(p, 'rb').read()).hexdigest(), 'trimBox': box,
                                    'state': state, 'mirrorWarning': mirror, 'top': top}
        print(f"{os.path.basename(p)} {img.size} -> {state}{' MIRROR?' if mirror else ''}: " + '; '.join(f"{r['asset'][-30:]}/{r['variant'][:24]} {r['ncc']}" for r in top[:3]))
    print(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()
