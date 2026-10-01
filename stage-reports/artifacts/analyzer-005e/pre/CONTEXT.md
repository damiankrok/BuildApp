# 005E pre-implementation review — shared context (read this first)

You are ONE of four independent, focused, READ-ONLY reviewers for stage BUILDPLAN-ANALYZER-005E
("numeric OCR candidate lattice + glyph confidence + non-circular sequence decoding"). Answer only your own question.

## Why the stage exists (round-4 blind failures, both in the numeric reader)
- `dom-w-dabecjach` (former blind 1): the overall width printed `1580` was read `1501`; the true value was absent
  from every bounded alternative. A second overall printed `850` (vertical) was read `810`. The two misreads agreed on
  one wrong scale (2.672 cm/px vs the printed 2.81) and the metric layer made it CONFIRMED/STRONG. Ticks, span binding
  and hierarchy were right.
- `dom-w-tunbergiach` (former blind 2): the overall printed `1173` was read `1117`; the truth needs TWO glyph
  substitutions; the 005D one-substitution limit (`boundedValues`) dropped it. The correctly read `1000` (other axis)
  supported 2.092 cm/px; `1117` supported 1.995; tie → INCONCLUSIVE → the house completed 12.47 % small.
- Root defect: the reader's candidate set is too narrow; when top-1 has more than one glyph error the true printed
  number disappears before metric reasoning. Second defect: two weak wrong reads agreeing can make a STRONG scale.

## Hard rules
- Do NOT modify any tracked file in /home/user/BuildApp and do NOT run any git command that changes state
  (no commit, checkout, stash, reset, branch). The coordinator is on branch `analyzer/numeric-ocr-lattice-v1`.
- Scratch code may go ONLY under /home/user/BuildApp/.cache/<your-id>/ (gitignored), e.g. vite-node probe scripts.
- Publisher bytes (drawings) are cached OUTSIDE the repo: development houses at /home/user/work005d/cache, the two
  round-4 houses at /home/user/work005d/blind-cache (fileByteCache from @buildapp/source-package). NEVER copy
  drawings, crops, glyph bitmaps or overlays into the repo. Local crops may be written to /home/user/work005e/views-<id>/
  and looked at with your image Read tool. Only text facts and numbers may come back (scores, boxes, counts).
- No project-specific logic may be proposed (no slugs, no `1580`/`1501`/`1173`/`1117`/`850`/`810` literals as
  decisions, no thresholds chosen to make one named house pass). Thresholds must come from a generic argument plus
  measurement across the development set / a synthetic corpus.
- Non-circularity is a hard rule of the stage: metric scale may RANK among numeric candidates the image reader
  generated on its own; it may NEVER invent a candidate. Candidate generation receives no scale and no published fact.
- Deliverable: ONE markdown file written to /home/user/work005e/pre/<your file name>, ≤ 250 lines, in English,
  measured (numbers from the actual bytes / sealed evidence), with: findings (P0/P1/P2), root cause, a proposed
  generic contract (rules a coder can implement, with bounds), negatives/risks, and what you measured on the
  development houses so the proposal does not regress them.
- CPU: 4 cores are shared with the coordinator and three other reviewers. Prefer label-level probes (seconds). If you
  must run a whole house (2–6 min), run at most one at a time.

## Codebase map (TypeScript monorepo, Node 22, vitest; run scripts with `npx vite-node <file.ts>` from /home/user/BuildApp)
- packages/source-metrics/src/ocr.ts — the numeric reader: `adaptiveInkMask` (source-cv) → glyph-sized components →
  `groupTokens` → `estimateShear` (13 slopes) → `segment` (projection valleys, expected glyph width 0.55·h, cut at the
  deepest column within ±0.3·expected of a uniform pitch) → `classifyCell` (Zhang–Suen thinning onto a 12×16 cell,
  symmetric RMS chamfer vs prototypes at 5 slants, × hole-count/position prior × aspect prior × size prior; one score
  per character; `alternatives` = ranks 2–4 with score > 0.2; `confidence` = best/(best+runner-up)). Token
  `score`/`confidence` = min over glyphs. `readNumbers` runs HORIZONTAL, ROTATED_CW, ROTATED_CCW (+INVERTED when
  `hypotheses`), raw tokens kept per pass; `dedupeOrientations` = legacy page vote.
- packages/source-metrics/src/font.ts — the template bitmaps (12 rows; digits, signs, alternate forms).
- packages/source-metrics/src/parse.ts — `parseNumber` (2–4 digit whole number = cm, decimals = m, …) and
  `readingLattice` (up to 24 strings: singles on every glyph, then pairs on the two least-confident glyphs; used by
  the LEGACY chain solver and `latticeFits`, i.e. after a scale exists — CHAIN_CORRECTED values).
- packages/source-metrics/src/chains.ts — legacy page-vote scale (`solveFrameChains`), `assignTokens`, `spansFor`,
  `solveChain` (DP; may correct a label to a lattice reading that fits the chosen scale → CHAIN_CORRECTED).
- packages/source-metrics/src/metric-solution.ts — 005B/005D independent scale solver `solveFrameMetric`:
  text regions (one ink one witness), `bindingsFor`/`primaryBinding`, `boundedValues` (005D V1: ONE substitution,
  glyph ratio alt/winner ≥ 0.7, ≤ 4 values, no leading zero), observations (decisive = PRIMARY ∧ span ≥ 25·tol ∧ cap
  height ≥ 10 px ∧ no leading zero), clusters, hypotheses, `evidenceTuple` [axesMeasured, corroborated, overall≥0.8,
  groups, weight], `confidenceOf` (STRONG = both axes ∧ corroborated; SUPPORTED = corroborated; WEAK = ≥1 group),
  V3 neutrality against the vote and against rivals (an ink whose bounded alternative fits the other scale decides
  nothing — but rival neutrality only acts when it would swap or tie the selection), V4 `valueAmbiguity`,
  `dimensionHierarchy` / `undecidedConflict`, relation CONFIRMED/REPLACED/LEGACY_UNCONFIRMED/ADDED/NO_SCALE.
- packages/source-metrics/src/extract.ts — per-frame loop: `readNumbers(raster, {hypotheses: isPlan})`, lines,
  chains, legacy solve, `solveFrameMetric`. schema.ts — MetricEvidenceSet schema 1.3.0 (`DimensionObservation`,
  `valueAlternatives`, `OcrToken`).
- packages/reconstruction/src/plan-resolution.ts — resolver 1.4.0 (first-success challenge, `sourceConflictOf`).
- packages/evidence-pack — post-hoc Evidence Pack (OCR_READING events, `firstDivergence`).
- Tests: packages/source-metrics/test/{ocr,glyph-ambiguity,label-binding,metric-solution,dimension-topology}.test.ts.
  Synthetic text: packages/synthetic-drawings (`Canvas.text`, its own 16×8 bitmap font — NOT the reader's templates,
  but still a bitmap font; anti-aliasing/blur cases fail today: `it.fails` in glyph-ambiguity.test.ts).
- Docs: docs/METRIC_EVIDENCE.md; stage-reports/STAGE_BUILDPLAN_ANALYZER_005D_DIMENSION_CHAIN_INTEGRITY.md (§J, §AA–AD,
  §AH); the 005D pre-reviews: stage-reports/artifacts/analyzer-005d/pre/ (ocr-binding-review.md especially).

## Ready-made local probes (in /home/user/BuildApp/.cache/e5/, gitignored — copy and adapt into your own dir)
- `npx vite-node .cache/e5/label.ts -- <pkg.json> <assetIdSubstring> <cacheDir> x0 y0 x1 y1 [out.png]` — reads the
  whole asset with today's reader and prints every raw token in the rectangle, per glyph: char, score, confidence,
  holes, alternatives, box; plus `boundedValues` and `readingLattice`; optional 8× crop PNG (outside the repo only).
- `npx vite-node .cache/e5/ascii.ts -- <pkg.json> <assetIdSubstring> <cacheDir> x0 y0 x1 y1 [CW]` — the de-skewed
  token mask with the segmenter's cuts (`|`) and the raw ink grey, as ASCII.

## Facts already established by the coordinator (verify, do not just trust)
- dabecjach, frame/asset `rzut-03a05dd085` (853×853, dimensioned ground copy; `rzut-1a56066c62` is a twin copy),
  package stage-reports/artifacts/analyzer-005d/holdout/h1-dom-w-dabecjach/source-package.json, cache blind-cache.
  * Overall width label, box 419,722–442,733 (h 12, italic): printed `1580`, read `1501`. ASCII shows `5`,`8`,`0` as one
    ink run; segmentation cut the `0` down its hollow middle (the deepest profile valley in the window is the 0's
    counter, not the 8|0 junction): cells `1` .565, `5` .420, `0` .164 (2 holes; the 8 plus the 0's left side), `1`
    .426 (the 0's right side). No alternative > 0.2 for the third cell. → a SEGMENTATION failure.
  * Vertical overall, box 72,304–83,322 (ROTATED_CW): printed `850`, read `810`: glyph 2 `1` .3956 vs `5` .3878
    (ratio 0.98) — a CLASSIFIER coin toss, kept as a bounded alternative but counted as a witness.
- tunbergiach, frame/asset `rzut-83377e8ffc` (twin `rzut-0b3cd56ccf`), package
  .../analyzer-005d/holdout/h2-dom-w-tunbergiach/source-package.json, cache blind-cache.
  * Overall width label, box 393,736–423,752 (h 17): printed `1173`, read `1117`: glyph 3 `1` .485 vs `7` .452 (0.93),
    glyph 4 `7` .436 vs `3` .405 (0.93). Segmentation looks right except the 7's top bar end lands in the 3's cell.
    `1173` is in `readingLattice` (two substitutions) but not in `boundedValues`. → a DECODER (one-substitution) failure
    on top of a weak classifier.
  * Vertical overall `1000` box 58,404–74,435 read as printed (glyph 1 `1` .457 vs `7` .229; zeros .65–.72).
- Sealed 005D runs (text, in repo): stage-reports/artifacts/analyzer-005d/holdout/h{1,2}-*/metric-evidence.json
  (dimensionObservations with rawText, spans, valueAlternatives; metricSolutions; ocrTokens).

## Development houses (all fixtures, none blind)
Packages: stage-reports/artifacts/analyzer-005b/dev/<house>/source-package.json for marcowki, kosacce-clean,
kosacce-tracked, rarytasy-g2e, rarytasy-eoze, alt-marcowki, dom-w-jablonkach, willa-miranda;
stage-reports/artifacts/analyzer-005b/holdout/h1-dom-w-zurawkach, h2-dom-w-modrzykach; analyzer-005c/aster-viii;
analyzer-005c/holdout/h1-dom-w-azaliach, h2-galaktyka; analyzer-005d/holdout/h1-dom-w-dabecjach, h2-dom-w-tunbergiach.
The 005D matrix outputs at the frozen code (observation-graph.json, metric-evidence.json, plan-diagnostics/digest.json
with `selectedPlanFrameId`) are at /home/user/work005d/m4/<house>/ — use them to find each house's selected ground
copy and its overall labels without re-running anything. Azalia's overall printed `1035` read `1055` (005D);
e-OZE's `1601` once read `1801` (005A) and is read right today.
Run a house offline (2–6 min): `CACHE=<cacheDir> /home/user/work005e/run-row.sh <label> /home/user/work005e/rev-<id> --package <pkg.json>`.
