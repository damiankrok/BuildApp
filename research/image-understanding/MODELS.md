# IU-01 — open models considered for offline image-role classification

Licence = the licence field on the model card at the time of reading (Hugging Face API, 2026-10-23).
"Measured" means measured in this stage on the x86-64 container CPU (`bench.py`); everything about phones is a
**prognosis**, not a measurement — no phone was used in IU-01.

| model | role | licence (card) | image params | fp32 size | run here | Android path | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MobileNetV3-Large-100 (`timm/mobilenetv3_large_100.ra_in1k`) | frozen trunk + linear head (B) | Apache-2.0 | 5.5 M | 22 MB | yes (measured) | ONNX export **measured** here and run in onnxruntime (the runtime the repo already ships for OCR); LiteRT via `ai-edge-torch` or `onnx2tf`, ncnn via `pnnx` — not tried | smallest serious candidate; see report for accuracy |
| DINOv2 ViT-S/14 (`timm/vit_small_patch14_dinov2.lvd142m`) | frozen trunk + linear head (B) | Apache-2.0 | 22 M | 88 MB | yes (measured, 518 px) | ONNX/LiteRT possible; at 518 px ~0.5 s/img on 4 x86 threads — too slow for a phone at that size, 224 px not evaluated | strong features, expensive at native size |
| OpenCLIP ViT-B/32 LAION-2B (`laion/CLIP-ViT-B-32-laion2B-s34B-b79K`) | zero-shot (B0) and frozen trunk + head (B) | MIT (weights; LAION-2B data provenance is a separate question) | 88 M image tower | ~350 MB image tower (download 605 MB incl. text tower) | yes (measured) | ONNX export of the image tower is routine; size is the issue | reference for "what a pretrained model knows unaided" |
| MobileCLIP-S0 (`apple/MobileCLIP-S0`) | would be the phone-sized zero-shot model | `apple-amlr` (Apple ML Research licence, research use) | ~11 M | ~45 MB | **not used** | — | licence not suitable for a product without OWNER/legal decision |
| SigLIP base/16-224 (`google/siglip-base-patch16-224`) | zero-shot alternative to CLIP | Apache-2.0 | 93 M | ~370 MB | not run | as CLIP | same size class as CLIP B/32; not needed to answer IU-01 |
| EfficientNetV2-B0 / MobileNetV4-conv-small (timm) | alternative small trunks | Apache-2.0 | 7 M / 3.8 M | 28 / 15 MB | not run | LiteRT-friendly | candidates for IU-02 fine-tuning if data grows |
| MobileSAM | **segmentation**, not a classifier | Apache-2.0 | ~10 M | ~40 MB | not run | ONNX exists | belongs to IU-02 (building mask, sky/tree removal). It produces masks for prompts; it does not say "this is an elevation" |
| Ultralytics YOLO family | detection | AGPL-3.0 | — | — | not used | — | licence incompatible with a closed app |

Weights used in IU-01 are fetched once by `prepare_models.py` into `$IU_WEIGHTS` (outside Git) with their SHA-256
recorded; every later step runs with `offline_guard()` (socket connect and DNS raise), so a hidden download fails
loudly. ImageNet-pretrained weights carry the usual caveat that ImageNet's own terms are research-oriented even when
the weight file is Apache-2.0; that question is for OWNER before any product use.
