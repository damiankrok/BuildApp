"""IU-03B: a building mask without AI — what the classical OpenCV path can say about where the architecture is.

  sky        flood from the top rows over a smooth pale/blue field (low gradient, small colour steps)
  foliage    green hue with enough saturation (iu3/evidence.vegetation)
  mask       content box minus sky and foliage, small holes closed

It is deliberately conservative: it only REMOVES pixels that are confidently sky or plants. Anything else (paving,
neighbouring houses, a white wall on a white sheet) stays in, so the projection test sees all architecture and some
clutter, never less architecture than the full image.
"""
import cv2
import numpy as np

SKY_STEP = 6          # max per-channel step between neighbouring sky pixels (on a 4x smoothed image)
SKY_GRAD = 12.0       # max local gradient magnitude inside sky


def sky(rgb):
    h, w = rgb.shape[:2]
    small = cv2.resize(np.ascontiguousarray(rgb), (max(1, w // 4), max(1, h // 4)), interpolation=cv2.INTER_AREA).astype(np.int16)
    sh, sw = small.shape[:2]
    gray = cv2.cvtColor(small.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    g = np.hypot(cv2.Sobel(gray, cv2.CV_32F, 1, 0), cv2.Sobel(gray, cv2.CV_32F, 0, 1))
    r, gg, b = small[..., 0], small[..., 1], small[..., 2]
    skyish = ((b >= r - 4) & (b >= gg - 8) & (gray > 110)) & (g < SKY_GRAD)
    out = np.zeros((sh, sw), bool)
    stack = [(0, x) for x in range(sw) if skyish[0, x]]
    for y, x in stack:
        out[y, x] = True
    while stack:
        y, x = stack.pop()
        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy < sh and 0 <= xx < sw and not out[yy, xx] and skyish[yy, xx] and np.abs(small[yy, xx] - small[y, x]).max() <= SKY_STEP:
                out[yy, xx] = True
                stack.append((yy, xx))
    return cv2.resize(out.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST) > 0


def classic(rgb):
    from iu3.evidence import vegetation
    veg = vegetation(rgb)
    veg = cv2.dilate(veg.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    s = sky(rgb)
    m = ~(s | veg)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    return m, {'skyShare': round(float(s.mean()), 4), 'foliageShare': round(float(veg.mean()), 4)}
