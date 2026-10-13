# 005Q Phase A — WALL-FACE AND EVIDENCE CONTRACT (design document, no code) — key `contract`

> Phase A working draft by an independent read-only agent, committed as written (scratch paths shown as `$W`, a directory outside the repository; publisher rasters were read there and are not committed). Where it disagrees with `first-bad-boundary.md`, the disagreement is stated there.

Base: the repository at 04d5568 (HEAD d28b755 adds only `research/` + artifacts; `git diff 04d5568 HEAD -- packages`
is empty). All line numbers are `packages/reconstruction/src/*` at 04d5568 unless another package is named.
Scratch: `$W/agents/contract/` (variant `v1`, runs `runs/cfE-strong-to-box/`, census
`span_census.json` + `scripts/span_census.py`, raster crops `img/` — publisher pixels, outside the repo, never copied in).
Nothing under the repository was written. One replay at a time, `--par 1`.

Labels used throughout: **KNOWN** = reproduced here from code, sealed data or a replay, with file:line and numbers;
**INFERRED** = reasoned or read by eye from the raster, not reproduced by a run; **UNAVAILABLE** = cannot be determined
from what is here. Runs by other Phase A agents are cited by path and are KNOWN only to the extent their outputs are on
disk (`$W/phaseA/{glog,krasno,akeb,adversary}.md`, `agents/<key>/runs/...`).

This document is a contract, not a patch. It says what a face is, when the analyzer may say it has found one, what it
may then emit, and which label each emitted number may carry. It adds **no schema field**: every label below already
exists in `v2/graph.ts` (`ProvenanceStatusSchema` :140, `MeasurementMethodSchema` :74, `parameterProvenance` :165,
`unresolvedProperties` :170) or `structural-layout.ts` (`LayoutBasisSchema` :55).

---

## 0. Why a contract (KNOWN, the two houses in one paragraph each)

**dom-w-glogownikach** (frame `…0cb0a5c1d9`). The extent 78..812 × 203..553 px is right (overall chains: 920 cm over
203..553, 1930 cm over 78..812 printed on the raster; INFERRED for 1930, the selected frame never binds it). The south and
east walls are drawn as solid poché 17–18 px thick (bands 536..553 and 795..812, `probe.ndjson` CORE). Both faces of
each wall carry a chain tick: Y 536 (chain-41 "870") and 553 (chain-17 "920"); X 797.69 (chain-481-b5c, a
**fractional, solver-placed** CHAIN_CORRECTED tick 2.69 px *inside* the ink) and 812 (chain-622, DERIVED). `gridLines`
gives each band to the inner line (`plan-decomposition.ts:509`: Y by the positional third key `a.px - b.px` after a
350/350 span tie and an 8.5/8.5 distance tie; X by distance 5.81 < 8.5), `thinLines` drops the outer line
(17.000 < minCellPx 17.136; 14.31 < 17.136; `:564-583`, `:1861`), and `walledEnvelope` snaps the correctly computed
outer-face box 77.5..812.5 × 202.5..553.5 onto the inner lines (`:1244-1256`, tolerance `let gap = wallPx` = 18 at
`:1246`). The layout then labels the body MEASURED and the model labels the ring **"18.83 × 8.70 m … SOURCE_EXACT"**
(B0 `model.json` `ring-main-0`). Truth by the printed outer chains: ≈ 19.30 × 9.20 m (with a ≈ 0.47 m set-back niche at
x 438..645 on the south, `glog.md` §0).

**dom-w-krasnokwiatach** (frame `…723651b1ff`). The printed chains state 950 cm (= 270|257|423) across and 1610 cm
(= 430|780|400) down; both sides of each axis are STRONG (`extentSidesOf`, `layout.ts:503-533`). The long-band box is
only the 780 strip (155..535 × 248..559); N and S are ENVELOPE_EXTENT_CONFLICT STRONG / INCONCLUSIVE. Inside the STRONG
extent lie a walled living room (N, 262..535 × 77..248) and a walled garage (S, 365..535 × 559..718) that must be built,
**and** a post-supported NW covered terrace (155..262 × 77..248), a post-supported entrance porch (262..365 × 559..718)
and a planting strip whose shrub symbols the band reader takes as wall-thick bands (`krasno.md` §0, §4) — none of which
may be built. The same STRONG statement is a wall over one stretch of a side and open ground over another.

Both failures are the same omission: **a line in the grid does not know which face of which wall it is, and a side of
the extent does not know which stretch of it is wall.** The contract below makes both explicit.

---

## 1. Coordinate conventions

### 1.1 Frames (KNOWN)

| frame | units, axes | where defined | notes |
|---|---|---|---|
| plan pixel frame | px of the decoded variant; x right, y down; origin top-left | `Band.bounds`, `GridLine.px`, chain `ticksPx` | band bounds are inclusive pixel indices: band 795..812 is 18 px, `thickness` 18, `axisPx` 803.5 (`probe.ndjson`) |
| registration metres | `metresPerPixelX/Y`, `originPx` per frame | `walledEnvelope` `:1261-1264` | glogownikach 0.026261 / 0.026207 m/px |
| layout ladder metres | metres of each grid line, **chain statements first**, pixels × scale only where no chain speaks | `axisLadder` `layout.ts:1121-1265` | a line's metric position may differ from px × mpp (glogownikach width 18.83 m from chain sums vs 18.90 m by pixels) |
| v2 world | x right, z = 0 at the front outer plane | `v2/reconstruct-v2.ts:396-400` (`flipZ`) | |
| model ring | `createWallRing.polygon` is the **outer line** of the walls; material lies inside (left of travel on a CCW ring) | `packages/commands/src/commands.ts:143-147`, `packages/commands/src/apply.ts:290-293` | upper slabs are inset by one wall thickness from it (`v2/emit.ts:166-171`), which only makes sense if the polygon is the outer face |

Consequence (KNOWN by construction): every body edge handed to emission is read as an **outer face**. An inner-face
line handed in as an outer face builds the house one wall thickness short on that side; an axis line, half a wall short.

### 1.2 The three positions of a wall (definitions)

For a wall drawn as wall-thick ink on a line (axis ⟂ to the line's run):

- **outer face** — the edge of the ink on the side away from the building's interior on that stretch;
- **inner face** — the edge on the interior side;
- **centreline (axis)** — `Band.axisPx`, the mid-line of the ink; never a face.

In the pixel frame a face is a pixel **edge**: the outer face of band 795..812 is x = 812.5 (`axisBox` reproduces this:
803.5 + 18/2 = 812.5, `:879-890`). A chain tick is a pixel **centre** (812). The half-pixel is below every tolerance
here and is not the issue; the issue is which of the three a line is.

### 1.3 How the drawings place ticks (KNOWN from rasters and chains; generalisation INFERRED)

The code's own premise is right and is the anchor of this contract: *"A witness line is struck on a wall's FACE and a
band's axis runs down its CENTRE"* (`plan-decomposition.ts:498-503`). In the ARCHON sheets on the development set:

- **Exterior (black) chains** strike witness lines on **outer faces** of the dimensioned feature (glogownikach 920
  over 203..553 = N outer to S outer; 1930 over 78..812 = W outer to E outer). The feature is not always a wall: see §4.
- A chain may also put a tick on an **inner face** (glogownikach chain-41: 870 over 203..536, then "50" over 536..553 —
  the south wall's printed thickness), or on a **stepped facade** (the 536 tick also coincides with the set-back niche's
  outer face at x 438..645, `glog.md` §0). One tick position can be an inner face on one stretch and an outer face on
  another.
- **Interior (red) room dimensions** measure inner faces (glogownikach garage 830 inside a 920 outer: 2 × 45 cm walls;
  KNOWN arithmetic on printed numbers).
- **Solver-placed ticks** exist: a CHAIN_CORRECTED segment can end at a fractional pixel the chain solver computed
  (glogownikach 797.689655, mark class QUESTIONABLE, inside the wall ink). Such a tick was never struck on ink.

### 1.4 Anchoring a chain endpoint to a face (the rule)

A chain endpoint is anchored by **its own tick on ink**, never by an allowance added to a number:

1. Take the tick's pixel position `t` and the chain's mark class at `t` (`chain.marks[i].class`).
2. Look at the wall-solid layer (`boundary-evidence.ts:84`, opened by 0.3 wall, WALL vs POST parts) across the tick's
   line, on the stretch the chain's witness line covers:
   - wall-thick WALL ink on the interior side within a wall of `t`, no wall-thick ink on the exterior side → `t` is an
     **outer face** of that stretch;
   - ink on the exterior side, free floor on the interior side → **inner face**;
   - `t` strictly inside the ink (more than ~2 px from both edges) → **not a face** (axis or solver tick). glogownikach
     797.69 is 2.69 px inside the inner edge 795 of band 795..812 → not a face, whatever its chain says;
   - no wall-thick ink within a wall of `t` on that stretch → **no host** (§3.3); the tick dimensions something else.
3. The face type is a property of (line, stretch), not of the line: a side may be outer face on one stretch and nothing
   on the next.

Forbidden: deciding face type by adding a fixed finish/insulation/plaster allowance (e.g. "+20 cm", "+½ wall") to a
printed value and seeing what it lands on. Plaster and insulation are not drawn as separate ink in these sheets (§2), so
no allowance can be checked against the drawing; it would only make a number look consistent. The one allowance the
code already makes — `toOuterFaces` moving a **band-only** line by half a wall (`layout.ts:1616-1655`, `bandOnly` at
`:1619` requires `chainIds.length === 0`) — is consistent with this rule because it moves an *axis* to the face of
*its own ink*; it cannot help glogownikach, whose wrong lines carry chains (KNOWN by `:1619`).

---

## 2. What each construction element looks like in these drawings, and what may never become an exterior wall line

| element | how it is drawn (development set) | evidence | may it become an exterior wall line? |
|---|---|---|---|
| structural wall incl. insulation | one solid black poché band, ≈ 0.45–0.50 m (glogownikach 17–18 px at 2.62 cm/px; printed "50" for the S wall; 920 − 830 = 90 = 2 × 45) | KNOWN | yes — its **outer** edge, on stretches where it is the outer edge |
| insulation as a separate layer | not drawn separately at plan scale (no inner line inside the poché on glogownikach E wall crop) | KNOWN for glogownikach; INFERRED for the set | n/a — it is inside the wall band; never a second face line |
| plaster / finish | not drawn | UNAVAILABLE as ink | never; no allowance (§1.4) |
| inner face | the interior edge of the same poché | KNOWN | **never** as an exterior side of a body when the outer face of the same wall is evidenced; it may bound rooms |
| wall-thickness strip (between the two faces) | the band itself | KNOWN: when both faces became grid lines the strip became bodies and emission refused (`adversary` mc044/mc037, `glog` va/vf, `codemap` cfB: `RECONSTRUCTION_FAILED` / `WALL_CONSUMED`, "0.473..-0.027 m of 0.446 m") | **never** a body, room, terrace or ZONE |
| roof overhang / eaves line | dashed line beyond the walls (dom-pod-jarzabem garage roof outline; glogownikach dashed overhead line at y ≈ 553 across the niche) | KNOWN (raster) | **never**; an overhead line is TRUE_EXTERIOR_GAP by `boundary-evidence.ts` doc :32-36 ("a line that is only dashed (an overhead element)") |
| covered terrace / porch / carport | open sides, posts (small square POST parts), a roof outline; paving fill | KNOWN (krasnokwiatach NW terrace post 155..177 × 77..98; porch post 263..284 × 697..718; zurawkach porch post ≈ (455, 510)) | **never** a wall line on its open sides; posts are never jambs (`boundary-evidence.ts:15-20`) |
| terrace / paving edge | thin line, light hatch | KNOWN | **never**; "nothing here reads a line of thin ink as wall" (`boundary-evidence.ts:37-40`) |
| pergola | post rows, beam lines | KNOWN (dom-pod-jarzabem chain-55's "250" ends on the pergola post line y ≈ 116) | **never** |
| planters / shrubs / landscape | dark ink symbols | KNOWN: krasnokwiatach shrubs read as wall-thick bands (x 229..261, t 19; V band 233..238 × 624..752, len 129 "long") | **never** — the face test must use WALL parts of the solid layer and the run/thickness of a wall, and a host needs §3.1 |
| garage door / glazing between jambs | WALL jambs + infill stroke / callout | KNOWN (`OPENING_SUPPORTED`) | yes, the line **through** the jambs closes the outline as an opening, not as solid |

---

## 3. Evidence states of an exterior face (per line *and* stretch)

The unit is a **stretch**: one line segment of one side of a body between two corners or two changes of evidence.

### 3.1 EVIDENCED

All of:
- (a) wall-thick **WALL** ink of the solid layer lies along the stretch with its **outer edge** on the line within
  `snapPx` (5 px) — or the stretch is jamb-to-jamb gaps classified `OPENING_SUPPORTED` / `DRAWING_BREAK_SUPPORTED`
  between such ink (`boundary-evidence.ts` :26-36), with WALL jambs at both ends;
- (b) no wall-thick ink of the same wall continues on the exterior side within one wall (otherwise (a) found an inner
  face);
- (c) a chain tick of class TICK lies on that face within `snapPx` **and** belongs to a chain whose witness line covers
  the stretch — *or* (weaker, see §5) no tick but (a)+(b) hold over at least one wall-length of solid ink.

With (c) by a tick: **EVIDENCED_BY_TICK**. Without a tick: **EVIDENCED_BY_INK**. Both may host a wall; they differ in
the label of the number (§5).

### 3.2 CANDIDATE (may be proposed, may not be asserted)

Any one of:
- a chain tick without wall-thick ink on its line on this stretch (zurawkach S 523.5 over x 257..621; rarytasy-g2e S
  702 over x 106.5..175.5 and 402..730.5; krasnokwiatach W 155 over the N and S strips);
- wall-thick ink whose edge is not on any tick (glogownikach 812 has only a DERIVED tick; INFERRED treat as ink-only);
- a line that exists only because thinning merged it away or snapping moved something onto it (glogownikach 536 as the
  S *outer* face, 797.69 as the E face);
- a tick that is not on ink (§1.4 step 2: inside the band, or fractional solver-placed);
- a face whose only support is a CHAIN_CORRECTED / DERIVED / `dependsOnScale` value;
- piers shorter than a long band with gaps classified `UNKNOWN_GAP` (decided by the boundary solver, never by width).

A CANDIDATE may become a question, an `UNRESOLVED` parameter or a rival hypothesis (`FeatureAlternativeGroup`,
`graph.ts`); it may not move a body edge by itself.

### 3.3 NO HOST may be emitted

On a stretch where any of these hold, no exterior wall (no ring edge, no `createWall`, no return) may be emitted:
- only thin line work, dashed/overhead lines, paving, pergola lines, landscape ink, or POST parts;
- a `TRUE_EXTERIOR_GAP` (`boundary-evidence.ts:32-36`);
- the strip between the two faces of one wall (§2);
- the only reason is that a chain's end tick lies there (§4);
- the only reason is that the published footprint would agree (krasnokwiatach: a +9.5 % false scale fits 143.18 m² to
  1.6 %, `krasno.md` CFa5; the "correct walled" answer is ≈ 121 m², −15.5 %, because the published figure appears to
  include ≈ 21.9 m² of roofed open area — INFERRED).

A compartment may still be closed for **area and naming** across such a stretch by a `VIRTUAL_CLOSURE`
(005P `target-contracts.md` §5): it is never a physical wall.

### 3.4 Grid invariants that follow (design constraints, not code)

- **One face per wall per side in the exterior grid.** On an exterior side the outer face **replaces** the inner
  face as the grid line and inherits its probes; keeping both lines creates the wall-thickness strip (§2, refused at
  emission), keeping the inner one shrinks the house (B0). KNOWN: `glog` vd (outer replaces inner, inherits probes)
  → COMPLETED PASS −1.04 %; `glog` va / vf, `adversary` mc044 / mc037 (both kept) → RECONSTRUCTION_FAILED; `glog` ve /
  `adversary` outer1 (outer face by tie-break only, inner probes lost) → −18.0 %, 3 rings.
- **Face type travels with the line.** A snap may move a box edge only to a line of the same face type on the same
  stretch, within less than half a wall; a snap whose tolerance equals a wall (`:1246`) can cross the whole wall.
  KNOWN that the snap alone is not the cause: `adversary` nosnap / `glog` vb (outer-face box kept off-grid) leave the
  footprint at 163.81 m² because the grid still has no outer lines.
- **A tie is named, not broken by position** (`:509` third key `a.px - b.px` picks the inner face on max sides and the
  outer face on min sides — orientation-biased, `adversary.md` H-A).
- **A solver-placed tick is not a face.** `gridLines` counting CHAIN_CORRECTED as printed (`:478`) gives such a tick
  confidence 0.95 when a band joins it (`:535`). Note the code is inconsistent with itself here: `extentSidesOf` already
  refuses CHAIN_CORRECTED as a reading (`layout.ts:527-529`).

---

## 4. Strong printed dimensions do not imply full enclosure

### 4.1 Claim and proof sketch

Claim: a STRONG extent side (`extentSidesOf`: two chains on distinct lines whose end ticks agree within a wall, or one
READ-closing chain, `layout.ts:524-530`) establishes that **some drawn feature** has a face at `atPx` somewhere along that
side. It does not establish that the building's enclosure reaches `atPx` along any particular stretch.

Sketch: a chain's end tick needs one witness line on one feature. The draughtsman dimensions the maximum extent of the
plan's drawn features — wall faces, a garage front, a pergola post line, a porch post, a terrace slab edge — and a
stepped or L-shaped plan has a side touched by its outermost feature on only part of its length. Two chains agreeing at
`atPx` are two witness lines to the **same** feature (they agree because they end on it), so STRONG adds certainty about
*where that feature is*, not about *what lies along the rest of the side*. Enclosure is a per-stretch predicate (wall or
bridged opening on every stretch, §3.1); a single point-like statement per side cannot decide a per-stretch predicate.
Conversely, the absence of long-band wall at a STRONG side does not prove the side is open (jarzabem, below). Hence a
STRONG side is a **question per stretch, answered by ink**, never an answer. This is what the code already says in
`boundary-completion.ts:15-19` ("It never fills anything: it only lets a part that reaches the stated side be judged")
and in the `WalledEnvelope` doc (`plan-decomposition.ts:158-166`: the dimensioned extent "usually reaches past the walls
to an eaves line, a terrace edge or a plot boundary").

### 4.2 Development-row counterexamples (KNOWN chains and B0 digests; what lies there read from rasters = INFERRED)

| row (B0 verdict) | STRONG side, chains | what the side's end tick is on | stretches with no building beyond the walls | B0 decision |
|---|---|---|---|---|
| dom-w-zurawkach (PASS −0.81 %) | S at 523.5: chain-65 "800 | 150" (READ, READ), chain-36 "950" | garage south face | x 257..621: entrance porch with planters and a post; main body's S face is at 456 | INCONCLUSIVE (nothing built) |
| rarytasy-g2e (PASS −2.75 %) | S at 702: chain-70 "850 | 620" (READ, READ), chain-49 (no value) | garage front (688 wide, garage door "500/238") | x 106.5..175.5 and 402..730.5: open ground beside the projecting garage | ZONE |
| dom-w-krasnokwiatach (ALG_FAIL) | W at 155: chains 790 "270|257|423" and 817 "950" (all READ) | kitchen/dining W wall (middle strip only) | N strip 155..262: NW covered terrace (post); S strip: planting + porch | (x side not in conflict; N/S STRONG INCONCLUSIVE) |
| dom-w-krasnokwiatach | N at 77 / S at 718: chains 37 "1610", 64 "430|780|400" (all READ) | living room N wall (x 262..535) / garage S door line (x 365..535) | N: 155..262 terrace; S: 262..365 porch, ~226..262 planting | INCONCLUSIVE |
| dom-pod-jarzabem (ALG_FAIL −11.88 %) | N at 116, SUPPORTED: chain-55 "250 | 100 | 900 | 100" | **pergola post line** (black post squares at y ≈ 116–125) | the whole 250 cm strip is terrace under a pergola | RECORDED |
| dom-pod-jarzabem | S at 596, STRONG: chain-32 "1100", chain-55 | main body S facade (windows "200/140") on x ≈ 263..430 and 618..785 | x 102.5..263: the garage's apron (garage S face at 561); x 430..618: recessed entrance (back wall band 548..564) | ZONE; strip 263..785 × 561..596 UNKNOWN 14.35 m² unbuilt — this one is **real building lost**, not open ground |
| dom-w-glogownikach | (no conflict) S at 553 by chain-17 "920" | west part's S outer face; garage piers | x 438..645: niche set back ≈ 0.47 m under a dashed overhead line | n/a |

The jarzabem S row is the converse counterexample: the same STRONG side is building on two stretches and open on two
others. Any rule at side granularity is wrong on one of them.

### 4.3 Measured counterfactual: the STRONG side as the box (KNOWN, this agent's runs)

Change (scratch `v1`, the research-only CF-E of `codemap`, `plan-decomposition.ts:1865`): after `walledEnvelope`, each
STRONG `extentSides` side replaces the box's side (min/max). Nothing else.

| row | B0 | CF-E (`agents/contract/runs/cfE-strong-to-box/<case>`) |
|---|---|---|
| dom-w-zurawkach | COMPLETED PASS −0.81 %; masses 260..599.5 × 95..456 and garage 599.5..792 × 95..523.5 | **FAILED** PLAN_LAYOUT_REJECTED: "75.31 m² against the 101.7 m² … 26.0 % apart"; box 257..796.5 × 95..523.5; the garage body is lost; BUILT slivers fabricated inside the open porch stretch (599.5..657.5 × 456..523.5 and 424..453.5 × 456..523.5) |
| rarytasy-g2e | COMPLETED PASS −2.75 %; garage mass 175.5..402 × 479.5..702 | **FAILED** PLAN_RESOLUTION_INCONCLUSIVE; first reading 149.54 m² vs 189.77 (−21.2 %); box 106.5..730.5 × 167.5..702; the garage becomes a 175.5..271.5 × 479.5..522.5 sliver plus RECESS cells |

Same change by others: `codemap` cfE on krasnokwiatach → RECONSTRUCTION_FAILED; `krasno` CFb (box edge moved to a
STRONG printed tick ≥ 2 walls beyond) → 85.08 m² (−40.6 %) and **a fabricated 4.2 m² body on the shrub strip**.
Prediction recorded before running: both PASS rows lose their garage or projection, because the flood seeds every cell
outside the envelope as outside and the bays/zones logic only sees what lies beyond the box. Outcome matched (2/2 rows
PASS → FAIL). Falsifier: if any of these rows had kept PASS with no new body, the claim "STRONG side ⇒ enclosure is
unsafe" would be weakened to "unsafe on krasnokwiatach only".

---

## 5. What each emitted quantity may carry (existing vocabularies only)

### 5.1 The vocabularies (KNOWN)

- Layout: `LayoutBasisSchema = MEASURED | DERIVED | SCALED | CROSS_VIEW | ASSUMED` (`structural-layout.ts:55`).
- Graph: `MeasurementMethodSchema = PRINTED | CHAIN | REGISTERED_PIXEL | CROSS_VIEW | DERIVED | CONVENTION` (`v2/graph.ts:74`);
  `ProvenanceStatusSchema = SOURCE_EXACT | SOURCE_CORROBORATED | SOURCE_DERIVED | IMAGE_METRIC_REGISTERED |
  VISUAL_SEMANTIC | ASSUMED_FOR_RENDERING | UNRESOLVED` (`:140`); per-parameter `parameterProvenance` (`:165`) and
  `unresolvedProperties` (`:170`).
- Emission: `evidence(targetId, status, interpretation, properties?)` already takes a per-property status map
  (`v2/emit.ts:101`, used at `:395`).

There is no `VISUAL_APPROX` in the code (grep: no match). Its intended meaning maps to `VISUAL_SEMANTIC` (existence and
kind from images, no metric) or, when an image is registered metrically, `IMAGE_METRIC_REGISTERED`. Neither is ever
exact.

### 5.2 Mapping table (the contract)

| evidence for one body dimension (a face pair on one axis) | LayoutBasis | MeasurementMethod | ProvenanceStatus |
|---|---|---|---|
| both faces EVIDENCED_BY_TICK as **outer** faces of this body's own walls, and one chain states exactly that pair with **READ** segments only (one segment, or contiguous READ segments) | MEASURED | PRINTED (one segment) / CHAIN (sum of READ segments) | **SOURCE_EXACT** |
| as above and a second chain on a distinct baseline, from a different correlation group, states the same pair | MEASURED | CHAIN | SOURCE_CORROBORATED |
| faces EVIDENCED, but the statement includes a CHAIN_CORRECTED / `dependsOnScale` value, a DERIVED segment, or a value re-read by the resolver (`rereadEvidenceIds`) | DERIVED | DERIVED | SOURCE_DERIVED |
| faces EVIDENCED, but the printed pair is a different pair (outer–inner, inner–inner, room dimension) and the pair is completed by a printed or ink-measured wall thickness | DERIVED | DERIVED | SOURCE_DERIVED |
| faces EVIDENCED_BY_INK only; distance = pixels × registered scale | SCALED | REGISTERED_PIXEL | IMAGE_METRIC_REGISTERED (never SOURCE_EXACT) |
| at least one face only CANDIDATE | not a body dimension; if a body must still be emitted it is a rival or carries the side as unresolved | CONVENTION | parameter UNRESOLVED (+ `unresolvedProperties`), or ASSUMED_FOR_RENDERING if drawn at all |
| a stretch in NO HOST state | nothing emitted as wall | — | — (a VIRTUAL_CLOSURE may close area only, never as a ring edge) |
| from elevations / renders only | CROSS_VIEW | CROSS_VIEW | IMAGE_METRIC_REGISTERED (registered) / VISUAL_SEMANTIC (existence only) |

Composition rules:
- A ring's status is the **weakest** of its two axes; per-axis status goes in the per-property map (`width`, `depth`).
  A ring is SOURCE_EXACT only if both are.
- A body edge that a snap or thinning moved off its tick inherits **no** chain statement for that face.
- `SOURCE_EXACT` is a lock, not decoration: `v2/verify.ts:280` refuses to let a view correct a SOURCE_EXACT /
  SOURCE_CORROBORATED value; `v2/reconstruct-v2.ts:1380` counts SOURCE_EXACT as HARD. Over-labelling therefore blocks
  later correction (INFERRED consequence for rings; KNOWN for openings).

### 5.3 What the code does today against this table (KNOWN)

1. `axisLadder.valueOf` (`layout.ts:1136-1145`) returns the cited evidence's value whatever its origin; `statements`
   (`:1148-1170`) sums DERIVED and CHAIN_CORRECTED segments as statements; `span` (`:1172-1190`) sets `stated: true`;
   `basisOf` (`:1859`) → MEASURED. glogownikach width: chain-622 from 78 to tick 795 (|795 − 797.69| ≤ tolerancePx 9,
   `:1703`), **8 segments: 7 DERIVED from the scale + "501→541" substitution**, 1882.9 cm, MEASURED. Depth: chain-41
   "810→870" substitution over 203..536 — an N-outer/S-inner pair — MEASURED.
2. `v2/reconstruct-v2.ts:406`: MASS feature SOURCE_EXACT iff `widthM.basis === 'MEASURED'` (depth not consulted).
3. `v2/emit.ts:191`: ring evidence `'SOURCE_EXACT'` **unconditionally**. Measured counterfactual by `codemap`
   (`agents/codemap/runs/cfD3-ladder-no-derived`, the ladder made to refuse DERIVED segments; variant diff not preserved,
   so the exact change is INFERRED from the label): ring "18.89 × 8.70 m … SOURCE_EXACT" — the width became a scaled
   number and the label did not move.
4. Census (this agent, `span_census.json`; an offline Python replica of `statements`/`span` applied to the B0 masses of
   each completed row's selected frame; replica validated against the KNOWN glogownikach MASS_SPAN probe in `glog.md` §4;
   mass↔ring correspondence INFERRED): **40 SOURCE_EXACT rings on 24 completed rows; of 40 masses, only 7 rest on
   READ-only statements on both axes** (morelach mass-0, willa-miranda mass-0, zurawkach mass-0, tunbergiach mass-0,
   A06 mass-0, A07 mass-0, miniaturka mass-0). Per axis (80): READ single 23, READ sum 7, includes a substitution 21,
   includes DERIVED 9, **no chain at all (SCALED) 20** — e.g. dom-w-modrzykach's three masses and dom-w-helikoniach's
   mass are SCALED on both axes and their rings are SOURCE_EXACT. None of the 7 was checked for outer–outer face pairs.

So the contract is violated by labelling on most completed rows, independent of the face error; a face fix alone will
still ship SOURCE_EXACT on numbers the drawing never printed.

---

## 6. Counterfactual register (each causal claim, its falsifier, and the measured result)

| claim | minimal change that would flip it | run | result |
|---|---|---|---|
| glogownikach Y: the inner face takes the band by a positional tie-break | third key of `:509` reversed | `glog` ve, `adversary` outer1 | Y line becomes 553 (KNOWN); footprint −18.0 % (probes 517..534 lost) — causal for the line, not sufficient for the house |
| glogownikach: thinning loses the outer face | minCellM 0.44 / 0.37 | `adversary` mc044, mc037; `glog` vf; `codemap` cfB | outer faces kept; RECONSTRUCTION_FAILED (WALL_CONSUMED) — both faces as lines ⇒ wall-strip bodies (005P's "≈172–173 m²" falsifier is refuted end-to-end) |
| the snap crosses the wall | snap tolerance ½ wall / 0.6 px | `glog` vb, `adversary` nosnap | envelope on outer faces but footprint unchanged 163.81 m² (grid lacks the outer lines); 3 PAVED terraces disappear |
| one outer line per wall fixes the face error | outer line replaces inner, inherits probes | `glog` vd | PASS −1.04 % (176.29 m²) |
| ring SOURCE_EXACT does not depend on what the width rests on | ladder refuses DERIVED | `codemap` cfD3 | label unchanged, width 18.83 → 18.89 m |
| STRONG side ⇒ enclosure is unsafe | STRONG sides replace the box | this agent cfE (zurawkach, g2e); `codemap` cfE (krasnokwiatach); `krasno` CFb | 2/2 PASS → FAIL; krasnokwiatach FAILED; fabricated shrub body 4.2 m² |
| published footprint cannot certify enclosure | fit 143.18 m² | `krasno` CFa5 arithmetic | a +9.5 % false scale matches to 1.6 % |
| `toOuterFaces` cannot repair glogownikach | resolver `faces: 'OUTER_FACE'` | not run | INFERRED from `layout.ts:1619` (`bandOnly` needs no chain; 536 and 797.69 carry chains) |

---

## 7. Disagreements with 005P

1. **The 005P falsifier "minCellM 0.44 keeps line 553 and restores Y (≈172–173 m²)" is wrong end-to-end** (KNOWN, four
   independent runs above): keeping both faces makes the wall strip a body and emission refuses. The contract states the
   reason: thinning has a legitimate job (one line per wall); what is wrong is that it keeps the *inner* line on an
   exterior side.
2. 005P's cross-cutting root names "snap tolerance equal to a wall thickness". By itself the snap is not causal for the
   footprint (vb/nosnap). The root is **face-type-blind lines**; the snap only exposes it.
3. 005P's ring note ("8.70 is the inner-face 870") understates the label problem: the width 18.83 m rests on **no READ
   value at all** (7 DERIVED + 1 substitution), `emit.ts:191` labels every ring SOURCE_EXACT, and across 24 completed
   rows only 7/40 masses rest on READ statements on both axes (§5.3).
4. 005P's NEXT (commit message of 04d5568: "the walled envelope reconciled with a STRONG printed chain extent") must not
   be implemented as moving the envelope to the STRONG extent: §4.3 breaks 2/2 PASS rows and fabricates a body on
   krasnokwiatach. Reconciliation is allowed only per stretch, by ink (§3).
5. 005P's jarzabem diagnosis ("no grid lines at the porch jambs … the envelope seals at an interior line") is compatible
   but incomplete for this contract: the S strip 263..785 × 561..596 (14.35 m², UNKNOWN, unbuilt in B0) is the main
   body's real S facade on two stretches and open (apron, recessed entrance) on two others (INFERRED from raster).
6. 005P calls 541/870 the right readings. The values match the raster, but the sealed metric evidence records them as
   CHAIN_CORRECTED substitutions ("501→541", "810→870", and "420→920" for the overall depth) with
   `dependsOnScale: true`. By this contract a correct value with substitution provenance is SOURCE_DERIVED unless an
   independent confident reading of the same ink is carried with it (which 005P's `MetricStatementView` would do).

---

## 8. Design implications (constraints a safe fix must and must not satisfy)

Must:
1. Give every exterior grid line a face type per stretch (outer / inner / axis / not-a-face), decided by the tick's
   position against the wall-solid ink (§1.4), and keep **exactly one** line per wall per exterior side: the outer
   face, replacing the inner one and inheriting its probes (vd).
2. Decide enclosure per stretch: EVIDENCED faces and OPENING_SUPPORTED jamb-to-jamb gaps close; CANDIDATE faces ask;
   NO-HOST stretches stay open (§3).
3. Treat a STRONG extent side as a per-stretch question; it may admit a part for judgement (as `boundary-completion`
   already does) but never move an envelope edge by itself (§4.3).
4. Label each body dimension by §5.2 and make the ring label the weakest axis; derive `emit.ts:191` and
   `reconstruct-v2.ts:406` from the per-axis basis; count CHAIN_CORRECTED / DERIVED / re-read values as DERIVED in
   `axisLadder` and in `gridLines` confidence.
5. Be re-run on the PASS rows whose STRONG sides are legitimately open (zurawkach, rarytasy-g2e) and on the rows whose
   stepped sides are real building (jarzabem, krasnokwiatach) as mandatory controls.

Must not:
1. Keep both faces of one wall as grid lines (wall-strip bodies; emission refuses).
2. Snap across a wall (tolerance ≥ ½ wall) or between lines of different face type.
3. Break a face tie by pixel order; name it instead.
4. Treat a solver-placed or inside-ink tick as a face, or CHAIN_CORRECTED as printed.
5. Read landscape ink, posts, dashed/overhead lines, paving edges or pergola lines as a host.
6. Use the published footprint, a typical wall/finish allowance or a STRONG side to create a wall, terrace or room.
7. Emit SOURCE_EXACT for anything SCALED, DERIVED, substituted, or measured between a mixed face pair.

UNAVAILABLE here: plaster/finish thickness (not drawn); whether the publisher's "powierzchnia zabudowy" counts roofed
porches/terraces (one number, INFERRED from krasnokwiatach arithmetic); the face semantics of a tick where an inner face
of one stretch coincides with the outer face of a set-back stretch (glogownikach 536) cannot be settled by the chain
alone — only by the ink on each stretch.
