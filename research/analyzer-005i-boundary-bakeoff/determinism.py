"""determinism.py — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B).

python -I -B determinism.py --work /home/user/work005i --frames real/dom-w-helikoniach,synthetic/l-shape --out <json>
python -I -B determinism.py --work /home/user/work005i --compare-prev /home/user/work005i/obs-prev --out <json>

Re-runs ELSED, DeepLSD (MD) and MobileSAM (BOX + SOURCE-PROMPTS, no AUTO) on the given frames into a scratch
directory and compares their observations with the first run: segment coordinates / mask bytes, hashed. A provider
whose second run differs is not reproducible on this box. Masks are compared by the SHA-256 of their PNG bytes.

--compare-prev (post-review B5): compares EVERY provider output under obs/ with a copy taken before the full re-run
that added the input hashes (every configuration, every frame, MSAM-AUTO's full mask set included).
"""
import argparse
import glob
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


def mask_hashes(path):
    out = {}
    for o in json.load(open(path))["observations"]:
        g = o.get("geometry") or {}
        out[o["id"]] = g.get("sha256")
        for am in o["provenance"].get("allMasks", []):
            out["%s/all/%d" % (o["id"], am["index"])] = am["sha256"]
    return out


def line_shift(old, new):
    """per observation id: the largest endpoint move between the two runs, endpoint order ignored (px)"""
    a = {o["id"]: o["geometry"] for o in json.load(open(old))["observations"] if (o.get("geometry") or {}).get("type") == "SEGMENT"}
    b = {o["id"]: o["geometry"] for o in json.load(open(new))["observations"] if (o.get("geometry") or {}).get("type") == "SEGMENT"}
    d = []
    for k in sorted(set(a) & set(b)):
        p, q = a[k], b[k]
        same = max(abs(x - y) for u, v in ((p["a"], q["a"]), (p["b"], q["b"])) for x, y in zip(u, v))
        swap = max(abs(x - y) for u, v in ((p["a"], q["b"]), (p["b"], q["a"])) for x, y in zip(u, v))
        d.append(min(same, swap))
    n = max(1, len(d))
    return {"idsCompared": len(d), "idsOnlyInOne": len(set(a) ^ set(b)), "shareMovedOver0.1px": round(sum(1 for x in d if x > 0.1) / n, 4), "shareMovedOver1px": round(sum(1 for x in d if x > 1) / n, 4), "maxMovePx": round(max(d), 3) if d else None}


def compare_prev(W, prev):
    res = {"comparedWith": "copy of obs/ taken before the full provider re-run (post-review B5)", "configs": {}}
    for prov, pat in (("ELSED-DEFAULT", "elsed/%s/*.json"), ("DEEPLSD-MD", "deeplsd/%s/*.md.json"), ("DEEPLSD-WF", "deeplsd/%s/*.wf.json"), ("DEEPLSD-MD-REFINE-SCV", "deeplsd/%s/*.md-refine-scv.json"), ("MOBILESAM", "mobilesam/%s/*.json")):
        for setname in ("real", "synthetic"):
            rows = res["configs"].setdefault(prov, {"identical": [], "differing": {}})
            for new in sorted(glob.glob(os.path.join(W, "obs", pat % setname))):
                rel = os.path.relpath(new, os.path.join(W, "obs"))
                old = os.path.join(prev, rel)
                key = "%s/%s" % (setname, os.path.basename(new).split(".")[0])
                if not os.path.exists(old):
                    rows["differing"][key] = "no earlier output"
                    continue
                if prov == "MOBILESAM":
                    h1, h2 = mask_hashes(old), mask_hashes(new)
                    if h1 == h2:
                        rows["identical"].append(key)
                    else:
                        rows["differing"][key] = {"masks": len(h2), "differingMasks": len([k for k in set(h1) | set(h2) if h1.get(k) != h2.get(k)])}
                else:
                    (h1, n1), (h2, n2) = geom_hash(old), geom_hash(new)
                    if h1 == h2:
                        rows["identical"].append(key)
                    else:
                        rows["differing"][key] = dict({"count": [n1, n2]}, **line_shift(old, new))
    for prov, rows in res["configs"].items():
        rows["identicalCount"] = len(rows.pop("identical"))
        rows["differingCount"] = len(rows["differing"])
        sh = [v for v in rows["differing"].values() if isinstance(v, dict) and "shareMovedOver0.1px" in v]
        if sh:
            rows["differingSummary"] = {"shareMovedOver0.1px": [min(v["shareMovedOver0.1px"] for v in sh), max(v["shareMovedOver0.1px"] for v in sh)], "shareMovedOver1px": [min(v["shareMovedOver1px"] for v in sh), max(v["shareMovedOver1px"] for v in sh)], "maxMovePx": max(v["maxMovePx"] or 0 for v in sh)}
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", default="/home/user/work005i")
    ap.add_argument("--frames")
    ap.add_argument("--compare-prev")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    W = a.work
    if a.compare_prev:
        with open(a.out, "w") as f:
            json.dump(compare_prev(W, a.compare_prev), f, sort_keys=True, indent=1)
        return
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
