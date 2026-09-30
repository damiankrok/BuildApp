# Reviewer B — openings / facade semantics (BUILDPLAN-ANALYZER-005C pre-implementation review)

- **Repository:** `/home/user/BuildApp`, branch `analyzer/opening-aware-envelope-v1` @ `d3235bf` (frozen 005B analyzer). Read-only; worktree clean.
  - Every `file:line` is at `d3235bf`, under `packages/reconstruction/src/` unless another package is named.
  - The branch has since moved to `e6220a9` (`3e76894` 005C baseline docs, `e6220a9` round-3 holdout draw). `git diff d3235bf..HEAD -- packages` is empty, so every line number still holds.
- **Probes** are in `/home/user/BuildApp/.cache/review-B/` (git-ignored), run with `npx vite-node`:
  - `gaps.ts` runs production `readPlans`/`decomposePlan` on a sealed run and audits every gap on a given wall line;
  - `gapsig.ts` gives the per-gap line signature on the mask;
  - `posts.ts` tests connectivity in the wall-thick ink;
  - `edges.ts` gives edge-closure statistics;
  - `noguard.ts` runs an unmodified copy of `decomposePlan` with only the envelope overridden;
  - `adversarial.ts` holds synthetic fixtures built with the test helpers.
- **Raw outputs** are in `ev/review-B/` (`gapsig.txt`, `mask-gaps.txt`, `*-spec.json`). Crops of the drawings were viewed locally and not copied anywhere.
- **Evidence used:** the byte cache `ev/devcache`; the before-runs `ev/before/*` (all 11 finished); sealed holdout `h1`/`h2`.
- **Unit conversions:**
  - **1 wall** means the sheet's own band thickness: h2 16 px, h1 14, willa-miranda 12, Kosaćce 14, Marcówki 17.1.
  - Metres use the sheet's registration: h2 0.02749, h1 0.02218, willa 0.02681, Kosaćce 0.02407, Marcówki 0.02647 m/px.
- **What is measured and what is not.** Anything not measured is marked **ASSUMPTION**. The "printed" opening widths below were read by eye from the callouts on the drawings. They are **not** analyzer readings.

---

## Verdict in ten lines

1. **Opening evidence that exists before the envelope today:** band segments; the per-edge ≤ 3.2 m hole rule; `collinearWideGaps` and `baysOf` (both inside `decomposePlan`); and the plan callouts.
   - Every detection with real semantics (glazing, door swing, family, the callout pair, recess returns) runs in v2 **after** masses exist (`v2/openings-v2.ts`, `v2/recesses.ts`). That is too late.
2. **Today, openings close because a line is drawn across them, not because of an opening model.** Of 2261 grid edges on 13 plan readings (8 houses):
   - 495 are shut by wall bands;
   - 1011 need the thin-line term;
   - only **8** need the `opening` term.
3. **The long-band envelope is the only thing keeping line-closed exterior zones outside.** Remove it, with the flood logic unchanged:
   - h2 goes from 26 to **200.2 m²** (published 181.98), with the terrace and the entrance zone BUILT;
   - h1's porch strip becomes BUILT, and its garage stays OUTSIDE.
4. **Jambs come from `Band`s, which drop short and L-shaped piers.** Every garage-door pier on the three failing houses is missing from the band set.
   - A mask-level solid scan along the facade line recovers all of them.
   - On **39 of 39** real openings on five houses, its gap width is within **≤ 0.04 m** of the printed callout width.
5. **Callouts are corroboration only.**
   - The reader agrees with 7 of 9 gaps on Kosaćce and 6 of 6 on Marcówki, but with only 1 of 11 on h2 and 1 of 6 on h1.
   - **None** of the three failing garage-door callouts was read: `260/229`, `500/225`, `500/238`.
6. **A thin-line signature inside the wall's thickness separates the families on the measured gaps:**
   - windows: 2–4 lines;
   - doors: 0–1 line near the axis;
   - garage doors: 1 continuous line at the inner face;
   - terrace, porch and post mouths: 0 lines.
7. **Only connectivity separates a post from a jamb.** Posts are isolated wall-thick blocks of at most 1.5 walls.
   - Every garage jamb continues as a wall: components 5.5–11.4 walls long.
   - A "repeated collinear support" rule without this test bridges willa-miranda's porch.
8. **Measured on synthetic plans, today's rules:**
   - close a blank 2.4 m loggia mouth that has returns;
   - treat a paving line on the outer face as infill;
   - leave `OPEN_SIDE` non-binding (a long edge's wall fraction still shuts it);
   - lose the bay when a flush garage wall is one band through the envelope edge (a drawn door leaf alone flips this).
9. **Proposal:** one pixel-line gap reader, moved before the envelope, produces the classes `DRAWING_BREAK_SUPPORTED`, `OPENING_SUPPORTED`, `UNKNOWN_GAP` and `TRUE_EXTERIOR_GAP`.
   - The boundary is built from jambs plus classified gaps. It is never built from line closure.
   - Boundary continuity and occupancy stay two separate fields.
10. **Findings:** 3 P0, 7 P1, 6 P2 (§5).

---

## 1. Inventory — every opening-related observation or decision today

`decomposePlan` runs at REGISTRATION: `layout.ts:293` calls it from `readPlans`, and the resolver calls it again for alternatives. The v2 `TOPOLOGY` and `METRICS` phases, where v2 reads its openings, come later (`v2/reconstruct-v2.ts:399`, `:663`).

| # | What | Where (file:function) | Stage / view | Fields | Available when the envelope is computed? | Use for a boundary solver |
|---|---|---|---|---|---|---|
| 1 | Band segments: a band merged across its own gaps | `source-cv/src/bands.ts:runLengthBands` (merge rule, `DEFAULTS` `:65`: `maxGapPx` 90, `maxGapFraction` 0.45); called in `layout.ts:planSheet` (`:344`, `minLength` = 1.6 wall `:347`) | plan read / PLAN | `segments[]`, `pieces`, `fill` | yes | **Unreliable jamb source.** It drops piers shorter than 1.6 wall and L-blocks; its merge gap is in pixels (90 px = 2.0 m on h1, 2.5 m on h2), so whether an opening sits "inside one band" depends on resolution. |
| 2 | Hole ≤ 3.2 m between two pieces on one **edge** | `plan-decomposition.ts:closureOf` (`:653`, rule `:686`), fed by `wallIntervals` (`:507`, along + crossing bands) | inside `decomposePlan` / PLAN | `EdgeClosure.opening` | n/a (it is the flood) | Decisive on 8 of 2261 edges. Per-edge, so a grid line inside the gap hides it: 21 of the audited ≤ 3.2 m band-jamb gaps had one. |
| 3 | Thin-line closure | `lineIntervals` (`:583`), probes ± 0.35 wall (`:1427`), runs ≥ 18 px | inside `decomposePlan` | `EdgeClosure.line` | n/a | Shuts 45 % of all edges. It cannot tell glazing from a kerb, a canopy edge or the watermark (§2.4). **Must not create boundary.** |
| 4 | Wide collinear gaps (3.2–8 m) | `collinearWideGaps` (`:1173`) over `alongWallPieces` (`:1118`, ALONG bands only); `infillAcross` (`:1058`); `calloutAt` (`:1086`) | inside `decomposePlan`, after the envelope | `OpeningEvidence{jambs, infill, callout?, pocketM2?}`, `WideOpeningDecision` | computed after `walledEnvelope` (`:1413`) | The right **type** (keep it). The evidence is weak: ALONG pieces only, infill non-discriminating (P1-2), callout recorded but not deciding. |
| 5 | Pocket test | `decomposePlan` `:1543–1590` (limit `max(6, 2.5 w²)` `:1576`) | inside `decomposePlan` | `pocketM2` | n/a | An enclosure-by-exclusion argument, not an opening signature. It can never shut a garage: at 5 m the limit is 62.5 m² (P1-7). |
| 6 | Bay mouth | `baysOf` (`:1232`): side walls must **start** at the envelope edge (`:1257`) and reach `minOut = max(4 walls, 1.5 m)` (`:1242`); **pier-column scan on the mask** (`:1290–1318`); infill on the inner rows; callout; `corners` | inside `decomposePlan` | `PlanBay`, `WideOpeningDecision(BAY_MOUTH)` | yes (after the envelope) | The pier scan is **the right primitive** (mask, not bands). The "leaving the envelope" precondition fails on flush garages (P0-3). |
| 7 | H0 / H1 enclosure hypotheses | `decomposePlan` `:1596–1633` | inside | `EnclosureHypothesis` | n/a | Keep as a ledger. |
| 8 | Pier-on-line test for side-wall reach | `sideWallReach` (`:1003`), `pierOn` | inside `walledEnvelope` | — | yes | Band-based: it misses mask-only piers. |
| 9 | Opening callouts (ring reader and OCR `w/h` tokens) | `source-metrics/src/callouts.ts:readOpeningCallouts` (`:982`) and `extract.ts:468–540` produce `MetricEvidence(kind OPENING_CALLOUT)` (value, width/height alternatives, `textBox`, `association`); adapted by `layout.ts:planCallouts` (`:355`) and passed as `options.callouts` | metric extraction / PLAN | `PlanCallout{at, widthsCm[]}` | **yes** | Corroboration only. Read rate is sheet-dependent (§2.3). All h1/h2 rings are `UNATTACHED` because no plan opening symbol exists to attach to. |
| 10 | `OPENING_INTERVAL` | `source-analyzer/src/extractors/plan.ts:gapsAlong` (`:87`, gaps in the band **edges** of its own `linearBands`, interior only `:104`) | analyzer / PLAN | SEGMENT, px width | in the graph, not passed to `decomposePlan` | 0 on h1's base plan, 1 on h2's, 2 on willa's. In v2 it is only a ledger disposition (`v2/reconstruct-v2.ts:1227`). **Not usable.** |
| 11 | Elevation / render `OPENING` rectangles | `source-analyzer/src/extractors/elevation.ts:~230–265` | analyzer / ELEVATION, RENDER | RECT, closure-based confidence | not registered to the plan yet | h1 86 and h2 124 elevation rectangles. Usable **after** a boundary exists, to check opening count and order per facade. |
| 12 | v2 wall openings | `v2/openings-v2.ts:readWallOpenings` (after masses, `WallHost` in world metres): `planGaps` (`:101`, `scan.bandPieces` on the raster), `glazingDrawn` (`:357`), `doorSwingDrawn` (`:389`), `calloutCandidates`, family (`GARAGE_DOOR` via `attachedSingleStorey`, `:310`) | METRICS (late) / PLAN + ELEVATION | `OpeningV2` | **no** | The pixel tests are what the boundary needs. Refactor them to take a pixel line so the same detector runs before (boundary) and after (openings). |
| 13 | Recess returns, terrace platform | `v2/recesses.ts:scanZoneForReturns` (`:76`); `v2/terrace.ts:readTerraceExtension` (`:44`), `drawnShareOf` (`:107`) | TOPOLOGY (late) | `RecessTopology`, `TerraceExtension` | no | The returns test is needed earlier, for the recess-mouth rule (§3). |
| 14 | Plan openings (legacy) | `plan-openings.ts:planOpenings`, `refineReveal`, `openingPair` | legacy `reconstruct.ts` only (production uses `reconstructV2`, `analysis-service/src/run.ts:338`) | `PlanOpening` | — | Do not extend. `refineReveal` (sub-pixel jamb) is worth reusing. |
| 15 | Facade rectangle grouping | `openings.ts:groupFacadeOpenings` | legacy | — | — | Not relevant. |
| 16 | "Mouths SHUT" reading | `plan-resolution.ts:mouthsLeftOpen` (`:606`) and `withShutMouths`; `baysOf` `byHypothesis` (`:1338`) | resolver | `PlanReadingChoice.mouths` | yes | One **global** switch per reading (P1-7). |
| 17 | Exterior chain ticks | `metrics.chains` (005B roles, `plan-extent.ts`) | metric / PLAN | `ticksPx`, `baselinePx` | yes | They name facade **lines**: 20 of 21 true facade lines on h1, h2 and willa carry a tick on their outer face (§2.2). Unread chains' ticks never become grid lines (005B F8). |

**The minimum reusable detection.** Build one pure function over a pixel wall line, `readWallLineGaps(mask, raster, line{axis, px, from, to, wallPx}, callouts, chains)`. It assembles primitives that already exist:

- the solid-pier scan: the `baysOf` column scan `:1290`, which is the same idea as `v2/scan.ts:bandPieces`;
- wall-thick connectivity: the mask opening of `wallClusterExtent` (`:1949`), `dilate(erode(mask, 0.3 wall))`;
- the thin-line signature: generalise `glazingDrawn` into a count of distinct lines with offset and continuity;
- `doorSwingDrawn`;
- `calloutCandidates` and `calloutAt`.

Call it in `decomposePlan` **before** `walledEnvelope`, on the grid lines and on exterior-chain tick lines. Have `readWallOpenings` later consume the same classified gaps by pixel geometry instead of re-scanning. That keeps it to one detector.

---

## 2. Measured gap evidence

### 2.1 Method

- **Candidate facade lines** were placed by hand on the true outer walls (after viewing the plans). They are in the spec files.
- **Mask-solid pieces** are columns where at least 80 % of ±0.5 wall across the axis is ink, over runs of at least 0.5 wall. They are independent of bands.
- **Gap** is the space between consecutive pieces.
- **Lines** are thin rows within ±0.75 wall of the axis whose ink covers at least 70 % of the gap:
  - `off` is the row's offset from the axis in px;
  - `runs` counts ink runs (more than 1 means dashed or broken);
  - `L` is the mean luma.
- **Band** says whether a `Band` of the sheet covers the pier.
- **Conn** comes from `posts.ts`: the component of the opened wall-ink containing the pier.
- **Tick** means an exterior chain has a tick within 2 px of the line's outer face.
- **Callout** means a read callout has a width candidate within max(12 cm, 12 %).
- **Today** is what the frozen code did with the gap.

### 2.2 The failing houses

**dom-w-modrzykach (h2)**

- Poché luma 31. The envelope is y 113–186.5, so everything below 186.5 is pre-seeded OUTSIDE.

| Line | Gap (mask) | Printed | Jambs: mask px (band?) | Lines inside the thickness | Callout | Tick | Today | Proposed |
|---|---|---|---|---|---|---|---|---|
| L1 left V@54 | 301–408 = **2.97 m** | 300/230 | 129 / 82 (bands: yes) | 3 (off −11/−4/−1, continuous, L134–144) | no | 46 ✓ | edges shut by **line** (3 grid edges, `l=1`); `opening` 0 | OPENING_SUPPORTED (glazing) |
| T1 living top H@180 | 80–188 = **3.00 m** | 300/230 | 34 (**crossing only**) / 49 | 2 (−5, −3) | no | – | shut by line | OPENING_SUPPORTED (glazing) |
| T2 rooms 7–8 top H@121 | 278–341 = **1.76 m**; 402–437 = **0.99 m** | 180/230; 100/230 | 48/60 and 60/54 | 1 (−4); **0** | no | 113 ✓ | shut by line (grid line 328.5 and 411.5 inside the gaps) | UNKNOWN_GAP, bridgeable by convention (≤ 3.2 m, connected jambs, tick, no returns) |
| T3 garage back H@192 | 534–570 = **1.02 m** | 105/210 | 58 / 149 | 1 (+2) | no | 184.5 ✓ | shut by line | OPENING_SUPPORTED (door, 1 line at the axis) |
| R1 right V@711 | 274–345 = **1.98 m** | 200/100 | 90/90 (yes) | 4 | no | 719 ✓ | shut by line | OPENING_SUPPORTED |
| **G1 garage front H@427** | 515–695 = **4.98 m** | **500/225** | 39 / 24, **no band** (only crossing walls 476–492 and 703–719; gap between band pieces 5.80 m); conn: parts of walls (3.4×5.5 and 1.5×5.6 walls) | 2: **−8 continuous L132 = floor/leaf line at the inner face**; +8 **dashed (16 runs)** = canopy edge on the outer face | **not read** | 435 ✓ | outside the envelope: never weighed; not a collinear gap (no ALONG pieces); no bay | **OPENING_SUPPORTED (vehicle door)**: connected collinear jambs + an anchored inner-face line + side walls reaching (V@480/484, V@711) + tick |
| B1 front rooms 1/2/10 H@497 | 255–292 = **1.04 m**; 343–367 = **0.69 m**; 396–460 = **1.79 m** | 105/210; 70/140; 180/140 | 35/50/28/32, **none are bands** (the 293–342 pier sits under the watermark, **L93**) | 1 (+2); 3; 4 | only 180 (alternative) | 506 ✓ | outside the envelope | door OPENING_SUPPORTED (1 line at the axis); windows OPENING_SUPPORTED |
| B2 kitchen front H@527 | 99–202 = **2.86 m** | 288/140 | 31/31, **none are bands** | 3 | no | 535 ✓ | outside the envelope | OPENING_SUPPORTED |

- A false band sits on the watermark: V@325 [314..336, 506..534], th 23.
- Only 33 bands exist on the whole sheet.

**dom-w-zurawkach (h1)**

- Poché luma 0. The envelope is y 95–456; the wing below 456 is pre-seeded OUTSIDE, and there are no bays.

| Line | Gap (mask) | Printed | Jambs | Lines | Callout | Tick | Today | Proposed |
|---|---|---|---|---|---|---|---|---|
| L left V@270 | 236–315 = **1.77 m** | 180/230 | 87/87 (the band merged **across** the gap: segments 192–230 and 319–386, gap 89 px ≤ 90) | 2 | no | 260 ✓ | shut by line | OPENING_SUPPORTED |
| L/B south-west corner | no poché at the corner: the door on the left wall and the opening on the front meet in thin lines | 100/230 + 200/230 | one jamb each (402 on L, 359 on B) | 3 on B, 1 on L | no | ticks 260 × 456 cross at the corner | shut by line | OPENING_SUPPORTED on both lines, **corner rule** (§3.5) |
| B house front H@445.5 | 533–576 = **0.98 m** | 100/210 | 174/34 | 1 (+1) | no | 456 ✓ | shut by line | OPENING_SUPPORTED (door) |
| **GF garage front H@513** | 637–753 = **2.60 m** | **260/229** | 39/39, **no band**; conn: wall network (4.3×11.4, 2.8×10.4 walls) | 1 (−10, continuous, L119, ext 7/6 = stops inside the jambs) | **not read** (of the sheet's 5 rings, only one, a `60/150`, is a real callout read right) | 523.5 ✓ | wing outside the envelope; **no bay**: V@782 is one band 116–503, **through** the edge, and V@609 reaches 1.04 m < `minOut` | **OPENING_SUPPORTED (vehicle door)** |
| GR right V@782 | 299–378 = **1.77 m** | 180/130 | 204/145 | 3 | no | 792 ✓ | shut by line | OPENING_SUPPORTED |
| T top H@105 | 619–645 = **0.60 m**; 725–750 = **0.58 m** | 60/150 ×2 | connected | 2; 2 | one reads 60 | 95 ✓ | shut | OPENING_SUPPORTED |

- The porch strip (x 260–598, y 456–523.5) has no piers on its front or left side, only terrace line work.
- By the 005B report's own arithmetic it must stay OUTSIDE: the box minus the strip is 100.85 m² against 101.7 m² published.

**willa-miranda**

- Poché luma 24.
- Today's extent is the interior chain (y 355–449.5), so none of these gaps is weighed at all: `decomposePlan` drops bands outside the extent (`:1390–1398`).

| Line | Gap (mask) | Printed | Jambs | Lines | Callout | Tick | Proposed |
|---|---|---|---|---|---|---|---|
| WL left V@243 | 270–347 = **2.09 m** | 210/230 | 92/112 | 2 | no | 234.5 ✓ | OPENING_SUPPORTED |
| WT1 H@184 | 263–351 = **2.39 m** | 240/230 | 28/25, **no band** | 3 | no | 176 ✓ | OPENING_SUPPORTED |
| WT2 H@93 | 411–540 = **3.49 m** | 350/230 | 43/43, only 25 px of band | 2 | no | 84.5 ✓ | OPENING_SUPPORTED (glazing, > 3.2 m) |
| WT3 H@184 | 616–655 = **1.07 m** | 110/230 | 49/139 | 1 (−1) | 116 (alternative) | 176 ✓ | OPENING_SUPPORTED |
| WR V@785.5 | 269–318 and 430–479 = **1.34 m** each | 135/135 ×2 | connected | 3; 3 | 135 (alternative), once | 794 ✓ | OPENING_SUPPORTED |
| **WG garage front H@602** | 571–756 = **4.99 m** | **500/238** | 38/38; the right pier is **not a band** (V@785.5 ends at 593); conn: wall network | 1 (−8, continuous, inner face) | **not read** | 610.5 ✓ | **OPENING_SUPPORTED (vehicle door)** |
| WB front H@510.8 | 429–498 = **1.88 m** | 190/210 | 97/52 | 1 (0, 4 runs) | 190 (alternative) | 519 ✓ | OPENING_SUPPORTED (door) |
| **WP porch line H@599** | 398–532 = 3.62 m | — | **16 px post, FREE-STANDING (1.3×1.3 walls)** / garage corner | **0** | — | 610.5 (the same tick as the garage front) | **TRUE_EXTERIOR_GAP** (post) |
| **WX terrace posts V@120** | 106–246 = 3.78 m | — | 18/18 px, **both free-standing** (1.5×1.5 walls) | 0 | — | — | **TRUE_EXTERIOR_GAP** |

- The porch post (x 382–397, y 592–607) is collinear with the garage front to within 3.5 px.
- The chain tick (610.5) does not discriminate: only connectivity does.

### 2.3 Cross-cutting measurements

- **Width.** On 39 of 39 opening gaps across h2, h1, willa, Kosaćce and Marcówki, the mask-piece gap is within **≤ 0.04 m** of the printed width. The median deviation is about 0.02 m.
  - The gap is therefore a metric-grade reading of the opening, even where no callout is read.
  - The current agreement tolerance, `calloutAt` `:1106` at max(35 cm, 12 %) (±60 cm at 5 m), is 15× looser than any measured real deviation.
- **Callouts.** Gaps with a read callout that agrees:

  | House | Agreeing |
  |---|---|
  | Kosaćce | 7 of 9 |
  | Marcówki | 6 of 6 |
  | willa-miranda | 3 of 8 (all via alternatives) |
  | h1 | 1 of 6 |
  | h2 | 1 of 11 |

  - 4 of h1's 5 rings are misplaced (furniture, stair); the fifth reads a `60/150` correctly.
  - h2's 11 rings are mostly `406/400`-type misreads.
  - G2E's 4.00 m glazing and its garage bay were decided with read callouts (`410`, `500`). e-OZE's 4.45 m glazing was decided on its drawn line alone. The three failing garages had no read callout.
- **Thin-line signature**, 44 measured gaps:

  | Family | Lines inside the thickness |
  |---|---|
  | Windows and glazed walls | 2–4 lines, continuous |
  | Doors | 0–1 line at the axis (\|off\| ≤ 2 px) |
  | Garage doors | exactly 1 continuous line at the **inner face**, off −8 to −10 px = 0.5–0.7 wall (h2, h1, willa, Marcówki), plus possibly a **dashed** outer-face canopy line (h2 +8, 16 runs) |
  | Terrace, porch and post mouths | 0 lines (willa WP, WX; Kosaćce east terrace 4.62 m; the Marcówki terrace corner) |

  - Blank mouths are pale: mean luma 206 (Kosaćce top), 245 (Marcówki corner mouth) and 210 (Marcówki side).
- **Jamb darkness.**
  - Poché is luma 0–31 on the five sheets.
  - Vegetation symbols that pass the 80 %-solid test are luma 157 (Kosaćce east line).
  - A real pier under the watermark is luma 93 (h2).
  - So "dark relative to this sheet's poché" separates them. A fixed threshold would not.
- **Posts against jambs.** In the wall-thick ink:
  - posts are isolated at 1.3–1.5 walls (willa porch post and both terrace posts);
  - a Kosaćce tree symbol is 2.1×2.4 walls;
  - every garage jamb on h1, h2 and willa is part of a component whose long side is 5.5–11.4 walls.
  - Kosaćce's covered-terrace post is thinner than the opening radius (no wall-thick ink). By the ≥ 80 %-solid test it is no jamb at all.
- **Tick lines.** 20 of 21 true facade lines on the three failing houses carry an exterior-chain tick on the outer face, mostly on **unread** chains (willa V@69.5; h1 V@64.5).
  - Ticks also mark non-wall lines: Marcówki's 1.0 m terrace/eave zones at 221 and 773, and willa's porch at 610.5.
  - A tick says "a facade line is here". It does not say "this span of that line is wall".

### 2.4 What shuts edges today, and what the envelope is really doing

| Run | Edges | Shut by wall | Shut needing the line term | Needing the `opening` term | Open |
|---|---|---|---|---|---|
| 13 plan readings, 8 houses (`edges.ts`) | 2261 | 495 | 1011 | **8** (G2E 5, jabłonkach attic 3) | 747 |

- **Envelope removed**, flood unchanged (`noguard.ts`: a verbatim copy of `decomposePlan`, only `envelope` overridden):

  | House | With envelope | Without envelope |
  |---|---|---|
  | h2 | 26.0 m² | **200.2 m²** (published 181.98): the terrace (top left) and the entrance zone become BUILT; only the garage apron stays out |
  | h1 | 69.0 m² | 78.3 m²: **porch strip BUILT**, garage still OUTSIDE (its front edge is open at y 523.5; the piers are not bands, there is no grid line on the door) |
  | Kosaćce | 166.2 m² | 166.2 m² |
  | Marcówki | 130.8 m² | 135.7 m² |

- **An existing leak on a PASS house.** Kosaćce's covered terrace has cell x 520–555.5 × y 179.5–333 (**3.16 m²**) BUILT today.
  - It lies under the ARCHON watermark, whose strokes close its edges through the line term.
  - The rest of the terrace (loungers, 4 posts at x≈437/635, y≈197/330) is RECESS or OUTSIDE.

**Conclusion.** 005C cannot simply widen the envelope. It has to replace the envelope's guard role with a boundary built only from jambs and classified gaps, and keep "outside the boundary = outside by construction" (`:1515–1526`).

---

## 3. Proposed gap classification

### 3.1 Evidence primitives

Each primitive is per gap on a candidate wall line with thickness t (the line's own).

| Id | Evidence | Rule (measured basis) |
|---|---|---|
| E1 | **Jamb** | A mask-solid run on the line on each side (≥ 80 % of t across, ≥ 0.5 t long), median luma ≤ sheet poché luma + 70. Poché is the band pixels' median; measured 0–31 against vegetation 157 and a watermarked pier 93. **Type**, from the opened wall-ink component: `ALONG` / `CORNER` / `PIER` if the component extends ≥ 2.5 t (**connected**); `POST` if the component is ≤ 2.5 t × 2.5 t (isolated). **POST is never a jamb.** |
| E2 | Collinear | Jamb axes within 0.5 t of the line; thickness within ±35 % of each other. |
| E3 | Glazing | ≥ 2 distinct thin lines strictly inside the thickness band, each continuous (1–2 runs) over ≥ 70 % of the gap. |
| E4 | Leaf / threshold | Exactly 1 continuous line inside the thickness, not on or beyond the outer face, not dashed, and ending in or at the jambs (it does not run on past the jambs' far ends). At the axis it is a door; at the inner face (0.4–0.8 t) and ≥ 2.2 m wide it is a vehicle door. |
| E5 | Swing | An arc tangent at a jamb with radius ≈ w (or w/2), on one side. **ASSUMPTION:** reliability not measured; `doorSwingDrawn`'s 2–25 % ink square is noisy (furniture). |
| E6 | Callout | A read width candidate within **max(10 cm, 3 %)** (all 39 real gaps within 4 cm), within reach, and nearer this gap than any other gap. Absence is **not** evidence. |
| E7 | Tick | An exterior-role chain tick on the line's outer face (±0.5 t). Line-level only. |
| E8 | Sides | For a vehicle-width gap: both perpendicular walls meeting the jambs are walls of the building (connected, ≥ 1.5 m), meaning the jambs are corners of a wing. |
| E9 | Returns | Perpendicular walls start at **both** jambs, run inward ≥ 1 m and meet a back wall parallel to the line: a recess mouth (the returns rule of `v2/recesses.ts`, moved earlier). |
| E10 | Blank | No thin line covers ≥ 50 % of the gap inside the thickness, and mean luma ≥ 200 (measured 206–245 on terrace mouths). |
| E11 | Behind | The pocket test (`:1543`): an argument by exclusion, used only to rank UNKNOWN alternatives. |

### 3.2 Classes

| Class | Evidence | Boundary continuity | Occupancy in the model |
|---|---|---|---|
| **DRAWING_BREAK_SUPPORTED** | The mask is ≥ 80 % solid across t along ≥ 90 % of the "gap", at poché darkness. This is a band artefact at a junction or under a crossing line: 16 measured band "gaps" of 6–24 px, whose darkest row is poché (luma 0–31), on h2, h1, willa, Kosaćce and Marcówki. Or a collinear gap ≤ 0.5 t with solid ink. | STRONG | **SOLID wall** |
| **OPENING_SUPPORTED** | E1 (connected, both sides) ∧ E2 ∧ w ≤ 8 m ∧ ¬(E9 ∧ E10) ∧ at least one of: **E3**; **E4** (a door when w ≤ 1.4 m, a vehicle door when w ≥ 2.2 m ∧ E8); **E6**; E5. Confidence is **high** with two or more of {E3/E4/E5, E6, E7+E8} and **medium** with one. | STRONG | **OPENING** (void; family and width from the gap, callout if read). Never solid, never outside. |
| **UNKNOWN_GAP** | (a) E1 connected both sides ∧ E2 ∧ w ≤ 3.2 m ∧ no signature ∧ ¬E9. Example: h2's 100/230 door (0 lines); symbols removed. (b) A signature exists but one side is missing or a POST that is not a corner case. (c) 3.2 m < w ≤ 8 m with only E7/E8/E11. | WEAK: (a) may close in the first reading only when the rest of the cycle is STRONG and the line has E7; (b) and (c) are resolver alternatives, **one gap per alternative** | OPENING if bridged |
| **TRUE_EXTERIOR_GAP** | Any of: a side is a POST or nothing (the wall ends: END); E9 ∧ E10 (recess mouth: loggia, recessed entrance, covered terrace); E10 ∧ w > 3.2 m; w > 8 m; the only "infill" is on or beyond the outer face, dashed, or runs on past both jambs. | NONE, and **binding**: the flood must see this edge as open whatever the edge's wall fraction (P1-4) | EXTERIOR |

### 3.3 Width caps

- **The 3.2 m convention** no longer shuts anything by width alone. It only lets a jambed, blank, return-free gap be a WEAK UNKNOWN.
- **Between 3.2 and 8 m**, a signature is required: E3; or E4 at the inner face with E8; or E6.
  - Jambs alone never suffice. This keeps the existing contract "piers alone do not shut a mouth" (`wide-openings.test.ts`).
- **Above 8 m** a gap is never an opening. It can close only as intermediate evidence splits it (a mullion or pier found by the mask scan) or as a DRAWING_BREAK.
- **When one** is read, the callout's width replaces the gap width. Otherwise the mask width stands (±0.04 m measured).

### 3.4 Repeated collinear support (a facade of short piers)

Repeated collinear support counts **per gap**, never instead of it.

- **What upgrades a line.** A facade line with ≥ 2 connected jambs of consistent thickness (±35 %), every gap between them classified OPENING or UNKNOWN (none TRUE_EXTERIOR), and E7 on the line is a **supported facade line**.
- **What that allows.** Its UNKNOWN(a) gaps may close in the first reading.
- **Posts never count** (willa's porch). Dense symbols darker than a line but paler than poché never count either (Kosaćce trees, luma 157).
- **Measured example.** h2's B1 has 4 connected piers (35/50/28/32 px, none a band), gaps of 1.04/0.69/1.79 m with signatures 1/3/4 lines, and tick 506.

### 3.5 Corners, and how the flood uses the classification

- **Corner rule** (h1 south-west). Where two facade lines meet at a corner with no poché, the corner may be joined when:
  - both lines carry E3/E4 up to the corner;
  - both lines are E7-ticked;
  - the corner point lies on the two ticks.
  - Otherwise the corner is UNKNOWN(b).
- **The boundary** is a cycle of jamb pieces plus DRAWING_BREAK plus accepted OPENING/UNKNOWN gaps.
  - Cells outside it stay pre-seeded OUTSIDE: the envelope rule, with a polygon instead of a box.
  - Inside it, the line term may still shut interior edges.
  - The line term never adds boundary.
- **A bridged gap's edge** gets `closure = 1` with `opening = 1 − wall` and a **gap id**, so v2 openings take it as an opening.
- **A TRUE_EXTERIOR edge** gets `closure = 0` explicitly.
- **The printed extent** is an upper bound: a boundary outside it is refused.
- **The published footprint** scores alternatives but never chooses between drawing-equal readings (005A rule, kept).

### 3.6 Boundary continuity against solid wall presence

For each gap the record keeps two separate fields:

- `boundary`: STRONG / WEAK / NONE;
- `occupancy`: SOLID / OPENING / EXTERIOR.

**The garage case:** wall + 5 m door + wall is one exterior boundary line (STRONG), and the door is `occupancy = OPENING` (family GARAGE_DOOR). The garage cells are BUILT, and the model keeps a 5 m hole.

The same record feeds:

- the wall witness: join across STRONG gaps. This would give willa-miranda's witness the whole building.
  - **ASSUMPTION:** a planter would be excluded by the POST/luma rules. This is not measured on dom-w-jablonkach, where 005B's naive join failed.
- the side-wall reach;
- the openings stage.

---

## 4. Negative and adversarial cases

Synthetic cases were run through today's `decomposePlan` with `adversarial.ts`, using the test helpers (5 cm/px, walls 12 px).

| Case | Expected class | Today (measured) |
|---|---|---|
| A1: 2.4 m recessed entrance / loggia, returns + back wall, nothing across | TRUE_EXTERIOR (E9 ∧ E10) | **pocket BUILT** (192 m², the loggia enclosed) ✗ |
| A1b: same, plus a paving line on the outer face running past both jambs | TRUE_EXTERIOR | a gap of 3.65 m read as `OPENING_IN_WALL`, infill 1 ✗; pocket BUILT ✗ |
| Unsupported large collinear gap (A8: 6 m blank, no infill or callout, shallow zone behind) | UNKNOWN (c), not bridged | decided `OPEN_SIDE`, but the zone is **BUILT**: the edge spanning it is 62.5 % wall ✗ (non-binding) |
| Covered terrace with columns collinear with the front (A2) | TRUE_EXTERIOR (POST) | OUTSIDE ✓, only because it lies outside the envelope |
| Real: willa's porch post collinear with the garage front | TRUE_EXTERIOR | not reached (wrong extent); **0 lines, a free-standing 16 px post** |
| Real: Kosaćce covered terrace | TRUE_EXTERIOR | RECESS/OUTSIDE, **except a 3.16 m² strip BUILT via watermark lines** ✗ |
| Pergola (A3: posts + beams) | TRUE_EXTERIOR | OUTSIDE ✓ (envelope) |
| True courtyard (A4: 4.0 × 4.4 m between wings) | TRUE_EXTERIOR (E9 ∧ E10) | RECESS ✓ (width > 3.2 m and a pocket). A courtyard ≤ 3.2 m wide would fail like A1 (**ASSUMPTION**, by A1) |
| Corner window (A5, glazing both sides, no corner block) | OPENING_SUPPORTED + corner rule | BUILT ✓ (glazing lines) |
| 70 %-open glazed facade (A6) | OPENING_SUPPORTED each | BUILT ✓ (envelope null; lines carry it) |
| 70 %-open facade, symbols removed, 1 m piers (A6b) | UNKNOWN(a) each; a supported line only with E7 | **0 m² built, whole house OUTSIDE** ✗ (piers not bands; no envelope) |
| Short-pier facade, 0.4 m piers, glazed (A7) | OPENING_SUPPORTED | BUILT ✓ (lines) |
| Garage wing flush with the house side, 4.6 m door with an inner-face leaf (A9) | OPENING_SUPPORTED (vehicle) | garage **OUTSIDE**, **no bay** ✗: the leaf row makes the flush wall one band through the edge (V 348–359 × 52–408) |
| Same without the leaf, dashed edge only (A10: carport or undrawn door) | UNKNOWN(c): alternative only | bay found, `OPEN_SIDE`, garage OUTSIDE ✓. The bay appears only because the pier widened the band to 24 px and blocked the merge |
| Real: h1 porch strip (7.5 × 1.5 m) | TRUE_EXTERIOR (no jambs on its front or left) | OUTSIDE ✓ with the envelope; **BUILT without it** |

---

## 5. Findings

| # | Sev | Where | Finding | Evidence |
|---|---|---|---|---|
| P0-1 | **P0** | `walledEnvelope` `:928` and `longBands` `:756`; flood pre-seed `:1515–1526`; `lineIntervals` `:583` | **The long-band box is the only guard against line-closed exterior zones.** Its failure (a facade of openings has no long band) is the three-house defect. Removing it without gap semantics over-encloses, because the line term shuts terrace, porch and watermark edges. | Edges: 1011 of 2261 need the line term and 8 need the opening term. No guard: h2 26 → 200.2 m² (published 181.98, terrace and entrance BUILT); h1 porch strip BUILT; garage still OUTSIDE. |
| P0-2 | **P0** | `layout.ts:planSheet` `:344–348` (`minLength` 1.6 wall); `wallIntervals` `:507`; `alongWallPieces` `:1118`; `sideWallReach.pierOn` `:1003` | **Jamb evidence is band-only, and bands drop short and L-shaped piers.** The mask pier scan exists only inside `baysOf` (`:1290`). | h2: G1 and all B1/B2 piers are not bands (33 bands on the sheet). h1: GF piers are not bands. willa: WG right pier is not a band. The mask scan recovers all of them; widths within ≤ 0.04 m on 39 of 39 gaps. |
| P0-3 | **P0** | `baysOf` `:1257` (starts at the edge), `:1242` (`minOut` to the band end); band merge `source-cv/src/bands.ts` (`maxGapPx` 90 / `maxGapFraction` 0.45) | **Bay detection depends on how bands happen to be merged.** A flush garage wall is one band through the edge. A drawn door leaf, which is evidence **for** a door, merges the flush wall and removes the bay. | h1 V@782 116–503; willa V@785.5 193–593; synthetic A9 (leaf → no bay) against A10 (no leaf → bay). |
| P1-1 | P1 | `calloutAt` `:1086–1110`; `source-metrics/src/callouts.ts` | **Callouts cannot be required.** Their tolerance is far too loose, and nothing checks a callout is nearest this gap rather than another. | Agree rates 7/9, 6/6, 3/8, 1/6, 1/11. None of the three failing garage callouts was read. Real deviation ≤ 0.04 m against a tolerance of ±60 cm at 5 m. |
| P1-2 | P1 | `infillAcross` `:1058`; rows at `:1187` (band ±1, faces included) | **`infill` does not discriminate.** It is the longest stroke in any row: glazing, floor edge, dashed canopy, watermark and paving all score about 1. | Infill is 1.0 on almost every measured gap. A1b: an outer-face paving line turns a loggia into `OPENING_IN_WALL`. The line count/offset/continuity signature separates the families (§2.3). |
| P1-3 | P1 | `closureOf` `:653`, `:686` (per edge) | **The ≤ 3.2 m convention cannot tell a narrow recess mouth from a door.** And per-edge holes are hidden by any grid line inside the gap, often a chain tick at a jamb. | A1: a 2.4 m loggia with returns comes out BUILT. 21 audited ≤ 3.2 m band gaps have a grid line inside; they are shut by the line term instead. |
| P1-4 | P1 | flood `open()` and closure union in `closureOf` | **`OPEN_SIDE` / TRUE_EXTERIOR is not binding.** An edge that is ≥ 62 % wall shuts even when it spans a gap decided `OPEN_SIDE`. | A8: 6 m blank gap decided `OPEN_SIDE`, zone BUILT. |
| P1-5 | P1 | any new "repeated collinear support" rule | **Posts must be excluded by connectivity.** Thickness and darkness do not separate them. | willa porch post 16×16 px, free-standing, 3.5 px off the garage-front line (gap 3.62 m ≤ 8 m); terrace posts 18 px. Every garage jamb belongs to a wall component 5.5–11.4 walls long. |
| P1-6 | P1 | line term; `runLengthBands` | **The ARCHON watermark acts as ink.** It closes cells, creates a band, and greys a real pier. | Kosaćce strip BUILT (3.16 m²); h2 false band V@325; h2 pier L93 against poché 31. |
| P1-7 | P1 | pocket limit `:1576`; `plan-resolution.ts:606` | **The pocket test can never shut a garage** (5 m gives 62.5 m²). The "mouths SHUT" alternative is global, so a real loggia and a real garage on one sheet cannot be read differently. | Arithmetic; resolver code. |
| P2-1 | P2 | `source-analyzer/src/extractors/plan.ts:87–104` | `OPENING_INTERVAL` is unusable as a feed. | 0/1/2 on the base plans of h1/h2/willa; used only in a ledger (`v2/reconstruct-v2.ts:1227`). |
| P2-2 | P2 | `v2/openings-v2.ts:101,357,389` | The right pixel tests run too late, in world coordinates. Refactor to a pixel-line API shared before and after (a single detector). | — |
| P2-3 | P2 | `source-analyzer/src/extractors/elevation.ts` | Elevation openings need the world frame. Use them only to verify opening count and order per facade after the boundary. | h1 86 and h2 124 rectangles. |
| P2-4 | P2 | `plan-openings.ts` | Legacy only; not on the production path. `refineReveal` is worth reusing for sub-pixel jambs. | `analysis-service/src/run.ts:338`. |
| P2-5 | P2 | `source-cv/src/bands.ts` merge | Merge gaps are in pixels (90 px), so "the opening is inside a band" depends on resolution. | h1's 1.97 m band gap is merged; h2's 5.0 m is not. |
| P2-6 | P2 | — | **ASSUMPTION:** floor tint (interior grey against exterior white or stipple) could be an occupancy cue. It is publisher-dependent and was not measured. | — |

### Tests to add

1. **Synthetic, in `wide-openings.test.ts` style:**
   - A1 and A1b: a ≤ 3.2 m loggia stays RECESS; an outer-face paving line is not infill.
   - A8: TRUE_EXTERIOR is binding.
   - A9: a flush garage wing with an inner-face leaf is BUILT, and its door is an opening in the model.
   - A10: the no-door case is not built in the first reading.
   - A6b: a symbols-removed 70 %-open front is WEAK, not lost.
   - A2 and A3: posts and pergola stay OUTSIDE.
   - A courtyard ≤ 3.2 m wide.
   - A5: corner window.
   - A post collinear with a garage front.
   - A watermark-grey pier (still a jamb) and a grey dense symbol (not a jamb).
   - A dashed outer-face canopy line.
2. **Unit tests for the gap reader:**
   - mask width ±2 px;
   - thin-line count, offset and continuity;
   - POST against PIER connectivity;
   - callout agreement at max(10 cm, 3 %), nearest gap only;
   - a DRAWING_BREAK at a junction.
3. **Development rows** (text facts only, drawings not committed):
   - h2 G1: OPENING_SUPPORTED at 4.98 m;
   - h1 GF: OPENING_SUPPORTED at 2.60 m, and the porch strip TRUE_EXTERIOR;
   - willa WG: OPENING_SUPPORTED at 4.99 m; porch and terrace posts TRUE_EXTERIOR;
   - Kosaćce covered terrace: no BUILT cell (fixes today's 3.16 m² strip);
   - Marcówki terrace corner: TRUE_EXTERIOR;
   - G2E bay and e-OZE 4.45 m glazing unchanged;
   - Marcówki and both Kosaćce links byte-stable except the watermark strip, recorded as an intended change.
4. **A metamorphic test:** delete the glazing lines of a real opening while keeping its jambs, and the class must drop from OPENING to UNKNOWN, never to TRUE_EXTERIOR. Delete one jamb, and a mid-facade gap must become UNKNOWN(b) or TRUE_EXTERIOR, never OPENING.
