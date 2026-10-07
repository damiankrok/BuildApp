# 005M post-review, round 1: Reviewer B (visual-context design, ROI, answer leakage)

Scope: modes A–E as composed (`common.py`, `compose5.py`), answer leakage, the context-dependent counterfactual pairs
and the `vrgen2.py` families, the context-gain section of `score.py`, plan and crop resolution, and mirror/rotation
twins. All work was read-only: files, JSON and 30+ composed PNGs from `/home/user/work005m/items/img/`. No model,
composer or scorer was run.

Summary: **0 P0, 3 P1, 9 P2.** No path leaks the expected answer into a mode. Three design defects still bias reported
numbers.

---

## P1 findings

### B-1 (P1). The STOREY prompt says "ground floor on the left, upper floor on the right", which is false for every MIRROR / ROT90 / ROT180 storey render

- **Evidence.**
  - `common.py:138` hard-codes the layout for every `STOREY_COVERAGE` item:
    `'the two floor plans (ground floor on the left, upper floor on the right)'`.
  - The synthetic storey families put the upper panel to the right of the ground panel in scene coordinates
    (`vrgen2.py:152` `ox = W + ww + gap`, `:189` `ox = W + gap`). The transforms run at scene level
    (`analyzer-005j/synthetic/vrgen.py:276-281`): MIRROR is `x = -x`, ROT90 is `x, y = -y, x`.
  - MIRROR therefore puts the upper floor on the **left**. This is visible in
    `items/img/005m_test-wing_storey-s0-A-MIRROR-q0__planm.png`: "PIETRO" is on the left and "PARTER" on the right.
  - ROT90 stacks the ground floor **above** the upper floor (`005m_test-inset_upper-s1-A-ROT90-q0__planm.png`, 401×768,
    no text labels in that style). The image then gives no other cue, and the prompt actively misleads.
  - Affected benchmark questions, all in phase 2: `wing_storey-s0-{A,B}-MIRROR-q0`, `inset_upper-s0-{A,B}-MIRROR-q0`,
    `wing_storey-s1-A-ROT90-q0` and `inset_upper-s1-A-ROT90-q0`. Each is wrong in modes B–E, so 24 records per phase-2
    model.
  - In the consistency metrics, these are 4 of the 20 mirror pairs and 2 of the 4 rotation pairs.
  - Rerun: `grep -F '"key": "005m:test-wing_storey-s0-A-MIRROR-q0|C_FULL' /home/user/work005m/items/items.jsonl`
- **Why it matters.**
  - Mirror and rotation consistency is a brief metric. On 20 % of the mirror pairs and 50 % of the rotation pairs, it is
    measured against a prompt that contradicts the picture.
  - A model that trusts the text reads the ground plan as the "upper floor". The ground plan always contains the
    wing and the front strip, so this biases toward YES. The wrong answers land on `wing_storey-B-MIRROR` (truth NO)
    and `inset_upper-A-MIRROR` (truth NO).
  - The same defect reaches the student format. `student_dataset.py:72` calls `prompt_for` for every TRAIN/VAL
    question, and `sg-trainval` renders storey scenes in all four transforms. The prompt is therefore wrong for 3 of
    every 4 storey training examples, and the student would learn to ignore the text.
  - The teacher items (`items-train/items*.jsonl`) are NORMAL only, so they are unaffected.
- **Fix.**
  - Derive the layout sentence from the panel geometry: `cropPanel` against the image size gives left/right or
    top/bottom. Alternatively, force panel labels on in storey scenes.
  - Do not transform the composite at scene level for storey families. Mirror each panel in place instead.
  - For the current runs, report storey accuracy and mirror/rotation consistency with and without these 6 questions in
    B–E, and state the defect in the stage report.

### B-2 (P1). One drawing gets opposite truths in two benchmark families: an unmarked front gap of a three-walled garage bay is GARAGE_DOOR in 005M and an open carport (TERMINATES) in 005J, and both are in phase 1

- **Evidence.**
  - **005M `garage_vs_carport`, variant A.**
    - Drawing: a bay walled on three sides, with a door into the house. The front gap is drawn `'OPEN'`
      (`vrgen2.py:82`), so nothing is drawn across it (`vrgen.py:252`, "the wall stops here").
    - Truth: `GARAGE_DOOR` (`vrgen2.py:95`, fact "closed at the back").
  - **005J `garage_door_vs_open`, variant B.**
    - Drawing: a bay walled on three sides, with a door into the house in its back wall. The front gap is also
      `'OPEN'`.
    - Truth: `WALL_CONTINUATION = TERMINATES` and `GARAGE_BODY = NO`, fact "open carport"
      (`vrgen.py:551`, `:567-568`). The text label "WIATA" is drawn only when the style turns labels on, and it is off
      in `s0`.
  - Compare `005j_garage_door_vs_open-s0-B-NORMAL-q0__planm.png` with
    `005m_test-garage_vs_carport-s0-A-NORMAL-q0__planm.png`. The topology is the same. Both are in PHASE1
    (`selection.json`), and the phase-1 ranking decided advancement.
  - The prompt preamble (`common.py:29-31`) says "garage doors are gaps in walls **with thin symbols across them**".
    It agrees with 005J and contradicts 005M's A truth.
  - `synthetic-corpus.md:27` documents the 005M convention but not the conflict.
- **Why it matters.**
  - A model that reads both drawings consistently cannot get both right.
  - The context-dependent result for this family partly measures whether a model adopts 005M's unstated rule
    ("closed at the back implies a garage door"), not whether it reads global context.
    - Affected: 5 `GARAGE_DOOR` items and 4 of the 17 context pairs in phase 2.
  - The TRAIN split (22 pairs) would teach this convention with HIGH-confidence targets. Teacher "hard-example
    mining" would flag the conflict as model failure.
- **Fix.**
  - Pick one convention and record it in `synthetic-corpus.md`.
  - **Option 1: give A a garage-door symbol.** This breaks crop identity, so the family is then local, not context.
  - **Option 2: reword the class to bay enclosure** (closed on all other sides vs drive-through) and drop "garage
    door". Then align or exclude 005J's `garage_door_vs_open` B.
  - For the current runs, add a sensitivity row that excludes `garage_vs_carport` A-variants and 005J
    `garage_door_vs_open` B.

### B-3 (P1). The counterfactual-consistency metric pools forced-identical context pairs with local pairs and includes the both-YES control, so mode A's "insensitivity" is inflated by construction

- **Evidence.**
  - `score.py:129` builds `cf` from every pair whose variant-A member is in the set. That is 33 pairs in phase 2:
    17 context, 8 local `SYNTH_GLOBAL` and 8 `SYNTH_CF`.
  - Lines 139-148 report one `counterfactualSameAnswer` and one `counterfactualBothRight` per mode.
  - In mode A the 17 context pairs are byte-identical requests: same crop SHA, same prompt, same letter order. I
    verified in all 6 runs that the two members get identical answers, so the A figure has a floor of 17/33 = 52 %
    "same answer" by design.
  - Qwen3-VL-2B, phase 2, split by pair type (pairs, same answer, both right):

    | mode | context pairs | local pairs |
    | --- | --- | --- |
    | A | 17, 17, 0 | 16, 14, 2 |
    | B | 17, 14, 2 | 16, 13, 3 |
    | C | 17, 16, 1 | 16, 16, 0 |
    | D | 17, 14, 3 | 16, 15, 1 |
    | E | 17, 16, 1 | 16, 16, 0 |

    The interim table reports the pooled figures: 94 % / 82 % / 97 % / 88 % / 97 % (`score-interim/tables.md`,
    PHASE2 consistency).
  - The pooled 33 pairs also include `wing_storey-s0-*-q1`, where both truths are YES. Same is correct there, and the
    selector itself calls it a control (`select_items.py:95`).
  - `contextDependentOnly` in the gain section also counts these 2 control items and the 4 unpaired ROT90 items
    (n = 38).
- **Why it matters.** "Same answer to both" is presented as insensitivity. For A it is mostly a property of the
  design, and comparing A against C/D/E on this row misleads. The real context signal is how many context pairs have
  both members right in mode X, which is 0 in A by construction. That figure appears nowhere.
- **Fix.** Split every counterfactual metric by `contextDependent`, and exclude or label the control pair. Report
  "context pairs both right" per mode as the primary context-gain read-out beside the transition table. The
  `cf` list should take only pairs whose expected answers differ.

---

## P2 findings

### B-4 (P2). The two A/B candidate outlines share edges, which draw solid, so "outline 2 (dashed)" usually shows only as a fragment; with phase 1's selection, models are scored right for preferring outline 1
- **Evidence.**
  - `compose5.py:98-105` draws outline 1 solid first, then outline 2 dashed in the same cyan, 3 px.
  - Where the outlines share edges, the dashes land on a solid line and vanish. In
    `005j_real-dom-w-morelach-OUTER_BOUNDARY_A_OR_B-1-NORMAL__planm.png` (outline 2 = the body, the correct answer),
    outline 2 shows only as one dashed segment, and the whole body+terrace ring reads as outline 1. Item `-0` is
    the same pair of outlines with the labels swapped.
  - Qwen3-VL-2B (phase 2) answers outline 1 on 56 of 60 records, although the truth is OUTLINE_1 on 7 of 12 questions.
  - Both phase-1 AB questions expect OUTLINE_1 (`select_items.py:65` `first_of_class`, plus gozdzikowcach's first
    by hash). Every model's outline-1 preference therefore scores as right in phase 1.
  - This is a style confound, not leakage: nothing in it comes from the truth.
- **Fix.** Offset outline 2 by a few px inward, or use a second blue hue with a pattern. Alternate which slot is dashed
  per base question. Report the class's answer distribution.

### B-5 (P2). input-modes.md: wrong band count, wrong minimum-size explanation, and the share of non-768 plans and upscaled crops is not stated
- **Evidence.**
  - Line 51 says "on 14 of 90 plan images the production pass found no band". `bands/bands.json` and `raw.json` show
    **18 of 90** with empty `bands`.
  - Line 67 says the minimum comes from "a 449 × 404 storey frame or a 768 × 338 strip". The smallest plan is
    `005j:porch_recess` at **329 × 272**, which gives Qwen's 92 image tokens. 449 × 404 is `corridor_vs_passage`, not
    a storey frame.
  - 49 of 167 plans (all 16 `SYNTH_CF`, 33 of 54 `SYNTH_GLOBAL`) are below 768 px and are sent at native size.
  - 102 of 167 crops are upscaled: bicubic, up to 2.55× on synthetic renders and about 1.6× on most 005K gaps.
  - Line 86 says "D/E cost about 1.3–1.4 × B/C in tokens". That holds only for Qwen (776/578). InternVL is 1.2×
    (1540/1282) and SmolVLM2 is 2.0× (837/419).
- **Fix.** Correct the numbers, and add the plan-size and crop-upscale distribution to "Geometry".

### B-6 (P2). For some questions, mode A is not a close-up, so A→B/C partly measures resolution, not context
- **Evidence.**
  - For all 12 `OUTER_BOUNDARY_A_OR_B` questions, the crop side is 798–1218 px of an 853 px sheet (kc 0.37–0.56). Mode
    A is therefore the whole sheet at half resolution.
  - On the 1351 × 1856 sheet, B/C show the plan at 0.41× (4 GAPSET items, 18–26 px gaps, which become 7–11 px).
    `005k_q036__planm.png` against `__crop.png` shows the difference.
  - On 853 px sheets the plan is 0.9× native, and gaps stay legible (`005k_q011__planm.png`).
- **Fix.** In the context-gain section, flag or exclude the AB class and the 0.41× sheet. Treat A→D/E, which keep the
  crop, as the clean context comparison.

### B-7 (P2). OTHER hides the two transitions that matter most for a confident-wrong study
- **Evidence.**
  - `score.py:188-199` puts RIGHT→UNRESOLVED, UNRESOLVED→WRONG, WRONG→WRONG with a different option, and every FAILURE
    transition into OTHER.
  - In interim phase 1, InternVL's OTHER is entirely UNRESOLVED→WRONG: 1 in C, 3 in D, 1 in E. In those cases context
    makes it commit to a wrong answer.
  - `netRightGain` (line 205) subtracts RIGHT→FAILURE but never adds FAILURE→RIGHT.
- The five named categories match the brief, and the per-question `changes` list keeps from and to, so nothing is
  lost.
- **Fix.** Print the OTHER sub-breakdown in the tables, and make the net gain symmetric.

### B-8 (P2). The overlay legitimately varies between mirror twins and, in one pair, lines up with the answer
- The overlay is the analyzer's own observation; none of it comes from the truth.
- **Evidence.**
  - `inset_upper-s0` NORMAL has 30 and 21 bands, but its MIRROR twins have **0** (wallPx 12). The E prompt then says
    "detected no wall-thick ink on this plan", so E-mode mirror consistency is not same-input consistency.
  - `phantom_line-s0` A (OPENING) has 3 bands, one on the very partition, while B (NOT_A_WALL_LINE) has none. It is
    the only pair whose E prompts differ.
  - Across the corpus, band absence is not correlated with the expected answer.
- **Fix.** Name these cases when reading E-mode gains and mirror consistency.

### B-9 (P2). The ROI marker can cover or blend with evidence, despite the claim at input-modes.md:45
- **Evidence.**
  - In `005k_q036__crop.png` (a NOT_A_WALL_LINE target next to a wall), the left bracket lies on the wall band.
    The offset comes from the gap's wallPx, so it assumes the target sits on a wall axis.
  - In `005m_storey-A06-S2__crop.png`, the cyan ROI is drawn over the publisher's cyan pool.
- **Fix.** Soften the claim, or move brackets clear of ink when the target is not on a wall axis.

### B-10 (P2). The student format has more mode-E and docstring mismatches
- `student_dataset.py:72` always passes `overlay_has_bands=True`, but 23 of 96 TRAIN renders have no bands
  (`bands-train.json`).
- The docstring says each line carries `"prompt"`, but the code writes `"promptTemplate"`.
- **Fix.** Compute the prompt from the composed plan and its bands, and correct the docstring.

### B-11 (P2). The context-gain table mixes set sizes
- `score.py:181` uses phase 2 for models that completed it and phase 1 for the others, and the interim table prints
  both in one block.
- This is labelled, but cross-model reading should use matched sets only: phase 1 for all four models, phase 2 for
  the finalists.

### B-12 (P2). input-modes.md:60 overstates the claim about context pairs
- The statement "the only correct crop-only reply is UNRESOLVED" is right in spirit: the crop cannot see the upper
  floor.
- But the scorer counts YES as RIGHT on the 2 both-YES control items, and "any gain" there is not context gain.
  This ties to B-3.

---

## Checked and OK

- **ROI and overlay colours.**
  - The ROI is cyan `(0,190,230)`, 3 px, with an 18 % fill, and is never red. The overlay is purple `(150,70,200)`.
  - There is no green/red cue. Outline labels are digits, so they cannot collide with option letters.
  - The marker is drawn **over** the overlay (`compose5.py:172`).
- **The modes match the brief and input-modes.md.**
  - A is the crop. B is the unmarked plan plus 0..1000 coordinates. C is the marked plan.
  - D is the same `planm` and `crop` files as C and A. E is `plano` plus the same crop.
  - The prompt text differs only by mode. Images go to the model as base64 data URLs, so no filename reaches it
    (`bench.py:77-84`).
- **Image integrity.** All 668 composed PNGs re-hash to the `imageSha256` recorded in `items.jsonl`, with 0
  mismatches.
- **The overlay comes from production, not truth.**
  - It is the production `planSheet` read through `analyzer-005j/bands.ts`, on the exact source file.
  - It is keyed by source SHA-256, and `compose5.py:149` asserts the hash. There is no truth input.
  - Band presence by class and answer shows no correlation, apart from B-8.
- **No leak through letters, wording, size or shape.**
  - Letter order is per base question: overall A 76 / B 73 / C 18, balanced within classes.
  - Pairs share an order, so their expected letters differ. Twins share an order.
  - Option wording, image sizes and marker shapes do not encode the answer. Every REGION marker is a 4-vertex
    rectangle. Pair members have identical targets, frames and plan sizes.
- **Context pairs.**
  - All 34 benchmark items have `cropIdenticalToPair` true, with crop SHA equal and max abs diff 0. I recomputed this
    myself.
  - All 48 teacher-mining items are identical in the same way.
  - The B and E prompts are identical within every context pair.
  - Mode-A answers are identical across members in all 6 runs (temperature 0 is deterministic).
  - Expected answers differ in 32 of 34 items; the other 2 are the intended control (B-3).
- **The four CONTEXT_FAMILIES really are crop-invariant by geometry.**
  - Garage: the back wall or paving is at least 6.6 m from the gap, and the crop half-side is about 4.5 m.
  - Corridor: the facades are at least 5.5 m away, and the crop half-side is about 4 m.
  - Storey: the crop is clipped to the ground panel. I viewed this for NORMAL, MIRROR and ROT90, and for real A06,
    where the crop stops at the ground frame.
  - The global evidence is legible in the plan modes.
  - The four local families keep their evidence inside the crop (viewed: phantom_line, glazed_front, loggia_vs_room).
- **Generator truth, viewed.** These are correct: `corridor_vs_passage` s0, `wing_storey` s0 A/B, `inset_upper` s1 A,
  `phantom_line` s0 A/B, `loggia_vs_room` s1 B and `glazed_front` s0 B. For `garage_vs_carport` A, see B-2.
- **Mirror and rotation, apart from the B-1 prompt.**
  - The 12 real MIRROR renders are exact pixel mirrors (diff 0), and their targets are exactly `x' = W − x`.
  - Synthetic transforms run at scene level, with targets through the same map.
  - Expected answers are invariant across twins, and no class other than STOREY has left/right wording.
- **Context-gain logic.**
  - A is compared with B/C/D/E on the same question id.
  - The categories are exhaustive, with SAME plus the brief's five, and they sum to n.
- **Resolution and token recording.**
  - Every item records `imageSizes`, and every run record has `imageTokens`, prompt and cached tokens.
  - The medians in input-modes.md match the runs: Qwen 198/578/776, InternVL 258/1282/1540, SmolVLM2 419/419/837.

## Round-2 checks (when the rest lands)

1. The final `matched-bakeoff.json` and stage report:
   - counterfactual metrics split by context and local pairs, with the control excluded (B-3);
   - the OTHER sub-breakdown (B-7);
   - the context table on matched sets only (B-11).
2. The stage report states the storey-prompt defect and gives storey and mirror/rotation numbers with and without the
   6 affected questions (B-1).
3. A garage-convention sensitivity row, and wording in `synthetic-corpus.md` (B-2). Teacher hard-example mining on
   TRAIN `garage_vs_carport` A must not count disagreement there as teacher error.
4. The teacher run (Qwen3-VL-8B, phase 1 in all modes plus 48 TRAIN questions in mode D): confirm it reuses the same
   `items.jsonl` bytes and SHAs, and that the TRAIN items are NORMAL only (true now).
5. The input-modes.md corrections (B-5), and `runtime-size-matrix.md` token figures consistent with them.
6. If the student dataset is regenerated or trained: the storey layout text and mode-E band presence are computed per
   render (B-1, B-10).
7. The AB-outline class: report answer distribution against truth, and do not read phase-1 AB accuracy as reading
   (B-4).

## Images inspected (Read tool)

Synthetic:
- `wing_storey`: s0-A-MIRROR planm and crop, s0-A-NORMAL planm, s0-B-MIRROR plano
- `inset_upper`: s1-A-NORMAL planm and crop, s1-A-ROT90 planm and crop
- `garage_vs_carport`: s0-A crop and planm, s0-B planm
- `corridor_vs_passage`: s0-B planm, s0-A crop
- `phantom_line`: s0-B crop, s0-A plano
- `glazed_front`: s0-B crop
- `loggia_vs_room`: s1-B planm
- 005J `porch_recess`: s0-A planm and crop
- 005J `garage_door_vs_open`: s0-B planm

Real:
- `morelach`: OUTER_BOUNDARY-0 planm, OUTER_BOUNDARY-0-MIRROR crop, OUTER_BOUNDARY-1 planm,
  WALL_CONTINUATION-7-MIRROR plano and crop
- `005k`: q036 planm and crop, q011 planm and crop
- `storey-A06-S2`: planm and crop
