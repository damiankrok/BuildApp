# 005E OCR candidates and scale witnesses — the round-4 blind houses, before and after

Generated from the run records (`metric-evidence.json`) of the selected plan copy: numbers only, no glyph pixels. "005D read"
is the 005D reader's top reading; "as read" is the lattice's image-only reading; "other values" are the lattice's next sequences
with their image probability. Before: 005D code (`d8ba4e8`, the analyzer as frozen at `PRE_HOLDOUT_4_SHA`) on the sealed
package, whose pack has no divergence from the committed blind pack. After: `ebd64eb` (development matrix m3).

### dom-w-dabecjach, 005D (frozen PRE_HOLDOUT_4_SHA code): selected copy `frame-asset-rzut-1a56066c62-10b0ec4131` — CONFIRMED/STRONG, 2.672148 cm/px (page vote 2.67336)

OCR candidates (the longest spans; values as read by the image only):

| ink | axis | span px | 005D read | as read | class | p | other values (p) | selected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 92d6d0a0b9 | X | 562 | 1501 | 1501 | – | – | – | – |
| 90625e734a | Y | 476 | 1700 | 1700 | – | – | 1300, 1740, 1100, 1200 | – |
| b6c367b1b3 | X | 316 | 888 | 888 | – | – | 808, 880 | – |
| dcab3c0989 | Y | 302 | 810 | 810 | – | – | 850, 830 | – |
| c88c7af282 | X | 246 | 643 | 643 | – | – | 641, 642, 645 | – |
| c6bbf51f75 | Y | 174 | 141 | 141 | – | – | – | – |
| 5a7e5b7de1 | Y | 108.5 | 305 | 305 | – | – | 105, 505, 302, 303 | – |

Scale hypotheses and their witnesses:

| hypothesis | cm/px | groups | longest share | corroborated | both axes | witnesses (as read / span px / class) |
| --- | --- | --- | --- | --- | --- | --- |
| **selected** | 2.672314 | 2 | 1 | true | true | 131/48/– (orientation_by_other_axis); 144/53.5/– (orientation_by_other_axis); 1501/562/–; 311/118/–; 810/302/– |
| rival | 3.571429 | 1 | 0.814371 | false | false | 1700/476/– |
| rival | 2.810127 | 1 | 0.562278 | false | false | 131/48/– (orientation_by_other_axis); 888/316/– |
| rival | 0.810345 | 1 | 0.29769 | false | false | 017/23/– (orientation_by_other_axis); 12/14/– (orientation_by_other_axis); 141/174/– |
| rival | 0.517949 | 0 | 0 | false | false | 101/195/– (orientation_undecided) |

OCR in the decision: null; false consensus: none; structural reconciliations: 0.

Why: the page vote's 2.67336 cm/px is confirmed by readings that owe nothing to it: 2.672314 cm/px, stated by 2 independent readings on 2 chain(s); a rival scale has 54% of its independent support (STRONG)

### dom-w-dabecjach, 005E (`ebd64eb`): selected copy `frame-asset-rzut-1a56066c62-10b0ec4131` — REPLACED/STRONG, 2.811318 cm/px (page vote 2.67336)

OCR candidates (the longest spans; values as read by the image only):

| ink | axis | span px | 005D read | as read | class | p | other values (p) | selected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 92d6d0a0b9 | X | 562 | 1501 | 1580 | SUPPORTED | 0.40 | 1581 (0.25), 1180 (0.15), 1510 (0.07), 1501 (0.05), 1480 (0.03) | AS_READ 1580 |
| 90625e734a | Y | 476 | 1700 | 1300 | AMBIGUOUS | 0.30 | 1700 (0.26), 1741 (0.10), 1740 (0.07), 1341 (0.07), 1340 (0.07) | AS_READ 1300 |
| b6c367b1b3 | X | 316 | 888 | 888 | SUPPORTED | 0.40 | 818 (0.11), 881 (0.11), 848 (0.10), 884 (0.10), 618 (0.06) | AS_READ 888 |
| dcab3c0989 | Y | 302 | 810 | 850 | SUPPORTED | 0.43 | 810 (0.22), 831 (0.10), 851 (0.08), 871 (0.07), 821 (0.05) | AS_READ 850 |
| c88c7af282 | X | 246 | 643 | 692 | AMBIGUOUS | 0.40 | 643 (0.16), 641 (0.10), 612 (0.08), 642 (0.07), 645 (0.07) | AS_READ 692 |
| c6bbf51f75 | Y | 174 | 141 | 420 | AMBIGUOUS | 0.17 | 440 (0.17), 141 (0.16), 470 (0.11), 441 (0.10), 140 (0.10) | AS_READ 420 |
| 5a7e5b7de1 | Y | 108.5 | 30/ | 304 | SUPPORTED | 0.35 | 104 (0.16), 704 (0.12), 700 (0.11), 300 (0.09), 100 (0.07) | AS_READ 304 |

Scale hypotheses and their witnesses:

| hypothesis | cm/px | groups | longest share | corroborated | both axes | witnesses (as read / span px / class) |
| --- | --- | --- | --- | --- | --- | --- |
| **selected** | 2.811617 | 5 | 1 | true | true | 1580/562/SUPPORTED; 304/108.5/SUPPORTED; 692/246/AMBIGUOUS; 850/302/SUPPORTED; 888/316/SUPPORTED |
| rival | 2.413793 | 1 | 0.29769 | false | false | 121/48/AMBIGUOUS (orientation_undecided); 420/174/AMBIGUOUS |
| rival | 2.568694 | 0 | 0 | false | false | 501/195/AMBIGUOUS (orientation_undecided); 121/48/AMBIGUOUS (orientation_undecided) |
| rival | 3.737601 | 0 | 0 | false | false | 121/34/AMBIGUOUS (orientation_undecided); 194/53.5/AMBIGUOUS (orientation_by_other_axis); 355/94/SUPPORTED |
| rival | 6.691832 | 0 | 0 | false | false | 312/46.5/AMBIGUOUS; 592/88.5/SUPPORTED |

OCR in the decision: {"contestedObservationIds":["dim-obs-30-rotated-cw-26a815f5d7"],"counted":{"ambiguous":1,"clear":0,"supported":4,"unrated":0},"demotedObservationIds":["dim-obs-643-horizontal-0c6b5e00c8"],"lowQuality":0}; false consensus: none; structural reconciliations: 0.

Why: the page vote's 2.67336 cm/px rested on 0 independent readings; 2.811617 cm/px, stated by 5 independent readings on 3 chain(s) outweigh it; a rival scale has 12% of its independent support (STRONG)

### dom-w-tunbergiach, 005D (frozen PRE_HOLDOUT_4_SHA code): selected copy `frame-asset-rzut-83377e8ffc-c1a88b7f25` — LEGACY_UNCONFIRMED/INCONCLUSIVE, 1.994682 cm/px (page vote 1.994682)

OCR candidates (the longest spans; values as read by the image only):

| ink | axis | span px | 005D read | as read | class | p | other values (p) | selected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| f54c4a807c | X | 560 | 1117 | 1117 | – | – | 1177, 1113, 1115, 1137 | – |
| cc09597b26 | Y | 478 | 1000 | 1000 | – | – | – | – |
| b67728d5f0 | X | 142 | 50 | 50 | – | – | – | – |
| b70fedc985 | Y | 78.5 | 150 | 150 | – | – | 110, 130, 120 | – |
| 8daf754383 | Y | 59 | 280 | 280 | – | – | 180, 780, 380, 200 | – |

Scale hypotheses and their witnesses:

| hypothesis | cm/px | groups | longest share | corroborated | both axes | witnesses (as read / span px / class) |
| --- | --- | --- | --- | --- | --- | --- |
| **selected** | 2.09205 | 1 | 1 | false | false | 1000/478/–; 226/109/– |
| rival | 1.994643 | 1 | 1 | false | false | 1117/560/– |
| rival | 0.352113 | 1 | 0.253571 | false | false | 50/142/– |
| rival | 1.910828 | 1 | 0.164226 | false | false | 150/78.5/– |
| rival | 4.745763 | 1 | 0.123431 | false | false | 280/59/– |

OCR in the decision: null; false consensus: none; structural reconciliations: 0.

Why: the page vote's 1.994682 cm/px is kept on 1 independent reading; the strongest alternative, 2.09205 cm/px, stated by 1 independent reading on 1 chain(s), does not outweigh it twice over (INCONCLUSIVE)

### dom-w-tunbergiach, 005E (`ebd64eb`): selected copy `frame-asset-rzut-83377e8ffc-c1a88b7f25` — REPLACED/WEAK, 2.091071 cm/px (page vote 1.994682)

OCR candidates (the longest spans; values as read by the image only):

| ink | axis | span px | 005D read | as read | class | p | other values (p) | selected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| f54c4a807c | X | 560 | 1117 | 1171 | AMBIGUOUS | 0.20 | 1177 (0.22), 1175 (0.13), 1117 (0.12), 1173 (0.10), 1151 (0.10) | AS_READ 1171 |
| cc09597b26 | Y | 478 | 1000 | 1000 | SUPPORTED | 0.58 | 1010 (0.19), 1001 (0.18), 1031 (0.05) | AS_READ 1000 |
| b67728d5f0 | X | 142 | 50 | 270 | AMBIGUOUS | 0.33 | 110 (0.20), 210 (0.15), 230 (0.09), 50 (0.07), 170 (0.06) | AS_READ 270 |
| b70fedc985 | Y | 78.5 | 150 | 150 | SUPPORTED | 0.35 | 110 (0.22), 120 (0.13), 130 (0.13), 131 (0.10), 151 (0.07) | AS_READ 150 |
| 8daf754383 | Y | 59 | 280 | 280 | SUPPORTED | 0.40 | 180 (0.21), 281 (0.14), 780 (0.13), 380 (0.06), 200 (0.03) | AS_READ 280 |

Scale hypotheses and their witnesses:

| hypothesis | cm/px | groups | longest share | corroborated | both axes | witnesses (as read / span px / class) |
| --- | --- | --- | --- | --- | --- | --- |
| **selected** | 2.091504 | 2 | 1 | true | true | 1000/478/SUPPORTED; 1171/560/AMBIGUOUS; 226/109/SUPPORTED |
| rival | 1.903174 | 2 | 0.253571 | false | false | 150/78.5/SUPPORTED; 270/142/AMBIGUOUS |
| rival | 4.745763 | 1 | 0.123431 | false | false | 280/59/SUPPORTED |
| rival | 2.370815 | 0 | 0 | false | false | 150/63.5/SUPPORTED; 226/96/SUPPORTED; 270/113.5/AMBIGUOUS |
| rival | 1.310044 | 0 | 0 | false | false | 150/114.5/SUPPORTED |

OCR in the decision: {"contestedObservationIds":["dim-obs-1117-horizontal-2393904141"],"counted":{"ambiguous":1,"clear":0,"supported":1,"unrated":0},"demotedObservationIds":["dim-obs-1117-horizontal-2393904141"],"lowQuality":0}; false consensus: none; structural reconciliations: 0.

Why: the page vote's 1.994682 cm/px rested on 0 independent readings; 2.091504 cm/px, stated by 2 independent readings on 2 chain(s) outweigh it; a rival scale has 16% of its independent support (WEAK)

