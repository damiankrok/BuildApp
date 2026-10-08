# 005N architecture — compound facade spans, atomic intervals, recess back walls, the wall-joint extent

Production change in `packages/reconstruction` only. No new dependency, no native library, no AI model
(`geometry-kernel-decision.md`: `NO_NEW_KERNEL`).

## 1. Where it sits

```
planExtent ─▶ decomposeCore ──────────────────────────────────────────────▶ boundaryExtension ─▶ (override) decomposeCore
               │ grid lines, envelope
               │ collinearWideGaps ── for a gap on an envelope side ──▶ compoundSpanOf (compound-facade.ts)
               │      ▲                                                    │ separators → intervals → per-interval evidence/role
               │      └──── a span with no accepted separator: the incumbent decision, unchanged
               │ backWallLines: a recess interval's set-back wall becomes a grid line (once, never on the outline's grid)
               │ structuralEvidence: separators and recess back walls are shut evidence on their lines (H1)
               │ pocket test per interval (its own width); a RECESS_MOUTH is never shut by it
               │ cells; topology-sourced recess cells labelled RECESS
               ▼
            planBodies → layout (recess hypotheses) → v2
```

## 2. The facade-local path (`compound-facade.ts`, `COMPOUND_FACADE_VERSION` 1.0.0)

| step | what | read from |
| --- | --- | --- |
| FACADE CONTEXT | a wide gap (wider than the lintel convention, any width) between two along-band pieces of a grid line within 1.5 walls of an envelope side; `inward` is the envelope's side | incumbent grid, envelope |
| WALL PIECES | the facade line read with the boundary's own reader (`readWallLine` on the sheet-wall solid layer), well past the gap's ends so a jamb is read whole; the gap re-cut between the jambs' ink | solid layer |
| SEPARATORS | every wall-thick ink piece strictly inside the gap, judged: **WALL_RETURN** — a wall runs inward from it ≥ max(0.9 m, 3 walls), read on the perpendicular line at its centre and ends; **FACADE_PIER** — a stretch of wall along the line (≥ 1.25 walls) that is part of a wall body; **NOT_A_SEPARATOR** — a free-standing block (POST), a short mark, or ink leaving no 0.6 m mouth beside it. Thin lines are never pieces | solid layer |
| ATOMIC INTERVALS | the gap cut at the accepted separators | — |
| INTERVAL EVIDENCE | infill (the longest stroke in the jambs' band window across the interval only) and whether it **runs past** a jamb (a slab edge, a kerb, a terrace outline does; a door leaf or glazing stops); whether both ends are **wall-thick ink** on the line (a separator or a jamb the ink reader confirms — a band can be a beam); the callout printed **at this interval** (never across a separator; one interval per callout, best confidence, id order); the drawn signature (`gapSignature`, as the boundary reads a gap) | mask, callouts |
| RECESS | both ends carry a return, and a set-back wall lies within the shorter return's reach and at most `RECESS_MAX_DEPTH_M` (4.5 m, a car's length): a parallel line where wall ink and the holes in it cover ≥ 90 % of the mouth — a hole counts only when drawn across (glazing, a leaf) or door-sized beside along-wall ink inside the mouth, so two returns' cross-sections are never a back wall | solid layer |
| ROLE | wider than 8 m → OPEN_SIDE; recess → RECESS_MOUTH unless its mouth is glazed or carries a leaf on its axis (an enclosed porch); infill that stops at two ink jambs → OPENING_IN_WALL; its own callout, walled on both sides deeper than a recess → OPENING_IN_WALL; else OPEN_SIDE | — |

Bounds: at most 24 spans a plan, 8 separator candidates a span, 64 back-wall reads an interval.

## 3. What the decomposition does with it (`plan-decomposition.ts`)

- **Children replace the parent** in the wide openings (`WideOpeningDecision.compound` links each to its span and
  interval). A gap with no accepted separator keeps the incumbent's decision exactly.
- **The pocket test** runs per interval with the interval's own width (`max(6, 2.5 w²)`); a RECESS_MOUTH records its
  pocket and stays open — its back wall closes the building, its mouth does not; an interval wider than 8 m is not
  weighed.
- **Back-wall lines** (`backWallLines`): where no grid line lies within min(0.45 m, half the depth) of a recess's
  set-back wall, one is added (support: none from chains or bands; `why` names the interval) and the wide gaps are read
  again on the new grid. Never on an outline override (the outline has its own grid). The facade reader skips these
  lines (they are inside the building).
- **Structural evidence** (`structuralEvidence`): each accepted separator's ink on its own line, and each recess's
  back-wall span on its back-wall line, enter H1's shut evidence — the same convention every wall is read by (wall,
  and door-sized holes between wall jambs).
- **Recess cells**: a cell inside a recess interval's mouth-to-back-wall rectangle that the outside reaches is labelled
  RECESS from that topology, even when the grid cuts the pocket so that no one cell is shut on three sides. Never a
  BUILT cell.

## 4. The extent (`planExtentOf`, `PLAN_EXTENT_VERSION` 1.1.0)

In the frame the walls draw (the chains describing a detail), a long band beyond the chains' 35 % margin is kept when
a wall-thick long band already in the frame — one whose own run reaches into the chains' rect — has an end within 1.5
walls of its axis and its run passes that band's axis: a corner or a T. One step only. A detached garage, or one only
the margin's axis test let in, is never joined (`compound-facade.test.ts` §21.22).

## 5. Evidence

- Plan-diagnostics digest: `plans[].compoundFacades` (only where a span exists: every other plan digests as before),
  `wideOpenings[].compound`.
- Evidence Pack **1.4.0**: `12c-compound-facades.json` per analysed copy, and COMPOUND_FACADES timeline events (one
  per separator, one per interval with its role, final decision, signature and the cells behind its mouth).
  `requiredFiles('1.3.0')` is unchanged.
- Run record versions: `compound-facade` 1.0.0, `plan-extent` 1.1.0. The CanonicalBuildingModel schema is unchanged.

## 6. What it does not do (stated limits)

- It reads only gaps on an **envelope side**. A compound span on a set-back line that is not the envelope's side
  (murajach's vestibule/garage front) is read as before — there it is already atomic in the boundary reader.
- It never **shuts a blank garage** on its width: a garage mouth with nothing drawn across it and no callout of its
  own stays open in the first reading unless its own pocket proves an interior; the resolver's shut-mouth reading is
  unchanged.
- The **per-edge width convention** of the incumbent (a hole ≤ 3.2 m between two band pieces is shut) is unchanged: a
  post merged into a facade band still shuts the holes either side of it (pre-existing; `compound-facade.test.ts`).
- The **v2 emitter** carves recesses only from dimensioned zones; a recess bitten out of a rectangular body is carried
  by the structural layout (RECESS region, recess hypothesis with its returns) but emitted inside the mass with an
  opening at its mouth — unchanged from the starting code (report §residuals).
