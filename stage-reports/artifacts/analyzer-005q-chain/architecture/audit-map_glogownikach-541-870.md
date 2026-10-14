# 005Q-CHAIN causal audit for S1 (dom-w-glogownikach): 541/501, 870/810 and the 870/028 twin

**Short answers:**
- **The extract.ts:997 suspicion is partly true.** Scale-chosen (`CHAIN_CORRECTED`) segments do become registration anchors. They do not feed the metric solution's CONFIRMED/STRONG verdict, and they do not feed the plan-resolution conflict test.
- **On S1, 9 of the 10 registration anchors are scale-chosen.** For 6 of them, the value contradicts the external reader's confident reading of the same ink. The one anchor marked as read is the misread 171 (true label 472).
- **Who uses which value:** 541 and 870 are what the chain solver, registration and model use. The metric solution sees 501 and 870. Plan resolution's "as printed" sees 501 and 810.
- **The −8.04% footprint is not caused by OCR.** The model stops on the inner face of the east and front walls.
- **The 870/028 twin is already resolved in production** by the leading-zero typography rule, not by the line's direction. The B2 UNRESOLVED from 005Q-OCR is caused by the research scorer.

Tags: **KNOWN** = read in code, **MEASURED** = read in sealed evidence or PROD3 output, **HYP** = hypothesis.

**Environment check (KNOWN).** HEAD is 754d8f3, which is two research-only commits on top of cd0c513. `packages/source-metrics/src` was last changed in 005I (c0ad2e8), and its versions (`METRIC_READER_VERSION` 1.4.0, lattice-ensemble 1.2.0, ensemble 1.0.0) match the sealed `/home/user/work005n/blind10/out-1/metric-evidence.json`. So the code I read is the code that produced the evidence.

**Correction to the brief (MEASURED).** The page vote is 2.6213 cm/px, not 2.432:
- `legacy.cmPerPixel` = 2.6213; per axis X = 2.626058, Y = 2.620832.
- 2.432039 is a rival hypothesis, `scale-2-432039-ce8e3c8319` (witnesses 501/206 px and 169/68 px).
- 2.432 is also the scale of the 1.4.0 OUTER_TOTALS accusation (501/206, 810/333).

## (a) 541 vs 501 — horizontal chain at y=622, span 439→645 (206 px)

1. **OCR tokens (MEASURED).**
   - `ocr-501-179b929ac9`: text 501, HORIZONTAL, pageVote KEPT, confidence 0.544. The glyph '0' has alternative ['4'].
   - Its twins `ocr-105-0b24f09c9c` (INVERTED), `ocr-81-…` and `ocr-21-…` are DISCARDED.
2. **Lattice and ensemble (MEASURED).** `ocr-lattice-501-fb62c33a1f` reads 501 with p 0.626 and class CLEAR; 541 is at p 0.169. External reading 541, p 0.99981, stable. Ensemble decision CONTESTS, asRead 501, rival 541 (witness EXTERNAL).
3. **Assignment (MEASURED).** Bound to `chain-horizontal-622-cc70acd1a7`, interval 3, the same in the legacy and final assignment.
4. **Chain segment (MEASURED).** Segment 3 is CHAIN_CORRECTED, value 541, residualCm 0.032, confidence 0.347.
   - **KNOWN mechanism:** the readings come from `readingLattice` glyph alternatives (axis-topology.ts:362). `solveChain` sets `CHAIN_CORRECTED` whenever the substitution count is above 0 (chains.ts:758).
5. **MetricEvidence (MEASURED).** `metric-dimension-1fce7f3126`: value 541, rawText "501", origin CHAIN_CORRECTED. Its `derivation.why` reads "never a witness for it" (written at extract.ts:974).
6. **DimensionObservation (MEASURED).** `dim-obs-501-horizontal-494049fb68`: valueCm 501, REJECTED, PRIMARY. It is in `conflictingObservationIds` and is a witness of the rival 2.432 hypothesis. Here the metric layer uses 501, because CONTESTS keeps the lattice reading (`readingOf`, ensemble.ts:159).
7. **Registration (MEASURED).** `anchor-chain-segment-1fce7f3126`: X axis, 5.41 m / 206 px, residual 0.00021 m.
8. **Plan resolution (MEASURED, PROD3 analysis-trace).** Statement contest `1fce7f3126 = AS_PRINTED 501 | LATTICE 501 | EXTERNAL 541`, contested and not cited.

## (b) 870 vs 810 — vertical chain at x=41, span 203→536 (333 px)

1. **OCR tokens (MEASURED).** `ocr-810-0a6036bc96`: ROTATED_CW, KEPT; glyph '1' has alternatives [7, 3, 2].
2. **Lattice and ensemble (MEASURED).** `ocr-lattice-810-75d8affd98` has asRead 810 (p 0.358), but its own sequence for 870 has p 0.484 (probabilityMargin −0.35). External reading 870, p 0.99952, stable. Ensemble LEADS, asRead 870, class SUPPORTED.
3. **Chain segment (MEASURED).** `chain-vertical-41-ab84fdbd8c` segment 0 is CHAIN_CORRECTED 870, residual −2.74 cm. It is followed by a DERIVED 17 px segment of 44.55 cm.
4. **MetricEvidence (MEASURED).** `metric-dimension-f810c24db9`: value 870, rawText 810, origin CHAIN_CORRECTED.
5. **DimensionObservation (MEASURED).** `dim-obs-810-rotated-cw-6419e0889a`: valueCm 870, INDEPENDENT, RAW, binding AMBIGUOUS.
   - It is in the selected hypothesis's `witnessIds` and `supportingObservationIds`.
   - But it is not counted: the hypothesis "why" lists "870/333 px" among the 4 readings not counted.
6. **Registration (MEASURED).** `anchor-chain-segment-f810c24db9`: Y axis, 8.70 m / 333 px.
7. **Plan resolution (MEASURED).** `f810c24db9 = AS_PRINTED 810 | EXTERNAL 870 (cited)`. The LATTICE reading is absent because its own class is AMBIGUOUS.

**What the metric solution rests on (MEASURED).** STRONG/CONFIRMED rests on 2 counted SUPPORTED readings (`topology.ocr.counted.supported = 2`): 920/350 px and 949/361 px. Both are external LEADS readings; the lattice read them as 430 and 904. That these two are the counted ones is a HYP inferred from their PRIMARY and SUPPORTED status.

### Which value each consumer uses

| Consumer | 541 ink | 870 ink |
|---|---|---|
| Legacy chain solver / page vote | 541 (CHAIN_CORRECTED from "501") | 870 (CHAIN_CORRECTED from "810") |
| Metric solution (observations) | 501 (rival scale witness) | 870 (ensemble LEADS, supporting but not counted) |
| Registration anchor | 541 | 870 |
| Plan resolution "as printed" (plan-resolution.ts:206/218/228, from classic `token.text`) | 501 (contested) | 810 (870 set aside as cited) |
| Model (layout ladder uses the evidence value, layout.ts:1137–1147) | 541 is part of the 18.83 m width | 8.70 m depth = 870 exactly |

## Why 541 and 870 stay CHAIN_CORRECTED although an independent reader read them

**Defect D1 (KNOWN).** `sameEntries` (metric-solution.ts:741–742) compares only token text, orientation and box, never the readings. On a CONFIRMED frame, metric-solution.ts:1303 therefore returns `null` for every chain whose token set did not change, and the legacy chain with its glyph-substitution value is kept.
- MEASURED: `rereadChainIds = []` on S1.
- Result: the ensemble's LEADS reading 870 can never become the chain's READ value.

## The extract.ts:997 self-witness, verified

**The code (KNOWN).**
- The comment at extract.ts:992 says "Only a segment whose number was actually READ anchors a registration".
- The condition at extract.ts:996–997 is `origin !== 'DERIVED' && confidence > 0`, so `CHAIN_CORRECTED` passes.
- `anchorable` (extract.ts:477–481) is undefined unless the chain was re-read, which on S1 is never.

**The effect (MEASURED).**
- Registration `registration-plan-xz-260da02192` has 10 anchors: 9 CHAIN_CORRECTED plus 1 READ (`legacy.correctedAnchors` 9, `readAnchors` 1).
- Its scale, metresPerPixel X/Y 0.026261/0.026207, is the legacy scale, which the corrected values were chosen to fit. Residual rms is 0.025 m.
- Confidence 0.849053 matches registration.ts:170: 0.5 + 0.08 × min(5, 10) − 2 × 0.025474.

**Anchor values against the external reader's confident reading of the same ink (MEASURED):**

| Anchor | Classic read | Anchor value | External reading |
|---|---|---|---|
| f810 | 810 | 870 | 870 ✓ |
| 1fce | 501 | 541 | 541 ✓ |
| 2bbe | 420 | 920 | 920 ✓ |
| c663 | 140 | 190 | 190 ✓ |
| 30a3 | 501 | 505 | 302 ✗ |
| 4c03 | 110 | 120 | 224 ✗ |
| d47f | 180 | 160 | 280 ✗ (lattice agrees: AGREES 280) |
| ccbf | 150 | 250 | 350 ✗ |
| 1568 | 432 | 132 | 97 (not confident; truth 346) ✗ |
| 923d | 171 (the one READ anchor) | 171 | 472 ✗ |

- The 005Q-OCR truth gives 302, 224, 280, 350, 346 and 472 for these inks. Their bindings are NO_TRUTH, so the scale "corrected" labels that sit on the wrong spans.

**Where the inflated registration is consumed (KNOWN).**
- `choosePlan` (solve.ts:141) scores candidates on confidence×2, anchors×0.1 and −rms×4.
- `chooseBasePlan` (layout.ts:593) scores on −rms×2.
- `CHAIN_CORRECTED` is counted as "printed" or "read" at plan-decomposition.ts:478, solve.ts:191 and layout-gate.ts:84.
- HYP: this affects which of S1's 4 plan frames is chosen.

**Where it is not consumed (KNOWN).**
- The metric solution: corrected values are never counted as witnesses.
- Plan-resolution T1/T3: `asRead` uses the first-read value.

**Verdict:** the self-witness is real in the registration and in the reconstruction's "read" counts, and absent from CONFIRMED/STRONG.

## Plan resolution and the PROD3 outcome

**005N (resolver 1.4.0), MEASURED in `out-1/failure.json`.** SOURCE_CONFLICT on OUTER_TOTALS: "501/206 px, 810/333 px agree on 2.432039". The first reading (163.8 m², −8.0%) was not built.

**PROD3 (resolver 1.5.0), MEASURED in its analysis-trace.**
- `withdrawnTriggers = OUTER_TOTALS`.
- doubted: `1fce7f3126` (contested).
- cited: `f810c24db9 … EXTERNAL 870 (cited)`.
- Outcome COMPLETED, model hash 19cb8fdebcacf35c, gate STRUCTURAL_LAYOUT_PARTIAL (`DEGRADING:FOOTPRINT_AREA_NEAR`).

**The completed outcome is fragile (KNOWN).**
- Two classic misreads independently imply the same wrong scale: 501/206 = 2.432039 and 810/333 = 2.432432.
- The accusation is withdrawn only because 541's external reading is not cited. Under ALL_FIT the 501 statement cannot join, so only one long reading agrees.

**Defect D2 (KNOWN).** `setAsideCited` (plan-resolution.ts ~955–976) sets aside every reading in `supportingObservationIds`, which is the selected hypothesis's `witnessIds` (metric-solution.ts:1393). That includes witnesses the solution did not count, such as 870/333.
- The confident 870 reading is muted, so the classic misread 810 is left as the only voice and becomes an accuser.

**Defect D3 (KNOWN).** For a CHAIN_CORRECTED statement, "as printed" is the classic token text (plan-resolution.ts:206; statement-contest.ts header). It ignores the ensemble reading that the metric layer already uses. The two layers disagree about what the same ink says.

**Footprint (MEASURED).**
- The model is 18.829156 × 8.70 m = 163.81 m², which is −8.04% against the published 178.13 m².
- 18.829156 m equals exactly the sum of chain-622 segments 0–7 (78→795 px).
- 8.70 m is exactly the CHAIN_CORRECTED 870 (203→536 px).
- The DERIVED 17 px end spans (44.64 cm and 44.55 cm) are excluded: "body cut on a wall's inner face; unresolved outer face east/front".
- The printed totals 1930 × 920 give 177.56 m² (−0.3%); the chain totals 1927.56 × 914.55 give 176.29 m² (−1.0%).

**Terraces (MEASURED).** The model has 0 terraces, 0 platforms and 0 balconies. `unresolved.json` says the east and front strips are "read as no recess, no return and no terrace". The source text describes a garden terrace with a pergola, so the terrace is omitted by refusal, not fabricated.

## Side defects on the same chain

- **D4 — false "nothing printed" claim (KNOWN + MEASURED).**
  - chains.ts:696 gives a span whose label fits no reading `merit −0.5` without setting `segment.token`. chains.ts:780 then fills it as DERIVED.
  - `metric-dimension-e002fdbefa` is DERIVED 575.11 cm and says "nothing is printed on this 219 px span", while its `alternatives` list the 909/904/908 readings of the label printed there. The truth label is 949 over 78→439 = 361 px.
- **D5 — overall width never bound (KNOWN + MEASURED).**
  - The overall 1930 label (classic 1410, external 1930, CONTESTS, p 0.9997) sits on `chain-horizontal-647-8fb7ed13df`, whose ticks are [78, 206, 671, 685, 782, 795, 812].
  - The 78→812 span (1930/734 = 2.629) skips 5 marks, and `METRIC_BOUNDS.skippedTicks = 2` (metric-solution.ts:68). So it is only ever bound to wrong spans of 465–607 px.

## What ink-first would change (HYP unless replayed; mechanisms KNOWN)

- **870 would become READ.** In `correctionReadings`, the ensemble asRead gets substitutions 0 (metric-solution.ts:422).
- **541 would stay CHAIN_CORRECTED.** As the CONTESTS rival it gets substitutions 1 and confidence 1 (metric-solution.ts:426).
- **Re-reads would remove anchors instead of adding READ ones.** On a CONFIRMED frame, `anchorable` requires the same origin as the legacy segment (extract.ts:480). A segment upgraded from CHAIN_CORRECTED to READ would drop its anchor.
- **Plan resolution:** a READ 870 gives AS_PRINTED 870, the statement is uncontested, there is no OUTER_TOTALS charge, and the withdrawal disappears.
- **Chain-622 re-read:** 949 READ over 78→439 would remove the fabricated cuts at 181/220. Width would be about 18.84 m.
- **Footprint:** still about −8%, because the wall outer-face decision, not OCR, drives it.
- **Honest READ anchors on S1 would be 870, 920 and 190 (plus 949 if re-bound).** The current READ 171 would become unresolved, since 472 does not fit 63.5 px.

## (c) The 870/028 twin, box x24–37, y362–382

**The label is on a vertical line (MEASURED).** It sits on `chain-vertical-41` at baseline x=41, BEFORE side, between ticks 203 and 536.

**The line's direction fixes only the axis (KNOWN).** Clockwise and counter-clockwise quarter-turns both run along a vertical line, so the line alone cannot choose between them.

**How production chooses today (MEASURED).**
- `orientationDecisions` for chain-41: chosen ROTATED_CW, `decidedBy` TYPOGRAPHY: "1 of its labels start with a zero".
- The counter-clockwise lattice `ocr-lattice-019-c7035f257b` (external 028, p 0.905) has decision NO_VALUE, "states no dimension".
- The counter-clockwise observations `dim-obs-019-*` are ORIENTATION_UNDECIDED.
- Classic `ocr-019-6b4268bba9` is DISCARDED and `ocr-810-…` is KEPT.
- This is non-circular: scale fit is not used. The choice is correct per truth (870).

**Why 005Q-OCR B2 reported UNRESOLVED (KNOWN, research only).**
- research/analyzer-005q-ocr/binding.py:7 `INT = ^[0-9]{2,5}$` accepts "028".
- score.py:254–259 merges the twins' values {870, 028} into one candidate, which makes it contested.
- Production's `/^[1-9]\d{1,4}$/` and the ensemble rule reject 028.

**HYP:** a glyph-baseline-faces-the-line side convention could serve as a second witness for orientation that does not depend on the value. This must first be checked against the codebase's definition of CW/CCW.

## Bugs found, each with a test to register

Each line gives where to fix, how to test, and what to expect.

1. **extract.ts:996–997** — anchor only on `READ`; make `anchorable` ignore origin.
   - Unit test: no `CHAIN_CORRECTED` evidence id appears among registration anchors.
   - S1 replay: anchors 10 → ≤ 4, then check the registration confidence and the selected plan.
2. **metric-solution.ts:741/1303 (D1)** — treat different readings as a change.
   - Unit test: classic "810" + lattice LEADS 870 should give a READ segment.
   - S1 replay: `f810c24db9` becomes READ.
3. **plan-resolution.ts:206 (D3) and setAsideCited (D2)** — "as printed" comes from `readingOf`, and only counted witnesses are cited.
   - S1 test: no OUTER_TOTALS charge even under AS_PRINTED.
4. **chains.ts:780 (D4)** — a span that carries a label must never be DERIVED.
   - Unit test: a span whose label's readings all miss the scale is UNRESOLVED.
   - S1: `e002fdbefa` becomes UNRESOLVED or is re-cut.
5. **End-to-end gates:** run the full-house matrix on all 48 cases. Require footprint deltas, terraces, openings and level counts to be unchanged or better, and run S2/S3 as a duplicate-drawing invariance check.

Files read:
- Code: `/home/user/BuildApp/packages/source-metrics/src/{extract.ts,chains.ts,metric-solution.ts,axis-topology.ts,parse.ts,ensemble.ts,registration.ts}`, `/home/user/BuildApp/packages/reconstruction/src/{plan-resolution.ts,statement-contest.ts,solve.ts,layout.ts,plan-decomposition.ts}`
- Sealed evidence: `/home/user/work005n/blind10/out-1/metric-evidence.json`
- PROD3: `/home/user/work005q/runs/PROD3/dom-w-glogownikach/`
- Truth: `/home/user/work005q-ocr/label-records-primary.json`
- Scorer: `/home/user/BuildApp/research/analyzer-005q-ocr/{score.py,binding.py}`