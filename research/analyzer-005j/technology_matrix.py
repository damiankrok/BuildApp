#!/usr/bin/env python3
"""technology_matrix.py - the 005J technology matrix (RESEARCH ONLY, BUILDPLAN-ANALYZER-005J).

    python -I -B technology_matrix.py --bakeoff <vlm-bakeoff.json> --wall <wall-model-proof.json> --out-md <md> --out-json <json>

Static facts (licences, sizes, runtimes) come from the live audits (`floorplan/*.md`, `vlm/vlm-audit.md`, read
2026-10-06); quality and confident-wrong figures are pulled from the measured results so the table cannot drift from them.
"""
import argparse
import json

COLS = ['technology', 'task', 'parameters', 'artifact_size', 'runtime', 'code_license', 'weight_license', 'training_data', 'commercial_status', 'pretrained_available',
        'actual_artifact_verified', 'wall_output', 'opening_output', 'room_output', 'mask_output', 'VQA', 'ONNX', 'LiteRT', 'Android', 'CPU', 'GPU', 'memory', 'latency',
        'quality_on_BuildPlan', 'confident_wrong', 'integration_complexity', 'verdict']


def pct(x):
    return '—' if x is None else f'{100 * x:.1f} %'


def vlm_quality(bk, model, ro='ENUM_SCORE'):
    b = bk['models'].get(model, {}).get(ro, {}).get('CANDIDATE_OVERLAY')
    if not b:
        return 'not run', '—'
    parts = []
    for s in ('SYNTHETIC', 'REAL_DEV', 'REAL_BLIND8'):
        if s in b:
            t = b[s]['all']
            parts.append(f"{s}: {t['correct']}/{t['correct'] + t['wrong']} answered right of {t['total']}")
    t = b['all']
    return '; '.join(parts) + f"; mirror {pct(b['mirror']['rateWithAnAnswer'])} (answered pairs)", f"{pct(t['confidentWrongRate'])} ({t['wrongConfident']}/{t['total']})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bakeoff', required=True)
    ap.add_argument('--wall', required=True)
    ap.add_argument('--out-md', required=True)
    ap.add_argument('--out-json', required=True)
    a = ap.parse_args()
    bk = json.load(open(a.bakeoff))
    wl = json.load(open(a.wall))
    lat = bk.get('latencyMs', {})

    def L(model, k):
        v = lat.get(f'{model}|{k}')
        return f"{v['median'] / 1000:.1f} s median" if v else '—'

    rows = []
    q, cw = vlm_quality(bk, 'florence2-base')
    rows.append(dict(technology='Florence-2-base (florence-community@00921df, native-format port of microsoft@5ca5edf; a post-review sample of 37 of 666 tensors matched byte for byte, full identity not verified)', task='captioning / OD / grounding / OCR (15 task tokens); no VQA token', parameters='231.6 M',
                     artifact_size='463 MB fp16; ONNX int8 275 MB, mixed q4 215 MB', runtime='transformers ≥ 4.56 / ONNX Runtime / Transformers.js', code_license='MIT', weight_license='MIT',
                     training_data='FLD-5B (unreleased; ImageNet-22k, O365, OpenImages, CC, LAION)', commercial_status='CONDITIONAL', pretrained_available='yes', actual_artifact_verified='yes (run in 005J)',
                     wall_output='no', opening_output='grounding boxes only', room_output='no', mask_output='referring segmentation', VQA='no (unsupported)', ONNX='yes', LiteRT='no', Android='WASM only (no native path)',
                     CPU='yes', GPU='yes', memory='≈ 1 GB fp32 torch', latency=L('florence2-base', 'score') + ' per enum-scored question (desktop CPU)', quality_on_BuildPlan=q, confident_wrong=cw,
                     integration_complexity='high (encoder-decoder, 768² input)', verdict='REJECT for the referee'))
    q, cw = vlm_quality(bk, 'smolvlm2-500m-onnx-int8dec')
    rows.append(dict(technology='SmolVLM2-500M-Video-Instruct (@7b375e1; ONNX fp32 vision + int8 decoder)', task='chat VQA', parameters='507.5 M', artifact_size='ONNX 343–805 MB; LiteRT bundle 361 MB',
                     runtime='ONNX Runtime / LiteRT-LM (community) / llama.cpp', code_license='Apache-2.0', weight_license='Apache-2.0', training_data='mixed; incl. academic-only and CC-BY-NC video sets',
                     commercial_status='CONDITIONAL', pretrained_available='yes', actual_artifact_verified='yes (run in 005J)', wall_output='no', opening_output='no', room_output='no', mask_output='no', VQA='yes',
                     ONNX='yes (int8 vision needs ConvInteger: not on ORT CPU)', LiteRT='community bundle', Android='AI pack + WASM or LiteRT-LM', CPU='yes', GPU='yes', memory='≈ 1.76 GB (desktop process)',
                     latency=L('smolvlm2-500m-onnx-int8dec', 'score') + ' enum / ' + L('smolvlm2-500m-onnx-int8dec', 'gen') + ' gen (desktop CPU)', quality_on_BuildPlan=q, confident_wrong=cw,
                     integration_complexity='high (0.4–0.8 GB pack, seconds per question)', verdict='REJECT zero-shot; fine-tune base candidate (prefer SmolVLM-500M-Instruct v1) for Route A'))
    q, cw = vlm_quality(bk, 'moondream-0.5b-int8')
    rows.append(dict(technology='Moondream 0.5B int8 (moondream2@9dddae8, branch onnx)', task='query / caption / detect / point', parameters='≈ 0.5 B', artifact_size='622 MB int8 / 442 MB int4 (.mf.gz)',
                     runtime='legacy moondream==0.0.6 ONNX client only', code_license='Apache-2.0', weight_license='Apache-2.0', training_data='undocumented', commercial_status='UNKNOWN', pretrained_available='yes',
                     actual_artifact_verified='yes (run in 005J)', wall_output='no', opening_output='no', room_output='no', mask_output='no', VQA='yes', ONNX='inside .mf container', LiteRT='no', Android='unverified op coverage',
                     CPU='yes', GPU='CUDA (Python)', memory='≈ 2.34 GB (desktop process)', latency=L('moondream-0.5b-int8', 'score') + ' enum (desktop CPU)', quality_on_BuildPlan=q, confident_wrong=cw,
                     integration_complexity='high; vendor calls 0.5B a distillation target, no current local runtime', verdict='REJECT'))
    q, cw = vlm_quality(bk, 'server-oracle', 'ORACLE_JSON')
    rows.append(dict(technology='SERVER_ORACLE (this session\'s strong model via blind sub-agents)', task='closed-question VQA', parameters='undisclosed', artifact_size='hosted', runtime='API', code_license='—',
                     weight_license='proprietary', training_data='undisclosed', commercial_status='not a dependency', pretrained_available='—', actual_artifact_verified='149-question blind sample',
                     wall_output='no', opening_output='no', room_output='no', mask_output='no', VQA='yes', ONNX='no', LiteRT='no', Android='no (server)', CPU='—', GPU='—', memory='—', latency='seconds (API)',
                     quality_on_BuildPlan=q, confident_wrong=cw, integration_complexity='server + privacy + licensing of crops', verdict='RESEARCH_ORACLE_ONLY (teacher / solvability evidence)'))
    for key, label in (('unet', 'UNet-lite wall/opening proof (005J, from scratch, synthetic only)'), ('segformer', 'MiT-B0 SegFormer proof (005J, independent re-implementation, from scratch, synthetic only)')):
        w = wl.get(key)
        if not w:
            continue
        s = w['synthetic']
        real = w.get('real', [])
        rr = [r['exteriorWallRecall'] for r in real]
        ad = [r['ADDITIONAL_USEFUL_WALL_EVIDENCE_OVER_SOURCE_CV'] for r in real]
        ref = w.get('referee', {})
        rows.append(dict(technology=label, task='per-pixel BACKGROUND / WALL / OPENING', parameters=f"{w['params'] / 1e6:.2f} M", artifact_size=f"{w['fp32MB']} MB fp32 (≈ {w['int8MBEstimate']} MB int8)",
                         runtime='PyTorch (training); ONNX → onnxruntime-web WASM', code_license='BuildPlan (UNet-lite: textbook U-Net; MiT-B0: independent re-implementation whose structure follows the Apache-2.0 PVTv2 / HF code, not clean-room)', weight_license='BuildPlan-owned', training_data='BuildPlan synthetic drawings only',
                         commercial_status='COMMERCIAL_CLEAN', pretrained_available='no (trained here, from scratch)', actual_artifact_verified='yes (trained and evaluated in 005J)', wall_output='yes', opening_output='yes',
                         room_output='no', mask_output='yes', VQA='no', ONNX='yes (exported)', LiteRT='not tried', Android='ORT-web WASM (shipped runtime)', CPU='yes', GPU='—',
                         memory=w.get('wasmMemory', '—'), latency=w.get('wasmLatency', '—'),
                         quality_on_BuildPlan=f"synthetic wall IoU {s['wallIoU']}, opening IoU {s['openingIoU']}; real exterior-wall recall {min(rr):.3f}–{max(rr):.3f}; additional over source-cv {min(ad):.3f}–{max(ad):.3f}; gap referee: {ref.get('summary', '—')}",
                         confident_wrong=ref.get('confidentWrong', '—'), integration_complexity='low (observation provider like 005H OCR; one WASM session)', verdict=w.get('verdict', 'TRAIN (proof)')))
    pr = wl.get('routeCPilot')
    if pr:
        rows.append(dict(technology='Route-C micro-referee pilot (005J, from scratch, synthetic only)', task='closed questions, one head per class', parameters=f"{pr['params'] / 1e6:.2f} M",
                         artifact_size=f"≈ {pr['params'] * 4 / 2 ** 20:.1f} MB fp32", runtime='PyTorch → ONNX → ORT-web WASM', code_license='BuildPlan', weight_license='BuildPlan-owned', training_data='BuildPlan synthetic questions only',
                         commercial_status='COMMERCIAL_CLEAN', pretrained_available='no', actual_artifact_verified='yes (005J)', wall_output='no', opening_output='no', room_output='no', mask_output='no', VQA='closed classes only',
                         ONNX='yes', LiteRT='not tried', Android='ORT-web WASM', CPU='yes', GPU='—', memory=pr.get('wasmMemory', '—'), latency=pr.get('wasmLatency', '—'), quality_on_BuildPlan=pr.get('summary', '—'),
                         confident_wrong=pr.get('confidentWrong', '—'), integration_complexity='low', verdict='PILOT (feasibility only)'))
    static = [
        dict(technology='MitUNet (aliasstudio/mitunet@ade0aa6)', task='binary wall mask', parameters='64.25 M (B4)', artifact_size='257 MB fp32', runtime='PyTorch / smp', code_license='MIT notebooks; MiT encoder code NVIDIA SCL (NC)',
             weight_license='CC BY-NC 4.0', training_data='CubiCasa5K (NC) + Floor Plan CIS', commercial_status='NON_COMMERCIAL', pretrained_available='yes', actual_artifact_verified='checkpoint structure read remotely',
             wall_output='yes', opening_output='subtracted', room_output='no', mask_output='yes', VQA='no', ONNX='no', LiteRT='no', Android='B4 unsuitable', CPU='yes', GPU='yes', memory='—', latency='≈ 65 GMACs @512²',
             quality_on_BuildPlan='not run (licence)', confident_wrong='—', integration_complexity='—', verdict='ARCHITECTURE_CANDIDATE_FOR_RETRAINING (own or Apache-2.0-based implementation, from scratch)'),
        dict(technology='ResPlan (m-agour/ResPlan@e2b78fe)', task='17,000 vector plans + room graph', parameters='—', artifact_size='100 MB zip', runtime='shapely', code_license='MIT', weight_license='—',
             training_data='scraped South-Asian listings; CC BY 4.0 vs CC BY-NC-SA 4.0 conflict', commercial_status='CONDITIONAL (blocked)', pretrained_available='no checkpoints', actual_artifact_verified='dataset downloaded and parsed',
             wall_output='polygons', opening_output='rectangles', room_output='per class', mask_output='renderable', VQA='—', ONNX='—', LiteRT='—', Android='—', CPU='—', GPU='—', memory='—', latency='—',
             quality_on_BuildPlan='not used', confident_wrong='—', integration_complexity='—', verdict='DATA_CANDIDATE_WITH_COUNSEL'),
        dict(technology='fpvec-lab (Cyprinus12138/fpvec-lab@f44a475) + arXiv 2608.25608', task='vectorisation research', parameters='—', artifact_size='README only', runtime='—', code_license='none',
             weight_license='none', training_data='(paper) S3D + CubiCasa (NC)', commercial_status='UNKNOWN', pretrained_available='no', actual_artifact_verified='full history: 2 commits, 1 file', wall_output='(paper)',
             opening_output='(paper)', room_output='(paper)', mask_output='—', VQA='—', ONNX='—', LiteRT='—', Android='—', CPU='—', GPU='—', memory='—', latency='—', quality_on_BuildPlan='—',
             confident_wrong='—', integration_complexity='—', verdict='REIMPLEMENT_FROM_PAPER (metrics, readout, fusion rule)'),
        dict(technology='CubiCasa5K model + data', task='rooms / icons / walls', parameters='—', artifact_size='—', runtime='PyTorch', code_license='CC BY-NC 4.0', weight_license='CC BY-NC 4.0',
             training_data='CubiCasa5K (NC / NC-SA)', commercial_status='NON_COMMERCIAL', pretrained_available='yes', actual_artifact_verified='LICENSE read', wall_output='yes', opening_output='yes', room_output='yes',
             mask_output='yes', VQA='—', ONNX='—', LiteRT='—', Android='—', CPU='—', GPU='—', memory='—', latency='—', quality_on_BuildPlan='not run', confident_wrong='—', integration_complexity='—', verdict='RESEARCH_ORACLE_ONLY'),
        dict(technology='floorplan-to-3d (Yytsi, U-Net + ResNet-34)', task='floor / wall / door / window masks', parameters='≈ 24 M', artifact_size='—', runtime='PyTorch', code_license='MIT', weight_license='MIT tag',
             training_data='CubiCasa5K (NC)', commercial_status='NON_COMMERCIAL', pretrained_available='yes', actual_artifact_verified='header read', wall_output='yes', opening_output='yes', room_output='no', mask_output='yes',
             VQA='—', ONNX='—', LiteRT='—', Android='—', CPU='—', GPU='—', memory='—', latency='—', quality_on_BuildPlan='not run (licence)', confident_wrong='—', integration_complexity='—', verdict='RESEARCH_ORACLE_ONLY'),
        dict(technology='RF-DETR-Seg N/S/M/L (roboflow/rf-detr@9c558b4)', task='instance segmentation', parameters='≈ 30–34 M', artifact_size='—', runtime='PyTorch / ONNX', code_license='Apache-2.0', weight_license='Apache-2.0 (COCO)',
             training_data='COCO (Flickr mixed); DINOv2 LVD-142M undisclosed', commercial_status='CONDITIONAL', pretrained_available='yes (not floor-plan)', actual_artifact_verified='LICENSE read',
             wall_output='if trained', opening_output='if trained', room_output='if trained', mask_output='yes', VQA='—', ONNX='yes', LiteRT='—', Android='heavy', CPU='yes', GPU='yes', memory='—', latency='—',
             quality_on_BuildPlan='not run', confident_wrong='—', integration_complexity='high', verdict='ARCHITECTURE_CANDIDATE_FOR_RETRAINING'),
        dict(technology='Swiss Dwellings v3 (Zenodo 7788422)', task='vector plans', parameters='—', artifact_size='932 MB', runtime='—', code_license='—', weight_license='—', training_data='CC BY 4.0 (Archilyse client plans)',
             commercial_status='CONDITIONAL', pretrained_available='—', actual_artifact_verified='record licence read', wall_output='vectors', opening_output='vectors', room_output='vectors', mask_output='renderable',
             VQA='—', ONNX='—', LiteRT='—', Android='—', CPU='—', GPU='—', memory='—', latency='—', quality_on_BuildPlan='not used', confident_wrong='—', integration_complexity='—', verdict='DATA_CANDIDATE_WITH_COUNSEL'),
        dict(technology='DeepLSD / ELSED / MobileSAM (005I)', task='lines / masks', parameters='—', artifact_size='—', runtime='—', code_license='see 005I', weight_license='see 005I', training_data='see 005I',
             commercial_status='see 005I', pretrained_available='yes', actual_artifact_verified='005I', wall_output='lines', opening_output='no', room_output='no', mask_output='MobileSAM', VQA='—', ONNX='yes', LiteRT='—',
             Android='heavy', CPU='yes', GPU='—', memory='—', latency='—', quality_on_BuildPlan='005I: +0.00 m exterior wall over source-cv', confident_wrong='—', integration_complexity='—', verdict='005I: ELSED DEFER, others REJECT'),
        dict(technology='HF floor-plan models with MIT/Apache tags; YOLO/AGPL; GPL repos; HEAT/CAGE/SymPoint', task='various', parameters='—', artifact_size='—', runtime='—', code_license='various', weight_license='tags contradicted by data / AGPL / NC',
             training_data='CubiCasa / FloorPlanCAD / undisclosed', commercial_status='NON_COMMERCIAL / UNKNOWN', pretrained_available='yes', actual_artifact_verified='survey', wall_output='—', opening_output='—', room_output='—',
             mask_output='—', VQA='—', ONNX='—', LiteRT='—', Android='—', CPU='—', GPU='—', memory='—', latency='—', quality_on_BuildPlan='not run', confident_wrong='—', integration_complexity='—', verdict='REJECT / BLOCKED'),
    ]
    rows += static
    json.dump({'columns': COLS, 'rows': rows}, open(a.out_json, 'w'), indent=1, ensure_ascii=False)
    md = ['# Technology matrix (BUILDPLAN-ANALYZER-005J)', '', 'Columns as brief §50. Measured cells come from `vlm-bakeoff.json` and `wall-model-proof.json`; licence cells from the live audits '
          '(`licensing-matrix.md`). "confident_wrong" = CONFIDENT_WRONG_RATE on CANDIDATE_OVERLAY questions (all sets) unless stated.', '']
    md.append('| ' + ' | '.join(COLS) + ' |')
    md.append('| ' + ' | '.join('---' for _ in COLS) + ' |')
    for r in rows:
        md.append('| ' + ' | '.join(str(r.get(c, '—')).replace('|', '/') for c in COLS) + ' |')
    open(a.out_md, 'w').write('\n'.join(md) + '\n')
    print(len(rows), 'rows')


if __name__ == '__main__':
    main()
