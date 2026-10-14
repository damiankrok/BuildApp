# STAGE BUILDPLAN-ANALYZER-005Q — source-grounded exterior boundary: audit, bake-off, one fail-closed rule (layout 1.2.0), blind 12

**Class: one small production change** in `packages/reconstruction` only (layout inference **1.2.0**, candidate
**N1a** amended by review round 1): when a body is cut on an exterior wall's *inner* face, the wall left outside it is
**named** as an unresolved outer face and is **never read** as a recess, a return or a paved terrace; the body's ring and
MASS feature say SOURCE_DERIVED instead of SOURCE_EXACT. Nothing moves and no footprint changes. The two candidates that
would have moved faces (C1, C2) were measured and not adopted. <<VERDICT_LINE>>

## Summary

| item | result |
| --- | --- |
| branch | `analyzer/source-grounded-exterior-boundary-v1` from `04d5568a4a36d2b850998f2848d06e2179218872` (= the 005P mirror at start); every push mirrored to `claude/new-session-3kzcgh` (no force push, no PR) |
| Phase A (before any production edit) | `artifacts/analyzer-005q/architecture/`: `first-bad-boundary.md` (four houses, each first bad operation with code line and counterfactual replays), `wall-face-and-evidence-contract.md`, `exterior-feature-interface.md` (005R/005S interface), `boundary-call-path.md`, `negative-control-inventory.md` + `negative-features.json` (52 features), `trigger-census.json`, `forensics/` (independent forensic and adversarial reports), `baseline-44.json` |
| baseline (S0 = 005P on 46 rows: the 44 of 005O + round 11's two draws) | 24 completed, **19 PASS** (18 of the 44 + miniaturka); glogownikach ALGORITHMIC_FAIL −8.04 %; krasnokwiatach refused |
| preregistration | `research/analyzer-005q/preregistration.md` committed before any challenger (`21c99bf`); Addendum A (N1a) committed after N1's run, before N1a's (`c56585b`); Addendum B (round-1 fixes, `3d4729d`; PROD2 had started ~2 min before it — disclosed) and Addendum C (round-2, `542b0f5`, committed before PROD3, the replay of record) |
| challengers (identical sealed inputs, 46 rows) | C1 (one exterior wall = one line on its outer face), C2 (chain-constrained strips judged on far-face host wall and returns), N1 / N1a (fail-closed wall strip, own), combinations C1N1, C1N1a, C1C2N1, C1C2N1a, informational N2 |
| chosen | **N1a** — the only admissible candidate; shipped as PROD3 (N1a + review-round fixes, Addenda B and C: narrowing and naming only) |
| 46-row effect | **one row changes**: glogownikach — 3 terraces → 0, 2 recess returns → 0, ring and MASS SOURCE_EXACT → SOURCE_DERIVED, two typed AMBIGUOUS gaps (east and front outer faces), footprint −8.04 % unchanged, verdict ALGORITHMIC_FAIL unchanged. **0 known-good model change**, 0 scale change, 0 new terrace / room / exact ring, 0 negative-feature violation, rooms/doors/openings identical |
| production = research | PROD1 = N1a byte-for-byte on 46/46 (every hashed output file); PROD3 (the replay of record, after both review rounds) = N1a on 45/46, and on glogownikach only `unresolved.json` text differs (as Addenda B and C predicted); PROD3 = its repeat on 46/46; source hashes bound (`prod-vs-harness.json`) |
| tests | new: `wall-strip.test.ts` (16 end-to-end families, 63 tests, made-up plans through `reconstructV2`), `wall-strip-unit.test.ts` (G10 at unit level, 59 tests), `wall-strip-invariance.test.ts` (23), `tests/architecture/wall-strip.test.ts`, 005Q blocks in `research-isolation.test.ts` and `holdout-select.test.ts`; **all pass on production; against the frozen base 41 end-to-end tests fail (every firing case) and 22 pass (the hard negatives)** (`synthetic-results.json`) |
| mutations | **38 of 40 mutants killed by a behavioural assertion** (0 only by an architecture test); M33 equivalent (an empty span is under the probe's 1 m minimum), M34 unreachable from a single-plan input (recorded as a survivor, not as proven equivalent) |
| reviews | round 1: 5 lenses, **0 P0, 0 P1**, 7 P2, 14 P3 — four fixed in production (F1–F4), the rest fixed in tests/records or documented (`post-review/round-1.md`); round 2: 3 fresh lenses + 2 adversarial verifiers per P0/P1: **0 P0, 2 P1** (both confirmed; both about claims and gate evaluation, not shipped output: C1's opening side effects missing from the recommendation; G10 tested only end to end), 8 P2, 11 P3 — dispositioned in `post-review/round-2.md`; Addendum C (committed before PROD3, the replay of record) |
| performance | interleaved ABBA, 2 repetitions × 46 rows per side, solver-only: wall p50 13.47 → 13.08 s, p95 24.22 → 23.45 s; per-case ratio p50 0.96, p95 1.01, **max 1.04, none > 15 %**; peak RSS p50 577 → 564 MB (x64 container — not a phone) |
| freeze / CI | <<CI>> |
| BLIND_12 | <<BLIND>> |
| ANDROID / APK | 005H ARM64 device parity **PENDING**; `owner-preview-latest` **not overwritten**; no APK built or published |

## A. Audit (Phase A, before any production edit)

Evidence: the frozen replays (B0 = 005P on 44 rows; S0 = B0 on 46), instrumented PROBE replays (byte-identical outputs
plus a decision log), and per-house counterfactual replays in scratch copies (one variable each, same sealed inputs).
Publisher rasters were decoded and measured only in scratch outside the repository; nothing of them is committed except
numbers. Labels: KNOWN = reproduced from code, data or a replay; INFERRED = measured on the raster, not replayed.

### A.1 Głogowniki (`dom-w-glogownikach`, baseline COMPLETED, −8.04 %, ALGORITHMIC_FAIL)

- **What the drawing shows (INFERRED).** Outer faces x 78 / 812.5, y 203 / 553.5; at the truth scale the outer box is
  19.29 × 9.20 m. The E wall is one continuous wall-thick band. The S facade is **stepped**: wall 536–553 for x 96–421,
  a 0.47 m entrance niche set back for x 438–645, garage piers 645–672 and 785–812 with the 300 cm door between.
- **The scale and the extent are right** (2.6234 cm/px against 2.6286 truth; the chains state the outer faces).
- **First bad decision, Y (KNOWN).** The band claim (`plan-decomposition.ts:509`) breaks an exact tie (span 350 = 350,
  axis distance 8.5 = 8.5) by `a.px − b.px` and gives the band to the inner face 536; thinning (`:564`) drops the outer
  face 553 (17.000 < 17.136 px); the snap (`:1246`) moves the box's correct outer face 553.5 to 536.
- **First bad decision, X (KNOWN).** The line 797.69 is not a face: it is the solver-placed end tick of a
  CHAIN_CORRECTED substitution ("150" → "250"), counted as printed (`:478`); it wins the band by axis distance; 812 is
  thinned; the snap moves 812.5 → 797.69.
- **Consequences (KNOWN).** The −8.04 % is one wall thickness lost on E and on S, by two mechanisms, at a correct extent.
  The strips between the snapped envelope and the extent became ZONE regions (`layout.ts` `zonesOutsideEnvelope`); v2
  read them as recesses with two returns and **three PAVED terraces** (3.27 / 6.63 / 1.31 m²) — mostly the walls' own
  poché (≈ 2.4 m² of the 6.63 is the floor of the real niche; one return is the real garage pier, review round 1); and
  `v2/emit.ts:191` labelled the ring **SOURCE_EXACT "18.83 × 8.70"** on two inner faces.
- **Wall-face provenance.** No statement on the four contested lines is READ: 536 CHAIN_CORRECTED 870 (raw "810"), 553
  CHAIN_CORRECTED 920 (raw "420") and DERIVED 44.55, 797.69 CHAIN_CORRECTED 250 (raw "150"), 812 DERIVED 44.64.
- **005P's falsifier** ("minCellM 0.44 restores Y") is **refuted end to end**: keeping both face lines fails at emission
  (WALL_CONSUMED: the 0.45 m wall row becomes a sliver body), in four independent replays.
- **A compensating PASS exists and was rejected:** replacing the inner line by the outer on both sides gives −1.04 %
  but builds the niche inside the house and reads its mouth as one 5.38 m "window" swallowing a window and the entrance
  door. Not source-grounded.

### A.2 Krasnokwiaty (`dom-w-krasnokwiatach`, baseline refused PLAN_LAYOUT_REJECTED, 11.67 m²)

- **Dimension extent right** (9.55 × 16.10 m from the printed chains, 1610 = 430 + 780 + 400; scale 2.511 cm/px).
- **First bad decision (KNOWN).** The long-band box (`plan-decomposition.ts:1238-1241`) finds no long band on either
  stepped facade — the N face is a 400 cm window between piers, the S face a 285 cm garage door between piers, both
  shorter than 2.5 walls — and `sideWallReach` (`:1302`) cannot span a stepped plan. The boundary outline then leaks
  through six facade gaps whose corner piers read as POST jambs (`boundary-evidence.ts:614`, `:621`), so the living room
  is never a completion part. **Family: PIER + STEPPED PLAN**, not a face problem.
- **Wings.** Walled: living room 29.4 m² (N), garage 17.1 m² (S). Not walled: NW covered terrace, S entrance porch,
  planting strip. Walled ≈ 121.0 m² (−15.5 % of the published 143.18 m²); with terrace and porch 142.9 m². **The
  published figure includes roofed open areas, so a correct walled model does not reach ±6 %, while a false scale
  (+9.5 %) fits to 1.6 %** — the verdict cannot be the arbiter here.
- 005P's "snapped to the fireplace partition" is true but not causal (without that band the box is the same).

### A.3 Also audited (needed to judge the candidates)

- **Akebiach** (refused): 005P's "S face carries no wall-thick ink" is **falsified** — the S facade is inked
  (0.97–1.00 dark) but cut into junction stubs shorter than the band reader's 26 px. PIER family.
- **Helikoniach** (−18.88 %): W wall = FACE family (a 1-px split band admits the inner-face line; the wall becomes a
  dropped sliver; dropping that line alone gives −12.23 %); N/S = PIER.
- **Sliver terraces are a class** (`exterior-feature-interface.md` §4.2): 17 of the 29 terraces production emits on the
  24 completed rows are no deeper than one wall, including on **known-good** rows (eoze-legacy-area/-every: the outer
  half of a wall; cieszyniankach: blank paper). Only glogownikach's strips are a *whole* wall band.
- **Labels over-claim** (`wall-face-and-evidence-contract.md` §5.3): `emit.ts:191` labels every ring SOURCE_EXACT; only
  7 of 40 masses on the completed rows rest on READ statements on both axes.

## B. Candidates and the comparison (Phase B, `candidate-comparison.json`, `negative-controls.json`)

Gates (preregistration §4): G1 no known-good model change; G2 no scale change; G3 no new built cell in any of the 52
negative-feature rectangles and no selected-frame switch; G4 no new terrace / exact ring; G5 glogownikach loses its false
terraces and false exact ring; G8 storeys; G9 determinism; G10 synthetic; G11 performance. Selection (§5): only
candidates admissible alone; a combination only if each component is admissible alone.

| candidate | changed rows | result | admissible |
| --- | --- | --- | --- |
| **C1** one wall = one outer-face line | glogownikach (E wall on its outer face, 19.28 m, **−5.86 %**, frozen verdict PASS), helikoniach (−18.88 → −12.23 %) | G1–G4 hold; **G5 fails**: glogownikach keeps two front terraces and a SOURCE_EXACT ring on the S inner face while the ±6 % verdict calls it PASS; openings change with no new evidence (helikoniach door ↔ window, a window lost; glogownikach garage door 300 → 360) | no |
| **C2** chain strips judged on host wall + returns | 11 rows | builds akebiach's planted courtyard (+8.37 m², N41), completes A05 wrongly (−13.94 % with exact rings and terraces), switches jarzabem's plan copy (compensated PASS); on krasnokwiatach accepts the right strips (garage 17.1, living 29.4; terrace/porch/planting rejected) but still refuses | no |
| **N1** fail-closed wall strip (zone removed) | glogownikach | as predicted on its row, but removing the zone moved the v2 world frame 0.4455 m: a partition and door lost, a window "110/230" became a door "110/290" with no new evidence (§4 disqualification clause, `gates.disqualification_prediction`) | no |
| **N1a** (Addendum A: the strip stays a zone, v2 skips it) | glogownikach | every gate holds; rooms, doors, openings identical; −8.04 % unchanged | **yes** |
| C1N1a | glogownikach (−5.86 %, frozen PASS, 0 terraces, front face unresolved, SOURCE_DERIVED), helikoniach | mechanical gates hold, but C1 is not admissible alone (§5), and both change openings with no new evidence (§4 clause) | no |
| C1C2N1 / C1C2N1a | 12 rows | inherits C2's failures | no |
| N2 (informational: every one-wall-deep strip) | 6 rows | changes three known-good models (cieszyniankach, eoze-legacy-area/-every) | no (needs an OWNER decision) |

N1a's 46-row evidence is post hoc (it was written after N1's run); only blind round 12 is independent of it. **G3's
instrument** (the 52 feature rectangles of `negative-features.json` and the growth threshold min(1 m², side²/4)) was fixed
after N1's run and before C1, C2 and N1a ran, and committed with Phase B (review R2B-09). G3 measures built-cover growth
only: it carries no information about what a rule *suppresses* (glogownikach's niche floor and garage pier, below).
C1 and C1N1a also fail §4's disqualification clause (opening changes with no new evidence; R2B-01), recorded as
`gates.disqualification_prediction`. N2's marcowki entry in the first comparison was a killed process, not a frame
switch; re-run alone it is unchanged (R2B-03).

## C. The production change (`production-diff-manifest.json`)

`packages/reconstruction/src` only — `layout.ts` (+125/−17), `v2/reconstruct-v2.ts` (+28/−4), `v2/emit.ts` (+3/−1), `v2/building.ts` (+2);
every protected path (apps, .github, root manifests, lockfile, packages/model, commands, architecture, source-metrics,
source-cv, source-common, numeric-recogniser-ort, analysis-service, holdout/pool.txt, holdout/verdict.mjs) is
byte-identical to `04d5568`.

- `wallStripsOf(base, envelope)` (layout): a strip between the walled envelope and the plan's extent is the building's
  own exterior wall when wall-thick bands (≥ 0.7 of the wall, ≥ 2.5 walls long) lie along it with both faces within the
  face window (max(5 px, 0.35·t), `gridLines`' own) of the strip's two edges, the strip no deeper than the band by more
  than that window (F2), over ≥ `WALL_STRIP_BOUNDS.cover = 0.25` of its length (the only new bound).
- The strip **stays a ZONE region** (the world frame is unchanged — the lesson of N1). An AMBIGUOUS gap names "the
  outer face of the building's <side> wall" with a reason giving the strip depth (per-axis scale, F3) and the share.
- A body whose side stands on the strip's back edge **along the covered stretches** (F1) takes DERIVED instead of
  MEASURED on that axis and names the gap in its `why`.
- v2 reads no recess, return or terrace in such a strip (`isWallStripZone`); the MASS feature is SOURCE_DERIVED when a
  face is open (`openFacesOf`); `emit.ts` writes that ring SOURCE_DERIVED "… body cut on a wall's inner face;
  unresolved: …". A platform the plan outlines beyond such a strip, in front of the bodies standing on it, is **named,
  never built** (F4, narrowed in round 2). The reason states the observation: wall-thick ink fills the strip — "the body's
  own wall, or another wall layer" — and the wall's outer face is not resolved.
- Faces, the frame and the footprint never move. Members read off a recess in such a strip (a verge's depth, an
  attached roof's projection over the zone, recessed-wall tones) fall back to their no-recess conventions; on the 46
  rows this changed only glogownikach's recessed-wall finish region (removed).
- `LAYOUT_INFERENCE_VERSION` 1.1.0 → 1.2.0; the solver version string is unchanged (as 005L did).

## D. Tests (122 synthetic tests + 23 invariance + architecture; all green on production)

- `packages/reconstruction/test/wall-strip.test.ts` + `wall-strip-plans.ts`: 17 families of made-up plans, each beside its opposite: face pair on one wall, outer-face ticks only, wall thickness, piers, the face window, a garage door, a stepped front, an open terrace, porch posts, a pergola, a carport, a 005N recessed entrance, mirrored/turned redraws, the mutation gates, and the review-round families (two bodies on a stepped front, a platform beyond a strip, a floating band, per-axis scale, a platform in front of one body of an L, a platform beyond a real terrace). Where the rule fires, the frozen solver's terrace and SOURCE_EXACT ring are recorded in `FROZEN` and the test fails on the base; where it does not, the frozen outcome is asserted whole (a hard negative, not an endorsement). Four frozen redraws crash at emission (`FROZEN_REFUSED`).
- `packages/reconstruction/test/wall-strip-invariance.test.ts`: band order (reversed, rotated, two shuffles through the
  sheet cache), chain order, translation, orientation, end-to-end `reconstructV2` (`order-invariance.json`).
- `tests/architecture/wall-strip.test.ts`: the rule reads the drawing only (no published figure, slug, house, footprint,
  resolver state), one owner (layout decides; v2 asks twice; emit reads one field), the strip stays a zone, no schema
  change, one new bound, AMBIGUOUS and never an upgrade. Three of its gates compare against the base commit and are
  **skipped in CI's depth-1 checkout** (they run locally); they are scoped to the 005Q base.
- `tests/architecture/research-isolation.test.ts` (005Q block), `tests/architecture/holdout-select.test.ts` (round 12).
- The frozen oracle is committed (`research/analyzer-005q/synth/`): the fixtures through the base `04d5568` via a
  variant alias outside the repository.

## E. Mutations (`mutation-results.json`, `research/analyzer-005q/mutations.mjs`)

40 mutants, each applied in place, the suites run, the file restored byte for byte (sha-256 checked; the PROD3 source hash verified before and after). 38 killed by a behavioural assertion; M33 (the probe's empty-span skip removed) is equivalent; M34 (fall back to the zone span when no body stands) is unreachable from a single-plan input. M14, M15, M19 and M23, which survived or were argued equivalent in earlier passes, are now killed by the review-round fixtures and the unit test. Families of mutants: the gap never named / REFUSED; v2 still reading the strip; ring or MASS still exact; every bound moved (cover 0 / any / 1, thickness, length, face window 0 / a wall, one face, depth bound removed / two-sided); the zone removed (N1's frame shift); backOn without overlap / without face distance / whole-span / threshold 0 / unmerged / x-only; wrong axis, side or edge; the platform probe not run / REFUSED / whole zone / every zone; per-axis scale.

## F. Reviews (`post-review/`)

- **Round 1** (5 lenses, static): 0 P0, 0 P1, 7 P2, 14 P3 (`post-review/round-1.md`). Production fixes F1–F4 (Addendum B): a body is flagged only along the stretches the wall ink covers; the band must fill the strip; per-axis depth; a platform outlined beyond a strip is named, not built. Records fixed: the frozen oracle committed, per-row hashes committed, N1's disqualification recorded as a gate entry, the niche/pier correction.
- **Round 2** (3 fresh lenses + 2 verifiers per P0/P1): 0 P0, 2 P1 confirmed — **R2B-01** the recommendation called C1N1a gate-clean while C1 changes openings with no new evidence (helikoniach: a door read as a 2.52 m window, two windows read as doors, one window lost, MASS raised to SOURCE_EXACT; glogownikach: the garage door re-bound "300/225" → "360/225") — recorded as `gates.disqualification_prediction` for C1 and C1N1a and the recommendation rewritten; **R2B-02** G10 had been tested only end to end, where the decision depends on orientation through the base's band-claim tie — Addendum C evaluates G10 as written, at unit level (59 tests: all 8 sheet symmetries, band order, every coordinate ±0.2 px and joint jitter, margins to every bound asserted) and **it holds**; the end-to-end dependence is disclosed. Also fixed: the platform probe spans the standing bodies (R2A-1), observation wording (R2C-02), N2's marcowki "frame switch" was a killed process (re-run: unchanged; R2B-03). Documented residuals: R2C-01 (≤ 10 px bands, an axis cut can count — label-only), R2C-03.

## G. Determinism, performance (`prod-vs-harness.json`, `performance.json`)

- `prod-vs-harness.json`: per-row sha-256 of every output file (model, program, failure, analysis trace, digest, unresolved, provenance, summary — 7 on completed rows, 3–4 on refused rows; the in-memory ledger is not among them). N1a = PROD1 = its repeat on 46/46; PROD2 and PROD3 = N1a on 45/46, glogownikach differing only in `unresolved.json` text; **PROD3 = PROD3-rep on 46/46**; the four production files' sha-256 recorded before PROD3 and checked after its repeat (`sourceSha256`).
- `performance.json`: ABBA as in the summary; no case over 15 %, so no explanation is owed (G11).
- **Disclosed ordering:** PROD2 started ~00:12:30, before Addendum B was committed (00:14:13; glogownikach finished 00:18:20); PROD3, started after Addendum C, is the replay of record.

## H. Predictions and what happened

| prediction (written before the run) | outcome |
| --- | --- |
| C1 moves glogownikach's width to ≈ 19.21 m without touching S | width and S held (19.28 m, −5.86 %) |
| C1: glogownikach stays ALGORITHMIC_FAIL; willa-miranda's E side moves out | **failed**: glogownikach became a threshold PASS (with a wall short and an exact inner-face ring); willa-miranda did not change |
| (not predicted) | C1 changed openings with no new evidence on helikoniach and glogownikach (R2B-01) |
| C2 recovers krasnokwiatach's walled wings without its terrace and porch | held on krasnokwiatach (still refused); broke akebiach, A05, jarzabem |
| N1 changes glogownikach only | held, plus an unpredicted frame shift (Addendum A) |
| N1a changes glogownikach only, openings identical | held |
| PROD2 = N1a except glogownikach text (Addendum B) | held: only the two gap reasons differ |
| PROD3 = PROD2 except glogownikach text (Addendum C) | held: only the two gap reasons differ; no platform gap |

## I. Freeze and CI

<<FREEZE>>

## J. Blind round 12 (`artifacts/analyzer-005q/blind-round/`)

<<BLINDSECTION>>

## K. Limitations and unresolved roots (recorded, not repaired)

- **glogownikach is still ALGORITHMIC_FAIL at −8.04 %.** N1a makes the model honest (no fabricated terrace, no exact
  label on an inner face, the two open faces named) but does not move a face. The face fix is C1 plus a per-stretch face
  for a stepped facade (recommendation §1).
- **krasnokwiatach is unchanged** (refused): the PIER family needs a junction-aware solid reader per sub-stretch;
  C2 shows the chain-strip route finds the right strips there but is unsafe elsewhere.
- **What N1a takes away that was partly real.** The base modelled glogownikach's real entrance niche floor (≈ 2.4 m² of
  `terrace-front-0`) and its real garage pier (`return-front-0-0`) — as parts of a false recess. N1a removes those
  readings with the wall poché; the niche and the pier are now neither built nor named separately (the only record is the
  front outer-face gap). They belong to the face stage (recommendation §1, item 2).
- **R2C-01 (residual):** with bands of about 10 px or less, a body cut on a wall's axis can make the strip (the outer half
  of the wall) count — label-only (SOURCE_DERIVED, a gap, no sliver terrace on poché); not reached on the 46 rows.
- **Base defect found by the tests (not repaired):** the terrace extension's polygon fails emission
  (`MODEL_EMISSION_FAILED`, "not a simple polygon") on some mirrored outlined platforms, in the base and in production
  alike, on real terraces too; N1a avoids it only because it builds no terrace in a wall strip.
- G10 holds at unit level; end to end, whether a body is cut on a wall's inner face at all depends on orientation
  through the base's band-claim tie (`plan-decomposition.ts:509`) — a base property the rule cannot change.
- The sliver-terrace class on known-good rows, `emit.ts:191`'s global SOURCE_EXACT (also storey pieces), CHAIN_CORRECTED
  ticks counted as printed, and rarytasy-g2e's 55.71 m² open-ground terrace are recorded, not repaired (OWNER decisions
  on G1 needed).
- An open axis keeps its narrow internal interval; the open-face relation rides in `mass.why` (pinned by tests);
  the gap is pushed even when no body stands on the strip (review round 1, documented).

## L. Files

Production: `packages/reconstruction/src/layout.ts` (+125/−17), `v2/reconstruct-v2.ts` (+28/−4), `v2/emit.ts` (+3/−1), `v2/building.ts` (+2). Tests: `packages/reconstruction/test/wall-strip{,-unit,-invariance}.test.ts`, `wall-strip-plans.ts`, `tests/architecture/wall-strip.test.ts`, `research-isolation.test.ts` (005Q block), `holdout-select.test.ts` (round 12). Holdout: `holdout/select.mjs` (round 12 label), `excluded-families-round-12.txt`, `README.md` § Round 12, `LEDGER.ndjson`. Research: `research/analyzer-005q/` (preregistration + addenda A–C, candidates/*.patch, cases.json, replay.mjs, variant.mjs, solve.ts, score_005q.py, compare.py, negative_gate.py, census.py, trigger_census.py, mutations.mjs, perf.mjs, prod_vs_harness.py, freeze-manifest.mjs, exclusions.mjs, synth/). Artifacts: `stage-reports/artifacts/analyzer-005q/` (architecture/, baseline-44.json, candidate-comparison.json, negative-controls.json, prod-vs-harness.json, synthetic-results.json, order-invariance.json, mutation-results.json, performance.json, production-diff-manifest.json, post-review/, blind-round/, recommendation.md). Text and JSON only: no publisher drawing, crop, overlay, weights or model.

## M. Commands (scratch `W=/home/user/work005q`, outside the repository)

```
# baseline and challengers (solver-only on sealed inputs)
node research/analyzer-005q/variant.mjs setup --work $W/v-base
node research/analyzer-005q/replay.mjs --work $W --label S0 --config $W/v-base/vite.config.mjs --solve
node research/analyzer-005q/variant.mjs setup --work $W/v-N1a --patch research/analyzer-005q/candidates/N1a.patch   # likewise C1, C2, N1, N2, combinations
python3 -I research/analyzer-005q/score_005q.py --work $W --label <L> --baseline S0 --out $W/<L>-score.json
python3 -I research/analyzer-005q/compare.py --baseline stage-reports/artifacts/analyzer-005q/baseline-44.json --scored <L>=$W/<L>-score.json [--repeat <L>=$W/<L>-rep-score.json] --out $W/cmp-<L>.json
python3 -I research/analyzer-005q/negative_gate.py --work $W --baseline S0 --features stage-reports/artifacts/analyzer-005q/architecture/negative-features.json --labels <L> --out $W/g3-<L>.json
# production
node research/analyzer-005q/replay.mjs --work $W --label PROD2 --solve ; node research/analyzer-005q/replay.mjs --work $W --label PROD2-rep --solve
python3 -I research/analyzer-005q/prod_vs_harness.py --work $W --labels S0,N1a,PROD1,PROD1-rep,PROD2,PROD2-rep --pairs N1a=PROD1,PROD1=PROD1-rep,N1a=PROD2,PROD2=PROD2-rep,S0=PROD2 --out stage-reports/artifacts/analyzer-005q/prod-vs-harness.json
node research/analyzer-005q/mutations.mjs
node research/analyzer-005q/perf.mjs --work $W --old $W/v-base --reps 2 --out stage-reports/artifacts/analyzer-005q/performance.json
node research/analyzer-005q/freeze-manifest.mjs --out stage-reports/artifacts/analyzer-005q/production-diff-manifest.json
# gates
npm install ; npm run typecheck ; npm test ; npm run build ; npm run e2e
<<BLINDCOMMANDS>>
```

## N. NEXT_RECOMMENDATION (one; `artifacts/analyzer-005q/recommendation.md`)

**A face-correction stage — one exterior wall = one grid line on its outer face (the C1 idea) — on top of the shipped
N1a, with openings re-bound only by evidence, a per-stretch face for a stepped facade and a per-feature gate.**
Measured here: C1N1a moves glogownikach to −5.86 % with its front face still named and helikoniach −18.88 → −12.23 %,
but C1 as measured is not safe — it fails G5 alone and changes openings with no new evidence (helikoniach door ↔
window and a window lost; glogownikach's garage door re-bound 300 → 360). It is plan-only and must precede 005S
(elevations register on body faces). 005R depends on neither; it needs the stretch-level exterior interface recorded in
`exterior-feature-interface.md` and a no-image baseline first. 005R and 005S are not started.

## O. Verdict and handoff

<<HANDOFF>>
