# STAGE BUILDPLAN-ANALYZER-005M — Visual Referee v2: multiscale small-VLM bake-off + teacher/student distillation feasibility

| verdict | result |
| --- | --- |
| RESEARCH ONLY / NO PRODUCTION CHANGE | **PASS**. Every production path hashes identically to the stage base (`freeze_check.sh`: IDENTICAL). The diff against `47811e0` under `packages/`, `apps/`, `package*.json` and `.github` is empty. No VLM touches Android, no resolver decision changed, no OWNER APK, no fresh blind |
| NO WEIGHT IN GIT HISTORY | **PASS**. `history_gate.sh` (extensions, hub bundles, **magic bytes**, NUL bytes in stage paths, size caps, LFS pointers) passes over every commit since the base. The isolation test (22 checks, including a disguised-weight negative test) passes. Weights lived in `/dev/shm` and the work directory only |
| MODELS | 4 mandatory models **RUN**. Gemma 3n is **NOT_RUN_ACCESS_GATED**: 401, and no credential was created. Teacher Qwen3-VL-8B **RUN** (CPU subset); 32B **DEFERRED_ENV**. All pinned to exact revisions, with the publisher's own GGUF or a conversion done here, hashes recorded |
| PHASE 1 | ≥ 30 matched questions × 4 models × 5 modes: **PASS** (32 pre-registered, 30 after the review's exclusions) |
| PHASE 2 | best 3 × ≥ 150 matched questions × 5 modes: **PASS** (167 pre-registered, 152 after exclusions; 835 records per model, 0 failures) |
| SYNTHETIC CORPUS | **PASS**: vrgen2 2.1 has 2,000 / 400 / 400 independent drawings (TRAIN / VAL / SEALED) with generator truth, and no model has seen SEALED |
| TEACHER | **TEACHER_EXECUTION = RUN** (CPU subset). Not a usable soft-label source (§6) |
| STUDENT | **STUDENT_TRAINING = DEFERRED_ENV**, backed by a measured CPU probe (31 s per LoRA step) with the dataset format, command, VRAM, duration, outputs and export plan |
| COUNCIL | six reviewers (A–F), round 1: **0 P0, 19 P1, 49 P2**. Every P1 resolved (`post-review/resolution-round1.md`); round 2 in `post-review/` |
| RECOMMENDATION | **RETURN_TO_DETERMINISTIC_BODY_RELATION** (`recommendation.md`) |
| **Stage** | see the handoff at the end |

## 1. Branch, scope, environment

- **Branches.** `analyzer/visual-referee-v2-distillation-audit-v1`, from `analyzer/storey-registration-mass-stacking-v1`
  @ `47811e0953834af3ade62d314b35fc00f94ea4c9`. Every push also went to `claude/new-session-3kzcgh`.
- **What the repository received.** Text only: the research harness `research/analyzer-005m/` (Python + shell; never
  imported by production), the artifacts under `stage-reports/artifacts/analyzer-005m-vr2/`, this report,
  `PROJECT_STATUS.md` and one architecture-test block. No weight, checkpoint, adapter, tokenizer bundle, composed image
  or publisher pixel.
- **Environment** (`environment.md`).
  - Hardware: 4 vCPU Xeon (AVX-512 VNNI), no GPU, one 13.36 GiB memory cgroup that includes `/dev/shm`.
  - Runtime: llama.cpp `988190680d5a`, CPU, 4 threads.
  - Three container restarts.
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
  **byte-identical**: the crop provably cannot decide them.
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
- **Robustness.** The order is the same on the pre-registered 32 questions and under an accuracy ranking, so the top
  three advance either way (`phase1-advancement.json`).
- **What InternVL's first place means.** It comes from abstaining (35 UNRESOLVED), not from reading. The first-place
  gap is inside the cluster intervals.

## 4. Results — phase 2 (152 matched questions × 5 modes, the three advancing models)

| model | best mode | exact accuracy (cluster 95 %) | **CONFIDENT_WRONG_RATE** (Wilson; cluster) | all modes: accuracy / CWR | HIGH share | UNRESOLVED |
| --- | --- | --- | --- | --- | --- | --- |
| **Qwen3-VL-2B** | **D** | **69.1 %** (59–76) | **30.9 %** (24–39; 24–41) | 65.1 % / 34.7 % | 100 % | 0 / 760 |
| Qwen3-VL-4B | C (D: 65.8 / 34.2) | 67.8 % (57–75) | 31.6 % (25–39; 24–42) | 62.8 % / 35.0 % | 100 % | 14 / 760 |
| InternVL3.5-2B | C (D: 53.9 / 36.2) | 53.9 % (44–61) | 32.9 % (26–41; 26–41) | 50.5 % / 35.7 % | 100 % | 105 / 760 |

Full tables are in `bakeoff-tables.md`, with every mode, set, class and truth source, and the pre-registered 167-question
rows beside them. The headline measurements:

- **The primary metric is in effect the error rate.** Every model states HIGH on essentially every answer, so
  CONFIDENT_WRONG_RATE ≈ wrong / asked (post-review A-1 / C-1). The p ≥ 0.8 share and the AUROC are printed beside it.
- **Against an image-free prior.** The first-option rule never looks at the image and scores 58.5 % on phase 2.
  - Only **Qwen3-VL-2B in mode D** clears it with confidence: +2.0 … +18.5 points, P(> 0) = 99 %.
  - Qwen3-VL-4B in C is close: +0.9 … +16.6.
  - InternVL3.5-2B is below it overall: −15.4 … −2.0.
- **Real vs synthetic** (mode D; accuracy / CWR):

| model | REAL, 97 questions | REAL, human truth (70) | SYNTH, 55 questions |
| --- | --- | --- | --- |
| Qwen3-VL-2B | 77 % / 23 % | 84 % / 16 % | 55 % / 45 % |
| Qwen3-VL-4B | 74 % / 26 % | 81 % / 19 % | 51 % / 49 % |
| InternVL3.5-2B | 61 % / 32 % | 67 % / 27 % | 42 % / 44 % |

  The image-free prior is 62 % on REAL and 53 % on SYNTH, **so on the synthetic families every model is at chance.**

- **Context gain** (A → C / D / E; the net change in right answers over 152 questions):
  - Qwen3-VL-2B: 0 / **+6** / 0.
  - Qwen3-VL-4B: +9 / +6 / +3.
  - InternVL3.5-2B: +7 / +7 / +7. Its gain is mostly UNRESOLVED → RIGHT, from a mode A that abstains a lot.
  - Mode B (plan with coordinates, no marker) **loses** for every model: −6, −11, −12.

  Transitions are in `context-gain.json`.
- **The global-context test fails.**
  - The 10 counterfactual pairs whose difference lies outside the crop can be decided only from the whole plan.
  - In mode D, both members are answered right in **2 / 10** pairs (Qwen3-VL-2B), **0 / 10** (Qwen3-VL-4B) and
    **0 / 10** (InternVL3.5-2B).
  - The same answer is given to both members in 80–100 % of them.
- **Consistency.** Mirror consistency is 93–100 % on the 14 mirror pairs, with almost all errors stable under the
  mirror: the models are consistently wrong, not noisy.
- **Calibration.** The option probability ranks answers weakly: AUROC 0.56–0.70 in mode D.
  - No fixed threshold approaches the 0.5 % gate.
  - Qwen3-VL-2B's in-sample zero-error region covers 5.9 % of mode-D answers. Requiring all five modes to agree still
    leaves 28.6 % wrong.
  - The best in-sample real-D point is Qwen3-VL-4B at p ≥ 0.99: 43 % coverage, 2.4 % selective risk. It is chosen
    on the scored answers, so it is not a validated operating point.
- **The old SmolVLM2-500M (005J)** on the exact 78-question intersection:

| model | right | P80 confident-wrong |
| --- | --- | --- |
| SmolVLM2-500M (005J) | 19 | 10 |
| Qwen3-VL-2B, mode D | 62 | 14 |
| Qwen3-VL-4B, mode D | 58 | 12 |
| InternVL3.5-2B, mode D | 47 | 7 |

  **Far more accurate, and no less often confidently wrong.**

## 5. Runtime and size (`runtime-size-matrix.md`; this CPU, not a phone)

| model | files as run | smallest files (Q4_K_M + Q8_0 vision; quality unmeasured) | standalone mode D | deployment RAM (estimate) |
| --- | --- | --- | --- | --- |
| Qwen3-VL-2B | 2.65 GB | **1.55 GB** (official) | **34.8 s** | ≈ 2.1 GB |
| Qwen3-VL-4B | 5.12 GB | 2.95 GB | 57.4 s | ≈ 3.6 GB |
| InternVL3.5-2B | 2.80 GB | 1.63 GB (reference + estimate) | 59.2 s | ≈ 2.2 GB |
| SmolVLM2-2.2B | 2.80 GB | 1.70 GB (reference) | 63.1 s | ≈ 2.4 GB |

- **Where the time goes.** Image tokens dominate: 35–60 ms each, against 9–36 ms per text token (R² 0.87–0.98). The
  vision tower is ≈ 90 % of a mode-D prompt.
- **On a phone.** The only published figures are Qualcomm's Qwen3-VL-2B rows at a 512-token context. They exclude the
  image encoder and are quoted unlabelled. A plausible phone latency is ≈ 9–17 s per question on a flagship CPU and
  ≈ 30–80 s on a mid-range one (reviewer E's estimate).
- **Play delivery.** The packs fit Play's 1.5 GB AI-pack limit as two files. Runtime libraries (9.5 MB, x86-64)
  belong in the APK.

## 6. Teacher (`teacher-feasibility.md`) — TEACHER_EXECUTION = RUN

- **What ran.** Qwen3-VL-8B (Q4_K_M) on CPU:
  - 120 records on the 24 TEST-free phase-1 questions;
  - 42 generator-labelled TRAIN questions in mode D;
  - 12 free-text rationales.
- **On the 24 shared questions** it scores **57.5 %**. The students score 40–78 % and the image-free prior 66.7 %. Its
  option probability ranks well: AUROC 0.84, and 0.95 in D.
- **On TRAIN** it agrees with the generator on **20 / 42**. It gives **the same answer to both members of 20 of 21
  counterfactual pairs**, and gets both members right in 0, so it does not read the fact that differs. Its rationales
  are fluent descriptions of features both members share.
- **Verdict.** It is not a soft-label source or a hard-example miner for these questions. Any future teacher must first
  pass the pair-sensitivity screen.

## 7. Student (`student-training.md`) — STUDENT_TRAINING = DEFERRED_ENV

- **Dataset format** (`student_dataset.py`).
  - Generator-exact targets, including UNRESOLVED/LOW where a byte-identical crop cannot decide.
  - Teacher probabilities only where the teacher agrees with the target.
  - Composer recipes instead of pixels.
  - A real hash check against TEST and SEALED.
  - On vrgen2 2.1 it yields 55,000 / 11,000 lines.
- **CPU probe** (`student-probe.json`). 8 LoRA steps (r = 16, 9.57 M trainable of 517 M) of SmolVLM2-500M in fp32 at
  route A's 1,024 px processor setting:
  - median **31 s per step**, at ≈ 905 tokens per item;
  - peak RSS 13.1 GB;
  - no adapter written.

  Three epochs would take ≈ 1,400 h on this CPU.
- **Plan.** Container, commands, model selection at a coverage floor, VRAM estimates (route A 8–12 GB, route B
  16–24 GB), duration estimates and the export (merge → GGUF → re-run this bake-off).
- **Evaluation contract.** Evaluation on SEALED; TEST only as a before/after comparison; real data evaluation-only.
  The pass bar's sample-size limits are stated.
- **Route A's base.** SmolVLM-500M-Instruct v1, because SmolVLM2's data is not commercially clean.

## 8. Gemma 3n MatFormer (`gemma-matformer.md`)

| question | finding |
| --- | --- |
| E2B parameters | 5.44 B raw / 1.91 B effective |
| E4B and E2B | E4B contains E2B (trained jointly) |
| Mix-n-Match slicing | exists (MatFormer Lab; the repository is deprecated) |
| fine-tune → nested-slice export | **unproven** |
| vision fine-tune to LiteRT-LM | no documented conversion |
| artifact size | the stock E2B `.litertlm` is 3.0–3.7 GB, over Play's 1.5 GB per AI pack |
| licence | the Gemma Terms make any fine-tune or slice a Model Derivative and include a remote-restriction clause |
| status here | NOT_RUN_ACCESS_GATED |

## 9. Licensing (`licensing-matrix.md`)

- **Qwen3-VL:** Apache-2.0; training data undisclosed.
- **InternVL3.5:** Apache-2.0 weights, with a "Built with Qwen" duty through its InternVL3-78B-generated data.
- **SmolVLM2 (2.2B and 500M):** Apache-2.0 weights, but ≈ 77.5 % of the training mixture is academic-only or
  non-commercial. SmolVLM-500M-Instruct v1 is the cleaner, not proven-clean, base.
- **Gemma 3n:** gated; under the Gemma Terms.
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
- **Round 2** ran on the final tables and this report: `post-review/round2-*.md` and `resolution-round2.md`.

## 11. Gates

- **Freeze.** `research/analyzer-005m/freeze_check.sh` reports IDENTICAL on every production path (§ handoff).
- **History.** `research/analyzer-005m/history_gate.sh` passes over every commit since `47811e0`.
- **Isolation.** `tests/architecture/research-isolation.test.ts` passes, 005M block included.
- **CI.** Full CI on the final HEAD (§ handoff).

## 12. Recommendation — RETURN_TO_DETERMINISTIC_BODY_RELATION

**Small VLMs gain over a blind prior, but not safely.**
- The best small model and input is Qwen3-VL-2B in mode D. It beats an image-free prior on real development questions,
  which is a real gain.
- It is still confidently wrong on 31 % of all questions and 23 % of real ones.
- It never abstains.
- It fails the global-context pairs it was meant to resolve.
- It costs ≈ 35 s per question on this CPU.

**The distillation route is unsupported for now.**
- The only runnable teacher does not see the counterfactual fact.
- Training needs authorised GPU compute.
- Proving the 0.5 % bar needs a real evaluation set an order of magnitude larger.

The analyzer failure that motivated the Visual Referee is a body-relation decision on real sheets (murajach,
gozdzikowcach). That goes back to the deterministic path. `recommendation.md` lists what 005M leaves ready, and the
conditions for reopening the AI route.
