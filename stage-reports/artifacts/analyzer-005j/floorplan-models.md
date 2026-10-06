# Floor-plan-specific open-source audit (BUILDPLAN-ANALYZER-005J, brief Part B)

Read live on **2026-10-06** against the actual repositories, model files, dataset files and papers — not README claims.
Detailed audits (with commit SHAs, LICENSE SHA-256, file lists, verbatim licence text):

| file | content |
| --- | --- |
| `floorplan/resplan.md` | ResPlan: repository, the dataset itself (downloaded and parsed), split, fields, graph, licences, provenance, rendering test |
| `floorplan/fpvec-lab.md` | fpvec-lab: full-history clone, what is actually published, the paper's methods and what BuildPlan can reimplement |
| `floorplan/mitunet.md` | MitUNet: architecture verified against its checkpoint structure, smaller-variant estimates, five-way licence split |
| `floorplan/survey-2025-2026.{md,json}` | 40 records (23 new in 2025–2026): wall/opening/room models, raster-to-vector, CAD, VLM fine-tunes, datasets |
| `floorplan/oss-core.json` | machine-readable records for the three named candidates, the NVIDIA MiT backbone and permissive CNN encoders |

## 1. ResPlan (§10)

- **What it is (verified in the data):** `m-agour/ResPlan@e2b78fe` ships `ResPlan.zip` (100,106,537 B, sha256 `f718de88…aeb46`)
  with a 258 MB pickle of **17,000 plans**; split **train 13,053 / val 1,632 / test 1,632 / augmented 683**. Walls are
  filled polygon unions with real gaps at doors and windows; doors and windows are rectangles filling those gaps (no hinge
  side or swing); rooms are polygons grouped by class (no per-room id); one wall thickness per plan; 17 geometry keys; the
  room graph is built in code (`plan_to_graph`), not stored. **Coordinates are canvas units (~256), not metres** — the
  README/paper v2 claim of metric coordinates and a per-record scale is contradicted for the GitHub pickle.
- **Licences:** code MIT. Data: **conflicting** — LICENSE / README / paper v2 say CC BY 4.0 *limited to the authors'
  contributions* (no grant over the layouts, which they call facts); the live Kaggle licence field (v12) and the repo's own
  `croissant.json` say **CC BY-NC-SA 4.0**; before 2026-07-28 a plain MIT file covered everything.
- **Provenance:** scraped South-Asian real-estate listings; platform identities withheld; two different extraction stories
  (v1: CAD/PDF parser; v2: computer vision + OCR on rendered images). A takedown process exists.
- **Rendering:** technically fine (two plans rendered to black-on-white sheets in the audit), but door arcs are assumptions,
  there are no dimension chains, text, hatching or storeys, and the style is South-Asian single-floor units.
- **Answer to "can ResPlan become part of a BuildPlan-owned training corpus?":** *technically yes; legally not today*.
  Blocked until the publisher resolves CC BY 4.0 vs CC BY-NC-SA 4.0 in writing **and** counsel accepts the scraped-listing
  provenance (upstream rights holders are not bound by the authors' "facts" position; EU database right is a further
  question). **Not used in any 005J training.** Verdict **DATA_CANDIDATE_WITH_COUNSEL**.

## 2. fpvec-lab / ResPlan-FP (§11)

- **What is actually published:** full history = **2 commits, no tags, one file (`README.md`, 3,864 B)**. No LICENSE, no
  code (`fpeval`, `resplan-fp`, `skv4`, `fpgen` are named but absent), no ResPlan-FP builder, no splits, no checkpoints, no
  external artefact links beyond arXiv. The README still carries a TODO. GitHub releases were not reachable from this
  container (403); the absence of tags makes a release unlikely. No related Hugging Face or PyPI artefact.
- **No integration path exists.** Nothing can be adopted.
- **The paper (arXiv 2608.25608, 2026-08-26) has reimplementable ideas** (clean-room from the text): tolerance-swept wall
  F1 with 1-to-1 matching; a typed edit-cost metric (MOVE / TYPE / CREATE / DELETE / CONVERT, ordering-constrained weights,
  ranking invariant over 21 weightings); an untrained junction + centreline graph readout; opening heatmap readout;
  deterministic base + donor output fusion with an ink gate and the "donor helps iff purity > F1_base / 2" rule;
  room → wall reconciliation; wall-first vs room-first (room-first loses walls that bound no room). Its models are
  initialised from Structured3D and trained on CubiCasa5K — non-commercial lineage, irrelevant because nothing is released.
- Verdict **REIMPLEMENT_FROM_PAPER** (metrics first; see `reuse-map.md` rows 12, 14–17).

## 3. MitUNet (§12)

- **Architecture (verified on the checkpoint's structure):** MiT-B4 encoder (60.84 M) + U-Net decoder with scSE
  (3.41 M) = **64.25 M params, 257 MB FP32**, binary wall mask with openings subtracted, Tversky loss (α 0.6, β 0.4),
  512² input, Boundary IoU reported.
- **Licences, separated:** code MIT (notebooks) **but** the MiT encoder it builds through smp 0.5.0 is
  `mix_transformer.py` under the **NVIDIA Source Code License (non-commercial)**; weights **CC BY-NC 4.0** (its README);
  data CubiCasa5K (CC BY-NC 4.0 repo / CC BY-NC-SA 4.0 Zenodo) + Floor Plan CIS (CC BY 4.0 declared over listing images);
  backbone NVIDIA MiT ImageNet (non-commercial). Non-commercial on three independent grounds — the brief's expectation is
  confirmed.
- **Smaller variants (analytic, formula reproduces the B4 checkpoint exactly):** MiT-B0 + U-Net 5.6 M (≈ 12.7 GMACs @512²),
  MiT-B1 + U-Net 16.6 M (≈ 21.5 GMACs); B0 + slim decoder 3.7–4.2 M. **B4 is unsuitable for Android.**
- Verdict **ARCHITECTURE_CANDIDATE_FOR_RETRAINING** — and 005J did exactly that in miniature: a clean-room MiT-B0
  SegFormer and a UNet-lite written from the papers and trained from scratch on BuildPlan synthetic data
  (`wall-model-proof.json`).

## 4. Additional 2025–2026 systems (§13)

No 2025–2026 floor-plan model has commercially usable code, weights and training data together — 005G's conclusion stands.
The credible new items: MitUNet (above); `Yytsi/floorplan-to-3d` (U-Net + ResNet-34, MIT code, CubiCasa-trained weights →
RESEARCH_ORACLE_ONLY); RF-DETR-Seg N/S/M/L (Apache-2.0 code and COCO weights → ARCHITECTURE_CANDIDATE_FOR_RETRAINING);
Floor Plan CIS and Swiss Dwellings (data candidates with counsel); a 2026 comparative study whose models fell from
0.83–0.91 to 0.05–0.28 AP50 on real photographed plans (domain-gap evidence). Licence traps recorded: permissive HF tags
contradicted by the model's own training data (six cases) or with no data disclosed (five); the NVIDIA licence inside smp;
AGPL Ultralytics; "MIT + Commons Clause"; HEAT's non-commercial grant. Full table: `floorplan/survey-2025-2026.md`.

## 5. Commercial-clean filter (§14)

Every candidate is split into CODE / WEIGHTS / TRAINING DATA / PRETRAINED BACKBONE / RUNTIME in `licensing-matrix.md`.
Nothing relying on CubiCasa5K, research-only Structured3D, a non-commercial dataset or unknown scraped images receives
ADOPT_PRODUCTION. **The only commercially clean route found is BuildPlan's own synthetic data with from-scratch training.**
