# STAGE BUILDPLAN N7-COUNCIL-FIX-01 — odzyskanie ścian na dowodach i pochodzenie analizy na telefonie

Baza: `claude/new-session-3kzcgh`, audyt Council `bffe265`. Solver **2.6.0**. APK **1307**.

Naprawiono potwierdzone defekty Council F-R1, D-3, E-1 i F-2. Zachowano P1 (`PARTIAL_3D_PREVIEW`) i walidator
`WALLS_OVERLAP`; żadna reguła walidatora nie została rozluźniona.

**Prywatnego benchmarku OWNER-a nie odtwarzałem i nie deklaruję jego naprawy.** Domu nie identyfikowałem.

## Wynik w skrócie

| Defekt | Stan po FIX-01 |
|---|---|
| F-R1 — okna w dalekiej ścianie cienkiej bryły czytane jako słupy | naprawiony: ściana czytana wzdłuż lica, przerwy domykane tylko z dowodem ze źródła |
| D-3 — ramy od grubości ściany domu | naprawiony: rama od grubości ściany-gospodarza |
| E-1 — elewacja potwierdza samym „brakiem nieba” | naprawiony: potwierdza tylko narysowany obrys bryły |
| F-2 — wynik bez wersji analizatora | naprawiony: każdy wynik ma trwały rekord pochodzenia |
| Bryła gubiona w dekompozycji (THINWALL, 4 okna) | **nazwana** w diagnostyce, **nie odzyskana** — wymaga zmiany dekompozycji rzutu (Council poprawka 3) |
| D-1 — `repairRing` zwęża pierścień | **nienaprawiony** (poza zakresem); widoczny teraz w diagnostyce kolizji |

Wszystkie fiksury są wymyślone (`synthetic-drawings`). Żaden rysunek wydawcy nie trafił do repozytorium.

## FIRST_BAD → PRZED → POPRAWKA → PO → DOWÓD ŹRÓDŁOWY → TEST NEGATYWNY

| | F-R1 | D-3 | E-1 | F-2 |
|---|---|---|---|---|
| **FIRST_BAD** | `v2/thin-body.ts` `adjudicateThinBody`: pasmo dalekiego lica wymagało ≥ 60 % tuszu w 21 próbkach. Dwa okna 1,5 m w ścianie 6 m dają 41 % | `v2/emit.ts` `cutAndFill` i drzwi wspólne: `frameWithinWall(kind, b.wallThicknessM)` — grubość domu (0,32 m) zamiast ściany-gospodarza (0,16 m) | `thin-body.ts` `elevationOver`: `builtShare` = udział pikseli „nie-niebo” | `AnalysisTracker.recordOf` i `DownloadedSceneEntry` nie zapisywały `summary.analyzer`; brak skrótu uruchomionego bundla |
| **PRZED** | THINWALL + 2×1,5 m: CANOPY_ON_POSTS → KEEP_PARTIAL → `21 createWallRing ring-attached-0-0 WALLS_OVERLAP`; w modelu brak dobudowy | THINWALL + 1/2 okna albo okno + drzwi: `placeWindow` / `placeDoor … FILL_TOO_LARGE`, model częściowy | drzewa 8,2..12 m: builtShare 1,0 → CORROBORATES → WIDEN 8,45 → 11,99 m; bryła z tyłu: to samo | po ponownym otwarciu karta nie mówi, która wersja analizatora zrobiła wynik |
| **POPRAWKA** | `readFarWall`: lico czytane wzdłuż całej długości. Kawałki muru na jednej linii, przerwy 0,5–6,5 m (granice `planGaps`), kawałki wewnętrzne ≥ 1,5× grubości (filar, nie słup), mur ≥ 25 % lica, linia dochodzi do obu końców bryły, **każda przerwa objaśniona przez źródło** | `cutAndFill(…, hostT)`: `tOf(mass)` dla otworów, `back.thicknessM` dla ściany tylnej wnęki, `tOf(gospodarz)` dla drzwi wspólnych (po SHARED_WALL gospodarzem jest ściana drugiej bryły). Także oparcie płyty dachu dobudowy i komin w ścianie liczone od `tOf` | `outlineEdges`: CORROBORATES tylko gdy ≥ 60 % wierszy ma krawędź w kolumnie dalekiego narożnika (±0,15 m), ≥ 60 % kolumn ma krawędź u szczytu ściany (−0,4…+0,8 m), a w tych kolumnach nie stoi inna bryła rzutu. CONTRADICTS tylko przy niebie i braku narożnika. W pozostałych przypadkach NOT_DECISIVE | `RunProvenance` przy każdym wyniku (wpis sceny, raport przebiegu lokalnego, trwały dziennik `analysis-runs/provenance.json` z błędami usługi). Widok w szczegółach wyniku i w arkuszu domu, przycisk „Kopiuj pochodzenie” |
| **PO** | to samo wejście: DRAWN_THIN_WALLS, pierścień 0,158 m, 2 okna wycięte i wypełnione, COMPLETE, 66 poleceń (render niżej) | COMPLETE, okno i drzwi w ścianie 0,158 m. Dla domów o grubości domu emisja bajt w bajt ta sama | drzewa, żywopłot, bryła z tyłu: NOT_DECISIVE, brak poszerzenia. Ściana zbudowana: nadal CORROBORATES → WIDEN | każdy nowy wynik: `analysisRunId`, czas, versionCode/Name, LOCAL/SERVICE, solver, SHA-256 `analyzer.mjs`, hash modelu, punkt kontrolny, stan. Stare wpisy: `VERSION_UNKNOWN` |
| **DOWÓD ŹRÓDŁOWY** | linia przeszkleń narysowana w przerwie wewnątrz grubości ściany (`drawnAcross` ≥ 0,8) albo drukowany łańcuch od ościeża do ościeża. Sam układ przerw nie wystarcza | grubość ściany odczytana z rysunku (DRAWN_THIN_WALLS, 0,15 m) | narysowany obrys: narożnik w kolumnie z rzutu i szczyt ściany na wysokości poziomu | bundel sprawdzany plik po pliku względem manifestu tuż przed startem; wersje z `summary.analyzer` |
| **TEST NEGATYWNY** | słupy 0,15 m co 2 m → KEEP_PARTIAL; ściana kończąca się w połowie → KEEP_PARTIAL; gołe przerwy bez symbolu i łańcucha → KEEP_PARTIAL; błędnie odczytany wymiar 85 cm → konflikt wygrywa, KEEP_PARTIAL | bryła o grubości domu: brak pól ramy (emisja jak wcześniej) | drzewa / żywopłot / bryła z tyłu → NOT_DECISIVE; puste niebo → CONTRADICTS | wpis z indeksu starszej wersji → brak pochodzenia (VERSION_UNKNOWN), nigdy wersja bieżącego APK |

## Rzeczywista zmiana programu i renderu

Wejście: THINWALL z dwoma oknami 1,5 m w dalekiej ścianie 0,15 m. Ten sam rysunek; „przed” to kod analizatora z
`bffe265`.

| | przed (2.5.0) | po (2.6.0) |
|---|---|---|
| wynik | PARTIAL_3D_PREVIEW, `21 createWallRing ring-attached-0-0 WALLS_OVERLAP` | COMPLETE |
| decyzja cienkiej bryły | KEEP_PARTIAL (CANOPY_ON_POSTS) | DRAWN_THIN_WALLS, t = 0,158 m; lico: mur 50 %, 2 przerwy 1,47 m z linią przeszkleń |
| polecenia | 55 | 66 |
| tylko po | — | `createSlab slab-attached-0-0`, `createWallRing ring-attached-0-0`, `createRoof roof-attached-0`, 2× `cutOpening`, 2× `placeWindow` |
| model | `aab80616…` | `8bc16de7…` |

Pliki są w `stage-reports/artifacts/analyzer-n7-fix01/`:

- rendery: `renders/wide2-before.png` i `renders/wide2-after.png` — bez dobudowy, potem dobudowa z dwoma oknami;
- `renders/n2-*` i `renders/wd-*`;
- różnica programu: `program-diff-wide2.txt`;
- podsumowania: `before/*.summary.json` i `after/*.summary.json`.

Rendery to rasteryzacja trójkątów z produkcyjnego `compileBuilding`.

Wszystkie przypadki THINWALL, przed → po (ten sam rysunek):

| okna w dalekiej ścianie | przed | po |
|---|---|---|
| 0 | COMPLETE | COMPLETE (bez zmian) |
| 1×1,0 m | PARTIAL, `placeWindow FILL_TOO_LARGE` (D-3) | COMPLETE, 1 okno |
| 2×1,0 m | PARTIAL, 2× `FILL_TOO_LARGE` (D-3) | COMPLETE, 2 okna |
| 2×1,5 m | PARTIAL, `21 createWallRing WALLS_OVERLAP` (F-R1) | COMPLETE, 2 okna |
| okno + drzwi | PARTIAL, `placeWindow` i `placeDoor FILL_TOO_LARGE` | COMPLETE, okno i drzwi |
| 4×1,0 m | COMPLETE **bez dobudowy, bez wpisu** | COMPLETE bez dobudowy, model identyczny (`35080769…`), **bryła nazwana** |

### Cztery okna — ograniczenie

Dobudowa ginie wcześniej: w dekompozycji rzutu (`plan-decomposition.ts`, zamknięcie krawędzi). Krótkie filary 0,3 m nie
są pasmami ścian, krawędź komórki ma closure 0,11 < 0,62, komórka zalewa się jako zewnętrzna i zostaje strefą 0,50 m.
Do `adjudicateThinBody` nic nie dociera.

FIX-01 nie zmienia dekompozycji. Dodaje kontrolę stref: strefa bez ściany o grubości domu, w której rzut rysuje własne
ściany na obu końcach i dalekie lico z murem, z papierem między nimi (`bodyDrawnInZone`), jest wpisywana do
`zoneBodies` i do nierozstrzygniętych:

> a body drawn in the 0.50 m zone on the east … FIRST_BAD: PLAN_DECOMPOSITION

Odzyskanie bryły wymaga zmiany dekompozycji (Council poprawka 3).

### Synteza rysunku

Okna dobudów w `synthetic-drawings` rysowały dotąd gołą przerwę o grubości ściany domu. Teraz rysują przerwę o
grubości ściany dobudowy, linie ościeży i — dla okna — dwie linie przeszkleń. To ta sama konwencja, którą rzut
modelowy rysuje otwory pierścienia. Testy rodzin kształtów i reszta pakietów przechodzą bez zmian.

## Krok 4 — ścieżka kolizji `ring-attached-k-0` w1/w3

Każdy pierścień odrzucony za nakładanie **własnych** ścian dostaje rekord `ringCollisions`
(`v2/ring-collision.ts`). Rekord jest w `result.preview.partial`, zapisywany z wpisem sceny na telefonie i pokazywany
w szczegółach modelu częściowego. Zawiera:

- czy `thinBodies` wybrało bryłę, a jeśli nie, to dlaczego (główna, kawałek, prostokąty kondygnacji, nie była cienka);
- obrys, szerokość, długość, grubość pierścienia i grubość domu;
- tusz dalekiego lica: przed otworami (`farEdgeInk`) i po nich (`farWall.pieceShare`, liczba otworów, czy to ściana z
  otworami);
- wszystkie hipotezy i decyzję z przyczyną, oraz `firstBad`;
- czy uzgadnianie ścian zmieniło pierścień przed odmową. `fitPreviewProgram` trzyma teraz rekordy **każdej** próby,
  także pierwszej — wcześniej gubione (Council D-1);
- czy P1 usunęło bryłę i które obiekty.

Przykłady:

- **SLIVERTON** (APK 1307): `ring-attached-0-0`, wybrana, 0,60 m przy ścianie 0,32 m, KEEP_PARTIAL,
  `SOURCE_CONFLICT`, uzgadnianie bez zmian, P1 usunęło płytę, pierścień i dach.
- **Ścieżka D-1** (pierścień 0,62 m): niewybrana, „0.62 m across, not narrower than two 0.30 m walls”. Uzgadnianie
  zmieniło pierścień przed odmową (EDGE_MOVED 0,05 m, próba 0). P1 usunęło bryłę.

Na telefonie OWNER-a ten rekord rozstrzyga, która z dróg Council (F-R1, D-1 czy stary wynik) daje jego sygnaturę.

## Testy i odbiór

Pełnego CI nie uruchamiałem.

| Zakres | Wynik |
|---|---|
| THINWALL 0/1/2/4 okna, 2×1,5 m, okno + drzwi — pełny pipeline do modelu i `MobileSceneBundle` (replay bajt w bajt, hash modelu, bundel się wczytuje) | `analysis-service/test/wall-recovery-n7-fix01.test.ts` 6/6, `thin-body-n7-p2r.test.ts` 3/3 |
| Negatywy: słupy, ściana kończąca się w połowie, gołe przerwy, błędny odczyt OCR, drzewa, żywopłot, bryła z tyłu, puste niebo | `reconstruction/test/thin-body-n7-fix01.test.ts` 12/12 |
| D-3: poprawna cienka ściana z oknem i drzwiami bez `FILL_TOO_LARGE`; dom o grubości domu bez zmian | `reconstruction/test/ring-collision-n7-fix01.test.ts` 5/5 |
| P1: SLIVERTON nadal daje poprawny model częściowy (baza zachowana, bryła usunięta, scena się wczytuje) | e2e jw. oraz bundel z APK: scena `4ad30210…`, model `988e55bd…` — identyczne z 1306 |
| Pakiety zmienione (`reconstruction`, `synthetic-drawings`, `analysis-service`, `apps/local-analyzer`) | 1235 przeszło, 7 pominiętych, **1 nie przeszło** — zastany `program.test.ts` Larchfield (porównanie ze sceną nagraną w 03Y1, czerwony już przy P2R); parzystość z desktopem przechodzi |
| `tests/architecture` | 340 przeszło, 3 nie przeszły — zastane: `wall-strip` ×2 (baza 005Q) i `research-isolation` (śledzony APK z 005T) |
| Osiem znanych domów, raz po zakończeniu zmian | **8/8 modeli bajt w bajt**: a6849073, 852c257a, 8541ca10, 5394c17c, 73969751, d2bf0c03, 34a95a76, 090749f4. Żadnej cienkiej bryły, żadnego wpisu `zoneBodies`, więc żadnego nowego nierozstrzygniętego |
| Demonstracja P2R (Marcówki z wstrzykniętym paskiem 0,45 m) | A `8541ca10` → B częściowy `55d3fea7` → C WIDEN po łańcuchu 415 cm → `8541ca10`; bez zmian |
| Android, test LOCAL na JVM (zapis, ponowny odczyt po „restarcie” magazynu, wersja analizatora, skrót bundla, stan FAILED, dziennik przebiegów, `VERSION_UNKNOWN`, kolizja zapisana ze sceną z bundla 2.6.0) | `RunProvenanceTest` 4/4, `LocalAnalysisTest` 27/27, `AnalysisTrackerTest` 13/13 |
| Android, cały `testDebugUnitTest` | 429, 4 nie przeszły — zastane (`AutoCandidateRenderingTest` ×2, `DownloadedScenesTest` ×2 — katalog scen w APK ma 7 pozycji, test oczekuje 5). Te same 4 czerwone na kodzie bazowym (sprawdzone przez odłożenie zmian Androida) |
| Urządzenie / emulator | brak w sesji; ekranu pochodzenia nie oglądałem na telefonie. Kompiluje się, a dane są pokryte testami JVM |

## APK 1307

| Pole | Wartość |
|---|---|
| plik | `BuildPlan-Model-Preview-arm64-v8a-debug.apk`, 39 777 254 B |
| SHA-256 | `bbaac49d77d65125c566a63cda345056780933def36eed1b68ff5c23190b661b` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1307** / `0.1307.0-owner` |
| podpis | dotychczasowy klucz podglądu, cert `6e48fac4…`; `verify-preview-signature.sh`: ok |
| analizator w APK | `assets/local-analyzer/analyzer.mjs` SHA-256 **`6453937cd6880b4b7e6a3ee0071cf1c18cf91ff10963b39a83d8368f19586e56`** (= `manifest.json`, 2 753 579 B), `SOLVER_V2_VERSION = "2.6.0"`. Kod zgodny z bundlem zbudowanym z HEAD — różnią się tylko klucze ścieżek modułów |
| `PARTIAL_3D_PREVIEW` z APK | bundel wyjęty z APK na SLIVERTON: polecenie 21, `WALLS_OVERLAP`, scena `4ad30210…`, model `988e55bd…` (jak 1306), plus `ringCollisions` |

APK instaluje się na 1306: ten sam podpis i wyższy versionCode.

Po instalacji każda nowa analiza pokazuje w szczegółach sekcję „Pochodzenie analizy”: solver 2.6.0, SHA-256
`6453937c…` dla trybu LOCAL, stan i hash modelu. Wynik bez tej sekcji (`VERSION_UNKNOWN`) jest wynikiem sprzed 1307.

## Czego FIX-01 nie robi

- Nie zmienia dekompozycji rzutu. Bryła z czterema oknami jest nazwana, nie odzyskana.
- Nie naprawia D-1 (`repairRing`), B-1 (grubość z mediany) ani C-1/C-2. To są poprawki 2 i 3 z
  `COUNCIL_FIX_ORDER.md`.
- Nie domyka przerw bez dowodu. Gołe przerwy bez linii przeszkleń i bez łańcucha zostają przerwami.
- Nie wyłącza i nie rozluźnia `WALLS_OVERLAP`.
- Nie rozpoczyna FIX-02 ani P3.
