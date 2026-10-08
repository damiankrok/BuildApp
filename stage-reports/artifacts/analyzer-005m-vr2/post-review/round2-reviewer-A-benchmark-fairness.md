# 005M post-review, round 2: Reviewer A (benchmark fairness and statistics)

**Scope.** I checked the final artifacts, not the documents' claims about them:

- the matched sets and the exclusion list;
- the cluster bootstrap and the image-free priors;
- the phase-1 ranking;
- every phase-1, phase-2, teacher and old-model number in my area in the stage report, `recommendation.md` and
  `PROJECT_STATUS.md`;
- whether the recommendation follows from the measurements.

**Method.** I ran no model. Every computation was a `nice -n 19 python3 -I` read of:

- `/home/user/work005m/items/items.jsonl`;
- `stage-reports/artifacts/analyzer-005m-vr2/runs/*.jsonl`;
- the committed JSON.

My scripts are in the session scratchpad (`revA2/rescore.py`, `boot2.py`, `misc.py`, `det2.py`, `motiv.py`,
`realcls.py`, `tvb.py`). They do not import `score.py`.

**Result: 0 P0, 1 P1, 9 P2.**

**The numbers are right.**
- My independent re-score matches `matched-bakeoff.json` on 84 of 84 rows, amended and pre-registered, with 0
  mismatches.
- `score.py --exclude …` followed by `summarize.py` reproduces `matched-bakeoff.json`, `context-gain.json`,
  `calibration.json` and `bakeoff-tables.md` **byte for byte**.
- Every phase-1 and phase-2 figure in the stage report and the recommendation that I checked is correct, up to
  rounding.

**The problems are interpretive.**
- The recommendation's deciding sentence claims more than 005M measured about the body-relation decision itself
  (A2-1). The per-class data on exactly that decision point the other way.
- The "beats the prior" figure is attached to the wrong subset and carries no multiplicity caveat (A2-2).
- Context gain is printed without the intervals that would show it is not established (A2-3).
- Three round-1 P2 fixes that `resolution-round1.md` lists as done are not in the files (A-5, A-6, A-10).

---

## 1. Round-1 findings: status

| id | round-1 finding | status | evidence |
| --- | --- | --- | --- |
| A-1 (P1) | CONFIDENT_WRONG_RATE ≈ wrong rate; the ranking rewards UNRESOLVED | **RESOLVED** | See below |
| A-2 (P1) | Baselines too weak | **RESOLVED** | See below |
| A-3 (P1) | Wilson intervals on correlated rows | **RESOLVED** | See below |
| A-4 (P1) | Old-model table mixed P80 with HIGH-CWR | **RESOLVED** | See below. The report's one-line reading of the table is wrong (A2-8) |
| A-5 (P2) | Prompt-cache drift; "changes no answer by design" | **NOT RESOLVED** | See below, and new evidence in A2-4 |
| A-6 (P2) | Docstring "a missing reply is a FAILURE" against the code dropping incomplete models | **NOT RESOLVED** (harmless) | See below |
| A-7 (P2) | Context gain and calibration on different sets | **RESOLVED** | `context-gain.json` / `calibration.json`: PHASE1 = 4 models × 30 questions; PHASE2 = 3 models × 152 |
| A-8 (P2) | "≥ 150" met by item count, not distinct questions | **PARTIAL** | See A2-6 |
| A-9 (P2) | Timing wording in `phase1-advancement.json` | **RESOLVED** | The `note` cites `p1-ranking.txt` (19:45:26.21), the chain launch (19:45:26.33) and the commit a minute into phase 2 |
| A-10 (P2) | First 16 SmolVLM2 records under the default 8 GiB cache; one `imageTokens` = 0 | **NOT RESOLVED** (harmless) | See below |
| A-11 (P2) | Model comparability notes | **PARTIAL** | See below |

**A-1 (RESOLVED)**
- Every table prints the HIGH share and the p ≥ 0.8 share.
- The "How to read" block and stage report §4 say CWR is in effect the wrong-answer rate.
- §3 says InternVL's first place "comes from abstaining (35 UNRESOLVED), not from reading", and that the gap is inside
  the cluster intervals. InternVL − Qwen-2B, all modes: −18.5 … +3.2 pp.
- Nothing calls InternVL "safest".

**A-2 (RESOLVED)**
- `baselines` per set: always-A/B/C, the first-option rule and the fitted per-class majority, marked as an upper bound.
- `modelMinusFirstOptionPrior` with cluster intervals.
- The pooled "majority answer" row is gone.

**A-3 (RESOLVED)**
- `clusterBootstrap` resamples real houses and synthetic scene pairs with their transforms: 13 clusters in PHASE1 and
  42 in PHASE2. That is coarser, and so more conservative, than my round-1 families. The cluster list is printed in
  `misc.py`.
- It is paired: every arm and the prior share the resample.
- My independent bootstrap (10,000 resamples, different seed) agrees within ≈ 0.5 pp. Example: Qwen-2B D − prior,
  +2.2 … +18.8 here against the committed +2.0 … +18.5.

**A-4 (RESOLVED)**
- `bakeoff-tables.md` leads with like-for-like P80 for every new arm.
- The 005J full-sequence and 005M first-token estimator difference is stated.
- Recomputed: old model 19 right, 24 UNRESOLVED, 10 P80 on 78 questions. Qwen-2B D: 62 right, 14 P80. Qwen-4B D: 58
  and 12. InternVL D: 47 and 7.

**A-5 (NOT RESOLVED)**
- `environment.md:42` still says the cache "changes no answer by design".
- The report says nothing about drift: `grep -i drift` finds nothing.
- `resolution-round1.md` says both were done.

**A-6 (NOT RESOLVED, harmless)**
- The `score.py` docstring (lines 8–9) is unchanged.
- `complete()` still drops incomplete models.
- No model has a missing record, so no number is affected.

**A-10 (NOT RESOLVED, harmless)**
- Neither the report nor `environment.md` mentions the SmolVLM2 restart. Only the 4B container restart is mentioned.
- `score.py` (`toks … or 0`) and `runtime_matrix.py:171` still count the missing token count as 0. SmolVLM2 A has a
  minimum `imageTokens` of 0.
- The medians are unaffected.

**A-11 (PARTIAL)**
- Fixed in `input-modes.md`:
  - the pixels-per-token figure;
  - the SmolVLM2 cap fairness argument;
  - "every model receives every input pixel".
- Not disclosed: mode B's 0–1000 coordinate frame is Qwen3-VL's native grounding convention, and llama.cpp warns that
  Qwen-VL needs ≥ 1,024 image tokens for grounding; here it gets 578.
- The result makes this moot, since B loses for every model, Qwen included. It should still sit beside the mode-B
  result.

---

## 2. Findings

### A2-1 (P1): The recommendation's deciding claim about the body-relation decision is not what 005M measured, and the per-class data on exactly that decision point the other way

**Evidence: the claim**

`recommendation.md`, the chosen row: "005M shows that no small VLM, zero-shot or as a teacher, can stand in for that
decision [the murajach / gozdzikowcach body relation] at an acceptable error rate". Stage report §12 repeats it.

**Evidence: what 005M measured on that decision.** PHASE2, mode D, from the raw runs (`realcls.py`, `motiv.py`):

| real questions | n (distinct bases, houses) | truth | Qwen3-VL-2B A → D right | Qwen3-VL-4B D | InternVL D |
| --- | --- | --- | --- | --- | --- |
| TERRACE_VS_BODY | 15 (13, 7 houses) | 6 ENCLOSED / 9 EXTERNAL | 11 → **15** | 13 | 7 |
| BODY_REGION | 15 (13, 8 houses) | 10 YES / 5 NO | 14 → **14** | 15 | 12 |
| murajach M1–M8 + gozdzikowcach, all classes | 17 | mixed | — → **16** | 14 | 13 |

- The three questions that are the 005L failure itself (gozdzikowcach TERRACE_VS_BODY-0 and murajach M5, M7, all
  EXTERNAL) are right for Qwen-2B in C, D and E. In each case the first-option prior is wrong.
- TERRACE_VS_BODY has a balanced truth, and the D answers match it exactly (6 / 9), so the result is not a constant
  answer that happens to fit.

**Evidence: where Qwen-2B's real errors actually are.** In D, its 22 real errors sit mostly in other classes:

| class | right |
| --- | --- |
| GAP_KIND | 8 / 17 |
| OUTER_BOUNDARY_A_OR_B | 7 / 12; it answers OUTLINE_1 on 12 of 12 |
| CANOPY_PERGOLA_VS_WALL | 7 / 8 |
| STOREY_COVERAGE | 1 / 3 |

**What the measurements do support**
- The aggregate real confident-wrong rate of 23 % (22 / 97) is about 45× the 0.5 % gate, and no arm abstains usefully.
- The gate cannot be demonstrated on the available sample. One error in 30 body-relation questions gives a Wilson upper
  bound near 17 %. The report's own 598–765-per-class arithmetic says the same.
- The 29 / 30 is a **post-hoc subgroup**: 12 classes × 15 arms. It is a lead, not evidence of success.

None of this shows that a small VLM *cannot* make that decision. It shows that 005M cannot validate one, and that the
models are unsafe on the benchmark as a whole.

**Why it matters**
- This sentence is the stated reason for the chosen enum. It also goes to OWNER through `PROJECT_STATUS.md` ("fix
  murajach … deterministically").
- A reader will take it to mean 005M tested the motivating decision and the VLMs failed it. On that decision, the best
  arm was right on 29 of 30 real questions.

**Fix**
- Replace the sentence with what was measured: *"No small VLM meets, or can be shown on the available real sample to
  meet, the 0.5 % gate. Across all real questions the best arm is confidently wrong on 23 %. On the body-relation
  classes themselves (TERRACE_VS_BODY, BODY_REGION) Qwen3-VL-2B in D was right on 29 / 30 real questions. That is a
  post-hoc subgroup and not a validated result, but it is the strongest lead for any reopening."*
- Add that subgroup to the reopen conditions as the first pre-registered target for a frozen real evaluation set.
- The enum itself can stand (§4).

### A2-2 (P2): "Beats the prior on real development questions: +2.0 … +18.5" uses the all-questions interval, says nothing about multiplicity, and "only Qwen-2B D clears it" is wrong by the report's own table

**Evidence: the subset is mislabelled.** `recommendation.md` (the NO_AI_GAIN row): "Qwen3-VL-2B in mode D beats the
image-free prior on real development questions: +2.0 … +18.5 points overall, P(model > prior) = 99 %".

- +2.0 … +18.5 is the interval on **all 152** questions (`bakeoff-tables.md`, PHASE2, model minus the first-option
  rule).
- The real-only interval is in no committed artifact. My cluster bootstrap over 17 real houses gives +15.5 pp
  [+3.3, +27.5] (`boot2.py`).

**Evidence: multiplicity.** D is the best of 15 model × mode arms, chosen after the fact. I ran a centred max-statistic
bootstrap over the 15 arms (family-wise 95 %):

| subset, prior | critical value | best arm | survives? |
| --- | --- | --- | --- |
| ALL, first-option rule | +10.2 pp | Qwen-2B D, +10.5 | yes, by 0.3 pp |
| REAL, first-option rule | +14.3 pp | Qwen-2B D +15.5; Qwen-4B C +14.4 | yes |
| ALL, fitted per-class majority (upper bound) | +9.5 pp | +6.6 | **no** |
| REAL, fitted per-class majority (upper bound) | +12.4 pp | +9.3 | **no** |

So the gain over a truth-blind prior survives correction. It does not survive against the best prior-only rule. That
rule is optimistic, since it is fitted on the evaluated set, but it is the ceiling a class-aware heuristic could
reach.

**Evidence: "only".** Stage report §4: "Only Qwen3-VL-2B in mode D clears it with confidence … Qwen3-VL-4B in C is
close: +0.9 … +16.6". That interval excludes 0, so Qwen-4B C clears it too (P > 0 = 98 %).

**Why it matters.** This row is the case against NO_AI_GAIN. It should rest on the right subset and say how fragile
it is.

**Fix**
- Quote the real-only interval and the family-wise result.
- Say the gain does not clear the fitted per-class-majority ceiling.
- Change "only" to "Qwen3-VL-2B D and Qwen3-VL-4B C".
- Optionally, have `score.py` emit `modelMinusFirstOptionPrior` per subset (REAL_ALL, SYNTH_ALL) as well as for the
  whole table.

### A2-3 (P2): Context gain has no interval, and none of the A → D gains is established

**Evidence.** Stage report §4 prints net changes and bolds Qwen-2B's "+6". Paired cluster bootstrap of (right in the
mode − right in A) over the 42 PHASE2 clusters (`misc.py`):

| model | A→C | A→D | A→E |
| --- | --- | --- | --- |
| Qwen3-VL-2B | 0 [−4.2, +4.1] | **+6 [−0.7, +8.6]**, P > 0 = 0.94 | 0 [−4.6, +4.1] |
| Qwen3-VL-4B | +9 [0.0, +12.6] | +6 [−1.2, +9.2] | +3 [−4.0, +7.4] |
| InternVL3.5-2B | +7 [0.0, +10.2] | +7 [0.0, +9.9] | +7 [−1.6, +10.4] |

- Units: net change out of 152 questions, with the 95 % interval in pp.
- On the interim 167 items, Qwen-2B's A→D interval excluded 0 (+0.6 … +9.4). On the amended 152 it does not.
- The real-set gain over the prior is already present in mode A: Qwen-2B A − prior on REAL is +11.3 [0.0, +22.9].
  Most of the advantage over a blind rule comes from reading the crop, not from global context. The failed
  global-context pairs (2 / 10) say the same.

**Evidence: one wrong reading.** §4 says InternVL's gain "is mostly UNRESOLVED → RIGHT". That holds only for E (10 vs
2). For C it is 3 against 7 WRONG→RIGHT, and for D 4 against 6. In each mode UNRESOLVED→WRONG (4 / 6 / 7) offsets
most of it.

**Fix**
- Add the paired cluster interval to `context-gain.json` and the tables. The `boot()` machinery already exists.
- Say that no model's A→D gain is distinguishable from zero.
- Correct the InternVL sentence.
- "Best mode D" for Qwen-2B is then a point estimate, and the report should call it that.

### A2-4 (P2): The prompt cache now changes answers. InternVL3.5-2B answers 3 of 17 byte-identical input pairs differently

**Evidence.** `det2.py` groups (images, prompt) byte-identical items: 17 A-mode pairs.

- **Qwen-2B, Qwen-4B and SmolVLM2:** identical answers. The maximum probability shift is 0.025, 0.030 and 0.036.
- **InternVL3.5-2B, phase 2:** 3 of 17 pairs differ. In each, the cold record (4 cached tokens) and the warm record
  (453–460 cached) disagree:
  - `test-garage_vs_carport-s0-*-MIRROR` (excluded): UNRESOLVED / A;
  - `test-inset_upper-s1-*-NORMAL`: A / UNRESOLVED;
  - `test-inset_upper-s2-*-NORMAL`: A / UNRESOLVED.

  The maximum shift is 0.037, with UNRESOLVED and A near a tie.

**Why it matters**
- Two of the flips are in the amended set. They change InternVL's UNRESOLVED count and its context-pair figures in A.
- More importantly, "mode-A context pairs: same answer is forced, the crops are identical" (bakeoff-tables, stage
  report §2) is not strictly true for InternVL. Identical inputs can get different answers through the cache.
- The `environment.md` sentence is now contradicted by data, and the A-5 resolution is not implemented.

**Fix**
- Replace `environment.md:42–43` with the measured drift (≤ 0.037) and the 3 / 17 InternVL flips.
- Note beside the context-pair table that A-mode "same answer" is forced only up to cache nondeterminism.

### A2-5 (P2): The exclusions are decided from the stimuli and reported honestly, but the rule is applied unevenly, and the report omits that they reverse the phase-2 all-modes order

**Evidence: what is fine**
- The list is a pure function of class and transform.
  - All 6 transformed STOREY_COVERAGE questions are excluded, and every NORMAL one is kept.
  - All 9 GARAGE_DOOR_VS_CARPORT questions are excluded.
  - No real question is excluded.
- It was written at 23:25 from reviewer B's stimulus findings (B-1, B-2).
- It applies to every model and mode.
- `bakeoff-tables.md` prints the pre-registered 32 / 167-question rows beside each table, and `phase1-advancement.json`
  keeps the decision on 32.

**Evidence: what is uneven**
- **The rule is not applied to all cases it covers.** It reads: "excluded … when the drawing and the question wording do
  not settle its generator truth". Reviewer D's D-8 is exactly that case: in `inset_upper` A, an upper-level terrace
  is drawn over the area, so whether the floor is "built" over it is ambiguous. Those questions (s0-A, s1-A and s2-A
  NORMAL) stay in, with a caveat. Qwen-2B answers YES on them, and is wrong.
- **The phase-2 order reverses.** The excluded items are not neutral. Per model, over the 15 × 5 excluded records:

  | model | right | wrong | UNRESOLVED |
  | --- | --- | --- | --- |
  | Qwen-2B | 40 | 35 | 0 |
  | Qwen-4B | 33 | 32 | 10 |
  | InternVL | 21 | 16 | 38 |

  So excluding them **reverses the PHASE2 all-modes CWR order**:

  | set | Qwen-2B | Qwen-4B | InternVL | order |
  | --- | --- | --- | --- | --- |
  | pre-registered (167) | 35.8 | 35.7 | 34.4 | InternVL < 4B < 2B |
  | amended (152) | 34.7 | 35.0 | 35.7 | 2B < 4B < InternVL |

  On the pre-registered set, the best arm by the primary metric is a **tie**: Qwen-2B D 53 / 167 and InternVL C 53 /
  167. Qwen-2B D wins only on the accuracy tie-break.

**Why it matters**
- Every difference here is inside ±1.3 pp, with pairwise intervals of about ±7 pp, so no conclusion changes.
- But "best model" is a statement about the primary metric, and that order depends on a post-hoc exclusion. The report
  should say so instead of presenting the amended order alone.

**Fix**
- In stage report §4, add one line:
  - the phase-2 CWR order is not stable;
  - it reverses between the pre-registered and amended sets;
  - on the pre-registered set the best arm ties;
  - so "best" means best accuracy at an equal CWR.
- Either exclude the D-8 questions under the same rule (and list them in `excluded-items.json`), or say why the rule
  does not cover them.

### A2-6 (P2): "≥ 150 matched questions: PASS" holds only when mirror twins count as questions

**Evidence.** The amended PHASE2 has 152 items:

- 137 distinct base questions;
- plus 14 MIRROR and 1 ROT90 twins;
- in 42 clusters.

The pre-registered 167 items held 143 distinct bases. Phase 1 has 30 = 30 distinct, so it is fine. `bakeoff-tables.md`
prints clusters but not distinct bases. The stage report's PHASE 2 row says "PASS (167 pre-registered, 152 after
exclusions)".

**Fix**
- Report "152 items = 137 distinct questions + 15 transform twins, 42 clusters".
- State that the ≥ 150 threshold is met by counting a mirrored or rotated rendering as a question. The brief does not
  forbid that, but neither set reaches 150 distinct questions.

### A2-7 (P2): The README reproduction command omits `--exclude`, so it regenerates the pre-registered tables, not the committed ones

**Evidence.** `research/analyzer-005m/README.md:74-75` runs `score.py` without
`--exclude …/excluded-items.json`.

- **With** the flag, I reproduced all four committed files byte for byte.
- **Without** it, `excluded` is empty and the "amended" tables become the 167 / 32-question ones.

**Fix.** Add the flag to the README and name the run order: `p1-smolvlm2`, `p2-internvl`, `p2-qwen3-vl-4b`,
`p2-qwen3-vl-2b`. Model order fixes the table order.

### A2-8 (P2): Number and wording corrections in the stage report and teacher note

| where | says | measured |
| --- | --- | --- |
| §3 | "The order is the same on the pre-registered 32 questions and under an accuracy ranking" | The order is the same on 32. Under an accuracy ranking it is Qwen-2B, Qwen-4B, InternVL, SmolVLM2; only the **top-three set** is the same |
| §4, old model | "Far more accurate, and no less often confidently wrong" | True for both Qwens (P80 10–15 and 12–18 of 78). InternVL has **fewer** P80 errors than the old model in every mode: 1–7 against 10, because its probabilities are flat (p ≥ 0.8 share 14 %) |
| §4 | "Mirror consistency is 93–100 %" | True in modes A and C–E. InternVL B is 90 % (9 / 10), or 86 % with 005J's denominator |
| §4 | first-option rule "58.5 %" | 89 / 152 = 58.6 % |
| `teacher-feasibility.md` | "too small to rank … no ranking is established" | Paired cluster: teacher − Qwen-2B accuracy is −34.7 … −6.7 (all modes) and −40.7 … −5.3 (D). That difference **is** established; teacher − InternVL (−25.3 … +5.6) is not. The recommendation's "reads worse than the 2B students" holds for Qwen3-VL-2B, not for InternVL3.5-2B |

### A2-9 (P2): Phase-1 and REAL-human cluster intervals rest on very few clusters

**Evidence**
- PHASE1 has 13 clusters, and one house (morelach) holds 8 of the 30 questions.
- REAL_HUMAN_TRUTH in PHASE2 has 8 clusters.
- A percentile cluster bootstrap with this few clusters under-covers. The lumpy distributions show it: "+0.0 … +17.4,
  P > 0 = 90 %"; "+0.0 … +40.0".

No conclusion depends on these intervals: the phase-1 decision was made on the pre-registered point rule.

**Fix.** Say in the "How to read" block that intervals from fewer than about 20 clusters are approximate. Drop or flag
the REAL-human cluster intervals.

### A2-10 (P2): The case against a pilot quotes Qwen-2B's calibration, not the strongest selective arm

**Evidence**
- The recommendation's "its probability does not help" uses Qwen-2B: AUROC 0.56, and an in-sample zero-error region of
  5.9 % in D.
- Qwen-4B is the better selective model:
  - AUROC 0.70 in D;
  - on real D at p ≥ 0.99: 42 of 97 covered, 1 wrong (2.4 %, Wilson upper 12.3 %);
  - real-D in-sample zero-error region 27.8 %.
- Stage report §4 mentions this point; the recommendation does not.
- The pairwise CWR difference between Qwen-4B and Qwen-2B in D is −1.0 … +8.1, so "best small model" is not separated.

**Why it matters.** The rejection still holds: 2.4 % in-sample, with an upper bound of 12 %, against a 0.5 % gate. But
the strongest pilot case should be the one refuted.

**Fix.** Add one line to "Why ADOPT_LOCAL_VLM_PILOT is rejected" with the Qwen-4B real-D selective point and its
Wilson upper bound.

---

## 3. Round-2 checks from my round-1 list

1. **Raw data.**
   - All three `p2-*.jsonl` have 835 unique keys, 0 errors, 0 parse failures and 0 answers outside the schema.
   - Their first 160 lines equal the `p1-*` files byte for byte.
   - All 10 committed run files equal the work copies.
   - `items.jsonl` is unchanged since 14:25:11 on Oct 7, before any run.
   - PHASE2 lists exactly three models.

   **OK.**
2. **Independent re-score.** 84 of 84 rows match: 4 + 3 models × 6 rows, amended and pre-registered. The pipeline
   reproduces the four artifacts byte-identically with `--exclude`. **OK.**
3. **Report and recommendation wording.**
   - CWR is not described as confidence, and InternVL is not called safest: **OK.**
   - Every headline accuracy has the prior and a cluster interval beside it: **OK in §4.** Wrong subset in the
     recommendation: A2-2.
   - Context gain survives its interval: **No** (A2-3).
4. **Old-model table.** P80 and UNRESOLVED shown like for like: **OK.** The report's summary line is wrong (A2-8).
5. **Matched sets** for context gain and calibration: **OK.**
6. **Teacher.**
   - It is in a separate 24-question comparison, labelled Q4_K_M against Q8_0, and scored by the same `score.py`.
   - It is never used as truth: TRAIN agreement is against generator truth. I recomputed 20 / 42 and the pairs (21
     pairs, 20 same answer, 0 both right) from the raw file.
   - HIGH on 118 of 120 and 42 of 42; no confidence claim is made from it.
   - The settings change after the OOM (first 27 records at 8k / 2 GiB cache) is disclosed.

   **OK** (one wording point in A2-8).
7. **Determinism.** The Qwens and SmolVLM2 are stable (shift ≤ 0.036, no flips). **InternVL flips 3 of 17**: A2-4.
8. **Runtime.**
   - "with A→E cache reuse" and "standalone" are labelled.
   - The cold medians filter on `cachedTokens ≤ COLD`.
   - D's standalone figure is a fit.

   **OK.** One cross-check: Qwen-2B's fitted standalone D (34.8 s) sits slightly above its measured cold E (33.3 s),
   although E has the same image tokens and more text. "≈ 35 s" is fine as a round figure.
9. **Generated tables.** `bakeoff-tables.md` is regenerated from the final JSON, not edited by hand: byte-identical
   on regeneration. **OK.**

## 4. Does the recommendation follow from the measurements?

**Yes: RETURN_TO_DETERMINISTIC_BODY_RELATION is the best-supported enum.** Its stated reason needs the A2-1
correction. Enum by enum:

**ADOPT_LOCAL_VLM_PILOT: correctly rejected.**
- No arm comes near the gate. The best real confident-wrong rate is 23 % (Qwen-2B D).
- The best in-sample selective point is 2.4 %, with a Wilson upper bound of 12 % (Qwen-4B real D, p ≥ 0.99, 42 of 97
  covered). It was chosen on the scored data.
- Qwen-2B never abstains.
- The global-context pairs fail: 2 / 10, 0 / 10 and 0 / 10 both right.

**TRAIN_BUILDPLAN_STUDENT: correctly deferred.**
- No compute.
- The teacher is pair-insensitive: 20 of 21.
- The gate cannot be shown on 2–17 real questions per class.

**NO_AI_GAIN: rejecting it is defensible, but only just.**
- The gain over a truth-blind prior survives family-wise correction on REAL and on ALL: by 0.3 pp on ALL, and by
  1.2 pp on REAL.
- It does not survive against the fitted per-class-majority ceiling (A2-2).
- "Gain present but fragile and unsafe" is the honest reading. That is what the recommendation says, once the
  interval is corrected.

**RETURN_TO_DETERMINISTIC_BODY_RELATION: chosen, and supported.**
- What supports it is not that VLMs were shown to fail the body-relation decision; they were not (A2-1).
- What supports it:
  - no VLM result can be validated against the 0.5 % gate with the real data that exist;
  - deployment costs 35 s or more on CPU and ≈ 1.5–3 GB;
  - the deterministic fix has a concrete, reviewable target.

**OTHER_MEASURED_RESULT: not better supported.**
- The one measured result that might justify it is the 29 / 30 body-relation subgroup. That is post hoc, and it
  belongs in the reopen conditions, not in the headline.

## 5. Checked and OK (summary)

- **Exclusion list.**
  - It is a class / transform rule, complete within its two families.
  - It was decided from stimuli and generator code.
  - It applies to every arm.
  - The pre-registered rows are printed beside the amended ones.
- **Phase-1 ranking and advancement.**
  - Amended: InternVL 21.3 %, Qwen-2B 26.7 %, Qwen-4B 32.0 %, SmolVLM2 53.3 %.
  - Pre-registered: 21.2 %, 27.5 %, 33.1 %, 50.0 %.
  - The order is the same on both sets, and the top three are the same under accuracy-first.
- **Stage report §3 and §4 headline figures, every one recomputed:**
  - phase-1 accuracies 55.3 / 73.3 / 66.7 / 42.0 and their cluster intervals;
  - phase-2 69.1 % / 30.9 % (59–76; 24–39 / 24–41), 67.8 / 31.6, 53.9 / 32.9;
  - all-mode figures 65.1 / 34.7, 62.8 / 35.0, 50.5 / 35.7;
  - UNRESOLVED 0 / 14 / 105 of 760;
  - the real / human / synth split table;
  - priors 62 % and 53 %;
  - model − prior intervals;
  - context-gain transitions;
  - consistency pairs (10 context, 16 local, 14 mirror);
  - calibration: AUROC 0.56–0.70 in D, zero-error region 5.9 %, all-five-agree 28.6 % wrong, Qwen-4B real D p ≥ 0.99
    at 43 % coverage / 2.4 %.
- **`recommendation.md` figures.** 47 / 152, Wilson 24–39, cluster 24–41, real 22.7 %, human 15.7 %, 0 / 760
  UNRESOLVED, 57.5 % teacher, 20 / 21 pairs, the 598–765 sample-size arithmetic (exact one-sided and Wilson, 0 errors).
- **`PROJECT_STATUS.md` 005M row and section.** Consistent with the above.
- **The bootstrap implementation.**
  - It is paired across arms and the prior.
  - It uses a ratio estimator on cluster sums.
  - The percentile indices are correct.
  - The `SYN_CLUSTER` regex cannot capture a real question id: every real id maps to `house:<group>`.
