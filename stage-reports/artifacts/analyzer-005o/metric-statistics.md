# 005O — metric statistics (label level, then house level)

Statements with a blind double-transcription truth: **782** in **38** families (excluded: {'truth_AGREED_NOT_INTEGER': 3, 'truth_NOT_A_LABEL': 129, 'truth_UNCERTAIN': 18}). Intervals: 95 %, family-cluster bootstrap (10 000, seed 5050) unless marked Wilson.

## Readers on the same statements (what each would state as printed)

| reader | stated | correct | wrong | exact (of all) | wrong when stated (Wilson 95 %) | exact, family-cluster 95 % |
| --- | --- | --- | --- | --- | --- | --- |
| ensemble reading (readingOf) | 581 | 476 | 105 | 0.6087 | 0.1807 [0.1516, 0.2141] | [0.5399, 0.6757] |
| PP-OCRv6 corroborating (ensemble rule) | 507 | 507 | 0 | 0.6483 | 0.0 [0.0, 0.0075] | [0.5786, 0.7173] |
| PP-OCRv6 top value | 571 | 543 | 28 | 0.6944 | 0.049 [0.0341, 0.07] | [0.618, 0.7665] |
| **frozen as-printed value** (what plan resolution reads: CHAIN_CORRECTED → token text, READ → the statement value) | 670 | 298 | 372 | 0.3811 | 0.5552 [0.5174, 0.5924] | [0.3354, 0.4333] |
| numeric lattice asRead | 570 | 224 | 346 | 0.2864 | 0.607 [0.5663, 0.6463] | [0.2371, 0.343] |
| lattice, CLEAR/SUPPORTED only | 180 | 133 | 47 | 0.1701 | 0.2611 [0.2024, 0.3298] | [0.1325, 0.2144] |
| TOKEN candidate (token text for CHAIN_CORRECTED, statement value for READ) | 706 | 321 | 385 | 0.4105 | 0.5453 [0.5084, 0.5817] | [0.3592, 0.4675] |
| classic token text (`ocrTokens[].text`, literal) | 682 | 211 | 471 | 0.2698 | 0.6906 [0.6549, 0.7242] | [0.2283, 0.3133] |
| statement value (after chain correction) | 782 | 355 | 427 | 0.454 | 0.546 [0.511, 0.5806] | [0.3998, 0.5128] |

Sensitivity, de-duplicated (same drawing repeated on another frame at the same span, and the two second-pipeline legacy rows, removed): n = 608.

| reader | stated | wrong | wrong when stated (Wilson 95 %) |
| --- | --- | --- | --- |
| **frozen as-printed value** (what plan resolution reads: CHAIN_CORRECTED → token text, READ → the statement value) | 521 | 309 | 0.5931 [0.5504, 0.6344] |
| classic token text (`ocrTokens[].text`, literal) | 532 | 378 | 0.7105 [0.6706, 0.7474] |
| PP-OCRv6 corroborating (ensemble rule) | 395 | 0 | 0.0 [-0.0, 0.0096] |
| PP-OCRv6 top value | 453 | 28 | 0.0618 [0.0431, 0.0879] |
| lattice, CLEAR/SUPPORTED only | 120 | 35 | 0.2917 [0.2178, 0.3784] |

TOP-K candidate recall at the first lattice/ensemble (truth among token, its alternatives, lattice paths, lattice asRead, PP-OCR top 5): **654/782 = 0.8363**.
Binding (truth / span within 3 % of the frame's transcription scale): {'CONSISTENT': 348, 'INCONSISTENT': 102, 'UNKNOWN_SCALE': 332} (frames with a true scale 69 of 196).

## As-printed outcome per variant (paired with the frozen view)

| variant | CORRECT | ABSTAIN | WRONG (stated wrong) | WRONG − frozen WRONG, per statement | family-cluster 95 % of that delta | CORRECT lost | WRONG→CORRECT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| frozen (M0) | 298 | 112 | 372 | — | — | — | — |
| M1 | 297 | 363 | 122 | -0.3197 | [-0.3706, -0.2726] | 1 | 0 |
| M2 | 278 | 172 | 332 | -0.0512 | [-0.0738, -0.0285] | 25 | 5 |
| M3 | 293 | 381 | 108 | -0.3376 | [-0.3855, -0.2911] | 22 | 11 |
| M1P | 464 | 196 | 122 | -0.3197 | [-0.3706, -0.2726] | 1 | 165 |
| M1b | 297 | 363 | 122 | -0.3197 | [-0.3706, -0.2726] | 1 | 0 |
| M3b | 293 | 381 | 108 | -0.3376 | [-0.3855, -0.2911] | 22 | 11 |

`zero` list (what `latticeScales` and the isotropy gates read) per variant, WRONG stated: M1 125, M2 342, M3 111, M1P 125, M1b 125, M3b 111.

### By publisher group (WRONG stated, frozen → M1 → M3)

| group | n | frozen | M1 | M3 | M1P |
| --- | --- | --- | --- | --- | --- |
| ARCHON (incl. projektydomownowoczesnych alt-marcowki) | 752 | 357 | 107 | 97 | 107 |
| DobreDomy | 30 | 15 | 15 | 11 | 15 |

## House level (44 cases, solver-only replays; scale tolerance 3 %, fixed in advance)

| variant | completed | refused | verdict PASS | completed at a CORRECT scale | completed, truth scale unknown | FALSE_CONFIDENT_SCALE | outcome/model changed vs M0 | plan semantics changed | decision path changed (ranking, conflict trigger, refusal reason) | known-good (M0 PASS) changed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M0 | 22 | 22 | 18 | 17 | 5 | 0 | 0 | 0 | 0 | 0 |
| M0X | 22 | 22 | 18 | 17 | 5 | 0 | 0 | 0 | 0 | 0 |
| M1 | 23 | 21 | 18 | 17 | 6 | 0 | 2 | 2 | 5 | 0 |
| M1P | 23 | 21 | 18 | 17 | 6 | 0 | 2 | 2 | 5 | 0 |
| M1b | 23 | 21 | 18 | 17 | 6 | 0 | 2 | 2 | 5 | 0 |
| M2 | 22 | 22 | 18 | 17 | 5 | 0 | 0 | 0 | 1 | 0 |
| M3 | 23 | 21 | 18 | 17 | 6 | 0 | 2 | 2 | 6 | 0 |
| M3b | 23 | 21 | 18 | 17 | 6 | 0 | 2 | 2 | 6 | 0 |

Rows whose decision path or semantics changed (variant: case):

- `dom-pod-jarzabem` (M0 COMPLETED ALGORITHMIC_FAIL): M1 outcome/model semantics path; M3 outcome/model semantics path; M1P outcome/model semantics path; M1b outcome/model semantics path; M3b outcome/model semantics path
- `rarytasy-eoze` (M0 COMPLETED PASS): M1  path; M3  path; M1P  path; M1b  path; M3b  path
- `dom-pod-milorzebem` (M0 FAILED ALGORITHMIC_FAIL): M1  path; M3  path; M1P  path; M1b  path; M3b  path
- `kosacce-area-alone` (M0 FAILED ALGORITHMIC_FAIL): M2  path; M3  path; M3b  path
- `dom-w-glogownikach` (M0 FAILED ALGORITHMIC_FAIL): M1 outcome/model semantics path; M3 outcome/model semantics path; M1P outcome/model semantics path; M1b outcome/model semantics path; M3b outcome/model semantics path
- `dom-w-akebiach` (M0 FAILED ALGORITHMIC_FAIL): M1  path; M3  path; M1P  path; M1b  path; M3b  path

Families: kosacce 69, rarytasy 62, marcowki 38, dom-w-dabecjach 36, dom-w-jablonkach 29, willa-miranda 28, A04 28, A05 28, dom-w-zurawkach 27, A00 27, dom-w-glogownikach 27, dom-w-modrzykach 25 … (rows of one design are one cluster).

No fresh blind draw was made: every case is development material (blind rounds 9 and 10 are revealed). These are development statistics, not a generalization claim.
