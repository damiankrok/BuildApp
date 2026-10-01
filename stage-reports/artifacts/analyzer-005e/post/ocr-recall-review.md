# a5e — post-implementation review, BUILDPLAN-ANALYZER-005E: OCR candidate recall

- **Reviewer:** a5e (reviewer A, "does the truth stay available downstream?")
- **HEAD:** `8b8bd396a167d632c0309392699c0d7eeb749a7a` (`numeric-lattice.ts` is byte-identical to `a8ba3db`, so the m1 lattices are HEAD lattices; metric facts below are from m2 = HEAD).
- **Read:** `numeric-lattice.ts` (all), `git diff d8ba4e8..HEAD` of `ocr.ts`, `metric-solution.ts`, `chains.ts`, `extract.ts`, `hash.ts`; the calibration README, `docs/METRIC_EVIDENCE.md` §"The numeric lattice", brief §26–29/§36, contract M6–M7; the lattice and adversary tests.
- **Ran** (scripts in `/home/user/BuildApp/.cache/review-a5e/`, numbers only; no crop was made):
  `nl-copy.ts` (an instrumented copy of `numeric-lattice.ts`: full admitted scores per cell, the merged set before emission, every path before the 0.7 cut, beam drops, env-switchable bounds; verified identical to production on 561/561 labels), `corpus-probe.ts` (both corpora, 480 labels), `dev-probe.ts` / `dev-probe-prod.ts` (81 labels; the README's token choice and the token production actually latticed), `sweep.ts` / `sweep2.ts` (bound variants), `decisive-probe.ts`, `lost-rank.ts`, `trunc-probe.ts`, `cache-probe.ts`, `target-view.py` (per label: lattice rank and what the metric recorded, on m1 and m2), plus scans of all m1/m2 `metric-evidence.json` and the 005D `m4` rows. No full row was started.

## Findings

| ID | Sev | One line |
| --- | --- | --- |
| A5E-1 | **P1** | An ink whose as-read string is not a dimension (mostly a leading `4` read `0`) leaves the metric entirely, though its lattice holds the printed value at rank 1–2; in the REPLACED re-solve the same ink falls back to the 005D substitution list (contract M7), seen at HEAD |
| A5E-2 | P2 | The sequence-count bound (8) is where development truths are lost (7 of 9 losses), cutting AMBIGUOUS inks at 0.55–0.80 of their mass; not movable on this evidence, but invisible in the record |
| A5E-3 | P2 | "The lattice never makes an ink more decisive than 005D left it" does not hold as stated: the contest set is measured on the 005E matcher and on emitted sequences only |
| A5E-4 | P2 | `truncatedBy` accounting: `FLOOR` is unreachable, beam/floor/re-cut drops are never recorded, and 116 matrix lattices hold 9 sequences where 8 is the stated bound |
| A5E-5 | P2 | Calibration text: two FIT labels measured on page-sized pseudo-tokens, the "005D one-sub" column computed under another definition, stale as-read/AUC/UNRESOLVED comments |

## A5E-1 (P1) — an unvalued as-read drops the ink; its re-solve uses the 005D list

**Code.** `metric-solution.ts:431` `if (lattice && lattice.asReadValueCm === undefined) return` — no observation, no `valueAlternatives`, no `ocr.selected`, no structural option. `valueOf` (`numeric-lattice.ts:450–454`) refuses `/^0\d/`, and the as-read rule (`:591–593`) falls back to the DEFAULT anchor when no anchor states a value, so a label whose leading `4` every variant reads `0` gets an unvalued as-read while `4xx` sits in its sequences. In the re-solve, `correctionReadings` returns `undefined` for the same lattice (`:383–384`), `latticeReadings` passes that on (`:1143–1145`), and `assignTokens` then rebuilds the ink's readings from `readingLattice(token)` (`chains.ts:237–247`) — the 24-reading 005D list that contract M7 ("the REPLACED re-solve read[s] the lattice, not `readingLattice`") and 8b8bd39's plausibility bound were meant to exclude.

**Development labels (production tokens, m1 = m2 lattices, m2 observations).**

| label | split | lattice as-read / class | truth rank | m2 observation | 005D (m4) |
| --- | --- | --- | --- | --- | --- |
| willa-miranda 415 | FIT | `015` SUPPORTED | 1 of 6 | none | observed `015` (leading zero), `valueAlternatives` = [`415`] |
| kosacce-clean 419 | FIT | `014` SUPPORTED | 2 of 4 | none | observed `014`, no alternatives |
| marcowki 414 | FIT | `014` SUPPORTED | 2 of 6 | none | none (`01/`) |
| dom-w-modrzykach 426 | HELD_BACK | `016` AMBIGUOUS | merged rank 21 | none | observed `016`, alt `416` |

willa 415 is a **regression against the 005D bounded set on a FIT label**: 005D handed the truth to the metric as an alternative; HEAD records nothing. Corpora (3–4-digit labels): 6/160 (5001) and 1/160 (9017) truths in the lattice behind an unvalued as-read — four leading-zero reads (`4845→0805`, `494→094`, `465→065`, `4708→0708`) and three five-cell reads (`4081→01181`, `4646→41106`, `4433→00133`); 3 of them were in 005D's bounded set (`494`, `465`, `4708`). It is generic: `4→0` is the most frequent misread in the README's own confusion table (61 times). Matrix (m2, 3642 lattices): 248 leading-zero as-reads, 118 unvalued lattices that hold a valued sequence — all invisible to the metric.

**Re-solve leak, observed at HEAD.** dom-w-modrzykach (HELD_BACK), selected frame `…6827e718fe`, REPLACED STRONG: token `551` (a 73×74 px blob), lattice LOW_QUALITY, as-read `55,`, no observation — yet its re-read chain gives a 91 px span **CHAIN_CORRECTED 251**, a value absent from its lattice, taken from the 005D list. It is the only such segment among 14 lattice-backed CHAIN_CORRECTED segments on re-read chains in m2 (13 come from `correctionReadings`).

**Impact.** No matrix scale changes (a leading-zero ink is never decisive, in 005D or 005E), and on these three rows the truth does not fit the span 005D bound the label to at the HEAD scale, so no selected value would change here either. What is lost is brief §28's core success metric for a generic misread class — the observation, its alternatives, its SCALE_RANKED selection, the per-observation Evidence Pack events (07 still lists the lattice) — plus a re-solve path that bypasses M7 and the 8b8bd39 plausibility bound.

**Fix (generic).** (1) In `observationsOf`, when `asReadValueCm` is undefined but `parseNumber(lattice.asRead)` yields a LINEAR_DIMENSION (the leading-zero case — as 005D did with the raw text), keep the observation with that value, set `leadingZero` from `lattice.asRead` (`:461` reads the 005D text today), and attach `latticeAlternatives`; keep the early return only when the as-read does not parse at all. (2) `correctionReadings` never returns `undefined` for a lattice: return the plausible valued sequences (p ratio against the as-read's own p, which exists even when unvalued) or `[]`; `assignTokens` already treats `[]` as "no readings" (`supplied` is truthy, the token is skipped), so the 005D list is never mixed into a lattice ink. **Risk:** scales unaffected (non-decisive inks); `SINGLE_READING` orientation counts and observation sets change on rows with leading-zero inks (as in 005D); modrzykach loses the 251 segment — re-run that row and willa-miranda, kosacce-clean, marcowki.

## A5E-2 (P2) — the count bound is the binding loss stage, and it is not recorded

On production tokens 9 development truths are not in the lattice. Seven are cut by `sequences: 8` after being generated (0-based rank in the merged set 8, 10, 11, 12, 21, 29, and TARGET tunbergiach `274` at 8); one is a re-cut-only reading (dabecjach `490`, see §Round-4), one a segmentation loss (eoze `472`: a speck taken for a cell, the `2` merged away, LOW_QUALITY). The emitted 8 carry only 0.55–0.80 of the merged mass, so `mass: 0.95` rarely binds: on m2, 2431/3307 lattices end by COUNT, 535 by MASS, 690/766 AMBIGUOUS ones by COUNT. `asReadP` is renormalised over the emitted set (`:617–626`), so the class also depends on K.

Bound sweep (instrumented copy; "in lattice" on 3–4-digit corpus labels and production-token development labels):

| variant | C5001 (choose) | FIT (choose) | C9017 (check) | HELD_BACK (check) | TARGET (report) |
| --- | --- | --- | --- | --- | --- |
| shipped | 131/160 | 43/48 | 131/160 | 19/21 | 10/12 |
| K = 12 | 133 | 46 | 131 | 19 | 11 |
| K = 16 | 136 | 46 | 132 | 20 | 11 |
| re-cuts emit 1 non-top | 128 | 44 | 131 | 19 | 10 |
| segs 64, valleys 3 / seg-ratio 0.5 | 129–130 | 43 | 131–132 | 19 | 10 |
| glyph ratio 0.5, ≤ 6 per cell | 131 | 43 | 132 | 19 | 10 |

Segmentation and glyph bounds sit on a plateau; K is the only bound whose loosening raises recall, and the gain on calibration + FIT is not confirmed on the check sets at K = 12. **I do not propose moving K** (a larger set also widens AMBIGUOUS contests and CANDIDATE_CONSENSUS pairs). **Fix:** record the cut — merged count and the emitted share of the mass — per lattice, so a reviewer can see that an AMBIGUOUS ink's truth may lie past the cut; declare the count bound, not segmentation, as the leading development loss in the README. **Risk:** record-only; content hash changes.

## A5E-3 (P2) — "never more decisive than 005D" is not literal

README (contest row) and `contestValues`' comment (`:361–368`) say the 0.7 one-glyph test keeps the lattice from making an ink more decisive than 005D left it. The test runs on the **005E matcher's** glyph ratios (paired holes, small-counter fill move them) and on **emitted** sequences only. Inks reading the same value as 005D with at least one 005D V1 value (≥ 0.7) outside the 005E contest set (A5E-1's inks included): C5001 31/160, FIT 8/48, C9017 28/160, HELD_BACK 6/21, TARGET 2/12. Truth among the dropped values outside A5E-1: corpus `142` (read `147`, p ratio 0.45, fails the one-glyph test on the 005E glyphs) and `932` (read `952`); none on development labels. Most dropped values are wrong, so this also removes spurious contests. **Fix:** either take the union with `boundedValues(token)` when the as-read equals the 005D reading (literally "never more decisive than 005D"), or reword the claim to "than the 005E matcher's runner-up". **Risk:** the union re-adds contests → possible INCONCLUSIVE on rows that 005E made decisive; needs the full matrix.

## A5E-4 (P2) — truncation accounting

`numeric-lattice.ts:616` sets `FLOOR` only when `ordered.length > emitted.length` with no break — impossible, since an unbroken loop emits all of `ordered` (0 of 3642 matrix lattices say FLOOR). Beam-width drops, beam-floor drops (`:445–447`), the re-cut text caps (`:579`) and the 16-segmentation cap (`:339, :349`) are never recorded: 3 of 18 corpus/development lattices reported `NONE` had floor drops. The as-read entry appended after a COUNT break (`:615`) makes 9 sequences on 116 m2 lattices, while `LATTICE_BOUNDS`, the README and METRIC_EVIDENCE say eight (`latticeAlternatives: 8` therefore never binds). **Fix:** record counts (`beamWidthDrops`, `beamFloorDrops`, `recutTextsCapped`, `segmentationsCapped`) or make `truncatedBy` a set; state "8, plus the as-read string". **Risk:** none on decisions.

## A5E-5 (P2) — calibration and comment text

- `.cache/e5/dev-lattice.ts:22` takes the raw token of largest overlap, which for two FIT labels is a page-sized pseudo-token: rarytasy-g2e `627` (box 448–699 × 70–228, reads `-144` LOW_QUALITY; production's token reads `627` SUPPORTED, rank 0) and rarytasy-eoze `472` (a one-glyph `2`; production reads `°47`). The FIT "LOW_QUALITY 0/2" cell is these two artefacts. On production tokens: FIT as read 21/48, top-3 34, in lattice 43; SUPPORTED 12/21, LOW_QUALITY 0/1; ALL 42/59/72 of 81.
- `.cache/e5/calib-tables.ts:17` computes "005D one-sub" as any single substitution of `readingLattice` (any runner > 0.2), not "one glyph away at a runner ratio ≥ 0.7" as the README defines it: by the stated definition 108 and 110 of 240, not 126 and 128 (the table understates 005E's gain).
- `numeric-lattice.ts:23` and `:150` say the as-read string is the DEFAULT anchor's; the code takes the best-segScore anchor that states a value (`:585–593`). `:76–77` cites AUC 0.85 vs 0.72; the README measures 0.746 vs 0.646.
- `metric-solution.ts:1200` says UNRESOLVED needs "two values of different length"; the code (`:1219`) and the contract (M6, "two fitting candidates within an image ratio of 0.90") use any two values; the comment should follow the contract. This is what leaves dabecjach `1340` UNRESOLVED (below).

## Round-4 houses at HEAD (m2; brief point 2)

| house | label (span px) | lattice as-read, class | truth rank | metric at HEAD |
| --- | --- | --- | --- | --- |
| dabecjach | 1580 (562) | `1580` SUPPORTED | 0 | ACCEPTED, AS_READ (005D read `1501`) |
| dabecjach | 1340 (476) | `1300` AMBIGUOUS | 5 of 8 | REJECTED; 1340 in `valueAlternatives`, fits the chosen scale with the best image score, but `1341` fits too at 0.966 → UNRESOLVED |
| dabecjach | 888 / 850 / 692 / 304 | as printed, SUPPORTED | 0 | ACCEPTED, AS_READ (005D: 810, 643 wrong) |
| dabecjach | 490 (174) | `420` AMBIGUOUS | absent | REJECTED; truth only on a DEFAULT re-cut needing 1 non-top glyph; it would fit the chosen scale (174.1 px) |
| tunbergiach | 1173 (560) | `1171` AMBIGUOUS | 4 of 8 | ACCEPTED; in `valueAlternatives`; `1171` fits within tolerance, so AS_READ (2 cm off) |
| tunbergiach | 1000 (478) | `1000` SUPPORTED | 0 | ACCEPTED, AS_READ, decides |
| tunbergiach | 130 / 280 / 274 | `150` / `280` / `270` | 3 / 0 / absent (count cut, rank 8) | spans do not fit any value (binding, not OCR) |

Both scales are now right: dabecjach 2.8113/2.8140 cm/px (1580/562 = 2.811; the false 2.673 agreement is gone — 1580 and 850 are read as printed), tunbergiach 2.0911/2.0921 (1173/560 = 2.095, 1000/478 = 2.092). dabecjach still fails at BOUNDARY_RESOLUTION, outside the metric. The two absent truths are a re-cut-only reading (the "recut 1 non-top" variant loses 3 calibration labels, so it is not justified) and the count bound (A5E-2); both are honestly unresolved.

## Brief points 1, 3, 4, 5 — what I checked and found sound

- **Tables reproduce at HEAD.** Corpora: 005D top-1 77/81, as read 128/121, top-1 128/128, top-3 169/171, top-5 184/183, top-8 189/187 — exactly the README. Development (README token choice): every cell of the split table matches, including the class columns. Both reproduce bit for bit from the instrumented copy too.
- **Where truth is lost** (3–4-digit corpus labels, 29 + 29 losses): glyph ratio 8 + 11, re-cut top-only 6 + 7, count cut 8 + 3, segmentation count 3 + 6, per-cell 1 + 1, beam width/floor 1 + 0, beam non-top 1 + 0, re-cut text cap 1 + 1; concentrated in BROKEN, TOUCHING and TIGHT (declared). No corpus label is lost at the grammar; the one development label my diagnosis puts there (eoze `472`) is a misaligned segmentation, not the digit/sign rule. Every one of the 81 labels got a production lattice (none lost to `onDimensionLine` or the 2–6 glyph gate), and the DEFAULT anchor reproduces the reader's cell count on 561/561 tokens.
- **No lattice-level regression against 005D:** labels whose 005D bounded set (as read, or one glyph at ≥ 0.7) held the truth and the lattice does not: 0/81 development, 0/320 corpus. Downstream regressions are only those of A5E-1 (willa 415; corpus 494, 465, 4708) and A5E-3 (corpus 142, 932).
- **As-read rule.** Development (production tokens): 14 wrong→right, 1 right→wrong against the DEFAULT anchor (willa `1410`, as-read `1010`, truth rank 1, SCALE_RANKED 1410 at HEAD); 18 vs 0 against the 005D reader. Corpora: 76 vs 14 against DEFAULT (README holds), 104 vs 13 against 005D; on 3–4-digit labels 68 vs 4, and all 4 keep the truth at rank 1–2.
- **Determinism and cache.** MISS then HIT on the same ink: identical 240/240; a twin copy on one field: HIT identical to a fresh read 240/240. No consumer mutates the shallow-shared cached arrays. Map/Set iteration is insertion-ordered from fixed variant and hypothesis order; every sort has a total tie-break; `offer` keeps the first path on equal log-probability. Every loop is bounded (≤ 16 hypotheses, beam 16 × 4, max 591 expansions). The cache never hit on the matrix (0 HIT among the m1/m2 lattices), so the HIT path is exercised only by tests and this probe.
