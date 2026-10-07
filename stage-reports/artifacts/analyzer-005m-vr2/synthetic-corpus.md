# 005M synthetic corpus — BuildPlan-owned, generator truth, global context

Generator: `research/analyzer-005m/synthetic/vrgen2.py` v2.0.0. It reuses the 005J scene model and rasteriser
(`research/analyzer-005j/synthetic/vrgen.py` v1.0.0, unchanged) and adds eight families. Every drawing is generated from
a semantic scene in metres and every expected answer is read from that scene: **the truth comes from the generator,
never from a teacher, a published figure or a picture** (brief §12–13). Renders stay outside the repository
(`/home/user/work005m/sg-*`); the repository keeps the code, the seeds and the counts
(`question-corpus.json` → `synthetic005M`).

## Splits

| split | seed base | pairs per family | scenes | questions | of which context-dependent | used for |
| --- | --- | --- | --- | --- | --- | --- |
| TRAIN | 510000 | 22 | 1,408 | **2,112** | 1,056 | student training and teacher hard-example mining only |
| VAL | 520000 | 5 | 320 | **480** | 240 | model selection / early stopping only |
| TEST (sealed) | 530000 | 5 | 320 | **480** | 240 | evaluation only: never shown to a teacher or used to train; 54 of its questions are in the bake-off |

Seed ranges are disjoint; a family's seed is `base + 1000 × family index + pair index`. Both members of a pair use the
same seed, the same style draw and the same random sequence, and differ by exactly one semantic fact. Every scene is
drawn in four transforms (NORMAL, MIRROR, ROT90, ROT180) applied to the scene before rasterisation (text stays upright,
as on a real mirrored sheet). Brief targets were ≥ 2,000 / 400 / 400; all three are met.

## Families

| family | fact that differs between A and B | question classes | crop decides? |
| --- | --- | --- | --- |
| `garage_vs_carport` | an unmarked 2.6–3.1 m front gap: the garage behind it is closed by a back wall 7.2–8.2 m deep (A) / open at the back, a drive-through carport onto paving (B) | GARAGE_DOOR_VS_CARPORT (context), BODY_REGION deep inside (local) | **no** — the difference is ≥ 2.8 m outside the crop |
| `corridor_vs_passage` | a 1.6–2.2 m strip through an 11–13 m deep body: closed by both facades with doors (hall, A) / open at both ends (covered passage, B) | BODY_REGION at mid-depth (context), GAP_KIND at the front end (local) | **no** for the body question |
| `wing_storey` | ground + upper plan: the upper floor covers the one-storey garage wing (A) / ends before it, roof outline dashed (B) | STOREY_COVERAGE on the wing (context) and on the main body (both YES, control) | **no** — the crop shows the ground plan only |
| `inset_upper` | ground + upper plan: the upper floor is set back 2.0–2.8 m from the front, a terrace in front (A) / flush (B) | STOREY_COVERAGE on the front strip (context) and the rear (both YES, control) | **no** |
| `loggia_vs_room` | a 3–4 × 2.6–3.4 m corner of the body: walled room with windows (A) / open loggia on a post with a balustrade line (B) | LOGGIA_VS_ROOM | yes |
| `compound_front` | door + 0.35–0.6 m pier + garage door (A) / one open side to a covered porch with a post (B) — the narrow-pier case | OPEN_SIDE_VS_OPENINGS | yes |
| `glazed_front` | a 4–6 m glazed wall (A) / the same span open to a recessed terrace (B) — large glazing vs boundary | WALL_CONTINUATION | yes |
| `phantom_line` | a partition with a door gap (A) / a thin floor-finish line with the same gap (B) — drawn gap vs phantom line | GAP_KIND | yes |

Style axes come from 005J's `sample_style` per pair: wall fill (solid, hatch, grey, outline), line weight, window and
door symbols, garage-door convention, furniture, labels, dimension chains, terrace textures, anti-aliasing, blur, JPEG
30–75, skew, low contrast, salt noise.

## The global-context guarantee, and what it cost

For a context-dependent pair the composer checks that the two CROP_ONLY images are **byte-identical**
(`compose5.py` → `cropIdenticalToPair`): **all 34 context-dependent bake-off items pass**. A model that answers the two
members differently in mode A is not reading the crop; the best it can do there is UNRESOLVED.

Two rasteriser properties had to be neutralised for this, found by measuring the crops, not assumed:

1. 005J's rasteriser phases the HATCH wall fill per wall polygon, so a back wall 7 m away shifted the hatch inside the crop.
2. A skewed sheet rasterises a wall outline whose far end moves with different stair-steps along its whole length.

Context-dependent families therefore draw unskewed and use OUTLINE where the style asked for HATCH. Before the fix, 14 of
34 context items had crops that differed (maximum pixel difference up to 116). Local families keep every style axis.

## Known limits

- **Class balance.** STOREY_COVERAGE is 3:1 YES because both storey families carry a both-YES control. Every other
  class is balanced within a family. The bake-off reports the majority floor per set.
- **One rasteriser.** Every scene shares the 005J pen model. Real-sheet style transfer is the open risk that 005J's
  Route-C pilot measured (85 % synthetic, 49.6 % real); nothing here claims to close it.
- **No real image is training data.** Real development crops (REAL_DEV, ROUND8_DEV, MURAJACH_DEV, STOREY_DEV, GAPSET_DEV)
  are evaluation-only in every route. No ResPlan, CubiCasa5K or other third-party plan corpus is used (005J
  licensing: none is commercially clean).
