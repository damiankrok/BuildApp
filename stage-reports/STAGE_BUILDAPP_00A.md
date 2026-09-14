# STAGE BUILDAPP-00A — WALL TOPOLOGY / JUNCTIONS / ANALYZER-FRIENDLY WALL RINGS

## 1. Baseline

| | |
| --- | --- |
| Repository | `damiankrok/BuildApp` |
| Starting HEAD | `da01f5d328fc2d4f54aabb6b8fff669508d2d805` (the BUILDAPP-00 final HEAD, as inspected by the orchestrator) |
| Branch | `claude/buildapp-buildworld-v1-7y6yqh` — the harness-designated branch; the same branch BUILDAPP-00 was delivered on. No further suffix was forced. |
| Implementation HEAD | `50a4637` — model, DSL, compiler, oracles, demo, editor, web, tests |
| Docs HEAD | the commit after it — this report, `PROJECT_STATUS.md`, `docs/` |
| Final HEAD | the one commit above the docs HEAD; it changes only the SHA lines in this table and in `PROJECT_STATUS.md`, so every gate result below describes its tree |
| Schema version | `1.0.0` → **`1.1.0`** (explicit migration, §4) |
| Reference repository | `damiankrok/Web-analizer-builder` @ `claude/new-session-pvd4ik`, read only, not modified; its junction/ring concepts were the prompt for a design fitted to this model, not copied |

Pre-flight: `APP_SPEC.md`, `PROJECT_STATUS.md`, `AGENT_PROTOCOL.md`,
`stage-reports/STAGE_BUILDAPP_00.md` read; working tree clean at
`da01f5d`; baseline gates run before any change: typecheck clean, 75/75
tests. The BUILDAPP-00 demo was frozen as a fixture before the first edit
(`packages/model/test/fixtures/demo-house-1.0.0.json`, byte-identical to
`stage-reports/artifacts/building-model.json` as saved by the BUILDAPP-00
browser run).

## 2. Why: the abstraction leak, measured

In the BUILDAPP-00 demo the side walls were stated as `(10, 0.3) → (10, 7.7)`
so that the front and rear walls could own the corners. An analyzer would
have needed the wall thickness to say "these four walls form a rectangle".
The architecture test in `tests/architecture/topology.test.ts` now measures
this directly: for every wall endpoint and every other wall on the same
level, the endpoint's depth into that wall's thickness band. In the 1.0.0
fixture the right wall's start lies **0.300 m** inside the front wall (its
inner face); in the new demo no endpoint lies inside any band (depth is 0 —
the outer line — or beyond the band). The test fails if a thickness-based
trim ever returns.

## 3. Topology model

`packages/model/src/schema.ts`, `topology.ts` (533 lines), `issues.ts`.

```ts
type WallEndRef  = { wallId: string; end: 'START' | 'END' }
type WallJunction =
  | { id, kind: 'CORNER', a: WallEndRef, b: WallEndRef, owner: string, tolerance }
  | { id, kind: 'BUTT',   wall: WallEndRef, againstWallId: string, tolerance }
  | { id, kind: 'T',      wall: WallEndRef, againstWallId: string, tolerance }
type WallRing = { id, levelId, wallIds: string[], junctionIds: string[] }   // junctionIds[i] = the CORNER at vertex i
```

Both are persisted semantic objects (`model.wallJunctions`, `model.wallRings`)
with ids, evidence, names, tags; `tolerance` defaults to 1 mm. A ring is a
grouping over ordinary walls; its polygon is derived (`ringPolygon`).

**Resolution** (`resolveWallTopology(model)`) is plan-line arithmetic: a
wall's outer line and its parallel inner line; the cut of wall A against a
face line of wall B is the `a`-parameter where A's outer and inner lines cross
it. Each wall end gets an `EndCut { outer, inner }` — the material stops there
on the outer and on the inner face; equal values are the usual perpendicular
end face, different values an end cut lying in another wall's face plane.

| kind | participants | owner of the shared material | physical extents derived | thickness differences | interior / exterior |
| --- | --- | --- | --- | --- | --- |
| CORNER | ends `a`, `b` of two walls | `owner` (one of them) | owner's cut in the other wall's **far** face plane (covers the corner block); other wall's cut in the owner's **near** face plane. Convex corner: owner untouched, other trimmed by the owner's thickness. Reflex corner: owner extended into the notch by the other's thickness, other untouched. Same rule. | enters only via face lines; 0.5/0.25/0.3/0.4 ring tested exactly | allowed; INTERIOR owner of an EXTERIOR corner → warning `JUNCTION_KIND_MIX` |
| BUTT | one end `wall`, host `againstWallId` | the host (unmodified) | terminating wall's cut in the host's near face plane; contact span must lie within the host's *physical* face (after the host's own junctions) → else `BUTT_OFF_HOST` (measured) | thin partition into thick wall exact | EXTERIOR into INTERIOR host → warning |
| T | as BUTT | the host | as BUTT, and the contact must be strictly inside the host's physical length → else `T_JUNCTION_POSITION` (measured) | as BUTT | as BUTT |

An endpoint may lie anywhere within the other wall's band (natural corner on
the outer line, pre-trimmed on the inner face, or between) and resolves to
the same cut; short of the band → `JUNCTION_GAP`, past the far face →
`JUNCTION_OVERSHOOT`, both with the measured distance; nothing is moved.
Every wall end belongs to at most one junction (`ENDPOINT_JUNCTION_CONFLICT`).
Rings check that each vertex junction is the CORNER of consecutive walls and
resolved (`RING_NOT_CLOSED`), counts and membership (`RING_DEGENERATE`,
`UNKNOWN_WALL`, `UNKNOWN_JUNCTION`, `RING_LEVEL_MISMATCH`).

**Undeclared overlap** is a model error: every pair of walls with a common
height range whose physical footprints (convex quads) share > 1e-6 m² of plan
area → `WALLS_OVERLAP` with the measured area. Declared junctions resolve to
contact, so a 1.0.0 hand-trimmed file still validates.

## 4. Schema evolution

Decision: real evolution `1.0.0 → 1.1.0`, not a redefinition.
`packages/model/src/migrate.ts` runs inside `validateModel`, so `loadModel`,
`compileBuilding` and BuildWorld's Load all see it:

- `1.1.0`: loads as is.
- `1.0.0`: `wallJunctions: []`, `wallRings: []` added, version bumped, a note
  appended to `meta.notes`, warning `SCHEMA_MIGRATED` reported. Walls keep
  their stated extents. Re-saving writes 1.1.0.
- `1.0.0` carrying topology collections: refused (`SCHEMA`).
- anything else: `UNSUPPORTED_SCHEMA_VERSION`, naming `1.0.0, 1.1.0`.

Tests (`packages/model/test/migration.test.ts`, 5): the BUILDAPP-00 fixture
loads with exactly `[SCHEMA_MIGRATED]`, keeps all 12 walls and ids, has no
`WALLS_OVERLAP`, re-saves as 1.1.0 and reloads clean; `0.9.0`, `1.2.0`,
`2.0.0`, `1.1` refused; a mislabelled file refused. Geometry equivalence in §8.

## 5. DSL additions

`packages/commands` (`commands.ts`, `apply.ts`):

- `createWallRing { id?, levelId, polygon, thickness, height, baseOffset?, kind?, topProfile?, materialId?, walls?: [{ id?, name?, height?, thickness?, materialId?, topProfile?, evidence?, tags? }], cornerOwnership?: ALTERNATE|PRECEDING|FOLLOWING, tolerance? }`
  → one wall per edge on the outer footprint, one CORNER per vertex, one
  `WallRing`. Ids `<ring>-w<i>`, `<ring>-j<i>` (deterministic from a stable
  ring id; without one, `ring-1-…`). A clockwise polygon is reversed with the
  overrides following their edges; a non-simple polygon is refused
  (`RING_DEGENERATE`). ALTERNATE gives even edges their corners (front and
  rear on a rectangle).
- `createWallJunction { kind, a?, b?, owner?, wall?, againstWallId?, tolerance? }` — standalone.
- `createWall` gains `startJunction?` / `endJunction?`
  (`{ kind: 'CORNER', with, owner: SELF|OTHER } | { kind: 'BUTT'|'T', againstWallId }`):
  a wall stated from footprint line to footprint line overlaps its neighbours
  until its junctions exist, and every command must leave the model valid,
  so wall and junctions enter in one step (ids `<wall>-j-start/end`).
- `removeFeature` cascades wall → its junctions and rings, junction → its
  rings; removing a corner alone is refused (`WALLS_OVERLAP`).
- `setProperty` on a junction's `owner` / `tolerance` works and re-resolves.

## 6. Compiler changes

`packages/geometry/src/wall-compiler.ts` (323 lines) takes `extent:
WallExtent`. The **core** `[max(start cuts), min(end cuts)]` is tiled on the
BUILDAPP-00 grid (openings only there — validation guarantees
`OPENING_IN_JUNCTION_ZONE` otherwise); an **end zone** (one face continuing
past the other) adds a face strip split on the same height breaks and top
crossings, a bottom triangle, a top triangle and the skewed end face zipped
between the two chains. `compileBuilding` resolves topology once and passes
each wall its extent; `wallTopFunction` collects roof breaks over the
physical span (an owner extended at a reflex corner still follows the roof).
New diagnostic `WALL_CONSUMED`. No union, no merge: each wall's triangles
carry that wall's `objectId`; a corner block is in exactly one solid.

## 7. Verification additions

`packages/verification/src/oracles.ts`: `unionMaterialRuns` (runs through
several solids, unioned — a ray through the concatenated triangles of
abutting solids is not sound: two exits at the same distance collapse) and
`ringClosureReport(polygon, solids, { heights, step, endInset, tolerance, minThickness })`,
which knows nothing about junction records or the compiler: probes from 1 cm
outside the outer line inward at every 0.1 m (nudged off round numbers) and
at each height, two rays per vertex parallel to the interior bisector nudged
20 mm along each edge, pairwise overlap estimate. Reports measured gaps
(`edge, from, to, length, worstStart`), corner probes (`materialStart`,
`materialLength`), overlaps, `outsideOnly` edges.

## 8. Measured proofs

All numbers from the compiled scene through the independent oracles
(`packages/geometry/test/topology.test.ts`, `tests/architecture/topology.test.ts`,
`packages/verification/test/ring-oracle.test.ts`, and a measurement script
run for this report).

**Closed four-wall rectangle from untrimmed corners** — `createWallRing`,
polygon `(0,0) (10,0) (10,8) (0,8)`, T = 0.3, H = 3:

| wall | declared | resolved extent (outer = inner) | volume | closed |
| --- | --- | --- | ---: | --- |
| front | `(0,0)→(10,0)` | 0 .. 10 | 9.000000 m³ | yes, 12 triangles, 0 boundary / 0 duplicate edges |
| right | `(10,0)→(10,8)` | 0.3 .. 7.7 | 6.660000 m³ | yes |
| rear | `(10,8)→(0,8)` | 0 .. 10 | 9.000000 m³ | yes |
| left | `(0,8)→(0,0)` | 0.3 .. 7.7 | 6.660000 m³ | yes |

Sum **31.320000 m³** = `(10·8 − 9.4·7.4)·3` = 31.32 (difference 1.1e-14).

**Exactly-once corner material**: a vertical ray through each corner block
meets one solid for the full 3 m and every other wall for 0:
`(0.15,0.15)` front 3.000 / others 0; `(9.85,0.15)` front 3.000;
`(9.85,7.85)` rear 3.000; `(0.15,7.85)` rear 3.000. Worst pairwise shared
volume between any two walls (0.05 m grid): **0**. Horizontal rays: across
at z = 4 → runs `[0, 0.3]` and `[9.7, 10]`; across at x = 5 → `[0, 0.3]`,
`[7.7, 8]`; along the front wall 0.15 m in through both corner blocks → one
run `[0, 10]`; along the right wall 0.15 m in → one run `[0, 8]` (no
daylight, unioned runs).

**Ring closure oracle** on that ring: closed = true, 736 probes, 0 gaps, 0
overlaps, every corner probe finds 0.4243 m of material (= 0.3·√2).

**Other shapes**: L-ring (reflex corner) — sum of six volumes 31.320000 m³ =
(64 − 53.56)·3, the notch `[5.7,6]×[3.7,4]` filled by the extended owner
(end cut 4.0 → 4.3) and no other wall. Regular hexagon (apothem 4, six 120°
corners, all cuts skewed, e.g. `start outer 0 / inner −0.1732`, `end outer
4.6188 / inner 4.7920`): sum **24.006224 m³** = `2√3·(4² − 3.7²)·3` =
24.006224 (difference 1.8e-14), every wall closed, no pair shares volume;
rays from the centre through each corner measure 0.3464 m = T/cos 30°.
Four different thicknesses (0.5 / 0.25 / 0.3 / 0.4): sum = `80 − 9.35·7.2`
× 3 = 38.04 m³, the front's corner block spans the right wall's full
thickness. Rotated ring (0.7 rad) with a window 50 mm past the corner block:
same volumes, resolved start 0.3 on both faces, window really cut.

**Valid butt junction**: partition `(5,0)→(5,4)` T 0.2 against host
`(0,0)→(10,0)` T 0.3: partition extent 0.3 .. 4, contact on the host's inner
face at 4.8 .. 5.0 m, host volume 9.000 m³ (unchanged), partition 2.220 m³ =
3.7·0.2·3, shared volume 0, partition min z = 0.300, one continuous run of
material along the partition line from 0 to 4 m.

**Valid T-junction**: wing `(15,6)→(10,6)` from outside against host
`(10,0)→(10,8)`: wing end at a = 5 (the host's outer face), host 7.200 m³,
wing 4.500 m³, min x = 10.000, no shared volume; contact 5.7 .. 6.0 strictly
inside 0 .. 8. BUTT at the host's end accepted; the same as T →
`T_JUNCTION_POSITION`; 0.5 m off the host → `BUTT_OFF_HOST` measured 0.500.

**Wall opening near a valid corner**: on the owner, a window at 8.75 .. 9.95
(50 mm from the outer corner) is a real hole (ray 0 through it, 0.3 at
9.975); on the trimmed wall, a window at 0.35 .. 1.55 (50 mm past the
consumed zone) is cut, right wall volume `((8−0.6)·3 − 1.2·1.4)·0.3`. A
window at 0.2 on the trimmed wall → `OPENING_IN_JUNCTION_ZONE`, message
"reaches 0.100 m into a consumed junction zone and was not shrunk"; a door
at 6.9 .. 7.9 on the left wall → the same code.

**Roof-following ring**: 8 × 6 ring under a 40° gable (overhang 0.5,
thickness 0.2): eave walls die into the soffit on both faces (outer top
3 − drop + 0.001·slope, inner 3 − drop + 0.399·slope, roof underside meets the
wall top within 1e-9 on three rays), gable walls rise to the ridge underside
and are trimmed to z 0.4 .. 5.6, the front's corner block follows the soffit
like the rest of the wall; all four walls closed, no shared volume.

**Demo before / after** (1.0.0 fixture vs the topology demo): both compile
with **0 diagnostics**, **2 332 triangles, 88 meshes, 58 objects** each; for
every one of the 12 walls the solid's bounds agree to 1e-9 on all six values
and the volumes agree — largest difference **3.1e-15 m³**; every opening's
world position agrees to 1e-9 (wall-local offsets were re-stated from the
new origins: `op-gl-1` 2.5→2.8, `op-grt-1` 6.2→6.5, `op-partition` 3.0→3.3,
`op-gar-1` 2.5→2.8, `op-ul-gable` 3.1→3.4). The new demo declares 13
junctions (8 ring corners, 2 partition Ts, 2 garage corners, 1 garage T) and
2 rings; both storey rings pass the closure oracle (closed, 0 gaps, 0
overlaps, 736 probes each). Thickening `g-front` to 0.45 moves `g-right`'s
physical start to 0.45 on both faces (also checked in the browser).

## 9. Mutation results

Analyzer house from `tests/architecture/topology.test.ts` (ring + partition
+ door + 5 windows), each mutation with the checker that catches it:

| # | mutation | model-level checker (validation code, measured) | geometry-level checker |
| --- | --- | --- | --- |
| 1 | rear wall deleted from the model | `UNKNOWN_WALL` on the two corner junctions and on the ring; model not compiled | ring oracle on the good scene minus that solid: gap on edge 2 of 10.0 m (100 probes), corner probes 2 and 3 fail |
| 2 | right wall start shifted to `(10, 0.5)` | `JUNCTION_GAP` measured 0.200 (also `RING_NOT_CLOSED`; on the demo additionally `OPENING_IN_JUNCTION_ZONE` for the window that now sits 0.1 m into the zone) | oracle on a hand-trimmed variant: one gap on edge 1 between 0.3 and 0.6 |
| 3 | an undeclared wall crossing the front wall | `WALLS_OVERLAP` measured 0.0360 m² (command refused) | — |
| 4a | corner owner set to a wall not at the corner | `JUNCTION_OWNER_NOT_PARTICIPANT` | — |
| 4b | butt/T roles swapped (host declared as the terminating wall) | `ENDPOINT_JUNCTION_CONFLICT` (the host's end already belongs to its ring corner) | — |
| 4c | T declared against the wrong host wall | `JUNCTION_OVERSHOOT` 7.7 m (the partition crosses that wall's band at its other end) + `WALLS_OVERLAP` with the wall it no longer declares | — |
| 5 | partition moved to x = 12, beyond the host | `T_JUNCTION_POSITION` (out by 2.0 m) | — |
| 6 | opening at 0.1 m on the trimmed right wall | `OPENING_IN_JUNCTION_ZONE` measured 0.200 (command refused; not shrunk) | — |
| 7 | a second junction claiming the right wall's start | `ENDPOINT_JUNCTION_CONFLICT` | — |
| 8 | front wall reversed | `JUNCTION_OVERSHOOT` + `RING_NOT_CLOSED` | oracle: edge 0 gap 10.0 m, `outsideOnly = [0]`, corners 0 and 1 fail |
| 9 | duplicated wall (geometry only; the model refuses it as overlap) | `WALLS_OVERLAP` 3.0 m² for a full duplicate | oracle: overlap front/front-dup 9.0 m³, worst shared ray 3.000 m |
| 10 | corner block left empty by two short walls | (only reachable without junctions) | oracle: corner probe 1 fails with material starting at 0.396 m, edge gaps on edges 0 and 1 |

## 10. Files

| file | lines | role |
| --- | ---: | --- |
| `packages/model/src/topology.ts` | 533 | junction/ring resolution, footprints, overlap, ring checks |
| `packages/model/src/migrate.ts` | 87 | explicit 1.0.0 → 1.1.0 migration |
| `packages/model/src/issues.ts` | 63 | issue vocabulary (with `measured`) |
| `packages/model/src/schema.ts`, `validate.ts`, `query.ts`, `ids.ts` | | records, collections, kinds, validation wiring |
| `packages/commands/src/commands.ts` (394), `apply.ts` (695) | | `createWallRing`, `createWallJunction`, inline junctions, cascade |
| `packages/geometry/src/wall-compiler.ts` | 323 | physical extents, end zones |
| `packages/geometry/src/compile.ts`, `types.ts` | | topology resolution in the pipeline, `WALL_CONSUMED` |
| `packages/verification/src/oracles.ts` | 436 | `unionMaterialRuns`, `ringClosureReport` |
| `packages/demo/src/demo-house.ts` | 247 | the demo on natural footprint coordinates |
| `packages/editor/src/store.ts` | 558 | Topology tree group, `describe().topology`, junction/ring properties |
| `apps/web/src/components/Inspector.tsx`, `Outliner.tsx` | | Topology section, kind tags |
| `docs/WALL_TOPOLOGY.md` | 241 | the topology document |
| tests: `packages/model/test/topology.test.ts` (349), `migration.test.ts` (71), `packages/commands/test/topology-commands.test.ts` (232), `packages/geometry/test/topology.test.ts` (325), `packages/verification/test/ring-oracle.test.ts` (117), `tests/architecture/topology.test.ts` (295), `apps/web/e2e/buildworld.spec.ts` (237) | | |
| `packages/model/test/fixtures/demo-house-1.0.0.json` | | the BUILDAPP-00 demo as persisted |

Implementation diff: 41 files, +4 935 / −208. Source total (src + tests +
e2e): 9 825 lines.

## 11. Commands run

```
npm install                       already installed; no-op
npm run typecheck                 clean (baseline and final)
npm test                          vitest run — baseline 75 passed / 10 files; final 148 passed / 16 files
npm run build                     typecheck + vite build — clean, apps/web/dist 892 KB
npm run e2e                       vite build + playwright test — 7 passed (37.5 s)
```

## 12. Test results

| file | tests | measures |
| --- | ---: | --- |
| `packages/model/test/topology.test.ts` | 19 | convex / other-owner / reflex / pre-trimmed / oblique corners, gap and overshoot measured, parallel / self / owner / dangling / level errors, endpoint conflict, interior-owner warning, butt contact, from-outside T, BUTT at host end vs T, off host, contact against the host's physical face, consumed wall, overlap area 0.09 m², contact and stacked storeys not overlaps, duplicate wall 3 m², closed ring extents, ring error codes, unresolved ring corner |
| `packages/model/test/migration.test.ts` | 5 | version constant, fixture migration, mislabelled file, unsupported versions, no-op cases |
| `packages/model/test/model.test.ts` | 11 | BUILDAPP-00 (one test migrated: the copied wall now stands 5 m back) |
| `packages/commands/test/topology-commands.test.ts` | 14 | ring ids / chaining / ownership / overrides / clockwise / degenerate / JSON, inline T and CORNER, standalone junction, refused gap, thickness re-resolution, owner change, refused move/resize, opening into zone, cascade and refused corner removal |
| `packages/commands/test/commands.test.ts` | 11 | BUILDAPP-00 |
| `packages/geometry/test/topology.test.ts` | 15 | §8 proofs |
| `packages/geometry/test/wall.test.ts`, `roof.test.ts`, `fills.test.ts`, `scene.test.ts` | 26 | BUILDAPP-00 (demo scene: still 0 diagnostics, 19 closed structural solids, pairwise overlap exactly `{chimney-1|roof-main}`) |
| `packages/verification/test/ring-oracle.test.ts` | 7 | §7, §9 |
| `packages/verification/test/oracles.test.ts` | 4 | BUILDAPP-00 |
| `packages/demo/test/demo.test.ts` | 4 | BUILDAPP-00 |
| `packages/editor/test/store.test.ts` | 6 | BUILDAPP-00 (one test migrated: the height edit lowers the wall; raising it is now refused as `WALLS_OVERLAP` with the upper wall — asserted) |
| `tests/architecture/boundaries.test.ts` | 13 | BUILDAPP-00 (one test migrated: the fills-follow-the-wall move uses a free wall; moving a ring wall is asserted refused with `JUNCTION_GAP`) |
| `tests/architecture/topology.test.ts` | 13 | no manual trimming (runtime depth check + source check + rings on the footprint), analyzer-friendly build, 10-entry mutation catalogue |

Architecture boundaries unchanged and green: model imports only zod;
commands depend on model; the compiler imports only the model; oracles import
nothing from the workspace; the web app value-imports no geometry, never
calls the compiler, never builds primitives; the demo imports no geometry and
is `runCommands(createEmptyModel, demoBuildingCommands())` byte for byte; the
compiler does not import the demo; nothing in topology mentions Marcówki.

## 13. Browser verification

7/7 in Chromium 1194 (SwiftShader) against `vite preview` of the production
build. The BUILDAPP-00 checks (render, tree → inspector, refused edit,
undo/redo, door angle, roof pitch, presets, roof toggle, storey isolation,
hide/show, isolate, grid/axes, click picking, save/load) pass with two
deliberate edits: the height edits lower `g-front` (raising it is now a
`WALLS_OVERLAP` against `u-front`, correctly refused). New check: rings
`ring-ground` / `ring-upper` and 13 junctions in the loaded model;
`g-right` physical extent 0.300 – 7.700 m in the inspector; the ring row
selects a `wallRing` (closed: yes), a corner row a `wallJunction`
(resolved: yes); thickening `g-front` to 0.45 re-resolves `g-right` to
0.450 – 7.700 m with `geometry ok`; a lone `moveFeature` of `g-front` is
refused with `JUNCTION_GAP` shown in the inspector and the revision unchanged.
Screenshots and the saved model (now schema 1.1.0) refreshed in
`stage-reports/artifacts/`.

## 14. Known limitations

- One junction per wall end; three walls at a point are a CORNER plus a
  BUTT/T. No mitre ownership (one owner per corner).
- Plan editing of ring walls is refuse-only: moving or lengthening one ring
  wall gaps its corners, removing a corner alone overlaps its walls. There is
  no topology-aware move yet.
- `WALLS_OVERLAP` covers walls only, by nominal height range and physical
  plan footprint.
- Endpoints must be within `tolerance` (1 mm) of the other wall's band; an
  analyzer with looser coordinates states a larger tolerance per junction.
- The oracle's corner probes measure the block along nudged bisectors; a
  corner block narrower than 20 mm would need a smaller nudge.
- BUILDAPP-00 limitations otherwise unchanged (chimney through roof, roof
  families, slabs without holes, placeholders, constraints not solved,
  inspector-driven editing).

## 15. Compromises

- A wall stated on the natural footprint is refused until its junctions
  exist, because each command must leave the model valid; hence inline
  `startJunction` / `endJunction` on `createWall` rather than a separate
  transaction command.
- Two BUILDAPP-00 tests and two browser steps edit heights downward instead
  of upward; the upward edits were overlaps the old model did not detect.
- Opening offsets in the demo were re-stated (§8) so that the geometry is
  dimensionally identical; the wall-local frame's origin moved to the corner.

## 16. Recommended next bounded technical step

Topology-aware plan editing (`moveJunction` / move a wall with its
neighbours, keeping corners and Ts satisfied in one validated command) and
rooms derived from resolved topology (a ring's inner polygon, T-split hosts),
so that room polygons need not be stated by hand — the last piece of
thickness arithmetic an analyzer would otherwise still do.

---

`PASS_STAGE_BUILDAPP_00A_WALL_TOPOLOGY`
