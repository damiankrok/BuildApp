# 005I — mutation results (brief §19)

Each mutation was applied as a temporary patch to the working tree at `c150896` (the implementation commit), the three
topology suites were run, and the tree was restored (`git checkout`) and checked clean before the next one. No mutation
code is in any commit. Suites run per mutation (41 tests):

- `packages/source-metrics/test/axis-topology.test.ts` — the §18 corpus (25);
- `packages/reconstruction/test/end-spans.test.ts` — §15 / §16 (9);
- `tests/architecture/dimension-topology.test.ts` — §8 (7).

| # | mutation (what the patch did) | must | result | tests that caught it |
| --- | --- | --- | --- | --- |
| M1 | restore greedy nearest-line assignment: every label, nearest offset first, claims its nearest free interval (the pre-005I order); no exact solve, no side cost, no ambiguity | fail | **FAILED — 16 of 41** | §18 (1) the middle part bound to its own line; (1) the overall read over its whole span; (2) midway label; (5) different centres; (8) missing tick; (9) spurious mark; (10) short terminal span; (12) three lines; (13) contradictory arithmetic; (14) right-hand margin; (15) top margin; §13 a label not displaced by a worse one; §17 both tie cases; §43 stress (the greedy binds 460 of the 480 labels: 20 lose their interval to a neighbouring line's label that was nearer); §8 behaviour "the drawing's own numbers bind each label to its own line" |
| M2 | allow label ink to become ordinary ticks: `markLabelInk` returns the lines unchanged | fail | **FAILED — 6 of 41** | §18 (1) the overall line carries label-ink marks / the middle part bound to its own line / the two lines are one group with a subdivision; (2) midway label; (12) three lines; (14) right-hand margin |
| M3 | restore short-end-span trimming: `endSpanSupport` returns null (every short unread end segment is a stub) | fail | **FAILED — 2 of 41** | §15 a labelled end segment between two ticks is kept; §15 an unlabelled end segment is kept where a neighbouring line ends at the same mark |
| M4 | use candidate enumeration order as tie breaker: labels and lines taken in input order, and an exact tie resolved by whoever comes first (ambiguity margin 0) | fail | **FAILED — 2 of 41** | §17 two labels tied for one interval are both refused; §17 a label whose convention and distance disagree by exactly the side cost is refused |
| M5 | use final / published area to choose the binding: `labelCandidates` takes a `publishedFootprintM2` and adds |label/100 − √area| to a candidate's cost | architecture test must fail | **FAILED — 2 of 41 (architecture)** | §8 no topology code names a published figure, an area…; §8 a candidate's cost is geometry: no reading value enters `labelCandidates` |

Notes.

- M4's permutation test (§16) did not fail on its own: with the canonical sort removed but every non-tied label still
  solved exactly, the permutations of the §16 case give the same answer, because that case has no exact tie. What
  enumeration order changes is who wins a tie, and both tie cases catch that.
- M1's stress failure is a binding count (460 of 480 bound), not the time bound.
- Logs: kept outside the repository (`work005i-a/mutations/M*.log`), summarised here.
