# 005O — licensing and runtime matrix

Code licence, model weights, training data, runtime dependencies and Android packaging are separated per candidate. Nothing
in this table was added to any `package.json`, the analyzer bundle or the APK (production freeze: `production-freeze-*.json`).

| candidate | executed in 005O? | pinned version / hash | code | weights | data | runtime deps | Node 18 | Android arm64 viability | 005O disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PP-OCRv6 tiny rec (shipped since 005H) | **yes** — M1b crop re-read of 260 statements without a lattice; 40 + 40 validation re-reads; glyph corpus 420 crops | model `9ef676d6…63e6` (HF `PaddlePaddle/PP-OCRv6_tiny_rec_onnx` @ `2612ab37`), dict `9a8199f8…`, onnxruntime-web 1.30.0 WASM `3398c10d…dee2` | Apache-2.0 (PaddleOCR) | Apache-2.0 | **UNDISCLOSED** (the shipped manifest: PaddleOCR does not publish its recognition training sets; whether non-commercial data was used is unknown) | onnxruntime-web (MIT), already bundled | **measured**: bundled with esbuild, Node 18.20.4: 40/40 validation re-reads bit-identical to the sealed external readings; 19/19 re-reads identical to Node 22; cold 1.26 s, warm p50 127 ms / p95 152 ms per crop (x86 container) | already in APK 1212 (arm64-v8a, worker per batch). **005H physical ARM64 parity stays PENDING**; no phone figure measured here | TESTED; not an adoption |
| custom numeric lattice + classic token reader (incumbent) | yes (read only, frozen) | `metrics.numeric-lattice@1.1.0` / ensemble `1.2.0`, `metrics.numeric-ocr@1.4.0` | repository | template bitmaps (repository) | — | none | as production | shipped | incumbent |
| JSTS / JTS | no | (005G: JSTS 2.12.1) | EDL-1.0 / EPL | — | — | none | 005G: identical on 18/22 | pure JS | INSPECTED / NOT_RUN (no kernel bottleneck) |
| Clipper2 (`clipper2-js` 1.2.4 / `clipper2-ts`) | no | (005G) | BSL-1.0 | — | — | clipper2-js peer-depends on Angular 15 | 005G: identical | pure JS | DEFER |
| polygon-clipping 0.15.7 / polyclip-ts 0.16.8 | no | (005G) | MIT | — | — | none | 005G: identical | pure JS | REJECT / DEFER (005G) |
| OpenCV.js / ELSED / LSD | no | (005G / 005I) | OpenCV.js and ELSED Apache-2.0; the reference LSD sources (`lsd.c`/`pytlsd`) **AGPL-3.0-or-later** (005I licensing matrix); opencv.js 5.0.0 ships no LSD | — | — | +3.8 MB WASM (opencv.js); Android OpenCV +24.7 MB/ABI | 005G: expected | size cost | not reopened |
| PDF.js `pdfjs-dist` 4.8.69 / PDFium | no | (005G) | Apache-2.0 / BSD-3 | — | — | 3.08 MB bundle | 005G: measured on Node 18 | bundle size | **not on the failing path; DEFER (005G PILOT stands)**: 7/44 sealed packages (the DobreDomy rows via the generic adapter, incl. Aster VIII and Galaktyka) record 14 fetched PDF and 7 DWG building-outline documents (1:500, not dimensioned floor plans); the ARCHON adapter records no documents, so none of the three failing houses has one recorded — whether their pages offer PDFs is not measured |
| R2V / CubiCasa5K / Raster2Seq | no | — | MIT / CC BY-NC (CubiCasa) / MIT | unstated / research-only | LIFULL research-only, CC BY-NC(-SA), Structured3D terms | PyTorch | n/a | would need a model in the APK | INSPECTED (licence) |
| 005O research tooling (Pillow 12.3, Python 3, esbuild from the lockfile) | yes, outside production | Python stdlib + Pillow; esbuild already in `node_modules` | HPND (Pillow) | — | — | research only | n/a | never packaged | research only |
| fonts for the synthetic glyph corpus | yes (renders outside the repo) | DejaVu Sans / Mono, Liberation Sans (+Italic), FreeSans Oblique, Courier 10 Pitch, Bitstream Charter (system packages) | DejaVu/Bitstream Vera licence, SIL OFL 1.1, GPLv3 + font exception, Bitstream X11 donation | — | — | — | — | never packaged | research only |

| offline truth transcription (data flow) | yes, offline scorer only | prompt SHA-256 `1321359e…347a` (`research/analyzer-005o/transcription-protocol.md`) | — | the session's own cloud-hosted vision-capable assistant model (no identifier committed) | publisher plan crops (enlarged, on 26 sheets) were sent to the model provider's API as images, as every image the session reads is; nothing published or committed | — | n/a | never in the analyzer | research only; flagged to the coordinator (stage report §N) |

No third-party pixel, weight or dataset was committed. Transcription truth was produced by two independent model-based
transcribers reading crops offline (disclosed in the stage report as a limitation); no cloud or VLM adjudicator is part of
any challenger.
