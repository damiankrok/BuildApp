"""DeepLSD runner — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B).

python -I deeplsd_run.py --repo <DeepLSD checkout> --ckpt <deeplsd_*.tar> --config DEEPLSD-MD|DEEPLSD-WF \
    --frame-id <id> --gray <gray.png> --out <obs.json> [--refine <source-cv obs.json>]

Detection (no --refine): the upstream quickstart configuration (notebooks/quickstart_demo.ipynb) on the frame's
production luma, CPU, one forward pass at native resolution.
Refinement (--refine): the upstream line refiner (deeplsd/models/line_refiner.py with the configuration of
deeplsd/scripts/line_refinement.py) applied to BuildPlan source-cv's own SCV-LINES segments. A separate
configuration, scored separately; never merged with detection.

Checkpoints are loaded with torch.load(weights_only=True) and an allow-list of the omegaconf container classes the
pickles reference (audited with pickletools: no other globals), never with arbitrary unpickling.
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

DETECT_CONF = {
    "detect_lines": True,
    "line_detection_params": {"merge": False, "filtering": True, "grad_thresh": 3, "grad_nfa": True},
}
REFINE_CONF = {
    "line_detection_params": {
        "use_vps": True, "optimize_vps": True, "filtering": False, "lambda_df": 1.0, "lambda_grad": 1.0,
        "lambda_vp": 0.2, "threshold": 1.0, "max_iters": 100000, "minimum_point_number": 2,
        "maximum_model_number": -1, "scoring_exponent": 1,
    }
}


def load_ckpt(path):
    import torch
    import collections
    import typing
    from omegaconf.base import ContainerMetadata, Metadata
    from omegaconf.dictconfig import DictConfig
    from omegaconf.listconfig import ListConfig
    from omegaconf.nodes import AnyNode
    torch.serialization.add_safe_globals([ContainerMetadata, Metadata, DictConfig, ListConfig, AnyNode, typing.Any, collections.defaultdict, dict, list, int])
    return torch.load(path, map_location="cpu", weights_only=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo", required=True)
    p.add_argument("--ckpt", required=True)
    p.add_argument("--config", required=True)
    p.add_argument("--frame-id", required=True)
    p.add_argument("--gray", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--refine")
    p.add_argument("--threads", type=int, default=4)
    a = p.parse_args()
    sys.path.insert(0, a.repo)
    import numpy as np
    import torch
    torch.set_num_threads(a.threads)
    t_start = time.perf_counter()
    ck_sha = common.sha256_file(a.ckpt)
    img = common.read_gray(a.gray)
    ckpt = load_ckpt(a.ckpt)
    inputs = {"image": torch.tensor(img, dtype=torch.float)[None, None] / 255.0}
    obs = []
    pre = "production Rec.601 luma (gray PNG channel 0) / 255, native resolution, CPU float32"
    if a.refine is None:
        from deeplsd.models.deeplsd_inference import DeepLSD
        net = DeepLSD(DETECT_CONF)
        missing = net.load_state_dict(ckpt["model"], strict=True)
        net = net.eval()
        chash = common.config_hash({"conf": DETECT_CONF, "config": a.config}, ck_sha)
        t0 = time.perf_counter()
        with torch.no_grad():
            out = net(inputs)
        infer_ms = (time.perf_counter() - t0) * 1000
        lines = out["lines"][0]
        for (x0, y0), (x1, y1) in lines.tolist():
            pa, pb = (x0, y0), (x1, y1)
            if pb < pa:
                pa, pb = pb, pa
            obs.append(common.segment_obs(len(obs), "DEEPLSD", a.config, a.frame_id, pa, pb, None, {"mode": "detect"}, pre, chash))
        extra = {"strictLoad": str(missing)}
    else:
        from deeplsd.models.line_refiner import LineRefiner
        net = LineRefiner(REFINE_CONF)
        missing = net.load_state_dict(ckpt["model"], strict=False)
        net = net.eval()
        chash = common.config_hash({"conf": REFINE_CONF, "config": a.config}, ck_sha)
        src = json.load(open(a.refine))
        segs = [o for o in src["observations"] if o["configId"] == "SCV-LINES"]
        lines = np.array([[o["geometry"]["a"], o["geometry"]["b"]] for o in segs], dtype=np.float64).reshape(-1, 2, 2)
        t0 = time.perf_counter()
        if len(lines) == 0:
            refined = lines
        else:
            with torch.no_grad():
                res = net({"image": inputs["image"], "lines": [lines]})
            refined = res["refined_lines"][0]
        infer_ms = (time.perf_counter() - t0) * 1000
        for i, ((x0, y0), (x1, y1)) in enumerate(np.asarray(refined).tolist()):
            pa, pb = (x0, y0), (x1, y1)
            if pb < pa:
                pa, pb = pb, pa
            obs.append(common.segment_obs(len(obs), "DEEPLSD", a.config, a.frame_id, pa, pb, None, {"mode": "refine", "refinedFrom": segs[i]["id"] if i < len(segs) else None}, pre, chash))
        extra = {"inputLines": int(len(lines)), "missingKeys": len(missing.missing_keys), "unexpectedKeys": len(missing.unexpected_keys)}
    common.write_json(a.out, {
        "researchOnly": common.RESEARCH_ONLY,
        "provider": "DEEPLSD",
        "config": {"id": a.config, "detect": DETECT_CONF if a.refine is None else None, "refine": REFINE_CONF if a.refine else None, "checkpointSha256": ck_sha},
        "configHash": chash,
        "frameId": a.frame_id,
        "observations": obs,
        "perf": {"wallMs": common.r3((time.perf_counter() - t_start) * 1000), "inferMs": common.r3(infer_ms), "peakRssMB": common.peak_rss_mb(), "count": len(obs), "threads": a.threads, **extra},
    })


if __name__ == "__main__":
    main()
