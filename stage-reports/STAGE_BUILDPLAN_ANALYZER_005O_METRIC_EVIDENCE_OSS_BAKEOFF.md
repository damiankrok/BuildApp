# STAGE BUILDPLAN-ANALYZER-005O — metric evidence rescue + targeted open-source algorithm bake-off

**Class: RESEARCH / DIAGNOSTIC / BENCHMARK ONLY. No production change** (freeze IDENTICAL, §K). No fresh blind draw, no
APK, no adoption. Recommendation in §O, verdict in §Q.

## Summary

| item | result |
| --- | --- |
| branch | `analyzer/metric-evidence-oss-bakeoff-v1` from `b680cd440f7e202ad6813f0a3bffdb563abfa772` (accepted 005N base; upstream and mirror both at it when the stage started); every push mirrored to `claude/new-session-3kzcgh`, heads identical |
| pre-registration | `research/analyzer-005o/preregistration.md`, committed in `158f81c` **before any challenger ran**; addendum A (M4-diag) committed in `41d0a73` before it was computed |
| the seam | every metric challenger changes ONE thing: plan resolution's per-statement **as-printed view** (`zeroSubstitution` / `asRead`), through a Vite module swap written outside the repository (005K/005N method). OCR, binding, chains, registration, the metric solution and every published-figure rule are the frozen code. The view reaches **five consumers** inside plan resolution (§D): the source-conflict triggers, `refutedShareAsRead`, the resolver's ranking through `metricsAtScale`'s refuted share, `latticeScales` and the isotropy gates. Controls: harness without a view and an explicit frozen view reproduce M0 on **44/44** cases byte for byte |
| truth (offline scorer only) | blind **double transcription** of all 932 statement crops (two model-based transcribers per sheet, no reader output shown, houses shuffled; 4 synthetic controls per sheet: transcribers 98.1 % / 97.1 % on controls, no shared wrong value); **782** integer labels in **38** families agreed, 129 not-a-label, 18 uncertain, 3 non-integer (excluded). Truth is **crop-level** (the token box + 35 % pad, the same pixels PP-OCRv6 reads). Cross-check: **62/62** agree with 005E's accepted labels (`truth-crosscheck.json`). Protocol and prompt hash: `research/analyzer-005o/transcription-protocol.md` |
| **FIRST_BAD_METRIC** | **glogownikach: (d) AS_PRINTED_VIEW_IGNORES_ENSEMBLE**. Plan resolution treats the classic template token text (501, 810) as "printed". The deployed PP-OCRv6 had read **541 (p 0.99981) and 870 (p 0.99952), both stable**, on the same boxes, and the ensemble kept them. **murajach: mixed (c)+(d)**: line extraction (the logo splits the 1020 line; wall-crossing ticks) and the v49 orientation decision (legacy UNDECIDED fallback against a 740 read at p 0.99991). The registration 2.451 is wrong by ~58 % and the refusal is correct. **akebiach: EXTENT**, not metric |
| readers on 782 real labels | the value plan resolution reads as printed (**frozen as-printed**): **wrong when stated 55.5 %** (372/670) [51.7, 59.2]. The literal classic token text: 69.1 % (471/682). Lattice CLEAR/SUPPORTED 26.1 % (47/180). PP-OCRv6 top 4.9 % (28/571). **PP-OCRv6 corroborating (ensemble rule): 0/507 disagree with the blind transcription of the same crop** [0, 0.75 %]. TOP-K recall at the first lattice/ensemble **654/782 = 83.6 %**. De-duplicated (n = 608, same drawing on two frames and second-pipeline rows removed): frozen as-printed 59.3 %, corroborating 0/395 |
| **METRIC_BAKEOFF** (house level, 44 cases) | M0: 22 completed, 18 PASS, 17 at a correct scale, 5 truth unknown, 0 false-confident scale. **M1 / M1P / M1b: 23 completed, 18 PASS, 0 false-confident, 0 known-good model change; 2 models changed.** `dom-w-glogownikach` now completes at **2.6234 cm/px**, the correct scale (truth 2.6286; still ALGORITHMIC_FAIL on footprint −8.04 %). `dom-pod-jarzabem` (M0 FAIL) resolves another copy of its plan, with **changed semantics** (one opening flips to OPEN_SIDE, the covered terrace is lost, exterior walls 10 → 5; still FAIL). The decision path changes on 3 more rows with the same model or the same refusal, including the known-good `rarytasy-eoze` (conflict trigger). **M3 / M3b: as M1, plus an adverse refusal reason** on `kosacce-area-alone` (a SOURCE_CONFLICT preferring 1.449 cm/px, 40 % off the truth 2.406). **M2: no model change, the same adverse refusal reason (NO_GAIN, adverse).** Murajach refuses under every variant |
| METRIC_BAKEOFF (label level, paired) | stated-wrong as-printed values: frozen **372 / 782**. M1 **122** (Δ −0.320, family-cluster 95 % [−0.371, −0.273], 1 correct lost). M3 **108** (Δ −0.338 [−0.386, −0.291], 22 correct lost). M2 332 (Δ −0.051). M1P 122, with **165 wrong→correct** promotions. M1b = M1 and M3b = M3 (the re-read adds nothing) |
| latency | the M1 view is image-free (the readings are already in the sealed evidence). Replay median ratio vs the harness-without-view baseline M0H: **1.007×**, **within noise** (the identical-behaviour controls span 0.96–1.06×; batches ran sequentially with some concurrent jobs, §J). M1b's crop re-read: cold 0.50 s (Node 22) / 1.26 s (Node 18), warm **p50 125–127 ms, p95 152–168 ms per crop**, process RSS 928 MB (Node 22, 260 jobs) on this x86 container. Validation: 40/40 bit-identical to the sealed external readings on Node 22 and on Node 18 |
| synthetic glyph corpus | 420 labels, **7 font files ≈ 5 typeface designs** (seeded, rights-cleared fonts). Classic token wrong-when-stated 57.3 %; lattice-confident wrong 25/157; PP-OCRv6 corroborating wrong **0/415**. M1 rule stated-wrong **2/420** (family-cluster 95 % [0, 1.43 %], design-cluster [0, 1.67 %]); both are cases where only the classic token was confident, i.e. the incumbent value |
| logic corpus + mutations | 15 adversarial chain/label cases pass; **4/4 broken generators killed** (promote-on-CONTESTS, scale-chosen substitution, two readers counted as witnesses, truth leak). They run in the architecture suite |
| missing-candidate control | glogownikach with every external reading **stripped from the evidence the solver uses**. Frozen and M1 both refuse, and their `failure.json` is byte-identical to M0: no 541/870 is conjured. A first version was vacuous (it stripped only the generator's copy); it was redone (§G) |
| **OSS_KERNEL** | **NO_KERNEL_BOTTLENECK** (akebiach). The projection's piers are dark ink (share 1.0) but absent from the accepted band set. A noder would need a snap of 34 px between band rectangles (41.8 px between axes), while every tolerance in use is ≤ 24 px; the same snap closes the pergola at 47 / 54.7 px. JSTS, Clipper2 and polygon-clipping were INSPECTED, not run (no contrived A/B). **PDF.js: not on the failing path; DEFER** (7/44 sealed packages record 1:500 outline PDFs/DWGs; the ARCHON adapter, which serves all three failing houses, records none). ELSED/LSD not reopened |
| M4-diag (orientation by the reader's posterior) | decides 357 of 857 quarter-turn decisions: **171 right, 0 wrong** where the transcription truth knows the orientation. It changes 67 decisions (16 right, 0 wrong, 51 unknown), including murajach's v49 |
| production freeze | **IDENTICAL** (`packages/`, `apps/`, `.github/`, root manifests and lockfile, OCR model / dictionary / WASM) |
| reviews | three focused reviewers, every P1 reproduced independently; 0 P0, 33 findings, all dispositioned: `artifacts/analyzer-005o/post-review/` (§M) |
| NEXT | **one** recommendation, §O |

## A. Baseline and freeze (Phase A)

- **Start.** `git status` clean at `b680cd4`; `origin/analyzer/compound-facade-atomic-intervals-v1` and `origin/claude/new-session-3kzcgh` both at it. Environment, critical source hashes and the 005N CI facts: `artifacts/analyzer-005o/environment.json`.
- **Production freeze manifest at the start.** `production-freeze-start.json`, written by `research/analyzer-005o/freeze-manifest.mjs`. It records, per path:
  - the tracked file count;
  - the SHA-256 of the committed index and of every tracked file's bytes on disk;
  - the untracked embedded OCR assets: `PP-OCRv6_tiny_rec.onnx` `9ef676d6…`, dictionary `9a8199f8…`, WASM `3398c10d…` (the APK 1212 pins).
- **Independent audit.** `BUILDPLAN_OPEN_SOURCE_ANALYZER_TECHNOLOGY_AUDIT.md` is **not present** locally. It was not read and is not cited. The brief's §6 descriptions and 005G's measured matrix were used instead.
- **Disk.** The session's allowance was nearly spent at the start (0.8 GB free); only this session's own scratch was pruned. One replay batch later hit ENOSPC (a full disk). The affected M1b runs were re-run after the replay harness stopped keeping copies of sealed inputs (§J).

## B. Forensics — the three required cases (Phase A; `baseline-first-bad.json`)

### B1. `dom-w-glogownikach` (blind round 10 #1, now development)

The refusal is `SOURCE_CONFLICT / OUTER_TOTALS`: "2 long readings as printed on both axes agree on 2.432039 cm/px (501/206 px, 810/333 px)".

| ink (truth) | classic token | lattice | PP-OCRv6 | ensemble | statement |
| --- | --- | --- | --- | --- | --- |
| 541 | 501 | 501 **CLEAR** | 541, p 0.99981, stable 4/4 | CONTESTS (541 a full candidate) | 541 CHAIN_CORRECTED (scale-chosen) over 206 px |
| 870 | 810 | 810 AMBIGUOUS (STRICT path 870) | 870, p 0.99952, stable 4/4 | **LEADS 870** (810 a candidate) | 870 CHAIN_CORRECTED (scale-chosen) over 333 px |

- **The correct values existed at the first ensemble.** TOP-K recall: 9 of the 10 statements on the selected frame.
- **The metric solution was right.** It is STRONG/CONFIRMED/MEASURED at **2.626058 × 2.620832 cm/px** (2.6287 is its hypothesis[0]), on the dimension-observation path, which is ensemble-aware. It uses 870 as a witness. The frame's transcription TRUE_SCALE is **2.6286**.
- **Plan resolution ignored the ensemble.**
  - `statementsOn` reads `firstReadCm` from the classic token text (`plan-resolution.ts:200`).
  - `asRead` and `zeroSubstitution` (`:212`, `:222`) never consult the ensemble.
  - Nothing in `packages/reconstruction/src` reads `numericLattices`, `ensemble` or `external`.
- **FIRST_BAD_OPERATION: (d), sub-class AS_PRINTED_VIEW_IGNORES_ENSEMBLE.**
- **Correlation.** The two misreads are not independent witnesses. They share the page, the typeface and the reader family: the classic template reader, whose bitmaps the lattice also uses (the lattice agrees on 501 and 810). Both are middle-digit substitutions (4→0, 7→1). They agree on 2.432 only by coincidence: 501/541 = 0.926 and 810/870 = 0.931. The independent model read both correctly.
- **A second defect on the same frame, recorded and not pursued.** All 10 legacy statements carry a wrong token text.
  - 4 values are right: 541, 920, 190, 870. Of these, 541 and 870 are substitutions chosen because they fit the scale.
  - 6 values are wrong on mis-bound spans, which is binding, class (c): **5 chain corrections** (346→132, 302→505, 224→120, 350→250, 280→160) and **1 READ** (472→171).

### B2. `dom-w-murajach` (blind round 9 #1, development)

- **Two runs on the same evidence.** Both use metric evidence `c1a3b890…`.
  - **Blind 9 (005L code).** It selected frame `rzut-44d6d1166d` at legacy 1.516 cm/px, about 2.4 % from the inferred true scale, with "4 labels on 55 lines", 3.025 cm/px (1 independent) and a 7.04 m² layout. It refused there.
  - **005N/005O code.** Frame selection moved to the copy `rzut-36e1e5a39d`, which registers at 2.451 cm/px.
  - This analysis covers the second run, which is what the brief's "5 labels on 79 lines" describes. The frame-selection change between the two codes is a **candidate earlier first-bad decision**. It is recorded here, not traced; the 005O seam lies downstream of both.
- Refused at metric resolution (`LEGACY_UNCONFIRMED` 2.451224, 0 independent witnesses).
- **The refusal is correct.** The read-only trace infers a true scale of ≈ 1.554 cm/px: 740/476, 1020/656.5, and 410 + 252 over the inner faces. The wall thickness and the footprint agree with the published 75.83 m² to −0.3 %. The page vote is wrong by ~58 %.
- **Where 2.451 comes from.** It is the fit of three chain substitutions:
  - 1020→1010 over a 412 px fragment that the ARCHON logo cuts off;
  - 111→117 over the wrong line;
  - 151→157 over a wrong span.

**"5 labels on 79 lines", inventoried** (the per-dimension table is committed as data: `baseline-first-bad.json` → `perPrintedDimension`):

| measure | count |
| --- | --- |
| raw chains on the selected frame | 79 |
| meaningful dimension lines | 11 |
| printed dimensions on the sheet | 15 |
| spurious chains (furniture, stairs, walls, callout leaders, the logo, the car) | 68 |
| — of which tiny (≤ 2 ticks, < 55 px) | 20 |
| — of which parallel copies | 5 |

The "5 labels" are `dimensionEvidenceOf`'s text regions with a PRIMARY observation that is not LOW_QUALITY.

| outcome per printed dimension (n = 15) | count |
| --- | --- |
| correct value after the ensemble | 7 |
| bound to a span that fits ≈ 1.554 | 2 |
| independent decisive witnesses | 0 |

| first bad class | count | dimensions |
| --- | --- | --- |
| (a) the OCR candidate never existed | 5 | 256, 314, 209, 95, 160 |
| (b) dropped by the ensemble's meanP gate | 1 | 402 |
| (c) line or tick extraction / binding | 8 | 1020, 410, 252, 240, 582, 115, 202, 153 |
| (d) the orientation decision | 1 | 740 |
| (e) insufficient evidence | 0 | |

- **The smallest sufficient cause is chain v49's orientation.** It was decided `ROTATED_CCW` by the UNDECIDED legacy fallback, whose TYPOGRAPHY test counts leading zeros on the template token only. PP-OCRv6 read the CW crop as 740 at p 0.99991 and the CCW crop as junk (p ≤ 0.46).
- **No M-variant can move it.** The as-printed seam of M1–M3 lies **downstream** of this refusal, and none does.
- No document is recorded for this ARCHON house (§C).

### B3. `dom-w-akebiach` (blind round 10 #2) — EXTENT, separate lane

See §C and `technology-kernel-decision.md`. Its metric is STRONG at 2.906 cm/px, and none of the metric experiments changes its outcome or message. The resolver's ranking of readings does change under M1/M3 (§F).

### B4. Negative and known-good cases

Every one of the 42 development rows replays from offline evidence (`source-inventory.json`):
- its inputs are present;
- every raster variant is in its byte cache;
- the devfinal metric evidence is byte-identical to the sealed input.

| rows | status |
| --- | --- |
| Marcówki, Kosaćce ×3, Cieszyniankach, Goździkowce | present and covered |
| the 005L storey rows | covered: A06, A07, żurawkach and tunbergiach PASS; A01, D00, willa-miranda and helikoniach fail at M0 |
| the schema-1.1.0 rows (eoze-legacy-every / -area, kosacce-area-alone) | no lattice and no external reading, so M1 has nothing to act on there. **M2 and M3 do act** (a sum-constraint abstention needs no lattice): adverse on `kosacce-area-alone` (§F) |

## C. Topology / kernel diagnostic (gate T) — `NO_KERNEL_BOTTLENECK`

Reproducible: `research/analyzer-005o/akebiach_topology.py` → `akebiach-topology.json`.

**Gaps on the accepted band set:**

| gap | between band axes | between band rectangles |
| --- | --- | --- |
| rear-wall ends to the core walls | **41.65 / 41.8 px (1.21 m)** | 34 px |
| the pergola posts to the rear wall | 54.7 px | 47 px |
| wing walls to the core walls | 21.8 / 14.2 px | 8 px (inside the 9.6 px tolerance) |
| the door hole | 138 px (4.01 m) | |

**What the ink shows.**
- Both side piers (16 × 49 px) are fully dark in the source (`darkShare` 1.0).
- Neither is among the 35 accepted bands.
- This is a primitive-extraction miss: a short wall-thick block, not a line.

**Why no kernel helps.**
- Every tolerance in use is ≤ 24 px.
- A noder needs a snap of at least 34 px (rectangles) or 41.8 px (axes). The same snap closes the rear terrace under the pergola at 47 / 54.7 px.
- The only separating window, 2.1–3.4 walls, is fitted to one house.
- Polygonizing the band axes leaves dangles.
- A union of the band rectangles leaves a 34 px gap on each side.
- **Any closure needs the 4.01 m door bridged**, and on that the incumbent's two classifiers disagree:
  - the wide-opening reader records it `OPENING_IN_WALL` (score 0.8, sealed);
  - the boundary evidence treats it as a true exterior gap by its width rule (> 3.2 m). This is **inferred from `boundary-evidence.ts:602–610`; it is not serialized**.
  - The 400/220 callout printed over the door was never read.
  - Either way, the bridge is a semantic decision. The verdict rests on the pier/band miss and the snap window; the door argument only supports it.
- The decomposition grid is already a noded arrangement, and its flood is a correct face labelling.

**Negative controls a naive closure would wrongly build:**
- the rear pergola and terrace;
- the covered terraces of dabecjach, marcowki, jarzabem and willa-miranda;
- the carport, detached-garage and detached-shed fixtures.

**Disposition:**

| candidate | status |
| --- | --- |
| JSTS / JTS | INSPECTED / NOT_RUN |
| Clipper2 / polygon-clipping | DEFER (no boolean or offset defect demonstrated) |
| OpenCV / LSD / EDLines / ELSED | not reopened. The missing primitive is a block, and 005I measured 0.00 m unique wall |
| PDF.js / PDFium | **not on the failing path; DEFER** (005G PILOT stands). 7/44 sealed packages record **14 fetched PDF and 7 DWG building-outline documents** (1:500, not dimensioned floor plans). These are the DobreDomy rows via the generic adapter, incl. Aster VIII and Galaktyka (`source-inventory.json` → `documents`). The ARCHON adapter records no documents, so none of the three failing houses has one recorded; whether their pages offer one is **not measured**. (The first draft's "0 PDF among 1 364 raster variants" counted the wrong field; post-review T1) |
| R2V / CubiCasa / Raster2Seq | licence inspection only |

Details: `licensing-runtime-matrix.md`.

## D. Metric challengers (Phase B) — definitions as pre-registered

**Candidate sources:**

| source | what it is |
| --- | --- |
| TOKEN | the frozen as-printed value: the token text for CHAIN_CORRECTED, the statement value for READ |
| ALT | the classic reader's runner-ups |
| LATTICE | the lattice's asRead, only when CLEAR or SUPPORTED |
| LATTICE_PATHS | the lattice's segmentation alternatives |
| EXTERNAL | PP-OCRv6, only when corroborating by the frozen ensemble rule: AGREES, LEADS, or CONTESTS with an EXTERNAL rival |
| REREAD (M1b) | the deployed PP-OCRv6 on the statement's own production-cut crop, only for statements without a lattice |

**Challengers:**

| id | what it does |
| --- | --- |
| M0 | incumbent. The frozen module and the harness-without-view (M0H) are identical |
| M1 | the confident readers of one ink disagree → the statement ABSTAINS: nothing printed, neither for nor against a scale. Image-free |
| M1b | M1 + REREAD |
| M1P | exploratory: the lattice is in doubt and EXTERNAL LEADS → EXTERNAL is the printed value |
| M2 | legacy candidates only. Segment-sum-to-overall: one restoring substitution resolves it; none or several → all members abstain. Then the two-axis isotropy contest, which abstains and never promotes |
| M3 | M1's contest; arithmetic over candidate sets (a unique satisfying assignment that uses confident readings resolves it); then the isotropy contest. M3b adds REREAD |

**Implementation.** `as_printed_views.py` is truth-blind: it reads only the sealed evidence and, for the b-variants, `reread.json`.

**Equations formed** (`chain-constraints.json`):

| variant | formed | outcomes |
| --- | --- | --- |
| M2 | 47 | 11 hold, 9 one substitution, 15 violated and unresolved, 12 skipped |
| M3 | 47 | 28 unique, 6 several, 13 none |

**What the seam reaches (post-review L6).** The patch is textually confined to `zeroSubstitution` and `asRead`, but those feed five consumers:
1. the source-conflict triggers (AS_READ_REFUTATION / PARTIAL_BINDING / OUTER_TOTALS);
2. `refutedShareAsRead`;
3. the resolver's ranking, through `metricsAtScale`'s refuted share. This is how `dom-pod-jarzabem` switches copy;
4. `latticeScales` (`zero`);
5. the isotropy gates (`zero`).

`metricsAtScale`'s text is frozen, but its output is not.

**Deviations, disclosed after review:**
- **M3 resolves frozen-unstated members (L4).** It "resolves" members whose frozen `zero` is empty under the leading-zero rule, without checking that the value is in its own K. Six such records exist: rarytasy-g2e 624, A02 473 and 447, żurawkach 430. All are correct and in K, and no house changes. A carried-forward M3 would have to be defined as a new variant.
- **The arithmetic is not fully scale-free (L5).** Equations are formed on the frozen `zero` list, which can hold a READ value whose orientation a scale chose.
  - On A05 under M3, an overall 1012 (READ, `dependsOnScale`) resolves the token '412' to 912, which then votes.
  - On A06 (known-good) under M2, the same channel writes `zero` [1101] for a READ whose truth is 1145.
  - No house outcome changed.

## E. Results — label level (`metric-statistics.md`, `numeric-candidate-ledger.json`)

**Readers on the same 782 statements** (Wilson 95 %):

| reader | stated | wrong | wrong when stated |
| --- | --- | --- | --- |
| **frozen as-printed** (what plan resolution reads: CHAIN_CORRECTED → token text, READ → the statement value) | 670 | 372 | **55.5 %** [51.7, 59.2] |
| classic token text, literal (`ocrTokens[].text`) | 682 | 471 | 69.1 % [65.5, 72.4] |
| TOKEN candidate (the variants' TOKEN source: token text or the READ value) | 706 | 385 | 54.5 % [50.8, 58.2] |
| lattice asRead | 570 | 346 | 60.7 % |
| lattice CLEAR/SUPPORTED | 180 | 47 | 26.1 % |
| PP-OCRv6 top | 571 | 28 | 4.9 % |
| **PP-OCRv6 corroborating** | 507 | **0** | **0.0 %** [0, 0.75] |
| ensemble reading | 581 | 105 | 18.1 % |

The first draft's "classic token 54.5 %" row mixed the token text and the READ value. It is relabelled above (post-review L2).

- **Truth is crop-level.** "0/507" means agreement with a blind transcription of the same crop. A box that truncates or merges a label would fool both alike (L8).
- **De-duplicated sensitivity (L3)**, n = 608 (the same drawing on another frame at the same span and the two second-pipeline legacy rows removed):

  | reader | wrong when stated |
  | --- | --- |
  | frozen as-printed | 59.3 % (309/521) |
  | literal token | 71.1 % (378/532) |
  | PP-OCRv6 corroborating | 0/395 |
  | lattice confident | 29.2 % (35/120) |

- **Binding.** Truth-labelled statements on frames with a transcription scale (69 of 196 frames have one): 348 consistent and **102 inconsistent** (≈ 23 %, class c). Another 332 statements are on frames with no truth scale.

**As-printed outcome, paired with the frozen view** (WRONG = a wrong value stated as printed; the interval is family-cluster 95 %):

| | CORRECT | ABSTAIN | WRONG | Δ WRONG per statement | correct lost | wrong→correct | `zero` list WRONG |
| --- | --- | --- | --- | --- | --- | --- | --- |
| frozen | 298 | 112 | 372 | — | — | — | — |
| M1 | 297 | 363 | 122 | −0.320 [−0.371, −0.273] | 1 | 0 | 125 |
| M2 | 278 | 172 | 332 | −0.051 [−0.074, −0.029] | 25 | 5 | 342 |
| M3 | 293 | 381 | 108 | −0.338 [−0.386, −0.291] | 22 | 11 | 111 |
| M1P | 464 | 196 | 122 | −0.320 [−0.371, −0.273] | 1 | 165 | 125 |
| M1b / M3b | = M1 / = M3 | | | | | | |

- **The remaining 122 under M1 (L11).** The classic reader family is the only confident reader on them:
  - 117 have K = {TOKEN};
  - 5 have the token plus a CLEAR/SUPPORTED lattice agreeing on the same wrong value.

  Only a reader the incumbent does not run could reach them. **M1b's re-read of the 260 lattice-less statements changes no outcome**: where PP-OCR corroborates, it agrees with the token.
- **The one correct value M1 loses** is kosacce-clean: TOKEN 387 = EXTERNAL 387 against LATTICE 187. M1 abstains on that 2-against-1 split by design.
- **By publisher group:**

  | group | statements | WRONG, frozen → M1 | M3 |
  | --- | --- | --- | --- |
  | ARCHON | 752 | 357 → 107 | 97 |
  | DobreDomy | 30 | 15 → 15 | 11 |

  The DobreDomy rows mostly lack lattices.

## F. Results — house level (`metric-bakeoff.json`, `counterfactuals.json`)

The scale class uses a 3 % tolerance fixed in advance against the frame's transcription scale.

| | completed | refused | PASS | correct scale | truth unknown | **false-confident** | model changed | semantics changed | decision path changed | known-good model changed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M0 (= M0H = M0X) | 22 | 22 | 18 | 17 | 5 | **0** | — | — | — | — |
| M1, M1P, M1b | 23 | 21 | 18 | 17 | 6 | **0** | 2 | 2 | 5 | **0** |
| M3, M3b | 23 | 21 | 18 | 17 | 6 | **0** | 2 | 2 | 6 | **0** |
| M2 | 22 | 22 | 18 | 17 | 5 | **0** | 0 | 0 | 1 | 0 |

**Models changed (identical under every M1/M3-family variant, same model hash):**

- **`dom-w-glogownikach`** (`b7c86aac…`):
  - The METRIC refusal is gone. It completes at **2.6234 cm/px**, within 0.2 % of the transcription scale 2.6286.
  - It is still ALGORITHMIC_FAIL: the footprint is 163.81 m² against 178.13 m² published (−8.04 %).
  - The first bad decision moves past METRIC to the extent/footprint. Recorded, not chased.
- **`dom-pod-jarzabem`** (M0 COMPLETED, FAIL −11.9 %, 2.8022 cm/px):
  - **Why it moved.** The resolver ranks readings partly on the as-read refuted share. Under M1 it picks the 550 px dimensioned copy (`…19f8c2fa6e`), with wall-ink extent instead of chain extent, at **mppX 4.3382 / mppY 4.3567** (the scorer's mean is 4.34745). M0 had picked the 853 px area-table copy.
  - **Scale check: post-hoc, not the pre-registered rule (L9).** The copy ratio gives 2.8022 × 853/550 = 4.346. The frame's own two transcription statements imply 4.220 (X, 1460/346, likely mis-bound) and 4.353 (Y).
  - **Semantics changed (S1).** The footprint goes from −11.9 % to −13.8 % (still FAIL), and:

    | | M0 | M1 |
    | --- | --- | --- |
    | 3.8 m wide gap | OPENING_IN_WALL | OPEN_SIDE |
    | 4.40 m OPEN_SIDE | present | no counterpart |
    | 0.65 m OPEN_SIDE | — | new |
    | covered terrace | COVERED_TERRACE 12.65 m² | gone (UNKNOWN 12.96 m²) |
    | exterior / interior walls | 10 / 22 | 5 / 25 |

  - **This is the trade-off 005P must decide:** whether the as-printed view also feeds the ranking, or only the conflict test.

**Decision path changed, same model or same refusal (S4):**

| row | under | what changed |
| --- | --- | --- |
| **`rarytasy-eoze`** (known-good PASS, same model) | M1/M3 | the conflict trigger OUTER_TOTALS → AS_READ_REFUTATION; registrationRefuted 0.371 → 0.820; chosenRefuted 0.115 → 0 |
| `dom-pod-milorzebem` | M1/M3 | best reading "scale 2.285714" → "registered scale"; same refusal |
| `dom-w-akebiach` | M1/M3 | best reading "copy dimensioned 4d37f1b2ba, 7 bodies, 103.6 m²" → "copy area_table 920547f86d, 3 bodies, 101.5 m²"; failure code and message identical |
| **`kosacce-area-alone`** (adverse, S2) | **M2/M3/M3b** | see below |

**`kosacce-area-alone` under M2/M3/M3b.** The views abstain on the correct 1260 and 370, because 1260 ≠ 370 + 840 (the 840 is the misread, truth 890). The failure code is unchanged (`PLAN_RESOLUTION_INCONCLUSIVE`), but its reason becomes a **SOURCE_CONFLICT** stating that the registration 2.4057 cm/px (truth 2.4058) is refuted, preferring **1.449 cm/px** (−92.7 % footprint).

This counts against M2 and M3: **a refusal whose stated reason asserts a wrong scale.** M1 is not affected.

**Unchanged.** Murajach refuses under every variant, as it must (§B2).

## G. Adversarial controls

- **Missing candidate (redone after review, L1).** The first version was vacuous: `--strip-external` stripped only the generator's in-memory copy, so the replay was the M0 run.
  - **The redo:** the glogownikach metric evidence with **every external reading removed**, a copy outside the repository given to the solver.
  - **Result:** frozen and M1 both refuse (`PLAN_RESOLUTION_INCONCLUSIVE`, the 2.432 SOURCE_CONFLICT), and the `failure.json` of each is **byte-identical to M0**. No 541/870 is conjured (`counterfactuals.json` → controls).
- **Logic corpus** (`test_views.py`, run by `tests/architecture/research-isolation.test.ts`), 15 cases:
  - a contested label;
  - LEADS promotion only in M1P;
  - no conjured value;
  - one / two restoring substitutions;
  - a holding sum;
  - a missing overall;
  - a misaligned parallel chain;
  - contradicting axes;
  - two readers on one crop add no support;
  - two frames do not leak;
  - an inverted leading zero;
  - an empty sheet;
  - a re-read counts only when corroborating.
- **Mutations killed: 4/4**: promote-contests, scale-chosen substitution, readers as witnesses, truth leak.
- **Source correlation.** Two readers of one crop never become two witnesses (asserted). No view adds a reading to a statement whose readers agree.
- **Non-circularity.** The generator never opens a truth file, a page, a published figure or a file name, and a static test asserts that its code names none of them. Truth meets the challengers only in `score.py`.

## H. Synthetic glyph corpus (corpus E; `glyph-corpus-manifest.json`, `glyph-corpus-results.json`)

**Corpus.** 420 labels, 60 per font file, 7 font files: DejaVu Sans, Liberation Sans, FreeSans Oblique, Liberation Italic condensed, DejaVu Mono, Courier 10 Pitch and Bitstream Charter.
- The 7 files are **≈ 5 typeface designs**: Liberation regular and italic are one design, and DejaVu Sans and Sans Mono are one superfamily.
- The values include a 30-value lookalike set (541/501, 870/810, …).
- Cap height 10–16 px, condensation, blur, JPEG, quarter turns; seed 5050.
- The pages live outside the repository; their hashes are in the manifest. Regeneration is byte-identical.

**Results, read through the production path:**

| reader / rule | result |
| --- | --- |
| classic token, exact | 37.6 % |
| lattice, exact | 55.0 % |
| PP-OCRv6 top, exact | 420/420 (on this corpus) |
| lattice-confident, wrong | 25/157 |
| corroborating external, wrong | 0/415 |
| M1 rule | 204 correct, 214 abstain, **2 wrong**; 95 % family-cluster [0, 1.43 %], design-cluster [0, 1.67 %] |
| frozen token view | 212 wrong |

The corpus is easier for PP-OCRv6 than real drawings (100 % vs 69 % exact). It measures reader and rule logic, not real-world accuracy, and it is **not** a generalization PASS.

## I. Addendum A — M4-diag (decision level only, no re-solve)

**The rule:** corroborating readings in exactly one quarter-turn decide the orientation. It decides 357 of 857 recorded decisions.

| measure | result |
| --- | --- |
| against the transcription orientation | **171 right, 0 wrong**, 186 unknown |
| incumbent decisions changed | 67: 16 right, 0 wrong, 51 unknown |
| changed, by `decidedBy` | 34 UNDECIDED, 19 TYPOGRAPHY, 14 OTHER_AXIS_SCALE |
| the incumbent's own orientation, where truth is known | wrong on 26 decisions |

- One of the 67 changes is murajach's v49. The truth has no legacy statement on that chain, so the claim there rests on the read-only trace.
- No end-to-end claim is made.

## J. Runtime envelope (`performance.json`)

**Replays** (solver only, x86 container, 4 cores, 2 in parallel, 44 cases per label):
- median 11.4–13.8 s per case, nearest-rank p95 19.3–20.9 s, peak RSS median ≈ 0.6 GB (max 0.78 GB).
- **The noise band comes from the identical-behaviour controls**, against M0H (harness without a view): M0X 0.961× and M0-frozen 1.062×.
- **M1 is 1.007× M0H: within noise. The view costs nothing measurable.**
- Against M0-frozen, M1's ratio is 0.936×; that is noise too.
- **Disclosures (LMP-2):**
  - The batches ran one after another, not interleaved per case.
  - A few control/peek jobs overlapped the M1 and M3 batches.
  - The Node 18 re-read overlapped the M0X batch.
- **Reruns (LMP-8).** `performance.json` is rebuilt from the latest log per case. Three sets of cases were rerun:
  - the 9 M1b cases lost to ENOSPC;
  - M1b A07 and D00, which had ended INTERNAL_ERROR (post-review S3; both completed, and the scorer now lets a failure record win);
  - M3b in full.

**M1b re-read** (deployed PP-OCRv6, inline session):

| | Node 22 | Node 18.20.4 |
| --- | --- | --- |
| cold (session + first crop) | 0.50 s | 1.26 s |
| warm per crop | p50 124.8 / p95 168.4 ms | p50 127.1 / p95 152.1 ms |
| process RSS | 928 MB (260 jobs) | 396 MB (19 jobs) |
| validation | 40/40 bit-identical to the sealed readings | 40/40 bit-identical; 19/19 re-reads identical to Node 22 |

- Node 18 ran an esbuild bundle in the shipped asset layout.
- Page decoding and `readNumbers` are excluded from these figures.
- **M1 adds no OCR at all.**
- A production M1b would add ≈ 6 crops per house (≈ 0.75 s warm), plus one cold session (0.5–1.3 s) unless it joins the existing ensemble batch, for no measured gain.
- **No phone figure is measured or implied. 005H ARM64 device parity stays PENDING.**

## K. Gates

| gate | result |
| --- | --- |
| production freeze | `node research/analyzer-005o/freeze-manifest.mjs check stage-reports/artifacts/analyzer-005o/production-freeze-start.json` → **FREEZE: IDENTICAL** at the final HEAD (`production-freeze-end.md`) |
| research isolation | `tests/architecture/research-isolation.test.ts`, 005O block: no production import of the harness; the harness tracks only `.py .ts .mjs .json .md`, with no image payload; every pixel writer refuses an output inside the repository (runtime guard, asserted); the generator names no truth, label or sheet path; the logic corpus runs and every mutation is killed |
| commands | `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`: §P |
| determinism | **true reruns of the same view**: M1/peek-M1, M1P/peek-M1P and M3/peek-M3 give identical glogownikach models (`b7c86aac…`), and the review's independent replay into scratch reproduced `model.json` `b7c86aac` and `program.json` `16f455c1`. M1 and M3 views are byte-identical on regeneration. M0 controls are identical on 44/44. Equal outputs across different variants show only that the variants agree |
| no pixel, weight or raster in Git | crops, sheets, glyph pages, replays and re-reads live in `/home/user/work005o` |

## L. Commands and CI

Moved to §P, which gives the ordered commands and the final CI.

## M. Reviews

Three focused reviewers ran against `0123ac2`:
- **A**: metric leakage and calibration;
- **B**: topology/kernel, open-side and storey safety, and the forensic claims;
- **C**: licences, mobile/runtime, performance and reproducibility.

Every P1 was reproduced independently before it was dispositioned.

| | |
| --- | --- |
| P0 | 0 |
| findings | 33 |
| P1 as filed | 7 |
| P1 after reproduction | 4: L2 the token/frozen mislabel, T1 the PDF count, S2 the kosacce-area-alone adverse effect, LMP-1 transcription provenance |

Reclassified after reproduction:
- S1 (jarzabem semantics) → P2;
- S3 (A07/D00 INTERNAL_ERROR scored as completed; fixed by rerun and scorer) → P2;
- L1 (the vacuous control; redone) → P3.

Every finding has a disposition: `post-review/findings.md` and `post-review/resolution.md`.

## N. Limits (explicit)

- **Development data only.** All 44 cases are development material, including the revealed blind rounds 9 and 10. There is no fresh blind draw and no generalization PASS.
- **Truth comes from model-based transcribers** (`transcription-protocol.md`, prompt SHA-256 `1321359e…`).
  - Two independent transcriptions, agreement-only; controls 97–98 %; errors concentrate on 180°-turned controls.
  - Two transcribers of the same kind can share an error. Disagreements (18) and not-a-label rows (129) were excluded.
  - **Data flow:** publisher crops, enlarged on 26 sheets, were sent to the model provider's API as images. Nothing was published or committed. This is flagged for the coordinator.
  - **Control-value seeding (L7):** one third of the control values were drawn from glogownikach's forensic values (541, 501, 870, 810, 346, 432, 120, 224, 180, 280); 31 of 104 controls came from that list. The 541 and 870 crops shared no sheet with a same-value control; the 224 and 280 crops did. The priming risk to "reproduced, not inserted" is small but not zero, and the 62/62 cross-check against 005E's accepted labels bounds it. Any rerun should draw lookalike controls from a list not derived from the evaluated houses.
  - **Truth is crop-level (L8).** See §E.
- **The transcription scale exists for 69 of 196 plan frames.** Five completed rows (M0) or six (M1 family) have no truth scale. For jarzabem's changed copy, a post-hoc copy-ratio check is given in its place.
- **Counterfactual scope.** The challengers change the as-printed view only, not the metric solution. Murajach's metric refusal is therefore out of their reach by construction, and M4 is a decision-level diagnostic only.
- **M1P's promotions** are exploratory and pre-registered as adoption-ineligible on their own.
- **Re-read coverage.** 36 statements could not be re-read: the frozen reader does not re-find their token on the decoded bytes.
- **Timing** comes from sequential, partly overlapping batches on one x86 container (§J).

## O. Recommendation — exactly one

**NEXT: a separate production stage (005P). Plan resolution reads its statements through the ensemble that already
exists: a statement whose confident readers of the same ink disagree states nothing as printed (M1). The stage has its own
freeze and a fresh blind round.**

**The measured case for it:**
- The incumbent's as-printed value is wrong on **55.5 %** of the real labels it states (59.3 % de-duplicated).
- M1 removes 250 of its 372 stated-wrong values, at the cost of 1 correct one.
- It is image-free: no added OCR, latency within noise.
- It moves `dom-w-glogownikach` from a METRIC refusal to the correct scale.
- It changes no known-good model and creates no false-confident scale on 44 development cases.

**That stage must decide, as a trade-off not tuned here, which of the five consumers (§D) the abstaining view feeds:**
- **Through the ranking**, it switches `dom-pod-jarzabem` to another copy with different open-side and terrace semantics.
- **Through the conflict trigger**, it changes the known-good `rarytasy-eoze`'s refutation path (same model).

**Not recommended now:**
- M2 and M3 (an adverse refusal reason on `kosacce-area-alone`; M2 also has no house gain);
- M1b (no gain over M1);
- M1P as a default (a promotion lets a value vote; it is exploratory);
- a geometry kernel (no bottleneck);
- PDF.js (not on the failing path).

**Recorded for the coordinator's ordering, not chosen:**
- murajach's orientation decision (M4-diag 171/0 where truth is known) and its frame selection between the 005L and 005N codes;
- the legacy chain path's binding (≈ 23 % inconsistent);
- akebiach's pier extraction and door callout.

## P. Commands (ordered) and CI

Work directory outside the repository: `W=/home/user/work005o`. Sealed inputs: the 005N development runs and blind round
10 (`cases.json` gives every path). Every command runs from the repository root.

```bash
# 0. freeze and harness
node research/analyzer-005o/freeze-manifest.mjs write stage-reports/artifacts/analyzer-005o/production-freeze-start.json
node research/analyzer-005o/as-printed-harness.mjs setup --work $W/harness
# 1. M0 references and controls (frozen module; harness without a view; explicit frozen view)
node research/analyzer-005o/replay.mjs --work $W --label M0-frozen --frozen --par 2
node research/analyzer-005o/replay.mjs --work $W --label M0H --par 2
python3 -I research/analyzer-005o/as_printed_views.py --cases research/analyzer-005o/cases.json --variant M0X --out $W/views/M0X
node research/analyzer-005o/replay.mjs --work $W --label M0X --views $W/views/M0X --par 2
# 2. truth for the offline scorer (pixels stay in $W)
python3 -I research/analyzer-005o/statement_crops.py --cases research/analyzer-005o/cases.json --work $W
python3 -I research/analyzer-005o/label_sheets.py --work $W --per 36 --seed 5050
#    two blind transcriptions per sheet (transcription-protocol.md), then:
python3 -I research/analyzer-005o/truth.py --work $W
# 3. M1b re-read (Node 22), and the Node 18 bundle
npx vite-node research/analyzer-005o/reread.ts -- --cases research/analyzer-005o/cases.json --index $W/byte-index.json --out $W/reread.json --validate 40
node_modules/.bin/esbuild research/analyzer-005o/reread.ts --bundle --platform=node --format=esm --target=node18 \
  --outfile=$W/n18/reread.mjs --log-level=warning \
  "--banner:js=import { createRequire as __cr005o } from 'node:module'; const require = __cr005o(import.meta.url);"
#    $W/n18 holds the models directory (symlink) and copies of ort-wasm-simd-threaded.wasm / .mjs
/home/user/work005g/node18/bin/node $W/n18/reread.mjs --cases research/analyzer-005o/cases.json \
  --index $W/byte-index.json --out $W/reread-node18.json --validate 40 \
  --only dom-w-glogownikach,dom-w-murajach,marcowki,dom-w-akebiach --asset-dir $W/n18
# 4. challenger views and replays (truth-blind generator)
for V in M1 M1P M2 M3; do
  python3 -I research/analyzer-005o/as_printed_views.py --cases research/analyzer-005o/cases.json --variant $V --out $W/views/$V
  node research/analyzer-005o/replay.mjs --work $W --label $V --views $W/views/$V --par 2; done
for V in M1b M3b; do
  python3 -I research/analyzer-005o/as_printed_views.py --cases research/analyzer-005o/cases.json --variant $V --out $W/views/$V --reread $W/reread.json
  node research/analyzer-005o/replay.mjs --work $W --label $V --views $W/views/$V --par 2; done
# 5. missing-candidate control: glogownikach's sealed evidence with every external reading removed
#    ($W/glog-stripped-metric-evidence.json), handed to the solver; S=/home/user/work005n/blind10/out-1
python3 -I research/analyzer-005o/as_printed_views.py --cases research/analyzer-005o/cases.json --variant M1 --out $W/views/M1-noext --strip-external
OFFLINE=1 npx vite-node packages/analysis-service/scripts/second-house.ts -- --package $S/source-package.json \
  --graph $S/observation-graph.json --metrics $W/glog-stripped-metric-evidence.json --cache /home/user/work005n/blind10/cache \
  --out $W/runs/ctl-stripped-frozen/dom-w-glogownikach
OFFLINE=1 AS_PRINTED_VIEW_005O=$W/views/M1-noext/dom-w-glogownikach.json npx vite-node --config $W/harness/vite.config.mjs \
  packages/analysis-service/scripts/second-house.ts -- --package $S/source-package.json --graph $S/observation-graph.json \
  --metrics $W/glog-stripped-metric-evidence.json --cache /home/user/work005n/blind10/cache --out $W/runs/ctl-stripped-M1noext/dom-w-glogownikach
# 6. logic corpus, glyph corpus, M4-diag, topology
python3 -I research/analyzer-005o/test_views.py
python3 -I research/analyzer-005o/glyph_corpus.py --out $W/glyphs --seed 5050 --per-family 60
npx vite-node research/analyzer-005o/glyph-read.ts -- --dir $W/glyphs --out $W/glyph-reads.json
python3 -I research/analyzer-005o/glyph_score.py --reads $W/glyph-reads.json \
  --manifest stage-reports/artifacts/analyzer-005o/glyph-corpus-manifest.json --out stage-reports/artifacts/analyzer-005o/glyph-corpus-results.json
python3 -I research/analyzer-005o/m4_orientation_diag.py --work $W --out stage-reports/artifacts/analyzer-005o/m4-orientation-diag.json
python3 -I research/analyzer-005o/akebiach_topology.py --run /home/user/work005n/blind10/out-2 \
  --raster /home/user/work005n/blind10/cache/96e49a2c01e6d624b5424188608f10d9.bin --out stage-reports/artifacts/analyzer-005o/akebiach-topology.json
# 7. scoring and artifacts (truth meets the challengers only here)
python3 -I research/analyzer-005o/score.py --work $W --variants M0X,M1,M2,M3,M1P,M1b,M3b --out stage-reports/artifacts/analyzer-005o/metric-bakeoff.json
python3 -I research/analyzer-005o/stats_report.py --work $W --art stage-reports/artifacts/analyzer-005o
python3 -I research/analyzer-005o/export_artifacts.py --work $W --out stage-reports/artifacts/analyzer-005o
# 8. gates
node research/analyzer-005o/freeze-manifest.mjs check stage-reports/artifacts/analyzer-005o/production-freeze-start.json
npm install && npm run typecheck && npm test && npm run build && npm run e2e
git checkout -- stage-reports/artifacts   # e2e rewrites tracked evidence PNGs of earlier stages; restore them
```

**Final gate run** (Node 22.22.2, this container, on the closing tree):

| gate | result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` | 175 files passed, 1 skipped; 2 329 tests passed, 11 skipped (incl. the 005O research-isolation block, 34/34) |
| `npm run build` | pass |
| `npm run e2e` | 47/47 passed |
| production freeze | **FREEZE: IDENTICAL** (`production-freeze-end.md`) |

**CI.** The first closing push, `1a0f8ab`, failed one job: run 38325831296, "Core / Analyzer / Reconstruction", in its unit-test
step. The cause was the 005O isolation test. It allows only `.py .ts .mjs .json .md` under the 005O harness and artifacts,
and the end-of-stage freeze record had been committed as `production-freeze-end.txt`. The local run had not caught it
because the file was still untracked then. The record is now `production-freeze-end.md`; the test is unchanged, and it
passes on the staged tree. Every other job of that run was green. The closing commit's own run is named in the handoff,
since a report cannot carry the run of its own commit.

## Q. Verdict

**PASS_RESEARCH.** Every phase of the brief ran:
- **Phase A**: baseline, first-bad traces sealed for the three cases, pre-registration before any challenger.
- **Phase B**: M0–M3 plus M1b/M1P/M3b; 782 truth labels in 38 families, plus a 420-label glyph corpus; logic corpus with mutations.
- **Phase C**: the kernel diagnostic, `NO_KERNEL_BOTTLENECK`.
- **Phase D**: three reviews, every P1 reproduced and dispositioned; gates and freeze.
- **Phase E**: this report, `PROJECT_STATUS.md`, exactly one recommendation.

No production change, no APK, no fresh blind draw, 005P not started.
