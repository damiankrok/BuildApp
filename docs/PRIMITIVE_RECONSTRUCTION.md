# Primitive reconstruction

*From "the sources show something here" to "this might be a building primitive".*

`PrimitiveHypothesisSet` (`buildapp.primitive-hypothesis-set`, schema `1.0.0`)
is the layer between an observation and a wall. It exists because those are
different claims with different evidence, and collapsing them is how a
reconstruction becomes confident about things it has no right to be confident
about.

A hypothesis is:

- a **kind** from a fixed vocabulary — `BUILDING_MASS`, `LEVEL`, `WALL_RING`,
  `WALL_SEGMENT`, `SLAB`, `ROOF_SYSTEM`, `ROOF_PLANE`, `OPENING`, `WINDOW`,
  `DOOR`, `RECESS`, `LOGGIA`, `BALCONY`, `RAILING`, `CHIMNEY`, `STAIR`,
  `SURFACE_REGION`, `LINEAR_SOLID`;
- **parameters**, each with a value, an interval, and a **basis**;
- **sightings**: where it was seen, per view;
- **rivals**: hypotheses describing the same ink that cannot both stand;
- a **trace** to every observation and every piece of metric evidence it rests
  on. This is mandatory. A primitive with no support is not a hypothesis, it is
  an invention.

## The basis is the point

Every parameter says where its number came from:

| basis | meaning |
|---|---|
| `MEASURED` | read from a printed dimension, a level datum or an angle |
| `DERIVED` | computed from measured things |
| `SCALED` | taken off the drawing through a registration, with no printed number |
| `CROSS_VIEW` | corroborated by a second view |
| `ASSUMED` | a building convention used because the sources say nothing |

A number measured off a dimension line and a number defaulted from a
convention are both floating-point numbers of the same magnitude, and without
this field they are indistinguishable three layers downstream. Everything
`ASSUMED` also appears in the candidate's `unresolved` list.

## Fusion: 151 sightings, not 151 beams

A deterministic CV pass over four elevations of one house finds around 150
thick linear bands. Most of them are the same member seen at two resolutions,
one member found twice by two detectors, one long member found as four pieces
because a downpipe crossed it, or a shadow. A reconstruction that turns 150
bands into 150 beams has not reconstructed anything — it has transcribed its own
detector's noise into three dimensions.

Five reductions, in order, each with a stated reason:

1. **Duplicate suppression** — two candidates on one drawing whose boxes
   overlap, *or where one contains the other*. The containment half matters: a
   band detector finds one beam as a stack of sub-bands — top edge, whole thing,
   bottom edge — whose intersection over union is low precisely because one is
   inside another.
2. **Clustering** across renderings of one drawing, compared in normalized
   coordinates. Two resolutions of one sheet are one sheet.
3. **Continuity merging** of collinear pieces with a small gap — small against
   their own length, because two genuinely separate fins are also collinear.
4. **Source-role weighting.** An orthographic elevation is authoritative about
   position and extent and nearly worthless about depth; a perspective render
   is the reverse. Weighting each view by what it can actually see is the
   difference between using a render and being misled by one.
5. **Cross-view corroboration.** A member seen in two views that agree is worth
   much more than one seen once.

Every candidate that goes in is accounted for on the way out: the set carries
`rawCandidates`, the count after each stage, `accepted`, and a list of reasons
with counts. The fusion ratio is a reported number, not a claim.

## What becomes a solid

A `LINEAR_SOLID` is built only where a view that CAN see depth says the member
stands proud of the wall. A flat coloured band with no depth evidence is
recorded as unresolved, with the reason, and is not built. How FAR it stands
proud is a separate question that an elevation cannot answer at all: the
candidate takes the member's visible width as its depth, marks the parameter
`ASSUMED`, and names it as a hole.

## Vocabulary, not geometry

Nothing in this layer is in the model's coordinate system and nothing is a DSL
command. Turning a hypothesis into geometry is the solver's job, and the solver
is allowed to reject it. See [RECONSTRUCTION_SOLVER.md](RECONSTRUCTION_SOLVER.md).
