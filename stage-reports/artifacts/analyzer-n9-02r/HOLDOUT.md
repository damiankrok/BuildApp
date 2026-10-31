# N9-02R — frozen synthetic facade holdout

Frozen at 2026-10-31T11:13:38Z on base `10bdce8`, before any reader code was written. Seed 92021. Generator: `packages/analysis-service/test/fixtures/facade-holdout.ts`.
The manifest is `holdout-manifest.json`: exact truth per sheet, and the sha256 of every raster's RGBA bytes.

Expected decisions:
- **ACCEPT**: both wall ends are drawn and visible; they must be read within 3 px.
- **REFUSE**: an end is not decidable from the image; any acceptance is a hard false acceptance.
- **EITHER**: a correct reading or a refusal are both sound.

The reader was developed only on development seeds 7, 11 and 23 of the same generator. It was evaluated on the holdout ONCE (2026-10-31T11:22:11Z, reader sha256 `3ead1407…`).

## Scores (one evaluation each)

| reader | true accept | false accept | false refusal | true refusal | hard false accepts on REFUSE |
|---|---|---|---|---|---|
| n9-02a | 8 | 3 | 10 | 9 | 3 |
| n9-02r | 18 | 0 | 0 | 12 | 0 |

## Per sheet

| sheet | family | expected | truth (wall ends px) | m/px | N9-02A reader | N9-02R reader |
|---|---|---|---|---|---|---|
| pos-white-0 | WHITE_PLASTER | ACCEPT | 474..951 | 0.022589 | FALSE_REFUSAL | TRUE_ACCEPT [474, 951] err 0 px |
| pos-colour-0 | COLOURED_FACADE | ACCEPT | 443..975 | 0.02026 | FALSE_REFUSAL | TRUE_ACCEPT [443, 975] err 0 px |
| pos-dark-0 | DARK_AND_WHITE | ACCEPT | 497..934 | 0.024445 | TRUE_ACCEPT [499, 931] err 3 px | TRUE_ACCEPT [497, 934] err 0 px |
| pos-gable-0 | GABLE_CHIMNEY | ACCEPT | 564..836 | 0.026354 | TRUE_ACCEPT [565, 834] err 2 px | TRUE_ACCEPT [564, 836] err 0 px |
| pos-tree-mid-0 | TREE_MID_FACADE | ACCEPT | 520..913 | 0.029421 | FALSE_REFUSAL | TRUE_ACCEPT [520, 913] err 0 px |
| pos-pergola-0 | PERGOLA_DETACHED | ACCEPT | 424..942 | 0.018121 | FALSE_REFUSAL | TRUE_ACCEPT [424, 942] err 0 px |
| pos-balcony-0 | BALCONY_PAST_END | ACCEPT | 488..868 | 0.027575 | FALSE_REFUSAL | TRUE_ACCEPT [488, 868] err 0 px |
| pos-drawn-0 | DRAWN_LINES | ACCEPT | 410..999 | 0.019164 | TRUE_ACCEPT [412, 996] err 3 px | TRUE_ACCEPT [410, 999] err 0 px |
| pos-flat-0 | NO_PITCHED_ROOF | ACCEPT | 472..864 | 0.025474 | FALSE_REFUSAL | TRUE_ACCEPT [472, 864] err 0 px |
| neg-tree-end-0 | TREE_OVER_END | REFUSE | 443..918 | 0.025645 | TRUE_REFUSAL | TRUE_REFUSAL |
| neg-white-sky-0 | WHITE_ON_WHITE | REFUSE | 532..902 | 0.029377 | TRUE_REFUSAL | TRUE_REFUSAL |
| neg-screen-0 | PERGOLA_SCREEN_ATTACHED | EITHER | 406..927 | 0.018398 | TRUE_REFUSAL | TRUE_REFUSAL |
| neg-crop-0 | CUT_BY_SHEET | REFUSE | 403..984 | 0.016504 | TRUE_REFUSAL | TRUE_REFUSAL |
| neg-persp-0 | PERSPECTIVE | REFUSE | 529..931 | 0.029054 | TRUE_REFUSAL | TRUE_REFUSAL |
| neg-hidden-0 | MOSTLY_OCCLUDED | REFUSE | 447..924 | 0.020695 | FALSE_ACCEPT [519, 832] err 92 px | TRUE_REFUSAL |
| pos-white-1 | WHITE_PLASTER | ACCEPT | 526..921 | 0.028816 | FALSE_REFUSAL | TRUE_ACCEPT [526, 921] err 0 px |
| pos-colour-1 | COLOURED_FACADE | ACCEPT | 461..1048 | 0.016336 | TRUE_ACCEPT [462, 1046] err 2 px | TRUE_ACCEPT [461, 1048] err 0 px |
| pos-dark-1 | DARK_AND_WHITE | ACCEPT | 478..937 | 0.024541 | FALSE_REFUSAL | TRUE_ACCEPT [478, 937] err 0 px |
| pos-gable-1 | GABLE_CHIMNEY | ACCEPT | 454..885 | 0.019694 | FALSE_REFUSAL | TRUE_ACCEPT [454, 885] err 0 px |
| pos-tree-mid-1 | TREE_MID_FACADE | ACCEPT | 445..922 | 0.024483 | FALSE_REFUSAL | TRUE_ACCEPT [445, 922] err 0 px |
| pos-pergola-1 | PERGOLA_DETACHED | ACCEPT | 489..852 | 0.027496 | TRUE_ACCEPT [490, 850] err 2 px | TRUE_ACCEPT [489, 852] err 0 px |
| pos-balcony-1 | BALCONY_PAST_END | ACCEPT | 406..954 | 0.020576 | TRUE_ACCEPT [408, 951] err 3 px | TRUE_ACCEPT [406, 954] err 0 px |
| pos-drawn-1 | DRAWN_LINES | ACCEPT | 512..947 | 0.026626 | TRUE_ACCEPT [511, 947] err 1 px | TRUE_ACCEPT [512, 947] err 0 px |
| pos-flat-1 | NO_PITCHED_ROOF | ACCEPT | 542..879 | 0.027205 | TRUE_ACCEPT [542, 879] err 0 px | TRUE_ACCEPT [542, 879] err 0 px |
| neg-tree-end-1 | TREE_OVER_END | REFUSE | 342..975 | 0.01957 | FALSE_ACCEPT [453, 975] err 111 px | TRUE_REFUSAL |
| neg-white-sky-1 | WHITE_ON_WHITE | REFUSE | 427..926 | 0.025616 | TRUE_REFUSAL | TRUE_REFUSAL |
| neg-screen-1 | PERGOLA_SCREEN_ATTACHED | EITHER | 393..1092 | 0.018571 | TRUE_REFUSAL | TRUE_REFUSAL |
| neg-crop-1 | CUT_BY_SHEET | REFUSE | 409..946 | 0.022669 | FALSE_ACCEPT [409, 855] err 91 px | TRUE_REFUSAL |
| neg-persp-1 | PERSPECTIVE | REFUSE | 388..970 | 0.01922 | TRUE_REFUSAL | TRUE_REFUSAL |
| neg-hidden-1 | MOSTLY_OCCLUDED | REFUSE | 501..959 | 0.026341 | TRUE_REFUSAL | TRUE_REFUSAL |

## What the holdout does not contain

The real ARCHON renders showed classes this holdout lacks:
- background trees standing BEHIND the wall ends;
- white walls against white clouds;
- soft shading and JPEG noise;
- watermarks;
- line drawings whose roof is drawn as open lines, not as a filled region (the synthetic Larchfield).

The holdout's score is therefore an upper bound for this reader, not its accuracy on real sources.
