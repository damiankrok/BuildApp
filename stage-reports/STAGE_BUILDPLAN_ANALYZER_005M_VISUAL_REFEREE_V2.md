# STAGE BUILDPLAN-ANALYZER-005M — Visual Referee v2: multiscale small-VLM bake-off + teacher/student distillation feasibility

| verdict | result |
| --- | --- |
| RESEARCH ONLY / NO PRODUCTION CHANGE | **PASS**. Every production path hashes identically to the stage base (`freeze_check.sh`: IDENTICAL). The diff against `47811e0` under `packages/`, `apps/`, `package*.json` and `.github` is empty. No VLM touches Android, no resolver decision changed, no OWNER APK, no fresh blind |
| NO WEIGHT IN GIT HISTORY | **PASS**. `history_gate.sh` (extensions, hub bundles, **weight and picture magic bytes**, NUL bytes in stage paths, size caps, LFS pointers) passes over every commit since the base. The isolation test (25 checks, including a negative test on synthetic disguised-weight bytes) passes. Weights lived in `/dev/shm` and the work directory only |
| MODELS | 4 mandatory models **RUN**. Gemma 3n is **NOT_RUN_ACCESS_GATED**: 401, and no credential was created. Teacher Qwen3-VL-8B **RUN** (CPU subset); 32B **DEFERRED_ENV**. All pinned to exact revisions, with the publisher's own GGUF or a conversion done here, hashes recorded |
| PHASE 1 | ≥ 30 matched questions × 4 models × 5 modes: **PASS** (32 pre-registered, 30 after the review's exclusions) |
| PHASE 2 | best 3 × ≥ 150 matched questions × 5 modes: **PASS**, counting a mirrored or rotated rendering as a question (167 pre-registered, 152 after exclusions = 137 distinct questions + 15 transform twins, 42 clusters; 835 records per model, 0 failures). Neither set reaches 150 distinct questions |
| SYNTHETIC CORPUS | **PASS** for size and splits: vrgen2 2.1 has 2,000 / 400 / 400 independent drawings (TRAIN / VAL / SEALED) with generator truth, and no model has seen SEALED. Before any student run, three context-only classes need crop-decidable members (§7) |
| TEACHER | **TEACHER_EXECUTION = RUN** (CPU subset). Not a usable soft-label source (§6) |
| STUDENT | **STUDENT_TRAINING = DEFERRED_ENV**, backed by a measured CPU probe (31 s per LoRA step) with the dataset format, command, VRAM, duration, outputs and export plan |
| COUNCIL | six reviewers (A–F). Round 1: **0 P0, 19 P1, 49 P2**. Round 2: **0 P0, 4 P1, 48 P2**. Every P0/P1 resolved (`post-review/resolution-round1.md`, `resolution-round2.md`) |
| RECOMMENDATION | **RETURN_TO_DETERMINISTIC_BODY_RELATION** (`recommendation.md`) |
| **Stage** | see the handoff at the end |

## 1. Branch, scope, environment

- **Branches.** `analyzer/visual-referee-v2-distillation-audit-v1`, from `analyzer/storey-registration-mass-stacking-v1`
  @ `47811e0953834af3ade62d314b35fc00f94ea4c9`. `claude/new-session-3kzcgh` was mirrored at checkpoints rather than on
  every push (it was 19 commits behind at round 2, post-review F2-8); the final HEAD is on both branches.
- **What the repository received.** Text only: the research harness `research/analyzer-005m/` (Python + shell; never
  imported by production), the artifacts under `stage-reports/artifacts/analyzer-005m-vr2/`, this report,
  `PROJECT_STATUS.md` and one architecture-test block. No weight, checkpoint, adapter, tokenizer bundle, composed image
  or publisher pixel.
- **Environment** (`environment.md`).
  - Hardware: 4 vCPU Xeon (AVX-512 VNNI), no GPU, one 13.36 GiB memory cgroup that includes `/dev/shm`.
  - Runtime: llama.cpp `988190680d5a`, CPU, 4 threads.
  - Two container restarts, both during Qwen3-VL-4B phase 2, and three processes killed by the memory cgroup (a smoke
    check, the teacher's first server, the first student probe); `environment.md`.
  - Every run resumed by answered key, and re-fetched weights were re-verified by SHA-256.
- **Models** (`model-manifest.json`, `licensing-matrix.md`).

| role | model @ revision | ran as |
| --- | --- | --- |
| mandatory | Qwen/Qwen3-VL-2B-Instruct @ `89644892` | official GGUF: Q8_0 + F16 vision |
| mandatory | Qwen/Qwen3-VL-4B-Instruct @ `ebb281ec` | official GGUF: Q8_0 + F16 vision |
| mandatory | HuggingFaceTB/SmolVLM2-2.2B-Instruct @ `482adb53` | converted here: Q8_0 + F16, images capped at 336 tokens (information-preserving at ≤ 768 px) |
| mandatory | OpenGVLab/InternVL3_5-2B-Instruct @ `a1e50c52` | converted here: Q8_0 + F16 |
| conditional | google/gemma-3n-E2B-it @ `5e092ebc` | not run (gated, 401). MatFormer audit: `gemma-matformer.md` |
| teacher | Qwen/Qwen3-VL-8B-Instruct @ `0c351dd0` | official GGUF: Q4_K_M + F16 vision |
| teacher (optional) | Qwen/Qwen3-VL-32B-Instruct @ `0cfaf481` | DEFERRED_ENV (66.7 GB BF16, no GPU) |
| 005J reference | HuggingFaceTB/SmolVLM2-500M-Video-Instruct @ `7b375e1b` | not re-run as a referee; its 005J answers joined on the intersection; its weights used for the student probe only |

## 2. Questions and input modes

- **The question corpus** (`question-corpus.json`, `synthetic-corpus.md`) draws on development material only:
  - 005J REAL_DEV (7 houses, 005I truth) and ROUND8_DEV (gozdzikowcach, cyklamenach);
  - 005K GAPSET_DEV (A00 … D00);
  - murajach M1–M8 (005L diagnosis);
  - A06 / A07 storey questions;
  - 005J synthetic counterfactual pairs;
  - the new global-context generator vrgen2.

  Real images are evaluation-only.
- **Closed JSON reply.** `{"answer": "<letter|UNRESOLVED>", "confidence": "LOW|MEDIUM|HIGH"}`, decoded under a JSON
  schema; UNRESOLVED is always offered. The option probability is read from the unconstrained top-20 at the answer
  token.
- **Five modes** (`input-modes.md`), with the same question text and letter order in every mode:

| mode | images | marker |
| --- | --- | --- |
| A CROP_ONLY | 448 px crop | cyan ROI |
| B FULL_PLAN | whole plan (≤ 768 px) | coordinates in text, nothing drawn |
| C FULL_PLAN_MARKED_ROI | whole plan | cyan ROI |
| D MARKED_ROI_PLUS_CROP | C's plan + A's crop | cyan in both |
| E D + ANALYZER_OVERLAY | D + the production wall-band axes in purple | no answer, area, verdict, house name or green/red cue |

- **Context pairs.** For the context-dependent synthetic pairs, the two members' mode-A crops are verified
  **byte-identical**: the crop provably cannot decide them. The same answer is then forced only up to the prompt
  cache: InternVL3.5-2B answered 3 of 17 byte-identical mode-A pairs differently (`environment.md`).
- **Measured image tokens.**

| model | A | B / C | D / E |
| --- | --- | --- | --- |
| Qwen3-VL | 198 | 578 | 776 |
| InternVL3.5 | 258 | 1,282 | 1,540 |
| SmolVLM2 (capped) | 419 | 419 | 837 |

## 3. Results — phase 1 (30 matched questions × 5 modes, all four models)

| rank | model | exact accuracy, all modes | CONFIDENT_WRONG_RATE, all modes (cluster 95 %) |
| --- | --- | --- | --- |
| 1 | InternVL3.5-2B | 55.3 % | **21.3 %** (12–36) |
| 2 | Qwen3-VL-2B | 73.3 % | 26.7 % (14–45) |
| 3 | Qwen3-VL-4B | 66.7 % | 32.0 % (21–46) |
| 4 | SmolVLM2-2.2B | 42.0 % | 53.3 % (44–64) |

**The ranking.**
- **Rule.** The ranking is pre-registered: CONFIDENT_WRONG_RATE first, then accuracy.
- **Robustness.** The order is the same on the pre-registered 32 questions. Under an accuracy ranking the order is
  Qwen3-VL-2B, Qwen3-VL-4B, InternVL3.5-2B, SmolVLM2-2.2B, so the same three advance either way
  (`phase1-advancement.json`). Phase-1 intervals rest on 13 clusters, one house holding 8 of the 30 questions, and
  are approximate.
- **What InternVL's first place means.** It comes from abstaining (35 UNRESOLVED), not from reading. The first-place
  gap is inside the cluster intervals.

## 4. Results — phase 2 (152 matched questions × 5 modes, the three advancing models)

| model | best mode | exact accuracy (cluster 95 %) | **CONFIDENT_WRONG_RATE** (Wilson; cluster) | all modes: accuracy / CWR | HIGH share | UNRESOLVED |
| --- | --- | --- | --- | --- | --- | --- |
| **Qwen3-VL-2B** | **D** | **69.1 %** (59–76) | **30.9 %** (24–39; 24–41) | 65.1 % / 34.7 % | 100 % | 0 / 760 |
| Qwen3-VL-4B | C (D: 65.8 / 34.2) | 67.8 % (57–75) | 31.6 % (25–39; 24–42) | 62.8 % / 35.0 % | 100 % | 14 / 760 |
| InternVL3.5-2B | C (D: 53.9 / 36.2) | 53.9 % (44–61) | 32.9 % (26–41; 26–41) | 50.5 % / 35.7 % | 100 % | 105 / 760 |

Full tables are in `bakeoff-tables.md`, with every mode, set, class and truth source, and the pre-registered 167-question
rows beside them.

**"Best" is a point estimate, and the order is not stable** (post-review A2-5, A2-10).
- The 15 excluded items are not neutral: on them Qwen3-VL-2B was right 40 times and wrong 35, InternVL3.5-2B right 21,
  wrong 16 and UNRESOLVED 38. Excluding them reverses the all-modes CWR order: pre-registered InternVL 34.4 < Qwen-4B
  35.7 < Qwen-2B 35.8; amended Qwen-2B 34.7 < Qwen-4B 35.0 < InternVL 35.7.
- On the pre-registered set the best arm by the primary metric is a tie: Qwen3-VL-2B D and InternVL3.5-2B C, 53 / 167
  each. Qwen3-VL-2B D wins on the accuracy tie-break. So "best" means best accuracy at an equal CWR.
- Qwen3-VL-4B − Qwen3-VL-2B in D: CWR −1.0 … +8.1 points. The best small model is not separated from the 4B.
- The same exclusion rule also covers the three `inset_upper` A NORMAL questions of reviewer D-8 (an upper-level
  terrace is drawn over the strip, so "no upper floor over the marked area" is not settled). They were kept, to avoid a
  second exclusion round after every result had been read. Excluding them too (149 questions) leaves Qwen3-VL-2B D at
  69.1 % / 30.9 %, the same best arm, and the same phase-1 advancement.

The headline measurements:

- **The primary metric is in effect the error rate.** Every model states HIGH on essentially every answer, so
  CONFIDENT_WRONG_RATE ≈ wrong / asked (post-review A-1 / C-1). The p ≥ 0.8 share and the AUROC are printed beside it.
- **Against an image-free prior.** The first-option rule never looks at the image and scores 58.6 % (89 / 152).
  - Qwen3-VL-2B in mode D clears it: +10.5 points (+2.0 … +18.5) on all 152 questions; +15.5 (+2.1 … +26.7) on the
    97 real ones.
  - Qwen3-VL-4B in C clears it too: +9.2 (+0.9 … +16.6) on all; +14.4 (+3.3 … +24.5) on real.
  - **Family-wise** over the 15 model × mode arms, both survive against the first-option rule (critical gain +10.2 on
    all, +13.8 on real). **Neither survives against the per-class majority fitted on the scored set** (critical +9.8 /
    +12.4; best arm +6.6 / +9.3), an optimistic ceiling for a class-aware rule that never looks at the image.
  - InternVL3.5-2B is below the first-option rule overall: −15.4 … −2.0.
- **Real vs synthetic** (mode D; accuracy / CWR):

| model | REAL, 97 questions (17 clusters) | REAL, human truth (70; 8 clusters, intervals approximate) | SYNTH, 55 questions |
| --- | --- | --- | --- |
| Qwen3-VL-2B | 77 % / 23 % | 84 % / 16 % | 55 % / 45 % |
| Qwen3-VL-4B | 74 % / 26 % | 81 % / 19 % | 51 % / 49 % |
| InternVL3.5-2B | 61 % / 32 % | 67 % / 27 % | 42 % / 44 % |

  The image-free prior is 62 % on REAL and 53 % on SYNTH, **so on the synthetic families every model is at chance.**

- **Context gain** (A → C / D / E; the net change in right answers over 152 questions, with the paired cluster 95 %
  interval of the accuracy change in points). **No model's A → D gain is distinguishable from zero** (post-review A2-3,
  B-17).
  - Qwen3-VL-2B: 0 / +6 (−0.7 … +9.0) / 0.
  - Qwen3-VL-4B: +9 (0.0 … +13.0) / +6 (−1.3 … +9.2) / +3.
  - InternVL3.5-2B: +7 / +7 / +7 net right answers, but context also turns 4 / 6 / 7 of its abstentions into wrong
    answers (UNRESOLVED → RIGHT is 3 / 4 / 10), so its confident-wrong count goes 52 → 50 / 55 / **61** (post-review
    B-13).
  - Mode B (plan with coordinates, no marker) **loses** for every model: −6, −11, −12.
  - Much of the advantage over a blind rule is already there in mode A: Qwen3-VL-2B A − prior on real questions is
    +11.3 (0.0 … +22.6).

  Transitions, intervals and confident-wrong counts are in `context-gain.json` and `bakeoff-tables.md`.
- **The counterfactual pairs fail, and not only the global ones** (post-review B-14, B-15).
  - The 10 context pairs (9 independent scenes from 3 families) differ only outside the crop. In mode D, both members
    are right in **2 / 10** (Qwen3-VL-2B), **0 / 10** (Qwen3-VL-4B) and **0 / 10** (InternVL3.5-2B). Independent coin
    flips would score 2.5 / 10, and Qwen3-VL-2B's two right pairs are different pairs in different modes.
  - The same answer goes to both members in 80–100 % of the pairs where both were answered (InternVL in D: 7 of 7,
    from 10 pairs).
  - The 16 local pairs, whose difference lies **inside** the crop, fail as well: both right in D on 1 / 16, 2 / 16
    and 0 / 16.
  - The models answer per family, not per drawing. The defect is not using the whole plan; it is not reading the
    deciding fact anywhere.
- **Consistency.** Mirror consistency is 90–100 % of the 14 mirror pairs where both were answered (86–100 % with 005J's
  denominator; 93–100 % outside InternVL's mode B), with almost all errors stable under the mirror: the models are
  consistently wrong, not noisy.
- **Calibration.** The option probability ranks answers weakly: AUROC 0.56–0.70 in mode D.
  - No fixed threshold approaches the 0.5 % gate.
  - Qwen3-VL-2B's in-sample zero-error region covers 5.9 % of mode-D answers. Requiring all five modes to agree still
    leaves 28.6 % wrong.
  - **Held out, the zero-error regions do not hold** (post-review C2-2). Frozen on the 30 phase-1 questions and applied
    to the 122 phase-2-only questions: Qwen3-VL-4B 12 wrong of 127 answers above its threshold (all modes) and 5 of 35
    (D); Qwen3-VL-2B 4 of 18 (D); InternVL3.5-2B 6 of 18 (D).
  - The best in-sample real-D point is Qwen3-VL-4B at p ≥ 0.99: 42 of 97 covered, 1 wrong (2.4 %, Wilson upper bound
    12 %). It is chosen on the scored answers, so it is not a validated operating point. Its make-up (post-review
    C2-3): 8 houses; 9 of the 42 are mirror twins; 29 are also right under the image-free rule; 10 come from classes
    whose real answer never varies; it covers none of GAP_KIND, OUTER_BOUNDARY, CANOPY or STOREY.
- **The old SmolVLM2-500M (005J)** on the exact 78-question intersection:

| model | right | P80 confident-wrong |
| --- | --- | --- |
| SmolVLM2-500M (005J) | 19 | 10 |
| Qwen3-VL-2B, mode D | 62 | 14 |
| Qwen3-VL-4B, mode D | 58 | 12 |
| InternVL3.5-2B, mode D | 47 | 7 |

  **Far more accurate.** The Qwens are no less often P80-wrong than the old model (14 and 12 against 10). InternVL is
  lower (1–7 across modes) only because its probabilities are flat: 14 % of its answers reach p ≥ 0.8.

## 5. Runtime and size (`runtime-size-matrix.md`; this CPU, not a phone)

| model | files as run | smallest files (Q4_K_M + Q8_0 vision; quality unmeasured) | standalone mode D (bounded by cold E) | deployment RAM (estimate) |
| --- | --- | --- | --- | --- |
| Qwen3-VL-2B | 2.65 GB | **1.55 GB** (official) | **≤ 33.3 s** | ≈ 2.1 GB |
| Qwen3-VL-4B | 5.12 GB | 2.95 GB (official) | ≤ 49.1 s | ≈ 3.6 GB |
| InternVL3.5-2B | 2.80 GB | 1.63 GB (reference) | ≤ 57.0 s | ≈ 2.2 GB |
| SmolVLM2-2.2B | 2.80 GB | 1.71 GB (reference) | ≤ 61.4 s | ≈ 2.4 GB |

- **Standalone D** was never measured cold. Mode E sends the same two images plus ~30 text tokens, so its cold median
  bounds D; the least-squares fit gave 34.8 / 57.4 / 59.2 / 63.1 s, above the bound, because it pools server processes
  whose speed differed (post-review E2-1).
- **Where the time goes.** Image tokens dominate: 35–69 ms each, against 9–36 ms per text token (R² 0.87–0.98). They
  are 87–96 % of a mode-D prompt's time; that share includes the language model's work on them, so the vision tower
  alone is less (34–77 %, reviewer E).
- **RAM.** The estimate counts the LLM file in full: on arm64, llama.cpp repacks Q4_K / Q8_0 weights into anonymous
  memory by default, so memory-mapping saves nothing there (post-review E2-2).
- **On a phone.** The only published figures are Qualcomm's Qwen3-VL rows. The cards do not say which compute unit
  each row is or whether an image was in the prompt, and their QAIRT rows show no long-context penalty. A plausible
  phone latency is ≈ 9–17 s per question on a flagship CPU and ≈ 30–80 s on a mid-range one (reviewer E's round-1
  estimate; no phone was measured).
- **Play delivery.** Play's AI packs are at most 1.5 GB each. The smallest Qwen3-VL-2B, InternVL3.5-2B and SmolVLM2-2.2B
  packs fit as two files. Qwen3-VL-4B's smallest LLM file (2.50 GB) and every LLM file as run (Q8_0) are over the limit
  and would need `gguf-split` shards, untested here (post-review E2-4). Runtime libraries (9.5 MB, x86-64) belong in
  the APK.

## 6. Teacher (`teacher-feasibility.md`) — TEACHER_EXECUTION = RUN

- **What ran.** Qwen3-VL-8B (Q4_K_M) on CPU:
  - 120 records on the 24 TEST-free phase-1 questions;
  - 42 generator-labelled TRAIN questions in mode D;
  - 12 free-text rationales.
- **On the 24 shared questions** (point estimates; 10 clusters) it scores **57.5 %**. The students score 40–78 % and
  the image-free prior 66.7 %. Only the gap to Qwen3-VL-2B is established (−34.7 … −6.7 points).
- **Its probability does not carry over** (post-review C2-1). On the 24 questions it separates right from wrong
  (AUROC 0.84; 0.95 in D on 24 answers), but within a source set the figure is 0.74, its top bin is over-confident
  (p ≥ 0.9: 76 % right at mean p 0.98; ECE 0.31), and on the 42 TRAIN items it would label it is 0.58, near chance.
- **On TRAIN, under constrained decoding,** it agrees with the generator on **20 / 42**, gives **the same answer to
  both members of 20 of 21 counterfactual pairs**, and gets both members right in 0.
- **With a free-text-first prompt** it separated 2 of the 3 `compound_front` pairs it was tried on, describing the
  planted difference (post-review D-14). So "does not read the fact" holds for the decoding that would produce labels;
  reasoning-first labelling is untested beyond 3 pairs.
- **Verdict.** It is not a soft-label source or a hard-example miner for these questions as run. Any future teacher must
  first pass the pair screen (both members right on pairs whose truths differ) in the decoding mode that produces
  labels.

## 7. Student (`student-training.md`) — STUDENT_TRAINING = DEFERRED_ENV

- **Dataset format** (`student_dataset.py`).
  - Generator-exact targets, including UNRESOLVED/LOW where a byte-identical crop cannot decide.
  - Teacher probabilities only where the teacher agrees with the target, joined on the render hash.
  - Composer recipes instead of pixels.
  - A required hash check against TEST and SEALED.
  - On vrgen2 2.1 it would yield 55,000 / 11,000 lines, but **it refuses to**: in 2.1 the crop-only abstention target
    is a function of the class (BAY_BACK, BODY_REGION and STOREY_COVERAGE abstain on every crop-only line), so a
    student could learn abstention without reading a pixel. A generator revision with crop-decidable members in those
    classes comes first (post-review D-13).
- **CPU probe** (`student-probe.json`). 8 LoRA steps (r = 16, 9.57 M trainable of 517 M) of SmolVLM2-500M in fp32 at
  route A's 1,024 px processor setting:
  - median **31 s per step**, at ≈ 905 tokens per item;
  - peak RSS 13.1 GB;
  - no adapter written.

  Three epochs would take ≈ 1,400 h on this CPU.
- **Plan.** Container, commands, model selection at a coverage floor, VRAM estimates (route A 8–12 GB, route B
  16–24 GB), duration estimates and the export (merge → GGUF → re-run this bake-off).
- **Evaluation contract.** Evaluation on SEALED against a class × mode abstention baseline; TEST only as a
  before/after comparison; real data evaluation-only. A student's CONFIDENT_WRONG is a wrong answer with option
  probability ≥ t\*, t\* frozen on VAL, with coverage beside it. The pass bar's sample-size limits are stated.
- **Route A's base.** SmolVLM-500M-Instruct v1 (A′), because SmolVLM2's declared fine-tuning mixture is not
  commercially clean. A′ is cleaner, not clean: its SmolLM2 backbone carries a Llama 3.1 output clause (§9).

## 8. Gemma 3n MatFormer (`gemma-matformer.md`)

| question | finding |
| --- | --- |
| E2B parameters | 5.44 B raw / 1.91 B effective |
| E4B and E2B | E4B contains E2B (trained jointly) |
| Mix-n-Match slicing | exists (MatFormer Lab; the repository is deprecated) |
| fine-tune → nested-slice export | **unproven** |
| vision fine-tune to LiteRT-LM | no documented conversion |
| artifact size | the stock E2B `.litertlm` is 3.0–3.7 GB, over Play's 1.5 GB per AI pack |
| licence | the Gemma Terms make any fine-tune or slice a Model Derivative and let Google restrict usage it "reasonably believes" violates them |
| status here | NOT_RUN_ACCESS_GATED |

## 9. Licensing (`licensing-matrix.md`)

- **Qwen3-VL:** Apache-2.0; training data undisclosed. No known licensing blocker for route B.
- **InternVL3.5:** MIT / Apache-2.0 weights. Its SFT data was produced through InternVL3-78B, a Qwen-License model whose
  §5(b) asks for "Built with Qwen" on a model trained on its outputs; whether that reaches InternVL3.5's users is a
  counsel question, not an established duty (post-review F2-1).
- **SmolVLM2 (2.2B and 500M):** Apache-2.0 weights, but ≈ 77.5 % of SmolVLM2's declared fine-tuning mixture is
  academic-only or non-commercial. Route A is CONDITIONAL on counsel. SmolVLM-500M-Instruct v1 (A′) is the cleaner, not
  proven-clean, base: its SmolLM2-360M-Instruct backbone was fine-tuned on Llama-3.1-405B-generated SmolTalk, and the
  Llama 3.1 licence asks for a "Llama" name prefix and "Built with Llama" (post-review F2-3, F2-4).
- **Gemma 3n:** gated; under the Gemma Terms, which let Google restrict usage it "reasonably believes" violates them
  (post-review F2-2).
- **Outputs as training data:** no candidate forbids training on its outputs. Gemma's distillation clause makes such a
  model a Model Derivative.
- **llama.cpp:** notices are listed from `vendor/` and in-tree files.

## 10. Review (six reviewers; `post-review/`)

- **Round 1** ran on the method, the code and the interim results: **0 P0, 19 P1, 49 P2**. Every P1 is resolved.
- **What the fixes changed:**
  - 15 defective questions excluded from the amended tables: a storey layout prompt wrong on mirrored or rotated
    renders, and a garage truth that the drawing does not show;
  - a cluster bootstrap, image-free priors, risk–coverage and split counterfactual pairs added to the scorer;
  - standalone latencies and deployment RAM from parts;
  - TEST removed from the teacher's input;
  - the corpus regenerated with a SEALED split;
  - the weight guards hardened with magic-byte checks;
  - the licensing corrections.
- **Round 2** ran on the final tables and this report: **0 P0, 4 P1, 48 P2** (`post-review/round2-*.md`). The P1s:
  - A2-1: the recommendation claimed more than 005M measured about the body-relation decision; reworded, with the
    29 / 30 real body-relation subgroup recorded as a post-hoc lead;
  - C2-1: the teacher's AUROC was overclaimed; qualified with the within-set and TRAIN figures;
  - D-13: in vrgen2 2.1 the crop-only abstention target is a function of the class; the dataset builder now refuses
    such a set, and the documents say so;
  - D-14: "the teacher does not see the fact" holds for constrained decoding only; qualified.

  Every finding and its fix is in `post-review/resolution-round2.md`.

## 11. Gates

- **Freeze.** `research/analyzer-005m/freeze_check.sh` reports IDENTICAL on every production path (§ handoff).
- **History.** `research/analyzer-005m/history_gate.sh` passes over every commit since `47811e0`.
- **Isolation.** `tests/architecture/research-isolation.test.ts` passes, 005M block included (25 checks).
- **CI.** Full CI on the final HEAD (§ handoff).

## 12. Recommendation — RETURN_TO_DETERMINISTIC_BODY_RELATION

**Small VLMs gain over a blind prior, but not safely.**
- The best small model and input is Qwen3-VL-2B in mode D, on a point estimate (§4). It beats a truth-blind prior on
  real development questions, which is a real gain, though not against a fitted class-aware ceiling.
- It is still confidently wrong on 31 % of all questions and 23 % of real ones. That is its error rate: it states HIGH
  on every answer (P80 21 %).
- It never abstains.
- It fails the counterfactual pairs, global and local alike: it does not read the deciding fact.
- It costs ≤ 33 s per question on this CPU.
- On the body-relation classes themselves it was right on 29 of 30 real questions. That subgroup is post hoc; it is the
  first target for a frozen real set, not a result.

**The distillation route is unsupported for now.**
- The only runnable teacher does not see the counterfactual fact under the decoding that would produce labels.
- The generator corpus needs crop-decidable members in its three context-only classes first.
- Training needs authorised GPU compute.
- Proving the 0.5 % bar needs a real evaluation set about two orders of magnitude larger: ≥ 598 questions per class,
  ≈ 70–90× today's 97.

The analyzer failure that motivated the Visual Referee is a body-relation decision on real sheets (murajach,
gozdzikowcach). No small VLM meets, or can be shown on the real data that exist to meet, the 0.5 % gate for it. That
decision goes back to the deterministic path. `recommendation.md` lists what 005M leaves ready, and the
conditions for reopening the AI route.

## Handoff

- **Final gates on `776295c`:**
  - `freeze_check.sh`: IDENTICAL;
  - `history_gate.sh`: PASS over 32 commits since `47811e0`;
  - `research-isolation.test.ts`: 25 / 25;
  - production diff since `47811e0`: empty.
- **CI on `776295c`:** BuildApp CI run
  [37798078813](https://github.com/damiankrok/BuildApp/actions/runs/37798078813), **success, 30 / 30 jobs**,
  including the Android APK, 3D entry and UI evidence gates.
- **The commit that carries this section** changes only this report and `PROJECT_STATUS.md`.

```
STAGE: BUILDPLAN-ANALYZER-005M
VERDICT: PASS
BRANCH: analyzer/visual-referee-v2-distillation-audit-v1
HEAD: 776295c (research HEAD verified by CI; the handoff commit on top is docs-only)
CI: BuildApp CI run 37798078813, success (30/30)
FULL_REPORT: stage-reports/STAGE_BUILDPLAN_ANALYZER_005M_VISUAL_REFEREE_V2.md
BEST_SMALL_MODEL: Qwen/Qwen3-VL-2B-Instruct@89644892 (point estimate; not separated from Qwen3-VL-4B)
BEST_INPUT_MODE: D
CONFIDENT_WRONG_RATE: 30.9 % (47/152, mode D, phase 2; = its error rate; real 22.7 %)
CONTEXT_GAIN: A→D net +6/152 (cluster 95 % −0.7 … +9.0 pp, not distinguishable from zero); context pairs both right 2/10 (chance level)
TEACHER_EXECUTION: RUN
STUDENT_TRAINING: DEFERRED_ENV
BEST_DEPLOYABLE_SIZE: 1.55 GB (Qwen3-VL-2B Q4_K_M + Q8_0 vision, official GGUF; quality unmeasured)
PRODUCTION_CHANGED: NO
NEXT_RECOMMENDATION: RETURN_TO_DETERMINISTIC_BODY_RELATION
FINAL_TOKEN: PASS_BUILDPLAN_ANALYZER_005M_VISUAL_REFEREE_V2_READY_FOR_COORDINATOR
```
