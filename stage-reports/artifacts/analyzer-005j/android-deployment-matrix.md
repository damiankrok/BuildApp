# Android deployment matrix (BUILDPLAN-ANALYZER-005J)

What each serious candidate would cost on the phone. **No Android device or emulator was available in this stage**;
every phone figure is either (a) measured in the runtime the app already ships — `onnxruntime-web` 1.30.0 WASM, SIMD,
**one thread**, under **Node 18.20.4** (the nodejs-mobile line), on this container's x86-64 CPU — or (b) taken from an
upstream card and labelled, or (c) UNMEASURED. **No text-only latency is quoted as an image latency.** The app today:
arm64-v8a only, 39.4 MB APK, permissions INTERNET only, one ORT-web WASM (14.2 MB) for the 4.4 MB OCR model.

Probe: `research/analyzer-005j/wasm-probe.cjs`; results `wall-model-proof.json` → `wasm`. RSS is sampled on the event
loop that single-threaded WASM blocks, so it is a lower bound on the peak (as 005I D8). The container was shared with
other benchmark processes during the probes; times are upper-bound-ish for this CPU.

## 1. Candidates × runtime

| candidate × runtime | raw weights | INT8 | INT4 | CPU | GPU | NPU | min Android | package / download | peak RAM | image preprocessing | cold load | per-question latency class | cancellation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **UNet-lite wall/opening proof (005J, 1.56 M params) × ORT-web WASM (shipped)** — **the 005K route** | 6.25 MB fp32 ONNX (measured) | ≈ 1.5 MB (estimate) | n/a | yes | no (nodejs-mobile) | no | the app's | +6 MB embedded (or +1.5 MB int8) | ≥ 340 MiB RSS during an 864² frame (measured, lower bound) | grey, invert, pad to /32; full frame or a gap crop | **2.8 s** (measured, Node 18 WASM) | **1.19 s per 864² frame** (measured, median of 3, p95 2.23 s, 1 thread, contended); a 256² gap crop ≈ 0.1 s (scaled) | between frames/crops (worker exit) |
| MiT-B0 SegFormer re-implementation (005J, 3.71 M) × ORT-web WASM | 14.95 MB fp32 ONNX (measured) | ≈ 3.7 MB (estimate) | n/a | yes | no | no | the app's | +15 MB / +3.7 MB | ≥ 928 MiB RSS (measured, lower bound) | same | 2.0 s (measured) | **4.46 s per 864² frame** (measured, median of 3, p95 6.51 s) | same |
| Route-C micro-referee pilot (005J, 1.07 M) × ORT-web WASM | 4.22 MB fp32 ONNX (measured) | ≈ 1.1 MB | n/a | yes | no | no | the app's | +1–5 MB embedded | ≥ 214 MiB RSS (measured, lower bound) | RGB 256² crop + overlays (later: grey + mask channels) | 0.9 s (measured) | **70 ms per question** (measured, median of 20, p95 398 ms) | per question |
| Florence-2-base × ORT-web WASM | 463 MB fp16 / 1,086 MB fp32 ONNX | 275 MB | 215–333 MB | yes | no | no | the app's | 215–275 MB (AI pack) | UNMEASURED | 768² hard resize, 577 tokens | UNMEASURED | UNMEASURED on WASM; desktop CPU fp32 torch ≈ 5–6 s per enum-scored question (measured) | between tokens |
| **SmolVLM2-500M × ORT-web WASM** | 2,033 MB fp32 / 1,017 MB fp16 ONNX | 511 MB (but the official int8 vision encoder uses `ConvInteger`, unsupported by ORT's CPU provider — measured; use fp32 vision 393 MB + int8 decoder 365 MB + int8 embed 47 MB ≈ 805 MB) | 343–485 MB | yes | no | no | the app's | 0.35–0.8 GB (AI pack) | **≥ 1.9 GiB RSS in WASM** (measured, lower bound); desktop Python ≈ 1.76 GB | 512² single tile, 64 image tokens | 4.7 s vision + 1.1 s decoder (WASM, measured) | **≈ 16 s per question in WASM** (measured: vision fp32 11.9 s + 210-token prefill 3.8 s + 0.15 s per scored token); desktop Python 1.2–3.7 s | between tokens |
| SmolVLM2-500M × LiteRT-LM (community bundle) | – | vision int8 inside the bundle | 361 MB bundle | yes | yes | no bundle | 24 | +21.8 MB native `.so` + 361 MB | text path only on the card (404 MB GPU / 584 MB CPU, Galaxy S26); **image UNMEASURED** | fixed 512² | 0.6 s CPU / 1.3 s GPU (text path) | **UNMEASURED** for images | `cancelProcess()` |
| SmolVLM2-500M × llama.cpp | 820 + 199 MB f16 | 437 + 109 MB Q8_0 | none published | yes | OpenCL / Vulkan (untested) | Hexagon (untested) | 28 (doc) | self-built `.so` + 546 MB | UNMEASURED | mmproj tiling | UNMEASURED | UNMEASURED | abort callback, not during image encode |
| Moondream 0.5B × ONNX Runtime (legacy client) | – | 622 MB | 442 MB | yes (Python) | – | no | UNVERIFIED | 442–622 MB | desktop Python process ≈ 2.34 GB (measured); vendor: 996 / 816 MiB (platform unstated) | 378² crops + global | desktop ≈ 9.2 s (measured) | desktop CPU ≈ 5–9 s per question (measured) | between tokens |

## 2. SmolVLM2-500M image path in the shipped runtime (measured)

`wasm-probe.cjs` with the official ONNX files (`wall-model-proof.json` → `wasm`), ORT-web 1.30.0 WASM, SIMD, one thread,
Node 18.20.4, desktop x86-64 core shared with the other runs:

| part | input | load | median per call | RSS after |
| --- | --- | --- | --- | --- |
| vision encoder (fp32) | 1 × 1 × 3 × 512 × 512 | 4.7 s | **11.9 s** | 1,944 MiB |
| decoder int8, prefill | 210 tokens (≈ 64 image + question) | 1.1 s | **3.8 s** | 1,675 MiB |
| decoder int8, one step | 1 token over a 210-token cache | 0.8 s | **0.15 s** | 1,607 MiB |

One closed question with 3–4 answers scored token by token is therefore **≈ 16 s on a desktop core**, before any phone
slow-down. This is the number to quote for "image-VLM latency in the app's runtime"; nothing from a text-only benchmark
is used.

## 3. Reading the matrix

1. **Only the BuildPlan-trained small networks fit the current app without new native code**: single-digit megabytes,
   one WASM runtime that is already shipped, 70 ms (classifier) to 1.2 s (full-frame UNet-lite segmentation) per call on
   one desktop thread. A phone core is slower than this container's (budget ×2–×5); still inside the analysis's
   existing minutes-scale runtime.
2. **Every small VLM is a 0.2–0.8 GB download and seconds per question even on a desktop core.** On the phone that is an
   optional AI pack (`server-feasibility.md` §4) at best, plus a new native runtime (LiteRT-LM or llama.cpp) if WASM is
   too slow — and 005J measured them as **not accurate enough** to be worth that (`vlm-bakeoff.md`).
3. **Determinism**: the shipped route (WASM, one thread) is the one 005G/005H proved bit-identical across Node 18 / 22 and
   x86-64 / arm64 V8. A future model must re-prove it on its own graph (005H's parity gate).
4. **NPU / GPU**: not reachable from nodejs-mobile; only through a new native runtime (LiteRT-LM GPU/NPU bundles). Not
   needed for the recommended route.
