# Council D — MODEL / EMISSION / TOPOLOGY

Reviewer D, written before reading any other council file. Read-only on production code. Harnesses are in
`/home/user/BuildApp/research/analyzer-n7-council/D/` and run from the repo root with `npx vite-node <file>`.

| harness | what it covers |
|---|---|
| `h1-storeyrects-pieces.ts` | Q1–Q3: thinBodies skips storeyRects, pieces and MAIN; emit builds and the model refuses |
| `h2-reconcile-narrows.ts`, `h2b-reconcile-record.ts` | the reconciliation narrows a ring that was ≥ 2T to < 2T, and the report drops that record |
| `h3-thickness-openside.ts` | Q4/Q5: per-body thickness vs frames; SHARED_WALL on all 4 sides × 1–2 storeys; references to the missing wall; cutting a three-wall body |
| `h4-thin-many-openings.ts` | Q4: windows on a DRAWN_THIN_WALLS body → cuts → after 12 cuts the whole model is refused |
| `h5-shared-wall-partial-overlap.ts` | Q5: SHARED_WALL when the other body covers only part of the side → a hole in the envelope |
| `h6-checkpoint.ts` | the owner's counters (index 21, checkpoint 16) and the program shape they force |
| `e2e-storeyrect.ts -- --d=0.4,0.55,0.7,1.0,1.5,2.0` | runAnalysis, invented REDMIRE variants with a narrow upper strip |
| `e2e-wing.ts -- --w=0.6,0.62,0.66,0.7` | runAnalysis, invented HOLLOWAY variants with a wing near 2T |

`lib.ts` builds a minimal `BuildingV2` and runs `emitBuilding` → `applyCommands` (the plain validator) →
`fitPreviewProgram` (the production preview path) → `buildCandidateModel`.

---

## 0. What the owner's counters force (h6, CONFIRMED arithmetic)

The emitter writes, in this order: `setModelName`, `createBuilding`, 11 materials (13 commands), one `createLevel`
per level, the roof planes of pitched or plane roofs, and then per mass and per storey `createSlab` + `createWallRing`,
with one `setEvidence` per mass. For the preview checkpoint to be **16 commands** and the failure to be **command 21 =
`createWallRing ring-attached-1-0`**, all of the following must hold:

- exactly **1 level**;
- **no** pitched-attached or plane-roof planes;
- main with **one storey**;
- attached-0 is an **ordinary four-wall ring** (not SHARED_WALL, which would emit 3 walls + 3 evidences);
- attached-1 fails at its first storey.

`h6-checkpoint.ts` reproduces 16/21 for that shape. Two levels give 19/24 (main with 2 storeys) or 17/22 (main with 1).
So the "2 rings / 3 masses / 2 slabs" counters agree with each other: the rings are ring-main-0 and ring-attached-0-0,
the slabs are slab-main-0 and slab-attached-0-0, and slab-attached-1-0 is cut as SAME_BODY.

**Consequence:** with a single level, `storeyRects` and pieces cannot exist, because both are made only for a storey
other than the one the body was measured on. **So Q1–Q3 are real defects (below), but they are not the owner's
mechanism.** attached-1 is a plain single-storey ATTACHED body that `thinBodies()` *does* look at. Two mechanisms are
left, and both give the identical refusal and the identical checkpoint hash before and after P2R:

- **(A) KEEP_PARTIAL.** The read width is below 2T. P2R adjudicates it and leaves it to the preview. In this case
  `audit.thinBodies` has a record, and its `predictedOverlapM2` equals the 0.3092 m² the owner sees.
- **(B) Narrowed by the reconciliation.** The read width is ≥ 2T. `thinBodies` is empty, and the wall reconciliation
  then narrows the ring below 2T (§1).

The owner's own `audit.thinBodies` (or `reconstruction.thinBodies`) separates A from B in one look. If it is empty, the
cause is B (or a stale result). The checkpoint hash covers only the main body's base prefix, so it can be the same
whatever happens to attached-1. It proves nothing about P2R.

---

## 1. CONFIRMED_DEFECT — the wall reconciliation narrows a body below 2T after P2R has passed it; the cause is then dropped from the report

- **FIRST_BAD:** `packages/reconstruction/src/candidate.ts` → `repairRing`, via `wall-reconciliation.ts`
  `parallelConflict` / `moveRingEdge`.
- **Input:** main 0..10 × 0..8 (T = 0.30); attached-0, a sound ring behind it; attached-1 at x 9.95..10.57 × z 1..7.
  attached-1 is **0.62 m ≥ 2T = 0.60** and stands 5 cm inside main's east wall. Tolerance 0.06 (3 px × mpp).
- **Current behaviour:**
  1. `thinBodies()` returns `[]`.
  2. The first fit refuses the ring for overlapping `ring-main-0-w1`.
  3. `reconcileWallOverlaps` → `repairRing` chooses PARALLEL_OVERLAP and moves the ring's west edge 0.05 m **east,
     into its own body** (`shift = -hi` along main's inward normal). The record is `EDGE_MOVED`.
  4. The moved ring is now 0.57 m wide and the model refuses it with
     **`walls ring-attached-1-0-w1 and ring-attached-1-0-w3 share 0.1620 m²`** at **command 21**.
  5. The second `repairRing` round finds no candidate, because w3 of the same ring is not in the model. `step = null`,
     and the result carries no `refusal` record.
  6. `fitPreviewProgram` cuts attached-1 (slab SAME_BODY, ring FAILED, evidence DEPENDENT) and re-fits. The final
     `PreviewFit.reconciled` is the **post-cut** attempt, which is `undefined` here. The `EDGE_MOVED` record that caused
     the failure appears **nowhere** in the result.
  7. The failure message describes the *moved* polygon (x0 = 10), not the emitted one (x0 = 9.95).

  This is exactly the owner's signature: index 21, `ring-attached-1-0`, w1/w3, checkpoint 16.
- **Correct behaviour:**
  - An edge move must never make a ring narrower than 2 × its thickness. Before accepting `EDGE_MOVED`, check
    `min(width, depth) - |shift| ≥ 2T`. Otherwise treat the band as shared (open the ring on that side, as SHARED_WALL
    does) or refuse with a record that names the collapse.
  - The thin-body check must run on the rectangle that is actually built.
  - `PreviewFit` must keep the reconciliation records of the attempt that failed (the first attempt) so the report can
    show the first bad step.
- **Missing test:** there is no test of a ring whose width is in [2T, 2T + tolerance] and which overlaps a neighbour.
  `thin-body-n7-p2r.test.ts` covers only widths that are already < 2T.
- **Reproduce:**
  ```
  npx vite-node research/analyzer-n7-council/D/h2-reconcile-narrows.ts
  npx vite-node research/analyzer-n7-council/D/h2b-reconcile-record.ts
  ```
  At W = 0.70 the same move is harmless: the result is COMPLETE with an EDGE_MOVED record.
- **End to end:** not reproduced through runAnalysis. In the synthetic HOLLOWAY variants (`e2e-wing.ts`, wing 0.60,
  0.62, 0.66, 0.70) the wing's face coincides exactly with main's, so the reconciliation never fires. 0.60 and 0.62
  are read as 0.55 and 0.57 → SHARED_WALL, COMPLETE. 0.66 and 0.70 → four-wall ring, COMPLETE. On the real corpus
  (r1 replay) every ring has a margin of ≥ 2.7 m over 2T, so none is near the threshold.

## 2. COVERAGE_GAP — `thinBodies()` skips storeyRects, pieces and MAIN; emit builds those rings from `rectAt` (Q1, Q2, Q3)

- **FIRST_BAD:** `v2/thin-body.ts` → `thinBodies`:
  `if (m.role !== 'ATTACHED' || m.pieceOf || m.storeyRects?.length) continue`. Emit (`emit.ts` line ~186) builds every
  storey's ring from `rectAt(m, storey)` with thickness `tOf(m)`.
- **Input / current behaviour (`h1`):**
  - *Storey rect.* attached-0 is 3.0 m on storey 0 and 0.45 m on storey 1 (a storeyRect). `thinBodies → []`. The model
    refuses `ring-attached-0-1` (w1/w3, 0.81 m²). The preview then cuts the body's **sound** storey-0 ring and slab too
    (SAME_BODY).
  - *Narrow base rect.* A body whose own (base) rect is 0.45 m but which has storeyRects is also skipped.
  - *Piece.* `main-s1-1` is 0.40 m wide. It is skipped and refused (`ring-main-s1-1-1`, 0.68 m²). Here the preview cuts
    only the piece.
  - *MAIN.* A 0.5 m MAIN body is never checked.
- **Correct behaviour:** check every ring that will actually be emitted. Iterate `(mass, storey) → rectAt(mass,
  storey)`, pieces included, with `tOf(mass)`, and adjudicate that rectangle or name it. The base rect is not the only
  one.
- **Missing test:** none of the thin-body tests has a storeyRect, a piece or MAIN.
- **Reproduce:** `npx vite-node research/analyzer-n7-council/D/h1-storeyrects-pieces.ts`
- **End to end (`e2e-storeyrect.ts`):** the REDMIRE variants with an upper strip 0.4, 0.55, 0.7 or 1.0 m deep **never
  produce a storeyRect**. The layout gives main storeys [0, 1] on the full 10.5 × 8.1 body, and the result is COMPLETE
  with two full rings. A strip of 1.5 or 2.0 m does produce storeyRects. So in production today a narrow storey does
  not reach emit: it is silently replaced by the whole body. That is a wrong upper-storey footprint, outside D's scope,
  and I flag it to the layout reviewer as **observed, root cause not traced**. The Q1 gap is therefore proven on the
  production emit + validator + preview path, not through runAnalysis.

## 3. CONFIRMED_DEFECT — DRAWN_THIN_WALLS changes the ring's thickness but not the frames of its windows and doors (Q4)

- **FIRST_BAD:** `emit.ts` → `cutAndFill` and the sharedDoors loop. `frameWithinWall(kind, b.wallThicknessM)` is
  called with the **house** T, not `tOf(mass)`.
- **Input:** attached-0 with `wallThicknessM 0.12`, one window and one door.
- **Current behaviour:**
  - `placeWindow` and `placeDoor` are emitted with the default frames. The model refuses them with `FILL_TOO_LARGE:
    frame reaches 0.2 m into a 0.12 m wall` (0.22 m for the door).
  - Each refusal costs one preview cut, and each window or door is lost.
  - With **13** windows on that body, `PREVIEW_MAX_CUTS = 12` is exceeded and **the whole model is refused**: no
    preview, `fit.ok = false` (`h4`).
- **Correct behaviour:** `frameWithinWall(kind, tOf(mass))`, using the host's thickness. For a shared door, use the
  thickness of the wall that hosts it.
- **Missing test:** THINWALL has no openings on its thin body, so the e2e test passes.
- **Reproduce:**
  ```
  npx vite-node research/analyzer-n7-council/D/h3-thickness-openside.ts
  npx vite-node research/analyzer-n7-council/D/h4-thin-many-openings.ts
  ```

## 4. CONFIRMED_DEFECT — SHARED_WALL leaves a hole in the envelope when the other body covers only part of the side (Q5)

- **FIRST_BAD:** `thin-body.ts` → `adjudicateThinBody`. The shared face is accepted when
  `overlap1(...) > 0.5 * long`, and the decision then removes the **whole** side. `emit.ts` emits three walls and
  nothing on that side.
- **Input (`h5`, invented raster):** main 10 × 8; a 0.45 m body at x 10..10.45, z 4.5..10.5. The plan draws the body's
  own west wall over z 8..10.5, where main does not reach.
- **Current behaviour:**
  - The decision is SHARED_WALL (WEST).
  - The model is built and accepted.
  - **No wall stands on x ≈ 10 over z 8..10.5**: a 2.5 m open gap in the exterior. The drawn wall over z 8..10.5
    profiles as "the other body's wall", because the samples run along the whole band and the wall sits at s ∈ [−T, 0].
- **Correct behaviour:** SHARED_WALL only when the other body's wall covers the band's whole length (within tolerance).
  Otherwise keep a wall on the uncovered stretch, or KEEP_PARTIAL. The model has no envelope-closure check, so nothing
  downstream catches this.
- **Missing test:** a SHARED_WALL test with partial cover.
- **Reproduce:** `npx vite-node research/analyzer-n7-council/D/h5-shared-wall-partial-overlap.ts`

## 5. COVERAGE_GAP — partial preview: a refused wall of a three-wall (SHARED_WALL) body is not grouped with its body

- **FIRST_BAD:** `candidate.ts` → `cutFailedObject`. `bodyOf()` recognises only `createSlab` and `createWallRing`
  (`/^(slab|ring)-(.+?)-(-?\d+)$/`). A SHARED_WALL body is emitted as `createWall ring-<m>-<s>-w<i>`, so its group is
  the failed command alone. `freeStandingExteriorWalls` also runs only when `body` is defined.
- **Input (`h3`):** cut `ring-attached-0-0-w2` of a WEST-open body.
- **Current behaviour:** `slab-attached-0-0` and `ring-attached-0-0-w0` stay in the preview. w1 goes as DEPENDENT
  because of its junction reference. The result is half a body: a slab and one free-standing wall.
- **Correct behaviour:** group by the ring prefix `ring-<m>-<s>-w` and by the mass as for rings.
- **Reproduce:** `npx vite-node research/analyzer-n7-council/D/h3-thickness-openside.ts` (last block, reported as FAIL).

## 6. SHARED_WALL emission itself — NOT_A_DEFECT (Q5)

- All four `openSide` values, on one and on two storeys, give 3 own walls per storey, and the model accepts them with
  no overlap (8/8 cases, `h3`).
- The CORNER owner choice matches the ring's ALTERNATE rule (even edges own). The middle wall carries both junctions,
  and the two flanking walls are opposite each other, so they never meet.
- The `hosts` for interior topology drop the open side and keep the other body's wall as host.
- A shared door whose own side is open goes into the other body's wall with no leaf. Seen from the other side, it has
  no leaf in the missing wall.
- Roof SUPPORTED_BY skips the open wall.

Some references to the open-side wall remain unguarded:

- **A terrace** whose `hostWallIds` names it is refused with UNKNOWN_WALL. It is cut and named — HIGH_RISK, minor.
- **An exterior opening** on the open facade is DROPPED with UNKNOWN_WALL by the opening fit. It is named as a gap.
  `reconstruct-v2` already skips reading openings on that facade (line ~1289), so it is reachable only for a
  hand-made BuildingV2.
- **A chimney's OVERLAPS_INTENTIONALLY relation and a surface region** target `ringWallId(...)` of the open side
  unguarded — HIGH_RISK, not run.
- `attachedCapIds` is filled but never read (dead code).

## 7. Q4 — per-body versus house thickness, place by place

| place | uses | verdict |
|---|---|---|
| ring / three walls `thickness` | `tOf(m)` | OK |
| interior `hosts` | `tOf(body)` with `rectAt` | OK |
| slab inset (upper storeys) | `tOf(m)` but the **body** rect `m.x0..`, not `rectAt` | by design ("floor is the body's"); for an open side the slab is inset T from a wall the body does not have — HIGH_RISK (visual) |
| window/door frames, shared-door frames | `b.wallThicknessM` | **CONFIRMED_DEFECT §3** |
| `readWallOpenings(... wallThicknessM: T)` (reconstruct-v2 ~1298, pockets 1435/1476) → `planGaps` band width | house T for every host, including a DRAWN_THIN_WALLS body | HIGH_RISK: the band scanned is wider than the drawn wall and reads into the body's interior. Not reproduced. |
| attached flat roof `plateInset` | `b.wallThicknessM / 2` on all four sides | HIGH_RISK, minor (plate bears into a wall it does not have, or too deep in a thin one) |
| chimney into-wall test | `b.wallThicknessM` | minor (a relationship only) |
| interior door-run merge | `b.wallThicknessM * 0.5` | OK (partitions) |
| `thinBodies(masses, T)` | house T | consistent with emit except after a DRAWN_THIN_WALLS decision (which is final) |

## 8. Q6 — after WIDEN

`Object.assign(mass, after)` at reconstruct-v2 line ~1063 runs **after** several things that read the mass extents:

- the legacy elevation registration span (line 579, `width: main… + Σ max(0, m.x1 − main.x1) …`);
- `bodiesSpan` / `coversZones` for the main roof (line 786);
- the MASS feature (`feature('MASS', id, { width: …old… })`), together with its ledger records.

It runs **before** the openings (1243+), pockets, attached and pitched roof footprints (1552/1593), the camera
(1934) and emit. Those are consistent with the new extent.

- **HIGH_RISK (not reproduced):** elevation registration and the coversZones vote use the narrower width.
  `adjudicateThinBody` itself uses views registered at the pre-WIDEN width to corroborate the WIDEN, which is circular.
- **CONFIRMED by code (silent provenance):** a widened body keeps `outerFacesOpen` undefined, so emit writes
  `SOURCE_EXACT … body from the plan's printed chains` on its ring. This is so even when the widening came from plan
  ink plus an elevation and no chain. The feature graph keeps the old width.
- **Pieces with `pieceOf` this body** are not moved.
- **COVERAGE_GAP:** WIDEN is tested only on `adjudicateThinBody` in isolation (`packages/reconstruction/test/
  thin-body-n7-p2r.test.ts:110,121`). No test runs a WIDEN decision through emit and the model, or checks its
  dependents.

## 9. Q7 — can the decision miss the ring that fails?

- **Same object (NOT_A_DEFECT).** `thinBodies` returns the same `MassV2` references that are in `masses`, so the
  decision mutates the object that is emitted. No copy is involved.
- **Decision on the mass rect, failure on a storeyRect ring:** impossible today, because such a body gets **no
  decision at all** (§2).
- **Decision on the read rect, failure on the rect the reconciliation moved:** **yes** (§1). This is the live case.
  The decision (or its absence) concerns the emitted rect, and the refused ring is a different polygon.
- **SOLID_WALL** splices the mass out. Its pieces keep a dangling `pieceOf` (minor).

## 10. Q8 — before FIRST_BAD, or compensating?

**Compensating.** P2R sits in reconstruct-v2 after the layout and before the emit.

- For a body *read* narrow, the first bad step is upstream: the width reading in `structural-layout` /
  `plan-decomposition`. P2R adjudicates its consequence on the raster. KEEP_PARTIAL (mechanism A) leaves the run
  exactly where it was before P2R.
- For mechanism B, the first bad step is **downstream** of P2R (`repairRing`), and P2R cannot see it.
- For storeyRects and pieces, P2R does not run (§2).

## 11. Partial preview — dependency handling, ids, counters

- **Grouping for rings is correct.**
  - `BODY_COMMAND_ID` parses `ring-attached-1-0` → (attached-1, 0); a piece `ring-attached-1-s1-1-1` →
    (attached-1-s1-1, 1); `ring-x--1` → storey −1.
  - The prefix grouping `ring-${m}-` / `${m}-` also takes a body's pieces with it.
  - `attached-1` does not catch `attached-10` (checked by reasoning: the next character is `-` against `0`).
- **Base protection:** a refused piece of main is cut alone; main's rings stay (`h1`).
- **A storeyRect failure takes the body's sound lower storeys with it (SAME_BODY).** Lost correct walls, `h1`.
  DESIGN_LIMITATION, but it costs real walls.
- **The 12-cut cliff:** `PREVIEW_MAX_CUTS` exceeded → `fit` is the first refusal and there is no preview at all
  (`h4`). Any per-opening systematic refusal (such as §3) turns into total refusal.
- **Counters:** consistent (§0). The failure's `message` is that of the reconciled command (§1), so the reported
  overlap area is the post-move value.

## Silent failures seen on this path

- The EDGE_MOVED record that caused the refusal is dropped from the final `PreviewFit` and report (§1). There is no
  `refusal`, so `refusalDiagnostics` adds nothing.
- The failure message describes a polygon the emitter never wrote (§1).
- A widened body is labelled SOURCE_EXACT from chains (§8).
- SHARED_WALL with partial cover gives an open envelope, and the validator accepts it (§4).
- Narrow upper storeys (≤ 1.0 m in REDMIRE variants) are replaced by the full body with no gap recorded (e2e,
  §2 — upstream).

## Function inventory (FILE → FUNCTION → INPUT → ASSUMPTIONS → POSSIBLE FAILURE → EFFECT → EXISTING TEST → VERDICT)

- **thin-body.ts → `thinBodies`**
  - Input / assumption: masses and T; that the base rect is what gets built.
  - Possible failure: storeyRects, pieces and MAIN are skipped, and per-body T is ignored.
  - Effect: unadjudicated refusal.
  - Existing test: reconstruction/thin-body unit tests (base rect only).
  - Verdict: **COVERAGE_GAP §2**.
- **thin-body.ts → `adjudicateThinBody`**
  - Input / assumption: one mass, its plan raster, chains and views; that the other body's face covers the band
    (> 50 %).
  - Possible failure: partial cover → SHARED_WALL; views registered before WIDEN.
  - Effect: an envelope hole; a circular corroboration.
  - Existing test: unit tests with drawn rasters.
  - Verdict: **CONFIRMED §4**; HIGH_RISK §8.
- **reconstruct-v2.ts → thin-body application (~1038–1075)**
  - Input / assumption: the decision; that the dependents are computed later.
  - Possible failure: registration, coversZones and the MASS feature are computed earlier; provenance is not updated.
  - Effect: a stale span; a SOURCE_EXACT label.
  - Existing test: only the e2e for SHARED_WALL and DRAWN_THIN_WALLS.
  - Verdict: HIGH_RISK / confirmed by code §8.
- **building.ts → `rectAt`**
  - Input / assumption: mass and storey; the storeyRect is used when present.
  - Possible failure: none in itself.
  - Effect: —
  - Existing test: —
  - Verdict: NOT_A_DEFECT (but see §2).
- **emit.ts → `emitBuilding` (ring / three walls)**
  - Input / assumption: BuildingV2.
  - Possible failure: open-side corners.
  - Effect: —
  - Existing test: e2e SLIVERTON_DIMENSIONED.
  - Verdict: NOT_A_DEFECT (8/8, §6).
- **emit.ts → `cutAndFill` / shared doors (frames)**
  - Assumption: the house T.
  - Possible failure: FILL_TOO_LARGE in a thin body.
  - Effect: lost openings; total refusal at > 12.
  - Existing test: none.
  - Verdict: **CONFIRMED §3**.
- **emit.ts → interior `hosts`**
  - Input / assumption: rectAt and tOf; the open side is not a host.
  - Possible failure: —
  - Effect: —
  - Existing test: e2e.
  - Verdict: NOT_A_DEFECT.
- **emit.ts → slab inset**
  - Assumption: the body rect.
  - Possible failure: on an open side, inset by T from a wall that is missing.
  - Effect: a visual gap.
  - Existing test: —
  - Verdict: HIGH_RISK, minor.
- **emit.ts → terraces / chimney relation / surfaceRegions**
  - Assumption: all four ring walls exist.
  - Possible failure: they name the open wall.
  - Effect: UNKNOWN_WALL → cut.
  - Existing test: —
  - Verdict: HIGH_RISK, minor.
- **emit.ts → `bandWalls`**
  - Input / assumption: the far-face line, thickness = narrow.
  - Possible failure: not run.
  - Effect: —
  - Existing test: unit.
  - Verdict: not reviewed in depth.
- **candidate.ts → `fitPreviewProgram`**
  - Input / assumption: program and tolerance; that the reconciled report of the last attempt is enough.
  - Possible failure: the first-attempt records are dropped; 12-cut cliff.
  - Effect: an invisible first bad step; total refusal.
  - Existing test: N7-P1 tests.
  - Verdict: **CONFIRMED §1** (report), DESIGN_LIMITATION (cliff).
- **candidate.ts → `reconcileWallOverlaps` / `repairRing`**
  - Assumption: that moving an edge onto the neighbour's face is safe.
  - Possible failure: it narrows the ring below 2T; `step = null` leaves no refusal record.
  - Effect: the owner's w1/w3 refusal.
  - Existing test: wall-reconciliation tests (no thin case).
  - Verdict: **CONFIRMED §1 (FIRST_BAD candidate for the owner)**.
- **wall-reconciliation.ts → `parallelConflict` / `moveRingEdge`**
  - Possible failure: the shift sign moves the edge into its own body (by design, "onto e's face").
  - Effect: as above.
  - Verdict: part of §1.
- **candidate.ts → `cutFailedObject`**
  - Input / assumption: failedAt; that bodies are slab or ring commands.
  - Possible failure: a three-wall body is not grouped; a storeyRect failure cuts sound storeys.
  - Effect: half bodies; lost walls.
  - Existing test: N7-P1 tests.
  - Verdict: **COVERAGE_GAP §5**; DESIGN_LIMITATION.
- **candidate.ts → `previewCheckpoint`**
  - Input / assumption: the main prefix.
  - Possible failure: the hash is independent of later bodies.
  - Effect: the "same hash" is not evidence.
  - Verdict: NOT_A_DEFECT (interpretation note §0).
- **commands/apply.ts → `createWallRing`**
  - Assumption: ALTERNATE corners.
  - Possible failure: none.
  - Verdict: NOT_A_DEFECT.
- **model/topology.ts → `wallOverlapIssues`**
  - Assumption: overlap > 1e-6 m² is an error.
  - Possible failure: no envelope-closure check.
  - Effect: an open envelope is accepted (§4).
  - Verdict: DESIGN_LIMITATION.

## Top 3 by impact

1. **§1. The reconciliation narrows a ring below 2T after P2R, then hides the cause.** It reproduces the owner's exact
   signature (cmd 21, `ring-attached-1-0`, w1/w3, checkpoint 16) for a body that P2R never sees. It loses a correct
   body, and the cause is invisible in the report. Check `thinBodies` in the owner's audit: if it is empty, this is the
   lead.
2. **§3. DRAWN_THIN_WALLS frames sized from the house T.** Every opening on such a body is refused; with more than 12
   the **whole model is refused** (total refusal, lost walls).
3. **§2 + §4. Unchecked rings (storeyRects, pieces, MAIN) and SHARED_WALL removing a side that is only partly
   shared.**
   - The first refuses a storey and cuts the body's sound storeys.
   - The second accepts a model with an open exterior gap.
   - The e2e also showed narrow upper storeys (≤ 1.0 m) silently replaced by the full body (wrong storey footprint;
     upstream, to be traced).
