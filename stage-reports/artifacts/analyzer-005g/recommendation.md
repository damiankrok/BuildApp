# 005G — recommendation

## The single highest-value integration stage

**BUILDPLAN-ANALYZER-005H — External numeric recogniser ensemble: PP-OCRv6 tiny (official ONNX, Apache-2.0) on
ONNX Runtime Web (WASM), as a second, independent candidate source inside the numeric lattice, with a stability
bracket.**

The exact files, tests, gates, pins and asset paths are in `integration-map.md`.

**Why this one, measured on the same 775 crops (`ocr-bakeoff.md`):**
- **It attacks the defect that ended the last three blind rounds.** The reader misread the overall or chain labels
  (`1580/1173` at 005D, `2590/1950` at 005E, `648` at 005F) while the scale and plan were otherwise reachable. Every
  one of those labels, and `1950 → 1410` and `648 → 608` (both SUPPORTED misreads), is read right by PP-OCRv6 tiny at
  p ≥ 0.997.
- **Real labels.** BuildPlan: 49/103 exact, **10 confident-wrong**. PP-OCRv6 tiny: **103/103**, **0** confident-wrong.
  P2 ensemble: 88 confident, 0 wrong.
- **All 775.** BuildPlan: 309 confident, **75 wrong**. P2: 631 confident, **2 wrong**.
- **Matched coverage.** Every Paddle model's 309 most confident readings contain **0** errors.
- **It is deployable without breaking the one-analyzer rule.**
  - **Bundle:** the same WASM and model bytes in CI and inside nodejs-mobile 18.20.4.
  - **Footprint:** 0 new `.so`, about +7.8 MB once for every ABI.
  - **Parity and network:** bit-identical Node 18 vs Node 22; no telemetry; no network at run time.

**What it does not do.** It does not fix the envelope failures (005B/005C/005F `dom-w-helikoniach` ground outline).
Those are semantic and stay in reconstruction. It does not make any reading canonical: the metric resolver still
decides, and a disagreement stays AMBIGUOUS with both values.

## Answers to the brief's decision questions

| # | question | answer |
| --- | --- | --- |
| 1 | Keep improving the custom numeric classifier alone? | **No.** Stop tuning the template classifier. Keep the lattice around it: orientation hypotheses, segmentation and glyph-count hypotheses, stability bracket, non-circular metric. It becomes the second witness. |
| 2 | Adopt an external OCR recogniser? | **Yes.** |
| 3 | Which, and as replacement, ensemble or fallback? | **PP-OCRv6_tiny_rec** (`9ef676d6…`, 4.46 MB) as an **ensemble** member (P2: external confident and stable corroborates; a CLEAR/SUPPORTED lattice disagreement → AMBIGUOUS with both). **Not replacement**: it loses the independent witness. **Not fallback**: OCR-3 had 64 confident errors on 775, because the lattice's own confident misreads never trigger it. en_PP-OCRv5_mobile is the PILOT alternative or second model. |
| 4 | Can it run in CI and on Android? | **Yes, as the same bytes.** `onnxruntime-web` WASM inside the existing Node-18 analyzer bundle. Measured on Node 22, Node 18 and Node 18 without ICU. The phone's `libnode.so` has WebAssembly and is started without `--jitless`. **Not yet run on an arm64 device**: that is 005H's first gate. |
| 5 | Add ONNX Runtime? | **Yes: `onnxruntime-web` 1.30.0 (WASM) only.** **Not** `onnxruntime-android`: a second engine, +12.4 MB per ABI, and the 1.29+ AAR adds INTERNET plus a telemetry provider. **Not** `onnxruntime-node` in production: no Android build, telemetry code, an install-time CUDA download. |
| 6 | Integrate PDF.js next for vector/text PDF evidence? | **Yes, as the stage after 005H (PILOT).** On Aster VIII's outline PDF it reads "1:500" and the scale bar exactly (agreement 3e-5) and the walls as an exact polygon, on Node 18 and without ICU. Text-less PDFs such as Galaktyka need the recogniser for their outlined glyphs (proven: "0 5 10 … 30 [m]", "1:500"), so PDF.js comes second. Pin 4.8.69 (the last Node-18 line); upgrading nodejs-mobile is the lasting fix. |
| 7 | Does OpenCV solve enough current defects to justify its footprint? | **No.** Components and morphology are bit-identical to `source-cv`. LSD is absent from the WASM build. The Android SDK is +9.8 MB per ABI on a JNI path the analyzer cannot call. No blind failure is in a CV primitive. **DEFER** opencv.js, **REJECT** OpenCV Android. |
| 8 | Should any floor-plan ML model enter production now? | **No.** None has commercially clean code, weights and data together (`floorplan-ml-audit.md`). Several also read point-cloud density maps, not raster plans. |
| 9 | Which models are legally unsuitable because of weights or data? | Models trained on CubiCasa5K (CC BY-NC / BY-NC-SA), LIFULL HOME'S / R2V (research-only), Structured3D, or SceneCAD/ScanNet (non-commercial): RoomFormer, PolyRoom, DeepFloorplan / TF2DeepFloorplan, Raster-to-Vector, Raster-to-Graph, Raster2Seq checkpoints, CubiCasa-based HF models. Also: RMBG-1.4 derivatives (non-commercial base), the `OsamaMo/2dplan2strct` RF-DETR checkpoint (non-commercial), Ultralytics YOLO models (AGPL-3.0). PaddleOCR's training data is undisclosed, a named residual risk; its weights are Apache-2.0. |
| 10 | Should polygon-clipping / Clipper / JTS replace any low-level geometry operation? | **Not now.** The envelope is raster by design, and none of the vector primitives appears in a first bad decision. polygon-clipping: **REJECT** (reproduced crash). polyclip-ts and Clipper2: **DEFER**. JSTS: **RESEARCH_ONLY**, as the oracle for a small future hardening of `polygonIsSimple` (touching rings) and `tracePolygon` (pinch vertices). |
| 11 | Which custom subsystems stay custom? | <ul><li>the numeric lattice (as a witness)</li><li>chains, dimension lines and the non-circular metric solution</li><li>`source-cv`</li><li>the reconstruction envelope, bodies, decomposition, openings and resolver</li><li>the geometry compiler's watertight tilers</li><li>source acquisition and security</li></ul> |
| 12 | The single highest-value integration stage after this audit? | **005H, above.** |

## Verdicts (full list with all 26 criteria in `technology-matrix.json`)

| verdict | technologies |
| --- | --- |
| **ADOPT_NEXT** | PaddleOCR PP-OCRv6_tiny_rec (official ONNX); ONNX Runtime Web 1.30.0 (WASM) |
| **PILOT** | PaddleOCR en_PP-OCRv5_mobile_rec (alternative model); PDF.js `pdfjs-dist` 4.8.69 (stage after 005H) |
| **DEFER** | latin / multilingual PP-OCRv5 mobile; PP-OCRv6 small; PDFium; DWG/DXF readers; opencv.js; polyclip-ts; Clipper2; manifold-3d; fpvec-lab |
| **RESEARCH_ONLY** | PP-OCRv6 medium (quality oracle); onnxruntime-node (benchmark runtime); RapidOCR (reference implementation); Apache PDFBox (PDF oracle); JTS/JSTS (geometry oracle); CubiCasa5K; Raster2Seq; MLStructFP |
| **REJECT** | ONNX Runtime Android; Tesseract; Google ML Kit; PdfBox-Android; OpenCV Android; polygon-clipping; CGAL; Open CASCADE; RoomFormer; PolyRoom/FRI-Net/SLIBO-Net; DeepFloorplan family; Raster-to-Vector; Raster-to-Graph; Ultralytics YOLO floor-plan models; RMBG-1.4 wall segmentation; RF-DETR `2dplan2strct` |

## Risks the next stage inherits

1. **No arm64 device run yet.** The determinism argument says the tensors match (no relaxed SIMD, IEEE-754), but
   it is measured on x86-64 only. If arm64 hashes differ, only decoded strings and rounded posteriors may enter the
   evidence record.
2. **PaddleOCR training data is undisclosed.** The weights are Apache-2.0. Record the residual risk; counsel review
   is optional.
3. **Memory.** The WASM instance adds +160–200 MiB RSS for the process. Run OCR in a worker thread that exits.
4. **Async seam.** `extractMetricEvidence` is synchronous today, and ONNX Runtime JS is async.
5. **The bake-off is not a blind protocol.**
   - The 22 blind-house labels come from houses whose failures motivated 005E/005F.
   - The real set is small (103), and synthetic labels use two stroke faces.
   - 005H must freeze and run a fresh blind round.
