# 005I Track B — dependency matrix (research box)

Research box: Ubuntu 24.04.4 x86-64, 4 vCPU, 15 GB RAM, no GPU. All heavy material outside the repository
(`/home/user/work005i`). Exact pins: `research/analyzer-005i-boundary-bakeoff/manifest.json`; reproduction:
`fetch.sh` then `build.sh`.

| provider / config | language | runtime deps (version, licence) | native build | system packages | model files | runs on research box |
| --- | --- | --- | --- | --- | --- | --- |
| source-cv (`SCV-*`) | TypeScript | none (repository packages only) | none | none | none | yes (Node 22 via vite-node; the phone runs the same code on nodejs-mobile 18.20.4) |
| ELSED (`ELSED-DEFAULT`) | C++14 | OpenCV 4.6.0 C++ (Apache-2.0): `cv::GaussianBlur`, `cv::Sobel`, `cv::Mat` | `libelsed.a` (upstream CMake, unchanged) + `elsed_cli.cpp` (harness) | `libopencv-dev` 4.6.0 | none | yes; the upstream Python binding does **not** build (vendored pybind11 2.8.1 vs CPython 3.11) |
| DeepLSD detect (`DEEPLSD-MD`, `DEEPLSD-WF`) | Python 3.11 | torch 2.5.1+cpu (BSD-3), torchvision 0.20.1 (BSD-3), numpy 1.26.4, opencv-python-headless 4.10.0.84 (Apache-2.0), omegaconf 2.3.1 (BSD-3), scikit-image 0.26.0 (BSD-3), scipy 1.17.1 (BSD-3), kornia 0.8.3 (Apache-2.0, imported by geometry utils), **pytlsd (MIT repo; AGPL-3.0+ LSD sources)** | pytlsd (CMake + pybind11; vendored 2.6.2 replaced by v2.13.6 glue) | none beyond build tools | `deeplsd_md.tar` / `deeplsd_wireframe.tar` (102.9 MB each on disk; the network itself is 8.56 M fp32 parameters ≈ 34 MB — the rest of the file is training state) | yes, CPU |
| DeepLSD refine (`DEEPLSD-MD-REFINE-SCV`) | Python + C++17 | the above + `line_refinement` (DeepLSD, MIT) → Ceres 2.2 (BSD-3), Eigen 3.4 (MPL-2.0), OpenCV C++ 4.6, GC-RANSAC (BSD; bundles gco-v3.0, research-only with a patent notice — post-review C1), Progressive-X (MIT), glog 0.6 / gflags 2.2 (BSD-3); distro Ceres links SuiteSparse SPQR / CHOLMOD (GPL-2+) | GC-RANSAC + Progressive-X libraries in-tree, `line_refinement` (CMake + pybind11 bc041de) | `libceres-dev` 2.2.0, `libeigen3-dev` 3.4.0, `libopencv-dev` 4.6.0 (+ glog, gflags) | `deeplsd_md.tar` | yes, CPU (`LD_LIBRARY_PATH` must include the Progressive-X build dir for `libGraphCutRANSAC.so`) |
| MobileSAM (`MSAM-BOX`, `MSAM-SOURCE-PROMPTS`, `MSAM-AUTO`) | Python 3.11 | torch 2.5.1+cpu, torchvision 0.20.1, timm 0.9.16 (Apache-2.0), numpy, opencv-python-headless (mask post-processing in AUTO) | none | none | `mobile_sam.pt` (40.7 MB; 10.13 M fp32 parameters: TinyViT encoder 6.07 M, prompt encoder + mask decoder 4.06 M) | yes, CPU |

## Footprint on the research box

| item | size |
| --- | --- |
| venv (CPU torch + the above) | 1.5 GB |
| apt packages (OpenCV, Ceres, Eigen, glog, gflags and 250 transitive packages; `--no-install-recommends`) | 708 MB installed (195 MB download) |
| upstream clones (+ submodules, builds) | ≈ 0.2 GB |
| checkpoints | 246.5 MB |
| decoded frames, masks, observations, scores | < 0.3 GB |

## What each provider needs that the phone does not have

| provider | blocker on the phone (nodejs-mobile 18.20.4, no native addons, WASM allowed; ONNX Runtime Android and OpenCV Android rejected in 005G) |
| --- | --- |
| ELSED | OpenCV C++ (rejected on Android in 005G); would need a port of three OpenCV primitives (Gaussian blur, Sobel, matrix) to TypeScript or a WASM build of ELSED with them inlined |
| DeepLSD | PyTorch; an ONNX export of the VGG-UNet would need onnxruntime-web WASM (the 005H route), plus the AGPL LSD step or a reimplementation; refinement additionally needs Ceres / Progressive-X (C++) |
| MobileSAM | PyTorch; ONNX export of encoder + decoder is documented upstream (`scripts/export_onnx_model.py`, decoder only; the encoder needs a separate export), would need onnxruntime-web WASM with a 40 MB model |
