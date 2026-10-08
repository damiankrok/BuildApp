# 005M post-review, round 2: Reviewer C (safety calibration)

**State reviewed:** HEAD `a7e1ece`, with every run finished.

**Inputs:**
- the final `bakeoff-tables.md`, `calibration.json`, `teacher-comparison/`, `teacher-feasibility.md`,
  `teacher-summary.json`, `student-training.md`, `recommendation.md`, the stage report and `PROJECT_STATUS.md`;
- the raw `runs/*.jsonl`, the work directory's `items/items.jsonl` and `items-teacher-p1.jsonl`;
- `excluded-items.json`;
- `score.py`, `student_dataset.py` and `teacher_summary.py`.

**Method.**
- No model was run. Every number below was recomputed with light `nice -n 19` Python from the raw answers, on the
  amended (152 / 30 / 24) question sets.
- Cluster bootstraps use `score.py`'s clusters: real houses and synthetic scene pairs.
- The scripts are listed under "Reproduction" at the end.

**Counts: P0 = 0, P1 = 1, P2 = 6.**

**Recommendation check.** From the safety and calibration side, RETURN_TO_DETERMINISTIC_BODY_RELATION follows from
the measurements, and I agree with it. The case is argued under "Does the recommendation follow?".

---

## 1. Round-1 findings, verified against code and artifacts

| id | status | evidence |
| --- | --- | --- |
| C-1 stated-HIGH CWR is the error rate | **RESOLVED** (one residual, C2-4) | See the C-1 note below the table |
| C-2 P80 without coverage | **RESOLVED** | See the C-2 note below the table |
| C-3 no risk–coverage / operating point | **PARTIAL** | See the C-3 note below the table |
| C-4 pass bar stated without its UB condition | **RESOLVED** | See the C-4 note below the table |
| C-5 pooled intervals assume independence | **RESOLVED** (residual in C2-6) | See the C-5 note below the table |
| C-6 counterfactual denominator | **RESOLVED** | `score.py` now has context pairs, local pairs and same-truth controls (1 in phase 2, left out). The mode-A context row is labelled "forced" in the table preamble |
| C-7 mirror/rotation denominator | **PARTIAL** | See the C-7 note below the table |
| C-8 student plan: constant HIGH, abstention-gameable stop | **PARTIAL** | See the C-8 note below the table |
| C-9 answer-token audit trail | **NOT RESOLVED (accepted as stated)** | See the C-9 note below the table |
| C-10 old-500M table mixed metrics | **RESOLVED** | The table leads with like-for-like P80 and says the probability read-outs differ. The stage report's summary sentence of it overclaims (C2-5b) |
| C-11 calibration pooled over populations | **PARTIAL** | See the C-11 note below the table |

**C-1.**
- `bakeoff-tables.md:6-8` states the identity, and every row carries "HIGH share" and "p ≥ 0.8 share".
- Stage report §4 has a HIGH share column and the sentence "The primary metric is in effect the error rate".
- `PROJECT_STATUS.md` says "CONFIDENT_WRONG ≈ wrong".
- Only `recommendation.md` sets the 30.9 % beside the 0.5 % gate without that caveat (C2-4).

**C-2.**
- The p ≥ 0.8 share among answered items is printed next to every P80 rate, so useful coverage can be read off.
- P80 ranks nothing.
- The read-out difference is stated in the intersection preamble (`bakeoff-tables.md:443`).

**C-3.**
- Done: a fixed-threshold curve with Wilson UB, the in-sample zero-error region (labelled "not a validated operating
  point", `score.py:149`), and agreement filters.
- Not done: freezing a threshold on one split and reporting it on another. The held-out measurement is still
  missing. I computed it (C2-2), and it confirms the caveat.
- Not done: the harm conditional on the analyzer's answer. This is moot, since nothing is adopted.

**C-4.** `student-training.md:180-191` now has:
- "as the 95 % upper bound on n questions";
- n ≥ 598 (exact) / 765 (Wilson) per class, and ≈ 1,130 with one error;
- the real classes have 2–17 questions, so 0/17 gives a UB of ≈ 18 %;
- ≥ 381 flip-free pairs against the 14 the bake-off has;
- "can only be screened here".

I verified the per-class real counts on the amended set: 2, 3, 3, 5, 7, 8, 10, 12, 15, 15, 17, so "2–17" is right.

**C-5.**
- A cluster bootstrap now covers accuracy and CWR, with paired model differences.
- §3 says InternVL's first-place gap is inside the intervals.
- Phase-2-only rows were not added. That costs little, because the phase-1 decision is robust.

**C-7.**
- The 005J denominator is added. InternVL drops to 86 % (12/14) in mode B under it.
- "Agree-but-wrong" is not printed.
- I computed it for phase 2. Pairs that agree on a wrong answer number 2–5 per mode; pairs that flip number 0–1. That
  supports the stage report's "consistently wrong, not noisy", but on only 14 pairs.

**C-8.**
- Done:
  - selection is on VAL CWR at an 80 % coverage floor;
  - any threshold is frozen on VAL;
  - the `student_dataset.py` docstring is softened ("whether that carries over to real sheets is untested").
- Still open: every non-abstain target has confidence HIGH (`student_dataset.py:92`), so a student's stated CWR will
  again equal its error rate. The evaluation contract's "CONFIDENT_WRONG_RATE at the VAL-frozen operating point"
  (`student-training.md:171`) does not say which confidence it gates on (C2-7).

**C-9.**
- No record stores the token position.
- The invariants still hold on every final record, and I rechecked them:
  - arg-max(`enumProbs`) equals the answer in 835/835 InternVL, 835/835 Qwen3-VL-4B and 120/120 teacher records;
  - `enumMass` is 1.0 for the teacher.

**C-11.**
- REAL/SYNTH rows were added.
- Not done:
  - a split by option count;
  - a count of answered rows without a probability. There are zero in every run, so it changes nothing.

## 2. Round-2 checks from my round-1 report

1. **The HIGH share is next to every CWR, and the error-or-abstain reading is stated.** Done in the tables and the
   stage report; the recommendation lacks it (C2-4).
   - No 005M CWR is set beside a 005J CWR as a like-for-like comparison. The intersection table uses P80.
2. **Risk–coverage for every phase-2 model.** Present.
   - Qwen3-VL-4B's phase-1 zero-CW region at p ≥ 0.999 (19 answers, 0 wrong) **did not survive**. On the 122
     phase-2-only questions, the same threshold accepts 114 answers with **12 wrong** (10.5 %; 9 SYNTH_GLOBAL, 2
     REAL_DEV, 1 SYNTH_CF; 8 distinct questions).
   - Thresholds are still not frozen on one split (C2-2).
3. **InternVL under the 005J denominator.**
   - Mode B: 9/10 → 12/14 (86 %).
   - Mode A: 11/11 → 14/14 (three pairs are UNRESOLVED on both sides).
   - The drop is small.
4. **Nobody reads 0/835 at p > 0.99959 as meeting the bar.**
   - No document does.
   - `grep` finds no "0.46 %" and no "≤ 0.5 %" claim outside the pass-bar definition.
   - Every in-sample region is labelled as such.
5. **The teacher.**
   - HIGH share 118/118. Two UNRESOLVED answers, both LOW. `enumMass` 1.0.
   - It is **over-confident**:
     - the p ≥ 0.9 bin holds 82 answers with mean p 0.977 and accuracy 75.6 %;
     - ECE is 0.31 in all modes and in D.
   - `agrees` gating holds. `student_dataset.py:97-98` keeps `probs` only when the arg-max equals the target, and never
     makes a teacher answer a target.
   - Its risk–coverage is reported (`teacher-comparison/tables.md`).
   - Its AUROC claim overreaches (C2-1).
6. **Student wording.** Partly updated (C-8 above, C2-7).
7. **Operating point if ADOPT or TRAIN.** Not applicable, since the recommendation is neither.
8. **Counterfactual split.** Done (C-6).

## 3. Numbers in the stage report, recommendation and PROJECT_STATUS checked in my area

Every figure below matches the artifacts and my recomputation from the raw runs.

**Phase 1** (stage report §3): 55.3 / 21.3 (12–36), 73.3 / 26.7 (14–45), 66.7 / 32.0 (21–46), 42.0 / 53.3 (44–64).

**Phase 2** (stage report §4):

| model | exact accuracy | CWR (Wilson; cluster) | all modes: accuracy / CWR | HIGH share | UNRESOLVED |
| --- | --- | --- | --- | --- | --- |
| Qwen3-VL-2B D | 69.1 % (59–76) | 30.9 % (24–39; 24–41) | 65.1 / 34.7 | 100 % | 0 / 760 |
| Qwen3-VL-4B C | 67.8 % | 31.6 % | 62.8 / 35.0 | 100 % | 14 / 760 |
| InternVL3.5-2B C | 53.9 % | 32.9 % | 50.5 / 35.7 | 100 % | 105 / 760 |

**Real / human / synthetic, mode D:**

| model | REAL | REAL, human truth | SYNTH |
| --- | --- | --- | --- |
| Qwen3-VL-2B | 77 / 23 | 84 / 16 | 55 / 45 |
| Qwen3-VL-4B | 74 / 26 | 81 / 19 | 51 / 49 |
| InternVL3.5-2B | 61 / 32 | 67 / 27 | 42 / 44 |

**Calibration and agreement:**
- AUROC in D: 0.556 / 0.697 / 0.592, so "0.56–0.70" is right.
- Qwen3-VL-2B zero-error region in D: p > 0.99711, 9/152 = 5.9 %.
- All-five-agree: 30/105 = 28.6 % wrong.
- Qwen3-VL-4B real D at p ≥ 0.99: 42 of 97 accepted, 1 wrong, selective risk 2.4 %.

**Real-D confidently wrong:** 22/97 = 22.7 %, and 11/70 = 15.7 % on human truth.

**Old 500M intersection:** right / P80 = 62 / 14, 58 / 12 and 47 / 7, against 19 / 10.

**Teacher** (`teacher-feasibility.md` Result 1, all against `teacher-comparison/tables.md`):
- accuracy 57.5 % (33–74), CWR 40.8 %, D 58.3 / 41.7;
- AUROC teacher 0.84 / 0.95, 2B 0.58 / 0.46, 4B 0.78 / 0.80, InternVL 0.63 / 0.60, SmolVLM2 0.38 / 0.35;
- TRAIN: 20/42 agree, 20/21 same answer, AUROC 0.577, mean p 0.89 / 0.85.

Numbers that are right but **attributed or worded wrongly** are in C2-5.

## 4. New findings

### C2-1 (P1): The teacher's "probability ranks its own answers well" (AUROC 0.84 / 0.95) is overclaimed, and the stage report drops the caveat and the contradicting measurement

**Evidence.**

The claims:
- Stage report §6, line 175: "Its option probability ranks well: AUROC 0.84, and 0.95 in D." It carries no sample
  size or caveat.
- `teacher-feasibility.md:45` (bold): "Its probability ranks its own answers well … That is the one property worth
  keeping, as a soft-preference signal". It does add "on 24 questions it is not established".

What stands behind them:
- **Size.**
  - Mode D's 0.95 is computed on 24 answers: 14 right, 10 wrong, 10 clusters.
  - Morelach alone contributes 8 of the 24 questions (40 of the 120 records).
- **Part of the all-mode AUROC is a between-set effect.**
  - The teacher is wrong on all 20 GAPSET_DEV records (A00 / D00), at lowish p.
  - 4 of the 6 lowest-p wrong answers in D are GAPSET.
  - Restricting the AUROC to right/wrong pairs from the same source set lowers all modes from **0.84 to 0.74**.
  - For D, only 19 within-set pairs exist.
- **It is over-confident.**
  - p ≥ 0.9: mean p 0.977 against accuracy 0.756 (82 answers).
  - ECE 0.31 over all modes, the worst of the five models on this subset. In D only SmolVLM2's 0.32 is worse.
  - Three wrong answers in D sit at p ≥ 0.91, against 0.9135, 0.9670 and 0.9674.
- **It is contradicted where the property would be used.**
  - Soft preferences would be read on generator-labelled TRAIN items.
  - There the same teacher's option probability separates agreeing from disagreeing answers with **AUROC 0.577**:
    mean p 0.894 against 0.847, on 42 items (`teacher-summary.json`, `teacher-feasibility.md` Result 2).
  - The stage report §6 quotes 0.84 / 0.95 and omits 0.58.

**Why it matters.**
- This is the only positive calibration claim in the stage. It is the property a reopened AI route would reach for
  first: "use the 8B's probability as a soft target or a gate".
- On the evidence, the teacher's probability ranks *which source set is hard* on 24 development questions. It does not
  rank its answers on the drawings it would label.
- The recommendation does not rely on it, and the enum is unaffected. The stage report sentence is nevertheless a
  documented claim stronger than the evidence.

**Fix.**
- Stage report §6: "On the 24 shared questions its option probability separates right from wrong (AUROC 0.84; 0.95 in
  D on 24 answers); within a source set 0.74. On the 42 TRAIN items it would label, 0.58, near chance, and its top bin
  is over-confident (p ≥ 0.9: 76 % right at mean p 0.98)."
- `teacher-feasibility.md`: drop "the one property worth keeping as a soft-preference signal", or make it conditional
  on the TRAIN AUROC.

### C2-2 (P2): The in-sample zero-error regions were never checked out of sample; a cheap held-out check shows they do not hold

**Evidence.**
- The documents correctly call every zero-error region in-sample:
  - `bakeoff-tables.md:385,427`;
  - stage report §4 ("not a validated operating point");
  - `recommendation.md` ("In-sample, its zero-error region covers 5.9 %").
- Round-1 C-3 also asked for a threshold frozen on one split and reported on another. I did that with `a2.py` and
  `a9.py`, in mode D on the amended 152 questions:

| model, slice | zero-error threshold frozen on the 30 phase-1 questions → the 122 phase-2-only questions | leave-one-cluster-out zero-error threshold | random 2-fold cluster split × 1,000: splits with ≥ 1 held-out CW |
| --- | --- | --- | --- |
| Qwen3-VL-2B, all | p > 0.9881 → 18 accepted, **4 wrong** | 10 / 152 accepted, 1 wrong | 51 % |
| Qwen3-VL-2B, real | p > 0.8871 → 47 accepted, **12 wrong** | 11 / 97, 1 wrong | 53 % |
| Qwen3-VL-4B, all | p > 0.9986 → 35 accepted, **5 wrong** | 15 / 152, 1 wrong | 50 % |
| Qwen3-VL-4B, real | p > 0.9048 → 54 accepted, **10 wrong** | 29 / 97, 1 wrong | 52 % |
| InternVL3.5-2B, all | p > 0.8291 → 18 accepted, **6 wrong** | 4 / 152, 1 wrong | 55 % |

- Qwen3-VL-4B, all modes, at p ≥ 0.999: 0 wrong of 19 on the phase-1 questions, and **12 wrong of 114** on the
  phase-2-only questions.

**Why it matters.**
- A "zero-error region" is the number a later stage will be tempted to quote as a gate.
- Measured out of sample, it fails about half the time and its coverage shrinks to a few percent. That is stronger
  and cleaner support for "no operating point exists" than the in-sample caveat alone, and it costs nothing.

**Fix.**
- Add one held-out line to stage report §4 and to the recommendation's ADOPT rejection. For example: "frozen on phase
  1 and applied to the 122 phase-2-only questions, Qwen3-VL-4B's p ≥ 0.999 region goes from 0/19 to 12/114 wrong".
- Optionally, add a `heldOut` block to `risk_coverage()`: threshold from phase 1, evaluated on phase 2 only.

### C2-3 (P2): The "best in-sample real-D point" (Qwen3-VL-4B, p ≥ 0.99: 43 % coverage, 2.4 % risk) needs its composition, and it is the one lead the recommendation should name

**Evidence** (`a3.py`).

What the 42 accepted real-D answers (1 wrong) are made of:
- They come from **8 houses**, and **9 of the 42 are mirror twins** of other accepted items.
- **29 / 42** are also right under the image-free first-option rule.
- **10 / 42** come from one-sided classes where the answer never varies on the real set: GARAGE_BODY 5/5, OPEN_SIDE
  3/3, BAY 2/2.
- Coverage is **zero** on GAP_KIND (0/17), OUTER_BOUNDARY (0/12), CANOPY (0/8) and STOREY (0/3).

What the risk looks like with the correlation counted:
- Cluster-bootstrap selective risk is [0, 9.7 %].
- As CW per asked question it is 1/97, with Wilson UB 5.6 %. That is 11× the gate.

What does hold out:
- 0.99 is one of the pre-fixed thresholds.
- On the phase-2-only real questions it still gives 34 accepted, 1 wrong.

What does not:
- The choice of this cell among 3 models × 3 slices × 8 thresholds was made after the results were seen.

**Why it matters.**
- This is the strongest selective signal in the stage (real-D AUROC 0.78).
- The recommendation's "Its probability does not help" is true of Qwen3-VL-2B, the model it is written about. It reads
  as true of every model, which it is not.
- Without the composition, a reader could take "43 % at 2.4 %" as a general operating point. It covers the easy, often
  one-sided classes and none of the classes the motivating failure belongs to.

**Fix.**
- Add the composition sentence to stage report §4.
- In `recommendation.md`, under "What 005M leaves ready", add: "the only selective signal is Qwen3-VL-4B's option
  probability on real sheets in D (AUROC 0.78). At p ≥ 0.99 it covers 43 % with 1 error, but only on
  BODY / TERRACE / WALL / one-sided classes, from 8 houses. It is a hypothesis for a frozen real set, not an operating
  point."

### C2-4 (P2): The recommendation sets a stated-HIGH CWR beside the 005J gate without saying it is the error rate

**Evidence.**
- `recommendation.md`, ADOPT bullet 1: "CONFIDENT_WRONG_RATE 30.9 % … The 005J gate is 0.5 %."
- 005J's gate is defined on a probability-gated, per-class upper bound.
- 005M's 30.9 % is the plain error rate, since HIGH share is 100 %. The C-1 fix put this caveat into the tables and
  the report, but not into the recommendation.
- The conclusion is unaffected. Any gate lowers the number, and the P80 rate is still 21.1 % (32/152) in D.

**Fix.** Append "(= its error rate: it states HIGH on every answer; P80 21 %)".

### C2-5 (P2): Wording in the stage report and recommendation that is stronger than, or different from, the numbers

| # | where | what it says | what the numbers say | fix |
| --- | --- | --- | --- | --- |
| a | §4 "Consistency" | Mirror consistency is 93–100 % on the 14 mirror pairs | InternVL in B: 90 % (9/10), and 86 % (12/14) under 005J's denominator | "86–100 % (93–100 % in C, D and E)" |
| b | §4, old-500M | Far more accurate, and no less often confidently wrong | True for both Qwens (14 and 12 against 10). InternVL D has **7** (5 / 1 / 2 / 7 / 6 across A–E), because its probabilities rarely reach 0.8 (C-2) | "…; the Qwens are no less often P80-wrong; InternVL is lower only because its probabilities are flat" |
| c | §12 | Proving the 0.5 % bar needs a real evaluation set an order of magnitude larger | 11 classes × 598–765 = 6,600–8,400 questions against 97 today: **≈ 70–90×**, before a separate threshold-freezing split. Two orders of magnitude | "about two orders of magnitude larger (≥ 598 per class)" |
| d | §3 "Robustness" | The order is the same … under an accuracy ranking | Under accuracy the order is Qwen3-VL-2B, Qwen3-VL-4B, InternVL, SmolVLM2. Only the advancing *set* is the same | "the same three advance under an accuracy ranking" |
| e | recommendation, NO_AI_GAIN row | beats the image-free prior on real development questions: +2.0 … +18.5 points overall | +2.0 … +18.5 is the all-152 interval. Real-only, 2B D − first-option is **+15.5 pp [+2.7, +27.5], P > 0 = 0.99** (17 clusters, my bootstrap); human truth +18.6 [+5.5, +33.9]. The conclusion holds | quote the real-only interval, or say "overall (all 152)" |
| f | §4 global-context | The same answer is given to both members in 80–100 % of them | The denominator drops pairs with an UNRESOLVED member: InternVL D 7/7, of 10 pairs | add "of the pairs where both members answered" |

**Why it matters.** Each item is small. Items (b) and (c) understate the risk or the remaining distance, which is the
direction a safety review should not let pass.

### C2-6 (P2): Presentation defects in the risk–coverage tables

**Evidence.**
- **An impossible threshold is printed.** Qwen3-VL-4B's zero-error region prints as "p > 1.0000"
  (`bakeoff-tables.md` phase-2 rows ALL_MODES and D). The true maximum wrong p is 0.999956.
- **Coverage is relative to answered items, not to questions asked.** `score.py:139-145` takes `len(rows)` after
  dropping UNRESOLVED. For InternVL in D, "cov 100 %" means 137 of 152. The header does not say so.
- **The bracketed upper bounds assume independent rows.** The "≤" values on ALL_MODES rows are row-level Wilson bounds
  over five correlated modes (the C-5 residual).

**Fix.**
- Print 6 decimals, or "p ≥ max wrong (0.99996)".
- Say "coverage of answered items" in the header, or switch to questions asked.
- Mark the ALL_MODES brackets as row-level.

### C2-7 (P2): The student evaluation contract does not say which confidence its CONFIDENT_WRONG_RATE gates on

**Evidence.**
- `student_dataset.py:92` targets confidence HIGH on every decidable line.
- `student-training.md:171` asks for "CONFIDENT_WRONG_RATE at the VAL-frozen operating point".
- Under `score.py`'s definition (stated HIGH), a trained student's CWR is again its error rate (C-1). "Operating point"
  implies an option-probability threshold, but the contract does not define it.

**Fix.** Define it as "wrong ∧ option p ≥ t*, with t* frozen on VAL", and always report coverage at t* beside it.

---

## 5. Does the recommendation follow?

**Yes. RETURN_TO_DETERMINISTIC_BODY_RELATION is the enum the calibration evidence supports.**

**ADOPT_LOCAL_VLM_PILOT.** Rejected correctly.
- Stated confidence carries no information: HIGH share is 100 %.
- The option probability's AUROC in D is 0.56–0.70, and synthetic is at chance.
- Every in-sample zero-error region fails held-out in about half of cluster splits (C2-2).
- The best selective cell (C2-3) covers only easy or one-sided classes, at a UB 11× the gate.
- The pass bar needs about 70–90× more real data than exists.

**TRAIN_BUILDPLAN_STUDENT.** "Not now" is correct.
- No compute exists.
- The pass bar cannot be demonstrated here.
- The teacher's probability does not separate on TRAIN (AUROC 0.58).

**OTHER_MEASURED_RESULT** ("selective Qwen3-VL-4B referee on real sheets"). Not supported.
- It rests on one post-hoc cell, from 8 houses, with zero coverage on the classes of the motivating failure.
- It is worth naming as a lead (C2-3), not as the outcome.

**NO_AI_GAIN.** "Too strong" is right.
- On real questions, Qwen3-VL-2B D beats the first-option prior by +15.5 pp [+2.7, +27.5].
- Qwen3-VL-4B C beats it by +14.4 pp [+3.4, +24.8].
- The gain exists; it is not safe.

**CLOUD_TEACHER_ONLY.** Rejected correctly on the evidence available.
- Paired against Qwen3-VL-2B on the same 24 questions, the teacher's accuracy is lower: 95 % [−34.7, −6.4] pp, with 10
  clusters.
- The decisive evidence is the TRAIN pair-insensitivity: 20 of 21 pairs get the same answer.

**Safety overclaims in the final documents.** None changes a conclusion.
- C2-1 is the one real one. C2-5b and C2-5c understate.
- No document claims a calibrated or safe model.
- No document reads an in-sample region as meeting the bar.

## 6. Checked and OK

- **Answer-token invariants** hold on all final runs. The answer equals arg-max(`enumProbs`) in 835/835, 835/835 and
  120/120 records, and the teacher's `enumMass` is 1.0.
- **Risk–coverage cells reproduce exactly.** I recomputed every phase-2 D and real-D cell for three thresholds × three
  models, and every zero-error threshold and count.
- **The agreement filters reproduce.** C+D+E: 2B 45/141, 4B 41/133, InternVL 46/118. All five: 30/105, 24/86, 31/91.
- **Teacher AUROCs, accuracies and CWRs** in `teacher-feasibility.md` match `teacher-comparison/tables.md` and my
  recomputation. Students on the 24 questions: 2B 0.575 / 0.463, 4B 0.775 / 0.796, InternVL 0.633 / 0.600, SmolVLM2
  0.376 / 0.346.
- **Teacher gating.** `student_dataset.py:97-98` keeps `probs` only where `agrees`. A disagreeing output becomes only
  `hardExample`, and a target is always the generator's.
- **Pass-bar arithmetic.** 598 (exact one-sided), 765 (Wilson), ≈ 1,130 (Wilson, one error), 381 flip-free pairs and
  a UB of ≈ 18 % at 0/17 are all correct.
- **No in-sample zero-error figure is presented as validated.** Every occurrence carries "in-sample".
- **`PROJECT_STATUS.md`'s 005M summary.** Every figure matches, and its "No probability threshold approaches the
  0.5 % gate" holds on upper bounds.

## Reproduction

The scripts are in the session scratchpad,
`/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/r2c/`:
- `load.py` is the shared loader. It applies `excluded-items.json` and uses `score.py`'s cluster rule.
- `a1.py` reproduces the risk–coverage cells.
- `a2.py` runs the held-out threshold checks (C2-2).
- `a3.py` gives the composition of the 4B real-D 0.99 point (C2-3).
- `a4.py` and `a5.py` give the teacher AUROC with a cluster bootstrap and the within-set AUROC (C2-1).
- `a6.py` gives the per-class real counts.
- `a7.py` gives mirror agree-but-wrong.
- `a8.py` gives the real-only model − prior.
- `a9.py` checks whether the 4B phase-1 p ≥ 0.999 region transfers.
- `a10.py` gives the paired teacher − 2B difference.

Run each with `nice -n 19 python3 -I <script>` from that directory. All of them read only
`/home/user/work005m/items` and the committed `runs/*.jsonl`.
