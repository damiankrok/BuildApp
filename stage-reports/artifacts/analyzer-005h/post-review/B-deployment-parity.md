# Red team B — deployment, integrity, parity (005H, c6fe174..d04ebc4)

Static review; no builds run.

Verified: pinned WASM/loader/licence bytes match; lockfile pins onnxruntime-web 1.30.0 with sha512; worker bundles ORT's node build (`ort.node.min.mjs`), no embedded loader; no reachable network path (loader import only, `fetch` only for threads>1 outside Node, `wasmBinary` set, emscripten reads via fs, relaxed SIMD opt-in only, proxy off); `LocalRuntimeFiles` regex safe; no API newer than Node 18; APK unzip picks up `models/`; progress string correct.

| # | sev | finding | where |
|---|-----|---------|-------|
| 1 | P1 | CI "Analyzer / progress" runs program.test.ts (bundles with the model) without the model fetch → red at d04ebc4. | buildapp-ci.yml:947-974 |
| 2 | P2 | Loader `.mjs` hashed then re-read by `import(fileURL)`: executed bytes ≠ verified bytes (TOCTOU, app-private storage only); worker/self-test bundles verified only at install. | manifest.ts:97; engine.ts:34 |
| 3 | P2 | Self-test MATCH with `wasmSha256 === null`. | self-test.ts:113 |
| 4 | P2 | No-network test stubs `fetch` only in the test thread, never in the worker. | test/runtime.test.ts:24-33 |
| 5 | P2 | `OcrSelfTest.finish()` publishes before `onProcessGone`; the next device test can bind the dying process (RUNTIME_REUSED). | OcrSelfTest.kt:129-135 |
| 6 | P2 | UI: Analizuj stays enabled during the self-test and does nothing; self-test messages hard-coded, not in strings.xml. | AnalyzerViewModel.analyze(); AnalyzerScreen.kt |
| 7 | P2 | `self-test/<job>` left behind if the app dies mid-test. | OcrSelfTest.kt; LocalJobs.recoverInterrupted |
| 8 | P2 | One worker per plan: re-hash ~19 MB + recompile WASM per plan; measure on arm64. | extract.ts / client.ts |
| 9 | P2 | Any recogniser failure fails the whole analysis generically. | client.ts:92-95 |
| 10 | P2 | Phone (recogniser ON) and analyzer API (OFF) give different evidence/candidate hashes for one URL — confirm intended and say so. | wiring.ts; local.test.ts |
| 11 | P2 | protobufjs postinstall (benign, not bundled); fetch-model has no size limit/timeout (SHA still enforced). | package-lock.json; tools/fetch-model.mjs |

Verdict: integrity design holds; #1 blocks CI; #2–#5 before calling integrity/parity airtight.
