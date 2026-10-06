# Reviewer F — generalisation red team (BUILDPLAN-ANALYZER-005J, post-replay recommendation)

**Verdict: CHANGES REQUESTED.** One P0 and eight P1.

The oracle replay is well built. With the oracle OFF it reproduces the sealed model hashes. I checked that it also
reproduces the sealed failure diagnostics, field for field, on the six valid failing rows. Its key number was predicted
before it ran: the opportunity map, written at 16:03, says "~127.3 m² (−3.9 %)"; the replay ran at 17:53 and gave
127.54 m². That deserves credit.

But the replay does not show what the decision table uses it for. On every row that was measured, the witness and the
deterministic rule it is meant to beat give the same outcome. The evidence that the proof model's "no" adds anything is
small, comes from development houses, and goes against it at the one hard real case. The transfer claims rest on one
publisher and on placement information taken from the truth.

Independence: I did not open reviewer-A/C/D/E or `resolution.md`.

## How I checked

I recomputed everything below from raw outputs. Nothing under `/home/user/BuildApp` was modified except this file. My
scripts and outputs are in the session scratchpad, outside the repository.

- **Replay table.** `oracle-replay.json`, the replay logs `/home/user/work005j/replay/{dev,round8}/*.log`, and every run
  directory's `failure.json`, `result-summary.json` and `plan-diagnostics/digest.json`. I also ran `holdout/verdict.mjs`
  on the sealed and replayed run of `rarytasy-g2e`.
- **UNet witness at every gap the oracle upgraded.**
  - Checkpoint: the 005J UNet (`/home/user/work005j/wall/unet.pt`, run through `wallproof/wallnet.py`).
  - Gaps: every one the oracle upgraded, parsed from the `ORACLE_UPGRADE` log lines (gozdzikowcach, plus 15 development
    houses).
  - Frames: the gozdzikowcach frame (`frames/dom-w-gozdzikowcach.rgb.png`). For the development houses I reconstructed
    the frame from each run's `plan-diagnostics/*-source.png`, which is the frame lightened linearly
    (`b = 0.4136·a + 149.86`; correlation with the original 0.99993).
  - Strip placement: three readings per gap.
    1. "face": a strip on the production `linePx`.
    2. "jamb axis": the centroid of the rows where the model sees WALL in the 8 px just outside both ends of the gap.
    3. An offset sweep of ±16 px.
- **Offset and side sweep of `axis_remeasure.py`.** Same code and checkpoint. The inward offset was set to 0.10–0.35 m,
  with the inward side either taken from the truth outline (as in the stage) or flipped.
- **Small models on the oracle's own items.** The VLM bench re-scored on the 148 items the oracle answered
  (`oracle/key-DO-NOT-SHOW.json`, `bench/*.jsonl`).

## Findings

### F1 — P0 — The reason given for rejecting NO_AI_YET does not distinguish it from the primary

`recommendation.md:14` rejects NO_AI_YET because "a perfect gap witness moves gozdzikowcach, and the proof model reads
that gap correctly". The stage's own replay shows the deterministic rule does exactly the same.

- **gozdzikowcach.** ALL_DRAWN (no model) yields model `2d08931b…`. So do ONLY-041 and the run labelled "TRUTH".
- **Development matrix.** ALL_DRAWN keeps the sealed hash on every completed valid row except zurawkach.
- **So on 21 of 21 replayed valid rows the witness's upper bound and the deterministic rule cannot be told apart.**
  `recommendation.md:29` and `:90–100` concede this, so the document contradicts itself: §1 still lists a rejection
  reason that §2 and §4 show proves nothing.
- **The only value claimed for the witness is that it says "no" to drawn-but-open gaps.** Two such readings exist on
  real sheets, and the outcome depends on neither:
  - the porch front (in the stage);
  - `gap-X-413` (F3, found here).

NO_AI_YET therefore is not rejected on evidence. TRAIN_BUILDPLAN_WALL_MODEL is a hypothesis about unseen drawing styles,
with **no** measured advantage in outcome.

**Required:** either restate the §1 row ("outcome-equivalent on every measured row; deferred as fallback, not rejected")
or invert the primary (see my position at the end).

### F2 — P1 — The replay's "verdict" column is not the holdout verdict

- **Two conditions cannot fail on replay outputs.** `second-house.ts` writes a `result-summary.json` without
  `warningDetails`. So `holdout/verdict.mjs:63–69` cannot fail `openingsAllBuilt` or `resolvedWithAWitness` on a replay
  output.
- **Sealed and OFF verdicts disagree on 9 of 21 valid rows.**
  - Eight failed runs (six development rows and both round-8 houses): ALGORITHMIC_FAIL →
    PENDING_RAW_LEGIBILITY_MEASUREMENT. The replayed run directory has no `observation-graph.json`. The legibility
    check `overall.every(...)` therefore runs over an empty token list and is vacuously true (`verdict.mjs:40–50, 93`).
  - `rarytasy-g2e`: sealed ALGORITHMIC_FAIL ("1 opening the drawings print was not built: opening-0-east-5-1"), but OFF
    reads PASS with the **identical** model hash `9f5fd342`.
- **Consequences in `recommendation.md`.**
  - `:65` lists rarytasy-g2e among "every PASS row".
  - "0 verdicts change" is shown only for the storeys and footprint conditions.
  - Of the conditions a gap upgrade could plausibly move, `openingsAllBuilt` is never evaluated.
- **What still holds:** the hash-level claim, "no PASS row's model changes".
- **Matrix coverage is not disclosed.** Three rows (`eoze-legacy-area`, `eoze-legacy-every`, `kosacce-area-alone`) were
  SKIPPED because their graph or metric files are missing (`replay/dev/summary.txt`). The report says neither this nor
  that the matrix has 24 rows.
- **Fidelity counts differ between documents.** The stage report says "21 of 23 runs"; `recommendation.md` says
  "19 of 19 valid rows".

### F3 — P1 — The "TRUTH" run is not truth, and ALL_DRAWN bridges walls that do not exist

The gozdzikowcach "TRUTH" run is `EXCLUDE gap-Y-598-312-434`. It upgrades the other nine gaps, which were never
checked.

**One of them, `gap-X-413-239-353` (2.87 m, DASHED), is a vertical line through a room interior.**
- Between the walls at y ≈ 238 and y ≈ 353, at x ≈ 405–421, there is no wall ink: only room-label strokes at
  y 292–308 and a few isolated marks.
- One end is a wall stub. The wall ends there, so this is a TERMINATES case.
- The UNet reads it **100 % BACKGROUND at every offset (±16 px)**; ALL_DRAWN turns it into a STRONG "opening".

Three consequences:
1. The run's name overstates verification: 1 of 10 gaps was checked.
2. The fallback that §4 and §5.8 call "already measured" is cruder than `recommendation.md:91` says. Its eligibility is
   "WEAK, WALL/WALL jambs, signature not BLANK", which also covers phantom stretches through rooms. It has been
   measured for **outcome only**, never for decision correctness.
3. In fairness, this is a second real case where the witness correctly says no — in favour of the model, though again
   with no effect on the outcome.

**Required:** rename the run (EXCLUDE-porch) and state which gaps were verified.

### F4 — P1 — The reading of the decisive gap has no record, and it depends on where the strip sits

"≈ 94 % OPENING, rows 542–550" (stage report `:282`; the verdict string of `wall-model-proof.json`) appears in no
artifact. It is not among the `blind8_regions.py` REGIONS or in `unet-blind8-regions.json`.

**Recomputed UNet OPENING share over x 322–338, by row band:**

| strip | OPENING share | what the rule makes of it |
| --- | --- | --- |
| centred on 538 (the production `linePx` is 537.5, a face) | 0.07 | — |
| face strip 531–545 | 0.30 | UNRESOLVED under the pre-registered rule |
| rows 542–550 | 1.00 | OPENING |
| jamb band 540–556 | 0.88 | OPENING |

MiT-B0 reads 0.17 on the face strip and 0.77–0.81 on the band.

**The gap is almost blank.**
- 8.3 % of its pixels are below grey level 200, and none below 128.
- One thin line crosses it, at row 549 (row mean 190).
- The model reads the left jamb (x 314–321) as OPENING, not WALL, so a two-jamb axis rule finds no axis. Only the
  vestibule wall gives one.

**So the reading holds only with a one-jamb axis.** That axis is what 005K-a item 1 (`axisPx`) would provide, so the
reading is reproducible in principle. But it is also exactly what the documented shortcut predicts, and it is not
evidence that the model discriminates: on synthetic counterfactuals open gaps read 44.5 % OPENING, with 12
confident-wrong CONTINUES.

**Required:** record the box and rows as an artifact, and state that the placement is the one-jamb band.

### F5 — P1 — The axis re-measurement takes its inward side from the truth, and the real set has one class

**The offset constant is not the problem.** Inward means the side inside the 005I truth outline
(`axis_remeasure.py:38`). I swept the offset:

| inward offset (m) | 0.10 | 0.15 | 0.18 | 0.22 | 0.26 | 0.30 | 0.35 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| openings right of 63 | 52 | 58 | 59 | 61 | 58 | 57 | 54 |

0.22 m is the best value but not a knife edge.

**The side is the problem.** With the side flipped (offset 0.22 m), it gets **0 of 63 right, with 61 confident-wrong
PATTERN**; at 0.26 m and above, 63 of 63 confident-wrong. All 65 continuations become UNRESOLVED.

So 61 of 63 is an upper bound with the truth's side. Production placement has not been measured on these 63 questions:
`axisPx` from jambs that run along the line, or `linePx` when neither does (`boundary-evidence.ts:437`).

**The real set has one class.** All 63 openings expect OPENING (63/65 continuations expect CONTINUES). A constant
"OPENING" answers 63 of 63; a constant "CONTINUES" 63 of 65. "Transfers to real sheets" here means recall on positives
with oracle placement. `recommendation.md:26` and `:235` must say so.

### F6 — P1 — On real sheets, the evidence that the model can say "no" is 7 questions with 1 confident wrong

The REAL_DEV NORMAL minority questions are 5 NOT_WALL and 2 TERMINATES. On the axis, the UNet gets 6 right and 1
confidently wrong: `real-dom-w-azaliach-CANOPY_PERGOLA_VS_WALL-0` reads WALL at 0.83.

- **The other four NOT_WALL targets are easy.** They are isolated lines at the sheet margin (y = 35–80 px).
- **The one hard case is the miss.** The only NOT_WALL target next to the building (azaliach, x = 800) is the one the
  model gets confidently wrong.
- **The rate is far from the gate.** 1 confident wrong in 7 is 14 %, with a Wilson 95 % upper bound of **51 %**, against
  a gate of 0.5 %.

This is the only real measurement of the one value the witness claims (gate 7). At the hard case it points the wrong
way. The recommendation's "Real evidence is small and one-sided" (`:39–42`) is true but softer than this.

### F7 — P1 — Even the upper bound moves no verdict, and the "recurring failure" story covers one of two houses

**Across the 13 non-PASS rows the replay measured:**
- **Verdicts:** ALL_DRAWN moves **0 of 13**.
- **Footprints:** it moves **1 of 10** footprint-failing or inconclusive rows, gozdzikowcach.

**dom-pod-jarzabem is not moved.** The 005I report calls it "the same class blind-7 #1 was left with": BODY_RELATION, a
recessed entrance with a 5.3 m mouth. 73 upgrade events leave it unchanged (`df2aa66c`, −11.88 %). helikoniach
(−18.88 %) is not moved either. So "the replay shows one such reading is decisive" (`recommendation.md:89`) holds for
**1 of the 2** recessed-entrance houses on record, and for **0 of 1** glazing-against-terrace houses.

**The storey count is a larger lever than the gap.** On this matrix the most frequent single blocker of a verdict is the
storey count:
- tunbergiach, zurawkach and willa-miranda fail on storeys **alone** (footprints −0.37 %, −0.81 %, −1.49 %);
- gozdzikowcach fails on it after the upgrade;
- helikoniach fails on it besides its footprint.

The recommendation is honest that the witness is "sufficient for neither" round-8 house. But §4 aims the witness at
"the failures that keep recurring", and the measured base rate does not support that framing.

### F8 — P1 — 005K-a's gates cannot tell a useful witness from a constant one, and none is out of sample

**A constant "always OPENING" witness — that is, ALL_DRAWN — passes most of §5.7 already:**
- the model-in-the-loop replay: it moves gozdzikowcach, regresses no development verdict and explains the one changed
  hash;
- mirror and rotation consistency (100 % trivially);
- the decoy-footprint and order-invariance checks (trivially);
- the positive half of the balanced real set (63 of 63).

**Only three gates separate a model from a constant:** the synthetic hard negatives, the minority accuracy on the
balanced real set, and "say no". All three are in distribution:
- the synthetic negatives come from new seeds of generator v2, whose families are designed to contain them;
- the real set is ARCHON development sheets, chosen and placed by people who know the answers (§5.3: "development sheets
  only").

**No gate uses a sheet, house or publisher unseen before 005K-a.** The first out-of-sample test is the 005K-b blind round
(§5 005K-b.4). By F7 that round cannot move a verdict through the witness, so its verdict cannot attribute anything to
the witness either.

**Required:** the gate in §Q5 below.

### F9 — P1 — "Transfers to real sheets" is a claim about one publisher, and the generator was fitted to its failures

- **Every positive transfer result is ARCHON.** All 7 UNet real sheets, both round-8 houses and all 12 completed
  development rows have publisher `archon.pl`.
- **The non-ARCHON rows add nothing.** All three (alt-marcowki, aster-viii, galaktyka) fail before a gap matters, with
  2, 0 and 0 upgrade events.
- **The generator was written after the diagnosis.** Its families `porch_recess`, `porch_plus_garage`, `glazing_terrace`
  and `garage_door_vs_open` (`synthetic/vrgen.py:572–852`) target the 005I failures of these exact houses.
- **The scale range is narrow.** Training spans ≈ 16–52 px/m (`pxPerM` 22–40 × scale augmentation 0.75–1.3); ARCHON
  frames are ≈ 40 px/m.

The claim should read: "transfers to one publisher's raster plans at about 40 px/m, for the gap kinds the generator was
built from".

### F10 — P2 — ALL_DRAWN also changes a failing reading

azaliach fails either way. Under ALL_DRAWN its failed reading changes:
- the lowest storey goes from 6.27 to 9.11 m²;
- the best reading moves from wall-ink extent to chain extent;
- `builtRegions`, `compositions`, `distinctOutlines`, `enclosedCells` and `reading1–4` all differ (`failure.json`).

So 2 of 19 valid rows change a decision, not 1. Each also changes that the replay reports in events, not distinct
gaps:
- cyklamenach has 91 events but 58 distinct id-and-width pairs;
- jarzabem has 73 events but 49 distinct ids.

### F11 — P2 — The VLM conclusion is broader than what was measured; the rejection still stands

**What was tested:**
- one checkpoint per family;
- SmolVLM2 with `do_image_splitting=False` at 512 px, i.e. 64 image tokens (`vlm_bench.py:82, 96–97`) — the
  configuration least able to resolve 1–2 px window symbols — and an int8 decoder;
- one prompt template (`compose.py:60–69`);
- ENUM_SCORE that sums multi-token log-probabilities, which biases between CONTINUES, TERMINATES and NOT_SAME_WALL;
- Florence-2-base, which has no VQA task, so it is not a test of a small VLM referee.

**The conclusion holds on matched items.** On the oracle's own 148 items, SmolVLM2 is right on 46 of 100 answered
(REAL_DEV 8/20, round-8 3/10). The rejection also stands on cost alone (≈ 16 s, ≥ 1.9 GiB).

Scope the sentence to: three checkpoints of at most 0.5 B, zero-shot, single 512 px tile, one prompt. 1–3 B VLMs, tiled
or native-resolution crops and few-shot prompting were not tested.

### F12 — P2 — "Whole-image referee does not transfer" rests on one weak pilot

The pilot:
- trained on 8 synthetic seeds (`micro_referee.py:98`);
- shrank the 512 px crop to 256 px (bilinear), so 1–2 px lines become sub-pixel;
- pools globally (average and max);
- uses photometric jitter only;
- is one run of one seed for 2,000 steps.

The spread between REAL_DEV 49.7 % and round-8 73.4 % shows variance at the level of the sheet. `training-plan.md:56`
states a general law ("an image-level classifier trained on synthetic images alone does not transfer to real sheets");
it should say "this pilot". The HYBRID rejection (`recommendation.md:14`) stands on sequencing, not on this evidence.

### F13 — P2 — The post-hoc exclusion is neutral, but the re-placement claim should go

Excluding the porch-mouth question costs little either way:
- UNet and MiT-B0 answered UNRESOLVED;
- SmolVLM2 (TERMINATES 0.50), the pilot (0.75) and the oracle (0.72) were right;
- Florence was confidently wrong (CONTINUES 0.997).

The exclusion favours no arm in the decision. But "with B on the pier both wall models answer TERMINATES (0.98 / 0.97)"
(`exclusions.json`, `vlm-bakeoff.md:5`) is a re-placement made after seeing results and measured on the wall arms only.
Drop it or label it an anecdote.

### F14 — P2 — The name "REAL_BLIND8" misleads

Its questions were authored from the accepted 005I diagnosis (`realq.py:9–10, 52–107`), and the UNet has **0** minority
questions there (`vlm-bakeoff.md` §6). Headline phrases such as "16/16 blind-8" and "blind-8 23/23" read as blind
generalisation.

Rename the set ROUND8_DEV in the summary tables.

### F15 — P2 — Gap ids collide across copies and scales

`BoundaryGap.id` is `gap-{axis}-{line}-{from}-{to}` (`boundary-evidence.ts:450`). In cyklamenach, `gap-Y-196-469-516`
occurs with four widths (1.057 / 0.954 / 0.953 / 0.575 m).

The ONLY and EXCLUDE replay modes key on the bare id. That is harmless in gozdzikowcach, where one event matched, but the
Evidence Pack key in 005K-a item 1 must also carry the scale (mpp) and the reading, not only the copy and decomposition.

## The five questions

### Q1 — Post-hoc risk: what survives, what is circular, what is development evidence only

| claim | status |
| --- | --- |
| A STRONG answer on `gap-Y-538-322-338` completes gozdzikowcach at 127.54 m² | **Survives as a fact about the solver.** Predicted in the opportunity map before the replay (REC-18 note, map `:89–92`; file time 16:03 against replay 17:53); OFF reproduces the sealed run. Development evidence about this one house |
| "The proof model reads that gap correctly" | **Development only, weak.** The box was placed by hand after the gap and answer were known; nothing records it; the reading depends on placement and matches the known OPENING bias (F4) |
| "The UNet says no to the porch front" | **Survives as a reading** (0.00 OPENING at every offset ±16 px, my recompute). It does not affect the outcome |
| 61 of 63 real openings | **Development only**: an upper bound with the truth's side; one class; constant 0.22 m chosen after the first result (robust over 0.15–0.30 m) (F5) |
| Questions are answerable (oracle 98 %) | **Survives for REAL_DEV.** The round-8 part is development: questions authored from the diagnosis by the same model family that answers them |
| No development verdict regresses under ALL_DRAWN | **Survives at hash level, ARCHON only.** Overstated at verdict level (F2) |
| The witness adds value over the deterministic rule | **Not shown.** No measured outcome; two real "no" readings, neither affecting the outcome; adverse at the one hard real case (F1, F3, F6) |

**Must be labelled development evidence only:**
- every round-8 number (the questions, the region readings, the 0.41 m gap, the replay);
- the axis re-measurement;
- the exclusion;
- the synthetic results for generator families written after the 005I diagnosis.

### Q2 — How strong is "synthetic-only UNet transfers to real sheets"?

**As a pixel claim (wall recall 0.91–1.00, openings read OPENING) it is genuine but narrow.** It covers one publisher,
one pen, about 40 px/m, GIF/JPG rasters, 7 sheets, recall on positives, and placement taken from the truth.

**What a fresh blind round would most likely break, in order of likelihood:**
1. **Seams outside the witness.** Storeys (4–5 rows here), REC-17 continuation, TOO_LARGE, the OPEN_SIDE merge. The
   witness's upper bound moved 0 of 13 verdicts, so the next round will most likely fail for a reason the witness never
   sees.
2. **Production strip placement.** A gap whose jambs are cross-sections falls back to the face `linePx`. Measured:
   reading at the face gives 23 of 63; the wrong side gives 0 of 63 with confident PATTERN. The asymmetric rule makes
   this fail safe for upgrades (no false OPENING), but recall collapses.
3. **Another publisher or drawing generation.**
   - Coloured or grey room fills read as grey walls.
   - Red brick hatching.
   - Thin outline walls.
   - Dense dimension chains over walls: dimension ink already reads 12 % WALL + 18 % OPENING.
   - Scale outside 16–52 px/m, e.g. PDF.js renders at higher DPI.
4. **Scans:** perspective, uneven lighting, hand marks. The generator has blur, JPEG, noise and skew up to 2.2°, nothing
   more.

On items 3–4 the over-read risk is exactly the one the witness exists to remove, and nothing has measured it.

### Q3 — The replay: is the witness safe, or does WEAK vs STRONG rarely matter?

**The data:**
- **Completed development rows.** 230 upgrade events across the 13 completed valid rows change **1** model hash
  (zurawkach −0.81 % → −1.68 %, the footprint shrinking).
- **All valid development rows.** 289 events across 19 rows change 1 model and 1 failed reading (azaliach).
- **Round 8.** 10 events in gozdzikowcach: one is decisive and the other nine do not matter. 91 events in cyklamenach
  change nothing.
- **The model as witness** (my jamb-axis placement over 166 distinct development gaps):

  | reading | gaps | effect under the witness rule |
  | --- | --- | --- |
  | OPENING | 59 (36 %) | upgraded |
  | BACKGROUND | 21 (13 %) | declined |
  | WALL | 13 | not upgraded |
  | UNRESOLVED | 18 | not upgraded |
  | no two-sided jamb axis | 55 | not upgraded |

  The witness would upgrade roughly 60–70 of the gaps that ALL_DRAWN upgrades all 166 of. Since all 166 together change
  one model, any subset almost surely changes no more. On zurawkach the witness would upgrade 9 of the 11 gaps, so it
  would most likely reproduce the zurawkach change as well.

**This shows that WEAK vs STRONG rarely matters on houses the solver was tuned to pass.** It does not show the witness is
safe. Downstream guards already handle these houses: the 005C box and COVERED_TERRACE rules, which 005C itself says
exist because removing the box "builds modrzykach's terrace and zurawkach's porch".

**For the witness as primary:**
- ALL_DRAWN bridges phantom stretches through rooms (`gap-X-413`) and open porch fronts. On a style where those
  stretches touch the envelope, 005C's history says terraces get built.
- The stroke heuristics have been patched every round.
- The UNet said "no" correctly at both real drawn-but-open gaps it was shown in gozdzikowcach.
- The cost is affordable (≈ 1.2 s per frame).

**For NO_AI_YET with the deterministic upgrade as primary:**
- The two are outcome-equivalent on 21 of 21 rows.
- It costs nothing at runtime, against ≈ 5–10 s and ≥ 340 MiB per run for the witness.
- It needs no model hosting, no generator v2 and no training record.
- The witness's only value is unmeasured. Where it was measured on a hard real case it was confidently wrong (F6), and
  the proof model's known bias runs toward OPENING on open gaps, which is the very case it would have to refuse.

**My position on Q3:** with identical measured outcomes, parsimony favours the deterministic rule as the thing to field
and measure first. The witness should be the **challenger**. It earns its place only when a fresh set shows false
upgrades by the deterministic rule that the witness refuses.

### Q4 — Are the VLM and pilot conclusions over-generalised?

**Yes in wording, no in decision.**

- **VLMs (F11).** The rejection of ADOPT_SMALL_VLM_REFEREE stands on cost alone, and the accuracy result holds on matched
  items. But "generic small VLMs useless" rests on three checkpoints at 64 image tokens with one prompt.
- **Pilot (F12).** One under-powered 256 px global-pool CNN trained on 8 seeds cannot carry "image-level classifiers
  trained on synthetic data do not transfer". Keep "not now" for HYBRID on sequencing grounds, and scope both
  sentences.

### Q5 — Would the 005K gates catch the expected failures? The cheapest extra gate

**They would not** (F8). The replay and consistency gates are passed by a constant. The negative gates are in
distribution. The only out-of-sample check comes after integration, and its verdict cannot single out the witness.

**Cheapest additional gate: a sealed fresh-sheet gap set (FSGS), built in 005K-a before any training.**
1. **Draw the houses by lot.** At least 8 houses outside the development matrix and round 8, with a pre-registered seed
   as in 005I §O. Include at least 2 non-ARCHON publishers or drawing generations where the adapters reach them.
2. **List every eligible gap.** Run production OFF and list them with the per-gap Evidence Pack records from item 1,
   which are needed anyway.
3. **Label every gap OPEN or CLOSED before any model runs.** A human does it, stored as coordinates and hashes only.
4. **Score three arms:**
   - ALL_DRAWN (the deterministic fallback): its false upgrades;
   - the witness at production `axisPx`, with its across-wall position jittered by ±¼ wall: false upgrades, recall and
     stability;
   - a constant-OPENING control, reported in every gate table.
5. **Integrate only if** the witness turns at least *k* real deterministic false upgrades (*k* pre-registered) into
   no-upgrades, with 0 confident false upgrades and its recall within a stated margin of ALL_DRAWN. Otherwise apply the
   §5.8 stop rule.

**Cost.** Roughly 100–200 gap labels, which take hours, and no training. The jitter costs compute only.

**What it catches:**
- style and publisher over-reading;
- placement failure at the production axis;
- scale drift.

It is also the first measurement of the fallback's own false-upgrade rate, which nothing in 005J measures. In the
005K-b blind round, also score the witness **per gap** against human labels; the verdict alone cannot attribute it
(F7).

## Position on the primary recommendation

TRAIN_BUILDPLAN_WALL_MODEL is a legitimate research bet, and 005K-a's records, stop rule and "must be able to say no"
gate are the right instincts. But on the evidence 005J actually has, it is not the better-supported primary.

- **The deterministic upgrade matches it.** The two are indistinguishable on all 21 replayed rows.
- **Neither can move a verdict.** The witness's own upper bound moves 0 of 13 non-PASS verdicts and the footprint of
  1 of 10 failures.
- **The deterministic upgrade is free at runtime.** The witness costs ≈ 5–10 s and ≥ 340 MiB per run.
- **The witness's one claimed advantage rests on development data.** It is two outcome-irrelevant "no" readings and
  seven real minority questions with a confident miss at the only hard case. That is all from one publisher, with
  placement taken from the truth.

My position: invert the order.

- **Primary: NO_AI_YET**, made concrete. Build the per-gap Evidence Pack records and the sealed fresh-sheet gap set
  first; then the deterministic drawn-gap upgrade, with its phantom-stretch eligibility stated and scored on that set.
  The storey and REC-17 seams that actually block verdicts can be scheduled beside it.
- **Secondary: TRAIN_BUILDPLAN_WALL_MODEL**, trained only once the fresh-sheet set shows deterministic false upgrades
  that matter and that the witness refuses.

If the coordinator keeps the current primary, the minimum to let it stand is:
- F1's §1 row restated;
- F2–F6 corrected or labelled as development evidence;
- the fresh-sheet gap set and the constant control added to §5.7, as a gate that must pass before generator v2 and
  training effort are spent.
