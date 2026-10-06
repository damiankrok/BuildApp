# 005K — mutation results (brief §28)

Each mutation is a temporary patch applied in place to one production file at the commit under test. The procedure
(`research/analyzer-005k/mutations.mjs`):
1. run the 005K suites;
2. restore the file with `git checkout -- <file>`;
3. check the tree is clean before the next mutation.

No mutation code is in any commit.

**Runs.**
- First run: at `c244ff7`, M1–M5, 23 tests.
- After the council: at `44f7128`, M1–M6, 25 tests. 44f7128 added the crossing-wall fixture, M6 and the stronger
  "never ON" guard. The table is that run.
- The JSON reports stay outside the repository (`work005k/mutations2/`).

The two suites, 25 tests:
- `packages/reconstruction/test/gap-evidence.test.ts` (16): records, OFF/ON, hard negatives (blank, dashed, post,
  porous jamb, crossing-wall jamb), order invariance, translation;
- `tests/architecture/gap-evidence.test.ts` (9): imports, vocabulary, frozen literals, no special cases, never ON in the
  product (every production mention of the option in a fixed form).

| # | mutation | must | result | tests that failed |
| --- | --- | --- | --- | --- |
| M1 | a BLANK gap is allowed: the rule upgrades a WALL/WALL gap with nothing drawn across it | the safety fixtures fail | **KILLED** — 2 of 25 | the blank door-sized gap; the blank doorway of the record test |
| M2 | the jamb-ink check is removed: a line drawn from ink that is not wall-thick qualifies | the phantom fixture fails | **KILLED** — 2 of 25 | the porous-jamb phantom; the frozen-literal guard (incidental) |
| M3 | an outcome-circular rule: the check takes the published footprint and only upgrades while the house is short of it | the architecture gate fails | **KILLED** — 1 of 25 | the §10 vocabulary gate |
| M4 | a house special case: a 0.41 m face line is always an opening | the generalization guard fails | **KILLED** — 1 of 25 | the frozen-literal guard |
| M5 | enumeration order as the tie-break: records in the order the lines and gaps were read | the determinism gate fails | **KILLED** — 1 of 25 | the order-invariance unit test |
| M6 | the along-jamb test is removed: a jamb that is a crossing wall qualifies (council A6) | the crossing-wall fixture fails | **KILLED** — 2 of 25 | the crossing-wall fixture; the frozen-literal guard (incidental: the patch adds a `2`) |

**Reading, with council C's caveats (C5).**
- Every mutation is caught by the gate the brief names for it.
- **M3 is a kill by name only.** The patch is inert: nothing passes the extra parameters. It dies because they are
  spelled `publishedFootprintM2`. A renamed version would survive.
- **M4 is a kill by spelling.** The frozen-literal scanner (`numbersIn`) does not see leading-dot, hex or exponent
  literals: a `.41` / `.01` spelling would survive. `0x80` already sits unseen in `inkCropHash`.
- **The rule's inputs are not guarded:** `gapSignature`, `readWallLine` and `DEFAULTS.maxOpeningM`. A benchmark fit no
  gate catches is a 1.65 m cap: it removes q049 (1.685 m), the only false upgrade, and keeps 13 of the 24 true upgrades.
- These gates hold the rule as written against the obvious circular changes. They do not prove it uncircular against
  a determined one. With the rule OFF and not adopted, they are recorded as limits, not fixed in this stage.
