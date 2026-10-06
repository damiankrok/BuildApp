# Licensing matrix (BUILDPLAN-ANALYZER-005J)

Read live on **2026-10-06**. Five separate questions for every candidate (brief §14): **CODE**, **WEIGHTS**, **TRAINING
DATA**, **PRETRAINED BACKBONE**, **RUNTIME**. A permissive answer to one never carries over to another. This is technical
and licence evidence, **not legal advice**; every "residual question" is for counsel.

Status vocabulary: COMMERCIAL_CLEAN · CONDITIONAL (usable only after a named residual question is settled) ·
NON_COMMERCIAL · UNKNOWN. Verdicts as in `technology-matrix.md`. Full evidence (URLs, commit SHAs, LICENSE SHA-256):
`floorplan/*.md`, `floorplan/*.json`, `vlm/vlm-audit.{md,json}`.

## 1. Floor-plan models, datasets and architectures

| candidate | CODE | WEIGHTS | TRAINING DATA | PRETRAINED BACKBONE | RUNTIME | status | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **ResPlan** (`m-agour/ResPlan@e2b78fe`, 17,000 vector plans) | MIT (LICENSE "CODE" section, sha256 `8193a93c…bf499`) | none published (paper v2 promises baselines; absent) | **CONFLICT**: LICENSE/README/paper v2 = CC BY 4.0 *limited to the authors' contributions* (no grant over the layouts, which they call facts); Kaggle `licenseName` (v12) and the repo's `croissant.json` = **CC BY-NC-SA 4.0**; until 2026-07-28 a plain MIT file covered everything. Provenance: scraped South-Asian real-estate listings, platforms withheld; two different extraction stories (v1 CAD/PDF parser, v2 CV+OCR on renders) | n/a | shapely/numpy/networkx (BSD) | CONDITIONAL | DATA_CANDIDATE_WITH_COUNSEL — **not used in 005J training** |
| **fpvec-lab** (`Cyprinus12138/fpvec-lab@f44a475`) | **none**: no LICENSE file; the repo is one README (3,864 B), 2 commits, no code | none | (paper) Structured3D + CubiCasa5K (both non-commercial) + synthetic | (paper) Raster2Seq lineage | n/a | UNKNOWN (nothing to license) | REIMPLEMENT_FROM_PAPER (metrics, readout, fusion rule) |
| **MitUNet** (`aliasstudio/mitunet@ade0aa6`, arXiv 2512.02413) | MIT notebooks — **but the MiT encoder it builds through smp 0.5.0 (`mix_transformer.py`) carries the NVIDIA Source Code License (non-commercial)** | **CC BY-NC 4.0** (its README), 4 × 257 MB LFS | CubiCasa5K (CC BY-NC 4.0 repo / CC BY-NC-SA 4.0 Zenodo) + Floor Plan CIS (CC BY 4.0 declared over RU/CIS listing images) | MiT-B4 ImageNet (NVIDIA SCL, non-commercial) | PyTorch BSD-3 | NON_COMMERCIAL on three independent grounds | ARCHITECTURE_CANDIDATE_FOR_RETRAINING (clean-room, from scratch) |
| NVIDIA MiT / SegFormer weights (`nvidia/mit-b0…b5`, `smp-hub/mit_*.imagenet`) | NVIDIA SCL | NVIDIA SCL ("research or evaluation purposes only") | ImageNet (terms: non-commercial research) | — | — | NON_COMMERCIAL | REJECT |
| timm ImageNet CNN encoders (MobileNetV3/V4, EfficientNet-B0, ResNet-18/34, RegNetY-008) | Apache-2.0 | declared Apache-2.0 / MIT on HF | ImageNet-1k (terms: non-commercial research) | — | PyTorch / ORT | CONDITIONAL (ImageNet residual question) | usable only after counsel; 005J trained **from scratch** instead |
| CubiCasa5K model + data | CC BY-NC 4.0 | CC BY-NC 4.0 | CC BY-NC(-SA) 4.0 | — | — | NON_COMMERCIAL | RESEARCH_ORACLE_ONLY |
| floorplan-to-3d (`Yytsi`, U-Net+ResNet-34) | MIT | "MIT" tag | CubiCasa5K (NC) | ResNet-34 ImageNet | — | NON_COMMERCIAL | RESEARCH_ORACLE_ONLY |
| RF-DETR-Seg N/S/M/L (`roboflow/rf-detr@9c558b4`) | Apache-2.0 (A/F/P/XL/2XL variants are PML 1.0) | Apache-2.0 (COCO) | COCO (annotations CC BY 4.0; Flickr images mixed) — nothing floor-plan | DINOv2 Apache-2.0 (LVD-142M undisclosed) | PyTorch / ONNX | CONDITIONAL | ARCHITECTURE_CANDIDATE_FOR_RETRAINING |
| Swiss Dwellings v3 (Zenodo 7788422) | — | — | **CC BY 4.0** on every version; Archilyse client plans; vectors only | — | — | CONDITIONAL (attribution, upstream client rights, EU database right) | DATA_CANDIDATE_WITH_COUNSEL (cleaner than ResPlan) |
| Floor Plan CIS (Zenodo 17871080) | — | — | CC BY 4.0 declared over third-party listing images | — | — | CONDITIONAL | DATA_CANDIDATE_WITH_COUNSEL |
| DeepFloorplan / Raster-to-Graph | GPL-3.0 | unstated | research-only | — | — | NON_COMMERCIAL for a closed app | REJECT |
| HEAT, CAGE (Commons Clause), SymPoint, ArchCAD, FloorPlanCAD | non-commercial or source-available | NC | NC | — | — | NON_COMMERCIAL | REJECT |
| Ultralytics YOLO floor-plan models | AGPL-3.0 | AGPL-3.0 (a model-card "Apache" tag does not override it) | mostly NC / undisclosed | AGPL | — | NON_COMMERCIAL for a closed app | REJECT |
| HF floor-plan models with MIT/Apache *tags* (Voix7, joshlyman, GreenMap, avito, sankhya007, …) | tags only | tags only | contradicted by their own data (CubiCasa, FloorPlanCAD) or undisclosed | mixed | — | NON_COMMERCIAL / UNKNOWN | REJECT / BLOCKED |
| **BuildPlan synthetic corpora** (`research/analyzer-005j/synthetic/vrgen.py`, `wallproof/trainset.py`) | BuildPlan-owned | BuildPlan-owned (the 005J proof checkpoints were trained here, from scratch) | generated from BuildPlan's own semantic scenes; text rendered with DejaVu Sans and DejaVu Sans Bold (Debian fonts-dejavu-core 2.37-8; sha256 `ae7b7855…7280` / `5c1247ac…e895`; **Bitstream Vera Fonts licence** for the base glyphs, DejaVu changes public domain; rendered glyphs carry no obligation, a vendored `.ttf` keeps the Vera notice) through Pillow 12.3.0 | **none** (random init) | PyTorch BSD-3 (training only) | **COMMERCIAL_CLEAN** (the only one) | the training data route for 005K |

## 2. Small vision-language models

| candidate | CODE | WEIGHTS | TRAINING DATA | PRETRAINED BACKBONE | RUNTIME | status |
| --- | --- | --- | --- | --- | --- | --- |
| **Florence-2-base** (`microsoft/Florence-2-base@5ca5edf`; native-format port `florence-community/Florence-2-base@00921df` used in 005J — a post-review sample (37 of 666 tensors, 89 MB range-read) found them byte-identical to `microsoft@5ca5edf` apart from the all-zero `final_logits_bias`, a transposed `image_projection` and 39 padding rows in the shared embedding; full identity not verified) | MIT (Microsoft remote code); transformers ≥ 4.56 native port Apache-2.0 | **MIT** (card + LICENSE) | **FLD-5B: never released, no stated licence**; images from ImageNet-22k, Objects365, Open Images, CC, LAION; labels generated by other models | UniCL (MIT) + BART/fairseq (MIT) | ONNX Runtime MIT; Transformers.js Apache-2.0 | CONDITIONAL (training-data residual question) |
| **SmolVLM2-500M-Video-Instruct** (`@7b375e1`) | Apache-2.0 (transformers) | **Apache-2.0** | **mixed**: includes academic-only (Vript, LLaVA-Video-178K) and CC BY-NC (ShareGPT4Video) video sets | SigLIP-base-p16-512 (Apache-2.0) + SmolLM2-360M (Apache-2.0) | ONNX Runtime MIT; LiteRT-LM Apache-2.0; llama.cpp MIT | CONDITIONAL (training-data residual question) |
| SmolVLM-500M-Instruct (v1, image-only, `@a7da5b9`) | Apache-2.0 | Apache-2.0 | The Cauldron (per-subset licences) + Docmatix (MIT) only | same as above | same | CONDITIONAL — **the cleaner fine-tuning base** of the family |
| **Moondream 0.5B** (`vikhyatk/moondream2` branch `onnx` @ `9dddae8`, `moondream-0_5b-int8.mf.gz`) | Apache-2.0 client (`moondream==0.0.6`, the last that runs it locally) | Apache-2.0 | undocumented | undocumented | ONNX Runtime MIT | UNKNOWN (data); vendor calls 0.5B a "distillation target … not generally recommended" |
| Moondream 3 preview / 3.1 | — | BSL 1.1 / custom | — | — | — | NON_COMMERCIAL-like until relicensed — not considered |
| Optional small VLMs (Qwen3-VL-2B, InternVL3.5-1B, Gemma 4 E2B: Apache-2.0; Qwen2.5-VL-3B: Qwen research licence; FastVLM: Apple research-only; LFM2-VL: revenue-capped; Gemma 3n / PaliGemma 2: Gemma terms) | — | as listed | mostly undisclosed | — | — | see `vlm/vlm-audit.md` §7 |
| In-session strong oracle (`SERVER_ORACLE`, the Claude model serving this session through blind sub-agents) | — | proprietary, API terms | — | — | Anthropic API | **never a production dependency**; measurement only |

## 3. Runtimes (for any future on-device model)

| runtime | licence | network / telemetry | note |
| --- | --- | --- | --- |
| onnxruntime-web 1.30.0 (already shipped, WASM) | MIT | none (005G) | the only measured phone path today |
| LiteRT-LM 0.17.1 AAR | Apache-2.0 | no permissions in the AAR manifest | minSdk 24; arm64 `.so` 21.8 MB, 16 KB-aligned |
| llama.cpp (libmtmd) | MIT | none | image encode cannot be aborted |
| ExecuTorch 1.5.1 | BSD | none known | `LlmModule.stop()` |
| onnxruntime-android 1.30.0 | MIT | **adds INTERNET, ACCESS_NETWORK_STATE and a telemetry provider** (005G) | REJECT |
| Transformers.js 4.3.0 | Apache-2.0 | default WASM path on jsdelivr | not drop-in on Node 18 / nodejs-mobile (`sharp`, `onnxruntime-node`) |

## 4. What this means for 005K

1. **No pretrained floor-plan model is commercially clean** — the 2025–2026 survey changes nothing from 005G.
2. **The "SegFormer" route is non-commercial below the weights**: smp's MiT encoder file is NVIDIA SCL. A MiT/SegFormer
   network must be built either on the Apache-2.0 PVTv2 / HF transformers code (keeping their notices) or through a
   documented clean-room, and trained from random init. 005J's `wallproof/wallnet.py` MiT-B0 is an independent
   re-implementation, **not** clean-room: it reproduces four details found in those implementations and not in the paper
   (post-review D2); it is DEFERRED, and 005K uses the textbook UNet-lite.
3. **ResPlan cannot enter a BuildPlan-owned corpus** until its publisher resolves CC BY 4.0 vs CC BY-NC-SA 4.0 in writing
   and counsel accepts the scraped-listing provenance. Swiss Dwellings (CC BY 4.0) is the cleaner external vector set, still
   with counsel.
4. **Small VLM weights are permissive (MIT / Apache-2.0) but their training data is not documented as clean** (Florence's
   FLD-5B unreleased; SmolVLM2's video mixture includes academic-only and NC sets). Fine-tuning one inherits that residual
   question; SmolVLM-500M-Instruct (v1, image-only, Cauldron + Docmatix) has the most documented mixture in the family —
   cleaner only relatively: the Cauldron's ~50 sub-dataset licences were not audited (post-review D11).
5. **The only COMMERCIAL_CLEAN training route measured is BuildPlan's own synthetic drawings**, which is what 005J trained
   on (wall proof and Route-C pilot), from scratch. Generator v2 pins its font files and environment in the corpus
   manifest, uses only OFL / Bitstream Vera / Apache-licensed fonts, and never a publisher's typeface, logo or watermark.
6. **Development-time teacher (any route).** A strong hosted model may work on **synthetic** images (mining, new families).
   Sending **real publisher crops** to it — to pre-label them or otherwise — is **CONDITIONAL on counsel**: drawing
   copyright, the EU text-and-data-mining exception and opt-outs, publisher terms, the provider's terms. 005J's in-session
   oracle read 47 composed publisher crops (of 149) as development material through this session's own model, the same
   channel the whole development session uses; no BuildPlan component sends anything.
7. **Evaluation and calibration on publisher crops** (the 005J real question set; 005K's balanced real gap set) is
   long-standing project practice — sheets read locally, never committed, never redistributed — and stays the only use of
   real drawings in every route. It is recorded here as a residual beside COMMERCIAL_CLEAN, not as training data.
