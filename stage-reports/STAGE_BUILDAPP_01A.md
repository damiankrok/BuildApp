# STAGE BUILDAPP-01A — MARCÓWKI ARCHITECTURAL FIDELITY CLOSURE

## 1. Baseline and result

| | |
| --- | --- |
| branch | `claude/buildapp-buildworld-v1-7y6yqh` |
| starting HEAD | `d40fa39733c80bf0b1e35c2233c8ea8ba0c542b7` (verified equal to the remote tip before work began) |
| implementation commit | `2de2f26328ec45ad99b47da0d9d956e8bc4d4cf9` — schema, commands, compiler, editor, reference model, tests, fixtures, browser artifacts |
| docs commit | the commit that carries this report (`docs/`, `README.md`, `PROJECT_STATUS.md`); its SHA is the final HEAD recorded in `git log` |
| schema before → after | `buildapp.canonical-building-model` **1.2.0 → 1.3.0** |
| result | **PASS** — every gate green, every required proof measured |

STAGE BUILDAPP-01 put the Marcówki specimen through the generic pipeline and
recorded what it could not yet represent. This stage closed those gaps, each
by adding a **generic capability** and then using it. The generic packages
still do not know the house exists (`tests/architecture/reference.test.ts`
tests 1–3, 5). `docs/MARCOWKI_ARCHITECTURAL_FIDELITY.md` is the standing
description of the result; `docs/MARCOWKI_SOURCE_REVISION_POLICY.md` is the
standing revision policy; this report records what was done and measured.

## 2. Source revision policy

ARCHON publishes the project in more than one revision and the revisions
disagree on four published aggregates:

| fact | current page (fetched 2026-09-15) | older project card | reference uses |
| --- | --- | --- | --- |
| house net area | **129.04 m²** | 129.15 m² | current page |
| garage | **24.10 m²** | 23.85 m² | current page |
| Schody | **5.63 m²** | 5.62 m² | current page |
| roof area | **150.57 m²** | 168.48 m² | current page |

The rules, in `docs/MARCOWKI_SOURCE_REVISION_POLICY.md` and as data in
`src/revision.ts`: the current page is the reference for published room and
area facts; a dimensioned drawing outranks any published figure for anything
geometric; **an aggregate area never moves a dimension**. Revisions are never
mixed silently — every conflicting fact carries both values, the one used and
why. The older card is behind a request form and was not retrievable in this
session; its figures are cited as quoted by the stage brief.

**Geometry impact: none.** All four conflicting figures are aggregates the
model does not consume. The published room areas are measured to finished
surfaces while the model's rooms are plan polygons to structure, so the
0.11–0.25 m² drift between revisions changes no boundary. The roof area the
model does not read at all.

Two corroborations came out of the audit and are worth recording:

- The published room table **composes exactly**: the fifteen counted rooms'
  net areas (123.410 m²) plus the Schody (5.63 m²) give the published
  129.04 m². The transcription of the table is therefore right, not merely
  copied.
- The current roof area **closes on the modelled roof to 4 mm²**:
  7.90 × 14.60 ÷ cos 40° = 150.566 m², and the model's measured slopes
  (146.947 m²) plus the five holes cut in them (3.619 m²) give 150.566 m².
  The published aggregate independently confirms both that the roof runs the
  full 14.60 m characteristic extent and that its pitch is 40°. The older
  card's 168.48 m² matches neither. The current page is not merely newer
  here; it is the one that agrees with the drawings.

No geometry was tuned to close an aggregate. The footprint keeps the printed
chains at 130.665 m² against the published 131.16 m² (0.38 %), recorded, not
closed.

## 3. Generic extensions (schema 1.3.0)

Every one has commands, validation, compiler support and tests on buildings
that are **not** the reference
(`packages/{model,commands,geometry,editor}/test/fidelity-1.3.0.test.ts`).

| capability | schema | notes |
| --- | --- | --- |
| **Regions with holes** | — | `tessellateRegion(outer, holes)`: scanline trapezoids with shared grid breaks; coincident opposite boundary segments cancel, so a hole **may touch the outline**. No bridging, no ear clipping, no repair. Used by slabs, door frames and finish skins alike. |
| **Real staircases** | `Stair` PLACEHOLDER \| FLIGHTS | `segments` of FLIGHT / WINDER (fanned about a newel, 90° or 180°) / LANDING in walking order; `layoutStair` in the model package; a compiler that emits one edge-manifold solid of treads with a folded-plate soffit and a measured arrival. |
| **Slab holes** | `Slab.holes?` | plan polygons removed through the full thickness; validated simple, inside the outline, non-crossing. |
| **Roof cut modes** | `RoofOpening.cut?` | VERTICAL (default) or NORMAL_TO_ROOF: the underside outline shifted `thickness · sin(pitch)` uphill with tilted reveals. A PENETRATION is refused unless VERTICAL. |
| **Composite openings** | `Door.assembly?` | LEAF (own hinge, optional full glazing) / GLAZED / PANEL panels across the opening with mullions; the frame is the opening less every aperture, one closed solid. |
| **Surface regions** | `surfaceRegions` collection | a finish band on a wall face with no thickness of its own; a 2 mm skin 3 mm clear of the face, clipped by the wall top function and by every opening. |

Migration 1.2.0 → 1.3.0 is explicit: an empty `surfaceRegions` is added, one
`SCHEMA_MIGRATED` warning and one note. Every new field is optional and every
old stair stays a PLACEHOLDER, so a 1.2.0 file compiles to exactly the
geometry it compiled to before — tested against the BUILDAPP-01 Marcówki
freeze, kept as `marcowki-ge-1.2.0.json`, which still compiles with a
placeholder stair, a notched slab and vertical roof cuts. The 1.0.0 and
1.1.0 demo files migrate through the whole chain and compile to exactly the
current demo scene.

## 4. The staircase (§4)

A `FLIGHTS` stair replaces the placeholder:

```
start (5.37, 5.82) facing PLUS_X, width 0.99, waist 0.18
  FLIGHT  4 risers, going 0.2725      SOURCE_DERIVED (nosing lines x 5.376, 5.641, 5.919, 6.197)
  WINDER  4 risers, LEFT 90°          GEOMETRIC_INFERRED (the plan draws no fan lines)
  FLIGHT  9 risers, going 0.265       SOURCE_DERIVED (nosing lines z 7.782 … 5.665)
```

Seventeen risers over the printed 3.06 m rise: **0.180 m each**, measured by
rays up the walking line. Arrives exactly on +3,06. First riser on the plan's
nosing line x 5.370. Inside the shaft `x 5.37..7.45 z 4.83..7.94`. One closed
solid of 1.455 m³ sharing no volume with the slab or any wall.

**Counts and their status.** Thirteen straight risers are counted off the
plans. The winder count is not drawn, so it is inferred from the printed rise
by choosing the count that gives a normal riser. **Three winders would give
0.191 m and five would give 0.170 m; both are admissible** and both are
recorded in the fact's note and in ledger `stair-winder-count`. The stair's
evidence status is `GEOMETRIC_INFERRED` with `waist: ASSUMED` as a property
override — the convention this package already uses for a door whose head is
assumed.

The top step moved: BUILDAPP-01 and the interior gold took the void's north
edge (reference z 6.79) as the top step, but both plans draw the northern
flight past it to z 5.66 (ledger `stair-void-shape`).

A synthetic non-Marcówki stair test is part of the generic suite, and 400
randomised stairs — all four directions, flights, winders LEFT and RIGHT at
90° and 180°, landings with every turn, waists 0.05–0.4 — were each checked
closed, reaching the arrival and standing on the floor.

## 5. Slab void (§5)

`Slab.holes` is first class. The Marcówki void is the **L the stair
occupies** — 4.158 m², six corners, touching the east inner face:

| | |
| --- | --- |
| hole | 1, 4.158 m² = 2.080 × 0.990 + 0.990 × 2.120 |
| watertight | slab closed; volume `(outline − hole) × 0.33` exactly |
| inside the L | 1680 rays on a 0.05 m grid meet **no** slab |
| outside it | 924 rays meet the full 0.330 m |
| touches the outline | a ray 10 mm west of the east inner face is open |

The corner the old rectangle would have removed is solid plate; the band it
would have kept is open. 200 randomised regions (rectangular, L and T
outlines with rectangular and L holes) were each checked closed with exact
volumes.

## 6. Rooflights cut normal to the roof (§6)

All three units use `NORMAL_TO_ROOF`; both chimney penetrations stay
`VERTICAL`, and the validator refuses a normal-cut penetration.

**Rays along the roof normal prove it.** 96 rays per unit fired along the
roof's own normal through a grid over the top outline: **96/96 pass clean**
for each of the three. Recompiled with `cut: 'VERTICAL'`, rays near the
uphill edge are blocked. The underside shift measured off the triangles by
bisecting the wedge is **0.135686 m** against `0.21109 × sin 40° =
0.135686` predicted. Independently, the lower reveals now face *upward* at
90° − 40° = 50° and appear as minor upward planes of exactly
3 × 0.78 × 0.21109 m².

## 7. Composite openings (§7)

| door | assembly | evidence |
| --- | --- | --- |
| entrance 105/210 | `LEAF 0.72 (hinge LEFT) │ mullion 0.04 │ GLAZED 0.28`, pane on the east side | hero render + front elevation, VISUAL_INFERRED |
| garage 275/225 | `PANEL 1` | front elevation reads one flush dark panel, no joints, at y 0.5 and 1.2 |
| garage side 100/210 | `LEAF 1, glazing FULL` | rear elevation reads the leaf as one glazed panel in a frame |
| kotłownia (concealed) | **none — one plain leaf** | no elevation shows its face |

Sub-panel widths are VISUAL_INFERRED and say so; the entrance split is
uncertain by ±0.07 of the width (ledger `entrance-panel-widths`) and the
hinge edge is ASSUMED. The concealed door is the control: nothing was
invented for a face no source shows. Both garage doors were also given a
dark joinery material, from the same row scans that read their panels.

## 8. Interior door heights (§8)

Unchanged, deliberately. All eleven interior doors are 2.00 m with
`height: ASSUMED` and the note *"no interior opening is dimensioned
vertically"*. The concealed kotłownia door is the one facade door with an
assumed head and says so; every other facade opening's height is sourced.
The audit's opening table prints the width and height evidence status for
all twelve facade openings.

## 9. Finish regions (§9)

Six bands, all VISUAL_INFERRED from calibrated elevation readings:

| region | host | across | up |
| --- | --- | --- | --- |
| `sr-front-timber-ground` | `g-front` | 0.657 … 3.185 | 0 … 3.060 |
| `sr-front-timber-gable` | `u-front` | 0.657 … 3.940 | 3.060 … the roof soffit |
| `sr-rear-timber-west` | `g-rear` | 0.610 … 2.258 | 0 … 2.410 |
| `sr-rear-timber-east` | `g-rear` | 6.958 … 7.290 | 0 … 2.410 |
| `sr-west-dark` | `g-left` | 3.691 … 9.032 | 0 … 2.377 |
| `sr-east-dark` | `g-right` | 8.500 … 9.704 | 0 … 2.360 |

Each is a 2 mm skin standing 5 mm clear of the wall face (3 mm gap + 2 mm
skin), so nothing z-fights. No band changes its host wall's volume (checked
against a compile with the regions removed), no band covers an opening
(rays through every opening in a banded wall miss the band), and the front
gable band's top follows the 40° rake to within 1 mm of the host wall's own
top — a gable-shaped band, not a rectangle over a gable. Regions survive
save and load and are hidden with their host wall.

## 10. Portal, balcony, balustrade re-audit (§10)

Unchanged and re-measured: balcony slabs and portal head closed solids of the
stated volumes and bounds; the whole front zone open below 2.41; both
balustrades glass over more than 85 % of their run with posts the only gaps,
four panels each. The VISUAL_INFERRED uncertainties are kept, not closed:
balcony thickness/top, railing height, the balcony's west edge (plan 3.338
against render 3.236). The four glass panels per balustrade still match the
plan post marks.

## 11. Terrace decision (§11)

**Modelled**, as `TERRACE` plates: the rear loggia floor (x 0.61..7.29,
z 13.60..14.60) and the front portal floor (x 0.61..11.44, z 0..1.00), both
from ±0,00 down to the −0,32 terrain datum. The front and rear elevations
draw the plinth line continuous under the returns and across both recesses;
the thickness is GEOMETRIC_INFERRED, matching the ground slab's plinth.

Both recesses remain real: at 1.2 m above the floor the first material is a
full metre in, on both sides. The garden paving, the entrance step, the
driveway and the portal soffit lighting strip beyond the outer planes stay
out (ledger `terrace-floors`).

## 12. Current ARCHON fact parity (§12, `npm run audit:marcowki`)

| fact | source | model | delta | cause |
| --- | --- | --- | --- | --- |
| building height | 8.27 | 8.27 | 0.000 | — |
| knee wall | 1.30 | 1.30 | 0.000 | — |
| roof pitch | 40° | 40.000° | 0.000 | — |
| roof area | 150.57 | 150.57 | −0.004 | measured slopes + the five holes cut in them; corroborates the 14.60 m extent and the 40° pitch together |
| footprint | 131.16 | 130.67 | −0.495 | the printed chains close on 130.665; 0.38 % below the published figure, which never moves a chain (ledger `footprint-area`) |
| house area (same rooms) | 129.04 | 146.55 | +17.508 | published net is to finished surfaces; against the page's own gross column where it prints one (140.72) the residual is +5.828 |
| garage | 24.10 | 24.42 | +0.320 | gross-to-structure against a finished-surface figure |
| kotłownia | 5.80 | 6.12 | +0.315 | same |
| Schody | 5.63 | 8.31 | +2.683 | the page counts the stair by a projection no drawing shows; the drawn compartment is 8.31 and the floor void 4.158 (ledger `schody-area`) |

Per-room areas are printed for all eighteen rooms with the published net and,
where the page prints one, the gross. Room areas are not gates: no boundary
was moved to close one.

## 13. Opening dimension and shape audit (§13)

All twelve facade openings, measured in the compiled walls by rays: worst
dimension error **< 1e−15 m** on every one, and every raked head raked, every
level head level. The table prints the printed callout, the measured width ×
height, the sill, the head at both ends, the shape and the width/height
evidence status. Eleven interior doors plus the concealed kotłownia door
carry `height: ASSUMED`.

## 14. Wall audit (§14)

| chain | printed | model |
| --- | --- | --- |
| overall width | 12.05 | 12.05 |
| main body | 7.90 | 7.90 |
| garage | 4.15 | 4.15 |
| walled depth | 12.60 | 12.60 |
| characteristic depth | 14.60 | 14.60 |
| garage depth | 7.50 | 7.50 |

Thicknesses measured by rays across each leaf: external **0.450**
(SOURCE_CORROBORATED from the 25 + 20 build-up — not printed as a figure
anywhere; section fill 0.455, plan fill 0.475), partition **0.120**, wall
return **0.610**, kotłownia north wall **0.260**. Footprint from the chains
130.665 m² against the published 131.16 m², **+0.38 %**, recorded and never
closed by moving a chain.

## 15. Roof audit (§15)

Pitch 40.000° from the emitted normals; ridge +7.950; knee wall 1.300 above
the attic floor; building height 8.270 above terrain (7.95 + 0.32); the roof
spans the full 14.600 m silhouette; three 78/118 rooflights all cut normal to
the roof with their lower reveals facing up at 50°; the eave walls carry the
roof with worst gap and overlap below 1e−15 m.

The eave contradiction is kept: the printed datum +4,67 sits **0.034 m**
above the structural plane 4.63556 the model uses, and taking +4,67 would
make the built pitch 39.71° against the printed 40°. Both readings stand
(ledger `eave-datum`, constraint `c-eave-datum`). The garage parapet band the
elevations read at 3.12 over the modelled 2.88 roof also stands unmodelled.

## 16. Four-facade comparison (§16, `npm run audit:marcowki:facades`)

The model is projected orthographically into each elevation view and compared
against every registered reading — spans, heads, silhouettes, band edges,
fascia lines, chimney positions, rooflight patches. **Metres, never pixels**:
the readings were taken off the calibrated renders once and are stored as
measurements in `src/elevations.ts` with the calibration recorded.

| | |
| --- | --- |
| registered features | 47 |
| pass | **36** |
| deviation | 9 |
| not modelled | 2 (the garage parapet band, east and rear) |
| **not found** | **0** |
| worst deviation | **0.185 m** |

Written to `stage-reports/artifacts/marcowki-facade-audit.json`. Every
deviation is a source conflict already in the ledger: the balcony's west edge
and the garage door reveal (plan against render, ~0.10 m, plan taken); the
front gable glazing head (printed callout against a render 0.19 m lower,
callout taken); the three returns' white faces (0.10–0.17 m, because the
render's white includes the roof edge band above the soffit); the balustrade
glass (0.12 m, the unresolved balustrade height); the front room window
(0.10 m, the render shows the glass inside its frame).

## 17. Screenshots (`stage-reports/artifacts/`)

Produced by the Playwright run against the production build. No official
imagery is committed.

| file | view |
| --- | --- |
| `marcowki-01-perspective.png` | perspective |
| `marcowki-02-front.png` | front elevation (orthographic) |
| `marcowki-03-rear.png` | rear elevation (orthographic) |
| `marcowki-04-west.png` | west elevation (orthographic) |
| `marcowki-05-east.png` | east elevation (orthographic) |
| `marcowki-06-top.png` | roof plan |
| `marcowki-07-roof-hidden.png` | roofs hidden, attic interior |
| `marcowki-08-attic-plan-roof-hidden.png` | attic plan, roofs hidden |
| `marcowki-09-ground-plan-interior.png` | ground storey isolated |
| `marcowki-10-selected-return-evidence.png` | a selected return with its evidence |
| `marcowki-11-stair-close.png` | **the staircase, framed close** — the four straight risers, the winder fan and the nine-riser flight |
| `marcowki-11b-stair-in-context.png` | the same stair in the ground storey, where the pantry partitions stand in front of it |
| `marcowki-12-entrance-close.png` | **the entrance door and its glazed sidelight, framed close** |

The `left` / `right` presets look from −x and +x, which are the **west** and
**east** elevations; the files are named by compass side.

## 18. Inspector (§20)

The inspector's **Composition** section states what the selected object is
made of, for every kind the stage added, with no Marcówki-only UI:

- a stair's rise, riser count and height, width, start and direction, every
  segment, the steps' extent and the slab void it rises through as a link;
- a slab's outline area, each hole's vertex count, area and extent, the net
  area, and the stair through it as a link;
- a roof opening's cut mode, its top and underside outlines and how far the
  underside is shifted uphill (or "same: vertical cut");
- a door's assembly panel by panel, with each panel's kind, fractions, clear
  width and hinge;
- a surface region's host wall, face, rectangle and material.

`cut`, a region's face, rectangle and material, and a stair's width, offsets
and waist are ordinary editable properties that go through the command path.
A **Frame** button frames the selection in the current view. Evidence is
shown for every one of them, with status, sources, locator and per-property
statuses.

## 19. Mutation results (§19, `test/mutations-01a.test.ts`, 15 tests)

Thirteen mutations, each applied to the real model, each caught by a **named**
checker that passes the unmutated reference:

| # | mutation | caught by |
| --- | --- | --- |
| 1 | the staircase reduced to a placeholder again | `stairReport.kind / parts / riserHeights` |
| 2 | the wrong rise (arrives 0.20 m low) | `stairReport.arrivalTop / riserHeights` |
| 3 | the footprint shifted 0.30 m west | `stairReport.firstRiserX` + slab material over the walking line |
| 4 | the stair void filled in | `slabVoidReport.holes / insideBlocked` |
| 5 | a rooflight cut vertically | `rooflightCutReport.normalRaysBlocked / undersideShift` |
| 6 | the entrance sidelight removed | `assemblyReport.panels / parts` |
| 7 | the sidelight on the wrong side | `assemblyReport.glassSide` |
| 8 | a finish region omitted | `regionReport.found` + the region count |
| 9 | a finish region on the wrong wall | `regionReport.hostOk` + a ray at the west face |
| 10 | the balcony edge shifted 0.40 m | `facadeAudit(front-balcony-west-edge).delta` |
| 11 | the balustrade shortened by a metre | `railingReport.run / coverage` |
| 12 | a door opening re-dimensioned | `openingDimensionReport.worst` |
| 13 | a raked head squared off | `openingDimensionReport.raked / worst` |

The BUILDAPP-01 catalogue (`test/mutations.test.ts`, 16 tests) still passes
unchanged. Mutation 12 exposed a real weakness while it was being written:
`openingDimensionReport` returned `NaN` when an opening was not where the
source puts it, and `NaN > tolerance` is silently false. It now reports an
unbounded error instead — a checker that cannot fail is worse than no
checker.

## 20. Gates

| gate | result |
| --- | --- |
| `npm install` | clean |
| `npm run typecheck` | clean (packages + web app) |
| `npm test` | **317 passed, 37 files** |
| `npm run build` | production build of BuildWorld |
| `npm run e2e` | **14 passed** (Playwright against the production build) |
| `npm run audit:marcowki` | **AUDIT PASS**, 95 checks |
| `npm run audit:marcowki:facades` | 47 features, 36 pass, 0 not found, worst 0.185 m |

Beyond the gates, the generic primitives were fuzzed before anything was
built on them: 200 randomised regions with holes, 400 randomised stairs and
60 randomised gable roofs in both cut modes, each checked for a closed
manifold, exact volume and real holes.

## 21. Unresolved source evidence (ledger, 33 entries)

Added or reframed by this stage: `stair-void-shape` (resolved),
`stair-winder-count`, `stair-waist`, `rooflight-clearance`, `finish-regions`,
`verge-band`, `entrance-panel-widths`, `garage-door-panels`,
`terrace-floors`, `revision-drift`, `schody-area`, `garage-door-position`,
`verge-white-band`, `east-band`. Every contradiction BUILDAPP-01 recorded is
still recorded; none was absorbed.

## 22. Files

New: `packages/model/src/stair-layout.ts`, `roof-cut.ts`;
`packages/geometry/src/region.ts`, `stair-compiler.ts`, `surface-regions.ts`;
`packages/reference-marcowki/src/revision.ts`, `published.ts`,
`elevations.ts`; `packages/reference-marcowki/test/fidelity.test.ts`,
`mutations-01a.test.ts`, `facade-audit.ts`;
`packages/reference-marcowki/scripts/audit-facades.ts`;
`packages/{model,commands,geometry,editor}/test/fidelity-1.3.0.test.ts`;
`packages/model/test/fixtures/demo-house-1.3.0.json`,
`marcowki-ge-1.3.0.json`; `docs/MARCOWKI_ARCHITECTURAL_FIDELITY.md`,
`docs/MARCOWKI_SOURCE_REVISION_POLICY.md`.

Changed: the schema, ids, issues, migration and validation in
`packages/model`; commands and apply in `packages/commands`; the compiler,
fills, roof compiler, features and types in `packages/geometry`; the editor
store; the web Inspector, Outliner, Toolbar, Viewport and scene adapter; the
Marcówki commands, facts, expected values, ledger and sources; the audit
script; the e2e spec; the architecture tests; `docs/`, `README.md`,
`PROJECT_STATUS.md`.

## 23. Recommended next bounded technical step

**Give the stair a balustrade and make the void's edge a real upstand.** The
stair is now a real staircase and the void a real hole, but neither has the
guarding a built stair must have: no balustrade follows the flights, and the
slab's void edge is a bare 0.33 m arris. Both are generic capabilities — a
railing that follows a stair's own path rather than a straight run, and an
upstand along a slab hole's boundary — and both have source support on the
attic plan, which draws a line along the void's north and west edges. The
work is bounded: extend `Railing` with a `hostId` that may be a stair and a
path derived from `layoutStair`, add the upstand as a slab property, and
prove both on a non-Marcówki building first.
