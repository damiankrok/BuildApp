**dom-w-murajach, label 1020: causal chain and why the scale is refused (005Q-CHAIN, read-only audit)**

Short answer: the suspected self-witness at `extract.ts:997` is real, but it is downstream. The first wrong step is binding: 1020 is attached to a 412 px piece of a dimension line that was split in two. Turning 1010 back into 1020 does not repair the scale.

Tags: [K] read in code. [M] read in the sealed evidence or PROD3. [H] hypothesis that needs a replay.

Sources:
- Sealed evidence: `/home/user/work005l/blind/h1-dom-w-murajach/metric-evidence.json`
- S2 = `frame-asset-rzut-36e1e5a39d-fb4609c5e2`
- S3 = `frame-asset-rzut-44d6d1166d-006f85ed53`

### Correction to the task's premise
S2 and S3 are not two copies of one drawing [M]:
- In the PROD3 digest (`plan-diagnostics/digest.json`), `plans[]` gives S2 the storey `GROUND` and S3 the storey `ATTIC`. Both are 853×853.
- Their label truth sets share only "240". S2 has 115, 252, 1020, 110, 270, 230, 740, 402, 410, 240, 582, 314. S3 has 298, 390, 288, 352, 304, 240, 326.
- S3 has no token, lattice or truth record for 1020, so there is no S3 counterpart to trace.
- S2 and S3 are still not independent: they come from one publisher package and one typeface.

### Causal chain for label 1020 on S2

1. **OCR tokens [M].**
   - `ocr-1020-f5f1aaae73`: text "1020", box x409–442 y787–804, HORIZONTAL, pageVote KEPT, confidence 0.535441.
   - Its glyphs and confidences: '1' 0.658, '0' 0.740, '2' 0.535 (runners-up 7 / 3 / 1 at score 0.499 / 0.453 / 0.438 against 0.575), '0' 0.740.
   - Another token covers the same box: `ocr-0501-b6e9e4e6c0` "0501", INVERTED, DISCARDED.

2. **Lattice and ensemble [M].**
   - `ocr-lattice-1020-228c9cf607`: asRead 1020, asReadP 0.547, class SUPPORTED, stable.
   - Other sequences it holds: 1010 (p 0.225), 1030 (0.119), 1070 (0.109).
   - External reader (PP-OCRv6): "1020", posterior 0.999332, stable across all four variants.
   - Ensemble decision AGREES, ocrClass CLEAR.
   - Both readers agree on 1020, and 005Q-OCR truth is 1020 (PRIOR_TRANSCRIPTION, loss `STATEMENT_VALUE_REWRITTEN`). OCR is not the fault.

3. **Binding and topology [M].**
   - Legacy and final assignment are the same: BOUND to `chain-horizontal-809-8ba358fc77`, interval 0.
   - That chain has ticks [108.5, 520.5] = 412 px. The 520.5 end is QUESTIONABLE (`LIGHTER_THAN_LINE`).
   - A second chain sits on the same baseline: `chain-horizontal-809-cca9105630`, ticks 550.5…768.5, ending in a TICK.
   - The label centre (425.5) is off-centre on the 412 px piece by `offsetShare` 0.269417. The threshold `BINDING_BOUNDS.centred` is 0.1 (`metric-solution.ts:261`).
   - The 1020 observation's binding role is therefore UNCENTRED, so it is not decisive (`metric-solution.ts:571`).
   - [H] One line was split into two chains. The union 108.5–768.5 is 660 px, the label sits centred on it (offset about 0.02), and it matches the plan's wall extent of 108.5–765.5 (657 px).

4. **Scale vote: the scale is seeded by the 1010 substitution itself.**
   - [K] `proposalsOf` (`chains.ts:259–285`) emits a proposal for every reading in the substitution list (`readingLattice`, `parse.ts:130`), not only for the reading as printed.
   - [K] `voteScale` (`chains.ts:579`) and `refineAxis` (`chains.ts:582`) work on those proposals, with a ×1.5 bonus for agreement across chains (`supportFor`, line 342).
   - [M] I reimplemented this in `scratchpad/vote.py`. It reproduces the sealed **2.451224 cm/px** exactly.
     - The winning seed is 1010/412 = 2.451456, weight 5.746 (1020→1010 together with 151→131 on a vertical chain).
     - 1020/412 = 2.475728 only reaches weight 4.412.
     - About 99.7% of the fit's denominator comes from the 1010/412 proposal.

5. **First recorded replacement [K][M].**
   - `solveChain` runs at `fixedScale` = scaleX = 2.451224 (`chains.ts:587`).
   - 1020 misses the span by |1020/2.451224 − 412| = 4.12 px, more than the 2.2 px tolerance, so it is skipped. 1010 misses by 0.04 px.
   - `chains.ts:758` sets `origin = 'CHAIN_CORRECTED'` (one substitution).
   - The sealed segment: valueCm 1010, residualCm 0.0957, confidence 0.34324, evidenceId `metric-dimension-8b1d309902`. The chain's `derivedTotalCm` is 1010 and `closes` is true.

6. **MetricEvidence `metric-dimension-8b1d309902` [M].**
   - value 1010, rawText "1020", origin CHAIN_CORRECTED.
   - `derivation`: rawText 1020, valueText 1010, substitutions 1, `dependsOnScale` true, why: "…never a witness for it".
   - alternatives: 1020, 1070, 1030, 3020, each at confidence 0.2.
   - provenance `metrics.chain-solver@1.4.0`.
   - Written at `extract.ts:945/949/964–978`.

7. **DimensionObservation `dim-obs-1020-horizontal-18e5490f79` [M].**
   - valueCm 1020, span 412, implied 2.475728, independence INDEPENDENT, status REJECTED.
   - binding role UNCENTRED, `questionableEnds` 1.
   - ensemble AGREES, `valueAlternatives` 1010 / 1030 / 1070.

8. **Metric solution for S2 [M].**
   - relation `LEGACY_UNCONFIRMED`, confidence INCONCLUSIVE, `independentWitnesses` 0, isotropy ASSUMED.
   - legacy block: cmPerPixel 2.451224, `correctedAnchors` 3, `readAnchors` 0.
   - **1010 is not a witness of any hypothesis.** The 1020 observation is listed as a witness of `scale-2-475398-a8c499c203`, together with 240/98 and 115/48.5, but "not counted", so `independentGroups` is 0.
   - [K] Legacy support counts only the metric's own counted observations (`metric-solution.ts:1049–1075`), not the legacy anchors. The corrected values therefore do not inflate the metric confidence.

9. **Registration: this is the self-witness [K][M].**
   - [K] `extract.ts:997` admits any segment with `origin !== 'DERIVED' && confidence > 0`. CHAIN_CORRECTED passes.
   - [K] This contradicts the comment at `extract.ts:992` ("Only a segment whose number was actually READ anchors a registration").
   - [K] `anchorable` is undefined here because `rereadChainIds` is `[]` (`extract.ts:464–481`).
   - [M] `registration-plan-xz-c5d5b9399e`. Every anchor is CHAIN_CORRECTED; none is READ:

     | Anchor | Axis | Value used | Span | Residual |
     |---|---|---|---|---|
     | `anchor-chain-segment-8b1d309902` | X | 10.10 m | 412 px | 0.000167 m |
     | `anchor-chain-segment-a7574c82c9` | X | 1.17 m (from "111") | 48.5 px | |
     | `anchor-chain-segment-ccc607b151` | Y | 1.57 m (from "151") | 63.5 px | 0 |

   - Fitted scale: mppX 0.024514, mppY 0.024724. The Y scale is exactly 157/63.5; truth for that ink is **252**.
   - [K] `registration.ts:159/170`: `measuredBothAxes` is true, so confidence = 0.5 + 0.24 − 0.022 = **0.718133** [M]. That is a "two-axis" registration with no value read as printed.
   - Who reads this registration [K]:
     - `choosePlan` scores on confidence and residual (`solve.ts:141`).
     - `chooseBasePlan` subtracts the residual (`layout.ts:593`).
     - Plan readings use it as the "registered scale" (`plan-resolution.ts:286/318/1001`).
     - PROD3 digest: `scale {anchors 3, mppX 0.024514}`.

10. **The wrong scale also flips the vertical orientation (a second defect) [K][M].**
    - [K] `xScale = clustersOf(xWitnesses)` at `metric-solution.ts:829` does not require decisive witnesses.
    - [M] It took 2.475566 cm/px, built mostly from the UNCENTRED 1020/412.
    - [M] Using that scale, `chain-vertical-244` was set to ROTATED_CCW with decidedBy `OTHER_AXIS_SCALE`, on "1 of its labels within 2 digits". That keeps the misreads 151 and 014 and drops the true ROTATED_CW readings 252 and 410 (truth records agree).
    - [M] `chain-vertical-49` (209→685 = 476 px, which carries the true **740**) is decidedBy UNDECIDED. Its observation 740/476 stays `ORIENTATION_UNDECIDED`.

11. **PROD3 `failure.json` [M].**
    - `reasonCode METRIC_RESOLUTION_INCONCLUSIVE`, stage REGISTERING_VIEWS / METRIC_RESOLUTION.
    - firstFailure `PLAN_LAYOUT_REJECTED`, gateBlocking `FOOTPRINT_AREA_WRONG` (169.92 m² against the published 75.83).
    - Trigger [K]: `metricStop` at `reconstruct-v2.ts:241–253` relabels the plan failure because the solution confidence is INCONCLUSIVE.
    - `scaleCmPerPx` 2.4514 (the registration), `legacyCmPerPx` 2.451224, `independentWitnesses` 0.
    - Side effect [M]: the attic (S3) is stacked at `printedScale` k 0.618138 = 1.516/2.451 (`storeys[0]`), so it is shrunk to 62%.

### Answers

**Can a downstream consumer recover 1020 from what is sealed?** Yes [K][M]. It is in:
- `evidence.rawText`, `derivation.rawText` and `alternatives[0]`;
- the token text;
- the lattice asRead and the external reading;
- `dim-obs.valueCm`.

Code that does recover it:
- `plan-resolution.ts:206` (`firstReadCm`) and `:218/228` (`zeroSubstitution` / `asRead`);
- `statement-contest.ts:82` (AS_PRINTED, LATTICE and EXTERNAL all give 1020).

Code that does not: the registration anchor (`extract.ts:1004` uses `segment.valueCm`), the fitted registration, and everything that consumes it.

What cannot be recovered: the correct 660 px binding. No sealed chain record contains it.

**Which step first replaced 1020 with 1010, and with what scale as input?**
- The first use of 1010 is `voteScale` (`chains.ts:579`): 1010/412 seeds the frame scale itself [M, by reimplementation].
- The first recorded replacement is `solveChain` at `chains.ts:758`, run at 2.451224 cm/px.
- That input scale is 1010/412 to within 0.01%. The value is chosen because it fits a scale that it itself produced. The circularity starts upstream of `extract.ts:997`.

**Would reverting 1010→1020 give Murajach an independent two-axis metric?** No.
- [M] 1020/412 = 2.4757 is still bound UNCENTRED, so it stays not decisive.
- [K] `plan-resolution`'s `agrees` (`plan-resolution.ts:~214`) allows 3%. 1020 against 2.4514 is within that, so plan resolution already counts 1020 as supporting the registration. Reverting changes nothing there.
- [M] The Y axis has no counted READ witness. The candidates are:
  - 240/98: INDEPENDENT, but binding role ALTERNATIVE, so not decisive.
  - 740/476: ORIENTATION_UNDECIDED.
  - 410/264: ORIENTATION_UNDECIDED.
  - 252: dropped by the wrong orientation.
- [H, strong] The real scale is about 1.55 cm/px, not 2.45. All of these agree:

  | Reading | Basis | Scale |
  |---|---|---|
  | 1020 / 660 px | merged line at y=809 | 1.5455 |
  | 740 / 476 px | chain-vertical-49 | 1.5546 |
  | 410 / 264 px | chain-vertical-244 | 1.553 |
  | 1020 / 657 px | wall extent, width | 1.5525 |
  | 740 / 476.75 px | wall extent, depth | 1.5522 |

  - The house would then be 10.20 × 7.40 m = 75.48 m², against the published 75.83 (−0.5%).
  - The resolver's reading1 of 178.2 m², rescaled to this scale, is about 70.8 m².
  - S3's own vote is 1.516. That is suggestive only: its registration is built entirely from CHAIN_CORRECTED anchors.
  - Risk: 740/476 misses a pooled 1.5455 by 2.8 px, which is over the 2.2 px tolerance. A replay must check this.

### Every CHAIN_CORRECTED anchor on S2 and S3 [M]
No READ anchor exists on either sheet. Every value checked against truth is wrong.

| Sheet | Evidence | Axis | Token text → sealed value | Span | Truth |
|---|---|---|---|---|---|
| S2 | 8b1d309902 | X | 1020 → 1010 | 412 px | 1020 |
| S2 | a7574c82c9 | X | 111 → 117 | 48.5 px | 115 (ensemble AGREES 115) |
| S2 | ccc607b151 | Y | 151 → 157 | 63.5 px | 252 (ensemble AGREES 252) |
| S3 | 0d0b2be74d | Y | 740 → 148 (2 substitutions) | 98.5 px | 298 (rotational twin) |
| S3 | 5f459b972a | Y | 248 → 148 | 98 px | 298 |
| S3 | 3e49fdced3 | X | 140 → 190 | 124 px | 390 |
| S3 | a1c3f5df81 | X | 188 → 168 | 108 px | 288 |
| S3 | e403869c26 | Y | 153 → 155 | 103 px | 352 |
| S3 | d339c248c2 | X | 53 → 55 | 36.5 px | no truth record |

S3 is also `LEGACY_UNCONFIRMED`: legacy 1.516396, `correctedAnchors` 6, `readAnchors` 0, registration confidence 0.880 (inflated in the same way).

### Defects to register, with tests
- **D1 (binding / line fragmentation)**
  - Collinear chain pieces on one baseline with a QUESTIONABLE end are never merged.
  - Test: a synthetic line with a gap and a centred overall label. The label must bind to the union span, not be UNCENTRED.
- **D2 (`chains.ts:259–285`)**
  - Substitution readings vote in the scale.
  - Test: corrupt one character of the dominant label. The vote must not land on the corrupted value's ratio, and no segment may be CHAIN_CORRECTED toward a scale it seeded.
- **D3 (`extract.ts:997`)**
  - CHAIN_CORRECTED segments anchor the registration, and two of them set `measuredBothAxes`.
  - Test: a frame with zero READ segments must produce no registration, or one flagged as not measured; confidence must not exceed the READ-only value.
- **D4 (`metric-solution.ts:829`)**
  - The `OTHER_AXIS_SCALE` decision uses non-decisive X witnesses.
  - Test: an UNCENTRED-only X cluster must not decide a vertical orientation.
- For all four, replay on the sealed Murajach evidence:
  - expect the true scale at about 1.55 with two-axis decisive witnesses;
  - confirm S3 is no longer stacked at k 0.618;
  - check that other cases do not regress.

Files:
- `/home/user/BuildApp/packages/source-metrics/src/chains.ts`
- `/home/user/BuildApp/packages/source-metrics/src/extract.ts`
- `/home/user/BuildApp/packages/source-metrics/src/metric-solution.ts`
- `/home/user/BuildApp/packages/source-metrics/src/registration.ts`
- `/home/user/BuildApp/packages/reconstruction/src/plan-resolution.ts`
- `/home/user/BuildApp/packages/reconstruction/src/statement-contest.ts`
- `/home/user/BuildApp/packages/reconstruction/src/v2/reconstruct-v2.ts`
- `/home/user/BuildApp/packages/reconstruction/src/solve.ts`
- `/home/user/BuildApp/packages/reconstruction/src/layout.ts`
- `/home/user/work005l/blind/h1-dom-w-murajach/metric-evidence.json`
- `/home/user/work005q/runs/PROD3/dom-w-murajach/failure.json`
- `/home/user/work005q/runs/PROD3/dom-w-murajach/plan-diagnostics/digest.json`
- `/home/user/work005q-ocr/label-records-primary.json`
- `/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/vote.py` (vote reimplementation)