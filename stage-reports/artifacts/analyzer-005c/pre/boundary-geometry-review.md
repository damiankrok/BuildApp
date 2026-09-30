# Reviewer A — boundary geometry (BUILDPLAN-ANALYZER-005C, pre-implementation)

**Question.** How should the exterior cycle of a building be rebuilt from a raster plan when openings, attached
wings and drawing conventions break the wall ink?

**Scope and method.** Read-only review of `analyzer/opening-aware-envelope-v1` @ `d3235bf`, the frozen 005B code.
Every number below comes from my own probes, which run the production functions (`planSheet` band options,
`wallWitness`, `planExtent`, `decomposePlan`) on the byte cache. The probes live in
`.cache/review-A/{env,reflood,proto,meta,strokes}.ts` (git-ignored, copied to `ev/review-A/`) and their overlays are in
`ev/review-A/*.png`. Inputs: the frozen "before" runs in `ev/before/<house>` and the sealed holdout evidence. No web
page was opened and no repository file was changed.

- `proto.ts` is a **prototype of the proposed family B**, built on the existing grid without editing any code. Its
  numbers are feasibility evidence, not an implementation.
- **"Built m²"** is the area of the decomposition's BUILT cells. It is not the final model footprint.
- **Wall thickness.** Where "wallPx" is given, *sheet* is `planSheet`'s value and *decomp* is
  `decomposition.wallThickness.px`. They differ (see P2-1).

---

## 0. Verdict in six lines

1. The first bad decision on all three failing houses is the same pair of lines:
   - `walledEnvelope` takes the envelope as the **box of the axes of bands ≥ 2.5 walls long**
     (`plan-decomposition.ts:756, 759-770, 939-941`);
   - the flood then **seeds every cell whose centre is outside that rectangle as outside** (`:1515-1529`).
   A side made of piers and glass has no long band, so the rectangle stops inside the building. A wing is left to
   `baysOf`, which cannot see it.
2. The deeper cause is that **piers and corner blocks are invisible to the band layer**. The layer only keeps runs
   ≥ 1.6 walls long and within 0.45–1.9 walls thick, and it drops junction pixels. The same blindness therefore breaks
   four more places: `closureOf`'s jamb rule, `alongWallPieces`, `sideWallReach`'s pier test and `baysOf`.
3. A wall-solid layer (the ink mask morphologically opened by 0.3 wall) sees those piers. On the existing grid, an
   opening-aware flood over it (family B) recovers:
   - **zurawkach**: 101.8 m² against 101.7 published;
   - **willa-miranda**: 169.6 m² against 169.9, *after* its extent is fixed and the unread ticks are added as grid
     lines;
   - **modrzykach**: 179.4 m² against 181.98, of which 10.7 m² is a covered terrace that must *not* be enclosed.
4. **B must not replace A.** Used as a replacement it moves 4 of the 5 development houses that complete today:
   Marcówki +14.9 %, G2E −19.6 %, jablonkach +31.8 %, and Kosaćce to different cells.
   - What worked: keep A byte for byte, and **accept only B-components that extend A across an unsupported stretch
     of A's own edge**. In every rule variant tested this accepted **0 extensions** on Marcówki, Kosaćce, G2E, e-OZE
     and jablonkach.
   - It fixed zurawkach at 100.8 m² (−0.9 %) under strict jambs, and willa at 167.2 m² (−1.6 %).
5. **Jamb/infill evidence is the open problem.**
   - Strict rules (jambs connected to the wall system, window infill of 2 or more strokes) remove the false porch and
     terrace. But they lose doors and piers that hang on thin partitions, so B collapses on modrzykach, willa, Kosaćce
     and G2E.
   - Permissive rules enclose a porch (a bush symbol acting as a jamb) and a covered terrace (a column plus a dashed
     roof line).
   - The design must carry this as explicit evidence tiers and say INCONCLUSIVE, not pick.
6. Three smaller defects are independent of B:
   - `sideWallReach` stops half a wall short (the whole −5.25 % on jablonkach);
   - unread exterior chain ticks never become grid lines (willa);
   - `envelope.rect` is the world origin. Any change to it must be gated.

---

## 1. Mechanism, measured

### 1.1 Summary table

| | dom-w-modrzykach | dom-w-zurawkach | willa-miranda (as run) | willa-miranda (correct extent) |
|---|---|---|---|---|
| base plan / raster | `…6827e718fe`, 853×853 | `…6fe6f9c445`, 853×853 | `…7102a805c6`, 853×853 | same |
| wallPx sheet / decomp | 16 / **17** (0.47 m) | 14 / **21** (0.47 m) | 12 / **7** (0.19 m) | 12 / 17 |
| bands: sheet / inside extent / long (≥2.5 decomp walls) | 33 / 15 / 10 (V7 H3) | 31 / 17 / 11 (V8 H3) | 46 / 9 / 9 | 46 / 30 / 19 (V13 H6) |
| long cut | 42.5 px = 1.17 m | 52.5 px = 1.16 m | 17.5 px = 0.47 m | 42.5 px = 1.14 m |
| printed extent | [46,113..719,535] = **18.50 × 11.60 m** | [257,95..797,524] = 11.97 × 9.50 m | [235,355..794,450] = 15.00 × 2.51 m (interior `114` chain, §F) | [234.5,84.5..794,610.5] = 15.00 × 13.99 m (ticks of unread V@69.5) |
| axisBox of long bands | y 112.5–200.5 | y 94.5–456 | y 387.5–432.5 | y 175.9–519.3 |
| **walled envelope** | [46,113..719,186.5] = **18.50 × 2.02 m** | [260,95..792,456] = 11.80 × 8.00 m (house only) | [235,385..549,429] = 8.43 × 1.17 m | [235,184..794,519] = 15.00 × 8.90 m |
| bays | 1: MAX_Z 12.76 m mouth, OPEN_SIDE | 0 | 0 | 0 |
| cells built / total, area | 5/99, 26.0 m² (24 m² of it exterior, see P1-5) | 17/33, 69.0 m² (−32 %) | 2/52, 0.5 m² | 77/105, 74.6 m²; with the tick lines added, 115.8 m² (−31.8 %) |
| wall witness (share of true extent) | [476,184..719,489] = garage only (26 %) | [341,95..792,503] (79 %) | [473,102..794,593] = right half (54 %) | — |

### 1.2 dom-w-modrzykach — the front has no band at all

- **Sides of the printed extent.** Bands within 1.5 walls of each side:
  - top y=113: 5 bands covering 31 % of the side, the longest 54 px (bedroom top wall cut by `180/230` and `100/230`);
  - **bottom y=535: 0 bands**;
  - left x=46: 3 bands, 52 %;
  - right x=719: one 218 px band (garage), 51 %.
- **Why the front vanishes.** The front is stepped: the kitchen bay reaches y 535 and rooms 1, 2 and 10 end at y 506.
  It is made of piers and hairline glazing only.
  - In the opened mask the solid pieces are 53, 52, 50, 28 and 32 px on line y=506, and 31, 31 and 23 px on y=535.
  - The band reader requires an across-run of 7–30 px and a piece of at least 26 px. The stepped corner blocks exceed
    30 px across at their junctions, and most piers are shorter than 26 px. So **not one band exists on the front**,
    long or short.
- **Where the box stops.** The long horizontal bands are y=121 (54 and 47 px, the bedroom top wall) and y=192
  (208 px, the garage's *back* wall, x 495–702). The box therefore stops at 200.5, which snaps to 186.5.
- **First bad decision:** `plan-decomposition.ts:940` (`axisBox(longBands)`).
  - `sideWallReach` (`:1003-1046`) cannot rescue it, for two independent reasons:
    - the side walls end at y 467 (V54) and y 418 (V711), |Δ| = 49 > 2 walls (34 px) (`:1035`);
    - the cross wall the box ends on (H192) is 17 px thick, which is not a partition (`:1029-1032`).
  - Then `:1519-1528` seeds all 90 cells below y=186.5 as outside.
  - `baysOf` pairs V54 and V711 into a 12.76 m "mouth", which is OPEN_SIDE.
- **What today's code builds.** Of the 5 cells it builds (26 m²), 24 m² are **exterior**: the covered terrace
  (x 46–238, 10.6 m²) and the covered bike shelter over the garage (13.3 m²). Both are line-closed inside the
  rectangle. The remaining 2.0 m² is a strip of room 8.

### 1.3 dom-w-zurawkach — the wing is ground by construction

- **The envelope is right for the house body** (11.80 × 8.00 m). The garage wing, 4.30 × 1.51 m, lies outside it.
- **Why `baysOf` finds no bay.** Its `minOut` is `max(4·wallPx, 1.5 m)` with the *decomposition's* wallPx of 21, so
  **84 px = 1.86 m**. The 005B report quotes 67.6 px, computed from the sheet's 14 px.
  - V609 (x 598–620, y 456–503) starts at the edge but reaches only 47 px.
  - V782 (x 772–792, y 116–503) **runs through** the edge, so it is not "leaving" (`:1257`).
- **The piers are not bands.** They measure 598–637 × 503–523 and 754–792 × 503–523. Where a pier continues a side
  wall, its across-run is 67 px, above the 27 px maximum. The remaining 17 px run is shorter than minLength 22.
- **First bad decision:** the seeding at `:1519-1528`. The 11 wing-row cells are outside by construction, and the
  garage (x 600–792, y 234–456) floods through the open grid edge at y=456.
- **Taking away the rectangle is not enough.** Family D, the flood with only the grid border seeded, still gives
  78.3 m² (−23 %). The mouth line at y=524 is only 40 % closed: `closureOf` counts holes only between *band* pieces
  (`:681-687`), so the 2.60 m door between the piers is not a hole.
- **Callouts do not help here.** The mouth's `260/229` callout was **not read at all**, and the 5 callouts that were
  read on this frame are misreads (`400/49`, `400/400`, `400/171`).

### 1.4 willa-miranda — three stacked defects

1. **Extent** (the other reviewer's question; recorded here because it blocks everything downstream).
   - The depth comes from the interior `114` chain V@375 [355..450]. The chain reads EXTERIOR because the witness
     groups only the right half of the building.
   - On the 2.5 m strip the decomposition measures a wall of 7 px, a partition.
2. **Grid.** Given the correct extent, the grid still has **no line at y 85 or y 611**.
   - The only chain that states them (V@69.5, ticks 84.5/176/519/610.5) is unread, and `gridLines` skips segments
     without a value (`:400`).
   - The facade stubs there (H93: 26 px; H602: 21 px) cover less than 18 % of the axis (`:448`).
   - No envelope design can put a boundary where the grid has no line.
3. **Envelope.** With the correct extent and the ticks added as lines:
   - the long-band box is y 184–519, which misses the living-room projection to the north (x 370–580, y 85–184) and
     the garage projection to the south (x 533–794, y 519–611);
   - no bay is found, because the right garage wall V785.5 (y 193–593) runs through the edge;
   - today's code builds 115.8 m² (−31.8 %).

### 1.5 The same mechanism on development houses (it does not stop them, it bounds them)

- **dom-w-jablonkach.** `sideWallReach` is the only reach that fires in the development set.
  - It returns `farEnd + half` (`:1035`) = 641 + 10.5 = 651.5, which `snap` (`:957`) moves to the grid line 641, the
    front wall's *inner* face. The outer face is 663: the printed `900` spans 237 to 663.
  - The missing strip is 11.0 × 0.47 m = 5.1 m², **exactly the 94.18 vs 99.4 (−5.25 %)**.
  - Moving the envelope to the outer face gives 99.0 m² (−0.4 %) in B, and the same 99.0 m² under a 1 px dilation.
- **G2E.** Its envelope is also partial (y 168–480 of 168–702). It passes because its garage walls *start* at the
  edge, so `baysOf` shuts a 4.96 m mouth.
- **Marcówki.** Its printed extent is 1.0 m wider than its walls at both ends (the chain's `100` strips). **The printed
  extent is not a boundary.** This rules out family D as a source.

---

## 2. Audit of the long-wall-band assumption

| # | where | rule | breaks on opening-dominated facades? |
|---|---|---|---|
| 1 | `source-cv/bands.ts:114-120, 65, 190-195` | band pixel: across-run 0.45–1.9 walls, along-run ≥ 12; piece ≥ 1.6 walls; merge if axes are within 3 px and gap ≤ min(90 px, 0.45 × combined) | **Yes, at the root.** Piers < 1.6 walls and corner/junction blocks are not bands. The zurawkach garage piers and the modrzykach front vanish entirely. |
| 2 | `plan-decomposition.ts:756` `longBands` 2.5·wallPx | a wall "runs" | Yes. Wall pieces between windows are 23–54 px against a cut of 42.5–52.5 px. |
| 3 | `:759-770` `axisBox` | the envelope side = outermost long axis ± half a wall | **Yes.** A side with no long band collapses to the next long band inward (modrzykach, willa). |
| 4 | `:1003-1046` `sideWallReach` | both side walls end within 2 walls of each other; the box ended on a partition (< 0.7 wall); the pier is a *band* ≥ 0.6 wall thick | Yes. A stepped or L-shaped front ends at two lines; the box can end on a real wall; piers are not bands. Also **the half-wall bug** (`:1035-1036`). |
| 5 | `:1232-1364` `baysOf` | walls *start* within 2.5 walls of the edge (`:1257`), reach ≥ max(4 walls, 1.5 m) (`:1242`), consecutive pairs only | Yes. Walls that run through the edge (zurawkach, willa); short projections. |
| 6 | `:681-687` `closureOf` holes; `:507-537` `wallIntervals` | a hole ≤ 3.2 m exists only *between band pieces* | Yes. A garage door between piers reads 40 % closed (zurawkach y=524). |
| 7 | `:1118-1139` `alongWallPieces` → `collinearWideGaps` | wide gaps weighed only between band pieces *along* the line | Yes. A 5 m garage door between piers is never weighed. |
| 8 | `:448` `minBandCoverage` 0.18, `:335-353` `spansWallToWall`, `:400` unread segments | a grid line needs a read chain, 18 % band coverage, or a band spanning wall to wall | Yes. Facade lines of piers make no grid line; willa's outer faces have no line. |
| 9 | `:1515-1529` seeds outside the rectangle | anything outside the rectangle (and not in a shut bay) is ground | **Yes, decisively.** A rectangle cannot represent L, T or U shapes. |
| 10 | `:1665` RECESS | a recess must be inside the rectangle | Yes. |
| 11 | `plan-extent.ts:60, 63-107` `wallWitness` | the largest group of long bands joined within 2 walls | Yes. Openings split outer walls into groups (next table). |
| 12 | `:859-860`, `:876-914` `planExtent(Of)` | the extent is widened or chosen by `axisBox(long)` | Partly. |
| 13 | `layout.ts:203-204, 803-845, 1059`; `plan-decomposition.ts:2049` | a body's perimeter must be ≥ 35 % *band* wall; a walled-first side must carry a band | **Latent.** It will bite *after* the envelope is fixed (P1-6). |
| 14 | `plan-resolution.ts` `PlanReadingChoice` | the axes are copy, extent, scale, merge, faces, mouths | No axis varies the envelope. All 63 modrzykach readings shared the same 2.02 m envelope. |

**The wall witness is partial on every development house.** Share of the printed (or corrected) extent that it covers:

| Marcówki | Kosaćce | G2E | e-OZE | jablonkach | willa | zurawkach | modrzykach |
|---|---|---|---|---|---|---|---|
| 3.5 % | 26 % | 42 % | 68 % | 24 % | 54 % | 79 % | 26 % |

On Marcówki the witness is [485,469..816,830]: the garage **plus the publisher's logo**.

**Metamorphic probe of today's code** (`meta.ts`, built area in m²):

| house | as drawn | mask eroded 1 px | mask dilated 1 px | long walls cut every 3 walls | every 2 walls |
|---|---|---|---|---|---|
| Marcówki | 130.8 | 2.8 | 149.3 (+13.8 %; envelope 12.05 × 13.60 m) | 130.8 | 130.8 |
| Kosaćce | 166.2 | 14.9 | 181.9 | 166.2 | 169.5 |
| G2E | 185.7 | 3.0 | 162.5 (envelope depth 8.57 → 14.11 m) | 188.8 | 147.5 (bay lost) |
| jablonkach | 93.9 | 0 (no envelope) | 99.0 | 19.4 (envelope 11.00 × 2.69 m) | 93.9 |
| zurawkach | 69.0 | 25.9 | 107.6 | 60.3 | 60.3 |
| modrzykach | 26.0 | 1.4 | **173.0** | — | — |

The envelope depends on stroke weight and on how many pieces a wall is drawn in, not on where the building is:
- a 1 px dilation turns modrzykach from −86 % to −5 % and shifts Marcówki by +14 %;
- erosion deletes the hairline glazing that carries today's closures, and every house floods.

---

## 3. Proposed design — an opening-aware boundary on the existing grid

### 3.1 Principles

- **Two things, kept apart.**
  - *Envelope topology* is the exterior cycle, used for seeding and closure.
  - *Physical solid* is the walls and piers.
  - A bridged opening shuts the cycle and remains an opening. It goes into `EdgeClosure.opening`, never `wall`, and
    becomes an opening record for the openings stage.
- **A is the incumbent and stays byte for byte** unless the drawing proves it inconsistent. "Inconsistent" means an
  enclosed, supported region continues A's built interior across a stretch of A's edge that has no wall and no
  opening (§3.4).
- **The printed extent bounds candidates; it is never a boundary source.** Marcówki's extent is 1 m wider than its
  walls at both ends.
- **The published footprint verifies or vetoes only.** At most it breaks a tie that the drawing's evidence already
  calls equal.

### 3.2 The boundary-evidence graph (on the structural grid)

The existing grid (`linesX`, `linesY`) is already the fusion of chain ticks, band axes and band faces. Its vertices
and segments are the natural planar graph, and the flood over its dual cells *is* the polygonization. No new planar
arrangement is needed.

**Nodes** are grid vertices, tagged with what put each line there:
- a printed chain tick;
- an **exterior chain tick, even when unread** (new, P1-4);
- a band axis or face;
- a solid-piece end: a jamb or a continuation point.

**Edges** are grid segments. Each carries one record:

```
{ id, axis, linePx, fromPx, toPx,
  kind: OBSERVED_WALL | OPENING | INFERRED_CONTINUATION | BODY_CONNECTION | DIMENSION_SPAN | UNKNOWN_GAP | LINE_ONLY,
  solidShare, bandShare, lineShare,                  // measured, 0..1
  opening?: { tier: T1 | T1W | T2 | T2C, widthM, jambs: [pieceId, pieceId], jambSystem: [bool, bool],
              strokes: n, calloutId?, dimensionTickIds: [...] },
  provenance: string[], confidence: number, supportingEvidenceIds: string[], maxGapM: number,
  mayCloseExterior: boolean, why: string }
```

**How each input is built from what the code already has.**

1. **Wall-solid layer (new, about 10 lines).** Open the mask with `dilate(erode(mask, r), r)`, where
   `r = round(0.3·wallPx)`. This is the operation `wallClusterExtent` already performs (`:1949-1952`).
   - Label its components.
   - A component is **wall-system** when it overlaps a band ≥ 2.5 walls long.
   - Per grid line, *solid pieces* are the runs of solid pixels inside the line's probe windows
     (`probesPx ± max(4, 0.6·wallPx)`, as `wallIntervals` uses), measured **over the whole line** as `lineIntervals`
     does. The measured zurawkach garage piers come out 39 and 38 px; the modrzykach front piers 23–53 px.
2. **Holes between solid pieces**, reusing `closureOf`'s ≤ 3.2 m convention (`maxOpeningM`) and `collinearWideGaps`'s
   ≤ 8 m ceiling (`maxWideOpeningM`):
   - **T1**: both jambs wall-system and gap ≤ 3.2 m. Width alone suffices, as it does for band jambs today.
   - **T1W**: both jambs wall-system, gap ≤ 8 m, and a window signature (2 or more parallel strokes spanning ≥ 70 %
     inside the wall window) or a matching callout.
   - **T2**: at least one jamb *not* wall-system (a pier that hangs on a thin partition), gap ≤ 3.2 m, and a window or
     door signature.
   - **T2C**: a corner gap, from the line's end vertex to its first jamb, with a window signature on *both* legs of
     the corner (a corner window).
   - Anything else is **UNKNOWN_GAP**. It is never bridged.
3. **Stroke counts** (`strokes.ts`, 11 real gaps): windows and glazed doors 2–4; the modrzykach 5 m garage door 2;
   the zurawkach glazed corner 4 and 3; the modrzykach covered-terrace dashed roof line **1**; the zurawkach porch
   between a bush and the garage pier **0**; the zurawkach garage mouth 1 (door not drawn; its jambs are wall-system,
   so T1 applies).
   The current `infillAcross` accepts a single stroke with 2 px gaps, so a dashed roof line counts as infill (P2-5).
4. **Dimension support.** An edge whose end vertex is a printed or exterior chain tick gets a `DIMENSION_SPAN` tag.
   It corroborates a T2 bridge but **never bridges on its own**. Marcówki's `100` strips carry ticks and no wall.
5. **Callouts** are corroboration only. They are too often unread or misread (zurawkach, 1.3).
6. **Existing decisions become nodes and edges with their provenance:** `collinearWideGaps`, `baysOf` mouths and the
   pocket rule (`:1556-1598`).

### 3.3 Candidate families (bounded)

| family | how | role |
|---|---|---|
| **A** | today's long-band rectangle, bays and flood | the incumbent, byte-identical |
| **B** | flood of the grid's dual from the grid border. An edge stops the envelope flood only if it is OBSERVED_WALL (solid share ≥ 0.62 with T holes) or OPENING (T1/T1W/T2/T2C). **Line work never stops it**; that is the terrace rule. The unreached cells are the envelope. | the generator |
| **C** | `wallClusterExtent` and the witness | veto only: a B region beyond C by more than a wall is refused |
| **D** | the printed extent | outer bound only: B cells must lie inside it |

**Caps.** 1 B flood per frame and jamb policy, and at most 2 policies (T1-only and T1+T2). At most 16 extension
components, at most 256 bridged gaps and at most 4 candidate cycles per frame. The grid is already bounded; the
measured maximum is 17 × 12 on Kosaćce. The cost is one opening of the mask, O(W·H·r), plus a scan along each line
(an assumption; not timed separately).

### 3.4 Integration with the existing flood (smallest change)

1. Compute today's decomposition (A) unchanged.
2. In a **shadow** pass, compute the solid layer, the edge records, and B. If willa's extent is fixed, the shadow grid
   also adds lines at unread exterior-chain ticks. The shadow must not touch A's objects.
3. **Extension components** are the connected components of `B \ (A-rectangle cells ∪ shut-bay cells)`. Each is
   **accepted** only if all of these hold:
   - (a) it shares at least one edge with an A cell (BUILT, or inside B) where that edge is *not* shut in the envelope
     sense. This is the "continuation across an unsupported stretch of A's edge" test.
   - (b) every edge on its new boundary is OBSERVED_WALL or OPENING;
   - (c) it lies inside D and is not refused by C;
   - (d) no bridge on its boundary is UNKNOWN, and every T2 bridge carries a dimension tick or a callout.
4. **If nothing is accepted, return A's decomposition object untouched.** Nothing new enters the model or scene hash
   inputs, and diagnostics may record `boundary: { accepted: 0 }`.
5. **If something is accepted:**
   - seed as outside every cell not in `A-rectangle ∪ shut bays ∪ accepted` (a cell set, i.e. an orthogonal polygon);
   - inject the accepted boundary's openings as `evidenced` intervals into `closureOf` (the `extra` path, `:1457`,
     `:1466`), so H1 records them next to the bay mouths, with a new `WideOpeningDecision.kind` of
     `ENVELOPE_OPENING` carrying tier, jambs, strokes and ticks;
   - set `envelope.rect` to the bounding box of the polygon and add `envelope.cells` or `envelope.polygon`;
   - test RECESS containment (`:1665`) against the polygon.

   `envelope.rect` is the world origin (`layout.ts:938`), the base of the zones (`:1098`), and the alignment target
   and source (`:425`, `:443-444`, `:1134`). So it must change *only* on frames with an accepted extension. For
   zurawkach and modrzykach the top-left corner does not move, so the origin is unchanged.
6. **Independent fixes that do not need B:**
   - `sideWallReach` returns the outer face, `farEnd + wallPx` (as `baysOf` does at `:1269`), not `farEnd + half`.
     Among the development houses only jablonkach fires this path (checked: every other envelope equals its axisBox
     up to snapping).
   - Unread exterior-chain ticks become grid-line candidates (shadow grid only, step 2).

**What could move the pinned models, and how it is kept still.**
- Adding grid lines, a new wall thickness, a changed `envelope.rect`, a changed H0/H1 `differs` flag, or a changed
  `mergeRegions`/`planBodies` input would each move them.
- All of these are confined to frames with at least one accepted extension. Measured, §3.5: zero accepted on
  Marcówki, Kosaćce, G2E, e-OZE and jablonkach in all four rule variants.
- Kosaćce tracked shares the frame with clean. Not run separately (an assumption).

### 3.5 Prototype results (`proto.ts`, built m², published in brackets)

Variants:
- **B-perm**: any solid jamb, ≤ 3.2 m, ≤ 8 m with infill, corner infill.
- **B-tier**: T1, T1W, T2 and T2C as defined in §3.2 (without the dimension-tick requirement).
- **"ext"**: A kept, plus accepted extensions only.

| house | today A | B-perm (replacing A) | B-tier (replacing A) | A + ext (perm) | A + ext (system-only jambs) | A + ext (tier) |
|---|---|---|---|---|---|---|
| Marcówki (131.16) | 130.8 | 150.7 (+14.9 %) | 131.6 | **= A (0 accepted)** | = A | = A |
| Kosaćce (164.47) | 166.2 | 163.0 (−21 cells) | 16.0 | = A | = A | = A |
| G2E (189.77) | 185.7 | 152.5 (−19.6 %) | 12.8 | = A | = A | = A |
| e-OZE (122.07) | 121.7 | 121.7 | 121.7 | = A | = A | = A |
| jablonkach (99.4) | 93.9 | 131.0 (+31.8 %) | 99.0 | = A | = A | = A |
| modrzykach (181.98) | 26.0 | 179.4 † | 8.6 | 192.7 ‡ | = A | = A |
| zurawkach (101.7) | 69.0 | 106.6 § | **101.8** | 106.6 § | **100.8** | **100.8** |
| willa, extent + ticks fixed (169.9) | 115.8 | **169.6** | 14.0 | 175.8 | **167.2** | = A |

Footnotes:
- **†** Includes the covered terrace, 10.7 m²: one column plus the dashed roof line, bridged. From the printed chains
  I estimate the walled outline at **≈ 168.7 m² (−7.3 %)** and the outline plus terrace at 179.4. Whether the
  publisher counts the covered terrace cannot be told from the drawing. The figure must not decide it.
- **‡** Includes the ≈ 24 m² of line-closed exterior that today's code already builds inside the rectangle (P1-5).
- **§** Includes a 4.9 m² porch closed by a bush symbol acting as a jamb.

**Reading.** The gate (A kept, extension-only) is robust: zero false extensions on 5 houses under 4 policies. The
evidence tiers are not yet right. A **door signature** (a leaf plus arc from a jamb, or a callout) is what B-tier
lacks. Doors between non-system piers are why modrzykach, Kosaćce and G2E collapse under the strict rules.
- Not measured: the door signature itself, and the facade-alignment test for T2 jambs (the jamb's across-extent
  matches the line's wall faces).
- These must be proven on all 10 development rows before the tiers are frozen.

---

## 4. Scoring and ranking

**Per candidate cycle.** Lengths in metres, from the edge records:

| metric | meaning |
|---|---|
| `L` | total boundary length |
| `L_wall` | covered by solid (OBSERVED_WALL) |
| `L_T1` | bridged by T1/T1W openings |
| `L_T2` | bridged by T2/T2C openings |
| `L_inferred` | INFERRED_CONTINUATION or DIMENSION_SPAN with no infill |
| `L_unknown` | UNKNOWN_GAP |
| `L_line` | LINE_ONLY |
| counts | bridged gaps per tier, max bridged gap per tier (m), jambs that are not wall-system |

Also recorded: the side-by-side residual against the printed extent (m per side), and the published residual
(for recording and veto only).

Measured on the B boundaries: modrzykach 54 % solid and 46 % opening; zurawkach 66/32; willa 55/45; Marcówki 70/30.
Unsupported is 0 % by construction of the flood.

**Ranking** is lexicographic, never a weighted sum (the resolver's style):
1. `L_unknown = 0` and `L_line = 0` on exterior edges (hard);
2. the max bridged gap is within its tier's convention (hard);
3. fewer T2/T2C/inferred bridges;
4. a higher `L_wall / L`;
5. the smaller enclosed area (conservative);
6. candidate id (determinism).

The published figure may only:
- **veto** a candidate outside the resolver's 35 % bucket;
- **break a tie** between two candidates whose tuples for steps 1–4 are identical.

**BOUNDARY_RESOLUTION_INCONCLUSIVE** (a typed stop that names the candidates and the differing region) when:
- (a) no candidate satisfies 1–2;
- (b) the best candidate needs more than 2 T2 bridges, or any bridge wider than 3.2 m that rests on T2 evidence;
- (c) two candidates satisfy 1–2 with identical tier profiles and differ by more than the AGREES band (6 %) of the
  larger. The modrzykach terrace (10.7 m², 6.4 %) is exactly this case;
- (d) an accepted extension would move a frame whose metric confidence is below SUPPORTED.

The report names the region (for example "covered terrace: one column, one dashed line") as `TRACE_UNCERTAIN`, not as
a room.

---

## 5. Risks and negative cases

| case | today (A) | naive B | the rule that should hold | status |
|---|---|---|---|---|
| unsupported collinear gap (a stretch with no jamb on one side) | open | open (no jamb) | UNKNOWN_GAP, never bridged | by construction |
| courtyard or true open gap > 3.2 m, no drawn infill | open | open | T1W needs 2 or more strokes or a callout | measured on 11 gaps |
| covered terrace or pergola (columns plus a roof line) | **built** if inside the rectangle (modrzykach) | **enclosed** (column jamb plus dashed-line infill) | a column is not wall-system; 1 stroke is not a window; dashes are not infill | measured: 1 stroke; column isolated |
| porch next to a garage (bush or planter drawn solid) | outside | **enclosed** (zurawkach +4.9 m²) | an isolated blob is not a jamb; 0 strokes | measured |
| U-shaped recess or loggia ≤ 3.2 m wide | today `closureOf` counts a *crossing* return as a jamb, so the mouth can shut | same risk | a T1 jamb must be a solid piece *along* the line (longer than the crossing wall is thick) or wall-system with ≥ 1 stroke | **not measured**; add a test |
| L-shape / wing (zurawkach, G2E, willa) | only if both walls *start* at the edge | recovered | extension accepted | measured |
| front of short piers only (modrzykach, jablonkach) | lost | recovered | T1/T2 | measured |
| one missing raster segment, no opening evidence | open | open unless both ends are jambs and ≤ 3.2 m, then bridged as an opening | a gap that ends in no jamb stays UNKNOWN; a jambed ≤ 3.2 m gap with nothing drawn becomes an *opening*, not a wall, and shows up as an extra opening downstream | risk: phantom openings; count them |
| glazed corner (zurawkach, top-left) | shut by hairlines | **leaked** without the corner rule (56.3 m²) | T2C: signature on both legs | measured: fixes to 101.8 |
| grid line missing at a face (willa) | cannot be represented | cannot be represented | unread exterior-chain ticks become shadow-grid lines | measured |

**Metamorphic requirements** (to be tests):

A stroke split into 2 or 5 pieces, and a 1–2 px dilation, give the same polygon; a 0.9–1.1 downscale gives the same
polygon in metres; 40 px of padding or crop shifts it by exactly that; a 1–2 px erosion gives the same polygon or
INCONCLUSIVE, never a smaller confident building.

Neither A nor naive B passes erosion today. B-perm under erosion gives modrzykach 124.8 and zurawkach 5.8, because
T1W, T2 and T2C depend on hairlines and r shrinks with wallPx. Hence:
- the tiers must fall back to INCONCLUSIVE when strokes vanish;
- `r` must be derived from the sheet wall, not from the eroded one.

---

## 6. Findings

| id | sev | finding | evidence | location |
|---|---|---|---|---|
| P0-1 | P0 | The envelope is the axis box of long bands, and every cell outside it is ground. A side without a long band collapses inward; a wing is lost. | modrzykach 2.02 of 11.60 m; zurawkach wing (11 cells seeded); willa (correct extent) 8.90 of 13.99 m | `plan-decomposition.ts:756, 759-770, 939-941, 1515-1529` |
| P0-2 | P0 | Piers and corner blocks are not bands, so they are not jambs: an opening between piers reads open. The same blindness sits in 4 places. | zurawkach y=524 closure 0.40, and D-flood still −23 %; modrzykach front: 0 bands | `source-cv/bands.ts:114-120`; `plan-decomposition.ts:681-687, 1118-1139, 1021-1026, 1248-1257` |
| P1-1 | P1 | `sideWallReach` returns the front's axis, which snaps to the inner-face grid line. | jablonkach 641 vs 663 → −5.1 m² = the whole −5.25 %; only jablonkach fires it | `:1035-1036`, `:957` |
| P1-2 | P1 | `baysOf` needs walls that *start* at the edge and a reach ≥ max(4·decomp wall, 1.5 m). | zurawkach: minOut 84 px (1.86 m), not 67.6; a wall running through the edge is never a bay side (zurawkach, willa) | `:1242, 1248-1257` |
| P1-3 | P1 | The wall witness is fragmented by openings on every house (3.5–79 %); on Marcówki it includes the logo. | table in §2 | `plan-extent.ts:63-107` |
| P1-4 | P1 | Unread exterior-chain ticks and short facade pieces make no grid line, so a boundary cannot be placed there. | willa: no line at y 85 or y 611 | `:400, :448, :335-353` |
| P1-5 | P1 | Line work closes exterior *inside* the rectangle. | modrzykach: 24 of today's 26 built m² are the terrace and the bike shelter | `:1456, :1465` (`lineIntervals` in closure) |
| P1-6 | P1 | Band-only gates downstream will drop pier-and-glass bodies once the envelope is fixed. | B boundary band-wall share: modrzykach 39 % vs the 0.35 gate (whole outline; per-body lower, not measured) | `layout.ts:204, 803-845, 1059`; `plan-decomposition.ts:2049` |
| P1-7 | P1 | Today's envelope is metamorphically fragile. | 1 px dilation: modrzykach −86 % → −5 %, Marcówki +14 %; erosion collapses every house | §2 table |
| P1-8 | P1 | `envelope.rect` is the world origin, zone base and alignment target, so any change moves pinned hashes. | `layout.ts:938, 1098, 425, 443-444, 1134` | gate it on accepted extensions |
| P1-9 | P1 | Naive B (a replacement) moves 4 of 5 completing development houses; the jamb policy flips the failures. | §3.5 table | design |
| P2-1 | P2 | The decomposition re-measures wall thickness on the extent-filtered bands. | 21 vs 14 (zurawkach); 7 on willa's strip; every threshold scales with it | `:1399` |
| P2-2 | P2 | RECESS requires rectangle containment. | — | `:1665` |
| P2-3 | P2 | No resolver axis varies the envelope. | 63 modrzykach readings, one envelope | `plan-resolution.ts` `PlanHypothesis` |
| P2-4 | P2 | Callouts are unreliable support. | zurawkach: 5 read, all misread; the garage `260/229` unread | metric evidence |
| P2-5 | P2 | `infillAcross` accepts one stroke with 2 px gaps, so a dashed roof line counts as infill. | modrzykach Y@113: 1 stroke, "WIDE_INFILL" | `:1058-1083` |

### Tests to add

1. A front of openings between piers shorter than 1.6 walls (no band): the envelope reaches the front. Control: with
   the piers removed it stays open.
2. A 1.5 m garage wing whose side wall runs through the envelope edge, with an undrawn door between wall-system piers:
   the wing is built. **Only B's closure is used**; a family-D control with the rectangle removed still fails.
3. A covered terrace (one column, a dashed roof line, furniture): not enclosed, and named TRACE_UNCERTAIN.
4. A porch beside a garage pier with a solid bush symbol: not enclosed.
5. A 2.5 m loggia with crossing returns and nothing drawn: RECESS, not built.
6. A courtyard with a 4 m undrawn gap: outside. The same gap with double glazing: shut.
7. A glazed corner: bridged only with a window signature on both legs.
8. **Byte-identity:** on Marcówki, Kosaćce (clean and tracked), G2E, e-OZE and jablonkach (before the P1-1 fix),
   `accepted = 0`, the decomposition is deep-equal, and model and scene hashes are unchanged.
9. `sideWallReach` reaches the outer face (a jablonkach-shaped fixture: 663, not 641).
10. Unread exterior ticks produce shadow-grid lines only on frames with an accepted extension.
11. Metamorphic: a stroke split into 2 and 5 pieces, ±1 px, 0.9× scale, and 40 px padding give an identical polygon
    (in metres) or INCONCLUSIVE.
12. Tie: two fully supported candidates that differ by 6 % or more with identical tier profiles give
    `BOUNDARY_RESOLUTION_INCONCLUSIVE`, and the published figure does not choose.
