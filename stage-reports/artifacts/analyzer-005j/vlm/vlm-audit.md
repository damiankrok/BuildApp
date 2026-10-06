# BUILDPLAN-ANALYZER-005J: VLM candidate and Android runtime audit

Accessed 2026-10-06. Everything below was checked live against these sources: the HF API (`?blobs=true`, `/tree`, `/refs`, `/commits`), raw model cards and LICENSE files, PyPI and npm JSON, Google Maven and Maven Central, raw.githubusercontent.com, and shallow or blob-less git clones in `/home/user/work005j/upstream/` (`moondream`, `litert-lm`, `executorch-tree`, `mlc-tree`). **I downloaded no model weights.** I did download and inspect a few small packages: moondream wheels 0.0.6/0.1.0/0.1.1/2.6.1, the kestrel 0.9.1 wheel, the transformers.js 3.x/4.3.0 tarballs and the litertlm-android 0.17.1 AAR. I also read the existing `onnxruntime-web` 1.30.0 in `/home/user/BuildApp/node_modules` without modifying it.

Labels: **UNMEASURED** means no official or credible measurement exists. **UNVERIFIED** means it is plausible but I did not confirm it here. "Derived" means computed from config or code, not measured.

Machine-readable version: `vlm-audit.json` (same directory). It has full per-repo file lists with sizes and LFS SHA-256, the ONNX load-set sums, the runtime records and the source list.

---

## 1. Verdict summary

| | Florence-2-base (-ft) | SmolVLM2-500M / SmolVLM-500M | Moondream 0.5B |
|---|---|---|---|
| Weights licence | **MIT** (card plus LICENSE file, (c) Microsoft) | **Apache-2.0** | **Apache-2.0** (onnx-branch README, repo card, blog) |
| Backbone licences | UniCL (MIT), BART/fairseq (MIT), DaViT ref impl (MIT) | SigLIP-base-p16-512 (Apache-2.0), SmolLM2-360M-Instruct (Apache-2.0) | n/a (not documented) |
| Training-data caveat | FLD-5B is not released; images come from ImageNet-22k, Objects365, Open Images, CC and LAION with mixed terms | SmolVLM2 mixture includes **academic-only** (Vript, LLaVA-Video-178K) and **CC-BY-NC** (ShareGPT4Video) sets. v1 SmolVLM-500M used only Cauldron (per-subset licences) and Docmatix (MIT). | not documented |
| Params | 231,567,705 | 507,482,304 | ~0.5B (vendor) |
| Free-form or closed-answer VQA | **No VQA task token.** -ft was trained with VQA, but the prompt format is undocumented. | **Yes** (chat VQA) | **Yes** (`query`); detect and point depend on the .mf config templates (UNVERIFIED for 0.5B) |
| Grounding / OD / OCR | Yes: 15 task tokens | Text answers only | detect and point exist in the client (0.5B config UNVERIFIED) |
| ONNX for ORT-web | onnx-community; Transformers.js ≥3.0.0 | in-repo `onnx/`; Transformers.js idefics3 ≥3.2.0, smolvlm ≥3.4.0 | `.mf.gz` = gzip container of ONNX graphs (legacy python client only) |
| Smallest practical download | ~215 MB (mixed q4 + int8 embed) / 275 MB int8 | ~343 MB ONNX mixed / 361 MB LiteRT-LM | 442 MB int4 / 622 MB int8 |
| Android image latency | UNMEASURED | UNMEASURED (community LiteRT numbers are text-path only) | UNMEASURED |
| Upstream status | Microsoft repo frozen-ish (last commit 2025-08-04); native in transformers 4.56.0 | maintained HF family | **legacy**: vendor says 0.5B is a "distillation target … not generally recommended out of the box" |

---

## 2. Candidate A: Florence-2-base

### Repositories (revision SHAs)
| Repo | Revision | Key weight file | Size (B) | LFS sha256 |
|---|---|---|---|---|
| microsoft/Florence-2-base | `5ca5edf5bd017b9919c05d08aebef5e4c7ac3bac` (2025-08-04) | model.safetensors (F16) | 463,221,266 | `03075d2d2d2bbd3e180b9ba0afae4aa8563226e2d32911656966e05b2f2ee060` |
| | | pytorch_model.bin | 464,421,827 | `b480ac374593b0dcb18ffa63b23213734e04cd43eab0d620d23e39708d4a4a7e` |
| microsoft/Florence-2-base-ft | `f6c1a25888ffc1d945ee8a1a77ac833c7303d46e` | model.safetensors | 463,221,266 | `58757d657ff44051314c8030b68e04cb1bb618ca9a4885418f111f6fb708185a` |
| florence-community/Florence-2-base (native format, MIT) | `00921df66db728a9ceb750f5eca43e5c203a2051` | model.safetensors | 463,178,864 | `62f3e696da74f8869a68ddb529a9b3e14eb25b21c592cb3dea6179bf944df6a0` |
| florence-community/Florence-2-base-ft | `0b03b6f15a4a211370fb204aee4e7dd48887ea37` | model.safetensors | 463,178,864 | `ab06dea66b16d5e54513256d64854be2194443452fd0d84353b40a278bf87d42` |
| onnx-community/Florence-2-base | `d59e079711c57174f29265539fb4cc9f0f335916` | 48 ONNX files | see JSON | see JSON |
| onnx-community/Florence-2-base-ft | `e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f` | 48 ONNX files | see JSON | see JSON |

Also: `ducviet00/Florence-2-base-hf` (`f5164427…`) is the conversion used in the transformers docs pipeline example. Its card is tagged **apache-2.0**, which conflicts with the upstream MIT, so don't use it as the licence source.

### Facts
- **Native transformers:** `Florence2ForConditionalGeneration` first appears in **transformers v4.56.0**. `models/florence2/modeling_florence2.py` returns 404 at v4.53.0, v4.54.0, v4.55.0 and v4.55.4, and 200 at v4.56.0, v4.57.0 and v5.0.0. PyPI 4.56.0 was uploaded 2025-08-29. The `microsoft/*` repos still carry `auto_map`, so loading them the old way means `trust_remote_code=True`. The docs credit contributor ducviet00.
- **Tasks**, from `processing_florence2.py` at the audited revisions (base and -ft have the same task table):
  - No input: `<OCR>`, `<OCR_WITH_REGION>`, `<CAPTION>`, `<DETAILED_CAPTION>`, `<MORE_DETAILED_CAPTION>`, `<OD>`, `<DENSE_REGION_CAPTION>`, `<REGION_PROPOSAL>`.
  - With input: `<CAPTION_TO_PHRASE_GROUNDING>`, `<REFERRING_EXPRESSION_SEGMENTATION>`, `<REGION_TO_SEGMENTATION>`, `<OPEN_VOCABULARY_DETECTION>`, `<REGION_TO_CATEGORY>`, `<REGION_TO_DESCRIPTION>`, `<REGION_TO_OCR>`.
  - **There is no VQA token.** Text without a task token passes through the processor unchanged. The -ft card reports VQAv2 79.7, TextVQA 63.6 and VizWiz 63.6, so VQA was in the -ft training mixture, but no prompt format is published. Treat closed-answer VQA as **unsupported or undocumented**.
- **Architecture:** a DaViT encoder (dims 128/256/512/1024, depths 1/1/9/1) plus a BART-style encoder-decoder (6+6 layers, d_model 768, vocab 51,289 including 1000 `<loc_*>` tokens). The paper says the image encoder was initialised from **UniCL** and the encoder-decoder from **BART**. All three upstream LICENSE files are MIT.
- **Preprocessing:** a hard resize to **768×768** (no aspect preservation, no crop), ImageNet mean/std, `image_seq_length` 577, and coordinates quantised to 1000 bins.
- **FLD-5B** (paper): 126M images from ImageNet-22k, Objects365, Open Images, Conceptual Captions and LAION (filtered). Its 5.4B annotations were generated by specialist models (DINO, Grounding DINO, SAM, captioners and cloud OCR) and then filtered. The paper states no release or licence for FLD-5B. **Legal review item.**
- **ONNX load-set sums.** Transformers.js loads `vision_encoder`, `embed_tokens`, `encoder_model` and `decoder_model_merged`:

| Variant | Bytes | MiB |
|---|---|---|
| fp32 | 1,085,954,298 | 1035.6 |
| fp16 | 544,046,795 | 518.8 |
| int8 | 275,008,054 | 262.3 |
| q4 (embed stays fp32 157.6 MB) | 333,291,126 | 317.9 |
| q4f16 | 223,488,587 | 213.1 |
| bnb4 | 319,354,160 | 304.6 |
| mixed q4 decoder/encoder/vision + int8 embed | 215,121,496 | 205.2 |

  The DaViT vision encoder hardly shrinks under 4-bit: 81.3 MB at q4 against 93.8 MB at int8.
- **Transformers.js:** Florence2 is present in @huggingface/transformers 3.0.0, 3.2.0, 3.4.0, 3.5.0 and 4.3.0 (string-verified in the dist bundles).
- **Not supported** by llama.cpp/libmtmd, LiteRT-LM, MediaPipe LLM Inference or MLC-LLM. It is encoder-decoder and none of these list it. No LiteRT bundle exists.
- RAM, cold load and per-image latency on Android or ARM: **UNMEASURED**. I found no official or credible measurement.

---

## 3. Candidate B: SmolVLM2-500M (and siblings)

### Repositories
| Repo | Revision | Weight file | Size (B) | LFS sha256 |
|---|---|---|---|---|
| HuggingFaceTB/SmolVLM2-500M-Video-Instruct | `7b375e1b73b11138ff12fe22c8f2822d8fe03467` | model.safetensors (F32) | 2,029,990,624 | `b9bfd456c9472c0acd5719d6e514c4b859891af205ee1a736552fd3497b8b0c3` |
| HuggingFaceTB/SmolVLM-500M-Instruct | `a7da5b986cb59b408707209984f360a5f4ad7e47` | model.safetensors (BF16) | 1,015,025,832 | `d05b567eeaf534e83d375551f068ed57b5f52d37c657197f644af5ef9db091a2` |
| HuggingFaceTB/SmolVLM-256M-Instruct | `7e3e67edbbed1bf9888184d9df282b700a323964` | model.safetensors (BF16) | 513,028,808 | `74dea5904032e5ae99a2e0eef5179e6ac0f1dedc3ab0c7c2a5d4d387c843203e` |
| HuggingFaceTB/SmolVLM2-256M-Video-Instruct | `067788b187b95ebe7b2e040b3e4299e342e5b8fd` | model.safetensors (F32) | 1,025,998,224 | `dcc8f4c0…` (JSON) |
| ggml-org/SmolVLM2-500M-Video-Instruct-GGUF | `ccd7aae53bcb1997355c2f094959e72b3642ce17` | Q8_0 / mmproj Q8_0 | 436,808,704 / 108,785,184 | `6f67b803…` / `921dc7e2…` |
| | | f16 / mmproj f16 | 820,424,704 / 199,470,624 | `80f7e3f0…` / `b5dc8ebe…` |
| ggml-org/SmolVLM2-256M-Video-Instruct-GGUF | `2fd73d28c10a108a723cbf6f348114977cd488c1` | Q4_K_M | 131,234,176 | `1d86050b…` |
| **litert-community/SmolVLM2-500M** | `dad030b6e56756201d670cfb4d042736a2ce3a5c` | SmolVLM2-500M.litertlm | **360,822,960** | `b808b328d845a600a33c5295f93d9217487317bd334dbc91b2a8d50e26e60ad0` |
| litert-community/SmolVLM-256M-Instruct | `dc16f6046d86c646bcc5dfe249c879d028f8b2f2` | smalvlm-256m-instruct_q8_ekv2048.tflite | 288,312,304 | `469a85dc…` |

`warped-community/SmolVLM2-500M-litert-lm` is a byte-identical mirror with the same sha256.

### Facts
- **Base models:** SmolVLM-500M-Instruct is built on SmolLM2-360M-Instruct (Apache-2.0, 361.8M params) and google/siglip-base-patch16-512 (Apache-2.0). The card calls the vision part a "93M encoder". SmolVLM2-500M's base_model is SmolVLM-500M-Instruct. The architecture is Idefics3-style with pixel-shuffle r=4.
- **Licence:** Apache-2.0 for the weights ("We release the SmolVLM2 checkpoints under the Apache 2.0 license"). The training data licences are **mixed**. Per HF dataset cards:
  - the_cauldron: per-subset licences; the prompts are CC-BY-4.0
  - Docmatix: MIT
  - LLaVA-OneVision-Data: apache-2.0
  - M4-Instruct: cc-by-4.0
  - MAmmoTH-VL: apache-2.0
  - Video-STaR: apache-2.0
  - VISTA-400K: mit
  - FineVideo: "cc" (gated)
  - **Vript: "ACADEMIC USE ONLY / NO DISTRIBUTION"**
  - **ShareGPT4Video: cc-by-nc-4.0**
  - **LLaVA-Video-178K:** "only allow the use … for academic research and education"
  - MovieChat-1K: no tag (gated)

  The image-only SmolVLM-500M-Instruct (v1) lists only Cauldron and Docmatix.
- **Image path:** `do_image_splitting=true`, longest_edge 2048, tiles of 512, **64 tokens per 512×512 tile** (1024 SigLIP patches divided by 16). Derived worst case for a square 2048 input: 16 tiles plus 1 global = **1088 image tokens**. Forcing longest_edge 512 gives 64 tokens. The LiteRT bundle uses a fixed single 512×512 image with 64 tokens.
- **Official memory** (desktop GPU, not Android):
  - SmolVLM-500M: "1.23GB of GPU RAM" for one image
  - SmolVLM2-500M: "1.8GB of GPU RAM for video"
  - 256M: "<1GB" (paper)

  The paper's throughput numbers are A100/L4, plus WebGPU decode at 80 tok/s for the 256M on an M4 Max. **None of these is an Android image latency.**
- **ONNX** (in-repo `onnx/`). Load set is `vision_encoder` + `embed_tokens` + `decoder_model_merged`. SmolVLM2-500M and SmolVLM-500M have identical sizes:

| Variant | 500M bytes | 500M MiB | 256M MiB |
|---|---|---|---|
| fp32 | 2,032,852,322 | 1938.7 | 980.9 |
| fp16 | 1,016,839,205 | 969.7 | 490.6 |
| int8 | 511,315,044 | 487.6 | 247.8 |
| q4 (embed fp32) | 485,088,978 | 462.6 | 251.7 |
| q4f16 | 357,638,262 | 341.1 | 180.1 |
| mixed q4 + int8 embed | 343,162,804 | 327.3 | 170.5 |

- **LiteRT-LM bundle.** This is a community conversion, not in Google's official supported-model table. Quantisation: vision int8, decoder int4 (blockwise-32), embedding int8, KV 2048. Sections: embedder 47.9 MB, prefill_decode 208.9 MB, vision_encoder 91.5 MB, adapter 11.8 MB. Community Galaxy S26 numbers are **text path only; the card says no image was in the gate prompt**:

| Backend | Peak | Load | Decode |
|---|---|---|---|
| GPU | 404 MB | 1.3 s | 76 tok/s |
| CPU | 584 MB | 0.6 s | 62–77 tok/s |

  Image latency on that path: **UNMEASURED**. The manifest also contradicts itself about GPU on S26.
- **MediaPipe LLM Inference:** **no**. The API is maintenance-only and documents image input only for Gemma 3n. The litert-community SmolVLM-256M card says VLMs aren't supported there.
- **llama.cpp:** listed in `docs/multimodal.md` (libmtmd) for SmolVLM 256M/500M and SmolVLM2 256M/500M. ggml-org publishes no Q4 for the 500M.
- **ExecuTorch:** `examples/models/smolvlm` contains only `500M_config.json` and a text-decoder weight mapping.
- Android image latency, image-path RAM and cold load for ONNX: **UNMEASURED**.

---

## 4. Candidate C: Moondream 0.5B (artifact situation)

**Where the files live now:** `vikhyatk/moondream2`, **branch `onnx`**, commit `9dddae84d54db4ac56fe37817aeaeb502ed083e2`. They were uploaded 2024-12-05. The `.bin.gz` files from 2024-12-03 were deleted. The branch README says `license: apache-2.0`.

| File | Bytes | MiB | LFS sha256 |
|---|---|---|---|
| moondream-0_5b-int8.mf.gz | 621,619,051 | 592.8 | `355c534d5f71fff8524dfeb41ba65f7d07948f910f754de4df242d0037d8be4a` |
| moondream-0_5b-int4.mf.gz | 442,376,060 | 421.9 | `56cb6c2b5ff43ec065cad89da8007224d37b1b10d053ff6d958f97baa195c129` |
| moondream-2b-int8.mf.gz | 1,818,358,311 | 1734.1 | `8dad1bd4de366b20cfadde5a400753b077a751242889eb471c7886bad0180e94` |
| moondream-2b-int4.mf.gz | 1,223,366,777 | 1166.7 | `616a1fae727dae66fed1f1dec1069c0d4d08078245e6b7d97d892961b88e61a7` |

- **Official numbers** (moondream.ai blog and /models): download 479 MiB (int8) / 375 MiB (int4); RAM **996 MiB / 816 MiB**. These are the only RAM figures for 0.5B, and the platform is unspecified. **Discrepancy:** the published download sizes don't match the current HF files (592.8 / 421.9 MiB).
- **Format:** a gzip "MOON" v1 container holding:
  - ONNX graphs: `vision_encoder`, `vision_projection`, `text_encoder`, `text_decoder`, `size_encoder`/`size_decoder`, `coord_encoder`/`coord_decoder`
  - the tokenizer and `initial_kv_cache.npy`
  - `config.json` with the task templates

  This comes from reading `moonfile.py` and `onnx_vl.py` in moondream 0.0.6.
- **Local runner history** (PyPI):
  - **0.0.1–0.0.6** (0.0.6 released 2024-12-10) have `OnnxVL`, reached via `md.vl(model=path)`. Dependencies: onnxruntime ≥1.19.2,<2; tokenizers <0.21; pillow <11; numpy ≥2.1.2. **This is the only runner for the .mf files.**
  - **0.1.0** (2025-04-09) and later drop it and become cloud or "Moondream Server" clients only.
  - **2.6.1** (current, 2026-09-30) adds "Photon" local inference via kestrel 0.9.1 (torch). Its registry holds only `moondream2` (2B), `moondream3-preview` and `moondream3.1-9B-A2B`, **so 0.5B is not supported**. kestrel's README also says it sends usage telemetry.
- **Capabilities:** the 0.0.x client exposes `caption` (short/normal), `query` (free-form VQA), `detect` and `point`. Each one depends on templates in the model's config.json, so **I couldn't verify which skills the 0.5B config enables without the weights**. No segment in 0.0.x.
- **Preprocessing** (0.0.6 code): 378×378 crops, a 1×2, 2×1 or 2×2 layout chosen by aspect ratio, plus a global crop. Local features are pooled to the global grid and concatenated (derived). **As run in the bake-off** (512² crops): `max_dim < 378 × 1.4`, so the client picks template (1, 1), one 378² global view (a 0.74× downscale) and no local crops (post-review B8).
- **Status:** moondream.ai/models still lists it as "Designed primarily as a distillation target for extreme edge deployments … Not generally recommended out of the box". The GitHub README (Apache-2.0, HEAD `6eccfcea`) describes 0.5B the same way. The moondream2 card says Moondream 2's latest is **2025-06-21** and points to **Moondream 3 (Preview)**.
- **Licences:**

| Artifact | Licence |
|---|---|
| 0.5B | Apache-2.0 |
| moondream2 2B | Apache-2.0 |
| **moondream3-preview** | **BSL 1.1** with Additional Use Grant: no competing hosted or embedded offering; becomes Apache-2.0 two years after release |
| moondream3.1-9B-A2B | custom `moondream-model-license-1.0` (not reviewed) |

- **Replacements** (if 0.5B is dropped):
  - moondream2 2025-06-21: main `5d6c926f…`, 1.93B params, BF16 3,854,538,968 B, sha `70a7d94c…`. Official RAM: int4 2,002 MiB, int8 2,624 MiB.
  - GGUF `ggml-org/moondream2-20250414-GGUF`: text f16 2.84 GB plus mmproj 0.91 GB; llama.cpp supports it.
  - 4-bit safetensors `moondream/moondream-2b-2025-04-14-4bit`: 2.03 GB.

  All of these are about 4–8× larger than 0.5B.
- **Still runnable?** Yes, as downloadable files plus the legacy moondream==0.0.6 ONNX client on desktop CPU. I didn't execute it because I downloaded no weights. Android or ORT-web op coverage is **UNVERIFIED**. No GGUF, LiteRT or MLC artifact exists for 0.5B.
- Cancellation: the Python generator calls `text_decoder.run` once per token, so it can be cancelled between tokens.

---

## 5. Runtimes

| Runtime | Version (2026-10-06) | Licence | Image VLMs that apply here | CPU / GPU / NPU | Min Android | Cancel | Notes |
|---|---|---|---|---|---|---|---|
| **onnxruntime-web WASM** (in app) | 1.30.0 (npm 2026-09-14) | MIT | Any ONNX export (Florence-2, SmolVLM, Moondream graphs); pre- and post-processing must be ported | CPU (single thread in app) / no GPU in nodejs-mobile / no NPU | app's | `RunOptions.terminate` exists (WASM only), but a single-thread `run()` blocks the event loop, so cancel between per-token runs or kill the worker | Op names MatMulNBits, GroupQueryAttention, MatMulInteger and DynamicQuantizeMatMul appear as strings in `ort-wasm-simd-threaded.wasm` (14.2 MB); not executed. wasm32 heap ≤4 GiB. |
| Transformers.js (on ORT) | 4.3.0 | Apache-2.0 | florence2, idefics3/smolvlm, moondream1 (old MD), lfm2_vl, gemma3n/4, qwen2/2.5/3_vl, paligemma, llava | – | – | `InterruptableStoppingCriteria` | **Not drop-in for nodejs-mobile (Node 18).** The node build statically imports `sharp` ^0.35.4 (engines node ≥20.9.0, no Android prebuilt) and requires `onnxruntime-node`. It bundles ort-web 1.31.0-dev with jsdelivr as the default wasm path. |
| onnxruntime-android | 1.30.0 AAR (53.0 MB) | MIT | same ONNX graphs | CPU / NNAPI, QNN, XNNPACK EPs (not audited) | – | native RunOptions terminate (not re-verified) | 005G: the AAR adds INTERNET and ACCESS_NETWORK_STATE plus a telemetry provider. |
| **LiteRT-LM** | litertlm-android **0.17.1** (repo dev 0.18.0) | Apache-2.0 | Official: Gemma 3n, Gemma 4 (vision). Community: SmolVLM2-500M, FastVLM-0.5B bundles | CPU / GPU (OpenCL via `uses-native-library`) / NPU (device-specific bundles) | **minSdk 24** (AAR manifest) | **`Conversation.cancelProcess()`** | AAR 20.5 MB; arm64 `.so` 21.8 MB, 16 KB-aligned LOAD, GNU_RELRO present; **no permissions** in the AAR manifest. |
| MediaPipe LLM Inference | tasks-genai 0.10.35 | Apache-2.0 | Gemma 3n only (image) | CPU/GPU | "Pixel 8 / S23 or later" recommended | not documented | **Maintenance-only**; Google says migrate to LiteRT-LM. |
| **llama.cpp** (libmtmd) | b11445 / master `a46709b6` | MIT | SmolVLM/SmolVLM2 256M/500M, Moondream2 20250414, InternVL3-1B, Qwen2.5-VL, Gemma 3/4. Not Florence-2, not Moondream 0.5B. | CPU (arm64, KleidiAI/SME2) / OpenCL Adreno, Vulkan / Hexagon backend doc | NDK `android-28` in the docs example | `llama_set_abort_callback` plus caller token loop; no abort for mtmd image encode | `examples/llama.android` Kotlin binding |
| ExecuTorch | 1.5.1 | BSD | MultimodalRunner; examples llava, llama3_2_vision, gemma3, gemma4, internvl3, lfm2, smolvlm (text decoder only) | CPU (XNNPACK) / Vulkan, QNN delegates | – | `LlmModule.stop()` | Android `LlmModule.prefillImages()`. optimum-executorch 1.1.0 lists no VLMs. |
| MLC-LLM | main `69881d12` | Apache-2.0 | llava, phi3v, qwen2_5_vl, gemma3/4. No SmolVLM, Florence or Moondream. | GPU (OpenCL/Vulkan) | – | UNVERIFIED | Android image input UNVERIFIED. |

---

## 6. Deployment matrix (serious candidate × runtime)

| Candidate × runtime | Raw | INT8 | INT4 | CPU | GPU | NPU | Min Android | Download added | Peak RAM | Preprocessing | Cold load | Image latency | Cancel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Florence-2-base × ORT-web WASM | 463 MB fp16 / 1,086 MB fp32 ONNX | 275.0 MB | 333.3 q4 / 223.5 q4f16 / 215.1 mixed | yes | no | no | app's | 215–275 MB | UNMEASURED | 768² resize, 577 tok | UNMEASURED | UNMEASURED | between tokens |
| SmolVLM(2)-500M × ORT-web WASM | 1,015 MB bf16 / 2,033 MB fp32 ONNX | 511.3 MB | 485.1 q4 / 357.6 q4f16 / 343.2 mixed | yes | no | no | app's | 343–511 MB | UNMEASURED | 512 tiles, 64 tok each, ≤1088 tok | UNMEASURED | UNMEASURED | between tokens |
| SmolVLM2-500M × LiteRT-LM (community) | – | (vision int8 in bundle) | 360.8 MB bundle | yes | yes (community) | no bundle | 24 | 20.5 MB AAR + 360.8 MB | text path 404 MB GPU / 584 MB CPU (S26, community); image UNMEASURED | fixed 512², 64 tok | 0.6 s CPU / 1.3 s GPU (text path) | UNMEASURED | `cancelProcess()` |
| SmolVLM(2)-500M × llama.cpp | 820 + 199 MB f16 | 436.8 + 108.8 = 545.6 MB Q8_0 | none published | yes | OpenCL/Vulkan (untested) | Hexagon (untested) | 28 (doc) | self-built `.so` + 545.6 MB | UNMEASURED | mmproj tiling | UNMEASURED | UNMEASURED | abort cb (not during image encode) |
| SmolVLM-256M × ORT/llama.cpp/TFLite | 513 MB bf16 | 259.9 MB ONNX / 278.8 MB GGUF Q8 / 288.3 MB TFLite q8 | 170.5 MB ONNX mixed / 235.0 MB GGUF Q4_K_M + mmproj Q8 (SmolVLM2-256M) | yes | – | no | – | 170–289 MB | <1 GB (paper, desktop GPU); Android UNMEASURED | as SmolVLM | UNMEASURED | UNMEASURED | between tokens |
| Moondream 0.5B × ONNX Runtime (python 0.0.6; ORT-web port) | – | 621.6 MB | 442.4 MB | yes (python) | CUDA EP (python) | no | UNVERIFIED | 442–622 MB | official 996 / 816 MiB (platform unspecified) | 378² crops + global (512² input: one 378² global view, no crops — B8) | UNMEASURED | UNMEASURED | between tokens |

**No candidate has an official or credible Android per-image latency.** The only model I found with an image-inclusive Android TTFT is **FastVLM-0.5B on LiteRT-LM**: 0.55 s GPU / 0.12 s NPU, RSS 1766 / 925 MB, on a Xiaomi 17 Pro Max, from the litert-community card. **It is under Apple's research-only licence, so it is excluded.** Google's Gemma 3n dev guide gives "up to 60 frames per second on a Google Pixel", but that covers the MobileNet-V5 encoder only.

---

## 7. Optional 2025–2026 small VLMs (for narrow closed-answer visual questions)

| Model | Params | Licence | Smallest artifact seen | Flag |
|---|---|---|---|---|
| SmolVLM-256M-Instruct | 256M | Apache-2.0 | ONNX mixed 170.5 MiB; GGUF Q8 + mmproj 278.8 MB | OK, weaker |
| Qwen3.5-0.8B (image-text-to-text) | 873M | Apache-2.0 | GGUF Q4_K_M 532.5 MB + mmproj F16 205.0 MB | OK; new (2026-03), evaluate |
| Qwen3-VL-2B-Instruct | 2.13B | Apache-2.0 | GGUF Q8_0 1.83 GB + mmproj 0.45 GB | OK, large |
| Qwen2.5-VL-3B-Instruct | 3.75B | **Qwen RESEARCH licence (non-commercial)** | – | **EXCLUDE** |
| InternVL3-1B | 938M | card apache-2.0 but license_name "qwen"; README MIT plus Qwen2.5 Apache | GGUF Q8 675 MB + mmproj 333 MB | metadata inconsistent; review |
| InternVL3.5-1B | 1.06B | Apache-2.0 | – | OK |
| Gemma 3n E2B-it | 5.44B raw (E2B effective) | **Gemma Terms** (gated) | LiteRT-LM int4 3.66 GB | custom terms, large |
| Gemma 4 E2B-it | 5.12B raw | **Apache-2.0** (card) | .litertlm 2.01 GB GPU / 2.59 GB CPU | official LiteRT-LM path, large |
| PaliGemma 2 3B | 3.03B | **Gemma Terms** (gated) | – | custom terms |
| LFM2-VL-450M | 451M | **LFM Open License v1.0: commercial use only under USD 10M annual revenue** | GGUF Q4_0 219 MB + mmproj Q8 104 MB | revenue threshold, review |
| LFM2(.5)-VL-1.6B | 1.6B | LFM Open License v1.0 | – | revenue threshold |
| FastVLM-0.5B | 759M | **Apple ML Research licence (research only)** | LiteRT-LM 1.16 GB | **EXCLUDE** |
| PaddleOCR-VL | 959M | Apache-2.0 | litert-community conversion exists | OCR specialist, not VQA |

---

## 8. Open items / not verified here
1. Op coverage of the Moondream 0.5B ONNX graphs under ORT-web 1.30.0, and which skills its config enables. This needs the weights, which another process is fetching.
2. Any Android image-path latency or peak RAM for Florence-2, SmolVLM or Moondream 0.5B. None are published, so they need on-device measurement.
3. Whether ORT-web WASM single-thread can run MatMulNBits q4 and q4f16 graphs correctly. The kernels are present by string, but I didn't execute them. q4f16 targets WebGPU, so prefer q4, int8 or mixed for WASM.
4. Legal review: SmolVLM2's academic-only and NC training sets; FLD-5B source images; BSL on Moondream 3.
5. The community LiteRT SmolVLM2 bundle isn't a Google-supported model. Its card measured no image path.

## 9. Sources (accessed 2026-10-06)
Full list with URLs is in `vlm-audit.json` → `sources`. Main ones:
- HF API: `microsoft/Florence-2-base(-ft)`, `onnx-community/Florence-2-base(-ft)`, `florence-community/*`, `HuggingFaceTB/SmolVLM*`, `ggml-org/SmolVLM*-GGUF`, `litert-community/SmolVLM*`, `vikhyatk/moondream2` (refs, tree/onnx, commits), `moondream/moondream3-preview`
- transformers tags on raw.githubusercontent; arXiv 2311.06242 and 2504.05299
- moondream.ai blog and /models; PyPI moondream and kestrel
- LiteRT-LM repo and AAR; developers.google.com LiteRT-LM overview and MediaPipe LLM Inference page
- llama.cpp `docs/multimodal.md`, `android.md`, `OPENCL.md`, `llama.h`
- ExecuTorch and MLC-LLM trees
- npm onnxruntime-web, @huggingface/transformers, sharp
- litert-community FastVLM card; LFM, Qwen and Gemma licence files
