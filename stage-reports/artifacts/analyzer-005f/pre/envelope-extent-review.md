# 005F pre-review C: envelope and extent consistency (`ENVELOPE_EXTENT_CONFLICT`)

Reviewer C. I did not change the repo. Scratch is in `/home/user/BuildApp/.cache/pre-c5f/`: probes (`probe.ts`,
`sides.ts`, `inbox.ts`, `lines.ts`, `tiles.ts`), a prototype (`rsrc/`, a patched copy of `packages/reconstruction/src`,
driven by `proto.ts`) and tests (`rtest/`: the 005C boundary tests plus a new `extent-conflict.test.ts`). Views and logs
are in `/home/user/work005f/views-pre-c/`. Numbers come from the cached bytes with the frozen code and each run's own
registration. Published areas were read only through `holdout/verdict.mjs` after a run.

## 1. Summary

- Nothing compares the chain extent with the walled envelope. A strip the chains measure beyond the long-band box is
  a ZONE by doctrine (`layout.ts` `zonesOutsideEnvelope`: "never as building").
- A body beyond the box can be built only by `adopt` (continuation across an edge with no wall and no opening) or
  `baysOf` (reach ≥ max(4 walls, 1.5 m)). Neither reads a chain.
- The dom-w-morelach east bay fails both: it is 1.0 m deep, and its kitchen junction reads as a STRONG "vehicle door",
  so the junction is closed and `continuesAcrossM` is 0.
- A generic conflict rule fixes it: a strong chain-stated side at least 2 walls beyond the box, plus an enclosed
  component reaching that side that is walled (no posts), has its own window or vehicle door, opens into the box and
  has two return walls.
  - dom-w-morelach frame built area: 101.11 → 110.56 m². The 12 scaled development frames: unchanged.
  - All 78 boundary, body and decomposition tests pass (every 005C terrace, pergola and canopy negative), plus 7 new
    synthetic cases.
- **P0 for the coder, from the whole-house prototype run: mass re-tiling.** Footprint is 111.18 m² (−2.93 %, holds),
  but storeys drop from 2/2 to 1 vs 2 (`LAYOUT_NO_MASS_REACHES_UP`): largest-first tiling merges the garage into the
  main body. Do not ship without mass stability (§4.6).

## 2. Findings

**P0-1. The extent can never challenge the box.** `decomposeCore` uses the extent only to filter bands and bound the
shadow grid. `walledEnvelope` takes long bands only (≥ 2.5 walls). The extent/box difference becomes zones
(`layout.ts:1331`). `adopt` accepts a part beyond the box only when `across > 0`, an edge with no wall and no bridged
opening (`plan-decomposition.ts` ~2631), so a bridged junction is never a continuation.

**P0-2. Accepting a part re-tiles the masses (whole-house prototype on dom-w-morelach).** Before: main 253–609.5 ×
208.5–739 and garage 61–253 × 263–590. After: 61–609.5 × 263–667 (garage plus main), 253–618 × 667–739,
253–609.5 × 208.5–263, and the bay. The attic plan covers no mass any more (storeys 2 → 1); openings 24 → 17,
terraces 3 → 0. Walled-first tiling of the same decomposition does not recover the split either (`tiles.ts`).

**P1-1. The bay junction is misread as a vehicle door.** The gap (X=609.5/618, y 438–568, 2.64 m, LEAF_FACE) trips
`boundary-evidence.ts:465` (LEAF_FACE ≥ 2.2 m between along-the-wall stretches). The line is the main facade's face
line drawn across the opening (a lintel or beam line). A vehicle door with a 1 m deep enclosed space behind it and a room
on the other side contradicts `VEHICLE_DEPTH_M = 4.5`. Owner: the boundary workstream; the conflict rule does not need
this fix.

**P1-2. Space the outline encloses inside the box is dropped (garage south strip, 5.93 m²).** The incumbent `linesY`
(208.5 263 288.5 360.5 415 544 590 739) have no line at the garage's south wall: the wall is piers at x 61–100 and
220–275, y 657–679 (band 32 px), and chain-vertical-320 (ticks 584/667/686/707/716) is unread. Cell 61–253 × 590–739 is
half garage and classed OUTSIDE. Candidate B closes the garage at y 667 through the 2.38 m vehicle door (DASHED →
UNKNOWN_GAP/WEAK, bridged by the pocket rule: exposed 19.4 m², limit 14.1). `adopt` writes final cells only when a part
beyond the box is accepted (`any`), so the gain is lost and the record's "the outline adds nothing the box leaves open"
is false. STRICT encloses 0 m² of the strip. Development in-box gains with no adoption: kosacce 1.05 m² (thin),
dom-w-morelach 5.93 m², 0 elsewhere.

**P1-3. Candidate B leaks to 39.7 m²** through two openings read as DASHED (pattern across → TRUE_EXTERIOR_GAP): the
north window "116/230" (Y=208.5, x 551–601, 0.99 m) and the entrance door "100/210" (Y=739, x 411–460, 0.97 m). The
flood drowns rooms 1–6 and B keeps only the garage column and strips. The bay does not depend on this (`final` keeps
`builtA`), but it is why both policies "adopt nothing".

**P1-4. Face strips between box face and grid; willa-miranda's −5.07 % is not an extent conflict.**
- dom-w-morelach: box x1 = 609.5 is snapped to the first tick of a local 54 px chain (chain-horizontal-697). The wall
  axis is 607, the outer face 618, and 618 exists only as a shadow line. Loss ≈ 0.17 m × 10.75 m ≈ 1.8 m².
- willa-miranda: box y1 = 519.3 but the last incumbent `linesY` is 501, more than one wall away, so the face stays
  unsnapped and no cell covers it. The main mass stops at 501; the ~4–5 m² south wall strip outside the garage span is
  lost or left as dropped slivers, most of the 8.6 m² deficit. Its extent sides are all explained by built wings (§5).
- Fix: add the box's own face line to the grid when it lies more than half a wall from every line.

**P2.** `continuesAcrossM: 0` and "box stands" hide why a part was rejected: record the failed guard. The
dom-w-morelach wall witness is only the west half of the house ([61,182..399,656]), so `coversWitness` is nearly free
there. Bump the boundary version (`1.0.0`) when the rule lands.

## 3. dom-w-morelach trace (frame `rzut-63ae7d4e86`, wall 16.75 px = 0.34 m, mpp 0.019801/0.02027)

**Extent [61,208.5..670,739], DIMENSION_CHAIN_EXTENT on both axes.** Side 670 is stated by two EXTERIOR,
witness-covering chains whose baselines are 29 px apart (two distinct lines): chain-h-131 (overall 1212; ticks 61…670;
closes; one READ segment "380"; end mark QUESTIONABLE) and chain-h-160 (380/732/100; ticks 61, 252, 339, 355, 385, 618,
671; unread; label "100" bound PRIMARY on its last segment 618→671).

**Box stops at 609.5.** East long bands are V axis 607 (596–618 × 325–414 and 591–669); `axisBox` gives 615.4, snapped to
609.5. The bay's own walls are not long bands: H 619–645 at y 415–437 and 568–590 are 27 px (minimum 41.9), and the east
pieces are 43 px each, broken by the window. `baysOf`: reach 60.5 px < minOut 74 px (1.5 m), so bays is `[]`.

**Shadow grid in x 609.5–670, y 323–716.** x: 609.5 (local chain tick), 618 (shadow, chain-160 tick, the true main
face), 646 (local chain-502 tick, the bay's inner face), 670 (chain-131 end, "no wall drawn on the line"). y: shadow
323, 406, 436.5, 568, 667, 686, 707, 716; incumbent 415, 544, 590.

**Bay perimeter (wall lines).**

| Line | Wall pieces | Gaps |
|---|---|---|
| X=670, outer face | 415–458, 548–591 | 458–548, 1.82 m, LEAF_FACE → UNKNOWN_GAP/WEAK, left open as a pocket mouth (exposed 0.8 ≤ 8.3 m²) |
| X=646 | 415–465, 538–591 | 465–538, 1.48 m, GLAZING, STRONG (the 180/140 window) |
| North: Y 406/415/436.5/448.5 | 596–669 | — |
| South: Y 568/590 | 596–669 | — |
| Junction: X 609.5/618 | 325–438, 568–670 | 438–568, 2.64 m, LEAF_FACE STRONG (the "vehicle door"); 670–716, 0.93 m, GLAZING |

**Why `adopt` rejects (`continuesAcrossM: 0`).** Every shared edge is closed by wall, the STRONG "vehicle door" or
glazing, so `across` is 0. The extension is 30 cells, 4.20 m² (STRICT = EXCLUSION). `classifyBodies` names it
FLUSH_ATTACHED (junction 7.97 m, 55 % wall; sides 11.31 m, 75 % wall). Its rect, 609.5–670 × 323–716, is taller than
the bay because the component includes the 8.5 px face strip along the whole east wall.

## 4. Contract: `ENVELOPE_EXTENT_CONFLICT`

Evaluate this inside `boundaryExtension`, after the 005C reading. It runs per extent side s ∈ {W, E, N, S}, at
coordinate `e_s`. It is pixels and chain geometry only: no printed value and no published figure.

### 4.1 C1: a physical extent statement

- **SUPPORTED:** provenance is not WALL_GEOMETRY_EXTENT, and at least one chain states the side: role EXTERIOR,
  `coversWitness`, end tick within one wall of `e_s`, end mark not REJECTED. OUTER_TOTAL_MARKS counts as stated.
- **STRONG:** SUPPORTED plus either two or more such chains with baselines more than one wall apart whose ends agree
  within one wall, or one such chain that closes with a READ or CHAIN_CORRECTED segment.
- **Never stated:** INTERIOR chains, chains not covering the witness, wall-witness frames, site plans.
- Only STRONG acts. A SUPPORTED conflict is recorded only.

### 4.2 C2: the box stops materially inside

`dir·(e_s − box_s) ≥ 2·wallPx`. On the development set every non-conflict side is ≤ 0.95 walls (alt-marcowki S 0.95,
kosacce E 0.46, zurawkach E 0.32, dabecjach E 0.32) and the smallest real strip is 2.19 walls (marcowki), so the bound
falls in an empty band. A strip under two walls holds only the wall itself: the face-strip problem (P1-4), not a body.

### 4.3 C3: the conflict lives only where nothing built explains it

Split the side into stretches, at least 2 walls long, where no BUILT cell (after the 005C adoption) lies within one
wall of `e_s`. At most 2 stretches per side, longest first; the rest are recorded as capped.

### 4.4 Body evidence in a stretch

A candidate component K is a connected set of cells, enclosed by the outline, beyond the box, inside the stretch. It
counts only if all of E1–E5 hold under both jamb policies, or under EXCLUSION with STRICT agreeing on K within 6 %.

| Guard | Requirement (measured values) |
|---|---|
| E1 reach | K's outer edge is within one wall of `e_s`. K explains the statement; the analyzer never fills the strip. |
| E2 fabric | K is enclosed (closed edges only) and the POST share of its outer perimeter is < 0.1. A pier ring, a column or a terrace on posts fails. Measured: dabecjach 0.91–1.00, shed 1.00. |
| E3 face | WALL ink (not POST) on the extent line over K's span is ≥ 1 wall. dom-w-morelach: 5.1 walls. |
| E3o own opening | K's outer perimeter carries a STRONG GLAZING gap or a vehicle door (LEAF_FACE ≥ 2.2 m). A door or gate alone does not count: a yard has a gate, not a window. |
| E4 connection | Junction with box cells, minus its wall share, is ≥ 0.7 m (one door). The junction may be an open stretch or any bridged opening. Passing cases: dom-w-morelach 3.61 m; synthetic 3.80 and 1.00. Failing cases: planter, yards, marcowki pocket, miranda and zurawkach residuals, all 0.00–0.06 m. |
| E5 returns | At least 2 perpendicular wall lines in K's span whose WALL ink covers ≥ 75 % of the strip depth, more than 1.5 walls apart. |

Score-only evidence: a room label or region inside K, or an existing FLUSH_ATTACHED enclosed body equal to K. Labels
are not required (the bay's label "5" sits inside the box).

### 4.5 Hypotheses and decision (deterministic)

- **Hypotheses:** H0 (BOX_STANDS) always; H_K = H0 ∪ K for at most 2 components per stretch, ranked by guards passed,
  perimeter support (wall plus STRONG-opening share), STRICT enclosure, then cell index. K adds exactly its cells with
  the existing kept-propagation through open edges and openings, never the strip rectangle.
- **Decision per stretch:**
  - `ACCEPTED(K)`: C1 STRONG; C2, C3, E1–E5 hold; `area(K)` ≤ 0.5 × incumbent built area (dom-w-morelach 4.2 / 101 m²;
    larger means the box is the wrong object → INCONCLUSIVE); no other passing component overlaps K.
  - `AMBIGUOUS`: two overlapping passing components. Name both, build neither.
  - `ZONE`: no component, no WALL ink on the extent line; only posts, line work or a COVERED_TERRACE body.
  - `INCONCLUSIVE`: wall-thick fragments present but nothing passes.
- **Caps:** at most 4 conflicts per plan (one per side), 2 stretches per conflict and 2 hypotheses per stretch, so at
  most 16 component evaluations (fits `MAX_EXTENSIONS = 16`). The two outline floods are already paid for; the whole
  probe takes about 4 s per frame including decode.
- **Negative (hard):** with no passing component, nothing is built and the conflict is recorded as ZONE or
  INCONCLUSIVE. Neither refuses a run on its own (else dom-w-jablonkach's terrace regresses a PASS); a run refused for
  another reason cites it.

### 4.6 Mass stability (mandatory, from P0-2)

An accepted K becomes its own mass, ATTACHED to the mass it opens into. An in-box gain extends an incumbent mass only
along that mass's whole side; otherwise it is a separate mass, or dropped if it is a sliver. Incumbent masses are never
re-tiled. Acceptance check: storeys equal the labelled plans on every development house and on dom-w-morelach.

### 4.7 Separation and recording

- Decide in `decomposePlan`, before the resolver. Never hand H0 and H_K to the resolver as two readings, so the
  published-footprint scoring (`plan-resolution.ts` `bucketOf`) can never choose the envelope.
- Record `boundary.extentConflicts[]` (side, gap in m and walls, strength, chain ids, stretches, each K with its E1–E5
  values and decision) and timeline events `ENVELOPE / extent-conflict:<side> → ACCEPTED|ZONE|INCONCLUSIVE|AMBIGUOUS`.
- Bump `BOUNDARY_EVIDENCE_VERSION`. Update the `zonesOutsideEnvelope` doctrine: a strip is building only via ACCEPTED.

## 5. Measurements on the development set

Extent vs the incumbent long-band box (`sides.ts`; 11-envelope's `longBandBox` is the final envelope when the outline
was adopted, so I recomputed it). Sides with a gap under 0.5 walls are omitted.

| House | Extent / box | Gap (m, walls) | Strip evidence | Raised? Right or wrong |
|---|---|---|---|---|
| dom-w-morelach | [61,208.5,670,739] / [61,208.5,609.5,739] | E 1.20 m (3.6 w), STRONG | bay component passes E1–E5 | raised; RIGHT; accepted, 101.11 → 110.56 m² |
| marcowki | [58,221,514,773] / [58,259,514,735.5] | N 1.01 (2.2), S 0.99 (2.2) | COVERED_TERRACE 7.0 and 11.0 m²; walled pockets 0.96 and 0.94 m² with all-wall junction | not raised: chain v-547 does not cover the witness. Forced: WRONG (terraces); pocket fails E3o and E4 |
| dom-w-jablonkach | [83.5,56.5,604.5,663] / [83.5,237,602.5,663] | N 3.81 (9.0), STRONG | nothing enclosed; COVERED_TERRACE posts 0.85 | raised; WRONG; ZONE, no body |
| rarytasy-g2e | […,702] / […,479.5] | S 6.12 (15.9) | garage bay already built (38.3 of 105 m²) | explained; RIGHT, already built |
| willa-miranda | [234.5,84.5,794,610.5] / [234.5,184.4,794,519.3] | N 2.66 (8.3), S 2.43 (7.6) | wings built (18.6 and 15.5 m²); residual components fail E3o/E4 and E3/E4/E5 | explained. The −5.07 % is the face strip (P1-4) |
| dom-w-zurawkach | [257,95,796.5,523.5] / [260,95,792,456] | S 1.50 (4.8) | wing built 5.7; UNKNOWN 6.7 m² open (porch); walled 0.72 m² | explained; residual fails E3o and E4 (its FAIL is storeys) |
| dom-w-modrzykach | [46,113,719,535] / [46,113,719,184.5] | S 9.63 (21.9) | outline wing 147.8 m² built | explained (PASS kept) |
| dom-w-azaliach | [77,159.5,633.5,519] / [174,267.5,523.5,443.5] | W 1.81, E 2.05, N 2.01, S 1.41 (6.9–10 walls) | outline leaks: 0, 0.59 and 0 m² enclosed on W/E/N; S wing built | not raised (no covering chain). RIGHT in reality (piers and glazing), so INCONCLUSIVE; refused anyway |
| dom-w-dabecjach | [153,50.5,718.5,635] / [329,159,715,461] | W 4.95 (16), N 3.05 (9.9), S 4.90 (15.8) | W: glazed living room, 2.71 m² facade-strip component fails E4 and E5. N: pergola. S: garage built | W RIGHT but INCONCLUSIVE; N WRONG (ZONE); refused anyway |
| kosacce, rarytasy-eoze, tunbergiach, alt-marcowki | box ≈ extent (kosacce E 0.46 w); alt-marcowki's extent is wall-geometry | — | — | not raised |

Not probed: aster-viii and galaktyka (no scale), the eoze-legacy and kosacce-area variants (no observation graph).
Prototype (`proto.ts`): built area is identical on all 12 scaled development frames, and stays identical when any single
guard among E3o, E4 and E5 is relaxed, because every rejected component fails at least 2 guards.

## 6. Negatives, risks and tests

**005C negatives stay green: 78/78.** I ran them with the prototype and C1 sides from their own chains, which are READ
and closing, so every side is STRONG (the worst case). Files: `boundary-envelope.test.ts` (§36 #9 terrace on posts, #10
pergola, #11 loggia, #15 courtyard; §38; §39 covered terrace; §40 decorative outline), `boundary-post-review.test.ts`
(paving line, tile pattern, pergola glazing, terrace beside wing, walled yard with gate, yard behind house, 3×3 m
terrace), `attached-bodies.test.ts` (COVERED_TERRACE, planter, shed). The terrace, pergola, canopy, decorative and paving
cases have no enclosed component beyond the box at all. Only three cases evaluate one, and each fails ≥ 2 guards:
planter at 2.00 walls (E3o, E4), yard behind the house (E3o, E4), shed (E2, E3, E3o, E4, E5).

**Tests to add** (prototype `rtest/extent-conflict.test.ts`, 7/7 pass). Built: open junction (005C, unchanged), a face
line across the junction (only via the conflict), a door junction with a glazed face. Not built: solid junction, only a
door or gate on its own face, a canopy on posts under a strong chain, no chain reaching it. Plus the §4.6
mass-stability check on dom-w-morelach.

**Risks.**
- Label misbinding can overstate "read and closes" (chain-131's "380" belongs to chain-160), so the two-distinct-chains
  test should lead.
- E4 accepts any STRONG bridge. A garage joined by a personal door is built only if it has its own window or vehicle
  door; that is intended, a garage is footprint.
- A glazed walled yard with a door from the house would pass, but needs house-thick garden walls, glazing and an
  overall chain over the yard. None in 16 houses; keep it as an adversarial test.
- P1-1 alone (vehicle-door depth) would let the 005C rule accept the bay, and through `final` the in-box garage strip,
  just as the prototype does. P1-2 alone recovers only the garage strip, needs the same mass-stability guard, and moves
  kosacce +1.05 m² (−1.33 % → ~−0.7 %). The conflict rule is still needed where no junction misread is involved.
