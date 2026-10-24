"""IU-02 clean facade: a deterministic simplification of one orthographic elevation, for measurement, not for looks.

Same pixel grid as the input (no crop, no warp, no resampling): `transform.json` is the identity plus the source's
identity (sha256, size, EXIF orientation), so every cleaned pixel (x, y) is the source pixel (x, y). What changes
is only colour:

  background  everything outside the building (sky, lawn, trees beside the house, paper) -> white;
  materials   the building's pixels are smoothed edge-preservingly and quantised into a few material colours in
              Lab; shading is removed by giving each material region the colour of its brighter quartile
              (a shadow under the eaves is the same plaster, darker);
  glazing     window/door glass (semantic 'windowpane'/'door' where a segmenter gives it, else dark/cool compact
              regions) -> one light uniform glass tone; a reflection inside the glass is glass, not a tree;
  edges       material boundaries and long straight segments (LSD) inside the building, drawn crisp and dark;
  uncertain   occluders (trees, cars, people in front of the house) are NOT painted over with invented wall:
              they are filled with a neutral hatch-free grey and listed in `uncertainty-mask.png`.

Nothing is generated: a hidden window stays hidden (and uncertain), a watermark stays where it is.
"""
import json
import numpy as np

GLASS_RGB = (198, 214, 226)
UNCERTAIN_RGB = (214, 214, 214)
EDGE_RGB = (40, 40, 40)
GLASS_MAX_SHARE = 0.15
MIN_PART_SHARE = 0.05
GROUND_TOL = 0.10
SEM_COLORS = {'BACKGROUND': (255, 255, 255), 'WALL': (230, 200, 160), 'ROOF': (150, 80, 70), 'OPENING': (90, 150, 230),
              'OCCLUDER': (60, 170, 60), 'DOOR': (240, 150, 40), 'UNCERTAIN': (255, 0, 255), 'CHIMNEY': (120, 60, 140)}


def _lab(rgb):
    import cv2
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)


def building_support(seg):
    """Building plus everything it encloses (glass reflecting a tree is inside the outline, so it is building).
    Only the main body and components at least MIN_PART_SHARE of it are kept (a logo strip is not a building)."""
    import cv2
    from .seg import _fill_holes
    b = seg['building'].copy()
    n, lab, st, _ = cv2.connectedComponentsWithStats(b.astype(np.uint8), 8)
    if n > 2:
        big = st[1:, cv2.CC_STAT_AREA].max()
        keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= MIN_PART_SHARE * big
        b = keep[lab]
    filled = _fill_holes(b)
    enclosed_occ = filled & ~b & seg['occluder']
    return filled, enclosed_occ


def foreign(rgb, filled, k=8, cover=0.8, seed=0):
    """Pixels of the building that belong to none of its dominant materials (the clusters that together cover
    `cover` of it, each at least 4 %): reflections of sky and trees, dark interiors behind glass, frames."""
    import cv2
    idx = np.flatnonzero(filled.reshape(-1))
    if len(idx) < 500:
        return np.zeros(filled.shape, bool)
    lab = _lab(cv2.GaussianBlur(rgb, (5, 5), 0)).reshape(-1, 3).astype(np.float32)[idx]
    sample = lab if len(lab) < 60000 else lab[np.random.default_rng(seed).choice(len(lab), 60000, replace=False)]
    cv2.setRNGSeed(seed)
    _, _, C = cv2.kmeans(sample, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    d = ((lab[:, None, :] - C[None]) ** 2).sum(-1)
    a = d.argmin(1)
    share = np.bincount(a, minlength=k) / len(a)
    order = np.argsort(-share)
    dom, acc = [], 0.0
    for c in order:
        if acc >= cover or share[c] < 0.04:
            break
        dom.append(c); acc += share[c]
    f = np.zeros(filled.size, bool)
    f[idx] = ~np.isin(a, dom)
    return f.reshape(filled.shape)


def glazing(rgb, filled, seg_openings=None):
    """Glass: compact regions that are darker or cooler than the wall around them, or a segmenter's window/door.
    Returns a mask; compactness (area / bounding-box area ≥ 0.6) keeps a dark roof or a shadow band out."""
    import cv2
    lab = _lab(rgb).astype(np.int16)
    L, A, B = lab[..., 0], lab[..., 1] - 128, lab[..., 2] - 128
    wallL = np.median(L[filled]) if filled.any() else 128
    cool = (B < -4) | ((L < wallL - 45) & (np.abs(A) < 12) & (np.abs(B) < 14))
    cand = (cool | foreign(rgb, filled)) & filled
    if seg_openings is not None:
        cand |= seg_openings & filled
    # outlines and frames are thin and foreign to every material: opened away first, or they join every
    # window, door and roof edge into one region; closing then re-joins panes split by a mullion
    H0, W0 = filled.shape
    ko = max(3, int(round(0.004 * max(H0, W0))) | 1)
    cand = cv2.morphologyEx(cand.astype(np.uint8), cv2.MORPH_OPEN, np.ones((ko, ko), np.uint8))
    cand = cv2.morphologyEx(cand, cv2.MORPH_CLOSE, np.ones((ko + 2, ko + 2), np.uint8))
    n, lab_, st, _ = cv2.connectedComponentsWithStats(cand, 8)
    out = np.zeros(filled.shape, bool)
    H, W = filled.shape
    barea = max(1, int(filled.sum()))
    top = np.where(filled.any(0), np.argmax(filled, 0), H)
    for k in range(1, n):
        x, y, w, h, a = st[k]
        if a < 0.0002 * H * W or w < 6 or h < 6:
            continue
        comp = _fill(lab_ == k)
        if comp.sum() / float(w * h) < 0.6:
            continue
        if w > 0.6 * W and h < 0.08 * H:  # a long thin dark band (fascia, plinth) is not a window
            continue
        if comp.sum() > GLASS_MAX_SHARE * barea:  # a whole roof or wall face is not one pane
            continue
        cols = np.arange(x, x + w)
        if np.any(np.abs(y - top[cols]) <= 2):  # touches the building's top outline: roof edge, not a window
            continue
        out |= comp
    return out


def _fill(m):
    from .seg import _fill_holes
    return _fill_holes(m)


def materials(rgb, region, k=6, seed=0):
    """Edge-preserving smoothing, then k-means in Lab over the region; each connected region of a cluster takes the
    colour of its brighter quartile (shading removed, hue kept)."""
    import cv2
    sm = rgb.copy()
    for _ in range(2):
        sm = cv2.bilateralFilter(sm, 9, 40, 9)
    lab = _lab(sm).reshape(-1, 3).astype(np.float32)
    idx = np.flatnonzero(region.reshape(-1))
    if len(idx) < k * 20:
        return sm, np.zeros(region.shape, np.int32)
    # shading: cluster on chroma with a coarse lightness, so a shadowed plaster joins the lit plaster
    feat = lab[idx].copy()
    feat[:, 0] *= 0.35
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
    cv2.setRNGSeed(seed)
    sample = feat if len(feat) < 60000 else feat[np.random.default_rng(seed).choice(len(feat), 60000, replace=False)]
    _, _, centres = cv2.kmeans(sample, k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    d = ((feat[:, None, :] - centres[None]) ** 2).sum(-1)
    lab_k = d.argmin(1)
    labels = np.full(region.size, -1, np.int32)
    labels[idx] = lab_k
    labels = labels.reshape(region.shape)
    out = sm.copy()
    flat = rgb.reshape(-1, 3)
    for c in range(k):
        m = labels == c
        n, comp = cv2.connectedComponents(m.astype(np.uint8), 8)
        for j in range(1, n):
            mm = comp == j
            px = sm[mm]
            if len(px) < 30:
                continue
            Lm = _lab(px[None])[0][:, 0]
            bright = px[Lm >= np.percentile(Lm, 75)]
            out[mm] = np.median(bright, axis=0).astype(np.uint8)
    return out, labels


def edges(rgb, filled, labels, glass):
    """Boundaries between material regions, glass and background, plus long straight segments found on the
    *quantised* image (so tile courses and plaster texture, which quantisation removes, do not become edges)."""
    import cv2
    H, W = filled.shape
    e = np.zeros((H, W), bool)
    lb = labels.copy(); lb[glass] = 999; lb[~filled] = -2
    e[:, 1:] |= lb[:, 1:] != lb[:, :-1]
    e[1:, :] |= lb[1:, :] != lb[:-1, :]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
    segs = lsd.detect(gray)[0]
    if segs is not None:
        canvas = np.zeros((H, W), np.uint8)
        for x0, y0, x1, y1 in segs.reshape(-1, 4):
            if np.hypot(x1 - x0, y1 - y0) < 0.03 * min(H, W):
                continue
            mx, my = int((x0 + x1) / 2), int((y0 + y1) / 2)
            if 0 <= my < H and 0 <= mx < W and filled[my, mx]:
                cv2.line(canvas, (int(round(x0)), int(round(y0))), (int(round(x1)), int(round(y1))), 1, 1, cv2.LINE_8)
        e |= canvas > 0
    # the small speckle of quantisation boundaries is not an architectural edge
    n, comp, st, _ = cv2.connectedComponentsWithStats(e.astype(np.uint8), 8)
    keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= max(12, 0.01 * min(H, W))
    return keep[comp] & filled


def roof_and_chimney(filled, labels, glass):
    """Roof: the material cluster that owns most of the building's top outline. Chimney: a narrow column of the
    building rising clearly above its neighbours' top."""
    H, W = filled.shape
    cols = np.flatnonzero(filled.any(0))
    if not len(cols):
        return np.zeros_like(filled), np.zeros_like(filled)
    top = np.array([np.argmax(filled[:, c]) if filled[:, c].any() else H for c in range(W)])
    owners = [labels[top[c] + 2, c] for c in cols if top[c] + 2 < H and labels[top[c] + 2, c] >= 0]
    roof = np.zeros_like(filled)
    if owners:
        vals, cnt = np.unique(owners, return_counts=True)
        rc = vals[cnt.argmax()]
        roof = (labels == rc) & filled & ~glass
    chim = np.zeros_like(filled)
    if len(cols) > 10:
        t = top[cols].astype(float)
        from scipy.ndimage import median_filter
        base = median_filter(t, size=max(9, len(cols) // 8), mode='nearest')
        rise = base - t
        run = rise > 0.04 * H
        if run.any() and run.sum() < 0.12 * len(cols):
            for c, r in zip(cols, run):
                if r:
                    chim[top[c]:int(base[cols.tolist().index(c)]), c] = True
    return roof & ~chim, chim


def enclosed_openings(rgb, filled):
    """Line drawings: an opening is a cell enclosed by strokes — rectangular (fills ≥ 85 % of its box), of an
    opening's size, and not touching the building's outline. Mullions are thin, so adjacent panes are rejoined."""
    import cv2
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    stroke = g < 160
    H, W = filled.shape
    inner = cv2.erode(filled.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    free = (~stroke) & inner
    n, lab, st, _ = cv2.connectedComponentsWithStats(free.astype(np.uint8), 4)
    ys, xs = np.nonzero(filled)
    bh, bw = np.ptp(ys) + 1, np.ptp(xs) + 1
    barea = filled.sum()
    out = np.zeros_like(filled)
    for k in range(1, n):
        x, y, w, h, a = st[k]
        if a < 0.001 * barea or a > 0.08 * barea or h < 0.03 * bh or w < 0.02 * bw:
            continue
        if a / float(w * h) < 0.85:
            continue
        out |= lab == k
    k2 = max(3, int(round(0.004 * max(H, W))) | 1)
    return cv2.morphologyEx(out.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((k2 + 2, k2 + 2), np.uint8)) > 0


def split_openings(rgb, filled, comps):
    """An opening that reaches the building's ground line and is not glass-toned is a door or a gate (opaque);
    the rest is glazing. Returns (glass mask, door/gate mask)."""
    import cv2
    lab = _lab(rgb).astype(np.int16)
    H, W = filled.shape
    bottom = np.where(filled.any(0), H - 1 - np.argmax(filled[::-1], 0), -1)
    bh = max(1, int(filled.any(1).sum()))
    glass = np.zeros_like(filled); door = np.zeros_like(filled)
    n, lab_, st, _ = cv2.connectedComponentsWithStats(comps.astype(np.uint8), 8)
    for k in range(1, n):
        x, y, w, h, a = st[k]
        m = lab_ == k
        cols = np.arange(x, x + w)
        grounded = np.median(bottom[cols]) - (y + h - 1) <= GROUND_TOL * bh  # a step or plinth below a door
        Lm, bm = np.median(lab[..., 0][m]), np.median(lab[..., 2][m]) - 128
        glassy = bm < -4 or (Lm < 70 and abs(np.median(lab[..., 1][m]) - 128) < 10 and abs(bm) < 10)
        if grounded and not glassy:
            door |= m
        else:
            glass |= m
    return glass, door


def clean(rgb, seg_result, projection_state, source_meta, ground_line=False):
    """Returns dict of arrays (clean, edges, semantic, uncertainty) and the transform/metadata JSON."""
    import cv2
    filled, enclosed_occ = building_support(seg_result)
    occ = seg_result['occluder'] & ~filled
    # vegetation enclosed by the outline is a reflection only where it lies inside a glazing candidate; anywhere
    # else it is something in front of the wall, and what it hides stays unknown
    cand = glazing(rgb, filled, seg_result.get('openings'))
    reflect = np.zeros_like(filled)
    if enclosed_occ.any():
        n, lab_, st, _ = cv2.connectedComponentsWithStats(enclosed_occ.astype(np.uint8), 8)
        cn, clab, cst, _ = cv2.connectedComponentsWithStats(cand.astype(np.uint8), 8)
        for k in range(1, n):
            x, y, w, h, a = st[k]
            for j in range(1, cn):
                X, Y, Wd, Hd, _a = cst[j]
                ix = max(0, min(x + w, X + Wd) - max(x, X)); iy = max(0, min(y + h, Y + Hd) - max(y, Y))
                if ix * iy >= 0.8 * w * h:
                    reflect |= lab_ == k
                    break
    occ_all = seg_result['occluder'] & ~reflect
    occ_front = occ_all & filled
    openings = glazing(rgb, filled & ~occ_all, seg_result.get('openings'))
    if seg_result.get('kind') == 'DRAWING':
        openings |= enclosed_openings(rgb, filled)
    glass, door = split_openings(rgb, filled, openings)
    enclosed_occ = reflect
    sm, labels = materials(rgb, filled & ~glass & ~occ_all)
    labels[door] = 998
    out = np.full(rgb.shape, 255, np.uint8)
    out[filled] = sm[filled]
    out[glass] = GLASS_RGB
    unc = occ_front | (seg_result['occluder'] & filled & ~glass & ~enclosed_occ)
    out[unc] = UNCERTAIN_RGB
    e = edges(out, filled & ~unc, labels, glass)
    out[e] = EDGE_RGB
    if ground_line:
        # the line the building stands on, at its own base row (a fact of the mask, not an invented terrain)
        cols = np.flatnonzero(filled.any(0))
        if len(cols):
            base = np.where(filled.any(0), filled.shape[0] - 1 - np.argmax(filled[::-1], 0), -1)[cols]
            row = int(np.median(base))
            pad = int(0.03 * (cols[-1] - cols[0] + 1))
            t = max(2, filled.shape[1] // 600)
            out[max(0, row - t + 1):row + 1, max(0, cols[0] - pad):min(filled.shape[1], cols[-1] + 1 + pad)] = EDGE_RGB
    roof, chim = roof_and_chimney(filled, labels, glass)
    sem = np.zeros(rgb.shape, np.uint8); sem[:] = SEM_COLORS['BACKGROUND']
    sem[filled] = SEM_COLORS['WALL']; sem[roof] = SEM_COLORS['ROOF']; sem[chim] = SEM_COLORS['CHIMNEY']
    sem[glass] = SEM_COLORS['OPENING']; sem[door] = SEM_COLORS['DOOR']; sem[occ] = SEM_COLORS['OCCLUDER']; sem[unc] = SEM_COLORS['UNCERTAIN']
    edge_img = np.full(rgb.shape, 255, np.uint8); edge_img[e] = 0
    unc_img = (unc | enclosed_occ).astype(np.uint8) * 255
    H, W = filled.shape
    transform = {'schema': 'iu02.transform/1', 'source': source_meta, 'output': {'width': W, 'height': H},
                 'sourceToOutput': [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 'resampled': False,
                 'projectionState': projection_state, 'groundLine': bool(ground_line),
                 'note': 'identity: every output pixel is the source pixel at the same (x, y); only colours change',
                 'shares': {'building': round(float(filled.mean()), 4), 'glass': round(float(glass.mean()), 4),
                            'uncertain': round(float(unc.mean()), 4), 'reflectionTreatedAsGlass': round(float(enclosed_occ.mean()), 4)}}
    return {'clean': out, 'edges': edge_img, 'semantic': sem, 'uncertainty': unc_img, 'glass': glass, 'door': door, 'filled': filled,
            'uncertainMask': unc | enclosed_occ, 'roof': roof, 'chimney': chim}, transform


def save(outdir, arrays, transform):
    import os
    from PIL import Image
    from iu.paths import refuse_inside_repo
    refuse_inside_repo(outdir, 'clean facade')
    os.makedirs(outdir, exist_ok=True)
    Image.fromarray(arrays['clean']).save(os.path.join(outdir, 'clean-facade.png'))
    Image.fromarray(arrays['edges']).save(os.path.join(outdir, 'edges.png'))
    Image.fromarray(arrays['semantic']).save(os.path.join(outdir, 'semantic-masks.png'))
    Image.fromarray(arrays['uncertainty']).save(os.path.join(outdir, 'uncertainty-mask.png'))
    json.dump(transform, open(os.path.join(outdir, 'transform.json'), 'w'), indent=1)
