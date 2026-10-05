# 005G — floor-plan ML / segmentation audit

Scope (brief §9): candidate observation providers only. **Nothing was integrated, downloaded into the repository or
run on publisher pixels.** Licensing was researched on 2026-10-05 from the primary pages listed in `sources.md`
(§ Floor-plan ML). github.com HTML was blocked by this session's proxy, so licences and READMEs were read from
`raw.githubusercontent.com` and blobless clones.

## Verdict

**No pretrained floor-plan wall or room model is commercially usable today.** Every model with released weights
fails on at least one of code, weights or training data, and almost always on the training data. Several Hugging Face
"MIT" tags sit on weights trained on non-commercial or research-only datasets. A model-card licence cannot loosen
the terms the trainer accepted for the data, so those weights are treated as non-commercial unless counsel clears
them.

**Every candidate: `RESEARCH_ONLY` or `REJECT`. Floor-plan ML does not enter production in 005G or the next stage.**

## Matrix (code / weights / training data are three separate questions)

| model | code licence | weights licence | training data (licence) | commercial | last activity | input → output | framework, ONNX | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RoomFormer (CVPR'23) | MIT | unstated (ETH polybox) | Structured3D (non-commercial, no redistribution); SceneCAD on ScanNet (non-commercial ToS) | **No** | code 2023-08 | **density map from a 3D point cloud** → room polygons (+doors/windows variant) | PyTorch + custom CUDA deformable attention; ONNX hard | **REJECT** (wrong input modality, non-commercial data) |
| PolyRoom (ECCV'24) | **no LICENSE** (all rights reserved) | unstated | Structured3D, SceneCAD | **No** | 2025-05 | point-cloud density → rooms | PyTorch + detectron2 | **REJECT** |
| FRI-Net / SLIBO-Net | unverified (no code located) | unverified | Structured3D (+SceneCAD) | **No** (data) | — | point cloud → rooms | — | **REJECT** |
| DeepFloorplan (ICCV'19) | GPL-3.0 | unstated (SharePoint) | R2V = LIFULL HOME'S (universities / public research only, not-for-profit); R3D/Rent3D (no licence stated) | **No** | 2021-07 | raster → walls, openings, room-type masks | TF 1.10 / Python 2.7 | **REJECT** |
| TF2DeepFloorplan | GPL-3.0 | unstated (Google Drive links reported dead) | R3D (no licence stated) | **No** (GPL code + no weight grant) | 2023-06 | as above | TF2, TFLite converter (37–107 MB) | **REJECT** |
| CubiCasa5K | CC BY-NC 4.0 (repo) | unstated → repo licence | CubiCasa5K: CC BY-NC 4.0 (repo) vs **CC BY-NC-SA 4.0** (Zenodo) — inconsistent, non-commercial either way | **No** | 2019-05 | raster → walls, rooms, doors/windows, icons | PyTorch hourglass; CNN exportable, post-processing Python | **RESEARCH_ONLY** |
| Raster-to-Vector (ICCV'17) | MIT | unstated (Google Drive) | LIFULL (permission required, research only) | **No** | 2019-06 | raster → junctions + IP → walls/openings/rooms | Torch7/Lua | **REJECT** |
| Raster-to-Graph (EG'24) | GPL-3.0 | unstated | LIFULL high-res + own annotations behind terms of use | **No** | 2026-05 | raster → wall graph with room semantics | PyTorch Deformable-DETR, autoregressive | **REJECT** |
| Raster2Seq (SIGGRAPH'26) | MIT | MIT tag on HF | Structured3D, CubiCasa5K, Raster2Graph/LIFULL | **No** (data) | 2026-06 | raster → room polygons + doors/windows | PyTorch 2.3; 0.98–1.45 GB checkpoints; ONNX hard | **RESEARCH_ONLY** (strongest current raster→polygon model; useful as a research oracle only) |
| MuraNet (2023) | no code / weights found | — | CubiCasa5K | **No** | — | walls/doors/windows | — | **REJECT** |
| HF `hallelu/floorplan-segmentation` | MIT tag | **no weights in repo** | CubiCasa5K re-hosted under "MIT" (does not hold) | **No** | 2025-08 | 5-class mask | tiny U-Net | **REJECT** |
| HF `phungpx/RMBG-1.4-wall-segmentation-cubicassa` | "other" | base model BRIA RMBG-1.4: non-commercial without an agreement | CubiCasa5K | **No** | 2026-06 | binary wall mask | 44.1 M params, 176 MB | **REJECT** |
| HF `OsamaMo/2dplan2strct` | RF-DETR framework Apache-2.0 | **"non-commercial research and evaluation only"** | not stated | **No** | 2026-09 | boxes: wall/room/door/window | RF-DETR-M 134 MB | **REJECT** |
| Ultralytics YOLOv8/11 floor-plan models (Roboflow Universe) | AGPL-3.0 | AGPL-3.0 ("all trained models"); closed source needs an Enterprise Licence | uploader-declared CC BY 4.0, image origin unknown (unverified, pages returned 403) | **No** without Enterprise Licence | — | boxes / masks | ONNX/TFLite export standard | **REJECT** |
| fpvec-lab (arXiv 2608.25608) | announced MIT | **nothing released** (README only) | ResPlan-FP (CC BY 4.0) / corrected CubiCasa (NC-SA) | not usable yet | 2026-08 | walls, openings, rooms | — | **DEFER** (watch) |
| MLStructFP + benchmarks | MIT | unstated (Google Drive) | 954 plans behind a Google Form, licence unverified | unclear | 2026-04 | wall segmentation → vectors | TF/Keras U-Net | **RESEARCH_ONLY** |

## What would make floor-plan ML legally possible later

Training our own model. Two ingredients qualify on their licences:
- **an Apache-2.0 architecture**, e.g. RF-DETR-N/S/M/L and the -Seg variants (XL/2XL are PML 1.0, not Apache);
- **training renders of CC BY 4.0 vector data**: ResPlan (data CC BY 4.0, code MIT; plans recovered from public
  listing renderings, takedown process) and Swiss Dwellings v1.0.0 (CC BY 4.0, Archilyse clients' data).

MSD's licence could not be verified (its repository was offline). Before any of this ships, counsel must review two
things: listing-derived facts, and the backbone's pretraining data (COCO / DINOv2).

## Would it add useful observations? (no product run)

No model could legally be run on the sealed publisher evidence for a product decision. Running non-commercial
weights on publisher drawings would also mix two licences into one record. From the papers and model cards alone, the
outputs map onto BuildPlan observations as follows:

| output | BuildPlan today | value of an ML observation |
| --- | --- | --- |
| walls (mask/vectors) | wall bands from `source-cv` `runLengthBands` + reconstruction | would be a second, independent witness for weak gaps — the envelope failures (005B–005F) |
| room polygons | room flood / `tracePolygon` | a witness for room count and topology |
| doors / windows | gap classification (`boundary-evidence.ts`) | a witness for GLAZING vs LEAF vs DASHED |
| exterior outline | envelope solver | a second envelope hypothesis — **as an observation only**, never chosen by the model |

If such a provider is ever allowed, it plugs into the **`source-vision` seam** (`VisionReasoner`, per-asset PLAN task,
geometry observations with confidence and uncertainty). It never plugs into reconstruction, and it never decides
which polygon is the house. Through that seam it inherits the existing rule that a vision observation is evidence for
the resolver, not a fact.

**Answer to decision question 8:** no floor-plan ML enters production now.
**Answer to decision question 9:** see `licensing-matrix.md`. Every pretrained floor-plan model above is legally
unsuitable on its weights or its data: CubiCasa5K, LIFULL/R2V, Structured3D, SceneCAD/ScanNet, RMBG-1.4, AGPL YOLO
and the non-commercial RF-DETR checkpoint.
