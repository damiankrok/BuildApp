# research/analyzer-005o — metric evidence rescue and targeted open-source bake-off (RESEARCH ONLY)

Nothing here is imported by production code, and nothing here may enter a `package.json`, the APK or the analyzer
bundle. Publisher pixels, crops, sheets, replays and any third-party tool live OUTSIDE the repository
(`/home/user/work005o`); only text and JSON facts (ids, boxes, hashes, numbers) are committed under
`stage-reports/artifacts/analyzer-005o/`.

| file | role |
| --- | --- |
| `preregistration.md` | hypotheses, challengers M0–M3 (+ M1b, M1P), truth, metrics, winner rule — committed before any challenger ran |
| `freeze-manifest.mjs` | production freeze (write at start, check at the end) |
| `cases.json` | the 44 cases: 005N's 42 development rows + blind round 10 (revealed development) |
| `as-printed-harness.mjs` | Vite module swap (outside the repo) giving plan resolution a per-statement as-printed view |
| `replay.mjs` | solver-only matched replays of every case under one label / one view directory |
| `statement_crops.py`, `label_sheets.py` | blind transcription material for the offline scorer (outside the repo; both refuse an output inside it) |
| `transcription-protocol.md` | who transcribed, with what prompt (SHA-256), the data flow and the disclosed biases |
| `truth.py` | agreement-only truth from the two transcriptions → `labels/truth.json` (outside) + `label-truth-summary.json` |
| `as_printed_views.py` | truth-blind view generator for M0X, M1, M1P, M1b, M2, M3, M3b |
| `test_views.py` | 15-case logic corpus + 4 mutations (run by `tests/architecture/research-isolation.test.ts`) |
| `reread.ts` | M1b: the deployed PP-OCRv6 on each lattice-less statement's crop; 40-crop validation against sealed readings |
| `glyph_corpus.py`, `glyph-read.ts`, `glyph_score.py` | synthetic glyph corpus (7 font files ≈ 5 designs), its production-path reads and scoring |
| `score.py` | the only place truth meets the challengers → `metric-bakeoff.json` |
| `stats_report.py` | `metric-statistics.md`, `counterfactuals.json` |
| `export_artifacts.py` | `source-inventory.json`, `numeric-candidate-ledger.json`, `chain-constraints.json`, `performance.json` |
| `m4_orientation_diag.py` | addendum A: orientation decided by the reader's posterior (decision level only) |
| `akebiach_topology.py` | gate T: gaps on akebiach's accepted band set → `akebiach-topology.json` |

The ordered command sequence (incl. the Node 18 esbuild bundle) is §P of the stage report
(`stage-reports/STAGE_BUILDPLAN_ANALYZER_005O_METRIC_EVIDENCE_OSS_BAKEOFF.md`).
