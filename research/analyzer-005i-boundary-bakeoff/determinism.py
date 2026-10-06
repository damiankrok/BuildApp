"""determinism.py — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B).

python -I determinism.py --work /home/user/work005i --frames real/dom-w-helikoniach,synthetic/l-shape --out <json>

Re-runs ELSED, DeepLSD (MD) and MobileSAM (BOX + SOURCE-PROMPTS, no AUTO) on the given frames into a scratch
directory and compares their observations with the first run: segment coordinates / mask bytes, hashed. A provider
whose second run differs is not reproducible on this box. Masks are compared by the SHA-256 of their PNG bytes.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def geom_hash(path):
    d = json.load(open(path))
    parts = []
    for o in sorted(d["observations"], key=lambda o: o["id"]):
        g = o.get("geometry") or {}
        parts.append(json.dumps({"id": o["id"], "a": g.get("a"), "b": g.get("b"), "sha": g.get("sha256")}, sort_keys=True))
    return hashlib.sha256("\n".join(parts).encode()).hexdigest(), len(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", default="/home/user/work005i")
    ap.add_argument("--frames", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    W = a.work
    py = [os.path.join(W, "venv", "bin", "python"), "-I", "-B"]
    env = dict(os.environ, LD_LIBRARY_PATH=os.path.join(W, "upstream", "DeepLSD", "third_party", "progressive-x", "build"))
    res = {}
    for spec in a.frames.split(","):
        setname, fid = spec.split("/")
        meta = json.load(open(os.path.join(W, "frames", setname, fid + ".meta.json")))
        g = os.path.join(W, "frames", setname, fid + ".gray.png")
        c = os.path.join(W, "frames", setname, fid + ".rgb.png")
        tmp = os.path.join(W, "determinism", setname, fid)
        os.makedirs(tmp, exist_ok=True)
        runs = {
            "ELSED-DEFAULT": (py + [os.path.join(HERE, "providers", "elsed_run.py"), "--cli", os.path.join(W, "build", "elsed", "elsed_cli"), "--frame-id", meta["frameId"], "--gray", g, "--out", os.path.join(tmp, "elsed.json")], os.path.join(W, "obs", "elsed", setname, fid + ".json"), os.path.join(tmp, "elsed.json")),
            "DEEPLSD-MD": (py + [os.path.join(HERE, "providers", "deeplsd_run.py"), "--repo", os.path.join(W, "upstream", "DeepLSD"), "--ckpt", os.path.join(W, "ckpt", "deeplsd_md.tar"), "--config", "DEEPLSD-MD", "--frame-id", meta["frameId"], "--gray", g, "--threads", "2", "--out", os.path.join(tmp, "dlsd.json")], os.path.join(W, "obs", "deeplsd", setname, fid + ".md.json"), os.path.join(tmp, "dlsd.json")),
            "MOBILESAM": (py + [os.path.join(HERE, "providers", "msam_run.py"), "--repo", os.path.join(W, "upstream", "MobileSAM"), "--ckpt", os.path.join(W, "ckpt", "mobile_sam.pt"), "--frame-id", meta["frameId"], "--rgb", c, "--meta", os.path.join(W, "frames", setname, fid + ".meta.json"), "--threads", "2", "--masks-dir", os.path.join(tmp, "masks"), "--out", os.path.join(tmp, "msam.json")], os.path.join(W, "obs", "mobilesam", setname, fid + ".json"), os.path.join(tmp, "msam.json")),
        }
        for name, (cmd, first, second) in runs.items():
            subprocess.run(cmd, check=True, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if name == "MOBILESAM":
                d1 = {o["id"]: o["geometry"]["sha256"] for o in json.load(open(first))["observations"] if o.get("geometry") and o["configId"] != "MSAM-AUTO"}
                d2 = {o["id"]: o["geometry"]["sha256"] for o in json.load(open(second))["observations"] if o.get("geometry")}
                same = d1 == d2
                res["%s/%s" % (spec, name)] = {"identical": same, "masksCompared": len(d2), "differing": sorted(k for k in d2 if d1.get(k) != d2[k])}
            else:
                h1, n1 = geom_hash(first)
                h2, n2 = geom_hash(second)
                res["%s/%s" % (spec, name)] = {"identical": h1 == h2, "count": [n1, n2], "sha256": [h1, h2]}
            print(spec, name, res["%s/%s" % (spec, name)]["identical"])
    with open(a.out, "w") as f:
        json.dump(res, f, sort_keys=True, indent=1)


if __name__ == "__main__":
    main()
