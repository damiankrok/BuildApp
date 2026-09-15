# The reconstruction solver

*From sealed evidence to a sealed building candidate.*

## The order is the argument

1. **Massing** from the plan's dimension chains. The footprint is the one thing
   a set of drawings states unambiguously and repeatedly, so it is settled
   first and everything else is measured against it.
2. **Levels** from the section's ladder of level datums. A section marks the
   floor of each storey, then the EAVES where the walls stop, then the ridge —
   so the top two datums are not storeys, and reading them as storeys is how a
   two-storey house comes out three storeys tall with a flat roof inside it.
3. **Views** registered against 1 and 2. An elevation states no dimension of
   its own, so it borrows both of its scales from numbers already established —
   never from a camera fitted to its own pixels.
4. **Openings and facade solids** read off those registered views, after fusion.
5. **The roof**, derived: the ridge above the eaves over the span gives the
   pitch, and a printed pitch corroborates it where one is legible.
6. **The program**, emitted and sealed. Nothing else may touch the model.

## Registering an elevation

One scale, fitted from the HEIGHT. The silhouette runs from the ground to the
ridge and the section states both, so the vertical is trustworthy. The
horizontal is not: a pitched roof overhangs its gable ends, so the silhouette
is wider than the wall beneath it by twice the eaves projection. Registering
that width against the footprint reports ten per cent of anisotropy that is
really a roof.

Fitting one scale from the height and letting the surplus width MEASURE the
overhang turns an assumption into a measurement, and it settles which wall the
drawing shows: an elevation's width in metres is either the footprint width
plus a little or the depth plus a little, and "plus a little" is the only
direction an overhang can go.

Handedness is the easy thing to get wrong. The ring is traversed anticlockwise
with the building on the left of travel and an elevation is drawn from OUTSIDE,
so the left-hand edge of the drawing is the end the wall STARTS at, for all
four walls, with no reflection anywhere. Getting it backwards mirrors every
facade: the model still builds, every opening is the right size, and the front
door is at the wrong end of the house. The projection audit is what catches it.

## Three constraint classes, never mixed

| class | meaning | how it is solved |
|---|---|---|
| `HARD` | the drawing STATES this | satisfied exactly; never traded off |
| `SOFT` | the sources SUGGEST this, with a weight and a tolerance | weighted least squares; residual reported |
| `UNRESOLVED` | the sources do not determine it | carried to the candidate as a named hole |

The preference order is fixed and not negotiable. A hard constraint decides. If
several agree, the best-evidenced one is cited. Failing that, the soft
constraints are combined and their spread becomes the interval. Failing that,
the quantity is unresolved, gets whatever prior the caller supplies, and claims
no residual, because there is nothing to have a residual against.

**Two hard constraints that disagree are a contradiction.** They are reported,
never averaged. A drawing that states 12.05 in one place and 12.60 in another
has a problem the reconstruction cannot solve, and the only honest responses
are to pick one with a stated reason or to leave the quantity unresolved — not
to build 12.325 metres of wall.

## Which chain states the dimension

Not the longest one. A plan carries several chains per axis measuring different
things — the walls, the walls plus a terrace, one wing, a run of internal
divisions. Length alone picks whichever reaches furthest across the sheet.
Three signals decide, in order:

1. **Corroboration** — two chains on one axis whose totals agree are stating the
   same dimension twice. `1205` above `790 + 415` is as close to certain as a
   drawing gets, and wins outright.
2. **How much of it was READ** — a chain every segment of which carries a printed
   number is a statement; one held together by segments derived from the sheet
   scale is an inference, and inference loses.
3. **Span**, last, to separate what the first two leave tied.

Totals that lose are not discarded: they stay in the metric evidence as the
chains they are, so a plan's zones and subdivisions remain on the record.

The totals themselves are recomputed from the EVIDENCE each segment cites, not
read off the chain record — one copy of the structure, one copy of the values,
so a corrected reading reaches the building instead of being shadowed by a
total computed before the correction.

## Conventions, collected in one place

Where the sources say nothing, the solver falls back on a building convention.
Everything built from one is marked `ASSUMED` and named in `unresolved`. They
live in one exported object so a reviewer can see the whole set of things the
solver is prepared to make up: external wall thickness, slab thickness, roof
build-up, eaves overhang, storey height.

## The candidate

`ReconstructionCandidate` (`buildapp.reconstruction-candidate`, schema `1.0.0`)
is the DERIVATION, not the model:

- four input hashes — source package, observation graph, metric evidence,
  hypothesis set — all required;
- the solver's name and version;
- the **Building DSL program**;
- the hash of the model that program builds;
- every solved quantity with its class, interval, residual and reason;
- every contradiction;
- every named hole;
- a trace from each output primitive back to its hypothesis, its evidence and
  its observations;
- the solver's steps, each naming its method: weighted least squares, interval
  intersection, robust vote, discrete selection, bounded search, direct, or
  refused.

`verifyReplay` runs the program and checks the model comes back byte for byte.
A candidate that does not replay is not a candidate — it is a model with a story
attached. Nothing may change a candidate's model except by changing its program
and re-sealing, and the viewers enforce that by replaying rather than storing
geometry.

The hash covers everything above except prose. A step's `detail`, a trace's
`why`, a hole's `reason` — rewording an explanation is not a different
reconstruction. Solver steps are hashed by their method and their counts for
the same reason: what the solver did is part of the result, how it narrated it
is not.

## Verification, after the fact

**Projection audit.** The solved model is projected back into each registered
view and its openings are matched against the observations that are actually
there. Deliberately non-iterative — a check that adjusts what it is checking
measures its own convergence — and it never compares pixels, because a rendered
model and a published drawing differ in line weight and hatching before they
differ in geometry.

**Evaluation** runs after sealing, on the artefact, against a reference model,
and reports two numbers that are never combined:

- **geometric accuracy** — of what the candidate built, how close is it?
- **evidence-supported completeness** — of the building, how much did it build
  at all?

Collapsing them hides two opposite failures: a little built very precisely, and
everything built confidently and wrongly. Apart, each is obvious.

## The anti-cheating boundary

Nothing that runs before a candidate is sealed may know which project it is
reconstructing — not its name, not its id, not a number from its reference
model, not the reference package. Evaluation may know all of it, and runs
afterwards, on the artefact.

The boundary is enforced by tests that read the source tree
(`tests/architecture/reconstruction.test.ts`), and from the other end by
`npm run reconstruct:no-reference`, which moves the reference package out of
the tree and runs the entire candidate path without it.

## Running it

```
npm run reconstruct -- --url <project url> --slug <name> --label "<name>"
npm run reconstruct -- --package <package.json> --graph <graph.json> --slug <name>
npm run reconstruct:marcowki        # evaluation, on the sealed artefact
npm run reconstruct:no-reference    # the boundary, proved by execution
```
