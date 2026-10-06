"""ELSED runner — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B).

python -I elsed_run.py --cli <elsed_cli> --frame-id <id> --gray <gray.png> --out <obs.json>

Runs the upstream ELSED library (through elsed_cli.cpp, which mirrors upstream PYAPI.cpp) on the frame's production
luma, with the upstream defaults (config ELSED-DEFAULT). Records wall time, the library's own detection time and
the child process's peak RSS.
"""
import argparse
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

CONFIG = {
    "id": "ELSED-DEFAULT",
    "sigma": 1.0,
    "gradientThreshold": 30.0,
    "minLineLen": 15,
    "lineFitErrThreshold": 0.2,
    "pxToSegmentDistTh": 1.5,
    "validationTh": 0.15,
    "validate": 1,
    "treatJunctions": 1,
    "source": "upstream PYAPI.cpp defaults (iago-suarez/ELSED@1878213b)",
}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--cli", required=True)
    p.add_argument("--frame-id", required=True)
    p.add_argument("--gray", required=True)
    p.add_argument("--out", required=True)
    a = p.parse_args()
    chash = common.config_hash(CONFIG, common.sha256_file(a.cli))
    in_sha = common.sha256_file(a.gray)  # the exact bytes handed to the CLI (same-input rule, post-review B5)
    args = [a.cli, a.gray] + [str(CONFIG[k]) for k in ["sigma", "gradientThreshold", "minLineLen", "lineFitErrThreshold", "pxToSegmentDistTh", "validationTh", "validate", "treatJunctions"]]
    t0 = time.perf_counter()
    out = subprocess.run(args, check=True, capture_output=True, text=True).stdout
    wall_ms = (time.perf_counter() - t0) * 1000
    obs, det_ms = [], None
    for line in out.splitlines():
        if line.startswith("#ms"):
            det_ms = float(line.split()[1])
            continue
        x0, y0, x1, y1, sal = map(float, line.split())
        # canonical endpoint order, as source-cv: a before b by x then y
        pa, pb = (x0, y0), (x1, y1)
        if (pb[0], pb[1]) < (pa[0], pa[1]):
            pa, pb = pb, pa
        obs.append(common.segment_obs(len(obs), "ELSED", CONFIG["id"], a.frame_id, pa, pb, sal, {"salience": common.r3(sal)}, "production Rec.601 luma (gray PNG channel 0), no resize; ELSED Gaussian sigma 1 internally", chash))
    common.write_json(a.out, {
        "researchOnly": common.RESEARCH_ONLY,
        "provider": "ELSED",
        "config": CONFIG,
        "configHash": chash,
        "frameId": a.frame_id,
        "input": {"gray": {"file": a.gray, "sha256": in_sha}},
        "observations": obs,
        "perf": {"wallMs": common.r3(wall_ms), "detectMs": det_ms, "peakRssMB": common.peak_rss_mb(children=True), "count": len(obs)},
    })


if __name__ == "__main__":
    main()
