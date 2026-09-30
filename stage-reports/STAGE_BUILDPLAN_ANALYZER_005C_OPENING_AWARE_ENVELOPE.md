# STAGE BUILDPLAN-ANALYZER-005C — opening-aware exterior envelope, body relations, cross-publisher probe

<!-- VERDICT TABLE -->

Branch `analyzer/opening-aware-envelope-v1` (also pushed to `claude/new-session-3kzcgh`), from
`analyzer/dimension-evidence-refoundation-v1` @ `d3235bf`. Legacy (`BuildPlan-PC-Legacy`) was not touched. No drawing,
PDF, DWG or render of any publisher is committed: only text facts, hashes and numbers.

---

## A. Baseline — 005B PARTIAL accepted

- **Start.** `analyzer/dimension-evidence-refoundation-v1` @ `d3235bfec81159e0b10485f4f362a79fff58f18c`, verified; the
  new branch was created from it.
- **005B's verdict is kept as it was:** the metric layer PASS, plan extent PARTIAL, both round-2 blind houses
  (`dom-w-zurawkach`, `dom-w-modrzykach`) ALGORITHMIC_FAIL at the walled outline on a side of openings, the class
  willa-miranda had failed in since round 1.
- **Measured, not assumed.** All eleven development houses (the eight of 005B, the two round-2 blind houses, and
  Aster VIII) were run at `d3235bf` into a scratch directory outside the repository. Marcówki `6152770f…`, Kosaćce
  clean and tracked `5b5ffcf1…` and G2E `8fa4a25b…` reproduced; the three envelope houses failed as recorded:
  willa-miranda `PLAN_LAYOUT_REJECTED` (0.55 m² built of 169.9), dom-w-zurawkach `PLAN_NO_MASSES` (69.05 of 101.7),
  dom-w-modrzykach `PLAN_LAYOUT_REJECTED` (14.72 of 181.98). The §28 before-diagnostics are in
  `artifacts/analyzer-005c/before-diagnostics.json`.
- **Aster VIII baseline first** (`artifacts/analyzer-005c/aster-viii/baseline.json`, commit `3e76894`): routed to the
  generic reader (no specialist for the host), 25 assets, **0 published facts** (the page prints its figures in a
  div-built table with a tooltip between label and value), every PDF and the DWG dropped before any fetch (the
  drawing word "Obrys budynku w skali 1:500" sits on the parent list item, the anchors say "PDF podstawa" /
  "PDF lustro"), and a typed stop `METRIC_RESOLUTION_INCONCLUSIVE`: the floor plan prints no dimension chain.

## B. Focused pre-review

Four independent read-only reviewers, each told only its own question, measured on the development houses' own
bytes (commit `eef7133`, `artifacts/analyzer-005c/pre/`): boundary geometry (A), opening semantics (B), attached
bodies (C), source generality (D). `synthesis.md` is the implementation contract. Their agreed findings:

1. One first bad decision on all three failing houses: the walled envelope is the box of the axes of bands at least
   2.5 walls long, and every cell outside it is seeded as outside. A side made of piers and glazing has no long band.
2. Below that, piers and corner blocks are not bands at all; a mask-level scan along the line recovers every pier,
   its gap width within 0.04 m of the printed callout on 39 of 39 real openings.
3. The long-band box is also the only guard against line-closed exterior (1011 of 2261 grid edges are shut only by
   thin lines): the new boundary is built from wall-thick ink and classified gaps, never from line work.
4. The new boundary must not replace the box wholesale (that moves 4 of the 5 completing houses); it may only extend
   the box where it continues the box's interior across an unsupported stretch of the box's own edge.
5. Posts are told from jambs by connectivity; the old `infill` does not discriminate, a gap signature does.
6. Callouts corroborate and are never required. 7. Bays fail for three independent reasons; the discriminating
   relation is the junction. 8. Every Aster defect is generic (D's prototype read 11 of 11 figures and left
   alt-marcowki's package byte-identical).

## C. The old wall-envelope pipeline

`decomposePlan` (005A/005B): dimension chains and wall bands make a structural grid; the **walled envelope** is the
box of the axes of the long bands, snapped to the grid; every cell outside the box is seeded OUTSIDE; a flood from
those seeds, stopped by each edge's closure (wall share, a thin-line term, wide-opening hypotheses), leaves the
enclosed cells; regions and bays (`baysOf`) are cut from them, and `layout.ts` turns regions into masses behind a
35 % perimeter-wall gate.

## D. The long-wall-band assumption

A facade drawn as piers and glazing leaves no band ≥ 2.5 walls on its line, so the box stops at the last long wall
inside the building: modrzykach's box was **2.02 m of an 11.60 m** depth; zurawkach's garage wing and willa-miranda's
west part lay outside it by construction. And the box is what kept line-closed exterior (terraces, paving) out:
removing it without a replacement builds modrzykach's terrace and zurawkach's porch.

## E. Opening-gap semantics

The only notion of an opening was a width convention (≤ 3.2 m shuts) plus an `infill` score that scores glazing,
a floor edge, a dashed canopy line, paving and the watermark alike (~1.0). Garage jambs (walls 2.8–11.4 walls long)
and porch posts (~1.5 walls square) were indistinguishable, and a porch post 3.5 px off the garage-front line
enclosed a porch under any "repeated collinear support" rule.

## F. Attached-body and bay assumptions

`baysOf` required (i) a side wall starting at the box edge — a flush side wall runs through it; (ii) a reach to the
band's end above a threshold that works out at 1.86 m on zurawkach, not the documented 1.5 m; (iii) a grid line at
the mouth. zurawkach's garage wing failed all three; modrzykach produced a 97.6 % "bay" (the whole front).

## G. The new BoundaryEvidenceGraph

`packages/reconstruction/src/boundary-evidence.ts` (version 1.0.0):

- **Wall-solid layer.** The ink mask opened by `round(0.3 × sheet wall)`, components labelled: **POST** when the
  bounding box is at most 2.5 walls on both sides, **WALL** otherwise.
- **Line scan.** Along each grid line (and each shadow line, below), a position is solid when a wall-thick window
  within one wall of the line is ≥ 80 % ink; solid runs are **pieces** (kind from their component, `along` when at
  least 1.25 walls long); breaks ≤ 0.5 wall inside solid ink are **drawing breaks** and merged.
- **Gap signature.** Continuous thin lines within ±0.75 wall of the fitted axis, each covering ≥ 70 % of the gap in
  ≤ 2 runs: GLAZING (2+), LEAF_AXIS (one on the axis), LEAF_FACE (one at a face), DASHED, BLANK; a line running on
  past both jambs is paving, not infill.
- **Gap classes** (contract §2.1): `DRAWING_BREAK_SUPPORTED`, `OPENING_SUPPORTED` (STRONG: glazing; a leaf ≤ 3.2 m; a
  leaf at a face ≥ 2.2 m, a vehicle door; a callout within max(10 cm, 3 %); glazing against a POST jamb),
  `UNKNOWN_GAP` (WEAK: a door-sized gap with nothing drawn, both jambs along), `TRUE_EXTERIOR_GAP` (NONE: a POST
  jamb with no glazing, blank > 3.2 m, dashed, > 8 m). **Corner legs** bridge an opening that turns a corner.
- `boundary-outline.ts`: the **outline** is the set of cells a flood from the grid border cannot reach when only
  pieces and bridged gaps stop it — line work never does. STRONG gaps are bridged; WEAK ones by exclusion (left
  open, would the outside reach more than a pocket, `max(6 m², 2.5 w²)`?) to a fixpoint, ≤ 48 judged per plan.

## H. Boundary candidate families

- **A — the long-band box** and its shut bays: the incumbent, kept **byte for byte** wherever B adds nothing.
- **B — the opening-aware outline**, on a **shadow grid**: the plan's own lines plus a line at every exterior-chain
  tick, read or not, with no line within half a wall (an unread chain's ticks are still the drawing's statement of
  where a face is). Solved under two jamb policies: **B_EXCLUSION** (the reading) and **B_STRICT** (STRONG only).
- **C — the wall witness** and **D — the printed extent** bound B; they never generate it.
- **Acceptance** (reviewer A): a component of B beyond A is accepted only when it continues A's interior across an
  edge of A that carries no wall and no opening, and only when B widens the building (an outline smaller than A's
  built area has leaked where A held). The adopted outline is A's interior B confirms plus the accepted components —
  a pocket walled off from A on every shared edge (a planter, a pier) is not brought back by touching it.
- **Re-cut.** When accepted, the plan is decomposed again on the shadow grid, cells outside the outline seeded as
  outside, the outline's edges closed with their openings counted as openings and their solid share as wall.

## I. Envelope scoring

Each candidate carries its support profile (`OutlineSupport`, §29): perimeter, wall-supported, strong-opening,
weak-opening and unsupported length, gaps bridged, largest bridged gap, area and extent — recorded in the plan digest
(`PlanDiagnostics.boundary`). The published footprint is **never** an input: it is checked afterwards by the layout
gate and the verdict, as before. When B_STRICT and B_EXCLUSION both adopt an outline more than 6 % apart and the run
then stops, the stop is **`BOUNDARY_RESOLUTION_INCONCLUSIVE`**, naming both candidates, their support and the missing
evidence (§31); a scale nothing supports keeps its own, deeper stop.

## J. Opening-supported continuity

A large opening is not "outside because the boundary uses an opening edge" (§19): the outline's topology crosses an
`OPENING_SUPPORTED` edge while its occupancy stays an opening, and on an outline frame the 35 % wall gate counts only
a region's sides against the outside, with bridged openings as openings. modrzykach's 7.51 m front (piers, glazing, a
garage door) now survives: its outline is the whole house.

## K. Attached-body relations

`boundary-bodies.ts`: every part of the plan beyond the box — enclosed, open, or the box's own cells the outline
leaves open — is named by its **junction** with the house (length, wall share), its **sides** (WALL and POST share)
and its **mouth** (the widest gap the outline left open): `PROJECTING_WING` (enclosed, interior continuous,
junction < 50 % wall), `FLUSH_ATTACHED` (against a party wall), `RECESSED_ATTACHED` (inside the box, left open by
the outline), `OPEN_MOUTH_GARAGE` (two wall sides ≥ 50 %, a blank or dashed mouth ≥ 2.2 m between WALL jambs),
`COVERED_TERRACE` (posts, < 35 % wall), `SEPARATE_BODY` (no junction), `UNKNOWN`. Reported in the digest, accepted or
not. An open-mouthed garage stays open in the first reading; the resolver's reading that shuts pocket mouths now
exists for it and adopts it by relation. `baysOf` stays in A with one relational guard (a pair spanning > 0.8 of its
side is the building's own sides); `sideWallReach` returns the front's outer face. A wing is accepted by its
enclosure and relations whatever its reach: the synthetic 1.0 m wing the reach rule drops is built (§40).

Mass making on outline frames: a region narrower than `max(1 m, 2 t + 0.2 m)` is a wall's thickness, a face step or
a pier, never a body; a strip the largest-first cut leaves along a neighbour is re-cut into it when every piece passes
the wall gate (area exact). A storey's walls stop at the floor of the storey above; a basement plan that registered
onto nothing no longer fixes the world frame; a door on a gable is cut level at the low end of the rake.

## L. Terrace and pergola safety

Posts are POST components and a POST jamb with no glazing is a `TRUE_EXTERIOR_GAP`; line work (a roof outline, a
dashed canopy, paving, pergola beams) closes nothing. A covered terrace is named `COVERED_TERRACE` and never built,
also in the reading that shuts pocket mouths (test: attached-bodies "a covered terrace on posts"). The §39 negative
(posts, a dashed roof outline and edge lines, no wall) builds exactly the house.

<!-- M.. -->
