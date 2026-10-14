# 005Q-CHAIN causal map: `chains.ts` / `extract.ts` (base cd0c513)

**Verdict on the key suspicion: confirmed.** `extract.ts:997` lets a `CHAIN_CORRECTED` segment become a `CHAIN_SEGMENT` registration anchor. That segment's value was chosen because it fits the frame scale (`chains.ts:672-673`, `:758`). The anchor is then fitted back to the same scale. The schema contract forbids this (`schema.ts:297-300`, "a value a scale chose may never be a witness for that scale"). So does the evidence's own `derivation.why` (`extract.ts:974`). The same pattern exists a second time in the level-datum ladder (`extract.ts:757-771`). In the sealed evidence, 50 of 86 registrations would have fewer than 2 anchors without the corrected ones. 70 of 151 fitted axes rest only on corrected anchors.

Tags: **KNOWN** = read in code. **MEASURED** = read in sealed evidence JSON. **HYPOTHESIS** = not yet proven.

## 1. Where `segment.origin` is set; what "substitutions" are; who picks them

- **C1 (KNOWN)** — `UNRESOLVED` is the default for every segment (`chains.ts:742`). A segment stays `UNRESOLVED` when its span has a token but no reading within tolerance. The span then scores `merit:-0.5` (`chains.ts:696`), and `:780` skips it for derivation.
- **C2 (KNOWN)** — `READ` vs `CHAIN_CORRECTED` is decided only at `chains.ts:758`: `segment.origin = span.reading.substitutions === 0 ? 'READ' : 'CHAIN_CORRECTED'`. The label ink plays no other part in that decision.
- **C3 (KNOWN)** — `DERIVED` is set at `chains.ts:778-785`. A blank span gets `valueCm = cmPerPixel * pixelLength` with `confidence 0.4`. This only happens when `fitted > 0 && residualPx <= tol/2`.
  - `fitted` counts `CHAIN_CORRECTED` segments too (`:768`). So a chain whose only "confirming" reading is scale-chosen can still fill its blanks from that same scale. This is a second self-witness.
- **C4 (KNOWN)** — The scale picks the value inside `spanOf` (`chains.ts:669-697`):
  - For each reading, `missPx = |valueCm/cmPerPixel - pixelLength|`. A reading is dropped if `missPx > tolerance` (2.2 px) (`:672-673`).
  - `merit = confidence * max(0.02, 1 - missPx/tol)` (`:681`).
  - The span is worth `(1+merit) * 0.7^skippedTicks * 0.45^substitutions` (`:695`).
  - A dynamic programme picks the best partition (`:709-730`).
  - Consequence: if the as-read value misses by more than 2.2 px, it is not even a candidate. Any substitution that lands inside tolerance (span worth ≈0.45–0.9) beats leaving the span unresolved (-0.5).
  - `cmPerPixel` comes from `options.fixedScale`. That is an input scale, not something the chain measures (`:630`).
- **C5 (KNOWN)** — "substitutions" means glyph runner-up replacements, not arbitrary digit edits. There are two sources:
  - **Legacy path** (every frame's `solveFrameChains`, and every chain the metric solver does not re-read). Readings come from `assignLabels` without `readingsOf`, i.e. `readingLattice(token)` (`axis-topology.ts:356-363`, `parse.ts:130-178`).
    - Single substitutions on any glyph with any runner-up. There is no glyph-ratio floor.
    - Pairs on the two least-confident glyphs, at confidence ×0.9.
    - Up to 24 strings; `substitutions` is 0, 1 or 2; confidence = `alt.score/glyph.score`.
    - There is no minimum span length: `minCorrectionPx` is not passed (`chains.ts:587`).
  - **Lattice path** (plan frames whose chain is re-read in `solveFrameMetric`). Readings come from `correctionReadings(lattice)` (`metric-solution.ts:404-441`, wired at `:1285-1289`):
    - the lattice or ensemble as-read value, with `substitutions` 0;
    - the ensemble rival, at confidence 1 and `substitutions` 1;
    - other lattice sequences with the same digit count and `pRatio>=0.5` or a one-glyph ratio `>=0.7`;
    - external-only values.
    - Corrections are gated by `minCorrectionPx = 25*tol = 55 px` (`metric-solution.ts:1309`, `chains.ts:676`).
- **C6 (KNOWN)** — The legacy scale vote itself counts substitution readings. `proposalsOf` (`chains.ts:264-283`) emits one proposal per reading, including `substitutions > 0`, with weight `reading.confidence*token.confidence*px/50`. That weight has no substitution penalty. So the legacy scale `L` can itself be built from corrected readings (circular).
  - The metric solver's own witnesses do exclude substitutions (`metric-solution.ts:503`; header `:28-40`).

## 2. From solved segment to `MetricEvidence` (`extract.ts:929-979`)

- **C7 (KNOWN)** — Evidence is emitted only when `valueCm !== undefined && origin !== 'UNRESOLVED'` (`:929`). Field by field:

| Field | Source | Line |
|---|---|---|
| `value` | `segment.valueCm` (the chain's choice) | `:945` |
| `origin` | `segment.origin` | `:947` |
| `rawText` | `segment.token?.text`, i.e. the **classic `TextToken` text** | `:949` |
| `alternatives` | `segment.rejected.slice(0,4)`, confidence fixed at 0.2 | `:957` |
| `confidence` | `segment.confidence` = token × reading × 0.85^subs × fit | `chains.ts:764-766` |
| `provenance.detail` | for CHAIN_CORRECTED: `the reader read "<token.text>"; at the frame's scale "<text>" fits the span` | `:962` |
| `derivation` | only if CHAIN_CORRECTED or `orientation.dependsOnScale`; `{rawText: token.text, valueText, substitutions, dependsOnScale: true}` | `:964-978` |
| `association` | `WITNESS_LINE_PAIR`, score from `residualPx` | `:931-938` |

  - `derivation.substitutions` is a fresh character diff against the classic token text (`:970`). It is not the reading's own `substitutions`.
- **C8 (KNOWN)** — The "1020 read, 1010 chosen" case is recoverable from the evidence. `rawText='1020'`, `derivation.rawText='1020'`, `provenance.detail` contains "1020", and `alternatives` holds `{rawText:'1020', value:1020}`. On the legacy path the base reading always sorts first (`parse.ts:177`), so it always survives `slice(0,4)`. `ocrTokenIds` leads to the `OcrToken` with the text and glyph alternatives.
  - Downstream already does this: `plan-resolution.ts:203-205` rebuilds `firstReadCm` from the `OcrToken` text.
- **C9 (KNOWN)** — What is **not** on `MetricEvidence` is the lattice or ensemble reading. `rawText` and `derivation.rawText` are always the classic token text.
  - The lattice/ensemble reading exists only on `numericLattices[]` (`rawTopText`, `asRead`, `ensemble`, `external`) and on `DimensionObservation.rawText`.
  - There is no id link. The only joins are on `box`+`orientation` (lattice id at `extract.ts:429`) or `chainId`+`fromPx`/`toPx`.
  - On the lattice path, `rejected` keeps the order of `lattice.sequences`, and external-only values come last (`metric-solution.ts:436-439`). So an ensemble reading can be cut by `slice(0,4)`. **HYPOTHESIS:** this depends on the order of the sequences.
- **C10 (KNOWN)** — An inconsistency: when the external recogniser LEADS, the ensemble reading has `substitutions:0` (`metric-solution.ts:391-394, 421-424`). The segment is then `READ` with a value that differs from `rawText` (the classic text), and no `derivation` is written. A consumer comparing `rawText` with `value` would take a READ for a correction.

## 3. Registration anchor path

- **C11 (KNOWN)** — The anchor is pushed at `extract.ts:997-1007` when `segment.origin !== 'DERIVED' && segment.confidence > 0 && (anchorable?.(segment) ?? true)`. It carries `metricSpan = valueCm/100`, `weight = segment.confidence` and **no origin**. Nothing checks for `CHAIN_CORRECTED` or `derivation.dependsOnScale`.
- **C12 (KNOWN)** — `anchorable` is built at `extract.ts:478-481` and passed in at `:482`:
  - **`scaleStands && reread.has(index)`** (CONFIRMED frame, chain re-read): a segment anchors only if it equals a legacy segment on `fromPx`, `toPx`, `origin`, `valueCm` and `confidence`. A legacy `CHAIN_CORRECTED` segment passes. A re-read correction that differs from legacy does not.
  - **All other cases → `undefined` → `?? true`**, so every READ and CHAIN_CORRECTED segment anchors. That covers:
    - non-plan frames;
    - plans without `read.raw`;
    - CONFIRMED chains that were not re-read;
    - LEGACY_UNCONFIRMED (`rereadable=false`, `metric-solution.ts:1231`);
    - REPLACED/ADDED. Here `scaleStands=false` (`extract.ts:464`), so `reread` contains every chain (`:465`), but `anchorable` is still `undefined` because it requires `scaleStands`.
- **C13 (KNOWN)** — Same scale in, same scale out. Each chain is solved at `fixedScale = scaleX/scaleY ?? pooled`:
  - `chains.ts:587` (legacy);
  - `metric-solution.ts:1304,1310` (re-read: `axisScale` = the replaced scale, or the legacy scale when CONFIRMED).
  - A correction is accepted only if it misses that scale by at most 2.2 px.
  - `registerFrame` keeps inliers at 3 px (`registration.ts:128`, `:87`). So every correction is an inlier of the scale it was corrected toward, by construction.
  - The corrections also raise `registration.confidence`: +0.08 per anchor, up to 5 anchors (`registration.ts:172`).
- **C14 (KNOWN)** — The ladder repeats the pattern. `solveLevelLadder` fits its line from readings that include substitutions (readings at `extract.ts:698-702`; ranking ×0.7^subs at `registration.ts:310`). The datum becomes `CHAIN_CORRECTED` at `registration.ts:394`. Anchors are pushed at `extract.ts:757-771` with no origin filter, measured from the zero row that the same fit produced. LEVEL_DATUM evidence never gets a `derivation` (`:709-737`).
- **C15 (KNOWN)** — `fittedCount` (`extract.ts:922, 996`) counts non-DERIVED segments with `confidence>0`, i.e. READ plus CHAIN_CORRECTED, ignoring `anchorable`. It is used only for the chain `note` (`:1032`).
  - `solved.readSegments` (`chains.ts:768`) also counts CHAIN_CORRECTED. It feeds `DimensionChain.scale.readSegments` and `closes` (`extract.ts:1014, 1025`).
  - `metric-solution.ts:1077, 1461` only *records* `legacy.correctedAnchors` / `readAnchors`; nothing gates on them.
- **C16 (MEASURED, committed sealed sets)** — For every one of the 17 committed `metric-evidence.json` files, anchor `evidenceIds` cite `origin:'CHAIN_CORRECTED'` evidence.
  - Over 15 distinct sets (two duplicates excluded): 50 of 86 registrations would have fewer than 2 non-corrected anchors, which is `registerFrame`'s minimum (`extract.ts:793`).
  - 70 of 151 fitted axes rest only on CHAIN_CORRECTED anchors.
  - Example (005f `h2-dom-w-helikoniach`, schema 1.5.0, frame `…bc02f8e306`, LEGACY_UNCONFIRMED): all 3 anchors are CHAIN_CORRECTED (`'/71'→171`, `'115/'→1153`, …); X 0.044173 m/px, Y 0.044748 m/px.
  - Caveat: these sets come from code versions 1.1.0–1.5.0. The mechanism at `:997` is the same; whether the exact counts reproduce at cd0c513 is a **HYPOTHESIS**.
- **C17 (MEASURED, but provenance not verified)** — `/tmp/tmp.v04RvVPwot/metric-evidence.json` (schema 1.8.0, i.e. current generation, dated 2026-10-12, not in the repo), frame `…397808a266`:
  - `relation` CONFIRMED / STRONG; `legacy.readAnchors=0`, `correctedAnchors=9`; `reread 0`.
  - All 9 registration anchors are CHAIN_CORRECTED: `'1460'→1950` (the lattice read 1960, `ocr.selected AS_READ 1960`, marked REJECTED), `'1/60'→1500` (2 subs, 538 px), `'712'→315` (2 subs, 113 px), `'21'→71` (25 px, which only the legacy path allows), `'401'→901`, `'588'→288`, `'350'→250`, `'050'→450`, `'137'→133`.
  - Registration X = 0.02788 m/px, matching legacy L = 2.787455 cm/px.

## 4. `DimensionObservation`, chain sums, relations

- **C18 (KNOWN)** — `extract.ts` creates no `DimensionObservation`. It only appends `metric.observations` (`:467`), and only for plan frames with `read.raw`.
  - Records are built in `metric-solution.ts:observationsOf`. `valueCm`/`rawText` = `readingOf(lattice)` (the ensemble reading when the external recogniser LEADS, otherwise the lattice as-read); without a lattice, the classic reading with `substitutions===0` (`:500-503`). It is never the chain's value.
  - The scale's choice is recorded separately in `ocr.selected` (AS_READ / SCALE_RANKED / STRUCTURAL / UNRESOLVED; `:1343-1373`), and only for PRIMARY bindings in the decided orientation.
  - `status:'ACCEPTED'` requires a matching **READ** segment (`acceptedKeys`, `:1338-1339`). A CHAIN_CORRECTED span's observation is RAW or REJECTED.
- **C19 (KNOWN)** — Chain sums:
  - `derivedTotalCm` = sum over all segments (READ + CHAIN_CORRECTED + DERIVED) when every segment has a value (`chains.ts:789-795`).
  - `closes` = `derivedTotalCm defined && readSegments>0 && residualPx<=1.2` (`extract.ts:1014`). A chain made entirely of scale-fitted and scale-derived segments "closes" trivially. This is circular.
- **C20 (KNOWN)** — `chainRelations` written to the set come from `dimensionHierarchy` (`metric-solution.ts:1604-1680`; pushed at `extract.ts:468`).
  - AGREES_AS_READ / CONFLICT_AS_READ use as-read PRIMARY observations only, so they are scale-free (`:1085`).
  - The fallback uses solved values (READ, CHAIN_CORRECTED and DERIVED). It reports `AGREES_AFTER_CORRECTION`, and its `sum` then holds the scale-chosen values (`:1619-1623, 1657-1660`).
  - The older `chainRelations()` (`:1513`) is not called from `src`.

## 5. What is sealed, and whether both rotations are kept

- **C21 (KNOWN)** — `ocrTokens` are sealed from `read.raw ?? read.tokens` with `pageVote` KEPT/DISCARDED (`extract.ts:372-376`). For plans (`hypotheses: isPlan`, `:369`), `raw` holds all four orientations, CW, CCW and INVERTED included (`ocr.ts:1062-1064`). Non-plan frames seal only `dedupeOrientations(tokens)`, which drops the losing rotation.
- **C22 (KNOWN)** — `numericLattices` cover every `read.raw` token with 2–6 glyphs that lies on any line in `allChains` (`extract.ts:1149`). Every orientation whose axis matches the chain is included, so both rotations, each with its own id (box + orientation, `:429`). They are sealed at `:458`, including `external` and `ensemble` (`:1206-1207`).
- **C23 (KNOWN)** — `dimensionTopology` (`extract.ts:499-515`) is plan-only and records both the legacy and the final assignment and side conventions.
  - The legacy solve reads `read.tokens` (deduped, no INVERTED) (`:390`).
  - The final assignment reads `corrected` tokens, which can swap in the other orientation (`metric-solution.ts:1259-1281`).

## 6. Order of operations in one frame, and where scale is an input

`readNumbers` (`:369`) → seal OcrTokens (`:372`) → ink mask and lines → `dimensionChainsOf` (`:386`; label ink uses raw tokens) → plan plausibility (`:388`) → **legacy `solveFrameChains`** (`:390`): assignment → vote → `decideScale` → `solveChain` at fixed scale → [plan only] lattices (`:424`) → recogniser batch (`yield` at `:447`) → ensemble (`:454`) → seal lattices (`:458`) → **`solveFrameMetric`** (`:459`), which takes the legacy solution as incumbent → `buildChain` builds evidence and anchors (`:471-484`) → datums, angles, callouts, rings → ladder (`:688`) and its anchors (`:749-773`) → `registerFrame` (`:793-808`).

- **C24 (KNOWN)** — Lattices and the recogniser run before the metric solution and do not depend on scale (comments at `:421-436`). The legacy chain solve runs **before** both and never sees them.
- **C25 (KNOWN)** — Every place a scale is an input to choosing a value:
  1. `chains.ts:672-683` / `:758` — span reading chosen at `fixedScale`; this is where CHAIN_CORRECTED comes from.
  2. `chains.ts:782` — DERIVED value = scale × px.
  3. `chains.ts:264`, `:433-451` — the vote's scale is built from substitution readings (C6).
  4. `chains.ts:532-536` — `decideScale` plausibility picks among scales.
  5. `metric-solution.ts:1304-1310` — re-read at `axisScale`.
  6. `metric-solution.ts:1343-1373` — `selectedValueOf` SCALE_RANKED.
  7. `metric-solution.ts:1385-1387` — observation ACCEPTED/REJECTED via `finalScale`.
  8. `registration.ts:302-312, 394` — ladder picks datum readings at its own fitted line.
  9. Feeding back: `extract.ts:997` and `:762` turn those choices into anchors for the same scale.
- **C26 (KNOWN, outside this scope; leads for the reconstruction auditor)** — Downstream treats CHAIN_CORRECTED as printed or trustworthy in at least `plan-resolution.ts:202`, `reconstruct.ts:333` (HARD constraint when `confidence>=0.45`), `plan-decomposition.ts:478, 806, 820`, `layout-gate.ts:84`, `plan-extent.ts:193` and `solve.ts:191`.

## Counterfactual seams (one change each) and how to test them

1. **`extract.ts:997`** — add `&& segment.origin === 'READ'` (equivalently `&& !(derivation?.dependsOnScale)`). This stops CHAIN_CORRECTED values from becoming anchors.
   - Expected effect from C16: many frames fall below 2 anchors and fall through to the AMBIGUOUS/MISSING gap at `:809-821`.
   - Test: a synthetic plan with one horizontal chain whose only label misreads to a value that fits only through a substitution, plus one READ label. Assert there is no `CHAIN_SEGMENT` anchor citing the corrected evidence id, and that registration is absent or comes from READ only.
   - Replay check: for each registration, every `anchors[].evidenceIds` maps to `origin === 'READ'`.
2. **`extract.ts:759`** — skip `solved.origin === 'CHAIN_CORRECTED'` in the ladder. This also needs the zero row refitted from READ rungs only, because `zeroRowPx` comes from the same fit.
3. **`chains.ts:768`** — increment `fitted` only when `span.reading.substitutions === 0`. This stops corrected spans from enabling DERIVED (`:778`), `readSegments` and `closes` (`extract.ts:1014`).
4. **`chains.ts:264`** — skip `reading.substitutions > 0` in `proposalsOf` (vote only). This breaks the loop where a scale built from corrections then picks corrections (C6). It changes L for all frames, so the full house matrix must be checked before and after.
5. **`chains.ts:587`** — pass `minCorrectionPx` (55 px) on the legacy path too. This removes short-span corrections such as `'21'→71` at 25 px.
6. **Traceability, no behaviour change** — at `extract.ts:964-978`, add the lattice id and the lattice/ensemble as-read reading to `derivation`, and emit `derivation` for READ whenever ensemble text ≠ `token.text` (C10). This lets consumers recover the ink reading without joining on box.

Only `ScaleAnchorInput` and `RegistrationAnchor` lose the origin (`registration.ts:36-45`; `schema.ts:797-812`). Every other seam can be checked against existing fields (`origin`, `derivation.dependsOnScale`).

Analysis scripts (read-only):
- /tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/cc_anchors.py
- /tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/cf.py
- /tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/drop.py
- /tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/frame.py

Files audited: /home/user/BuildApp/packages/source-metrics/src/chains.ts, extract.ts, schema.ts, registration.ts, metric-solution.ts, axis-topology.ts, parse.ts, ocr.ts.