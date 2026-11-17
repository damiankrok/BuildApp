| dom | runda | propozycja | stan | kod | funkcja (konsument) | skutek |
|---|---|---|---|---|---|---|
| -archon-dom-w-majeranku-2-g2 | 1 | SET_FEATURE balcony_right | REJECTED | PARSE_REJECTED | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | a feature needs an id, a kind this builder has and a box |
| architecturaldesigns-22192sl | 1 | ADD_OPENING el-p6/o10 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-rear-10: OPENINGS_OVERLAP: openings opening-rear-10 and opening-rear-5 overlap on wall w-main-4 |
| architecturaldesigns-22192sl | 1 | ADD_OPENING el-p6/o10 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-rear-10: OPENINGS_OVERLAP: openings opening-rear-10 and opening-rear-6 overlap on wall w-main-6 |
| architecturaldesigns-22192sl | 1 | ADD_OPENING el-p6/o10 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-rear-10: OPENINGS_OVERLAP: openings opening-rear-10 and opening-rear-7 overlap on wall w-main-8 |
| ertuniach-2-e-m9022920a5fcb6 | 1 | SET_ROOF roof of main | REJECTED | NOT_CONSUMED | resolveHouse/roofs → houseProgram/roofPlanes | the built model is the same with it: the correction reached no geometry |
| ertuniach-2-e-m9022920a5fcb6 | 1 | SET_ROOF roof of main | REJECTED | NOT_CONSUMED | resolveHouse/roofs → houseProgram/roofPlanes | the built model is the same with it: the correction reached no geometry |
| toreniach-3-e-me822857280738 | 1 | ADD_OPENING el-p6/o1 (corrected) | APPLIED | — | resolveHouse/openings → houseProgram/cutOpening | model adb5e0bf9e → f22c13e79e; failing checks 0 → 0; held or refused 10 → 10; meshes 30 → 30 |
| toreniach-3-e-me822857280738 | 2 | REVIEW the whole round | REJECTED | NOT_SENT | reviewHouse | the house stands as built |
| final-domywstylu-madera | 1 | SET_ELEVATION_BODY el-p2 body main | REJECTED | COMPILE_CONFLICT | resolveHouse/registration+heights | with it 1 more object(s) are held or refused by the builder than before |
| final-domywstylu-madera | 1 | SET_ELEVATION_BODY el-p2 body garage | REJECTED | NOT_CONSUMED | resolveHouse/registration+heights | the built model is the same with it: the correction reached no geometry |
| final-domywstylu-madera | 1 | SET_FEATURE el-p2/f1 | REJECTED | NOT_CONSUMED | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | the built model is the same with it: the correction reached no geometry |
| nal-archon-dom-w-aksamitkach | 1 | SET_FEATURE el-p11/f1 | REJECTED | COMPILE_CONFLICT | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | with it 6 more object(s) are held or refused by the builder than before |

Razem: APPLIED : 1; REJECTED COMPILE_CONFLICT: 5; REJECTED NOT_CONSUMED: 4; REJECTED NOT_SENT: 1; REJECTED PARSE_REJECTED: 1
