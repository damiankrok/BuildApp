# STAGE BUILDPLAN-ANALYZER-005J — floor-plan intelligence technology audit, Visual Referee opportunity map and training route

| verdict | result |
| --- | --- |
| SINGLE_REPO_AUDIT | **PASS**: BuildApp only. Legacy untouched; no submodule, dependency or lockfile change (§A) |
| NO PRODUCTION CHANGE | **PASS**: every production tree hash is identical to the start (`sha256(git ls-files -s)`); the production diff against `64b78b4` is empty (§M) |
| DECISION-SEAM MAP (Q1) | **PASS**: 52 seams read from the code (12 P0, 14 P1, 26 P2), injection points and the crop contract (§B) |
| FLOOR-PLAN OSS AUDIT (Q2) | **PASS**: no commercially clean model exists. ResPlan is DATA_CANDIDATE_WITH_COUNSEL, fpvec-lab is REIMPLEMENT_FROM_PAPER, MitUNet is ARCHITECTURE_CANDIDATE_FOR_RETRAINING (§C) |
| LICENSING | **PASS**: code, weights, training data, backbone and runtime are separated for every candidate; real crops are evaluation-only in every route (§C, `licensing-matrix.md`) |
| QUESTION CORPUS | **PASS**: 1,868 questions (synthetic counterfactual pairs × 4 transforms, 7 development houses, both round-8 houses) and no publisher pixel committed (§D) |
| SMALL-VLM BAKE-OFF (Q3) | **PASS_RESEARCH**: Florence-2, SmolVLM2 (64-image-token on-device configuration) and Moondream are at or below chance, with confident-wrong 1.8–23 % against a 0.5 % gate, also on matched subsets. The strong oracle is right on 98 % (144 / 147 answered). Runs were cut at a declared limit, so each arm covers a different subset; coverage and matched subsets are stated (§E) |
| WALL-MODEL PROOF (Part F) | **PASS_RESEARCH**: a from-scratch UNet-lite (1.56 M), trained on synthetic data, finds real exterior wall (0.91–1.00) and real openings when placed on the wall axis. That is recall on a one-class set with truth-side placement, on one publisher. Its real "say no" evidence is 7 questions with one confident miss. It adds no wall over source-cv. MiT-B0 is DEFERRED (§F, §G) |
| ROUTE-C PILOT | **NEGATIVE ON REAL**: 85 % on synthetic, 49.6 % on REAL_DEV with 34 % confident-wrong (§G) |
| ORACLE REPLAY | **PASS_RESEARCH**: one drawn-gap upgrade completes gozdzikowcach's footprint (−3.75 %); its verdict still fails on storeys. Cyklamenach does not move. The deterministic upgrade and a perfect witness are **outcome-identical** on every measured row (§E, `oracle-replay.json`) |
| ANDROID / DELIVERY (Part H) | **MEASURED IN THE SHIPPED WASM RUNTIME, no device**: UNet 1.19 s per frame; micro-referee 70 ms; SmolVLM2 ≈ 17–20 s per question, ≈ 7 min per median house, ≥ 1.9 GiB. Delivery is local and embedded (§I) |
| TRAINING ROUTE (Q4) | **COMMERCIAL-CLEAN**: BuildPlan synthetic data, from scratch. A teacher on real crops is CONDITIONAL on counsel (§H) |
| COUNCIL (Part J) | six independent reviewers (§K): A CHANGES REQUESTED (1 P0), B CONDITIONAL PASS, C CONDITIONAL PASS, D CONDITIONAL PASS, E CHANGES REQUESTED on the spec (freeze PASS), F CHANGES REQUESTED (1 P0). **F's P0 flipped the decision to NO_AI_YET.** No P0 open; every P1 fixed or stated (`post-review/resolution.md`) |
| DECISION (Part K, Q5) | **PRIMARY_NEXT: NO_AI_YET**: 005K builds per-gap evidence records and a sealed fresh-sheet gap set, and measures a deterministic drawn-gap upgrade on it. **SECONDARY_LATER: TRAIN_BUILDPLAN_WALL_MODEL** as the challenger, adopted only if the sealed set shows false upgrades that matter and that it refuses (§L) |
| **Stage** | ⟪FINAL_TOKEN_ROW⟫ |

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

**The headline.**
- **Generic small VLMs cannot referee BuildPlan's questions**, as tested: three checkpoints of at most 0.5 B, zero-shot,
  SmolVLM2 in its deployable 64-image-token configuration (one 512² tile; post-review B2).
  - SmolVLM2-500M is right on 45 % of what it answers, with 7.2 % confident-wrong. On the questions the oracle also
    answered it is right on 46 of 100; the oracle on 138 of 141 (post-review B1).
  - Moondream and Florence-2 are no better.
  - In the shipped runtime one SmolVLM2 question costs ≈ 17–20 s and ≥ 1.9 GiB; a witness asked for every eligible
    gap costs ≈ 7 min per median house on a desktop core (post-review B4).
  - A strong model answers 98 % with no confident-wrong answer at 0.80, so the questions are answerable.
- **No floor-plan model on the market is commercially clean.**
- **A BuildPlan-trained, from-scratch, 6 MB wall / opening network is a clean and promising research proof.**
  - It finds real walls, and real openings when it is placed on the wall.
  - Its ability to say no on real sheets is barely measured.
- **The replay of the frozen code is decisive for the sequencing.**
  - Upgrading one drawn gap completes gozdzikowcach's footprint.
  - A deterministic rule does the same, with no model, on every measured row.
  - Nothing moves a verdict: the storey count, REC-17 / TOO_LARGE and the recessed-entrance relation block them.
- **Next: NO_AI_YET, made concrete.**
  - Per-gap evidence records.
  - A sealed fresh-sheet gap set, labelled before any rule or model runs.
  - The deterministic upgrade, measured on that set.
  - The wall model is the challenger that set can justify.

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

## E. Can small VLMs answer the narrow questions? The bake-off (brief Parts C and E, Q3)

`vlm-bakeoff.{json,md}`, `vlm/vlm-audit.{md,json}`; code `research/analyzer-005j/vlm_bench.py`, `score.py`,
`summarize.py`; pins `research/analyzer-005j/models.json`.

**Arms.**
- **Florence-2-base:** `florence-community@00921df`, native transformers, fp32.
- **SmolVLM2-500M-Video-Instruct:** `@7b375e1`, official ONNX: fp32 vision + int8 decoder and embeddings.
- **Moondream 0.5B int8:** `vikhyatk/moondream2@9dddae8`, branch `onnx`, legacy client 0.0.6.
- **SERVER_ORACLE:** this session's own model, blind.
- Run beside them through the same scorer: the two wall proofs (pre-set strip rules) and the Route-C pilot.

**Same input for every arm.** Every model received the same image bytes (SHA-256 asserted by the scorer) and the same
prompt, with a closed enum that always includes UNRESOLVED.

**"Blind-8" means the round-8 development questions** (data key `REAL_BLIND8`, shown as ROUND8_DEV in
`vlm-bakeoff.md`). They were authored from the accepted 005I diagnosis of the two round-8 houses, so figures such as
"16/16 blind-8" are development evidence on two houses and 17 base questions, not blind generalisation (post-review
F14, B10).

**Read-outs, scored apart.**
- **ENUM_SCORE:** the model's own probability of each enum answer, forced inside the demanded JSON and normalised over the
  enum.
- **GEN_JSON:** strict JSON, or lenient (the first enum word).
- **STRUCTURED:** Florence grounding, on RAW opening and column crops only.

**Fixed before scoring.**
- Confident means p ≥ 0.80.
- UNRESOLVED or invalid never counts as wrong.
- The red metric is CONFIDENT_WRONG_RATE.
- Modes are never pooled.

**Coverage.** The runs shared 4 CPU cores and were stopped at a declared cut-off (18:13:38 UTC). Before the cut-off the
remaining items were re-ordered so that the blind-8 and real CANDIDATE_OVERLAY questions came first. Every model has
the complete blind-8 CANDIDATE_OVERLAY set; n per model, mode and set is in `vlm-bakeoff.md` §2.

**Each arm therefore ran on a different, non-random subset of one pool** (post-review B1). SmolVLM2's rows are 63 %
synthetic, Florence-2's 67 % blind-8, the oracle's 69 % stratified synthetic, so the pooled table below compares
different question mixes. The re-ordering criterion read no model output. The conclusion holds on matched subsets
(`vlm-bakeoff.md` §8, primary read-out, CANDIDATE_OVERLAY):

| matched set | n | oracle | SmolVLM2 | Moondream | Florence-2 | micro-referee |
| --- | --- | --- | --- | --- | --- | --- |
| oracle ∩ SmolVLM2 | 142 | 138 / 141 right, 0 cw | 46 / 100, 7 cw | — | — | 107 / 142 |
| oracle ∩ Moondream | 127 | 123 / 126, 0 cw | — | 23 / 49, 5 cw | — | — |
| SmolVLM2 ∩ Moondream (incl. 187 REAL_DEV) | 499 | — | 150 / 353, 39 cw | 91 / 195, 9 cw | — | — |
| Florence-2's set (blind-8 64, REAL_DEV 29, synthetic 2) | 95 | — | 25 / 58, 10 cw | 8 / 22, 1 cw | 15 / 37, 22 cw | 63 / 95, 16 cw |

(cw = confident wrong at ≥ 0.80.) The small VLMs' mirror / rotation figures are almost entirely synthetic (the
NORMAL-first order left REAL_DEV mirror pairs nearly unmeasured).

**Configurations as run (post-review B2, B8).** SmolVLM2-500M ran with `do_image_splitting=False`: one 512² tile, 64
image tokens, 1/17 of the snapshot's default 1,088 (16 tiles + a global view); fp32 vision, int8 decoder, a forced JSON
prefix. At 64 tokens one token summarises ≈ 1.25 m of drawing, while the gap classes turn on 1–3 px lines. The verdict
is therefore on SmolVLM2 **in its deployable configuration**. ⟪B2_PROBE⟫ A space-led prefix moves individual answers
(same argmax on 41 of 68) but not the verdict (21 / 49 vs 19 / 46). Moondream at 512² sees one 378² global view and no
crops. Florence-2-base has no VQA task, so its ENUM_SCORE measures its decoder's text prior.

**Exclusion.** The malformed gozdzikowcach porch-mouth question is excluded for every arm (`exclusions.json`, post-review
C2).

| CANDIDATE_OVERLAY, primary read-out | n | answered | right among answered | CONFIDENT_WRONG_RATE | mirror (answered pairs) |
| --- | --- | --- | --- | --- | --- |
| SERVER_ORACLE (blind sub-agents) | 148 | 99.3 % | **98.0 %** (REAL_DEV 30/30, blind-8 16/16) | **0.0 %** | 100 % |
| UNet-lite gap rules (gap classes only; real strips face-placed) | 508 | 54.9 % | 91.8 % | 2.9 % | 89.3 % |
| MiT-B0 gap rules | 508 | 62.4 % | 89.9 % | 4.7 % | 91.1 % |
| Route-C pilot | 1,300 | 100 % | 69.3 % (REAL_DEV 49.6 %) | 16.5 % (REAL_DEV 34.0 %) | 88.0 % |
| **SmolVLM2-500M**, ENUM_SCORE | 967 | 71.9 % | **45.0 %** (REAL_DEV 47.4 %, blind-8 36.6 %) | **7.2 %** | **43.0 %** |
| SmolVLM2-500M, GEN_JSON strict | 695 | **2.0 %** | 64.3 % | 0.6 % | — |
| Moondream 0.5B, ENUM_SCORE | 513 | 39.8 % | 46.1 % | 1.8 % | 73.0 % |
| Florence-2-base, ENUM_SCORE (blind-8 64, one development house 29, synthetic 2) | 95 | 39.0 % | 40.5 % | 23.2 % | — |

- **The small VLMs are at or below chance and below the majority floor.**
  - A constant guesser would score 76.8 % on REAL_DEV and 81.3 % on blind-8. On the subsets each model chose to answer,
    the floors are SmolVLM2 62.7 % (it scores 45.0 %), Moondream 54.4 % (46.1 %), Florence-2 75.7 % (40.5 %)
    (post-review B7). They answer near-constantly per class; Moondream's 63.5 % on answered REAL_DEV comes from
    abstaining by class, not from reading.
  - On counterfactual pairs whose truth differs and which both members answered, SmolVLM2 gives the same answer to
    57 % and gets both right on 19 % (uniform chance ≈ 23 %); Moondream 94 % and 0 %. The micro-referee: 21.5 % and
    76.4 %. Per-class AUROC of the option log-odds is 0.40–0.67 for SmolVLM2 (6 of 13 below 0.5), so prior
    calibration would not rescue it (B7).
  - On outline A/B questions SmolVLM2 answers NEITHER in 79 of 82 answered cases.
  - Its generation almost never yields valid JSON (2 %).
  - RAW and SEMANTIC_OVERLAY are no better than CANDIDATE_OVERLAY. On the 319 questions SmolVLM2 has in all three
    modes (271 synthetic, 48 blind-8): RAW 54.0 %, CANDIDATE_OVERLAY 49.3 %, SEMANTIC_OVERLAY 51.9 % right among
    answered (B1).
  - Florence's STRUCTURED grounding test was **degenerate for line targets** (post-review B3): a gap target is two
    points on the wall line, so its box has zero area and the hit test can never fire; every real OPENING question
    could only read UNRESOLVED. With a proper target box it would have said OPENING on 3 of the 8 blind-8 crops,
    through region boxes of 36–37 % of the crop. Nothing was localised on the window. The Florence-2 verdict does not
    change.
- **The questions are answerable.** The strong oracle is right on 98 % with no confident-wrong answer. Small models are
  the limit, not the question design.
- **Round-8 questions** (NORMAL orientation, development evidence):
  - **gozdzikowcach:** oracle 7/7; SmolVLM2 2/7 right (3 UNRESOLVED, NEITHER on both outline questions); Moondream 0/7
    answered right; Florence 1/7 (ONE_OPEN_SIDE — the analyzer's error — at 1.00); UNet gap rules 2/2.
  - **cyklamenach:** oracle 9/9; SmolVLM2 1/9 right (TERMINATES on both continuation questions); UNet gap rules 4/4
    (window OPENING 0.97).
- **On-device cost** (§I): SmolVLM2 ≈ 17–20 s and ≥ 1.9 GiB per question in the shipped WASM runtime; ≈ 7 min per
  median house (24 gaps), 2–19 min per house, on a desktop core.
- **Desktop medians, contended:** SmolVLM2 2.5 s (enum), Moondream 15 s, Florence 23 s.
- **Verdict:** ADOPT_SMALL_VLM_REFEREE is rejected. The fine-tuning route (Route A) is "not now" (§H).

**Oracle replay (post-review A1 / E4) — would a correct gap reading move a failing house?** Full record:
`oracle-replay.json`, `recommendation.md` §3.

**Method.**
- The frozen production code was re-solved from the sealed source package, observation graph and metric evidence.
- A research copy of `boundary-evidence.ts` was swapped in only inside the replay process. It upgrades WEAK gaps
  between two WALL jambs that carry drawn evidence to STRONG.
- **Fidelity:** with the oracle OFF, the replay reproduced the sealed model hash or failure code on 21 of 23 runs: 19 of
  21 replayed development rows plus both round-8 houses. The 2 that did not (dabecjach, tunbergiach) had no source
  bytes in any cache and are excluded.

**Results.**
- **dom-w-gozdzikowcach.** Upgrading **one** 0.41 m LEAF_FACE gap (`gap-Y-538-322-338`) turns PLAN_RESOLUTION_INCONCLUSIVE
  (105.47 m²) into a completed reading of **127.54 m² (−3.75 %; the footprint holds)**.
  - The verdict stays ALGORITHMIC_FAIL on the storey count (1 modelled, 2 drawn), a separate seam.
  - The UNet reads that gap ≈ 94 % OPENING on its axis.
- **dom-w-cyklamenach.** Nothing moves it: 91 upgrades, and NO_CONTINUATION / TOO_LARGE stop it first.
- **Development matrix (19 valid rows).** Upgrading *every* drawn weak gap (2–73 per house) changes one model
  (zurawkach, −0.81 % → −1.68 %) and no verdict. Every PASS row keeps its model hash.

**Caveats (post-review F2, F3, F7, F10).**
- The replay writes no `warningDetails` or observation graph, so its outputs support comparisons of **model hashes,
  outcomes, footprints and the storeys condition only**, not full holdout verdicts.
- rarytasy-g2e keeps its hash but was sealed ALGORITHMIC_FAIL on an unbuilt opening.
- 3 of the 24 matrix rows were not replayed (graph or metric files missing).
- azaliach's failed reading also changes under ALL_DRAWN, so 2 of 19 valid rows change a decision, not 1.
- Upgrade counts are events, not distinct gaps (cyklamenach 91 events, 58 distinct gaps; jarzabem 73 and 49).
- The "EXCLUDE-porch" run verified 1 of its 10 gaps. One of the others, `gap-X-413`, is a phantom stretch through a room.

**What follows.**
- A deterministic upgrade completes gozdzikowcach exactly as a perfect witness does, and nothing moves a verdict.
- The witness has no measured outcome advantage. Its possible value — saying no to drawn-but-open gaps — needs an
  out-of-sample instrument that does not exist yet.
- Hence NO_AI_YET first (§L).

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
| REAL_DEV gap questions, strip on the **wall axis** — inward side taken from the truth outline; with the side flipped, 0/63 (post-review A2 / C1 / F5); NORMAL frames; the openings set is one-class, so a constant scores 63/63: openings OPENING / continuations CONTINUES / solid stretches WALL | **61/63** (47 at ≥ 0.8, 0 wrong) / **50/65** (44, 0 wrong) / 23/24 (1 wrong) | 52/63 (39) / 47/65 (39, 2 wrong) / 24/24 |
| the same questions with the strip on the wall's outer face (the first 005J run) | 23/63 (0 at ≥ 0.8) / 23/65 / 6/24 | 27/63 / 27/65 / 8/24 |
| real envelope continuity through openings | **0.74–0.94** | 0.60–0.86 |
| real false wall inside exclusions (source-cv: ≤ 11.0 %) | ≤ 3.6 % | **≤ 0.8 %** |
| round-8 regions: cyklamenach window gap / double door / textured terrace | **96.6 % / 74.0 % opening; terrace 95.5 % background** | 96.8 % / 82.4 % opening; terrace 97.5 % background |
| round-8 regions: gozdzikowcach garage door / porch mouth / entrance door / pier (x 435–452) | **75.3 % opening** / 100 % background / 99.7 % opening / **100 % wall** | **81.6 % background** (missed) / 99.4 % background / 99.7 % opening / 100 % wall |
| gozdzikowcach 0.41 m LEAF_FACE gap (`gap-Y-538-322-338`): strip on the production face line (538) / face strip 531–545 / rows 542–550 / one-jamb wall band 540–556 (post-review F4; in `wall-model-proof.json`) | 15.7 % / 28.2 % / **94.1 %** / 82.7 % opening | 3.9 % / 16.5 % / 76.5 % / 72.3 % opening |
| `gap-X-413-239-353`: a dashed stretch through a room, no wall ink (post-review F3) | 99.7 % background | 98.2 % background |
| as a gap referee (pre-registered strip rules), CANDIDATE_OVERLAY questions | synthetic 129/149 right of 180, 13 confident-wrong; REAL_DEV (face-placed) 104/107 right of 304, 2 confident-wrong; blind-8 23/23 right of 24, 0 confident-wrong | synthetic 141/149 right of 180, 0 confident-wrong; REAL_DEV (face-placed) 128/148 right of 304, 20 confident-wrong; blind-8 16/20 right of 24, 4 confident-wrong |
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
    pier (x 435–463). The pier reads 100 % wall. (With B moved onto it both wall models answer TERMINATES, 0.98 /
    0.97 — an anecdote: a re-placement made after seeing results, on the wall arms only; post-review F13.) That
    question was malformed for every arm and is excluded from all scoring (`research/analyzer-005j/exclusions.json`).

## H. Training routes and legal training (brief Part G, Q4)

`training-plan.md`. Three routes, each with data, compute, artifact, quantisation, Android runtime and gates; GPU numbers
are estimates with stated assumptions (no GPU in this stage), CPU numbers are measured.

| route | 005J measurement | estimate for a real run | verdict |
| --- | --- | --- | --- |
| **A — fine-tune a small VLM** (SmolVLM-500M v1 base) | per-house cost (≈ 7 min per median house in the shipped runtime, ≥ 1.9 GiB) and the measured failure of synthetic-only image-level training to transfer (§G) come first; zero-shot accuracy says little about a fine-tune (post-review B13) | ≈ 220k synthetic questions, one 4090-class GPU 5–12 h, USD 10–50 per run; artifact 0.34–0.8 GB | **not now** |
| **B — wall / opening model** (UNet-lite) | from scratch on CPU in 20 min; transfers at pixel level on positives (§F); no outcome advantage over a deterministic rule in the replay (§E) | 20–50k scenes with open-gap hard negatives; 1–3 h on one 4090-class GPU, < USD 20 per run; ≈ 6 MB; 1.19 s per frame / ≈ 0.1 s per gap crop (estimate) in WASM | **SECONDARY: challenger, gated on the sealed fresh-sheet set** |
| **C — distilled micro-referee** | pilot: 85 % synthetic, 49.6 % real, 34 % confident-wrong (§G); 70 ms in WASM | generator v2 + real-style rendering + the Route-B map as input; synthetic training only (real crops evaluation-only); < USD 20 per run | **later than B** |

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
| SmolVLM2-500M (fp32 vision + int8 decoder) | 393 + 365 MB | 4.7 + 1.1 s | **≈ 17–20 s / question; ≈ 7 min per median house** (vision 11.9 s, prefill 3.8 s, 8–19 scored tokens at 0.15 s) | ≥ 1.9 GiB |

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

## K. Post-implementation council (brief Part J) — `post-review/`

Six independent reviewers read the artifacts, the harness and the raw run outputs, recomputed what they cited, and wrote
without seeing each other's reviews. The resolution of every finding is in `post-review/resolution.md`.

| reviewer | topic | verdict | P0 | P1 | what it changed |
| --- | --- | --- | --- | --- | --- |
| A | floor-plan computer vision | CHANGES REQUESTED | 1 | 6 | the oracle replay was run (A1); REAL_DEV re-measured on the wall axis (A2); two-signal witness; the P0 count de-duplicated |
| B | VLM / edge AI | CONDITIONAL PASS | 0 | 4 | matched subsets (B1); the 64-token scope (B2); the degenerate grounding test restated (B3); per-house latency (B4) |
| C | training data and evaluation | CONDITIONAL PASS | 0 | 6 | the malformed porch-mouth question excluded for every arm (C2); the unit and n of the gate; generator v2 families |
| D | licensing, provenance, supply chain | CONDITIONAL PASS | 0 | 2 | real crops are evaluation data only in every route (D1); "independent re-implementation, not clean-room" (D2) |
| E | BuildPlan architecture and integration | CHANGES REQUESTED (spec); freeze PASS | 0 | 8 | no OPEN_SIDE split; pre-pass design; unconditional asking; PATH B reconciled; 005H items |
| F | generalization red team | CHANGES REQUESTED | **1** | 8 | **the decision flipped** (F1): the witness and the deterministic rule are outcome-identical on every replayed row |

**The flip.** Before the council the primary was TRAIN_BUILDPLAN_WALL_MODEL. A's and E's P0/P1 demanded a replay; the
replay showed one drawn-gap upgrade completes gozdzikowcach, and that a deterministic upgrade does the same with no
model. F's P0 then showed that the reason given for rejecting NO_AI_YET did not distinguish it from the primary. The
primary is now **NO_AI_YET** made concrete (records, a sealed fresh-sheet gap set, the deterministic drawn-gap upgrade
with tightened eligibility, a constant control); the wall model is the **SECONDARY_LATER** challenger. B's position,
written before the flip, supports the wall model over any small VLM; it did not weigh the deterministic rule, and it
is consistent with the challenger role.

**What remains open after the council.** No P0 is open. Every P1 is fixed or stated; the P2s are fixed, stated as
limitations (§O) or recorded in the 005K / challenger specification. Not re-run: the lenient-parser and
pseudo-replication refinements (C9c/d, B9), and a SmolVLM2 int8 vision encoder (B12, UNTRIED).

## L. Decision (brief Part K, Q5) — `recommendation.md`

| | |
| --- | --- |
| **PRIMARY_NEXT** | **NO_AI_YET** — 005K builds per-gap Evidence Pack records (with `axisPx`), a **sealed fresh-sheet gap set** labelled before any rule or model runs, and the deterministic drawn-gap upgrade with tightened eligibility, measured on that set against a constant control |
| **SECONDARY_LATER** | **TRAIN_BUILDPLAN_WALL_MODEL** — the UNet-lite challenger (generator v2, two-signal witness whose BACKGROUND vetoes an upgrade), adopted only if the sealed set shows deterministic false upgrades that matter and that the model refuses |
| rejected | ADOPT_EXISTING_SPECIALIZED_MODEL (no clean model); ADOPT_SMALL_VLM_REFEREE (at or below chance, also on matched subsets; ≈ 7 min per median house, ≥ 1.9 GiB); HYBRID_WALL_PLUS_REFEREE and TRAIN_BUILDPLAN_VISUAL_REFEREE now (no measured advantage; the region seams are blocked by deterministic rules first) |

**Why the order changed during the stage.**
- The first draft named TRAIN_BUILDPLAN_WALL_MODEL. The council asked for a replay (A1, E4).
- The replay showed the deterministic drawn-gap upgrade and a perfect witness are outcome-identical on every measured
  row, and neither moves a verdict.
- So the model's case rests on out-of-sample behaviour that BuildPlan cannot measure yet (F1, F8).
- Building that measurement is cheaper than the model and needed by it. If the measurement shows the deterministic rule
  bridging open gaps in ways that change outcomes, the model has a measured target.

**005K in one paragraph.**
- Per-gap records: stable id, copy, `linePx` + `axisPx`, crop rectangle and hash, pre-override signature, strokes, ink
  fraction.
- A sealed fresh-sheet gap set: sheets drawn by lot from non-development, non-blind pages, at least one other
  publisher, labelled by a person before any rule or model runs; the count stated; a constant control beside every
  gate.
- The deterministic upgrade: drawn evidence inside the wall band only; BLANK and phantom stretches excluded.
  - It is measured on the development matrix OFF / ON and on the sealed set.
  - It ships only if its false upgrades are bounded.
- Not in 005K: any model, VLM, server, PDF.js, and the storey / REC-17 / recessed-entrance rules. Those are the actual
  verdict blockers and are separate deterministic decisions for the coordinator.

**005I's PATH B** (PDF.js) reaches 2 of 26 sources; the coordinator decides the order. **005K is not self-started.**

## M. What changed in the repository, and the production-freeze proof

| path | what |
| --- | --- |
| `research/analyzer-005j/` | the research harness: frame extraction, synthetic generator, composition, real questions, selection, VLM runners, scorer, summariser, question-corpus writer, opportunity-map merger, technology-matrix generator, WASM probe, wall-model proof (`wallproof/`), Route-C pilot (`pilot/`), README. Code and JSON/Markdown only. |
| `stage-reports/artifacts/analyzer-005j/` | every artifact the brief lists (§ "Artifacts" below) and `post-review/` |
| `tests/architecture/research-isolation.test.ts` | a 005J block: production cannot import or name the 005J harness or the audited models; the harness and artifacts track only `.py/.ts/.cjs/.json/.md` and no embedded image data; the Android build packages nothing from it |
| this report, `PROJECT_STATUS.md` | the 005J row and section |

**Not changed:** any file under `packages/` or `apps/`; the root `package.json` and lockfile; any model hash, resolver
bound, Evidence Pack format or sealed record; any Gradle file or Android asset; CI workflows.

**Freeze proof.** For each production tree, `sha256(git ls-files -s <tree>)` and its file count at the end of the stage
are identical to the values recorded at the start (`packages/` 498 files `64051a7b…`, `apps/` 277 `2117028c…`,
`packages/reconstruction` 96 `0ed6f167…`, `packages/source-cv` 14 `aa6247d0…`, the root `package.json` and
`package-lock.json`, `.github/`), and `git diff 64b78b4 -- packages apps package.json package-lock.json .github` is
empty in the committed tree and in the working tree. The replay's patched `boundary-evidence.ts` and its Vite config
lived only under `/home/user/work005j/replay/`.

**Artifacts** (`stage-reports/artifacts/analyzer-005j/`): `visual-referee-opportunity-map.{md,json}`,
`technology-matrix.{md,json}`, `licensing-matrix.md`, `floorplan-models.md` (+ `floorplan/`), `vlm/vlm-audit.{md,json}`,
`vlm-bakeoff.{json,md}`, `question-corpus.json`, `synthetic-corpus.md`, `wall-model-proof.json`,
`android-deployment-matrix.md`, `server-feasibility.md`, `training-plan.md`, `reuse-map.md`, `post-review/`,
`recommendation.md`.

## N. Gates

| gate | result |
| --- | --- |
| `npm run typecheck` | **pass** |
| `npm test` | **pass**: 164 files passed, 1 skipped; 2,170 tests passed, 11 skipped (the existing environment-gated ones); 398 s; includes `research-isolation.test.ts` with the 005J block |
| `npm run build` | **pass** (typecheck + web production build) |
| e2e / Android | no production or UI change, so nothing new to exercise; the repository's Android and emulator jobs run in CI (below) |
| analyzer regression | production unchanged (§M): the analyzer gates in CI run on byte-identical production code. In addition, the replay with the oracle OFF reproduced the sealed model hash or failure code on 21 of 23 rows (§E) |
| research deps | none added to any `package.json` or lockfile; Python environments live outside the repository, frozen in `research/analyzer-005j/requirements-*.lock.txt` |
| CI | ⟪CI_RESULT⟫ |

## O. Limitations and deviations, stated plainly

1. **No Android device or emulator, and no GPU.** Phone figures are the shipped WASM runtime on a desktop core; GPU
   training times are estimates with stated assumptions. Every latency was measured on 4 cores shared with other runs.
2. **The VLM runs were cut at a declared wall-clock limit**, not run to completion. On 4 shared cores, Florence (19–27 s
   per enum-scored question) and Moondream (≈ 5 s, plus 11–19 s per generation) could not cover all 2,582 items.
   - Before the cut, item order was set so the blind-8 questions and the real CANDIDATE_OVERLAY questions came first.
   - Moondream's free-text read-out was restricted to a sample and then dropped; its strict JSON was never valid in that
     sample.
   - Exact n per model, mode and set is in `vlm-bakeoff.md` §2. At the cut-off (18:13:38 UTC):
     - **SmolVLM2:** 1,670 records — all three modes on synthetic and blind-8, REAL_DEV CANDIDATE_OVERLAY NORMAL and
       part of MIRROR;
     - **Moondream:** 538 — CANDIDATE_OVERLAY on synthetic, REAL_DEV NORMAL (part) and all blind-8 transforms; a token
       RAW / SEMANTIC sample;
     - **Florence-2:** 114 — all blind-8 CANDIDATE_OVERLAY transforms, the blind-8 RAW opening grounding, 29 REAL_DEV,
       and almost no synthetic.

   The conclusions rest on the blind-8 and REAL_DEV CANDIDATE_OVERLAY sets, which every model has.
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
10. **The bake-off arms cover different subsets of one pool** (post-review B1). Pooled rows compare different
    question mixes; matched subsets are in `vlm-bakeoff.md` §8. SmolVLM2 has no REAL_DEV RAW or SEMANTIC_OVERLAY rows,
    and Florence-2 has 2 synthetic rows and one development house (B10).
11. **24 GARAGE_BODY CANDIDATE_OVERLAY items are malformed for every arm** (post-review B6): the red candidate outline
    covers the dashed garage-door line that is the A/B difference. All arms saw the same bytes, so no arm is favoured;
    the oracle's three errors are there. They are kept in scoring and named here.
12. **The real truth and the oracle share a reader** (post-review B5): REAL_DEV truth is the 005I manual truth
    annotated by the study agent, and blind-8 truth is the accepted 005I diagnosis, both readings by the model family
    that answers as the oracle. The real agreement is an upper bound on solvability; the synthetic 98 / 101 against
    generator semantics is the clean figure. The oracle's 0 confident-wrong holds at 0.80; at 0.75 it has 2.
13. **Disk.** The container had about 4 GB free, which bounded the composition and model choices. Upstream clones were
    deleted after their commit SHAs were recorded.

## P. Commits

See `git log analyzer/floorplan-intelligence-audit-v1 ^64b78b4`.

The terminal line: ⟪FINAL_TOKEN⟫.
