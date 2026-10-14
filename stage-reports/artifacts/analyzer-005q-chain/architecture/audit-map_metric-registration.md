# 005Q-CHAIN audit: metric-solution.ts, registration.ts and their callsites in extract.ts (base cd0c513)

Repo: `/home/user/BuildApp`, read-only. No files were edited. Scratch scripts are in `/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/` (`anchors.py`, `anchors2.py`, `ex.py`).

**Verdict on the key suspicion: confirmed, but in a different place than the brief assumed.** A scale-chosen `CHAIN_CORRECTED` value never witnesses inside `solveFrameMetric`. It does witness for that same scale in three places: the registration (anchors and confidence), the level ladder, and `solveChain`'s own "scale confirmed" gate.

Tags: KNOWN = read in code. MEASURED = read in sealed evidence. HYPOTHESIS = inferred, not verified.

The MEASURED numbers come from the sealed `metric-evidence.json` inputs listed in `research/analyzer-005q-chain/cases.json` (`/home/user/work005i-a/m-on/*`, schema 1.8.0). They were not re-extracted at cd0c513, because `work005q-chain/runs/C0` holds no evidence yet. Counts are deduplicated by (file, registration id): 236 registrations.

## 1. How the frame scale is chosen

1.1 **KNOWN.** The incumbent is the legacy page vote, and it is built from substitutions.
- `extract.ts:390` calls `solveFrameChains(measured, read.tokens, …)`.
- `chains.ts:576` calls `proposalsOf`, whose loop at `chains.ts:264` iterates over **every** `entry.readings`.
- With no `readingsOf`, those readings come from `readingLattice(token)` (`parse.ts:130`, `axis-topology.ts:359`): up to 24 strings, with single substitutions and pairs on the two weakest glyphs.
- `voteScale` (`chains.ts:433`) keeps one proposal per `chain:tokenIndex`, but that proposal may be a substitution.
- So `legacy.pooledScale` (L) can rest entirely on values the reader never read. This is the 005B self-anchoring loop, and it is still live in the incumbent.

1.2 **KNOWN.** The witnesses in `solveFrameMetric` are `Obs` records.
- `observationsOf` (`metric-solution.ts:484`) builds `reads` at line 503. With a lattice there is exactly one reading per ink: `readingOf(lattice)`, which is the ensemble reading when the external recogniser leads (`isReading`, 391–394). Without a lattice it takes `entry.readings.filter(substitutions === 0)`.
- Alternatives (`alts`, `contestAlts`, `altCost`, lines 504–513) never create an `Obs`.
- `decisive` (571) requires all of:
  - role `PRIMARY`;
  - `px ≥ 25·tol`;
  - cap height ≥ 10 px;
  - no leading zero;
  - not `LOW_QUALITY`.

1.3 **KNOWN.** Counted witness = `independence === 'INDEPENDENT' && decisive` (967, 985).
- Independence comes from the orientation decision (`independenceOf`, 644). Orientations decided by `OTHER_AXIS_SCALE`, by joining another chain's cluster (`ORIENTATION_BY_SCALE`, 892–893) or by `UNDECIDED` are never counted.
- Deduplication:
  - one ink is one witness (`gather` keys on `o.region`, 591–600);
  - an ink with two different decisive readings counts zero (I2, 899–905);
  - parallel twin lines count once (I5, 911–928);
  - structurally refuted inks become non-decisive (`structuralSupport`, 1745–1746).

1.4 **KNOWN.** Hypotheses are `clustersOf(counted)` with uncounted readings attached (968–977). Ranking and confidence use `awareEvidence`, i.e. the deciding witnesses with contested ones removed (997–1017, 1025). `confidenceOf` (713–727) assigns:

| Class | Condition |
|---|---|
| STRONG | `axesMeasured && corroborated` |
| SUPPORTED | `corroborated` |
| WEAK | ≥ 1 group |
| INCONCLUSIVE | none |

A rival of higher standing caps the class at WEAK. A rival of equal standing costs a step at ratio ≥ 0.5 and makes it INCONCLUSIVE at ≥ 0.8. Separate demotions:
- the false-consensus check (1141–1186) → INCONCLUSIVE;
- an undecided conflict or undecided rival (1099) → INCONCLUSIVE.

1.5 **KNOWN.** The relation with the page vote (1210–1225):

| Relation | Condition | Notes |
|---|---|---|
| `CONFIRMED` | \|log(sel/L)\| ≤ `agreeTol` = max(0.012, tol/longest counted px) (1041–1044) | |
| `REPLACED` | `beatsLegacy()` (1200–1209) | |
| `LEGACY_UNCONFIRMED` | L exists and neither of the above | Confidence from `legacyStats`, i.e. counted `Obs` that fit L (1049–1076); INCONCLUSIVE when there are 0 groups |
| `ADDED` / `NO_SCALE` | No L | |

`LEGACY_UNCONFIRMED` is a **relation**, not a confidence class. The final scale is L for `LEGACY_UNCONFIRMED`/`NO_SCALE` (1394).

1.6 **KNOWN.** Which readings count:

| Reading type | Witness? | Where |
|---|---|---|
| READ (lattice or ensemble as-read) | Yes, if INDEPENDENT and decisive | |
| External reading | Only as the single ensemble reading of its ink | 503 |
| Ensemble rival | Never a witness; only `contestAlts`/`altCost` | |
| `CHAIN_CORRECTED`, `DERIVED`, `SCALE_RANKED`, `STRUCTURAL` chosen value | Never | |
| `DimensionObservation` | Is the serialised `Obs` record (`record`, 526–559); `status`/`independence` recomputed at 1381–1389 | |

1.7 **KNOWN.** `legacyAnchors` (1077) = `legacy.solved` segments with origin READ or CHAIN_CORRECTED. Its **only** use is the two counters `solution.legacy.correctedAnchors` and `readAnchors` (1461–1462). It feeds no decision; grep finds no consumer outside the schema (`schema.ts:655–656`).

## 2. `correctionReadings` (404–441) and self-anchoring

2.1 **KNOWN.** The values a scale may pick for an ink:
- the reading itself (substitutions 0);
- the ensemble rival at confidence 1 with substitutions 1 (426–428);
- lattice values with `p/own ≥ 0.5` or a single non-top glyph ratio ≥ 0.7, at the same digit count only (419, 432);
- external-only values (436–439).

It is consumed by:
- `latticeReadings`, then `assignLabels` (1285–1289), then the `offers` loop `solveChain(…, fixedScale: axisScale, minCorrectionPx: 25·tol)` (1309–1310);
- `selectedValueOf`, which yields `SCALE_RANKED`/`UNRESOLVED` (1363) and is recorded only.

2.2 **KNOWN.** In `solveChain` a substituted reading that lands on the fixed scale wins whenever the as-read value misses it: merit `(1+fit)·0.45^subs` (`chains.ts:695`), origin `CHAIN_CORRECTED` (`chains.ts:758`).

2.3 **KNOWN: no self-witness inside `solveFrameMetric`.** None of `Obs`, `counted`, `hypotheses`, `relation` or `confidence` reads `solved`, `segments` or `origin`. The `legacy.solved` / `offers` segments come back only through `reads()`, which counts origin READ only (1294), and `readRegions` (1295–1296, a dedupe key). The header claim at lines 37–40 holds for this function.

2.4 **KNOWN: self-witness path 1, the registration.** This is the brief's suspected path, with the actual mechanism:
- `extract.ts:997`: `if (segment.origin !== 'DERIVED' && segment.confidence > 0 && (anchorable?.(segment) ?? true)) anchors.push(…)`. The comment at 992 says "Only a segment whose number was actually READ anchors", which contradicts the code.
- A `CHAIN_CORRECTED` value was picked because it fit `fixedScale` (L or the selected scale). It becomes a `CHAIN_SEGMENT` anchor, and `registerFrame` (`extract.ts:794`) fits metres-per-pixel to it.
- Those anchors raise:
  - the anchor count that passes the `anchors.length ≥ 2` gate (`extract.ts:793`);
  - `confidence = (0.35|0.5) + 0.08·min(5,n) − …` (`registration.ts:170`);
  - `measuredBothAxes` (`registration.ts:159`).
- The residual is near zero by construction, because every segment was admitted within `tol` of a single scale (`chains.ts:673`). `rejected` therefore cannot detect a wrong scale.
- The `anchorable` filter (`extract.ts:478–481`) only checks equality with legacy segments, `CHAIN_CORRECTED` included.

2.5 **KNOWN: self-witness path 2, `solveChain` gates.**
- `fitted` counts READ and CHAIN_CORRECTED (`chains.ts:768`). The "scale CONFIRMED on this chain, fill blanks as `DERIVED`" gate `fitted > 0 && residualPx ≤ tol/2` (`chains.ts:778`) can therefore be met by corrected values alone.
- `readSegments` = `fitted` (`chains.ts:794`) feeds `DimensionChain.closes` (`extract.ts:1014`).

2.6 **MEASURED.**
- 203 of 236 registrations carry ≥ 1 `CHAIN_CORRECTED` anchor.
- 44 have **zero** READ anchors.
- 100 claim both axes are measured (no "only one pixel axis" note) while one axis has no READ anchor.

Example: kosacce-clean, frame …803d3d68d8.
- Relation `LEGACY_UNCONFIRMED`, INCONCLUSIVE, `legacy.independentGroups = 0`, L = 5.166 cm/px.
- The registration has 6 of 6 anchors `CHAIN_CORRECTED` ('151'→721, '110'→510, '191'→391, …), confidence 0.81, both axes, 0 rejected.
- Its independent readings 1660/444, 665/178, 205/55 and 269/72 all state about 3.74 cm/px.

Example: dom-pod-jarzabem, frame …397808a266.
- `CONFIRMED STRONG`, but the registration has 9 of 9 anchors `CHAIN_CORRECTED`.
- The sealed overall segment is '1460'→**1950** (two substitutions at L = 2.787), while the lattice read the same 699.5 px span as **1960** (independent, SUPPORTED).
- The sealed total is therefore a scale-chosen value that overrides an independent reading of the same ink by 10 cm.

## 3. `registerFrame` / `solveLevelLadder`

3.1 **KNOWN.** `fitAxis` (`registration.ts:74–124`): every anchor seeds a scale; inliers within `tol`; ranked weight first with w = weight·pixelSpan (106); three rounds of weighted least squares through the origin. `registerFrame` (127–191) falls back to the other axis's scale and records `anisotropy` (141–142, 160).

3.2 **KNOWN bug: one kept anchor still registers.** The gate at `extract.ts:793` counts **input** anchors. `fitAxis` may keep only one, and `registerFrame` never re-checks, so the result has residual 0, which contradicts `extract.ts:789–792`.
- **MEASURED:** marcowki `SECTION_HY` has 1 kept anchor (+7.95) and 2 rejected, rmsPx 0, confidence 0.43. There are 8 such single-anchor section registrations.

3.3 **KNOWN.** The ladder (295–400) admits every reading of `readingLattice`, including two-substitution readings (`extract.ts:698–702`).
- `support` (302–319) counts a rung as soon as **any** reading fits.
- Lines are ranked **count first**, weight second (338). A line on which substitutions make three rungs collinear therefore beats the as-read pair.
- Origin is `CHAIN_CORRECTED` when the pick has substitutions > 0 (394).
- The picked datums become `LEVEL_DATUM_PAIR` anchors with `pixelSpan = |zeroRow − row|`, where `zeroRow` is the ladder's own fit (`extract.ts:757–771`). The registration then restates the ladder.
- **MEASURED:** 30 level datums are `CHAIN_CORRECTED`. On dom-w-arkadiach `SECTION_HY`, 2 of 3 anchors are substitutions (+0.78→4.78, +2,48→2.98). On A06, A07 and D00, the ladder registrations rest mostly or wholly on substitutions.

3.4 **KNOWN.** With two rungs, `s.count ≥ 2` (337) is met by the seed pair itself. Any two readings "agree", the residual is 0, and `fitted ≥ 2` (`extract.ts:749`) passes. A ladder of two is never checked.

3.5 **KNOWN.** Tolerance mismatch: the ladder uses 6 px (296), the registration 3 px (128). Rungs the ladder accepted are then rejected (see 3.2), and the ±0.00 rung never anchors (`extract.ts:759`, value ≤ 0).

3.6 **KNOWN: UNRESOLVED anchors.**
- A chain segment that is `UNRESOLVED` creates no evidence and no anchor (`extract.ts:929`, 1009).
- A ladder rung that is `UNRESOLVED` creates no anchor (`extract.ts:759`), **but** it is emitted as `MetricEvidence` with `origin: 'READ'`, value = first parse, confidence ×0.4 (`extract.ts:717`, 707, 728).
- `levelsFrom` (`reconstruction/src/solve.ts:252–256`) filters neither origin nor confidence, so it sets **storeys** from it (`measured: true`).
- **MEASURED:** 2 cases, dom-w-helikoniach '+0,02' and dom-w-cieszyniankach '+2.95'.

3.7 **KNOWN: a missing reading counted as agreement.**
- `refutedShareAsRead` returns **0 when nothing is stated** (`reconstruction/src/plan-resolution.ts:268`). 0 is the best bucket in `compareReadings`/`evidenceTuple` (504, 515), and T1 cannot fire (1006–1010).
- `asRead` drops a `CHAIN_CORRECTED` statement whose token text fails `/^[1-9]\d{1,4}$/` (206, 218), e.g. jarzabem's '1/60' and '050'. Such a corrected segment then neither refutes nor supports.
- Within one frame every decomposition shares the same statements, so a 0 ties. Across plan copies, a copy with no as-read statements outranks one with real refutations. **HYPOTHESIS** on how often this happens.

3.8 **KNOWN.** `registerFrame` itself never treats a missing reading as agreement: inliers need |m/s − px| ≤ tol. The circularity is upstream (2.4, 3.3).

## 4. If C1 (corrected values never anchor) were applied at `extract.ts:997`

4.1 **KNOWN.** `FrameMetricSolution` would not change at all: `relation`, `confidence`, `hypotheses` and the counters do not read anchors. The registration does change:
- fewer anchors, so lower confidence (`registration.ts:170`);
- one-axis registrations get "assumed square pixels";
- with < 2 input anchors there is no registration, and an unresolved `gap/registration` is raised (AMBIGUOUS with 1 anchor, MISSING with 0; `extract.ts:809–821`).
- Metres-per-pixel moves slightly, so the registration id and hash change (`registration.ts:173`). **HYPOTHESIS** on magnitude.

4.2 **MEASURED** effect of C1, on the sealed 005I-A inputs:
- 127 of 236 registrations have < 2 READ anchors and would disappear.
- 51 of those are `LEGACY_UNCONFIRMED` with `independentGroups = 0`: the intended removals, pure self-witness.
- 16 are `CONFIRMED`/`REPLACED`/`ADDED` frames whose scale independent `Obs` chose or confirmed. C1 throws those away (jarzabem …397808a266 is `CONFIRMED STRONG` with 0 READ anchors).

C1 keyed on chain origin is therefore too blunt.

4.3 **HYPOTHESIS: proposed alternative N1.** Anchor each axis on the counted `Obs` of the metric solution's chosen scale (a `CONFIRMED`/`REPLACED`/`ADDED` selection's `countedOf`/`deciding`), or on READ segments that match a counted `Obs` value. Keep `CHAIN_CORRECTED`/`DERIVED` as evidence with fit weight 0. Gate on **kept** anchors from ≥ 2 distinct inks. Report `LEGACY_UNCONFIRMED` with 0 groups as a registration refusal, or as a flagged "scale assumed", rather than a 0.81-confidence registration.

4.4 **KNOWN.** Consumers that would see the new state (no registration, fewer anchors, one-axis registration):

| Consumer | Location | Effect |
|---|---|---|
| `choosePlan` | `solve.ts:133–143` | Excludes the frame; score uses `confidence·2 + anchors·0.1` |
| `chooseBasePlan` | `layout.ts:586–594` | +2 for having a registration |
| Placeholder registration | `layout.ts:410–416` | Unit scale, "never a metre" |
| `resolvePlan` copies | `plan-resolution.ts:599–605` | Copy skipped; `copyExtents`/`CROSS_COPY` lost |
| Source-conflict review | `plan-resolution.ts:1066` | Uses the registration |
| Challenge | `plan-resolution.ts:1167`, `1180` | Uses the registration |
| Confidence gates | `plan-decomposition.ts:1806`, `1891` | `confidence ≤ 0` checks |
| v2 section scale | `v2/reconstruct-v2.ts:887–888` | Uses the `SECTION_HY` registration |
| Evidence pack | `evidence-pack/src/pack.ts:514`, `793` | Records the registration |
| Analysis service | `analysis-service/src/run.ts:392` | Registration count |
| Diagnostics | `plan-diagnostics.ts:45` | Anchor count and residual |

4.5 **KNOWN.** These consumers still treat `CHAIN_CORRECTED` as read even under C1, and need their own decision:
- HARD constraints (`reconstruct.ts:333`, at confidence ≥ 0.45);
- `readFraction` (`solve.ts:191`);
- `plan-decomposition.ts:478`, `806`, `820`;
- `layout-gate.ts:84`;
- `plan-extent.ts:193`;
- `plan-diagnostics.ts:59`;
- the `solveChain` `DERIVED` gate (`chains.ts:778`) and `closes` (`extract.ts:1014`).

Two places already exclude corrected values correctly: `layout.ts:532` and `plan-resolution.ts:218`/`228`/`287`.

## 5. Two raster copies and two readers

5.1 **KNOWN: two readers are one witness.**
- The ensemble gives one reading per ink (503). Lattice passes of the same ink merge into one `Region` (`textRegions`, 152–184), and `gather` keeps one per region.
- The rival only withholds a vote, through `contestAlts` (575, 992).
- But the rival is offered to the chain solver at confidence 1 with substitutions 1 (426–428). The second reader's value can therefore become `CHAIN_CORRECTED` and then an anchor (2.4).

5.2 **KNOWN: twin dimension lines on one sheet count once** (911–928; `parallelCopiesOf`, 1553–1568).

5.3 **KNOWN: raster copies are solved per frame only, with no cross-frame witness in the metric solution.**
- `latticeCache` shares only byte-identical crops (`extract.ts:350–352`).
- `scaleConflicts` (`extract.ts:1099–1131`) compares variants of the same asset only to **record disagreement**; agreement adds nothing.
- Downstream, `CROSS_COPY` (`plan-resolution.ts:456`) counts another copy's extent agreement as a corroboration, and `choosePlan` prefers the copy with more anchors (corrected ones included).
- **HYPOTHESIS:** copies of one drawing read by the same OCR share misreads, and both registrations can rest on L-fitted corrections (e.g. kosacce-clean, -tracked and -area-alone share 803d3d68d8). `CROSS_COPY` then counts one loop twice.

## Tests to register for each defect

| ID | Defect | Test |
|---|---|---|
| T-A | `extract.ts:997` | A `buildChain` fixture whose solved chain has only `CHAIN_CORRECTED` segments: assert the anchor count is 0 under C1 or N1. |
| T-B | `registerFrame` with 1 kept anchor | Inputs: a long anchor plus two shorter ones that agree with each other at another scale. Expect `undefined` (marcowki section as the real row). |
| T-C | Ladder count-first | Three rungs whose as-read pair fits but substitutions make all three collinear. Assert that READ beats the substituted line, or that the result is UNRESOLVED. |
| T-D | Two-rung ladder | Assert no registration. |
| T-E | UNRESOLVED rung relabelled READ (`extract.ts:717`) | Assert `levelsFrom` ignores it. |
| T-F | `refutedShareAsRead` with nothing stated | Assert `undefined`/INCOMPLETE, not 0. |
| T-G | Corrected-only chain | Assert no `DERIVED` fill (`chains.ts:778`). |
| T-H | Replay rows | kosacce …803d3d68d8 and jarzabem …397808a266 as end-to-end replays, scored on the full-house model and not on OCR alone. |

The leads in `stage-reports/artifacts/analyzer-005p/architecture/*` were not relied on; every claim above was re-read in code at cd0c513.