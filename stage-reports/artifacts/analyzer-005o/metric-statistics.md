# 005O — metric statistics (label level, then house level)

Statements with a blind double-transcription truth: **782** in **38** families (excluded: {'truth_AGREED_NOT_INTEGER': 3, 'truth_NOT_A_LABEL': 129, 'truth_UNCERTAIN': 18}). Intervals: 95 %, family-cluster bootstrap (10 000, seed 5050) unless marked Wilson.

## Readers on the same statements (what each would state as printed)

| reader | stated | correct | wrong | exact (of all) | wrong when stated (Wilson 95 %) | exact, family-cluster 95 % |
| --- | --- | --- | --- | --- | --- | --- |
| ensemble reading (readingOf) | 581 | 476 | 105 | 0.6087 | 0.1807 [0.1516, 0.2141] | [0.5399, 0.6757] |
| PP-OCRv6 corroborating (ensemble rule) | 507 | 507 | 0 | 0.6483 | 0.0 [0.0, 0.0075] | [0.5786, 0.7173] |
| PP-OCRv6 top value | 571 | 543 | 28 | 0.6944 | 0.049 [0.0341, 0.07] | [0.618, 0.7665] |
| numeric lattice asRead | 570 | 224 | 346 | 0.2864 | 0.607 [0.5663, 0.6463] | [0.2371, 0.343] |
| lattice, CLEAR/SUPPORTED only | 180 | 133 | 47 | 0.1701 | 0.2611 [0.2024, 0.3298] | [0.1325, 0.2144] |
| classic token text (the incumbent as-printed source) | 706 | 321 | 385 | 0.4105 | 0.5453 [0.5084, 0.5817] | [0.3592, 0.4675] |
| statement value (after chain correction) | 782 | 355 | 427 | 0.454 | 0.546 [0.511, 0.5806] | [0.3998, 0.5128] |

TOP-K candidate recall at the first lattice/ensemble (truth among token, its alternatives, lattice paths, lattice asRead, PP-OCR top 5): **654/782 = 0.8363**.
Binding (truth / span within 3 % of the frame's transcription scale): {'CONSISTENT': 348, 'INCONSISTENT': 102, 'UNKNOWN_SCALE': 332} (frames with a true scale 67 of 186).

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

### By publisher group (WRONG stated, frozen → M1 → M3)

| group | n | frozen | M1 | M3 | M1P |
| --- | --- | --- | --- | --- | --- |
| ARCHON (incl. projektydomownowoczesnych alt-marcowki) | 752 | 357 | 107 | 97 | 107 |
| DobreDomy | 30 | 15 | 15 | 11 | 15 |

## House level (44 cases, solver-only replays; scale tolerance 3 %, fixed in advance)

| variant | completed | refused | verdict PASS | completed at a CORRECT scale | completed, truth scale unknown | FALSE_CONFIDENT_SCALE | changed vs M0 | known-good (M0 PASS) changed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M0 | 22 | 22 | 18 | 16 | 6 | 0 | 0 | 0 |
| M0X | 22 | 22 | 18 | 16 | 6 | 0 | 0 | 0 |
| M1 | 23 | 21 | 18 | 16 | 7 | 0 | 2 | 0 |
| M1P | 23 | 21 | 18 | 16 | 7 | 0 | 2 | 0 |
| M1b | 23 | 21 | 18 | 16 | 7 | 0 | 2 | 0 |
| M2 | 22 | 22 | 18 | 16 | 6 | 0 | 0 | 0 |
| M3 | 23 | 21 | 18 | 16 | 7 | 0 | 2 | 0 |
| M3b | 23 | 21 | 18 | 16 | 7 | 0 | 2 | 0 |

Families: kosacce 69, rarytasy 62, marcowki 38, dom-w-dabecjach 36, dom-w-jablonkach 29, willa-miranda 28, A04 28, A05 28, dom-w-zurawkach 27, A00 27, dom-w-glogownikach 27, dom-w-modrzykach 25 … (rows of one design are one cluster).

No fresh blind draw was made: every case is development material (blind rounds 9 and 10 are revealed). These are development statistics, not a generalization claim.
