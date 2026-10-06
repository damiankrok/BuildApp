# Reviewer B — vision-language models and edge AI (BUILDPLAN-ANALYZER-005J post-review)

**Verdict: CONDITIONAL PASS.** No P0. The rejection of ADOPT_SMALL_VLM_REFEREE and the "not now" for Route A survive
every re-analysis I ran: prior-free metrics, matched subsets, and a re-run of SmolVLM2 at its default image resolution.
These checks make the negative result stronger, not weaker. Four evidential statements are wrong or claim too much,
and must be corrected before the recommendation is quoted as evidence (B1–B4, P1).

**Independence.** I did not open `reviewer-A/C/D/E-*.md` or `resolution.md`. `recommendation.md` cites post-review
finding ids (A2, C1, E5 …), and I read those citations only as they appear in that file.

**What I recomputed.**
- Everything below was recomputed from `/home/user/work005j/bench/*.jsonl`, `items-all.jsonl`, the oracle key and
  answers, `onnx/wasm-*.json`, and the pinned model files. Scripts and outputs live in my scratchpad only; nothing
  else was written.
- I ran two new measurements with the bench's own `SmolVLM2` class, the same ONNX files and the same prompts:
  - SmolVLM2 with the processor's **default image splitting** (B2);
  - SmolVLM2 with the forced prefix preceded by the space the model itself emits (B8).
- Exclusions: `exclusions.json` is applied throughout, so 4 blind-8 rows are gone.

---

## Findings

### B1 — P1 — "On the same closed questions" is false: every arm was scored on a different, non-random subset

`recommendation.md:24` says "On the same CANDIDATE_OVERLAY questions". The stage report says the same at `:49` ("On
the same closed questions"). After the 18:13:38 cut-off, the arms cover very different parts of the pool.

Coverage was recounted from the run files. Counts are ENUM_SCORE before exclusion; the bake-off n are after exclusion.

| arm | SYNTH CAND | REAL_DEV CAND | blind-8 CAND | SYNTH RAW / SEM | REAL_DEV RAW / SEM | blind-8 RAW / SEM |
| --- | --- | --- | --- | --- | --- | --- |
| SmolVLM2 | 614 / 672 | 289 / 564 (282 NORMAL + **7 MIRROR**; 7 houses) | 68 / 68 | 272 / 307 | **0 / 0** | 52 / 68 |
| Moondream | 262 / 672 | 187 / 564 (NORMAL only; **5 of 7 houses**, no zurawkach or miranda) | 68 / 68 | 7 / 6 | 0 / 0 | 4 / 4 |
| Florence-2 | **2** / 672 | **29** / 564 (NORMAL only; **one house**, jarzabem) | 68 / 68 | 0 / 0 | 0 / 0 | 12 / 3 |
| oracle | 102 (stratified) | 30 (NORMAL only) | 16 (NORMAL only) | — | — | — |

Three consequences:

1. **The pooled headline mixes different sets.**
   - SmolVLM2's 967 rows are 63 % synthetic.
   - Florence-2's 95 rows are 67 % blind-8.
   - The oracle's 148 rows are 69 % stratified synthetic.
   - The headline table (`vlm-bakeoff.md` §1) therefore compares different question mixes.
   - The stage report's row "Florence-2-base, ENUM_SCORE (real sets only)" is also wrong: 2 synthetic rows are in it.
2. **Consistency figures are almost entirely synthetic.** The mirror and rotation figures for the small VLMs come
   from synthetic data plus 16 blind-8 base questions, because the NORMAL-first order left REAL_DEV mirror pairs nearly
   unmeasured (SmolVLM2 has 7, the others 0). SmolVLM2's "43 % mirror consistency" is essentially a synthetic number.
3. **The mode comparison is confounded.** The claim "RAW and SEMANTIC_OVERLAY are no better … 54 % and 46 %" compares
   different set mixes. On the **319 questions SmolVLM2 has in all three modes** (271 synthetic + 48 blind-8), it is
   right on:
   - RAW: 121 / 224 answered (54.0 %);
   - CANDIDATE_OVERLAY: 105 / 213 (49.3 %);
   - SEMANTIC_OVERLAY: 123 / 237 (51.9 %).

   The conclusion holds; the 46 % does not.

**The conclusion survives on matched subsets** (recomputed; CANDIDATE_OVERLAY, ENUM_SCORE):

| matched set | oracle | SmolVLM2 | Moondream | Florence-2 | micro-referee |
| --- | --- | --- | --- | --- | --- |
| oracle ∩ SmolVLM2 (142) | 138 / 141 answered right, 0 cw | 46 / 100, 7 cw (4.9 %) | — | — | 107 / 142 |
| oracle ∩ Moondream (127) | 123 / 126 | — | 23 / 49, 5 cw | — | 96 / 127 |
| blind-8, all transforms (64) | (16 NORMAL: 16 / 16) | 15 / 41, 9 cw (14.1 %) | 4 / 12, 1 cw | 12 / 32, 20 cw (31.2 %) | 47 / 64, 5 cw |
| REAL_DEV, SmolVLM2 ∩ Moondream (187) | — | 59 / 133, 13 cw | 33 / 52, 4 cw | — | 98 / 187, 60 cw |

(cw = confident wrong at ≥ 0.80.)

**Fix.**
- Replace "the same questions" with "the same pool; each arm's subset is stated".
- Add the matched table.
- Label the Florence-2 row "blind-8 + one development house + 2 synthetic".
- Say that the small-VLM consistency figures are synthetic.

**Bias from the re-ordering.** I see none:
- The re-ordering criterion (set and mode, blind-8 and real CANDIDATE_OVERLAY first) does not depend on any model
  output.
- `partial.json` (16:15) held no real-set small-VLM result when the order files were written (17:26–17:31).

### B2 — P1 — SmolVLM2 was judged at 1/17 of its default visual budget; scope the capability claim to the deployable configuration

`vlm_bench.py:96-97` sets `do_image_splitting=False` and `size={'longest_edge': 512}`. The pinned snapshot's
`preprocessor_config.json` ships `do_image_splitting: true` and `size.longest_edge: 2048`. For a 512² crop, the default
path upsamples to 2048 and feeds 16 tiles plus a global view: **1,088 image tokens instead of 64**.

At 64 tokens, each language-model token summarises a 64 × 64 px block of the 512² crop.
- The crops are a median **10 m** wide (6.6–32.5 m, recomputed from `cropBoxPx` and `pxPerM`), so one token
  block covers **≈ 1.25 m** of drawing (0.8–4 m).
- The evidence the gap classes depend on is 1–3 px: glazing lines, door leaves, dashed overhead lines.

The bench also differs from the model card in two other ways:
- an int8 decoder;
- a forced prefix without the model's own leading space (B8).

The verdict "Generic small VLMs cannot referee BuildPlan's questions" (stage report `:49`; recommendation Q3) is
therefore a verdict on **SmolVLM2-500M in its deployable 64-token ONNX configuration**. The docs nowhere say so: the
bake-off pages and the recommendation never mention the 64 tokens.

**Measured here.** I re-ran ENUM_SCORE with the default splitting (1,290 prompt tokens; ≈ 16–30 s per question on 4
desktop threads). It used the same ONNX files, prompts and scorer, on 68 matched items: the 16 blind-8
CANDIDATE_OVERLAY NORMAL questions and all 52 synthetic CANDIDATE_OVERLAY NORMAL questions of seed s0.

⟪PROBE_TABLE⟫

**Why the rejection still stands.** The 1,088-token configuration is not deployable. In the shipped runtime it costs
about 17 × 11.9 s of vision encoder plus a 1,290-token prefill, which comes to **≈ 225 s per question** (a linear
extrapolation from the measured WASM parts).

**Fix.** State the configuration (64 tokens, int8 decoder, fp32 vision, forced prefix) wherever the zero-shot result is
quoted, and cite this probe.

### B3 — P1 — Florence-2 STRUCTURED cannot answer OPENING on any real gap: "its grounding found no window (8 of 8 UNRESOLVED)" is a scoring artefact

**Where the target box comes from.**
- `compose.py:186-187` builds `targetBox512` from the min / max of the target points.
- A gap target is two points on the wall line, so the box has **zero area**. For example, cyklamenach
  OPENING_VS_PATTERN-0 is `[196, 256, 316, 256]`.

**Why the hit test can never fire.**
- `vlm_bench.py:320` then sets `area = max(1.0, 0) = 1`.
- For any box, the overlap height `iy = min(256, b[3]) − max(256, b[1]) = 0`.
- So `ix*iy ≥ 0.5` (`:327`) can never hold.

**How many items this affects.** Every real OPENING_VS_PATTERN target is degenerate: 63 REAL_DEV, 8 blind-8, and 8 of
the 18 synthetic RAW ones. The read-out can only ever say UNRESOLVED on them.

**What Florence actually returned** (`florence2.jsonl`):
- On 3 of the 8 blind-8 crops (0-MIRROR, 0-ROT90, 0-ROT180) it returned a box of 94–97 k px² that contains the
  target line and passes the "≤ 50 % of the crop" cap.
- With any non-degenerate target box, those 3 would have scored OPENING, which is the expected answer.
- Those boxes are 36–37 % of the crop: region boxes, not window detections.
- On the other 5 crops, every box containing the line exceeded the cap.

**Correct reading:** "the grounding test was degenerate for line targets. With a proper target it would have said
OPENING on 3 of 8, through coarse region boxes; nothing was localised on the window". The claim is repeated in
`recommendation.md:24` and the stage report §E.

**Fix.**
- Restate the claim.
- If STRUCTURED is ever reused, give gap targets a box: the jamb-band rectangle, the gap length × the wall thickness.

It does not change the Florence-2 verdict. Florence-2 has no VQA task, and its ENUM_SCORE returns one answer per class
at 0.99–1.00 (B7).

### B4 — P1 — The decisive edge argument is per house, not per question, and "≈ 16 s" is the floor, not the median

**The per-question figure.** `android-deployment-matrix.md:37` says "3–4 answers scored token by token … ≈ 16 s".
That is vision 11.9 s plus a 210-token prefill 3.8 s, which is ≈ 15.7 s **before any scored token**. The bench's
scorer (`vlm_bench.py:159-174`) actually needs:
- a prompt of median **230** tokens (206–307 across the run's records);
- **8–19 decoder steps**, median 10 (for example YES / NO / UNRESOLVED = 8; CONTINUES / TERMINATES / NOT_SAME_WALL /
  UNRESOLVED = 19), at 0.151 s each (`wasm-smolvlm2.json`, decoder step).

| question shape | measured WASM parts (desktop core, one thread) |
| --- | --- |
| YES / NO (206 tokens, 8 steps) | **16.9 s** |
| median (230 tokens, 10 steps) | **17.6 s** |
| WALL_CONTINUATION / OPEN_SIDE (307 tokens, 19 steps) | **20.4 s** |
| GEN_JSON, median 9 new tokens / 48-token cap | 17.3 s / 23.2 s |

**The house-level number is the one that matters.** The recommended witness is asked unconditionally, for every
eligible gap: 7–64 per house, median 24 (`server-feasibility.md:9-14`). A VLM witness in the shipped runtime would
therefore cost:
- **≈ 7 min per median house, 2–19 min per house**, on a desktop core;
- ×2–×5 more on a phone core.

That is decisive against any VLM witness on device, fine-tuned (Route A) or not. The bake-off's zero-shot accuracy is
not the deciding evidence for a fine-tune (B13). The stage should quote the house-level number.

**Also wrong in the latency tables.**
- **Desktop medians pool cached-vision rows.**
  - "SmolVLM2 2.5 s (enum)" (stage report §E, `technology-matrix.md`) is the median of two populations:
    - 783 score-only rows include the vision encoder: **4.5 s** median;
    - 887 rows reuse the GEN pass's features: 1.6 s.
  - `server-feasibility.md:34` ("ENUM_SCORE ≈ 1.2–3.5 s") and its capacity claim inherit this. The claim is
    "1,000–2,500 questions per hour per core", while the runs used 2 threads.
- **"≥ 1.9 GiB per question"** (`recommendation.md:14`, stage report `:15`). This is a process peak sampled after the
  vision run, not a per-question cost. WASM memory never shrinks, and decoder and vision in one wasm32 instance sit
  under a 4 GiB ceiling.

**What checks out.** No text-only figure is quoted as an image latency:
- LiteRT-LM and llama.cpp image rows are UNMEASURED and labelled;
- the S26 figures are marked text path.

The UNet 1.19 s per 864² frame (median of 3; p95 = max) and the micro-referee 70 ms (median of 20) are read correctly
from `wasm-unet.json` and `wasm-micro.json`. The UNet's "≈ 0.1 s per 256² crop" is labelled as scaled, not measured.

### B5 — P2 — The oracle is fair as solvability evidence on synthetic questions; on real questions it is weaker than "30/30, 16/16" reads

I rescored it from `key-DO-NOT-SHOW.json` and `answers-part*.jsonl`:
- every `imageSha256` matches the key;
- no note names a house or a publisher.

1. **The 0 confident-wrong depends on the threshold.**
   - The three wrong answers sit at self-reported 0.75, 0.75 and 0.70. At ≥ 0.75 the oracle has 2 confident-wrong
     (1.4 %); at ≥ 0.70 it has 3 (2.0 %).
   - With 0 / 148, the one-sided 95 % upper bound is ≈ 2.0 %, so the oracle does not demonstrate the 0.5 % gate either.
   - Its confidences are verbal self-reports clustered at 0.75–0.93. Placing "0.0 %" beside ENUM-probability
     confident-wrong rates (7.2 %) compares different quantities.
   - Its accuracy (144 of 147 answered) is the robust figure.
2. **The real half is NORMAL-only and one-sided in the gap classes.**
   - All 8 real gap questions in the sample expect the majority answer (OPENING / CONTINUES).
   - A constant guesser scores 25 / 30 on the REAL_DEV sample and 13 / 16 on blind-8. The md does print the 83.3 % and
     81.3 % floors.
   - The region and outline classes do carry both answers, so the solvability claim holds there.
3. **The real truth and the oracle share a reader.**
   - REAL_DEV truth is the 005I manual truth, "annotated by the study agent, a stated limitation" (005I report `:239`).
     Blind-8 truth is the accepted 005I diagnosis.
   - Both are agent readings by the same model family that answers as the oracle.
   - The real agreement is therefore an upper bound on solvability, not independent evidence. The synthetic
     **97 % (98 / 101 answered)** against generator semantics is the clean solvability figure.
4. **The 47 publisher crops** are disclosed in the stage report (`:39-43`) and `licensing-matrix.md`. Reported honestly.

### B6 — P2 — In `garage_door_vs_open`, the candidate overlay is drawn on top of the evidence

All three of the oracle's errors are this family's open-front B variants (`o000`, `o034`, `o070`; GARAGE_BODY, expected
NO, answered YES).

**What the images show.**
- In the composed images, the red candidate outline runs exactly along the gap. It covers the dashed garage-door line
  that distinguishes A from B, and it draws a closing line across the open front of B.
- The A/B pixel difference shrinks from a median of 442 px (RAW) to 332 px (CANDIDATE_OVERLAY). A 6× zoom shows the
  dashes under the outline.
- This family is the minimal pair of the whole corpus. Every other family differs by ≥ 1,000 px, most by ≥ 7,000 px.

**Other arms fail here too.**
- The micro-referee answers YES on 10 of 12 NO.
- SmolVLM2 answers YES on 9 of 12.

**It does not bias the comparison between arms.** Every arm saw the same bytes. But two things follow:
- these 24 GARAGE_BODY CANDIDATE_OVERLAY items are malformed in the same sense as the excluded C2 question;
- 005K's generator v2 must not draw overlays on the evidence. The planned mask channels (`training-plan.md` Route C)
  avoid this.

**Related.** In 50 synthetic items, SEMANTIC_OVERLAY is byte-identical to CANDIDATE_OVERLAY, yet the prompt still says
"Green strips mark wall-thick ink".

### B7 — P2 — The summary metrics flatter or blur; prior-free metrics confirm the verdict more sharply

**Answering is not reading.**
- The small VLMs answer almost constantly per class:
  - SmolVLM2: NEITHER on 79 / 82 outline questions; TERMINATES on 34 / 63 real CONTINUES questions.
  - Moondream: NO on 50 of 51 answered synthetic BODY_REGION questions and on all 37 answered synthetic GARAGE
    questions; ENCLOSED on every answered TERRACE question, in every set.
  - Florence-2: CONTINUES, NEITHER, ONE_OPEN_SIDE or UNRESOLVED at 0.99–1.00.
- Several summary metrics reward this.

**Where the metrics mislead.**
- **"Majority floor" uses the wrong denominator.**
  - It is computed over all items and then compared with accuracy among answered.
  - On the answered subsets, the floors are: SmolVLM2 61.7 % (vs 45.0 %), Moondream 52.0 % (vs 46.1 %), Florence-2
    75.7 % (vs 40.5 %).
  - The pooled claim holds. On REAL_DEV, though, Moondream is 63.5 % right on what it answers, against a 50 % floor
    for that subset. It achieves that by abstaining by class, not by reading.
- **The "minority" read-out credits a constant minority guesser.**
  - Moondream's "35 / 36" synthetic minority score comes from answering NO everywhere in two YES-majority classes.
  - `training-plan.md` gate 4 adopts "minority-answer accuracy" as a gate metric. It must be read with per-answer
    recall, or simply balanced accuracy.
- **Consistency of a constant answerer is trivially 100 %.** Florence-2's 100 % mirror / rotation comes from 8 / 16
  answered pairs.
- **"Same answer to both" counts abstentions in the denominator.** Among counterfactual pairs that both members
  answered:

| | both right | same answer | uniform-chance "both right" |
| --- | --- | --- | --- |
| SmolVLM2 (142 pairs) | **19.0 %** | **57 %** (31.4 % reported) | 22.7 % |
| Moondream (50 pairs) | **0 %** | **94 %** (43.5 % reported) | 23.9 % |
| micro-referee (288 pairs) | 76.4 % | 21.5 % | 22.1 % |

**A threshold-free check finds no hidden signal.** Per-class AUROC of the option log-odds, CANDIDATE_OVERLAY:
- **SmolVLM2:** 0.40–0.67 per class with the sets pooled, and 6 of 13 are below 0.5. The only nominal p < 0.05
  results are OPENING_VS_PATTERN (0.67) and OUTER_BOUNDARY (0.61), which is what chance gives over 13 tests.
- **Moondream:** 0.22–0.81. Only GARAGE_BODY (0.72, synthetic) reaches p < 0.01.
- **On real sets:** every SmolVLM2 and Moondream class AUROC lies in 0.25–0.73. Florence-2 reaches 0.90 on
  BODY_REGION, but on 9 items from one house.
- **Micro-referee, for contrast:** 0.72–1.00 on synthetic.

Prior calibration (contextual calibration, or a threshold sweep on the log-odds) would therefore not rescue the small
VLMs.

**Recommendation.** Report per-class AUROC and pair accuracy beside the 0.80-threshold metrics in 005K's gates.

### B8 — P2 — ENUM_SCORE is implemented correctly; one mild off-distribution prefix; the Florence padding rows are harmless

**SmolVLM2 and Moondream tokenisation.**
- `tok(prefix + option + '"') == tok(prefix) + tok(option + '"')` for all 18 options, with both tokenizers. No
  boundary merge occurs, and Moondream's `encode` adds no BOS.
- The closing quote is scored, which separates prefixes such as OPEN / OPENING.
- The first token's denominator is shared, so length bias is small.

**The prefix.** The forced string follows `Assistant:` with no space, as `{"` (id 39428). SmolVLM2's own outputs begin
` {` / ` "` (id 9583). It is a mild off-distribution prefix.

**Measured.** First, re-running the bench configuration on 6 items reproduced the recorded probabilities to
≤ 4 × 10⁻⁶, so the harness is deterministic. Then I re-scored the 68 B2 items with a space-led prefix (`' {"answer": "'`):

| | 64 tokens, bench prefix | 64 tokens, space-led prefix |
| --- | --- | --- |
| right / answered | 21 / 49 | 19 / 46 |
| confident wrong (≥ 0.80) | 4 | 3 |
| pooled AUROC | 0.53 | 0.56 |

The two prefixes give the same argmax on 41 of 68 items. So the prefix moves individual answers, but not the verdict:
it is not a handicap that hides capability.

**Florence-2-base's 39 padding rows.**
- Rows 51,289–51,327 of `model.language_model.shared.weight` are **identical (max |Δ| 3e-5) and equal to the mean of
  the real rows** (cosine 0.99999997).
- The head is tied and `final_logits_bias` is zero, so each padding logit equals the **mean** real logit at that
  position.
- By Jensen's inequality, their total softmax mass is ≤ 39 / 51,289 = **0.076 %** of the partition. That is ≤ 7.6 ×
  10⁻⁴ nats per scored token, and it cancels exactly on the first option token (shared context).
- A padding row can never be argmax.
- **No effect on ENUM_SCORE or generation.**

**Florence-2 scoring.**
- Florence's ENUM_SCORE uses labels shifted with the correct `n_pre` (the prefix without `</s>`; option tokens plus the
  quote).
- The prompt (≈ 200 tokens) plus 577 image tokens fits the 1,024-position encoder.
- The method is sound. The model is the wrong tool: there is no VQA task, so the score measures its decoder's text
  prior.

**Moondream preprocessing.** At 512² the 0.0.6 client picks template (1, 1) (`preprocess.py`: `max_dim < 378 × 1.4`).
Moondream therefore sees **one 378² global view (0.74× downscale) and no crops**. The docs say "378² crops + global"
(`android-deployment-matrix.md:24`, `vlm/vlm-audit.md:161/207`); correct them.

**Other handicaps, untested.** Two more SmolVLM2 handicaps are real but untested: the int8 decoder, and the long
instruction-plus-JSON prompt. B2 bounds the largest one.

### B9 — P2 — GEN_JSON parsing is fair; the lenient parser has two latent false positives

**STRICT.** 2 % STRICT is a property of the model. Of the 887 generations:
- 118 are empty (EOS first);
- 99 hit the 48-token cap in prose.

**LENIENT** upper-cases the text and takes the earliest enum word. Two latent false positives:
- the article "a" can become option A on outline questions (0 occurrences found);
- a prompt echo such as `<one of: CONTINUES, …>` yields the first option (2 occurrences).

The 28 outline answers of the form "… is A." are genuine. Neither defect moves a conclusion.

### B10 — P2 — Coverage: robust, but say what is missing

**What the run did not measure.**
- **Moondream GEN:** 33 rows. Its zero-shot verdict rests on ENUM_SCORE alone, which is acceptable.
- **SmolVLM2 on REAL_DEV:** no RAW or SEMANTIC_OVERLAY rows at all.
- **Florence-2:** 2 synthetic rows and one development house.

**Why the conclusions survive.**
- Every conclusion in the recommendation is also supported by the complete blind-8 CANDIDATE_OVERLAY set (64 rows for
  every arm) and by the matched subsets (B1).
- A blind-8 result is **development evidence on two houses and 17 base questions**, not a sample. The 64 rows are 4
  transforms of 16 base questions, so they are correlated.
- Intervals on n = 41 answered (SmolVLM2) are ±15 pp.

### B11 — P2 — The Route C pilot reading is fair, and the data say something sharper

The text says the pilot is "NEGATIVE ON REAL (pilot)", with REAL_DEV below the majority floor and 34 % confident-wrong.
That is correct. Three additions:

1. **The real signal is inverted, not absent.** The pilot's per-class AUROC on REAL_DEV is:
   - **0.26** on TERRACE_VS_BODY (50 / 48) and **0.31** on CANOPY_PERGOLA;
   - 0.57 on BODY_REGION;
   - 0.80 on WALL_CONTINUATION (4 negatives).

   On synthetic data it is 0.72–1.00. The classifier learnt a synthetic texture shortcut that reverses on publisher
   sheets. That is why confident-wrong persists even at 0.999 (1.2 %). A confidence threshold cannot fix it; only real
   style in training data, or a pixel-level observation underneath, can. The recommendation's §6 gate (the balanced
   real set first) is the right response.
2. **The pilot tested a different design.**
   - It has **no abstention output** (heads of 2–3 classes; coverage 100 % by construction).
   - It reads the **RGB overlay image**, not the planned grey crop plus mask channels plus Route-B map.
   - The negative result applies to "an overlay-image classifier trained on synthetic data only".
3. **Stale numbers.** `training-plan.md:56` quotes REAL_BLIND8 70.6 % / 7.4 %. Those are the pre-exclusion 48 / 68 and
   5 / 68; the bake-off says 73.4 % / 7.8 % on 64 rows. The pages also disagree on REAL_DEV: 49.7 % in some, 49.6 %
   (280 / 564) in others.

### B12 — P2 — The deployment matrix could have tried an int8 vision encoder that ORT supports

The official int8 vision graph fails on `ConvInteger`. In SigLIP the only convolution is the patch embedding.

**Untried route.** A MatMul-only dynamic quantisation keeps that conv in fp32 and uses `MatMulInteger`, which
ORT-web does run. It would plausibly cut the 11.9 s vision time 2–3×.

**Why it does not matter here.** Per house, the cost stays in minutes (B4), and accuracy is the binding constraint
(B2, B7). Record it as UNTRIED, not as impossible.

### B13 — P2 — The reason given for "Route A not now" is the weakest of the available ones

`training-plan.md:95-100` gives "at or below chance zero-shot" as the first reason. Zero-shot accuracy says little about
a fine-tune. A fine-tuned VLM is a different model. The pretrained SigLIP features might transfer from synthetic to real
better than the from-scratch pilot did, and nobody has measured that.

The decisive reasons are:
1. the per-house cost under unconditional asking (B4): minutes per house on a desktop core, before the ×2–5 phone
   factor;
2. the measured transfer failure of synthetic-only image-level training (B11), which a fine-tune on the same data
   inherits unless the pretrained features close it;
3. the base model's training-data provenance (licensing).

**A cheap way to settle point 2 offline**, if Route C stalls: a frozen-encoder linear probe. Take SmolVLM2's SigLIP
features, train on the pilot's synthetic items and evaluate on REAL_DEV. It is CPU-feasible in about an hour.

"Not now" is fair. Re-order the reasons.

---

## Position on the primary recommendation

**From the VLM and edge side, TRAIN_BUILDPLAN_WALL_MODEL as a two-signal gap witness, run as a tiled pre-pass, is the
right primary.**

**The only arm that is both accurate and edge-feasible.**
- A 6 MB from-scratch network costs 1.19 s per 864² frame in the WASM runtime the app already ships, and it answers
  every eligible gap of a house from 4–8 frame passes.
- A 500 M VLM needs ≈ 17–20 s **per gap** in the same runtime. That is ≈ 7 minutes for a median house (24 gaps) on a
  desktop core, ×2–5 on a phone. In the 64-token configuration that fits, it reads the questions no better than
  chance.

**ADOPT_SMALL_VLM_REFEREE is rightly rejected, and the rejection is robust.**
- Matched subsets (B1), per-class AUROC and counterfactual pair accuracy (B7) all show it.
- At the model's default 1,088-token resolution (B2) ⟪PROBE_ONE_LINER⟫, and that configuration costs ≈ 225 s per
  question in the shipped runtime.

**Route A "not now" is fair.** Its first stated reason should be cost and transfer, not zero-shot accuracy (B13).

**Corrections owed before the recommendation is quoted as evidence:**
- "the same questions" (B1);
- the Florence grounding sentence (B3);
- the 64-token scope (B2);
- the house-level latency figure in place of "≈ 16 s per question" (B4).

None of them changes PRIMARY_NEXT.

## Appendix — recomputation index (scratchpad only)

- `rb/load.py`, `rb/auc.py`: rows, exclusions, confusion tables, AUROC, matched subsets, pair accuracy.
- `split/split_probe.py`: the SmolVLM2 default-splitting probe (the bench's `SmolVLM2` class with two processor
  settings changed).
- `split/space_probe.py`: the prefix-space probe.
- `split/compare.py`: the comparison against the bench records.
- Inputs, read-only:
  - `/home/user/work005j/bench/{items-all,smolvlm2,moondream05,florence2,micro}.jsonl`;
  - `/home/user/work005j/oracle/{key-DO-NOT-SHOW.json,answers-part*.jsonl}`;
  - `/home/user/work005j/onnx/wasm-*.json`, `spec-smolvlm2.json`;
  - the pinned Florence-2 safetensors (embedding rows) and the SmolVLM2 / Moondream tokenizers.
