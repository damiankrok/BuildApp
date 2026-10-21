# BUILDPLAN-ANALYZER-005Y-N1 — od źródła do cechy: dlaczego człowiek widzi otwór/komin, a analizator go gubi

Gałąź: `analyzer/005y-n1-source-to-feature-debug-v1`, baza `98df11f8c906b8562342c91d44539618ffeb32d3` (005Y).

Mirror `claude/new-session-3kzcgh`, release i APK nietknięte. Nic nie zostało zmergowane.

Werdykt wizualny: **OWNER_VISUAL_PENDING**. To nie jest `ALL_GREEN`: bramka śledzonego APK > 32 MB pozostaje znaną, niezależną porażką.

## 0. Odtworzenie i metoda

Wejścia to zapieczętowane SourcePackage i cache bajtów pięciu domów ARCHON, te same co w 005Y. Model OWNER m3ea nie był podstawiany pod DEV m84f ani odwrotnie. OWNER m3ea nie był w tym etapie ruszany (punkt 6 zlecenia: „jeśli starczy czasu” — nie starczyło).

Każdy bieg „przed” i „po” to pełna ścieżka produkcyjna:
- offline, `second-house.ts --recogniser`;
- kolejne kroki: obserwacje → metryka z PaddleOCR (ORT, worker) → rekonstrukcja v2 → model → kompilacja sceny → weryfikacja.

Biegi startowe N1 odtworzyły hashe 005Y bajt w bajt:

| dom | hash 005Y | hash startu N1 |
|---|---|---|
| a01 | 40ccaaae | 40ccaaae |
| gozd | 1856a617 | 1856a617 |
| marcowki | cf797743 | cf797743 |
| ciesz | 9478c6d1 | 9478c6d1 |
| rary | 9f5fd342 | 9f5fd342 |

**Śledzenie `FEATURE_DEBUG`** (`featureTrace` w `reconstructV2`):
- Ślad jest tylko do zapisu. Odtworzenie z włączonym śladem daje te same hashe modeli.
- Zapisuje:
  - każdą przerwę w ścianie (`OPENING_GAP`), z każdym rozważonym calloutem i powodem odrzucenia;
  - każdy pierścień okna połaciowego (`ROOFLIGHT_RING`);
  - każdy blok lity (`SOLID_BLOCK`) i kandydata na komin (`CHIMNEY_BLOCK`), z decyzją i powodem.
- W normalnym biegu ślad jest wyłączony.
- Narzędzie: `research/analyzer-005y-archon-visual/replay-solver.ts` (`FEATURE_DEBUG=1`). Uruchamia solver na zapieczętowanym grafie i metryce biegu produkcyjnego. Jego hash = hash produkcji, co sprawdziłem dla każdego domu w tabeli z punktu 4.

**Inwentarz i nakładki** są prywatne, poza repozytorium (`/home/user/work005yn1/debug/`):
- `visual-inventory.json`: obiekty odczytane przeze mnie z rastrów, z pikselowymi ramkami, wymiarami i pewnością;
- `overlays/`: 23 nakładki rzutów, 2×. Warstwa A (żółta) to obiekt widziany przez człowieka. Warstwa B (zielona/czerwona) to pierścienie czytane rozpoznawaczem. Warstwa B' (turkus/pomarańcz) to pierścienie szablonu. Warstwa C (niebieska/purpurowa) to przerwy zbudowane i odrzucone. D to nagłówek ze stanem modelu. Dołączony jest `manifest.json` ze ścieżką i SHA-256 źródła;
- wycinki: `ciesz/garage-front-crop.png`, `marcowki/entrance-crop.png`, `marcowki/front-110-crop.png`, `rary/callout-sheet.png`.

Pikseli wydawcy nie ma w repozytorium.

## 1. Macierz źródło → cecha

Kolumny macierzy:
- **wycinek/px:** widok, plik i ramka w pikselach;
- **wynik OCR/CV:** co odczytał czytnik;
- **FIRST_BAD:** pierwszy zły krok, z warunkiem i wartościami;
- **wpływ:** skutek w modelu;
- **poprawka;**
- **przed → po.**

| dom | wycinek/px | obiekt | wynik OCR/CV | FIRST_BAD | wpływ | poprawka | przed → po |
|---|---|---|---|---|---|---|---|
| gozd | rzut poddasza (6e44db362c), pierścienie (330,198) (422,198) (510,198) (576,198) (330,505) (457,505) (576,505), r 12–13 | 7 okien połaciowych 78/140 | szablon: 211/140, 274/140, 271/400, 210/140, 211/100; Paddle: 78/140 (p≈0.999) | `callouts.ts` `readHalf` (szablon) czyta 78 jako 211/274/271; potem `roof-details.ts` `readPlanRooflights` odrzuca 2.11 m jako szerokość nie-okna (0.3–1.6 m) | 0 okien połaciowych | rozpoznawacz połówek pierścieni w fazie metryki; okno poszukiwań tinted bez skali arkusza (poddasze miało NO_SCALE); 4 z 7 połówek szerokości niestabilne w nawiasie stabilności, przyjęte przez potwierdzenie bliźniaczym pierścieniem | **0 → 7** |
| gozd | rzut parteru (527,613), (396,576) | 325/225 brama, 105/210 drzwi | szablon 176/140, 616/400; Paddle 325/225, 105/210 | `callouts.ts` szablon | brama 3.22×2.20 założona | rozpoznawacz | 3.25×2.25 i 1.05×2.10 drukowane |
| gozd | rzut poddasza (667,421), (667,351), (83,288), (83,414) | 110/220 ×2, 180/220 | szablon 116/72, 116/177, 446/147, 46/77 | `callouts.ts` szablon | okna 1.10×1.30 założone | rozpoznawacz | 1.10×2.20 i 1.80×2.20 drukowane |
| gozd | rzut parteru (208,199) i inne | 300/230, 180/230, 100/150, 260/140, 110/140, 200/230, 290/100 | Paddle np. 300 (p 0.997) / 230 (mean 0.82) | `callout-recogniser.ts` `judgeCalloutHalf`: bramka (mean < 0.9 / niestabilne); bliźniacza kopia rzutu to ten sam tusz, nie drugi świadek | wysokości założone | brak (bramka precyzji zachowana) | REJECTED → REJECTED |
| gozd | przekrój | rzędna kalenicy +8.36, rejestracja elewacji | czytnik poziomów: tylko +2,46 (0.21) | `extract.ts` odczyt poziomów przekroju: brak drabinki → `ridgeY` nieznany → pętla elewacji w `reconstruct-v2.ts` pomija każdy render | brak zarejestrowanych widoków | brak (tekst przekroju poza zakresem) | — |
| a01 | rzut poddasza (318,488) | 7. okno połaciowe (na rysunku łóżka) | brak pierścienia wśród 17 kandydatów | `callouts.ts` `readTintedCallouts`: linie łóżka łamią test pierścienia | brak okna | brak | 6/7 → 6/7 |
| a01 | rzut (pas y 149–163.5) | głębokość 8.008 m wobec 8.30 m | — | dekompozycja planu: pas tylnej ściany sklasyfikowany jako `zone-min_z` | korpus krótszy o 0.29 m | brak (topologia poza zakresem) | — |
| a01 | rzut parteru (770,352) | okno wsch. 100/140 | szablon 106/142 → Paddle 100/140 | z odczytem Paddle: `verify.ts:294` `repairFromResiduals` przesunął założony parapet 0.80 → 1.54 i zostawił nadproże, więc drukowane 1.40 m skurczyło się do 0.66 m | okno 0.66 m | `verify.ts`: parapet pod drukowaną wysokością nie przesuwa się sam (odczyt widoku zapisany, niezastosowany) | 1.06×1.42 → 1.00×1.40 |
| a01 | rzut parteru/poddasza | 105/210, 90/210, 220/120, 180/220, 100/220 ×2 | szablon 106/202, 89/202, 226/170, 177/210, 100/70 → Paddle | `callouts.ts` szablon | wymiary szablonu | rozpoznawacz | wymiary drukowane (3 dodatkowe otwory z calloutem: 6 → 9) |
| a01 | rzut poddasza, przerwy y 526–534 | 13 przerw 0.5–0.8 m (kreski linii przerywanej) | — | `openings-v2.ts` `planGaps` czyta linię przerywaną jako ścianę z przerwami | — | regresja wykryta i usunięta w trakcie etapu: pierścienie wyłącznie tinted (okien połaciowych) nie są promowane do calloutów otworów | REFUSED → REFUSED |
| ciesz | przekrój (533–583, 90–122) i (746–787, 117–230); elewacja frontowa (648–690, 160) i (832–868, 185) | 2 kominy | bloki lite x 5.22–5.89 i 8.53–8.91 na jedynej kondygnacji | filtr w `reconstruct-v2.ts`: „jedna kondygnacja i żaden zarejestrowany render” (wszystkie 4 sylwetki elewacji zawiodły; przekrój bez drabinki) | 0 kominów | `roof-details.ts` `registerSectionByTwoAnchors` (rozpiętość płyty stropu wobec planu oraz dwa poziomy +7.20/±0.00: skale różnią się o 3.1 %), `sectionStackOver` (komin nad linią dachu narysowaną na przekroju) | **0 → 2** (0.47 m i 1.25 m nad dachem) |
| ciesz | blok x 2.67–3.08, z 11.46–12.35 | nie-komin | brak trzonu nad nim | — | — | — | poprawnie odrzucony |
| ciesz | dach | dach czterospadowy | — | regresja wykryta w trakcie etapu: `reconstruct-v2.ts:1705` przywracał dach dwuspadowy, gdy związany był z nim jakikolwiek komin | dach dwuspadowy | komin nie wiąże dachu; w płaszczyźnie przebicie pionowe (`emit.ts`), komin na grzbiecie lub kalenicy bez cięcia i z notatką | 4 połacie → 4 połacie |
| ciesz | rzut 26: słupki bramy (482–582, 660–677); pierścień tinted 275/225 | brama garażowa | 184 pierścienie, 1 przyjęty; 275/225 odrzucony | układ: ściana frontowa garażu ~0.8 m przed linią frontu; `planGaps` czyta przerwę na linii głównej = wnętrze garażu 3.69 m, więc żaden odczyt 275 nie zgodzi się w ±12 % | okno 3.69 m | brak (dekompozycja brył poza zakresem) | MISCLASSIFIED |
| ciesz | elewacje | skala frontu 0.037 m/px wobec boku 0.016 m/px | sylwetka frontu 329,411..1086,615 to same ściany (szary dach na tle nieba nie wchodzi); boki obejmują drzewa | ekstrakcja sylwetek w obserwacjach | `registerElevationV2` zawodzi, fallback pasma bierze pas 314 px | brak (segmentacja poza zakresem) | — |
| ciesz | rzut 26 (190–290, 75–235) | podcień / taras kryty | — | układ (strefa nie budowana jako zadaszenie) | brak | brak | LOST_IN_FUSION |
| marcowki | elewacja frontowa (568–800, 210–390) | drzwi balkonowe w szklanym szczycie | — | brak błędu roli i materiału: szczyt jest szkłem; „drewniane skrzydło” na renderze to drzwi wewnętrzne `main-idoor-1-3` (x 4.09–4.99 m, z 4.716) widoczne przez szybę | brak słupka i ślemienia (nieodczytane) | brak | BUILT_CORRECTLY |
| marcowki | rzut 16 (216–255, 717–735), łuk z zawiasu ~(252,720), r≈33 px | drzwi wejściowe 105/210 | `doorSwingDrawn` = true (tusz 0.04–0.08) | `openings-v2.ts`, kaskada rodziny: podłogowa + przeszklenie + łuk + ≤1.3 m nie trafia w żaden przypadek, więc spada do WINDOW | wejście jako szklane okno | wycofana: ścisły test łuku chybił tego łuku o piksel i znajdował łuki w szrafurze Rarytasów | MISCLASSIFIED |
| rary | elewacja ogrodowa 05: (220–460), (605–686), (775–855), (965–1095) | 4 duże przeszklenia | 400/230, 150/230 ×2, 230/290 z rzutu | brak: rozmiary, kolejność i rodzaje zgadzają się z elewacją; notatka 005Y „1 okno i 2 drzwi” była odczytem renderu, nie modelu | brak szprosów i okładziny drewnianej | brak | BUILT_CORRECTLY |
| rary | rzut 33, wycinki w `rary/callout-sheet.png` | 120/230 ×2, 105/210, 250/140, 100/140 | szablon 120/290, 470/110, 250/110, 100/110 → Paddle (sprawdzone okiem na wycinkach) | `callouts.ts` szablon | nadproża 2.9 m zamiast 2.3 m itd. | rozpoznawacz | wymiary drukowane |
| rary | rzut 33, lewy tył | 230/230 | szablon 230/290; Paddle 230/230 odrzucony bramką | bramka precyzji | nadproże 2.9 zamiast 2.3 | brak | MISCLASSIFIED |
| rary | narożnik garażu | „471/71” / „421/71” | pierścień, którego w źródle nie ma | `readOpeningCallouts` (fantom sprzed etapu) | okno 3.8 m na korpusie dołączonym | brak | bez zmian |

Pełny dziennik decyzji (DETECTED / REJECTED / MISCLASSIFIED / LOST_IN_FUSION / DROPPED_BY_EMITTER / BUILT_CORRECTLY / SOURCE_AMBIGUOUS) jest w `research/analyzer-005y-n1-source-to-feature/ledger.json`.

## 2. Człowiek kontra algorytm

Nie każdy brak to OCR. Pierwsze złe kroki rozkładają się tak:

| kategoria | przypadki |
|---|---|
| tekst w pierścieniu (szablon) | okna połaciowe i callouty Gozd, callouty A01 i Rary |
| wykrycie pierścienia | 7. okno A01, fantom Rary |
| rejestracja widoków | elewacje Ciesz (sylwetka), Gozd (brak rzędnej kalenicy na przekroju) |
| reguła fuzji/filtr | kominy Ciesz |
| weryfikacja | parapet A01 |
| dekompozycja planu | brama Ciesz, głębokość A01, podcień Ciesz, kreski poddasza A01 |
| klasyfikacja rodziny | wejście Marcówek |

Dwa zgłoszenia nie były błędami modelu:
- „drewniane drzwi balkonowe” Marcówek;
- „mniejsze przeszklenia” Rarytasów.

## 3. Zmiany w kodzie (ogólne, bez nazw, kluczy i współrzędnych domów)

1. **`packages/source-metrics/src/callout-recogniser.ts` (nowy).**
   - Cięcie połówek pierścienia, port metody „disc” z badania 005Y: tusz wewnątrz pierścienia, papier znormalizowany do własnego, podział na pasku, padding jak w `cropForToken`.
   - Licznik glifów połówki.
   - Bramka jednej połówki `judgeCalloutHalf`. Wymaga jednocześnie:
     - stabilności w nawiasie;
     - posterior ≥ 0.9 i mean ≥ 0.9;
     - zgodności z własną odpowiedzią modelu;
     - 2–3 cyfr;
     - glifów ≤ cyfr, co odrzuca zgubione pierwsze cyfry 105→5, 118→18, 230→30;
     - zakresu 40–700 / 40–400 cm.
   - `corroborateBySibling`: połówka odrzucona wyłącznie przez nawias jest przyjęta tylko wtedy, gdy inny pierścień na tym arkuszu ma tę samą parę przyjętą wprost.
2. **`extract.ts`.**
   - Na rzutach z rozpoznawaczem: pierścienie ciemne oraz tinted z paskiem idą do rozpoznawacza w jednej partii na arkusz.
   - Pierścień przyjęty dodaje odczyt rozpoznawacza jako pierwszych kandydatów calloutu. Szablon zostaje w zapisie.
   - Pierścienie wyłącznie tinted nie stają się calloutami otworów.
   - Nowe pole `calloutRings` i schemat **1.9.0**, tylko gdy rozpoznawacz przeczytał pierścień. Bez rozpoznawacza zbiór jest bajt w bajt taki jak przedtem (test).
3. **`roof-details.ts`.**
   - `withRecognisedHalves`: pierścień okna połaciowego czyta to, co przeczytał rozpoznawacz (ta sama ramka, środek ≤ 2.5 px, tylko przyjęte).
   - `registerSectionByTwoAnchors` oraz `registerSectionBySlab`: płyta czytana przez luki znaku wodnego.
   - `sectionStackOver`.
4. **`reconstruct-v2.ts`.**
   - Komin z jednej kondygnacji staje, gdy przekrój rysuje nad nim trzon.
   - Komin nie wiąże już dachu czterospadowego jako dwuspadowego.
   - `featureTrace`.
5. **`emit.ts`:** przebicie komina w płaszczyźnie dachu płaszczyznowego (cięcie pionowe), albo przejście bez cięcia z notatką.
6. **`verify.ts`:** parapet pod drukowaną wysokością nie jest przesuwany sam.
7. **`openings-v2.ts`:** tylko ślad diagnostyczny.

Wycofane w trakcie, z powodem zapisanym wyżej:
- reguła „drukowany otwór musi się zmieścić pod okapem”: usuwała prawdziwe przeszklenie Rary 230/290;
- reguła drzwi szklanych z łukiem: zawodny detektor łuku;
- promocja pierścieni tinted do calloutów otworów: fantomowe okna w kolankowej A01.

## 4. Pięć pełnych biegów produkcyjnych (offline, PaddleOCR)

| dom | model przed (005Y) | model po | okna połaciowe | kominy | otwory zewn. z calloutem | najdłuższa cisza heartbeat przed → po | czas przed → po |
|---|---|---|---|---|---|---|---|
| a01 | 40ccaaae | be796f9f | 6 → 6 | 3 → 3 | 6 → 9 | 2.53 → 2.37 s | 284 → 367 s |
| gozd | 1856a617 | 68d6f2e7 | **0 → 7** | 1 → 1 | 0 → 7 | 1.82 → 1.77 s | 267 → 326 s |
| marcowki | cf797743 | bf80f455 | 3 → 3 | 2 → 2 | 11 → 11 | 2.87 → 2.59 s | 242 → 313 s |
| ciesz | 9478c6d1 | f512a136 | 0 → 0 | **0 → 2** | 0 → 0 | 2.89 → 2.55 s | 170 → 205 s |
| rary | 9f5fd342 | 3f0f7183 | 0 → 0 | 1 → 1 | 13 → 13 (wymiary poprawione) | 2.29 → 1.90 s | 210 → 284 s |

Kilka objaśnień:
- Hash Marcówek zmienia się przez zawartość metryki (rekordy pierścieni), nie przez geometrię otworów.
- Pierścienie przeczytane przez rozpoznawacz / przyjęte: a01 387/24, gozd 274/24, marcowki 307/10, ciesz 184/1, rary 290/16.
- Liveness: heartbeat i postęp działają także w nowych krokach (tick w wyszukiwaniu pierścieni tinted, postęp partii rozpoznawacza). Najdłuższa cisza nie wzrosła.
- Czas biegu wzrósł o 20–35 %. To koszt czytania połówek pierścieni (~0.13 s na wycinek). Nie stroiłem pod szybkość (poza zakresem). Brak automatycznego limitu czasu.

## 5. Testy

- `tsc --noEmit` dla całego repo: czysto.
- `vitest`, pakiety `source-metrics` + `reconstruction` + `analysis-service`: 87 plików, 1269 testów, wszystkie zielone.
- Po ostatniej zmianie (emiter i dach) ponownie `reconstruction`: 59 plików, 856 testów, zielone.
- Nowe testy:
  - `source-metrics/test/callout-recogniser.test.ts`, 9 testów: cięcie, liczenie glifów, bramka z 118→18, rodzeństwo, integracja w metryce, ścieżka bez rozpoznawacza bez zmian;
  - `reconstruction/test/source-to-feature-005y-n1.test.ts`, 5 testów: dopasowanie pierścieni, rejestracja dwiema kotwicami przez znak wodny, odmowa przy sprzecznych poziomach, trzon nad dachem kontra słup pod dachem.
- Pełnego CI z 41 jobami, emulatora ani APK nie uruchamiałem (poza zakresem).

## 6. Werdykty

| obszar | werdykt |
|---|---|
| poprawka czytnika (callouty, okna połaciowe) | **ZROBIONA**: Gozd 0→7 okien połaciowych, drukowane wymiary w Gozd/A01/Rary; bramka precyzji zostawia nieodczytane to, co niepewne |
| poprawka klasyfikacji | **NIE ZROBIONA**: wejście Marcówek (zawodny detektor łuku), brama Cieszynianek (dekompozycja) |
| poprawka emisji/fuzji | **ZROBIONA**: kominy Cieszynianek z przekroju, przebicie w płaszczyźnie, parapet A01 nie kurczy drukowanej wysokości |
| zachowanie (preservation) | **ZACHOWANE**: na zbiorach startowych zmiana nie rusza innych domów; dwie regresje wykryte w trakcie (kreski A01, dach Cieszynianek) usunięte przed końcem |
| pięć pełnych modeli produkcyjnych | **TAK** |
| liveness | **ZACHOWANE**: najdłuższa cisza ≤ 2.6 s |
| ocena wizualna | **OWNER_VISUAL_PENDING** |

Co nadal jest nieodczytane i dlaczego:
- **Gozd:**
  - 7 calloutów parteru, odrzuconych przez bramkę precyzji;
  - rzędna kalenicy +8.36, a z nią rejestracja elewacji: tekst przekroju.
- **A01:**
  - 7. okno połaciowe: pierścień na łóżku;
  - głębokość 8.30: dekompozycja.
- **Cieszynianki:**
  - brama garażowa: linia ściany garażu;
  - podcienie: układ;
  - elewacje: sylwetki bez dachu.
- **Marcówki:**
  - wejście: rodzina;
  - słupek i ślemię szczytu.
- **Rarytasy:**
  - 230/230: bramka;
  - fantom 471/71;
  - szprosy.
- **OWNER m3ea:** nie ruszany.

## 7. Stan końcowy i artefakty

Cieszynianki po przywróceniu dachu czterospadowego (`f512a136`):
- 4 połacie i 2 kominy.
- Komin w obrębie połaci dostaje pionowe przebicie. Komin przy kalenicy przechodzi bez cięcia i z notatką.
- Kompilacja sceny i weryfikacja przechodzą.
- Viewer zgłasza „0 errors, 1 warnings”.
- Na prawym kominie widać jasny szpic przy przebiciu: to artefakt cięcia, do sprawdzenia przez OWNER-a.

Artefakty poza repozytorium (`/home/user/work005yn1/zip/`):
- `005y-n1-renders.zip`: przed/po, 8 widoków na dom, arkusze porównawcze, README;
- `005y-n1-models.zip`: `model.json` przed i po;
- `005y-n1-debug-PRIVATE.zip`: inwentarz, nakładki, wycinki, ślady FEATURE_DEBUG. Zawiera fragmenty rysunków wydawcy: prywatne, nie do publikacji.

W repozytorium nie ma żadnego obrazu wydawcy.
