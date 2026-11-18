#!/usr/bin/env python3
"""v3.54.12 — which published picture is this? Pair an OWNER-supplied image (an original or a sketch) with the
source package's pictures by CONTENT, not by file name or order.

    /usr/bin/python3 -I research/source-to-model/v35412/match-picture.py <package.json> <cache dir> <image> [<image> …]
    /usr/bin/python3 -I research/source-to-model/v35412/match-picture.py --self-test

Each image is searched as a CROP of every candidate (scale and position, coarse grid: a screenshot is a crop) and
also compared whole;  (screenshot bars, a caption strip below a flat band is reported, not cut),
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


def crop_search(q, c, widths=(0.45, 0.55, 0.65, 0.75, 0.85, 1.0), cw=240):
    """the query as a crop of the candidate: the candidate at a fixed width, the query scaled so it spans a share of
    it, slid over a coarse grid; best normalised cross-correlation and where. A screenshot is a crop; a whole-picture
    thumbnail comparison is not crop-invariant."""
    cg = np.asarray(ImageOps.grayscale(c).resize((cw, max(8, round(c.height * cw / c.width))), Image.BILINEAR), float)
    best = (-1.0, None)
    for f in widths:
        qw = max(8, round(cw * f))
        qh = max(8, round(q.height * qw / q.width))
        if qh > cg.shape[0] + 2:
            continue
        qa = np.asarray(ImageOps.grayscale(q).resize((qw, qh), Image.BILINEAR), float)
        qa = qa - qa.mean()
        qn = np.linalg.norm(qa) or 1.0
        for y in range(0, max(1, cg.shape[0] - qh + 1), 3):
            for x in range(0, max(1, cw - qw + 1), 3):
                win = cg[y:y + qh, x:x + qw]
                if win.shape != qa.shape:
                    continue
                w = win - win.mean()
                v = float((w * qa).sum() / (qn * (np.linalg.norm(w) or 1.0)))
                if v > best[0]:
                    best = (v, (f, x / cw, y / cg.shape[0]))
    return best


def rank(img, cands):
    q, box = trim(img.convert('RGB'))
    tq = thumb(q)
    rows = []
    for aid, vid, h, p in cands:
        c, _ = trim(Image.open(p).convert('RGB'))
        tc = thumb(c)
        cs, where = crop_search(q, c)
        csf, _ = crop_search(ImageOps.mirror(q), c)
        rows.append({'asset': aid, 'variant': vid, 'hash': h, 'ncc': round(ncc(tq, tc), 4), 'nccFlipped': round(ncc(tq, thumb(ImageOps.mirror(c))), 4),
                     'cropNcc': round(cs, 4), 'cropNccMirrored': round(csf, 4), 'cropAt': where})
    rows.sort(key=lambda r: -r['cropNcc'])
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
        other = next((r for r in top[1:] if r['asset'] != top[0]['asset']), None)
        margin = top[0]['cropNcc'] - other['cropNcc'] if other else 1.0
        state = 'MATCH' if margin > 0.08 and top[0]['cropNcc'] > 0.6 else 'AMBIGUOUS'
        mirror = top[0]['cropNccMirrored'] > top[0]['cropNcc']
        res[os.path.basename(p)] = {'size': list(img.size), 'sha256': hashlib.sha256(open(p, 'rb').read()).hexdigest(), 'trimBox': box,
                                    'state': state, 'mirrorWarning': mirror, 'top': top}
        print(f"{os.path.basename(p)} {img.size} -> {state}{' MIRROR?' if mirror else ''}: " + '; '.join(f"{r['asset'][-30:]}/{r['variant'][:24]} crop {r['cropNcc']} (whole {r['ncc']})" for r in top[:3]) + (f"; margin to another asset {margin:.3f}" if other else ''))
    print(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()
