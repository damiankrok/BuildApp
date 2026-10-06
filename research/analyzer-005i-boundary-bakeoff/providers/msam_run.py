"""MobileSAM runner — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B).

python -I msam_run.py --repo <MobileSAM checkout> --ckpt mobile_sam.pt --frame-id <id> --rgb <rgb.png> \
    --meta <frame meta.json> --masks-dir <dir outside the repo> --out <obs.json> [--auto] [--pps 16]

MobileSAM emits MASKS. It is never told, and never claims to know, what a wall, a garage, a terrace or a room is.
The prompt protocols and the mask-selection rules are fixed in methodology.md BEFORE any scoring; this file
implements exactly those rules, with no access to ground truth:

  MSAM-BOX            box = the production plan extent (planExtent: the dimensioned extent from the frame's
                      dimension chains, or the wall witness when no chain states it) grown by one wall on every side,
                      clipped to the frame. multimask_output=True; keep the mask with the highest predicted IoU.
  MSAM-SOURCE-PROMPTS points only. Positives: the centres of the three largest ENCLOSED BUILT cells of BuildPlan's own
                      default decomposition (source-cv + boundary evidence); ties by area, then y, then x. Negatives:
                      the four corners of the extent grown by two walls, clipped 2 px inside the frame.
                      multimask_output=True; highest predicted IoU. DEPENDS ON BuildPlan source-cv: not an
                      independent detector.
  MSAM-AUTO           SamAutomaticMaskGenerator(points_per_side=16, defaults otherwise). Selection: among masks whose
                      bounding box lies inside the extent grown by two walls, the largest by area; ties by predicted
                      IoU. All masks are kept (outside the repo) so the scorer can also report an ORACLE upper bound,
                      which is labelled as such and is never a selection rule.

Prompt sensitivity (deterministic): BOX with each side moved out / in by one wall (8 variants); SOURCE-PROMPTS with
all positives moved by one wall left/right/up/down (4 variants). Same selection rule for every variant.
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

PRE = "decoded RGBA -> RGB (alpha dropped, frames opaque); SamPredictor ResizeLongestSide(1024) + pixel mean/std normalization, pad to 1024x1024"


def mask_summary(mask, path):
    import cv2
    import numpy as np
    m = (mask > 0).astype(np.uint8)
    cv2.imwrite(path, m * 255)
    ys, xs = np.nonzero(m)
    n, _ = cv2.connectedComponents(m, connectivity=8)
    bbox = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else [0, 0, 0, 0]
    return {"type": "MASK", "file": path, "sha256": common.sha256_file(path), "widthPx": int(m.shape[1]), "heightPx": int(m.shape[0]), "areaPx": int(m.sum()), "bbox": bbox, "components": int(n - 1)}


def prompts_from_meta(meta, W, H):
    mp = meta["msamPrompt"]
    e, w = mp["extent"], float(mp["wallPx"])
    clipx = lambda v: min(max(v, 0.0), W - 1.0)  # noqa: E731
    clipy = lambda v: min(max(v, 0.0), H - 1.0)  # noqa: E731
    box = [clipx(e["x0"] - w), clipy(e["y0"] - w), clipx(e["x1"] + w), clipy(e["y1"] + w)]
    cells = sorted(mp["builtCells"], key=lambda c: (-c["areaPx"], (c["rect"]["y0"] + c["rect"]["y1"]) / 2, (c["rect"]["x0"] + c["rect"]["x1"]) / 2))[:3]
    pos = [[(c["rect"]["x0"] + c["rect"]["x1"]) / 2.0, (c["rect"]["y0"] + c["rect"]["y1"]) / 2.0] for c in cells]
    g = 2 * w
    neg = [[min(max(x, 2.0), W - 3.0), min(max(y, 2.0), H - 3.0)] for x, y in [(e["x0"] - g, e["y0"] - g), (e["x1"] + g, e["y0"] - g), (e["x1"] + g, e["y1"] + g), (e["x0"] - g, e["y1"] + g)]]
    grown2 = [e["x0"] - g, e["y0"] - g, e["x1"] + g, e["y1"] + g]
    return box, pos, neg, w, grown2


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo", required=True)
    p.add_argument("--ckpt", required=True)
    p.add_argument("--frame-id", required=True)
    p.add_argument("--rgb", required=True)
    p.add_argument("--meta", required=True)
    p.add_argument("--masks-dir", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--auto", action="store_true")
    p.add_argument("--pps", type=int, default=16)
    p.add_argument("--threads", type=int, default=4)
    a = p.parse_args()
    sys.path.insert(0, a.repo)
    import numpy as np
    import torch
    torch.set_num_threads(a.threads)
    from mobile_sam import SamAutomaticMaskGenerator, SamPredictor, sam_model_registry
    t_start = time.perf_counter()
    ck_sha = common.sha256_file(a.ckpt)
    model = sam_model_registry["vit_t"](checkpoint=None)
    model.load_state_dict(torch.load(a.ckpt, map_location="cpu", weights_only=True), strict=True)
    model.eval()
    img = common.read_rgb(a.rgb)
    H, W = img.shape[:2]
    meta = json.load(open(a.meta))
    os.makedirs(a.masks_dir, exist_ok=True)
    obs, perf, configs = [], {}, {}
    if meta.get("msamPrompt") is None:
        common.write_json(a.out, {"researchOnly": common.RESEARCH_ONLY, "provider": "MOBILESAM", "frameId": a.frame_id, "observations": [], "perf": {}, "skipped": "no source-cv extent for this frame, so no BOX or SOURCE prompt can be derived"})
        return
    box, pos, neg, w, grown2 = prompts_from_meta(meta, W, H)
    pred = SamPredictor(model)
    t0 = time.perf_counter()
    with torch.no_grad():
        pred.set_image(img)
    perf["encoderMs"] = common.r3((time.perf_counter() - t0) * 1000)

    def run(config_id, variant, point_coords=None, point_labels=None, bx=None):
        t = time.perf_counter()
        with torch.no_grad():
            masks, scores, _ = pred.predict(point_coords=None if point_coords is None else np.array(point_coords, dtype=np.float32), point_labels=None if point_labels is None else np.array(point_labels), box=None if bx is None else np.array(bx, dtype=np.float32), multimask_output=True)
        k = int(np.argmax(scores))
        path = os.path.join(a.masks_dir, "%s-%s.png" % (config_id.lower(), variant))
        geom = mask_summary(masks[k], path)
        cfg = {"config": config_id, "variant": variant, "box": None if bx is None else [common.r3(v) for v in bx], "points": None if point_coords is None else [[common.r3(x), common.r3(y)] for x, y in point_coords], "labels": point_labels, "selection": "highest predicted IoU of 3 multimask outputs"}
        chash = common.config_hash(cfg, ck_sha)
        obs.append({"id": "mobilesam-%s-%s" % (config_id.lower(), variant), "provider": "MOBILESAM", "configId": config_id, "sourceFrameId": a.frame_id, "kind": "REGION_MASK", "geometry": geom, "confidence": common.r3(scores[k]), "provenance": {"variant": variant, "prompt": cfg, "allScores": [common.r3(s) for s in scores], "chosen": k, "decoderMs": common.r3((time.perf_counter() - t) * 1000)}, "preprocessing": PRE, "configHash": chash})

    run("MSAM-BOX", "base", bx=box)
    for side, idx in (("x0", 0), ("y0", 1), ("x1", 2), ("y1", 3)):
        for sign, name in ((-1, "out") if idx < 2 else (1, "out"), (1, "in") if idx < 2 else (-1, "in")):
            b = list(box)
            b[idx] = min(max(b[idx] + sign * w, 0.0), (W if idx % 2 == 0 else H) - 1.0)
            run("MSAM-BOX", "%s-%s" % (side, name), bx=b)
    if pos:
        labels = [1] * len(pos) + [0] * len(neg)
        run("MSAM-SOURCE-PROMPTS", "base", point_coords=pos + neg, point_labels=labels)
        for name, dx, dy in (("left", -w, 0), ("right", w, 0), ("up", 0, -w), ("down", 0, w)):
            moved = [[min(max(x + dx, 0.0), W - 1.0), min(max(y + dy, 0.0), H - 1.0)] for x, y in pos]
            run("MSAM-SOURCE-PROMPTS", name, point_coords=moved + neg, point_labels=labels)
    if a.auto:
        gen = SamAutomaticMaskGenerator(model, points_per_side=a.pps)
        t = time.perf_counter()
        with torch.no_grad():
            anns = gen.generate(img)
        perf["autoMs"] = common.r3((time.perf_counter() - t) * 1000)
        perf["autoMasks"] = len(anns)
        auto_dir = os.path.join(a.masks_dir, "auto")
        os.makedirs(auto_dir, exist_ok=True)
        inside = []
        for i, ann in enumerate(anns):
            x, y, bw, bh = ann["bbox"]
            if x >= grown2[0] and y >= grown2[1] and x + bw <= grown2[2] and y + bh <= grown2[3]:
                inside.append((ann["area"], ann["predicted_iou"], i))
        all_masks = []
        for i, ann in enumerate(anns):
            path = os.path.join(auto_dir, "m%03d.png" % i)
            g = mask_summary(ann["segmentation"], path)
            all_masks.append({"index": i, "file": path, "sha256": g["sha256"], "areaPx": g["areaPx"], "bbox": g["bbox"], "predictedIou": common.r3(ann["predicted_iou"]), "stability": common.r3(ann["stability_score"])})
        cfg = {"config": "MSAM-AUTO", "points_per_side": a.pps, "selection": "largest mask with bbox inside extent grown by two walls; ties by predicted IoU"}
        chash = common.config_hash(cfg, ck_sha)
        if inside:
            inside.sort(key=lambda t: (-t[0], -t[1], t[2]))
            k = inside[0][2]
            geom = mask_summary(anns[k]["segmentation"], os.path.join(a.masks_dir, "msam-auto-selected.png"))
            obs.append({"id": "mobilesam-msam-auto-selected", "provider": "MOBILESAM", "configId": "MSAM-AUTO", "sourceFrameId": a.frame_id, "kind": "REGION_MASK", "geometry": geom, "confidence": common.r3(anns[k]["predicted_iou"]), "provenance": {"selectedIndex": k, "candidatesInside": len(inside), "allMasks": all_masks, "prompt": cfg}, "preprocessing": PRE, "configHash": chash})
        else:
            obs.append({"id": "mobilesam-msam-auto-none", "provider": "MOBILESAM", "configId": "MSAM-AUTO", "sourceFrameId": a.frame_id, "kind": "REGION_MASK", "geometry": None, "confidence": None, "provenance": {"selectedIndex": None, "candidatesInside": 0, "allMasks": all_masks, "prompt": cfg}, "preprocessing": PRE, "configHash": chash})
    perf["wallMs"] = common.r3((time.perf_counter() - t_start) * 1000)
    perf["peakRssMB"] = common.peak_rss_mb()
    perf["threads"] = a.threads
    common.write_json(a.out, {"researchOnly": common.RESEARCH_ONLY, "provider": "MOBILESAM", "checkpointSha256": ck_sha, "frameId": a.frame_id, "observations": obs, "perf": perf, "prompts": {"box": [common.r3(v) for v in box], "positives": [[common.r3(x), common.r3(y)] for x, y in pos], "negatives": [[common.r3(x), common.r3(y)] for x, y in neg], "wallPx": w}})


if __name__ == "__main__":
    main()
