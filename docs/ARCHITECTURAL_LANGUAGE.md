# Architectural language (schema 1.6.0, BUILDAPP-03G)

BuildApp does not grow one house type per project. It describes buildings
in a general language: **small semantic primitives, assemblies that group
them, typed relationships between them, evidence for each, and honest
uncertainty** where the evidence runs out. The invariant is unchanged:

    source evidence → observations → metric evidence → topology
      → Building DSL → CanonicalBuildingModel → geometry compiler → verification

An anonymous mesh is never the source of truth. A feature exists because the
model states it, the model states it because a DSL command did, and the
compiler draws it from the model.

Code: `packages/model` (the schema), `packages/commands` (the DSL),
`packages/geometry` (the compiler and the closure audit),
`packages/architecture` (registries, source authority, proposals, the
hypothesis pipeline, graph exports, the synthetic diversity fixtures).

## Primitives

`PRIMITIVE_REGISTRY` (`packages/architecture/src/registry/primitives.ts`)
names 34 primitive types and where each lives in the model:

| primitive | model record |
| --- | --- |
| Wall, Parapet | `wall`; `wallPanel` (role PARAPET, DORMER_CHEEK, GABLE_INFILL, …) |
| Slab | `slab` |
| Column, Post, Beam, Lintel, PergolaPost, PergolaBeam, Fascia | `linearSolid` by `role` |
| SurfaceRegion | `surfaceRegion` |
| Opening, Window, Door, GarageDoor | `opening`, `window`, `door` (`usage` GARAGE) |
| RoofOpening | `roofOpening` (rooflight, penetration, dormer cut) |
| RoofPlane | `roofPlane` |
| Ridge, HipEdge, Valley, Verge, Eave, RoofStep, RoofBoundary | `roofEdge` by `kind` |
| Step, ExteriorStepRun | `stepRun` (`<run>:step-<k>`) |
| StairFlight, Landing, Ramp | `stair` segments; `platform` (LANDING/PORCH, RAMP) |
| RailingRun, Guard, Handrail | `railing` by `role` |
| TerraceSurface, BalconySlab | `terrace`; `balcony` |

Every primitive keeps a stable id (its record's, or a stable sub-id), its
lineage (evidence status, source, locator, source ids), its confidence, its
metric geometry as the model states it, and its host and relationships.
`primitivesOf(model)` lists them. A legacy rectangular `Roof` is not listed as
plane primitives: its plane graph is DERIVED (`legacyRoofGraph`), so the model
is never said to hold what it does not.

## Assemblies

`Assembly` records group primitives by id: ROOF, DORMER, BALCONY, TERRACE,
LOGGIA, CANOPY, CARPORT, PERGOLA, ENTRANCE, EXTERIOR_STAIR, FACADE, GARAGE and
UNKNOWN (`ASSEMBLY_REGISTRY`). An assembly has no geometry of its own: it says
which primitives are one architectural thing, what hosts it, and how complete
it is. `quality` is COMPLETE (every component the kind requires is present —
validated, `ASSEMBLY_QUALITY_OVERSTATED`), PARTIAL or FRAGMENTARY (and then
`missing` must say what is lacking, `ASSEMBLY_QUALITY_UNEXPLAINED`).
`alternatives` records what else it might be. Assemblies nest (a DORMER holds
its own ROOF assembly; an ENTRANCE holds its CANOPY).

### UnknownArchitecturalAssembly

The safe fallback. An UNKNOWN assembly holds its source evidence ids, its
metric extent, an approximate topology (VOLUME/PLANAR/LINEAR/POINT_CLUSTER),
the planes and segments that were actually observed, what it might be
(`alternatives`) and why it is unresolved. It may never be COMPLETE. The
compiler draws only the observed pieces, thin and translucent, and every
viewer groups them as UNKNOWN_ASSEMBLY in a restrained material. Nothing is
forced into a known class and nothing observed is dropped.

## Relationships

`Relationship` records are typed edges, validated by kind and held against
the geometry by the closure audit: HOSTED_BY, SUPPORTED_BY, CONNECTED_TO,
CONTINUES_TO, TERMINATES_AT, INTERSECTS, MEETS, COVERS, ATTACHED_TO, GUARDS,
OPENS_INTO, SAME_PLANE_AS, OVERLAPS_INTENTIONALLY, ABOVE, BELOW
(`RELATIONSHIP_REGISTRY`). They live in the model as a collection — no graph
database. Meeting kinds must touch (`RELATIONSHIP_UNSATISFIED`), ordering
kinds must agree with the geometry (`RELATIONSHIP_CONTRADICTED`).

## Roofs are plane graphs

A roof is a set of `RoofPlane`s joined by `RoofEdge`s, grouped by a ROOF
assembly. A plane is its covered polygon, a datum on its top surface, a pitch,
a fall direction and a thickness. `connectRoofPlanes` finds the edge two
planes share and, with AUTO, reads its kind from the planes (level convex →
ridge, sloping convex → hip, concave → valley, height jump → roof step); the
validator re-checks every edge against its planes. The assembly's
classification (GABLE, HIP, SHED, FLAT, INTERSECTING, STEPPED, COMPOSITE, …)
is a label that must agree with what `classifyRoofGraph` reads off the graph
(the fixtures test it): the enum is never the geometry. Walls follow the
planes (`FOLLOW_ROOF_PLANES`). Free edges carry fascia and verge boards as
members hosted on the edge; two verge boards meeting at an apex are cut
plumb, stated on both.

**Dormers** (`createDormer`, GABLE/SHED/FLAT) are a macro over the same
language: a DORMER cut in the host plane, the dormer's own planes and
valleys against the host, its front wall and cheeks, its own ROOF assembly,
the DORMER assembly and its relationships. **Flat roofs** are pitch-0 planes;
a **parapet** is a wall panel standing on the plate over its host wall,
SUPPORTED_BY the plane — not a slab border.

## Exterior assemblies

- **Columns, posts, beams** are members with a role (`createColumn`,
  `createBeam`): semantic, not decoration; orientation is validated.
- **Canopy**: supports, beams and a cover roof assembly; without cover
  evidence it gets no roof (PARTIAL, saying so).
- **Carport**: the same, with a parking bay (a cover under 12 m² is not one).
- **Pergola**: posts, primary beams, secondary beams, and `coverage` OPEN — a
  roof covering it is refused (`PERGOLA_HAS_ROOF`).
- **Balcony / loggia / terrace** are distinct and read from where the floor
  stands (`readPlatformSemantics`): elevated and projecting, recessed into the
  envelope, or at grade; an assembly contradicting its reading is flagged.
- **Entrance** ties a door, a landing, exterior steps, a canopy, supports and
  guards. **Exterior steps** are `stepRun`s, never part of the interior stair
  system.

## Capabilities

`CAPABILITY_REGISTRY` states, for 21 capabilities (ROOF_GABLE … UNKNOWN_ASSEMBLY):

- `status` — SUPPORTED / PARTIAL / UNKNOWN: what the model, DSL, compiler and
  closure audit can represent and prove;
- `recognition` — ANALYZER_V2 (the production analyzer emits it),
  SYNTHETIC_PIPELINE (the hypothesis pipeline, on synthetic evidence only) or
  NONE. Representable is not recognized: most capabilities are not yet read
  from real drawings;
- the evidence requirements (proposal kinds, counts, cross-view), the
  exclusions that rule it out, the semantic types it emits, the fixtures and
  demonstrations that prove it, notes and known gaps.

## Source authority

`resolveQuantity` decides every metric value by the highest authority that
states it:

    printed technical dimension > plan / section / elevation geometry
      > cross-view corroboration > perspective / render > visual inference > convention

Lower values are never averaged in: agreement is corroboration, disagreement a
recorded conflict with both values and why the lower one lost. A render never
overrides a printed dimension, however many renders agree.

## Semantic proposals

Every detector — deterministic CV today; OCR, a floor-plan model, a vision
language model, the owner tomorrow — contributes `SemanticProposal`s
(`{ id, kind, geometry, confidence, sourceFrameId, detector, authority,
featureKey? }`): evidence, never objects. Invalid proposals are refused, not
repaired. No detector writes the model.

## The hypothesis pipeline

`runPipeline({ proposals, context })` (`packages/architecture/src/hypotheses`):

1. **Observation** — proposals validated.
2. **Hypothesis** — grouped into candidate features (cross-view key, else plan proximity).
3. **Fusion** — every family (DORMER, PERGOLA, CANOPY, CARPORT,
   EXTERIOR_STEPS, ROOF) scored by its capability's requirements and
   exclusions and a plausibility check; the most specific satisfied family is
   ACCEPTED unless a rival of the same specificity is within 0.1 (ambiguous)
   or the evidence is one visual reading from one frame. Otherwise the
   feature is UNKNOWN (at least two observations, from two frames or a
   technical drawing) with its alternatives, or REJECTED (nothing emitted,
   the reason kept). One visual line never becomes a dormer.
4. **Topology** — what stands on, joins or attaches to what.
5. **Metric solve** — every value by source authority; each joint (post top =
   beam underside = cover underside − drop) decided once, by the most
   authoritative observation of it.
6. **DSL** — Building DSL commands, deterministic and replayable, applied and
   re-validated by the command layer and drawn by the compiler.

The pipeline imports no geometry module and makes no triangle (guarded by
`tests/architecture/assemblies.test.ts`). Its eight demonstrations
(`hypotheses/demos.ts`) run on synthetic evidence: an intersecting roof and a
hip roof stated back from a roof plan (matching the fixture's roof graph), a
gable dormer, an entrance canopy on posts and a beam, a pergola (and the same
frame with no cover observation, kept UNKNOWN), entrance steps, and an
unclassifiable panel. This is the plumbing a detector plugs into, not
production recognition.

## Synthetic diversity fixtures

Seventeen generic buildings stated in the DSL (`fixtures/roofs.ts`,
`fixtures/exteriors.ts`): gable, hip, shed, flat + parapet, intersecting gables
with valleys, stepped roof levels, gable dormer, shed dormer, balcony,
recessed loggia, grade terrace, entrance canopy on two posts, carport with a
roof, pergola without a roof, detached open canopy, entrance steps, and an
unknown feature. `runFixture` holds each to: DSL replay to the same hash,
validation without warnings, serialize → parse round trip, compile without
diagnostics, closure audit without exterior findings, every relationship and
roof join held, and the assemblies, primitives, roof classifications and
relationships the fixture expects.

## Artifacts

`npm run architecture:artifacts` writes
`stage-reports/artifacts/architectural-assemblies/`: the registries, fixture
results, demonstrations, roof graphs (JSON + SVG) and assembly trees/graphs of
every fixture, demonstration and regression project (Marcówki's sealed
candidate; the second house's live model with `--rarytasy`), and each
fixture's model. CI publishes it as the `architectural-assemblies` artifact.
