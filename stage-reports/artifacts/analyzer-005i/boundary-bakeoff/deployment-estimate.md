# 005I Track B — deployment estimate (boundary providers)

Constraints carried from 005G/005H (`stage-reports/artifacts/analyzer-005g/deployment-matrix.md`,
`STAGE_BUILDPLAN_ANALYZER_005H_EXTERNAL_NUMERIC_RECOGNISER.md`): the phone runs the analyzer on **nodejs-mobile
18.20.4**, one esbuild bundle, **no native addons**; WebAssembly is available and is the 005H route (onnxruntime-web
1.30.0, WASM SIMD, one thread, in a worker per plan); **ONNX Runtime Android and OpenCV Android were rejected in
005G**; release APK 30 785 427 B (005F); analysis peak RSS 1 788–2 096 MiB on the emulator (03Y2); the 005H
recogniser worker adds ≤ 108 MB at load. No runtime network.

Measured here (x86-64, 4 vCPU shared with a concurrent development matrix, load average 7.5–8.5 — every time below
is an upper bound for this box and **not** a phone timing; no arm64 run was made):

| item | ELSED | DeepLSD (detect) | DeepLSD (refine) | MobileSAM |
| --- | --- | --- | --- | --- |
| model / checkpoint | none | `deeplsd_md.tar` 102.9 MB (network 8.56 M fp32 params) | same | `mobile_sam.pt` 40.7 MB (10.13 M fp32 params) |
| ONNX export (this study) | n/a (classical C++) | **works** for the network: `deeplsd_md_fields.onnx` 34 310 477 B (gzip −9: 31 815 323 B); max \|Δ\| vs PyTorch 4.1e-4 on a real frame. The line extraction from the fields (pytlsd LSD, **AGPL**) is C code outside the graph | the refiner is Ceres + Progressive-X C++ — no ONNX/WASM path | **works**: encoder 27 969 714 B (gzip 21 440 068 B), max \|Δ\| 1.9e-6; prompt-encoder + decoder 16 501 736 B (gzip 15 170 340 B) |
| Node 18.20.4 + onnxruntime-web WASM, 1 thread (853×853 frame) | n/a | **59.6 s**, peak RSS **1 207 MiB** (fields only) | n/a | encoder **7.7 s**, peak **637 MiB**; decoder 0.9 s, 404 MiB |
| desktop native CPU (PyTorch / C++, 2 threads; 30 frames) | detection **12 ms** median (max 20 ms), process peak 63 MB | 13.5 s median (max 21.7 s), peak RSS 2.0 GB median | 20.4 s median (max 29.8 s), 2.0 GB | encoder 2.7 s median (max 4.5 s); 13 prompted decodes < 1 s total; AUTO (16×16 points) 52.5 s median; peak 2.44 GB median (with AUTO) |
| compressed APK increase (estimate) | algorithm ≈ 30 KB as C++ (88 KB static lib) — but it needs OpenCV (`libopencv_java4.so` arm64 → 9.77 MB per ABI, **rejected in 005G**), or opencv.js (3.76 MB, DEFER in 005G), or a port | ≥ 31.8 MB model (+ an LSD replacement) | not deployable | ≈ **36.6 MB** (encoder + decoder, fp32) — more than the whole current APK (30.8 MB); int8 quantisation not attempted |
| working memory on the phone | small (one gray image, gradient maps) | > 1.2 GB on top of a 1.8–2.1 GB analysis → **not feasible** | n/a | ≈ 0.6 GB per worker on top of the analysis → **high risk** |
| CPU feasibility on the phone | yes (ms) | no (minutes per plan at phone speed, estimated) | no | marginal (tens of seconds per plan, estimated) |
| WASM / ONNX feasibility in the Node 18 bundle | port to TypeScript, or an emscripten build with Gaussian / Sobel inlined (not attempted) | network yes (measured), LSD step needs a non-AGPL reimplementation (OpenCV ≥ 4.10 ships an Apache-2.0 `createLineSegmentDetector`, but pytlsd's variant reads DeepLSD's predicted fields — not a drop-in; post-review C5) | no | yes (measured), at the size / memory above |
| native deps / arm64 | OpenCV C++ | PyTorch, pytlsd (C++), OpenCV | + Ceres, Eigen, GC-RANSAC, Progressive-X, glog | PyTorch, timm |
| cancellation | trivially between frames (ms) | a 60 s WASM call cannot be interrupted inside a single-threaded worker except by terminating the worker (the 005H pattern) | — | terminate the worker (005H pattern) |
| offline / network | offline | offline once the checkpoint is shipped; **the official checkpoint server returns 403 today** | — | offline once shipped |
| determinism | re-run byte-identical (2 frames, `performance.json` → `determinism`) | re-run identical on this box (CPU fp32, 2 frames); WASM vs PyTorch fields differ by ≤ 4.1e-4 | not re-run | BOX + SOURCE masks re-run byte-identical (2 frames); WASM vs PyTorch embedding differ by ≤ 1.9e-6 |
| supply-chain complexity | low (one repo, Apache-2.0) + OpenCV | high: four C++ builds, two dead pybind11 copies, an unofficial weight mirror, AGPL in the detection path | very high | medium: one repo, weights in-repo, SA-1B provenance question |

## Per-provider deployment verdicts

- **ELSED.** Even if it had won, the order of preference would be (1) adopt the algorithm by a TypeScript port of its
  small core (Gaussian blur, Sobel, anchor routing, segment fitting and validation — no OpenCV), (3) reimplement the
  minimal primitives it needs, never (2) package OpenCV for Android (rejected in 005G). It did **not** win: on the real
  set and on the synthetic corpus it adds no exterior-wall coverage that source-cv lacks (`development-results.json`,
  `synthetic-results.json`), except on the synthetic 45° bay. Verdict: nothing to deploy.
- **DeepLSD.** The network exports to ONNX and runs in onnxruntime-web under Node 18, but at ≈ 60 s and 1.2 GB per
  plan before the line extraction, whose published implementation is AGPL-licensed; the refinement has no WASM path.
  A desktop-only use is technically possible; it adds no measured value (`recommendation.md`). Verdict: not
  deployable on the phone; no reason to keep as a desktop oracle.
- **MobileSAM.** Exports and runs in WASM (7.7 s encoder, 0.6 GB) at an APK cost larger than the current APK. Its
  masks are region proposals only: they include terraces, porches and recess pockets, leak through openings, inherit
  any defect of the box they are prompted with, and on the rectangular houses add nothing over the box itself
  (`TRIVIAL-EXTENT`). Verdict: not a phone candidate; at most a desktop diagnostic, and the measured value does not
  justify even that today.
