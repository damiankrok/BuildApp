# STAGE BUILDPLAN-ANALYZER-005C — opening-aware exterior envelope, body relations, cross-publisher probe

| Verdict | Result |
| --- | --- |
| OPENING-AWARE EXTERIOR ENVELOPE | **PASS** — the walled outline crosses piers, glazing and doors: dom-w-modrzykach PASS (−0.14 %), dom-w-jablonkach PASS (−0.40 %), willa-miranda and dom-w-zurawkach built within 6 % (they fail on storeys, §M, §N); on the blind ARCHON house the outline continues through the glazed side and stops at the pergola (§Z); no development house moved down (§S) |
| ATTACHED BODY / BAY RECONSTRUCTION | **PARTIAL** — bodies named by relation and built right on the three envelope houses (house and garage, wings, annex); open: party-wall garages still decided by reach in the box reading, a double garage with a post, a wing behind a doorway, storeys over attached bodies (§W, AF) |
| CROSS-PUBLISHER GENERIC SOURCE | **PASS** — Aster VIII 0 → 11 figures and its outline documents (§Q); the blind DobreDomy page read with no DobreDomy code: 11 figures, 17 assets with roles, 4 documents, a typed stop where the plans print no dimension (§AB) |
| 005B METRIC LAYER REGRESSION | **PASS** — no metric-layer file changed; every 005B metric PASS keeps its model hash; one 005A known-set row changed with its evidence (§T); the blind ARCHON defect is in the 005B layer as it was, not a regression (§Z) |
| PROGRESS TELEMETRY | **PASS** — the boundary's own subphases and counters, cancellable, in Polish on Android; longest silence 2.6–4.6 s on the development houses, 2.5 s on the blind ARCHON run; residual: 5.7 s on the 1625 × 1700 px DobreDomy plan (§V, §AB) |
| BLIND ARCHON ROUND 3 (`dom-w-azaliach`) | **ALGORITHMIC_FAIL** — completed at −3.48 %, but storeys 1 of 2 and resolved by the published figure alone; first bad decision: the overall chain's spurious tick and `1035` read `1055` (metric layer) (§Z) |
| BLIND DOBREDOMY ROUND 3 (`galaktykaI`) | **SOURCE_LIMITED_PARTIAL** — the plan prints no dimension, confirmed on the raw copy; stopped by name (§AB) |
| **Stage** | **PARTIAL** — `PARTIAL_BUILDPLAN_ANALYZER_005C_BLIND_ARCHON_OVERALL_DIMENSION_MISREAD` |

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

## M. willa-miranda

| | 005B (`d3235bf`) | 005C (`ca97516`) |
|---|---|---|
| Outcome | `PLAN_LAYOUT_REJECTED` (0.55 m² built of 169.9) | completed, 4 bodies, 18 openings |
| Ground storey | — | 161.29 m², **−5.07 %** of 169.9 |
| Storeys | — | 1 of 2 plans (the upper plan carries no body) |
| Openings | — | 1 printed opening not built (`opening-0-east-13-0`) |
| Verdict | ALGORITHMIC_FAIL | **ALGORITHMIC_FAIL** (storeys, one opening) |

The first bad decision of 005B is gone: the outline crosses the piers and the glazing of the garden side, and the
ground storey is the main body (15 × 9.2 m), the garage projecting 2.45 m at the front, the living bay projecting
2.45 m at the back and the small annex beside it. Two things still fail, both named:

- **The upper storey.** Its plan maps onto about 3.6 × 8.6 m of the ground storey, 24 % of the main body. On an
  outline frame a body under a quarter of the widest body's width is a strip, never the main body or an alignment
  target (C P0-3), and no other body passes the 50 % rule, so the upper plan registers onto nothing. Before the
  review it stood on a 1.7 m strip, which passed the storey count and was wrong (§W).
- **One east-side opening** (0.40 m wide, on the small attached annex) is refused by the corner-material rule; the
  rest of the side is built.

The house depends on the rule that a read chain framing an axis over less than half the walls' span, while an
exterior chain covers all of them, is outspanned (`a1913fc`): without it the plan's depth comes from a 2.1 m interior
chain and the run stops at `PLAN_NO_BUILT_REGIONS`. The same rule changes one known-set row (§T). Model `1ce47cfb…`.
The two jamb policies disagree on this plan (one adopts and they build more than 6 % apart); the reading adopted is
the exclusion policy's, as the contract says, and since the run completes the flag is recorded in the digest, not
raised as `BOUNDARY_RESOLUTION_INCONCLUSIVE`.

## N. dom-w-zurawkach (round-2 blind house, now a development house)

| | 005B | 005C |
|---|---|---|
| Outcome | `PLAN_NO_MASSES` (69.05 of 101.7 m²) | completed, 2 bodies, 12 openings |
| Ground storey | — | 100.88 m², **−0.81 %** |
| Openings | — | every printed opening built |
| Storeys | — | 1 of 3 plans (the basement and attic plans do not register) |
| Verdict | ALGORITHMIC_FAIL | **ALGORITHMIC_FAIL** (storeys only) |

The ground storey is now right in shape as well as in area: the house 7.50 × 8.00 m and the garage 4.30 × 9.50 m
projecting 1.50 m at the front (printed: 750 + 430 = 1180, 800 and 950). The first 005C cut (`1b330d3`) built three
bodies (a 1.7 m strip down the west side and the garage's projection as a separate bay, −3.2 %); the post-review
re-cut never cuts the neighbour and the strip joins the house (§W). The remaining failure is vertical: three plans
are read (basement, ground, attic) and no body reaches past the ground storey (`LAYOUT_NO_MASS_REACHES_UP`, named in
the result). Model `31ba5eea…`; the policies disagree here too (flag recorded).

## O. dom-w-modrzykach (round-2 blind house, now a development house)

| | 005B | 005C |
|---|---|---|
| Outcome | `PLAN_LAYOUT_REJECTED` (14.72 of 181.98 m²) | completed, 3 bodies, 19 openings |
| Ground storey | — | 181.72 m², **−0.14 %** |
| Openings | — | every printed opening built |
| Storeys | — | 1 of 1 |
| Verdict | ALGORITHMIC_FAIL | **PASS** |

The 7.51 m front of piers, glazing and a garage door is now a facade, and the outline is the whole house. The first
005C cut built it as 6 bodies (the wall-thickness bands between an outline frame's axis and face lines as bodies of
their own); after the post-review re-cut it is 3 bodies, −0.14 %, with every shared door built once (§W).
Model `d4accc9d…`.

## P. Aster VIII — acquisition baseline

At the frozen 005B code (§A, `artifacts/analyzer-005c/aster-viii/baseline.json`): routed to the generic reader (no
specialist claims `dobredomy.pl`), classified `PROJECT_PAGE` (0.69: plan, elevation and section imagery, a title
naming a house), canonical `https://www.dobredomy.pl/projekt/asterVIII` (declared), 25 assets with their roles, **0
published figures** (a div-built fact table with a tooltip between label and value), **every PDF and the DWG
dropped before any fetch** (the drawing words sit on the parent list item, the anchors say "PDF podstawa" / "PDF
lustro"), and a typed stop, `METRIC_RESOLUTION_INCONCLUSIVE`: the floor plan prints no dimension chain. Total 36 s,
peak 699 MB, the longest silence 2.46 s.

## Q. Aster VIII — generic source

Two commits change the generic reader, by structure and never by site: `432dbd2` (1.1.0: figures printed as
blocks, superscript units, technical documents recorded and hashed but never parsed, captions and views, a crawl
that follows only links about this project) and, after the source-overfit review, `64f7ff6` (1.2.0: a figure only
inside its own row and only the page's own — §W). Re-sealed from the cached bytes by 1.2.0
(`artifacts/analyzer-005c/aster-viii/source-package.json`, schema 1.3.0, content hash `2d7c2742…`):

- **11 figures**: usable area 172.9 m², footprint 278.3 m², building height 5.9 m, roof pitch 30°, sloped roof area
  269 m², flat roof area 30.8 m², volume 640.2 m³ (recorded without a unit, as for every publisher), room count 4, bathroom count 2, minimum plot 26.32 × 23.48 m. Each
  is the page's own, read from its row; none comes from a card, a form, a tooltip example or prose.
- **4 documents**: the building outline (PDF base, PDF mirrored, DWG — fetched under the document-only media
  allowlist, signature-checked and hashed: `14189ed5…`, `6cc483df…`, `9631e137…`) and the energy certificate
  (recorded, not fetched). The brochure is no longer recorded (P1-9: only the house's own kinds).
- 25 assets, the same roles as the baseline. No drawing, PDF or DWG is in the repository.

The CI job "Analyzer / opening-aware envelope" acquires Aster live and requires usable area, footprint, roof pitch
and building height; an unreachable publisher is a warning. The hard-code guard registers every development house's
printed figures (two-decimal and short spellings) and the generic publishers' names: none is in production code.

## R. Aster VIII — reconstruction

Aster stops, by name, where it stopped before: `METRIC_RESOLUTION_INCONCLUSIVE` in `REGISTERING_VIEWS` — "the floor
plan's scale cannot be established: no scale is stated by any reading that owes nothing to a scale … What is
missing: a dimension printed on the floor plan itself — it prints none." The 962 × 1202 px ground plan has 61 wall
bands and a walled envelope, but 0 dimension chains; the two scales its readings state (2.09 cm/px, plausible, and
248 cm/px, ruled out by the walls) have no independent witness. The scale the 1:500 outline PDF states is a document
the analyzer records and does not parse (no PDF importer in scope), and the published footprint verifies; it never
supplies a scale. Total 45 s, peak 705 MB. This is the honest outcome for a publisher whose plans print no
dimensions: a typed refusal, not a house of invented size.

## S. Existing development regressions

The full 11-house matrix at `ca97516` (offline, sealed source packages, the publisher's bytes from a cache outside the
repository; `artifacts/analyzer-005c/development-matrix.json` against the 005B code):

| House | 005B | 005C | Model |
|---|---|---|---|
| Marcówki | PASS | PASS | `6152770f…` **unchanged** |
| Kosaćce clean | PASS | PASS | `5b5ffcf1…` **unchanged** |
| Kosaćce tracked | PASS | PASS | `5b5ffcf1…` **unchanged** |
| Rarytasy G2E | ALGORITHMIC_FAIL (−2.93 %, METRIC_SCALE_WEAK) | the same | `8fa4a25b…` **unchanged** |
| Rarytasy e-OZE | PASS (+1.57 %) | PASS | `b4e76f04…` **unchanged** |
| alt-marcowki | `METRIC_RESOLUTION_INCONCLUSIVE` | the same | — |
| dom-w-jablonkach | ALGORITHMIC_FAIL (−5.25 %, openings) | **PASS** (−0.40 %, every printed opening) | `70b01afd…` |
| willa-miranda | `PLAN_LAYOUT_REJECTED` | ALGORITHMIC_FAIL (−5.07 %, storeys) | `1ce47cfb…` |
| dom-w-zurawkach | `PLAN_NO_MASSES` | ALGORITHMIC_FAIL (−0.81 %, storeys) | `31ba5eea…` |
| dom-w-modrzykach | `PLAN_LAYOUT_REJECTED` | **PASS** (−0.14 %) | `d4accc9d…` |
| Aster VIII | `METRIC_RESOLUTION_INCONCLUSIVE` | the same | — |

No house moved down. The CI job "Analyzer / development house" runs all eleven, each judged by its row; the rows
changed by this stage say what the houses now do: willa-miranda `footprint:4` and dom-w-zurawkach `footprint:2`
(built within 6 % with their own bodies, the storey failure named in M and N), dom-w-modrzykach and dom-w-jablonkach
`pass`, the pinned hashes unchanged.

## T. Metric regression

The 005B metric layer is not touched by 005C (no change under `packages/source-metrics`); its gates — dimension
orientation, scale independence, chains, the plan extent — run unchanged in "Analyzer / dimension evidence" and again
in "Analyzer / opening-aware envelope", and every 005B metric PASS keeps its model hash (§S).

**One known-set row changes, with its reason.** The 005A known set runs today's solver on evidence sealed in 005A
(`artifacts/analyzer-005a/before`). Its e-OZE metric evidence registers both rzut copies at 2.50 cm/px: the overall
dimension is read as 18.01 m where the drawing prints 16.01 m (and 1.26 m where it prints 1.16 m), the misreads the
005B reader corrected (today's registration of the same copy: 2.22 cm/px). Until 005C that sealed first reading
stopped on the drawing — its depth framed by a 2.1 m interior chain, so no walled envelope — which left the published
figure free to choose a reading at another scale. Since `a1913fc` the interior chain is outspanned and the depth
comes from the exterior chain (230–578.5 px; at the correct scale 7.75 m, the depth today's reading builds), so the
first reading builds the whole house at the sealed scale: 150.63 m² (every copy) and 146.97 m² (the area copy
alone) against 122.07. The published figure refuses it, and a figure that refused the first reading cannot also
choose the replacement: the resolver stops with `PLAN_RESOLUTION_INCONCLUSIVE` — named, not built, as the Kosaćce
area-copy row has done since 005A. Bisected on scratch worktrees: `d3235bf` completes (model `b50b6e59…`);
`a1913fc` and `ca97516` refuse; `ca97516` with only the outspan rule disabled completes again (`b50b6e59…`), and
disabling the witness join or the outline adoption instead changes nothing. Disabling the rule would put willa-miranda
back to a refusal (§M); restricting it so that it misses this plan and fires on willa-miranda's would be fitted to two
plans. So both e-OZE known rows are now `may-refuse` (only by the resolver's named code; a smaller building still
fails the row), with this reason in the workflow. Today's reading of the same house — the development row, fresh
metric evidence — is unchanged (`b4e76f04…`, +1.57 %). The resolver's inability to recover a misread overall
dimension once the first reading builds is residual debt (AF).

## U. Metamorphic and negative tests

- `packages/reconstruction/test/boundary-envelope.test.ts` (22): the 15 synthetic shapes of §36 (a door, three large
  windows, a 70 % open facade, a 5 m garage door, a corner window, an open-mouthed garage, two kinds of projecting
  wing, a covered terrace, a pergola, a loggia, an L, a pier-and-glazing wall, a missing piece, a courtyard); §37
  the same architecture drawn differently (one exterior stroke split into 2 and 5 pieces, a 0.85 downscale, walls
  eroded by 1 px, grey ink, a different crop) keeps its envelope, and with the window symbols erased a 3 m space
  behind a blank 5 m mouth is named, not built, in either reading; §38 a 4.5 m unsupported gap is exterior and
  nothing is adopted across it; §39 a terrace on posts with a roof outline is never floor; §40 the 1.0 m wing the
  reach rule dropped is built, a 2.0 m decorative outline is not.
- `attached-bodies.test.ts` (8): wing, open-mouthed garage (open first, built when mouths are shut), terrace,
  planter, detached shed, the failure code, the two policies keeping every room the box built, `policiesDisagree`.
- `boundary-post-review.test.ts` (11, new): the reviewers' cases — paving and kerb lines on and beside the face row,
  tile and tread patterns, a dimension line on the axis, a pergola's rails between posts, a terrace fronted by a
  paving edge, a walled yard with a gate behind a wing, a thin line across a wing's junction with the back rooms
  kept, a 3 × 3 m walled terrace (no garage, not built by the shutting reading), a U's courtyard, a strip along part
  of a side.
- `wide-openings.test.ts` (15), `shape-families.test.ts`, `plan-decomposition.test.ts`, `failure-codes.test.ts`:
  unchanged expectations, passing.
- Source: `generic-structures.test.ts` (22) and `generic-regions.test.ts` (23, new: value-before-label, filters and
  selects, cards by title link, blank values, limits in prose, tooltips, listings, document rows and variants,
  crawl tokens, signatures, malformed escapes); `tests/architecture/generalization.test.ts` with the planted
  trailing-zero cheat.
- Full suite at the freeze: §X.

## V. Progress and performance

- **Telemetry.** The boundary's two steps are reported as their own subphases of "reading the plans and registering
  the views": `BOUNDARY` "joining the outline" (wall lines read of their total) and `BOUNDARY_GAPS` "judging the openings"
  (weak gaps judged of their total), each a checkpoint that also honours cancellation;
  Android names them «sprawdzam otwory: N z M» and «łączę obrys: krawędź N z M», and a
  `BOUNDARY_RESOLUTION_INCONCLUSIVE` stop says the outline could not be established and why (`26b63e3`). Across the
  eleven houses the longest silence a phone would see is 2.6–4.6 s (`maxTelemetryGapMs`, heartbeats every second).
- **The boundary's own cost** (`artifacts/analyzer-005c/boundary-performance.json`, regenerated at `ca97516`:
  `boundaryExtension` alone, re-run per floor plan, one process per house, sequential): 29–188 ms per plan on 11
  plans (the largest, Kosaćce's 278 gaps), peak RSS of the measuring process ≤ 304 MB; caps of 48 weak gaps judged,
  16 extensions and 16 bodies per plan, the remainder reported.
- **Whole runs** (two houses at a time on one machine, so wall clock is inflated): 45–372 s, peak RSS 676–879 MB,
  the metric frames dominating as in 005B.

## W. Post-review

Four independent read-only reviewers, each told only its own question, attacked the 005C head (`0575fb5`) with
synthetic plans and pages, the development houses' own bytes and a frozen copy of `d3235bf`
(`artifacts/analyzer-005c/post/`): boundary correctness (A), false closure and gap semantics (B), attached bodies and
how they become masses (C), cross-publisher source overfit (D). Every P0 and P1 was reproduced before it was fixed;
the reviewers' own scripts were replayed on the fixed code (commits `64f7ff6`, `55a9c65`, `b0013ed`, `ca97516`). What each
finding became:

**Source (D) — `64f7ff6`, generic reader 1.2.0**

| Finding | Disposition |
|---|---|
| P0-1 value before its label shifts every pair | Fixed: the block reader has the page's element tree; a value belongs to a label only inside the smallest element holding both, with no other label and exactly one figure; an element with several facts is read flat only when each section alternates strictly label, figure. Value-first counters and icon boxes pair inside their own box. |
| P0-2 a filter slider or a `select` read as the house | Fixed: nothing inside a form, a control, a `label`, a `dialog`, `nav` or `footer` is a figure or a document, for every reader. |
| P0-3 related-project tiles linked on title or image | Fixed: a card is the smallest element linking to another page through its title (a picture, a heading, the link it opens with), to at most two pages, not holding the page's h1. A link in small print (a privacy policy under a form, which Aster's own sidebar has) makes nothing a card. |
| P0-4 a blank value borrows the next row's | Fixed: a dash, a bound, an estimate or a range holds its label's place and states nothing. |
| P0-5 a limit in prose read as a figure | Fixed: inline labels four words at most; `ok.`/`ca.`/`~`/`do`/`od`/`max` make a slot, not a figure; bounding and storey labels (`maksymalna`, `wskaźnik`, `parteru`) are no figure of the house. |
| P1-1 the guard fails and misses trailing-0 figures | Fixed: the development-house figures are out of the comments; the guard now registers the two-decimal spelling and the short one (`278.30`, `278.3`), with a planted-cheat test. `domy` joins the guard's generic words (it is the plural of `dom`). |
| P1-2 structured readers win outright, no card rule | Fixed: every reader goes through the same exclusions; two readings of one key that differ, from any readers, leave it out. |
| P1-3 a tooltip's example value | Fixed: two figures in one row make it ambiguous; definition prose (eight words or more, or a sentence) is passed over. |
| P1-4 a catalogue listing classified as a project | Fixed: classification reads only the page's own pairs; the listing is `NOT_PROJECT`. |
| P1-5/6 document labels and kinds/variants | Fixed: the nearest words decide (the link's own, then its row — text before it, its parent item, its table row's first cell, its `dt`, a section heading with only links between —, then its filename); guides, samples and catalogues are nobody's; a row naming both variants names neither; `nie lustrzana` is the base. |
| P1-7 cache hit skips the media check; `.dwg` crawled | Fixed: cached bytes meet the document allowlist again; a CAD file or an archive is never crawled as a page. |
| P1-8 no signature check | Fixed: a PDF must say `%PDF-` in its first kilobyte, a DWG open with `AC10`, a DXF with its first group and `SECTION`; else `SIGNATURE_MISMATCH`, not hashed. |
| P1-9 site PDFs move the package to 1.3.0 | Fixed: only the house's own kinds are recorded (outline, drawing set, energy certificate, cost estimate), at most 16. |
| P1-10 crawl tokens | Fixed: the project is named by whole tokens of its slug or its query id, and a run naming it may carry only drawing words besides (`-rzuty` yes, `-2` and `-lustro` no; `filipa` does not contain `lipa`; `47110` is not `4711`). |
| P1-11 a malformed escape throws | Fixed: `safeDecode` everywhere in the reader. |
| P1-12 digits in labels | Fixed: a unit (`(m2)`, `[m²]`) and a standard (`wg PN-ISO 9836:1997`) are cleaned off before the label is read; the unit is kept. |
| P1-13 units | Fixed: a figure's unit is its key's for every reader; `%`, `cm`, counts and doors are no area, height or pitch. |
| P1-14 vocabulary | Fixed for the words named (`od frontu`, `z przodu`, `wejściowa`, `od ogrodu`, `z tyłu`, `minimalna szerokość działki`, `plot width`, `21,15 x 24,60 m` in a block, `Pow. dachu`). |
| P2 | Left: a logo in the h1, gallery captions, ARIA `role=table` fact tables, the longest-paragraph description, failed document fetches spending the budget, `download.php?file=`, `http:` PDFs, documents on crawled subpages. Named in AF. |

The Aster VIII package was re-sealed from its cached bytes by reader 1.2.0: the same 11 figures, assets and
specifications, four documents (the brochure is no longer recorded), content hash `2d7c2742…`. 23 synthetic tests
(`packages/source-package/test/generic-regions.test.ts`) carry the reviewer's cases.

**Boundary (A) and openings (B) — `55a9c65`**

| Finding | Disposition |
|---|---|
| B P0-1, A P0-2 paving, kerb, slab, step and tile lines read as openings | Fixed: infill is two to four continuous lines inside the wall — the jamb's own measured thickness, not the sheet's typical wall — that stop at the jambs. A line running on past a jamb (alongside the wall with open ground between them, or beyond the last piece of the wall line, where the building ends) is paving, a kerb or a dimension line; parallel lines beyond the wall on both sides are a pattern (tiles, treads), not glazing. When lines that would be infill also run on (a glazing row a paving edge continues), the gap is a question (WEAK) for the pocket rule, never a drawn opening. A vehicle door needs two stretches of wall as jambs. |
| A P0-1, B P0-2 adoption joins across closed edges (a yard, a walled part) | Fixed: an accepted part keeps only what is entered from the box's rooms (an open edge, a door or an opening in the box's wall) and reached through edges with no wall or with an opening in them, and the wall-thickness cells around that; the rest is recorded as a rejected part. A yard behind the wing's solid side wall is left out. |
| A P0-3 adoption drops rooms the box built; the widen guard reads the raw outline | Fixed: the adopted outline is the box's cells the outline confirms, every cell the box's reading built, and the accepted parts; the guard weighs that. |
| A P0-3 note, A P2 strict-nothing vs exclusion-adopts is no disagreement | Fixed: `policiesDisagree` — either adopting and the two building more than 6 % apart. |
| B P0-3 corner legs on one line each, vouching for each other | Fixed: a leg is glazing from a WALL pier. |
| B P1-4 glazing between two posts | Fixed: a wall must stand at one end. |
| B P1-5 loose callouts | Fixed: printed over the gap only, never to either of two equal gaps; a callout on a blank or dashed gap, or read with alternatives, states a width, not an opening (WEAK). |
| B P1-6, C P1-7 parts named against the house without the accepted wing; walled terraces named garages | Fixed: an accepted part's walls are a neighbour's junction; a garage has one way in, walls on 60 % of its own perimeter and a car's depth (4.5 m). The reviewer's 3 × 3 m terrace is no longer built by the reading that shuts mouths. |
| A P1-1 the gap axis moves with crossing walls | Fixed: from jambs that run along the line. |
| A P1-2 the sliver rule changes box frames | Fixed: outline frames only. |
| A P1-3, C P1-6 the 0.8 bay guard drops real bays | Fixed: it skips only a pair standing at the side's own ends (the reviewer's 84 % conservatory is built). |
| A P1-4, C P0-2 the re-cut invents a party wall, carries a porch up two storeys | Fixed: the neighbour is never cut. A strip along a neighbour's whole side joins it (one rectangle); a band no deeper than two walls (the outer part of a wall between its axis line and its face line, a face step) along most of a side joins as the one rectangle around both, the notch it leaves no larger than the band, other pieces of the same band inside the notch taken in with it, a body's cell there stopping it. A deeper strip along part of a side — a porch, a bay — stays its own body, or is named as a sliver and not built when narrower than two walls and a room (a 1.2 m bay drawn with 0.6 m walls: −4.6 %, instead of the house cut in three). |
| B P1-7 a through-passage judged as a pocket from each end | Not fixed: judging the two mouths together needs a rule for when a corridor ends; a wrong one opens halls with a front and a back door. Bounded by the disagreement flag (the strict policy leaves both mouths open). Named in AF. |
| B P1-8 the wall-witness join | Fixed: the join uses the same infill rule (glazing inside the wall, no pattern; a single leaf line only across a door-sized span). |
| B P1-9 a corner pier read as a post | Left (the safe direction: the outline is lost, not invented). |
| A/B P2 | Left and named: the weak-gap budget order, the 3.2 m corner-leg cap, sash joints read as dashed, no corner slack, the silent 16-cap (now reported as one rejected part), a shadow line at an outer face beyond the box's edge (−2.4 % on the reviewer's case), a planter's wall-thick ink within 0.3 m of a face, a two-line balustrade (inherent in the drawing). |

**Bodies (C) — `55a9c65`**

| Finding | Disposition |
|---|---|
| P0-1 a U outline inflated into a rectangle over its courtyard | Fixed: on an outline frame a recess outside the outline is a pocket of a body only up to the pocket rule's floor (6 m², an entrance niche); a courtyard stays ground. |
| P0-2 the re-cut splits the main body; the porch rises | Fixed (above). |
| P0-3 strips as the main body and as an upper storey's target | Fixed: on an outline frame a body under a quarter of the widest body's width is neither the main body nor an alignment target. On willa-miranda this turns a false pass into an honest failure: its upper plan maps to about 3.6 × 8.6 m, 24 % of the 15 × 8.5 m main body, so under the 50 % rule no body carries it (it stood on the 1.7 m strip before). |
| Shared doors between attached bodies (found by the matrix, not a reviewer) | Fixed in the model builder: built once, from the first of the two bodies. |
| P1-4 party-wall garages still decided by reach; drawing the vehicle door removes the garage | Not fixed: `baysOf` is the box reading's, kept byte for byte where the outline adds nothing. Named in AF. |
| P1-5 a wing joined only through a door-sized opening is refused | Kept by design: the contract accepts a part that continues the box's interior across an edge with no wall and no opening; a part behind a doorway is attached, not continued, and a yard behind a door would otherwise be built. Named in AF. |
| P1-8 a double garage with a central post | Not fixed. Named in AF. |
| P1-9 the read window of a shallow projection | Not fixed. Named in AF. |
| P1-10 a registered partial basement picked as the ground storey | Not fixed (the frozen code does the same). Named in AF. |
| P1-11 a wing `baysOf` shuts, dropped by the 35 % gate | Not fixed (box frames are cut as they always were). Named in AF. |

**The matrix sent two rounds back.** The first cut of these rules (`55a9c65`) was sound on every synthetic case and
wrong on the real houses: the development matrix put dom-w-modrzykach back to its 005B box (14.72 m²) and rejected
willa-miranda (71 of 170 m²). Measured on the plans' own lines (a harness outside the repository), drawn openings fell
from 56 to 14 on one plan. Three rules did it, each right on a clean fixture: "past a jamb's far end" flagged every
window whose neighbour's glazing carries on the same rows beyond a short pier; "inside the wall" used the sheet's
typical wall where exterior walls are drawn thicker; and growing a part only through open edges and doorways split a
wing into its rooms and its wall-thickness cells. `b0013ed` narrowed the first two to what discriminates (a line
alongside a wall with ground between, or past the end of the wall line; each jamb's own thickness) and replaced the
third by the prune above.

The second round was the massing. Never cutting a neighbour dropped the wall-thickness bands an outline frame's grid
leaves between a wall's axis line and its face line (11 m² on dom-w-modrzykach, −7.1 %); allowing the old three-way
cut for them brought the area back and cut the house into columns, whose shared doors the model builder then dropped
(it built a door on a shared face only from the main body's side). `ca97516` joins such a band as one rectangle with a
bounded notch, takes the band's other pieces in with it, and builds a door between two attached bodies once, from the
first of them. dom-w-modrzykach is then 3 bodies (6 before the review), −0.14 %, every printed opening built.

The reviewers' scenarios were replayed after each round: all as in the tables.

**CI found one more, older than the review.** The known-set job (005A's sealed evidence through today's solver) had
not run to completion on this branch since the first 005C commit: runs 108–113 were cancelled by the next push. Run
114 failed it on e-OZE, and the bisection put the cause in `a1913fc`, not in the review fixes: the outspanned-axis
rule that willa-miranda needs builds e-OZE's sealed first reading at its misread 2.50 cm/px. §T gives the evidence
and why the two e-OZE rows now allow the resolver's named refusal. The same run's Android UI gate failed once on a
5-second wait in the stage sheet (`ProductFlowDeviceTest`, the default configuration; the same test passed at font
scale 1.3 in the same job); the branch's only Android change is the boundary progress strings and the outline
stop's title (`26b63e3`), nowhere near the stage sheet. It is judged on the following runs (§AC).

One earlier 005C claim is withdrawn by these fixes: with its window symbols erased, the §37 wing (3 m deep behind a
blank 5 m mouth) is no longer named a garage and no longer rebuilt by the reading that shuts mouths; both readings
now stop. A space that shallow cannot be told from a loggia, and the test now says so.

Tests: `packages/reconstruction/test/boundary-post-review.test.ts` (11) and the updated disagreement and §37 tests;
361 reconstruction tests pass.

## X. PRE_HOLDOUT_3_SHA

**`PRE_HOLDOUT_3_SHA = e328121b3aca2dfcec87db07db6277813eb04f34`**, pushed to `analyzer/opening-aware-envelope-v1` and
`claude/new-session-3kzcgh`. At it: `npm run typecheck` clean; `npx vitest run` 138 files passed, 1 skipped,
**1788 tests passed**, 9 skipped; CI run 116 (`36800959593`) green on every job, the Android UI evidence gate on its
second attempt (§AC). The tree was clean, and nothing was committed between the freeze (CI green at 02:48:17Z) and the
draw (02:49:03Z). The analyzer code at the freeze is `ca97516`'s; `e328121` adds only CI rows, records and the report.

## Y. ARCHON pool and seed

The committed round-1 pool (`holdout/pool.txt`, sha256 `800c2a1e…2ed41`) less `excluded-families-round-3.txt`
(sha256 `330e7832…cf`: round 2's 38 families and the two round-2 draws, 583 addresses): **n = 2502**.
Seed `SHA256(PRE_HOLDOUT_3_SHA + "BUILDPLAN-005C-ARCHON-HOLDOUT")` =
`7b4344ee19b52b20d0373935f7cae7fb12ff7803c128c462b6b81f570237a147`, recomputed independently; `i1 = seed mod n = 375`:
**`https://www.archon.pl/projekty-domow/projekt-dom-w-azaliach-3-ma6726144fab3e`** (family `dom-w-azaliach`, in no
exclusion file of any round). One ledger line (`BUILDPLAN-005C-BLIND-HOLDOUT-ROUND-3`) records both picks.

## Z. ARCHON result — `dom-w-azaliach`: ALGORITHMIC_FAIL

Run once, live, frozen code (280 s, peak 736 MB, longest silence 2.5 s). **Completed**: 1 body, 6 openings, model
`2cfcc6e9…`; footprint **67.26 m² against 69.69 (−3.48 %)**; every printed opening built. **Fails** two conditions of
the unchanged `verdict.mjs`: storeys 1 of 2 (the attic registers onto no body), and the plan was resolved by
hypothesis with no corroboration but the published figure.

**First bad evidence decision — in the metric layer, untouched by 005C.** On the dimensioned ground copy the first
reading chose, the overall horizontal chain is read with a spurious third tick (x = 204.5 px; the true ticks are 77
and 633), and its label, printed `1035` in italics, is read `1055` (third glyph `5` at 0.46 over `3` at 0.33) and
attached to the partial segment 204.5–633 px: sheet scale 2.46 cm/px, where the drawing's two overall dimensions agree
on 1.86 (1035 over 556 px, 670 over 359.5 px). The true vertical `670` then "cannot be reconciled with the sheet scale"
and reads nothing, the extent becomes the chains' own span (a third of the house), and the first reading has no
enclosed cell. The resolver found the house on the area-table copy at a scale departure (1.897 cm/px, −3.5 %), which
the figure chose — no witness by rule.

What 005C did on this house: on the reading the resolver kept, the long-band box held the service rooms only
(23.95 m²); the opening-aware outline continued the interior across the glazed living-room side as a
`PROJECTING_WING` (43.31 m²) and stopped at the pergola terrace beside it, which is not built. Not patched; evidence
in `artifacts/analyzer-005c/holdout/` (text only).

## AA. DobreDomy pool and seed

`holdout/pool-dobredomy.txt` (from `robots.txt` and `sitemap.xml` only; 900 addresses in 491 families, sha256
`42762070…8c5`) less `excluded-families-dobredomy.txt` (the Aster family and the 72 families its page links to, 203
addresses; sha256 `3122f477…4730`): **n = 697**. Seed `SHA256(PRE_HOLDOUT_3_SHA + "BUILDPLAN-005C-DOBREDOMY-HOLDOUT")`
= `fc19c52c3b4780af5422cdf91126e74140b87c5cbf9bb8a017ee60b68805ce8b`, recomputed independently; `i1 = 262`:
**`https://www.dobredomy.pl/projekt/galaktykaI/`** (family `galaktyka`). Eligible at the first draw by its markup
alone (a plan heading and an elevation heading, each followed by an image); nothing was burned.

## AB. DobreDomy result — `galaktykaI`: SOURCE_LIMITED_PARTIAL

Run once, live, frozen code (140 s, peak 778 MB). **Source, read by the generic reader with no DobreDomy code**:
classified a project page; 17 assets with roles (one ground and one attic plan, a site plan, elevations, renders);
**11 figures** from the page's own rows (usable area 135.1 m², footprint 145.1 m², garage 23.2 m² — the plan's own
`garaż 23,2 m²` —, height 8.9 m, pitch 42°, sloped roof 250.9 m², volume 496.9 m³, rooms 4, bathrooms 2, minimum plot
22.38 × 19.68 m); **4 documents** (outline PDF base and mirrored and DWG, fetched, signature-checked and hashed, never
parsed; the energy certificate recorded).

**Reconstruction stops by name**: `METRIC_RESOLUTION_INCONCLUSIVE` — the floor plan prints no dimension chain.
`verdict.mjs` alone says ALGORITHMIC_FAIL (it can nominate legibility only from OCR heights, and the room areas are
tall). The protocol's checklist item was measured on the raw copy: the single ground-floor copy (1625 × 1700 px),
looked at whole and at full resolution in its four margins, prints room names, room areas, furniture and the terrace
outline and **no dimension at all**; the metric layer finds 0 chains on it. "No ground-floor copy prints an overall
dimension with glyphs 10 px tall or more" holds, so with the typed stop the verdict is **SOURCE_LIMITED_PARTIAL**.
The publisher's scale is in the outline PDF/DWG, recorded and hashed, not read (no document reader in scope). One
progress residual: `METRIC_FRAMES` on this 1625 × 1700 px plan ticked 4.8 s apart (telemetry gap 5.7 s).

## AC. CI

| Run | Commit | Result |
| --- | --- | --- |
| 107 | `eef7133` | green (the last before the 005C code) |
| 108–113 | `a1913fc` … `55a9c65` | cancelled by the next push (concurrency group) |
| 114 | `b0013ed` | failed: the known-set row e-OZE (§T), the three changed development rows, and the Android UI gate once (`ProductFlowDeviceTest`, a 5 s wait in the stage sheet at the default font scale; it passed at 1.3 in the same job) |
| 115 | `ca97516` | cancelled by the next push; by then the same three analyzer rows had failed and nothing else |
| 116 | `e328121` | attempt 1: every analyzer, Android, browser and container job green; the Android UI gate failed — a Compose test-harness race in the Kosaćce slice's stage sheet (`IllegalArgumentException: Detected multithreaded access to SnapshotStateObserver`, thrown inside `performClick`) and, on the next test, a 45 s wait for the renderer at launch. Re-run once (the protocol's one re-run): **green** — the three slices and the alternate-publisher test pass (the alternate Marcówki page stops with its typed `METRIC_RESOLUTION_INCONCLUSIVE`, as designed), all 89 required screenshots valid. `PRE_HOLDOUT_3_SHA` |
| 117 | `b3ad427` (push) | cancelled by the dispatch below (concurrency group) |
| **118** | `b3ad427` | **the final CI**: `workflow_dispatch` with the OWNER APK; 30 jobs green, 1 skipped by design, the UI gate green at the first attempt (§AE) |

The three UI-gate failures were in three different test steps, all waits or a test-framework race in the emulator
(ANGLE on SwiftShader), none in the analyzer; the only Android change in the stage is two progress strings and a stop
title. They are named as a residual (AF), not explained away.

## AD. Commits

Baseline and protocol: `3e76894` (005B baseline, Aster), `e6220a9` (round-3 pools, before the freeze), `eef7133`
(pre-reviews). Implementation: `7f3f557` (boundary evidence), `a1913fc` (outline candidates), `f62cd56` (body
relations), `dfbec9f` (gable door), `1f26636` (metamorphics), `432dbd2` (generic source 1.1.0), `b70aa41` (Aster gate),
`26b63e3` (Polish progress). Matrix and report: `1b330d3`, `cfa8640`, `0575fb5`. Post-review: `2d45254` (reviews),
`64f7ff6` (source 1.2.0), `55a9c65`, `b0013ed`, `ca97516` (boundary, openings, bodies, massing), `e328121` (rows,
records, report M–W) = **PRE_HOLDOUT_3_SHA**. Blind round and report: the commit that carries this section; the APK
record: the commit after it.

## AE. OWNER APK

`https://github.com/damiankrok/BuildApp/releases/download/owner-preview-latest/BuildPlan-owner-preview.apk`,
from `workflow_dispatch` run 118 (`36808685547`), which is also the final CI: 30 jobs green, 1 skipped by design
(the `preview-latest` APK), the Android UI gate green at the first attempt.

Verified from the downloaded file, not from the notes:

| check | result |
| --- | --- |
| direct link | serves the APK itself: 30 732 715 bytes, `application/vnd.android.package-archive`; the release is a prerelease |
| SHA-256 | `eb530f7c66f6d204460dc1ad37c843ca9519d95f028a4ed337cacfa84efd5bec`, equal to the release notes and to GitHub's asset digest |
| ABI | `aapt dump badging`: `native-code: 'arm64-v8a'`; 5 libraries under `lib/arm64-v8a/` (`libnode`, the node bridge, Filament, `libc++_shared`, the graphics path) and no other ABI |
| version | `com.buildplan.preview`, **versionCode 1118**, versionName `0.118.0-preview`, minSdk 26, targetSdk 35 |
| commit / run | the notes: run 118 from `claude/new-session-3kzcgh` @ `b3ad427681f74d2fc4a0a5966370899a40bba4d3`; its analyzer code is the frozen code (`ca97516`, as at `PRE_HOLDOUT_3_SHA`) |
| analyzer | the embedded bundle (`assets/local-analyzer/analyzer.mjs`, sha256 `43d3e326…f812`, equal to its manifest; Node 18.20.4) declares `METRIC_EVIDENCE_SCHEMA_VERSION = "1.2.0"`, `PLAN_RESOLVER_VERSION = "1.3.0"`, `SOLVER_V2_VERSION = "2.3.0"`, `BOUNDARY_EVIDENCE_VERSION = "1.0.0"`, `GENERIC_ADAPTER_VERSION = "1.2.0"`, and carries `pageRegions`, `policiesDisagree`, `recutSlivers` and `BOUNDARY_RESOLUTION_INCONCLUSIVE` |
| signer | `apksigner verify --print-certs`: "BuildPlan Model Preview, Preview builds (not a production key)", certificate SHA-256 `6e48fac4…a0da`, equal to the notes; it installs over any preview build with a lower run number (1104 before it) |

No APK binary is committed.

### OWNER phone checklist

Install `BuildPlan-owner-preview.apk` over build 1104, then check each item.

1. **Progress on the outline.** Analyse any ARCHON link and watch "Odczytuję plany i rejestruję widoki": the new
   steps «sprawdzam otwory: N z M» and «łączę obrys: krawędź N z M» may flash by; "Przerwij" still stops within
   seconds.
2. **The three houses that failed in 005B now build** — check that the house looks like the publisher's plan:
   - dom-w-modrzykach (`https://www.archon.pl/projekty-domow/projekt-dom-w-modrzykach-3-g2-mdf423d61e7247`): the
     whole house with its open front of piers, glazing and the garage door; 3 bodies; about 182 m².
   - dom-w-zurawkach (`https://www.archon.pl/projekty-domow/projekt-dom-w-zurawkach-3-p-md4e2138a2d1a5`): the house
     and its garage 1.5 m forward; about 101 m²; expect "Model gotowy z ograniczeniami" (one storey only).
   - willa-miranda (`https://www.archon.pl/projekty-domow/projekt-willa-miranda-11-g2-m49324d69ef143`): the main
     body, the garage at the front, the living bay at the back; about 161 m²; one storey only.
3. **Marcówki, Kosaćce (clean and tracked) and Rarytasy (G2E, e-OZE)**: the same houses as build 1104, byte for
   byte on the desktop.
4. **Another publisher.** Aster VIII (`https://www.dobredomy.pl/projekt/asterVIII/`): "Źródło" lists its figures
   (usable 172.9 m², footprint 278.3 m², pitch 30°, height 5.9 m …), then the analysis stops with the Polish message
   that the plan's scale cannot be established — no house of invented size.
5. **If an outline cannot be decided**, the stop says so in Polish ("Nie udało się ustalić obrysu budynku: …", the two outlines and why); it
   should not appear on the houses above.

## AF. Residual debt

Named, not fixed in 005C; each is a bounded item with its evidence in the section given.

- **Storeys over an outline frame** (§M, §N). willa-miranda's upper plan maps onto a body under a quarter of the main
  body's width and registers onto nothing; dom-w-zurawkach reads three plans and no body reaches past the ground.
  Both houses are right on the ground and wrong in height; the vertical chain was not in this stage's scope.
- **The resolver and a misread overall dimension** (§T). When the first reading builds the whole house at a misread
  scale, the published figure refuses it and cannot choose the replacement, so the run stops by name even when a
  reading at an independent scale exists (e-OZE on its sealed 005A evidence).
- **Jamb-policy disagreement is recorded, not resolved** (§M, §N, `boundary-performance.json`): on willa-miranda and
  dom-w-zurawkach the strict and exclusion policies build more than 6 % apart; the exclusion reading is taken and the
  flag only names the stop when the run stops.
- **Openings**: the corner-material rule refuses a 0.40 m opening on willa-miranda's small annex (§M).
- **Boundary (post-review, not fixed)**: a through-passage judged as a pocket from each end (B P1-7); a corner pier
  read as a post (B P1-9, the safe direction); the weak-gap budget order, the 3.2 m corner-leg cap, sash joints read
  as dashed, no corner slack, a shadow line at an outer face beyond the box's edge (−2.4 % on the reviewer's case), a
  planter's wall-thick ink within 0.3 m of a face, a two-line balustrade (A/B P2).
- **Bodies (post-review, not fixed)**: party-wall garages still decided by reach in the box reading, and drawing the
  vehicle door can remove one (C P1-4); a wing joined only through a door-sized opening is attached, not continued,
  by design (C P1-5); a double garage with a central post (C P1-8); the read window of a shallow projection (C P1-9);
  a registered partial basement picked as the ground storey (C P1-10, as in the frozen code); a wing `baysOf` shuts,
  dropped by the 35 % gate on box frames (C P1-11).
- **Generic source (P2)**: a logo in the h1, gallery captions, ARIA `role=table` fact tables, the longest-paragraph
  description, failed document fetches spending the budget, `download.php?file=` links, `http:` PDFs, documents on
  crawled subpages.
- **Publishers whose plans print no dimension** (§R): Aster's scale is stated only by its 1:500 outline PDF, which
  is recorded and hashed and not parsed; a document reader is outside this stage.
- **Blind round 3** (§Z, §AB): the overall-dimension chain on a dimensioned copy — a spurious tick splitting it and an
  italic `1035` read `1055` on the partial segment — gives a wrong sheet scale that then refuses the true vertical
  overall; an attic registering onto no body on `dom-w-azaliach`; `METRIC_FRAMES` ticking 4.8 s apart on a
  1625 × 1700 px plan.
- **The Android UI gate on the emulator** (§AC): three failures in two runs, in three different steps (a 5 s wait in
  the stage sheet, a Compose `SnapshotStateObserver` race inside `performClick`, a 45 s renderer wait at launch), each
  gone on the next run; the waits and the test harness's threading are named, not fixed.

## AG. Next step

**Return to the coordinator with the round-3 ARCHON defect as BUILDPLAN-ANALYZER-005D's input: the overall-dimension
chain on a dimensioned plan copy — a tick read where none is drawn splits the overall chain, the italic `1035` is
read `1055` and attached to the partial segment, and the wrong sheet scale (2.46 cm/px where both printed overall
dimensions agree on 1.86) then refuses the true vertical overall and frames the plan from interior chains
(`dom-w-azaliach`, `artifacts/analyzer-005c/holdout/`).**

