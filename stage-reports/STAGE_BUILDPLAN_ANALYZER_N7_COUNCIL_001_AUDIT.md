# BUILDPLAN-ANALYZER N7-COUNCIL-001 — audyt całej ścieżki produkcyjnej

Etap audytowy: **bez poprawek kodu produkcyjnego, bez APK 1307, bez P3.** Baza `6788e7d` (P2R), gałąź
`claude/new-session-3kzcgh`.

Council składał się z sześciu naprawdę odrębnych agentów (A–F), uruchomionych równolegle. Każdy zapisał ustalenia
przed zobaczeniem cudzych. Następnie F próbował obalić ustalenia A–E. Surowe raporty leżą w
`stage-reports/artifacts/analyzer-n7-council-001/reviews/`, a harnessy diagnostyczne w
`research/analyzer-n7-council/<A–F>/`. Harnessy są wyłącznie badawcze, nie trafiają do APK i nie zapisują rastrów
wydawcy.

## Tabela ustaleń

| ID | Priorytet | FIRST_BAD | Funkcja | Dowód | Skutek dla 3D | Minimalna naprawa |
|---|---|---|---|---|---|---|
| **F-R1** | **P0** | otwory w dalekiej ścianie cienkiej bryły rozbijają test pasma ściany | `v2/thin-body.ts` `adjudicateThinBody` (`farBand` wymaga 60 % tuszu wzdłuż pasa) | CONFIRMED, synthetic e2e: THINWALL + 2 okna → CANOPY_ON_POSTS → KEEP_PARTIAL → polecenie 21 `createWallRing ring-attached-0-0` `WALLS_OVERLAP`; + 4 okna → bryła znika bez wpisu | **kształt sygnatury OWNER-a**; utrata poprawnej bryły | przerwy w ścianie, które czytnik otworów rzutu tłumaczy jako otwory, liczyć jako ścianę; utraconą bryłę nazywać |
| **D-1** | **P0** | rekoncyliacja ścian zwęża pierścień poniżej 2T **po** P2R i gubi zapis | `candidate.ts` `repairRing` → `wall-reconciliation.ts` `moveRingEdge`; `fitPreviewProgram` zachowuje raport tylko ostatniej próby | CONFIRMED na poziomie funkcji (0,62 → 0,57 m; polecenie 21, punkt kontrolny 16); pełny układ wejściowy niezreprodukowany | utrata bryły; przyczyna niewidoczna | przesunięcie krawędzi nie może zejść poniżej 2·grubości; zachować zapisy pierwszej nieudanej próby |
| **B-1/B-2** | **P1** | jedna grubość T domu (mediana pasm, także działowych); layout bramkuje bryły inną wartością (`wallM`) | `plan-decomposition.ts` `decomposePlan` → `reconstruct-v2.ts:418`; `layout.ts:1848/1950` | B-1 CONFIRMED: gozd T = 0,304 m przy licach 0,431 m. B-2 (layout `wallM` 0,22–0,29 m vs T 0,43–0,46 m w 4/8 domów) dziś maskowane podłogą 1,0 m → DESIGN_LIMITATION; jako przyczyna u OWNER-a HIGH_RISK | złe wymiary ścian i wnętrz; wąska bryła z cieńszymi ścianami odrzucana | T z pasm lic zewnętrznych, grubość per bryła; jedna wartość dla bramki layoutu i emisji |
| **D-3** | P1 | ramy okien i drzwi liczone od T domu, nie od ściany-gospodarza | `v2/emit.ts` `cutAndFill` / shared doors: `frameWithinWall(kind, b.wallThicknessM)` | CONFIRMED e2e: THINWALL + 1 okno → FILL_TOO_LARGE → podgląd częściowy | utracone otwory i cięcia podglądu | `frameWithinWall(kind, tOf(mass))` |
| **C-1** | P1 | kafelkowanie „największy prostokąt” przechodzi przez narysowane ściany | `plan-decomposition.ts` `mergeRegions` | CONFIRMED (fiksury): garaż wcielony w dom, zła liczba brył i dach; fantomowa bryła; bramka STRUCTURAL_LAYOUT_REJECTED, a wynik COMPLETE | zła liczba brył, dach, ściana tam, gdzie jej nie ma | kafelki nie mogą przekraczać ciągłego pasma ściany; BLOCKING bramki nie może dawać COMPLETE |
| **C-2** | P1 | flood fill wchodzi przez szeroką bramę cofniętego garażu | `plan-decomposition.ts` `decomposeCore` | CONFIRMED (fiksury): garaż cofnięty 0,30 m z bramą 2,4 m znika bez wpisu, wynik ACCEPTED/COMPLETE | utrata poprawnej bryły bez śladu | zamykać duże otwory przed zalewaniem; utracony obszar ze ścianami nazywać |
| **A-1** | P1 | kopie jednego rzutu (400/550/853 px, tabela powierzchni) jako niezależne zasoby, bez porównania skal | `source-package/src/acquire.ts` `buildAssets`; brak relacji plan–plan | CONFIRMED (8/8 domów): skale kopii różnią się 2–3,6×; arganiach traci poddasze | zła liczba kondygnacji, zła skala | grupować kopie jednego rysunku, rozstrzygać skalę zgodnością kopii |
| **E-3** | P1 | wysokości otworów z widoków, których grunt solver sam odrzucił | `reconstruct-v2.ts` (`viewGroundRefusals` tylko dla rejestracji sylwetką) | CONFIRMED (a01: błąd gruntu 0,42–0,71 m wchodzi do sill/head) | otwory 0,4–0,7 m za wysoko lub za nisko | ta sama bramka gruntu dla widoków z pasa ściany i z tego samego arkusza |
| **E-1** | P2 | „nie-niebo” = zabudowa (drzewa, bryły za) | `thin-body.ts` `elevationOver` | CONFIRMED funkcjonalnie z prawdziwym `skyMask` (3/7 przypadków źle) | fałszywe WIDEN | zabudowa = tusz krawędzi/ściany w paśmie, nie brak nieba; widok nie może być jedyną podporą |
| **E-2/E-7/E-9** | P2 | weryfikacja z widokami częściowo samoodniesiona; raporty sprzed cięcia podglądu | `v2/verify.ts`, `facade-alignment.ts` (liczone przed `fitPreviewProgram`) | CONFIRMED: marcówki — szerokość 8,35 m „zgodna” z widokiem; raport wymienia wycięty otwór | fałszywa zgodność; ekran opisuje inny model niż scena | weryfikacja na niezależnej krawędzi; raporty po fit |
| **E-4** | P2 | boczna elewacja odrzucona, gdy „jej” oś zajęta | `views.ts` `chooseSide` | CONFIRMED (sasankach3: obie boczne utracone) | brak 2/4 elewacji; okap 0 | druga oś jako kandydat |
| **D-2/C-4/B-3** | P2 | `thinBodies` pomija `storeyRects`, pieces i MAIN, a emisja buduje je z `rectAt` | `thin-body.ts` `thinBodies` | COVERAGE_GAP: odtworzone na emisji i walidatorze; nieosiągalne z layoutu przy T ≤ 0,5 (bramka 1,0 m) | odrzucenie bez adjudykacji | sprawdzać każdy budowany pierścień |
| **D-4** | P2 | SHARED_WALL usuwa całą stronę, choć druga bryła pokrywa > 50 % | `adjudicateThinBody` | CONFIRMED (raster syntetyczny): 2,5 m dziury w obwiedni, model zaakceptowany | otwarta obwiednia | SHARED_WALL tylko przy pełnym pokryciu |
| **F-2** | P2 | wynik zapisany na telefonie nie zawiera wersji analizatora | Android `recordOf` (gubi `summary.analyzer`) | CONFIRMED (kod) | nie da się odróżnić nowego przebiegu od starego | zapisywać i pokazywać solver i bundel |
| **A-2/A-3/A-5/A-6** | P2 | etykiety kondygnacji, wybór kopii bazowej, FRONT/REAR bez kontroli | `archon.ts`, `layout.ts` `readPlans` | CONFIRMED mutacją; wyzwalacz na realnych danych HIGH_RISK | fantomowa lub utracona kondygnacja; całkowita odmowa (marcówki bez etykiety „dimensioned”) | weryfikacja etykiet przez geometrię |
| **B-4** | P2 | fałszywy konsensus (2 kotwice, residuum 0, INCONCLUSIVE) promowany na PRINTED_SCALE | source-metrics registration; `layout.ts:839` | CONFIRMED (arganiach poddasze w skali 1/3; skutek maskowany) | zła skala kondygnacji | INCONCLUSIVE nigdy nie jest skalą drukowaną |

Pozostałe ustalenia (HIGH_RISK, DESIGN_LIMITATION, NOT_A_DEFECT) są w `COUNCIL_CONFIRMED_DEFECTS.md`.

## Werdykt Council

1. **To nie jest jedna usterka P2R.** Benchmark OWNER-a trafia w miejsce, gdzie spotykają się trzy niezależne błędne
   dane:
   - wąska dobudowana bryła odczytana z rzutu (C, A);
   - jedna, często źle wyznaczona grubość T (B);
   - adjudykator P2R, który na typowym rysunku — ściana z oknami — nie widzi ściany (F-R1).

   P2R kompensował skutek zamiast usunąć przyczynę. Przy oknach w dalekiej ścianie oddaje sprawę z powrotem do P1.
2. **Mechanizmy zgodne z ekranem OWNER-a.** Z liczników wynika dom jednopoziomowy:
   - 16 poleceń do punktu kontrolnego i polecenie 21 wymuszają 1 poziom, MAIN o jednej kondygnacji i zwykły pierścień
     attached-0 (D §0, F);
   - zatem `storeyRects` i pieces są wykluczone.

   Zgodne zostają:
   - (a) KEEP_PARTIAL z P2R — najpewniej przez F-R1, bo garaż czy pomieszczenie gospodarcze z oknami w dalekiej
     ścianie to typowy rysunek;
   - (b) D-1, czyli rekoncyliacja zwężająca pierścień po P2R;
   - (c) wynik nie z bundla 2.5.0 (zapisany albo z usługi).

   **Hash punktu kontrolnego niczego nie rozstrzyga.** Obejmuje tylko prefiks bryły głównej, więc jest identyczny we
   wszystkich trzech przypadkach (F).
3. **Jedna obserwacja rozstrzyga**, bez identyfikacji domu. Na świeżo uruchomionej analizie, w „Szczegóły analizy”:
   - solver ≠ 2.5.0 → (c);
   - solver 2.5.0 i wśród nierozstrzygniętych „the body attached-1, X m across” → (a); powód podaje, który odczyt
     zawiódł, a liczba nierozstrzygniętych rośnie o 1 względem P2 (23 vs 22 na zrzucie jest z tym zgodne, ale bez
     wersji nie jest dowodem);
   - solver 2.5.0 i brak tego wpisu → (b).
4. **Nowy APK nie uruchamia starego bundla.** Gradle zawsze przebudowuje bundel. `LocalRuntimeFiles.install()` sprawdza
   sha każdego pliku z manifestem APK i usuwa stare wersje. Nie ma pamięci podręcznej wyników po URL. Jedyna luka
   identyfikacji to F-2 (wersja nie jest zapisana z wynikiem).
5. **Liczniki na ekranie są spójne, ale niejednoznacznie opisane.**
   - „3 bryły” to bryły z layoutu, „2 pierścienie” to pierścienie zbudowane w modelu. Różnicę tworzy bryła wycięta
     przez podgląd.
   - „Odczytano” pokazuje otwory z planu, „Co udało się odtworzyć” otwory zbudowane (F-6, np. 6 vs 7 na Slivertonie).
   - Etykiety powinny to mówić wprost.

## Odpowiedź na obowiązkowy audyt P2R vs emisja (pkt 4)

| pytanie | wynik | dowód |
|---|---|---|
| 1. `thinBodies` pomija `storeyRects`, a emit buduje z `rectAt`? | **tak** (COVERAGE_GAP) | D `h1`, C `probe-thin-gap` |
| 2. `rectAt` może dać < 2T, nie sprawdzone? | w kodzie tak; z layoutu nie, dopóki T ≤ 0,5 (bramka `max(1, 2·wallM+0,2)`) | C, F-refutation §3 |
| 3. `pieceOf` analogicznie? | tak, ta sama luka i ta sama bramka | D `h1` |
| 4. `MassV2.wallThicknessM` vs globalne T spójne? | **nie**: ramy otworów, `readWallOpenings`, płyta dachu, komin używają T domu | D §7, D-3 CONFIRMED e2e |
| 5. SHARED_WALL dla wszystkich kondygnacji i stron? | emisja tak (8/8); decyzja **nie** przy częściowym pokryciu | D §6 (NOT_A_DEFECT), D-4 CONFIRMED |
| 6. Po WIDEN zależności aktualne? | częściowo: rejestracja elewacji, głos dachu i cecha MASS liczone wcześniej; proweniencja SOURCE_EXACT fałszywa; brak testu przez emit | D §8 |
| 7. Decyzja poprawna, ale nie zastosowana do odrzuconego pierścienia? | ten sam obiekt (NOT_A_DEFECT); **ale** odrzucony pierścień może być przesunięty przez rekoncyliację (D-1) | D §9 |
| 8. Naprawa przed FIRST_BAD? | **nie**: P2R kompensuje skutek odczytu z layoutu; D-1 dzieje się po nim | D §10 |

## Trzy pierwsze poprawki (szczegóły i kolejność dalszych: `COUNCIL_FIX_ORDER.md`)

1. **Pasmo ściany odporne na otwory w adjudykatorze cienkiej bryły i ramy od grubości gospodarza** (F-R1, D-3, E-1).
   - Profil ma liczyć jako ścianę przerwy, które czytnik otworów rzutu tłumaczy jako otwory.
   - Elewacja może potwierdzać tylko tuszem krawędzi, nie brakiem nieba.
   - Bryła utracona przy wydrukowanym łańcuchu ma być nazwana.
   - Ramy okien i drzwi `frameWithinWall(kind, tOf(mass))`.

   To najbardziej prawdopodobna droga do sygnatury OWNER-a i działa przed emisją.
2. **Jedno źródło grubości ściany i jedna bramka „pierścień ≥ 2t” w miejscu, gdzie pierścień jest naprawdę budowany**
   (B-1, B-2, D-1, D-2).
   - T z pasm lic zewnętrznych, per bryła.
   - Layout bramkuje tą samą wartością co emisja.
   - Adjudykacja na każdym `rectAt`, także pieces i MAIN.
   - Rekoncyliacja nie może zwęzić pierścienia poniżej 2t i zachowuje zapis pierwszej próby.
3. **Dekompozycja rzutu nie przekracza narysowanych ścian i nie traci obszarów zamkniętych ścianami** (C-1, C-2, A-1).
   - Kafelki są ograniczone pasmami ścian.
   - Brama zamykana przed flood fillem.
   - Kopie jednego rzutu rozstrzygane razem.
   - BLOCKING bramki layoutu nie może dawać COMPLETE.

   To jest FIRST_BAD dla złej liczby brył i utraconych garaży.

Warunek poza geometrią, tani i bez ryzyka: zapisywać i pokazywać na telefonie wersję solvera i bundla (F-2). Bez tego
żadna z poprawek nie da się zweryfikować na benchmarku OWNER-a.

Prywatnego benchmarku nie odtwarzałem i nie identyfikowałem. Żadne ustalenie nie jest deklarowane jako jego przyczyna.
Zgodne mechanizmy i rozstrzygająca obserwacja są opisane wyżej.

## Artefakty

| dokument | zawartość |
|---|---|
| `stage-reports/artifacts/analyzer-n7-council-001/COUNCIL_FUNCTION_INVENTORY.md` | 1 332 funkcje osiągalne z `runAnalysis` (TS Compiler API), 426 na ścieżce krytycznej z flagami; rekordy krytyczne |
| `…/COUNCIL_CONFIRMED_DEFECTS.md` | wszystkie ustalenia z klasą |
| `…/COUNCIL_CAUSAL_GRAPH.md` | graf przyczyn i objawów |
| `…/COUNCIL_MINIMAL_REPRODUCTIONS.md` | macierz A–H i polecenia odtworzenia |
| `…/COUNCIL_FIX_ORDER.md` | kolejność napraw, bez implementacji |
| `…/reviews/` | surowe, niezależne raporty A–F i runda obalania |

Nie uruchamiałem pełnego CI ani całego korpusu. Kod produkcyjny jest niezmieniony.
