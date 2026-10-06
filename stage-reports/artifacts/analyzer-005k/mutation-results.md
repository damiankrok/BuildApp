# 005K — mutation results (brief §28)

Each mutation is a temporary patch applied in place to one production file at the commit under test
(`c244ff7`). The 005K suites run, the file is restored with `git checkout -- <file>`, and the tree is checked
clean before the next mutation (`research/analyzer-005k/mutations.mjs`). No mutation code is in any commit.

The two suites, 23 tests:
- `packages/reconstruction/test/gap-evidence.test.ts`: records, OFF/ON, hard negatives, order invariance, translation;
- `tests/architecture/gap-evidence.test.ts`: imports, vocabulary, frozen literals, no special cases, never ON in the product.

| # | mutation | must | result | tests that failed |
| --- | --- | --- | --- | --- |
| M1 | a BLANK gap is allowed: the rule upgrades a WALL/WALL gap with nothing drawn across it | the safety fixtures fail (the blank door-sized gap, the blank doorway of the record test) | **KILLED** — 2 of 23 | 005K §20 hard negatives: the rule never bridges these M1 safety: a blank door-sized gap — a doorway or the mouth of a recess — is never drawn evidence<br>005K §8–§9 the boundary record carries one source-addressable record per WEAK gap records name the decomposition, the coordinates, the crop and its in |
| M2 | the jamb-ink check is removed: a line drawn from ink that is not wall-thick qualifies | the phantom fixture fails | **KILLED** — 2 of 23 | 005K §28 M4 the rule has no special cases its numbers are a frozen set: the conventions of the line reader, nothing that fits a sheet<br>005K §20 hard negatives: the rule never bridges these M2 phantom: a line drawn from ink that is not wall-thick at the jamb (a porous, hatched end) is  |
| M3 | an outcome-circular rule: the check takes the published footprint and only upgrades while the house is short of it | the architecture gate fails | **KILLED** — 1 of 23 | 005K §10 the gap rule and its records read the drawing only no rule or record code names a published figure, an area, a refusal, an outcome, a verdict |
| M4 | a house special case: a 0.41 m face line is always an opening | the generalization guard fails (frozen literals) | **KILLED** — 1 of 23 | 005K §28 M4 the rule has no special cases its numbers are a frozen set: the conventions of the line reader, nothing that fits a sheet |
| M5 | enumeration order as the tie-break: records in the order the lines and gaps were read | the determinism (order-invariance) gate fails | **KILLED** — 1 of 23 | 005K §8–§9 the boundary record carries one source-addressable record per WEAK gap §27 order invariance: lines and gaps read in any order give the same |

**Reading.**
- Every mutation is caught by the gate the brief names for it.
- M2 is also caught by the frozen-literal guard: its patch introduced a number into the rule.
- The logs and JSON reports stay outside the repository (`work005k/mutations/M*.json`); this table summarises them.
