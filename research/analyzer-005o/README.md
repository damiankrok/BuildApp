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
| `statement_crops.py`, `label_sheets.py` | blind transcription material for the offline scorer (outside the repo) |

Exact commands are in the stage report (`stage-reports/STAGE_BUILDPLAN_ANALYZER_005O_METRIC_EVIDENCE_OSS_BAKEOFF.md`).
