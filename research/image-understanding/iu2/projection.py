"""IU-02 geometry-first projection test: is this image one orthographic facade, a perspective, or neither?

The answer comes from line segments (LSD, OpenCV, Apache-2.0), not from style:

  * near-horizontal segments (|θ| < 20°) and near-vertical ones (|θ - 90°| < 20°), each with an angular
    uncertainty σθ = √2·σp / length (σp = 0.5 px endpoint precision) plus a floor σ0 for drawing imperfection;
  * under an orthographic elevation every near-horizontal edge is parallel to one direction φ (a scan may be rotated)
    and every near-vertical one to φ + 90°. Under a perspective the horizontals of a facade turned away from the
    image plane converge: their angle drifts with their height, θ ≈ a + b·(y − ȳ) (the linearisation of a vanishing
    point far to the side). A pitched camera makes the verticals drift with x the same way;
  * b is fitted by robust (Tukey) weighted least squares and judged two ways: its significance z = b / σb, and its
    effect, the *distortion bound* — how many pixels the drift would move an edge endpoint across the content
    (Δ = |b|·H/2·W). The bound is what matters for measurement: an image whose 95 % upper drift bound moves no
    endpoint by more than DISTORTION_PX_ORTHO is orthographic for every measurement taken from it;
  * several planes at once: long parallel oblique families that also occur in the lower half of the content (a
    corner view or an axonometric shows base edges at an angle; an elevation's only obliques are its roof slopes);
  * a multi-panel sheet (blank gutters splitting the content into blocks) is NOT_SINGLE_FACADE.

States: ORTHOGRAPHIC_SUPPORTED, PERSPECTIVE_EVIDENT, INCONCLUSIVE, NOT_SINGLE_FACADE. A vanishing point is evidence
of perspective; *no* vanishing point is not evidence of orthography — the state is ORTHOGRAPHIC_SUPPORTED only when
there are enough well-spread edges for the bound to be small. Constants are physical (pixels, degrees), fixed before
any evaluation; none is fitted to a publisher.
"""
import math
import numpy as np

SIGMA_P = 0.5            # px, segment endpoint precision of LSD on a clean edge
SIGMA_FLOOR_DEG = 0.08   # degrees: drawing / scanning imperfection floor per segment
NEAR_DEG = 20.0
MIN_LEN_FRAC = 0.025     # of the content's short side
MIN_SEGMENTS = 8         # per family, to call anything
MIN_SPREAD_FRAC = 0.35   # the family must span this share of the content's height (horizontals) / width (verticals)
Z_EVIDENT = 5.0
DISTORTION_PX_EVIDENT = 4.0
DISTORTION_PX_ORTHO = 2.0   # the IU-02 fidelity budget: median displacement <= 2 px
OBLIQUE_MIN_LEN_FRAC = 0.12
GUTTER_FRAC = 0.03
NONPARALLEL_MIN_DEG = 0.5
RADIAL_MIN_DIRECTIONS = 4
RADIAL_DISTINCT_DEG = 3.0
RADIAL_HINT_DIRECTIONS = 5
NONPARALLEL_MAX_SHARE = 0.10   # a terrain line may disagree; a tenth of the edge length may not


def _gray(img):
    if hasattr(img, 'convert'):
        return np.asarray(img.convert('L'), np.uint8)
    a = np.asarray(img, np.uint8)
    if a.ndim == 3:
        import cv2
        a = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY)
    return a


def content_box(gray, bg_thresh=245):
    ink = gray < bg_thresh
    ys, xs = np.nonzero(ink)
    if len(xs) < 50:
        return 0, 0, gray.shape[1], gray.shape[0]
    return int(np.percentile(xs, 0.5)), int(np.percentile(ys, 0.5)), int(np.percentile(xs, 99.5)) + 1, int(np.percentile(ys, 99.5)) + 1


def panels(gray, bg_tol=12):
    """Blocks separated by full-width / full-height uniform gutters (a sheet of several views)."""
    h, w = gray.shape
    g = gray.astype(np.int16)
    bg = int(np.median(np.concatenate([g[0], g[-1], g[:, 0], g[:, -1]])))
    flat = np.abs(g - bg) <= bg_tol
    def runs(profile, n, minrun):
        out, start = [], None
        for i, v in enumerate(profile):
            if not v and start is None:
                start = i
            if v and start is not None:
                out.append((start, i)); start = None
        if start is not None:
            out.append((start, n))
        return [r for r in out if r[1] - r[0] >= minrun]
    # a gutter is empty: at most one stray pixel per thousand (a single wall outline crossing the row is not empty)
    rows = flat.mean(axis=1) >= 0.999
    cols = flat.mean(axis=0) >= 0.999
    def split_ok(profile, n):
        # interior gutter at least GUTTER_FRAC wide, with content on both sides
        blocks = runs(profile, n, int(0.15 * n))
        if len(blocks) < 2:
            return 0
        gaps = [blocks[k + 1][0] - blocks[k][1] for k in range(len(blocks) - 1)]
        return len(blocks) if min(gaps) >= GUTTER_FRAC * n else 0
    return max(split_ok(rows, h), 1), max(split_ok(cols, w), 1)


def segments(gray, box):
    import cv2
    x0, y0, x1, y1 = box
    crop = gray[y0:y1, x0:x1]
    if crop.size == 0:
        return np.zeros((0, 4))
    lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
    found = lsd.detect(crop)[0]
    if found is None:
        return np.zeros((0, 4))
    s = found.reshape(-1, 4).astype(np.float64)
    s[:, [0, 2]] += x0
    s[:, [1, 3]] += y0
    return s


def _robust_line_fit(t, y, w, iters=8):
    """θ = a + b·(y − ȳ), Tukey-reweighted WLS. Returns a, b, σb, inlier weights, robust χ²/dof."""
    yc = y - np.average(y, weights=w)
    A = np.stack([np.ones_like(yc), yc], 1)
    rw = np.ones_like(t)
    a = b = 0.0
    cov = np.eye(2)
    for _ in range(iters):
        W = w * rw
        M = A.T @ (A * W[:, None])
        if np.linalg.cond(M) > 1e12:
            break
        cov = np.linalg.inv(M)
        a, b = cov @ (A.T @ (W * t))
        r = (t - a - b * yc) * np.sqrt(w)
        c = 4.685 * max(1.0, 1.4826 * np.median(np.abs(r)))
        rw = np.where(np.abs(r) < c, (1 - (r / c) ** 2) ** 2, 0.0)
    r = (t - a - b * yc) * np.sqrt(w)
    inl = rw > 0
    dof = max(1, inl.sum() - 2)
    chi = float(np.sum((r[inl]) ** 2) / dof)
    # Sandwich (heteroscedasticity-consistent) error of the drift: from the residuals themselves, so a crisp CAD
    # drawing is not held to a scanner's noise and a noisy scan is not credited with a CAD's precision. Floor: the
    # model-based error with a 0.01° per-segment floor (no estimate is tighter than LSD's sub-pixel limit).
    W = w * rw
    res = t - a - b * yc
    Sxx = np.sum(W * yc ** 2)
    n_in = max(3, int(inl.sum()))
    sb_hc = math.sqrt(np.sum((W * res * yc) ** 2) / max(Sxx ** 2, 1e-30) * n_in / (n_in - 2))
    sb_floor = math.sqrt(1.0 / max(np.sum(rw * yc ** 2 / 0.01 ** 2), 1e-30))
    sb = max(sb_hc, sb_floor)
    return float(a), float(b), float(sb), rw, chi


def _family(s, kind):
    dx, dy = s[:, 2] - s[:, 0], s[:, 3] - s[:, 1]
    L = np.hypot(dx, dy)
    th = np.degrees(np.arctan2(dy, dx))
    th = (th + 90) % 180 - 90  # (-90, 90]
    if kind == 'H':
        sel = np.abs(th) < NEAR_DEG
        ang = th
    else:
        sel = np.abs(np.abs(th) - 90) < NEAR_DEG
        ang = np.where(th < 0, th + 180, th) - 90  # deviation from vertical
    mx, my = (s[:, 0] + s[:, 2]) / 2, (s[:, 1] + s[:, 3]) / 2
    sig = np.degrees(math.sqrt(2) * SIGMA_P / np.maximum(L, 1))
    sig = np.sqrt(sig ** 2 + SIGMA_FLOOR_DEG ** 2)
    return {'ang': ang[sel], 'L': L[sel], 'x': mx[sel], 'y': my[sel], 'sig': sig[sel]}


def drift(fam, coord, extent_along, extent_across):
    """Fit angle drift along `coord` (y for horizontals, x for verticals); return test numbers."""
    n = len(fam['ang'])
    if n < MIN_SEGMENTS:
        return {'n': int(n), 'enough': False}
    c = fam[coord]
    spread = float(np.percentile(c, 95) - np.percentile(c, 5))
    w = 1.0 / fam['sig'] ** 2
    a, b, sb, rw, chi = _robust_line_fit(fam['ang'], c, w)
    b_rad, sb_rad = math.radians(b), math.radians(sb)
    # endpoint displacement over the content: angle change across the family's span × the content's length
    dist = abs(b_rad) * spread * extent_across
    dist_hi = (abs(b_rad) + 1.96 * sb_rad) * max(spread, MIN_SPREAD_FRAC * extent_along) * extent_across
    return {'n': int(n), 'inliers': int((rw > 0).sum()), 'enough': bool(spread >= MIN_SPREAD_FRAC * extent_along),
            'spreadPx': round(spread, 1), 'directionDeg': round(a, 4), 'driftDegPerKpx': round(b * 1000, 5),
            'z': round(abs(b) / max(sb, 1e-12), 2), 'distortionPx': round(dist, 2), 'distortionPx95': round(dist_hi, 2),
            'chi2dof': round(chi, 2)}


def nonparallel(fam, direction, box):
    """Long near-horizontal (or near-vertical) segments that disagree with the family's fitted direction by more
    than their own uncertainty allows: a converging subset hidden among parallel horizon lines, a sloped terrain
    line, a low-pitched roof. Their share of the family's length decides whether orthography can be supported."""
    if not len(fam['ang']) or direction is None:
        return {'share': 0.0, 'n': 0}
    dev = np.abs(fam['ang'] - direction)
    longish = fam['L'] >= 0.05 * min(box[2] - box[0], box[3] - box[1])
    off = longish & (dev > np.maximum(NONPARALLEL_MIN_DEG, 5 * fam['sig']))
    return {'share': round(float(fam['L'][off].sum() / max(fam['L'].sum(), 1e-6)), 3), 'n': int(off.sum()),
            'maxDeg': round(float(dev[off].max()), 2) if off.any() else 0.0}


def radial_vp(s, box, max_pairs=4000, seed=0):
    """One-point perspective: oblique segments of several *different* directions whose extensions meet in one point
    outside them (a frontal room's floor/ceiling/wall edges, a frontal street view). Roof slopes do not qualify: a
    gable is two parallel families, which meet pairwise all over the image, never ≥ RADIAL_MIN_DIRECTIONS
    directions in one point. Returns the best point's support (distinct directions within the angular tolerance)."""
    x0, y0, x1, y1 = box
    m = min(x1 - x0, y1 - y0)
    dx, dy = s[:, 2] - s[:, 0], s[:, 3] - s[:, 1]
    L = np.hypot(dx, dy)
    th = (np.degrees(np.arctan2(dy, dx)) + 90) % 180 - 90
    obl = (np.abs(th) > NEAR_DEG) & (np.abs(np.abs(th) - 90) > NEAR_DEG) & (L > 0.06 * m)
    S, T, LL = s[obl], th[obl], L[obl]
    if len(S) < RADIAL_MIN_DIRECTIONS:
        return {'support': 0}
    rng = np.random.default_rng(seed)
    P1 = np.stack([S[:, 0], S[:, 1], np.ones(len(S))], 1)
    P2 = np.stack([S[:, 2], S[:, 3], np.ones(len(S))], 1)
    lines = np.cross(P1, P2)
    mid = np.stack([(S[:, 0] + S[:, 2]) / 2, (S[:, 1] + S[:, 3]) / 2], 1)
    sig = np.degrees(math.sqrt(2) * SIGMA_P / np.maximum(LL, 1))
    tol = np.maximum(0.75, 3 * sig)
    best = {'support': 0}
    n = len(S)
    pairs = [(i, j) for i in range(n) for j in range(i + 1, n) if abs(T[i] - T[j]) > RADIAL_DISTINCT_DEG]
    if len(pairs) > max_pairs:
        pairs = [pairs[k] for k in rng.choice(len(pairs), max_pairs, replace=False)]
    for i, j in pairs:
        v = np.cross(lines[i], lines[j])
        if abs(v[2]) < 1e-9:
            continue
        vx, vy = v[0] / v[2], v[1] / v[2]
        if not (x0 - 0.5 * (x1 - x0) <= vx <= x1 + 0.5 * (x1 - x0) and y0 - 0.5 * (y1 - y0) <= vy <= y1 + 0.5 * (y1 - y0)):
            continue  # a frontal one-point VP lies in or near the picture; a far one is the near-frontal case above
        ang_to = np.degrees(np.arctan2(mid[:, 1] - vy, mid[:, 0] - vx))
        res = np.abs(((T - ang_to) + 90) % 180 - 90)
        dist_vp = np.hypot(mid[:, 0] - vx, mid[:, 1] - vy)
        ok = (res <= tol) & (dist_vp > 0.5 * LL + 2)  # the point lies beyond the segment, not on it
        if ok.sum() < RADIAL_MIN_DIRECTIONS:
            continue
        dirs = np.unique(np.round(T[ok] / RADIAL_DISTINCT_DEG))
        quad = len({(int(np.sign(mid[k, 0] - vx)), int(np.sign(mid[k, 1] - vy))) for k in np.nonzero(ok)[0]})
        sup = len(dirs)
        if sup > best['support'] or (sup == best['support'] and quad > best.get('quadrants', 0)):
            best = {'support': int(sup), 'segments': int(ok.sum()), 'quadrants': int(quad), 'point': [round(float(vx), 1), round(float(vy), 1)]}
    return best


def oblique_planes(s, box):
    """Long parallel oblique families present in the lower half of the content: base edges at an angle."""
    x0, y0, x1, y1 = box
    H = y1 - y0
    dx, dy = s[:, 2] - s[:, 0], s[:, 3] - s[:, 1]
    L = np.hypot(dx, dy)
    th = (np.degrees(np.arctan2(dy, dx)) + 90) % 180 - 90
    obl = (np.abs(th) > NEAR_DEG) & (np.abs(np.abs(th) - 90) > NEAR_DEG) & (L > OBLIQUE_MIN_LEN_FRAC * min(H, x1 - x0))
    lower = np.maximum(s[:, 1], s[:, 3]) > y0 + 0.8 * H  # reaches the bottom fifth: a base edge, not a roof slope
    lowsel = obl & lower
    total = float(L[(np.abs(th) < NEAR_DEG) & lower].sum()) + 1e-6
    return {'obliqueLowerLenPx': round(float(L[lowsel].sum()), 1), 'horizontalLowerLenPx': round(total, 1),
            'obliqueLowerShare': round(float(L[lowsel].sum()) / (float(L[lowsel].sum()) + total), 3), 'nObliqueLower': int(lowsel.sum())}


def analyse(img, mask=None):
    """Projection evidence for one image (PIL or HxW uint8). `mask` (bool HxW) restricts segments to the building."""
    gray = _gray(img)
    h, w = gray.shape
    scale = 1.0
    if max(h, w) > 1600:
        import cv2
        scale = 1600 / max(h, w)
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        if mask is not None:
            mask = cv2.resize(mask.astype(np.uint8), (gray.shape[1], gray.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
        h, w = gray.shape
    rows, cols = panels(gray)
    out = {'size': [w, h], 'analysisScale': round(scale, 4), 'panels': [rows, cols]}
    if rows * cols > 1:
        out.update(state='NOT_SINGLE_FACADE', why=f'{rows}×{cols} panels separated by blank gutters')
        return out
    if mask is not None and mask.any():
        ys, xs = np.nonzero(mask)
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    else:
        box = content_box(gray)
    s = segments(gray, box)
    bw, bh = box[2] - box[0], box[3] - box[1]
    if len(s):
        L = np.hypot(s[:, 2] - s[:, 0], s[:, 3] - s[:, 1])
        s = s[L >= max(12.0, MIN_LEN_FRAC * min(bw, bh))]
    if mask is not None and len(s):
        import cv2
        dil = cv2.dilate(mask.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        mx = np.clip(((s[:, 0] + s[:, 2]) / 2).astype(int), 0, w - 1); my = np.clip(((s[:, 1] + s[:, 3]) / 2).astype(int), 0, h - 1)
        s = s[dil[my, mx]]
    fh, fv = _family(s, 'H'), _family(s, 'V')
    hz = drift(fh, 'y', bh, bw)
    vt = drift(fv, 'x', bw, bh)
    ob = oblique_planes(s, box) if len(s) else {'obliqueLowerShare': 0.0, 'nObliqueLower': 0}
    out.update(box=list(box), segments=int(len(s)), horizontals=hz, verticals=vt, planes=ob)
    if hz.get('n', 0) and hz.get('enough') and 'directionDeg' in vt:
        out['skewDeg'] = round(hz['directionDeg'] - vt['directionDeg'], 4)
    evident = []
    for nm, f in (('horizontals converge', hz), ('verticals converge', vt)):
        if f.get('enough') and f['z'] >= Z_EVIDENT and f['distortionPx'] >= DISTORTION_PX_EVIDENT:
            evident.append(f"{nm} (z {f['z']}, {f['distortionPx']} px)")
    rv = radial_vp(s, box) if len(s) else {'support': 0}
    out['radial'] = rv
    if rv['support'] >= RADIAL_MIN_DIRECTIONS and rv.get('quadrants', 0) >= 4:
        evident.append(f"one-point convergence: {rv['support']} directions in all four quadrants meet at {rv['point']}")
    if ob['nObliqueLower'] >= 2 and ob['obliqueLowerShare'] >= 0.35:
        evident.append(f"oblique base edges ({ob['nObliqueLower']} long segments, {ob['obliqueLowerShare']:.0%} of the lower edge length)")
    if evident:
        out.update(state='PERSPECTIVE_EVIDENT', why='; '.join(evident))
        return out
    if not (hz.get('enough') and vt.get('enough')):
        out.update(state='INCONCLUSIVE', why=f"too few well-spread edges (horizontals {hz.get('n', 0)}, verticals {vt.get('n', 0)})")
        return out
    if rv['support'] >= RADIAL_HINT_DIRECTIONS and rv.get('quadrants', 0) >= 3:
        out.update(state='INCONCLUSIVE', why=f"{rv['support']} oblique directions in {rv['quadrants']} quadrants meet at {rv['point']}: possibly a one-point perspective")
        return out
    nph, npv = nonparallel(fh, hz.get('directionDeg'), box), nonparallel(fv, vt.get('directionDeg'), box)
    out['nonParallel'] = {'horizontals': nph, 'verticals': npv}
    if max(nph['share'], npv['share']) > NONPARALLEL_MAX_SHARE:
        out.update(state='INCONCLUSIVE', why=f"{max(nph['share'], npv['share']):.0%} of the near-horizontal/vertical edge length is not parallel to the rest")
        return out
    if hz['distortionPx95'] <= DISTORTION_PX_ORTHO and vt['distortionPx95'] <= DISTORTION_PX_ORTHO and abs(out.get('skewDeg', 0)) <= 0.5:
        out.update(state='ORTHOGRAPHIC_SUPPORTED', why=f"parallel within {max(hz['distortionPx95'], vt['distortionPx95'])} px (95 %) over the content")
        return out
    out.update(state='INCONCLUSIVE', why=f"no evident vanishing point, but the bound is {max(hz['distortionPx95'], vt['distortionPx95'])} px")
    return out
