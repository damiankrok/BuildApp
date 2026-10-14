The suspicion is confirmed: the S4 scale actually used by the model is fitted only from scale-chosen values. All 6 registration anchors are `CHAIN_CORRECTED`, 0 are `READ`. The first wrong step is not `extract.ts:997`. It is the legacy chain solver's choice of reading inside one span (`chains.ts:681-682`), which chose 1382 at the legacy scale. A gate in the metric solver (`metric-solution.ts:1303`) then stopped the correct ink readings from replacing it.

Tags: **KNOWN** = read in code at HEAD 754d8f3. `packages/` is identical to cd0c513 (`git diff --stat cd0c513 HEAD -- packages` is empty). **MEASURED** = read in sealed JSON. **HYP** = inferred, or recomputed by me in Python and not yet run through production.

The sealed evidence is `/home/user/work005i-a/blind8/h1-dom-w-gozdzikowcach/metric-evidence.json`. It was written Oct 6 13:42; the last `source-metrics/src` commit (c0ad2e8) was Oct 6 11:59. Extractor versions match current code (chain-solver 1.4.0, independent-scale 1.4.0, ensemble 1.2.0). So the sealed file reflects current code (HYP, strong).

## 1. Causal chain for label 1385 (S4, box x355-381, y730-742)

**Step 1 – OCR token (MEASURED).** `ocr-1385-3bc2c5f6cd`, text "1385", pageVote KEPT, conf 0.512785. Last glyph '5' has score 0.534809, with alternatives '3' 0.430154, '7' 0.361993, '2' 0.337544.

**Step 2 – lattice and ensemble (MEASURED).**
- `ocr-lattice-1385-15e11365e1`: lattice as-read 1385, AMBIGUOUS.
- External PP-OCRv6 reads 1385 at p 0.999924, stable across 4 variants; ensemble decision AGREES, class CLEAR.
- 1382 is not among the lattice values (1185, 1585, 1785, 1285, 1381, 1183, 1181).

**Step 3 – assignment (MEASURED, `dimensionTopology`).** Both the legacy and the final assignment bind it to `chain-horizontal-747-fcc98a90c7`, interval 0, margin 5.15. This chain has 2 ticks, 96 and 641, so one 545 px span.

**Step 4 – legacy frame solve (KNOWN).**
- `extract.ts:390` calls `solveFrameChains(measured, read.tokens, …)`. It uses classic tokens only, with no lattice or ensemble.
- Readings come from `readingLattice(token)` at `axis-topology.ts:359`. The base text gets conf 1 and 0 substitutions; single substitutions get conf = alternative score ÷ glyph score; pairs are tried only on the two least-decided glyphs.
- The scale vote (`chains.ts:264-281`, `:579`) turns every reading, substitutions included, into a proposal. Pooled scale L = 2.530475; X axis refined at `:582` to 2.533553.
- `:587` solves each chain at `fixedScale` = 2.533553.

**Step 5 – the replacement (KNOWN code; my replay of the sealed glyphs reproduces it exactly).**
- `chains.ts:681-682` picks the best reading inside a span by `merit = confidence × max(0.02, 1 − missPx/2.2)`. This merit has **no substitution penalty**.
- The 0.45^substitutions penalty at `:695` only prices spans when choosing how to partition the chain. A single-span chain has no alternative partition, so the penalty never acts.
- At 2.533553 cm/px:

| Reading | Substitutions | Miss | Merit |
|---|---|---|---|
| 1382 | 1 | 0.479 px | **0.4937** (chosen) |
| 1383 | 1 | 0.874 px | 0.4849 |
| 1385 (as printed) | 0 | 1.663 px | 0.244 |

- 1385 fits within the 2.2 px tolerance but loses on merit. The margin between 1382 and 1383 is only 0.009.
- `:758` sets origin to `CHAIN_CORRECTED`.
- Sealed segment: value 1382, residualCm +1.2136, conf 0.245148. Its rejected list contains 1385 with "a weaker reading of the same characters".

**Answer:** 1385 → 1382 happens at `chains.ts:681-682`, chosen at the legacy X scale 2.533553. That scale comes from a vote that already includes substituted readings (`chains.ts:264-281`), so it is self-referential before registration is ever reached.

**Step 6 – the metric solution keeps the legacy chains (KNOWN + MEASURED).**
- The independent hypothesis `scale-2-541746-639a5361fb` is supported by 4 independent as-read observations: 524/205, 1385/545, 544/215, 317/123 (`dim-obs-114-…580e1e09f3`, `dim-obs-1385-…7515dd3321`, `dim-obs-50-…8c5847e0e8`, `dim-obs-717-…4507e2b444`). For three of them PP-OCR overrides the lattice (LEADS); only 1385 is read the same by both readers.
- `metric-solution.ts:1210-1211` declares CONFIRMED because |ln(2.541746/2.530475)| = 0.0044 ≤ `agreeTol` = max(0.012, 2.2/545) = 0.012 (`:1043`).
  - The 1.2% floor is 3× the 0.40% precision of the 545 px span.
  - The witness's 0.44% offset is larger than its own precision, yet the legacy value is kept byte for byte (`:1394`).
- `:1303`: under CONFIRMED, a chain's offer is `null` when `sameEntries(mine, legacy.tokensPerChain[c])`. `sameEntries` (`:741`) compares only token text, orientation and box, never the readings.
  - All 7 S4 labels have identical legacy and final bindings, so no lattice/ensemble re-read was ever attempted. MEASURED: `rereadChainIds: []`.
  - `solved = legacy.solved` (`:1322`).
- Recorded results: `cmPerPixelX` 2.533553, `cmPerPixelY` 2.530475, SUPPORTED, CONFIRMED, isotropy ASSUMED (no independent Y witness), `legacy.correctedAnchors` 6, `readAnchors` 0.

**Step 7 – evidence record (KNOWN `extract.ts:906-1004`; MEASURED).** `metric-dimension-b7348abd92` carries value 1382, rawText "1385", origin `CHAIN_CORRECTED`. Its `derivation.why` reads "…never a witness for it" (`:974`).

**Step 8 – registration anchor (KNOWN).**
- The comment at `extract.ts:992` says "Only a segment whose number was actually READ anchors a registration".
- The condition at `:997` is `origin !== 'DERIVED' && confidence > 0 && (anchorable?.(segment) ?? true)`, so `CHAIN_CORRECTED` passes.
- `anchorable` is undefined because `reread` is empty (`:478-481`). `registerFrame` (`registration.ts:127`, `fitAxis` `:74-124`) never looks at origin.
- MEASURED: `anchor-chain-segment-b7348abd92` has metricSpan 13.82 m over 545 px.

**Step 9 – registration and downstream use (MEASURED).**
- `registration-plan-xz-24e19c8b30`: 0.025344 m/px on X, 0.025199 m/px on Y, anisotropy 1.005747. My recomputed fit of the sealed anchors gives exactly 2.534406 cm/px on X.
- Confidence 0.846052 = 0.5 + 0.08 × 5 − 0.054. Each corrected anchor adds +0.08 (`registration.ts:170`): this is self-witnessing inside the registration confidence.
- Downstream code reads these registration numbers (`plan-resolution.ts:286,318,1001`; `plan-decomposition.ts:1856`). The PROD3 trace shows `scaleCmPerPx` 2.5344.

## 2. The other S4 corrections (all `CHAIN_CORRECTED` at 2.533553; my replay reproduces each)

| Ink (truth) | Classic token | Sealed value | Substitutions | Span / chain | Why 2.533553 chose it | Evidence id |
|---|---|---|---|---|---|---|
| 317 | 717 | 311 | 2 | 123 px, chain-722 | 311 miss 0.247 px, merit 0.6149; 317 miss 2.121 px, merit 0.0337 | metric-dimension-f4cc45abcc |
| 524 | 114 | 514 | 1 | 205 px, chain-722 | 524 was never generated (needs glyphs 0+1; pairs only try glyphs 0+2); 514 is the only fit, miss 2.123 px | metric-dimension-1518d8bcbf |
| 362 | 162 | 183 | 2 | 72.5 px, chain-273 | 2-substitution 183 (0.6346) beats 1-substitution 182 (0.561); ink 362 needs about 143 px | metric-dimension-5a33cac828 |

- For 362, the binding itself is suspect. 005Q-OCR records the binding as `NO_TRUTH`. The observation `dim-obs-162` spans 326→417.5 px instead.

Y-axis anchors (MEASURED):
- `metric-dimension-3a7bb8f360`: 450 → 950 over 377 px. 950 is the ink truth (ensemble LEADS 950), so this correction happens to be right.
- `metric-dimension-7fd09e06de`: "135" → "055" = 55 cm over 20.5 px, 2 substitutions, ROTATED_CCW. Truth is 243, which cannot fit 20.5 px, so the binding is wrong. A leading-zero value, which the system's own 005B rule treats as unprintable, became an anchor.

The ink for "50" (ensemble 544, span 96→311, 215 px) is bound by the legacy assignment but has no fitting reading, so it sealed as an unresolved segment with no value.

Second plan `frame-asset-rzut-4a030d78f5-4450d384c0` (MEASURED): 4 of 4 anchors are `CHAIN_CORRECTED` with the same values (514, 311, 950, 1382). Same ink, same reader, so cross-copy agreement is not an independent check.

## 3. Answers

**Is the registration scale confirmed by any independent READ witness?**
- The registration (2.5344 X, 2.5199 Y): **no**. It has 0 `READ` anchors; all 6 anchors are values chosen at the scale they then anchor (MEASURED). The suspicion about `extract.ts:997` is CONFIRMED.
- The metric-solution relation CONFIRMED: **partly**. It rests on 4 independent as-read ensemble observations on X only (1 of them two-reader CLEAR, 3 of them PP-OCR overriding the lattice). Those witnesses say 2.541746. The page then uses legacy 2.533553 and registration 2.5344, both because of the 1.2% tolerance floor. Y has no independent witness at all.

**How many READ anchors remain per axis if corrected anchors are excluded?**
- X: 0, Y: 0, on both S4 plan copies. Then `extract.ts:793` (needs at least 2 anchors) produces no registration; the unresolved entry would read "no dimension chain on this sheet yielded a consistent scale", status MISSING.
- `layout.ts:410-415` would substitute a placeholder registration that is "never allowed to state a metre". HYP: the plan reading would then fail earlier than today.
- Ink-first re-read (HYP, my re-implementation of `correctionReadings`): at the legacy scale it would give READ 1385/545, 544/215, 317/123, 524/205 on X and 950/377 on Y. 362 stays unresolved, and 135 is blocked by `minCorrectionPx` = 55 px. That is 4 X + 1 Y READ anchors.
- Caveat (KNOWN): under CONFIRMED plus re-read, `extract.ts:478-481` admits as anchors only segments byte-identical to the legacy ones. Changed segments (1385 instead of 1382, and so on) would anchor **nothing**. A re-read alone would shrink the anchor set rather than replace it.

**Would ink-first (1385) change the scale materially?** No (HYP numbers recomputed from sealed values).
- 1385 vs 1382: +0.217%, which is 3 cm or about 1.18 px; both fit the 2.2 px tolerance.

| Registration X variant | cm/px | Change vs sealed |
|---|---|---|
| A sealed | 2.534406 | — |
| B sealed with 1385 instead of 1382 | 2.539595 | +0.205% (514 anchor still kept, miss 2.61 px < 3) |
| C ink 524 + 317 + 1385 | 2.542328 | +0.313% |
| D ink plus 544/215 | 2.541678 | +0.287% |
| Least squares on 4 ink truths, equal weights | 2.541749 | (equals the selected hypothesis 2.541746) |

- Effect on the model: about 0.2–0.3% on X width (about 3–4 cm over 13.8 m) and +0.2–0.3% footprint (about 0.3–0.4 m² of 132.52). This is far below the 3% gates.
- The "−0.88% vs truth" figure is measured against 005O's trueScale 2.556098, which **equals exactly 524/205**, a single label-to-span ratio (MEASURED, `/home/user/work005o/label-rows.json`). Against the least-squares fit of the four ink truths, the sealed registration is only −0.29% and the metric solution is −0.32%. So −0.88% partly reflects the reference, not the solver (HYP).

**Chain sum effect (MEASURED, HIGH relevance).**
- Ink: 544 + 317 + 524 = **1385**, exactly the overall dimension. The sealed record itself says so: `chainRelations` TOTAL_OF chain-747 → chain-722 is `AGREES_AS_READ`, partsCm 1385 = totalCm 1385, residual 0.
- Sealed corrected values: 311 + 514 = 825 vs ink 841 (−16 cm). With the 1382 total, the unvalued first span would have to be 557 vs ink 544 (+13 cm, 2.4%).
- In pixels the chains differ by 2 px (215 + 123 + 205 = 543 vs 545).
- So the corrections break an arithmetic closure that the as-read values satisfy exactly, and the code records that closure as agreement while sealing the contradicting values.

## 4. PROD3 outcome for dom-w-gozdzikowcach (MEASURED, `/home/user/work005q/runs/PROD3/dom-w-gozdzikowcach/`)

- FAILED: `RECONSTRUCTION_FAILED` / `MODEL_EMISSION_FAILED` at BUILDING_MODEL. Command 135, `placeChimney` `chimney-0`, was refused with "Number must be greater than 0".
- No `model.json`, so no footprint; `unresolved.json` is empty and `plan-diagnostics/` is empty.
- The trace shows plan decomposition PASSED (scale 2.5344, SUPPORTED/CONFIRMED, 4 witnesses). Structural layout DEGRADED (`STOREY_COVERAGE_DISAGREES`). Elevation registration DEGRADED (`VIEW_REGISTRATION_NO_ANCHORS`, no ridge datum). Topology: "no pitched main roof was inferred".
- Likely cause (HYP): `v2/emit.ts:449` sets `top = c.topY ?? (b.mainRoof ? ridgeY − 0.1 : 0)`. With no main roof that gives height 0. This is unrelated to scale, so ink-first would not change this outcome.
- The earlier sealed 005I run failed differently: `PLAN_RESOLUTION_INCONCLUSIVE` (105.47 vs 132.52 m²; best reading 131.29 m², −0.93%).

## 5. Defects found, with how to test each

1. **`chains.ts:681-682` vs `:695`.** Choosing a reading within a span ignores the substitution count, so a value the scale picked beats a READ value that also fits. Test: single-span chain, glyph alternatives as in `ocr-1385-3bc2c5f6cd`, fixedScale 2.533553. Expect 1385 READ; current code gives 1382 `CHAIN_CORRECTED`.
2. **`extract.ts:997`** contradicts its own comment at `:992`. `CHAIN_CORRECTED` and dependsOnScale values become anchors, and `registration.ts:170` raises confidence +0.08 per anchor. Test: S4 sealed replay; assert `readAnchors`/`correctedAnchors` per registration, and that excluding corrected anchors yields no registration.
3. **`metric-solution.ts:1303` with `sameEntries` at `:741`.** The token-only equality blocks the lattice/ensemble re-read under CONFIRMED. Test: same tokens with different readings must produce a non-null offer.
4. **`metric-solution.ts:1043`.** The 0.012 floor in `agreeTol` confirms the legacy scale at a 0.44% offset when the longest witness gives 0.40% precision.
5. **`extract.ts:478-481`.** Under a confirmed scale, re-read chains anchor only legacy-identical segments, so a correct re-read can only remove anchors.
6. **Leading-zero value "055" accepted as a `CHAIN_CORRECTED` anchor** (`metric-dimension-7fd09e06de`).

Files:
- /home/user/BuildApp/packages/source-metrics/src/chains.ts
- /home/user/BuildApp/packages/source-metrics/src/extract.ts
- /home/user/BuildApp/packages/source-metrics/src/metric-solution.ts
- /home/user/BuildApp/packages/source-metrics/src/registration.ts
- /home/user/BuildApp/packages/source-metrics/src/axis-topology.ts
- /home/user/BuildApp/packages/source-metrics/src/parse.ts
- /home/user/BuildApp/packages/reconstruction/src/plan-resolution.ts
- /home/user/BuildApp/packages/reconstruction/src/layout.ts
- /home/user/BuildApp/packages/reconstruction/src/v2/emit.ts
- /home/user/work005i-a/blind8/h1-dom-w-gozdzikowcach/metric-evidence.json
- /home/user/work005i-a/blind8/h1-dom-w-gozdzikowcach/failure.json
- /home/user/work005q/runs/PROD3/dom-w-gozdzikowcach/failure.json
- /home/user/work005q/runs/PROD3/dom-w-gozdzikowcach/analysis-trace.json
- /home/user/work005o/label-rows.json
- /home/user/BuildApp/stage-reports/artifacts/analyzer-005q-ocr/label-chain-score-primary.json
- /home/user/BuildApp/stage-reports/artifacts/analyzer-005q-ocr/false-binding-examples.json