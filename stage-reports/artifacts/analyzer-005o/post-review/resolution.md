# 005O — post-review resolution

Every finding has a disposition: FIXED (changed and re-generated), DISCLOSED (stated in the report, not changed), ACCEPTED (left as is, with the reason). No P0 was filed.

| id | final severity | disposition | what was done |
| --- | --- | --- | --- |
| L1 | P3 | FIXED | Control redone on evidence with every external reading stripped from the copy the solver reads (`/home/user/work005o/glog-stripped-metric-evidence.json`, outside the repo): frozen and M1 both refuse, failure.json byte-identical to M0. The vacuous run is kept and labelled as such in `counterfactuals.json`; report §G. |
| L2 | P1 | FIXED | `score.py` adds the readers `frozenAsPrinted` and `tokenText`; the reader table now shows frozen as-printed 55.5 % (372/670), literal token 69.1 % (471/682) and relabels the hybrid TOKEN candidate (54.5 %); report Summary/§E/§O and PROJECT_STATUS corrected. |
| L3 | P2 | FIXED | De-duplicated sensitivity (n = 608) in `metric-statistics.md` and report §E; all headline rates keep their full-n value with the dedup figure beside them. |
| L4 | P2 | DISCLOSED | Deviation stated in report §D (6 records, all correct and in K, no house change); a carried-forward M3 must be a new variant. M3 is not recommended. |
| L5 | P2 | DISCLOSED | Channel named in report §D (A05 912 under M3, A06 zero [1101] under M2; no house outcome change). Not re-run: neither M2 nor M3 is recommended. |
| L6 | P2 | FIXED | Report Summary/§D name the five consumers; `zero` WRONG column added to the label table (`metric-statistics.md`, §E); §O makes the consumer choice the 005P decision. |
| L7 | P2 | DISCLOSED | Report §N discloses the seeded control list, the co-occurrences, and the 62/62 cross-check against 005E labels (`truth-crosscheck.json`). |
| L8 | P2 | DISCLOSED | Report §E/§N: truth is crop-level; "0/507" reported as agreement with the blind transcription of the same crop. |
| L9 | P3 | FIXED | Report §F quotes mppX 4.3382 / mppY 4.3567 / scorer 4.34745 and M0 2.8022, labels the copy-ratio check post-hoc and gives the 4.220/4.353 frame readings. |
| L10 | P3 | FIXED | `score.py` propagates truth through the same-sha twin (kosacce-tracked); house table now 17 correct / 5 unknown at M0. |
| L11 | P3 | FIXED | Report §E: 117 K={TOKEN}, 5 token + agreeing confident lattice; the one lost correct (kosacce-clean 2-against-1) named. |
| L12 | P3 | ACCEPTED | No reported number changes. A static test asserts the generator names no truth/labels/sheet path (research-isolation 005O block). Remaining cosmetic items (tolerancePx pass-through, message text, bootstrap code unification) left as is in research tooling. |
| T1 | P1 | FIXED | `export_artifacts.py` records package `documents` and `adapter` in `source-inventory.json`; PDF.js restated as "not on the failing path; DEFER (005G PILOT stands)" in report §C, `technology-kernel-decision.md`, `licensing-runtime-matrix.md`. |
| S1 | P2 | FIXED | `score.py` diffs semantics (wide openings, bodies, wall kinds) and decision path per row; report §F lists jarzabem's open-side, terrace and wall changes and makes the ranking question the 005P trade-off. |
| S2 | P1 | FIXED | Reported as an adverse house-level effect of M2/M3/M3b (report Summary/§B4/§F/§O); `decisionPathChangedVsM0` captures it; M2/M3 explicitly not recommended. |
| S3 | P2 | FIXED | M1b A07 and D00 re-run (both COMPLETED); `score.py` lets failure.json or a FAILED trace win over result-summary; report §J. |
| T2 | P2 | FIXED | `technology-kernel-decision.md` and report §C cite the sealed OPENING_IN_WALL (score 0.8) and mark the true-exterior-gap reading as inferred from code; the verdict rests on the pier/band miss and the snap window. |
| F1 | P2 | FIXED | Report §B2 records the blind-9 frame (44d6d1166d, 1.516 cm/px) vs the 005N/005O frame (36e1e5a39d, 2.451) as a candidate earlier first-bad decision; the per-dimension table is committed in `baseline-first-bad.json` (`perPrintedDimension`, `frameSelectionNote`). |
| S4 | P2 | FIXED | Decision-path column added (`metric-statistics.md`, report §F table); rarytasy-eoze, milorzebem and akebiach reorderings listed. |
| N1 | P3 | FIXED | One truth figure (2.6286) throughout, the solution 2.626058 x 2.620832, "5 chain corrections + 1 READ", 870 marked scale-chosen; jarzabem artifact values quoted. |
| T3 | P3 | FIXED | Rectangle gaps (34 / 47 / 8 px) added beside the axis gaps in `akebiach-topology.json`, `technology-kernel-decision.md` and report §C. |
| H1 | P3 | FIXED | Tracked PNGs rewritten by the e2e gate restored with `git checkout --`; staging is explicit; worktree clean at the end. |
| LMP-1 | P1 | FIXED | `research/analyzer-005o/transcription-protocol.md` (prompt, SHA-256, data flow, bias); a data-flow row in `licensing-runtime-matrix.md`; report §N. |
| LMP-2 | P2 | FIXED | Report §J gives the control-based noise band (0.96–1.06x), calls M1 within noise, labels the baseline M0H and discloses sequential/overlapping batches. Not re-timed interleaved: no decision depends on a sub-noise difference. |
| LMP-3 | P2 | FIXED | `licensing-runtime-matrix.md`: PP-OCR training data UNDISCLOSED; reference LSD sources AGPL-3.0-or-later separately from OpenCV.js/ELSED Apache-2.0. |
| LMP-4 | P2 | FIXED | `refuse_inside_repo()` runtime guard in `statement_crops.py`, `label_sheets.py`, `glyph_corpus.py`; manifest path repo-anchored; research-isolation test asserts the guards. |
| LMP-5 | P2 | FIXED | Report §P: ordered command list incl. the Node 18 esbuild bundle; README lists every research file. |
| LMP-6 | P2 | FIXED | Report §J: M1b per-house estimate adds one cold session, excludes page decode, gives the 928 MB process RSS. |
| LMP-7 | P2 | FIXED | As H1. |
| LMP-8 | P3 | DISCLOSED | Report §J names the reruns that overwrote logs (9 ENOSPC M1b cases, A07/D00, M3b). Timing logs are not frozen separately; `performance.json` is committed from the final work dir. |
| LMP-9 | P3 | FIXED | Nearest-rank p95, suppressed below n = 20 (`export_artifacts.py`). |
| LMP-10 | P3 | FIXED | `glyph_score.py` adds a design-cluster CI over 5 designs ([0, 1.67 %]); report §H says 7 files ≈ 5 designs. |
| LMP-11 | P3 | FIXED | Section pointers fixed; determinism evidence names the 3 true rerun pairs plus the review replay; the latency baseline is labelled M0H. |
