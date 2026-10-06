# STAGE BUILDPLAN-ANALYZER-005J — floor-plan intelligence technology audit, Visual Referee opportunity map and training route

⟪VERDICT_TABLE⟫

**Branch and history.**
- Branch `analyzer/floorplan-intelligence-audit-v1`, from `analyzer/dimension-topology-boundary-bakeoff-v1` @
  `64b78b4bce50d7ae060119dbe3ebc7c00dc0be56` (005I's OWNER APK record).
- Every push also goes to `claude/new-session-3kzcgh`, as 005A–005I did.
- The stage did not merge histories, force-push, reset, clean, stash or change the git identity.

**What the repository received.** Only code and text:
- this report, `PROJECT_STATUS.md` and the artifacts under `stage-reports/artifacts/analyzer-005j/`;
- the research harness `research/analyzer-005j/` (Python and TypeScript; not a workspace, not typechecked or tested by
  the repository gates, never imported by production);
- one architecture test block (`tests/architecture/research-isolation.test.ts`, 005J part) that keeps it that way.

**What it did not receive:** no publisher pixel, crop, rendered question image, overlay, PDF or HTML; no model file,
checkpoint or ONNX graph. Those live outside the worktree in `/home/user/work005j` and are recorded by SHA-256 only.
Real questions are stored as frame id + source-byte SHA-256 + URL SHA-256 + pixel coordinates + question + expected
answer (`question-corpus.json`).

**Network and data.** Model weights were fetched from their official hubs at pinned revisions and run locally. The
`SERVER_ORACLE` arm was this session's own model reading the composed crops through blind sub-agents (neutral file
names, no expected answers, a separate key file). **47 of its 149 images were composed crops of publisher drawings**,
read by the session's model as development material — the same channel through which this whole development session
reads files. No BuildPlan component sent anything anywhere, and no other service received project bytes. The oracle is a
measurement instrument, not a dependency (residual recorded in `licensing-matrix.md` §4.6–4.7).

**No blind project was consumed. Round 9 was not drawn. 005I's production code was not reopened and blind round 8 was
not patched.** The two round-8 houses are development evidence since 005I and are used here only as such.

⟪HEADLINE⟫

---

## A. Single-repository audit, starting point and the production freeze

- **Canonical repository.** BuildApp (`damiankrok/BuildApp`); every 005J commit is in it. `SINGLE_REPO_AUDIT = PASS`.
- **Legacy is read-only and untouched.** `damiankrok/BuildPlan-PC-Legacy` is attached; its checkout is at
  `claude/new-session-3kzcgh` @ `b0e79675c7ebeacf718cd1392f62272fb400418b` with 0 local changes. Nothing in 005J reads,
  depends on, writes, branches or pushes it.
- **No external project became a submodule or a dependency.** There is no `.gitmodules`; no `package.json`, lockfile,
  Gradle file or asset changed. External repositories were cloned into `/home/user/work005j/upstream/` for reading, with
  their commit SHAs recorded in the audits, and deleted afterwards.
- **Starting HEAD** `64b78b4` was verified before work began.
- **Production freeze.** Before any work, every production tree was hashed as `sha256(git ls-files -s -- <tree>)` (mode, blob
  SHA-1 of the content, and path of every tracked file) into `/home/user/work005j/freeze/start.txt`; the same hash was
  taken at the end (§M):

| tree | files | start SHA-256 (content of every file, sorted) |
| --- | --- | --- |
| `packages/source-analyzer` | 23 | `0b35f7809c3aca9f…` |
| `packages/reconstruction` | 96 | `0ed6f1679411c4e1…` |
| `packages/source-cv` | 14 | `aa6247d0420ce4bd…` |
| `packages/source-metrics` | 36 | `d8b9a1b4275ead22…` |
| `packages/source-vision` | 11 | `bc1b2e942e373cc2…` |
| `packages/model` | 37 | `35687107dcded954…` |
| `packages/geometry` | 27 | `e4a61aa94eee7ca2…` |
| `packages` | 498 | `64051a7b9e9f2a02…` |
| `apps` | 277 | `2117028cfed71928…` |
| `package.json` | 1 | `b8fad16b5eb30f8c…` |
| `package-lock.json` | 1 | `c3ec2e155f3d4e52…` |
| `.github` | 2 | `2e64ed3a7150375f…` |

## B. Where a visual referee could help — the decision-seam map (brief Part A, Q1)

`visual-referee-opportunity-map.{json,md}` — **52 decision seams read from the production code at `64b78b4`** (file:line,
the rule, the candidates, whether it refuses, whether a wrong choice changes the model, whether a crop exists, the
closed question a referee could answer, the risk, and the development / blind houses where it mattered). Two independent
read-only agents built it (reconstruction; source-cv / boundary evidence) and their seams were merged without
de-duplicating disagreements.

- **12 P0, 14 P1, 26 P2.** Of the 12 P0 seams, **7 are about one stretch of wall line** — is this gap an opening, a
  pattern, or the end of the wall (OPENING_VS_PATTERN ×3, WALL_CONTINUATION ×2, OPEN_SIDE + WALL_CONTINUATION ×2) — and
  **5 are about a region or an outline** (BODY_REGION ×4, OUTER_BOUNDARY_A_OR_B ×1).
- **Both round-8 failures start at a gap seam.**
  - `dom-w-gozdzikowcach`: `collinearWideGaps` (`plan-decomposition.ts:1413`, REC-01 / UP-06) merges a 2.7 m recessed
    porch mouth, a pier and a 3.25 m garage door into **one 7.76 m OPEN_SIDE**; the pocket rule (REC-02) then leaves the
    hall / stair column outside.
  - `dom-w-cyklamenach`: `gapStrokes` / `patternAcross` (`boundary-evidence.ts:298–419`, UP-01 / UP-02 / REC-11) read a
    window's glazing beside a board-textured terrace as **DASHED** (pattern) and the double door as a weak LEAF_FACE; the
    40 m² living block's completion is then REJECTED NO_CONTINUATION (REC-17 / UP-H2).
- **Injection points** (IP-01 … IP-08 in the JSON): IP-01, a gap-classification witness beside `withCallout`
  (`plan-decomposition.ts:2807`), and IP-02, a wide-opening witness in `WideOpeningDecision.evidence`
  (`plan-decomposition.ts:191–202`, decisions at :1433 / :1578 / :1872), are the two places where an observation changes
  the outcome **without the resolver asking anything new**. IP-05 (a third resolver corroboration beside ISOTROPY /
  CROSS_COPY) is the only seam where an interpretive answer would feed acceptance directly, and it is the riskiest.
- **The existing `VisionReasoner` path sends published figures with each request** — the opposite of what a referee may
  do; a referee must receive only the crop, the candidate masks and the closed enum (map §"vision_reasoner").
- **Evidence Packs do not persist per-gap crops**; weak gaps lack coordinates in the pack. Any referee integration needs
  the gap rectangle recorded first (map §"evidence_pack_crop_support").

## C. Open-source floor-plan technology (brief Part B, Q2)

`floorplan-models.md` (index), `floorplan/{resplan,fpvec-lab,mitunet}.md`, `floorplan/survey-2025-2026.{md,json}`
(40 records, 23 new in 2025–2026), `floorplan/oss-core.json`, `licensing-matrix.md`. Read live on 2026-10-06 against the
repositories, files, datasets and papers.

| candidate | what was verified | verdict |
| --- | --- | --- |
| **ResPlan** (`m-agour/ResPlan@e2b78fe`) | dataset downloaded and parsed: 17,000 plans (13,053 / 1,632 / 1,632 / 683), wall polygons with real gaps, door/window rectangles, rooms by class, **canvas units, not metres** (contradicting the README); code MIT; **data licence conflicting** (CC BY 4.0 limited to the authors' contributions vs CC BY-NC-SA 4.0 on Kaggle and in its own `croissant.json`); scraped listings | **DATA_CANDIDATE_WITH_COUNSEL** — not used |
| **fpvec-lab** (`Cyprinus12138/fpvec-lab@f44a475`) | full history: 2 commits, one README, no LICENSE, no code, no data, no weights | **REIMPLEMENT_FROM_PAPER** (arXiv 2608.25608: tolerance-swept wall F1, typed edit cost, junction readout, donor-fusion rule) |
| **MitUNet** (`aliasstudio/mitunet@ade0aa6`) | MiT-B4 + U-Net + scSE, 64.25 M params, 257 MB; code MIT **but** the MiT encoder in smp is NVIDIA SCL (non-commercial); weights CC BY-NC 4.0; data CubiCasa5K (NC) | **ARCHITECTURE_CANDIDATE_FOR_RETRAINING** — and retrained in miniature here from scratch, as an independent re-implementation (§F) |
| 2025–2026 survey | no model with commercially usable code + weights + data; permissive tags contradicted by training data (6) or with no data disclosed (5); RF-DETR-Seg Apache-2.0 (COCO) is an architecture candidate; Swiss Dwellings v3 (CC BY 4.0) and Floor Plan CIS are data candidates with counsel | 005G's conclusion stands |

**The only commercially clean training route found is BuildPlan's own synthetic data, trained from scratch.**

## D. The BuildPlan question corpus (brief Part D)

`question-corpus.json` (1,868 questions), `synthetic-corpus.md`.

- **Synthetic:** `research/analyzer-005j/synthetic/vrgen.py` builds scenes in metres from semantic primitives and only
  then rasterises them; the expected answer of every question is read from those semantics. **18 families, each a
  counterfactual pair** (A and B share seed and style and differ by one semantic fact), 3 seeds, **4 transforms**
  (NORMAL / MIRROR / ROT90 / ROT180, applied before rasterisation so text stays upright), style axes drawn per pair
  (wall fill, scale, anti-aliasing, blur, JPEG, skew, low contrast, terrace texture, dimension chains, furniture, labels,
  window / door / garage symbols). 672 questions; outline letters always asked in both orders.
- **Real development:** 7 development houses with 005I manual truth (`dom-pod-jarzabem`, `dom-w-arkadiach`,
  `dom-w-azaliach`, `dom-w-helikoniach`, `dom-w-morelach`, `dom-w-zurawkach`, `willa-miranda`): 282 questions per
  transform (1,128) built from the truth polygons (quadrants, exclusions, pergola outer edges, recess mouths, openings,
  solid wall stretches, outlines vs terrace / analyzer selection).
- **The two round-8 houses** (`dom-w-gozdzikowcach`, `dom-w-cyklamenach`; development evidence since 005I): 17
  hand-built questions per transform (68) aimed exactly at the 005I first bad decisions — e.g. gozdzikowcach "the
  7.76 m stretch: ONE_OPEN_SIDE or SEVERAL_OPENINGS?" (expected SEVERAL_OPENINGS), "porch mouth: does the wall continue?"
  (TERMINATES), "garage door gap: does the wall continue?" (CONTINUES), "hall / stair column: part of the body?" (YES);
  cyklamenach "window gap: OPENING or PATTERN?" (OPENING), "living block: part of the body?" (YES), "terrace north:
  EXTERNAL?" (EXTERNAL). Frames were decoded with the production decoder and checked against the sealed 005I packages'
  byte hashes.
- **Three image modes per question**, identical across models: RAW (crop + red target box), CANDIDATE_OVERLAY (crop +
  red/blue candidates with letters and a legend), SEMANTIC_OVERLAY (CANDIDATE_OVERLAY + the analyzer's own `planSheet`
  wall bands in green). Crops are square, centred on the target, ≥ 3 m context, 512 px. One prompt template per class and
  mode, a closed enum **always including UNRESOLVED**.
- **No publisher pixel is committed.** Composed images, renders and frames stay in `/home/user/work005j`; the corpus
  holds their SHA-256s and coordinates. `research-isolation.test.ts` fails if an image, model or embedded data URL is
  tracked under the 005J harness or artifacts.

⟪SECTION_E⟫

## F. A commercially clean wall / opening model, proved in miniature (brief Part F)

`wall-model-proof.json`; code `research/analyzer-005j/wallproof/`. Two networks written for this stage: a textbook U-Net (2015), and a MiT-B0 SegFormer (2021) that is an independent
re-implementation, **not clean-room** — it reproduces four details of the public PVTv2 / HF transformers code (Apache-2.0)
that the paper does not specify (post-review D2). **No NVIDIA SegFormer code, no smp / timm encoder code, no ImageNet
weights.** Both were
**trained from random initialisation on BuildPlan synthetic drawings only** (360 training scenes; exact masks from the
generator's semantics: BACKGROUND / WALL / OPENING, where OPENING is every non-open gap). Same budget for both: 1,500
steps, batch 8, 256² tiles, CPU. Evaluated on 108 held-out synthetic renders (seeds disjoint) and on the 7 development
sheets with 005I truth (never trained on).

| metric | UNet-lite (1.56 M) | MiT-B0 SegFormer (3.71 M) |
| --- | --- | --- |
| synthetic wall IoU / F1 / boundary F1 (2 px) | **0.924** / 0.961 / **0.985** | 0.902 / 0.948 / 0.979 |
| synthetic opening IoU (precision / recall) | **0.804** (0.834 / 0.958) | 0.743 (0.800 / 0.912) |
| synthetic continuity through openings | **0.980** | 0.961 |
| synthetic false wall on terraces / dimension lines / text | 0.7 % / 3.8 % / 0.2 % | 1.2 % / 5.1 % / 0.3 % |
| real exterior-wall recall (7 sheets) | 0.912–0.997 | 0.928–0.994 |
| real exterior-wall recall of **source-cv** (SCV-WALL ∪ SCV-SOLID) | 0.978–1.000 | (same) |
| **ADDITIONAL_USEFUL_WALL_EVIDENCE_OVER_SOURCE_CV** | **0.000–0.017** | 0.000–0.018 |
| real openings read as OPENING (pixel share over the truth openings) | **0.72–0.90** | 0.58–0.81 |
| REAL_DEV gap questions, strip on the **wall axis** (post-review A2 / C1; NORMAL frames): openings OPENING / continuations CONTINUES / solid stretches WALL | **61/63** (47 at ≥ 0.8, 0 wrong) / **50/65** (44, 0 wrong) / 23/24 (1 wrong) | 52/63 (39) / 47/65 (39, 2 wrong) / 24/24 |
| the same questions with the strip on the wall's outer face (the first 005J run) | 23/63 (0 at ≥ 0.8) / 23/65 / 6/24 | 27/63 / 27/65 / 8/24 |
| real envelope continuity through openings | **0.74–0.94** | 0.60–0.86 |
| real false wall inside exclusions (source-cv: ≤ 11.0 %) | ≤ 3.6 % | **≤ 0.8 %** |
| round-8 regions: cyklamenach window gap / double door / textured terrace | **96.6 % / 74.0 % opening; terrace 95.5 % background** | 96.8 % / 82.4 % opening; terrace 97.5 % background |
| round-8 regions: gozdzikowcach garage door / porch mouth / entrance door / pier (x 435–452) | **75.3 % opening** / 100 % background / 99.7 % opening / **100 % wall** | **81.6 % background** (missed) / 99.4 % background / 99.7 % opening / 100 % wall |
| gozdzikowcach 0.41 m LEAF_FACE gap (`gap-Y-538-322-338`), rows 542–550 on its axis | **≈ 94 % opening** | 71–88 % opening |
| as a gap referee (pre-registered strip rules), CANDIDATE_OVERLAY questions | ⟪UNET_REF⟫ | ⟪SEG_REF⟫ |
| ONNX fp32 / ORT-web WASM per 864² frame (1 thread, Node 18) / RSS | 6.25 MB / **1.19 s** / ≥ 340 MiB | 14.95 MB / 4.46 s / ≥ 928 MiB |

**Reading.**
- **Transfer works at the pixel level.** A 1.56 M-parameter network that never saw a publisher sheet finds 91–100 % of
  the exterior wall and reads most real openings as openings.
- **It adds no wall that source-cv does not already have** (005I's conclusion for line detectors holds for a learned
  mask too). Against source-cv's thickness-windowed bands alone it would add 8–99 %, which only says the union baseline
  is the fair one.
- **Its value is the OPENING class at a gap** — the evidence the analyzer's stroke signatures misread in both round-8
  houses.
- **It is not a referee yet** — see §G for the open-gap shortcut, the one-sided real questions and the unresolved porch
  mouth.
- **UNet-lite is the candidate; MiT-B0 is DEFERRED**: slower, larger, fewer real openings, and it misses the
  gozdzikowcach garage door; its one advantage is fewer false walls inside exclusions.
- **Distillation is possible but not needed now**: a stronger teacher could label real gap crops for human
  verification; the student is already 6 MB.

## G. Route-C pilot: a from-scratch micro-referee (feasibility only)

`research/analyzer-005j/pilot/micro_referee.py`; result in `wall-model-proof.json` → `routeCPilot`. A 1.07 M-parameter
CNN (shared trunk, one linear head per question class), trained **from scratch** for 2,000 steps on synthetic question
images from **seeds disjoint from the benchmark** (CANDIDATE_OVERLAY input, 256²), no teacher, no real data.

| set (CANDIDATE_OVERLAY) | accuracy | confident-wrong at 0.80 | lowest threshold with 0 confident-wrong | majority floor |
| --- | --- | --- | --- | --- |
| SYNTHETIC (held-out seeds, 672) | **85.4 %** | 2.7 % | 0.98 | 51.8 % |
| REAL_DEV (564) | **49.7 %** | **34.0 %** | none (1.2 % at 0.999) | 76.2 % |
| REAL_BLIND8 (68) | 70.6 % | 7.4 % | 0.98 | 76.5 % |

- Mirror 87.8 %, rotation 89.2 %, counterfactual pairs answered the same way 21.5 %.
- ECE 0.161 — overconfident.
- On device it is trivial: 4.22 MB ONNX, **70 ms per question** in ORT-web WASM (median of 20), ≥ 214 MiB.

**Verdict: negative on real.** The same generator that produced a transferable pixel model produced a whole-image
classifier that is confidently wrong on real sheets. Route C needs real-style data and a pixel observation underneath
(the Route-B map as an input channel) before it can be measured again. This is why the decision is not HYBRID now.

**The open-gap shortcut of the wall proof (stated here because 005K must fix it).**
- On synthetic WALL_CONTINUATION counterfactuals the UNet answers CONTINUES where the truth is an open gap:
  12 confident-wrong; the MiT-B0 has none there. By pixel, open gaps read 44.5 % OPENING and dimension-line ink 12 %
  WALL + 18 % OPENING (post-review A3, recomputed by the reviewer); training had 40 open gaps in 360 renders.
- The real gap questions are one-sided: all 126 REAL_DEV OPENING_VS_PATTERN questions expect OPENING, and 126 of 130
  WALL_CONTINUATION questions expect CONTINUES. The minority questions come from **8 distinct targets** and there is no
  real PATTERN question (post-review C3, C5).
- **Two question-geometry errors, found by the council and corrected:**
  - the REAL_DEV strips sat on the wall's outer face (the 005I truth outline), half outside the building. On the axis,
    UNet reads 61 of 63 openings OPENING (47 confident) — see §F;
  - the gozdzikowcach porch-mouth question's "B" piece and the "pier" region box sat over the porch floor, not the
    pier (x 435–463). The pier reads 100 % wall, and with B on it both models answer TERMINATES (0.98 / 0.97). That
    question was malformed for every arm and is excluded from all scoring (`research/analyzer-005j/exclusions.json`).

## H. Training routes and legal training (brief Part G, Q4)

`training-plan.md`. Three routes, each with data, compute, artifact, quantisation, Android runtime and gates; GPU numbers
are estimates with stated assumptions (no GPU in this stage), CPU numbers are measured.

| route | 005J measurement | estimate for a real run | verdict |
| --- | --- | --- | --- |
| **A — fine-tune a small VLM** (SmolVLM-500M v1 base) | zero-shot at or below chance (§E); ≈ 16 s and ≥ 1.9 GiB per question in the shipped runtime | ≈ 220k synthetic questions, one 4090-class GPU 5–12 h, USD 10–50 per run; artifact 0.34–0.8 GB | **not now** |
| **B — wall / opening model** (UNet-lite) | from scratch on CPU in 20 min; transfers at pixel level (§F) | 20–50k scenes with open-gap hard negatives; 1–3 h on one 4090-class GPU, < USD 20 per run; ≈ 6 MB; 1.19 s per frame / ≈ 0.1 s per gap crop in WASM | **PRIMARY (005K)** |
| **C — distilled micro-referee** | pilot: 85 % synthetic, 49.7 % real, 34 % confident-wrong (§G); 70 ms in WASM | generator v2 + real-style rendering + the Route-B map as input + human-verified real labels from an offline teacher; < USD 20 per run | **SECONDARY, later** |

Every route's gates are the same: a balanced real set; per-class confident-wrong ≤ 0.5 % (target 0.2 %); minority-answer
accuracy reported; mirror / rotation ≥ 99 %; determinism on Node 18 / 22 and x86-64 / arm64; non-circularity; a fresh
blind round only in the stage that integrates.

**Legal training (Q4).** Every route trains only on BuildPlan's own synthetic data (generator truth is canonical) plus,
for evaluation and calibration only, verified answers on real development crops kept outside the repository. No
CubiCasa5K, ResPlan, Structured3D, Floor Plan CIS or scraped imagery; no ImageNet or NVIDIA backbone weights (the
005J proofs were trained from random initialisation, the SegFormer written from the paper). A strong teacher model may
**mine hard examples and pre-label real crops for human verification at development time only** — it never writes
ground truth and is never shipped or called at runtime.

## I. Android deployment, delivery, server and privacy (brief Part H)

`android-deployment-matrix.md`, `server-feasibility.md`.

- **Measured in the runtime the app already ships** (onnxruntime-web 1.30.0 WASM, SIMD, one thread, Node 18.20.4,
  desktop core shared with other runs; RSS a lower bound):

| model | ONNX | load | per call | RSS |
| --- | --- | --- | --- | --- |
| UNet-lite (005K route) | 6.25 MB | 2.8 s | **1.19 s / 864² frame** (≈ 0.1 s per 256² gap crop) | ≥ 340 MiB |
| MiT-B0 SegFormer | 14.95 MB | 2.0 s | 4.46 s / frame | ≥ 928 MiB |
| micro-referee pilot | 4.22 MB | 0.9 s | **70 ms / question** | ≥ 214 MiB |
| SmolVLM2-500M (fp32 vision + int8 decoder) | 393 + 365 MB | 4.7 + 1.1 s | **≈ 16 s / question** (vision 11.9 s, prefill 3.8 s, 0.15 s per token) | ≥ 1.9 GiB |

- No Android device or emulator was available in 005J; phone figures for LiteRT-LM and llama.cpp are upstream card
  values or UNMEASURED, and never a text-only latency quoted as an image latency.
- **Delivery.** The decision is **local, embedded**: the Route-B model (≈ 6 MB) in the APK, through the WASM runtime
  that already carries the 005H recogniser. An optional AI pack only if a VLM is ever needed. A server only as a
  development-time teacher. A hybrid local-then-server path is not recommended: it would send exactly the hardest crops
  out.
- **Server feasibility.** One CPU core running a SmolVLM2-class model handles ≈ 1,000–2,500 questions per hour on a
  desktop; a GPU one to two orders of magnitude more; no free production server is claimed.
- **Witness volume (005K).** The recommended witness is asked **unconditionally**, for every eligible gap of every
  decomposed copy: 7–64 weak gaps per house, median 24 (post-review E5). It runs as a local pre-pass over the plan
  frames, ≈ 1.2 s per 864² frame and 4–8 frames per house. A refusal-triggered selection would be circular.
- **Referee query volume** (the rejected server option only), counted from the sealed records of the 005H, round-7 and
  round-8 runs:
  - houses that complete undisputed: **0** questions;
  - moderately ambiguous houses: **1–3**;
  - difficult houses: **3–8**, with a cap of 8 ordered by decision impact.
  - Planning figure: median ≈ 1 per house, p90 ≈ 6.
- **Privacy.** A referee needs only a ≈ 3 m square crop, the candidate masks and the closed enum. It needs never the
  plan, the URL or a published figure (the existing `VisionReasoner` sends published figures — a referee must not). Zero
  retention, no pixel logging. A crop is still a fragment of a publisher's drawing, so any server use is a counsel
  question. Local inference removes it.

## J. Reuse map (brief Part I)

`reuse-map.md`: 32 rows, each answering the five questions (does BuildPlan already have it; is the external version
better; regression risk if it replaced BuildPlan's; can it enter as an independent observation; testable without
changing resolver semantics), under the admission rules (observations not decisions; non-circular metric; the published
figure may veto, never select; provenance and determinism; licences). Classes: COPY/ADAPT (permissive only, with
notice), REIMPLEMENT_FROM_PAPER, RESEARCH_ORACLE_ONLY, REJECT. GPL/AGPL code (Raster-to-Graph, DeepFloorplan, HEAT,
Ultralytics) is never copied; non-commercial or source-available code (CubiCasa5K repository, SymPoint, ArchCAD, CAGE's
Commons Clause, NVIDIA SegFormer) is at most reimplemented from the paper without looking at the code.

⟪SECTION_K⟫

## L. Decision (brief Part K, Q5) — `recommendation.md`

| | |
| --- | --- |
| **PRIMARY_NEXT** | **TRAIN_BUILDPLAN_WALL_MODEL** — a commercially clean wall / opening observation model (UNet-lite, from scratch, BuildPlan synthetic data with open-gap hard negatives) integrated as a **gap witness** at IP-01 / IP-02, behind a flag |
| **SECONDARY_LATER** | **TRAIN_BUILDPLAN_VISUAL_REFEREE** — a distilled micro-referee for region / outline seams, after the primary, with real-style data and the wall map as input |
| rejected now | ADOPT_EXISTING_SPECIALIZED_MODEL (no commercially clean model exists); ADOPT_SMALL_VLM_REFEREE (zero-shot at or below chance; ≈ 16 s and ≥ 1.9 GiB per question on device); HYBRID_WALL_PLUS_REFEREE (the referee half failed on real sheets); NO_AI_YET (a cheap, clean, transferable observation exists and reads the round-8 gaps) |

**Why the primary.**
- It is the only measured piece that is commercially clean **and** transfers to real sheets.
- It speaks to the seams that dominate the P0 list (7 of 12) and to both round-8 first divergences.
- It enters the way BuildPlan's architecture admits evidence: an observation beside the opening callout. The resolver
  is untouched, no published figure is read, and it can be measured OFF / ON hash by hash like 005H's recogniser.

**005K in one paragraph.**
- **Generator v2** with open-gap hard negatives, and a **balanced, human-verified real gap set** built before
  calibration.
- **UNet-lite** trained from scratch, ONNX pinned by SHA-256, run in a 005H-style ORT-web WASM package on **gap crops
  only**.
- A typed `GapWitness` observation that may **upgrade** a WEAK gap with walled jambs and **split** an OPEN_SIDE stretch.
  It never downgrades, never creates a gap, never reads a published figure and never chooses a reading.
- Per-gap rectangles in the Evidence Pack.
- **Flag OFF ⇒ byte-identical**.
- **Gates:** per-class confident-wrong ≤ 0.5 % (target 0.2 %) on synthetic hard negatives **and** on the balanced real
  set; mirror / rotation ≥ 99 %; Node 18 / 22 and x86-64 / arm64 parity; development matrix OFF / ON with every hash
  change explained.
- A fresh blind round only at the end.
- **Not in 005K:** VLM, server, Route-C referee, PDF.js.

**005K is not self-started.** It is generated after coordinator review.

## M. What changed in the repository, and the production-freeze proof

| path | what |
| --- | --- |
| `research/analyzer-005j/` | the research harness: frame extraction, synthetic generator, composition, real questions, selection, VLM runners, scorer, summariser, question-corpus writer, opportunity-map merger, technology-matrix generator, WASM probe, wall-model proof (`wallproof/`), Route-C pilot (`pilot/`), README. Code and JSON/Markdown only. |
| `stage-reports/artifacts/analyzer-005j/` | every artifact the brief lists (§ "Artifacts" below) and `post-review/` |
| `tests/architecture/research-isolation.test.ts` | a 005J block: production cannot import or name the 005J harness or the audited models; the harness and artifacts track only `.py/.ts/.cjs/.json/.md` and no embedded image data; the Android build packages nothing from it |
| this report, `PROJECT_STATUS.md` | the 005J row and section |

**Not changed:** any file under `packages/` or `apps/`; the root `package.json` and lockfile; any model hash, resolver
bound, Evidence Pack format or sealed record; any Gradle file or Android asset; CI workflows.

⟪FREEZE_PROOF⟫

**Artifacts** (`stage-reports/artifacts/analyzer-005j/`): `visual-referee-opportunity-map.{md,json}`,
`technology-matrix.{md,json}`, `licensing-matrix.md`, `floorplan-models.md` (+ `floorplan/`), `vlm/vlm-audit.{md,json}`,
`vlm-bakeoff.{json,md}`, `question-corpus.json`, `synthetic-corpus.md`, `wall-model-proof.json`,
`android-deployment-matrix.md`, `server-feasibility.md`, `training-plan.md`, `reuse-map.md`, `post-review/`,
`recommendation.md`.

## N. Gates

⟪GATES⟫

## O. Limitations and deviations, stated plainly

1. **No Android device or emulator, and no GPU.** Phone figures are the shipped WASM runtime on a desktop core; GPU
   training times are estimates with stated assumptions. Every latency was measured on 4 cores shared with other runs.
2. **The VLM runs were cut at a declared wall-clock limit**, not run to completion. On 4 shared cores, Florence (19–27 s
   per enum-scored question) and Moondream (≈ 5 s, plus 11–19 s per generation) could not cover all 2,582 items.
   - Before the cut, item order was set so the blind-8 questions and the real CANDIDATE_OVERLAY questions came first.
   - Moondream's free-text read-out was restricted to a sample and then dropped; its strict JSON was never valid in that
     sample.
   - Exact n per model, mode and set is in `vlm-bakeoff.md` §2: ⟪COVERAGE⟫.
3. **The real gap questions are one-sided.** All 126 REAL_DEV OPENING_VS_PATTERN questions expect OPENING, and 126 of 130
   WALL_CONTINUATION questions expect CONTINUES, because they were generated from the 005I truth (openings and solid
   wall stretches). Real discrimination on gap classes rests on few minority questions.
   - Both the majority floor and the minority answers are reported (`vlm-bakeoff.md` §6).
   - 005K must build a balanced, human-verified real gap set first.
4. **The blind-8 questions were written after the 005I diagnosis.** They test whether a model can answer the questions
   the diagnosis identified, not whether a model would have found them. Their expected answers are the accepted 005I
   diagnosis. The two houses are development evidence since 005I and are not a blind measurement here.
5. **The oracle is this session's own model**, answering 149 composed CANDIDATE_OVERLAY questions through blind
   sub-agents (neutral file names, a separate key). It shows the questions are answerable from the crop. It is not a
   product candidate, and its confidence numbers are self-reported.
6. **The wall proof is a proof.**
   - It was trained on 360 synthetic scenes for 1,500 steps.
   - The MiT-B0 comparison is equal-budget, not best-effort (transformers usually want longer schedules).
   - The gap-referee rules were fixed before scoring and were not tuned afterwards. The minority readout was added after
     the first wall-model run; it changes no threshold and no other number.
7. **The source-cv baseline for "additional wall evidence"** is SCV-WALL ∪ SCV-SOLID (conservative). With bands alone the
   learned mask would appear to add 8–99 %; both numbers are in `wall-model-proof.json`.
8. **Florence-2** ran from the native-format port `florence-community/Florence-2-base@00921df`. The Microsoft remote-code
   checkpoint does not load into the native class. A post-review sample (37 of 666 tensors, range-read) matched
   `microsoft@5ca5edf` byte for byte, apart from documented layout differences; full identity was not verified.
9. **SmolVLM2's official int8 vision encoder does not run** on ONNX Runtime's CPU provider (`ConvInteger`). The fp32
   vision encoder was used with the int8 decoder and embeddings.
10. **Disk.** The container had about 4 GB free, which bounded the composition and model choices. Upstream clones were
    deleted after their commit SHAs were recorded.

## P. Commits

See `git log analyzer/floorplan-intelligence-audit-v1 ^64b78b4`.

The terminal line: ⟪FINAL_TOKEN⟫.
