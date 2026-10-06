# Synthetic Visual Referee corpus (BUILDPLAN-ANALYZER-005J)

Generator: `research/analyzer-005j/synthetic/vrgen.py` (v1.0.0). Overlays and crops: `research/analyzer-005j/compose.py`.
Analyzer observations for the SEMANTIC_OVERLAY mode: `research/analyzer-005j/bands.ts` (the production `planSheet` wall
bands, read-only, on exactly the rendered pixels). Every image is generated; **no publisher pixel is in this corpus**, and
its files stay outside the repository (`$WORK/synth`, `$WORK/qs`); the repository holds the generator, the question
records and hashes.

## 1. How truth is made

Each scene is built **in metres** from semantic primitives — exterior/interior walls with typed openings (WINDOW,
GLAZED, DOOR, DOUBLE_DOOR, SLIDING, GARAGE_DOOR, OPEN), regions with roles (BODY, GARAGE, TERRACE, PORCH, PATIO,
PERGOLA, CARPORT, DRIVEWAY, VOID, COURTYARD, UNDERCUT, BAY, STEPS…), columns, dimension chains, labels, furniture,
cars and stairs — and only then rasterised. **The expected answer of every question is read from those semantics**
(e.g. a garage is GARAGE_BODY = YES exactly when the scene encloses it with walls and a garage door). No answer comes
from a model, a published figure or a picture. The same scene geometry also gives exact wall / opening masks for the
wall-model proof (`wallproof/trainset.py`).

Conventions follow the analyzer's own synthetic drawings (`packages/synthetic-drawings`: ink on paper, wall-thick
solids, slash dimension ticks) and deliberately widen them so a model has to learn architecture, not one pen.

## 2. Families and counterfactual pairs (brief §21–§22)

Every family is generated as a **counterfactual pair**: variants A and B share the seed and the drawing style and differ by
**one semantic fact**. 18 families:

| family | A | B | classes asked |
| --- | --- | --- | --- |
| garage_link | garage tied to the body by an enclosed connector | the same drawing, connector removed (a dashed path only) | GARAGE_BODY, BODY_REGION |
| detached_garage | garage sharing the house wall (door into the house) | the same garage 1–2 m away | GARAGE_BODY |
| garage_door_vs_open | garage door in a continuing facade | the same gap with nothing across it: an open carport | WALL_CONTINUATION, GARAGE_BODY |
| porch_recess | recessed entrance porch; enclosure steps back to an inner wall with the door | facade continuous, door in the facade, vestibule inside | WALL_CONTINUATION, BODY_REGION ×2 |
| porch_plus_garage (*gozdzikowcach analogue*) | porch mouth + pier + garage door, hall/stair behind the porch | the same stretch is one open side to a patio | OPEN_SIDE_VS_OPENINGS, BODY_REGION |
| terrace_vs_room | rectangle beside the body closed by exterior walls with windows | the same rectangle as a terrace (thin outline + texture) | TERRACE_VS_BODY, OUTER_BOUNDARY_A_OR_B ×2 |
| pergola_line | pergola beam on posts with slats | the same line as an enclosing wall (winter garden) | CANOPY_PERGOLA_VS_WALL |
| canopy_roofline | dashed roof projection beyond the facade | a wall at the same place (room extended) | CANOPY_PERGOLA_VS_WALL |
| podcien | undercut corner on a column under the upper floor | the same corner enclosed | BODY_REGION, COLUMN_VS_WALL |
| bay | walled bay / risalit with windows | the same outline as thin steps | BAY_OR_RISALIT |
| glazing_terrace (*cyklamenach analogue*) | window + double door beside a densely textured (boards) terrace | the dark band is the terrace's hatched kerb with a break: pattern | OPENING_VS_PATTERN |
| multi_window | glazing / wide sliding door / two close windows in a continuing wall | the same gap where the walls genuinely end | WALL_CONTINUATION, OPENING_VS_PATTERN |
| void_vs_courtyard | stair void (X, railing, stair) inside the upper floor | open courtyard (walls, window, paving) | VOID_VS_OUTSIDE |
| storey | two panels, upper floor covers the ground-floor wing | upper floor ends before the wing (dashed roof) | STOREY_COVERAGE |
| dim_vs_building | dimension line with ticks and value outside the facade | a terrace edge line at the same place | DIMENSION_LINE_VS_BUILDING_LINE ×(1–2) |
| column_vs_pier | isolated posts under a canopy | the same dark square as a pier between two windows | COLUMN_VS_WALL |
| car_garage | car in an enclosed garage | the same car on an open, paved driveway | GARAGE_BODY |
| outer_boundary_mix | L-body + garage + terrace, one right outline vs one wrong | both outlines wrong: NEITHER | OUTER_BOUNDARY_A_OR_B ×2 |

Families cover the brief's list: attached / detached / recessed garage, garage door breaking a wall, recessed porch, porch
+ garage door, terrace beside a full facade, pergola, canopy, podcień, bay/risalit, glazed facade, wide sliding door,
close windows, textured/hatched terrace, stair void, atrium/courtyard, partial upper floor, garage only on the ground floor,
roof projection, dimension lines near a wall, isolated columns, furniture and a vehicle near walls; scan blur,
compression, skew, low contrast and mirror image are style/transform axes (below). Side placement (garage, terrace, bay,
porch position) is drawn per seed, independently of the transform.

**Outline letters** (OUTER_BOUNDARY_A_OR_B) are always asked **in both orders**, so a position bias shows up as an error.

## 3. Mirror / rotation invariance (§23)

Every scene is rendered under **NORMAL, MIRROR, ROT90 and ROT180**. The transform is applied to the scene **before**
rasterisation, so text stays upright (as on a real mirrored sheet) and the overlays move with the geometry (A stays A).
The expected answer is invariant by construction; consistency is measured per base question and mode.

## 4. Style variation (§24)

Drawn per counterfactual pair (both members share it). On the benchmark corpus (54 pairs):

| axis | values (count of pairs) |
| --- | --- |
| wall fill | SOLID 29, HATCH 13, GREY 7, OUTLINE 5 |
| scale | 22 / 26 / 30 / 34 / 40 px/m: 9 / 12 / 15 / 8 / 10 |
| anti-aliasing | on 27, off 27 |
| blur (Gaussian σ 0.5–1.3) | 29 |
| JPEG (q 75 / 45 / 30) | 30 |
| skew (−1.5…2.2°) | 28 |
| low contrast (ink 95–120 on paper 215–230) | 14 |
| terrace texture | BOARDS 15, DOTS 14, HATCH 9, TILES 8, none 8 |
| dimension chains | 0: 14, 1: 25, 2: 15 |
| furniture | none 17, light 20, dense 17 |
| room labels | 35 on, 19 off |
| window symbol | 2 or 3 lines; door arcs on/off; garage door dashed / thin double / thin single |
| noise | speckle 0–3 % |

## 5. Sizes and seeds

| corpus | seeds | scenes | questions | use |
| --- | --- | --- | --- | --- |
| benchmark | `--seed-base 50050 --seeds 3` | 432 (18 families × 3 seeds × 2 variants × 4 transforms) | 672 (87 counterfactual pairs, 72 with different truth) | the VLM bake-off, the oracle sample |
| pilot training (Route C) | `--seed-base 60060 --seeds 8` | 1,152 | 1,792 | the micro-referee pilot only — disjoint seeds |
| wall proof train / test | `trainset.py --seed-base 70000 --seeds 10` / `90000 --seeds 3` | 360 / 108 | — | wall/opening masks |

Benchmark questions per class (NORMAL transform; ×4 transforms in the corpus) and their expected-answer balance:

| class | n | answers |
| --- | --- | --- |
| BODY_REGION | 30 | YES 18 / NO 12 |
| GARAGE_BODY | 24 | YES 12 / NO 12 |
| OUTER_BOUNDARY_A_OR_B | 24 | A 9 / B 9 / NEITHER 6 |
| WALL_CONTINUATION | 18 | CONTINUES 9 / TERMINATES 9 |
| CANOPY_PERGOLA_VS_WALL | 12 | WALL 6 / NOT_WALL 6 |
| COLUMN_VS_WALL | 12 | COLUMN 6 / WALL 6 |
| OPENING_VS_PATTERN | 9 | OPENING 6 / PATTERN 3 |
| DIMENSION_LINE_VS_BUILDING_LINE | 9 | BUILDING 6 / ANNOTATION 3 |
| OPEN_SIDE_VS_OPENINGS | 6 | SEVERAL_OPENINGS 3 / ONE_OPEN_SIDE 3 |
| TERRACE_VS_BODY | 6 | ENCLOSED 3 / EXTERNAL 3 |
| BAY_OR_RISALIT | 6 | YES 3 / NO 3 |
| VOID_VS_OUTSIDE | 6 | VOID 3 / OUTSIDE 3 |
| STOREY_COVERAGE | 6 | YES 3 / NO 3 |

`corpus.json` SHA-256 (benchmark): `22919e38a82723dd38d7eadf223ce1fe69859b0fc8e446098e1de3381dcf12c2`. Every rendered PNG's
SHA-256 is in `question-corpus.json`.

## 6. Known weaknesses of the corpus (stated, not hidden)

- **One generator, one author.** Families, conventions and styles come from one code base; a model trained on it can learn
  the generator. Real development questions (`question-corpus.json`, sets REAL_DEV / REAL_BLIND8) are the check.
- **Some counterfactuals encode a convention, not a law.** `garage_door_vs_open` B (open carport) is defined by the
  absence of a garage-door symbol; some real sheets omit the symbol. The in-session strong oracle answered those YES at
  0.70–0.75 (below the confident bar): an honest ambiguity, not a model failure.
- **Real drawings carry what the generator does not:** watermarks, coloured fills, publisher fonts, dense callout rings.
- **Balance is uneven** across classes (6–30 base questions per class); per-class rates on small classes are indicative.
