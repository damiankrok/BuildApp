# BUILDAPP-03X — Analyzer refoundation audit + Marcówki Auto v2

Branch `claude/buildapp-buildworld-v1-7y6yqh`. START HEAD
`d5d6375d8675143730307d71f45c0d940fcd134b` (the sealed end of BUILDAPP-03R1).
Implementation commits `9363d6b` (research), `13896a1` (audit and v2
schemas), `59d5676` (pipeline), `7e01828` (callouts, gates, apps, CI),
`606c829` (fixtures, ridge axis, docs), `9f67eb9` (test runner). CI is green
on `9f67eb9` — `BuildApp CI` run 36057369183, all four jobs (core, browser,
Android, dependency audit). END HEAD: the commit that carries this
paragraph and the `PROJECT_STATUS.md` row (see `git log`).

## What this stage was for

BUILDAPP-03R1 measured the reference project's facades to a few centimetres
and still shipped an automatic candidate that a reviewer would not accept as
that house: no recesses, no interior, a roof stopping short of the zones it
covers, no stair, opening heights from conventions rather than from the
sheet. The brief asked for two things, in order: a forensic audit of where
the source evidence was being lost, then a refounded analyzer that consumes
that evidence and produces a `Marcówki Auto v2` through the production path,
evaluated against a source truth sealed independently of the analyzer.

Both were done. The truth was sealed first (research, never imported by
production code); the audit named the loss point of every family; the v2
pipeline was built pass by pass against the audit's findings; the candidate
was evaluated per feature against the sealed truth, with no aggregate score.

## Part A — the audit

### Source truth v2 (`research/marcowki-v2/`)

`marcowki-source-truth-v2.json` seals **138 items** read from the raw current
source package (plans, elevations, section, renders, published page facts):
26 SOURCE_EXACT, 31 CORROBORATED, 49 DERIVED, 12 IMAGE_METRIC_REGISTERED,
8 VISUAL_SEMANTIC, 12 UNRESOLVED. `MARCOWKI_SOURCE_TRUTH_V2.md` is the
narrative (frame, registrations, the 14.60 proof table, roofs, chimneys,
rooflights, the twelve openings with their printed callouts, interior walls
and rooms, the U-stair 5+7+5, facade assemblies, balconies, materials, the
unresolved list). `source-atlas.json` records every asset's family,
projection, character and orientation hypothesis. `source-truth-diff-v1.json`
holds the v1 truth to account: 87 SAME, 5 V1_WRONG (stair riser counts and
winders, the front balcony thickness), 1 CHANGED, 8 V1_MISSING, 1 resolved,
2 unresolved. `MARCOWKI_REFERENCE_AUDIT.md` compares the v1 reference model,
the 03R1 Auto and the truth per family.

The single most consequential finding of the truth work: the 03R layout's
frame is **mirrored in z** against the sheet (z = 0 at the rear wall, the
front at 12.61; `z_v2 = 13.60 − z_auto`). The v1 reference audit had
misread the Auto by a whole metre because of it; corrected, the 03R1 Auto
places 10 of 12 openings within 0.2 m and derives every height from a
convention.

### Forensic audit (`docs/ANALYZER_FORENSIC_AUDIT.md`)

Eleven facts, each with the file and line where the evidence stops being
read: relations in the observation graph never consumed; six observation
kinds read of the vocabulary; hypotheses output-only; the layout's recesses
and zones never read downstream (`layout.ts:1073`, `plan-decomposition.ts:913`);
null vision; perspectives unregistered; the DSL vocabulary unused beyond walls
and rectangular openings; the frame mirror at `reconstruct.ts:84`;
verification reporting NOT_CHECKED on every silhouette; OCR never reading a
callout circle; the attic plan registered at 0.04694 m/px, which is wrong.

## Part B — the analyzer v2

`packages/reconstruction/src/v2/` (twelve modules and the orchestrator
`reconstruct-v2.ts`), entered from `packages/reconstruction/scripts/reconstruct-v2.ts`
(`npm run reconstruct:v2:marcowki`). The passes, in order, each with its
inputs and outputs recorded as a `SolverStep`:

| pass | what it reads | what it produces |
| --- | --- | --- |
| massing | the 03R layout (kept, project-generic) | `WorldFrameV2`: x from the west outer face, z from the FRONT outer plane, the mirror against 03R stated once (`flipZ`) |
| plan registration | outer wall faces of each plan (`outerWallFaces`) against the body the storey covers | `PlanFrameV2` per storey; the attic plan at 0.02625 m/px, anisotropy 0.3 % |
| render registration | silhouette span against the envelope width or the characteristic depth, the ridge datum for the apex | `ElevationRegistrationV2` per side, isotropic |
| roof | published pitch, ridge datum, both side renders' span votes | a GABLE over the zones (z 0..14.60), `coversZones` with its reason |
| recesses | scan lines across each zone at 20–80 % depth, wall-thick ink runs voted over ≥ 60 % of lines | `RecessTopology` per side and storey: returns 0..0.66 / 11.42..12.05 at the ground front, 0..0.63 / 7.26..7.90 at the attic and rear |
| stair | tread ladders (`thinStrokesAlong`, even spacing 0.21–0.34 m) pooled across storeys, the arrowhead on the walking line | `StairTopologyHypothesis`: U, 5+7+5 = 17 risers over 3.06 m = 0.180 m, two quarter landings, emitted as FLIGHTS |
| interior | neutral dark ink at 0.2–0.72 of the wall thickness, junction tests, door gaps 0.6–1.35 m with jamb rules, solid blocks, room flood fill | per storey: partitions, doors, blocks (chimneys), rooms with numbers where the OCR read one |
| openings | plan gaps on the wall centre line, ring callouts with candidate readings, elevation extents, gable soffits | `OpeningV2` with per-property provenance; raked heads on the three gable windows |
| section, roof details | the section registered by its wall columns; the flat slab band and parapet; blocks on every storey; light patches in the roof plane at three brightness steps | the garage roof (slab 2.89 / parapet 3.12), two chimneys to 7.86, three rooflights |
| facade | verge band under the rake, fascia band nearest the slab level, first rail line above it, the fascia continuing over the garage zone | verges, balconies, railings, the portal head, GABLE_FRAME and PORTAL_FRAME assemblies |
| cameras | silhouette hull corners against the envelope's box, hypothesis enumeration | three of four perspectives solved (0.9–3.6 px rms), sealed with their parameters |
| verification and repair | opening extents and roof edges re-read on the registered renders | 28 residuals; a bounded repair that applied nothing and refused nine changes with reasons |
| emission | `BuildingV2` → the Building DSL | 209 commands, sealed, replay byte-identical |

Every reading carries a `ProvenanceStatus` and a `why`. The ledger
(`evidence-consumption.json`) gives every one of the 888 observations, 142
metric readings, 18 published rooms and 10 page facts a disposition:
USED_IN_MODEL 24, USED_AS_CORROBORATION 732, REJECTED_WITH_REASON 99,
IGNORED_WITH_REASON 163, UNRESOLVED 40; `ledgerViolations` and
`featureGraphViolations` both return nothing. The feature graph
(`feature-lineage.json`) seals 103 solved features with their sightings,
measurements, relations and bindings to model objects; `feature-quality.json`
grades them L0 5 / L1 67 / L2 31.

### The callout reader

The one reader the audit said did not exist. `packages/source-metrics/src/callouts.ts`
finds the circled `width / height` symbols as rings with a bar, reads each
half at the size a published sheet prints them (seven-pixel italic digits)
and, because no matcher tells a 3 from a 9 at that size every time, returns
each half as a **short list of candidate readings** rather than one number.
The openings pass picks the width the plan gap agrees with and the height the
elevation agrees with; where nothing decides between two readings the head is
marked UNRESOLVED and both are recorded. On the reference sheets all eleven
facade openings received their printed callout; nine heights are the printed
ones, two (the west living window, the garage door) are flagged as ambiguous
between two readings with no elevation reading to decide. The tuning of the
matcher is generic to small italic numerals and is tested on the synthetic
face (`packages/source-metrics/test/callouts.test.ts`).

### What the candidate contains

Two bodies (7.90 × 12.61 m main over two storeys, 4.15 × 7.51 m garage), four
recess readings with eight returns, a gable roof over the zones, a flat garage
roof from the section, two chimneys, three rooflights, eleven facade openings
plus the doorway between the bodies (three raked on the gable ends), 31
partitions with 9 interior doors and 12 rooms, the U-stair as FLIGHTS, two
balconies with fascias and railings, two verges, the portal head, three
assemblies, three cameras.

## Evaluation against the sealed truth (`marcowki-v2-evaluation.{json,md}`)

Per item, with the tolerance taken from the truth's own uncertainty (never
below 0.05 m for heights, 0.10 m for plan-derived lengths, 0.5° for angles),
no aggregate score:

| family | truth items | MATCH | PARTIAL | MISSING |
| --- | --- | --- | --- | --- |
| FRAME | 1 | 1 | 0 | 0 |
| LEVEL | 9 | 6 | 2 | 1 (terrain: the section's −0.32 was not read) |
| MASS | 5 | 4 | 1 (the garage's shared wall thickness is not a field) | 0 |
| RECESS | 3 | 3 | 0 | 0 |
| RETURN | 2 | 1 | 1 (return top is a text value in the truth) | 0 |
| ROOF | 4 | 3 | 1 (build-up 0.15 conventional vs 0.276 drawn) | 0 |
| ROOF_MEMBER (verge) | 1 | 1 | 0 | 0 |
| CHIMNEY | 2 | 0 | 2 (plan extents 0.13–0.18 m wide of the truth) | 0 |
| ROOFLIGHT | 3 | 0 | 3 (glass read 0.15 m smaller than the printed 78 × 118) | 0 |
| OPENING | 12 | 3 | 9 (families from visual cues; two heights ambiguous) | 0 |
| INTERIOR_WALL | 24 | 14 | 9 | 1 (a wall that is all door between two corners) |
| ROOM | 19 | 1 | 18 (open plan merged; numbers mostly unread) | 0 |
| STAIR | 1 | 0 | 1 (only the well rectangle is not a field) | 0 |
| BALCONY | 2 | 0 | 2 (fascia extents 0.1–0.7 m short) | 0 |
| PORTAL | 1 | 1 | 0 | 0 |
| RAILING | 2 | 0 | 2 (ends 0.1 m short; rear height 0.92 vs 0.87) | 0 |
| FACADE_ASSEMBLY | 4 | 1 | 3 | 0 |

The stair matches in every count and going; the openings' intervals and
widths are all within tolerance; the recesses, returns, masses, roof, verge
and portal match. What is PARTIAL is named and traceable to a reader, not to
a lost piece of evidence.

## Gates

- `npm run audit:analyzer-v2`: 22 checks on the artifacts (replay,
  hash chain, graph and ledger invariants, quality coverage, the §29 block
  conditions expressed structurally, repair never touching a SOURCE_EXACT
  property) — all pass.
- `npm run reconstruct:no-benchmark`: the reference package, every
  `source-truth`/`reference-` package and `research/` moved out of the tree,
  the v2 path run end to end, the structure held to (bodies, recesses with
  returns, partitions with doors and rooms, a stair, openings with callouts,
  a roof, byte-identical replay) — passes. `reconstruct:no-reference` kept.
- `tests/architecture/analyzer-v2.test.ts`: no project name, id, asset hash,
  reference or truth import in any production analyzer source; the committed
  ledger covers every observation and metric id; graph and ledger invariants
  hold on the committed artifacts.
- `packages/reconstruction/test/facade-stripes.test.ts`: 100 alternating
  stripes do not become 100 members; a fascia is only ever the band at the
  slab level passed in.
- Synthetic fixtures through v2 (`packages/reconstruction/test/fixtures-v2.test.ts`,
  §25): ten houses that exist only in `packages/synthetic-drawings/src/fixtures-v2.ts`,
  drawn in the model frame with nothing of the reference project in them —
  one storey with a gable; two storeys; a lower attached body with a flat
  roof; a front loggia with two returns and the roof running over it; a
  partition with a door and numbered, labelled rooms on each storey; a
  straight stair of sixteen risers with its arrow; a chimney on both plans
  and above the roof; a rooflight in the roof plane; an attic window with a
  raked head on the gable end; an upper loggia with a balcony slab, fascia
  and railing. Every expectation is the number the sheet was drawn from, and
  every fixture seals a replayable candidate with an empty graph and ledger
  violation list. All eleven tests pass. Writing them found and fixed one
  real defect: the ridge axis had been taken from the 03R layout, which
  picks the longer plan side; v2 now votes it from the renders' own apex
  (a gable end has a peak at mid-span, a side view a flat top) and keeps the
  layout's axis only when no render shows an unmistakable apex, re-deriving
  a measured pitch over the true half span when the axis changes.
- CI (`.github/workflows/buildapp-ci.yml`): the core job runs the audit, the
  no-benchmark proof and the evaluation, and uploads
  `stage-reports/artifacts/analyzer-v2/**`; browser and Android jobs carry the
  new sealed candidate (`marcowki-auto-v2`) through the web model list and the
  exported Android scenes. No APK is committed.

## §29 block conditions, reviewed

| condition | state |
| --- | --- |
| 14.60 topology only diagnostic | the roof footprint is z 0..14.60 in the model, over the zones, with `coversZones` and its reason |
| recesses vanish | four recess readings, eight return walls emitted, terraces on the recess floors |
| interior omitted | 31 partitions, 9 doors, 12 rooms, chimney blocks, the stair as FLIGHTS |
| facade random strips | members only at evidence: verge under the rake, fascia at the slab level, rail above it; the stripe stress test |
| wrong opening profiles without unresolved status | three raked heads on the gable ends; every ASSUMED or UNRESOLVED sill/head lists its reason in `unresolved` (audited) |
| evidence loss | every observation and metric reading dispositioned; HIGH-authority drops carry reasons |
| reference seeding | architecture tests and the no-benchmark proof |
| repair violating hard dims | the repair applied nothing; its nine refusals name the SOURCE_EXACT property they would have overruled |
| generic output | the candidate is this house: its recesses, its stair, its rooflights, its printed openings |

## What this stage did not do, honestly

- Opening **families** come from visual cues (glazing lines, swing arcs) and
  disagree with the truth on six of twelve (the entrance reads as a window,
  the west living window as a door, the gable glazing as multi-panel). They
  are VISUAL_SEMANTIC, L1, and not a block condition; a door-symbol reader is
  the next step.
- **Room numbers**: the general OCR reads few of the printed room numbers on
  these sheets, so most rooms carry no label; the two that do are correct.
  Open-plan rooms (hall, kitchen, living) are one room in the candidate.
- The **terrain datum** (−0.32) is not read from the section; terraces are
  ASSUMED. The roof build-up is the convention (0.15) rather than the drawn
  0.276.
- **Elevation extents** on renders are wrong for four openings (the rear
  glazing, the three gable windows); the printed height stands there with an
  unresolved note and the residual is reported, not hidden.
- The **rooflight callouts** (78/118) on the attic plan are not matched to the
  rooflights; their glass is measured from the renders 0.15 m small.
- The fourth perspective has no camera; the third's is loose.

## NEXT TECHNICAL STEP

1. A door-symbol reader on the plans (leaf line + swing arc) to fix the
   opening families, and an all-door wall rule (a doorway between two
   perpendicular walls' ends) for the attic corridor.
2. Rooflight callouts: match the attic plan's `w/h` rings near the rooflight
   symbols and size the rooflights from print.
3. Read the terrain datum and the roof build-up from the section (the level
   ladder already has the rows).
4. Room-number OCR: a dedicated reader for the large single digits inside
   room polygons, as the callout reader is for rings.
5. Elevation extents on renders: use the registered opening interval on more
   than one view and prefer the view where the band is glass-toned.
