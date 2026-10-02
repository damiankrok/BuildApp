# 005F post-implementation review — resolution

Four read-only reviewers reviewed the stage after its development matrix (`d910212` / `a991e6b`; reviewer D also read
`4fd2f8e`, `65ebbdd` and `2e1889a` as they landed). Their reviews are in this directory, verbatim:

- A, count-hallucination red team: `count-hallucination-red-team-review.md`
- B, bounded search and performance: `bounded-search-performance-review.md`
- C, envelope and body false positives: `envelope-false-positive-review.md`
- D, overfit and generalization: `overfit-generalization-review.md`

Every fix is generic: it names no house and no printed value, and none was chosen against a development row's verdict.
Where a rule was found on one house, this file says so. The full development matrix, the known rows and the calibration
were re-run on the freeze candidate after the last fix (§"After the fixes").

## P0 and P1: all closed before the freeze

| ID | Sev | Finding | Resolution |
| --- | --- | --- | --- |
| C5F-1 | P0 | Room evidence from glazing depended on which way up the plan was drawn: the suite's own accepted bay was not built on W and N, and there a yard was built on the house's own window. | **Fixed (`4fd2f8e`).** Glazing counts on the part's own outer walls within its span ± ½ wall, symmetrically, and never on a line the part shares with the house. Seven drawn scenes run under five transforms (`extent-envelope-orientation.test.ts`); B's `orient.ts` re-run on the fixed code: the bay is built on all four sides, the yard on none. |
| C5F-2 | P0 | A part was a wall-blind component of cells: a walled yard rode in with the room beside it. | **Fixed (`4fd2f8e`, `65ebbdd`).** A part is the floor reached from the house through passable edges. Unreached floor is split off as `WALLED_OFF` when one could stand in it (a door's width, the existing `doorM`, across both ways); narrower floor (a reveal behind a pier) stays with the part's walls. **Found on Morelach:** the first form (`4fd2f8e`) split a 0.13 m² window reveal off Morelach's bay and broke its body (−6.48 %); the door-width bound was added on that evidence (`65ebbdd`). Tests: `walled-off.test.ts`, both ways, along either axis, either way round. |
| C5F-3 | P1 | "A chain measuring it" was any chain whose baseline crossed the part. | **Fixed (`4fd2f8e`).** The chain must run across the part and tick within a wall of both its ends. Orientation scene "a walled yard a facade chain is drawn across". |
| C5F-4 | P1 | Vehicle-door depth grew through walls. | **Fixed (`4fd2f8e`).** The depth is reached across open edges only (a breadth-first walk). Test: `vehicle-door-depth.test.ts` (C's hand-built grid), and the orientation scene. |
| C5F-5 | P1 | A DASHED vehicle door alone made a carport an attached room. | **Fixed (`4fd2f8e`).** A dashed line alone is no room evidence for an attached room (it still is a vehicle door for a garage end). Orientation scene "a carport with short piers and a dashed roof line". |
| B5F-1 | P1 | The part cap was spent on wall slivers in scan order; a real room was dropped without a record. | **Fixed (`4fd2f8e`).** Parts are judged largest first; the ones past the cap are counted (`completionsUnjudged`) and keep the conflict from being called a zone. B's `parts-cap.ts` re-run: the bay is built at every closet count, 0 to 18. Test: "the part cap". |
| B5F-2 | P1 | Glazing counted only on the east and south outer walls. | **Fixed** with C5F-1. |
| D5F-11 | P0 | `65ebbdd` named a development house and its measurement in a production comment; the generalization guard failed. | **Fixed** (this commit series): the comment describes the case only. The guard passes. |
| D5F-1 | P1 | The typed refusal said "dimensions were found" on plans that print none: stray tokens were counted. | **Fixed (`2e1889a`).** Only witnessing labels count (a PRIMARY binding read better than LOW_QUALITY), on at least two labels and two lines, or a legacy chain. Replayed on all four refusal rows: right kind on each. Tests in `failure-codes.test.ts`; CI rows for galaktyka and aster-viii now expect `NO_DIMENSION_EVIDENCE`. |
| D5F-2 | P1 | The calibration record the code and the doc cite did not exist. | **Fixed.** `../calibration/README.md`: the per-split table, the grid tried, the criterion and why, the held-back miss, the knife edges, the CLEAR-margin cost, the wrong-count readings and the two matrix consequences. |
| D5F-12 | P1 | The boundary loop on Morelach continued after the reviews; the newest rule had no test and no other evidence; no matrix described HEAD. | **Fixed.** (1) `walled-off.test.ts` tests the rule both ways in four orientations. (2) The full matrix was re-run on the freeze candidate and diffed row by row against `m-c` (§"After the fixes"). (3) The stage report states that Morelach's PASS was restored by a rule found on Morelach (§S). |

## P2

| ID | Finding | Resolution |
| --- | --- | --- |
| B5F-3 | The "hard cap" of 96 scored cells is not hard; a third of the scoring is uncounted (measured maximum 118). | **Doc.** `COUNT_BOUNDS` and `METRIC_EVIDENCE.md` now state that the cap bounds the hypotheses, not the ink: anchors are exempt and the bracket scores up to 28 more. Counting the bracket and reserving the anchors: debt (§AG). |
| B5F-4 | The per-count cap truncates silently; the per-variant and per-ink caps cannot bind. | **Doc.** Both stated as derived bounds that do not bind; the silent caps are named. Counters for them: debt. |
| B5F-5 | Cell-cap truncation starves count alternatives first, and the record still lists them. | **Doc and debt.** Stated in `METRIC_EVIDENCE.md`. All four starved labels are LOW_QUALITY; no development decision moved. |
| B5F-6 | The tail cap is never recorded. | **Doc and debt.** |
| B5F-7 | `dimensionStyleOf` is untickled and booked to CHAINS (22–150 ms per plan). | **Debt.** Below the 5 s tick budget on every development row. |
| B5F-8 | `styleFor` is O(labels × samples · log samples). | **Debt.** Tens of milliseconds on development plans. |
| B5F-9 | `completeBoundary` has super-linear pieces and no tick. | **Debt.** About linear end to end; tens of milliseconds on development grids. |
| B5F-10 | Stretches are truncated silently; the contract's per-stretch component cap and AMBIGUOUS decision do not exist. | **Partly fixed, contract deviation recorded.** The digest records `stretchesOmitted`. Each part is judged on its own evidence: two glazed bays in one stretch are both built (B's `two-bays.ts`, re-run). The per-stretch cap is not implemented; recorded in the stage report. |
| B5F-11 | The m-c performance numbers are contaminated by load. | **Process.** Performance in the stage report comes from the freeze-candidate run only, with its load stated. |
| C5F-6 | Missing adversarial and orientation tests; a wall-thick parapet with a glazed balustrade is the same drawing as a bay. | **Tests and declared limit.** Orientation scenes added (C5F-1..5); a thin parapet (7 and 9 px) with a glazed balustrade is not built; the wall-thick case is a declared limit in `STRUCTURAL_LAYOUT.md`. |
| C5F-7 | `stableRegions` extended a body by any completion kind. | **Fixed (`4fd2f8e`).** Only a BOX_COMPLETION extends a body; an attached room is its own mass. |
| C5F-8 | Records went stale after a completion (bodies NOT_BUILT, outline NOT_ADOPTED, `longBandBox` the outline). | **Fixed (`4fd2f8e`).** Bodies are refreshed as built after completions, the envelope event says COMPLETED, `longBandBox` is the box. |
| C5F-9 | STRONG on two lines did not check that the ends agree. | **Fixed (`4fd2f8e`).** |
| C5F-10 | An attached room's "house" included cells the reading did not build. | **Fixed (`4fd2f8e`).** The house is what was built or accepted. |
| D5F-3 | The accepting paths are exercised by one house, the one they were iterated on; `envelope-without-attached` is load-bearing there; the garage end sits 8 % above `vehicleMinM`. | **Recorded** in the stage report (§L, §N, §AG). Blind round 6 is the only clean check. |
| D5F-4 | `styleBand`'s upper bound was placed with the motivating label in view; a style-decided count could be CLEAR. | **Fixed and stated.** The comment states where the bound came from and what the development labels allow. A count the style chose over the reader's is never CLEAR (test: §28 "a count the plan's style chose…"). |
| D5F-5 | One chain made a side STRONG through a "closure" that was the scale restated. | **Fixed.** One chain alone is STRONG only with at least two READ segments and none DERIVED or CHAIN_CORRECTED. Test: "one chain alone is strong only on its own readings". |
| D5F-6 | Contract deviations. | Chain coverage and vehicle depth: fixed at `4fd2f8e`. Count alternatives contesting a scale: **fixed** (`latticeAlternatives` drops other-count values; test). B5 (shadow lines at wall-band axes) was not implemented: **debt** (§AG). |
| D5F-7 | Development models that moved for reasons the stage did not design. | **Explained** in the stage report (§T). |
| D5F-8 | ON == OFF proven on Larchfield only. | **Recorded.** D's `morelach-off` run is byte-identical to ON; a CI gate for it is debt. |
| D5F-9 | Pointers to records that did not exist. | **Fixed** with D5F-2 and the stage report. |
| D5F-10 | The hard-code guard does not cover three-digit values or pixel coordinates. | **Recorded.** By design; D's scan found none in the stage's production files. |

## Reviewer A

A tried to falsify the count claims with synthetic pages built as a plan is read (faces A and B, context labels setting
the plan's style, one target), against the frozen 005E lattice and without a style. Its fixes were measured on an
env-gated scratch copy over the 81 development labels, both corpora, its grids and Morelach; the shipped fixes are those
rules, placed before the SUPPORTED caps so that a stricter rule is never shadowed. Each attack is now a test that fails
on the code before the fix (`adaptive-glyph-count.test.ts`, "post-review A"; `ocr-metric-adversaries.test.ts`, "005F
contract A6").

| ID | Sev | Finding | Resolution |
| --- | --- | --- | --- |
| A5F-1 | P0 | The decisive count trusted a style that is not the label's face: an ordinary `145` on a condensed page read `1115` SUPPORTED; under a wide title-block style `730` read `10` SUPPORTED. | **Fixed.** A count no ink variant's own reader cut is at most AMBIGUOUS (the style is the page's median face, not necessarily this label's). A merge is never decisive: it stays a count alternative. Development labels, corpora and Morelach: no change (A's measurement; development re-measured, below). Tests: the split and the merge pages. |
| A5F-2 | P0 | Width doubt carried the hypothesis gates (valley depth, counter-safe cut), which contract A5 does not have, so it vanished exactly where condensed glyphs touch: the stage's own `2590` at the blind house's 11 px cap read `190` SUPPORTED (005E: AMBIGUOUS). | **Fixed.** Under the plan's style, width doubt is A5 as written: a count one away admitted and fitting at least as well. With no style the gates stay (the no-style band is wide; without them the calibration corpus would lose 17 right readings). One development change: kosacce-clean `890`, read `840` — a wrong reading — SUPPORTED → AMBIGUOUS. Tests: the cap-11 page, and ordinary touching labels on condensed pages. |
| A5F-3 | P1 | Count alternatives contested a scale and fed M4 doubt (A6 says never): on a fixture a CONFIRMED 2.0 cm/px became a STRONG wrong 2.5. | **Fixed** (`ac5c5fc`, the D5F-6 filter). A's fixture is now a test, and fails without the filter. |
| A5F-4 | P1 | When the ink variants cut different counts, the as-read count was chosen by template score or by which anchor states a value, and the class did not see it (`7525` read `716` SUPPORTED). | **Fixed.** Variants whose anchors differ in count make the reading at most AMBIGUOUS (contract §0: the image score cannot choose a count). Cost on the corpora: below. |
| A5F-5 | P2 | An ink cut at a count two away, or whose width rules out its count with no count one away, keeps CLEAR (`185` read `85` CLEAR on the held-back corpus). Pre-existing (005E 82, 005F 80 on A's grid). | **Doc and debt.** `METRIC_EVIDENCE.md` no longer reads "3-vs-4 is never CLEAR" as a guarantee: the rules see the counts the lattice raised, and this is a declared limit. A's FIX_A (a count the width rules out is AMBIGUOUS) costs every right reading of an off-style face on its grid; not shipped. |
| A5F-6 | P2 | `2590` on modrzewnicy: 0 of 420 exhaustive four-cell cuts per mask read it; the `9` scores below the `4`. The de-skew slope also spoils the `2`/`5`. | **Recorded.** Confirms the stated root cause (the classifier's 9→4 at the right count; §C). The de-skew on 11 px ink is 005D front-end debt (§AG). |
| A5F-7 | P2 | The count recovered without its value made modrzewnicy's unreadable overall an AMBIGUOUS PRIMARY witness, the heaviest hypothesis at a wrong scale. | **Doc.** Stated in `METRIC_EVIDENCE.md`: it refuses the plan (typed `DIMENSION_EVIDENCE_INCONCLUSIVE`), it does not mislead it. |
| A5F-8 | P2 | The gate tests used one face per page, caps 14/16 only, checked `correctionReadings` only, and guarded the tail with a regex. | **Partly fixed.** Mixed-face pages, the 11 px cap and the contest path are now tested. The tail guard stays a source scan; a type-level guard is debt (§AG). |

## After the fixes

D5F-12 asked for the full development matrix on the freeze candidate, diffed row by row against `m-c` (`d910212`).
The first run, on `f64fda9`, found a regression the fixes themselves had introduced, so it was fixed and the matrix run
again.

**What the `f64fda9` matrix found.** The Marcówki development row kept its scale, verdict and footprint, but its model
moved (`6152770f` → `2eb5c3b2`). The attached garage gained a storey-1 ring, and exterior closure went from 0 errors to 4.
The first divergence was on the attic plan:

- The attic plan's box stopped short of the south wall, so the strip of two rooms below it was a BOX_COMPLETION part.
- Its drawn wardrobes read as walls. C5F-2's reachability split therefore kept only the part's corner at the door
  (1.53 m²) and called the rest WALLED_OFF.
- The continuation test was asked of the kept corner alone: 0.94 of 1.52 m open. The reached floor is by construction
  the floor next to the opening, so asked of it alone the question answers itself. As the outline encloses it, the strip
  is mostly walled from the house (0.94 of 2.05 m) and was rejected before C5F-2.
- Accepted, the completion re-cut the attic on its outline and moved its envelope. Its registration onto the ground plan
  then covered the garage by more than half, and the garage gained a storey.

**Fix (`41e26be`).** Continuation is judged on the part as the outline encloses it, before the split, as it was before
C5F-2; the split still decides which floor the part takes. A test draws a strip whose corner at the door is open and whose
rest is walled, along either axis; it fails on `f64fda9` with the same 1.50 m continuation.

**The final matrix** (`41e26be`): (pending)
