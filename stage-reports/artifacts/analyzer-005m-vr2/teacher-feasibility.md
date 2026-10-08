# 005M teacher feasibility — TEACHER_EXECUTION = RUN (CPU subset)

**Teacher:** `Qwen/Qwen3-VL-8B-Instruct`, run from the publisher's own GGUF (`Qwen/Qwen3-VL-8B-Instruct-GGUF@f982a075`).
- **Quantisation:** LLM Q4_K_M 5.03 GB + vision F16 1.16 GB. Both files matched the hub's LFS SHA-256.
- **Runtime:** CPU, the same llama.cpp server and the same items as the bake-off.
- **Why Q4_K_M and not Q8_0.** Q8_0 (8.7 GB of files) was not attempted. Reviewer E estimates it at ≈ 12.1 GB resident
  at the final settings, under the 14.35 GB cgroup limit, so it might have fit; the choice was made for headroom after
  the OOM below, not because Q8_0 was shown not to fit (post-review E2-8).
- **Optional larger teacher:** Qwen3-VL-32B is `DEFERRED_ENV`. It has 66.7 GB of BF16 weights; there is no GPU, a 13.36 GiB
  cgroup and no authorised hosted inference.

Brief §13 binds every use below. **The teacher is never truth.** It may give soft preferences, rationales and
hard-example mining, and nothing it says becomes a label (`student_dataset.py`).

## What ran

| lane | items | split | records | note |
| --- | --- | --- | --- | --- |
| comparison | the 24 phase-1 questions **without** the sealed TEST split × 5 modes | development + SYNTH_CF | 120 | TEST was removed before the run (post-review D-2) |
| hard-example mining | 42 TRAIN questions, mode D (3 counterfactual pairs × 7 families = 21 pairs; the ill-posed garage family removed) | vrgen2 2.0.0 TRAIN | 42 | the targets are the generator's |
| rationales | 8 disagreeing + 4 agreeing TRAIN items, mode D, free text and then JSON | TRAIN | 12 | inspection only |

**Settings.** The first 27 comparison records ran with the bake-off's server settings: 8k context and a 2 GiB prompt
cache. The server was then killed by the memory cgroup at 12.9 GB resident. The remaining records ran with
`-c 4096 --cache-ram 0` (teacher prompts are at most ~1,800 tokens). The slot's own KV reuse still applies, so mode
D reused mode C's plan prefix exactly as it did for the students.

**Time on this CPU** (after the change): median 28.6 s (A), 60.7 s (B), 58.1 s (C), 30.7 s (D, cache-aided) and
75.0 s (E). Peak anonymous RSS was 5.7 GB.

## Result 1 — on the same 24 questions (point estimates), the Q4_K_M teacher scores below both Qwen students and the image-free prior

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

- **What the sample settles.** 24 questions in 10 clusters, with morelach alone 8 of them. Only one difference is
  established: the teacher is below Qwen3-VL-2B (paired cluster difference in accuracy −34.7 … −6.7 points over all
  modes, −40.7 … −5.3 in D; `teacher-comparison/tables.md`). Against InternVL3.5-2B, Qwen3-VL-4B and the prior the
  intervals overlap, and SmolVLM2-2.2B (40.0 %) scores below the teacher (post-review A2-8, D-18).
- **What it does show.** A model four times larger, quantised to Q4_K_M and run on CPU, is not a better reader of these
  drawings.
- **Its probability does not carry over to the items it would label** (post-review C2-1).
  - On these 24 questions it separates right from wrong: AUROC 0.84 over all modes, 0.95 in D (24 answers: 14 right,
    10 wrong).
  - Part of that is between source sets: the teacher is wrong on every GAPSET_DEV record, at lowish probability.
    Within a source set the all-mode AUROC is 0.74 (reviewer C).
  - It is over-confident: ECE 0.31, the worst of the five models on this subset; at p ≥ 0.9 it is right on 76 % of 82
    answers at a mean p of 0.98 (reviewer C).
  - On the 42 generator-labelled TRAIN items, where a soft preference would actually be read, its probability separates
    agreeing from disagreeing answers with AUROC **0.58** (Result 2), close to chance.
  - So it is not a usable soft-preference signal on this evidence.

## Result 2 — on generator-labelled TRAIN pairs, the teacher does not see the planted difference

| measure (42 TRAIN questions, mode D) | value |
| --- | --- |
| agreement with the generator's truth | **20 / 42 (48 %)**, about chance (≈ 45 %: 12 of the 42 have three options) |
| per family | 3 / 6 in six families, 2 / 6 in `phantom_line` |
| counterfactual pairs (truth differs in all 21) | **same answer to both members in 20 of 21**; both members right in 0 |
| UNRESOLVED | 0 |
| option probability: agreeing / disagreeing | 0.89 / 0.85; AUROC 0.58 |
| median time per item | 52.3 s |

**What this means** (for constrained, answer-first decoding, the mode that would produce labels; see Result 3 for a
free-text-first prompt).
- A teacher that gives the same answer to both members of a pair, which differ by exactly one drawn fact, does not
  read that fact in this decoding mode.
- Its "agreements" are the halves of pairs where its fixed answer happens to be the truth.
- Used as a soft target, it would teach the student to ignore the very evidence the families were built to isolate.
- As a hard-example miner, it flags half of every family, which is no selection at all.

## Result 3 — with a free-text-first prompt the teacher separated 2 of 3 pairs it was tried on

The 12 rationale items were chosen for constrained disagreement (8) plus 4 agreeing items, so they are not a fair
sample (post-review D-14).
- **Answers.** Of the 12 free-text replies, 8 give the same answer as the constrained run. 6 match the generator,
  against 4 of the same 12 under constrained decoding.
- **`compound_front`, counter-evidence to "does not see the fact".** In s0 and s2 the constrained answers were A / A;
  the free-text answers are A / B, both members right. The texts describe the planted difference: "two distinct door
  symbols with separate thin lines" against "a single continuous line with no breaks … one single open side". In s1 the
  free answers are B / B.
- **Corridor pairs.** The text describes features both members share as the deciding evidence, for both members, so
  for one of them the description is wrong.
- **What follows.** "Does not read the planted fact" is established for constrained, answer-first decoding only.
  Reasoning-first labelling is untested beyond these 3 pairs (6 items): too few to say it reads the fact, enough to
  falsify the general statement. Running the rationale prompt on all 42 TRAIN items would cost ≈ 1.2 CPU-hours; it was
  not done.
- **Use.** They are kept as inspection material (`runs/teacher-rationale-qwen3-vl-8b.jsonl`). None is used anywhere.

## Feasibility verdict

| question | answer |
| --- | --- |
| Can the teacher run here? | Yes, as a CPU subset: Q4_K_M, a 4k context, no host prompt cache |
| Is it a usable source of soft labels for BuildPlan's questions? | **No, under constrained decoding.** It is at chance on the TRAIN families, gives one answer to 20 of 21 pairs, and its probability does not separate its TRAIN answers (AUROC 0.58). Reasoning-first labelling is untested beyond 3 pairs |
| Is it a usable hard-example miner? | **No** on this evidence: it flags half of every family |
| What would it cost to label the 2.1 TRAIN split? | 11,000 questions × ~52 s ≈ **160 CPU hours** in one mode, which is not feasible here. On a GPU the 8B model in bf16 is a few seconds per item, but its value is the issue, not its cost |
| Licence | Apache-2.0; its outputs may train another model (`licensing-matrix.md` §1b) |
| What should supply targets instead | The generator's truth, including the generator-exact abstention target, as `student_dataset.py` already does. A teacher only adds value if one (this 8B with reasoning-first decoding, the 32B, or a frontier model under an OWNER-approved budget) first passes the TRAIN pair screen **in the decoding mode that will produce labels**: both members right on a stated share of the pairs whose truths differ, context and local pairs reported apart, with "same answer to both members" as a secondary figure (post-review B-19). Same answer alone can be passed by different wrong answers |

TEACHER_EXECUTION = **RUN** (CPU subset: 120 + 42 + 12 records). The 32B upper-oracle teacher is `DEFERRED_ENV`.
