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
not, because that is where the wall stops. Up to 3.2 m, the widest hole a
domestic lintel spans, the width alone shuts it: that is a named convention.

**Wider holes are weighed on evidence, not by width (BUILDAPP-03Y2G).** A 5 m
double garage door and the open side of a carport are the same width, and so
are a 6 m glazed wall and the mouth of a loggia. Raising the cap would only
move the error, so a gap between 3.2 m and `maxWideOpeningM` (8 m) is recorded
as a `WideOpeningDecision`, with its evidence:

- `infill`: how much of the gap has line work drawn across it, such as a door
  leaf, glazing or a sill.
- `callout`: a printed width that matches the gap.
- `corners`: whether the wall carries on at both ends.
- `pocketM2`: the area of what lies behind the gap.

The gap is `OPENING_IN_WALL` when the wall carries on and either drawn infill
covers at least 70% of the gap or, in a gap with nothing drawn across it, the
enclosed area behind it is a room, not a pocket: more than max(6 m², 2.5 ×
width²). A loggia about as deep as its mouth stays `OPEN_SIDE`. A callout alone
never shuts a gap in a wall.

**Bays.** Two walls can leave the walled envelope side by side and run out,
like a projecting garage or a carport. That is a `PlanBay`, and its mouth is
decided the same way:

- Both side walls must reach the mouth.
- Piers must stand at both corners, measured over the mouth wall's own
  thickness.
- Drawn infill across the mouth, or a callout that prints the mouth's width,
  shuts it.
- Piers alone do not shut a mouth.

A shut bay is a built body, and an open one is ground.

**Hypotheses.** Two enclosures are computed and both are recorded:

- `H0_STRICT_ENCLOSURE`: only walls and short holes shut an edge.
- `H1_WIDE_OPENING_CONTINUITY`: the evidenced wide openings shut it too.

H1 is chosen when the two differ. `hypotheses` lists what each one built, so
a reviewer sees what the continuity bought. Nothing falls back to a rectangle
from the outermost dimensions: when no enclosure survives, the run fails with
`PLAN_NO_ENCLOSED_CELLS` or `PLAN_NO_BUILT_REGIONS`.

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

**5. The extent against the box (005F).** The plan's extent is what its
exterior dimension chains state; the long-band box is what its long walls
close. Where a side the chains state (SUPPORTED: an exterior chain covering
the wall witness ends on it within a wall; STRONG: two such chains on lines
more than a wall apart ending within a wall of each other, or one closed by its
own readings alone — never by a value a scale restated or chose) lies two walls
or more past the box, with stretches no built
cell explains, the side is an `ENVELOPE_EXTENT_CONFLICT`. It is always
recorded and fills nothing by itself: a terrace, a canopy or a yard is what
an extent past the walls most often is. What the outline encloses there is
judged as a part:

- a part is the floor one reaches from the house through open edges and
  door-like openings; floor behind a wall that nothing passable reaches is
  split off as `WALLED_OFF` when one could stand in it (a door's width across
  both ways), and stays with the part's walls when it is narrower (a reveal,
  a niche);
- an **attached room** is built when it has a way in from the house (open
  edge or door-like openings at least a door wide), its own perimeter mostly
  wall and not posts, evidence of a room of its own (glazing between wall
  jambs on its own outer walls — never on the line it shares with the house —,
  a chain across it ticking within a wall of both its ends, or a vehicle door
  that is not only a dashed line), two returns, and it reaches the stated side
  — clipped to its own free floor (wall-thick ink is not floor), never the
  strip's full length;
- inside the box, a room's **end** the incumbent grid had no line for (only an
  unread exterior chain ticks its wall) is completed when it continues the
  built rooms across an open edge and both jamb policies close it — drawn
  openings alone, or a vehicle door (wall jambs, 2.2–3.2 m, a stroke or a
  dashed line in it, never blank) with a vehicle's length of floor behind it,
  reached across open edges only, measured whichever way up the plan is drawn;
- everything else is rejected by name (`WALL_SLIVER`, `SEPARATE`,
  `NO_CONTINUATION`, `NO_WAY_IN`, `WALLED_OFF`, `POSTS`, `NOT_WALLED`,
  `NO_ROOM_EVIDENCE`, `NO_RETURNS`, `BEYOND_EXTENT`), and a part too large or
  that the two policies disagree on is a question (`TOO_LARGE`,
  `POLICIES_DISAGREE`). Parts are judged largest first, at most `maxParts`; the
  ones the cap leaves are counted (`completionsUnjudged`) and keep the
  conflict from being called a zone.

**A declared limit.** A terrace whose parapet is as thick as a wall, with a
glazed balustrade between its stubs and a door from the house, is the same
drawing as a glazed bay, and is built as one; so is a yard whose gate is drawn
as two lines in the wall's thickness. Thickness is the only thing that tells
them apart — a parapet thinner than a wall is `NOT_WALLED` or encloses nothing
— and no rule over the drawing alone can do better without room semantics.

The decided shape keeps the bodies the box reading had as they were; the
completed parts are laid against them. The published footprint is never an
input: it verifies afterwards.

## Storey registration

Two plans of the same building are two drawings at two scales with two origins,
and nothing on either says where north is. Registration is a bounded DISCRETE
search, not a fit:

- **Scales**: the ratio of the two plans' own printed scales, when both state
  one, and the scale that makes the upper plan the size of one of the bodies
  below — or of the house without the attached rooms the boundary completed
  (005F), since a single-storey room against the house widens the envelope
  without widening the storey above. Anything with more than 15% of anisotropy
  is refused outright.
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
