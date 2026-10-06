"""aggregate.py — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B).

python -I aggregate.py --work /home/user/work005i --repo <BuildApp> --out <stage-reports/artifacts/analyzer-005i/boundary-bakeoff>

Turns the scorer's per-frame numbers into the committed artifacts (text facts only): synthetic-results.json,
development-results.json, performance.json, fusion-replay.json, source-manifest.json, providers.json and
failure-type-scorecard.md (methodology.md §8 rules, applied mechanically). Deterministic: sorted keys, rounded numbers.
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


LINE_KEYS = ["count", "exteriorWallCoverage", "continuityAcrossOpenings", "longWallRecovery", "cornerEndpointErrorMedianPx", "cornersWithoutSegment", "angularErrorDeg", "fragmentationSegmentsPerMetre", "duplicateRate", "unsupportedLineRate", "additionalSolidCoverageM", "additionalOpeningCoverageM", "additionalSolidCoverageShare", "additionalOpeningCoverageShare", "falseLinesDistractors", "falseLinesDistractorsLengthPx", "supportedLineRecall", "boundaryDistractors", "boundaryDistractorsLengthM", "additionalDistractorLengthM", "exclusionOutlineLinesM", "exclusionOutlineAddedOverScvM", "additionalIds"]
REGION_KEYS = ["regionIoU", "boundaryIoU", "boundaryPrecision", "boundaryRecall", "openingRecall", "buildingCoverage", "areaRatio", "outsideArea", "overreach", "bodyCoverage", "openingLeakage", "textDimensionInclusion", "components", "significantComponents", "failureTypes", "predictedIoU", "promptSensitivity", "oracleUpperBoundIoU_NOT_A_SELECTION", "autoMasks", "noMask"]


def frame_rows(scores):
    out = {}
    for fid, f in sorted(scores.items()):
        lines = {c: {k: f["lines"][c].get(k) for k in LINE_KEYS if k in f["lines"][c]} for c in LINE_CFGS if c in f["lines"] and not f["lines"][c].get("missing")}
        regions = {c: {k: f["regions"][c].get(k) for k in REGION_KEYS if k in f["regions"][c]} for c in MASK_CFGS + REGION_CMP if c in f["regions"]}
        out[fid] = {"frameId": f["frameId"], "metresPerPx": f["metresPerPx"], "wallPxTruth": f["wallPxTruth"], "tolerancesPx": {"tau": r(f["tau"], 2), "tauB": r(f["tauB"], 2)},
                    "exteriorEdges": f["exteriorEdges"], "solidLengthM": f["solidLengthM"], "openingLengthM": f["openingLengthM"], "scvUnion": f["SCV-UNION"], "lines": lines, "regions": regions}
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
        if c == "MSAM-AUTO":
            a["mean_oracleUpperBoundIoU_NOT_A_SELECTION"] = mean([x.get("oracleUpperBoundIoU_NOT_A_SELECTION") for x in rows])
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
        out[fid] = {"maskUnion": rows, "evidenceAvailability": {"gapsOnTruthExterior": sum(1 for x in ev if x["where"] == "EXTERIOR_EDGE"), "gapsOutsideBuilding": sum(1 for x in ev if x["where"] == "OUTSIDE"), "byProvider": avail,
                                                                 "usefulBridgesNotAlreadyInScvLines": {p: sum(1 for x in ev if x["where"] == "EXTERIOR_EDGE" and p in x["bridgedBy"] and "SCV-LINES" not in x["bridgedBy"]) for p in EXT_LINE_CFGS + MASK_CFGS}}}
    return out


# ------------------------------------------------------------ scorecard (methodology §8)
def body_edges(truth, f, kind):
    """indices of exterior edges lying on the boundary of the bodies of `kind`"""
    from shapely.geometry import Point, Polygon
    polys = [Polygon(b["polygon"]) for b in truth["bodies"] if b["kind"] == kind]
    idx = []
    for e in f["edges"]:
        mid = Point((e["a"][0] + e["b"][0]) / 2, (e["a"][1] + e["b"][1]) / 2)
        if any(p.exterior.distance(mid) <= 3 for p in polys):
            idx.append(e["i"])
    return idx


def scorecard(scores, truths):
    rows = []
    for fid, f in sorted(scores.items()):
        t = truths[fid]
        kinds_open = set(o["kind"] for o in t["openings"])
        excl_kinds = set(e["kind"] for e in t["exclusions"])
        body_kinds = set(b["kind"] for b in t["bodies"])
        edges = f["edges"]
        weak = [e["i"] for e in edges if e["lengthM"] >= 3 and (e["unionSolidCov"] or 0) < 0.6]
        open_len = sum(1 for _ in [])
        win_len = 0.0
        for e in edges:
            pass
        win_runs_m = sum(((o["b"][0] - o["a"][0]) ** 2 + (o["b"][1] - o["a"][1]) ** 2) ** 0.5 for o in t["openings"] if o["kind"] in ("WINDOW", "GLAZED", "DOOR")) * f["metresPerPx"]
        scv_o = f["regions"].get("SCV-OUTLINE", {})
        for p in EXT_LINE_CFGS + MASK_CFGS + ["TRIVIAL-EXTENT"]:
            is_mask = p in MASK_CFGS or p == "TRIVIAL-EXTENT"
            cells = {}
            if is_mask:
                m = f["regions"].get(p)
                if not m or m.get("noMask"):
                    for k in ["longWeakExteriorWall", "wallInterruptedByWindows", "garageDoorFacade", "attachedGarage", "bay", "exteriorVsTerrace", "mainBodyMask", "innerRoomVsBuilding"]:
                        cells[k] = ("NOT_APPLICABLE" if k == "longWeakExteriorWall" else "HURT" if k in ("mainBodyMask",) else "NEUTRAL", ["no mask selected"])
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
                    addo = sum(x["addOpenM"] for x in per)
                    cells["wallInterruptedByWindows"] = ("HELPED" if win_runs_m and addo >= 0.2 * win_runs_m else "NEUTRAL", (ids[:6] if addo else []) + ["+%.2f m of %.2f m opening runs beyond SCV-UNION" % (addo, win_runs_m)])
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
                    be = body_edges(t, f, kind)
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

    # ---------------- synthetic-results.json
    dump(os.path.join(a.out, "synthetic-results.json"), {
        "researchOnly": True,
        "generator": {"file": "research/analyzer-005i-boundary-bakeoff/synthetic/generate.py", "sha256": corpus["generatorSha256"], "opencv": corpus["opencv"], "numpy": corpus["numpy"], "pxPerM": corpus["pxPerM"], "supersampling": corpus["supersampling"], "exteriorWallM": corpus["exteriorWallM"], "partitionM": corpus["partitionM"]},
        "cases": [{"id": c["id"], "seed": c["seed"], "degradation": c["degradation"], "bytesSha256": c["sha256"], "truthSha256": c["truthSha256"]} for c in corpus["cases"]],
        "baselineInputs": "extent = production planExtent with no chains (wall witness), never the truth; it feeds the boundary layer, the MobileSAM BOX / SOURCE prompts and the AUTO selection window. ORACLE SCALE only (generator metres per pixel; thresholds, not a prompt). No chains (methodology §7.1, §11 E6 correction)",
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
    })
    # ---------------- fusion-replay.json
    dump(os.path.join(a.out, "fusion-replay.json"), {
        "researchOnly": True,
        "seam": "NONE. The production boundary resolver (decomposePlan -> boundaryExtension -> solveOutline / classifyBodies / completeBoundary) takes only the ink Mask, bands, chains, registration, extent and options. No line list or region mask can be passed without changing production code.",
        "replay1_maskUnion": "Out-of-contract input perturbation: mask' = mask OR rasterise(provider segments, 1 px); the same production boundary layer re-run with identical bands, chains, registration, extent and options (fusion-replay.ts). A 1-px line cannot become wall-thick ink on its own, but many added lines can raise the ink density of a wall-thick window past readWallLine's 80 % — openingsReadAsWall measures exactly that side effect.",
        "replay2_evidenceAvailability": "Per baseline TRUE_EXTERIOR_GAP / UNKNOWN_GAP: on a truth exterior edge, does the provider bridge it (lines: >= 80 % covered by parallel segments within a wall of the gap line; masks: mask = 1 on >= 80 % of the gap line) — useful; outside the truth building — false evidence.",
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
    wp = os.path.join(W, "onnx", "wasm-probe-node18.json")
    if os.path.exists(wp):
        perf["wasmProbeNode18"] = load(wp)
    ex = os.path.join(W, "onnx", "export.json")
    if os.path.exists(ex):
        e = load(ex)
        perf["onnxExport"] = {k: ({kk: vv for kk, vv in v.items() if kk != "file"} if isinstance(v, dict) else v) for k, v in e.items()}
    det = os.path.join(W, "determinism.json")
    if os.path.exists(det):
        perf["determinism"] = load(det)
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
                row.update({"sourceByteSha256": m["sourceBytes"]["sha256"], "sourceFile": m["sourceBytes"]["file"], "generatorSha256": m["generatorSha256"], "oracleScale": m.get("oracle"), "extent": m.get("extent")})
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
    rows = scorecard(real, truths_real)
    classes = ["longWeakExteriorWall", "wallInterruptedByWindows", "garageDoorFacade", "attachedGarage", "bay", "exteriorVsTerrace", "mainBodyMask", "innerRoomVsBuilding"]
    names = {"longWeakExteriorWall": "long weak ext. wall", "wallInterruptedByWindows": "wall interrupted by windows", "garageDoorFacade": "garage-door facade", "attachedGarage": "attached garage", "bay": "bay", "exteriorVsTerrace": "exterior vs terrace", "mainBodyMask": "main-body mask", "innerRoomVsBuilding": "inner room vs building"}
    short = {"HELPED": "**HELPED**", "NEUTRAL": "NEUTRAL", "HURT": "**HURT**", "NOT_APPLICABLE": "n/a"}
    md = ["# 005I Track B — failure-type scorecard (real development set)", "",
          "Rules: `methodology.md` §8, fixed before scoring and applied mechanically by `aggregate.py`. Baselines are the same-frame",
          "source-cv layers: `SCV-UNION` (SCV-LINES ∪ wall bands ∪ boundary pieces ∪ bridged gaps) for line providers, `SCV-OUTLINE` (the",
          "default reading's opening-aware outline) for masks. Truth is the agent's manual annotation (a limitation). No single scalar.", ""]
    totals = {}
    for p in EXT_LINE_CFGS + MASK_CFGS + ["TRIVIAL-EXTENT"]:
        if p == "TRIVIAL-EXTENT":
            md += ["## Reference: TRIVIAL-EXTENT (no model)", "", "The same mask rules applied to the production plan-extent rectangle itself (the information the MSAM-BOX prompt", "already carries). Not a provider; added so the MobileSAM cells can be read against what the box alone earns.", ""]
        md += ["## %s" % p, "", "| house | " + " | ".join(names[c] for c in classes) + " |", "| --- |" + " --- |" * len(classes)]
        for row in [x for x in rows if x["provider"] == p]:
            md.append("| `%s` | " % row["frame"] + " | ".join(short[row["cells"][c][0]] for c in classes) + " |")
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
    md += ["## Totals (cells, all classes and houses)", "", "| provider | HELPED | NEUTRAL | HURT | n/a |", "| --- | --- | --- | --- | --- |"]
    for p in EXT_LINE_CFGS + MASK_CFGS + ["TRIVIAL-EXTENT"]:
        tt = totals.get(p, {})
        md.append("| %s | %d | %d | %d | %d |" % (p, tt.get("HELPED", 0), tt.get("NEUTRAL", 0), tt.get("HURT", 0), tt.get("NOT_APPLICABLE", 0)))
    md.append("")
    with open(os.path.join(a.out, "failure-type-scorecard.md"), "w") as fo:
        fo.write("\n".join(md))
    dump(os.path.join(W, "scorecard-rows.json"), rows)
    print("aggregated")


if __name__ == "__main__":
    main()
