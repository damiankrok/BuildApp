# N9-00 — target architecture (design; nothing implemented)

Classification:
- **H** = HYPOTHESIS: a design claim, not yet built or measured.
- **CV** / **RV** / **RO**: CODE_VERIFIED, REPLAY_VERIFIED and REPORT_ONLY facts the design rests on.

## 0. The diagnosis in one paragraph

BuildPlan reads the drawings in many places, and it *already computes* several comparisons with the source:
- `verifyAgainstViews` and `crossViewResiduals`;
- `alignFacades`, with a plan-free scan of the elevations;
- `viewAudit.lost`;
- the closure audit;
- compiler diagnostics.

It never lets any of them decide the outcome (CV: `validation-gap-matrix.md` §1). The verdict reads only the model against the analyzer's own decomposition, the layout gate and command refusals. So "BuildPlan does not check and reject wrong architecture" is literally true. The checks exist, but they sit outside the decision path, and the relations that would catch the N8 classes do not exist at all:
- roof layers;
- wall over blank paper;
- storey outline vs drawn outer walls;
- section slab extents;
- room numbers vs regions.

Better pixel reading will not change this. The verdict has to be built on **relations between the model and the source**, each with a declared coverage.

## 1. Three outcomes instead of one

| outcome | meaning | computed from |
|---|---|---|
| `TECHNICAL_PASS` | The model is valid, compiles with 0 ERROR diagnostics, the closure has no exterior ERROR, and the replay is byte-identical | What exists today: validator, compiler, closure, replay. Today `run.ts` ignores `scene.diagnostics` (CV); it must not. |
| `SOURCE_FIDELITY` per relation | PASS / FAIL / UNCHECKED, each with a measured residual and a tolerance from the frame's own uncertainty | §2 relations |
| `SOURCE_UNCHECKED` budget | What could not be compared and why: unregistered elevations, a section not registered, storeys without a frame, unread room numbers | `viewAudit`, registrations, interior readings: all already computed (CV) |

The headline the owner sees becomes a statement like:
- "technically valid; 9 of 14 relations pass, 3 fail (named), 2 unchecked (named)";
- not "COMPLETE".

A useful partial model stays deliverable: a fidelity FAIL never disables the collision validator or refuses the model. It is a stated property of the result.

## 2. The relation registry: SOURCE→MODEL and MODEL→SOURCE

A relation is a pure function `(source observation set, model, frames) → {status, residual, tolerance, items[]}`. It is computed after `compileBuilding`, on the **emitted model**: the thing the owner sees, not the solver's pre-emission `building` (CV: `verify.ts` runs before emission today).

The relations, grouped by cost:

| # | relation | direction | inputs (already available?) | N8/N7 classes it would have caught (H) | cost |
|---|---|---|---|---|---|
| R1 | single roof layer: a vertical ray meets ≤ 1 roof plate | MODEL internal | compiled meshes (yes) | #2 Sasanki and Rarytasy roof-in-roof | very low (N8-03C probe exists) |
| R2 | compiler ERROR diagnostics = 0 | MODEL internal | `scene.diagnostics` (yes, ignored today) | #1 Sasanki (4 × OPENING_ABOVE_WALL_TOP); the 005T owner scenes | very low |
| R3 | wall ink support: each modelled exterior or interior wall stretch has plan ink under it | MODEL→SOURCE | plan raster + storey frame (yes) | #6 open contact; #5 double party walls (thickness vs band); F-R1 posts vs wall; the phantom 0.57 m Marcówki piece | low |
| R4 | storey outline: the drawn outer-wall outline of each storey sheet vs the modelled storey footprint (area ratio, Hausdorff in m) | SOURCE↔MODEL | plan frames per storey (yes) | #3 Trytomach extent; #4 Arganiach scale (attic on 1 % of the building); #1 wing seam (outline step) | low |
| R5 | registered-elevation verdict: crossView DISAGREES or a silhouette step the model lacks is a FAIL; an unregistered view is UNCHECKED, not silence | SOURCE↔MODEL | `crossViewResiduals`, `viewAudit` (yes) | #8 Rarytasy glazing (COMPLETE with 4/4 DISAGREES today); #1; E-4 lost side views | very low (wiring) |
| R6 | elevation openings vs model openings, plan-free (MISSING_IN_MODEL, EXTRA_IN_MODEL, family/sill contradictions) | SOURCE↔MODEL | `alignFacades` + plan-free scan (yes, unconsumed) | #7 gate as a window; #8 | low (wiring + a rule for independence) |
| R7 | section cut: slab extents and storey levels along the section line vs the model at that line | SOURCE→MODEL | section frame (datums yes; **as a registered view no**) | #9 void; storey-level and attic errors | medium (needs section registration) |
| R8 | rooms: each upright room number read lies in a distinct SpaceRegion or is declared shared; each modelled door has a drawn gap and swing | SOURCE↔MODEL | interior readings (yes) | #10 | low for doors, medium for numbers (reading quality) |
| R9 | plan-fill legend: every large flat-filled plan region is classified (void, tiles, slope strip, stair) or named | SOURCE→MODEL | plan raster (yes) | #9 void | low-medium |
| R10 | expected-element registry: plan block + stack over the roof = chimney; tinted ring = rooflight; drawn track = sectional door | SOURCE→MODEL | observation graph + metrics (partly) | #11 chimney lost, #12 rooflights, #7 | medium |

## 3. Elevation registration with partial states (design)

Today registration is all-or-nothing per view: REGISTERED, or a weaker use, or NOT_REGISTERED. An unregistered view's checks disappear (CV: `crossViewResiduals` lists REGISTERED views only).

Proposed: per view, a registration record with **per-axis** status:

```
along:  FULL | ENDS_ONLY | NONE        (wall band, corners)
height: FULL | DATUM_ONLY | NONE       (ridge datum, ground line, eaves)
scale:  m/px ± uncertainty, source
```

Each relation in §2 declares which axes it needs (R5 silhouette needs along + height; opening positions need along only). An opening-position check can then run on Goździkowce's 4 views, which are unregistered today only for want of a ridge datum (RV, `source-coverage-8.json`). The view becomes UNCHECKED only for what it really cannot support.

## 4. Image → sketch: why it made things worse, and a contract that would not

### Measured (RO)

IU-02 §7.2, 5 DEV houses, solver unchanged:
- opening readings **36 → 21**;
- registered views **15 → 11** (→ 9 with the ground line);
- A01: 14 → 0 readings, 4 → 0 views.

IU-03A re-scored correct readings, DEV:
- RAW 31/36/15;
- CLEAN 20/21/10.

### Why (RO, IU-03A, mapped to code CV)

The cleaner **replaced** the image the readers were tuned on:
- White background (chroma < 40) is read as wall band by `scan.ts` `neutralBands`, so the wrong scale (0.0348 vs 0.0169 m/px).
- The ground line was erased, so registration through `frame.ts` ground fails (Cieszynianki ground 0.52 vs 0.01 m).
- Uniform light glass (luma ≈ 211) defeats the dark-glass reader (A01 14 → 0).
- The changed outline changes `buildingExtent`. The FGE outline's top was a chimney, taken as the ridge.

Each destructive edit removed a cue one reader depended on. Nothing in the contract said which reader needed which pixels.

### Parallel contract (design)

The original RGB is never replaced. Preprocessing produces **layers beside it**, all in source pixel coordinates:

```
SourceImageLayers {
  assetId; variantByteHash; sizePx
  rgb: original (immutable, the only input for any metric reading)
  layers: Array<{
    name: OUTLINE | OPENING | GLASS | GROUND_LINE | TERRAIN | EAVES | RIDGE | CHIMNEY | OCCLUDER | UNCERTAIN
    kind: MASK (bitmap, same size) | POLYLINES | BOXES
    data
    confidence per element
    provenance { method (deterministic name + version), parameters, inputLayers[] }
  }>
}
```

**Rules:**
1. **Readers keep reading the RGB.** A layer may only *restrict* where a reader looks (a mask of occluders, a ridge candidate) or *add a candidate* that is then verified on the RGB. It never replaces a pixel.
2. **Layers have their own semantics.** RIDGE ≠ top of OUTLINE; GROUND_LINE ≠ bottom of the mask; CHIMNEY is not roof (IU-03B §6).
3. **UNCERTAIN is a first-class layer.** Trees, cars and watermark text are marked, and a relation that crosses UNCERTAIN pixels reports UNCHECKED, not PASS.
4. **Every layer is versioned** and enters the cache key, like the reader and solver versions do today.
5. **A layer is adopted only by A/B on the relations of §2**, measured as correct readings, never as reading counts.

## 5. Independent truth

The corpus has no labelled truth. Every count in `source-coverage-8.json` is the analyzer about itself.
- The ARCHON description, the printed table, OCR and the model are not independent confirmations when they come from one observation (one printed number, read twice).
- What is independent: **human annotation of the drawings**, in source pixel coordinates, on a held-out set never used for tuning:
  - wall polylines per storey;
  - opening boxes per elevation;
  - room-number points;
  - slab-edge points on the section;
  - roof-plane outlines on the roof plan or elevations.
- The relations of §2 are then scored against the annotation (precision and recall per relation), not against the analyzer's own outputs.
- **Holdout availability:** `NOT_AVAILABLE`. No locally available control set outside the 8 frozen houses was found, and the owner's secret test house was not touched.

## 6. Layering (target)

```
SourcePackage ─► observations (graph, metrics, layers) ─► reading (frames, masses, interior, openings, roofs)
     │                                                       │
     │                                                       ▼
     │                                                   emitted model ─► compile ─► TECHNICAL_PASS
     │                                                       │
     └──────────────► relation registry (R1…R10) ◄───────────┘
                            │
                            ▼
              SOURCE_FIDELITY + SOURCE_UNCHECKED + named failures
                            │
                            ▼
              result / API / Android headline / web panel
```

The relation registry is the only new layer. It reads, it does not write the model, and it is where house-independent tests live: synthetic drawings in which one relation is violated by construction.
