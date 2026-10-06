#!/usr/bin/env python3
"""assemble_proof.py - writes wall-model-proof.json from the measured parts (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B assemble_proof.py --bakeoff <vlm-bakeoff.json> --eval unet=<eval.json>,segformer=<eval.json>
                                   --regions unet=<regions.json>,segformer=<regions.json> --wasm <wasm-a.json,wasm-b.json,...>
                                   --pilot-ckpt <micro.pt> --out <wall-model-proof.json>

Nothing here is re-measured or re-judged: every number is copied from a file a measuring script wrote. The only
computation is arithmetic over those files (min/max, sums of tallies) and the verdict strings, which are stated next
to the numbers they rest on.
"""
import argparse
import hashlib
import json

STRUCT = {'unet': 'wall-unet-structured', 'segformer': 'wall-segformer-structured'}
PILOT = 'micro-referee-pilot'


def kv(s):
    return dict(p.split('=', 1) for p in s.split(',')) if s else {}


def tally_txt(t):
    ans = t['correct'] + t['wrong']
    return f"{t['correct']}/{ans} answered right, {t['unresolved']} unresolved of {t['total']}; confident wrong {t['wrongConfident']}"


def referee(bk, model, ro):
    b = bk['models'].get(model, {}).get(ro, {}).get('CANDIDATE_OVERLAY')
    if not b:
        return None
    out = {'all': b['all'], 'mirror': b['mirror'], 'rotation': b['rotation'], 'counterfactual': b['counterfactual'], 'bySet': {}, 'byClass': {}}
    for s in ('SYNTHETIC', 'REAL_DEV', 'REAL_BLIND8'):
        if s in b:
            out['bySet'][s] = b[s]['all']
            out['byClass'][s] = b[s]['byClass']
    out['summary'] = '; '.join(f"{s} {tally_txt(t)}" for s, t in out['bySet'].items())
    out['confidentWrong'] = f"{100 * b['all']['confidentWrongRate']:.1f} % ({b['all']['wrongConfident']}/{b['all']['total']})"
    out['blind8Answers'] = b.get('blind8Answers', [])
    return out


def wasm_of(wasm, prefix):
    for name, m in wasm.items():
        if name.startswith(prefix):
            return name, m
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bakeoff', required=True)
    ap.add_argument('--eval', required=True)
    ap.add_argument('--regions', required=True)
    ap.add_argument('--wasm', required=True)
    ap.add_argument('--pilot-ckpt', default=None)
    ap.add_argument('--ckpts', default=None, help='unet=<pt>,segformer=<pt>: PyTorch checkpoints, recorded by SHA-256 (they stay outside the repository)')
    ap.add_argument('--verdicts', default=None, help='JSON {unet|segformer|routeCPilot|overall: text}, written after reading the numbers')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    bk = json.load(open(a.bakeoff))
    wasm = {}
    env = None
    for p in a.wasm.split(','):
        w = json.load(open(p))
        env = {k: w[k] for k in ('node', 'arch', 'runtime', 'threads')}
        wasm.update(w['models'])
    out = {'stage': 'BUILDPLAN-ANALYZER-005J', 'kind': 'RESEARCH PROOF - not a production candidate',
           'licence': {'code': 'BuildPlan: UNet-lite is a textbook U-Net; the MiT-B0 SegFormer is an independent re-implementation, not clean-room - its structure follows the Apache-2.0 PVTv2 / HF transformers code (post-review D2); no NVIDIA / smp / timm code',
                       'weights': 'BuildPlan-owned (trained from random initialisation in this stage)', 'pretrainedBackbone': 'NONE',
                       'trainingData': 'BuildPlan synthetic drawings only (research/analyzer-005j/synthetic/vrgen.py); no CubiCasa, ResPlan, Structured3D or publisher pixels',
                       'evaluationData': 'synthetic test renders (seeds disjoint from training) + 7 development houses and the 2 blind-8 houses read locally from the 005I cache; no publisher pixels committed'},
           'wasmEnvironment': env, 'wasm': wasm}
    regions = kv(a.regions)
    for key, path in kv(a.eval).items():
        e = json.load(open(path))
        e['blind8Regions'] = json.load(open(regions[key]))['regions'] if key in regions else None
        e['referee'] = referee(bk, STRUCT[key], 'STRUCTURED')
        name, m = wasm_of(wasm, {'unet': 'unet', 'segformer': 'segformer'}[key])
        if m:
            side = m['inputs'][0]['shape'][-1]
            e['wasmLatency'] = f"{m['medianMs'] / 1000:.2f} s per {side}² frame (median of {m['runs']}, p95 {m['p95Ms'] / 1000:.2f} s); load {m['loadMs'] / 1000:.1f} s"
            e['wasmMemory'] = f"≥ {m['rssAfterMiB']} MiB RSS (lower bound)"
        real = e.get('real', [])
        if real:
            e['realSummary'] = {k: [min(r[k] for r in real), max(r[k] for r in real)] for k in
                                ('exteriorWallRecall', 'exteriorWallRecallSourceCv', 'ADDITIONAL_USEFUL_WALL_EVIDENCE_OVER_SOURCE_CV', 'additionalOverBandsOnly',
                                 'openingAsOpening', 'envelopeContinuityThroughOpenings', 'falseWallInExclusions', 'falseWallInExclusionsSourceCv', 'msPerFrame1Thread')}
        out[key] = e
    for key, path in kv(a.ckpts).items():
        if key in out:
            out[key]['checkpointSha256'] = hashlib.sha256(open(path, 'rb').read()).hexdigest()
    pr = referee(bk, PILOT, 'ENUM_SCORE')
    if pr:
        p = {'params': None, 'summary': pr['summary'], 'confidentWrong': pr['confidentWrong'], 'referee': pr}
        if a.pilot_ckpt:
            import torch
            ck = torch.load(a.pilot_ckpt, weights_only=False, map_location='cpu')
            p.update(params=ck['params'], steps=ck['steps'], batch=ck['batch'], trainSec=ck['trainSec'], heads=ck['heads'],
                     checkpointSha256=hashlib.sha256(open(a.pilot_ckpt, 'rb').read()).hexdigest())
        name, m = wasm_of(wasm, 'micro')
        if m:
            p['wasmLatency'] = f"{m['medianMs']:.0f} ms per question (median of {m['runs']}, 256² crop); load {m['loadMs'] / 1000:.1f} s"
            p['wasmMemory'] = f"≥ {m['rssAfterMiB']} MiB RSS (lower bound)"
        out['routeCPilot'] = p
    if a.verdicts:
        for k, v in json.load(open(a.verdicts)).items():
            if k == 'overall':
                out['verdict'] = v
            elif k in out:
                out[k]['verdict'] = v
    json.dump(out, open(a.out, 'w'), indent=1, ensure_ascii=False)
    print('wrote', a.out, sorted(out))


if __name__ == '__main__':
    main()
