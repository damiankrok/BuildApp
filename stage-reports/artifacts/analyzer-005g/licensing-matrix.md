# 005G — licensing matrix

Code, model weights and training data are separate legal questions (brief §3). Each was checked on 2026-10-05 at the
URL listed in `sources.md`.

**What "verified here" means.** The fact was re-checked in this session against the artefact itself: an npm/PyPI
tarball's licence field and licence file, the Hugging Face API `cardData.license`, an AAR's manifest, or a binary's
strings.

**What "UNVERIFIED" means.** No primary source states the fact. The question stays open.

## OCR / recognition

| technology (version) | code | weights | training data | commercial | notes |
| --- | --- | --- | --- | --- | --- |
| BuildPlan numeric reader (`source-metrics`, lattice 1.1.0) | own | own templates (`font.ts`) | none (hand-drawn bitmaps; calibrated on own transcriptions + synthetic corpora) | yes | — |
| **PaddleOCR text-recognition models**: `en_PP-OCRv5_mobile_rec`, `latin_PP-OCRv5_mobile_rec`, `PP-OCRv5_mobile_rec`, `PP-OCRv6_tiny/small/medium_rec` (official `*_onnx` repos on HF) | Apache-2.0 (PaddleOCR) | **Apache-2.0**: HF `cardData.license = apache-2.0` for all six ONNX repos (verified here) | **Not disclosed per dataset.** PaddleOCR 3.0 report: VLM-auto-labelled data, parsed PDFs/e-books, synthesis. PP-OCRv5: 22.6 M samples. PP-OCRv6 report: in-house benchmarks. Whether any non-commercial dataset was used is **UNVERIFIED**. | **yes, by licence**; residual data-provenance risk named | the `latin_PP-OCRv5_mobile_rec` model card is copy-pasted (titled server, says Korean): use the ONNX repo + SHA-256, not the card, as the record |
| RapidOCR 3.9.2 (`rapidocr`) | Apache-2.0 | redistributes PaddleOCR models, "same license terms" (Apache-2.0) | as PaddleOCR | yes | **downloads models from ModelScope at run time by default**: benchmark reference only, never shipped |
| ONNX Runtime 1.30.0: `onnxruntime-node`, `onnxruntime-web`, `onnxruntime-android` | MIT | — | — | yes | **Native builds ≥ 1.29 carry Microsoft 1DS telemetry.** Verified here: endpoint strings in `libonnxruntime.so` (node linux-x64, Android arm64); the Android AAR adds `INTERNET`, `ACCESS_NETWORK_STATE` and a `TelemetryInitializer` provider. **The WebAssembly build has none** (strings absent). 1.28.0 AAR: no permission, no provider, no strings. npm tarballs ship **no LICENSE / ThirdPartyNotices file**: take them from the release. |
| Tesseract 5 (tesseract.js-core 6.1.2 / tesseract.js 7.0.0) | Apache-2.0 | `tessdata_best` / `tessdata_fast`: Apache-2.0 | Google-trained; corpus not published (**UNVERIFIED**) | yes | tesseract.js fetches traineddata from jsDelivr by default (offline needs a local `langPath`); CVEs need a crafted `.traineddata` |
| Google ML Kit Text Recognition v2 (16.0.1, bundled) | **proprietary** (ML Kit Terms + Google APIs ToS) | proprietary | proprietary | allowed under Google's terms, **not open source** | sends usage metrics to Google; Android only; comparison-only by brief — **not run** (no emulator/device in this session) |

## PDF

| technology | code | notes | commercial |
| --- | --- | --- | --- |
| Mozilla PDF.js / `pdfjs-dist` 4.8.69 (tested), 6.4.299 (latest) | Apache-2.0 | 4.8.69 is the last line declaring Node ≥ 18. CVE-2024-4367 fixed in ≥ 4.2.67 (and `isEvalSupported:false`). CVE-2026-16633 affects 5.6.83 – < 6.2.108, not 4.8.69. Optional deps `canvas` (native, install-time binary download) and `path2d` are not needed for text/operators: install with `--omit=optional`. | yes |
| Apache PDFBox 3.0.8 | Apache-2.0 | desktop JVM (AWT); Android only through PdfBox-Android 2.0.27.0 (Apache-2.0, last release 2023-01, effectively unmaintained) | yes |
| PDFium (chromium/8076 binaries) | BSD-3-Clause + Apache-2.0 | continuous CVE flow (track Chromium milestone); `@hyzyla/pdfium` (MIT, WASM) ships an incorrect licence file and no PDFium notice | yes |

## CV

| technology | code | notes |
| --- | --- | --- |
| OpenCV 4.14.0 / 5.0.0 (Android AAR), `@techstark/opencv-js` 5.0.0-release.1 | Apache-2.0 (≥ 4.5.0) | CVE-2025-53644 (JPEG decode, 4.10–4.11) |
| BuildPlan `source-cv` | own | — |

## 2D / 3D geometry

| technology | code | notes |
| --- | --- | --- |
| `polygon-clipping` 0.15.7 | MIT | stale since 2024-04; open robustness issues (infinite loop, "Unable to complete output ring") — reproduced here (`geometry-library-audit.md`) |
| `polyclip-ts` 0.16.8 | MIT | maintained fork used by Turf 7; issue #27: its LICENSE omits the upstream polygon-clipping/martinez notices — add them in our notices |
| Clipper2 (C++ 2.0.1), `clipper2-js` 1.2.4, `clipper2-ts` 2.0.1-18 | BSL-1.0 | `clipper2-js` stale (2024-01), ships no LICENSE file, and **peer-depends on `@angular/core`/`@angular/common` ^15** (npm audit: high advisories, no fix through it); `clipper2-ts` has no dependencies; integer core |
| JTS 1.20.0 / JSTS 2.12.1 | JTS: EPL-2.0 or EDL-1.0; **JSTS: EDL-1.0 or EPL-1.0** | choose EDL (BSD-style); JSTS tarball ships no LICENSE file |
| manifold-3d 3.5.4 | Apache-2.0 | — |
| CGAL 6.2.1 | GPL-3.0+/LGPL-3.0+ or commercial | **REJECT** without a purchased licence |
| Open CASCADE 8.0.1 | LGPL-2.1 + OCCT exception | heavy; not needed |

## Floor-plan ML

See `floorplan-ml-audit.md`.

**Legally unsuitable today because of weights or data:** CubiCasa5K-trained models (CC BY-NC / BY-NC-SA),
LIFULL/R2V-trained models (research-only data), Structured3D / SceneCAD / ScanNet-trained models, RMBG-1.4-based
models, AGPL Ultralytics YOLO models and the non-commercial RF-DETR checkpoint `OsamaMo/2dplan2strct`.

## Rules for any adopted dependency (carried into the integration stage)

1. **Pin the exact npm version** in a lockfile. Pin every model by **SHA-256** and refuse a mismatch at load: the
   bake-off harness already does this (`MODELS_PINNED` in `research/analyzer-005g/run-external.mjs`).
2. **Ship the licence texts.** Put MIT (ONNX Runtime) plus its ThirdPartyNotices, and Apache-2.0 (PaddleOCR models),
   in `apps/android/app/src/main/assets/licenses/` beside the font licence that is already there, and in the web
   about page.
3. **No run-time download of anything.** Models and the WASM binary are build-time assets, hashed in the local
   analyzer `manifest.json`.
4. **Never put native ONNX Runtime ≥ 1.29 in the APK without a `--no_telemetry` build.** The WASM build has no
   telemetry and is the recommended runtime anyway.
