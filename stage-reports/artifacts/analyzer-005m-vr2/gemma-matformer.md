# Gemma 3n MatFormer special audit (brief §18)

**Status: AUDITED FROM PRIMARY SOURCES, NOT RUN.** `google/gemma-3n-E2B-it` and `-E4B-it` are gated (`gated: "manual"`).
At the pinned revision (`5e092ebc…` for E2B) an unauthenticated request for `config.json` returned **401** in this
container. No Hugging Face credential exists in this environment and none was created; the platform's own session
tokens were not used. Brief §3: absence is not a stage blocker. Nothing below was
measured on Gemma weights; every number is a publisher figure with its source. A research sub-agent read the sources
on 2026-10-07.

## 1. E2B / E4B: raw vs effective parameters

| | E2B-it | E4B-it | source |
| --- | --- | --- | --- |
| raw parameters (BF16 checkpoint) | **5,439,438,272** | **7,849,978,192** | HF API `?expand[]=safetensors` |
| "effective" parameters | "just under 2 billion (1.91B)" | ~4 B | ai.google.dev/gemma/docs/gemma-3n |
| what "effective" means | Per-Layer Embeddings (PLE) are "loaded and computed efficiently on the CPU". Only the core transformer weights (~2 B / ~4 B) "need to sit in … accelerator memory". PLE "can be cached to fast storage" | same | Gemma 3n developer guide (developers.googleblog.com) |
| claimed memory | "as little as 2GB (E2B) and 3GB (E4B)" | | developer guide |
| vision encoder | MobileNet-V5-300M (KerasHub 294.28 M). Native 256 / 512 / 768 px; **256 tokens per image** at any resolution | same | dev guide, model card |
| audio encoder | USM-based, 6.25 tokens/s, clips ≤ 30 s at launch | same | HF blog |
| context | 32 K | 32 K | model card |

For BuildPlan: 256 image tokens per image at most is a hard cap on what the model can see. For comparison, 005M fed
Qwen3-VL-2B 576 tokens for a 768 px plan, and 005J found 64 tokens of SmolVLM2-500M far too coarse for 1–3 px gap
lines.

## 2. Does E4B contain E2B? Mix-and-Match

- **Yes, by construction.** "During the MatFormer training of the … E4B model, a 2B effective parameter (E2B)
  sub-model is simultaneously optimized within it." The released E2B is "a standalone E2B sub-model which we have
  already extracted for you" (developer guide). The HF blog says "trained together, configuring E2B as a sub-model of
  E4B".
- **Mix-n-Match.** Sizes between E2B and E4B are made by slicing E4B: "adjusting the feed forward network hidden
  dimension per layer (from 8192 to 16384) and selectively skipping some layers".
  - E4B: 35 layers, FFN 16,384.
  - E2B: 30 layers, FFN 8,192, layers 20–24 skipped.
  - Google publishes ready-made configurations from E1.96B to E3.79B, with pre-trained MMLU from 50.9 % (E2B) to
    62.3 % (E4B) (`google/gemma3n-slicing-configs`).
  - Runtime elastic switching is "not part of today's launched implementations".
- **Tooling.** "MatFormer Lab", a Colab in `google-gemini/gemma-cookbook`, slices the safetensors (FFN columns, dropped
  layers) and pushes a Hugging Face checkpoint.
  - Its source dropdown offers only `google/gemma-3n-E4B-it` and `-E4B-pt`.
  - The cookbook repository now carries a deprecation notice ("no longer actively maintained").

## 3. Can a BuildPlan fine-tune be exported into a smaller nested submodel?

**Not proven, and not provable here.**
- **No Google statement covers the order fine-tune → slice.** None says that fine-tuning E4B keeps the nested E2B path
  trained, or that slicing a fine-tuned E4B yields a usable E2B. The MatFormer sections of the developer guide do not
  mention fine-tuning.
- **The slicing code runs on any E4B-shaped checkpoint, but that proves nothing about quality.** A LoRA or full
  fine-tune updates the full-width FFN without the nested-loss training that kept E2B usable in pre-training. Unless
  the fine-tune also optimised the nested widths (MatFormer-style multi-granularity loss), the sliced sub-model's
  quality is an open empirical question.
- **What would prove it** (the plan, for an environment with access and a GPU):
  1. fine-tune E4B with a joint loss on the full and the E2B-width forward passes (MatFormer's own objective), on
     BuildPlan synthetic data only;
  2. slice to E2B and to one Mix-n-Match size with the published configs;
  3. evaluate full / sliced / stock-E2B-fine-tuned on the sealed synthetic test and the real development set with the
     005M scorer;
  4. call it proven only if the sliced model's CONFIDENT_WRONG_RATE and accuracy match a directly fine-tuned E2B
     within the Wilson intervals.
- **Fine-tuning routes that exist.**
  - HF transformers / TRL notebooks for text, multimodal, audio and video, labelled for a free T4.
  - Unsloth notebooks. Text layers only by default; tuning the vision or audio towers needs "much more VRAM – beyond the
    15GB free Colab or Kaggle provides". The vision encoder takes no gradient checkpointing. On fp16 GPUs (T4) there are
    NaNs unless patched.
  - KerasHub `Gemma3nBackbone(enable_lora=True)`.
  - Google's own QLoRA vision guide now targets Gemma 4 (bf16 GPU, more than 16 GB, more than 30 GB RAM for merging).
  - No Vertex AI Gemma 3n fine-tuning page was found.

## 4. Android route: LiteRT-LM, and the artifacts that exist today

- **Runtime.** MediaPipe LLM Inference is in "maintenance-only mode", with migration to **LiteRT-LM (Kotlin)**
  recommended. The target devices are "Pixel 8 and Samsung S23 or later".
- **Published artifacts.** Google's own, int4 weights, `license:gemma`, gated:

| artifact | bytes |
| --- | --- |
| `gemma-3n-E2B-it-int4.litertlm` | 3,655,827,456 |
| `gemma-3n-E2B-it-int4-Web.litertlm` | 3,038,117,888 |
| `gemma-3n-E4B-it-int4.litertlm` | 4,919,541,760 |
| E2B preview `.task` | 3,136,226,711 |
| E4B preview `.task` | 4,405,655,031 |

  - The current `-litert-lm` cards list text, vision and audio input; the preview `.task` files were text + vision.
- **Published speed** (LiteRT-LM cards, prefill / decode tok/s):
  - E2B on S24 Ultra: CPU 110.5 / 16.1, GPU 816.4 / 15.6.
  - E4B on S24 Ultra: CPU 73.5 / 9.2.
  - Preview, S25 Ultra, 1,024-token prefill: E2B CPU time-to-first-token 6.7 s at 2,704 MB peak RSS.
  - "Vision encoder is always run on GPU with 512x512 resolution". **No published time-to-first-token includes an
    image.**
- **Device floor.** The AI Edge Gallery allowlist asks for 8 GB RAM for E2B and 12 GB for E4B, with image and audio
  enabled.
- **Converting a custom fine-tune.**
  - `litert-torch export_hf` lists `Gemma3nForCausalLM` (text only); `--export_vision_encoder` is listed only for
    Gemma 3 and Gemma 4.
  - Google's fine-tune → LiteRT-LM tutorial uses Gemma 270M, text only.
  - Open issues: an E4B export that emits only `<pad>` (litert-torch #994); unanswered requests to convert a fine-tuned
    Gemma 3n (#750, LiteRT-LM #547).
  - **There is no documented path today that converts a vision-capable Gemma 3n fine-tune to LiteRT-LM.**
- **llama.cpp route.**
  - llama.cpp's multimodal docs do not list Gemma 3n vision, and ggml-org's Gemma 3n GGUFs ship no mmproj.
  - The source this stage built (`988190680d5a`) does contain a Gemma 3n vision projector (`PROJECTOR_TYPE_GEMMA3NV`,
    a MobileNet-V5 graph, a fixed 16 × 16 token output, `<start_of_image>` markers).
  - That path is **untested here** (no weights) and undocumented upstream.
- **Play delivery.** One E2B `.litertlm` (3.0–3.7 GB) exceeds the 1.5 GB per-AI-pack limit of Play for On-device AI
  (4 GB cumulative app size). Splitting one `.litertlm` across packs is not documented.

## 5. Licence of a fine-tuned or sliced derivative

Gemma Terms of Use (last modified 2026-04-01):
- **Coverage.** "Model Derivatives" = modifications, works based on Gemma, and models trained by distillation from it.
  A BuildPlan fine-tune or a MatFormer slice is a Model Derivative; outputs are not.
- **Redistribution obligations** in an app (§3.1):
  - make the §3.2 use restrictions an enforceable provision of the end-user agreement;
  - ship a copy of the Terms;
  - mark modified files;
  - include a `Notice` file with the required sentence.
- **Remote control.** §3.2: "To the maximum extent permitted by law, Google reserves the right to restrict (remotely
  or otherwise) usage of any of the Gemma Services that Google reasonably believes are in violation of this Agreement."
  - §3.2 also incorporates the Prohibited Use Policy, which Google "reserves the right to update". The restricted-use
    list a shipped pack passes through can therefore change after release.
  - Termination requires deleting all copies.
  - For a removable AI pack this is a business-continuity term, not only an attribution one (`licensing-matrix.md`;
    post-review F-5).
- **The later family is different.** Gemma 4 is **Apache-2.0** (its E2B is "2.3B effective (5.1B with embeddings)").
  Its card does not mention MatFormer, and it is outside this stage's candidate list.

## 6. Verdict for BuildPlan

| question | answer |
| --- | --- |
| E2B raw / effective | 5.44 B raw, 1.91 B effective (PLE off-accelerator) |
| E4B contains E2B | yes, trained jointly (MatFormer); E2B is the released extract |
| Mix-n-Match tooling | MatFormer Lab notebook (deprecated repo), published slicing configs |
| fine-tune → nested submodel export | **unproven**; no publisher statement; needs a MatFormer-objective fine-tune and the evaluation in §3 |
| LiteRT Android route, artifact size | stock int4 `.litertlm` 3.0–3.7 GB (E2B); **no documented conversion of a vision fine-tune** |
| commercial / redistribution | Gemma Terms pass-through + remote-restriction clause + gating; Model Derivatives cover fine-tunes and slices |
| status in 005M | `NOT_RUN_ACCESS_GATED`; a Gemma student is **not** the recommended first student (`student-training.md`) |
