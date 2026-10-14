# 005Q-CHAIN causal map: OCR, ensemble, rotation, page vote and correlated witnesses (base cd0c513, read-only)

The key suspicion holds, but only at the registration layer. A segment the chain solver corrected to fit a scale (`CHAIN_CORRECTED`) is admitted as a registration anchor at `extract.ts:997` and raises that registration's confidence. It is not counted when the independent metric solution chooses the scale (§3).

Tags: **KNOWN** = read in code at cd0c513. **MEASURED** = read in sealed evidence under `/home/user/work005i-a/m-on/*/metric-evidence.json` (23 sets at schema 1.8.0 plus 3 legacy sets at 1.1.0), `/home/user/work005n/blind10/out-1` (glogownikach) and `/home/user/work005l/blind/h1-dom-w-murajach`. Those sets were produced by earlier production builds (005I, 005L, 005N), not by cd0c513. **HYPOTHESIS** = inferred, not yet confirmed.

## 1. How a label's candidate values are generated, and how the ensemble decides

**C1.1 KNOWN — the classic token.** `readNumbers` (`ocr.ts:1017`) reads the page as it lies and turned each quarter-way (`:1033-1058`). For plans it keeps every pass's tokens in `OcrResult.raw` (`hypotheses: isPlan, retainPasses: isPlan`, `extract.ts:369`). Each glyph carries `alternatives` from the template matcher.
- Legacy candidates come from `readingLattice(token)` (`parse.ts:130`): single substitutions on any glyph, plus pairs on the two least-decided glyphs, at most 24 strings. `parseNumber` (`parse.ts:53`) then keeps the `LINEAR_DIMENSION` parses. Each candidate has `confidence` = alternative score / glyph score and `substitutions` 0, 1 or 2.
- These are the default `ChainToken.readings` (`axis-topology.ts:356-366`) whenever no `readingsOf` is passed.

**C1.2 KNOWN — the numeric lattice.**
- `dimensionLabelLattices` (`extract.ts:1142-1160`) re-reads every raw token of 2–6 glyphs that lies on a dimension line. `onDimensionLine` (`:1164`) only requires the text axis to match the chain's axis, so both vertical rotations qualify.
- `labelLattice` (`numeric-lattice.ts:908`) produces up to 8 `sequences: LatticeSequence[]` (each with `valueCm`, `p`, `nonTop`), plus `asRead`, `asReadValueCm`, `ocrClass`, `asReadStability` and `countAmbiguity`.
- `asRead` is picked by `pickAsRead` (`:1302`). It prefers anchors that state a dimension, then anchors without a leading zero, then the one with the best `segScore`. No scale is involved.

**C1.3 KNOWN — the external recogniser (PP-OCRv6).**
- One crop per lattice token: `extract.ts:438-448`, cut by `labelCrop(key, read.passes[token.orientation], token.passBox)` (`recogniser.ts:103`). Keys are opaque (`c0`, `c1`, …).
- What comes back is an `ExternalReading` (`recogniser.ts:~41`): `topK` (digits-only beam with posteriors), `greedy {text, meanP}`, `stable`, and four bracket `variants` (`BASE`, `PAD2`, `TRIM1`, `SCALE90`).
- The recogniser is called once per lattice token, so a vertical ink gets one external reading per rotation (see C2.2).

**C1.4 KNOWN — the ensemble (`ensembleOf`, `ensemble.ts:91-156`).** "Corroborating" means: posterior ≥ 0.9 and `meanP` ≥ 0.9, stable under all four variants, and `greedy.text === top text`.

| Decision | Condition (line) | `asRead` / class | `rival` |
|---|---|---|---|
| `NO_VALUE` | no digits (:107), or lattice not confident and the external text is not a dimension (:143) | lattice unchanged | – |
| `NOT_COMPARABLE` | model's own answer is not bare digits, or the lattice reading has a separator, and nothing contests (:122-129) | unchanged | – |
| `AGREES` | same digit string and corroborating (:132-133) | lattice `asRead`, **`CLEAR` for any lattice class, including `LOW_QUALITY` and leading-zero `AMBIGUOUS`** | – |
| `NOT_CORROBORATING` | same digits but not corroborating (:134), or lattice unconfident and external unconfident (:144) | unchanged | – |
| `CONTESTS` | lattice `CLEAR`/`SUPPORTED`, external differs, same digit count (:137-139) | lattice `asRead`, `AMBIGUOUS` | `{witness: 'EXTERNAL'}` only if corroborating and valued |
| `CONTESTS_COUNT` | as above with a different digit count (:141), or separator mismatch (:125-127) | `AMBIGUOUS` | – |
| `LEADS` | lattice not `CLEAR`/`SUPPORTED`, external valued and corroborating (:146-155) | **external text, `SUPPORTED`** | lattice value, `{witness: 'LATTICE'}`, if same length |

**C1.5 KNOWN — `readingOf(lattice)` (`ensemble.ts:159-163`).** Returns `{asRead, valueCm?, ocrClass}`: the ensemble's fields when an ensemble exists, otherwise the lattice's own. Consumers:
- `observationsOf`, `metric-solution.ts:498`: the observation value (`reads`, :503), `rawText` (:532), `leadingZero`, `ocr.ocrClass`, and `decisive` (which excludes `LOW_QUALITY`).
- `contestValues` (:382): when the class is `AMBIGUOUS`, every alternative contests.
- `correctionReadings` (:411): the reading enters with `substitutions: 0` (`isReading`, :391-394). It is the only reading set the re-solved chain sees (`latticeReadings`, :1285-1289).
- `latticeAlternatives` (:470).

**C1.6 KNOWN — the rival is promoted to a full-strength correction.** In `correctionReadings`, the `rival` enters with `confidence: 1, substitutions: 1` (`metric-solution.ts:426-429`; `externalOnly` :444-452). When a scale picks it, `chains.ts:758` labels the segment `CHAIN_CORRECTED`. A value the ensemble leads with is `substitutions: 0`, so it becomes `READ` even though it differs from the classic `token.text`.

**C1.7 MEASURED — ensemble decisions across 26 sets.** `NO_VALUE` 3150, `NOT_COMPARABLE` 893, `LEADS` 576 (319 from `AMBIGUOUS`, 257 from `LOW_QUALITY`), `NOT_CORROBORATING` 506, `AGREES` 314 (128 from `AMBIGUOUS`, 30 from `LOW_QUALITY`), `CONTESTS` 84, `CONTESTS_COUNT` 69.

## 2. Rotation handling

**C2.1 KNOWN — both quarter-turns are produced and kept.**
- `readNumbers` reads `ROTATED_CW` and `ROTATED_CCW` (`ocr.ts:1033-1058`); with `hypotheses`, `raw` holds every token from every pass (`:1064-1066`).
- `dedupeOrientations` (`ocr.ts:921-958`) is the legacy page vote. It sums `tokenMerit` = score × confidence × glyph count (`:911`) per vertical pass, drops the losing pass when it is more than 1.1× behind, and resolves box clashes by containment. **No scale is used.**

**C2.2 KNOWN — each rotation gets its own lattice, external reading and ensemble.** `dimensionLabelLattices` iterates over `read.raw` (`extract.ts:1149`) and passes `token.orientation` to `labelLattice` (`:1154-1156`). The crop is cut from `read.passes[token.orientation]` (`:441`).
- The lattice cache is keyed on crop bytes plus style (`numeric-lattice.ts:915`), so the two rotations never share an entry.
- **MEASURED:** 1602 overlapping CW/CCW lattice pairs across 26 sets. In 880, both rotations' `readingOf` state a dimension; in 19, both are `CLEAR`/`SUPPORTED`. Examples from dom-w-modrzykach: CW `LEADS` 196 vs CCW `LEADS` 961; 609 and 689 `LEADS` in both rotations; CW `AGREES` 211 `CLEAR` vs CCW 117. From glogownikach frame `…a-0cb0a5c1d9`: CW 706 → `LEADS` 346 vs CCW 402.

**C2.3 KNOWN — where orientation is decided.**
1. Legacy page vote: `ocr.ts:921-958`. It feeds `solveFrameChains(measured, read.tokens …)` (`extract.ts:390`) and `OcrToken.pageVote` (`:371-373`).
2. Metric solution, `solveFrameMetric`:
   - Horizontal (`metric-solution.ts:772-779`): `PAGE_UPRIGHT` by default. `AXIS_SELF_CONSISTENCY` uses `consistentCluster` across the whole axis (INVERTED wins only at more than 2× the weight). `TYPOGRAPHY` counts leading zeros on **classic `e.token.text`** (`:771`).
   - Vertical `decideVertical` (:784-816):
     - (i) `SINGLE_READING`.
     - (ii) `CHAIN_SELF_CONSISTENCY` (:791-794): a cluster of the chain's own readings. This is a scale fit inside the chain, not the page scale.
     - (iii) `AXIS_SELF_CONSISTENCY` via `joinedCm` (:798-807): a cluster built from other chains on the axis.
     - (iv) `TYPOGRAPHY` on classic `token.text` (:811-813).
   - Then `AXIS_MAJORITY` (:829-840).
   - Then `OTHER_AXIS_SCALE` (:841-851). This is the **only** decision that uses the other axis's scale. It is ranked by raw fits, then `latticeFits` (:648-662), which uses classic `readingLattice` with up to 2 substitutions.
   - Then `UNDECIDED` (:853-856): the legacy orientation, else the higher summed `tokenMerit` (the max-merit fallback).
3. `textAxisOf` (`ocr.ts:120`) only filters by axis: CW and CCW are both `VERTICAL`.

**C2.4 KNOWN — what `dependsOnScale` marks, and what it misses.**
- `chainOrientation[c].dependsOnScale = decidedBy === 'OTHER_AXIS_SCALE'` (`metric-solution.ts:1473`).
- `buildChain` adds `derivation.dependsOnScale = true` only for `CHAIN_CORRECTED` segments or chains with that flag (`extract.ts:964-980`).
- **Not marked:**
  - (a) readings fitted to `joinedCm`. They are tagged `ORIENTATION_BY_SCALE` on the observation (:893) but carry no derivation on `MetricEvidence`.
  - (b) chains decided `UNDECIDED`. Their observations are `ORIENTATION_UNDECIDED` and are never witnesses, yet their legacy segments become `READ` evidence and registration anchors with no flag.

**C2.5 KNOWN — can two rotations become two separate witnesses?** Inside the metric solution, no. `textRegions` (`metric-solution.ts:152-189`) merges tokens of *different* orientations that cover the same ink (`:163`; `sameInk` IoU > 0.4 or containment > 0.6), and every count is then one per region:
- `gather` (:591-600)
- `decisiveBy` (:899-903)
- `legacyRegions` (~:1068)
- `corrected`/`inList` (:1260-1279)

Witnesses also come only from the orientation decided for each chain (:886-895). Two weaknesses remain:
- **HYPOTHESIS:** regions are built only over `dimensionLabels` tokens (height-filtered, :197-215). A rotated fragment that fails `sameInk`, or a legacy token outside `labels`, has no region (`if (region) inList.add`, :1272). The other rotation's token could then also be appended (:1273-1279), putting one ink into `assignLabels` twice. `assignLabels` deduplicates only identical `tokenKey` (`axis-topology.ts:351-354`).
- **Untested assumption:** registration anchors (`extract.ts:997`) have no region or ink deduplication. They rely entirely on the solved chains.

**C2.6 KNOWN — label binding uses classic readings, values use the ensemble.** The per-orientation assignment `assignTokens(chains, labels.filter(o))` (`metric-solution.ts:761`) passes no `readingsOf`. So whether a token is a label at all, and which interval it binds to, is decided by the **classic** substitution list. The value it then carries comes from `readingOf`.
- **HYPOTHESIS:** an ink whose classic token has no dimension parse within 2 substitutions is dropped, even when the ensemble leads with a valid value.

## 3. The page vote, and which value each consumer trusts

**C3.1 KNOWN — what `pageVote` is.** `OcrToken.pageVote` is `KEPT` or `DISCARDED`: whether the raw token survived the orientation clash in `dedupeOrientations` (`extract.ts:371-373`; `schema.ts:194`). It is about **orientation, not value**. The token's `text` is always the classic reader's.

**C3.2 MEASURED — glogownikach, token `810` (ROTATED_CW, KEPT, box x 24-37 y 362-382).** This ink appears in two raster copies, frames `…0-b0502a47aa` and `…a-0cb0a5c1d9`, with identical boxes. In both, the lattice reads `810 AMBIGUOUS` and the ensemble `LEADS 870 SUPPORTED` (external p 0.9995), with rival `810/LATTICE`.

| Frame | Relation | Evidence | origin | value | rawText | derivation |
|---|---|---|---|---|---|---|
| `…b0502a47aa` | `REPLACED` (re-solve via `correctionReadings`) | `3c359032b7` | `READ` | 870 | `810` | none |
| `…a-0cb0a5c1d9` | `CONFIRMED` (legacy chain kept; legacy `readingLattice` substitutes 1→7) | `f810c24db9` | `CHAIN_CORRECTED` | 870 | `810` | `dependsOnScale` |

The same ink also gives `501` HORIZONTAL (lattice `501 CLEAR`, ensemble `CONTESTS`, rival 541 external) → `CHAIN_CORRECTED` 541 in both frames.

In a third case, classic `501` ROTATED_CW has lattice `102 AMBIGUOUS` and ensemble `LEADS 302`. The sealed value is **505**, a classic substitution that fits the scale; it is not a value any of the three readers produced.

**C3.3 KNOWN — the trusted value per consumer.**

| Consumer | Value used | Callsite |
|---|---|---|
| Legacy chain solver and scale vote | classic `token.text` plus up to 2 substitutions; **substitutions vote for the scale** | `extract.ts:390`, `chains.ts:259-291` (`proposalsOf`, every reading), `chains.ts:567-584` |
| Metric solution witnesses | `readingOf(lattice)`, no substitutions; without a lattice, `readings.filter(substitutions === 0)` | `metric-solution.ts:498-503` |
| Metric re-solve | `correctionReadings` (ensemble reading = `READ`, rival / plausible values = `CHAIN_CORRECTED`) | `:1285-1289`, `:1301-1312` |
| `MetricEvidence` | `value` = chosen; `rawText` = **classic** `token.text` | `extract.ts:949` |
| Statement contest `AS_PRINTED` | `READ` → evidence value; `CHAIN_CORRECTED` → **classic `token.text`** | `statement-contest.ts:82`; `plan-resolution.ts:206` (`firstReadCm`) |
| Statement contest `LATTICE` / `EXTERNAL` | lattice's own pre-ensemble class `CLEAR`/`SUPPORTED`; external when `AGREES`, `LEADS`, or `CONTESTS` with an external rival | `statement-contest.ts:61-75` |
| Refutation and T1/T3 (`asRead`) | `zeroSubstitution` minus `READ` with `dependsOnScale`; the leading-zero test is on **classic `rawText`** | `plan-resolution.ts:218`, `:228` |
| `bothAxes` isotropy | `zeroSubstitution` (does **not** drop `READ` with `dependsOnScale`) | `plan-resolution.ts:624` |
| Registration | evidence value as `metricSpan` | `extract.ts:997-1006` |
| Room labels (v2) | classic text, `pageVote !== 'DISCARDED'` | `reconstruct-v2.ts:784` |

**C3.4 MEASURED — classic `rawText` and the sealed value diverge.** Across 26 sets, 66 `READ` dimension evidences have a value that differs from the digits of `rawText`. In 12 of them `rawText` has a leading zero (`010`→670, `050`→450, `016`→426, `021`→620/624). `zeroSubstitution` (`plan-resolution.ts:218`) drops these as "no reading", although the metric layer read them.

## 4. The self-witness suspicion at `extract.ts:997`

**C4.1 KNOWN — true at the registration layer.**
- Anchor rule (`extract.ts:997`): `origin !== 'DERIVED' && confidence > 0 && (anchorable?.(segment) ?? true)`.
- `CHAIN_CORRECTED` confidence is greater than 0 by construction (`chains.ts:764-766`).
- The value was chosen *because* it fits `cmPerPixel` (`chains.ts:681-697`), so its residual against the fitted scale is near zero by construction.
- `registerFrame` adds +0.08 confidence per anchor, up to 5 (`registration.ts:170`).
- `choosePlan` scores `confidence × 2 + 0.1 × anchors.length − 4 × rmsM` (`solve.ts:141`), and that score chooses between copies.
- `anchorable` narrows the anchors only when `scaleStands && reread` (`extract.ts:478-481`). Even then it admits legacy `CHAIN_CORRECTED` segments, and under `REPLACED`/`ADDED` it does not apply at all.
- `CoordinateRegistration` carries neither origin nor solution relation.

**C4.2 KNOWN — false at the metric-solution selection.** Witnesses are as-read only (`metric-solution.ts:503`). The legacy `CHAIN_CORRECTED` count is recorded as telemetry only (`correctedAnchors`, :1461). The *legacy* pooled scale does self-anchor through substitution proposals (C3.3, row 1), and `CONFIRMED` / `LEGACY_UNCONFIRMED` then keep that scale's chains and anchors.

**C4.3 MEASURED — anchor origins.** 117 `PLAN_XZ` registrations, 567 anchors:
- 307 `CHAIN_CORRECTED` + `dependsOnScale`
- 55 `CHAIN_CORRECTED` from the legacy 1.1.0 sets (no derivation)
- 196 `READ`
- 9 `READ` + `dependsOnScale`

27 registrations have **zero** scale-free anchors. Examples:
- murajach `…006f85ed53`: 6 of 6 `CHAIN_CORRECTED`, confidence 0.880, `LEGACY_UNCONFIRMED`/`INCONCLUSIVE`; includes `740`→148 and `248`→148.
- murajach `…2c785f9f52`: 2 of 2, residual exactly 0, `1720`→1530.
- dom-pod-jarzabem `…397808a266`: 9 anchors, 0.858, `CONFIRMED`.
- dom-w-modrzykach `…b3f1538ca6`: 6 anchors, 0.894, `CONFIRMED`.
- glogownikach `CONFIRMED` frame `…a-0cb0a5c1d9`: 9 of 10 `CHAIN_CORRECTED`, 0.849.
- glogownikach site plan `…7493059392` (legacy only): `000`→400 ×4 and `420`→930; 5 of 6 `CHAIN_CORRECTED`.

**Test to register:** for each `PLAN_XZ` registration, count anchors whose evidence has `origin === 'CHAIN_CORRECTED'` or `derivation.dependsOnScale`. Assert that confidence and `choosePlan` rank are unchanged when those anchors are removed (both are expected to fail today). There is no existing test (`chains.test.ts:102` covers only `DERIVED`).

## 5. Leading zeros, ambiguity classes and the stability bracket

**C5.1 KNOWN — lattice classes.** `ocrClassOf` (`numeric-lattice.ts:155-162`) with bounds `OCR_CLASS_BOUNDS` (:93: `lowScore` 0.2, `legibleCapPx` 10, `clearP` 0.6, `supportedP` 0.35, margins 0.5):
- `LOW_QUALITY` (min glyph score < 0.2 or cap < 10 px)
- else `AMBIGUOUS` if unstable
- else `CLEAR` if p ≥ 0.6 and margin ≥ 0.5
- else `SUPPORTED` if p ≥ 0.35 and margin ≥ 0.5
- else `AMBIGUOUS`.

Demotions (:1171-1199) turn a `CLEAR`/`SUPPORTED` reading into `AMBIGUOUS` when it has a leading zero, `rivalP` ≥ 0.1 (`countRivalP`), the width is ambiguous, the count came only from the style, or the variants disagree on the count. Another digit count present, or a count chosen by the style, caps it at `SUPPORTED`.

**C5.2 KNOWN — stability bracket.** `STABILITY_BRACKET = [0.9, 1.1]` (`numeric-lattice.ts:152`). The `STRICT` and `SAUVOLA` mask thresholds are rescaled and the anchors re-read (`:1068-1079`). The reading is stable when every bracket read states the same `dimensionValueOf`.

The external bracket is separate: `EXTERNAL_VARIANTS` `BASE`, `PAD2`, `TRIM1`, `SCALE90` (`recogniser.ts:~31`). It is re-checked from the records at `ensemble.ts:100`.

**C5.3 KNOWN — where the leading-zero rule applies.**
- `dimensionValueOf` rejects `^0\d` (`numeric-lattice.ts:879-883`).
- `pickAsRead` prefers anchors without one (`:1302-1307`).
- An observation still takes a leading-zero value (`leadingZeroValue`, `metric-solution.ts:455-460`) but is never decisive (:572).

**Gap:** `ensembleOf` `AGREES` does not apply the rule. `ensemble.ts:132-133` promotes it to `CLEAR`.
- **MEASURED:** 26 leading-zero `AGREES` readings (lattice `AMBIGUOUS` → `CLEAR`). Examples: marcowki and dom-pod-jarzabem `ROTATED_CCW` `001`; dom-w-azaliach `INVERTED` `08`; dom-w-modrzewnicy `0001`. These are wrong-rotation inks on which both readers agree.

## 6. Places where correlated observations can count as independent

| # | Correlation | Where | Status |
|---|---|---|---|
| X1 | Scale-fitted substitution anchors the scale it was fitted to | `extract.ts:997`, `registration.ts:170`, `solve.ts:141` | KNOWN + MEASURED (C4) |
| X2 | Legacy scale vote counts its own substitutions as votes | `chains.ts:259-291`, `:567-584`; carried forward by `CONFIRMED` / `LEGACY_UNCONFIRMED` (`extract.ts:464`, `:478-481`) | KNOWN |
| X3 | Two readers on one crop: `AGREES` called "two independent readers" and promoted to `CLEAR` regardless of lattice class or leading zero | `ensemble.ts:18-19`, `:132-133`; `decisive` uses the `readingOf` class (`metric-solution.ts:572`) | KNOWN; MEASURED 30 `AGREES` from `LOW_QUALITY`, 26 with a leading zero |
| X4 | Two raster copies of one drawing (glogownikach `…b0502a47aa` / `…a-0cb0a5c1d9`: identical token boxes, both registrations ≈ 0.02626): `CROSS_COPY` corroboration needs only extents within 5 % | `plan-resolution.ts:456`, `:597-601`; also the copy ranking in `choosePlan` (`solve.ts:141`) | KNOWN; copies MEASURED (lattice cache 245/245 `MISS`, so no byte-sharing; the correlation is in the source) |
| X5 | Same ink's two rotations as two labels when regions fail | `metric-solution.ts:152-189`, `:1260-1279`; `axis-topology.ts:351-354` | HYPOTHESIS (guarded in the normal case, C2.5) |
| X6 | Readings fitted to `joinedCm` (`ORIENTATION_BY_SCALE`) and `UNDECIDED`-orientation segments have no `derivation`, so plan resolution counts them as printed and they anchor the registration | `metric-solution.ts:893`, `:1473`; `extract.ts:964`; `plan-resolution.ts:228` | KNOWN |
| X7 | `bothAxes` isotropy counts `READ` + `dependsOnScale` (Y orientation chosen by the X scale), so an isotropy corroboration comes from the scale itself | `plan-resolution.ts:624` (`zeroSubstitution`, not `asRead`) | KNOWN; MEASURED 9 such anchors (glogownikach `…p-d1223ce8ba`) |
| X8 | Statement contest joins only the token's own orientation, so the other rotation's confident reading is invisible to the contest | `statement-contest.ts:52`, `:84` | KNOWN |
| X9 | Horizontal and vertical orientation chosen *because* the readings agree on one scale (self-consistency), and those same readings then count as `INDEPENDENT` witnesses of that scale | `metric-solution.ts:772-779`, `:791-794`, `:642-645` | HYPOTHESIS (selection effect) |
| X10 | Twin parallel chains de-duplicated for witnesses but not for anchors | `metric-solution.ts:911-920` vs `extract.ts:997` | KNOWN |

## Files

- Production code read: `/home/user/BuildApp/packages/source-metrics/src/{ocr,numeric-lattice,ensemble,recogniser,parse,extract,metric-solution,chains,axis-topology,registration}.ts` and `/home/user/BuildApp/packages/reconstruction/src/{plan-resolution,statement-contest,solve}.ts`. Nothing in the repository was edited.
- Two read-only helper scripts are in `/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/`: `glog.py` (traces one ink's evidence, token and lattice) and `anch.py` (counts registration anchors by origin).