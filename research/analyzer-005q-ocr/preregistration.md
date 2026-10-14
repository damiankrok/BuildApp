# BUILDPLAN-ANALYZER-005Q-OCR — preregistration (frozen before any scoring)

Research only. Base `0aaa31f5af3e98fa9d9ca51887e5185333de267b`, branch `analyzer/paddleocr-full-plan-binding-research-v1`.
This file is committed before `score.py` is first run (the scorer is committed with it, unrun). Edits after that commit are listed in an addendum with a
reason; nothing above the addendum changes.

## 1. Question

Does independent full-page text detection (B1), read by the SAME deployed PP-OCRv6 tiny recogniser, recover dimension
labels or correct bindings that the incumbent crop-first path (B0) misses — without creating false measurements or a
confidently wrong scale? Or is the loss downstream (line extraction, binding, chain correction, decision)?

## 2. Sample (`corpus.json`) and truth

- 9 floor-plan sheets, 7 families (dom-w-murajach has two copies of one drawing, one lineage: one family). Failure
  anchors: glogownikach (S1), murajach (S2, S3), gozdzikowcach (S4). Controls: marcowki (S5, also the smoke / scale-choice
  sheet, reported separately), kosacce-clean (S6), zurawkach (S7), A06 (S8), D02 (S9, second publisher, tiles).
- All development data. No blind, no holdout draw, no sealed family used as a fresh blind.
- **No page, crop or pixel is shown to any remote model or service.** Truth is built locally (`truth.ts`):
  - Sampling frame: every classic token of ≥ 2 glyphs (incumbent discovery BEFORE its line test), every B1 box, and
    LINE WINDOWS beside every segment of every frozen dimension line that no proposal sits on. This is wider than the
    incumbent's proposal set (which is only the tokens on a chain), so B0's recall is not measured on its own crops.
  - Readers: R1 = PP-OCRv6 **medium** recogniser (not the contender's tiny model), R2 = Tesseract 5.3.4. Value =
    `LOCAL_DOUBLE_READ` only when R1 and R2 give the same text. Otherwise `AMBIGUOUS_READ` / `UNREADABLE`.
  - Tier A (`PRIOR_TRANSCRIPTION`): where 005O's blind double transcription of the same ink exists (statement crops of
    these frames), it takes precedence; every A-vs-local disagreement is reported as a truth-quality measure.
  - 005O's committed murajach full-sheet inventory (15 printed dimensions, values only) is used as a recall check on S2.
  - Dimension label = an integer reading (2–5 digits) that lies on a frozen dimension line or on a straight run with ≥ 2
    crossing marks (production's `onDimensionLine` test: same axis, within 2.2 label heights across, inside the tick
    span). An integer off every such line is `NOT_A_DIMENSION:OFF_LINE`; a reading with a separator is
    `NOT_A_DIMENSION:DECIMAL_OR_AREA`; anything else `NOT_A_DIMENSION:TEXT`.
  - Binding truth (per dimension label): the segment, on any frozen line it lies on, whose pixel length makes the label's
    value proportional to at least one OTHER truth label on the same line within 3 % (line-internal ratio only; no page
    scale, no registration, no published figure). Exactly one such segment → that is the truth; none → `NO_LINE_TRUTH`;
    several → `AMBIGUOUS_BINDING`.
  - No published area, solved registration, previous model, house verdict or solver output selects truth. The 005O
    transcription TRUE_SCALE is read ONLY by the scorer for the false-confident-scale check (§4), never to pick a value or
    a binding.

## 3. Contenders (frozen parameters)

- **B0**: the sealed incumbent run: classic token discovery → numeric lattice selection (token of 2–6 glyphs on a
  chain) → PP-OCRv6 tiny crop reading with the four-variant bracket → ensemble. The harness re-derives the token set from
  the same bytes with the frozen code and requires every sealed lattice box to be reproduced (`b0Reproduced`).
  B0's binding = the sealed evidence's chain segment for that token.
- **B1**: PP-OCRv6 **tiny** DB detector (`PaddlePaddle/PP-OCRv6_tiny_det_onnx@2ba1506c…`, sha256 `193bab7a…`,
  Apache-2.0), full resolution (scale 1 — the 2× setting was tried on the smoke sheet only and was not better: 40 vs 42
  of 59 B0 boxes covered, 3.4× slower), tiles 640 px with 160 px overlap, DBPostProcess thresh 0.2 / box 0.4 / unclip
  1.4, axis-aligned boxes, border de-duplication. Each box read by the deployed tiny recogniser on `labelCrop` of the
  same pass field, both turns of its axis; the reading kept is the turn with the higher top posterior.
  A B1 reading is **corroborating** with the ensemble's own three tests: top p ≥ 0.9 and greedy mean p ≥ 0.9; the
  same top under all four bracket variants; greedy text = top digits.
- **B2** (binding diagnostic): on the union of B0 and B1 corroborating integer candidates (one per ink: a B0 and a B1
  reading of the same ink are ONE candidate, two correlated readings, never two witnesses), assign each to a segment of a
  frozen line with the same axis, inside the tick span, within 2.2 label heights. Cost = across distance / label height +
  |centre − segment middle| / segment length. Greedy global assignment, one label per segment; a label whose best and
  second-best costs differ by < 0.25 is `UNRESOLVED`. **Blind to values, scale, footprint, area and house identity.**

## 4. Scores

Per contender, on the same sheets and the same truth items:
(a) detected (a proposal box contains the truth item's centre, same axis); (b) value correct (corroborating reading =
truth value); (c) orientation correct (vs the truth readers' turn, where R1's two turns differ by ≥ 0.1 mean p); (d)
binding correct (vs binding truth; `UNRESOLVED` counted separately, never as correct); (e) independent scale support:
per sheet and axis, the cluster of value/px over bound, corroborated labels (one per ink); a scale needs ≥ 3 labels on
≥ 2 lines; both axes agreeing within 2 % = "axis-consistent". **False-confident scale** = an axis-consistent scale more
than 3 % from the 005O transcription TRUE_SCALE of the frame (scorer only; reported, never fed back).
False detections: B1 corroborating integer readings that are `NOT_A_DIMENSION` (areas, callouts, off-line numbers,
branding) — counted by class. Resource cost: cold/warm time, peak RSS, model bytes.

## 5. Stop rules and budget

- Smoke (S5) first. If B1 finds no corroborating dimension label outside B0's proposals across the first three failure
  sheets, B2 runs on B0 candidates only and the stage stops there (`NO_GAIN` for discovery).
- No solver replay unless B1 or B2 shows added label/chain evidence on a failure sheet; at most 2–4 houses, read-only.
- No threshold of B1/B2 or of the truth rule is changed after the first score. One run per contender.
- Budget ≈ 2–3 h active before CI.

## Addendum A (before the first score; after the smoke sheet's truth readers ran, no contender scored)

Seen on S5 (the smoke sheet) in the truth readers' TEXT only: Tesseract 5 drops a leading `1` (`190` → `90`, `110` →
`10`) and appends separators (`700.`, `142,`), while R1 (medium) reads the same labels at mean p ≈ 1. Agreement-only
truth would keep 20 of 189 classic-token locations and bias the label set toward the few Tesseract reads well.
Changes, fixed now:

1. Before comparing R1 and R2, leading and trailing `.`/`,` and spaces are stripped from both (inner separators stay).
2. A second, weaker local tier `R1_CONFIDENT`: R1 reads an integer of 2–5 digits at mean p ≥ 0.98 and R2 does not give a
   DIFFERENT digit string of the same length (R2 empty or shorter is not a contradiction; a same-length disagreement is
   `AMBIGUOUS_READ`). R1 is PaddleOCR family like the contender, so this tier is CORRELATED with B0/B1 readings.
3. Scores are reported twice: PRIMARY on `PRIOR_TRANSCRIPTION` + `LOCAL_DOUBLE_READ`; SENSITIVITY adding
   `R1_CONFIDENT`. R1_CONFIDENT is calibrated on the tier-A items (prior transcription) of the same sheets and the
   calibration is reported; value-accuracy claims for B1 rest on PRIMARY only.
4. Truth-reader temp files are per process (two batches ran in parallel; a shared temp file would race).
