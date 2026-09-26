# Marcówki analyzer-v2 evaluation against source truth v2

Building `stage-reports/artifacts/analyzer-v2/marcowki-building.json` (Marcówki (auto v3)) against `research/marcowki-v2/marcowki-source-truth-v2.json` (sealed 2026-09-24, 138 items). No aggregate score: per-family counts and the worst deltas only.

## Frame

Truth: metres north of the front outer plane: the outer face of the front returns is z=0, the front wall outer face z=1.00, the rear wall outer face z=13.60, the rear outer plane z=14.60

Building: front recess mouth z = 0, main mass z 0.991..13.601, rear recess mouth z = 14.601, x 0..12.05 → **same frame, no conversion applied**.

## Tolerance rules

- `general`: max(truth.uncertainty.m, 0.05) m — levels, heights, sills/heads, image-registered verticals, tread goings
- `plan`: max(truth.uncertainty.m, 0.10) m — plan-derived lengths and positions (footprints, intervals, widths, wall centres and spans, thicknesses, plan rectangles)
- `angle`: max(truth.uncertainty.deg, 0.5)°
- `area`: max(truth.uncertainty.m2, 0.5) m²
- `exact`: categorical / count: exact equality

## Per-family summary

| family | truth items | MATCH | PARTIAL | MISSING | unresolved | not a feature |
|---|---:|---:|---:|---:|---:|---:|
| FRAME | 1 | 1 | 0 | 0 | 0 | 0 |
| REGISTRATION | 8 | 0 | 0 | 0 | 0 | 8 |
| PAGE_FACT | 10 | 0 | 0 | 0 | 0 | 10 |
| PAGE_SPEC | 3 | 2 | 1 | 0 | 0 | 0 |
| PAGE_ROOM_TABLE | 1 | 0 | 0 | 0 | 0 | 1 |
| LEVEL | 9 | 6 | 2 | 1 | 0 | 0 |
| MASS | 5 | 4 | 1 | 0 | 0 | 0 |
| RECESS | 3 | 3 | 0 | 0 | 0 | 0 |
| RETURN | 2 | 1 | 1 | 0 | 0 | 0 |
| ROOF | 4 | 3 | 1 | 0 | 0 | 0 |
| ROOF_MEMBER | 1 | 1 | 0 | 0 | 0 | 0 |
| SHADOW | 1 | 0 | 0 | 0 | 0 | 1 |
| CHIMNEY | 2 | 0 | 2 | 0 | 0 | 0 |
| ROOFLIGHT | 3 | 0 | 3 | 0 | 0 | 0 |
| OPENING | 12 | 3 | 9 | 0 | 0 | 0 |
| INTERIOR_WALL | 24 | 14 | 9 | 1 | 0 | 0 |
| ROOM | 19 | 1 | 18 | 0 | 0 | 0 |
| STAIR | 1 | 0 | 1 | 0 | 0 | 0 |
| BALCONY | 2 | 1 | 1 | 0 | 0 | 0 |
| PORTAL | 1 | 1 | 0 | 0 | 0 | 0 |
| FACADE_MEMBER | 1 | 1 | 0 | 0 | 0 | 0 |
| RAILING | 2 | 0 | 2 | 0 | 0 | 0 |
| FACADE_ASSEMBLY | 4 | 1 | 3 | 0 | 0 | 0 |
| MATERIAL_REGION | 7 | 0 | 0 | 0 | 0 | 7 |
| UNRESOLVED | 12 | 0 | 0 | 0 | 12 | 0 |

## Worst deltas (numeric properties OUTSIDE tolerance, by |Δ|)

| truth item | property | truth | auto | Δ | tol | unit |
|---|---|---:|---:|---:|---:|---|
| T2-ROOM-G-STAIR — room stair Schody (shaft, no number on the ground table) | polygonAreaM2 | 5.37 | 47.593 | 42.223 | 0.5 | m2 |
| T2-ROOM-G-2 — room 2 Hol | polygonAreaM2 | 8.63 | 47.593 | 38.963 | 0.5 | m2 |
| T2-ROOM-G-3 — room 3 Kuchnia | polygonAreaM2 | 9.62 | 47.593 | 37.973 | 0.5 | m2 |
| T2-ROOM-U-8 — room 8 Garderoba (north-east) | polygonAreaM2 | 2.64 | 20.895 | 18.255 | 0.5 | m2 |
| T2-ROOM-G-4 — room 4 Salon + Jadalnia | polygonAreaM2 | 29.61 | 47.593 | 17.983 | 0.5 | m2 |
| T2-ROOM-U-9 — room 9 Schody | polygonAreaM2 | 5.93 | 20.895 | 14.965 | 0.5 | m2 |
| T2-ROOM-U-1 — room 1 Korytarz | polygonAreaM2 | 6.68 | 20.895 | 14.215 | 0.5 | m2 |
| T2-ROOM-U-3 — room 3 Garderoba (south-west) | polygonAreaM2 | 6.79 | 18.275 | 11.485 | 0.5 | m2 |
| T2-ROOM-U-7 — room 7 Pokój (north-east) | polygonAreaM2 | 11.18 | 20.895 | 9.715 | 0.5 | m2 |
| T2-ROOM-G-STAIR — room stair Schody (shaft, no number on the ground table) | bounds.z1 | 7.4 | 13.131 | 5.731 | 0.1 | m |
| T2-ROOM-U-2 — room 2 Pokój (south) | polygonAreaM2 | 12.73 | 18.275 | 5.545 | 0.5 | m2 |
| T2-ROOM-G-4 — room 4 Salon + Jadalnia | bounds.z0 | 8.69 | 3.631 | -5.059 | 0.1 | m |
| T2-ROOM-U-7 — room 7 Pokój (north-east) | bounds.z0 | 9.9 | 4.881 | -5.019 | 0.1 | m |
| T2-ROOM-G-STAIR — room stair Schody (shaft, no number on the ground table) | bounds.x0 | 5.36 | 0.49 | -4.87 | 0.1 | m |
| T2-ROOM-U-9 — room 9 Schody | bounds.z1 | 8.44 | 13.131 | 4.691 | 0.1 | m |
| T2-ROOM-G-2 — room 2 Hol | bounds.z1 | 9.01 | 13.131 | 4.121 | 0.1 | m |
| T2-ROOM-G-3 — room 3 Kuchnia | bounds.z1 | 9.01 | 13.131 | 4.121 | 0.1 | m |
| T2-ROOM-U-3 — room 3 Garderoba (south-west) | bounds.x1 | 3.34 | 7.39 | 4.05 | 0.1 | m |
| T2-ROOM-G-9 — room 9 Garaż | polygonAreaM2 | 24.42 | 20.558 | -3.863 | 0.5 | m2 |
| T2-ROOM-U-8 — room 8 Garderoba (north-east) | bounds.z0 | 8.56 | 4.881 | -3.679 | 0.1 | m |

## Worst deltas in metres (positions and heights only; areas excluded)

| truth item | property | truth | auto | Δ m | tol m |
|---|---|---:|---:|---:|---:|
| T2-ROOM-G-STAIR — room stair Schody (shaft, no number on the ground table) | bounds.z1 | 7.4 | 13.131 | 5.731 | 0.1 |
| T2-ROOM-G-4 — room 4 Salon + Jadalnia | bounds.z0 | 8.69 | 3.631 | -5.059 | 0.1 |
| T2-ROOM-U-7 — room 7 Pokój (north-east) | bounds.z0 | 9.9 | 4.881 | -5.019 | 0.1 |
| T2-ROOM-G-STAIR — room stair Schody (shaft, no number on the ground table) | bounds.x0 | 5.36 | 0.49 | -4.87 | 0.1 |
| T2-ROOM-U-9 — room 9 Schody | bounds.z1 | 8.44 | 13.131 | 4.691 | 0.1 |
| T2-ROOM-G-2 — room 2 Hol | bounds.z1 | 9.01 | 13.131 | 4.121 | 0.1 |
| T2-ROOM-G-3 — room 3 Kuchnia | bounds.z1 | 9.01 | 13.131 | 4.121 | 0.1 |
| T2-ROOM-U-3 — room 3 Garderoba (south-west) | bounds.x1 | 3.34 | 7.39 | 4.05 | 0.1 |
| T2-ROOM-U-8 — room 8 Garderoba (north-east) | bounds.z0 | 8.56 | 4.881 | -3.679 | 0.1 |
| T2-ROOM-U-1 — room 1 Korytarz | bounds.z1 | 9.78 | 13.131 | 3.351 | 0.1 |
| T2-ROOM-U-8 — room 8 Garderoba (north-east) | bounds.z1 | 9.78 | 13.131 | 3.351 | 0.1 |
| T2-ROOM-G-3 — room 3 Kuchnia | bounds.x1 | 4.08 | 7.39 | 3.31 | 0.1 |
| T2-ROOM-G-2 — room 2 Hol | bounds.x0 | 3.47 | 0.49 | -2.98 | 0.1 |
| T2-ROOM-U-2 — room 2 Pokój (south) | bounds.x0 | 3.46 | 0.49 | -2.97 | 0.1 |
| T2-ROOM-G-3 — room 3 Kuchnia | bounds.z0 | 6.36 | 3.631 | -2.729 | 0.1 |
| T2-ROOM-G-2 — room 2 Hol | bounds.x1 | 5.36 | 7.39 | 2.03 | 0.1 |
| T2-ROOM-U-1 — room 1 Korytarz | bounds.x1 | 5.36 | 7.39 | 2.03 | 0.1 |
| T2-IWALL-U-ROOM2_WEST — south room west wall (garderoba 3 / pokój 2) | span[0] | 1.45 | 2.913 | 1.463 | 0.1 |
| T2-ROOM-U-9 — room 9 Schody | bounds.x0 | 5.36 | 3.99 | -1.37 | 0.1 |
| T2-ROOM-U-8 — room 8 Garderoba (north-east) | bounds.x0 | 5.29 | 3.99 | -1.3 | 0.1 |

## FRAME

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-FRAME-001** coordinate frame of this truth set → **MATCH** | main (L2) | frontOuterPlaneZ — min mouthAt of the FRONT recesses | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | mainFrontWallOuterFaceZ — masses[MAIN].z0 | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | mainRearWallOuterFaceZ — masses[MAIN].z1 | 13.6 | 13.601 | 0.001 | 0.1 | WITHIN |
|  |  | rearOuterPlaneZ — max mouthAt of the REAR recesses | 14.6 | 14.601 | 0.001 | 0.1 | WITHIN |
|  |  | westOuterFaceX — min x0 over masses | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | groundFinishedFloorY — levels[0].elevation | 0 | 0 | 0 | 0.05 | WITHIN |


- T2-FRAME-001: the building is in the truth frame: x east of the west outer face, y above the ground floor, z north of the front outer plane (no conversion applied)

## REGISTRATION

- **T2-REG-GP** metric registration of gp → not evaluated: pixel→metre map, not a feature
- **T2-REG-AP** metric registration of ap → not evaluated: pixel→metre map, not a feature
- **T2-REG-SEC** metric registration of sec → not evaluated: pixel→metre map, not a feature
- **T2-REG-FRONT** metric registration of front → not evaluated: pixel→metre map, not a feature; the auto registered this asset as FRONT at 0.017 m/px
- **T2-REG-REAR** metric registration of rear → not evaluated: pixel→metre map, not a feature; the auto registered this asset as REAR at 0.017 m/px
- **T2-REG-EAST** metric registration of east → not evaluated: pixel→metre map, not a feature; the auto registered this asset as RIGHT at 0.017 m/px
- **T2-REG-WEST** metric registration of west → not evaluated: pixel→metre map, not a feature; the auto registered this asset as LEFT at 0.017 m/px
- **T2-REG-SITE** metric registration of site → not evaluated: pixel→metre map, not a feature

## PAGE_FACT

- **T2-PAGE-HOUSE_NET_AREA** published house_net_area → not evaluated: published aggregate 129.04 m2: a page fact, no geometry to compare
- **T2-PAGE-USABLE_AREA_WITHOUT_STAIRS** published usable_area_without_stairs → not evaluated: published aggregate 153.31 m2: a page fact, no geometry to compare
- **T2-PAGE-GARAGE_AREA** published garage_area → not evaluated: published aggregate 24.1 m2: a page fact, no geometry to compare
- **T2-PAGE-BOILER_ROOM_AREA** published boiler_room_area → not evaluated: published aggregate 5.8 m2: a page fact, no geometry to compare
- **T2-PAGE-FOOTPRINT_AREA** published footprint_area → not evaluated: published aggregate 131.16 m2: a page fact, no geometry to compare
- **T2-PAGE-FLOOR_AREA** published floor_area → not evaluated: published aggregate 170.62 m2: a page fact, no geometry to compare
- **T2-PAGE-TOTAL_AREA** published total_area → not evaluated: published aggregate 231.11 m2: a page fact, no geometry to compare
- **T2-PAGE-ROOF_AREA** published roof_area → not evaluated: published aggregate 150.57 m2: a page fact, no geometry to compare
- **T2-PAGE-VOLUME** published volume → not evaluated: published aggregate 779.94 m3: a page fact, no geometry to compare
- **T2-PAGE-BUILDING_HEIGHT** published building_height → not evaluated: published aggregate 8.27 m: a page fact, no geometry to compare

## PAGE_SPEC

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-PAGE-ROOF** published roof specification → **MATCH** | main-roof (L2) | kind | GABLE | GABLE | — | — | WITHIN |
|  |  | pitchDeg | 40 | 40 | 0 | 0.5 | WITHIN |
| **T2-PAGE-KNEEWALL** published knee wall → **PARTIAL** | lvl-1 (L2) | m — levels[1].wallTop − levels[1].elevation (the auto has no separate knee-wall top; wallTop is the eave datum) | 1.3 | 1.61 | 0.31 | 0.05 | OUTSIDE |
| **T2-PAGE-EAVES** published "no eaves" → **MATCH** | main-roof (L2) | sideEavesOverhang — derived: mainRoof.footprint beyond masses[MAIN] on x | NONE | NONE | — | — | WITHIN |


- T2-PAGE-ROOF: page names FAKRO rooflights; auto has 3

## PAGE_ROOM_TABLE

- **T2-PAGE-ROOMS** published room table → not evaluated: page table, not a feature; the auto labelled 2 of its 12 rooms (main-room-0-3=3 Kuchnia, main-room-1-3=5 Pralnia)

## LEVEL

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-LEVEL-GROUND_FFL** ground finished floor +-0,00 → **MATCH** | lvl-0 (L2) | y — levels[0].elevation | 0 | 0 | 0 | 0.05 | WITHIN |
| **T2-LEVEL-UPPER_FFL** attic finished floor +3,06 → **MATCH** | lvl-1 (L2) | y — levels[1].elevation | 3.06 | 3.06 | 0 | 0.05 | WITHIN |
| **T2-LEVEL-EAVE_DATUM** eave datum +4,67 → **MATCH** | lvl-1 (L2) | y — levels[1].wallTop (the auto eave datum) | 4.67 | 4.67 | 0 | 0.05 | WITHIN |
|  |  | roofEavePlaneY — mainRoof.eaveY, the plane derived from 40°, 7.90 and 7.95 | 4.67 | 4.636 | -0.034 | 0.05 | WITHIN |
| **T2-LEVEL-RIDGE** ridge +7,95 → **MATCH** | main-roof (L2) | y — mainRoof.ridgeY | 7.95 | 7.95 | 0 | 0.05 | WITHIN |
| **T2-LEVEL-TERRAIN** terrain -0,32 → **MISSING** | — | y — BuildingV2.terrainY is absent from the building | -0.32 | — | — | 0.05 | MISSING |
| **T2-LEVEL-KNEEWALL_TOP** attic masonry top (knee wall 130 above +3,06) → **PARTIAL** | lvl-1 (L2) | y — levels[1].wallTop: BuildingV2 has no masonry-top field, and wallTop (4.67) is the eave datum rather than the knee wall top | 4.36 | 4.67 | 0.31 | 0.05 | OUTSIDE |
| **T2-LEVEL-GROUND_CLEAR** ground storey clear height 272 → **MATCH** | lvl-0 (L2) | m — levels[0].height − slabThicknessM | 2.72 | 2.72 | 0 | 0.05 | WITHIN |
| **T2-LEVEL-ATTIC_CLEAR** attic clear height 266 under a flat ceiling → **PARTIAL** | lvl-1 (L2) | m — no attic ceiling in BuildingV2 (a ceiling / partition-cap field would carry it); the model's 8 attic partitions FOLLOW_ROOF (8) | 2.66 | — | — | 0.05 | MISSING |
|  |  | ceilingUndersideY — no ceiling feature in BuildingV2 | 5.72 | — | — | 0.05 | MISSING |
|  |  | ceilingTopY — no ceiling feature in BuildingV2 | 6.1 | — | — | 0.05 | MISSING |
|  |  | ceilingSpanX[0] — no ceiling feature in BuildingV2 | 2.45 | — | — | 0.1 | MISSING |
|  |  | ceilingSpanX[1] — no ceiling feature in BuildingV2 | 5.43 | — | — | 0.1 | MISSING |
| **T2-LEVEL-GARAGE_CLEAR** garage clear height 252 → **MATCH** | roof-attached-0 (L2) | m — attachedRoofs[0].reading.clearHeightM | 2.52 | 2.532 | 0.012 | 0.05 | WITHIN |
|  |  | roofSlabTopY — attachedRoofs[0].slabTopY | 2.88 | 2.89 | 0.01 | 0.05 | WITHIN |
|  |  | roofSlabSoffitY — attachedRoofs[0].slabSoffitY | 2.53 | 2.532 | 0.002 | 0.05 | WITHIN |


## MASS

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-MASS-MAIN** main body walled envelope → **MATCH** | main (L2) | x[0] | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | x[1] | 7.9 | 7.9 | 0 | 0.1 | WITHIN |
|  |  | z[0] | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | z[1] | 13.6 | 13.601 | 0.001 | 0.1 | WITHIN |
|  |  | widthM — x1 − x0 | 7.9 | 7.9 | 0 | 0.1 | WITHIN |
|  |  | depthM — z1 − z0 | 12.6 | 12.61 | 0.01 | 0.1 | WITHIN |
|  |  | storeys | [0, 1] | [0, 1] | — | — | WITHIN |
|  |  | wallThicknessM — BuildingV2.wallThicknessM (one value for every external wall) | 0.45 | 0.49 | 0.04 | 0.1 | WITHIN |
| **T2-MASS-GARAGE** garage walled envelope → **PARTIAL** | attached-0 (L2) | x[0] | 7.9 | 7.9 | 0 | 0.1 | WITHIN |
|  |  | x[1] | 12.05 | 12.05 | 0 | 0.1 | WITHIN |
|  |  | z[0] | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | z[1] | 8.5 | 8.501 | 0.001 | 0.1 | WITHIN |
|  |  | widthM — x1 − x0 | 4.15 | 4.15 | 0 | 0.1 | WITHIN |
|  |  | depthM — z1 − z0 | 7.5 | 7.51 | 0.01 | 0.1 | WITHIN |
|  |  | storeys | [0] | [0] | — | — | WITHIN |
|  |  | sharedWallX — the attached mass x0 (the shared wall line) | 7.9 | 7.9 | 0 | 0.1 | WITHIN |
|  |  | sharedWallThicknessM — BuildingV2 carries one wallThicknessM for all walls; no per-wall (shared wall) thickness | 0.39 | — | — | 0.1 | MISSING |
| **T2-MASS-ENVELOPE** characteristic outer envelope → **MATCH** | main (L2) | x[0] — derived: min/max over masses | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | x[1] — derived: min/max over masses | 12.05 | 12.05 | 0 | 0.1 | WITHIN |
|  |  | z[0] — derived: masses ∪ recess mouths ∪ mainRoof.footprint | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | z[1] — derived: masses ∪ recess mouths ∪ mainRoof.footprint | 14.6 | 14.601 | 0.001 | 0.1 | WITHIN |
|  |  | widthM | 12.05 | 12.05 | 0 | 0.1 | WITHIN |
|  |  | depthM | 14.6 | 14.601 | 0.001 | 0.1 | WITHIN |
| **T2-MASS-STOREY_COVERAGE** storey coverage → **MATCH** | main (L2) | storey0.massCount — truth ["main","garage"] vs auto ["main","attached-0"] | 2 | 2 | 0 | — | WITHIN |
|  |  | storey1.massCount — truth ["main"] vs auto ["main"] | 1 | 1 | 0 | — | WITHIN |
| **T2-MASS-FOOTPRINT_AREA** walled footprint area → **MATCH** | main (L2) | walledM2 — Σ (x1−x0)(z1−z0) over the masses on storey 0 | 130.665 | 130.786 | 0.121 | 0.5 | WITHIN |


- T2-MASS-ENVELOPE: derived envelope, no single feature: masses + recess mouths + main roof footprint
- T2-MASS-FOOTPRINT_AREA: published 131.16 m² is a page fact, not compared

## RECESS

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-RECESS-FRONT-GROUND** front recess (portal) at ground level → **MATCH** | recess-front-0 (L2) | mouthZ | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | backZ | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | depthM | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | x[0] — the recess open interval (union of rec.open) | 0.61 | 0.661 | 0.051 | 0.1 | WITHIN |
|  |  | x[1] — the recess open interval (union of rec.open) | 11.42 | 11.416 | -0.004 | 0.1 | WITHIN |
|  |  | returnCount — auto returns at 0..0.661, 11.416..12.05 | 2 | 2 | 0 | — | WITHIN |
|  |  | returns.west[0] | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | returns.west[1] | 0.61 | 0.661 | 0.051 | 0.1 | WITHIN |
|  |  | returns.west.thicknessM — ReturnWall.thicknessM | 0.61 | 0.661 | 0.051 | 0.1 | WITHIN |
|  |  | returns.east — truth: no return at the main body's east edge (x 7.1..7.9) | none | none | — | — | WITHIN |
|  |  | returns.garageEast[0] | 11.42 | 11.416 | -0.004 | 0.1 | WITHIN |
|  |  | returns.garageEast[1] | 12.05 | 12.05 | 0 | 0.1 | WITHIN |
|  |  | returns.garageEast.thicknessM — ReturnWall.thicknessM | 0.63 | 0.634 | 0.004 | 0.1 | WITHIN |
| **T2-RECESS-FRONT-ATTIC** front recess (balcony) at attic level → **MATCH** | recess-front-1 (L2) | mouthZ | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | backZ | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | depthM | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | x[0] — the recess open interval (union of rec.open) | 0.61 | 0.656 | 0.046 | 0.1 | WITHIN |
|  |  | x[1] — the recess open interval (union of rec.open) | 7.26 | 7.218 | -0.042 | 0.1 | WITHIN |
|  |  | returnCount — auto returns at 0.026..0.656, 7.218..7.874 | 2 | 2 | 0 | — | WITHIN |
|  |  | returns.west[0] | 0 | 0.026 | 0.026 | 0.1 | WITHIN |
|  |  | returns.west[1] | 0.61 | 0.656 | 0.046 | 0.1 | WITHIN |
|  |  | returns.west.thicknessM — ReturnWall.thicknessM | 0.61 | 0.63 | 0.02 | 0.1 | WITHIN |
|  |  | returns.east[0] | 7.26 | 7.218 | -0.042 | 0.1 | WITHIN |
|  |  | returns.east[1] | 7.9 | 7.874 | -0.026 | 0.1 | WITHIN |
|  |  | returns.east.thicknessM — ReturnWall.thicknessM | 0.64 | 0.656 | 0.016 | 0.1 | WITHIN |
|  |  | eastReturnBaseY — derived: levels[storey].elevation — ReturnWallV2 has no base field | 3.06 | 3.06 | 0 | 0.05 | WITHIN |
| **T2-RECESS-REAR** rear recess (loggia) both storeys → **MATCH** | recess-rear-0 (L2) | storey0.mouthZ | 14.6 | 14.601 | 0.001 | 0.1 | WITHIN |
|  |  | storey0.backZ | 13.6 | 13.601 | 0.001 | 0.1 | WITHIN |
|  |  | storey0.depthM | 1 | 1 | 0 | 0.1 | WITHIN |
|  |  | storey0.x[0] — the recess open interval (union of rec.open) | 0.61 | 0.661 | 0.051 | 0.1 | WITHIN |
|  |  | storey0.x[1] — the recess open interval (union of rec.open) | 7.29 | 7.267 | -0.023 | 0.1 | WITHIN |
|  |  | storey0.returnCount — auto returns at 0..0.661, 7.267..7.901 | 2 | 2 | 0 | — | WITHIN |
|  |  | storey0.returns.west[0] | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | storey0.returns.west[1] | 0.61 | 0.661 | 0.051 | 0.1 | WITHIN |
|  |  | storey0.returns.west.thicknessM — ReturnWall.thicknessM | 0.61 | 0.661 | 0.051 | 0.1 | WITHIN |
|  |  | storey0.returns.east[0] | 7.29 | 7.267 | -0.023 | 0.1 | WITHIN |
|  |  | storey0.returns.east[1] | 7.9 | 7.901 | 0.001 | 0.1 | WITHIN |
|  |  | storey0.returns.east.thicknessM — ReturnWall.thicknessM | 0.61 | 0.634 | 0.024 | 0.1 | WITHIN |
|  |  | storey1.mouthZ | 14.6 | 14.601 | 0.001 | 0.1 | WITHIN |
|  |  | storey1.backZ | 13.6 | 13.601 | 0.001 | 0.1 | WITHIN |
|  |  | storey1.depthM | 1 | 1 | 0 | 0.1 | WITHIN |
|  |  | storey1.x[0] — the recess open interval (union of rec.open) | 0.61 | 0.656 | 0.046 | 0.1 | WITHIN |
|  |  | storey1.x[1] — the recess open interval (union of rec.open) | 7.29 | 7.218 | -0.072 | 0.1 | WITHIN |
|  |  | storey1.returnCount — auto returns at 0.026..0.656, 7.218..7.874 | 2 | 2 | 0 | — | WITHIN |
|  |  | storey1.returns.west[0] | 0 | 0.026 | 0.026 | 0.1 | WITHIN |
|  |  | storey1.returns.west[1] | 0.61 | 0.656 | 0.046 | 0.1 | WITHIN |
|  |  | storey1.returns.west.thicknessM — ReturnWall.thicknessM | 0.61 | 0.63 | 0.02 | 0.1 | WITHIN |
|  |  | storey1.returns.east[0] | 7.29 | 7.218 | -0.072 | 0.1 | WITHIN |
|  |  | storey1.returns.east[1] | 7.9 | 7.874 | -0.026 | 0.1 | WITHIN |
|  |  | storey1.returns.east.thicknessM — ReturnWall.thicknessM | 0.61 | 0.656 | 0.046 | 0.1 | WITHIN |


## RETURN

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-RETURN-THICKNESS** return wall thickness → **MATCH** | return-front-0-0 (L1) | thicknessM[return-front-0-0] | 0.61 | 0.645 | 0.035 | 0.1 | WITHIN |
|  |  | thicknessM[return-front-0-1] | 0.61 | 0.634 | 0.024 | 0.1 | WITHIN |
|  |  | thicknessM[return-front-1-0] | 0.61 | 0.645 | 0.035 | 0.1 | WITHIN |
|  |  | thicknessM[return-front-1-1] | 0.61 | 0.656 | 0.046 | 0.1 | WITHIN |
|  |  | thicknessM[return-rear-0-0] | 0.61 | 0.645 | 0.035 | 0.1 | WITHIN |
|  |  | thicknessM[return-rear-0-1] | 0.61 | 0.645 | 0.035 | 0.1 | WITHIN |
|  |  | thicknessM[return-rear-1-0] | 0.61 | 0.645 | 0.035 | 0.1 | WITHIN |
|  |  | thicknessM[return-rear-1-1] | 0.61 | 0.645 | 0.035 | 0.1 | WITHIN |
| **T2-RETURN-HEIGHT** return walls die into the roof soffit → **PARTIAL** | return-front-0-0 (L1) | topY — ReturnWallV2 has no top/height field (the emitter runs the return up to the roof); mainRoof.eaveY is the roof plane at the outer plane | the roof underside at the outer plane (4.61..4.76 measured; 4.64 derived) | — | — | — | MISSING |
|  |  | roofUndersideAtOuterPlaneY (derived) — truth "4.64 derived" vs mainRoof.eaveY | 4.64 | 4.636 | -0.004 | 0.1 | WITHIN |


- T2-RETURN-THICKNESS: 8 return walls in the building

## ROOF

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-ROOF-MAIN** main gable roof → **MATCH** | main-roof (L2) | kind | GABLE | GABLE | — | — | WITHIN |
|  |  | pitchDeg | 40 | 40 | 0 | 0.5 | WITHIN |
|  |  | ridgeAxis | Z | Z | — | — | WITHIN |
|  |  | ridgeX — mainRoof.ridgeAt | 3.95 | 3.95 | 0 | 0.1 | WITHIN |
|  |  | eaveY — the truth keeps both the printed 4.67 and the derived 4.636 | 4.67 | 4.636 | -0.034 | 0.05 | WITHIN |
|  |  | ridgeY | 7.95 | 7.95 | 0 | 0.05 | WITHIN |
|  |  | supportX[0] — mainRoof.footprint x | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | supportX[1] — mainRoof.footprint x | 7.9 | 7.9 | 0 | 0.1 | WITHIN |
|  |  | sideEavesOverhangM — derived: footprint beyond the main mass on x | 0 | 0 | 0 | 0.1 | WITHIN |
| **T2-ROOF-EXTENT** main roof spans the full 14.60 m (over both recesses) → **MATCH** | main-roof (L2) | z[0] — mainRoof.footprint z | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | z[1] — mainRoof.footprint z | 14.6 | 14.601 | 0.001 | 0.1 | WITHIN |
|  |  | coversZones — both side renders span the characteristic depth at the ridge scale, so the roof reaches the outer planes | true | true | — | — | WITHIN |
|  |  | gableOverhangFrontM — derived: masses[MAIN].z0 − footprint.z0 | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | gableOverhangRearM — derived: footprint.z1 − masses[MAIN].z1 | 1 | 1 | 0 | 0.1 | WITHIN |
| **T2-ROOF-GARAGE** garage flat roof with parapet → **MATCH** | roof-attached-0 (L2) | kind — AttachedRoofV2 has no kind; taken from model.roofs | FLAT | FLAT | — | — | WITHIN |
|  |  | x[0] | 7.9 | 7.9 | 0 | 0.1 | WITHIN |
|  |  | x[1] | 12.05 | 12.05 | 0 | 0.1 | WITHIN |
|  |  | z[0] | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | z[1] | 8.5 | 8.501 | 0.001 | 0.1 | WITHIN |
|  |  | slabTopY | 2.88 | 2.89 | 0.01 | 0.05 | WITHIN |
|  |  | parapetTopY | 3.09 | 3.125 | 0.035 | 0.05 | WITHIN |
|  |  | coversPortalRecess — AttachedRoofV2.projectsOverZone | true | true | — | — | WITHIN |
| **T2-ROOF-BUILDUP** roof build-up between the knee wall top and the eave plane → **PARTIAL** | main-roof (L2) | verticalM — mainRoof.buildUpVerticalM | 0.276 | 0.15 | -0.126 | 0.05 | OUTSIDE |
|  |  | perpendicularM — derived: buildUpVerticalM · cos(pitch) | 0.211 | 0.115 | -0.096 | 0.05 | OUTSIDE |
|  |  | fromPrintedDatumVerticalM — no knee-wall top in BuildingV2 to measure from (levels[1].wallTop is the eave datum itself) | 0.31 | — | — | 0.05 | MISSING |


## ROOF_MEMBER

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-ROOF-VERGE-MEMBER** white verge band along both rakes (gable-edge member) → **MATCH** | verge-front (L1) | perpendicularWidthM — verges[FRONT].member.widthM | 0.64 | 0.607 | -0.033 | 0.06 | WITHIN |
|  |  | verticalExtentM — derived: member.widthM / cos(pitch); member.y spans the whole rake, not the band | 0.83 | 0.792 | -0.038 | 0.06 | WITHIN |
|  |  | plane.front — verges[FRONT].planeAt | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | plane.rear — verges[REAR].planeAt | 14.6 | 14.601 | 0.001 | 0.1 | WITHIN |
|  |  | continuousWithReturns — assemblies[GABLE_FRAME].continuityRelations CONTINUES_AS → verge | true | true | — | — | WITHIN |


- T2-ROOF-VERGE-MEMBER: auto verge depthM 0.991 (the truth leaves the depth unresolved)

## SHADOW

- **T2-ROOF-SHADOW-BAND** shadow band under the verge on the recessed timber wall → not evaluated: shading, not geometry; the auto has no feature for it, which is correct

## CHIMNEY

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-CHIMNEY-1** chimney 1 (fireplace flue, east slope, rear half) → **PARTIAL** | chimney-0 (L2) | x[0] | 5.46 | 5.433 | -0.027 | 0.1 | WITHIN |
|  |  | x[1] | 6.07 | 6.063 | -0.007 | 0.1 | WITHIN |
|  |  | z[0] | 8.62 | 8.441 | -0.179 | 0.1 | OUTSIDE |
|  |  | z[1] | 9.05 | 9.179 | 0.129 | 0.1 | OUTSIDE |
|  |  | topY | 7.86 | 7.862 | 0.002 | 0.06 | WITHIN |
|  |  | slope — derived: plan centre against mainRoof.ridgeAt | EAST | EAST | — | — | WITHIN |
| **T2-CHIMNEY-2** chimney 2 (boiler flue, east slope, front half) → **PARTIAL** | chimney-1 (L2) | x[0] | 5.42 | 5.433 | 0.013 | 0.1 | WITHIN |
|  |  | x[1] | 5.99 | 5.984 | -0.006 | 0.1 | WITHIN |
|  |  | z[0] | 4.15 | 4.177 | 0.027 | 0.1 | WITHIN |
|  |  | z[1] | 4.7 | 4.835 | 0.135 | 0.1 | OUTSIDE |
|  |  | topY | 7.86 | 7.861 | 0.001 | 0.06 | WITHIN |
|  |  | slope — derived: plan centre against mainRoof.ridgeAt | EAST | EAST | — | — | WITHIN |


## ROOFLIGHT

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-ROOFLIGHT-W1** rooflight, west slope, over the laundry → **PARTIAL** | rooflight-left-1 (L1) | slope — derived from the registration side of rooflight.frameId (LEFT→WEST, RIGHT→EAST) | WEST | WEST | — | — | WITHIN |
|  |  | widthAlongRidgeM — rooflight.widthM | 0.78 | 0.629 | -0.151 | 0.08 | OUTSIDE |
|  |  | lengthAlongSlopeM — rooflight.lengthM | 1.18 | 1.03 | -0.15 | 0.08 | OUTSIDE |
|  |  | zCentre — mid(alongFrom, alongTo) | 7.63 | 7.499 | -0.131 | 0.1 | OUTSIDE |
|  |  | slopeFromEave[0] — horizontal distance from the WEST eave; truth [0.44, 1.2], auto slopeFrom/slopeTo [0.458, 1.247] | 0.44 | 0.458 | 0.018 | 0.1 | WITHIN |
|  |  | slopeFromEave[1] — horizontal distance from the WEST eave; truth [0.44, 1.2], auto slopeFrom/slopeTo [0.458, 1.247] | 1.2 | 1.247 | 0.047 | 0.1 | WITHIN |
|  |  | yBottom — rooflight.yFrom | 5.04 | 5.02 | -0.02 | 0.08 | WITHIN |
| **T2-ROOFLIGHT-W2** rooflight, west slope, over the bathroom → **PARTIAL** | rooflight-left-0 (L1) | slope — derived from the registration side of rooflight.frameId (LEFT→WEST, RIGHT→EAST) | WEST | WEST | — | — | WITHIN |
|  |  | widthAlongRidgeM — rooflight.widthM | 0.78 | 0.613 | -0.167 | 0.1 | OUTSIDE |
|  |  | lengthAlongSlopeM — rooflight.lengthM | 1.18 | 1.004 | -0.176 | 0.1 | OUTSIDE |
|  |  | zCentre — mid(alongFrom, alongTo) | 5.43 | 5.322 | -0.108 | 0.1 | OUTSIDE |
|  |  | slopeFromEave[0] — horizontal distance from the WEST eave; truth [0.44, 1.2], auto slopeFrom/slopeTo [0.478, 1.247] | 0.44 | 0.478 | 0.038 | 0.1 | WITHIN |
|  |  | slopeFromEave[1] — horizontal distance from the WEST eave; truth [0.44, 1.2], auto slopeFrom/slopeTo [0.478, 1.247] | 1.2 | 1.247 | 0.047 | 0.1 | WITHIN |
|  |  | yBottom — rooflight.yFrom | 5.04 | 5.036 | -0.004 | 0.1 | WITHIN |
| **T2-ROOFLIGHT-E1** rooflight, east slope, over the stair/corridor → **PARTIAL** | rooflight-right-0 (L1) | slope — derived from the registration side of rooflight.frameId (LEFT→WEST, RIGHT→EAST) | EAST | EAST | — | — | WITHIN |
|  |  | widthAlongRidgeM — rooflight.widthM | 0.78 | 0.621 | -0.159 | 0.1 | OUTSIDE |
|  |  | lengthAlongSlopeM — rooflight.lengthM | 1.18 | 1.018 | -0.162 | 0.1 | OUTSIDE |
|  |  | zCentre — mid(alongFrom, alongTo) | 5.44 | 5.48 | 0.04 | 0.1 | WITHIN |
|  |  | slopeFromEave[0] — horizontal distance from the EAST eave; truth [6.7, 7.46], auto slopeFrom/slopeTo [7.47, 6.69] | 0.44 | 0.43 | -0.01 | 0.1 | WITHIN |
|  |  | slopeFromEave[1] — horizontal distance from the EAST eave; truth [6.7, 7.46], auto slopeFrom/slopeTo [7.47, 6.69] | 1.2 | 1.21 | 0.01 | 0.1 | WITHIN |
|  |  | yBottom — rooflight.yFrom | 5.04 | 4.996 | -0.044 | 0.1 | WITHIN |


- T2-ROOFLIGHT-W1: feature graph marks unresolved: exact position up the slope
- T2-ROOFLIGHT-W2: feature graph marks unresolved: exact position up the slope
- T2-ROOFLIGHT-E1: feature graph marks unresolved: exact position up the slope

## OPENING

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-OPEN-FRONT-ROOM** front room window 110/230 → **MATCH** | opening-0-front-0-0 (L2) | facade | FRONT | FRONT | — | — | WITHIN |
|  |  | storey | 0 | 0 | 0 | — | WITHIN |
|  |  | interval[0] | 1.4 | 1.406 | 0.006 | 0.1 | WITHIN |
|  |  | interval[1] | 2.5 | 2.506 | 0.006 | 0.1 | WITHIN |
|  |  | widthM | 1.1 | 1.1 | 0 | 0.1 | WITHIN |
|  |  | sillY | 0 | 0.035 | 0.035 | 0.05 | WITHIN |
|  |  | headY | 2.3 | 2.335 | 0.035 | 0.05 | WITHIN |
|  |  | profile | RECTANGULAR | RECTANGULAR | — | — | WITHIN |
|  |  | family | WINDOW | WINDOW | — | — | WITHIN |
| **T2-OPEN-FRONT-ENTRANCE** entrance door 105/210 → **PARTIAL** | opening-0-front-0-1 (L2) | facade | FRONT | FRONT | — | — | WITHIN |
|  |  | storey | 0 | 0 | 0 | — | WITHIN |
|  |  | interval[0] | 4.18 | 4.179 | -0.001 | 0.1 | WITHIN |
|  |  | interval[1] | 5.23 | 5.229 | -0.001 | 0.1 | WITHIN |
|  |  | widthM | 1.05 | 1.05 | 0 | 0.1 | WITHIN |
|  |  | sillY | 0 | 0 | 0 | 0.05 | WITHIN |
|  |  | headY | 2.1 | 2.1 | 0 | 0.05 | WITHIN |
|  |  | profile | RECTANGULAR | RECTANGULAR | — | — | WITHIN |
|  |  | family | DOOR | WINDOW | — | — | OUTSIDE |
| **T2-OPEN-GARAGE-DOOR** garage door 275/225 → **PARTIAL** | opening-0-front-8-0 (L2) | facade | FRONT | FRONT | — | — | WITHIN |
|  |  | storey | 0 | 0 | 0 | — | WITHIN |
|  |  | interval[0] | 8.55 | 8.548 | -0.002 | 0.1 | WITHIN |
|  |  | interval[1] | 11.3 | 11.298 | -0.002 | 0.1 | WITHIN |
|  |  | widthM | 2.75 | 2.75 | 0 | 0.1 | WITHIN |
|  |  | sillY | 0 | 0 | 0 | 0.05 | WITHIN |
|  |  | headY | 2.25 | 2.75 | 0.5 | 0.05 | OUTSIDE |
|  |  | profile | RECTANGULAR | RECTANGULAR | — | — | WITHIN |
|  |  | family | GARAGE_DOOR | GARAGE_DOOR | — | — | WITHIN |
| **T2-OPEN-FRONT-GABLE** front gable glazing 270/320 → **PARTIAL** | opening-1-front-4-0 (L2) | facade | FRONT | FRONT | — | — | WITHIN |
|  |  | storey | 1 | 1 | 0 | — | WITHIN |
|  |  | interval[0] | 3.95 | 3.925 | -0.025 | 0.1 | WITHIN |
|  |  | interval[1] | 6.65 | 6.625 | -0.025 | 0.1 | WITHIN |
|  |  | widthM | 2.7 | 2.7 | 0 | 0.1 | WITHIN |
|  |  | sillY | 3.06 | 3.06 | 0 | 0.05 | WITHIN |
|  |  | headY | 6.26 | 6.26 | 0 | 0.05 | WITHIN |
|  |  | headFarY | 4.02 | 3.994 | -0.026 | 0.05 | WITHIN |
|  |  | profile | RAKED_SINGLE | RAKED_SINGLE | — | — | WITHIN |
|  |  | family | GLAZED_DOOR | MULTI_PANEL_GLAZING | — | — | OUTSIDE |
| **T2-OPEN-REAR-GLAZING** rear living glazing 470/230 → **MATCH** | opening-0-rear-2-0 (L2) | facade | REAR | REAR | — | — | WITHIN |
|  |  | storey | 0 | 0 | 0 | — | WITHIN |
|  |  | interval[0] | 2.25 | 2.261 | 0.011 | 0.1 | WITHIN |
|  |  | interval[1] | 6.95 | 6.961 | 0.011 | 0.1 | WITHIN |
|  |  | widthM | 4.7 | 4.7 | 0 | 0.1 | WITHIN |
|  |  | sillY | 0 | 0 | 0 | 0.05 | WITHIN |
|  |  | headY | 2.3 | 2.3 | 0 | 0.05 | WITHIN |
|  |  | profile | RECTANGULAR | RECTANGULAR | — | — | WITHIN |
|  |  | family | MULTI_PANEL_GLAZING | MULTI_PANEL_GLAZING | — | — | WITHIN |
| **T2-OPEN-REAR-GABLE-W** rear gable window west 234/303 → **PARTIAL** | opening-1-rear-6-0 (L2) | facade | REAR | REAR | — | — | WITHIN |
|  |  | storey | 1 | 1 | 0 | — | WITHIN |
|  |  | interval[0] | 0.95 | 0.956 | 0.006 | 0.1 | WITHIN |
|  |  | interval[1] | 3.29 | 3.296 | 0.006 | 0.1 | WITHIN |
|  |  | widthM | 2.34 | 2.34 | 0 | 0.1 | WITHIN |
|  |  | sillY | 3.06 | 3.06 | 0 | 0.05 | WITHIN |
|  |  | headY | 6.09 | 6.1 | 0.01 | 0.05 | WITHIN |
|  |  | headFarY | 4.13 | 4.137 | 0.007 | 0.05 | WITHIN |
|  |  | profile | RAKED_SINGLE | RAKED_SINGLE | — | — | WITHIN |
|  |  | family | WINDOW | MULTI_PANEL_GLAZING | — | — | OUTSIDE |
| **T2-OPEN-REAR-GABLE-E** rear gable window east 234/303 → **PARTIAL** | opening-1-rear-6-1 (L2) | facade | REAR | REAR | — | — | WITHIN |
|  |  | storey | 1 | 1 | 0 | — | WITHIN |
|  |  | interval[0] | 4.61 | 4.578 | -0.032 | 0.1 | WITHIN |
|  |  | interval[1] | 6.95 | 6.918 | -0.032 | 0.1 | WITHIN |
|  |  | widthM | 2.34 | 2.34 | 0 | 0.1 | WITHIN |
|  |  | sillY | 3.06 | 3.06 | 0 | 0.05 | WITHIN |
|  |  | headY | 6.09 | 6.09 | 0 | 0.05 | WITHIN |
|  |  | headFarY | 4.13 | 4.127 | -0.003 | 0.05 | WITHIN |
|  |  | profile | RAKED_SINGLE | RAKED_SINGLE | — | — | WITHIN |
|  |  | family | WINDOW | MULTI_PANEL_GLAZING | — | — | OUTSIDE |
| **T2-OPEN-WEST-LIVING** west living window 90/230 → **PARTIAL** | opening-0-west-3-0 (L2) | facade | WEST | WEST | — | — | WITHIN |
|  |  | storey | 0 | 0 | 0 | — | WITHIN |
|  |  | interval[0] | 9.07 | 9.022 | -0.048 | 0.1 | WITHIN |
|  |  | interval[1] | 9.97 | 9.922 | -0.048 | 0.1 | WITHIN |
|  |  | widthM | 0.9 | 0.9 | 0 | 0.1 | WITHIN |
|  |  | sillY | 0 | 0 | 0 | 0.05 | WITHIN |
|  |  | headY | 2.3 | 2.3 | 0 | 0.05 | WITHIN |
|  |  | profile | RECTANGULAR | RECTANGULAR | — | — | WITHIN |
|  |  | family | WINDOW | DOOR | — | — | OUTSIDE |
| **T2-OPEN-WEST-KITCHEN** west kitchen window 140/140 → **PARTIAL** | opening-0-west-3-1 (L2) | facade | WEST | WEST | — | — | WITHIN |
|  |  | storey | 0 | 0 | 0 | — | WITHIN |
|  |  | interval[0] | 6.8 | 6.8 | 0 | 0.1 | WITHIN |
|  |  | interval[1] | 8.2 | 8.2 | 0 | 0.1 | WITHIN |
|  |  | widthM | 1.4 | 1.4 | 0 | 0.1 | WITHIN |
|  |  | sillY — auto sill is ASSUMED_FOR_RENDERING (sill height (no elevation reading; a common head is assumed)) | 0.9 | 0.8 | -0.1 | 0.05 | UNRESOLVED_IN_AUTO |
|  |  | headY | 2.3 | 2.2 | -0.1 | 0.05 | OUTSIDE |
|  |  | profile | RECTANGULAR | RECTANGULAR | — | — | WITHIN |
|  |  | family | WINDOW | WINDOW | — | — | WITHIN |
| **T2-OPEN-EAST-LIVING** east living window 300/230 → **MATCH** | opening-0-east-1-0 (L2) | facade | EAST | EAST | — | — | WITHIN |
|  |  | storey | 0 | 0 | 0 | — | WITHIN |
|  |  | interval[0] | 9.7 | 9.693 | -0.007 | 0.1 | WITHIN |
|  |  | interval[1] | 12.7 | 12.693 | -0.007 | 0.1 | WITHIN |
|  |  | widthM | 3 | 3 | 0 | 0.1 | WITHIN |
|  |  | sillY | 0 | 0 | 0 | 0.05 | WITHIN |
|  |  | headY | 2.3 | 2.3 | 0 | 0.05 | WITHIN |
|  |  | profile | RECTANGULAR | RECTANGULAR | — | — | WITHIN |
|  |  | family | MULTI_PANEL_GLAZING | MULTI_PANEL_GLAZING | — | — | WITHIN |
| **T2-OPEN-GARAGE-SIDE** garage side door 100/210 (rear wall of the garage) → **PARTIAL** | opening-0-rear-10-0 (L2) | facade | REAR | REAR | — | — | WITHIN |
|  |  | storey | 0 | 0 | 0 | — | WITHIN |
|  |  | interval[0] | 9.9 | 9.912 | 0.012 | 0.1 | WITHIN |
|  |  | interval[1] | 10.9 | 10.912 | 0.012 | 0.1 | WITHIN |
|  |  | widthM | 1 | 1 | 0 | 0.1 | WITHIN |
|  |  | sillY | 0 | 0 | 0 | 0.06 | WITHIN |
|  |  | headY | 2.1 | 2.1 | 0 | 0.06 | WITHIN |
|  |  | profile | RECTANGULAR | RECTANGULAR | — | — | WITHIN |
|  |  | family | GLAZED_DOOR | WINDOW | — | — | OUTSIDE |
| **T2-OPEN-BOILER-GARAGE** boiler room to garage door (shared wall) → **PARTIAL** | shared-opening-0-east-1-1 (L1) | facade — sharedDoors: EAST wall of main shared with attached-0 | INTERIOR | INTERIOR | — | — | WITHIN |
|  |  | storey | 0 | 0 | 0 | — | WITHIN |
|  |  | interval[0] | 2.24 | 2.22 | -0.02 | 0.1 | WITHIN |
|  |  | interval[1] | 3.06 | 3.12 | 0.06 | 0.1 | WITHIN |
|  |  | widthM | 0.82 | 0.9 | 0.08 | 0.1 | WITHIN |
|  |  | sillY — auto sill is ASSUMED_FOR_RENDERING (sill and head (no callout read and no elevation shows this wall)) | 0 | 0 | 0 | 0.06 | UNRESOLVED_IN_AUTO |
|  |  | headY — auto head is ASSUMED_FOR_RENDERING (sill and head (no callout read and no elevation shows this wall)) | 2.1 | 2.1 | 0 | 0.06 | UNRESOLVED_IN_AUTO |
|  |  | profile | RECTANGULAR | RECTANGULAR | — | — | WITHIN |
|  |  | family | DOOR | DOOR | — | — | WITHIN |


- T2-OPEN-FRONT-ROOM: printed callout 110/230; auto read 110/230 at 0.816 m · view residuals: OPENING_SILL -0.009 m, OPENING_HEAD 0.009 m
- T2-OPEN-FRONT-ENTRANCE: printed callout 105/210; auto read 105/210 at 0.816 m
- T2-OPEN-GARAGE-DOOR: printed callout 275/225; auto read 275/275 at 0.608 m · auto unresolved: the printed height reads 275 or 225 alike, and no elevation shows this wall · feature graph marks unresolved: the printed height reads 275 or 225 alike, and no elevation shows this wall
- T2-OPEN-FRONT-GABLE: printed callout 270/320; auto read 270/320 at 0.772 m · view residuals: OPENING_SILL -1.755 m (OUT), OPENING_HEAD 0.905 m (OUT) · auto unresolved: the elevation reads 0.54 m tall (4.82..5.35) against the printed 3.20; the printed height stands · feature graph marks unresolved: the elevation reads 0.54 m tall (4.82..5.35) against the printed 3.20; the printed height stands
- T2-OPEN-REAR-GLAZING: printed callout 470/230; auto read 470/230 at 0.751 m · view residuals: OPENING_SILL -0.051 m, OPENING_HEAD 0.684 m (OUT) · auto unresolved: the elevation reads 1.57 m tall (0.05..1.62) against the printed 2.30; the printed height stands · feature graph marks unresolved: the elevation reads 1.57 m tall (0.05..1.62) against the printed 2.30; the printed height stands
- T2-OPEN-REAR-GABLE-W: printed callout 234/303; auto read 234/304 at 0.719 m · view residuals: OPENING_SILL -0.885 m (OUT), OPENING_HEAD 0.992 m (OUT) · auto unresolved: the elevation reads 1.16 m tall (3.94..5.11) against the printed 3.04; the printed height stands · feature graph marks unresolved: the elevation reads 1.16 m tall (3.94..5.11) against the printed 3.04; the printed height stands
- T2-OPEN-REAR-GABLE-E: printed callout 234/303; auto read 234/303 at 0.719 m · view residuals: OPENING_SILL -1.293 m (OUT), OPENING_HEAD 0.979 m (OUT) · auto unresolved: the elevation reads 0.76 m tall (4.35..5.11) against the printed 3.03; the printed height stands · feature graph marks unresolved: the elevation reads 0.76 m tall (4.35..5.11) against the printed 3.03; the printed height stands
- T2-OPEN-WEST-LIVING: printed callout 90/230; auto read 90/230 at 0.8 m · auto unresolved: the printed height reads 230 or 290 alike, and no elevation shows this wall · feature graph marks unresolved: the printed height reads 230 or 290 alike, and no elevation shows this wall
- T2-OPEN-WEST-KITCHEN: printed callout 140/140; auto read 140/140 at 0.8 m · auto unresolved: sill height (no elevation reading; a common head is assumed) · feature graph marks unresolved: sill height (no elevation reading; a common head is assumed)
- T2-OPEN-EAST-LIVING: printed callout 300/230; auto read 300/230 at 0.88 m · view residuals: OPENING_SILL 0 m, OPENING_HEAD 0.027 m
- T2-OPEN-GARAGE-SIDE: printed callout 100/210; auto read 100/210 at 0.792 m · view residuals: OPENING_SILL -0.272 m (OUT), OPENING_HEAD 0.839 m (OUT) · auto unresolved: the elevation reads 0.99 m tall (0.27..1.26) against the printed 2.10; the printed height stands · feature graph marks unresolved: the elevation reads 0.99 m tall (0.27..1.26) against the printed 2.10; the printed height stands
- T2-OPEN-BOILER-GARAGE: auto unresolved: sill and head (no callout read and no elevation shows this wall) · feature graph marks unresolved: sill and head (no callout read and no elevation shows this wall)

## INTERIOR_WALL

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-IWALL-G-ROOM_EAST** wall east of the front room (pokój 7) / hall → **PARTIAL** | main-iwall-0-z-2 (L1) | centre — length-weighted mean of piece.at | 3.41 | 3.409 | -0.001 | 0.1 | WITHIN |
|  |  | span[0] | 1.45 | 1.479 | 0.029 | 0.1 | WITHIN |
|  |  | span[1] | 4.7 | 4.867 | 0.167 | 0.1 | OUTSIDE |
|  |  | thicknessM — the primary piece | 0.12 | 0.132 | 0.012 | 0.1 | WITHIN |
|  |  | doors.count — auto doors main-idoor-0-0 3.702..4.576, main-idoor-0-1 4.867..5.714 | 1 | 2 | 1 | — | OUTSIDE |
|  |  | T2-IDOOR-G-ROOM.interval[0] | 3.67 | 3.702 | 0.032 | 0.1 | WITHIN |
|  |  | T2-IDOOR-G-ROOM.interval[1] | 4.6 | 4.576 | -0.024 | 0.1 | WITHIN |
|  |  | T2-IDOOR-G-ROOM.widthM | 0.93 | 0.873 | -0.057 | 0.1 | WITHIN |
| **T2-IWALL-G-BATH_EAST** wall east of the bathroom (6) / hall → **PARTIAL** | main-iwall-0-z-0 (L1) | centre — length-weighted mean of piece.at | 3.41 | 3.409 | -0.001 | 0.1 | WITHIN |
|  |  | span[0] | 4.82 | 4.576 | -0.244 | 0.1 | OUTSIDE |
|  |  | span[1] | 6.3 | 6.349 | 0.049 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.132 | 0.012 | 0.1 | WITHIN |
|  |  | doors.count — auto doors main-idoor-0-1 4.867..5.714 | 1 | 1 | 0 | — | WITHIN |
|  |  | T2-IDOOR-G-BATH.interval[0] | 4.86 | 4.867 | 0.007 | 0.1 | WITHIN |
|  |  | T2-IDOOR-G-BATH.interval[1] | 5.79 | 5.714 | -0.076 | 0.1 | WITHIN |
|  |  | T2-IDOOR-G-BATH.widthM | 0.93 | 0.847 | -0.083 | 0.1 | WITHIN |
| **T2-IWALL-G-BATH_SOUTH** bathroom south wall (bathroom / front room) → **MATCH** | main-iwall-0-x-4 (L1) | centre — length-weighted mean of piece.at | 4.76 | 4.761 | 0.001 | 0.1 | WITHIN |
|  |  | span[0] | 0.45 | 0.502 | 0.052 | 0.1 | WITHIN |
|  |  | span[1] | 3.46 | 3.488 | 0.028 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.132 | 0.012 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-G-KITCHEN_SOUTH** kitchen south wall (kitchen / bathroom) → **PARTIAL** | main-iwall-0-x-3 (L1) | centre — length-weighted mean of piece.at | 6.3 | 6.296 | -0.004 | 0.1 | WITHIN |
|  |  | span[0] | 0.45 | 0.502 | 0.052 | 0.1 | WITHIN |
|  |  | span[1] | 3.49 | 4.122 | 0.632 | 0.1 | OUTSIDE |
|  |  | thicknessM — the primary piece | 0.12 | 0.132 | 0.012 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-G-ENTRY_NORTH** vestibule north wall (wiatrołap / hall) → **MATCH** | main-iwall-0-x-6 (L1) | centre — length-weighted mean of piece.at | 3.53 | 3.534 | 0.004 | 0.1 | WITHIN |
|  |  | span[0] | 3.36 | 3.356 | -0.004 | 0.1 | WITHIN |
|  |  | span[1] | 5.47 | 5.497 | 0.027 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.106 | -0.014 | 0.1 | WITHIN |
|  |  | doors.count — auto doors main-idoor-0-4 4.228..5.127 | 1 | 1 | 0 | — | WITHIN |
|  |  | T2-IDOOR-G-ENTRY.interval[0] | 4.2 | 4.228 | 0.028 | 0.1 | WITHIN |
|  |  | T2-IDOOR-G-ENTRY.interval[1] | 5.13 | 5.127 | -0.003 | 0.1 | WITHIN |
|  |  | T2-IDOOR-G-ENTRY.widthM | 0.93 | 0.898 | -0.032 | 0.1 | WITHIN |
| **T2-IWALL-G-BOILER_WEST** boiler room west wall (kotłownia / vestibule+hall) → **MATCH** | main-iwall-0-z-5 (L1) | centre — length-weighted mean of piece.at | 5.42 | 5.413 | -0.007 | 0.1 | WITHIN |
|  |  | span[0] | 1.45 | 1.479 | 0.029 | 0.1 | WITHIN |
|  |  | span[1] | 4.79 | 4.787 | -0.003 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.132 | 0.012 | 0.1 | WITHIN |
|  |  | doors.count — auto doors main-idoor-0-2 2.22..3.12 | 1 | 1 | 0 | — | WITHIN |
|  |  | T2-IDOOR-G-BOILER.interval[0] | 2.22 | 2.22 | 0 | 0.1 | WITHIN |
|  |  | T2-IDOOR-G-BOILER.interval[1] | 3.14 | 3.12 | -0.02 | 0.1 | WITHIN |
|  |  | T2-IDOOR-G-BOILER.widthM | 0.92 | 0.9 | -0.02 | 0.1 | WITHIN |
| **T2-IWALL-G-BOILER_NORTH** boiler room north wall (kotłownia / stair) → **MATCH** | main-iwall-0-x-5 (L1) | centre — length-weighted mean of piece.at | 4.7 | 4.682 | -0.018 | 0.1 | WITHIN |
|  |  | span[0] | 5.39 | 5.391 | 0.001 | 0.1 | WITHIN |
|  |  | span[1] | 7.45 | 7.426 | -0.024 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.26 | 0.264 | 0.004 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-G-PANTRY_WEST** pantry west wall (spiżarnia / hall) → **PARTIAL** | main-iwall-0-z-3 (L1) | centre — length-weighted mean of piece.at | 5.42 | 5.417 | -0.003 | 0.1 | WITHIN |
|  |  | span[0] | 7.33 | 7.302 | -0.028 | 0.1 | WITHIN |
|  |  | span[1] | 8.68 | 8.678 | -0.002 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.132 | 0.012 | 0.1 | WITHIN |
|  |  | doors.count — auto doors main-idoor-0-3 7.593..8.255 | 1 | 1 | 0 | — | WITHIN |
|  |  | T2-IDOOR-G-PANTRY.interval[0] | 7.54 | 7.593 | 0.053 | 0.1 | WITHIN |
|  |  | T2-IDOOR-G-PANTRY.interval[1] | 8.36 | 8.255 | -0.105 | 0.1 | OUTSIDE |
|  |  | T2-IDOOR-G-PANTRY.widthM | 0.82 | 0.662 | -0.158 | 0.1 | OUTSIDE |
| **T2-IWALL-G-PANTRY_SOUTH** pantry south wall (over the stair well) → **MATCH** | main-iwall-0-x-1 (L1) | centre — length-weighted mean of piece.at | 7.4 | 7.381 | -0.019 | 0.1 | WITHIN |
|  |  | span[0] | 5.39 | 5.391 | 0.001 | 0.1 | WITHIN |
|  |  | span[1] | 6.42 | 6.448 | 0.028 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.132 | 0.012 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-G-PANTRY_NORTH** pantry north wall (spiżarnia / salon) → **MATCH** | main-iwall-0-x-0 (L1) | centre — length-weighted mean of piece.at | 8.57 | 8.599 | 0.029 | 0.1 | WITHIN |
|  |  | span[0] | 5.36 | 5.364 | 0.004 | 0.1 | WITHIN |
|  |  | span[1] | 7.45 | 7.426 | -0.024 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.22 | 0.317 | 0.097 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-G-WELL_WEST** stair well west wall (well / hall) → **MATCH** | main-iwall-0-z-8 (L1) | centre — length-weighted mean of piece.at | 6.39 | 6.395 | 0.005 | 0.1 | WITHIN |
|  |  | span[0] | 6.35 | 6.323 | -0.027 | 0.1 | WITHIN |
|  |  | span[1] | 7.43 | 7.434 | 0.004 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.132 | 0.012 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-G-CHIMNEY1** fireplace flue block (ground) → **PARTIAL** | main-block-0-0 | centre — block centre across the axis | 8.9 | 8.731 | -0.169 | 0.1 | OUTSIDE |
|  |  | span[0] | 5.6 | 5.602 | 0.002 | 0.1 | WITHIN |
|  |  | span[1] | 6.03 | 6.052 | 0.022 | 0.1 | WITHIN |
|  |  | thicknessM — block extent across the axis | 0.4 | 0.635 | 0.235 | 0.1 | OUTSIDE |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-U-CORRIDOR_WEST** corridor west wall (rooms 6,5,4 / corridor 1) → **MATCH** | main-iwall-1-z-2 (L1) | centre — length-weighted mean of piece.at | 3.95 | 3.924 | -0.026 | 0.1 | WITHIN |
|  |  | span[0] | 4.71 | 4.703 | -0.007 | 0.1 | WITHIN |
|  |  | span[1] | 13.15 | 13.101 | -0.049 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.105 | -0.015 | 0.1 | WITHIN |
|  |  | doors.count — auto doors main-idoor-1-0 4.966..5.862, main-idoor-1-1 7.178..8.073, main-idoor-1-2 8.757..9.652 | 3 | 3 | 0 | — | WITHIN |
|  |  | T2-IDOOR-U-BATH.interval[0] | 4.94 | 4.966 | 0.026 | 0.1 | WITHIN |
|  |  | T2-IDOOR-U-BATH.interval[1] | 5.87 | 5.862 | -0.008 | 0.1 | WITHIN |
|  |  | T2-IDOOR-U-BATH.widthM | 0.93 | 0.895 | -0.035 | 0.1 | WITHIN |
|  |  | T2-IDOOR-U-PRALNIA.interval[0] | 7.17 | 7.178 | 0.008 | 0.1 | WITHIN |
|  |  | T2-IDOOR-U-PRALNIA.interval[1] | 8.09 | 8.073 | -0.017 | 0.1 | WITHIN |
|  |  | T2-IDOOR-U-PRALNIA.widthM | 0.92 | 0.895 | -0.025 | 0.1 | WITHIN |
|  |  | T2-IDOOR-U-POKOJ_NW.interval[0] | 8.76 | 8.757 | -0.003 | 0.1 | WITHIN |
|  |  | T2-IDOOR-U-POKOJ_NW.interval[1] | 9.68 | 9.652 | -0.028 | 0.1 | WITHIN |
|  |  | T2-IDOOR-U-POKOJ_NW.widthM | 0.92 | 0.895 | -0.025 | 0.1 | WITHIN |
| **T2-IWALL-U-ROOM2_WEST** south room west wall (garderoba 3 / pokój 2) → **PARTIAL** | main-iwall-1-z-0 (L1) | centre — length-weighted mean of piece.at | 3.4 | 3.386 | -0.014 | 0.1 | WITHIN |
|  |  | span[0] | 1.45 | 2.913 | 1.463 | 0.1 | OUTSIDE |
|  |  | span[1] | 4.84 | 4.861 | 0.021 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.131 | 0.011 | 0.1 | WITHIN |
|  |  | doors.count | 1 | 0 | -1 | — | OUTSIDE |
|  |  | T2-IDOOR-U-GARDEROBA_SW.interval[0] — no InteriorDoorGap on this wall line near the truth door | 2.09 | — | — | 0.1 | MISSING |
|  |  | T2-IDOOR-U-GARDEROBA_SW.interval[1] — no InteriorDoorGap on this wall line near the truth door | 2.91 | — | — | 0.1 | MISSING |
| **T2-IWALL-U-BATH_SOUTH** bathroom south wall (łazienka 4 / garderoba 3) → **MATCH** | main-iwall-1-x-5 (L1) | centre — length-weighted mean of piece.at | 3.86 | 3.887 | 0.027 | 0.1 | WITHIN |
|  |  | span[0] | 0.45 | 0.499 | 0.049 | 0.1 | WITHIN |
|  |  | span[1] | 3.45 | 3.464 | 0.014 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.131 | 0.011 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-U-PRALNIA_SOUTH** laundry south wall (pralnia 5 / łazienka 4) → **MATCH** | main-iwall-1-x-2 (L1) | centre — length-weighted mean of piece.at | 6.47 | 6.48 | 0.01 | 0.1 | WITHIN |
|  |  | span[0] | 0.45 | 0.499 | 0.049 | 0.1 | WITHIN |
|  |  | span[1] | 3.95 | 3.989 | 0.039 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.105 | -0.015 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-U-POKOJ_NW_SOUTH** north-west room south wall (pokój 6 / pralnia 5) → **MATCH** | main-iwall-1-x-0 (L1) | centre — length-weighted mean of piece.at | 8.6 | 8.613 | 0.013 | 0.1 | WITHIN |
|  |  | span[0] | 0.45 | 0.499 | 0.049 | 0.1 | WITHIN |
|  |  | span[1] | 3.95 | 3.989 | 0.039 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.105 | -0.015 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-U-CORRIDOR_SOUTH** corridor south wall (corridor 1 + stair 9 / pokój 2) → **MATCH** | main-iwall-1-x-4 (L1) | centre — length-weighted mean of piece.at | 4.7 | 4.785 | 0.085 | 0.1 | WITHIN |
|  |  | span[0] | 3.34 | 3.333 | -0.007 | 0.1 | WITHIN |
|  |  | span[1] | 7.45 | 7.428 | -0.022 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.131 | 0.011 | 0.1 | WITHIN |
|  |  | doors.count — auto doors main-idoor-1-3 4.094..4.987 | 1 | 1 | 0 | — | WITHIN |
|  |  | T2-IDOOR-U-POKOJ_S.interval[0] | 4.08 | 4.094 | 0.014 | 0.1 | WITHIN |
|  |  | T2-IDOOR-U-POKOJ_S.interval[1] | 5.01 | 4.987 | -0.023 | 0.1 | WITHIN |
|  |  | T2-IDOOR-U-POKOJ_S.widthM | 0.93 | 0.892 | -0.038 | 0.1 | WITHIN |
| **T2-IWALL-U-GARDEROBA_NE_WEST** north-east wardrobe west wall (garderoba 8 / corridor) → **MATCH** | main-iwall-1-z-6 (L1) | centre — length-weighted mean of piece.at | 5.23 | 5.197 | -0.033 | 0.1 | WITHIN |
|  |  | span[0] | 8.46 | 8.441 | -0.019 | 0.1 | WITHIN |
|  |  | span[1] | 9.89 | 9.889 | -0.001 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.131 | 0.011 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-U-STAIR_NORTH** stair compartment north wall (stair 9 / garderoba 8) → **MATCH** | main-iwall-1-x-1 (L1) | centre — length-weighted mean of piece.at | 8.5 | 8.52 | 0.02 | 0.1 | WITHIN |
|  |  | span[0] | 5.17 | 5.144 | -0.026 | 0.1 | WITHIN |
|  |  | span[1] | 7.45 | 7.428 | -0.022 | 0.1 | WITHIN |
|  |  | thicknessM — the primary piece | 0.12 | 0.131 | 0.011 | 0.1 | WITHIN |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-U-CHIMNEY1** chimney 1 block (attic) → **PARTIAL** | main-block-1-0 | centre — block centre across the axis | 8.83 | 8.81 | -0.02 | 0.1 | WITHIN |
|  |  | span[0] | 5.46 | 5.433 | -0.027 | 0.1 | WITHIN |
|  |  | span[1] | 6.07 | 6.063 | -0.007 | 0.1 | WITHIN |
|  |  | thicknessM — block extent across the axis | 0.43 | 0.737 | 0.307 | 0.1 | OUTSIDE |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-U-CHIMNEY2** chimney 2 block (attic) → **PARTIAL** | main-block-1-1 | centre — block centre across the axis | 4.43 | 4.506 | 0.076 | 0.1 | WITHIN |
|  |  | span[0] | 5.46 | 5.433 | -0.027 | 0.1 | WITHIN |
|  |  | span[1] | 5.99 | 5.984 | -0.006 | 0.1 | WITHIN |
|  |  | thicknessM — block extent across the axis | 0.55 | 0.658 | 0.108 | 0.1 | OUTSIDE |
|  |  | doors.count | 0 | 0 | 0 | — | WITHIN |
| **T2-IWALL-ATTIC-TOP** attic partition heights → **PARTIAL** | main-iwall-1-z-0 (L1) | capY — InteriorWallPiece has no top/cap field; the model's 8 attic partitions are FOLLOW_ROOF (8) with height 4.89 | 5.72 | — | — | 0.05 | MISSING |

- **T2-IWALL-U-POKOJ_NE_SOUTH** north-east room south wall (pokój 7 / garderoba 8 + corridor) → MISSING: no X-axis piece within ±0.5 m of 9.84 on storey 1

- T2-IWALL-G-ROOM_EAST: 2 pieces: main-iwall-0-z-1, main-iwall-0-z-2 (union taken for the span)
- T2-IWALL-G-BATH_EAST: 2 pieces: main-iwall-0-z-0, main-iwall-0-z-1 (union taken for the span)
- T2-IWALL-G-ENTRY_NORTH: 2 pieces: main-iwall-0-x-6, main-iwall-0-x-7 (union taken for the span)
- T2-IWALL-G-BOILER_WEST: 2 pieces: main-iwall-0-z-5, main-iwall-0-z-6 (union taken for the span)
- T2-IWALL-G-PANTRY_WEST: 2 pieces: main-iwall-0-z-3, main-iwall-0-z-4 (union taken for the span)
- T2-IWALL-G-CHIMNEY1: matched a solid block (interior[].blocks), not a wall piece
- T2-IWALL-U-CORRIDOR_WEST: 4 pieces: main-iwall-1-z-2, main-iwall-1-z-3, main-iwall-1-z-4, main-iwall-1-z-5 (union taken for the span)
- T2-IWALL-U-CORRIDOR_SOUTH: 2 pieces: main-iwall-1-x-3, main-iwall-1-x-4 (union taken for the span)
- T2-IWALL-U-CHIMNEY1: matched a solid block (interior[].blocks), not a wall piece
- T2-IWALL-U-CHIMNEY2: matched a solid block (interior[].blocks), not a wall piece
- T2-IWALL-ATTIC-TOP: truth: partitions below the cap follow the roof underside

## ROOM

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-ROOM-G-1** room 1 Wiatrołap → **PARTIAL** | main-room-0-1 (L1) | bounds.x0 | 3.47 | 3.49 | 0.02 | 0.1 | WITHIN |
|  |  | bounds.x1 | 5.36 | 5.34 | -0.02 | 0.1 | WITHIN |
|  |  | bounds.z0 | 1.45 | 1.481 | 0.031 | 0.1 | WITHIN |
|  |  | bounds.z1 | 3.47 | 3.431 | -0.039 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 3.82 | 3.43 | -0.39 | 0.5 | WITHIN |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Wiatrołap | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 1 | — | — | — | MISSING |
| **T2-ROOM-G-2** room 2 Hol → **PARTIAL** | main-room-0-3 (L2) | bounds.x0 | 3.47 | 0.49 | -2.98 | 0.1 | OUTSIDE |
|  |  | bounds.x1 | 5.36 | 7.39 | 2.03 | 0.1 | OUTSIDE |
|  |  | bounds.z0 | 3.59 | 3.631 | 0.041 | 0.1 | WITHIN |
|  |  | bounds.z1 | 9.01 | 13.131 | 4.121 | 0.1 | OUTSIDE |
|  |  | polygonAreaM2 — room.areaM2 | 8.63 | 47.593 | 38.963 | 0.5 | OUTSIDE |
|  |  | label | Hol | Kuchnia | — | — | OUTSIDE |
|  |  | number | 2 | 3 | — | — | OUTSIDE |
|  |  | publishedAreaM2 | 9.18 | 9.63 | 0.45 | — | OUTSIDE |
| **T2-ROOM-G-3** room 3 Kuchnia → **PARTIAL** | main-room-0-3 (L2) | bounds.x0 | 0.45 | 0.49 | 0.04 | 0.1 | WITHIN |
|  |  | bounds.x1 | 4.08 | 7.39 | 3.31 | 0.1 | OUTSIDE |
|  |  | bounds.z0 | 6.36 | 3.631 | -2.729 | 0.1 | OUTSIDE |
|  |  | bounds.z1 | 9.01 | 13.131 | 4.121 | 0.1 | OUTSIDE |
|  |  | polygonAreaM2 — room.areaM2 | 9.62 | 47.593 | 37.973 | 0.5 | OUTSIDE |
|  |  | label | Kuchnia | Kuchnia | — | — | WITHIN |
|  |  | number | 3 | 3 | — | — | WITHIN |
|  |  | publishedAreaM2 | 9.63 | 9.63 | 0 | — | WITHIN |
| **T2-ROOM-G-4** room 4 Salon + Jadalnia → **PARTIAL** | main-room-0-3 (L2) | bounds.x0 | 0.45 | 0.49 | 0.04 | 0.1 | WITHIN |
|  |  | bounds.x1 | 7.45 | 7.39 | -0.06 | 0.1 | WITHIN |
|  |  | bounds.z0 | 8.69 | 3.631 | -5.059 | 0.1 | OUTSIDE |
|  |  | bounds.z1 | 13.15 | 13.131 | -0.019 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 29.61 | 47.593 | 17.983 | 0.5 | OUTSIDE |
|  |  | label | Salon + Jadalnia | Kuchnia | — | — | OUTSIDE |
|  |  | number | 4 | 3 | — | — | OUTSIDE |
|  |  | publishedAreaM2 | 29.52 | 9.63 | -19.89 | — | OUTSIDE |
| **T2-ROOM-G-5** room 5 Spiżarnia → **PARTIAL** | main-room-0-5 (L1) | bounds.x0 | 5.48 | 5.49 | 0.01 | 0.1 | WITHIN |
|  |  | bounds.x1 | 7.45 | 7.39 | -0.06 | 0.1 | WITHIN |
|  |  | bounds.z0 | 7.46 | 7.481 | 0.021 | 0.1 | WITHIN |
|  |  | bounds.z1 | 8.46 | 8.431 | -0.029 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 1.97 | 1.7 | -0.27 | 0.5 | WITHIN |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Spiżarnia | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 5 | — | — | — | MISSING |
| **T2-ROOM-G-6** room 6 Łazienka → **PARTIAL** | main-room-0-4 (L1) | bounds.x0 | 0.45 | 0.49 | 0.04 | 0.1 | WITHIN |
|  |  | bounds.x1 | 3.35 | 3.34 | -0.01 | 0.1 | WITHIN |
|  |  | bounds.z0 | 4.82 | 4.831 | 0.011 | 0.1 | WITHIN |
|  |  | bounds.z1 | 6.24 | 6.181 | -0.059 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 4.12 | 3.758 | -0.363 | 0.5 | WITHIN |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Łazienka | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 6 | — | — | — | MISSING |
| **T2-ROOM-G-7** room 7 Pokój → **PARTIAL** | main-room-0-0 (L1) | bounds.x0 | 0.45 | 0.49 | 0.04 | 0.1 | WITHIN |
|  |  | bounds.x1 | 3.35 | 3.34 | -0.01 | 0.1 | WITHIN |
|  |  | bounds.z0 | 1.45 | 1.481 | 0.031 | 0.1 | WITHIN |
|  |  | bounds.z1 | 4.7 | 4.681 | -0.019 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 9.43 | 9.03 | -0.4 | 0.5 | WITHIN |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Pokój | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 7 | — | — | — | MISSING |
| **T2-ROOM-G-8** room 8 Kotłownia → **PARTIAL** | main-room-0-2 (L1) | bounds.x0 | 5.48 | 5.49 | 0.01 | 0.1 | WITHIN |
|  |  | bounds.x1 | 7.45 | 7.39 | -0.06 | 0.1 | WITHIN |
|  |  | bounds.z0 | 1.45 | 1.481 | 0.031 | 0.1 | WITHIN |
|  |  | bounds.z1 | 4.57 | 4.531 | -0.039 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 6.15 | 5.555 | -0.595 | 0.5 | OUTSIDE |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Kotłownia | — | — | — | MISSING |
|  |  | number | 8 | 9 | — | — | OUTSIDE |
| **T2-ROOM-G-9** room 9 Garaż → **PARTIAL** | attached-0-room-0-0 (L1) | bounds.x0 | 7.9 | 8.39 | 0.49 | 0.1 | OUTSIDE |
|  |  | bounds.x1 | 11.6 | 11.54 | -0.06 | 0.1 | WITHIN |
|  |  | bounds.z0 | 1.45 | 1.481 | 0.031 | 0.1 | WITHIN |
|  |  | bounds.z1 | 8.05 | 8.031 | -0.019 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 24.42 | 20.558 | -3.863 | 0.5 | OUTSIDE |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Garaż | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 9 | — | — | — | MISSING |
| **T2-ROOM-G-STAIR** room stair Schody (shaft, no number on the ground table) → **PARTIAL** | main-room-0-3 (L2) | bounds.x0 | 5.36 | 0.49 | -4.87 | 0.1 | OUTSIDE |
|  |  | bounds.x1 | 7.45 | 7.39 | -0.06 | 0.1 | WITHIN |
|  |  | bounds.z0 | 4.83 | 3.631 | -1.199 | 0.1 | OUTSIDE |
|  |  | bounds.z1 | 7.4 | 13.131 | 5.731 | 0.1 | OUTSIDE |
|  |  | polygonAreaM2 — room.areaM2 | 5.37 | 47.593 | 42.223 | 0.5 | OUTSIDE |
|  |  | label | Schody (shaft, no number on the ground table) | Kuchnia | — | — | OUTSIDE |
|  |  | number | stair | 3 | — | — | OUTSIDE |
| **T2-ROOM-U-1** room 1 Korytarz → **PARTIAL** | main-room-1-2 (L1) | bounds.x0 | 4.01 | 3.99 | -0.02 | 0.1 | WITHIN |
|  |  | bounds.x1 | 5.36 | 7.39 | 2.03 | 0.1 | OUTSIDE |
|  |  | bounds.z0 | 4.76 | 4.881 | 0.121 | 0.1 | OUTSIDE |
|  |  | bounds.z1 | 9.78 | 13.131 | 3.351 | 0.1 | OUTSIDE |
|  |  | polygonAreaM2 — room.areaM2 | 6.68 | 20.895 | 14.215 | 0.5 | OUTSIDE |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Korytarz | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 1 | — | — | — | MISSING |
| **T2-ROOM-U-2** room 2 Pokój (south) → **PARTIAL** | main-room-1-0 (L1) | bounds.x0 | 3.46 | 0.49 | -2.97 | 0.1 | OUTSIDE |
|  |  | bounds.x1 | 7.45 | 7.39 | -0.06 | 0.1 | WITHIN |
|  |  | bounds.z0 | 1.45 | 1.481 | 0.031 | 0.1 | WITHIN |
|  |  | bounds.z1 | 4.64 | 4.681 | 0.041 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 12.73 | 18.275 | 5.545 | 0.5 | OUTSIDE |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Pokój (south) | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 2 | — | — | — | MISSING |
| **T2-ROOM-U-3** room 3 Garderoba (south-west) → **PARTIAL** | main-room-1-0 (L1) | bounds.x0 | 0.45 | 0.49 | 0.04 | 0.1 | WITHIN |
|  |  | bounds.x1 | 3.34 | 7.39 | 4.05 | 0.1 | OUTSIDE |
|  |  | bounds.z0 | 1.45 | 1.481 | 0.031 | 0.1 | WITHIN |
|  |  | bounds.z1 | 3.8 | 4.681 | 0.881 | 0.1 | OUTSIDE |
|  |  | polygonAreaM2 — room.areaM2 | 6.79 | 18.275 | 11.485 | 0.5 | OUTSIDE |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Garderoba (south-west) | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 3 | — | — | — | MISSING |
| **T2-ROOM-U-4** room 4 Łazienka → **PARTIAL** | main-room-1-1 (L1) | bounds.x0 | 0.45 | 0.49 | 0.04 | 0.1 | WITHIN |
|  |  | bounds.x1 | 3.89 | 3.84 | -0.05 | 0.1 | WITHIN |
|  |  | bounds.z0 | 3.92 | 3.981 | 0.061 | 0.1 | WITHIN |
|  |  | bounds.z1 | 6.41 | 6.381 | -0.029 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 8.57 | 7.45 | -1.12 | 0.5 | OUTSIDE |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Łazienka | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 4 | — | — | — | MISSING |
| **T2-ROOM-U-5** room 5 Pralnia → **MATCH** | main-room-1-3 (L2) | bounds.x0 | 0.45 | 0.49 | 0.04 | 0.1 | WITHIN |
|  |  | bounds.x1 | 3.89 | 3.84 | -0.05 | 0.1 | WITHIN |
|  |  | bounds.z0 | 6.53 | 6.581 | 0.051 | 0.1 | WITHIN |
|  |  | bounds.z1 | 8.54 | 8.531 | -0.009 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 6.91 | 6.438 | -0.473 | 0.5 | WITHIN |
|  |  | label | Pralnia | Pralnia | — | — | WITHIN |
|  |  | number | 5 | 5 | — | — | WITHIN |
|  |  | publishedAreaM2 | 5.59 | 5.59 | 0 | — | WITHIN |
| **T2-ROOM-U-6** room 6 Pokój (north-west) → **PARTIAL** | main-room-1-4 (L1) | bounds.x0 | 0.45 | 0.49 | 0.04 | 0.1 | WITHIN |
|  |  | bounds.x1 | 3.89 | 3.84 | -0.05 | 0.1 | WITHIN |
|  |  | bounds.z0 | 8.66 | 8.681 | 0.021 | 0.1 | WITHIN |
|  |  | bounds.z1 | 13.15 | 13.131 | -0.019 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 15.45 | 14.813 | -0.637 | 0.5 | OUTSIDE |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Pokój (north-west) | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 6 | — | — | — | MISSING |
| **T2-ROOM-U-7** room 7 Pokój (north-east) → **PARTIAL** | main-room-1-2 (L1) | bounds.x0 | 4.01 | 3.99 | -0.02 | 0.1 | WITHIN |
|  |  | bounds.x1 | 7.45 | 7.39 | -0.06 | 0.1 | WITHIN |
|  |  | bounds.z0 | 9.9 | 4.881 | -5.019 | 0.1 | OUTSIDE |
|  |  | bounds.z1 | 13.15 | 13.131 | -0.019 | 0.1 | WITHIN |
|  |  | polygonAreaM2 — room.areaM2 | 11.18 | 20.895 | 9.715 | 0.5 | OUTSIDE |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Pokój (north-east) | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 7 | — | — | — | MISSING |
| **T2-ROOM-U-8** room 8 Garderoba (north-east) → **PARTIAL** | main-room-1-2 (L1) | bounds.x0 | 5.29 | 3.99 | -1.3 | 0.1 | OUTSIDE |
|  |  | bounds.x1 | 7.45 | 7.39 | -0.06 | 0.1 | WITHIN |
|  |  | bounds.z0 | 8.56 | 4.881 | -3.679 | 0.1 | OUTSIDE |
|  |  | bounds.z1 | 9.78 | 13.131 | 3.351 | 0.1 | OUTSIDE |
|  |  | polygonAreaM2 — room.areaM2 | 2.64 | 20.895 | 18.255 | 0.5 | OUTSIDE |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Garderoba (north-east) | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 8 | — | — | — | MISSING |
| **T2-ROOM-U-9** room 9 Schody → **PARTIAL** | main-room-1-2 (L1) | bounds.x0 | 5.36 | 3.99 | -1.37 | 0.1 | OUTSIDE |
|  |  | bounds.x1 | 7.45 | 7.39 | -0.06 | 0.1 | WITHIN |
|  |  | bounds.z0 | 4.76 | 4.881 | 0.121 | 0.1 | OUTSIDE |
|  |  | bounds.z1 | 8.44 | 13.131 | 4.691 | 0.1 | OUTSIDE |
|  |  | polygonAreaM2 — room.areaM2 | 5.93 | 20.895 | 14.965 | 0.5 | OUTSIDE |
|  |  | label — RoomPolygon.label absent: the plan label was not read for this room | Schody | — | — | — | MISSING |
|  |  | number — RoomPolygon.number absent: the plan label was not read for this room | 9 | — | — | — | MISSING |


- T2-ROOM-G-1: 90 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid
- T2-ROOM-G-2: 92 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid · auto room is openPlan (47.593 m²): several published rooms share it · feature graph marks unresolved: subdivision (open plan) · the same auto room is also matched by T2-ROOM-G-3, T2-ROOM-G-4, T2-ROOM-G-STAIR
- T2-ROOM-G-3: 99 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid · auto room is openPlan (47.593 m²): several published rooms share it · feature graph marks unresolved: subdivision (open plan) · the same auto room is also matched by T2-ROOM-G-2, T2-ROOM-G-4, T2-ROOM-G-STAIR
- T2-ROOM-G-4: 97 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid · auto room is openPlan (47.593 m²): several published rooms share it · feature graph marks unresolved: subdivision (open plan) · the same auto room is also matched by T2-ROOM-G-2, T2-ROOM-G-3, T2-ROOM-G-STAIR
- T2-ROOM-G-5: 87 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid
- T2-ROOM-G-6: 93 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid
- T2-ROOM-G-7: 96 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid
- T2-ROOM-G-8: 92 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid
- T2-ROOM-G-9: 84 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid · auto room is openPlan (20.558 m²): several published rooms share it · feature graph marks unresolved: subdivision (open plan)
- T2-ROOM-G-STAIR: 28 % of the truth polygon lies inside the auto polygon · the centroid lies in no auto room (an L-shape or a void); 28 % of the truth polygon falls inside this auto room · auto room is openPlan (47.593 m²): several published rooms share it · feature graph marks unresolved: subdivision (open plan) · the same auto room is also matched by T2-ROOM-G-2, T2-ROOM-G-3, T2-ROOM-G-4
- T2-ROOM-U-1: 86 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid · auto room is openPlan (20.895 m²): several published rooms share it · feature graph marks unresolved: subdivision (open plan) · the same auto room is also matched by T2-ROOM-U-7, T2-ROOM-U-8, T2-ROOM-U-9
- T2-ROOM-U-2: 91 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid · the same auto room is also matched by T2-ROOM-U-3
- T2-ROOM-U-3: 95 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid · the same auto room is also matched by T2-ROOM-U-2
- T2-ROOM-U-4: 86 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid
- T2-ROOM-U-5: 93 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid
- T2-ROOM-U-6: 95 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid
- T2-ROOM-U-7: 98 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid · auto room is openPlan (20.895 m²): several published rooms share it · feature graph marks unresolved: subdivision (open plan) · the same auto room is also matched by T2-ROOM-U-1, T2-ROOM-U-8, T2-ROOM-U-9
- T2-ROOM-U-8: 79 % of the truth polygon lies inside the auto polygon · auto polygon contains the truth centroid · auto room is openPlan (20.895 m²): several published rooms share it · feature graph marks unresolved: subdivision (open plan) · the same auto room is also matched by T2-ROOM-U-1, T2-ROOM-U-7, T2-ROOM-U-9
- T2-ROOM-U-9: 29 % of the truth polygon lies inside the auto polygon · the centroid lies in no auto room (an L-shape or a void); 29 % of the truth polygon falls inside this auto room · auto room is openPlan (20.895 m²): several published rooms share it · feature graph marks unresolved: subdivision (open plan) · the same auto room is also matched by T2-ROOM-U-1, T2-ROOM-U-7, T2-ROOM-U-8

## STAIR

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-STAIR-TOPOLOGY** stair topology: U-stair of three flights and two quarter landings → **PARTIAL** | stair-0 (L2) | flightCount | 3 | 3 | 0 | — | WITHIN |
|  |  | landingCount | 2 | 2 | 0 | — | WITHIN |
|  |  | risersPerFlight | [5, 7, 5] | [5, 7, 5] | — | — | WITHIN |
|  |  | risersTotal | 17 | 17 | 0 | — | WITHIN |
|  |  | turnKind — truth "U (two left quarter turns)" | U | U | — | — | WITHIN |
|  |  | winders — winderRegions.length | 0 | 0 | 0 | — | WITHIN |
|  |  | widthM | 1 | 1.024 | 0.024 | 0.1 | WITHIN |
|  |  | shaft.x[0] | 5.36 | 5.329 | -0.031 | 0.1 | WITHIN |
|  |  | shaft.x[1] | 7.45 | 7.428 | -0.022 | 0.1 | WITHIN |
|  |  | shaft.z[0] | 4.81 | 4.814 | 0.004 | 0.1 | WITHIN |
|  |  | shaft.z[1] | 8.44 | 8.468 | 0.028 | 0.1 | WITHIN |
|  |  | start.x | 5.36 | 5.366 | 0.006 | 0.1 | WITHIN |
|  |  | start.z (band start) — truth gives the start band z; auto start.z | 4.81 | 4.814 | 0.004 | 0.1 | WITHIN |
|  |  | totalRiseM — levels[toLevel].elevation − levels[fromLevel].elevation | 3.06 | 3.06 | 0 | 0.05 | WITHIN |
|  |  | riserM — derived: rise / risersTotal | 0.18 | 0.18 | 0 | 0.05 | WITHIN |
|  |  | flight1.direction | PLUS_X | PLUS_X | — | — | WITHIN |
|  |  | flight1.risers | 5 | 5 | 0 | — | WITHIN |
|  |  | flight1.goingM — a tread going is too small for the 0.10 plan rule; general rule used | 0.27 | 0.264 | -0.006 | 0.05 | WITHIN |
|  |  | flight1.firstRiserAt — auto flight.from | 5.36 | 5.366 | 0.006 | 0.1 | WITHIN |
|  |  | flight1.lastRiserAt — auto flight.to | 6.45 | 6.448 | -0.002 | 0.1 | WITHIN |
|  |  | flight1.riserLineCount | 5 | 5 | 0 | — | WITHIN |
|  |  | flight1.band[0] | 4.81 | 4.814 | 0.004 | 0.1 | WITHIN |
|  |  | flight1.band[1] | 5.84 | 5.767 | -0.073 | 0.1 | WITHIN |
|  |  | flight2.direction | PLUS_Z | PLUS_Z | — | — | WITHIN |
|  |  | flight2.risers | 7 | 7 | 0 | — | WITHIN |
|  |  | flight2.goingM — a tread going is too small for the 0.10 plan rule; general rule used | 0.265 | 0.263 | -0.002 | 0.05 | WITHIN |
|  |  | flight2.firstRiserAt — auto flight.from | 5.84 | 5.767 | -0.073 | 0.1 | WITHIN |
|  |  | flight2.lastRiserAt — auto flight.to | 7.43 | 7.453 | 0.023 | 0.1 | WITHIN |
|  |  | flight2.riserLineCount | 7 | 7 | 0 | — | WITHIN |
|  |  | flight2.band[0] | 6.45 | 6.404 | -0.046 | 0.1 | WITHIN |
|  |  | flight2.band[1] | 7.45 | 7.428 | -0.022 | 0.1 | WITHIN |
|  |  | flight3.direction | MINUS_X | MINUS_X | — | — | WITHIN |
|  |  | flight3.risers | 5 | 5 | 0 | — | WITHIN |
|  |  | flight3.goingM — a tread going is too small for the 0.10 plan rule; general rule used | 0.265 | 0.269 | 0.004 | 0.05 | WITHIN |
|  |  | flight3.firstRiserAt — auto flight.from | 6.44 | 6.404 | -0.036 | 0.1 | WITHIN |
|  |  | flight3.lastRiserAt — auto flight.to | 5.36 | 5.329 | -0.031 | 0.1 | WITHIN |
|  |  | flight3.riserLineCount | 5 | 5 | 0 | — | WITHIN |
|  |  | flight3.band[0] | 7.46 | 7.441 | -0.019 | 0.1 | WITHIN |
|  |  | flight3.band[1] | 8.44 | 8.468 | 0.028 | 0.1 | WITHIN |
|  |  | landing1.turn — truth "LEFT (to +z)" | LEFT | LEFT | — | — | WITHIN |
|  |  | landing1.x[0] | 6.45 | 6.448 | -0.002 | 0.1 | WITHIN |
|  |  | landing1.x[1] | 7.45 | 7.472 | 0.022 | 0.1 | WITHIN |
|  |  | landing1.z[0] | 4.81 | 4.814 | 0.004 | 0.1 | WITHIN |
|  |  | landing1.z[1] | 5.84 | 5.767 | -0.073 | 0.1 | WITHIN |
|  |  | landing1.levelY — derived: 5 risers climbed × rise/risersTotal (StairLandingHypothesis carries no level) | 0.9 | 0.9 | 0 | 0.05 | WITHIN |
|  |  | landing2.turn — truth "LEFT (to -x)" | LEFT | LEFT | — | — | WITHIN |
|  |  | landing2.x[0] | 6.45 | 6.404 | -0.046 | 0.1 | WITHIN |
|  |  | landing2.x[1] | 7.45 | 7.428 | -0.022 | 0.1 | WITHIN |
|  |  | landing2.z[0] | 7.46 | 7.453 | -0.007 | 0.1 | WITHIN |
|  |  | landing2.z[1] | 8.44 | 8.477 | 0.037 | 0.1 | WITHIN |
|  |  | landing2.levelY — derived: 12 risers climbed × rise/risersTotal (StairLandingHypothesis carries no level) | 2.16 | 2.16 | 0 | 0.05 | WITHIN |
|  |  | well — StairTopologyHypothesis has no well; the slabHole [5.329, 7.428] × [5.767, 8.477] is the floor opening, a different thing | {"x":[5.36,6.45],"z":[5.84,7.46]} | — | — | — | MISSING |


- T2-STAIR-TOPOLOGY: auto: 3 tread ladders (5 risers plus x at 0.264 m, 7 risers plus z at 0.263 m, 5 risers minus x at 0.269 m) with 2 corner squares between them; 17 risers over 3.06 m = 0.180 m each; the arrowhead at (5.43289, 7.967588) fixes the climb

## BALCONY

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-BALCONY-FRONT** front balcony slab over the portal recess → **PARTIAL** | balcony-front-1 (L2) | x[0] | 3.25 | 3.31 | 0.06 | 0.1 | WITHIN |
|  |  | x[1] | 7.9 | 7.9 | 0 | 0.1 | WITHIN |
|  |  | z[0] | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | z[1] | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | topY | 3.06 | 3.06 | 0 | 0.05 | WITHIN |
|  |  | fasciaTopY — balcony.fascia.y[1] | 3.07 | 3.029 | -0.041 | 0.05 | WITHIN |
|  |  | fasciaSoffitY — balcony.fascia.y[0] | 2.28 | 2.321 | 0.041 | 0.05 | WITHIN |
|  |  | fasciaThicknessM — balcony.thicknessM (the band) | 0.79 | 0.739 | -0.051 | 0.05 | OUTSIDE |
| **T2-BALCONY-REAR** rear balcony slab over the loggia → **MATCH** | balcony-rear-1 (L2) | x[0] | 0.61 | 0.645 | 0.035 | 0.1 | WITHIN |
|  |  | x[1] | 7.29 | 7.255 | -0.035 | 0.1 | WITHIN |
|  |  | z[0] | 13.6 | 13.601 | 0.001 | 0.1 | WITHIN |
|  |  | z[1] | 14.6 | 14.601 | 0.001 | 0.1 | WITHIN |
|  |  | topY | 3.06 | 3.06 | 0 | 0.05 | WITHIN |
|  |  | fasciaTopY — balcony.fascia.y[1] | 3.05 | 3.026 | -0.024 | 0.05 | WITHIN |
|  |  | fasciaSoffitY — balcony.fascia.y[0] | 2.49 | 2.522 | 0.032 | 0.05 | WITHIN |
|  |  | fasciaThicknessM — balcony.thicknessM (the band) | 0.56 | 0.538 | -0.022 | 0.05 | WITHIN |


- T2-BALCONY-FRONT: feature graph marks unresolved: slab section (fascia only)
- T2-BALCONY-REAR: feature graph marks unresolved: slab section (fascia only)

## PORTAL

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-PORTAL-HEAD** portal head over the garage door: the garage roof edge over the recess → **MATCH** | portal-head-attached-0 (L2) | x[0] | 7.9 | 7.9 | 0 | 0.1 | WITHIN |
|  |  | x[1] | 12.05 | 12.05 | 0 | 0.1 | WITHIN |
|  |  | z[0] | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | z[1] | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | fasciaTopY — portalHead.y1 | 3.07 | 3.06 | -0.01 | 0.05 | WITHIN |
|  |  | fasciaSoffitY — portalHead.y0 | 2.28 | 2.321 | 0.041 | 0.05 | WITHIN |


- T2-PORTAL-HEAD: truth soffit finish "timber (VISUAL)" is visual; PortalHeadV2 carries no finish

## FACADE_MEMBER

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-FACADE-FRONT-BAND** continuous dark front band (balcony fascia + portal head) → **MATCH** | portal-head-attached-0 (L2) | x[0] — derived: balcony fascia ∪ portal head on x | 3.25 | 3.31 | 0.06 | 0.1 | WITHIN |
|  |  | x[1] — derived: balcony fascia ∪ portal head on x | 12.05 | 12.05 | 0 | 0.1 | WITHIN |
|  |  | y[0] — derived: balcony fascia ∪ portal head on y | 2.28 | 2.321 | 0.041 | 0.05 | WITHIN |
|  |  | y[1] — derived: balcony fascia ∪ portal head on y | 3.07 | 3.06 | -0.01 | 0.05 | WITHIN |
|  |  | plane.z | 0 | 0 | 0 | 0.1 | WITHIN |
|  |  | continuousFasciaAndHead — assemblies[PORTAL_FRAME] CONTINUES_AS balcony ↔ portal head | true | true | — | — | WITHIN |


- T2-FACADE-FRONT-BAND: truth kind "BALCONY_FRAME + PORTAL fascia"; auto members: FASCIA_BAND + PORTAL_HEAD

## RAILING

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-RAILING-FRONT** front glass balustrade → **PARTIAL** | railing-front-1 (L2) | x[0] | 3.3 | 3.36 | 0.06 | 0.1 | WITHIN |
|  |  | x[1] | 7.26 | 7.219 | -0.041 | 0.1 | WITHIN |
|  |  | z | 0.05 | 0.508 | 0.458 | 0.1 | OUTSIDE |
|  |  | baseY | 3.06 | 3.06 | 0 | 0.05 | WITHIN |
|  |  | topY — baseY + heightM | 3.93 | 3.97 | 0.04 | 0.05 | WITHIN |
|  |  | heightM | 0.87 | 0.91 | 0.04 | 0.05 | WITHIN |
|  |  | infill — RailingV2 has no infill; taken from model.railings[].infill | GLASS | GLASS | — | — | WITHIN |
| **T2-RAILING-REAR** rear glass balustrade → **PARTIAL** | railing-rear-1 (L2) | x[0] | 0.64 | 0.67 | 0.03 | 0.1 | WITHIN |
|  |  | x[1] | 7.26 | 7.23 | -0.03 | 0.1 | WITHIN |
|  |  | z | 14.55 | 14.551 | 0.001 | 0.1 | WITHIN |
|  |  | baseY | 3.06 | 3.06 | 0 | 0.05 | WITHIN |
|  |  | topY — baseY + heightM | 3.93 | 3.984 | 0.054 | 0.05 | OUTSIDE |
|  |  | heightM | 0.87 | 0.924 | 0.054 | 0.05 | OUTSIDE |
|  |  | infill — RailingV2 has no infill; taken from model.railings[].infill | GLASS | GLASS | — | — | WITHIN |


- T2-RAILING-FRONT: feature graph marks unresolved: post spacing
- T2-RAILING-REAR: feature graph marks unresolved: post spacing

## FACADE_ASSEMBLY

| truth | matched | property | truth value | auto value | Δ | tol | verdict |
|---|---|---|---:|---:|---:|---:|---|
| **T2-ASSEMBLY-FRONT-GABLE-FRAME** front gable frame: west return + verge members + east return above the balcony → **PARTIAL** | assembly-gable-front (L1) | kind | GABLE_FRAME | GABLE_FRAME | — | — | WITHIN |
|  |  | memberCount — truth counts a full-height return once and the verge per rake; auto lists feat-verge-front, feat-return-front-0-0, feat-return-front-0-1, feat-return-front-1-0, feat-return-front-1-1 | 4 | 5 | 1 | — | OUTSIDE |
|  |  | continuityCount — auto: feat-return-front-0-0 CONTINUES_AS feat-verge-front; feat-return-front-0-1 CONTINUES_AS feat-verge-front; feat-return-front-1-0 CONTINUES_AS feat-verge-front; feat-return-front-1-1 CONTINUES_AS feat-verge-front | 3 | 4 | 1 | — | OUTSIDE |
|  |  | plane.z — verge.planeAt | 0 | 0 | 0 | 0.1 | WITHIN |
| **T2-ASSEMBLY-REAR-GABLE-FRAME** rear gable frame: two full-height returns + verge members → **PARTIAL** | assembly-gable-rear (L1) | kind | GABLE_FRAME | GABLE_FRAME | — | — | WITHIN |
|  |  | memberCount — truth counts a full-height return once and the verge per rake; auto lists feat-verge-rear, feat-return-rear-0-0, feat-return-rear-0-1, feat-return-rear-1-0, feat-return-rear-1-1 | 3 | 5 | 2 | — | OUTSIDE |
|  |  | plane.z — verge.planeAt | 14.6 | 14.601 | 0.001 | 0.1 | WITHIN |
| **T2-ASSEMBLY-FRONT-PORTAL** front portal: balcony fascia + garage roof edge + garage return + west return jamb → **MATCH** | assembly-portal-attached-0 | kind | PORTAL_FRAME | PORTAL_FRAME | — | — | WITHIN |
|  |  | mouth.x[0] — recess-front (storey 0) open interval | 0.61 | 0.661 | 0.051 | 0.1 | WITHIN |
|  |  | mouth.x[1] — recess-front (storey 0) open interval | 11.42 | 11.416 | -0.004 | 0.1 | WITHIN |
|  |  | mouth.y[0] — [levels[0].elevation, portalHead.y0] | 0 | 0 | 0 | 0.05 | WITHIN |
|  |  | mouth.y[1] — [levels[0].elevation, portalHead.y0] | 2.28 | 2.321 | 0.041 | 0.05 | WITHIN |
|  |  | depthM — recess.depthM | 1 | 0.991 | -0.009 | 0.1 | WITHIN |
|  |  | memberCount — truth: head + fascia + jambs; auto lists feat-portal-head-attached-0, feat-balcony-front-1, feat-return-front-0-0, feat-return-front-0-1 | 4 | 4 | 0 | — | WITHIN |
| **T2-ASSEMBLY-GARAGE-BOX** garage: dark box with a flat roof and a parapet band → **PARTIAL** | roof-attached-0 (L2) | kind — no FASCIA assembly in BuildingV2.assemblies; the garage parapet lives in attachedRoofs[0].parapetTopY | FASCIA | — | — | — | MISSING |
|  |  | parapetTopY — attachedRoofs[0].parapetTopY | 3.09 | 3.125 | 0.035 | 0.05 | WITHIN |
|  |  | slabTopY — attachedRoofs[0].slabTopY | 2.88 | 2.89 | 0.01 | 0.05 | WITHIN |


- T2-ASSEMBLY-GARAGE-BOX: truth finish "dark render on all faces" is visual

## MATERIAL_REGION

- **T2-MAT-WHITE-SHELL** white render: returns, verge band, side walls above the dark band, front gable outside the timber panel → not evaluated: finish region without geometry; the auto has 3 surfaceRegions (finish-front-66 FRONT s0 WARM, finish-front-319 FRONT s0 DARK, finish-rear-66 REAR s0 WARM)
- **T2-MAT-TIMBER-FRONT** timber cladding: the recessed front wall from the west return to the balcony edge (x 0.61..3.25) full height and the gable panel up to the glazing (x 3.25..3.95 above 3.06; the gable above the balustrade x 3.95..7.26) → not evaluated: finish region without geometry; the auto has 3 surfaceRegions (finish-front-66 FRONT s0 WARM, finish-front-319 FRONT s0 DARK, finish-rear-66 REAR s0 WARM)
- **T2-MAT-TIMBER-REAR** timber cladding: the recessed rear wall either side of the 470/230 glazing under the balcony (x 0.61..2.25 and 6.95..7.29, y 0..2.28) → not evaluated: finish region without geometry; the auto has 3 surfaceRegions (finish-front-66 FRONT s0 WARM, finish-front-319 FRONT s0 DARK, finish-rear-66 REAR s0 WARM)
- **T2-MAT-DARK-FRONT** anthracite render: the portal walls (x 3.25..11.42, y 0..2.28 at z=1.00), the front band, the garage box → not evaluated: finish region without geometry; the auto has 3 surfaceRegions (finish-front-66 FRONT s0 WARM, finish-front-319 FRONT s0 DARK, finish-rear-66 REAR s0 WARM)
- **T2-MAT-DARK-REAR-GABLE** anthracite render: the rear gable wall above the balcony between the returns → not evaluated: finish region without geometry; the auto has 3 surfaceRegions (finish-front-66 FRONT s0 WARM, finish-front-319 FRONT s0 DARK, finish-rear-66 REAR s0 WARM)
- **T2-MAT-DARK-SIDE-BANDS** anthracite render bands on the ground floor: west z 3.74..9.92 to y 2.29; east from the garage (z 8.50) to the 300/230 jamb (z 9.70) to y 2.30 → not evaluated: finish region without geometry; the auto has 3 surfaceRegions (finish-front-66 FRONT s0 WARM, finish-front-319 FRONT s0 DARK, finish-rear-66 REAR s0 WARM)
- **T2-MAT-ROOF** grey clay tiles on both slopes; grey plinth 0.32 m at the base → not evaluated: finish region without geometry; the auto has 3 surfaceRegions (finish-front-66 FRONT s0 WARM, finish-front-319 FRONT s0 DARK, finish-rear-66 REAR s0 WARM)

## UNRESOLVED

- **T2-UNRES-140-220** the printed 140 \| 220 pair at the head of the attic plan and its mirror → no verdict (truth unresolved): truth unresolved; auto says: no feature at x 1.40 / 2.47 on the rear outer plane; the rear railing runs 0.67..7.23 · truth handling: candidates: balustrade panel divisions, a terrace step, a roof-window layout line
- **T2-UNRES-ENTRANCE-SPLIT** the leaf / sidelight split of the 105 entrance → no verdict (truth unresolved): truth unresolved; auto says: no front DOOR read · truth handling: render only
- **T2-UNRES-FRONT-FASCIA-SECTION** what the 0.79 m front fascia is made of (slab + downstand? parapet?) → no verdict (truth unresolved): truth unresolved; auto says: a slab band 0.739 m thick, fascia y [2.321, 3.029] (RENDER_BAND) · truth handling: modelled as a slab whose fascia is the measured band
- **T2-UNRES-VERGE-DEPTH** the depth (along z) of the white verge member and whether it is solid or a fascia board → no verdict (truth unresolved): truth unresolved; auto says: verge depthM 0.991 / 1 (assumed)
- **T2-UNRES-EAVE-DATUM** eave datum +4,67 vs the derived 4.636 → no verdict (truth unresolved): truth unresolved; auto says: mainRoof.eaveY 4.636 (derived plane), levels[1].wallTop 4.67 (printed datum) · truth handling: both kept; the model uses the derived plane so that 40°, 7.90 and 7.95 hold together
- **T2-UNRES-GARAGE-ROOF-FALL** the garage roof slab top: 2.88 at the house rising to ~2.95 at the parapet on the section → no verdict (truth unresolved): truth unresolved; auto says: a level slab top at 2.89 with the parapet at 3.125 · truth handling: modelled level at 2.88 with a parapet to 3.09
- **T2-UNRES-ROOFLIGHT-SILL** the exact position of each rooflight along its slope → no verdict (truth unresolved): truth unresolved; auto says: rooflight-left-0 at 0.478..1.247 from the eave, y 5.036..5.682
- **T2-UNRES-RAILING-HEIGHT** balustrade height 0.87 above the slab → no verdict (truth unresolved): truth unresolved; auto says: railing heights 0.91 / 0.924 m on a base at 3.06 / 3.06
- **T2-UNRES-PANTRY-SHAPE** the pantry: its south wall stops at x 6.42 and the space runs under the upper flight to z 6.82 (the 160 dimension); published 1.44 net / 2.42 gross → no verdict (truth unresolved): truth unresolved; auto says: main-room-0-5 1.7 m² bounded x 5.49..7.39, z 7.481..8.431
- **T2-UNRES-CORRIDOR-SOUTH-GAP** a 0.29 m break in the attic corridor south wall at x 6.02..6.31 beside chimney 2 → no verdict (truth unresolved): truth unresolved; auto says: corridor south wall pieces 3.333..4.094, 4.987..7.428 (no gap read at x 6.02..6.31) · truth handling: not a door
- **T2-UNRES-ATTIC-NET-AREAS** the attic table prints NET areas under an unstated headroom rule (e.g. 12.57 net vs 15.13 gross) → no verdict (truth unresolved): truth unresolved; auto says: auto room areas are gross polygons (18.275, 7.45, 20.895, 6.438, 14.813 m²)
- **T2-UNRES-CHIMNEY-DEPTH** chimney plan dimensions to better than +-0.06 → no verdict (truth unresolved): truth unresolved; auto says: chimney-0 0.63 × 0.737 m; chimney-1 0.551 × 0.658 m

## MISSING truth items (no auto feature matched)

- **T2-LEVEL-TERRAIN** (LEVEL) terrain -0,32: y: BuildingV2.terrainY is absent from the building
- **T2-IWALL-U-POKOJ_NE_SOUTH** (INTERIOR_WALL) north-east room south wall (pokój 7 / garderoba 8 + corridor): no X-axis piece within ±0.5 m of 9.84 on storey 1

## MISSING properties on matched items (the building lacks a field the truth has)

- T2-LEVEL-TERRAIN `y` = -0.32: BuildingV2.terrainY is absent from the building
- T2-LEVEL-ATTIC_CLEAR `m` = 2.66: no attic ceiling in BuildingV2 (a ceiling / partition-cap field would carry it); the model's 8 attic partitions FOLLOW_ROOF (8)
- T2-LEVEL-ATTIC_CLEAR `ceilingUndersideY` = 5.72: no ceiling feature in BuildingV2
- T2-LEVEL-ATTIC_CLEAR `ceilingTopY` = 6.1: no ceiling feature in BuildingV2
- T2-LEVEL-ATTIC_CLEAR `ceilingSpanX[0]` = 2.45: no ceiling feature in BuildingV2
- T2-LEVEL-ATTIC_CLEAR `ceilingSpanX[1]` = 5.43: no ceiling feature in BuildingV2
- T2-MASS-GARAGE `sharedWallThicknessM` = 0.39: BuildingV2 carries one wallThicknessM for all walls; no per-wall (shared wall) thickness
- T2-RETURN-HEIGHT `topY` = the roof underside at the outer plane (4.61..4.76 measured; 4.64 derived): ReturnWallV2 has no top/height field (the emitter runs the return up to the roof); mainRoof.eaveY is the roof plane at the outer plane
- T2-ROOF-BUILDUP `fromPrintedDatumVerticalM` = 0.31: no knee-wall top in BuildingV2 to measure from (levels[1].wallTop is the eave datum itself)
- T2-IWALL-U-ROOM2_WEST `T2-IDOOR-U-GARDEROBA_SW.interval[0]` = 2.09: no InteriorDoorGap on this wall line near the truth door
- T2-IWALL-U-ROOM2_WEST `T2-IDOOR-U-GARDEROBA_SW.interval[1]` = 2.91: no InteriorDoorGap on this wall line near the truth door
- T2-IWALL-ATTIC-TOP `capY` = 5.72: InteriorWallPiece has no top/cap field; the model's 8 attic partitions are FOLLOW_ROOF (8) with height 4.89
- T2-ROOM-G-1 `label` = Wiatrołap: RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-G-1 `number` = 1: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-G-5 `label` = Spiżarnia: RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-G-5 `number` = 5: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-G-6 `label` = Łazienka: RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-G-6 `number` = 6: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-G-7 `label` = Pokój: RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-G-7 `number` = 7: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-G-8 `label` = Kotłownia: RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-G-9 `label` = Garaż: RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-G-9 `number` = 9: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-U-1 `label` = Korytarz: RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-U-1 `number` = 1: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-U-2 `label` = Pokój (south): RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-U-2 `number` = 2: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-U-3 `label` = Garderoba (south-west): RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-U-3 `number` = 3: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-U-4 `label` = Łazienka: RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-U-4 `number` = 4: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-U-6 `label` = Pokój (north-west): RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-U-6 `number` = 6: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-U-7 `label` = Pokój (north-east): RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-U-7 `number` = 7: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-U-8 `label` = Garderoba (north-east): RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-U-8 `number` = 8: RoomPolygon.number absent: the plan label was not read for this room
- T2-ROOM-U-9 `label` = Schody: RoomPolygon.label absent: the plan label was not read for this room
- T2-ROOM-U-9 `number` = 9: RoomPolygon.number absent: the plan label was not read for this room
- T2-STAIR-TOPOLOGY `well` = {"x":[5.36,6.45],"z":[5.84,7.46]}: StairTopologyHypothesis has no well; the slabHole [5.329, 7.428] × [5.767, 8.477] is the floor opening, a different thing
- T2-ASSEMBLY-GARAGE-BOX `kind` = FASCIA: no FASCIA assembly in BuildingV2.assemblies; the garage parapet lives in attachedRoofs[0].parapetTopY

## EXTRA auto features (matched by no truth item; ignored in the verdicts)

- **INTERIOR_WALL** (4)
  - main-iwall-0-z-7 (L0): storey 0 Z at 6.395, 8.414..8.758, 0.132 m (conf 0.8)
  - main-iwall-0-z-9 (L0): storey 0 Z at 6.395, 4.549..4.814, 0.132 m (conf 0.8)
  - main-iwall-0-x-2 (L1): storey 0 X at 6.773, 6.342..7.267, 0.132 m (conf 0.8)
  - attached-0-iwall-0-x-0 (L1): storey 0 X at 7.95, 8.403..8.853, 0.106 m (conf 0.65)
- **BLOCK** (3)
  - main-block-0-1: storey 0 x 5.391..5.893, z 4.258..4.814
  - main-block-1-2: storey 1 x 7.008..7.428, z 4.177..4.835
  - main-block-1-3: storey 1 x 3.333..3.806, z 1.465..2.071
- **SURFACE_REGION** (3)
  - finish-front-66 (L0): FRONT storey 0 WARM along [0.645, 3.189], y [0, 3.06]
  - finish-front-319 (L0): FRONT storey 0 DARK along [3.189, 7.9], y [0, 3.06]
  - finish-rear-66 (L0): REAR storey 0 WARM along [0.645, 7.255], y [0, 3.06]

## Truth items left unresolved (no verdict)

- **T2-UNRES-140-220** the printed 140 \| 220 pair at the head of the attic plan and its mirror: truth unresolved; auto says: no feature at x 1.40 / 2.47 on the rear outer plane; the rear railing runs 0.67..7.23 · truth handling: candidates: balustrade panel divisions, a terrace step, a roof-window layout line
- **T2-UNRES-ENTRANCE-SPLIT** the leaf / sidelight split of the 105 entrance: truth unresolved; auto says: no front DOOR read · truth handling: render only
- **T2-UNRES-FRONT-FASCIA-SECTION** what the 0.79 m front fascia is made of (slab + downstand? parapet?): truth unresolved; auto says: a slab band 0.739 m thick, fascia y [2.321, 3.029] (RENDER_BAND) · truth handling: modelled as a slab whose fascia is the measured band
- **T2-UNRES-VERGE-DEPTH** the depth (along z) of the white verge member and whether it is solid or a fascia board: truth unresolved; auto says: verge depthM 0.991 / 1 (assumed)
- **T2-UNRES-EAVE-DATUM** eave datum +4,67 vs the derived 4.636: truth unresolved; auto says: mainRoof.eaveY 4.636 (derived plane), levels[1].wallTop 4.67 (printed datum) · truth handling: both kept; the model uses the derived plane so that 40°, 7.90 and 7.95 hold together
- **T2-UNRES-GARAGE-ROOF-FALL** the garage roof slab top: 2.88 at the house rising to ~2.95 at the parapet on the section: truth unresolved; auto says: a level slab top at 2.89 with the parapet at 3.125 · truth handling: modelled level at 2.88 with a parapet to 3.09
- **T2-UNRES-ROOFLIGHT-SILL** the exact position of each rooflight along its slope: truth unresolved; auto says: rooflight-left-0 at 0.478..1.247 from the eave, y 5.036..5.682
- **T2-UNRES-RAILING-HEIGHT** balustrade height 0.87 above the slab: truth unresolved; auto says: railing heights 0.91 / 0.924 m on a base at 3.06 / 3.06
- **T2-UNRES-PANTRY-SHAPE** the pantry: its south wall stops at x 6.42 and the space runs under the upper flight to z 6.82 (the 160 dimension); published 1.44 net / 2.42 gross: truth unresolved; auto says: main-room-0-5 1.7 m² bounded x 5.49..7.39, z 7.481..8.431
- **T2-UNRES-CORRIDOR-SOUTH-GAP** a 0.29 m break in the attic corridor south wall at x 6.02..6.31 beside chimney 2: truth unresolved; auto says: corridor south wall pieces 3.333..4.094, 4.987..7.428 (no gap read at x 6.02..6.31) · truth handling: not a door
- **T2-UNRES-ATTIC-NET-AREAS** the attic table prints NET areas under an unstated headroom rule (e.g. 12.57 net vs 15.13 gross): truth unresolved; auto says: auto room areas are gross polygons (18.275, 7.45, 20.895, 6.438, 14.813 m²)
- **T2-UNRES-CHIMNEY-DEPTH** chimney plan dimensions to better than +-0.06: truth unresolved; auto says: chimney-0 0.63 × 0.737 m; chimney-1 0.551 × 0.658 m
