# 005I — mutation results (brief §19)

Each mutation is a temporary patch, applied in a separate worktree of the repository at the code it tests; the
topology suites are run; the tree is restored (`git checkout -- packages`) and checked clean before the next. No
mutation code is in any commit. Run twice: at the implementation commit `c150896` (41 tests) and again at the
post-council code `5b6d14c` (72 tests), the run below. Suites per mutation:

- `packages/source-metrics/test/axis-topology.test.ts` — the §18 corpus with the post-review families (50);
- `packages/reconstruction/test/end-spans.test.ts` — §15 / §16 (12);
- `tests/architecture/dimension-topology.test.ts` — §8 (10).

| # | mutation (what the patch does) | must | at `5b6d14c` | at `c150896` |
| --- | --- | --- | --- | --- |
| M1 | restore greedy nearest-line assignment: every label, nearest offset first, claims its nearest free interval; no exact solve, no side cost, no ambiguity | fail | **FAILED — 21 of 72**: §8 behaviour; §18 (1), (2), (5), (8), (9), (10), (12), (13), (14), (15), (16) ×2 at 1.5 label heights, (17), (18); the record case; §13 not-moved-off; §17 both ties; §43 stress (the greedy binds 460 of 480) | FAILED — 16 of 41 |
| M2 | allow label ink to become ordinary ticks: `markLabelInk` returns the lines unchanged | fail | **FAILED — 10 of 72**: §18 (1) ×3, (2), (12), (14), (16) at 1.5 h, (17), (18); §11 label ink along the line | FAILED — 6 of 41 |
| M3 | restore short-end-span trimming: `endSpanSupport` returns null | fail | **FAILED — 2 of 72**: §15 labelled end segment; §15 aligned neighbour end | FAILED — 2 of 41 |
| M4 | candidate enumeration order as tie breaker: no canonical order of labels or lines, ambiguity margin 0 | fail | **FAILED — 4 of 72**: §17 both ties; the record cases (a refused label names no line; the same token kept whichever comes first) | FAILED — 2 of 41 |
| M5 | the published area chooses the binding: `labelCandidates` takes a `publishedFootprintM2` and adds \|label/100 − √area\| to a candidate's cost | architecture test must fail | **FAILED — 2 of 72 (architecture)**: §8 no topology code names a published figure…; §8 a candidate's cost is geometry | FAILED — 2 of 41 |

Notes.

- The post-council suites add mutation coverage the first run lacked: M2 is now also caught by a unit case at the
  `markLabelInk` level, M4 by the canonical-dedupe case, M1 by the other-convention and right-hand-margin cases.
- Three further rules were mutation-checked one at a time when they were written (each removal fails its case):
  the contact test (§11 "a stroke reaching the line between two labels"), the label-ink axis rule (§11 "label ink is
  text along the line") and the numeral rule (§11 "text read across a line is not its label ink").
- Logs and JSON reports: outside the repository (`work005i-a/mutations/final-M*.{log,json}`), summarised here.
