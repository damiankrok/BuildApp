# 005M recommendation

## NEXT_RECOMMENDATION: RETURN_TO_DETERMINISTIC_BODY_RELATION

Exactly one enum (brief §22). It sends BuildPlan back to the deterministic fix that 005L's blind round 9 named:
murajach's recessed entrance and garage door, and gozdzikowcach's body relation. That fix was out of scope here.

**No local VLM is piloted, no student is trained, and no cloud teacher is commissioned.** The case rests on the
measured results below. Every figure is from `bakeoff-tables.md`, `teacher-feasibility.md`, `runtime-size-matrix.md`
or `student-training.md`. Phone latencies are reviewer E's round-1 estimate.

## Why not the alternatives

| enum | verdict | measured reason |
| --- | --- | --- |
| ADOPT_LOCAL_VLM_PILOT | **rejected** | See "Why ADOPT_LOCAL_VLM_PILOT is rejected" below |
| TRAIN_BUILDPLAN_STUDENT | **not now** | See "Why TRAIN_BUILDPLAN_STUDENT is not now" below |
| CLOUD_TEACHER_ONLY | **rejected on the evidence available** | The only teacher that could run here was Qwen3-VL-8B at Q4_K_M on CPU. On the 24 shared questions it scored 57.5 %, below Qwen3-VL-2B (paired cluster difference −34.7 … −6.7 points) and not separable from InternVL3.5-2B; these are point estimates on 24 questions. Under constrained decoding it gave one answer to both members of 20 of 21 TRAIN pairs. With a free-text-first prompt it separated 2 of the 3 `compound_front` pairs it was tried on, so "does not read the planted fact" holds for the decoding used for labels, not as a property of the model. A frontier cloud model was not authorised (brief: no money, no cloud accounts), so a cloud teacher's value is unmeasured, not refuted. Its only measured use is the 005J oracle, which needs real crops sent off-device: a licensing and product question, not this stage's |
| NO_AI_GAIN | **too strong** | On the 97 real development questions, Qwen3-VL-2B in mode D beats the image-free first-option rule by +15.5 points (cluster 95 % +2.1 … +26.7, 17 houses); over all 152 questions by +10.5 (+2.0 … +18.5). Qwen3-VL-4B in mode C also clears it on real questions (+14.4, +3.3 … +24.5). Both survive a family-wise check over the 15 model × mode arms against the first-option rule (critical gain +13.8 on real, +10.2 on all). Neither survives against the per-class majority fitted on the scored set (critical +12.4; best arm +9.3), which is an optimistic ceiling for a class-aware rule. So the gain is real against a truth-blind rule, fragile against a class-aware one, and **unsafe**, not absent. The enum would erase a measurement a later stage needs |
| OTHER_MEASURED_RESULT | not needed | The one result that might justify it is the body-relation subgroup below, which is post hoc. It belongs in the reopen conditions, not in the headline |
| **RETURN_TO_DETERMINISTIC_BODY_RELATION** | **chosen** | The analyzer failure that started this line of work is a body-relation decision on real sheets: murajach's recessed entrance / garage door, gozdzikowcach. **No small VLM meets the 0.5 % gate, or can be shown to meet it with the real data that exist.** Across all real questions the best arm is wrong, with stated confidence HIGH, on 23 %. A deployed VLM would also cost ≥ 1.5 GB and tens of seconds per question. The deterministic route has a concrete, reviewable target and no deployment cost |

**What 005M does not show.** It does not show that a small VLM *cannot* make the body-relation decision. On the
body-relation classes themselves Qwen3-VL-2B in mode D was right on **29 of 30** real questions (TERRACE_VS_BODY 15 / 15,
BODY_REGION 14 / 15), including the three questions that are the 005L failure itself (gozdzikowcach TERRACE_VS_BODY-0,
murajach M5 and M7), and on 16 of 17 murajach + gozdzikowcach questions. That is a **post-hoc subgroup** (12 classes ×
15 arms were open to selection); one error in 30 still has a Wilson upper bound near 17 %. It is a lead, not a result
(post-review A2-1).

### Why ADOPT_LOCAL_VLM_PILOT is rejected

- **Confident-wrong rate.** The best small model and mode is Qwen3-VL-2B in mode D: **CONFIDENT_WRONG_RATE 30.9 %**
  (47/152; Wilson 24–39 %, cluster 24–41 %). That is its plain error rate: it states HIGH on every answer. Its
  probability-gated P80 rate is 21 % (32/152). The 005J gate is 0.5 % per class, on an upper bound.
- **Real development questions.** On them it is still confidently wrong on 22.7 %, and 15.7 % on human-authored truth.
- **It never abstains.** It answered UNRESOLVED 0 times in 760 phase-2 replies.
- **No probability threshold reaches the gate, for any model.**
  - Qwen3-VL-2B: AUROC 0.56 in D; its in-sample zero-error region covers 5.9 % of answers. Agreement across all five
    modes still leaves 28.6 % wrong.
  - Qwen3-VL-4B is the strongest selective model (AUROC 0.70 in D, 0.78 on real D). On real D at p ≥ 0.99 it covers 42
    of 97 questions with 1 wrong: 2.4 % selective risk, Wilson upper bound 12 % (reviewer C: cluster 0–9.7 %). The cell was chosen
    after the results were seen. It covers 8 houses, 9 of its 42 answers are mirror twins, 29 of them are also right
    under the image-free rule, and it covers none of GAP_KIND, OUTER_BOUNDARY, CANOPY or STOREY.
  - **Held out, the zero-error regions do not hold.** A threshold frozen on the 30 phase-1 questions and applied to the
    122 phase-2-only questions accepts answers with errors: Qwen3-VL-4B 12 wrong of 127 answers (all modes) and 5 of 35
    (D); Qwen3-VL-2B 4 of 18 (D); InternVL3.5-2B 6 of 18 (D).
- **Latency.** A standalone mode-D question takes ≤ 33 s on this CPU (bounded by the measured cold mode E). On a phone
  it would plausibly be 9–80 s (reviewer E's round-1 estimate; no phone was measured).

### Why TRAIN_BUILDPLAN_STUDENT is not now

1. **There is no compute.** The CPU probe measured 31 s per LoRA step at a 1,024 px processor setting, so 3 epochs would
   take ≈ 1,400 h (`student-training.md` §3). A GPU run needs OWNER authorisation.
2. **The generator corpus is not ready for abstention training.** In vrgen2 2.1 the crop-only abstention target is a
   function of the class: BAY_BACK_CLOSED_VS_DRIVE_THROUGH, BODY_REGION and STOREY_COVERAGE have no crop-decidable
   question. A student could score perfect abstention without reading a pixel. `student_dataset.py` now refuses to
   write such a set; a generator revision with crop-decidable members in those classes comes first (post-review D-13).
3. **The teacher is not usable** as a soft-label source in the decoding mode that produces labels: its probability does
   not separate its right from wrong TRAIN answers (AUROC 0.58). Only generator truth remains.
4. **Transfer to real sheets is untested.** 005J's from-scratch micro-referee pilot (1.07 M parameters, 256 px) went from
   85 % on synthetic to 49.6 % on real. Whether a pretrained VLM's fine-tune transfers better is untested: a risk, not a
   finding.
5. **The pass bar cannot be demonstrated.** 0.5 % per class needs ≥ 598–765 error-free real questions per class; the
   real development set has 2–17.
6. **The licensing route is not settled for every base.** The smallest base (SmolVLM2-500M, route A) is not
   commercially clean, and its cleaner sibling A′ is not proven clean. Route B (Qwen3-VL-2B) has no known licensing
   blocker beyond undisclosed training data (`licensing-matrix.md`).

## What 005M leaves ready for whoever reopens the AI route

None of this needs to be redone.
- **A pre-registered, reviewed scorer** that compares like with like: matched sets, cluster bootstrap, image-free
  priors with a family-wise check, paired context-gain intervals, risk–coverage with a held-out check, and split
  counterfactual pairs.
- **A generator-truth corpus** with a split no model has seen: vrgen2 2.1, 2,000 / 400 / 400 independent drawings,
  and the SEALED split. Before training, its three context-only classes need crop-decidable members (above).
- **A student dataset format** with generator-exact abstention targets, a class-shortcut guard, a render-hash teacher
  join, and a measured CPU cost.
- **A teacher screen any future teacher must pass, in the decoding mode that will produce labels.** On the TRAIN pairs
  whose truths differ it must answer **both members right** on a stated share of pairs, with context and local pairs
  reported apart; "same answer to both members" is kept as a secondary figure. Qwen3-VL-8B under constrained decoding
  had both right on 0 of 21 and the same answer on 20 of 21.
- **The one selective signal worth testing on a frozen real set:** Qwen3-VL-4B's option probability on real sheets in
  mode D (AUROC 0.78). It is a hypothesis, not an operating point.
- **Deployability numbers** for Qwen3-VL-2B: ≈ 1.55 GB of files at Q4_K_M + Q8_0 vision, quality unmeasured; ≈ 2.1 GB
  of RAM estimated; standalone mode D ≤ 33 s on this CPU.

**Reopen conditions.** Reopen the AI route only when all of these hold:
- an OWNER-authorised GPU exists;
- a frozen real evaluation set of the size in `student-training.md` §5 exists. Its first pre-registered target is the
  body-relation subgroup above (TERRACE_VS_BODY and BODY_REGION on real sheets), where the zero-shot lead is;
- the generator has crop-decidable members in every class that has an abstention target;
- a teacher, if one is used, passes the screen above.

## Licence caveats the recommendation carries

- **SmolVLM2-500M / 2.2B.** Not commercially clean as a training base: ≈ 77.5 % of SmolVLM2's declared fine-tuning
  mixture is academic-only or non-commercial. Route A is CONDITIONAL on counsel.
- **SmolVLM-500M-Instruct (A′) and route A's backbone.** Its SmolLM2-360M-Instruct language backbone was fine-tuned on
  SmolTalk, whose core was generated with Llama-3.1-405B; the Llama 3.1 licence asks for a "Llama" name prefix and
  "Built with Llama" on a model trained that way. Whether that reaches a model two steps downstream is a counsel
  question.
- **InternVL3.5.** Its SFT data was produced through InternVL3-78B, a Qwen-License model whose §5(b) asks for "Built with
  Qwen" on a model trained on its outputs. Whether that reaches InternVL3.5's users is a counsel question.
- **Gemma 3n.** Gated. A fine-tune or slice is a Model Derivative under the Gemma Terms, which let Google restrict usage
  it "reasonably believes" violates them.
- **Qwen3-VL.** Apache-2.0, with training data undisclosed.

None of these is triggered by this recommendation, since no model is adopted or trained.
