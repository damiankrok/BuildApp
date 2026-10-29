# STAGE BUILDPLAN N8-03D2 — podział pomieszczeń poddaszy (Arganiach, Trytomach)

Projekty:
- Dom w arganiach (G2E) — https://www.archon.pl/projekty-domow/projekt-dom-w-arganiach-g2e-m32b290f26a4e8
- Dom w trytomach (G) — https://www.archon.pl/projekty-domow/projekt-dom-w-trytomach-g-m6802645623649

Baza: `02f49db` (N8-03D1, solver 2.16.0, model 1.6.0). Wynik: solver **2.17.0**, schemat modelu **1.7.0**.
Czytnik metryk bez zmian (1.5.0). Gałąź `claude/new-session-3kzcgh`.

## Problem

| dom | przed | rzut ARCHON |
|---|---|---|
| Arganiach, poddasze | 4 regiony; „Hol” 45,70 m² obejmował pokój 7, łazienkę 4, schody 8, hol 1 i pustkę nad salonem. Znacznik `ROOM_FLOOR` leżał na 7,02 m² pustki i 1,02 m² otworu schodowego. | 8 pomieszczeń |
| Trytomach, poddasze | 5 regionów; jeden 43,33 m² obejmował pokoje 8, 3 i 4, korytarz 2 i schody 1 | 9 pomieszczeń |

## FIRST_BAD — osobno dla każdego domu

Porównanie rzutów ARCHON z odczytem pasm ścianek, przerw drzwiowych, symboli skrzydeł, łączenia kawałków ścian
i wydzielania regionów (nakładki w ZIP-ie: `*-ATTIC-OVERLAY-ARCHON-BEFORE-AFTER.png`).

Pasma ścianek były odczytane poprawnie w obu domach. Błędy siedziały w dalszej części łańcucha: w tym, jak z pasm
składa się drzwi, i w tym, czego nie wolno zalewać.

### Arganiach

| # | etap | stan | błąd? |
|---|---|---|---|
| 1 | pasma ścianek | wszystkie ścianki między pomieszczeniami odczytane | nie |
| 2 | **drzwi 7 → 1** (przerwa 0,86 m w ściance na z 8,1) | Prawa ościeżnica przechodzi w korpus szafy, więc jej pasmo ma 0,40 m i środek przesunięty o 0,14 m.<br>Kawałki trafiały do dwóch różnych „kubełków” zaokrąglenia, a w tym samym ciągu leżał jeszcze obrys bloku wewnątrz lewego kawałka.<br>Para nie powstała. | **TAK (FIRST_BAD 1)** |
| 3 | **drzwi 4 → 1** (0,95 m między końcem ścianki a licem ścianki prostopadłej, łuk narysowany) | Reguła N8-02B szukała tylko kawałków wolnych na obu końcach.<br>Ta ścianka jest już ościeżnicą drzwi do pokoju 2, więc w ogóle jej nie sprawdzano. | **TAK (FIRST_BAD 2)** |
| 4 | numery pomieszczeń | Obrócone odczyty „1” z liczb wymiarowych 271/273 nadały łazience i pokojom 2+3 etykietę „Hol”.<br>Właściwe „1” holu odrzucił wybór orientacji strony. | błąd etykiet |
| 5 | pustka i otwór schodowy | Bariery zalewania istniały, ale pomieszczenie otaczające otwór miało tylko obrys zewnętrzny.<br>Schemat 1.6.0 nie znał otworów w pomieszczeniu. | **TAK (warunek krytyczny)** |

### Trytomach

| # | etap | stan | błąd? |
|---|---|---|---|
| 1 | pasma ścianek | Wszystkie odczytane.<br>Ścianka między 3 a 4 (1,28 m) była wolna na obu końcach i odpadała jako „mebel”, choć przy jej środku zaczyna się ścianka 3\|4. | skutek #2–3 |
| 2 | **drzwi 8 → 2** | Drzwi stoją między końcami dwóch równoległych ścianek (ścianka nad 7 i ścianka pod 9).<br>Ich końce mijają się o 0,26 m, a dziura w ścianie ma 1,05 m.<br>Takiego układu żadna reguła nie znała. | **TAK (FIRST_BAD 1)** |
| 3 | **drzwi 4 → 2** | Skrzydło ma 0,86 m, przerwa do lica 0,97 m.<br>Test łuku zakładał promień równy całej przerwie. | **TAK (FIRST_BAD 2)** |
| 4 | **drzwi 3 → 2** | Jedna ościeżnica to bok bloku komina, a nie ścianka.<br>Ta sama ścianka 3\|4 była ościeżnicą dwojga drzwi, a reguła przerywała po pierwszych. | **TAK (FIRST_BAD 3)** |

## Poprawka — reguły ogólne (`v2/interior.ts`, bez nazw projektów)

1. **Skrzydło krótsze od przerwy** (`doorSwingInGap`).
   - Drzwi uznaję, gdy rysunek ma zarazem:
     - łuk o promieniu skrzydła, między 0,7 przerwy (≥ 0,55 m) a przerwą;
     - otwarte skrzydło: prostą od zawiasu, prostopadłą do linii ściany, o tej samej długości.
   - Zawias może leżeć do 0,15 m w głąb przerwy i do 0,08 m w poprzek linii, bo stoi na ościeżnicy, a nie na licu.
   - Skrzydło musi być kreską (≤ 3 px szerokości). Lico ścianki obok zawiasu skrzydłem nie jest; tę pułapkę wykrył
     test na syntetycznym rzucie.
   - Wybierany jest łuk najlepiej dopasowany, nie pierwszy z brzegu.
   - Dotychczasowy test (skrzydło równe przerwie) zostaje bez zmian i działa jako pierwszy.
2. **Ościeżnice jednych drzwi parują się po paśmie, nie po kubełku.**
   - Kawałki są na jednej linii, gdy ich narysowane pasma nachodzą na siebie w poprzek linii albo (jak dotąd) trafiają
     do tego samego kubełka.
   - Bliższą ościeżnicą jest kawałek sięgający najdalej. Krawędź bloku leżąca wewnątrz ścianki nie jest końcem ścianki,
     a obrys bloku (usuwany później) nigdy nie jest ościeżnicą.
3. **Drzwi na końcu ścianki** (N8-02B), rozszerzone:
   - każdy wolny koniec dowolnego kawałka (także kawałka zakotwionego z drugiej strony albo będącego już ościeżnicą);
   - przy obu końcach jednej ścianki;
   - ościeżnicą może być bok bloku (komina, słupa);
   - zawsze tylko przy narysowanym łuku.
4. **Drzwi między licami dwóch równoległych ścianek**, których wolne końce spotykają się wzdłuż (zakładka ≤ 0,4 m).
   - Szerokość w świetle mieści się w zakresie drzwi.
   - W przejściu nic nie stoi.
   - Łuk jest narysowany.
   - To granica pomieszczenia. Takie drzwi nie mają własnej ściany do wycięcia, więc model nie dostaje w tym miejscu
     skrzydła.
5. **Numer pomieszczenia to odczyt pionowo stojący.**
   - Odczyt obrócony (wymiar, znak wodny) nie numeruje niczego.
   - Celowo **nie** zmieniłem reguły 005U-N4, że ten sam numer odczytany gdziekolwiek, w dowolnej orientacji, czyni
     odczyt niejednoznacznym (pilnuje tego istniejący test).
6. **Otwory stropu nie są podłogą pomieszczenia** (`reconstruct-v2.ts`, `slabOpenings`).
   - Otwór schodowy (przycięty do lic ścian) i pustki (`voidOnSlab`, wspólna funkcja z emisją stropu) to **te same
     wielokąty**, które są wycięte w stropie.
   - Blokują każdą komórkę siatki, której dotykają.
   - Pomieszczenie, które otwór otacza, dostaje go jako `holes`.
   - Pomieszczenie, do którego otwór dochodzi od ściany, ma go poza obrysem.

Bez wymuszania liczby 8 lub 9. Każda nowa granica to rysunek: pasmo ścianki albo drzwi z łukiem. Tabela powierzchni
niczego nie steruje.

## Schemat modelu 1.7.0 — `Room.holes`

- `RoomSchema.holes` (opcjonalne) i `createRoom.holes` działają według reguł otworów stropu:
  - walidacja `ROOM_HOLE_OUTSIDE` i `ROOM_HOLES_OVERLAP`;
  - kompilator rysuje `ROOM_FLOOR` jako obszar z otworami (`extrudePlanRegion`).
- Migracja 1.6.0 → 1.7.0 jest jawna i raportowana. Plik 1.6.0 z `rooms[i].holes` jest odrzucany jako źle oznaczony
  (test).
- Zamrożone fixture `demo-house-1.7.0.json` i `marcowki-ge-1.7.0.json` różnią się od 1.6.0 wyłącznie wersją.
- Zapieczętowani kandydaci przeszli `candidates:reseal`, łańcuch w `reseal-log.json`:
  - `marcowki-auto`, `-v2`, `-v3` oraz kopia analyzer-v2;
  - każdy krok bajt w bajt ten sam budynek.
- Modele 005T (`owner-005t`) przestawiono na 1.7.0 tylko w ciągu wersji. Z wersją 1.6.0 dają dokładnie dawne
  przypięte SHA. Nowe SHA są w `mobile-scene/scripts/scenes.ts`.
- Paczki Androida przegenerowane (`mobile:export-scenes`, `architecture:android-fixtures`): zmieniły się tylko hashe
  i wersja, liczby siatek i trójkątów bez zmian.
- **Nie** przechwyciłem ponownie fixture kontraktu analizatora (`apps/android/.../analyzer-contract`). Są nieaktualne
  od dawna (ostatnio przechwycone przy solverze 2.6.0) i nie należą do tego etapu.

## Wynik — poddasza

Nakładki modelu PO na oryginalnych rzutach: `*-MODELS-ON-PLANS.png`, tabele `*-ROOMS-VS-ARCHON.png`.

**Arganiach — 6 regionów (było 4):**

| ARCHON | region PO | pow. podłogi | dlaczego |
|---|---|---|---|
| 7 Pokój | main-room-1-5 | 16,49 m² | drzwi 7→1 odczytane |
| 6 Pokój | main-room-1-0 | 15,77 m² | jak przed zmianą |
| 5 Pralnia | main-room-1-1 | 7,51 m² | jak przed zmianą (numer odczytany jako „3”, etykieta wstrzymana) |
| 4 Łazienka | main-room-1-2 | 8,37 m² | drzwi 4→1 odczytane |
| 2 Pokój + 3 Garderoba | main-room-1-3 | 24,71 m² | Rzut nie rysuje ścianki ani drzwi między 2 a 3: garderoba jest otwarta na pokój. Granicy nie wymyśliłem. |
| 1 Hol + 8 Schody | main-room-1-4 | 12,54 m² | Schody są otwarte na hol. **Pustka poza obrysem, otwór schodowy jako otwór pokoju.** |

**Trytomach — 8 regionów (było 5):**

| ARCHON | region PO | pow. podłogi | dlaczego |
|---|---|---|---|
| 8 Pokój | main-room-1-5 | 10,34 m² | drzwi między końcami równoległych ścianek |
| 9 Pralnia | main-room-1-7 | 5,06 m² | jak przed zmianą |
| 1 Schody + 2 Korytarz | main-room-1-4 | 11,13 m² | schody otwarte na korytarz, rzut nie rysuje ścianki |
| 3 Pokój | main-room-1-6 | 10,06 m² | drzwi przy boku bloku komina |
| 4 Pokój | main-room-1-3 | 10,70 m² | drzwi ze skrzydłem 0,86 m w przerwie 0,97 m |
| 5 Łazienka | main-room-1-2 | 5,14 m² | jak przed zmianą |
| 6 Garderoba | main-room-1-1 | 3,91 m² | jak przed zmianą |
| 7 Pokój | main-room-1-0 | 11,46 m² | jak przed zmianą |

Powierzchnie ARCHON na poddaszu to powierzchnie **użytkowe**, zredukowane pod skosami. Region w modelu to podłoga
do lic ścianek, więc różnica jest oczekiwana i nie jest kalibrowana.

**Warunek krytyczny Arganiach**, sprawdzony na skompilowanych trójkątach (`slab-probe.ts`, promienie pionowe):

| | przed | po |
|---|---|---|
| inne elementy w pustce między spodem a wierzchem stropu | `ROOM_FLOOR` 7,02 m² | **brak** |
| inne elementy w otworze schodowym | `ROOM_FLOOR` 1,02 m² | **brak** |
| promienie przez pustkę i otwór schodowy trafiające w strop | 0 | 0 |
| promienie obok otworów, które nie trafiają w strop | 0 | 0 |

Te same reguły zdjęły w Sasankach 3 `ROOM_FLOOR` z otworu schodowego (0,76 m² → 0). Pokój dostał tam otwór.

## Regresja ośmiu domów

Wejścia: zapieczętowany dowód metryczny N8-03B. Tabela w `REGRESSION-8-HOUSES.png`
i `artifacts/analyzer-n8-03d2/regression-8-houses.json`.

- We wszystkich 8 domach **dachy, połacie, krawędzie (kosze Sasanek i Rarytasów), stropy (pustka Arganiach), okna,
  schody, kominy, balkony, tarasy, ściany zewnętrzne i otwory zewnętrzne są bajt w bajt bez zmian**. Bez zmian są
  też garaż Arganiach, jego brama i otwarty styk.
- Walidacja `ok`, **0 WALLS_OVERLAP**, 0 diagnostyk kompilatora, wszystkie otwory wycięte w każdym domu.
- **Żadne z dotychczasowych drzwi wewnętrznych nie zniknęło** (porównanie odczytów PRZED/PO dla każdej
  kondygnacji).
- Zmiany poza dwoma domami, każda sprawdzona na nakładce na rzucie ARCHON:

  | dom / kondygnacja | zmiana |
  |---|---|
  | A01, poddasze | pokój 7 oddzielony od holu (drzwi na końcu ścianki) |
  | Goździkowce, poddasze | 5 → 9 regionów: pokoje 5, 6, 9, 10 i hol oddzielone (pary ościeżnic po paśmie) |
  | Cieszynianka, parter | 4 → 8 regionów: pomieszczenia 10, 11, 12 i wiatrołap 1 oddzielone. Pokój 8 zachowany: w pierwszej wersji poprawki ginął, wykryłem to i usunąłem przyczynę (reguła 2). |
  | Arganiach, parter | wiatrołap 1 i garderoba 5 oddzielone; garaż bez zmian |
  | Marcówki, Rarytasy, Sasanki | geometria pomieszczeń bez zmian; Sasanki: otwór schodowy jako otwór pokoju |

- **Etykiety pomieszczeń** zmieniły się wszędzie tam, gdzie wcześniej pochodziły z obróconych odczytów. Część była
  trafna przypadkiem i zniknęła:
  - „Łazienka” w Trytomach pochodziła z glifu znaku wodnego;
  - „Schody” w A01 i Goździkowcach.

  Część była błędna i zniknęła, np. „Hol” na łazience Arganiach i „Wiatrołap” na skrzydle Sasanek. Kilka pojawiło się
  z poprawnych odczytów pionowych. Pełna lista jest w `regression-8-houses.json` → `labels`. Odczyt numerów to
  osobny problem i nie był tu ruszany.

Walidacji nie osłabiałem.

## Testy (tylko celowane)

- Nowy `reconstruction/test/attic-rooms-n8-03d2.test.ts` (11 testów, syntetyczne rzuty). Sprawdza:
  - skrzydło krótsze od przerwy, a bez łuku albo bez skrzydła nie ma drzwi;
  - lico ścianki nie jest skrzydłem;
  - drzwi między równoległymi ściankami, bez łuku nie ma drzwi;
  - drzwi przy boku bloku;
  - parę ościeżnic przy pogrubionym kawałku;
  - otwór stropu otoczony przez pokój jako otwór pokoju, a otwór przy ścianie poza obrysem;
  - numer z odczytu obróconego, którego nie ma;
  - pokój z otworem: walidacja, `ROOM_FLOOR` pusty w otworze, otwór poza pokojem odrzucony.
- Migracja 1.6.0 → 1.7.0: liczba kroków, notatki i odrzucenie pliku 1.6.0 z otworem pokoju.
- 57 plików / 575 testów celowanych zielone: model, polecenia, geometria, kandydaci, referencja Marcówek, architektura,
  demo, sceny mobilne i powiązane testy rekonstrukcji.
- Pakiet rekonstrukcji, usługa analizy, web i edytor:
  - 117 plików zielonych, 1 pominięty z własnego warunku (`ring-collision-n7-fix01`);
  - 1351 testów, 0 błędów.
- `tsc` czysto.
- Bez pełnego CI, bez APK, bez testów Androida.

## Co jest nadal niepewne

- Pokoje 2+3 Arganiach, hol 1 ze schodami 8 Arganiach oraz schody 1 z korytarzem 2 Trytomach to po jednym regionie,
  bo rzuty nie rysują między nimi ścianki. Rozdzielenie wymagałoby granicy, której źródło nie podaje.
- Numery pomieszczeń poddaszy w obu domach są w większości nieodczytane (słabe OCR cyfr pionowych, odrzucone przez
  wybór orientacji strony), więc większość regionów nie ma etykiety.
- Drzwi między licami równoległych ścianek nie mają skrzydła w modelu, bo nie ma ściany, w której można je wyciąć.
  Granica pomieszczenia jest. Wysokość drzwi to nadal konwencja.

## Materiały

- Prywatny ZIP `BuildPlan-N8-03D2-Attic-Rooms-Arganiach-Trytomach-Before-After.zip`. Zawiera:
  - modele PRZED i PO obu domów;
  - 9 widoków review-shots PRZED i PO dla obu domów;
  - nakładki granic pomieszczeń i ścianek na oryginalne rzuty ARCHON (odczyt i model, każda kondygnacja);
  - zbliżenia poddaszy;
  - tabele pomieszczeń i regresję 8 domów (modele i nakładki);
  - oryginalne obrazy ARCHON, wyłącznie w ZIP-ie.
- W repozytorium:
  - ten raport;
  - `stage-reports/artifacts/analyzer-n8-03d2/` (wyłącznie liczby i teksty);
  - sonda `research/analyzer-n8-03d2/interior-probe.ts`.

Zielone testy i „geometry ok” nie oznaczają, że podział jest poprawny. Ocena należy do recenzenta.
