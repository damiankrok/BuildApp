# 005F post-implementation review — reviewer A: count-hallucination red team

**Code under review.** `packages/source-metrics` at d910212. It is unchanged through a991e6b, 4fd2f8e, 65ebbdd and
2e1889a. ac5c5fc (post-review D, committed during this review) and later uncommitted edits are discussed in "The
working tree moved during this review".

**Scope.**
- `numeric-lattice.ts`: the style, `countHypotheses`, counter safety, the class.
- `extract.ts`: the style, computed once per plan.
- `metric-solution.ts`: the A6 filter, SCALE_RANKED, STRUCTURAL, contest, M4, `valueAmbiguity`.
- The three named test files.

**Method.**
- **Synthetic pages.** Built with `renderLabel` (faces A and B, `condense`): plans of context labels plus one target,
  read exactly as `extract.ts` reads a plan (`readNumbers` → `dimensionStyleOf` → `styleFor(token.height)` →
  `labelLattice`).
- **Baselines.** Most grids are also read with the frozen 005E lattice (`9b619ec`, imports rewired, in scratch) and
  without a style. The table says where not.
- **Metric consequences.** Checked with `solveFrameMetric` on hand-made lattices (the `ocr-metric-adversaries` harness,
  copied).
- **Modrzewnicy.** Label-level probes on the cached bytes; nothing was copied.
- **Candidate fixes.** Measured with an env-gated scratch copy of the lattice on the 81 development labels, both
  corpora, the grids and one whole house (Morelach).
- **Where things are.** Probes in `/home/user/BuildApp/.cache/review-A/` (gitignored); outputs in
  `/home/user/work005f/post/scratch-A/`.
- **Tests.** The three named test files pass: adaptive-glyph-count 21/21, ocr-metric-adversaries 21/21, numeric-lattice
  17/17.

## Verdict

**Claim (1), condensed count recovery, holds for labels in the plan's own face, but not at the blind house's cap.**

- **Condensed grid** (144 labels: `2590` `1950` `1410` `640` `1000` `730`, caps 11–16, faces A/B, pitch 0.46–0.50).
  Moving from 005E to 005F:
  - right count: 35 → **87**
  - wrong-count CLEAR/SUPPORTED: 17 → **6**
  - right as-read: 3 → 11
- **Not where it was needed.** At the blind house's cap 11, `2590` in the stage-test geometry (face B, pitch 0.46) is
  read `190` **SUPPORTED** (005E: AMBIGUOUS), because the width doubt is gated away (A5F-2). At caps 10–13 the value
  `2590` is never in the lattice (0/24).

**Claim (2), normal labels are never expanded falsely, is falsified (A5F-1).** On a page whose style comes from
another face, the decisive count replacement rewrites ordinary labels in both directions.

- **Split.** `145` → `1115` SUPPORTED.
- **Merge.** Under a wide title-block style, `730` → `10` SUPPORTED.
- **On the open-4 grid** (84 ordinary labels on condensed pages), moving from 005E to 005F:
  - right count: 84 → 60
  - right as-read: 76 → 55
  - wrong-count C/S: 0 → 3
- **On real plans.** The over-split fires on a development plan too (rarytasy-eoze `472`, all three variants,
  LOW_QUALITY).

**Claim (3), a scale never creates, chooses or promotes a count, holds on every path the contract names, with one
leak at d910212.**

- **Safe.** SCALE_RANKED, STRUCTURAL and re-solves cannot cross a count.
- **The leak.** Count alternatives still contest a scale and feed M4 doubt (A5F-3). On a fixture this turns a
  CONFIRMED 2.0 cm/px into a STRONG wrong 2.5.
- **Fixed at ac5c5fc.** The D5F-6 edit, now committed, closes it; I verified it with the same fixture.

**`2590` on modrzewnicy.** The stated reason — 9→4 classifier confusion after the right count — is confirmed. There is
no 005F segmentation defect. A secondary de-skew contributor is generic 005D debt (A5F-6).

**Severity.** P0: 2 (A5F-1, A5F-2). P1: 2 (A5F-3, resolved at ac5c5fc; A5F-4). P2: 4 (A5F-5 … A5F-8).

| ID | Sev | One line |
|---|---|---|
| A5F-1 | P0 | Decisive count replacement under a style that is not the label's face: `145` → `1115` SUPPORTED, `730` → `10` SUPPORTED; open-4 grid right count 84 → 60 |
| A5F-2 | P0 | Width ambiguity is gated on valley depth and counter cuts (contract A5 has neither): condensed `2590` at cap 11 → `190` SUPPORTED (005E AMBIGUOUS); A1b 30/80 wrong-count C/S |
| A5F-3 | P1 | Count alternatives contest and feed M4 through `latticeAlternatives` (A6: never); fixture flips true 2.0 → wrong 2.5 STRONG. **Resolved at ac5c5fc** (D5F-6) |
| A5F-4 | P1 | When ink variants disagree on the count, the as-read count is chosen by template score or by "states a value", and the class does not see it (`7525` → `715` SUPPORTED) |
| A5F-5 | P2 | An anchor count the style rules out, with no admissible ±1, keeps CLEAR/SUPPORTED (`527` → `50`, `4027` → `410` CLEAR; counters `8080` → `810` CLEAR; corpus `185` → `85` CLEAR). Pre-existing; the docs overclaim |
| A5F-6 | P2 | `2590`: 0 of 420 exhaustive four-cell cuts per mask read it, de-skewed or upright; the 9 scores 0.17–0.32 against the 4 at 0.45–0.55. The de-skew slope (−0.18) also spoils the `2`/`5` |
| A5F-7 | P2 | Modrzewnicy: the decisive count makes the unreadable overall a witness: `1140` AMBIGUOUS PRIMARY, the heaviest hypothesis (1.762 cm/px; the page states ≈ 4.0) |
| A5F-8 | P2 | Gate tests: one face per page, caps 14/16 only, `correctionReadings` only, the tail guarded by a regex |

## Findings

### A5F-1 (P0): the decisive count trusts a style that is not the label's face

**Where.**
- `numeric-lattice.ts:726`: `decisive: pitch !== null && !admitted(w, a)`, in both directions.
- `:731–732`: the decisive segmentation replaces the variant's anchor, and the reader's count is gone from that
  variant.
- Contract A2 "Decisive".

**What is wrong.** The style is the median isolated-glyph width of every raw token within ×/÷1.25 of the label's cap.
It is the label's face only if the page has one face at that cap.

- **When the label's glyphs are about 1.5× the style.** The true count is not admitted. A count one higher is admitted
  wherever a glyph has an internal valley of depth ≥ 0.35, such as face B's open `4`. That count then replaces the
  reader's count in **every** variant.
- **When the style is wider than the label** (a title block or room names in a wide face at the same cap). A touching
  pair falls under 0.75·p̂ and is *merged*. A merge has no depth gate at all.
- **Why the class stays.** Either way no variant keeps the true count, so `rivalP` is 0, `widthAmbiguous` is false and
  the class stays SUPPORTED.
- **What it falsifies.** The contract gate "a true 3-digit label never emits a 4-digit value at p ≥ 0.10 without the
  class being AMBIGUOUS", and claim (2).

**Reproduction.**

- **Split** (`npx vite-node .cache/review-A/repro.ts`, case R1). The page has 12 context labels in condensed face A
  (iso 0.40, cap 16, gap 0.3), which give a style pitch of 0.389 from 62 samples. That is the same with the production
  pass set (`repro-allpass.ts`). The target is `145` in ordinary face B (iso 0.68, cap 16, gap 0.12).

  | Read | Counts | As-read | Values |
  |---|---|---|---|
  | 005F, page style | D3>4D S3>4D S3>4D | **`1115` SUPPORTED** | 1115 0.43, 1315 0.20, 1715 0.19; `145` not emitted |
  | 005F, no style | — | `145` LOW_QUALITY | — |
  | 005E | — | `145` LOW_QUALITY | — |

  Still SUPPORTED with the working tree's D5F-4 edit.
- **Merge** (`a3-batch.ts`, title group). 24 wide-face tokens (condense 1.15/1.25, caps 16–20) give a style pitch of
  0.67–0.75 from 193 samples. The target is condensed `730`, face B, pitch 0.5, cap 16. Counts D3>2D, S2>2, S3>2D:
  as-read **`10` SUPPORTED** (p 0.48), in 6 of 6 title variants.
- **Scale.**
  - **Open-4 grid** (`a2-open4.ts`, 696 labels): 140 over-cut as-reads (115 LOW_QUALITY, 20 AMBIGUOUS, 5 SUPPORTED).
  - **Its 84-label subset** (`eval-grid3.ts`), moving from 005E to 005F: right count 84 → 60, right as-read 76 → 55,
    right C/S 68 → 27, wrong-count C/S 0 → 3.
  - **Development.** rarytasy-eoze `472` is decisively cut 3 → 4 in all three variants (`°017`), saved by
    LOW_QUALITY.

**Consequence.** The wrong-count as-read is a SUPPORTED witness that can corroborate (`metric-solution.ts:440–499`).

**Fix** (measured; the details are in the fix tables).

- **FIX_E.** A count no ink variant's own reader cut is at most AMBIGUOUS. That is, `segmentation.counts[].reader`
  does not contain the as-read anchor's cell count.
- **FIX_M.** Merges (k < a) are never decisive; they stay count alternatives. No measured case needed a decisive
  merge.
- **Measured effect.**
  - Development (81 labels): 0 changes.
  - Corpora: 0 changes.
  - Morelach: no change from these two.
  - Open-4 grid: wrong-count C/S 3 → 0; right C/S 27 → 27.
  - Condensed grid: right C/S 5 → 2 (FIX_E demotes 3 right decisive recoveries); wrong-count C/S unchanged.
  - Title merge: FIX_M turns `10` SUPPORTED into `110` AMBIGUOUS; FIX_E alone does not (`case-title.ts`).
- **Not taken.** FIX_B (never split a run the reader cut as one glyph) restores counts (open-4 subset right count
  60 → 78) but does not stop `145`, where the `4` touches the `5` (a = 2), and costs condensed recoveries (29 → 27 of
  60).

### A5F-2 (P0): the width-ambiguity test carries the hypothesis gates, so doubt is hidden exactly where glyphs touch

**Where.** `numeric-lattice.ts:734–749`. The width-ambiguous loop requires `boundaryOptions` with a counter-safe
option at every boundary, and a valley depth ≥ 0.35 for k > a.

**What is wrong.** Contract A5: "Width-ambiguous means some run admits a count a ± 1 that fits at least as well as a."
It has no topology gate. The gates belong to *adding* a hypothesis (A2). Applied to *doubt*, they remove it exactly
where condensed digits touch with no valley — the stage's own case.

**Reproduction** (`case2590.ts`): the stage-test geometry (iso 0.455, pitch 0.46, face B, own-face context) at the
blind house's cap 11. The style pitch is 0.417 from 36 samples.

- **Width.** `2590` is one 19 px run cut into 3. r₃/p̂ = 1.27 is just inside the 1.30 band, so the count is not
  decisive. r₄/p̂ = 0.95 fits far better.
- **The gates.** Boundary 1's best valley has depth 0.333 (profile 9,6,10), and boundary 2 has depth 0. At least one
  boundary window also holds no counter-safe column: FIX_W, which drops only the depth gate, still leaves the read
  SUPPORTED.
- **Result.** As-read **`190` SUPPORTED** (p 0.43, next 0.21). No 4-digit value is emitted.
- **005E reads it** `190` AMBIGUOUS.

**Scale.**

- **Ordinary touching labels on condensed pages** (A1b subset, 80 labels): 30 wrong-count C/S. Each has an admitted
  ±1 count that fits at least as well, and only the gates hide it: W2s turns all 30 AMBIGUOUS.
- **Condensed grid** (144 labels): 6 wrong-count C/S, at caps 11–14.
- **Gates removed but counter safety kept** (FIX_W): `190` is still SUPPORTED. The counter gate alone hides it.

**Fix (FIX_W2s).** Implement A5 as written for labels that have a style: admitted and fitting at least as well, with
no valley or counter gate.

- **Development** (81 labels): one change — kosacce-clean `890`, read `840`, goes SUPPORTED → AMBIGUOUS. A wrong
  SUPPORTED is removed.
- **Corpora:** 0 changes (no style there).
- **A1b subset:** 30 → **0**.
- **Condensed grid:** 6 → 3, right C/S unchanged at 5.
- **Open-4 grid:** right C/S 27 → 9. Ordinary-face labels under a condensed style are now width-ambiguous, as A5
  defines them.
- **Morelach** (whole house, with FIX_E and FIX_M; `rows/morelach-fixWEM`):
  - scale identical (1.989028/1.997504 cm/px, CONFIRMED, INCONCLUSIVE);
  - verdict PASS;
  - storeys 2/2;
  - footprint −3.12 %;
  - four selected-frame inks move to AMBIGUOUS: `180` CLEAR ×2, `70` CLEAR, `40` SUPPORTED.
- **Without a style scope** (the no-style band) it costs 5001 17 right C/S. Keep it style-only.
- **The alternative.** Amend A5 and the docs to say the gates apply, and record the miss (`190` SUPPORTED at cap 11)
  as accepted.

### A5F-3 (P1): count alternatives contest a scale and feed M4, which A6 forbids (fixed in the working tree)

**Where (d910212).**
- `metric-solution.ts:421–431`: `latticeAlternatives`, with no digit filter.
- `:449`.
- `:501` (`contestAlts`) and `:918` (`fitsAt`).
- `:1042`: `heldAlts`, CANDIDATE_CONSENSUS.
- `:1337`: `valueAmbiguity`, record only.

**What is wrong.** A6 says "count alternatives never witness, seed, contest, corroborate or count".
`correctionReadings` (`:394`) has the filter; `latticeAlternatives` does not. An ink with an other-count value at
p ≥ 0.1 is AMBIGUOUS, and an AMBIGUOUS ink contests with every alternative.

**Reproduction** (`contest.ts`, the adversaries harness).

- **Fixture.**
  - The true 2.0 cm/px: A `800`/400 px (AMBIGUOUS) and B `700`/350 px (CLEAR).
  - A misread 2.5: D `1000`/400 px (SUPPORTED) and E `700`/280 px (CLEAR).
- **With the count alternative.** A carries a 4-digit `1000` (p 0.22): **REPLACED, STRONG, 2.5 cm/px**.
- **Control.** That value replaced by a 4-digit `1300` that fits nothing: CONFIRMED 2.0, INCONCLUSIVE.
- **With E SUPPORTED** (`ESUP=1`): LEGACY_UNCONFIRMED/WEAK against CONFIRMED/INCONCLUSIVE.
- **On the matrix** (m-c), it is live but quiet: AMBIGUOUS PRIMARY inks carry other-count contest values in 9 houses
  (morelach `240` → `2110`/`2410`, willa-miranda `600` → `80`/`40`/`90`). None ended contested, and there was no
  CANDIDATE_CONSENSUS.

**Fix.** The D5F-6 filter in `latticeAlternatives`, now committed in ac5c5fc, is exactly this. With it the fixture
gives CONFIRMED/INCONCLUSIVE both ways, verified on the working tree. **Resolved at ac5c5fc.** Pin it with this fixture
(see A5F-8).

### A5F-4 (P1): when ink variants disagree on the count, nothing in the class says so

**Where.** `numeric-lattice.ts:1040` and `:1263–1267` (`pickAsRead`: valued anchors first, then the highest
`segScore`), and `:1140–1160`, where the count rules see only valued sequences.

**What is wrong.** Contract §0: the image score cannot choose a count. When the variants' final anchors have different
cell counts (005D cuts, or a decisive change in one variant), the as-read count is picked by template `segScore`, or by
which anchor states a value. Two cases from the A1b grid (`a1b-mixed.ts`):

- **`527`:** D3>3 S3>4D S3>3. The decisive STRICT anchor wins on `segScore` and the as-read is `5121`, made AMBIGUOUS
  only by the stability bracket.
- **`7525`** (4 cases): D3>3 S4>4 S4>4. Two variants cut the right count but read `-725`, which states no value.
  DEFAULT's `715`/`756` is picked and is **SUPPORTED**: `rivalP` ignores unvalued sequences.

**Fix (FIX_C).** Variants whose final anchors differ in cell count make the class at most AMBIGUOUS.

- **Development:** 0 changes.
- **Corpora:** −1 right SUPPORTED each (`686`, `4245`).
- **Open-4 grid:** right C/S 27 → 13. Most of that is decisive noise A5F-1's fix removes; I did not measure FIX_C
  after FIX_E+M.

Priority: after A5F-1/2.

### A5F-5 (P2): a count the style rules out keeps CLEAR when no ±1 alternative passes the gates

**Where.** `numeric-lattice.ts:715–732` and `:1149–1160`. When count a is not admitted and neither a ± 1 is
admissible, nothing is recorded.

**Cases.**
- **R2/R3** (`repro.ts`): ordinary touching `4027` → `410` **CLEAR** (r₃/p̂ = 1.87); `527` → `50` **CLEAR** (p 0.90).
  They read the same without a style.
- **Counters** (`a3-batch.ts`): 20 of 112 touching `1000`/`8080`/`800`/`6080`/`9000`/`1080` are C/S at a wrong
  count. Examples: `8080` → `810` CLEAR, `9000` → `410` CLEAR, `1000` → `14` CLEAR. The count is off by 2, so ±1
  cannot reach it.
- **`1` runs:** `110` → `10` CLEAR ×7.
- **The stage's corpora:** `185` → `85` CLEAR (9017); `917` → `40` and `49110` → `4950` SUPPORTED (5001). These are
  the calibration records at e6fe6bc, `/home/user/work005f/calib/corpus-*.json`.
- **A1c** (940 labels): 80 C/S in 005F, 82 in 005E. Pre-existing.

**Why it matters.** "A 3-vs-4 ambiguity is never CLEAR" holds only when the lattice raises the other count; the
contract text and the docs read as a guarantee.

**Option (FIX_A).** A run too wide for its count — or too narrow, for a ≥ 2 — is at most AMBIGUOUS, when the label has
a style.
- **Development:** 0 changes.
- **Corpora:** 0 changes.
- **A1b subset:** 30 → 8.
- **Open-4 grid:** right C/S 27 → 0.

Record it as debt, and fix the wording, in 005F.

### A5F-6 (P2): `2590` on modrzewnicy — the stated reason holds; the de-skew is a second, generic contributor

**The setup.** The selected frame is `rzut-8d59c92ec1`, ROTATED_CW pass, style 0.4545 from 48 samples.

**What 005F reads.** All three variants decide 3 → 4 (r₃/p̂ = 1.40). The as-read is `1140` AMBIGUOUS. The values are
`1140 2140 1540 2540 1340 3140 7140 2440`; there is no `2590`, in the values or in the tail.

**Exhaustive four-cell cuts** (`modrz-exh.ts`: 420 cuts per mask, every cell 2 px up to 0.95 cap):

- **At the de-skew's own slope** (−0.18 for DEFAULT and STRICT, −0.12 for SAUVOLA): `2590` is top in **0 of 420**
  cuts in every mask. The `9` cell never reads 9 at top: it scores 0.17–0.25, against 0.45–0.50 for `4`.
- **Upright:** `2590` is still top in 0 cuts. The `9` reads 9 in 17 of 420 cuts (DEFAULT only). The best cuts read
  `7540` (DEFAULT) and **`2540`** (STRICT, SAUVOLA): only the 9 is wrong.
- **De-skewed, the best cuts read** `1340`, `1540` and `2540`.
- **`1950` (same face):** STRICT de-skewed reaches it as top in 2 of 420 cuts; upright, in 0.

**Conclusion.** The binding cause is the 9→4 classifier confusion at the right count, as stated, and the count rule
did its part. The de-skew slope on this 11 px ink also turns `2`/`5` into `1`s. Labels on this page are de-skewed
anywhere from −0.30 to +0.36, mostly −0.12/−0.18. Record it as 005D front-end debt.

### A5F-7 (P2): the decisive count makes the misread overall a witness on modrzewnicy

At d910212 (`m-c/dom-w-modrzewnicy`), `1140` is an observation that is PRIMARY, INDEPENDENT and AMBIGUOUS over
647 px. It is now the first hypothesis: **1.762 cm/px**, from 1 independent reading.

**The page's own consistent statement is ≈ 4.0 cm/px:** 2590/647 = 4.003, 1950/487 = 4.004 and 640/160 = 4.0 all
give it.

**In 005E** the ink was `140` LOW_QUALITY and decided nothing. The house stays refused (DIMENSION_EVIDENCE_INCONCLUSIVE)
and nothing breaks. But count recovery without value recovery turns an unreadable overall into a deciding,
non-corroborating witness of a wrong scale. The docs should say so.

### A5F-8 (P2): what the gate tests do not exercise

**Where.** `adaptive-glyph-count.test.ts`.

- **One face per page.** The context and the target always share a face, so neither A5F-1 nor A5F-4 can occur. ":150"
  mixes counts, not faces.
- **No small caps.** Caps are 14/16 only. The blind label was 10–11 px (A5F-2).
- **The ":176" "never CLEAR" test checks the wrong thing.** It checks other-count values among the emitted values, not
  the as-read count against the truth, so `185` → `85` CLEAR passes it.
- **The ":194" count-crossing test** checks `correctionReadings` only. Contest and M4 (A5F-3) are untested.
- **The ":261" tail guard is a regex.** It searches for `.tail` in two files: a destructuring or a third file passes
  it. A type-level guard would be stronger: the decision functions would take `Omit<LabelLattice, 'tail'>`.
- **The pass set is not material.** The tests read the style from H (+ inverted) passes, while production also reads
  CW and CCW. On R1 the production pass set gives the same 62 samples and the same pitch.

## Readers of the count fields and the tail (grep, verified)

Command: `grep -rn "\.tail\b|countAmbiguity|\.segmentation\b|widthAmbiguous|rivalP|countAlt" packages apps holdout`.

- **`tail`.**
  - Recorded by `extract.ts:1042`.
  - Copied by `evidence-pack/src/pack.ts:341` (origin `AMBIGUITY_TAIL`).
  - Hashed by `hash.ts:142`.
  - `metric-solution.ts` never names it.
  - **No decision consumer.**
- **`countAmbiguity` and `segmentation`.** Recorded by `extract.ts:1041,1043` and in the pack (`pack.ts:338–380`, the
  GLYPH_COUNT_HYPOTHESES timeline). The only reader with an effect is the lattice's own class rule (`:1140–1160`), as
  A5 intends. The Android Kotlin code reads none of them.
- **Scale paths.** `correctionReadings` (`:394`) feeds re-solves (`:1209–1213`), SCALE_RANKED (`:1288–1293`) and
  STRUCTURAL (`altCost` via `plausible`, `:451–452`, `:1618–1625`). None can cross a count. The leak was
  `latticeAlternatives` (A5F-3).
- **The style.**
  - Computed once per plan read from every raw token (`extract.ts:990`).
  - Image-only (`dimensionStyleOf` sees `read.raw` and `read.passes`); the import gate is `:203`.
  - In the cache key (`numeric-lattice.ts:890`).
  - **No scale, chain value or published fact reaches a count.**

## Attack results (d910212; "C/S" = as-read at a wrong digit count, classed CLEAR or SUPPORTED)

| # | Attack (probe) | n | 005F C/S | 005E C/S | Notes |
|---|---|---|---|---|---|
| 1 | Condensed-style page, ordinary *touching* label, caps 14–19 (`a1b`, `a1c`) | 940 | 80 (16 CLEAR) | 82 (12) | No style: 80. Under-count (A5F-2/5). No false expansion at C/S |
| 2 | Same, ordinary face B *separated*, open `4` (`a2-open4`) | 696 | 5 over-cut | — | 140 over-cuts; every text here has the open `4` (A5F-1) |
| 2′ | Subset of #2 (`eval-grid3`) | 84 | 3 | 0 | Right count 84 → 60; right as-read 76 → 55 |
| 3 | `1` runs: `11` `111` `110` `211` `117` `1117` (ones) | 128 | 35 | n/r | Mostly 005D's merged `1`s. 4 decisive, e.g. `211` → `11` CLEAR. No over-cut |
| 4 | Italic, slant 0.08–0.38 (italic) | 120 | 2 | n/r | `1950` → `410` SUPPORTED, → `140` CLEAR. No over-cut |
| 5 | Lone label, < 8 samples (lone) | 126 | 3 | n/r | `2590` → `210` SUPPORTED at cap 11: no style, no count rule |
| 6 | Cap 1.25× off the style | — | — | — | In #1/#2: targets at token height 16–21 against context ≈ 18 all take the context style (`styleFor`, `:514`) |
| 7 | Touching counters `1000` `8080` `800` `6080` `9000` `1080`, pens 0.10/0.16 (counter) | 112 | 20 | n/r | **0 over-cuts** (counter safety holds), but 0/112 right; off by 2 (A5F-5) |
| 8 | Condensed `2590` `1950` at caps 10–13 (`small-e5`) | 48 | 6 | 6 | Right count 16 vs 3. `2590` value never reached |
| 8′ | Condensed grid, caps 11–16 (`eval-grid3`) | 144 | 6 | 17 | Right count 87 vs 35 |
| 9 | Title block in a wide face sets the style (title) | 168 | 6 | 0 of 2 checked (`171` AMBIGUOUS) | All `730` → `10` SUPPORTED by decisive merge (A5F-1) |

Notes on the table:

- **n/r.** The 005E reading of groups 3, 4, 5 and 7 was not run to completion before this review was handed over.
  Their outputs will land in `scratch-A/eval-a3-*.out`.
- **What groups 3–7 show.** The wrong counts there are reader under-counts (005D's cut, ±1 out of reach or no valley).
  The only over-cut is one lone label, and it is not C/S. None comes from a scale.

**The title-merge case under the switches** (`case-title.ts`, two of the six title variants, d910212 base):

| Switch | `730` read as |
|---|---|
| shipped d910212 | `10` SUPPORTED (D3>2D S2>2 S3>2D) |
| E | `10` SUPPORTED |
| A | `10` SUPPORTED |
| W2s | `10` SUPPORTED |
| **M** | **`110` AMBIGUOUS** (D3>3 S2>2 S3>3) |
| W2s+E+M | `110` AMBIGUOUS |

- **005E:** `171` AMBIGUOUS.
- **The working tree:** the coordinator's in-progress edits already read `110` AMBIGUOUS.
- **Conclusion.** FIX_M is what closes the merge direction of A5F-1.

## Fix measurements (scratch, env-gated; nothing committed)

`.cache/review-A/fix/numeric-lattice-fix.ts` is d910212's lattice. With every switch off it behaves exactly as
d910212.

| Switch | For | Rule |
|---|---|---|
| W2s | A5F-2 | Width-ambiguous per A5, with no gates, for labels that have a style |
| E | A5F-1 | A count no variant's reader cut is at most AMBIGUOUS |
| M | A5F-1 | No decisive merge |
| C | A5F-4 | Variants' anchor counts disagree → at most AMBIGUOUS |
| A | A5F-5 | A style-ruled-out anchor count → at most AMBIGUOUS |

**Development labels** (81; shipped FIT CLEAR 8/8 right, SUPPORTED 13 with 9 right):

- E, M, C, A: no change.
- W2s: only kosacce-clean `890`, read `840`, SUPPORTED → AMBIGUOUS.

**Corpora** 5001/9017 (no style): E, M, A, W2s: no change. C: −1 right SUPPORTED each.

**Grids** — wrong-count C/S, with right C/S in brackets:

| Grid | 005E | shipped | W2s | E | M | C | A | W2s+E+M |
|---|---|---|---|---|---|---|---|---|
| A1b touching, condensed page (80) | — | 30 | **0** | 30 | — | 30 | 8 | 0 (W2+E; M not run) |
| Open-4, condensed page (84) | 0 (68) | 3 (27) | 3 (9) | **0** (27) | 3 (27) | 3 (13) | 0 (0) | 0 (9) |
| Condensed own-face, caps 11–16 (144) | 17 (3) | 6 (5) | **3** (5) | 6 (2) | 6 (5) | 6 (2) | 5 (5) | 3 (2) |

**Whole house, Morelach** with W2s+E+M:

- scale, relation and confidence identical;
- PASS; storeys 2/2; footprint −3.12 %;
- 4 inks → AMBIGUOUS (W2s).

## The working tree moved during this review

From about 12:30, coordinator edits appeared in `packages/source-metrics`. They are now committed as ac5c5fc
(post-review D).

- **D5F-6 (`latticeAlternatives` digit filter).** This is the A5F-3 fix. It is verified with `contest.ts`.
- **D5F-4 (a decisive as-read variant is never CLEAR).** This does **not** close A5F-1: R1 stays `1115` SUPPORTED.
- **The A fixes in progress.** At about 12:51 the working tree held further uncommitted edits that implement A5F-1
  (E + M), A5F-2 (W2s) and A5F-4 (C). They match my scratch switches line for line in intent: decisive only for k > a;
  width-ambiguous with no gates under a style; at most AMBIGUOUS for a count no reader cut, or for variants that
  disagree. I have not reviewed or run those edits themselves. The measurements here are of my scratch switches on
  d910212.
- **Which measurements it affects.**
  - Probes started before 12:29:55 ran on d910212: `a1*`, `a2`, `a3-batch`, `repro`, `dev-eval`, `fix-grid`,
    `corpus-eval`. vite-node loads once.
  - `eval-*` and `small-e5` started later, so their "shipped" column includes D5F-4/D5F-6. Neither moves CLEAR ∪
    SUPPORTED, so every C/S count above is unaffected.
  - The fix columns and the Morelach run are built on d910212.

## What I could not verify

- **No full matrix per fix.** I ran no fix over the 20-row matrix: the evidence is labels, corpora, grids and one
  house.
- **Real mixed-face plans.** How often ARCHON plans carry a second text face within ±25 % of the dimension cap (A5F-1's
  precondition) is not measured. rarytasy-eoze `472` shows the over-split on a development plan.
- **Morelach truth.** Whether the four Morelach inks W2s demotes (`180`, `180`, `70`, `40`) were read right is unknown:
  Morelach is not in the labelled set.
- **The de-skew claim (A5F-6) rests on two labels of one plan.**

## Hygiene

- **Scratch.** Probes in `/home/user/BuildApp/.cache/review-A/` (gitignored). Outputs, a patched snapshot copy
  `snap-A/` and the run `rows/` in `/home/user/work005f/post/scratch-A/`.
- **Nothing in the repository edited.** I created or edited nothing in `/home/user/BuildApp` outside `.cache/`, and
  ran no git command that changes state.
- **Dirty tree.** `git status --short` is not empty, but every entry is the coordinator's in-progress work
  (`numeric-lattice.ts`, `ocr-metric-adversaries.test.ts` at the last check).
- **No publisher bytes.** None were copied anywhere. The ASCII views of the `2590` ink went to the terminal only.
