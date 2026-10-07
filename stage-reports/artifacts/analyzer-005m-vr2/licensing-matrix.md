# 005M licensing matrix — code, weights, training data, derivatives, runtime, redistribution

Read live on 2026-10-07 from the model repositories (Hugging Face API snapshots kept outside the repository), their model
cards and technical reports, the runtimes' LICENSE files and the dataset cards. A research sub-agent gathered the
dataset-card and terms facts and gave a source URL for each. The rows marked † were checked again here against the API
snapshots. **This is engineering due diligence, not legal advice. Every commercial route stays CONDITIONAL on counsel.**

**Apache-2.0 metadata on a model does not settle the training data** (brief §19).
- Every candidate except Gemma carries an Apache-2.0 *weights* tag.
- None of them publishes an itemised, licence-checked list of its training data.
- SmolVLM2 publishes enough to show that part of its mixture is non-commercial or academic-only (§3).

## 1. Matrix

| item | code licence | weights licence | gated | training-data provenance | quantised derivative | runtime | redistribution in an app AI pack |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Qwen3-VL-2B / 4B / 8B / 32B-Instruct** | Apache-2.0 (transformers `qwen3_vl`; QwenLM/Qwen3-VL LICENSE) | Apache-2.0 tag† on all repos; **no LICENSE or NOTICE file in the HF repos**; Apache text in the GitHub repo | no† | **Not itemised.** Tech report (arXiv 2511.21631): web image–caption pairs re-captioned by Qwen2.5-VL-32B; "3 million PDFs from Common Crawl" + "4 million internal documents"; "30 million in-house" OCR samples; COCO / Objects365 / OpenImages / RefCOCO / PixMo grounding; SFT from "open-source datasets and web resources"; RL from "open-source and proprietary sources" | Qwen's own GGUF repos are Apache-2.0† (`base_model:quantized`, `general.license = apache-2.0` in the header). The bake-off ran these bytes | llama.cpp (MIT) | Apache-2.0 §4: ship the licence text, keep notices, mark changes; no NOTICE file exists, so §4(d) adds nothing. **Data rights unverified** |
| **SmolVLM2-2.2B-Instruct** (and 500M) | Apache-2.0 (transformers `smolvlm`) | Apache-2.0 ("We release the SmolVLM2 checkpoints under the Apache 2.0 license")†; no LICENSE / NOTICE file | no† | **Partly disclosed, and partly non-commercial.** 3.3 M samples from 10 sets, built on SmolVLM v1 (The Cauldron + Docmatix). The dataset cards say: ShareGPT4Video **CC-BY-NC-4.0** (+ OpenAI terms); Vript **academic use only**; LLaVA-OneVision-Data tagged Apache-2.0 but "only … academic research and education"; LLaVA-Video-178K the same; MovieChat-1K "non-commercial use only" (project README); The Cauldron's sub-sets keep their own licences (ChartQA GPL-3.0, Hateful Memes behind an agreement); Docmatix MIT but built from PDFA (`license: other`, Common Crawl terms) | GGUF **converted here** from the pinned revision (llama.cpp script, MIT). A derivative of Apache-2.0 weights: keep the licence and mark the modification | llama.cpp (MIT) | Apache-2.0 §4 on the weights; the **training-data restrictions are the counsel question** (a model trained on NC data is not itself NC-licensed, but provenance is not clean) |
| **InternVL3.5-2B-Instruct** | **MIT** (bundled `modeling_*.py` headers; GitHub LICENSE); the HF repo has no LICENSE file | Apache-2.0 tag† ("released under the apache-2.0 License … uses the pre-trained Qwen3"); lineage InternViT-300M (MIT) + Qwen3-1.7B (Apache-2.0) | no† | **Not itemised.** Tech report (arXiv 2508.18265): ~116 M pre-training samples and ~56 M SFT samples from InternVL3 / InternLM corpora and open sets; "thinking" data generated with InternVL3-78B and DeepSeek-R1; RL on MMPR (MIT). **The InternVL-Data release was withdrawn "due to the company policy"** | GGUF **converted here**. The model card's own ImageNet mean/std were supplied to the converter (outside the repository), because the repo ships no `preprocessor_config.json` | llama.cpp (MIT) | MIT notice (code) + Apache-2.0 §4 (weights); data rights unverified |
| **Gemma 3n E2B-it / E4B-it** (not run) | Apache-2.0 (transformers `gemma3n`) | **Gemma Terms of Use** (`license:gemma`; terms last modified 2026-04-01). The 2024→2026 diff changes only how "Gemma" is defined (now an Appendix that lists Gemma 3n) | **yes, "manual"**†: an unauthenticated request for the pinned revision's `config.json` returned **401** here | **Not itemised.** "approximately 11 trillion tokens" of web, code, maths, images and audio, cut-off June 2024 | "Model Derivatives" covers modifications, works based on Gemma and **distillation** from it, so a BuildPlan fine-tune or a sliced MatFormer is a Model Derivative. Google's own int4 LiteRT builds are `license:gemma` and gated | LiteRT / LiteRT-LM (Apache-2.0) | §3.1: the §3.2 use restrictions go into the end-user agreement as an enforceable provision; ship a copy of the Terms and a `Notice` file; mark modified files; Google "reserves the right to restrict (remotely or otherwise) usage"; delete all copies on termination. **Gemma 4 is Apache-2.0** (a later family; not in this stage's candidate list) |
| llama.cpp / ggml (runtime) | MIT (© 2023–2026 the ggml authors); bundled third-party notices (`licenses/`) | — | — | — | — | — | ship the MIT notice plus the vendored notices |
| LiteRT / LiteRT-LM (runtime, Gemma route) | Apache-2.0; no root NOTICE | — | — | — | — | — | licence text |
| ONNX Runtime (BuildPlan's current WASM runtime) | MIT + `ThirdPartyNotices.txt` | — | — | — | — | — | already shipped by 005H |
| MLC-LLM (alternative runtime) | Apache-2.0 **with a NOTICE file** (plus vendored TVM NOTICE) | — | — | — | — | — | §4(d) applies: reproduce the NOTICE |

## 2. Training-data provenance of BuildPlan's own route

| data | origin | licence status | allowed use in 005M |
| --- | --- | --- | --- |
| 005M synthetic corpus (TRAIN 2,112 / VAL 480 / TEST 480) | `vrgen2.py` + the 005J rasteriser, BuildPlan code, generator truth | **BuildPlan-owned** | training (TRAIN), selection (VAL), sealed evaluation (TEST) |
| 005J synthetic counterfactuals | `vrgen.py`, BuildPlan code | BuildPlan-owned | evaluation in this stage |
| REAL_DEV, ROUND8_DEV, MURAJACH_DEV, STOREY_DEV, GAPSET_DEV | publisher drawings (ARCHON, DobreDomy) read from sealed caches outside the repository | third-party copyright | **evaluation only, never training**. Pixels never enter the repository, a teacher's training-side input, or a student dataset (`student_dataset.py` asserts it) |
| teacher outputs (Qwen3-VL-8B) | Apache-2.0 model, local CPU inference | outputs of an Apache-2.0 model; no Gemma-style output clause | soft targets only where the teacher agrees with the generator truth; hard-example flags otherwise; never a label |

## 3. What this means for a recommendation

1. **Qwen3-VL (any size).** The cleanest weight licence among the candidates: Apache-2.0, ungated, quantised by the
   publisher. Its data provenance is undisclosed, not known-dirty. A pack needs the Apache-2.0 text and attribution; no
   NOTICE file exists.
2. **SmolVLM2.** The licence is clean but the provenance is visibly mixed with NC / academic-only sets. That is a
   counsel item before any shipping use. For research and teacher use there is no issue.
3. **InternVL3.5.** MIT + Apache-2.0, and its training data was withdrawn from public access. Undisclosed, like Qwen.
4. **Gemma 3n.** Shippable only under the Gemma Terms' pass-through obligations and Google's reserved right to
   restrict use. A fine-tune or MatFormer slice is a Model Derivative under the same terms. Access is gated and was not
   available here.
5. **No route needs a real publisher image for training.** The commercial-clean training route stays BuildPlan's
   synthetic data (005J's conclusion), now with generator-exact abstention targets (`student-training.md`).

## 4. Unverified (stated, not assumed)

- Whether a quantised checkpoint is an Apache-2.0 "Derivative Work" or only "Object form". No publisher addresses it;
  the obligations are the same either way for attribution.
- The licence of every Cauldron sub-dataset (only ChartQA and Hateful Memes were checked), and MovieChat-1K's data licence.
- Whether any Qwen3-VL or InternVL3.5 SFT/RL data is non-commercial. Neither publishes an itemised list.
- The meaning of `gated: "manual"` for Gemma 3n against the page's "requests are processed immediately". Here, the
  request was simply refused without a credential.
