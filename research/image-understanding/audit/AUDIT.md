# IU-01 §1 — audyt istniejącej klasyfikacji obrazów (stan `d94b1c1`, N7-COUNCIL-FIX-01)

Kod produkcyjny nie był zmieniany. Wszystkie odtworzenia uruchomiono na `d94b1c1`; kod ról
(`archon.ts`, `roles.ts`, `discovery.ts`, `acquire.ts`) jest bajtowo ten sam co w bazie 005R (`git log 39061db..HEAD`
dla tych plików jest pusty), więc trasy produkcyjne zmierzone w 005R (`V0a-routes.json`) są bieżącym zachowaniem.

## Gdzie obraz dostaje rolę

| miejsce | co robi | z czego |
| --- | --- | --- |
| `source-package/src/adapters/archon.ts` `archonRoleClaims()` | roszczenia `document / storey / view / annotation` | **tylko tekst**: slug pliku (wyrażenia regularne, pierwsza pasująca reguła wygrywa), podpis (×0,85), kanał (`FLOOR_PLAN_ATTR`, `IMG_SRC`), ścieżka fragmentu piętra (`/product_fancybox_floor/<id>/1→GROUND, 3→ATTIC`) |
| `source-package/src/roles.ts` `mergeRoleClaims()` | wybór roszczenia o najwyższej pewności per wymiar; remis sprzecznych → UNKNOWN | roszczenia wyżej |
| `roles.ts` `normalizeRoles()` / `projectionForDocument()` | `ProjectionRole` wyprowadzone z `DocumentRole` (ELEVATION→ORTHOGRAPHIC_ELEVATION, PERSPECTIVE_RENDER→PERSPECTIVE) | rola dokumentu, nie piksele |
| `source-package/src/acquire.ts` `buildAssets()` / `makeAsset()` | łączy kopie w zasób (union-find: klucz adaptera, bajty identyczne) i scala roszczenia ze wszystkich kanałów | j.w. |
| `source-package/src/router.ts` | wybór **adaptera strony** (specjalista / generyczny) — nie klasyfikuje obrazów | URL, HTML |
| `source-vision/src/tasks.ts` `readsAsFacade()` | ekstraktory fasady dostają `document == ELEVATION` albo `PERSPECTIVE_RENDER` z rzutem ortogonalnym | role |
| `source-analyzer/src/analyze.ts:125-190` | routing ekstraktorów: ELEVATION→fasada, FLOOR_PLAN→rzut, SECTION→przekrój, UNKNOWN/CHROME→pominięte | role |
| `analysis-service/src/run.ts:155-157` | `DRAWING_DOCUMENTS` / `TECHNICAL_DOCUMENTS` — liczenie i bramka „czy jest z czego budować” | role |
| `reconstruction/src/views.ts` `chooseSide()` | strona elewacji: etykieta wydawcy (FRONT/REAR) **przyjmowana bez kontroli**; inaczej szerokość sylwetki | `roles.view` |
| `reconstruction/src/v2/reconstruct-v2.ts:1950` | **każdy** `PERSPECTIVE` trafia do solvera kamery zewnętrznej (także wnętrza) | `roles.projection` |
| `reconstruction/src/v2/view-audit.ts`, `solver-recorder.ts` `viewFamilyOf()` | rodzina widoku z `projection` | role |
| `reconstruction/src/layout.ts` `readPlans` / `planStoreyOf` | kondygnacja rzutu z `roles.storey`, kopia bazowa po `annotation` | role |

Wniosek: **żaden etap produkcyjny nie patrzy na piksele, zanim nada obrazowi rolę.** `DocumentRole` nie ma wnętrza ani
„innego” — wnętrze staje się `PERSPECTIVE_RENDER`, a więc kandydatem solvera kamery zewnętrznej.

## Odtworzenia

| Council | odtworzenie (na `d94b1c1`) | wynik |
| --- | --- | --- |
| A-1 kopie jednego rzutu | `research/analyzer-n7-council/A/plan-regs.ts marcowki` | poddasze Marcówek: dwie kopie 853 px tego samego rysunku dają 3,697 i 1,039 cm/px; kopie 550/400 px bez rejestracji. Zasoby są niezależne, nikt nie porównuje skal. **Odtworzone.** |
| A-2 / A-6 etykiety kondygnacji, słownik | `research/analyzer-n7-council/A/roles-hazards.ts` | 8/11 BAD: „plan-sytuacyjny”→FLOOR_PLAN; „parterowy” w nazwie projektu → rzut poddasza = GROUND; fragment /3 → ATTIC dla „piętra” (rekonstrukcja widzi 3 kondygnacje zamiast 2); fragment /1 → GROUND dla piwnicy; dwa kanały tego samego URL nie dają konfliktu. **Odtworzone.** |
| A-5 FRONT/REAR bez kontroli | `research/analyzer-n7-council/A/mutate.ts marcowki none,swapFR` | zamiana etykiet daje inny model (`8541ca10` → `32000cd3`), wszystkie widoki `REGISTERED`, żadna odmowa ani flaga. **Odtworzone.** |
| (nowe) negatywne przypadki briefu §9 na ścieżce tekstowej | `research/image-understanding/audit/metadata-hazards.ts` | **8/11 UNSAFE**: wnętrze z podpisem „elewacja” → `FACADE_EXTRACTORS`; wnętrze ze slugiem „elewacja-ogrodowa” → fasada; perspektywa „wizualizacja-elewacji-frontowej” → fasada (reguła „elewacja” stoi przed „wizualizacja”); „wizualizacja-salonu” → `PERSPECTIVE` → solver kamery zewnętrznej; rzut poddasza podpisany „parter” → GROUND; przekrój podpisany „elewacja-boczna” → fasada; kolaż „elewacje” → fasada; „plan-sytuacyjny” → rzut. Bezpieczne tylko: „widok od frontu”, brak podpisu (UNKNOWN, obraz pominięty przez analizator), „detal” (brak reguły → UNKNOWN). |

Na prawdziwym korpusie (1352 obrazy ARCHON, etykiety IU-01) produkcja daje `PERSPECTIVE_RENDER` 198 wnętrzom i 158
widokom zewnętrznym bez rozróżnienia, a 251 obrazów karuzeli w ogóle nie trafia do pakietu (`NOT_ACQUIRED`). Elewacje
(396/396), rzuty, przekroje i sytuacje są przez nią opisane poprawnie — na tym wydawcy słowa w adresie są wiarygodne.
Ryzyko leży w przypadkach, w których słowo nie pasuje do obrazu, a takich na żywym korpusie jest co najmniej 15
(widoki zewnętrzne w karuzeli wnętrz).
