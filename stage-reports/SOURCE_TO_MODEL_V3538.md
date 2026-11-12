# BuildPlan v3.53.8 — odzyskanie zamkniętych części domu

Baza: kod `9824e17` (APK 1333, solver 2.38.0), audyt `b1c67ad`. Wynik: solver **2.39.0**, usługa **1.11.0**, kod
`638a925` + `084411a` + `f4a4221`, APK **1334** (z `f4a4221`). Bez płatnych wywołań (księga 2,72807938 USD, 92 wpisy — bez
zmian), bez H2 i prywatnego benchmarku, ForgeShape tylko do odczytu. Źródła wydawcy, plansze i pliki pomiarowe
z obrazami zostają prywatnie poza Gitem. Projekty diagnozy oznaczone **DEV**: Azolle 7 i dziewięć odmów z polecenia.
Interfejs Android: **NOT_VERIFIED** (brak urządzenia i `/dev/kvm`).

Protokół (zakres, metryki, tolerancje, reguła doboru świeżych projektów) zapisano prywatnie przed zmianą kodu.
Oczekiwania dla świeżych projektów zapisano z rzutów parteru i zapieczętowano skrótem, zanim obejrzano jakikolwiek
wynik (`sha256 3abe6a1a…`, 2026-11-12 21:13 UTC).

---

## 1. Mechanizm — potwierdzony na źródłach

**Azolle 7 (DEV).** Komórka siatki x 413–493 × y 168–456 (piksele arkusza) to w całości wnętrze: kuchnia i wiatrołap.
Zalew z zewnątrz wchodzi krawędzią południową y = 456. Drzwi wejściowe 165/210 stoją między końcem pionowej ściany
(x 398–413, kończy się dokładnie na krawędzi komórki) a filarem 0,9 m (x 473–503 × y 442–457), zbyt krótkim na pas.

* **Linia jest.** y = 456 to lico zewnętrzne filarów (audyt 3.53.7 mylnie podał „brak linii”).
* **Pierwsza błędna decyzja:** `closureOf` liczy jako ścianę tylko kawałki pasów *wewnątrz* krawędzi. Tu jedno ościeże
  leży na jej końcu, drugie w filarze spoza pasów — nie ma „dziury między ościeżami”: wall 0,00, line 0,25,
  closure 0,25 < 0,62, krawędź otwarta.
* **Skutek w 1333:** kuchnia i wiatrołap to teren; bryła traci część, dach siada na złym bloku, pokoje 1, 4, 13 znikają,
  garaż ma +54,8 % pola i okno 4,08 m zamiast bramy.

**Dziewięć odmów (DEV)** — przyczyny są inne niż w Azollach:

| Dom | Przyczyna odmowy (arkusz + ślad zalewu) | Ten sam mechanizm? |
|---|---|---|
| Malwina | obwiednia ścian kończy się przed domem; wylot przeszklony 7,55 m | nie |
| Ofelia 2 | jw., przeszklenia 5,7 i 7,9 m | nie |
| Jaskrzyny | okno 3,29 m (linia przerywana) szersze niż nadproże 3,2 m | nie |
| Stellarie | brama garażu 5,14 m w skrzydle wschodnim | nie |
| Layla 2 | wylot 6,82 m | nie |
| Renklody 15 | taras zadaszony 6,76 m, elewacja z filarów i szkła | nie |
| Lulo 3 | tylne przeszklenie między filarami → COVERED_TERRACE; garaż FLUSH_ATTACHED niezbudowany | nie |
| Skalnice 3 | zasięg z łańcucha kończy się na licu wewnętrznym ściany południowej → brzeg siatki otwarty | nie |
| Eliza 4 | wiatrołap obejmuje wnękę; brak linii siatki na ścianie drzwi 145/220 | ta sama rodzina, inna postać (brak linii) |

Zmianę ograniczono do powtarzalnego, potwierdzonego mechanizmu Azolli. Żadna z dziewięciu odmów nie zmienia się
(18 odmów przed i po w 80 przebiegach) — ich przyczyny to zasięg i szerokie wyloty obwiedni (§11).

## 2. Zmiany

1. **Drzwi między ościeżami, których czytnik pasów nie widzi** (`plan-decomposition.ts`, `doorwayBetweenJambs`).
   Ościeża czytane z tuszu: odcinek wzdłuż krawędzi (poszerzonej o grubość ściany), na którym tusz w poprzek linii ma
   ≥ 0,7 grubości ściany przez ≥ pół grubości ściany. Dziura między dwoma ościeżami, nie szersza niż nadproże (3,2 m),
   leżąca głównie na krawędzi, zamyka krawędź **tylko dla zalewu** i tylko gdy jednocześnie:
   (a) jedno z ościeży leży na ścianie znalezionej przez czytnik pasów;
   (b) przy dziurze wydrukowano opis tego otworu — bliżej tej linii niż każdej linii poprzecznej, o szerokości
   w ±12 % od dziury;
   (c) nie oba ościeża są **zawrotami** (ściany biegnące w głąb dalej niż grubość ściany) — szczelina między dwoma
   zawrotami to wylot wnęki, ganku, wykusza, cokolwiek wydrukowano obok.
   Ganek, loggia, podjazd nie mają wydrukowanej szerokości wylotu i zostają otwarte. Pozostałe użycia domknięć krawędzi
   bez zmian. W Azollach reguła znajduje tylko drzwi wejściowe 165 (dziura 1,65 m).
2. **Kafelkowanie przy remisie** (`mergeRegions`): wśród prostokątów BUILT o polu ≥ 98 % największego wybierany jest
   ten, którego szwy niosą więcej narysowanej ściany (przewaga > 0,1). Azolle: cięcie wzdłuż skrzydła (x 413) zamiast
   przez łazienkę 12 (y 456).
3. **Szew przez jedną zamkniętą przestrzeń** (`seamOpenShare`, `party-wall.ts`). Linia między dwiema bryłami tej samej
   kondygnacji, po której obu stronach komórki są BUILT (≥ 50 %), a na ≥ 50 % której nie stoi ściana (tusz ani drzwi
   między kawałkami ściany), to cięcie kafelkowania: przy zbyt małej ilości narysowanej ściany kontakt jest OPEN, jak
   pod jednym dachem; ściany stawia odczyt wnętrza tam, gdzie są narysowane. **Strażnik okładziny:** pas komórek wzdłuż
   szwu nie głębszy niż 1,2 m, zamknięty ścianą po drugiej stronie (szafy garażu, wnęka), nie liczy się jako otwarty —
   ściana dzieląca stoi za nim.
4. **Ścianka pod różnymi dachami** (`emit.ts`). Bieg ścianki jest cięty wszędzie tam, gdzie zmienia się dach nad nim —
   na kondygnacji, która jest najwyższą kondygnacją bryły dobudowanej: pod stropodachem kawałek sięga spodu płyty i nie
   podąża za dachem; pod własnym dachem spadzistym dobudówki (krzyżowym albo osobnym dachem połaciowym) ginie w jej
   połaciach; dach główny nie przykrywa obcych kawałków. Bryła bez własnego dachu obok bryły pod dachem połaciowym
   zostaje w odcinku tego dachu (jak w 1333). Drzwi należą do kawałka, w którym leży większość ich szerokości, i
   zachowują położenie i szerokość. Bieg zachowuje swój identyfikator na najdłuższym kawałku; pozostałe nazwane są od
   dachu (`…-under-<bryła>`, kolejny pod tym samym dachem z numerem). Ostrzeżenie `WALL_NOT_UNDER_ROOF` bez zmian.
5. **Pomiar oddzielony od przebiegu** (`measurement.ts`, pole `measurement` wyniku, usługa 1.11.0). `run: COMPLETED`
   oznacza tylko techniczny koniec przebiegu. Osobno:
   * pokrycie: zabudowa najniższej kondygnacji wobec `footprint_area` wydawcy — MATCHES ≤ 6 %, NEAR ≤ 20 %, SHORT/OVER;
   * skala: zbudowana wobec zmierzonej z wydrukowanych wymiarów — MEASURED ≤ 3 %, DEPARTS, UNVERIFIED przy słabym
     dowodzie, NOT_ASSESSED bez dowodu;
   * ilości: USABLE_IN_SCOPE / LIMITED / NOT_USABLE / NOT_ASSESSED.
   Każdy werdykt poniżej „użyteczne” ma kod i zdanie o skutku; `READING_PARTIAL` cytuje własne zdanie solvera o tym,
   czego brak. Skala odbiegająca od zmierzonej daje też ostrzeżenie ograniczające `SCALE_DEPARTS_FROM_MEASURED`.
   Android: DTO i sekcja „Pomiar” na ekranie wyniku (**NOT_VERIFIED** na urządzeniu); web: typ klienta.
6. Test `/health` w `apps/analyzer-api` porównywał solver z literałem `2.5.0` i nie przechodził już na 1333; porównuje
   teraz z `SOLVER_V2_VERSION`.

## 3. Azolle 7 (DEV) — dowody

| | 1333 | v3.53.8 |
|---|---|---|
| bryły (m) | main 0–8 × 0,6–15,8; attached-0 10,5–15,4 × 4,54–15,8 | main 0–8 × 0,6–15,8; attached-0 8–15,4 × 7,8–15,8 |
| pokrycie parteru wobec 181,41 m² wydawcy | — | **180,8 m² (99,7 %)**, skala MEASURED (0,99999) |
| pokoje (tabela zamrożona) | OK 6, OPEN_OK 3, AREA_OFF 1, MISSING 4 | **OK 9, MERGED 5, MISSING 0** |
| błędy / ostrzeżenia kompilacji | 4 / 4 | 1 / 1 (`opening-0-front-0-0`, istniejący wcześniej) |
| dach | dwa dachy, dwuspadowy nad złym blokiem | dwuspadowy nad skrzydłem zachodnim + połacie bloku wschodniego |
| garaż | 39,26 m² (+54,8 %), okno 4,08 m | 24,82 m² (−2,2 %), brama 2,75 × 2,25 (opis 275/225) |

Odzyskane pomieszczenia: **1 wiatrołap** 5,30 / 5,56 m² (−4,6 %), **13 kotłownia** 4,25 / 4,49 m² (−5,5 %),
**14 garaż** 24,82 / 25,37 m² (−2,2 %), każde jako osobny wielokąt w gotowej scenie. **4 kuchnia** jest w modelu, ale
w jednej strefie dziennej z 2, 3, 5 i 10 (55,89 m² wobec sumy deklarowanej 56,94, −1,8 %). Kuchnia jest na rzucie
otwarta na salon, ale spiżarnia 5 ma własne ścianki i drzwi, których odczyt wnętrza nie znajduje — dlatego cała grupa
jest MERGED, a 2, 3, 10 przestają być OPEN_OK. Garaż i przedpole (podjazd) nie dostają podłogi pokoju; przedpole
zostaje poza bryłą. **Model nadal częściowy** (`READING_PARTIAL`): „93 % reprezentacji dekompozycji; 1 obiekt odrzucony
przez model; 1 obszar nazwany i niezbudowany; 2 narysowane ściany z 4,8 m bez wyjaśnienia”.

Plansze przed/po (rzut, bryły, sceny): prywatnie `chk/final/01-DEV-azolle-7.jpg`.

## 4. Regresja 80 przebiegów (1333 → v3.53.8, kod końcowy)

| Zbiór | domy | identyczne | zmienione | odmowy w obu | zmiana wyniku | dopasowanie ↑ / = / ↓ | błędy ↓ |
|---|---|---|---|---|---|---|---|
| korpus | 33 | 24 | 5 | 4 | 0 | 1 / 4 / 0 | 0 |
| niezależne | 4 | 3 | 1 | 0 | 0 | 0 / 1 / 0 | 0 |
| niezależne 2 | 5 | 3 | 1 | 1 | 0 | 0 / 1 / 0 | 0 |
| świeże 3.53.4 | 10 | 4 | 2 | 4 | 0 | 0 / 2 / 0 | 0 |
| zewnętrzne | 8 | 6 | 0 | 2 | 0 | — | 0 |
| próba 3.53.5 | 20 | 8 | 5 | 7 | 0 | 1 / 4 / 0 | 1 |
| **razem** | **80** | **48** | **14** | **18** | **0** | **2 / 12 / 0** | **1** |

* Modele pełne / częściowe / odmowy: 62 modele i 18 odmów przed i po. Wśród 62: przed v3.53.8 częściowość nie była
  jawna w wyniku; po — ilości USABLE_IN_SCOPE 36, LIMITED 25, NOT_USABLE 1 (§8).
* Odmowy z niedoborem: 18 → 18 (żadna nie odzyskana, żadna nowa).
* Odzyskane fragmenty: Azolle (kuchnia, wiatrołap, kotłownia, garaż we właściwym miejscu). Utracone: brak.
* Błędne dodatki: brak (żadna strefa otwarta nie dostała podłogi ani ściany zewnętrznej; przedpole Azolli i wnęki
  świeżych domów bez zmian).
* Błędy kompilacji: 33 → 30 (Azolle 4 → 1); `WALL_NOT_UNDER_ROOF`: **8 → 1** (zostaje Pod Miłorzębem — ściana
  pierścienia na kontakcie z bryłą, nie ścianka; inna przyczyna, jak w 1333).
* Czas powtórki: mediana 25 → 24 s, maksimum 67 → 59 s (powtórka solvera na zapieczętowanej ekstrakcji).

**Każdy zmieniony przypadek wobec źródła:**

| Dom | Co się zmieniło | Ocena na arkuszu |
|---|---|---|
| Azolle 7 (DEV) | §3 | poprawa |
| Zefiranty | dwie ściany zewnętrzne w środku poddasza (między wykuszem 7/8 a pokojem 6) → kontakt OPEN, ścianki z odczytu | poprawa, dopasowanie 8 → 9/18 |
| Bratki 26, Dzwonki 3, Wasabi | ścianki nad stropodachem dobudówki cięte na licu (2,4 / 3,575 / 3,53 m) | poprawa, ostrzeżenia 1/2/1 → 0 |
| Bakopy | ścianka w garażu: wysokość spodu płyty zamiast „do dachu” 6,43 m | poprawa, ostrzeżenie 1 → 0 |
| Bakopy 5 | dwie ścianki z bryły głównej w skrzydło pod własnym dachem połaciowym, cięte na licu | poprawa, ostrzeżenia 2 → 0 |
| Renklody 39, Chelone, Pod Miłorzębem, Telimach, Mennice 2 | ścianka w całości w dobudówce: wysokość spodu płyty zamiast FOLLOW_ROOF (Telimach: dodatkowo jeden bieg cięty na licu) | **geometria identyczna**: górne krawędzie wszystkich ścianek po kompilacji równe przed i po (np. 2,520 / 3,142 m) |
| Przebiśniegi 27, Macierzanki 4 | końcówki biegów 0,13–0,20 m w skrzydle biorą dach skrzydła; drzwi `main-idoor-0-9` w Przebiśniegach przesunięte o 7,5 cm z pełną szerokością 0,97 m (1333 przycinało do 0,89) | zgodne |

**Znaleziony i usunięty u przyczyny błąd kandydata:** pierwsza wersja reguły szwu otworzyła w Bakopach kontakt
garaż–dom; prawdziwa ściana stoi 0,8 m za szwem (szew to lico szaf w garażu), więc garaż zlał się z pomieszczeniem 13
w jedno 37,9 m². Strażnik okładziny przywrócił model 1333. Pierwsza wersja reguły drzwi zamykała wylot wnęki między
dwoma zawrotami (test `compound-facade` 18; w Mennicach 2 zamieniało to garaż z doklejonym paskiem w jedną bryłę i inne otwory tylne) — warunek (c); Mennice 2 mają znów bryły 1333.

**Kontrpróby:** wnęka wejściowa (Azolle — przedpole bez podłogi; świeże: batawii, kalandryniach, sadzcach — bez
zmian), wiata/podjazd (garaże Azolli i Nigelli — bez podłogi), taras narożny (Ciesz — identyczny), domy z nadmiarem
(Berberysy 4, Tymotki 2 — odmowy jak w 1333), poprawne Wasabi, Kanzany, Pomarańcza — identyczne poza ścianką Wasabi.
Testy podglądu częściowego i cienkich brył — w macierzy (§9).

## 5. Ścianki nad dachem dobudówki — 1333 → v3.53.8

Śledzenie przydziału: po podziale bryły bieg ścianki ma jedną wysokość i jeden profil od środka biegu, więc odcinek
nad niższym dachem dobudówki dziedziczy dach główny (FOLLOW_ROOF_PLANES poza zasięgiem połaci → wysokość nominalna
→ `WALL_NOT_UNDER_ROOF`, szpikulce w scenie). Teraz każdy kawałek ma wysokość i profil od bryły, kondygnacji i dachu,
pod którym stoi. Sprawdzone przypadki: ściana pod dachem spadzistym (krzyżowym i osobnym połaciowym), ściana pod dwiema
wysokościami (dom piętrowy i parterowe skrzydło), drzwi w miejscu cięcia (Bratki: położenie i szerokość bez zmian;
Dzwonki: `main-idoor-0-2` przesunięte o 0,19 m do kawałka, w którym leży, szerokość zachowana). Plansze przed/po
(rzut, bryły, sceny): `chk/final/02–04`.

## 6. Świeże projekty (zamrożone przed oceną)

Reguła wyboru: lista parterowych pc1073, strony 7–9, rodziny nieużyte wcześniej, pierwsze 10 w kolejności strony.
Pakiety pozyskane raz kodem 1333 (pierwszy wynik zachowany), oczekiwania z rzutów zapieczętowane przed wynikami.
Wszystkie z jednego wydawcy i formatu (rzut rastrowy ARCHON) — innego wydawcy w tej próbie nie było.

| Dom | 1333 → v3.53.8 | Pokrycie | Skala | Ilości | Oczekiwanie z rzutu |
|---|---|---|---|---|---|
| żywokostach | identyczny | MATCHES 113,49/113,91 | UNVERIFIED | LIMITED | spełnione (prostokąt, taras otwarty) |
| batawii-2-e | identyczny | MATCHES 109,67/111,13 | MEASURED | USABLE_IN_SCOPE | wnęka 2,68 × 0,60 — bryła prostokątna; wnęka niewycięta w obrysie |
| sadzcach-2-e | **zmieniony**: dwie bryły-paski przez jadalnię (z dwiema ścianami) → kontakt OPEN | MATCHES 147,36/156,41 | MEASURED | USABLE_IN_SCOPE | poprawa na arkuszu; dopasowanie 6 → 5 to przypadek (pasek 2,60 m² pasował do pokoju 2,72) |
| przegorzanach | identyczny | MATCHES | MEASURED | USABLE_IN_SCOPE | **taras narożny NW zamknięty pierścieniem** (jak 1333) |
| mekintoszach-9-g | odmowa w obu | — | — | — | METRIC_RESOLUTION_INCONCLUSIVE (skala), inna przyczyna |
| kalandryniach-e | identyczny | NEAR 153,08/166,62 | UNVERIFIED | LIMITED | wnęka 4,29 × 0,70 otwarta |
| salwiniach-3-e | identyczny | MATCHES | MEASURED | LIMITED (częściowy) | naroże SE tylko częściowo otwarte (0,63 z 1,79 m) |
| tiliach-2-e | identyczny | MATCHES | MEASURED | LIMITED (częściowy) | **naroże SE zamknięte pierścieniem** (jak 1333) |
| gaurach-5 | identyczny | MATCHES | MEASURED | USABLE_IN_SCOPE | portyk otwarty |
| kocimietkach | identyczny | MATCHES | MEASURED | USABLE_IN_SCOPE | **naroża NW i SW zamknięte pierścieniem** (jak 1333) |

Mechanizm Azolli nie wystąpił w żadnym ze świeżych domów (drzwi wejściowe w nich mają ościeża czytane jako pasy).
Żaden świeży dom nie odzyskał więc wnętrza tą zmianą — dowodem odzysku pozostaje Azolle (DEV). Strefy otwarte nie
zostały zamknięte przez tę zmianę; trzy domy mają strefę narożną zamkniętą już w 1333 (§11). Pomiar wyniku nie widzi
tego błędu: wydawca liczy zadaszone naroże do powierzchni zabudowy, więc pokrycie wychodzi MATCHES.

## 7. Tabela zamrożona pokoi (169 wierszy, punkty wskazane ręcznie na arkuszach)

| | OK | OPEN_OK | AREA_OFF | MERGED | MISSING | OK + OPEN_OK |
|---|---|---|---|---|---|---|
| 1333 | 72 | 15 | 15 | 48 | 19 | **87** |
| v3.53.8 | 75 | 12 | 14 | 53 | 15 | **87** |

Cała zmiana to Azolle (14 wierszy). Po korekcie punktu łazienki Pomarańczy (wiersz uznany w 3.53.7 za artefakt punktu):
88 przed i 88 po. Liczba 87/169 się nie zmienia, bo trzy wiersze strefy dziennej przechodzą z OPEN_OK do MERGED
(nieodczytana ścianka spiżarni), a trzy odzyskane pokoje dochodzą jako OK.

## 8. Pomiar w wyniku

62 modele końcowe: pokrycie MATCHES 53, NEAR 8, SHORT 1 (Nigelle 4: 175,4 z 255,91 m², 69 %); skala MEASURED 45,
UNVERIFIED 15, DEPARTS 1 (Torenie 3: model w 3,9815 cm/px, wymiary drukowane 3,1282 cm/px → długości +27 %, pola
+62 %, ilości NOT_USABLE), NOT_ASSESSED 1; ilości USABLE_IN_SCOPE 36, LIMITED 25, NOT_USABLE 1. Przebieg we wszystkich
62 pozostaje COMPLETED. „USABLE_IN_SCOPE” znaczy tylko: skala zmierzona i pokrycie zgodne — nie, że każdy pokój, otwór
i dach jest poprawny (§6: zamknięte naroża). Serializacja: kontrakt Androida odtworzony z bajtów serwera
(`analyzer-contract-current`, różnica wobec 1333 tylko w wersjach, skrócie kandydata i nowym polu), test JVM i test
kontraktu TS sprawdzają pole; JSON w obie strony bez zmian (test jednostkowy).

## 9. Testy, typy, kontrakt

* Typy: `npx tsc --noEmit -p tsconfig.json` — czysto na każdym commicie etapu.
* Macierz pakietów dotkniętych zmianą (`packages/reconstruction`, `packages/analysis-service`, `apps/local-analyzer`
  z Node 18.20.4, `apps/analyzer-api`, `tests/architecture`) na kodzie końcowym: **2348 testów, 2335 zielonych,
  13 czerwonych — dokładnie 13 znanych z bazy** (lista z 3.53.5: program Larchfield, NFD bez ICU, M10, reference 4 i 7,
  research-isolation ×4, wall-strip 005Q ×4), żadnego nowego. W pierwszym przebiegu macierzy (pod obciążeniem
  regresji) dwa testy wątków `analyzer-api/worker` przekroczyły czas — w izolacji zielone.
* Nowe testy: reguła drzwi z kontrpróbami (bez opisu, zły opis, słupki ganku wolne i w linii ściany, wylot między
  dwoma zawrotami, opis bliżej linii poprzecznej, dziura szersza niż nadproże), udział szwu i strażnik okładziny,
  kontakt technicznego szwu (OPEN, pod jednym dachem bez zmian, brak powodu, ściana narysowana), ścianka pod
  stropodachem, pod własnym dachem krzyżowym, pod osobnym dachem połaciowym, w domu piętrowym przy parterowym skrzydle,
  drzwi zachowane, bieg w całości w bryle głównej jak dotąd, samo ostrzeżenie `WALL_NOT_UNDER_ROOF` nadal działa;
  rekord pomiaru (wszystkie statusy, progi, JSON w obie strony, powód częściowości). Test kontraktu TS i JVM sprawdza
  pole `measurement`.
* Android JVM (`testDebugUnitTest`): 459 testów, 453 zielone, 2 pominięte, **4 czerwone — te same co w 3.53.2**
  (`AutoCandidateRenderingTest` ×2, `DownloadedScenesTest` ×2: dwie sceny 005T w `assets/scenes`, pliki i testy
  niezmienione od N8-03D2). Test kontraktu bieżącego oczekiwał wersji usługi 1.5.0 migawki sprzed wielu etapów —
  migawka odtworzona z bajtów serwera, oczekiwanie 1.11.0.
* Naprawiony u przyczyny test `/health` (literał 2.5.0 → `SOLVER_V2_VERSION`; czerwony już na 1333).

## 10. APK 1334 i przebieg z paczki

* Zbudowany z czystego drzewa `f4a4221` (`./gradlew --offline -PpreviewVersionCode=1334 previewApks`), ten sam podpis.
* `BuildPlan-Model-Preview-1334-arm64-v8a-debug.apk`: 50 703 032 B, SHA-256
  `0a40618233160742b8b61380c1de8e14d918b6daa630769080bc1fb9a6f3c3aa`; `aapt`: `com.buildplan.preview`, versionCode
  1334, versionName `0.1334.0-owner`, minSdk 26, targetSdk 35; `apksigner`: certyfikat SHA-256 `6e48fac4…ca0da` —
  równy 1333.
* Paczka analizatora z APK: manifest 12/12 plików zgodnych ze skrótami, w niej solver 2.39.0 i usługa 1.11.0.
* **Host z paczki** — produkcyjny `main.mjs` z APK, Node 18.20.4 z symulacją braku ICU, żywe strony wydawcy:

| Strona | wynik | czas | szczyt RSS | model hosta = powtórka | scena zapisana i wczytana |
|---|---|---|---|---|---|
| Azolle 7 (zmiana obrysu) | hello → COMPLETED, pomiar MATCHES/MEASURED/LIMITED (READING_PARTIAL) | 400 s | 909 MB | `475cf459d1e6` = `475cf459d1e6` | tak (`loadBundle`, 130 siatek) |
| Dzwonki 3 (ścianki) | hello → COMPLETED, pomiar MATCHES/MEASURED/USABLE_IN_SCOPE, bez `WALL_NOT_UNDER_ROOF` | 384 s | 943 MB | `5963146e1c64` = `5963146e1c64` | tak (130 siatek) |

* Urządzenie / emulator: brak (`/dev/kvm` niedostępne) — interfejs Androida i przebieg LOCAL na telefonie
  **NOT_VERIFIED**. Wyniki hosta i aplikacji podane osobno: aplikacja nie była uruchomiona.
* APK i plansze dowodowe przekazane prywatnie (poza Gitem).

## 11. Największa pozostała rozbieżność

Odmowy i niedobór obrysu tam, gdzie obwiednia ścian kończy się przed domem: 18 z 80 przebiegów nie daje modelu,
w tym 8 z 9 odmów DEV z polecenia (Malwina, Ofelia 2, Jaskrzyny, Stellarie, Layla 2, Renklody 15, Lulo 3, Skalnice 3).
Wspólny mianownik: część domu za szerokim wylotem (przeszklenie 5,7–7,9 m, brama 5,1 m, okno szersze niż nadproże)
albo za licem, na którym kończy się zasięg. Druga co do wagi: **strefa zadaszona w narożniku zamknięta pierścieniem
ścian zewnętrznych** (świeże: tiliach, kocimietkach ×2, przegorzanach; bez zmian od 1333). Trzecia: Nigelle 4
(69 % zabudowy) i Torenie 3 (skala +27 %) — zasięg i arbitraż skali, osobna przyczyna wskazana w poleceniu; tu jedynie
nazwane w wyniku (`COVERAGE_SHORT`, `SCALE_DEPARTS`), bez dopasowywania do powierzchni wydawcy.

Dowody prywatne (poza Gitem): `/home/user/rd/v3538` — protokół, oczekiwania świeżych domów z pieczęcią, przebiegi
`reg-h` (80) i `fresh/rep-h` (10), tabele `trial-h.txt`, `reg-h-vs-r6.txt`, plansze `chk/final/*`.
