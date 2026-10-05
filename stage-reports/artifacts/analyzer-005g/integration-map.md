# 005G — integration map (every ADOPT_NEXT / PILOT tied to BuildApp files)

All anchors are at `6b4ab1f`.

## Placement of every candidate

| candidate | belongs in | never in |
| --- | --- | --- |
| numeric recogniser (PP-OCRv6 tiny, en v5 mobile) | `source-metrics` (an interface + the lattice call site) and a new runtime package that implements it | `source-vision` (asset-level, geometry-shaped), reconstruction, the resolver |
| ONNX Runtime Web | the new runtime package only; shipped by `apps/local-analyzer` | `source-metrics` itself (it stays runtime-free), the Kotlin side |
| PDF.js | `source-package` (document bytes → document facts) + a `source-analyzer` document extractor | reconstruction (the envelope decision stays there), geometry |
| floor-plan ML (if ever legal) | a `source-vision` `VisionReasoner` provider (PLAN task) | anywhere that decides |
| polygon library (polyclip-ts) | `geometry` / `model` low-level helpers, behind tests with JSTS as the oracle | reconstruction's raster envelope |
| OpenCV | nowhere now (`source-cv` is sufficient) | — |

---

## ADOPT_NEXT — external numeric recogniser ensemble: PP-OCRv6 tiny (official ONNX) on ONNX Runtime Web (WASM)

Proposed next stage: **BUILDPLAN-ANALYZER-005H — external numeric recogniser ensemble**.

### Contract

**Inputs and outputs.** The recogniser is image-only. It receives the **same upright crop** the lattice reads: the
pass field, `token.passBox` padded by 0.35 of the cap. It returns digit-constrained **top-K candidates with posteriors**,
its greedy text and mean char probability, and the **stability bracket**. The bracket re-reads with pad +2 px,
trim −1 px and scale 90 %; the reading is *stable* when all four top-1 values agree.

**Ensemble rule (P2)**, measured in `ocr-bakeoff.md`:
- The external value corroborates only when the external engine is confident (beam posterior ≥ 0.9 and greedy mean
  ≥ 0.9) **and** stable.
- A disagreeing lattice reading of class CLEAR or SUPPORTED makes the label AMBIGUOUS, with both values as
  candidates.
- A value of another digit count never contests a scale (the 005F rule, unchanged).
- The **metric resolver decides.** No external value becomes canonical by itself.

**Non-circularity.** The recogniser sees no scale, span, chain or published figure. An architecture test must forbid
`metric-solution.ts` from influencing what is sent to it.

### Package and modules to add

| path | what |
| --- | --- |
| `packages/source-metrics/src/recogniser.ts` (new) | `LabelRecogniser { id; model: { name, sha256 }; runtime: string; recognise(crops: LabelCrop[]): Promise<ExternalReading[]> }`, `LabelCrop { key, gray, capPx }`, `ExternalReading { key, topK: {text, p}[], greedy: { text, meanP }, stable, variants }`, and `cropForToken(passField, passBox)` (from `research/analyzer-005g/build-dataset.ts` `cropOf`). **No runtime import.** |
| `packages/numeric-recogniser-ort/` (new workspace package) | `src/session.ts` (onnxruntime-web 1.30.0, `numThreads = 1`, `wasmPaths`, session per run, released after OCR); `src/paddle.ts` (PaddleOCR `resize_norm_img`, CTC greedy, digit-constrained prefix beam, from `research/analyzer-005g/run-external.mjs`); `src/bracket.ts` (pad2/trim1/scale90); `models/manifest.json` (HF repo + commit + SHA-256 + dictionary); `tools/fetch-model.mjs` (fetch the pinned file and verify, like `apps/android/tools/fetch-nodejs-mobile.mjs`) |

### Files to touch

| file | change |
| --- | --- |
| `packages/source-metrics/src/numeric-lattice.ts` | `LabelLattice.external?: ExternalReading`; the P2 class rule beside `ocrClassOf` (:150) with `OCR_ENSEMBLE_BOUNDS = { posterior: 0.9, meanP: 0.9 }`; `NUMERIC_LATTICE_VERSION` 1.1.0 → 1.2.0 (:35). Leave `OCR_CLASS_BOUNDS`, `COUNT_BOUNDS` and `TAIL_BOUNDS` untouched. |
| `packages/source-metrics/src/extract.ts` | `extractMetricEvidence` (:278) becomes async, or gains an awaited batch step. At the lattice loop (:363 / `dimensionLabelLattices` :980), collect the on-line tokens' crops per frame, `await recogniser.recognise(crops)`, attach the result to each lattice. `latticeRecord` (:1015) records `external`. |
| `packages/source-metrics/src/metric-solution.ts` | `latticeAlternatives` (:421) and `correctionReadings` (:384) admit the external top-K of the **same digit count**; the contest rule above. |
| `packages/source-metrics/src/schema.ts` | `NumericLatticeRecord.external`; bump the metric-evidence schema version. |
| `packages/analysis-service/src/run.ts` | `AnalysisOptions.recogniser?: LabelRecogniser` beside `vision?` (:63). **Default `undefined`**: today's behaviour byte for byte, so every existing gate stays comparable. Await the extraction at :322. Record recogniser id, model SHA-256 and runtime in diagnostics. |
| `packages/analysis-service/src/stages.ts` | an `OCR_EXTERNAL` sub-phase under SOLVING_METRICS (progress telemetry) |
| `apps/local-analyzer/src/wiring.ts`, `src/local.ts`, `src/analyzer.ts` | wire the ORT recogniser. Run it in a `worker_threads` Worker that exits after the OCR step, so the WASM memory (+160–200 MiB) is returned before reconstruction (phone peak 1.8–2.1 GB). |
| `apps/local-analyzer/build.mjs` | copy `ort-wasm-simd-threaded.wasm` + `.mjs` + `models/PP-OCRv6_tiny_rec.onnx` into the dist; add each one's SHA-256 and size to `manifest.json`; `PROTOCOL` 3 → 4 |
| `apps/android/app/build.gradle.kts` | `bundleLocalAnalyzer` (:237–245) declares the new files as inputs (they ride the existing `assets/local-analyzer/` copy at :380–386). Licences go to `app/src/main/assets/licenses/`: ORT MIT + ThirdPartyNotices, PaddleOCR Apache-2.0. **No new `.so`, no new Gradle dependency.** |
| `apps/analyzer-api/src/wiring.ts` | the same recogniser (the server path stays the same analyzer) |
| `packages/evidence-pack/src/types.ts` (`LatticeJson` :99–130), `src/pack.ts` (:347–358, :385) | `07-ocr-labels.json` lattice records gain `external {engine, modelSha256, runtime, topK, greedy, stable, variants}`; a timeline stage `EXTERNAL_OCR_CANDIDATES` after `OCR_SEQUENCE_CANDIDATES` (`types.ts:208`); manifest `versions.recogniser` |

### Files explicitly NOT to touch

- `packages/reconstruction/**`, `packages/geometry/**`, `packages/model/**`, `packages/source-cv/**`,
  `packages/source-vision/**`.
- `packages/source-metrics/src/ocr.ts`: the template reader stays the lattice's witness, unchanged.
- `chains.ts`, `dimension-lines.ts`, `registration.ts`.
- The lattice's own bounds (`OCR_CLASS_BOUNDS`, `COUNT_BOUNDS`, `LATTICE_BOUNDS`, `TAIL_BOUNDS`,
  `STABILITY_BRACKET`).
- `synthetic-drawings/digit-corpus.ts` seeds and strata; `analyzer-005e/calibration/development-labels.json`.
- `holdout/` sealed records; the Legacy repository.

### Tests

- `packages/source-metrics/test/recogniser-ensemble.test.ts`, with a fixture recogniser and no ORT:
  - agreement corroborates;
  - a disagreement with CLEAR/SUPPORTED becomes AMBIGUOUS with both values;
  - an unstable external value is never confident;
  - an other-count external value never contests a scale;
  - `recogniser: undefined` reproduces today's `metric-evidence.json` hash.
- `packages/numeric-recogniser-ort/test/`:
  - preprocessing golden tensors;
  - CTC beam on fixed logits;
  - the model SHA-256 refusal;
  - `ORT` loads only from the given `wasmPaths`, with no network.
- `tests/architecture/`:
  - `source-metrics` never imports `onnxruntime-*`;
  - the recogniser package is imported only by `analysis-service` wiring and the apps;
  - the local-analyzer bundle contains exactly the pinned `.wasm` and model hashes;
  - no `fetch(` in the recogniser package;
  - `generalization.test.ts` still finds no house value in production code.
- `apps/local-analyzer/test/program.test.ts`: the Node 18 parity case (:231–265) runs with the recogniser, with and
  without ICU.

### Evidence Pack additions

- `07-ocr-labels.json`: external readings beside the lattice.
- `18-decision-timeline.json`: `EXTERNAL_OCR_CANDIDATES` events.
- `manifest.json`: recogniser, model SHA-256 and ORT version.
- ON == OFF determinism per layer, as 005D–005F require.

### CI gates

1. **Model and runtime integrity.** Fetch the pinned model and `.wasm`, verify the SHA-256s. Mismatch is a hard failure.
2. **Synthetic regression** (no publisher bytes in CI). Corpora 5001 / 9017 and the 005G stress corpus, generated in
   CI, through the production path with the recogniser. Gate on the 005G numbers: confident-wrong (P2) ≤ 2 / 672
   synthetic, and exact ≥ 650 / 672.
3. **Node 18 parity.** In the existing "Local analyzer / Node 18 parity" job (`buildapp-ci.yml:315–363`), the per-label
   external outputs on Node 18 (with and without ICU) equal Node 22's, hash for hash.
4. **Emulator parity.** On the x86_64 emulator, the APK's bundle gives the same per-label hashes as the desktop.
   **First device gate: the OWNER's arm64 phone gives the same hashes.** 005G measured arm64 V8 bit-identical under
   qemu.
5. **Existing gates.** Marcówki / Kosaćce / e-OZE audits and evaluations run with the recogniser **off** (unchanged
   hashes) and **on**. Any model-hash change is listed and explained per house.
6. **Fresh blind protocol** for the next stage. 005G consumed none.

### Model and asset paths, version and hash contract

| item | value |
| --- | --- |
| model | `packages/numeric-recogniser-ort/models/manifest.json` → `PaddlePaddle/PP-OCRv6_tiny_rec_onnx` @ `2612ab37152ae0a677521bae4e1e3d4fb4cf7c30`, `inference.onnx` SHA-256 `9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6`, 4 462 639 B, Apache-2.0 |
| on device | `assets/local-analyzer/models/PP-OCRv6_tiny_rec.onnx`, `assets/local-analyzer/ort-wasm-simd-threaded.wasm` |
| runtime | `onnxruntime-web@1.30.0` exact; `.wasm` SHA-256 in `manifest.json` |
| ids | recogniser id `ocr.ppocrv6-tiny-rec@9ef676d6`; `metrics.numeric-lattice` 1.2.0. Both are recorded in metric evidence and the Evidence Pack, so a model hash names the reader that produced it. |

---

## PILOT — `en_PP-OCRv5_mobile_rec` as the alternative model

**Same seam, second entry in `models/manifest.json`** (`b5f833df…`, commit `3fafbc3b…`). It is not shipped by default.

**Selected only when both hold:**
- PP-OCRv6 tiny fails a gate of the next blind protocol on a legibility cause;
- en v5 passes that gate.

**Two-model agreement (P3)** is the documented upgrade: 676 vs 631 confident labels out of 775, at the same 2 wrong.
It costs +7.2 MB and about 3× the OCR time.

---

## PILOT — PDF.js document evidence (the stage after the recogniser)

| path | change |
| --- | --- |
| `packages/source-package/src/documents/pdf.ts` (new) | `pdfjs-dist@4.8.69` (legacy, `--omit=optional`, `isEvalSupported:false`, worker in-thread, no rendering) parses the OUTLINE / DRAWING_SET bytes `acquire.ts` already fetches and hashes (:458–483). Output `DocumentFacts { pages, statedScale, scaleBarFit, numericText[], filledPolygons[], strokes[] }` in points, plus the document SHA-256. |
| `packages/source-package/src/schema.ts` | `SourceDocumentSchema` (:248–265) gains optional `facts`; SourcePackage schema 1.3.0 → 1.4.0 |
| `packages/source-analyzer/src/extractors/document.ts` (new) | document facts → observations: `SCALE_STATEMENT`, `SCALE_BAR`, `OUTLINE_POLYGON` (each `SOURCE_EXACT`, with the document hash) |
| `packages/source-metrics/src/registration.ts` | registering the outline to the plan makes the document scale an independent witness of the plan scale. This is non-circular: the document never sees the plan's chains. |
| outlined-glyph PDFs | glyph-path clusters rasterised by our own scanline (`research/analyzer-005g/pdf-outlined-text.mjs`) and read by the **same recogniser**: this stage depends on the recogniser stage |

**Not to touch:** the reconstruction envelope decision. The pilot records outline evidence and compares it; it
does not choose.

**Tests:**
- golden facts for synthetic PDFs generated in-test;
- the Aster facts as text-only expectations, behind the cache;
- Node 18 / no-ICU parity.

**CI:**
- bundle size;
- no `canvas`;
- the no-ICU run.
