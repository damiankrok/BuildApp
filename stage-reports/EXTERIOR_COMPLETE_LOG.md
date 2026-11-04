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
