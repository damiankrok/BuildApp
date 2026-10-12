# 005N mutation gates (brief §30, and the council fixes)

Each mutation is a temporary patch to one production file at `4e12ce5`, applied by `research/analyzer-005n/mutations.mjs`. The harness then runs the 005N suites, restores the file and checks the tree is clean before the next mutation. Logs stay outside the repository. A mutation passes the gate when at least one test fails (KILLED).

Suites: `packages/reconstruction/test/compound-facade.test.ts`, `packages/reconstruction/test/compound-facade-order.test.ts`, `packages/reconstruction/test/compound-facade-emission.test.ts`, `packages/reconstruction/test/wide-openings.test.ts`, `tests/architecture/compound-facade.test.ts`, `tests/architecture/gap-evidence.test.ts`.

| id | mutation | must fail | result | failing tests | first failure |
| --- | --- | --- | --- | --- | --- |
| M1 | do not split a compound span: the reader never returns a span | the target synthetic fixture fails (recess + garage on one line) | KILLED | 30 | 005N council E2 — a compound front on the ground storey of a two-storey house > the ground storey reads its recess and garage, the upper storey (set back 3 m ov |
| M2 | close every child interval: each interval is an opening in its wall | the carport / loggia fixtures fail | KILLED | 18 | 005N §23 — compound facades through the production solver > recess + garage door drawn: one enclosed body with the hall and the garage, the garage door on the g |
| M3 | a callout crosses a separator: every interval may take any callout printed along the whole parent span | the recess-callout safety fixture (18) fails | KILLED | 4 | 005N §31 — order invariance of the compound reading > the reference reading has a compound span with a separator, a recess and a callout bound to each mouth |
| M4 | the published area chooses segmentation: a span is left whole when the page states a footprint | the non-circularity architecture gate fails | KILLED | 1 | 005N §20 the compound-facade reading reads the drawing only > no compound-facade code names a published figure, an area, a refusal, an outcome, a verdict or a h |
| M5 | use the whole span's pocket limit after segmentation: each interval is weighed against max(6, 2.5 w²) of its parent | the per-interval pocket fixture fails (an undrawn mouth into the hall beside the recess) | KILLED | 2 | 005N §16 — each interval is weighed against its own pocket > an undrawn mouth into the house beside the recess: the hall behind it is the interior, so its own w |
| M6 | accept any short block as a separator: a post or a bin on the line cuts the span | the furniture / post negative fixtures fail | KILLED | 1 | 005N §21 — separators: structural ink only > 20. a block of furniture standing on the facade line is a post, not a separator |
| M7 | a missing return still makes a recess: the back wall is sought as deep as the LONGER return reaches | the missing-return fixture (14) fails | KILLED | 1 | 005N §21 — recesses need the drawing to make them one > 14. one return missing: no recess — the mouth leads into the house, which stays enclosed |
| M8 | enable the 005K drawn-gap rule by default | the drawn-gap architecture gate fails | KILLED | 2 | 005K §19 the product never turns the rule on > apps never name it; the service and the solver only pass ON through when their caller asked for it |
| M9 | enumeration order changes child intervals: an interval takes the first agreeing callout in input order | the order-invariance gate fails (callout shuffles) | KILLED | 2 | 005N §31 — order invariance of the compound reading > eight shuffles of the callouts change nothing |
| M10 | a house special case: one facade line, by its pixel row, is never read for separators | the generalization guard fails (a new literal) | KILLED | 1 | 005N §30 M10 the reading has no special cases > its numbers are a frozen set: a wall, a half, a step, nothing that fits a sheet |
| M11 | the pocket test counts a sibling just shut: each undecided gap is weighed against the openings decided so far in the loop (council A2) | the two-mouths fixture (A2) fails | KILLED | 1 | 005N council — what a back wall, a callout, a pattern and a sibling may not do > A2. two undrawn mouths side by side: the hall behind one is shut by its own poc |
| M12 | any line between two returns is a back wall: a hole between two cross-sections counts whenever anything is drawn across it (council A1/B2) | the step-line fixtures (A1/B2) fail | KILLED | 1 | 005N council — what a back wall, a callout, a pattern and a sibling may not do > A1/B2. a step line, or a flight of them, in front of the set-back wall is not t |
| M13 | a callout closes any walled mouth: the returns need only be as long as a return (council B1/C1) | the shallow-bay callout fixture (B1/C1) fails | KILLED | 2 | 005N council — what a back wall, a callout, a pattern and a sibling may not do > B1/C1. a callout at a shallow bay whose back wall was not read does not shut it |
| M14 | no joint weighing: mouths side by side into one space are each blind to it (council D1) | the open-plan pier fixture (D1) fails | KILLED | 1 | 005N council D1 — mouths side by side into one space are weighed together > an open-plan house behind them is the interior: both mouths are shut, the house stan |

**14/14 killed.**

Two notes:

- M11 first survived as written: it reverted only the snapshot of decided openings. The fix also reads every own pocket before any decision is applied, so that revert changed nothing. M11 now reverts both, as a real revert of the A2 fix would, and is killed.
- M4 is caught by the non-circularity word gate. The executed decoy (§20, `compound-facade-emission.test.ts`) shows the published figure has no lever on the reading.

