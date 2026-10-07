# BUILDPLAN-ANALYZER-005L — Council Reviewer D: generalization red team

Code under review: `/home/user/work005l/council-wt` @ 4ad69fe (diff a70047f..HEAD), `packages/reconstruction/src/layout.ts`.
Line numbers below are from that worktree.

## Verdict: CHANGES_REQUIRED

Two P0s and six P1s. Each one is shown with a probe and the output it produced.

The support relation itself is sound: separate walled regions, SUPPORTS by span, named overhangs, AMBIGUOUS on exact ties.
It holds on every synthetic shape I drew at the development houses' scale and orientation. The problems show up in two places:

1. **Registration rests on an ARCHON export property.** 7 of the 8 multi-storey PASS rows are registered at `walls@1`, the
   "plan below's own scale k=1" hypothesis. Export the same sealed upper plan at 0.8× or 1.25× and 4 of the 8 PASS rows break.
   In two of them the upper storey is built at 80 % of its size and nothing is flagged.
2. **Several tolerances are much wider than the "wall thickness + jitter" they are argued from, or sit right at the edge of a
   fixture.** Cantilevers of 1.2–3 m are clipped with no flag. Stated set-backs of up to two walls are erased. Placement order
   picks the side of an unstated set-back. Three knobs move PASS-row outcomes at ±25 %, yet the synthetic corpus does not react
   to them at ±50 %, so their values are pinned only by the development rows.

## How I probed (all throwaway, outside `/home/user/BuildApp`)

- **Private copy.** `/home/user/work005l/council-d` is a tar copy of council-wt with hard-linked node_modules, so I would not
  disturb other reviewers who share council-wt. In it, every 005L constant and literal can be overridden through
  `globalThis.__p005l` or `P005L_<NAME>`. The defaults are unchanged: corpus and probes are byte-identical at default, and the
  `NOOP` setting reproduces the default on all 26 rows.
- **Sources and outputs** are archived in `/home/user/work005l/council/D-probes/`:
  - `probe-d5l*.test.ts`: synthetic probes, end-to-end SyntheticHouse probes, timing, and the in-process synthetic sweep.
  - `sweep.ts`: in-process sweep of the development rows on their sealed evidence, 79 settings × 26 multi-plan rows, via
    `composeStructuralLayout`.
  - `rescale.ts`: development rows with the non-ground plans re-exported at another raster scale.
  - JSON outputs.
- No publisher picture was written, copied or looked at. Rasters were decoded in memory only.
- **Scales.** Synthetic plans use 5 cm/px. Walls are 12 px (0.6 m) unless marked "w8" (8 px = 0.4 m). SyntheticHouse uses
  0.4 m walls at 38 px/m.

---

## Findings

### D5L-1 — P0 — Registration of a chain-less upper plan depends on the sheets sharing one pixel scale (an ARCHON export property)

**Where:** `layout.ts:916-933` (same-scale hypothesis), `:951-962` (ranking), `:974`.

**Scenario.** Many catalogue sites crop and scale each storey's image separately, so storeys are exported at different px/m.

**Probe: `rescale.ts`.** For each multi-storey PASS row, I took the sealed evidence, removed the non-ground plans' own chains
and registration, and bilinearly resampled those plans by f.

Stripping the chains alone changes nothing at f=1 for arkadiach, morelach, tunbergiach, A03, A06 and A07: those upper plans
carry no registration in the sealed evidence. For them the only change is the export scale.

**Observed:**

| row | as sealed | f = 0.8 | f = 1.25 |
|---|---|---|---|
| dom-w-tunbergiach | storey-1 `[0,0,11.73,10]` | **k=1 (should be 1.25)**, storey-1 `[0,2.04,9.27,10]` (−37 %, 80 % size), STACKED, overhang NONE, no conflict for that storey | attic placement moves |
| dom-w-jablonkach | `[0,0,11,9]` | k=0.97, storey-1 `[2.6,0,11,6.67]` (≈76 % size), overhang NONE | `[3.75,2.19,11,9]` |
| A06 | porch mass `3.46,0,7.34,1.44` 0..1 | holds | porch loses its storey; main upper `[0,2.26,…]` vs `[0,1.44,…]`; **gate ACCEPTED, no reasons** |
| dom-w-arkadiach | ok | ok | **k=1 (should be 0.8)**, NO_SUPPORT |
| marcowki | ok | k=1, NO_SUPPORT | k=0.79, the garage gains storey 1 |
| dom-w-morelach | ok | ok | upper footprints re-cut into 3 different pieces |
| A03, A07 | ok | ok | ok |

In every case where the answer is wrong, the chosen hypothesis is the k=1 "own scale" one, or a scale near 1, beating the
correct ratio. The development set never exercises any other scale: 7 of 8 PASS rows chose `walls@1`, and the 8th chose a
fitted 1.02 (sweep default records).

**Suggested generic fix:**
- Treat k=1 as an assumption that has to be corroborated, not as a co-equal hypothesis. Keep it only where a facade wall pair
  on both axes agrees with k≈1 within `WALL_PAIR_SCALE_AGREEMENT`, so it becomes a member of the wall-pair family.
- Where the best placement at k=1 and the best at a wall-pair or fitted scale ≠1 fall inside the rival window and stand the
  storey differently, mark the scale AMBIGUOUS. Do not stack.
- A placement at the wrong scale leaves the plan's far walls landing nowhere on both axes at once. A true inset or overhang
  leaves only the inset sides unlanded. That asymmetry can be measured and weighed.
- Add rescaled replays (0.8×/1.25×) of the development rows to the regression matrix.

### D5L-2 — P0 — Cantilevers of 1.2–3 m are clipped with no flag (WITHIN_TOLERANCE)

**Where:** `layout.ts:1279` (`unsupported <= (w + d) * bandM`), with `bandM` from `:1240` and `tolM` from `:1670`.

The allowance is an area. It is argued as "a band along two of its sides", but an overhang along one side of depth t passes
whenever t·side ≤ (w+d)·bandM. For a 12 × 17 m body that means up to about 2·bandM along the long side and about 3·bandM along
the short side.

**Probes: `probe-d5l.test.ts`, `probe-d5l-2.test.ts`, `probe-d5l-e2e.test.ts`.**

- **0.6 m walls** (bandM = 1.2 m), stated scales, chains on both plans:
  - east cantilevers of 0.6–2.0 m (2.0 m = 34 m²) → `WITHIN_TOLERANCE`;
  - south cantilevers of 0.6–**3.0 m** (36 m²) → `WITHIN_TOLERANCE`.
  - In both cases the upper footprint is `[0,0,12,17]`, with no unresolved and no conflict.
- **0.4 m walls** (`w8-*`): east cantilevers up to 1.4 m (23.8 m²) and south up to 2.0 m (24 m²) → `WITHIN_TOLERANCE`, silent.
- **End to end:** SyntheticHouse `INSET_REAR` with `upperInset {minZ:-1.2}` and `upperChainsZ [9.6]`. The emitted level-1 ring
  is `[0,0,9.6,8.4]`, identical to the ground ring. Gate `STRUCTURAL_LAYOUT_ACCEPTED`, no DEGRADING reason. The 11.5 m²
  overhang is gone. A 1.8 m cantilever is named.
- **Fixture 13 sits at the edge of the allowance.** Its 2.5 m overhang (42.5 m²) clears the allowance (37.8 m²) by only 12 %.
  In the synthetic sweep, `OVERHANG_K` or `BAND_WALLS` at ×1.25 flips C13 to `WITHIN_TOLERANCE`.
- **Fitted scales also absorb cantilevers.** `cantilever-east-1m` and `-south-1m` chose a fitted k=0.96/0.97 although both plans
  print 5 cm/px, so the cantilever disappeared into a 3–4 % rescale (see D5L-3).

**Suggested generic fix:**
- Classify by the protrusion of each side beyond the union of the supporting bodies, compared with the band, not by area.
- A protrusion beyond the band on any side is `BEYOND_TOLERANCE`, which keeps the existing unresolved and conflict.
- Size the band from what it is argued to cover (see D5L-3), not as 2 walls.

### D5L-3 — P1 — Snap band of about 2 walls erases set-backs the source states; fitted scales override both printed scales

**Where:** `layout.ts:1240`, `:1272-1273`, `:1670`, `:822-825`.

- **Why the band is 2 walls.** `tolM = max(wallM, tolerancePx·mpp)`, which is already one full wall, and `bandM = tolM` plus the
  upper wall. That makes the band 2 walls. Yet the code's own reason covers at most an inner-line-to-outer-face offset (≤ 1 wall)
  plus registration jitter, and `matchedLength` itself uses half a wall as tolerance. Sides that are stated by chains, and so
  already sit at outer faces, are snapped the same way.
- **Probe, synthetic.** `inset-rear-{0.6,0.8,1.0,1.2}m-stated` (whole-building chains, as in fixture 2) all give an upper
  footprint of `[0,0,12,17]`. The stated 16.4/16.2/16.0/15.8 m depths are lost.
- **Probe, end to end.** `INSET_REAR` with `minZ 0.6` and `minZ 0.8` (0.4 m walls, upper chain 7.8/7.6) emits level 0 and
  level 1 rings that are **both `[0,0,9.6,8.4]`**, with gate ACCEPTED. This is exactly the "ground ring copied upstairs" result
  that brief §12 rules out.
- **Probe, fitted scale.** `inset-1.5-ownchains`: both plans are registered at 5 cm/px, but the fitted placement at
  **k=1.05** wins, the 1.5 m set-back becomes the whole body, and the margin is 0. The fitted scale is allowed to contradict
  both printed scales by up to `maxAnisotropy` (15 %).
- **Suggested fix:**
  - Snap a side only by the offset its own kind implies: 0 for a chain-stated outer face, ≤ 1 wall for a band axis or inner
    line, plus the registration's half-wall tolerance.
  - Make a fitted or wall-pair scale that disagrees with an admissible stated scale ratio have to refute it, the way stated
    offsets already do (`:974`), and report the disagreement as a conflict.
  - Caution: Marcówki's and Jabłonkach's attic registrations state k≈1.40 while the walls say ≈1.0. The refutation has to stay
    possible; a hard bound would be wrong.

### D5L-4 — P1 — Which side an unstated set-back sits on is chosen by sort order; mirrored drawings do not give mirrored answers

**Where:** `layout.ts:951` (tie order `… a.offsetX - b.offsetX || a.offsetY - b.offsetY`), `:1337` (`SAME_SUPPORT_IOU`),
`:1688`.

**Scenario.** A 12 × 17 body has an upper storey 1.5–2.5 m shallower, and nothing states which end it is flush with.
Fixture 2b only covers the 6 m case.

**Probe: `probe-d5l-3.test.ts`.**
- Front and rear readings tie exactly, but their IoU is ≥ 0.7, so they count as "same support". The result is STACKED at the
  min-offset placement, margin 0, no conflict: for example `inset-2-ownchains` gives `[0,0,12,15]`.
- **Mirrored in z,** the same building also gives `[0,0,12,15]` in its own frame. That is the opposite physical end.
- Along x the same happens: `xinset-2` gives `[0,0,18,17]` both straight and mirrored.

**Sweep.** `SAME_SUPPORT_IOU` = 0.875 turns every 1.5–4 m case AMBIGUOUS. At 0.525, a **4 m** unstated set-back is stacked
silently. The threshold is load-bearing, and the corpus does not test it.

**Suggested fix.** Two exact-tie placements are one reading only if their footprints agree side by side within the band.
Otherwise they are rivals and fall under AMBIGUOUS. Add a mirrored-in-z version of fixture 2b and a 2 m version.

### D5L-5 — P1 — A terrace over the garage, closed by a parapet drawn as a solid band, gives the garage an upper storey with no flag

**Where:** `layout.ts:1236` (`isBody` = wall fraction and span only), `:1252`.

**Probe: `terrace-over-garage-balustrade-{12,8,6}px` and `terrace-parapet-5px`.** Ground is house plus garage; the upper plan
is the house plus a parapet on three sides of the garage roof.

- Parapets of 5–12 px (0.25–0.6 m), with or without chains: the garage mass goes `12,8,20,17 0..1`, the upper footprint is
  `[12,8,20,17]`, overhang NONE, no conflict, gate unaffected.
- At 3–4 px the terrace is correctly not a body.

This is the brief §13 hard gate. Fixture 9 only covers a terrace that is open on one side.

**Suggested generic fix:**
- A region walled mostly by bands clearly thinner than the plan's exterior wall (`wallPx`) is enclosed by parapets or
  partitions, not by a storey's outer walls. It should count as NOT_A_BODY.
- If the parapet is drawn at full wall thickness, the pixels cannot settle it. A region that would give an otherwise
  one-storey body its first upper storey should then need corroboration, for example an opening in the house wall or the
  upper storey's room list, or be left AMBIGUOUS.

### D5L-6 — P1 — A second drawing on a chain-less upper sheet stacks the garage

**Where:** `layout.ts:1252`, `:1726-1790` (BEYOND_TOLERANCE regions still raise storey spans).

**Probe: `two-plans-one-sheet-gap{1.5,3,5}-nochains`.** The upper sheet carries the house plan plus a second, smaller plan
1.5–5 m to its right.
- The second drawing becomes `region-built-2-1`.
- It stands on the garage over 6.2×6.7, 4.7×6.7 and 2.7×6.7 m respectively, which is only **16–35 % of the region**.
- The garage goes 0..1 with upper footprints such as `[17.27,8,20,14.68]`. The only signal is a BEYOND_TOLERANCE overhang
  conflict of 75–98 m².

With chains on the upper plan, the chain extent excludes the second drawing and the answer is correct, so this is the
chain-less class that fixture 8 represents.

**Suggested generic fix.** A region that is mostly unsupported (BEYOND or UNSUPPORTED) should not raise a body's storey span
when no NONE or WITHIN region already carries that body to the storey. Name the region instead (garage safety first).

### D5L-7 — P1 — Ties: AMBIGUOUS catches only bit-exact synthetic ties; real near ties are stacked even on the garage question

**Where:** `layout.ts:1196` (`STOREY_TIE = 1e-6`), `:1719`, `:1726`.

- **Development rows.** Two rows are decided between placements that stand the storey on different bodies by margins of
  0.0020 (willa-miranda) and 0.0025 (A01). Both become AMBIGUOUS at `STOREY_TIE = 0.01`. Real rasters never tie exactly; the
  corpus's AMBIGUOUS cases (fixtures 7 and 2b) are exactly symmetric drawings.
- **End to end.** HOUSE_AND_GARAGE with the upper storey cantilevered 1.2 m west (`upperInset {minX:-1.2}`) is the real upper
  storey. The chosen `envelope` placement, which stands on house and garage, beats `region-built-0-0`, which stands on the
  house only, by **0.026**. The difference is essentially the 0.15·coverage prior. The model then gets a **1.19 × 5.0 m upper
  ring on the garage**.
- **The sliver passes the span test.** It passes because `minSpanM = max(1, 2·0.4+0.2) = 1.0 m` with 0.4 m walls. Fixture 5b
  (0.6 m sliver against a 1.4 m threshold) is only exercised at the synthetic 0.6 m wall. The row was only rejected by the
  silhouette gate.
- **Suggested fix:**
  - Size the tie as a score difference that one wall of registration jitter can produce, not 1e-6.
  - In the near-tie band, when the chosen placement and its rival disagree on which bodies the storey stands on, stack only the
    bodies both readings agree on, and leave the disputed body AMBIGUOUS. Garage protection should not depend on a coverage
    prior.

### D5L-8 — P1 — Three knobs move PASS-row outcomes at ±25 %, and the synthetic corpus does not constrain them

**Source:** the material-change table in `D-probes/sweep-dev-material.txt` (decision, storey span, upper footprint more than
0.3 m off, overhang class, gate) and `sweep-syn.json`.

| constant | change | material effect on development rows |
|---|---|---|
| `FACADE_WALL_SHARE` (0.25) | +25 % | **A03** (PASS) placement → k=0.86, upper `[0,0,9.11,10.01]` vs `12.01`, gate ACCEPTED→PARTIAL; Marcówki gate; azaliach STACKED→NO_SUPPORT; D00 spans |
| `FACADE_WALL_SHARE` | −25 % | A01, A04 upper footprints (FAIL rows) |
| `WALL_PAIR_SCALE_AGREEMENT` (0.02) | +25 % | **Marcówki** (PASS) chooses walls@**1.56** by 0.0027, its garage gains storey 1, 62.8 m² BEYOND; A03 gate |
| `WALL_PAIR_SCALE_AGREEMENT` | −25 % | A01 spans |
| `SUPPORT_SPAN_K` (minSpanM as SUPPORTS threshold) | +25 % | **A06** (target row) porch mass `3.46,0,7.34,1.44` loses storey 1 (its overlap is 1.44 m), gate→PARTIAL; gozdzikowcach spans |
| `SAME_SCALE_OFFSETS_PER_AXIS` (6) | −33 % / −50 % | willa-miranda spans / **jabłonkach** (PASS) upper `[0,0,11,3.65]`, BEYOND 61.7 m² |
| `STOREY_RIVAL_WINDOW` (0.1) | +25 % | A03 gate ACCEPTED→PARTIAL (rival at 0.113) |
| `OVERHANG_K`, `BAND_WALLS` | +25 % | corpus **C13** flips (D5L-2); development rows: overhang classes only |

In the synthetic corpus, `FACADE_WALL_SHARE` at ±50 % and `WALL_PAIR_SCALE_AGREEMENT`, `STOREY_RIVAL_WINDOW`,
`SAME_SUPPORT_IOU` and `STOREY_TIE` across their whole sweep flip **no** fixture. So their values are justified only by the
development rows, and those rows sit just inside the upper edge of the first two.

Registration margins on PASS rows are thin: A07 0.0005 (same support), A06 0.010, morelach 0.012, tunbergiach attic 0.018,
A03 0.033, Marcówki 0.039.

**Suggested fix.** Add synthetic fixtures that pin each of these knobs: a facade wall broken by glazing, a near-agreeing wrong
wall pair, a 1.2–1.6 m porch under an upper storey at 0.4 m walls, and a rival just outside the window. Or derive the values
from pixel precision. Either way, record why A03, Marcówki and A06 are not on a knife edge.

### D5L-9 — P2 — No rotation or mirror hypothesis

**Probe.** An L-shaped upper plan whose sheet is rotated 180° is stacked with a flipped L (`[8,0,20,17]` + `[0,9,8,17]`), with
and without chains, at margin 0.2 and no flag. Rare among Polish publishers.

**Suggestion.** Name the assumption "every storey sheet has the ground plan's orientation" in architecture.md. A cheap guard
would score the 180°/mirror placement of the best fit and raise a conflict when it shares clearly more wall.

### D5L-10 — P2 — `whole()` reads equal extent spans as "both chains measure the whole building", and a stated placement silences its rivals

**Where:** `layout.ts:862-868`, `:974-975`, `:1719`/`:1726` (`!(alignment.stated && !rival.c.stated)`).

**Probe: `shifted-upper-*`.** An upper storey of the same width but shifted 2 m: equal spans count as stated, and the stated
placement is taken without a conflict. With real-style origins (first tick of the longest chain) this gives a flush answer.

A stated placement held against a better non-stated fit records a negative margin (for example −0.27 in
`cantilever-east-0.6m`) that never reaches the gate.

**Suggestion.** Require tick correspondence, not just span equality, and emit a conflict when a stated placement is held
against a fit that shares more wall.

### D5L-11 — P2 — Bounded search: the bound is understated and there is no explicit cap; no blow-up in practice

- The `extra` lines (`:693-696`) can push lows and highs to 6 per axis, not 4, so pair loops are up to 6⁴ per axis and the
  crossing up to (6⁴)².
- `alignmentTargets` returns every BUILT region plus up to 2, not "masses + 2".
- **Measured** (`probe-d5l-perf`): a 20×20 wall grid (38 long bands per axis on each plan) produced 5361 distinct candidates,
  `alignPlans` 181–287 ms and layout about 2.2 s. A 40×4 grid took 43 ms.
- Not unbounded, but there is no hard cap on considered candidates. Add one, plus a test pinning the worst case.

### D5L-12 — P2 — A ROOF-labelled floor plan is read as an occupied storey (latent, §19)

`STOREY_RANK` contains ROOF and `readPlans` reads it (`:337`). A FLOOR_PLAN/ROOF frame with a heavy eave outline was stacked as
storey 1 over a one-storey house, using a fitted k=0.92 to fit the eaves to the walls, with no flag (`probe-d5l-4`). No current
adapter emits `storey: 'ROOF'` for a FLOOR_PLAN; a future one could.

### D5L-13 — P2 — Outline-only or hatched walls are refused

Thin double lines and dot hatching give no bands, so the result is `NOT_REGISTERED` with a typed AMBIGUOUS unresolved. This is
a pre-existing band-detection limit; it is a refusal, not garbled output.

---

## What held

- **Exact symmetry gives the same ambiguity in both mirrors.** These all came out AMBIGUOUS:
  - fixture 7 mirrored in z, and rotated 180°;
  - a 20 m body with an upper storey at either end (no chains, own chains only, a door on either half, a 13 px wall);
  - 2b in four perturbations (north window, mid partition, no door, mirrored in z).

  Fixture-16-style frame and chain orders are stable. Openings do not break ties, because bands bridge door gaps.
- **Scale and position (synthetic).** Chain-less upper plans at 0.35×–2.0× register to the right scale with correct support.
  Beyond `MAX_WALL_PAIR_SCALE` (0.3×), the fitted fallback is about 6 % off and the support is still right. Tight and loose
  crops, a plan drawn elsewhere on its sheet, and real-style registration origins (fixtures 1/2 moved) all work.
- **Wings and bodies.** These are all correct:
  - a wing with its own shallower upper storey;
  - a room over the garage drawn as a separate region;
  - one upper region bridging house and garage (pieces per body);
  - an upper storey over the garage only;
  - the cantilever-over-garage sliver of 5b at 0.6 m walls.

  A rectangular upper plan mirrored on its sheet places correctly. An unrelated upper plan gives AMBIGUOUS, not STACKED.
  Parapets of 3–4 px are not bodies.
- **Constants with no material effect at ±25–50 %**, on either the development rows or the synthetic corpus:
  `MIN_WALL_PAIR_SPAN_WALLS`, `STATED_HOLDS_SHARE`, `STOREY_RIVALS_WEIGHED`, the `whole()` 1 % share, `wallsBeyond`'s 2·band,
  the tiling-merge 2·tol, and `statedBonus`.
  - `OUTER_WALLS_PER_END`: +25/50 % no change; −25 % only azaliach (a FAIL row).
  - `MAX_WALL_PAIR_SCALE`: +25 % no change; −25 % only A04 (a FAIL row).
- **Search runtime is bounded** (D5L-11).

## Probe index

All in `/home/user/work005l/council/D-probes/`:

| file | what it is |
|---|---|
| `probe-d5l.test.ts`, `probe-d5l-2.test.ts`, `probe-d5l-3.test.ts`, `probe-d5l-4.test.ts` | layout-level probes |
| `probe-d5l-e2e.test.ts` | SyntheticHouse end to end |
| `probe-d5l-perf.test.ts` | search timing |
| `probe-d5l-sweep.test.ts` | synthetic sweep (corpus fixtures 1–16 copied, with their assertions) |
| `sweep.ts` | development-row sweep, results in `sweep-dev.json` and `sweep-dev-material.txt` |
| `rescale.ts` | rescaled development rows, results in `rescale*.json` |
| `param.py` | how the constants were made overridable |

To re-run, put the files back into `packages/reconstruction/test/` (and `research/d5l/`) of a disposable copy and set
`PROBE_OUT`, `SWEEP_SETTINGS` and `P005L_*`.
