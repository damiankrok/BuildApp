# STAGE BUILDAPP-00 — BUILDWORLD / SEMANTIC BUILDING EDITOR / BUILDING DSL

## 1. Baseline

| | |
| --- | --- |
| Repository | `damiankrok/BuildApp` |
| Starting HEAD | none — the repository was empty (no commits) |
| Branch | `claude/buildapp-buildworld-v1-7y6yqh` — the branch designated by the execution harness. The brief named `claude/buildapp-buildworld-v1`; the harness forbids pushing to any other branch, so the suffixed name was used and is recorded here. It is also the repository's first and only branch. |
| Implementation HEAD | `8a1406e19433dc752202641356fbca50df858f3c` |
| Docs HEAD | `bd035ebce5c17f25098228b56493ce0bdae0614b` — adds this report, `PROJECT_STATUS.md`, `README.md` and `docs/` |
| Final HEAD | the one commit above the docs HEAD; it changes only the SHA lines in this table and in `PROJECT_STATUS.md`, so every gate result above describes its tree |
| Reference repository | `damiankrok/Web-analizer-builder` @ `claude/new-session-pvd4ik` (`a44081d9739afa45b8cc8f52dfec651d30defe41`), read only, not modified |

Commits, oldest first: `cb04ec9` bootstrap and operational files · `59e65fc`
model, DSL and demo · `3d6469a` geometry, oracles and editor store · `8a1406e`
BuildWorld UI, browser verification and architecture tests · then docs.

## 2. Reference audit

Read: `README.md`, `docs/SCHEMAS.md`, `docs/WALL_LOCAL_COMPILER_PROOF.md`,
`docs/MARCOWKI_STRUCTURAL_SHELL_ROOF_PROOF.md`,
`docs/MARCOWKI_INTERIOR_ARCHITECTURALSPEC_REPORT.md`,
`docs/MARCOWKI_CHARACTERISTIC_FACADE_REPORT.md`,
`docs/UNIFIED_SOURCEPACKAGE_PARITY_REPORT.md`, the three gold files, and
`src/core/wallspec/` (`contracts.ts`, `compile.ts`, `roof.ts`, `ring.ts`,
`junction.ts`, `architectural.ts`, `building.ts`, `facade.ts`) plus
`src/ui/Viewer.tsx`.

Lessons carried into BuildApp:

| reference lesson | BuildApp |
| --- | --- |
| RC03: openings resolved through a global facade frame are dropped or misplaced on recessed walls | openings are stated only in the host wall's frame; a rotated/translated wall compiles the same hole (tested) |
| wall = box minus through-holes on one grid, ends/top/bottom split on the same breaks, bit-identical shared vertices | same grid discipline, extended to floor-level doors, stacked openings, sloped tops and roof-following tops |
| painted/glass rectangles vs real openings | reveals are emitted, rays through opening centres meet 0 wall material, fills are separate meshes |
| roof pitch must be measured from triangles, thickness perpendicular, vertical end cuts | `upwardPlanes` measures pitch from normals; vertical drop `t/cos(pitch)` |
| eave wedge: a wall top must vary across its thickness | `FOLLOW_ROOF` evaluates the roof underside at each face point; no daylight and no overlap between wall top and roof (tested on both faces) |
| duplicate corner volume, exactly-once ownership | corner ownership by wall extents in this stage; pairwise shared-volume test over every structural solid |
| provenance travels with values; only exact/corroborated may be hard constraints | `Evidence` on every object and per property, `isHardEvidence()` |
| refuse, never repair silently | validation and compiler diagnostics by code; nothing clipped or moved |
| oracles independent of the compiler | `packages/verification` imports nothing from the workspace |
| **the good compiler stayed outside the production path** (`src/ui/Viewer.tsx` drew `hypotheses/solid.ts` output; `wallspec/` was development-only) | one path: `EditorStore` compiles the model and the viewer draws only that; architecture tests grep the web app for any other geometry source |

Not copied: gold fixtures, Marcówki coupling, junction/ring records, facade
recess/portal specs, interior solver, analyzer, camera, OCR.

## 3. Architecture implemented

```
apps/web            BuildWorld (React 19 + Three.js 0.180)      ← draws EditorStore.scene only
packages/editor     EditorStore: command → model → compile → notify
packages/geometry   compileBuilding(model) → CompiledScene (tagged meshes)
packages/commands   Building DSL, applyCommand, BuildingSession (undo/redo)
packages/model      CanonicalBuildingModel: Zod schema, evidence, ids, validation, canonical JSON
packages/demo       demo house as a command list
packages/verification  volume / manifold / ray / overlap / pitch oracles
tests/architecture  boundary and single-path tests
```

npm workspaces, TypeScript 5.9 (strict), Zod 3, Vite 7, Vitest 3, Playwright
1.56 (Chromium 1194 preinstalled). SI units; no database.

## 4. Important files

| file | lines | role |
| --- | ---: | --- |
| `packages/model/src/schema.ts` | 487 | every semantic object, the frame constants, the model schema |
| `packages/model/src/validate.ts` | 292 | semantic validation codes |
| `packages/model/src/serialize.ts` | 67 | canonical JSON save/load |
| `packages/model/src/evidence.ts` | 81 | provenance vocabulary |
| `packages/commands/src/commands.ts` | 310 | command schemas and defaults |
| `packages/commands/src/apply.ts` | 594 | command execution, cascade removal, move/resize |
| `packages/commands/src/session.ts` | 124 | undo/redo, log |
| `packages/demo/src/demo-house.ts` | 173 | the demo building (commands only) |
| `packages/geometry/src/wall-compiler.ts` | 257 | watertight walls with real openings |
| `packages/geometry/src/roof-compiler.ts` | 165 | gable/flat roofs, underside function |
| `packages/geometry/src/fills.ts` | 211 | window and door fills |
| `packages/geometry/src/features.ts` | 108 | slab, balcony, railing, chimney, room, stair |
| `packages/geometry/src/compile.ts` | 266 | orchestration, ownership tags |
| `packages/verification/src/oracles.ts` | 247 | independent oracles |
| `packages/editor/src/store.ts` | 470 | editor store, tree, property specs |
| `apps/web/src/viewport/scene-adapter.ts` | 133 | CompiledScene → Three.js, mesh→object map |
| `apps/web/src/components/Viewport.tsx` | 224 | renderer, cameras, picking |
| `apps/web/src/components/Inspector.tsx` | 190 | property editing through commands |
| `apps/web/e2e/buildworld.spec.ts` | 193 | browser verification |
| `tests/architecture/boundaries.test.ts` | 180 | architecture tests |
| `docs/CANONICAL_BUILDING_MODEL.md`, `BUILDING_DSL.md`, `GEOMETRY_COMPILER.md`, `BUILDWORLD.md` | | technical documentation |

Source total (src + tests + e2e): 6 853 lines.

## 5. Commands run

```
npm install                                   126 packages
npm run typecheck                             tsc -p tsconfig.json && tsc -p apps/web/tsconfig.json — clean
npm test                                      vitest run — 75 passed, 10 files
npm run build                                 typecheck + vite build — clean, apps/web/dist 872 KB
npm run e2e                                   vite build + playwright test — 6 passed (32.9 s)
npm run dev                                   documented local dev command (vite, http://localhost:5173)
```

## 6. Test results

| file | tests | what is measured |
| --- | ---: | --- |
| `packages/model/test/model.test.ts` | 11 | frame/units recorded and enforced, evidence vocabulary, invalid references, negative height, opening outside host, door larger than wall, overlaps, malformed polygon, duplicate ids, fill mismatch, deterministic ids, wall frame, byte-identical round-trip |
| `packages/commands/test/commands.test.ts` | 11 | command set, references Window→Opening→Wall→Level, deterministic ids, rejected references, impossible openings, setProperty validation, move/resize, cascade removal, roof capping, JSON commands, undo/redo/log |
| `packages/demo/test/demo.test.ts` | 4 | DSL-only construction, feature coverage, fill associations, byte-identical round-trip |
| `packages/verification/test/oracles.test.ts` | 4 | oracles against a hand-built cube |
| `packages/geometry/test/wall.test.ts` | 9 | plain wall `L·H·T`, opening volume `(L·H − w·h)·T`, rays 0 through / `T` beside, door to the floor, four openings stacked and side by side, gable polyline volume and profile rays, refused opening above a profile, eave walls meeting the roof underside on both faces with no daylight and no overlap, rigid-motion invariance, purity |
| `packages/geometry/test/roof.test.ts` | 3 | pitch from normals = 35°, mirrored slopes, bounds with overhang, eave and ridge heights, volume `covered × drop`, pitch 30/48 moves geometry, flat roof pitch 0 |
| `packages/geometry/test/fills.test.ts` | 4 | window frame ring / glass / mullions closed and inside the opening and wall thickness, frame volume, ray through pane = glass only; door frame U, leaf inside opening, leaf pivot at 90° LEFT/RIGHT/IN/OUT, leaf volume at any angle |
| `packages/geometry/test/scene.test.ts` | 10 | demo: no diagnostics, every mesh → existing object, all 19 structural solids closed (0 boundary, 0 duplicate edges) with positive volume, every fill closed and hosted, every opening really cut (ray 0 / thickness beside), pairwise overlap = exactly `{chimney-1|roof-main}`, storeys stack seamlessly, purity, feature volumes/bounds, invalid model refused, L-shaped slab |
| `packages/editor/test/store.test.ts` | 6 | model-first edit trace, rejected edit leaves geometry, undo/redo recompile, selection/hide/isolate/storey/roof, save/load, describe/tree |
| `tests/architecture/boundaries.test.ts` | 13 | see §7 |

Measured values from the demo (from the compiled scene): 2 332 triangles, 88
meshes, 58 semantic objects with geometry; e.g. `g-front` 6.984 m³ =
(10·3 − 1·2.1 − 1.5·1.4 − 1.8·1.4)·0.3, `roof-main` 29.005604 m³ = 10.8·8.8·0.30519,
`u-right` gable wall 9.102561 m³, chimney/roof shared volume 0.110 m³ (stated
penetration, worst shared ray length 0.305 m = the roof's vertical drop).

## 7. Architecture tests (all pass)

1. viewer files never import `@buildapp/demo`; the demo enters only as a model via `createDemoBuilding()`
2. the web app value-imports nothing from `@buildapp/geometry`, never calls `compileBuilding`, never uses Three.js primitive geometries; the adapter consumes `CompiledMesh` and keeps `meshToObject`; the store compiles `this.session.model`
3. the store's scene deep-equals `compileBuilding(model)` before and after an edit
4. geometry compiler imports no react / three / editor / demo; its only dependency is `@buildapp/model`
5. model imports nothing above it; only dependency `zod`; commands depend on model only; demo imports no geometry; oracles import nothing
6. a structural opening removes `w·h·T` of material and a ray through it meets 0
7. save/load preserves every id
8. doors and windows keep their opening and host wall in the model and in every compiled mesh; moving the wall moves the door
9. editing a wall property: `command → model-updated → geometry-compiled → listeners-notified`
10. the demo is `runCommands(createEmptyModel, demoBuildingCommands())` byte for byte and its file contains no mesh code

## 8. Typecheck, build, browser verification

| gate | result |
| --- | --- |
| typecheck | clean |
| build | clean — `dist/index.html` 0.56 KB, `index-*.css` 4.8 KB, `react-*.js` 11.9 KB, `index-*.js` 374 KB, `three-*.js` 480 KB |
| browser | Playwright 1.56.0, Chromium 1194 headless with SwiftShader (`--use-angle=swiftshader`), against `vite preview` of the production build: **6/6 passed** |

Browser checks: (1) the demo renders, status shows 2 332 triangles, `geometry
ok`, WebGL pixels differ from the clear colour, no console errors; (2) scene
tree selection drives the inspector, `height` 3 → 3.4 on `g-front` bumps the
revision and the model, `width` 30 on an opening is refused with
`OPENING_OUTSIDE_HOST`, undo/redo restore; (3) door `openAngle` 70 and roof
`pitchDeg` 50 edit; (4) all six presets, roof toggle (86/88 meshes), storey
isolation (upper only), show all, eye hide/show of `g-front` also hides its
door, isolate `u-left` shows exactly `u-left`, `op-ul-gable`, `win-ul-gable`,
grid/axes toggles; (5) a click in the front view selects a semantic object,
a click on sky clears; (6) Save downloads canonical JSON, a modified copy
loads back (`Loaded from file`, height 3.8), a broken file is refused.

Artefacts in `stage-reports/artifacts/`: `01-perspective.png`,
`02-front-door-open.png`, `03-left-pitch-50.png`, `04-top.png`,
`05-upper-storey-isolated.png`, `building-model.json` (the saved demo).

## 9. Known limitations

- No explicit junction records; corner ownership is by wall extents (the
  caller trims the abutting wall to the owner's inner face). Overlapping
  walls are not a validation error.
- Chimney penetrates the roof without a roof cut (stated in the tests).
- Roof kinds: axis-aligned rectangular GABLE and FLAT only. A wall following
  a roof it is not fully under keeps nominal height outside (warning). An
  oblique wall under a gable whose ridge crossing differs between its faces
  would get a non-planar top strip; not exercised.
- End faces: if a height break fell strictly between a wall end's outer and
  inner top heights, the end face triangulation would leave a T-junction;
  impossible for gable ends and eave walls with valid openings, not
  exercised.
- Slabs without holes; stairs placeholders; rooms are floor markers.
- Constraints recorded, not solved. Materials are colours.
- Undo is snapshot-based (fine at editor scale).
- Inspector-driven editing only; no viewport gizmos; orthographic presets do
  not rotate (by design).
- Browser WebGL is SwiftShader; the pixel check is coarse.

## 10. Architectural compromises

- The specified frame (x right, y up, z into the building) is left-handed;
  it is kept exactly and the viewer mirrors z. All geometry math and tests
  live in the model frame.
- Roof pitch is the semantic driver (editable), ridge height derived — the
  opposite of the reference, which measured pitch as a consequence of datums.
- Fills are `structural: false` for the overlap test; they are checked
  separately for closure and containment.
- The harness branch name carries a suffix the brief did not have.

## 11. Recommended next bounded engineering step

Explicit wall-junction semantics in the model and DSL (`createJunction` /
BUTT ownership, T-junctions, shared walls) with validation that every corner
is owned exactly once and a storey-ring closure check, plus a wall-overlap
validation error — so that an analyzer can describe walls independently and
BuildApp guarantees exactly-once corner material instead of relying on
hand-trimmed extents.

---

`PASS_STAGE_BUILDAPP_00_BUILDWORLD_SEMANTIC_DSL`
