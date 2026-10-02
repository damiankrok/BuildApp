# 005F pre-review D — attached body / bay completion (FLUSH_ATTACHED, garage end, terrace negatives)

Reviewer D, read-only. Scratch: `/home/user/BuildApp/.cache/pre-d5f/` (`probe.ts` grid/cell/edge dump, `leak.ts` flood path,
`rule.ts` + `run-rule.ts` the proposed rule as a read-only evaluator over `boundaryExtension`'s lines/walls/outline,
`synth.ts` 42 synthetic fixtures, `dev-final.txt`). Local views only in `/home/user/work005f/views-pre-d/`. The probe
reproduces the sealed records byte for byte (body-0 4.203308 m², J 0.547074, S 0.746975; candidate B 140 cells / 39.7 m²);
the boundary modules are unmodified in the working tree. Pixels are the 853² plan `rzut-63ae7d4e86` (1.9801 × 2.0270 cm/px,
W = wallPx 16.75).

## 1. Findings

**P0-1 The kitchen bay is enclosed but cannot be adopted, for two independent reasons.**
`adopt` accepts a part beyond the box only if `across > 0`: a neighbour cell that is in the box AND inside the outline,
across an edge that is NOT closed. On Morelach both fail:
- (a) the junction is *closed*: line X@609.5 (the box edge) has wall pieces 325–438 and 568–670 and between them a
  2.64 m gap 438–568 classed `OPENING_SUPPORTED / STRONG / LEAF_FACE`, jambs WALL/WALL — `classifyGap`'s "vehicle door"
  branch (one continuous in-wall line at a face, ≥ 2.2 m). The line is the kitchen counter front drawn across an open
  junction. Bridged ⇒ `edge.closed` ⇒ not a continuation. (So: not "an open edge", and not "a wall line with pieces" —
  a wall line whose 2.64 m hole is read as a drawn opening.)
- (b) the box interior beside it is *outline-open*: candidate B encloses 140 of 405 cells (39.7 of 116.8 m²). Flood path
  (`leak.ts`): border → cell (14,26) x 433–609.5 y 716–739 → up column 14 → kitchen (14,15). Entry: Y@739 gap 411–460
  (0.97 m, `TRUE_EXTERIOR`, DASHED, jambs POST/WALL) — the front door, whose left jamb 370–411 (41 px = 2.45 W ≤ 2.5 W)
  the solid layer calls a POST. Even with (a) fixed, `inA ∧ inside` is false on every junction cell.

**P0-2 The garage end is not a body problem and the outline already has it right; `adopt` throws it away.**
- The garage is inside the box (box y1 = 739), so `classifyBodies` never sees it (when nothing is adopted the house is
  `inA`, every box cell). OPEN_MOUTH_GARAGE / the shut-mouth reading are irrelevant here.
- Why mass-1 stops at y 590: the incumbent grid (`linesY` 208.5, 263, 288.5, 360.5, 415, 544, 590, 739) has no line
  at the garage's south face (wall y 657–679; its only band is H 220–251 × 657–679, 31 px, not a long band; the
  left jamb merges into the west-wall corner). Incumbent cell 61–253 × 590–739 spans the garage end AND the 1.2 m
  outdoor strip south of it → OUTSIDE ("reachable from outside with only 2 shut edges").
- The shadow grid has a line at 667 — but only because unread chain `…0-49e01702cc` (baseline x 320, inside room 3,
  ticks 584/667/686/707/716, all segments unread, role EXTERIOR) happens to tick 667, 3 px from the wall axis
  (664–668). With that chain dropped the line, and the garage end, disappear (measured).
- On that line: pieces 61–100 and 220–275 (WALL), gap 100–220 = **2.38 m, UNKNOWN_GAP / WEAK, signature DASHED**
  (strokes −17 px/0.93/3 runs outside the face = parking outline; +3 px/0.94/3 runs in-wall = overhead-door line),
  jambs WALL/WALL. EXCLUSION bridges it by the pocket rule; STRICT leaves it open. The 240/220 callout is not in
  `planCallouts` (OCR), so `withCallout` never upgrades it.
- EXCLUSION encloses cells 61–253 × 590–667 (4 cells, **5.93 m²**, A=1, inside=1, not built by the box). But `adopt`
  returns `builtA` unless some part *beyond* the box is accepted ("the box stands, byte for byte"), so the shadow
  grid's correct reading of the box's own interior is discarded.

**P1-1 body-0 is taller than the bay because of a wall-thickness sliver.** Its 30 cells = 17 cells of column
x 609.5–618 (8.5 px = 0.51 W) for y 323–716, plus 13 bay cells x 618–670 × y 415–590. The box edge snapped to the
band-axis line 609.5 (east-wall band V 596–618); the exterior tick 618 is the wall's outer face; both lines read the same
wall (pieces at axis 608/609), so the strip *inside the wall* is "enclosed": N edge y 323 closed by the wall's cross
section, S edge y 716 by the 120/70 window (GLAZING 554–618 on Y@716, jamb CORNER). Hence rect y 323–716, J 0.55
(217 of 393 px of the strip's west edge is wall), S 0.75. body-1 (SEPARATE, 646–670 × 462–544, 0.79 m²) is the reveal
of the bay's 180/140 window: X@670 gap 458–548 (1.82 m, WEAK, LEAF_FACE) left open as a pocket mouth (exposed 0.8 m²
< limit 8.3); the inner glazing X@646 465–538 (STRONG GLAZING) keeps the bay itself enclosed. The 180/140 callout reads
440/40/470/… so the outer gap gets no callout either.

**Where the bay's evidence actually ends (all agree within 1 px).** Side walls: Y@415 piece 596–669 (axis 423), Y@590
piece 596–669 (axis 582) (bands H 619–645 × 415–437 / 568–590). Own face: X@670 pieces 415–458 + 548–591 (axis 658).
Junction opening: X@609.5 438–568. Chains: top chain `1212 = 380+732+100`, the `100` segment = 50.5 px = x 619.5–670
(house outer face → bay face); chain `…2-737ee209cc` at x 662 ticks 437/502/568 (interior 2.66 m, the printed `260`);
right chain `…6-2b47f52eaa` ticks 415 and 590 (outer faces, 3.55 m). The bay is x 609.5–670 × y 415–590 = **4.25 m²**.

**P1-2 Willa-miranda already builds an outdoor step (4.82 m², the 005E "mass-3" 571.5–699 × 121–174).** It is the
entry step in front of room 7's 110/230 door: west = the living wing's wall stub, east = a planter (POST 699–719),
north = two step lines that Y@121 reads as `GLAZING / STRONG` 3.08 m with jambs WALL, POST ("glazing between piers",
`posts < 2`). `adopt`'s `kept` grows "through edges with an opening in them — a room behind its door" (`n.door`), so
the step rides in with body-0. Judged as its own part under the rule below it is rejected (sides 29 % wall, 15 % posts).
Fixing it moves willa from 161.29 (−5.07 %) to ≈156.5 m² (≈ −7.9 %): more correct, worse number. The rest of willa's
gap is the covered entrance porch (COVERED_TERRACE 10.11 m², x 378–533 × 519–611, a post at its corner — must stay out)
and wall faces mass-making leaves out (kitchen south row 1.55 m² OUTSIDE + 0.66 RECESS of 3.83). Report it; do not hide it.

**P1-3 Policy margin.** The garage end is enclosed only under EXCLUSION (WEAK door). Bay 3.46 m² in both, garage 5.93 in
EXCLUSION only ⇒ 5.4 % apart, just under `POLICY_AGREES` 6 %. Vehicle-door evidence must count in both policies or the
completion will flip the run to BOUNDARY_RESOLUTION_INCONCLUSIVE on a slightly larger garage.

**P2** (a) The leak in P0-1(b) is for the envelope workstream (POST rule at 2.45 W on a door jamb). (b) Mass-making stops
at inner wall faces: rarytasy-g2e garage east wall 402–427 × 480–702 (3.82 m², −2 % of its −2.75 %) is enclosed, in
the box, unbuilt, and walled off from built cells — the rule below rejects it (no change). (c) The long-band box
swallows a wall-thick walled yard (synthetic F8: 42 m² built today) — pre-existing, not touched here. (d) Aster VIII and
galaktyka print no chain on the plan (0 chains on the frame), so the boundary pass never runs (METRIC_RESOLUTION in m1–m3);
under a nominal 2 cm/px probe nothing lies beyond the box — the rule is inert there.

## 2. Root cause

005C asks one question of a part beyond the box: *does the box's outline-confirmed interior continue into it across an
edge with neither wall nor opening?* That proves projecting wings, but (i) a room joined to the house through a door, a
wide opening or a drawn counter line is "walled off" by construction (FLUSH_ATTACHED is defined as never built); (ii)
the test is made against `inA ∧ outline.inside`, so any leak anywhere in the box blocks every attachment; (iii) inside
the box the shadow grid may only *widen* via an accepted extension, so an end wall the incumbent grid missed is lost even
when the outline encloses it; (iv) parts are cell components, so a wall's thickness read twice becomes an "enclosed body"
as long as the wall. Nothing in the evidence is missing on Morelach — the decision rule is.

## 3. Proposed contract (additive: every part `adopt` accepts today stays exactly as it is)

Notation: W = sheet wallPx; `builtA` = cells the box's own reading built; `house` = builtA ∪ (inA ∧ inside_EXCL) ∪ cells
accepted by `adopt`. Applies to **parts** = 4-connected components of
(A) inside_EXCL ∧ ¬inA ∧ ¬accepted, including the parts `kept` split off and the sub-parts `kept` reached only through a
door (re-judged on their own, P1-2); (B) only when `adopt` accepts nothing: inside_EXCL ∧ inA ∧ ¬builtA (box completion).
At most `MAX_BODIES` (16) parts per plan; the rest are reported, not built.

**C — clip (grid-independent).** C1 free floor: connected pixels of the part's cells that are not WALL-kind solid-layer
ink; a component counts only if its extent is ≥ 0.75 W in both directions (a glazing strip inside a wall is free of ink
but holds no room). C2 core cells: ≥ 25 % of their pixels on counted free floor. No core ⇒ reject `WALL_SLIVER`.
C3 keep core cells and the part's cells within **1 W** of a core cell (side-on, overlapping along the shared side, or
corner-diagonal within W both ways): its own walls; drop the rest (a wall's thickness running on past it). C4 (optional,
P2) reveal fill: an outline-open pocket of exposure ≤ the pocket limit whose cells lie within 1.5 W of the part's outer
face and are closed on three sides by the part joins it. C5 consistency check (recorded, not a gate): the clipped span
along the junction agrees with the side-wall piece ends within 0.5 W; corroboration by exterior ticks is noted.
Morelach: 30 cells/4.20 m², y 323–716 → 21 cells/**3.46 m², x 609.5–670 × y 415–590** (+0.79 reveal = 4.25 m² with C4);
identical with band-axis shadow lines added (grid 18×27 → 22×31), so the clip does not depend on where lines fall.

**Acceptance — a part is built when (1 or 2) and 3, 4, 5 hold.**
1. *Continuation*: open (not-closed) shared edge with `house` ≥ max(0.7 m, 0.5 × shared length). (Morelach garage end:
   3.80 of 5.36 m open to the built garage cells.)
2. *Attached room*, all of: (a) **way in**: open edge + bridged gaps on the shared edge ≥ 0.7 m, counting only gaps with
   boundary ≠ NONE, signature ∈ {LEAF_AXIS, LEAF_FACE, DASHED, BLANK} (a window is not a way in), jambs not POST;
   (b) **walled**: on its own perimeter WALL pieces ≥ 0.5 and POST pieces < 0.1 of the length; (c) **room evidence**,
   one of: a STRONG GLAZING gap with WALL/CORNER jambs (never a POST jamb) on a line within the part; a dimension chain
   with ≥ 2 ticks in the part covering ≥ 50 % of its free floor along that axis; a vehicle door (below).
   Morelach bay: way in 2.64 m (LEAF_FACE), sides 0.75 wall / 0 posts, glazing X@646, chain x 662 → accepted.
3. *Extent*: clipped rect inside the plan extent ± 0.5 W. The extent bounds, it never proposes (a strip with no
   enclosure adds nothing).
4. *Policies agree*: STRICT encloses the clipped part too, or every WEAK closure on its perimeter is a **vehicle door**:
   jambs WALL/WALL both `along`, width 2.2 m ≤ w ≤ 3.2 m (≤ maxWideOpeningM only with a matching callout), an in-wall
   stroke (signature LEAF_FACE, DASHED or LEAF_AXIS, never BLANK), depth behind it through the part and the built cells
   it continues ≥ 4.5 m. A vehicle door then closes the topology in BOTH policies and keeps `occupancy: OPENING`.
   Otherwise the part is recorded `QUESTION`, not built. (Morelach garage: 2.38 m DASHED, depth y 263→667 = 8.2 m.)
5. *Caps*: a part ≤ 0.5 × the box reading's built area (an attached body is smaller than what it attaches to); all
   completions together ≤ 0.5 × that area; otherwise `QUESTION`. Never removes or replaces a built cell.

Record per part: `acceptedBy: CONTINUATION | ATTACHED_ROOM | BOX_COMPLETION`, way-in metres and signature, side wall/
post shares, the evidence kind, P0 and clipped rects; built bodies are named FLUSH_ATTACHED (junction wall ≥ 0.5) or
PROJECTING_WING. Bump `BOUNDARY_EVIDENCE_VERSION`. **Shadow lines**: also add a line at the axis of every wall band
inside the extent with no line within 0.5 W (cap 16 per axis; measured +0…+10 per axis on 15 frames), so an end wall
is a line whether or not some chain happens to tick it. (Lines at wall *ends* were tried and are worse: they cut the
Morelach door line at 661/686 and turn the garage into a QUESTION.)
Forbidden: a protrusion or depth threshold for building, published areas, house names, extent-as-reason, COVERED_TERRACE.

## 4. Measured on the development set (`dev-final.txt`; 005E m3 frames, today's lines and +band-axis lines)

Every part the rule sees is rejected on all 14 frames in both line modes: **0.00 m² added anywhere**. Open bodies
(UNKNOWN-open, COVERED_TERRACE, OPEN_MOUTH_GARAGE, RECESSED) are never parts, so they are untouched by construction.

| house (m3 result) | m3 bodies the rule could touch | rule | right? |
|---|---|---|---|
| willa-miranda (−5.07 %) | b0 FLUSH_ATTACHED BUILT 21.1, b6 WING BUILT 17.0: kept; b2 FLUSH enc 0.13 + 5 wall strips | reject (sliver) | yes; b5 COVERED_TERRACE 10.1, b1 UNKNOWN-open 1.3 untouched (posts / open). Door-split rule removes the 4.82 m² step (P1-2) |
| dom-w-zurawkach (−0.81 %) | b4 WING BUILT kept; b5 SEPARATE enc 0.72; 1 strip | reject | yes; b3 UNKNOWN-open 6.7 (mouth 3.22 BLANK, ≈1.5 m deep) untouched |
| dom-w-modrzykach (−0.54 %) | b0 WING BUILT 153 kept; 8–9 wall strips | reject (sliver) | yes; b1 UNKNOWN-open 3.9 untouched |
| dom-w-azaliach (PLAN_RES.) | b3 WING BUILT kept; b1 SEPARATE enc 1.5 | reject | yes; b0 UNKNOWN-open 44.7 (piers & glazing) is the envelope workstream's, untouched |
| marcowki (PASS) | b0, b2 FLUSH enc 0.96/0.94 (corner blocks) | reject (sliver) | yes; b1/b3 COVERED_TERRACE untouched |
| rarytasy-g2e (−2.75 %) | b1 FLUSH enc 0.25; box part 3.82 (garage wall) | reject (no way in) | b1 yes; the wall strip is building (P2-b), unchanged |
| alt-marcowki, dom-w-dabecjach | FLUSH 0.13/0.46/0.34; dabecjach b5 FLUSH enc 2.71, b1, SEPARATEs | reject | yes (dabecjach keeps BOUNDARY_RESOLUTION; b0/b7 COVERED_TERRACE untouched) |
| kosacce, jablonkach, eoze, tunbergiach | kosacce 2 box strips; others none | reject / — | yes; eoze-legacy FLUSH 568.5–578.5 strips are 10 px (< 0.75 W): slivers |
| aster-viii, galaktyka | no plan chains ⇒ no boundary pass; nominal probe: none / 2 slivers | — | inert |
| **dom-w-morelach** | body-0 → bay 3.46 (ATTACHED_ROOM); garage end 5.93 (CONTINUATION) | accept | 101.31 → ≈110.7 m² (−3.3 %; −2.7 % with C4); without the stray 667 tick only the band-axis lines recover the garage (6.01 m²) |

## 5. The 005C false-closure negatives under the rule (synthetic, 5 cm/px, 12 px walls; `synth.ts`)

All unchanged (0 m² added): covered terrace on posts (both readings), §39 terrace with roof outline, pergola, planter
(no free floor ≥ 0.75 W, no way in), detached shed (separate), open-mouthed garage (not enclosed in the first reading; the
shut reading is untouched), U recess/loggia, courtyard, house behind a 5 m blank gap, decorative outline, wing without
glazing (3 m behind a blank 5 m mouth: not enclosed, still 0), paving-edge terrace beside a wing, walled yard with gate
against a wing (split off by `kept`; re-judged: 23.55 m², shared edge 100 % wall ⇒ no way in), 3×3 terrace between a
garden wall and a wing (not enclosed; not a garage: 3 m deep), full-width covered terrace with a pier. Why, in rule terms:
posts and line work never enclose (no part); an enclosed planter/yard has no way in or no room evidence; anything open
is never a part; the vehicle door needs WALL jambs, an in-wall stroke and 4.5 m behind it, and only closes a part that
is already a continuation or an attached room.

## 6. Fixtures to add (measured today vs rule)

| fixture | build with | today | rule |
|---|---|---|---|
| F1 flush bay 1.2 × 4.7 m outside the box, window on its face; junction OPEN / COUNTER line at the face / DOOR | `boundary-plan.ts` ring, wall, clear, glazeV, `drawLine` | 197.6 / 192 / 192 | 197.6 (unchanged) / +5.64 / +5.64 |
| F2 same place: posts + outline (terrace), junction OPEN / DOOR | post, drawLine | not built | not built |
| F2y short walled yard (pieces < long band), BLANK gate, no window | wall, clear | not built (gate a pocket) | not built; if bridged: no room evidence |
| F3 oversized bay: box edge on the wall axis + outer face only an unread exterior tick (`chain(…, {read:false})`) | plan.ts chain | must first assert P0 runs past the bay | clip to the side walls ± 1 W |
| F4 garage at the box end, door on its face between corner jambs, face ticked by no chain; variants LEAF_FACE, DASHED, BLANK | wall, drawLine, `walls`/`partition` (plan.ts); E2E: synthetic-drawings `SyntheticWing` + `SyntheticPartition` | whole garage lost (190.8 of 271.8 m² in my F4′) | needs band-axis lines; my 4-px-dash door read BLANK ⇒ rejected (no room evidence): draw LEAF_FACE and longer dashes; BLANK must stay open |
| F5 extent ticks 1.2 m past the facade, only terrace lines in the strip | chain ticks + drawLine | 192 | 192 |
| F6 canopy: two posts + dashed roof outline inside the chain extent | post, drawLine | 192 | 192 |
| F7 L: flush wing beyond the box through a door in a party wall, window | ring, wall, glazeV; E2E `SHAPE_FAMILIES` `l-front`/`l-rear` | 192 (FLUSH_ATTACHED, not built) | +42.0 |
| F8 walled yard through a house door, gate, no window | as F7 without glazing | long pieces: the box swallows it (234) | short pieces (F2y′): not built |
| F9 entry step: wall stub + planter POST + two step lines + exterior door (willa pattern) | wall, post, drawLine | built (willa: 4.82 m²) | not built (door-split re-judge, measured on willa) |

Positive F1 (COUNTER) is the Morelach mechanism and F4 (LEAF_FACE/DASHED) its garage; every row must also run with the
mouths-shut reading. Also add a unit test that a wall-thickness strip between two lines on one wall is never a part.
