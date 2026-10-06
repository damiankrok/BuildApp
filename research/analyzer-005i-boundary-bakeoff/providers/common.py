"""Shared helpers for the provider runners — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B).

Not production code. Writes the research observation schema (observation.ts) as JSON. Every runner is started with
`python -I <runner> ...` so that nothing from the current directory or the downloaded upstream trees is imported by
accident; upstream code paths are passed explicitly as arguments and appended to sys.path by the runner itself.
"""
import hashlib
import json
import os
import resource
import sys

RESEARCH_ONLY = "BUILDPLAN-ANALYZER-005I research-only observation schema; not production architecture"


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_text(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def config_hash(config, extra=""):
    return sha256_text(json.dumps(config, sort_keys=True, separators=(",", ":")) + "|" + extra)


def r3(x):
    return round(float(x), 3)


def peak_rss_mb(children=False):
    who = resource.RUSAGE_CHILDREN if children else resource.RUSAGE_SELF
    return round(resource.getrusage(who).ru_maxrss / 1024.0, 1)


def read_gray(path):
    """The frame's production Rec.601 luma, exactly: the gray PNG stores it in R=G=B; take channel 0, no conversion."""
    import cv2
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise SystemExit("cannot read " + path)
    if img.ndim == 3:
        img = img[:, :, 0]
    return img


def read_rgb(path):
    """The frame's decoded pixels as RGB (alpha dropped; the decoded frames are opaque)."""
    import cv2
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise SystemExit("cannot read " + path)
    if img.ndim == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    if img.shape[2] == 4:
        return cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def segment_obs(idx, provider, config_id, frame_id, a, b, confidence, provenance, preprocessing, chash):
    return {
        "id": "%s-%s-%d" % (provider.lower(), config_id.lower(), idx),
        "provider": provider,
        "configId": config_id,
        "sourceFrameId": frame_id,
        "kind": "LINE_SEGMENT",
        "geometry": {"type": "SEGMENT", "a": [r3(a[0]), r3(a[1])], "b": [r3(b[0]), r3(b[1])]},
        "confidence": None if confidence is None else r3(confidence),
        "provenance": provenance,
        "preprocessing": preprocessing,
        "configHash": chash,
    }


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, sort_keys=True)


def log(msg):
    sys.stderr.write(msg + "\n")
