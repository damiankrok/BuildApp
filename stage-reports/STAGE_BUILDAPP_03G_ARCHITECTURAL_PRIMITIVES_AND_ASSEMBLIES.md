# STAGE BUILDAPP-03G: Architectural primitives and assemblies

Branch `claude/buildapp-buildworld-v1-7y6yqh`. Every number below comes from a
file, a test or a CI run named next to it. The stage's evidence is in
`stage-reports/artifacts/architectural-assemblies/` (its `README.md` lists
each file); `npm run architecture:artifacts` regenerates it, and CI publishes
it as the `architectural-assemblies` artifact.

## Verdict

**PASS_STAGE_BUILDAPP_03G_ARCHITECTURAL_PRIMITIVES_AND_ASSEMBLIES** — see
**CI** for the run it rests on.

BuildApp now describes a building in a general language instead of one house
type per project:

- small semantic primitives;
- assemblies that group them;
- typed relationships between them;
- evidence and quality on every object;
- an explicit UNKNOWN for what the evidence cannot name.

The chain is unchanged: evidence → DSL → CanonicalBuildingModel → compiler →
verification. No mesh is a source of truth.

What was proven:

- **Seventeen synthetic diversity fixtures** pass end to end. Each one
  replays to the same hash, validates without a warning, round-trips, and
  compiles without a diagnostic. None has an exterior closure finding, and
  every declared relationship and roof join holds.
- **The hypothesis pipeline**, fed only with synthetic evidence, states:
  - a roof graph identical to the one it was read from (an intersecting roof
    and a hip roof);
  - a dormer, an entrance canopy on posts and a beam, a pergola, and
    entrance steps.
- **Where the evidence is not enough**, the pipeline keeps the feature
  UNKNOWN, with alternatives and the reason. One visual line never becomes a
  dormer. A render never overrides a printed dimension.
- **Marcówki**, sealed and live, and **the second house** (live) build the
  same buildings as before this stage. Their hashes change only because the
  schema version changed, and that is proven byte for byte.

What this stage does **not** claim: automatic recognition of these features
from real drawings. The production analyzer still emits legacy rectangular
roofs, balcony slabs, railings and terraces. It emits no 1.6.0 assembly yet.
The capability registry records this per feature (`recognition`).

**03Y2G stays pending** the owner's arm64 phone recheck. It is not marked
PASS here.

## START HEAD

`4d171bd6f85ce172a13bfbe36fff447ffda10c22` (the 03Y2G report commit),
confirmed at the start.

## FINAL HEAD

Commits of this stage, in order:

| commit | content |
| --- | --- |
| `dd3c72a` | schema 1.6.0 (roof planes and edges, wall panels, platforms, step runs, assemblies, typed relationships); DSL; compiler; viewers' parts and groups; reseal of the sealed candidates; regenerated Android assets and contract fixtures |
| `40b9837` | `packages/architecture`: registries, source authority, proposals, the hypothesis pipeline and its demonstrations, roof/assembly graph exports, the 17 fixtures; member end cuts; closure audit extensions; architecture guards |
| `2294d5b` | web category filters and e2e; Android fixture bundles and JVM test; CI job `architectural-assemblies`; analyzer-v2 record restated; docs; the committed artifact set |

The final HEAD is the commit that carries this report and the
`PROJECT_STATUS.md` row. It adds the host-field fix to the assembly tree (see
**ASSEMBLY GRAPH ARTIFACT**). See `git log`.

## ARCHITECTURAL LANGUAGE

`docs/ARCHITECTURAL_LANGUAGE.md` describes the whole language.

- **Primitives** are model records. A primitive is either a whole record
  (a wall) or a record read by its role or kind (a Column is a
  `linearSolid` with role COLUMN; a Valley is a `roofEdge` with kind VALLEY).
- **Assemblies** group primitives by id and carry no geometry of their own.
- **Relationships** are typed edges held in the model. They are validated
  there and checked against the compiled geometry.
- **The capability registry** states, per feature, what can be represented
  and proven, and separately what is recognized from real sources today.

## PRIMITIVE REGISTRY

`PRIMITIVE_REGISTRY` (`packages/architecture/src/registry/primitives.ts`) has
**34 types**:

- Wall, Slab, Column, Post, Beam, Lintel, Parapet, SurfaceRegion;
- Opening, Window, Door, GarageDoor, RoofOpening;
- RoofPlane, Ridge, HipEdge, Valley, Verge, Eave, Fascia, RoofStep,
  RoofBoundary;
- Step, ExteriorStepRun, StairFlight, Landing, Ramp;
- RailingRun, Guard, Handrail;
- TerraceSurface, BalconySlab, PergolaBeam, PergolaPost.

For each type the registry names:

- the model kind it lives in;
- the selector that makes a record this primitive (a role, a kind, or a
  stable sub-id such as `<run>:step-<k>`);
- its metric geometry;
- where its host and relationships live;
- the schema version it is representable from.

`primitivesOf(model)` lists every primitive a model holds. Each one keeps
five things:

- a stable id;
- its lineage: evidence status, source, locator and source ids;
- its confidence;
- its host;
- its relationships and the assemblies it belongs to.

Test `packages/architecture/test/semantics.test.ts` checks this on every
fixture: every primitive has lineage with at least one source id.

A legacy `Roof` is not listed as plane primitives. Its plane graph is
derived (`legacyRoofGraph`), so the model is never said to hold what it does
not hold.

## ASSEMBLY REGISTRY

`ASSEMBLY_REGISTRY` covers all **13** assembly kinds: ROOF, DORMER, BALCONY,
TERRACE, LOGGIA, CANOPY, CARPORT, PERGOLA, ENTRANCE, EXTERIOR_STAIR, FACADE,
GARAGE and UNKNOWN. A test checks it against `AssemblyKindSchema`.

- **References** are validated per field and kind. A CANOPY's `supportIds`
  must be vertical members, its `beamIds` beams, and its `roofAssemblyId`
  a ROOF assembly.
- **COMPLETE** must hold every component the kind requires; otherwise
  `ASSEMBLY_QUALITY_OVERSTATED`.
- **PARTIAL or FRAGMENTARY** must say what is missing; otherwise
  `ASSEMBLY_QUALITY_UNEXPLAINED`.
- **Partial assemblies are valid.** A canopy with no observed cover is PARTIAL
  with `missing: ['no cover was observed over the posts']`, and it validates
  (test *a canopy without cover evidence is not given a roof…*).

## RELATIONSHIP GRAPH

`RELATIONSHIP_REGISTRY` covers all **15** kinds: HOSTED_BY, SUPPORTED_BY,
CONNECTED_TO, CONTINUES_TO, TERMINATES_AT, INTERSECTS, MEETS, COVERS,
ATTACHED_TO, GUARDS, OPENS_INTO, SAME_PLANE_AS, OVERLAPS_INTENTIONALLY, ABOVE
and BELOW. Relationships are a model collection; there is no graph database.

**In the validator:**

- both ends must exist, and no relationship may relate an object to itself;
- no duplicates;
- GUARDS must come from a railing, panel or member;
- OPENS_INTO must come from a door, window or opening.

**In the closure audit**, against the geometry:

- *meeting kinds must touch* (`RELATIONSHIP_UNSATISFIED`). The distance is
  vertex-to-face and, for members that cross, arris-to-arris.
- *ABOVE, BELOW and COVERS must agree with the geometry*
  (`RELATIONSHIP_CONTRADICTED`).

The 17 fixtures state 134 relationships. The closure audit checks the
**122** whose two ends both have compiled geometry, and **122** hold
(`fixture-results.json`, `closure.architecture`).

## UNKNOWN ARCHITECTURAL ASSEMBLY

An UNKNOWN assembly holds:

- `sourceEvidenceIds` (at least one);
- `metricExtent`;
- `approximateTopology`: VOLUME, PLANAR, LINEAR, POINT_CLUSTER or UNKNOWN;
- `observedPlanesOrSegments` (planes are checked for planarity);
- `alternatives`;
- `unresolvedReason`.

It may never be COMPLETE (`ASSEMBLY_QUALITY_OVERSTATED`). The compiler draws
only what was observed: 2 cm plates and 3 cm bars, part `UNKNOWN_ASSEMBLY`.
Every viewer draws that part translucent, in a restrained blue-grey
`#7888a0` at opacity 0.6:

- web: `scene-adapter.ts`;
- Android: `GeometryPart.isTranslucent`, checked by
  `ArchitecturalAssembliesTest`;
- mobile palette: `semantics.ts`.

**Fixture `unknown-feature`** is a raised panel on a front slope, seen on two
renders only.

- It stays UNKNOWN (FRAGMENTARY). Its alternatives are DORMER 0.2 and
  ROOF 0.15, and its reason says why each was not concluded.
- It is not forced into a dormer and not dropped. It shows as a thin
  translucent panel: `viewer/unknown-feature.png`.

**Pipeline demo `unknown`** gives the same result from proposals.

## ROOF ASSEMBLY / PLANES / RIDGES / VALLEYS / HIPS

**A roof is a plane graph.** A `RoofPlane` is:

- its covered polygon;
- a datum on its top surface, a pitch and a fall direction;
- a thickness.

Its top is `y = datum.y − tan(pitch)·((p − datum)·downslope)`. It is drawn
`thickness / cos(pitch)` deep.

**Roof edges:**

- `connectRoofPlanes` finds the shared segment. With `AUTO` it names the
  join from the planes: a level convex join is a ridge, a sloping convex one
  a hip, a concave one a valley, and a height jump a roof step.
- The validator re-checks every `RoofEdge` against its planes:
  `ROOF_EDGE_KIND_MISMATCH` and `ROOF_EDGE_INVALID`.
- The closure audit checks that every ridge, hip and valley closes
  (`ROOF_JOIN_OPEN`). The fixtures have **26 roof joins; 26 close**.

**Walls under the roof** follow the planes (`FOLLOW_ROOF_PLANES`).

**Classification.** The assembly's classification is a label: GABLE, HIP,
HALF_HIP, SHED, FLAT, MANSARD, INTERSECTING, STEPPED, COMPOSITE or UNKNOWN.
For every fixture it must equal what `classifyRoofGraph` reads off the graph
(test *a roof is classified from its plane graph, not from a label*). The
enum is never the geometry.

**Edge boards:**

- Free edges carry fascia and verge boards: members hosted on their edge,
  with their edge's evidence.
- Two verge boards meeting at an apex are cut plumb. The cut is stated on
  both boards (`LinearSolid.startCut` / `endCut`, new optional fields).
  Without it they drew the same face twice: 0.034 m² at every gable apex,
  found by the closure audit on the first fixture run.

**Fixtures** (`fixture-results.md`):

| fixture | planes | joins | read as |
| --- | --- | --- | --- |
| `roof-gable` | 2 | 1 ridge | GABLE |
| `roof-hip` | 4 | 1 ridge, 4 hips | HIP |
| `roof-shed` | 1 | — | SHED |
| `roof-intersecting-gables` | 4 | 2 ridges, 2 valleys | INTERSECTING |
| `roof-stepped-levels` | 2 | 1 roof step, closed by the body's wall | STEPPED |

## FLAT ROOF

- A flat roof is a pitch-0 plane. `roof-flat-parapet` has one plane, 4
  BOUNDARY edges and 4 parapet runs.
- **Parapets** are wall panels (role PARAPET). Each stands on the roof plate
  over its host wall and is `SUPPORTED_BY` the plane. The plate is
  `SUPPORTED_BY` the walls. This is a relationship graph, not a slab with a
  border (16 relationships; 12 are checked by the closure audit, and 12 hold).
- A flat canopy cover and the lower wing of the stepped fixture are the same
  primitive.

## DORMERS

`createDormer` is a DSL macro. Its types are GABLE, SHED and FLAT. It emits:

- a DORMER cut in the host plane (a roof opening with an outline);
- the dormer's own planes, ridge, eaves and verges;
- the valleys against the host;
- the front wall (`FOLLOW_ROOF_PLANES`) with an optional window;
- the cheeks, as wall panels (DORMER_CHEEK);
- the dormer's own ROOF assembly and the DORMER assembly;
- HOSTED_BY, SUPPORTED_BY and MEETS relationships.

It also adds the dormer to the host ROOF assembly. `layoutDormer` refuses a
layout with a reason: a flat host, a front that does not run across the
slope, or an eave that does not clear the host.

| fixture | planes | valleys | ridges | relationships |
| --- | --- | --- | --- | --- |
| `roof-dormer-gable` | 4 (2 host, 2 dormer) | 2 | 2 | 11 (all held; 4 roof joins close) |
| `roof-dormer-shed` | 3 | 1 | — | 9 (all held) |

Removing the host plane takes the dormer's cut and joins with it, and the
model stays valid (test *the dormer … removing the host plane…*).

## COLUMNS / POSTS / BEAMS

`createColumn` makes COLUMN, POST and PERGOLA_POST members. `createBeam`
makes BEAM, LINTEL, PERGOLA_BEAM and RAFTER members. Both are linear solids
with a `role`:

- **The role is semantic.** Vertical and horizontal roles are checked
  against the centreline (`MEMBER_ORIENTATION_INVALID`).
- **Assemblies reference members by id.** A canopy's supports must be
  vertical, its beams horizontal.
- **Viewers group them** as STRUCTURAL_MEMBER or PERGOLA_MEMBER. The web
  viewer's *Structural members* filter hides them (e2e test *the category
  filters…*).

## CANOPY

- **`exterior-entrance-canopy`:** two posts, a beam, and a flat cover plane
  as its own ROOF assembly, ATTACHED_TO the front wall. There is a landing
  with two steps. The CANOPY (usage ENTRANCE) sits inside an ENTRANCE
  assembly. 12 relationships, including COVERS.
- **`exterior-open-canopy`:** a free-standing gable shelter on four posts
  and two beams, CANOPY usage SHELTER, open on all sides.
- **No cover evidence, no roof.** A canopy stated COMPLETE without a cover
  is refused. Stated PARTIAL, it must name what is missing.
- **In the pipeline**, CANOPY requires a COVER_SURFACE, and a
  NO_COVER_OBSERVED proposal rules it out (demo `pergola`:
  `excludedBy: ['sky-render']`).

## CARPORT

`exterior-carport`:

- two posts and a beam on a plinth against the east wall;
- a 5° shed cover as its own ROOF assembly, with a fascia;
- a CARPORT assembly with `bays: 1`.

In the pipeline, a cover under 12 m² is not a carport. Demo
`porch-columns-beams` records *not carport: the cover spans 4.8 m², less
than a parking bay*.

## PERGOLA

`exterior-pergola`:

- four PERGOLA_POSTs on a rear deck terrace;
- two primary beams on the posts, and five rafters crossing on top;
- `coverage: 'OPEN'`;
- 21 relationships, all held: rafters SUPPORTED_BY both beams, beams by
  their posts, posts by the terrace.

**A pergola is not a roof.** A roof plane that COVERS a pergola member, or
is SUPPORTED_BY one, is refused (`PERGOLA_HAS_ROOF`, tested). The fixture's
only ROOF assembly is the house's.

**The closure audit first failed** on the rafters: 10 × RELATIONSHIP_UNSATISFIED
at 0.23 m. Crossing boxes touch arris on arris, with no vertex on the other's
face. The audit now measures arris-to-arris distance too. The fixture was not
changed.

## BALCONY / LOGGIA / TERRACE

`readPlatformSemantics` reads a floor from where it stands:

- **LOGGIA** when it lies inside a wall ring at or above its level;
- **BALCONY** when it is more than 1.5 m above the lowest floor;
- **TERRACE** when it is less than 0.6 m above it.

An assembly whose kind contradicts that reading gets `ASSEMBLY_KIND_CONTRADICTED`
(tested).

| fixture | how it is built | reads as |
| --- | --- | --- |
| `exterior-balcony` | an upper-floor slab, guarded on three sides by a GUARD railing | BALCONY |
| `exterior-loggia` | a floor recessed into a notched ground ring, under the upper storey; the recess walls stop under the upper floor slab, which spans the loggia and bears on them | LOGGIA |
| `exterior-terrace` | at grade, against the rear wall | TERRACE |

**The loggia fixture first failed** with 3 × COPLANAR_DUPLICATE (1.38, 0.36
and 0.36 m²): recess walls at full height drew their tops in the slab's top
plane. The honest construction, walls stopping under the slab, fixed it.
The audit was not loosened.

## ENTRANCE / EXTERIOR STEPS

Exterior steps are `stepRun`s. They are never part of the interior stair
system.

- **SOLID runs** are a stepped profile extruded across their width.
- **OPEN_TREADS runs** are one tread per step.

`exterior-entrance-steps` has:

- three steps up to a front landing;
- one step onto a rear porch;
- a HANDRAIL along the landing;
- ENTRANCE ×2 and EXTERIOR_STAIR ×1;
- TERMINATES_AT, ATTACHED_TO and OPENS_INTO relationships.

A handrail may end free (closure rule added). A railing on a platform is now
checked on its base.

**Demo `entrance-steps`:**

- It reads three nosings and a landing from a plan and an elevation, plus
  two printed datums.
- It emits the landing, the step run, EXTERIOR_STAIR and ENTRANCE.
- It links the entrance to the existing front door.
- The rise is 0.125 m, decided by the printed datums (PRINTED_DIMENSION,
  corroborated by the nosings).

## CAPABILITY REGISTRY

`capability-registry.md` has 21 capabilities:

- 18 are SUPPORTED and 3 PARTIAL (ROOF_DORMER, LOGGIA, HANDRAIL);
- by recognition: ANALYZER_V2 4, SYNTHETIC_PIPELINE 11, NONE 6.

| capability | status | recognition | fixtures |
| --- | --- | --- | --- |
| ROOF_GABLE | SUPPORTED | ANALYZER_V2 (as a legacy roof) | roof-gable |
| ROOF_HIP | SUPPORTED | SYNTHETIC_PIPELINE | roof-hip |
| ROOF_SHED | SUPPORTED | NONE | roof-shed |
| ROOF_FLAT | SUPPORTED | ANALYZER_V2 (legacy) | roof-flat-parapet |
| ROOF_INTERSECTION | SUPPORTED | SYNTHETIC_PIPELINE | roof-intersecting-gables |
| ROOF_VALLEY | SUPPORTED | SYNTHETIC_PIPELINE | roof-intersecting-gables, roof-dormer-gable, roof-dormer-shed |
| ROOF_STEP | SUPPORTED | NONE | roof-stepped-levels |
| ROOF_DORMER | PARTIAL | SYNTHETIC_PIPELINE | roof-dormer-gable, roof-dormer-shed |
| PARAPET | SUPPORTED | NONE | roof-flat-parapet |
| BALCONY | SUPPORTED | ANALYZER_V2 (slab + railing, no assembly) | exterior-balcony |
| LOGGIA | PARTIAL | NONE | exterior-loggia |
| TERRACE | SUPPORTED | ANALYZER_V2 | exterior-terrace, exterior-pergola |
| CANOPY | SUPPORTED | SYNTHETIC_PIPELINE | exterior-entrance-canopy, exterior-open-canopy |
| CARPORT | SUPPORTED | NONE | exterior-carport |
| PERGOLA | SUPPORTED | SYNTHETIC_PIPELINE | exterior-pergola |
| COLUMN | SUPPORTED | SYNTHETIC_PIPELINE | exterior-entrance-canopy, exterior-carport, exterior-open-canopy |
| BEAM | SUPPORTED | SYNTHETIC_PIPELINE | the three above, exterior-pergola |
| EXTERIOR_STEPS | SUPPORTED | SYNTHETIC_PIPELINE | exterior-entrance-steps, exterior-entrance-canopy |
| ENTRANCE | SUPPORTED | SYNTHETIC_PIPELINE | exterior-entrance-steps, exterior-entrance-canopy |
| HANDRAIL | PARTIAL | NONE | exterior-entrance-steps |
| UNKNOWN_ASSEMBLY | SUPPORTED | SYNTHETIC_PIPELINE | unknown-feature |

Each capability also lists:

- its evidence requirements: proposal kinds, counts, and a cross-view flag;
- its exclusions;
- the semantic types it emits;
- its demos, notes and known gaps.

A test checks that every named fixture and demo exists, and that every
SUPPORTED capability has at least one fixture.

## PARTIAL / UNKNOWN BEHAVIOR

The pipeline's decision rule (`hypotheses/fuse.ts`):

- **ACCEPTED** is the most specific satisfied family, with no same-level
  rival within 0.1. It must not rest on one visual reading from one frame.
- **UNKNOWN** needs at least two observations, from two frames or from one
  technical drawing. It keeps the partly supported families as alternatives,
  with confidence and why each was not concluded.
- **REJECTED** emits nothing and keeps the reason.

A family that is concluded but cannot be stated against the context is
demoted to UNKNOWN with that reason. An example is a dormer with no host
plane under it.

Tests (`packages/architecture/test/hypotheses.test.ts`):

- **one visual line never becomes a dormer**: a single VLM ROOF_LINE is
  REJECTED, and 0 commands are emitted;
- **a dormer seen in one render only** is REJECTED, not even UNKNOWN;
- **a dormer seen in one technical drawing only** stays UNKNOWN. The
  alternative says *seen in 1 frame, needs two*. No `createDormer` is
  emitted;
- **a covered frame is not a pergola** (`excludedBy: ['cover-seen']`), and a
  frame with open sky is not a canopy;
- **the same members with no cover observation** (demo `pergola-ambiguous`)
  stay UNKNOWN. Alternatives: PERGOLA 0.6 (*missing the absence of a
  continuous roof plane, observed*), CANOPY 0.45, CARPORT 0.3.

**Source authority** (test *a higher authority decides, whatever the count
or order of lower ones*):

- For every adjacent pair of authorities, one higher value beats five lower
  ones and records five conflicts.
- In demo `pergola`, the printed post height (2.48 m) decides the frame
  datum over a render reading 2.8 m. The conflict is recorded, and all four
  posts end at 2.48 m.

## DSL

New commands:

- `createRoofPlane`, `connectRoofPlanes` (AUTO or a named kind),
  `createRoofEdge` (with an optional board);
- `createDormer` (macro);
- `createColumn`, `createBeam`, `createWallPanel`, `createPlatform`,
  `createStepRun`;
- `createAssembly`, `createRelationship`.

New optional fields on existing commands: `cutRoofOpening.outline`,
`placeDoor.usage`, `createRailing.role` and `createLinearSolid.role`.

- **Deterministic.** Every derived id hangs off a stated id or `nextId`:
  `<edge>-board`, `<dormer>-cut`, `rel-<from>-<kind>-<to>`.
- **Revalidated.** Every command re-validates the whole model.
- **Serializable and replayable.** Each fixture runs twice to the same hash,
  and the fixture's command list serializes to the same JSON
  (`replayDeterministic`, 17/17).
- **The pipeline's output** is a DSL program. Every emitted command parses
  against `BuildingCommandSchema` (architecture test).

`removeFeature` cascades:

- a roof plane takes its openings and edges;
- relationships to removed objects are dropped;
- assemblies lose the reference, and are removed when their defining
  component goes.

## CANONICAL MODEL

Schema **1.6.0** adds seven collections: `roofPlanes`, `roofEdges`,
`wallPanels`, `platforms`, `stepRuns`, `assemblies` and `relationships`.

It also adds:

- `Wall.topProfile` FOLLOW_ROOF_PLANES;
- optional fields: `LinearSolid.role`, `.startCut` and `.endCut`;
  `Door.usage`; `Railing.role`; `RoofOpening.outline`;
- roof opening kind DORMER.

About 20 new validation codes are listed in `docs/CANONICAL_BUILDING_MODEL.md`.
They include `ROOF_EDGE_KIND_MISMATCH`, `ASSEMBLY_QUALITY_OVERSTATED`,
`PERGOLA_HAS_ROOF`, `UNKNOWN_ASSEMBLY_INVALID` and `LINEAR_SOLID_CUT_INVALID`.

## COMPILER

`packages/geometry/src/architecture-compiler.ts` compiles:

- **roof planes**, tessellated with their openings as holes, with reveals
  and rooflights;
- **walls** under planes (`FOLLOW_ROOF_PLANES`);
- **wall panels** between their bottom and top polylines;
- **platforms**, including ramps;
- **step runs** (SOLID and OPEN_TREADS);
- **unknown assemblies**, observed pieces only.

A linear solid with a stated end cut ends in the cut plane. It is still a
closed solid, and its mesh volume equals `linearSolidVolume`
(`member-cuts.test.ts`). A member without cuts compiles exactly as before
(same triangles).

**The closure audit gains** an `architecture` section: relationships
checked and satisfied, roof joins checked and closed. It appears only when a
model states relationships or roof edges, so a model without them reports
what it reported before. Marcówki's committed exterior-closure reports are
byte-identical after this stage.

**No feature reader makes geometry.** The registries, the proposals and the
pipeline import no geometry module and write no triangle
(`tests/architecture/assemblies.test.ts`).

## SCHEMA VERSIONING

- **1.6.0 is current.** A 1.5.0 file migrates explicitly: the seven
  collections are added empty, the version is bumped, and the load gets one
  `SCHEMA_MIGRATED` warning and one note. Older files walk the chain one
  step at a time (six steps from 1.0.0). Unknown versions are refused
  (`1.7.0` is tested).
- **Frozen fixtures:**
  - `demo-house-1.6.0.json` and `marcowki-ge-1.6.0.json` are new;
  - stripping the empty collections and restoring the version gives back
    the 1.5.0 bytes exactly (tested).
- **Sealed candidates**, restated by `npm run candidates:reseal`, each with a
  byte-for-byte restatement proof in `reseal-log.json`:

  | candidate | content hash | model hash |
  | --- | --- | --- |
  | `marcowki-auto` | `eb56682e → 859a75a1` | `35ddfc97 → 5650bbf4` |
  | `marcowki-auto-v2` | `686ba510 → 49b32b23` | `a8b8012d → 74e02708` |
  | `marcowki-auto-v3` | `b73596d2 → d4ee2121` | `894e50ba → 731b045e` |

- **The analyzer-v2 record** of auto v3
  (`stage-reports/artifacts/analyzer-v2/`) was byte-identical to the sealed
  v3. It was restated the same way, with `candidates:reseal --path`: its
  residuals and closure-decision sidecars were re-pointed and its model file
  rewritten. It is still byte-identical to the sealed v3 (test).
  `audit:analyzer-v2` passes 22/22.
- **Android bundles are regenerated.** The five shipped scenes change only
  in their model hash and version. Scene, objects, levels, materials, groups
  and hints are identical. The structural fingerprint is unchanged for every
  scene (auto v3 `f29a037b…`).
- **Caches are preserved.** No cache format changed. The analyzer contract
  fixtures were re-captured.

## SYNTHETIC DIVERSITY FIXTURES

`packages/architecture/src/fixtures/` holds 17 generic buildings built from
parametric builders. None names or copies a project (guarded).

| # | fixture | assemblies | relationships held | roof joins closed | triangles |
| --- | --- | --- | --- | --- | --- |
| 1 | roof-gable | ROOF | 2/2 | 1/1 | 500 |
| 2 | roof-hip | ROOF | 4/4 | 5/5 | 540 |
| 3 | roof-shed | ROOF | 2/2 | — | 436 |
| 4 | roof-flat-parapet | ROOF | 12/12 | — | 448 |
| 5 | roof-intersecting-gables | ROOF (INTERSECTING) | 5/5 | 4/4 | 428 |
| 6 | roof-stepped-levels | ROOF (STEPPED) | 5/5 | — | 336 |
| 7 | roof-dormer-gable | ROOF ×2, DORMER | 11/11 | 4/4 | 744 |
| 8 | roof-dormer-shed | ROOF ×2, DORMER | 9/9 | 2/2 | 680 |
| 9 | exterior-balcony | ROOF, BALCONY | 3/3 | 1/1 | 640 |
| 10 | exterior-loggia | ROOF, LOGGIA | 4/4 | 1/1 | 484 |
| 11 | exterior-terrace | ROOF, TERRACE | 3/3 | 1/1 | 256 |
| 12 | exterior-entrance-canopy | ROOF ×2, CANOPY, ENTRANCE | 11/11 | 1/1 | 324 |
| 13 | exterior-carport | ROOF ×2, CARPORT | 9/9 | 1/1 | 232 |
| 14 | exterior-pergola | ROOF, PERGOLA, TERRACE | 21/21 | 1/1 | 388 |
| 15 | exterior-open-canopy | ROOF ×2, CANOPY | 13/13 | 2/2 | 268 |
| 16 | exterior-entrance-steps | ROOF, ENTRANCE ×2, EXTERIOR_STAIR | 6/6 | 1/1 | 440 |
| 17 | unknown-feature | ROOF, UNKNOWN | 2/2 | 1/1 | 316 |

For every fixture, `runFixture` finds:

- DSL replay to the same hash;
- validation with 0 errors and 0 warnings;
- a serialize → parse round trip to the same hash;
- 0 compile diagnostics;
- 0 exterior closure findings, and 0 interior ones.

It also checks the expected assemblies, primitives, roof classifications
(stated = derived) and relationships.

BuildWorld draws ten of them in the browser e2e (`viewer/*.png`): the
dormer, the parapets, the intersecting gables, the balcony guard, the canopy
on posts over the steps, the carport, the pergola behind the house, the
shelter, the entrance steps and the translucent unknown panel.

## ROOF GRAPH ARTIFACT

`roof-graphs/<id>.json` and `<id>.svg` are written for each of the following:

- all 17 fixtures;
- all 8 demos;
- `regression-marcowki-auto-v3`;
- `regression-rarytasy`.

For each roof they contain:

- the planes (pitch, normal, fall, datum, plan area, boundary);
- the ridges, hips, valleys, verges, eaves, steps and boundaries;
- the fasciae, openings, dormers, chimneys and unknown sub-assemblies;
- the relationships that touch it;
- the stated and the derived classification.

A legacy roof's graph is derived (`source: LEGACY_ROOF`). Marcówki v3 reads
`roof-main: GABLE` and `roof-attached-0: FLAT`, and so does the second house.

The SVG is a deterministic plan view. It fills planes by pitch, colours edges
by kind, and dashes dormer cuts. A dormer's own roof is drawn over its host.

## ASSEMBLY GRAPH ARTIFACT

- **`assembly-graphs/<id>.txt`** is the assembly tree. Nested assemblies are
  expanded (the entrance → its canopy → the canopy's roof → its plane and
  edges). Hosts are marked as hosts. The primitives in no assembly are
  listed after.
- **`assembly-graphs/<id>.json`** holds nodes and edges: COMPONENT, HOST and
  every typed relationship.

A fix in the final commit: a dormer names its host roof, and the host roof
lists the dormer, so the first tree had no root and came out empty. Host
fields (`hostIds`, `hostRoofAssemblyId`, `hostPlaneIds`) are now hosts
everywhere (`HOST_REFERENCE_FIELDS` in the model). The host plane is no
longer said to be *part of* its dormer.

## MARCÓWKI NON-REGRESSION

**The model, sealed.** `marcowki-auto-v3` replays to model `731b045e…`.
Restated to 1.5.0, that is the sealed `894e50ba…`, byte for byte
(`reseal-log.json`; test *its restatements chain…*).

**The bundles.** The phone's `marcowki-auto-v3.scene.json` has the same
structural fingerprint `f29a037b…`. Its hinted colours are identical: the
new semantic groups were kept out of the tone-hint neighbourhoods.

**The CI gates**, run locally on the final tree:

| gate | result |
| --- | --- |
| `audit:marcowki` | pass |
| `audit:marcowki:facades` | pass |
| `reconstruct:no-reference` | pass |
| `reconstruct:no-benchmark` | pass: 205 commands, replay byte-identical |
| `evaluate:v2` | pass |
| `audit:analyzer-v2` | 22/22 checks |
| `audit:exterior` | 0 exterior findings, baseline 43; interior 42, as before |

The committed exterior-closure reports are byte-identical.

**The live URL.** In CI run 47 (commit `40b9837`, schema 1.6.0), the live
Marcówki URL completed:

- through the bundle on Node 18, with and without ICU;
- on the Android 14 emulator;
- in the analyzer container.

**`evaluate:v2`** rewrote a stale field in `marcowki-v2-evaluation.json`:
`frameTones` became `returnTones`, and the residual candidate hash was
updated. That file had not been regenerated since 03Y.

## RARYTASY NON-REGRESSION

The live URL went through the production pipeline on desktop, Node 22
(`npm run analysis:second-house -- --url …`). It completed in 226 s:

- 2 masses, 14 openings, 135 commands, 110 meshes;
- every count equal to the sealed 03Y2G post-fix `result-summary.json`.

The page was fetched again, so its source package hash differs, and every
hash downstream of it differs with it. The model:

- live, 1.6.0: `88c514f5…`;
- **restated to 1.5.0: `b1d6d7b7…`, the sealed 03Y2G post-fix model, byte
  for byte.**

The second house therefore keeps its 03Y2G behaviour exactly. In CI run 47
all five second-house checks passed, including the Node 18 no-ICU bundle =
desktop gate. The live summary is kept in
`architectural-assemblies/regression-rarytasy/live-result-summary.json`.

Its roof graph (GABLE + FLAT, legacy) and assembly tree are in the artifact.

## NODE22 / NODE18 / ANDROID COMPATIBILITY

- **No native dependency** was added. `packages/architecture` depends on
  model, commands, geometry, source-common and zod (guarded).
- **Not in the phone's analyzer.** The analyzer bundle does not include the
  architecture package, and its fixtures and demos are forbidden there
  (`local-analyzer.test.ts`).
- **The bundle the APK embeds** carries schema 1.6.0. It passed:
  - Node 18 parity (CI run 47, *Local analyzer / Node 18 parity*);
  - the emulator run (*Local analyzer / APK size + emulator*).
- **Kotlin parses the new parts** (ROOF_PLANE, WALL_PANEL, PLATFORM,
  STEP_RUN, UNKNOWN_ASSEMBLY) and the new groups (STRUCTURAL_MEMBER,
  PERGOLA_MEMBER, UNKNOWN_ASSEMBLY). An unknown part still falls back to
  OTHER.
- **`ArchitecturalAssembliesTest`** (3 tests) reads four fixture bundles
  from test resources. The APK ships no fixture. `npm run android:test` is
  green.
- **A mobile grouping fix.** A dormer's front wall is envelope, not a facade
  member. Walls that follow roof planes, or that a dormer, garage or facade
  assembly names, are grouped by finish like ring walls. Marcówki has none,
  so its bundles are unchanged.

## CI

**Run 47** (`40b9837`):

- Green: Node 18 parity, emulator, second house, Android, analyzer
  container, dependency audit and the preview APK.
- Red: Core (`audit:analyzer-v2`, the unrestated analyzer-v2 record) and
  Browser (the Marcówki e2e compared its save with the 1.5.0 freeze).
- Both were fixed in `2294d5b`: the record was restated, and the spec now
  compares with the 1.6.0 freeze.

**Run 48** (`2294d5b`) and the final commit's run are recorded in
`PROJECT_STATUS.md`. Locally on the final tree:

| check | result |
| --- | --- |
| typecheck | pass |
| vitest | 115 files, 1 451 tests passed, 5 skipped |
| browser e2e | 47 passed, 12 of them new |
| Android JVM | pass |
| the seven Core gates | pass |
| `architecture:artifacts` | 17/17 fixtures, 8/8 demos |

**New job `architectural-assemblies`** runs after the second-house job. It
downloads that job's live `model.json`, runs `architecture:artifacts`, and
uploads `architectural-assemblies`. It fails if a fixture or a demo fails.

## APK

The `preview-release` job is unchanged. It republishes
`BuildPlan-Preview-arm64.apk` as a direct asset of the `preview-latest`
prerelease on every push (green in run 47). The APK ships no fixture. Its
scene assets are the regenerated 1.6.0 bundles.

## KNOWN LIMITATIONS

- **No production recognition of the new vocabulary.** The analyzer emits
  legacy roofs and slabs, not roof planes or assemblies. The hypothesis
  pipeline is proven on synthetic evidence only, and no real detector
  produces SemanticProposals yet.
- **Dormers:**
  - a level front across one host plane;
  - no side overhang;
  - no dormer across a ridge or a valley.
- **Handrails** are level; no handrail follows a step run's slope.
- **Members** are prismatic. A round column is its bounding square.
- **Loggia reading** uses the wall-ring plan. An upper-floor loggia outside
  every ring reads as a balcony.
- **Flat-roof edge band.** A flat roof plate's edge shows on the facade in
  the plate's membrane colour (`viewer/roof-flat-parapet.png`). It is a
  truthful slab edge, but no finish is modelled for it.
- **The second house's legacy geometry** carries 5 exterior closure findings
  from the analyzer's legacy output:
  - 4 × COPLANAR_DUPLICATE: the garage's flat roof plate against its parapet
    wall tops, 1.18–1.26 m² each;
  - 1 × INTERSECTION: the chimney against a wall, 0.006 m³.

  They predate this stage. The model is byte-identical to 03Y2G's once
  restated, and the audit paths this stage added do not apply to it. They are
  exactly what the new flat-roof + parapet primitives are for, once the
  analyzer emits them.
- **A stale tracked cache.** `.cache/no-reference/*` is tracked, and has been
  stale since 03Y2G. `reconstruct:no-reference` rewrites it with other
  numbers, from the 03Y2G reader changes. It was left as committed; CI
  regenerates and uploads it.

## NEXT STEP

Make the analyzer speak the new language: turn its existing readings into
SemanticProposals, and let the hypothesis pipeline state the result:

- roof regions and ridge/valley lines from plans and elevations;
- balcony and terrace platforms;
- the garage flat roof with parapets.

Start with roof planes and parapets on the two regression houses. The
target: the second house's four parapet duplicates disappear, and both roof
graphs are read rather than derived.
