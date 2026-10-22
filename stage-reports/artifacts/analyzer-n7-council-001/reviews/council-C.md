# N7-COUNCIL — Reviewer C (plan / structural layout)

HEAD 6788e7d, read-only on production code. Harnesses (research only, invented fixtures, nothing written into the repo
besides these scripts; no publisher raster touched):

- `research/analyzer-n7-council/C/probe-layout.ts`: 17 variants SOURCE→LAYOUT→MassV2→program→validator→model, flags rings < 2T per storey, body counts
- `research/analyzer-n7-council/C/probe-wings.ts`: wing / notch / second-wing variants, dumps regions, unresolved, storey digests
- `research/analyzer-n7-council/C/probe-tiling.ts`: largest-first tiling and set-back garage variants
- `research/analyzer-n7-council/C/probe-merge.ts`: full-depth garage: roof, rings, walls on the house/garage line
- `research/analyzer-n7-council/C/probe-thin-gap.ts`: unit-level `thinBodies` coverage, asserts
- `research/analyzer-n7-council/C/render-plan.ts`: renders one invented plan to the scratchpad (outside the repo)

Run all of them from the repo root with `npx vite-node research/analyzer-n7-council/C/<file> [-- --only <code>] [--gaps|--all]`.
A full end-to-end run takes about 6 s per fixture.

## Answer to the central question (the owner's `ring-attached-1-0`)

1. **Where attached ids come from.** `reconstruct-v2.ts:424-428` names attached bodies in layout order. Layout order
   is base-region order, and `mergeRegions` (`plan-decomposition.ts:2301`) sorts that by area, largest first. So
   `attached-1` among 3 masses is the **smallest** base-plan region. Every layout mass is measured on the BASE
   storey (`layout.ts:2000-2025`). In every fixture where the base plan is the ground plan, storey 0 is the measured
   storey and `rectAt(m,0)` is the body's own rectangle, not a `storeyRect`.
2. **`storeyRects` and pieces are always at least `minSpanM` wide, by construction** (`layout.ts:storeySupportOf`).
   They need `ox, oz ≥ minSpanM = max(1, 2·wallM+0.2)`. The `side()` snapping only grows a piece, and `onlySeams`
   only merges pieces into their box. So a storey that is not the measured one cannot get a rectangle < 2T while T ≈ wallM.
   The 17+18 end-to-end variants produced **no** ring < 2T from a `storeyRect` or a piece. The thin rings seen were
   all measured base regions: SLIVERTON and its derivatives.
3. **The adjudicator still has a code-level hole there.** `thinBodies` (`v2/thin-body.ts:112`) skips every body with
   `storeyRects` and every piece, and checks only the measured rectangle, never `rectAt(m,s)`. This is reachable only
   if T (decomposition `wallThickness.m`) exceeds the sheet-level `wallM` used for `minSpanM` by more than 0.1 m, or
   if T > 0.5. See C-4 and C-5.
4. **Most probable reading of the owner's case.** `attached-1` is a smallest-region body measured on the ground
   plan, narrower than 2T. `thinBodies` saw it and returned KEEP_PARTIAL, or the screen shows a stored older result.
   No layout mechanism in my scope narrows a correct ground-storey body *after* it is measured: masses are mutated
   only at `reconstruct-v2.ts:480` (`narrowMass`, research), `:1063` (WIDEN) and `:1071` (SOLID_WALL splice).
   A thin smallest region comes from the decomposition, which C-1 and C-2 show is fragile. **Not confirmed for the
   owner's house.**

The defects I did reproduce make the model wrong *without* any refusal: bodies merged, bodies lost, phantom bodies.
They are more dangerous than the refusal, because the preview says COMPLETE.

## Findings

### C-1 CONFIRMED_DEFECT: largest-first tiling crosses drawn walls; a garage is merged into the house, a phantom body appears

- **FIRST_BAD:** `plan-decomposition.ts:mergeRegions` (2301). It tiles same-class cells into the largest rectangle
  without asking whether the grid line between cells carries a wall. `planBodies` (2611) can only *merge* regions,
  never split one along a drawn wall. The layout then builds one mass per region (`layout.ts:2000`).
- **Input:** HOLLOWAY with its one-storey garage deeper than the house's remaining depth, so that the 12 × d
  house+garage rectangle is larger than the 8.4 × 10.2 house.
  - `t-strip120`: garage 3.6 × 9.0 at offsetZ 1.2.
  - `m-full`: garage the full 10.2 deep.
  - `m-wide6`: garage 6 × 8.
  - Two wings that fill the side: `w-gap0-11`, `w-gap05-11-nodoor`, `w-gap1-11-nodoor`, `w-gap1-21-nodoor`.
- **Current behaviour:**
  - main = 0..12 × 0..10.2 on storey 0, with `storeyRects` s1 = 0..8.42.
  - The garage's flat roof is gone, and the main gable footprint is 12 m wide (`mainRoof.footprint x1=12`).
  - The drawn house/garage wall becomes an INTERIOR partition `main-iwall-0-z-0`.
  - In `t-strip120` the house's leftover 8.4 × 1.2 strip becomes `attached-0`, a **phantom two-storey body**. Its
    ring builds a wall across the house at z = 9 on both storeys, where the plan draws none.
  - In `m-wide6` there is no main roof at all.
  - In the two-storey-wing variant the upper wing piece is dropped as "meets the main piece" (AMBIGUOUS).
  - The gate sees it: `STRUCTURAL_LAYOUT_REJECTED` with 4 × BLOCKING `STRUCTURE_SILHOUETTE_DISAGREES`. That code is
    deliberately outside `LAYOUT_REFUSAL_CODES` (`plan-diagnostics.ts:264`), so the preview is **COMPLETE**.
- **Correct behaviour:** a grid line carrying wall over most of its length between two cells ends a region. The house
  (8.4 × 10.2, two storeys) and the garage (one storey, flat roof) stay two bodies, and no strip body is made.
- **Test passing wrongly or missing:** none covers a wing whose depth makes house+wing the largest rectangle.
  HOLLOWAY passes only because 3.6 × 6 is small. `structural-audit.test.ts` covers the silhouette code, not this input.
- **Reproduce:** `npx vite-node research/analyzer-n7-council/C/probe-merge.ts` and
  `npx vite-node research/analyzer-n7-council/C/probe-tiling.ts -- --only t-strip120`.
- **Impact:** wrong body count, wrong roof, elevation mismatch, a phantom wall; silent apart from the gate code.

### C-2 CONFIRMED_DEFECT: a garage set back 0.30 m from the house front, with a 2.4 m door, is lost silently

- **FIRST_BAD:** `plan-decomposition.ts:decomposeCore`, the edge closure and flood fill (2005-2260). The set-back
  garage front edge is not shut, even though the H0 rule shuts doorways up to `maxOpeningM` = 3.2 m between two
  pieces of wall. The flood enters, and the garage cells become RECESS, then OUTSIDE (`builtSides` < 2, 2236-2250).
  The exact closure term was not pinned; the wall pieces either side of the door are probably not seen on that
  grid line (compare the comment at 603-608).
- **Input:** `gb-setback-door`: HOLLOWAY, garage offsetZ 3.9, depth 6.0, chainsZ [3.9, 6.0, 0.3].
- **Controls, run with the same harness:**
  - The same garage flush with the front: found.
  - The same with no door, or with a 1.0 m door: found.
- **Current behaviour:**
  - One body, 8.4 × 10.2.
  - Gate `STRUCTURAL_LAYOUT_ACCEPTED`, preview COMPLETE.
  - **No unresolved item names the 21.6 m² garage.** The printed 3.6 m chain segment spans only "outside".
  - The same happens in `t-strip030-rear`, `t-two-strip` and `t-two-strip-b`: every garage that does not reach the
    plan's edge and has a wide door is lost.
- **Correct behaviour:** the garage is a body, or at least an unresolved MISSING "enclosed by wall on three sides
  plus a 2.4 m gap, spanned by a printed chain segment".
- **Missing test:** a set-back attached garage with a wide door.
- **Reproduce:** `npx vite-node research/analyzer-n7-council/C/probe-tiling.ts -- --only gb-setback-door --gaps`.
- **Impact:** lost correct body; wrong footprint, which only a published-area check can catch.

### C-3 CONFIRMED_DEFECT (minor dimension): a set-back garage is pulled flush to the house front

- **Input:** `gb-setback-nodoor` and `gb-setback-door1`. The garage is drawn from z 3.9 to 9.9.
- **Current behaviour:** the layout region is 3.90..10.20, so the v2 body is 0..6.30 deep against 6.00 drawn. The
  0.30 m strip in front of the garage, open on two sides, is added to it.
- **FIRST_BAD:** the base-region cut, between the `decomposePlan` region and the layout region (`layout.ts:1925`,
  `regionOf` / `toOuterFaces` / `bayStripsOf`). Not pinned further.
- **Correct behaviour:** depth 6.0, with the 0.3 m front step kept.
- **Reproduce:** `npx vite-node research/analyzer-n7-council/C/probe-tiling.ts -- --only gb-setback-nodoor --gaps`.

### C-4 COVERAGE_GAP: `thinBodies` never adjudicates a thin `storeyRect`, a thin piece, or a thin body that also has `storeyRects`

- **Where:** `v2/thin-body.ts:112`, `if (m.role !== 'ATTACHED' || m.pieceOf || m.storeyRects?.length) continue`. It then
  tests only `m.x0..x1 / z0..z1`. The emitter, however, builds each storey from `rectAt(m, s)` (`emit.ts:186`).
- **Shown:** `npx vite-node research/analyzer-n7-council/C/probe-thin-gap.ts`. Three of four constructed thin rings
  report SKIPS:
  - (B) a thin measured body with a storey-1 `storeyRect`;
  - (C) a wide body with a thin storey-0 `storeyRect`, which is exactly a `ring-<id>-0` built from a `storeyRect`;
  - (D) a thin piece.
  The script asserts this.
- **Reachability:** blocked today by C-2's twin invariant, `minSpanM ≥ 2T`. It becomes reachable when C-5 holds.
  If it happens, the ring goes straight to WALLS_OVERLAP with no thin-body record, which is the owner's symptom.
- **Correct behaviour:** iterate `(m, s)` over `rectAt(m, s)`, or assert `minSpanM ≥ 2T` and fail loudly.
- **Missing test:** none constructs a `storeyRect` or piece narrower than 2T.

### C-5 HIGH_RISK: two wall thicknesses

- `layout.ts:1848`: `wallM = base.wallPx · max(mpp of the ladder frame)`. `base.wallPx` is the **sheet-level**
  band mode (`layout.ts:508`). It sets `minSpanM`, which gates base slivers, support and pieces.
- `reconstruct-v2.ts:420`: `T = decomposition.wallThickness.m`. It comes from `bandWallThickness` over the bands
  **inside the extent** (`plan-decomposition.ts:1858-1861`), times the registration's mpp, clamped to [0.15, 0.7].
- If T > wallM + 0.1, or T > 0.5 (thick Polish 0.44-0.5 m external walls), a body or piece can satisfy the support
  test and still be narrower than 2T. It then lands in C-4.
- Not reproduced (the synthetic fixtures draw one thickness). Check on the corpus by logging both numbers.

### C-6 DESIGN_LIMITATION (wrong storey count, named): an ambiguous upper-plan placement drops the whole storey

- **Input:** `c-inset-east`: HOLLOWAY, upper storey inset 2.4 m from the east, upperChainsX [6.0].
- **Current behaviour:** `layout.ts` around 2140: "two placements stand it on the same bodies over different
  footprints". The decision is AMBIGUOUS and the storey is not stacked: the two-storey house is built one storey high.
- It is named as a gap, but the elevations, which would settle the placement, are not consulted.
- **Reproduce:** `npx vite-node research/analyzer-n7-council/C/probe-layout.ts -- --only c-inset-east`.

### C-7 DESIGN_LIMITATION: a door-sized notch between two wings is bridged and built

- **Input:** `w-gap1-11-nodoor`, `w-gap1-21-nodoor`, `w-gap05-11-nodoor`.
- **Current behaviour:** the 0.5-1.0 m notch, open to the east, is enclosed (H1 continuity), and the house, both wings
  and the notch become one 12 × 12 body (C-1).
- With the garage door present, the same notch is RECESS and the bodies are right (`w-gap05-11`, `w-gap1-21`). The
  reading flips on an unrelated opening.
- **Reproduce:** `npx vite-node research/analyzer-n7-council/C/probe-wings.ts -- --only w-gap1-21-nodoor`.

### C-8 COVERAGE_GAP / silent loss: slivers that are not bodies vanish without a gap

- `w-sliver-second`: a 0.45 m sliver as the second wing, whose far wall is on no chain line. No region, no
  unresolved item.
- `c-sliver-z`: a 3.6 × 0.45 wing. It becomes only `zone-max_x`.
- `w-sliver2storey-d`: the sliver's upper storey is `NOT_A_BODY` in the storey digest only, and the body is built
  one storey high with no gap.
- **Impact:** low (these are slivers), but losses are not reported.

### C-9 DESIGN_LIMITATION: a shared wall between bodies is built twice

- **Input:** HOLLOWAY. The plan draws one 0.30 m wall on x = 8.4.
- **Current behaviour:** `ring-main-0-w1` (8.1..8.4) and `ring-attached-0-0-w3` (8.4..8.7) are both built, so the
  garage interior is 0.3 m narrower than drawn.
- P2R's SHARED_WALL fixes this only for bodies narrower than 2T.

### NOT_A_DEFECT (suspicions refuted)

- **`storeyRects` takes the largest piece, not just the first.** `reconstruct-v2.ts:446` takes `own[0]`, which is the
  largest, because `storeySupportOf` sorts pieces by area and names k = 0 `footprint-s-mass`.
- **Pieces and `storeyRects` are not thinner than `minSpanM`.** See point 2 above.
- **No other v2 stage narrows a mass.** Grep for mutations: only `narrowMass` (research), WIDEN and SOLID_WALL.
- **Ordinary two-wing houses, a loggia (REDMIRE) and a front recess with a garage are read right.**
  - `c-twowing` and `w-gap2-11`/`w-gap3-11` (wings ≥ 2 m apart) give 3 bodies with correct rectangles and storeys.
  - `w-gap1-21` and `w-gap2-21` give a two-storey wing with `ring-attached-1-1`.
  - REDMIRE's loggia does not become a body; its stepped upper storey is a `storeyRect`.
  - `c-recess-garage` and `c-recess-right` give 2 bodies.
  - No phantom bodies come from RECESS or ZONE regions: masses are made only from BUILT base regions.
- **SLIVERTON family behaves as designed.** SLIVERTON gives KEEP_PARTIAL with refusal index 21 and overlap 0.1994.
  SLIVERTON_D gives SHARED_WALL; THINWALL gives DRAWN_THIN_WALLS.

## Inventory (FILE → FUNCTION → INPUT → ASSUMPTIONS → POSSIBLE FAILURE → EFFECT → EXISTING TEST → VERDICT)

### Plan decomposition and regions

- **plan-decomposition.ts → `mergeRegions`**
  - Input: cells with a class.
  - Assumes: a rectangle of same-class cells is one body.
  - Fails: spans drawn walls.
  - Effect: merged or phantom bodies.
  - Test: mutation tests on HOLLOWAY only.
  - Verdict: **C-1 defect**.
- **plan-decomposition.ts → `decomposeCore` (flood, H0/H1, classify)**
  - Input: grid lines, edges, bands.
  - Assumes: a door ≤ 3.2 m between wall pieces is shut.
  - Fails: a set-back front's piers are not seen.
  - Effect: garage OUTSIDE, lost silently.
  - Test: none for a set-back garage.
  - Verdict: **C-2 defect**.
- **plan-decomposition.ts → RECESS filter (`builtSides`)**
  - Input: cells.
  - Assumes: a pocket has built neighbours on two adjacent shut sides.
  - Fails: a flooded garage becomes OUTSIDE.
  - Effect: the loss in C-2 is not reported.
  - Verdict: contributes to C-2.
- **plan-decomposition.ts → `planBodies`**
  - Input: built regions.
  - Assumes: merging along unwalled seams is enough.
  - Fails: cannot split a region along a drawn wall.
  - Effect: C-1 persists.
  - Verdict: limitation.
- **plan-decomposition.ts → `recutSlivers`**: outline plans only. Box plans keep slivers as bodies, so they go to
  `thinBodies`. Verdict: as designed.

### Layout: base regions, masses, storeys

- **layout.ts → base region loop (1925-1985)**
  - Input: `strips.regions`.
  - Assumes: wall fraction ≥ MIN; the sliver filter runs only with an outline.
  - Fails: a thin region becomes a body on box plans.
  - Effect: thin attached body.
  - Test: SLIVERTON.
  - Verdict: OK. `thinBodies` catches it.
- **layout.ts → `regionOf` / `toOuterFaces` / `bayStripsOf`**
  - Input: base regions.
  - Assumes: a region reaching past the envelope goes to the outer faces.
  - Fails: a front step is absorbed.
  - Effect: +0.3 m garage depth.
  - Verdict: **C-3**.
- **layout.ts → masses (2000-2025)**
  - Input: BUILT base regions.
  - Assumes: one region is one body, measured on the base storey.
  - Fails: inherits C-1 and C-2.
  - Verdict: OK locally.
- **layout.ts → `storeyIndices`**
  - Input: plan storey labels.
  - Assumes: one plan per label.
  - Verdict: OK for the inputs tried.
- **layout.ts → `alignPlans` plus rival/tie (2040-2160)**
  - Input: an upper plan.
  - Assumes: the walls decide the placement.
  - Fails: a symmetric inset is a tie.
  - Effect: the storey is dropped (named).
  - Verdict: **C-6**.
- **layout.ts → `upperBodiesOf`**
  - Input: upper plan regions.
  - Assumes: outer walls reach the faces.
  - Verdict: OK.
- **layout.ts → `storeySupportOf`**
  - Input: bodies and a placement.
  - Assumes: support needs `ox, oz ≥ minSpanM`; a piece is at least the intersection.
  - Fails: if `minSpanM` < 2T (C-5), a thin piece.
  - Effect: C-4.
  - Test: 005L tests.
  - Verdict: OK if T ≈ wallM.
- **layout.ts → `onlySeams`**: merges only. OK.
- **layout.ts → `wallsBeyond` / lower-storey guard**
  - Input: a lower plan.
  - Assumes: a ground plan wider than the base is not stacked.
  - Effect: named MISSING.
  - Verdict: OK (not exercised).
- **layout.ts → `minBodySpanM`**
  - `max(1, 2·wallM+0.2)` uses the sheet `wallPx`, while v2 uses the decomposition T.
  - Verdict: **C-5** risk.
- **layout.ts → `assignRoles`, `attachmentsBetween`, `recessesOf`, `pocketRecesses`**
  - Input: masses and pockets.
  - Assumes: the largest or ranked mass is MAIN.
  - Fails: after C-1, MAIN is the merged block.
  - Verdict: OK locally.

### Gate

- **plan-diagnostics.ts → `layoutRefused` / `LAYOUT_REFUSAL_CODES`**
  - Input: gate reasons.
  - Assumes: a silhouette disagreement may be a tracing error.
  - Fails: a REJECTED layout is built and shown COMPLETE.
  - Verdict: silent failure (see C-1). Design choice documented at 255-263.
- **structural-audit.ts → silhouette audit**
  - Input: masses and elevations.
  - Fails: detects C-1, but cannot see a lost body (C-2), because the scale is fitted to the bodies.
  - Verdict: C-2 is invisible to it.

### v2 masses, thin bodies, emission

- **reconstruct-v2.ts → mass map (424-474)**
  - Input: layout masses.
  - Assumes: ids follow layout order (area-sorted); `measuredOn` is the region of `footprintRegionIds[0]`;
    `storeyRects` use the largest piece.
  - Verdict: OK.
- **reconstruct-v2.ts → pieces (`${id}-s${s}-${k}`)**
  - Input: pieces that do not meet.
  - Assumes: a meeting piece is dropped and named.
  - Fails: in C-1 the upper wing is dropped.
  - Verdict: OK as designed.
- **reconstruct-v2.ts → `outerFacesOpen`**
  - Input: `openFacesOf`.
  - Assumes: evidence only, no geometry.
  - Verdict: OK. The flag is evidence-only and never changes the rectangle.
- **thin-body.ts → `thinBodies`**
  - Input: masses and T.
  - Assumes: only the measured rectangle can be thin.
  - Fails: skips `storeyRects` and pieces.
  - Effect: an unadjudicated WALLS_OVERLAP.
  - Test: thin-body-n7-p2r covers plain bodies only.
  - Verdict: **C-4 gap**.
- **thin-body.ts → `adjudicateThinBody`**
  - Input: one body.
  - Assumes: the plan is the body's `min(storeys)` plan.
  - Verdict: OK (for B or D to review further).
- **building.ts → `rectAt`**
  - Input: a mass and a storey.
  - Assumes: a `storeyRect` overrides the body.
  - Verdict: OK.
- **emit.ts → mass loop (180-251)**
  - Input: masses.
  - Assumes: ring from `rectAt`, thickness `tOf`; the slab uses the body rectangle inset by T; the evidence's
    `measuredOn` is the storey without a `storeyRect`.
  - Fails: a shared wall is doubled.
  - Verdict: **C-9** limitation.

## Silent failures seen

- **Gate REJECTED, preview COMPLETE.** In C-1 the gate's BLOCKING silhouette reasons go only to `layout.gate` and
  the trace.
- **A 21.6 m² body lost with no unresolved item, gate ACCEPTED** (C-2).
- **A sliver lost or truncated with no item** (C-8); the storey digest's NOT_A_BODY reaches no gap.
- **A drawn exterior wall silently becomes an INTERIOR partition** when bodies merge (C-1).

## Top 3 by impact

1. **C-1, largest-first tiling crosses drawn walls.** Wrong body count, a phantom body or wall, the wrong roof (a
   gable over the garage), elevation mismatch. Shown COMPLETE although the gate says REJECTED.
2. **C-2, a set-back garage with a wide door is lost silently.** Lost correct body, wrong footprint, gate ACCEPTED,
   no unresolved item.
3. **C-4 with C-5, thin rings from `storeyRects` or pieces bypass the thin-body adjudicator.** This would produce
   exactly the owner's unadjudicated `ring-…-0` WALLS_OVERLAP (a total-model refusal at the ring) if T exceeds the
   sheet `wallM` by > 0.1 m or T > 0.5. Not reproduced end to end. The code gap is shown.
