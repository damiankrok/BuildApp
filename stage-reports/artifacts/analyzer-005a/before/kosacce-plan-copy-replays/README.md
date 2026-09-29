# Kosaćce 46 — the phone's tracked-URL failure, reproduced by withholding plan copies

The clean Kosaćce evidence (`../kosacce-clean`: source package, observation graph and
metric evidence read on the desktop from the clean URL) replayed through the solver
alone (`npm run analysis:second-house -- --package … --graph … --metrics … --drop-frames …`)
with three of its four ground-plan copies withheld from the solver:

| kept copy | outcome | matches the OWNER's phone report? |
| --- | --- | --- |
| 853 px AREA_TABLE (`…z-powierzchniami…__11915.gif`) | `PLAN_LAYOUT_REJECTED` / `FOOTPRINT_AREA_WRONG`: 33.15 m² vs 164.47 m² (79.8 %), 70 chains / 4 read, 88 bands, grid 8×6, 35 cells / 31 enclosed, 3 built regions, 2 masses, 2.4057 cm/px | **yes — every number** |
| 853 px DIMENSIONED (`…__11815.gif`, the copy the desktop chooses) | COMPLETED, model `5b5ffcf1afcd…` (= the sealed 004A model) | — |
| 550 px DIMENSIONED page copy | `PLAN_NO_WALLED_ENVELOPE` (82 bands, 45 chains / 2 read, grid 5×3) | — |
| 400 px DIMENSIONED page copy | `PLAN_NO_WALLED_ENVELOPE` (49 bands, 30 chains / 3 read, grid 6×3) | — |

So on the OWNER's phone the tracked-URL run had ONE plan frame (the area-table copy)
where the desktop has four; the tracking query itself changes nothing in the evidence
(the tracked URL on the desktop gives the identical model). The analyzer then read the
area-table copy as if it were the dimensioned sheet — one copy per storey, the first
decodable, no alternative — and the footprint gate refused the tiny layout as "not of
this building" instead of saying that the dimensioned plan copies were not available.
