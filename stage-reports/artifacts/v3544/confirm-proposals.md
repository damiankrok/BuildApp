| dom | runda | propozycja | stan | kod | funkcja (konsument) | skutek |
|---|---|---|---|---|---|---|
| c4-archon-lubczyku-2 | 1 | SET_FEATURE front-wall-dormer | REJECTED | PARSE_REJECTED | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | a feature needs an id, a kind this builder has and a box |
| c4-archon-lubczyku-2 | 1 | SET_FEATURE el-p11/front-balcony | APPLIED | — | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | model 59373d0b38 → 2a7bd18ba6; failing checks 0 → 0; held or refused 7 → 7; meshes 40 → 44 |
| c4-archon-lubczyku-2 | 1 | ADD_OPENING el-p11/o8 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-front-7: OPENINGS_OVERLAP: openings opening-front-7 and opening-front-6 overlap on wall w-main-0 |
| c4-archon-lubczyku-2 | 1 | ADD_OPENING el-p11/o8 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-front-7: OPENING_IN_JUNCTION_ZONE: opening opening-front-7 spans 0.450..1.006 m along wall w-main-bay-3, but junctions leave that w |
| c4-archon-lubczyku-2 | 2 | SET_FEATURE el-p11/front-dormer | APPLIED | — | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | model 2a7bd18ba6 → 2756aa0ec3; failing checks 0 → 0; held or refused 7 → 5; meshes 44 → 51 |
| c4-archon-lubczyku-2 | 2 | SET_FEATURE rear-dormer | REJECTED | WRONG_BINDING | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | picture 4 is not an elevation that was read |
| c4-archon-lubczyku-2 | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |
| c4-archon-lubczyku-2 | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |
| c4-archon-lubczyku-2 | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |
| c4-archon-lubczyku-2 | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |
| c4-archon-lubczyku-2 | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |
| c4-archon-lubczyku-2 | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |
| c4-archon-lubczyku-2 | 2 | ADD_OPENING el-p11/o8 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-front-7: OPENING_IN_JUNCTION_ZONE: opening opening-front-7 spans 0.450..1.006 m along wall w-main-bay-3, but junctions leave that w |
| c4-archon-lubczyku-2 | 2 | ADD_OPENING el-p11/o8 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-front-7: OPENINGS_OVERLAP: openings opening-front-7 and opening-front-6 overlap on wall w-main-0 |
| c4-archon-lubczyku-2 | 2 | ADD_OPENING picture 1 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 1 is not an elevation that was read |
| c4-archon-lubczyku-2 | 2 | ADD_OPENING picture 1 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 1 is not an elevation that was read |
| c4-archon-frizeach-g2e | 1 | SET_ELEVATION_BODY garage | REJECTED | WRONG_BINDING | resolveHouse/registration+heights | no body garage on the plan, or no wall ends |
| c4-archon-frizeach-g2e | 1 | SET_ELEVATION_BODY main | REJECTED | WRONG_BINDING | resolveHouse/registration+heights | no body main on the plan, or no wall ends |
| c4-dobredomy-abakus | 1 | ADD_OPENING el-p3/o4 | REJECTED | HELD_BY_DEPENDENCY | resolveHouse/openings → houseProgram/cutOpening | not built: el-p3/o4: elevation el-p3: the ridge row gives +7.33 m at the along scale; the section prints +6.36 m |
| c4-dobredomy-abakus | 1 | ADD_OPENING el-p3/o4 | REJECTED | HELD_BY_DEPENDENCY | resolveHouse/openings → houseProgram/cutOpening | not built: el-p3/o4: elevation el-p3: the ridge row gives +7.33 m at the along scale; the section prints +6.36 m |
| c4-dobredomy-pallas | 1 | SET_FEATURE el-p3/balcony1 | APPLIED | — | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | model cc72448b52 → b775baef01; failing checks 0 → 0; held or refused 2 → 2; meshes 26 → 30 |
| c4-dobredomy-pallas | 1 | SET_FEATURE dormer-left | REJECTED | WRONG_BINDING | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 1 | SET_FEATURE dormer-right | REJECTED | WRONG_BINDING | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 1 | SET_FEATURE entry-canopy | REJECTED | WRONG_BINDING | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 1 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 1 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 1 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 1 | SET_ROOF roof of garage | APPLIED | — | resolveHouse/roofs → houseProgram/roofPlanes | model b775baef01 → e302aefc24; failing checks 0 → 0; held or refused 2 → 2; meshes 30 → 30 |
| c4-dobredomy-pallas | 2 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 2 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 2 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 2 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 2 | SET_FEATURE dormerL | REJECTED | WRONG_BINDING | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 2 | SET_FEATURE dormerR | REJECTED | WRONG_BINDING | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 2 | SET_FEATURE entrance_gable | REJECTED | WRONG_BINDING | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | picture 3 is not an elevation that was read |
| c4-dobredomy-pallas | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |
| c4-lipinscy-oslo | 1 | REMOVE_OPENING opening-rear-3 | REJECTED | WRONG_BINDING | resolveHouse/openings | picture undefined is not an elevation that was read |
| c4-lipinscy-oslo | 1 | SET_FEATURE dormer_rear | REJECTED | PARSE_REJECTED | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | a feature needs an id, a kind this builder has and a box |
| c4-lipinscy-dublin | 1 | ADD_OPENING el-p8/o9 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-rear-7: OPENINGS_OVERLAP: openings opening-rear-7 and opening-rear-5 overlap on wall w-main-6 |
| c4-lipinscy-dublin | 1 | ADD_OPENING el-p8/o9 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-rear-7: OPENINGS_OVERLAP: openings opening-rear-7 and opening-rear-5 overlap on wall w-main-6 |
| c4-studioatrium-wena | 1 | SET_FEATURE el-p3/bal1 | APPLIED | — | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | model 8c89a3a1db → 767389a1c8; failing checks 0 → 0; held or refused 2 → 2; meshes 25 → 29 |
| c4-studioatrium-wena | 1 | SET_FEATURE el-p3/bal2 | APPLIED | — | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | model 767389a1c8 → 95914623a9; failing checks 0 → 0; held or refused 2 → 2; meshes 29 → 33 |
| c4-studioatrium-wena | 1 | ADD_OPENING picture 2 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 2 is not an elevation that was read |
| c4-studioatrium-wena | 1 | ADD_OPENING picture 2 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 2 is not an elevation that was read |
| c4-studioatrium-wena | 1 | ADD_OPENING picture 2 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 2 is not an elevation that was read |
| c4-studioatrium-wena | 1 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 3 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 3 is not an elevation that was read |
| c4-studioatrium-wena | 2 | SET_FEATURE bal3 | REJECTED | WRONG_BINDING | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | picture 3 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 2 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 2 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 2 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 2 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 2 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 2 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |
| c4-studioatrium-wena | 2 | ADD_OPENING picture 4 | REJECTED | WRONG_BINDING | resolveHouse/openings → houseProgram/cutOpening | picture 4 is not an elevation that was read |

Razem: APPLIED : 6; REJECTED COMPILE_CONFLICT: 6; REJECTED HELD_BY_DEPENDENCY: 2; REJECTED PARSE_REJECTED: 2; REJECTED WRONG_BINDING: 42
