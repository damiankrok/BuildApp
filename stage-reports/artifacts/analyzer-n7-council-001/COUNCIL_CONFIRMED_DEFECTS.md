# N7-COUNCIL-001 — ustalenia z klasą (po rundzie obalania)

Każdą klasę przydzielił recenzent, a następnie F ją podważał (`reviews/council-F-refutation.md`). Tam, gdzie F zmienił
klasę, podaję wynik końcowy. Polecenia odtworzenia uruchamia się z katalogu repozytorium.

## CONFIRMED_DEFECT

Format każdego wpisu: FIRST_BAD → plik:funkcja → wejście → zachowanie dziś → zachowanie prawidłowe → test → odtworzenie.

### F-R1 — otwory w dalekiej ścianie cienkiej bryły robią z niej „słupy”

- **FIRST_BAD / funkcja:** `packages/reconstruction/src/v2/thin-body.ts` → `adjudicateThinBody`. Pasmo `farBand`
  wymaga `BAND_INK_SHARE` 0,6 tuszu w próbkach wzdłuż ściany.
- **Wejście:** THINWALL (bryła 0,50 × 6 m, ściany 0,15 m) z oknami 1,0 m w dalekiej ścianie.
- **Dziś:**
  - przy 2 oknach WIDEN, SHARED_WALL, DRAWN_THIN_WALLS i SOLID_WALL są REFUTED, a CANOPY_ON_POSTS SUPPORTED;
  - decyzja to KEEP_PARTIAL, a model odrzuca `21 createWallRing ring-attached-0-0 WALLS_OVERLAP`;
  - przy 4 oknach bryła nie powstaje w ogóle, wynik jest COMPLETE i nic jej nie nazywa.
- **Prawidłowo:**
  - przerwy w ścianie objaśnione przez otwory rzutu (`planGaps`/callouty) albo elewację liczyć jako ścianę;
  - bryłę utraconą przy wydrukowanym łańcuchu nazwać.
- **Test:** brak. Żadna fiksura nie ma otworów w cienkiej bryle.
- **Odtworzenie:**
  - `npx vite-node research/analyzer-n7-council/F/thinwall-openings-e2e.ts -- --n=2` (oraz `--n=4`);
  - `npx vite-node research/analyzer-n7-council/F/thinwall-n4-gaps.ts`.

### D-1 — rekoncyliacja zwęża pierścień poniżej 2T po P2R i gubi zapis

Klasa: defekt potwierdzony na poziomie funkcji; jako przyczyna u OWNER-a HIGH_RISK.

- **FIRST_BAD / funkcja:** `packages/reconstruction/src/candidate.ts` → `repairRing`, przez `wall-reconciliation.ts`
  `parallelConflict`/`moveRingEdge`. Gubienie zapisu: `fitPreviewProgram` zachowuje `reconciled` tylko ostatniej
  próby.
- **Wejście:** dobudowa 0,62 m (2T = 0,60), wchodząca 5 cm w ścianę bryły głównej.
- **Dziś:**
  - `thinBodies` nic nie zgłasza;
  - EDGE_MOVED przesuwa zachodnią krawędź o 0,05 m w głąb bryły, do szerokości 0,57 m;
  - model odrzuca `ring-attached-1-0` w1/w3 przy poleceniu 21, z punktem kontrolnym 16;
  - zapis EDGE_MOVED znika z wyniku, a komunikat opisuje wielokąt, którego emiter nie wypisał.
- **Prawidłowo:**
  - przesunięcie nie może dać szerokości < 2·t;
  - zachować zapisy pierwszej nieudanej próby.
- **Test:** brak przypadku szerokości z przedziału [2T, 2T + tolerancja] z nakładaniem.
- **Zastrzeżenie F:** żaden prawdziwy layout nie dał nakładania rzędu centymetrów (`toOuterFaces` zachowuje lica
  wspólne).
- **Odtworzenie:**
  - `npx vite-node research/analyzer-n7-council/D/h2-reconcile-narrows.ts`;
  - `npx vite-node research/analyzer-n7-council/D/h2b-reconcile-record.ts`.

### B-1 — jedna grubość ściany T dla całego domu, z mediany pasm (także działowych)

- **FIRST_BAD / funkcja:** `plan-decomposition.ts` → `decomposePlan` (`bandWallThickness`, mediana ważona długością),
  użyte w `reconstruct-v2.ts:418`.
- **Wejście:** gozd, zapieczętowany.
- **Dziś:**
  - T = 0,304 m, choć wszystkie lica zewnętrzne mają 17 px = 0,431 m;
  - rary i arganiach: ściany dobudowy narysowane 0,33/0,39 i 0,15 m dostają 0,44–0,46 m.
- **Prawidłowo:** T z pasm lic zewnętrznych, grubość per bryła.
- **Test:** brak.
- **Odtworzenie:** `research/analyzer-n7-council/B/run-band.sh <out>`.

### D-3 — ramy okien i drzwi od T domu w bryle o cieńszych ścianach

- **FIRST_BAD / funkcja:** `v2/emit.ts` → `cutAndFill` / shared doors, `frameWithinWall(kind, b.wallThicknessM)`.
- **Wejście:** THINWALL + 1 okno.
- **Dziś:** FILL_TOO_LARGE, otwór wycięty, podgląd częściowy.
- **Prawidłowo:** `tOf(mass)`.
- **Test:** brak (THINWALL nie ma otworów).
- **Odtworzenie:** `research/analyzer-n7-council/D/h3-thickness-openside.ts`; F `thinwall-openings-e2e.ts --n=1`.
- **Część niepotwierdzona:** „>12 cięć → całkowita odmowa” jest nieosiągalne tą drogą (F-R1 włącza się wcześniej) —
  DESIGN_LIMITATION.

### D-4 — SHARED_WALL usuwa całą stronę przy częściowym pokryciu

- **FIRST_BAD / funkcja:** `thin-body.ts` → `adjudicateThinBody` (`overlap > 0,5·long`).
- **Wejście:** bryła 0,45 m, druga bryła pokrywa z = 4,5…8, a pas trwa do z = 10,5.
- **Dziś:** model ma 2,5 m otwartej obwiedni i zostaje zaakceptowany.
- **Prawidłowo:** SHARED_WALL tylko przy pełnym pokryciu; inaczej ściana na odcinku niepokrytym albo KEEP_PARTIAL.
- **Odtworzenie:** `research/analyzer-n7-council/D/h5-shared-wall-partial-overlap.ts`.

### C-1 — kafelkowanie przekracza narysowane ściany

- **FIRST_BAD / funkcja:** `plan-decomposition.ts` → `mergeRegions`.
- **Wejście:** dom z garażem, gdy prostokąt dom + garaż jest większy od samego domu (fiksury C).
- **Dziś:**
  - garaż zostaje wcielony do bryły głównej, a jego płaski dach znika pod szczytem;
  - w t-strip120 powstaje fantomowa bryła dwukondygnacyjna;
  - bramka zwraca STRUCTURAL_LAYOUT_REJECTED (BLOCKING), a wynik to COMPLETE.
- **Prawidłowo:** kafel nie może przekroczyć ciągłego pasma ściany; BLOCKING nie może dawać COMPLETE.
- **Odtworzenie:**
  - `npx vite-node research/analyzer-n7-council/C/probe-merge.ts`;
  - `… C/probe-tiling.ts -- --only t-strip120`.

### C-2 — cofnięty garaż z szeroką bramą ginie bez śladu

- **FIRST_BAD / funkcja:** `plan-decomposition.ts` → `decomposeCore` (domknięcie krawędzi i flood fill).
- **Wejście:** garaż cofnięty o 0,30 m, brama 2,4 m.
- **Dziś:** ACCEPTED/COMPLETE bez garażu i bez wpisu w nierozstrzygniętych. Kontrolki (lico wyrównane albo brama
  1,0 m) wykrywają garaż.
- **Odtworzenie:** `… C/probe-tiling.ts -- --only gb-setback-door --gaps`.

### C-3 — cofnięty garaż przyciągany do lica domu

- **Skutek:** 6,30 m głębokości zamiast 6,00 m (drobny błąd wymiaru).
- **Funkcja:** cięcie regionu bazowego, `layout.ts:1925`.
- **Odtworzenie:** `… C/probe-tiling.ts -- --only gb-setback-nodoor --gaps`.

### A-1 — kopie jednego rzutu jako niezależne zasoby, bez porównania skal

- **FIRST_BAD / funkcja:** `source-package/src/acquire.ts` → `buildAssets`; `relateAcrossViews` pomija pary plan–plan.
- **Dziś:**
  - 8/8 domów ma 3–4 kopie każdej kondygnacji;
  - poddasze marcówek odczytane jako 3,697 vs 1,039 cm/px;
  - arganiach traci poddasze.
- **Odtworzenie:** `… A/plan-regs.ts`; `… A/plan-diag.ts arganiach`.

### A-5 — etykiety FRONT/REAR elewacji bez kontroli

- **Dziś:** zamiana etykiet daje nowy model bez żadnej odmowy (mutacja).
- **Odtworzenie:** `… A/mutate.ts`.

### A-6 — słownik ARCHON źle kieruje przypadki brzegowe

- **Dziś:** „plan-sytuacyjny” trafia jako rzut, „parterowy” zamienia rzut poddasza na parter, a słowa z nazwy projektu
  ustawiają kondygnację.
- **Dowód:** harness funkcji czystej `… A/roles-hazards.ts`.

### A-8 / B-4 (raport) — `scaleBasis.corroborated` zawsze true poza SAME_PIXEL_SCALE

- **Gdzie:** `layout.ts:2105`.

### B-4 — fałszywy konsensus jako skala drukowana

- **Dziś:**
  - poddasze arganiach zarejestrowane w skali 1/3 z dwóch kotwic, residuum 0, rozwiązanie INCONCLUSIVE;
  - `layout.ts:839` traktuje to jako PRINTED_SCALE;
  - skutek dla modelu jest dziś maskowany przez NO_SUPPORT.
- **Odtworzenie:** `… B/attic-scale-repro.ts`.

### E-1 — „nie-niebo” liczone jako zabudowa

Klasa: defekt na poziomie funkcji; w produkcji HIGH_RISK.

- **Funkcja:** `thin-body.ts` → `elevationOver`.
- **Dziś:** drzewa i bryła stojąca z tyłu dają builtShare 1,0 i fałszywe WIDEN (8,45 → 11,99 m).
- **Odtworzenie:** `… E/thin-body-sky.ts`.

### E-2 — weryfikacja z widokami częściowo samoodniesiona

- **Funkcja:** `v2/verify.ts`, SILHOUETTE_WIDTH bierze krawędź najbliższą modelowi.
- **Dziś:**
  - zwężona marcówka (8,35 m) jest „zgodna” z widokiem;
  - podsufitki są czytane z tego samego widoku (residuum 0 w 9/9).
- **Odtworzenie:** `… E/cut-body-report.ts`.

### E-3 — wysokości otworów z widoków o odrzuconym gruncie

- **Funkcja:** `reconstruct-v2.ts`; `viewGroundRefusals` obejmuje tylko rejestrację sylwetką.
- **Dziś:**
  - a01: sill/head z widoków o błędzie gruntu 0,42–0,71 m (etykieta VISUAL_INFERRED);
  - trytomach REAR 0,79 m;
  - `viewAudit` mówi READ, a `facadeAlignment` heights false.

### E-4 — boczna elewacja odrzucana, gdy „jej” oś zajęta

- **Funkcja:** `views.ts` → `chooseSide`.
- **Dziś:** sasankach3 traci obie boczne; okap 0.
- **Odtworzenie:** `… E/side-choice.ts`.

### E-9 (semantyka raportu) — CONFIRMED_MATCH bez wysokości i z odczytem posianym przez model

- **Dziś:** a01 ma 7 takich zgodności przy 4 widokach bez wysokości.

### F-2 (Android, kod) — zapisany wynik nie niesie wersji analizatora

- **Funkcja:** `recordOf` gubi `summary.analyzer`.
- **Dziś:** po restarcie karta pokazuje blok częściowy bez wersji i bez listy nierozstrzygniętych.

### F-6 (drobny) — liczniki opisane niejednoznacznie

- „Odczytano” = otwory planowane, „Co udało się odtworzyć” = otwory zbudowane.
- „bryły” = layout, „pierścienie” = model.

## COVERAGE_GAP

- **D-2 / C-4 / B-3** — `thinBodies` pomija `storeyRects`, pieces i MAIN, a emisja buduje je z `rectAt`.
  - Odtworzone na emisji i walidatorze (D `h1`, C `probe-thin-gap.ts`).
  - Z layoutu nieosiągalne przy T ≤ 0,5 (bramka `max(1, 2·wallM + 0,2)`). Nie dotyczy domu jednopoziomowego.
- **D-5** — `cutFailedObject`/`bodyOf` nie grupuje ścian bryły SHARED_WALL: zostaje płyta i jedna wolnostojąca ściana
  (D `h3`).
- **E-7** — raporty elewacyjne i rezydua liczone przed cięciem podglądu opisują inny model niż scena
  (`cut-body-report.ts`).
- **C-8** — paski, które nie są bryłami, znikają bez wpisu.
- **A-7** — `groupVariants` testowane, ale nieużywane w produkcji.
- **B-2** — bramka wąskich brył działa tylko na rzutach z obrysem (`envelope.outline`); na ścieżce long-band-box brak
  testu wąskiej bryły.
- **WIDEN** — brak testu decyzji WIDEN przez emisję i model (D §8).

## HIGH_RISK

- **A-2** — konflikt etykiet kondygnacji między kopiami dodaje lub usuwa kondygnację. Mechanizm potwierdzony mutacją,
  wyzwalacz na realnych danych nieznany.
- **A-3** — kopia bazowa wybierana po słabej etykiecie „dimensioned”. Bez niej marcówki i sasankach3 kończą się
  METRIC_RESOLUTION_INCONCLUSIVE (mutacja).
- **A-4** — kopia tego samego rysunku liczona jako niezależny świadek CROSS_COPY.
- **A-9** — pokoje przypisywane kondygnacjom po indeksie.
- **B-5** — rzut piętra rejestrowany licami bez kontroli skali i offsetu: 3,4 % i 0,27 m w marcówkach; 10,5 % błędu
  skali na syntetyku.
- **B-6** — elewacje z błędem gruntu do 0,9 m zachowują skalę poziomą (sasankach3: 0,84/0,81 m).
- **D §8** — po WIDEN rejestracja elewacji, głos dachu i cecha MASS pochodzą sprzed zmiany, a proweniencja
  SOURCE_EXACT jest fałszywa.
- **E-5** — szerokość do rejestracji legacy sumowana po bryłach, z podwójnym liczeniem pieces.
- **E-6** — odczyty ścian ignorują przesłonięcie przez bliższą bryłę.
- **E-8** — thin-body czyta wysokości na widokach wykluczonych z wysokości.
- **F-3** — decyzja WIDEN lub DRAWN_THIN_WALLS nie jest sprawdzana ponownie (< 2t) i nie dodaje wpisu.
- **F-7** — `apps/local-analyzer/dist` to stary bundel; dotyczy wyłącznie reprodukcji na desktopie.
- **F (usługa)** — na armeabi-v7a nie ma `libnode.so`, więc działa fallback do usługi zdalnej. Wymaga adresu
  ustawionego przez użytkownika.
- **Drobne:** D §7 (płyta dachu, `readWallOpenings` z T domu); terasy, komin i surfaceRegion wskazujące ścianę
  otwartej strony.

## DESIGN_LIMITATION

- 12 cięć podglądu, potem całkowita odmowa (D) — tą drogą nieosiągalne.
- Awaria pierścienia `storeyRect` zabiera zdrowe kondygnacje bryły (SAME_BODY).
- Model nie ma kontroli domknięcia obwiedni.
- C-6 — niejednoznaczne położenie piętra usuwa całą kondygnację (nazwane).
- C-7 — wnęka wielkości drzwi między skrzydłami domykana zależnie od drzwi.
- C-9 — ściana wspólna budowana podwójnie.
- B-2 dziś (maskowane podłogą 1,0 m).
- B-7 — fallback T 0,38 bez wpisu; ridge ±0,02.

## NOT_A_DEFECT (podejrzenia obalone)

- **Stary bundel na telefonie po aktualizacji APK:** obalone. `LocalRuntimeFiles.install()` sprawdza sha i usuwa inne
  wersje.
- **Cache wyników po URL:** nie istnieje.
- **Identyczny hash punktu kontrolnego jako dowód braku zmian:** obalone. Hash obejmuje tylko prefiks bryły głównej.
- **Decyzja P2R mutuje kopię zamiast emitowanego obiektu:** nie; to ten sam obiekt.
- **Emisja SHARED_WALL:** poprawna dla 4 stron × 1–2 kondygnacje (8/8).
- **Anizotropia skali X/Z:** ≤ 0,6 %.
- **Spany SCALED:** uczciwe; łańcuch istnieje, ale nie odczytano jego segmentu.
- **Odwrócenie osi z:** spójne.
- **`storeyRects` bierze pierwszy, nie największy kawałek:** obalone.
- **`storeyRect` lub piece węższy niż `minSpanM`:** niemożliwe.
- **Wybór największego wariantu w zasobie, deduplikacja identycznych bajtów, perspektywa nigdy jako elewacja:**
  poprawne.
- **Skrętność czterech stron i reguły zamiany stron:** poprawne.
