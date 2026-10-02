# 005F numeric-reader calibration

Text facts only: counts, rates and bounds. No glyph, crop or raster from any publisher is in this directory or anywhere
in the repository. The development labels are 005E's (`../../analyzer-005e/calibration/development-labels.json`: 81
figures transcribed by eye from local crops kept outside the worktree, split FIT 48 / HELD_BACK 21 / TARGET 12); the
corpora are the synthetic stroke-face corpora of `synthetic-drawings/digit-corpus.ts`, seeds 5001 (calibration) and
9017 (held back), 240 labels each.

Every figure below that is called **final** was measured on the freeze candidate's lattice (`f64fda9`), on the tokens
production latticed and with the class production assigned — not replayed. The grid was replayed by post-review D over
the probabilities recorded at `d910212` (the lattice's values do not depend on the class bars).

## Policy

- The 005F lattice adds glyph-count hypotheses, counter-safe cuts and the ambiguity tail to 005E's machinery
  (`numeric-lattice.ts`: `COUNT_BOUNDS`, `TAIL_BOUNDS`), and moves two class bars (`OCR_CLASS_BOUNDS`).
- Bounds were chosen on the FIT labels and the calibration corpus and checked on HELD_BACK and the held-back corpus.
  TARGET is reported, never chosen on. The two round-5 blind houses (modrzewnicy and Morelach), whose misreads motivated
  the stage, are not in any split: they are development rows of the matrix, and their labels have no transcribed truth
  here.
- **Provenance, stated plainly.** Two bounds were placed with a motivating label in view, and the record says so where
  each is given: the style band's upper end (1.30) with modrzewnicy's condensed four-digit overall (1.40 at three cells),
  and — reverted — a SUPPORTED bar of 0.40 with Morelach's `642` read `602`.
- No bound names a house, a printed value or a published figure; the production guard
  (`tests/architecture/generalization.test.ts`) scans for them.
- Blind round 6 is the only clean check. A blind failure is reported, not patched.

## The class bars

| bar | 005E | 005F | why |
| --- | --- | --- | --- |
| `supportedP` | 0.35 | 0.35 | unchanged (0.40 was tried at `dd95020` and reverted at `d910212`, below) |
| `supportedMargin` | 0.3 | **0.5** | the next value may hold at most half the reading's probability |
| `clearP` | 0.6 | 0.6 | unchanged |
| `clearMargin` | 0.3 (inert: implied ≥ ⅓ at p ≥ 0.6) | **0.5** | one margin for both classes: a structural choice, not a fitted one |

**Why the margin moved.** Count hypotheses and counter-safe cuts concentrate an ink's probability on fewer values. At
005E's bars SUPPORTED precision fell on both fitting splits (FIT .647 → .563; corpus 5001 .667 → .627).

**Criterion.** The smallest margin, on the grid below, that brings SUPPORTED precision on FIT and on corpus 5001 back to
at least 005E's. SUPPORTED-only, because SUPPORTED is the weakest class that corroborates a scale: two SUPPORTED inks that
agree are two witnesses, and 005E's post-review C P0 was exactly a SUPPORTED coin toss. **The criterion is confounded**
(post-review D): counter-safe cuts moved five right FIT readings from SUPPORTED to CLEAR, which lowers SUPPORTED-only
precision without any harm. Judged on CLEAR+SUPPORTED precision, 005E's bars lose nothing on FIT (.708 ≥ .700) and under
one label on 5001 (.739 against .744), and a margin of 0.4 would already restore both.

**The grid** (D's replay at `d910212`, `clearMargin` = `supportedMargin`, `supportedP` 0.35; S = SUPPORTED right/total):

| margin | FIT S | HELD_BACK S | TARGET S | 5001 S | 9017 S |
| --- | --- | --- | --- | --- | --- |
| 0.30 (005E) | 9/16 .563 | 4/7 .571 | 2/3 | 52/83 .627 | 47/72 .653 |
| 0.40 | 9/15 .600 | 4/6 .667 | 2/2 | 44/72 .611 | 44/66 .667 |
| 0.45 | 9/15 .600 | 4/6 .667 | 2/2 | 42/65 .646 | 42/63 .667 |
| **0.50** | **9/13 .692** | 4/6 .667 | 1/1 | **38/57 .667** | 41/60 .683 |
| 0.55 | 9/13 .692 | 3/5 .600 | 1/1 | 35/51 .686 | 37/53 .698 |
| 0.60 | 8/12 .667 | 3/4 .750 | 0/0 | 30/43 .698 | 33/44 .750 |

0.45 fails both fitting splits; 0.55 passes with fewer right readings. `supportedP` was varied over 0.30–0.45: at
margin 0.5, 0.40 fails FIT (7/11 = .636 < .647) and 0.45 fails it too.

**The 0.40 bar, reverted.** `dd95020` raised `supportedP` to 0.40 for a label in no calibration split (Morelach's `642`
read `602`, p 0.382). Across all twenty matrix rows, the only difference between 0.40 and 0.35 was Morelach's metric
confidence — the signature of a bar fitted to one label. `d910212` reverted it on the criterion above.

## Final, per split (`f64fda9`)

| split | 005E code, 005E bars | 005F at `d910212` (D) | **005F final** |
| --- | --- | --- | --- |
| FIT (48) | C 3/3, S 11/17 (.647), C+S .700 | C 8/8, S 9/13 (.692), C+S .810 | C 8/8, **S 9/12 (.750)**, C+S 17/20 (.850) |
| HELD_BACK (21) | C 6/6, S 3/5, C+S .818 | C 6/6, S 4/6 (.667), C+S .833 | C 6/6, S 4/6 (.667), C+S 10/12 (.833) |
| TARGET (12, check only) | S 6/7, C+S .857 | C 4/4, S 1/1, C+S 5/5 | C 4/4, S 1/1, C+S 5/5 |
| corpus 5001 (240) | C 38/42, S 58/87 (.667), C+S 96/129 (.744) | C 48/51, S 39/58 (.672), C+S 87/109 (.798) | C 48/51, **S 38/57 (.667)**, C+S 86/108 (.796) |
| corpus 9017 (240) | C 42/44, S 55/80 (.6875), C+S 97/124 (.782) | C 55/58, S 41/60 (.683), C+S 96/118 (.814) | C 55/58, **S 40/59 (.678)**, C+S 95/117 (.812) |

(The `d910212` column is the shipped classes of that run; D's replay of the same run differs by one CLEAR/SUPPORTED label
on 5001.)

What moved from `d910212` to final, all by post-review A's count rules (`../post/resolution.md`):

- FIT: kosacce-clean `890`, read `840` (wrong), SUPPORTED → AMBIGUOUS (width doubt under the plan's style).
- corpus 5001: `686`, read right, SUPPORTED → AMBIGUOUS (the ink variants cut different counts).
- corpus 9017: `4245`, read right, SUPPORTED → AMBIGUOUS (the same rule).
- Nothing else on 81 development labels and 480 corpus labels.

## What the record must say

- **Knife edges.** Corpus 5001 is restored to *exactly* 005E's SUPPORTED precision (38/57 = 58/87 = 2/3): one more wrong
  SUPPORTED reading would fail the criterion. On FIT the bar sits just above two wrong readings (`1470` for `1474`, margin
  0.492; `805` for `845`, 0.488) and drops a right TARGET reading (tunbergiach `280`, 0.478, now AMBIGUOUS).
- **The held-back miss.** On the held-back corpus SUPPORTED precision is 40/59 = .678, below 005E's .6875: the check split
  misses the criterion the bar was chosen on, by under one label at `d910212` (41/60) and by one right reading more after
  post-review A's variant rule. The bar was not moved to recover it.
- **What it costs.** Right CLEAR+SUPPORTED readings fall 96 → 86 on 5001 and 97 → 95 on 9017; right SUPPORTED readings
  58 → 38 and 55 → 40. Right TARGET CLEAR+SUPPORTED 6 → 5.
- **`clearMargin` is no longer inert.** At 0.5 it costs one right CLEAR on each corpus against 0.3 (5001 50/55 → 49/52 at
  `d910212`; 9017 56/59 → 55/58).
- **Confident wrong-count readings remain**, all on touching labels and all counts the lattice did not raise (a declared
  limit, `METRIC_EVIDENCE.md`): 5001 `917` read `40` SUPPORTED and `49110` read `4950` SUPPORTED; 9017 `185` read `85`
  CLEAR and `191` read `54` SUPPORTED. The pre-implementation review projected 0 and 1.
- **Confident single-glyph misreads remain** at CLEAR: 5001 `781`→`761`, `165`→`155`, `708`→`705`; 9017 `587`→`567`,
  `185`→`85`, `980`→`480`. The class cannot see a misread the matcher is sure of (as in 005E).
- **Matrix consequences of the bars**, both explained by the rule and neither hidden: rarytasy-g2e CONFIRMED STRONG →
  WEAK (its witness `1470`, a misread of 1474, falls from SUPPORTED at margin 0.492); dom-w-morelach CONFIRMED with
  INCONCLUSIVE confidence (`602`, a misread, holds p 0.38 under the 005F count machinery, is SUPPORTED, and stands as a
  better-class rival for a wrong scale). Morelach's model, scale and PASS are unchanged by the bars.

## The count bounds

`COUNT_BOUNDS` (post-review D's ±20 % on each, over the 81 development labels and both corpora,
`../post/overfit-generalization-review.md` D5F-4):

| bound | value | chosen on | ±20 % |
| --- | --- | --- | --- |
| `styleBand` | 0.75–1.30 of the style | development true counts 0.81–1.17; the upper end placed with round 5's condensed overall (1.40 at three cells) in view | upper +20 %: that overall is no longer re-counted; lower −20 %: FIT loses 2 right readings; the development labels alone admit any upper end from 1.17 to above 1.56 |
| `styleCapRatio`, `styleSamples`, `sampleBand` | 1.25; 8; 0.35–0.80 | FIT | `styleCapRatio` +20 %: the round-5 overall is no longer re-counted; the rest inert on the development labels |
| `noStyleBand`, `noStyleCentre` | 0.40–0.70; 0.49 | development 0.405–0.576, corpus 0.446–0.667 | classes and count alternatives only on the corpora, never an as-read value |
| `addDepth`, `counterHeight`, `counterPersist`, `countRivalP` | 0.35; 0.20; 0.5; 0.1 | FIT, calibration corpus | the same |
| segmentation and cell caps | 16 / 48 / 144; 96 cells | bounds on work | inert; the per-variant and per-ink caps cannot bind and the cell cap bounds the hypotheses, not the ink (`METRIC_EVIDENCE.md`) |
| `TAIL_BOUNDS` | 2 substitutions, ratio 0.7, share 0.2, 2 per ink | pre-review B | inert: no decision reads the tail |

The count rules that are not bounds — a decisive count only on a split, a count no variant's reader cut is AMBIGUOUS,
variants disagreeing on the count are AMBIGUOUS, width doubt under the style without gates — are post-review A's, a priori,
and measured above.
