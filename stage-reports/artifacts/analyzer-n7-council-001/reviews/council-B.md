# N7-COUNCIL-001: Reviewer B (OCR / DIMENSIONS / REGISTRATION)

Read-only on production code. Harnesses: `/home/user/BuildApp/research/analyzer-n7-council/B/` (run from the repo root
with `npx vite-node <file>`). Corpus outputs go outside the repo:
`/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/councilB/`.

| harness | what it shows |
|---|---|
| `metric-probe.ts` + `run-probe.sh <outdir>` | per house: T, base/upper plan mpp per axis, why each plan frame was chosen, the layout's storey alignment, mass span bases, levels, roof datum, elevation registrations |
| `band-probe.ts` + `run-band.sh <outdir>` | T against the thickness of the bands that draw each body's outer faces |
| `chain-probe.ts -- --run R --package P --cache C` | body pixel edges against every X chain's ticks and how many segments were read |
| `ring-overlap.ts` | the validator's WALLS_OVERLAP area for a rectangular ring against (2T − W)(L − 2T); a 0.75 m body that passes at t = 0.25 m and is refused at T = 0.44 m |
| `attic-scale-repro.ts` | the arganiach attic plan registered at 1/3 scale from two misread labels (sealed, withheld, and at the ground scale) |
| `inset-storey-faces.ts` | synthetic: `planFrameByOuterFaces` accepts a storey inset 0.5 m all round at a scale 10.5 % off |

## 0. Corpus numbers (sealed replay at HEAD, offline)

T is `building.wallThicknessM`, which is `decomposition.wallThickness.m` of the base plan. "Layout wallM" is
`plan.wallPx × max(mpp)`, the value layout.ts uses for its sliver gate and tolerances. "Outer bands" is the thickness of
the long bands lying on each body's outer faces (band-probe).

| house | mppX / mppY base (aniso) | T (px) | layout wallM | outer-face bands | upper plan frame (mpp, how) | masses: width/depth basis |
|---|---|---|---|---|---|---|
| a01 | .02031/.02034 (0.16 %) | **0.427** (21) | 0.224 | 21–22 px = 0.43–0.45 | 0.02027, outer faces | main M/M |
| gozd | .02534/.02520 (0.58 %) | **0.304** (12) | 0.304 | **17 px = 0.431 on all four faces** | 0.02550, outer faces | main M/M |
| marcowki | .02643/.02647 | 0.490 (18.5) | 0.453 | 17–18.5 px (0.45–0.49); 24–25 px pieces | 0.02625, outer faces (layout alignment FITTED ×1.0286, 3.4 % apart) | main M/M, att-0 M/M |
| ciesz | .02777/.02781 | 0.459 (16.5) | 0.445 | 16–17 px | — | main M/M |
| rary | .02758/.02752 | 0.441 (16) | 0.386 | main 16–17; **attached-0 12 / 14 px = 0.33 / 0.39** | — | main M/M, **att-0 SCALED**/M |
| trytomach | .02135/.02132 | 0.448 (21) | 0.278 | 21–21.5 px | 0.02135, same pixel scale, "no outer faces found" | **main SCALED**/M |
| arganiach | .02689/.02686 | 0.457 (17) | 0.286 | main 17; **attached-0 W face 5.5–6 px = 0.15–0.16** and 17 | **0.008967 (1/3!)**, PRINTED_SCALE alignment, NO_SUPPORT | main M/M, **att-0 SCALED**/M |
| sasankach3 | .01953/.01945 (0.41 %) | 0.430 (22) | 0.273 | 22–23 px | 0.01950, outer faces | main M/M |

Per-axis scale is sound everywhere: base anisotropy is at most 0.6 %, and no body width is skewed by an X/Z scale
mismatch. Every SCALED span sits beside a chain whose ticks fall within 3 px of both faces but which has **zero
segments read** (trytomach: none of the 30 X chains reads a segment at both main faces; rary: chain y = 735 ticks
179…427 against faces 180.9/429.5; arganiach: chain y = 741 ticks 118, 391, 646 against faces 393.8/646). OCR reads
6–12 segments out of 50–80 chains per base plan. A SCALED basis is therefore honest (nothing was read). In arganiach
the pixel-located face sits 2.8 px = 0.075 m from the tick that states it.

## 1. Owner overlap 0.3092 m² (no identification attempted)

`harness ring-overlap.ts` checks the formula against the validator: for `createWallRing`, ALTERNATE corners, outer face
on the polygon, the w1/w3 overlap is exactly `(2T − W)·(L − 2T)`, where W = x1 − x0 (the X width) and L = z1 − z0.
This is true whenever W < 2T, for 6/6 cases, with differences < 1e-4.

So the following W (the body's narrow X width) fits 0.3092 m² for a given global T and length L:

| T \ L | 2.0 | 2.5 | 3.0 | 4.0 | 5.0 | 6.0 | 8.0 | 10.0 | 15.0 |
|---|---|---|---|---|---|---|---|---|---|
| 0.30 | 0.379 | 0.437 | 0.471 | 0.509 | 0.530 | 0.543 | 0.558 | 0.567 | 0.579 |
| 0.38 (CONVENTIONS) | 0.511 | 0.582 | 0.622 | 0.665 | 0.687 | 0.701 | 0.717 | 0.727 | 0.738 |
| 0.43 | 0.589 | 0.671 | 0.716 | 0.762 | 0.785 | 0.800 | 0.817 | 0.826 | 0.838 |
| 0.44 | 0.604 | 0.689 | 0.734 | 0.781 | 0.805 | 0.820 | 0.837 | 0.846 | 0.858 |
| 0.46 | 0.634 | 0.724 | 0.771 | 0.820 | 0.844 | 0.859 | 0.876 | 0.886 | 0.898 |
| 0.49 | 0.677 | 0.777 | 0.827 | 0.878 | 0.903 | 0.918 | 0.936 | 0.946 | 0.958 |
| 0.70 (clamp max) | 0.885 | 1.119 | 1.207 | 1.281 | 1.314 | 1.333 | 1.353 | 1.364 | 1.377 |

The overlap depth (2T − W) is 0.02–0.20 m for L in 2.5–15 m. L must exceed 2T + 0.3092/(2T), which is about 1.2 m. With
the corpus's T range (0.43–0.49), the failing body is **0.6–0.96 m wide**. Every such W is below the layout's 1.0 m
sliver floor (`max(1, 2·wallM + 0.2)`). So either the sliver gate did not run on this body, or the body arrived some
other way (see B-3). A W of 1.0 m or more is only possible if T > 0.5, which the 0.15–0.7 clamp allows. This is the
"narrow but legitimate utility space" case: such a body's own walls are usually drawn thinner than the house's (see
rary and arganiach above). `ring-overlap.ts` shows a 0.75 × 4 m body that validates at t = 0.25 and is refused at
T = 0.44 (0.4056 m²).

## 2. Findings

### B-1: CONFIRMED_DEFECT. One global wall thickness T for every body, and it can be a partition
- FIRST_BAD: `packages/reconstruction/src/plan-decomposition.ts: decomposePlan` (l.1858, `bandWallThickness(inside, …)`
  = length-weighted **median** of all in-extent bands), consumed at `v2/reconstruct-v2.ts: reconstructV2` l.418 as one
  `T` for every mass, and emitted by `v2/emit.ts` `tOf(m) = m.wallThicknessM ?? b.wallThicknessM`.
- Input: gozd (sealed): the in-extent bands are partition-heavy. 12 px = 0.304 m is the median, while every band on
  the four outer faces is 17 px = 0.431 m. In a01 the plain median of all bands is 10.25 px, and T happens to be the
  outer wall only because of the in-extent filter.
- Current behaviour: gozd's whole envelope is built with 0.30 m walls where the plan draws 0.43 m walls. That is 0.127 m
  per wall, so every inner face, room and reveal is off by that amount. In the other direction, an attached body whose
  walls are drawn thinner (rary attached-0 at 0.33/0.39 m, arganiach attached-0's west face at 0.15 m) gets the house's
  0.44/0.46 m. Only `thin-body.ts` DRAWN_THIN_WALLS ever sets a per-body thickness, and it runs only for bodies narrower
  than 2T that have no `pieceOf` and no `storeyRects`.
- Correct behaviour: take T from the bands on the outer faces (the per-body face bands are available and band-probe
  reads them). A body whose own outer faces are drawn at a different thickness should get its own `wallThicknessM`,
  not the median of the house.
- Test: none asserts that T equals the outer-face band thickness. `thin-body-n7-p2r.test.ts` covers only the
  thin-body path.
- Reproduce: `research/analyzer-n7-council/B/run-band.sh /tmp/…/councilB && cat /tmp/…/councilB/gozd.band.json`.

### B-2: CONFIRMED_DEFECT (silent). The layout and the emitter use two different wall thicknesses
- `layout.ts` l.1848: `wallM = plan.wallPx × max(mpp)`, where `plan.wallPx` is the whole-sheet median (`planSheet`
  l.508), against `reconstruct-v2.ts` l.418 T (the decomposition's median). In the corpus: a01 0.224 vs 0.427,
  trytomach 0.278 vs 0.448, arganiach 0.286 vs 0.457, sasankach3 0.273 vs 0.430.
- Effect: the sliver gate `minBodySpanM(wallM) = max(1, 2·wallM + 0.2)` (l.1950), `recutSlivers`, the
  `bayStripsOf` depth test, `tolM`, the spreads of SCALED spans and `outerWallAxes` tolerances all reason with walls
  about half as thick as the walls that are then built. Today the 1.0 m floor hides this for the ring overlap, but only
  because 2T < 1.0 in every corpus house (marcowki 0.98). With T > 0.5, which the clamp allows, a body the layout
  admits at 1.0 m is refused by the ring.
- The gate runs only `if (base.decomposition.envelope?.outline)`. On the long-band-box path no narrow-body test exists
  at all, so a 0.6–0.96 m body passes the layout and fails as WALLS_OVERLAP. Class: COVERAGE_GAP. It is not reproduced
  on the corpus (no corpus body is under 2T).
- Test missing: no test that a body the layout accepts is at least 2T wide on the emit side, or that the layout's wallM
  equals T.

### B-3: COVERAGE_GAP. `thinBodies()` checks the mass rectangle only
- `v2/thin-body.ts: thinBodies` l.99: it skips `pieceOf` and any mass with `storeyRects`, and it tests
  `min(x1 − x0, z1 − z0)` of the mass rectangle. `emit.ts` builds each storey's ring from `rectAt(m, storey)`. A storey
  rectangle narrower than 2T, or a piece, is never adjudicated and goes straight to `createWallRing`.
- The owner's `ring-attached-1-0` (storey 0 of attached-1) only escapes adjudication if attached-1 carries storeyRects
  or is a piece. This overlaps with the reviewers who own thin-body. Here it is noted only as the place where B-1's
  global T meets an unguarded path.

### B-4: CONFIRMED_DEFECT (metric). A false dimension registers a whole storey plan
- FIRST_BAD: the source-metrics registration for `frame-asset-rzut-f7e5dd139a` (arganiach attic, 853 × 853 like the
  ground sheet) rests on two anchors: a READ "71" cm over 79 px and a CHAIN_CORRECTED "42" cm over 47 px. Residual
  0 (one anchor per axis), confidence 0.66, giving 0.00899 m/px. The ground sheet is 0.02689 m/px, and the attic's
  metric solution itself is LEGACY_UNCONFIRMED / INCONCLUSIVE at 0.898 cm/px. The 42 is chain-corrected onto the 71's
  scale, so the two axes "agree" (anisotropy 1.006) from what is really one misread. This is a false consensus.
- Second bad: `layout.ts` l.839–842 builds `stated.k` from `other.registration` with no regard for its metric relation
  or confidence, and labels it "the scale both plans print on their own chains" (basis PRINTED_SCALE). `v2` then treats
  PRINTED_SCALE as a stated basis (`statedBasis`, reconstruct-v2 l.556), and the faces must yield to it. At l.2105 a
  non-SAME_PIXEL_SCALE basis is reported as `corroborated: true` **unconditionally**: the eight other offsets at the
  same scale corroborate it.
- Current behaviour: the attic is placed at scale 0.333 (NO_SUPPORT), and `registrations.plans` publishes storey 1 at
  0.008967 m/px.
- Effect on the model today: none observable. With the registration at the ground scale the attic is still NO_SUPPORT
  (`attic-scale-repro.ts`: walls 18 / slabs 2 / openings 16 in all three runs), so the attic loss in arganiach has
  another cause. Severity is therefore HIGH_RISK for any house whose upper plan would otherwise stack.
- Correct behaviour: a registration from a LEGACY_UNCONFIRMED/INCONCLUSIVE solution (or from fewer than three
  independent anchors) should never be a stated or printed scale. A same-size sheet in one publisher's set should test
  the SAME_PIXEL_SCALE hypothesis first, and a scale ratio far from 1 should need ratio evidence (a different raster
  size or a printed 1:n).
- Test missing: storey alignment with an INCONCLUSIVE `other.registration`. The corroboration flag has no test either.
- Reproduce: `npx vite-node research/analyzer-n7-council/B/attic-scale-repro.ts`.

### B-5: HIGH_RISK (function-level reproduced). An upper storey is registered by its faces with no cross-check
- `reconstruct-v2.ts` l.553–563: `byFaces` wins whenever `agrees`. `agrees` compares against the layout alignment
  only for a STATED/PRINTED_SCALE basis, and only in X. Every corpus upper storey is FITTED, WALL_PAIRS or
  SAME_PIXEL_SCALE, so the faces win unchecked, and their **offset** is never compared with the alignment. In marcowki
  the two registrations of the same sheet disagree by 3.4 % in scale and by 0.16 m (x) and 0.27 m (z) at the body's
  corners. The layout decided storey support with one of them and v2 reads storey-1 openings and interior with the other.
- `planFrameByOuterFaces` puts the sheet's outermost faces onto the largest body rectangle reaching the storey. A storey
  inset 0.5 m all round on a 10 × 8 m body passes the 3 % two-axis test at **10.5 % scale error**, which moves an
  opening 0.71 m (`inset-storey-faces.ts`). That happens whenever the layout's `rectAt` for that storey is not the inset
  rectangle.
- Bodies themselves come from the layout (storeyRects), so no body shift is reproduced. The risk is in upper-storey
  openings, interior and stair.

### B-6: HIGH_RISK. Elevation registrations with ground errors up to 0.9 m keep their horizontal scale
- `v2/frame.ts: registerElevationV2` accepts up to 0.9 m ground error at confidence floor 0.2. sasankach3 FRONT and REAR
  are registered at errors of 0.84 and 0.81 m: the 11.6 m span puts the ground at +0.24/+0.27 against terrain −0.57.
  Landing the ground needs a span about 9.8 % wider (eaves about 0.57 m each side).
  `viewGroundRefusals` refuses their **heights** only. Along-facade positions and widths still come from a horizontal
  scale that is wrong by the same factor if the apex really is the ridge. Facade alignment in sasankach3 shows 2
  HORIZONTAL_OFFSET and 2 WIDTH_MISMATCH. The cause is not isolated.

### B-7: DESIGN_LIMITATION / silent defaults
- The T fallback `CONVENTIONS.wallThickness = 0.38` (reconstruct-v2 l.418) writes no gap and no step. It is taken as
  fact. The clamp allows T = 0.7, at which any body narrower than 1.4 m fails.
- The `roof-datum.ts` ridge stacks on a conventional 2.8 m top floor (gozd: "not printed"). The 0.05–1.8 m height
  margin barely constrains F. The roof feature's ridgeY interval is ±0.02 while `uncertaintyM` is 0.3
  (reconstruct-v2 l.792). The parameter provenance correctly says ASSUMED_FOR_RENDERING.
- `metric-solution.ts` l.1454: a01 reports isotropy MEASURED with cmPerPixelX = cmPerPixelY = legacy = 2.030947, the
  same pooled number. This only affects the label; geometry uses the anchor registration (0.02031/0.02011, then
  face-to-face 0.02034).
- `planFrameV2` (frame.ts l.141–146) rescales the base face-to-face (a01 Y +1.2 %) about the 03R origin. This is fine
  while the origin sits on the west/rear face.

### NOT_A_DEFECT
- Anisotropic X vs Z scale: at most 0.6 % on every base plan. Upper frames agree to 0.3 % or better.
- SCALED mass spans: every one sits beside an unread chain. Nothing stated was discarded.
- The z flip (`worldFrameFrom`, `flipZ`, `planFrameV2`, `massPixelRect`) is consistent. Pixel round trips of the masses
  land on the band faces (band-probe matches faces within 1–3 px on all houses).
- The trytomach attic's printed-scale ratio of 1.39 is correctly REFUTED.

## 3. Function inventory (my path)
FILE → FUNCTION → INPUT → ASSUMPTIONS → POSSIBLE FAILURE → EFFECT → EXISTING TEST → VERDICT

- source-cv/bands.ts → dominantBandThickness/bandThicknessQuantile(0.5) → bands → the length-weighted median is the
  wall → partition-heavy plan gives a partition → T too thin (gozd −0.127 m) → none on this property → **DEFECT (B-1)**
- plan-decomposition.ts → decomposePlan (wallThickness) → in-extent bands, max(mpp) → one thickness per plan → thinner
  or thicker attached walls ignored → WALLS_OVERLAP on narrow bodies, or wrong faces → none → **DEFECT (B-1)**
- layout.ts → planSheet wallPx / layout wallM l.1848 → whole-sheet median → stands in for the wall → about half of T →
  sliver gate and tolerances are inconsistent with emit → none → **DEFECT (B-2)**
- layout.ts → minBodySpanM / sliver gate l.1950 → wallM → outline plans only → a non-outline narrow body passes →
  overlap refusal → none → **COVERAGE_GAP (B-2)**
- reconstruct-v2.ts → T selection l.418 → decomposition m → [0.15, 0.7] else 0.38 → silent fallback; 0.7 allowed → see
  B-7 → none → **SILENT**
- thin-body.ts → thinBodies → masses, T → only plain attached masses → storeyRects/pieces skipped → unguarded ring →
  p2r test (plain body only) → **COVERAGE_GAP (B-3)**
- emit.ts → ring from rectAt + tOf → per storey → per-body T only from DRAWN_THIN_WALLS → as above → p2r tests → OK
  given T
- model/topology.ts → wallOverlapIssues → physical footprints → convex clip → exact → owner area = (2T−W)(L−2T),
  verified → model tests → OK
- source-metrics registration (coordinateRegistrations) → 2 anchors, residual 0 → one anchor per axis is enough →
  misread plus chain-corrected copy agree → 1/3-scale sheet → none → **DEFECT (B-4)**
- metric-solution.ts → solve (isotropy, relation) → witnesses → MEASURED needs both axes → same pooled number labelled
  MEASURED → label only → **MINOR**
- layout.ts → plan alignment `stated` l.839 → other.registration → registration means printed → INCONCLUSIVE scale
  used as PRINTED_SCALE → wrong storey placement → none → **DEFECT (B-4)**
- layout.ts → scaleBasis.corroborated l.2105 → considered → — → always true for a non-SAME_PIXEL basis → misleading
  diagnostic → none → **DEFECT (diagnostic)**
- frame.ts → worldFrameFrom/flipZ → ground regions → front is the sheet bottom → — → — → indirect → OK
- frame.ts → faceToFaceMetresPerPixel → chain ladder, faces → faces within 2 px; ≤3 % → — → — → OK
- frame.ts → planFrameV2 → alignment → scale and offset from the layout → wrong alignment propagates → — →
  layout tests → OK (depends on B-4)
- frame.ts → outerWallFaces / planFrameByOuterFaces → raster, covers → the outermost faces are the covered body →
  inset storey accepted at 10 % error → upper openings off → none → **HIGH_RISK (B-5)**
- frame.ts → planFrameBySameSheet → both faces within 1 % → — → not used in corpus → — → OK
- reconstruct-v2.ts → plan frame choice l.548–563 → byFaces / aligned / sameSheet → faces trusted unless stated →
  unchecked offset and scale → B-5 → none → **HIGH_RISK**
- frame.ts → registerElevationV2 → silhouette, ridge, terrain → apex = ridge; err ≤ 0.9 → horizontal scale kept at
  0.84 m error → B-6 → n5/n3 tests on ground → **HIGH_RISK**
- roof-datum.ts → approximateRidgeDatum → knee, pitch, H, span → F may be conventional → wide margin → ±0.3 m ridge →
  unit tests → **DESIGN_LIMITATION**
- solve.ts → levelsFrom → section datums → fewer than 2 datums gives a 2.8 m convention (heights.measured false,
  reported) → — → — → OK (reported)

## 4. Silent failures (fallbacks taken as fact)
1. The T fallback 0.38 and the T median, with no gap and no feature uncertainty. T's provenance is never recorded per
   body.
2. The layout's wallM (about 0.22–0.29 m in 4/8 houses) silently drives the gates, while 0.43–0.46 m walls are built.
3. `scaleBasis.corroborated: true` is always true for a non-SAME_PIXEL basis.
4. The attic registration at 1/3 scale is published in `registrations.plans` with no gap.
5. The ridge interval is ±0.02 on an assumed datum.

## 5. Top 3 by impact
1. **B-1 + B-2: global, median-derived T (with a second, inconsistent layout wallM)**. This bears on total refusal and
   lost bodies: it is the direct arithmetic of the owner's WALLS_OVERLAP. With the corpus T (0.43–0.49), the owner's
   0.3092 m² means a body 0.6–0.96 m wide, which a per-body drawn thickness (or a layout gate using T) would have built
   or named. It also gives wrong dimensions in gozd (walls 0.127 m too thin).
2. **B-4: false-consensus registration of a storey plan (2 anchors, residual 0, INCONCLUSIVE) promoted to
   PRINTED_SCALE.** This bears on wrong storey count and wrong scale. Reproduced on arganiach (1/3 scale). The model
   effect there is masked by an independent NO_SUPPORT.
3. **B-5/B-6: registrations accepted without cross-checks.** Upper storeys are registered by faces with unchecked
   offset and scale (3.4 % and 0.27 m in marcowki; 10.5 % on the synthetic inset), and elevations keep their horizontal
   scale at 0.8 m ground error. This bears on elevation mismatch and on upper-storey openings and interior. No body shift
   is reproduced.
