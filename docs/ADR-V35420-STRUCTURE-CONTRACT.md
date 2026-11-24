# ADR v3.54.20 — the structure read as a contract the builder executes, and what was built read back

Status: accepted for v3.54.20 (APK 1353). Supersedes decision 15 of `ADR-V35419-PLAN-SKELETON.md` (the typed form as a
witness only). Code: `packages/analysis-service/src/consult/{form-read,structure,readback}.ts`, `massing/massing.ts`.

## Context

v3.54.19 showed that the interior from the plan transfers to new houses and the exterior form does not: a hip was built
as a gable (a hip seen from its short side IS a triangle), a two-storey house with a garage as one storey under a steep
roof (the garage's two outline steps were "small" and smoothed away), a LOCAL body with flat annexes stood because the
other body had a registration against it. The typed form read named roof kind and ridge direction right on thirteen
known houses, was asked only when LOCAL carried flat boxes beside a pitched roof, and its verdict answered AGREES for a
gable built where a hip was reported. The information existed and had no road to the geometry.

## Decisions

1. **One typed structure read of all sheets (`form-read/2`, form 2.0.0).** One request: every sketched elevation with the
   publisher's caption, the ground-floor plan, a section where the page has one, the page's facts as text. It reports
   storeys (and which sheet settles them), the main volume's roof kind and ridge direction, pitch / eaves / ridge each
   with a status (PRINTED, DERIVED, ESTIMATED, UNKNOWN — UNKNOWN has no number), the OTHER volumes under their own roofs
   with side, storeys, roof and ridge, the things that are NOT volumes (recess, porch, bay, dormer, balcony, canopy,
   carport, terrace), and for every elevation picture the side it shows and how the main roof looks on it. The wire keeps
   the main volume's fields flat (a nested object came back mis-encoded from the provider, twice); a nested value sent as
   its own JSON text is decoded. An answer that contradicts itself (a flat roof with a ridge, a number with status
   UNKNOWN, a ridge below the eaves, a picture that was not given) is refused by name.
2. **Sides have one definition.** LEFT and RIGHT are those of a person standing outside in FRONT of the house looking at
   the front elevation; the prompt says so, the body's frame says the same (x grows to that person's right, z from the
   front back), and the opening readback states for every wall which hand its start corner is on seen from outside.
3. **Nothing of the read reaches the builder as a bare claim (`structure.ts` 1.0.0).** Each property stands AGREED (an
   independent witness says the same), UNWITNESSED (nothing else speaks; taken, named as taken on the read alone) or
   DISPUTED (a witness says otherwise; NOT taken, both statements on the record). Witnesses: the storeys the page
   publishes plans for, the page's building height and roof pitch, the parts the plan read names, and the elevation
   sketches' own polygons — a wall drawn up to the roof's top is a gable wall, which a hip does not have. A wrong answer
   that a witness contradicts does not build; a wrong answer nothing contradicts does (the limit of this decision).
4. **The builder takes what is agreed (massing 1.9.0).**
   - A part reported on a side where the outline steps out is a body of its own, cut off the outline BEFORE any
     small-step convention (`wingOnSide`); the rest is read as before. No step on that side: no body, named.
   - The roof KIND: a hip the silhouettes read as a gable is built as a hip with one pitch all round, its ridge along the
     longer side (the hip run = half the span is a DISPLAY_ASSUMPTION, named); a gable read as a hip is built as a gable.
   - The RIDGE direction of a gable, the heights kept, the pitch following the new span.
   - The STOREYS: walls below two storeys under a roof over two full storeys are raised to where the agreed pitch from
     the drawn ridge puts them, else to eaves the read states as PRINTED or DERIVED (never ESTIMATED); the same downwards.
   - A silhouette reading with no roof (a gable wall sketched up to the ridge, nothing told apart as a roof) under a
     reported pitched roof takes the drawn top as the ridge and the agreed pitch.
   Heights and spans stay the drawings'; the read contributes kind, direction, storey count and — only with a status of
   PRINTED or DERIVED — an eaves height.
5. **The form decides between two bodies the pictures contradict alike (arbitration 1.4.0).** The structure is asked of
   every house with two sketched elevations. Where it contradicts LOCAL's body and agrees with the body built from the
   outline, that body stands if it is contradicted no more than LOCAL's, its printed dimensions are no worse and the
   page's height does not refute it. `formVerdict` 2.0.0: another roof kind CONTRADICTS.
6. **Unlabelled elevations take the read's side** where registrations and the plan's openings do not tell the
   assignments apart (before the source-order convention), up to three pictures; and the typed list of an elevation's
   openings is asked of the picture the read saw on a side that has no assigned sketch.
7. **What was built is read back from the delivered model (`readback.ts` 1.0.0).** `OPENINGS_READBACK`: every exterior
   opening in its host wall's frame — from the wall's start corner, its width, to the end corner (the three add up to
   the wall's length, checked), the hand of the start corner seen from outside, the sill above the FLOOR of the wall's
   level (and above ±0.00, apart), the structural size — beside the values the executor bound, with the difference per
   property. `STRUCTURE_READBACK`: bodies, roof kind, ridge, wall top, against the taken structure. These are
   measurements of the model, not records of commands.
8. **A chimney stands inside the walls of its body** (executor 1.11.0): its depth from one elevation is where it meets
   the roof, near the eaves the wall's own plane; it is slid just inside that wall instead of being rolled back whole.
9. **Filled walls are a stroke along the outline** (plan skeleton 1.3.0): where the fixed strip beside the traced edge
   holds the wall colour on less than a quarter, the colour as a filled stroke within the snap reach along a quarter of
   the outline says the walls are filled (a house whose outline is half glazing was refused at 24 %).

## What a number means (the contract's vocabulary)

| Quantity | Meaning here |
|---|---|
| opening offset | along the host wall's outer-face line from its START corner (metres); `startIs` = that corner's hand seen from outside |
| opening width / height | the structural opening the wall is cut with; not a frame, not a pane; a balustrade or an obstruction does not shorten it |
| sill | above the floor of the wall's own level; `sillAboveZeroM` is the same edge above the model's ±0.00; neither is a height above the ground |
| eaves (structure read) | the top of the walls under the eaves above the ground floor's floor; `eavesM` of a roof spec is the roof's top surface at the wall face (the slab's vertical thickness above it) |
| ridge | above the ground floor's floor; the page's building height is from the ground and is held against it within a plinth |
| roof overhang | a horizontal reach past the wall face (eaves and verges apart, `SET_ROOF_OVERHANG`), never a length along the slope |
| status | PRINTED / DERIVED / ESTIMATED / UNKNOWN on the read's numbers; fidelity SOURCE_* / DISPLAY_ASSUMPTION / TRACE_UNCERTAIN on built properties |

## Named and not built (no consumer yet)

- recesses, porches, bays, dormers, balconies, canopies, carports, terraces: reported in `notVolumes`, recorded, not built;
- a soffit (the underside of the eaves or of a canopy), its extent and material: no field in a read, no consumer;
- an opening with a sloped head (a gable glazing): built by its bounding rectangle, cut to the wall's top; the model's
  `head` property has no consumer in the correction registry;
- storeys as separate levels: a two-storey body is one wall ring to the eaves; the interior is the ground floor's;
- a hip's ridge length where no view along it draws a trapezoid: one pitch all round (DISPLAY_ASSUMPTION).

## Considered and not taken

- **The read as the only builder** (heights and spans from its ESTIMATED numbers): an estimate is not a measurement.
- **Trusting the read over a sketched gable wall**: the dispute keeps both and the silhouettes' reading stands.
- **Building reported parts where the outline has no step**: two bodies in line are told apart by the elevations' step
  (unchanged); a reported garage with nowhere to stand is named, not invented.
- **A second, targeted read to settle a dispute**: the right next step where a dispute costs a house; not started.
