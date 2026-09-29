# Council D — Generalization Red Team (BUILDPLAN-ANALYZER-005A pre-audit)

Repository: `/home/user/BuildApp` @ `7cd8e0c`. Read-only. Evidence tags: **[M]** measured by me on the sealed artifacts in the
scratchpad (commands in the appendix), **[C]** read in code (`path:line`), **[I]** inference, marked as such.
Nothing here proposes a project-specific fix.

---------------------------------------------------------------------------------------------------------------------

## 0. Verdict in six lines

1. The production analyzer is **not** generic yet. It is a single-path, single-winner pipeline whose thresholds and even its
   comments were tuned on one publisher's 853 px DIMENSIONED plan sheets of three houses (Marcówki, Rarytasy 5 G2E,
   Kosaćce 46) plus synthetic sheets that were drawn to its own conventions.
2. **[M] Leave-one-copy-in replay (solver on sealed metric evidence, one ground-plan copy at a time, 4 projects x 4 copies):
   4 of 16 complete.** Every success is the 853 px copy. The 550 px and 400 px copies of the same drawings succeed 0 of 8.
   Rarytasy e-OZE succeeds 0 of 4 (each copy dies at a different stage).
3. **[M] The four copies of one drawing are pure resizes, so `cm/px x pixel-size` must be constant. It is not in any of the
   four projects** (spread 1.15x to 3.5x, e-OZE 610 / 1222 / 2134 / 2134 against a true 1895). The analyzer never compares
   copies, because `readPlans` reads exactly one per storey (`layout.ts:198-246`).
4. **[M] Both OWNER phone failures are reproduced to the digit from the area-table copy alone and traced to two different
   single-hypothesis gates**: Kosaćce = the 149 m² house body is dropped because its perimeter "wall fraction" is 0.289 against a
   hard 0.35 (`layout.ts:151,895`); the same region measures 0.495 on the dimensioned copy. e-OZE = the plan extent is set by
   the only READ vertical chain (68 px) and every outer wall is deleted before decomposition (`plan-decomposition.ts:698-811,1206-1213`).
5. **[M] e-OZE has a second, independent fault: the overall dimension was read as "1601" (which implies 2.2236 cm/px and gives
   a footprint 0.6 % from the published 122.07 m2) and the chain solver then rewrote it to "1801" to agree with a pooled scale
   of 2.5016 cm/px (`chains.ts:780`).** Fixing only the extent would turn a loud failure into a 12.5 % oversize model that the
   6 %/20 % footprint gate passes as DEGRADING (decomposition-level counterfactual [M]; the later elevation checks were not run, so whether
   they would catch it is [I]).
6. CI never runs the production analyzer on a real drawing. Real-house assertions are Marcówki-only (sealed artifacts); the
   G2E test is `describe.skipIf(!process.env.BUILDAPP_SECOND_HOUSE_DIR)`; Kosaćce and e-OZE appear in no test.

---------------------------------------------------------------------------------------------------------------------

## 1. Role question answered

**Question:** is the analyzer evidence-driven and generic, or reference-shape-driven? Where would the next unseen house fail?

**Answer: reference-shape- and reference-*sheet*-driven, in a way no purity test can see.** Three layers of evidence.

### 1.1 What the four measured experiments show

**E1 — resize invariance of the plan scale [M].** Same storey, same drawing, different pixel size => `cm_per_px x width_px` must
be equal (checked: e-OZE overall chain spans 720 px on the 853 copy and 464 px on the 550 copy; 464/720 = 0.644 = 550/853, so
the copies are pure resizes). Registered values (`metric-evidence.json`, `PLAN_XZ` registrations, GROUND):

| project | 550 px | 400 px | 853 px AREA_TABLE | 853 px DIMENSIONED | which is right |
| --- | --- | --- | --- | --- | --- |
| Marcówki | 637 (3/24 chains read) | none (1/18) | 2254 (5/45) | 2254 (6/57) | 853 (model accepted) |
| Kosaćce 46 | 1390 (2/45) | 671 (3/30) | 2052 (4/70) | 2052 (11/80) | 853 (model accepted) |
| Rarytasy G2E | 2044 (6/38) | none (0/0) | none (0/0) | 2352 (9/80) | 853 (model accepted) |
| Rarytasy e-OZE | 1222 (4/37) | 610 (5/28) | 2134 (3/62) | 2134 (9/81) | none: true = 1895 (1600 cm / 720 px x 853) |
| alt. Marcówki (generic publisher) | 875 and 637 (two 550 copies) | - | - | - | 550 is the only size published; 19.56 vs 131.16 m2 |

Marcówki ATTIC disagrees inside one size: 853 DIM 3153 vs 853 AREA 886. The two small copies of Kosaćce register at 0.68x and 0.33x
of the truth, the e-OZE 550 copy at 0.64x (its 1600 overall chain came out as `C1031@464px`), which is why "e-OZE 550 only" reports
50.48 vs 122.07 m2 (ratio 0.41 = 0.644 squared). The analyzer holds all of this evidence in one `MetricEvidenceSet` and never asks
the free question "do the copies agree?".

**E2 — leave-one-copy-in matrix [M]** (`second-house.ts --metrics <sealed> --drop-frames <all other ground plans>`, 16 runs,
`council-D-work/leave-one-copy.sh`):

| project | 550 DIM | 400 DIM | 853 AREA | 853 DIM | completes |
| --- | --- | --- | --- | --- | --- |
| Marcówki (ground only) | NO_WALLED_ENVELOPE | NO_DIMENSION_FRAME | completed | completed | 2/4 |
| Rarytasy G2E | NO_WALLED_ENVELOPE | NO_DIMENSION_FRAME | NO_DIMENSION_FRAME | completed | 1/4 |
| Kosaćce 46 | NO_WALLED_ENVELOPE | NO_WALLED_ENVELOPE | LAYOUT_REJECTED 33.15/164.47 | completed | 1/4 |
| Rarytasy e-OZE | LAYOUT_REJECTED 50.48/122.07 | NO_WALLED_ENVELOPE | NO_WALLED_ENVELOPE | NO_WALLED_ENVELOPE | **0/4** |

The pipeline's copy ordering (`layout.ts:195-196`: DIMENSIONED first, then largest raster) selects exactly the one configuration
the thresholds were tuned on. The first project outside the tuning set has no configuration that works.

**E3 — the Kosaćce phone failure, traced [M].** Replaying the solver with only the 853 px AREA_TABLE frame reproduces the phone
report exactly (33.15 vs 164.47 m2, 70 chains / 4 read, 88 bands, grid 8x6, 35 cells / 31 enclosed, 3 built regions, 2 masses,
2.4057 cm/px). The extent (46-742 x 179-703 px) and envelope are **correct**. The structural pass then drops the house:

| copy | region (px rect) | area | perimeter walled | `MIN_MASS_WALL_FRACTION` 0.35 |
| --- | --- | --- | --- | --- |
| AREA (8x6 grid) | 157-650 x 179-703 (the house body) | 149.4 m2 | 14.1 of 48.9 m = **0.289** | **rejected as "line work rather than construction"** |
| AREA | 46-157 x 333-703 | 23.9 m2 | 0.401 | kept |
| AREA | 650-736 x 514-703 | 9.4 m2 | 0.357 | kept, by 0.007 |
| DIM (18x13 grid), same house | 46-650 x 333-703 | 129.5 m2 | **0.495** | kept |
| DIM | 157-434 x 179-333 / annex / 3.2 m2 sliver | 24.6 / 8.9 / 3.2 | 0.708 / 0.368 / 0.258 | kept / kept / rejected |

Reference values on completed houses: Marcówki 0.675 and 0.745; G2E 0.557 and 0.677. The metric depends on how finely the grid cuts
the region (a coarse grid merges an L-shaped interior into one region whose perimeter includes unwalled cell edges), and the
threshold sits inside the observed continuum (0.258 ... 0.368 ... 0.495), so membership of the main body flips with the copy.
Then `FOOTPRINT_AREA_WRONG` (the gate, not the cause) refuses the 33.15 m2 remainder.

**E4 — the e-OZE desktop failure, traced and counterfactually repaired [M].**
- Extent = the widest chain per axis that **READ** a number (`dimensionedExtent`, `plan-decomposition.ts:698-723`). Horizontal:
  the overall chain `[75,795]` (720 px). Vertical: the only READ vertical chain, baseline 485, ticks 287/317/355 (an interior detail
  chain, `R100@39px`) => extent `{x 75-795, y 286.5-355}`, 720 x 68.5 px. The overall vertical chain exists in the evidence (baseline 24,
  ticks 236.5 / 578.5) but its rotated text was not read (the OCR found one token left of x = 75), so it may not state an extent.
- `planExtent` then lets the walls vote (`:774-811`), but only bands inside `chainRect +- 35 %` of its own span (`margin = 0.35`, `:791`
  => +-24 px vertically) count. The outer walls at y 237-256 and y 559-578 are 300-500 px long and lie outside that window, so they
  are declared "title block / logo" and the vote is 100 % in favour of the chain frame. (The diagnostic even prints
  "1033 px of the 1033 px of wall found lying inside it" for the area copy.)
- `decomposePlan` keeps only bands whose axis is inside the extent **and** with >= 60 % of their run inside it (`:1206-1213`). The two
  side walls (x 75-94 and 775-795, y 257-558) have 23 % of their run inside a 68 px strip and are deleted as well. Result: grid 15x2, no
  envelope, `PLAN_NO_WALLED_ENVELOPE`. All four outer walls are present in the band list (`long H y237-256 x222-549`, `y559-578
  x95-599`, `long V x75-94 y257-558`, `x775-795 y257-558`).
- Counterfactual (`council-D-work/probe2.ts`, production `decomposePlan` untouched, only the extent argument changed to the box of the
  bands that are >= 40 % of the longest band): envelope 75-795 x 246.5-568.5, grid 14x4, **39/39 cells enclosed, one body**. Built
  region area 114.6 m2 at 2.2236 cm/px (6.1 % from the published 122.07) and 145.1 m2 at 2.5016 cm/px (18.9 % from it).
- The scale fault, separately: `chain-horizontal-699-a3d8696b1d` carries `origin CHAIN_CORRECTED`, value 1801, with the note "the
  reader first read '1601'; the chain's scale endorses '1801'" and the rejected reading "1601 implies 2.223611 cm/px against the
  chain's 2.501411". Outer-face area 720 x 341 px is 121.4 m2 at 2.2236 (-0.6 % from published) and 153.7 m2 at 2.5016 (+25.9 %).
  So the published footprint, measured on the right quantity, would have decided this in one comparison. The production gate compares
  the axis-to-axis BUILT region area (-6.1 % vs +18.9 %) and both land in the same DEGRADING band (`layout-gate.ts:148-149`).

### 1.2 Why "one passes, the next fails somewhere else"

Between the source package and the model the analyzer makes at least sixteen serial, irrevocable choices, each with one winner and
no retained runner-up that a later stage can consult: role claims -> plan copy -> OCR tokens -> dimension lines -> pooled scale ->
chain correction -> extent -> wall thickness -> bands -> grid -> H0/H1 closure -> envelope -> flood fill -> region merge -> wall-fraction
gate -> footprint gate -> storey alignment -> roof form. Only two independent checks exist (footprint area at the end, the projection
audit for silhouettes), and both are terminal. With per-stage survival p ~ 0.9 on unseen sheets the product over sixteen stages is
~0.19; each project therefore dies at the first stage whose threshold its sheet does not satisfy, and fixing that stage moves the
failure one step downstream (the OWNER's sequence: wall overlap -> plan registration -> no walled envelope). [I] for the numbers; the
serial structure is [C].

OWNER symptom -> mechanism:

| symptom | mechanism | status |
| --- | --- | --- |
| Kosaćce clean URL passes | 853 DIMENSIONED copy present (the tuned configuration) | [M] |
| tracked URL fails "earlier, in plan registration" (`FOOTPRINT_AREA_WRONG`) | only the AREA copy survived on the phone; main body wall fraction 0.289 < 0.35; nothing retries another copy or region | [M] reproduced exactly |
| e-OZE `PLAN_NO_WALLED_ENVELOPE` | extent = 68 px READ chain, outer walls deleted; plus a self-confirming wrong scale | [M] |
| Marcówki "z ograniczeniami" | grammar limits (see section 8), other reviewers | out of scope here |
| "63% etap 3 z 9" for minutes | the whole metric pass (OCR of every orthographic frame, 165-193 s on desktop) is one event between 63 % and 91 % (`before/*.err`: `63% ... reading printed dimensions and callouts` then `91% REGISTERING_VIEWS`) | [M] |

---------------------------------------------------------------------------------------------------------------------

## 2. Task 1 — hidden reference assumptions

### 2.1 Literal leakage: none found

Production `src/` (packages `source-package, source-analyzer, source-cv, source-metrics, image-metrology, reconstruction,
analysis-service, mobile-scene, source-common, source-observations, source-vision, model, geometry, verification`,
`apps/local-analyzer/src`, `apps/analyzer-api/src`, `apps/android/app/src/main`):
- slugs and codes `marcowk|marcówk|rarytas|kosac|kosać|m2fa281446a8ca|m84f2903cb8e14|mf6628752fa61f|m738275b7537b0`: **0 hits** [M grep].
- evaluation dimensions `13.60 14.60 128.16 164.47 216.91 6.49 131.16 122.07 94.41 (and 13.6, 14.6)`: **0 hits** [M grep].
- (`packages/candidates/src/*.json` and `packages/reference-marcowki` contain Marcówki by design; they are not on the analyzer path.)

### 2.2 What the guards prove, and what they miss

| guard | what it proves | what it does not |
| --- | --- | --- |
| `tests/architecture/reconstruction.test.ts:74-91` | no `marcowki`, `marcówki`, `m2fa281446a8ca` in source-package, source-cv, source-observations, source-analyzer, source-metrics, reconstruction | does **not** scan `rarytas`, any `kosac*`, `mf6628752fa61f`, `m738275b7537b0`; together with `analyzer.test.ts:74-95` (source-common, source-cv, source-package, source-observations, source-vision, source-analyzer) no guard scans image-metrology, analysis-service, mobile-scene or the apps for `marcowki` |
| `reconstruction.test.ts:197-233` (STRUCTURAL_FILES) | none of 10 structural files contains `12.05 14.6 14.60 7.9 7.90 4.15 12.6 12.60 7.5 7.51 131.16 28.563799` | numbers are **Marcówki's only**; Kosaćce/e-OZE/G2E figures are not in the list; only 10 files; a tuned constant that is not a published dimension (0.35, 0.62, 2.5x, 35 %) is invisible |
| `tests/architecture/second-house.test.ts:47-72` | across all production dirs no `rarytas` / `m84f2903cb8e14`; solver dirs carry none of G2E's dimensions (`17.2 14.74 6.88 6.24 189.77 1474 1720 688 624`) | same blind spot: only G2E literals; a threshold set so that G2E passes is allowed |
| `tests/architecture/analyzer.test.ts:87,253` | the generic adapter directory names no project | only `adapters/generic` |
| `npm run reconstruct:no-reference` (`scripts/no-reference.ts`) | the candidate path runs with `packages/reference-marcowki` renamed away (no dynamic import, no JSON read) | it then **requires** `>= 2` bodies, >= 2 distinct storey spans and >= 2 roof kinds (`:88-95`), i.e. Marcówki's structure is the acceptance criterion; a one-body house cannot pass it. Default inputs are the sealed Marcówki package (`:41-50`) |
| `npm run reconstruct:no-benchmark` (`scripts/no-benchmark.ts:124-147`) | same for every `reference-*`, `source-truth*` package and `research/` | requires >= 2 bodies, a recess with a return, a storey with a partition + door + 2 rooms, a stair, an opening with a callout, a main roof: again the Marcówki feature set as the definition of "read the structure" |

**What no purity test can prove:** that constants were not fitted by iterating against the reference. The provenance is in comments in
production code [C]:
- `chains.ts:601-607` "1260 and 1280 each explain their own 476-pixel span ... only the nine horizontal spans that agree on 2.6424 say which
  of them the sheet actually prints" (the Marcówki ground-plan scale is 2.6426 cm/px, [M]).
- `views.ts:105-120` "on the four rendered elevations of the reference project it came back as the entire frame, 1279 x 596 px ... 485 px tall in a 596 px image"; `DEGENERATE_SILHOUETTE_COVERAGE = 0.85` (`:136`).
- `image-metrology/src/opening.ts:326-330,370` "separates the reference project's four renders from the fixture's line drawings with nothing in between"; `flatShare 0.6`.
- `plan-openings.ts:117-125` "on the reference project's ground-floor plan the rear glazing reads 5.03 m ... against a printed 4.70".
- `reconstruct.ts:656,673,844,923` "on this project's four renders/facades".
- `source-metrics/test/scale-plausibility.test.ts:26-34` the plausibility band was added for G2E's x3 misvote ("a sheet at 2.75 cm/px ... agree on 8.5 cm/px").

### 2.3 Constants that make sense for one sheet style only (no name, no dimension)

`archon.ts:168-172` floor fragment index 1 -> GROUND, 3 -> ATTIC (an "index 2" produces no claim); `archon.ts:41,78-84` "the original is `__n + 11000`"
(one larger candidate, never a second); `archon.ts:144-158` the DIMENSIONED role is inferred from the **channel** it arrived by;
`interior.ts:116-120` wall ink `luma < 95 && chroma < 70`; `parse.ts:14-21,105-109` a whole number of 2-4 digits is centimetres;
`chains.ts:326` weight `/ 50`; every pixel-domain window in section 4. All are calibrated to black-poché, cm-dimensioned, 850 px publisher sheets.

---------------------------------------------------------------------------------------------------------------------

## 3. Task 2 — fixed topology, orientation and count assumptions

| # | assumption | file:line | violated by | evidence |
| --- | --- | --- | --- | --- |
| 1 | front = bottom of the plan sheet; `frontSide: 'SHEET_BOTTOM'` is a literal type, no test against the opposite orientation; the side-view swap (`side-orientation.ts`) only decides between two side views | `v2/frame.ts:48,55-80` | plans drawn with the entrance/garden side at the top; any publisher that rotates the plan | [C]; nothing in the source checks it: elevations labelled FRONT/REAR are believed (`views.ts:chooseSide`) |
| 2 | storey from URL slug words or floor fragment index: 1 -> GROUND, 3 -> ATTIC, other -> no claim | `archon.ts:101-107,152-158,168-172` | any project whose upper plan has index 2 or no storey word | [C]; then `layout.ts:187` maps UNKNOWN to GROUND |
| 3 | UNKNOWN / NOT_APPLICABLE storey => GROUND; several plans with the same storey label => only one is read | `layout.ts:187-188,198-246` | an upper plan whose name lacks "piętro/poddasze"; two upper floors both labelled UPPER; copies | [C]; the upper plan may replace the ground plan (DIMENSIONED, then the larger raster, wins) |
| 4 | `STOREY_RANK = {BASEMENT -1, GROUND 0, UPPER 1, ATTIC 2, ROOF 3}`; indices are the consecutive rank among the storeys present | `layout.ts:66,496-507 (storeyIndices)` | - | [C] |
| 5 | **a second, different index map:** `{BASEMENT -1, GROUND 0, UPPER 1, ATTIC 1, ROOF 2}` | `v2/reconstruct-v2.ts:265` | GROUND + UPPER + ATTIC: layout gives 0/1/2, this map gives 0/1/1, so `planByStorey.set(1, ...)` overwrites the UPPER plan with the ATTIC plan and `planByStorey.get(2)` is empty; GROUND + ROOF: layout 1, v2 2 | [C]; no synthetic three-plan house exists (section 6), so it is untested. Silent: `registered === plans` check at `:289` compares counts of frames, not of keys |
| 6 | exactly one MAIN mass = max(storey reach x 1000 + area); the others are ATTACHED only if they touch it within 0.5 m | `layout.ts:1144-1160` | two equal wings; L with two two-storey arms; a detached outbuilding (role UNKNOWN) | [C] |
| 7 | ridge axis: apex vote (`peak > 0.6 m`) -> the layout's axis -> default **'Z'**; the layout's own default is "the long way" | `v2/reconstruct-v2.ts:352-357`, `roof-systems.ts:239` | square footprints; hip roofs (no gable end to vote); views that are rendered | [C] |
| 8 | the main roof is always `kind: 'GABLE'`; HIP and MONOPITCH are emitted as gables ("the DSL builds gables and flats") | `reconstruct-v2.ts:380`, `reconstruct.ts:458,485`, `roof-systems.ts:58` (`MULTI_PITCH -> HIP`, `MANSARD -> GABLE`) | hip, mono-pitch, mansard, multiple ridges | [C] |
| 9 | non-main masses get a FLAT roof "by convention" unless an attached gable form is read | `roof-systems.ts:163-190` | any lower body under a pitched roof the views do not show | [C] |
| 10 | UNKNOWN roof kind: `rise > 0.4 -> GABLE`, else FLAT | `roof-systems.ts:208-213` | shallow-pitched or flat roofs with parapets | [C] |
| 11 | `CONVENTIONS`: wall 0.38, slab 0.28, roof build-up 0.28, overhang 0.6, storey 2.8, opening head 2.2, sill 0.9, door 2.1, transom 0.16 | `solve.ts:62-88` | any building off the defaults; listed as ASSUMED downstream, so honest | [C] |
| 12 | footprint gate: BUILT area of the **lowest** storey vs published `footprint_area`: <= 6 % ok, <= 20 % DEGRADING, else BLOCKING; a basement is rank -1 and is "lowest" | `layout-gate.ts:143-149` | basement storeys smaller/larger than the ground floor; publishers whose "powierzchnia zabudowy" includes terraces/porches/garage; any wrong scale within 12 % linear (section 1.1 E4) | [C] |
| 13 | `MIN_MASS_WALL_FRACTION = 0.35` | `layout.ts:151,895` | large glazing, conservatories, open plans; coarse grids (E3) | [M] |
| 14 | `maxOpeningM = 3.2`, `maxWideOpeningM = 8`, `minInfill = 0.7` (metres, so dependent on the scale being right) | `plan-decomposition.ts:288,293,294` | sliding walls 3.2-8 m without a drawn leaf; any scale error moves gaps across 3.2 m | [C] |
| 15 | `closureThreshold = 0.62` (three copies of the literal: `plan-decomposition.ts:279`, `layout.ts:710,1328`) | as stated | - | [C]; no test mentions 0.62 |
| 16 | `minCellM = 0.45` (grid lines closer than this collapse) | `plan-decomposition.ts:281` | piers, chimney breasts, 0.4 m returns; untested (`grep minCellM tests` = 0) | [C] |
| 17 | long band = length >= 2.5 x wall thickness; envelope box needs >= 4 x wall thickness on both axes | `plan-decomposition.ts:741,859` | small annexes; narrow houses | [C] |
| 18 | `PLAN_OUTER_WALL_M = 0.15-0.8 m` (a 5.3x window) as the only physical check on a scale; the model uses a different window 0.15-0.7 for the wall it builds | `source-metrics/src/extract.ts:101`; `v2/reconstruct-v2.ts:230` | wrong scales within +-12 % pass (E4); inconsistent bounds | [C][M] |
| 19 | corroboration: another drawing's overall chain within max(0.25 m, 2 %) | `layout-gate.ts:105,135-136` | - | [C] (NOTED only) |
| 20 | scale registration tolerance 3 px in the fit, 2.2 px in the chain vote (two different pixel tolerances and two different ranking rules: count-first vs weight-first) | `registration.ts:98-102,124`; `chains.ts:326,395,481,616` | short spans accept +-5 % at 40-45 px | [C] |
| 21 | `SIDE_UNSPECIFIED`: both side elevations labelled alike; assignment is a coin toss (`takes the first free one`, confidence 0.4) corrected only if the main body's side profile is asymmetric by >= 0.25 m on >= 10 samples | `archon.ts:108-113`, `views.ts:chooseSide`, `v2/side-orientation.ts:99,123` | symmetric gables; hip; cardinal labels ("północna") are not recognised by either adapter | [C] |
| 22 | `levelsFrom`: needs >= 2 attached datums; values within 0.4 m are one floor; the top two datums are EAVES and RIDGE when >= 3; terrain = `-1.5 < v < -0.05` | `solve.ts:252-292` | flat roofs; a section printing floors + ridge only; basements deeper than 1.5 m read as terrain-adjacent floors | [C] |
| 23 | one shared level system: every body's storey `i` uses `levelsV2[i]` of the main body | `reconstruct-v2.ts:246-262` | split-level houses, wings with a different storey height | [C] |
| 24 | upper storey footprint = the upper plan's envelope rectangle (or extent) placed by one of nine discrete offsets, then intersected with each mass it covers >= 50 % | `layout.ts:346-450,958-1000` | L-shaped upper floors over a rectangle, cantilevers, upper floor larger than the lower | [C] |
| 25 | terrain datum `-1.5 .. 0 m` | `solve.ts:271`, `reconstruct-v2.ts:292` | sloping sites, walk-out basements | [C] |
| 26 | `readPlans` takes ONE copy per storey and stops at the first that yields an extent | `layout.ts:198-246` | all cases in E2 | [M] |
| 27 | `levelsFrom` / storey heights come from **one** section frame (`find`) | `reconstruct-v2.ts:203` | houses with two sections, no section | [C] |

---------------------------------------------------------------------------------------------------------------------

## 4. Task 3 — decision-gating constants (table)

Justification column: `comment` = a comment states a reason; `test` = a test exercises it; `none` = neither (searched `packages/*/test`, `tests/`).
"Family it breaks" is [I] unless a measurement is cited.

| file:line | constant | meaning | justification | building / sheet family it breaks |
| --- | --- | --- | --- | --- |
| `plan-decomposition.ts:277` | snapPx 5 | two grid candidates closer than 5 px are one | none | high-res plans (2000 px: 5 px = 1 cm) or 400 px copies (5 px = 12 cm) |
| `:278` | minBandCoverage 0.18 (or spans wall to wall) | a band shorter than 18 % of the extent is not a grid line alone | comment (loggia returns, `bandSpans`) | large plans with many short walls |
| `:279` | closureThreshold 0.62 | closure at or above this stops the flood fill | none (0 tests) | plans with wide doors/glazing that leave an edge 55-62 % closed |
| `:281` | minCellM 0.45 | grid lines closer than 0.45 m merge | none (0 tests) | narrow piers/returns; any scale error |
| `:282-283` | fallbackWallPx 12, minLinePx 18 | wall thickness when unmeasurable; shortest believable line | none | sheets at other pixel densities |
| `:288` | maxOpeningM 3.2 | widest hole that is a hole on width alone | comment (garage door 2.4, widest 3.0) | sliding walls, wide garage doors 3.2-3.6 m without a drawn leaf |
| `:293-294` | maxWideOpeningM 8, minInfill 0.7 | widest hole a drawing may vouch for; drawn infill share | comment; test (`wide-openings.test.ts`, at 5 cm/px, walls 12 px) | tested at one pixel density only |
| `:791` | margin 0.35 | walls farther than 35 % of the chain span from the chain frame are "other matter" | comment | any plan whose chain frame is a detail: **e-OZE [M]** |
| `:741,859` | 2.5 x wallPx; 4 x wallPx | long band; minimum envelope box | comment (2.5); none (4) | annex < 4 walls thick |
| `:711` | floor = 0.5 x the shortest READ segment | outer segments shorter than that are not extent | comment | - |
| `:1213` | 0.6 | a band belongs to the plan when >= 60 % of its run is inside the extent | comment (logo, north arrow) | a wrong extent deletes true walls **[M]** |
| `:1242-1245` | tolerance max(4, 0.6 wallPx), lineTolerance max(3, 0.35 wallPx), minJamb max(2, 0.5 wallPx) | probing tolerances | none | thin-line drawings, very thick walls |
| `:1392` | pocket limit max(6 m2, 2.5 w^2) | a pocket behind a wide gap is a porch below this area | comment | large covered terraces, big garages open on one side |
| `layout.ts:142` | survey window 6-40 px, min length 24 | first-pass band thickness window | comment | walls thinner than 6 px (400/550 copies) or thicker than 40 px (hi-res) [M: 8/8 small copies fail] |
| `:213-217` | 0.45 / 1.9 / 1.6 x wallPx | second pass windows | comment | mixed thick/thin wall drawings |
| `:151,895` | MIN_MASS_WALL_FRACTION 0.35 | a region below this walled share is "line work" | comment (glazed garden wall, paving) | glazing-heavy bodies; coarse grids: **Kosaćce area copy 0.289 [M]**; annex kept at 0.357/0.368 |
| `:347-349` | maxAnisotropy 1.15, coverageWeight 0.15, statedBonus 0.03 | storey alignment | comment | upper plan drawn with anisotropy > 15 % or a different sheet scale |
| `:807,978` | 0.5 | an upper plan "stands on" a mass at >= 50 % overlap | none | L-shaped upper floors |
| `:833,850` | IoU 0.7; score gap 0.1 | when two alignments count as different / close | none | - |
| `:1152` | touching 0.5 m | ATTACHED needs a shared wall line | none | detached garage 0.6 m away |
| `:1328` | mean >= 0.62 | recess "returns" | none | shallow recesses |
| `layout-gate.ts:105,135` | 0.25 m / 2 % | corroboration tolerance | comment | - |
| `:124` | 0.5 m2 | two bodies overlap | none | - |
| `:148-149` | 6 % / 20 % | footprint area agrees / near / wrong | comment ("closer than a rounded published figure") | **cannot separate scales within 12 % linear [M, E4]**; basement, terraces in the published figure |
| `structural-audit.ts:126,203` | 0.6 m; x4 = 2.4 m | silhouette disagreement DEGRADING / BLOCKING | none | hip roofs built as gables, rendered elevations with trees |
| `roof-systems.ts:154` | riseTolerance 0.45 m | span reproduces the measured rise | comment | - |
| `:208,213` | 0.4 m | UNKNOWN roof: GABLE above, FLAT at or below | none | low-pitch roofs |
| `extract.ts:101-125` | outer wall 0.15-0.8 m; survey 6/40/24; 0.75 quantile; skip if < 3 px | the only physical check of a scale | comment; test (`scale-plausibility.test.ts`, walls 17 px) | any scale error < x5.3; fires on x3 (G2E) only |
| `extract.ts:272` | tolerancePx 2.2 | chain vote pixel tolerance | comment ("pixels, not per cent") | 40-45 px spans accept +-5 %: e-OZE [M] |
| `chains.ts:326,395` | weight = conf x len / 50; x(1 + 0.5 (chains-1)) | vote weight; cross-chain bonus | comment | a cluster of agreeing misreads across chains beats one long overall chain |
| `chains.ts:427,538,580` | 0.03 distinct ratio; +-5 % axis refine; replacement needs >= 3 numbers on >= 2 chains and >= 3 % away | alternative scales | comment | a correct overall chain that is one number |
| `chains.ts:690, 722` | skip <= 3 ticks; substitution price 0.45^s, skip 0.7^k | chain solver DP | comment | - |
| `chains.ts:780` | origin CHAIN_CORRECTED when a digit is substituted | reading rewritten to fit the pooled scale | comment | **e-OZE: 1601 -> 1801 [M]** |
| `registration.ts:98-102,124` | count-first seed; 3 px | plan registration fit | comment | different rule from the vote |
| `ocr.ts:114` | minGlyphHeight 6, maxGlyphHeightFrac 0.06, inkDelta 8, minGlyphScore 0.55; blobs fill >= 0.18, w <= 4h | which marks are digits | comment | 550/400 copies (text 5-6 px), text taller than 6 % of the sheet |
| `dimension-lines.ts:55` | minLengthPx 40, maxThicknessPx 3, markReachPx 7, markExcessPx 2, maxGapPx 2 | what counts as a dimension line with ticks | none | high-res sheets (3 px lines are 1 px at 853), arrowhead/dot styles |
| `source-cv/bands.ts:65` | 5/40/24, maxGapFraction 0.45, maxGapPx 90, axisTol 3 | default band window | none | as above |
| `source-cv/mask.ts:366-369` | radius max(4, maxDim/40), delta 8, absolute 110 | ink | comment | pale poché, hatch, outline walls |
| `source-cv/mask.ts:73` | percentile 0.08 clamped 90-170 | global ink level | comment | - |
| `v2/wall-topology.ts:77` | gap 15 mm, reach 60 mm, minRun 0.2 m | partition planner | comment; test (synthetic 10 x 8, derived from the real overlap failure) | the only threshold set built as a class fix |
| `v2/interior.ts:113,116-120` | partition 0.2-0.72 x wall; minPiece 0.55; door 0.6-1.35 m; cell 0.05; ink luma < 95 & chroma < 70 | interior reading | none | double doors > 1.35 m, thick partitions, coloured poché |
| `v2/openings-v2.ts:71,112,115,149` | 0.5-6.5 m; reach 2.0 m; stub 0.3; solid >= 60 % over 0.45 wallPx; gap threshold 0.8 x min; elevation minShare 0.08 | opening readings | none | a 7 m glazing wall passes `maxWideOpeningM 8` in decomposition but is skipped here at 6.5 |
| `image-metrology/opening.ts:370` | flatShare 0.6 | line drawing vs render | comment (Marcówki renders vs synthetic) | pastel/flat-coloured elevations |
| `views.ts:136` | 0.85 | a traced silhouette covering >= 85 % of the sheet is "the sky" | comment (Marcówki renders) | elevations without margins |

---------------------------------------------------------------------------------------------------------------------

## 5. Task 4 — test-set overfit

### 5.1 Which tests assert values from the known houses

| test | what it uses | note |
| --- | --- | --- |
| `tests/benchmark/structural.test.ts` | sealed candidate `marcowki-auto` + `EXPECTED_*` from `reference-marcowki` | evaluates a **sealed** artifact; does not re-run the analyzer |
| `tests/architecture/analyzer-v2.test.ts:72-238` | committed Marcówki graph/metrics/ledger | hash and invariant consistency of artifacts, not solver behaviour |
| `packages/candidates/test/sealed.test.ts` | replay of sealed Marcówki candidates | replays DSL commands, not the reader |
| `tests/benchmark/second-house-roof.test.ts:38` | G2E model.json | `describe.skipIf(!BUILDAPP_SECOND_HOUSE_DIR)`: **not run in CI** |
| `packages/source-package/test/{acquire,archon,net}.test.ts`, `fixtures/archon-published.html` | Marcówki's page (published facts `131.16`) | acquisition only |
| `service.test.ts:181` | "004A baseline gate: the alternate Marcówki address is refused" | routing, not geometry |
| Kosaćce, e-OZE | **no test at all** (`grep -ril 'kosac\|m738275b7537b0' tests packages/*/test` = only the forbidden-string guards) | the two houses that expose the failures are the two with no regression |

Every vitest that executes `reconstructV2`, `runAnalysis`, `inferStructuralLayout` or `extractMetricEvidence` feeds it synthetic sheets
(`packages/analysis-service/test/*`, `packages/reconstruction/test/*`, `apps/analyzer-api/test/*`, `packages/source-metrics/test/extract.test.ts`) [C].
The real-drawing gates are the manual scripts `analysis:second-house`, `reconstruct:v2`, `reconstruct:no-*`.

### 5.2 Why the synthetic sheets do not defend against overfit

`packages/synthetic-drawings` (3 legacy houses + 12 v2 houses) is generated by the same team to the pipeline's conventions [C]:
- chains only along the top and the left (`house.ts chain()`), one chain set per sheet, upright synthetic 8x16 glyph font (16 px cap height;
  the OCR templates are a different 6x12 font, so this is not a template leak, but it is far larger text than the 9-12 px on real 853 px sheets);
  38 px/m = 2.63 cm/px, i.e. exactly the tuned pixel density; walls 0.25-0.4 m = 10-15 px solid;
- slugs `rzut-parteru`, `rzut-pietra`, `elewacja-frontowa/tylna/lewa/prawa`, `przekroj` (the ARCHON adapter's own dictionary), roles claimed `DIMENSIONED`;
- one plan per storey (no copies, no AREA_TABLE), the model frame with the front at the sheet bottom, wings only "along the right-hand side"
  (`house.ts:66-78`), roofs `GABLE` only, storeys labelled `UPPER` (never `ATTIC`);
- the 5 cm/px decomposition tests (`plan.ts`, `wide-openings.test.ts`) are a second, coarser density, which is good, but they bypass OCR, scale and the band survey.

### 5.3 §33 shape-family coverage THROUGH THE ANALYZER (drawing -> model)

| family | drawing -> model test exists? | where / gap |
| --- | --- | --- |
| rectangle | YES | ASHBY, BRACKENHOLT, LARCHFIELD, `fixtures.test.ts` A |
| L | PARTIAL | only "a wing sharing the right-hand wall, offset in depth" (HOLLOWAY, COLDHARBOUR, MARLOW); left wing, corner wing, two equal arms: NO |
| T | NO | - |
| U / recess | PARTIAL | front loggia pockets YES (DUNMORE, REDMIRE, fixture C, KELSALL/LINDALE upper loggias); U-court/atrium NO |
| attached garage | PARTIAL | side-flush one-storey garage YES; a garage projecting **forward** only exists as real G2E (env-gated test) |
| large glazing / open segment | decomposition only | `wide-openings.test.ts` (5 cm/px, no OCR); `MIN_MASS_WALL_FRACTION` has no glazed-mass test |
| one storey | YES | ASHBY, DUNMORE, HATHERLEIGH |
| attic (an ATTIC-labelled plan) | **NO** | `ATTIC` occurs only as a type in `reconstruction/test/plan.ts:109`; real ATTIC = Marcówki (sealed) |
| two storeys | YES | - |
| three storeys / basement | **NO** | (see section 3 row 5) |
| gable | YES | the only roof form |
| hip / mono-pitch / flat main roof | **NO through the analyzer** | `architecture/fixtures.test.ts` has `roof-hip`, `roof-shed`, `roof-flat-parapet` as **DSL fixtures**, not readings; the reader emits hips as gables |
| attached roof wing | YES | MARLOW (gabled wing), COLDHARBOUR (flat) |
| non-orthogonal walls, plans not upright, front not at the bottom | **NO** | - |
| duplicate plan copies / AREA_TABLE / 400-550 px only | **NO** | (E2) |
| mm dimensions, hatched or outline poché, dimension text in another face | **NO** | - |

---------------------------------------------------------------------------------------------------------------------

## 6. Function capability inventory (audited functions)

Format: `symbol (file:line)` — in -> out; det; assumptions/thresholds; consumed / ignored; alternatives; failure codes; alt-hyp?; cost; risk; recommendation.
Costs are measured from `analysis-trace.json` (e-OZE desktop): observations 132.7 s, metric pass 165.3 s, `PLAN_READ` + decomposition 0.269 s.

1. **archonRoleClaims / storeyForFloorIndex** (`archon.ts:119-172`) — candidate URL, channel, slug, caption -> role claims with confidence; det yes; slug regexes, floor index 1/3, channel implies DIMENSIONED (0.6) or AREA_TABLE (0.8); consumes slug/caption/channel; ignores pixel content (a "DIMENSIONED" copy with no chains stays DIMENSIONED); alternatives: content-based classification; codes: none (misclassification is silent); alt-hyp no; cost ~0; **HIGH**; REFACTOR (make roles a prior that pixel evidence can overrule).
2. **readPlans** (`layout.ts:177-262`) — graph frames, metrics, rasters -> one `PlanReading` per storey; det yes; UNKNOWN->GROUND, DIMENSIONED then largest raster, break at first extent; consumes chains, bands, extent; ignores the other copies, `AREA_TABLE`, cross-copy scale; alternatives: candidate per copy; codes: `NOT_DECODABLE`, `NO_EXTENT`, gap `MISSING`; alt-hyp **no**; cost 0.27 s per plan; **HIGH**; REFACTOR.
3. **dimensionedExtent / planExtent** (`plan-decomposition.ts:698-811`) — chains + bands -> one extent rect, `weak` flag; det yes; widest READ chain per axis, 35 % margin, walls vote inside the margin only; consumes READ segments; ignores unread chains whose ticks land on wall faces, all bands beyond the margin; alternatives: extent candidates (chain, wall ring, union); codes: `NO_EXTENT` -> `PLAN_NO_WALLED_ENVELOPE`; alt-hyp no; cost ~ms; **HIGH**; REPLACE with candidate set.
4. **decomposePlan** (`plan-decomposition.ts:1193-1540`) — mask, chains, bands, registration, extent -> grid, closures, H0/H1, cells, regions; det yes; all of section 4; consumes bands inside the extent, chains with `valueCm`, ink; ignores bands outside; alternatives: H0/H1 are both computed, one chosen (`differs ? H1 : H0`); codes: `PLAN_GRID_EMPTY`, `PLAN_NO_ENCLOSED_CELLS`, `PLAN_NO_BUILT_REGIONS`; alt-hyp partial (2 closure hypotheses, not retained); cost ~0.1 s; **HIGH**; INSTRUMENT then REFACTOR (retain H0/H1 and extent candidates).
5. **gridLines / thinLines** (`:354-500`) — chains+bands -> grid lines with support; det yes; snap 5 px, coverage 0.18, band-span rule, minCell 0.45 m; consumes chain segments that have a value, bands; ignores unread ticks; alt no; **MEDIUM**; KEEP + INSTRUMENT.
6. **walledEnvelope** (`:827-876`) — long bands -> axis box snapped to grid; null when < 4 wallPx; consumes long bands only; **MEDIUM**; KEEP as one candidate generator.
7. **planBodies / mergeRegions** (`:1543-1738`) — cells -> maximal rectangles, largest first, ties by position; det yes; **rectilinear only**, greedy; alternatives: other tilings of an L/T; alt no; **HIGH** for non-rectilinear families; KEEP for orthogonal, add candidate tilings.
8. **perimeterWallEvidence + MIN_MASS_WALL_FRACTION** (`layout.ts:710-745,895`) — region -> walled fraction; grid-density dependent (E3); rejection produces an `AMBIGUOUS` gap and no mass; **HIGH**; REFACTOR to a score with the rejected region kept as an alternative.
9. **chooseBasePlan** (`:309`) — plans -> best by registration, envelope, extent strength, ground bonus 0.75; det yes; **MEDIUM**; KEEP.
10. **alignPlans** (`:346-450`) — base, other -> best of {targets x scales x 9 offsets}, `considered` retained, runner-up recorded as alternative/conflict when < 0.1 apart; det yes; maxAnisotropy 1.15; **MEDIUM**; KEEP (the one place that already models multiple hypotheses and reports them; replicate the pattern).
11. **inferStructuralLayout** (`:755-1140`) — plans -> storeys, regions, masses, attachments, recesses; det yes; no registration => early return (`:775`); one MAIN; upper = rectangle intersect mass; codes `PLAN_NO_DIMENSION_FRAME`, `PLAN_NO_MASSES`; **HIGH**; REFACTOR.
12. **evaluateLayoutGate** (`layout-gate.ts:104-201`) — layout, published areas -> gate; det yes; 6 %/20 %, overlap 0.5, corroboration 0.25/2 %; consumes published `footprint_area` only; ignores room areas and usable area (they are in the package: e-OZE prints 94.41 usable and 12 rooms); codes `FOOTPRINT_AREA_WRONG`, `MASS_OVERLAP`, `NO_MASS`, `NO_STOREY` refuse the run (`plan-diagnostics.ts:LAYOUT_REFUSAL_CODES`); **MEDIUM**; REFACTOR to a scorer over candidates, keep `MASS_OVERLAP` per-candidate.
13. **auditStructuralProjection** (`structural-audit.ts:125-232`) — masses, elevations -> silhouette residuals; det yes; 0.6 / 2.4 m; already DEGRADING, not refusing; **LOW-MEDIUM**; KEEP.
14. **inferRoofSystems / ridgeAxisFromRise** (`roof-systems.ts:130-316`) — masses, section datums, spec -> per-mass roof; det yes; rise tolerance 0.45; flat by convention for non-main; codes none (gaps); **HIGH** for hip/mono/complex; REFACTOR.
15. **levelsFrom** (`solve.ts:252-300`) — datums -> floors, heights, eaves; **MEDIUM**; INSTRUMENT.
16. **worldFrameFrom / planFrameV2** (`v2/frame.ts:55-120`) — layout -> v2 frame; front = sheet bottom; **HIGH** for orientation; REFACTOR (two-hypothesis).
17. **registerElevations / chooseSide** (`views.ts:170-260`) — silhouettes, massing -> side, scale, overhang; label believed; coin toss when unlabelled; **MEDIUM**; KEEP + add hypothesis pair.
18. **decideSideOrientation** (`v2/side-orientation.ts:100-134`) — pair of side views, roof profile -> swap decision; two hypotheses scored, margin 0.25; det yes; **LOW** (a good pattern).
19. **solveFrameChains / voteScale / decideScale** (`chains.ts:481-660`) — proposals -> one pooled scale; det yes; pixel tolerance 2.2, weight /50, plausibility only; consumes OCR readings; ignores published areas, other copies; alternatives: `scaleCandidates` exist but are used only when the winner is implausible; codes `PLAN_NO_DIMENSION_FRAME`; alt-hyp no; **HIGH**; REFACTOR (carry top-N).
20. **solveChain** (`chains.ts:662-820`) — chain + tokens + fixed scale -> segments (READ / CHAIN_CORRECTED / DERIVED); DP over ticks; rewrites digits to the scale; **HIGH**; REFACTOR (score, never overwrite).
21. **registerFrame / fitAxis** (`registration.ts:74-186`) — anchors -> scale per axis; seeds from each anchor, count-first, 3 px; **MEDIUM**; KEEP after fixing 19-20.
22. **planScalePlausibility** (`extract.ts:103-125`) — mask -> plausible(scale) by wall thickness 0.15-0.8 m; **MEDIUM**; KEEP as a weak prior, not a filter.
23. **readNumbers** (`ocr.ts:895-1046`) — raster -> tokens, 3 orientations; template OCR; min 6 px; cost ~24 s per 853 px frame (165 s for ~7 frames); rotated text not read on e-OZE [M]; **HIGH**; INSTRUMENT (report per-frame read rate).
24. **findDimensionLines / chainsFromLines** (`dimension-lines.ts:55-215`) — mask -> lines with ticks; 81 candidates on e-OZE, 9 read (~11 %; Marcówki 6/57, Kosaćce 11/80, G2E 9/80); **HIGH**; INSTRUMENT.
25. **runLengthBands / adaptiveInkMask** (`bands.ts`, `mask.ts:366`) — solid runs; **HIGH** for non-solid poché; KEEP + add alternative wall detectors.
26. **readInterior** (`v2/interior.ts:113-618`) — raster, plan frame -> partitions, doors, rooms; luma < 95 ink, rectilinear; **MEDIUM**; KEEP.
27. **planWallTopology** (`v2/wall-topology.ts`) — runs, hosts -> non-overlapping runs, unresolved joints not emitted; det yes; **LOW**; KEEP (model for "honest partial beats invalid").
28. **readWallOpenings / planGaps** (`v2/openings-v2.ts`) — plan gaps + callouts + elevations; 0.5-6.5 m; inconsistent with the 8 m decomposition limit; **MEDIUM**; INSTRUMENT.
29. **reconstructV2** (`v2/reconstruct-v2.ts:1-1229`) — orchestrates; hard-codes GABLE, ridge default, storeyIndexOf; codes: `MODEL_EMISSION_FAILED` only thrown site besides plan failures; **HIGH**; REFACTOR.

---------------------------------------------------------------------------------------------------------------------

## 7. Assumption register

Hard = a wrong value stops the run or produces a wrong model; Soft = degrades or is recorded as a gap.

| ID | current behaviour (file:line) | why it exists / evidence basis | families that violate it | H/S | decision |
| --- | --- | --- | --- | --- | --- |
| ASSUMP-SOURCE-001 | roles from URL slug words and caption (`archon.ts:93-116`); generic vocabulary `adapters/generic/vocabulary.ts:20-45` | one publisher's file names; [C] | publishers with opaque file names, other languages, cardinal side names | Soft | soften: pixel evidence may overrule |
| ASSUMP-SOURCE-002 | annotation role inferred by channel; `DIMENSIONED` is used only as a sort key (`layout.ts:195`); `AREA_TABLE` is never read by the solver (grep: 0 references in reconstruction/source-analyzer) | area-table copies carry no chains on some sheets (G2E: 0 chains) [M] | a package with only an AREA copy (both phone runs) | Hard | remove the sort-key role; score copies by content |
| ASSUMP-SOURCE-003 | the dimensioned copies are reachable only through a second-stage fragment endpoint `product_fancybox_floor/<code>/<n>`; the page body exposes only the area copy through `data-floor-pom-img` (`tracked-mobile-ua.html` and `tracked-node-ua.html` differ only in the CSRF token [M], so the user agent does not change what the page reveals); no diagnostic says "no DIMENSIONED plan reached the solver" | why the phone had 1 frame is **not established** here; candidates are fetch failure of the fragment; the analyzer is blind to it | any source with a two-step reveal | Hard | branch: report missing role as a first-class source finding |
| ASSUMP-SOURCE-004 | floor index 1 -> GROUND, 3 -> ATTIC, other none (`archon.ts:168`) | seen on two-storey projects | index 2 (upper floor), one-storey projects with index 1 only | Soft | soften |
| ASSUMP-SOURCE-005 | one larger variant candidate `__n+11000` (`archon.ts:78-84`) | 404 is a valid answer | publishers without the block | Soft | keep |
| ASSUMP-IMAGE-001 | pixel-domain constants tuned near 853 px / 2.4-2.7 cm/px (bands 6-40 px, OCR >= 6 px, dimension line <= 3 px, snap 5 px) | [M] E2: 0 of 8 small copies complete | 400/550 copies; 2000 px originals; scanned plans | Hard | branch: normalise to a working scale or make the constants a function of measured wall/text height |
| ASSUMP-IMAGE-002 | walls are solid dark runs (`bands.ts`, `mask.ts:366-369`, `interior.ts:116-120`) | poché black on the corpus | hatched, outlined, grey or coloured poché | Hard | branch: second wall detector |
| ASSUMP-IMAGE-003 | plans are upright and axis-aligned; text 0/CW/CCW only; no deskew anywhere in the analyzer (grep rotate/deskew) | published sheets | scanned/rotated plans, 45 degree wings | Hard | soften: detect and report |
| ASSUMP-IMAGE-004 | render vs line drawing by `flatShare >= 0.6` (`opening.ts:370`) | tuned on one project's renders vs synthetic | flat-colour renders | Soft | keep, instrument |
| ASSUMP-ORIENTATION-001 | front is the sheet bottom (`frame.ts:48,77`) | ARCHON convention | any other publisher; rotated plans | Hard | branch: two hypotheses (0/180), decide by label + door/opening evidence |
| ASSUMP-ORIENTATION-002 | unlabelled sides: first free wall, swap only on asymmetric roof profile (`views.ts`, `side-orientation.ts:99`) | good pattern, narrow trigger | symmetric roofs, hips | Soft | keep |
| ASSUMP-ORIENTATION-003 | labels FRONT/REAR believed; cardinal names not parsed | publisher's own words | "północna/południowa" sheets | Soft | soften |
| ASSUMP-SCALE-001 | one pooled OCR vote per frame, winner only (`chains.ts:481,611-630`) | scaleCandidates exists but is used only on implausible winners (`:570-600`) | sheets with few/rotated/misread numbers | Hard | branch candidate |
| ASSUMP-SCALE-002 | only physical check: outer wall 0.15-0.8 m (`extract.ts:101`) | added for G2E's x3 misvote | any scale error < x5.3 [M e-OZE +12.5 %, Kosaćce 550 -32 %] | Hard | soften: weak prior |
| ASSUMP-SCALE-003 | `CHAIN_CORRECTED` rewrites a reading by glyph substitution to fit the pooled scale (`chains.ts:780`) | fixes single-digit misreads | e-OZE [M] | Hard | remove overwrite; carry alternatives |
| ASSUMP-SCALE-004 | integers of 2-4 digits are cm, decimals are m (`parse.ts:14-21`) | Polish plans | mm-dimensioned plans (4-5 digits) | Hard | branch unit hypothesis |
| ASSUMP-SCALE-005 | copies of one drawing are never cross-checked | `readPlans` reads one | all [M E1] | Hard | add resize-invariance constraint |
| ASSUMP-SCALE-006 | two pixel tolerances, two ranking rules (2.2 px weight-first, 3 px count-first) | history | thin-vote sheets | Soft | unify |
| ASSUMP-DIMENSION-001 | extent from the widest READ chain per axis (`plan-decomposition.ts:698-723`) | avoid ticks reaching a north arrow | e-OZE [M]; any sheet where the overall vertical text is rotated/unread | Hard | branch candidate |
| ASSUMP-DIMENSION-002 | the read rate is ~10 % of detected chains (6/57, 11/80, 9/80, 9/81) and the vote rests on 3-18 anchors | [M] | any sheet with lower OCR yield | Hard | instrument: expose per-frame read rate and anchor count |
| ASSUMP-GRID-001 | grid = chain ticks with a value + long bands; snap 5 px; minCell 0.45 m (`:277-283,354-500`) | comment | narrow features; scale errors | Soft | keep |
| ASSUMP-GRID-002 | region metrics depend on grid density (E3: 0.289 vs 0.495) | - | any coarse-grid copy | Hard | fix the metric |
| ASSUMP-WALL-001 | wall thickness = length-weighted median of a 6-40 px survey; second pass 0.45-1.9x; long band 2.5x (`layout.ts:142,213-217`; `plan-decomposition.ts:741`) | comment | mixed thick/thin drawings | Soft | keep |
| ASSUMP-WALL-002 | `MIN_MASS_WALL_FRACTION 0.35` drops a region as "not a building" (`layout.ts:151,895`) | keep paving out | Kosaćce area copy [M], glazing-heavy homes | Hard | soften: score |
| ASSUMP-WALL-003 | partition thickness 0.2-0.72 x exterior wall, pieces >= 0.55 m (`interior.ts:113`) | corpus | thick masonry partitions | Soft | keep |
| ASSUMP-WALL-004 | modelled wall thickness clamp 0.15-0.7 vs `PLAN_OUTER_WALL_M` 0.15-0.8 and convention 0.38 | - | 0.7-0.8 m walls | Soft | unify |
| ASSUMP-ROOM-001 | door 0.6-1.35 m, rectilinear rooms, 0.05 m flood cell (`interior.ts:113`) | corpus | double/sliding interior doors, curved rooms | Soft | keep |
| ASSUMP-ENVELOPE-001 | envelope = axis box of the long bands, null under 4 wallPx (`:827-876`) | comment | one-axis-only detections | Hard | keep as one candidate |
| ASSUMP-ENVELOPE-002 | H0/H1 both computed, `differs ? H1 : H0` (`:1414-1450`) | comment | - | Soft | retain both |
| ASSUMP-ENVELOPE-003 | `inside` filter deletes bands outside the extent before decomposition (`:1206-1213`) | logos, north arrows | a wrong extent [M] | Hard | filter after the envelope, not before |
| ASSUMP-OPENING-001 | 3.2 m / 8 m in metres (`:288,293`) | comment | scale errors; sliding walls | Hard | soften: candidates with the scale |
| ASSUMP-OPENING-002 | openings-v2 accepts 0.5-6.5 m, decomposition 8 m | drift between stages | 6.5-8 m glazing | Soft | unify |
| ASSUMP-BODY-001 | bodies are maximal axis-aligned rectangles, largest first | comment | L/T tilings, non-orthogonal | Hard | branch tilings |
| ASSUMP-BODY-002 | exactly one MAIN (`layout.ts:1144`) | comment | two equal wings | Soft | keep, allow tie |
| ASSUMP-BODY-003 | upper footprint = the upper plan's rectangle intersect mass, 9 discrete offsets (`:346-450,958-1000`) | discrete search is a good pattern | L-shaped/cantilevered upper floors | Soft | keep |
| ASSUMP-BODY-004 | one level system for all bodies (`reconstruct-v2.ts:246-262`) | simplicity | split-level | Soft | keep |
| ASSUMP-ROOF-001 | main roof always GABLE; hip/mono emitted as gable (`reconstruct-v2.ts:380`, `reconstruct.ts:485`) | DSL limits | hip, mono, mansard | Hard | branch |
| ASSUMP-ROOF-002 | ridge: apex vote -> layout axis -> 'Z' (`:357`; `roof-systems.ts:239`) | comment | square plans, hips | Soft | keep, report |
| ASSUMP-ROOF-003 | non-main body FLAT by convention (`roof-systems.ts:163-190`) | recorded as CONVENTION | pitched lower wings | Soft | keep |
| ASSUMP-ELEVATION-001 | elevation scale = section total height over silhouette height; surplus width = overhang (`views.ts:170-230`) | comment | wings wider than the main body, no section | Soft | keep |
| ASSUMP-ELEVATION-002 | silhouette covering >= 85 % is the sky (`views.ts:136`) | Marcówki renders | elevations without margins | Soft | keep |
| ASSUMP-TOPOLOGY-001 | two different storey index maps (`layout.ts:496-507` vs `reconstruct-v2.ts:265`) | drift | GROUND+UPPER+ATTIC, GROUND+ROOF | Hard | remove one |
| ASSUMP-TOPOLOGY-002 | UNKNOWN storey => GROUND (`layout.ts:187`) | default | upper plans without a storey word | Hard | soften: candidate storeys |
| ASSUMP-TOPOLOGY-003 | `levelsFrom` top two datums = eaves, ridge (`solve.ts:286`) | comment | flat roofs, sections without eaves | Soft | keep, report |
| ASSUMP-TOPOLOGY-004 | footprint gate 6 %/20 %, lowest storey, axis-based area (`layout-gate.ts:143-149`) | comment | E4; basements | Hard | soften: scorer, outer-face area |
| ASSUMP-RUNTIME-001 | stage weights read off one 20-asset project (`stages.ts:47-60`); the metric pass emits one event between 63 % and 91 % | comment | every project with a different frame count | Soft | instrument: per-frame events |
| ASSUMP-RUNTIME-002 | no per-run time or memory budget; the metric pass OCRs every orthographic frame including all copies (RSS 1.1-2.2 GB desktop [M]) | - | Node 18 phone | Soft | instrument |
| ASSUMP-TEST-001 | CI has no real-drawing solver test; G2E skipIf; Kosaćce and e-OZE none (section 5.1) | - | every new house | Hard | add held-out families |
| ASSUMP-TEST-002 | purity guards look for literals of Marcówki/G2E only (section 2.2) | - | tuned constants | Soft | add invariance tests |
| ASSUMP-TEST-003 | `reconstruct:no-reference/no-benchmark` pass criteria are Marcówki's structure (section 2.2) | - | one-body houses | Soft | make structural expectations input, not code |
| ASSUMP-TEST-004 | synthetic sheets follow the pipeline's conventions (section 5.2) | - | all listed there | Hard | add adversarial renderer options |
| ASSUMP-TEST-005 | each fix targets the magnitude of the last failure (plausibility band x3 after G2E; wall topology after the overlap) | history | next magnitude | Soft | replace with invariants |

---------------------------------------------------------------------------------------------------------------------

## 8. Single-hypothesis lock-in points

| point | where | alternatives available in the evidence | could top-N be kept cheaply? |
| --- | --- | --- | --- |
| plan frame | `layout.ts:198-246` | 4 decodable copies per storey (all already OCR-read) | **yes**: each decomposition costs ~0.27 s vs 165 s for the metric pass |
| crop / extent | `plan-decomposition.ts:774-811,1206-1213` | chain frame, wall-ring frame (four long walls closing a rectangle), union | yes: three rectangles |
| orientation | `frame.ts:48,77` | 0 / 180 degrees | yes: elevation labels + door/opening positions decide |
| scale | `chains.ts:481,570-600,611-630` | `scaleCandidates` already produces the field | yes; arbiter = printed overall chain, published footprint on outer faces, room areas, resize invariance |
| grid | `plan-decomposition.ts:354-500` | - | not needed if extent/scale are candidates |
| dimension interpretation | `chains.ts:662-820` | reading alternatives are stored on every token | yes: score, do not overwrite |
| wide-opening closure | `plan-decomposition.ts:1414-1450` | H0 and H1 both computed | yes: keep both |
| envelope | `:827-876` | axis box | yes |
| body decomposition | `:1543-1738` | other rectangle tilings | modest |
| region acceptance | `layout.ts:895` | rejected region is kept as an `AMBIGUOUS` gap only | yes: keep as a candidate |
| elevation mapping | `views.ts:chooseSide`, `side-orientation.ts` | swap hypothesis scored | already done for sides; not for front/rear |
| roof form | `reconstruct-v2.ts:380` | hip/mono/gable | needs DSL support; represent as candidate with a gap |
| storey stacking | `layout.ts:346-450` | 9 offsets x targets x scales, `considered` kept | **already the model pattern** |

---------------------------------------------------------------------------------------------------------------------

## 9. Hard vs soft

**Should become scores or late validation:**
- `FOOTPRINT_AREA_WRONG` (`layout-gate.ts:149`, `LAYOUT_REFUSAL_CODES`) — it is the only strong independent constraint and it is spent as a terminal gate on one candidate. It should rank candidates (copy x extent x scale), measured on outer faces, with published usable and room areas as second and third evidence.
- `PLAN_NO_WALLED_ENVELOPE` / `PLAN_NO_DIMENSION_FRAME` / `PLAN_GRID_EMPTY` — fail the candidate, not the run; the run fails only when every candidate fails.
- `MIN_MASS_WALL_FRACTION` — score; the rejected region stays as an alternative body.
- `planScalePlausibility` — weak prior.
- `STRUCTURE_SILHOUETTE_DISAGREES` blocking tier — already excluded from refusal; keep DEGRADING.
- `NO_MASS_REACHES_UP`, `ONE_ROOF_KIND` — already NOTED/DEGRADING.

**Must stay hard:** model invariants and topology (`packages/model/src/validate*.ts`, `WALLS_OVERLAP`, closure), replay determinism and hashes (`verify.ts`, `verifyReplay`), URL/SSRF/byte-size fences (`security.ts`, `net.ts`), `MASS_OVERLAP` **per candidate**, `NO_STOREY`, and "never emit an invalid joint" (`wall-topology.ts` already does this and is the template).

---------------------------------------------------------------------------------------------------------------------

## 10. Failure taxonomy contributions

| code | thrown at | class | note |
| --- | --- | --- | --- |
| `PLAN_LAYOUT_REJECTED` / `FOOTPRINT_AREA_WRONG` (Kosaćce area copy) | `plan-diagnostics.ts:112-124` | **algorithm assumption** | source complete (the dimensioned copy exists); cause `MIN_MASS_WALL_FRACTION` on a coarse grid |
| `PLAN_LAYOUT_REJECTED` (e-OZE 550, alt. Marcówki) | same | algorithm assumption x source limitation | small copy: OCR under 6 px, wrong scale committed; the gate is right to refuse |
| `PLAN_NO_WALLED_ENVELOPE` (e-OZE 853, 400; Kosaćce 550, 400; G2E 550; Marcówki 550) | `plan-diagnostics.ts` `planFailureOf` | **algorithm assumption** | extent from READ chains + deletion of bands; for small copies also pixel windows |
| `PLAN_NO_DIMENSION_FRAME` (G2E 400 and AREA; Marcówki 400) | same | source limitation (no readable chain) with an **unimplemented semantic** (no scale from another copy or published area) | |
| `MODEL_EMISSION_FAILED` / `WALLS_OVERLAP` (004A) | `reconstruct-v2.ts:1054` | algorithm assumption, fixed generically | the model for a class fix |
| never thrown: `PLAN_STOREY_ALIGNMENT_AMBIGUOUS`, `VIEW_REGISTRATION_AMBIGUOUS`, `SECTION_REGISTRATION_FAILED`, `TOPOLOGY_NO_VALID_HYPOTHESIS`, `METRIC_SOLVE_FAILED` (0 references outside `failure.ts`); `VIEW_REGISTRATION_NO_ANCHORS`, `ELEVATION_REGISTRATION_FAILED`, `PLAN_STOREY_ALIGNMENT_FAILED` appear only as trace `reasonCode` on DEGRADED steps | `grep` [M] | unimplemented semantics | all of the failure diversity the OWNER has seen sits in one stage (plan reading), which is where all the single-winner choices are |

---------------------------------------------------------------------------------------------------------------------

## 11. Top 5 findings (ranked) and the falsification statement

Ranked by how much of the OWNER pattern each explains and by how directly it was measured.

### F1 (critical) — one plan copy per storey, first extent wins, no retry, copies never compared
- **Evidence:** `layout.ts:177-246` (`read = true; break`), `layout.ts:195` (annotation is a sort key), `archon.ts:144-158` (annotation from channel). E2: 4/16, 0/4 for e-OZE, success only at 853 px. E1: resize invariant violated in 4/4 projects (1.15x to 3.5x). Both phone failures are the area-copy-alone case (E3, E4).
- **Smallest generic change:** make every decodable copy of a storey a candidate; decompose each (0.27 s each); add the resize invariance (`cm/px x width`) as a cross-copy constraint on scale; pick by independent evidence, not by order; report "no DIMENSIONED plan reached the solver" as a source finding.

### F2 (critical) — the plan extent is set by the widest READ chain and deletes the walls it does not cover
- **Evidence:** `plan-decomposition.ts:698-723,791,798-808,1206-1213`; e-OZE extent 720 x 68.5 px, four outer walls present in the band list, counterfactual with a wall-ring extent gives 39/39 enclosed cells and one body (E4). The diagnostic text ("1033 of 1033 px of wall inside") is self-confirming.
- **Smallest generic change:** extent candidates {chain frame, wall ring, union} scored by the fraction of long-wall length explained plus ring closure, with chains whose ticks land on band faces counted even when unread; move the band filter after the envelope. Keep the runner-up.

### F3 (critical) — one pooled OCR scale, pixel tolerance, digits rewritten to fit it, and a 5.3x plausibility window
- **Evidence:** `chains.ts:481,570-600,611-630,780`, `extract.ts:101`; e-OZE overall chain `1601 -> 1801` (`metric-dimension-55ef3f8509`), published footprint separates the hypotheses by 0.6 % vs 25.9 % on outer faces but the gate sees -6.1 % vs +18.9 % on axis-based area, both DEGRADING (`layout-gate.ts:148-149`). Fixing F2 alone would pass the layout gate with a 12.5 % oversize plan as DEGRADING (later gates not run; [I] whether the result would surface as "Model gotowy z ograniczeniami").
- **Smallest generic change:** carry the top-N scale candidates (they exist: `scaleCandidates`, `chains.ts:426`) into the layout; arbitrate by (a) the printed overall chain, (b) the published footprint on outer faces, (c) published room areas, (d) resize invariance; never overwrite a token reading, store the alternative.

### F4 (high) — hard thresholds that sit inside the measured continuum decide pass/fail
- **Evidence:** wall fraction accepted 0.357/0.368/0.495/0.557/0.675/0.677/0.745, rejected 0.258 and the Kosaćce house body 0.289 against 0.35 (E3); the same region is 0.495 or 0.289 depending on the copy. Other examples: footprint tolerance 6 %/20 %; 3.2 m / 8 m in metres; three literal copies of 0.62; `maxOpeningM` vs `maxWidthM` 8 vs 6.5.
- **Smallest generic change:** replace single-value gates by scores over retained candidates and log the margin to the threshold in the trace so a margin under measurement noise is visible.

### F5 (high) — generalization is not measured; the tuned configuration is the pipeline's default path
- **Evidence:** CI runs the analyzer only on synthetic sheets; real-house assertions are Marcówki artifact consistency; G2E is env-gated; Kosaćce and e-OZE have no test (section 5); purity guards catch literals only (section 2.2); comments cite the reference project for thresholds (section 2.2); the synthetic renderer draws at the tuned pixel density with the pipeline's own dictionary (section 5.2); `no-reference`/`no-benchmark` define success as Marcówki's structure.
- **Smallest generic change:** a held-out family harness — parametric renderer options (copy count and sizes, chain placement, wall style, storey mix, units, rotation, orientation, poché) plus metamorphic invariants (resize invariance, copy invariance, mirror invariance) that fail on the current code.

**Next in line (not top five):** the two storey index maps (section 3 row 5); hip -> gable; mm units; unread rotated dimension text; front = sheet bottom; single-section and single-level-system assumptions; the silent metric pass.

### Falsification statement

The claim "the analyzer is becoming generic" is **already falsified at HEAD** by two measurable criteria, and would be confirmed only by the third:

1. Leave-one-copy-in: fewer than 3 of the 4 copies of one drawing completing or degrading honestly. Measured: 4/16 overall, 0/4 on the newest project, 0/8 on the small copies.
2. Resize invariance: `cm/px x width_px` differing by more than 2 % between copies of one storey. Measured: violated in 4/4 projects, up to 3.5x.
3. Held-out completion: with thresholds frozen, at least ten projects never used for any threshold or role rule (across at least two publishers), at least 80 % complete or return an honest partial, with **zero** threshold edits made in response to any of them. Every earlier project needed one (G2E the x3 plausibility band, the 004A project the wall-topology planner) and e-OZE needs one now.

If a future change makes e-OZE complete but criteria 1-2 still fail, that is a fourth per-project fix, not generalization.

---------------------------------------------------------------------------------------------------------------------

## Appendix — reproduction (all read-only; outputs in `/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/council-D-work/`)

- Registration table (E1): node over `before/<name>/{observation-graph,metric-evidence}.json`: for each `FLOOR_PLAN` frame, `PLAN_XZ` registration `metresPerPixelX x 100 x size.width`.
- E2: `council-D-work/leave-one-copy.sh <name> <cache>` runs
  `node_modules/.bin/vite-node packages/analysis-service/scripts/second-house.ts -- --package … --graph … --metrics … --drop-frames <every other plan frame> --cache scratchpad/acq/cache-<name> --out …` (cwd = repo root, `--out` in the scratchpad; `git status` stayed clean).
- E3: `council-D-work/probe.ts` (imports `inferStructuralLayout`, `planBodies`, `perimeterWallEvidence` from the repo, writes nothing) with `--drop` of the other three Kosaćce copies.
- E4: `council-D-work/probe2.ts --frame frame-asset-rzut-b747b42ad2-e3a3d0015d --scales 2.5016,2.2236` on the e-OZE sealed evidence.
- Chain evidence: `before/rarytasy-eoze/metric-evidence.json`, chain `chain-horizontal-699-a3d8696b1d`, evidence `metric-dimension-55ef3f8509`; digest `before/rarytasy-eoze/plan-diagnostics/digest.json` (`extent`, `bands`, chain `baselinePx 24 ticks [230, 236.5, 578.5]`).
- Kosaćce area-copy replay output: `council-D-work/kos-area/{failure.json,plan-diagnostics/}`.
