# Reviewer A: dimension topology, BUILDPLAN-ANALYZER-005I (c150896)

**Verdict: CHANGES REQUESTED.** The core of the change holds up. The Hungarian solver is exact, the per-neighbourhood decomposition is right, the canonical ordering and the mapping of chain indices back to input order are right, runs are deterministic, the OCR input is frozen, and the work is bounded. Two problems block approval:
- **A1:** wall refutation can still choose a metric side.
- **A2:** label-ink rejection removes a genuine tick that text overlaps.

Both were reproduced. Scratch harnesses are in `/tmp/claude-0/reviewA/`; nothing in the repo was changed.

## What I checked and found sound
- **`hungarian`:** 0 mismatches against brute force over 3,000 random matrices (n ≤ 5, m ≤ 8, 30 % FORBIDDEN entries, negative costs).
- **Neighbourhoods and margins:** union-find on shared slots is the correct decomposition. The margin re-solve (forbid the chosen slot, or force a binding through `solveNeighbourhoodBound`) is correct. FORBIDDEN = 1e9 stays finite and always leaves a feasible solution through the per-row "unassigned" columns. `chainOrder[...].i` maps chains back correctly in both `perChain` and `decisions`.
- **Bounds (§43):** a 96-label single neighbourhood on the exact path runs in 17–47 ms. Repeated runs are identical.
- **`labelSide`:** consistent with `ocr.ts`. ROTATED_CW (90°, reading bottom to top) has glyph tops toward −x, ROTATED_CCW toward +x, INVERTED toward +y. Glyph boxes are unrotated into page coordinates (`ocr.ts:1054`).
- **OCR frozen (§9):** `markLabelInk` changes classes only, never `ticksPx`. `allChains` therefore has 005H's ticks, and `onDimensionLine` and the recogniser crops ignore class, so lattices and crops are byte-identical.
- **End spans:** `dimensionedAxis` can only keep more than 005H did; it never trims a span 005H kept.
- **Blind-house constants:** none in code. All thresholds are in label heights or `wallPx`.
- **Global matching is robust where every interval has its label:** 2- and 3-line stacks bind correctly even with the label orientation flipped and with labels printed below their lines (`exp1`, `exp2`, `exp4`).

## Findings

### A1 — P1 (P0 if it fires on any development sheet) — wall refutation picks a metric side and reports it as strong (§16)
`packages/reconstruction/src/plan-decomposition.ts:959-976`

When ≥ 2 walls run past a dimension-framed side, the side moves to the **nearest** TICK on **any** non-INTERIOR chain of that axis, anywhere inside the overshoot window. After the move:
- the walls are not checked again;
- `weak` stays false;
- `OUTER_TOTAL_MARKS` frames are refuted too — the drawing's explicit overall dimension gets overridden by walls (only `WALL_GEOMETRY_EXTENT` is skipped, line 944).

**Reproduced (`exp3`):**
- Setup: main block 120–520 px, a garage's two walls running on to 760 px, and an exterior chain with ticks at 520/560/680/760 where only 120–520 is read. Its own short unread end segments are trimmed, so it frames 520.
- Result: `S` moved to **560** (a window-jamb tick 40 px out). `weak:false`. The walls still run 200 px past the new side.

**Same mechanism on a porch:** a porch whose two side walls stick out more than 2 walls, plus any porch-depth tick, pulls a correct frame out over the porch.

**Fix:**
- Accept only a chain's **terminal** TICK lying within about one wall of where the contradicting walls end (`at ± overshoot`).
- Re-test after the move. If walls still overshoot by more than 2 walls, mark it DOWNGRADED.
- Never refute an `OUTER_TOTAL_MARKS` side.
- Carry ALTERNATE as a hypothesis, or at least a `wallSelected`/weak flag, so the resolver can weigh it instead of receiving it as a dimension statement.
- Add a test with an intermediate tick (e.g. `[120,535,560]`).

### A2 — P1 — a genuine tick overlapped by labels on both sides is REJECTED, not doubted (§11)
`packages/source-metrics/src/dimension-lines.ts:615-635`

`textSide` tests only whether ≥ 90 % of the ink in the window lies inside padded glyph boxes. It never asks whether that ink **touches the line**. So a real stroke whose arms are covered by glyph boxes on both sides counts as "nothing crosses". The mark becomes REJECTED and is deleted from the measurement chain.

**Reproduced (`exp5`, production `dimensionChainsOf`):**
- Setup: a slash tick at 300 on a ruled line, an overflowing `800` above and a neighbour's `500` below, both 4 px off and straddling the tick.
- Result: `300:REJECTED:TEXT_INK`, and the measured chain is `101,500`.

Other plausible sources of the same error: middle lines of 3-line stacks; short-span labels that overflow their span. Speculative: tokens the OCR forms from extension-line strokes between stacked lines (e.g. `11`), since any 2–6 glyph token counts as label ink.

**Fix (contact test):** a crossing stroke has ink in the first window rows (`d = clear+1 … clear+2`) inside the hit run. Label ink printed beside a line leaves a gap (3.5–4 px in blind 7).
- REJECT only when both sides have that gap.
- Otherwise allow at most QUESTIONABLE.
- Add a test case where text overlaps the tick on both sides.

### A3 — P2 — AMBIGUOUS labels still carry `chosen`, and the evidence pack treats it as support
- `axis-topology.ts:375,384`: `chosen` is written from the optimum's arbitrary tie winner whatever the status. The type's own doc says "the candidate bound, when one was". Seen in `exp1`: `900 AMBIGUOUS chosen 1#1`.
- `evidence-pack/src/pack.ts:520` turns it into `supportIds` (and the other candidates into `conflictIds`). Line 551 draws a binding link to it in the SVG.
- The tie winner depends on canonical order, which includes the token text.

**Fix:** set `chosen` only for BOUND. For AMBIGUOUS, record the tied alternatives (slots within `ambiguity`).

### A4 — P2 — end-span "aligned neighbour" support is looser than its doc
`axis-topology.ts:461,475`; `plan-decomposition.ts:813-818`
- (a) `hasMarkNear` accepts any neighbour mark as corroboration: QUESTIONABLE, TEXT_INK-questionable, or REJECTED for other reasons (DUPLICATE, STYLE_MISMATCH). This contradicts "a questionable or label-ink mark ends nothing on its own".
- (b) `alignedEnds` is computed at the measured chain's `ticks[0]` / `ticks[last]`. Segment 0 can start at a different px when the end mark is REJECTED (the solver trims those, `chains.ts:703`). Alignment at one point then keeps a span that ends at another.

**Fix:**
- Require class TICK on the neighbour's mark.
- Store per end the neighbour mark's px and class.
- In `endSpanSupport`, match against `seg.fromPx` / `seg.toPx`.

### A5 — P2 — the side prior is hard-coded to ISO and depends on an orientation that is only a hypothesis
`axis-topology.ts:61,90-112,187`
- `ocr.ts:110-115` says the 90°/270° reading is a hypothesis. Blind 7's second copy was read the other way up by the page vote. Some sheets print numbers below their lines.
- In all these cases the +1 TOP cost is inverted. Full matchings survive (`exp2`, `exp4`), but any slack breaks it. Example: labels-below style with one middle label unreadable (`exp4`) — two correct inner labels become AMBIGUOUS, and one's recorded `chosen` points at the wrong line. With a single label in a free interval, it binds wrong with a margin of about 1.

**Fix:**
- Estimate the side convention per sheet and axis from labels with a single candidate line.
- Apply the side cost only when that convention is established and the chain's orientation is decided. Otherwise treat side as neutral.
- Add corpus cases for a flipped orientation and for labels printed below their lines.

### A6 — P2 — §12 feature set is partial; the legacy record misstates `centred`
`axis-topology.ts:186-187`
- The cost uses only offset, TOP side and (with `preferCentred`) a boolean "uncentred".
- Not used: whether the interval's end marks are TICK or QUESTIONABLE, nesting/neighbour order, contamination, orphaning, chain completeness.
- In the page vote, `centred` is hard-coded `true` and recorded as true for every candidate. That is false data in `assignment.legacy[].candidates`.

**Fix:**
- Always compute `centred` and the midpoint difference; apply the cost only when `preferCentred` is set.
- Add an end-mark-class cost, or state the reduced feature set as an explicit deviation in the stage report.

### A7 — P2 — §15: a building can still be shortened with no signal
`plan-decomposition.ts:783-797,947`

An unread, unlabelled, unaligned end segment shorter than 2 walls is TRIMMED_STUB with `weak:false`. Refutation needs more than 2 walls of overshoot, so it cannot catch this. Example: an unread `25` outer-wall span at the end of a chain with no overall line leaves the frame one wall short.

**Fix:** when the wall witness reaches into a trimmed stub, mark the frame weak or ambiguous instead of trimming it outright.

### A8 — P3 — tie refusal takes out labels as a consequence of A2
Any two labels whose centres fall in one interval at the same print offset are both refused. Examples: a missed tick, a falsely rejected tick, an overflowing short-span label. In `exp1` (parts line missing a tick), `900` and `100` are both AMBIGUOUS. This is correct per §13, but A2 feeds it.

It can also tilt 005B's `SINGLE_READING` (`metric-solution.ts:790`): right-way labels that tie lose their observations while a lone wrong-way fragment keeps its own. Worth a corpus case.

### A9 — P3 — deduplication can depend on input order
`axis-topology.ts:152,294-298`. `tokenKey` omits height, glyphs and readings. When two tokens share a key, the first one in input order survives the stable sort, and it supplies the height (so the cost) and the `readingsOf` result. Include those fields in the key, or choose the survivor by a full canonical serialization.

### A10 — P3 — case (10)'s new expectation is honest but looser
`dimension-topology.test.ts:212-227`. The old assertion encoded the greedy list-order tie-break, so changing it is legitimate. But the new version accepts `WEAK|INCONCLUSIVE` and drops the `relation` check. Pin the actual relation and confidence.

### A11 — P3 — record and documentation gaps
- `labelHeightOf` (`metric-solution.ts:1571`) is the median of all sheet tokens in the height band, not of tokens on chains as its doc says.
- `NO_CANDIDATE` is never emitted, so labels with no candidate line are missing from the record.
- `planExtent` records `endSpans` from `dimensionedAxis(chainsIn)` even when the frame came from another chain set.
- On the bounded path (> 96 labels), every unassigned label is reported AMBIGUOUS (`axis-topology.ts:371`).
- The default corpus margin numerically reproduces blind 7 (1100 = 100+900+100, 24 px apart, 3 px near gap), and every pixel case uses the ISO left-of-line convention. Add the A5 cases.

## Not found
No non-determinism, no unbounded search, no reading values in any cost, no constants from the blind house, and no OCR drift.
