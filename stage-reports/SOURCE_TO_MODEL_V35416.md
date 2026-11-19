# v3.54.16 — wykonawca korekt: konsultant → operacja na elemencie → model → pomiar w źródle → ponowna recenzja

Baza: kod `5d4321c` (v3.54.15, APK 1346), raport `24aee28`. Gałąź `claude/new-session-3kzcgh`, commity `[skip ci]`,
bez merge/PR. Master Plan v3.54.16 w `docs/MASTER_PLAN.md`, ADR `docs/ADR-V35416-CORRECTION-EXECUTOR.md`. Kod
zamrożony do próby: `fae7624`; kod końcowy (host, APK): `f75d205` (dwie zmiany po próbie, jawnie niżej). Rysunki
wydawców, modele, nagrania odpowiedzi i plansze — poza Gitem, w prywatnym ZIP-ie.

## 0. Które operacje działają od końca do końca

| operacja (rejestr 1.0.0) | konsument | gdzie wykazana | stan |
|---|---|---|---|
| ADD_OPENING | `cutOpening` + `placeWindow/placeDoor` (@buildapp/commands) | host (żywy, kanał szkicu), DEV żywy (recenzent → COMMITTED → druga recenzja MATCHES → CLOSED_VERIFIED), testy | **E2E** |
| UPDATE_OPENING (przesunięcie, szerokość, wysokość, kondygnacja) | te same komendy, ten sam id i id wypełnienia | host (żywy, 6 korekt frontu/prawej), próby kontrolowane 0,6 m / 3 m vs 1,2 m / parapet, kontrpróba | **E2E** |
| ADD_CHIMNEY | `placeChimney`, głębokość ze styku z połaciami | odtworzenie zapisanych odpowiedzi Murcji i Bakopy przez nowy kanał, testy | działa na zapisanych odpowiedziach; nie na hoście |
| REMOVE_OPENING | `removeFeature` | testy (fałszywy otwór usunięty, narysowany — odmowa) | kontrolowane |
| UPDATE_CHIMNEY | `moveFeature/resizeFeature` | testy | kontrolowane |
| SET_FINISH | `applyAppearance` | testy (pole ściany pod prostokątem, geometria użytkowa bez zmian) | kontrolowane; w próbie zgłoszone bez propozycji |
| SET_PARAMETER | `setProperty` + zależni (kondygnacja niżej, ściany pełnej wysokości) | testy (wymaga wydrukowanego świadka, jednostki) | kontrolowane |
| ASSIGN_VIEW | rejestracja niezarejestrowanej elewacji (oś po okapie, lustro po otworach) | testy | kontrolowane |
| ROOF_FEATURE | dotychczasowy konsument lukarn (v3.54.3) | podpięty do tego samego rejestru | bez zmian |
| forma dachu, obrys, balkon, pergola, panele, wnętrze | — | nazywane jako `UNSUPPORTED`, nigdy nie oferowane | **nieobsługiwane** |

**Pokaz na hoście (kod końcowy `f75d205`, publiczny punkt wejścia, Ballina, żywy bieg):**

| element | korekta | bramka źródła (z: propozycja / model) | pomiar po budowie | recenzja nowej rewizji |
|---|---|---|---|---|
| `opening-0-front-0-0` | UPDATE (szkic frontu) | 8,18 / 5,61 | IoU 1,00, z 8,23 | CLOSED_VERIFIED |
| `opening-0-front-0-3` (drzwi) | UPDATE | 7,18 / 2,21 | IoU 1,00, z 7,14 | CLOSED_VERIFIED |
| `opening-0-front-0-1` | UPDATE | 3,35 / 0,31 | IoU 1,00, z 3,35 | CLOSED_VERIFIED |
| `opening-0-front-0-4` | UPDATE | 3,04 / 0,78 | IoU 1,00, z 3,04 | CLOSED_VERIFIED |
| `opening-0-front-0-2` | UPDATE | 4,23 / 2,23 | IoU 1,00, z 4,14 | CLOSED_VERIFIED |
| `opening-0-east-1-0` | UPDATE (szkic prawej) | 10,09 / 8,74 | IoU 1,00, z 10,07 | CLOSED_VERIFIED |
| nowe okno lewe | ADD (szkic lewej) | 5,77 na 354 polach | IoU 1,00, z 5,77 | CLOSED_VERIFIED |
| 3 otwory tyłu | ADD | — | — | NEEDS_EVIDENCE: widok tyłu bez wysokości (grunt poza datum) |

Każda transakcja: „1 łatka; zmienione obiekty wyłącznie w zbiorze zależności; błędy złączy 0 → 0”. Recenzja (Sonnet
5.5) obejrzała dostarczoną rewizję `7f4bb112baee` i znalazła 3 różnice nadal otwarte: drzwi tarasowe z tyłu (bez
wykonywalnej propozycji), panele PV (nieobsługiwane), cokół z cegły (wykończenie bez propozycji). Jakość
**RECOGNIZABLE_PARTIAL**, 7 zamkniętych na zweryfikowanej rewizji, 2 sprzeczności pomiarowe obrysu (krótszy o 0,28 /
0,22 m od wydrukowanego wymiaru) nie są kasowane przez recenzję.

## 1. Co zmieniono (krótko)

- **Jeden stan edytowalny**: model kanoniczny biegu (`CanonicalBuildingModel`), nie trzeci opis i nie `house.json`
  (H → LOCAL i z powrotem gubi id, wnętrze, relacje, materiały — zmierzone wcześniej jako gorsze od LOCAL).
  Round-trip serializacji bajt w bajt, ta sama scena po przeładowaniu (test).
- **Rejestr** (`consult/correct/registry.ts`): jedna deklaracja generuje sekcję promptu recenzenta, schemat łatki
  i dyspozycję wykonawcy. Kontrakt recenzji 0.3.0, prompt 0.4.0.
- **Wiązanie** propozycji: piksel obrazu → piksel ramki → rejestracja widoku (`facadeAlignment.views`, metry wzdłuż
  i w górę) → najbardziej zewnętrzna ściana tej strony, kondygnacji i rozpiętości. Wartości pochodne zapisane per
  łatka.
- **Bramka źródła zamiast bramki LOCAL** (`source-gate.ts`): propozycja i element modelu jako dwie hipotezy na
  ORYGINALNYM obrazie — skoki na krawędziach (uśrednione wzdłuż boków) + kontrast wnętrze/pierścień, w odchyleniach
  standardowych pól tej samej wielkości na tym samym pasie ściany (z ≥ 2 wspiera; jedna musi wygrać o 1; z < 1 —
  odrzucenie; 1 ≤ z < 2 bez hipotezy bieżącej — NEEDS_EVIDENCE). Stała przed wynikami, bez strojenia per dom.
  Stary próg 0,30 m od LOCAL-a już nie blokuje naprawy błędnego otworu LOCAL-a.
- **Transakcje** (`execute.ts`): walidacja → wiązanie → bramka → zastosowanie na kopii → kompilacja → pomiar
  (zbudowany element narysowany z powrotem w źródle, IoU ≥ 0,85; błędy złączy zewnętrznych nie rosną; każdy obiekt
  poza zbiorem zależności transakcji bajtowo ten sam) → commit albo rollback z powodem. Niezależne propozycje —
  niezależne transakcje; wspólna `group` — razem albo wcale.
- **Dostawa**: model wykonawcy przez ten sam bieg analizy (`AnalysisOptions.patchedModel`, tylko gdy bieg odbudował
  dokładnie bazę wykonawcy); SHA dostarczonego modelu sprawdzany wobec wykonawcy.
- **Kanał szkicu** (`from-sketch.ts`): typowane elementy szkicu (otwory, kominy) parowane 1:1 z modelem → UPDATE /
  ADD / ADD_CHIMNEY → ta sama bramka i ten sam wykonawca, PRZED pętlą recenzji (pierwsza recenzja ocenia już
  poprawioną rewizję). Szkic nie wraca do pikseli dla otworów (F4).
- **Jakość osobno od ukończenia** (`quality.ts`): REVIEW_COMPLETED to fakt o obejrzanej rewizji; stany jakości
  SOURCE_VERIFIED_IN_SCOPE / RECOGNIZABLE_PARTIAL / NEEDS_EVIDENCE / UNSUPPORTED_OPERATION / NO_IMPROVEMENT /
  BUDGET_OR_ROUND_LIMIT / NOT_REVIEWED; CAN_REUSE zostaje stanem magazynu. Defekt zamyka się (CLOSED_VERIFIED) tylko
  gdy recenzja NOWEJ rewizji się zgadza, a pomiar źródłowy nie przeczy.
- **Ekstrakcja bez modelu**: gdy LOCAL nie zbuduje nic, szkice czterech elewacji i tak są czytane (UNCHECKED)
  i dostarczane (`sketchesWithoutModel`).
- **Poprawki śladu i proporcji** (z audytu): `checkProportions` parowanie 1:1 w metrach (środek wzdłuż i w górę,
  szerokość, wysokość) — przesunięty, poszerzony albo o kondygnację wyżej otwór nie jest „ten sam”; kalenica/okap
  per bryła (dwie bryły to nie spór); ślad faktu w słowach producenta (ADMITTED ≠ REFUSED), skutek związany
  z parametrem, którym rządzi.

## 2. Trzy dowody mechanizmu i kontrpróby (§9)

Rekordy: `research/source-to-model/v35416/results/controlled-proofs.json`; zamrożone przebiegi i nakładki
(czerwony — przed, zielony — po, niebieski — przyjęta propozycja, pomarańczowy — odrzucona) w prywatnym ZIP-ie.

| dowód | dane | wynik | rozliczenie |
|---|---|---|---|
| 1. brakujące okno | Ballina, lewa elewacja | ADD_OPENING COMMITTED (z 6,64 ≥ 2 na 312 polach), zbudowane na `ring-main-0-w3`, IoU 1,00; propozycja na pustej ścianie REJECTED_BY_SOURCE (z −0,99) | DEV żywy: recenzent L1:D1 „brak okna lewego” → ADD → look 2 MATCHES → **CLOSED_VERIFIED** |
| 2a. zły otwór przesunięty 0,6 m | Ballina front, kontrolowana iniekcja | UPDATE COMMITTED (źródło z 7,55 za propozycją, model z 1,73) | ten sam id, model wraca do `eb82a422…` |
| 2b. 3 m zamiast 1,2 m | jw. | UPDATE COMMITTED (7,55 vs 2,39) | wspólny środek to nie zgodność |
| 2c. parapet/kondygnacja | jw. | UPDATE COMMITTED (7,58 vs 2,65) | re-host na górną ścianę w tym samym miejscu (test) |
| 2-kontra | poprawny model, błędna propozycja | REJECTED_BY_SOURCE (model 7,35, propozycja 1,81) | model stoi |
| 3. komin + złe okno w jednej recenzji | Murcja, tył | ADD_CHIMNEY COMMITTED (z 2,86; zbudowany 3,01), UPDATE okna REJECTED_BY_SOURCE (z −0,78) | każde rozliczone osobno, pozostałe id bez zmian |
| 3b. komin | Bakopy, front | ADD_CHIMNEY COMMITTED (z 8,4); drugi słaby (z 1,67) NEEDS_EVIDENCE | — |
| 3-grupa | test syntetyczny | dobre + złe okno w jednej grupie → oba cofnięte | wspólny rollback |
| ekstrakcja bez modelu | Coastal, Kardamon (zapis), Layla (żywy) | 3 / 2 / 4 szkice UNCHECKED, bez modelu | obserwacje nie zależą od sukcesu LOCAL |

Kontrprzykłady kontraktu (test): stara rewizja, operacja spoza rejestru, niepewność HIGH, obraz niebędący
elewacją, otwór przez strop, widok bez wysokości, SET_PARAMETER bez wydrukowanego świadka/jednostki, ASSIGN_VIEW
na złej osi, powtórzone id propozycji, duplikat otworu.

## 3. Zamrożona próba (2 nowe rodziny, ≥ 1 spoza Lipińskich)

Reguła spisana przed biegiem: `research/source-to-model/v35416/trial/TRIAL_SELECTION.md` (losowanie z ziarna
commitu zamrożenia, wykluczenia rodzin widzianych). Wybrane: **ARCHON Willa Layla G2AE** (jedyny niewidziany kandydat
z listy ARCHON, 9 widzianych pominięto) i **Studio Atrium Alaska** (trzeci otwarty; dwa wcześniejsze bez opisanych
elewacji). Pierwszy wynik zachowany jak jest (`results/trial-first-results.json`):

- **Layla**: LOCAL bez modelu (PLAN_LAYOUT_REJECTED), cztery szkice UNCHECKED w kolorze; ~0,055 USD szkiców.
- **Alaska**: model zbudowany (metryka zamieniła odmowę METRIC_RESOLUTION_INCONCLUSIVE w model na skali
  SUPPORTED). Kanał szkicu: 17 propozycji, wszystkie NEEDS_EVIDENCE — widoki zarejestrowane tylko pozycyjnie
  (wysokości REFUSED), prawa strona niezarejestrowana. Recenzja: D1 KEY ROOF_FORM `UNSUPPORTED` (model to płaskie
  pudło zamiast dwuspadu), D2 OUTLINE_REGION `UNSUPPORTED`, D3 SET_FINISH bez propozycji. Decyzja NO_CHANGE,
  jakość **UNSUPPORTED_OPERATION**. To uczciwy wynik: pętla działa, ale najważniejszego braku tej rodziny (forma
  dachu) rejestr nie umie poprawić.
- **Po próbie (DEV, jawnie)**: oś `roof` w sourceCheck mówiła `NO_DIFFERENCE_REPORTED` przy otwartym defekcie KEY
  dachu — osie czytają teraz dziennik defektów (`5a79add`). Pierwszy wynik próby nie był przeliczany.
- **Różnica transportu (nazwana)**: próba i DEV szły z `strict=false`; host ma strict włączone dla recenzji. Ta
  różnica ukryła błąd znaleziony dopiero na hoście (§4).

## 4. Finalny host

Dwa biegi na publicznym punkcie wejścia hosta (`dist/server.mjs`, pilot za flagą i tokenem, strict tools, cache
5 min), Ballina; rekordy tekstowe: `research/source-to-model/v35416/results/host-e2e.json`.

1. **Pierwszy bieg (build `5a79add`)**: wykonawca zatwierdził i dostarczył 7 korekt, ale **każda recenzja padła**
   (HTTP 400: „too many optional parameters (32) … limit 24” — pola łatki w schemacie recenzenta przy strict).
   Wynik uczciwie oznaczony: NOT_REVIEWED, 7 × APPLIED_NOT_REVIEWED, NOT_ACCEPTED; powtórka tego samego URL nie
   mogła użyć ponownie (0,091 USD, inne bajty — odpowiedzi na żywo nie są deterministyczne). Koszt 0,208736 USD.
   Kontrola E2E wykryła to sama (6 FAIL), nic nie zostało ukryte.
2. **Poprawka (`f75d205`, kod końcowy)**: ta odmowa dostawcy (nieopłacona) przechodzi tę samą jedyną ścieżkę zapasową
   bez strict co „grammar too large” (odpowiedź nadal walidowana lokalnie); test.
3. **Bieg końcowy (build `f75d205`)**: **ALL CHECKS PASSED.** Nowy realny job: 7 korekt przez wspólnego wykonawcę,
   recenzja dostarczonej rewizji (checked = delivered = `7f4bb112baee`), 7 CLOSED_VERIFIED, jakość
   RECOGNIZABLE_PARTIAL, ACCEPTED_NOW, 0,240094 USD / 10 żądań. Ten sam URL ponownie: REUSED, 10 odpowiedzi
   odtworzonych, 0 USD / 0 żądań, te same bajty modelu i sceny, ta sama jakość i lista defektów (ponowne użycie nie
   poprawia etykiety). Bez tokenu: 0 żądań (LOCAL sam — RECONSTRUCTION_FAILED, jak dotąd). Księgi hosta tylko
   CONSULTATION.

Wydatek etapu: **1,00064 USD** (pula etapu 2,042895); księgi **27,812357 / 28,854612 USD**. Nowej puli nie otwierano.

## 5. Relacja do audytu Council

| ustalenie | co zrobiono | stan |
|---|---|---|
| F1 brak operacji edycji w aktywnej recenzji | rejestr 9 operacji, konsumenci z @buildapp/commands i applyAppearance | zamknięte dla otworów (E2E); kominy na zapisach; reszta kontrolowana |
| F2 zgodność z LOCAL zamiast źródła | bramka źródła (dwie hipotezy na oryginale, z-score), próg 0,30 m usunięty z tej ścieżki | zamknięte (dowód 2 i kontrpróba) |
| F3 niepełna bramka geometrii otworów | parowanie 1:1 w metrach, środek wzdłuż i w górę, szerokość, wysokość; brakujące w szkicu liczone | zamknięte (reprodukcja Council w teście) |
| F4 szkice za późno, semantyka gubiona w pikselach | kanał szkicu przed recenzją, typowane elementy → ten sam wykonawca | zamknięte dla otworów i kominów; ściany/dach nadal przez raster |
| F5 „brak źródła” vs nieobsługiwany rodzaj | MISSING_SOURCE / FAILED / UNSUPPORTED rozdzielone; ekstrakcja bez modelu | częściowo: nadal brak modelu bez linii wymiarowych |
| F6 jedna kalenica na wiele brył | ridge/eaves per host, spór tylko na jednej bryle | zamknięte na poziomie odczytu; konsument wielu dachów nie zmieniony |
| F7 recenzja nie obejmuje całego celu | kolory i materiały w recenzji; wnętrze tylko z rzutów; defekty bez propozycji i nieobsługiwane liczone w jakości | częściowo |
| 5.3 dwa błędy śladu faktu | ADMITTED ≠ REFUSED; skutek związany z parametrem | zamknięte (test) |
| Krok C stany końcowe | jakość ≠ ukończenie ≠ CAN_REUSE | zamknięte |
| Krok E rysunek jako dostawa | 4 szkice/dom PNG+SVG+JSON, galeria, plansze | zachowane, w kolorze |

## 6. Czego nadal nie ma (nazwane)

- Forma dachu, obrys/region, balkon, pergola, panele, wnętrze — tylko nazywane (`UNSUPPORTED_OPERATION`).
- Widoki zarejestrowane tylko pozycyjnie blokują łatki otworów (NEEDS_EVIDENCE) — Alaska, tył Balliny.
- SET_PARAMETER, ASSIGN_VIEW, SET_FINISH, REMOVE_OPENING, UPDATE_CHIMNEY — wykazane tylko na danych kontrolowanych.
- Domy bez linii wymiarowych (Coastal, Kardamon, Layla) — nadal bez modelu, tylko szkice.
- Live odpowiedzi nie są deterministyczne: dwa biegi tego samego URL bez akceptacji dają różne modele; ponowne
  użycie działa tylko dla przyjętej rewizji.

## 7. Testy, APK, dostawa

- Macierz na kodzie końcowym: **4381 passed, 16 failed** — dokładnie 16 znanych błędów bazy (local-analyzer
  program/text, architecture: analyzer-api, compound-facade, presentation ×2, reference ×2, research-isolation ×4,
  wall-strip ×4), ta sama lista co przy zamrożeniu (`results/matrix-final.txt`, `matrix-freeze.txt`).
  `analysis-service` 561/561, `mobile-scene` 112/112, Android `testDebugUnitTest` zielone.
- **APK 1347** (`BuildPlan-Model-Preview-1347-arm64-v8a.apk`, z `f75d205` + sceny), sha256
  `23355ad7695f7d1247f3e1c755762d30e28e07bc9b320a6f945c6affea394573`; aapt2: `com.buildplan.preview`,
  versionCode 1347; pięć nowych scen na początku indeksu; skan klucza: 0 trafień.
- Prywatny ZIP: szkice 7 domów × 4 strony (PNG/SVG/JSON, raw, normalized, rejected, MISSING_SOURCE), źródła,
  `gallery.html` z decyzjami wykonawcy i jakością, plansze (źródło | szkic | przed | po | oddany; perspektywy;
  kondygnacje bez dachu; nakładki dowodów), modele i sceny, nagrania odpowiedzi, rekordy hosta, księga, raporty, APK.

## 8. Werdykt

IMPLEMENTATION_COMPLETE dla zakresu §4 z zastrzeżeniami: pętla jest zamknięta od końca do końca dla otworów (host,
żywy bieg, recenzja nowej rewizji), kominy działają na zapisanych odpowiedziach, a SET_PARAMETER, ASSIGN_VIEW,
SET_FINISH, REMOVE_OPENING i UPDATE_CHIMNEY są wykazane tylko na danych kontrolowanych. Forma dachu pozostaje
nieobsługiwana — w próbie (Alaska) to był najważniejszy brak. Zieleń techniczna nie oznacza „to jest mój dom”.
