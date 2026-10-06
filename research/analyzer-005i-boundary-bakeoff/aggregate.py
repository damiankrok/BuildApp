"""aggregate.py — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B).

python -I -B aggregate.py --work /home/user/work005i --repo <BuildApp> --out <stage-reports/artifacts/analyzer-005i/boundary-bakeoff>

Turns the scorer's per-frame numbers into the committed artifacts (text facts only): synthetic-results.json,
development-results.json, performance.json, fusion-replay.json, source-manifest.json, providers.json and
failure-type-scorecard.md (methodology.md §8 rules, applied mechanically). Deterministic: sorted keys, rounded numbers.
Post-review (council B): ±u truth-buffer fragility (B3), same-input check summary (B5), SCV-UNION sensitivity rows and
the §8 rule fixes (B8), ORACLE numbers labelled as such and kept out of the recommendation (B2).
"""
import argparse
import glob
import hashlib
import json
import os
import statistics as st

LINE_CFGS = ["SCV-LINES", "ELSED-DEFAULT", "DEEPLSD-MD", "DEEPLSD-WF", "DEEPLSD-MD-REFINE-SCV"]
EXT_LINE_CFGS = LINE_CFGS[1:]
MASK_CFGS = ["MSAM-BOX", "MSAM-SOURCE-PROMPTS", "MSAM-AUTO"]
REGION_CMP = ["SCV-OUTLINE", "SCV-BUILT", "PROD-MASSES-005H", "TRIVIAL-EXTENT", "TRIVIAL-BOX"]
FUSION_CFGS = ["BASELINE", "+ELSED", "+DEEPLSD-MD", "+DEEPLSD-WF", "+DEEPLSD-MD-REFINE-SCV", "+ELSED+DEEPLSD-MD", "+SCV-LINES-CONTROL"]


def r(x, n=4):
    return None if x is None else round(float(x), n)


def load(p):
    with open(p) as f:
        return json.load(f)


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def mean(xs):
    xs = [x for x in xs if x is not None]
    return r(st.mean(xs)) if xs else None


def median(xs):
    xs = [x for x in xs if x is not None]
    return r(st.median(xs), 2) if xs else None


def dump(path, data):
    with open(path, "w") as f:
        json.dump(data, f, sort_keys=True, indent=1)
        f.write("\n")


LINE_KEYS = ["count", "exteriorWallCoverage", "continuityAcrossOpenings", "longWallRecovery", "cornerEndpointErrorMedianPx", "cornersWithoutSegment", "angularErrorDeg", "fragmentationSegmentsPerMetre", "duplicateRate", "unsupportedLineRate", "additionalSolidCoverageM", "additionalOpeningCoverageM", "additionalSolidCoverageShare", "additionalOpeningCoverageShare", "falseLinesDistractors", "falseLinesDistractorsLengthPx", "supportedLineRecall", "boundaryDistractors", "boundaryDistractorsLengthM", "additionalDistractorLengthM", "exclusionOutlineLinesM", "exclusionOutlineAddedOverScvM", "additionalIds", "unionSensitivity"]
REGION_KEYS = ["regionIoU", "boundaryIoU", "boundaryPrecision", "boundaryRecall", "openingRecall", "buildingCoverage", "areaRatio", "outsideArea", "overreach", "bodyCoverage", "openingLeakage", "textDimensionInclusion", "components", "significantComponents", "failureTypes", "predictedIoU", "promptSensitivity", "autoMasks", "noMask"]
ORACLE_KEY = "ORACLE_bestOfAllAutoMasksIoU_NOT_A_SELECTION"


def frame_rows(scores):
    out = {}
    for fid, f in sorted(scores.items()):
        lines = {c: {k: f["lines"][c].get(k) for k in LINE_KEYS if k in f["lines"][c]} for c in LINE_CFGS if c in f["lines"] and not f["lines"][c].get("missing")}
        regions = {c: {k: f["regions"][c].get(k) for k in REGION_KEYS if k in f["regions"][c]} for c in MASK_CFGS + REGION_CMP if c in f["regions"]}
        if "oracleUpperBoundIoU_NOT_A_SELECTION" in f["regions"].get("MSAM-AUTO", {}):
            regions["MSAM-AUTO"][ORACLE_KEY] = f["regions"]["MSAM-AUTO"]["oracleUpperBoundIoU_NOT_A_SELECTION"]
        out[fid] = {"frameId": f["frameId"], "metresPerPx": f["metresPerPx"], "wallPxTruth": f["wallPxTruth"], "tolerancesPx": {"tau": r(f["tau"], 2), "tauB": r(f["tauB"], 2)},
                    "exteriorEdges": f["exteriorEdges"], "solidLengthM": f["solidLengthM"], "openingLengthM": f["openingLengthM"], "scvUnion": f["SCV-UNION"], "scvUnionSensitivity": f.get("SCV-UNION-SENSITIVITY"),
                    "sameInputChecked": sorted(f.get("sameInput", {})), "lines": lines, "regions": regions}
    return out


def aggregates(scores):
    agg = {"lines": {}, "regions": {}}
    for c in LINE_CFGS:
        rows = [f["lines"][c] for f in scores.values() if c in f["lines"] and not f["lines"][c].get("missing")]
        if not rows:
            continue
        a = {"frames": len(rows)}
        for k in ["exteriorWallCoverage", "continuityAcrossOpenings", "longWallRecovery", "angularErrorDeg", "fragmentationSegmentsPerMetre", "duplicateRate", "unsupportedLineRate", "supportedLineRecall", "additionalSolidCoverageShare", "additionalOpeningCoverageShare"]:
            a["mean_" + k] = mean([x.get(k) for x in rows])
        a["median_cornerEndpointErrorPx"] = median([x.get("cornerEndpointErrorMedianPx") for x in rows])
        a["sum_cornersWithoutSegment"] = sum(x.get("cornersWithoutSegment") or 0 for x in rows)
        a["median_count"] = median([x.get("count") for x in rows])
        for k in ["additionalSolidCoverageM", "additionalOpeningCoverageM", "falseLinesDistractors", "boundaryDistractorsLengthM", "additionalDistractorLengthM", "exclusionOutlineAddedOverScvM"]:
            vals = [x.get(k) for x in rows if x.get(k) is not None]
            if vals:
                a["sum_" + k] = r(sum(vals), 3)
        a["framesWithAdditionalSolidCoverage>=0.5m"] = sum(1 for x in rows if (x.get("additionalSolidCoverageM") or 0) >= 0.5)
        us = [x["unionSensitivity"] for x in rows if x.get("unionSensitivity")]
        if us:
            a["unionSensitivity"] = {k: {"sum_additionalSolidCoverageM": r(sum(u[k]["additionalSolidCoverageM"] for u in us), 3), "max_additionalSolidCoverageM": r(max(u[k]["additionalSolidCoverageM"] for u in us), 3),
                                         "sum_additionalOpeningCoverageM": r(sum(u[k]["additionalOpeningCoverageM"] for u in us), 3), "max_additionalOpeningCoverageM": r(max(u[k]["additionalOpeningCoverageM"] for u in us), 3),
                                         "framesWithAdditionalSolidCoverage>=0.5m": sum(1 for u in us if u[k]["additionalSolidCoverageM"] >= 0.5)} for k in sorted(us[0])}
        agg["lines"][c] = a
    for c in MASK_CFGS + REGION_CMP:
        rows = [f["regions"][c] for f in scores.values() if c in f["regions"] and not f["regions"][c].get("noMask")]
        if not rows:
            continue
        ft = {}
        for x in rows:
            for t in x.get("failureTypes", []):
                ft[t] = ft.get(t, 0) + 1
        a = {"frames": len(rows), "mean_regionIoU": mean([x.get("regionIoU") for x in rows]), "median_regionIoU": median([x.get("regionIoU") for x in rows]),
             "min_regionIoU": r(min(x.get("regionIoU") or 0 for x in rows)), "mean_boundaryIoU": mean([x.get("boundaryIoU") for x in rows]),
             "mean_boundaryPrecision": mean([x.get("boundaryPrecision") for x in rows]), "mean_boundaryRecall": mean([x.get("boundaryRecall") for x in rows]),
             "failureTypeCounts": dict(sorted(ft.items())), "framesOK": sum(1 for x in rows if x.get("failureTypes") == ["OK"])}
        if c == "MSAM-AUTO" and any("oracleUpperBoundIoU_NOT_A_SELECTION" in x for x in rows):
            a["mean_" + ORACLE_KEY] = mean([x.get("oracleUpperBoundIoU_NOT_A_SELECTION") for x in rows])
        ps = [x.get("promptSensitivity") for x in rows if x.get("promptSensitivity")]
        if ps:
            a["min_variantIoUWithBase"] = r(min(p["minIoUWithBase"] for p in ps))
            a["mean_regionIoURangeWidth"] = mean([p["regionIoURange"][1] - p["regionIoURange"][0] for p in ps])
        agg["regions"][c] = a
    return agg


def fusion_rows(scores):
    out = {}
    for fid, f in sorted(scores.items()):
        fu = f.get("fusionMaskUnion") or {}
        base = fu.get("BASELINE", {})
        rows = {}
        for c in FUSION_CFGS:
            x = fu.get(c)
            if not x or "outline" not in x:
                rows[c] = x
                continue
            rows[c] = {"gapTallies": x["gapTallies"], "bridged": x["bridged"], "outlineAccepted": x["outlineAccepted"], "addedSegments": x["addedSegments"], "openingsReadAsWall": x.get("openingsReadAsWall"),
                       "outlineRegionIoU": x["outline"]["regionIoU"], "outlineFailureTypes": x["outline"]["failureTypes"], "builtRegionIoU": x["built"]["regionIoU"], "builtFailureTypes": x["built"]["failureTypes"]}
            if base and "outline" in base and c != "BASELINE":
                rows[c]["deltaOutlineIoU"] = r((x["outline"]["regionIoU"] or 0) - (base["outline"]["regionIoU"] or 0))
                rows[c]["deltaBuiltIoU"] = r((x["built"]["regionIoU"] or 0) - (base["built"]["regionIoU"] or 0))
                rows[c]["deltaOpeningsReadAsWall"] = r((x.get("openingsReadAsWall") or 0) - (base.get("openingsReadAsWall") or 0))
        ev = f.get("evidenceAvailability") or []
        avail = {}
        for row in ev:
            for p in LINE_CFGS + MASK_CFGS:
                d = avail.setdefault(p, {"usefulBridges": 0, "falseBridges": 0})
                if p in row["bridgedBy"]:
                    d["usefulBridges" if row["where"] == "EXTERIOR_EDGE" else "falseBridges"] += 1
                if p in MASK_CFGS:
                    d2 = d.setdefault("gapLineOnlyRule", {"usefulBridges": 0, "falseBridges": 0})
                    if p in row.get("maskOnGapLineOnly", []):
                        d2["usefulBridges" if row["where"] == "EXTERIOR_EDGE" else "falseBridges"] += 1
        out[fid] = {"maskUnion": rows, "evidenceAvailability": {"gapsOnTruthExterior": sum(1 for x in ev if x["where"] == "EXTERIOR_EDGE"), "gapsOutsideBuilding": sum(1 for x in ev if x["where"] == "OUTSIDE"), "byProvider": avail,
                                                                 "usefulBridgesNotAlreadyInScvLines": {p: sum(1 for x in ev if x["where"] == "EXTERIOR_EDGE" and p in x["bridgedBy"] and "SCV-LINES" not in x["bridgedBy"]) for p in EXT_LINE_CFGS + MASK_CFGS}}}
    return out


# ------------------------------------------------------------ scorecard (methodology §8)
def body_edges(truth, f, kind, tol=3.0):
    """indices of exterior edges lying on the boundary of the bodies of `kind` (tol grows by u for a buffered truth)"""
    from shapely.geometry import Point, Polygon
    polys = [Polygon(b["polygon"]) for b in truth["bodies"] if b["kind"] == kind]
    idx = []
    for e in f["edges"]:
        mid = Point((e["a"][0] + e["b"][0]) / 2, (e["a"][1] + e["b"][1]) / 2)
        if any(p.exterior.distance(mid) <= tol for p in polys):
            idx.append(e["i"])
    return idx


MASK_NA_FIRST = "post-review B8: a class that does not apply is NOT_APPLICABLE even when no mask was selected"


def variant_view(f, variant):
    """the frame's numbers re-scored against the truth displaced by -u / +u (score.py truthBuffer), or f itself"""
    if variant is None:
        return f, 3.0
    tb = f["truthBuffer"]
    return dict(f, **tb["variants"][variant]), 3.0 + tb["uPx"]


def scorecard(scores, truths, variant=None):
    rows = []
    for fid, f0 in sorted(scores.items()):
        f, btol = variant_view(f0, variant)
        t = truths[fid]
        kinds_open = set(o["kind"] for o in t["openings"])
        excl_kinds = set(e["kind"] for e in t["exclusions"])
        body_kinds = set(b["kind"] for b in t["bodies"])
        edges = f["edges"]
        weak = [e["i"] for e in edges if e["lengthM"] >= 3 and (e["unionSolidCov"] or 0) < 0.6]
        # window rule (post-review B8): numerator and denominator over the same opening kinds (WINDOW / GLAZED / DOOR;
        # GARAGE_DOOR has its own class), both from the per-edge samples of the truth opening runs
        win_runs_m = sum(e.get("windowRunM") or 0.0 for e in edges)
        scv_o = f["regions"].get("SCV-OUTLINE", {})
        for p in EXT_LINE_CFGS + MASK_CFGS + ["TRIVIAL-EXTENT"]:
            is_mask = p in MASK_CFGS or p == "TRIVIAL-EXTENT"
            cells = {}
            if is_mask:
                m = f["regions"].get(p)
                if not m or m.get("noMask"):
                    na = {"longWeakExteriorWall": True, "wallInterruptedByWindows": not kinds_open & {"WINDOW", "GLAZED", "DOOR"}, "garageDoorFacade": "GARAGE_DOOR" not in kinds_open,
                          "attachedGarage": "GARAGE" not in body_kinds, "bay": "BAY" not in body_kinds, "exteriorVsTerrace": not [k for k in ("TERRACE", "PERGOLA", "PORCH") if k in excl_kinds],
                          "mainBodyMask": False, "innerRoomVsBuilding": False}
                    for k, is_na in na.items():
                        cells[k] = ("NOT_APPLICABLE", []) if is_na else ("HURT" if k == "mainBodyMask" else "NEUTRAL", ["no mask selected"])
                    rows.append({"frame": fid, "provider": p, "cells": cells})
                    continue
                oid = "trivial-extent (no model)" if p == "TRIVIAL-EXTENT" else "mobilesam-%s-%s" % (p.lower(), "selected" if p == "MSAM-AUTO" else "base")
                ft = m.get("failureTypes", [])
                cells["longWeakExteriorWall"] = ("NOT_APPLICABLE", [])
                if not kinds_open & {"WINDOW", "GLAZED", "DOOR"}:
                    cells["wallInterruptedByWindows"] = ("NOT_APPLICABLE", [])
                elif "LEAK_THROUGH_OPENING" in ft:
                    cells["wallInterruptedByWindows"] = ("HURT", [oid, "LEAK_THROUGH_OPENING %.3f" % (m.get("openingLeakage") or 0)])
                elif (m.get("openingLeakage") or 0) <= 0.005 and (m.get("openingRecall") or 0) >= 0.8 and (scv_o.get("openingRecall") or 0) < 0.8:
                    cells["wallInterruptedByWindows"] = ("HELPED", [oid, "openingRecall %.2f vs SCV-OUTLINE %.2f" % (m.get("openingRecall"), scv_o.get("openingRecall") or 0)])
                else:
                    cells["wallInterruptedByWindows"] = ("NEUTRAL", [oid, "openingRecall %s, leakage %s" % (m.get("openingRecall"), m.get("openingLeakage"))])
                if "GARAGE_DOOR" not in kinds_open:
                    cells["garageDoorFacade"] = ("NOT_APPLICABLE", [])
                elif "GARAGE_EXCLUDED" in ft or "LEAK_THROUGH_OPENING" in ft:
                    cells["garageDoorFacade"] = ("HURT", [oid] + [x for x in ft if x in ("GARAGE_EXCLUDED", "LEAK_THROUGH_OPENING")])
                elif (m.get("bodyCoverage", {}).get("GARAGE") or 0) >= 0.8 and (m.get("openingLeakage") or 0) <= 0.005:
                    cells["garageDoorFacade"] = ("HELPED", [oid, "garage covered %.2f, leakage %.3f" % (m["bodyCoverage"]["GARAGE"], m.get("openingLeakage") or 0)])
                else:
                    cells["garageDoorFacade"] = ("NEUTRAL", [oid])
                for cls, kind in (("attachedGarage", "GARAGE"), ("bay", "BAY")):
                    if kind not in body_kinds:
                        cells[cls] = ("NOT_APPLICABLE", [])
                        continue
                    mc = m.get("bodyCoverage", {}).get(kind)
                    sc = scv_o.get("bodyCoverage", {}).get(kind)
                    if mc is not None and mc >= 0.8 and (sc or 0) < 0.5:
                        cells[cls] = ("HELPED", [oid, "%s covered %.2f vs SCV-OUTLINE %.2f" % (kind, mc, sc or 0)])
                    elif mc is not None and mc < 0.5 and (sc or 0) >= 0.8:
                        cells[cls] = ("HURT", [oid, "%s covered %.2f vs SCV-OUTLINE %.2f" % (kind, mc, sc or 0)])
                    else:
                        cells[cls] = ("NEUTRAL", [oid, "%s covered %s vs SCV-OUTLINE %s" % (kind, mc, sc)])
                ek = [k for k in ("TERRACE", "PERGOLA", "PORCH") if k in excl_kinds]
                if not ek:
                    cells["exteriorVsTerrace"] = ("NOT_APPLICABLE", [])
                else:
                    ov = {k: m.get("overreach", {}).get(k) for k in ek}
                    so = {k: scv_o.get("overreach", {}).get(k) for k in ek}
                    if any((v or 0) >= 0.3 for v in ov.values()):
                        cells["exteriorVsTerrace"] = ("HURT", [oid, "overreach %s" % ov])
                    elif all((v or 0) <= 0.05 for v in ov.values()) and (m.get("buildingCoverage") or 0) >= 0.9 and any((v or 0) >= 0.3 for v in so.values()):
                        cells["exteriorVsTerrace"] = ("HELPED", [oid, "overreach %s vs SCV-OUTLINE %s" % (ov, so)])
                    else:
                        cells["exteriorVsTerrace"] = ("NEUTRAL", [oid, "overreach %s vs SCV-OUTLINE %s" % (ov, so)])
                iou, siou = m.get("regionIoU") or 0, scv_o.get("regionIoU") or 0
                cells["mainBodyMask"] = ("HELPED" if iou >= 0.85 and iou >= siou + 0.05 else "HURT" if iou < 0.7 else "NEUTRAL", [oid, "IoU %.3f vs SCV-OUTLINE %.3f (trivial extent %.3f)" % (iou, siou, f["regions"].get("TRIVIAL-EXTENT", {}).get("regionIoU") or 0)])
                bc, sbc = m.get("buildingCoverage") or 0, scv_o.get("buildingCoverage") or 0
                cells["innerRoomVsBuilding"] = ("HURT", [oid, "INTERNAL_ROOM_SELECTED"]) if "INTERNAL_ROOM_SELECTED" in ft else (("HELPED", [oid, "building coverage %.2f vs SCV-OUTLINE %.2f" % (bc, sbc)]) if bc >= 0.9 and sbc < 0.8 else ("NEUTRAL", [oid, "building coverage %.2f vs SCV-OUTLINE %.2f" % (bc, sbc)]))
            else:
                m = f["lines"].get(p)
                if not m or m.get("missing"):
                    continue
                per = m.get("perEdge") or []
                ids = m.get("additionalIds") or []
                if not weak:
                    cells["longWeakExteriorWall"] = ("NOT_APPLICABLE", [])
                else:
                    add = sum(per[i]["addSolidM"] for i in weak)
                    dist = m.get("additionalDistractorLengthM") or 0.0
                    if add >= 0.5 and dist <= add:
                        cells["longWeakExteriorWall"] = ("HELPED", ids[:6] + ["+%.2f m on %d weak edges" % (add, len(weak))])
                    elif dist >= 1 and dist > 2 * add:
                        cells["longWeakExteriorWall"] = ("HURT", ["+%.2f m coverage, +%.2f m new boundary distractors (frame)" % (add, dist)])
                    else:
                        cells["longWeakExteriorWall"] = ("NEUTRAL", ["+%.2f m coverage, +%.2f m new boundary distractors (frame)" % (add, dist)])
                if not kinds_open & {"WINDOW", "GLAZED", "DOOR"}:
                    cells["wallInterruptedByWindows"] = ("NOT_APPLICABLE", [])
                else:
                    addo = sum(x["addWindowM"] for x in per)
                    cells["wallInterruptedByWindows"] = ("HELPED" if win_runs_m and addo >= 0.2 * win_runs_m else "NEUTRAL", (ids[:6] if addo else []) + ["+%.2f m of %.2f m window / glazing / door runs beyond SCV-UNION" % (addo, win_runs_m)])
                if "GARAGE_DOOR" not in kinds_open:
                    cells["garageDoorFacade"] = ("NOT_APPLICABLE", [])
                else:
                    gd = sum(x["garageDoorM"] for x in per)
                    agd = sum(x["addGarageDoorM"] for x in per)
                    cells["garageDoorFacade"] = ("HELPED" if gd and agd >= 0.5 * gd else "NEUTRAL", ["+%.2f m of %.2f m garage-door run beyond SCV-UNION" % (agd, gd)])
                for cls, kind in (("attachedGarage", "GARAGE"), ("bay", "BAY")):
                    if kind not in body_kinds:
                        cells[cls] = ("NOT_APPLICABLE", [])
                        continue
                    be = body_edges(t, f, kind, btol)
                    add = sum(per[i]["addSolidM"] for i in be)
                    cells[cls] = ("HELPED" if add >= 0.5 else "NEUTRAL", ["+%.2f m on %d %s edges beyond SCV-UNION" % (add, len(be), kind)])
                ek = [k for k in ("TERRACE", "PERGOLA", "PORCH") if k in excl_kinds]
                if not ek:
                    cells["exteriorVsTerrace"] = ("NOT_APPLICABLE", [])
                else:
                    ea = m.get("exclusionOutlineAddedOverScvM") or 0
                    exi = (m.get("exclusionIds") or [])[:6]
                    cells["exteriorVsTerrace"] = ("HURT" if ea >= 2 else "NEUTRAL", ["+%.2f m of exclusion-outline lines not in SCV-LINES" % ea] + (["segments on exclusion outlines (some also in SCV-LINES): " + ", ".join(exi)] if exi else []))
                cells["mainBodyMask"] = ("NOT_APPLICABLE", [])
                cells["innerRoomVsBuilding"] = ("NOT_APPLICABLE", [])
            rows.append({"frame": fid, "provider": p, "cells": cells})
    return rows


# ------------------------------------------------------------ ±u truth-buffer fragility (post-review B3, methodology §6.3)
VARIANTS = [("-u", "-u"), ("0", None), ("+u", "+u")]
REGION_PAIRS = [("MSAM-BOX", "TRIVIAL-EXTENT"), ("MSAM-BOX", "TRIVIAL-BOX"), ("MSAM-BOX", "SCV-BUILT"), ("MSAM-BOX", "PROD-MASSES-005H"), ("MSAM-BOX", "SCV-OUTLINE"),
                ("MSAM-SOURCE-PROMPTS", "TRIVIAL-EXTENT"), ("MSAM-SOURCE-PROMPTS", "SCV-BUILT"), ("MSAM-AUTO", "TRIVIAL-EXTENT")]


def at(f, v):
    return f if v is None else f["truthBuffer"]["variants"][v]


def sgn(x):
    return 0 if abs(x) < 5e-4 else (1 if x > 0 else -1)


def evidence_totals(scores, v):
    tot = {}
    for f in scores.values():
        for row in at(f, v)["evidenceAvailability"]:
            for p in LINE_CFGS + MASK_CFGS:
                d = tot.setdefault(p, {"usefulBridges": 0, "falseBridges": 0, "usefulNotInScvLines": 0})
                if p in row["bridgedBy"]:
                    if row["where"] == "EXTERIOR_EDGE":
                        d["usefulBridges"] += 1
                        if "SCV-LINES" not in row["bridgedBy"]:
                            d["usefulNotInScvLines"] += 1
                    else:
                        d["falseBridges"] += 1
    return tot


def fragility(real, sc_rows):
    """Every real-set comparison the recommendation reads, at the stated truth and at the truth displaced by -u / +u.
    FRAGILE = the conclusion (sign of an IoU difference, a threshold crossing, a scorecard cell) is not the same at all
    three; a difference under 0.0005 counts as a tie (FRAGILE)."""
    out = {"rule": "u = the house's largest stated vertex uncertainty (truth/real/<house>.json vertexUncertaintyPx); the exterior is buffered by -u and +u px with mitred joins and the opening runs move with their face (score.py buffer_truth); exclusions and bodies stay as drawn. A conclusion is FRAGILE when it is not the same at -u, 0 and +u; an IoU difference under 0.0005 is a tie and counts as FRAGILE.",
           "uPx": {fid: f["truthBuffer"]["uPx"] for fid, f in sorted(real.items())}}
    comps = []
    for fid, f in sorted(real.items()):
        for a_, b_ in REGION_PAIRS:
            ia = [at(f, v)["regions"].get(a_, {}).get("regionIoU") for _, v in VARIANTS]
            ib = [at(f, v)["regions"].get(b_, {}).get("regionIoU") for _, v in VARIANTS]
            if None in ia or None in ib:
                continue
            d = [x - y for x, y in zip(ia, ib)]
            sg = {sgn(x) for x in d}
            comps.append({"house": fid, "pair": "%s vs %s" % (a_, b_), "regionIoU": {k: [r(x), r(y)] for (k, _), x, y in zip(VARIANTS, ia, ib)}, "deltaIoU": {k: r(x) for (k, _), x in zip(VARIANTS, d)},
                          "verdict": "ROBUST" if len(sg) == 1 and 0 not in sg else "FRAGILE"})
    for a_, b_ in REGION_PAIRS:
        ds = []
        for _, v in VARIANTS:
            xs = [at(f, v)["regions"][a_]["regionIoU"] - at(f, v)["regions"][b_]["regionIoU"] for f in real.values() if at(f, v)["regions"].get(a_, {}).get("regionIoU") is not None and at(f, v)["regions"].get(b_, {}).get("regionIoU") is not None]
            ds.append(sum(xs) / len(xs) if xs else None)
        if None in ds:
            continue
        sg = {sgn(x) for x in ds}
        comps.append({"house": "MEAN over the 7 houses", "pair": "%s vs %s" % (a_, b_), "deltaIoU": {k: r(x) for (k, _), x in zip(VARIANTS, ds)}, "verdict": "ROBUST" if len(sg) == 1 and 0 not in sg else "FRAGILE"})
    out["regionComparisons"] = comps
    out["fragileRegionComparisons"] = ["%s: %s" % (c["house"], c["pair"]) for c in comps if c["verdict"] == "FRAGILE"]
    out["meanRegionIoU"] = {c: {k: mean([at(f, v)["regions"].get(c, {}).get("regionIoU") for f in real.values()]) for k, v in VARIANTS} for c in MASK_CFGS + REGION_CMP}
    md = {}
    for k, v in VARIANTS:
        ds = [at(f, v)["regions"]["MSAM-BOX"]["regionIoU"] - at(f, v)["regions"]["TRIVIAL-EXTENT"]["regionIoU"] for f in real.values() if "MSAM-BOX" in at(f, v)["regions"] and "TRIVIAL-EXTENT" in at(f, v)["regions"]]
        md[k] = {"mean": r(sum(ds) / len(ds)), "min": r(min(ds)), "max": r(max(ds))}
    out["msamBoxMinusTrivialExtent"] = md
    lc = []
    for fid, f in sorted(real.items()):
        for c in EXT_LINE_CFGS:
            sol = {k: at(f, v)["lines"].get(c, {}).get("additionalSolidCoverageM") for k, v in VARIANTS}
            opn = {k: at(f, v)["lines"].get(c, {}).get("additionalOpeningCoverageM") for k, v in VARIANTS}
            if None in sol.values():
                continue
            below = {x < 0.5 for x in sol.values()}
            lc.append({"house": fid, "provider": c, "additionalSolidCoverageM": sol, "additionalOpeningCoverageM": opn, "verdict": "ROBUST" if len(below) == 1 else "FRAGILE"})
    out["lineConclusions"] = {"conclusion": "external line provider adds < 0.5 m of ink-supported exterior solid coverage beyond SCV-UNION", "rows": lc, "fragile": ["%s: %s" % (x["house"], x["provider"]) for x in lc if x["verdict"] == "FRAGILE"],
                              "maxAdditionalSolidCoverageM": {k: r(max(x["additionalSolidCoverageM"][k] for x in lc), 3) for k, _ in VARIANTS},
                              "maxAdditionalOpeningCoverageM": {k: r(max(x["additionalOpeningCoverageM"][k] for x in lc), 3) for k, _ in VARIANTS},
                              "scvUnionMinCoverage": {k: {"solid": r(min(at(f, v)["SCV-UNION"]["exteriorWallCoverage"] for f in real.values())), "opening": r(min(at(f, v)["SCV-UNION"]["continuityAcrossOpenings"] for f in real.values()))} for k, v in VARIANTS}}
    ev = {k: evidence_totals(real, v) for k, v in VARIANTS}
    out["evidenceAvailability"] = {"totals": ev, "msamBoxFalseBridgesExceedScvLines": {k: ev[k]["MSAM-BOX"]["falseBridges"] > ev[k]["SCV-LINES"]["falseBridges"] for k, _ in VARIANTS}}
    base = {(x["frame"], x["provider"]): x["cells"] for x in sc_rows[None]}
    cells = {}
    for k in ("-u", "+u"):
        for row in sc_rows[k]:
            for c, (val, _) in row["cells"].items():
                b0 = base[(row["frame"], row["provider"])][c][0]
                if val != b0:
                    cells.setdefault((row["frame"], row["provider"], c), {"house": row["frame"], "provider": row["provider"], "class": c, "0": b0})[k] = val
    out["fragileScorecardCells"] = [cells[k] for k in sorted(cells)]
    return out


def control_comparison(scores):
    """per house: outline / BUILT IoU change of the no-external-information control and of each provider row (B6)"""
    out = {"perHouse": {}, "addedSegmentsRange": {}}
    segs = {}
    for fid, f in sorted(scores.items()):
        rows = fusion_rows({fid: f})[fid]["maskUnion"]
        out["perHouse"][fid] = {c: {"deltaOutlineIoU": x.get("deltaOutlineIoU"), "deltaBuiltIoU": x.get("deltaBuiltIoU"), "addedSegments": x.get("addedSegments")} for c, x in rows.items() if c != "BASELINE" and x and "deltaOutlineIoU" in x}
        for c, x in out["perHouse"][fid].items():
            segs.setdefault(c, []).append(x["addedSegments"])
    out["addedSegmentsRange"] = {c: [min(v), max(v)] for c, v in sorted(segs.items())}
    return out


def same_input_summary(scores):
    """B5: score.py stops on any mismatch, so reaching here means every listed output read its frame's PNG bytes"""
    per = {}
    for f in scores.values():
        for k in f.get("sameInput", {}):
            per[k] = per.get(k, 0) + 1
    return {"rule": "every provider output records the SHA-256 of the frame PNG it read (the refiner also its SCV-LINES file, MobileSAM also its prompt meta; the fusion replay the frame PNG and every observation file); score.py asserts each against the frame meta / the current file and stops on any mismatch (post-review B5)",
            "framesChecked": len(scores), "outputsCheckedPerProvider": dict(sorted(per.items()))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", default="/home/user/work005i")
    ap.add_argument("--repo", default="/home/user/BuildApp")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    W, H = a.work, os.path.join(a.repo, "research", "analyzer-005i-boundary-bakeoff")
    real = load(os.path.join(W, "scores", "real.json"))
    synth = load(os.path.join(W, "scores", "synthetic.json"))
    corpus = load(os.path.join(W, "synth", "corpus.json"))
    truths_real = {k: load(os.path.join(H, "truth", "real", k + ".json")) for k in real}
    sc_rows = {v: scorecard(real, truths_real, v) for v in (None, "-u", "+u")}

    # ---------------- synthetic-results.json
    dump(os.path.join(a.out, "synthetic-results.json"), {
        "researchOnly": True,
        "generator": {"file": "research/analyzer-005i-boundary-bakeoff/synthetic/generate.py", "sha256": corpus["generatorSha256"], "opencv": corpus["opencv"], "numpy": corpus["numpy"], "pxPerM": corpus["pxPerM"], "supersampling": corpus["supersampling"], "exteriorWallM": corpus["exteriorWallM"], "partitionM": corpus["partitionM"]},
        "cases": [{"id": c["id"], "seed": c["seed"], "degradation": c["degradation"], "bytesSha256": c["sha256"], "truthSha256": c["truthSha256"]} for c in corpus["cases"]],
        "baselineInputs": "extent = production planExtent with no chains (wall witness), never the truth; it feeds the boundary layer, the MobileSAM BOX / SOURCE prompts and the AUTO selection window. ORACLE SCALE (generator metres per pixel, labelled): it sets the boundary layer's metric thresholds, so it shapes the SCV-OUTLINE / SCV-BUILT comparators, the BUILT cells whose centres are the MSAM-SOURCE-PROMPTS positives, and the gap classes; it never enters the BOX prompt, the AUTO selection or any line detector. No chains (methodology §7.1, §11 E6 correction, post-review B7)",
        "sameInputCheck": same_input_summary(synth),
        "scoringOutput": {"file": "/home/user/work005i/scores/synthetic.json (outside the repository)", "sha256": sha(os.path.join(W, "scores", "synthetic.json"))},
        "perCase": frame_rows(synth),
        "aggregates": aggregates(synth),
        "fusion": fusion_rows(synth),
    })
    # ---------------- development-results.json
    dev = frame_rows(real)
    for k in dev:
        t = truths_real[k]
        dev[k]["truth"] = {"file": "research/analyzer-005i-boundary-bakeoff/truth/real/%s.json" % k, "sha256": sha(os.path.join(H, "truth", "real", k + ".json")), "vertices": len(t["exterior"]), "bodies": sorted(b["kind"] for b in t["bodies"]), "exclusions": sorted(e["kind"] for e in t["exclusions"]), "openingRuns": len(t["openings"]), "documentedFailure": t.get("documentedFailure"), "purpose": t.get("purpose", "DEV_BOUNDARY")}
    dump(os.path.join(a.out, "development-results.json"), {
        "researchOnly": True,
        "truthKind": "agent manual review of plan pixels (methodology §6.2); a limitation",
        "frozenBaseline": "frozen 005H production runs (/home/user/work005h/m-on, blind7), code d14304c, recogniser ON; baseline layers re-derived on a git-archive snapshot of 29ab643 and checked equal (gap tallies) on all 7 frames",
        "perHouse": dev,
        "aggregates": aggregates(real),
        "aggregatesBoundaryHousesOnly": aggregates({k: v for k, v in real.items() if truths_real[k].get("purpose", "DEV_BOUNDARY") == "DEV_BOUNDARY"}),
        "truthBufferFragility": fragility(real, sc_rows),
        "sameInputCheck": same_input_summary(real),
        "scoringOutput": {"file": "/home/user/work005i/scores/real.json (outside the repository)", "sha256": sha(os.path.join(W, "scores", "real.json"))},
    })
    # ---------------- fusion-replay.json
    dump(os.path.join(a.out, "fusion-replay.json"), {
        "researchOnly": True,
        "seam": "NONE. The production boundary resolver (decomposePlan -> boundaryExtension -> solveOutline / classifyBodies / completeBoundary) takes only the ink Mask, bands, chains, registration, extent and options. No line list or region mask can be passed without changing production code.",
        "replay1_maskUnion": "Out-of-contract input perturbation: mask' = mask OR rasterise(provider segments, 1 px); the same production boundary layer re-run with identical bands, chains, registration, extent and options (fusion-replay.ts). A 1-px line cannot become wall-thick ink on its own, but many added lines can raise the ink density of a wall-thick window past readWallLine's 80 % — openingsReadAsWall measures exactly that side effect.",
        "replay2_evidenceAvailability": "Per baseline TRUE_EXTERIOR_GAP / UNKNOWN_GAP: on a truth exterior edge, does the provider bridge it (lines: >= 80 % covered by parallel segments within a wall of the gap line; masks, as methodology §9 states: mask = 1 on >= 80 % of the gap line's samples AND of the same samples one wall inward, inward = the truth edge's inward normal, or for a gap outside the building the side nearer to the truth polygon) — useful; outside the truth building — false evidence. The first implementation sampled the gap line only (post-review B8); that tally is kept per mask as byProvider.<mask>.gapLineOnlyRule.",
        "controlRow": "+SCV-LINES-CONTROL rasterises BuildPlan's own SCV-LINES into the mask exactly like a provider's lines: no EXTERNAL information (the resolver does not otherwise consume SCV-LINES). It shows that ink density alone moves outlines by changes of comparable magnitude to the providers', on different houses (controlComparison). It is one perturbation per house and its density is NOT matched (controlComparison.addedSegmentsRange): evidence that the resolver is density-sensitive, not a calibrated null distribution.",
        "controlComparison": control_comparison(real),
        "real": fusion_rows(real),
        "synthetic": fusion_rows(synth),
        "noOracleFusion": "no per-house provider choice, no per-provider threshold, no published area; combinations only after the individual rows",
    })
    # ---------------- performance.json
    perf = {"researchOnly": True, "box": "Ubuntu 24.04 x86-64, 4 vCPU (shared with a concurrent development matrix: timings are upper bounds), no GPU", "frames": {}}
    for setname, scores in (("real", real), ("synthetic", synth)):
        for fid in sorted(scores):
            meta = load(os.path.join(W, "frames", setname, fid + ".meta.json"))
            row = {"sourceCv": {"timingsMs": meta.get("timingsMs"), "counts": meta.get("counts")}}
            for c in EXT_LINE_CFGS:
                p = scores[fid]["lines"].get(c, {}).get("perf")
                if p:
                    row[c] = p
            if scores[fid].get("msamPerf"):
                row["MOBILESAM"] = scores[fid]["msamPerf"]
            perf["frames"]["%s/%s" % (setname, fid)] = row
    summ = {}
    for c in EXT_LINE_CFGS + ["MOBILESAM"]:
        rows = [v[c] for v in perf["frames"].values() if c in v]
        if not rows:
            continue
        s = {"frames": len(rows)}
        for k in ("wallMs", "detectMs", "inferMs", "peakRssMB", "count", "encoderMs", "autoMs"):
            vals = [x.get(k) for x in rows if isinstance(x.get(k), (int, float))]
            if vals:
                s["median_" + k] = r(st.median(vals), 1)
                s["max_" + k] = r(max(vals), 1)
        summ[c] = s
    sc = [v["sourceCv"]["timingsMs"] for v in perf["frames"].values() if v["sourceCv"].get("timingsMs")]
    summ["SOURCE_CV"] = {"frames": len(sc), "median_linesMs": r(st.median([x.get("sourceCvLines", 0) for x in sc]), 1), "median_planSheetAndSolidMs": r(st.median([x.get("planSheetAndSolid", 0) for x in sc]), 1), "median_boundaryLayerMs": r(st.median([x.get("boundaryLayer", 0) for x in sc]), 1)}
    perf["summary"] = summ
    # post-review B5: the scored outputs come from the full re-run that added input hashes (07:27-, box busier than the
    # first run). The first run's timings, from the copy taken before the re-run, are kept beside them for reference.
    prev = os.path.join(W, "obs-prev")
    if os.path.isdir(prev):
        first = {}
        pat = {"ELSED-DEFAULT": "elsed/*/*.json", "DEEPLSD-MD": "deeplsd/*/*.md.json", "DEEPLSD-WF": "deeplsd/*/*.wf.json", "DEEPLSD-MD-REFINE-SCV": "deeplsd/*/*.md-refine-scv.json", "MOBILESAM": "mobilesam/*/*.json"}
        for c, g in pat.items():
            rows = [load(fp).get("perf") or {} for fp in sorted(glob.glob(os.path.join(prev, g)))]
            rows = [x for x in rows if x]
            s_ = {"frames": len(rows)}
            for k in ("wallMs", "detectMs", "inferMs", "peakRssMB", "encoderMs", "autoMs"):
                vals = [x.get(k) for x in rows if isinstance(x.get(k), (int, float))]
                if vals:
                    s_["median_" + k] = r(st.median(vals), 1)
                    s_["max_" + k] = r(max(vals), 1)
            first[c] = s_
        perf["summaryFirstRun"] = first
        perf["timingNote"] = "summary = the scored outputs (full re-run with input hashes, post-review B5); summaryFirstRun = the first run of the same providers on the same frames. Both on a shared 4-vCPU box: upper bounds, not phone timings. peakRssMB here is the process maximum RSS from the kernel (ru_maxrss), a true peak; the WASM probe's figure is not (see wasmProbeNode18.memoryNote)."
    wp = os.path.join(W, "onnx", "wasm-probe-node18.json")
    if os.path.exists(wp):
        wpd = load(wp)
        # post-review D8: the probe samples RSS every 20 ms on an event loop that single-thread WASM inference blocks,
        # so the figure is the RSS AFTER inference — a lower bound on the peak, not the peak. Published under that name.
        if "peakRssMiBPerModel" in wpd:
            wpd["rssAfterInferenceMiBPerModel_lowerBoundOnPeak"] = wpd.pop("peakRssMiBPerModel")
        wpd["memoryNote"] = "rssAfterMiB / rssAfterInferenceMiBPerModel_lowerBoundOnPeak = RSS after inference, sampled on an event loop that the single-thread WASM call blocks: a lower bound on the peak, not the peak (post-review D8)"
        perf["wasmProbeNode18"] = wpd
    ex = os.path.join(W, "onnx", "export.json")
    if os.path.exists(ex):
        e = load(ex)
        perf["onnxExport"] = {k: ({kk: vv for kk, vv in v.items() if kk != "file"} if isinstance(v, dict) else v) for k, v in e.items()}
    det = os.path.join(W, "determinism.json")
    if os.path.exists(det):
        perf["determinism"] = load(det)
    rc = os.path.join(W, "rerun-b5-compare.json")
    if os.path.exists(rc):
        perf["fullRerunComparison"] = load(rc)
    dump(os.path.join(a.out, "performance.json"), perf)
    # ---------------- source-manifest.json
    sm = {"researchOnly": True, "rule": "every provider sees the same decoded pixels per frame (methodology §3)", "providerInputs": {
        "SOURCE_CV": "the production Raster in-process (RGBA as decoded): ink channel min(R,G,B) for masks/bands; Rec.601 luma, box downscale to MAX_WORKING_EDGE, gradient mask for SCV-LINES",
        "ELSED": "gray PNG channel 0 = production Rec.601 luma, uint8, native resolution; ELSED applies its own Gaussian (sigma 1, 7x7) and Sobel",
        "DEEPLSD": "gray PNG channel 0 = production Rec.601 luma / 255 as float32 [1,1,H,W], native resolution, no resize; the network's own normalisation only",
        "MOBILESAM": "rgb PNG (decoded RGBA, alpha dropped; all frames opaque) uint8 RGB; SamPredictor resizes the long side to 1024 (bilinear, ResizeLongestSide), subtracts pixel mean [123.675,116.28,103.53], divides by std [58.395,57.12,57.375], pads to 1024x1024; masks returned at frame resolution"}, "frames": {}}
    for setname in ("real", "synthetic"):
        for mp in sorted(glob.glob(os.path.join(W, "frames", setname, "*.meta.json"))):
            m = load(mp)
            fid = os.path.basename(mp)[: -len(".meta.json")]
            row = {"frameId": m["frameId"], "decoded": m["decoded"], "orientation": m.get("orientation"), "crop": m.get("crop"), "resize": m.get("resize"), "pngSha256": {"rgb": m["files"]["rgbPngSha256"], "gray": m["files"]["grayPngSha256"]}}
            if setname == "real":
                row.update({"sourceByteSha256": m["variant"]["byteSha256"], "variantId": m["variant"]["id"], "mediaType": m["variant"]["mediaType"], "byteLength": m["variant"]["byteLength"], "packageSha256": m["packageSha256"], "frameSelection": m["frameSelection"], "frameRoles": m["frameRoles"], "frozenRun": m["frozenRun"]})
            else:
                orc = m.get("oracle")
                if orc:
                    orc = dict(orc, why="ORACLE SCALE (generator metres per pixel), labelled: the metric layer is not under test. It sets the boundary layer's metric thresholds, so it shapes the gap classes, the SCV-OUTLINE / SCV-BUILT comparators and the BUILT cells whose centres are the MSAM-SOURCE-PROMPTS positives; it never enters the BOX prompt, the AUTO selection or any line detector (post-review B7; the frame meta carries the earlier, narrower wording)")
                row.update({"sourceByteSha256": m["sourceBytes"]["sha256"], "sourceFile": m["sourceBytes"]["file"], "generatorSha256": m["generatorSha256"], "oracleScale": orc, "extent": m.get("extent")})
            sm["frames"]["%s/%s" % (setname, fid)] = row
    dump(os.path.join(a.out, "source-manifest.json"), sm)
    # ---------------- providers.json
    man = load(os.path.join(H, "manifest.json"))

    def chashes(pattern, cfg=None):
        hs = set()
        for fp in glob.glob(os.path.join(W, "obs", pattern)):
            for o in load(fp)["observations"]:
                if cfg is None or o["configId"] == cfg:
                    hs.add(o["configHash"])
        return sorted(hs)
    ck = {c["file"]: {"url": c["url"], "sha256": c["sha256"], "bytes": c["bytes"], "provenance": c["urlProvenance"]} for c in man["checkpoints"]}
    repos = {r["provider"]: r for r in man["repositories"]}
    from importlib import util as _u  # noqa: F401
    import sys as _s
    _s.path.insert(0, os.path.join(H, "providers"))
    import elsed_run, deeplsd_run  # noqa: E401
    provs = [
        {"provider": "SOURCE_CV", "repo": "this repository (packages/source-cv, packages/reconstruction boundary-*.ts, packages/source-analyzer prepare.ts)", "commit": "29ab643a6e1b8e9e9f07bbdecd8cc12e63860c0e (snapshot); frozen runs d14304c", "configs": ["SCV-LINES", "SCV-WALL", "SCV-SOLID", "SCV-BOUNDARY", "SCV-BOUNDARY-GAP", "SCV-OUTLINE", "SCV-BUILT"], "config": "production defaults (BOUNDARY_EVIDENCE_VERSION 1.1.0)", "configHashes": chashes("source-cv/*/*.json"), "checkpoint": None, "runtime": {"node": man["runtime"]["node"]}},
        {"provider": "ELSED", "repo": repos["ELSED"]["url"], "commit": repos["ELSED"]["commit"], "configs": ["ELSED-DEFAULT"], "config": elsed_run.CONFIG, "configHashes": chashes("elsed/*/*.json"), "checkpoint": None, "runtime": {"opencv": man["runtime"]["apt"]["libopencv-dev"], "build": "libelsed.a (upstream CMake) + research elsed_cli.cpp"}},
        {"provider": "DEEPLSD", "repo": repos["DEEPLSD"]["url"], "commit": repos["DEEPLSD"]["commit"], "submodules": repos["DEEPLSD"]["submodules"], "configs": ["DEEPLSD-MD", "DEEPLSD-WF", "DEEPLSD-MD-REFINE-SCV"], "config": {"detect": deeplsd_run.DETECT_CONF, "refine": deeplsd_run.REFINE_CONF}, "configHashes": {"DEEPLSD-MD": chashes("deeplsd/*/*.md.json"), "DEEPLSD-WF": chashes("deeplsd/*/*.wf.json"), "DEEPLSD-MD-REFINE-SCV": chashes("deeplsd/*/*.md-refine-scv.json")}, "checkpoint": {"DEEPLSD-MD": ck["deeplsd_md.tar"], "DEEPLSD-WF": ck["deeplsd_wireframe.tar"]}, "runtime": man["runtime"]["pip"]},
        {"provider": "MOBILESAM", "repo": repos["MOBILESAM"]["url"], "commit": repos["MOBILESAM"]["commit"], "configs": ["MSAM-BOX", "MSAM-SOURCE-PROMPTS", "MSAM-AUTO"], "config": "methodology.md §5 (model vit_t; multimask, highest predicted IoU; AUTO points_per_side=16)", "configHashes": {c: chashes("mobilesam/*/*.json", c) for c in ["MSAM-BOX", "MSAM-SOURCE-PROMPTS", "MSAM-AUTO"]}, "checkpoint": ck["mobile_sam.pt"], "runtime": man["runtime"]["pip"]},
    ]
    for pv in provs:
        if isinstance(pv["configHashes"], dict):
            pv["configHashCount"] = {k: len(v) for k, v in pv["configHashes"].items()}
            pv["configHashes"] = {k: v[:3] + (["…%d more (per-prompt hashes)" % (len(v) - 3)] if len(v) > 3 else []) for k, v in pv["configHashes"].items()}
        else:
            pv["configHashCount"] = len(pv["configHashes"])
    dump(os.path.join(a.out, "providers.json"), {"researchOnly": True, "providers": provs, "os": man["runtime"]["os"], "python": man["runtime"]["python"]})
    # ---------------- failure-type-scorecard.md
    rows = sc_rows[None]
    fragile = {}
    for k in ("-u", "+u"):
        for row in sc_rows[k]:
            for c, (val, _) in row["cells"].items():
                if val != next(x for x in rows if x["frame"] == row["frame"] and x["provider"] == row["provider"])["cells"][c][0]:
                    fragile.setdefault((row["frame"], row["provider"], c), {})[k] = val
    classes = ["longWeakExteriorWall", "wallInterruptedByWindows", "garageDoorFacade", "attachedGarage", "bay", "exteriorVsTerrace", "mainBodyMask", "innerRoomVsBuilding"]
    names = {"longWeakExteriorWall": "long weak ext. wall", "wallInterruptedByWindows": "wall interrupted by windows", "garageDoorFacade": "garage-door facade", "attachedGarage": "attached garage", "bay": "bay", "exteriorVsTerrace": "exterior vs terrace", "mainBodyMask": "main-body mask", "innerRoomVsBuilding": "inner room vs building"}
    short = {"HELPED": "**HELPED**", "NEUTRAL": "NEUTRAL", "HURT": "**HURT**", "NOT_APPLICABLE": "n/a"}
    md = ["# 005I Track B — failure-type scorecard (real development set)", "",
          "Rules: `methodology.md` §8, fixed before scoring and applied mechanically by `aggregate.py`. Baselines are the same-frame",
          "source-cv layers: `SCV-UNION` (SCV-LINES ∪ wall bands ∪ boundary pieces ∪ bridged gaps) for line providers, `SCV-OUTLINE` (the",
          "default reading's opening-aware outline) for masks. Truth is the agent's manual annotation (a limitation). No single scalar.", "",
          "**†** = FRAGILE: the cell changes when the truth is displaced by ±u (u = the house's largest stated vertex uncertainty,",
          "2–5 px; `development-results.json` → `truthBufferFragility`). Rule fixes after review B8 (window-rule kinds, not-applicable",
          "before NEUTRAL when no mask is selected) are listed in `methodology.md` §11.", ""]
    totals = {}
    for p in EXT_LINE_CFGS + MASK_CFGS + ["TRIVIAL-EXTENT"]:
        if p == "TRIVIAL-EXTENT":
            md += ["## Reference: TRIVIAL-EXTENT (no model)", "", "The same mask rules applied to the production plan-extent rectangle itself (the information the MSAM-BOX prompt", "already carries). Not a provider; added so the MobileSAM cells can be read against what the box alone earns.", ""]
        md += ["## %s" % p, "", "| house | " + " | ".join(names[c] for c in classes) + " |", "| --- |" + " --- |" * len(classes)]
        for row in [x for x in rows if x["provider"] == p]:
            md.append("| `%s` | " % row["frame"] + " | ".join(short[row["cells"][c][0]] + (" †" if (row["frame"], p, c) in fragile else "") for c in classes) + " |")
            for c in classes:
                v = row["cells"][c][0]
                totals.setdefault(p, {}).setdefault(v, 0)
                totals[p][v] += 1
        md.append("")
        md.append("Supporting observations / measurements:")
        md.append("")
        for row in [x for x in rows if x["provider"] == p]:
            notes = ["%s: %s" % (names[c], "; ".join(str(s) for s in row["cells"][c][1])) for c in classes if row["cells"][c][0] != "NOT_APPLICABLE" and row["cells"][c][1]]
            md.append("- `%s` — " % row["frame"] + (" · ".join(notes) if notes else "nothing applicable"))
        md.append("")
    md += ["## Totals (cells, all classes and houses)", "", "| provider | HELPED | NEUTRAL | HURT | n/a | fragile (±u) |", "| --- | --- | --- | --- | --- | --- |"]
    for p in EXT_LINE_CFGS + MASK_CFGS + ["TRIVIAL-EXTENT"]:
        tt = totals.get(p, {})
        md.append("| %s | %d | %d | %d | %d | %d |" % (p, tt.get("HELPED", 0), tt.get("NEUTRAL", 0), tt.get("HURT", 0), tt.get("NOT_APPLICABLE", 0), sum(1 for k in fragile if k[1] == p)))
    md.append("")
    md += ["## Fragile cells (±u truth buffer)", ""]
    if fragile:
        md += ["| house | provider | class | stated truth | −u | +u |", "| --- | --- | --- | --- | --- | --- |"]
        for (fid, p, c), v in sorted(fragile.items()):
            b0 = next(x for x in rows if x["frame"] == fid and x["provider"] == p)["cells"][c][0]
            md.append("| `%s` | %s | %s | %s | %s | %s |" % (fid, p, names[c], b0, v.get("-u", b0), v.get("+u", b0)))
    else:
        md.append("None: every cell is the same at −u, 0 and +u.")
    md.append("")
    with open(os.path.join(a.out, "failure-type-scorecard.md"), "w") as fo:
        fo.write("\n".join(md))
    dump(os.path.join(W, "scorecard-rows.json"), rows)
    print("aggregated")


if __name__ == "__main__":
    main()
