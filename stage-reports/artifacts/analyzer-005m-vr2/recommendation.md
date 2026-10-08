# 005M recommendation

## NEXT_RECOMMENDATION: RETURN_TO_DETERMINISTIC_BODY_RELATION

Exactly one enum (brief §22). It sends BuildPlan back to the deterministic fix that 005L's blind round 9 named:
murajach's recessed entrance and garage door, and gozdzikowcach's body relation. That fix was out of scope here.

**No local VLM is piloted, no student is trained, and no cloud teacher is commissioned.** The case rests on the
measured results below. Every figure is from `bakeoff-tables.md`, `teacher-feasibility.md`, `runtime-size-matrix.md`
or `student-training.md`.

## Why not the alternatives

| enum | verdict | measured reason |
| --- | --- | --- |
| ADOPT_LOCAL_VLM_PILOT | **rejected** | See "Why ADOPT_LOCAL_VLM_PILOT is rejected" below |
| TRAIN_BUILDPLAN_STUDENT | **not now** | See "Why TRAIN_BUILDPLAN_STUDENT is not now" below |
| CLOUD_TEACHER_ONLY | **rejected** | The only teacher that could run here, Qwen3-VL-8B, reads worse than the 2B students (57.5 % on 24 questions) and does not see the counterfactual fact (one answer for 20 of 21 TRAIN pairs). A frontier cloud model was not authorised (brief: no money, no cloud accounts), so a cloud teacher's value is unmeasured. Its only measured use is the 005J oracle, which needs real crops sent off-device: a licensing and product question, not this stage's |
| NO_AI_GAIN | **too strong** | Qwen3-VL-2B in mode D beats the image-free prior on real development questions: +2.0 … +18.5 points overall, P(model > prior) = 99 %. Real-D accuracy is 77 % against a 62 % prior. So the gain is real but **unsafe**, not absent. The enum would erase a measurement a later stage needs |
| OTHER_MEASURED_RESULT | not needed | One of the listed outcomes fits the measurements |
| **RETURN_TO_DETERMINISTIC_BODY_RELATION** | **chosen** | The analyzer failure that started this line of work is a body-relation decision on real sheets: murajach's recessed entrance / garage door, gozdzikowcach. 005M shows that no small VLM, zero-shot or as a teacher, can stand in for that decision at an acceptable error rate. The deterministic route has a concrete, reviewable target and no deployment cost |

### Why ADOPT_LOCAL_VLM_PILOT is rejected

- **Confident-wrong rate.** The best small model and mode is Qwen3-VL-2B in mode D: **CONFIDENT_WRONG_RATE 30.9 %**
  (47/152; Wilson 24–39 %, cluster 24–41 %). The 005J gate is 0.5 %.
- **Real development questions.** On them it is still confidently wrong on 22.7 %, and 15.7 % on human-authored truth.
- **It never abstains.** It answered UNRESOLVED 0 times in 760 phase-2 replies.
- **Its probability does not help.** No probability threshold reaches the gate.
  - In-sample, its zero-error region covers 5.9 % of answers.
  - Agreement across all five modes still leaves 28.6 % wrong.
- **Latency.** A standalone mode-D question takes ≈ 35 s on this CPU. On a phone it would plausibly be 9–80 s
  (`runtime-size-matrix.md`).

### Why TRAIN_BUILDPLAN_STUDENT is not now

1. **There is no compute.** The CPU probe measured 31 s per LoRA step, so 3 epochs would take ≈ 1,400 h
   (`student-training.md` §3). A GPU run needs OWNER authorisation.
2. **The teacher is unusable** as a soft-label source. Only generator truth remains, and 005J's Route-C pilot already
   showed synthetic-only training collapsing on real sheets (85 % synthetic, 49.6 % real).
3. **The pass bar cannot be demonstrated.** 0.5 % per class needs ≥ 598–765 error-free real questions per class; the
   real development set has 2–17.
4. **The licensing route is not settled.** The smallest base (SmolVLM2-500M) is not commercially clean; its cleaner
   sibling is not proven clean (`licensing-matrix.md`).

## What 005M leaves ready for whoever reopens the AI route

None of this needs to be redone.
- **A pre-registered, reviewed scorer** that compares like with like: matched sets, cluster bootstrap, image-free
  priors, risk–coverage and split counterfactual pairs.
- **A generator-truth corpus** with a split no model has seen: vrgen2 2.1, 2,000 / 400 / 400 independent drawings,
  and the SEALED split.
- **A student dataset format** with generator-exact abstention targets, and a measured CPU cost.
- **A pair-sensitivity screen any future teacher must pass.** It must give the same answer to both members of fewer
  than 10 % of TRAIN pairs; Qwen3-VL-8B gave one answer to 95 %.
- **Deployability numbers** for Qwen3-VL-2B: ≈ 1.55 GB of files at Q4_K_M + Q8_0 vision, quality unmeasured;
  ≈ 2.1 GB of RAM estimated; standalone D ≈ 35 s on this CPU.

**Reopen conditions.** Reopen the AI route only when all of these hold:
- an OWNER-authorised GPU exists;
- a frozen real evaluation set of the size in `student-training.md` §5 exists;
- a teacher, if one is used, passes the pair-sensitivity screen.

## Licence caveats the recommendation carries

- **SmolVLM2-500M / 2.2B.** Not commercially clean as a training base: ≈ 77.5 % of the mixture is academic-only or
  non-commercial.
- **InternVL3.5.** "Built with Qwen" attribution through its InternVL3-78B-generated data.
- **Gemma 3n.** Gated. A fine-tune or slice is a Model Derivative under the Gemma Terms, which include a
  remote-restriction clause.
- **Qwen3-VL.** Apache-2.0, with training data undisclosed.

None of these is triggered by this recommendation, since no model is adopted or trained.
