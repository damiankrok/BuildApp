# 005G — deterministic CV probe: `@buildapp/source-cv` against OpenCV

**What was compared.** OpenCV 5.0.0 through `@techstark/opencv-js` (the WebAssembly build of the same C++ that the
OpenCV Android AAR ships) against production `source-cv`.

**On what.** The ground plans of all 14 synthetic houses (`@buildapp/synthetic-drawings`: Larchfield, Holloway,
Redmire and the 11 v2 fixtures), as `inkMask` binaries. These have invented geometry and contain no publisher pixel.

**Where the results are.** Script `research/analyzer-005g/cv-probe.ts`; per-house numbers in `cv-probe.json`.

## Results

| operation | agreement | wall time (median per sheet, Node 22) |
| --- | --- | --- |
| connected components (8-conn) | **identical on 14/14**: same count, same pixel counts, same boxes (OpenCV reports width/height, so its far bound is exclusive where source-cv's is inclusive — a convention, not a difference) | source-cv 3.0 ms · OpenCV 2.3 ms |
| erode / dilate (5×5 square) | **0 differing pixels on 14/14**, inside and on the border | erode 6.2 vs 1.4 ms · dilate 17.0 vs 1.4 ms |
| line extraction | source-cv emits 16–29 run-based axis segments plus Hough segments up to its cap of 400. OpenCV `HoughLinesP(1 px, 1°, 60, minLen 40, gap 3)` emits 72–112. HoughP covers **26–34 %** of source-cv's long segments; source-cv covers **67–81 %** of HoughP's. | source-cv axis 5.3 ms, source-cv Hough 260 ms · OpenCV HoughP 21.5 ms |
| LSD (line segment detector) | **not available**: the opencv.js 5.0 build exposes only the `LSD_REFINE_*` constants, not `createLineSegmentDetector` | — |

**How to read the line row.** It is not a quality score. There is no ground-truth segment set, and the two
extractors are tuned for different things. source-cv's run-based axis segments feed `runLengthBands` and the
reconstruction directly. HoughP is a generic voting detector. Swapping one for the other would re-tune every downstream
gate. OpenCV's real advantage is speed: its Hough is about 12× faster. But source-cv's Hough is a fallback for
"staircase" lines (`lines.ts:170`), and Hough is not where analysis time goes on the phone.

## What OpenCV would cost

| route | size | parity |
| --- | --- | --- |
| OpenCV Android (`org.opencv:opencv` 4.14.0) | arm64 `libopencv_java4.so` 24.7 MB (9.8 MB deflated) per ABI; AAR 123 MB for all ABIs | a JNI path the Node analyzer cannot call: a second CV implementation beside CI's |
| opencv.js (5.0.0) inside the Node bundle | `opencv.js` 13.3 MB (3.8 MB deflated), ABI-independent | the same WASM in CI and on the phone: parity is possible |

## Verdict: **DEFER — source-cv is already sufficient**

- The two primitives that can be compared exactly (components, morphology) are **bit-identical**.
- No blind failure from 005A to 005F was located in a CV primitive. The first bad decisions were in numeric OCR
  (005D, 005E, 005F `648 → 608`) and in envelope semantics (005B, 005C, 005F).
- OpenCV's distinctive tools are missing from the WASM build (LSD, contrib's FastLineDetector) or are generic (HoughP).
  Its native route would bring the second implementation that the architecture forbids.
- Reopen OpenCV only if a future failure is traced to a primitive OpenCV does better. The first candidate would be
  perspective/deskew for photographed sheets, which `image-metrology` covers today with its own homography.
