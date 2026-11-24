# NEW-D — pierwszy pomiar na kodzie APK 1351 (`58ff26a`, drzewo `9ac25b6`), zanim zmieniono cokolwiek w analizie (2026-11-24)

Jeden bieg na żywo na dom, transport hosta. Pierwszy wynik zostaje wynikiem; od tej chwili domy są rozwojowe.
Rendery i rysunki: prywatne (`rd/v35419/base/<dom>`), w dostawie jako wariant „1351".

| Dom | Model | Zewnętrze (moja ocena cech z `references/NEW-D.md`) | Ściany INTERIOR | Co zawiodło |
|---|---|---|---:|---|
| Aletta New | bryła ze źródeł (LOCAL: brak skali), 2 bryły w linii, oba dachy dwuspadowe | F1–F3 OK; S1 OK; brak bramy garażowej (O1 KEY); wejście i okna frontu OK; szczyt od tarasu pusty | 0 | wnętrze puste; brama; podwójna ściana między bryłami |
| Novara | LOCAL stoi (bez sprzeczności), 3 masy: dach dwuspadowy + 2 płaskie pudełka | F2 OK, F1 częściowo (wnęka jako osobne pudło); front i tył rozpoznawalne; szczyt prawy pusty | 13 | drobne: płaskie pudła, szczyt prawy |
| Jarzębina | LOCAL stoi, **bez dachu**, 2 poziomy jako płaskie pudło | F2 ZŁA (brak dachu), F1 ZŁA; pasy okien-widm na piętrze | 1 | skala z powierzchni zabudowy niepotwierdzona wysokością → bryła ze źródeł nie powstała; LOCAL bez dachu |
| Willa Eliza 5 G2 | **brak modelu** | — | — | LOCAL: RECONSTRUCTION_FAILED; obrys 10 narożników „poza zakresem (prostokąt lub L)" |

Cały wynik (E użyteczna i W zgodne) na baseline: **0 z 4** według mojej oceny (Novara ma oba składniki najbliżej: do
rozstrzygnięcia przez oceniającego na nakładce). Koszt czterech biegów: 0,99 USD.

Co ten pomiar mówi o kolejności prac (zapisane przed strojeniem):
1. wnętrze znika lub nie powstaje zawsze, gdy bryła jest budowana ze źródeł (Aletta) — to samo co na 6 z 9 domów DEV;
2. dom bez rozstrzygniętej skali kończy bez dachu albo bez modelu (Jarzębina) — arbitraż nie ma dobrego kandydata;
3. obrys o więcej niż 6 narożnikach = brak modelu (Eliza) — gramatyka bryły;
4. brama/wejście odrzucane przy elewacjach-renderach (Aletta).
