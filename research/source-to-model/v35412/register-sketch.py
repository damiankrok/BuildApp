#!/usr/bin/env python3
"""v3.54.12 — register an OWNER sketch to its original elevation on BUILDING points (ground line ends, corners, ridge,
frame breaks, portal edges, big openings), never on the canvas size or a removed tree.

    /usr/bin/python3 -I research/source-to-model/v35412/register-sketch.py <points.json> <out dir> [--warp]
    /usr/bin/python3 -I research/source-to-model/v35412/register-sketch.py --self-test

points.json:
  {"original": "<image>", "sketch": "<image>", "mPerPxOriginal": <optional number: the original's scale, to state
   residuals in metres>, "pairs": [{"name": "ground-left", "o": [x, y], "s": [x, y], "kind": "ANCHOR"|"CHECK"}, …]}
ANCHOR pairs fit the transform; CHECK pairs (e.g. the garage door's left edge, the portal's end, the frame's inner
break) are only measured against it — their residual is what the sketch CHANGED, not a fitting error.

Fits, in pixels of the original: a similarity (uniform scale, rotation, translation — what a crop and resize can do)
and a full affine (adds anisotropy and shear — what a change of proportions does). Reports per pair the residual of
both, the scale, rotation, the affine's x/y scale ratio and shear, and whether the fit needs a reflection (a mirrored
sketch is a different house, not a crop). With --warp writes the sketch resampled into the original's frame by the
SIMILARITY only (no local deformation: differences stay visible), and an overlay: the original dimmed, the sketch's
dark contours in red on top. Nothing here edits the original or reads a model.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageChops, ImageFilter


def fit_similarity(src, dst, allow_reflection=False):
    """Umeyama: dst ≈ s·R·src + t. Returns (s, R, t, reflected)."""
    src = np.asarray(src, float)
    dst = np.asarray(dst, float)
    ms, md = src.mean(0), dst.mean(0)
    a, b = src - ms, dst - md
    cov = b.T @ a / len(src)
    u, d, vt = np.linalg.svd(cov)
    sgn = np.sign(np.linalg.det(u @ vt))
    reflected = sgn < 0
    e = np.diag([1.0, 1.0 if (allow_reflection or not reflected) else -1.0])
    r = u @ e @ vt
    var = (a ** 2).sum() / len(src)
    s = float(np.trace(np.diag(d) @ e) / var)
    t = md - s * r @ ms
    return s, r, t, bool(reflected)


def fit_affine(src, dst):
    src = np.asarray(src, float)
    dst = np.asarray(dst, float)
    a = np.hstack([src, np.ones((len(src), 1))])
    m, *_ = np.linalg.lstsq(a, dst, rcond=None)
    return m.T  # 2x3


def apply_sim(s, r, t, p):
    return (s * (r @ np.asarray(p, float).T)).T + t


def apply_aff(m, p):
    p = np.asarray(p, float)
    return (m[:, :2] @ p.T).T + m[:, 2]


def analyse(pairs, m_per_px=None):
    anchors = [q for q in pairs if q.get('kind', 'ANCHOR') == 'ANCHOR']
    if len(anchors) < 3:
        raise ValueError('at least three ANCHOR pairs on building points are needed')
    s_src = [q['s'] for q in anchors]
    o_dst = [q['o'] for q in anchors]
    s, r, t, reflected = fit_similarity(s_src, o_dst)
    s2, r2, t2, _ = fit_similarity(s_src, o_dst, allow_reflection=True)
    err_noref = np.linalg.norm(apply_sim(s, r, t, s_src) - np.asarray(o_dst), axis=1).mean()
    err_ref = np.linalg.norm(apply_sim(s2, r2, t2, s_src) - np.asarray(o_dst), axis=1).mean()
    mirrored = reflected and err_ref < 0.5 * err_noref
    aff = fit_affine(s_src, o_dst) if len(anchors) >= 3 else None
    # the affine's own axes: scale along x and y of the sketch and the shear
    a = aff[:, :2]
    sx, sy = np.linalg.norm(a[:, 0]), np.linalg.norm(a[:, 1])
    shear = float(np.dot(a[:, 0], a[:, 1]) / (sx * sy))
    rows = []
    for q in pairs:
        ps = apply_sim(s, r, t, [q['s']])[0]
        pa = apply_aff(aff, [q['s']])[0]
        rs = float(np.linalg.norm(ps - np.asarray(q['o'], float)))
        ra = float(np.linalg.norm(pa - np.asarray(q['o'], float)))
        row = {'name': q['name'], 'kind': q.get('kind', 'ANCHOR'), 'residualSimilarityPx': round(rs, 2), 'residualAffinePx': round(ra, 2),
               'dxSimilarityPx': round(float(ps[0] - q['o'][0]), 2), 'dySimilarityPx': round(float(ps[1] - q['o'][1]), 2)}
        if m_per_px:
            row['residualSimilarityM'] = round(rs * m_per_px, 3)
            row['dxSimilarityM'] = round(float(ps[0] - q['o'][0]) * m_per_px, 3)
        rows.append(row)
    rot = float(np.degrees(np.arctan2(r[1, 0], r[0, 0])))
    anis = float(sx / sy)
    verdict = 'MIRRORED' if mirrored else ('PROPORTIONS_CHANGED' if abs(anis - 1) > 0.03 or abs(shear) > 0.03 else 'CROP_AND_SCALE')
    return {
        'schema': 'buildapp.v35412-sketch-registration/1',
        'similarity': {'scale': round(s, 6), 'rotationDeg': round(rot, 3), 'tx': round(float(t[0]), 2), 'ty': round(float(t[1]), 2),
                       'meanAnchorResidualPx': round(float(err_noref), 2)},
        'affine': {'matrix': [[round(float(v), 6) for v in row] for row in aff], 'scaleX': round(float(sx), 6), 'scaleY': round(float(sy), 6),
                   'xyRatio': round(anis, 4), 'shearCos': round(shear, 4)},
        'reflectionNeeded': bool(mirrored), 'verdict': verdict,
        'note': 'the transform maps sketch pixels to original pixels; CHECK rows are what the sketch changed beyond a crop/resize',
        'pairs': rows,
    }, (s, r, t)


def warp(sketch, original_size, sim):
    s, r, t = sim
    # inverse: original pixel -> sketch pixel
    ri = r.T / s
    ti = -ri @ t
    coeffs = (ri[0, 0], ri[0, 1], ti[0], ri[1, 0], ri[1, 1], ti[1])
    return sketch.transform(original_size, Image.AFFINE, coeffs, resample=Image.BILINEAR, fillcolor=(255, 255, 255))


def overlay(original, warped):
    base = Image.blend(original.convert('RGB'), Image.new('RGB', original.size, (255, 255, 255)), 0.55)
    g = warped.convert('L')
    edges = g.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 60 else 0)
    red = Image.new('RGB', original.size, (220, 20, 20))
    return Image.composite(red, base, edges)


def self_test():
    rng = np.random.default_rng(7)
    pts = rng.uniform(50, 500, size=(8, 2))
    # a crop + uniform resize + small rotation: CROP_AND_SCALE, residuals ~0
    th = np.radians(1.5)
    R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
    sk = (0.8 * (R @ pts.T)).T + [30, -12]
    pairs = [{'name': f'p{i}', 'o': pts[i].tolist(), 's': sk[i].tolist()} for i in range(8)]
    rep, _ = analyse(pairs)
    assert rep['verdict'] == 'CROP_AND_SCALE' and rep['similarity']['meanAnchorResidualPx'] < 1e-6, rep['similarity']
    assert abs(rep['similarity']['scale'] - 1 / 0.8) < 1e-6
    # a mirrored sketch
    skm = sk.copy()
    skm[:, 0] = 900 - skm[:, 0]
    rep, _ = analyse([{'name': f'p{i}', 'o': pts[i].tolist(), 's': skm[i].tolist()} for i in range(8)])
    assert rep['verdict'] == 'MIRRORED' and rep['reflectionNeeded'], rep
    # proportions changed: the sketch is 10 % wider than tall relative to the original
    ska = sk.copy()
    ska[:, 0] *= 1.1
    rep, _ = analyse([{'name': f'p{i}', 'o': pts[i].tolist(), 's': ska[i].tolist()} for i in range(8)])
    assert rep['verdict'] == 'PROPORTIONS_CHANGED', rep['affine']
    # a CHECK point moved by the sketch (a door edge shifted) shows as its own residual, the anchors stay exact
    pairs2 = pairs + [{'name': 'door-left', 'kind': 'CHECK', 'o': [200.0, 300.0], 's': ((0.8 * (R @ np.array([212.0, 300.0]))) + [30, -12]).tolist()}]
    rep, _ = analyse(pairs2, m_per_px=0.017)
    door = next(x for x in rep['pairs'] if x['name'] == 'door-left')
    assert rep['verdict'] == 'CROP_AND_SCALE' and abs(door['dxSimilarityPx'] - 12) < 1e-6 and abs(door['dxSimilarityM'] - 0.204) < 1e-3, door
    # warp + overlay run on a synthetic picture
    img = Image.new('RGB', (300, 200), (255, 255, 255))
    img.paste((0, 0, 0), (100, 50, 200, 150))
    w = warp(img, (300, 200), (1.0, np.eye(2), np.array([0.0, 0.0])))
    assert ImageChops.difference(w, img).getbbox() is None
    overlay(img, w)
    print('self-test OK: crop/resize/rotation recovered exactly; mirror flagged; a 10 % proportion change flagged; a moved CHECK point measured in px and m; identity warp is lossless')


def main():
    if '--self-test' in sys.argv:
        self_test()
        return
    pts_p, out = sys.argv[1], sys.argv[2]
    spec = json.load(open(pts_p))
    os.makedirs(out, exist_ok=True)
    rep, sim = analyse(spec['pairs'], spec.get('mPerPxOriginal'))
    rep['original'] = spec['original']
    rep['sketch'] = spec['sketch']
    if '--warp' in sys.argv:
        o = Image.open(spec['original']).convert('RGB')
        sk = Image.open(spec['sketch']).convert('RGB')
        w = warp(sk, o.size, sim)
        name = os.path.splitext(os.path.basename(spec['sketch']))[0]
        w.save(os.path.join(out, f'{name}.registered-similarity.png'))
        overlay(o, w).save(os.path.join(out, f'{name}.overlay.png'))
        rep['warped'] = f'{name}.registered-similarity.png (similarity only; no local deformation)'
    json.dump(rep, open(os.path.join(out, 'registration.json'), 'w'), indent=1)
    print(f"{rep['verdict']}: scale {rep['similarity']['scale']}, rotation {rep['similarity']['rotationDeg']} deg, anchors mean residual {rep['similarity']['meanAnchorResidualPx']} px, affine x/y {rep['affine']['xyRatio']}, shear {rep['affine']['shearCos']}")
    for p in rep['pairs']:
        print(f"  {p['kind']:6s} {p['name']:24s} {p['residualSimilarityPx']:7.2f} px" + (f"  ({p.get('dxSimilarityM')} m along)" if 'dxSimilarityM' in p else ''))


if __name__ == '__main__':
    main()
