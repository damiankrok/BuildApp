# 005M synthetic corpus — BuildPlan-owned, generator truth, global context

Generator: `research/analyzer-005m/synthetic/vrgen2.py`.

- **What it reuses.** The 005J scene model and rasteriser (`research/analyzer-005j/synthetic/vrgen.py` v1.0.0,
  unchanged). vrgen2 adds eight families on top.
- **Where truth comes from.** Every drawing is generated from a semantic scene in metres, and every expected answer is
  read from that scene. **The truth comes from the generator, never from a teacher, a published figure or a picture**
  (brief §12–13).
- **Where things are kept.** Renders stay outside the repository (`/home/user/work005m/sg-*`). The repository keeps:
  - the code;
  - the seeds;
  - the counts at every level;
  - a digest of every split's render hashes;
  - the full hash lists of the evaluation splits.

  All of it is in `question-corpus.json` → `synthetic005M` (2.0.0) and `synthetic005M_v2_1` (2.1.0).

There are two versions. **2.0.0** produced the bake-off's synthetic questions. **2.1.0**, written after review,
corrects two families and adds a split that no model has seen. `--compat 2.0.0` reproduces 2.0.0 byte for byte
(checked on 16 renders and 32 questions).

## Splits — counted at every level

Transforms (NORMAL, MIRROR, ROT90, ROT180) are augmentations of one drawing, not new evidence. A drawing is one member
of a counterfactual pair, and a seed draws one pair. These counts were computed from the corpora by
`question_corpus.py` (post-review D-3).

| version | split | seed base | pairs per family | **independent seeds** | **drawings** | renders | questions | of which context-dependent | used for |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.0.0 | TRAIN | 510000 | 22 | 176 | 352 | 1,408 | 2,112 | 1,056 | teacher hard-example mining (42 questions) |
| 2.0.0 | VAL | 520000 | 5 | 40 | 80 | 320 | 480 | 240 | — |
| 2.0.0 | TEST | 530000 | 5 | 40 | 80 | 320 | 480 | 240 | **the bake-off**: 54 questions in SYNTH_GLOBAL, 39 after the review's exclusions. Shown to the bake-off models and used in phase-1 model selection; never shown to a teacher or a student |
| **2.1.0** | TRAIN | 510000 | 125 | 1,000 | **2,000** | 8,000 | 11,000 | — | any student's training |
| **2.1.0** | VAL | 520000 | 25 | 200 | **400** | 1,600 | 2,200 | — | student model selection, threshold freezing |
| **2.1.0** | SEALED | 540000 | 25 | 200 | **400** | 1,600 | 2,200 | — | **a student's evaluation; shown to no model, teacher or student** |

- **The brief's ≥ 2,000 / 400 / 400 is met by 2.1.0 in independent drawings.** In questions the counts are 11,000 /
  2,200 / 2,200, and at five modes per question the student set has 55,000 training lines.
- **2.0.0 met the target only by counting transforms and questions,** so it is not the training corpus.
- **Disjointness.** The splits share no seed and no render hash: `splitsDisjointByRenderHashAndSeed: true`, and 2.1.0
  has no render in common with the 2.0.0 TEST split.
- **Seeds.** A family's seed is `base + 1000 × family index + pair index`, so the ranges stay disjoint while a split
  has fewer than 1,000 pairs per family.
  - Both members of a pair use the same seed, the same style draw and the same random sequence, and differ by exactly
    one semantic fact.
  - The first 22 TRAIN pairs of an unchanged family are the same scenes in both versions.

## Families

| family | fact that differs between A and B | question classes | crop decides? |
| --- | --- | --- | --- |
| `garage_vs_carport` | an unmarked 2.6–3.1 m front gap, the same in both members. The bay behind it is closed by a back wall 7.2–8.2 m deep (A), or open at the back, a drive-through carport onto paving (B) | **2.1.0:** BAY_BACK_CLOSED_VS_DRIVE_THROUGH (context). **2.0.0:** GARAGE_DOOR_VS_CARPORT (context) and BODY_REGION deep inside (local). Both are ill-posed for A, because an unmarked gap is drawn the way an open mouth is (post-review B-2 / D-1; excluded from scoring) | **no.** The back wall is about 2.65 m or more outside the crop, and B's paving about 2.05 m or more |
| `corridor_vs_passage` | a 1.6–2.2 m strip through an 11–13 m deep body: closed by both facades with doors (hall, A), or open at both ends (covered passage, B) | BODY_REGION at mid-depth (context), GAP_KIND at the front end (local) | **no** for the body question |
| `wing_storey` | ground + upper plan: the upper floor covers the one-storey garage wing (A), or ends before it with the roof outline dashed (B) | STOREY_COVERAGE on the wing (context) and on the main body (both YES, control) | **no.** The crop shows the ground plan only |
| `inset_upper` | ground + upper plan: the upper floor is set back 2.0–2.8 m from the front (A), or flush (B). In 2.0.0, A also drew a terrace on the upper plan over the strip, which made "no upper floor over it" arguable; 2.1.0 draws none (D-8) | STOREY_COVERAGE on the front strip (context) and the rear (both YES, control) | **no** |
| `loggia_vs_room` | a 3–4 × 2.6–3.4 m corner of the body: a walled room with windows (A), or an open loggia on a post with a balustrade line (B) | LOGGIA_VS_ROOM | yes |
| `compound_front` | door + 0.35–0.6 m pier + garage door (A), or one open side to a covered porch with a post (B): the narrow-pier case | OPEN_SIDE_VS_OPENINGS | yes |
| `glazed_front` | a 4–6 m glazed wall (A), or the same span open to a recessed terrace (B): large glazing vs boundary | WALL_CONTINUATION | yes |
| `phantom_line` | a partition with a door gap (A), or a thin floor-finish line with the same gap (B): drawn gap vs phantom line | GAP_KIND | yes |

**Style axes** come from 005J's `sample_style` per pair:
- wall fill (solid, hatch, grey, outline), line weight;
- window and door symbols, the garage-door convention, furniture, labels, dimension chains, terrace textures;
- anti-aliasing, blur, JPEG 30–75, skew, low contrast, salt noise.

## The global-context guarantee, and what it cost

For a context-dependent pair, the composer checks that the two CROP_ONLY images are **byte-identical**
(`compose5.py` → `cropIdenticalToPair`).

- **Coverage.** All 34 twin-paired bake-off items pass. The bake-off has 38 context-dependent items; the 4 ROT90
  singletons have no twin in the set, so they are not checked.
- **What it means.** Where the two members' truths differ, a model that answers them differently in mode A is not
  reading the crop, and UNRESOLVED is the best it can do there.
- **Control pairs.** The storey rear is YES in both members, so it is a control, scored apart.

Two rasteriser properties had to be neutralised for this. Both were found by measuring the crops, not assumed:
1. 005J's rasteriser phases the HATCH wall fill per wall polygon, so a back wall 7 m away shifted the hatch inside the
   crop.
2. A skewed sheet rasterises a wall outline whose far end moves with different stair-steps along its whole length.

Context-dependent families therefore draw unskewed and use OUTLINE where the style asked for HATCH. Before the fix, 14
of 34 context items had crops that differed (maximum pixel difference up to 116). Local families keep every style axis.

## Known limits

- **Class balance.** STOREY_COVERAGE is 3:1 YES, because both storey families carry a both-YES control. Every other
  class is balanced within a family. The bake-off reports image-free baselines per set (always-letter, the
  first-option rule, and the per-class majority as an upper bound).
- **One rasteriser.** Every scene shares the 005J pen model. Real-sheet style transfer is the open risk that 005J's
  Route-C pilot measured (85 % synthetic, 49.6 % real); nothing here claims to close it.
- **Abstention shortcuts.** A student could learn to abstain from class, mode or style instead of from missing
  evidence (`student-training.md` §1).
- **No real image is training data.** Real development crops (REAL_DEV, ROUND8_DEV, MURAJACH_DEV, STOREY_DEV,
  GAPSET_DEV) are evaluation-only in every route. No ResPlan, CubiCasa5K or other third-party plan corpus is used
  (005J licensing: none is commercially clean).
