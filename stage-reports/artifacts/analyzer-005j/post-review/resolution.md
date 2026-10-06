# 005J post-implementation council — resolution

Six independent reviewers. None saw another's review before writing.

| reviewer | topic | verdict | P0 | P1 |
| --- | --- | --- | --- | --- |
| A | floor-plan computer vision | CHANGES REQUESTED | 1 | 6 |
| B | VLM / edge AI | CONDITIONAL PASS | 0 | 4 |
| C | training data and evaluation | CONDITIONAL PASS | 0 | 6 |
| D | licensing, provenance, supply chain | CONDITIONAL PASS | 0 | 2 |
| E | BuildPlan architecture and integration | CHANGES REQUESTED (on the 005K spec; freeze PASS) | 0 | 8 |
| F | generalization red team | CHANGES REQUESTED | 1 | 8 |

**What changed because of the council.**
- **The decision flipped** (F1, P0). PRIMARY_NEXT is now **NO_AI_YET**, made concrete in 005K: per-gap evidence
  records, a sealed fresh-sheet gap set, and the deterministic drawn-gap upgrade with tightened eligibility, measured
  beside a constant control. **TRAIN_BUILDPLAN_WALL_MODEL** moves to SECONDARY_LATER, as a challenger that is trained
  only if the sealed set shows deterministic false upgrades that matter and that the model refuses.
- Why: the research **oracle replay** that A and E required was run in 005J. It shows the witness and the
  deterministic rule give the same outcome on every measured row, and neither moves a holdout verdict.
- The wall-model specification that A, C and E rewrote is kept, unchanged in substance, as the challenger's
  specification (`recommendation.md` §6): a two-signal witness at IP-01 only, no OPEN_SIDE split, a pre-pass design,
  and gates on a sealed set.
- Two measurement errors in the real question geometry were found and corrected (A2/C1, C2).
- The bake-off's evidential statements were scoped (B1–B4): matched subsets, the 64-token configuration, the
  degenerate grounding test and per-house latency.
- Rows written before the flip say "005K-a / 005K-b" and "the primary"; in A, C and E they now refer to the
  challenger's specification in `recommendation.md` §6, and every 005K item named there is in §5 or §6.

## A — floor-plan CV

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| A1 | **P0** | The gap witness, as designed, would move neither round-8 house; no replay was run | **Fixed by measurement.** `replay/oracle_replay.py` re-solves the sealed runs with an oracle witness (`oracle-replay.json`). Gozdzikowcach: one 0.41 m LEAF_FACE gap completes the house at −3.75 % (storeys still fail). Cyklamenach: no gap upgrade moves it. Development matrix: 1 model change, 0 verdict changes. The UNet reads the decisive gap ≈ 94 % OPENING on its axis. The recommendation now claims exactly this and no more (`recommendation.md` §2–§3) |
| A2 | P1 | REAL_DEV strips sat on the outer face; production stores no `axisPx` | **Fixed.** `wallproof/axis_remeasure.py` re-measures on the axis: UNet 61/63 OPENING (47 at ≥ 0.8, 0 wrong). Report §F shows both columns. 005K-a takes the strip from the jamb bands and persists `axisPx` |
| A3 | P1 | False positives were reported for WALL only; the witness consumes OPENING | **Stated.** Report §G and recommendation §2 carry the reviewer's numbers (open gaps 44.5 % OPENING, dimension ink 18 % OPENING). 005K-a gate: the witness must read BACKGROUND on drawn-but-open gaps |
| A4 | P1 | The witness is not "like a callout" and bypasses the pattern guard | **Fixed.** Callout-equivalent two-signal rule: drawn evidence (incl. pre-override signatures) **and** model OPENING; BLANK excluded; stability bracket (§5.5) |
| A5 | P1 | The IP-02 split is undefined and contradicts "never creates a gap" | **Fixed.** The split is removed from 005K; REC-03 / UP-06 is a separate coordinator decision |
| A6 | P1 | "7 of 12 P0 seams" double-counts | **Fixed.** Now "3–4 distinct gap decisions among 7 distinct P0 decisions" |
| A7 | P1 | "Not more wall" holds only for IP-01 | **Fixed** by dropping IP-02 from 005K; the claim is now scoped to the gap reading |
| A8–A12 | P2 | UNet vs MiT axis; blind-8 box coordinates; "pre-registered" wording; crop-mode latency extrapolated; citation drift | Accepted. MiT-B0's lower false-OPENING rate is recorded in `verdicts.json`. The pier box is corrected (C2). The rules are described as "fixed before the scoring run". "≈ 0.1 s per crop" is labelled an estimate. `withCallout` is cited at `:2808` |

## C — training data and evaluation

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| C1 | P1 | REAL_DEV targets on the outer face | **Fixed** with A2 (same re-measurement, both models) |
| C2 | P1 | The gozdzikowcach pier is misplaced; "36 % wall" was a question error | **Fixed.** The question is excluded from scoring for every arm (`exclusions.json`). The pier box is moved to x 435–452 and reads 100 % wall in both models. With B on the pier, both answer TERMINATES (0.98 / 0.97). The limitation is removed from the training plan, report, recommendation and verdicts |
| C3 | P1 | The cyklamenach analogue tests an easy negative; no real PATTERN question | **Stated** (report §G); generator v2 adds patterns **on the wall line**, and the balanced real set must include real PATTERN |
| C4 | P1 | Generator v2 fixes the shortcut in one direction only; pairs not minimal | **Fixed in the 005K spec**: faint-symbol positives and minimal pairs |
| C5 | P1 | Real evidence is tiny; ≤ 0.5 % cannot be shown at the planned size | **Fixed in the 005K spec**: the unit is stated; the gate is an upper bound on a stated n; ≈ 600 independent questions per class are needed to show ≤ 0.5 % |
| C6 | P1 | The legal claim contradicts Route C; teacher unexamined | **Fixed** with D1 |
| C7–C14 | P2 | Class↔family coupling; corpus-doc errors; scorer details; pilot composition; pre-registration wording; label quality; blind-8 coverage; units | Partly accepted. C9a: the majority-baseline tie is now deterministic, and balanced classes give no "minority". C9b: consistency is quoted on answered pairs. C9c/d (lenient-parser confidence, pseudo-replication) and C7/C8/C12–C14: stated as limitations (report §O); not re-run |

## D — licensing and supply chain

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| D1 | P1 | Route C trained on publisher crops and used a hosted teacher on them | **Fixed.** Real crops are evaluation and calibration only, in every route. A teacher on real crops is CONDITIONAL on counsel, with the counsel questions named (training plan, recommendation §6, licensing §4.6–4.7) |
| D2 | P1 | The "clean-room" claim for MiT-B0 is overstated | **Fixed** in all places: "independent re-implementation, not clean-room; its structure follows the Apache-2.0 PVTv2 / HF code". A MiT fallback would be built on that code with its notice |
| D3–D11 | P2 | Florence sample identity; NC research use; clones not deleted; oracle crops; fonts; isolation-test breadth; environment locks; MitUNet grounds; SmolVLM v1 wording | All fixed. Florence caveat narrowed to the reviewer's sample. ResPlan / RESEARCH_ORACLE_ONLY reworded. Clones and ResPlan data deleted. The 47 publisher crops read by the oracle are stated. Fonts and Pillow pinned. The isolation test checks base64 payloads in every audit file, long numeric arrays, size, and more asset types. Environment locks committed and checkpoint hashes recorded. MitUNet grounds named. SmolVLM v1 is "relatively" cleaner |

## E — architecture and integration

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| E1 | P2 | Freeze verified; notes on how it is stated | Accepted. The report states the hash method (`sha256(git ls-files -s)`) and the empty production diff |
| E2 | P1 | The OPEN_SIDE split is a decision rule | **Fixed.** Removed from 005K |
| E3 | P1 | Single-signal upgrade ≠ `withCallout` | **Fixed.** Two-signal rule (§5.5) |
| E4 | P1 | No counterfactual replay; the round-8 outcomes would not move | **Fixed by measurement** (A1). Gate 7 now covers outcomes, not only first bad decisions. The report says cyklamenach needs REC-17 / TOO_LARGE and gozdzikowcach the storey seam |
| E5 | P1 | The query-volume plan is circular for a witness | **Fixed.** The witness is asked unconditionally for every eligible gap (7–64 per house, median 24). Refusal-triggered figures are restricted to the rejected server option |
| E6 | P1 | No execution design | **Fixed.** A deterministic tiled pre-pass is recommended; the strip is sized from the jamb bands, not metres |
| E7 | P1 | Missing 005H items | **Fixed in the 005K-b spec**: hosting and training record, self-test, architecture test, the bundle test, failure policy, memory bound |
| E8 | P1 | Conflict with 005I's PATH B unstated | **Fixed.** Recommendation §4: 005K displaces PATH B (only 2 of 26 sources carry a PDF); the coordinator decides the order; 005I's "evidence already present" is reconciled |
| E9 | P1 | No stop rule | **Fixed.** 005K-a / 005K-b, with the deterministic fallback measured by the replay |
| E10–E13 | P2 | Pack records; citations; flag semantics and parity cap; witness ≠ corroboration | All folded into the 005K spec (§5.1, §5.5, 005K-b items 4–5) |

## B — VLM / edge AI

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| B1 | P1 | "On the same closed questions" is false: each arm ran on a different, non-random subset | **Fixed.** `score.py` now scores every pair of arms on their common questions, the modes on questions a model has in all three, the majority floor on the answered subset and counterfactual pairs both members answered (`vlm-bakeoff.md` §8; no earlier number changed, checked by diff). Recomputed independently, these match the reviewer: oracle ∩ SmolVLM2 138/141 vs 46/100; oracle ∩ Moondream 123/126 vs 23/49; SmolVLM2 modes on 319 matched questions RAW 54.0 %, CANDIDATE 49.3 %, SEMANTIC 51.9 %. The report, recommendation and PROJECT_STATUS say each arm's subset differs; the Florence-2 row is labelled "blind-8 64, one development house 29, synthetic 2"; the small VLMs' consistency is stated to be synthetic |
| B2 | P1 | SmolVLM2 was judged at 1/17 of its default visual budget | **Fixed.** Every place that quotes the zero-shot result now says: 64 image tokens (`do_image_splitting=False`, one 512² tile), fp32 vision, int8 decoder, forced prefix — the deployable configuration. The reviewer's default-splitting probe: ⟪B2_PROBE_RES⟫ The default configuration costs ≈ 225 s per question in the shipped runtime, so it is not deployable either way |
| B3 | P1 | Florence-2 STRUCTURED cannot answer OPENING on a line target; "8 of 8 UNRESOLVED" is a scoring artefact | **Fixed.** Restated in report §E: the grounding test was degenerate for line targets (zero-area target box); with a proper box it would have said OPENING on 3 of 8 through region boxes of 36–37 % of the crop; nothing was localised on the window. If STRUCTURED is reused, gap targets get the jamb-band rectangle. The Florence-2 verdict does not change |
| B4 | P1 | The edge argument is per house; "≈ 16 s" is the floor | **Fixed.** The android matrix §2 gives the per-shape table (16.9 / 17.6 / 20.4 s; GEN 17.3 / 23.2 s) and the per-house cost: ≈ 7 min per median house, 2–19 min per house on a desktop core, ×2–5 on a phone. Every "≈ 16 s" in the report, recommendation, training plan, server note and PROJECT_STATUS is replaced |
| B5 | P2 | The oracle's 0 confident-wrong depends on the threshold; real truth and the oracle share a reader | **Stated.** Recommendation Q3: 144 of 147 answered is the robust figure; 2 confident-wrong at 0.75; its confidences are verbal self-reports. The synthetic 98 / 101 against generator semantics is the clean solvability figure; real agreement is an upper bound (report §O) |
| B6 | P2 | In GARAGE_BODY the candidate overlay covers the dashed door line | **Accepted.** No arm is favoured (same bytes for all), but the 24 items are malformed in the C2 sense; recorded in report §O. The challenger's generator v2 must put targets in mask channels, never over the evidence (`recommendation.md` §6.1) |
| B7 | P2 | Summary metrics flatter constant answerers | **Fixed** in the read-outs: the answered-subset floor (SmolVLM2 62.7 %, Moondream 54.4 %, Florence-2 75.7 %) and both-answered pair accuracy (SmolVLM2 both right 19 %, same answer 57 %; Moondream 0 % / 94 %) are in `vlm-bakeoff.md` §8 and report §E. Per-class AUROC, balanced accuracy and pair accuracy are added to the challenger's gates (§6.5) and the training-plan gate 4 |
| B8 | P2 | ENUM_SCORE is sound; mild off-distribution prefix; Moondream sees one 378² view | **Fixed.** The prefix probe (same argmax on 41 / 68; 21 / 49 vs 19 / 46) is cited in report §E. Moondream's preprocessing at 512² (template (1, 1), one global view, no crops) is corrected in the android matrix and `vlm/vlm-audit.md` |
| B9 | P2 | Two latent false positives in the lenient parser | Accepted; neither occurs in a way that moves a conclusion (0 and 2 cases). Not re-run |
| B10 | P2 | Coverage gaps (no SmolVLM2 REAL_DEV RAW / SEMANTIC; Florence-2 on one house) | **Stated** (report §E coverage, §O). The conclusions also stand on the complete blind-8 CANDIDATE_OVERLAY set and on the matched subsets; blind-8 is development evidence on two houses and 17 base questions |
| B11 | P2 | The pilot's real signal is inverted; it tested a different design | **Fixed** in `training-plan.md` (Route C row): AUROC 0.26 / 0.31 on two real classes; no abstention output; RGB overlay input. The negative applies to that design |
| B12 | P2 | An int8 vision encoder via MatMul-only quantisation was not tried | **Stated** as UNTRIED, not impossible (android matrix §2). It does not change the per-house order of magnitude |
| B13 | P2 | "Route A not now" leads with its weakest reason | **Fixed.** The training plan now leads with per-house cost and measured transfer failure; zero-shot accuracy is last. The frozen-encoder linear probe is named as the cheap offline check |

**B's position** was written on the pre-flip recommendation: from the VLM and edge side, a from-scratch wall model is the
only arm that is both accurate and edge-feasible, and ADOPT_SMALL_VLM_REFEREE is rightly rejected. Both still hold. B
did not weigh the wall model against the deterministic rule; F did, and that is what moved the primary. The wall
model is retained as the SECONDARY challenger for exactly the reason B gives.


## F — generalization red team

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| F1 | **P0** | The reason given for rejecting NO_AI_YET does not distinguish it from the primary | **Accepted; the decision flipped.** PRIMARY_NEXT is **NO_AI_YET** made concrete (records, sealed fresh-sheet gap set, deterministic drawn-gap upgrade with tightened eligibility, constant control; `recommendation.md` §5). TRAIN_BUILDPLAN_WALL_MODEL is SECONDARY_LATER, trained only if the sealed set shows deterministic false upgrades that matter and that the model refuses (§6) |
| F2 | P1 | The replay's "verdict" column is not the holdout verdict | **Fixed.** Recommendation §3 "Two cautions": `openingsAllBuilt` / `resolvedWithAWitness` cannot fail on replay outputs, and the legibility check is vacuous without the graph, so only hash-level and storeys / footprint claims are made. rarytasy-g2e is removed from the PASS list. The matrix is stated as 24 rows, 21 replayed, 19 valid, with the three skipped rows named. The fidelity count is one number everywhere |
| F3 | P1 | "TRUTH" is not truth; ALL_DRAWN bridges walls that do not exist | **Fixed.** The run is renamed EXCLUDE-porch with "1 of 10 gaps checked". ALL_DRAWN is described as an upper bound that also bridges phantom stretches; `gap-X-413` (a dashed stretch through a room) is measured: UNet 99.7 % background. 005K's deterministic upgrade has tightened eligibility (§5) |
| F4 | P1 | The decisive gap's reading has no record and depends on strip placement | **Fixed by measurement.** `blind8_regions.py` adds the 0.41 m gap at the production `linePx` 538, the face strip, rows 542–550 and the jamb band; UNet reads 15.7 / 28.2 / 94.1 / 82.7 % OPENING (report §F). 005K's per-gap record persists `axisPx` and the jamb that supplied it |
| F5 | P1 | The axis re-measurement takes its inward side from the truth; the real set has one class | **Stated** everywhere the 61/63 appears: recall on a one-class set, inward side from the truth outline; a constant answer also scores 63/63, and the flipped side scores 0/63 |
| F6 | P1 | Real "say no" evidence is 7 questions with 1 confident wrong | **Stated** (recommendation §2): 6 of 7, confidently wrong at the only hard case (azaliach canopy, WALL 0.83); Wilson 95 % upper bound 51 % |
| F7 | P1 | Even the upper bound moves no verdict; the "recurring failure" story covers one of two houses | **Stated** (recommendation §2, report §E): no verdict moves on any row; storeys, REC-17 / TOO_LARGE and the recessed-entrance relation are what block verdicts |
| F8 | P1 | 005K-a's gates cannot tell a useful witness from a constant one; none is out of sample | **Fixed.** The sealed fresh-sheet gap set, labelled before any rule or model runs, with a constant control, is 005K's item 2 and the challenger's adoption gate (§5–§6) |
| F9 | P1 | "Transfers to real sheets" is about one publisher; the generator was fitted to its failures | **Stated** (report §F, recommendation §2): one publisher at ≈ 40 px/m; the sealed set must include a non-ARCHON publisher and more than one scale |
| F10 | P2 | ALL_DRAWN also changes a failing reading (azaliach); events ≠ distinct gaps | **Fixed.** "2 of 19 valid rows change a decision" (zurawkach, azaliach); events vs distinct gaps stated in report §E caveats |
| F11 | P2 | The VLM conclusion is broader than measured | **Fixed.** Scoped everywhere to three checkpoints ≤ 0.5 B, zero-shot, single 512 px tile, one prompt (and, with B2, 64 image tokens); 1–3 B VLMs, tiling and few-shot were not tested |
| F12 | P2 | "Whole-image referee does not transfer" rests on one weak pilot | **Fixed.** "This pilot" (one run, 8 seeds, 256 px), with B11's design caveats; HYBRID is rejected on sequencing |
| F13 | P2 | The post-hoc pier re-placement claim should go | **Fixed.** Labelled an anecdote in `exclusions.json` and report §G; it plays no part in any score |
| F14 | P2 | "REAL_BLIND8" misleads | **Fixed.** Shown as ROUND8_DEV in `vlm-bakeoff.md`; the report defines "blind-8" as round-8 development questions |
| F15 | P2 | Gap ids collide across copies and scales | **Fixed** in the 005K spec: the record key carries the copy, the decomposition, the scale (mpp) and the reading (§5.1) |

