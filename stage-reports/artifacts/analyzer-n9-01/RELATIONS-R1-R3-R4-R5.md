# N9-01: relations R1, R3, R4, R5 — what they measure, examples of evidence and of refusal

Code: `packages/analysis-service/src/assessment/`. All four run in `runAnalysis` (`run.ts`, VERIFYING stage) on the **delivered** model and its compiled scene, after replay and the joint audit. They write nothing into the model.

Statuses: **PASS**, **CONFLICT**, **UNCHECKED**. A relation is CONFLICT if any item conflicts, PASS only if every item passes, otherwise UNCHECKED. UNCHECKED is never shown as PASS. A CONFLICT never withdraws the model (`assessment.previewAvailable: true`).

## R1 — a roof inside a roof (MODEL_INTERNAL, `roof-layers.ts`)

**Measure:**
- Vertical rays are cast on a 0.1 m plan grid through every compiled `ROOF` or `ROOF_PLANE` solid (trim excluded).
- Each plate the ray meets gives a top and an underside.

**A cell is a CONFLICT only when all of these hold:**
- The lower plate is wholly under the upper one (gap > 0.05 m).
- The cell lies inside the walled storey the upper plate covers (its slabs and exterior wall bands), inset by 0.2 m.
- The lower plate's top stands above that storey's floor.
- The same holds 0.2 m around the cell, so that a shared eave, crease, valley or step is not counted.

**Legal and undecidable cases:**
- A double layer outside the walls is LAYERED and legal: a porch, a garage under an overhang, a lower wing.
- A double layer that cannot be placed is UNCHECKED: inside the walls but under the floor, or over a storey with no slab and no wall.

**Evidence (production code on model files, `r1-history.json`, board `boards/roof/roof-layers.png`):**

| model | status | pair | raw overlap (every double cell) | beyond tolerance |
|---|---|---|---|---|
| Sasanki 3, solver 2.14.0 (before N8-03C) | **CONFLICT** | roof-attached-0-plane-low / roof-main | 7.80 m² | 4.35 m² |
| | | roof-attached-0-plane-high / roof-main | 7.80 m² | 4.06 m² |
| Rarytasy 5, solver 2.14.0 | **CONFLICT** | …-plane-low / roof-main | 5.95 m² | 2.53 m² |
| | | …-plane-high / roof-main | 5.50 m² | 1.35 m² |
| Sasanki 3 today (2.17.0) | PASS | — | 0 | 0 |
| Rarytasy 5 today | PASS | — | 0 | 0 |

- The raw overlap reproduces the N8-03C probe exactly: 15.60 m² and 11.45 m².
- The smaller "beyond tolerance" area is what remains once a 0.2 m band along every plate edge is not weighed.

**Refusals on synthetic negatives (`assessment-n9-01.test.ts`):**
- The demo house's garage roof under the main overhang: PASS. The 2.4 m² near-edge strip is counted, not weighed.
- A 6 m porch under a 1.2 m overhang outside the walls: LAYERED, PASS.
- A lower wing roof beside the upper storey: no conflict.

## R3 — model walls stand on drawn walls (MODEL→SOURCE, `plan-ink.ts`)

**Measure:**
- Each wall of a storey with a registered plan is sampled every max(0.1 m, 2 px).
- At each station a profile across the band ±tolerance is read on the original raster. The ink definition is the plan reader's (`adaptiveInkMask(inkChannel)`).
- The tolerance is max(3 px, half the storey's typical exterior thickness). Typical thickness is the median of walls longer than they are thick, so returns and stubs do not widen it.

**Station classes:**
- BAND: a run of at least half the wall's drawn thickness.
- THIN: ink, but thinner strokes only.
- BLANK: no ink at all.
- EXCLUDED: inside a modelled opening.
- A run of BAND stations longer than a crossing wall's width is the drawn wall **in line**. Shorter runs are crossings.

**Outcomes:**
- **CONFLICT `WALL_ON_BLANK_PAPER`:** a stretch reaching a wall end, or the whole wall, with no ink over more than 2 wall thicknesses + 2·tolerance.
- **`DRAWN_GAP_NOT_MODELLED`** (PASS, named): a gap with the drawn wall in line on both sides. This is an opening question, not a wall conflict.
- **UNCHECKED:**
  - `THIN_LINES_ONLY`: glazing, a slab edge or a sheet line.
  - `NOTHING_TO_READ`: a stub, or all openings.
  - `REGISTRATION_NOT_CORROBORATED`: fewer than half of the storey's exterior stations find a drawn wall. This happens with a wrong scale, a mirror or a wrong storey; it is never CONFLICT.

**Evidence:**
- Synthetic (`synthetic-r3-r4-conflicts.png`): the house's right wall drawn open along the garage gives `g-right` **CONFLICT** with 4+ m of blank paper. It is the only conflicting wall.
- 8 houses: 0 CONFLICT.
  - All registered storeys are corroborated; exterior support is 0.68–1.00. The lowest is the Jarzmianki attic, where one knee wall is drawn thin: `THIN_LINES_ONLY`.
  - Drawn gaps not modelled: 3 on Marcówki storey 1, 2 on Arganiach storey 1.
  - Boards: `boards/<house>/plan-storey-*.png` (green = in-line wall, cyan = crossing, orange = thin, red = blank, grey = modelled opening).

**Refusals on synthetic negatives:**
- Watermark, dimension and furniture lines on a correct drawing: PASS.
- A door gap the model lacks: PASS with the gap named.
- A glazed wall drawn thin: UNCHECKED.
- A frame shifted 1.5 m: every wall and the outline UNCHECKED, 0 CONFLICT.

**Not detected (stated):**
- Two walls doubled inside one drawn band (N8 class #5).
- Walls are compared with the sheet they were read from. R3 sees what emission did, not what the reading missed.

## R4 — each storey's drawn walls lie within the modelled storey (SOURCE→MODEL, `plan-ink.ts`)

**Measure:**
- Thick ink is the ink mask opened by half the reader's band thickness (`wallPx`). Walls survive it; text, dimension lines, furniture and hatching do not.
- The drawn building is the thick-ink components that reach into the modelled storey. The storey is its slabs, wall bands, balconies, terraces, chimneys and members.
- Any part of it lying more than one exterior wall outside the footprint is measured by chamfer distance.

**Outcomes:**
- **CONFLICT `DRAWN_WALLS_BEYOND_STOREY`:** a piece more than 2 exterior walls + tolerance clear, with ≥ 4 wall thicknesses of band.
- **A registered storey sheet with no modelled walls** is held against the storey below:
  - **CONFLICT `STOREY_DRAWN_NOT_MODELLED`** if its band closes an outline: every side of its extent drawn along ≥ half its length, ≥ 4 walls across.
  - UNCHECKED otherwise.
- **UNCHECKED** when the storey's registration is not corroborated (shared with R3), or no plan of a modelled storey was registered.

**Evidence:**
- Synthetic:
  - A 4 m wing drawn behind the garage gives **CONFLICT**, max distance 3–4.5 m.
  - An upper plan drawn while the model has no upper walls gives **CONFLICT `STOREY_DRAWN_NOT_MODELLED`**.
  - A blank upper sheet gives UNCHECKED.
- 8 houses: all PASS.
  - Drawn ink inside the tolerance band is 97–100 %.
  - The largest drawn excursion is 0.72 m, on Sasanki storey 1 (0.32 m²), below the 2-wall threshold.

**Not detected (stated):**
- A wall the sheet does not draw thick.
- Ink not connected to the storey (a detached garage, a garden wall).

## R5 — registered elevations (SOURCE↔MODEL, `elevations.ts`)

**Measure:** the residuals `verifyAgainstViews` already computes, re-classified:
- OBSERVED_WITHIN.
- OBSERVED_OUTSIDE.
- NOT_OBSERVED: "no image edge within reach". This used to count as a disagreement in the cross-view summary.
- NOT_EMITTED: a check on an opening the delivered model does not contain.

**Outcomes:**
- **CONFLICT `ELEVATION_DISAGREES`:** ≥ 2 features outside tolerance and ≥ 1/3 of the observed checks (the cross-view summary's own DISAGREES share; not re-tuned).
- **PASS `ELEVATION_AGREES_MODEL_ANCHORED`:** every observed check within tolerance. The item says the checks search near the model's prediction, so the agreement is not independent.
- **UNCHECKED:**
  - `DISAGREEMENT_NOT_STABLE`: one feature, or less than a third.
  - `NOTHING_OBSERVED`.
  - `VIEW_PARTLY_REGISTERED`: openings or positions only.
  - `VIEW_NOT_REGISTERED`.
- Facade alignment is attached as evidence only. Its readings are plan-located.

**Evidence (8 houses):**
- **Rarytasy 5:** COMPLETE before, now **3 elevation conflicts**:
  - LEFT: a sill −0.68 m and the silhouette width.
  - FRONT: the roof edge and opening-0-front-4-0.
  - REAR: the roof edge and opening-0-rear-2-3.
  - RIGHT: model-anchored PASS on 2 checks.
  - N9-00 counted these as 4/4 DISAGREES. One of the four disagreed only through NOT_OBSERVED rows, which are no longer counted as disagreement.
- **Trytomach:** FRONT conflict (roof edge and silhouette).
- **Sasanki 3:** 2 conflicts (roof edge and balcony fronts; rear openings 10-0/10-1).
- **Marcówki:** 3 views with outliers below the stable rule, 1 model-anchored PASS.
- **Goździkowce:** 4/4 views not registered, so UNCHECKED, never PASS.

**Not done here:** no new registration (that is N9-02); no MISSING_IN_MODEL decision (that is R6).
