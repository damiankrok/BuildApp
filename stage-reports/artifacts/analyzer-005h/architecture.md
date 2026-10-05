# 005H — external numeric recogniser: architecture

The custom template reader (the numeric lattice, 005E/005F) stays. Beside it, every dimension label on every plan is
read a second time, independently, from the same pixels, by PaddleOCR `PP-OCRv6_tiny_rec` (official ONNX, pinned by
SHA-256) on ONNX Runtime Web 1.30.0 (WebAssembly, one thread). One rule (P2) says what the two readings make of the
label; the metric resolver decides, as before, by the arithmetic of the chains.

## Packages and the one-way flow

```
source-metrics                        numeric-recogniser-ort                 analysis-service / apps
──────────────                        ──────────────────────                 ───────────────────────
recogniser.ts   LabelRecogniser  ◄──── client.ts  workerRecogniser ◄──────── local-analyzer wiring (APK)
  (types only: crops in,               worker.ts  ocr-worker.mjs             second-house --recogniser
   candidate readings out)             engine.ts  onnxruntime-web            (analyzer-api: none — OFF)
ensemble.ts     P2 rule                paddle.ts  preprocess, CTC
extract.ts      async seam             bracket.ts four variants
metric-solution readingOf / rival      manifest.ts pins, verified bytes
```

- `source-metrics` imports no runtime and no recogniser implementation; `reconstruction`, `geometry`, `model`,
  `source-cv`, `source-vision` reach neither (tests/architecture/recogniser.test.ts).
- Only `numeric-recogniser-ort/src/engine.ts` imports `onnxruntime-web`. The analyzer bundle (`analyzer.mjs`) carries
  none of it; the worker (`ocr-worker.mjs`) carries ORT's Node build and the decoder.

## What the recogniser sees (non-circularity)

`LabelCrop = { key, gray, capPx }` — nothing else. In `metricEvidenceSteps`, per plan frame, after the lattices exist
and **before** `solveFrameMetric` runs, each latticed token is cut from its own orientation's pass field at
`token.passBox` padded `0.35·cap` (min 3 px) and keyed opaquely (`c0`, `c1`, …: a lattice id would carry the custom
reader's text). The generator yields one batch per frame; the async driver hands it to the recogniser and resumes with
the readings. No scale, span, chain, published figure, room area or model candidate exists yet, and none is passed.
With `recogniser: undefined` the generator never yields and the bytes are the sync path's.

## The reading (worker, per batch)

1. Verify model, dictionary, WASM and loader against the manifest pins (SHA-256 + size); refuse otherwise.
2. Write the verified loader bytes to a private temp directory; `env.wasm.wasmBinary` = verified WASM bytes;
   `numThreads = 1`, `proxy = false`; `fetch` replaced by a function that throws. Create the session from model bytes.
3. Per crop, four reads (BASE, PAD2, TRIM1, SCALE90): Paddle preprocessing (H 48, W ≥ 320, [-1, 1]), digit-constrained
   CTC prefix beam (24 wide, top 5) and greedy over the whole alphabet on BASE; stable = the same top value in all four.
4. Release the session, answer, and be terminated. Progress after every label; `loading` after each load step.
5. Client side: one worker per batch, a watchdog (300 s load, 120 s per label), cancel = terminate, RSS sampled before,
   after load, after OCR, after exit — recorded for every batch, read, failed or cancelled.

## The P2 rule (`ensemble.ts`)

The external reading **corroborates** only when posterior ≥ 0.90, greedy mean p ≥ 0.90, stable by the bracket's own
records, and the greedy reading over the whole alphabet *is* the digit string (the model's own answer, not a digit
the beam substituted for `·`, `⁵`, `/`).

| case | decision | reading | class | candidate |
| --- | --- | --- | --- | --- |
| same digits, corroborating | AGREES | lattice | CLEAR | — |
| lattice CLEAR/SUPPORTED, other digits, same count | CONTESTS | lattice | AMBIGUOUS | external value only if corroborating |
| lattice CLEAR/SUPPORTED, other count | CONTESTS_COUNT | lattice | AMBIGUOUS | never |
| lattice in doubt / no dimension, corroborating dimension | LEADS | external | SUPPORTED | lattice value of the same count |
| decimal lattice, or model's own answer not bare digits | AGREES (same digits, corroborated) / CONTESTS(_COUNT) without candidate / NOT_COMPARABLE | lattice | — | never |
| otherwise | NOT_CORROBORATING / NO_VALUE | lattice | unchanged | — |

Neither reading wins because it is external; a value of another digit count never contests a scale; there is no
fallback (a recogniser failure ends the run as `EXTERNAL_RECOGNISER_FAILED`, never a quiet lattice-only run).

## Versions and evidence

- Lattice reader `1.2.0` and metric-evidence schema `1.6.0`, the `metrics.ocr-ensemble@1.0.0` extractor and the
  `recogniser` record appear only when the recogniser read at least one label; otherwise the set is the 1.5.0 set,
  byte for byte.
- Evidence Pack: `07-ocr-labels.json` carries each external reading and the rule's decision, plus the recogniser's id,
  model, runtime and WASM hash; the timeline gains `EXTERNAL_OCR_CANDIDATES` (after `OCR_SEQUENCE_CANDIDATES`, before
  `OCR_READING`); the manifest names recogniser, model SHA-256, runtime and runtime SHA-256.

## Where it runs

- Phone (APK): on. The bundle ships `ocr-worker.mjs`, `ort-wasm-simd-threaded.{wasm,mjs}`, `models/` (model +
  dictionary) and `ocr-self-test.mjs`, each hashed in the bundle manifest and verified on install.
- Analyzer API (server): off — the same URL there gives the pre-005H evidence and candidate hashes.
- Desktop scripts: `--recogniser` on `analysis:second-house`; tests use the in-process engine.
