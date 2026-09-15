# BuildWorld

The semantic 3D building editor/viewer: `packages/editor` (framework-agnostic
store) and `apps/web` (React + Three.js). Restrained dark technical UI.

```
+------------------------------------------------------+
| toolbar: views · undo/redo · save/load · model · roofs · storey · grid/axes |
+----------------+-------------------------+-----------+
| scene tree     |     3D viewport         | inspector |
+----------------+-------------------------+-----------+
| status: model · schema · units/frame · counts · tris · diagnostics · selection · revision |
+------------------------------------------------------+
```

## The rule

```
inspector / tool  →  command  →  CanonicalBuildingModel  →  compileBuilding  →  viewport
```

`EditorStore` is the only thing the UI talks to. `setProperty(id, key, value)`
becomes a `setProperty` command; the session applies and re-validates it; the
store recompiles the model; listeners are notified. `store.trace` records the
order (`command`, `model-updated`, `geometry-compiled`, `listeners-notified`)
and a test asserts it. The inspector never touches Three.js geometry; the
viewport never builds building geometry (architecture tests grep for both).

## Store (`packages/editor/src/store.ts`)

- `execute(command)`, `setProperty`, `undo`, `redo`, `replaceModel`
- `saveJson()` → canonical JSON; `loadJson(text)` → validated load or an
  error in `lastError` with nothing changed
- selection: `select(id)`; visibility: `hide/show/toggleHidden(id)`,
  `isolate(id)` (an object and its family — a wall with its openings and
  fills, including openings that pass through it as a leaf; a roof with its
  roof openings and rooflights; a balcony with its railings; a level with
  everything on it), `isolateLevel(levelId)`, `setRoofsVisible`,
  `resetVisibility`
- `isMeshVisible(mesh)` resolves all of that per compiled mesh; hiding a wall
  hides its reveals and fills through `hostWallId`, hiding a roof (or the
  roof toggle) hides its reveals and rooflight units through `hostRoofId`
- `sceneTree()` — Building → Levels → Walls (→ Openings → Window/Door),
  Topology (→ Wall rings → their corner junctions, and loose junctions),
  Rooms, Slabs, Roofs (→ Roof openings → Rooflight), Balconies (→ hosted
  railings), Railings, Chimneys, Stairs; then Materials, Constraints,
  Evidence sources. Junctions and rings
  are persisted semantic objects with no geometry of their own; they sit in
  one collapsible group per level so the wall tree stays readable
- `describe(id)` — kind, host wall, opening, level, a generic `host`
  (`{ id, kind, relation }`: the wall an opening cuts through, the opening a
  fill fills, the roof a roof opening cuts, the roof opening a rooflight
  fills, the balcony a railing stands on, the level a wall stands on — read
  from the generic reference fields, never from a project name), the
  object's `evidenceSources` (its `evidence.sourceIds` resolved to the
  model's `EvidenceSource` labels and kinds), editable `PropertySpec`s, and
  for walls, junctions and rings a `topology` description: a wall's
  physical extent (outer and inner face cuts) and the junctions at its ends
  with its role (owner / trimmed / host); a junction's resolution (point,
  participants, cuts, contact span, resolved yes/no); a ring's walls and
  whether every corner resolved. Derived from the records exactly as the
  compiler derives them, never stored
- `editableProperties(kind)` — wall height/thickness/base offset/kind;
  opening offset/sill/width/height; window frame and glazing parameters and
  divisions; door open angle, hinge side, swing, leaf and frame; roof pitch,
  eave offset, overhang, thickness, ridge axis; slab, balcony, railing,
  chimney, level, room, building fields

## Viewport (`apps/web/src/viewport`, `components/Viewport.tsx`)

- `scene-adapter.ts` turns `CompiledMesh` lists into `THREE.Mesh` objects
  (flat shading, per-part materials, model material colours on structural
  parts, edge lines on walls/roofs/slabs) and keeps `Map<THREE.Object3D, objectId>`.
  Picking raycasts the visible meshes and resolves the hit through that map —
  no name parsing. The model frame is mirrored (`z → −z`, `b/c` swapped).
- Cameras: a perspective camera with orbit/pan/zoom (OrbitControls) and an
  orthographic camera for Front / Rear / Left / Right / Top presets (pan/zoom
  only). Presets re-frame on the whole compiled building. Front looks from
  outside the front facade with model `+x` on the right; Top has the front at
  the bottom of the screen.
- Grid (at y = −0.35, under the ground slab) and model axes (x red, y green,
  z blue = into the building) toggle from the toolbar.
- `window.__buildworld` exposes the store and the visible mesh/object lists
  for browser verification.

## Panels

- **Toolbar**: view presets, Undo/Redo (also Ctrl+Z / Ctrl+Y), Save JSON
  (downloads `building-model.json`), Load JSON, a **model** select — *Demo
  house* / *Dom w marcówkach (GE)* — that replaces the model in the same
  store with the chosen factory's `CanonicalBuildingModel` (a loaded file
  shows as *(file)*), Reset (rebuilds the demo), Hide/Show roofs, storey
  isolation select, Show all, Grid, Axes. The reference enters the app
  exactly as the demo does: `createMarcowkiReferenceBuilding()` handed to
  `replaceModel`; the viewport, adapter, store and inspector never import
  the reference package (architecture test).
- **Scene tree**: hierarchy with kind tags, click to select, eye toggles
  hide/show (hidden objects struck through), carets collapse groups.
- **Inspector**: kind, id, level, the host / parent as a link that selects
  it (a rooflight → its roof opening → its roof), host wall, opening, mesh
  count; Hide/Show, Isolate, Delete (a cascading `removeFeature`); editable
  properties (commit on Enter/blur; a corner junction's `owner` is a select
  of its two walls, `tolerance` a number; roof opening rectangles and
  rooflight frame/glass are editable); a Topology section for walls,
  junctions and rings (read-only, re-derived after every edit — thicken the
  front wall and the side walls' physical starts move); an Evidence section
  with the status tag, the cited evidence sources by label and kind, the
  free-text source, the locator, interpretation, note and per-property
  statuses; raw object JSON; the last command error when one was rejected.
- **Status bar**: model name/id, schema version, units/frame, object counts,
  triangle count, visible/total meshes, geometry diagnostics, selection,
  revision.

## Running

```
npm run dev       # http://localhost:5173
npm run build     # apps/web/dist
npm run preview   # http://localhost:4173 (production build)
npm run e2e       # Playwright against the production build
```

## Browser verification (`apps/web/e2e/buildworld.spec.ts`)

Seven Playwright checks against `vite preview` of the production build, in
Chromium with SwiftShader WebGL: the demo renders with real pixels drawn;
scene-tree selection drives the inspector and an inspector edit changes the
model and regenerates geometry (an invalid edit is refused, undo/redo work);
door open angle and roof pitch edit; every camera preset, roof toggle, storey
isolation, hide/show, isolate and grid/axes toggles; viewport click picking
selects a semantic object and clicking sky clears it; Save downloads
canonical JSON and Load restores it (a broken file is refused); wall topology
is visible (rings and corner junctions in the tree, physical extents in the
inspector), re-resolves after a thickness edit, and a lone ring-wall move is
refused by name. Screenshots are written to `stage-reports/artifacts/`.

`apps/web/e2e/marcowki.spec.ts` adds five checks on the reference model
through the same UI: the model select replaces the demo with *Dom w
marcówkach (GE)* in the same store (35 walls, 5 roof openings, geometry ok,
revision 1) and back; the six preset views are screenshotted
(`marcowki-01-perspective` … `marcowki-06-top`); the roof toggle hides the
roof family (roofs, reveals, rooflight units) and leaves the chimneys, with
attic-plan and ground-storey-interior screenshots; a selected return shows
kind, id, thickness 0.61, its level as host, a `SOURCE_*` status, the cited
drawings and the locator (`marcowki-10-selected-return-evidence`), the
rooflight → roof opening → roof host links work, and a roof pitch edit on
the reference goes through the command path and undoes; Save writes bytes
equal to the frozen fixture `packages/model/test/fixtures/marcowki-ge-1.2.0.json`
and Load restores the model with the same triangle count.
