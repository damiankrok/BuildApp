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

See §"Measured per model" below. It is filled from the run records (`imageTokens` = prompt tokens minus the same
messages without images, through the model's own template).
