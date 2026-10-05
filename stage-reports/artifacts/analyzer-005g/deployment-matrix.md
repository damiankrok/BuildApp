# 005G — deployment reality check

A library is adoptable only when **both** questions have a measured answer:
1. Does it run in the current Node environment (CI and desktop)?
2. Can the same logical engine and model run on arm64 Android **inside the BuildApp architecture**: nodejs-mobile
   18.20.4, no ICU, one esbuild bundle, no native addons?

**Measured here (desktop x86-64):**
- Node 22.22.2 (CI's version) and Node 18.20.4 (the phone's Node line, official linux-x64 build, SHA-256 checked);
- the no-ICU shim the repository already uses for phone parity (`apps/local-analyzer/test/support/no-icu.cjs`);
- the actual Android artefacts (AARs from Maven Central and Google Maven) and the phone's own `libnode.so`.

**Measured on arm64, emulated:** the official Node 18.20.4 linux-arm64 build under qemu (bit parity only).

**Not measured:** an Android device run. This session has no emulator or device. That is the integration stage's
first gate.

## Baseline

| item | value | source |
| --- | --- | --- |
| release APK (005F) | 30 785 427 B | `STAGE_…_005F` §, PROJECT_STATUS |
| arm64 debug APK on disk | 30 618 895 B | `apps/android/app/build/outputs/apk/debug/` |
| `libnode.so` arm64 / x86_64 | 62 475 584 / 65 361 944 B (≈ 17.1 MB compressed in the APK) | `third_party/nodejs-mobile/runtime.json`, 03Y2 |
| analyzer bundle | ≈ 1.5–1.7 MB (≈ 0.46 MB compressed) | 03Y2G, `apps/local-analyzer/dist` |
| phone analysis peak RSS | 1 788–2 096 MiB (emulator) | 03Y2, 03Y2G |
| WebAssembly in the phone's Node | **present**: `libnode.so` arm64 contains `WebAssembly.instantiate`, Liftoff, `v8_enable_webassembly`; the app starts Node **without** `--jitless` (`LocalAnalyzerService.kt:102`) | `strings` on the pinned binary |
| native libs packaging | `jniLibs.useLegacyPackaging = true` → `.so` compressed in the APK | `app/build.gradle.kts:376` |

## OCR runtime routes

| route | CI | phone | new `.so` | APK delta (compressed) | model asset | cold load | per label | RAM | parity | telemetry | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A. `onnxruntime-web` 1.30.0 (WASM SIMD, 1 thread) inside the Node analyzer bundle** | yes (Node 22 and Node 18 measured) | the same bundle and the same `.wasm` on nodejs-mobile 18.20.4 (runs under the no-ICU shim; **arm64 V8 bit-identical under qemu**; arm64 *device* not yet run) | **0** | runtime `.wasm` 14 239 897 B → **3.67 MB** + loader 24 KB + glue bundled into `analyzer.mjs` (+78 KB) → **≈ 3.7 MB, once for every ABI** | PP-OCRv6 tiny 4 462 639 B → **4.11 MB** | 522 ms (Node 18) | **44 ms** mean, 61 ms p95 (Node 18, x86-64) | session +160–200 MiB RSS, stays for the process (the WASM instance is a singleton): run OCR in a worker thread that exits | **WASM Node 18 ≡ Node 22 bit-identical on 775/775**; bundled tensor hash `1cc3d1a9…` identical on Node 18, Node 18 no-ICU and Node 22 | **none** (no endpoint strings in any `.wasm`) | **ADOPT_NEXT** |
| B. `onnxruntime-android` 1.30.0 AAR + JNI, results handed to Node | CI would need `onnxruntime-node` (a different binary) | Kotlin side, then marshalled into the Node analyzer per label | `libonnxruntime.so` + `libonnxruntime4j_jni.so` **per ABI** | arm64 32 990 480 B → **12.38 MB**; armeabi-v7a 23.3 MB, x86_64 39.3 MB raw | same | not measured | not measured | not measured | **broken**: two engines; native-vs-WASM probabilities already differ by 3e-5 on one machine, and MLAS kernels differ by CPU | **yes**: AAR adds `INTERNET`, `ACCESS_NETWORK_STATE`, `ai.onnxruntime.TelemetryInitializer`; 1DS endpoint in the `.so`. 1.28.0 has none. | **REJECT** |
| C. `onnxruntime-node` inside nodejs-mobile | yes | **no Android prebuild** (`os: win32, darwin, linux`); would need a cross-built ORT + N-API addon against nodejs-mobile | ≥ 1 per ABI | ≈ the AAR's | same | — | 14.5 ms (desktop native) | 178 MiB | needs separate builds per arch | yes (≥ 1.29 native) | **REJECT** |
| D. Tesseract via `tesseract.js` (WASM) | yes | same WASM (Node 18 measured: 775/775 same text) | 0 | core `.wasm` 2.86 MB → 1.06 MB, glue 3.9 MB → 1.46 MB | `eng` best_int 2.95 MB | 443 ms | 20 ms | 180 MiB | yes | none (offline `langPath`; the default fetches from jsDelivr) | **REJECT** (quality: `ocr-bakeoff.md`) |
| E. Google ML Kit text recognition 16.0.1 (bundled) | **no** (Android only) | Kotlin | `libmlkit_google_ocr_pipeline.so` per ABI | arm64 11 064 544 B → **4.41 MB** + model assets 1.05 MB + Play-services deps | bundled | — | — | — | **broken** (no CI engine) | usage metrics to Google | **REJECT** (comparison only, not run) |

## Other components

| component | route | size | Node 18 / no-ICU | verdict |
| --- | --- | --- | --- | --- |
| PDF.js `pdfjs-dist` 4.8.69 (legacy) | bundled into `analyzer.mjs`, worker in-thread | 3 081 099 B → **0.65 MB** | **yes / yes**: identical text and operators | PILOT (integration stage after OCR) |
| PDFBox / PdfBox-Android | JVM; Android port stale | pdfbox-app 13.6 MB | n/a (not Node) | RESEARCH_ONLY / REJECT |
| OpenCV Android 4.14.0 | JNI | `libopencv_java4.so` arm64 24 657 160 B → **9.77 MB** per ABI | n/a | REJECT |
| opencv.js 5.0.0 | WASM in Node | 13.3 MB → 3.76 MB | — | DEFER |
| `polyclip-ts` 0.16.8 | pure TS | 40 KB → 9 KB | identical results Node 18 = Node 22 | DEFER |
| JSTS 2.12.1 | pure JS | 7 MB package (test-only use) | identical results | RESEARCH_ONLY |

## Parity design for the recommended route (A)

```
CI (Node 22, and Node 18 in the LOCAL_ANALYZER_NODE18 job)        phone (nodejs-mobile 18.20.4, arm64, no ICU)
  analyzer.mjs  ── same bytes (manifest.json sha256) ──────────────  assets/local-analyzer/analyzer.mjs
  ort-wasm-simd-threaded.wasm  ── same bytes, pinned sha256 ───────  assets/local-analyzer/ort-wasm-simd-threaded.wasm
  PP-OCRv6_tiny_rec.onnx       ── same bytes, pinned sha256 ───────  assets/local-analyzer/models/PP-OCRv6_tiny_rec.onnx
  preprocessing: ONE TypeScript implementation in source-metrics (no cv2, no Kotlin resize)
```

**Determinism argument.**
- WASM SIMD128 arithmetic is IEEE-754 and has no fused multiply-add.
- **The `.wasm` contains no relaxed-SIMD instruction.** Proof: it compiles and runs on Node 18.20.4, whose V8
  10.2.154 has relaxed SIMD off by default (`--noexperimental-wasm-relaxed-simd`), and that V8 would reject such an
  instruction at compile time.
- So the same `.wasm` should give bit-identical tensors on x86-64 and arm64 V8.
- **Measured on arm64.** The official Node 18.20.4 linux-arm64 build (V8 10.2.154, nodejs-mobile's line) under
  qemu-aarch64 8.2.2, with an Ubuntu noble arm64 glibc sysroot whose packages were hash-checked against the archive
  index:
  - the bundled ORT-web run's raw output tensor hashes to `1cc3d1a9a2725624`, as on x86-64;
  - 39 real labels (34 blind + TARGET, 5 Marcówki) give identical text, confidences and top-K posteriors.

  Emulated timings (≈ 240 s WASM compile, 7–19 s per label) are not phone timings.

**The gate the integration stage must pass.** Run the 775-label corpus, or its 103 real labels, through the APK's own
bundle on the CI x86_64 emulator and on the OWNER's arm64 phone. The per-label output hashes must equal the desktop
ones. **If they do not, the model hash must not depend on raw probabilities.** Then only the decoded top-K strings
and rounded posteriors may enter the evidence record, which is how the bake-off already records them.

## Supply chain for route A

| item | pin |
| --- | --- |
| npm | `onnxruntime-web@1.30.0` (MIT). Dependencies: `onnxruntime-common@1.30.0`, `flatbuffers`, `guid-typescript`, `long`, `platform`, `protobufjs`; esbuild inlines what is used (78 KB bundle). **No install-time script**: only `prepare`/`preprepare`, which npm does not run for registry installs. |
| model | `PaddlePaddle/PP-OCRv6_tiny_rec_onnx` commit `2612ab37152ae0a677521bae4e1e3d4fb4cf7c30`, `inference.onnx` SHA-256 `9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6`, Apache-2.0. Character dictionary from the same commit's `inference.yml`. |
| runtime binary | `ort-wasm-simd-threaded.wasm` from the npm tarball, hashed into `manifest.json`. |
| network | none at run time. The model and `.wasm` are build-time assets, never downloaded on the device. |
| advisories | OSV/NVD: none for ONNX Runtime 1.30.0 or PaddleOCR. The PaddlePaddle framework's CVEs do not apply: the framework is not shipped. |
| notices | MIT text + ORT ThirdPartyNotices + Apache-2.0 model notice into `apps/android/app/src/main/assets/licenses/`. The npm tarball has no LICENSE file: take it from the release. |

## Android native checks for any future `.so`

Route A adds none. For the record, the ORT 1.30.0 arm64 `.so` has every `LOAD` segment aligned at 0x4000 (16 KB)
and a `GNU_RELRO` segment.

**Observation outside 005G's scope.** The existing nodejs-mobile `libnode.so` arm64 has `LOAD` alignment 0x1000
(4 KB). That matters for 16 KB-page Android devices and belongs to the runtime owner. 005G changes nothing about it.
