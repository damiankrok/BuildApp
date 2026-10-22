# N7-COUNCIL-001 — kolejność napraw (bez implementacji)

Zasada: naprawiać przyczynę źródłową (R w `COUNCIL_CAUSAL_GRAPH.md`), nie objaw. Każda poprawka przychodzi z testem,
który dziś przechodzi nieprawidłowo albo nie istnieje. Każda musi zachować bajt w bajt 8 domów korpusu (przypadek H),
chyba że zmiana jest udowodniona dowodem.

## Trzy pierwsze poprawki (rekomendacja Council)

### 1. Pasmo ściany odporne na otwory i ramy od grubości gospodarza

Usuwa F-R1, D-3, E-1 (R4).

- `thin-body.ts`: w profilu ściany przerwy objaśnione przez otwory rzutu (te same `planGaps`/callouty, które czyta
  `readWallOpenings`) liczyć jako ścianę. Pasmo ma być „ciągłe po odjęciu otworów”, a nie „60 % tuszu”.
- Elewacja może potwierdzać tylko tuszem krawędzi lub ściany w paśmie kondygnacji, nie brakiem nieba. Widok nie może
  być jedyną podporą WIDEN.
- Bryłę, która zniknęła lub została KEEP_PARTIAL przy wydrukowanym łańcuchu albo zamkniętych ścianach, zawsze nazwać.
- `emit.ts`: `frameWithinWall(kind, tOf(mass))` dla okien, drzwi i drzwi wspólnych.
- **Testy:**
  - THINWALL z 1, 2 i 4 oknami (dziś: wycięcie, KEEP_PARTIAL, zniknięcie);
  - E `thin-body-sky.ts` jako test jednostkowy (drzewa i bryła z tyłu nie potwierdzają).
- **Dlaczego pierwsza:** najbardziej naturalna droga do dokładnej sygnatury OWNER-a, czyli dobudowy z oknami w dalekiej
  ścianie. Działa przed emisją.

### 2. Jedno źródło grubości i jedna bramka „pierścień ≥ 2t” tam, gdzie pierścień powstaje

Usuwa B-1, B-2, D-1, D-2/C-4 (R2 + R5).

- T z pasm lic zewnętrznych (nie mediana wszystkich pasm), per bryła tam, gdzie lica bryły różnią się od domu. Wynik
  zapisany z proweniencją; fallback 0,38 z wpisem.
- `layout.ts` bramkuje bryły tą samą wartością co emisja (`wallM` = T).
- Adjudykacja cienkiej bryły na każdym prostokącie, który emisja zbuduje: `rectAt` dla każdej kondygnacji, pieces,
  MAIN.
- `candidate.ts` `repairRing`:
  - przesunięcie krawędzi odrzucić, gdy zmniejsza `min(w, d)` poniżej 2·t; w zamian nazwać kolizję;
  - `fitPreviewProgram` zachowuje zapisy pierwszej nieudanej próby.
- **Testy:**
  - gozd: T = lica 0,43 (dziś 0,30);
  - D `h2` (szerokość 0,62, dziś zwężenie);
  - D `h1` (`storeyRect`, piece);
  - test zgodności `wallM` layoutu z T.

### 3. Dekompozycja rzutu nie przekracza narysowanych ścian i nie gubi zamkniętych obszarów

Usuwa C-1, C-2, C-3, C-8, A-1 (R3 + R1).

- `mergeRegions`: kafel nie przechodzi przez ciągłe pasmo ściany.
- `decomposeCore`: duże otwory domykane przed flood fillem; obszar otoczony ścianami, który nie stał się bryłą, jest
  nazwany.
- Bramka layoutu BLOCKING nie może dawać COMPLETE.
- Kopie jednego rzutu rozstrzygane razem: zgodność skal, wybór kopii bazowej po rejestracji, a nie po etykiecie.
- **Testy:**
  - C `probe-merge` (garaż nie wcielony);
  - `probe-tiling gb-setback-door` (garaż obecny albo nazwany);
  - A `mutate.ts marcowki undimension` (brak odmowy).

## Dalsza kolejność

| # | co | ustalenia | uwagi |
|---|---|---|---|
| 4 | Zapisać i pokazać na telefonie wersję solvera i bundla przy wyniku; pokazać listę nierozstrzygniętych po restarcie; jednoznaczne etykiety liczników (bryły z layoutu / pierścienie w modelu, otwory odczytane / zbudowane) | F-2, F-6 | warunek weryfikacji poprawek 1–3 na benchmarku OWNER-a; tani, bez wpływu na geometrię |
| 5 | Bramka gruntu dla wszystkich rejestracji przed odczytem wysokości otworów; druga oś dla bocznych elewacji | E-3, E-4, B-6 | rozbieżność z elewacjami |
| 6 | Weryfikacja na niezależnej krawędzi; raporty elewacyjne liczone po `fitPreviewProgram`; CONFIRMED_MATCH tylko z wysokością albo pod inną nazwą | E-2, E-7, E-9 | wiarygodność raportu |
| 7 | SHARED_WALL tylko przy pełnym pokryciu; grupowanie ścian bryły SHARED_WALL w podglądzie; ochrona odwołań do ściany otwartej strony | D-4, D-5, D §6 | obwiednia |
| 8 | INCONCLUSIVE nigdy nie jest PRINTED_SCALE; `corroborated` liczony naprawdę; kontrola offsetu i skali rejestracji piętra licami | B-4, A-8, B-5 | skala kondygnacji |
| 9 | Weryfikacja etykiet kondygnacji i stron przez geometrię; poprawki słownika ARCHON | A-2, A-5, A-6, A-9 | źródło |
| 10 | Po WIDEN: rejestracja, głos dachu i cecha MASS od nowa; proweniencja zgodna z dowodem; test WIDEN przez emisję | D §8, F-3 | — |

Nie tworzę APK 1307 i nie zaczynam implementacji ani P3 bez polecenia OWNER-a.
