# BuildPlan v3.53.7 — audyt analizatora LINK po APK 1333

Etap audytowy: bez zmian produkcyjnych, bez APK. Baza: kod `9824e17` (APK 1333, solver 2.38.0), raport `740f13c`.
Warianty sprawdzano wyłącznie w izolowanym drzewie poza repozytorium. Źródła wydawcy, plansze i pliki pomiarowe
z obrazami zostają prywatnie poza Gitem. Bez płatnych wywołań (księga 2,72807938 USD, 92 wpisy — bez zmian), bez H2
i prywatnego benchmarku. ForgeShape tylko do odczytu.

Oznaczenia stanu: **ODTW** — wynik odtworzony w tym etapie z bajtów lub ponownego uruchomienia; **RAP** — wynik
przejęty z raportu 3.53.6 / 005Q bez ponownego pomiaru; **BRAK** — brak pomiaru.

---

## 0. Co odtworzono, czego brakuje

| Dowód | Stan | Jak |
|---|---|---|
| HEAD `740f13c`, drzewo czyste; baza `9824e17` | ODTW | `git` |
| Trzy domy powtórzone na czystym drzewie `9824e17`: skróty `model.json` i `program.json` równe dostawie (Muraje `57072d624f89`, Dzwonki 3 `7e0428f78253`, Rarytasy 5 `7697c631ea85`) | ODTW | powtórka solvera na zapieczętowanej ekstrakcji |
| Tabela próby 169 wierszy: 72 OK, 15 OPEN_OK, 48 MERGED, 19 MISSING, 15 AREA_OFF; numery 37 / 16 / 97 z 150 | ODTW | przeliczenie z zapisanego wyniku r6 |
| Spis 80 przebiegów: 62 modele, 18 odmów; kody i uzasadnienia odmów | ODTW | z zapisanych katalogów przebiegów |
| Pięć plików testów rekonstrukcji na bazie: 123/123 | ODTW | vitest, izolowane drzewo |
| Pełna macierz 2221 testów (2208 zielonych, 13 znanych z bazy), tsc, strażnicy | RAP | 3.53.6 |
| APK 1333, podpis, manifest 12/12, trzy przebiegi hosta równe powtórkom | RAP | 3.53.6 |
| Interfejs Android | NOT_VERIFIED | brak urządzenia (`/dev/kvm`) |
| Paczki innych wydawców (12) | RAP, kod 1332 | nie powtarzano na 1333 |

**Brakujące pliki.** *Master Plan v3.53.6* (§2, §4, §8) nie istnieje w repozytorium ani w środowisku —
`AGENT_PROTOCOL.md` odsyła tylko do „aktualnego Master Planu OWNER-a". Zasad z tych paragrafów nie mogłem przeczytać;
zastosowałem `CLAUDE.md`, `AGENT_PROTOCOL.md` i metodę z bieżącego polecenia. Nie zachował się też surowy katalog
pierwszego otwarcia próby (r4 — zostały tylko jego tabele) ani kod stanu pośredniego r5 jako commit (zostały jego
wyniki).

Protokół etapu (zakres, baza, dane, metryki, tolerancje, oczekiwane kontrpróby, definicje wariantów 005Q) zapisałem
prywatnie przed porównaniami; definicję wariantu warunkowego zamroziłem, zanim otworzyłem różnice r5/r6.

---

## a) Tablica obszarów

| # | Obszar | Baza 1333 | Stan | Licznik | Cel / oczekiwane |
|---|---|---|---|---|---|
| 1 | Skala | mediana liniowa geometria/deklaracja 0,976–1,010 w 11 z 12 domów próby; **Torenie 1,276** | ODTW | 12 domów, pokoje pojedyncze | ±2 % w każdym domu; skala nigdy przeciw mocnej metryce |
| 1 | Skala — odmowy | 5/80 „skala nieustalona"; inni wydawcy 9/12 ta sama odmowa | ODTW / RAP (1332) | 80; 12 | odmowa tylko bez żadnego świadka |
| 1 | Łańcuch całkowity → zasięg | najszerszy łańcuch w pełni odczytany: poziomo 29/80, pionowo 50/80 | ODTW | 80 | oba kierunki albo jawna częściowość |
| 1 | Wariant, lustro, kondygnacja, rodzaj widoku; rejestracja na punktach odłożonych | — | BRAK | — | osobny pomiar na oznaczonych arkuszach |
| 2 | Odmowy na poziomie domu | 18/80 (22,5 %); 17 podaje pokrycie: 15 za małe (3–79 % ogłoszonej zabudowy), 2 za duże (+23 %, +57 %) | ODTW | 80 | brak modelu tylko bez dowodu bryły |
| 2 | Modele niepełne | 3 z 12 domów próby: Nigelle (8 pokoi), Torenie (4), Azolle (4) | ODTW | 12 | część nieodczytana nazwana w wyniku |
| 2 | Garaże | 4 AREA_OFF: +55 %, +40 % (podjazd w bryle), −59 %, −51 % (dwa regiony) | ODTW | 12 garaży | ±10 % |
| 2 | Odchyłki naroży, długości ścian | miara obrysu z 3.53.6 | RAP | — | — |
| 3 | Pokoje parteru | 72 OK, 15 OPEN_OK, 15 AREA_OFF, 48 MERGED, 19 MISSING (18 rzeczywistych, §b-8) | ODTW | 169 | — |
| 3 | Scalenia | 16 grup; 11 grup / 33 pokoje z sumą pola w ±10 % (brakuje tylko przegrody lub drzwi), 5 grup / 15 pokoi ze złą obwiednią | ODTW | 48 | — |
| 3 | Kształt pokoju OK | 60 z 72: wszystkie rozstrzygające lica ≤ 0,10 m; 9 z licem 0,12–0,66 m; 3 bez dwóch lic | ODTW (wskaźnik) | 72 | lica ≤ 0,10 m |
| 3 | Rozbicia, nadmiar | nadmiarowych poligonów bez punktu: 0 w tabeli; garaże i hol jw. | ODTW | — | — |
| 4 | Numer pokoju | 37 dobrze, 16 źle, 97 nieodczytanych | ODTW | 150 | — |
| 4 | Nazwy, przypisanie etykiety do poligonu | nazwy pochodzą z odniesienia, nie z odczytu | BRAK | — | — |
| 4 | Strefy otwarte liczone raz | 15 pokoi w 5 grupach OPEN_OK | ODTW | — | — |
| 5 | Otwory — typ, ściana, położenie, wymiar | brak odniesienia per otwór w skali korpusu | BRAK | — | — |
| 5 | Otwory na ścianie postawionej na licu wewnętrznym | 3 domy: Muraje (5 z 6 otworów tylnych błędne), Dzwonki (1 fałszywe „drzwi"), Rarytasy (brak 2 okien) | ODTW | 3 z 62 modeli | zgodne z oznaczeniami na arkuszu |
| 6 | WALL_NOT_UNDER_ROOF | 4 ścianki w 3 domach sterczą nad dachem płaskim dobudówki (5,99–7,25 m) | ODTW (scena Dzwonków obejrzana; Bratki, Wasabi — z geometrii) | 4 | 0 |
| 6 | Dach wobec elewacji i przekrojów | wyniki 3.53.3–3.53.5 | RAP | — | — |
| 6 | Pokoje wyższych kondygnacji | 24 z 62 modeli ma ≥ 2 poziomy; brak punktów odniesienia | BRAK | — | — |
| 7 | Status ukończenia | 62/62 „COMPLETED"; częściowość tylko w śladzie (Nigelle), w Toreniach i Azollach wcale | ODTW | 62 | ukończenie, pokrycie i mierzalność osobno |
| 7 | Błędy kompilacji | 33 w 11 modelach (0 nowych w 3.53.6) | ODTW | 62 | 0 |
| 7 | Powtarzalność | 3/3 skróty równe | ODTW | 3 | — |
| 7 | Czas, pamięć | powtórka solvera: mediana 25 s; host 480–533 s, ~0,9–1,0 GB | ODTW / RAP | 80 / 3 | — |
| 7 | Test pakietu hosta / interfejs Android | zielony / NOT_VERIFIED | RAP / — | — | osobne statusy |
| 8 | Uogólnienie | ocena punktowa: jeden wydawca, parter; inni wydawcy 3 modele z 12 | ODTW / RAP (1332) | — | — |

Ograniczenia miar: promień „lica" trafia w ściankę tylko w 2/3 przypadków (reszta przechodzi przez drzwi lub jasną
przegrodę), a odchyłki 0,12–0,66 m mogą być wyposażeniem, nie ścianą — nie oglądałem ich pojedynczo. Regresja 80
przebiegów używa słabszego wskaźnika pól.

---

## b) Główne ustalenia

Dla każdego: krok, w którym decyzja pierwszy raz się zmienia, miejsce w kodzie, dowód z arkusza, skutek.

### b-1. Brakujące części domu: gdzie co znika

19 wierszy MISSING (157,4 m² deklarowane z 1761,4 m²) rozpisane na pierwszy etap utraty:

| Dom | Pokoje | m² | Pierwsza błędna decyzja | Etap |
|---|---|---|---|---|
| Nigelle 4 | 1, 2, 3, 4, 5, 7, 8, 9 | 94,6 | zasięg planu wzięty z tuszu ścian | OBRYS (3 pokoje poza zasięgiem, 5 w komórkach otwartych przez brak skrzydła) |
| Torenie 3 | 1, 5, 6, 7 | 26,8 | zasięg krótki + arbitraż wybiera fałszywą skalę | OBRYS / SKALA |
| Azolle 7 | 1, 4, 13 (+5) | 22,1 (+1,8) | komórka siatki uznana za zewnętrze | BRYŁA (pokój 5: POKÓJ) |
| Karmazyny 2 | 1, 14 | 7,1 | pokój na szwie brył; pokój 1,7 m² | POKÓJ |
| Pomarańcza | 5 | 5,0 | **artefakt oceny** (b-8) | — |

Podłoga nie znika nigdzie osobno: gdzie jest bryła, jest podłoga. Pokój ginie jako ostatni i najrzadziej (3 wiersze).

**Nigelle 4 (ODTW).** Arkusz 853 px, skala potwierdzona 3,34 cm/px. Poziome łańcuchy całkowite istnieją (474 | 926,
razem 1400), ale odczytano 0 z 3 etykiet; pionowy 2180 odczytany. Zasięg spada na `WALL_GEOMETRY_EXTENT`
(`plan-decomposition.ts:3863` `wallClusterExtent`, świadek ścian `layout.ts:704`): x 377–797,5, y 26,5–830,5. Ten
prostokąt **obejmuje logo wydawcy** (grube ciemne kreski u dołu arkusza odczytane jako pasy ścian) i donice, a **pomija
skrzydło zachodnie**, którego elewacja to słupy i przeszklenie. Siatka nie ma komórek na zachód od 385 px. Pierwszy
odczyt odrzucony; rozjemca nierozstrzygnięty po 59 odczytach. W scenie: korpus 6,5 × 24,8 m sięgający podjazdu i logo,
garaż 50,5 wobec 36,1 m², brak salonu, kuchni, holu, wiatrołapu i trzech pokoi. Ślad analizy sam niesie
`FOOTPRINT_AREA_SHORT` (79,9 m², 31 %), ale wynik ma status „COMPLETED".

**Torenie 3 (ODTW).** Dom 7,90 × 12,50 m (łańcuch 520 | 270). Skrajny znacznik odcinka 270 leży pod logo: łańcuch
odczytany w 1 z 2, wschodni trakt poza zasięgiem. Metryka mówi 3,128 cm/px (mocna, 4 świadków), ale rozjemca wybiera
odczyt „zasięg z tuszu, skala 3,98 cm/px, 105,0 m²", bo trafia w ogłoszone 99,16 m² (+5,9 %, kubełek AGREES —
`plan-resolution.ts:396`; odstępstwo SCALE `:663`), przed odczytem w zarejestrowanej skali (81,6 m², −17,7 %). Częściowa
bryła zostaje **napompowana fałszywą skalą do ogłoszonej powierzchni**: model jest liniowo o 27,6 % za duży (pokój 4:
18,05 wobec 11,09 m²), wschodnia ściana stoi na ścianie wewnętrznej. To jedyny z 62 modeli z odstępstwem SCALE i
dokładnie ten przypadek, przed którym ostrzegał raport 005Q (§K).

**Azolle 7 (ODTW).** Zasięg poprawny (łańcuch 1540). Komórka x 413–493 × y 168–456 (kuchnia, wiatrołap, część kotłowni)
ma `enclosed: false`: zalew z zewnątrz dociera do niej przez pas wnęki wejściowej, bo siatka nie ma linii na południowej
ścianie wiatrołapu i komórka łączy wnętrze z zewnętrzem. Reguła jest zero-jedynkowa na całą komórkę
(`plan-decomposition.ts:2495`: `enclosed = reached[...] === 0`; inaczej OUTSIDE albo RECESS). Skutek: dwie bryły zamiast
jednej, dom przecięty pustym pasem 2,9 m, garaż z podjazdem 39,2 wobec 25,4 m².

**Karmazyny 2 (ODTW).** Wiatrołap (5,43 m²) leży dokładnie na szwie korpusu i bryły dziennej; ściana rozdzielająca bryły
zabiera jego szerokość. Toaleta 1,69 m² nie staje się regionem. Garaż ma dwa regiony (17,4 + 11,5 wobec 35,5 m²).

**Kontrast — Wasabi (ODTW).** Układ zbliżony (korpus z dobudówkami, 3 bryły), 14/14 dobrych, rozstrzygające lica
≤ 0,09 m (garaż 0,12). Pierwsza różnica wobec Nigelli jest na wejściu do obrysu: zasięg z łańcuchów w obu osiach
(`DIMENSION_CHAIN_EXTENT`), u Nigelli z tuszu ścian. Dalej ścieżka jest ta sama.

**Odmowy — osobno (ODTW).** 18 odmów: PLAN_RESOLUTION_INCONCLUSIVE 6, PLAN_LAYOUT_REJECTED 5,
METRIC_RESOLUTION_INCONCLUSIVE 5, BOUNDARY_RESOLUTION_INCONCLUSIVE 2. Kod odmowy nie mówi o przyczynie: 17 z 18 podaje
to samo zdanie („najniższa kondygnacja pokrywa X m² wobec ogłoszonych Y"). Rozkład pola wobec ogłoszonej zabudowy:

- **zasięg pełny lub prawie pełny, pole w komórkach „otwartych"** (zasięg ≥ 0,88, komórki O 0,50–1,23 ogłoszonej powierzchni): Lulo 3,
  Malwina, Ofelia 2, Jaskrzyny, Stellarie, Eliza 4, Skalnice 3, Layla 2, Renklody 15 — **9 domów**; słabiej Oliwniki 5,
  Anody, Santany (O 0,07–0,32);
- **zasięg za krótki** (0,68–0,81): Maruny, Nolany 2, Lipienniki 2 — 3 domy;
- **pole za duże**: Berberysy 4 (+23 %), Tymotki 2 (+57 %, zasięg z tuszu);
- sama skala: Modrzewnica 10.

W 14 z 18 odmów zasięg pochodzi z łańcucha i nie jest oznaczony jako słaby — większość odmów **nie** powtarza błędu
Nigelli.

**Co łączy przypadki.** Azolle i 9 odmów łączy ten sam obraz liczbowy: poprawny zasięg, a powierzchnia domu w komórkach
uznanych za zewnętrze. Dla Azolli pierwsza decyzja jest potwierdzona na arkuszu; dla dziewięciu odmów to **wskaźnik —
nie prześledziłem każdej z nich do pierwszej decyzji**. Nigelle i Torenie łączy inna przyczyna (zasięg z tuszu po
nieodczytanym łańcuchu); Torenie dodatkowo arbitraż powierzchni. Karmazyny są osobną, małą sprawą wnętrza. Dane nie
rozstrzygają, dlaczego zalew wchodzi do komórki (prawdziwy podcień lub wiata, przeszklenie, brak linii siatki):
ogłoszona zabudowa obejmuje zadaszone części otwarte, więc udział „otwartych" rzędu 0,2–0,3 może być prawdziwy.

**Punkty kontroli wnętrza.** Wasabi: 11 pokoi osobno + strefa dzienna, lica jw. (ODTW). Dzwonki 3: garaż dalej z dwoma
regionami, 16,17 wobec 39,11 m² (ODTW). Macierzanki: sypialnie 7 i 8 = 12,84 / 14,43 wobec 13,04 / 14,55 m², lica
≤ 0,07 m, garaż 35,35 wobec 35,46 (ODTW z zapisanego wyniku). Bratki, pokój 5: 9,49 wobec 10,01 m² (RAP — brak punktów
odniesienia dla tego domu).

### b-2. Ściana zewnętrzna na licu wewnętrznym psuje otwory (ODTW)

Gdzie bryła jest przycięta na wewnętrznym licu ściany (kontrakt N1a), model stawia ścianę **wewnątrz pokoju**, a
narysowana ściana zostaje poza modelem. Otwory czytane na tak postawionej ścianie są błędne: Muraje — „okna" 4,0 i
5,2 m na parterze i trzy 3,9 / 2,0 / 3,2 m na piętrze tam, gdzie arkusz ma 270/230, 100/230 i dwa 110/210; Dzwonki —
„drzwi" 2,47 × 3,05 m w ścianie, której nie ma; Rarytasy — brak dwóch okien 120/230. Dotyczy 3 z 62 modeli. Szczegóły
w §c.

### b-3. Ścianki sterczące nad dachem płaskim — regresja 1333 widoczna w scenie (ODTW)

Cztery nowe ostrzeżenia WALL_NOT_UNDER_ROOF to jedna przyczyna: ścianka działowa, którą 3.53.6 prowadzi przez
techniczny podział brył, przechodzi z korpusu do dobudówki z dachem płaskim, zachowuje tryb „pod dach korpusu" i poza
nim dostaje wysokość nominalną do kalenicy. Bratki: 0,99 m ścianki o wysokości 5,99 m; Dzwonki: dwie po 0,79 m, 7,25 m;
Wasabi: 0,72 m, 6,45 m. W scenie Dzwonków dwa pionowe kolce nad dachem frontowej dobudówki widać w rzutach z przodu,
z boku i we wszystkich widokach 3D. Raport 3.53.6 podał to jako „nowe ostrzeżenia" bez skutku w scenie.

### b-4. Wnętrze: scalenia są największą stratą w domach, które mają model (ODTW)

48 z 169 pokoi leży w poligonie wspólnym. W 11 grupach (33 pokoje) suma pól zgadza się w ±10 % — obwiednia jest
dobra, brakuje przegrody albo zamknięcia drzwi. W 5 grupach (15 pokoi) zła jest sama obwiednia (Torenie +71 %,
Pysznogłówki −24 % i +40 %, Mennice +19 %, Nigelle +10 %).

### b-5. Numery pokoi (ODTW)

37 z 150 poprawnie, 16 błędnie, 97 bez odczytu. Model nie może więc sam związać pokoju z jego deklaracją; tabele tego
etapu wiążą je punktami odniesienia.

### b-6. Status wyniku nie niesie niepełności (ODTW)

Wszystkie 62 modele mają „COMPLETED". Nigelle (31 % zabudowy nieodczytane) ma ostrzeżenie tylko w śladzie; Torenie
(fałszywa skala) i Azolle (dom przecięty) nie mają żadnego. 33 błędy kompilacji w 11 modelach też nie zmieniają statusu.

### b-7. Uogólnienie

Dwie decyzje zależą od konwencji arkusza, nie od geometrii domu: logo czytane jako ściany (Nigelle) i znacznik łańcucha
zasłonięty przez logo (Torenie). U innych wydawców 9 z 12 paczek kończy się na skali (RAP, kod 1332).

### b-8. Uzgodnienie nieścisłości protokołu 1333

1. **Zmiany między pierwszym otwarciem próby a dostawą.** Raport mówi o trzech, moje podsumowanie na czacie o czterech.
   Faktycznie: cztery zmiany kodu (światło przejścia czytane liniowo; ograniczenie `toDrawnWall` do brył złożonych
   przez szew; wymóg skrzydła drzwi — w dwóch podejściach) i jedna zmiana samego komentarza. Macierz testów biegła na
   drzewie różnym od `9824e17` o ten komentarz.
2. **„Wynik identyczny".** Sprawdzone teraz wiersz po wierszu: r4 wobec r6 — 169 wierszy, 0 różnic statusu, 0 różnic
   pola. Zmienił się jeden model: Dzwonki (`7597b1b00e01` → `7e0428f78253`) — to ściana garażu cofnięta na lico
   wewnętrzne przez ograniczenie `toDrawnWall`; w tabeli pokoi niewidoczne.
3. **„40 wall-strip i 9".** Stan pośredni miał 49 porażek: 38 w `wall-strip.test.ts`, 9 w testach usługi (5
   partial-preview-n7-p1, 2 thin-body-n7-p2r, 1 wall-recovery-n7-fix01, 1 wall-thickness-n7-fix02), 1 attic-rooms
   (dowód skrzydła drzwi — bez związku z licem) i 1 test programu local-analyzer (Sliverton).
4. **Pomarańcza, pokój 5.** Punkt odniesienia leży 0,07 m poza poligonem łazienki, który istnieje i ma 4,95 wobec
   4,97 m². Rzeczywistych braków jest 18, dobrych wierszy 88 z 169. Zamrożonej tabeli nie zmieniam.
5. **Wgląd przed otwarciem próby** (spis drzwi z nowych reguł, bez oceny) — ujawniony już w 3.53.6, bez zmian.
6. **Ostrzeżenia dachowe** — patrz b-3: to wada sceny, nie tylko ostrzeżenie.

---

## c) Kontrakt 005Q — decyzja

### Co zabezpiecza N1a

N1a zostawia pas ściany jako strefę: lica, rama i obrys nie ruszają się, lico zewnętrzne jest nazwane jako
niejednoznaczne. Sprawdziłem trzy stany na identycznych bajtach:

- **B** — baza (lico przenosi się tylko dla brył złożonych przez szew);
- **U** — `toDrawnWall` bez ograniczenia;
- **C** — wariant warunkowy zamrożony przed porównaniami: tusz jednej ściany (≥ 50 % boku, jedno lico), grubość
  0,7–1,6 ściany, lico na zasięgu planu pochodzącym z wydrukowanego łańcucha i nieoznaczonym jako słaby, brak drugiego
  pasa za licem.

Wynik na testach:

| Zestaw | B | U | C |
|---|---|---|---|
| `wall-strip.test.ts` (65) | 0 porażek | 37 testów / 103 asercje | 36 / 97 |
| testy usługi: podgląd częściowy i cienkie bryły (19) | 0 | 9 | 9 |
| pliki n7 rekonstrukcji: podgląd częściowy, cienkie bryły, pierścień (58) | 0 | 0 | 0 |
| pozostałe pliki wall-strip: unit, half-wall, invariance, source-link (91) | nie uruchamiane w tym etapie (RAP: zielone) | 0 | nie uruchamiane |

Co N1a rzeczywiście chroni — rozpisanie zmienionych oczekiwań:

| Grupa | U | C | Klasyfikacja |
|---|---|---|---|
| Prostokąt bryły, regiony, pudełko „walled" ramy na licu zewnętrznym | 26 testów / 76 asercji | 26 / 74 | **świadoma zmiana kontraktu** — fikstura rysuje jedną ścianę z oboma licami, a asercja zapisuje „lico się nie rusza" |
| w tym: obwiednia ramy przesunięta o ≤ 0,013 m | w tych samych asercjach | jw. | **artefakt zamrożonej liczby** (konwencja pół piksela); rama się nie przesuwa — inaczej niż w N1, gdzie przesunięcie wyniosło 0,4455 m |
| Podest narysowany za ścianą przestaje być nazwany | 9 / 19 | 9 / 19 | **rzeczywista regresja** — nazwana niepewność znika razem ze strefą, a podest nie jest ani nazwany, ani zbudowany |
| Cienki lub niepewny tusz (pas 10 px i 13 px): znika taras i wnęka zamrożonego wyniku | 2 / 8 | 1 / 4 | **rzeczywista regresja** — lico rusza się tam, gdzie 005Q mówi „to nie jest ściana" |
| Bryła nachodzi na cienką dobudówkę (rodzina Sliverton) | 9 testów usługi | 9 | **rzeczywista regresja** — `AnalysisError: mass-0 and mass-1 occupy the same 3.57 m²`: całkowita odmowa zamiast podglądu częściowego |
| „Pięć przerysowań nazywa podest" | 1 (tylko w trybie twardym) | — | artefakt kolejności testów — zależy od poprzednich |
| attic-rooms (skrzydło drzwi) | — | — | bez związku z licem |
| program local-analyzer (Sliverton) | nie powtarzany | — | **niesprawdzone**; ta sama rodzina co testy usługi |

Dziewięć porażek „podglądu częściowego i cienkich brył" z raportu to więc jedna przyczyna, i jest to prawdziwa
regresja, nie artefakt.

### Skutek w polu

Zdjęcie ograniczenia zmienia bryły w **3 z 62 modeli**; ramy równe we wszystkich trzech, zero nowych diagnostyk
kompilacji. Porównanie z arkuszem:

| Dom | Zmiana U wobec B | Dowód na arkuszu | Werdykt |
|---|---|---|---|
| Muraje | tylna ściana 6,85 → 7,407 m | łańcuch 740; ściana na narysowanym tuszu | U zgodne |
| Muraje, otwory parteru | „okna" 4,00 i 5,21 m → drzwi 2,70 × 2,30 i 0,99 × 2,22 | oznaczenia 270/230 i 100/230 | U zgodne (szerokości); B błędne |
| Muraje, otwory piętra | 3 „okna" 3,90 / 2,02 / 3,21 m → 2 okna 1,09 i 1,10 m | dwa oznaczenia 110/210 | U zgodne (liczba, szerokość); wysokość 1,89 wobec 2,10 — **niesprawdzona przyczyna** |
| Dzwonki 3, garaż | wschodnia ściana 6,844 → 7,595 m | łańcuch 760; narysowana ściana była poza modelem | U zgodne |
| Dzwonki 3, otwory | znikają „drzwi" 2,47 × 3,05 m na ścianie garażu | ściana lita | U zgodne |
| Rarytasy 5 | wschodnia ściana 16,475 → 16,914 m | ściana na tuszu; łańcuch całkowity 1720 | lico zgodne; **0,29 m do łańcucha niewyjaśnione** |
| Rarytasy 5, otwory | przybywają dwa okna 1,20 × 2,30 | dwa oznaczenia 120/230 | U zgodne |
| Podłoga, pola pokoi, podpory, grubość | podłoga i pokój idą za bryłą; grubość bez zmian (0,387 / 0,454 / 0,467); żaden element liniowy ani podpora nie zmienia się | — | pola pokoi po zmianie **niesprawdzone** z deklaracją |
| Dachy, taras | Muraje: 1 dach zmieniony; Dzwonki: krawędzie i 2 połacie dobudówki; Rarytasy: 1 dach, 1 taras, 1 region wykończenia | — | **niesprawdzone** |

Wszystkie sprawdzone zmiany otworów (6 z 6) mają dowód w oznaczeniach arkusza — odwrotnie niż przy C1 z 005Q, gdzie
otwory zmieniały się bez nowego dowodu. Zastrzeżenie: to trzy domy, wszystkie znane przed porównaniem (Muraje i
Rarytasy z nazwy, Dzwonki z próby).

**Wariant C w zamrożonej postaci nie przenosi żadnego z trzech lic.** Muraje: lico leży dokładnie na zasięgu (209,0
= 209,0 px), ale zasięg pochodzi ze znaczników sumy zewnętrznej i jest oznaczony jako słaby. Rarytasy: zasięg 0,5 px od
lica, również słaby. Dzwonki: bok garażu nie leży na zasięgu planu, choć zamyka go łańcuch 760. Jednocześnie C nie
zapobiega żadnej z regresji testowych poza jednym przypadkiem cienkiego tuszu. Wniosek: przesłanka „pochodzenie zasięgu
planu" ma złą ziarnistość — jest jedna na oś, a dowód potrzebny jest na konkretny bok.

### Rekomendacja

**Utrzymać N1a jako domyślne zachowanie. Dopuścić korektę lica warunkowo, w osobnym etapie produkcyjnym, pod
warunkami poniżej. Nie zdejmować ograniczenia wprost (U) i nie wdrażać wariantu C.**

Niezależne przesłanki wiążące oba lica z tą samą ścianą — wszystkie wymagane:

1. **Tusz jednej ściany**: pas z wewnętrznym licem przy boku bryły, jedno zewnętrzne lico na ≥ 50 % długości boku,
   grubość 0,7–1,6 ściany planu, brak drugiego równoległego pasa do dwóch grubości za licem (warstwa, uskok, ściana
   sąsiada).
2. **Świadek niezależny od tuszu, na tym boku**: znacznik wydrukowanego łańcucha na zewnętrznym licu **albo** co
   najmniej jeden otwór w tym pasie o szerokości zgodnej z wydrukowanym oznaczeniem.
3. **Brak nałożenia**: przesunięty bok nie wchodzi w żaden inny region — bryłę dowolnej grubości ani strefę z własnym
   dowodem.
4. **Nazwy zostają**: podest lub taras narysowany za ścianą jest nazwany niezależnie od tego, czy strefa pasa istnieje.
5. **Otwory na przesuniętej ścianie** czytane z pasa, każdy z werdyktem (zgodny z oznaczeniem / niesprawdzony).

Dowód **sprzeczny**: tusz wskazuje lico, a znacznik łańcucha leży gdzie indziej o więcej niż okno lica — bok zostaje,
zapis konfliktu. Dowód **niepełny**: jest tusz, nie ma znacznika ani zgodnego otworu — bok zostaje, luka
niejednoznaczna, czyli N1a. Pasy niepewne, warstwy, uskoki, wnęki i prawdziwe tarasy pozostają przy N1a z definicji
warunków 1–3.

Ryzyka: (a) warunki 2–5 nie były uruchomione — to projekt wyprowadzony z pomiaru, nie zmierzony wariant; (b) próba
polowa to 3 domy znane wcześniej, więc warunek 2 jest dopasowany po fakcie i wymaga świeżych domów; (c) elewacja
schodkowa wymaga lica na odcinek, a bryła jest prostokątem — bok rusza się w całości albo wcale.

Zakres migracji testów: 26 testów `wall-strip` do ponownego zamrożenia (zmiana kontraktu, tylko tam, gdzie fikstura
spełnia warunek 2), 9 testów podestu musi zostać zielonych dzięki warunkowi 4 (zmienią się w nich tylko prostokąty
brył), 2 testy cienkiego tuszu i 9 testów usługi muszą zostać zielone bez zmiany oczekiwań.

---

## d) Kolejność wycinków

| # | Wycinek | Częstość | Skutek | Zależność | Ryzyko |
|---|---|---|---|---|---|
| 1 | **Kompletność obrysu: komórka otwarta to nie zewnętrze** (b-1) | 9–12 z 18 odmów (wskaźnik) + Azolle | cały dom albo trakt | wszystko dalej stoi na bryle | średnie–wysokie: dotyka bramek odmowy |
| 2 | Zasięg i arbitraż powierzchni: tusz niebędący ścianą poza zasięgiem; skala nigdy przeciw mocnej metryce (b-1) | 2 modele + 3–5 odmów | 12 pokoi, skala całego domu | niezależny od 1 | średnie |
| 3 | Przegrody i drzwi wnętrza (b-4) | 48 pokoi, z tego 33 z dobrą obwiednią | edytowalność wnętrza | po 1–2 (obwiednia) | średnie |
| 4 | Warunkowa korekta lica 005Q (§c) | 3 z 62 modeli | otwory i wymiar jednej elewacji | niezależny | średnie: 46 testów w zasięgu |
| 5 | Numery i etykiety pokoi → poligon (b-5) | 113 z 150 | wiązanie pokoju z deklaracją | po 3 | niskie |

Poprawka towarzysząca, mała i izolowana: wysokość ścianki poza dachem korpusu (b-3) — regresja 1333 widoczna
w scenie; proponuję dołączyć ją do pierwszego etapu produkcyjnego niezależnie od wyboru wycinka.

**Czy dowody zmieniają priorytet względem „brakujących części domu"?** Nie zmieniają kierunku, zmieniają miejsce.
W domach, które mają model, scalenia (48) są częstsze niż braki (18). Ale 18 odmów to domy bez żadnego pokoju, a
większość z nich ma ten sam obraz co Azolle. Brakujące części i odmowy są więc w większości jednym problemem, i jego
pierwsza decyzja leży w klasyfikacji komórek — nie w zasięgu, od którego zaczęło się śledztwo (Nigelle). Zasięg
i arbitraż to osobny, mniejszy wycinek.

### Rekomendowany następny krok: wycinek 1

- **Początek**: prześledzić 9 odmów z listy b-1 do pierwszej decyzji na arkuszu i potwierdzić albo obalić wspólną
  przyczynę z Azollami. Bez tego wycinek stoi na wskaźniku.
- **Zmiana**: komórka, do której zalew dociera, jest dzielona wzdłuż granicy zalewu albo oceniana udziałem pola, zamiast
  przepadać w całości; część otwarta zostaje typowana (wnęka, podcień, wiata), nie znika.
- **Pierwsza mierzalna poprawa**: Azolle — pokoje 1, 4, 13 mają poligon, jedna bryła mieszkalna; liczba odmów
  z pokryciem poniżej 80 % ogłoszonej zabudowy spada z 15, bez nowego błędu kompilacji.
- **Źródła**: te same zapieczętowane ekstrakcje 80 przebiegów; punkty odniesienia 12 domów próby i 4 domów DEV;
  ogłoszona zabudowa wyłącznie jako miara oceny, nie jako cel dopasowania.
- **Kontrpróby**: prawdziwe podcienie, wiaty i wnęki (podjazd Azolli, wiata Karmazynów, taras narożny z 3.53.6) — nie
  mogą stać się podłogą; domy z nadmiarem (Berberysy +23 %, Tymotki +57 %, garaże +40–55 %) — nie mogą urosnąć;
  Wasabi, Kanzany, Pomarańcza — bez zmiany.
- **Zakres regresji**: 80 przebiegów z porównaniem brył, tabele pokoi próby i DEV wiersz po wierszu, pełne pliki
  `wall-strip` oraz testy podglądu częściowego; świeże domy do oceny końcowej wybrane i zamrożone przed zmianą.

---

## e) Podsumowanie dla OWNER-a

**Co 1333 potwierdza.** Na parterach jednego wydawcy analizator daje model dla 62 z 80 paczek. W 12 domach próby
87 z 169 pokoi jest dobrych (88 po korekcie jednego punktu odniesienia), skala jest trafna w 11 z 12 domów
(±2,4 %), a pokój uznany za dobry ma w 60 z 72 przypadków lica w 10 cm. Wynik jest powtarzalny co do skrótu.

**W jakim zakresie.** Jeden wydawca, parter, pole i punkt odniesienia; kształt tylko wskaźnikiem lic. Bez pomiaru
zostają: wyższe kondygnacje, otwory w skali korpusu, wybór wariantu i widoku, nazwy pokoi, interfejs Android. Inni
wydawcy: 3 modele z 12, na starszym kodzie.

**Co obniża wiarygodność.** (1) 18 odmów i 3 niepełne modele, w większości przez komórki siatki uznane za zewnętrze;
(2) status „COMPLETED" także dla domu z 31 % nieodczytanej zabudowy i dla domu w fałszywej skali; (3) w 3 modelach
ściana zewnętrzna stoi w pokoju, a otwory na niej są błędne; (4) w 3 modelach ścianki sterczą nad dachem — regresja
1333; (5) 48 pokoi scalonych; (6) numer pokoju odczytany dla 37 z 150.

**Decyzje do podjęcia.**

1. **005Q**: utrzymać N1a; zlecić warunkową korektę lica jako osobny etap z pięcioma warunkami z §c — albo zostawić
   bez zmian. Zdjęcie ograniczenia wprost odradzam: naprawia 3 domy, ale zamienia podgląd częściowy w odmowę.
2. **Następny etap produkcyjny**: wycinek 1 (kompletność obrysu) z poprawką ścianek nad dachem — albo inna kolejność
   z tabeli §d.
3. **Master Plan v3.53.6**: plik nie jest dostępny w środowisku; jeśli jego §2, §4 i §8 mają obowiązywać w następnym
   etapie, trzeba go dołączyć do repozytorium albo do polecenia.

Dowody prywatne (poza Gitem): protokół etapu, spis 80 przebiegów, wyniki testów wariantów, łatka wariantów U/C,
powtórki trzech domów w trzech stanach, plansze porównawcze.
