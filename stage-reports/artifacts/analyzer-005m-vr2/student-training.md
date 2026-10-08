# 005M student training — STUDENT_TRAINING = DEFERRED_ENV (with a measured CPU probe)

**No GPU exists in this container.** It has 4 CPU cores and one 13.36 GiB memory cgroup that also holds `/dev/shm`;
disk was under 1 GB free late in the stage. **No student was trained.**

What exists instead:
- **The dataset format.** The exact format, with generator-exact targets, is implemented in
  `research/analyzer-005m/student_dataset.py`.
  - The generator behind it was corrected after review (vrgen2 2.1.0, `synthetic-corpus.md`).
  - It has ≥ 2,000 / 400 / 400 independent drawings for TRAIN / VAL / SEALED.
- **A CPU probe** of real LoRA optimisation steps (`student_probe.py`, results in §3). It writes no adapter.
- **A plan for a real run:** command, container, memory, duration and export.

Brief §15: a CPU probe is not training, and nothing here is presented as a trained student.

## 1. Dataset (exact format)

`student_dataset.py` writes `train.jsonl` and `val.jsonl` outside the repository, one line per (question, mode):

```json
{"id": "005m:train-compound_front-s1-A-NORMAL-q0|D_MARKED_ROI_PLUS_CROP", "split": "TRAIN", "qid": "...",
 "mode": "D_MARKED_ROI_PLUS_CROP", "cls": "OPEN_SIDE_VS_OPENINGS",
 "images": [{"compose": "compose5.py", "render": "<sceneId>.png", "renderSha256": "<sha256>", "mode": "D_MARKED_ROI_PLUS_CROP"}],
 "promptTemplate": "common.prompt_for(question, mode, composed plan size, target in plan px, bands found on this render)",
 "target": {"answer": "A", "confidence": "HIGH"}, "targetSource": "GENERATOR",
 "teacher": {"probs": {"A": 0.91, "B": 0.07, "UNRESOLVED": 0.02}, "agrees": true, "hardExample": false}}
```

- **Corpus.** It must be vrgen2 ≥ 2.1.0; the script refuses a 2.0.0 corpus. Under 2.0.0, the garage family labelled an
  unmarked front gap "garage door", and the inset family drew an upper-level terrace over a "no upper floor" strip
  (post-review B-2, D-1, D-8).
- **Sizes.** Counts at every level, from TRAIN 125 / VAL 25 / SEALED 25 pairs per family:
  - independent seeds: 1,000 / 200 / 200;
  - drawings (two counterfactual members per seed): **2,000 / 400 / 400**;
  - renders (× 4 rigid transforms): 8,000 / 1,600 / 1,600;
  - questions: 11,000 / 2,200 / 2,200 (exact counts in `synthetic-corpus.md` and `question-corpus.json` →
    `synthetic005M_v2_1`).

  At five modes per question that is **55,000 training lines** and 11,000 validation lines. Transforms are
  augmentations, not new evidence; the counts that matter for generalisation are the seeds and drawings
  (post-review D-3).
- **Exclusions.** SEALED and the bake-off's TEST split never enter the dataset, nor does any real development image.
  The script checks every render's SHA-256 against the TEST and SEALED corpora and stops on a hit. Both corpora are
  required arguments (`--sg-test`, `--sg-sealed`), so the check cannot be skipped (post-review D-16).
- **Targets come only from the generator.** The answer is the scene's truth in that question's letter order, with
  confidence HIGH.
- **The abstention target is generator-exact.** A context-dependent question in A_CROP_ONLY gets UNRESOLVED / LOW.
  - Its crop is byte-identical to its counterfactual twin's, or, for the storey control questions, it shows only the
    ground floor. Either way the crop cannot settle it.
  - This is the property the 005M small models most clearly lack: Qwen3-VL-2B answered UNRESOLVED 0 times in 160
    phase-1 replies.
- **A shortcut that 2.1 does not avoid (D-7, post-review D-13).** A student could learn to abstain from the class, the
  mode or the drawing style rather than from the missing evidence. **In vrgen2 2.1 the class alone decides it**: in
  A_CROP_ONLY, BAY_BACK_CLOSED_VS_DRIVE_THROUGH (1,200 lines over TRAIN + VAL), BODY_REGION (1,200) and STOREY_COVERAGE
  (4,800) are UNRESOLVED on every line, and the four other classes on none. An earlier version of this section said
  every abstaining class also had crop-decidable questions; that was false for 2.1, which lost the only crop-decidable
  BODY_REGION questions when the garage family was rewritten.
  - **Guard.** `student_dataset.py` counts crop-only abstention per class and **refuses to write the set** when any class
    abstains on every line; `--allow-class-shortcut` writes it for inspection only. On 2.1 it refuses.
  - **Before any student run**, a generator revision adds crop-decidable members to the three classes (for example a
    BODY_REGION target inside a walled room, storey questions whose crop panel is the upper plan, a short bay whose back
    wall lies inside the crop), at roughly ≥ 30 % per class.
  - Context questions are trained in all five modes.
  - SEALED evaluation reports abstention per class and per family, against a class × mode lookup baseline that the
    student's abstention must beat.

  Whether abstention carries over to real sheets is untested.
- **The teacher (brief §13) never supplies a label.**
  - Teacher outputs are joined on (question, mode, **render SHA-256**), so an output computed on another drawing under
    the same id is dropped and counted. The 2.0 teacher run has 3 such outputs (`inset_upper` s0–s2 A, redrawn in 2.1)
    (post-review D-15, F2-9).
  - `teacher.probs` is kept only where the teacher's arg-max equals the target letter (`agrees: true`).
  - A disagreement keeps no probabilities and only sets `hardExample: true`. That marks the item to up-weight, or its
    family to re-generate with more seeds.
- **Images are composer recipes.** They are rendered on the fly from the scene render and its hash, so no pixel store is
  needed and every pixel is BuildPlan-generated.
  - The prompt is recomputed at compose time with the real plan size and whether the analyzer found bands on that
    render. Mode E says "no purple marks" when there are none.

## 2. Student candidates and their plans

| route | base | method | why | total deployable footprint (model files; runtime libraries ≈ 10 MB go in the APK) | licence of the base |
| --- | --- | --- | --- | --- | --- |
| **A** | SmolVLM2-500M-Video-Instruct (`7b375e1b`) **or** SmolVLM-500M-Instruct v1 (`a7da5b98`) | full fine-tune, or LoRA r = 16–64 on the LM + connector; vision tower frozen first | tests directly whether 005J's at-chance 500M becomes useful after specialisation; cheapest on device | Q8_0 LM 0.437 GB + Q8_0 vision 0.109 GB = **0.546 GB** (ggml-org listings at `ccd7aae5` / `72e98600`; identical sizes for v1); **class ≤ 1.0 GB**. The adapter is merged before export | **SmolVLM2-500M is not commercially clean.** Its weights are Apache-2.0, but ≈ 77 % of its training mixture comes from academic-only or non-commercial sets (`licensing-matrix.md`, F-1, F-2). **SmolVLM-500M-Instruct v1** (The Cauldron + Docmatix only; 005J's "cleaner base") is the default for route A |
| **B** | the best 2B of the bake-off | LoRA r = 16 on the LM, optionally the merger; vision frozen | the strongest zero-shot reader at deployable size | Qwen3-VL-2B: as run, Q8_0 1.834 GB + F16 vision 0.819 GB = **2.65 GB**; Q4_K_M 1.107 + Q8_0 vision 0.445 = **1.55 GB** (decimal; class 1–2 GB; quality at Q4_K_M unmeasured). InternVL3.5-2B as run: 2.17 + 0.64 = **2.80 GB** | Qwen3-VL: Apache-2.0, data undisclosed. InternVL3.5: Apache-2.0 weights; its card says its reasoning data came from InternVL3-78B, whose Qwen License asks for "Built with Qwen" attribution (F-3) |
| **C** | Gemma 3n E2B / E4B | LoRA on text layers (Unsloth / TRL) | the MatFormer route | **not available** (gated, 401). The stock E2B int4 `.litertlm` is 3.0–3.7 GB, and there is no documented conversion of a vision fine-tune (`gemma-matformer.md`) | Gemma Terms: a fine-tune is a Model Derivative |

**The base selection used the bake-off's TEST split** (phase-1 advancement: 8 TEST questions; route B "the best 2B").
That is why a student is evaluated on **SEALED**, which no model has seen (post-review D-2).

## 3. CPU probe (measured)

`student_probe.py` on SmolVLM2-500M-Video-Instruct (`7b375e1b`; weights in `/dev/shm`, never in the repository).
Record: `student-probe.json`.

| quantity | measured |
| --- | --- |
| setup | LoRA r = 16 / α = 32 on `q,k,v,o,gate,up,down` of the LM, vision frozen; fp32, 4 CPU threads, AdamW lr 2e-4 |
| trainable / total parameters | **9.57 M / 517.1 M** (1.85 %) |
| items | 8 TRAIN items in mode D (two images each), with the generator targets; the processor set to route A's 1,024 px longest edge, with SDPA attention |
| tokens per item | 905–907, of which 15 are reply tokens carrying the loss |
| seconds per optimisation step | **median 31.1 s** (the first two steps 48–50 s, then 28–35 s) |
| peak RSS | **13.1 GB** (12.2 GiB), against the cgroup limit of 14.35 GB (13.36 GiB) |
| loss | 1.27 → 0.03–0.15 over 8 steps on 8 different items. This mostly shows the fixed JSON reply format being learnt; it is not evidence of reading |
| adapter written | **no** |

**Two failed attempts, recorded because they size the plan.**
1. `torchvision` was missing from the venv: SmolVLM's processor imports it. It is now in the lock.
2. With the processor's default 2,048 px, each item became ≈ 2,400 tokens, and the probe was killed by the memory
   cgroup. That is the reason route A sets 1,024 px (§4).

**What it implies.**
- **On this CPU.** One epoch over the 55,000 lines would take 55,000 × 31 s ≈ **474 hours**, three epochs ≈ 1,420 hours.
  One epoch over mode D alone (11,000 lines) would still take ≈ 95 hours, at a peak memory that leaves no room for
  anything else. **STUDENT_TRAINING = DEFERRED_ENV** is a measured conclusion, not a default.
- **On a GPU.** §4's estimate assumes 0.08–0.15 s per sample: about 200–400× this CPU. That is plausible for a 0.5 B
  model in bf16 on a 4090-class GPU, but it was not measured here.

## 4. Command and container for a real run (a GPU environment the OWNER authorises)

- **Container.** `pytorch/pytorch:2.11.0-cuda12.8-cudnn9-devel` (or the matching `nvcr.io/nvidia/pytorch` release),
  plus `transformers==4.57.6 peft==0.17.1 trl accelerate pillow shapely`. The research venv lock is
  `research/analyzer-005m/requirements-venv.lock.txt`; add `trl`.
- **Data.**

  ```bash
  python -I -B research/analyzer-005m/synthetic/vrgen2.py --out $W/sg-v21 --splits TRAIN,VAL,SEALED --pairs 125,25,25
  # the pool for TRAIN, then the dataset; TEST (2.0.0) and SEALED are checked against, never included
  python -I -B research/analyzer-005m/corpus.py --work $W --repo . --synth-global $W/sg-test/corpus.json \
      --synth-train $W/sg-v21/corpus.json --pool-name pool-v21.json
  python -I -B research/analyzer-005m/student_dataset.py --pool $W/corpus/pool-v21.json --sg-trainval $W/sg-v21/corpus.json \
      --sg-test $W/sg-test/corpus.json --sg-sealed $W/sg-v21/corpus.json --out $W/student
  ```

  In the last command, SEALED scenes in `sg-v21` are recognised by their split, and their hashes are refused. On 2.1 the
  command stops at the class-shortcut guard (§1). No teacher option is given: the 8B did not pass the teacher screen
  (`teacher-feasibility.md`). A teacher that does pass is added with `--teacher <run.jsonl> --teacher-pool <the pool its
  items were composed from>`.
- **Image tokens and sequence length (D-10).** The SmolVLM processor's default resizes the longest edge to 2,048 px
  and splits it into 512 px tiles: 16 tiles + a global view = **1,088 tokens per image**.
  - A mode-D item (two images) is then ≈ 2,400 tokens, over a 2,048 maximum length.
  - Route A therefore sets `size.longest_edge = 1024`: 2 × 2 tiles + a global view = 320 tokens per image, ≈ 860
    tokens for mode D. Maximum length is 1,536.
  - Every composed image is at most 768 px, so this still upsamples rather than discards pixels.
  - The CPU probe (§3) ran with `longest_edge = 1024`, the setting route A would use, so its timings are not a worst
    case; the default 2,048 px ran out of memory on this CPU (post-review D-17, F2-10).
- **Training (route A).** Standard TRL `SFTTrainer`.
  - A vision collator renders each recipe with compose5's functions and masks the prompt, so loss falls on the reply
    tokens only.
  - bf16, LoRA r = 32 / α = 64 on `q,k,v,o,gate,up,down` of the LM, vision tower frozen.
  - lr 2e-4 cosine, 3 epochs, effective batch 16.
- **Model selection (C-8).** Choosing by CONFIDENT_WRONG_RATE alone can be won by abstaining more, so select on VAL by
  CONFIDENT_WRONG_RATE **at a coverage floor**: at least 80 % of the decidable questions answered.
  - The abstention rate on context-dependent mode-A questions is reported alongside.
  - Any confidence threshold is frozen on VAL, and SEALED is read once, at the end.
- **Route B** is the same with `Qwen/Qwen3-VL-2B-Instruct@89644892`: LoRA r = 16, gradient checkpointing, effective
  batch 8. D and E items carry two images, ≈ 776 image tokens; Qwen's native 32 px per token needs no resize setting.
- **Memory (estimates with stated assumptions; not measured on a GPU).**
  - Route A, bf16 LoRA (post-review D-9, itemised):
    - weights in bf16 ≈ 1.0 GB;
    - LoRA r = 32 parameters, gradients and Adam states in fp32 ≈ 0.3 GB;
    - LM activations with gradients for ~900 tokens at batch 8 ≈ 4–6 GB;
    - frozen vision-tower forward activations ≈ 0.5–1 GB;
    - CUDA context and allocator fragmentation ≈ 1–2 GB;
    - total ≈ 7–10 GB → plan for **8–12 GB** (a T4 / L4 class GPU).
  - Route B, bf16 LoRA with checkpointing: weights ≈ 4.3 GB + activations ≈ 6–10 GB → **16–24 GB** (L4 / A10 / 4090).
    QLoRA 4-bit cuts this to ≈ 8–12 GB.
- **Duration (estimate).** 55,000 lines × 3 epochs ≈ 165,000 samples.
  - Route A at ~0.08–0.15 s per sample on a 4090-class GPU → **≈ 4–7 h**.
  - Route B at ~0.3–0.5 s per sample → **≈ 14–23 h**. Training on one or two modes per question (D and A) cuts this
    by 2.5–5×.
  - The CPU figures in §3 show why it is not run here.
- **Outputs (outside the repository).**
  - `student/<route>/checkpoint-*/adapter_model.safetensors` + `adapter_config.json`;
  - `student/<route>/merged/` (the merged HF checkpoint);
  - `student/<route>/gguf/` (export below);
  - `student/<route>/eval/*.jsonl`.

  The `research-isolation` 005M gate and `history_gate.sh` refuse all of them in Git, by name and by magic bytes.
- **Quantisation and export.**
  1. Merge the adapter (`peft merge_and_unload`).
  2. `convert_hf_to_gguf.py --outtype q8_0` (LM) and `--mmproj --outtype f16` (vision), at the llama.cpp commit of
     this stage.
  3. `llama-quantize … Q4_K_M` for the smaller class.
  4. Re-run the 005M bake-off on the exported GGUF: the same items, the same server, the same scorer.
  - **Android.** llama.cpp arm64 with `libmtmd`; the Kotlin sample is text-only, so the image path needs JNI work.
    LiteRT applies only to the Gemma route, and is blocked there today.

## 5. Evaluation contract for any trained student (brief §16)

1. **SEALED** (vrgen2 2.1.0, 400 drawings, never shown to any model, teacher or student). Report
   CONFIDENT_WRONG_RATE at the VAL-frozen operating point, accuracy, coverage, context gain A → C/D/E, abstention per
   class and family against the class × mode lookup baseline, and mirror / rotation consistency.
   - **Context pairs in mode A are scored per pair (D-4 residual).** A lucky guess on one member is not credit: a
     context pair counts as right in A_CROP_ONLY only when both members answer UNRESOLVED, the target the student is
     trained on.
   - **Which confidence (post-review C2-7).** Every decidable target is trained with confidence HIGH, so a student's
     stated confidence would again make CONFIDENT_WRONG_RATE its error rate. For a student, CONFIDENT_WRONG is defined
     as *a wrong answer whose option probability is ≥ t\**, with t\* frozen on VAL, and the coverage at t\* is always
     reported beside it.
2. **The bake-off's TEST questions** (2.0.0, minus the excluded items), for a before/after comparison with the
   zero-shot models on the same items. It was used for model selection, so it is not a clean test.
3. **Real development images, evaluation only.** The 005M PHASE2 real subset: 97 questions across REAL_DEV,
   ROUND8_DEV, MURAJACH_DEV, STOREY_DEV and GAPSET_DEV.
   - Report human-authored truth (70) and AI-authored truth (27: the 005K subagent majority and 005M's own
     murajach / storey labels) separately (D-4).
   - No real crop is trained on.
4. **What the pass bar can and cannot show (C-4, D-4).** 005J's bar was CONFIDENT_WRONG_RATE ≤ 0.5 % per class (target
   0.2 %) **as the 95 % upper bound on n questions**, mirror / rotation consistency ≥ 99 %, and an advantage over the
   deterministic rule it would replace.
   - **Sample size.** With zero errors, the 95 % upper bound reaches 0.5 % only at n ≥ 598 (exact one-sided) or 765
     (Wilson) questions **per class**; one error needs ≈ 1,130.
   - **The real set falls far short.** Its classes have 2–17 questions, so zero errors in 17 still bounds the rate at
     ≈ 18 %.
   - **Mirror consistency.** ≥ 99 % needs ≥ 381 flip-free pairs; the bake-off has 14 after exclusions.
   - **Consequence.** On real data the bar can only be screened here: report observed errors and the Wilson upper
     bound. Demonstrating it needs a frozen real evaluation set of that size, which is a separate stage.
   - **SEALED.** It holds 2,200 questions, 200–800 per class (STOREY_COVERAGE 800), but only 50–100 independent drawings
     per class, so the bar is not demonstrable per class there either.
     The generator scales with `--pairs`, so a larger sealed split can be drawn when a student is ready to be judged.
