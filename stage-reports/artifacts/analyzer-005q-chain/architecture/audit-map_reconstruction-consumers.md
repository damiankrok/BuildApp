# 005Q-CHAIN causal map: reconstruction-side consumers of printed dimension statements (base cd0c513)

Short answer: the suspicion about `extract.ts:997` is confirmed. A CHAIN_CORRECTED segment is a value the solver chose because it fits the scale, and it becomes an anchor of that same scale's registration. Plan resolution keeps those chosen values out of its accusation tests, so they cannot defend the registration there. Geometry has no such guard: such a value can end up as a SOURCE_EXACT body dimension.

Tags: **KNOWN** = read in code at the cited line. **MEASURED** = read in sealed JSON. **HYPOTHESIS** = not proven. Production path is `reconstructV2` (called from `analysis-service/src/run.ts:402`). `reconstruct.ts` (v1) is only called from `test/pipeline.ts` and `scripts/reconstruct.ts`, so v1 findings below are not on the production path.

## 0. Data shapes (KNOWN)
- **C0.1** `MetricOriginSchema` has exactly READ, CHAIN_CORRECTED, DERIVED and PUBLISHED_METADATA (`source-metrics/src/schema.ts:129-138`). There is no UNRESOLVED value. `MetricEvidence.value` is a required finite number (schema.ts:276). `ChainSegment.origin` is optional and uses the same enum (schema.ts:341).
- **C0.2** The chain solver sets the origin in `chains.ts:758`: `span.reading.substitutions === 0 ? 'READ' : 'CHAIN_CORRECTED'`. The solved chain also carries an internal `'UNRESOLVED'` (chains.ts:222), but evidence is emitted only for `valueCm !== undefined && origin !== 'UNRESOLVED'` (extract.ts:929). An unread segment is written as `{pixelLength, confidence:0, labelled?}` with no `evidenceId` or `origin` (extract.ts:1009).
- **C0.3** For CHAIN_CORRECTED evidence: `rawText` is the token text the classic reader saw (extract.ts:949), `value` is the scale-chosen value, and `derivation.dependsOnScale = true` (extract.ts:964-979). A READ value whose orientation was chosen by the other axis also gets `dependsOnScale: true`. `alternatives` holds `segment.rejected` (up to 4).
- **C0.4** `MetricEvidenceSetSchema` is parsed only in `source-metrics/test/extract.test.ts:64`. No production code validates the evidence set at runtime.

## 0b. The suspected self-witness at extract.ts:997
- **C0.5 KNOWN.** extract.ts:997-1006 makes every non-DERIVED segment with `confidence > 0` a registration anchor (`metricSpan = valueCm/100`). That includes CHAIN_CORRECTED values chosen to fit the scale.
  - The only filter is `anchorable` (extract.ts:477-480). It applies only when `scaleStands && reread.has(index)`, and even then it keeps every legacy segment with the same origin and value, CHAIN_CORRECTED included.
  - `registerFrame`'s confidence formula (registration.ts:170) rewards anchor count and penalises residual. Corrected anchors are fitted to the scale, so they raise the count and lower the residual.
- **C0.6 MEASURED.** In sealed `metric-evidence.json`, CHAIN_CORRECTED values that are registration anchors:

  | House | CHAIN_CORRECTED anchors | DERIVED anchors |
  |---|---|---|
  | 005d h2-dom-w-tunbergiach | 15/15 | 0 |
  | 005d h1-dom-w-dabecjach | 22/22 | 0 |
  | 005c h1-dom-w-azaliach | 5/5 | 0 |
  | 005c h2-galaktyka | 4/6 | 0 |

  Examples of read → corrected value:
  - '1973' → 1933 (tunbergiach)
  - '718' → 110 (tunbergiach)
  - '/15' → 117 (dabecjach, `n-18f7e9a91a`)
  - '1070' → 1430 (azaliach)
  - LEVEL '+11,04' → 13.04 (galaktyka)

  005q blind tymianku `09-scale-hypotheses.json`: the legacy scale was 2.054 cm/px with `correctedAnchors: 6, readAnchors: 2, independentGroups: 0`, then REPLACED at 2.376 (STRONG). In `05-dimension-lines`, a CHAIN_CORRECTED 646 cm over 272 px gives 2.375 cm/px, i.e. corrected to the replacing scale. After REPLACED, `scaleStands=false` (extract.ts:466), so `anchorable` is undefined and every corrected segment anchors.
- **C0.7 KNOWN.** Inside reconstruction, the "confirmed" flags do not read the registration's anchors.
  - `registrationMeasuredOnBothAxes` (plan-resolution.ts:333-334) reads `solution.isotropy/relation` from `FrameMetricSolution`.
  - `firstReadingNeedsChallenge` (1120-1137) reads `solution.relation/confidence`.
  - So the self-witness reaches reconstruction through the registration's numbers (`metresPerPixelX/Y`, `residual`, `confidence`), not through the status flags.
  - Consumers of those numbers: `chooseBasePlan`, which scores `-residual.rmsM*2` (layout.ts:586-594); `registration.confidence > 0` gates (plan-decomposition.ts:1806, 1891); and the ratio of two plans' registrations used as the STATED storey scale (layout.ts:808-815, 867).

## 1. Consumers of `MetricEvidence.origin` / segment origin

| # | Consumer (file:line) | Field used | Treats CHAIN_CORRECTED as printed? |
|---|---|---|---|
| 1 | `statementsOn` plan-resolution.ts:192-211 | keeps READ and CHAIN_CORRECTED (202); `firstReadCm` = single `ocrTokens[].text` matching `/^[1-9]\d{1,4}$/` (205-206) | No: admitted as a statement, scored only through `firstReadCm` |
| 2 | `zeroSubstitution` :218 | READ → `evidence.value` (unless `rawText` starts with 0); CC → `[firstReadCm]` only if `≠ evidence.value`, else `[]` | No |
| 3 | `asRead` :228 | as #2, minus READ with `derivation.dependsOnScale` | No |
| 4 | `refutedShareAsRead` :260-268 (T1 share, resolver `refutedShare`) | `asRead` / `readingsUnder` | No |
| 5 | `latticeScales` :283-310 | `zeroSubstitution` | No |
| 6 | `bothAxes` (ISOTROPY corroboration) :620-621, 1188-1190 | `zeroSubstitution` | No |
| 7 | `metricsAtScale` :351-377 | keeps `e.value` if it agrees with the new scale; otherwise tries `firstReadCm`, then `alternatives` sorted by confidence → `reread`; else `value = 0` (refuted); DERIVED re-derived = `px·cmPerPx` (374) | Yes, when the corrected value agrees with the new scale: kept as is, not marked reread |
| 8 | `statementContests` statement-contest.ts:82 | AS_PRINTED: READ → `evidence.value`; CC → `dimensionOf(token.text)` | No (classic token text) |
| 9 | T2 PARTIAL_BINDING :1025 | `origin === 'READ'` only | N/A (CC excluded) |
| 10 | `axisLadder.valueOf` layout.ts:1139-1147 → `statements` 1150-1172 → `span` 1175-1194 | `cited.value` for any origin (READ, CC, DERIVED, PUBLISHED); falls back to `segment.valueCm` only when unit is not m/cm/mm | **Yes** (DERIVED too) |
| 11 | mass `basisOf` layout.ts:1867 | `stated ? (reread ? DERIVED : MEASURED) : SCALED`; reread = resolver's `rereadEvidenceIds` only | **Yes** |
| 12 | `extentSidesOf.readAndCloses` layout.ts:532 | requires every segment READ | No |
| 13 | grid lines `printed` plan-decomposition.ts:473-478 | READ or CC → `printedChainIds` | **Yes** |
| 14 | `dimensionedAxis` plan-decomposition.ts:806, 820 | READ or CC = "read"; anything else = unread stub | **Yes** |
| 15 | `readOn` plan-extent.ts:192-193 | READ or CC | **Yes** |
| 16 | `statedSpans` layout-gate.ts:84-87 | READ or CC chain; total = `printedTotal ?? derivedTotalCm` (cached; only NOTED reasons) | **Yes** |
| 17 | plan-diagnostics.ts:59 | count of READ or CC | Yes (diagnostic only) |
| 18 | v2 ledger reconstruct-v2.ts:1427-1442 | every unconsumed evidence → `USED_AS_CORROBORATION` "a printed figure…" | **Yes** (DERIVED too) |
| 19 | v1 `trustworthy` reconstruct.ts:333 | READ or CC, `confidence ≥ 0.45` → HARD | **Yes** (v1 only) |
| 20 | v1 thickness reconstruct.ts:273 | any origin `!== 'DERIVED'` | Yes (v1 only) |
| 21 | `footprintFrom` solve.ts:179-191 | READ or CC = read; `hard = fraction === 1` | Yes (no caller: dead code) |
| 22 | `levelsFrom` solve.ts:252-292 | LEVEL_DATUM, no origin filter → `measured: true` | **Yes** |

- **C1.1 KNOWN.** No consumer in reconstruction reads `DimensionObservation.ocr.selected` (UNRESOLVED / SCALE_RANKED).
  - The only observation fields read are `o.ocr.latticeId` and `o.valueCm` in `setAsideCited` (:965), `binding/spanPx/rawText` in T2 (:1022-1027), and `ocrClass` in plan-diagnostics.ts:188.
  - HYPOTHESIS: a span the metric layer marked `selected.by='UNRESOLVED'` can still carry a CHAIN_CORRECTED MetricEvidence that #10/#11 treat as MEASURED. Not testable from the sealed packs, which do not include `ocr.selected`.

## 2. Statement contest (005P N1a)
- **C2.1 KNOWN. Readers** (statement-contest.ts:77-91):
  - AS_PRINTED = `evidence.value` for READ, `dimensionOf(token.text)` for anything else.
  - LATTICE = `asReadValueCm` when the lattice's own class (`ensemble.lattice.ocrClass ?? ocrClass`) is CLEAR or SUPPORTED (:61-64).
  - EXTERNAL = the external value when the decision is AGREES or LEADS, or CONTESTS with `rival.witness==='EXTERNAL'` (:67-74).
  - Join key is `frameId|box|orientation`, later record wins (:52, 79).
  - `contested` = at least 2 distinct values. The contest itself decides nothing.
- **C2.2 KNOWN. Doubt policy** (plan-resolution.ts:243-257):
  - `readingsUnder` returns `asRead`, unchanged if AS_PRINTED, not contested, or `asRead` is empty.
  - Otherwise it returns `asRead ∪ contest.values`.
  - ANY_FITS means some reading fits the scale; ALL_FIT means every reading fits.
  - A statement with empty `asRead` fits nothing and is skipped in shares. A contest never adds a statement.
- **C2.3 KNOWN. Triggers** (`chargesUnder` :994-1058; production uses `withDoubt=true`: accused = ANY_FITS, accuser = ALL_FIT):
  - **T1** (:1006-1018): `registrationRefuted = refutedShareAsRead(statements, reg, ANY_FITS)`. Alternatives come from `metricScales(solution)`, else `latticeScales`, scored with ALL_FIT. Fires if `registrationRefuted ≥ 0.5` and some alternative is at least 0.25 lower.
  - **T2** (:1021-1030): only when `solution.relation === 'LEGACY_UNCONFIRMED'`; READ statements only.
  - **T3** (:1035-1050): long statements (≥ 25 % of extent). Seeds come from `asRead`. Agreeing uses `fitsUnder(…, ALL_FIT)`. `supportedLength` uses ANY_FITS. Requires at least 2 statements, at least 2 chains, and both axes.
- **C2.4 KNOWN. N1a** `setAsideCited` (:958-981): marks LATTICE or EXTERNAL readings `cited` when an observation in `solution.supportingObservationIds` has the same ink and `valueCm`. AS_PRINTED is never set aside.
  - HYPOTHESIS gap: the classic AS_PRINTED reading may itself be one of the solution's supporting witnesses. It still defends the registration under ANY_FITS. N1a only treats lattice and external readers as possible self-witnesses.
- **C2.5 KNOWN. How a CHAIN_CORRECTED statement enters.**
  - In the contest it enters only as its classic token text, never as the scale-chosen value.
  - `asRead` gives `[firstReadCm]` when the text is a valid dimension and differs from the value. Otherwise it gives `[]`, so the statement is absent from T1 and T3.
  - The `[]` case covers unparsable text such as '/15', '0461' or '13', and the edge case `firstReadCm === value` (MEASURED: 0 occurrences in the 4 sealed files checked).
- **C2.6 Must be preserved:**
  - Corrected values never count as accusers or defenders.
  - `asRead` empty → absent, never "fits".
  - AS_PRINTED for READ is `evidence.value`, which may itself come from the lattice or ensemble upstream (statement-contest.ts:11-14 doc).
  - The asymmetry ANY_FITS (defend) vs ALL_FIT (accuse).
  - The `cited` marking, and the 1.4.0 as-printed audit kept by `sourceConflictReview` (:868-891).

## 3. SOURCE_EXACT from chain statements
- **C3.1 KNOWN. Main path.**
  1. `axisLadder.span` gives `stated: true` for any chain run whose segments all have `valueOf > 0` (layout.ts:1150-1194). This includes CHAIN_CORRECTED and DERIVED.
  2. `basisOf` → MEASURED unless an id is in `options.plan.rereadEvidenceIds` (layout.ts:1866-1867). That set is filled only by the resolver or challenge `metricsAtScale` (plan-resolution.ts:815), never for upstream CHAIN_CORRECTED.
  3. reconstruct-v2.ts:409-410: `exact = m.widthM.basis === 'MEASURED' && facesOpen.length === 0` → feature MASS `SOURCE_EXACT`, `printed: true`. **Only `widthM.basis` is checked; `depthM.basis` is ignored** (KNOWN defect).
  4. reconstruct-v2.ts:411 records each cited evidence id `authority: 'HIGH'`, `USED_IN_MODEL`.
  - **So yes: a CHAIN_CORRECTED value, or an all-DERIVED chain span, becomes SOURCE_EXACT.**
- **C3.2 KNOWN.** emit.ts:192-193 writes the ring evidence as `SOURCE_EXACT` whenever `outerFacesOpen` is empty, "from the plan's printed chains". It does not check basis at all, so even a SCALED body becomes SOURCE_EXACT. Body feature (C3.1) and ring evidence can therefore disagree.
- **C3.3 KNOWN. Levels.** `levelsFrom` has no origin filter (solve.ts:252-292) → reconstruct-v2.ts:479 `SOURCE_EXACT` LEVEL. The ladder may have CHAIN_CORRECTED datums (registration.ts:394). MEASURED example: galaktyka '+11,04' → 13.04.
- **C3.4 KNOWN. Openings (same pattern, callouts).** openings-v2.ts:203-208 picks the callout width among the top-3 candidates that fit the plan gap (`widthPlan`, measured at registration mpp). It sets `resolvedBy` when that is not the first reading, yet width provenance is `SOURCE_EXACT` (:225).
- **C3.5 KNOWN, v1 only.** reconstruct.ts:333-341: HARD and MEASURED when the cited origins are READ or CC (`≥ 0.45`).

## 4. Refusal paths and how they would treat an explicit UNRESOLVED statement
- **C4.1 METRIC_RESOLUTION_INCONCLUSIVE** (reconstruct-v2.ts:241-254, `metricStop`). It wraps an already-thrown failure when `metricSolutionFor(frame).confidence === 'INCONCLUSIVE'`, using `dimensionEvidenceOf` (plan-diagnostics). It runs only on throw sites :311, :337/:343, :360, :378, :385.
- **C4.2 METRIC_CHALLENGE.**
  - Early (:295-316): `footprintOnly` (only FOOTPRINT_AREA_* blocking) and `sourceConflictReviewFor().conflict`.
  - Late (:348-370): `firstReadingNeedsChallenge` (solution not CONFIRMED/REPLACED/ADDED at ≥ SUPPORTED, or frame not chain-framed) or a conflict.
  - Outcome REFUSED (plan-resolution.ts:1271-1292) happens when a conflict exists, `drawingChoice` exists (a non-registration scale, refuted bucket strictly lower, `drawingBetter`), and it is not `acceptable` (:519-532). That throws PLAN_RESOLUTION_INCONCLUSIVE with `why: 'SOURCE_CONFLICT'` (:309, :358).
  - KEPT with a conflict adds only an AMBIGUOUS gap (:370).
- **C4.3 PLAN_RESOLUTION_INCONCLUSIVE from `resolvePlan`** (:319-345): INCONCLUSIVE TIE, or NONE_HOLDS with `compositions > 0`. Inputs are hard flags, gate refusals, footprint bucket, `refutedShare` buckets, `wallCoverage` and corroborations (`compareReadings` :496-507; `acceptable` :519).
- **C4.4 An explicit UNRESOLVED statement would need a schema change first.**
  - The TypeScript enum rejects it at compile time, and there is no runtime zod parse (C0.4).
  - If the value is withheld as `0` or `NaN`, the paths below apply.
  - (a) **Dropped safely:**
    - `statementsOn` filter (:202), so it is absent from T1, T2, T3, lattice and contest.
    - `axisLadder.valueOf` returns undefined for `cm ≤ 0` or NaN (layout.ts:1144); the walk breaks (:1161); span becomes SCALED.
    - v1 `trustworthy` (:333) → SOFT.
    - `metricsAtScale` leaves non-statements untouched (:375).
    - plan-decomposition.ts:472: `valueCm === undefined` → no grid line.
    - `dimensionedAxis`: counted unread, trimmed if short.
  - (b) **Crash:** none found. `round6(NaN)` propagates silently and there is no throw. HYPOTHESIS: a NaN `value` on a non-cm-unit evidence falls through to `segment.valueCm` (layout.ts:1141-1146).
  - (c) **Missing treated as agreement or absence of refutation:**
    - `refutedShareAsRead` skips empty `asRead` (:264). Withholding accusers shrinks the denominator, so T1 never reaches 0.5. With no statement left the share is 0 and no conflict fires.
    - T3 `supportedLength` and `agreeing` likewise lose the statement (:1038-1043).
    - The withdrawn review (:868-891) does not record such statements; it only records contested ones.
    - `firstReadingNeedsChallenge` ignores statements, so the incumbent keeps the fast path when `solution` is SUPPORTED.
    - **Hazard if a placeholder value > 0 is left in place:** the ladder treats it as stated (MEASURED → SOURCE_EXACT), `levelsFrom` (C3.3) takes it as measured, v1 thickness takes it (:273), and the ledger records it as corroboration (:1430).

## 5. How the scale drives the model
- **C5.1 KNOWN. The single scalars** are `base.registration.metresPerPixelX` and `metresPerPixelY`. They are set to an isotropic `cmPerPx/100` when the resolver or challenge applies `metricsAtScale` (:376).
  - The world origin is the envelope corner (layout.ts:1712), not the registration origin.
- **C5.2 KNOWN. Masses and rings** come from `frame.x` and `frame.z` = `axisLadder.at` (layout.ts:1707-1714, 1558-1559). These are piecewise: chain-stated values (C3.1) pin grid lines longest first, and unpinned lines are interpolated or scaled by mpp (:1198-1260). Corrected values therefore set the body geometry directly.
- **C5.3 KNOWN. Openings, terraces and interior** use `planFrameV2`. It is linear in the registration mpp, through `toWorld`, and ignores the ladder (frame.ts:83-106).
  - openings-v2.ts:104/116; terrace.ts:51/108; interior.ts:146/290.
  - HYPOTHESIS: where ladder and registration diverge, openings or terraces are displaced relative to walls.
- **C5.4 KNOWN. Wall thickness** = `wallPx · max(mpp)` (layout.ts:1716; reconstruct-v2.ts T). `chooseBasePlan` uses `residual.rmsM` (layout.ts:593).
- **C5.5 KNOWN. Upper storeys:**
  - The STATED scale is the ratio of the two plans' registrations (layout.ts:808-815, 867). Both registrations may be fitted on corrected anchors (C0.5).
  - The STATED offset comes from the registrations' `originPx` (:893-911).
  - v2 prefers outer-face frames unless the basis is STATED or PRINTED_SCALE and they disagree (reconstruct-v2.ts:508-510).
- **C5.6 KNOWN. Section and levels** are independent of the plan scale: `SECTION_HY` registration (reconstruct-v2.ts:886-888) plus `levelsFrom`. Roof `extent`, eaves and the section ranges come from world (ladder-based) bounds.

## 6. Defects to register as tests (each KNOWN in code)
- **D1** CHAIN_CORRECTED and DERIVED → MEASURED → SOURCE_EXACT (layout.ts:1139-1147 + 1867 → reconstruct-v2.ts:409).
  - Test: a chain whose only statement is a CHAIN_CORRECTED evidence (raw '1973', value 1933); expect `widthM.basis !== 'MEASURED'` and MASS provenance `!== 'SOURCE_EXACT'`.
  - Mirror test with an all-DERIVED chain.
- **D2** reconstruct-v2.ts:409 ignores `depthM.basis`.
  - Test: width stated READ, depth SCALED; expect not SOURCE_EXACT.
- **D3** emit.ts:193 ring `SOURCE_EXACT` regardless of basis.
  - Test: SCALED body; ring evidence status should not be SOURCE_EXACT.
- **D4** `levelsFrom` accepts CHAIN_CORRECTED datums as measured (solve.ts:253).
  - Test: datum origin CHAIN_CORRECTED; expect LEVEL not SOURCE_EXACT.
- **D5** openings-v2.ts:225: a scale-picked callout width is labelled SOURCE_EXACT.
  - Test: the gap picks `widths[1]`; expect width provenance not SOURCE_EXACT.
- **D6** extract.ts:997: corrected anchors fit the registration that chose them (C0.5/C0.6). Out of reconstruction scope, but it feeds C5.1.
  - Test: registration anchors exclude evidence with `derivation.dependsOnScale`; compare `metresPerPixel`, residual and confidence before and after on tunbergiach, dabecjach and tymianku.
- **D7** Missing-as-absence in T1/T3 (C4.4c).
  - Metamorphic test: replace accusing READ statements with withheld ones. A conflict must not silently become KEPT without a gap naming the withheld statements.