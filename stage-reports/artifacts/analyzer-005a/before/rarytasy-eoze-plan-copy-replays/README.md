# Rarytasy e-OZE — the phone's failure, reproduced by withholding plan copies

The desktop evidence (`../rarytasy-eoze`, all four ground-plan copies present) fails on the
853 px DIMENSIONED copy with `PLAN_NO_WALLED_ENVELOPE` (45 bands, 81 chains / 9 read, grid
15×2). Replaying the solver with copies withheld:

| kept copy | outcome | matches the OWNER's phone report? |
| --- | --- | --- |
| 853 px AREA_TABLE | `PLAN_NO_WALLED_ENVELOPE`: 51 bands, 62 chains / 3 read, grid 3×2, 2 cells / 0 enclosed, 2.5014 cm/px, wall 15 px | **yes — every number** |
| 550 px DIMENSIONED page copy | `PLAN_LAYOUT_REJECTED` / `FOOTPRINT_AREA_WRONG`: one 50.48 m² mass against 122.07 m² (grid 5×4, 12 cells all enclosed, 2.222 cm/px) | — |

So, as for Kosaćce, the phone had only the area-table copy. On the desktop the dimensioned
copy fails for a different single-hypothesis reason: its only READ vertical chain is a 68 px
interior detail chain (ticks at y = 287 / 317 / 355) while the printed 760 total on the left
margin is rotated text and was not read, so `dimensionedExtent` makes the plan a 720 × 68 px
strip, the horizontal walls at y = 247 and y = 569 fall outside it, and `walledEnvelope` is null.
The 550 px copy reaches a walled, fully enclosed one-mass layout that is too small by a scale
(2.222 cm/px against the 1600 cm chain over 720 px of the 853 px sheet) the footprint residual
would have ranked below a correctly scaled reading — had there been one to rank.
