# 005M post-review, round 1 — Reviewer D: distillation, synthetic data and provenance

Scope: the synthetic corpus and its split hygiene, use of the sealed TEST split, generator truth, the teacher's role,
the student plan, provenance of the real development questions, and pixels in committed artifacts. I ran no model,
generator, composer or torch. All checks used `nice -n 19` Python that only reads JSON, plus one dry run of
`student_dataset.py` (pure JSON, no images) with its output written to my scratchpad.

**Counts: P0 = 0, P1 = 4, P2 = 8.**

P1 titles:
- D-1 The `garage_vs_carport` A label ("garage door") is not supported by the drawing, and it contradicts 005J's own
  convention for the same picture inside the same benchmark.
- D-2 The sealed TEST split will be shown to the teacher (and it already took part in model selection), although three
  documents say it is never shown to a teacher.
- D-3 "≥ 2,000 / 400 / 400: all three are met" counts rigid-transform copies. The independent seeds are 176 / 40 / 40.
- D-4 The student pass bar (CONFIDENT_WRONG_RATE ≤ 0.5 % per class on the real set) cannot be shown on the named 97-question
  real subset. 28 of those 97 truths are AI-authored.

---

## Findings

### D-1 (P1) — `garage_vs_carport` variant A: the "GARAGE_DOOR" truth is a convention the picture does not show, and 005J's generator encodes the opposite

**Evidence**

- `research/analyzer-005m/synthetic/vrgen2.py:82` draws the front gap as `'OPEN'` in **both** members. The only
  difference is the back wall (`:85-87`) and, in B, paving behind it (`:89`). So A is a bay walled on three sides with an
  unmarked wide front gap, and it is labelled `GARAGE_DOOR` (`:95`) with `BODY_REGION` YES ("inside the enclosed
  garage", `:96`).
- 005J's rasteriser says what `'OPEN'` means: `research/analyzer-005j/synthetic/vrgen.py:252`
  `# 'OPEN': nothing drawn across - the wall stops here.`
- 005J's own family `fam_garage_door_vs_open` (`vrgen.py:544-568`) draws, in its B member, the same topology: a garage
  bay closed by walls on three sides (an internal back wall with a door) and an `'OPEN'` front. Its truth is
  `WALL_CONTINUATION = TERMINATES` and `GARAGE_BODY = NO` ("open carport", labelled `WIATA`).
- That 005J pair is in **both** bake-off phases (`select_items.py:88-93`: `garage_door_vs_open` is family index 1, so
  `i < 2` puts it in PHASE1). The benchmark therefore scores one unmarked enclosed bay as "the wall stops: carport" and
  another as "garage door". A model that reads both the same way is marked wrong on one of them.
- What the models did (read-only tabulation over `items/items.jsonl` and `runs/*.jsonl`, `garage_vs_carport` A members,
  modes C–E):
  - Qwen3-VL-4B: `OPEN_CARPORT`/HIGH on 3 of 3 phase-1 items, every one scored CONFIDENT_WRONG.
  - Qwen3-VL-2B: `OPEN_CARPORT`/HIGH on 5 of 15 phase-2 items.
  - A defensible reading is being scored as confident-wrong.
- Reach:
  - TEST: 20 + 20 questions (GARAGE_DOOR_VS_CARPORT A plus BODY_REGION A).
  - Bake-off: 5 A-member items × 5 modes.
  - TRAIN: 792 student lines with this label at confidence HIGH. That is 88 GARAGE_DOOR_VS_CARPORT A questions × modes
    B–E, plus 88 BODY_REGION A questions × 5 modes.

**Why it matters**
- It biases SYNTH_GLOBAL CONFIDENT_WRONG_RATE and the per-class numbers against models that apply 005J's convention.
- It would teach a student to call an unmarked gap a garage door with HIGH confidence. That is the confident-wrong
  behaviour the stage exists to remove.
- It is also the exact semantic confusion behind the murajach and gozdzikowcach failures (005L recommendation.md:11).

**Fix**
- Give the drawing the fact the truth relies on, outside the crop. For example, draw the room label `GARAŻ` / `WIATA`
  at the back of the bay: the bay is 7.2–8.2 m deep and the crop reaches about 4.5 m from the gap. Real sheets use the
  same label.
- Alternatively, drop the `GARAGE_DOOR_VS_CARPORT` question for A and keep only questions whose answer follows from
  the back wall.
- Regenerate TRAIN, VAL and TEST before any student run.
- In the final tables, report SYNTH_GLOBAL with and without this family.

### D-2 (P1) — The sealed TEST split reaches the teacher, and it already took part in model selection

**Evidence**
- `/home/user/work005m/tools/chain_teacher.sh` runs
  `run_model.sh qwen3-vl-8b-teacher … 1 $W/runs/teacher-p1-qwen3-vl-8b.jsonl`.
  - Phase `1` makes `bench.py:107-108` keep every `phase1` item of `$W/items/items.jsonl`.
  - That set holds **8 SYNTH_GLOBAL (TEST) questions × 5 modes** (selection.json phase1:
    `SYNTH_GLOBAL: 8`, from `select_items.py:98-103`).
  - The teacher is queued after InternVL phase 2, so this has not happened yet.
- Documents that contradict it:
  - `vrgen2.py:26` "TEST … (sealed: never given to a teacher or a student)".
  - `synthetic-corpus.md:16` "never shown to a teacher".
  - `student-training.md:99` "never seen by teacher or student".
- The phase-1 advancement rule (`phase1-advancement.json`) ranks models on the 32-question set, which includes those 8
  TEST questions.
- Route B of the student plan takes "the best 2B of the bake-off" (`student-training.md:48`). The base would therefore
  be chosen partly on TEST. Its "before vs after" would then be measured on the same TEST, including the 54 questions
  used in the bake-off.

**Why not P0**
- No teacher output can enter training. `student_dataset.py` joins teacher records by `(qid, mode)` only for
  `train-`/`val-` ids.
- The selection effect over four off-the-shelf models is small.
- The documented claim is still false as soon as the chain runs.

**Fix (cheap, before the teacher starts)**
- Run teacher-p1 with an `ITEMS` file that drops `SYNTH_GLOBAL`, or reword the three documents to "evaluated on 8 TEST
  questions, never mined or trained on".
- In the student contract, report TEST excluding the 54 bake-off questions (426 questions) as the clean held-out
  number.
- Never use teacher-p1 disagreements for hard-example mining.

### D-3 (P1) — The corpus-size claim counts augmentations; independent units are 10× fewer than the targets

**Evidence**
- Read from `sg-trainval/corpus.json` and `sg-test/corpus.json`:

  | split | seeds (= pairs) | seed range | distinct drawings | renders | questions |
  | --- | --- | --- | --- | --- | --- |
  | TRAIN | 176 | 510000–517021 | 352 | 1,408 | 2,112 |
  | VAL | 40 | 520000–527004 | 80 | 320 | 480 |
  | TEST | 40 | 530000–537004 | 80 | 320 | 480 |

- Each seed yields 2 variants × 4 rigid transforms (NORMAL / MIRROR / ROT90 / ROT180), with 1–2 questions per image.
- `synthetic-corpus.md:21` "Brief targets were ≥ 2,000 / 400 / 400; all three are met" holds only at the question level.
  The sealed TEST has 5 pairs per family; `LOGGIA_VS_ROOM`, for example, is 10 drawings shown as 40 questions.
- The bake-off's 54 SYNTH_GLOBAL questions come from 20 pairs (`question-corpus.json`).

**Why it matters**
- Wilson intervals over SYNTH_GLOBAL (and the planned TEST evaluation) treat transform twins and pair members as
  independent, so they are too narrow.
- The VAL and TEST targets are met by independent scenes only about 1/10 of the way.

**Fix**
- State the independent counts next to the question counts.
- Generate VAL and TEST at ≥ 50 pairs per family; TRAIN can stay or grow. This is cheap: the 1,728 trainval renders
  took about 14 minutes (file times 14:24 → 14:38).
- Cluster the intervals by pair (or by seed) in `score.py` for synthetic sets.

### D-4 (P1) — The student evaluation contract cannot demonstrate its own pass bar, and the real truth is partly AI-authored

**Evidence**
- `student-training.md:101-104` sets the pass bar at CONFIDENT_WRONG_RATE ≤ 0.5 % per class on "the 005M PHASE2 real
  subset (97 questions)". Per class that subset has 2–17 questions:

  | class | questions |
  | --- | --- |
  | GAP_KIND | 17 |
  | BODY_REGION | 15 |
  | TERRACE_VS_BODY | 15 |
  | OUTER_BOUNDARY_A_OR_B | 12 |
  | WALL_CONTINUATION | 10 |
  | CANOPY_PERGOLA_VS_WALL | 8 |
  | OPENING_VS_PATTERN | 7 |
  | GARAGE_BODY | 5 |
  | OPEN_SIDE_VS_OPENINGS | 3 |
  | STOREY_COVERAGE | 3 |
  | BAY_OR_RISALIT | 2 |

- Even 0 confident-wrong in 17 has a Wilson 95 % upper bound of 18.4 %. Bounding the rate at ≤ 0.5 % with zero errors
  needs about 765 questions per class.
- 12 of the 97 are MIRROR twins, so 85 are distinct.
- Truth provenance of the 97:

  | truthSource | questions |
  | --- | --- |
  | TRUTH_005I | 50 |
  | BLIND8_DIAGNOSIS | 20 |
  | GAPSET AI-subagent majority (TWO_REVIEWER_AGREEMENT 14, INDEPENDENT_SOURCE_REVIEW 2) | 16 |
  | AUTHORED_005M_FROM_005L_DIAGNOSIS (murajach) | 8 |
  | AUTHORED_005M_FROM_005L_REGISTRATION (storey) | 3 |

  `score.py:136` pools all of them into `REAL_ALL`.
- The contract does not say how mode-A context-dependent items are read. `score.py` counts a lucky crop-only guess as
  RIGHT, but the student's target there is UNRESOLVED. So "accuracy before vs after" penalises the trained behaviour.

**Why it matters**
- The contract is the gate that a TRAIN_BUILDPLAN_STUDENT recommendation would use. With these counts, "pass" would be a
  point estimate of 0/n quoted as ≤ 0.5 %.

**Fix**
- Restate the bar as "observed confident-wrong k/n with Wilson upper bound, per class". Either name a real evaluation
  set large enough to bound it, or say plainly that the real set can only reject.
- Split `REAL_ALL` by `truthSource` (human or 005I-manual vs AI-authored).
- Score mode-A context-dependent items by pair: at most one of two members can be right, and UNRESOLVED is the target.

### D-5 (P2) — `student_dataset.py`'s exclusion "assert" is tautological; the exclusion holds only by construction

**Evidence**
- `student_dataset.py:103` asserts `q['set'] in ('SYNTH_TRAIN', 'SYNTH_VAL')`. But TRAIN `qs` is already filtered on
  that set (`:88`), and VAL records are built with `'set': 'SYNTH_VAL'` hard-coded (`:96`). The assert cannot fire.
- It checks no image hash, path or seed.
- `student-training.md:26-27` ("the script asserts it") and `licensing-matrix.md:32` repeat the claim.

**My dry run** (`--out` in my scratchpad)
- 10,560 TRAIN and 2,400 VAL lines.
- Targets: GENERATOR 9,504 + 2,160, GENERATOR_ABSTAIN 1,056 + 240.
- 0 render hashes from `sg-test`; ids only `train-` / `val-`.
- Target letters equal compose5's `expectedLetter` on 480 of 480 overlapping TRAIN items.
- The property is therefore true today.

**Fix:** assert that each render's SHA-256 is not among `sg-test` hashes, that the render path is under
`sg-trainval/renders`, that the seed lies in the TRAIN or VAL range, and that the qid prefix is `train-` or `val-`.

### D-6 (P2) — Teacher probabilities are kept on disagreement, and "agrees" has two definitions

**Evidence**
- `student_dataset.py:111-113` writes `teacher.probs` whether or not `agrees` is true. Ignoring them is left to a
  collator that does not exist yet.
- The example in `student-training.md:23` shows exactly such a record (`"agrees": false` with probs). It is also on an
  `A_CROP_ONLY` line, although the teacher runs mode D only (`chain_teacher.sh`, `MODES=D_MARKED_ROI_PLUS_CROP`).
- "Agrees" means the arg-max of `enumProbs` in `student_dataset.py:112`, but the constrained answer in
  `teacher_rationale.py:49`.

**Why it matters:** a naive trainer that reads `teacher.probs` would distil wrong answers. This is the only path I found
by which a teacher answer could act as a target.

**Fix**
- On disagreement, write `teacher: {"agrees": false, "hardExample": true, "teacherTop": …}` with no probs.
- Use one agreement definition (constrained answer and arg-max both equal the truth).
- Fix the example.

### D-7 (P2) — The abstention target can be learned as a class / mode / style shortcut

**Evidence**
- In vrgen2, every `GARAGE_DOOR_VS_CARPORT` and every `STOREY_COVERAGE` question is context-dependent. So in mode A the
  student target is always UNRESOLVED for those classes. Class plus the mode-A wording decide it, not pixels.
- Context families are also the only ones drawn unskewed and never hatched (`vrgen2.py:339-343`), so style correlates
  with the abstention target.
- 352 of the 1,056 TRAIN abstention lines are the both-YES storey controls (wing_storey / inset_upper q1). Their twin
  has the same truth, so "pixel-identical to its counterfactual twin" (`student_dataset.py:49-51`,
  `student-training.md:30-31`) does not justify them. The real reason is the ground-panel crop.

**Fix**
- Add crop-decidable members of these classes, so abstention must be learned from evidence. Examples: a drawn garage
  door versus an open mouth; an upper-storey fact that is visible in the crop.
- Apply the unskew and no-hatch rule to a matching share of local scenes.
- Correct the stated justification for the controls.

### D-8 (P2) — `inset_upper` A: a terrace drawn on the upper panel over the strip makes "NO" depend on the word "built"

**Evidence**
- `vrgen2.py:194-196` draws, in A, a textured `TARAS` rectangle on the upper plan exactly over the ground front strip.
  Truth is `NO` (`:206`), with the option text "yes: the upper floor is built over the marked area" / "no: there is no
  upper floor over the marked area" (`common.py:54-55`).
- An upper-level terrace is arguably part of the upper floor. Qwen3-VL-2B answered YES/HIGH on 3 of 3 phase-1 A items
  in C–E. That is weak evidence of the ambiguity.

**Fix:** word the options as "an enclosed upper storey (rooms) over the area" vs "no enclosed storey (open terrace or roof
only)". Alternatively, drop the TARAS texture in A.

### D-9 (P2) — Footprint and VRAM arithmetic in `student-training.md` §2 and §4

**Evidence (against `model-manifest.json` bytes)**

| item | stated | actual | comment |
| --- | --- | --- | --- |
| Qwen3-VL-2B Q8_0 + mmproj F16 | 2.65 GB | 1,834,427,424 + 819,394,848 B | correct |
| InternVL3.5-2B Q8_0 + mmproj F16 | 2.80 GB | 2,165,039,712 + 636,106,464 B | correct |
| Qwen3-VL-2B Q4_K_M + mmproj Q8_0 | 1.56 GB | 1,107,409,952 + 445,053,216 = 1,552,463,168 B = 1.55 GB (1.45 GiB) | units are not stated; at Play's 1.5 GB per-pack limit it matters whether GB or GiB is meant |
| Route A (SmolVLM2-500M), Q8_0 LM + F16 vision | ≈ 0.65 GB | 437 + 199 MB = 0.64 GB | sizes are not in `model-manifest.json`; the only source is `analyzer-005j/android-deployment-matrix.md:23` |

- Route A: "with Q4_K_M LM ≈ 0.45 GB" reads as the LM alone, which would be larger than its Q8_0. It is presumably the
  total.
- The column is titled "total deployable footprint" but leaves out the runtime libraries, which `runtime_matrix.py`
  measures.
- Route A VRAM: "1.0 GB + 4–6 GB activations → 8–12 GB". The 3–5 GB gap (CUDA context, optimizer state, fragmentation)
  is not itemised.
- "Adapter ≈ 10–40 MB" looks low for r = 64. My arithmetic, assuming SmolLM2-360M shapes (32 layers, d = 960, FFN 2,560,
  KV 320), gives about 35 M LoRA parameters on the LM alone, about 70 MB in bf16.
- Duration arithmetic checks out:
  - 10,560 lines × 3 epochs = 31,680 samples.
  - 0.08–0.15 s per sample → 42–79 min.
  - 0.3–0.5 s per sample → 2.6–4.4 h.
- Every VRAM and duration figure is labelled an estimate.

**Fix:** use exact byte sums with units, add the 500M bytes to the manifest, add the runtime libraries, and itemise the
VRAM terms.

### D-10 (P2) — Route A's image-token budget is unstated and may exceed max length 2,048

**Evidence**
- `student-training.md:69-72` assumes "~600–900 tokens" and sets max length 2,048. SmolVLM2's default splitting gives
  about 1,088 image tokens per image (005J `recommendation.md:31`).
- D and E items carry two images, so they could need about 2,200+ tokens and be truncated in the image span.
- `student_probe.py` uses the processor defaults and records `tokens` per step.

**Fix:** state the image configuration for route A (005J's 64-token single tile, or default splitting) and size max
length from the probe's measured tokens.

### D-11 (P2) — Smaller documentation inaccuracies

- **Crop-identity count.** `synthetic-corpus.md:43` says "all 34 context-dependent bake-off items pass", and
  `input-modes.md` says "34 of 34". The bake-off has **38** context-dependent items. The 4 ROT90 singletons
  (`test-{corridor_vs_passage,garage_vs_carport,inset_upper,wing_storey}-s1-A-ROT90-q0`) have no twin in the set, so
  their identity is unchecked (`cropIdenticalToPair: null` in `question-corpus.json`).
- **"≥ 2.8 m outside the crop"** (`synthetic-corpus.md:27`). From `compose5.py:52-57` and the vrgen2 ranges, the crop
  half-side is 4.3–4.55 m from the gap. The back-wall line is therefore at least about 2.65 m outside the crop, and B's
  paving (`gy0 + 0.6`) at least about 2.05 m. This does not matter because byte identity is verified, but the number is
  wrong.
- **`synthetic005M.scenePngSha256BySplit`** in `question-corpus.json` holds **counts**, not hashes. No per-split hash
  list is committed, so split disjointness cannot be audited from the repository without regenerating.
- **Seed disjointness** (`vrgen2.py:337`) relies on fewer than 1,000 pairs per family and at most 10 families, and
  nothing asserts it.

### D-12 (P2) — `student_dataset.py` stores no prompt, although its docstring says it does

**Evidence**
- `student_dataset.py:44` promises `"prompt": <… byte-identical>`. The record only has `promptTemplate`.
- `prompt_for` is called with a placeholder plan size `(1000, 1000)` and `overlay_has_bands=True` (`:106`).
- Target letters are unaffected: option order depends only on class and `orderKey` (`common.py:79-92`), as verified in
  D-5.
- The future collator must recompute the prompt with the composed plan size and the real band count (mode B coordinates,
  mode E wording).

**Fix:** correct the docstring and document the recompute rule in §4.

---

## Checked and OK

- **Split sizes** match `synthetic-corpus.md` and `question-corpus.json`:

  | split | questions | scenes | context-dependent |
  | --- | --- | --- | --- |
  | TRAIN | 2,112 | 1,408 | 1,056 |
  | VAL | 480 | 320 | 240 |
  | TEST | 480 | 320 | 240 |

  Class and answer counts per split match the generator logic. STOREY_COVERAGE is 3:1 YES, as disclosed.
- **No overlap between splits.** No seed, `sceneId`, pair, render PNG SHA-256 or style dict appears in two splits; there
  are no duplicate render hashes at all.
  - Composed images: 532 bench hashes and 337 teacher-item hashes, with 0 shared.
- **Bake-off pool** (`corpus/pool.json`) has no SYNTH_TRAIN. Every SYNTH_GLOBAL question in the selections is TEST.
- **TRAIN pool** (`pool-with-train.json`): all 2,112 SYNTH_TRAIN sources are in `sg-trainval/renders`, and none has a
  TEST hash.
- **Teacher and probe inputs are TRAIN only.**
  - `teacher_select.py` takes SYNTH_TRAIN only (96 qids).
  - `items-train/items.jsonl` (480 lines) and `items-48.jsonl` (240 lines) are all SYNTH_TRAIN.
  - The probe trains on `items-48` with `expectedLetter`, which is generator truth.
- **`teacher_rationale.py`:** TRAIN items only, its prompt does not reveal the truth, and nothing in it is read by
  `student_dataset.py`.
- **Generator truth.** Every family's answer comes from the variant flag of the scene, never from a model or a picture.
  Every expected key in `pool-with-train.json` exists among its class's options (0 mismatches).
  - VAL letters follow the same `orderKey` rule as TRAIN (`corpus.py:118` and `student_dataset.py:97`, 0 mismatches).
- **Crop identity:** 34 of 34 bench context pairs and 48 of 48 teacher-mining context items are byte-identical; maximum
  absolute pixel difference 0.
- **Teacher role in code:** no code path turns a teacher answer into a target (D-6 is the data-format risk).
- **"Qwen3-VL-2B answered UNRESOLVED 0 times in 160 phase-1 replies":** true; all 160 were HIGH.
- **Student plan:**
  - Format implemented and dry-run verified (D-5); commands and outputs are listed.
  - The export plan merges before quantising.
  - Revisions match the manifest (Qwen3-VL-2B `89644892`) and the chain (SmolVLM2-500M `7b375e1`).
  - `peft` and `transformers` match the lock.
  - Estimates are labelled as estimates; the 2.65 GB and 2.80 GB sums are correct.
- **Real-question provenance:**
  - `question-corpus.json` records `truthSource` per question, plus `publisherByteSha256` for publisher frames.
  - GAPSET is labelled as an AI-subagent majority with its `label_source`, and its 6 UNRESOLVED gaps are excluded
    (54 kept).
  - The murajach frame is the GROUND copy `asset-rzut-36e1e5a39d` (005L `blind-round/README.md:69`).
  - Its scale, 655 px / 10.2 m, agrees with 005L's 1,020 cm / 657 px.
  - M1 spans 161 px (2.51 m) against the printed 250. M2 spans 67 px (1.04 m) against the printed 105.
  - The murajach labels were authored before any model ran (pool 14:24, first ranking 19:46).
  - murajach and gozdzikowcach appear only as development sets. No 005M artifact calls them blind or fresh.
  - STOREY A06-S2, checked on the frame: the target lies beyond both registered outlines, so NO is supported.
- **No pixels in Git.** No `data:` URI, PNG/JPEG magic, base64 run (≥ 120 characters) or local publisher-cache path in
  `question-corpus.json`, `model-manifest.json`, `phase1-advancement.json` or `runs/*.jsonl`.
  - The longest string in a run file is 200 characters (`raw` model replies).
  - The 005M guard test checks the same patterns, with a 2 MiB per-file cap.
- **Real images are evaluation-only in every path.** They are absent from the student dataset (dry run) and from every
  teacher-mining item. The teacher sees real images only in its phase-1 evaluation run.

## Round-2 checks (when the rest lands)

1. **`teacher-feasibility.md` and the teacher runs**
   - Is TEST exposure in teacher-p1 stated, or avoided (D-2)?
   - Are teacher-p1 outputs on real and TEST items used only to evaluate the teacher? None may be used to relabel,
     "confirm" or mine.
   - Is teacher agreement measured against generator truth, with the D-1 garage label shown separately?
2. **`student-training.md` §3:** filled from `probe.json`, with `adapterSaved: false`, tokens per D item (against
   max length 2,048 and the 600–900 assumption, D-10), seconds per step and peak RSS.
   - No adapter or checkpoint may exist under `$W/student` or in Git (`history_gate.sh`).
3. **`model-manifest.json`:** SmolVLM2-500M (revision, bytes) added if route A remains the cheapest route (D-9).
4. **Final `matched-bakeoff.json` and tables**
   - SYNTH_GLOBAL with and without `garage_vs_carport` (D-1).
   - Intervals clustered by pair (D-3).
   - `REAL_ALL` split by `truthSource` (D-4).
   - The 4 unchecked ROT90 context items identified (D-11).
5. **`recommendation.md`:** if it is TRAIN_BUILDPLAN_STUDENT or ADOPT_LOCAL_VLM_PILOT, the evaluation contract must be
   fixed (D-4) and the training corpus regenerated (D-1, D-3, D-7) first.
   - TEST-based selection must be disclosed (D-2).
6. **Committed teacher artifacts** (`runs/teacher-*.jsonl`, rationales): text only, labelled teacher output, never
   truth, with no TEST hard-example mining.

## Note on my own footprint

One validation script I ran imported `common.py` without `-B` and created
`research/analyzer-005m/__pycache__/common.cpython-311.pyc` (gitignored, timestamp 23:10:24). I removed that file and
directory right away. Nothing else outside my scratchpad and this report was written.

A new `__pycache__/common.cpython-311.pyc` appeared at 23:17:13. It is not mine: none of my commands after 23:10 imported
`common.py` without `-B`, and a check right after my last import counted 0 cache directories. It is probably another
reviewer's run. It is gitignored, and I left it in place.
