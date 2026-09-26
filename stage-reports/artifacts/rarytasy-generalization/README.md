# Second-house generalization artifacts (BUILDAPP-03Y2G)

Project: *Dom w rarytasach 5 (G2E)*, the owner's second test project. These files are evaluation
material. Production code never reads them (`tests/architecture/second-house.test.ts`).

| Folder | What it is | How it was made |
|---|---|---|
| `pre-fix/` | The evidence the analyzer read **before** this stage: package, graph and metric evidence (the 8.51 cm/px plan scale). `failure.json`, `analysis-trace.json` and `plan-diagnostics/` show what today's solver says about that evidence: `PLAN_LAYOUT_REJECTED` at REGISTERING_VIEWS / STRUCTURAL_LAYOUT (417 m² against the published 189.77 m²). `node18-local-analyzer-events.jsonl` is the local-analyzer event stream of the pre-fix bundle under Node 18.20.4 (x64, no ICU). It ends in the generic `ANALYSIS_FAILED`. | `npm run analysis:second-house -- --package pre-fix/source-package.json --graph pre-fix/observation-graph.json --metrics pre-fix/metric-evidence.json --out pre-fix` |
| `post-fix/` | The live URL through the production pipeline after this stage. Includes the sealed inputs, `source-hashes.json`, `analysis-trace.json`, `result-summary.json`, per-layer plan overlays, and `scene-views.png` (front, right, top and axonometric views of the compiled scene). It also holds two runs of the same URL through the APK's analyzer, each with its own fetch: `node18-no-icu-bundle/` (the bundle on Node 18.20.4 without ICU) and `android-emulator-live.json` (Android 14 x86_64 emulator, CI run 45). Both give the same model and scene hashes as the desktop run. | `npm run analysis:second-house -- --url <project url> --out post-fix`; `run-host.mjs --node <node18> --no-icu`; CI `local-analyzer-device` |
| `phone-like-no-853-plans/` | A replay of the leading hypothesis for the owner's phone failure: the two 853 px plan drawings withheld, leaving the 550 px and 400 px renderings. Today's solver names the failure `PLAN_NO_WALLED_ENVELOPE` in PLAN_DECOMPOSITION instead of a generic failure. | as `pre-fix`, on the post-fix evidence, with `--drop-frames <the two 853 px plan frames>` |

`plan-diagnostics/<frame>-<layer>.png` shows these layers over the plan:

- `source`: frame, size and scale
- `bands`: wall bands
- `grid`: chains and grid lines
- `cells`: cells
- `flood`: OUTSIDE red, RECESS amber, BUILT green
- `masses`: masses
- `all`: every layer together

`digest.json` holds the numbers the pictures are drawn from.
