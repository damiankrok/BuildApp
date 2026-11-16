# CAPABILITY_GAPS after v3.54.3 (2026-11-16)

What the consultant reported on a built model and the analyzer could not apply, counted over the 18 houses of this stage (10 DEV, 8 CONFIRM). A row is a correction family; a count is houses on which at least one such finding was filed as a proposal. Findings are the consultant's; only those marked "checked" were compared with the source by the operator.

## Families with a consumer

| Family | Consumer | Exercised live | Applied | Limits found |
|---|---|---|---|---|
| READ_DIMENSION / BIND_DIMENSION | `consulted-spans.ts` → `solveFrameMetric` (`consultedScale`) → frame chains | 18 houses (10 of them from the v3.54.2 recording) | scale settled or refusal → model on 5 (Aksamitki, sp318422, Supertunie, 22192sl; Kukliki verified unchanged) | a plan that does not compose at the printed scale stays the earlier model, now marked CONTRADICTED (Madera, Gracja) |
| CLASSIFY_BOUNDARY | `glazedEndClosure` | 1 house (Supertunie) | 1 | the outline stands half a wall inside on the other axis; no activation on CONFIRM8 |
| ROOF_FEATURE: gable / shed / flat dormer on a slope | `applyRoofFeatures` | 4 houses (Aksamitki, Majeranek, Gracja, 22192sl) | 4 dormers on 3 houses | see below |

## Limits of the roof-feature consumer (each seen on a house)

| Limit | House | Code | What it would take |
|---|---|---|---|
| A wall dormer (its wall continues the facade, a balcony before it) is built as a dormer set on the slope | Aksamitki, Majeranek, Gracja | built; review `ACCEPTABLE_APPROXIMATION` | a wall-dormer primitive: the facade wall rises through the eaves |
| A dormer whose own eaves sit low on the slope | Majeranek (rear) | `LAYOUT_REFUSED` (the dormer's eave does not clear the host roof at its front) | the same primitive |
| A dormer as wide as the whole side | 22192sl (rear shed dormer) | `OUT_OF_RANGE` | a full-width shed dormer is a change of the roof's form on that side |
| No pitched main roof to stand on | 22192sl | `NO_PITCHED_HOST` | ROOF_FORM first |
| Hip or multi-plane hosts | not met live | `REPRESENTATION_LIMIT` (unit test) | host planes for hips |
| **A feature is built on a model the same look reports as mirrored, missing a body, or at a contradicted scale** | Majeranek (mirrored), Gracja (no garage wing, scale contradicted) | none — it was applied | order the queue: identity, handedness, scale and bodies before roof features; hold features while one of those is open |

## Families without a consumer (named in the result, model unchanged)

| Family | Houses | Examples |
|---|---|---|
| ROOF_FORM | 5 (sp318422, Madera, 22192sl, Zagliki, Haga; wing roofs on Majeranek also as an observation) | flat roofs where the drawings show gables; one roof where the drawings show a main roof and a cross gable |
| ROOF_FEATURE kind CROSS_GABLE / CANOPY | 3 (sp318422, Madera, Lille with two) | cross gable over the entrance and garage; gables over an open porch and a terrace |
| OPENING | 3 (Supertunie, Haga, Gracja as observations) | glazing of a gable to the apex; windows of a side that differ in count |
| ASSIGN_VIEW / handedness | 2 (Torenie as a proposal; Majeranek as an observation) | the model reads as rotated 180° or mirrored against the elevations |
| MISSING_ELEMENT (a body) | 1 (Gracja) | the garage wing |
| OUTLINE_REGION | 1 (Majeranek) | the projecting kitchen block's bay |

## Gaps in what the result says of itself

| Gap | House | Effect |
|---|---|---|
| `outlineOf` compares the plan's envelope with the printed dimension, not what was built | 22192sl: outline `MATCHES` while the built model lacks the garage block (13.25 m of 19.91 m) | a falsely favourable status; the comparison must use the built footprint |
| Pictures of other designs on a publisher's page can be classified as this house's elevations | sp318422 (teaser thumbnails of other plans among pictures 2–5) | a feature could be proposed from another house's picture; nothing was built from one in this stage |
| The interior is never looked at | all | axis `interior: NOT_CHECKED` always |

## Order suggested by these counts

1. Queue order and holds (no feature on a model with an open identity, handedness, body or scale finding) — it would have withheld both dormers the scorer rejected.
2. Built footprint in the outline status.
3. ROOF_FORM and CROSS_GABLE (5 and 3 houses).
4. Elevation registration, then OPENING.
5. Handedness / ASSIGN_VIEW.
