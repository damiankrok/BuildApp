"""score.py — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B). The bake-off scorer.

python -I -B score.py --set real|synthetic --work /home/user/work005i --truth <dir> --out <per-frame metrics json>

Implements methodology.md §6–§9 exactly (tolerances, metrics, failure types, scorecard rules, evidence availability).
Reads observations written by the providers and by baseline.ts, truth (synthetic: generator; real: manual), the
production ink mask of each frame, MobileSAM masks and the fusion replay outputs. Writes numbers only.

Post-review additions (council B, methodology §11): the same-input rule is asserted on every provider and fusion
output (B5); real-set numbers are re-scored against the truth displaced by ±u, u = the house's largest stated vertex
uncertainty (B3); SCV-UNION sensitivity rows (no bridged gaps, ink-supported segments only) and the mask "one wall
inward" evidence rule as written in §9 (B8).
"""
import argparse
import glob
import hashlib
import json
import math
import os

import cv2
import numpy as np
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ANG = 3.0  # degrees
LINE_CONFIGS = [
    ("SCV-LINES", "source-cv/{set}/{id}.json", "SCV-LINES"),
    ("ELSED-DEFAULT", "elsed/{set}/{id}.json", None),
    ("DEEPLSD-MD", "deeplsd/{set}/{id}.md.json", None),
    ("DEEPLSD-WF", "deeplsd/{set}/{id}.wf.json", None),
    ("DEEPLSD-MD-REFINE-SCV", "deeplsd/{set}/{id}.md-refine-scv.json", None),
]
UNION_CONFIGS = ("SCV-LINES", "SCV-WALL", "SCV-BOUNDARY")


def r(x, n=4):
    return None if x is None else round(float(x), n)


def load(path):
    with open(path) as f:
        return json.load(f)


def seg_list(obs, config=None):
    out = []
    for o in obs:
        g = o.get("geometry") or {}
        if g.get("type") != "SEGMENT":
            continue
        if config and o["configId"] != config:
            continue
        out.append((np.array(g["a"], float), np.array(g["b"], float), o))
    return out


def angle_of(a, b):
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180.0


def ang_diff(x, y):
    d = abs(x - y) % 180.0
    return min(d, 180.0 - d)


class Edge:
    def __init__(self, a, b, inside_poly, openings, t, tau):
        self.a, self.b = np.array(a, float), np.array(b, float)
        v = self.b - self.a
        self.L = float(np.linalg.norm(v))
        self.u = v / self.L
        n = np.array([-self.u[1], self.u[0]])
        mid = (self.a + self.b) / 2
        self.n_in = n if inside_poly.buffer(0.01).contains(Point(*(mid + n * 1.0))) else -n
        self.ang = angle_of(self.a, self.b)
        self.t, self.tau = t, tau
        self.ts = np.arange(0.5, self.L, 1.0)
        self.opening = np.zeros(len(self.ts), bool)
        self.opening_kind = np.array([""] * len(self.ts), dtype=object)
        for o in openings:
            pa, pb = np.array(o["a"], float), np.array(o["b"], float)
            da = abs(np.dot(pa - self.a, self.n_in))
            db = abs(np.dot(pb - self.a, self.n_in))
            if da > 3 or db > 3 or ang_diff(angle_of(pa, pb), self.ang) > 5:
                continue
            ta, tb = sorted([np.dot(pa - self.a, self.u), np.dot(pb - self.a, self.u)])
            m = (self.ts >= ta) & (self.ts <= tb)
            self.opening |= m
            self.opening_kind[m] = o["kind"]

    def support(self, p, q):
        """(covered sample mask, mean offset, interval) if segment p-q supports this edge, else None."""
        if ang_diff(angle_of(p, q), self.ang) > ANG:
            return None
        dp, dq = np.dot(p - self.a, self.n_in), np.dot(q - self.a, self.n_in)
        lo, hi = -self.tau, self.t + self.tau
        if not (lo <= dp <= hi and lo <= dq <= hi):
            return None
        tp, tq = np.dot(p - self.a, self.u), np.dot(q - self.a, self.u)
        t0, t1 = min(tp, tq), max(tp, tq)
        if t1 < 0 or t0 > self.L:
            return None
        return (self.ts >= t0) & (self.ts <= t1), (dp + dq) / 2, (t0, t1)


def ink_support(segs, ink_dil):
    H, W = ink_dil.shape
    res = []
    for a, b, _ in segs:
        L = float(np.linalg.norm(b - a))
        n = max(2, int(math.ceil(L)))
        xs = np.clip(np.round(np.linspace(a[0], b[0], n)).astype(int), 0, W - 1)
        ys = np.clip(np.round(np.linspace(a[1], b[1], n)).astype(int), 0, H - 1)
        res.append(float(ink_dil[ys, xs].mean()))
    return res


def line_metrics(segs, edges, mpp, ink_dil, truth, set_name, poly, union_cov=None, union_segs=None):
    n = len(segs)
    lengths = [float(np.linalg.norm(b - a)) for a, b, _ in segs]
    ink = ink_support(segs, ink_dil) if n else []
    supported_ink = [s >= 0.5 for s in ink]
    long_enough = [L >= 10 for L in lengths]
    unsup = [(not s) and le for s, le in zip(supported_ink, long_enough)]
    cov, cov_ink = [], []
    support_info = []  # (edge index, seg index, offset, interval, length, angle diff)
    for ei, e in enumerate(edges):
        c = np.zeros(len(e.ts), bool)
        ci = np.zeros(len(e.ts), bool)
        for si, (a, b, _) in enumerate(segs):
            s = e.support(a, b)
            if s is None:
                continue
            m, off, iv = s
            c |= m
            if supported_ink[si]:
                ci |= m
            support_info.append((ei, si, off, iv, lengths[si], ang_diff(angle_of(a, b), e.ang)))
        cov.append(c)
        cov_ink.append(ci)
    solid_tot = sum(int((~e.opening).sum()) for e in edges)
    open_tot = sum(int(e.opening.sum()) for e in edges)
    solid_cov = sum(int((c & ~e.opening).sum()) for c, e in zip(cov, edges))
    open_cov = sum(int((c & e.opening).sum()) for c, e in zip(cov, edges))
    # long walls
    long_rec = []
    for ei, e in enumerate(edges):
        if (~e.opening).sum() * mpp < 3.0:
            continue
        best = 0.0
        for (k, si, off, iv, L, ad) in support_info:
            if k == ei:
                best = max(best, (min(iv[1], e.L) - max(iv[0], 0)) / e.L)
        long_rec.append(best)
    # corners
    corner_err, corners_missing, corners = [], 0, 0
    ne = len(edges)
    for i in range(ne):
        e_prev, e_next = edges[i - 1], edges[i]
        tt = e_next.t
        near_open = e_next.opening[e_next.ts <= tt].any() or e_prev.opening[e_prev.ts >= e_prev.L - tt].any()
        if near_open:
            continue
        corners += 1
        best = None
        for (k, si, off, iv, L, ad) in support_info:
            if k == i and iv[0] <= 3 * tt:
                err = abs(iv[0])
            elif k == (i - 1) % ne and iv[1] >= e_prev.L - 3 * tt:
                err = abs(iv[1] - e_prev.L)
            else:
                continue
            best = err if best is None else min(best, err)
        if best is None:
            corners_missing += 1
        else:
            corner_err.append(best)
    # angular error, fragmentation, duplicates
    tot_len = sum(L for (_, _, _, _, L, _) in support_info)
    ang_err = sum(L * ad for (_, _, _, _, L, ad) in support_info) / tot_len if tot_len else None
    covered_m = (solid_cov + open_cov) * mpp
    dup = 0
    by_edge = {}
    for item in support_info:
        by_edge.setdefault(item[0], []).append(item)
    for items in by_edge.values():
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                ov = min(a[3][1], b[3][1]) - max(a[3][0], b[3][0])
                if abs(a[2] - b[2]) <= 2 and ov >= 0.5 * min(a[3][1] - a[3][0], b[3][1] - b[3][0]):
                    dup += 1
    out = {
        "count": n,
        "countSupportingExterior": len(support_info),
        "exteriorWallCoverage": r(solid_cov / solid_tot) if solid_tot else None,
        "continuityAcrossOpenings": r(open_cov / open_tot) if open_tot else None,
        "longWallRecovery": r(np.mean(long_rec)) if long_rec else None,
        "longWalls": len(long_rec),
        "cornerEndpointErrorMedianPx": r(np.median(corner_err), 2) if corner_err else None,
        "cornersWithoutSegment": corners_missing,
        "corners": corners,
        "angularErrorDeg": r(ang_err, 3),
        "fragmentationSegmentsPerMetre": r(len(support_info) / covered_m, 3) if covered_m else None,
        "duplicateRate": r(dup / len(support_info), 3) if support_info else None,
        "unsupportedLineRate": r(sum(unsup) / max(1, sum(long_enough)), 4),
        "unsupportedLengthPx": r(sum(L for L, u in zip(lengths, unsup) if u), 1),
    }
    # distractors
    if set_name == "synthetic":
        d = truth["distractors"]
        lines = [np.array(s, float) for k in ("dimensionLines", "terraceLines", "pergolaLines") for s in d[k]]
        boxes = [Polygon([(b[0], b[1]), (b[2], b[1]), (b[2], b[3]), (b[0], b[3])]) for b in d["textBoxes"]]
        hatches = [Polygon(h) for h in d["hatchRegions"] if len(h) >= 3]
        zone = unary_union([g.buffer(0) for g in boxes + hatches]) if (boxes or hatches) else None
        fl_n, fl_len = 0, 0.0
        for (a, b, _), L in zip(segs, lengths):
            if L < 10:
                continue
            hit = False
            for ln in lines:
                if ang_diff(angle_of(a, b), angle_of(ln[0], ln[1])) > ANG:
                    continue
                u = (ln[1] - ln[0]) / (np.linalg.norm(ln[1] - ln[0]) + 1e-9)
                nn = np.array([-u[1], u[0]])
                if abs(np.dot(a - ln[0], nn)) <= 2 and abs(np.dot(b - ln[0], nn)) <= 2:
                    ta, tb = sorted([np.dot(a - ln[0], u), np.dot(b - ln[0], u)])
                    if tb >= 0 and ta <= np.linalg.norm(ln[1] - ln[0]):
                        hit = True
                        break
            if not hit and zone is not None:
                pts = [Point(*(a + (b - a) * k / 10)) for k in range(11)]
                if sum(zone.contains(p) for p in pts) / 11 >= 0.6:
                    hit = True
            if hit:
                fl_n += 1
                fl_len += L
        out["falseLinesDistractors"] = fl_n
        out["falseLinesDistractorsLengthPx"] = r(fl_len, 1)
        # supported line recall over all wall faces (exact truth), openings removed
        t = truth["exteriorWallThicknessPx"]
        tau = max(3.0, 0.25 * t)
        op_lines = [LineString([o["a"], o["b"]]) for o in truth["openings"]]
        tot, hit_n = 0, 0
        for fl in truth["wallFaceLines"]:
            p0, p1 = np.array(fl[0], float), np.array(fl[1], float)
            L = float(np.linalg.norm(p1 - p0))
            if L < 1:
                continue
            u = (p1 - p0) / L
            ts = np.arange(0.5, L, 1.0)
            pts = p0[None, :] + ts[:, None] * u[None, :]
            keep = np.array([min((ol.distance(Point(*p)) for ol in op_lines), default=1e9) > t + 2 for p in pts]) if op_lines else np.ones(len(pts), bool)
            pts = pts[keep]
            if len(pts) == 0:
                continue
            covered = np.zeros(len(pts), bool)
            fa = angle_of(p0, p1)
            for a, b, _ in segs:
                if ang_diff(angle_of(a, b), fa) > ANG:
                    continue
                v = b - a
                Ls = np.linalg.norm(v)
                if Ls < 1e-6:
                    continue
                us = v / Ls
                ns = np.array([-us[1], us[0]])
                dperp = np.abs((pts - a) @ ns)
                tproj = (pts - a) @ us
                covered |= (dperp <= tau) & (tproj >= -1) & (tproj <= Ls + 1)
            tot += len(pts)
            hit_n += int(covered.sum())
        out["supportedLineRecall"] = r(hit_n / tot) if tot else None
    else:
        Lmin = 1.0 / mpp
        buf = poly.buffer(edges[0].tau if edges else 3)
        dist_n, dist_len = 0, 0.0
        distractor_segs = []
        for (a, b, o), L in zip(segs, lengths):
            if L < Lmin:
                continue
            ls = LineString([tuple(a), tuple(b)])
            if ls.intersects(buf):
                continue
            mid = (a + b) / 2
            for e in edges:
                if ang_diff(angle_of(a, b), e.ang) > ANG:
                    continue
                dperp = abs(np.dot(mid - e.a, e.n_in))
                tm = np.dot(mid - e.a, e.u)
                if dperp <= 3.0 / mpp and -0.0 <= tm <= e.L:
                    dist_n += 1
                    dist_len += L
                    distractor_segs.append((a, b, o))
                    break
        out["boundaryDistractors"] = dist_n
        out["boundaryDistractorsLengthM"] = r(dist_len * mpp, 3)
        out["_distractorSegs"] = distractor_segs
    # lines on the outlines of exclusions (terrace, pergola, porch, paving edges) that are not shared with the building
    ex_len, ex_ids = 0.0, []
    ex_edges = []
    for ex in truth.get("exclusions", []):
        pts_ = ex["polygon"]
        for i_ in range(len(pts_)):
            pa_, pb_ = np.array(pts_[i_], float), np.array(pts_[(i_ + 1) % len(pts_)], float)
            if np.linalg.norm(pb_ - pa_) < 2:
                continue
            mid_ = Point(*((pa_ + pb_) / 2))
            if poly.exterior.distance(mid_) <= edges[0].tau + 1 if edges else False:
                continue
            ex_edges.append((pa_, pb_))
    for si, ((a, b, o), L) in enumerate(zip(segs, lengths)):
        if L < 10 or not supported_ink[si]:
            continue
        for pa_, pb_ in ex_edges:
            if ang_diff(angle_of(a, b), angle_of(pa_, pb_)) > ANG:
                continue
            u_ = (pb_ - pa_) / np.linalg.norm(pb_ - pa_)
            n_ = np.array([-u_[1], u_[0]])
            if abs(np.dot(a - pa_, n_)) <= 3 and abs(np.dot(b - pa_, n_)) <= 3:
                t0_, t1_ = sorted([np.dot(a - pa_, u_), np.dot(b - pa_, u_)])
                ov = min(t1_, np.linalg.norm(pb_ - pa_)) - max(t0_, 0)
                if ov > 0:
                    ex_len += ov
                    ex_ids.append(o["id"])
                    break
    out["exclusionOutlineLinesM"] = r(ex_len * mpp, 3)
    out["_exclusionIds"] = ex_ids
    # additional useful vs SCV-UNION
    if union_cov is not None:
        add_ids = []
        for (k, si, off, iv, L, ad) in support_info:
            e = edges[k]
            m_ = (e.ts >= iv[0]) & (e.ts <= iv[1])
            if supported_ink[si] and (m_ & ~union_cov[k]).sum() >= 3:
                add_ids.append(segs[si][2]["id"])
        out["additionalIds"] = sorted(set(add_ids))[:25]
        add_solid = sum(int((ci & ~uc & ~e.opening).sum()) for ci, uc, e in zip(cov_ink, union_cov, edges))
        add_open = sum(int((ci & ~uc & e.opening).sum()) for ci, uc, e in zip(cov_ink, union_cov, edges))
        out["additionalSolidCoverageM"] = r(add_solid * mpp, 3)
        out["additionalOpeningCoverageM"] = r(add_open * mpp, 3)
        out["additionalSolidCoverageShare"] = r(add_solid / solid_tot) if solid_tot else None
        out["additionalOpeningCoverageShare"] = r(add_open / open_tot) if open_tot else None
    out["_cov"] = cov
    out["_covInk"] = cov_ink
    out["_support"] = support_info
    return out


def union_coverage(edges, scv_obs):
    segs = []
    for o in scv_obs:
        g = o.get("geometry") or {}
        if g.get("type") != "SEGMENT":
            continue
        if o["configId"] in UNION_CONFIGS or (o["configId"] == "SCV-BOUNDARY-GAP" and o["provenance"].get("boundary") in ("STRONG", "WEAK")):
            segs.append((np.array(g["a"], float), np.array(g["b"], float), o))
    cov = []
    for e in edges:
        c = np.zeros(len(e.ts), bool)
        for a, b, _ in segs:
            s = e.support(a, b)
            if s is not None:
                c |= s[0]
        cov.append(c)
    return cov, segs


# ---------------------------------------------------------------- masks
def raster_poly(shape, polys):
    m = np.zeros(shape, np.uint8)
    for p in polys:
        if len(p) >= 3:
            cv2.fillPoly(m, [np.round(np.array(p, float) * 16).astype(np.int32)], 1, lineType=cv2.LINE_8, shift=4)
    return m.astype(bool)


def contour(m):
    k = np.ones((3, 3), np.uint8)
    return m & ~cv2.erode(m.astype(np.uint8), k).astype(bool)


def mask_metrics(M, R, truth, edges_open_lines, tb, excl, bodies, shape, set_name, scv_outline=None):
    Mi, Ri = M.astype(bool), R.astype(bool)
    inter, uni = (Mi & Ri).sum(), (Mi | Ri).sum()
    area_R = Ri.sum()
    out = {"regionIoU": r(inter / uni) if uni else None, "areaRatio": r(Mi.sum() / area_R) if area_R else None}
    d = max(1, int(round(tb)))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * d + 1, 2 * d + 1))
    Gd = Ri & ~cv2.erode(Ri.astype(np.uint8), k).astype(bool)
    Pd = Mi & ~cv2.erode(Mi.astype(np.uint8), k).astype(bool)
    bu = (Gd | Pd).sum()
    out["boundaryIoU"] = r((Gd & Pd).sum() / bu) if bu else None
    cM, cR = contour(Mi), contour(Ri)
    if cM.sum() and cR.sum():
        dR = cv2.distanceTransform((~cR).astype(np.uint8), cv2.DIST_L2, 3)
        dM = cv2.distanceTransform((~cM).astype(np.uint8), cv2.DIST_L2, 3)
        out["boundaryPrecision"] = r((dR[cM] <= tb).mean())
        out["boundaryRecall"] = r((dM[cR] <= tb).mean())
    else:
        out["boundaryPrecision"] = out["boundaryRecall"] = None
    # boundary recall on the exterior opening runs: does the mask's edge follow the facade across its openings?
    if cM.sum() and edges_open_lines:
        dM2 = cv2.distanceTransform((~cM).astype(np.uint8), cv2.DIST_L2, 3)
        hits, tot = 0, 0
        for (oa, ob) in edges_open_lines:
            oa, ob = np.array(oa, float), np.array(ob, float)
            n_ = max(2, int(np.linalg.norm(ob - oa)))
            pts = np.linspace(oa, ob, n_)
            xs = np.clip(np.round(pts[:, 0]).astype(int), 0, shape[1] - 1)
            ys = np.clip(np.round(pts[:, 1]).astype(int), 0, shape[0] - 1)
            hits += int((dM2[ys, xs] <= tb).sum())
            tot += n_
        out["openingRecall"] = r(hits / tot) if tot else None
    else:
        out["openingRecall"] = None
    # exclusions / bodies
    over = {}
    for ex in excl:
        E = raster_poly(shape, [ex["polygon"]]) & ~Ri
        if E.sum() < 20:
            continue
        over.setdefault(ex["kind"], []).append((Mi & E).sum() / E.sum())
    out["overreach"] = {k: r(max(v)) for k, v in over.items()}
    om = {}
    for b in bodies:
        if b["kind"] == "MAIN":
            continue
        B = raster_poly(shape, [b["polygon"]]) & Ri
        if B.sum() < 20:
            continue
        om.setdefault(b["kind"], []).append((Mi & B).sum() / B.sum())
    out["bodyCoverage"] = {k: r(min(v)) for k, v in om.items()}
    out["buildingCoverage"] = r(inter / area_R) if area_R else None
    # leakage through openings
    outside = Mi & ~cv2.dilate(Ri.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * d + 1, 2 * d + 1))).astype(bool)
    if outside.sum() and edges_open_lines:
        op = np.zeros(shape, np.uint8)
        for (a, b) in edges_open_lines:
            cv2.line(op, tuple(int(round(v)) for v in a), tuple(int(round(v)) for v in b), 1, 3)
        solid = cR & ~op.astype(bool)
        d_op = cv2.distanceTransform((op == 0).astype(np.uint8), cv2.DIST_L2, 3)
        d_so = cv2.distanceTransform((~solid).astype(np.uint8), cv2.DIST_L2, 3)
        leak = outside & (d_op < d_so)
        out["openingLeakage"] = r(leak.sum() / area_R)
    else:
        out["openingLeakage"] = 0.0
    out["outsideArea"] = r(outside.sum() / area_R) if area_R else None
    if set_name == "synthetic":
        z = np.zeros(shape, np.uint8)
        for bx in truth["distractors"]["textBoxes"]:
            cv2.rectangle(z, (int(bx[0]), int(bx[1])), (int(bx[2]), int(bx[3])), 1, -1)
        for s in truth["distractors"]["dimensionLines"]:
            cv2.line(z, tuple(int(round(v)) for v in s[0]), tuple(int(round(v)) for v in s[1]), 1, 5)
        zz = z.astype(bool) & ~Ri
        out["textDimensionInclusion"] = r((Mi & zz).sum() / area_R)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(Mi.astype(np.uint8), 8)
    out["components"] = int(n - 1)
    out["significantComponents"] = int(sum(1 for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 0.005 * area_R))
    # failure types (methodology §7.3)
    ft = []
    if Mi.sum() > 2 * area_R:
        ft.append("PAGE_OR_BACKGROUND")
    if Mi.sum() < 0.5 * area_R and Mi.sum() and (Mi & Ri).sum() / Mi.sum() >= 0.9:
        ft.append("INTERNAL_ROOM_SELECTED")
    names = {"TERRACE": "TERRACE_INCLUDED", "PERGOLA": "PERGOLA_INCLUDED", "PORCH": "PORCH_INCLUDED", "RECESS": "RECESS_FILLED", "COURTYARD": "COURTYARD_FILLED"}
    for kk, v in out["overreach"].items():
        if kk in names and v is not None and v >= 0.5:
            ft.append(names[kk])
    bn = {"GARAGE": "GARAGE_EXCLUDED", "BAY": "BAY_DROPPED", "WING": "WING_DROPPED", "CONNECTOR": "CONNECTOR_DROPPED"}
    for kk, v in out["bodyCoverage"].items():
        if kk in bn and v is not None and v < 0.5:
            ft.append(bn[kk])
    if out["openingLeakage"] and out["openingLeakage"] > 0.02:
        ft.append("LEAK_THROUGH_OPENING")
    if set_name == "synthetic" and out.get("textDimensionInclusion", 0) > 0.005:
        ft.append("TEXT_DIMENSIONS_INCLUDED")
    if out["significantComponents"] >= 3:
        ft.append("FRAGMENTED")
    if not ft:
        ft.append("OK" if (out["regionIoU"] or 0) >= 0.9 else "IMPRECISE")
    out["failureTypes"] = ft
    return out


def openings_read_as_wall(pieces, edges, t, tau):
    """Share of the truth exterior opening-run length that a wall-line PIECE (wall-thick ink read along a line)
    covers: an opening the boundary layer reads as solid wall."""
    tot, hit = 0, 0
    for e in edges:
        if not e.opening.any():
            continue
        cov = np.zeros(len(e.ts), bool)
        for pc in pieces:
            a, b = np.array(pc[:2], float), np.array(pc[2:], float)
            if ang_diff(angle_of(a, b), e.ang) > ANG:
                continue
            da, db = np.dot(a - e.a, e.n_in), np.dot(b - e.a, e.n_in)
            if not (-tau <= da <= t + tau and -tau <= db <= t + tau):
                continue
            t0, t1 = sorted([np.dot(a - e.a, e.u), np.dot(b - e.a, e.u)])
            cov |= (e.ts >= t0) & (e.ts <= t1)
        tot += int(e.opening.sum())
        hit += int((cov & e.opening).sum())
    return r(hit / tot) if tot else None


def cells_mask(shape, rings):
    return raster_poly(shape, rings)


def rect_rings(cells):
    return [[[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]] for c in cells]


def sha_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


# ---------------------------------------------------------------- same-input rule (post-review B5)
def check_same_input(d, meta, key, path, extra=None):
    """Methodology §3, machine-checked: a provider output records the SHA-256 of the frame PNG it read, and it must
    equal the hash the extractor recorded for that frame (meta.files). `extra` = {input key: file whose current bytes
    the output must have read} (the refiner's SCV-LINES file, MobileSAM's prompt meta). Any mismatch stops the scorer."""
    want = meta["files"]["grayPngSha256" if key == "gray" else "rgbPngSha256"]
    inp = d.get("input") or {}
    got = (inp.get(key) or {}).get("sha256")
    if got != want:
        raise SystemExit("SAME-INPUT VIOLATION %s: input.%s.sha256 = %s, frame meta = %s" % (path, key, got, want))
    if d.get("frameId") != meta["frameId"]:
        raise SystemExit("FRAME MISMATCH %s: %s vs %s" % (path, d.get("frameId"), meta["frameId"]))
    checked = {key: got}
    for k, f in (extra or {}).items():
        want_k = sha_file(f)
        got_k = (inp.get(k) or {}).get("sha256")
        if got_k != want_k:
            raise SystemExit("SAME-INPUT VIOLATION %s: input.%s.sha256 = %s, current %s = %s" % (path, k, got_k, f, want_k))
        checked[k] = got_k
    return checked


# ---------------------------------------------------------------- truth buffer (post-review B3, methodology §6.3)
def buffer_truth(truth, d):
    """The truth displaced by d px along the outward normal (d > 0 grows the building, d < 0 shrinks it): the exterior
    polygon buffered with mitred joins, and every exterior opening run translated with the face it lies on. Exclusions
    and bodies are separate annotations and stay as drawn. d = ±u with u = the house's largest stated vertex
    uncertainty moves every vertex by the worst stated amount at once (conservative)."""
    poly = Polygon(truth["exterior"]).buffer(0)
    ring = truth["exterior"]
    t = float(truth["exteriorWallThicknessPx"])
    tau = max(3.0, 0.25 * t)
    edges0 = [Edge(ring[i], ring[(i + 1) % len(ring)], poly, [], t, tau) for i in range(len(ring))]
    P = poly.buffer(d, join_style=2, mitre_limit=10.0)
    if P.geom_type != "Polygon":
        P = max(P.geoms, key=lambda g: g.area)
    ext = [[float(x), float(y)] for x, y in list(P.exterior.coords)[:-1]]
    ops = []
    for o in truth["openings"]:
        pa, pb = np.array(o["a"], float), np.array(o["b"], float)
        shift = np.zeros(2)
        for e in edges0:
            if abs(np.dot(pa - e.a, e.n_in)) > 3 or abs(np.dot(pb - e.a, e.n_in)) > 3 or ang_diff(angle_of(pa, pb), e.ang) > 5:
                continue
            ta, tb = sorted([np.dot(pa - e.a, e.u), np.dot(pb - e.a, e.u)])
            if tb < 0 or ta > e.L:
                continue
            shift = -e.n_in * d
            break
        ops.append(dict(o, a=[float(v) for v in pa + shift], b=[float(v) for v in pb + shift]))
    return dict(truth, exterior=ext, openings=ops)


def union_variant_coverage(edges, usegs, ink_dil, drop_gaps=False, ink_only=False):
    """SCV-UNION sensitivity (post-review B8): the union without the resolver's bridged gaps, or with only the union
    segments that pass the same ink-support test the provider additions must pass."""
    keep = [s for s in usegs if not (drop_gaps and s[2]["configId"] == "SCV-BOUNDARY-GAP")]
    if ink_only:
        ok = ink_support(keep, ink_dil)
        keep = [s for s, k in zip(keep, ok) if k >= 0.5]
    cov = []
    for e in edges:
        c = np.zeros(len(e.ts), bool)
        for a_, b_, _ in keep:
            s = e.support(a_, b_)
            if s is not None:
                c |= s[0]
        cov.append(c)
    return cov


def union_cov_summary(cov, edges):
    solid_tot = sum(int((~e.opening).sum()) for e in edges)
    open_tot = sum(int(e.opening.sum()) for e in edges)
    return {"exteriorWallCoverage": r(sum(int((c & ~e.opening).sum()) for c, e in zip(cov, edges)) / solid_tot) if solid_tot else None,
            "continuityAcrossOpenings": r(sum(int((c & e.opening).sum()) for c, e in zip(cov, edges)) / open_tot) if open_tot else None}


WINDOW_KINDS = ("WINDOW", "GLAZED", "DOOR")


def score_truth(truth, ctx, full):
    """Every truth-dependent number of one frame. `full` adds what is only reported at the stated truth (fusion replay,
    prompt sensitivity, the MSAM-AUTO ORACLE bound, the union sensitivity rows)."""
    set_name, meta, shape, ink_dil, scv = ctx["set"], ctx["meta"], ctx["shape"], ctx["ink_dil"], ctx["scv"]
    mpp = truth["metresPerPx"]
    t = float(truth["exteriorWallThicknessPx"])
    tau = max(3.0, 0.25 * t)
    tb = max(3.0, 0.5 * t)
    poly = Polygon(truth["exterior"]).buffer(0)
    ring = truth["exterior"]
    openings = truth["openings"]
    edges = [Edge(ring[i], ring[(i + 1) % len(ring)], poly, openings, t, tau) for i in range(len(ring))]
    edges = [e for e in edges if e.L >= 2]
    ucov, usegs = union_coverage(edges, scv)
    fr = {"frameId": meta["frameId"], "metresPerPx": mpp, "wallPxTruth": t, "tau": tau, "tauB": tb, "exteriorEdges": len(edges),
          "solidLengthM": r(sum((~e.opening).sum() for e in edges) * mpp, 3), "openingLengthM": r(sum(e.opening.sum() for e in edges) * mpp, 3)}
    # SCV-UNION coverage itself
    fr["SCV-UNION"] = union_cov_summary(ucov, edges)
    unions = {}
    if full:
        unions = {"noGapsUnion": union_variant_coverage(edges, usegs, ink_dil, drop_gaps=True), "inkOnlyUnion": union_variant_coverage(edges, usegs, ink_dil, ink_only=True)}
        fr["SCV-UNION-SENSITIVITY"] = {k: union_cov_summary(v, edges) for k, v in unions.items()}
    lines = {}
    segs_by_cfg = {}
    for cid, pat, cfg in LINE_CONFIGS:
        if cid not in ctx["prov"]:
            lines[cid] = {"missing": True}
            continue
        d, segs = ctx["prov"][cid]
        segs_by_cfg[cid] = segs
        m = line_metrics(segs, edges, mpp, ink_dil, truth, set_name, poly, ucov if cid != "SCV-LINES" else None, usegs)
        if "perf" in d:
            m["perf"] = d["perf"]
        if unions and cid != "SCV-LINES":
            sens = {}
            for k, uc_ in unions.items():
                sens[k] = {"additionalSolidCoverageM": r(sum(int((ci & ~uc & ~e.opening).sum()) for ci, uc, e in zip(m["_covInk"], uc_, edges)) * mpp, 3),
                           "additionalOpeningCoverageM": r(sum(int((ci & ~uc & e.opening).sum()) for ci, uc, e in zip(m["_covInk"], uc_, edges)) * mpp, 3)}
            m["unionSensitivity"] = sens
        lines[cid] = m
    # additional distractors not in source-cv (real)
    if set_name == "real":
        scl = segs_by_cfg.get("SCV-LINES", [])
        for cid in lines:
            m = lines[cid]
            if m.get("missing") or cid == "SCV-LINES":
                continue
            add_len = 0.0
            for (pa, pb, _) in m.get("_distractorSegs", []):
                L = np.linalg.norm(pb - pa)
                n = max(2, int(L))
                pts = np.linspace(pa, pb, n)
                cov = np.zeros(n, bool)
                for (qa, qb, _) in scl:
                    if ang_diff(angle_of(qa, qb), angle_of(pa, pb)) > ANG:
                        continue
                    v = qb - qa
                    Lq = np.linalg.norm(v)
                    if Lq < 1e-6:
                        continue
                    uq = v / Lq
                    nq = np.array([-uq[1], uq[0]])
                    cov |= (np.abs((pts - qa) @ nq) <= 2) & ((pts - qa) @ uq >= -1) & ((pts - qa) @ uq <= Lq + 1)
                add_len += (~cov).mean() * L
            m["additionalDistractorLengthM"] = r(add_len * mpp, 3)
    # exclusion-outline lines (terrace / pergola / porch / paving edges not shared with the building) that the
    # provider draws and SCV-LINES does not: per-sample set difference on each exclusion edge
    ex_edges = []
    for ex in truth.get("exclusions", []):
        pts_ = ex["polygon"]
        for i_ in range(len(pts_)):
            pa_, pb_ = np.array(pts_[i_], float), np.array(pts_[(i_ + 1) % len(pts_)], float)
            L_ = float(np.linalg.norm(pb_ - pa_))
            if L_ < 2 or poly.exterior.distance(Point(*((pa_ + pb_) / 2))) <= tau + 1:
                continue
            ex_edges.append((pa_, pb_, L_))

    def ex_cov(segs):
        ink_ok = ink_support(segs, ink_dil)
        covs = []
        for pa_, pb_, L_ in ex_edges:
            u_ = (pb_ - pa_) / L_
            n_ = np.array([-u_[1], u_[0]])
            ts_ = np.arange(0.5, L_, 1.0)
            c_ = np.zeros(len(ts_), bool)
            for (a_, b_, _), ok in zip(segs, ink_ok):
                if ok < 0.5 or ang_diff(angle_of(a_, b_), angle_of(pa_, pb_)) > ANG:
                    continue
                if abs(np.dot(a_ - pa_, n_)) <= 3 and abs(np.dot(b_ - pa_, n_)) <= 3:
                    t0_, t1_ = sorted([np.dot(a_ - pa_, u_), np.dot(b_ - pa_, u_)])
                    c_ |= (ts_ >= t0_) & (ts_ <= t1_)
            covs.append(c_)
        return covs
    base_cov = ex_cov(segs_by_cfg.get("SCV-LINES", []))
    for cid, m in lines.items():
        if m.get("missing") or cid == "SCV-LINES":
            continue
        pc = ex_cov(segs_by_cfg[cid])
        m["exclusionOutlineAddedOverScvM"] = r(sum(int((p_ & ~b_).sum()) for p_, b_ in zip(pc, base_cov)) * mpp, 3)
        m["exclusionIds"] = sorted(set(m.get("_exclusionIds", [])))[:25]
    # per-edge class helpers for the scorecard (solid coverage by union and per provider)
    edge_info = []
    for ei, e in enumerate(edges):
        win = np.isin(e.opening_kind, WINDOW_KINDS)
        info = {"i": ei, "a": [r(e.a[0], 2), r(e.a[1], 2)], "b": [r(e.b[0], 2), r(e.b[1], 2)], "lengthM": r(e.L * mpp, 3), "solidM": r((~e.opening).sum() * mpp, 3), "unionSolidCov": r(((ucov[ei] & ~e.opening).sum() / max(1, (~e.opening).sum()))), "openingKinds": sorted(set(k for k in e.opening_kind if k)),
                "windowRunM": r(win.sum() * mpp, 3)}
        edge_info.append(info)
    fr["edges"] = edge_info
    for cid, m in lines.items():
        if m.get("missing"):
            continue
        per = []
        for ei, e in enumerate(edges):
            ci = m["_covInk"][ei]
            win = np.isin(e.opening_kind, WINDOW_KINDS)
            per.append({"addSolidM": r(((ci & ~ucov[ei] & ~e.opening).sum()) * mpp, 3), "addOpenM": r(((ci & ~ucov[ei] & e.opening).sum()) * mpp, 3),
                        "addWindowM": r(((ci & ~ucov[ei] & win).sum()) * mpp, 3),
                        "addGarageDoorM": r(((ci & ~ucov[ei] & (e.opening_kind == "GARAGE_DOOR")).sum()) * mpp, 3), "garageDoorM": r((e.opening_kind == "GARAGE_DOOR").sum() * mpp, 3)})
        m["perEdge"] = per
    # regions
    R = raster_poly(shape, [truth["exterior"]])
    open_lines = [(o["a"], o["b"]) for o in openings]

    def mm(M):
        return mask_metrics(M, R, truth, open_lines, tb, truth["exclusions"], truth["bodies"], shape, set_name)
    regions = {}
    for cid, M in ctx["fixed_regions"]:
        regions[cid] = mm(M)
    for cid, M in ctx["msam_base"].items():
        if M is None:
            regions[cid] = {"noMask": True}
            continue
        regions[cid] = mm(M)
        regions[cid]["predictedIoU"] = ctx["msam_conf"][cid]
    if full:
        for cid, files in ctx["msam_auto_all"].items():
            best = None
            for f in files:
                A = cv2.imread(f, cv2.IMREAD_GRAYSCALE) > 0
                u = (A | R).sum()
                iou = (A & R).sum() / u if u else 0
                best = iou if best is None else max(best, iou)
            regions[cid]["oracleUpperBoundIoU_NOT_A_SELECTION"] = r(best)
            regions[cid]["autoMasks"] = len(files)
        for cid, vs in ctx["msam_variants"].items():
            B = ctx["msam_base"].get(cid)
            if B is None:
                continue
            ious = []
            tious = []
            for variant, M in vs:
                u = (M | B).sum()
                ious.append((variant, r((M & B).sum() / u if u else 1.0)))
                ut = (M | R).sum()
                tious.append((M & R).sum() / ut if ut else 0)
            regions[cid]["promptSensitivity"] = {"variantIoUWithBase": dict(ious), "minIoUWithBase": r(min(v for _, v in ious)), "regionIoURange": [r(min(tious + [regions[cid]["regionIoU"]])), r(max(tious + [regions[cid]["regionIoU"]]))]}
    # fusion replay outputs (mask-union)
    fusion = {}
    if full and ctx["fusion"] is not None:
        for cid, res in ctx["fusion"]["results"].items():
            if "outlineCells" not in res:
                fusion[cid] = res
                continue
            fo = mm(cells_mask(shape, rect_rings(res["outlineCells"])))
            fb = mm(cells_mask(shape, rect_rings(res["builtCells"])))
            orw = openings_read_as_wall(res.get("pieces", []), edges, t, tau)
            fusion[cid] = {"openingsReadAsWall": orw, "gapTallies": res["gapTallies"], "bridged": res["bridged"], "outlineAccepted": res["outlineAccepted"], "addedSegments": res["addedSegments"],
                           "outline": {k: fo[k] for k in ("regionIoU", "boundaryIoU", "buildingCoverage", "outsideArea", "failureTypes", "bodyCoverage", "overreach")},
                           "built": {k: fb[k] for k in ("regionIoU", "boundaryIoU", "buildingCoverage", "outsideArea", "failureTypes", "bodyCoverage", "overreach")}}
    # evidence availability on baseline gaps (methodology §9.2)
    gaps = [o for o in scv if o["configId"] == "SCV-BOUNDARY-GAP" and o["provenance"]["cls"] in ("TRUE_EXTERIOR_GAP", "UNKNOWN_GAP")]
    gap_rows = []
    polyb = poly.buffer(t + tau)
    wp = meta.get("wallPx") or t
    for g in gaps:
        ga, gb = np.array(g["geometry"]["a"], float), np.array(g["geometry"]["b"], float)
        on_edge = None
        for ei, e in enumerate(edges):
            if e.support(ga, gb) is not None:
                on_edge = ei
                break
        mid = Point(*((ga + gb) / 2))
        where = "EXTERIOR_EDGE" if on_edge is not None else ("OUTSIDE" if not polyb.contains(mid) else "INTERIOR")
        if where == "INTERIOR":
            continue
        row = {"gap": g["id"], "cls": g["provenance"]["cls"], "where": where, "widthM": g["provenance"]["widthM"], "bridgedBy": [], "maskOnGapLineOnly": []}
        L = np.linalg.norm(gb - ga)
        if L < 1:
            continue
        u = (gb - ga) / L
        nrm = np.array([-u[1], u[0]])
        ts = np.arange(0.5, L, 1.0)
        for cid, m in lines.items():
            if m.get("missing"):
                continue
            cov = np.zeros(len(ts), bool)
            for (sa, sb, _) in segs_by_cfg[cid]:
                if ang_diff(angle_of(sa, sb), angle_of(ga, gb)) > ANG:
                    continue
                if abs(np.dot(sa - ga, nrm)) > wp or abs(np.dot(sb - ga, nrm)) > wp:
                    continue
                t0, t1 = sorted([np.dot(sa - ga, u), np.dot(sb - ga, u)])
                cov |= (ts >= t0) & (ts <= t1)
            if cov.mean() >= 0.8:
                row["bridgedBy"].append(cid)
        # masks (§9.2 as written): inside on >= 80 % of the gap line's samples AND of the same samples one wall inward.
        # Inward = the truth edge's inward normal for a gap on a truth exterior edge; for a gap outside the building,
        # the normal side nearer to the truth polygon (towards the building). The first implementation sampled the
        # gap line only; that count is kept as maskOnGapLineOnly (post-review B8).
        if on_edge is not None:
            n_in = edges[on_edge].n_in
        else:
            mid_ = (ga + gb) / 2
            n_in = nrm if poly.distance(Point(*(mid_ + nrm * wp))) <= poly.distance(Point(*(mid_ - nrm * wp))) else -nrm
        pts = ga[None, :] + ts[:, None] * u[None, :]
        pts_in = pts + n_in[None, :] * wp

        def inside(M, P_):
            xs = np.clip(np.round(P_[:, 0]).astype(int), 0, shape[1] - 1)
            ys = np.clip(np.round(P_[:, 1]).astype(int), 0, shape[0] - 1)
            return M[ys, xs].mean()
        for cid in ("MSAM-BOX", "MSAM-SOURCE-PROMPTS", "MSAM-AUTO"):
            M = ctx["msam_base"].get(cid)
            if M is None:
                continue
            on_line = inside(M, pts) >= 0.8
            if on_line:
                row["maskOnGapLineOnly"].append(cid)
            if on_line and inside(M, pts_in) >= 0.8:
                row["bridgedBy"].append(cid)
        gap_rows.append(row)
    fr["lines"] = {k: {kk: vv for kk, vv in v.items() if not kk.startswith("_")} for k, v in lines.items()}
    fr["regions"] = regions
    if full:
        fr["fusionMaskUnion"] = fusion
    fr["evidenceAvailability"] = gap_rows
    return fr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", required=True)
    ap.add_argument("--work", default="/home/user/work005i")
    ap.add_argument("--truth", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--only")
    a = ap.parse_args()
    W = a.work
    frames = sorted(glob.glob(os.path.join(W, "frames", a.set, "*.meta.json")))
    results = {}
    for mp in frames:
        fid = os.path.basename(mp)[: -len(".meta.json")]
        if a.only and fid != a.only:
            continue
        meta = load(mp)
        truth = load(os.path.join(a.truth, fid + ".truth.json" if a.set == "synthetic" else fid + ".json"))
        ink = cv2.imread(os.path.join(W, "frames", a.set, fid + ".inkmask.png"), cv2.IMREAD_GRAYSCALE)
        shape = ink.shape
        ink_dil = cv2.dilate((ink > 0).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
        scv_path = os.path.join(W, "obs", "source-cv", a.set, fid + ".json")
        scv_doc = load(scv_path)
        if scv_doc.get("frameId") != meta["frameId"]:
            raise SystemExit("FRAME MISMATCH %s" % scv_path)
        scv = scv_doc["observations"]
        same = {"SOURCE_CV": "in-process with the extractor that wrote this frame's PNGs and meta (frameId checked)"}
        # provider outputs, loaded once; the same-input rule is asserted on each (post-review B5)
        prov = {}
        for cid, pat, cfg in LINE_CONFIGS:
            p = os.path.join(W, "obs", pat.format(set=a.set, id=fid))
            if not os.path.exists(p):
                continue
            d = load(p)
            if cid != "SCV-LINES":
                same[cid] = check_same_input(d, meta, "gray", p, {"refineLines": scv_path} if cid == "DEEPLSD-MD-REFINE-SCV" else None)
            prov[cid] = (d, seg_list(d["observations"], cfg))
        # region comparators that do not depend on the truth
        fixed = []
        scv_outline = next((o for o in scv if o["configId"] == "SCV-OUTLINE"), None)
        scv_built = next((o for o in scv if o["configId"] == "SCV-BUILT"), None)
        if scv_outline:
            fixed.append(("SCV-OUTLINE", cells_mask(shape, scv_outline["geometry"]["rings"])))
        if scv_built:
            fixed.append(("SCV-BUILT", cells_mask(shape, scv_built["geometry"]["rings"])))
        if a.set == "real" and meta.get("frozenDigest") and meta["frozenDigest"].get("masses"):
            rings = [[[mm["rect"]["x0"], mm["rect"]["y0"]], [mm["rect"]["x1"], mm["rect"]["y0"]], [mm["rect"]["x1"], mm["rect"]["y1"]], [mm["rect"]["x0"], mm["rect"]["y1"]]] for mm in meta["frozenDigest"]["masses"]]
            fixed.append(("PROD-MASSES-005H", cells_mask(shape, rings)))
        # trivial comparators (added after the first scoring run, §11): what the prompt geometry alone scores
        ext = (meta.get("msamPrompt") or {}).get("extent")
        if ext:
            H_, W_ = shape
            wpx = float(meta["msamPrompt"]["wallPx"])
            ex = [[ext["x0"], ext["y0"]], [ext["x1"], ext["y0"]], [ext["x1"], ext["y1"]], [ext["x0"], ext["y1"]]]
            bx0, by0 = max(0.0, ext["x0"] - wpx), max(0.0, ext["y0"] - wpx)
            bx1, by1 = min(W_ - 1.0, ext["x1"] + wpx), min(H_ - 1.0, ext["y1"] + wpx)
            fixed.append(("TRIVIAL-EXTENT", cells_mask(shape, [ex])))
            fixed.append(("TRIVIAL-BOX", cells_mask(shape, [[[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]]])))
        msp = os.path.join(W, "obs", "mobilesam", a.set, fid + ".json")
        msam_base, msam_conf, msam_variants, msam_auto_all = {}, {}, {}, {}
        md = None
        if os.path.exists(msp):
            md = load(msp)
            same["MOBILESAM"] = check_same_input(md, meta, "rgb", msp, {"meta": mp})
            for o in md["observations"]:
                g = o.get("geometry")
                variant = o["provenance"].get("variant", "selected")
                is_base = variant in ("base", None) or o["configId"] == "MSAM-AUTO"
                if not g:
                    if is_base:
                        msam_base[o["configId"]] = None
                    continue
                M = cv2.imread(g["file"], cv2.IMREAD_GRAYSCALE) > 0
                if sha_file(g["file"]) != g["sha256"]:
                    raise SystemExit("MASK HASH MISMATCH %s" % g["file"])
                if is_base:
                    msam_base[o["configId"]] = M
                    msam_conf[o["configId"]] = o["confidence"]
                    if o["configId"] == "MSAM-AUTO":
                        msam_auto_all[o["configId"]] = [am["file"] for am in o["provenance"].get("allMasks", [])]
                else:
                    msam_variants.setdefault(o["configId"], []).append((variant, M))
        # fusion replay output: it must have read these frame pixels and the current provider outputs (B5)
        fp = os.path.join(W, "fusion", a.set, fid + ".json")
        fd = None
        if os.path.exists(fp):
            fd = load(fp)
            fin = fd.get("input") or {}
            if fin.get("rgbPngSha256") != meta["files"]["rgbPngSha256"]:
                raise SystemExit("SAME-INPUT VIOLATION %s: fusion rgb %s vs frame %s" % (fp, fin.get("rgbPngSha256"), meta["files"]["rgbPngSha256"]))
            for rel, sha_ in (fin.get("observationFiles") or {}).items():
                if sha_file(os.path.join(W, "obs", rel)) != sha_:
                    raise SystemExit("STALE FUSION INPUT %s: %s changed since the replay" % (fp, rel))
            same["FUSION_REPLAY"] = {"rgb": fin.get("rgbPngSha256"), "observationFiles": len(fin.get("observationFiles") or {})}
        ctx = {"set": a.set, "meta": meta, "shape": shape, "ink_dil": ink_dil, "scv": scv, "prov": prov, "fixed_regions": fixed,
               "msam_base": msam_base, "msam_conf": msam_conf, "msam_variants": msam_variants, "msam_auto_all": msam_auto_all, "fusion": fd}
        fr = score_truth(truth, ctx, True)
        if md is not None:
            fr["msamPerf"] = md.get("perf")
            fr["msamPrompts"] = md.get("prompts")
        fr["sameInput"] = same
        # ±u truth buffer (post-review B3): the same truth-dependent numbers with the real truth displaced by the
        # house's largest stated vertex uncertainty, outward and inward. Synthetic truth is exact (u = 0).
        if a.set == "real":
            u = max(truth.get("vertexUncertaintyPx") or [0])
            fr["truthBuffer"] = {"uPx": u, "rule": "exterior buffered by -u and +u px (mitred), opening runs moved with their face; exclusions and bodies as drawn",
                                 "variants": {key: score_truth(buffer_truth(truth, dd), ctx, False) for key, dd in (("-u", -u), ("+u", u))}}
        results[fid] = fr
        print(fid, "lines", {k: (v.get("exteriorWallCoverage"), v.get("continuityAcrossOpenings"), v.get("additionalSolidCoverageM")) for k, v in fr["lines"].items()}, "regions", {k: (v.get("regionIoU"), v.get("failureTypes")) for k, v in fr["regions"].items()})
    with open(a.out, "w") as f:
        json.dump(results, f, sort_keys=True)


if __name__ == "__main__":
    main()
