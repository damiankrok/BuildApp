"""IU-02 section cues: does this orthographic view cut through the building?

A section draws what the cutting plane passes through as *poché* (solid dark) or *hatch*: the external walls as two
thick vertical bands at the ends, every floor slab as a thick horizontal band running between them, a roof as a thick
sloped band; between them the interior (partitions, stairs, ceilings). An elevation's dark areas are roof surfaces,
glazing and plinths — blobs, or one band at the ground — not a ladder of slabs between two walls.

Measured, all relative to the content box (no publisher constants):
  slabBands    horizontal runs of thick dark or hatched pixels covering ≥ 60 % of the content width, counted as
               distinct levels (an elevation has at most a plinth and an eave band);
  endWalls     whether thick vertical bands stand at both ends of the content, spanning ≥ 40 % of its height;
  hatchShare   share of the content in diagonal hatch (short parallel ±45° strokes on a regular period);
  pocheShare   share of the content in thick dark strokes (2 px ≤ half-thickness ≤ 2.5 % of the width).
SECTION_EVIDENT needs slab bands at ≥ 2 levels and end walls; otherwise it is only a cue for the classifier.
"""
import numpy as np

SLAB_MIN_LEVELS = 2


def _thick_dark(gray, w):
    import cv2
    dark = gray < 110
    dt = cv2.distanceTransform(dark.astype(np.uint8), cv2.DIST_L2, 3)
    core = (dt >= 2.0) & (dt <= max(3.0, 0.025 * w))
    # grow the cores back to the stroke they sit in
    return (cv2.dilate(core.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & dark


def _hatch(gray):
    import cv2
    g = gray.astype(np.float32)
    k = np.zeros((9, 9), np.float32)
    np.fill_diagonal(k, 1.0)
    k = k / k.sum() - 1.0 / 81
    a = np.abs(cv2.filter2D(g, -1, k)) + np.abs(cv2.filter2D(g, -1, k[:, ::-1]))
    resp = cv2.GaussianBlur(a, (0, 0), 3)
    edges = cv2.Canny(gray, 60, 160) > 0
    dens = cv2.GaussianBlur(edges.astype(np.float32), (0, 0), 4)
    return (resp > 25) & (dens > 0.18)


def cues(rgb, box=None):
    import cv2
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY) if rgb.ndim == 3 else rgb
    h, w = gray.shape
    if box is None:
        from .projection import content_box
        box = content_box(gray)
    x0, y0, x1, y1 = box
    g = gray[y0:y1, x0:x1]
    H, W = g.shape
    if H < 20 or W < 20:
        return {'slabBands': 0, 'endWalls': False, 'hatchShare': 0.0, 'pocheShare': 0.0, 'state': 'NO_CONTENT'}
    thick = _thick_dark(g, W)
    hatch = _hatch(g)
    solid = thick | hatch
    rows = solid.mean(1)
    band_rows = rows >= 0.60
    levels, prev = 0, False
    for v in band_rows:
        if v and not prev:
            levels += 1
        prev = v
    edge_w = max(3, int(0.06 * W))
    left = solid[:, :edge_w].any(1).mean() >= 0.4 and thick[:, :edge_w].mean() > 0.05
    right = solid[:, -edge_w:].any(1).mean() >= 0.4 and thick[:, -edge_w:].mean() > 0.05
    out = {'slabBands': int(levels), 'endWalls': bool(left and right), 'hatchShare': round(float(hatch.mean()), 4),
           'pocheShare': round(float(thick.mean()), 4)}
    out['state'] = 'SECTION_EVIDENT' if levels >= SLAB_MIN_LEVELS and out['endWalls'] else 'NO_SECTION_EVIDENCE'
    return out
