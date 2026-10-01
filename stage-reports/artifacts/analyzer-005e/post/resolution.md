# 005E post-implementation review — resolution

Four read-only reviewers reviewed HEAD `8b8bd39` (the lattice, the metric integration, the Evidence Pack extension and the
development matrices m1/m2). Their reviews are in this directory:

- A, OCR candidate recall: `ocr-recall-review.md`
- B, non-circularity: `non-circularity-review.md`
- C, false-consensus red team: `false-consensus-red-team-review.md`
- D, performance and overfit: `performance-overfit-review.md`

The fixes are in `ebd64eb`, unless a line names another commit. The documentation fixes are in the commit that adds this
file. Each fix is generic: it names no house and no printed value, and none was tuned to a development row. Replaying the
selected plan frames of all fifteen development rows gives the same relation, confidence and scale before and after.

## P0 and P1: all closed before the freeze

| ID | Sev | Finding | Resolution |
| --- | --- | --- | --- |
| C5E-1 | P0 | The class rule ignored the margin. A two-value coin toss was SUPPORTED and could corroborate, and §29 without its children came out CONFIRMED/STRONG at −6.5 %. | **Fixed.** SUPPORTED now needs the as-read value to lead the next value by 0.3 (`supportedMargin`). `ocrClassOf` exports the rule. Test fixtures get their class from the rule, and a fixture whose probabilities say otherwise fails. New tests: §29 without children, and a one-glyph coin toss on each axis (both INCONCLUSIVE). |
| C5E-2 | P1 | The false-consensus check pushed true scales aside: its triggers were cheap, and it handed a REPLACE to a vote that had no reading of its own. | **Fixed.** The better-read rival ink must itself stand against the selection on a substantial share of its axis. Candidate consensus uses only alternatives held at ≥ 0.5 of the reading. A doubt lowers confidence (REPLACED/INCONCLUSIVE, so the challenge runs) but never hands the first reading to a vote with no independent reading. Test: the non-monotone fixture stays at the true 2.2. |
| C5E-3 | P1 | On the anti-aliasing sheet one AMBIGUOUS overall replaced the vote at +42 %. | **Fixed.** A WEAK deciding set made only of AMBIGUOUS inks replaces nothing when one of its inks and another counted AMBIGUOUS ink hold alternatives agreeing on another plausible scale. The §41 anti-aliasing scale clause now passes, so its `it.fails` is now `it`. |
| A5E-1 | P1 | An as-read string with a leading zero (`4` read `0`) dropped the ink from the metric, although its lattice held the truth. The re-solve then fell back to 005D's substitution list. | **Fixed.** Such an ink keeps a non-decisive observation, with its lattice values as alternatives. `correctionReadings` never returns undefined for a lattice, so an ink with a lattice reads only from its lattice. Tests: leading zero, and lattice-only re-solve. |
| B5E-1 | P1 | The same fallback sealed a value outside the ink's lattice on a development row: a LOW_QUALITY blob was sealed CHAIN_CORRECTED `251` and anchored the registration. | **Fixed** with A5E-1. `expectNonCircular` now also checks the sealed chains of a lattice re-solve. |
| B5E-2 | P1 | Kept 005D chains (CONFIRMED / LEGACY_UNCONFIRMED frames, where the vote's DP is kept) seal 005D substitutions that lie outside the ink's 005E lattice. | **Recorded, not changed (contract R1).** The legacy chains are the 005D page vote, kept byte for byte so that confirmed models do not move. Making them obey the lattice would move every CONFIRMED model; for example, G2E's X registration would lose all 7 of its anchors. That needs its own decision (next stage). `METRIC_EVIDENCE.md` now states the exemption, and the oracle covers the re-solve path only. Residual debt §AG. |
| D5E-1 | P1 | The as-read string sat on a knife edge of the STRICT mask threshold: ±10 % flipped readings and three matrix outcomes. | **Fixed.** The stability bracket re-reads the stricter masks at ×0.9 and ×1.1. A reading whose value moves is never CLEAR or SUPPORTED, and the bracket's readings are recorded. The bracket width is fixed a priori, not fitted to the matrix. Measured on both corpora: stable as-reads are right far more often than moving ones (calibration README). Development frames are unchanged. |

## P2

| ID | Finding | Resolution |
| --- | --- | --- |
| A5E-2 | The count bound (8) is where development truths are lost, and it is not recorded. | **Recorded.** Each lattice now carries `mergedCount` and `emittedMass`. The count bound is not moved: on this evidence a larger K is not confirmed on the check sets. |
| A5E-3 | "Never more decisive than 005D" is not literal. | **Doc.** The claim now reads "than 005D's own substitution bound, measured on the lattice's glyphs" (the README and code comments). |
| A5E-4 / D5E-4 | 9 sequences were emitted where the bound says 8; FLOOR was unreachable; anchors had 8–19 cells. | **Fixed.** At most K sequences, the as-read string among them. FLOOR is recorded from the beam's floor drops. A stricter variant whose anchor has more cells than `maxCells` gives no paths. |
| A5E-5 / D5E-7 | Calibration text: two FIT labels were measured on pseudo-tokens, the "005D one-sub" column used another definition, and the AUC and as-read comments were stale. | **Fixed.** The tables were re-run on the tokens production latticed, with the README's definition. Comments were corrected; the AUC figures are FIT's, and HELD_BACK is reported as a near-tie. |
| D5E-2 | Split hygiene was overstated: HELD_BACK and TARGET labels were inside the pre-review measurements that proposed the variants and masks. | **Doc.** The README now says so, and reports the as-read evidence by split. Round 5 is the only clean check. |
| D5E-3 | `clearMargin` is inert at `clearP` 0.6; several constants are inert or undocumented. | **Doc.** The README lists every constant, with D's ±20 % sensitivity, and marks the inert ones untested. `clearMargin` is kept as the definition, and its inertness is stated. |
| D5E-5 | `pathIds[0]` was not the deciding path. | **Fixed.** The path that decides a value's score is listed first. Test added. |
| D5E-6 | The cross-label cache never hits on real plans. | **Kept, comment corrected.** The hit path is correct (B and D both checked), and it serves identical crops within a run. |
| D5E-8 | No OCR time in the run record, and no phone step line for `OCR_LATTICE`. | **Fixed.** Per-subphase time is in the phase stats. The phone shows "odczyt wymiarów: etykieta n z m". |
| B5E-3 | `ocr.selected` could SCALE_RANK a value the re-solve refuses, and is not the sealed segment. | **Fixed (bound) and documented.** SCALE_RANKED is chosen only among plausible values, on spans long enough to measure. `selected` is documented as the metric's preference among the image's values, beside the sealed chain. |
| B5E-4 | A printed span whose label misses the scale is sealed DERIVED, with "nothing is printed". | **Debt** (pre-existing 005D record; changing the chain's values moves tiling). §AG. |
| B5E-5 | STRUCTURAL had no plausibility bound. | **Fixed.** Structural options are only the plausible values. |
| B5E-6 | CHAIN_CORRECTED values anchor registrations. | **Debt** (pre-existing; excluding them moves CONFIRMED models). §AG. |
| C5E-4 | The leading-zero test read the 005D text. | **Fixed** (the as-read string, landed with C5E-2). |
| C5E-5 | The twin-line key rounded pixels apart. | **Fixed.** The key is now the mark indices. Test added. |
| C5E-6 | The false-consensus record was partly misleading. | **Fixed.** Every candidate scale is recorded with its pair, the contested inks are recorded, and the `why` wording is corrected. |
| C5E-7 | Confident misreads still reach STRONG; a ≥ SUPPORTED selection was never checked. | **Extended and declared.** BETTER_CLASS_RIVAL now also checks a ≥ SUPPORTED selection that has no CLEAR deciding ink against a standing CLEAR rival ink (C's S1d: from REPLACED/STRONG wrong to LEGACY_UNCONFIRMED/WEAK at the true scale). Confident misreads stay a declared limit of the class. |
