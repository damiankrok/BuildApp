# 005M post-review, round 2: Reviewer B (visual-context design, ROI, answer leakage)

**Scope.**
- The fixes for my round-1 findings B-1 … B-12, with weight on B-1 (`common.STOREY_LAYOUT`), B-2 (vrgen2 2.1
  `BAY_BACK_CLOSED_VS_DRIVE_THROUGH`, `--compat 2.0.0`) and B-3 (split counterfactual metrics).
- The context-gain breakdown, the corrected `input-modes.md`.
- Every context-gain and context-pair claim in the stage report, `recommendation.md` and the `PROJECT_STATUS.md` row.

**Method.** Read-only apart from this file.
- I recomputed every pair and gain figure independently from `runs/*.jsonl` and `/home/user/work005m/items/items.jsonl`,
  with my own script rather than `score.py`.
- I regenerated the 2.0.0 TEST split with `--compat 2.0.0` into the scratchpad, outside the repository.
- I checked panel placement on all 5,600 v2.1 storey questions and on the 160 TEST and 864 TRAIN/VAL 2.0.0 storey
  questions.
- I viewed two v2.1 TRAIN garage renders.
- No model was run. No SEALED render was opened.

**Summary: 0 P0, 0 P1, 7 P2.**
- All three round-1 P1s are **RESOLVED**, and I verified each in code and data.
- Every context number in the stage report matches the raw answers.
- The new findings concern how the context results are read, not their arithmetic:
  - the local counterfactual pairs fail as badly as the global ones;
  - "2 / 10" is at chance;
  - one InternVL sentence is wrong;
  - the context section never shows the primary metric.

---

## 1. Round-1 findings: status

| id | status | what I checked |
| --- | --- | --- |
| **B-1** (P1) storey layout prompt | **RESOLVED** | See 1.1 |
| **B-2** (P1) garage convention conflict | **RESOLVED** | See 1.2 |
| **B-3** (P1) pooled counterfactual metric | **RESOLVED**, one residual (B-16) | See 1.3 |
| B-4 dashed outline 2 | RESOLVED (documented) | `input-modes.md` states it. Data: phase 2 truth is OUTLINE_1 7 / OUTLINE_2 5. Answers are Qwen3-VL-2B 56 / 4, Qwen3-VL-4B 47 / 12 (1 UNRESOLVED), InternVL 58 OUTLINE_1 / 2 NEITHER. All three score exactly the always-outline-1 baseline, 58 % (7/12), in D. In phase 1 every model scores 2/2. Suggestion: annotate the per-class rows in `bakeoff-tables.md` (lines 162 and 293) |
| B-5 input-modes numbers | RESOLVED | 18 of 90 plans without bands; smallest plan 329 × 272; 49 of 167 plans under 768 px; 102 of 167 crops upscaled; per-model D/E ratios 1.34 / 1.2 / 2.0. All match the data |
| B-6 the AB "crop" is the whole sheet | RESOLVED | Documented. I measured the effect on the gain: the AB class contributes at most ±1 to any model's net change (Qwen3-VL-4B C/D/E +1, others 0 or −1). The headline gains do not depend on it |
| B-7 OTHER hidden | RESOLVED | `otherBreakdown` is printed in `bakeoff-tables.md`. `netRightChange` = right in the mode − right in A, which is symmetric |
| B-8 overlay differs between twins | RESOLVED (documented) | Its sharpest case, `inset_upper-s0` MIRROR, is now among the B-1 exclusions |
| B-9 ROI over evidence | RESOLVED (documented) | |
| B-10 student format | RESOLVED for the docstring and the rule; not demonstrable | `promptTemplate` and the recipe are documented. The rule ("the collator recomputes the prompt with the real band flag") has no collator code yet, because training is deferred |
| B-11 matched sets | RESOLVED | Context gain and calibration use PHASE1 for all four models and PHASE2 for the three finalists |
| B-12 control-pair wording | RESOLVED in `input-modes.md`; residual in the gain table (B-16) | |

### 1.1 B-1: verified

**The code.**
- `common.py:78-79` adds `STOREY_LAYOUT`, keyed by transform:
  - NORMAL: ground left, upper right;
  - MIRROR and ROT180: upper left, ground right;
  - ROT90: ground at the top, upper at the bottom.
- `prompt_for` uses it for the storey class (`common.py:147`).

**The panel placement, against the generator.**
- The image y axis is scene y (`vrgen.render`), so ROT90 sends the upper panel (larger x) to larger y, the bottom.
- Computed from each question's `cropPanel` (which is the ground panel) against its render size:

  | corpus | NORMAL | MIRROR | ROT90 | ROT180 |
  | --- | --- | --- | --- | --- |
  | v2.1 (`sg-v21`) | left 1,400 | right 1,400 | top 1,400 | right 1,400 |
  | `sg-test` 2.0.0 | left 40 | right 40 | top 40 | right 40 |
  | `sg-trainval` 2.0.0 | left 216 | right 216 | top 216 | right 216 |

  - 0 mismatches with the layout sentence.
- The real storey composites (`corpus.py:172-174`, A06 / A07) paste the ground plan at x = 0, so NORMAL is correct.

**What the fix does to the benchmark prompts.**
- **Benchmark prompts are unchanged.** In `items.jsonl`, the only storey records with a non-NORMAL transform are
  4 MIRROR and 2 ROT90 questions.
  - These are exactly the 6 excluded B-1 items, so "recomposing changes no prompt outside the excluded items" is true.
  - Their old prompts stay in `items.jsonl`, unscored, which is the right call.
- **The student format.**
  - It is fixed forward: `student_dataset.py` passes the question's `transform` into `prompt_for`.
  - `pool-v21.json` TRAIN has 11,000 questions, 2,750 per transform, of which 4,000 are STOREY_COVERAGE.

### 1.2 B-2: verified

**2.1 asks what the drawing shows.**
- `vrgen2.py:105-112`: the front gap stays unmarked in both members. Truth is CLOSED_BACK (back wall) or DRIVE_THROUGH
  (no back wall, paving).
- The bay BODY_REGION question is dropped.
- Viewed `sg-v21/renders/train-garage_vs_carport-s0-{A,B}-NORMAL.png`: the drawings match the truths.
  - The back wall in A, and the paving with no back wall in B, are about 2.6 m or more beyond the crop.
  - The door into the house is the same in both members.
- 2.1 no longer contradicts 005J's `garage_door_vs_open` B (TERMINATES, open carport): 005J makes a claim about the
  front, and 2.1 makes one about the back.

**Excluded from the benchmark.**
- All 9 GARAGE_DOOR_VS_CARPORT items are excluded (`excluded-items.json`): 4 pairs and the ROT90 singleton.
- The 2.0.0 bay BODY_REGION question was never selected into the benchmark, so it needs no exclusion.

**The teacher lane.**
- Teacher mining ran on `items-train/items-48.jsonl`: 42 questions, 0 garage, all NORMAL.
- Its 18 context questions are all `cropIdenticalToPair`.
- The teacher's phase-1 lane (`items-teacher-p1.jsonl`, 24 questions, 120 records) is byte-identical to the matching
  `items.jsonl` records: same prompt, same image SHAs. It contains no TEST question.

**`--compat 2.0.0` reproduces the benchmarked corpus.**
- I ran `vrgen2.py --splits TEST --pairs 5 --compat 2.0.0` into the scratchpad (16 s).
- All 320 renders are byte-identical to `/home/user/work005m/sg-test/renders`.
- `questions` and `scenes` in `corpus.json` are equal.
- The only difference is the `splitSeedBase` metadata, which gains `SEALED`. See B-18 on the "byte for byte" wording.

**Wording nit (not a finding).** The new option text "closed at the back (an enclosed bay such as a garage)" brings
back the word "enclosed" for a bay whose front is an unmarked gap. "Closed at the back (a bay such as a garage)" would
avoid it.

### 1.3 B-3: verified

**`score.py:220-245` splits the pairs.**
- Same-truth controls: 1 pair (`wing_storey-s0-*-NORMAL-q1`), left out.
- Context pairs: 10, all with byte-identical crops.
- Local pairs: 16 (8 SYNTH_CF and 8 SYNTH_GLOBAL).
- The pooled figure is kept as `pooledPreRegistered`.

**My independent recount agrees with `matched-bakeoff.json` on every cell, all three models and all five modes.** In
mode D:

| model | context pairs: both right | context pairs: same answer | local pairs: both right |
| --- | --- | --- | --- |
| Qwen3-VL-2B | 2/10 | 8/10 | 1/16 |
| Qwen3-VL-4B | 0/10 | 10/10 | 2/16 |
| InternVL3.5-2B | 0/10 | 7/7 answered | 0/16 |

---

## 2. Stage-report numbers in my area

| claim (stage report §4, recommendation, PROJECT_STATUS) | artifact / recomputed | verdict |
| --- | --- | --- |
| 15 defective questions excluded (6 storey + 9 garage); phase 1 32 → 30, phase 2 167 → 152 | `excluded-items.json`, `matched-bakeoff.json` | correct |
| Context gain C/D/E: Qwen3-VL-2B 0 / +6 / 0; Qwen3-VL-4B +9 / +6 / +3; InternVL +7 / +7 / +7 | `context-gain.json` PHASE2 | correct |
| Mode B loses: −6 / −11 / −12 | same | correct |
| "InternVL … Its gain is mostly UNRESOLVED → RIGHT" | C: W→R 7, U→R 3. D: W→R 6, U→R 4. E: W→R 2, U→R 10 | **wrong for C and D** (B-13) |
| "The 10 counterfactual pairs whose difference lies outside the crop" | 10 pairs = 9 independent scenes from 3 families: corridor_vs_passage 4 (s0 NORMAL and its MIRROR twin), inset_upper 3, wing_storey 3 | correct, but see B-14 |
| Mode D both right 2/10, 0/10, 0/10 | recomputed | correct; at chance (B-14) |
| "same answer to both members in 80–100 % of them" | Qwen3-VL-2B 8/10, Qwen3-VL-4B 10/10, InternVL **7/7 answered** (3 pairs have an UNRESOLVED member) | denominator unstated (B-15) |
| Mirror consistency 93–100 % on 14 mirror pairs | recomputed (InternVL A is 11/11 answered) | correct |
| Context crops byte-identical | round-1 recomputation; amended set: 20 paired context items, and the 18 teacher-mining context items | correct |
| Teacher: same answer to 20 of 21 TRAIN pairs, both right 0 | recomputed from `teacher-train-qwen3-vl-8b.jsonl`: 9 context pairs 9 same / 0 both; 12 local pairs 11 same / 0 both | correct |
| PROJECT_STATUS: "2/10 global-context pairs" for the best model | as above | correct but reads as partial success (B-14) |
| D-8 caveat (2.0.0 inset_upper A draws an upper terrace) on the context pairs | Every model answers NO to **both** inset members in every mode. The arguable member (A, truth NO) is never the one they miss | the caveat cannot change any both-right count; no action |

**Does the recommendation follow?**
- Yes, from my area, and the context evidence is stronger than the report says.
- On the generator-exact synthetic pairs, no model reads the fact that differs, whether it lies outside the crop
  (context pairs) or inside it (local pairs).
- The models answer each context family with a near-constant per family:
  - corridor → YES;
  - inset_upper and wing_storey → NO.
- That supports RETURN_TO_DETERMINISTIC_BODY_RELATION over any VLM route. Nothing in my area argues for a different
  enum. NO_AI_GAIN rests on the real-set prior comparison, which is outside my scope.

---

## 3. New findings (all P2)

### B-13 (P2). The InternVL context-gain sentence is wrong for C and D, and the context section never shows the primary metric

- **Evidence.**
  - `context-gain.json` PHASE2, InternVL3.5-2B:

    | mode | WRONG→RIGHT | UNRESOLVED→RIGHT | UNRESOLVED→WRONG |
    | --- | --- | --- | --- |
    | C | 7 | 3 | 4 |
    | D | 6 | 4 | 6 |
    | E | 2 | 10 | 7 |

  - "Mostly UNRESOLVED → RIGHT" holds only for E.
  - Summed over C + D + E, context turns InternVL's abstentions into wrong answers exactly as often as into right
    ones: 17 against 17.
  - CONFIDENT_WRONG counts (`matched-bakeoff.json` PHASE2 `byModelMode`), mode A and then B / C / D / E:

    | model | A | B | C | D | E |
    | --- | --- | --- | --- | --- | --- |
    | InternVL3.5-2B | 52 | 53 | 50 | 55 | **61** |
    | Qwen3-VL-2B | 53 | 58 | 53 | 47 | 53 |
    | Qwen3-VL-4B | 53 | 58 | 48 | 52 | 55 |

  - So InternVL's "+7" in E comes with +9 confidently wrong answers: 34.2 % → 40.1 % of 152.
- **Why it matters.** The study's primary metric is CONFIDENT_WRONG_RATE. A context gain read only as net right
  answers hides that context makes the abstaining model commit to wrong answers.
- **Fix.**
  - Rewrite the sentence, for example: "InternVL: +7 / +7 / +7 net right answers, but context also turns 4 / 6 / 7
    abstentions into wrong answers, so its confident-wrong count rises in D and E (52 → 55 / 61)."
  - Add a ΔCONFIDENT_WRONG row per mode to the context-gain tables.

### B-14 (P2). The global-context failure is not specific to global context, and "2 / 10" is at chance

- **Evidence.**
  - **Local pairs fail too.** In local pairs the deciding difference is **inside** the crop. Both members right, in
    A and D:
    - Qwen3-VL-2B: 2/16 and 1/16;
    - Qwen3-VL-4B: 2/16 and 2/16;
    - InternVL: 0/16 and 0/16.

    That is no better than the context pairs (`bakeoff-tables.md` lines 275-279).
  - **Answers are constant per family.**
    - Corridor pairs get YES/YES from every model in C, D and E.
    - Inset pairs get NO/NO from every model in every mode where they answer.
    - Wing pairs get NO/NO in A for every model.
  - **The two right pairs change with the mode.** Qwen3-VL-2B's two both-right pairs are different pairs in
    different modes:
    - B: corridor s0-MIRROR and s2;
    - D: wing s0 and s2;
    - C and E: none.
    - In C, with the same plan image as D, the D pairs are answered YES/YES and NO/NO.
  - **A coin flip does as well.** Independent coin-flip answers would score both right on 2.5 of 10 pairs in
    expectation.
  - **The 10 pairs are not 10 drawings.** They are 9 independent scenes from 3 families.
- **Why it matters.**
  - **The report frames the result as a context problem.** It says "The 10 counterfactual pairs whose difference
    lies outside the crop can be decided only from the whole plan … the global-context test fails", and the
    recommendation says "It fails the global-context pairs it was meant to resolve". Both suggest the bottleneck is
    using the whole plan.
  - **The data show that the models do not read the deciding fact anywhere.** A later stage that "fixes context"
    (a better ROI, a larger plan, an overlay) would be aimed at the wrong defect.
  - **PROJECT_STATUS reads it as partial success.** It lists "2/10 global-context pairs" as a property of the best
    model.
- **Fix.** In §4 of the stage report and in PROJECT_STATUS, add one sentence:
  - local pairs, both right in D: 1 / 2 / 0 of 16;
  - 2/10 is at chance (2.5 expected) and moves with the mode;
  - the models answer per family, not per drawing.

  The recommendation is unchanged and gets stronger.

### B-15 (P2). Pair denominators are stated inconsistently

- **The report's "80–100 %".** It is over answered pairs, but for InternVL in D that is 7 of the 10 pairs: 3 pairs had
  an UNRESOLVED member.
- **The tables use two denominators.** In `bakeoff-tables.md`, the context "both right" column is "/ all pairs", while
  the local "both right" column is over answered pairs. For example, InternVL A shows 0/14 although there are 16 local
  pairs.
- **Fix.** Say "of the answered pairs" in the report. Print the local column as "/ all pairs", like the context column,
  or print both.

### B-16 (P2). The gain table's "context-dependent" column still includes the control and a singleton

- `score.py:365` builds `contextDependentOnly` from every `contextDependent` item. In PHASE2 that is n = 23:
  - the 20 context-pair members;
  - **the 2 both-YES control items** (`wing_storey-s0-{A,B}-NORMAL-q1`), where YES in A is right and no context gain;
  - the unpaired `corridor_vs_passage-s1-A-ROT90-q0`.
- This is the residual of B-3 / B-12. The pair metrics are split correctly; this column is not.
- **Fix.** Restrict the column to the 20 context-pair members, or print the control apart.

### B-17 (P2). Context gains are printed without uncertainty

- **The gains are not significant.** Exact two-sided sign tests on the changed answers (gains against losses):

  | model, mode | gains / losses | p |
  | --- | --- | --- |
  | Qwen3-VL-2B D | 11 / 5 | 0.21 |
  | Qwen3-VL-4B C | 15 / 6 | 0.078 |
  | Qwen3-VL-4B D | 11 / 5 | 0.21 |
  | InternVL C | 10 / 3 | 0.092 |
  | InternVL D | 10 / 3 | 0.092 |
  | InternVL E | 12 / 5 | 0.14 |

  - None is below 0.05, and the questions are clustered, so the true uncertainty is larger.
- **The report presents them as gains.** It bolds "+6" for Qwen3-VL-2B D, and Qwen3-VL-2B's C and E are 0.
- **Fix.** Add a paired interval to the context-gain rows. The existing cluster bootstrap (mode minus A) would serve.
  Alternatively, state that no context gain is distinguishable from zero.

### B-18 (P2). Stale or incomplete wording in the corrected documents

- **`input-modes.md`, "Context-dependent pairs".**
  - It says "34 twin-paired benchmark items and 48 of 48 teacher-mining items" and "38 context-dependent items … 4
    ROT90 singletons". These are the **pre-registered** counts.
  - The amended set has 23 context items: 20 paired, 2 control, 1 singleton.
  - The teacher ran on 42 questions, of which 18 are context items. All 18 are crop-identical.
  - Label the old counts as pre-registered, or update them.
- **`input-modes.md`, storey layout.** The line "ground left, upper right" is true only for the real A06/A07
  composites. It should say that synthetic storey renders follow the scene transform, and that the prompt now states
  the layout per transform (`common.STOREY_LAYOUT`). Neither `input-modes.md` nor `synthetic-corpus.md` says this.
- **`synthetic-corpus.md:20` and the `vrgen2.py` docstring.** They say "`--compat 2.0.0` reproduces 2.0.0 byte for
  byte".
  - The renders and the `questions` / `scenes` are byte-identical.
  - `corpus.json` is not: `splitSeedBase` gains `SEALED`.
  - Say "renders and questions byte for byte".

### B-19 (P2). The teacher pair-sensitivity screen tests the wrong quantity

- **The screen.** `recommendation.md` line 54: "same answer to both members of fewer than 10 % of TRAIN pairs".
- **How it can be passed without reading.** A teacher that gives *different but wrong* answers passes it. GAP_KIND
  has three options, so both members can be wrong with different letters. A teacher could also pass by
  anti-correlated noise.
- **What it should test.** The property the stage needs is that the teacher reads the fact that differs, which is
  "both members right".
- **Fix.** State the screen as "both members right on at least X % of pairs whose truths differ (context and local
  reported apart)", with "same answer" kept as a secondary figure.

---

## 4. Checked and OK (round 2)

- **No new leakage path.**
  - The 2.1 class wording, the per-transform layout text and the exclusion list draw only on the stimulus and the
    generator code (`excluded-items.json` → `decided`).
  - No model answer chose an item: the exclusions are complete classes and transforms.
- **Benchmark bytes.**
  - The 6 B-1 items are exactly the non-NORMAL storey records.
  - All other prompts are unchanged.
  - The teacher's phase-1 items are byte-identical to the benchmark's.
- **The scorer.**
  - The amended tables use matched sets.
  - The split pair metrics, the OTHER breakdown and the symmetric net change all reproduce from raw answers with an
    independent script.
- **The 2.1 corpus.**
  - The garage and storey semantics are as documented.
  - TRAIN is generator-only, with all four transforms.
  - The STOREY_COVERAGE 3:1 YES balance is stated (`synthetic-corpus.md:88`).
- **The AB-outline class** does not drive any headline gain (at most ±1).

## Reproduce

- **Pair recount and per-family answers.** Scripts in the scratchpad:
  `/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/r2b/pairs.py` and `ab.py`, run with
  `python3 -I`.
- **`--compat` check.**
  - Run `vrgen2.py --out <scratch> --splits TEST --pairs 5 --compat 2.0.0`.
  - Then `sha256sum` the renders against `/home/user/work005m/sg-test/renders`. Expect 0 differences.
- **Storey panels.** For each STOREY_COVERAGE question in `sg-v21/corpus.json`, compare the `cropPanel` centre with the
  render size.
