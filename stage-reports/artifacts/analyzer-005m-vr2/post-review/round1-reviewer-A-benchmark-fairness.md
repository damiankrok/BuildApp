# 005M post-review, round 1: Reviewer A (benchmark fairness and statistics)

Scope: matched sets, pre-registration, option order, the scorer, cross-model comparability, the old SmolVLM2-500M
intersection, and the phase thresholds. I checked everything against the code and the raw data, not against the
documents' own claims. I ran no model. Every computation was a small `nice -n 19 python3 -I` read of
`/home/user/work005m/items/items.jsonl`, `/home/user/work005m/runs/*.jsonl` and `/home/user/work005j/bench/*`.

**Result: 0 P0, 4 P1, 7 P2.**

Headline: the matched-set plumbing is clean. I re-scored the data independently and got 30 of 30 model×mode rows
identical to `score-interim`. The problems are in what the numbers are compared against and how they are read:

- the primary metric does not measure confidence;
- the baselines are too weak;
- the confidence intervals are too narrow;
- the old-model comparison sets two different confident-wrong definitions side by side.

---

## Findings

### A-1 (P1): CONFIDENT_WRONG_RATE is identical to WRONG_RATE. Stated confidence is HIGH on effectively every reply

**Evidence**

Stated confidence per model, counted over every record:

| model | records | HIGH | LOW | note |
| --- | --- | --- | --- | --- |
| SmolVLM2-2.2B | 160 | 160 | 0 | HIGH includes its 17 UNRESOLVED |
| InternVL3.5-2B | 160 | 160 | 0 | HIGH includes its 43 UNRESOLVED |
| Qwen3-VL-4B | 160 | 156 | 4 | |
| Qwen3-VL-2B, phase 2 | 835 | 834 | 1 | |

`score-interim/tables.md` confirms this in its calibration table: "HIGH share 100 %" for all four models.

So the confident-wrong count equals the wrong count in every phase-1 row:

| model | confident-wrong | wrong |
| --- | --- | --- |
| SmolVLM2-2.2B | 80 | 80 |
| InternVL3.5-2B | 34 | 34 |
| Qwen3-VL-4B | 53 | 53 |
| Qwen3-VL-2B | 44 | 44 |

Phase 2 (Qwen3-VL-2B) differs in a single item: 299 against 300. Rerun:

```
python3 -c "import json,collections;print(collections.Counter(json.loads(l)['confidence'] for l in open('/home/user/work005m/runs/p1-internvl3.5-2b.jsonl')))"
```

**Consequence for the phase-1 ranking**

The pre-registered rule ranks by lowest CONFIDENT_WRONG_RATE first. In practice that ranks by lowest wrong rate, which
rewards UNRESOLVED regardless of reading ability.

- InternVL3.5-2B ranks first (0.2125) with the second-lowest accuracy (0.519), because it abstains on 27 % of
  replies.
- Its lead comes entirely from the synthetic items, where it abstains on 53 %. The table below is phase 1, split by
  set:

| set | model | CWR | accuracy | UNRESOLVED |
| --- | --- | --- | --- | --- |
| REAL (n = 100) | Qwen3-VL-2B | **0.16** | 0.84 | 0.00 |
| REAL (n = 100) | InternVL3.5-2B | 0.19 | 0.70 | 0.11 |
| REAL (n = 100) | Qwen3-VL-4B | 0.24 | 0.75 | 0.01 |
| REAL (n = 100) | SmolVLM2-2.2B | 0.54 | 0.39 | 0.07 |
| SYN (n = 60) | InternVL3.5-2B | 0.25 | 0.22 | 0.53 |
| SYN (n = 60) | SmolVLM2-2.2B | 0.43 | 0.40 | 0.17 |
| SYN (n = 60) | Qwen3-VL-2B | 0.47 | 0.53 | 0.00 |
| SYN (n = 60) | Qwen3-VL-4B | 0.48 | 0.47 | 0.05 |

On real material, Qwen3-VL-2B has the lowest "confident-wrong" rate.

**How the advancement holds up under other ranking rules**

| ranking rule | advances | robust? |
| --- | --- | --- |
| CWR first (pre-registered) | InternVL, Qwen-2B, Qwen-4B | — |
| Exact accuracy first | the same three | yes |
| P80 first | SmolVLM2-2.2B, InternVL, Qwen-2B; Qwen-4B drops out | no |

The P80 ordering follows from SmolVLM2's option probabilities sitting near 0.5 (median chosen-option probability
0.512), which gives it P80 = 0/160. Qwen-4B has 30/160. Both "confidence" metrics are therefore degenerate, in opposite
directions.

**Why it matters.** The stage brief makes CONFIDENT_WRONG_RATE the primary metric. Any sentence of the form "model X
is less confidently wrong" or "InternVL is the safest" would be unsupported. The number is a wrong rate, and its
ordering depends on how much of the set is synthetic.

**Fix**

- State in the report and in the tables that stated confidence carried no information: 97.5–100 % HIGH, for every
  model.
- Present CONFIDENT_WRONG_RATE as the wrong rate it is.
- Show the REAL / SYNTH split next to the ranking.
- Note that the advancement set is the same under accuracy-first but not under P80-first.
- Do not cite InternVL's first place as a safety result.

---

### A-2 (P1): The reported "no-model" baselines are far weaker than a truth-blind semantic prior. Most headline accuracies barely beat it

**Evidence: what the scorer reports**

`score.py:157-164` reports two baselines:

- "majority answer": 'YES', 25.0 % in PHASE1 and 22.2 % in PHASE2. This pools semantic keys across 16 classes with
  different vocabularies, so 'YES' cannot be right on ENCLOSED/EXTERNAL, OPENING/PATTERN and the other non-YES
  classes. It is not a meaningful baseline.
- "constant letter A": 46.9 % and 45.5 %.

The letter shuffle works. Always-A, always-B and always-C score 0.469 / 0.406 / 0.125 in PHASE1 and 0.455 / 0.437 /
0.108 in PHASE2, against uniform-guess chance of 0.448 and 0.449.

**Evidence: what the shuffle cannot remove**

The letter shuffle does nothing against semantic bias. Two image-free rules:

- A rule that always picks the first option of the class in `common.CLASSES` (YES / ENCLOSED / OPENING / CONTINUES /
  WALL / OUTLINE_1 / …). It uses no image and no truth.
- The per-class majority answer, fitted on the evaluated set itself. That makes it an upper bound for any prior-only
  rule.

| set | first-option rule | per-class majority (fitted) |
| --- | --- | --- |
| PHASE1, all | **62.5 %** | 68.8 % |
| PHASE1, REAL | 70.0 % | 80.0 % |
| PHASE1, SYN | 50.0 % | 50.0 % |
| PHASE2, all | **58.1 %** | 61.7 % |
| PHASE2, REAL | 61.9 % | 68.0 % |
| PHASE2, SYN | 52.9 % | 52.9 % |

The skew is inherited from the pool, not from the selection. `pool.json` has no REAL_DEV PATTERN, GARAGE NO or BAY NO
question; WALL_CONTINUATION has 63 CONTINUES against 2 TERMINATES.

**Model accuracy against the first-option prior** (cluster bootstrap over question families, 4,000 resamples)

| set | model | accuracy | prior | 95 % CI of (model − prior) | P(model > prior) |
| --- | --- | --- | --- | --- | --- |
| PHASE1, all modes | Qwen3-VL-2B | 72.5 % | 62.5 % | +0.006 … +0.213 | 0.98 |
| PHASE1, all modes | Qwen3-VL-4B | 64.4 % | 62.5 % | −0.12 … +0.18 | 0.58 |
| PHASE1, all modes | InternVL3.5-2B | 51.9 % | 62.5 % | −0.24 … +0.05 | 0.08 |
| PHASE1, all modes | SmolVLM2-2.2B | 39.4 % | 62.5 % | −0.43 … −0.03 | 0.009 |

Qwen3-VL-2B, PHASE2, by mode:

| mode | accuracy | 95 % CI of (mode − prior) | above the prior at 95 %? |
| --- | --- | --- | --- |
| A | 63.5 % | −0.017 … +0.125 | no |
| B | 59.9 % | −0.061 … +0.093 | no |
| C | 64.7 % | +0.000 … +0.139 | borderline |
| D | 68.3 % | +0.030 … +0.177 | yes |
| E | 64.1 % | −0.006 … +0.135 | no |

On SYNTH, Qwen3-VL-2B scores 50–56 % against a prior of 52.9 % and always-B of 50 %. It is at chance on the
purpose-built global-context set in every mode.

**Why it matters.** "64 % exact accuracy" reads as reading skill. Against a no-image rule it is about +6 points, and
for three of four models it is indistinguishable from, or below, the prior.

**Fix**

- In `score.py`, add always-A, always-B and always-C, the first-option rule, and the fitted per-class majority (marked
  as an upper bound), per set and for REAL_ALL / SYNTH_ALL.
- Drop or relabel the pooled "majority answer" row.
- Report model − prior with cluster CIs (see A-3) beside every headline accuracy.

---

### A-3 (P1): Wilson intervals treat correlated rows as independent. The ALL_MODES and model-comparison intervals are about half as wide as they should be

**Evidence: how the intervals are built**

`summarize()` (`score.py:60-68`) applies Wilson to:

- the pooled `ALL_MODES` rows: n = 160 or 835, that is questions × 5 modes. The modes are strongly dependent; for
  Qwen-2B in phase 2, A→D is "SAME" on 145 of 167 questions;
- sets that contain correlated items:
  - 24 transform twins (20 MIRROR, 4 ROT90);
  - 17 counterfactual groups with byte-identical A-mode inputs;
  - at least 8 pairs of different questions on the same crop that ask logically equivalent facts. Examples:
    `005j:real-dom-w-morelach-BODY_REGION-0-NORMAL` (YES) and `…-TERRACE_VS_BODY-0-NORMAL` (ENCLOSED), both in PHASE1;
    and cyklamenach OPENING_VS_PATTERN-0 / WALL_CONTINUATION-0.

**Evidence: Wilson against a cluster bootstrap** (resampling families: CF pairs and twins together)

| set | model | ALL_MODES CWR | Wilson 95 % | cluster bootstrap 95 % |
| --- | --- | --- | --- | --- |
| PHASE1 | SmolVLM2-2.2B | 0.500 | 0.423–0.577 | 0.369–0.633 |
| PHASE1 | InternVL3.5-2B | 0.212 | 0.156–0.282 | 0.107–0.330 |
| PHASE1 | Qwen3-VL-2B | 0.275 | 0.212–0.349 | 0.161–0.379 |
| PHASE2 | Qwen3-VL-2B | 0.358 | 0.326–0.391 | 0.300–0.414 |

Phase-1 pairwise differences (paired bootstrap):

- InternVL − Qwen-2B: 95 % −0.162 … +0.043. The first-place ordering is not significant.
- Qwen-4B − SmolVLM2: −0.343 … −0.007. The cut-off between third and fourth place is only just significant.

**Why it matters.** The `**all**` rows in `tables.md` print n = 160 or 835 intervals that overstate precision by about
2×. A reader would take the ranking as settled when it is not.

**Fix**

- Keep per-mode Wilson as descriptive.
- For ALL_MODES rows, for between-model differences and for context gain, report a cluster bootstrap over question
  families: `orderKey`, merged with same-crop duplicates. A paired test is an alternative.
- State the effective n: PHASE1 has 26 clusters; PHASE2 has 114 clusters and 143 distinct base questions.

---

### A-4 (P1): The old SmolVLM2-500M comparison puts a P80 confident-wrong count beside a HIGH-stated CWR

**Evidence: the join is correct**

- 971 CANDIDATE_OVERLAY records, with no duplicate qid.
- Intersection: 78 questions (42 REAL_DEV, 20 ROUND8_DEV including 4 MIRROR, 16 SYNTH_CF).
- 0 truth or class mismatches after the `J_CLS` mapping.
- The 8 005J-origin PHASE2 questions that are absent are REAL_DEV twins with no old record.

**Evidence: the metrics differ**

- The table generated by `summarize.py:98-105` gives the old model's "confident-wrong (p ≥ 0.80) on 10".
- For the new models it prints only the exact accuracy and the **HIGH-stated** CONFIDENT_WRONG_RATE. For Qwen-2B that
  is 16–23 of 78, which by A-1 is simply its wrong count.

Like-for-like P80 on the same 78 questions:

| model | mode | right | wrong | P80 confident-wrong |
| --- | --- | --- | --- | --- |
| SmolVLM2-500M (old) | CANDIDATE_OVERLAY | 19 | 35 (+24 UNRESOLVED) | **10** |
| Qwen3-VL-2B | A | 58 | 20 | 12 |
| Qwen3-VL-2B | B | 55 | 23 | 10 |
| Qwen3-VL-2B | C | 60 | 18 | 15 |
| Qwen3-VL-2B | D | 62 | 16 | 14 |
| Qwen3-VL-2B | E | 59 | 19 | 12 |

On the like-for-like metric, Qwen3-VL-2B is not lower than the old 500M model on confident-wrong. It is far better
on accuracy.

The two "P80" numbers also use different estimators:

- 005J: a full-sequence enum score over YES/NO/UNRESOLVED;
- 005M: the first answer token from the top-20 log-probabilities, normalised over the options.

The note mentions a different image and mode, but not the different metric.

**Why it matters.** As generated, a reader compares 26 % with 13 % and reads two different definitions as one.

**Fix**

- Add P80, UNRESOLVED and wrong columns for the new models in this table.
- Add a sentence on the estimator difference.
- Never put old P80 beside new HIGH-CWR.

---

### A-5 (P2): The prompt cache measurably changes logits. "It changes no answer by design" should be replaced by the measured drift

**Evidence: the natural experiment**

There are 17 groups of byte-identical (images, prompt) items. All of them are A-mode context pairs with identical
crops and a shared option order; 4 of the groups are in PHASE1.

- The first member of each pair is evaluated almost cold: 4–6 cached tokens.
- The second member is evaluated almost entirely from the host prompt cache: 393–626 of 394–627 tokens. Examples:
  SmolVLM `cached 6` then `626`; InternVL `4` then `453`.

**Evidence: what changed**

- The answers matched in every case (17 + 4 + 4 + 4 model-pairs).
- The option probabilities moved by up to:

| model | max shift in option probability |
| --- | --- |
| SmolVLM2-2.2B | 0.036 |
| InternVL3.5-2B | 0.037 |
| Qwen3-VL-4B | 0.030 |
| Qwen3-VL-2B | 0.025 |

Example: SmolVLM2 `inset_upper-s0` scores 0.4695 and then 0.4335.

**Evidence: how much of the benchmark is exposed**

Records whose top-2 margin is below 0.075 (twice the observed drift):

| model | share | right/wrong status would flip |
| --- | --- | --- |
| SmolVLM2-2.2B | 26 % | 31 of 160 records |
| InternVL3.5-2B | 10.6 % | |
| Qwen3-VL-4B | 5 % | |
| Qwen3-VL-2B, phase 2 | 4.2 % | |

For Qwen-2B in phase 2, 40 of its 300 wrong answers lie within ±0.037 of the P80 threshold.

**Evidence: the cache is not used evenly across modes**

Mode D runs with C's cached plan prefix on 100 % of items (cached 581 / 422 / 1285 tokens). A, B, C and E get it on
roughly 2–38 %.

**Why it matters**

- Reproducibility of near-tie answers and of P80.
- D, the headline best mode for Qwen-2B, is the only mode evaluated systematically through a reused image prefix.
  There is no evidence of a directional bias, but it is an uncontrolled difference.

**Fix**

- Replace the `environment.md` sentence with the measured drift.
- Report P80 with a ±0.04 sensitivity band.
- Optionally, re-ask a small fixed subset with `cache_prompt: false` and report the flip count.

---

### A-6 (P2): The scorer docstring says a missing reply is a FAILURE. The code drops the whole model instead

**Evidence**

- `score.py:8-9`: "a parse failure, an HTTP error or a missing reply is a FAILURE".
- `complete()` (`score.py:119-120`) instead excludes any model with a missing (question, mode) record from the table.
  `outcome(it, None)` is never reached.
- `coverage` records the exclusion, so nothing is silently mis-scored.

This changes nothing today: phase 1 has 0 missing records across 640, and Qwen-2B phase 2 has 0 across 835. It
becomes decisive if the running Qwen3-VL-4B or InternVL phase-2 run is cut short.

**Fix.** Align the docstring and the code. Either score a missing record as FAILURE and keep the model, flagged; or
say that incomplete models are excluded.

---

### A-7 (P2): The context-gain and calibration sections compare models on different sets

**Evidence**

- `score.py:180-181` and `214-215` use "the largest matched set each model completed".
- In the interim, Qwen-2B's context gain is on PHASE2 (n = 167) and the other three on PHASE1 (n = 32).
- The calibration table has no set column ("answered 835" against "143").
- After phase 2, SmolVLM2-2.2B will still sit on PHASE1 beside three PHASE2 rows.
- This contradicts the scorer's own rule: "only MATCHED sets are compared".

**Fix.** Compute both sections on PHASE1 for all four models, then on PHASE2 for the three. Label the set in every
row.

---

### A-8 (P2): "≥ 150 matched questions" is met by item count, not by distinct questions

**Evidence**

PHASE2 = 167 items, but:

- 24 are transform twins of included bases, leaving 143 distinct base questions;
- at least 8 same-crop pairs ask equivalent facts (A-3);
- 17 CF identical-crop groups exist.

The result is 114 independent clusters. PHASE1 = 32 questions in 26 clusters, and it includes the morelach
BODY_REGION-0 / TERRACE_VS_BODY-0 duplicate.

**Fix.** Report 167 items / 143 distinct bases / 114 clusters (and 32 / 32 / 26 for PHASE1). State the
interpretation of the brief's threshold.

---

### A-9 (P2): The timing claim in `phase1-advancement.json` is inaccurate. The decision itself was clean

**Evidence: the note**

"written and committed before any PHASE2-only item was answered".

**Evidence: the timeline**

| time (UTC) | event |
| --- | --- |
| 19:45:26.21 | `p1-ranking.txt` written |
| 19:45:26.33 | phase-2 Qwen-2B launched (`p2-qwen3-vl-2b.out`) |
| ≈ 19:45:43 | first PHASE2-only answer (server log, task 0 done at +17.4 s) |
| 19:46:07 | `decidedAtUtc` |
| 19:46:34 | commit `d76f715` |

The ranking was computed automatically before phase 2 started, and it matches my recomputation, so phase-2 answers
did not contaminate it. Only the wording is wrong.

**Fix.** Cite `p1-ranking.txt` and the chain launch as the decision point. Say that the JSON was written and committed
about a minute into phase 2.

---

### A-10 (P2): Not every SmolVLM2-2.2B record ran under the documented server settings

**Evidence**

- `environment.md` lists "Server settings, identical for every model … `--cache-ram 2048`".
- `runs/p1-smolvlm2-2.2b.out` ends: "restarted with --cache-ram 2048 after 16 records". Records 0–15 therefore came
  from a server with the default 8 GiB cache, which crashed.
- Record 15 has `tokenSplitError`. Its answer is valid, but `imageTokens` is missing. `score.py:150` (`or 0`) then
  counts it as 0 tokens, and the A-mode token minimum becomes 0.
- The image cap was active in both server instances: every record has `imageTokens` ≤ 419 per image.

**Fix**

- Disclose the restart and the 16 records in `environment.md`.
- In `score.py`, skip records with no `imageTokens` instead of counting 0.

---

### A-11 (P2): Notes on comparability between models

- **The SmolVLM2 cap is information-preserving.** `--image-max-tokens 336` gives 2 × 2 tiles of 384 plus a global
  view, which is 768 px. Every composed image is at most 768 px; the 448 crop is upscaled. Native resolution would
  only upscale further, to 1,536. The documents should give this as the fairness argument.
  - At the cap, SmolVLM2's results match its letter-bias null: 63 right against 58.5 expected if its answers ignored
    the truth.
  - Its answers are near coin-flips: median chosen-option probability 0.51.
  - Its phase-1 numbers are dominated by noise. It is eliminated because it is last on accuracy and CWR, not because
    of a measured cap effect.
- **InternVL and Qwen also see every input pixel.**
  - InternVL tiles natively: a 448 crop is 1 tile; a 768 plan is 2 × 2 tiles plus a thumbnail, 1,282 tokens, as the
    HF `dynamic_preprocess` would produce.
  - Qwen runs at native 32 px per token, with no resizing.
- **One `input-modes.md` sentence is wrong.** "Qwen3-VL sees the most per plan pixel" is unclear and, read either
  way, wrong. Pixels per token on a 768² plan:

  | model | px² per token |
  | --- | --- |
  | SmolVLM2-2.2B | about 1,408 |
  | Qwen3-VL | 1,024 |
  | InternVL3.5-2B | about 460 |

  Reword it.
- **Mode B is not model-neutral.**
  - It gives the region as coordinates in a 0–1000 frame, which is Qwen3-VL's native grounding convention.
  - llama.cpp also warns that "Qwen-VL models require at minimum 1024 image tokens to function correctly on
    grounding tasks" (`server-qwen2b.log`). Here Qwen gets 198–578 tokens per image.
  - Disclose both points next to the mode-B results.
- **Prompt identity.** `bench.py` sends the same bytes to every model; each model applies its own chat template.
  - Qwen-2B and Qwen-4B have identical `promptTokens` on 160 of 160 records.
  - InternVL's text-only token count (202) equals Qwen's, so no hidden system prompt is injected.

---

## Checked and OK

- **Matched sets, byte level.**
  - `items.jsonl` has 835 lines = 167 qids × 5 modes, with no duplicate keys.
  - All 668 image files on disk hash to `items.jsonl.imageSha256`. They were written between 14:24:35 and 14:25:09,
    before any run.
  - `question-corpus.json` (`modeImageSha256`, `optionOrder`, `expected`, `phase1`) matches `items.jsonl` exactly.
  - D's images are byte-identical to [C plan, A crop] for all 167 questions; E's crop equals A's crop for all 167.
  - The 18 E items without bands are byte-identical to the C plan, consistent with the "no purple marks" wording.
- **Runs.**
  - Each phase-1 file has 160 unique keys = 32 × 5: 0 missing, 0 extra, 0 duplicates, 0 HTTP errors, 0 parse
    failures, 0 answers outside the schema, 0 null `enumProbs`.
  - Qwen-2B phase 2: 835 / 835, all clean.
  - The committed `runs/*.jsonl` files are byte-identical to the work copies.
  - Each `p2-*.jsonl` begins with a byte-identical copy of its `p1-*` file (Qwen-2B: 160 of 835; Qwen-4B: 160 of the
    180 so far).
- **The ≥ 30 and ≥ 150 thresholds.** Phase 1 is 32 × 5 for all four mandatory models, with zero silent drops. Phase 2
  is 167 × 5 for Qwen-2B (see A-8 on distinct counts).
- **Pre-registration.**
  - `score.py`, `common.py`, `compose5.py` and `select_items.py` were committed in `9d5d6bd` (14:44:23) and are
    unchanged since.
  - The first benchmark run started at 14:48. `selection.json` (14:24:20) and the items (14:25:11) predate every model
    output.
  - Earlier model activity was limited to a single Qwen smoke request at 14:02, before any item existed, and a
    one-question SmolVLM2 native probe at 14:37.
  - `select_items.py` uses only pool fields: set, class, expected answer, transform, group, and a hash of the qid. Its
    quotas follow pool availability.
- **Option order.**
  - The order is fixed per base and is identical across modes, twins and CF pairs (0 violations).
  - Expected letters: PHASE1 A15 / B13 / C4; PHASE2 A76 / B73 / C18.
  - Constant letters score at chance (A-2), so letter bias cannot pass for reading.
  - The models' own letter preference (for example, Qwen-2B answers B on 88 of 160 in phase 1) does not explain their
    accuracy, except for SmolVLM2 (A-11).
- **Scorer against its docstring.** These match the implementation:
  - semantic mapping from the item's `shown` field (I re-derived it independently from the prompt text: 0
    mismatches);
  - UNRESOLVED is never wrong;
  - FAILURE handling for records that exist;
  - CONFIDENT_WRONG = wrong and HIGH;
  - P80 = wrong and own option probability ≥ 0.80;
  - denominators equal to all items asked;
  - resolved accuracy and coverage;
  - the Wilson formula (verified by hand on 7/32 → [0.1102, 0.3876]);
  - the transition taxonomy, plus SAME.
- **Recomputation.** My scorer is independent of `score.py`. It reproduces n, right, wrong, UNRESOLVED, failures,
  CW, CW-P80 and both Wilson intervals for all 30 rows (4 models × 6 PHASE1 rows, plus Qwen-2B × 6 PHASE2 rows) in
  `score-interim/matched-bakeoff.json`.
  - It also reproduces the ranking (InternVL, Qwen-2B, Qwen-4B, SmolVLM2) and the advancement in
    `phase1-advancement.json`.
- **`enumProbs` integrity.** The greedy constrained answer equals the argmax of the unconstrained option distribution
  in 100 % of records for all models. The option mass is ≥ 0.935 for every model (median 0.98–1.0).
- **Old SmolVLM2-500M intersection join.** Correct; see A-4 for how it is presented.
- **Sealed-test separation, for the benchmark.**
  - `items-train` holds 480 SYNTH_TRAIN items.
  - They share 0 qids and 0 image hashes with the benchmark items.
  - The benchmark contains no SYNTH_TRAIN or VAL set.

## Round-2 checks (when the remaining runs land)

1. **Raw data.**
   - `p2-qwen3-vl-4b.jsonl` and `p2-internvl3.5-2b.jsonl` each have 835 unique keys, 0 errors and 0 parse failures.
   - Their first 160 lines equal the `p1-*` files byte for byte.
   - The committed copies equal the work copies.
   - The PHASE2 table lists exactly three models.
2. **Independent re-score.** Re-run it on the final `matched-bakeoff.json` and confirm 0 mismatches. My scripts are in
   the session scratchpad (`revA/recompute.py`, `boot.py`, `prior.py`, `determinism.py`, `oldsmol.py`); each is
   under 150 lines, reads JSON only, and can be re-created from A-1 to A-5.
3. **Stage report and `recommendation.md`.**
   - They do not describe CONFIDENT_WRONG_RATE as a confidence measure.
   - They do not call InternVL "safest" (A-1).
   - Every headline accuracy has the semantic-prior baseline and a cluster CI beside it (A-2, A-3).
   - Any "context gain" claim survives the D − A cluster CI. For Qwen-2B in phase 2 that CI is +0.006 … +0.094.
     Re-check it for the other two models.
4. **Old-smol table.** P80 and UNRESOLVED columns are present for the new models (A-4).
5. **Matched sets.** Context gain and calibration are reported on matched sets (A-7).
6. **Teacher (Qwen3-VL-8B, Q4_K_M).**
   - It is not placed in the matched bake-off tables as if it were comparable. Its quantisation differs from the Q8_0
     arms.
   - It is scored with the same scorer, on the same phase-1 items.
   - It is never used as truth.
   - It is also likely to say HIGH on everything; check before quoting its "confidence".
7. **Determinism for the new runs.** Repeat the identical-input check. The probability shift should stay at ≤ 0.04,
   with no answer flips.
8. **Runtime tables.** `runtime-size-matrix.md` labels latencies for D as prompt-cache-assisted, and its "cold-cache"
   medians really exclude cached records.
9. **Generated tables.** `bakeoff-tables.md`, if committed, is regenerated from the final JSON and not edited by
   hand.
