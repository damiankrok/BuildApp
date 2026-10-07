# 005M post-review, round 1: Reviewer C (safety calibration)

Scope: the confident-wrong metric, stated confidence under grammar decoding, the option-probability read-out,
`calibration.json`, selective prediction, twin and counterfactual consistency as safety signals, and safety or calibration
wording. The state reviewed is interim: phase 1 for all four models, phase 2 for Qwen3-VL-2B only, and Qwen3-VL-4B phase 2
partly done (190 lines when read).

Inputs:
- `research/analyzer-005m/{score.py,bench.py,common.py,summarize.py,student_dataset.py}`
- `stage-reports/artifacts/analyzer-005m-vr2/{runs/*.jsonl,phase1-advancement.json,student-training.md,input-modes.md}`
- `/home/user/work005m/{items/items.jsonl,runs/*,score-interim/*}`
- 005J's `research/analyzer-005j/score.py`, `vlm_bench.py`, and `stage-reports/artifacts/analyzer-005j/{vlm-bakeoff.md,training-plan.md,recommendation.md}`
- the llama.cpp source at the runtime commit (`/home/user/work005m/llama.cpp`, 988190680d5a)

No model was run. All numbers below come from light `nice -n 19` Python over the committed or work-dir JSONL. The
reproduction script is at the end.

**Counts: P0 = 0, P1 = 4, P2 = 7.**

---

## Findings

### C-1 (P1): The primary CONFIDENT_WRONG_RATE is the error rate under another name

**Evidence.** `score.py:10` and `:57` define confident-wrong as "wrong and stated confidence == HIGH". Stated confidence
in the runs:

| run | HIGH | MEDIUM | LOW | UNRESOLVED answers |
| --- | --- | --- | --- | --- |
| p1 smolvlm2-2.2b | 160/160 | 0 | 0 | 17, all with HIGH |
| p1 internvl3.5-2b | 160/160 | 0 | 0 | 43, **all with HIGH** |
| p1 qwen3-vl-4b | 156/160 | 0 | 4 | 4 (the 4 LOW are the 4 UNRESOLVED) |
| p1 qwen3-vl-2b | 160/160 | 0 | 0 | 0 |
| p2 qwen3-vl-2b | 834/835 | 0 | 1 (wrong, p = 0.53) | **0** |

Two consequences:
- Wherever a model answers, `cw` is the same as `wrong`, so CONFIDENT_WRONG_RATE = wrong / asked = 1 − exact accuracy −
  UNRESOLVED rate − failure rate.
  - Qwen3-VL-2B phase 2: 299 confident-wrong = 300 wrong − 1 LOW.
  - In mode D, stated-HIGH CW is 53 and wrong is 53.
- "Accuracy when HIGH" in `tables.md` equals overall accuracy for every model.

The confidence is decoded after the answer. Schema order is answer then confidence, and every raw reply has that order.
It is therefore a post-hoc self-rating conditioned on the letter already chosen. It never moves, even when:
- InternVL says it cannot decide (UNRESOLVED with HIGH, 43 of 43);
- the crop provably cannot decide the question. On the 38 context-dependent A_CROP_ONLY questions, Qwen3-VL-2B was right on
  17 and wrong on 21, all HIGH, with mean P(UNRESOLVED) 0.028.

The prompt's "Use HIGH only when the drawing settles the question" (`common.py:157`) had no effect.

**Why it matters.** The metric's name promises a confidence filter that does not exist in these models.
- The pre-registered phase-1 ranking (`phase1-advancement.json`) is in fact a ranking by "wrong or abstain" rate.
- InternVL ranks first because it abstains on 27 % of questions, not because it knows when it is right. Its resolved
  accuracy is 71 %, against Qwen3-VL-2B's 72.5 % at 100 % coverage.
- 005J's CONFIDENT_WRONG_RATE meant p ≥ 0.80 on the model's own probability (`analyzer-005j/score.py:7`). The two stages'
  primary numbers are not comparable.
  - Example: 005J SmolVLM2-500M ENUM_SCORE 7.2 % against 005M Qwen3-VL-2B 35.8 %.
  - The shared name invites exactly that comparison.

The rule was pre-registered and applied as written, and smol's exclusion holds under every metric except P80 (C-2).
That is why this is not a P0.

**Fix.**
- In the stage report and `recommendation.md`, state the HIGH share and the identity CWR(stated) = wrong / asked. Call it
  "error-or-abstain rate", or keep the name with that caveat on the same line.
- Never set a 005M CWR beside a 005J CWR.
- Have `summarize.py` print `highShare` next to every CWR column. It is already in `calibration.json`.

### C-2 (P1): The P80 secondary is reported without useful coverage, and alone it rewards flat probabilities

**Evidence.**
- `score.py:57` gives P80 = wrong and own option probability ≥ 0.80. `summarize()` (`:60-68`) and `tables.md` report only
  the P80 rate.
- 005J's `tally()` always reported USEFUL_COVERAGE = confident-right / total and confidentPrecision beside it
  (`analyzer-005j/score.py:49-59`). 005M dropped both.

Phase 1, all modes, n = 160:

| model | max option p reached | P80 rate (tables) | useful coverage at 0.80 | AUROC |
| --- | --- | --- | --- | --- |
| smolvlm2-2.2b | 0.743 | **0 % (0/160)** | 0 % | 0.394 (below chance) |
| internvl3.5-2b | 0.912 | 1.9 % (3/160) | 5.6 % | 0.672 |
| qwen3-vl-2b | 0.99998 | 12.5 % (20/160) | 51.2 % | 0.614 (phase 2) |
| qwen3-vl-4b | 0.99999 | 18.8 % (30/160) | 50.0 % | 0.732 |

What this shows:
- A model whose probabilities never reach 0.80 can never be confident-wrong, and it is never useful either.
- Ranked by P80, SmolVLM2-2.2B, the worst reader with AUROC below 0.5, comes first. Qwen3-VL-4B, which has the best AUROC
  and the largest zero-error high-p region (C-3), would be the one dropped.
- InternVL's reliability bins show it is *under*-confident: the 0.6–0.7 bin is 87.5 % accurate. Qwen's top bin is
  over-confident: 0.9–1.0 has mean p 0.968 and accuracy 71.5 % on 411 answers.
- A single 0.80 bar is therefore not comparable across models.

The read-out also differs from 005J's.
- 005J ENUM_SCORE: the full-sequence probability of each semantic answer word plus its closing quote, normalised over the
  enum (`analyzer-005j/vlm_bench.py:12-13`).
- 005M: the first-token probability of a *letter* A/B/C, plus the first-token prefixes of UNRESOLVED.

So "005J's rule" (`score.py:11`, `tables.md` header) means 005J's threshold applied to a different quantity.

**Fix.**
- Add `usefulCoverage` and `confidentPrecision` (selective risk) to `summarize()` and print them next to every P80 rate.
- Label P80 "005J's 0.80 threshold on 005M's letter-token probability".
- Do not rank or select on P80 alone.

### C-3 (P1): The only deployable gate is option probability, and no reported metric gives an operating point

**Evidence.** Stated confidence is constant (C-1), so a referee could only gate on option probability, cross-mode
agreement or twin agreement. `score.py` produces no risk–coverage curve; 005J had one in `vlm-bakeoff.md` §5. I computed it
from the raw runs.

These thresholds are chosen in-sample, after seeing the wrong answers, so they are optimistic. "Selective risk" is
CW / accepted.

**Qwen3-VL-2B, phase 2 (167 questions × 5 modes):**

| subset | t ≥ 0.80 | t ≥ 0.90 | t ≥ 0.95 | t ≥ 0.98 | t ≥ 0.99 | t ≥ 0.999 | in-sample zero-CW coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| all modes (n = 835): accepted / CW / selective risk | 554 / 167 / 30.1 % | 411 / 117 / 28.5 % | 297 / 79 / 26.6 % | 195 / 44 / 22.6 % | 145 / 34 / 23.4 % | 30 / 3 / 10.0 % | 18/835 = **2.2 %** (needs p > 0.99959) |
| mode D (n = 167) | 120 / 36 / 30.0 % | 90 / 27 / 30.0 % | 65 / 20 / 30.8 % | 34 / 7 / 20.6 % | 19 / 3 / 15.8 % | 4 / 0 / 0 % | 9/167 = **5.4 %**, Wilson UB of CWR 2.25 % |
| mode D, real only (n = 97) | 76 / 15 / 19.7 % | 57 / 12 / 21.1 % | 44 / 11 / 25.0 % | 21 / 2 / 9.5 % | 13 / 1 / 7.7 % | 3 / 0 / 0 % | 9/97 = **9.3 %**, UB 3.81 % |

Reading the table:
- Selective risk stays at about 20–30 % from p ≥ 0.80 to p ≥ 0.99. The probability barely separates right from wrong:
  - AUROC by mode: A 0.66, B 0.59, C 0.62, **D 0.56**, E 0.62.
  - Split by set: real 0.59–0.67, synthetic 0.49–0.59, which is chance.
  - The most accurate mode, D, has the worst ranking signal.
- In-sample CWR at ≥ 10 % coverage:
  - all modes: 1.92 % (UB 3.09 %);
  - mode D: 1.20 % (UB 4.26 %);
  - real mode D: 1.03 % (UB 5.61 %).
- Agreement gates do not filter errors:
  - All five modes unanimous: 111/167 accepted, 32 confident-wrong, selective risk 28.8 %.
  - Unanimous and min p ≥ 0.98: 7/167 accepted, 1 CW.
  - Real only, unanimous and min p ≥ 0.98: 4/97 accepted, 0 CW (UB 3.81 %).
  - Mirror agreement in mode D: 18/20 pairs agree, and 4 of those agree on the wrong answer.

**Phase-1 models (n = 160 = 32 × 5):**
- **Qwen3-VL-4B** is the only one with a sizeable clean region: p ≥ 0.999 accepts 19/160 (11.9 %), 0 CW, UB 2.34 %. That
  is 16.2 % in-sample zero-CW coverage.
  - The 30 new phase-2 lines read so far add 15 answers at p ≥ 0.999, all right. Recheck on the full 167 (Round 2).
- **InternVL** never exceeds p = 0.912. No threshold above 0.9 accepts anything.
- **SmolVLM2-2.2B** never reaches 0.75.
- **Qwen3-VL-2B** phase 1: 1/160 zero-CW coverage.

**A trap the final report must avoid.**
- Qwen3-VL-2B all-modes at t > 0.99959 gives 0/835 with Wilson UB **0.46 %**, which reads as "≤ 0.5 %". It is not
  evidence:
  - the threshold is in-sample;
  - the coverage is 2.2 %;
  - the bar is per class;
  - five modes of one question are not independent. At question level the effective n is about 167, so UB ≈ 2.25 %.

**Why it matters.** A referee that would override or confirm a deterministic decision needs a stated operating point:
threshold, coverage and an upper bound on CW. None is in the outputs, and the measured curve says no operating point with
non-trivial coverage exists for Qwen3-VL-2B.
- A recommendation of ADOPT_LOCAL_VLM_PILOT or TRAIN_BUILDPLAN_STUDENT that cites CWR or P80 without this curve would be
  unsupported.
- CWR also does not condition on the analyzer's own answer. The harmful cases are "override a correct decision" and
  "confirm a wrong one". 005J measured them with an oracle replay, and 005M has nothing equivalent. Mode E, which shows the
  analyzer's purple axes, moves Qwen3-VL-2B from right to wrong on 11 questions and from wrong to right on 4, relative to D.

**Fix.**
- Add a per-model, per-mode risk–coverage table to `score.py` and `tables.md`: thresholds 0.5–0.999, accepted, CW,
  Wilson UB, selective risk, useful coverage. Include real-only and per-class rows.
- Freeze any threshold on one split and report it on another. The in-sample zero-CW coverage is an upper bound, not a
  result.
- State in the recommendation that no measured operating point reaches the 005J bar (C-4).

### C-4 (P1): The inherited pass bar is stated without its upper-bound condition, and the 97-question real set can never meet it

**Evidence.** `student-training.md:101-104` sets the bar as "CONFIDENT_WRONG_RATE ≤ 0.5 % per class on the real set
(target 0.2 %)", evaluated on "the 005M PHASE2 real subset (97 questions)". 005J's recommendation stated it as
"confident-wrong ≤ 0.5 % **stated as an upper bound on n**" (`analyzer-005j/recommendation.md:170`), with the threshold
"frozen on a separate validation split" (`training-plan.md:67`). Both qualifiers are gone.

Per-class real n in phase 2:
- BAY_OR_RISALIT 2, STOREY_COVERAGE 3, OPEN_SIDE 3, GARAGE_BODY 5, OPENING_VS_PATTERN 7, CANOPY 8, WALL_CONTINUATION 10,
  OUTER_BOUNDARY 12, BODY_REGION 15, TERRACE_VS_BODY 15, GAP_KIND 17.
- The 97 include 12 mirror twins, so there are 85 distinct base questions.
- Several classes are one-sided: OPENING_VS_PATTERN 7/7 OPENING, OPEN_SIDE 3/3, GARAGE_BODY 5/5.

Zero confident-wrong on these n gives Wilson 95 % upper bounds of 65.8 % (n = 2), 18.4 % (n = 17) and 3.81 % (n = 97,
pooled).

Real questions needed **per class** to demonstrate the bar at 95 %:

| target | CW observed | Wilson two-sided | Clopper–Pearson two-sided | exact one-sided |
| --- | --- | --- | --- | --- |
| ≤ 0.5 % | 0 | **765** | 736 | 598 |
| ≤ 0.5 % | 1 | 1,130 | 1,113 | 947 |
| ≤ 0.5 % | 2 | 1,455 | 1,443 | 1,258 |
| ≤ 0.2 % | 0 | 1,917 | 1,843 | 1,497 |

The threshold must also be frozen on a separate split, which roughly doubles the real data needed. Both classes of answer
must be represented in each class, as 005J's "balanced" condition requires.

The same arithmetic applies to the ≥ 99 % mirror/rotation gate:
- 20/20 consistent pairs would have a Wilson lower bound of 83.9 %; 4/4 rotation pairs, 51.0 %.
- Showing ≥ 99 % needs at least 381 flip-free pairs.

**Why it matters.** As written, a student scoring 0/2 on BAY_OR_RISALIT "passes" that class. The bar cannot fail where it
should, and it cannot be met where it is real.

**Fix.**
- Restate the bar as "Wilson (or Clopper–Pearson) 95 % upper bound ≤ 0.5 % per class, threshold frozen on a separate
  split".
- Print the n required per class.
- Say plainly that the current real development set can falsify the bar but can never pass it.

### C-5 (P2): Pooled intervals treat correlated reads as independent, and the phase-1 ranking order is noise

**Evidence.**
- The `ALL_MODES` rows (`score.py:155`) put Wilson intervals on 835 or 160 rows, but the five modes of one question are
  highly correlated: A→X is SAME on 130–146 of 167 questions.
- Qwen3-VL-2B phase-2 all-modes CWR is 299/835:
  - Wilson 32.6–39.1 %;
  - a question-level cluster bootstrap (4,000 resamples) gives **29.5–42.3 %**, about twice as wide.
- Paired cluster-bootstrap differences in phase-1 CWR:

| comparison | difference | 95 % interval |
| --- | --- | --- |
| InternVL − Qwen3-VL-2B | −6.3 pp | [−16.3, +3.1] |
| Qwen3-VL-2B − Qwen3-VL-4B | −5.6 pp | [−19.4, +7.5] |
| Qwen3-VL-4B − SmolVLM2-2.2B | −16.9 pp | [−33.8, +0.6] |

- Mirror twins and counterfactual pairs are also counted as independent questions.
- The 32 phase-1 selection questions are reused inside phase 2 (winner's curse). The effect is small: Qwen3-VL-2B mode D
  CWR is 31.7 % on all 167 against 34.1 % on the 135 phase-2-only questions.

**Fix.**
- Use question-level cluster intervals for pooled rows and for model differences, or drop pooled rows.
- Report phase 2 also on phase-2-only questions.
- Say the ordering among the three advancing models is not statistically separable.

### C-6 (P2): The counterfactual "insensitive" share has the wrong denominator and hides the real result

**Evidence.**
- `score.py:129` pairs every variant-A item with its twin but never checks that the truths differ. 005J's
  `counterfactual()` counted only pairs with different truth.
  - One of the 33 pairs, `005m:test-wing_storey-s0-{A,B}-NORMAL-q1`, has truth YES and YES. For it, "same answer" is
    the correct behaviour, yet the table labels it "insensitive".
- 17 of the 33 pairs are context-dependent and have byte-identical A_CROP_ONLY crops (`cropIdenticalToPair`). At
  temperature 0, mode A must give the same answer to both.
  - Mode A's 94 % (31/33) is therefore 16/16 forced, plus 14/16 ordinary pairs, plus the same-truth pair.

Split correctly (differing truth only, Qwen3-VL-2B phase 2):

| | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| ordinary pairs, same answer | 14/16 | 13/16 | **16/16** | 15/16 | **16/16** |
| context-dependent pairs, same answer | 16/16 (forced) | 13/16 | 15/16 | 13/16 | 15/16 |

In C and E the model gives one answer to every ordinary counterfactual pair. It does not read the distinguishing fact at
all. That is a stronger safety statement than the blended 97 %.

**Fix.**
- Restrict to differing-truth pairs.
- Report context-dependent and ordinary pairs separately.
- Mark mode A's context-dependent row "forced by construction".

### C-7 (P2): Mirror and rotation consistency is a weak safety signal, with a denominator different from 005J's

**Evidence.**
- `score.py:76` drops any pair where either member is UNRESOLVED or a failure.
- 005J's `consistency()` counted all pairs, with UNRESOLVED treated as an answer, and also reported pairs where at least one
  member answered (`analyzer-005j/score.py:75-91`).
- Under 005M's rule, an answer↔UNRESOLVED flip vanishes from the denominator. This inflates consistency for abstaining
  models, InternVL in particular, whose phase 2 is still to come.
- The pair counts are 20 mirror and 4 rotation; the rotation pairs are all synthetic.
- In the Qwen3-VL-2B data:
  - Every mirror flip, 8 across all five modes, happens at p ≤ 0.82. By mode: A (0.62, 0.70), (0.52, 0.51),
    (0.53, 0.52); B (0.51, 0.56); C (0.82, 0.60); D (0.62, 0.53), (0.52, 0.74); E (0.71, 0.50). A probability gate would
    already have caught them.
  - Agreeing-but-wrong pairs (4–6 per mode) outnumber flips (1–3).

Mirror consistency of 90–95 % therefore says little about confident-wrong risk. The computation itself is correct: I
recomputed every cell and they match. The twins also check out: 20/20 have the same truth and the same letter order.

**Fix.**
- Report 005J's two denominators: all pairs, and pairs where at least one member answered.
- Add "agree-but-wrong" next to consistency.
- Do not present consistency as a safety pass at n = 20 (C-4).

### C-8 (P2): The student plan bakes in constant HIGH confidence and an abstention-gameable stopping rule

**Evidence.**
- `student_dataset.py:74` targets HIGH on every non-abstain line. After training, stated confidence will be a function of
  answer ≠ UNRESOLVED, so the student's 005M CWR will again equal its error rate (C-1).
- `student-training.md:73`: "Early stopping on VAL CONFIDENT_WRONG_RATE … not on loss". CWR divides by questions asked, so
  a checkpoint that abstains more always scores better, and there is no coverage constraint.
- No threshold calibration on a held-out split is planned. 005J's gate 1 required one.
- `student_dataset.py:16-17` says abstaining on crop-identical context-dependent questions in mode A "is the confident-wrong
  safety property". That case is 1,056 of 10,560 lines, one synthetic structural situation. It does not cover real
  ambiguity.
  - 005J's micro-referee, trained on synthetic data with hard targets, was still 1.2 % confident-wrong at p ≥ 0.999 on
    REAL_DEV (`training-plan.md:55`).

**Fix.**
- Early-stop on useful coverage at a CWR cap, or on area under the risk–coverage curve.
- Calibrate the threshold on VAL and freeze it.
- Reword the claim to "teaches abstention for one generator-provable case".

### C-9 (P2): The answer-token read-out is right, but the records cannot audit it

**Evidence.** `bench.py:59-74` finds the position by regex over the accumulated generated pieces and keeps only
`enumProbs` and `enumMass`. No record stores the token stream, the index of the answer token or its piece, so the "right
token position" cannot be checked directly from the records. Indirect invariants all hold (see "Checked and OK").

One unexplained anomaly: Qwen3-VL-2B produced 17 completion tokens on 813 of 835 replies and 13 on 22, for byte-identical
visible text `{"answer": "X", "confidence": "Y"}`. The 13-token group is skewed: 10 of 22 are C against 69 of 813, and its
mean p is 0.69. Something (possibly an empty think block, possibly grammar-forced token splits) differs between the two
groups, and the records cannot show what or where.

**Fix.** Persist `answerTokenIndex`, `answerTokenPiece` and the list of generated pieces (a few dozen bytes per record) in
`bench.py` for the remaining runs and the teacher.

### C-10 (P2): The old SmolVLM2-500M intersection table mixes two metrics

**Evidence.**
- `summarize.py:100-105` prints the new models' **stated-HIGH** CWR beside the old model's **P80** count (10/78).
- Like-for-like P80 on the 78-question intersection: Qwen3-VL-2B 12/10/15/14/12 in modes A–E, against old 10.
- Stated-HIGH: 20/23/18/16/19.

On the same questions, the new model is no less confidently wrong than the old 500M. It is far more accurate: 55–62 right
against 19. The P80 numbers are already in `matched-bakeoff.json` → `newModelsOnIntersection` but are not printed.

**Fix.** Print P80 and useful coverage in that table, and caption which metric each column is.

### C-11 (P2): Calibration is pooled over populations with different behaviour

**Evidence.** `calibration.json` pools:
- real with synthetic (Qwen3-VL-2B AUROC 0.655 real against 0.540 synthetic);
- 2-option with 3-option questions (prior 1/2 against 1/3, so one threshold means different things);
- the five modes, as `ALL_MODES` rows.

Rows with `p = None` are dropped silently. There are zero today.

**Fix.**
- Add real-only rows and a per-option-count split.
- Record the number of answered rows without a probability.

---

## Checked and OK

- **The option probability comes from the unconstrained distribution.**
  - At the runtime commit, `post_sampling_probs` defaults to `false` (`tools/server/server-task.h:77`).
  - That path calls `get_token_probabilities()`, a softmax over the raw logits (`server-common.cpp:1592ff`). It is not the
    grammar-filtered candidate list (`server-context.cpp:2097-2140`), and backend sampling is turned off when pre-sampling
    logits are needed (`:1923`).
  - `bench.py` reads `logprob`, a field emitted only in pre-sampling mode (`server-task.cpp:274`).
  - `enumMass` is below 1 for SmolVLM2 (median 0.984, min 0.935) and InternVL (median 0.998). That is impossible after the
    grammar filter.
- **The token position is right, by invariant.**
  - `enumProbs` is present in 1,475 of 1,475 committed records and in all 190 Qwen3-VL-4B phase-2 lines.
  - The constrained answer equals the arg-max of `enumProbs` in every record. An off-by-one or a quote+letter merge would
    break one or both.
  - `enumMass` is ≈ 1.0 for both Qwen models, so the option tokens own that position.
  - Letters are single tokens. UNRESOLVED is matched by first-token prefix, which is valid in a closed set where only it
    starts with "U".
  - `enumMass` is reported per record and summarised in `calibration.json` and `tables.md`.
- **AUROC and ECE reproduce exactly.** I recomputed them independently, with a rank-based Mann–Whitney AUROC and my own
  10-bin ECE. All 24 cells (4 models × 5 modes + ALL) match `calibration.json` to 4 decimals.
  - AUROC is correct-versus-wrong among answered items, scored on the chosen option's probability.
  - The ECE binning matches 005J.
- **Wilson.** `score.py:wilson` matches an independent implementation, for example 299/835 → [0.3263, 0.3912].
- **Pre-registration.**
  - `score.py` is unchanged since commit 9d5d6bd (14:44 UTC). The first run file is from 16:10. `bench.py` gained only the
    `--modes` option.
  - A 5-record SmolVLM2 probe (14:37, all HIGH) predates the rule. It was a hint that stated HIGH might be degenerate, but
    not a result-driven change.
- **UNRESOLVED and FAILURE handling** matches 005J's "never wrong": both are in the denominator, never right and never
  confident-wrong. UNRESOLVED-with-HIGH is correctly not counted as confident-wrong. There are 0 failures and 0 parse
  errors in every run.
- **Run integrity.**
  - The `runs/*.jsonl` files in the repository are byte-identical to `/home/user/work005m/runs`.
  - Qwen3-VL-2B phase 2 contains all 160 phase-1 records unchanged.
  - The first 160 Qwen3-VL-4B phase-2 lines are identical to its phase-1 file.
- **Twin construction.** Mirror (20) and rotation (4) twins share truth and letter order. The mirror and rotation
  consistency cells recompute exactly.
- **One real safety behaviour the stated-HIGH ranking did reward.**
  - InternVL abstained on 8 of 8 context-dependent crop-only questions. SmolVLM2 abstained on 2 of 8, Qwen3-VL-4B on 2 of 8
    and Qwen3-VL-2B on 0 of 8.
  - InternVL's 43 abstentions have a forced-choice accuracy of 58 %, against 71 % where it answered, so they are mildly
    targeted.
- **No committed document currently claims calibration or safety for any model.** `input-modes.md` describes the read-out
  neutrally. The only overstatements are in the student plan (C-4, C-8).

## Round-2 checks (when the remaining runs and the final documents land)

1. **The final `matched-bakeoff.json`, tables, stage report and `recommendation.md`.**
   - The HIGH share is printed next to every CWR, and CWR(stated) is described as error-or-abstain (C-1).
   - No 005M CWR is compared with a 005J CWR.
   - P80 never appears without useful coverage (C-2).
2. **A risk–coverage table for every phase-2 model** (C-3).
   - Qwen3-VL-4B in particular: does its p ≥ 0.999 zero-CW region (19/160 in phase 1) survive on 167 questions, and how
     much of it is real rather than synthetic?
   - Thresholds must be frozen on one split and reported on another.
3. **Whether InternVL phase-2 mirror and rotation consistency drops** under 005J's all-pairs denominator once its
   answer↔UNRESOLVED flips are counted (C-7).
4. **No document reads Qwen3-VL-2B's 0/835 at p > 0.99959 (UB 0.46 %) as meeting the 0.5 % bar** (C-3 trap). Any
   "≤ 0.5 %" claim must be a per-class upper bound with the n from C-4.
5. **Teacher (Qwen3-VL-8B).**
   - Its HIGH share and `enumMass`; whether its option probabilities used as soft targets are themselves over-confident
     (top-bin accuracy against mean p).
   - That `agrees` gating keeps the teacher from ever supplying a label.
   - That the teacher's risk–coverage is reported, not just its accuracy.
6. **Student plan wording and stopping rule updated** (C-8). The pass bar is restated as an upper bound (C-4).
7. **If the recommendation is ADOPT_LOCAL_VLM_PILOT or TRAIN_BUILDPLAN_STUDENT**, it names an operating point (threshold,
   coverage, Wilson UB, per class). It also says how harm conditional on the analyzer's own answer would be measured, since
   005M has no oracle replay; note the mode-E right→wrong 11 against wrong→right 4.
8. **Counterfactual reporting split** into ordinary and context-dependent pairs, with differing truth only (C-6).

## Reproduction

```bash
# selective prediction for one run / mode / subset (prints the C-3 rows)
cat > /tmp/repro_c.py <<'EOF'
import json, math, sys
from collections import Counter
W, run, mode, sub = sys.argv[1:5]
REAL = {'REAL_DEV', 'ROUND8_DEV', 'MURAJACH_DEV', 'STOREY_DEV', 'GAPSET_DEV'}
it = {(i['qid'], i['mode']): i for i in map(json.loads, open(f'{W}/items/items.jsonl'))}
def ub(k, n, z=1.96):
    p = k / n; d = 1 + z * z / n
    return (p + z * z / (2 * n)) / d + z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
rows = []
for r in map(json.loads, open(f'{W}/runs/{run}.jsonl')):
    i = it[(r['qid'], r['mode'])]
    if (mode != 'ALL' and r['mode'] != mode) or (sub == 'REAL' and i['set'] not in REAL):
        continue
    a = r.get('answer'); key = next((k for l, k, _ in i['shown'] if l == a), None)
    rows.append((a, r.get('confidence'), (r.get('enumProbs') or {}).get(a), key == i['expected']))
n = len(rows); ans = [(p, ok) for a, c, p, ok in rows if a not in (None, 'UNRESOLVED')]
print('asked', n, 'confidence', dict(Counter(c for _, c, _, _ in rows)), 'UNRESOLVED', sum(a == 'UNRESOLVED' for a, *_ in rows))
for t in (0.8, 0.9, 0.95, 0.98, 0.99, 0.995, 0.999):
    acc = [ok for p, ok in ans if p >= t]; cw = acc.count(False)
    print(f't>={t}: accepted {len(acc)} ({len(acc)/n:.1%}) CW {cw} CWR {cw/n:.2%} UB {ub(cw, n):.2%} selRisk {cw/len(acc) if acc else 0:.1%}')
mw = max((p for p, ok in ans if not ok), default=0); z = sum(1 for p, ok in ans if ok and p > mw)
print(f'max wrong p {mw:.6f}; in-sample zero-CW coverage {z}/{n}; Wilson UB(0/{n}) {ub(0, n):.2%}')
EOF
nice -n 19 python3 -I /tmp/repro_c.py /home/user/work005m p2-qwen3-vl-2b D_MARKED_ROI_PLUS_CROP ANY
nice -n 19 python3 -I /tmp/repro_c.py /home/user/work005m p2-qwen3-vl-2b D_MARKED_ROI_PLUS_CROP REAL
nice -n 19 python3 -I /tmp/repro_c.py /home/user/work005m p2-qwen3-vl-2b ALL ANY
nice -n 19 python3 -I /tmp/repro_c.py /home/user/work005m p1-qwen3-vl-4b ALL ANY
```
