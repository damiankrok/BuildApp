**Verdict: CONDITIONAL PASS.** I found no P0. One P1 has to be fixed before freeze: the recommendation's MobileSAM headline is measured against a truth-selected "best BuildPlan region" with no ORACLE label. All four decisions still hold on the data: BEST_BOUNDARY_CANDIDATE NONE, ELSED DEFER, DeepLSD REJECT, MobileSAM REJECT.

**What I verified (scratch files are in /tmp/claude-0/reviewB/)**
- **E6 is fixed in both code and results.** `extract-synthetic.ts:92-97` (and the matching path in `fusion-replay.ts:91`) call `planExtent([], bands, wallPx, witness, [])`. The only value read from the truth file is `metresPerPx`.
  - For all 22 prompted synthetic cases, the MSAM prompts stored in the outputs equal the prompts I recomputed from the current meta with `prompts_from_meta`. All 7 real houses match too.
  - All synthetic MSAM outputs (06:33–07:01) and the fusion outputs (07:01) postdate the 06:21 re-extraction.
  - None of the 22 extents equals the truth bounding box: they differ by 0.5 px on clean sheets and by 5–225 px on skew, rotated plan and partial crop.
- **No truth, published figure or house identity reaches any provider.** I traced prompt, selection, threshold and post-processing through `msam_run.py`, `baseline.ts`, `extract-real.ts` and `run-providers.sh`. Real extents come from the frozen production chains (`DIMENSION_CHAIN_EXTENT`), and gap tallies equal the frozen digest on 7/7 houses.
- **Scoring and aggregation reproduce exactly.** Re-running `score.py` gave byte-identical `real.json` and `synthetic.json`. Re-running `aggregate.py` gave all 7 generated artifacts byte-identical, plus the scorecard rows.
- **Independent recomputation agrees.**
  - Region IoU, recomputed analytically with shapely or a matplotlib raster: within 0.005 for MSAM-BOX and TRIVIAL-EXTENT on 7 real houses and 5 synthetic cases.
  - Line coverage and opening continuity: identical on 15 provider × frame pairs.
  - HELPED/NEUTRAL/HURT tallies: recounted from the markdown and from the rows, both match.
- **Truth independence.** All 7 truth files were written at 05:59:53, before the first scoring at 06:01. None of the annotation crops made before that time carries provider segments or masks; `j-msam.png` was made at 06:16, after scoring.
- **Repository hygiene.** `git ls-files` and the commit numstat show no binaries, checkpoints, `__pycache__` or images.
  - While checking, I accidentally created a gitignored `providers/__pycache__/` at 07:14 by importing `msam_run.py` with system Python. I deleted it, and the bake-off paths are clean again.
  - I could not read the one-line change to `tests/architecture/research-isolation.test.ts`; that read was denied. The commit adds no `package.json` or lockfile change.

---

**B1 — P1 — The MobileSAM headline compares against a truth-selected baseline**
- Where: `recommendation.md:6-8`, `:60-64`, `:139`.
- The claim: MSAM-BOX "never beats the best region BuildPlan already has on the same frame".
- The comparator is chosen per house by IoU against truth: TRIVIAL-EXTENT on 4 houses, SCV-BUILT on the other 3. No single BuildPlan region dominates — for example SCV-BUILT scores 0.115 on azaliach and TRIVIAL-EXTENT scores 0.797 on willa-miranda.
- Against fixed comparators, real mean IoU (from `development-results.json`):

| region | mean IoU |
| --- | --- |
| MSAM-BOX | 0.895 |
| TRIVIAL-EXTENT | 0.890 |
| SCV-BUILT | 0.768 |
| PROD-MASSES-005H | 0.743 |
| SCV-OUTLINE | 0.615 |

- MSAM-BOX beats the actual production masses on jarzabem, azaliach and helikoniach.
- The zurawkach comparison is a tie, not a win: 0.9684 vs 0.9689, and my analytic recomputation gives 0.9684 for both. Under a ±4 px truth buffer (the stated uncertainty), MSAM-BOX scores above SCV-BUILT (0.959 vs 0.945 eroded; 0.938 vs 0.937 dilated). Repro: `fragile.py`.
- **Fix:** state the result against the fixed TRIVIAL-EXTENT comparator: "the mask adds ≤0.005 mean IoU over the box BuildPlan already computes; per house −0.05…+0.08". Move "best of BuildPlan" to an ORACLE-labelled note or drop it. REJECT still stands on false evidence (15 false gap bridges vs 7 for SCV-LINES; terrace, porch or leak failures on 3 of 7 houses) and on deployment cost.

**B2 — P2 — ORACLE numbers inside the recommendation**
- Where: `recommendation.md:73-76`, `:112-113`, `:141` (the decision matrix shows "oracle-best 0.42").
- This contradicts `methodology.md:69` ("never enters a recommendation") and the brief. The direction is conservative.
- **Fix:** keep these numbers in the results files only, labelled ORACLE.

**B3 — P2 — Robustness to vertex uncertainty is asserted, not computed**
- `methodology.md:115` promises that conclusions which flip within the uncertainty are marked fragile. `score.py` has no perturbation pass, yet `recommendation.md:14-15` claims a "wide margin".
- My ±u buffer test: the line conclusions and the MSAM-vs-TRIVIAL-EXTENT ranking hold; MSAM-vs-SCV-BUILT on zurawkach flips (B1).
- **Fix:** add a ±u buffer pass to `score.py` and mark fragile rows.

**B4 — P2 — A side finding comes from the run E6 superseded**
- Where: `recommendation.md:134` and `:156-159` ("boundary layer throws… `boundary-bodies.ts:157`").
- After E6, `double-line-walls` never reaches the boundary layer: its meta has `boundary.available=false` and `planExtent` returns null. No retained log contains a `TypeError`. The evidence came from the truth-extent run.
- **Fix:** reproduce it with a retained log, label it "observed only in the superseded pre-E6 run", or drop it.

**B5 — P2 — The same-input rule is not machine-checked**
- Provider outputs record `frameId` but no hash of the PNG they read (`elsed_run.py:55-63`, `deeplsd_run.py:178-186`, `msam_run.py:155`).
- The real provider runs (05:40–05:53) predate the current frames, which were rewritten at 05:57–05:58. The synthetic line runs straddle the 06:21 re-extraction.
- The indirect evidence is good:
  - Determinism re-runs on the current frames reproduced the first runs (helikoniach, l-shape).
  - MSAM prompts match the current meta on all 29 prompted frames (7 real, 22 synthetic).
  - DeepLSD-refine inputs match the current SCV-LINES ids and counts on 30/30 frames.
- **Fix:** write the input PNG's SHA-256 into every output and assert it equals `meta.files` in `score.py`.

**B6 — P2 — The fusion "no-information control" wording over-claims**
- `recommendation.md:83-86` says the control "reproduces the same swings". House by house, it does not:

| house | control Δ outline IoU | ELSED Δ outline IoU |
| --- | --- | --- |
| helikoniach | −0.72 | +0.05 |
| morelach | +0.36 | +0.01 |
| azaliach | +0.76 | +0.81 |

- The control adds 674–1195 segments against ELSED's 395–767, so density is not matched, and there is one control per house.
- It is sound as evidence that ink density alone moves outlines by about ±0.7, and that is enough to refuse credit for the azaliach jump. It is not a calibrated null.
- Its name is also slightly off: SCV-LINES is source-cv's own output, which the resolver simply doesn't consume — so "no external information", not "no information".
- **Fix:** say "comparable magnitude, on different houses"; optionally add density-matched seeded placebo segments to give a null range.

**B7 — P3 — The synthetic ORACLE SCALE is described too narrowly**
- `methodology.md:131` says the scale "is neither a prompt nor a selection". Through the metric thresholds it shapes the BUILT cells, which become the SOURCE-PROMPTS positives (`baseline.ts:270-271`), and it shapes the SCV-OUTLINE and SCV-BUILT comparators.
- **Fix:** reword.

**B8 — P3 — Small departures from the written rules**
- Mask evidence availability checks only the gap line (`score.py:764`); §9 also requires "one wall inward". Fix: implement the inward test or reword §9.
- The window rule's numerator `addo` includes GARAGE_DOOR runs, but the denominator `win_runs_m` excludes them (`aggregate.py:164`, `:243`). Fix: use the same opening kinds in both.
- A missing mask marks classes NEUTRAL even when they are not applicable (`aggregate.py:173`); this has no effect on the current data. Fix: apply the not-applicable test first.
- Dead code at `aggregate.py:160-162`. Fix: remove it.
- SCV-UNION counts baseline segments without ink support and the resolver's inferred bridged gaps, while provider additions must be ink-supported.
  - I re-ran with an ink-only union and with a union without gaps: solid additions stay 0.00 m on every real house, and opening additions reach at most 0.51–0.55 m (zurawkach).
  - Fix: record this as a sensitivity row.

**B9 — P3 — Timeline and provenance**
- The §11 timeline leaves out that provider runs began at 05:40, before the methodology was written at 05:47.
- The first full real scoring output (≈06:04), which motivated adding TRIVIAL-*, was overwritten. Only `real-test.json` (06:01, one house) survives; it correctly lacks TRIVIAL-*.
- `LOG.md` "06:0x real providers done" contradicts the file times.
- The annotator is the study agent, and `look.py` supports `--segs`/`--mask` overlays.
- **Fix:** log the truth SHA, the `look.py` invocations and each scoring output's hash before analysis.

---

**Conclusions check**
- **NONE:** supported. External line detectors add 0.00 m of solid coverage on 7/7 real houses. Their only synthetic gain is on the oblique bay.
- **ELSED DEFER:** appropriate. Its only gain is synthetic-only, which §10 rules out as grounds for adoption. Note that §10 never defines "DEFER".
- **DeepLSD REJECT:** supported — 0 HELPED, 4–5 HURT, up to 27.8 m of distractors per house, AGPL dependency, unofficial checkpoint mirror.
- **MobileSAM REJECT:** supported, but for the reasons in B1, not the headline's.
- **TRIVIAL comparators:** fair — they encode exactly the information in the prompt. Their addition after the first scoring run is recorded with its reason, and the timing is consistent with the files.
- **At most one ADOPT_NEXT:** satisfied (none).
