# 005E post-implementation review C (`c5e`): false-consensus red team

- **Reviewer:** c5e. **HEAD:** `8b8bd396a167d632c0309392699c0d7eeb749a7a`, diffed against the 005D freeze `d8ba4e8`. Read-only: nothing in the repo was edited, and the worktree is clean.
- **What I read:** the brief (§2, §3, §14–17, §29), `pre/implementation-contract.md`, `pre/false-consensus-review.md`, `calibration/README.md`, the `metric-solution.ts` diff in full, the class rule in `numeric-lattice.ts`, `extract.ts`, `ocr-metric-adversaries.test.ts`, the §41 block of `dimension-topology.test.ts`, and `firstReadingNeedsChallenge`, `metricScales` and `latticeScales` in `reconstruction/src/plan-resolution.ts`.
- **What I ran** (all scripts are in `.cache/review-c5e/`):
  - `fx.ts` with `scen*.ts`: about 30 hand-made pages. Each one goes through the frozen 005D solver (`.cache/old005d`) and the HEAD solver. Lattices come in two forms: classed by hand, as the tests do it, or classed by the shipped rule computed from the fixture's own probabilities.
  - `aa.ts`: the §41 anti-aliasing sheet, end to end, through 005D and 005E.
  - `replay-all.ts` / `replay-aa.ts`: a selected-frame replay of all 14 development rows (publisher bytes from the offline caches), run through HEAD and through patched copies (`modsrc`, `modfc`, `modaa`). The replay reproduces m1/m2's relation, confidence and scale on every row.
  - `chance_*.py`: chance rates measured on the 299 distinct AMBIGUOUS lattices of the m1 evidence.
  - `classes*.py`, `counted.py`, `truth.py`, `twins.py`, `clearrival.py`: tables over m1/m2 metric evidence and `development-labels.json`.
  - Matrices: m1, fix2, and m2 once it finished (`DONE`). m2's metric decisions match m1 on every row, and `falseConsensus` fired on no development row.

## Findings

| ID | Sev | One line |
|---|---|---|
| C5E-1 | **P0** | The shipped class rule ignores the margin. A two-value coin toss (margin 0.08–0.15, or even negative) is SUPPORTED, so it corroborates. As a result, §29's own two inks without the children give CONFIRMED/STRONG at −6.5 %, where the contract says INCONCLUSIVE. The tests pass only because they hand-label classes the shipped rule would not assign. |
| C5E-2 | P1 | The false-consensus override demotes true scales. On a REPLACE against a vote with zero independent readings, it hands the first reading to the vote. Its triggers are cheap: any 55 px CLEAR ink, or alternatives that agree by chance in 16–18 % of true pairs. The effect is non-monotone. Real case: dom-w-azaliach with its correct `670` counted gives the vote's 2.462 instead of 1.8615. |
| C5E-3 | P1 | Anti-aliasing (§41): a single AMBIGUOUS ink now replaces the vote at +41.8 % (005D: −8.2 %), still WEAK. The true 2.5 is the top alternative of both inks, and the challenge cannot weigh it. WEAK is not an adequate answer here. |
| C5E-4 | P2 | The witness leading-zero test reads the 005D raw text, not the as-read string. azaliach's correct `670` (raw `010`) never counts, and the record says `rawText 670, leadingZero true`. Fixing it before C5E-2 makes azaliach take the wrong scale. |
| C5E-5 | P2 | The twin-line key (I5) rounds each reading's own pixels. 89 of the 232 development PARALLEL_COPY_OF relations have a mark that rounds differently, so a coin toss drawn twice counts twice (WEAK → SUPPORTED in both 005D and 005E). |
| C5E-6 | P2 | Reporting. CANDIDATE_CONSENSUS names the first agreeing pair in ascending value order (2.112 while the truth pair agreeing on 2.2 is present). `demotedObservationIds` lists AMBIGUOUS inks that still decide. The `why` still says "within one character". `blindConfidence` belongs to the strongest scale but is worded as the selection's. |
| C5E-7 | P2 | Measured declared limits, the same as 005D. Confident misreads still reach STRONG. The override never examines a selection that is already ≥ SUPPORTED, even against a substantial CLEAR rival. STRUCTURAL can record a wrong total. |

## C5E-1 (P0): low-margin SUPPORTED readings corroborate, so §29's adversary is STRONG without its children

**Rule.** `numeric-lattice.ts:676-683` (bounds at `:82`) classes an ink as:
- CLEAR when asReadP ≥ 0.6 and margin ≥ 0.3;
- **SUPPORTED when asReadP ≥ 0.35, whatever the margin**;
- AMBIGUOUS otherwise.

The metric gate `qualified = ocrClass !== 'AMBIGUOUS'` (`metric-solution.ts:913`, used at `:643`) lets any SUPPORTED ink complete a corroborating pair. The CANDIDATE_CONSENSUS search (`:1024-1041`) looks only at AMBIGUOUS inks, and only once the aware tier has already dropped below SUPPORTED (`:1019`).

Brief §3 says "low-margin or ambiguous labels cap metric confidence". Contract Q classed AMBIGUOUS by runner ratio ≥ 0.9 (a coin toss). The README (`:138`) says the check "covers … coin tosses (AMBIGUOUS)". Under the shipped rule, that is no longer true.

**What the probes show** (scale truth 2.20; both "wrong" verdicts are measured):

| page (`scen.ts`, `scen29.ts`) | 005D | 005E HEAD |
|---|---|---|
| §29 inks exactly as in the test (`1150` [.3,.25,.2,.18], `720` [.5,.45]), **no children**, shipped classes (A AMBIGUOUS p .32; B **SUPPORTED** p .53, margin .10) | CONFIRMED/STRONG 2.057 (wrong) | **CONFIRMED/STRONG 2.057 (wrong)** |
| the same two inks hand-labelled AMBIGUOUS | CONFIRMED/STRONG (wrong) | CONFIRMED/INCONCLUSIVE, CANDIDATE_CONSENSUS |
| S1a: two one-glyph coin tosses, `1130` [.52 / `1230` .44], `710` [.50 / `770` .46], both SUPPORTED | CONFIRMED/STRONG 2.023 (wrong) | **CONFIRMED/STRONG 2.023 (wrong)**, no record |
| §29 with the CLEAR children | CONFIRMED/STRONG (wrong) | CONFIRMED/INCONCLUSIVE, BETTER_CLASS_RIVAL (held by the contest, not by the class) |

- `pre/false-consensus-review.md:223` states the expected outcome for §29 without its children: "the class rule gives WEAK and C3(b) fires … → INCONCLUSIVE". HEAD gives STRONG at −6.5 % (area −12.6 %).
- The tests hide this:
  - `ocr-metric-adversaries.test.ts:139` labels `[720 .5, 770 .45]` AMBIGUOUS, but the shipped rule gives SUPPORTED.
  - The §15 "two AMBIGUOUS labels agreeing" test (`:193`, `:204`) labels `[1100 .5, 1700 .3]` AMBIGUOUS, but the shipped rule gives **CLEAR** (p .625, margin .40).
- Exposure on the development pages:
  - 213 of 329 SUPPORTED lattices have a worst runner ratio ≥ 0.9, which makes them coin tosses under contract Q.
  - 12 SUPPORTED lattices have a **negative** margin, meaning the reader prefers another value. One example is kosacce `133`, where `123` scores .558 against .356.
  - Labelled SUPPORTED inks with margin < 0.3: 1 right, 3 wrong. SUPPORTED overall: 22 right, 12 wrong.

**Generic fix.** Low margin caps confidence. Either:
- add a margin bar to the class rule, so that SUPPORTED requires probabilityMargin ≥ `clearMargin` (0.3), else AMBIGUOUS; or
- apply the same bar in the metric layer (`qualified`) and in the candidate-consensus set.

Then re-class the test fixtures with the shipped rule, not by hand, and add §29-without-children as a test.

**Regression risk (measured).** The replay of all 14 development frames, with the bar applied to the lattices: no row changes relation, confidence or scale (`replay-all.txt`, column CLS). Among the counted-like inks, only two cross the bar:
- eoze `1600` (correct, margin .19). Its pair still holds `760` SUPPORTED, so the row stays STRONG.
- willa's rival `1010`, which is a misread of `1410`.

With the fix, the §29-without-children page and S1a give INCONCLUSIVE (`fixcheck.ts`). The calibration tables need re-running, with TARGET still unused.

## C5E-2 (P1): the override demotes true scales against a vote with zero independent readings, and its triggers are cheap

- When `falseConsensus` fires, `ownDeciding` is forced to INCONCLUSIVE (`:1054`). `beatsLegacy` (`:1066`) then refuses the REPLACE, and the vote's scale becomes the first reading, even when the vote has **no** independent reading. Contract C3 said "relation kind kept".
- The triggers:
  - **BETTER_CLASS_RIVAL** (`:1022`): a rival with standing, and *any* counted ink of the rival better than the worst demoted one. Standing (`:896`) needs only one counted ink (≥ 55 px) that does not fit back. There is no share bar, although the contract's standing required ≥ 0.25. The better-read ink does not even have to be the one with standing.
  - **CANDIDATE_CONSENSUS** (`:1030-1031`): searches all ≤ 8 alternatives of each ink. On the 299 development AMBIGUOUS lattices, a **true** pair read right fires it by chance in 15.8 % (scale 2.2) to 18.5 % (scale 2.75) of cases, counting only scales within ±30 % (`chance_cc2.py`).
- **Non-monotone (fixtures, `scen3.ts`, `scen4.ts`).** True scale 2.2; the page vote is 1.9 and rests on LOW inks only.

  | page | 005E |
  |---|---|
  | one AMBIGUOUS overall | REPLACED/WEAK **2.2** |
  | two AMBIGUOUS inks (X + Y) | REPLACED/WEAK **2.2** |
  | two AMBIGUOUS inks plus an unrelated 60 px CLEAR `71` | LEGACY_UNCONFIRMED/INCONCLUSIVE **1.9**, BETTER_CLASS_RIVAL naming 1.18 cm/px |
  | S8: two AMBIGUOUS inks whose alternatives `1180`/`740` agree by chance | 1.9, CANDIDATE_CONSENSUS |
- **Real house** (`replay-lz.ts`, azaliach selected frame).
  - With the correct `670` counted (see C5E-4), the blind tier is STRONG and the aware tier WEAK. BETTER_CLASS_RIVAL then fires on a 73 px CLEAR `71` at 0.979 cm/px (−47 %).
  - The result is LEGACY_UNCONFIRMED/INCONCLUSIVE at the vote's **2.462** (+32 %), instead of REPLACED/WEAK at **1.8615**, which is the transcribed truth (`1035`/556 px, `670`/360 px).
- **Generic fix** (`modfc`):
  - (i) The better-read ink must itself stand against the selection (not fit back) and measure at least `WITNESS_SHARE.substantial` of its axis.
  - (ii) Candidate consensus uses only alternatives the ink holds ≥ `contestRatio` (0.5). This cuts the chance rate on true pairs to 4.1–5.0 % (to 1.4–1.8 % at 0.7).
  - (iii) Decide, per the contract, whether a false consensus may move a REPLACE to the vote. If it may, require the vote to have an independent reading of its own.
- **Regression risk (measured).** Replaying the 14 development rows with (i)+(ii), alone and with C5E-1: no row changes. azaliach with `670` counted keeps 1.8615 REPLACED/WEAK. §29 and S1a stay INCONCLUSIVE. S1b keeps BETTER_CLASS_RIVAL, and S9a returns to REPLACED/WEAK 2.2.

## C5E-3 (P1): anti-aliasing: one AMBIGUOUS ink replaces the vote at +42 %; WEAK does not protect it

- **`aa.ts`**, the §41 sheet with a 3×3 blur:

  | | result | relation | ink reads |
  |---|---|---|---|
  | 005D | 2.294 (−8.2 %) | REPLACED/WEAK | `1100` |
  | 005E | **3.545 (+41.8 %)** | REPLACED/WEAK | `1700` (AMBIGUOUS, alternatives led by `1200`) and `700` (AMBIGUOUS, alternatives led by `300`) |

- Both top alternatives state the true **2.50** (1200/480, 300/120). Neither the blind tier (one ink per scale) nor the candidate check sees this.
- The test comment (`dimension-topology.test.ts:456-462`) relies on "the pipeline's first-success challenge". But the challenge only weighs `metricScales` (hypotheses from as-read values) and `latticeScales` (zero-substitution readings) (`plan-resolution.ts:249`, `:283`). 2.5 is neither, so the challenge cannot recover the true scale (inferred from the code, not run). In blind conditions this is a scale error that only a published figure could veto.
- `beatsLegacy` (`:1066`) lets a deciding set made only of AMBIGUOUS inks replace a vote that has no members. By the README's own table, an AMBIGUOUS reading is right only 11 times in 37.
- **Generic fix** (`modaa`): do not replace on a WEAK, AMBIGUOUS-only deciding set when one of its inks and another counted AMBIGUOUS ink hold alternatives (≥ `contestRatio`) that agree on another plausible scale. The result is then LEGACY_UNCONFIRMED/INCONCLUSIVE and the challenge still runs.
- **Measured:** the anti-aliasing sheet gives LEGACY_UNCONFIRMED/INCONCLUSIVE, which satisfies the scale clause, so `it.fails` must be flipped to `it`. The reference sheet is unchanged. All 14 development rows are unchanged, including azaliach with and without `670` and tunbergiach (`replay-aa.txt`).

## C5E-4 (P2): the leading-zero test uses the 005D text after the lattice re-read

- `metric-solution.ts:461` sets `leadingZero` from `entry.token.text`, the 005D raw read. That flag excludes the witness at `:479`, while the value comes from `lattice.asRead`.
- azaliach `670` (transcribed 670, raw `010`) is recorded with `rawText: "670", leadingZero: true` on both twin chains, and never counts.
- **Fix:** test the as-read string for witness decisiveness, and keep the 005D text for the orientation typography test (contract R1). Land it **after** C5E-2.
- **Measured** (`replay-all.txt`): LZ alone flips azaliach to the wrong 2.462. LZ with C5E-2 keeps 1.8615. All other rows are unchanged.

## C5E-5 (P2): twin lines double a coin toss when their marks round apart

- `parallelCopiesOf` (`:1396`) accepts marks within 2 px. But the statement key (`:823`) is `twinRoot|round(fromPx)|round(toPx)` of each reading's *own* span.
- On m1, 89 of the 232 PARALLEL_COPY_OF relations have at least one mark whose rounded pixel differs between the twins. Examples: 385.5 against 387.5, and 181.5 against 180.5.
- **S6** (`scen.ts`): the same `710` coin toss on twin Y lines.
  - Marks identical: WEAK in both solvers.
  - Marks 0.6 px apart: **SUPPORTED in both 005D and 005E**, which skips the challenge.
  - Adding a SUPPORTED X misread makes it **STRONG** at −8 %.
- The bug is in 005D, but the 005E lattice cache returns identical lattices for identical crops, so the twin's reading is always the same.
- No development selected frame has a counted twin pair (`twins.py`).
- **Fix:** key a statement by the twin root and the *indices* of the matched marks (the 2 px twin match), not by rounded pixels. No development row should change.

## C5E-6 (P2): the false-consensus record is partly misleading

- **Candidate scale.** CANDIDATE_CONSENSUS returns the first pair found in ascending value order (`:1030-1035`). On S1a′, S2a and S4a the true pair (`1230`+`770` → 2.2) is present, yet the record and the `why` name **2.112** or **2.1185**, a chance pair such as `1180`+`740`. Readers will take it for the suspected truth. Record every distinct candidate scale (bounded, sorted), with the pair behind each.
- **Demoted ids.** `demotedObservationIds` (`:1016`) includes every AMBIGUOUS counted ink. The `why` (`:1049`) says they "do not decide", but uncontested AMBIGUOUS inks still count, still measure axes, and can still be the overall reading. Split the list into *contested* and *cannot corroborate*.
- **"Within one character".** The `why` (`:1316`) still says the readings fit the rival "within one character". Contests now use alternatives with two substitutions or a re-cut segmentation.
- **Blind tier.** `blindConfidence` is computed on `strongest` (`:1018`) but worded as "{selected} stands …". The two differ whenever the aware ranking moved the selection.
- The record does reach the user: the Evidence Pack carries `topology` and the `why` (`pack.ts:431`, `:438`).

## C5E-7 (P2): what the class still cannot see (measured; the same as 005D)

- **S2c:** two AMBIGUOUS misreads plus one CLEAR misread on three chains → STRONG (wrong).
- **S3b:** a misread overall plus confidently misread children → STRONG (wrong). STRUCTURAL records the total as `1200` (the misread children's sum), although the true `1230` is in its lattice.
- **S3c:** a correct total is refuted by a CLEAR misread child.
- **S1d:** two SUPPORTED misreads, with the truth under the contest bars (p ratio .33, glyph ratio .65), replace a vote stated by two CLEAR children: **REPLACED/STRONG at −8 %**. `falseConsensus` is only evaluated when the aware tier is already below SUPPORTED (`:1019`), so a selection that is already ≥ SUPPORTED is never checked.
- **Extension:** run BETTER_CLASS_RIVAL for selections with no CLEAR deciding ink when a standing rival ink is CLEAR with share ≥ 0.25. No development frame has such a rival (`clearrival.py`), so the measured risk is zero.

## Development rows whose relation or confidence changed versus 005D (m1 = m2 on the metric)

| row | 005D → 005E | right? |
|---|---|---|
| rarytasy-g2e | LEGACY_UNCONFIRMED/INCONCLUSIVE → CONFIRMED/STRONG at the same 2.7497 | **Yes.** 005D read `1170`/`1751`. The witnesses are now `1470` (SUPPORTED; printed 1474, 1.2 px off) and `1720` (AMBIGUOUS; right). METRIC_SCALE_UNSUPPORTED is cleared; the row still fails on openings and invariants. |
| kosacce (both rows) | SUPPORTED → STRONG at the same 2.4058 | **Yes.** `1660`, `1260` and `521` are now read right. The rival's `840` (printed 890) is contested. |
| rarytasy-eoze | 2.2236 → 2.2222 | **Yes.** `1600` is printed; 005D read `1601`. |
| dom-w-dabecjach | CONFIRMED/STRONG 2.672 (false) → REPLACED/STRONG **2.8113** | **Yes, through the reader, not through promotion.** Five SUPPORTED witnesses (`1580`, `850`, `888`, `692`, `304`), all transcribed right. The row still fails at the boundary stage, which is not metric. |
| dom-w-tunbergiach | LEGACY_UNCONFIRMED/INCONCLUSIVE 1.9947 → REPLACED/WEAK **2.091** | **Yes.** Footprint −12.5 % → −0.5 %. `1171` (printed 1173) is vote-neutral, so the result is WEAK and the challenge runs (KEPT, 117.1 m², −0.5 %). |
| dom-w-azaliach | REPLACED/WEAK 1.8975 → 1.8615 | **Yes.** `1035` is read right (005D read `1055`). It still rests on one AMBIGUOUS ink; see C5E-3 and C5E-4. |
| dom-w-modrzykach | REPLACED/STRONG, 2.74839 → 2.74889 | **Yes.** `624` is now read right (005D read `621`). Footprint −0.14 % → +0.66 %. |
| dom-w-jablonkach | REPLACED/WEAK, same scale | The m1 −16.9 % came from the re-solve. fix2 and m2 restore a 99.0 m² footprint (model `6c8cf347`), and the row now PASSes. |

No development row lost confidence, and `falseConsensus` fired nowhere. The protection's demotions (C5E-2/3) are therefore shown only on fixtures and on the azaliach replay with `670` counted.

## Checked and found sound

- **The contest is symmetric and holds when the truth is offered.** S1b, S1c, S1e, S3a and §29 with children are all INCONCLUSIVE or WEAK, and the rival is never promoted (`:929`).
- **Coin tosses, LOW_QUALITY readings, one ink read two ways.**
  - Three AMBIGUOUS inks on three chains: INCONCLUSIVE (S2a/b).
  - An AMBIGUOUS pair plus a LOW_QUALITY truth: INCONCLUSIVE, with the LOW ink never counted (S4a/b). 005D was STRONG wrong on S4b.
  - One ink read CW and CCW forms one region and never two witnesses (S7).
- **The challenge triggers downstream.** The trace shows METRIC_CHALLENGE on tunbergiach, jablonkach and willa. `firstReadingNeedsChallenge` (`plan-resolution.ts:920`) challenges any first reading below SUPPORTED or not chosen, so the override's INCONCLUSIVE always triggers it.
- **The aware tier is applied on every path.** LEGACY_UNCONFIRMED confidence uses aware evidence (`:1076`). ADDED needs `own` ≥ SUPPORTED, so a false consensus can never ADD.
- **Determinism and agreement with the runs.** The replays reproduce every m1/m2 decision.
- **Nothing was written under the publisher bytes.** No crop was made; `/home/user/work005e/views-post-c5e/` was not needed.
