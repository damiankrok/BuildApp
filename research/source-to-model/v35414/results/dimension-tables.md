# v3.54.14 — tabela wymiarów: etykieta → LOCAL → API → przyjęte → zmierzone → werdykt

Wiersze NOT_MATCHED (API nie podało wymiaru przy etykiecie LOCAL) pominięte; ich liczby są w raporcie.

### Bakopy (DEV) — L-M, resolver 1.0.0 (z 1.1.0 ten sam hash modelu)

| etykieta | LOCAL | API | decyzja | przyjęte przez warstwę metryczną | zmierzone w modelu | werdykt |
|---|---|---|---|---|---|---|
| L1 | 080 | 690 | CORRECTED | 690 (APPLIED) | — | poprawione, świadek SCALE |
| L2 | 088 | 860 | CORRECTED | 860 (APPLIED) | — | poprawione, świadek SCALE |
| L4 | 191 | 184 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L5 | 581 | 180 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L9 | 401 | 140 | CORRECTED | 140 (APPLIED) | — | poprawione, świadek SCALE |
| L10 | 0051 | 1500 | CORRECTED | 1500 (APPLIED) | 14.919 m (obrys X; druk 15,00 — strata w budowie obrysu) | poprawione, świadek SCALE |
| L12 | 810 | 810 | AGREES | 810 (APPLIED) | — | zgodne |
| L13 | 014 | 640 | CORRECTED | 640 (APPLIED) | — | poprawione, świadek SCALE |
| L15 | 837 | 448 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L19 | 049 | 640 | CORRECTED | 640 (APPLIED) | — | poprawione, świadek SCALE |
| L20 | 048 | 860 | CORRECTED | 860 (APPLIED) | — | poprawione, świadek SCALE |
| L21 | 044 | 660 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L25 | 014 | 600 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L26 | 854 | 458 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L39 | 53 | 125 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L42 | 149 | 149 | AGREES | 149 (APPLIED) | — | zgodne |
| L43 | 171 | 171 | AGREES | 171 (APPLIED) | — | zgodne |
| L46 | 2125 | 2125 | AGREES | 2125 (APPLIED) | — | zgodne |
| L51 | 1330 | 445 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L59 | 152 | 253 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L65 | 479 | 625 | CORRECTED | 625 (APPLIED) | — | poprawione, świadek SCALE |
| L77 | 471 | 326 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L105 | 75 | 341 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| L114 | 380 | 380 | AGREES | 380 (APPLIED) | — | zgodne |
| span | — | 50 | NEW_SPAN | ? (REFUSED) | — | nowy odcinek |

### Ballina (nowy) — pierwszy bieg zamrożony, resolver 1.0.0

| etykieta | LOCAL | API | decyzja | przyjęte przez warstwę metryczną | zmierzone w modelu | werdykt |
|---|---|---|---|---|---|---|
| L12 | 518 | 815 | UNRESOLVED | — (LOCAL zostaje) | — | nierozstrzygnięte (brak świadka) |
| span | — | 1365 | NEW_SPAN | 1365 (REFUSED) | — | nowy odcinek |

### Ballina — po zamrożeniu, resolver 1.1.0

| etykieta | LOCAL | API | decyzja | przyjęte przez warstwę metryczną | zmierzone w modelu | werdykt |
|---|---|---|---|---|---|---|
| L12 | 518 | 815 | CORRECTED | 815 (APPLIED) | 8.150 m (obrys Z) | poprawione, świadek FOOTPRINT |
| span | — | 1365 | NEW_SPAN | 1365 (ADMITTED) | 13.650 m (obrys X) | nowy odcinek |
