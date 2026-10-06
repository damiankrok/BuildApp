# Post-review C — training data and evaluation design (BUILDPLAN-ANALYZER-005J)

**Reviewer:** C (training data, leakage, real questions, scoring, training plan). Independent; other reviews not read.
**Verdict: CONDITIONAL PASS.** TRAIN_BUILDPLAN_WALL_MODEL stands. My recomputation makes the measured case for it
*stronger* than the draft states, but several numbers and stated limitations come from errors in question geometry, not
from the models. The 005K data and evaluation plan also cannot yet close the gaps it names. Six P1 findings must be
fixed or stated before the recommendation stands. No P0.

VLM numbers and ⟪…⟫ placeholders are excluded, as instructed. Every number below was recomputed from the files named.
Real frames were read **in memory only**: nothing derived from publisher pixels was written anywhere. My scripts are in
the session scratchpad (`revC/*.py`) and are not part of the repository.

## Summary

| # | sev | finding |
| --- | --- | --- |
| C1 | **P1** | REAL_DEV gap targets sit on the **outer wall face**, while synthetic and blind-8 targets sit on the **centreline**. The REAL_DEV wall-referee numbers and the SegFormer "20 confident-wrong" are mostly this artefact |
| C2 | **P1** | gozdzikowcach porch-mouth question: the B flank and the "pier" box are ~18 px **left of the pier**. Moved onto it, both wall models answer TERMINATES at ≥ 0.97 |
| C3 | **P1** | The cyklamenach analogue does not test the cyklamenach confusion: PATTERN sits 2.5–3.5 m away at the terrace's far edge. No set, synthetic or real, has a PATTERN negative on a wall line |
| C4 | **P1** | The 005K generator v2 fixes the open-gap shortcut one-sidedly: it adds no faint-symbol hard positives, the opposite error a real sheet already showed. Counterfactual pairs are not minimal |
| C5 | **P1** | The real evidence base is 8 distinct minority targets (3 of them gap questions, 0 PATTERN). The ≤ 0.5 % gate cannot be demonstrated with ≥ 50 minority questions |
| C6 | **P1** | The legal-training claim contradicts Route C's data row (training on verified real development crops). The teacher's output-use terms and automation bias are unaddressed |
| C7 | P2 | Question class ↔ family coupling; label-text and location cues; the "held-out seeds" score is in-template |
| C8 | P2 | `synthetic-corpus.md` inaccuracies (dimension chains, 87 pairs, "same drawing"); two dead target guards in `vrgen.py` |
| C9 | P2 | Scorer: non-deterministic majority tie-break, UNRESOLVED counted as consistent, the lenient parser's first-word / confidence-1.0 rule, pseudo-replication |
| C10 | P2 | Pilot train/test composition mismatch (256 native vs 512→256). Re-run: the Route-C conclusion holds |
| C11 | P2 | "Pre-registered" rules were written 72 s after the blind-8 region shares; model selection on dev/blind-8; minority tally wording |
| C12 | P2 | REAL_DEV label quality (bbox of an L-shaped exclusion is 35 % inside the house); further one-sided classes |
| C13 | P2 | No question probes the cyklamenach interior junction, the second half of its 005I diagnosis |
| C14 | P2 | Training-plan unit mismatch (scenes vs tiles) in the compute estimate |

## What I verified as sound

- **Synthetic truth comes from semantics.** I read all 18 families against `CLASSES`. Every expected answer is
  assigned from the scene's construction (`vrgen.py:487–1036`).
  - 672 / 1,792 / 1,196 questions (benchmark / pilot / real) all have an expected answer inside the enum and never
    UNRESOLVED.
  - No base question's truth changes across transforms.
  - The transform is applied in `render()` to every primitive, and `M` is applied to every target, before
    rasterisation. Text stays upright. OUTER_BOUNDARY letters move with the drawing.
- **Seed separation is exact.**

  | corpus | seed rule | values |
  | --- | --- | --- |
  | benchmark | 50050+1000·f+k, k<3 | 50050–67052 |
  | pilot | 60060+1000·f+k, k<8 | 60060–77067 |
  | wall train | 70000+…, k<10 | 70000–87009 |
  | wall test | 90000+…, k<3 | 90000–107002 |

  Across all six pairs of sets: 0 shared seeds, 0 identical style dicts (54 / 144 / 180 / 54 distinct), 0 shared render
  SHA-256 and 0 shared item-image SHA-256.
- **No real or blind-8 pixel was used for training.** All 1,792 pilot items are `SYNTHETIC`. `trainset.py` renders
  only `vrgen` scenes. `wallnet.build()` and `MicroReferee` start from random initialisation, and the checkpoints
  record `pretrained: NONE`. Real frames feed only `wallnet eval`, `blind8_regions.py` and `wall_referee.py`.
- **The pilot figures recompute exactly.**
  - SYNTHETIC 574/672 = 85.4 %, CW 18/672 = 2.7 %, 0 at ≥ 0.98.
  - REAL_DEV 280/564 = 49.6 %, CW 34.0 %, 1.24 % at 0.999.
  - Majority floor 430/564 = 76.2 %; SYNTHETIC floor 348/672 = 51.8 %.
- **The cyklamenach blind-8 geometry is right.** The north band's dark runs are x 132–165, 255–308 and 398–434, so the
  window (165–255) and the door (310–397) targets sit exactly on the gaps.

## Findings

### C1 — P1. The REAL_DEV gap targets are on the outer face of the wall; the referee's real numbers measure that, not the model

**Evidence.**
- In all 7 005I truth files, every opening endpoint lies at **0.0 px** from the exterior outline (median and max). The
  exterior wall is 16–22 px thick.
- `realq.py` builds OPENING_VS_PATTERN and WALL_CONTINUATION segments from those endpoints. CANOPY "solid wall"
  segments come from the outline edges.
- `wall_referee.py` reads a ±0.18 m strip (≈ ±9 px) centred on the segment, so half the strip lies outside the
  building.
- Synthetic targets (vrgen centrelines) and the hand-placed blind-8 targets are on the centreline.
- Median UNet strip shares on OPENING_VS_PATTERN (`bench/wall-unet.jsonl`):

  | set | background | opening |
  | --- | --- | --- |
  | REAL_DEV | 0.51 | 0.46 |
  | REAL_BLIND8 | 0.08 | 0.90 |
  | SYNTHETIC | 0.05 | 0.90 |

**Recomputed.** Same pre-registered `decide()`, same checkpoints, NORMAL transform, each segment moved half a wall
inward (63 distinct openings):

| model / class | as committed | on the centreline |
| --- | --- | --- |
| UNet, OPENING_VS_PATTERN (all OPENING) | 23 right (0 confident), 40 unresolved | **60 right (47 confident)**, 3 unresolved |
| UNet, WALL_CONTINUATION = CONTINUES | 21 right, 41 unresolved, **1 confident-wrong** | **50 right (44 confident)**, 13 unresolved, 0 wrong |
| SegFormer, both classes | **10 confident-wrong** per transform | **2** confident-wrong |

The two recess-mouth TERMINATES questions should stay as committed, because the mouth line is not a wall line.

**Consequence.**
- REAL_DEV coverage 35 % and useful coverage 3.3 % (`wall-model-proof.json` → `unet.referee`) are geometry artefacts.
  ⟪UNET_REF⟫ / ⟪SEG_REF⟫ will inherit them.
- SegFormer's verdict reason "20 confident-wrong on REAL_DEV gap questions" (`verdicts.json`) is mostly the same
  artefact. DEFER still stands on latency, memory, the real opening-pixel metric and the missed garage door.
- In the other direction, the real *question-level* transfer is far better than reported.

**Required.**
- Use one target convention for every set: the centreline, or better, the gap rectangle across the full wall
  thickness.
- Re-score the wall referees and restate §F/§G, `verdicts.json` and training-plan "what it is not yet" (2).
- In 005K the witness must read the analyzer's gap rectangle across the wall, not a strip around a line, and the real
  gate set's geometry must be checked against pixels before use.

### C2 — P1. The gozdzikowcach porch-mouth "pier" is mis-placed; the "pier read 36 % wall" limitation is a question error

**Evidence.**
- The front-line dark runs in the frame (y 578–596) are x 270–310 (left stub), **435–463 (the pier)** and 591–646.
- The porch mouth is therefore 310–435: 125 px ≈ 3.16 m, matching the printed 317 dimension.
- `realq.py` BLIND8 places three things short of that:
  - the porch-mouth question's B flank at 417–436;
  - TERRACE_VS_BODY's porch at 312–417 (2.65 m);
  - `blind8_regions.py`'s "pier between porch and garage" box at x 418–434.
- That box holds the porch floor plus the end of the vestibule wall. Its "36 % wall / 64 % background" reading is
  *correct* for that box.
- With B moved onto the pier (436–455), the same `decide()` gives:
  - UNet **TERMINATES, conf 0.982** (A 0.93, B 0.75 wall; gap 0.98 background);
  - SegFormer **TERMINATES, 0.969**.
- The true pier box (435–452 × 541–590) reads 100 % wall in both models.
- The question as composed also tells every model and the oracle that "wall piece B is inside the blue box" when the
  box contains no wall, so it is malformed for every arm.

**Required.**
- Correct the three coordinate sets and re-score every model on that question.
- Delete or replace limitation (3) in `training-plan.md`, report §G, `recommendation.md` ("What the wall proof is not",
  item 3) and `verdicts.json`.
- 005K needs a geometry check (a dark-run or mask profile across each target) for every hand-placed real question.

### C3 — P1. The synthetic cyklamenach analogue tests an easy negative, and nothing tests the real one

**Evidence.**
- In `fam_glazing_terrace`, A's target is the window on the house wall (`seg = [(s0, 0), (s0+ww, 0)]`, `vrgen.py:835`).
- B's target is a break in a hatched kerb at the terrace's far edge (`[(s0, ky), …]` with `ky = -td`, td 2.5–3.5 m,
  `:845`), with blank paper beyond. The docstring's "at the same place" is not what the code does. Measured A→B target
  shift is up to 3.32 m. I viewed `glazing_terrace-s0-{A,B}-NORMAL-q0__CANDIDATE_OVERLAY.png`: in B, no solid wall is
  anywhere near the box.
- PATTERN is produced by **only** `glazing_terrace:B` (class × answer → family map over the benchmark).
- Real sets hold **0** PATTERN questions: REAL_DEV 63/63 OPENING, blind-8 2/2 OPENING.
- So the wall models' synthetic PATTERN scores (UNet 5/12 right, 6 unresolved, 1 confident-wrong; SegFormer 9/12)
  measure a location-separable case. No set measures whether a model over-calls OPENING at a hatch or texture break
  lying on a wall line, which is exactly what a witness that may upgrade WEAK→STRONG must not do.

**Required.**
- In v2, put pattern breaks on or along the facade line: wall-thick hatched or dashed bands abutting or coinciding with
  the facade, terrace texture lines meeting a plain wall, and dashed overhead lines along the facade.
- Make PATTERN an explicit minority type in the real gate set.
- Fix the docstring and `synthetic-corpus.md` §2.

### C4 — P1. Generator v2's hard negatives push one way; the pairs are not minimal

**Evidence.**
- The shortcut is real. In `garage_door_vs_open:B` (an empty carport gap, viewed) UNet answers CONTINUES 8/12 with gap
  open-share 0.80–0.97.
- The opposite error already exists on a real sheet: SegFormer reads the gozdzikowcach garage door as 82 % background.
  That house's 005I failure is itself a thin garage-door symbol inside a "gap" read as open.
- The v2 list (`training-plan.md:45`, `recommendation.md` deliverable 1) adds open-gap negatives but **no paired hard
  positives**. Missing: faint, single-line, dashed, low-contrast or JPEG-eroded garage and sliding doors; callout rings
  sitting in the gap (as `105/210` does on gozdzikowcach); watermark strokes across gaps.
- Part of the measured "shortcut" is a generator artefact. In `multi_window:B`, `sc.rect_line(g0-1, D+t/2, …)`
  (`vrgen.py:869`) draws the terrace outline along the wall's outer face **across the gap**, a thin line where a
  window's outer pane line would be. An unglazed hole in a heated room's facade is also not a real architectural case.
  v2 negatives should be the realistic ones the plan lists: porch mouths, carports, recesses with returns.
- The pairs are not minimal. Diffing A/B scene primitives for the 54 benchmark pairs:
  - the interior partition moves in 12/18 families (RNG streams diverge after the first variant-dependent draw);
  - in `bay` every facade's windows are re-drawn (8/8 walls differ);
  - in `porch_plus_garage:B` the garage, car, hall and stair all disappear;
  - in `detached_garage` the garage-door width changes.

  This is random nuisance, not a shortcut, but "differ by one semantic fact" holds only semantically.

**Required.**
- v2 pairs open negatives with faint-symbol positives in the **same** scene template.
- Draw the RNG for nuisance geometry before the variant branch, so pairs differ only by the fact.
- Gate both directions: TERMINATES/PATTERN minority **and** faint-symbol CONTINUES/OPENING.

### C5 — P1. The real evidence base is tiny, and the 005K gate cannot be shown at the planned size

**Evidence.**
- REAL_DEV gap items are the **same 63 openings** asked as two classes, times two transforms.
- The "18 minority questions" (§G, training plan) are **8 distinct targets in 6 houses**: 5 pergola far edges and 3
  TERMINATES (2 dev recess mouths, 1 blind-8 porch mouth). Only 3 are gap questions, and none is PATTERN.
- Real "transforms" are pixel flips of one frame, and a flip/rot-augmented CNN is near-invariant to them. They add no
  independent evidence.
- The 7 dev sheets yield about 0.3 TERMINATES and 0 PATTERN per sheet.
- With zero confident-wrong in n independent questions, the 95 % upper bound is 1 − 0.05^(1/n):

  | n | upper bound |
  | --- | --- |
  | 50 | 5.8 % |
  | 100 | 3.0 % |
  | 598 | 0.5 % |
  | 1,497 | 0.2 % |

  Gate 1 is **per class**. "≥ 50 minority questions", then split for threshold freezing, cannot evidence ≤ 0.5 %.

**Required.** 005K must state:
- the unit (one distinct gap on one sheet; transforms not counted);
- how many sheets will be read and where they come from (≥ 50 minority gaps implies on the order of 100+ further
  development sheets, or targeted collection);
- per-class n and the val/test split;
- the gate as an upper confidence bound, or as "0 confident-wrong in N (bound X %)".

### C6 — P1. The legal-training statement is inconsistent for Route C, and the teacher is unexamined

**Evidence.**
- Report §H says every route trains only on BuildPlan synthetic data "plus, for evaluation and calibration only,
  verified answers on real development crops".
- `training-plan.md:59` (Route C data) says "the Route-B corpus plus real-style rendering; **every verified real
  development crop**". Report §H's table says "human-verified real labels from an offline teacher".
- So Route C as planned trains on publisher crops. Either Route C is synthetic-only (real crops for evaluation and
  calibration), or the claim must say publisher crops become training data and route that through licensing.
- **Route B as planned is clean** (verified above). Freezing thresholds on real crops fits a few scalars to publisher
  pixels; it is stated, and in my view acceptable.
- The teacher:
  - `licensing-matrix.md` lists the in-session oracle as "measurement only". Using a proprietary model's outputs to mine
    and pre-label training candidates needs that provider's output-use terms checked.
  - Human verification of teacher pre-labels invites automation bias, in exactly the cases where 005J's oracle hedged
    (open carports). The **gate set** should be labelled blind to the teacher; the teacher may at most choose which
    crops to look at.
- "Publisher-like fonts and watermarks" must stay generic: no publisher mark reproduced.
- **Required:** reconcile §H with the Route C data row, and add a teacher-terms line.

### C7 — P2. Generalisation is untested: class ↔ family coupling and text/location cues

**Evidence.**
- In 8 of 13 classes, each answer comes from exactly one family-variant: BAY, STOREY, VOID, TERRACE_VS_BODY,
  OPEN_SIDE (both answers), OPENING_VS_PATTERN:PATTERN, DIMENSION:ANNOTATION, OUTER:NEITHER. A trained classifier can
  learn template identity.
- Room labels are on in 65 % of scenes. In 7 families the label text is tied to the answer by construction:
  GARAZ/WIATA, GARAZ vs PATIO, POKOJ/TARAS, PERGOLA/OGROD ZIM., SCHODY, PUSTKA/ATRIUM, DACH.
- The pilot's "85.4 % on held-out seeds" is therefore **same-template** performance.

**Required (005K synthetic gate, and Route C).**
- Ask every class across every family where it applies.
- Hold out whole families and style values.
- Report counterfactual sensitivity split by labels on/off.

### C8 — P2. Corpus documentation and dead code

**Evidence.**
- (a) `sc.dim()` is called only in `fam_dim_vs_building` (`vrgen.py:948`), so the "dimension chains 0/1/2 per pair"
  axis (§4 of `synthetic-corpus.md`) has no effect in the other 17 families.
  - Dimension chains exist in 3 benchmark scenes.
  - The wall proof's "false wall on dimension lines 3.8 %" rests on 3 test renders with one line each.
- (b) The benchmark has **81** counterfactual pairs plus 6 unpaired questions, not "87" (72 with different truth is
  correct).
- (c) "The same drawing" is not literal (C4).
- (d) Two guards meant to keep WALL targets off windows never act:
  - `fam_pergola_line` (`:733–735`, body is `pass`);
  - `fam_canopy_roofline` (`:761–763`): it edits `walls[-2]`, which after `_rooms()` is the extension's south wall, not
    the windowed east wall.
  - The answer WALL is still defensible.
- (e) `outer_boundary_mix` A and B render byte-identical drawings (all 12 benchmark pairs; 3 + 1 duplicates in the wall
  train/test sets). This is correct by design, since the fact is in the candidates, but it should be said.

### C9 — P2. Scorer details (`score.py`)

**Evidence.**
- (a) `majority_baseline` breaks ties with `max(set(ex), key=ex.count)`, which follows per-process string-hash order.
  Synthetic classes are exactly tied, so the synthetic "minority" sets differ between runs:
  - WALL_CONTINUATION majority = CONTINUES in `micro-score.json`, TERMINATES in the wall runs;
  - CANOPY = WALL (UNet) vs NOT_WALL (SegFormer).

  Use enum order, or report both answers.
- (b) `consistency.rate` counts UNRESOLVED=UNRESOLVED as agreement (UNet mirror 94.6 % vs 89.3 % on answered pairs).
  Quote only `rateWithAnAnswer`.
- (c) GEN_LENIENT has two problems:
  - It takes the first enum word and gives it confidence 1.0 whenever strict JSON fails, even when the text carries
    `"confidence": 0.0`.
  - In SmolVLM2's run, 307/611 generations are lenient-only, 183 of them the first enum option. That option is the
    REAL_DEV majority answer in every non-tied class (OUTER is 50/50), so lenient accuracy there partly measures
    first-option bias.

  Parse the confidence field without braces, and add a first-option constant baseline.
- (d) Pseudo-replication: BODY_REGION and TERRACE_VS_BODY ask the same REAL_DEV boxes; the two gap classes ask the same
  63 gaps. Report distinct-target n.
- The confident-wrong, coverage and counterfactual formulas themselves are correct as pre-registered.

### C10 — P2. Pilot composition mismatch (conclusion unaffected)

- The pilot trained on 256-px compositions (3 px overlay, 22-pt letters) but predicted on 512-px compositions
  down-sampled to 256 (≈ 1.5 px, ≈ 11 pt).
- I re-composed every CANDIDATE_OVERLAY item at 256 in memory and re-predicted:

  | set | accuracy (as reported → native 256) | CW@0.80 (as reported → native 256) |
  | --- | --- | --- |
  | SYNTHETIC | 85.4 → 88.4 % | — |
  | REAL_DEV | 49.6 → 46.5 % | 34.0 → 37.4 % |
  | REAL_BLIND8 | 70.6 → 69.1 % | 7.4 → 14.7 % |

- **"Negative on real" holds.** Say so, and use native composition in 005K.

### C11 — P2. Pre-registration and independence wording

- `wall_referee.py` was last written at 16:28:44, **72 s after** `unet-blind8-regions.json` (16:27:32) printed the
  blind-8 shares, and after `unet-eval.json`.
- The thresholds are round numbers and one of them went against the model, so I do not allege tuning. But "fixed before
  any output" should read "fixed before the referee run, after the region shares were seen".
- UNet-vs-SegFormer selection used REAL_DEV and blind-8. Two families were designed as analogues of the blind-8 houses.
  So "reads the decisive round-8 gaps" is targeted development evidence, not a held-out result.
- `verdicts.json` "minority 10/12 right, 2 confident wrong" should read: 10 right, 2 wrong, **1** confident-wrong
  (azaliach pergola edge, WALL at 0.739 / 0.845).

### C12 — P2. REAL_DEV label quality and further one-sidedness

- The willa-miranda north-terrace BODY_REGION NO / TERRACE_VS_BODY EXTERNAL box is **35 % inside** the truth exterior.
  It is the bbox of an L-shaped exclusion (`realq.py`, `box(*poly.bounds)`).
- Main-body quadrants go down to 88 % inside. Use the polygon or its largest inscribed rectangle.
- GARAGE_BODY (4/4 YES) and BAY (2/2 YES) are one-sided too. §O.3 mentions only the gap classes.

### C13 — P2. Blind-8 coverage

- The 005I record (`blind-round/README.md` #2, step 2) names a second cyklamenach error: a 12.79 m interior junction
  read as a separating wall, which REJECTED the completion.
- No 005J question probes it. 005K gate 5 ("first bad decisions must move") could pass while the verdict does not flip.
- Add a junction question to the dev set.

### C14 — P2. Estimate units

- Route B data is "20–50k **scenes**"; compute is "50k **tiles** × 30 epochs".
- A scene is about 6–10 256² tiles, so 50k scenes × 30 epochs ≈ 10–15 M tile passes. One 4090 at 1–3 h stays plausible
  for UNet-lite.
- On CPU, at the measured 6–10 tiles/s per contended core, the "1–2 days" becomes about 3–7 days.

## Answers to the five focus questions

1. **Synthetic truth.**
   - Derived from semantics in every family.
   - Transforms are applied before rasterisation, and the answers are invariant.
   - Pairs differ by one *semantic* fact but are not minimal (C4).
   - The cyklamenach analogue is a weak counterfactual (C3).
2. **Leakage.** None at the seed, style or pixel level, and no real pixel in any training set. All synthetic splits
   share the same 18 templates (C7). Blind-8 shaped the generator and the model choice (C11).
3. **Real questions.**
   - Derived mechanically from the 005I truth. The one-sidedness is disclosed for the gap classes; the dataset is in fact
     smaller (C5) and further classes are one-sided (C12).
   - The blind-8 expected answers agree with the 005I diagnosis.
   - Two geometry errors change stated results: outer-face targets (C1) and the gozdzikowcach pier (C2).
4. **Scoring.**
   - The core formulas are correct.
   - A model can be credited for: the first-option / lenient-parse bias, text labels, the glazing_terrace location cue,
     and UNRESOLVED-as-consistent.
   - The minority readout for synthetic sets is not reproducible (C9).
5. **Training plan.**
   - The estimates agree with the measured timings (C14 aside).
   - "Route C negative" is supported, and robust (C10).
   - Route B's real transfer is under-reported (C1, C2).
   - The 005K data plan is directionally right but not sufficient: it needs one-sided-shortcut balance (C4), PATTERN on
     wall lines (C3), and a real set sized and sourced to the gate (C5).
   - The legal claim holds for Route B; for Route C it is contradicted by its own data row (C6).

## Position on the primary recommendation

TRAIN_BUILDPLAN_WALL_MODEL is the right primary.

- On correctly placed targets, the from-scratch, synthetic-only UNet-lite answers 60 of 63 real development openings
  OPENING (47 confidently) and 50 of 63 continuations CONTINUES (44 confidently), with no confident-wrong.
- It reads the corrected gozdzikowcach porch mouth as TERMINATES at 0.98.
- That is a stronger and cleaner basis than the draft claims, for the one class of seam that caused both round-8
  failures.

What the stage has *not* shown is discrimination on real sheets:

- 3 real open-gap targets and **zero** real pattern-break targets exist;
- the synthetic pattern negatives are separable by location;
- the synthetic open-gap shortcut and the real faint-garage-door miss pull in opposite directions.

The recommendation therefore stands on three conditions:

1. Correct the question geometry, re-score, and restate the limitations (C1, C2).
2. Write into the 005K plan two-sided hard examples (C3, C4) and a real gate set sized for the bound it claims (C5).
3. Make the legal statement match the Route C data plan (C6).

None of these changes the choice of action.
