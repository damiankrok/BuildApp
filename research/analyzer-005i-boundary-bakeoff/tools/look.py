"""look.py — RESEARCH ONLY annotation aid (BUILDPLAN-ANALYZER-005I Track B).

python -I look.py <frame.png> <out.png> [x0 y0 x1 y1] [--scale S] [--grid G] [--poly x,y;x,y;...] [--segs file.json]

Writes a crop of a frame (publisher pixels: the output must stay OUTSIDE the repository) with a labelled pixel grid
in FRAME coordinates, so a reviewer can read coordinates off the drawing. Optionally draws a candidate annotation
polygon (to check it against the pixels) or provider segments. It never computes an annotation itself.
"""
import argparse
import json

import cv2
import numpy as np


def main():
    p = argparse.ArgumentParser()
    p.add_argument("frame")
    p.add_argument("out")
    p.add_argument("box", nargs="*", type=float)
    p.add_argument("--scale", type=float, default=2.0)
    p.add_argument("--grid", type=int, default=50)
    p.add_argument("--poly", action="append", default=[])
    p.add_argument("--segs")
    p.add_argument("--mask")
    a = p.parse_args()
    img = cv2.imread(a.frame, cv2.IMREAD_COLOR)
    H, W = img.shape[:2]
    x0, y0, x1, y1 = (a.box + [0, 0, W, H])[:4] if a.box else (0, 0, W, H)
    x0, y0, x1, y1 = int(max(0, x0)), int(max(0, y0)), int(min(W, x1)), int(min(H, y1))
    s = a.scale
    if a.mask:
        m = cv2.imread(a.mask, cv2.IMREAD_GRAYSCALE) > 0
        tint = img.copy()
        tint[m] = (0.6 * tint[m] + 0.4 * np.array([255, 120, 0])).astype(np.uint8)
        img = tint
    crop = cv2.resize(img[y0:y1, x0:x1], None, fx=s, fy=s, interpolation=cv2.INTER_NEAREST)
    g = a.grid
    for gx in range((x0 // g + 1) * g, x1, g):
        X = int((gx - x0) * s)
        cv2.line(crop, (X, 0), (X, crop.shape[0] - 1), (255, 180, 0) if gx % (2 * g) else (255, 0, 255), 1)
        cv2.putText(crop, str(gx), (X + 2, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 0, 200), 1)
    for gy in range((y0 // g + 1) * g, y1, g):
        Y = int((gy - y0) * s)
        cv2.line(crop, (0, Y), (crop.shape[1] - 1, Y), (255, 180, 0) if gy % (2 * g) else (255, 0, 255), 1)
        cv2.putText(crop, str(gy), (2, Y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 0, 200), 1)
    colors = [(0, 0, 255), (0, 160, 0), (255, 0, 0), (0, 140, 255)]
    for k, poly in enumerate(a.poly):
        pts = np.array([[(float(v.split(",")[0]) - x0) * s, (float(v.split(",")[1]) - y0) * s] for v in poly.split(";") if v], dtype=np.int32)
        cv2.polylines(crop, [pts], True, colors[k % len(colors)], 1)
        for q in pts:
            cv2.circle(crop, tuple(int(c) for c in q), 3, colors[k % len(colors)], 1)
    if a.segs:
        d = json.load(open(a.segs))
        for o in d["observations"]:
            gm = o.get("geometry") or {}
            if gm.get("type") != "SEGMENT":
                continue
            pa = (int((gm["a"][0] - x0) * s), int((gm["a"][1] - y0) * s))
            pb = (int((gm["b"][0] - x0) * s), int((gm["b"][1] - y0) * s))
            cv2.line(crop, pa, pb, (0, 0, 255), 1)
    cv2.imwrite(a.out, crop)


if __name__ == "__main__":
    main()
