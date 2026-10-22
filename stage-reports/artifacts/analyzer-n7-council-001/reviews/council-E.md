# Council E — elevations / visual geometry (N7-COUNCIL-001)

Reviewer E. Read-only on production code. Harnesses: `/home/user/BuildApp/research/analyzer-n7-council/E/`
(`thin-body-sky.ts`, `side-choice.ts`, `cut-body-report.ts`). Corpus evidence: `scratchpad/r1/<house>/audit.json`
(HEAD 6788e7d replays). No publisher raster written anywhere; harnesses print numbers only.

Scope note: none of the 8 corpus houses has a thin body (`thinBodies: []` everywhere), so P2R's elevation path
(`elevationOver`) has never run on a real raster in the corpus. Its only coverage is
`packages/reconstruction/test/thin-body-n7-p2r.test.ts`, which **stubs `skyOf`** with a hand-made mask.

---

## Findings

### E1 — CONFIRMED_DEFECT: thin-body elevation corroboration accepts trees, and bodies standing behind, as "built" (test case G)

- FIRST_BAD: `packages/reconstruction/src/v2/thin-body.ts` → `adjudicateThinBody` → inner `elevationOver` (the
  `builtShare` = share of NOT-sky pixels), together with `v2/camera.ts` → `skyMask`.
- Input: a thin attached body that shares a face with main. The plan draws a line 4 m further out with paper between
  it and the body (a fence, a terrace edge or a parapet would look the same), and nothing is printed. The FRONT
  elevation shows no building over the widened 8..12 m.
- Current behaviour: `skyMask` counts only pale or blue pixels that connect to the top edge as sky. It also excludes
  green explicitly (`!green && …`). So foliage of any colour, a garage further back, a hedge or a shadow all count as
  "built". `elevationOver` measures only along the facade (columns) and between the storey's two heights. It never
  looks at depth, so any body at those x columns, at any z, corroborates. In the harness, with the production
  `skyMask`:
  - G1 green trees: builtShare 1.0 → CORROBORATES → **WIDEN** to 11.99 m
  - G2 olive/brown trees: builtShare 1.0 → **WIDEN**
  - G4 a garage standing BEHIND at z 9..15 (the widened rect z 0..8 is empty; the `collides` test sees no overlap):
    builtShare 1.0 → **WIDEN**
  - G3 grey hedge/shadow 0..1.6 m: 0.595, just under `ELEVATION_BUILT` 0.6. Extrapolating, not run: a hedge of about
    1.65 m or more crosses the threshold.
  - Controls are correct: G0 empty sky → CONTRADICTS; G0b real wall → WIDEN; G5 white line drawing → CONTRADICTS.
- Correct behaviour: a "not sky" share is not evidence that a wall was built. Corroboration should need wall-like
  evidence: the house's own wall material (the `solids` tone that `foreignMask`/`measureOpeningOnView` already learn),
  a drawn vertical edge at the widened far face, or ground/eaves continuity. Columns that another plan body already
  explains (any z) must not count. At most, vegetation should make the view NOT_DECISIVE.
- Missing test: there is no test with the real `skyMask` on vegetation or on a body behind. The existing
  `WIDEN on the elevation alone` test passes only because `skyOf` is stubbed.
- Reproduce: `cd /home/user/BuildApp && npx vite-node research/analyzer-n7-council/E/thin-body-sky.ts` →
  `RESULT: 3 case(s) where nothing is built yet the body was WIDENED`.
- Impact: WIDEN changes the mass rectangle (`Object.assign(mass, …)` in reconstruct-v2.ts:1062). It invents a body of
  wrong size, over a terrace or garden, on the word of trees. This lands exactly where P2R is meant to rescue the
  owner's attached body.

### E2 — CONFIRMED_DEFECT: cross-view verification is partly self-referential and confirms a body that is 3.7 m too narrow

- FIRST_BAD: `v2/verify.ts` → `verifyExteriorAssemblies` (SILHOUETTE_WIDTH, BAND_SOFFIT) and `verifyAgainstViews`
  (ROOF_EDGE). These feed `v2/cross-view.ts` → `crossViewResiduals` / `verdictOf`.
- Evidence (marcowki, sealed; `cut-body-report.ts`):
  - **SILHOUETTE_WIDTH looks for the nearest tone edge within 0.3 m of the MODEL's own outer faces.**
    - As read (body 12.05 m): front model 12.05, observed 12.033, within tolerance.
    - With `attached-0` misread to 0.45 m (`narrowMass`, model 8.35 m): front model 8.35, **observed 8.477, within
      tolerance**.
    - The same view "confirms" both 12.05 m and 8.35 m: the check cannot see a missing 3.7 m of building.
  - **BAND_SOFFIT residual is exactly 0.000000 on all 9 samples.** `balcony-front-1` 2.321029 = 2.321029,
    `balcony-rear-1` 2.521597 = 2.521597, `portal-head-attached-0` the same. The balcony thickness was itself read off
    the same view's tone band ("a 0.71 m band of dark tone at 2.32..3.03"), so the view is checked against itself.
  - **ROOF_EDGE at the ridge is circular.** The registration hangs the silhouette's apex on the ridge datum. On side
    views of an X-ridge roof every sample is `ridgeY` (7.95 vs 7.933, three times, on both side views), so
    `RIGHT AGREES 6/6` is made mostly of tautologies. On FRONT/REAR the 0.5 sample is also the ridge.
- Correct behaviour: a residual must compare the model with a reading that does not depend on it. That means a width
  from the silhouette's own outer edges (not the edge nearest the model), and no residual on a quantity the view
  itself supplied or the registration fixed. Such checks must be marked `REGISTRATION_ANCHOR` or `SELF_READ` and
  left out of `withinTolerance` and `verdict`.
- Missing test: no test asserts that a view rejects a model width that is wrong by more than 1 m.
- Reproduce:
  ```
  R=/home/user/work005yn6/prod-r4/p/marcowki
  npx vite-node research/analyzer-n7-council/E/cut-body-report.ts -- --run $R --package $R/source-package.json \
      --cache /home/user/work005r/corpus/v0/cache --mass attached-0 --side WEST --keep 0.45
  ```
  Look at the `SILHOUETTE_WIDTH` lines. Add `--asread` for the baseline.

### E3 — CONFIRMED_DEFECT / COVERAGE_GAP: opening heights go into the model from views whose ground the solver itself refuses

- FIRST_BAD: `v2/reconstruct-v2.ts` → `reconstructV2`.
  - (a) `viewGroundRefusals(elevations, [...bandRegistrations.values()], terrain)` (≈line 682) runs the terrain test
    only on silhouette-registered views. Band (OPENINGS_ONLY) views are checked only against the median of the other
    views (±0.3, ≈line 662), never against the printed terrain.
  - (b) A same-sheet override (`sameSheetSideRegistration`) inherits its mate's `zeroRow` even when the mate's heights
    were refused.
  - (c) The `readWallOpenings` view filter (≈line 1298) excludes only `openingHeightRefused` and lets overrides through
    either way. The N7-P2 alignment (≈line 2084/2091) instead gates heights at `anisotropyCheck <= 0.35`. The two gates
    disagree.
- Evidence (a01, `r1/a01/audit.json`; terrain datum −0.72):
  - RIGHT (silhouette view) puts the ground at −0.01 (err 0.71) → heights REFUSED.
  - The LEFT same-sheet copy takes RIGHT's scale and ground row (0.016179 m/px, row 621.8, ground −0.01) → heights
    "READ".
  - FRONT/REAR band views have ground −0.26/−0.30 (err 0.46/0.42) → heights "READ".
  - The model then holds openings with `IMAGE_METRIC_REGISTERED` sill and head from these views:
    `opening-0-west-3-1` (from ad8fd1a56b, err 0.71), `opening-0-front-0-0` (b74ed2020b, err 0.46) and
    `opening-0-rear-2-1` (19da37ded6, err 0.42).
  - `viewAudit` reports `openingHeights: READ` for all three, while `facadeAlignment.views[*].heights` is `false` for
    all four views of the same house.
  - trytomach shows the same pattern: the REAR band view has err 0.79 and heights READ.
- Correct behaviour: one gate for "this view's heights are registered". The terrain test applies to every view that
  reads heights. An override inherits its mate's refusal. `viewAudit.openingHeights` reports that same gate.
- Missing test: there is no test of a band or same-sheet view against the terrain datum.
- Reproduce:
  ```
  python3 -c "import json;a=json.load(open('<scratchpad>/r1/a01/audit.json'));print([(v['side'],v.get('groundErrorM'),v.get('openingHeights')) for v in a['views'] if v.get('mpp')]);print([(o['id'],o['elevation']['frameId'][-10:]) for o in a['openings'] if o.get('elevation')])"
  ```
  Or re-run `p2run.sh`.
- Impact: wrong window and door heights, by up to the ground error (0.4–0.7 m), labelled as image-measured.

### E4 — CONFIRMED_DEFECT: an unlabelled side elevation is lost when its nearest axis is taken (no fallback to the other axis)

- FIRST_BAD: `packages/reconstruction/src/views.ts` → `chooseSide`. It picks the axis with the smallest surplus. When
  both walls of that axis are already assigned, it refuses the view (`both walls on that axis are already assigned`)
  instead of trying the other axis, which is free.
- Evidence (sasankach3; `side-choice.ts`): footprint 11.60 × 10.45, gable ridge along X with eaves on the long sides.
  - Both side silhouettes measure 12.26 m and 12.15 m.
  - The surplus over the width is 0.66/0.55 m and over the depth 1.81/1.70 m (0.90/0.85 m eaves each side, which
    matches a ridge along X).
  - Labelled FRONT and REAR take the width axis, so **both side views are refused**.
  - The house ends with two registered views, both with heights REFUSED. `facadeAlignment` covers FRONT and REAR only,
    and EAST/WEST openings are `VIEW_NOT_REGISTERED`. The roof is emitted with `overhang: 0`; the side views that show
    the eaves are exactly the ones discarded.
- Correct behaviour: when the closest axis is taken and the other axis is free with a non-negative surplus (a plausible
  eaves overhang), assign the view to the other axis, at lower confidence, and let `decideSideOrientation` or
  `decideSidesByOpenings` settle which of the two sides it is.
- Missing test: there is no `chooseSide` test with labelled front and rear plus two unlabelled sides wider than the
  width.
- Reproduce:
  ```
  R=/home/user/work005yn6/prod-r4/an/sasankach3
  npx vite-node research/analyzer-n7-council/E/side-choice.ts -- --run $R --package $R/source-package.json \
      --cache /home/user/work005yn3/analogs/cache --width 11.6 --depth 10.45 --height 8.52
  ```
- The same refusal hits gozd (13.99 m), trytomach (19.35 m) and arganiach (16.49 m). There the measured width is also
  doubtful, because the legacy scale is `totalHeight / silhouette px height`: with no ridge datum, gozd scales by the
  wall top. The root cause there is not proven.

### E5 — HIGH_RISK (reasoned): elevation registration and side choice depend on the masses

- `registerElevationFrames(graph, { width: main.x1 − main.x0 + Σ_nonMain max(0, m.x1 − main.x1) + max(0, main.x0 − m.x0), depth: world.walled… })`
  (reconstruct-v2.ts:579).
- The sum runs over every non-main mass, pieces (`pieceOf`) included, which are pushed into `masses` at line 475. It
  does not take a union, so two bodies, or a body and its piece, sticking out on the same side are counted twice.
- The width comes from masses, which may be wrong, while the depth comes from the plan's walled frame.
- With `attached-0` narrowed on marcowki, the legacy FRONT/REAR registration silently reports 1.69–1.74 m "eaves" (span
  8.35 vs silhouette 11.72). That is a strong signal that the body is too narrow, and nothing uses it.
- The v2 registration (`registerElevationV2`) uses `world.envelope` from the plan, not masses, so the labelled views
  are robust.
- The risk sits in `chooseSide`, for unlabelled views only: a misread width can move a view onto the wrong axis or
  refuse it. Not reproduced on the corpus (the marcowki sides keep their assignment with width 8.35 or 12.05).
- Fix direction: use `world.walled` for the width too, and report the legacy surplus as a width-mismatch signal.

### E6 — HIGH_RISK (reasoned, code-proven): wall openings and facade measurements read the pixels of a NEARER body

- `openings-v2.ts` → `readOpeningOnViews` / `wallAppearanceExtent` / `elevationExtent`, and `facade-openings.ts` →
  `measureOpeningOnView`, take only `(view, interval, floorY, top)`. They have no host depth and no occluders
  (`WallHost.planeAt` is never used on a view).
- A wall of main that stands behind an attached porch or garage on the same facade, with overlapping columns, reads the
  sill and head of whatever the nearer body draws there. That can be the garage door's head, or no opening at all
  (NOT_OBSERVED and EXTRA_IN_MODEL hints).
- `facadeAlignment` likewise pairs readings by along-overlap only, so a CONFIRMED_MATCH can be the nearer body's
  opening.
- Not reproduced here, because it needs a synthetic plan with gaps.
- Fix direction: pass the other masses' face planes and ranges, and skip (NOT_OBSERVED) the columns that a body nearer
  to the viewer covers.

### E7 — COVERAGE_GAP: elevation reports describe a building the final model does not hold

- `facadeAlignment`, `verifyAgainstViews` (residuals, `crossViewResiduals`) and `openingCounts.elevationIndependent` are
  all computed on `building` BEFORE `fitPreviewProgram` cuts bodies (reconstruct-v2.ts:2178 vs 2219).
- In the marcowki narrow run (partial preview, `ring-attached-0-0` cut):
  - `facadeAlignment` still lists `opening-0-east-9-0`, which the model does not hold.
  - The residuals still use the 8.35 m width (main plus the cut body), while the model is 7.90 m.
  - The crossView verdicts are unchanged.
- In the owner's case (`ring-attached-1-0` refused), the elevation report on screen therefore describes, and may
  "confirm", walls and openings that are not in the scene. Nothing marks those comparisons as being about cut objects.
- Fix direction: re-key the comparisons and residuals to `partialPreview.skipped`, or recompute them on the fitted
  model.
- Reproduce: `cut-body-report.ts` (command in E2) → `comparisons naming an opening the final model does not hold: 1`.

### E8 — HIGH_RISK: thin-body reads heights on views the solver has excluded from heights

- `adjudicateThinBody` receives `views: [...views, ...openingOnlyViews]` (reconstruct-v2.ts:1050). That includes band
  and same-sheet registrations ("openings only") and views in `openingHeightRefused`.
- `elevationOver` then reads the rows `pyOf(top − 0.3)..pyOf(floor + 0.3)` on those views. A 0.4–0.7 m ground error
  shifts the band.
- This is a minor effect beside E1, but it is a second consumer that ignores the view-use contract stated in
  `view-audit.ts`.

### E9 — CONFIRMED (report semantics): CONFIRMED_MATCH does not mean what its doc says

- `facade-alignment.ts` → `alignFacades`.
  - CONFIRMED_MATCH means "read on the view on its own and agreeing". But the "measured" reading is seeded at the
    model's plan interval (`measureOpeningOnView` walks out from the gap's middle).
  - When `fv.heights` is false, sill and head are not compared at all.
- a01: all 4 views have heights false, yet there are 7 CONFIRMED_MATCH. Those confirm the horizontal position and
  width only.
- Correct behaviour: carry a `heightsCompared` flag, or a separate status for along-only matches.
- Classified as a reporting defect, not a geometry defect.

### NOT_A_DEFECT (checked)

- **Side handedness.** `registerElevationV2` and `elevationFrameFromV2`: FRONT runs west→east, REAR east→west, LEFT
  rear→front, RIGHT front→rear. I worked this through for a viewer outside each wall, with z = 0 as the front: all
  correct.
- **Side swaps.** `decideSideOrientation` (symmetric profile → no swap) and `decideSidesByOpenings` (all views must
  agree, ≥ 2 gaps a side) are conservative. They never swap on one view.
- **Heights-refused views in `readWallOpenings`.** They are excluded from opening reading, and the views there supply
  sill and head only (positions come from the plan). Consistent. (But see E3 for views that slip through.)
- **Openings from elevations.** `MISSING_IN_MODEL` and `scanned` readings are never built: an elevation never adds an
  opening. Report-only, by design.

---

## Silent failures / report-only results

- `facadeAlignment` CONFLICTs (a01 4, marcowki 6, ciesz 6, rary 5) never change geometry, except convention heights.
  They are report-only, and the app does not surface them as warnings.
- Legacy registration `overhangM` (E5) is a width-mismatch signal that is computed and then dropped.
- `chooseSide` refusals (E4) appear only in `viewAudit.why`. The run is not degraded for losing two of four views.
- `notObserved` residuals are correctly `withinTolerance: false`. But E2's self-referential checks count as passes.

## Inventory (my path)

FILE → FUNCTION → INPUT → ASSUMPTIONS → POSSIBLE FAILURE → EFFECT → EXISTING TEST → VERDICT

| File | Function | Input | Assumptions | Possible failure | Effect | Existing test | Verdict |
|---|---|---|---|---|---|---|---|
| v2/thin-body.ts | `thinBodies` | masses, T | thin = attached and min(w,d) < 2T; skips pieces and storeyRects | pieces and per-storey rects never adjudicated | ring refused → partial preview | thin-body-n7-p2r | DESIGN_LIMITATION (other reviewers) |
| v2/thin-body.ts | `adjudicateThinBody` / `elevationOver` | views, `skyMask` | not-sky = built; columns only, no depth | trees, hedges and back bodies corroborate | false WIDEN (wrong mass size) | stubbed sky only | **CONFIRMED_DEFECT E1** |
| v2/thin-body.ts | chain roles | plan chains | segment ends within tol of faces | — | — | yes | OK |
| v2/camera.ts | `skyMask` | raster | sky = pale or blue, connected to top, gradient steps ≤ 12 | green, dark and white walls behind trees count as not sky | over-counting "built" | indirect | limits noted (E1) |
| views.ts | `chooseSide` | widthM, massing, taken | smallest surplus = axis | no fallback when that axis is full | side views lost | — | **CONFIRMED_DEFECT E4** |
| views.ts | `registerElevations` | extents, massing | scale = totalHeight / px height | no ridge → wall top used → silly widths (gozd 41.6 m) | refusals | — | HIGH_RISK |
| solve.ts | `registerElevationFrames` | graph, massing (width from masses) | width summed per mass | double count, misread mass | side choice shift | — | HIGH_RISK E5 |
| v2/frame.ts | `registerElevationV2` | extent, side, world, ridgeY | apex = ridge; span from plan; ground err ≤ 0.9 | apex on a chimney or tree → ground off | heights off | elevation tests | OK (guarded by H5) |
| v2/frame.ts | `elevationFrameFromV2` | reg | handedness per side | — | — | — | NOT_A_DEFECT |
| v2/side-orientation.ts | `decideSideOrientation`, `decideSidesByOpenings`, `sameSheetSideRegistration`, `gableApexRow`, `roofTopOverBand` | views, profile | conservative swaps; mate scale and ground | override inherits a refused ground | heights from a refused ground | partial | E3(b) |
| v2/reconstruct-v2.ts | ground gates (N2 / H5 / `viewGroundRefusals`) | regs, terrain | terrain test only for silhouette views | band views escape the terrain test | wrong heights | cross-house-005y-n3 | **E3** |
| v2/openings-v2.ts | `readWallOpenings` / `readOpeningOnViews` | plan gaps, views | the view's columns show this wall | nearer body occludes | wrong sill and head | — | HIGH_RISK E6 |
| v2/opening-reading.ts | `resolveSillAndHead`, `matchOpeningCallout`, `preferredElevationExtent` | callout, elevation | printed beats drawn | — (not reviewed in depth) | — | yes | not assessed beyond reading |
| v2/facade-openings.ts | `measureOpeningOnView`, `scanFacadeOpenings`, `foreignMask` | view, model interval | the plan seeds the search | seeded, occlusion | optimistic match | facade-alignment-n7-p2 | E6 / E9 |
| v2/facade-alignment.ts | `alignFacades`, `applyOpeningCorrections` | readings | heights gate 0.35; corrections need twin agreement | CONFIRMED_MATCH without heights; pre-cut | report overstated | yes | E9, E7 |
| v2/view-audit.ts | `viewAudit` | regs, refusals | heights = !H5-refused | says READ where alignment says no | misleading audit | — | E3 |
| v2/verify.ts | `verifyAgainstViews`, `verifyExteriorAssemblies`, `verticalEdgeNear`, `horizontalEdgeNear` | building, views | nearest edge to the model = observation | self-reference and anchors pass | false AGREES | — | **CONFIRMED_DEFECT E2** |
| v2/verify.ts | `repairFromResiduals` | residuals | moves assumed sill and head only | — | 0 applied on marcowki | — | OK |
| v2/cross-view.ts | `crossViewResiduals`, `verdictOf` | residuals | every check counts | tautologies count | inflated verdict | — | E2 |
| v2/attached-roof-form.ts | `readBodyTop`, `readAttachedRoofForm` | views, sky mask | body seen against sky; green = sky | tree behind a flat roof → LEVEL/PEAKED | mitigated: LEVEL must match the stated pitch | yes | HIGH_RISK (low) |
| v2/roof-details.ts | `readEavesOverhang`, `readChimneys`, `readRooflights` | section, views | — | not deep-reviewed | — | yes | not assessed |
| v2/tones.ts | `readMassTones`, `readReturnTones` | views | — | cosmetic | — | — | not assessed |

## Top 3 by impact

1. **E1 (lost/invented bodies, wrong size).** The P2R WIDEN path takes trees, hedges or a body standing behind as an
   elevation proof and resizes a mass. It has never run on a real raster in the corpus, and its test stubs the sky
   mask. It is the rescue path meant for the owner's thin attached body.
2. **E2 + E7 (elevation mismatch hidden, wrong dimensions accepted).** The cross-view check confirms a body 3.7 m too
   narrow (SILHOUETTE_WIDTH searches near the model; BAND_SOFFIT and ridge ROOF_EDGE are self-referential). It is also
   computed on the pre-cut building, so the report on screen does not describe the partial-preview scene.
3. **E3 + E4 (lost views, wrong opening heights).** Inconsistent ground gates put 0.4–0.7 m ground errors into
   `IMAGE_METRIC_REGISTERED` opening heights (a01, trytomach). `chooseSide` drops both side elevations of sasankach3,
   leaving no side facade check and a 0 m eaves overhang.
