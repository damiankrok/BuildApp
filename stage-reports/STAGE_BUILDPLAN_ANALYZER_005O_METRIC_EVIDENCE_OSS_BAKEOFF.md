# STAGE BUILDPLAN-ANALYZER-005O — metric evidence rescue + targeted open-source algorithm bake-off

**Class: RESEARCH / DIAGNOSTIC / BENCHMARK ONLY. No production change** (freeze IDENTICAL, §K). No fresh blind draw, no
APK, no adoption. Verdict at the end (§N).

## Summary

| item | result |
| --- | --- |
| branch | `analyzer/metric-evidence-oss-bakeoff-v1` from `b680cd440f7e202ad6813f0a3bffdb563abfa772` (accepted 005N base; upstream and mirror both at it when the stage started); every push mirrored to `claude/new-session-3kzcgh`, heads identical |
| pre-registration | `research/analyzer-005o/preregistration.md`, committed in `158f81c` **before any challenger ran**; addendum A (M4-diag) committed in `41d0a73` before it was computed |
| the seam | every metric challenger changes ONE thing: plan resolution's per-statement **as-printed view** (`zeroSubstitution` / `asRead`), through a Vite module swap written outside the repository (005K/005N method). OCR, binding, chains, registration, the metric solution, scoring and every published-figure rule are the frozen code. Controls: harness without a view and an explicit frozen view reproduce M0 on **44/44** cases byte for byte |
| truth (offline scorer only) | blind **double transcription** of all 932 statement crops (two transcribers per sheet, no reader output shown, houses shuffled; 4 synthetic controls per sheet: transcribers 98.1 % / 97.1 % on controls, no shared wrong value); **782** integer labels in **38** families agreed, 129 not-a-label, 18 uncertain (excluded). The brief's 541 / 870 for `dom-w-glogownikach` are reproduced by this truth, not inserted |
| **FIRST_BAD_METRIC** | **glogownikach: (d) AS_PRINTED_VIEW_IGNORES_ENSEMBLE** — plan resolution treats the classic template token text (501, 810) as "printed"; the deployed PP-OCRv6 had read **541 (p 0.99981) and 870 (p 0.99952), both stable**, on the same boxes and the ensemble kept them. **murajach: mixed (c)+(d)** — line extraction (the logo splits the 1020 line, wall-crossing ticks) and the v49 orientation decision (legacy UNDECIDED fallback against a 740 read at p 0.99991); the registration 2.451 is wrong by ~58 % and the refusal is correct. **akebiach: EXTENT**, not metric |
| readers on 782 real labels | incumbent as-printed source (classic token): **wrong when stated 54.5 %** [50.8, 58.2]; lattice asRead 60.7 %; lattice CLEAR/SUPPORTED 26.1 %; PP-OCRv6 top 4.9 %; **PP-OCRv6 corroborating (ensemble rule): 0 / 507 wrong** [0, 0.75 %]. TOP-K recall at the first lattice/ensemble **83.6 %** |
| **METRIC_BAKEOFF** (house level, 44 cases) | M0: 22 completed, 18 PASS, 0 false-confident scale. **M1 / M3 / M1P / M1b / M3b: 23 completed, 18 PASS, 0 false-confident, 0 known-good change; 2 changed** — `dom-w-glogownikach` now completes at the **correct scale 2.6234 cm/px** (truth 2.629; still ALGORITHMIC_FAIL on footprint −8.04 %), `dom-pod-jarzabem` (M0 FAIL) resolves to another copy of its plan (−13.8 % vs −11.9 %, still FAIL). **M2: no house changes (NO_GAIN).** Murajach refuses under every variant |
| METRIC_BAKEOFF (label level, paired) | stated-wrong as-printed values: frozen **372 / 782** → M1 **122** (Δ −0.320, family-cluster 95 % [−0.371, −0.273], 1 correct lost) · M3 **108** (Δ −0.338 [−0.386, −0.291], 22 correct lost) · M2 332 (Δ −0.051) · M1P 122 with **165 wrong→correct** promotions · M1b = M1 (re-read adds nothing) |
| latency | the M1 view is image-free (readings already in the sealed evidence): replay median ratio **1.007×** M0 (noise band: M0X 0.961×). M1b's crop re-read: cold 0.50 s (Node 22) / 1.26 s (Node 18), warm **p50 125–127 ms, p95 152–168 ms per crop** on this x86 container; validation 40/40 bit-identical to the sealed external readings on Node 22 and Node 18 |
| synthetic glyph corpus | 420 labels, **7 font families** (seeded, rights-cleared fonts): classic token wrong-when-stated 57.3 %, lattice-confident wrong 25/157, PP-OCRv6 corroborating wrong **0/415**; M1 rule stated-wrong **2/420** (both cases where only the classic token was confident — the incumbent value) |
| logic corpus + mutations | 15 adversarial chain/label cases pass; **4/4 broken generators killed** (promote-on-CONTESTS, scale-chosen substitution, two readers counted as witnesses, truth leak) — run in the architecture suite |
| missing-candidate control | glogownikach with every external reading stripped: M1 and M3 keep refusing (`PLAN_RESOLUTION_INCONCLUSIVE`); no 541/870 is conjured |
| **OSS_KERNEL** | **NO_KERNEL_BOTTLENECK** (akebiach): the projection's piers are dark ink (share 1.0) but absent from the accepted band set; a noder would need a 41.8 px snap (every tolerance in use ≤ 24 px) and joins the pergola at 54.7 px; the face exists only if the 4.01 m door is first classified as closing — a semantic decision. JSTS/Clipper2/polygon-clipping INSPECTED, not run (no contrived A/B). PDF.js/PDFium OUT_OF_SCOPE (0 PDF among 1 364 source variants). ELSED/LSD not reopened |
| M4-diag (orientation by the reader's posterior) | decides 357 of 857 quarter-turn decisions; **171 right, 0 wrong** where the transcription truth knows the orientation; changes 67 decisions (16 right, 0 wrong, 51 unknown), including murajach's v49 |
| production freeze | **IDENTICAL** (`packages/`, `apps/`, `.github/`, root manifests and lockfile, OCR model / dictionary / WASM) |
| reviews | three focused reviewers + independent reproduction: `artifacts/analyzer-005o/post-review/` (§M) |
| NEXT | **one** recommendation, §O |

## A. Baseline and freeze (Phase A)

- Start: `git status` clean at `b680cd4`; `origin/analyzer/compound-facade-atomic-intervals-v1` and `origin/claude/new-session-3kzcgh` both at it. Environment, critical source hashes and the 005N CI facts: `artifacts/analyzer-005o/environment.json`.
- Production freeze manifest at the start: `production-freeze-start.json` (`research/analyzer-005o/freeze-manifest.mjs`): per path, tracked file count, SHA-256 of the committed index and of every tracked file's bytes on disk, plus the untracked embedded OCR assets (`PP-OCRv6_tiny_rec.onnx` `9ef676d6…`, dictionary `9a8199f8…`; WASM `3398c10d…` — the APK 1212 pins).
- The independent audit `BUILDPLAN_OPEN_SOURCE_ANALYZER_TECHNOLOGY_AUDIT.md` is **not present** locally; it was not read and is not cited. The brief's §6 descriptions and 005G's measured matrix were used.
- Disk: the session's allowance was nearly spent at the start (0.8 GB free); only this session's own scratch was pruned. One replay batch later hit ENOSPC (a full disk); the affected M1b runs were re-run after the replay harness stopped keeping copies of sealed inputs (§J).

## B. Forensics — the three required cases (Phase A; `baseline-first-bad.json`)

### B1. `dom-w-glogownikach` (blind round 10 #1, now development)

The refusal is `SOURCE_CONFLICT / OUTER_TOTALS`: "2 long readings as printed on both axes agree on 2.432039 cm/px (501/206 px, 810/333 px)".

| ink (truth) | classic token | lattice | PP-OCRv6 | ensemble | statement |
| --- | --- | --- | --- | --- | --- |
| 541 | 501 | 501 **CLEAR** | 541, p 0.99981, stable 4/4 | CONTESTS (541 a full candidate) | 541 CHAIN_CORRECTED (scale-chosen) over 206 px |
| 870 | 810 | 810 AMBIGUOUS (STRICT path 870) | 870, p 0.99952, stable 4/4 | **LEADS 870** (810 a candidate) | 870 CHAIN_CORRECTED over 333 px |

- The **correct values existed at the first ensemble** (TOP-K recall: 9 of the 10 statements on the selected frame).
- The metric solution (dimension-observation path, ensemble-aware) is STRONG/CONFIRMED/MEASURED at 2.6287, using 870 as a witness.
- Plan resolution's `statementsOn` reads `firstReadCm` from the classic token text (`plan-resolution.ts:200`), and `asRead`/`zeroSubstitution` (`:212`, `:222`) never consult the ensemble. Nothing in `packages/reconstruction/src` reads `numericLattices` (code map: stage report §D, `research` notes).
- **FIRST_BAD_OPERATION: (d), sub-class AS_PRINTED_VIEW_IGNORES_ENSEMBLE.**
- **Correlation.** The two misreads are not independent witnesses. They share the page, the typeface and the reader family: the classic template reader, whose bitmaps the lattice also uses (the lattice agrees on 501 and 810). Both are middle-digit substitutions (4→0, 7→1). They agree on 2.432 by coincidence: 501/541 = 0.926 and 810/870 = 0.931. The independent model read both correctly.
- **A second defect on the same frame, recorded and not pursued.** All 10 legacy statements carry a wrong token text. Of the chain solver's corrections, 4 are right (541, 920, 190, 870). The other 6 are scale-fitted values on mis-bound spans: 346→132, 302→505, 224→120, 472→171 (READ), 350→250 and 280→160. That is binding, class (c).

### B2. `dom-w-murajach` (blind round 9 #1, development)

- Refused at metric resolution (`LEGACY_UNCONFIRMED` 2.451224, 0 independent witnesses).
- The read-only trace infers a true scale of ≈ 1.554 cm/px: 740/476, 1020/656.5, and 410 + 252 over the inner faces. The wall thickness and the footprint agree with the published 75.83 m² to −0.3 %. **The page vote is wrong by ~58 %, so the refusal is correct.**
- 2.451 is the fit of three chain substitutions: 1020→1010 over a 412 px fragment the ARCHON logo cuts off, 111→117 over the wrong line, and 151→157 over a wrong span.

**"5 labels on 79 lines", inventoried:**

| measure | count |
| --- | --- |
| raw chains on the selected frame | 79 |
| meaningful dimension lines | 11 |
| printed dimensions on the sheet | 15 |
| spurious chains (furniture, stairs, walls, callout leaders, the logo, the car) | 68 |
| — of which tiny (≤ 2 ticks, < 55 px) | 20 |
| — of which parallel copies | 5 |

The "5 labels" are `dimensionEvidenceOf`'s text regions with a PRIMARY observation that is not LOW_QUALITY.

**Per printed dimension (n = 15):**

| outcome | count |
| --- | --- |
| correct value after the ensemble | 7 |
| bound to a span that fits ≈ 1.554 | 2 |
| independent decisive witnesses | 0 |

**First bad class per printed dimension:**

| class | count | dimensions |
| --- | --- | --- |
| (a) the OCR candidate never existed | 5 | 256, 314, 209, 95, 160 |
| (b) dropped by the ensemble's meanP gate | 1 | 402 |
| (c) line or tick extraction / binding | 8 | 1020, 410, 252, 240, 582, 115, 202, 153 |
| (d) the orientation decision | 1 | 740 |
| (e) insufficient evidence | 0 | |

- The smallest sufficient cause is chain v49's orientation. It was decided `ROTATED_CCW` by the UNDECIDED legacy fallback, whose TYPOGRAPHY test counts leading zeros on the template token only. PP-OCRv6 read the CW crop as 740 at p 0.99991 and the CCW crop as junk (p ≤ 0.46).
- No PDF source exists (§C). The as-printed seam of M1–M3 lies **downstream** of this refusal, so no M-variant can move it, and none does.

### B3. `dom-w-akebiach` (blind round 10 #2) — EXTENT, separate lane

See §C and `technology-kernel-decision.md`. The 0.96 m rear projection and the 4.30 m garage end are preserved as source witnesses: piers dark in the ink, the extent conflicts recorded, the 6.86 m mouth OPEN_SIDE. None of the metric experiments touches it (its metric is STRONG at 2.906 cm/px).

### B4. Negative and known-good cases

Every one of the 42 development rows replays from offline evidence: inputs present, every raster variant in its byte cache, devfinal metric evidence byte-identical to the sealed input (`source-inventory.json`).

- **Present and covered:** Marcówki, Kosaćce ×3, Cieszyniankach, Goździkowce, and the 005L storey rows (A06, A07, żurawkach and tunbergiach PASS; A01, D00, willa-miranda and helikoniach fail at M0).
- **Covered, but the M-variants have nothing to act on:** the schema-1.1.0 rows (eoze-legacy-every / -area, kosacce-area-alone). They carry no lattice and no external reading.

## C. Topology / kernel diagnostic (gate T) — `NO_KERNEL_BOTTLENECK`

Reproducible: `research/analyzer-005o/akebiach_topology.py`, output `akebiach-topology.json`.

**Gaps on the accepted band set:**

| gap | distance |
| --- | --- |
| rear-wall ends to the core walls | **41.65 / 41.8 px (1.21 m)** |
| wing walls to the core walls | 21.8 / 14.2 px |
| the pergola posts to the rear wall | 54.7 px |
| the door hole | 138 px (4.01 m) |

**What the ink shows:**
- Both side piers (16 × 49 px) are fully dark in the source (`darkShare` 1.0) and missing from the 35 accepted bands. This is a primitive-extraction miss, a short wall-thick block, not a line.
- Every tolerance in use is ≤ 24 px. A noder would need a snap ≥ 41.8 px, and that same snap reaches the pergola false closure at 54.7 px. The only separating window is fitted to one house.

**Why no kernel helps:**
- Polygonizing the band axes leaves dangles.
- A union of the band rectangles leaves a 34 px gap on each side.
- Any closure needs the door bridged first. The door is `TRUE_EXTERIOR_GAP / NONE`, wider than the 3.2 m strong-leaf bound, and its 400/220 callout was never read. That is a semantic decision.
- The decomposition grid is already a noded arrangement, and its flood is a correct face labelling.

**Negative controls** a naive closure would wrongly build:
- the rear pergola and terrace;
- the covered terraces of dabecjach, marcowki, jarzabem and willa-miranda;
- the carport, detached-garage and detached-shed fixtures.

**Disposition:**

| candidate | status |
| --- | --- |
| JSTS / JTS | INSPECTED / NOT_RUN |
| Clipper2 / polygon-clipping | DEFER (no boolean or offset defect demonstrated) |
| OpenCV / LSD / EDLines / ELSED | not reopened (the missing primitive is a block; 005I measured 0.00 m unique wall) |
| PDF.js / PDFium | OUT_OF_SCOPE: 0 PDF assets among 1 364 raster variants in the 44 sealed packages |
| R2V / CubiCasa / Raster2Seq | licence inspection only |

`licensing-runtime-matrix.md` has the details.

## D. Metric challengers (Phase B) — definitions as pre-registered

Candidate sources:

| source | what it is |
| --- | --- |
| TOKEN | the frozen `firstReadCm` / READ value |
| ALT | the classic reader's runner-ups |
| LATTICE | the lattice's asRead, only when CLEAR or SUPPORTED |
| LATTICE_PATHS | the lattice's segmentation alternatives |
| EXTERNAL | PP-OCRv6, only when corroborating by the frozen ensemble rule: AGREES, LEADS, or CONTESTS with an EXTERNAL rival |
| REREAD (M1b) | the deployed PP-OCRv6 on the statement's own production-cut crop, only for statements without a lattice |

Challengers:

| id | what it does |
| --- | --- |
| M0 | incumbent; frozen module and harness-without-view, both identical |
| M1 | the confident readers of one ink disagree → the statement ABSTAINS: nothing printed, neither for nor against a scale. Image-free |
| M1b | M1 + REREAD |
| M1P | exploratory: the lattice is in doubt and EXTERNAL LEADS → EXTERNAL is the printed value |
| M2 | legacy candidates only. Segment-sum-to-overall: one restoring substitution resolves it (scale-free); none or several → all members abstain. Then the two-axis isotropy contest, which abstains and never promotes |
| M3 | M1's contest; arithmetic over candidate sets (a unique satisfying assignment that uses confident readings resolves it); then the isotropy contest. M3b adds REREAD |

Implementation: `as_printed_views.py` (truth-blind; it reads only the sealed evidence and, for the b-variants, `reread.json`). Equations formed: M2 47 (11 hold, 9 one substitution, 15 violated and unresolved, 12 skipped); M3 47 (28 unique, 6 several, 13 none) (`chain-constraints.json`).

## E. Results — label level (`metric-statistics.md`, `numeric-candidate-ledger.json`)

**Readers on the same 782 statements:**

| reader | stated | wrong | wrong when stated |
| --- | --- | --- | --- |
| classic token (the incumbent as-printed source) | 706 | 385 | **54.5 %** [50.8, 58.2] |
| lattice asRead | 570 | 346 | 60.7 % |
| lattice CLEAR/SUPPORTED | 180 | 47 | 26.1 % |
| PP-OCRv6 top | 571 | 28 | 4.9 % |
| **PP-OCRv6 corroborating** | 507 | **0** | **0.0 %** [0, 0.75] |
| ensemble reading | 581 | 105 | 18.1 % |

- **Binding** of truth-labelled statements on frames with a transcription scale: 348 consistent, **102 inconsistent** (≈ 23 %, class c); 332 on frames with no truth scale.

**As-printed outcome, paired with the frozen view** (WRONG = a wrong value stated as printed):

| | CORRECT | ABSTAIN | WRONG | Δ WRONG per statement (family-cluster 95 %) | correct lost | wrong→correct |
| --- | --- | --- | --- | --- | --- | --- |
| frozen | 298 | 112 | 372 | — | — | — |
| M1 | 297 | 363 | 122 | −0.320 [−0.371, −0.273] | 1 | 0 |
| M2 | 278 | 172 | 332 | −0.051 [−0.074, −0.029] | 25 | 5 |
| M3 | 293 | 381 | 108 | −0.338 [−0.386, −0.291] | 22 | 11 |
| M1P | 464 | 196 | 122 | −0.320 [−0.371, −0.273] | 1 | 165 |
| M1b / M3b | = M1 / = M3 | | | | | |

- **The remaining WRONG (122).** These are statements on which the classic token is the only confident reader: there is no lattice, or the lattice and PP-OCR are not confident. Only a reader the incumbent does not run could reach them. **M1b's re-read of those 260 statements changes no outcome**: where PP-OCR corroborates, it agrees with the token.
- **Publisher groups.** ARCHON 752 statements, 357 → 107 under M1. DobreDomy 30 statements, 15 → 15 under M1, 11 under M3. DobreDomy rows mostly lack lattices.

## F. Results — house level (`metric-bakeoff.json`, `counterfactuals.json`)

The scale class uses a 3 % tolerance fixed in advance against the frame's transcription scale (67 of 186 plan frames have one).

| | completed | refused | PASS | correct scale | truth unknown | **false-confident** | changed | known-good changed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M0 (= M0H = M0X) | 22 | 22 | 18 | 16 | 6 | **0** | — | — |
| M1, M3, M1P, M1b, M3b | 23 | 21 | 18 | 16 | 7 | **0** | 2 | **0** |
| M2 | 22 | 22 | 18 | 16 | 6 | **0** | 0 | 0 |

**Changed rows, identical under every M1-family variant (same model hash):**

- **`dom-w-glogownikach`** (`b7c86aac…`, built in 6 separate runs):
  - The METRIC refusal is gone. It completes at **2.6234 cm/px**, within 0.2 % of the transcription scale 2.629.
  - It is still ALGORITHMIC_FAIL: the footprint is 163.81 m² against 178.13 m² published (−8.04 %).
  - Its first bad decision moves past METRIC to the extent/footprint. The house is recorded, not chased.
- **`dom-pod-jarzabem`** (M0 FAIL, −11.9 %):
  - The first reading fails `PLAN_NO_BUILT_REGIONS`, and the resolver ranks alternatives partly on the as-read refuted share. Under M1 it picks the 550 px dimensioned copy, at 4.338 cm/px, over M0's area-table copy at 2.8009.
  - The new scale is that copy's own: 2.8009 × 853/550 = 4.344, a 0.15 % difference. The transcription has no scale for that copy, so the class reads UNKNOWN_TRUTH, but the copy-ratio arithmetic shows no scale error.
  - The footprint goes from −11.9 % to −13.8 %, still FAIL.
  - **Trade-off for the coordinator:** the as-printed view also feeds the resolver's ranking, not only the conflict test.

**Murajach** refuses under every variant, as it must (§B2). **Akebiach** is unchanged.

## G. Adversarial controls

- **Missing candidate.** Glogownikach with every external reading stripped: M1 and M3 → `PLAN_RESOLUTION_INCONCLUSIVE` (still refuses).
- **Logic corpus** (`test_views.py`, run by `tests/architecture/research-isolation.test.ts`), 15 cases:
  - contested label;
  - LEADS promotion only in M1P;
  - no conjured value;
  - one / two restoring substitutions;
  - a holding sum;
  - missing overall;
  - misaligned parallel chain;
  - contradicting axes;
  - two readers on one crop add no support;
  - two frames do not leak;
  - inverted leading zero;
  - empty sheet;
  - re-read counts only when corroborating.
- **Mutations killed: 4/4**: promote-contests, scale-chosen substitution, readers as witnesses, truth leak.
- **Source correlation.** Two readers of one crop never become two witnesses (asserted). No view adds a reading to a statement whose readers agree.
- **Non-circularity.** The generator never opens a truth file, a page, a published figure or a file name. Truth meets the challengers only in `score.py`.

## H. Synthetic glyph corpus (corpus E; `glyph-corpus-manifest.json`, `glyph-corpus-results.json`)

**Corpus.** 420 labels, 60 per family, 7 families: DejaVu Sans, Liberation Sans, FreeSans Oblique, Liberation Italic condensed, DejaVu Mono, Courier 10 Pitch and Bitstream Charter.
- The values include a 30-value lookalike set (541/501, 870/810, …).
- Cap height 10–16 px, condensation, blur, JPEG, quarter turns; seed 5050.
- The pages live outside the repository; their hashes are in the manifest.

**Results, read through the production path:**

| reader / rule | result |
| --- | --- |
| classic token, exact | 37.6 % |
| lattice, exact | 55.0 % |
| PP-OCRv6 top, exact | 420/420 (on this corpus) |
| lattice-confident, wrong | 25/157 |
| corroborating external, wrong | 0/415 |
| M1 rule | 204 correct, 214 abstain, **2 wrong** (family-cluster 95 % [0, 1.4 %]); the frozen token view: 212 wrong |

The corpus is easier for PP-OCRv6 than real drawings (100 % vs 69 % exact). It measures reader and rule logic, not real-world accuracy, and it is **not** a generalization PASS.

## I. Addendum A — M4-diag (decision level only, no re-solve)

The rule: corroborating readings in exactly one quarter-turn decide the orientation. It decides 357 of 857 recorded decisions.
- Against the transcription orientation: **171 right, 0 wrong**, 186 unknown.
- It changes 67 incumbent decisions: 16 right, 0 wrong, 51 unknown. By `decidedBy`, 34 were UNDECIDED, 19 TYPOGRAPHY and 14 OTHER_AXIS_SCALE.
- One of the changes is murajach's v49. The truth has no legacy statement on that chain, so the claim there rests on the read-only trace.
- The incumbent's own orientation is wrong on 26 decisions where truth is known.

No end-to-end claim.

## J. Runtime envelope (`performance.json`)

**Replays** (solver only, x86 container, 2 in parallel, 44 cases):
- median 12–14 s per case, p95 ≈ 19–20 s, peak RSS median ≈ 0.6 GB;
- M1 1.007× M0 (noise band 0.94–1.00×). The view costs nothing measurable.

**M1b re-read** (deployed PP-OCRv6, inline session):

| | Node 22 | Node 18.20.4 |
| --- | --- | --- |
| cold (session + first crop) | 0.50 s | 1.26 s |
| warm per crop | p50 124.8 / p95 168.4 ms | p50 127.1 / p95 152.1 ms |
| validation | 40/40 bit-identical to the sealed readings | 40/40 bit-identical; 19/19 re-reads identical to Node 22 |

- Node 18 ran an esbuild bundle in the shipped asset layout.
- An image-free M1 adds no OCR at all. A production M1b would add ≈ 6 crops per house (≈ 0.75 s on this CPU) for no measured gain.
- **No phone figure is measured or implied. 005H ARM64 device parity stays PENDING.**

## K. Gates

| gate | result |
| --- | --- |
| production freeze | `node research/analyzer-005o/freeze-manifest.mjs check stage-reports/artifacts/analyzer-005o/production-freeze-start.json` → **FREEZE: IDENTICAL** at the final HEAD (`production-freeze-end.txt`) |
| research isolation | `tests/architecture/research-isolation.test.ts`, new 005O block. No production import of the harness; the harness tracks only `.py .ts .mjs .json .md`, with no image payload; publisher-derived files are written outside the repository; the logic corpus runs and every mutation is killed |
| commands | `npm run typecheck`, `npm test`, `npm run build`: §L |
| determinism | M1 and M3 views byte-identical on regeneration; glogownikach's M1-family model identical in 6 runs; M0 controls 44/44 identical |
| no pixel, weight or raster in Git | crops, sheets, glyph pages, replays and re-reads live in `/home/user/work005o` |

## L. Commands and CI

See the closing section appended after the final gate run (§P).

## M. Reviews

See `post-review/findings.md` and `post-review/resolution.md`. Three focused reviewers: metric leakage and calibration; topology, kernel and open-side safety; licences, mobile and performance. Each material P0/P1 was reproduced independently.

## N. Limits (explicit)

- **Development data only.** All 44 cases are development material, including revealed blind rounds 9 and 10. There is no fresh blind draw and no generalization PASS.
- **Truth comes from model-based transcribers.** Two independent transcriptions, agreement-only, controls 97–98 %; errors concentrate on 180°-turned controls. Two transcribers of the same kind can share an error; disagreements (18) and not-a-label (129) were excluded. The brief's 541/870 match.
- **The transcription scale exists for 67 of 186 plan frames.** Seven completed rows have no truth scale. For jarzabem's changed copy, the copy-ratio arithmetic is given in its place.
- **Counterfactual scope.** The challengers change the as-printed view only, not the metric solution. Murajach's metric refusal is therefore out of their reach by construction, and M4 is a decision-level diagnostic only.
- **M1P's promotions** are exploratory and pre-registered as adoption-ineligible on their own.
- **Re-read coverage.** 36 statements could not be re-read: the frozen reader does not re-find their token on the decoded bytes.

## O. Recommendation — exactly one

**NEXT: a separate production stage (005P) — plan resolution reads its statements through the ensemble that already
exists: a statement whose confident readers of the same ink disagree states nothing as printed (M1), with its own
freeze and a fresh blind round.**

The measured case for it:
- the incumbent as-printed source is wrong on 54.5 % of the real labels it states;
- M1 removes 250 of its 372 stated-wrong values at the cost of 1 correct one;
- it is image-free (no added OCR, latency ≈ 1.00×);
- it moves `dom-w-glogownikach` from METRIC refusal to the correct scale;
- it changes no known-good row and creates no false-confident scale on 44 development cases.

That stage must decide (trade-off, not tuned here) whether the abstaining view also feeds the resolver's ranking (the `dom-pod-jarzabem` copy switch) or only the source-conflict triggers.

**Not recommended now:**
- M2 (no house gain);
- M1b (no gain over M1);
- M1P as a default (promotion lets a value vote; it is exploratory);
- a geometry kernel (no bottleneck);
- PDF.js (no PDF source).

**Recorded for the coordinator's ordering, not chosen:**
- murajach's orientation decision: M4-diag 171/0 where truth is known;
- the legacy chain path's binding (≈ 23 % inconsistent);
- akebiach's pier extraction and door callout.

*(Closing sections §P–§Q are appended at the final gate run.)*
