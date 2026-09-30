# Council B — Plan / CV / OCR Specialist (005A post-review)

I read `git diff 7cd8e0c..HEAD` and the artifacts. I ran nothing.

## 1. Strongest improvement

Two reading-side alternatives break the two lock-ins that failed e-OZE: the strip extent and the rewritten scale.
- `latticeScales` seeds scales only from long spans' zero-substitution readings: the READ value, or the OCR token's own text under a CHAIN_CORRECTED value (`plan-resolution.ts:148,160,174–200`). **[C]** Corrections made toward the registration cannot vote.
- `wallClusterExtent` gives an extent with no chain in it (`plan-decomposition.ts:1781–1812`). **[C]**
- Neither takes the published figure. **[C]**

Result **[M]** (`resolver/plan-copy-matrix.md`):
- e-OZE resolves at 2.223611 cm/px from the "1601" the solver had rewritten to "1801"; the true scale is 2.2222.
- It lands at 116.7 m² (−4.4 %) in 7 of 9 copy subsets.
- The matrix goes from 16/36 to 28/36 with no completed row changing hash.

Re-read spans become DERIVED (`layout.ts:1082–1083`), and `SCALE_DISAGREEMENT` is now emitted. **[C]**

The render cache is identical by construction. Its key covers every input over one `PROTOTYPES` table (`callouts.ts:480`), there is a single `set` (`:534`), and eviction is deterministic. **[C]**

## 2. Largest remaining genericity risk

**One scale per sheet: a single vote over OCR text whose turn is decided once per page.** The corroborations meant to check that scale reuse its readings.
- **The scale axis sits behind the vote.** Only copies with a registration are weighed (`plan-resolution.ts:474`). Candidates are token texts that survived the unchanged `dedupeOrientations` (`ocr.ts:829–834`) and the vote (`chains.ts:395,580`).
  - The wide-glazing family gets no registration and ends `PLAN_NO_DIMENSION_FRAME`. **[M]**
  - Its message (`plan-diagnostics.ts:86`) does not say which of three refusals fired: no READ chain, the veto with its ≥ 3-number replacement (`chains.ts:580`), or fewer than 2 anchors (`extract.ts:601`). **[C]**
- **The corroborations are not independent.**
  - ISOTROPY re-tests the same statements at max(3 %, wallPx/2 px) (`:476,487–488`). **[C]**
  - CROSS_COPY compares with the siblings at their *registered* scales (`:466–470`), so a LATTICE reading can never earn it when the siblings share the misregistration. **[C]**
  - On e-OZE the correct reading has WALL_COVERAGE only. The 400 px copy at its registered 1.5252 cm/px (about 4.75 implied) reads 12.0 m², −90.2 %, with WALL_COVERAGE and ISOTROPY (`rarytasy-eoze-all/analysis-trace.json`, reading 4). **[M]**
- **No gate catches it.** Without a footprint, `acceptable` takes UNKNOWN plus 2 (`:403–404`): the wrong reading qualifies and the right one does not. **[C/I]** Stage 2 was not run on it.
  - No gate replays a real sheet without its footprint.
  - Image transforms are not gated.
  - The families are drawn at 38 px/m only.

**Lazy thin segments differ above 2200 px.** `get thin()` re-maps on every read (`prepare.ts:157`), and `scaleSegment` makes new objects when k ≠ 1 (`:60`). `plan.ts:222` reads it twice, while `stair.ts:277–278,409,417` excludes treads by identity. **[C]** On downscaled sheets the treads re-enter as stringer and arrow candidates. **[I]** Every development sheet is 853 px or smaller.

## 3. Possible hidden overfit

- **Generated from the drawing, selected by the answer.**
  - A mouth shuts only where both side walls reach it within the existing 8 m cap (`plan-decomposition.ts:1170`), or where a flood proves a pocket (`:1417`). **[C]**
  - The selector is the footprint: AGREES needs no corroboration (`plan-resolution.ts:395–402`), and the plan "does not say which" (`plan-decomposition.ts:275–279`).
  - Shutting is all-or-nothing, so a house with both a garage door and a loggia fits neither reading. A pocket with two mouths never shuts (`:1392–1426`). **[C]** Its measured effect is zero. **[M]**
- **The vacuous guard.** On the DIMENSIONED 853 px copy `registrationWeight` is 0 (`:179,189`), so the generator also emitted a junk 0.4188 cm/px from "080" over 191 px. That matches the 14 decompositions. **[M/I]**
- **Constants.**
  - The 0.15 cut (`:176`) is not a knife edge: 0.05 and 0.3 give the same winner. **[I]**
  - The new tolerance, `wallPx/2` (about 7.5 px against the solver's 2.2), lets `metricsAtScale` re-read a 42 px span within ±18 % (`:233`), blunting `refutedShare`. **[C]**
- **The lattice fixture is e-OZE transcribed.** `misreadSheet` (`plan-resolution.test.ts:248–267`) carries 720 px, "1601" rewritten to "1801", the alternatives [1601, 1001], 2.5 cm/px and a 720×340 extent. The purity guard registers only names, ids and published figures.
- **Family selection.** `shape-families.ts:6–8` claims the narrow wing reproduces Council G's −14.4 % failure. Yet the row passes on the unchanged first reading (`resolved: null`) and is pinned CORRECT_TODAY. The failing 4.0–4.4 m wing variants (`shape-families/README.md:38`) have no row.
- **How to detect it.**
  - Sweep wing width 2.0–4.8 m against 30–45 px/m.
  - Add G's Holloway variant verbatim.
  - Add a second lattice fixture with another length and another misread digit.

## 4. One next research item

**Replay the 36-subset matrix and the 10 families with the footprint withheld.** For each reading, log which corroborations fire and whether the withheld figure calls the reading right.

This comes first: the footprint is today the only arbiter, and §2 shows the UNKNOWN + 2 route prefers the wrong scale. The replay is cheap (sealed evidence, seconds).

It gates two changes:
- ISOTROPY only from READ overall chains per axis, after the page turn vote becomes per-token alternatives.
- CROSS_COPY against the siblings' own lattice hypotheses.

**Verdict on the implementation decision**
Mostly kept: OCR and chain decisions untouched, cache identical, extent and scale axes per §5, generated from the drawing.
Departures: `mouths` beyond §5 (disclosed, no effect); §7's EXACT_READING missing (`plan-resolution.ts:63`); thin segments identical only up to 2200 px.
