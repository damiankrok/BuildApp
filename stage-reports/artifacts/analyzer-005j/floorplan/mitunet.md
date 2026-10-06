# MitUNet — live audit (BUILDPLAN-ANALYZER-005J)

Access date: **2026-10-06**.

## 1. Canonical identity

| item | value (verified) |
|---|---|
| Paper | "Enhancing Floor Plan Recognition: A Hybrid Mix-Transformer and U-Net Approach for Precise Wall Segmentation", D. Parashchuk, A. Kaspshitskiy, Y. Karyakin; **arXiv:2512.02413** v1 2025-12-02, v2 2025-12-09, **v3 2026-04-01** (11 pp., arXiv licence CC BY 4.0); journal version Machine Vision and Applications 37(3):53, 2026, DOI 10.1007/s00138-026-01815-y (Springer page metadata: `"Open Access":"N"`, `"isAccessibleForFree":false` — paywalled; the arXiv v3 is the open text used here) |
| Official code | `https://github.com/aliasstudio/mitunet` (linked from arXiv abstract, Springer "Code availability", CITATION.cff). Branch `master`, HEAD **`ade0aa6ba01c72f02a32a33a605c36b54b264a7a`** (2026-04-08). 6 commits 2025-12-10…2026-04-08 by `aliasstudio <ownerofyourcode@gmail.com>`; no tags. No other implementation or mirror found on Hugging Face (searches `mitunet`, `MitUNet`: none) |
| PDF (local) | `/home/user/work005j/papers/mitunet_2512.02413.pdf` (v3) sha256 `5f8d88a9f7cf4f9e7d54f57c403f65ad062aa8e508cbba0e5c91dfb5d5a5a997` |

Repository tree at HEAD (verified, clone `/home/user/work005j/upstream/mitunet-full`): `LICENSE` (1,111 B), `README.md`,
`CITATION.cff`, `requirements.txt` (torch≥2.8, torchvision≥0.23, **segmentation-models-pytorch==0.5.0**, albumentations,
roboflow, …), `notebooks/MitUNet.ipynb` (training/benchmark pipeline; uses Colab + Roboflow API key to download data),
`notebooks/MitUNet_biou.ipynb` (Boundary IoU), `experiments/experiments _mitunet.xlsx`, `images/*.png` (5 figures),
`datasets/regional/` (500 JPG images, Roboflow export names `*_png.rf.*.jpg`, 3 COCO JSONs; ≈35 MB), and 4 weight files as
**Git LFS** pointers (`.gitattributes`: `*.pth filter=lfs`).

## 2. Architecture (paper + code, verified against the checkpoint)

- Encoder: **SegFormer Mix-Transformer MiT-B4**, ImageNet-pretrained (`smp.Segformer(encoder_name="mit_b4", encoder_weights="imagenet")`, encoder transplanted into `smp.Unet`). Channels {64,128,320,512}, depths {3,8,27,3}.
- Decoder: smp **U-Net** with **scSE** attention (`decoder_attention_type="scse"`), decoder channels (256,128,64,32,16) — the paper lists {256,128,64,32}; the checkpoint has 5 decoder blocks (blocks.0–4). 1-class sigmoid head (3×3 conv, 16->1).
- Target: binary **wall mask**; GT built from COCO polygons with door/window masks dilated (~30 px min-area-rect widening) and **subtracted** from the wall mask, then 5×5 morphological close.
- Input 512×512, ImageNet mean/std; augmentation affine/perspective/elastic/grid + brightness/CLAHE/noise.
- Losses compared: Dice, Focal, Lovász, **Tversky (α=0.6, β=0.4, γ=1)** — chosen for precision (FP penalised). Note: the fine-tuning cell in the committed notebook has `LovaszLoss` active and Tversky commented out, while the best checkpoint name says "tversky" — notebook state ≠ reported config.
- Training: Adam, LR 1e-4 (fine-tune 1e-5), ReduceLROnPlateau(0.5, patience 3) on val IoU, 30 epochs, batch 4, RTX 4060 Ti 16 GB. Two-stage: CubiCasa5K pre-train -> Floor Plan CIS fine-tune; 80/20 random split (seed 42) of the pooled regional data.
- Metrics: pixel Recall/Precision/Accuracy/mIoU and **Boundary IoU** (B-IoU, added 2026-03-03, commit a194494). Best regional results: Tversky 0.6/0.4: mIoU 87.91, B-IoU 85.01, P 94.82, R 92.35; after CubiCasa pre-train + fine-tune: mIoU 88.53, B-IoU 85.70, P 94.99. No vector/topology metrics.

**Checkpoint verified without full download** (HTTP HEAD + range reads of the zip central directory and `data.pkl` only, ~0.28 MB per file; tensors not downloaded; pickle parsed with a restricted unpickler that never imports torch):

| file (LFS, media.githubusercontent.com) | bytes | LFS oid (sha256) | params |
|---|---|---|---|
| `mitunet_finetune_a6_mit_b4_tversky_8864_28E.pth` (README "best model"; internal archive name `mitunet_mit_b4_tversky_8864_28E`) | 257,383,307 | `9c56c86723b0b5099ea63c82b5cac2f9c98c1816536003a78e422b7fcfadfbaf` | 64,248,664 |
| `mitunet_mit_b4_tversky_a6_8784_30E.pth` (regional-only) | 257,383,307 | `60f1f4c5d7e07ce7eb409d493158919e334fb626372cff266c04177f324da068` | 64,248,664 |
| `MitUNet_cubicasa-5k_a62_mit_b4_tversky_7606_20E.pth` (CubiCasa pre-train; internal name `segunet_new_…`) | 257,391,115 | `69e8b2058977623b200a0b3315c4892e05a02b5db5b8116de2abcebdc05fe83b` | 64,248,664 |
| `MitUNet_cubicasa-5k_a62_mit_b4_tversky_7666_30E.pth` | 257,391,115 | `24afed0aeee2ab30eb25fa66e08a048a28ebbf5b17e45138844c160ef92cb3ee` | (not read) |

Breakdown (finetune ckpt): encoder 60,842,688; decoder 3,405,831; head 145; plus 1,984 BN running-stat values; all FP32 (`FloatStorage`), 954 state-dict keys; plain PyTorch zip state_dict (no ONNX/TFLite/safetensors provided).

## 3. Size / compute of smaller variants (analytic; formula validated exactly on the B4 checkpoint)

My parameter formula reproduces the checkpoint exactly (encoder 60,842,688 and decoder+head 3,405,976). MACs are analytic
estimates at 512×512 (not profiled; FLOPs ≈ 2×MACs):

| variant (smp U-Net scSE, default decoder 256…16) | encoder params | decoder+head | total | GMACs @512² (enc / dec / total) | FP32 / FP16 / INT8 size |
|---|---|---|---|---|---|
| MiT-B0 | 3.32 M | 2.28 M | **5.60 M** | 3.2 / 9.5 / **12.7** | 22 / 11 / 6 MB |
| MiT-B1 | 13.15 M | 3.41 M | **16.56 M** | 10.4 / 11.1 / **21.5** | 66 / 33 / 17 MB |
| MiT-B2 | 24.20 M | 3.41 M | 27.60 M | 20.2 / 11.1 / 31.3 | 110 / 55 / 28 MB |
| **MiT-B4 (published)** | 60.84 M | 3.41 M | **64.25 M** | 53.5 / 11.1 / **64.6** | 257 / 128 / 64 MB |
| MiT-B0 + slim decoder (128,64,32,16,8) | 3.32 M | 0.85 M | 4.17 M | 3.2 / 2.8 / 6.0 | 17 / 8 / 4 MB |
| MiT-B0 + slim decoder (64,32,16,16,8) | 3.32 M | 0.37 M | 3.69 M | 3.2 / 1.5 / 4.7 | 15 / 7 / 4 MB |

Encoder counts agree with the SegFormer paper (B0 3.4 M, B1 13.1 M, B2 24.2 M, B4 60.8 M). The U-Net decoder adds 2.3 M (B0
channels) or 3.4 M (B1–B5 channels); at 512² most decoder cost sits in the two highest-resolution blocks. At 1024² (needed for
thin walls on A4/A3 sheets) B0 ≈ 63 GMACs and B1 ≈ 111 GMACs.

**B4 is unsuitable for Android** as an interactive on-device model: 257 MB FP32 (64 MB even at INT8), ~65 GMACs per 512² tile,
global attention at 1/32 plus spatial-reduction attention at 1/4–1/16, 33 transformer blocks. MiT-B0/B1-class (or a CNN
encoder) with a trimmed decoder is the only plausible size class; Android export (LiteRT/ONNX/ExecuTorch) was **not tested** here.

## 4. Licences — separated

| layer | finding (verbatim where quoted) | status |
|---|---|---|
| **MitUNet code** | `LICENSE` = MIT, "Copyright (c) 2025 Dmitriy Parashchuk, Alexey Kaspshitskiy, Yuriy Karyakin", sha256 `eb22219cfe63fc15e044bfd58884cd3e76ca5f1295c1a52bd70b518771fcaa16` | permissive — but the repo is only notebooks; the model is built by smp |
| **smp MiT encoder code** (runtime dependency, smp 0.5.0 wheel sha256 `c34e09047771aa4dd8878b4f899e8125700cd1f8f7db16e58c37204154151a05`) | smp is MIT, but `segmentation_models_pytorch/encoders/mix_transformer.py` begins: "Copyright (c) 2021, NVIDIA Corporation. All rights reserved. Licensed under the NVIDIA Source Code License … This code has been modified." (block ends "End of NVIDIA code") | **NON-COMMERCIAL code** inside an MIT package |
| **Pretrained MitUNet weights** | README: "The pre-trained models provided in this repository were trained on the CubiCasa5k dataset. Therefore, the model weights are subject to the Creative Commons Attribution-NonCommercial 4.0 International License (CC-BY-NC 4.0). Commercial use of the pre-trained weights is restricted." Hosted only as Git LFS in the GitHub repo (verified reachable: HTTP 200, ETag = LFS oid). The regional-only checkpoint was not trained on CubiCasa but is initialised from NVIDIA MiT-B4 ImageNet weights | **NON_COMMERCIAL** (all four) |
| **Training data 1: CubiCasa5K** | GitHub `CubiCasa/CubiCasa5k` LICENSE (HEAD c34440266665a11f4484eb06cd2e4b7d72ad76c1, sha256 `abb20326fa72589cde781457dbe51f7d69f376d167254e95c36f338923669303`): "CubiCasa5K is licensed under a Creative Commons Attribution-NonCommercial 4.0 International License." **Zenodo record 2613548 (the actual data download, 5,469,495,706 B): licence `cc-by-nc-sa-4.0`.** Expected "CC BY-NC-SA 4.0" is confirmed for the Zenodo dataset; the GitHub repo says CC BY-NC 4.0 — both non-commercial | NON_COMMERCIAL |
| **Training data 2: Floor Plan CIS ("regional")** | Zenodo concept DOI 10.5281/zenodo.17871079 (record 10.5281/zenodo.17871080, 2025-12-09): licence **`cc-by-4.0`**, file `fpc.zip` 23,207,099 B; also committed in the repo (500 JPG + COCO). Description: "500 original, high-resolution floor plan images collected from real estate listings within the Russian Federation and CIS region." The CC BY grant can only cover the authors' annotations; the images are third-party listing drawings with no stated permission | CONDITIONAL / unclear upstream rights |
| **ImageNet MiT backbone weights** | `nvidia/mit-b0`, `nvidia/mit-b1`, `nvidia/mit-b2`, `nvidia/mit-b4`, `nvidia/segformer-b0-finetuned-ade-512-512`, `nvidia/segformer-b4-finetuned-ade-512-512` on HF: `license: other`; card: "The license for this model can be found [here](https://github.com/NVlabs/SegFormer/blob/master/LICENSE)." NVlabs/SegFormer LICENSE (HEAD 65fa8cfa9b52b6ee7e8897a98705abf8570f9e32, sha256 `f549820c06519e3105e5174a2fd7285224ffd2268a7f879a843b1a255fd04a61`) §3.3: "The Work and any derivative works thereof only may be used or intended for use non-commercially. Notwithstanding the foregoing, NVIDIA and its affiliates may use the Work and any derivative works commercially. As used herein, “non-commercially” means for research or evaluation purposes only." smp actually loads `smp-hub/mit_b4.imagenet` (revision pinned in smp 0.5.0): HF `license: other`, card says "Original weights URL: https://github.com/qubvel/segmentation_models.pytorch/releases/download/v0.0.2/mit_b4.pth" — a repackaging of the NVIDIA ImageNet MiT weights, no new licence | **NON_COMMERCIAL** |
| ImageNet itself | image-net.org terms of access: "Researcher shall use the Database only for non-commercial research and educational purposes." … "If Researcher is employed by a for-profit, commercial entity, Researcher's employer shall also be bound by these terms and conditions" | residual legal question for **any** ImageNet-pretrained weights |
| Runtime | PyTorch / torchvision BSD-3-Clause (torchvision LICENSE sha256 `6502f676…e71d`); smp MIT except the NVIDIA-licensed MiT file; timm Apache-2.0; albumentations MIT; roboflow SDK only for data download | OK except smp MiT file |

## 5. Commercially cleaner routes (recorded, not decided)

1. **Same architecture, own implementation, from scratch:** re-implement MiT from the SegFormer paper through a documented clean-room, or build on the Apache-2.0 PVTv2 / HF transformers code with its notice (do not copy NVIDIA/smp `mix_transformer.py`). Note the HF `transformers` SegFormer modelling file carries an Apache-2.0 header ("Copyright 2025 The HuggingFace Inc. team … Apache License, Version 2.0") and mmsegmentation's `mit.py` carries "Copyright (c) OpenMMLab" in an Apache-2.0 repo — whether those re-implementations are free of NVIDIA SCL obligations is a **question for counsel**; NVIDIA weights stay non-commercial regardless. Train from random init (or self-supervised pre-train on BuildPlan-owned/synthetic plans) on clean data.
2. **Different encoder with permissively declared weights:** e.g. timm `mobilenetv3_large_100.ra_in1k`, `mobilenetv3_small_100.lamb_in1k`, `mobilenetv4_conv_small.e2400_r224_in1k`, `efficientnet_b0.ra_in1k`, `resnet18.a1_in1k`, `resnet50.a1_in1k`, `efficientvit_b0.r224_in1k`, `convnext_atto.d2_in1k` — all HF `license: apache-2.0`; `regnety_008.pycls_in1k` — `mit`. All are trained on ImageNet-1k, so the ImageNet terms remain a residual question (status CONDITIONAL, not clean). torchvision docs: "The pre-trained models provided in this library may have their own licenses or terms and conditions derived from the dataset used for training. It is your responsibility to determine whether you have permission to use the models for your use case." smp-hub repackaged CNN weights (`smp-hub/resnet50.imagenet`, `efficientnet-b0.imagenet`, `mobilenet_v2.imagenet`) are `license: other`.
3. **No ImageNet at all:** U-Net (+scSE) with a small CNN encoder trained from scratch on BuildPlan-owned synthetic renders (e.g. a ResPlan-derived or procedurally generated corpus — see resplan.md / fpvec-lab.md) — the only route without any third-party weight lineage.

The transferable, licence-free ideas from the paper: opening-subtracted wall GT, asymmetric Tversky loss (α>β) to suppress
false-positive wall pixels, Boundary-IoU reporting, U-Net high-resolution decoder instead of SegFormer's 1/4 MLP head.

## 6. Verdict

**ARCHITECTURE_CANDIDATE_FOR_RETRAINING.** The published weights are non-commercial on three independent grounds
(CubiCasa5K NC/NC-SA, NVIDIA SCL ImageNet init, the authors' own CC-BY-NC statement), and the MiT encoder code in smp is
itself NVIDIA SCL. The B4 configuration (64.25 M params, 257 MB, ~65 GMACs @512²) is not an Android candidate; the idea
(hierarchical encoder + U-Net scSE decoder + Tversky) is worth retraining at B0/B1 or CNN scale on clean data.

## 7. Evidence

- https://github.com/aliasstudio/mitunet @ `ade0aa6ba01c72f02a32a33a605c36b54b264a7a` (git clone, full history); LICENSE sha256 `eb22219c…aa16`; README sha256 `bef3af5e59d8ab8e77fe03e0cafabd18a153b7d88a5739c6c91a1abafc3c00a1`
- https://media.githubusercontent.com/media/aliasstudio/mitunet/master/experiments/models/*.pth (HEAD + range reads; LFS oids above). The LFS batch API (`/info/lfs/objects/batch`) was refused by the session git proxy (403)
- https://arxiv.org/abs/2512.02413 (v3 2026-04-01), https://doi.org/10.1007/s00138-026-01815-y
- https://zenodo.org/api/records/17871079 (cc-by-4.0), https://zenodo.org/api/records/2613548 (cc-by-nc-sa-4.0)
- https://raw.githubusercontent.com/CubiCasa/CubiCasa5k/master/LICENSE (CC BY-NC 4.0)
- https://raw.githubusercontent.com/NVlabs/SegFormer/master/LICENSE (NVIDIA Source Code License, non-commercial)
- https://huggingface.co/api/models/nvidia/mit-b0 (sha 80983a41…), nvidia/mit-b1 (13ddceec…), nvidia/mit-b4 (3844ddaa…), nvidia/segformer-b0-finetuned-ade-512-512 (489d5cd8…), smp-hub/mit_b4.imagenet (007839fb…): all `license: other`
- https://pypi.org/project/segmentation-models-pytorch/0.5.0/ wheel `mix_transformer.py` header
- https://image-net.org/download.php (terms of access)
- https://huggingface.co/api/models/timm/… (licences as listed above)
- Local copies of licence texts: `/home/user/work005j/data/licenses/`
