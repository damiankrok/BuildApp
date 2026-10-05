# 005G — current BuildApp analyzer architecture (as audited at `6b4ab1f`)

This audit was done before any external tool was evaluated. Every claim cites the file and line it was read from at
`6b4ab1fcf5c049c0b9af3a73e11423be9fccd645`.

## SINGLE_REPO_AUDIT = PASS

- BuildApp (`damiankrok/BuildApp`) is the only production repository.
- No BuildApp build, test, script or bundle reads from `BuildPlan-PC-Legacy`. The `integration-003*` stages adapted
  donor code into BuildApp and recorded the donor SHA as text only.
- 005G did not read, branch, modify or push Legacy. The Legacy checkout in this session stays at
  `claude/new-session-3kzcgh` @ `b0e7967` with a clean tree.

## The one canonical pipeline

`packages/analysis-service/src/run.ts` `runAnalysis` (:156):

| # | stage | call (file:line) | what it owns |
| --- | --- | --- | --- |
| 1 | acquire | `acquireSourcePackage` run.ts:203, or `SourcePackageSchema.parse` of a sealed package | `SourcePackage` |
| 2 | classify roles | run.ts:235–253 | `NO_DRAWINGS` / `SOURCE_INCOMPLETE` stops |
| 3 | observations | `analyzeSourcePackage` run.ts:274 (vision: `options.vision ?? nullVisionReasoner()` :273) | observation graph |
| 4 | raster | `decodeImage` per selected variant, run.ts:297–308 | `Raster` |
| 5 | metric evidence | `extractMetricEvidence` run.ts:322 → `readNumbers` extract.ts:312 → `dimensionLabelLattices` extract.ts:363/980 → `solveFrameMetric` | OCR tokens, numeric lattices, chains, scale |
| 6 | reconstruction | `reconstructV2` run.ts:338; `sealCandidate` gives `modelHash = sha256(serializeModel)` (`reconstruction/src/candidate.ts:203–206`) | candidate, canonical model |
| 7 | canonical model | run.ts:365–366, `modelSha256` :452 | the model |
| 8 | compiled scene | `compileBuilding` run.ts:376, `buildMobileSceneBundle` :382 | scene + mobile bundle |
| 9 | verification | `verifyReplay` :391, bundle round trip :396, `geometryClosureAudit` :405 | replay/closure audits |

Progress stages are in `stages.ts:15–25`.

## Packages

### `source-package` — acquisition (4 565 lines)

- **Routing.** `router.ts:57` `routeSourceAcquisition` tries specialists by URL. Otherwise the generic adapter's
  `classify` decides PROJECT_PAGE, NOT_PROJECT or REQUIRES_RENDERING.
- **Documents.**
  - `discovery.ts:115` matches `.pdf` links. The generic adapter (`adapters/generic/assets.ts:73`) also matches
    `.dwg` and `.dxf`, capped at `MAX_DOCUMENT_LINKS = 16`.
  - `acquire.ts:418` records only `RECORDED_DOCUMENT_KINDS` (OUTLINE, DRAWING_SET, ENERGY_CERTIFICATE, COST_ESTIMATE).
  - It fetches at most `DOCUMENT_BUDGET = 4` (:393) of OUTLINE and DRAWING_SET, under a document media allowlist.
  - Fetched documents get a magic-byte check (`documentSignatureMatches` :427) and a SHA-256 (:152).
  - Recorded in `SourceDocumentSchema` (`schema.ts:248–265`: url, format, kind, variant, statedScale, byteHash, status).
  - **Nothing parses a PDF, DWG or DXF.** No PDF or CAD library is in the repository.
  - Aster VIII's and Galaktyka I's 1:500 outline PDFs are fetched, hashed and ignored
    (`stage-reports/artifacts/analyzer-005c/aster-viii/source-package.json`).
- **Images.** `image.ts:143` decodes JPEG (`jpeg-js` 0.4.4), PNG (`pngjs` 7.0.0) and GIF (`omggif` 1.0.10, first
  frame). WebP and BMP are probed for size only, then refused with `UNSUPPORTED_FORMAT`.
- **Security.** There is no host allowlist (`security.ts` header). The policy is https only, no credentials, no IP
  literal, private ranges and DNS re-checked on every hop (`net.ts:116–120, :209, :223, :280`), 24 MiB and 120 assets.

### `source-cv` — deterministic CV (1 810 lines, pure TS, browser-safe, no building knowledge)

| area | functions |
| --- | --- |
| grey and ink | `toGray` (BT.601), `inkChannel` (min RGB), `percentile`, `downscaleGray` |
| thresholds | `threshold`, `inkMask` (8th percentile, Otsu rejected by design `mask.ts:54`), `adaptiveInkMask` (local mean, summed-area table) |
| morphology | separable square `dilate`/`erode` |
| components | iterative 4/8-connected `connectedComponents` with deterministic order |
| lines | run-based `axisAlignedSegments` (`lines.ts:245`); standard ρ/θ `houghSegments` with TLS refit (:351); `parallelFamilies` |
| rectangles and profiles | `rectangleCandidates`, silhouette profiles, RDP `simplifyPolyline`, `dominantSlopes` |
| bands | `runLengthBands` (wall bands) |

### `source-metrics` — numeric OCR and metric evidence (9 745 lines)

- **`ocr.ts` reader.** A numeric-only template matcher with a 12×16 cell, 17-glyph alphabet (`font.ts:68`) and a hole
  topology signal. `readNumbers` (:1017) makes three or four page passes (H, CW, CCW, and INVERTED as a hypothesis)
  and keeps the pass ink fields (`retainPasses`).
- **`numeric-lattice.ts` (1.1.0).**
  - For every dimension-line ink: three ink variants, re-segmentations, glyph-count hypotheses (005F) and a
    beam over glyph candidates.
  - Classes: CLEAR / SUPPORTED / AMBIGUOUS / LOW_QUALITY (`OCR_CLASS_BOUNDS` :88), with a stability bracket (:147).
  - Every bound was calibrated on FIT labels and the synthetic corpora (`artifacts/analyzer-005e|005f/calibration`).
- **`dimension-lines.ts`, `chains.ts`.** Dimension lines, ticks, chain topology and spurious-tick rejection (005D).
- **`metric-solution.ts`.**
  - Non-circular scale: a scale never creates, chooses or promotes a reading.
  - `correctionReadings` (:384) and `latticeAlternatives` (:421) take only same-count values.
- **`registration.ts`.** Coordinate registration of frames.
- **The integration seam for any external recogniser** is `dimensionLabelLattices` (extract.ts:980). For each on-line
  token it has the upright pass field and `token.passBox`, which is exactly the crop an external recogniser needs.
  It is **synchronous**, and so is `extractMetricEvidence` (:278). Every ONNX Runtime JS API is async.

### `source-observations` — observation graph (1 220 lines)

Schema, builder, ids and validation of the observation graph that every extractor writes into.

### `source-vision` — optional vision seam (897 lines)

- **Interface.** `VisionReasoner { provider; available(request?); analyze(request): Promise<VisionObservationResponse> }`
  (`reasoner.ts:16–21`).
- **Request.** `{task, asset{assetId, byteHash, mediaType, bytes}, roles, size, contextFacts?, focus?, maxObservations?}`.
- **Observation.** Normalised geometry (POINT / SEGMENT / POLYLINE / POLYGON / RECT / LINE_FAMILY), confidence,
  position uncertainty, evidence, value and alternatives (`schema.ts:60–127`).
- **Providers.** `null`, `fixture`, and `anthropic` (`providers/anthropic.ts:111`: key from env, lazy SDK import).
- **Local analyzer.** It passes no vision, so the run is `DETERMINISTIC_ONLY` (`apps/local-analyzer/src/wiring.ts:6–8`,
  `local.ts:22,34`). The SDK is tree-shaken out of the phone bundle (`tests/architecture/local-analyzer.test.ts:143–147`).
- **The seam is task-shaped (FACADE / PLAN / SECTION over a whole asset) and async.** A local floor-plan model would
  fit it as a provider. A per-label digit recogniser would not: it needs label crops, not assets.

### `reconstruction` — boundary, bodies, decomposition, openings, resolver (22 949 lines)

- **Envelope** (`boundary-outline.ts`, `-evidence.ts`, `-completion.ts`, `-bodies.ts`). Built on raster masks, 1D
  interval coverage, grid-cell flood fill and greedy rectangle tiling. There are no vector polygon booleans or offsets.
- **Plan decomposition, extent, openings and resolver.** The semantic reasoning that must stay custom: gap
  classification, weak-gap judging, body classes, completions.
- **`v2/`.** A handful of vector helpers: convex hull, simplification, `tracePolygon`, `terracePolygon`.

### `geometry` — compiler (4 288 lines)

- **Vector primitives.** Shoelace, `polygonIsSimple`, `tessellateRegion` (scanline trapezoidation, even-odd),
  `triangulatePolygon` (ear clipping, no holes), Sutherland–Hodgman `clipToRect`/`clipPolygon`, stair `splitStrip`.
- **Domain mesh tilers.** `compileWall`, `tilePlate`, which keep watertight shared vertices.
- **Numerics.** Floating point with absolute epsilons (1e-12 … 1e-6) and `round6`/`round9` snapping.
- **Dependencies.** No third-party geometry library in any `packages/*`. `three` is only in `apps/web`.

### `apps/local-analyzer` — the phone runtime

- **Bundle.** esbuild, ESM, `target node18`, one unminified `analyzer.mjs`. The runtime is nodejs-mobile 18.20.4
  built `--with-intl=none` (`build.mjs:34`); `src/text.ts` supplies normalize/localeCompare.
- **Size.** About 1.5–1.7 MB, about 0.46 MB compressed.
- **Dependencies.** Inlined node_modules are only `jpeg-js`, `pngjs`, `omggif` and `zod`. There are **no native
  addons and no WebAssembly** in first-party code.
- **Shipping.** Into the APK by Gradle `bundleLocalAnalyzer` (`app/build.gradle.kts:237–245`) as `assets/local-analyzer/`.
- **Parity tests.** A Node 18 test runs the bundle (`test/program.test.ts:231–265`, `LOCAL_ANALYZER_NODE18`, with a
  no-ICU case), and CI downloads Node 18.20.4 for it.

### `apps/android`

- **Toolchain.** AGP 8.7.3, Kotlin 2.0.21, compileSdk/targetSdk 35, minSdk 26, NDK 27.3, CMake 3.22.1.
- **ABIs.** arm64-v8a, armeabi-v7a, x86_64, with ABI splits plus a universal APK.
- **Native libraries.**
  - `libnode.so` (nodejs-mobile 18.20.4): arm64 62 475 584 B, x86_64 65 361 944 B, fetched and pinned in
    `third_party/nodejs-mobile/runtime.json`.
  - `libbuildapp_node_bridge.so` (`node::Start`), `libc++_shared.so`, `libfilament-jni.so` (Filament 1.75.1),
    `libandroidx.graphics.path.so`.
  - `jniLibs.useLegacyPackaging = true`, so native libraries are compressed in the APK.
- **Node's argv.** `LocalAnalyzerService.kt:102` gives no `--jitless`, so V8's WebAssembly tiers are available.
  `libnode.so` contains Liftoff and `WebAssembly.instantiate`, verified by `strings` (`deployment-matrix.md`).
- **APK.** Release APK 30 785 427 B at 005F. The arm64 APK with the local analyzer was 29 911 875 B at 03Y2, of which
  libnode accounts for about 17.1 MB compressed.

### `apps/analyzer-api` — optional server

An HTTP + worker-thread wrapper of the same `runAnalysis`, run as a container (Fly.io config). Vision is live only
with `ANALYZER_VISION=live` (`src/wiring.ts:20`), which is not set. It is not the product path.

## What 005G concludes from the architecture alone

1. **A numeric recogniser belongs in `source-metrics`**, at the lattice call site, as an additional candidate source
   for the same label crop. It does not belong in `source-vision`: that seam is per-asset and task-shaped, and its
   observations are geometry, not label readings.
2. **A PDF reader belongs in `source-package` (bytes → document facts) plus a new observation extractor** that turns
   document facts into observations and metric evidence. Acquisition already fetches and hashes the bytes.
3. **A polygon library could only replace `geometry`/`model` primitives.** The reconstruction envelope is
   raster-based by design and has no boolean to replace.
4. **The phone runs exactly the analyzer CI runs** (one esbuild bundle, Node 18 line, no native addons). Any
   recogniser must keep that: the same bytes and model in CI and on the phone. That favours WebAssembly over a JNI
   bridge (`deployment-matrix.md`).
