# Synthetic architectural diversity fixtures

| fixture | result | capabilities | assemblies | relationships | replay | round trip | triangles | closure (ext. errors / warnings) | relationships held | roof joins closed | roofs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| roof-gable | PASS | ROOF_GABLE | ROOF×1 | 2 | same hash | same hash | 500 | 0 / 0 | 2/2 | 1/1 | GABLE |
| roof-hip | PASS | ROOF_HIP | ROOF×1 | 4 | same hash | same hash | 540 | 0 / 0 | 4/4 | 5/5 | HIP |
| roof-shed | PASS | ROOF_SHED | ROOF×1 | 2 | same hash | same hash | 436 | 0 / 0 | 2/2 | 0/0 | SHED |
| roof-flat-parapet | PASS | ROOF_FLAT, PARAPET | ROOF×1 | 16 | same hash | same hash | 448 | 0 / 0 | 12/12 | 0/0 | FLAT |
| roof-intersecting-gables | PASS | ROOF_INTERSECTION, ROOF_VALLEY | ROOF×1 | 5 | same hash | same hash | 428 | 0 / 0 | 5/5 | 4/4 | INTERSECTING |
| roof-stepped-levels | PASS | ROOF_STEP, ROOF_FLAT | ROOF×1 | 5 | same hash | same hash | 336 | 0 / 0 | 5/5 | 0/0 | STEPPED |
| roof-dormer-gable | PASS | ROOF_DORMER, ROOF_VALLEY, ROOF_GABLE | ROOF×2, DORMER×1 | 11 | same hash | same hash | 744 | 0 / 0 | 11/11 | 4/4 | GABLE, GABLE |
| roof-dormer-shed | PASS | ROOF_DORMER, ROOF_VALLEY, ROOF_SHED | ROOF×2, DORMER×1 | 9 | same hash | same hash | 680 | 0 / 0 | 9/9 | 2/2 | SHED, GABLE |
| exterior-balcony | PASS | BALCONY | ROOF×1, BALCONY×1 | 5 | same hash | same hash | 640 | 0 / 0 | 3/3 | 1/1 | GABLE |
| exterior-loggia | PASS | LOGGIA | ROOF×1, LOGGIA×1 | 5 | same hash | same hash | 484 | 0 / 0 | 4/4 | 1/1 | GABLE |
| exterior-terrace | PASS | TERRACE | ROOF×1, TERRACE×1 | 4 | same hash | same hash | 256 | 0 / 0 | 3/3 | 1/1 | GABLE |
| exterior-entrance-canopy | PASS | CANOPY, COLUMN, BEAM, ENTRANCE, EXTERIOR_STEPS | ROOF×2, CANOPY×1, ENTRANCE×1 | 12 | same hash | same hash | 324 | 0 / 0 | 11/11 | 1/1 | FLAT, GABLE |
| exterior-carport | PASS | CARPORT, COLUMN, BEAM | ROOF×2, CARPORT×1 | 9 | same hash | same hash | 232 | 0 / 0 | 9/9 | 1/1 | SHED, GABLE |
| exterior-pergola | PASS | PERGOLA, TERRACE, BEAM | ROOF×1, PERGOLA×1, TERRACE×1 | 21 | same hash | same hash | 388 | 0 / 0 | 21/21 | 1/1 | GABLE |
| exterior-open-canopy | PASS | CANOPY, COLUMN, BEAM, ROOF_GABLE | ROOF×2, CANOPY×1 | 13 | same hash | same hash | 268 | 0 / 0 | 13/13 | 2/2 | GABLE, GABLE |
| exterior-entrance-steps | PASS | EXTERIOR_STEPS, ENTRANCE, HANDRAIL | ROOF×1, ENTRANCE×2, EXTERIOR_STAIR×1 | 9 | same hash | same hash | 440 | 0 / 0 | 6/6 | 1/1 | GABLE |
| unknown-feature | PASS | UNKNOWN_ASSEMBLY | ROOF×1, UNKNOWN×1 | 2 | same hash | same hash | 316 | 0 / 0 | 2/2 | 1/1 | GABLE |
