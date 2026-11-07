# EXTERIOR-COMPLETE — campaign log (checkpoint)

Status: **WORK_IN_PROGRESS**. Main report: `stage-reports/STAGE_BUILDPLAN_EXTERIOR_COMPLETE.md` (written at the end).
This file is the durable checkpoint: after a context loss, read it top to bottom and continue from "Next action".

## Frozen evaluation (decided before any tuning, 2026-11-03)

- **DEV (13, every one counts, failures stay in the denominator):** the ten SOURCE-01 test houses (Arlety 3 E OZE,
  Jabłonki 22, Miniaturka 2 v3, Willa Maja R2, Dalie 5 GE, Azalie 3, Bratki 26 R2BE, Pod Miłorzębem 21 GB, Modrzewnica 10
  G2E OZE, Muraje) + the three SHAPE-LIVE-01 holdouts now used for diagnosis (Lipienniki 5, Aurory 26 G, Kostrzewy 4).
  Packages: `/home/user/work-s01/test-pkgs` (cache `/home/user/work-s01/cache`), `/home/user/work-sl/hold-base`
  (cache `/home/user/work-sl/hold-cache`).
- **Regression (8):** a01, arganiach, ciesz, gozd, marcowki, rary, sasankach3, trytomach (`/home/user/workfix02/base`,
  cache `/home/user/workfix02/cache`). Byte identity not required where geometry/palette improves for a stated reason.
- **Holdout H2 (blind, first evaluation after stabilising; sealed 2026-11-03, not opened):** jaskrzynach-7-g2e,
  renklodach-15-g2, zielistkach-23-a, kanzanach-3-g2e, narcyzach-14-b, wisteriach-15 (`/home/user/work-ec/h2`, cache
  `/home/user/work-ec/hcache`).
- **Holdout H3 (reserve for a re-holdout if H2 is used for a fix):** telimach-4-g2e-oze, balsamowcach-20-g2,
  skalnicach-3, wiesiolkach-3-ae, willa-edyta-r2be, modrakach-r2 (`/home/user/work-ec/h3`).
- Private work dirs are outside the repo (`/home/user/work-ec`); no publisher picture is committed.

## Acceptance (unchanged during the campaign)

Per house, from its own sources: a model exists; each characteristic element on the house's source list is present with
the right kind, side, size and relation (body/wing/garage/bay, roof orientation and parts, openings incl. gate and
entrance, balconies/railings, canopies on posts, dormers, rooflights, chimneys, facade bands/frames); no spike, no floating
wall, no refusal removing an element, no ERROR in the final compile; palette approximate and stated.

## Results log

(entries appended below, newest last)

## Next action

See the last entry.

### E0 — baseline on the frozen checks (code 80d5612, runs `/home/user/work-sl/po-test`, `po-hold`)

Checker `research/exterior-complete/check.py` against `stage-reports/artifacts/exterior-complete/expectations.json`
(derived from `source-elements.json`, written from the sources before any model was judged): **25/70 checks, 4/13
houses without a model** (Kostrzewy, Pod Miłorzębem, Muraje: PLAN_RESOLUTION_INCONCLUSIVE; Modrzewnica:
PLAN_NO_DIMENSION_FRAME). Failing classes: gate kind/entrance doors (Arlety, Dalie, Lipienniki, Bratki), rooflights missing
or refused as overlapping (Arlety, Aurory, Azalie, Dalie; Miniaturka/Jabłonki refusals), balconies/railings (Willa Maja,
Bratki), canopies/posts (Azalie, Aurory, Kostrzewy, Modrzewnica, Bratki, Miniaturka, Dalie), dormers (Jabłonki), wings
(Jabłonki rear, Dalie front), ridge axis (Aurory), chimneys (Lipienniki).

### E1 — rooflight dedupe, gate and door by their elevation face (solver-only loop, `/home/user/work-ec/it4`)

- Rooflights: two readings whose footprints meet on one slope are one rooflight (and none shares the roof with a chimney):
  the render-read duplicates that were refused as `ROOF_OPENINGS_OVERLAP` (Miniaturka 1, Jabłonki 2) are no longer emitted.
- `openingFace` (opening-reading.ts): neutral share, luma spread along a row, saturation, warmth inside an opening on a
  registered elevation (measured: gate 0.98/1.8/8, glass 0.51–0.58/13–26/19–26 warmth −20, timber sat 55 warmth +54).
  GARAGE_DOOR when ground storey, to the floor, ≥ 2.2 m, ≤ 3.2 m tall, OPAQUE_PANEL face and a published garage area;
  DOOR when door-sized and the face is an opaque or timber leaf. Views refused for opening heights still give the face.
- Gate geometry: a GARAGE door is a stack of 0.55 m sections with grooves over a backing plate, `usage: GARAGE`, `mat-gate`.
- Checks: 25 → 26/70 (Arlety gate). Bratki's front doors: no front view registers (semi-detached elevation) — open.
- Running: `/home/user/work-ec/rec1` = Muraje, Pod Miłorzębem, Modrzewnica with the phone's OCR recogniser (`--recogniser`),
  to see whether the APK path reads the plans the desktop path refused.

Next action: read rec1; then the four failed plans; then balconies (Willa Maja, Bratki), canopies/posts, dormers, wings.

### E2 — Muraje and Kostrzewy get a model; Muraje's ridge and levels; a blind is not a panel

- Dimension lines (`source-metrics/dimension-lines.ts`, `joinOccludedLines`): two collinear runs on one baseline and of
  one thickness, separated by ≤ 40 px that something drawn over the line covers (≥ 80 % non-paper), are one line; the
  facing marks were the occluder's edges, not ticks. A logo over Muraje's 1020 overall bound it to 412 px instead of
  660 px; Kostrzewy's plan read the same way. Both houses now produce a model (were PLAN_RESOLUTION_INCONCLUSIVE).
- Ridge datum (`roof-datum.ts`, `topDatumBelowPublishedHeight`; `section-datums.ts`, `riseAtShare`): the highest datum
  read is not the ridge when the published building height leaves more than a roof build-up above it AND the section
  draws ink at least half that high above it across 30 % of the building's width (a chimney is narrow and refuses
  nothing). Muraje's +5.50 eaves had been the ridge (the 30° roof rises 2.17 m: under the 1.5 m × 30 % drawing test);
  now levels 0 / 2.88, ridge measured on the drawing ≈ 7.58 m (source +7.67), ridge parallel to the front.
- Vertical text orientation (`metric-solution.ts`, rule vii): a chain nothing decided takes the way up the sheet's
  other vertical chains were decided on (≥ 2, 3 : 1), through the other axis's scale and marked as depending on it.
  Muraje's 740 overall depth (read 740, p 0.9999) had stayed UNDECIDED because 476 px at the X scale misses by 2.8 px
  on a sheet scaled 0.6 % unevenly; its depth came from an interior 410 chain (6.63 m instead of 7.40 m).
- Opening face: a panel must be one tone down its height too (≤ 25 % of rows > 24 luma off the median row): glass
  behind a striped blind is flat along each row and had read as an opaque door leaf (005W fixture caught it).
- Solver loop renders: `second-house.ts --views` compiles the solver-only model with the production compiler and
  writes the four-camera sheet and the compile diagnostics.
- Open on Muraje after this: the entrance door and the gate stand under the overhanging upper floor, recessed ~0.45 m;
  the plan's front wall there is read as a 5.27 m gap (a strip window), and the callouts (105/210, 275/225, upper
  110/210, 180/210 French windows with railings) are not read.

### E3 — recessed entrances, balconies behind a balustrade, every camera, checker vocabulary (dev loop `dv4`/`dv5`)

- Recessed entrance with an empty mouth (`compound-facade.ts` 1.1.0): a facade gap with no wall ink inside it was "one
  gap", and a line drawn across it (the floor's or roof's edge over the porch) made it an opening in a wall that carries
  on — the porch was built over as a room with a 4 m window. The whole gap is now tested as one interval by the 005N
  recess rule (returns at both jambs, a set-back wall behind); otherwise the incumbent reading stands unchanged.
  Kostrzewy: window / door / window in the porch's back wall instead of one 4 m glass pane; Lipienniki: the porch.
- Porch cells (`plan-decomposition.ts`): in a recess no deeper than `PORCH_MAX_DEPTH_M` (2 m, no room fits), a cell
  wholly between the mouth and the back wall is the recess even when ink across its front (step, callout ring) sealed
  it; never a garage (4.5 m deep), never the facade wall's own band. Lipienniki's porch now spans its whole 4.19 m mouth
  (it had lost the 105 door).
- Back-wall openings are read on the face's elevation (orthographic: the back wall's openings are drawn where they are
  along it).
- Balconies behind a balustrade (`projecting-balcony.ts`, `behindBalustradeGroups`): upper French windows whose sill the
  elevation reads at the balustrade's top (≤ 1.2 m) and whose head stands at a door's (≥ 2 m) are tried for the plan's
  balcony outline, and confirmed by a balustrade the face's elevation draws across them; they then reach the floor.
  Willa Maja: rear balcony + railing (6/6); Bratki: rear balcony; Dalie: the gable balcony on the side (on its source list).
- Renders: `scene-all-sides.png` (front, right, rear, left, top, four corner axonometrics) beside the four-camera sheet;
  `board2.py` (private) puts source exteriors + every elevation over the PRZED and PO sheets.
- Checker correction (`check.py`, stated here because it changes a count): posts are any supporting post (`POST`,
  `COLUMN`, `PERGOLA_POST`) and posts/canopies are judged on their side; the first version counted no pergola. Azalie's
  side pergola on posts was in the model and was failed by the checker.
- Two analysis-service tests had been broken by E1 (`commandIndex` 21 → 22: the gate material is one more command);
  the expectation is updated with that reason.
- Versions: service 1.8.0, solver 2.22.0, metric reader 1.6.0 (dimension topology 1.3.0, metric solver 1.5.0),
  compound facade 1.1.0.
- Dev loop (solver on saved evidence): 31 → 32/70 with the corrected checker. Full production path at E2 code: 29/70.
- Open and found: Muraje's 740 depth is still refused (isotropy assumed; 6.63 m instead of 7.40 m) and its door + gate
  stand in a corner notch no reader takes; Kostrzewy's middle back-wall opening reads as glazing (the door); Aurory's
  ridge axis (the section's rise fits both spans once the eave datum is the overhang's lip); Arlety's rooflight ring
  (printed 78/140) is misread 217/140 and refused; Rary's front 105/210 now reads as a floor-length window (a callout
  newly read on a gap the plan draws glazed) — to be checked against the elevation before delivery.

## E4 — delivery 1315 checked against the regression houses; finish per storey

- Delivery 1315 (commit `845b13a`): `BuildPlan-owner-preview-1315.apk`, `com.buildplan.preview` / 1315 / `0.1315.0-owner`,
  SHA-256 `1e2a93c7ba8e9789487b186d0b2b9ac810cfcabfb7449ac5aad314c77c969745`, signer
  `6e48fac4…ca0da` (unchanged), embedded `analyzer.mjs` `6b6b671b97272d8c298e8481f5604f10df7075e6f19a72eca9d9a85dfce7ec0e`
  (service 1.8.0, solver 2.22.0; 10/10 asset manifest entries match). Live smoke on the APK's assets (Muraje live page,
  host Node 22 x64 — not a phone): first sheet 13.9 s, done 314 s, 129 events, 32 sheets, 121 copies SHA-verified,
  0 mismatched, copies removed, model hash `db38772602a0828a` = the desktop run; peak RSS 888 MB (host).
- Full production path at `845b13a` (f2): 32/70 on the frozen DEV checker (E0 25/70; SHAPE-LIVE final 26/70).
- Regression 8 (f2 vs SHAPE-LIVE final): marcowki, trytomach identical; ciesz eave 3.32 → 3.30; arganiach one window →
  door; gozd 4 windows → doors with heights from callouts (2.2/2.3 m); rary front 105/210 → floor-length window (the
  render shows a glazed panel beside the door: plausible); sasankach3 eave 3.69 → 4.04, the garage now a sectional gate;
  a01 eave 4.87 → 4.68, side and rear windows now as the elevations draw them (two tall gable windows, rear roof windows).
- **First wrong decision found on the a01 board:** its walls turned grey to the ridge. The ground storey of a01 is grey
  (the reading was right) but the ground storey's tone was painted on every storey of the body, and its attic is white.
  Fix (`tones.ts`, solver 2.23.0): each storey is read in its own band, with the same masks. Under a pitched roof (the
  body's own: the main roof, or the attached body's gable) an upper storey's band ends under the eave on the gable ends,
  and on the eave sides (every side of a hipped roof) under the overhang's drop too — overhang × tan(pitch), the
  overhang the section reads or the largest an eaves may have (`EAVES_OVERHANG_M.max`, 1.5 m) when none was read: a
  sampling margin, never a model dimension. A knee wall under the drop is then not read; a full storey wall under a
  high eave is. A balcony on that storey and a lower body nearer the viewer whose pitched roof rises into the band are
  masked like a nearer body. A storey not read keeps the ground storey's reading, as every storey did before.
  Three intermediate versions were rejected on the boards: eave clipping alone read Arganiach's and Trytomach's attics
  dark (the eave sides sampled the roof); the main roof's axis on Sasanki's attached wing read the wing's roof; gable
  ends only lost Muraje's grey upper storey (only its front, an eave side, is registered).
- Effect (same f2 evidence, solver alone): a01 attic white over a grey ground storey; Muraje grey upper storey over a
  white ground storey; Sasanki main attic MID (its gables read 0.75 of the render's white against 0.95 below — the
  elevations show a light-grey gable over white); the other 18 houses identical in walls; checker unchanged 32/70 (it
  does not score finishes).
- Test of the cause: `storey-tones-exterior-complete.test.ts` (7 cases; the first fails on the old reader).
- Sliverton (`wall-recovery-n7-fix01`) had been red since E1 (command index 21 → 22, the gate material) and was missed
  in E3 — it fails identically at `845b13a`; the expectation is updated with that reason.

## E5 — a unit drawn beside its faded neighbour; a leaf with a strip

- Private delivery for 1315 built outside Git: `BuildPlan-EXTERIOR-COMPLETE-Private-1315.zip`, 792 files, SHA-256
  `e3754813cd7d959cea78f676f42e1d0dd6faff0a5874626de548d27bbf328cbe` (PO `program.json` regenerated at `845b13a` on the
  f2 evidence: 19 houses, every model hash equal to the full run's).
- **First wrong decision (Bratki):** the front and rear elevations draw both units of the pair — the unit in full
  contrast, its mirror image washed out — so the silhouette spans 2 × the plan's width (794 px at the ridge scale ≈
  14.8 m against 7.34 m), fits no span, and both views were refused: the front openings were built from the plan at
  assumed heights, the rear balcony was never tried. Fix (`twin-elevation.ts`): when a silhouette fits no span, its two
  halves' luma spread over the walls is compared; a half drawn with under half the other's spread is the neighbour, and
  the unit's half is registered exactly as a silhouette (taken only when it fits). Two halves drawn alike are not split.
  Bratki: front 71.6 / 28.2 → the left half, 0.0185 m/px; rear 28.2 / 74.6 → the right half (the mirror), 0.0186 m/px.
- **Second (Bratki):** the unit's two front doors — a dark leaf with a narrow glazed strip and a long handle — read
  UNCLEAR (spread along a row 45–51) and were built as floor-length windows. Fix (`opening-reading.ts`): a neutral face
  whose median column changes by at most 8 (luma std) down its height is one opaque leaf. Measured on four houses: the
  Bratki leaves 2.7 and 4.0; every other neutral face (windows, gates, glazing in shade) 16–29.
- Effect (same f2 evidence): Bratki window + 2 doors on the front, rear balcony + railing (checker 1/5 → 4/5); Rary's
  front 105/210 is a door again (as before E3; printed where the entrance is); the other 19 houses identical in doors,
  windows, openings, balconies, railings and walls. Checker 32 → 35/70.
- Checker correction (`check.py`, stated because it changes a count): a railing that turns is judged by its longest run
  (along the facade), not by the chord between its two ends — a U round a balcony starts and ends at the wall, so its
  chord lies inside the house. A first version (the outermost run by midpoint) moved Willa Maja's rear railing to a side
  leg and was rejected. With the correction: PRZED 26/70 and f2 32/70 unchanged; E5 35 instead of 34 (Bratki's rear
  railing).
- Tests of the causes: `twin-elevation-exterior-complete.test.ts` (pair left/right, halves alike not split, a leaf with
  a strip, neutral glass is not a leaf). Solver 2.24.0.
- Not yet: Bratki's thin glass canopy over the doors; Miniaturka's "canopy" is a small gabled timber porch roof ~0.8 m over the door head — a
  different element from a plate, not read.

## E6 — test delivery 1316 (E4 + E5)

- Commit `53d49021893580fc92b8603d1ab4f05bd1feb1cf`. `BuildPlan-owner-preview-1316.apk`, `com.buildplan.preview`,
  versionCode 1316, `0.1316.0-owner`, arm64-v8a, 49 419 503 B, SHA-256
  `2feb7e8e5067ecff3dcc4efc5448edc14f3758a9b09b081410f99e77d4d3f72f`; signer
  `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (unchanged); embedded `analyzer.mjs`
  `8c275584d5f84193baa998796a6facb34ce83bafdb9a7ea0acf92fbbbb7675e9` (service 1.8.0, solver 2.24.0, protocol 3);
  10/10 asset manifest entries match.
- Live smoke on the APK's assets (Bratki live page; host Node x64 — not a phone): first sheet 13.4 s, done 281 s,
  124 events, 27 sheets, 116 copies SHA-verified, 0 mismatched, copies removed; model hash `f5d5402a…3be2` equal to
  the desktop run; peak RSS of the process tree 868 MB (host).
- E4–E5 change the solver only, so the desktop solver on the full-run evidence is the production result: checker
  35/70 (PRZED 26/70, 1315 32/70).
- Private delivery outside Git: `BuildPlan-EXTERIOR-COMPLETE-Private-1316.zip`, 798 files, SHA-256
  `0ec3138e901fc7a87d997584e027c3b058734c2f2100b49f4d9dd5bc85d5fbfe` (PO models, programs and all-sides renders at
  solver 2.24.0, boards PRZED/PO, acceptance per house, live-smoke evidence, build log, limits).
- Android UI NOT_VERIFIED (no device).

## E7 — Bakopy (G2E), disclosed by OWNER: DEV, not a blind result

- Input authorised by OWNER for this project only. H2 stays sealed. Source feature list written from the originals
  before any fix: `stage-reports/artifacts/exterior-complete/source-elements-bakopy.json`.
- **PRZED reproduced on the 1316 code (`53d4902`) from an own acquisition of the live page** (Node fetch worked here),
  full production path (content encoder + local OCR recogniser): 32 assets, 3 bodies, 19 openings, 170 commands,
  model hash `e2c66ccac7f2a629badd9998f15d57fdfc2c34a9c3ee87473aec789a236cf63d` — byte for byte the coordinator's
  replay. (A first run failed INTERNAL_ERROR: the side worktree lacked the untracked content-classifier model; copied
  from the main checkout, hashes equal to the APK's, and the run repeated — an environment fault, not a code one.)
- **First wrong decision (garage lost):** the gate rule (`shutGateBays`, N7-FIX-03) never weighed the garage. The
  plan draws a row of built-in cupboards (X) along the garage's back; the grid line the house's front face runs on is
  their front, drawn as line work, and the wall that closes the garage (a 0.23 m partition, with the door into the
  hall) stands 0.4–0.8 m behind it. The rule read wall only on cell edges: back side 27 % walled → "not three walls" →
  silently skipped. The coordinator's two hypotheses (H0/H1) were equal because neither reached this rule.
- Fixes (`plan-decomposition.ts`, general, no house names):
  1. a side whose edge carries no wall is walled where, walking out from the edge no further than a lining's depth
     (`GATE_BAY_LINING_MAX_M` 0.9 m) plus the wall itself, the walk crosses ink at least a third of a wall thick
     (cupboard lines are 1–2 px and never count); the 0.85 continuity bar is unchanged;
  2. a doorway in that wall (a run ≥ 0.6 m and no wider than a door, wall at both ends, built cells behind) is the
     evidence "a door leads from it into the building";
  3. an opening-callout ring (a circle split by its bar) printed in a wide mouth, read or not, says the hole is an
     opening in a wall that carries on as its jambs: the piers are then read off the ink as for a door-sized hole, and
     the ring is gate evidence. Bakopy's ring 500/225 is found (centre 176,714) but its digits are refused by the OCR
     gates (unstable) — the symbol is enough, the digits are not used. Without a ring a wide mouth keeps its band-only
     jambs: the first version read every wide mouth's piers off the ink and turned the 005F carport fixture (short
     piers, a door from the house) into a garage — caught by `extent-envelope-orientation`, rejected. Where the bands
     show no hole at all the ink's hole is the hole (a "0 m hole" no longer passes as door-sized evidence — found by
     the cause test). The wall behind a lining is read only through an edge that is a lining's front (line work on
     it, no opening in it): a doorway on the edge is a hole, never a lining with the house's ink behind it;
  4. a shut garage's edges to built cells are barriers to largest-first tiling, like facade seams: without it the
     garage and the west wing became one strip cut through the bedrooms (145.6 m² against 227.9 printed → refused).
- Result on the same evidence: garage 6.82 × 6.25 m (printed 690 × 625) with its sectional gate (4.86 m hole,
  printed 500) and the entrance door beside it; main body 8.69 × 15.00, wing 6.23 × 8.60 (printed 640 × 860).
- Regression: all 19 modelled houses byte-identical (model hashes) after rules 1–4 (final form, see below).
- Test of the cause: `gate-bay-lining-exterior-complete.test.ts` (built with a door behind the lining; left open
  without one; a wall further back than a lining is not the back wall). The first case fails on the old rule.
- Still wrong on Bakopy (next): the garage and the open covered approach are not under the long main roof (flat roof
  of their own); the living wing's cross gable is read flat (both side views refuse the main-roof anchor by 0.86–1.37 m,
  so no attached roof is read); front and rear elevations are not registered; the small planter at the north edge is
  a body (0.46 × 1.57 m) — removed before emission but still in the decomposition; the ridge datum "+6,28" read
  correctly is "chain-corrected" to 6.18 by the level ladder (its rule drawn 6.4 px off the ±0.00/+3.27 scale) — 10 cm,
  recorded, the ladder's tolerance not loosened; the opening callout 500/225 on the garage front line is not read as a
  ring; "71" in the kitchen chain is a misread "124" bound to a 20 px span that agrees with the chain's scale.

## E8 — test delivery 1317 (E7: Bakopy's garage)

- Commit `cf6a8d9df97f040ff8aa9e5f65c7c6b69a7d27b6`. `BuildPlan-owner-preview-1317.apk`, `com.buildplan.preview`,
  versionCode 1317, `0.1317.0-owner`, arm64-v8a, 49 421 131 B, SHA-256
  `6388302f17ab3a21fffc103840fba1f5beaab44dc187ab0cc9335d7d01616b97`; signer
  `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (unchanged); embedded `analyzer.mjs`
  `848937d0d95b2e44d05077e78d5f564591210772f083fffe8b144576e195b238` (service 1.8.0, solver 2.25.0, layout 1.4.0);
  10/10 asset manifest entries match.
- The real embedded path (the APK's analyzer bundle, host Node x64 — not a phone) on Bakopy's live page: first sheet
  14.2 s, done 243 s, 114 events, 32 sheets, 106 copies SHA-verified, 0 mismatched, copies removed; model hash
  `7c1acde78e1a1c2206fca9767434caf781f3e6d026fe42cf63b811aea6befa91` = the desktop PO (garage built); peak RSS of the
  process tree 962 MB (host).
- Checker on the 13 frozen DEV houses unchanged 35/70 (Bakopy is outside that frozen list; it is judged by its own
  source list, below).
- Bakopy against its source list (`source-elements-bakopy.json`), PO: storeys ✓, outline 1500 × 2125 ✓ (bodies
  8.69 × 15.00 + 6.23 × 8.60 + 6.82 × 6.25), main body ✓, living wing (footprint) ✓, garage ✓, garage gate ✓
  (sectional, 4.86 m), entrance door beside it ✓; NOT YET: main roof over the garage and the open covered approach
  (each has a flat roof of its own / nothing), the wing's cross gable with its tall glazed gable (flat), the
  approach's post and slat screen, the pergola terrace roof, chimneys, the timber gable cladding (wall tone only);
  ridge 6.18 against the printed 6.28 (ladder correction, recorded).
- Private delivery outside Git: `BuildPlan-EXTERIOR-COMPLETE-Private-1317.zip`, 862 files, SHA-256
  `e20e7099e39fe24f5e9ffe24882009b20041432c6d926b693cb17de1bb2a0745` (Bakopy originals with hashes, PRZED/PO models,
  programs, plan diagnostics and all-sides renders, board, source list; regression PO at 2.25.0; live-smoke evidence).
- Next concrete action: the side views' main-roof anchor (`topResiduals` in `side-orientation.ts`) reads dark tree
  canopies behind the roof as its top (0.86–1.37 m above the ridge on both Bakopy side views), so every attached roof
  form is refused as "not seen against the sky"; a vegetation test that holds dark foliage, with the 21-house
  regression (it also drives side orientation), then the main roof's run over a front body under the same ridge.
- Android UI NOT_VERIFIED (no device).

## E9 — Bakopy's roofs, the three checks the coordinator asked for (checkpoints 5–8)

- **Callout ring with unread digits** (`shutGateBays`): the ring is gate evidence only where it stands in the hole the
  ink jambs leave, on the mouth's line; tests now pass `rings` (in the mouth: built; a carport between short piers with
  no ring: open; a ring in the room or over a pier: no evidence). The ring's digits are never a value.
- **False second gate** (`opening-0-rear-6-0`, wing's 400/230 glazing): first wrong reading — the recogniser read
  "230" stably but under its own gate, the template's near-tie "290" stood alone (Arlety 105/210 and Lipienniki 80/230
  are the same pattern, template wrong each time); the template's reading now carries the recogniser's as an equal,
  named rival (never in its place). First wrong classification — a wide opening to the floor in a low attached body
  was a vehicle door by width alone; it now needs a garage room's wall or an opaque face read as one panel in each
  third of its width. Where no room number is read, the one listed garage binds to an attached body by floor area
  only when no other attached body comes within twice the tolerance (Rarytasy: bound; Bakopy: wing 40.58 / garage
  32.8 m² against 38.01 — not bound, ambiguity recorded).
- **Ridge +6,28 → 6.18**: the level ladder substituted a clean reading 6.4 px off a line two other rungs fix exactly.
  A near miss (≤ 2 tolerances) now keeps the clean reading on such a ladder; on one three or more other rungs
  over-determine, substitution is as before. Checked against the printed sheets: Bakopy +6,28 ✓; Willa Maja +2,96/+7,98
  and Arganiach +7,99 (OCR read 4 for 9) still corrected ✓; the first attempt ("three other rungs") broke those two and
  was replaced; a second attempt fixed Bratki (+2,96) and Dalie (+3,06) but broke a synthetic misread on four rungs and
  was replaced — Bratki/Dalie stay at 1317 (2.86 / 3.00), recorded open.
- **FIRST_BAD for the dark crowns** (shown on both Bakopy side views): the profile walk stopped on olive (157,163,63)
  and near-black (0,2,0) crown pixels and sky cut off from the flood, 0.9–1.4 m over the ridge, so every attached
  body's view was refused. `elevation-background.ts`: vegetation by neighbourhood (plant hue/saturation, textured), sky
  seen through it; a 0.3 m solid run under the top. Dark roof, chimneys and the timber gable stay (test). Side views
  then agree on the main roof (offset 0.137 m both).
- **Front/rear renders** whose straight-edge outline fits no span are measured again against that background (largest
  region over the ground line, paving cut, chimney blocks and flecks out of the top) and taken only when they fit a span:
  Bakopy front and rear register (rear keeps ~0.4 m of crown at its top: recorded); Muraje's garden elevation registers
  (10.2 m span, ground −0.31 at a terrain of −0.30).
- **Roofs**: `UNDER_MAIN` — a body whose top is level at the main ridge, along it, within the main roof's width at an
  end of its ridge, is under the main roof run on: Bakopy's garage and the covered approach under the long roof. The
  wing reads a cross gable on the registered front/rear (2.81 m against 3.01 m at the stated 35°).
- An opening read on an elevation has its sill below the storey's wall head (the garage gate was read in the timber
  gable above it once the gable was the garage's).
- Regression (full path t13 + solver t15 on the final code; Bratki/Dalie full path again): checker 35/70 (unchanged);
  10 houses byte-identical to 1317; changed and judged against the sheets — Muraje (garden-view heights; a false
  sectional gate on its terrace glazing found and removed), Ciesz/Aurory/Trytomach (heights read on registered views
  instead of assumed), Marcówki (2.30 → 2.28 m), Rarytasy/Sasanki (notes only).

## E10 — test delivery 1318

- Commit `a79bcea44885ed665e2ac833286ba147f8fa6fe8`. `BuildPlan-owner-preview-1318.apk`, `com.buildplan.preview`,
  versionCode 1318, `0.1318.0-owner`, arm64-v8a, 49 426 683 B, SHA-256
  `34bc9bb2e68801e188e61d9f3093d76b93fc932478741daa5212f739b26e5505`; signer
  `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (unchanged); embedded `analyzer.mjs`
  `faafc789cab6709c7650304ace4034f54d3d32a3b8fc82c068cb669681079ab7` (solver 2.26.0, metric reader 1.7.0); 10/10 asset
  manifest entries match.
- Embedded path (the APK's analyzer bundle, host Node — not a phone) on Bakopy's live page: first sheet 15.7 s, done
  288 s, 114 events, 32 sheets, 106 copies SHA-verified, 0 mismatched, copies removed; model
  `b1099a1d905b0ca53f2aa8d080e212274b94b472ab7186c53cb7b96cbc15e031` = the desktop PO; peak RSS 990 MB (host).
- Tests on `a79bcea`: 3375 pass, 17 fail — exactly the recorded baseline (architecture 11, analyzer-api 4,
  local-analyzer 2).
- Bakopy against its source list, PO: main body, garage, gate (front, sectional), entrance door, wing — as in 1317;
  NEW: one long main roof over the garage and the covered approach ✓; the wing's cross gable ✓; ridge 6.28 (printed) ✓;
  no second gate ✓. NOT YET: the wing's tall glazed east gable (two windows and a low strip instead), the rear glazing
  built 2.9 m (printed 400/230; 230 kept as a named rival, no registered view decides it), the approach's post and slat
  screen, the pergola terrace, the timber gable cladding and grey/timber palette (the garage gable renders dark).
- Private delivery outside Git: `BuildPlan-EXTERIOR-COMPLETE-Private-1318.zip`, 893 files, SHA-256
  `cd5942b09cecb0dc3fa792e2006eef8bfbf32dec134753b00c1203771ecd849d` (all houses' originals with hashes, PRZED = 1317 /
  PO = 1318 models, programs, all-sides renders, boards; Bakopy PRZED/PO with full-path evidence and board; checker,
  tests, APK build and live-smoke evidence).
- Next concrete action: the wing's gable end — read the gable glazing on the side view in front of the main roof
  (the side views see the wing's gable against the main roof, not the sky); then the wall palette per facade zone
  (timber gable over grey), the approach's post and the pergola.
- Android UI NOT_VERIFIED (no device). H2 still sealed.


## E11 — Zefiranty (G2 ver. 2), disclosed by OWNER: DEV, not a blind result; Bakopy's partial preview; test delivery 1319

- Case: https://www.archon.pl/projekty-domow/projekt-dom-w-zefirantach-g2-ver-2-m91f1f8409e8e1, this edition only.
  Independent feature list written from the originals before any comparison: `/home/user/zef/features-zefiranty.md`
  (private, F1–F17). Page: footprint 170.83 m², height 9.02 m, 38°, knee wall 90 cm; section +8.55 / −0.47 (9.02 is
  from terrain, the section's ridge from ±0.00 — one datum each, not substituted).
- **PRZED (1318 code, own acquisition, full path; kept):** RECONSTRUCTION_FAILED / METRIC_RESOLUTION_INCONCLUSIVE in
  REGISTERING_VIEWS (the coordinator's run: PLAN_RESOLUTION_INCONCLUSIVE, the same chain of causes one step later). No
  model. Stays in the denominator. After using its errors for diagnosis, no later Zefiranty result is called blind.
- **FIRST_BAD 1 (metric reader, `dimension-lines.ts`):** the rear terrace's double arc crosses both top dimension lines;
  every crossing was a TICK, so the overall `1452` (read correctly by the recogniser) bound to the arc's own ~131 px
  interval (~11 cm/px, REJECTED) and `1142` likewise. Fix: CROSSING_OUTLINE (dimension-lines 1.4.0). A mark is an
  outline across the line, REJECTED, when its stroke traces at least two mark reaches out on both sides and either side
  slants: the drift from its first traced row to one reach is ≥ 0.15 of that run, so is the drift from one reach to the
  end of the run, both the same way, and the tail (1.5 reaches to the end) is still moving, not parked. Exempt: a
  straight line through the mark (a witness line, square for the whole run on one side and in line for a reach on the
  other), and a mark under a printed label, whose glyphs are judged as text. A twin DUPLICATE of an outline inherits the
  verdict. **Tuned on DEV sheets:** the bound and the share were set on Zefiranty, Kostrzewy and Bratki and checked mark by
  mark (ticks end within one reach, 6–7 px; arcs and chairs run 18–21 px; on Kostrzewy a dashed void cross, a hatch band
  and a diagonal stroke are rejected; an extension line meeting a neighbouring arrowhead, a jogged chain end and a faint
  witness line are kept; on Bratki a window jamb's parked tail is kept). A stricter share (0.25) and a pace check were
  tried and dropped: they kept Zefiranty's arcs and chairs as ticks. DEV results after this tuning are not independent
  evidence; H2 stays sealed.
- **FIRST_BAD 2 (metric solver, `textRegions`):** the overall and the chain number stacked 24 px apart were joined into
  one text region by two rotated misreads spanning both ("212", "513"): one ink read two ways witnesses nothing. Fix:
  two tokens one pass read apart are two inks; no third token joins their regions.
- **FIRST_BAD 3 (same reader):** garden chairs drawn over the right-hand vertical chain made 20 px stubs at its top end
  that were trimmed, cutting the plan's extent off below the rear wall, so the rear rooms flooded as outside. The
  CROSSING_OUTLINE rule removes them; the extent now reaches the rear wall.
- **FIRST_BAD 4 (roof datum, `roof-datum.ts`):** the only section is 400×300 px; its level marks are ~7 px glyphs, below
  the legibility gate (not loosened), so no ridge datum, no registered elevation, no main roof. The approximate-ridge
  rule answered gables only. A hip pitched alike on every side rises over half its body's shorter span — geometry — and
  the published height checks it as it checks a gable: ridge 8.16 m (ASSUMED_FOR_RENDERING; the section draws +8.55,
  not read). Elevations stay unregistered (printed datums only, by design).
- **FIRST_BAD 5 (hip held as a gable):** the stated hip was kept a gable because the four plan rooflights were bound to
  the gable's slopes. Fix: a rooflight whose whole plan footprint lies in one plane of the hipped layout is re-homed
  there (`rooflightPlaneKey`); across a hip's line it still holds the gable.
- **Zefiranty PO:** model `82cde3d5…8b97` (desktop = embedded bundle on the live page); scale 2.5656 cm/px SUPPORTED
  (REPLACED the 3.86 page vote), 7 anchors, rms 0.02 m; footprint 153.3 m² (−10.3 %, the garage's front strip
  missing); main hip 38° with its short ridge and 4 rooflights in their planes. Against F1–F17: F1 ✓ (hip, short ridge);
  F9 partly (4 of the elevations' ~12 roof windows, from the plan); everything else NOT YET: F2 garage under its own
  lower roof (the garage is split along the house's lines and has no roof of its own), F3 the lower roofs at the attic
  band, F4–F6 three gabled dormers (one with balcony and balustrade, F17), F7 the curved eave, F8 valleys, F10 three
  chimneys, F11 the rear terrace is a terrace (correctly not built as a bay), F12 arched windows, F14 corner glazing
  (read as CORNER_GLAZING in the plan), F15/F16 palette. MODEL→SOURCE additions: a 2.2 m wide flat-roofed strip on the
  garage's west side (a piece of the garage), a ridge 0.39 m below the drawn +8.55.
- **Bakopy:** with the "71" chain now UNRELATED (`thin-body`: a chain printed inside the house more than 1 m off a thin
  band's length measures its own line), attached-2 is read FALSE_STRIP alone; such a strip — no buildable reading, no
  printed conflict, no registered elevation showing anything built — is now NOT_A_BODY, named and not built. Bakopy is
  COMPLETE_WITH_OPEN_QUESTIONS with 0 refusals (was PARTIAL, 1 refusal, 7 objects skipped); the model's geometry is
  unchanged. A first attempt (a sliver rule in the layout) was reverted: it dropped thin bodies before the thin-body
  pass adjudicates them on the source (9 tests of N7-P1/P2R/FIX-01/02 failed).
- **Bakopy "flat roof" seen by OWNER:** the 1318 bundle's live scene and the desktop scene both carry the pitched main
  roof over garage and approach and the wing's cross gable (`/home/user/bakopy/scene-1318-apk.png`). Not reproduced;
  causes that remain possible: an older stored analysis (stored analyses survive APK updates and are listed by last
  use), or reading the wing's front slope square-on. Needed from OWNER: the copied run provenance (APK, bundle, model
  hash) of the view that looks flat. Today's live page differs from the one acquired earlier only in its title
  ("Dane projektu" → "Opis projektu"): model `16552727…`, geometry identical to `b1099a1d…`.
- **Regression (full production path, content encoder + recogniser, from a frozen copy of the tree committed as
  `82878c7`):** 13 DEV + 3 holdout-base + 8 regression houses + Bakopy + Zefiranty. Models byte-identical to 1318: the 8
  regression houses, Arlety, Aurory, Azalie, Bratki, Dalie, Jabłonki, Lipienniki, Willa Maja; Pod Miłorzębem and
  Modrzewnica still fail as before (PLAN_RESOLUTION_INCONCLUSIVE, PLAN_NO_DIMENSION_FRAME). Changed:
  - Miniaturka: interior partitions move ≤ 2.2 cm (a crossing stroke no longer a mark on one chain); exterior unchanged.
  - Muraje: the front's main rings move 0.22 m and open a 0.20 m recess along the front; the facade reader then builds a
    front balcony (`balcony-front-1`, a 0.38 m dark band), a glass railing (`railing-front-1`, 0.72 m, 3.1 m along) and the
    recess floor (`terrace-front-126`). The railing is the frozen expectation's ("railing: front") — the check goes FAIL →
    PASS. The 0.20 m slab under it is not in the source's front view: MODEL→SOURCE addition.
  - **Kostrzewy: regression.** The diagonal stroke at 197.5 px on chain `chain-horizontal-595` (frame `58cab67876`) is
    now correctly REJECTED; the chain's ladder shifts 10 cm; the porch pocket's west end moves 4.58 → 5.63 m and the
    entrance DOOR in its back wall is lost. The checker does not see it (Kostrzewy's entrance check was already FAIL: a
    window/door/window instead of one glazed pane). The recess extent hangs on one chain end; the fragility is the cause
    to fix, not the rejection. Open, next.
  - Checker: **36/70** (1318: 35/70; Muraje railing). Zefiranty stays in the denominator as a new house without a frozen
    expectation set; the historical 35/70 is kept.
- **Test delivery 1319:** code commit `82878c7378601e276a726be7c599ca1bc1a6df40` (the APK was built from this tree; the
  regression ran from a frozen copy byte-identical to it). `BuildPlan-owner-preview-1319.apk`, `com.buildplan.preview`,
  versionCode 1319, `0.1319.0-owner`, 50 453 120 B, SHA-256
  `98253f3ca3c7b885eb594db3dcd27ea73dfd2d68fe69bc4ec840279d9671e277`; signer `6e48fac4…0da` (unchanged); embedded
  `analyzer.mjs` `1d76b4f7eedefa91c7a7a6a9612042d145b59622d0d3b59f8b520c15b6956ab2` (solver 2.27.0, metric reader 1.8.0);
  10/10 asset manifest entries match; zipalign ok. The +1 MB over 1318 is padding between entries; the compressed
  contents grow 3 KB.
- Embedded path (the APK's bundle re-extracted from the final APK, host Node — not a phone), live pages:
  Zefiranty first sheet 13.9 s, done 333 s, 131 events, 32 sheets, 123 copies SHA-verified, 0 mismatched, copies removed,
  model `82cde3d5…8b97` = desktop, peak RSS 973 MB; Bakopy first sheet 13.6 s, done 260 s, 114 events, 106 verified,
  0 mismatched, model `16552727…ee19` (today's page; geometry = `b1099a1d…`), peak RSS 938 MB.
- Tests on `82878c7` (unloaded, 287 files complete): 3398 pass, 15 fail — the recorded baseline minus its two
  load-sensitive WorkerExecutor tests, which pass unloaded; no new failure.
- Private delivery outside Git: `BuildPlan-EXTERIOR-COMPLETE-Private-1319.zip`, 921 files, SHA-256
  `621d5072551761cae90a40b2604f295b9da571e6a1af2acbfc4efcfe500ea1cf` (originals with hashes; PRZED = 1318 / PO = 1319
  models, programs, all-sides renders; boards for every changed house, Bakopy and Zefiranty; Zefiranty's PRZED failure
  with its diagnostics and its feature list; checker, tests, APK log, live summaries, the Kostrzewy regression note).
- Android UI NOT_VERIFIED (no device). H2 still sealed.
- **Next concrete action:** Kostrzewy — make the porch pocket's extent follow its drawn back wall instead of the nearest
  chain end (restore the entrance door without reviving the rejected stroke); then Zefiranty ZF-2: split the garage
  from the house's lines as its own lower-roofed body, the lower roofs at the attic band, and the three dormers (one
  with the balcony and balustrade).


## E12 — after the 1319 audit: Kostrzewy's recess, Muraje's half-wall strip, the evidence ledger, and a live AI second look

Coordinator's audit of 1319 (reproduced the solver from the ZIP; Zefiranty `82cde3d5…`, Bakopy `b1099a1d…`; 45 targeted
tests pass; not a test of the APK binary or Android UI): Kostrzewy lost its door, Muraje grew a slab without a source,
Zefiranty has 9 technical ERRORs and no garage, ZIP1319 had no PO `program.json`, and the run ledger did not add up.
OWNER (6 Nov): the analyzer has to become trustworthy and think for itself when it cannot resolve something; test a
small AI as a helper, on the Claude Code budget.

- **Kostrzewy (FIRST_BAD, `plan-decomposition.ts`, layout 1.5.0):** the porch's side returns are stubs 34 px long and
  22 px thick, so their bands never make a grid line (not wall-to-wall under 2.5 thicknesses, a few per cent of the
  sheet). The recess took its sides from the nearest dimension ticks: in 1318 a room chain's tick inside the bathroom
  wall (4.58 m, 0.56 m too wide); in 1319, with a stroke on that chain correctly rejected, the next tick (5.63 m,
  0.49 m too narrow), and the 70/210 door into room 11 fell outside the back wall. The mouth on the facade, read from the
  jambs' ink, was right both times (5.15..9.16). Fix: a recess mouth with returns and wall ink at both jambs puts grid
  lines on the jambs' inner faces where no line lies within a wall's thickness (`jambLines`). Now: recess 5.15..9.16,
  the three openings where the plan draws them (70 at 5.20..5.90, 105 at 6.69..7.74, 70 at 8.41..9.11). Test
  `recess-jamb-lines.test.ts` (5 orientations; fails on 82878c7: the cell beside the low jamb BUILT, no jamb line).
- **Kostrzewy, not fixed (older than 1319):** the 105/210 opening is the entrance (its leaf and arc are drawn out into
  the porch) but is built as a WINDOW. Its callout ring was found only as two 9–10 px fragments (the leaf and arc touch
  the 15 px ring), so it was not read and its box was not masked; the ring's ink then fails the leaf test. The entrance
  check stays FAIL (it was FAIL in 1318 for the same reason).
- **Muraje (FIRST_BAD, `layout.ts` `wallStripsOf`):** the ground body is cut on the front wall band's AXIS (672 px), so
  the wall's outer half (to 685 px) is a strip between the body and the extent. The 005Q rule named a strip as the wall
  only when the whole band lay inside it. With the grid line at 672.75 (1318) the strip was 12.25 px, under the
  half-wall minimum, and no zone existed; at 672 (1319) it was 13 px, a zone, and a "0.20 m recess" got two 1.25 m
  returns, a paved floor, a balcony slab (a dark band) and a glass railing. Fix: a strip is the wall when the band's
  outer face is on the strip's outer edge and the band reaches the strip's inner edge (on it or past it), the strip no
  deeper than the band. The returns, floor, slab and railing are gone; the body is where the drawing has it (the front
  face, as 005Q designed, an unresolved outer face 0.20 m behind z = 0). `wall-strip.test.ts` case 5 (inward10) froze a
  terrace read inside the wall's own ink: changed deliberately, reason in the test; the bounds that remain are held by
  `wall-strip-half-wall.test.ts` (fails on 82878c7 in the two cause cases; counter-cases pass on both).
- **Muraje, the railing:** the source's French balconies are glass balustrades on the upper windows, no slab. 1319's
  railing came from the false recess, so the railing check returns to FAIL. A French balcony needs its own reading
  (railing on the wall face at a window). Not built.
- **Muraje, older and open:** the entrance and the garage door stand in a wall set back about 0.8 m under the upper floor
  (band rows 606..634 behind the kitchen front at 660..685); the corner-recess rule refuses a notch under 1.2 m, so the
  front is built flat with a 5.27 m "window" for the set-back part.
- **Zefiranty, causes found (not yet fixed):**
  - The area gap (153.28 vs 170.83 m²) is two missing parts: the garage's front 2.0 m (printed 200, bound PRIMARY
    648..726 px) and the canted bay on the east (608..643 px).
  - The garage's front cells are classed outside. Its body in the accepted outline is "not enclosed" (side walls
    walled 44 %, a 2.13 m "mouth"), though both front corners are solid ink (100 % dark): the left wall band ends at
    708 px and the front pier band starts at x 95, and on the right the wall band breaks at 696..709 px where a
    planter touches it.
  - Tested and ruled out: extending the edge test's corner rule (N7-FIX-03/04) to a line's own face changes nothing
    (model identical): with an accepted outline the decision is the boundary completion's enclosure of the body, not
    the cell edge test. Next concrete action: trace that enclosure test on the garage's front body and close a body
    side on solid corner ink.
  - The "flat strip" is the garage's west part, cut off from the rest of the garage.
  - The 5 `OPENING_ABOVE_WALL_TOP` compiler ERRORs reproduce on the evidence; the 4 `EXTERIOR_COPLANAR_DUPLICATE` are
    from the result audit (`ring-attached-0-0` against `roof-attached-0`), not the compiler.
- **The evidence ledger:** ZIP1319 had no PO `program.json`: the full production path (`second-house.ts` without
  `--graph`) never wrote it. It now writes `program.json` and `compile-diagnostics.json` (the production compiler on the
  same model). The 1319 summary's "24 houses" was wrong: the regression is 23 runs (13 DEV including the 3 holdout
  bases, 8 regression houses, Bakopy, Zefiranty) and 21 models (Pod Miłorzębem and Modrzewnica still fail, with their
  failure records).
- **AI second look, live for the first time (research, `research/ai-assist/`):**
  - The production contract existed since 005Y-N4 (`secondLook`): two or three readings from the reader, an answer that
    is only `AI_SUGGESTED`, VALIDATED only where an independent deterministic check agrees, and the owner's consent
    before a crop leaves the machine. It had never run: no key, no consent.
  - The session authenticates Anthropic's host itself, so no key could be saved. The transport is Claude Code's headless
    mode (`claude -p`, image as a base64 block, the answer as structured output against a JSON Schema, tools off), on
    the owner's Claude Code budget, with the owner's consent for these disclosed DEV drawings.
  - Seven questions the analyzer cannot settle or gets wrong, three repeats each:
    - the Kostrzewy 105/210 callout (CV: unread);
    - which porch opening has the outward leaf (CV: the left);
    - the Zefiranty section's ridge and right-hand terrain levels (CV: under the legibility gate);
    - the Zefiranty rear semicircle, terrace or bay (CV: terrace);
    - whether the Zefiranty garage projects past the house front (CV: flush);
    - whether the Muraje entrance/garage wall is set back (CV: flush).
  - Reference answers were read from the sources by the developer: DEV labels, chosen after the cases were known, not
    a blind test.
  - Results:
    - Claude Haiku 5.5: 20/21 correct, 1 wrong (the semicircle as a bay, on a question with no independent check, so
      it would have stayed a question), $0.014 in all, 4.7 s mean.
    - Claude Opus 5.5: 21/21, $0.47, 6.8 s.
    - On both, 15 answers were confirmed by an independent check: the plan gap a callout must fit (1.05 m); ridge −
      terrain = the published 9.02 m (+8,55 and −0,47); the printed 200 bound to the garage's projection; the wall band
      0.83 m behind the kitchen front. None was validated wrong.
    - The analyzer alone was right on 1 of the 7.
  - The ridge: the source prints +8,55 (read by both models on every repeat, and with −0,47 consistent with the page's
    9.02). The model's 8.16 is 0.39 m low (−4.6 %) — the hip at 38° over half the shorter span reaches 8.16 from the
    eaves the model assumes, so the eave datum, not the pitch, is what is off.
- **Production adapter (`anthropicVisionReasoner`, 1.1.0):** it sent `temperature: 0` and a forced `tool_choice`, both
  refused with a 400 by today's models; now it asks for the tool with `auto` and no sampling parameter, and the default
  model is `claude-opus-5-5`. A prose answer is still refused whole. `VISION_SYSTEM` and `buildVisionPrompt` are exported
  so a second transport sends the same words.
- **F11 correction (Zefiranty features, kept on record):** F11 was written as "rounded bay at the rear". The plan draws
  the semicircle in thin double lines with two sun loungers in it, outside the straight rear wall with its three
  doors: a terrace. The model was right not to build it. The frozen line stays as written, with this correction
  beside it.
- **Regression (full production path from a frozen copy of the analyzer packages; 23 runs, 21 models):**
  - Models byte-identical to 1319 except three:
    - Kostrzewy: the door to room 11 is back, the recess runs 5.15..9.16;
    - Muraje: no slab, railing, floor or returns in the wall's outer half;
    - Trytomach (regression house): two 0.22 m side "terraces" and six 1.3–1.5 m "returns" standing in 0.22 m side
      strips are gone. Checked on its attic plan: the built region ends on the 112..132 px side band's axis, so the
      strip is the wall's outer half, the same artefact as Muraje's.
  - Pod Miłorzębem and Modrzewnica fail as before.
  - The source-vision changes (exported prompt, adapter 1.1.0) came after the frozen copy; no run calls a provider.
  - Every run now carries `program.json` and the compiler's diagnostics: 0 ERRORs everywhere except Aurory (1),
    Jabłonki (1) and Zefiranty (5), all `OPENING_ABOVE_WALL_TOP`.
  - Checker: 35/70. Muraje's railing returns to FAIL: 1319's railing stood in the false recess, and the source's French
    balconies are not read yet.
  - `regress.py` on 1319 → E12 names exactly the changes above.
- **No APK in this checkpoint:** the next test delivery (≥ 1320) comes with the Zefiranty garage and roof work. Android
  UI NOT_VERIFIED; H2 sealed.
- **Next concrete actions, in order:**
  1. The Zefiranty garage's front body: trace the outline completion's enclosure test on its two solid corners, and
     close a side on solid corner ink (counter-case: a wall end beside paper stays open).
  2. Then the garage as a lower body with its own roof, the east bay, the 5 `OPENING_ABOVE_WALL_TOP` (the attic
     openings against the knee wall and roof), and the dormers.
  3. Kostrzewy's 105/210 ring: find a ring whose outline is touched by a leaf and an arc.
  4. Muraje's set-back entrance and garage wall (a notch under 1.2 m), and its French balconies.


## E12b — callout rings touched by other ink: one cause behind Kostrzewy's entrance and Zefiranty's garage front

- **FIRST_BAD (the ring reader, `callouts.ts`, metric reader 1.9.0):** a callout ring whose outline is touched by a long
  line loses the touched arc with the long run the search strips (`stripLongRuns`). The rest was fitted by two smaller
  circles side by side on the ring's bar, neither of which reads:
  - Zefiranty's "455/220" under the garage door line (two radius-9 rings at 207 and 216 px);
  - Kostrzewy's "105/210" beside a door leaf and its arc (radius 9 and 10 at 424 and 442 px).
  Two callouts never overlap or merge. So two barred rings on one bar row, overlapping or touching, are one ring: the
  circle about their union, searched a few pixels round it on the original ink, kept when it is inked over three
  quarters and has its own bar (`mergeSplitRings`). Its reading passes the same gates. Now both are read and accepted
  by the recogniser ("confident, stable, every glyph read"): 455/220 and 105/210. Test `callouts-split-ring.test.ts`
  (fails on the old reader: two rings), counter-case: two separate callouts side by side stay two.
- **FIRST_BAD (the boundary lines, `plan-decomposition.ts`, layout 1.6.0):** read across the garage's front line, the
  ring's arc and digits with the door line made wall-thick ink over 17 px — a "post" with no wall part — that split the
  4.57 m door into two blank gaps (1.95 m WALL|POST, 2.13 m POST|WALL), neither an opening; the outline stayed open and
  the garage's front 2 m read as outside. The boundary lines are now read with every known ring's outline and interior
  taken out, never where the ink is wall-thick (`withoutCalloutRingInk`). Now: one 4.52 m gap between two walls with
  "a callout of 455 cm printed over it". Test `callout-ring-ink.test.ts` (ring, bar, digits out; walls and the door
  line stay; counter-case: a ring printed over a wall leaves the wall whole).
- **Tried and ruled out on the way:** the solid layer alone (dropping POST parts on a ring) changed nothing — the post
  was ink density across the line, not a solid part.
- **Still open on both houses (the next causes, recorded):**
  - Kostrzewy: the 105 now carries its printed size and height but is still a window — the outward-leaf test fails on
    a leaf whose tip ends on the porch mouth's line.
  - Zefiranty: the 4.52 m garage gap is WEAK (only a dashed overhead-door line across it): "decided by what lies
    behind it". But what lies behind is cut by the house box at the house's front line, so the garage's front part is
    2 m deep and fails the vehicle-depth test of an open garage mouth. The completion's vehicle-door closure also caps
    a vehicle door at 2.2–3.2 m, which excludes a two-car door (4.55 m printed).
  - Next: measure a mouth's depth through the box cells its space continues into, and size the vehicle-door cap by
    the printed callout where one agrees. Both with counter-cases (a terrace glazing, a carport).
- **Regression (23 runs) — not landed:** with more rings read whole, 13 of 21 models change. They are not only the two
  targets: many 1.5–1.8 m openings change kind from window to door once their ".../220" height is read:
  - Sasanki rear ×2, Azalie ×2, Miniaturka, Muraje upper front, Aurory upper ×3 (its compiler ERRORs 1 → 4),
    Trytomach upper ×3;
  - window/door swaps in Willa Maja.
  Several are probably right (French doors and terrace doors whose height callout was unread), but none is verified
  against its source yet, and the swaps look wrong. A change this broad is not landed on trust. The patch is kept in the
  repository as `research/exterior-complete/e12b-callout-rings.patch` (it applies to `9eda430`, tests included); the
  runs are in the private work directory. Next concrete action: verify each changed opening against its plan and
  elevation (`regress.py` lists them), fix what the swaps show, then land with the vehicle-mouth rules above.

## E13 — E12b landed after a source check of every changed opening; the causes the AI loop exposed; test delivery 1320

- **E12b verified, then landed.** Every one of the 71 openings E12b changed in 13 models was looked at on its plan crop
  (`tools/opening-boards.py`, the ring weighed for it, bound or refused) and, where the plan cannot say, on its
  elevation. Verdicts (`changes/verification-e12b-rows.md` in the private ZIP): 50 IMPROVED (a printed size now read and
  bound), 11 CAUSE FIXED, 4 CORRECT, 3 CONVENTION (named), 3 open — Aurory's garage door (size right, kind wrong,
  pre-existing: the room number is not read), Willa Maja's east upper width (1.02 → 0.90, a ring beside it refused),
  Trytomach's 277 against a 2.59 m gap. The rules that were wrong, each fixed at its cause with a test red on the old code
  and counter-cases (rotations, scales, mirrored sheets):
  - **ridge axis from the views** (`ridge-axis.ts`): a view that measures an eaves side where the layout's axis would
    show a gable end overturns the layout's rise test (Aurory: compiler ERRORs 4 → 0, gable windows instead of doors
    through an eaves wall); a rise both spans can reproduce with a believable overhang is ambiguous and named;
  - **French windows** (`opening-reading.ts`): above the ground storey an opening to the floor wider than one leaf is a
    window unless a balcony slab or a lower body's flat roof stands in front of it at its floor; a window an elevation
    read behind a balustrade in front of a balcony is that balcony's door (`stepOutDoors`); a sibling drawn like a
    printed one inherits that deferral (Goździkowce's second balcony door);
  - **the template's rival** (`extract.ts`): an unstable recogniser reading is a rival too; a width tie is broken by
    the plan gap (Willa Maja 110/230, Arlety 230);
  - 220 cm or a width alone never makes a door: ring → digits → binding → kind → height, in that order.
- **Causes the AI loop exposed, fixed in the solver for every house:**
  - the mark below the ridge over a slab is a floor only where the plans show a storey on it (a ceiling slab is the
    walls' head — the first version of this rule promoted a bungalow's ceiling to a storey: 15 red tests, corrected);
  - a printed eaves mark the section's own roof lines put at the eaves' lip is not the walls' head (Azalie +3,73 beside
    the printed 167 knee wall: the gable's windows are no longer cut under a soffit that is not there);
  - the terrain is the ground mark the published building height is measured from (`printedTerrainOf`; Azalie −0,32,
    not −0,57 under the stair) — which also refuses a view whose ground lands half a metre off;
  - an elevation extent the printed height refutes places neither end of the opening (six sills in the corpus had been
    "measured" from such an extent: Arlety, Dalie, Lipienniki, Rarytasy, Bakopy ×2 — now the convention, named);
  - a recess's mouth is no lower than the openings in its back wall (`passageHead`, Goździkowce).
- **Upper floors at their printed levels:** Aurory 3,00, Willa Maja 2,96, Sasanki 3,06 (the convention 2,80 before).
- **Known wrong after this delivery:** Zefiranty's upper rear 180/230 is now a French window — the attic plan draws a
  semicircular balcony in front of it, which the model does not build (open), so the rule that sees only built slabs
  leaves it a window; E12 had it as a door with no balcony.
- **AI review loop (contract v3.42, research, `research/ai-assist/section-levels-case.ts`):** the analyzer generates the
  problem from its own record (a section with no registration and unread number-like ink); the answer is a typed
  observation (box, uncertainty, OTHER/UNKNOWN allowed); a reading is admitted only by the same drawing (a level symbol
  under its box, one leave-one-out ladder) and by the published building height over the ground mark it is measured
  from; the admitted readings overrule the numeric reader's own misreads of the same labels (`supersededLevels`); the
  proposal is a revision on a stated base, solved, compiled and compared with CV_ONLY on identical inputs. Outcomes
  with the 1320 code, replaying the recorded answers (no new call):
  - Goździkowce (regression house): **ACCEPTED** — ridge 7.94 → 8.36 m, the printed +8,36; 8.36 − (−0,32) = 8.68 m, the
    published height; the upper floor at the printed +2,96 (the reader's +2,46 overruled as the same label); nothing
    else changes but what the levels decide; compile errors 0 → 0. Board: section with admitted marks, CV_ONLY and AI
    renders side by side.
  - Azalie (DEV): **DEFERRED** — both source checks pass (ridge 7.28 → 7.70 m printed; 8.02 m published), but the
    variant also reads the front door on an elevation the levels registered as 2.50 m tall (the render shows the 2.1 m
    door inside a darker 2.5 m surround): a change nothing checked, so it is not applied and the person decides.
  - Zefiranty (DEV): **REJECTED** — the readings pass (8,55; 9.02 m published) but the variant loses a rooflight: with
    the printed ridge the side renders match the whole envelope, and the main roof is then carried over the garage's
    front 2 m, which the layout does not build (#83).
  - A confident wrong answer (fixture: +8,85 for +8,55, confidence 0.99): **DEFERRED** in both rounds — the ladder
    holds it within the ridge's widened tolerance, the published height refuses it (9.17 vs 9.02 m).
  Every replay first exposed a solver cause (the list above); each is fixed in the solver for every house, not in the
  loop. Spend: 0.6084 USD counted of the 5 USD limit since E12 (E12 0.4904 + E13 0.1180), CLI token estimates, billing
  unconfirmed; every E13 call traced (model asked and answered, session, credential category `none` = the session's
  own sign-in, tokens, cache, latency). What works where: research only — the host production adapter
  (`anthropicVisionReasoner`) was not run live, and the APK makes no AI call.
- **Zefiranty garage (#83), FIRST_BAD found, not fixed:** the flood fill splits the double garage at the house's front
  grid line — the cars drawn in it ink that line enough to close it — and its front 2 m joins the outside through the
  4.55 m gate. The gate rule weighs only rectangular pockets; that strip is part of the one open region round the
  house, so the gate is never weighed. An extension of the rule through a line-work back edge was written, found to
  never fire on the real house for that reason, and reverted rather than landed unexercised. The fix is a pocket cut
  from the outside at the gate's line, a corpus-wide change of its own.
- **Regression (23 runs, 21 models; Pod Miłorzębem and Modrzewnica still fail as before):** E13 full path from a
  frozen tree (metric reader 1.9.0; upstream of the solver the 1320 tree differs only by additions), then the 1320
  solver on that evidence. From the landed E12 code: 90 element changes (the 71 E12b rows and 19 more), every one with a verdict
  (`changes/` in the ZIP); compile ERRORs Aurory 1 → 0, Jabłonki 1, Zefiranty 5 (unchanged); no element lost
  except Zefiranty's upper rear door (above). Checker 35 → 34/70, read honestly: Aurory's ridge now passes; Arlety and
  Jabłonki lose an "entrance" that was an upper-floor French window built as a door — their real entrance door was
  never built, and the checker counted the wrong door.


## E14 — v3.45: reading of drawings — independent annotations, fresh-extraction PRZED/PO, reader fixes, test delivery 1321

OWNER (v3.45) replaced "Zefiranty first" with the general reading of drawings, dimensions, elements and their mapping.
Bakopy and Zefiranty are witnesses only. H2 sealed. No AI call this stage (ledger 0.6084 of 5 USD since E12, estimate,
billing unconfirmed). Android UI NOT_VERIFIED (no device).

- **Coverage map** (`research/reading-v345/COVERAGE.md`): before v3.45 no vitest test read a real publisher image and no
  real-sheet annotation covered a number's meaning, its target or elements.
- **Dataset** (`research/reading-v345/`, textual facts only; originals outside Git): 33 projects, 908 images; DEV 23
  (non-blind, disclosed), EVAL 10 from new family stems (seed 20261107), split by whole project and variant family.
  Frozen before scoring (`FROZEN.json`): view roles/storey/side; every printed number on 33 sections; 81 EVAL and 57 DEV
  callouts with ring and target; 80 room numbers with ink position on the 8 EVAL plan sheets the reconstruction reads
  (61 blind; Balsamowce non-blind, scored as DEV). One scorer correction disclosed (room numbers: replicate solver
  2.29.0's size rule; PRZED unchanged).
- **Fixes (general causes, production path):** section level marks read by the shipped recogniser and admitted only by
  the same drawing — own ▽, one leave-one-out ladder, a printed ±0,00 on it (the +0,15 m correlated-shift negative test
  kept; +0,40 with a printed zero refused) (`level-marks.ts`, external-levels 1.2.0); section pitch read along its slope
  and admitted by the drawn slope ±1° (`section-angles.ts`); callout rings that fail the gate re-fitted to their stroke;
  one span on twin lines stated once (metric solver 1.7.0); room numbers re-read by the recogniser from widened ink,
  superseding the template's readings of that ink, not held to the sheet's text height, off dimension lines (metric
  reader 1.11.0, `room-numbers.ts`); a region with two published numbers takes neither; a garage room's wall says
  vehicle door in any body; where nothing decides the ridge axis a hipped roof at one pitch runs along the longer side;
  a door leaf up to a sidelight short of its gap is the gap's own leaf; the bounded reconciliation reads no opening
  height on a refused view and never lifts a door's sill (solver 2.29.0); source inspection names the reader.
- **PRZED/PO** (same inputs; PRZED = E13 code; PO = full path from frozen `d62268b`, solver `4328439` on that evidence):
  section levels DEV 51 → 109/110 (wrong 17 → 0), EVAL 24 → 44/46 (5 → 0); pitch DEV 0 → 12/22, EVAL 0 → 2/7 (3
  template additions remain); vertical dimensions unchanged (3/59, 1/22); callout digits DEV 38 → 41/57, EVAL 59 → 63/81;
  callout → opening complete DEV 28 → 33/57, EVAL 20 → 22/81 (42 EVAL callouts sit in 5 houses that fail before
  openings); room numbers shown (blind EVAL, kept path) 6 → 25/61, wrong 2 → 2; view roles macro F1 0.975 both (gate
  met), storey/side unchanged. Gates: measure→target ≥95 % NOT met; ≥98 % exact at ≥90 % coverage met for section levels
  only. Full tables: `scores/przed-po-final.md`, `per-project-final.md` in the ZIP.
- **Models:** checker 34 → 39/70 (Aurory gate + rooflights, Kostrzewy entrance, Pod Miłorzębem builds: gate, ridge);
  287 DEV element changes (regress.py, in the ZIP). The element check found and fixed two causes (Willa Maja ridge axis;
  reconciliation on a refused view). **Known errors of 1321:** Bakopy's attached wing has a flat roof (all four
  elevations refused against the printed terrain −0,32 → wing roof form unread → convention; PRZED read a 35° gable);
  Ciesz east/rear windows read 0.73/0.90 m tall on elevations (were 1.56/1.59), unverified; Ciesz gains an attic level
  over the printed eaves +2,93 (no visible change).
- **Open, named:** 5 EVAL houses + Modrzewnica fail before openings (scale: Bukszpany, Modrzewnica — bottom chain ticks
  crossed by drawn plants bind "1000" to 186 px; plan decomposition: Santany, Eliza, Ofelia; walled envelope: Julia);
  Kostrzewy porch (three openings in one 4.01 m gap); Willa Maja corner window (callout includes part of the corner);
  doors with no drawn leaf read as windows.
- **Tests:** source-metrics 398/398; reconstruction 1366/1366 (119 files); analysis-service 186 pass, 17 pending as
  before, 2 files hit vitest RPC timeouts under the regression's CPU load (the known load-sensitive class); typecheck
  root + web clean.
- **Test delivery 1321:** code `4328439`; `BuildPlan-owner-preview-1321.apk`, versionCode 1321, `0.1321.0-owner`,
  50 500 031 B, SHA-256 `8c0f28e84ea12a058a2ee96b1e2157881f31ba725c17db428e0626db8d12a8ea`; signer `6e48fac4…ca0da`
  (unchanged, v2); embedded `analyzer.mjs` `2b621b671fc4c70bfbd8aab086e6563ab8a41bbe529538979110b18fb94337c8`
  (solver 2.29.0, metric reader 1.11.0); 10/10 asset manifest entries match; zipalign ok.
- **Private delivery outside Git:** `BuildPlan-EXTERIOR-COMPLETE-Private-1321.zip`, 707 files, SHA-256
  `3430d694a113977ec5da07f3049c5f8e780d3885fb638f17c5204176001676d5`.
- **Next concrete action:** Bakopy wing roof — the elevation silhouette registration once the terrain is printed (the
  rear view's ground moved −0.27 → −0.92 m between runs); then plan-reading failures (scale under crossed ticks,
  decomposition) that keep five EVAL houses from openings.

## E15 — v3.46: a trustworthy measure, dimension ends on sections, roof shape under a refused registration, one callout per opening; test delivery 1322

Same campaign, continued from the E14 code (`4328439`). WORK_IN_PROGRESS. H2 sealed. Android UI NOT_VERIFIED. No AI call.

**Measurement (research/reading-v346; the v3.45 scorers and 1321 tables kept unchanged as history).**
- `score_section_signs.py`: each of 266 legible section numbers (32 sections) has a place and its printed raw text
  (`annotations/section-signs.txt`, placed on the originals after the v3.45 scores were known — disclosed). Matching by
  geometry only; raw text, raw value, final value, origin and measure kind reported apart; two different claims on one
  sign are a conflict; R/T/F checked against the model's datums and storeys.
- `score_callouts_v2.py`: one-to-one geometric assignment (along-wall IoU ≥ 0.5), MERGED_GAP / SPLIT_GAP, readings one
  per ring, the bound callout must be this ring's, NO_MODEL kept in the denominator.
- `score_views_v2.py`: graph / pixels / side as separate layers; pixel coverage with the reason for each undecided image;
  verdicts kept by failed runs read; PROPAGATED apart; exact L/R not measured (no L/R reference).
- `test_counterprobes.py`: 21 probes. Audit 1321's two probes reproduced against the old scorers (2/2, 3/3) and rejected by
  the new ones; eaves/ridge swap, right number on a neighbouring host, same digits from the other ring, removed run,
  L/R swap under SIDE; opposite cases pass.
- The 139 NOT_CLASSIFIED of EVAL-PO-content were all images of the five EVAL houses that failed in the solver before the
  summary that stores the verdicts was written (no variant propagation involved). Fixed in the service.
- `annotations/dev-links.json` (frozen before scoring): 16 section dimension end pairs on 6 sections and 4 source-checked
  relations. Walls vs furniture, columns, balconies, dormers, mixed-sheet regions and exact L/R still have no measure.

**Production (general causes).**
1. Solver 2.30.0 — roof shape survives a refused registration. FIRST_BAD (Bakopy wing): a view's heights were re-anchored
   on the main roof's own line by the median of the top residuals; crowns and a chimney behind the slope raised half the
   columns by 0.5–1.1 m, the median (+0.73 m) moved every height, the wing's gable read 0.8 m short, was left unread and
   built flat by convention. Now `topLineOffset`: the lowest band of residuals holding a fair share of the columns
   (occluders only raise the top a walk from the sky finds); a refused view is read only through that anchor and gives
   no reading without it; an unsettled pitched observation is kept as an unresolved `form`. On the 1321 evidence the
   change touches Bakopy alone (wing: flat → gable along X, as the front elevation shows).
2. Metric reader 1.12.0 — section vertical dimensions read as text → line → ends → span (`section-heights.ts`): the
   recogniser hears the label (the template only finds it), the faint line beside it is followed to the face of a slab,
   wall or roof or to the tick before a free end, and the span at the section's own level-ladder scale must equal the
   value; the sheet's reading direction is decided once, from what the drawing admits. DEV probe: 39/59 right, 0 wrong,
   0 spurious (was 3/59). The v2 solver does not consume section dimensions yet: the effect is in the evidence and its
   measure, not in the models.
3. Solver 2.31.0 — one callout, one opening (`calloutOwners`): every callout of a storey belongs to the nearest gap it
   fits on any wall, decided before any gap is read. 8 double bindings on 7 houses (3 across two walls) resolved; 3
   openings whose own ring is unread lose a borrowed size (named; Bakopy's rear-left window now wrong by convention).
4. Service — a run that fails after the content check writes its verdicts (`content-verdicts.json`).

**Ciesz source check.** Page: a single-storey house (parterówka) with a hip roof, 13 rooms on the ground storey, usable
area = floor area. Section: ceiling slab (underside ≈ +2.83 from the 283 dimension, top +3.34), walls up under the roof to
≈ +3.8. Model: the ceiling slab is now there (PRZED had none) and the new level holds no room, but its floor stands at
+2.93 (the eaves mark) instead of the printed +3.34 — a level-semantics error, named. The east and rear elevations draw
all windows one height (~1.45–1.5 m); the model has 0.73 and 0.90 m for two of them (extent read on reflective glass) —
a 1321 error still open.

**PRZED / PO-1321 / PO-1322, same v3.46 scorers** (PRZED = E13/1320; PO-1322 = fresh full path from the frozen tree
`572b875`; `research/reading-v346/` and the ZIP hold every class):
- DEV: section levels right at the sign 49 → 107 → 108/110 (located 68 → 109 → 109; conflicts 2 → 2 → 1); model role
  of storey floors 25 → 34 → 34/39, ridge 21/21 and terrain 20/21 now assessed (1 each without assessment); roof pitch
  0 → 12 → 12/22 (3 additions); **vertical dimensions 3 → 3 → 39/59, 0 wrong** (5 additions, all from the older chain
  reader); callout ring found 42 → 55 → 55/67, digits 37 → 50 → 50/67, callout → its own opening complete
  28 → 43 → 43/67 (wrong binding 1 → 1 → 0); view roles graph macro F1 0.975, pixels 0.996 with coverage
  608 → 629 → 650/650; side coarse 89/92; exact L/R not measured.
- EVAL: levels 24 → 44 → 44/46 (0 wrong); storey role 6 → 7 → 7/17 (signs on houses without a model count as wrong),
  ridge 5/5 and terrain 4/5 assessed (5 each without assessment); pitch 0 → 2 → 2/7 (one located wrong);
  **vertical dimensions 1 → 1 → 14/22, 0 wrong** — the reader's first EVAL measurement (tuned on DEV only); callouts
  24/81 complete (41 in the five houses without a model; wrong kind 2 → 0 → 0, additions 3 → 3 → 2); pixel coverage
  119 → 119 → 258/258, macro F1 1.000; side coarse 34/40. EVAL sign positions were placed after the v3.45 results were
  known (disclosed in FROZEN.json).
- The 1321 tables (v3.45 scorers: levels 51 → 109/110, callouts 28 → 33/57) stay unchanged in E14 as history; the
  difference is the measure, not the code.

**Gates (v3.45 thresholds, not lowered).** View roles macro F1 ≥ 95 %: met. Numbers ≥ 98 % exact at ≥ 90 % coverage:
met for levels (DEV 108/109 located at 99 % coverage, EVAL 44/44 at 96 %); not met for vertical dimensions (exact
100 %, coverage 66 % / 64 %), pitch and callout digits. Complete assignment ≥ 95 %: not met (64 % DEV, 30 % EVAL).

**DEV link set.** Dimension ends 12/16 within tolerance (≤ 2 px); 2 with the right value and ends off (Marcówki 272:
−4/−3 px against 3; Sasanki 278 is the old chain reader's reading, whose geometry is the chain line); 2 not read
(Dalie 121, Trytomy 266). Relations 1/4: Bakopy wing roof OK; Ciesz attic floor, east and rear window heights WRONG.

**Integration (1321 → 1322, all 33 projects, element by element).** 31 SAME. Bakopy: wing flat → gable along X (two
planes "need a source": the front elevation; edges 2 eaves, ridge, 2 verges), four wing walls change, the rear-left
window loses the height it borrowed from its twin (2.30, sill 0) and gets the 1.30 / 0.90 convention against the
source's 80/230 — named cost. Zefiranty: two front openings lose a borrowed callout size (1.50×1.20/1.00 →
1.35×1.30/0.90; 0.78×0.57/1.02 → 0.69×0.76/0.90). Compile ERRORs equal PRZED and 1321 (Balsamowce 2, Jabłonki 1,
Zefiranty 5, all `OPENING_ABOVE_WALL_TOP`). Old exterior checker 39/70 (as 1321).

**Production.** 33 full-path runs from `572b875`: 27 models, 6 failures recorded as results (Bukszpany, Modrzewnica
`METRIC_RESOLUTION_INCONCLUSIVE`; Santany, Eliza `PLAN_RESOLUTION_INCONCLUSIVE`; Julia `PLAN_NO_WALLED_ENVELOPE`;
Ofelia `PLAN_LAYOUT_REJECTED` — the same six as 1321), each with its content verdicts kept; solver replays 27/27
byte-identical (they supply the feature traces, which the full path does not write). Tests on the frozen tree:
root typecheck including tests 0 errors, source-metrics 405/405, reconstruction 1378/1378,
service and analyzer 270/270, counter-probes 21/21.

**Test delivery 1322:** code `572b875`; `BuildPlan-owner-preview-1322.apk`, versionCode 1322, `0.1322.0-owner`, universal (four ABIs;
1321 was a single-ABI build), 71 533 012 B, SHA-256 `342ea3c78f18d022fbe78bcd4c30fa71969e4de3892bb1b5256eb335634303d4`;
signer `6e48fac4…ca0da` (unchanged, v2); zipalign `-P 16` ok; embedded `analyzer.mjs`
`242917f8686e7d6d9d4a9dbac5ec95dde0f6a97d1de35e82a47267652e6be6a3` (solver 2.31.0, metric reader 1.12.0); 10/10 asset
manifest entries match; the build's `VERSION.txt` records commit `572b875`. Android UI NOT_VERIFIED (no device).

**Private delivery outside Git:** `BuildPlan-EXTERIOR-COMPLETE-Private-1322.zip`, 701 files, 43 469 888 B, SHA-256
`34295dcad6c3508396320c197b045fefdba25a548fb7f100e554679aa8bbe5ec`: `RUNS.json` (every run, successes and failures,
replay identity), per project the source package, decoded-byte hashes, graph, evidence, model, program, feature trace
(from the byte-identical replay), diagnostics, analysis trace, scene; v3.46 scores and the v3.45 table as history;
examples on the originals; changes 1321 → 1322; build and test logs; originals limited to the 187 annotated sheets
(the other 721 images listed by hash and URL). Not included: other publisher images, H2 (sealed), the OWNER's private
benchmark (out of scope).

**Open, named:** Ciesz level semantics (+2.93 vs +3.34) and two window heights (0.73 / 0.90 vs ~1.5); Bakopy rear-left
window by convention; callout assignment (unread own rings, five EVAL houses without openings), roof pitch and
vertical-dimension coverage below the gates; the v2 solver does not consume section dimensions yet; no measure yet for
walls vs furniture, columns, balconies, dormers, mixed-sheet regions and exact L/R.
