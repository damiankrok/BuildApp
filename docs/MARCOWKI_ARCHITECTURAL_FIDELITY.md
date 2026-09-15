# Marcówki architectural fidelity (STAGE BUILDAPP-01A)

STAGE BUILDAPP-01 put the Marcówki specimen through the generic pipeline: the
shell, the twelve facade openings, the roof, the rooms and the topology all
measured what the source prints. What it could not do was represent several
things the drawings plainly show, because BuildApp had no vocabulary for
them. It recorded each as a simplification and moved on.

This stage closed those gaps. Every one of them was closed by adding a
**generic capability** to the schema, the DSL and the compiler, and then
using it — never by special-casing this house. The generic packages still do
not know Marcówki exists (`tests/architecture/reference.test.ts`).

Schema `1.2.0` → `1.3.0`. What follows is what changed, what the source says,
and what is still open.

## 1. The staircase

**Before:** a `PLACEHOLDER` footprint — a 2.08 × 1.98 m box. The drawn
winders were not represented.

**Now:** a `FLIGHTS` stair, laid out by the model package from segments in
walking order, compiled into one closed solid of real treads.

```
segments: FLIGHT 4 risers, going 0.2725
          WINDER 4 risers, LEFT 90°
          FLIGHT 9 risers, going 0.265
```

It starts on the first riser line at x 5.37, runs east along the southern
band (app z 4.83..5.82), turns left through a quarter of winders fanned about
the newel at the corner x 6.46, and climbs north up the eastern band to
arrive on the attic floor at app z 7.94. Seventeen risers over the printed
3.06 m rise: **0.18 m each**, measured by rays up the walking line, not
asserted.

### Where the counts come from, and what is still open

| figure | value | status | source |
| --- | --- | --- | --- |
| first riser, corner line, band widths | 5.37, 6.46, 0.99 | SOURCE_DERIVED | ground-plan raster; the section finds the shaft at X 5.351..7.441 |
| straight risers, lower flight | 4 (going 0.2725) | SOURCE_DERIVED | nosing lines at x 5.376, 5.641, 5.919, 6.197 |
| straight risers, upper flight | 9 (going 0.265) | SOURCE_DERIVED | nosing lines z 7.782 … 5.665; the attic plan's walking line turns west at z 5.69 |
| winders in the corner | **4** | GEOMETRIC_INFERRED | the plan draws **no fan lines** in the 0.99 × 0.99 corner |
| riser height | 0.18 m | GEOMETRIC_INFERRED | 3.06 ÷ (13 + 4) |
| waist | 0.18 m | ASSUMED | no drawing shows the stair soffit |

Thirteen straight risers are *counted*. The winder count is not drawn, so it
is inferred from the one thing that is printed — the 3.06 m rise — by
choosing the winder count that gives a normal riser. **Three winders would
give 0.191 m and five would give 0.170 m; both are geometrically admissible**
and both are recorded, in the fact's own note and in ledger entry
`stair-winder-count`. Four is modelled because 0.18 m is the riser the
interior gold assumed and the usual one. This is an inference, and it is
labelled as one: the stair's evidence status is `GEOMETRIC_INFERRED`, with
`waist: ASSUMED` as a property override.

The top step moved. BUILDAPP-01 and the interior gold took the void's north
edge (reference z 6.79) as the top step. Both plans draw the northern flight
*past* that line, to z 5.66. The arrival is now where the nosing lines put
it (ledger `stair-void-shape`).

## 2. The slab void

**Before:** a notch in the plate's outline — the void was cut out of the
polygon because the compiler could not express a hole.

**Now:** `Slab.holes`, a first-class list of plan polygons removed through
the full thickness. The Marcówki void is the **L the stair actually
occupies**: the southern band from x 5.37 to the east inner face, and the
eastern band from x 6.46 north to the arrival, 4.158 m².

It is not a rectangle and it **touches the east inner face**, which is the
case that makes holes hard: a hole sharing boundary with the outer polygon.
The region tessellator handles it by cancellation — the two coincident,
opposite boundary segments have no material between them and annihilate —
so no bridging, no ear-clipping and no repair pass is needed
(`packages/geometry/src/region.ts`).

Proof, every run: the slab is a closed manifold; its volume is
(outline − hole) × thickness exactly; 1680 rays on a 0.05 m grid inside the L
meet no slab and 924 outside it meet the full 0.33 m; a ray 10 mm west of the
east inner face is open. The corner the old rectangle would have removed is
solid plate, and the band the old rectangle would have kept is open.

Old files still load: a 1.2.0 model has no `holes`, and its notched polygon
compiles exactly as before.

## 3. Rooflight cut mode

**Before:** every roof opening was a vertical prism. A roof window does not
sit in a vertical hole — it sits perpendicular to the slope — and the stage
recorded that as a simplification.

**Now:** `RoofOpening.cut` is `VERTICAL` (default) or `NORMAL_TO_ROOF`. For a
plate of perpendicular thickness *t* on a plane pitched θ, going from the top
surface to the underside along the inward normal travels *t · sin θ* uphill
in plan, so the underside outline is the footprint shifted that far towards
the ridge, with tilted reveals between them
(`packages/model/src/roof-cut.ts`).

The three Marcówki rooflights use `NORMAL_TO_ROOF`, which is the physically
right mode for a roof window. The two chimney penetrations stay `VERTICAL`,
because a stack rises vertically — and the validator *refuses* a normal-cut
penetration outright.

**Rays along the roof normal prove it.** Ninety-six rays per unit, fired
along the roof's own normal through a grid over the top outline: with the
normal cut, 96 of 96 pass clean through. Recompile the same model with
`cut: 'VERTICAL'` and rays near the uphill edge are blocked by material. The
underside shift is measured off the triangles by bisecting the wedge:
**0.135686 m**, against 0.21109 × sin 40° = 0.135686 predicted. A second,
independent signature: the lower reveals now face *upward* at 90° − 40° = 50°,
so they appear as minor upward planes in the roof's normal clusters with a
combined area of exactly 3 × 0.78 × 0.21109 m².

## 4. Composite openings

**Before:** every door was one leaf. The entrance's glazed sidelight, the
garage door's paneling and the garage side door's glazing were recorded as
not modelled.

**Now:** `Door.assembly` — panels side by side across the opening, each
taking a stated fraction of the width, with mullions between them. A `LEAF`
panel states its own hinge edge and may be glazed; `GLAZED` is a fixed pane
in its own frame; `PANEL` is a fixed solid. The frame is the opening
rectangle minus every panel's aperture, one closed solid, built through the
same region tessellator as the slab holes.

| door | assembly | evidence |
| --- | --- | --- |
| entrance 105/210 | `LEAF 0.72 (hinge LEFT) │ mullion 0.04 │ GLAZED 0.28` | hero render + front elevation |
| garage 275/225 | `PANEL 1` | front elevation reads one flush dark panel, no joints, at y 0.5 and 1.2 |
| garage side 100/210 | `LEAF 1, glazing FULL` | rear elevation reads the leaf as one glazed panel in a frame |
| kotłownia (concealed) | *none — one plain leaf* | no elevation shows it |

The sub-panel widths are **VISUAL_INFERRED** and say so. The entrance split
is uncertain by about ±0.07 of the width: the facade gold reads the leaf over
0..0.72 and the glass over 0.76..1.00, while a re-read of the 1280 px front
elevation puts the glass at 0.645..0.95. The modelled split is recorded with
that uncertainty in ledger `entrance-panel-widths`. The hinge edge is
ASSUMED — the leaf is drawn closed.

The concealed door is the control: nothing was invented for a face no source
shows.

## 5. Interior door heights

Unchanged, deliberately. All eleven interior doors are 2.00 m and every one
carries `height: ASSUMED` with the note *"no interior opening is dimensioned
vertically"*. The one facade door with an assumed head — the concealed
kotłownia door — says so too. Every other facade opening's height is sourced,
and the audit prints the width and height status for all twelve.

## 6. Finish regions

**Before:** the cladding bands were recorded as "materials, not geometry" and
left off, except that the ground front wall and the portal head were given a
dark material wholesale.

**Now:** `SurfaceRegion` — a wall-local rectangle on the OUTER or INNER face
showing a material. It is appearance with no thickness of its own: the
compiler draws it as a 2 mm skin standing 3 mm clear of the face (so nothing
z-fights), clips it to the wall's real material — the roof soffit above, the
face's physical extent along — and **leaves every opening out of it**.

| region | host | across | up |
| --- | --- | --- | --- |
| `sr-front-timber-ground` | `g-front` | 0.657 … 3.185 | 0 … 3.06 |
| `sr-front-timber-gable` | `u-front` | 0.657 … 3.940 | to the roof soffit |
| `sr-rear-timber-west` | `g-rear` | 0.610 … 2.258 | 0 … 2.41 |
| `sr-rear-timber-east` | `g-rear` | 6.958 … 7.290 | 0 … 2.41 |
| `sr-west-dark` | `g-left` | ref z 4.568 … 9.909 | 0 … 2.377 |
| `sr-east-dark` | `g-right` | ref z 3.906 … 5.10 | 0 … 2.360 |

Every edge is a reading off a calibrated elevation render at a stated row or
column, so every region is **VISUAL_INFERRED**. Regions change no wall
volume (checked against a compile with the regions removed), survive save and
load, and are hidden with their host wall.

The front gable band is the one that exercises the clipping: its top follows
the 40° rake to within a millimetre of the host wall's own top, so it is a
gable-shaped band, not a rectangle painted over a gable.

## 7. The recess floors

The front portal and the rear loggia now have floors: `TERRACE` plates from
±0,00 down to the −0,32 terrain datum, over x 0.61..11.44 and x 0.61..7.29.
The elevations draw the plinth line continuous under the returns and across
both recesses. The thickness is GEOMETRIC_INFERRED, matching the ground
slab's plinth.

Both recesses are still **real recesses**: at 1.2 m above the floor the first
material is a full metre in, on both sides. The garden paving, the entrance
step, the driveway and the portal soffit lighting strip beyond the outer
planes stay out (ledger `terrace-floors`).

## 8. What the four facades now say

`npm run audit:marcowki:facades` projects the model orthographically into
each of the four elevation views and compares it against every registered
reading — spans, heads, silhouettes, band edges, fascia lines, chimney
positions, rooflight patches. It compares **metres, never pixels**; the
readings were taken off the calibrated renders once and are stored as
measurements in `packages/reference-marcowki/src/elevations.ts`, with the
calibration recorded so a reader can go back to the asset.

Of 47 registered features: **36 pass**, 9 deviate, 2 are features the model
deliberately does not carry, and **0 cannot be found**. The worst deviation
anywhere on the four facades is 0.185 m. Every deviation is a source conflict
that was already known and is named in the ledger:

- the balcony's west edge (plan 3.338 against render 3.236) and the garage
  door reveal (plan 8.554 against render 8.460) — plan and render disagree by
  about 0.10 m in both cases, and the plan is taken;
- the front gable glazing head — the printed 270/320 callout against a render
  reading 0.19 m lower; the callout is taken;
- the three returns' white faces, 0.10..0.17 m higher on the renders than the
  returns' tops, because the render's white includes the roof edge band above
  the soffit;
- the balustrade glass, 0.12 m — the same unresolved balustrade height the
  earlier stage recorded;
- the front room window, 0.10 m — the render shows the glass inside its
  frame.

The two not-modelled features are the ~0.2 m parapet upstand on the garage,
which the section does not draw.

## 9. What is still open

The ledger carries 33 entries. The ones this stage added or reframed:

| id | kind | what |
| --- | --- | --- |
| `stair-void-shape` | RESOLVED_CONTRADICTION | the void is the L, not the old rectangle |
| `stair-winder-count` | UNRESOLVED | 4 winders modelled; 3 and 5 admissible |
| `stair-waist` | SIMPLIFICATION | 0.18 m, no drawing shows the soffit |
| `rooflight-clearance` | SIMPLIFICATION | normal cut, zero clearance around the unit |
| `finish-regions` | SIMPLIFICATION | band edges are render readings, ±0.05 m |
| `verge-band` | NOT_MODELLED | the white band along the gable rakes |
| `entrance-panel-widths` | UNRESOLVED | the 105 opening's leaf/sidelight split |
| `garage-door-panels` | SIMPLIFICATION | one flush panel; sectional heights not readable |
| `terrace-floors` | SIMPLIFICATION | plinth to the terrain datum; paving excluded |
| `revision-drift` | CONTRADICTION | the two published revisions (see the revision policy) |
| `schody-area` | CONTRADICTION | published 5.63 against the drawn compartment |
| `garage-door-position` | CONTRADICTION | plan 8.554 against render 8.460 |
| `verge-white-band` | CONTRADICTION | render white above the returns' tops |
| `east-band` | UNRESOLVED | the east band's north end, 0.01 m |

The contradictions BUILDAPP-01 recorded are all still recorded. The printed
eave datum +4,67 still sits 0.034 m above the structural plane 4.63556 the
model uses, and taking +4,67 would make the built pitch 39.71° against the
printed 40°. Both readings are kept.

## How this is checked

| | |
| --- | --- |
| generic capabilities, without this house | `packages/{model,commands,geometry,editor}/test/fidelity-1.3.0.test.ts` |
| the specimen's fidelity | `packages/reference-marcowki/test/fidelity.test.ts` |
| thirteen ways it could regress | `packages/reference-marcowki/test/mutations-01a.test.ts` |
| deterministic audit | `npm run audit:marcowki` |
| four-facade comparison | `npm run audit:marcowki:facades` → `stage-reports/artifacts/marcowki-facade-audit.json` |
| in the browser | `apps/web/e2e/marcowki.spec.ts` |

The mutation catalogue is the part worth trusting: thirteen plausible
regressions — the stair back to a placeholder, the wrong rise, the footprint
shifted, the void filled, a rooflight cut vertically, the sidelight removed,
the sidelight on the wrong side, a region omitted, a region on the wrong
wall, the balcony edge moved, the balustrade shortened, a door re-dimensioned,
a raked head squared off — each applied to the real model and each caught by
a **named** checker that passes on the unmutated reference.
