# 005M input modes — the same question in five information contracts

Code: `research/analyzer-005m/common.py` (wording, options, schema) and `compose5.py` (pictures). Every model receives
the same bytes for a given item: each item records the SHA-256 of every image it sends (`question-corpus.json` →
`modeImageSha256`).

## What never changes between modes

- **The question text and the options.** Options are shown as letters A, B (C) in an order drawn once per *base*
  question from a hash of its id. The order is the same for mirror / rotation twins and for both members of a
  counterfactual pair, so a constant letter cannot pass for reading. UNRESOLVED ("The drawing does not let you decide")
  is always offered.
- **The reply.** `{"answer": "<letter|UNRESOLVED>", "confidence": "LOW|MEDIUM|HIGH"}`, decoded under a JSON schema
  (llama.cpp grammar), temperature 0, seed 0. No free-form text is scored.
- **The model's own option probability.** Read at the answer token from the *unconstrained* pre-sampling distribution
  (top-20) and normalised over the options. Its unconstrained share is recorded as format adherence.

## The modes

| mode | images, in order | what marks the detail | what the text adds |
| --- | --- | --- | --- |
| **A_CROP_ONLY** | the close-up | the cyan ROI marker | "a close-up crop of the plan around the detail" |
| **B_FULL_PLAN** | the whole plan, unmarked | nothing is drawn | the ROI as coordinates in a 0–1000 frame of the image: a box for an area, the two ends for a line, the corner lists for candidate outlines |
| **C_FULL_PLAN_MARKED_ROI** | the whole plan | the cyan ROI marker | "the whole floor plan" |
| **D_MARKED_ROI_PLUS_CROP** | C's plan, then A's crop (byte-identical to them) | cyan in both | "the first image … the second image is a close-up crop" |
| **E_MARKED_ROI_PLUS_CROP_PLUS_OVERLAY** | C's plan **plus the analyzer overlay**, then A's crop | cyan in both | D's text + "thin purple lines show the axes of wall-thick ink that an automatic analyzer detected. These marks can be incomplete or wrong." (or, when the analyzer found none: "no purple marks are drawn") |

- **Native multi-image, no composite fallback.** All four mandatory models take several images natively in the
  runtime: Qwen3-VL `<|vision_start|>…`, SmolVLM2 / Idefics3 tiled `<fake_token_around_image>` blocks, InternVL
  `<img>…</img>`. D and E pass two images.
  - The real **storey** questions (A06 / A07) show the two published plans side by side: ground left, upper right, a
    20 px white gap. That is the only composite, and it is there because the source has two separate sheets.
  - Synthetic storey renders follow the scene transform, so the two panels can be swapped (MIRROR, ROT180) or stacked
    (ROT90). The prompt states the layout for each transform (`common.STOREY_LAYOUT`, post-review B-1 / B-18).

## Geometry

- **Plan.** The whole frame or render, longest side **768 px**, downscaled only (LANCZOS).
  - 49 of the 167 phase-2 plans are smaller and go at native size: all 16 SYNTH_CF and 33 of 54 SYNTH_GLOBAL. The
    smallest is 329 × 272 px.
- **Crop.** **448 × 448 px**, centred on the target.
  - Its side is 2 × (half extent + max(3 m, 0.6 × half extent)), white padding outside the sheet. It is downscaled
    with LANCZOS or upscaled with BICUBIC.
  - 102 of 167 crops are upscaled: up to 2.55× on synthetic renders, about 1.6× on most 005K gaps.
  - **For the 12 candidate-outline questions the "crop" is not a close-up.** Both outlines must fit, so it is the
    whole sheet at 0.37–0.56×. For them, A → B/C partly measures resolution rather than context (post-review B-6).
  - It is **clipped to the question's panel**: for STOREY questions the crop holds the ground plan only, so mode A
    cannot see the upper floor.
- **ROI colour.** Cyan `rgb(0, 190, 230)`, line width 3 px. **Never red**: the publishers draw dimensions in red.
  - Areas: outline plus a 18 % fill.
  - Gaps and lines: **two brackets** parallel to the line, just outside the wall band (offset = half the wall thickness
    + 5 px), with end ticks pointing away (005K's convention).
    - Where the wall band is estimated too thin, a bracket can still touch wall ink (seen on 005K q036).
    - On A06, the cyan sits close to a cyan pool the publisher drew (post-review B-9).
  - Candidate outlines: outline **1** solid and outline **2** dashed, labelled with digits. Digits are used so they
    cannot collide with option letters.
    - **Known weakness (B-4).** Where the two outlines share edges, outline 2 shows only as dashed fragments.
    - Qwen3-VL-2B chose outline 1 in 56 of 60 phase-2 records, and both phase-1 outline questions expect outline 1.
    - Read results on this class as partly a salience effect.
- **Analyzer overlay (E).** The production `planSheet` wall bands, read-only through 005J's `bands.ts`, on the exact
  source image, drawn as 2 px purple `rgb(150, 70, 200)` axis lines (each band's centre line).
  - **It holds no expected answer, published area, verdict, house name, or green/red cue.** It is an observation and can
    be wrong: on 18 of 90 plan images the production pass found no band at all.
  - It comes from the analyzer, not from the truth, so it can differ between twins: 30 bands on
    `inset_upper-s0` NORMAL, none on its MIRROR.
  - On `phantom_line-s0`, whether it is present happens to line up with the answer (post-review B-8).
  - **Not included:** "two alternative boundary hypotheses" as a separate layer. Where a question is itself an A/B
    candidate question, its candidates are the question's own cyan marker in every mode. The analyzer's rejected
    outlines are not in the development records for the other questions, and a hypothesis drawn from the truth would
    leak it.

**A note on mode B (post-review A-11).** The 0–1000 coordinate frame is Qwen-VL's native grounding convention, so mode
B is, if anything, tilted towards the Qwen models. llama.cpp warns that Qwen-VL grounding wants at least 1,024 image
tokens; here the plan gets 578. The point is moot for the conclusions: mode B loses against mode A for every model,
the Qwens included.

## Context-dependent pairs

For the 005M generator's context families, the A-mode crops of the two members of a counterfactual pair are
**byte-identical**. On the pre-registered sets that held for all 34 twin-paired benchmark items and 48 of 48
teacher-mining items. On the amended phase-2 set (post-review B-18) there are 23 context-dependent items: the 20 members
of the 10 context pairs, all crop-identical; the 2 members of the same-truth control pair; and 1 unpaired ROT90 item. The
teacher's 42 TRAIN questions hold 18 context items, all crop-identical.

- **Uncovered items.** The unpaired ROT90 item has no twin in the set, so its identity is not checked.
- **Up to cache nondeterminism.** Identical crops force the same answer only up to the prompt cache: InternVL3.5-2B
  answered 3 of 17 byte-identical mode-A pairs differently (`environment.md`, post-review A2-4).
- **What mode A must do.** It must answer such a pair identically. Where the two members' truths differ, the only
  correct crop-only reply is UNRESOLVED, and any gain can come only from the whole plan.
- **Control pairs.** The storey families also ask about the rear of the body, which the upper floor covers in both
  members. Both truths there are YES, so a YES in mode A is right and is no context gain.
- **Scoring.** The scorer counts the control pairs apart and reports context pairs separately (post-review B-3, B-12).

## Token budget and model-native resizing (measured)

`imageTokens` = the prompt tokens minus the tokens of the same messages without the images, both through the
model's own chat template (`bench.py`: `/apply-template` + `/tokenize`). Medians are over every record. The minimum
comes from the smallest plan, a 329 × 272 px synthetic render (005J `porch_recess`).

### Measured per model

| model | how the runtime sizes an image | A (crop 448²) | B / C (plan, 768² typical) | D / E (plan + crop) | per-image ceiling |
| --- | --- | --- | --- | --- | --- |
| Qwen3-VL-2B / 4B | dynamic resolution, 32 px per token after 2 × 2 merge, no resizing at these sizes | **198** | **578** (92–578) | **776** | 1,024 px² (32 × 32) per token; a 768 × 768 plan is 24 × 24 |
| InternVL3.5-2B | 448 px tiles; a 448² crop is one tile; a 768² plan is 2 × 2 tiles + a thumbnail (5 × 256) | **258** | **1,282** (258–1,282) | **1,540** | 256 tokens per tile, up to 12 tiles by default |
| SmolVLM2-2.2B | Idefics3 tiling, **capped here** with `--image-max-tokens 336`: both crop and plan become 2 × 2 tiles + a global view | **419** | **419** (252–419) | **837** | native: 1,536 px longest side, **1,417 tokens per image** (~100 s per image on this CPU) |
| Qwen3-VL-8B (teacher) | as Qwen3-VL-2B | 198 | 578 | 776 | |
| SmolVLM2-500M (005J reference) | 005J ran it on its own candidate-overlay image, one 512² tile = 64 image tokens; not re-run | — | — | — | |

What this means for the comparison:
- **Every model receives every input pixel.** No model downsamples a composed image.
  - Qwen3-VL works at its native 32 px per token, with no resizing: a wall 3 px thick is about a tenth of a token cell.
  - InternVL tiles at 448 px, as its own `dynamic_preprocess` would, and spends 2.2× as many tokens on the same plan.
- **The SmolVLM2-2.2B cap preserves information.** `--image-max-tokens 336` gives 2 × 2 tiles of 384 px plus a global
  view, which is 768 px.
  - Every composed image is at most 768 px, so nothing is lost; the native setting would only upscale further, to
    1,536 px.
  - The 448 px crop is therefore resampled into the same layout as the plan (5 × 81 tokens).
  - Measured in phase 1, it gains nothing from context: the net change A → B/C/D/E is −2 / −2 / −1 / −2 over 32
    questions.
  - Its answers are near coin-flips: median chosen-option probability 0.51.
- **Token cost drives latency on CPU.** D/E cost more tokens than B/C: 1.34× for Qwen3-VL (776 / 578), 1.2× for
  InternVL (1,540 / 1,282) and 2.0× for SmolVLM2 (837 / 419).
  - **In the benchmark,** D reused C's plan image from the prompt cache, so its wall time is about half of C's.
  - **Asked alone,** a mode-D question costs more than C: about 35 s against 25 s for Qwen3-VL-2B on this CPU.
  - E was asked after D, with a different first image, so it was not cache-aided.
  - Both figures are in `runtime-size-matrix.md` (post-review E-1).
