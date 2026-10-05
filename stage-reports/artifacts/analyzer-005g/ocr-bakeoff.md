# 005G — numeric OCR bake-off

The production numeric reader and external recognisers read **the same crops**. Every number below is in
`ocr-bakeoff.json` (per label: ids, page byte hashes, boxes, crop pixel hashes, printed value, each engine's reading,
confidence and time). The scripts are in `research/analyzer-005g/`. **No crop or pixel is committed.**

## Dataset (775 labels)

| set | n | what |
| --- | --- | --- |
| REAL | 103 | 81 = 005E's transcribed development labels (`analyzer-005e/calibration/development-labels.json`). 22 = 005G transcriptions: 17 from blind round 5's `dom-w-modrzewnicy` and 5 from round 6's `dom-pod-milorzebem` (`research/analyzer-005g/blind-labels-005g.json`). |
| SYN5001 / SYN9017 | 240 + 240 | 005E's calibration and held-back stroke-face corpora (`synthetic-drawings/digit-corpus.ts`) |
| STRESS | 192 | 005G corpus from the same stroke faces, made of: all digits; 3/4/5-digit values; the confusable pairs 9/4, 4/0, 8/6, 3/5; caps 11–25 px; CLEAN, ITALIC, CONDENSED, CONDENSED_ITALIC, ANTIALIASED_THIN, BLURRED, TOUCHING, BROKEN |

**The real labels cover every house the brief names.** modrzewnicy 17, pod-milorzebem 5, dabecjach 7, tunbergiach 5,
Azalia 5, e-OZE 4, Marcówki 6, Kosaćce 13, plus jablonkach, modrzykach, zurawkach, willa-miranda and rarytasy-g2e.

**How each crop was made** (`build-dataset.ts`).
- Source: the label's box in the pass that reads it upright, cut from the production reader's own pass field (the
  ink channel of the page, turned).
- Padding: 0.35 of the text height.
- Checks: every page's bytes were verified against the sealed `variantByteHash` before use.
- Location: crops live outside the worktree (`/home/user/work005g/dataset/crops`). Their pixel SHA-256 is in the JSON.

**How the 22 blind labels were transcribed.**
- Method: by eye, from 5–6× crops in the pass that reads each label upright.
- Timing: **before any external engine had run.** 38 boxes were excluded: symbols, room labels, hatch, cut-off
  labels, text set across its box.
- Caveat: one transcription is marginal. modrzewnicy's second `120` has its `1` half hidden by a line. It is kept,
  and it is the label most engines read `20`.

## Engines

| engine | version / model (SHA-256) | how it was run |
| --- | --- | --- |
| BuildPlan lattice | `metrics.numeric-lattice` 1.1.0 @ `6b4ab1f` | production code: `readNumbers` + plan style + `labelLattice`; as-read and class |
| PP-OCRv6 tiny rec | HF `PaddlePaddle/PP-OCRv6_tiny_rec_onnx` `9ef676d6…` (4 462 639 B) | ONNX Runtime 1.30.0, 1 thread |
| en PP-OCRv5 mobile rec | `en_PP-OCRv5_mobile_rec_onnx` `b5f833df…` (7 848 423 B) | same |
| latin PP-OCRv5 mobile rec | `7888113…` (8 042 023 B) | same |
| PP-OCRv5 mobile rec (multilingual) | `da72dc72…` (16 534 782 B) | same |
| PP-OCRv6 small rec | `5435fd74…` (21 159 378 B) | same |
| PP-OCRv6 medium rec | `9c09abf0…` (76 554 979 B) | same (quality ceiling only) |
| Tesseract 5 LSTM | tesseract.js 7.0.0 / core 7.0.0, `eng` best_int | PSM 7, digit whitelist, at ×1 and at ×3 upscale |
| RapidOCR 3.9.2 (Python) | the same `en_PP-OCRv5` file | reference implementation of PaddleOCR's pre/post-processing, batch 1 |
| Google ML Kit | — | **not run**: no Android emulator or device in this session (comparison-only by brief) |

**Paddle pre- and post-processing** follow PaddleOCR's `resize_norm_img` (height 48, width ≥ 320, normalise, pad)
and CTC decoding. The engine's own answer is the greedy text. The **digit-constrained top-K** is a CTC prefix beam
(width 24) over {blank, 0–9}, renormalised per frame. It is a fixed, a-priori grammar: dimensions are digits.

**The node harness reproduces RapidOCR on 771 of 775 crops.** The four differences are touching or broken labels
where OpenCV's fixed-point resize and the harness's float resize fall either side of a decision. That is the reason
for the stability bracket below, and for **one** preprocessing implementation shared by CI and the phone.

**"Confident" was fixed when the scorer was written, before any confident-wrong figure existed. It was not tuned.**

| engine | confident means |
| --- | --- |
| BuildPlan | CLEAR or SUPPORTED |
| Paddle | beam posterior ≥ 0.9 **and** greedy mean char prob ≥ 0.9 |
| Tesseract | confidence ≥ 0.8 |

## Results

Each cell reads: exact top-1 · truth in top-3 · truth in top-5 · **confident / confident-wrong** · digit accuracy.

| set (n) | BuildPlan | PP-OCRv6 tiny | en v5 mobile | latin v5 mobile | v5 mobile | v6 small | v6 medium | Tesseract ×3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **REAL (103)** | 49 · 72 · 80 · **44/10** · 75.9 % | **103** · 103 · 103 · **99/0** · 100 % | 101 · 103 · 103 · 96/0 · 99.4 % | 102 · 103 · 103 · 97/1 · 99.7 % | 102 · 103 · 103 · 98/1 · 99.7 % | 102 · 103 · 103 · 100/0 · 99.7 % | 101 · 102 · 102 · 101/0 · 99.0 % | 94 · 94 · 94 · 86/2 · 96.1 % |
| REAL blind + TARGET (34) | 12 · 16 · 20 · 12/5 · 65.7 % | 34 · 34 · 34 · 30/0 · 100 % | 32 · 34 · 34 · 30/0 · 98.0 % | 33 · 34 · 34 · 31/1 | 33 · 34 · 34 · 30/1 | 33 · 34 · 34 · 32/0 | 32 · 33 · 33 · 32/0 | 27 · 27 · 27 · 23/0 · 90.2 % |
| REAL cap 11–13 px (63) | 27 · 40 · 45 · 24/5 | 63 · 63 · 63 · 60/0 | 61 · 63 · 63 · 57/0 | 62 · 63 · 63 · 58/1 | 62 · 63 · 63 · 60/1 | 62 · 63 · 63 · 61/0 | 61 · 62 · 62 · 61/0 | 57 · 57 · 57 · 51/1 |
| SYN5001 (240) | 135 · 172 · 185 · 108/22 | 233 · 240 · 240 · 224/3 | 234 · 237 · 240 · 231/3 | 235 · 238 · 239 · 228/1 | 235 · 238 · 240 · 226/1 | 237 · 240 · 240 · 232/2 | 238 · 240 · 240 · 235/1 | 196 · 196 · 196 · 193/13 |
| SYN9017 (240) | 128 · 175 · 187 · 117/22 | 236 · 240 · 240 · 220/0 | 237 · 239 · 240 · 230/2 | 238 · 240 · 240 · 237/2 | 238 · 240 · 240 · 229/0 | 239 · 240 · 240 · 234/1 | 239 · 240 · 240 · 240/1 | 200 · 200 · 200 · 189/6 |
| STRESS (192) | 37 · 76 · 81 · 40/21 | 186 · 191 · 192 · 164/1 | 190 · 191 · 192 · 183/1 | 189 · 192 · 192 · 180/1 | 189 · 192 · 192 · 183/1 | 191 · 192 · 192 · 191/1 | 191 · 192 · 192 · 191/1 | 135 · 135 · 135 · 127/7 |
| **ALL (775)** | 349 · 495 · 533 · **309/75** · 74.5 % | 758 · 774 · 775 · **707/4** · 99.5 % | 762 · 770 · 775 · 740/6 · 99.5 % | 764 · 773 · 774 · 742/5 | 764 · 773 · 775 · 736/3 | 769 · 775 · 775 · 757/4 | 769 · 774 · 774 · 767/3 | 625 · 625 · 625 · 595/28 · 89.5 % |

### The brief's regimes (exact / confident-wrong)

| regime | BuildPlan | PP-OCRv6 tiny | en v5 mobile | Tesseract ×3 |
| --- | --- | --- | --- | --- |
| condensed (48, stress) | 1 / 5 | 46 / 0 | 48 / 0 | 24 / 3 |
| condensed italic (24) | **0 / 4** | 22 / 0 | 24 / 0 | 6 / 2 |
| cap 11–13 px (64, stress) | 16 / 4 | 62 / 0 | 64 / 0 | 44 / 2 |
| cap 20–25 px (64, stress) | 6 / 8 | 64 / 0 | 64 / 0 | 47 / 1 |
| touching (24) | 1 / 0 | 23 / 0 | 24 / 0 | 0 / 2 |
| broken strokes (24) | 1 / 4 | 22 / 1 | 22 / 1 | 20 / 2 |
| blurred (24) | 4 / 0 | 24 / 0 | 24 / 0 | 21 / 0 |
| confusable pairs 9/4 4/0 8/6 3/5 (136) | 24 / 17 | 131 / 1 | 134 / 1 | 99 / 5 |

**Matched coverage.** Rank each engine's readings by its own confidence and take as many as BuildPlan trusts:

| set | BuildPlan's trusted count | BuildPlan wrong among them | every Paddle model wrong among its top that many | Tesseract wrong |
| --- | --- | --- | --- | --- |
| REAL | 44 | 10 | 0 | 0 |
| ALL | 309 | 75 | 0 | ×1: 7, ×3: 3 |

### The labels that failed the blind rounds

| house (round) | printed | BuildPlan (class) | PP-OCRv6 tiny (p) | en v5 mobile (p) | Tesseract ×3 |
| --- | --- | --- | --- | --- | --- |
| modrzewnicy (R5) | **2590** | 1140 (AMBIGUOUS) | **2590** (0.9998) | 2590 (0.9987) | 2590 |
| modrzewnicy (R5) | **1950** | 1410 (**SUPPORTED**) | **1950** (0.9978) | 1950 (0.9999) | 1950 |
| modrzewnicy (R5) | 640 | 600 (AMBIGUOUS) | 640 (0.999) | 640 | 640 |
| pod-milorzebem (R6) | **648** | 608 (**SUPPORTED**) | **648** (0.9999) | 648 (0.9998) | 648 |
| dabecjach (R4) | 1580 | 1580 (CLEAR) | 1580 | 1580 | 1580 |
| tunbergiach (R4) | 1173 | 1171 (AMBIGUOUS) | 1173 (0.9994) | 1173 (0.958) | 1173 |
| Azalia (R3) | 1035 | 1035 (AMBIGUOUS) | 1035 | 1035 | 1035 |

The two confident misreads behind the round-5 and round-6 refusals (`1950 → 1410`, `648 → 608`, both SUPPORTED) are
read right, near p = 1, by every Paddle model. So is the condensed overall `2590`, which 005F could not fix.

**Where the Paddle models do fail on real labels**, the posterior is low and the stability bracket flags it:
- modrzewnicy `271`, fused with a hatch symbol (v6 tiny p 0.38, en v5 0.46);
- the half-hidden `120` (en v5 `20` p 0.88, v6 tiny `120` p 0.52).

latin v5's `20` at p 0.986 on that `120` is its one confident miss.

## Integration architectures

| architecture | ALL: confident / wrong | REAL: confident / wrong | external calls | note |
| --- | --- | --- | --- | --- |
| BuildPlan alone (CLEAR/SUPPORTED) | 309 / **75** | 44 / **10** | 0 | baseline |
| **OCR-1 replacement** (v6 tiny) | 707 / 4 | 99 / 0 | 775 | loses BuildPlan as an independent witness |
| **OCR-2 ensemble, strict** (both top-1 agree, external confident) | 336 / **0** | 49 / 0 | 775 | safe, but coverage 43 %: every BuildPlan misread blocks a right reading |
| **OCR-2 ensemble, external-led + stability bracket** (P2, v6 tiny): confident when the external is confident **and stable** under pad2/trim1/scale90, and no BuildPlan CLEAR/SUPPORTED reading contests it | 631 / 2 | 88 / **0** | 775 × 4 | recommended |
| OCR-2, two external models agree (P3, v6 tiny + en v5, both stable) | 676 / 2 | 92 / 0 | 775 × 8 | +7.8 MB and ~3× time for +45 confident labels |
| **OCR-3 fallback** (external only when BuildPlan is LOW_QUALITY / AMBIGUOUS / not found or cap < 14 px) | 715 / **64** | 99 / 5 | 556 | **worst**: BuildPlan's own confident misreads (61 of the 64) never reach the external reader. "Metric conflict" as a trigger could not be simulated per label. |

**The stability bracket.** Re-read the same crop with 2 px more paper, 1 px less, and at 90 % size; a reading is
stable when all four agree.
- PP-OCRv6 tiny: 749 of 775 stable; 9 of its 17 wrong readings are flagged unstable. Cost: 17 right readings unstable.
- Confident and stable and still wrong: 3 of 775 for v6 tiny, **0 of 103 real** for every model bracketed.
- The bracket is the external analogue of the lattice's existing `STABILITY_BRACKET`, chosen a priori.

## Runtime (one thread, uncontended, 775 crops; desktop x86-64)

| | load | mean / p95 per label | RSS peak | model |
| --- | --- | --- | --- | --- |
| BuildPlan lattice (Node 22) | — | 17 ms median (max 45) per label, plus `readNumbers` 0.34–0.84 s per page | — | — |
| PP-OCRv6 tiny, **onnxruntime-web WASM on Node 18.20.4** | 522 ms | **44 / 61 ms** | 261 MiB | 4.46 MB |
| PP-OCRv6 tiny, onnxruntime-node native (Node 22) | 63 ms | 14.5 / 20.9 ms | 178 MiB | |
| en v5 mobile, WASM on Node 18 | 661 ms | 126 / 162 ms | 283 MiB | 7.85 MB |
| v6 small, WASM on Node 18 | 542 ms | 189 / 245 ms | 308 MiB | 21.2 MB |
| Tesseract ×3, tesseract.js on Node 18 | 443 ms | 20 / 34 ms | 180 MiB | 2.95 MB traineddata |

**Parity.**
- PP-OCRv6 tiny, en v5 mobile and v6 small give the **same greedy text and the same top-K order on 775/775**,
  native against WASM.
- Native and WASM probabilities differ by ≤ 3.1e-5.
- **WASM on Node 18 and WASM on Node 22 are bit-identical** (Δ = 0).
- A bundled ORT-web run on Node 18 with the no-ICU shim gives the same output tensor hash as on Node 22
  (`deployment-matrix.md`).
- **arm64 V8.** The official Node 18.20.4 linux-arm64 build under qemu (WASM): 39 real labels (34 blind + TARGET,
  5 Marcówki) identical to x86-64 in text, confidences and top-K posteriors; 34/34 exact. The raw output tensor hash
  also matches (`deployment-matrix.md`).
- Tesseract on Node 18 and on Node 22: 775/775 same text.

## Verdicts and answers

| question | answer |
| --- | --- |
| Q1. Keep improving the custom classifier alone? | **No.** On these crops the template matcher's trusted readings are wrong 75 times in 309. 005F's own calibration record says the class "cannot see a misread the matcher is sure of" (`analyzer-005f/calibration/README.md`). A pretrained 4.5 MB recogniser is wrong 4 times in 707 trusted readings on the same crops. Keep the lattice (orientation, segmentation, count hypotheses, non-circular metric); stop tuning the glyph classifier. |
| Q2. Adopt an external OCR recogniser? | **Yes.** |
| Q3. Which, and how? | **PP-OCRv6_tiny_rec, official ONNX, SHA-256 `9ef676d6…`**, as an **OCR-2 ensemble member with a stability bracket** (P2). The external reading is a candidate source in the lattice. BuildPlan's values stay candidates. A disagreement with a CLEAR/SUPPORTED lattice reading is AMBIGUOUS with both values, and the metric resolver decides. Never replacement (loses a witness); never fallback (does not see confident misreads). en_PP-OCRv5_mobile is the PILOT alternative if v6 tiny misses the next blind protocol. |
| Q4. CI and Android? | **Yes, the same bytes.** `onnxruntime-web` WASM runs inside the existing Node-18 analyzer bundle in CI and on the phone (`deployment-matrix.md`). It is bit-identical on arm64 V8 under emulation. Not yet run on an Android device: that is the integration stage's first gate. |

**Tesseract: REJECT.** It is 89.5 % exact with 28–52 confident misreads on 775, collapses on condensed (24/48) and
condensed italic (6/24), and offers no top-K beyond per-symbol choices.

**ML Kit: REJECT** as a canonical dependency: proprietary, usage metrics to Google, Android-only so it breaks CI
parity. Not measured.
