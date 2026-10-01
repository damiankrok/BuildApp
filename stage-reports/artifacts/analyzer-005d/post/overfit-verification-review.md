# BUILDPLAN-ANALYZER-005D — post-implementation Reviewer D: overfit, verification, Evidence Pack

Reviewed: `git diff 7a18d21..6f3f996` (cc9f2ea, 0a83a0f, 09c5121, 6f3f996) on `analyzer/dimension-chain-integrity-v1`.
Read-only. Mutation tests ran in a scratch worktree (`.cache/review-d/wt`, since removed) with its own
`@buildapp/*` links, one mutant at a time, each reverted before the next. Uncommitted changes other agents made
in the main tree during this review (`plan-resolution.ts`, `reconstruct-v2.ts`, `source-conflict.test.ts`) were
**not** reviewed.

## Summary

| id | sev | finding |
|---|---|---|
| D-P0-1 | P0 | The §41 metamorphic test's "lower confidence" escape hatch passes a **REPLACED scale that is 8 % wrong** (anti-aliasing). 4 of the 9 imagings pass only through it. The pre-005D solver passes every scale clause too |
| D-P0-2 | P0 | The round-4 verdict condition R9 (`replacedByTheDrawing`) **can never fail**. It also does not check what `holdout/README.md` says it checks. It is frozen at the draw |
| D-P1-1 | P1 | The central thresholds were set by sweeping the development houses. The selection criterion includes catching the benchmark failure. No unit test pins any of them (mutants survive across wide ranges) |
| D-P1-2 | P1 | Five 005D rules have no test that kills them: I2, V3-against-the-vote, re-reading with topology, outer-total framing, and the whole resolver-1.4.0 pipeline path. Only network-dependent benchmark rows gate them |
| D-P1-3 | P1 | The `analyzer-evidence-pack` CI job is red at HEAD. It verifies a directory of committed packs that does not exist. README step 3 needs green CI to freeze |
| D-P2-* | P2 | 10 minor items (§5) |

## 1. Overfit

**Hard-code guard.** `npx vitest run tests/architecture/generalization.test.ts` gives 5/5 passed. The registry now
includes `misreadAsCm`, so `1055` and `1801` are registered. A grep of every added non-test line, and of
`packages/evidence-pack/`, `holdout/verdict.mjs` and the `*-row.mjs` judges, found no house name, slug or
registered number. (The only hits were "r**aster**", false positives.) The guard scans only the production
closure (`ROOTS`). `@buildapp/evidence-pack` is correctly a devDependency, so it is outside that closure and
**not scanned**. Neither are `holdout/*.mjs` or `scripts/dev-row.mjs`/`known-row.mjs`. These are the judges: a
house constant there biases the verdict, not the analyzer. Today they are clean, but nothing keeps them clean
(D-P2-6).

**`development-dimensions-005d.json` is correct.**
- Azalia: the ground plan's overall span is 556 px. The current reader reads `1055` (m2 run: PRIMARY `1055`,
  `valueAmbiguity` alternatives `1015,1035,1053,1005`). The pre-review's scale-free site-plan check (1035/670 vs
  556/359.5, 0.12 %) sets the printed value at 1035.
- e-OZE: the ground copies read `1601` over 720 px (REPLACED/STRONG 2.2236). The old CI comment records the
  005A misreading as 18.01 m.
- 005B's e-OZE value `1560` is the site plan's figure (`…sytu…` token `1560` h21), not a contradiction.
- Azalia's 670 and e-OZE's 760 are under 1000, so by design they are not registered.

**D-P1-1 — the thresholds are calibrated on the benchmark, and no generic test pins them.** Production comments say
so themselves, and the pre-reviews show the sweeps:
- `MARK_CLASS_BOUNDS.lighterThanLine = 0.75`.
  - `dimension-topology-review.md` §4 picks it from a rule sweep over the 8–9 development frames. One column of
    the sweep is "Azalia 204.5 caught".
  - κ < 0.60 is rejected because it "missed" Azalia (κ 0.67). The lowest real tick is κ 0.77, a 0.02 margin.
- `BINDING_BOUNDS.centred = 0.1` sits between the dev range 0.004–0.069 and the "watermark/planter" spans at
  0.147–0.165.
- `VALUE_BOUNDS.glyphRatio = 0.7` was weighed against its e-OZE effect (`ocr-binding-review.md` §6: "V3 at glyph
  ratio 0.5 also flags e-OZE `1601`").

Mutants that survive, run on the whole `packages/source-metrics/test` suite (146 tests) or on `source-conflict` +
`first-success` (16 tests):

| mutant | result |
|---|---|
| `lighterThanLine` 0.75 → 0.4 / 0.95 | 146/146 green (the synthetic wedge is κ ≈ 0.35, the drawn ticks κ ≈ 1) |
| `BINDING_BOUNDS.centred` 0.1 → 0.05 | green. Real labels sit up to 0.069 off-centre and no test has one; my probe showed 0.07 still binds at 0.1. Upper side: 0.3 is killed (2 tests) |
| rival-neutral tolerance `tol·(1+px/widest)` → `tol` / `5·tol` | green (the 1601/1801 fixture fits the rival to 0.4 px, so the extra slack is never exercised) |
| `MAJOR_SHARE` 0.5 → 0.2 / 0.95; `SUBSTANTIAL_SHARE` 0.25 → 0.05 | green. Only 0.6 is killed (through T2's reuse of the constant) |
| T2 `25·tolerancePx` → `40·tol` | green (10·tol is killed) |
| T3 "more than 5 % from the registration" → 19 % | green |

Probes with numbers other than the benchmark's show the rules are not keyed to the numbers:
- 1400/1600 over 640 px and over 644 px: the ink is still rival-neutral and 2.5 is selected.
- A label 0.07 off-centre stays PRIMARY.

So the thresholds are generic in form but **justified only by the benchmark**, and only round 4 can test them.

**Fix:**
- For every threshold, add synthetic pairs just inside and just outside it: κ 0.7 vs 0.8 wedge grey, label offset
  0.08 vs 0.12, an alternative that misses the rival by 1·tol vs 3·tol, T1 shares 0.45/0.55.
- State in the report that these values are dev-calibrated and that round 4 is their first independent test.

## 2. Verification quality (mutation results)

| mutant (one rule broken) | caught by |
|---|---|
| M1 no mark is ever REJECTED | dimension-topology (3), (4), §42 b, §41 reference, §41 extra-line: 5 tests. The 9 per-imaging §41 tests stay green |
| M2 every mark is TICK | 14 tests, including 8/9 §41 imagings (erosion stays green: it finds no line at all) |
| M3 a span may end at a REJECTED mark | label-binding "rejected mark never ends a span", topology (4) |
| M4 any binding is decisive (role ignored) | 9 tests |
| M6 no rival neutrality (V3 between hypotheses) | 1 test (the 1601/1801 case) |
| M8c/d `glyphRatio` 0.95 / 0.3 | 2 tests / 1 test |
| M11 conflict never undecided (§43) | 1 test |
| R2/R3/R5/R6 T1 off, T3 single-axis, T2 10·tol | caught by `source-conflict.test.ts` |
| E1 pack writer rewrites the run's `model.json` | evidence-pack ON==OFF and determinism tests (2) |
| **M5 I2 removed (one ink, one witness across chains/values)** | **nothing (146/146)** |
| **M7 V3 neutrality against the page vote removed** | **nothing (146/146)**. G2E's `METRIC_SCALE_UNSUPPORTED` (dev row, network) is its only gate |
| **M10 re-read at a REPLACED scale without topology** | **nothing (146/146)** |
| **R8 `outspannedByOuterTotal` disabled** | **nothing: `packages/reconstruction/test` 372/372** (no test names `outerTotalSpans`/`OUTER_TOTAL_MARKS`) |
| **R7 source conflict never computed in `reconstructV2`** (no early challenge, no REFUSED SOURCE_CONFLICT, no VERIFIED) | **nothing: 372/372** |
| **E2 `/<image/` dropped from `FORBIDDEN_IN_SVG` + `<image href="plan.png">` in every SVG** | **nothing (10/10)**: builder, test and `verify` share the one list |

**D-P1-2.** M5, M7, M10, R7 and R8 show that five of the stage's claims have no killing test. They are
gated only by the development-house and known-set CI rows. Those rows run only on the benchmark houses and, when
the publisher is unreachable, become `::warning::` (`row()` returns 0; the dev-row run step is skipped).
- The contract's "one ink, one witness" (I2), "V3 against the vote" and "outer totals frame an axis" therefore
  have no evidence apart from the houses they were developed on.
- The `REFUSED`/`SOURCE_CONFLICT` outcome, the `footprintRefused` incumbent scoring, the
  `!solution && conflict` lattice alternatives and `alignByFitOnly` have no unit test at all.

**Fix:** add synthetic tests with hand-made `MetricEvidenceSet`/plan fixtures, like the existing `plan.ts`, for:
- `challengeFirstReading` REPLACED/REFUSED/KEPT under a conflict;
- `outerTotalSpans` and `outspannedByOuterTotal`, each with its negatives;
- I2: one ink on two chains with different values.

**D-P0-1 — the §41 escape hatch.** `if (!right) expect(RANK[conf]).toBeLessThan(RANK[base])`. Base is SUPPORTED, so
every WEAK or INCONCLUSIVE result passes whatever its scale. Per-imaging results, instrumented at HEAD:

| imaging | pooled scale (expected) | relation/confidence | passes via |
|---|---|---|---|
| identity, lower contrast, padding, crop | 2.5054 (2.5) | REPLACED/SUPPORTED | scale |
| downscale 0.8 | 3.1403 (3.125) | REPLACED/WEAK | scale |
| **anti-aliasing (3×3)** | **2.2941 (2.5), −8.2 %** | **REPLACED/WEAK** | **hatch** |
| downscale 0.9 | 3.5100 (2.778), +26 % | LEGACY_UNCONFIRMED/INCONCLUSIVE | hatch |
| dilation 1 px | 4.8640 (2.5), +95 % | LEGACY_UNCONFIRMED/INCONCLUSIVE | hatch |
| erosion 1 px | none (0 lines found, so the topology checks are vacuous) | NO_SCALE | hatch |

In the anti-aliased case, `1200` is read `1100`. Its bounded alternatives are `1700, 1300, 5100, 3100`: **the
truth is not among them.** The solver REPLACES the vote with it, although `300` on another chain states 2.51.

A direct probe of the reader shows the same thing:
- `1200` blurred reads `1300`, and `760` blurred reads `360`. In both cases the truth is outside the
  one-substitution lattice.
- That is exactly the failure `glyph-ambiguity.test.ts` says it looks for ("a confident different dimension with
  the truth nowhere in its lattice"). That file has no anti-aliased case.

The hatch also cannot tell 005D from the code it replaced. The 7a18d21 solver, run on the same sheets, fails the
scale on 5 imagings, all at WEAK or INCONCLUSIVE, so the old code passes every scale clause as well.

**Fix:**
- Allow the hatch only for `confidence === 'INCONCLUSIVE'` with `relation ∉ {REPLACED, CONFIRMED}`. A selected or
  replaced wrong scale must fail at any confidence.
- Pin each imaging's expected outcome.
- Assert at least one line was found (erosion).
- Add blurred and JPEG-like cases to §28.
- Record the AA misread as a known limit of the OCR the stage builds on.

## 3. CI gates

- **D-P1-3:** `npm run -s evidence:verify -- stage-reports/artifacts/analyzer-005d/evidence --max-packs 16` gives
  `::error::no evidence pack under …`, exit 1. Nothing is committed there, so the new job fails at HEAD. The failure
  is loud, not silent: `verify` refuses an empty root, which is right. Commit the packs before the freeze; do not
  make the step tolerate an empty directory.
- Dev rows. `evidence:verify "dev/<house>/evidence-pack"` runs after the row, so a missing pack fails the row.
  A failed pack write in `second-house` is only `::warning::`, but `verify` then fails, which is acceptable.
  `|| true` on the analysis is pre-existing; `dev-row.mjs` judges the result.
- `--metric/--metric-overall` (D-P2-1):
  - The "witness bound to a REJECTED mark" clause is tautological, because `bindingsFor` never ends a span at a
    REJECTED mark. Only `longestShare ≥ 0.8` has teeth.
  - Azalia passes the metric gate at the **misread** scale. On the m2 run: `metric REPLACED/WEAK at 1.897482`,
    from `1055`; the stage's own JSON records the printed value as 1035, which gives 1.8615.
  - The CI comment, "an overall reading decides the scale", overstates this. Pin the honest state instead:
    `confidence ≤ WEAK` and a `valueAmbiguity` whose interval contains the truth.
- Known rows:
  - `legacy-compat` accepts a refusal by name, so a regression of 005D's REPLACED on the sealed e-OZE evidence
    would pass. Today both rows complete at −4.21 % / −4.37 % with `figure VERIFIED`.
  - `decoy` is sound. The ×1.25 decoy row would **complete** without the source conflict, because the first
    reading lands near the decoy, so it really pins the mechanism. Both decoys refuse with `AS_READ_REFUTATION`.
  - The REPLACED checks `publishedFigure === 'SPENT'` and `!challenge.trigger` are vacuous, the same as D-P0-2.
    Only the ±6 % footprint check has teeth.
  - An unreachable publisher still skips every one of these rows with a warning (pre-existing).

## 4. Evidence Pack

- **Non-invasive by construction.**
  - The pack is built in `second-house`'s main block after `secondHouse()` resolves, from the files it wrote.
  - `@buildapp/evidence-pack` is a devDependency only; the guard test asserts no production import.
  - The E1 mutant is caught.
  - Side effect: the replay path now always writes `source-package.json` (with the **decoy** figure under
    `--decoy-footprint`) and `metric-evidence.json`. Run `verdict.mjs` on a decoy directory and it judges against
    the decoy figure. `known-row` passes the real package explicitly, so CI is unaffected.
- **Deterministic.** The pack is a pure function of the run directory; ON and OFF give the same pack bytes
  (tested). `manifest.gitSha` varies by commit, as intended.
- **Publisher pixels.**
  - No raster path exists. `Svg` has no image element, and the preview is `scene-views.png`, which is
    `renderSceneSheet` of the model, nearest-neighbour downscaled to ≤ 800 px.
  - `02-asset-inventory.json` carries id, roles, URL, `sha256`, byte size, decoded `{width,height}`, content type
    and crop: nothing else. A scan of a real pack (`packs/azalia-v2`) found no `data:`, no `base64` and no long
    tokens. The only hosts are archon.pl, as URLs.
  - `canonicalUrl` in 02 is just a copy of `url` (mislabel, D-P2-7).
- **D-P2-2 (defence in depth).**
  - `FORBIDDEN_IN_SVG` is a denylist shared by the builder, the test and `verify` (mutant E2). It misses SVG2
    `href=`, `<feImage>`, `<use href>`, `url(` and `<style>@import`.
  - `verify` does not scan JSON/MD for `data:`/base64.
  - The preview check is only "is a PNG, ≤ 800 px wide". A downscaled publisher image renamed to the preview
    would pass.
  - Fix: an element/attribute allowlist in `verify` (`svg, title, rect, line, circle, polygon, text`; no `href`, no
    `url(`); its own oracle in the test; a data-URI/base64 scan of every text file.
- **Bounded.**
  - JSON ≤ 1.5 MB, replaced by a summary otherwise. SVG ≤ 3000 elements. 4 frames, 8 metric frames.
  - Azalia's largest file is 162 KB.
  - `verify` on `/home/user/work005d/known2`: 5 packs, 0 failing.
- **First divergence.**
  - `azalia-base` → `azalia-v2`: `FIRST_DIVERGENCE = DIMENSION_TICK_CLASSIFICATION`, object
    `tick:chain-horizontal-646-…:204.5`, ACCEPTED → REJECTED (`FAINT_SIDE, LIGHTER_THAN_LINE, ONE_SIDED,
    STYLE_MISMATCH, WEDGE_NOT_STROKE`). That is exactly the defect 005D was opened for, so this case is useful.
  - m2 clean vs tracked Kosaćce, and m2 vs itself: `NONE`, correct.
  - m1 → m2 on e-OZE and on G2E: the first divergence is `DIMENSION_HIERARCHY total_of:… ABSENT → INCOMPLETE`, with
    "later stages differing: none". These are record-only objects, not decisions.
  - **D-P2-3:** such records sort before SCALE_HYPOTHESIS, so a new record type would mask a real later
    divergence. Mark INCOMPLETE and AGREES_AFTER_CORRECTION as non-decisions, or rank stages that carry decisions
    first.
  - A replay directory without `source-package.json` (`m2/eoze-legacy-every`) throws, loudly.

## 5. Holdout round 4

- **Reproducible and correct.**
  - `developmentFamilies()` over every `source-package.json` under `stage-reports/` finds 8 ARCHON families, all
    in `excluded-families-round-4.txt`.
  - That file is round 3's 40 families + `dom-w-azaliach`, nothing else.
  - SHA-256 `8c5a4a97…2919` and pool `800c2a1e…2ed41` match README. 584 addresses are excluded and 2501 are
    drawable, as README states.
  - All 9 ARCHON pages analysed in the 005D work directories belong to excluded families.
  - The cached Azalia page links only to `dom-w-azaliach-3`.
  - `ROUNDS[4]` reuses round 1's two-pick draw with its own label.
- **Changing `verdict.mjs` before the draw** is legitimate in timing and is documented (README step 6). But:
- **D-P0-2:** `replacedByTheDrawing.holds = Boolean(challenge.trigger) && challenge.publishedFigure !== 'SPENT'` is
  always true.
  - `challengeRecord` always sets `trigger` to a non-empty `why`.
  - A challenge's `publishedFigure` is only ever `NONE`, `VERIFIED` or `SCORED`; `SPENT` is set only in
    `resolvePlan`, at line 536.
  - README says it holds "only when the trigger names the drawing's contradiction and the published figure only
    verified the replacement". A 005B-path REPLACED with `publishedFigure: 'SCORED'` and no `sourceConflict`
    passes.
  - On `known2/eoze-every-copy` the verdict is `PASS`, with the condition holding.
  - A correct check needs `sourceConflict` on the record, but **a REPLACED outcome does not carry `conflict`**
    (`plan-resolution.ts:1110`; D-P2-4). The record of a source-conflict replacement therefore lacks
    `sourceConflict`, `registrationRefuted` and `conflictEvidence`. Its gate reason also still says "the first
    reading completed on weak metric evidence".
  - **Fix (before the freeze):**
    1. Return `conflict` on REPLACED.
    2. Set `holds = Boolean(challenge.sourceConflict) ? challenge.publishedFigure === 'VERIFIED' || challenge.publishedFigure === 'NONE' : challenge.publishedFigure !== 'SPENT'`.
    3. Add a fixture test for `verdict.mjs`.

## 6. Minor (P2)

D-P2-1 metric gate (§3); D-P2-2 pack denylist/shared oracle (§4); D-P2-3 first-divergence noise (§4); D-P2-4
REPLACED drops `conflict` (§5). Further:
- D-P2-5: `label-binding.test.ts` says "the numbers are this file's own", but 556 px with 1055/1035 is Azalia's
  overall span and figures, and 720 px with 1601/1801 is e-OZE's. The behaviour is not number-specific (§1
  probes), but the comment is false. Change the numbers.
- D-P2-6: extend the hard-code scan to the judges (`holdout/*.mjs`, `scripts/*-row.mjs`) and
  `packages/evidence-pack/src`. Production comments also carry benchmark measurements (κ 0.67 "round-3
  watermark", 0.147–0.165, 37 spans on 8 houses): honest provenance, and exactly the calibration trail of §1.
- D-P2-7: `02-asset-inventory` `canonicalUrl: v.url` is a duplicate under a wrong name.
- D-P2-8: T2 repeats `DECISIVE_SPAN_TOLERANCES` (25) as a literal on a different basis: `max(2, wallPx/2)` is 6 px
  at wall 12 against the solver's 2.2, so "decisive" means 150 px in one layer and 55 px in the other.
- D-P2-9: `FAINT_SIDE` is recorded but takes part in no class decision; the doc comment should say so.
- D-P2-10: `glyph-ambiguity` "broken strokes" passes when no token parses as a dimension; assert a token was found.

## 7. Verdict

| area | verdict |
|---|---|
| Overfit (hard-coded identity) | **PASS.** No house id, word, figure, dimension or misreading in production, the pack or the judges |
| Overfit (thresholds) | **CONCERN (P1).** κ, binding centring and glyph ratio were chosen on the dev houses with the benchmark failure in the criterion. No synthetic test pins them; round 4 is the first independent test |
| Test strength | **FAIL (P0/P1).** §41's hatch admits a wrong REPLACED scale. I2, V3-vs-vote, topology re-read, outer-total framing and the resolver-1.4.0 pipeline path have no killing test |
| CI gate soundness | **CONCERN (P1).** The evidence-pack job is red at HEAD. The metric gate's REJECTED-end clause is tautological, and it passes Azalia at the misread scale. Decoy rows are sound; legacy-compat does not pin 005D's gain |
| Evidence Pack non-invasiveness | **PASS.** Built after the run, off by default, devDependency only, ON == OFF tested (E1 caught). Defence in depth: shared denylist (P2) |
| First-divergence usefulness | **PASS with P2.** It names the Azalia tick exactly. Record-only hierarchy objects can mask later decisions |
| Round-4 protocol | **PASS with P0 fix needed.** Exclusions, hashes and counts reproduce, and all dev families are excluded. R9 is vacuous and must be fixed before `PRE_HOLDOUT_4_SHA`, which itself requires green CI (D-P1-3) |
