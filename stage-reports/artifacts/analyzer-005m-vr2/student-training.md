# 005M student training — STUDENT_TRAINING = DEFERRED_ENV (with a measured CPU probe)

**No GPU exists in this container** (4 CPU cores, 16 GB RAM in one memory cgroup that also holds `/dev/shm`, about
1 GB of free disk at the end). **No student was trained.**

What exists instead:
- the exact dataset format, with generator-exact targets, implemented: `research/analyzer-005m/student_dataset.py`;
- a CPU probe of one real LoRA optimisation step: `student_probe.py`, results in §3. It writes no adapter.
- the command, container, memory, duration and export plan for a real run.

Brief §15: a CPU probe is not training, and nothing here is presented as a trained student.

## 1. Dataset (exact format)

`student_dataset.py` → `train.jsonl` / `val.jsonl`, outside the repository, one line per (question, mode):

```json
{"id": "005m:train-garage_vs_carport-s3-A-NORMAL-q0|A_CROP_ONLY", "split": "TRAIN", "qid": "...", "mode": "A_CROP_ONLY",
 "cls": "GARAGE_DOOR_VS_CARPORT",
 "images": [{"compose": "compose5.py", "render": "<sceneId>.png", "renderSha256": "<sha256>", "mode": "A_CROP_ONLY"}],
 "promptTemplate": "common.prompt_for (recomputed with the composed plan size)",
 "target": {"answer": "UNRESOLVED", "confidence": "LOW"}, "targetSource": "GENERATOR_ABSTAIN",
 "teacher": {"probs": {"A": 0.61, "B": 0.37, "UNRESOLVED": 0.02}, "agrees": false}}
```

- **Sizes.** 2,112 TRAIN and 480 VAL questions × 5 modes = **10,560 training lines and 2,400 validation lines**. The
  sealed 480-question TEST split and every real development image are excluded; the script asserts it.
- **Targets come only from the generator.** The answer is the scene's truth in that question's letter order, with
  confidence HIGH.
- **The abstention target is generator-exact.** A context-dependent question in A_CROP_ONLY gets UNRESOLVED / LOW: its
  crop is byte-identical to its counterfactual twin's, so the crop provably cannot decide it.
  - 1,056 TRAIN questions are context-dependent → 1,056 abstention lines.
  - This is the one property the 005M small models most clearly lack: Qwen3-VL-2B answered UNRESOLVED **0** times in
    160 phase-1 replies.
- **The teacher (brief §13) never supplies a label.**
  - `teacher.probs` is kept as a soft target only where the teacher's arg-max equals the generator target
    (`agrees: true`).
  - A disagreement marks a hard example (up-weighted, or re-generated with more seeds of its family) and is never a
    label.
- **Images are composer recipes.** They are rendered on the fly from the scene render and its hash; no pixel store is
  needed. Every pixel is BuildPlan-generated.

## 2. Student candidates and their plans

| route | base | method | why | total deployable footprint (not "adapter size") |
| --- | --- | --- | --- | --- |
| **A** | SmolVLM2-500M-Video-Instruct (`7b375e1`) | full fine-tune or LoRA r=16–64 on the LM + connector; vision tower frozen first | tests directly whether 005J's at-chance 500M becomes useful after specialisation; cheapest on device | base 507 M params: Q8_0 ≈ 0.44 GB LM + 0.19 GB vision (F16) ≈ **0.65 GB**; with Q4_K_M LM ≈ 0.45 GB, **class ≤ 1.0 GB**. The adapter (≈ 10–40 MB) is merged before export |
| **B** | the best 2B of the bake-off | LoRA r=16 on the LM, optionally the merger; vision frozen | the strongest zero-shot reader at deployable size | Qwen3-VL-2B: Q8_0 1.83 GB + mmproj F16 0.82 GB = **2.65 GB**; Q4_K_M 1.11 GB + mmproj Q8_0 0.45 GB = **1.56 GB** (class 1–2 GB). InternVL3.5-2B: Q8_0 2.17 + 0.64 = **2.80 GB** |
| **C** | Gemma 3n E2B / E4B | LoRA on text layers (Unsloth / TRL) | the MatFormer route | **not available** (gated, 401). Stock E2B int4 `.litertlm` is 3.0–3.7 GB. No documented conversion of a vision fine-tune (`gemma-matformer.md`) |

## 3. CPU probe (measured)

(Filled from `student_probe.py`; see §3a below once run.)

## 4. Command and container for a real run (a GPU environment the OWNER authorises)

- **Container.** `pytorch/pytorch:2.11.0-cuda12.8-cudnn9-devel` (or the matching `nvcr.io/nvidia/pytorch` release),
  plus `transformers==4.57.6 peft==0.17.1 trl accelerate pillow shapely`. The research venv lock is
  `research/analyzer-005m/requirements-venv.lock.txt`; add `trl` and `accelerate`.
- **Data.**

  ```bash
  python -I -B research/analyzer-005m/corpus.py --work $W --repo . --synth-global $W/sg-test/corpus.json \
      --synth-train $W/sg-trainval/corpus.json --pool-name pool-with-train.json
  python -I -B research/analyzer-005m/student_dataset.py --pool $W/corpus/pool-with-train.json \
      --sg-trainval $W/sg-trainval/corpus.json --out $W/student [--teacher $W/runs/teacher-train.jsonl]
  ```

- **Training (route A, SmolVLM2-500M LoRA).** Standard TRL `SFTTrainer`. A vision collator renders each recipe with
  compose5's functions and masks the prompt, so loss falls on the reply tokens only.
  - bf16, LoRA r=32 / α=64 on `q,k,v,o,gate,up,down` of the LM, vision tower frozen.
  - lr 2e-4 cosine, 3 epochs, effective batch 16, max length 2,048.
  - Early stopping on VAL CONFIDENT_WRONG_RATE (the 005M scorer), not on loss.
- **Route B** is the same with `Qwen/Qwen3-VL-2B-Instruct@89644892`: LoRA r=16, gradient checkpointing, effective
  batch 8. D and E items carry two images, about 780 image tokens.
- **Memory (estimates, stated assumptions; not measured on a GPU).**
  - Route A bf16 LoRA: weights ≈ 1.0 GB + activations for ~600–900 tokens at batch 8 ≈ 4–6 GB → **8–12 GB**
    (a T4 / L4 class GPU).
  - Route B bf16 LoRA with checkpointing: weights ≈ 4.3 GB + activations ≈ 6–10 GB → **16–24 GB** (L4 / A10 / 4090).
    QLoRA 4-bit cuts it to ≈ 8–12 GB.
- **Duration (estimate).** 10,560 lines × 3 epochs ≈ 31,700 samples.
  - Route A at ~0.08–0.15 s/sample on a 4090-class GPU → **≈ 45–80 min**.
  - Route B at ~0.3–0.5 s/sample → **≈ 2.5–4.5 h**.
  - CPU extrapolations from §3 show why it is not run here.
- **Outputs (outside the repository).** `student/<route>/checkpoint-*/adapter_model.safetensors` + `adapter_config.json`,
  `student/<route>/merged/` (merged HF checkpoint), `student/<route>/gguf/` (export below) and
  `student/<route>/eval/*.jsonl`. The `research-isolation` 005M gate and `history_gate.sh` refuse all of them in Git.
- **Quantisation and export.**
  1. Merge the adapter (`peft merge_and_unload`).
  2. `convert_hf_to_gguf.py --outtype q8_0` (LM) and `--mmproj --outtype f16` (vision), at the llama.cpp commit of
     this stage.
  3. `llama-quantize … Q4_K_M` for the size class below 1 GB.
  4. Re-run the 005M bake-off on the merged GGUF: the same items, the same server, the same scorer.
  - Android: llama.cpp arm64 with `libmtmd` (the Kotlin sample is text-only, so the image path needs JNI work).
    LiteRT applies only to the Gemma route, and is blocked there today.

## 5. Evaluation contract for any trained student (brief §16)

1. **Sealed synthetic TEST** (480 questions, never seen by teacher or student): CONFIDENT_WRONG_RATE, accuracy,
   coverage, context gain A → C/D/E, mirror / rotation consistency, before vs after.
2. **Real development images, evaluation only** — the 005M PHASE2 real subset (97 questions: REAL_DEV, ROUND8_DEV,
   MURAJACH_DEV, STOREY_DEV, GAPSET_DEV). Same metrics, before vs after. No real crop is trained on.
3. **Pass bar** (inherited from 005J): CONFIDENT_WRONG_RATE ≤ 0.5 % per class on the real set (target 0.2 %), mirror /
   rotation ≥ 99 %, and an advantage over the deterministic rule it would replace, measured, not assumed.
