# 005M post-review, round 2: resolution

**Round 2: 0 P0, 4 P1, 48 P2** over six reviewers (A 0/1/9, B 0/0/7, C 0/1/6, D 0/2/6, E 0/0/9, F 0/0/11). Every
reviewer found the recommendation, RETURN_TO_DETERMINISTIC_BODY_RELATION, supported by the measurements. Every P1 and
every P2 is handled below: fixed, or stated as not fixed with the reason.

**What changed in the numbers.** Nothing that was published moved, except four labels:
- standalone mode D is now the cold-E bound (≤ 33.3 s for Qwen3-VL-2B) instead of the fit (34.8 s);
- the first-option prior reads 58.6 %, not 58.5 %;
- SmolVLM2-2.2B's smallest pack reads 1.71 GB, not 1.70;
- InternVL3.5-2B's Q8_0 vision size is now a REFERENCE listing (0.34 GB), not an estimate, so its smallest pack is
  1.625 GB.

The scorer gained intervals and checks, and `matched-bakeoff.json`, `context-gain.json`, `calibration.json` and
`bakeoff-tables.md` were regenerated. Every pre-existing number in them is unchanged.

**Tooling commits.** `c908558` and the commit carrying this file. The scorer pipeline reproduces the committed JSON with
the README command (`--exclude …`).

## P1

| id | finding | resolution |
| --- | --- | --- |
| A2-1 | The recommendation said 005M showed "no small VLM … can stand in for that decision". On the body-relation classes Qwen3-VL-2B D was right on 29 / 30 real questions, including the 3 that are the 005L failure | **Fixed.** `recommendation.md`, stage report §12 and `PROJECT_STATUS.md` now say what was measured. No small VLM meets, or can be shown on the available real data to meet, the 0.5 % gate, and the best arm is confidently wrong on 23 % of real questions. A new paragraph, "What 005M does not show", records the 29 / 30 (TERRACE_VS_BODY 15 / 15, BODY_REGION 14 / 15; 16 / 17 on murajach + gozdzikowcach), recomputed here from the raw runs, as a post-hoc subgroup and a lead. It is the first pre-registered target in the reopen conditions. The enum is unchanged |
| C2-1 | The teacher's "probability ranks its own answers well" (AUROC 0.84 / 0.95) was overclaimed; the report omitted the caveats and the TRAIN AUROC of 0.58 | **Fixed.** `teacher-feasibility.md` Result 1 and stage report §6 give n = 24 (14 right / 10 wrong, 10 clusters), the within-set 0.74, the over-confident top bin (p ≥ 0.9: 76 % right at mean p 0.98; ECE 0.31) and the TRAIN AUROC 0.58. "The one property worth keeping" is removed |
| D-13 | In vrgen2 2.1 the crop-only abstention target is a function of the class (BAY_BACK, BODY_REGION, STOREY_COVERAGE abstain on every line); `student-training.md` claimed the opposite | **Fixed in the tooling; the corpus revision is a stated precondition.** `student_dataset.py` counts crop-only abstention per class and refuses to write a set where any class abstains on every line. `--allow-class-shortcut` writes it for inspection only. Verified: on 2.1 it stops, listing the three classes. `student-training.md` §1, `synthetic-corpus.md`, the stage report §7 and the recommendation say so. Adding crop-decidable members to those classes (≥ 30 % each) is a reopen condition, together with a class × mode abstention baseline on SEALED. The generator itself was not revised in this stage: no student is trained here, and the guard makes the shortcut impossible to use silently |
| D-14 | The rationale lane contradicts "the teacher does not see the counterfactual fact": free-text-first, it separated 2 of 3 `compound_front` pairs | **Fixed.** `teacher-feasibility.md` (Result 2 heading, new Result 3, verdict table), stage report §6, recommendation and `PROJECT_STATUS.md` now say this holds for constrained, answer-first decoding. Reasoning-first labelling is untested beyond 3 pairs. The teacher screen must be run in the decoding mode that will produce labels. The optional 1.2 CPU-hour rerun on all 42 items was not done |

## P2: reviewer A (benchmark fairness)

| id | resolution |
| --- | --- |
| A2-2 | **Fixed.** `score.py` emits model − prior per subset (ALL, REAL_ALL, SYNTH_ALL) against the first-option rule and the fitted class majority, with a family-wise max-statistic check over the 15 arms. The recommendation quotes the real-only interval (+15.5, +2.1 … +26.7). It says both Qwen3-VL-2B D and Qwen3-VL-4B C clear the first-option rule family-wise, and that neither clears the fitted class-majority ceiling |
| A2-3 | **Fixed.** Paired cluster intervals for every A → mode gain (`contextGainVsA`, `context-gain.json`, tables). The report says no A → D gain is distinguishable from zero, and the InternVL sentence is corrected |
| A2-4 / A-5 | **Fixed.** `environment.md` replaces "changes no answer by design" with the measured drift (≤ 0.037) and InternVL's 3 / 17 flips. The context-pair notes say "forced, up to prompt-cache nondeterminism" (`input-modes.md`, stage report §2, `bakeoff-tables.md`) |
| A2-5 | **Partly fixed.** Stage report §4 states the reversal of the all-modes CWR order and the pre-registered tie (53 / 167 each), so "best" means best accuracy at equal CWR. The D-8 `inset_upper` A questions fall under the exclusion rule. They are **not** added to it: a second exclusion round after every result was read would be more post hoc than the first. A sensitivity run excluding them too (149 questions) leaves Qwen3-VL-2B D at 69.1 % / 30.9 %, the same best arm and the same phase-1 advancement. This is stated in §4 |
| A2-6 | **Fixed.** Tables print distinct questions (137 of 152; 30 of 30). The stage report's PHASE 2 row says the threshold is met only by counting transform twins |
| A2-7 | **Fixed.** The README scorer command has `--exclude` and the run order |
| A2-8 | **Fixed.** Phase-1 order under accuracy; the old-model sentence (InternVL lower only through flat probabilities); mirror 86–100 %; prior 58.6 %; the teacher − Qwen3-VL-2B difference is established (−34.7 … −6.7) and stated, the rest are point estimates |
| A2-9 | **Fixed.** The "How to read" block flags intervals from fewer than ~20 clusters. The report marks the REAL-human column and phase 1 as approximate |
| A2-10 | **Fixed.** The recommendation cites the Qwen3-VL-4B real-D selective point (42 / 97, 1 wrong, Wilson ≤ 12 %) with its make-up, and says best-model is not separated (Qwen-4B − Qwen-2B CWR in D −1.0 … +8.1) |
| A-6 | **Fixed.** The `score.py` docstring says a model missing records is left out of the table, and lists the post-review amendments |
| A-10 | **Fixed.** `environment.md` discloses the 16 SmolVLM2 records under the default cache and the crash. The scorer and runtime matrix leave a missing image-token count out instead of counting 0. The medians are unchanged |
| A-11 | **Fixed.** `input-modes.md` notes that mode B's 0–1000 frame is Qwen-VL's grounding convention and below llama.cpp's suggested token count; mode B still loses for every model |

## P2: reviewer B (context and leakage)

| id | resolution |
| --- | --- |
| B-13 | **Fixed.** The context-gain table carries CONFIDENT_WRONG in A → mode. The report says InternVL's confident-wrong count rises 52 → 55 / 61 in D / E |
| B-14 | **Fixed.** Stage report §4 and `PROJECT_STATUS.md`: local pairs fail too (1 / 2 / 0 of 16 in D), 2 / 10 is chance level and moves with the mode, and models answer per family. The recommendation's ADOPT bullets no longer frame it as a context problem |
| B-15 | **Fixed.** The report says "of the pairs where both were answered". The local column is printed over all pairs, like the context column |
| B-16 | **Fixed.** `contextDependentOnly` is restricted to the 20 context-pair members |
| B-17 | **Fixed** by the paired intervals (A2-3) |
| B-18 | **Fixed.** `input-modes.md` and `synthetic-corpus.md` label the pre-registered counts and give the amended ones (23 = 20 + 2 + 1; teacher 18 of 42). They describe the per-transform storey layout (`common.STOREY_LAYOUT`) and say `--compat 2.0.0` is byte-identical in renders and questions, not `corpus.json` |
| B-19 | **Fixed.** The teacher screen is now "both members right on a stated share of pairs whose truths differ, context and local apart", with same-answer secondary (`recommendation.md`, `teacher-feasibility.md`) |

## P2: reviewer C (safety calibration)

| id | resolution |
| --- | --- |
| C2-2 | **Fixed.** `score.py` adds `heldOutZeroErrorThreshold`: the phase-1 zero-error threshold applied to the 122 phase-2-only questions (Qwen3-VL-4B 12 / 127 answers wrong all modes, 5 / 35 in D; Qwen3-VL-2B 4 / 18 in D; InternVL 6 / 18 in D). It is quoted in §4 and the recommendation |
| C2-3 | **Fixed.** The make-up of the Qwen3-VL-4B real-D point is in §4 and the recommendation, and named as the one selective signal to test |
| C2-4 | **Fixed.** The recommendation says the 30.9 % is the error rate (HIGH on every answer; P80 21 %) |
| C2-5 | **Fixed.** a: mirror 86–100 %; b: old-model sentence; c: "about two orders of magnitude (≈ 70–90×)"; d: phase-1 order; e: real-only interval; f: answered-pair denominator |
| C2-6 | **Fixed.** Zero-error thresholds print 6 decimals. The header says coverage is of answered items and that the "all" slice pools correlated answers |
| C2-7 | **Fixed.** `student-training.md` §5 defines a student's CONFIDENT_WRONG as a wrong answer with option p ≥ t\* frozen on VAL, with coverage beside it |

## P2: reviewer D (distillation and provenance)

| id | resolution |
| --- | --- |
| D-15 | **Fixed.** Teacher outputs join on (qid, mode, render SHA-256) via `--teacher-pool`. Outputs on another drawing are dropped and counted. Verified: 3 dropped (`inset_upper` s0–s2 A), 39 joined |
| D-16 | **Fixed.** `--sg-test` and `--sg-sealed` are required, and each must contain its split |
| D-17 | **Fixed.** §4's "default processor" sentence is corrected (the probe ran at 1,024 px). The §1 example is a mode-D, mining-slice, two-option line. The nonexistent `--teacher` path is removed, with the screen named instead. SEALED is 200–800 questions and 50–100 drawings per class. Route A's VRAM is itemised (D-9) |
| D-18 | **Fixed.** "3 pairs × 7 families"; chance ≈ 45 %; Result 1 is a point estimate and only the gap to Qwen3-VL-2B is established; the recommendation keeps "Q4_K_M, CPU" and no longer says "reads worse than the 2B students" |
| D-19 | **Fixed.** The recommendation calls 005J's pilot a from-scratch 1.07 M-parameter micro-referee and keeps the transfer question as a risk |
| D-11 residual | **Fixed.** `vrgen2.py` refuses more than 1,000 pairs per family or more than 10 families, which would overlap seed ranges |
| D-4 residual | **Fixed.** `student-training.md` §5 scores mode-A context pairs per pair |

## P2: reviewer E (Android runtime)

| id | resolution |
| --- | --- |
| E-R2-1 | **Fixed.** Standalone D is the cold-E bound (≤ 33.3 / 49.1 / 57.0 / 61.4 s), with the fit beside it and the reason. The image-share wording says it includes the LM's work, so the tower alone is less (34–77 %, reviewer E). The median-wall column is labelled cache-aided (E-1) |
| E-R2-2 | **Fixed.** The runtime matrix and §5 say the LLM file counts in full because arm64 repacks Q4_K / Q8_0 into anonymous memory |
| E-R2-3 | **Fixed.** `environment.md`: two container restarts (00:38 at 322, ≈ 01:29 at 431; the boot is 01:29), three cgroup kills (smoke check, teacher, probe), and the SmolVLM2 crash. The report's "three restarts" is corrected |
| E-R2-4 | **Fixed.** §5: only the smallest Qwen3-VL-2B, InternVL and SmolVLM2 packs fit 1.5 GB as two files. Qwen3-VL-4B's 2.50 GB LLM and every as-run Q8_0 LLM need shards |
| E-R2-5 | **Fixed.** See F2-6 / F2-7: strict publisher-bytes check (a `%PDF` prefix needs `%%EOF`, a JPEG its EOI, and anything else must be NUL-free UTF-8); a 32 MiB cap on every tracked file; `.ptl`, `.msgpack`, `.7z`; a committed negative test on synthetic bytes |
| E-R2-6 | **Fixed.** The phone paragraph no longer says the figures exclude the encoder, and it mentions the QAIRT rows |
| E-R2-7 | **Fixed.** `quantised-sizes.json` uses `mradermacher/InternVL3_5-2B-GGUF@f39c9577…` (342,398,560 B), re-read live |
| E-R2-8 | **Fixed.** `environment.md` and `teacher-feasibility.md` say Q8_0 was not attempted and might have fit (≈ 12.1 GB, reviewer E) |
| E-R2-9 | **Fixed.** The phone range is cited to reviewer E's round-1 report, SmolVLM2 is 1.71 GB, and the probe headroom is given in consistent units. On disk: the stage's own 2.7 GB converted InternVL GGUF was deleted (its SHA-256 is in the manifests), freeing space |

## P2: reviewer F (licensing and isolation)

| id | resolution |
| --- | --- |
| F2-1 | **Fixed.** Stage report §9 and the recommendation give InternVL3.5's "Built with Qwen" as a counsel question, not a duty |
| F2-2 | **Fixed.** "reasonably believes" is restored in §8, §9 and the recommendation |
| F2-3 | **Fixed.** "≈ 77.5 % of SmolVLM2's declared fine-tuning mixture" |
| F2-4 | **Fixed.** `licensing-matrix.md` §3.5 records the SmolLM2-360M-Instruct → smol-smoltalk → Llama-3.1-405B chain and the Llama 3.1 §1.b.i clause, and §4 lists its reach as a counsel question. Repeated in the stage report and recommendation |
| F2-5 | **Fixed.** `manifest.py`, `model-manifest.json` and `gemma-matformer.md` say no Hugging Face credential exists or was created, and that the platform's own session tokens were not used |
| F2-6 | **Fixed.** The isolation test walks vendored `third_party/` trees for native VLM runtimes and weight files. It checks `apps/*/tools`, and it checks every npm manifest for VLM-runtime dependencies |
| F2-7 | **Fixed.** A negative test on synthetic disguised-weight and disguised-publisher bytes is committed. `history_gate.sh` now refuses picture magic bytes (PNG, JPEG, GIF, WebP, TIFF) outside the pre-005J publisher bytes, so `PROJECT_STATUS.md`'s claim is now true |
| F2-8 | **Fixed.** The mirror branch was brought up to date at round 2 and carries the final HEAD. The report and `PROJECT_STATUS.md` say "mirrored at checkpoints" |
| F2-9 | **Fixed** with D-15 |
| F2-10 | **Fixed** with D-17 |
| F2-11 | **Fixed.** The recommendation's licensing reason names route B (no known blocker beyond undisclosed data), and the caveats say route A is CONDITIONAL on counsel |

## Gates after the fixes

- `freeze_check.sh`: IDENTICAL against the stage-base baseline.
- `history_gate.sh`: PASS, now including the picture check.
- `research-isolation.test.ts`: 25 / 25.
- The production diff since `47811e0` is empty.

Full CI on the final HEAD is in the stage report's handoff.
