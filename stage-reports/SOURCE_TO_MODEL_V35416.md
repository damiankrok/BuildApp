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
| F5 „brak źródła” vs nieobsługiwany rodzaj | MISSING_SOURCE / FAILED / UNSUPPORTED rozdzielone; ekstrakcja bez modelu | częściowo: Coastal i Kardamon bez modelu; Layla bez modelu mimo silnej skali (patrz §6) |
| F6 jedna kalenica na wiele brył | ridge/eaves per host, spór tylko na jednej bryle | zamknięte na poziomie odczytu; konsument wielu dachów nie zmieniony |
| F7 recenzja nie obejmuje całego celu | kolory i materiały w recenzji; wnętrze tylko z rzutów; defekty bez propozycji i nieobsługiwane liczone w jakości | częściowo |
| 5.3 dwa błędy śladu faktu | ADMITTED ≠ REFUSED; skutek związany z parametrem | zamknięte (test) |
| Krok C stany końcowe | jakość ≠ ukończenie ≠ CAN_REUSE | zamknięte |
| Krok E rysunek jako dostawa | 4 szkice/dom PNG+SVG+JSON, galeria, plansze | zachowane, w kolorze |

## 6. Czego nadal nie ma (nazwane)

- Forma dachu, obrys/region, balkon, pergola, panele, wnętrze — tylko nazywane (`UNSUPPORTED_OPERATION`).
- Widoki zarejestrowane tylko pozycyjnie blokują łatki otworów (NEEDS_EVIDENCE) — Alaska, tył Balliny.
- SET_PARAMETER, ASSIGN_VIEW, SET_FINISH, REMOVE_OPENING, UPDATE_CHIMNEY — wykazane tylko na danych kontrolowanych.
- Domy bez modelu: Coastal i Kardamon (brak rozstrzygniętej skali z linii wymiarowych) oraz **Layla, która ma skalę
  STRONG / potwierdzoną**, a mimo to LOCAL odrzuca układ rzutu (PLAN_LAYOUT_REJECTED). Wcześniejsze zgrupowanie Layli
  z domami „bez linii wymiarowych” było błędnym skrótem (audyt 20.11). Wąskim gardłem Layli jest interpretacja rzutu
  i utworzenie modelu; jej szkice istnieją, ale nie ma konsumenta, który z ich znaczenia i z rzutu złożyłby brakujące
  części bryły. Więcej rund recenzji tego nie zmieni.
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

## 8. Werdykt (zawężony po audycie 20.11.2026)

**Integracja: wykazana.** Pętla konsultant → operacja na elemencie → model → pomiar → recenzja nowej rewizji jest
zamknięta od końca do końca dla otworów (host, żywy bieg). Kominy działają na zapisanych odpowiedziach. SET_PARAMETER,
ASSIGN_VIEW, SET_FINISH, REMOVE_OPENING i UPDATE_CHIMNEY są wykazane tylko na danych kontrolowanych.

**Semantyka korekt: odbiór częściowy.** Audyt wykazał w zadeklarowanym zakresie cztery luki znaczenia (A1–A4, §9) —
naprawione w kodzie bez płatnych wywołań i sprawdzone na kontrpróbach audytu, ale jeszcze nie na żywym hoście.
IoU 1,00 w tabeli hosta oznacza zgodność zbudowanego elementu z poleceniem, nie niezależny pomiar prawdy źródłowej;
dowodem źródłowym są osobne wyniki z obrazu (z) i recenzja.

**Bryła i dach: poza wykazanym zakresem.** Forma dachu pozostaje nieobsługiwana — w próbie (Alaska) to był
najważniejszy brak; Layla nie ma modelu mimo silnej skali. Dwie zamrożone próby są historycznymi porażkami, nie dwiema
użytecznymi miniaturami. Zieleń techniczna nie oznacza „to jest mój dom”.

## 9. Audyt 20.11.2026: A1–A4 i co zmieniono (bez płatnych wywołań)

Audyt odczytowy dostawy (`2de3525`, ZIP `2cdc3ee4…`) potwierdził postęp w edycji istniejącego modelu i wskazał cztery
luki w zadeklarowanym zakresie. Każda jest naprawiona i ma test: kontrpróbę audytu w jego brzmieniu oraz poprawny
odpowiednik (`packages/analysis-service/test/correct-v35416.test.ts`, bloki „audit A1…A4”). Kontrpróby audytu
uruchomione ponownie na prawdziwych modułach: `research/source-to-model/v35416/audit/probe-results-after.json`.

| luka | było | jest |
|---|---|---|
| **A1** wada znika z oceny przez pominięcie | jakość liczona z defektów ostatniego spojrzenia; pominięty KEY dach → SOURCE_VERIFIED_IN_SCOPE, openKey 0 | trwała tożsamość defektu (`key`); zamknięcie tylko przez CLOSED_VERIFIED albo jawne `resolved` (NO_LONGER_DIFFERENT na nowej rewizji → RESOLVED_BY_REVIEW; NOT_IN_SOURCE lub ta sama rewizja → DISPUTED, otwarte); pominięty defekt `carriedFrom`, otwarty. Kontrpróba audytu: **UNSUPPORTED_OPERATION, openKey 1**. Recenzent dostaje listę otwartych defektów (kontrakt 0.4.0, prompt 0.5.0: `continues`, `resolved`) |
| **A2** typ i kąt okna nie są hipotezami | szkic → bbox, typ WINDOW / nie-WINDOW; bramka i pomiar na prostokątach; ten sam bbox → 17,52 vs 17,52 UNDECIDED | szkic przenosi końce skośnej głowicy i dokładny typ (DOOR / GLAZED_DOOR / GARAGE_DOOR); bramka 1.1.0 ocenia wielokąty, gdy którakolwiek hipoteza jest skośna; zmiana samego typu przy tym samym kształcie idzie przez osobną miarę wypełnienia (`compareFill`: paski, struktura, odcień; pasma ustalone z góry, między nimi UNDECIDED); pomiar po budowie sprawdza końce głowicy i zbudowany typ. Ten sam bbox, inna głowica: oceniane jako wielokąty (na prostokątnym rysunku audytu wygrywa prostokąt, z 16,99 vs 14,76) |
| **A3** liczba bez roli jako świadek | świadek = wartość + jednostka; +5,50 z przekroju garażu ustawiało ścianę główną; `sourceByteHash` pusty | świadek = obserwacja: rola zgodna z właściwością (FLOOR / EAVES·CEILING / CHIMNEY / ROOF_PITCH), kotwica (ramka + hash bajtów), obraz wskazany w propozycji, przy wielu bryłach ta sama bryła (`host` w propozycji i w obserwacji), dwie równe wartości różnych brył → AMBIGUOUS_WITNESS. Kontrpróba audytu: **NEEDS_EVIDENCE / WITNESS_ROLE_MISMATCH**. Rzędne LOCAL-a bez roli nie są już świadkiem parametru |
| **A4** CLOSED_VERIFIED bez pomiaru | zamknięcie, gdy `sourceVerified` null; wykończenie bez pomiaru koloru | CLOSED_VERIFIED tylko przy `sourceVerified === true`; null + zgoda recenzenta → CLOSED_REVIEW_ONLY (nie otwarte, ale nigdy SOURCE_VERIFIED_IN_SCOPE); SET_FINISH jawnie: klasa, granica i powierzchnia nie są mierzone |

Wersje: rejestr bez zmian; wykonawca 1.1.0, bramka 1.1.0, kanał szkicu 1.1.0, jakość 1.1.0, kontrakt recenzji 0.4.0 /
prompt 0.5.0 — klucz zaakceptowanych rewizji się zmienia, więc rewizje przyjęte na starych wersjach nie są ponownie
używane. Prostokąty liczone są w bramce bajtowo jak w 1.0.0, więc dowody kontrolowane 1–3 i siedem poprawek hosta
dają te same wyniki. Siedem poprawek hosta miało `sourceVerified: true` — A4 ich nie zmienia.

**Regresja na zapisanych odpowiedziach (0 USD).**
- Dowody kontrolowane 1–3 przeliczone na poprawionym kodzie: 10/10 decyzji, te same z i te same rewizje modelu
  (`audit/proofs-rerun.json`).
- Kanał szkicu Balliny (odtworzenie): te same 10 decyzji (6 UPDATE + 1 ADD przyjęte, 3 ADD tyłu NEEDS_EVIDENCE), ten
  sam model `fa31a591ac19` (`audit/replays.json`).
- Pętla recenzji Balliny odtworzona z nagranych odpowiedzi recenzenta: stan bez zmian (RECOGNIZABLE_PARTIAL,
  1 CLOSED_VERIFIED, 0 KEY), ale otwartych jest 5 zamiast 2. Defekt „parapety okien frontu za nisko” zgłoszony
  w pierwszym spojrzeniu i pominięty w drugim był w 1.0.0 cicho gubiony — teraz jest przenoszony jako otwarty
  (`carriedFrom: 1`). Koszt nazwany: nagrane odpowiedzi poprzedzają pole `continues`, więc dwa defekty powtórzone
  innymi słowami (drzwi tarasowe, panele PV) liczą się podwójnie; nowy prompt każe recenzentowi wskazać `continues`.

**Testy.** Macierz na poprawionym kodzie: 4396 passed (+15 testów audytu), 16 failed — ta sama lista 16 znanych błędów
bazy co przy dostawie (`audit/matrix-audit.txt`). Kontrpróby audytu: 5/5 zachowują się zgodnie z wymaganiem.

**Czego ta poprawka nie robi.** Nie było nowego biegu hosta ani żadnego płatnego wywołania (0 USD); działanie nowych
pól kontraktu (`continues`, `resolved`, `host`) z prawdziwym recenzentem nie jest jeszcze wykazane. Nie zmieniono
zapisanych modeli. Krok 2 audytu (ogólny start i korekta bryły/dachu przy częściowej rekonstrukcji) nie jest częścią
tej poprawki.
