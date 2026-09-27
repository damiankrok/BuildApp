# Rarytasy garage roof: before and after (INTEGRATION-003B)

Project: *Dom w rarytasach 5 (G2E)*, evaluation only. Production code never reads these files
(`tests/architecture/second-house.test.ts`). No publisher drawing is committed: every image here
is a render of the analyzer's own model.

| File | What it is |
|---|---|
| `result-summary-before.json`, `analysis-trace-before.json`, `scene-views-before.png` | The live URL through the analyzer at the start of this stage (`fb415e4`, solver 2.0.0): garage roof FLAT, closure DEGRADED with 5 exterior errors. |
| `result-summary-after.json`, `analysis-trace-after.json`, `scene-views-after.png`, `source-hashes-after.json` | The committed sealed evidence `rarytasy-generalization/post-fix/` replayed offline through solver 2.1.0. The live URL fetched during this stage gives the same model and scene hashes. The CI replay step checks against this summary. |
| `roof-graph-before-after.json` | The roofs, roof planes, roof edges, roof relationships, chimneys and garage wall tops, before and after. |
| `android/second-house-{before,after}-*.png` | The same scene bundles drawn by the Android JVM evidence rasteriser in MODEL / CLAY / LINE (rows: three-quarter, rear three-quarter, front elevation; `-layers`: CLAY and LINE × all / roof off / ground only). |

Recreate the "after" summary with
`OFFLINE=1 npm run analysis:second-house -- --package stage-reports/artifacts/rarytasy-generalization/post-fix/source-package.json --graph stage-reports/artifacts/rarytasy-generalization/post-fix/observation-graph.json --cache <bytes> --out <dir>`.
Then check it with `BUILDAPP_SECOND_HOUSE_DIR=<dir> npx vitest run tests/benchmark/second-house-roof.test.ts`.
