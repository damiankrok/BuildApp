# 005N next recommendation

**NEXT: `OTHER_MEASURED_RESIDUAL` — the floor plan's scale from its printed dimensions (METRIC).**

005O is not self-started. This is one residual, chosen from the measured first bad decisions.

## Why this one

| evidence | first bad decision |
| --- | --- |
| **Blind round 10 #1, `dom-w-glogownikach`** (fresh, garage stratum) | **METRIC.** The right scale (2.629 cm/px) is found and corroborated on both axes. The recogniser misreads two printed dimensions: 541 → 501, 870 → 810. On their own lines the two misreads agree on a second scale (2.432 cm/px). No second printed dimension separates the two, so the resolver refuses with PLAN_RESOLUTION_INCONCLUSIVE (SOURCE_CONFLICT) |
| Blind round 9 #1, `dom-w-murajach` (now development) | **METRIC**, once 005N's wall-joint extent puts its garage back in the plan. Only 5 dimension labels are read on 79 dimension lines. No scale is supported by a reading independent of the page vote, so it fails METRIC_RESOLUTION_INCONCLUSIVE |
| Blind round 10 #2, `dom-w-akebiach` | EXTENT (the walled envelope stops short of two attached projections). This is one house, a different class |

Two fresh blind houses, from different rounds and strata, now fail first on reading the plan's scale from its printed dimensions. Both have legible raster labels: 162 OCR tokens with the tallest 242 px, and walls of 14.5–25 px. The failure is in reading and binding, not in what the source provides.

## Why not the others

- **`FIX_PLAN_RESOLUTION`.** Glogownikach's refusal is raised in plan resolution, but there the resolver does what it is meant to: it will not choose between two scales that the printed figures, as read, both state. Moving that rule would accept a misread scale on the next house. The root is upstream, in the misread labels.
- **`FIX_REC17_TOO_LARGE`.** No first bad decision measured in 005N is REC-17.
- **`PDFJS_VECTOR_EVIDENCE`.** Both houses publish raster plans with legible labels, and no vector source was observed for them. That evidence would remove the misreads, but whether it exists for these pages is not measured here.
- **`WALL_MODEL_CHALLENGER`.** No failure measured here is a wall-reading failure: walls are 14.5–25 px and the bands are found. Its unique-value condition is not met.
- **EXTENT (akebiach).** A single fresh house in this stage. It is recorded as the second residual, not chosen.
- **The 005N target class.** Fixed on development, but not exercised by blind round 10, so there is no measured residual in it to chase.

## What it would have to do (for the coordinator, not started)

- Read printed dimension labels so that two misreads cannot outvote a scale already corroborated on both axes by other chains. Candidates:
  - chain arithmetic: segments sum to the overall;
  - label-to-span plausibility at the competing scale;
  - re-reading a disputed label's crop with the ensemble.
- Raise label coverage where many dimension lines carry no read label (murajach: 5 of 79).
- Keep 005E–005I's non-circularity: no published area chooses a scale.
- Regress on glogownikach and murajach, with the development matrix unchanged elsewhere.
