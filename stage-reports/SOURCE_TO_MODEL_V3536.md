# SOURCE-TO-MODEL v3.53.6 — obrys ścian i powierzchnie pomieszczeń (raport etapu)

**Zlecenie:** OWNER „BuildPlan v3.53.6 — obrys ścian i powierzchnie pomieszczeń" (2026-11-12). Tryb lokalny, bez nowych
płatnych wywołań, bez H2 i prywatnego benchmarku, ForgeShape tylko do odczytu, gałąź `claude/new-session-3kzcgh`,
`[skip ci]`, bez merge i PR. Baza: APK 1332 z `6ee8dee` (solver 2.37.0), raport bazy na `789e7e6`.

**Wynik w jednym akapicie.** Pokoje są teraz czytane na kondygnacji, a nie osobno pod każdą bryłą dachu: bryły, między
którymi rzut nie rysuje ściany, tworzą jedną strefę podłogi (`storey-zones.ts`) i `readInterior` czyta ją raz. Do tego:
styk, na którym leżą wyłącznie przegrody poprzeczne, jest otwarty; dwa prostokąty, które są jednym omurowanym
pomieszczeniem pociętym przez siatkę wymiarową, są jedną bryłą (`joinOpenSeams`); ściana wspólna na części boku
przesuwa podłogę tylko na tej części; podcień narożny pod dachem nie jest podłogą żadnego pokoju; trzy nowe reguły
drzwi (między narożnikami, przy ścianie poprzecznej, między ościeżami-występami) czytają drzwi wyłącznie z narysowanego
łuku i skrzydła. Solver `2.38.0`. Na czterech domach DEV liczba pomieszczeń zgodnych z arkuszem i zestawieniem
(±10 %) rośnie z 27 do 43 z 57; w zamrożonej próbie 12 domów (169 pomieszczeń) z 72 do
87, bez utraty żadnego wcześniej poprawnego pokoju; w regresji 80 przebiegów żaden model nie stracił
dopasowania ani nie zyskał błędu kompilacji. **To nie jest odbiór produktu:** w 5 z 12 domów próby reguły
nie zadziałały, a w próbie nadal 82 pomieszczeń jest scalonych, brakujących albo poza tolerancją — zakres
potwierdzonej poprawy i miejsca wciąż niewiarygodne do obmiaru są w §9 i §11.

---

## 1. Stan wyjściowy i odtworzenie 1332

- Kod bazy: `6ee8dee` w osobnym drzewie roboczym, z jedyną dodaną rzeczą — zrzutem diagnostycznym `floor-plan.json`
  (bryły, styki, odczyt wnętrza, rama rzutu jako tabela świat↔piksel), pisanym tylko pod `BUILDAPP_FEATURE_TRACE`.
  Zrzut nie zmienia modelu: skróty modeli z drzewa bazowego są równe skrótom dostawy 1332.
- Wejścia: te same zapieczętowane pakiety co w 1331/1332 (ekstrakcja zapisana, powtórka solvera), bez pobierania.

| dom (DEV) | arkusz rzutu parteru: bajty, SHA-256 (początek) | skala ramy [m/px] | początek ramy [px] | model 1332 | bryły 1332 |
|---|---|---|---|---|---|
| Macierzanki 4 G2 | 122 351 B, `2fb0a9ff1786c5d5` | 0,028855 | (96; 712) | `3b8ce6653524` | 5 |
| Bengali G2E | 99 737 B, `bc483689a17352e9` | 0,031914 | (172,5; 679) | `6f0c2232df5b` | 2 |
| Przebiśniegi 27 E | 102 595 B, `f695a1eb809cf753` | 0,025113 | (118; 700) | `456d3628585f` | 2 |
| Bakopy 5 E | 122 191 B, `3182991972ad03bb` | 0,026783 / 0,026921 | (97,5; 682) | `abdb3c48ab90` | 3 |

Skróty bajtów zgadzają się z zapisanymi w pakietach źródłowych. Punkty odniesienia oceny: po jednym punkcie na
pomieszczenie zestawienia, postawionym ręcznie na arkuszu tam, gdzie wydrukowany jest numer pokoju (piksele arkusza;
plik prywatny `seeds-dev.json`, SHA-256 `d394ebc7…`). Pokój jest identyfikowany przez punkt, nigdy przez własny odczyt
numeru analizatora. Arkuszy wydawcy i plansz nie ma w repozytorium.

Wszystkie cztery domy są w tym etapie **DEV**. Bengali G2E był w 3.53.5 domem próby; jego pierwszy wynik (model
`6f0c2232df5b`) zostaje zapisany jak wyżej.

## 2. Co mówią arkusze (ustalone przed zmianą)

**Macierzanki 4 G2 — „14,1 i 15,7 m²".** To nie są powierzchnie z zestawienia. Na arkuszu w sypialniach 7 i 8 wydrukowane
są wymiary w świetle 370 × 381 i 400 × 393 cm; ich iloczyny to 14,1 i 15,7 m² — prostokąt obejmujący wnękę na szafę.
Zestawienie wydawcy podaje powierzchnię podłogi netto: **13,04** (pokój 7) i **14,55 m²** (pokój 8). Model porównuję
z zestawieniem (ta sama definicja: podłoga między licami ścian), a iloczyn wymiarów pokazuję tylko jako objaśnienie
liczby z planszy. Fragmenty 9,2 i 10,1 m² z 1331 to części obu sypialni leżące pod bryłą tylną, ucięte na linii brył.

**Macierzanki — garaż.** Na arkuszu garaż to jedno pomieszczenie 600 × 599 cm (zestawienie: 35,46 m²). Wewnątrz nie
ma żadnej ściany ani drzwi; „drzwi 5,17 × 2,10 m" stały na granicy dwóch prostokątów, na które siatka wymiarowa
pocięła garaż, bo jego wschodnia ściana jest narysowana między liniami siatki (x 6,41–6,81 m): komórki grubości
ściany wyszły zabudowane przy drzwiach bocznych i niezabudowane przy litej ścianie.

**Bengali G2E.** Podcień wejściowy (wnęka w narożniku pod wspólnym dachem) leży poza ścianami; w 1332 był częścią
podłogi garażu (42,0 m² wobec 35,22 w zestawieniu). Drzwi pokoju 9 wiszą między dwoma narożnikami ścian.

**Przebiśniegi 27 E.** Taras narożny pod dachem jest poza ścianami (w 1332 liczony do strefy dziennej: 92,98 m² wobec
72,05 m² pięciu pomieszczeń razem). Drzwi pokoju 7 wiszą między dwoma krótkimi występami ścian (ościeżami). Kuchnia,
salon z jadalnią i korytarz (3, 4, 6) nie mają między sobą ściany ani drzwi: to prawdziwie otwarta strefa.

**Bakopy 5 E.** Przez styk bryły głównej i frontowej przechodzą tylko przegrody poprzeczne (ściana między pokojami
13 i 14); na samej linii styku nie ma ściany. W 1332 pokoje 10, 13 i 14 były przecięte podwójną ścianą z „drzwiami"
3 m. Spiżarnia, kuchnia i salon (3, 4, 5) są otwarte na siebie.

## 3. Pierwsza zła decyzja (od arkusza do sceny)

Pytanie zlecenia: w którym miejscu ścieżki powstaje rozbieżność — rama rzutu, ślad ścian, podział brył, zamykanie
regionów, łączenie regionów, przypisanie numeru, emisja poligonu.

| przypadek | rama | ślad ścian | **pierwsza zła decyzja** | skutek dalej |
|---|---|---|---|---|
| Macierzanki, pokoje 7 i 8 | zgodna (lica pokoi ±0,03 m) | przegrody odczytane | **odczyt wnętrza osobno pod każdą bryłą** (`reconstruct-v2.ts` wołał `readInterior` na prostokącie bryły): w bryle głównej zostaje 0,43 m przegrody 7\|8 — za krótkie, by być ścianą — a ściana wnęki i ościeże drzwi pokoju 7 leżą w pasie między wewnętrznymi licami obu brył, którego nie widział żaden z dwóch odczytów | skrawki 7 i 8 należą do otwartego regionu bryły głównej (66,9 m²); `joinAcrossOpenContacts` łączy potem wszystko w jeden region 104 m² |
| Macierzanki, garaż | zgodna | wschodnia ściana między liniami siatki | **podział brył** (`plan-decomposition`: dwa prostokąty + porzucony pas 1,10 m), potem **styk** `UNDECIDED` (tusz narożników 0,147 wobec progu 0,15) → dwie ściany | „drzwi" 5,17 m w ścianie, której arkusz nie rysuje; garaż 20,27 m² scalony z wiatrołapem |
| Bakopy, pokoje 10, 13, 14 | zgodna | przegrody odczytane | **decyzja o styku** (`party-wall.ts`): 5 z 224 próbek na linii to tusz przegrody, która linię przecina; liczone jak ściana na linii → `UNDECIDED` → dwie ściany | pokoje przecięte, „drzwi" 3 m |
| Przebiśniegi, pokój 7 i strefa dzienna | zgodna | zgodny | **podłoga bryły** (`interiorRect`): ściana wspólna na części boku przesuwała krawędź podłogi na całym boku; taras narożny liczony jako podłoga; drzwi między występami nieczytane | 7 = 7,54 m² (−49 %), strefa dzienna +27 % |
| Bengali, garaż i pokój 9 | zgodna | zgodny | **zamykanie regionu**: wnęka narożna pod dachem nie była wyłączona z podłogi; przerwa między dwoma narożnikami traktowana jako szerokość pokoju | garaż +19 %, 3+9 scalone |

Hipoteza zlecenia („`readInterior` osobno na prostokącie każdej bryły, potem `joinAcrossOpenContacts`") **potwierdzona
pomiarem** dla Macierzanek i jest wspólnym mianownikiem pozostałych przypadków: każdy z nich to pokój albo przegroda
leżąca na technicznej linii podziału brył. Rama rzutu nie jest przyczyną w żadnym z czterech domów (odchyłki lic
pokoi od narysowanych ścian po promieniach z punktów odniesienia: mediana 0,02–0,05 m).

Numer pokoju i jego przypisanie mają własny ślad (kolumna „numer" w tabelach §6 i §9) i **nie były przyczyną** żadnej
z rozbieżności pola; nie zmieniałem ich w tym etapie.

### Hipotezy sprawdzone i odrzucone

- „Pole jest złe, bo zła skala" — odrzucone: pokoje, których linia brył nie przecina, mają w 1332 pola w ±6 %.
- „Wystarczy lepiej łączyć fragmenty po odczycie" — odrzucone: po odczycie pod bryłą nie ma już informacji o ścianie
  wnęki i ościeżu w pasie między licami; łączenie może tylko skleić wszystko, co się styka.
- „Każdy styk bez ciągłej ściany jest otwarty" — odrzucone na korpusie: wąski pas grubości ściany (Wisterie) dawał
  bryłę-drzazgę; nowa ewidencja (tusz wzdłuż linii, przerysowana elewacja) jest słuchana tylko tam, gdzie obie bryły
  mają głębokość pokoju.

## 4. Zmiana

Rewizja kodu: `9824e17`. Solver `2.37.0` → `2.38.0`. Żadna nazwa, adres, wydawca, skrót ani współrzędna projektu
nie wybiera zachowania; progi są stałymi nazwanymi w kodzie z uzasadnieniem.

1. **Strefy kondygnacji** (`packages/reconstruction/src/v2/storey-zones.ts`, nowy). Bryły połączone stykiem otwartym
   albo przejściem w ścianie wspólnej tworzą strefę; jej podłoga to podłogi brył i pasy między ich wewnętrznymi
   licami. `reconstruct-v2.ts` czyta każdą strefę raz (`readInterior` z `domain`), identyfikatory ścian, drzwi i pokoi
   niosą przedrostek pierwszej bryły strefy, pokój należy do brył, pod którymi leży. `joinAcrossOpenContacts` usunięte
   z solvera (nie ma czego łączyć).
2. **Podłoga bryły przy ścianie na części boku** (`floorOfBody`): krawędź podłogi przesuwa się na lico ściany wspólnej
   tylko tam, gdzie ta ściana jest.
3. **Styk** (`party-wall.ts`): tusz liczony osobno „wzdłuż linii" (odcinki ≥ 0,5 m) i „w poprzek" (przegrody
   przecinające linię); styk bez tuszu wzdłuż jest otwarty. Koniec styku na licu wspólnej elewacji jest zamknięty
   także wtedy, gdy elewacja jest tam przerysowana oknem (≥ 90 % pozycji narysowanych). Obie nowe przesłanki tylko dla
   brył głębszych niż dwie ściany + 0,2 m.
4. **Jedno omurowane pomieszczenie pocięte przez siatkę** (`joinOpenSeams` w `plan-decomposition.ts`, wołane
   z `layout.ts`): dwa prostokąty bez ściany na szwie (≤ 10 % szwu, mierzone tylko po pasmach biegnących wzdłuż szwu),
   różniące się o mniej niż szerokość bryły, są jedną bryłą; prostokąt wokół obu może wchłonąć tylko pasy i komórki
   grubości ściany. Bok takiej bryły stojący na wewnętrznym licu narysowanej ściany jest przesuwany na jej lico
   zewnętrzne (`toDrawnWall`) — **wyłącznie** dla brył powstałych z tego złączenia (patrz §10, konflikt z 005Q).
5. **Wnęka narożna pod dachem nie jest podłogą**: odczyt w dwóch przejściach — po pierwszym `readCornerNotch` dla
   każdego narożnika, prostokąt wnęki z jej tylnymi ścianami staje się barierą drugiego odczytu.
6. **Ściana ucięta krawędzią podłogi** (tylko w strefie): krótki koniec ściany stojący na podłodze, którego tusz
   biegnie dalej poza podłogę w miejscu ściany zewnętrznej, jest ścianą.
7. **Trzy reguły drzwi, wyłącznie z narysowanego skrzydła** (`swingArcInDoorway`): między dwoma narożnikami, między
   końcem przegrody a ścianą w poprzek jej linii, między dwoma występami-ościeżami. Uruchamiane po dotychczasowych
   regułach (identyfikatory istniejących drzwi nie zmieniają kolejności). Dowód: ≥ 80 % ćwierćłuku próbkowanego co
   około piksel leży na **linii** (piksel ciemniejszy o ≥ 25 od arkusza trzy piksele po obu stronach — krawędź tonu
   znaku wodnego nie jest linią), skrzydło domyka przejście (zawias i koniec łuku do 0,15 m od ościeży), przejście jest
   wolne od skrzydła narysowanego w nim (ten sam łuk należy wtedy do drzwi w ścianie prostopadłej) i skrzydło jest
   narysowane obok łuku (cienka linia albo obrys szarego paska; ściana, przy której skrzydło stoi, nie jest skrzydłem).
   Bez drzwi na barierze schodów. Każde rozważone przejście zostawia ślad w dzienniku solvera (udział łuku, hipoteza,
   decyzja), a przyjęte drzwi niosą ten udział w swoim uzasadnieniu.

Czego zmiana **nie** robi: nie skaluje żadnego poligonu do liczby z zestawienia (deklaracja jest tylko kontrolą
w ocenie), nie dzieli otwartej strefy dziennej wymyśloną granicą (zostaje jeden poligon z flagą `openPlan`), nie
zmienia odczytu numerów pokoi ani dachów.

### Zaostrzenie reguł drzwi w trakcie etapu (zapis)

Pierwsza wersja nowych reguł przyjmowała łuk tak jak dotychczasowy `swingDrawn` (12 próbek, 70 %, dowolny tusz).
Przegląd wszystkich 77 takich drzwi w zbiorach DEV i regresyjnych na wycinkach arkuszy pokazał 13–16 fałszywych
(bieg schodów, krzyż szafy, kabina prysznica, kominek, zlew) — w tym jedne w Marcówkach z nowym błędem kompilacji.
Reguły zaostrzono do postaci z punktu 7; na partii kontrolnej przyjęte łuki mają 87–100 %, odrzucone ≤ 61 %.
Koszt: prawdziwe drzwi z bardzo jasnym łukiem (A01, udział 58 %) nie są czytane. Brak odczytu jest tu tańszy niż
fałszywe drzwi.

## 5. Testy przyczyny i kontrpróby

Dwa nowe pliki, 35 testów, wszystkie PASS na rewizji dostawy.

**`packages/reconstruction/test/storey-rooms-whole-path-v3536.test.ts` — przez cały potok** (arkusze PNG → pakiet
źródłowy → analizator → `reconstructV2` → program → kompilacja). Dom w kształcie L, 8,4 × 6,8 m ze skrzydłem
4,2 × 5,0 m, bez ściany między bryłami; dwa pokoje frontowe leżą po obu stronach linii, na której rzut jest cięty
(z ≈ 2,0 m), a linię przecinają tylko ich ściany boczne. Plik używa wyłącznie wejścia potoku, więc biegnie bez zmian
na kodzie bazy:

| rewizja | wynik |
|---|---|
| `6ee8dee` (1332) | **FAIL**: punkt (1,8; 1,0) leży w `attached-0-room-0-0`, punkt (1,8; 3,0) tego samego pokoju w `main-room-0-0` — pokój przecięty linią brył (dziennik prywatny `whole-path-on-1332.log`) |
| dostawa | **PASS**: 3 pokoje, oba frontowe po jednym poligonie po obu stronach linii, pola w 6 % od narysowanych (8,17 / 8,17 wobec 8,60 / 8,42 m²), 2 drzwi wewnętrzne, 0 błędów walidacji, żadnej ściany na linii brył |

**`packages/reconstruction/test/storey-rooms-v3536.test.ts` — kontrpróby na wymyślonych rzutach (50 px/m):**

| zlecona kontrpróba | test | wynik |
|---|---|---|
| pokój przecięty wyłącznie granicą dachu | dwie sypialnie 3,55 × 4,0 m przez linię z = 6: 3 pokoje, każdy w całości | PASS |
| ten sam rzut z dwoma technicznymi podziałami brył | podział w poprzek, wzdłuż i brak podziału: ta sama liczba pokoi, pola w 0,45 m², lica w 0,10 m | PASS |
| dwa pokoje z rzeczywistą przegrodą i drzwiami | zostają dwoma pokojami w strefie, każdy z własnymi drzwiami | PASS |
| otwarta strefa dzienna | jeden poligon przez linię, flaga `openPlan`, żadnej granicy na linii | PASS |
| podcień lub pustka | wnęka pod dachem wyłączona z podłogi (−6,4 m², punkt we wnęce w żadnym pokoju) | PASS |
| weryfikacja po kompilacji | program ze strefy: 3 pokoje, 2 drzwi, walidacja bez błędów, żadnej ściany zewnętrznej na linii | PASS |
| ściana na każdym boku | każda bryła własną strefą, podłoga jak dotąd | PASS |
| ściana wspólna na części boku / z przerwą | podłoga przesunięta tylko na tej części; połączenie tylko na przerwie | PASS |
| garaż i wiatrołap: ściana ucięta krawędzią podłogi + drzwi przy ścianie poprzecznej | ze skrzydłem dwa pokoje, garaż 21 m² do swojej tylnej ściany; bez skrzydła żadnych drzwi | PASS |
| drzwi między występami | łuk i skrzydło → drzwi; łuk bez skrzydła, skrzydło w przejściu, łuk niedomykający przejścia, krawędź tonu po łuku, stopnie schodów, występy bez łuku, bariera schodów → brak drzwi; skrzydło jako szary pasek → drzwi | PASS (10) |
| drzwi między narożnikami | ze skrzydłem drzwi; bez — szerokość pokoju jak dotąd | PASS |
| styk tylko z przegrodami poprzecznymi | otwarty; metr ściany wzdłuż linii → nie; okno we wspólnej elewacji → otwarty; nic narysowanego na końcu → `UNDECIDED`; pas grubości ściany → bez nowej ewidencji | PASS (5) |
| dwa prostokąty jednego pomieszczenia | złączone; ściana na szwie, skrzydło szersze od bryły, otwarty grunt w narożniku → dwie bryły; ściany boczne przecinające szew nie przeszkadzają | PASS (5) |

Plik jednostkowy nie biegnie na 1332 (funkcje `storeyZones`, `joinOpenSeams`, opcja `domain` tam nie istnieją) — dowodem
przyczyny na kodzie bazy jest test przez cały potok.

## 6. DEV: cztery domy — PRZED i PO na tych samych bajtach (po kompilacji)

Statusy: **OK** — własny poligon, pole w ±10 % deklarowanego; **OPEN_OK** — jeden poligon dla pomieszczeń, między
którymi arkusz nie rysuje ściany ani drzwi, w ±10 % sumy deklarowanej; **AREA_OFF** — własny poligon poza ±10 %;
**MERGED** — poligon obejmuje pomieszczenia, które arkusz rozdziela (albo strefa otwarta poza ±10 %); **MISSING** —
punkt pomieszczenia nie leży w żadnym poligonie. Pole geometryczne to poligon `createRoom` modelu (bez otworów),
deklarowane — zestawienie wydawcy. Kolumna „numer": czy analizator sam odczytał numer tego pokoju (`READ`), nie odczytał
(`NOT_READ`), czy przypisał inny (`WRONG:n`) — osobny ślad identyfikacji, niezależny od oceny pola. Tabele obejmują
parter (kondygnację z punktami odniesienia).

| dom | 1332: OK + OPEN_OK | PO: OK + OPEN_OK | z | AREA_OFF PO | MERGED PO | bryły | błędy kompilacji |
|---|---|---|---|---|---|---|---|
| Macierzanki 4 G2 | 3 | **8** | 14 | 1 | 5 | 5 → 4 | 0 → 0 |
| Bengali G2E | 7 | **9** | 15 | 2 | 4 | 2 → 2 | 0 → 0 |
| Przebiśniegi 27 E | 7 | **13** | 13 | 0 | 0 | 2 → 2 | 0 → 0 |
| Bakopy 5 E | 10 | **13** | 15 | 0 | 2 | 3 → 3 | 0 → 0 |
| **razem** | **27** | **43** | **57** | 3 | 11 | | |

Żaden pokój poprawny w 1332 nie został utracony.

**Odpowiedź na punkt diagnostyczny (Macierzanki 4 G2).** Sypialnie 7 i 8 są osobnymi poligonami 12,84 i 14,43 m²
wobec 13,04 i 14,55 m² w zestawieniu (−1,6 % i −0,8 %); garaż jest jednym poligonem 35,35 m² wobec 35,46 m² (−0,3 %),
jedną bryłą `[0..6,86] × [0..4,82]` m z jednym dachem zamiast dwóch; „drzwi" 5,17 × 2,10 m nie ma; wiatrołap 5,95 m²
wobec 6,12 jest osobnym pokojem z drzwiami do garażu. Liczby 14,1 i 15,7 m² z planszy to iloczyny wymiarów w świetle
(§2), nie zestawienie.

**Macierzanki 4 G2** — parter; model `3b8ce6653524` → `9f68a9f95725`; bryły 5 → 4; kompilacja 0E/0W → 0E/0W; wynik: **IMPROVED** (zyskane: 1, 7, 8, 9, 14)

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 6.12 | 20.27 | -21.31 m² / -51.3 % (razem dekl. 41.58) | MERGED z 14 | main-room-0-1 | 5.95 | -0.17 m² / -2.7 % | OK | NOT_READ |
| 2 | Hol | 4.27 | 104.40 | +2.51 m² / +2.5 % (razem dekl. 101.89) | MERGED z 4,7,8,9,10,11,12,13 | main-room-0-2 | 65.11 | -0.99 m² / -1.5 % (razem dekl. 66.1) | MERGED z 4,11,12,13 | NOT_READ |
| 3 | Kotłownia z pralnią | 4.45 | 4.33 | -0.12 m² / -2.8 % | OK | main-room-0-4 | 4.37 | -0.08 m² / -1.7 % | OK | NOT_READ |
| 4 | Korytarz | 8.51 | 104.40 | +2.51 m² / +2.5 % (razem dekl. 101.89) | MERGED z 2,7,8,9,10,11,12,13 | main-room-0-2 | 65.11 | -0.99 m² / -1.5 % (razem dekl. 66.1) | MERGED z 2,11,12,13 | NOT_READ |
| 5 | Pokój | 11.29 | 11.12 | -0.17 m² / -1.5 % | OK | main-room-0-3 | 11.11 | -0.18 m² / -1.6 % | OK | NOT_READ |
| 6 | Łazienka | 7.21 | 6.84 | -0.37 m² / -5.1 % | OK | main-room-0-6 | 6.84 | -0.37 m² / -5.1 % | OK | READ |
| 7 | Pokój | 13.04 | 104.40 | +2.51 m² / +2.5 % (razem dekl. 101.89) | MERGED z 2,4,8,9,10,11,12,13 | main-room-0-9 | 12.84 | -0.20 m² / -1.6 % | OK | READ |
| 8 | Pokój | 14.55 | 104.40 | +2.51 m² / +2.5 % (razem dekl. 101.89) | MERGED z 2,4,7,9,10,11,12,13 | main-room-0-8 | 14.43 | -0.12 m² / -0.8 % | OK | NOT_READ |
| 9 | Garderoba | 4.69 | 104.40 | +2.51 m² / +2.5 % (razem dekl. 101.89) | MERGED z 2,4,7,8,10,11,12,13 | main-room-0-7 | 4.51 | -0.18 m² / -3.9 % | OK | NOT_READ |
| 10 | Łazienka | 3.51 | 104.40 | +2.51 m² / +2.5 % (razem dekl. 101.89) | MERGED z 2,4,7,8,9,11,12,13 | main-room-0-5 | 3.14 | -0.37 m² / -10.6 % | AREA_OFF | NOT_READ |
| 11 | Salon + Jadalnia | 34.16 | 104.40 | +2.51 m² / +2.5 % (razem dekl. 101.89) | MERGED z 2,4,7,8,9,10,12,13 | main-room-0-2 | 65.11 | -0.99 m² / -1.5 % (razem dekl. 66.1) | MERGED z 2,4,12,13 | NOT_READ |
| 12 | Kuchnia | 15.04 | 104.40 | +2.51 m² / +2.5 % (razem dekl. 101.89) | MERGED z 2,4,7,8,9,10,11,13 | main-room-0-2 | 65.11 | -0.99 m² / -1.5 % (razem dekl. 66.1) | MERGED z 2,4,11,13 | NOT_READ |
| 13 | Spiżarnia | 4.12 | 104.40 | +2.51 m² / +2.5 % (razem dekl. 101.89) | MERGED z 2,4,7,8,9,10,11,12 | main-room-0-2 | 65.11 | -0.99 m² / -1.5 % (razem dekl. 66.1) | MERGED z 2,4,11,12 | NOT_READ |
| 14 | Garaż | 35.46 | 20.27 | -21.31 m² / -51.3 % (razem dekl. 41.58) | MERGED z 1 | main-room-0-0 | 35.35 | -0.11 m² / -0.3 % | OK | NOT_READ |

Razem: 1332 — OK 3, MERGED 11; PO — OK 8, AREA_OFF 1, MERGED 5.

**Bengali G2E** — parter; model `6f0c2232df5b` → `a2b574be78ff`; bryły 2 → 2; kompilacja 0E/0W → 0E/0W; wynik: **IMPROVED** (zyskane: 9, 15)

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 5.22 | 4.88 | -0.34 m² / -6.5 % | OK | main-room-0-2 | 4.71 | -0.51 m² / -9.8 % | OK | NOT_READ |
| 2 | Kotłownia z pralnią | 4.74 | 4.43 | -0.31 m² / -6.5 % | OK | main-room-0-1 | 4.32 | -0.42 m² / -8.8 % | OK | READ |
| 3 | Korytarz | 13.61 | 23.12 | -3.15 m² / -12.0 % (razem dekl. 26.27) | MERGED z 9 | main-room-0-3 | 10.85 | -2.76 m² / -20.3 % | AREA_OFF | NOT_READ |
| 4 | Kuchnia | 13.7 | 37.06 | -4.12 m² / -10.0 % (razem dekl. 41.18) | MERGED z 5 | attached-0-room-0-0 | 37.06 | -4.12 m² / -10.0 % (razem dekl. 41.18) | MERGED z 5 | NOT_READ |
| 5 | Salon + Jadalnia | 27.48 | 37.06 | -4.12 m² / -10.0 % (razem dekl. 41.18) | MERGED z 4 | attached-0-room-0-0 | 37.06 | -4.12 m² / -10.0 % (razem dekl. 41.18) | MERGED z 4 | NOT_READ |
| 6 | Spiżarnia | 2.93 | 2.66 | -0.27 m² / -9.3 % | OK | main-room-0-6 | 2.66 | -0.27 m² / -9.3 % | OK | NOT_READ |
| 7 | Łazienka | 5.57 | 5.67 | +0.10 m² / +1.8 % | OK | main-room-0-7 | 5.67 | +0.10 m² / +1.8 % | OK | READ |
| 8 | Garderoba | 5.16 | 5.12 | -0.04 m² / -0.8 % | OK | main-room-0-8 | 5.12 | -0.04 m² / -0.8 % | OK | READ |
| 9 | Pokój | 12.66 | 23.12 | -3.15 m² / -12.0 % (razem dekl. 26.27) | MERGED z 3 | main-room-0-9 | 11.95 | -0.71 m² / -5.6 % | OK | WRONG:4 |
| 10 | Garderoba | 2.73 | 2.34 | -0.39 m² / -14.3 % | AREA_OFF | main-room-0-11 | 2.34 | -0.39 m² / -14.3 % | AREA_OFF | NOT_READ |
| 11 | Pokój | 12.22 | 11.57 | -0.65 m² / -5.3 % | OK | main-room-0-10 | 11.57 | -0.65 m² / -5.3 % | OK | NOT_READ |
| 12 | Pokój | 12.22 | 15.55 | +0.35 m² / +2.3 % (razem dekl. 15.2) | MERGED z 13 | main-room-0-5 | 15.55 | +0.35 m² / +2.3 % (razem dekl. 15.2) | MERGED z 13 | READ |
| 13 | Garderoba | 2.98 | 15.55 | +0.35 m² / +2.3 % (razem dekl. 15.2) | MERGED z 12 | main-room-0-5 | 15.55 | +0.35 m² / +2.3 % (razem dekl. 15.2) | MERGED z 12 | WRONG:12 |
| 14 | Łazienka | 3.01 | 2.93 | -0.08 m² / -2.7 % | OK | main-room-0-4 | 2.93 | -0.08 m² / -2.7 % | OK | READ |
| 15 | Garaż | 35.22 | 42.00 | +6.78 m² / +19.3 % | AREA_OFF | main-room-0-0 | 35.24 | +0.02 m² / +0.1 % | OK | READ |

Razem: 1332 — OK 7, AREA_OFF 2, MERGED 6; PO — OK 9, AREA_OFF 2, MERGED 4.

**Przebiśniegi 27 E** — parter; model `456d3628585f` → `a81fa9eb3f62`; bryły 2 → 2; kompilacja 0E/0W → 0E/0W; wynik: **IMPROVED** (zyskane: 1, 3, 4, 5, 6, 7)

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 6.9 | 92.98 | +19.91 m² / +27.3 % (razem dekl. 73.07) | MERGED z 3,4,5,6 | main-room-0-5 | 7.00 | +0.10 m² / +1.5 % | OK | READ |
| 2 | Kotłownia z pralnią | 5.38 | 5.40 | +0.02 m² / +0.4 % | OK | main-room-0-6 | 5.40 | +0.02 m² / +0.4 % | OK | NOT_READ |
| 3 | Kuchnia | 14.57 | 92.98 | +19.91 m² / +27.3 % (razem dekl. 73.07) | MERGED z 1,4,5,6 | main-room-0-3 | 61.91 | -1.24 m² / -2.0 % (razem dekl. 63.15) | OPEN_OK z 4,6 | NOT_READ |
| 4 | Salon + Jadalnia | 38.05 | 92.98 | +19.91 m² / +27.3 % (razem dekl. 73.07) | MERGED z 1,3,5,6 | main-room-0-3 | 61.91 | -1.24 m² / -2.0 % (razem dekl. 63.15) | OPEN_OK z 3,6 | NOT_READ |
| 5 | Spiżarnia | 3.02 | 92.98 | +19.91 m² / +27.3 % (razem dekl. 73.07) | MERGED z 1,3,4,6 | main-room-0-4 | 2.99 | -0.03 m² / -1.0 % | OK | NOT_READ |
| 6 | Korytarz | 10.53 | 92.98 | +19.91 m² / +27.3 % (razem dekl. 73.07) | MERGED z 1,3,4,5 | main-room-0-3 | 61.91 | -1.24 m² / -2.0 % (razem dekl. 63.15) | OPEN_OK z 3,4 | NOT_READ |
| 7 | Pokój | 14.69 | 7.54 | -7.15 m² / -48.7 % | AREA_OFF | main-room-0-0 | 14.01 | -0.68 m² / -4.6 % | OK | READ |
| 8 | Garderoba | 5.51 | 5.54 | +0.03 m² / +0.5 % | OK | main-room-0-1 | 5.54 | +0.03 m² / +0.5 % | OK | WRONG:11 |
| 9 | Pokój | 10.3 | 10.53 | +0.23 m² / +2.2 % | OK | main-room-0-2 | 10.53 | +0.23 m² / +2.2 % | OK | WRONG:4 |
| 10 | Łazienka | 6.46 | 6.35 | -0.11 m² / -1.8 % | OK | main-room-0-7 | 6.48 | +0.02 m² / +0.3 % | OK | NOT_READ |
| 11 | Pokój | 11.14 | 11.26 | +0.12 m² / +1.1 % | OK | main-room-0-10 | 11.26 | +0.12 m² / +1.1 % | OK | NOT_READ |
| 12 | Pokój | 11.16 | 11.08 | -0.08 m² / -0.7 % | OK | main-room-0-9 | 11.08 | -0.08 m² / -0.7 % | OK | NOT_READ |
| 13 | Łazienka | 4.07 | 3.98 | -0.09 m² / -2.3 % | OK | main-room-0-8 | 3.98 | -0.09 m² / -2.3 % | OK | WRONG:11 |

Razem: 1332 — OK 7, AREA_OFF 1, MERGED 5; PO — OK 10, OPEN_OK 3.

**Bakopy 5 E** — parter; model `abdb3c48ab90` → `7ccfe641ba30`; bryły 3 → 3; kompilacja 0E/2W → 0E/2W; wynik: **IMPROVED** (zyskane: 10, 13, 14)

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 5.5 | 5.05 | -0.45 m² / -8.1 % | OK | main-room-0-2 | 5.05 | -0.45 m² / -8.1 % | OK | NOT_READ |
| 2 | Korytarz | 12.89 | 11.67 | -1.22 m² / -9.5 % | OK | main-room-0-4 | 11.67 | -1.22 m² / -9.5 % | OK | READ |
| 3 | Spiżarnia | 3.67 | 52.10 | +3.20 m² / +6.6 % (razem dekl. 48.9) | OPEN_OK z 4,5 | main-room-0-3 | 48.29 | -0.61 m² / -1.2 % (razem dekl. 48.9) | OPEN_OK z 4,5 | NOT_READ |
| 4 | Kuchnia | 14.11 | 52.10 | +3.20 m² / +6.6 % (razem dekl. 48.9) | OPEN_OK z 3,5 | main-room-0-3 | 48.29 | -0.61 m² / -1.2 % (razem dekl. 48.9) | OPEN_OK z 3,5 | NOT_READ |
| 5 | Salon + Jadalnia | 31.12 | 52.10 | +3.20 m² / +6.6 % (razem dekl. 48.9) | OPEN_OK z 3,4 | main-room-0-3 | 48.29 | -0.61 m² / -1.2 % (razem dekl. 48.9) | OPEN_OK z 3,4 | NOT_READ |
| 6 | Łazienka | 3.97 | 3.84 | -0.13 m² / -3.2 % | OK | main-room-0-8 | 3.84 | -0.13 m² / -3.2 % | OK | READ |
| 7 | Łazienka | 7.32 | 7.13 | -0.19 m² / -2.6 % | OK | main-room-0-9 | 7.20 | -0.12 m² / -1.7 % | OK | NOT_READ |
| 8 | Pokój | 16.26 | 19.95 | -0.34 m² / -1.7 % (razem dekl. 20.29) | MERGED z 9 | main-room-0-11 | 20.33 | +0.04 m² / +0.2 % (razem dekl. 20.29) | MERGED z 9 | READ |
| 9 | Garderoba | 4.03 | 19.95 | -0.34 m² / -1.7 % (razem dekl. 20.29) | MERGED z 8 | main-room-0-11 | 20.33 | +0.04 m² / +0.2 % (razem dekl. 20.29) | MERGED z 8 | WRONG:8 |
| 10 | Pokój | 12.24 | 5.90 | -6.34 m² / -51.8 % | AREA_OFF | main-room-0-10 | 11.84 | -0.40 m² / -3.2 % | OK | READ |
| 11 | Pralnia | 5.15 | 4.94 | -0.21 m² / -4.1 % | OK | main-room-0-7 | 4.94 | -0.21 m² / -4.1 % | OK | READ |
| 12 | Kotłownia | 6.31 | 6.01 | -0.30 m² / -4.8 % | OK | main-room-0-6 | 6.01 | -0.30 m² / -4.8 % | OK | READ |
| 13 | Pokój | 14.03 | 6.04 | -7.98 m² / -56.9 % | AREA_OFF | main-room-0-0 | 13.58 | -0.45 m² / -3.2 % | OK | READ |
| 14 | Pokój | 12.36 | 4.30 | -8.06 m² / -65.2 % | AREA_OFF | main-room-0-1 | 12.10 | -0.26 m² / -2.1 % | OK | NOT_READ |
| 15 | Garderoba | 2.95 | 2.79 | -0.16 m² / -5.3 % | OK | main-room-0-5 | 2.79 | -0.16 m² / -5.3 % | OK | NOT_READ |

Razem: 1332 — OK 7, OPEN_OK 3, AREA_OFF 3, MERGED 2; PO — OK 10, OPEN_OK 3, MERGED 2.

**Co zostaje złe w DEV i dlaczego (jawnie):**

- Macierzanki: hol, korytarz, salon z jadalnią i kuchnia (2, 4, 11, 12) to na arkuszu jedna otwarta strefa — model
  trzyma ją jako jeden poligon 65,11 m² (suma deklarowana z spiżarnią 66,10 m²), ale **spiżarnia 13 jest w niej
  scalona**: jej wejście to drzwi obok zabudowy kuchennej, których żadna reguła nie czyta. Łazienka 10: 3,14 wobec
  3,51 m² (−10,6 %).
- Bengali: korytarz 3 ma 10,85 wobec 13,61 m² (−20 %; część korytarza przy schodach nie jest jego podłogą w modelu),
  garderoba 10 −14 %; pokój 12 i garderoba 13 scalone (drzwi przesuwne bez łuku); kuchnia 4 i salon 5 otwarte na
  siebie mają razem 37,06 wobec 41,18 m² (−10,0 %, tuż poza tolerancją). Na styku brył została podwójna ściana
  (`UNDECIDED`).
- Bakopy: pokój 8 i garderoba 9 scalone (garderoba otwarta na pokój bez narysowanych drzwi).
- Odczyt numerów: w czterech domach analizator sam odczytał 17 z 57 numerów, 6 przypisał błędnie. Nie ruszane w tym
  etapie.

**Lica.** Odchyłka lica poligonu od narysowanej ściany po promieniach z punktów odniesienia (tylko promienie, które
trafiają ścianę w 0,3 m od krawędzi poligonu): DEV 1332 — 131 z 228 promieni, mediana 0,03 m, p90 0,05 m; PO — 152
z 228, mediana 0,025 m, p90 0,05 m. Systematyczne −2…−5 % pola małych pokoi pochodzi z siatki 5 cm, na której liczony
jest poligon (lico cofnięte o do 5 cm z każdej strony).

## 7. Obrys zewnętrzny — pomiar niezależny od solvera

Dla każdej ściany zewnętrznej parteru skompilowanego modelu: punkty co 0,25 m wzdłuż zewnętrznego lica, w poprzek
szukany najbliższy pas tuszu ściany na arkuszu (≥ 3 px ciemnego, neutralnego, do 0,8 m); odchyłka = lico modelu minus
zewnętrzna krawędź pasa. Okna i bramy nie mają tuszu ściany, więc udział „na ścianie" nie sięga 100 % nawet przy
idealnym obrysie; miara jest wskaźnikowa (pas tarasu albo donicy przed ścianą może dać fałszywe „odsunięcie").

| dom | 1332: długość ścian zewn. | 1332: bez narysowanej ściany | 1332: odsunięte > 0,25 m | PO: długość | PO: bez narysowanej ściany | PO: odsunięte > 0,25 m |
|---|---|---|---|---|---|---|
| Macierzanki 4 G2 (DEV) | 91,48 m | 22,81 m | 10,98 m | **79,54 m** | **4,57 m** | 6,16 m |
| Bakopy 5 E (DEV) | 83,72 m | 7,05 m | 0 | **70,11 m** | **0** | 0 |
| Dzwonki 3 (próba) | 100,38 m | 34,29 m | 4,74 m | **83,57 m** | **17,48 m** | 4,74 m |
| Przebiśniegi 27 E (DEV) | 71,14 m | 3,49 m | 2,80 m | bez zmian | | |
| Bengali G2E (DEV) | 87,63 m | 0 | 10,10 m | bez zmian | | |

„Bez narysowanej ściany" to ściany, których mniej niż jedna piąta długości stoi na tuszu ściany — w 1332 były to
przede wszystkim ściany postawione na technicznej linii brył (w Macierzankach 22,8 m, w Bakopach 7,05 m). W pozostałych
jedenastu domach próby obrys się nie zmienił; ich wartości wyjściowe (np. Karmazyny 23,8 m odsunięte, Santoliny 19,0 m,
Chelone 18,3 m, Nigelle 26,0 m bez ściany) są listą miejsc, w których obrys nadal nie odpowiada rzutowi (§11).

## 8. Regresja (rewizja dostawy, te same zapieczętowane wejścia co 1331/1332)

80 przebiegów: korpus 33, niezależne 9 (4 + 5), świeże 3.53.4 — 10, rozszerzenie 3.53.4 — 8, zbiór próby 3.53.5 — 20.
Wszystkie 80 zakończone (`exit 0`). Wynik (model albo odmowa) nie zmienił się w żadnym.

| zbiór | przebiegi | identyczny model | zmieniony model | odmowa po obu stronach | dopasowanie wsk. w górę | bez zmiany | w dół | nowe błędy kompilacji | zmieniony obrys |
|---|---|---|---|---|---|---|---|---|---|
| korpus | 33 | 10 | 19 | 4 | 10 | 9 | 0 | 0 | 1 (Bratki) |
| niezależne | 9 | 3 | 5 | 1 | 3 | 2 | 0 | 0 | 1 (Bakopy) |
| świeże 3.53.4 | 10 | 0 | 6 | 4 | 3 | 3 | 0 | 0 | 1 (Macierzanki) |
| rozszerzenie 3.53.4 | 8 | 0 | 6 | 2 | 3 | 3 | 0 | 0 | 0 |
| zbiór próby 3.53.5 | 20 | 5 | 8 | 7 | 6 | 2 | 0 | 0 | 1 (Dzwonki) |
| **razem** | **80** | **18** | **44** | **18** | **25** | **19** | **0** | **0** | **4** |

„Dopasowanie wskaźnikowe" to liczba pomieszczeń zestawienia, którym jakiś poligon odpowiada jeden do jednego w ±10 %
— bez punktów odniesienia nie mówi, *który* to pokój, więc jest tylko wskaźnikiem; twardą ocenę dają tabele z punktami
(§6, §9). **Poprawy 25, pogorszenia 0, odmowy 18 (te same po obu stronach), bez działania reguły 18.** W 19 zmienionych
modelach bez zmiany wskaźnika przybyły drzwi lub pokój albo z podłogi wyłączono wnękę pod dachem (Ciesz: zadaszony
taras narożny nie należy już do holu, 77,75 → 63,76 m², a toaleta 3 jest osobnym pokojem — sprawdzone na arkuszu;
Litodory: taras narożny 18,1 m² poza salonem; Renklody). Nowe ostrzeżenia kompilacji `WALL_NOT_UNDER_ROOF` w trzech
domach (Bratki 0 → 1, Dzwonki 0 → 2, Wasabi 0 → 1): przegroda czytana teraz w całości przechodzi pod sąsiednią bryłę
i poza dachem, za którym „idzie", zachowuje wysokość nominalną — do poprawy przy dachach.

Sprawdzone osobno (zlecone przypadki 1331/1332 i dachy): **Marcówki** — 0 błędów (jedne fałszywe drzwi z pierwszej
wersji reguł dawały tam błąd; po zaostrzeniu ich nie ma), poddasze: pokój 7 oddzielony od korytarza; **Karmazyny 2** —
model identyczny; **Telimy 4** — dachy i ściany bez zmian, jeden poligon −0,08 m²; **Litodory, Przebiśniegi, Bakopy** —
dachy bez zmian; liczba dachów i połaci zmieniła się tylko w Macierzankach (dwa dachy części garażu → jeden).
Bratki (korpus): pokój 5 przechodzący przez linię wykusza ma 9,49 wobec 10,01 m² (w 1332: 5,62 m² i „drzwi" 2,76 m
na linii brył).

## 9. Świeża próba (pakiety, geometria odniesienia, definicje i tolerancje zamrożone przed oceną)

### 9.1 Protokół

Zamrożone w pliku prywatnym `FROZEN_V3536.md` (SHA-256 `59bd394a…`) i `seeds-trial.json` (SHA-256 `68b9a70b…`), zanim
otwarto wynik którejkolwiek rewizji na tych domach:

- **Domy:** wszystkie 12 domów zbioru próby 3.53.5 (poza Bengali, przeniesionym do DEV), które dają model na 1332 —
  12 rodzin, bez wyboru po wyniku; 9 ciętych na więcej niż jedną bryłę, 3 jednobryłowe (kontrola). Pakiety
  zapieczętowane w 3.53.5, bez zmian. Żaden nie był wcześniej oglądany pod kątem pokoi, przegród ani obrysu.
- **Geometria odniesienia:** punkt na pomieszczenie zestawienia, postawiony ręcznie na arkuszu (169 pomieszczeń); grupy
  otwarte (pomieszczenia bez ściany i drzwi między sobą) i `mayJoin` (rozdzielenia nie dało się rozstrzygnąć z arkusza)
  zapisane dla każdego domu.
- **Definicje i tolerancje:** jak w §6; wynik domu: IMPROVED — więcej pokoi OK/OPEN_OK i żaden wcześniej poprawny nie
  utracony; WORSE; MIXED; UNCHANGED; IDENTICAL (ten sam skrót modelu).
- Siedem odmów tego zbioru (brak modelu na 1332) jest powtarzanych i raportowanych bez tabel.

**Zapis odstępstw od czystej kolejności (jawnie).** (1) Przed otwarciem próby jedno zapytanie zliczające nowe drzwi
objęło też katalog próby: zobaczyłem listę identyfikatorów i współrzędnych drzwi w domach próby, bez żadnej oceny; nie
posłużyła do zmiany kodu. (2) Wynik próby otwarto na kodzie kandydata; potem kod zmieniał się jeszcze trzy razy,
każdorazowo z dowodu spoza próby: test „wolnego przejścia" czytany jak łuk (dom DEV Bengali), ograniczenie `toDrawnWall`
do brył ze złączenia (40 istniejących testów 005Q), wymóg skrzydła (istniejący test N8-03D2). Próbę powtórzono na
rewizji dostawy; statusy wszystkich 169 pomieszczeń są **identyczne** z pierwszym otwarciem (porównanie plików
wyników), więc żadna z tych zmian nie była strojeniem do próby.

### 9.2 Wyniki (rewizja dostawy)

| dom | bryły | model 1332 → dostawa | OK + OPEN_OK | AREA_OFF | MERGED | MISSING | wynik |
|---|---|---|---|---|---|---|---|
| Pod Pomarańczą 2 | 1 | identyczny | 12 → 12 z 13 | 0 → 0 | 0 → 0 | 1 → 1 | IDENTICAL |
| Azolle 7 GE | 2 | identyczny | 9 → 9 z 14 | 1 → 1 | 0 → 0 | 4 → 4 | IDENTICAL |
| Chelone G2E | 2 | identyczny | 7 → 7 z 18 | 2 → 2 | 9 → 9 | 0 → 0 | IDENTICAL |
| Dzwonki 3 G2AE | 3 | zmieniony | 3 → **8** z 14 | 2 → 2 | 9 → 4 | 0 → 0 | **IMPROVED** (3, 4, 5, 6, 10) |
| Kanzany 3 G2E | 2 | zmieniony | 7 → **11** z 13 | 1 → 0 | 5 → 2 | 0 → 0 | **IMPROVED** (1, 2, 5, 6) |
| Karmazyny 2 G2 | 4 | identyczny | 4 → 4 z 16 | 2 → 2 | 8 → 8 | 2 → 2 | IDENTICAL |
| Mennice 2 GE OZE | 3 | zmieniony | 8 → 8 z 14 | 1 → 1 | 5 → 5 | 0 → 0 | UNCHANGED |
| Nigelle 4 G2 | 4 | zmieniony | 2 → **3** z 17 | 1 → 1 | 6 → 5 | 8 → 8 | **IMPROVED** (10) |
| Pysznogłówki GE | 2 | zmieniony | 4 → **5** z 14 | 1 → 1 | 9 → 8 | 0 → 0 | **IMPROVED** (10) |
| Santoliny 4 | 1 | zmieniony | 6 → 6 z 15 | 3 → 4 | 6 → 5 | 0 → 0 | UNCHANGED |
| Torenie 3 E | 1 | identyczny | 0 → 0 z 7 | 1 → 1 | 2 → 2 | 4 → 4 | IDENTICAL |
| Wasabi GE | 3 | zmieniony | 10 → **14** z 14 | 0 → 0 | 4 → 0 | 0 → 0 | **IMPROVED** (4, 6, 7, 8) |
| **razem (169 pomieszczeń)** | | | **72 → 87** | 15 → 15 | 63 → 48 | 19 → 19 | 5 IMPROVED, 2 UNCHANGED, 5 IDENTICAL, **0 WORSE** |

**Poprawy 5, pogorszenia 0, bez zmiany statusów mimo zmiany modelu 2, bez działania reguły 5.** Żaden pokój poprawny
w 1332 nie został utracony w żadnym z 12 domów. Kompilacja: błędy bez zmian we wszystkich (0 nowych); ostrzeżenia
Dzwonki 0 → 2, Wasabi 0 → 1 (§8). W Santolinach jeden pokój wydzielony z poligonu scalonego wyszedł poza tolerancję
(AREA_OFF zamiast MERGED) — żadna strata, żaden zysk.

**Siedem odmów** (Berberysy 4, Lulo 3, Maruny, Nolany 2, Oliwniki 5, Stellarie, Tymotki 2): odmowa na 1332, odmowa na
rewizji dostawy; zmiana ich nie dotyczy.

**Inny wydawca:** nie oceniano. Wszystkie domy tego etapu pochodzą od jednego wydawcy (rastrowe rzuty 853 px);
poprawa jest potwierdzona tylko w tym zakresie.

### 9.3 Czego próba **nie** potwierdza

- 82 ze 169 pomieszczeń próby pozostają niezgodne (48 scalonych, 19 bez poligonu, 15 poza tolerancją). Etap poprawia
  jedną rodzinę przyczyn (linia brył i drzwi, których ściany same nie tworzą); nie czyni obmiaru pomieszczeń
  wiarygodnym w ogóle.
- W pięciu domach (w tym trzech wielobryłowych: Azolle, Chelone, Karmazyny) żadna reguła nie zadziałała, choć mają
  5 + 11 + 12 niezgodnych pomieszczeń — ich przyczyny są inne (§11).
- Ocena dotyczy parteru; kondygnacje wyższe mają tylko wskaźnik z §8.

Pełne tabele pomieszczeń 12 domów próby: załącznik A.

## 10. Weryfikacja i APK 1333

**Testy** — rewizja `9824e17`; `npx tsc --noEmit` czysto. Macierz dotkniętych pakietów (`packages/reconstruction`,
`packages/analysis-service`, `apps/local-analyzer`, `tests/architecture`, z `LOCAL_ANALYZER_NODE18`):
**187 plików, 2221 testów: 2208 PASS, 13 FAIL.** Baza (`6ee8dee`): 185 plików, 2186 testów, 2173 PASS, 13 FAIL.
Przybyło 35 testów tego etapu (34 + 1), wszystkie PASS. **13 nazw błędów jest identycznych z bazą** (porównanie list
nazw `FAIL`: bez różnic): 4 × `research-isolation`, 2 × `reference`, 1 × `compound-facade`, 4 × `wall-strip`
(architektura, porównanie z bazą 005Q), 1 × `local-analyzer/program` (Larchfield), 1 × `local-analyzer/text` (NFD).
Żaden próg ani stopień ważności nie został zmieniony. (Macierz biegła na drzewie różniącym się od `9824e17` jednym
blokiem komentarza przy wersji solvera.)

**Konflikt z wcześniejszym kontraktem — zapisany i rozstrzygnięty.** Pierwsza wersja `toDrawnWall` przesuwała na
narysowane lico bok *każdej* bryły uciętej na wewnętrznym licu ściany. To zmieniało 40 wyników testów `wall-strip`
(005Q, N1a: taka bryła zostaje tam, gdzie była, a pas jest nazwany jako niejednoznaczny) i dziewięć testów podglądu
częściowego i cienkich brył. Kontrakt 005Q jest świadomą decyzją wcześniejszego etapu, więc `toDrawnWall` działa teraz
tylko dla brył powstałych ze złączenia otwartego szwu (własny produkt tego etapu); wszystkie te testy przechodzą bez
zmiany oczekiwań. Koszt jest realny i zmierzony: w Murajach (korpus) pełna wersja stawiała tylną ścianę na narysowanym
licu (drzwi tarasowe 2,70 m i drzwi 0,99 m zgodne z opisami otworów zamiast „okien" 4,00 i 5,21 m na ścianie cofniętej
o 0,55 m; dopasowanie wskaźnikowe 1 → 5), a w dostawie obrys Murajów zostaje jak w 1332 (dopasowanie 1 → 3 dzięki
drzwiom). To jest kandydat na następny wycinek obrysu i wymaga decyzji, czy kontrakt 005Q „nazwać, nie przesuwać"
ma ustąpić narysowanemu licu.

**APK 1333**

| | |
|---|---|
| plik | `BuildPlan-Model-Preview-1333-arm64-v8a-debug.apk`, 50 677 148 B (prywatnie, poza Gitem) |
| SHA-256 | `8dcdf40cc266b03e9299ca3c5f4fb7f15a0823437fc17648578f456beb1002f3` |
| podpis | ten sam certyfikat co 1324–1332: SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` — **PASS** |
| wersja | `versionCode 1333`, `versionName 0.1333.0-owner`, pakiet `com.buildplan.preview`, minSdk 26 — **PASS** |
| analizator | solver 2.38.0 (odczytane z `analyzer.mjs` w pliku APK i z `hello`/`result.json` przebiegów) |
| manifest analizatora | protokół 3, `nodejs-mobile` 18.20.4; **12/12** plików zgodnych co do SHA-256 i rozmiaru; `analyzer.mjs` `2696419dd8cadfc8…` (3 540 415 B) — **PASS** |
| rewizja | `9824e17` (drzewo czyste w chwili budowania) |

**HOST (bundle wyjęty z ostatecznego pliku APK, produkcyjny `main.mjs`, Node 18.20.4 z symulacją braku ICU, żywe strony
wydawcy, od `hello` do zapisanej i wczytanej sceny; trzy przebiegi równolegle):**

| dom | wynik | zdarzenia | model | zgodność z przebiegiem referencyjnym (powtórka na zapieczętowanych źródłach) | scena (wczytana `loadBundle`) | czas | pamięć szczytowa |
|---|---|---|---|---|---|---|---|
| **Macierzanki 4 G2** (punkt diagnostyczny) | `done`, exit 0 | 624 (`hello` … `done`), 0 `error` | `9f68a9f95725` | **równy** | `2bff400dc978`, 150 siatek — **wczytana** | 533 s | 0,92 GB |
| Bengali G2E | `done`, exit 0 | 579, 0 `error` | `a2b574be78ff` | **równy** | `f4bcac412dff`, 158 siatek — **wczytana** | 480 s | 0,97 GB |
| Bakopy 5 E | `done`, exit 0 | 641, 0 `error` | `7ccfe641ba30` | **równy** | `089e8a2b01df`, 132 siatki — **wczytana** | 499 s | 1,04 GB |

`hello` raportuje `text: embedded-tables`, `collatorLocale: none (no Intl)`; `stderr` pusty we wszystkich trzech.
Strony wydawcy nie zmieniły się od zapieczętowania (modele z żywych stron są równe modelom z zapieczętowanych bajtów).

**ANDROID:** nie uruchomiono. W tym środowisku nie ma emulatora (brak `/dev/kvm`) ani urządzenia. Analiza i otwarcie
sceny w aplikacji: **NOT_VERIFIED**. Wyniki HOST nie są wynikami z telefonu.

## 11. Pierwsza zła decyzja, odchylenia i obszary nadal niewiarygodne do obmiaru

**Pierwsza zła decyzja (naprawiona):** odczyt wnętrza osobno pod każdą bryłą dachu i decyzje o ścianie na technicznej
linii brył. **Odchylenia przed → po:** DEV 27 → 43 z 57 pomieszczeń zgodnych; próba 72 → 87 ze 169; Macierzanki: pokoje
7/8 z jednego regionu 104 m² do 12,84/14,43 m² (−1,6 %/−0,8 %), garaż 20,27 → 35,35 m² (−0,3 %); ściany zewnętrzne bez
narysowanej ściany: Macierzanki 22,8 → 4,6 m, Bakopy 7,1 → 0 m, Dzwonki 34,3 → 17,5 m.

**Nadal niewiarygodne do obmiaru (od największego):**

1. **Części domu bez poligonu pokoju** — 19 pomieszczeń próby (Nigelle 8, Azolle 4, Torenie 4, Karmazyny 2,
   Pomarańcza 1): bryła nie powstała albo podłoga nie została odczytana. To błąd obrysu lub podziału brył, nie pokoi;
   w Nigellach tylko 10 % długości ścian zewnętrznych stoi na narysowanej ścianie w 0,10 m.
2. **Bryła ucięta na wewnętrznym licu narysowanej ściany** (pas 005Q): ściana zewnętrzna modelu 0,4–0,55 m w głąb
   od narysowanej, z fałszywie szerokimi otworami (Muraje). Zmierzony zysk z przesunięcia i konflikt z kontraktem
   w §10.
3. **Pomieszczenia otwierane bez łuku**: garderoby i spiżarnie z drzwiami przesuwnymi albo wejściem przy zabudowie
   (Bengali 12+13, Bakopy 8+9, Chelone 14+16 i 5+6+7, Macierzanki 13), wiatrołapy i korytarze połączone szerokim
   przejściem (Chelone 1+2+3+12). Model scala je z sąsiadem; suma pól bywa zgodna, podział nie.
4. **Strefa dzienna**: nazwane osobno salon, jadalnia, kuchnia, hol są jednym poligonem z flagą `openPlan` — geometria
   otwarta i jawnie niepodzielona; pól poszczególnych nazw model nie podaje.
5. **Drzwi z bardzo jasnym łukiem** (udział linii < 80 %, np. A01 58 %) nie są czytane przez nowe reguły: pokój zostaje
   scalony. Świadomy wybór precyzji.
6. **Małe pomieszczenia**: siatka 5 cm zaniża pole o 2–5 %, co dla pokoi 2–4 m² wypada poza ±10 % (Macierzanki 10,
   Bengali 10, Chelone 4).
7. **Numery pokoi**: w próbie analizator odczytał poprawnie 37 ze 150 numerów pomieszczeń mających poligon, 16
   przypisał błędnie, 97 nie odczytał. Identyfikacji pokoju przez numer nie można dziś używać do obmiaru.
8. **Podwójna ściana na styku `UNDECIDED`** (Bengali, Chelone 8: pokój ucięty do 7,51 wobec 10,71 m²) i ganek jako
   omurowana bryła (Macierzanki, 4,57 m ściany bez rysunku).
9. **Kondygnacje wyższe i inni wydawcy**: nieocenione punktami odniesienia.

Dachy wielokondygnacyjne oraz szczegóły dachów Karmazynów i Telim z raportu 3.53.5 pozostają otwarte, bez zmian
w tym etapie (Karmazyny: model identyczny; Telimy: dachy bez zmian).

## 12. Dostawa

- Kod: `9824e17` (solver 2.38.0). Raport i status: ten commit. Gałąź `claude/new-session-3kzcgh`, `[skip ci]`,
  bez merge i PR.
- APK 1333 arm64, ten sam podpis; plik prywatnie, poza Gitem.
- Prywatnie, poza Gitem: plansze PRZED/PO (12: cztery DEV, siedem domów próby, Bratki), tabele pomieszczeń, pliki
  zamrożenia i punktów odniesienia, dzienniki testów (w tym test przyczyny na `6ee8dee`).
- Płatne wywołania: 0. Księga `research/ai-assist/spend-ledger.json` bez zmian: 2,72807938 USD, 92 wpisy.
- H2, prywatny benchmark, ForgeShape: nietknięte.

## Załącznik A. Tabele pomieszczeń zamrożonej próby (parter, rewizja dostawy)

**Pod Pomarańczą 2** — parter; model `f3aa315ff2c2` → `f3aa315ff2c2`; bryły 1 → 1; kompilacja 0E/0W → 0E/0W; wynik: **IDENTICAL**

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 3.96 | 4.16 | +0.20 m² / +4.9 % | OK | main-room-0-1 | 4.16 | +0.20 m² / +4.9 % | OK | NOT_READ |
| 2 | Hol | 14.83 | 51.21 | -0.63 m² / -1.2 % (razem dekl. 51.84) | OPEN_OK z 7,8 | main-room-0-3 | 51.21 | -0.63 m² / -1.2 % (razem dekl. 51.84) | OPEN_OK z 7,8 | WRONG:1 |
| 3 | Pokój | 10.01 | 9.89 | -0.12 m² / -1.2 % | OK | main-room-0-5 | 9.89 | -0.12 m² / -1.2 % | OK | NOT_READ |
| 4 | Pokój | 10.01 | 9.94 | -0.07 m² / -0.6 % | OK | main-room-0-0 | 9.94 | -0.07 m² / -0.6 % | OK | NOT_READ |
| 5 | Łazienka | 4.97 | — | — | MISSING | — | — | — | MISSING | — |
| 6 | Spiżarnia | 1.8 | 1.80 | -0.00 m² / -0.1 % | OK | main-room-0-9 | 1.80 | -0.00 m² / -0.1 % | OK | NOT_READ |
| 7 | Kuchnia | 9.73 | 51.21 | -0.63 m² / -1.2 % (razem dekl. 51.84) | OPEN_OK z 2,8 | main-room-0-3 | 51.21 | -0.63 m² / -1.2 % (razem dekl. 51.84) | OPEN_OK z 2,8 | WRONG:1 |
| 8 | Salon + Jadalnia | 27.28 | 51.21 | -0.63 m² / -1.2 % (razem dekl. 51.84) | OPEN_OK z 2,7 | main-room-0-3 | 51.21 | -0.63 m² / -1.2 % (razem dekl. 51.84) | OPEN_OK z 2,7 | WRONG:1 |
| 9 | Pokój | 8.67 | 8.67 | +0.00 m² / +0.1 % | OK | main-room-0-10 | 8.67 | +0.00 m² / +0.1 % | OK | NOT_READ |
| 10 | Pokój | 9.51 | 9.48 | -0.03 m² / -0.4 % | OK | main-room-0-7 | 9.48 | -0.03 m² / -0.4 % | OK | NOT_READ |
| 11 | Garderoba | 4.21 | 4.12 | -0.09 m² / -2.1 % | OK | main-room-0-6 | 4.12 | -0.09 m² / -2.1 % | OK | NOT_READ |
| 12 | Łazienka | 4.92 | 4.83 | -0.09 m² / -1.9 % | OK | main-room-0-4 | 4.83 | -0.09 m² / -1.9 % | OK | NOT_READ |
| 13 | Kotłownia z pralnią | 5.37 | 5.69 | +0.32 m² / +5.9 % | OK | main-room-0-2 | 5.69 | +0.32 m² / +5.9 % | OK | NOT_READ |

Razem: 1332 — OK 9, OPEN_OK 3, MISSING 1; PO — OK 9, OPEN_OK 3, MISSING 1.

**Azolle 7 GE** — parter; model `6a72b7fccc28` → `6a72b7fccc28`; bryły 2 → 2; kompilacja 4E/4W → 4E/4W; wynik: **IDENTICAL**

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 5.56 | — | — | MISSING | — | — | — | MISSING | — |
| 2 | Korytarz | 4.11 | 42.00 | -1.08 m² / -2.5 % (razem dekl. 43.08) | OPEN_OK z 3,10 | main-room-0-3 | 42.00 | -1.08 m² / -2.5 % (razem dekl. 43.08) | OPEN_OK z 3,10 | NOT_READ |
| 3 | Salon + Jadalnia | 31.71 | 42.00 | -1.08 m² / -2.5 % (razem dekl. 43.08) | OPEN_OK z 2,10 | main-room-0-3 | 42.00 | -1.08 m² / -2.5 % (razem dekl. 43.08) | OPEN_OK z 2,10 | NOT_READ |
| 4 | Kuchnia | 12.04 | — | — | MISSING | — | — | — | MISSING | — |
| 5 | Spiżarnia | 1.82 | — | — | MISSING | — | — | — | MISSING | — |
| 6 | Pokój | 12.63 | 12.66 | +0.03 m² / +0.2 % | OK | main-room-0-5 | 12.66 | +0.03 m² / +0.2 % | OK | READ |
| 7 | Pokój | 12.63 | 12.50 | -0.13 m² / -1.0 % | OK | main-room-0-2 | 12.50 | -0.13 m² / -1.0 % | OK | NOT_READ |
| 8 | Pokój | 11.83 | 11.43 | -0.40 m² / -3.4 % | OK | main-room-0-1 | 11.43 | -0.40 m² / -3.4 % | OK | NOT_READ |
| 9 | Garderoba | 6.32 | 6.21 | -0.11 m² / -1.7 % | OK | main-room-0-0 | 6.21 | -0.11 m² / -1.7 % | OK | NOT_READ |
| 10 | Korytarz | 7.26 | 42.00 | -1.08 m² / -2.5 % (razem dekl. 43.08) | OPEN_OK z 2,3 | main-room-0-3 | 42.00 | -1.08 m² / -2.5 % (razem dekl. 43.08) | OPEN_OK z 2,3 | NOT_READ |
| 11 | Łazienka | 5.5 | 5.26 | -0.24 m² / -4.3 % | OK | main-room-0-4 | 5.26 | -0.24 m² / -4.3 % | OK | NOT_READ |
| 12 | Łazienka | 3.73 | 3.61 | -0.12 m² / -3.2 % | OK | main-room-0-6 | 3.61 | -0.12 m² / -3.2 % | OK | WRONG:1 |
| 13 | Kotłownia z pralnią | 4.49 | — | — | MISSING | — | — | — | MISSING | — |
| 14 | Garaż | 25.37 | 39.26 | +13.89 m² / +54.8 % | AREA_OFF | attached-0-room-0-0 | 39.26 | +13.89 m² / +54.8 % | AREA_OFF | NOT_READ |

Razem: 1332 — OK 6, OPEN_OK 3, AREA_OFF 1, MISSING 4; PO — OK 6, OPEN_OK 3, AREA_OFF 1, MISSING 4.

**Chelone G2E** — parter; model `15183a592c29` → `15183a592c29`; bryły 2 → 2; kompilacja 0E/0W → 0E/0W; wynik: **IDENTICAL**

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 3.26 | 18.64 | -1.66 m² / -8.2 % (razem dekl. 20.3) | MERGED z 2,3,12 | main-room-0-1 | 18.64 | -1.66 m² / -8.2 % (razem dekl. 20.3) | MERGED z 2,3,12 | WRONG:12 |
| 2 | Garderoba | 3.21 | 18.64 | -1.66 m² / -8.2 % (razem dekl. 20.3) | MERGED z 1,3,12 | main-room-0-1 | 18.64 | -1.66 m² / -8.2 % (razem dekl. 20.3) | MERGED z 1,3,12 | WRONG:12 |
| 3 | Korytarz | 5 | 18.64 | -1.66 m² / -8.2 % (razem dekl. 20.3) | MERGED z 1,2,12 | main-room-0-1 | 18.64 | -1.66 m² / -8.2 % (razem dekl. 20.3) | MERGED z 1,2,12 | WRONG:12 |
| 4 | Toaleta | 2.33 | 2.06 | -0.27 m² / -11.6 % | AREA_OFF | main-room-0-3 | 2.06 | -0.27 m² / -11.6 % | AREA_OFF | NOT_READ |
| 5 | Salon + Jadalnia | 29.26 | 38.82 | -3.47 m² / -8.2 % (razem dekl. 42.29) | MERGED z 6,7 | attached-0-room-0-0 | 38.82 | -3.47 m² / -8.2 % (razem dekl. 42.29) | MERGED z 6,7 | NOT_READ |
| 6 | Kuchnia | 9.77 | 38.82 | -3.47 m² / -8.2 % (razem dekl. 42.29) | MERGED z 5,7 | attached-0-room-0-0 | 38.82 | -3.47 m² / -8.2 % (razem dekl. 42.29) | MERGED z 5,7 | NOT_READ |
| 7 | Spiżarnia | 3.26 | 38.82 | -3.47 m² / -8.2 % (razem dekl. 42.29) | MERGED z 5,6 | attached-0-room-0-0 | 38.82 | -3.47 m² / -8.2 % (razem dekl. 42.29) | MERGED z 5,6 | NOT_READ |
| 8 | Pokój | 10.71 | 7.51 | -3.20 m² / -29.9 % | AREA_OFF | main-room-0-0 | 7.51 | -3.20 m² / -29.9 % | AREA_OFF | READ |
| 9 | Pokój | 12.34 | 12.10 | -0.24 m² / -1.9 % | OK | main-room-0-4 | 12.10 | -0.24 m² / -1.9 % | OK | NOT_READ |
| 10 | Pokój | 12.36 | 12.10 | -0.26 m² / -2.1 % | OK | main-room-0-8 | 12.10 | -0.26 m² / -2.1 % | OK | READ |
| 11 | Łazienka | 5.81 | 5.47 | -0.34 m² / -5.8 % | OK | main-room-0-9 | 5.47 | -0.34 m² / -5.8 % | OK | READ |
| 12 | Korytarz | 8.83 | 18.64 | -1.66 m² / -8.2 % (razem dekl. 20.3) | MERGED z 1,2,3 | main-room-0-1 | 18.64 | -1.66 m² / -8.2 % (razem dekl. 20.3) | MERGED z 1,2,3 | READ |
| 13 | Pralnia | 4.79 | 4.32 | -0.47 m² / -9.8 % | OK | main-room-0-5 | 4.32 | -0.47 m² / -9.8 % | OK | READ |
| 14 | Pokój | 16.42 | 20.18 | -0.16 m² / -0.8 % (razem dekl. 20.34) | MERGED z 16 | main-room-0-7 | 20.18 | -0.16 m² / -0.8 % (razem dekl. 20.34) | MERGED z 16 | READ |
| 15 | Łazienka | 4.23 | 4.33 | +0.10 m² / +2.4 % | OK | main-room-0-6 | 4.33 | +0.10 m² / +2.4 % | OK | NOT_READ |
| 16 | Garderoba | 3.92 | 20.18 | -0.16 m² / -0.8 % (razem dekl. 20.34) | MERGED z 14 | main-room-0-7 | 20.18 | -0.16 m² / -0.8 % (razem dekl. 20.34) | MERGED z 14 | WRONG:14 |
| 17 | Garaż | 35.32 | 35.64 | +0.32 m² / +0.9 % | OK | main-room-0-2 | 35.64 | +0.32 m² / +0.9 % | OK | READ |
| 18 | Kotłownia | 8.48 | 8.61 | +0.13 m² / +1.5 % | OK | main-room-0-10 | 8.61 | +0.13 m² / +1.5 % | OK | READ |

Razem: 1332 — OK 7, AREA_OFF 2, MERGED 9; PO — OK 7, AREA_OFF 2, MERGED 9.

**Dzwonki 3 G2AE** — parter; model `1ac235ae5142` → `7e0428f78253`; bryły 3 → 3; kompilacja 0E/0W → 0E/2W; wynik: **IMPROVED** (zyskane: 3, 4, 5, 6, 10)

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 4.49 | 4.03 | -3.87 m² / -49.0 % (razem dekl. 7.9) | MERGED z 2 | main-room-0-0 | 7.14 | -0.76 m² / -9.7 % (razem dekl. 7.9) | MERGED z 2 | NOT_READ |
| 2 | Garderoba | 3.41 | 4.03 | -3.87 m² / -49.0 % (razem dekl. 7.9) | MERGED z 1 | main-room-0-0 | 7.14 | -0.76 m² / -9.7 % (razem dekl. 7.9) | MERGED z 1 | NOT_READ |
| 3 | Salon + Jadalnia | 37.15 | 89.46 | +5.57 m² / +6.6 % (razem dekl. 83.89) | MERGED z 4,5,6,10,12,13 | main-room-0-2 | 51.29 | -1.62 m² / -3.1 % (razem dekl. 52.91) | OPEN_OK z 4,6 | NOT_READ |
| 4 | Kuchnia | 10.3 | 89.46 | +5.57 m² / +6.6 % (razem dekl. 83.89) | MERGED z 3,5,6,10,12,13 | main-room-0-2 | 51.29 | -1.62 m² / -3.1 % (razem dekl. 52.91) | OPEN_OK z 3,6 | NOT_READ |
| 5 | Spiżarnia | 2.32 | 89.46 | +5.57 m² / +6.6 % (razem dekl. 83.89) | MERGED z 3,4,6,10,12,13 | main-room-0-1 | 2.16 | -0.16 m² / -6.8 % | OK | NOT_READ |
| 6 | Hol | 5.46 | 89.46 | +5.57 m² / +6.6 % (razem dekl. 83.89) | MERGED z 3,4,5,10,12,13 | main-room-0-2 | 51.29 | -1.62 m² / -3.1 % (razem dekl. 52.91) | OPEN_OK z 3,4 | NOT_READ |
| 7 | Łazienka | 2.82 | 2.51 | -0.31 m² / -11.0 % | AREA_OFF | main-room-0-6 | 2.43 | -0.39 m² / -13.7 % | AREA_OFF | NOT_READ |
| 8 | Kotłownia z pralnią | 4.07 | 4.08 | +0.01 m² / +0.2 % | OK | main-room-0-5 | 3.95 | -0.12 m² / -2.9 % | OK | NOT_READ |
| 9 | Łazienka | 6.74 | 6.55 | -0.19 m² / -2.8 % | OK | main-room-0-4 | 6.55 | -0.19 m² / -2.8 % | OK | NOT_READ |
| 10 | Pokój | 12.31 | 89.46 | +5.57 m² / +6.6 % (razem dekl. 83.89) | MERGED z 3,4,5,6,12,13 | main-room-0-7 | 12.37 | +0.06 m² / +0.4 % | OK | NOT_READ |
| 11 | Pokój | 12.31 | 12.36 | +0.05 m² / +0.4 % | OK | main-room-0-8 | 12.36 | +0.05 m² / +0.4 % | OK | READ |
| 12 | Pokój | 12.31 | 89.46 | +5.57 m² / +6.6 % (razem dekl. 83.89) | MERGED z 3,4,5,6,10,13 | main-room-0-9 | 16.31 | -0.04 m² / -0.2 % (razem dekl. 16.35) | MERGED z 13 | READ |
| 13 | Garderoba | 4.04 | 89.46 | +5.57 m² / +6.6 % (razem dekl. 83.89) | MERGED z 3,4,5,6,10,12 | main-room-0-9 | 16.31 | -0.04 m² / -0.2 % (razem dekl. 16.35) | MERGED z 12 | WRONG:12 |
| 14 | Garaż | 39.11 | 16.17 | -22.94 m² / -58.7 % | AREA_OFF | main-room-0-3 | 16.17 | -22.94 m² / -58.7 % | AREA_OFF | READ |

Razem: 1332 — OK 3, AREA_OFF 2, MERGED 9; PO — OK 5, OPEN_OK 3, AREA_OFF 2, MERGED 4.

**Kanzany 3 G2E** — parter; model `299ce20a85fb` → `07e798d2eba9`; bryły 2 → 2; kompilacja 0E/0W → 0E/0W; wynik: **IMPROVED** (zyskane: 1, 2, 5, 6)

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 3.87 | 4.26 | +0.39 m² / +10.1 % | AREA_OFF | main-room-0-2 | 4.20 | +0.33 m² / +8.6 % | OK | NOT_READ |
| 2 | Hol | 9.98 | 61.14 | +10.02 m² / +19.6 % (razem dekl. 51.12) | MERGED z 5,6 | main-room-0-4 | 49.82 | -1.30 m² / -2.5 % (razem dekl. 51.12) | OPEN_OK z 5,6 | NOT_READ |
| 3 | Kotłownia z pralnią | 6.82 | 6.86 | +0.04 m² / +0.6 % | OK | main-room-0-1 | 6.83 | +0.01 m² / +0.1 % | OK | NOT_READ |
| 4 | Spiżarnia | 2.76 | 2.61 | -0.15 m² / -5.4 % | OK | main-room-0-3 | 2.56 | -0.20 m² / -7.2 % | OK | WRONG:2 |
| 5 | Kuchnia | 10.95 | 61.14 | +10.02 m² / +19.6 % (razem dekl. 51.12) | MERGED z 2,6 | main-room-0-4 | 49.82 | -1.30 m² / -2.5 % (razem dekl. 51.12) | OPEN_OK z 2,6 | NOT_READ |
| 6 | Salon + Jadalnia | 30.19 | 61.14 | +10.02 m² / +19.6 % (razem dekl. 51.12) | MERGED z 2,5 | main-room-0-4 | 49.82 | -1.30 m² / -2.5 % (razem dekl. 51.12) | OPEN_OK z 2,5 | NOT_READ |
| 7 | Łazienka | 3.06 | 3.03 | -0.03 m² / -0.8 % | OK | main-room-0-6 | 3.03 | -0.03 m² / -0.8 % | OK | NOT_READ |
| 8 | Pokój | 13.34 | 13.22 | -0.12 m² / -0.9 % | OK | main-room-0-7 | 13.12 | -0.22 m² / -1.7 % | OK | READ |
| 9 | Pokój | 11.94 | 11.64 | -0.30 m² / -2.5 % | OK | main-room-0-8 | 11.64 | -0.30 m² / -2.5 % | OK | NOT_READ |
| 10 | Łazienka | 6.77 | 6.67 | -0.10 m² / -1.5 % | OK | main-room-0-5 | 6.67 | -0.10 m² / -1.5 % | OK | READ |
| 11 | Pokój | 11.66 | 14.67 | -0.10 m² / -0.7 % (razem dekl. 14.77) | MERGED z 12 | main-room-0-0 | 14.67 | -0.10 m² / -0.7 % (razem dekl. 14.77) | MERGED z 12 | READ |
| 12 | Garderoba | 3.11 | 14.67 | -0.10 m² / -0.7 % (razem dekl. 14.77) | MERGED z 11 | main-room-0-0 | 14.67 | -0.10 m² / -0.7 % (razem dekl. 14.77) | MERGED z 11 | WRONG:11 |
| 13 | Garaż | 36.42 | 35.10 | -1.32 m² / -3.6 % | OK | attached-0-room-0-0 | 35.10 | -1.32 m² / -3.6 % | OK | NOT_READ |

Razem: 1332 — OK 7, AREA_OFF 1, MERGED 5; PO — OK 8, OPEN_OK 3, MERGED 2.

**Karmazyny 2 G2** — parter; model `a06b1f254726` → `a06b1f254726`; bryły 4 → 4; kompilacja 3E/2W → 3E/2W; wynik: **IDENTICAL**

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 5.43 | — | — | MISSING | — | — | — | MISSING | — |
| 2 | Hol | 7.7 | 41.41 | +2.57 m² / +6.6 % (razem dekl. 38.84) | MERGED z 8,9,10,12 | main-room-0-0 | 41.41 | +2.57 m² / +6.6 % (razem dekl. 38.84) | MERGED z 8,9,10,12 | NOT_READ |
| 3 | Spiżarnia | 2.53 | 44.43 | -1.61 m² / -3.5 % (razem dekl. 46.04) | MERGED z 4,5 | attached-0-room-0-0 | 44.43 | -1.61 m² / -3.5 % (razem dekl. 46.04) | MERGED z 4,5 | NOT_READ |
| 4 | Kuchnia | 12.06 | 44.43 | -1.61 m² / -3.5 % (razem dekl. 46.04) | MERGED z 3,5 | attached-0-room-0-0 | 44.43 | -1.61 m² / -3.5 % (razem dekl. 46.04) | MERGED z 3,5 | NOT_READ |
| 5 | Salon + Jadalnia | 31.45 | 44.43 | -1.61 m² / -3.5 % (razem dekl. 46.04) | MERGED z 3,4 | attached-0-room-0-0 | 44.43 | -1.61 m² / -3.5 % (razem dekl. 46.04) | MERGED z 3,4 | NOT_READ |
| 6 | Łazienka | 6.17 | 6.35 | +0.18 m² / +2.9 % | OK | main-room-0-3 | 6.35 | +0.18 m² / +2.9 % | OK | NOT_READ |
| 7 | Pokój | 11.77 | 11.90 | +0.13 m² / +1.1 % | OK | main-room-0-6 | 11.90 | +0.13 m² / +1.1 % | OK | NOT_READ |
| 8 | Pokój | 14.81 | 41.41 | +2.57 m² / +6.6 % (razem dekl. 38.84) | MERGED z 2,9,10,12 | main-room-0-0 | 41.41 | +2.57 m² / +6.6 % (razem dekl. 38.84) | MERGED z 2,9,10,12 | NOT_READ |
| 9 | Łazienka | 4.26 | 41.41 | +2.57 m² / +6.6 % (razem dekl. 38.84) | MERGED z 2,8,10,12 | main-room-0-0 | 41.41 | +2.57 m² / +6.6 % (razem dekl. 38.84) | MERGED z 2,8,10,12 | NOT_READ |
| 10 | Garderoba | 4.38 | 41.41 | +2.57 m² / +6.6 % (razem dekl. 38.84) | MERGED z 2,8,9,12 | main-room-0-0 | 41.41 | +2.57 m² / +6.6 % (razem dekl. 38.84) | MERGED z 2,8,9,12 | NOT_READ |
| 11 | Pokój | 11.65 | 11.51 | -0.14 m² / -1.2 % | OK | main-room-0-5 | 11.51 | -0.14 m² / -1.2 % | OK | WRONG:1 |
| 12 | Korytarz | 7.69 | 41.41 | +2.57 m² / +6.6 % (razem dekl. 38.84) | MERGED z 2,8,9,10 | main-room-0-0 | 41.41 | +2.57 m² / +6.6 % (razem dekl. 38.84) | MERGED z 2,8,9,10 | NOT_READ |
| 13 | Pralnia | 5.49 | 5.73 | +0.24 m² / +4.3 % | OK | main-room-0-4 | 5.73 | +0.24 m² / +4.3 % | OK | NOT_READ |
| 14 | Toaleta | 1.69 | — | — | MISSING | — | — | — | MISSING | — |
| 15 | Kotłownia | 2.61 | 2.34 | -0.27 m² / -10.3 % | AREA_OFF | main-room-0-2 | 2.34 | -0.27 m² / -10.3 % | AREA_OFF | NOT_READ |
| 16 | Garaż | 35.52 | 17.36 | -18.16 m² / -51.1 % | AREA_OFF | main-room-0-1 | 17.36 | -18.16 m² / -51.1 % | AREA_OFF | READ |

Razem: 1332 — OK 4, AREA_OFF 2, MERGED 8, MISSING 2; PO — OK 4, AREA_OFF 2, MERGED 8, MISSING 2.

**Mennice 2 GE OZE** — parter; model `566b35d5f51b` → `1a36af278f46`; bryły 3 → 3; kompilacja 2E/2W → 2E/2W; wynik: **UNCHANGED**

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 6.73 | 36.90 | +5.78 m² / +18.6 % (razem dekl. 31.12) | MERGED z 14 | attached-0-room-0-0 | 36.90 | +5.78 m² / +18.6 % (razem dekl. 31.12) | MERGED z 14 | WRONG:14 |
| 2 | Hol | 5.31 | 4.89 | -0.42 m² / -7.8 % | OK | main-room-0-3 | 4.81 | -0.50 m² / -9.3 % | OK | READ |
| 3 | Toaleta | 2.32 | 2.18 | -0.14 m² / -5.8 % | OK | main-room-0-2 | 2.19 | -0.13 m² / -5.8 % | OK | NOT_READ |
| 4 | Spiżarnia | 2.67 | 46.01 | -1.50 m² / -3.1 % (razem dekl. 47.51) | MERGED z 5,6 | main-room-0-1 | 46.02 | -1.49 m² / -3.1 % (razem dekl. 47.51) | MERGED z 5,6 | NOT_READ |
| 5 | Kuchnia | 14.19 | 46.01 | -1.50 m² / -3.1 % (razem dekl. 47.51) | MERGED z 4,6 | main-room-0-1 | 46.02 | -1.49 m² / -3.1 % (razem dekl. 47.51) | MERGED z 4,6 | NOT_READ |
| 6 | Salon + Jadalnia | 30.65 | 46.01 | -1.50 m² / -3.1 % (razem dekl. 47.51) | MERGED z 4,5 | main-room-0-1 | 46.02 | -1.49 m² / -3.1 % (razem dekl. 47.51) | MERGED z 4,5 | NOT_READ |
| 7 | Korytarz | 4.1 | 3.52 | -0.58 m² / -14.1 % | AREA_OFF | main-room-0-6 | 3.52 | -0.58 m² / -14.1 % | AREA_OFF | READ |
| 8 | Łazienka | 6.82 | 6.72 | -0.10 m² / -1.4 % | OK | main-room-0-7 | 6.72 | -0.10 m² / -1.4 % | OK | NOT_READ |
| 9 | Pokój | 13.43 | 13.21 | -0.22 m² / -1.6 % | OK | main-room-0-9 | 13.21 | -0.22 m² / -1.6 % | OK | NOT_READ |
| 10 | Pokój | 13.38 | 13.15 | -0.23 m² / -1.7 % | OK | main-room-0-8 | 13.15 | -0.23 m² / -1.7 % | OK | READ |
| 11 | Pokój | 13.4 | 13.33 | -0.07 m² / -0.5 % | OK | main-room-0-5 | 13.33 | -0.07 m² / -0.5 % | OK | NOT_READ |
| 12 | Garderoba | 4.08 | 3.96 | -0.12 m² / -2.9 % | OK | main-room-0-4 | 3.90 | -0.18 m² / -4.5 % | OK | NOT_READ |
| 13 | Kotłownia z pralnią | 6.19 | 6.11 | -0.08 m² / -1.2 % | OK | main-room-0-0 | 5.95 | -0.24 m² / -3.9 % | OK | NOT_READ |
| 14 | Garaż | 24.39 | 36.90 | +5.78 m² / +18.6 % (razem dekl. 31.12) | MERGED z 1 | attached-0-room-0-0 | 36.90 | +5.78 m² / +18.6 % (razem dekl. 31.12) | MERGED z 1 | READ |

Razem: 1332 — OK 8, AREA_OFF 1, MERGED 5; PO — OK 8, AREA_OFF 1, MERGED 5.

**Nigelle 4 G2** — parter; model `7fc36e61e12d` → `0bb1fcbd8769`; bryły 4 → 4; kompilacja 0E/0W → 0E/0W; wynik: **IMPROVED** (zyskane: 10)

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 11.5 | — | — | MISSING | — | — | — | MISSING | — |
| 2 | Hol | 4.89 | — | — | MISSING | — | — | — | MISSING | — |
| 3 | Kuchnia | 14.13 | — | — | MISSING | — | — | — | MISSING | — |
| 4 | Spiżarnia | 1.88 | — | — | MISSING | — | — | — | MISSING | — |
| 5 | Salon + Jadalnia | 39.31 | — | — | MISSING | — | — | — | MISSING | — |
| 6 | Toaleta | 2.04 | 28.47 | +1.97 m² / +7.4 % (razem dekl. 26.5) | MERGED z 10,14,15 | main-room-0-3 | 17.44 | +1.65 m² / +10.4 % (razem dekl. 15.79) | MERGED z 14,15 | NOT_READ |
| 7 | Łazienka | 4.02 | — | — | MISSING | — | — | — | MISSING | — |
| 8 | Garderoba | 4.84 | — | — | MISSING | — | — | — | MISSING | — |
| 9 | Pokój | 14.01 | — | — | MISSING | — | — | — | MISSING | — |
| 10 | Pokój | 10.71 | 28.47 | +1.97 m² / +7.4 % (razem dekl. 26.5) | MERGED z 6,14,15 | main-room-0-9 | 10.13 | -0.58 m² / -5.4 % | OK | NOT_READ |
| 11 | Pokój | 10.43 | 10.68 | +0.25 m² / +2.3 % | OK | main-room-0-7 | 9.91 | -0.52 m² / -5.0 % | OK | READ |
| 12 | Łazienka | 7.64 | 7.88 | +0.24 m² / +3.1 % | OK | main-room-0-4 | 7.31 | -0.33 m² / -4.3 % | OK | NOT_READ |
| 13 | Pokój | 8.73 | 17.52 | +0.90 m² / +5.4 % (razem dekl. 16.62) | MERGED z 16 | main-room-0-2 | 16.46 | -0.16 m² / -1.0 % (razem dekl. 16.62) | MERGED z 16 | NOT_READ |
| 14 | Pom. gospodarcze | 4.12 | 28.47 | +1.97 m² / +7.4 % (razem dekl. 26.5) | MERGED z 6,10,15 | main-room-0-3 | 17.44 | +1.65 m² / +10.4 % (razem dekl. 15.79) | MERGED z 6,15 | NOT_READ |
| 15 | Korytarz | 9.63 | 28.47 | +1.97 m² / +7.4 % (razem dekl. 26.5) | MERGED z 6,10,14 | main-room-0-3 | 17.44 | +1.65 m² / +10.4 % (razem dekl. 15.79) | MERGED z 6,14 | NOT_READ |
| 16 | Kotłownia | 7.89 | 17.52 | +0.90 m² / +5.4 % (razem dekl. 16.62) | MERGED z 13 | main-room-0-2 | 16.46 | -0.16 m² / -1.0 % (razem dekl. 16.62) | MERGED z 13 | NOT_READ |
| 17 | Garaż | 36.11 | 52.53 | +16.42 m² / +45.5 % | AREA_OFF | main-room-0-0 | 50.54 | +14.43 m² / +40.0 % | AREA_OFF | READ |

Razem: 1332 — OK 2, AREA_OFF 1, MERGED 6, MISSING 8; PO — OK 3, AREA_OFF 1, MERGED 5, MISSING 8.

**Pysznogłówki GE** — parter; model `5e0fbc0b5cca` → `844e63e0ee49`; bryły 2 → 2; kompilacja 2E/2W → 2E/2W; wynik: **IMPROVED** (zyskane: 10)

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 6.57 | 45.46 | -15.18 m² / -25.0 % (razem dekl. 60.64) | MERGED z 2,3,4,5,6 | main-room-0-0 | 43.94 | -14.06 m² / -24.2 % (razem dekl. 58.0) | MERGED z 2,4,5,6 | NOT_READ |
| 2 | Hol | 1.57 | 45.46 | -15.18 m² / -25.0 % (razem dekl. 60.64) | MERGED z 1,3,4,5,6 | main-room-0-0 | 43.94 | -14.06 m² / -24.2 % (razem dekl. 58.0) | MERGED z 1,4,5,6 | NOT_READ |
| 3 | Spiżarnia | 2.64 | 45.46 | -15.18 m² / -25.0 % (razem dekl. 60.64) | MERGED z 1,2,4,5,6 | main-room-0-1 | 1.24 | -1.40 m² / -52.9 % | AREA_OFF | NOT_READ |
| 4 | Kuchnia | 9.57 | 45.46 | -15.18 m² / -25.0 % (razem dekl. 60.64) | MERGED z 1,2,3,5,6 | main-room-0-0 | 43.94 | -14.06 m² / -24.2 % (razem dekl. 58.0) | MERGED z 1,2,5,6 | NOT_READ |
| 5 | Salon | 34.77 | 45.46 | -15.18 m² / -25.0 % (razem dekl. 60.64) | MERGED z 1,2,3,4,6 | main-room-0-0 | 43.94 | -14.06 m² / -24.2 % (razem dekl. 58.0) | MERGED z 1,2,4,6 | NOT_READ |
| 6 | Korytarz | 5.52 | 45.46 | -15.18 m² / -25.0 % (razem dekl. 60.64) | MERGED z 1,2,3,4,5 | main-room-0-0 | 43.94 | -14.06 m² / -24.2 % (razem dekl. 58.0) | MERGED z 1,2,4,5 | NOT_READ |
| 7 | Pokój | 10.42 | 37.41 | +10.63 m² / +39.7 % (razem dekl. 26.78) | MERGED z 8,9 | main-room-0-4 | 37.41 | +10.63 m² / +39.7 % (razem dekl. 26.78) | MERGED z 8,9 | WRONG:8 |
| 8 | Garderoba | 4.14 | 37.41 | +10.63 m² / +39.7 % (razem dekl. 26.78) | MERGED z 7,9 | main-room-0-4 | 37.41 | +10.63 m² / +39.7 % (razem dekl. 26.78) | MERGED z 7,9 | READ |
| 9 | Pokój | 12.22 | 37.41 | +10.63 m² / +39.7 % (razem dekl. 26.78) | MERGED z 7,8 | main-room-0-4 | 37.41 | +10.63 m² / +39.7 % (razem dekl. 26.78) | MERGED z 7,8 | WRONG:8 |
| 10 | Pokój | 12.11 | 14.15 | +2.04 m² / +16.8 % | AREA_OFF | main-room-0-6 | 12.38 | +0.27 m² / +2.2 % | OK | READ |
| 11 | Łazienka | 5.97 | 6.27 | +0.30 m² / +5.0 % | OK | main-room-0-5 | 6.07 | +0.10 m² / +1.7 % | OK | READ |
| 12 | Łazienka | 3.88 | 3.97 | +0.09 m² / +2.4 % | OK | main-room-0-3 | 3.97 | +0.09 m² / +2.4 % | OK | READ |
| 13 | Kotłownia z pralnią | 5.05 | 5.06 | +0.01 m² / +0.2 % | OK | main-room-0-2 | 5.06 | +0.01 m² / +0.2 % | OK | NOT_READ |
| 14 | Garaż | 22.67 | 24.30 | +1.63 m² / +7.2 % | OK | attached-0-room-0-0 | 24.30 | +1.63 m² / +7.2 % | OK | READ |

Razem: 1332 — OK 4, AREA_OFF 1, MERGED 9; PO — OK 5, AREA_OFF 1, MERGED 8.

**Santoliny 4** — parter; model `ce4781bb228d` → `97833b781c9b`; bryły 1 → 1; kompilacja 0E/0W → 0E/0W; wynik: **UNCHANGED**

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 4.15 | 3.95 | -0.20 m² / -4.8 % | OK | main-room-0-3 | 3.95 | -0.20 m² / -4.8 % | OK | READ |
| 2 | Hol | 5.34 | 78.06 | -3.61 m² / -4.4 % (razem dekl. 81.67) | MERGED z 4,6,7,9,12 | main-room-0-0 | 69.03 | -0.07 m² / -0.1 % (razem dekl. 69.1) | MERGED z 4,6,7,9 | NOT_READ |
| 3 | Łazienka | 3.74 | 3.53 | -0.21 m² / -5.7 % | OK | main-room-0-2 | 3.53 | -0.21 m² / -5.7 % | OK | WRONG:1 |
| 4 | Kuchnia | 11.94 | 78.06 | -3.61 m² / -4.4 % (razem dekl. 81.67) | MERGED z 2,6,7,9,12 | main-room-0-0 | 69.03 | -0.07 m² / -0.1 % (razem dekl. 69.1) | MERGED z 2,6,7,9 | NOT_READ |
| 5 | Spiżarnia | 1.55 | 1.38 | -0.17 m² / -10.6 % | AREA_OFF | main-room-0-1 | 1.38 | -0.17 m² / -10.6 % | AREA_OFF | NOT_READ |
| 6 | Salon | 31.63 | 78.06 | -3.61 m² / -4.4 % (razem dekl. 81.67) | MERGED z 2,4,7,9,12 | main-room-0-0 | 69.03 | -0.07 m² / -0.1 % (razem dekl. 69.1) | MERGED z 2,4,7,9 | NOT_READ |
| 7 | Korytarz | 11.36 | 78.06 | -3.61 m² / -4.4 % (razem dekl. 81.67) | MERGED z 2,4,6,9,12 | main-room-0-0 | 69.03 | -0.07 m² / -0.1 % (razem dekl. 69.1) | MERGED z 2,4,6,9 | NOT_READ |
| 8 | Pokój | 13.39 | 12.97 | -0.42 m² / -3.1 % | OK | main-room-0-9 | 12.97 | -0.42 m² / -3.1 % | OK | NOT_READ |
| 9 | Pokój | 8.83 | 78.06 | -3.61 m² / -4.4 % (razem dekl. 81.67) | MERGED z 2,4,6,7,12 | main-room-0-0 | 69.03 | -0.07 m² / -0.1 % (razem dekl. 69.1) | MERGED z 2,4,6,7 | NOT_READ |
| 10 | Łazienka | 5.04 | 4.92 | -0.12 m² / -2.4 % | OK | main-room-0-8 | 4.92 | -0.12 m² / -2.4 % | OK | READ |
| 11 | Pralnia | 4.43 | 4.46 | +0.03 m² / +0.7 % | OK | main-room-0-7 | 4.46 | +0.03 m² / +0.7 % | OK | READ |
| 12 | Pokój | 12.57 | 78.06 | -3.61 m² / -4.4 % (razem dekl. 81.67) | MERGED z 2,4,6,7,9 | main-room-0-5 | 8.71 | -3.86 m² / -30.7 % | AREA_OFF | NOT_READ |
| 13 | Pokój | 12.02 | 8.58 | -3.44 m² / -28.6 % | AREA_OFF | main-room-0-4 | 8.58 | -3.44 m² / -28.6 % | AREA_OFF | READ |
| 14 | Garaż | 20.85 | 21.74 | +0.89 m² / +4.3 % | OK | main-room-0-6 | 21.74 | +0.89 m² / +4.3 % | OK | NOT_READ |
| 15 | Kotłownia | 8.22 | 9.24 | +1.02 m² / +12.4 % | AREA_OFF | main-room-0-10 | 9.24 | +1.02 m² / +12.4 % | AREA_OFF | READ |

Razem: 1332 — OK 6, AREA_OFF 3, MERGED 6; PO — OK 6, AREA_OFF 4, MERGED 5.

**Torenie 3 E** — parter; model `35146797b474` → `35146797b474`; bryły 1 → 1; kompilacja 0E/0W → 0E/0W; wynik: **IDENTICAL**

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 4.47 | — | — | MISSING | — | — | — | MISSING | — |
| 2 | Kuchnia | 9.73 | 60.79 | +25.19 m² / +70.8 % (razem dekl. 35.6) | MERGED z 3 | main-room-0-0 | 60.79 | +25.19 m² / +70.8 % (razem dekl. 35.6) | MERGED z 3 | NOT_READ |
| 3 | Salon + Jadalnia | 25.87 | 60.79 | +25.19 m² / +70.8 % (razem dekl. 35.6) | MERGED z 2 | main-room-0-0 | 60.79 | +25.19 m² / +70.8 % (razem dekl. 35.6) | MERGED z 2 | NOT_READ |
| 4 | Pokój | 11.09 | 18.05 | +6.96 m² / +62.7 % | AREA_OFF | main-room-0-1 | 18.05 | +6.96 m² / +62.7 % | AREA_OFF | NOT_READ |
| 5 | Pokój | 12.74 | — | — | MISSING | — | — | — | MISSING | — |
| 6 | Łazienka | 6.07 | — | — | MISSING | — | — | — | MISSING | — |
| 7 | Kotłownia z pralnią | 3.53 | — | — | MISSING | — | — | — | MISSING | — |

Razem: 1332 — AREA_OFF 1, MERGED 2, MISSING 4; PO — AREA_OFF 1, MERGED 2, MISSING 4.

**Wasabi GE** — parter; model `d1834567d37b` → `3f9468c6dde5`; bryły 3 → 3; kompilacja 0E/0W → 0E/1W; wynik: **IMPROVED** (zyskane: 4, 6, 7, 8)

| nr | nazwa | dekl. m² | 1332: pole m² | 1332: różnica | 1332: status | PO: poligon | PO: pole m² | PO: różnica | PO: status | numer (PO) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wiatrołap | 5.01 | 5.04 | +0.03 m² / +0.5 % | OK | main-room-0-2 | 5.04 | +0.03 m² / +0.5 % | OK | NOT_READ |
| 2 | Hol | 9.04 | 46.92 | -0.57 m² / -1.2 % (razem dekl. 47.49) | OPEN_OK z 10,11 | main-room-0-4 | 46.92 | -0.57 m² / -1.2 % (razem dekl. 47.49) | OPEN_OK z 10,11 | NOT_READ |
| 3 | Łazienka | 3.46 | 3.64 | +0.18 m² / +5.2 % | OK | main-room-0-6 | 3.64 | +0.18 m² / +5.2 % | OK | NOT_READ |
| 4 | Korytarz | 6.17 | 40.77 | +0.12 m² / +0.3 % (razem dekl. 40.65) | MERGED z 6,7,8 | main-room-0-8 | 6.21 | +0.04 m² / +0.6 % | OK | READ |
| 5 | Łazienka | 6.22 | 6.21 | -0.01 m² / -0.2 % | OK | main-room-0-5 | 6.21 | -0.01 m² / -0.2 % | OK | READ |
| 6 | Pokój | 11.49 | 40.77 | +0.12 m² / +0.3 % (razem dekl. 40.65) | MERGED z 4,7,8 | main-room-0-10 | 11.53 | +0.04 m² / +0.3 % | OK | READ |
| 7 | Pokój | 11.87 | 40.77 | +0.12 m² / +0.3 % (razem dekl. 40.65) | MERGED z 4,6,8 | main-room-0-11 | 11.95 | +0.08 m² / +0.7 % | OK | READ |
| 8 | Pokój | 11.12 | 40.77 | +0.12 m² / +0.3 % (razem dekl. 40.65) | MERGED z 4,6,7 | main-room-0-9 | 10.72 | -0.40 m² / -3.6 % | OK | NOT_READ |
| 9 | Garderoba | 4.22 | 3.98 | -0.24 m² / -5.6 % | OK | main-room-0-7 | 3.98 | -0.24 m² / -5.6 % | OK | NOT_READ |
| 10 | Salon + Jadalnia | 26.35 | 46.92 | -0.57 m² / -1.2 % (razem dekl. 47.49) | OPEN_OK z 2,11 | main-room-0-4 | 46.92 | -0.57 m² / -1.2 % (razem dekl. 47.49) | OPEN_OK z 2,11 | NOT_READ |
| 11 | Kuchnia | 12.1 | 46.92 | -0.57 m² / -1.2 % (razem dekl. 47.49) | OPEN_OK z 2,10 | main-room-0-4 | 46.92 | -0.57 m² / -1.2 % (razem dekl. 47.49) | OPEN_OK z 2,10 | NOT_READ |
| 12 | Pokój | 8.2 | 8.08 | -0.12 m² / -1.4 % | OK | main-room-0-3 | 8.08 | -0.12 m² / -1.4 % | OK | NOT_READ |
| 13 | Kotłownia z pralnią | 5.99 | 6.14 | +0.15 m² / +2.4 % | OK | main-room-0-1 | 6.14 | +0.15 m² / +2.4 % | OK | NOT_READ |
| 14 | Garaż | 22.43 | 22.70 | +0.27 m² / +1.2 % | OK | main-room-0-0 | 22.70 | +0.27 m² / +1.2 % | OK | READ |

Razem: 1332 — OK 7, OPEN_OK 3, MERGED 4; PO — OK 11, OPEN_OK 3.
