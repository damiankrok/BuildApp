# N9-00 — validation gap matrix: what each check verifies, and where a wrong building still passes

Base `0d03d60` (solver 2.17.0, model 1.7.0, reader 1.5.0). Paths are under `/home/user/BuildApp/`.

**Classification:**
- **CV** = CODE_VERIFIED: the line was read.
- **RV** = REPLAY_VERIFIED: offline replay, `research/analyzer-n9-00/coverage-probe.ts` over the 8 sealed houses.
- **RO** = REPORT_ONLY.
- **H** = HYPOTHESIS.

## 1. The formal verdict and its only three inputs

`modelCompleteness()` (`packages/reconstruction/src/v2/body-completeness.ts:248-261`) **CV**:

```
partial = missingBodies.length > 0 || blocking.length > 0 || input.modelRefusals > 0
open    = unresolvedAreas.length > 0 || walls.length > 0 || degrading.length > 0
verdict = partial ? 'PARTIAL' : open ? 'COMPLETE_WITH_OPEN_QUESTIONS' : 'COMPLETE'
```

It is called once (`v2/reconstruct-v2.ts:2700`) with **CV**:
- `bodyCompleteness` (bodies vs. the analyzer's *own* accepted decomposition);
- `layout.gate.reasons`;
- `previewFailures.length` (commands the model refused and the fitter could not reconcile).

The basis is printed in the result itself: `basis: 'ACCEPTED_DECOMPOSITION'`, `why: 'the accepted decomposition is 100% represented (its own built regions only)'` (`body-completeness.ts:226-238,271-277`) **CV**, **RV**, 8/8 houses.

**COMPLETE / COMPLETE_WITH_OPEN_QUESTIONS is completeness of the analyzer's own reading. It is not fidelity to ARCHON.**

The following never enter the verdict:
- the elevations (`viewAudit`, `crossViewResiduals`, `facadeAlignment`);
- the openings;
- slab voids;
- rooms and passages;
- double roofs;
- the closure audit;
- the evidence ledger;
- the feature quality levels.

A grep for `viewAudit|crossViewResiduals|facadeAlignment` over `packages/analysis-service/src` returns nothing **CV**: they are returned, not consumed.

## 2. Check-by-check

| check | file:line | verifies | compared against | effect on the verdict | blind spots |
|---|---|---|---|---|---|
| model validation | `packages/model/src/validate.ts:37-52` | Schema, references, polygon simplicity, holes inside their host, opening-in-host placement, roof-opening containment, stair layout, topology. **CV** | The model itself | An ERROR refuses the command. If it survives the fitter, the verdict is PARTIAL. **CV** | No room↔room, room↔wall, slab↔plan, roof↔roof or plane↔plane check. Never looks at a drawing. **CV** |
| `WALLS_OVERLAP` | `packages/model/src/topology.ts:494-533` | Two walls whose resolved quads share > 1e-6 m² over intersecting heights **CV** | The model | A WALLS_OVERLAP-only refusal is *reconciled* by moving walls (`packages/reconstruction/src/candidate.ts:899`). It becomes the warning `PREVIEW_WITH_ADJUSTMENTS`, not PARTIAL. **CV** | Walls only. Says nothing about where walls should be. |
| compiler diagnostics ("geometry ok") | `packages/geometry/src/compile.ts:148-508`; `apps/web/src/components/StatusBar.tsx:9-10,31-32` | `errors === 0 && warnings === 0` over compile diagnostics (triangulation, roof-opening cut, opening above wall top, wall consumed…) **CV** | The model | None (UI only) **CV** | Roofs and planes are compiled independently, so a plate inside another is silent. A slab is compiled with whatever holes it has. An opening never emitted is invisible. **CV** |
| closure audit | `packages/geometry/src/closure.ts:620-`; called in `packages/analysis-service/src/run.ts:476` | Pairwise GAP, INTERSECTION and COPLANAR_DUPLICATE for declared contacts **CV** | The model | LIMITING warning `EXTERIOR_JOINTS` only **CV** | A plate wholly inside another roof's air volume shares no solid volume, so it is not an INTERSECTION. **CV** (logic), **RO** (N8-03C: 15.60 m² in Sasanki under "geometry ok") |
| `bodyCompleteness` | `body-completeness.ts:92-219` | Each BUILT region of the accepted decomposition is covered ≥ 0.9 by a body's bounding rect. `unexplainedWalls`: plan bands ≥ 1 m outside every body rect grown by 0.6 m. **CV** | The analyzer's own regions; base-plan wall bands | MISSING → PARTIAL. OMITTED, UNRESOLVED and unexplained → open questions. **CV** | Bounding rects (an L is its box). Base storey only. Every wall inside or near a body is "explained", so no interior or room check. Regions not classed BUILT are never weighed. **CV** |
| layout gate | `packages/reconstruction/src/layout-gate.ts:104-196` | Mass overlap, published footprint area (6-20 % degrading, > 20 % blocking), roof kind **CV** | Published area, plan chains | BLOCKING → PARTIAL, DEGRADING → open questions **CV** | Massing only |
| structural projection audit | `packages/reconstruction/src/structural-audit.ts:125-230` | Massing silhouette vs registered elevations: off > 0.6 m DEGRADING, > 2.4 m BLOCKING **CV** | Registered elevation silhouettes | As the gate | **No registered elevation → `STRUCTURE_NOT_PROJECTED`, severity NOTED** (`:172-179`). Shape not checked → `STRUCTURE_SHAPE_NOT_CHECKED` NOTED (`:186-197`). NOTED never reaches the verdict. **CV** |
| `viewAudit` | `v2/view-audit.ts:63-134` | One record per elevation and perspective: REGISTERED, OPENINGS_ONLY, POSITIONS_ONLY, NOT_REGISTERED, DUPLICATE, PERSPECTIVE_*; `lost` lists what an unregistered view costs **CV** | Its own registration decisions | None **CV** | Says what was lost, never lowers anything |
| `verifyAgainstViews` | `v2/verify.ts:42-114,179-256` | Sill and head of model openings, main roof edge, band top, silhouette width, on silhouette-REGISTERED views **CV** | Registered elevation rasters | LIMITING warning `RESIDUALS_OUTSIDE_TOLERANCE` only (`packages/analysis-service/src/warnings.ts:136`) **CV** | Runs on the pre-emission building, so a dropped opening is still "checked". MODEL→VIEW only: an opening in the view but absent from the model is never measured. `mainRoof` only. **CV** |
| `crossViewResiduals` | `v2/cross-view.ts:66-104` | Verdict per view: AGREES / MIXED / DISAGREES / UNCHECKED **CV** | `verify.ts` residuals | None (step log) **CV** | Lists REGISTERED views only. OPENINGS_ONLY, POSITIONS_ONLY and NOT_REGISTERED views are absent, not even UNCHECKED. **CV** **RV**: Goździkowce and Cieszynianka have an empty list. |
| `alignFacades` | `v2/facade-alignment.ts:112-230` | Plan openings vs elevation readings: CONFIRMED_MATCH / CONFLICT / NOT_OBSERVED / MISSING_IN_MODEL / UNREGISTERED_VIEW **CV** | Registered elevations (silhouette, wall band, same sheet) | None. Only sill and head corrections are applied (`reconstruct-v2.ts:2531`); MISSING_IN_MODEL is "reported, not built". **CV** | Readings are located *by the plan interval*, so a CONFIRMED_MATCH is not independent of the plan. Exterior only, wrong storey not detected. **CV** |
| feature quality L0/L1/L2 | `v2/quality.ts:50-57` | Provenance plus count of independent assets **CV** | Provenance metadata | None | Never measures whether a feature is right |
| evidence ledger | `v2/ledger.ts:76-87` | Every evidence id has exactly one disposition **CV** | Bookkeeping | LIMITING warning `INVARIANT_VIOLATIONS` **CV** | `UNRESOLVED` or `REJECTED_WITH_REASON` satisfies it; correctness is not checked |

## 3. Replay: the verdict next to what the views say (8 sealed houses, solver 2.17.0)

**RV**. Source: `source-coverage-8.json`.

| house | verdict | elevations FULL / PARTIAL / UNREGISTERED | crossView per registered view | facade alignment (match / conflict / not observed / view not registered) |
|---|---|---|---|---|
| a01 | COMPLETE_WITH_OPEN_QUESTIONS (STOREY_COVERAGE_DISAGREES) | 1 / 3 / 0 | RIGHT DISAGREES | 7 / 4 / 2 / 0 |
| gozd | COMPLETE_WITH_OPEN_QUESTIONS (STOREY_COVERAGE_DISAGREES) | 0 / 0 / **4** | *(none listed)* | 0 / 0 / 0 / **14** |
| marcowki | COMPLETE_WITH_OPEN_QUESTIONS (STOREY_COVERAGE_DISAGREES) | 4 / 0 / 0 | AGREES, MIXED×3 | 1 / 6 / 4 / 0 |
| ciesz | COMPLETE_WITH_OPEN_QUESTIONS (ROOF_EVIDENCE_DISAGREES) | 0 / 3 / 1 | *(none listed)* | 0 / 6 / 1 / 4 |
| rary | **COMPLETE** | 4 / 0 / 0 | **DISAGREES ×4** | 0 / 5 / 7 / 0 |
| trytomach | COMPLETE_WITH_OPEN_QUESTIONS (ROOF_EVIDENCE_DISAGREES) | 1 / 1 / 2 | FRONT DISAGREES | 1 / 1 / 4 / 7 |
| arganiach | COMPLETE_WITH_OPEN_QUESTIONS (ROOF_EVIDENCE_DISAGREES) | 2 / 0 / 2 | DISAGREES ×2 | 1 / 3 / 2 / 7 |
| sasankach3 | COMPLETE_WITH_OPEN_QUESTIONS (STOREY_COVERAGE_DISAGREES) | 2 / 0 / 2 | DISAGREES ×2 | 1 / 4 / 7 / 3 |

**Totals:**
- Elevations: 32. FULL 14, PARTIAL 7, UNREGISTERED 11.
- Registered-view cross checks: DISAGREES 10, MIXED 3, AGREES 1.
- Facade-alignment CONFIRMED_MATCH: 11 of 102 classified plan openings.
- **No house is PARTIAL.** Rarytasy is **COMPLETE** with all four registered elevations DISAGREES.

## 4. The six failure kinds

| failure | lowers the formal verdict? | code path | where it shows instead |
|---|---|---|---|
| (a) elevation unregistered or unchecked | **No** | NOTED in `structural-audit.ts:172-197`; absent from `crossViewResiduals`; UNREGISTERED_VIEW in `alignFacades` without effect **CV** | `viewAudit.lost`, not consumed. Only exception: a *registered* silhouette > 0.6 m off → DEGRADING. |
| (b) opening in plan or elevation missing in the model | **No** | Elevation-only: MISSING_IN_MODEL, not built (`facade-alignment.ts:200-202`). Plan opening refused: DROPPED in `fitOpeningsToHosts` (`candidate.ts:398-420`), not a refusal. Interior door gap < 0.5 m or not fitting the run: **silently skipped** (`v2/emit.ts:592`, no record). **CV** | LIMITING warning `OPENINGS_NOT_BUILT` for dropped plan openings only |
| (c) floor void missing from the slab | **No** | Voids are read only from a flat achromatic fill (`slab-void.ts`). A void `voidOnSlab` cannot place is dropped silently (`emit.ts:366-372`, `flatMap → []`). Validator and compiler accept any hole set. **CV** | Nothing (before N8-03D1 the concept did not exist; **RO** N8-03D1) |
| (d) roof plate inside another roof | **No** | No roof↔roof or plane↔plane check in validator or compiler; the closure audit only sees shared solid volume **CV** | Nothing (**RO** N8-03C: 15.60 m² Sasanki, 11.45 m² Rarytasy under "geometry ok") |
| (e) a drawn room merged into another region | **No** | Rooms are not an input of `bodyCompleteness`; a body covering two regions is JOINED = represented; interior bands are always "explained" (`body-completeness.ts:136-137,163`) **CV** | Room-label `unresolved` entries only |
| (f) wrong passage (door where the plan has a wall, or the reverse) | **No** | No passage↔plan check anywhere; exterior facades only in `verify`/`alignFacades`; skipped interior doors leave a wall with no record (`emit.ts:592`) **CV** | Nothing |

## 5. Consequences

- `TECHNICAL_PASS` (valid model, 0 WALLS_OVERLAP, 0 compiler errors) is what the pipeline actually proves today. It is a necessary condition, not evidence of fidelity.
- `SOURCE_FIDELITY_PASS` does not exist in the code. There is no relation SOURCE→MODEL or MODEL→SOURCE whose failure lowers a verdict.
- `SOURCE_UNCHECKED` is the true state of:
  - every unregistered elevation (11/32);
  - every section as a view (8/8; the section gives datums only);
  - every interior room and passage;
  - every slab outline.

  The output never says so in its verdict.
