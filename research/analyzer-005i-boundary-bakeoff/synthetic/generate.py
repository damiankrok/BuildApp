"""Synthetic boundary corpus with exact ground truth — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B).

python -I generate.py --out <dir outside the repo>

Draws floor-plan rasters from a geometric specification (metres) and writes, per case:
  <case>.png | <case>.jpg   the bytes the production decoder will read (JPEG only for the compression case)
  <case>.truth.json         exact truth in the IMAGE's pixel frame (after every geometric degradation)
and corpus.json (case list, seeds, generator hash, per-file SHA-256).

Every number here is invented for this corpus and describes no real project. Nothing random is unseeded: each case
has a fixed seed; drawing is integer-exact at 2x supersampling, then box-averaged to 1x (INTER_AREA), so the same
inputs give the same bytes with this OpenCV/numpy build (recorded in corpus.json).

The truth separates: the exterior boundary polygon (outer faces), the exterior wall band (outer..inner face), every
wall face line with its solid / opening state, attached bodies (garage, bay, wing, connector), exclusions (terrace,
pergola, recess pocket, courtyard), opening runs on the outer face, rooms, and the distractors (dimension lines,
text boxes, hatch regions) used to count false lines.
"""
import argparse
import hashlib
import json
import math
import os

import cv2
import numpy as np
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Polygon, box
from shapely.ops import unary_union

PXM = 45.0          # pixels per metre at 1x
SS = 2              # supersampling factor
T_EXT = 0.40        # exterior wall thickness, m
T_INT = 0.12        # partition thickness, m
INK = 20
PAPER = 250


def r4(x):
    return round(float(x), 4)


class Plan:
    """A plan in metres; drawn into a canvas whose origin (0, 0) m sits at `origin` px (1x)."""

    def __init__(self, case_id, seed, size=(900, 900), origin=(150, 150)):
        self.case_id = case_id
        self.seed = seed
        self.rng = np.random.RandomState(seed)
        self.W, self.H = size
        self.ox, self.oy = origin
        self.bodies = []        # (kind, shapely polygon in m)
        self.exclusions = []    # (kind, polygon m)
        self.partitions = []    # rect strips (polygon m)
        self.openings = []      # dict(kind, a=(x,y) m, b=(x,y) m) on an outer face edge
        self.pockets = []       # polygons subtracted from the footprint (recesses)
        self.terraces = []
        self.pergolas = []
        self.texts = []         # (text, (x,y) m, scale, halo)
        self.dims = True
        self.tiles = []         # polygons m to tile-hatch (floor pattern)
        self.style = "SOLID"    # SOLID | DOUBLE_LINE
        self.dim_offsets = (1.2, 2.0)
        self.extra_dims = []    # (axis, offset m) extra chains close to a facade

    # --- geometry --------------------------------------------------------------------------------------------------
    def footprint(self):
        f = unary_union([p for _, p in self.bodies])
        for q in self.pockets:
            f = f.difference(q)
        return f

    def P(self, x, y):
        """metres -> 1x pixels"""
        return (self.ox + x * PXM, self.oy + y * PXM)

    def to_px_geom(self, g):
        return affinity.affine_transform(g, [PXM, 0, 0, PXM, self.ox, self.oy])


def poly_px_ss(poly_px):
    return np.round(np.array(poly_px.exterior.coords) * SS).astype(np.int32)


def fill(canvas, geom_px, value):
    geoms = [geom_px] if isinstance(geom_px, Polygon) else list(getattr(geom_px, "geoms", []))
    for g in geoms:
        if g.is_empty or not isinstance(g, Polygon):
            continue
        cv2.fillPoly(canvas, [poly_px_ss(g)], value)
        for hole in g.interiors:
            cv2.fillPoly(canvas, [np.round(np.array(hole.coords) * SS).astype(np.int32)], PAPER)


def line(canvas, a, b, value, width_px=1.0, dashed=None):
    a = np.array(a, dtype=float) * SS
    b = np.array(b, dtype=float) * SS
    th = max(1, int(round(width_px * SS)))
    if dashed is None:
        cv2.line(canvas, tuple(np.round(a).astype(int)), tuple(np.round(b).astype(int)), value, th)
        return
    on, off = dashed[0] * SS, dashed[1] * SS
    L = float(np.linalg.norm(b - a))
    if L == 0:
        return
    u = (b - a) / L
    s = 0.0
    while s < L:
        e = min(L, s + on)
        cv2.line(canvas, tuple(np.round(a + u * s).astype(int)), tuple(np.round(a + u * e).astype(int)), value, th)
        s = e + off


def text(canvas, s, at_px, scale=0.45, value=INK, halo=False, angle=0):
    org = (int(round(at_px[0] * SS)), int(round(at_px[1] * SS)))
    (tw, th), base = cv2.getTextSize(s, cv2.FONT_HERSHEY_SIMPLEX, scale * SS, max(1, SS))
    rect = (org[0] - 2 * SS, org[1] - th - 2 * SS, org[0] + tw + 2 * SS, org[1] + base + 1 * SS)
    if halo:
        cv2.rectangle(canvas, rect[:2], rect[2:], PAPER, -1)
    cv2.putText(canvas, s, org, cv2.FONT_HERSHEY_SIMPLEX, scale * SS, value, max(1, SS), cv2.LINE_8)
    return [rect[0] / SS, rect[1] / SS, rect[2] / SS, rect[3] / SS]


def edges_of(poly):
    c = list(poly.exterior.coords)[:-1]
    return [(c[i], c[(i + 1) % len(c)]) for i in range(len(c))]


def render(plan):
    """Draw the plan; return (image uint8 HxW gray-as-RGB, truth in 1x pixels before degradations)."""
    W, H = plan.W * SS, plan.H * SS
    cv = np.full((H, W), PAPER, np.uint8)
    F = plan.footprint()
    Fpx = plan.to_px_geom(F)
    t = T_EXT * PXM
    inner_px = Fpx.buffer(-t, join_style=2, mitre_limit=10)
    band_px = Fpx.difference(inner_px)
    distract = {"dimensionLines": [], "textBoxes": [], "hatchRegions": [], "terraceLines": [], "pergolaLines": []}

    # terraces and pergolas first (under the building ink)
    for poly in plan.terraces:
        ppx = plan.to_px_geom(poly).difference(Fpx)
        if isinstance(ppx, MultiPolygon):
            ppx = max(ppx.geoms, key=lambda g: g.area)
        x0, y0, x1, y1 = ppx.bounds
        step = 0.5 * PXM
        gx = x0 + step
        while gx < x1:
            seg = LineString([(gx, y0), (gx, y1)]).intersection(ppx)
            for s in getattr(seg, "geoms", [seg]):
                if not s.is_empty and s.length > 1:
                    line(cv, s.coords[0], s.coords[-1], 175, 1.0)
            gx += step
        gy = y0 + step
        while gy < y1:
            seg = LineString([(x0, gy), (x1, gy)]).intersection(ppx)
            for s in getattr(seg, "geoms", [seg]):
                if not s.is_empty and s.length > 1:
                    line(cv, s.coords[0], s.coords[-1], 175, 1.0)
            gy += step
        for a, b in edges_of(ppx):
            line(cv, a, b, 60, 1.5)
            distract["terraceLines"].append([list(map(r4, a)), list(map(r4, b))])
        distract["hatchRegions"].append([[r4(x), r4(y)] for x, y in ppx.exterior.coords[:-1]])
        cx, cy = ppx.centroid.coords[0]
        distract["textBoxes"].append(list(map(r4, text(cv, "taras", (cx - 15, cy), 0.45, 80))))
        plan.exclusions.append(("TERRACE", ppx))
    for poly in plan.pergolas:
        ppx = plan.to_px_geom(poly)
        for a, b in edges_of(ppx):
            line(cv, a, b, 40, 1.5, dashed=(8, 5))
            distract["pergolaLines"].append([list(map(r4, a)), list(map(r4, b))])
        x0, y0, x1, y1 = ppx.bounds
        post = 0.18 * PXM
        xs = np.linspace(x0, x1, 3)
        for px_ in xs:
            for py_ in (y0, y1):
                fill(cv, box(px_ - post / 2, py_ - post / 2, px_ + post / 2, py_ + post / 2), INK)
        # pergola rafters (thin, dashed)
        for k in range(1, 6):
            yy = y0 + (y1 - y0) * k / 6
            line(cv, (x0, yy), (x1, yy), 90, 1.0, dashed=(5, 4))
            distract["pergolaLines"].append([[r4(x0), r4(yy)], [r4(x1), r4(yy)]])
        plan.exclusions.append(("PERGOLA", ppx))

    # floor tiles (hatch) inside chosen rooms
    for poly in plan.tiles:
        ppx = plan.to_px_geom(poly).intersection(inner_px)
        if ppx.is_empty:
            continue
        x0, y0, x1, y1 = ppx.bounds
        step = 0.3 * PXM
        k = x0 + step
        while k < x1:
            s = LineString([(k, y0), (k, y1)]).intersection(ppx)
            for q in getattr(s, "geoms", [s]):
                if not q.is_empty and q.length > 1:
                    line(cv, q.coords[0], q.coords[-1], 190, 1.0)
            k += step
        k = y0 + step
        while k < y1:
            s = LineString([(x0, k), (x1, k)]).intersection(ppx)
            for q in getattr(s, "geoms", [s]):
                if not q.is_empty and q.length > 1:
                    line(cv, q.coords[0], q.coords[-1], 190, 1.0)
            k += step
        distract["hatchRegions"].append([[r4(x), r4(y)] for x, y in (ppx.exterior.coords[:-1] if isinstance(ppx, Polygon) else max(ppx.geoms, key=lambda g: g.area).exterior.coords[:-1])])

    # walls
    parts_px = [plan.to_px_geom(p).intersection(inner_px) for p in plan.partitions]
    if plan.style == "SOLID":
        fill(cv, band_px, INK)
        for p in parts_px:
            fill(cv, p, INK)
    else:  # DOUBLE_LINE: faces as thin lines, the wall body hatched at 45 degrees
        walls = unary_union([band_px] + parts_px)
        x0, y0, x1, y1 = walls.bounds
        k = x0 - (y1 - y0)
        while k < x1:
            s = LineString([(k, y1), (k + (y1 - y0), y0)]).intersection(walls)
            for q in getattr(s, "geoms", [s]):
                if not q.is_empty and q.length > 1 and q.geom_type == "LineString":
                    line(cv, q.coords[0], q.coords[-1], 120, 1.0)
            k += 7
        for g in getattr(walls, "geoms", [walls]):
            for ring in [g.exterior] + list(g.interiors):
                c = list(ring.coords)
                for i in range(len(c) - 1):
                    line(cv, c[i], c[i + 1], INK, 2.0)

    # openings: erase the wall across the opening, then draw what fills it
    open_runs = []
    edges_F = edges_of(Fpx) if isinstance(Fpx, Polygon) else []
    for o in plan.openings:
        a = np.array(plan.P(*o["a"]))
        b = np.array(plan.P(*o["b"]))
        u = (b - a) / np.linalg.norm(b - a)
        n = np.array([-u[1], u[0]])
        # inward normal: towards the inner polygon
        mid = (a + b) / 2
        from shapely.geometry import Point
        if not Fpx.contains(Point(*(mid + n * t * 0.5))):
            n = -n
        quad = Polygon([tuple(a - n * 1.5), tuple(b - n * 1.5), tuple(b + n * (t + 1.5)), tuple(a + n * (t + 1.5))])
        fill(cv, quad, PAPER)
        kind = o["kind"]
        if kind in ("WINDOW", "GLAZED"):
            for f in (0.0, 0.4, 0.6) if kind == "WINDOW" else (0.35, 0.65):
                line(cv, a + n * t * f, b + n * t * f, INK, 1.0)
            line(cv, a, a + n * t, INK, 1.0)
            line(cv, b, b + n * t, INK, 1.0)
        elif kind == "DOOR":
            hinge = a + n * t
            tip = hinge + n * np.linalg.norm(b - a)
            line(cv, hinge, tip, INK, 1.5)
            rr = float(np.linalg.norm(b - a))
            ang0 = math.degrees(math.atan2(n[1], n[0]))
            ang1 = math.degrees(math.atan2(u[1], u[0]))
            lo, hi = sorted([ang0, ang1])
            if hi - lo > 180:
                lo, hi = hi, lo + 360
            cv2.ellipse(cv, tuple(np.round(hinge * SS).astype(int)), (int(rr * SS), int(rr * SS)), 0, lo, hi, 110, SS)
        elif kind == "GARAGE_DOOR":
            line(cv, a + n * 0.5, b + n * 0.5, INK, 1.5, dashed=(10, 6))
        open_runs.append({"kind": kind, "a": [r4(a[0]), r4(a[1])], "b": [r4(b[0]), r4(b[1])]})

    # room labels and other text
    for s, at, scale, halo in plan.texts:
        distract["textBoxes"].append(list(map(r4, text(cv, s, plan.P(*at), scale, INK, halo))))

    # dimension chains on all four sides, plus any extra close chains
    if plan.dims:
        x0, y0, x1, y1 = Fpx.bounds
        xs = sorted(set([round(x, 3) for x, _ in Fpx.exterior.coords]))
        ys = sorted(set([round(y, 3) for _, y in Fpx.exterior.coords]))
        chains = [("H", y0 - off * PXM, xs, y0) for off in plan.dim_offsets] + [("H", y1 + off * PXM, xs, y1) for off in plan.dim_offsets[:1]]
        chains += [("V", x0 - off * PXM, ys, x0) for off in plan.dim_offsets] + [("V", x1 + off * PXM, ys, x1) for off in plan.dim_offsets[:1]]
        for axis, off in plan.extra_dims:
            if axis == "H":
                chains.append(("H", y1 + off * PXM, xs, y1))
            else:
                chains.append(("V", x1 + off * PXM, ys, x1))
        for k, (axis, at, ticks, face) in enumerate(chains):
            full = k % 2 == 1 and k < 2 * len(plan.dim_offsets)
            tk = [ticks[0], ticks[-1]] if full else ticks
            if axis == "H":
                a, b = (tk[0] - 6, at), (tk[-1] + 6, at)
                line(cv, a, b, 40, 1.0)
                distract["dimensionLines"].append([[r4(a[0]), r4(a[1])], [r4(b[0]), r4(b[1])]])
                for x in tk:
                    line(cv, (x - 4, at + 4), (x + 4, at - 4), 40, 1.5)
                    e0, e1 = (x, face + (-8 if at < face else 8)), (x, at + (-5 if at < face else 5))
                    line(cv, e0, e1, 90, 1.0)
                    distract["dimensionLines"].append([[r4(e0[0]), r4(e0[1])], [r4(e1[0]), r4(e1[1])]])
                for p0, p1 in zip(tk[:-1], tk[1:]):
                    if p1 - p0 > 25:
                        distract["textBoxes"].append(list(map(r4, text(cv, str(int(round((p1 - p0) / PXM * 100))), ((p0 + p1) / 2 - 10, at - 4), 0.4, 40))))
            else:
                a, b = (at, tk[0] - 6), (at, tk[-1] + 6)
                line(cv, a, b, 40, 1.0)
                distract["dimensionLines"].append([[r4(a[0]), r4(a[1])], [r4(b[0]), r4(b[1])]])
                for y in tk:
                    line(cv, (at - 4, y + 4), (at + 4, y - 4), 40, 1.5)
                    e0, e1 = (face + (-8 if at < face else 8), y), (at + (-5 if at < face else 5), y)
                    line(cv, e0, e1, 90, 1.0)
                    distract["dimensionLines"].append([[r4(e0[0]), r4(e0[1])], [r4(e1[0]), r4(e1[1])]])
                for p0, p1 in zip(tk[:-1], tk[1:]):
                    if p1 - p0 > 25:
                        distract["textBoxes"].append(list(map(r4, text(cv, str(int(round((p1 - p0) / PXM * 100))), (at - 30, (p0 + p1) / 2 + 4), 0.4, 40))))

    img = cv2.resize(cv, (plan.W, plan.H), interpolation=cv2.INTER_AREA)

    # truth (1x pixels)
    face_lines = []
    walls_union = unary_union([band_px] + [p for p in parts_px if not p.is_empty])
    for g in getattr(walls_union, "geoms", [walls_union]):
        for ring in [g.exterior] + list(g.interiors):
            c = list(ring.coords)
            for i in range(len(c) - 1):
                face_lines.append([[r4(c[i][0]), r4(c[i][1])], [r4(c[i + 1][0]), r4(c[i + 1][1])]])
    bodies = []
    for kind, p in plan.bodies:
        bp = plan.to_px_geom(p).intersection(Fpx)
        if not bp.is_empty:
            g = bp if isinstance(bp, Polygon) else max(bp.geoms, key=lambda q: q.area)
            bodies.append({"kind": kind, "polygon": [[r4(x), r4(y)] for x, y in g.exterior.coords[:-1]]})
    excl = [{"kind": k, "polygon": [[r4(x), r4(y)] for x, y in g.exterior.coords[:-1]]} for k, g in plan.exclusions]
    for q in plan.pockets:
        qp = plan.to_px_geom(q)
        excl.append({"kind": "RECESS", "polygon": [[r4(x), r4(y)] for x, y in qp.exterior.coords[:-1]]})
    rooms = []
    room_space = inner_px.difference(unary_union([p for p in parts_px if not p.is_empty])) if parts_px else inner_px
    for g in getattr(room_space, "geoms", [room_space]):
        if g.area > (1.0 * PXM) ** 2:
            rooms.append([[r4(x), r4(y)] for x, y in g.exterior.coords[:-1]])
    truth = {
        "exterior": [[r4(x), r4(y)] for x, y in Fpx.exterior.coords[:-1]],
        "innerFace": [[[r4(x), r4(y)] for x, y in g.exterior.coords[:-1]] for g in getattr(inner_px, "geoms", [inner_px])],
        "exteriorWallThicknessPx": r4(t),
        "partitionThicknessPx": r4(T_INT * PXM),
        "wallFaceLines": face_lines,
        "bodies": bodies,
        "exclusions": excl,
        "openings": open_runs,
        "rooms": rooms,
        "distractors": distract,
    }
    return img, truth


# --- degradations: (image, truth) -> (image, truth); geometry maps through the same affine ---------------------------
def map_pts(pts, M):
    a = np.array(pts, dtype=float).reshape(-1, 2)
    b = a @ M[:, :2].T + M[:, 2]
    return [[r4(x), r4(y)] for x, y in b]


def map_truth(truth, M):
    t = json.loads(json.dumps(truth))
    t["exterior"] = map_pts(t["exterior"], M)
    t["innerFace"] = [map_pts(r, M) for r in t["innerFace"]]
    t["wallFaceLines"] = [map_pts(s, M) for s in t["wallFaceLines"]]
    for b in t["bodies"]:
        b["polygon"] = map_pts(b["polygon"], M)
    for e in t["exclusions"]:
        e["polygon"] = map_pts(e["polygon"], M)
    for o in t["openings"]:
        o["a"], o["b"] = map_pts([o["a"], o["b"]], M)
    t["rooms"] = [map_pts(r, M) for r in t["rooms"]]
    d = t["distractors"]
    for k in ("dimensionLines", "terraceLines", "pergolaLines"):
        d[k] = [map_pts(s, M) for s in d[k]]
    d["hatchRegions"] = [map_pts(r, M) for r in d["hatchRegions"]]
    boxes = []
    for x0, y0, x1, y1 in d["textBoxes"]:
        q = np.array(map_pts([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], M))
        boxes.append([r4(q[:, 0].min()), r4(q[:, 1].min()), r4(q[:, 0].max()), r4(q[:, 1].max())])
    d["textBoxes"] = boxes
    return t


def rotate(img, truth, deg):
    H, W = img.shape
    M = cv2.getRotationMatrix2D((W / 2, H / 2), deg, 1.0)
    out = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=PAPER)
    return out, map_truth(truth, M)


def crop(img, truth, x0, y0, x1, y1):
    M = np.array([[1.0, 0, -x0], [0, 1.0, -y0]])
    return img[y0:y1, x0:x1].copy(), map_truth(truth, M)


# --- the cases --------------------------------------------------------------------------------------------------------
def rect(x0, y0, x1, y1):
    return box(x0, y0, x1, y1)


def standard_content(p, w, d, front_y=None):
    """Partitions, room labels and openings for a w x d main body at (0,0)."""
    p.partitions += [rect(w * 0.55, 0, w * 0.55 + T_INT, d), rect(0, d * 0.5, w * 0.55, d * 0.5 + T_INT)]
    p.texts += [("1 Salon", (w * 0.65, d * 0.5), 0.45, False), ("2 Kuchnia", (0.8, d * 0.25), 0.45, False), ("3 Pokoj", (0.8, d * 0.75), 0.45, False)]
    fy = d if front_y is None else front_y
    p.openings += [
        {"kind": "DOOR", "a": (1.2, fy), "b": (2.2, fy)},
        {"kind": "WINDOW", "a": (w * 0.65, fy), "b": (w * 0.65 + 1.5, fy)},
        {"kind": "WINDOW", "a": (w * 0.3, 0), "b": (w * 0.3 + 1.4, 0)},
        {"kind": "WINDOW", "a": (0, d * 0.25), "b": (0, d * 0.25 + 1.2)},
        {"kind": "WINDOW", "a": (w, d * 0.6), "b": (w, d * 0.6 + 1.6)},
    ]


def case_rect(seed):
    p = Plan("rect", seed)
    p.bodies.append(("MAIN", rect(0, 0, 10, 8)))
    standard_content(p, 10, 8)
    return p


def case_l(seed, cid="l-shape"):
    p = Plan(cid, seed)
    p.bodies.append(("MAIN", rect(0, 0, 10, 7)))
    p.bodies.append(("WING", rect(0, 7, 5, 11)))
    standard_content(p, 10, 7, front_y=None)
    p.openings = [o for o in p.openings if not (o["a"][1] == 7 and o["a"][0] < 5)]
    p.openings += [{"kind": "WINDOW", "a": (1.5, 11), "b": (3.0, 11)}, {"kind": "DOOR", "a": (6.5, 7), "b": (7.5, 7)}]
    p.partitions.append(rect(0, 9, 5, 9 + T_INT))
    p.texts.append(("4 Sypialnia", (1.0, 10.2), 0.45, False))
    return p


def case_u(seed):
    p = Plan("u-shape", seed)
    p.bodies += [("MAIN", rect(0, 0, 12, 4)), ("WING", rect(0, 4, 4, 10)), ("WING", rect(8, 4, 12, 10))]
    p.exclusions.append(("COURTYARD", None))
    p.partitions += [rect(4, 0, 4 + T_INT, 4), rect(8, 0, 8 + T_INT, 4)]
    p.openings += [{"kind": "WINDOW", "a": (5, 4), "b": (7, 4)}, {"kind": "DOOR", "a": (4, 6), "b": (4, 7)}, {"kind": "WINDOW", "a": (1, 10), "b": (2.5, 10)}, {"kind": "WINDOW", "a": (9.5, 10), "b": (11, 10)}, {"kind": "WINDOW", "a": (5, 0), "b": (7, 0)}]
    p.texts += [("1 Hol", (5.2, 2), 0.45, False), ("2 Pokoj", (0.6, 7), 0.45, False), ("3 Pokoj", (8.6, 7), 0.45, False)]
    return p


def case_bay(seed):
    p = Plan("bay-window", seed)
    p.bodies.append(("MAIN", rect(0, 0, 10, 8)))
    bay = Polygon([(3.5, 8), (6.5, 8), (5.8, 9.2), (4.2, 9.2)])
    p.bodies.append(("BAY", bay))
    standard_content(p, 10, 8)
    p.openings = [o for o in p.openings if not (o["a"][1] == 8 and 3 < o["a"][0] < 7)]
    p.openings += [{"kind": "GLAZED", "a": (4.45, 9.2), "b": (5.55, 9.2)}, {"kind": "GLAZED", "a": (6.32, 8.3), "b": (5.95, 8.95)}, {"kind": "GLAZED", "a": (3.68, 8.3), "b": (4.05, 8.95)}]
    return p


def case_garage(seed, cid="attached-garage", door=3.0):
    p = Plan(cid, seed, size=(1000, 900))
    p.bodies.append(("MAIN", rect(0, 0, 10, 8)))
    p.bodies.append(("GARAGE", rect(10, 1, 14.4, 8)))
    standard_content(p, 10, 8)
    p.openings = [o for o in p.openings if o["a"][0] != 10]
    g0 = 10 + (4.4 - door) / 2
    p.openings += [{"kind": "GARAGE_DOOR", "a": (g0, 8), "b": (g0 + door, 8)}]
    # the wall between house and garage (a partition of the footprint: it is not on the outer face), with a doorway
    p.partitions += [rect(10 - 0.25, 1, 10, 3), rect(10 - 0.25, 4, 10, 8)]
    p.texts.append(("5 Garaz", (11.0, 4.5), 0.45, False))
    return p


def case_recess(seed):
    p = Plan("recessed-entrance", seed)
    p.bodies.append(("MAIN", rect(0, 0, 10, 8)))
    p.pockets.append(rect(1.0, 6.5, 3.4, 8))
    standard_content(p, 10, 8)
    p.openings = [o for o in p.openings if not (o["kind"] == "DOOR" and o["a"][1] == 8)]
    p.openings.append({"kind": "DOOR", "a": (1.7, 6.5), "b": (2.7, 6.5)})
    return p


def case_terrace(seed):
    p = Plan("terrace-adjacent", seed, size=(950, 900))
    p.bodies.append(("MAIN", rect(0, 0, 10, 8)))
    standard_content(p, 10, 8)
    p.terraces.append(rect(10, 1.5, 14, 7.5))
    p.openings = [o for o in p.openings if o["a"][0] != 10]
    p.openings.append({"kind": "GLAZED", "a": (10, 3), "b": (10, 6)})
    return p


def case_pergola(seed):
    p = Plan("pergola-outside", seed, size=(950, 900))
    p.bodies.append(("MAIN", rect(0, 0, 10, 8)))
    standard_content(p, 10, 8)
    p.pergolas.append(rect(10.2, 1.0, 14.0, 7.0))
    return p


def case_connector(seed):
    p = Plan("narrow-connector", seed, size=(1000, 900))
    p.bodies += [("MAIN", rect(0, 0, 7, 7)), ("CONNECTOR", rect(7, 2.5, 9, 4.1)), ("WING", rect(9, 1, 14, 6))]
    p.partitions.append(rect(0, 3.5, 7, 3.5 + T_INT))
    p.openings += [{"kind": "WINDOW", "a": (2, 0), "b": (3.5, 0)}, {"kind": "DOOR", "a": (2, 7), "b": (3, 7)}, {"kind": "WINDOW", "a": (11, 6), "b": (12.4, 6)}, {"kind": "WINDOW", "a": (14, 2.5), "b": (14, 4)}]
    p.texts += [("1 Dom", (2, 2), 0.45, False), ("2 Studio", (10, 3.5), 0.45, False)]
    return p


def case_glazed(seed):
    p = Plan("glazed-facade", seed)
    p.bodies.append(("MAIN", rect(0, 0, 11, 8)))
    p.partitions.append(rect(6, 0, 6 + T_INT, 8))
    x = 0.6
    while x + 1.9 <= 10.6:
        p.openings.append({"kind": "GLAZED", "a": (x, 8), "b": (x + 1.9, 8)})
        x += 1.9 + 0.25
    p.openings += [{"kind": "DOOR", "a": (1, 0), "b": (2, 0)}, {"kind": "WINDOW", "a": (11, 3), "b": (11, 4.5)}]
    p.texts += [("1 Salon", (2, 4), 0.45, False), ("2 Pokoj", (7.5, 4), 0.45, False)]
    return p


def case_windows(seed):
    p = Plan("windows-long-facade", seed, size=(1050, 800))
    p.bodies.append(("MAIN", rect(0, 0, 16, 7)))
    p.partitions += [rect(5, 0, 5 + T_INT, 7), rect(10.5, 0, 10.5 + T_INT, 7)]
    for k in range(6):
        x0 = 0.9 + k * 2.6
        p.openings.append({"kind": "WINDOW", "a": (x0, 7), "b": (x0 + 1.4, 7)})
    p.openings += [{"kind": "DOOR", "a": (7, 0), "b": (8, 0)}, {"kind": "WINDOW", "a": (2, 0), "b": (3.5, 0)}]
    p.texts += [("1", (2, 3.5), 0.45, False), ("2", (7.5, 3.5), 0.45, False), ("3", (13, 3.5), 0.45, False)]
    return p


def case_double(seed):
    p = case_l(seed, "double-line-walls")
    p.style = "DOUBLE_LINE"
    return p


def case_partitions(seed):
    p = case_rect(seed)
    p.case_id = "interior-partitions-near-exterior"
    p.partitions += [rect(0.4 + 0.35, 0.4, 0.4 + 0.35 + T_INT, 6.5), rect(0.4, 0.4 + 0.45, 9.6, 0.4 + 0.45 + T_INT), rect(9.6 - 0.6 - T_INT, 2.0, 9.6 - 0.6, 7.6)]
    return p


def case_dims_close(seed):
    p = case_rect(seed)
    p.case_id = "dimension-lines-near-facade"
    p.dim_offsets = (0.45, 0.9)
    p.extra_dims = [("H", 0.25), ("V", 0.25)]
    return p


def case_hatch(seed):
    p = case_rect(seed)
    p.case_id = "hatch-floor-patterns"
    p.tiles += [rect(0, 0, 5.5, 4), rect(5.6, 0, 10, 8)]
    p.terraces.append(rect(1, 8, 9, 10.5))
    p.openings = [o for o in p.openings if not (o["kind"] == "WINDOW" and o["a"][1] == 8)]
    return p


def case_text(seed):
    p = case_rect(seed)
    p.case_id = "text-crossing-walls"
    p.texts += [("POW. 12,40 m2", (-0.6, 5.2), 0.5, True), ("Strefa wejscia", (7.2, 8.15), 0.5, True), ("h=2,60", (4.5, 0.15), 0.5, True)]
    return p


CASES = [
    ("rect", 101, case_rect, None),
    ("l-shape", 102, case_l, None),
    ("u-shape", 103, case_u, None),
    ("bay-window", 104, case_bay, None),
    ("attached-garage", 105, case_garage, None),
    ("recessed-entrance", 106, case_recess, None),
    ("terrace-adjacent", 107, case_terrace, None),
    ("pergola-outside", 108, case_pergola, None),
    ("narrow-connector", 109, case_connector, None),
    ("garage-door-interruption", 110, lambda s: case_garage(s, "garage-door-interruption", 3.9), None),
    ("glazed-facade", 111, case_glazed, None),
    ("windows-long-facade", 112, case_windows, None),
    ("double-line-walls", 113, case_double, None),
    ("interior-partitions-near-exterior", 114, case_partitions, None),
    ("dimension-lines-near-facade", 115, case_dims_close, None),
    ("hatch-floor-patterns", 116, case_hatch, None),
    ("text-crossing-walls", 117, case_text, None),
    ("scan-blur", 118, case_l, "BLUR"),
    ("jpeg-compression", 119, case_l, "JPEG"),
    ("low-contrast", 120, case_l, "LOWCONTRAST"),
    ("skew", 121, case_l, "SKEW"),
    ("rotated-plan", 122, case_l, "ROTATE"),
    ("partial-crop", 123, case_l, "CROP"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    gen_hash = hashlib.sha256(open(__file__, "rb").read()).hexdigest()
    corpus = {"researchOnly": "BUILDPLAN-ANALYZER-005I synthetic boundary corpus (research only)", "generatorSha256": gen_hash, "opencv": cv2.__version__, "numpy": np.__version__, "pxPerM": PXM, "supersampling": SS, "exteriorWallM": T_EXT, "partitionM": T_INT, "cases": []}
    for cid, seed, fn, deg in CASES:
        p = fn(seed)
        p.case_id = cid
        if cid == "u-shape":
            p.exclusions = []
        img, truth = render(p)
        if cid == "u-shape":
            Fpx = p.to_px_geom(p.footprint())
            court = p.to_px_geom(rect(4, 4, 8, 10)).difference(Fpx.buffer(0.5))
            truth["exclusions"].append({"kind": "COURTYARD", "polygon": [[r4(x), r4(y)] for x, y in court.exterior.coords[:-1]]})
        rng = np.random.RandomState(seed)
        ext = "png"
        if deg == "BLUR":
            img = cv2.GaussianBlur(img, (0, 0), 1.6)
            img = np.clip(img.astype(float) + rng.normal(0, 6, img.shape), 0, 255).astype(np.uint8)
        elif deg == "LOWCONTRAST":
            img = np.clip(PAPER - (PAPER - img.astype(float)) * 0.3, 0, 255).astype(np.uint8)
        elif deg == "SKEW":
            img, truth = rotate(img, truth, 1.5)
        elif deg == "ROTATE":
            img, truth = rotate(img, truth, 25.0)
        elif deg == "CROP":
            img, truth = crop(img, truth, 0, 0, 470, 900)
        rgb = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        if deg == "JPEG":
            ok, enc = cv2.imencode(".jpg", rgb, [cv2.IMWRITE_JPEG_QUALITY, 30])
            ext = "jpg"
            data = enc.tobytes()
        else:
            ok, enc = cv2.imencode(".png", rgb)
            data = enc.tobytes()
        path = os.path.join(a.out, "%s.%s" % (cid, ext))
        open(path, "wb").write(data)
        truth.update({"caseId": cid, "seed": seed, "degradation": deg, "pxPerM": PXM if deg not in ("CROP",) else PXM, "metresPerPx": r4(1 / PXM), "size": [int(img.shape[1]), int(img.shape[0])], "researchOnly": True})
        json.dump(truth, open(os.path.join(a.out, "%s.truth.json" % cid), "w"), sort_keys=True)
        corpus["cases"].append({"id": cid, "seed": seed, "degradation": deg, "file": os.path.basename(path), "sha256": hashlib.sha256(data).hexdigest(), "truthSha256": hashlib.sha256(open(os.path.join(a.out, "%s.truth.json" % cid), "rb").read()).hexdigest()})
    json.dump(corpus, open(os.path.join(a.out, "corpus.json"), "w"), sort_keys=True, indent=1)
    print("wrote %d cases to %s" % (len(corpus["cases"]), a.out))


if __name__ == "__main__":
    main()
