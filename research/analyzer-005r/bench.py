#!/usr/bin/env python3
"""
bench.py — 005R runtime measurement (RESEARCH ONLY). Preregistration §5.4.

    python3 -I bench.py <run-dir> <out.json> [--n 60]

Run on a quiet machine (no other contender running). A fixed, stratified sample — the first n/6 assets by assetId of
each of six truth classes — is timed:
  V1  on Node 22 and on Node 18.20.4: one cold process (decode + features + rules) per sample, and the per-image
      decode/feature times reported by run.mjs; peak RSS from process.resourceUsage
  V2  one process: cold model load (hash check + load), then per-image routing and detection times; peak RSS
Reported: p50 / p95 per image, per class, cold-start, peak RSS, asset sizes. x86 CPU only; ARM64 phone: PENDING.
"""
import json
import os
import statistics
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
NODE18 = os.environ.get('NODE18', '/home/user/work005r/node18/node-v18.20.4-linux-x64/bin/node')
VENV_PY = os.environ.get('VENV_PY', '/home/user/work005m/venv/bin/python')
CLASSES = ['FLOOR_PLAN', 'TECHNICAL_ELEVATION', 'SECTION', 'SITE_PLAN', 'EXTERIOR_RENDER', 'INTERIOR_RENDER']


def pct(xs, q):
    xs = sorted(xs)
    return round(xs[min(len(xs) - 1, int(round(q * (len(xs) - 1))))], 4) if xs else None


def main(run, out, n=60):
    truth = {r['assetId']: r for r in json.load(open(os.path.join(run, 'truth.json')))['rows']}
    inputs = {x['assetId']: x for x in json.load(open(os.path.join(run, 'inputs-real.json')))}
    sample = []
    for c in CLASSES:
        ids = sorted(a for a, r in truth.items() if r['roleTruth'] == c and r['scoredSize'])
        sample += [inputs[a] for a in ids[: n // len(CLASSES)]]
    res = {'sampleSize': len(sample), 'cpu': os.cpu_count(), 'note': 'x86_64 container CPU; not a phone. ARM64: PENDING'}
    with tempfile.TemporaryDirectory() as d:
        sp = os.path.join(d, 's.json')
        json.dump(sample, open(sp, 'w'))
        for name, node in (('node22', 'node'), ('node18', NODE18)):
            fp = os.path.join(d, f'f-{name}.jsonl')
            t0 = time.time()
            r = subprocess.run([node, os.path.join(HERE, 'v1', 'run.mjs'), 'features', sp, fp], capture_output=True, text=True, check=True)
            wall = time.time() - t0
            rows = [json.loads(l) for l in open(fp)]
            per = [x['ms']['decode'] + x['ms']['features'] for x in rows if 'ms' in x]
            byc = {}
            for x in rows:
                if 'ms' in x:
                    byc.setdefault(truth[x['assetId']]['roleTruth'], []).append(x['ms']['decode'] + x['ms']['features'])
            res[f'V1_{name}'] = {'wallSeconds': round(wall, 2), 'perImageMs_p50': pct(per, 0.5), 'perImageMs_p95': pct(per, 0.95),
                                 'perClassMs_p50': {k: pct(v, 0.5) for k, v in sorted(byc.items())}, 'stdout': r.stdout.strip()}
        vp = os.path.join(d, 'v2.jsonl')
        t0 = time.time()
        subprocess.run([VENV_PY, '-I', os.path.join(HERE, 'v2', 'run_owlvit.py'), sp, vp, '--threads', '4'], capture_output=True, text=True, check=True,
                       env={**os.environ, 'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1'})
        wall = time.time() - t0
        lines = [json.loads(l) for l in open(vp)]
        meta = {k: v for l in lines if l.get('meta') for k, v in l.items()}
        rows = [l for l in lines if not l.get('meta') and 'timing' in l]
        route = [x['timing']['route_s'] for x in rows][1:]   # the first image includes graph warm-up
        det = [x['timing']['detect_s'] for x in rows][1:]
        byc = {}
        for x in rows[1:]:
            byc.setdefault(truth[x['assetId']]['roleTruth'], []).append(x['timing']['route_s'] + x['timing']['detect_s'])
        res['V2_python_cpu'] = {'wallSeconds': round(wall, 2), 'coldLoadSeconds': meta.get('loadSeconds'), 'peakRssMB': meta.get('peakRssMB'),
                                'firstImageSeconds': round(rows[0]['timing']['route_s'] + rows[0]['timing']['detect_s'], 3) if rows else None,
                                'routeSeconds_p50': pct(route, 0.5), 'routeSeconds_p95': pct(route, 0.95), 'detectSeconds_p50': pct(det, 0.5), 'detectSeconds_p95': pct(det, 0.95),
                                'perClassSeconds_p50': {k: pct(v, 0.5) for k, v in sorted(byc.items())}, 'threads': 4,
                                'weightsBytes': 612983940, 'node18': 'NOT_RUN_NODE18 (PyTorch; no Node/ONNX port was built)'}
    res['V1_assetBytes'] = sum(os.path.getsize(os.path.join(HERE, 'v1', f)) for f in ('features.mjs', 'tree.mjs', 'cues.mjs', 'run.mjs'))
    json.dump(res, open(out, 'w'), indent=1, sort_keys=True)
    print(json.dumps(res, indent=1))


if __name__ == '__main__':
    a = sys.argv[1:]
    main(a[0], a[1], int(a[a.index('--n') + 1]) if '--n' in a else 60)
