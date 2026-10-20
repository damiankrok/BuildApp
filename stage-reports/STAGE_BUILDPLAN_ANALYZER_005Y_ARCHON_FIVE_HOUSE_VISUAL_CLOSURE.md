# BUILDPLAN-ANALYZER-005Y — pięć domów ARCHON: rzeczywiste modele 3D i rendery do decyzji OWNER-a

Data: 2026-10-20. Repo `damiankrok/BuildApp`, gałąź `analyzer/005y-archon-five-house-visual-closure-v1`, utworzona z
bazy `a6dc724d2ea864a3cc7bab76f0e97ec06635ca54`, bez dryfu.

**Werdykt: OWNER_VISUAL_PENDING.** Techniczna zieleń nie oznacza, że model jest domem OWNER-a. OWNER_ACCEPTED nie jest
deklarowany. W tej rundzie nie powstał APK, nie uruchomiono emulatora ani 41-jobowego CI.

## 0. Start i granice

| element | stan |
|---|---|
| baza | `a6dc724` (005X-N3) |
| mirror `claude/new-session-3kzcgh` | `bfaf286e95105c2cdb32df2d298d3cd93bd43449`, nietknięty |
| domyślny branch zdalny, APK, releases | nietknięte |
| odłożone (DEFERRED, kod nieusunięty) | ścieżka `Photo…` i zdjęcia uliczne, segmentacja, TeA/inni dostawcy, nowe BLIND, strojenie OCR pod szybkość |
| znany fail | śledzony APK 39 556 682 B > 32 MB: **KNOWN_BASELINE_FAIL**; bramka nie była podnoszona |

## 1. Pięć wierszy: źródło → pipeline → model → kompilacja → viewer → screen

**Pipeline.** Każdy dom przeszedł pełną ścieżkę produkcyjną, tak jak na telefonie i w usłudze:

- `second-house.ts --package <zapieczętowany SourcePackage> --cache <cache bajtów> --recogniser`, `OFFLINE=1`;
- etapy: SourcePackage → graf obserwacji (odczyt rysunków) → dowody metryczne (OCR i rozpoznawacz ORT PaddleOCR w workerze)
  → `reconstructV2` → model → kompilacja sceny → weryfikacja (replay bajt w bajt, złącza);
- tożsamość modelu pochodzi z pakietu.

Nie odtwarzano zapisanego modelu, nie było ręcznej bryły ani parametrów.

**Viewer.** Rendery robi `apps/web` (BuildWorld, Three.js) przez `vite preview` w Chromium/SwiftShader. Viewer wczytuje
`model.json`. Każdy dom ma 8 presetów: przód, tył, lewa, prawa, ¾ przód-prawo, ¾ tył-lewo (nowy preset
`perspective-rear`), z góry z dachem, z góry bez dachu.

| dom | źródło (pakiet, zasoby) | model PRZED (a6dc724) | model PO (3c51686) | czas biegu przed/po | max cisza heartbeat przed/po | viewer | screeny |
|---|---|---|---|---|---|---|---|
| Jarzmianki A01 (m60124f28f071a) | `019e70a1…`, 21 zasobów | 1661d4bf | **40ccaaae** | 310 / 306 s | 7 903 / 2 584 ms | geometry ok | 8+8 |
| Goździkowce 3 (m79923e950094d) | `37be1543…`, 30 | 911456a8 | **1856a617** | 288 / 293 s | 4 399 / 1 621 ms | geometry ok | 8+8 |
| Marcówki (m2fa281446a8ca) | `75370990…`, 20 | cf797743 | cf797743 | 268 / 266 s | 4 878 / 2 279 ms | geometry ok | 8+8 |
| Cieszynianki (m43d25c0636969) | `63034b63…`, 30 | e4e56292 | **9478c6d1** | 189 / 187 s | 5 732 / 2 624 ms | geometry ok | 8+8 |
| Rarytasy DEV G2E (m84f2903cb8e14) | `02963768…`, 37 | 9f5fd342 | 9f5fd342 | 238 / 238 s | 6 459 / 1 490 ms | geometry ok | 8+8 |
| Rarytasy OWNER m3ea28300f9b3e | `109b6463…`, 30 (z cache korpusu 005R) | b7501212 | b7501212 | 207 / 209 s | — | **5 błędów, 5 ostrzeżeń** | 8 |

Czasy dotyczą 2–3 biegów równoległych na 4 rdzeniach, więc nie są benchmarkiem. Pomiar ciszy to `maxTickGapMs`
z `performance.json`, zebrany przy `TELEMETRY=1`.

**Rarytasy OWNER m3ea.** Zapieczętowane wejście OWNER-a nie zostało udostępnione. W środowisku znalazł się jednak crawl
z 005R (`work005r/corpus`, strona i rysunki z 2026-10-15). Z tego cache pełna ścieżka offline zbudowała model. Zasady
tej pozycji:

- jest osobną pozycją i nie zastępuje DEV G2E;
- nie jest modelem zweryfikowanym przez OWNER-a;
- viewer zgłasza 5 błędów geometrii;
- od ogrodu model ma 1 otwór, a źródło około 5 przeszkleń.

**Odtwarzalność.**

- Na bazie pełna ścieżka dała modele 005X-N3 bajt w bajt.
- Na HEAD pełna ścieżka i replay solvera na zapieczętowanych obserwacjach dały ten sam model dla wszystkich pięciu domów.
- Bieg na HEAD bez rozpoznawacza ORT, czyli zwykłe `reconstruct-v2 --package`, daje inne modele, bo metryka ma wtedy
  schemat 1.7.0 zamiast 1.8.0. Dlatego miarodajna jest wyłącznie ścieżka z rozpoznawaczem.

## 2. VISUAL_LEDGER (z widoków, nie z oczekiwanej liczby testu)

Liczby pochodzą z `model.json` (`research/analyzer-005y-archon-visual/ledger.json`, sekcje `before` i `after`).
Oceny pochodzą z porównania renderów z elewacjami i przekrojem źródła; obrazy źródła są poza repo.

| dom | bryła / wymiary | dach | otwory | okna połaciowe | kominy | największe różnice widoczne na renderach |
|---|---|---|---|---|---|---|
| A01 | 10,50 × 8,008 m, parter + poddasze; poziom 1 na 2,80 m (przekrój: +3,06) | 40°, kalenica 8,16 (wydrukowana), **okap 0,91 m (nowe)** | front 3 okna + drzwi; tył okno + drzwi przeszklone; szczyty po 2 wysokie okna + parter | 6/7 (front 2, tył 4) | 3 | **PO:** linia okapu z przodu na wysokości ze źródła (+3,6), dach z nawisem. **Brak:** 7. okno połaciowe (front-lewo); głębokość 8,008 zamiast 8,30; jeden kolor ścian (źródło: szary parter i białe piętro); pergola; cokół drzwi. |
| Goździkowce | 13,82 × 9,50 m, parter + poddasze | 40°, kalenica ~7,94 (z kolanka, ASSUMED; wydruk +8,36 nieodczytany), **okap 0,90 m (nowe)** | front 2 okna + brama 3,22 m; tył 2 okna + 2 drzwi; boki | **0/7** | 1 | **PO:** okapy. **Brak:** okna połaciowe (3 front + 4 tył); typy otworów od ogrodu (300/230 i 180/230 to drzwi tarasowe, model ma okna); wysokości umowne (żaden callout nie został odczytany); kolor i pasy elewacji. |
| Marcówki | 7,90 × 12,61 m + garaż 4,15 × 7,51 m, płaski dach garażu | 40°, kalenica 7,95, bez okapu (zgodnie z przekrojem) | szkło szczytowe i balkon z balustradą, brama | 3 | 2 | Bez zmian. **Brak:** drzwi balkonowe w trójkątnym przeszkleniu mają drewniane skrzydło (w źródle przeszklone); okładzina drewniana frontu. |
| Cieszynianki | 11,70 × 15,80 m, parterowy | **PO: kopertowy 30°, okap 0,90 m** (przed: dwuspadowy, szczyty front i tył) | front okno, drzwi, okno; boki 2–5 otworów | 0 | **0** (źródło: 2) | **PO:** bryła rozpoznawalna (kopertowy bungalow). **Brak:** brama garażowa we froncie (model ma okno); 2 kominy; podcienia wejścia i tarasu; konfiguracja okien bocznych. |
| Rarytasy DEV | 17,21 × 8,50 m + skrzydło garażu 6,17 × 6,20 m z dachem szczytowym | 30°, kalenica 5,70 | front drzwi, 2 okna, brama; tył 2 okna + 2 drzwi przeszklone | 0 | 1 | Bez zmian. **Brak:** od ogrodu 4 duże przeszklenia (model 4 mniejsze otwory); okładzina drewniana. |

## 3. Zmiany (ogólne, bez nazw, identyfikatorów ani liczb konkretnego domu w kodzie produkcyjnym)

1. **Okap z przekroju** (`roof-details.ts: readEavesOverhang`):
   - Ściany zewnętrzne są wybierane jako najszersza para długich, grubych pasów, nad którą obie linie połaci (głosowanie
     przy podanym kącie, potem LSQ) rysują ten kąt w granicach 4° i spotykają się nad środkiem pary.
   - Skala przekroju pochodzi z dopasowania tej pary do rozpiętości w poprzek kalenicy. Nie jest potrzebna rejestracja
     rzędnych.
   - Od lica każdej ściany czytnik idzie wzdłuż linii połaci, dopóki jest na niej tusz.
   - Odczyt powstaje tylko wtedy, gdy oba okapy mają 0,12–1,5 m i różnią się o najwyżej 0,3 m. Przyjmowany jest mniejszy.
   - Wydrukowana rzędna przy krawędzi okapu (±0,15 m) daje `SOURCE_CORROBORATED` (A01: krawędź okapu 3,53 m przy wydruku
     +3,60). Bez niej odczyt ma status `IMAGE_METRIC_REGISTERED`.
   - Nawis na szczytach jest `ASSUMED_FOR_RENDERING`.
   - Wynik trafia do `MainRoofV2.eaves`, a emiter ustawia go jako `overhang`. Wcześniej `overhang: 0` było wpisane
     na sztywno.
   - Odczyty: A01 0,91 m, Goździkowce 0,90 m, Cieszynianki 0,90 m. Marcówki i Rarytasy nie mają odczytu: przekrój rysuje
     tam okap przy licu albo dach asymetryczny.
2. **Dach kopertowy w ścieżce v2** (`reconstruct-v2.ts`). Solver v2 budował dotąd zawsze dwuspad, także wtedy, gdy layout
   miał `kind: HIP` z opisu strony („czterospadowy”). Nowe zasady:
   - Końce kalenicy są czytane z elewacji okapowych. W odległości d od ściany szczytowej zarys połaci kopertowej leży na
     wysokości okap + d·tg α, niezależnie od nawisu; zarys szczytu leży na kalenicy. Hip wymaga dwóch warunków: wzrostu
     zarysu przy kącie ±15% i odchyłki ±15%.
   - Głosują tylko widoki o błędzie terenu ≤ 0,3 m.
   - Dach opisany jako czterospadowy jest kopertowy, chyba że wiarygodna elewacja pokazuje szczyt.
   - Konwersja na `planeRoofs` (warstwa z 005X-N1) z nawisem następuje tylko wtedy, gdy nic nie wiąże się z dachem jako
     dwuspadem: kominy, okna połaciowe, deski wiatrowe, dachy przyłączone. W przeciwnym razie dwuspad zostaje, a luka
     jest nazwana.
   - Ścianki działowe najwyższej kondygnacji pod dachem z płaszczyzn dostają `FOLLOW_ROOF_PLANES`. Pierwsza wersja
     przebijała połacie.
   - Głos widoku „szczyt” przy podanym kącie wymaga ≥ 75% pełnego trójkąta, bo trapez boku dachu kopertowego głosował
     jak szczyt i obracał kalenicę. Reguła dotyczy tylko kąta podanego: kąt zmierzony jest przeliczany przy obrocie osi,
     co ujawniły fixture'y Dunmore, Kelsall i Lindale.
3. **Elastyczna rejestracja elewacji (sekcja C).** Rejestracja dostaje dodatkowe rozpiętości „ściany + 2 × okap
   z przekroju”, przyjmowane tylko przy błędzie terenu ≤ 0,3 m. Głosowanie o strefach odejmuje okap. Wynik i ograniczenia
   są w §4.
4. **Liveness** (§5).
5. **Viewer:** drugi preset ¾ `perspective-rear`, zgodnie z wymaganiem „oba ujęcia ¾”.

**Zmienione hashe.** Trzy domy zmieniły model, każdy z powodem, źródłem i obrazem przed/po w ZIP:

| dom | przed → po | powód | źródło |
|---|---|---|---|
| A01 | 1661d4bf → 40ccaaae | okap | przekrój, wydruk +3,60 |
| Goździkowce | 911456a8 → 1856a617 | okap | przekrój |
| Cieszynianki | e4e56292 → 9478c6d1 | kopertowy + okap | opis „czterospadowy”, przekrój |

Marcówki i Rarytasy pozostały bajt w bajt.

## 4. Skale elewacji (rejestracja) i ELASTYCZNA REJESTRACJA

Rejestracje są identyczne przed i po (`final/reg-before`, `final/reg-after` poza repo; liczby w ledger.json).

| dom | widok | m/px | rozpiętość | dopasowana do | błąd terenu |
|---|---|---|---|---|---|
| A01 | bok (RIGHT po orientacji) | 0,016179 | 8,30 m | głębokość charakterystyczna | 0,71 m |
| A01 | front / tył | 0,017045 / 0,017018 | 10,50 m | pas ścian, tylko otwory | −0,26 / −0,30 m |
| A01 | przekrój | 0,01395 (czytnik okapu: 0,0140) | 8,01 m | — | — |
| Marcówki | REAR / FRONT / LEFT / RIGHT | 0,016806 / 0,016853 / 0,016555 / 0,016783 | 12,05 / 12,05 / 14,60 / 14,60 m | — | 0,15 / 0,22 / 0,05 / 0,26 m |
| Marcówki | przekrój | 0,01379 | — | — | — |
| Cieszynianki | front | **0,037261** | 11,70 m | pas ścian | — |
| Cieszynianki | lewa | 0,016272 | 15,80 m | pas ścian | — |
| Cieszynianki | przekrój | brak rejestracji SECTION_HY (czytnik okapu: 0,0147) | — | — | — |
| Rarytasy | FRONT / REAR | 0,016596 / 0,016725 | 17,21 m | — | 0,05 / 0,08 m |
| Rarytasy | RIGHT / LEFT | 0,015589 / 0,016370 | 14,70 m | — | 0,78 / 0,52 m |
| Goździkowce | — | żadna elewacja nie jest zarejestrowana | — | — | — |

Cieszynianki: skala frontu 0,0373 m/px jest ponad dwa razy większa niż lewej elewacji. To podejrzana rejestracja pasa,
**nienaprawiona**.

Goździkowce: rzędna kalenicy +8,36 nie została odczytana (OCR dał 2,46 przy pewności 0,21), a bez niej rejestracja
sylwetką nie startuje. Czytnik okapu działał na własnej skali przekroju: 0,0158 m/px.

**Wynik sekcji C.** Kandydaci z okapem wygrali w Cieszyniankach LEFT i RIGHT z błędem terenu 0,47 i 0,81 m. Stara
tolerancja 0,9 m by ich przepuściła. Sylwetkę poszerza drzewo, a nowe odczyty boków zasilałyby otwory. Dlatego bramka
dla nowej rozpiętości wynosi 0,3 m. **W finale żadna rejestracja nie użyła okapu** i transformacje są bez zmian.

Nie wprowadzono osobnych skal pionowych i poziomych ani korekt skali per arkusz: żadna rejestracja nie miała kilku
niezależnych kotwic, które by to uzasadniały. Perspektywiczne wizualizacje nie były używane do skali.

## 5. Liveness (D)

**Audyt** (Explore + pomiar `telemetry.ndjson`). Najdłuższa cisza była w SOLVE_METRICS: 4,4–7,9 s na desktopie, przy
telefonie 4–6× wolniejszym 18–47 s, czyli na granicy 45 s NoResponse. Źródła ciszy:

- `readTintedCallouts` (szukanie pierścieni i odczyt) nie miał checkpointu;
- szczegóły dachu i kompilacja/weryfikacja sceny nie tykały.

**Poprawka:**

- `TintedCalloutOptions.checkpoint`, tick na wiersz wyszukiwania (prefiltr i siatka zgrubna) i na odczytane miejsce;
  nowe podfazy `TINTED_CALLOUT_SEARCH` i `TINTED_CALLOUT_RINGS`;
- tick przed czytnikami dachu;
- ticki między pakowaniem sceny, replayem, round-tripem i audytem złącz.

Wszystkie ticki są write-only: odczyty są identyczne z checkpointem i bez niego (test), a modele są bajt w bajt
takie same. **Po zmianie najdłuższa cisza wynosi 1,5–2,6 s.**

**Brak twardego limitu czasu.** Niczego nie dodano. Istniejące limity (job API 15 min, watchdog ORT) są opisane
w audycie, nie zmieniane.

**Testy:**

- `analysis-service/test/liveness-long-005y.test.ts`:
  - 12 minut zdrowej pracy, heartbeat ≤ 1,5 s, nic nie zatrzymuje biegu;
  - 50 s w jednym kroku daje ciszę ≥ 45 s nazwaną w rekordzie, bez stopu;
  - anulowanie po 16 minutach ląduje na najbliższej granicy pętli.
- `reconstruction/test/eaves-hip-liveness-005y.test.ts`: ticki w czytniku i identyczność odczytów.
- Kotlin `LivenessTrackerTest`: 12-minutowy ciężki krok z heartbeatem jest przez cały czas HeavyStep, nigdy
  NoResponse. Uruchomiono `gradlew --offline :app:testDebugUnitTest --tests LivenessTrackerTest`: 11/11. APK nie był
  budowany.

UI Androida już rozróżnia przypadki: HeavyStep („Nadal analizuję — ten krok jest obliczeniowo ciężki”), NoResponse z
opcją anulowania, Waiting (I/O), proces zabity (RUNTIME_STOPPED/EXITED). Tekst nie został zmieniony.
**ANDROID_LIVENESS_NOT_DEVICE_VERIFIED.**

## 6. Testy i bramki

| bramka | wynik |
|---|---|
| `tsc -p tsconfig.json`, `tsc -p apps/web/tsconfig.json` | czysto |
| vitest `packages/reconstruction`, `source-metrics`, `analysis-service`, `editor`, `geometry`, `apps/web` | **100 plików, 1380/1380** |
| `fixtures-v2` (15 fixture'ów §25) | 15/15. Po pierwszej wersji 3 padały (Dunmore, Kelsall, Lindale); przyczyny w §3.2 naprawione |
| nowe testy 005Y | 5 (okap: odczyt, okapy nierówne i rozbieżne, brak nawisu, zły kąt, pergola) + 1 (ticki) + 3 (długi bieg) + 1 Kotlin |
| replay i pełna ścieżka 5 domów | po każdej zmianie wspólnej; finał 5/5 zgodne |
| 41-job CI, APK, emulator | nie uruchamiane, zgodnie z briefem |
| śledzony APK > 32 MB | KNOWN_BASELINE_FAIL, nietknięty |

## 7. Próby odrzucone, regresje, cofnięcia

- **Okap, wersja 1:** absolutne rzędne przez `registerSection`. Rejestracja istniała tylko w 2 z 5 domów, a A01 dawał
  zero odczytów. Zastąpiona skalą własną przekroju.
- **Okap, wersja 2:** Theil–Sen i ściany z progu 0,6 najdłuższego przebiegu. Ściana z oknami była pomijana, a okna
  połaciowe i napisy psuły dopasowanie. Zastąpiona głosowaniem przy podanym kącie i doborem pary ścian.
- **Okap, wersja 3:** brany był najwyższy tusz w oknie, więc belka pergoli tuż nad okapem ucinała odczyt (test). Teraz
  liczy się dowolny tusz w paśmie linii.
- **Rejestracja z okapem bez progu:** boki Cieszynianek przy 0,47 i 0,81 m. **Cofnięte progiem 0,3 m.**
- **Klasyfikacja końców dachu bez warunku wzrostu:** fałszywy hip na fixture'ach. **Zaostrzone.**
- **Próg „pełnego trójkąta” dla kąta zmierzonego:** obrócił kalenice fixture'ów. **Ograniczony do kąta podanego.**
- **Pierwsza wersja dachu kopertowego:** ścianki działowe przebijały połacie. **Naprawione.**

## 8. Uczciwa lista nierozpoznanych detali (FIRST_BAD tam, gdzie znany)

1. **A01, głębokość 8,008 vs 830.** Pas tylnej ściany (y 149–163,5 px na rzucie 853) jest klasyfikowany jako strefa
   poza ścianami (`zone-min_z`), a nie jako ściana ani `wallStrip`. Bryła zaczyna się na licu wewnętrznym (394 px zamiast
   408). Poprawka leży w dekompozycji rzutu (`layout.ts` / plan decomposition) i niesie duże ryzyko regresji; **odłożona**.
2. **A01, 7. okno połaciowe:** pierścień calloutu przód-lewo na rysunku łóżka nie jest wykrywany. W rzucie poddasza
   jest 7 calloutów „78/118”, odczytanych 6.
3. **Goździkowce, wszystkie callouty.** Szablonowy OCR czyta 0 z 10 calloutów parteru i 0 z 7 „78/140” poprawnie
   (211/274/271/210). Bramki słusznie odrzucają, więc model nie ma okien połaciowych, a otwory parteru mają typy
   i wysokości umowne. Rzędna kalenicy +8,36 też nie została odczytana.
4. **Cieszynianki:**
   - brak bramy garażowej (opis: „jednostanowiskowy garaż wpisany w bryłę”);
   - 0 kominów (źródło: 2);
   - podcienie nie są zbudowane;
   - podejrzana rejestracja pasa frontu (0,037 m/px).
5. **Marcówki:** drzwi balkonowe w trójkątnym przeszkleniu szczytu mają drewniane skrzydło.
6. **Rarytasy DEV:** od ogrodu duże przeszklenia są czytane jako mniejsze otwory.
7. **Kolory i pasy elewacji** (np. szary parter / białe piętro A01, drewno): niezmienione, poza zakresem tej rundy.
8. **Pergole i tarasy:** niemodelowane, brak podstaw do położenia.

## 9. Badanie: PaddleOCR na calloutach (research, niewpięte)

Skrypt: `research/analyzer-005y-archon-visual/callout-paddle-probe.ts`. Wyniki są poza repo.

| miara | szablon | Paddle |
|---|---|---|
| obie połówki dokładnie (142 sprawdzone pierścienie) | 63 | **104** |
| Goździkowce | 7/46 | 37/46 |
| „78/140” | 0/14 | 14/14 |
| pewne odczyty Paddle (obie połówki) | — | **71/71 poprawnych** |
| pewne podwójne odczyty na 197 pierścieniach niebędących calloutami | — | 0 |
| kompletne, ale błędne odczyty | 38 z 86 | — |

Cztery pewne, ale błędne połówki Paddle gubią wiodącą cyfrę (105→5, 118→18, 230→30). Wymóg pewności obu połówek
i zgodności szerokości z przerwą w ścianie na rzucie usuwa je wszystkie.

Koszt: około 0,27 s na pierścień.

**Rekomendacja na następny etap:** Paddle jako czytnik calloutów z bramką „obie połówki pewne + szerokość zgodna z
przerwą w rzucie”. Odblokowuje to Goździkowce (okna połaciowe, drzwi tarasowe) i część A01, Marcówek i Cieszynianek.

## 10. Artefakty

**W repo:**
- `research/analyzer-005y-archon-visual/ledger.json`;
- `replay-solver.ts`;
- `callout-paddle-probe.ts`;
- testy;
- ten raport;
- `PROJECT_STATUS.md`.

Rastrów wydawcy ani ścieżek prywatnych nie ma w repo.

**Poza repo (dołączone w sesji):**

| plik | rozmiar | SHA-256 | zawartość |
|---|---|---|---|
| `005y-archon-five-houses-visual-review.zip` | 8 201 439 B | `677903be0f5b07da1244a73ca050382fcf765c93afd542bf0ac1980155cbb56f` | 6 katalogów (5 domów + OWNER m3ea), przed i po po 8 presetów, `porownanie-przed-po.png`, README z mapą kamer, manifest, SHA256SUMS; 114 plików |
| `005y-archon-five-houses-models.zip` | 79 366 B | `b1e023ee495a4172735ddd3f2ed85ffaf8b872826d2e8f83a190ff609c1fd4b6` | `model-przed.json` i `model-po.json` per dom (otwieralne w BuildWorld: Load) |

ZIP zawiera wyłącznie rendery modeli z BuildWorld, bez obrazów wydawcy i bez obrazów z generatora AI.

## 11. Następny krok

Paddle jako czytnik calloutów z bramkami z §9, z regresją na obu domach ewaluacyjnych i pięciu domach rozwojowych.
Potem dekompozycja pasa ściany tylnej A01 (§8.1).
