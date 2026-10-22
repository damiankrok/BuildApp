# Council F: refutation round

Production code was only read. New harnesses, all on invented fixtures, are in
`research/analyzer-n7-council/F/`:
- `thinwall-openings-e2e.ts -- --n=<k>`: THINWALL with k windows on the thin wing's long (RIGHT) wall, run end to end
  through `runAnalysis`.
- `thinwall-n4-gaps.ts`: the k = 4 case, listing every unresolved item.

These harnesses were re-run and agree with their authors: D `h2-reconcile-narrows.ts`, `h4-thin-many-openings.ts`;
C `probe-merge.ts`, `probe-tiling.ts` (`t-strip045`, `gb-setback-door`, `gb-flush-door`); E `thin-body-sky.ts`;
A `plan-regs.ts`, `mutate.ts marcowki undimension`. E-3 was re-checked on `r1/a01/audit.json` and `model.json`.

## 1. D-1: reconciliation narrows a ring below 2T after P2R

**Order in the code (confirmed).** The steps run in this order:
1. `thinBodies` at `reconstruct-v2.ts:1040`;
2. `emitBuilding` at `:2192`;
3. `fitPreviewProgram` at `:2213`, which calls `reconcileWallOverlaps` → `repairRing`.

So the edge move always happens after the thin-body pass, and the pass cannot see it.

**Mechanism (reproduced, D `h2`).**
- A 0.62 m body (2T = 0.60) sits 5 cm inside main.
- The edge is moved 0.05 m, which leaves 0.57 m.
- The ring is then refused with `ring-attached-1-0-w1/w3` at command 21, with checkpoint 16.
- The preview records no reconciliation (`reconciliation records: []`): `fitPreviewProgram` returns `attempt.reconciled`
  of the attempt after the cut, so the first attempt's EDGE_MOVED is dropped.

**Can a real layout reach it?** Not shown, and I find no path to the input it needs.
- The input it needs is an attached rectangle overlapping main by a few cm.
- Base regions are cut on shared grid lines.
- `layout.ts:toOuterFaces` deliberately does not move a side that touches another body (`shared(side)`).
- In the corpus, every attached ring abuts main exactly: arganiach, marcowki and rary all show overlap 0.000 on the
  shared axis.
- D's own end-to-end runs (`e2e-wing.ts`, 0.60 to 0.70 m) never fire the reconciliation.

Two remaining routes are unproven:
- WIDEN may overlap a neighbour by up to 0.05 m, because the `collides` threshold is > 0.05.
- A return or band wall may lie within tolerance of a ring edge.

For the owner, D-1 needs the read width to fall in [2T, 2T + tolerance]: a band about 6 cm wide just above 2T.

**Final class.**
- Edge move without a width check, and the cause dropped from the report: **CONFIRMED_DEFECT at function level**.
  The dropped record alone is a confirmed report defect.
- As the owner's mechanism: **HIGH_RISK**, not reached from any layout, synthetic or corpus.

## 2. D-3: DRAWN_THIN_WALLS frames sized from the house T

**CONFIRMED_DEFECT, now end to end.** `thinwall-openings-e2e.ts --n=1`:
- THINWALL's 0.5 m wing (drawn walls 0.15 m) with one opening on its long wall.
- The decision is DRAWN_THIN_WALLS with t = 0.158.
- Preview is PARTIAL_3D_PREVIEW; failure `61 placeDoor opening-0-east-9-0-leaf FILL_TOO_LARGE`.
- Cause: `frameWithinWall(kind, b.wallThicknessM)`, where defaults 0.12 + 0.08 = 0.20 m do not fit in 0.158 m.

The second half of the claim, "more than 12 cuts refuse the whole model", is **NOT reachable on this path**:
- With 2 windows on the same wall, the far-wall band's ink share drops below `BAND_INK_SHARE` 0.6. The adjudicator then
  reads it as CANOPY_ON_POSTS and returns KEEP_PARTIAL, so the ring itself is refused at command 21 (the owner's
  signature).
- With 4 windows the wing is not a body at all.
- So a DRAWN_THIN_WALLS body never carries many openings.

The 12-cut cliff stays a **DESIGN_LIMITATION** (D `h4` reaches it only with a hand-made BuildingV2).

## 3. Thin rings from storeyRects or pieces (D-2 / C-4 / B-3): reachable or not?

**C's invariant holds.**
- `layout.ts:1454` admits a storey region only if `ox ≥ minSpanM && oz ≥ minSpanM`, and a piece only if
  `isBody … Math.min(w,d) ≥ minSpanM` (l.1441).
- `minSpanM = max(1, 2·wallM + 0.2)` (l.334).
- B-2 is right that `wallM` is the sheet median, about half of T in 4/8 houses. But the 1.0 m floor dominates:
  2T ≤ 0.98 in every corpus house (T ≤ 0.49).
- So a storeyRect or piece narrower than 2T needs T > 0.5. The clamp allows T up to 0.7; the corpus never reaches it.

**Final class: COVERAGE_GAP.**
- Proven at code level by D `h1`, C `probe-thin-gap` and F `thin-skip`.
- Reachable only when T > 0.5, or when wallM > T, which does not happen today.
- Not the owner's mechanism: the house has one level, so attached-1 has `storeys = [0]` and gets no storeyRects and no
  pieces. D and C both deduce the same.
- Margin: marcowki has 2T = 0.98 against the 1.0 floor. A house with 0.51 m walls opens the gap.

## 4. B-1: one global T, sometimes a partition

**The arithmetic holds.**
- Overlap area = (2T − W)·(L − 2T). This was verified independently against the validator: 0.51, 0.81, 0.34 and 0.295
  for the F `thin-skip` table.
- B's W grid follows from it.
- But "0.6–0.96 m" is **conditional on the owner's T being in the corpus range 0.43–0.49**. With a gozd-like T = 0.30
  the same 0.3092 m² gives W = 0.38–0.58 m. The owner's T is unknown, so W is not pinned.

**Does a per-body T change the owner's case?**
- Only if the owner's body has its own walls drawn thinner than the global T, so that 2·t_body < W.
- In that case P2R's DRAWN_THIN_WALLS should already have fixed it.
- That it did not means one of three things:
  - the body's walls are drawn at house thickness (then per-body T changes nothing, and the body is genuinely < 2T);
  - the profile failed. A new finding: openings on the far long wall break the band (§2, F-R1), and CANOPY_ON_POSTS
    leads to KEEP_PARTIAL;
  - the run is not 2.5.0.

**Final class.** B-1 is a **CONFIRMED_DEFECT** for dimensions: gozd builds 0.30 m walls where the faces are drawn
0.43 m, per B's band-probe. I did not re-run it, but gozd's ring thickness of 0.30 in `r1/gozd/program.json` matches.
It is **plausible but unproven** as the owner's cause.

## 5. C-1 and C-2

**C-1 is a CONFIRMED_DEFECT** (re-run).
- `m-full`, `m-deep9`, `m-wide6` and `t-strip045` all give a main body 12 m wide, with the drawn house/garage wall
  turned into an INTERIOR partition and the gable over the garage. `m-wide6` has no main roof.
- The gate reports STRUCTURAL_LAYOUT_REJECTED with 4 × BLOCKING, yet the preview is COMPLETE. This is a silent failure:
  the refusal codes deliberately exclude the silhouette code.
- The HOLLOWAY control is correct.

**C-2 is a CONFIRMED_DEFECT** (re-run).
- In `gb-setback-door` the garage (3.6 × 6.0 m, behind a 2.4 m door) disappears. One body is built, the gate says
  ACCEPTED, and the only gap is an unrelated thin band.
- The `gb-flush-door` control finds the garage.

**Relation to the owner.** C-1 produces strip bodies; C-2 loses bodies. Either can change which region is attached-1
(the smallest). Neither is shown to produce a body narrower than 2T. `t-strip045` swallowed the strip into main
instead.

## 6. E-1 and E-3

**E-1 is a CONFIRMED_DEFECT at function level** (re-run with the production `skyMask`; 3 WRONG out of 7).
- Green trees, olive/brown trees and a garage standing behind all count as "built", so the body is WIDENed to
  11.99 m.
- The controls are right: empty sky gives CONTRADICTS and a line drawing gives CONTRADICTS.
- It reaches production only with tone-filled elevations, which the corpus has (tone reads exist).
- Its effect is a wrong WIDEN, which removes a refusal. It cannot produce the owner's refusal.

**E-3 is a CONFIRMED_DEFECT on the corpus.**
- In a01 the RIGHT view has ground error 0.709 and its heights are REFUSED.
- Its same-sheet LEFT copy has the same error 0.709 but heights READ.
- FRONT (0.46) and REAR (0.42) band views are also READ, while `facadeAlignment.views[*].heights` is false for all
  four views.
- `r1/a01/model.json` takes those sill/head values into the model:
  - `opening-0-west-3-1` head 1.9876 from ad8fd1a56b;
  - `opening-0-front-0-0` 2.0406;
  - `opening-0-rear-2-1` 2.1187.
- Correction to E: the evidence is labelled `head SOURCE_DERIVED / height VISUAL_INFERRED`, not
  IMAGE_METRIC_REGISTERED. The heights are still wrong by up to the ground error.

## 7. A-1 and A-3

**A-1 is a CONFIRMED_DEFECT (missing reconciliation)** (re-run).
- marcowki ATTIC: the 853 DIMENSIONED copy reads 3.697 cm/px from 8 anchors (conf 0.84). The 853 AREA copy reads
  1.039 cm/px. That is 3.6× on same-size sheets, and nothing compares them.
- arganiach ATTIC: 0.899, 1.907 and 2.188 cm/px.
- I did not re-check visually that the copies are one drawing. A's grey difference of 1.3 to 3.6 supports it.
- arganiach's model is a single 7.94 m level.
- Note for the owner: "one level" in the program does not prove a one-storey house. An unstacked upper storey gives
  the same 16-command checkpoint. This does not change §3, because every mass still has `storeys = [0]`.

**A-3 is HIGH_RISK** (mutation reproduced).
- With `marcowki undimension` the run throws METRIC_RESOLUTION_INCONCLUSIVE.
- The trigger is an artificial relabel. No real house is shown where the DIMENSIONED claim lands on the smaller copy.
- It produces a total refusal, not the owner's partial preview.

## 8. New finding from this round (F-R1, CONFIRMED_DEFECT, synthetic end to end)

**Openings on a thin body's far wall make the adjudicator read the wall as posts.**
- **FIRST_BAD:** `thin-body.ts adjudicateThinBody`.
  - The far wall must reach `BAND_INK_SHARE` 0.6 ink along the band (`farBand`).
  - Windows break it.
  - `farEdgeInk` in 0.05–0.45 then gives CANOPY_ON_POSTS SUPPORTED. With no buildable reading the decision is
    KEEP_PARTIAL.
- **Input:** THINWALL with 2 windows of 1.0 m on the wing's 6 m long wall.
- **Current behaviour:**
  - WIDEN, SHARED_WALL, DRAWN_THIN_WALLS and SOLID_WALL are all REFUTED; CANOPY_ON_POSTS is SUPPORTED.
  - Preview is PARTIAL with failure `21 createWallRing ring-attached-0-0 WALLS_OVERLAP`, matching the owner's signature
    shape.
  - With 4 windows the wing is not a body at all. The result is COMPLETE, and nothing names the lost 0.5 × 6 m body
    (only 5 unrelated gaps).
- **Correct behaviour:**
  - Gaps in a drawn wall that the plan's own opening reader (or the elevation) explains as openings should count as
    wall.
  - A body lost with a printed 0.5 m chain segment over it should be named.
- **Missing test:** THINWALL and SLIVERTON have no openings on the thin body.
- **Repro:**
  - `npx vite-node research/analyzer-n7-council/F/thinwall-openings-e2e.ts -- --n=2`
  - `npx vite-node research/analyzer-n7-council/F/thinwall-openings-e2e.ts -- --n=4`
  - `npx vite-node research/analyzer-n7-council/F/thinwall-n4-gaps.ts`

## 9. Reconciling with F.md: what fits the owner's screen

The house reads as single level: 16 = 13 + 1 + 2. Possibly an upper storey was not stacked (A-1/A-2). Either way,
attached-1 is a plain single-storey ATTACHED body.

| mechanism | fits the counters? | "the body attached-1, X m across" in Nierozstrzygnięte | solver line | 0.3092 vs P2 |
|---|---|---|---|---|
| KEEP_PARTIAL (source conflict, no buildable reading incl. F-R1 openings/CANOPY, elevation contradiction) | yes | **present** (reason names why) | 2.5.0 | identical; unresolved count +1 vs P2 |
| B-1 (house T > the body's own walls) | yes, only *through* KEEP_PARTIAL or F-3 | present (if KEEP_PARTIAL) | 2.5.0 | identical |
| D-1 (reconciliation narrows a body read ≥ 2T) | yes, layout path unproven | **absent** | 2.5.0 | identical; unresolved count unchanged |
| F-3 (WIDEN/DRAWN decision still < 2t) | yes | absent | 2.5.0 | **changes** |
| storeyRects/pieces (C-4) | **no** (single level) | — | — | — |
| stale / old result | yes | absent | **≠ 2.5.0**, or the house sheet shows no version (F-2) | identical |

**The single discriminating observation.**
1. On the fresh result card (right after "Analizuj"), open **Szczegóły analizy**.
2. Under **Źródło**, read `analyzer: service … · solver …`. Anything other than 2.5.0 means an old or service result.
3. With 2.5.0, look under **Nierozstrzygnięte** for "the body attached-1, X.XX m across":
   - **present:** P2R ran and chose KEEP_PARTIAL. Its reason text says which: printed-vs-drawn conflict, "no
     buildable reading holds", or an elevation shows nothing built.
   - **absent:** the body was never adjudicated (it was read ≥ 2T), which points to D-1.

None of this needs the house identified. The checkpoint hash discriminates nothing, because it covers only the main
body's prefix.

## Final classes

| claim | class | reason |
|---|---|---|
| D-1 mechanism + dropped record | CONFIRMED_DEFECT (function) / HIGH_RISK (owner) | reproduced on hand-made input; no layout yields a cm-overlap (toOuterFaces keeps shared faces; corpus abuts exactly) |
| D-3 frames from house T | CONFIRMED_DEFECT | e2e THINWALL + 1 opening → FILL_TOO_LARGE partial |
| D-3 ">12 cuts → total refusal" | DESIGN_LIMITATION | unreachable via thin bodies: 2+ openings already break DRAWN_THIN_WALLS (F-R1) |
| D-2 / C-4 / B-3 storeyRects/pieces | COVERAGE_GAP | code-proven; reachable only with T > 0.5 (minSpanM floor 1.0); not the owner's (single level) |
| B-1 global T | CONFIRMED_DEFECT (dims) / HIGH_RISK (owner) | gozd 0.30 vs 0.43 faces; owner W range conditional on unknown T |
| B-2 two thicknesses | DESIGN_LIMITATION today | masked by the 1.0 m floor while 2T < 1.0 |
| C-1 merge, gate REJECTED → COMPLETE | CONFIRMED_DEFECT | re-run m-full/m-wide6/t-strip045 |
| C-2 set-back garage lost | CONFIRMED_DEFECT | re-run vs flush control |
| E-1 sky = not-built | CONFIRMED_DEFECT (function) / HIGH_RISK (prod) | real skyMask; can only WIDEN wrongly, never refuse |
| E-3 heights from refused grounds | CONFIRMED_DEFECT | a01 audit + model heights; label is VISUAL_INFERRED not IMAGE_METRIC_REGISTERED |
| A-1 copies unreconciled | CONFIRMED_DEFECT | marcowki attic 3.697 vs 1.039 cm/px re-read |
| A-3 base copy by weak label | HIGH_RISK | real only by mutation |
| F-R1 openings → CANOPY → KEEP_PARTIAL / body lost | CONFIRMED_DEFECT | new, e2e synthetic; the most natural real-world route to the owner's KEEP_PARTIAL |
