# 005L next recommendation

**NEXT: `FIX_RECESSED_ENTRANCE_BODY_RELATION`**

005M is not self-started. This is one residual, chosen from the measured first bad decisions.

## Why this one

| evidence | first bad decision |
| --- | --- |
| **Blind round 9 #1, `dom-w-murajach`** (fresh, stratified multi-storey) | **BODY_RELATION.** On the ground plan, the recessed entrance vestibule and the 250 cm garage door stand side by side on the front line. The house body is not enclosed (a 6.45 m mouth), the garage mouth is not shut, and the garage is left outside the extent. The boundary is not accepted, so the attic plan becomes the base, and the ground storey's own 7 m² footprint is refused at the gate. Every one of the 12 readings the resolver weighed fails |
| Blind round 8 #1, `dom-w-gozdzikowcach` (005I) | **BODY_RELATION.** The recessed entrance porch's mouth and the garage door are read as one 7.76 m place where the wall stops, and the 71 m² behind the porch is lost |
| Development `dom-w-gozdzikowcach` | PLAN_RESOLUTION_INCONCLUSIVE at both commits, on the same relation |

Two of the last four fresh blind houses fail first on this relation. They were drawn by lot from different families,
in different rounds and strata. On #1 of round 9 the decision is upstream of everything 005L changed: the storey code
neither caused it nor could fix it. At the 005K code the same evidence emits the attic outline as the ground floor
(−13.5 %, ALGORITHMIC_FAIL).

## Why not the others

- **`FIX_PLAN_RESOLUTION`** (7 development rows end PLAN_RESOLUTION_INCONCLUSIVE). The family is wide, but it has two
  different roots. On blind-8, the resolver *found* the right reading and was not allowed to choose it, by design.
  On murajach and gozdzikowcach, no right reading exists to choose, because the body relation breaks them all.
  Fixing the relation first removes one root; changing the resolver's rule first would not repair murajach.
- **`FIX_REC17_TOO_LARGE`.** No first bad decision measured in this stage is REC-17.
- **`PDFJS_VECTOR_EVIDENCE`.** Both blind round-9 houses publish raster plans with legible walls (16 and 25 px) and
  legible overall dimensions. The failure is interpretation, not missing vector evidence.
- **`OTHER_MEASURED_RESIDUAL`.**
  - The 005L residuals are named in the report: upper-plan decompositions with no walled body (willa-miranda),
    L-shaped storeys emitted as their largest rectangle, and the gable soffit near an inset eave.
  - Each is measured on at most one development row, and none is first on a fresh blind house.

## What it would have to do (for the coordinator, not started)

- Read a recessed entrance and a garage door that share a front line as two openings of one body. The vestibule's
  set-back wall closes the house, and the garage door is a vehicle mouth that is shut.
- Do not read them as one wide gap that leaves the body unenclosed.
- Hold the same non-circularity as 005L: no published area chooses the closure.
- Regress on gozdzikowcach and murajach, with the development matrix unchanged elsewhere.
