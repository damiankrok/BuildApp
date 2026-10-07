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
  - The **storey** questions show the two published plans side by side: ground left, upper right, a 20 px white gap.
    That is the only composite, and it is there because the source has two separate sheets.

## Geometry

- **Plan.** The whole frame or render, longest side **768 px**, downscaled only (LANCZOS).
- **Crop.** **448 × 448 px**, centred on the target.
  - Its side is 2 × (half extent + max(3 m, 0.6 × half extent)), white padding outside the sheet. It is downscaled
    with LANCZOS or upscaled with BICUBIC.
  - It is **clipped to the question's panel**: for STOREY questions the crop holds the ground plan only, so mode A
    cannot see the upper floor.
- **ROI colour.** Cyan `rgb(0, 190, 230)`, line width 3 px. **Never red**: the publishers draw dimensions in red.
  - Areas: outline plus a 18 % fill.
  - Gaps and lines: **two brackets** parallel to the line, just outside the wall band (offset = half the wall thickness
    + 5 px), with end ticks pointing away. They never cover the evidence (005K's convention).
  - Candidate outlines: outline **1** solid and outline **2** dashed, labelled with digits. Digits are used so they
    cannot collide with option letters.
- **Analyzer overlay (E).** The production `planSheet` wall bands, read-only through 005J's `bands.ts`, on the exact
  source image, drawn as 2 px purple `rgb(150, 70, 200)` axis lines (each band's centre line).
  - **It holds no expected answer, published area, verdict, house name, or green/red cue.** It is an observation and can
    be wrong: on 14 of 90 plan images the production pass found no band at all.
  - **Not included:** "two alternative boundary hypotheses" as a separate layer. Where a question is itself an A/B
    candidate question, its candidates are the question's own cyan marker in every mode. The analyzer's rejected
    outlines are not in the development records for the other questions, and a hypothesis drawn from the truth would
    leak it.

## Context-dependent pairs

For the 005M generator's context families, the A-mode crops of the two members of a counterfactual pair are
**byte-identical** (34 of 34 benchmark items, 48 of 48 teacher-mining items). Mode A must answer such a pair
identically. The only correct crop-only reply is UNRESOLVED, and any gain on them can come only from the whole plan.

## Token budget and model-native resizing (measured)

`imageTokens` = the prompt tokens minus the tokens of the same messages without the images, both through the
model's own chat template (`bench.py`: `/apply-template` + `/tokenize`). Medians are over every record. The minimum
comes from the narrowest plan (a 449 × 404 storey frame or a 768 × 338 strip).

### Measured per model

| model | how the runtime sizes an image | A (crop 448²) | B / C (plan, 768² typical) | D / E (plan + crop) | per-image ceiling |
| --- | --- | --- | --- | --- | --- |
| Qwen3-VL-2B / 4B | dynamic resolution, 32 px per token after 2 × 2 merge, no resizing at these sizes | **198** | **578** (92–578) | **776** | ~16 k px² per token; a 768 × 768 plan is 24 × 24 |
| InternVL3.5-2B | 448 px tiles; a 448² crop is one tile; a 768² plan is 2 × 2 tiles + a thumbnail (5 × 256) | **258** | **1,282** (258–1,282) | **1,540** | 256 tokens per tile, up to 12 tiles by default |
| SmolVLM2-2.2B | Idefics3 tiling, **capped here** with `--image-max-tokens 336`: both crop and plan become 2 × 2 tiles + a global view | **419** | **419** (252–419) | **837** | native: 1,536 px longest side, **1,417 tokens per image** (~100 s per image on this CPU) |
| Qwen3-VL-8B (teacher) | as Qwen3-VL-2B | 198 | 578 | 776 | |
| SmolVLM2-500M (005J reference) | 005J ran it on its own candidate-overlay image, one 512² tile = 64 image tokens; not re-run | — | — | — | |

What this means for the comparison:
- **Qwen3-VL sees the most per plan pixel.** At 768 px a wall 3 px thick is about a tenth of a 32-px token cell.
  InternVL spends 2.2 × as many tokens on the same plan.
- **SmolVLM2-2.2B under the cap sees the 448 px crop at roughly the same effective resolution as the plan.** The crop is
  resampled into the same 2 × 2 + global layout as the plan (5 × 81 tokens). Measured in phase 1, it gains nothing
  from context: the net change A → B/C/D/E is −2 / −2 / −1 / −2 over 32 questions. Its phase-1 result
  is a result **at the cap**, stated as such: the native setting was out of this CPU's reach for 160 matched records.
- **Token cost is the latency driver on CPU.** D/E cost about 1.3–1.4 × B/C in tokens, and about the same wall time
  as C, because the plan prefix is reused from the prompt cache (`runtime-size-matrix.md`).
