# 005F post-implementation review B: bounded OCR search and performance

Reviewer B. Read-only. Code reviewed at HEAD `a991e6b`. That commit is `d910212` plus one CI-only commit
(`.github/workflows/buildapp-ci.yml`, `packages/analysis-service/scripts/dev-row.mjs`), so every source file under review is
identical to `d910212`. I added nothing to the worktree.

**Uncommitted edit in the worktree.** At 12:07, `git status` showed `M packages/reconstruction/src/boundary-completion.ts`
(+96 −29). I did not make this edit and did not touch it. It begins "C4 (005F post-review C5F-2): the part is what one
reaches from the house". The worktree was clean when I ran the boundary probes (B5F-1, B5F-2, B5F-9, B5F-10), so they
ran against the committed `a991e6b`. Re-run `parts-cap.ts`, `orient.ts` and `two-bays.ts` on the fixed code before
closing B5F-1, B5F-2 and B5F-10.

The probes are in `/home/user/BuildApp/.cache/review-B/f5/` (gitignored, numbers only; no publisher bytes are copied).
Their outputs are in `/home/user/work005f/post/scratch-B/`. To rerun a probe from the repo root:
`npx vite-node .cache/review-B/f5/<probe>.ts [-- args]`.

Run conditions. While I worked, the m-c matrix used 3 cores and the other reviewers ran their own probes, with a load
average of 5 to 8 on 4 cores. I ran no whole house. Every probe I ran was a single test file, a single label or a single
plan. All timings below were taken under that load: compare them against each other, not against an absolute budget.

## Verdict

The 005F search is bounded. Every new loop has a finite bound:

- glyph-count hypotheses, segmentations, cells, beam, tail and style in the lattice;
- extent conflicts, stretches, parts and the clip in the boundary.

Time and memory per development row are flat, within the load noise. Telemetry stays PASS on the m-final rows: the
largest tick gap is 4.1 s, against the 5 s budget from 005A. The run is deterministic: 707 development labels re-read in
a separate process are byte-identical to the m-c records, and the decompositions hash the same twice and across
processes.

The claim "every cap is enforced **and recorded**" is false:

- A boundary cap silently decides a result and writes a false record (B5F-1).
- One new acceptance guard depends on which way the plan is drawn (B5F-2, outside my scope but verified).
- The documented OCR caps are partly unrecorded, partly unreachable and partly not hard (B5F-3 to B5F-6).

| Severity | Count | IDs |
|---|---|---|
| P0 | 0 | none |
| P1 | 2 | B5F-1, B5F-2 |
| P2 | 9 | B5F-3 to B5F-11 |

## Findings

### B5F-1 (P1): the part cap is spent on wall slivers in scan order; a real attached room is dropped without a record, and the conflict record says nothing reached it

**Where.** `packages/reconstruction/src/boundary-completion.ts`:

- `:285` is the cap: `if (parts.length >= B.maxParts) return`.
- `:520–522` feeds the components to it in row-major order, ATTACHED_ROOM components first and then BOX_COMPLETION.
- `:531` writes the ZONE `why`.

`CompletionResult` (`:120`) and `BoundaryRecord` have no field that counts parts left unjudged.

**What is wrong.** Every enclosed component counts against the 16-part cap, including the cheap rejections (WALL_SLIVER,
SEPARATE), and the scan order decides which components are judged. Once the cap is hit:

- a genuine attached room or a box completion later in the scan is never judged;
- its STRONG conflict stays `ZONE`, whose `why` reads "nothing enclosed reaches the E side … a terrace, a canopy or
  ground", which is false;
- nothing records the truncation;
- the result depends on which way up the plan is drawn. The garage tests were written to forbid exactly this.

**Development exposure.** On dom-w-dabecjach one plan judges 14 parts, and all 14 are rejected. Across the matrix, 55 of
the 63 judged parts are WALL_SLIVER (42) or SEPARATE (13). The cap is two parts away on a development house.

**Reproduction.** `.cache/review-B/f5/parts-cap.ts`. The fixture is the §29 bay: FACE_LINE junction, glazed. It sits on a
920 × 280 px house with N small closed closets on the north face.

| Closets | Parts judged | Bay | E conflict |
|---|---|---|---|
| 0 to 15 | n + 1 | `ATTACHED_ROOM ACCEPTED`, built | `ACCEPTED` |
| 16, 17, 18 | 16, all WALL_SLIVER | NOT JUDGED, not built | `ZONE`: "nothing enclosed reaches the E side …" |
| 16, 18, plan drawn upside down | 16 | judged and **built** | not measured |

**Smallest generic fix.**

1. Count only parts that pass the clip and share an edge with the house against `maxParts`. WALL_SLIVER and SEPARATE
   cost one clip and need no cap, or should have their own larger cap.
2. Alternatively, order the components by an orientation-free key, for example area descending and then the rectangle,
   before applying the cap.
3. Record `partsNotJudged` in the completion result and in the boundary record.
4. A STRONG conflict whose span held an unjudged part is `INCONCLUSIVE`, with "N parts not judged: cap", and never
   `ZONE`.

### B5F-2 (P1, outside my scope, for C and D): the glazing room evidence counts only the east and south outer walls, so a mirrored attached room is rejected

**Where.** `boundary-completion.ts:381–384`:

```ts
g.axis === 'X'
  ? g.linePx > rect.x0 + 0.5 * W && g.linePx <= rect.x1 + 0.5 * W && …
  : g.linePx > rect.y0 + 0.5 * W && g.linePx <= rect.y1 + 0.5 * W && …
```

The window is half-open and shifted by half a wall. It excludes the line at `x0`/`y0` and includes the line at
`x1`/`y1`.

- **E or S part:** the junction (house) line is excluded and the outer glazing is included, which is correct.
- **W or N part:** the outer glazing is excluded. By the same window the house's own junction wall is included. I read
  that from the code; I could not build a fixture where it changes a decision, because 005C adopts my W store first.

**Reproduction.** `.cache/review-B/f5/orient.ts` draws the exact `extent-envelope.test.ts` §29 bay four ways: as drawn,
mirrored, transposed, and transposed and mirrored.

| Fixture | E | W | S | N |
|---|---|---|---|---|
| FACE_LINE / GLAZED | ACCEPTED, glazing 1 | REJECTED `NO_ROOM_EVIDENCE`, glazing 0 | ACCEPTED, glazing 1 | REJECTED `NO_ROOM_EVIDENCE`, glazing 0 |
| DOOR / GLAZED | ACCEPTED, glazing 1 | REJECTED `NO_ROOM_EVIDENCE`, glazing 0 | ACCEPTED, glazing 1 | REJECTED `NO_ROOM_EVIDENCE`, glazing 0 |

The only attached room accepted on the development matrix is Morelach's E bay (glazing 1, 3.46 m²). A mirrored Morelach
would lose it. `extent-envelope.test.ts` tests attached rooms on the E side only. It flips only the garage.

**Smallest generic fix.**

- Take room-evidence glazing from the part's own non-house perimeter gaps. `sideGaps` (`:374`) already excludes the
  junction edges.
- Alternatively, use a symmetric window `[x0 − ½W, x1 + ½W]` and exclude lines whose edge is shared with the house.
- Add mirrored and transposed variants of the §29 fixtures, as the garage test does with `flip`.

### B5F-3 (P2): the "hard cap" of 96 scored cells per ink is not hard, and about a third of the cell scoring is not counted

**Where.** `numeric-lattice.ts`:

- `:942–955` gives ANCHOR hypotheses an exemption from both per-ink checks, and does not reserve their cells. DEFAULT's
  re-cuts and count alternatives can use up the 96 before the STRICT and SAUVOLA anchors are scored.
- The stability bracket (`:1043–1053`, then `anchorReading` at `:1273–1291`) scores up to 2 factors × 2 variants × 7
  cells with `glyphOf` and never adds them to `cellsScored`. `anchorReading` also runs the full `countHypotheses`
  (`splitRun` per run and direction) to keep only `hyps[0]`.

The contract says otherwise: "Scored cells per ink ≤ 96 (hard cap; A measured a maximum of 42)"
(`implementation-contract.md:70`). So does `docs/METRIC_EVIDENCE.md:291–293`. The gate already allows more:
`adaptive-glyph-count.test.ts:234` asserts `≤ cellsPerInk + 3·7`.

**Measured.**

- **m-final development rows.** 4186 lattices:
  - 239 exceed the contract's measured maximum of 42;
  - 30 reach 90 or more;
  - 7 exceed 96 (max 102: willa-miranda; 101: dabecjach `1565.`; 100: alt-marcowki `1153`/`5511`, marcowki, g2e).
- **Instrumented copy.** `.cache/review-B/f5/nl-instr.ts`, run by `instr-probe.ts` over alt-marcowki, marcowki and
  Morelach (707 labels). Its output is byte-identical to the package's.
  - True cell scorings total 21 760, against 13 662 in the telemetry (+59 %).
  - The maximum per label is 118.

**Fix.**

- Score or reserve every variant's anchor first, then spend `96 − Σ anchors` on hypotheses.
- Add `bracketCellsScored` to the telemetry.
- Give `anchorReading` an anchor-only path so it skips the alternative splits.
- State the real bound in `COUNT_BOUNDS` and in the docs: 96 + 2·7 + 28 scorings, measured maximum 118.

### B5F-4 (P2): the per-count cap truncates silently, and the per-variant and per-ink caps can never bind; the docs say "the caps are recorded"

**Per count.** `splitRun` returns early at 16 (`numeric-lattice.ts:644`) without counting. Measured with the
instrumented copy on 707 labels:

- the cap was hit in 30 of 538 `splitRun` calls;
- 594 distinct valid segmentations were dropped;
- on 3 labels the cap was hit while `segmentation.truncated === 0`.

**Per variant (48) and per ink (144).** These caps cannot bind:

- per variant: at most 16 base hypotheses, plus at most 2 chosen alternatives × 16 = 48. With a moved counter cut the
  extra old anchor is always pruned.
- per ink: 3 × 48 = 144.

If the per-variant `.slice(0, 48)` ever cut anything (`:751–752`), the loss would be booked as `counterCutsPruned`
(`:761`: `before − hyps.length`), not as truncation.

**Count texts.** The count-text cap (`countTexts: 2`, `:1025–1027`) is also skipped silently.

**Fix.**

- Add counters `truncatedPerCount`, `truncatedCells` and `countTextsDropped` to `segmentation`.
- Book `counterPruned` from the filter alone.
- Delete the two caps that can never bind, or document them as derived bounds.
- Correct `METRIC_EVIDENCE.md:291–293`.

### B5F-5 (P2): truncation by the cell budget starves count alternatives first, and the record still says they were kept

**Order.** Per variant the hypotheses run in this order: anchor, then 005E re-cuts, then count alternatives
(`:732–733`). The variants run DEFAULT, then STRICT, then SAUVOLA. So the 96-cell budget drops count alternatives first.
On 707 labels it truncated 82 count-alternative hypotheses and 60 re-cuts.

**Starved labels.** On 4 labels, alt-marcowki and marcowki `1153` (alternatives 5 and 7) and `5511` (alternative 5), no
segmentation of a listed alternative count was ever scored. The labels still carry:

- `countAmbiguity.alternatives`;
- `segmentation.counts[].alternatives`;
- a `GLYPH_COUNT_HYPOTHESES` event reading "other counts kept as hypotheses: 5, 7".

All 4 labels are LOW_QUALITY, so no development decision moved.

**Fix.**

- Record an alternative only when at least one of its paths was scored, or add `alternativesScored`.
- Reserve at least one scored segmentation per chosen alternative before the re-cuts after the first k.

### B5F-6 (P2): the tail cap is enforced but never recorded

`TAIL_BOUNDS.perInk = 2` (`:1212`) is silent.

**Measured on 707 labels.**

| Quantity | Value |
|---|---|
| Distinct eligible tail values | 2073 |
| Tail values kept | 597 |
| Labels that hit the cap of 2 | 251 (35 %) |

The tail itself is bounded:

- its pool is the frontiers of at most 3 anchors, at most 16 partials each;
- it is never read by a decision: `rg '\.tail\b' packages/*/src` finds only `extract.ts:1042` and `pack.ts:341`.

**Fix.** Add `tailTruncated: n` beside `tail` in the record and in `07-ocr-labels.json`.

### B5F-7 (P2): `dimensionStyleOf` is an untickled loop over every raw token, and its time is booked to the CHAINS subphase

**Where.** `extract.ts:990` computes the style before the first `onLabel` tick at `:992`. The loop is in
`numeric-lattice.ts:489–510`.

**Measured.**

| Source | Time | Raw tokens | Rate |
|---|---|---|---|
| Development plans, per plan | 22–150 ms | 97–225 | |
| Marcówki, 8 frames | 664 ms | 1264 | |
| 300-label synthetic page | 501 ms | 840 | 0.6 ms per raw token, linear |

**Effect on the CHAINS subphase.** The chain code is unchanged (`git diff 9b619ec..HEAD -- chains.ts dimension-lines.ts
ocr.ts` is empty). On rows where the load control is flat, CHAINS still grew from 005E to 005F: Morelach 1468 → 2881 ms,
modrzewnicy 1315 → 2326 ms, Marcówki 1351 → 2477 ms. The style computation is booked there.

**Effect on the heartbeat.** Silence is bounded by the 5 s budget only up to about 8000 raw tokens.

**Fix.**

- Tick inside `dimensionStyleOf` (an `onToken` callback, subphase `OCR_STYLE`).
- Alternatively, compute it lazily per cap bucket inside the label loop.

### B5F-8 (P2): `styleFor` is O(labels × samples · log samples)

`numeric-lattice.ts:513–517` filters and sorts every sample for every label. On synthetic pages:

| Page | Labels | Samples | `styleFor` total |
|---|---|---|---|
| 100 printed labels | 313 | 231 | 10.8 ms |
| 300 printed labels | 792 | 578 | 84 ms |

That is about 8× for 2.5× the labels. It is harmless today.

**Fix.** Sort the samples by cap once, take each label's window by binary search, and memoise per distinct cap.

### B5F-9 (P2): `completeBoundary` has super-linear pieces and no tick

**Where.**

- `nearCore` (`boundary-completion.ts:340–350`) is O(part cells × core cells).
- The vehicle-door depth fixpoint (`:403–427`) is O(doors × passes × grid cells), where passes is about the number of
  rows.
- The clip pass covers each part's bounding rectangle, for up to 16 parts.

**Measured with `complete-micro.ts`.** One part covers half the grid, every other cell is wall ink, and there are 12
vehicle-like gaps.

| Grid cells | Time |
|---|---|
| 1 600 | 64 ms |
| 6 400 | 80 ms |
| 14 400 | 212 ms |
| 25 600 | 510 ms |
| 40 000 | 0.9–1.3 s |

**End to end with `boundary-scale.ts`.** The synthetic plans have 4 STRONG conflicts, a partition grid and 4 bays.
`decomposePlan` with the extent rule on, minus with it off:

| Plan size | Δ on − off |
|---|---|
| 400 px | 32 ms |
| 800 px | 79 ms |
| 1200 px | 211 ms |
| 1600 px | 178 ms |
| 2000 px | 284 ms |

That is about linear in cells. Development grids are up to about 43 × 41 cells, so the cost is tens of milliseconds.
The development BOUNDARY subphase is unchanged within noise.

**Fix.**

- Compute `nearCore` by dilating the core mask by one wall in grid space.
- Compute the depth by one sweep each way instead of a fixpoint.
- Alternatively, cap the cells per part and record the cap.

### B5F-10 (P2, for C and D): stretches are truncated silently; the contract's "2 components per stretch" cap and its AMBIGUOUS decision do not exist

**Stretches.** `.slice(0, B.stretchesPerSide)` at `:260` is silent.

**Components.** The contract says:

- "Caps. 4 conflicts × 2 stretches × 2 components" (`implementation-contract.md:148`);
- a per-stretch AMBIGUOUS decision (`:181`).

The code has neither. `ExtentConflict.decision` is `'ACCEPTED' | 'ZONE' | 'INCONCLUSIVE' | 'RECORDED'` (`:116`), and
nothing counts the components per stretch.

**Reproduction.** `.cache/review-B/f5/two-bays.ts` puts two passing glazed bays in one STRONG E stretch. Both are
`ACCEPTED` and both are built.

**Fix.** Record `stretchesDropped`. Then either implement the per-stretch cap and AMBIGUOUS, or amend the contract.
Which one is right is for C and D to decide.

### B5F-11 (P2, process): the m-c performance numbers are contaminated by load and must not go into the freeze record

**Measured.** The m-c rows finished around 11:59 ran 2.2–2.3× slower than m-final. The unchanged CALLOUT_RINGS subphase
slowed by the same factor (2.21–2.34) in every case.

| Row | Total C/F | CALLOUT_RINGS C/F |
|---|---|---|
| jablonkach | 2.22 | 2.34 |
| zurawkach | 2.27 | 2.21 |
| willa-miranda | 2.23 | 2.26 |

Two of these rows break the 5 s tick-gap budget: 5958 ms and 6496 ms, with a telemetry gap of 7193 ms. The cause is the
machine (a load average of 6 to 8 on 4 cores, including the review probes), not the code. `segmentation` records are
byte-identical between m-final and m-c on all 8 m-c rows that carry lattices (2163 labels).

**Fix.** Take the performance figures for the freeze from m-final with the control ratio, or rerun those rows two at a
time.

## Caps: enforced and recorded

| Cap | Where | Enforced | Hit on development rows | Recorded |
|---|---|---|---|---|
| `segmentationsPerCount` 16 | `numeric-lattice.ts:644` | yes | 30 of 538 calls, 594 candidates dropped | **no** (B5F-4) |
| `segmentationsPerVariant` 48 | `:752` | can never bind | never | would be booked as counter-pruned |
| `segmentationsPerInk` 144 | `:944` | can never bind (3 × 48) | never | `truncated` |
| `cellsPerInk` 96 | `:952` | not for anchors; bracket not counted | 7 labels > 96, true maximum 118 | number of hypotheses only (B5F-3) |
| `countTexts` 2 | `:1026` | yes | not measured | **no** |
| `TAIL_BOUNDS.perInk` 2 | `:1212` | yes | 251 of 707 labels | **no** (B5F-6) |
| beam 16, floor, sequences 8 | 005E | yes | not measured | `truncatedBy` |
| conflicts 4 | `extentSidesOf`, at most one per side | by construction | not measured | not needed |
| `stretchesPerSide` 2 | `boundary-completion.ts:260` | yes | unknown (not recorded) | **no** (B5F-10) |
| components per stretch 2 | contract B1 | **not implemented** | not applicable | not applicable |
| `maxParts` 16 | `:285` | yes | 14 per plan (dabecjach) | **no**, and the conflict `why` is wrong (B5F-1) |
| `partShare` 0.5 | `:487` | yes | not measured | as the `QUESTION` decision |

## Workstream A: the numeric reader per development row

Source: `/home/user/work005f/m-final/<row>/metric-evidence.json` and `performance.json` at `e6fe6bc`. The `segmentation`
records are identical at `d910212` (see B5F-11). The 005E values come from `/home/user/work005e/m3` and, for
modrzewnicy and Morelach, from `/home/user/work005f/base`. The legacy lanes have no lattices.

| row | labels | count-hyp labels (alts / decisive / widthAmb) | count hyps | segmentations Σ / max | cells Σ / max | truncated Σ (labels) | counter moved / pruned | expansions Σ 005E→005F (max) | tail values (labels) | cache hits | OCR_LATTICE ms 005E→005F | CHAINS ms 005E→005F |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| alt-marcowki | 135 | 49 / 12 / 33 | 105 | 1633 / 63 | 3030 / 100 | 71 (2) | 36 / 576 | 11225 → 9940 (265) | 131 (69) | 0 | 1925 → 2362 | 520 → 865 |
| aster-viii | 22 | 2 / 5 / 2 | 4 | 238 / 40 | 493 / 68 | 0 (0) | 0 / 71 | 2961 → 3031 (414) | 16 (8) | 0 | 607 → 559 | 536 → 586 |
| dom-w-azaliach | 277 | 24 / 12 / 15 | 40 | 2586 / 57 | 5405 / 96 | 52 (4) | 31 / 1061 | 28145 → 25608 (529) | 210 (110) | 0 | 6219 → 9340 | 1747 → 3784 |
| dom-w-dabecjach | 310 | 30 / 19 / 17 | 50 | 3349 / 52 | 6602 / 101 | 46 (2) | 44 / 1307 | 32244 → 29088 (535) | 240 (130) | 0 | 6395 → 10298 | 1409 → 3179 |
| dom-w-jablonkach | 304 | 42 / 12 / 34 | 86 | 2886 / 55 | 5840 / 81 | 0 (0) | 58 / 1307 | 26500 → 23912 (467) | 240 (126) | 0 | 7608 → 10523 | 1719 → 2880 |
| dom-w-modrzewnicy | 272 | 24 / 21 / 11 | 32 | 2533 / 57 | 5316 / 96 | 20 (2) | 34 / 427 | 21309 → 21531 (522) | 165 (88) | 0 | 5281 → 6837 | 1315 → 2326 |
| dom-w-modrzykach | 243 | 43 / 11 / 27 | 72 | 2320 / 48 | 4590 / 75 | 0 (0) | 52 / 1125 | 23446 → 20814 (729) | 175 (95) | 0 | 3587 → 4072 | 1073 → 1797 |
| dom-w-morelach | 272 | 3 / 8 / 1 | 5 | 2367 / 48 | 4893 / 74 | 0 (0) | 44 / 904 | 25630 → 23328 (507) | 216 (115) | 0 | 6230 → 8313 | 1468 → 2881 |
| dom-w-tunbergiach | 258 | 20 / 9 / 13 | 33 | 2571 / 61 | 5267 / 96 | 29 (4) | 18 / 728 | 24269 → 23237 (494) | 190 (102) | 0 | 5278 → 8125 | 1639 → 3365 |
| dom-w-zurawkach | 291 | 27 / 15 / 8 | 40 | 3076 / 60 | 5913 / 96 | 4 (1) | 55 / 897 | 29899 → 27771 (710) | 197 (107) | 0 | 4723 → 5638 | 1518 → 2908 |
| galaktyka | 71 | 1 / 9 / 1 | 2 | 394 / 25 | 942 / 50 | 0 (0) | 0 / 205 | 5259 → 5175 (512) | 28 (15) | 0 | 1241 → 1595 | 1221 → 2453 |
| kosacce-clean | 335 | 6 / 28 / 3 | 7 | 2221 / 53 | 5215 / 88 | 0 (0) | 51 / 1909 | 34650 → 27554 (497) | 241 (128) | 0 | 7488 → 9194 | 1435 → 2254 |
| kosacce-tracked | 335 | 6 / 28 / 3 | 7 | 2221 / 53 | 5215 / 88 | 0 (0) | 51 / 1909 | 34650 → 27554 (497) | 241 (128) | 0 | 6546 → 9010 | 1014 → 2112 |
| marcowki | 300 | 39 / 11 / 21 | 74 | 2892 / 63 | 5739 / 100 | 71 (2) | 57 / 950 | 24466 → 21868 (509) | 250 (131) | 0 | 4927 → 5348 | 1351 → 2477 |
| rarytasy-eoze | 296 | 20 / 17 / 13 | 33 | 2957 / 69 | 5983 / 96 | 54 (5) | 34 / 799 | 29187 → 27081 (512) | 178 (94) | 0 | 4522 → 5081 | 1233 → 2187 |
| rarytasy-g2e | 218 | 9 / 11 / 6 | 15 | 1924 / 59 | 3986 / 100 | 37 (1) | 32 / 813 | 21493 → 19509 (518) | 209 (113) | 0 | 5656 → 6122 | 1446 → 1886 |
| willa-miranda | 247 | 35 / 8 / 24 | 63 | 2720 / 68 | 5318 / 102 | 77 (3) | 41 / 1109 | 25280 → 23045 (447) | 172 (92) | 0 | 3853 → 4418 | 1265 → 2539 |

**Reading the table.**

- **Load.** The OCR_LATTICE growth (−8 % to +61 %) is mixed with load. Normalised by the unchanged OCR subphase it is
  ×0.97 to ×1.47.
- **Per label.**
  - Plan-level probe (`plan-probe.ts`) on alt-marcowki and Marcówki, 435 labels: median 11.5–13 ms, p95 28–31 ms,
    max 140 ms.
  - Per house, the lattice costs −0.05 to +3.9 s, and the style work in CHAINS another +0.05 to +2.0 s (B5F-7).
- **Expansions.** Beam expansions went down on most rows, because counter pruning removes re-cuts.
- **Cache.** The lattice cache never hits, as in 005E.

**Corpora** (`corpus-time.ts`; `.cache/f5/corpus.ts` with `OUT=scratch-B` took 68 s wall for 480 labels, rendering
included).

| Seed | Lattice ms (median / p95 / max) | `readNumbers` ms (median) | Max segmentations | Max cells | Truncated labels | Max expansions |
|---|---|---|---|---|---|---|
| 5001 | 14.9 / 33.4 / 98 | 5.3 | 81 | 96 | 2 | 391 |
| 9017 | 13.7 / 31.6 / 51 | 5.1 | 66 | 96 | 2 | 484 |

**Worst cases.**

- **Labels of 6 or 7 touching glyphs** (`worst-label.ts`): `888888`, `0000000`, `1111111`, `2590259`, `1234567`,
  `9696969` and `4444444`, at caps 14, 24 and 40 px, condensed 0.5–0.7 and touching, each with no style and with a
  style at 0.42 and at 0.62.
  - The reader cuts them into 3 to 5 glyphs, and the count rule moves only ±1.
  - Lattice at most 128 ms. At most 74 segmentations and 101 cells (the anchor overrun of B5F-3), at most 36
    hypotheses truncated, at most 737 expansions, at most 8 sequences, at most 2 tail values.
  - Deterministic on a repeated run.
- **Pages of printed labels** (`page300.ts`): growth is linear except for `styleFor` (B5F-8).

| Printed labels | Page | Latticed tokens | `readNumbers` | style | Lattice per label | RSS |
|---|---|---|---|---|---|---|
| 100 | 830 × 720 | 313 | 0.8 s | 218 ms | 21.3 ms | 222 MB |
| 300 | 1270 × 1292 | 792 | 1.9 s | 501 ms | 21.5 ms | 268 MB |

## Workstream B: the boundary per development row

Source: `m-final/<row>/plan-diagnostics/digest.json` and `performance.json`. Boundary time is the sum of the BOUNDARY and
BOUNDARY_GAPS subphases.

| row | plans | conflicts (side:strength:decision) | stretches | parts judged | reasons | accepted | clipped (m² before→after) | max parts / plan | boundary ms REGISTER / RESOLUTION |
|---|---|---|---|---|---|---|---|---|---|
| alt-marcowki | 2 | none | 0 | 4 | WALL_SLIVER 2, NO_STRONG_EXTENT 1, SEPARATE 1 | none | 0.13→0, 0.46→0.07, 0.34→0 | 4 | 140 / 141 |
| aster-viii | 1 | none | 0 | 0 | none | none | none | 0 | 0 / 0 |
| dom-w-azaliach | 2 | none | 0 | 1 | SEPARATE 1 | none | none | 1 | 90 / 221 |
| dom-w-dabecjach | 2 | W:S:INCONCLUSIVE, N:S:ZONE, S:S:INCONCLUSIVE | 3 | 14 | SEPARATE 8, WALL_SLIVER 4, NO_STRONG_EXTENT 1, NO_WAY_IN 1 | none | 6 clipped (2.71→2.08 …) | **14** | 1148 / 1319 |
| dom-w-jablonkach | 2 | N:S:RECORDED | 1 | 5 | WALL_SLIVER 5 | none | 5 clipped to 0 | 5 | 956 / 113 |
| dom-w-modrzewnicy | 2 | none | 0 | 0 | none | none | none | 0 | 0 / 0 |
| dom-w-modrzykach | 1 | S:S:INCONCLUSIVE | 2 | 8 | WALL_SLIVER 8 | none | 8 clipped to 0 | 8 | 952 / 0 |
| dom-w-morelach | 2 | E:S:ACCEPTED | 1 | 2 | ATTACHED_ROOM 1, CONTINUATION 1 | ATTACHED_ROOM/E 3.46 m², BOX_COMPLETION 5.93 m² | 4.20→3.46 | 2 | 287 / 448 |
| dom-w-tunbergiach | 3 | none | 0 | 0 | none | none | none | 0 | 81 / 50 |
| dom-w-zurawkach | 3 | S:S:INCONCLUSIVE | 1 | 2 | WALL_SLIVER 1, SEPARATE 1 | none | 0.71→0 | 2 | 273 / 0 |
| eoze-legacy (area / every) | 1 | none | 0 | 3 | WALL_SLIVER 3 | none | 3 clipped to 0 | 3 | not applicable |
| galaktyka | 2 | none | 0 | 0 | none | none | none | 0 | 0 / 0 |
| kosacce-clean / kosacce-tracked | 1 | none | 0 | 2 | WALL_SLIVER 2 | none | 0.53→0, 0.52→0 | 2 | 1078 / 0 and 995 / 0 |
| marcowki | 2 | none | 0 | 3 | WALL_SLIVER 2, NO_CONTINUATION 1 | none | 0.96→0, 0.94→0 | 2 | 817 / 0 |
| rarytasy-eoze | 1 | none | 0 | 0 | none | none | none | 0 | 717 / 0 |
| rarytasy-g2e | 1 | S:S:ZONE | 2 | 2 | NO_STRONG_EXTENT 1, NO_CONTINUATION 1 | none | none | 2 | 1063 / 407 |
| willa-miranda | 2 | N:S:INCONCLUSIVE, S:S:ZONE, S:S:INCONCLUSIVE | 5 | 12 | WALL_SLIVER 10, SEPARATE 2 | none | 11 clipped (7.84→0 …) | 6 | 1134 / 485 |

The BOUNDARY subphase is unchanged within noise from 005E to 005F (for example dabecjach 653 → 812 ms and Marcówki
228 → 136 ms). Synthetic scaling is in B5F-9.

## Wall clock, peak RSS and telemetry

005E values come from `analyzer-005e/development-matrix.json`, or the committed blind runs for the two round-5 houses.
005F values come from `/home/user/work005f/development-matrix.json` (m-final), with m-c in parentheses. "Control" is the
ratio of the unchanged CALLOUT_RINGS subphase, F over E.

| row | wall s 005E → 005F (m-c) | peak RSS MB 005E → 005F (m-c) | max tick gap ms | max telemetry gap ms | pack ms | control |
|---|---|---|---|---|---|---|
| dom-w-modrzewnicy | 227.4 → 233.6 (225.1) | 745 → 749 (770) | 3989 → 3608 | 4125 → 3608 | not recorded → 177 | 0.99 |
| dom-w-morelach | 185.8 → 193.5 (188.2) | 785 → 796 (811) | 2003 → 1723 | 2511 → 2256 | not recorded → 567 | 1.00 |
| marcowki | 215.7 → 219.8 (214.1) | 868 → 865 (843) | 2346 → 2205 | 2346 → 3103 | 277 → 272 | 1.00 |
| rarytasy-g2e | 219.4 → 217.6 (265.3) | 844 → 866 (886) | 1618 → 1579 | 2140 → 2217 | 280 → 280 | 0.96 |
| kosacce-clean | 209.2 → 206.6 (251.9) | 800 → 853 (855) | 1862 → 1793 | 2393 → 2178 | 365 → 358 | 0.96 |
| kosacce-tracked | 172.1 → 205.5 (254.5) | 868 → 854 (813) | 1631 → 1718 | 2022 → 2161 | 344 → 393 | 1.20 |
| rarytasy-eoze | 175.2 → 198.2 (208.7) | 926 → 915 (894) | 2685 → 2963 | 3221 → 3495 | 276 → 332 | 1.12 |
| alt-marcowki | 73.4 → 86.8 (90.1) | 678 → 684 (679) | 1842 → 2220 | 2253 → 2643 | 125 → 229 | 1.14 |
| dom-w-jablonkach | 235.2 → 292.5 (638.3*) | 834 → 825 (806) | 1379 → 1924 | 1965 → 2363 | 298 → 352 | 1.28 |
| willa-miranda | 230.5 → 282.8 (618.6*) | 826 → 805 (786) | 1747 → 2113 | 2580 → 3092 | 277 → 328 | 1.25 |
| dom-w-zurawkach | 223.9 → 276.4 (616.5*) | 802 → 840 (778) | 1762 → 1961 | 2527 → 2567 | 282 → 368 | 1.25 |
| dom-w-modrzykach | 149.3 → 182.3 | 704 → 718 | 1180 → 1474 | 1805 → 1821 | 288 → 494 | 1.23 |
| dom-w-azaliach | 177.5 → 218.3 | 723 → 763 | 1622 → 1793 | 1824 → 2399 | 179 → 240 | 1.22 |
| dom-w-dabecjach | 199.0 → 255.7 | 761 → 766 | 1149 → 1366 | 1862 → 1949 | 252 → 300 | 1.28 |
| dom-w-tunbergiach | 188.2 → 226.1 | 823 → 820 | 1689 → 2039 | 2073 → 2535 | 243 → 307 | 1.19 |
| aster-viii | 34.8 → 42.4 | 717 → 713 | 2321 → 2786 | 2684 → 3295 | 80 → 111 | 1.22 |
| galaktyka | 85.9 → 108.6 | 807 → 825 | 3228 → 4096 | 3794 → 4703 | 92 → 106 | 1.25 |

\* Contaminated by load (B5F-11).

**Wall clock.** The control ratio follows the total ratio row by row: the growth from 005E to 005F is mostly machine
load. On the rows with a flat control (modrzewnicy, Morelach, Marcówki, kosacce-clean, g2e) the total changed by −1.4 %
to +1.3 %.

**Memory.** RSS stays within −21 / +53 MB. The maximum is 915 MB, against 926 MB in 005E.

**Telemetry.** The largest tick gaps sit in phases whose code did not change (OBSERVE_ASSETS, CALLOUT_SEARCH). The
m-final maximum is 4.1 s (galaktyka OBSERVE_ASSETS), which passes the 5 s budget.

**Evidence Pack.** It took 106–567 ms per row and grew 0–10 % in size (Morelach 1340 → 1480 KB). Its new events are
bounded by the caps above.

## Determinism

- **Labels, against the run records.** I re-read 707 development labels in a separate process at HEAD: alt-marcowki,
  Marcówki and Morelach from the m-c runs.
  - Compared with canonical key order, every field the record carries (class and `why` included, `paths` reduced) is
    byte-identical to the m-c records.
  - alt-marcowki's 135 labels are also identical to m-final, class excepted (0.4 against 0.35).
  - The same call made twice in one process gives identical JSON.
- **Labels, across commits.** `segmentation` records are identical between m-final (`e6fe6bc`) and m-c (`d910212`) on
  2163 labels.
- **Decompositions** (`determinism.ts`). I hashed:
  - 12 bay fixtures with their boundary records;
  - the garage, both ways up;
  - the lattices of a condensed `2590` page.

  The digest `792c47e844d0d161` was identical twice in one process and across two processes.
- **Order.** Map and Set iteration never reaches an output unsorted. Count alternatives, decisive variants, the tail
  (sorted by `logP` then text) and `stableRegions` (by area, then id) are all sorted. `sideGaps` follows its
  deterministic insertion order. Records are rounded with `round6`.

## Not verified

- **Whole-house runs.** None: the CPU budget did not allow one, and B5F-11 says why the m-c numbers are unusable.
- **Phone engine.** Behaviour of `Math.log`/`Math.exp` in the last ULP on a non-V8 engine at threshold ties.
- **Junction glazing on W or N.** That a junction window on a W or N part can turn a rejection into an acceptance
  (B5F-2). I found it by reading the code; my fixture was adopted by 005C before it reached the rule.
- **Two caps.** Whether `stretchesPerSide` ever binds on a development plan, and how often the 005E
  `segmentationHypotheses` cap of 16 binds. Neither is recorded.
