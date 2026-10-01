# 005D post-implementation review — findings and their resolution

Four independent reviewers (read-only, HEAD `6f3f996`) tried to falsify the stage: A topology false-positive
red team (`topology-red-team-review.md`), B OCR / value binding (`ocr-binding-review.md`), C circularity /
independence, first-success challenge and the e-OZE split (`circularity-review.md`), D overfit / verification /
Evidence Pack / round-4 protocol (`overfit-verification-review.md`). Every generic P0 and P1 was fixed before
the freeze, with a test that fails without the fix; what was not fixed is named as residual debt.

## P0

| # | finding | resolution |
| --- | --- | --- |
| C-P0-1 | On a source conflict the published figure screened the drawing's alternatives (stage-1 WRONG filter, `acceptable ∧ strictlyBetter` before `byDrawing`): the same drawing was built at 4.6 or 4.0 cm/px depending on the figure. | `challengeFirstReading`, conflict path: no figure screening before the drawing chooses; the drawing's choice is its best-supported other SCALE (lower refuted bucket, better drawing tuple with the figure's own refusal left out); the figure then verifies that one reading (REPLACED) or vetoes it (REFUSED, `SOURCE_CONFLICT`) — never the next-best. Test: `source-conflict.test.ts` sweeps the figure 70–160 m² and only 4.0 cm/px is ever built. |
| A-P0-1 / B-P1-3 | `primaryBinding` ranked "fewer questionable ends" before centring: a real end classed QUESTIONABLE handed a label to a span ending at an interior crossing (a wardrobe diagonal on a development house: a decisive witness 21 % off). | Centring decides. A questionable end may only pick a LONGER span that encloses the best-centred one, centred within the ambiguity margin of it, ending on fewer questionable marks (the planter case); any other near-tie of a different length is AMBIGUOUS. The reviewer's drawn Jabłonki pattern (S7) now reads 2.4955 cm/px (true 2.5). |
| D-P0-1 | The §41 metamorphic test let a wrong REPLACED scale pass at "lower confidence". | The scale clause now requires the right scale or no scale adopted (not REPLACED/ADDED, and INCONCLUSIVE). One imaging fails it — a 3×3 blur makes the reader read `1200` as `1100` with no bounded alternative — and is declared with `it.fails` (`KNOWN READER LIMIT`), beside a blurred-figure case in `glyph-ambiguity.test.ts`; both turn green the day the reader is fixed. Topology is checked for every imaging separately. |
| D-P0-2 | The round-4 verdict condition R9 could never fail (`trigger` is always a sentence; a challenge record is never `SPENT`). | A REPLACED outcome now carries its `sourceConflict`; `verdict.mjs` and `known-row.mjs` require the named conflict with the figure only `VERIFIED` (or no figure), or — without a conflict — a witness besides the figure. Changed before the freeze. |

## P1

| # | finding | resolution |
| --- | --- | --- |
| C-P1-1 | `undecidedConflict` made a corroborated scale INCONCLUSIVE when one child was misread. | Undecided only when the side that ranks first does not also outnumber the other within the pair. Test: total + two children against one misread child stays decided. |
| C-P1-2 | A dimension drawn on twin lines with its value printed on each counted twice (I5 unenforced). | Readings bound to the same span on lines that are one line drawn twice (same marks within 2 px, ≤ 4 label heights apart) count once. Test added. Changes no development house. |
| B-P1-1 | V3-between-rivals widened the window by the rival's own imprecision (17.5 px on a 556 px overall), so any one-glyph alternative made an overall neutral; a short rival could take the selection. | The window is capped at twice the ink's own tolerance, and neutrality never promotes a scale of lower standing than the strongest's whole evidence — that case ends INCONCLUSIVE. B's adversaries (P15, P10, P3) now give the correct scale or no scale. |
| B-P1-2 | V3 against the vote was skipped between the confirmation tolerance (1.2 %) and the distinct ratio (3 %). | Asked whenever the selection would not simply confirm the vote. |
| A-P1-1 | ONE_SIDED was a rounding artefact on even-thickness lines (rows rounded both ways up). | Side rows are symmetric about the baseline (`floor` above, `ceil` below). |
| A-P1-3 | The total-vs-children check only paired consecutive marks of the total line: one extra crossing hid a conflict. | The hierarchy also checks the span each label on the line is bound to. The reviewer's S6 now ends INCONCLUSIVE instead of REPLACED/WEAK +16.9 %. |
| D-P1-2 | Five rules had no test that failed without them. | New tests: I2 (one ink read two ways on two chains witnesses neither), V3 against the vote, the re-solve at a replaced scale (one segment, never split at a rejected mark), `outspannedByOuterTotal` (positive and three negatives), the whole source-conflict path through `reconstructV2` (REPLACED / REFUSED / VERIFIED, one challenge only). I2 and V3 were mutation-checked (each test fails with its rule removed). |
| D-P1-3 | The evidence-pack CI job had no committed packs to verify. | Packs are committed with the freeze (`stage-reports/artifacts/analyzer-005d/evidence/`). |
| D-P1-1 | Thresholds (κ 0.75, centring 0.1, glyph ratio 0.7, the resolver's shares) were chosen on the development houses and no generic test pins them. | Not changed: each is a generic rule whose value the development set measured, recorded with its margin. Round 4 is their first independent test (report §AH). |

## P2 fixed

- The double challenge after an early replacement (C): a reading that answered the drawing's challenge is not challenged again.
- The SVG denylist missed plain `href=`, `<feImage>`, `url(`, `<use>`, `<script>` (D): added; the test and `evidence:verify` also apply an independent element allowlist.
- The hard-code guard now scans the Evidence Pack, `holdout/verdict.mjs` and the row judges (D).

## Residual (named, not fixed in 005D)

- A-P1-2: dark marks in the line's own ink (same-ink hatching near an end, a dark crossing under an off-centre label) cannot be told from ticks by appearance; three or more of them can still split a total (REPLACED/WEAK +7–13 % in the reviewer's drawings). Telling them apart needs extension-line support (§22), not built in 005D.
- The reader's blur limit (D-P0-1, declared above).
- B-P2: the value-ambiguity interval is not clipped to the plausible band; a sparse frame's page-sized pseudo-token; one ink witnessing two hypotheses 3 % apart; orientations chosen by lattice fits feeding the hierarchy check.
- C-P2: T4/R7/R8/R10 of the contract are not implemented (the hierarchy is recorded, not a trigger; footprint still ranks before refutation inside `resolvePlan`); T1's refuted share is already ≥ 0.5 on two correct houses, held back only by the alternative-scale condition.
- D-P2: first-divergence reports record-only hierarchy entries first when they differ.
