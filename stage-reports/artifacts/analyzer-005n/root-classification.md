# 005N Part A — root classification (before any production edit)

Starting code `5957e3af3e33615efba75b14fd3da004dc814954`. Every number below is from the decomposition traces of the
development rows, replayed solver-alone on their sealed package, graph and metric evidence
(`research/analyzer-005n/trace-decompositions.mjs`, records in `baseline-compound-facades.json`), and from the
extent probe (`research/analyzer-005n/extent-probe.ts`). Pixel coordinates are in each plan frame's own pixels.

## FIRST_BAD_OPERATION per development target

| target | first bad operation | classes (first listed is first) |
| --- | --- | --- |
| **dom-w-gozdzikowcach** ground, incumbent reading | `collinearWideGaps` on line y 598: `alongWallPieces` reads only bands, so the wall-thick pier at x 434–465 (an ink WALL piece, not a band) and the return above it are invisible, and the recess mouth, pier and 325 cm garage door are one 7.76 m gap (x 284→590). Infill is measured over the merged span (0.39, the garage door's own line covers only its part). Pocket 71.1 m² < limit max(6, 2.5·7.76²) = 150.4 m² → `OPEN_SIDE`. | `COMPOUND_GAP_NOT_SEGMENTED`, `SHORT_PIER_NOT_A_SEPARATOR`, `PERPENDICULAR_RETURN_NOT_RECOGNISED` (band V 447.5 stops at y 539, 59 px short of the facade; the ink return X 434 runs 445→592), `INFILL_BOUND_TO_WRONG_INTERVAL`, `SETBACK_BACK_WALL_NOT_LINKED` + `GRID_MISSED_RETURN` (no grid line at the vestibule wall y ≈ 548: the grid's rows are 513 and 598, so one cell column 311–434 × 513–598 holds porch and vestibule together), `GARAGE_MOUTH_NOT_SHUT` (consequence) |
| **dom-w-murajach** ground, incumbent reading | `planExtentOf` (legacy branch of `planExtent`): the frame is a derived chain rect x 108.5–520.5; long bands are kept only within a 35 % margin of it (to x ≈ 665), so the garage's long wall (axis 753, x 741–765, y 234–608, the longest vertical band on the sheet) is dropped although the long top wall (y 209–233) runs continuously from x 404 inside the frame to x 740, into that wall's corner. Extent x1 = 543: the house/garage party wall. | `EXTENT_EXCLUDES_ATTACHED_BODY`, then `GARAGE_MOUTH_NOT_SHUT` (the garage is outside the plan), then `OTHER` (the party wall is 16 px against the sheet's 25 px walls, so the solid layer reads it as two POST pieces and a 4.70 m TRUE_EXTERIOR gap 410→600 on x 536.5: with the garage cut away that side is the plan's edge, and the hall floods from it) |
| dom-pod-jarzabem (secondary) | not this topology. One recess mouth x 413→635 (6.19 m) with no internal separator; decided `OPENING_IN_WALL` on 0.77 "infill" that is the step line drawn across the mouth, so the porch is built. The OPEN_SIDE on y 562.875 (x 263→477) is the vestibule's back-wall line running on through room 12, not a facade. | `OTHER` (a step/paving line read as infill on a single recess mouth) — not tuned for (brief §26) |
| dom-w-cyklamenach (negative control) | no wide gap and no compound span on any line; the root stays the glazing read as DASHED (`gap-Y-196-166-254`) and REC-17 `NO_CONTINUATION` on completion-0. | not this class |
| Marcówki (known-good garage) | no wide gap on the ground front; the garage is enclosed. | — |

### What the "6.45 m mouth" on murajach is

`boundary.bodies[3].mouth` = `gap-X-386-348-609`: a **vertical** line (x 386) inside the hall, between a stair-post piece
at y 330–348 and the vestibule wall at y 609. It is the widest gap on the perimeter of the unenclosed 94 m² part,
measured at the copy's registration (2.45 cm/px). It is not a facade mouth. The facade itself is atomic in every
reading that sees it: in the wall-mass-cluster reading (extent x 109–765) the set-back front y 621.5 reads WALL
380–413 | entrance door 413–476 (WEAK) | pier WALL 476–558 | garage door 558–718 (STRONG, GLAZING) | WALL 718–754, and
the box builds house and garage as one body. So on murajach `COMPOUND_GAP_NOT_SEGMENTED` does **not** apply; the
body relation is lost one step earlier, at the extent.

### The latent next decision on murajach (measured, not repaired)

The ground copy `fb4609c5e2` is registered at **2.451 cm/px** (3 anchors); its printed overall 1020 cm spans about
657 px (≈ 1.55 cm/px). The metric layer's own hypotheses for this frame are 3.025, 1.968 and 2.650 cm/px — none near
1.55. The full-extent reading, which already encloses house and garage, is refused at its own scale (≈ 171 m²
against 75.83 m²). So once the extent keeps the garage, the next first-bad decision is expected to be **METRIC** on
the ground copy, independent of the body relation.

## Synthetic baseline (repository fixtures and one compound fixture)

| fixture | starting-code result |
| --- | --- |
| open carport bay | bay mouth OPEN_SIDE, house one body |
| double-garage bay, door drawn | bay mouth OPENING_IN_WALL, bay built |
| loggia (recess, no garage) | 6.25 m OPEN_SIDE, pocket 15 m², recess RECESS |
| compound recess (3 m, back wall with door) + pier/return + 3 m garage door, **blank** | one 7.85 m `OPEN_SIDE` (pocket 30.8 < 154 m²); the garage is lost as RECESS |
| the same, garage door **drawn** | one 7.85 m `OPEN_SIDE` (infill 0.54 over the merged span); the garage is built only through per-edge line closure on a band-derived grid |

## Consequence for the implementation

1. Gozdzikowcach is the target class: split a wide collinear gap at source-supported separators read from wall-thick
   ink (the boundary's own solid layer), decide each child on its own infill, callout and pocket, and link a recess
   child to its back wall (a grid line there, its span shut by wall and door-sized holes between wall jambs).
2. Murajach's first bad operation is the extent. The generic repair is a wall-connectivity rule in the legacy extent:
   a long band beyond the near margin is the same building when a wall-thick long band inside the frame runs into
   its corner. After that the measured next decision is METRIC, which 005N records and does not repair.
3. No computational-geometry kernel operation (noding, polygonization, boolean, offset) is on any traced failure path:
   `geometry-kernel-decision.md`.
