# 005F pre-review B — the OCR beam and weak alternatives (a bounded ambiguity tail)

Question: how can a truth that needs two moderate alternate glyphs survive without lowering `LATTICE_BOUNDS.floor` (0.01)
or the count bound (8 sequences / mass 0.95)? Read-only; scratch in `.cache/pre-b5f/` (probes `dump-common.ts`,
`dev-dump.ts`, `corpus-dump.ts`, `ink-dump.ts`, `recount*.ts`; offline beam `sim.mjs`). Method: every label latticed
twice — shipped bounds (the record) and with every admitted glyph kept (glyphRatio 0, perCell 10) — then the shipped
beam/merge/emission re-simulated offline. **The simulation reproduces the shipped lattice exactly on 562 labels**
(81 development, 240 + 240 corpus, the `1950` ink: same texts, same p to 4 dp, same merged count, same class).

## 1. Findings

**P0-1 — `1950` is lost at the COUNT bound, not at the floor; the floor, width and non-top bounds lose no truth.**
`1950` is *merged* (rank 10 of 18, 0.0663 of the best) through the SAUVOLA anchor and cut by the eight-value bound
(emitted mass 0.857, `truncatedBy COUNT`). The floor drops it only inside the DEFAULT (0.0074) and STRICT (0.0051)
anchors, which is irrelevant: the merge takes the best path. Width 16 and non-top 2 never bind on it (0 width cuts,
0 non-top cuts, 123 expansions). Over 561 labels the floor is never the sole cause of a lost truth; floor 0.01→0.001,
width 16→64 and non-top 2→3 each recover **0** truths (dev 72/81, corpus 189/240, 187/240 unchanged). The CONTEXT's
"joint ≈ 0.005 under the floor" is the STRICT anchor's figure (`9` 0.656 / p 0.041, `5` 0.709 / p 0.080). Do not touch
floor, width or non-top; the only bound that loses development truths is the count (7 of 9 dev losses, as 005E's
post-review A found).

**P0-2 — under the protections asked for, no tail can flip the modrzewnicy refusal; expect nothing from it there.**
The refusal has no right as-read witness (`2590`→`140` LOW_QUALITY: a count error, A's domain; `1000` UNCENTRED on
28 px). Even with `2590` read right (4.003 cm/px on 647 px), `1410` stays a stable SUPPORTED witness of 2.895 on the
same pair of chains (1 vs 1 → `undecidedConflict`, INCONCLUSIVE). The only thing that would neutralise `1410` is `1950`
(1950/487 px = 4.004) in its `contestAlts` — exactly a tail contest-rescue, which must stay forbidden. M5 cannot do it
either: `600` is AMBIGUOUS (M5 needs SUPPORTED children) and 1950 (cost 2) + 640 (cost 1) exceeds M5's cost bound 2.
What rescues this house is as-read evidence (A's count for `2590`, a centred `1000`), not the beam.

**P0-3 — on a condensed face the 005E class is not calibrated, and no count cap repairs it; `1410` is typical.**
The coordinator's new `condense` option at 0.65 (seeds 5001/9017, 480 labels, same strata): CLEAR is right **1 of 9**,
SUPPORTED **3 of 62**. Of the 67 wrong CLEAR/SUPPORTED readings 28 read too *few* glyphs (the `2590`→`140` kind) and
39 a wrong glyph (the `1410` kind). A geometric count flag catches none of the 8 wrong CLEARs at pitch 0.50 vs 0.60 h,
and 2 at 0.40 vs 0.60 h — which also flags 66 of the 86 ordinary-face CLEARs (62 right). Value truths emitted: 37/160
on both seeds (GLYPH_COUNT 67 / 64, COUNT 19 / 21, FLOOR 5 / 3 — floor 0.001 recovers none, they fall to the count —
non-top 15 / 10). Whatever A changes, CLEAR/SUPPORTED precision must be re-measured on a condensed stratum before the
class gates corroboration (M3) there; the bars were fitted on ordinary-pitch faces.

**P1-1 — a tail with a per-glyph bar recovers few truths, but costs less than any global bound change.**
Bar of §3 (two non-top glyphs, each ratio ≥ 0.7 and share ≥ 0.2, ≤ 2 per ink): recovers dev **2 of 7** count losses
(`380` FIT, `430` HELD_BACK), corpus value truths **1 of 8** (5001) and **0 of 3** (9017), and **`1950`**; adds
**0.70 / 0.37 / 0.43** wrong values per ink on average (dev / 5001 / 9017), **at worst 2**, on 43 / 23 / 23 % of inks
(modrzewnicy page: 79 of 173 inks, 0.86 per ink, max 2). Raising the count to 10 recovers the same dev 2 + `1950`,
0 on the corpus, adds ~1.0 / 0.66 / 0.77 values per ink to *every* consumer and moves the classes (the class is
normalised over the emitted set): corpus CLEAR 38/42→37/41 and 42/44→40/42, dev SUPPORTED 20/29→19/27. Condensed
corpus: tail +4 / +2 of 160 value truths (count 10: +2 / +4; floor 0.001: +0 / +0) at 1.09 / 1.10 wrong values per ink
on ~60 % of inks — the tail grows exactly where the reader is weakest, so its exclusion (3.2) matters most there.

**P1-2 — every existing consumer of `sequences` must exclude the tail, and it must be structural, not a filter.**
If the tail were read like emitted alternatives, chance agreement on the dev decisive pairs rises: emitted (K,K)
36.6→40.4 %, correction set 25.1→29.6 %, contest set (K,1) 18.3→20.8 % (§4.3). Consumers today: `contestValues` (M2),
`latticeAlternatives`→`valueAlternatives` (`alts`, M4 `heldAlts` / CANDIDATE_CONSENSUS, the legacy-replacement
`doubted` guard, `valueAmbiguity`), `correctionReadings` (M7 chain re-solve → CHAIN_CORRECTED → `MetricEvidence`
alternatives → the resolver's `metricsAtScale` re-read; `plausible`→`altCost` for M5; the SCALE_RANKED allowed set),
the class normalisation (asReadP, margin, entropy, `sequenceMargin`), `extract.ts` serialisation, the evidence pack.

**P1-3 — the only legitimate use, SCALE_RANKED after a scale exists, is a coin toss at the last digit: keep it a
record.** At each label's true scale, among as-read misses with no emitted correction that fits, a unique tail fit is
right once and wrong once on dev (`430` right; `491` for `490`, 0.36 px), +1/+1 on 5001, 0/0 on 9017. SCALE_RANKED is
record-only today (`ocr.selected` is read only by the evidence pack); the tail must not enter the chain solver.

**P1-4 — count ambiguity: the template score cannot arbitrate a glyph count; cap CLEAR only, by A's geometric set.**
Emulated n±1 re-cuts of each run (deepest column near the uniform pitch, 005E matcher): the alternative-count segScore
over the as-read's is indistinguishable for right and wrong CLEAR/SUPPORTED readings (medians dev 0.89 vs 0.86; 5001
0.63 vs 0.64; 9017 0.63 vs 0.60). A score-based rule (ratio ≥ 0.7 ⇒ not CLEAR, ≥ 0.9 ⇒ AMBIGUOUS) demotes 5 of the 9
dev CLEARs (all right) and turns 15 dev SUPPORTED (11 right) AMBIGUOUS; on the corpus 22 and 18 CLEARs (19, 16
right). For `2590` the 4-cell re-cut scores *better* (0.475 vs 0.344: `1140`), for `1950` the 3-cell one 0.77 of the
4-cell (`140`): a score ratio says nothing about which count is printed.

**P1-5 — cross-count normalisation is biased toward fewer glyphs.** Σ ln p over a path grows with its length: median
top-glyph ln p is −0.28 per glyph (dev), −0.24 (corpus), −0.45…−0.74 on the `2590` ink; a 4-glyph truth enters a
shared normalisation at ×0.5–0.76 against an equally good 3-glyph misread. If A emits several counts per ink, each
count family must be normalised and count-bounded on its own (or per-glyph normalised), never merged by raw logP.

**P2-1 — rejected designs (measured).** Re-cut one-substitution neighbours (1950 is one substitution from the re-cut
tops `1450`): dev 1–2/9, 1.35–1.49 wrong values per ink — worse. Closure of two emitted single substitutions
(`1910`∘`1450`→`1950`): dev 1/9 at k 2 with 0.86–1.22 per ink — worse. Ranking the tail by image score instead of
logP: same or worse recall. A count-truncation gate (`truncatedBy COUNT` only): identical results (no effect).
**P2-2 — knife edge (each bound ±20 %).** `380` passes with `8` at ratio 0.754 and share 0.20 (DEFAULT) / 0.21
(SAUVOLA): share 0.24 loses it and the corpus truth (dev +1, 5001 +0); share 0.16 keeps all and adds 0.08 / 0.13 /
0.08 values per ink. Ratio 0.56 changes no recall (+0.02–0.03 per ink); ratio 0.84 loses `380`, keeps `1950`. k 1 loses
`1950` (`1050` outranks it: `0` 0.884 vs `9` 0.861); k 3 adds dev 0.19 per ink for one corpus truth.
**P2-3 — losses the tail never reaches** (value truths): dev ALPHABET 1 (`472` read `°47`: a short first cell gets the
small-sign alphabet), RECUT_ONLY 1 (`490`); corpus NOT_CANDIDATE 9 + 12, RECUT_ONLY 6 + 7, GLYPH_COUNT 3 + 6.

## 2. Root cause — the `1950` ink (box 127–137 × 347–366, ROTATED_CW), measured
As-read `1410` SUPPORTED, p 0.473, margin 0.634, stable, min glyph 0.391, cap 11 px; 18 values merged; 1410's share
over all 18 would be 0.405 (still SUPPORTED). Cells as `char score/p`; truth glyphs with ratio and share = exp((s−top)/T).

| path | top | cells (shipped candidates) | `9`@1 ratio / share | `5`@2 ratio / share | 1950 in path |
| --- | --- | --- | --- | --- | --- |
| DEFAULT:0 anchor | 1410 | 1 \| 4 .410 · 0 .303 · 9 .270 \| 1 .425 · 5 .321 · 3 .317 · 4 .312 \| 0 | 0.657 / 0.060 | 0.754 / 0.123 | 0.0074 → floor |
| STRICT:0 anchor | 1410 | 1 \| 4 .436 · 0 .320 · 9 .286 \| 1 .391 · 5 .277 · 7 .269 \| 0 | 0.656 / 0.050 | 0.709 / 0.103 | 0.0051 → floor |
| SAUVOLA:0 anchor | 1410 | 1 \| 4 .363 · 0 .321 · 9 .312 · 3 .248 \| 1 .363 · 5 .336 · 4 .313 · 3 .281 \| 0 | 0.861 / 0.363 | 0.924 / 0.574 | 0.209, kept |
| DEFAULT:3 re-cut (best DEFAULT seg) | 1450 | 1 \| 4 .466 · 9 .311 \| 5 .555 · … \| 0 | 0.668 / 0.045 | top | top only offered |
| SAUVOLA:3 re-cut (best SAUVOLA seg) | 1450 | 1 \| 4 .418 · 9 .354 · … \| 5 .589 · … \| 0 | 0.847 / 0.278 | top | top only offered |

Merged order (share of best): 1410 1 · 1450 .367 · 1451 .194 · 1010 .137 · 1440 .116 · 1910 .116 · 1430 .099 ·
1470 .086 | cut: 1050 .079 · **1950 .066** · 1040 · 1940 · 1310 · 1030 · 1930 · 1350 · 1340 · 1330. Where it is dropped:
**count bound** (rank 10 > 8; no reserved slot needed, the as-read is rank 1). Not the floor (kept at 0.209 in SAUVOLA,
the merge takes the max), not width (no partial cut), not non-top (2 substitutions), not the merge.
Two error sources: cell 2 is a *cut* problem (every re-cut moving the 1|2 boundary reads `5` at top), cell 1 is a
*glyph* confusion (`9`→`4` is 9's commonest misread in the 005E corpus table, 34 of 176). A's adaptive pitch can fix
the first; only an alternative path keeps the second. With the tail of §3: tail `1050` (`0` .884/.431, `5` .924/.574),
`1950` (`9` .861/.363, `5` .924/.574); eligible before the cap: 1050, 1040, 1950, 1940.

## 3. Proposed contract (generic; every number from the measurements in §4)

**3.1 Generation (`numeric-lattice.ts`, `NUMERIC_LATTICE_VERSION` 1.1.0).** `LATTICE_BOUNDS` unchanged (floor 0.01,
width 16, non-top 2, mass 0.95, 8 sequences, glyph ratio 0.6, ≤ 4 per cell). New `TAIL_BOUNDS`:
```
TAIL_BOUNDS = { substitutions: 2,          // exactly two non-top glyphs: (b) low only because two choices multiply
                glyphRatio: 0.7,           // each: score ≥ 0.7 × the cell's best  (= VALUE_BOUNDS.glyphRatio, 005D's bound)
                glyphShare: 0.2,           // each: top − score ≤ T·ln(1/0.2) = 0.080472  (share exp((s−top)/T) ≥ 0.2)
                perInk: 2 }                // k: at most two tail values per ink
```
- Pool: the final beam frontier of the ANCHOR paths only (re-cuts still offer only their top). A text is eligible when
  some anchor reached it with exactly 2 non-top glyphs each passing both bars *in that anchor*, it states a dimension
  (`valueOf`; no leading zero), and its value is not among the emitted values. Consequence (verified on 404 tail values,
  562 labels): every tail value has within-path probability ≥ 0.2² = 0.04 > floor and is already in the merged set —
  the tail **never lowers the floor**; it only reaches past the count/mass bound.
- Order: the reaching anchor's logP (round6) descending, then text ascending by code unit; dedupe by `valueCm` *after*
  the sort; keep the first `perInk`. No `Map`/`Set` iteration order reaches the output.
- Record: `tail: Array<{ text, valueCm, logP, imageScore, nonTop[], pathIds[] }>` beside `sequences` — no `p`, never
  `asRead`, not in Z. `sequences`, `p`, `asReadP`, margins, entropy, `truncatedBy`, `mergedCount`, `emittedMass` and the
  class are byte-identical to 1.0.0.

**3.2 Consumers (`metric-solution.ts`).** A tail value is never a reading, a witness, a contest value, a corroboration,
a structural option or a chain correction:
- MUST NOT read `tail`: `contestValues` (M2), `latticeAlternatives`/`valueAlternatives` (`alts`, M4 `heldAlts`,
  `doubted`, `valueAmbiguity`), `correctionReadings` (M7 re-solve, CHAIN_CORRECTED, `MetricEvidence.alternatives`,
  `metricsAtScale`; `plausible`→`altCost`, M5 `structuralSupport`), `evidenceTuple`/`shareEvidence` (M1/M3).
- MAY read `tail`: `selectedValueOf` only, as a last fallback when AS_READ/STRUCTURAL/SCALE_RANKED found nothing: a
  scale exists, the span is ≥ `DECISIVE_SPAN_TOLERANCES`·tol, no emitted correction fits, **exactly one** tail value
  fits within tol (two → UNRESOLVED); recorded `by: 'SCALE_RANKED'` with `fromTail: true`, no `imageRank`. Never fed
  back into any scale, chain or layout.
- Evidence pack: a separate `OCR_TAIL_CANDIDATES` line; never counted among "image-only values".
- Guards (tests): a grep-level architecture test that the MUST-NOT functions never name `tail`; an adversary frame where
  two unrelated inks' tails agree on a scale (no hypothesis, no contest, no CANDIDATE_CONSENSUS, no corroboration); a
  frame whose rival is fitted only by a tail value (the witness stays uncontested); the `1950` ink as a unit test of
  the tail (`1050`,`1950`) and of the unchanged emitted set.

**3.3 Class (`ocrClassOf`).** Tail membership never changes a class (it is outside Z; measured, it does not separate
right from wrong among CLEAR/SUPPORTED: CLEAR+tail 1/1, 3/3, —; SUPPORTED+tail 8/11, 9/14, 15/19 vs 12/18, 49/73,
40/61 without). Glyph count: add `countAmbiguous` = A's lattice kept ≥ 2 glyph-count hypotheses for the ink, each with
a path whose top reading states a dimension, admitted by A's *geometric* rule (pitch range), never by a score ratio
(P1-4). Rule, exactly: `if (countAmbiguous && class === 'CLEAR') class = 'SUPPORTED'`; nothing else. A reading may be
CLEAR only when every kept count agrees. Cost at a ±0.05 h pitch-range proxy (§4.5): dev CLEAR 9/9 unchanged; corpus
10 + 9 right CLEARs (and 1 wrong) become SUPPORTED; CLEAR precision 0.905→0.903 and 0.955→0.943 — no gain today, because
no dev CLEAR/SUPPORTED reading and 1 of 253 corpus ones has a wrong count; it is insurance for A's count families. A
stronger rule (count-ambiguous SUPPORTED not `qualified` for M3) is possible but unmeasured at frame level — matrix first.

**3.4 Performance and determinism.** Expansions +0 (no new beam work: shipped mean 101 / max 224 dev, 174 / 591 and
173 / 498 corpus, 85 on the modrzewnicy page; lattice median 12–17 ms per ink, unchanged). Tail assembly reads ≤ 3
anchors × 16 frontier entries (mean 26–35, max 48), O(48·cells) bar tests and one sort of ≤ 48. Compare bars in score
space on round6 scores (`s ≥ 0.7·top`, `top − s ≤ 0.080472`), never on `Math.exp` outputs; sort keys (round6 logP,
text) form a total order; variants in `INK_VARIANTS` order; a phone and a server reach the same tail.

## 4. Measurements

**4.1 Where value truths are lost today** (shipped bounds; dev 81, corpus value truths 160 per seed)

| set | emitted | COUNT/MASS | FLOOR | width / non-top | NOT_CANDIDATE | RECUT_ONLY/CAP | GLYPH_COUNT | ALPHABET |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dev 81 | 72 | 7 (ranks 9–30, share .03–.31) | 0 | 0 | 0 | 1 | 0 | 1 |
| corpus 5001 | 131 | 8 | 0 | 1* / 1 | 9 | 6 + 1 | 3 | 0 |
| corpus 9017 | 131 | 3 | 0 | 0 / 0 | 12 | 7 + 1 | 6 | 0 |
| `1950` ink | — | 1 (rank 10/18) | — | — | — | — | — | — |
| condensed 0.65, 5001 · 9017 | 37 · 37 | 19 · 21 | 5 · 3 | 4 / 15 · 3 / 10 | 10 · 14 | 2 · 7 | 67 · 64 | 1 · 1 |

\* `6009`: width and floor jointly; at width 64 and floor 0.001 it is merged at rank 81 of 89 — out of any reach.
Dev count losses: `375` (FIT), `339` (FIT), `380` (FIT, recovered), `330` (FIT), `430` (HELD_BACK, recovered), `426`
(HELD_BACK), `274` (TARGET); all on AMBIGUOUS as-read inks. Distribution behind the bar (two-substitution pool, dev):
truths' weakest ratio q10/q50 0.75/0.86 vs wrong values' 0.63/0.72; weakest share q50 0.29 vs 0.09 (corpus 0.21 vs
0.06). The pool holds 6.9 wrong two-substitution values per ink (dev), 6.2 and 5.8 (corpus) before any bar.

**4.2 Tail variants** (recovered of value-truth losses; wrong values per ink, mean and worst)

| tail | dev | 5001 | 9017 | 1950 | note |
| --- | --- | --- | --- | --- | --- |
| **2 subs, ratio ≥ .7, share ≥ .2, k 2 (proposed)** | 2/9, .70, 2 | 1/29, .37, 2 | 0/29, .43, 2 | yes | |
| same, ratio ≥ .75 / ≥ .84 | 2, .64 / 1, .42 | 1, .34 / 1, .20 | 0, .40 / 0, .29 | yes / yes | |
| same, k 1 / k 3 | 1, .42 / 2, .89 | 1, .22 / 2, .47 | 0, .23 / 0, .60 | no / yes | |
| same, share ≥ .1 / .16 / .24 | 2, .95 / 2, .78 / 1, .54 | 1 / 1 / 0 | 0 / 0 / 0 | yes | |
| 1–2 subs, .7/.2, k 2 | 3/9, .75 | 1/29, .42 | 0/29, .46 | yes | violates (b) |
| + re-cut neighbours (.75/.2), k 2 | 1/9, 1.49 | 2/29, .90 | 0/29, .92 | no | rejected |
| closure of emitted singles, k 2 | 1/9, 1.22 | 2/29, .89 | 0/29, .83 | yes | rejected |
| count 8→10 (global) | +2, +~1.0 | +0, +.66 | +0, +.77 | yes | moves classes |

**4.3 Chance agreement** (cross-house pairs of unrelated inks, one scale in 1–5 cm/px fitting both within 2.2 px, as
005E pre-review C; dev: 81 decisive labels, 2,942 pairs; corpus: synthetic spans at a random 1.5–4.5 cm/px)

| set (mean size dev) | dev (K,K) | dev (K,1) | 5001 (K,K) | 9017 (K,K) |
| --- | --- | --- | --- | --- |
| as-read (0.94) | 3.5 % | 3.5 % | 2.5 % | 2.3 % |
| emitted (6.26) → + tail (6.99) | 36.6 → 40.4 % | 21.1 → 23.3 % | 18.0 → 19.0 % | 17.1 → 18.1 % |
| correction set (4.28) → + tail (5.01) | 25.1 → 29.6 % | 16.2 → 18.8 % | 11.4 → 12.4 % | 11.3 → 12.3 % |
| contest set (5.15) → + tail (5.88) | 29.5 → 33.7 % | 18.3 → 20.8 % | 14.1 → 15.1 % | 12.9 → 14.0 % |
| tail alone (0.73) | 1.0 % | 3.8 % | 0.2 % | 0.3 % |

The tail by itself rarely agrees with anything (≤ 1 % pairwise), but appended to any consumer's set it adds 1–4.5
points — the reason it must stay structurally separate (3.2).

**4.4 SCALE_RANKED at the true scale** (as-read misses; today → with the tail fallback of 3.2)
dev 29 of 81: RIGHT 17 · WRONG 2 · NONE 9 · UNRESOLVED 1 → 18 · 3 · 7 · 1. Corpus 5001 55 of 153: 19 · 8 · 24 · 4 →
20 · 9 · 22 · 4. Corpus 9017 60 of 157: unchanged (23 · 3 · 29 · 5).

**4.5 Count ambiguity** (proxy for A's count set: a run's count differs for a glyph pitch 0.50 h vs 0.60 h)
Flags 30/81 dev inks, 94/240 and 106/240 corpus; catches the `2590` ink (21 px run, 3 cells, w/E 3.47) and the `1950`
ink (16 px run: 3 cells at 0.50 h, 2 at 0.60 h); catches 15/15 and 13/15 corpus count errors. Flagged CLEAR: dev 0;
corpus 10/11 and 9/9 right. At 0.47–0.63 h it flags 55/81 dev inks and 5/9 dev CLEARs (all right) — A must keep its
count admission tight, or the cap removes a quarter or more of CLEAR for nothing measurable today.

## 5. Negatives and risks
- The tail's development gain (2 truths) rests partly on a knife edge (`380` at share 0.20/0.21); it recovers
  nothing on the held-back corpus. It is a bounded diagnostic and ranking aid, not a recall fix.
- Tail support is often variant-local (`1950`: SAUVOLA alone; DEFAULT/STRICT share 0.05–0.06). Ink variants are
  re-readings of one ink, so a tail value is never evidence of agreement — which is why it may not contest.
- A future consumer that iterates `[...sequences, ...tail]` silently undoes 3.2: +1 to +4.5 points of chance
  agreement. The architecture test is the protection, not a convention.
- The SCALE_RANKED fallback is as often wrong as right at the last digit (`491` for `490`); if it ever feeds geometry
  (chain solver, `metricsAtScale`), measure that on the matrix first — 005E's own warning that the size of the
  correction set decides how often a scale finds a value that merely fits applies in full.
- The class cap depends on A's count admission; a loose one demotes 20–25 % of corpus CLEARs (no precision gain).
- Not measured: whole-house frame outcomes (by construction the tail changes no emitted sequence, p, class, contest,
  chain reading or scale, so no development frame outcome can move; only the new `tail` field and fallback records do).

## 6. What this changes on the development houses
Nothing that decides: the offline beam reproduces 1.0.0 exactly on all 81 development labels and 480 corpus labels, and
the tail is outside every decision consumer. The visible changes are records — a `tail` array on 43 % of dev inks
(≤ 2 values), and SCALE_RANKED fallback records (dev +1 right `430`, +1 wrong `491`). The count cap changes classes
only once A's lattice carries count hypotheses; measure it then on the m3 matrix (marcowki, G2E, Dąbecja and Azalia
frames are the 005E-sensitive ones).
