# BUILDPLAN-ANALYZER-005Y-N7 — geometria ze źródła i zespoły architektoniczne

**Werdykt: OWNER_VISUAL_PENDING.** Ukryty dom OWNER-a: **OWNER_ONLY_HIDDEN_REGRESSION** — mechanizm naprawy
`WALLS_OVERLAP` jest zaimplementowany i sprawdzony na przypadkach syntetycznych i pochodnych z korpusu, ale **nie
odtworzono** awarii tego domu (nie był dostępny). Czy ją usuwa, rozstrzyga dopiero przebieg OWNER-a.

Baza `cf472b5`, gałąź `analyzer/005y-n4-general-architectural-understanding-v1`; gałęzie domyślna i lustrzana bez zmian.

## Co zrobiono — w kolejności priorytetu

### A. WALLS_OVERLAP: usunięta przyczyna, nie kontrola

Walidator modelu jest nietknięty (`WALL_OVERLAP_AREA_LIMIT = 1e-6`). Zmienia się to, co dzieje się, gdy model odrzuca
ścianę **wyłącznie** za nakładanie:

- `v2/wall-reconciliation.ts` (czysta geometria) klasyfikuje parę: `END_INTO_BAND` (koniec ściany w paśmie drugiej
  albo przez nią o nie więcej niż tolerancja), `PARALLEL_OVERLAP`, `HOST_END_INTO_BAND`, `COINCIDENT_BAND` (to samo
  pasmo odczytane dwa razy / ściana wspólna dwóch brył), `CROSSING`.
- Naprawa rusza tylko **słabszą** ścianę (wewnętrzna przed zewnętrzną, późniejsze polecenie przed wcześniejszym),
  tylko **na lico** mocniejszej: przycięcie końca do bliższego lica (złącze, które rysuje rzut), przesunięcie o nie
  więcej niż tolerancja, duplikat budowany raz (otwory przeniesione na ścianę, która stoi), krawędź pierścienia
  przesunięta na lico albo pierścień otwarty w osobne ściany, gdy jego krawędź **jest** pasmem innej ściany.
- Tolerancja wynika z dowodu: 3 px × m/px najgrubszego rzutu (linia lica ~2 px + zaokrąglenie ramki), np. 6,1 cm
  dla A01. Nic poza nią nie jest przesuwane.
- Ściana wewnętrzna, której nie da się umieścić, jest **pominięta i nazwana** → `PARTIAL_SOURCE_GROUNDED`; ściana
  zewnętrzna przecinająca inną → **odmowa** z parą ścian, relacją, penetracją i tolerancją w diagnostyce
  (`reconciliation`, `reconciliationWall`, `reconciliationAgainst`, `penetrationM`, `toleranceM`).
- Każda naprawa to rekord `GEOMETRY_RECONCILIATION` (przed/po, przesunięcie, tolerancja, `withinUncertainty`), krok
  solvera i — gdy coś pominięto — nazwana luka. Usługa dodaje ostrzeżenia `PREVIEW_WITH_ADJUSTMENTS` /
  `PARTIAL_SOURCE_GROUNDED` (LIMITING); telefon już je pokazuje i oznacza dom jako ograniczony.
- Program bez nakładania idzie dokładnie dawną ścieżką: **8/8 modeli bajt w bajt**.

Dowód: 18 testów jednostkowych (w tym negatywy: przejście ściany zewnętrznej przez obrys, bryła 1 m w bryle),
2 testy ostrzeżeń, oraz **111/111** przypadków stresowych z prawdziwych programów 8 domów
(`research/analyzer-005y-n7/overlap-stress.ts`): bryła dołączona 1–3 px w głąb (EDGE_MOVED), ściana wspólna
odczytana przez obie bryły (RING_OPENED), działówka w paśmie / 1 px przez lico (TRIMMED_TO_FACE), ta sama ściana
dwa razy (DUPLICATE_OMITTED), działówka 0,5 m przez obrys (OMITTED → częściowy podgląd), negatywy (ściana zewnętrzna
w poprzek, bryła 1 m w bryle) → odmowa. Każdy naprawiony model kompiluje się bez nowych błędów.

### B. crossViewResiduals

`v2/cross-view.ts`: rezydua z `verifyAgainstViews` per widok i per rodzaj (liczba, w tolerancji, mediana, najgorsze,
wartości odstające), werdykt widoku (AGREES / MIXED / DISAGREES / UNCHECKED) i co zrobiła ograniczona rekoncyliacja
(`repairFromResiduals`, maks. 2 iteracje — bez zmian). Moduł niczego nie przesuwa; modele 8/8 bez zmian. Wyniki:
Marcówki — przód/tył MIXED (26/29, 19/27), prawa AGREES; Rarytasy — wszystkie 4 elewacje DISAGREES (naprawa
odmówiła 7 ruchów); A01 — prawa DISAGREES (2/6); Goździkowce i Cieszynianki — **żadna elewacja nie jest
zarejestrowana**, więc nie ma z czym porównać (UNCHECKED). **Nie zrobiono** łącznej rekoncyliacji zmiennych o niskiej
pewności między widokami ponad istniejącą — to zostaje otwarte.

### C. Zespoły architektoniczne (generyczne, bez stałych per dom)

| zespół | reguła | pozytywy | negatywy |
|---|---|---|---|
| BALKON wysunięty + balustrada | rzut kondygnacji: drzwi do podłogi w licu; linia 0,6–3 m od lica pokrywająca drzwi; powroty do lica na obu końcach i linia kończy się na nich (okap i łańcuchy biegną dalej) | Goździkowce zachód 1,71–7,82 × 1,06 m (rzut ≈1,71–7,80); Sasankach 3 przód 1,42–6,32 × 1,09, tył 1,09–6,67 × 1,11 | Goździkowce wschód (porte-fenêtre bez obrysu); sam okap; linia bez powrotów; drzwi poza obrysem |
| ZADASZONY TARAS w narożu | pasmo ściany nie narysowane wzdłuż obu lic od narożnika (≥1,2 m, ≤75 % lica); ściana tylna grubości ścian zewnętrznych tam, gdzie kończą się otwarte odcinki; brak pokoju z etykietą w środku | Cieszynianki tył-zachód 2,65 × 4,71 m (rzut 2,60 × 4,70), słup w narożu | narożne przeszklenia A01/Rarytasów/Goździkowców (brak grubej ściany za nimi); pokój w środku; narożnik zamknięty |
| PERGOLA | ≥3 pełne kwadraty 0,1–0,4 m poza bryłą w narożach prostokąta ≥1,5 m przylegającego do lica | A01 zachód 3,28 × 5,76 m, 7 słupów (belka elewacji ≈5,8 m); Trytomach tył 7,1 × 2,6 m, 6 słupów | słupy w jednej linii (Rarytasy), rama oderwana od lica, kwadraty za duże |

Wymiary w planie: `SOURCE_DERIVED`. Grubość płyty balkonu 0,2 m, balustrada 1,1 m, wysokość pergoli 2,5 m, przekrój
belek, wysokość przejścia tarasu: `DISPLAY_ASSUMPTION`, nazwane w dowodach modelu.

**Nie wdrożono:** daszek wejściowy — czytnik (obrys na rzucie + krawędź elewacji kończąca się na obrysie) powstał i
został usunięty, bo żaden przypadek w korpusie go nie przeszedł (obrys A01 dzieli krawędź z nawierzchnią; rzut
Rarytasów nie rysuje obrysu). Wysunięte narożne przeszklenie kuchni (Goździkowce), przeszklenie szczytu / ekran
lamelowy (Marcówki), druga warstwa okładzin — nie podjęte w N7.

## Tabela: OBJAW → PIERWSZE ZŁE → ZMIANA ALGORYTMU → DOWÓD ŹRÓDŁA → TEST NEGATYWNY → WYNIK

| objaw | first bad | zmiana | dowód źródła | test negatywny | model / scena |
|---|---|---|---|---|---|
| `model emission failed; WALLS_OVERLAP` (dom OWNER-a) | pierwsze `createWall`/`createWallRing`, które model odrzuca | `reconcileWallOverlaps` przed dopasowaniem otworów | tolerancja z m/px rzutu | przejście ściany zewnętrznej, bryła 1 m w bryle → odmowa | 111/111 stres; 8/8 bez zmian |
| brak balkonu Goździkowców | balkony tylko z wnęki (`recesses`) | `readBalconyOutline` z rzutu poddasza | obrys + 2×180/220 na rzucie, szkło na elewacji | wschód z porte-fenêtre bez obrysu | balkon + balustrada szklana; Sasankach 3 dwa balkony |
| taras Cieszynianek zamknięty, „okno" 4,23 m | ciało = prostokąt, otwarte boki = okna | `readCornerNotch` + dwie kieszenie z otwartym narożem | brak pasma ściany, gruba ściana tylna, słup | narożne przeszklenia A01/Rary/Gozd | naroże otwarte pod dachem, słup |
| brak pergoli A01 | nic nie czytało słupów poza ścianami | `findPosts` + `pergolaFromPosts` | 7 kwadratów na rzucie, belka ≈5,8 m na elewacji | słupy w linii (Rarytasy) | rama 7 słupów; Trytomach 6 słupów |

## Przebiegi produkcyjne (OFFLINE, recogniser, jak na telefonie)

| dom | N6 | N7 | zmiana |
|---|---|---|---|
| A01 | c9d774e4 | a6849073 | pergola |
| Goździkowce | a21ad79e | 852c257a | balkon zachodni |
| Marcówki | d8ec95cf | d8ec95cf | — |
| Cieszynianki | 675c0850 | 5394c17c | taras w narożu |
| Rarytasy | 73969751 | 73969751 | — |
| Trytomach | 1bf237bd | d2bf0c03 | rama tarasu |
| Arganiach | 34a95a76 | 34a95a76 | — |
| Sasankach 3 | 8e4539fd | 090749f4 | 2 balkony |

Hashe produkcji = hashe powtórek solvera (te same pliki) dla wszystkich 8.

## Testy

Nowe: `wall-reconciliation-005y-n7` (18), `warnings` (+2), `projecting-balcony-005y-n7` (9), `corner-recess-005y-n7`
(5), `pergola-005y-n7` (5), `cross-view-005y-n7` (3). `packages/reconstruction` + `packages/analysis-service`: 92/92
plików zielonych. Bramki architektury: czerwone tylko znane z bazy (APK śledzony od 005T > limit rozmiaru modelu, dwie
historyczne bramki 005Q). Pełnego CI (41 zadań) nie uruchamiano — zgodnie z poleceniem.

## APK dla OWNER-a

| | |
|---|---|
| plik | `BuildPlan-owner-preview.apk` (= `BuildPlan-Model-Preview-arm64-v8a-debug.apk`), 39 658 530 B |
| SHA-256 | `7291b61537dd23b371cf4aa2e3fa72a1a570760f0d99aed544af6207b73efab2` |
| commit | `45b12b5c309e61e7bc532af7ce275801ce03bfcf` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1303** / `0.1303.0-owner` |
| ABI | arm64-v8a |
| podpis | v2, cert SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (ten sam klucz); `verify-preview-signature.sh`: ok |
| analizator w APK | `assets/local-analyzer/analyzer.mjs` sha256 `e3adc7f8…`, zawiera kod N7 (sprawdzone w paczce) |
| sceny | `mobile:export-scenes` — 7 paczek bajt w bajt jak w repozytorium |

Publikacja jako wydanie: niemożliwa z tej sesji (znane `415` proxy) — APK przekazany bezpośrednio. Instalacja
nadpisuje poprzedni podgląd (ten sam podpis, wyższy versionCode). Emulatora ani urządzenia nie było:
**ANDROID_3D_NOT_DEVICE_VERIFIED**; geometria scen sprawdzona w przeglądarce (renders-005y-n7.zip).

## Jak OWNER sprawdzi swój dom

1. Zainstaluj APK (nadpisuje poprzedni). Projekt → Import projektu → wklej adres strony ARCHON.
2. Wynik jest jednym z trzech:
   - **model bez uwag o ścianach** — nic się nie nakładało albo nakładało się poniżej ~1 px;
   - **model z ostrzeżeniem** „walls were moved to stop overlapping…" (`PREVIEW_WITH_ADJUSTMENTS`) lub „partial
     preview…" (`PARTIAL_SOURCE_GROUNDED`) — model jest, przesunięcia ≤ tolerancji są nazwane, pominięta działówka
     wymieniona z identyfikatorem;
   - **odmowa** — wtedy na karcie błędu: Udostępnij diagnostykę. Paczka zawiera błąd z parą ścian
     (`reconciliationWall`, `reconciliationAgainst`, `penetrationM`, `toleranceM`), ślad i jedną nakładkę rozkładu
     rzutu, a źródła tylko jako hashe. **Uwaga:** paczka zawiera adres strony projektu — jeśli ma pozostać anonimowa,
     usuń pole `canonicalUrl` z `diagnostics.json` przed wysłaniem.

## Poufność

Rysunki ARCHON odczytywane wyłącznie lokalnie, poza repozytorium; w repozytorium tylko kod, testy syntetyczne i
liczby. Bez zewnętrznej AI. Bez ID modelu w artefaktach.

## Otwarte

Daszek wejściowy; narożne wysunięte przeszklenie; przeszklenie szczytu i ekran lamelowy Marcówek; okładziny; łączna
rekoncyliacja między widokami; drzwi 220/240 w tylnej ścianie tarasu Cieszynianek czytane jako okno (brak odczytanego
callout-u i elewacji — nazwane jako nieustalone); orientacja dachu Sasankach 3 (sprzed N7, 4 błędy kompilacji).
