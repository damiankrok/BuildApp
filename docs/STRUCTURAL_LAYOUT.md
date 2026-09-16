# The structural layout

*What the building is made of, settled before anything is drawn.*

## Why there is a layer here at all

A reconstruction that goes straight from "the widest dimension is 15.30 m and
the deepest is 11.44 m" to "here is a wall ring" has already decided that the
building is one rectangle. No amount of careful fitting afterwards can undo
that decision: the garage, the recess, the second roof and the storey that
covers only half the plan are gone before the first wall is emitted, and every
later stage is busy positioning openings on a box.

So the composition is settled first, separately, and sealed as its own
artifact:

```
SourcePackage → SourceObservationGraph → MetricEvidenceSet
              → StructuralLayoutHypothesisSet          ← this document
              → PrimitiveHypothesisSet → solver → Building DSL → model
```

The contract is `buildapp.structural-layout-hypothesis-set@1.0.0`. It carries
the three input hashes, so a layout is always traceable to the bytes it was
read from, and the candidate built from it carries the layout's id, hash and
gate verdict (`structuralLayoutId`, `structuralLayoutHash`,
`structuralStatus`).

## What is in it

| field | what it holds |
|---|---|
| `storeys` | the levels the sources actually show, and which drawings show them |
| `footprintRegions` | per storey, the areas the plans enclose — `BUILT`, `RECESS` or `ZONE` |
| `masses` | regions stacked through the storeys that cover them: what a building is a composition of |
| `attachments` | how the masses stand against one another |
| `recesses` | pockets, as topology: a mouth, a back, two returns and a depth |
| `roofSupports` | one roof system per MASS, never one over the bounding box |
| `facadePlanes` | the exterior faces, by mass and side |
| `alternatives` | readings that were considered and lost, with the margin |
| `conflicts` | sources that disagree, reported and never reconciled |
| `unresolved` | what the sources do not settle, named |
| `traces` | every item back to the pixels it was read from |
| `gate` | `ACCEPTED`, `PARTIAL` or `REJECTED`, with named reasons |

Every quantity is a `LayoutQuantity`: a value, a spread, a basis
(`MEASURED`/`DERIVED`/`SCALED`/`ASSUMED`), the evidence ids it rests on, and a
sentence saying why. A number with no basis is not in the contract.

## Plan decomposition

The plans are the only drawings that state a building's composition. Reading
them is four steps, and none of them is "take the largest connected
component".

**1. Wall bands.** A technical plan draws almost everything as thin line work
and draws the one thing that is structure — the walls — as solid bands several
pixels thick. A pixel belongs to a horizontal band when the VERTICAL run of ink
through it is between a wall's minimum and maximum thickness and the HORIZONTAL
run through it is long. Furniture fails the first test; a logo, a shrub or a
solid arrow fails it too, because its run across is far thicker than a wall.
Bands are merged along their own axis across the gaps that openings make, and
each band keeps its `segments`: the fraction says how much wall there is, the
segments say where the wall is NOT.

**2. Grid lines.** A chain segment boundary is a metric statement; a wall band
axis is a drawn fact; a line supported by both is worth more than either.
Chains keep their positions, because a dimension is the only thing on the sheet
that states a length, and bands then join the chain line they belong to. A
witness line is struck on a wall's FACE and a band's axis runs down its CENTRE,
so a band may join a line on its axis or on either of its faces; where several
chains break inside one wall, the one measuring more of the building takes it.

A band also makes a line of its own when it runs WALL TO WALL, however short it
is. The two side walls of a 1.60 m loggia are a tenth of a plan long and are
structure all the same, and without a line on them the recess has no sides.

**3. Closure and flood fill.** Every grid edge gets a closure: how much of it
is shut, by wall bands, by continuous line work (a glazed wall is still a
wall), and by the holes in a wall that carries on either side of them. That
third term is what makes a garage a garage. A wall with a 2.4 m door in it is
36% covered and 100% a wall, and a reader that treats it as a missing face
floods straight through the door and reports the garage as open ground. A hole
BETWEEN two pieces of one wall counts as shut; a hole at the END of one does
not, because that is where the wall stops. The cap — 3.2 m, the widest hole a
domestic lintel spans — is the only thing separating a garage door from the
mouth of a loggia, and it is a named convention.

The fill then floods CELLS rather than pixels, from outside the plan inwards.
A cell nothing reaches is built; a cell shut on three sides inside the walled
envelope is a pocket; everything else is ground.

**4. Bodies.** Regions are maximal rectangles and a building is not obliged to
be one. Two adjacent regions with NO WALL DRAWN BETWEEN THEM are one body:
nothing is drawn between them, you walk from one to the next without passing a
wall, and reporting them as three bodies is the same error as reporting the
whole plan as one box, made in the other direction. A body is turned back into
a rectangle only when it IS one — when its bounding box is covered by its own
cells and by the pockets bitten out of it.

## Storey registration

Two plans of the same building are two drawings at two scales with two origins,
and nothing on either says where north is. Registration is a bounded DISCRETE
search, not a fit:

- **Scales**: the ratio of the two plans' own printed scales, when both state
  one, and the scale that makes the upper plan the size of one of the bodies
  below. Anything with more than 15% of anisotropy is refused outright.
- **Offsets**: each face of the target, the centre, and where the two plans'
  own chains put it. An upper storey does not have to be concentric with the
  one below — it steps back from one wall and stays flush with the other — so
  a centre-matching registration cannot express the commonest thing there is.

Candidates are scored on length-weighted wall-axis agreement plus a small
prior for covering more of the storey below, which falls away past a full
covering because a storey covering twice the one below is not a simpler
explanation but a wrong one. A placement the two plans' chains STATE gets a
small bonus over one assumed from how storeys usually stack, and readings that
put the plan in the same place are collapsed into one: a square plan is flush
with both its side walls and centred between them at once, and reporting that
as three readings turns agreement into doubt.

## The mass graph

A mass is a footprint, a storey span, the faces it shows to the outside, the
roof over it, and the evidence for all of it. Masses relate by
`ATTACHED_TO`, `SHARES_WALL_WITH`, `PROJECTS_FROM`, `RECESSED_WITHIN`,
`SUPPORTS`, `TERMINATES_AT`, `ABOVE` and `BELOW`.

Roles are assigned from the evidence and not from a list of building types:
the largest body that reaches highest is `MAIN`, and a smaller body sharing a
wall with it is `ATTACHED`. Nothing in the pass knows what a garage is.

## Roof systems

One roof per mass. A building with a house and a garage has two roofs at two
pitches and two ridge heights, and taking one roof over the union of them is
the same category of error as taking one rectangle over the plan.

Authority is ranked and never averaged:

| authority | what it is |
|---|---|
| `PUBLISHED_SPECIFICATION` | the publisher's own text: "dach: dwuspadowy, nachylenie 40 st." |
| `PRINTED_ANGLE` | a number printed against a rake on a technical drawing |
| `SECTION` | a pitch derived from a measured rise over a known span |
| `ELEVATION` | corroboration from a fitted edge |
| `CONVENTION` | a stated assumption, marked as one |
| `NONE` | nothing; the kind is left `UNKNOWN` and the hole is named |

A source-supported exact angle NEVER becomes something else because a
silhouette fit prefers it. Where the two disagree the printed value is kept,
the residual is reported as a `ROOF_EVIDENCE_DISAGREES` conflict, and the gate
degrades. That is tested: a fixture whose section measures 38° and whose
drawing prints 25° comes out 25° with the disagreement on the record.

**Which way the ridge runs** is arithmetic where a pitch is stated: a gable of
span `s` at pitch `p` rises `s/2 · tan p` above its eaves, a section states the
eaves and the ridge, and of a rectangular mass's two spans only one reproduces
that rise. Where nothing states a pitch, the ridge is taken to run the long
way, which is what a builder would assume — and the assumption is named as one.

## The gate

Before anything is emitted, the layout is judged. Checks are about AGREEMENT
BETWEEN SOURCES rather than plausibility: each takes something the layout says
and something a source states and asks whether they are the same.

| verdict | meaning |
|---|---|
| `STRUCTURAL_LAYOUT_ACCEPTED` | no source contradicts it |
| `STRUCTURAL_LAYOUT_PARTIAL` | a source contradicts it on something it could reasonably be wrong about |
| `STRUCTURAL_LAYOUT_REJECTED` | it contradicts a printed number, or is internally impossible |

A layout that overlaps its own masses is rejected. A footprint area more than
6% from the publisher's printed figure is noted, more than 20% degrades, and
beyond that blocks. Every verdict carries reasons, and every reason names
numbers.

## §21: drawing the massing against the drawings

The gate above asks whether the numbers agree. The projection audit asks the
harder question: would anyone RECOGNISE this?

Each body is projected into every elevation that registers — as the block it
is, with a gable drawn as the triangle it is and a flat roof as the line it is
— and the model's top edge is compared with the traced outline, sampled across
the view, in metres. The overall extents prove nothing, because the
elevation's scale was fitted to them; what is not fitted is everything between
the two ends, and that is what is measured.

It fires. A one-box reading of a house with a garage misses by two and a half
metres; so does a garage put on the wrong side, or a ridge run the wrong way.
Two bodies drawn at one height are caught separately, because they read as one
body however the plan divides them.

Where the "elevation" a publisher ships is a photo-realistic render, the
outline traced on it is metres wider than the building and includes the ground,
the planting and the driveway. Comparing a roofline with that measures the
landscaping, so a view whose outline is more than a quarter wider than the
bodies under it is reported as UNCHECKABLE, with the surplus in metres, rather
than producing a residual read off a shrub.
