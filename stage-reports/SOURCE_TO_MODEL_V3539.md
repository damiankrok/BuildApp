# BuildPlan v3.53.9 — obrys przy szerokich przeszkleniach i bramach

Baza: kod `f4a4221` (APK 1334, solver 2.39.0, usługa 1.11.0), raport `a5b00e4`. Wynik: solver **2.40.0**, usługa
**1.11.0** (bez zmian kontraktu), APK **1335**. Bez płatnych wywołań (księga 2,72807938 USD, 92 wpisy — bez zmian),
bez H2 i prywatnego benchmarku, ForgeShape tylko do odczytu. Źródła wydawcy, plansze i zrzuty diagnostyczne — prywatnie
poza Gitem. Projekty diagnozy **DEV**: Malwina, Ofelia 2, Stellarie, Jaskrzyny, Lulo 3, Renklody 15, Layla 2.
Interfejs Android: **NOT_VERIFIED** (brak urządzenia, brak `/dev/kvm`).

Protokół (zakres, metryki, tolerancje, reguła doboru świeżych projektów) zapisano prywatnie przed zmianą kodu;
oczekiwania dla świeżych projektów zapisano z rzutów i zapieczętowano skrótem przed obejrzeniem wyniku.

---

## 1. Pierwsza błędna decyzja (DEV, na arkuszach)

Siedem odmów DEV przejrzano na arkuszach i w zrzucie odczytu granic (`wallsX/Y`, przerwy, ościeża, sygnatura,
opis). We wszystkich pierwsza błędna decyzja zapada **przed zalewem**, w tym samym miejscu:

* **Obwiednia ścian kończy się przed domem.** `walledEnvelope` to prostokąt osi długich pasów ścian. Elewacja złożona
  z filarów i szerokich otworów (przeszklenie ponad 3,2 m, brama) nie ma długiego pasa, więc prostokąt staje na
  ostatniej ścianie wewnętrznej (ściana garażu, przegroda), a każda komórka poza nim jest „zewnętrzem z założenia” —
  niezależnie od tego, co stoi na jej krawędziach. Malwina: koniec na y = 337 zamiast 183 (blok dzienny z
  przeszkleniem 3,30 m poza obwiednią); Ofelia 2: pas środkowy y 412–531 z 154–724; Jaskrzyny: y 188–429 z 188–698;
  Stellarie: x 109–502 z 109–759; Lulo 3, Layla 2, Renklody 15 — to samo.
* **Mechanizmy, które miały to naprawić, mijały te domy z konkretnych powodów:**
  - *wnęka/skrzydło (`baysOf`)* — ściana boczna liczyła się tylko jako **jeden pas zaczynający się na krawędzi
    obwiedni**. Ściana domu przechodząca przez krawędź z wnętrza (Malwina, ściana wschodnia bloku dziennego; Ofelia 2,
    obie ściany garażu) albo przerwana przy krawędzi przeszkleniem szerszym niż nadproże (Jaskrzyny, przeszklenie
    zachodnie 3,31 m, opis 330/230) nie była ścianą boczną;
  - *obrys z otworami (005C)* — w Malwinie przeciekał przez przeszklenie 3,30 m rysowane jedną linią (bez odczytanego
    opisu: na arkuszu 853 px czytnik opisów nie widzi „330/230”), w Ofelii/Layli przez szerokie przerwy bez wypełnienia;
  - *przedłużenie ścian bocznych (005B)* — odrzucone, gdy obwiednia kończy się na grubej ścianie (garaż Jaskrzyn).
* **Stellarie** ma dodatkowo inną, wcześniejszą przyczynę: zasięg z łańcucha kończy się na licu wewnętrznym ściany
  wschodniej (737,5 px wobec lica zewnętrznego 759), więc cała ściana wschodnia wypada z pasów — ta sama rodzina co
  Skalnice 3 (zasięg na licu wewnętrznym), nie mechanizm bramy. Brama 5,14 m jest rysowana linią przerywaną.
* **Renklody 15** odmawia na skali (METRIC_RESOLUTION_INCONCLUSIVE) zanim granica ma znaczenie; **Lulo 3** ma oprócz
  garażu poza obwiednią przeszklenie 380/230 wpuszczające zalew do salonu.

Szkło i bramy, które naprawdę zamykają przestrzeń (Lulo 3, Renklody 15): elewacja z filarów i szkła zamyka
pomieszczenie wtedy, gdy przeszklenie jest rysowane w grubości ściany między dwoma kawałkami tej samej ściany; filary
bez niczego pomiędzy (Renklody — taras zadaszony 6,76 m) zostają otwarte. Odróżnia je wyłącznie to, co rysunek stawia
w otworze (linie szkła, skrzydło, linia bramy) albo wydrukowany opis tej szerokości — nie szerokość.

## 2. Zmiana

**Ściana boczna wnęki jako łańcuch pasów jednej linii** (`baysOf`, `chainedReading`; solver 2.40.0).

1. Ściana boczna to łańcuch współliniowych pasów jednej linii ściany (osie w granicy grubości ściany — narożnik
   poszerza pas przy końcu ściany), łączonych przez dziury nie szersze niż nadproże (3,2 m — ta sama konwencja, którą
   czyta się każdą ścianę) **albo** przez dziurę, którą czytnik szerokich przerw już uznał, na dowodzie z rysunku, za
   otwór w tej właśnie ścianie (`OPENING_IN_WALL`: linie szkła przez otwór, opis tej szerokości). Łańcuch wychodzi
   z obwiedni, gdy sięga za krawędź z samej krawędzi **albo z wnętrza** prostokąta.
2. Usta takiej wnęki zamyka **tylko dowód z rysunku**: obie ściany sięgają linii frontu i (a) linia wypełnienia
   w grubości ściany przez otwór albo (b) wydrukowany opis jego szerokości — jak dotychczas. Hipoteza rozdzielcza
   „zamknij usta kieszeni” **nie** dotyczy wnęk z łańcuchami (wylot bez niczego pozostaje pytaniem — test §37).
3. Odczyt z łańcuchami jest brany **tylko** gdy prostokąt obwiedni stoi, a obrys z otworami (005C) niczego nie dodaje,
   i tylko gdy buduje więcej niż prostokąt. Gdzie obrys już kontynuuje dom (Arganiach, Macierzanki 4), jego odczyt
   zostaje bez zmian; obrys nie jest czytany drugi raz na odczycie z łańcuchami. We wszystkich pozostałych odczytach
   reguła wnęk jest bajt w bajt dawna (jeden pas od krawędzi).
4. **Pierwszeństwo reguły bramy.** Garaż, który reguła bramy (`shutGateBays`) rozpoznaje własnym dowodem (trzy ściany,
   ościeża, miejsce na samochód, opis/skrzydło/drzwi), zachowuje jej bariery kafelkowania także wtedy, gdy znalazła go
   wnęka z łańcuchami (Bakopy — bez tego kafelkowanie przechodziło przez ścianę garażu).

**Co jest decyzją zalewu, a co elementem modelu.** Zmiana dotyczy wyłącznie decyzji granicy dla zalewu i komórek
(które komórki są wnętrzem). Ściany, okna, drzwi i bramy w modelu emituje dalej dotychczasowy odczyt otworów z planu
(`openings-v2`): w Jaskrzynach przeszklenie zachodnie wychodzi jako okno 3,30 × 2,30 m, brama jako drzwi
5,00 × 2,25 m (opisy 330/230 i 500/225 na arkuszu) — szerokość i rodzaj pochodzą z odczytu otworu, nie z wnęki.
Wnęka nie dodaje muru ani nie zamyka wiaty: wylot bez wypełnienia i bez opisu zostaje otwarty.

## 3. Dowody — Jaskrzyny (DEV, odzyskany)

Na tych samych bajtach co 1334 (paczka z próby 3534):

* **Przed (1334):** odmowa PLAN_RESOLUTION_INCONCLUSIVE — „najniższa kondygnacja 47,87 m² wobec 161,96 m²
  wydawcy”. Obwiednia y 188–429 kończy się na ścianie północnej garażu; cała południowa część domu (pokoje 1, 2, 4, 9)
  i połowa salonu są zewnętrzem z założenia, zalew wchodzi przez otwarte wnętrze do całego domu, zostaje garaż.
* **Pierwsza błędna decyzja:** ściana zachodnia domu jest przerwana przeszkleniem 330/230 (3,31 m) dokładnie tam,
  gdzie wypada krawędź obwiedni (pasy 201–385 i 513–680); żaden z jej kawałków nie zaczyna się przy krawędzi, a ściana
  wspólna z garażem biegnie przez krawędź od y = 201 — reguła wnęk nie widzi ścian bocznych.
* **Po (v3.53.9):** ściana zachodnia jest łańcuchem przez przeszklenie, które czytnik szerokich przerw sam uznał za
  otwór w ścianie (linie szkła przez całą szerokość); wnęka x 163–495 × y 429–698 ma usta zamknięte rysunkiem (okno
  300/230, drzwi 150/210 między filarami). Model: bryła główna 8,60 × 13,20 m i garaż 6,40 × 7,48 m (wymiary
  z arkusza 860/1320 i 640/748), zabudowa 161,39/161,96 m² (MATCHES), skala MEASURED (2,5991 wobec 2,5990 cm/px),
  ilości USABLE_IN_SCOPE, 0 błędów i 0 ostrzeżeń kompilacji. Otwory przy zmienionych granicach: okno zachodnie
  3,30 × 2,30 m (opis 330/230), brama 5,00 × 2,25 m (500/225), okno frontowe 3,00 m (300/230), drzwi 1,50 m
  (150/210), dwa przeszklenia północne 2,70 m (270/230). Taras NE i taras zachodni zostają poza bryłą.
* **Scena:** dach dwuspadowy na bryle głównej, stropodach garażu z bramą, front z oknem i drzwiami — zgodnie z rzutem.
  Pokoje: 7 odczytanych, 6 zgodnych z tabelą wydawcy (tabela obejmuje też poddasze).

## 4. Pozostałe odmowy DEV — co blokuje dalej

Na tych samych bajtach, kod końcowy (najniższa kondygnacja wobec powierzchni zabudowy wydawcy):

| Dom | 1334 | v3.53.9 | Co blokuje dalej |
|---|---|---|---|
| Malwina | odmowa 44,41/157,11 m² | odmowa **121,03**/157,11 m² | blok dzienny z przeszkleniem 3,30 m wraca jako wnęka z łańcuchem; garaż odrzuca reguła obwodu ścian (`perimeterWallEvidence`, udział muru poniżej 0,35 przy bramie i przeszkleniu), opisów na arkuszu 853 px czytnik nie odczytuje — bez opisu bramy reguła bramy nie ma dowodu |
| Ofelia 2 | odmowa 16,50/170,49 | bez zmian | obie ściany garażu przechodzą przez krawędź, ale wylot frontu to szerokie przerwy bez wypełnienia i bez odczytanego opisu — zgodnie z regułą zostaje otwarty; zalew wchodzi też przez nieodczytane przeszklenie salonu |
| Stellarie | odmowa 88,92/188,41 | bez zmian | zasięg na licu wewnętrznym ściany wschodniej (rodzina Skalnice 3) — osobna przyczyna, przed granicą; brama 5,14 m linią przerywaną |
| Lulo 3 | odmowa 17,09/189,79 | bez zmian | przeszklenie 380/230 wpuszcza zalew do salonu zanim wnęka ma znaczenie; garaż poza obwiednią |
| Renklody 15 | odmowa 12,01/233,52 | bez zmian | skala (METRIC_RESOLUTION_INCONCLUSIVE) — granica nie jest pierwszą błędną decyzją |
| Layla 2 | odmowa 3,70/113,53 | bez zmian | obwiednia kończy się przed domem, a obrys (005C) przecieka przez szerokie przerwy bez wypełnienia i bez opisu — wylot bez dowodu zostaje otwarty, zgodnie z regułą |

Odzyskany z DEV: **Jaskrzyny** (§3). Częściowo: Malwina (o 76,6 m² bliżej, nadal odmowa — nie liczona jako odzyskana).
Żadna z tych odmów nie została „domknięta” obniżeniem progu ani hipotezą bez dowodu.

## 5. Regresja 80 przebiegów + 10 świeżych z 1334

Ta sama paczka bajtów co dla 1334 (80 przebiegów: korpus 33, indep 4+5, świeże 10, ext 8, próba 20) i 10 świeżych
pakietów z 1334; baza = końcowe przebiegi 3.53.8 (`reg-h`, kod identyczny z `f4a4221`).

| Zbiór | domy | bajt w bajt | zmienione modele | odmowa w obu | odmowa → model |
|---|---|---|---|---|---|
| korpus | 33 | 29 | 0 | 4 | 0 |
| indep / indep2 | 4 / 5 | 4 / 4 | 0 | 0 / 1 | 0 |
| świeże (3538) | 10 | 6 | 0 | 2 | **2** (Jaskrzyny, Anodach) |
| ext | 8 | 6 | 0 | 2 | 0 |
| próba | 20 | 13 | 0 | 7 | 0 |
| **razem 80** | 80 | **62** | **0** | 16 | **2** |
| 10 świeżych z 1334 | 10 | 9 | 0 | 1 (Mekintosze) | 0 |

* Odmowy **18 → 16** z 80; żaden model nie zmienił się w przebiegu, który miał model; brak wzrostu liczby błędów.
* **Kontrole** — wszystkie bajt w bajt: Skalnice 3, Nigelle 4 (nadal SHORT 175/256 — osobna przyczyna zasięgu),
  Torenie 3, Eliza 4; narożniki Tiliach, Kocimiętek, Przegorzan (kontrpróby nadmiernego zamykania — bez nowej ściany);
  portyk Gaurach 5 i wnęka Kalandrynii zostają otwarte; podjazd Azolli 7 (`475cf459d1e6` jak w 1334); ściana
  garaż–dom Bakop (226,5/227,9 MATCHES, bariera reguły bramy zachowana); poprawki ścianek z 1334 (Dzwonki 3
  `5963146e1c64`).
* **Anodach (świeży z 3538, aktywowany):** garaż za bramą 5 m dotąd zewnętrzem (190,33/243,19 → odmowa), teraz
  zabudowany, 234,92/243,19 MATCHES, skala MEASURED, ilości USABLE_IN_SCOPE. Kompilacja: **3 błędy**
  `OPENING_ABOVE_WALL_TOP` w ścianie tylnej (wierzch otworu 2,20 wobec wierzchu ściany 2,02 — dotychczasowy mechanizm
  wysokości ściany pod stropodachem, nie granica) i 3 ostrzeżenia `FILL_WITHOUT_OPENING`. Taras zadaszony NW zabudowany
  także w bazie.

## 6. Świeża próba (zamrożona przed oceną)

**Dobór (reguła zapisana przed pozyskaniem):** lista parterowych pc1073 już na dysku, strony 8–12, rodziny nieużyte
nigdzie wcześniej; pierwsze 14 w kolejności strony pozyskane raz kodem bazy (a5b00e4). Oczekiwania spisane wyłącznie
z rzutów parteru (bez otwierania wyniku) i zapieczętowane: `sha256 04487521…`, 2026-11-13 07:01:58 UTC. Kryterium
cech: przeszklenie/otwór > 3,2 m, brama garażu lub strefa otwarta przy bryle — spełnia je wszystkie 14 (przeszklenia
3,4–6,0 m w 8 domach, bramy w 6, portyki, wiaty, tarasy zadaszone, dziedziniec). Baza i wariant odtworzone na tych
samych bajtach. Wszystkie wyniki zachowane.

| Dom | Cecha z arkusza | Baza (1334) | v3.53.9 | Aktywacja |
|---|---|---|---|---|
| Czereśnie 2 | pergola N, daszek wejścia | MATCHES 88,0/88,4 | bez zmian | nie |
| Cynamon 2 | przeszklenie 3,6 m, brama 3,0 m | MATCHES 187,2/187,7 | bez zmian | nie |
| Pod Osiką | dwa portyki na kolumnach | MATCHES 189,4/190,6 | bez zmian | nie |
| Żonkile 3 | przeszklenie 3,4 m, brama 5,0 m | odmowa (83,7/191,7) | bez zmian | nie (wnęka garażu już w bazie) |
| Majówki v2 | ganek na filarach, elewacja z filarów | odmowa (skala) | bez zmian | nie |
| Lilaki 2 | przeszklenia 3,6 i 4,2 m, brama 4,85 m, wiata | odmowa | bez zmian | nie |
| Paryżanki | przeszklenie 4,65 m do tarasu NE, ganek | NEAR 195,8/175,7 | bez zmian | nie |
| **Liredy** | **brama 285/229**, strefa wejścia, taras | NEAR 142,7/165,2 | **MATCHES 158,0/165,2** | **tak** |
| Pod Hebanowcem 5 | przeszklenie 5,5 m, brama 2,5 m | MATCHES 179,5/180,1 | bez zmian | nie |
| Anselie | przeszklenie 3,9 m, ganek | MATCHES 171,2/169,8 | bez zmian | nie |
| Draceny 2 | dziedziniec, przeszklenie 5,4 m, brama 5,0 m | odmowa | bez zmian | nie |
| Nawłocie 6 | brama 5,0 m, strefa wejścia | NEAR 245,9/227,1 | bez zmian | nie |
| Surfinie 2 | przeszklenia 6,0 i 3,75 m | odmowa | bez zmian | nie |
| Akebie 7 | przeszklenie 5,0 m, okapy | MATCHES 105,1/105,5 | bez zmian | nie |

13 z 14 bajt w bajt jak w bazie (8 modeli, 5 odmów w obu) — stabilność. **Liredy (świeży, aktywowany, zgodny ze
sceną):** garaż 11 za bramą 285/229 dotąd był ucięty w połowie głębokości — komórki przed bramą były „zewnętrzem
z założenia”, a model miał fałszywe okno 3,85 × 1,30 m przez środek garażu. Teraz garaż jest osobną bryłą
4,78 m szerokości (opis 476), brama wychodzi jako drzwi 2,87 × 2,20 m (opis 285/229), strefa wejścia obok garażu
zostaje otwarta (zgodnie z zapieczętowanym oczekiwaniem), 0 błędów kompilacji. Taras zadaszony NW jest zabudowany
w bazie i w wariancie — błąd istniejący, niezmieniony.

**Zakres przeniesienia:** świeży dowód aktywacji dotyczy **bramy garażu** za ścianami bocznymi przechodzącymi przez
krawędź obwiedni. Szerokie przeszklenia w świeżych domach były już obsługiwane przez bazę (Hebanowiec 5,5 m,
Akebie 5,0 m, Anselie 3,9 m, Cynamon 3,6 m — MATCHES w obu) albo dom odmawia z innej przyczyny (Surfinie, Lilaki,
Draceny, Żonkile, Majówki — zasięg/skala/układ); przypadek przeszklenia szerszego niż nadproże na **ścianie bocznej**
skrzydła jest potwierdzony tylko na DEV (Jaskrzyny). Innego wydawcy w porównywalnym formacie w tej próbie nie było.

## 7. Tabela zamrożona pokoi

Zamrożona tabela pokoi (12 domów, 169 wierszy wydawcy, tolerancje bez zmian od 3.53.6): **12/12 bajt w bajt**,
w bazie i po zmianie OK 75, OPEN_OK 12, AREA_OFF 14, MERGED 53, MISSING 15. Zmiana granicy nie przesunęła żadnego
pokoju w domach, które miały model. W Jaskrzynach (DEV, poza tabelą) 7 odczytanych pomieszczeń parteru, 6 zgodnych
z tabelą wydawcy.

## 8. Pomiar w wyniku

Znaczenie rekordu `measurement` bez zmian (schemat 1.0.0; usługa 1.11.0). Pokrycie liczone jak dotąd z
zabudowanych brył najniższej kondygnacji wobec powierzchni zabudowy wydawcy; skala z kotwic arkusza. Odzyskane:
Jaskrzyny MATCHES 0,996 / MEASURED 1,000039 / USABLE_IN_SCOPE; Anodach MATCHES 0,966 / MEASURED 1,000138 /
USABLE_IN_SCOPE (błędy kompilacji ściany tylnej zostają w diagnostyce kompilacji, rekord ich nie ukrywa); Liredy
NEAR → MATCHES 158,0/165,2. Rekord nie zyskał żadnego nowego powodu ani progu.

## 9. Testy, typy, kontrakt

* `npm run typecheck` (całe repozytorium i `apps/web`) na kodzie końcowym: bez błędów.
* Macierz pakietów objętych zmianą (`packages/reconstruction`, `packages/analysis-service`, `apps/local-analyzer`
  z Node 18.20.4, `apps/analyzer-api`, `tests/architecture`) na `2a67638`: **2355 testów, 2339 zielonych, 16 czerwonych**
  = **13 znanych z listy bazy** (Larchfield, NFD bez ICU, M10, reference 4 i 7, research-isolation ×4, wall-strip
  005Q ×4) + 2 testy wątków `analyzer-api/worker` (przekroczony czas pod obciążeniem regresji; w izolacji 3/3
  zielone) + migawka kontraktu Androida nieaktualna z powodu nowej wersji solvera. Migawkę odtworzono z bajtów serwera
  (`capture-android-contract.ts`): zmieniają się wyłącznie `solver` 2.39.0 → 2.40.0 i `candidateHash`; test kontraktu
  4/4 zielony, `961fb1f`. Żaden nowy czerwony test.
* Nowe testy (`wide-wing-chain-v3539.test.ts`, 7): przyczyna (prostokąt kończy się na wewnętrznej ścianie garażu);
  dom za frontem z przeszkleniami jako wnęka z łańcuchem — zabudowany; ściana zachodnia łączona przez przeszklenie
  3,75 m tylko dlatego, że czytnik uznał je za otwór w ścianie; **kontrpróby**: front z samych słupów (portyk) zostaje
  otwarty, opis szerokości wylotu wydrukowany przy sąsiednim otworze nie zamyka wylotu, garaż bez niczego w wylocie
  (wiata) zostaje otwarty; garaż za narysowaną bramą zabudowany. Dotychczasowe kontrpróby zostają w mocy bez zmian:
  wylot bez dowodu (§37, granica obwiedni), wnęka bez zamknięcia, taras, ścianki 005Q/N1a; wynik skompilowany,
  cienkie bryły i podgląd częściowy przez testy `analysis-service` i `local-analyzer` w macierzy.

## 10. APK 1335 i przebieg z paczki

* Zbudowany z czystego drzewa `961fb1f` (`./gradlew --offline -PpreviewVersionCode=1335 previewApks`), ten sam podpis.
* `BuildPlan-Model-Preview-1335-arm64-v8a-debug.apk`: 50 704 504 B, SHA-256
  `6805bea6259a65b95dff09d63eedff21388a33987d65f72578b625ef9e966ce4`; `aapt`: `com.buildplan.preview`, versionCode
  1335, versionName `0.1335.0-owner`, minSdk 26, targetSdk 35; `apksigner`: certyfikat SHA-256 `6e48fac4…ca0da` —
  równy 1334.
* Paczka analizatora z APK: manifest 12/12 plików zgodnych ze skrótami, w niej solver 2.40.0 i usługa 1.11.0.
* **Host z paczki** — produkcyjny `main.mjs` z APK, Node 18.20.4 z symulacją braku ICU, żywe strony wydawcy:

| Strona | wynik | czas | szczyt RSS | model hosta = powtórka | scena zapisana i wczytana |
|---|---|---|---|---|---|
| Jaskrzyny (odzyskany, DEV) | hello → done COMPLETE, pomiar MATCHES 161,39/161,96, MEASURED, USABLE_IN_SCOPE | 636 s | 964 MB | `b5fe9e43e2d8` = `b5fe9e43e2d8` | tak (`loadBundle`, 81 siatek) |
| Gaurach 5 (kontrpróba: portyk otwarty) | hello → done COMPLETE, pomiar MATCHES 172,71/176,25, MEASURED, USABLE_IN_SCOPE | 234 s | 818 MB | `d4817e71600c` = `d4817e71600c` (= baza 1334) | tak (133 siatki) |

* Urządzenie / emulator: brak (`/dev/kvm` niedostępne) — interfejs Androida i przebieg LOCAL na telefonie
  **NOT_VERIFIED**. Wyniki hosta i aplikacji podane osobno: aplikacja nie była uruchomiona.
* APK przekazany prywatnie (poza Gitem).

## 11. Zakres uogólnienia i największe pozostałe rozbieżności

**Zakres uogólnienia.** Mechanizm jest jeden i ogólny (ściana boczna wnęki jako łańcuch pasów jednej linii;
zamknięcie wylotu wyłącznie dowodem z rysunku). Przeniesienie pokazano na świeżym domie dla **bramy garażu** (Liredy)
i na drugim domu korpusu (Anodach, brama 5 m); przypadek przeszklenia szerszego niż nadproże na ścianie bocznej
skrzydła tylko na DEV (Jaskrzyny) — dla niego zakres jest ograniczony. Samo podniesienie limitu nadproża nie jest
częścią zmiany: limit 3,2 m pozostał, a przez szerszą dziurę łańcuch przechodzi tylko, gdy czytnik szerokich przerw
uznał ją na rysunku za otwór w tej ścianie. Wiaty, portyki, wnęki, tarasy i podjazdy kontrolne zostały bez zmian.

**Największe pozostałe rozbieżności:**
1. **Odmowy, gdzie obwiednia kończy się przed domem z innego powodu** — 16/80: zasięg na licu wewnętrznym (Stellarie,
   rodzina Skalnic), szerokie wyloty bez wypełnienia i bez odczytanego opisu (Ofelia 2, Layla 2, Lulo 3 — tu reguła
   słusznie nie zamyka bez dowodu; brakuje odczytu opisu), skala (Renklody 15, Mekintosze).
2. **Garaż Malwiny** — odrzucany przez regułę obwodu ścian, gdy opisy bramy są nieczytelne (arkusz 853 px); dom
   zbliżył się o 76,6 m², nadal odmowa.
3. **Anodach** — 3 błędy kompilacji `OPENING_ABOVE_WALL_TOP` w ścianie tylnej (wysokość ściany pod stropodachem
   2,02 m wobec otworu 2,20 m) — istniejący mechanizm wysokości, odsłonięty przez odzyskany model.
4. **Strefy zadaszone zabudowane** — taras NW Liredów, narożniki Tiliach/Kocimiętek/Przegorzan zamknięte pierścieniem
   (bez zmian od 1333/1334).

Dowody prywatne (poza Gitem): `/home/user/rd/v3539` — protokół, zapieczętowane oczekiwania świeżych domów
(`sha256 04487521…`), przebiegi `reg-f` (80 + 10), `fresh/rep-base` i `fresh/rep-var` (14), tabela pokoi
`trial-f.json`, plansze `look/*`, przebiegi hosta `host1335/*`.
