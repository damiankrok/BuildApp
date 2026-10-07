# 005M post-review, round 1 — resolution

**Round 1.**
- **Who:** six independent reviewers (A benchmark fairness, B visual context and leakage, C safety calibration, D
  distillation and provenance, E Android / storage / runtime, F licensing and isolation).
- **What they reviewed:** the method, the code and the interim results while the phase-2 runs were still going. That
  was phase 1 for all four models and phase 2 for Qwen3-VL-2B.
- **Their reports:** `round1-reviewer-*.md`.
- **Totals: 0 P0, 19 P1, 49 P2.** Several P1s are the same defect found twice (A-1 = C-1, A-3 ≈ C-5, A-4 = C-10,
  B-2 = D-1, B-3 ≈ C-6, C-4 ≈ D-4).

**Nothing reached P0.**
- **No answer leakage.** No mode leaks the expected answer (B).
- **No weights in Git.** No weight or publisher pixel is in Git history (E, F).
- **Production is unchanged.** `freeze_check.sh` reports IDENTICAL.
- **The phase-1 decision stands.** It reproduces exactly, and the same three models advance under the amended set and
  under an accuracy ranking (A).

Every P1 is resolved below by a code change, a re-scored table or a corrected document. Where a P1 could not be fixed
by re-running, the limit is stated in the stage report. Commits: `cb96c15`, `3d6264a`, `3df4f59`, `41e9230`,
`01352f2`, `19de4a1`.

## P1 findings

| id | finding | resolution | where |
| --- | --- | --- | --- |
| A-1 / C-1 | Stated HIGH is near-constant, so CONFIDENT_WRONG_RATE ≈ the wrong-answer rate, and the ranking rewards UNRESOLVED | The pre-registered primary is kept, because the brief names it. Every table now also prints the HIGH share and the p ≥ 0.8 share among answers, and the reading is stated in the tables and the report. The phase-1 top three are the same under accuracy ranking and under the amended set | `score.py` (summaries), `summarize.py`, `bakeoff-tables.md`, stage report |
| A-2 | Baselines too weak (the pooled majority answer was meaningless) | Image-free baselines per set: always-A/B/C, the first-option rule and the per-class majority (fitted, an upper bound). Each model is also given as a model − prior difference with cluster-bootstrap intervals | `score.py` → `baselines`, `clusterBootstrap.modelMinusFirstOptionPrior` |
| A-3 (C-5) | Wilson intervals treat correlated rows as independent | A cluster bootstrap (2,000 resamples, seed 5005) over **real houses** and **synthetic scene pairs** with their transforms: 13 clusters in phase 1, 42 in phase 2. It covers accuracy and CONFIDENT_WRONG_RATE, and paired model − model differences | `score.py` → `clusterBootstrap` |
| A-4 / C-10 | The old SmolVLM2-500M table set its P80 count beside the new models' stated-HIGH rate | The intersection table now leads with like-for-like P80, and notes that 005J's probability covers the whole answer-word sequence while 005M's covers the first answer token | `score.py` / `summarize.py` → old-model section |
| B-1 | The storey prompt said "ground left, upper right" on MIRROR / ROT90 renders | The 6 affected questions are excluded from every amended table (`excluded-items.json`). Fixed forward: `common.STOREY_LAYOUT` describes the layout per transform. Recomposing changes no prompt outside the excluded items | `common.py`, `excluded-items.json` |
| B-2 / D-1 | The garage family labelled an unmarked front gap GARAGE_DOOR, against the preamble and against 005J's own label for the same drawing | The 9 GARAGE_DOOR_VS_CARPORT questions are excluded. vrgen2 2.1.0 asks what the drawing shows, whether the bay is closed at the back (BAY_BACK_CLOSED_VS_DRIVE_THROUGH), and drops the bay's BODY_REGION question. The teacher-mining slice lost its 6 garage questions before the teacher ran (42 remain) | `synthetic/vrgen2.py`, `common.py`, `excluded-items.json` |
| B-3 (C-6) | Counterfactual consistency pooled context pairs (crops forced identical in A), local pairs and a same-truth control | Reported apart: context pairs (both right of all pairs, same answer), local pairs, and same-truth controls counted and left out. The pooled figure is kept, labelled pre-registered | `score.py` → `consistency` |
| C-2 | P80 reported without coverage, rewarding flat probabilities | p ≥ 0.8 share and AUROC are printed with it, and P80 never ranks a model | `score.py`, `summarize.py` |
| C-3 | No risk–coverage curve or operating point | Selective risk and Wilson upper bound at fixed thresholds 0.5 … 0.999 per model (all modes, D, real D). Also an in-sample zero-error region, **flagged as not a validated operating point**, and agreement filters (C+D+E, all five) | `score.py` → `calibration.json` |
| C-4 / D-4 | The inherited 0.5 % pass bar cannot be shown on 2–17 real questions per class; 27 of 97 real truths are AI-authored | The sample sizes are stated: n ≥ 598 / 765 with zero errors, and ≥ 381 flip-free pairs for 99 % mirror consistency. Real data can only screen the bar. REAL is split by truth source (70 human, 27 AI-authored) in every table | `student-training.md` §5, `score.py` → `REAL_HUMAN_TRUTH` / `REAL_AI_AUTHORED_TRUTH` |
| D-2 | The sealed TEST would reach the teacher (8 phase-1 questions) and was used in model selection | The teacher's phase-1 lane runs on phase 1 **minus** TEST (24 questions); it had not started yet. A new **SEALED** split (2.1.0, seed 540000) is the evaluation split for any student, and TEST is a before/after comparison only | `items-teacher-p1.jsonl` (work dir), `vrgen2.py`, `student-training.md` §2, §5 |
| D-3 | "≥ 2,000 / 400 / 400" counted transforms and questions (176 / 40 / 40 seeds) | 2.1.0 generated 125 / 25 / 25 pairs per family: **2,000 / 400 / 400 independent drawings** (8,000 / 1,600 / 1,600 renders; 11,000 / 2,200 / 2,200 questions). Every level is counted, with per-split hashes and a disjointness check | `synthetic-corpus.md`, `question-corpus.json` → `synthetic005M_v2_1` |
| E-1 | Mode-D latency read 2.4–4.1× low, because it reused C's cached plan | The benchmark wall time is labelled cache-aided, beside standalone medians from cold records. D comes from a least-squares fit (R² 0.96–0.98): Qwen3-VL-2B D is 34.8 s standalone, against 12.7 s cache-aided. `input-modes.md` is corrected | `runtime_matrix.py`, `input-modes.md` |
| E-2 | "Pack + peak anon RSS" overstated deployment RAM about 3× | Estimated from parts: model files + KV at 2,048 tokens (shapes from each `config.json`) + 0.3 GB compute buffers, with no prompt cache. Qwen3-VL-2B smallest files come to ≈ 2.1 GB. Anon RSS is reported after the first request and at the peak | `runtime_matrix.py` |
| E-3 | The cgroup limit is 13.36 GiB, not 15.7; InternVL would run with ≈ 0.2 GB headroom | Qwen3-VL-2B's 2.5 GB were freed from `/dev/shm` at once (its phase 2 had finished). `environment.md` states the limit and the one OOM kill, a smoke check before the caps | `environment.md` |
| F-1 | Route A (SmolVLM2-500M) is not commercially clean | Said so in the licensing matrix, the student plan and the recommendation. SmolVLM-500M-Instruct v1 `a7da5b98` is named the cleaner default base. It is cleaner, not proven clean: Cauldron subsets were not audited | `licensing-matrix.md` §3.5, `student-training.md` §2 |

## P2 findings

| id | resolution |
| --- | --- |
| A-5 | Probability drift between cached and uncached evaluation (up to 0.037; no answer changed on the byte-identical inputs checked) is stated in `environment.md` and the report. 26 % of SmolVLM2-2.2B's records lie within that margin of a tie, so its per-item answers are fragile; no conclusion rests on them, since it is last on every metric |
| A-6 | The `score.py` docstring now says a model is tabulated only on a set it completed |
| A-7, B-11 | Context gain and calibration are computed on matched sets: PHASE1 for every phase-1 model, PHASE2 for every phase-2 model |
| A-8 | Independent clusters are reported per table |
| A-9 | `phase1-advancement.json` names the phase-1 chain's ranking file (19:45:26.21) as the decision point; the JSON followed a minute into phase 2 |
| A-10 | The first 16 SmolVLM2-2.2B records ran with the default 8 GiB cache before a restart; one has a token count of 0. Stated in the report; it does not affect answers |
| A-11 | `input-modes.md`: the SmolVLM2 cap preserves information (every image ≤ 768 px); every model receives every input pixel; the pixels-per-token figure is corrected (1,024 px² per token) |
| B-4, B-6, B-8, B-9, B-12 | Documented in `input-modes.md`: dashed outline 2 shows only as fragments; the outline questions' "crop" is the whole sheet; the overlay comes from the analyzer and differs between twins; brackets can touch wall ink; control pairs |
| B-5 | `input-modes.md` figures corrected: 18 of 90 plans have no bands; the smallest plan is 329 × 272; 49 of 167 plans are under 768 px; 102 of 167 crops are upscaled; token ratios are given per model |
| B-7 | OTHER is broken down (RIGHT→UNRESOLVED, UNRESOLVED→WRONG, WRONG→WRONG with another option, FAILURE), and net change = right in mode − right in A |
| B-10, D-12 | `student_dataset.py` documents the prompt recipe: recomputed at compose time with the real band flag. Only the letter order is computed there |
| C-7 | Mirror and rotation consistency are also reported with 005J's denominator (UNRESOLVED counts as an answer) |
| C-8 | Model selection is on VAL CONFIDENT_WRONG_RATE **at a coverage floor**, with the threshold frozen on VAL; the docstring's "safety property" claim is softened |
| C-9 | Not re-run (it would have changed `bench.py` in the middle of a run). The invariants hold in every record: the answer is the arg-max of the option probabilities, and option mass is ≈ 1 for Qwen. Qwen3-VL-2B's 17- vs 13-token completions for identical text are noted as unexplained; they do not touch answers |
| C-11 | Calibration is split REAL / SYNTH |
| D-5 | The TEST / SEALED exclusion is a real check: every render's hash against those splits' scene hashes, which stops the run on a hit |
| D-6 | Teacher probabilities are kept only where the teacher agrees with the target; otherwise only `hardExample: true` |
| D-7 | The abstention-shortcut risk and its mitigations are in `student-training.md` §1 |
| D-8 | `inset_upper` A draws no upper-level terrace in 2.1.0. The 2.0.0 TEST questions keep it; it is documented, and their scores are read with that caveat |
| D-9, E-9 | Footprint arithmetic corrected (1.55 GB, decimal, model files only; libraries apart); route A sizes taken from ggml-org listings |
| D-10 | Route A's processor is set to a 1,024 px longest edge (320 tokens per image, ≈ 860 for D) |
| D-11 | 38 context items, of which 34 twin-paired; the distance outside the crop is about 2.0–2.65 m; per-split hashes replace a field that held counts |
| E-4 | Smallest-pack quality is unmeasured; libraries ship in the APK, not an AI pack; Play limits are on compressed download size; the two GGUF files fit two AI packs; `gguf-split` is untested |
| E-5, F-8, F-9, F-10 | The isolation test and the history gate check weight magic bytes whatever the name, NUL bytes in stage files, nested pixel arrays, Android native code and runtime dependencies. They exempt only publisher `.bin` bytes that start like drawings or pages. A disguised safetensors blob named `runs/*.jsonl` now fails two tests |
| E-6 | Phone table: all three Qualcomm rows per device are quoted unlabelled; derived prefill is marked derived; the 4096-context penalty rows are added; the unverifiable 4B vision-encoder timing is removed |
| E-7 | Libraries counted once (9.52 MB); the load time is read from the "model loaded" line; InternVL ran from disk |
| E-8 | `quantised-sizes.json` is committed with each repository and revision; InternVL Q4_K_M is a listing, and only its mmproj Q8_0 remains an estimate |
| F-2 … F-7, F-12 | Licensing matrix corrected against primary sources: SmolVLM2's restricted share (≈ 77.5 %); InternVL3.5's Qwen-License attribution; may outputs train another model (per model); the Gemma qualifier and its updatable policy; the terms diff against Google's own archive; the ggml-org pin; llama.cpp vendor notices |
| F-11 | `environment.md`: no Hugging Face credential; the platform's own session tokens went unused |
| F-13 | Output guards use `realpath`, so a symlinked directory inside the repository is refused |

## Left for round 2

These were not reviewable in round 1: InternVL3.5-2B and Qwen3-VL-4B phase 2, the teacher lane, the CPU student
probe, the final tables, `recommendation.md` and the stage report. Round 2 re-checks each reviewer's listed items
against them.
