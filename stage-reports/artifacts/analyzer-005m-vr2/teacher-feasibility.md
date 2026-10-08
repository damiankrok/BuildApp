# 005M teacher feasibility — TEACHER_EXECUTION = RUN (CPU subset)

**Teacher:** `Qwen/Qwen3-VL-8B-Instruct`, run from the publisher's own GGUF (`Qwen/Qwen3-VL-8B-Instruct-GGUF@f982a075`).
- **Quantisation:** LLM Q4_K_M 5.03 GB + vision F16 1.16 GB. Both files matched the hub's LFS SHA-256.
- **Runtime:** CPU, the same llama.cpp server and the same items as the bake-off.
- **Optional larger teacher:** Qwen3-VL-32B is `DEFERRED_ENV`. It has 66.7 GB of BF16 weights; there is no GPU, a 13.36 GiB
  cgroup and no authorised hosted inference.

Brief §13 binds every use below. **The teacher is never truth.** It may give soft preferences, rationales and
hard-example mining, and nothing it says becomes a label (`student_dataset.py`).

## What ran

| lane | items | split | records | note |
| --- | --- | --- | --- | --- |
| comparison | the 24 phase-1 questions **without** the sealed TEST split × 5 modes | development + SYNTH_CF | 120 | TEST was removed before the run (post-review D-2) |
| hard-example mining | 42 TRAIN questions, mode D (6 counterfactual pairs × 7 families; the ill-posed garage family removed) | vrgen2 2.0.0 TRAIN | 42 | the targets are the generator's |
| rationales | 8 disagreeing + 4 agreeing TRAIN items, mode D, free text and then JSON | TRAIN | 12 | inspection only |

**Settings.** The first 27 comparison records ran with the bake-off's server settings: 8k context and a 2 GiB prompt
cache. The server was then killed by the memory cgroup at 12.9 GB resident. The remaining records ran with
`-c 4096 --cache-ram 0` (teacher prompts are at most ~1,800 tokens). The slot's own KV reuse still applies, so mode
D reused mode C's plan prefix exactly as it did for the students.

**Time on this CPU** (after the change): median 28.6 s (A), 60.7 s (B), 58.1 s (C), 30.7 s (D, cache-aided) and
75.0 s (E). Peak anonymous RSS was 5.7 GB.

## Result 1 — on the same 24 questions, the teacher is the weakest Qwen and below the image-free prior

| model | exact accuracy, all modes (cluster 95 %) | CONFIDENT_WRONG_RATE, all modes | mode D accuracy / CWR | AUROC of option probability (all / D) |
| --- | --- | --- | --- | --- |
| **Qwen3-VL-8B (teacher, Q4_K_M)** | **57.5 %** (33–74) | **40.8 %** | 58.3 % / 41.7 % | **0.84 / 0.95** |
| Qwen3-VL-2B (Q8_0) | 78.3 % (57–92) | 21.7 % | 83.3 % / 16.7 % | 0.58 / 0.46 |
| Qwen3-VL-4B (Q8_0) | 70.8 % (50–83) | 28.3 % | 75.0 % / 25.0 % | 0.78 / 0.80 |
| InternVL3.5-2B (Q8_0) | 66.7 % (48–78) | 24.2 % | 70.8 % / 20.8 % | 0.63 / 0.60 |
| SmolVLM2-2.2B (Q8_0, capped) | 40.0 % (28–56) | 54.2 % | 41.7 % / 54.2 % | 0.38 / 0.35 |
| first-option rule (no image) | 66.7 % | — | — | — |

Source: `teacher-comparison/summary.json` and `teacher-comparison/tables.md`, from `score.py` on the 24-question
subset.

- **The sample is too small to rank.** With 24 questions in a handful of clusters, the cluster intervals overlap
  heavily and no ranking is established.
- **What it does show.** A model four times larger, quantised to Q4_K_M, is not a better reader of these drawings.
- **Its probability ranks its own answers well.** AUROC is 0.95 in mode D on this subset. That is the one property
  worth keeping, as a soft-preference signal, but on 24 questions it is not established.

## Result 2 — on generator-labelled TRAIN pairs, the teacher does not see the planted difference

| measure (42 TRAIN questions, mode D) | value |
| --- | --- |
| agreement with the generator's truth | **20 / 42 (48 %)** — chance for two-option questions |
| per family | 3 / 6 in six families, 2 / 6 in `phantom_line` |
| counterfactual pairs (truth differs in all 21) | **same answer to both members in 20 of 21**; both members right in 0 |
| UNRESOLVED | 0 |
| option probability: agreeing / disagreeing | 0.89 / 0.85; AUROC 0.58 |
| median time per item | 52.3 s |

**What this means.**
- A teacher that gives the same answer to both members of a pair, which differ by exactly one drawn fact, does not
  read that fact.
- Its "agreements" are the halves of pairs where its fixed answer happens to be the truth.
- Used as a soft target, it would teach the student to ignore the very evidence the families were built to isolate.
- As a hard-example miner, it flags half of every family, which is no selection at all.

## Result 3 — rationales are fluent and not grounded

- **Answers.** Of the 12 free-text replies, 8 give the same answer as the constrained run and 6 match the generator.
- **Content.** The text describes features that both members share, for example "a single continuous line with no
  breaks", as the deciding evidence. It does so for both members of a pair, so for one of them the description is
  wrong.
- **Use.** They are kept as inspection material (`runs/teacher-rationale-qwen3-vl-8b.jsonl`). None is used anywhere.

## Feasibility verdict

| question | answer |
| --- | --- |
| Can the teacher run here? | Yes, as a CPU subset: Q4_K_M, a 4k context, no host prompt cache |
| Is it a usable source of soft labels for BuildPlan's questions? | **No.** It is at chance on the TRAIN families and insensitive to the counterfactual fact |
| Is it a usable hard-example miner? | **No** on this evidence: it flags half of every family |
| What would it cost to label the 2.1 TRAIN split? | 11,000 questions × ~52 s ≈ **160 CPU hours** in one mode, which is not feasible here. On a GPU the 8B model in bf16 is a few seconds per item, but its value is the issue, not its cost |
| Licence | Apache-2.0; its outputs may train another model (`licensing-matrix.md` §1b) |
| What should supply targets instead | The generator's truth, including the generator-exact abstention target, as `student_dataset.py` already does. A teacher only adds value if a stronger one (32B, or a frontier model under an OWNER-approved budget) first passes the TRAIN pair-sensitivity check above: same answer to both members in fewer than 10 % of pairs |

TEACHER_EXECUTION = **RUN** (CPU subset: 120 + 42 + 12 records). The 32B upper-oracle teacher is `DEFERRED_ENV`.
