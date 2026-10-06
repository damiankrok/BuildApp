# 005I Track B — deployment estimate (boundary providers)

Constraints carried from 005G/005H (`stage-reports/artifacts/analyzer-005g/deployment-matrix.md`,
`STAGE_BUILDPLAN_ANALYZER_005H_EXTERNAL_NUMERIC_RECOGNISER.md`): the phone runs the analyzer on **nodejs-mobile
18.20.4**, one esbuild bundle, **no native addons**; WebAssembly is available and is the 005H route (onnxruntime-web
1.30.0, WASM SIMD, one thread, in a worker per plan); **ONNX Runtime Android and OpenCV Android were rejected in
005G**; current release APK **39 419 927 B** (005H OWNER APK, run 160, with the numeric recogniser's model and WASM;
005F's was 30 785 427 B); analysis peak RSS 1 788–2 096 MiB on the emulator (03Y2); the 005H recogniser worker adds
≤ 108 MB at load. No runtime network. Every APK percentage below is against 39 419 927 B (post-review D8).

Measured here (x86-64, 4 vCPU shared with a concurrent development matrix, load average 5–10 — every time below
is an upper bound for this box and **not** a phone timing; no arm64 run was made). "Process peak" is the kernel's
maximum RSS for the process (a true peak); the WASM figures are RSS after inference, a lower bound on the peak (the
probe samples on an event loop that single-thread WASM inference blocks; post-review D8):

| item | ELSED | DeepLSD (detect) | DeepLSD (refine) | MobileSAM |
| --- | --- | --- | --- | --- |
| model / checkpoint | none | `deeplsd_md.tar` 102.9 MB (network 8.56 M fp32 params) | same | `mobile_sam.pt` 40.7 MB (10.13 M fp32 params) |
| ONNX export (this study) | n/a (classical C++) | **works** for the network: `deeplsd_md_fields.onnx` 34 310 477 B (gzip −9: 31 815 323 B); max \|Δ\| vs PyTorch 4.1e-4 on a real frame. The line extraction from the fields (pytlsd LSD, **AGPL**) is C code outside the graph | the refiner is Ceres + Progressive-X C++ — no ONNX/WASM path | **works**: encoder 27 969 714 B (gzip 21 440 068 B), max \|Δ\| 1.9e-6; prompt-encoder + decoder 16 501 736 B (gzip 15 170 340 B) |
| Node 18.20.4 + onnxruntime-web WASM, 1 thread (853×853 frame) | n/a | **59.6 s**, RSS after inference **1 207 MiB** (a lower bound on the peak; fields only) | n/a | encoder **7.7 s**, RSS after inference **637 MiB** (a lower bound on the peak); decoder 0.9 s, 404 MiB after inference |
| desktop native CPU (PyTorch / C++, 2 threads; 30 frames; scored re-run, first run in brackets) | detection **13 ms** median [12 ms], max 97 ms under load [20 ms]; process peak 63 MB | 13.4 s median [13.5 s] (max 28.5 s [21.7 s]); process peak RSS 2.0 GB median | 18.4 s median [20.4 s] (max 36.3 s [29.8 s]), 2.0 GB | encoder 2.4 s median [2.7 s] (max 6.2 s [4.5 s]); 13 prompted decodes < 1 s total; AUTO (16×16 points) 52.1 s median [52.5 s]; process peak 2.44 GB median (with AUTO) |
| compressed APK increase (estimate; % of the 39.4 MB APK) | algorithm ≈ 30 KB as C++ (88 KB static lib; < 0.1 %) — but it needs OpenCV (`libopencv_java4.so` arm64 → 9.77 MB per ABI, +25 %, **rejected in 005G**), or opencv.js (3.76 MB, +10 %, DEFER in 005G), or a port | ≥ 31.8 MB model, **≥ +81 %** (+ an LSD replacement) | not deployable | ≈ **36.6 MB** (encoder + decoder gzip, fp32: 36 610 408 B) — **+93 %**, nearly doubling the APK; int8 quantisation not attempted |
| working memory on the phone | small (one gray image, gradient maps) | ≥ 1.2 GB (RSS after inference, a lower bound on the peak) on top of a 1.8–2.1 GB analysis → **not feasible** | n/a | ≥ 0.6 GB per worker (RSS after inference, a lower bound on the peak) on top of the analysis → **high risk** |
| CPU feasibility on the phone | yes (ms) | no (minutes per plan at phone speed, estimated) | no | marginal (tens of seconds per plan, estimated) |
| WASM / ONNX feasibility in the Node 18 bundle | port to TypeScript, or an emscripten build with Gaussian / Sobel inlined (not attempted) | network yes (measured), LSD step needs a non-AGPL reimplementation (OpenCV ≥ 4.10 ships an Apache-2.0 `createLineSegmentDetector`, but pytlsd's variant reads DeepLSD's predicted fields — not a drop-in; post-review C5) | no | yes (measured), at the size / memory above |
| native deps / arm64 | OpenCV C++ | PyTorch, pytlsd (C++), OpenCV | + Ceres, Eigen, GC-RANSAC, Progressive-X, glog | PyTorch, timm |
| cancellation | trivially between frames (ms) | a 60 s WASM call cannot be interrupted inside a single-threaded worker except by terminating the worker (the 005H pattern) | — | terminate the worker (005H pattern) |
| offline / network | offline | offline once the checkpoint is shipped; **the official checkpoint server returns 403 today** | — | offline once shipped |
| determinism | full re-run identical on all 30 frames (`performance.json` → `fullRerunComparison`; earlier 2-frame check → `determinism`) | full re-run identical on all 30 frames (CPU fp32, both checkpoints); WASM vs PyTorch fields differ by ≤ 4.1e-4 | **not reproducible**: GC-RANSAC (inside Progressive-X) seeds its generator from `std::random_device`; the full re-run moved 9–57 % of the refined lines by > 0.1 px on every frame | every mask identical on all 30 frames in the full re-run (AUTO's full mask set included); WASM vs PyTorch embedding differ by ≤ 1.9e-6 |
| supply-chain complexity | low (one repo, Apache-2.0) + OpenCV | high: four C++ builds, two dead pybind11 copies, an unofficial weight mirror, AGPL in the detection path | very high | medium: one repo, weights in-repo, SA-1B provenance question |

## Per-provider deployment verdicts

- **ELSED.** Even if it had won, the order of preference would be (1) adopt the algorithm by a TypeScript port of its
  small core (Gaussian blur, Sobel, anchor routing, segment fitting and validation — no OpenCV), (3) reimplement the
  minimal primitives it needs, never (2) package OpenCV for Android (rejected in 005G). It did **not** win: on the real
  set and on the synthetic corpus it adds no exterior-wall coverage that source-cv lacks (`development-results.json`,
  `synthetic-results.json`), except on the synthetic 45° bay. Verdict: nothing to deploy.
- **DeepLSD.** The network exports to ONNX and runs in onnxruntime-web under Node 18, but at ≈ 60 s and ≥ 1.2 GB
  (RSS after inference, a lower bound on the peak) per plan before the line extraction, whose published implementation is AGPL-licensed; the refinement has no WASM path.
  A desktop-only use is technically possible; it adds no measured value (`recommendation.md`). Verdict: not
  deployable on the phone; no reason to keep as a desktop oracle.
- **MobileSAM.** Exports and runs in WASM (7.7 s encoder, ≥ 0.6 GB RSS after inference — a lower bound on the peak)
  at an APK cost of ≈ 36.6 MB, +93 % of the current 39.4 MB APK. Its
  masks are region proposals only: they include terraces, porches and recess pockets, leak through openings, inherit
  any defect of the box they are prompted with, and on the rectangular houses add nothing over the box itself
  (`TRIVIAL-EXTENT`). Verdict: not a phone candidate; at most a desktop diagnostic, and the measured value does not
  justify even that today.
