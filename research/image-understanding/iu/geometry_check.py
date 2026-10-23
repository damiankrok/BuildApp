"""IU-01 independent geometric check: is this picture consistent with an ORTHOGRAPHIC view?

Model-free and label-free. In an orthographic elevation every horizontal edge of the building (eaves, sills, ground
line, window heads) is drawn exactly horizontal; in a perspective picture the same edges recede toward vanishing
points and are drawn at small, varied angles. The roof slopes of a gable elevation are oblique too, but at the
roof pitch (typically 25-50 deg), so the band that discriminates is the NEAR-horizontal one.

  tilt = gradient energy of edges 3..20 deg off horizontal / energy within 1.5 deg of horizontal

Thresholds are fitted on TRAIN only (iu.fit). The check does not see the classifier output or any metadata.
"""
import numpy as np
from PIL import Image

def _sobel(a):
    p = np.pad(a, 1, mode='edge')
    gx = (p[:-2, 2:] + 2 * p[1:-1, 2:] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[1:-1, :-2] + p[2:, :-2])
    gy = (p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[:-2, 1:-1] + p[:-2, 2:])
    return gx, gy

def features(im: Image.Image) -> dict:
    g = im.convert('L')
    g.thumbnail((640, 640))
    a = np.asarray(g, dtype=np.float32) / 255.0
    gx, gy = _sobel(a)
    mag = np.hypot(gx, gy)
    thr = np.percentile(mag, 92)
    m = mag > max(thr, 0.15)
    # edge direction is perpendicular to the gradient; fold into [0, 90] deg away from horizontal
    edge_deg = (np.degrees(np.arctan2(gy, gx)) + 90.0) % 180.0
    off_h = np.minimum(edge_deg, 180.0 - edge_deg)
    w = mag[m]; d = off_h[m]
    tot = w.sum() + 1e-9
    horiz = w[d <= 1.5].sum()
    tilt = w[(d > 3) & (d <= 20)].sum()
    vert = w[d >= 88.5].sum()
    rgb = np.asarray(im.convert('RGB').resize((128, 128)), dtype=np.float32) / 255.0
    sat = (rgb.max(-1) - rgb.min(-1)).mean()
    white = (rgb.min(-1) > 0.92).mean()
    return {'tiltRatio': float(tilt / (horiz + 1e-9)), 'horizShare': float(horiz / tot), 'vertShare': float(vert / tot),
            'saturation': float(sat), 'whiteShare': float(white)}

def verdict(f: dict, t_ortho: float, t_persp: float) -> str:
    if f['tiltRatio'] <= t_ortho:
        return 'ORTHO_CONSISTENT'
    if f['tiltRatio'] >= t_persp:
        return 'PERSPECTIVE_EVIDENT'
    return 'INCONCLUSIVE'
