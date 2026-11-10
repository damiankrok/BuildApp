# BuildPlan — source-to-model contract

One place for analyzer semantics. Workflow is in `AGENT_PROTOCOL.md`, active
scope in the OWNER brief, product in `APP_SPEC.md`, measured results in reports.
These are responsibilities and observable behaviors, not a mandate for new
packages, services, a general DSL or an event-sourcing framework.

## 1. Source, interpretation, decision, application

Preserve four distinguishable states using existing types where possible:

1. Source observation: exact bytes/frame/crop, raw text or visual cue, units,
   uncertainty and competing readings. Later inference does not rewrite it.
2. Interpretation: role, measure kind, line/endpoints/faces, host, storey and
   relationships. A correct number on another host is not a correct measurement.
3. Accepted decision: chosen value/family/topology, premises and per-property
   provenance/authority. Rejected/unknown alternatives remain inspectable.
4. Applied result: what the final program/model built, changed, clipped or omitted,
   with reason and links to the decision. Final graph and model share a revision.

Do not mark the applied fitted size as the literal source size. Do not keep a
stale accepted snapshot after later alignment/repair/emission changed the result.
Raw evidence graphs can remain immutable; expose the actual accepted/applied
states alongside them rather than falsely renaming the old snapshot final.

## 2. Meaning and authority per property

elevation, height, wallTop, slabTop/underside, eaves, ridge, terrain, sill, head
and width have separate provenance. A measured flag for a level bundle cannot
promote a conventional2.80m wall height to PRINTED/SOURCE_EXACT/L2.

Differentiate clear height, floor-to-floor, slab thickness, floor finish, wall
top/knee wall, eaves and ridge. A vertical number or every level mark is not a
new storey. Clear height plus the same slab's thickness can yield its top from
the lower finished floor; it does not establish the next finished floor without
floor-build-up evidence. An eaves mark is not automatically an attic floor.

Use explicit typed roles/reason codes/references, not parsing human `why` or an
exact English `unresolved` sentence. Description changes must not change geometry.
UNKNOWN is allowed; rejecting all readable evidence is not successful coverage.

## 3. Proposals and corrections

Each affected property/relationship has one admission policy shared by callers.
Readers propose; alignment/repair/fit do not have conflicting rights to overwrite.
Admissibility checks meaning, source authority, host, storey and physical relation.
The latest mutation is not automatically the strongest evidence.

Door sills refer to their actual floor/landing/step, including split levels.
Do not raise a door off its access surface just to fit a visual extent. Do not
force a source-supported step to global0. Refusal of a view's height authority
must be respected by every consumer of that height; it need not erase a supported
profile, color or other independently admissible property of the same image.

Balcony access can be supported by observed platform/leaf/context before its
slab is successfully built. Missing emitted slab does not prove a French window.
A floor-height pane alone does not prove a door or garage gate. Distinct views
and repeated OCR candidates must not duplicate one physical opening.

## 4. Roofs and global form

Keep observed2Dprofile, identity/side, metric anchor and emitted geometry separate.
UNREAD is not source evidence for FLAT. Compiler/join limits cannot silently
change a source-supported HIP/GABLE/mixed roof or discard its overhang to obtainPASS.
An explicitly approximate visual alternative remains approximate and cannot
authorize exact quantities. Contradictory credible sources remain alternatives.

Roof inference must eventually represent connected planes, ridges, hips, valleys,
steps, dormers and openings, not only one label per rectangle. Existing roof
graphs/commands/compiler are the starting point; topology detection and host
binding are separate capabilities. A roof covering an area does not make it an
enclosed body: garage, carport, canopy and open approach remain distinct.

Early exterior hypotheses can run alongside plan interpretation. They are not
a second product model. Slicing an arbitrary mesh is not a substitute for reading
storeys and rooms. Keep a bounded candidate search and test its incremental value.

## 5. Readers and runtime profiles

Measure DET, REC, parsing, correction, binding and final use separately. A cropped
REC comparison does not evaluate independent DET+REC. No unconditional own-OCR
veto or mandatory ensemble. Select per task on source quality and resource cost.

Each entrypoint exposes actual OCR/content/vision/solver versions and availability.
Same runAnalysis name is not capability parity. Quality comparisons require the
same bytes and intended profile; intentionally reduced profiles are named. Missing
assets/workers cannot masquerade as a full comparison.

## 6. Optional AI

Reuse problem→answer→proposal→decision types. Separate source observation from
review of final renders against sources. A concrete domain consumer is required;
adding an enum or observation JSON alone is not integration. No provider-issued
arbitrary code, commands, host IDs or mesh becomes accepted truth.

Source IDs/crops/transforms and current base bind the proposal. Every changed
property/relation has a verdict in the actual impact scope; one good check cannot
cover unrelated unchecked changes. Before commit recheck live revision and cancel.
NEED_MORE changes the source crop/view/resolution or endsUNKNOWN, not an identical
paid loop. Exact metrics require appropriate source checks, not confidence or
another identical model opinion. Do not demand only the failed OCR's agreement.

A useful visual hypothesis may be approximate with explicit limits. Remote
credentials, scoped data, durable reservation/settlement of costs, retry ownership,
timeouts, cancellation and caches belong to orchestration, not to maxUsd alone.
Pilot scope can be small; it need not build enterprise cloud/accounts first.

### 6.1 Whole-house description (v3.53)

A vision reader may be the PRIMARY reader of a page: one answer, in a closed
vocabulary (`HouseDescription`: bodies, storeys, roofs, openings per side, features,
palette), about every picture the page publishes. It never issues code, commands,
ids or a mesh. A deterministic check admits or refuses it; the deterministic builder
turns it into the same intermediate building the drawings' path builds, and the same
emitter, validator and compiler make the model. Every repair the builder makes is a
typed adjustment in the result.

Such a model says what it is: `MODEL_FROM_SOURCE_DESCRIPTION`, evidence statuses
`VISUAL_SEMANTIC` / `ASSUMED_FOR_RENDERING`, quality L0 only, source fidelity
UNCHECKED, scale and heights provisional (a dimension the reader says is printed is
still unverified). It is a candidate for recognition, not a measurement, and it never
overrides a drawings model that has a metric anchor.

The reader is given numbered pictures, the instructions and the page's published
figures — never a reference, a benchmark answer, a URL, a host or a project name
beyond the page title. Provider and model are replaceable behind `StructuredVision`.
Paid requests happen on a host, on the host's key, under a host-wide ceiling; no
client holds a key. A fixture replayer is a test device, never "the API working".

## 7. Measurement and acceptance

Freeze labels/uncertainty, project-family splits, source bytes, profile, scorer,
tolerances and denominators before evaluating a candidate. Known/tuned houses
areDEV; openedEVAL does not become blind again. No-model cases remain counted.

Retain existing development targets, with separate definitions:

- View roles: macroF1≥0.95 on declared classes; report coverage/abstention and
  confusions. This does not certify exact left/right, regions or element topology.
- Complete binding:≥95% of the frozen readable reference descriptions have the
  correct number/meaning and the line/endpoints/host/target and final use required
  for that reading kind. Report intermediate binding separately from full completion.
- Number exact-match:≥98% among covered readable references, with≥90% coverage.
  Raw, normalized and corrected results remain separate; do not hide alternatives,
  false additions or repeated claims. Preserve historical scorers/results.

Topology/exterior acceptance also checks omissions, additions, hosts/side,
OPEN/ENCLOSED, roof contacts, support/access relationships and visible source
features on four sides/top/perspectives. CompilePASS, hash identity and score70
alone are insufficient. Tolerances are justified by source resolution/product
need before the result, not enlarged after failure.

A local slice canPASS its declared behavior without every product gate passing.
It cannot claim EXTERIOR-COMPLETE with known material source discrepancies or
architectural compile omissions in the accepted scope. Keep slice, campaign
and verification statuses separate. Historical failures are never hidden.
