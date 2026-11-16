"""v3.54.2 per-property scorer (PROTOCOL_V3542 §5), checked on synthetic cases BEFORE any A/R/C result is scored.

  /usr/bin/python3 -I score.py --selftest
  /usr/bin/python3 -I score.py <run dir> <reference.json>            -> JSON row
  /usr/bin/python3 -I score.py --dir <variant dir> <ref dir> [...]   -> JSON list

What changed against v3.54.1 (score_outline.py, extract.py):
- IoU in a FIXED frame: model X along the front, Z front to rear (the analyzer's own convention, written by the
  compiler), reference x along the front, y to the rear, origin front-left. The only registration is the alignment of
  the two bounding boxes' front-left corners. No rotation and no translation search per variant (brief §8: "nie obracaj
  ani nie skaluj osobno każdego wariantu do najlepszego IoU"). The v3.54.1 best-of-4-rotations IoU is reported beside
  it as `iouBestRotation` for continuity only, never as the score.
- A mirrored model is diagnosed, not rescued: `mirrorIoU` is the fixed-frame IoU of the model mirrored about X; when it
  beats the score by >= 0.10 the row says MIRROR_SUSPECT. The score itself stays the unmirrored one.
- Ridge from roof_axis.py (RIDGE edges first): a hip is no longer a WRONG ridge.
- Width/depth error = |model - reference| / reference, per axis, in the model's own scale (never refitted). Feet-inch
  references are converted exactly (1 ft = 0.3048 m, 1 in = 0.0254 m) when the reference prints them.
Classes: OK <= 3 %, NEAR <= 10 %, WRONG above, on the worse axis (PROTOCOL_V3541 §5, unchanged).
"""
import json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roof_axis import main_roof, score_ridge  # noqa: E402

RES = 0.05


def ground_polygons(model):
    levels = sorted(model.get('levels') or [], key=lambda l: l['index'])
    if not levels:
        return []
    g = levels[0]['id']
    return [[(p['x'], p['z']) for p in s['polygon']] for s in model.get('slabs') or [] if s.get('levelId') == g and s.get('polygon')]


def _raster(polys, x0, y0, w, h):
    im = Image.new('1', (w, h), 0)
    d = ImageDraw.Draw(im)
    for poly in polys:
        d.polygon([((x - x0) / RES, (y - y0) / RES) for x, y in poly], fill=1)
    return np.array(im, dtype=np.float64)


def _to_origin(polys):
    mx = min(x for p in polys for x, _ in p)
    my = min(y for p in polys for _, y in p)
    return [[(x - mx, y - my) for x, y in p] for p in polys]


def _rot(polys, k):
    out = []
    for poly in polys:
        q = []
        for x, y in poly:
            for _ in range(k):
                x, y = -y, x
            q.append((x, y))
        out.append(q)
    return out


def fixed_iou(model_polys, ref_poly):
    mp = _to_origin(model_polys)
    rp = _to_origin([[tuple(p) for p in ref_poly]])
    W = max(max(x for p in mp for x, _ in p), max(x for x, _ in rp[0])) + 1
    H = max(max(y for p in mp for _, y in p), max(y for _, y in rp[0])) + 1
    w, h = int(np.ceil(W / RES)), int(np.ceil(H / RES))
    A, B = _raster(rp, 0, 0, w, h), _raster(mp, 0, 0, w, h)
    ov = float((A * B).sum())
    sa, sb = float(A.sum()), float(B.sum())
    iou = ov / (sa + sb - ov) if sa + sb - ov > 0 else 0.0
    return {'iou': round(iou, 3), 'missingPct': round((sa - ov) / sa * 100, 1) if sa else None,
            'excessPct': round((sb - ov) / sa * 100, 1) if sa else None,
            'refM2': round(sa * RES * RES, 2), 'modelM2': round(sb * RES * RES, 2)}


def mirror_x(polys):
    return [[(-x, y) for x, y in p] for p in polys]


def bbox(polys):
    xs = [x for p in polys for x, _ in p]
    ys = [y for p in polys for _, y in p]
    return max(xs) - min(xs), max(ys) - min(ys)


def size_class(err):
    if err is None:
        return None
    return 'OK' if err <= 0.03 else ('NEAR' if err <= 0.10 else 'WRONG')


FTIN = re.compile(r"^\s*(\d+)\s*'\s*-?\s*(\d+(?:\.\d+)?)?\s*\"?\s*$")


def metres(v):
    """A reference length: a number of metres, or a printed feet-inch string such as 47'-1"."""
    if v is None or isinstance(v, (int, float)):
        return v
    m = FTIN.match(str(v))
    if not m:
        raise ValueError(f'not a length: {v!r}')
    return int(m.group(1)) * 0.3048 + float(m.group(2) or 0) * 0.0254


def score_run(run_dir, ref):
    mp = os.path.join(run_dir, 'model.json')
    if not os.path.exists(mp):
        why = None
        fp = os.path.join(run_dir, 'failure.json')
        if os.path.exists(fp):
            f = json.load(open(fp))
            why = f.get('code') + '/' + str((f.get('diagnostics') or {}).get('firstFailure'))
        return {'outcome': 'NO_MODEL', 'why': why}
    model = json.load(open(mp))
    polys = ground_polygons(model)
    row = {'outcome': 'MODEL'}
    ov = ref.get('overall') or {}
    rw, rd = metres(ov.get('widthM')), metres(ov.get('depthM'))
    if polys:
        mw, md = bbox(polys)
        row['widthM'], row['depthM'] = round(mw, 3), round(md, 3)
        ew = abs(mw - rw) / rw if rw else None
        ed = abs(md - rd) / rd if rd else None
        row['errWidth'] = None if ew is None else round(ew, 3)
        row['errDepth'] = None if ed is None else round(ed, 3)
        worst = max([e for e in (ew, ed) if e is not None], default=None)
        row['size'] = size_class(worst)
        row['errWorst'] = None if worst is None else round(worst, 3)
        poly = (ref.get('groundOutline') or {}).get('polygonM')
        if poly:
            fx = fixed_iou(polys, poly)
            row.update({'iou': fx['iou'], 'missingPct': fx['missingPct'], 'excessPct': fx['excessPct'], 'refM2': fx['refM2'], 'modelM2': fx['modelM2']})
            row['mirrorIoU'] = fixed_iou(mirror_x(polys), poly)['iou']
            row['iouBestRotation'] = max(fixed_iou(_rot(polys, k), poly)['iou'] for k in range(4))
            row['mirrorSuspect'] = row['mirrorIoU'] >= row['iou'] + 0.10
        else:
            row['iou'] = None
    else:
        row['size'] = None
        row['iou'] = None
    roof = main_roof(model)
    row['roofKind'], row['ridge'], row['ridgeBasis'] = roof['kind'], roof['ridge'], roof['basis']
    row['ridgeOk'] = score_ridge(roof, ref.get('mainRoof') or {})
    return row


def _selftest():
    ok = True

    def check(name, cond):
        nonlocal ok
        ok &= bool(cond)
        print('PASS' if cond else 'FAIL', name)

    L = [(0, 0), (10, 0), (10, 4), (4, 4), (4, 8), (0, 8)]  # an L: the wing at the left rear
    check('identity IoU 1', fixed_iou([L], L)['iou'] == 1.0)
    shifted = [(x + 3.3, y - 7.1) for x, y in L]
    check('translation is registered by the front-left corner', fixed_iou([shifted], L)['iou'] == 1.0)
    r90 = _rot([L], 1)
    check('a model turned 90 deg is NOT rescued in the fixed frame', fixed_iou(r90, L)['iou'] < 0.7)
    check('... but best-of-4 (v3.54.1, diagnostic) finds it', max(fixed_iou(_rot(r90, k), L)['iou'] for k in range(4)) == 1.0)
    mir = mirror_x([L])
    fx = fixed_iou(mir, L)['iou']
    check('a mirrored L scores low and mirrorIoU flags it', fx < 0.8 and fixed_iou(mirror_x(mir), L)['iou'] == 1.0)
    half = [(0, 0), (5, 0), (5, 8), (0, 8)]
    r = fixed_iou([half], [(0, 0), (10, 0), (10, 8), (0, 8)])
    # the rasteriser fills boundary pixels (one 0.05 m row/column more than the exact area, as in v3.54.1): +-1 %
    check('half the area: IoU .5, missing 50 %, excess 0 (+-1 %)', abs(r['iou'] - 0.5) <= 0.01 and abs(r['missingPct'] - 50.0) <= 1.0 and r['excessPct'] == 0.0)
    check("ft-in: 47'-1\" = 14.351 m", abs(metres("47'-1\"") - 14.351) < 1e-3)
    check("ft-in: 28'-0\" = 8.5344 m", abs(metres("28'-0\"") - 8.5344) < 1e-9)
    check("ft only: 36' = 10.9728 m", abs(metres("36'") - 10.9728) < 1e-9)
    check('metres pass through', metres(13.5) == 13.5)
    try:
        metres('13,5 m')
        check('a non-length is refused', False)
    except ValueError:
        check('a non-length is refused', True)
    check('size classes', size_class(0.03) == 'OK' and size_class(0.031) == 'NEAR' and size_class(0.2) == 'WRONG')
    import roof_axis
    check('roof selftest', roof_axis._selftest())
    print('selftest', 'OK' if ok else 'FAILED')
    return ok


def find_ref(house, ref_dirs):
    for d in ref_dirs:
        p = os.path.join(d, house + '.json')
        if os.path.exists(p):
            return json.load(open(p))
    return None


if __name__ == '__main__':
    if sys.argv[1:] == ['--selftest']:
        sys.exit(0 if _selftest() else 1)
    if sys.argv[1] == '--dir':
        root, refs = sys.argv[2], sys.argv[3:]
        rows = []
        for h in sorted(os.listdir(root)):
            p = os.path.join(root, h)
            if not os.path.isdir(p):
                continue
            ref = find_ref(h, refs)
            rows.append({'house': h, **(score_run(p, ref) if ref else {'outcome': 'NO_REFERENCE'})})
        print(json.dumps(rows, indent=1))
    else:
        print(json.dumps(score_run(sys.argv[1], json.load(open(sys.argv[2])))))
