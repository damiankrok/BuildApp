# 005J post-review — Reviewer A: floor-plan computer vision

**Verdict: CHANGES REQUESTED.** The pixel model is real and, by my recomputation, better on real openings than the
stage reports. The stated payoff of the 005K gap witness does not hold, though. It is said to move the two round-8
failures through IP-01 / IP-02 "without anything else changing". The stage's own opportunity map and the production
code contradict that. The witness's main hazard, a false OPENING across an open gap, a pattern or dimension ink, is
also under-reported. The primary direction can stand after it is re-scoped (see the position at the end).

Scope: focus items 1–4 of the brief. VLM numbers and placeholders are not reviewed here.

## How I checked

- **Production code** was read at `64b78b4`: `packages/reconstruction/src/{plan-decomposition,boundary-evidence,boundary-completion,plan-resolution}.ts` and `packages/source-cv/src/bands.ts`.
- **Sealed 005I packs** were read for both round-8 houses:
  - `/home/user/work005i-a/blind8/h{1,2}-*/evidence-pack/{04,12,13}-*.json`
- **Wall proof.** I re-ran the 005J checkpoints `/home/user/work005j/wall/{unet,segformer}.pt` with the stage's own
  `wallnet.predict` and `wall_referee.decide`, imported unchanged, from three throw-away scripts in the session
  scratchpad. Nothing was committed and no image was written. The scripts:
  1. **Synthetic test set.** It regenerates all 108 test scenes with `vrgen` (all 108 bit-identical to the stored
     renders) and adds masks for the OPEN ops.
  2. **The 7 development sheets and the 2 blind-8 frames.**
  3. **False positives per ink pixel.**
- **Reproduced.** My undilated real recalls, source-cv recalls and "additional" figures equal `wall-model-proof.json`
  to 4 decimals. I recounted the referee answers from `/home/user/work005j/bench/wall-unet.jsonl`.
- **Line numbers in research files** refer to commit `1c81b12`. Since then the working tree has added 2 docstring lines
  to `wallnet.py`, so its current lines are +2. The code is unchanged.
- **Viewing.** I viewed one composed question image, `real-dom-w-gozdzikowcach-WALL_CONTINUATION-1-NORMAL__CANDIDATE_OVERLAY.png`,
  to settle a coordinate question (A9). I copied nothing.

**Verified correct, so not findings:**
- Seeds are disjoint:

  | set | seeds |
  | --- | --- |
  | train | 70000–87009 |
  | wall test | 90000–107002 |
  | benchmark | 50050–67052 |

- The wall IoU / F1, 2 px boundary F1, opening IoU and continuity formulas (`wallnet.py:299–323`) are standard
  micro-averages over pixels.
- The stage's numbers about the 005I failures match the sealed records:
  - opening-1 `linePx 598`, 284→590, 7.755 m, score 0.577778;
  - cyklamenach completion-0: NO_CONTINUATION 5.12 of 12.79 m; weak gaps DASHED 1.78 m and LEAF_FACE 1.66 m;
  - gozdzikowcach completion-0: QUESTION POLICIES_DISAGREE; one weak gap, 0.41 m LEAF_FACE between WALL jambs;
  - gap classes: 270 / 415 gaps per plan, of which 16 / 28 are UNKNOWN_GAP.

## 1. Opportunity map spot-check (12 records, 6 P0 required)

| record | cited | code at `64b78b4` | result |
| --- | --- | --- | --- |
| REC-01 | `collinearWideGaps` :1413, pieces :1358, probe tolerance :1365, width window :1424, jambs :1425, decision :1433, score :1446, DEFAULTS :346 / :351 / :352 | all exact | **matches** |
| REC-02 | pocket test :1851, flood :1854–1870, limit :1871, decisions :1872–1889 | block opens :1851; limit `max(6, 2.5·w²)` :1871; branches :1872 / :1880 / :1887 | **matches**. The 150.5 m² limit uses the rounded width; production gives 2.5·7.755264² = 150.36 m² (P2 nit) |
| REC-11 | `classifyGap` :433, `gapStrokes` :298, `gapSignature` :426–431, `patternAcross` :397, override :444–445, branches :454–482 | exact; WEAK at :460 / :469 / :480, NONE at :454 / :470 / :471 / :482 | **matches**. Candidate counts (270–415 gaps, 16–28 weak) confirmed in the sealed packs |
| REC-14 | STRICT :2983, EXCLUSION :2817, `POLICY_AGREES` :2685 | exact | **matches** |
| REC-18 | `judge` :293, `strictEncloses` :457, `policiesAgree` :492, QUESTION :580–582 | exact; vehicle clause :491 | **matches** |
| REC-21 | `acceptable` :485–498, spent :535, refuse :715–721 | exact; UNKNOWN needs n ≥ 2 | **matches** |
| UP-01 | `patternAcross` L397–419, override L444–446, `withCallout` L539–540 | exact. DASHED plus a callout stays WEAK | **matches** |
| UP-02 | `gapStrokes` L298–390, `gapSignature` L426–431 | exact | **matches** |
| UP-03 | `classifyGap` L433–483, policies L2980–3000 | exact | **matches** |
| UP-06 | `bands.ts` `runLengthBands` L106, merge L189–196; `alongWallPieces` L1358–1379 | exact | **matches** |
| UP-H1 | "pocket rule … L1593" | :1593 is the **bay-mouth** decision; the pocket annotation is at :1887–1888 | **wrong line** (P2) |
| IP-01 / IP-02 | :2807–2810; :191–202, :1433, :1578–1583, :1872–1889 | exact (`OpeningEvidence` ends at :203) | real places, with the caveats in A2 and A5 |

The audit is accurate as a code citation exercise. What follows concerns what is concluded from it.

## 2. Findings

### A1 — P0. The gap witness, as designed, cannot move either round-8 outcome. The stage's own map says so.

The recommendation rejects NO_AI_YET because the model "reads exactly the round-8 gaps". The report (§L) adds that the
witness "speaks to … both round-8 first divergences". Reading a gap correctly is not moving a verdict. The stage never
tested whether it does.

**dom-w-cyklamenach.** The completion is stopped by gates a gap upgrade does not touch.

- In `boundary-completion.ts` the gate order is :553–583: NO_CONTINUATION (:546), then TOO_LARGE (:577–579), then
  POLICIES_DISAGREE (:580–582).
- `continues` counts only junction edges with `!edge.closed` (:543), and the sealed reason is 5.12 m of 12.79 m. That
  measures the partitions between the block and the built rooms, not the exterior gaps.
- Upgrading the window (DASHED) and the double door (LEAF_FACE) to STRONG changes only `strict.inside` →
  `strictEncloses` (:457) → `policiesAgree` (:492). That is the **last** gate. TOO_LARGE still follows
  (40.44 > 0.5 × 48.97 m²).
- The map's own trace says this verbatim: *"On the incumbent path no single local answer suffices … The only
  consumable path without rule changes is REC-21, which needs two independent witnesses."* IP-01 supplies no resolver
  corroboration.

**dom-w-gozdzikowcach.** None of the three possible paths is shown to work.

1. **The measured gaps feed IP-02, which cannot be consumed alone.** The garage door and the porch mouth are IP-02
   inputs. The map's trace: *"SPLIT_AT_SETBACK_PIER or PORCH_IN_FRONT_OF_INNER_WALL is only consumable with a cut at
   the inner front wall (REC-03)"*. See A5 for what a split does in the code.
2. **The one path that might suffice was never measured.** That path is REC-18: upgrade the 0.41 m LEAF_FACE gap on
   completion-0 so that STRICT encloses the hall column, about 127.3 m² by arithmetic. The model was never run on that
   gap: it has no coordinates in the pack and is not among `blind8_regions.py`'s boxes. It still needs a replay.
3. **On the production decision line, the model confirms the error.** Opening-1 is decided on `linePx = 598`
   (sealed `12-opening-observations.json`). There the UNet reads 284→590 as **background 0.922, wall 0.067, opening
   0.011**, and the strip rule would answer ONE_OPEN_SIDE at 0.92.

   The garage-door reading falls off steeply away from the axis. Opening share in the 465→590 strip, by row:

   | row y | 583 | 588 | 593 | 598 |
   | --- | --- | --- | --- | --- |
   | opening share | 0.834 | 0.552 | 0.247 | 0.025 |

   The quoted "75 %" exists only about 15 px off the line where production decides.

**Consequence.** 005K gate 5 ("their first bad decisions must move, or the stage says why not") can be met by changing
a signature label while both verdicts stay wrong.

**Required:**
- Before 005K is scoped, run an **oracle-witness replay**: inject the *true* gap answers at IP-01 / IP-02 into a
  research copy of the frozen code, and re-run both round-8 houses and the 7 development houses.
- Record per house whether a *perfect* witness moves the outcome.
- If it does not, either:
  - put the downstream changes (REC-03 inner-wall line, REC-17 continuation) into 005K under their own gates; or
  - drop the round-8 claim and justify the witness only on development-matrix evidence.

### A2 — P1. The real-development gap-referee numbers are an artefact of strip placement, and production has the same trap.

**The 005J measurement.**
- All 63 truth opening segments (NORMAL transform, 7 of 7 houses) lie **on the exterior outline**: distance from the
  segment midpoint to the outline is 0.0 px.
- The walls run 16–22 px inward from that line. The referee strip is the segment ± 0.18 m, which is 6.4–9.7 px
  (`wall_referee.py:40,58`). Half of every strip is therefore outside the building by construction.
- Recorded shares confirm it. REAL_DEV OPENING_VS_PATTERN: median background 0.51, opening 0.46, maximum opening 0.69.
  WALL_CONTINUATION flanks: median wall 0.50.

**Same model, same rule, strip moved half a wall inward onto the axis:**

| model | on the face (as 005J) | on the axis | on the axis at ≥ 0.8 |
| --- | --- | --- | --- |
| UNet | 23/63 OPENING | **60/63 OPENING** | 47/63 |
| MiT-B0 | 27/63 OPENING | 52/63 OPENING | 38/63 |

(On the face, UNet had 0 answers at ≥ 0.8.)

So these REAL_DEV referee figures are placement artefacts and do not measure the model:
- coverage 35 %;
- useful coverage 3.3 %;
- 0 confident answers on OPENING_VS_PATTERN;
- the minority tallies.

**Production carries the same trap.**
- `GridLine.px` is "the chain's, when a chain states one" (`plan-decomposition.ts:94–103`), and a chain's witness line
  is struck on a wall *face*. `readWallLine` says the line "may be a wall's face … or its axis" (`boundary-evidence.ts`
  doc above :214).
- `classifyGap` computes the jambs' `axisPx` (:437–439) but `BoundaryGap` stores only `linePx` (:161–180).
- A witness that crops `linePx ± k` will repeat 005J's real-development error. gozdzikowcach at y = 598 (A1) is that
  error on a decisive gap.
- The jamb-band window REC-01 already names is correct: `[min(lo) − 1, max(hi) + 1]`. For opening-1 that is bands 12
  and 11, y 575–593.

**Required:**
- Re-run REAL_DEV with axis-placed strips.
- 005K must take the strip's across-extent from the jamb bands or `axisPx`, never from `linePx`.
- Persist `axisPx` in `BoundaryGap` and in the Evidence Pack per-gap rectangle.

### A3 — P1. The false-positive metrics measure the class the witness does not consume.

**What 005J reports.** The synthetic false-positive figures count WALL only (`wallnet.py:308–313`), and the real one
counts "false wall inside exclusions". The witness upgrades on **OPENING**.

**Recomputed on synthetic data (UNet):**
- **Open gaps** (OPEN ops, labelled background): **44.5 %** of their pixels are predicted OPENING, and 0.5 % WALL.
  4 of the 12 test open gaps reach ≥ 0.5 opening (three at ≥ 0.87). The witness rule would upgrade each of them to
  STRONG.
- **Thin training signal.** The training set holds only **40 OPEN ops in 360 renders**.
- **Dimension lines.** The 005J mask is a 5 px line, and 74 % of its pixels are paper, so the headline "3.8 %" is
  diluted. Per dimension-line **ink** pixel: **12.1 % WALL + 17.6 % OPENING**. On the 5 px mask itself, OPENING is
  10.0 %, against the reported 3.8 % WALL.
- **External regions:** OPENING 0.89 % (WALL 0.68 %). **Text:** about 0.

**Recomputed on the 7 real sheets:**
- false OPENING inside exclusions: **0.6–6.6 %**;
- any non-background inside exclusions: **0.8–9.3 %**, against the reported "≤ 3.6 % false wall";
- source-cv, dilated as in 005J, for comparison: 3.1–12.9 %.

**The missing direction.** "Continuity through openings 0.980" is reported with no counterpart for false closure across
open gaps, which is the witness's main hazard.

**Required:**
- Report false OPENING and false WALL per class: open gaps, terraces / hatch, dimension **ink**, text.
- Gate 005K on strip-level false OPENING.
- "MiT-B0 only if UNet cannot meet the false-**wall** gate" should read false-**OPENING** gate.

### A4 — P1. "The way it already uses an opening callout" is inaccurate; the witness is stronger than a callout and bypasses the pattern guard.

- `withCallout` (`boundary-evidence.ts:534–541`) upgrades only drawn signatures (GLAZING / LEAF_AXIS / LEAF_FACE, with
  confidence > 0.5). With DASHED or BLANK a callout keeps the gap WEAK, because it "states its width, not what fills it".
- The GLAZING→DASHED override (:444–445) exists precisely so that terrace and tile patterns are not bridged as
  glazing.
- The 005K witness would upgrade the cyklamenach **DASHED** gap to STRONG. That is a new and stronger upgrade path. Its
  safety rests entirely on false-OPENING-on-pattern, which is:
  - unmeasured on real sheets: all 126 REAL_DEV OPENING_VS_PATTERN questions expect OPENING, so there are 0 real
    PATTERN cases;
  - 17.6 % per dimension-ink pixel on synthetic data (A3).

**Required:**
- Describe IP-01 honestly, as a new upgrade path.
- Require a pattern hard-negative set (real and synthetic) that meets the confident-wrong gate before the flag may be
  ON. Real weak gaps (16–28 per plan) are the population to sample.

### A5 — P1. IP-02 "split" has no defined consumption in production, and it contradicts "never creates a gap".

**Why the code cannot express it:**
- `collinearWideGaps` weighs only gaps wider than 3.2 m (:1424).
- `closureOf` (:702–737) shuts *every* hole of 3.2 m or less between jambs ≥ 0.5 wall. It has no notion of an
  open sub-gap.
- `evidencedOn` holds whole `[fromPx, toPx]` intervals (:1716–1723). An OPENING answer consumed at IP-02 therefore
  shuts the whole 7.76 m, porch mouth included.

**What a split would need.** A split has to insert a WALL piece into `alongWallPieces` (:1358) and creates new gaps.
- On gozdzikowcach the pier sits at x ≈ 440–464: the model reads wall at x 436–460 on rows 560–590. The composed crop
  places the drawn pier there too (crop box [166.3, 393.8, 554.7, 782.2], scale 1.318).
- source-cv has **no band** there below y ≈ 539: band-27 is vertical, x 442–453 × y 239–539, in `04-wall-bands.json`.
- So the split needs exactly the extra wall the stage says the model does not add (A7).

**What happens after a split.** The porch-side gap runs from 284 to about 440, roughly 3.9 m. The pocket rule then
weighs it with a limit of 2.5·w² ≈ 38 m² instead of 150.4 m². Depending on the pocket area, which has not been
replayed, either:
- the hall column stays out; or
- the porch mouth is shut and the porch is built as interior, while the truth says EXTERNAL.

Neither is right without REC-03.

**Required:** either specify the split semantics (which sub-gaps stay OPEN_SIDE, and how a witness OPEN verdict is
protected from the width convention), or drop the split from 005K and keep IP-01 upgrades only.

### A6 — P1. "7 of 12 P0 seams are gap seams" double-counts one function.

- REC-11 cites `classifyGap` together with `gapStrokes` :298, `gapSignature` :426–431, `patternAcross` :397 and the
  override :444–445. That is the code of UP-01 (pattern and override), UP-02 (strokes and signature) and UP-03
  (`classifyGap`'s WEAK branches).
- REC-01 and UP-06 are the same `collinearWideGaps` decision. UP-06 adds the source-cv bands upstream.
- UP-H1 is REC-02's hand-off. UP-H2 is the decision REC-17 rates **P1**: the same decision is P0 in one record and P1
  in the other.

De-duplicated, there are **7 distinct P0 decisions**:
1. `collinearWideGaps`;
2. `classifyGap`;
3. completion `policiesAgree`;
4. the pocket rule;
5. the boundary policies;
6. `resolvePlan`;
7. completion continuation.

Of these, **3 are gap decisions**, or 4 if REC-14 counts (its question is asked per weak gap). The report says the two
audits were merged without de-duplication; the count must say so too. "Both round-8 *first* divergences are gap seams"
is a fair reading. "The witness addresses them" is not (A1).

**Required:**
- Restate as "the gap family is upstream of both failures; 3–4 of 7 distinct P0 decisions".
- Align the UP-H2 / REC-17 priority.

### A7 — P1. "Its value is the OPENING class, not more wall" holds for IP-01's consumer, not for IP-02's.

**The baseline depends on who consumes the evidence.**
- The union baseline (SCV-WALL ∪ SCV-SOLID) fits IP-01: `readWallLine` reads a solid layer.
- `decomposeCore` / `collinearWideGaps` read **bands only** (`alongWallPieces` :1358–1379, `wallIntervals` :556).
  Against bands the model adds 8–99 % of exterior wall (`additionalOverBandsOnly`).
- On gozdzikowcach the missing piece at IP-02 is a WALL (the pier, A5), not an OPENING.

**The 005J comparison is also asymmetric.** It sets the model's WALL mask, undilated, against source-cv dilated by 2 px
(`wallnet.py:344–349`). Compared symmetrically:
- model **0.983–1.000** against source-cv 0.978–1.000 (005J reported 0.912–0.997 for the model);
- the source-cv mask is 2.6–5.8× the area of the exterior-wall truth (interior walls and SOLID bounding rings), so
  this is recall without precision.

**Verdict on the claim.** "Adds ≈ 0 exterior wall" survives at IP-01. As a statement about where the model's value
lies, the claim needs the IP-02 qualification.

### A8 — P2. UNet over MiT-B0 is defensible on cost but argued on the wrong axis.

| | UNet | MiT-B0 |
| --- | --- | --- |
| open-gap pixels read OPENING (synthetic) | 44.0 % | 20.4 % |
| open gaps at ≥ 0.5 opening | 4/12 | 2/12 |
| real false OPENING in exclusions | 0.6–6.6 % | 0.5–3.6 % |
| real openings on the axis read OPENING | 60/63 | 52/63 |
| gozdzikowcach garage door, opening at y = 583 | 0.83 | 0.19 |
| latency | 1.19 s | 4.46 s |
| memory | 340 MiB | 928 MiB |
| model size | 6.25 MB | 14.95 MB |

- On the witness-safety metrics MiT-B0 is better (first three rows). UNet wins on recall and cost (the rest).
- The equal 1,500-step budget handicaps the transformer.
- The report's "its one advantage is fewer false walls inside exclusions" leaves out the opening-side trade-off.
- **Suggested:** carry both to 005K's first gate and choose on false OPENING at matched recall.

### A9 — P2. The blind-8 boxes match `realq.py`, but two hand-read coordinates are off the drawing, and the "36 %" is misattributed.

**Where the boxes agree.** `blind8_regions.py` agrees with `realq.py` to within 2 px for the window (165–255 @ 206),
the double door (310–397), the terrace, the garage door (465–590 @ 583) and the porch mouth (312–417).

**Where both files are off the drawing.**
- The **pier box** (418–434 × 541–590) and the porch question's **flank B** (417–436 @ y 588) both lie on the porch
  floor. The model reads wall only at x 436–460, and the composed crop draws the pier at about 440–464.
- The question's UNRESOLVED came from flank B at **0.11 wall**. The "36 %" quoted in §G and in the recommendation
  comes from the vertical pier box, a different region.
- With flank B on the pier, the same rule answers TERMINATES: the gap reads background 1.0 at every row from 583 to
  598.

**Related consequences:**
- The porch mouth is then about 312–440, roughly **3.2 m**, at the width convention itself, not 2.7 m. This matters
  for A5.
- The "18 minority questions" are 14 REAL_DEV plus the 4 REAL_BLIND8 porch questions. REAL_DEV alone is 10 right /
  2 wrong / 2 unresolved, and those were placed on the face (A2).
- "North wall pieces either side" measures only the left piece.

### A10 — P2. The strip rules are sensible, but "pre-registered" cannot be verified.

**Timing.**
- The history is one squashed commit (`1c81b12`).
- `wall_referee.py` was last modified at 16:28. That is after `unet-eval.json` (16:26) and `unet-blind8-regions.json`
  (16:27), and before `wall-unet.jsonl` (16:29:35).
- The rules do not look tuned in the model's favour: round thresholds, and the porch question left UNRESOLVED.
- Say "fixed before the referee scoring run", not "pre-registered".

**Rule issues:**
- The 0.18 m half-width does not depend on the measured wall thickness or the placement (A2).
- `SEVERAL_OPENINGS` fires on any opening share ≥ 0.20, so one wide drawn opening also answers "several".
  gozdzikowcach passes with opening 0.227 at "confidence" 0.37–0.39.
- Pixel shares are scored against the same 0.8 "confident" bar as VLM likelihoods. They are not calibrated
  probabilities.

### A11 — P2. Crop-mode inference and per-crop latency are extrapolated.

- The ONNX was exported at a fixed 1×1×864×864 with no dynamic axes (`wallnet.py:370–371`).
- "≈ 0.1 s per gap crop" is arithmetic, not a measurement.
- Every real and blind-8 reading was a whole-frame prediction (`wall_referee.py:140`, `blind8_regions.py:54`). 005K
  specifies gap crops only, so context and edge effects on 256² crops are unmeasured.

### A12 — P2. Minor accuracy notes.

- UP-H1's L1593 citation is wrong (see §1).
- REC-02's limit is 150.4 m², not 150.5 m².
- REC-21's priority text calls it "the only point where an observation can enter … without changing resolver
  semantics". IP-01 and IP-02 are also listed as "resolver semantics changed: no".
- The cyklamenach terrace's 4.5 % OPENING sits in two compact blobs at the box edges: 666 px at x 422–440 × y 130–171,
  and 443 px at x 140–149. It is not a texture-wide hallucination, but the region box should exclude adjacent
  structure.

## 3. Short answers to the four focus questions

1. **Opportunity map.** Citations are accurate (12 of 12 checked, one wrong line).
   - **"7 of 12"** is literally true but double-counted: 3–4 of 7 distinct decisions (A6).
   - **IP-01** is a real deterministic insertion point: a map over `WallLine.gaps` before `cornerLegs` and
     `solveOutline`, feeding STRICT, completion and adopt. It needs `axisPx` (A2) and an honest description (A4).
   - **IP-02** is real for a whole-gap upgrade only. A split is undefined (A5).
2. **Wall proof.**
   - **Correctly computed:** the formulas, the seed separation, and the real numbers, which reproduce exactly.
   - **Selective:** the false-positive suite covers WALL, not OPENING (A3).
   - **Placement artefacts:** the real gap-referee results (A2) and the porch-question UNRESOLVED (A9).
   - **Baseline:** the source-cv baseline is generous to source-cv and right for IP-01, not for IP-02 (A7).
   - **Strip rules:** sensible; "pre-registered" is unverifiable (A10).
3. **"Its value is the OPENING class."** It follows for exterior-wall coverage at IP-01 only (A7).
   - Real OPENING evidence is *stronger* than reported: 60/63 on the axis.
   - OPENING false positives are larger than reported (A3).
   - UNet over MiT-B0 is acceptable on cost; the safety metrics favour MiT-B0 (A8).
4. **The 005K witness.**
   - It cannot fix cyklamenach: the downstream gates are untouched.
   - It is not shown to fix gozdzikowcach. At the production line it would confirm ONE_OPEN_SIDE; the split is
     undefined; the REC-18 gap was never measured.
   - What can go wrong:
     - crops centred on face lines;
     - a DASHED gap upgraded past the pattern guard;
     - open mouths of 3.2 m or less upgraded or shut by the width convention;
     - false OPENING on dimension ink;
     - an outcome gate satisfied by a label change (A1, A2, A4, A5).

## 4. Position on the primary recommendation

TRAIN_BUILDPLAN_WALL_MODEL is the right *kind* of next step. It is the only commercially clean piece that transfers to
real sheets, and it reads real openings better than 005J measured (60/63 on the wall axis, 47 at ≥ 0.8). I do not
accept its stated justification. Both round-8 failures continue past the gap seam into gates that a gap witness does
not reach. That is what the stage's own map says, and the production code shows the same. The witness's real hazard,
a false OPENING across open gaps, patterns and dimension ink, is under-reported, and the IP-02 split is undefined.

I would accept the primary re-scoped as follows:
1. **Step 0 of 005K:** an oracle-witness replay at frozen code (both round-8 houses and the 7 development houses), with
   the outcome stated per house.
2. **The witness:** IP-01 upgrades only, plus at most a whole-gap IP-02 upgrade, with crops from the jamb bands and
   `axisPx`.
3. **Gates:** on strip-level false OPENING, with real pattern and open-mouth hard negatives.
4. **Model choice:** UNet and MiT-B0 both carried to the first gate.
5. **The round-8 claim:** restated as "removes the first bad decision; the verdict also needs …".

If the oracle replay shows that even a perfect witness moves neither house, the primary should be reconsidered:
HYBRID, or NO_AI_YET plus deterministic REC-03 / REC-17 work.
