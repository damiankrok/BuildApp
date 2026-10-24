"""IU-02 fidelity of a cleaned facade against independently known architecture.

Windows: ground-truth openings (synthetic label map, or annotated rectangles) against the cleaned image's glass
components, matched one-to-one by IoU ≥ MATCH_IOU. Counted separately: kept, missing (no detection), added (a
detection with no opening), misclassified (matched to an opening of another kind, e.g. a door read as glass).

Points: each architectural point (corner of the building, a window, a door, the eave, the apex, the chimney, the
balcony) is located in the source and in the cleaned image by sub-pixel corner refinement started at the
annotation (`cv2.cornerSubPix`). The displacement source→clean is what cleaning did to the geometry; the
displacement annotation→source is the annotation's own precision, reported beside it so a threshold is never
tighter than the truth it is measured against.
"""
import numpy as np

MATCH_IOU = 0.5


def components(mask, min_area=20):
    import cv2
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    return [(st[k, 0], st[k, 1], st[k, 0] + st[k, 2], st[k, 1] + st[k, 3]) for k in range(1, n) if st[k, 4] >= min_area]


def box_iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / u if u > 0 else 0.0


def _group(kind):
    return 'GLASS' if kind in ('WINDOW', 'GLAZED_DOOR', 'GLASS') else 'DOOR_OR_GATE'


def match_openings(gt, det):
    """gt: list of (box, kind, occluded); det: list of (box, kind). Greedy one-to-one by IoU ≥ MATCH_IOU.
    kept = matched with the same group (glazing vs door/gate); misclassified = matched across groups;
    missing = a visible opening nothing matched; missingOccluded = the same, for an opening a tree hides;
    added = a detection that matches no opening."""
    pairs = sorted(((box_iou(g[0], d[0]), i, j) for i, g in enumerate(gt) for j, d in enumerate(det)), reverse=True)
    used_g, used_d, m = set(), set(), []
    for iou, i, j in pairs:
        if iou < MATCH_IOU:
            break
        if i in used_g or j in used_d:
            continue
        used_g.add(i); used_d.add(j); m.append((i, j, iou))
    out = {}
    for grp in ('GLASS', 'DOOR_OR_GATE'):
        out[grp] = {'gt': sum(1 for g in gt if _group(g[1]) == grp),
                    'kept': sum(1 for i, j, _ in m if _group(gt[i][1]) == grp and _group(det[j][1]) == grp),
                    'misclassified': sum(1 for i, j, _ in m if _group(gt[i][1]) == grp and _group(det[j][1]) != grp),
                    'missing': sum(1 for i, g in enumerate(gt) if i not in used_g and _group(g[1]) == grp and not g[2]),
                    'missingOccluded': sum(1 for i, g in enumerate(gt) if i not in used_g and _group(g[1]) == grp and g[2]),
                    'added': sum(1 for j, d in enumerate(det) if j not in used_d and _group(d[1]) == grp)}
    out['meanIoU'] = round(float(np.mean([x[2] for x in m])), 3) if m else None
    return out


def refine(gray, pts, win=4):
    import cv2
    if not len(pts):
        return np.zeros((0, 2))
    p = np.array(pts, np.float32).reshape(-1, 1, 2).copy()
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.01)
    cv2.cornerSubPix(gray.astype(np.float32), p, (win, win), (-1, -1), crit)
    return p.reshape(-1, 2)


def point_shift(src_rgb, clean_rgb, pts):
    import cv2
    if not pts:
        return {}
    g0 = cv2.cvtColor(src_rgb, cv2.COLOR_RGB2GRAY); g1 = cv2.cvtColor(clean_rgb, cv2.COLOR_RGB2GRAY)
    P = np.array(pts, np.float64)
    r0, r1 = refine(g0, P), refine(g1, P)
    d01 = np.hypot(*(r1 - r0).T)
    da = np.hypot(*(r0 - P).T)
    return {'n': int(len(P)), 'srcToCleanMedianPx': round(float(np.median(d01)), 2), 'srcToCleanP95Px': round(float(np.percentile(d01, 95)), 2),
            'annotationToSrcMedianPx': round(float(np.median(da)), 2), 'annotationToSrcP95Px': round(float(np.percentile(da, 95)), 2),
            'shifts': [round(float(x), 2) for x in d01]}
