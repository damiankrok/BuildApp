"""v3.54.1 outline metric (PROTOCOL_V3541 §5), frozen before any H result was read.

  /usr/bin/python3 -I score_outline.py <run dir> <reference.json>   -> JSON
  /usr/bin/python3 -I score_outline.py --dir <strategy dir> <ref dir> [<ref dir> ...]  -> JSON list

Model outline = union of the ground storey's slab polygons in model.json, in the MODEL's own scale (never refitted).
Reference outline = groundOutline.polygonM (metres, front-left origin, y to the rear).
Registration: one of 4 rotations of the model (no mirror) and a translation searched ±1.5 m at 0.05 m around the
alignment of the two bounding boxes' front-left corners; the best IoU is kept. Reported: IoU, missing area (reference
not covered by the model) and excess area (model outside the reference), both as % of the reference area, and the
mean symmetric boundary distance in metres. A reference without a polygon is NOT_COMPARABLE.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

RES = 0.05
SEARCH_M = 1.5

def ground_polygons(model):
    levels = sorted(model['levels'], key=lambda l: l['index'])
    if not levels:
        return []
    g = levels[0]['id']
    return [[(p['x'], p['z']) for p in s['polygon']] for s in model['slabs'] if s.get('levelId') == g and s.get('polygon')]

def rot(polys, k):
    out = []
    for poly in polys:
        q = []
        for x, y in poly:
            for _ in range(k):
                x, y = -y, x
            q.append((x, y))
        out.append(q)
    return out

def raster(polys, x0, y0, w, h):
    im = Image.new('1', (w, h), 0)
    d = ImageDraw.Draw(im)
    for poly in polys:
        d.polygon([((x - x0) / RES, (y - y0) / RES) for x, y in poly], fill=1)
    return np.array(im, dtype=np.float64)

def boundary(mask):
    m = mask > 0.5
    inner = m.copy()
    inner[1:, :] &= m[:-1, :]; inner[:-1, :] &= m[1:, :]; inner[:, 1:] &= m[:, :-1]; inner[:, :-1] &= m[:, 1:]
    ys, xs = np.nonzero(m & ~inner)
    return np.stack([xs, ys], 1).astype(np.float64)

def mean_boundary_distance(a, b):
    pa, pb = boundary(a), boundary(b)
    if len(pa) == 0 or len(pb) == 0:
        return None
    def one_way(p, q):
        best = np.full(len(p), np.inf)
        for i in range(0, len(q), 512):
            d = np.sqrt(((p[:, None, :] - q[None, i:i + 512, :]) ** 2).sum(-1)).min(1)
            best = np.minimum(best, d)
        return best
    return float((one_way(pa, pb).mean() + one_way(pb, pa).mean()) / 2 * RES)

def score(model_polys, ref_poly):
    ref = [[tuple(p) for p in ref_poly]]
    best = None
    for k in range(4):
        mp = rot(model_polys, k)
        mx = min(x for p in mp for x, _ in p); my = min(y for p in mp for _, y in p)
        mp = [[(x - mx, y - my) for x, y in p] for p in mp]  # front-left corner of the bounding box at 0,0
        rx = min(x for x, _ in ref[0]); ry = min(y for _, y in ref[0])
        rp = [[(x - rx, y - ry) for x, y in ref[0]]]
        W = max(max(x for p in mp for x, _ in p), max(x for x, _ in rp[0])) + 2 * SEARCH_M + 1
        H = max(max(y for p in mp for _, y in p), max(y for _, y in rp[0])) + 2 * SEARCH_M + 1
        w, h = int(np.ceil(W / RES)), int(np.ceil(H / RES))
        A = raster(rp, -SEARCH_M, -SEARCH_M, w, h)
        B = raster(mp, -SEARCH_M, -SEARCH_M, w, h)
        # overlap for every shift of B by (dx, dy), by FFT cross-correlation
        F = np.fft.rfft2(A, s=(2 * h, 2 * w)) * np.conj(np.fft.rfft2(B, s=(2 * h, 2 * w)))
        corr = np.fft.irfft2(F, s=(2 * h, 2 * w))
        n = int(round(SEARCH_M / RES))
        sa, sb = A.sum(), B.sum()
        for dy in range(-n, n + 1):
            for dx in range(-n, n + 1):
                ov = corr[dy % (2 * h), dx % (2 * w)]
                iou = ov / (sa + sb - ov) if sa + sb - ov > 0 else 0
                if best is None or iou > best[0]:
                    best = (iou, k, dx, dy, ov, sa, sb, A, B)
    iou, k, dx, dy, ov, sa, sb, A, B = best
    Bs = np.roll(np.roll(B, dy, 0), dx, 1)
    return {'iou': round(float(iou), 3), 'rotation': k * 90, 'shiftM': [round(dx * RES, 2), round(dy * RES, 2)],
            'missingPct': round(float((sa - ov) / sa * 100), 1), 'excessPct': round(float((sb - ov) / sa * 100), 1),
            'refM2': round(float(sa * RES * RES), 2), 'modelM2': round(float(sb * RES * RES), 2),
            'meanBoundaryM': (lambda d: None if d is None else round(d, 3))(mean_boundary_distance(A, Bs))}

def run(run_dir, ref):
    poly = (ref.get('groundOutline') or {}).get('polygonM')
    if not poly:
        return {'outline': 'NOT_COMPARABLE', 'why': 'the reference has no polygon'}
    mp = os.path.join(run_dir, 'model.json')
    if not os.path.exists(mp):
        return {'outline': 'NO_MODEL'}
    polys = ground_polygons(json.load(open(mp)))
    if not polys:
        return {'outline': 'NO_GROUND_SLAB'}
    return {'outline': 'SCORED', **score(polys, poly)}

def find_ref(house, ref_dirs):
    for d in ref_dirs:
        p = os.path.join(d, house + '.json')
        if os.path.exists(p):
            return json.load(open(p))
    return None

if __name__ == '__main__':
    if sys.argv[1] == '--dir':
        root, refs = sys.argv[2], sys.argv[3:]
        rows = []
        for h in sorted(os.listdir(root)):
            p = os.path.join(root, h)
            if not os.path.isdir(p):
                continue
            ref = find_ref(h, refs)
            rows.append({'house': h, **(run(p, ref) if ref else {'outline': 'NO_REFERENCE'})})
        print(json.dumps(rows, indent=1))
    else:
        print(json.dumps(run(sys.argv[1], json.load(open(sys.argv[2])))))
