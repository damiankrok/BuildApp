# 005M post-review, round 2 — Reviewer D: distillation, synthetic data and provenance

**Scope.**
- The vrgen2 2.1 corpus: counts, the SEALED split, disjointness, and `question-corpus.json` → `synthetic005M_v2_1`.
- `student_dataset.py`.
- The teacher lane: `runs/teacher-*.jsonl`, `teacher-feasibility.md`, `teacher-summary.json` and `teacher-comparison/`.
- The student probe (`student-probe.json`, `student-training.md`).
- The TEACHER_EXECUTION and STUDENT_TRAINING verdicts, and the matching lines of the stage report and the
  recommendation.

**Method.**
- I ran no model, generator, composer or torch.
- I used `nice -n 19 python3 -I` scripts that read JSON and hash PNGs.
- I made one dry run of `student_dataset.py` (`-I -B`) and one negative test of it, with output in my scratchpad. I
  deleted that output afterwards (see the footprint note at the end).

**Counts: P0 = 0, P1 = 2, P2 = 6.**

P1 titles:
- **D-13.** In vrgen2 2.1 the mode-A abstention target follows from the class alone. `student-training.md` §1 states a
  mitigation that does not exist (D-7 is not resolved, and 2.1 is worse than 2.0 here).
- **D-14.** The committed rationale lane contradicts "the teacher does not see the counterfactual fact". With a
  free-text-first prompt it answered both members of 2 of 3 `compound_front` pairs right; constrained decoding got 0 of 3.

---

## 1. Round-1 findings — verified against the code and artifacts

| id | status | evidence (round 2) |
| --- | --- | --- |
| D-1 garage label | **RESOLVED** | All 9 `test-garage_vs_carport` bake-off questions are GARAGE_DOOR_VS_CARPORT, and all 9 are in `excluded-items.json`. No garage BODY_REGION question was ever in the bake-off. In 2.1 the question is `BAY_BACK_CLOSED_VS_DRIVE_THROUGH` (`common.py:72`): it asks about the back wall, which is in the plan, so it is well-posed. The teacher-mining slice has no garage item (`items-48.jsonl`: 7 families × 6) |
| D-2 TEST reaches the teacher | **RESOLVED** | `items-teacher-p1.jsonl` holds 120 lines = 24 questions × 5 modes. Its sets are REAL_DEV 40, ROUND8_DEV 20, GAPSET_DEV 20, SYNTH_CF 20, MURAJACH_DEV 15 and STOREY_DEV 5; there is no SYNTH_GLOBAL. The 120 run keys are a subset of those items. 0 of their composed-image hashes appear among SYNTH_GLOBAL images. The selection on TEST is disclosed (`student-training.md` §2, `synthetic-corpus.md` TEST row). SEALED is the evaluation split |
| D-3 corpus counted augmentations | **RESOLVED** | Recounted from `/home/user/work005m/sg-v21/corpus.json`, with every PNG re-hashed (§2) |
| D-4 student pass bar | **RESOLVED** (one residual) | §5 gives n ≥ 598 / 765 / 1,130 / 381; I recomputed all four. REAL is split 70 / 27, which matches my round-1 count of 50 + 20 / 16 + 8 + 3. The bar is stated as screen-only. **Residual:** the contract still uses plain accuracy for mode-A context-dependent items, where a lucky guess counts RIGHT and the trained target is UNRESOLVED. Per-pair scoring is not adopted. §5.1's "abstention per class and family" covers it only partly |
| D-5 tautological exclusion assert | **RESOLVED**, with a P2 residual (D-16) | `student_dataset.py:59-62, 86-87` checks each render's SHA-256, for TRAIN and VAL alike. Negative test: a fake SEALED corpus holding one TRAIN render hash stops the run (`train-garage_vs_carport-s0-B-MIRROR-q0: not a TRAIN/VAL generator render`, exit 1). The check runs only when `--sg-test` / `--sg-sealed` are passed |
| D-6 teacher probabilities on disagreement | **RESOLVED in code**, with doc residuals | `:95-98`: `probs` is null unless the arg-max equals the target. In the dry run: 20 lines agree with probs, 22 disagree with none. The teacher's `answer` equals the enumProbs arg-max in 162 / 162 records, so the two agreement definitions coincide. The §1 example is still inconsistent (D-17). A new join defect is D-15 |
| D-7 abstention shortcut | **NOT RESOLVED** | See D-13 (P1) |
| D-8 inset_upper terrace | **RESOLVED** | `vrgen2.py:208-212` draws the TARAS terrace only under `--compat 2.0.0`. The kept 2.0 TEST inset items are documented |
| D-9 footprint and VRAM arithmetic | **PARTIAL** | 1.55 GB is now decimal, and the sum covers model files only. The adapter-size claim is removed. SmolVLM2-500M is in `model-manifest.json` (revision `7b375e1b`, 2,029,990,624 B). Route A's 0.437 + 0.109 GB comes from ggml-org listings that are not in `quantised-sizes.json`, so I could not check it offline. Route A VRAM ("1.0 GB + 4–6 GB → 8–12 GB") still does not itemise the 3–5 GB gap |
| D-10 route-A token budget | **RESOLVED**, with a stale sentence | The probe ran at `longestEdge: 1024` and measured 905–907 tokens per D item, against the ≈ 860 estimate and a max length of 1,536. §4 still says the probe "ran the default processor" (D-17) |
| D-11 doc inaccuracies | **RESOLVED**, with one residual | The text now says 34 twin-paired of 38. It gives 2.65 m / 2.05 m. The per-split digests are real hashes: each is SHA-256 of the newline-joined sorted render hashes, and I reproduced all three. **Residual:** `vrgen2.py` still does not assert fewer than 1,000 pairs per family per split, which seed disjointness relies on (one-line fix) |
| D-12 docstring prompt | **RESOLVED** | `student_dataset.py:13-15` |

## 2. Round-2 checks

### vrgen2 2.1 corpus

**Every count and claim reproduces.**
- **Counts.** I re-hashed all 11,200 renders and found 0 mismatches with `pngSha256`.

  | split | seeds | pairs | drawings | renders | questions | context-dependent |
  | --- | --- | --- | --- | --- | --- | --- |
  | TRAIN | 1,000 | 1,000 | 2,000 | 8,000 | 11,000 | 6,000 |
  | VAL | 200 | 200 | 400 | 1,600 | 2,200 | 1,200 |
  | SEALED | 200 | 200 | 400 | 1,600 | 2,200 | 1,200 |

- **Seed ranges.** TRAIN 510000–517124, VAL 520000–527024, SEALED 540000–547024. No seed and no render hash is shared
  between splits, and no render hash repeats.
- **Committed hashes.** `renderSha256BySplit.SEALED` equals the 1,600 actual hashes, and all three digests reproduce.
- **2.1 and the 2.0 TEST split.** They share 0 renders.
- **2.1 and 2.0 TRAIN / VAL share 1,320 / 300 renders.** This is expected, not a leak. In 2.0 TRAIN:
  - the six unchanged families give 6 × 176 = 1,056 renders;
  - the garage drawings, which did not change (only their question did), give 176;
  - the inset_upper B renders give 88.

  That is 1,320. VAL follows the same pattern and gives 300. Neither split is an evaluation split.
- **Class and answer balance in SEALED** matches `question-corpus.json`. STOREY_COVERAGE is 600 YES : 200 NO (3 : 1,
  disclosed).
- **"SEALED shown to no model."** No file under `items*/`, `runs/` or `corpus/selection*.json` names `sealed-` or
  `sg-v21`. `sg-v21/corpus.json` (23:46) came after both teacher item files (23:22 and 23:25).

### Student dataset

I dry-ran the documented §4 command, with pool-v21, sg-v21, `--sg-test`, `--sg-sealed` and `--teacher`.
- **Lines.** 55,000 TRAIN / 11,000 VAL. Targets: GENERATOR 49,000 / 9,800 and GENERATOR_ABSTAIN 6,000 / 1,200.
- **Ids.** Only `train-` and `val-`.
- **Forbidden renders.** 0 TEST or SEALED hashes.
- **UNRESOLVED** appears only in mode A.

### Teacher lane

**Inputs are clean.**
- `teacher-p1`: 24 qids × 5 modes (above).
- `teacher-train`: 42 qids, all `train-`, mode D, 0 source hashes in TEST or SEALED.
- `teacher-rationale`: 12 `train-` qids.
- All three committed run files are byte-equal (as parsed) to the work-directory runs. The longest record is 786
  characters, and none contains pixels.

**Every figure in `teacher-feasibility.md` Result 1 reproduces.** On the 24-question subset:

| model | accuracy | confident-wrong | mode D accuracy / CWR |
| --- | --- | --- | --- |
| teacher (Qwen3-VL-8B) | 69/120 | 49/120 | 14/24, 10/24 |
| Qwen3-VL-2B | 94 | 26 | 20, 4 |
| Qwen3-VL-4B | 85 | 34 | 18, 6 |
| InternVL3.5-2B | 80 | 29 | 17, 5 |
| SmolVLM2-2.2B | 48 | 65 | 10, 13 |

The first-option rule scores 16/24.

**Pair claim reproduced exactly.**
- 21 pairs; truth differs in all 21.
- Same answer to both members in 20 of 21; both members right in 0.
- All pairs are NORMAL `q0`, and both members show the same option order, so "same letter" means the same option.
- **For context:** the students are just as pair-insensitive on TEST. In `bakeoff-tables.md` PHASE2 mode D, local pairs
  get the same answer 88–100 % of the time and context pairs 80–100 %. The screen is therefore not specific to the
  teacher.

**Rationale counts reproduce** (8 disagreeing + 4 agreeing; free answer equals constrained in 8; equals the generator in 6).
Their reading does not: see D-14.

### Student probe

`student-probe.json` matches `/home/user/work005m/student/probe.out` step for step:

| quantity | value |
| --- | --- |
| trainable / total parameters | 9,568,256 / 517,050,560 |
| median seconds per step | 31.07 |
| peak RSS | 13,085,859,840 B (13.09 GB = 12.19 GiB, against a 13.36 GiB cgroup) |
| adapterSaved | false |

- The committed copy replaces the `/dev/shm` model path with the repository id and revision, and adds `items` and
  `note`. Hand annotation is acceptable, but it should be marked as such.
- No `adapter*`, `*.safetensors` or `checkpoint-*` exists under `/home/user/work005m` (venv excluded). No weight
  extension appears in any commit since `47811e0`. `student_probe.py` writes only the JSON record.

**§3 / §4 arithmetic checks out:**
- 55,000 × 31 s ≈ 474 h; three epochs ≈ 1,420 h; 11,000 × 31 s ≈ 95 h.
- 31 s / 0.15–0.08 s ≈ 207–388×.
- 165,000 samples × 0.08–0.15 s ≈ 3.7–6.9 h; × 0.3–0.5 s ≈ 13.8–22.9 h.
- **Caveat:** the step was timed on two-image mode-D items, so the per-line cost for modes A–C is somewhat lower. The
  conclusion is unaffected.

### Verdicts

- **TEACHER_EXECUTION = RUN (CPU subset)** is accurate: 120 + 42 + 12 records, an official GGUF, hash-verified.
  - The settings change after the OOM at record 27 is disclosed.
  - The 32B `DEFERRED_ENV` is justified.
- **STUDENT_TRAINING = DEFERRED_ENV** is supported by a measured probe, not by default. The brief's required items
  (format, command, VRAM, duration, outputs, export plan) are all present.
- **SYNTHETIC CORPUS PASS** holds for the brief's size and split requirements. D-13 is a defect in what the training
  targets teach, not in the counts.

### Numbers in the stage report and recommendation (my area)

Checked and correct:
- 2,000 / 400 / 400; 55,000 / 11,000.
- 57.5 %, AUROC 0.84 / 0.95.
- 20 / 42; 20 of 21; 95 %.
- 9.57 M of 517 M; 31 s; 905 tokens; 13.1 GB; ≈ 1,400 h.
- 598–765.
- 70 / 27.
- "UNRESOLVED 0 times in 760 phase-2 replies": 835 records, 760 kept after exclusions, 0 UNRESOLVED.

Overstated: see D-14, D-18 and D-19.

### Does the recommendation follow?

From the distillation side, **yes**. RETURN_TO_DETERMINISTIC_BODY_RELATION is better supported than
TRAIN_BUILDPLAN_STUDENT:
- there is no compute;
- the training targets need another generator revision (D-13);
- the real set can only screen the bar.

CLOUD_TEACHER_ONLY is correctly called unmeasured, not refuted. D-14 weakens one of the stated reasons, but not the
choice.

---

## 3. New findings

### D-13 (P1) — In 2.1 the abstention target is fully determined by class × mode; the documented mitigation is false

**Evidence**
- From the v2.1 TRAIN questions in `sg-v21/corpus.json`, `(cls, contextDependent)`:

  | class | context-dependent | crop-decidable |
  | --- | --- | --- |
  | BAY_BACK_CLOSED_VS_DRIVE_THROUGH | 1,000 | **0** |
  | BODY_REGION | 1,000 | **0** |
  | STOREY_COVERAGE | 4,000 | **0** |
  | GAP_KIND | 0 | 2,000 |
  | LOGGIA_VS_ROOM | 0 | 1,000 |
  | OPEN_SIDE_VS_OPENINGS | 0 | 1,000 |
  | WALL_CONTINUATION | 0 | 1,000 |

- **The dry-run dataset confirms it.** In mode A, UNRESOLVED is the target on 6,000 / 6,000 lines of the first three
  classes and on 0 / 5,000 of the others. VAL has the same structure. A class-and-mode lookup table predicts every
  abstention target exactly, with no pixel read.
- **`student-training.md` §1 says the opposite:** "every class with an abstention target also has decidable crop-only
  questions in the local families". `resolution-round1.md` lists D-7 as handled by this text.
- **2.1 is worse than 2.0 here.** 2.0's garage family had a *local* BODY_REGION question: 176 of 352 TRAIN BODY_REGION
  questions were crop-decidable. 2.1 dropped it (B-2 / D-1 fix), so BODY_REGION is now 100 % context-dependent.

**Why it matters**
- Abstention is the property the stage says the small models most lack, and the main reason given for a student.
- A student trained on this set can score perfect abstention on SEALED by memorising "BODY_REGION / STOREY / BAY + mode
  A → UNRESOLVED". SEALED would report it as learned abstention.
- On real sheets it would refuse every mode-A BODY_REGION question, including crop-decidable ones (real BODY_REGION is
  15 of 97 PHASE2 questions). That inflates context gain A → C/D/E.

**Fix (before any student run)**
1. Add crop-decidable members to each of the three classes. For example:
   - a BODY_REGION target inside a walled room, or on terrace hatch, in the local families;
   - STOREY questions whose crop panel is the upper plan;
   - a short bay whose back wall lies inside the crop.

   Target roughly ≥ 30 % decidable per class.
2. Add a "class × mode prior" baseline to the SEALED evaluation. Abstention accuracy must beat it.
3. Correct §1 and the D-7 row of the resolution.

### D-14 (P1) — The rationale lane is counter-evidence to "the teacher does not see the counterfactual fact", and it is described as the opposite

**Evidence** (`runs/teacher-rationale-qwen3-vl-8b.jsonl`; prompt: free text, then JSON)
- **`compound_front` s0.** The constrained answers are A / A. The free answers are **A / B, both right**. The texts
  describe the difference that was planted: "two distinct door symbols with separate thin lines" for A, against "a
  single continuous line with no breaks … one single open side" for B.
- **`compound_front` s2.** Constrained A / A; free **A / B, both right**. Again the texts differ: "two distinct gaps
  marked by thin horizontal lines" against "no visible gaps".
- **`compound_front` s1.** Free answers B / B, the same for both members.
- **Totals.** Free answers match the generator on 6 / 12 items. Constrained answers on the same 12 match on 4 / 12. The
  12 were selected for constrained disagreement, so this is not a fair estimate, but its direction is the opposite of
  "not grounded".
- **What the documents say.**
  - `teacher-feasibility.md` Result 3: "Rationales are fluent and not grounded … describes features that both members
    share … for both members of a pair". That holds for the 3 corridor items and `compound_front` s1, not for s0 and s2.
  - The stage report §6 and recommendation §12: "The only runnable teacher does not see the counterfactual fact."
  - The recommendation's CLOUD_TEACHER_ONLY row: "does not see the counterfactual fact (one answer for 20 of 21 TRAIN
    pairs)".

  All three generalise a result measured only under constrained, answer-first decoding.

**Why it matters**
- The teacher verdict and the "pair-sensitivity screen" reopen condition are written as properties of the model.
- The evidence supports them only for one decoding protocol. A reasoning-first protocol separated 2 of the 3 pairs it
  was tried on. That is 3 pairs, far too few to claim the teacher reads the fact, but enough to falsify the general
  statement.
- It does not flip the recommendation:
  - the corridor pairs still fail;
  - the cost would be several CPU-days;
  - the teacher is still 57.5 % on the shared real set.

**Fix**
1. Qualify the claims: "under constrained decoding, same answer on 20 / 21 pairs. With a free-text-first prompt it
   separated 2 of 3 `compound_front` pairs (6 items); reasoning-mode labelling is untested."
2. State that the pair-sensitivity screen must be run in the decoding mode that will produce labels.
3. Optionally, run the rationale prompt on all 42 TRAIN items (≈ 42 × 100 s ≈ 1.2 CPU-h) before calling the 8B unusable
   as a hard-example miner.

### D-15 (P2) — The teacher join is by `(qid, mode)` only, so 2.0 teacher outputs attach to different 2.1 drawings

**Evidence**
- `student_dataset.py:68, 93` joins on `(qid, mode)`. Qids are equal across 2.0 and 2.1, but the inset_upper A
  drawings changed (the terrace was removed).
- In the dry run with the documented `--teacher`, 3 lines get `agrees: true` with probabilities computed on a picture
  the student will never see: `train-inset_upper-s{0,1,2}-A-NORMAL-q0`. Their 2.0 render hashes differ from the 2.1
  hashes in the same lines.

**Fix:** join on `(qid, mode, render SHA-256)`. The teacher items carry their source hashes in the pool. Refuse a
teacher run from another generator version.

### D-16 (P2) — The TEST / SEALED hash check is opt-in

**Evidence**
- Without `--sg-test` / `--sg-sealed`, `forbidden` is empty and nothing is checked (`:59-62`). The run succeeds silently.
- The docstring and §1 describe the check as unconditional ("checks every render's SHA-256 … and stops on a hit").

**Fix:** make both flags required, or refuse to write a dataset when either is missing. Also assert the seed range and
the `train-` / `val-` prefix, which costs one line each.

### D-17 (P2) — `student-training.md` internal inconsistencies

1. **§4** says "The CPU probe (§3) ran the default processor, so its timings are the expensive case". §3 and
   `student-probe.json` say `longestEdge: 1024` (commit `e1cd579`). The 474 h figure is therefore *not* a worst case.
2. **§1's example record** is inconsistent in three ways:
   - it is an `A_CROP_ONLY` line with teacher probabilities, but the teacher ran mode D only;
   - it uses seed `s3`, which is outside the mining slice (`s0`–`s2`);
   - it is a three-option WALL_CONTINUATION question whose `probs` lack `C`.
3. **§4** offers `[--teacher $W/runs/teacher-train.jsonl]`. That file does not exist (the run is
   `teacher-train-qwen3-vl-8b.jsonl`), and `teacher-feasibility.md` concludes the teacher should not supply soft
   labels. Drop the option or point to the screen.
4. **§5** says SEALED has "≈ 200–400 per class". It is 200–800 questions (STOREY 800). In independent drawings it is
   only 50–100 per class, which strengthens the stated conclusion.
5. **Route A VRAM** still does not itemise the gap (D-9).

### D-18 (P2) — Teacher-feasibility wording and rankings

1. **"6 counterfactual pairs × 7 families"** should be **3 pairs × 7 families** (6 questions each, 21 pairs; the
   summary JSON agrees).
2. **"48 % — chance for two-option questions":** 12 of the 42 have three options, so chance is ≈ 45 %. The conclusion
   holds.
3. **Result 1's heading** ("the teacher is the weakest Qwen and below the image-free prior") ranks on a set the same
   document says is "too small to rank". The cluster intervals are 33–74 % (teacher), 57–92 % (2B) and 66.7 % (prior).
4. **The recommendation** says the teacher "reads worse than the 2B students". SmolVLM2-2.2B scored 40.0 %, below the
   teacher's 57.5 %. The recommendation also drops the Q4_K_M qualifier that `teacher-feasibility.md` keeps.

**Fix:** reword these as point estimates on 24 questions, and keep "Q4_K_M, CPU".

### D-19 (P2) — 005J's Route-C pilot is cited beyond what it measured

**Evidence**
- `recommendation.md` ("Why TRAIN_BUILDPLAN_STUDENT is not now" 2) says 005J "already showed synthetic-only training
  collapsing on real sheets (85 % synthetic, 49.6 % real)".
- That pilot was a 1.07 M-parameter model trained from scratch at 256 px, with 8 seeds and one run. 005J itself calls
  it "one weak pilot … not a law" (`analyzer-005j/recommendation.md:38`). It says nothing direct about LoRA on a
  pretrained VLM.

**Fix:** say "005J's from-scratch micro-referee pilot transferred poorly (85 % → 49.6 %); whether a pretrained VLM
fine-tune transfers is untested", and keep it as a risk, not a finding.

---

## Checked and OK (beyond the tables above)

- **`question-corpus.json` → `synthetic005M_v2_1`.** Every per-split, per-family and per-class count equals the corpus.
  - `bySplitFamily` counts questions: corridor, wing and inset ask 2 per render.
  - `disjointFrom2_0_TEST: true` and `splitsDisjointByRenderHashAndSeed: true` are both verified.
- **The documented data commands** match the real CLIs: vrgen2 `--splits` / `--pairs` and corpus.py `--synth-train` /
  `--pool-name`.
  - `pool-v21.json` has 11,000 SYNTH_TRAIN questions, all from `sg-v21/renders` with `train-` ids.
  - Its 480 SYNTH_GLOBAL questions (2.0 TEST) are never read by `student_dataset.py`.
- **The dataset refuses to write inside the repository** (`:53`).
- **TEST selection disclosure.** `vrgen2.py:35` and `synthetic-corpus.md` now say TEST was shown to the bake-off models
  and used in selection, and never to a teacher or a student. That is true.
- **No real image is in any teacher-mining or student item.** The teacher's real-image exposure is evaluation only
  (teacher-p1).
- **The 005J figures cited** (85 % / 49.6 %) match `analyzer-005j/recommendation.md:38`.
- **The teacher's revisions are consistent.** Base `0c351dd0` and GGUF `f982a075` are both in `model-manifest.json`.

## Note on my own footprint

- **Disk.** The dry-run dataset (≈ 41 MB) and the two negative-test outputs were written to my scratchpad and deleted.
  The second negative test failed with `ENOSPC`, because the root filesystem has about 60 MB free. I deleted its partial
  output, so nothing of mine remains apart from small scripts (< 8 MB in total).
  - The VAL path of the hash check is verified by reading the code, since it shares the TRAIN loop; it was not verified
    by a test.
  - **The coordinator should know the disk is full.** Further runs, CI or commits may fail.
- **Python cache.** An empty `research/analyzer-005m/__pycache__/` appeared at 14:33:59. That was before my first
  repository import at 14:36, and every import I made used `-B`, so it is not mine. It is gitignored, and I left it in
  place.
- I edited nothing except this report.
