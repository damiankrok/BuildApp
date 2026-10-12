# 005O — licensing and runtime matrix

Code licence, model weights, training data, runtime dependencies and Android packaging are separated per candidate. Nothing
in this table was added to any `package.json`, the analyzer bundle or the APK (production freeze: `production-freeze-*.json`).

| candidate | executed in 005O? | pinned version / hash | code | weights | data | runtime deps | Node 18 | Android arm64 viability | 005O disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PP-OCRv6 tiny rec (shipped since 005H) | **yes** — M1b crop re-read of 260 statements without a lattice; 40 + 40 validation re-reads; glyph corpus 420 crops | model `9ef676d6…63e6` (HF `PaddlePaddle/PP-OCRv6_tiny_rec_onnx` @ `2612ab37`), dict `9a8199f8…`, onnxruntime-web 1.30.0 WASM `3398c10d…dee2` | Apache-2.0 (PaddleOCR) | Apache-2.0 | (Paddle's own) | onnxruntime-web (MIT), already bundled | **measured**: bundled with esbuild, Node 18.20.4: 40/40 validation re-reads bit-identical to the sealed external readings; 19/19 re-reads identical to Node 22; cold 1.26 s, warm p50 127 ms / p95 152 ms per crop (x86 container) | already in APK 1212 (arm64-v8a, worker per batch). **005H physical ARM64 parity stays PENDING**; no phone figure measured here | TESTED; not an adoption |
| custom numeric lattice + classic token reader (incumbent) | yes (read only, frozen) | `metrics.numeric-lattice@1.1.0` / ensemble `1.2.0`, `metrics.numeric-ocr@1.4.0` | repository | template bitmaps (repository) | — | none | as production | shipped | incumbent |
| JSTS / JTS | no | (005G: JSTS 2.12.1) | EDL-1.0 / EPL | — | — | none | 005G: identical on 18/22 | pure JS | INSPECTED / NOT_RUN (no kernel bottleneck) |
| Clipper2 (`clipper2-js` 1.2.4 / `clipper2-ts`) | no | (005G) | BSL-1.0 | — | — | clipper2-js peer-depends on Angular 15 | 005G: identical | pure JS | DEFER |
| polygon-clipping 0.15.7 / polyclip-ts 0.16.8 | no | (005G) | MIT | — | — | none | 005G: identical | pure JS | REJECT / DEFER (005G) |
| OpenCV.js / LSD / ELSED | no | (005G / 005I) | Apache-2.0 | — | — | +3.8 MB WASM (opencv.js); Android OpenCV +24.7 MB/ABI | 005G: expected | size cost | not reopened |
| PDF.js `pdfjs-dist` 4.8.69 / PDFium | no | (005G) | Apache-2.0 / BSD-3 | — | — | 3.08 MB bundle | 005G: measured on Node 18 | bundle size | OUT_OF_SCOPE (0 PDF sources in 44 cases) |
| R2V / CubiCasa5K / Raster2Seq | no | — | MIT / CC BY-NC (CubiCasa) / MIT | unstated / research-only | LIFULL research-only, CC BY-NC(-SA), Structured3D terms | PyTorch | n/a | would need a model in the APK | INSPECTED (licence) |
| 005O research tooling (Pillow 12.3, Python 3, esbuild from the lockfile) | yes, outside production | Python stdlib + Pillow; esbuild already in `node_modules` | HPND (Pillow) | — | — | research only | n/a | never packaged | research only |
| fonts for the synthetic glyph corpus | yes (renders outside the repo) | DejaVu Sans / Mono, Liberation Sans (+Italic), FreeSans Oblique, Courier 10 Pitch, Bitstream Charter (system packages) | DejaVu/Bitstream Vera licence, SIL OFL 1.1, GPLv3 + font exception, Bitstream X11 donation | — | — | — | — | never packaged | research only |

No third-party pixel, weight or dataset was committed. Transcription truth was produced by two independent model-based
transcribers reading crops offline (disclosed in the stage report as a limitation); no cloud or VLM adjudicator is part of
any challenger.
