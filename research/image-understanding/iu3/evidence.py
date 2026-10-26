"""IU-03A: FacadeGeometryEvidence — an elevation written down as observations instead of repainted as pixels.

Every item says where it is in the ORIGINAL image's pixels (the transform is the identity and is stated), how sure it
is, which signal produced it and whether something in front of it makes it unverifiable. Nothing is completed: a
ground line that the mask and the edges do not agree on is UNCERTAIN, one that neither shows is MISSING; an opening
under a tree or a reflection is listed as occluded and is never counted as independently detected; no dimension in
metres is produced here — metres come only from the solver's own registration.

    evidence(rgb, seg, projection, arrays, meta) -> dict (schema iu03.facade-geometry-evidence/1)
"""
import numpy as np
import cv2

SCHEMA = 'iu03.facade-geometry-evidence/1'
GROUND_TOL_PX = 3          # a base column agrees with the ground row within this many pixels
GROUND_AGREE_MIN = 0.60    # share of the wall's columns that must agree for the mask alone to state a ground row
EDGE_SPAN_MIN = 0.50       # an independent horizontal edge must span half the wall to confirm it
OCCLUDED_SHARE = 0.15      # an opening with this share of its box occluded/uncertain is not independently detected
MIN_OPENING_PX = 36
VEG_SAT = 0.25
EAVE_MIN_DELTA_E = 10.0
MAX_OPENING_WALL_SHARE = 0.25  # an 'opening' bigger than this share of the walls is the wall itself
MAX_OPENING_ASPECT = 8.0      # a strip this elongated is a band or a fascia, not an opening
FOLIAGE_IN_BOX = 0.03           # any foliage on an opening (in front of it or mirrored in it) makes it unverifiable   # roof and wall closer than this in Lab: the eaves line is not observable from colour
STRIP_SHARE = 0.08         # a mask column shorter than this share of the tallest is a ground strip, not building
DARK_LINE_LUMA = 60        # a drawn terrain line
FRAME_MARGIN_PX = 2


def vegetation(rgb):
    """Foliage by colour (green hue, enough saturation): an independent occluder signal that does not depend on the
    segmenter knowing what a tree is — the classical drawing segmenter knows nothing about trees at all."""
    hsv = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2HSV)
    h, sat, val = hsv[..., 0].astype(int) * 2, hsv[..., 1] / 255.0, hsv[..., 2] / 255.0
    m = (h >= 60) & (h <= 170) & (sat >= VEG_SAT) & (val >= 0.12)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    return m


def _components(mask, min_area):
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    return [(int(st[i, 0]), int(st[i, 1]), int(st[i, 0] + st[i, 2]), int(st[i, 1] + st[i, 3]), int(st[i, 4])) for i in range(1, n) if st[i, 4] >= min_area]


def _outline(filled):
    cs, _ = cv2.findContours(filled.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs:
        return None
    c = max(cs, key=cv2.contourArea)
    eps = max(1.0, 0.002 * cv2.arcLength(c, True))
    p = cv2.approxPolyDP(c, eps, True)[:, 0, :]
    return [[int(x), int(y)] for x, y in p]


def _drop_strips(filled):
    """Thin horizontal strips (paving, a terrace edge, a lawn band the segmenter called building) are not the
    building: a column whose mask is shorter than STRIP_SHARE of the building's height is removed."""
    cols = filled.sum(0)
    if not cols.any():
        return filled
    tall = cols >= STRIP_SHARE * cols.max()
    return filled & tall[None, :]


def _solidity(poly):
    p = np.array(poly, np.int32)
    h = cv2.contourArea(cv2.convexHull(p))
    return round(float(cv2.contourArea(p) / h), 3) if h > 0 else 0.0


def _ground(gray, filled, walls, occluded):
    """The row the walls stand on. OBSERVED only with an independent confirmation: a drawn dark terrain line at the
    base, or a horizontal edge at a base that lies INSIDE the image. A base on the frame's own border without a drawn
    line is UNCERTAIN (the drawing is cut there); bases that disagree are MISSING."""
    cols = np.flatnonzero(walls.any(0))
    if len(cols) < 10:
        return {'state': 'MISSING', 'why': 'no wall columns'}
    H = walls.shape[0]
    base = (H - 1 - np.argmax(walls[::-1], 0))[cols]
    row = int(np.median(base))
    agree = float(np.mean(np.abs(base - row) <= GROUND_TOL_PX))
    occ_at_base = float(occluded[max(0, row - 4):row + 1, cols[0]:cols[-1] + 1].any(0).mean())
    lo, hi = max(0, row - GROUND_TOL_PX), min(H, row + GROUND_TOL_PX + 1)
    dark = gray[lo:hi, cols[0]:cols[-1] + 1] < DARK_LINE_LUMA
    dark_span = float(dark.any(0).mean()) if dark.size else 0.0
    inside = row <= H - 1 - FRAME_MARGIN_PX
    gy = np.abs(cv2.Sobel(gray.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3))
    gy[:FRAME_MARGIN_PX] = 0; gy[H - FRAME_MARGIN_PX:] = 0          # the frame's own border is not an edge of the drawing
    band = gy[lo:hi, cols[0]:cols[-1] + 1]
    thr = max(20.0, float(np.percentile(gy, 90)))
    edge_span = float((band > thr).any(0).mean()) if band.size else 0.0
    out = {'row': row, 'x0': int(cols[0]), 'x1': int(cols[-1]), 'maskAgreement': round(agree, 3), 'drawnLineSpan': round(dark_span, 3),
           'edgeSpan': round(edge_span, 3), 'insideFrame': bool(inside), 'occludedShare': round(occ_at_base, 3)}
    if agree < GROUND_AGREE_MIN:
        return {**out, 'state': 'MISSING', 'confidence': 0.0, 'source': None, 'why': f'the wall bases disagree ({agree:.0%} within {GROUND_TOL_PX} px): the ground is not drawn or is hidden'}
    if occ_at_base >= 0.3:
        return {**out, 'state': 'UNCERTAIN', 'confidence': round(0.4 * agree, 3), 'source': 'MASK_BASE_ONLY', 'why': 'the base is partly hidden'}
    if dark_span >= EDGE_SPAN_MIN:
        return {**out, 'state': 'OBSERVED', 'confidence': round(min(agree, dark_span), 3), 'source': 'MASK_BASE+DRAWN_TERRAIN_LINE'}
    if inside and edge_span >= EDGE_SPAN_MIN:
        return {**out, 'state': 'OBSERVED', 'confidence': round(min(agree, edge_span), 3), 'source': 'MASK_BASE+HORIZONTAL_EDGE'}
    return {**out, 'state': 'UNCERTAIN', 'confidence': round(0.5 * agree, 3), 'source': 'MASK_BASE_ONLY',
            'why': 'the walls end on one row but nothing independent confirms it' + ('' if inside else ' (it is the edge of the frame)')}


def evidence(rgb, seg, projection, arrays, meta):
    filled, glass, door, unc, roof, chim = (arrays[k] for k in ('filled', 'glass', 'door', 'uncertainMask', 'roof', 'chimney'))
    filled = _drop_strips(filled)
    H, W = filled.shape
    gray = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2GRAY)
    veg = vegetation(rgb)
    # a foliage blob wholly inside an opening is a reflection in the glass; one that crosses an opening's edge or stands
    # on the wall is something in front of the building
    openings_any = glass | door
    reflection = np.zeros_like(veg)
    n, lab, st, _ = cv2.connectedComponentsWithStats(veg.astype(np.uint8), 8)
    for i in range(1, n):
        x0, y0, x1, y1 = st[i, 0], st[i, 1], st[i, 0] + st[i, 2], st[i, 1] + st[i, 3]
        ring = openings_any[max(0, y0 - 2):y1 + 2, max(0, x0 - 2):x1 + 2]
        comp = lab == i
        if ring.size and ring.mean() > 0.6 and (comp & openings_any).sum() >= 0.8 * comp.sum():
            reflection |= comp
    front = veg & ~reflection
    occluded = (seg['occluder'] & filled) | unc | front
    walls = filled & ~roof & ~chim
    ev = {'schema': SCHEMA, 'source': meta, 'transform': {'toOriginal': [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 'note': 'identity: coordinates are the original image pixels'},
          'projection': {'state': projection.get('state'), 'why': projection.get('why')}, 'segmenter': seg['method'], 'items': {}}
    it = ev['items']
    poly = _outline(filled)
    it['outline'] = {'polygon': poly, 'confidence': 0.9 if seg['method'] == 'CLASSIC' else 0.75, 'source': f'BUILDING_MASK_{seg["method"]}',
                     'touchesFrame': bool(filled[0].any() or filled[-1].any() or filled[:, 0].any() or filled[:, -1].any()),
                     'coverage': round(float(filled.mean()), 4), 'solidity': _solidity(poly)} if poly else {'state': 'MISSING', 'why': 'no building mask'}
    it['groundLine'] = _ground(gray, filled, walls, occluded | front)
    # corners: the walls' extent on their base row and the eaves row, refined to sub-pixel on the original image
    corners = []
    g = it['groundLine']
    if g.get('row') is not None and walls.any():
        rows_w = np.flatnonzero(walls.any(1))
        for name, (x, y) in (('BASE_LEFT', (g['x0'], g['row'])), ('BASE_RIGHT', (g['x1'], g['row']))):
            corners.append({'which': name, 'x': x, 'y': y, 'confidence': g.get('confidence', 0.0), 'source': 'WALL_MASK', 'state': g['state']})
    it['corners'] = corners
    # roof: contour = top of the building mask per column; ridge = its highest run; eaves = where roof meets walls at each side
    colsb = np.flatnonzero(filled.any(0))
    if len(colsb) and roof.any():
        body = filled & ~chim
        colsb = np.flatnonzero(body.any(0))
        top = np.argmax(body, 0)[colsb]
        # a narrow spike above its neighbours is a chimney the chimney mask missed, not the ridge
        med = np.array([np.median(top[max(0, i - 40):i + 41]) for i in range(len(top))])
        top = np.where(top < med - 0.02 * H, med.astype(int), top)
        ymin = int(top.min())
        ridge_cols = colsb[top <= ymin + 2]
        it['roofContour'] = {'polyline': [[int(x), int(y)] for x, y in zip(colsb[::max(1, len(colsb) // 120)], top[::max(1, len(colsb) // 120)])], 'source': 'BUILDING_MASK_TOP', 'confidence': it['outline'].get('confidence', 0)}
        it['ridge'] = {'row': ymin, 'x0': int(ridge_cols.min()), 'x1': int(ridge_cols.max()), 'kind': 'APEX' if ridge_cols.max() - ridge_cols.min() < 0.05 * (colsb[-1] - colsb[0]) else 'RIDGE_LINE', 'source': 'BUILDING_MASK_TOP'}
        roof_cols = np.flatnonzero(roof.any(0))
        eaves = []
        for side, c in (('LEFT', roof_cols[:max(1, len(roof_cols) // 20)]), ('RIGHT', roof_cols[-max(1, len(roof_cols) // 20):])):
            low = [int(H - 1 - np.argmax(roof[::-1, x])) for x in c if roof[:, x].any()]
            if low:
                eaves.append({'side': side, 'row': int(np.median(low)), 'x': int(np.median(c)), 'source': 'ROOF_MASK_LOWEST', 'confidence': 0.6})
        lab_img = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2LAB).astype(np.float32)
        wall_px, roof_px = walls & ~glass & ~door & ~occluded, roof & ~occluded
        if wall_px.sum() > 50 and roof_px.sum() > 50:
            de = float(np.linalg.norm(np.median(lab_img[wall_px], 0) - np.median(lab_img[roof_px], 0)))
            for e in eaves:
                e['roofWallDeltaE'] = round(de, 1)
                if de < EAVE_MIN_DELTA_E:
                    e['state'] = 'UNCERTAIN'; e['confidence'] = 0.2; e['why'] = f'roof and wall differ by only {de:.0f} ΔE: the eaves line is not observable from colour'
                else:
                    e['state'] = 'OBSERVED'
        it['eaves'] = eaves
    else:
        it['ridge'] = {'state': 'MISSING', 'why': 'no roof region'}
        it['eaves'] = []
    # openings: glazing and doors as rectangles; occlusion makes them unverifiable, never "detected"
    ops = []
    rejected = []
    wall_area = max(1, int(walls.sum()))
    for mask, kind in ((glass, 'WINDOW_OR_GLAZING'), (door, 'DOOR_OR_GATE')):
        for (x0, y0, x1, y1, a) in _components(mask, MIN_OPENING_PX):
            w_, h_ = x1 - x0, y1 - y0
            if a > MAX_OPENING_WALL_SHARE * wall_area:
                rejected.append({'rect': [x0, y0, x1, y1], 'why': f'covers {a / wall_area:.0%} of the walls: the wall itself, not an opening'}); continue
            if max(w_, h_) > MAX_OPENING_ASPECT * max(1, min(w_, h_)):
                rejected.append({'rect': [x0, y0, x1, y1], 'why': f'{w_}x{h_} px: a band or fascia, not an opening'}); continue
            box_occ = float(occluded[y0:y1, x0:x1].mean())
            if float(veg[y0:y1, x0:x1].mean()) > FOLIAGE_IN_BOX:
                box_occ = max(box_occ, 1.0)  # foliage on it: in front or reflected, colour cannot tell which
            grounded = g.get('row') is not None and abs(y1 - g['row']) <= max(4, 0.02 * H)
            k = 'GARAGE_GATE_OR_DOOR' if kind == 'DOOR_OR_GATE' and (x1 - x0) > 1.6 * (y1 - y0) else kind
            ops.append({'rect': [x0, y0, x1, y1], 'kind': k, 'reachesGround': bool(grounded), 'occludedShare': round(box_occ, 3),
                        'reflectionSuspected': bool(reflection[y0:y1, x0:x1].mean() > 0.05),
                        'independentlyDetected': box_occ < OCCLUDED_SHARE, 'confidence': round(0.7 * (1 - box_occ), 3),
                        'source': 'GLAZING_COMPONENT' if kind == 'WINDOW_OR_GLAZING' else 'GROUNDED_NON_GLASS_OPENING'})
    it['openings'] = sorted(ops, key=lambda o: (o['rect'][0], o['rect'][1]))
    it['rejectedOpenings'] = rejected
    it['chimneys'] = [{'rect': [x0, y0, x1, y1], 'source': 'CHIMNEY_MASK', 'confidence': 0.6} for (x0, y0, x1, y1, a) in _components(chim, 30)]
    occ_boxes = _components(occluded, 50)
    it['uncertain'] = {'share': round(float(occluded.mean()), 4), 'shareOfBuilding': round(float((occluded & filled).sum() / max(1, filled.sum())), 4),
                       'rects': [[x0, y0, x1, y1] for (x0, y0, x1, y1, a) in occ_boxes[:50]], 'source': 'SEGMENTER_OCCLUDER+FOLIAGE_COLOUR+UNCERTAIN_COLOUR',
                       'foliageInFront': round(float(front.mean()), 4), 'reflectionInGlass': round(float(reflection.mean()), 4)}
    it['counts'] = {'openings': len(ops), 'independentlyDetected': sum(o['independentlyDetected'] for o in ops), 'occluded': sum(not o['independentlyDetected'] for o in ops)}
    return ev


def anchored(clean_rgb, ev, stroke=(40, 40, 40)):
    """Variant 3: the clean view with the source-confirmed anchors drawn back as ink — outline, an OBSERVED ground line,
    opening and chimney rectangles. Nothing UNCERTAIN or MISSING is drawn."""
    out = clean_rgb.copy()
    it = ev['items']
    t = max(1, out.shape[1] // 800)
    if it['outline'].get('polygon'):
        cv2.polylines(out, [np.array(it['outline']['polygon'], np.int32)], True, stroke, t)
    g = it['groundLine']
    if g.get('state') == 'OBSERVED':
        cv2.line(out, (g['x0'], g['row']), (g['x1'], g['row']), stroke, t + 1)
    for o in it['openings']:
        if o['independentlyDetected']:
            x0, y0, x1, y1 = o['rect']; cv2.rectangle(out, (x0, y0), (x1 - 1, y1 - 1), stroke, t)
    for c in it['chimneys']:
        x0, y0, x1, y1 = c['rect']; cv2.rectangle(out, (x0, y0), (x1 - 1, y1 - 1), stroke, t)
    return out


def silhouette_polygon_for_solver(ev):
    """The outline as the solver's SILHOUETTE wants it: the building down to an OBSERVED ground row (cut there, so
    terrain and plinth shadows are not a building), or None when the ground is not observed — then the adapter adds
    nothing and the solver keeps its own path."""
    g, o = ev['items']['groundLine'], ev['items']['outline']
    if g.get('state') != 'OBSERVED' or not o.get('polygon'):
        return None
    pts = [[x, min(y, g['row'])] for x, y in o['polygon']]
    return pts
