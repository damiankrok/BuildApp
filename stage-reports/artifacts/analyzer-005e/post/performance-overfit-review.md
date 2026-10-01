# 005E post-implementation review D — performance and overfit (reviewer `d5e`)

- **HEAD** `8b8bd396a167d632c0309392699c0d7eeb749a7a` (diff against the 005D freeze `d8ba4e8`). Read-only on the repository; the worktree is clean.
- **Read:** `common.md`, `d.md`, brief §4–§20, §32–§40; the implementation contract and the four pre-reviews; `calibration/README.md`;
  `numeric-lattice.ts` (all of it); the 005E diffs of `ocr.ts`, `metric-solution.ts`, `extract.ts`, `chains.ts`, `hash.ts`, `schema.ts`,
  `pack.ts`; `numeric-lattice.test.ts`, `evidence-pack.test.ts`; `checkpoint.ts`; `AnalyzerScreen.kt`; the 005D matrix JSON.
- **Ran** (scripts in `.cache/review-d5e/`; only numbers leave the publisher caches; the one full row went to `/home/user/work005e/views-post-d5e/rerun/`):
  - `perf.py`: m1 and m2 against the 005D matrix (wall, METRIC_FRAMES, RSS, tick and telemetry gaps; lattices, expansions, cache hits, truncation).
  - `prof-lattice.ts`: every plan frame of kosacce-clean (4 frames, 335 labels) and dom-w-tunbergiach (12 frames, 258 labels): per-label time,
    lattice against `readNumbers`; a second pass on the same cache (all HIT) and a third without a cache, compared by content.
  - `biglabel.ts`: per-label cost against label size (synthetic, cap 15–200 px).
  - `cmp-lat.py`: `numericLattices` of m1 against m2 (two independent matrix runs) on all 18 rows.
  - **One full development row re-run at HEAD** (dom-w-modrzykach, alone after m2 had finished), compared with m2 byte for byte.
  - `sweep.ts` on a patched copy of `source-metrics/src` (`.cache/review-d5e/sm/`; the inline literals turned into one mutable object):
    **87 one-at-a-time ±20 % moves of 44 constants**, each on both corpora (480 labels), the 81 development labels by split, and a replay of the
    selected plan frame of 14 development-matrix rows. At the shipped values the copy reproduces every README table exactly
    (as-read 249, top-8 376, CLEAR 82/88, SUPPORTED 128/196, FIT/HB/TARGET as-read 20/14/7, top-8 42/19/10), and the 14 replays reproduce
    the m2 relation, confidence and scale of the selected frame 14/14.
  - `delta-probe.ts` (STRICT δ 38/43/48/53/58 on three frames), `stability.ts` (as-read stability under δ ±10 %), `contrast.ts`, `pathids.ts`;
    the hard-code guard; `android-contract.test.ts`.

## Findings

| ID | Sev | One line |
| --- | --- | --- |
| D5E-1 | P1 | The witness value (the as-read string) and three matrix outcomes sit on a knife edge of the STRICT mask's δ = 48: ±10 % flips a FIT row's STRONG and the TARGET row's relation, ±20 % puts a HELD_BACK row on a wrong scale (+1.9 %) in both directions. |
| D5E-2 | P2 | The calibration record overstates its split hygiene: TARGET and HELD_BACK labels were inside the sets that proposed the ink variants, δ 48/60 and the as-read rule; the TARGET house's STRONG is the least robust outcome of the sweep. |
| D5E-3 | P2 | Inert and undocumented bounds: `clearMargin` can never bind at `clearP` 0.6; 12 further constants change no outcome on any of the three sets at ±20 %; `LATTICE_LABEL_GLYPHS`, the segmentation geometry, `hfill`/paired-hole factors, UNRESOLVED 0.9 and the structural caps are not in the README's table. |
| D5E-4 | P2 | Two declared bounds are exceeded on real labels (9 sequences on 129/3642 lattices; anchors of 8–19 cells on 88 paths); the bound test asserts both on 30 synthetic labels that never reach them. |
| D5E-5 | P2 | `pathIds[0]` is documented as the path that decided a sequence's score; it is not in 1488/2626 multi-path sequences, and Evidence Pack layer 07 reports it as the sequence's `segmentation`. |
| D5E-6 | P2 | The cross-label lattice cache never hits (0 of 3642 lattices, 18 rows) yet keeps every crop and lattice for the run; its HIT path is correct. |
| D5E-7 | P2 | A production comment quotes calibration figures no split reproduces (AUC 0.85 vs 0.72); the README's own figures hold on FIT only — on HELD_BACK the worst runner ratio separates better. |
| D5E-8 | P2 | §33/§35 recording: no run artefact records OCR or lattice time, and the phone shows no step line during `OCR_LATTICE` (no mapping in `AnalyzerScreen.kt`). |

No P0. Performance, cache safety and determinism hold. See the last section.

## D5E-1 (P1) — the as-read witness is a function of one mask threshold, and the matrix outcome follows it

**Evidence (ran).** Sweep, STRICT δ (`numeric-lattice.ts:239`, `[48, 60]`), selected-frame replays, truth from the printed labels' implied
scales (`development-labels.json`: printed ÷ spanPx):

| row (split) | truth cm/px | δ 38 | δ 43 | **δ 48** | δ 53 | δ 58 |
| --- | --- | --- | --- | --- | --- | --- |
| dom-w-azaliach (HELD_BACK) | 1.861–1.864 | REPLACED/WEAK **1.8975** | 1.8615 | REPLACED/WEAK 1.8615 | 1.8615 | REPLACED/WEAK **1.8975** |
| dom-w-dabecjach (TARGET) | 2.802–2.816 | LEGACY_UNCONFIRMED/INCONCLUSIVE 2.672 | LEGACY_UNCONFIRMED/INCONCLUSIVE 2.672 | REPLACED/STRONG 2.8113 | REPLACED/SUPPORTED | REPLACED/SUPPORTED |
| rarytasy-g2e (FIT) | 2.755–2.761 | CONFIRMED/WEAK | CONFIRMED/WEAK | CONFIRMED/STRONG 2.7497 | CONFIRMED/WEAK | CONFIRMED/WEAK |
| dom-w-modrzykach (HELD_BACK) | 2.749 | REPLACED/WEAK | — | REPLACED/STRONG | — | REPLACED/STRONG |

- Mechanism (`delta-probe.ts`): the as-read string is the anchor of whichever variant has the best `segScore` (`numeric-lattice.ts:588–594`),
  so moving δ by ±10 % changes the **as-read string of 10–15 of 75–92 label inks** on these frames (±20 %: 13–22). On azaliach the printed
  overall `1035` is read `1035` (AMBIGUOUS) at δ 43–53 and `1055` at δ 38/58 — at δ 38 that misread is classed **SUPPORTED** and becomes a
  witness of the wrong scale. On dabecjach at δ 43 the `692` ink falls back to the DEFAULT anchor's `643` (the 005D misread) and the frame
  loses its scale; on g2e the printed overall `1720` stops witnessing at δ 43 and δ 53.
- Corpora and labels fall on both sides too (as-read 249 → 242 at δ 38, 248 at δ 58; HELD_BACK CLEAR 6/6 → 3/3 at δ 38).
- The same shape, smaller, for the other constants that touch the witness: `hfill` penalty 0.85 (`ocr.ts:593`; 0.68 → g2e and dabecjach
  lose STRONG, corpus as-read −6; 1.02 → willa-miranda SUPPORTED → STRONG), the softmax T 0.05 (0.04 → dabecjach STRONG → SUPPORTED),
  `contestRatio` 0.5 (0.4 → modrzykach and dabecjach lose STRONG; 0.6 changes nothing), SAUVOLA k 0.2 and R 128 (0.16 and 102 → willa-miranda STRONG),
  dropping SAUVOLA (modrzykach STRONG → WEAK). The other 37 of the 44 constants change no frame outcome (D5E-3).
- Not contrast drift: label ink/paper levels are alike on all 13 publisher plans (contrast 174–196 grey levels, δ 48 = 24–28 % of it;
  `contrast.ts`). The instability is per label: a reading that one threshold step flips was never decided by the image.
- Does instability mark wrong readings? `stability.ts` (δ 43/48/53): corpora — stable as-reads right 229/403 (57 %), unstable 20/77 (26 %);
  among CLEAR+SUPPORTED, stable 201/264 (76 %), unstable 9/20 (45 %). Development labels: only 11 of 81 unstable, 5 right, so the evidence
  there is thin.

**Why P1 and not P0.** Nothing shows δ was fitted to a named house. FIT, HELD_BACK and TARGET rows all move. But the stage's claim that the bounds
"survive a different but reasonable choice" fails for the one variant threshold the witnesses depend on. On a blind house a similar share of label inks
will sit near a variant boundary, so a STRONG verdict there may rest on readings the image does not decide. The class gives no sign of it (the azaliach `1055`
is SUPPORTED).

**Generic fix.** Treat variant-threshold instability as reader evidence. Read STRICT, and SAUVOLA's k, also at a fixed bracket (for example ×0.9 and
×1.1), the anchor's top string only. This is image-only, adds a fixed number of masks per crop, and costs well under the lattice's 3.5 s per row. When the as-read **value** is not the same
across the bracket, cap the ink's class at AMBIGUOUS: it does not corroborate, and every alternative contests (M2/M3 unchanged). Record the bracket's
values beside `asReadVariant`. Choose the bracket width on the corpora and FIT, never by its matrix effect. **Regression risk:** this demotes
confidence and never moves a scale. Expect g2e and dabecjach to lose STRONG: within ±10 % their deciding inks change value or class (g2e `1720`, `620`,
`1470`; dabecjach `692`, `304`). Azaliach stays WEAK. Re-run all 15 rows; do not tune the bracket to win them back.

## D5E-2 (P2) — calibration provenance: what "FIT chooses, HELD_BACK checks, TARGET never chooses" really covered

- `calibration/README.md:9–14, 25, 29` say the ink variants and the as-read rule were chosen on FIT and the corpora and checked on HELD_BACK,
  and that TARGET never chose a number. But:
  - pre-review A's variant table (`segmentation-review.md:5–7, 116–126`) counts its as-read and in-set columns over 143 labels, 23 of them
    the TARGET houses'. Its "named blind" column shows SAUVOLA reading `850` and `1580`.
  - pre-review B proposed δ 48/60, T 0.05, ρ 0.6 and `hfill` on 8 houses, 3 of them now HELD_BACK (`classifier-review.md:12–13`). B's blind
    table shows "Mask 48/60 reads `1580`" (`:107–113`), and the contract repeats it as the reason for STRICT (`implementation-contract.md` §0).
  - the README's as-read evidence "13 wrong→right, 1 right→wrong" (`:29`) is all 81 labels. Measured: FIT 6/1, HELD_BACK 4/0, TARGET 3/0.
- In the sweep the TARGET row's STRONG is the least robust outcome: it is lost under 5 of the 87 single moves (T 0.04, `contestRatio` 0.4,
  δ 38 and 58, `hfill` 0.68), and at δ 43 and 53 in the probe. That is what one would see if the target had steered choices. It is equally what one sees at a
  point tuned on development houses where the target is simply marginal. It proves nothing; it only means the TARGET rows cannot serve as
  evidence of generalisation.
- **Fix (docs only):** state in the README that HELD_BACK houses and TARGET labels were inside the pre-review measurements that proposed
  STRICT, SAUVOLA, T, ρ and `hfill`. Give the as-read evidence by split. Treat round 5 as the only clean check. No regression risk.

## D5E-3 (P2) — inert and undocumented bounds

- `clearMargin` is mathematically inert. Probabilities over the emitted set sum to 1, so with `asReadP ≥ 0.6` the best rival is ≤ 0.4
  and `probabilityMargin ≥ 1 − 0.4/0.6 = 0.333 > 0.3` (`numeric-lattice.ts:669, 676`). The sweep agrees: 0.24 and 0.36 change nothing.
  The README states CLEAR as "p ≥ 0.6 **and** margin ≥ 0.3".
- No outcome changes at ±20 % on any of the three sets (corpus and label recall and classes; frame relation, confidence, scale and
  topology records) for 12 more: `floor`, `beam`, `textsPerVariant`, `maxCells`, `class.legibleCapPx`, `latticeAlternatives`,
  STRICT abs 60, SAUVOLA abs 110, the alphabet bar 0.6 (`:368`), the paired-hole floor 0.35, and the structural ≤ 9 items and ≤ 2 choices.
  UNRESOLVED 0.9 is not observable by my replay, which counts non-AS_READ selections. "Chosen on FIT" is vacuous for these; they are
  untested.
- The class depends on `mass` and `sequences`, because `asReadP` is normalised over the emitted set (`:617, :626`). At mass 0.76, CLEAR is
  128/146 on the corpora (vs 82/88) and 7/9 on FIT. Class bars and emission bounds are therefore one calibration, not two.
- Not in the README table: `LATTICE_LABEL_GLYPHS = 6` (`extract.ts:972`); the segmentation geometry 0.55/0.3/1.45/0.2/0.95
  (`numeric-lattice.ts:279, 286, 289–290, 317–318`); `hfill` 0.15/0.85 and the paired-hole 1.1/0.35 (`ocr.ts:593, 598`); UNRESOLVED 0.9
  (`metric-solution.ts:1219`); structural ≤ 9 items and ≤ 2 choices (`:1546, 1556, 1563`); `latticeAlternatives` 8 (`:255`).
- **Fix:** drop `clearMargin` or define it so that it can bind. List every constant with its sweep sensitivity. Mark the inert ones untested.
  No behaviour change; no regression risk.

## D5E-4 (P2) — declared bounds exceeded in production; the bound test cannot see it

- In m1/m2 (identical lattices), **129 of 3642 lattices emit 9 sequences** (`LATTICE_BOUNDS.sequences` = 8). In every one of them the as-read
  string is appended 9th after the COUNT cut (`numeric-lattice.ts:614–615`). Docs (`METRIC_EVIDENCE.md` "eight sequences") and the contract's
  "K ≤ 8" say otherwise.
- **88 of 39600 paths have 8–19 cells** (`maxCells` 7). `maxCells` only stops re-cuts (`:276`); the beam still runs over the anchor, at a cost
  linear in its cells. Examples: STRICT anchors such as `111111111111` and `°5--.,521--`.
- `numeric-lattice.test.ts:69` and `:74` assert both bounds on `digitCorpus(…, 3)` (30 labels) and pass.
- Cost stays bounded by geometry: expansions p50 68, p99 490, max 767. This is a contract and test defect, not a runaway.
- **Fix:** emit at most K−1 before appending the as-read string, or document K+1. Give an anchor of more than `maxCells` cells no beam
  (as-read only, LOW_QUALITY). Run the bound test on the m-matrix shapes too: a synthetic long noise token and a forced as-read
  append. Regression risk: nil for the first fix. The second touches 88 junk paths whose as-read values parse as no dimension.

## D5E-5 (P2) — `pathIds[0]` misattributes the deciding path, and Evidence Pack 07 publishes it

- `LatticeSequence.pathIds` is documented "best first; the first decides its score" (`numeric-lattice.ts:139–140`). But `offer` keeps
  insertion order and only replaces `path`/`logP` (`:568–570`).
- `pathids.ts` (corpora): **1488 of 2626** multi-path sequences (321 of them as-read) name a first path whose log-probability is lower than
  the recorded one. Example: `280`, pathIds `DEFAULT:0,STRICT:0,SAUVOLA:0`, logP −0.236, which is SAUVOLA's (DEFAULT gives −0.921).
- `pack.ts:327` exports `segmentation: q.pathIds[0]`, so layer 07 names the wrong variant or segmentation for a candidate's image score in
  more than half the multi-path cases. §36 asks reviewers to check that "Evidence Pack exposes candidates correctly". No value or scale
  is affected.
- **Fix:** when a later path wins, move its id to the front (or sort `pathIds` by per-path logP, ties by id), and add a test. Regression
  risk: `numericLattices` content, and therefore the metric evidence hash and the pack, change on every row. Models do not change.

## D5E-6 (P2) — the lattice cache is dead weight on real plans

- `extract.ts:292–294` says "a plan's twin copies are read once". On all 18 m1/m2 rows: **0 HIT of 3642 lattices**. Twin copies are not
  byte-identical crops.
- Every MISS still keeps the crop copy and the full lattice, paths with glyph arrays, until the run ends (`numeric-lattice.ts:494`).
  That is small (not measured; crops of a few KB plus the lattice objects) but buys nothing.
- What is right about it: key = FNV pair of the crop bytes + crop size + local box + radius (`:485`), bytes verified on a hit (`:488`),
  per run (`extract.ts:294`), no module state. HIT == MISS == no-cache by content on 593 labels. HIT results share arrays with the MISS
  result, and no consumer mutates them (grep of `metric-solution.ts`, `extract.ts`, `pack.ts`). The `cache` flag is outside the content
  hash (`hash.ts:142`) and outside the pack.
- **Fix:** drop the cross-label cache, keeping the per-variant glyph memo, which does work; or keep it and correct the comment. No
  regression risk.

## D5E-7 (P2) — a stale calibration figure in production code; the class measure is a near-tie

- `numeric-lattice.ts:75–77`: "AUC 0.85 against 0.72 for the worst runner ratio". No split reproduces this. Recomputed from
  `dev-lattice.json`: FIT asReadP 0.746, raw runner 0.646, as-read-path topology-aware 0.731 (the README's figures);
  HELD_BACK 0.806 vs **0.827**; all 81: 0.776 vs 0.780.
- The README's "separates right from wrong better" therefore holds on FIT only.
- **Fix:** quote the README's FIT figures and the HELD_BACK reversal. No regression risk.

## D5E-8 (P2) — recording and the phone's step line

- §33 asks to record OCR time. `performance.json` has phase durations only (`PhaseStats`, `checkpoint.ts:81–94`), METRIC_FRAMES includes
  callouts and chains, and no artefact carries lattice or `readNumbers` time. Labels, expansions and cache flags are recorded (`numericLattices`).
- §35: `OCR_LATTICE` ticks with `label/labelsTotal` (`extract.ts:364`) and the counters are truthful: 1-based, emitted before each label.
  But `AnalyzerScreen.kt:461–470` maps no `OCR_LATTICE`, so the step line goes blank for up to ≈ 1.2 s per plan frame. `labelsTotal` counts
  each ink once per pass that read it, so it overstates printed labels; that is fine for diagnostics.
- `metric-evidence.json` grows 2.9–3.5 MB per row (four rows measured; marcowki 3.4 → 6.3 MB; `numericLattices` ≈ 1.5–1.9 MB compact), and all of it is hashed.
- **Fix:** add per-subphase cumulative durations to `PhaseStats`. They are never hashed, so determinism is unaffected. Map `OCR_LATTICE` to
  a Polish step string ("etykieta %1$d z %2$d") or leave it explicitly unmapped. No model risk.

## Checked and found sound

- **Cost is bounded by counts and geometry, never by a clock.** No clock, randomness or locale call in the new code. The only
  `localeCompare` is 005D's tie-break in `scoreCell`.
  - Per label: 3 variants, ≤ 16 cuts per variant, ≤ 48 paths, memoised glyphs, beam ≤ 16×4 per cell. Observed expansions p50 68, max 767;
    corpora mean 173, max 591, as the README says.
  - kosacce-clean: lattice 3.76 s against 1.43 s of `readNumbers`. tunbergiach: 3.45 s against 2.86 s. That is ≈ 2–3 % of METRIC_FRAMES.
  - Per label: p50 6.5–8.1 ms, p95 33–38 ms, max 267 ms (the first, cold label of a process).
  - Synthetic labels: 25–90 ms at a 15 px cap, 0.4–0.66 s at 200 px. A tick precedes every label (`extract.ts:364`) and the checkpoint
    polls cancellation every ≤ 200 ms, so a cancel waits at most one label.
- **Matrix cost is within noise.** m1 against the 005D matrix:
  - METRIC_FRAMES −10 %…+22 %; the noise is as large as that, since kosacce-clean and -tracked do identical work in 131.6 and 107.8 s.
  - RSS 668–881 MB (005D 666–905). Largest tick gap 3404 ms (galaktyka, OBSERVE_ASSETS; 005D 3535); METRIC_FRAMES gaps ≤ 2113 ms
    (005D ≤ 2484).
  - m2 ran under heavier contention and is not a timing reference.
  - The quiet re-run of modrzykach: METRIC_FRAMES 118.6 s (005D 119.5 s), 734 MB (714), largest gap 1.07 s.
  - Retained pass fields are 0.6–2.8 MB per frame.
- **Determinism.**
  - `numericLattices` are byte-identical in m1 and m2 on all 18 rows. These are two processes under different load, and the lattice code
    did not change between the two commits.
  - The HEAD re-run of modrzykach equals m2 byte for byte: `metric-evidence.json`, metric hash, model, scene, candidate hash, all 33 Evidence
    Pack files and the manifest.
  - Sorts are total (logP rounded to 1e-6; ties by non-top count, then text). Map iteration order never reaches the output.
- **Hygiene.**
  - The diff adds no image or binary file (`git diff --numstat`). `development-labels.json` is text facts. `.cache/` is git-ignored and
    `/home/user/work005e` is outside the repository.
  - The hard-code guard passes (6 tests), and the production diff names no house and no printed value. `android-contract.test.ts` passes at
    HEAD (hashes only changed).
  - Versions are consistent: evidence 1.4.0, reader 1.3.0, solver 1.2.0, lattice 1.0.0, all in `extractors` and so in the content hash
    (`hash.ts:130`). No version-keyed result cache exists (only per-job byte caches), so no stale directory can serve old answers.
- **Robust to ±20 %:** 37 of 44 constants change no frame outcome. These include every class bar: classes move counts a lot but no
  verdict. The corpus and label effects of the rest are listed in `.cache/review-d5e/sweep-compact.txt`.
