# SOURCE_TO_MODEL v3.54.17 — bryła, dach i wiązanie źródeł

Gałąź `claude/new-session-3kzcgh`; baza `9759c07` (poprawki A1–A4 zachowane); zamrożenie `be023c9`, kod hosta
`14a34bf`. Ogólne mechanizmy, żadnej reguły pod nazwę domu. Pułap wydatków bez zmian (28,854612 USD).

## 0. Tabela operacji (od końca do końca)

Kolumny: operacja → konsument → rodzaj źródła → efekt w modelu końcowym → niezależna miara → końcowy przegląd → luka.
Przypadki rozdzielone: **KONTROLA** (dom kontrolowany, malowany w teście), **DEV** (Layla, Alaska — znane porażki),
**ODTWORZENIE** (nagrane odpowiedzi, 0 USD), **PRÓBA** (rodziny zamrożone przed analizą), **HOST** (publiczne wejście,
jeden commit). Oceny osobno: **MINIATURA** (rozpoznawalna bryła), **METRYKA** (dokładny wymiar), **WNĘTRZE** (nie dotyczy).

| Operacja | Konsument | Źródło | Efekt w modelu końcowym | Niezależna miara | Przegląd końcowy | Luka |
|---|---|---|---|---|---|---|
| `SET_ROOF` (dach bryły, także płaski→dwuspad) | `massing/ops.ts bindSetRoof` → `removeFeature` + `setProperty` (ściany) + `createRoof` pod tym samym id | szkic elewacji (połać w pikselach ramki) | **KONTROLA**: płaski→GABLE wzdłuż X, ściany FOLLOW_ROOF, okno i wszystkie id zachowane; **DEV Alaska**: `roofs: []` → GABLE wzdłuż X, kalenica 7,48 m, 41,4°; **HOST Alaska**: SET_ROOF zatwierdzony i dostarczony (rewizja f0c3b54ba93c) | Alaska: strona 7,68 m / 40° (fakty wydawcy, nieczytane przez mechanizm) → −0,20 m / +1,4°; KONTROLA: kalenica ±0,25 m (próg ustalony przed wynikiem) | DEV (Sonnet, żywo): CLOSED_VERIFIED (ACCEPTABLE_APPROXIMATION + miara źródła); HOST: zob. §6 | dach kopertowy/mansardowy → UNSUPPORTED (nazwane) |
| `BUILD_MASSING` (bryła z niczego / brakująca bryła) | `bindBuildMassing` → `createBuilding/createLevel/createWallRing/createRoof` + `addEvidenceSource` | obrys rzutu (`plan-outline/1` w skali LOCAL) + sylwetki elewacji | **KONTROLA**: z pustego modelu dwie bryły (dwuspad X + płaski garaż), siatka kompiluje się, nic SOURCE_EXACT; brakujący garaż dodany do modelu z samą bryłą główną bez kolateralu; **DEV Layla**: obrys 10 narożników → `MASSING_UNSUPPORTED_FORM` (nazwane) | KONTROLA: ±0,15 m w planie, ±0,25 m w pionie; Layla: obrys 158,5 m² vs 184,87 m² strony (udział 0,857 — sprawdzenie, nie kotwica) | — (bez modelu brak przeglądu) | ≥ 3 prostokąty; host nie oddaje modelu bez koperty `LinkAnalysisResult` |
| `SET_OUTLINE` (zasięg bryły) | `bindSetOutline` → jedna atomowa edycja (`Bound.transform`, `validateModel`) + `resizeFeature` | elewacja zarejestrowana (końce ścian w pikselach) | **KONTROLA**: bryła 8,4→10 m, offset okna tylnej ściany 1,0→2,6 m, obrys dachu poszedł za ścianą | KONTROLA: zasięg ±1 cm | — | linia wspólna z drugą bryłą, dach z połaci → UNSUPPORTED |
| wiązanie świadka (`SET_PARAMETER`) | `correct/resolve.ts` (resolver 1.0.0) | znak drukowany z ramką tekstu | sonda z punktu kontrolnego (`roof-main` z przekroju garażu) → `WITNESS_NOT_LOCATED`; kontrpróby §4 z wykonującymi się odpowiednikami | testy `resolve-v35417` (9) | — | znak na przekroju nie wiąże się w modelu wielobryłowym (brak rejestracji przekroju) |
| hipoteza orientacji (§6) | `orientationOf` / wybór w `bindBuildMassing` | zgodność okapów między widokami | **DEV Alaska**: TURNED_90 (jak podpisano 2,4 / 6,36 / 6,34 m; obrócone 4,0 / 3,82 / 3,81 m); **ODTWORZENIE Ballina**: UNDECIDED → nic nie zaproponowano | test KONTROLA z obróconymi etykietami | — | obrót nazwany, ściany nie przesunięte |

## 1. Co zbudowano (zakres zadeklarowany przed wynikami, ADR `docs/ADR-V35417-MASSING-ROOF-WITNESS.md`)

Zakres wspierany: prostokątna/ortogonalna bryła z rzutu; jeden dwuspad o stałej osi; dwie połączone bryły o niezależnych
wysokościach (dwuspad albo płaska dobudówka). Wszystko inne nazwane jako `UNSUPPORTED` z powodem.

- **Rejestr 1.1.0** (`correct/registry.ts`): `BUILD_MASSING`, `SET_ROOF`, `SET_OUTLINE` — każda z konsumentem, miarą,
  polami (`roofKind`, `roofPolygon`, `side`, `wallLeftX/RightX`, `groundY`) i linią promptu generowaną z rejestru;
  kontrakt recenzenta 0.5.0 / prompt 0.6.0. Wykonawca 1.2.0 (`execute.ts`): miara `CUSTOM`, rejestracje i atomowa edycja
  na patchu. Dyspozycja w tej samej transakcji co otwory/kominy; grupy stoją albo upadają razem.
- **Obserwacje bez good.run** (`massing/massing.ts`): obrys (`OutlineObservation`), sylwetka elewacji
  (`SilhouetteObservation`: `groundRow`, strefy ścian, połacie); elewacja rejestrowana przez szerokość obrysu na swojej
  stronie (nie przez dach modelu — brak pętli rejestracja↔korekta), pion = poziom (`DISPLAY_ASSUMPTION`, sprawdzany
  zgodnością widoków); podział L w linii, na której elewacja ma skok; forma dachu z trójkąta/pasa per strona.
- **Odczyt obrysu rzutu** (`consult/plan-outline.ts`, `plan-outline/1`): jedno żądanie na wybrany rzut parteru,
  ortogonalizacja (krawędź > 8° od osi → odmowa), metry wyłącznie przez skalę zmierzoną przez LOCAL (STRONG/CONFIRMED).
- **Bramka 1.2.0** (`correct/source-gate.ts`): `compareRegions` — co pokrywa tylko propozycja i co tylko model, wobec
  dominującego koloru tła ramki; pudełka i otwory bez zmian bajt w bajt. CPU: 11,7 ms/wywołanie (ramka 1024 × 683),
  zapis krawędziowy `comparePolygons` 113 ms (`results/gate-cpu.json`).
- **Resolver świadka 1.0.0** (`correct/resolve.ts`): świadek i cel na tej samej bryle (miejsce znaku przez rejestrację
  ramki; bryły z pierścieni + dachów/połaci; dach bez pierścienia to bryła); nazwy nic nie rozstrzygają; odniesienie
  `TERRAIN`/`STRUCTURAL_LEVEL` → `DATUM_MISMATCH`.
- **Kanał szkicu** (`roofProposalsFromSketches`): każdy szkic wobec każdej bryły; jeden `SET_ROOF` na bryłę, gdy brak dachu
  albo forma/oś/obrys się nie zgadzają.
- **Ścieżka bez modelu** (`consult-analysis.ts`): obrys + szkice → `BUILD_MASSING` na pustym modelu → model + scena w
  `ConsultedAnalysis.massing` (jeden rejestr proweniencji: `evidenceSources` + `evidence` per właściwość).

## 2. Dowody offline (§8) — tolerancje ustalone przed wynikami

`packages/analysis-service/test/massing-v35417.test.ts` (19), `resolve-v35417.test.ts` (9), `plan-outline-v35417.test.ts` (3);
domy kontrolowane malowane w teście (cztery elewacje), tolerancje `PLAN_TOL 0,15 m`, `HEIGHT_TOL 0,25 m`,
`MASSING_TOLERANCES` w kodzie.

| Przypadek | Wymagany efekt | Wynik | Kontrpróba | Wynik |
|---|---|---|---|---|
| brak modelu | rzut + elewacje → bryła + dach → siatka, bez good.run | 2 bryły, GABLE X + FLAT, kompiluje się, `sourceVerified` true, nic SOURCE_EXACT | brak linii gruntu na każdej elewacji | `MASSING_MISSING_ANCHORS: ELEVATION_SILHOUETTE`, rewizja bez zmian; brak obrysu → `NO_OUTLINE` (brak danych ≠ brak czytnika); jedna elewacja → wysokości TRACE_UNCERTAIN |
| zły dach | forma z tych samych źródeł, spójne profile i otwory | płaski→GABLE X (z frontu: pas; z boku: trójkąt — ta sama oś), ściany FOLLOW_ROOF, okno i id zachowane | zła propozycja wobec dobrego dachu (płaski; obrócona kalenica) | odrzucona przez źródło, rewizja bez zmian; okno ponad nowym okapem → `OPENING_ABOVE_EAVES` (cały patch) |
| dwie bryły | dwie poprawne kalenice to nie spór | GABLE X 6,0 m + GABLE Z 4,6 m, oba zbudowane | ta sama liczba z drugiej bryły | `HOST_NOT_BOUND`; nad bryłą główną → COMMITTED |
| zmiana obrysu | skrzydło/uskok wchodzi | brakujący garaż dodany (0 kolateralu); bryła wydłużona 8,4→10 m | drzewo obok | nie zatwierdzone; rewizja bez zmian |
| niezależność | dobre i złe rozliczone osobno | dobry SET_ROOF COMMITTED, zły SET_OUTLINE odrzucony | ta sama para w grupie | `GROUP_ROLLED_BACK`, rewizja bez zmian |
| jakość/dane | A1–A4, trwałe id, kształt/rodzaj, źródło vs przegląd, hash, relacje gospodarza | outline + dach w grupie: wszystkie id ścian, dachów, pierścieni, narożników przeżywają | nieaktualny `baseRevision`; kopertowy | `STALE_REVISION`; `HIP_ROOF` (UNSUPPORTED) |

Kontrpróby wiązania (§4), każda z wykonującym się odpowiednikiem: równy kąt na innym dachu; tekst gospodarza zgodny, cel
w innej bryle; dwa dachy jednej bryły (jedna bryła — wiąże); kilka brył z połaciami i bez dachów; zmienione odniesienie;
liczba bez roli; znak bez miejsca / na przekroju.

## 3. DEV (znane porażki)

Łańcuch: źródło? → odczytane? → związane? → konsument? → zbudowane? → bloker.

| Dom | Źródło | Odczytane | Związane | Konsument | Zbudowane | Bloker |
|---|---|---|---|---|---|---|
| Layla (ARCHON) | 8 ramek rzutu, przekroje, 4 elewacje | TAK: obrys 10 narożników (MAIN, GARAGE) w skali 2,991 cm/px STRONG; 158,5 m² vs 184,87 m² | TAK: 4 szkice | `BUILD_MASSING` | NIE | **funkcja**: trzy prostokąty w uskoku poza zakresem ≤ 2 brył (nie brak danych, nie brak czytnika) |
| Alaska (Studio Atrium) | 2 rzuty, 4 elewacje | TAK: 3 szkice z połaciami | TAK, pod hipotezą TURNED_90 | `SET_ROOF` | TAK: GABLE X, 7,48 m / 41,4° | — (otwarte: rytm okien, okna dachowe, kominy — UNSUPPORTED) |

Recenzent na żywo (Sonnet 5.5, transport hosta, cache 5 min; Alaska): jedno spojrzenie, ISSUE_FOUND z 2 defektami
UNSUPPORTED, bez propozycji; SET_ROOF z kanału szkicu rozliczony CLOSED_VERIFIED. **`continues`/`resolved` nie zostały
sprawdzone na żywo**: jedno spojrzenie bez propozycji nie wywołuje drugiego, a te pola dotyczą defektów poprzedniego
spojrzenia (nazwane, nie zamknięte).

## 4. Odtworzenia (0 USD)

- Kanał szkicu Ballina (10 decyzji v3.54.16): **identyczny** na zamrożonym kodzie — te same 10 rekordów, ten sam model
  `fa31a591…`. Nowy kanał dachu na Ballinie milczy: widoki nie zgadzają się co do okapu w żadnym przypisaniu stron
  (orientacja UNDECIDED) — brak propozycji, nie zgadywanie (`results/replays.json`).
- Sonda punktu kontrolnego `target-host-probe`: odtworzona w teście i odrzucona (`WITNESS_NOT_LOCATED`).

## 5. Próba zamrożona

Reguła zapisana przed biegiem (`research/source-to-model/v35417/trial/TRIAL_SELECTION.md`), ziarno z commita zamrożenia
`be023c9`. Trzy poprawki zapisane jawnie **przed jakąkolwiek analizą** (tylko pobranie pakietu): format klucza
wykluczeń (pierwsze przejście wybrało rodzinę DEV Layla), wyczerpana pula ARCHON (0 niewidzianych rodzin), warianty jednej
rodziny (Aurora-maxi-ii-sz to wariant Aurora-maxi-ii-bis-sz). Wybrane: **Aurora-maxi-ii-bis-sz** i **Aurora-midi-ii**
(Studio Atrium, obie spoza dominującego wydawcy). Pierwsze wyniki: §6.

## 6. Host (jeden końcowy commit `14a34bf`)

Zbudowany z `14a34bf` (`apps/analyzer-api/dist/server.mjs`), pilot z kluczem z sekretu hosta, strict + fallback, cache
5 min; księgi hosta otwarte 27,877317 USD pod pułapem 28,854612 USD; 18 żądań, 0,66554 USD (`results/host-e2e.json`,
`results/host-e2e.log`).

| Zadanie | Wynik | Mechanizm bryły/dachu | Jakość |
|---|---|---|---|
| Alaska (token) | COMPLETED, model `f0c3b54b…` | **SET_ROOF** bryły głównej ZATWIERDZONY i DOSTARCZONY: GABLE X, 42,7°, okap 4,19 m, kalenica **7,84 m** (strona 7,68 m, 40° — nieczytane przez mechanizm; +0,16 m w tolerancji 0,25 m); bramka REGION PROPOSED (78 %), zbudowana bryła 97 % materii rysunku. Dobudówka: propozycja 87,1° (rejestracja własną wąską szerokością) odrzucona przez jądro (pochylenie ≤ 85°) i wycofana — **brak sprawdzenia wiarygodności w bindzie (nazwane)** | NEEDS_EVIDENCE: 9 różnic otwartych (1 KEY), 1 zamknięta na zweryfikowanej rewizji |
| Alaska (powtórka) | REUSED, 8 odpowiedzi odtworzonych | ten sam model i scena bajt w bajt | **0 USD, 0 żądań**; stan jakości i lista defektów zachowane |
| bez tokenu | RECONSTRUCTION_FAILED (sam LOCAL odmawia Alaski) | — | **0 USD, 0 żądań** |
| **PRÓBA** Aurora-maxi-ii-bis-sz | COMPLETED, model `01e6b86d…` | żadna propozycja bryły/dachu nie została zachowana (dwuspad LOCAL stał; szkice PARTIAL) | UNSUPPORTED_OPERATION: 8 różnic otwartych (1 KEY) |
| **PRÓBA** Aurora-midi-ii | FAILED `ANALYSIS_FAILED` po 1 żądaniu (odczyt metryczny, 0,034858 USD) | — | łańcuch: źródło TAK; odczyt TAK (1 odpowiedź); potem niesklasyfikowany wyjątek ścieżki konsultanta przed jakimkolwiek żądaniem szkicu; LOCAL sam buduje model offline (17,35 × 7,735 m, kalenica 5,03 m), ścieżka konsultanta bez transportu kończy się offline — awaria wymaga odpowiedzi na żywo, której host nie zapisuje (**luka: zapis odpowiedzi konsultanta nieudanego zadania**) |

Uprząż: 4 linie FAIL — 3 to skopiowane z v3.54.16 oczekiwanie `registry === '1.0.0'` (host podaje 1.1.0 = poprawnie;
uprząż poprawiona po biegu, tylko skrypt badawczy), 1 to brak zatwierdzonego patcha w próbie Aurora-maxi (prawdziwy
pierwszy wynik). Wyniki próby nie były strojone.

## 7. Koszty

Księgi otwarte 27,812357 USD; pułap 28,854612 USD; pula etapu 1,042255 USD (bez nowej puli; saldo panelu nie jest limitem).
Plan żądań z kosztem maksymalnym zapisany przed biegiem (`research/source-to-model/v35417/LIVE_PLAN.md`).

| Faza | Żądania | USD |
|---|---|---|
| odczyt obrysu Layli (Opus 5.5) | 1 | 0,015928 |
| recenzent na żywo, Alaska (Sonnet 5.5) | 1 | 0,049032 |
| host (Alaska, powtórka, bez tokenu, 2 rodziny próby) | 18 | 0,665540 |
| **razem etap** | **20** | **0,730500** |

Księgi po etapie: **28,542857 USD** pod pułapem 28,854612 USD (pozostało 0,311755 USD).

Uwaga: dwa równoległe przebiegi zapisały księgi każdy ze swojej kopii; wpis recenzenta został odtworzony z
`check-turns.json` (koszt policzony z cennika = 0,049032 USD), a `ledger.ts` scala teraz przy każdym zapisie i sprawdza
księgi z dysku przed rezerwacją.

## 8. Macierz testów

Zamrożenie: 4416 passed / 18 failed (16 znanych bazy + 2 w `worker.test.ts`, który przy pełnym obciążeniu przekracza czas,
a sam przechodzi 3/3); końcowa: **4418 passed / 18 failed** (te same 16 + `worker.test.ts`; +2 to test scen v3.54.17);
baza 4396 / 16 (`results/matrix-freeze.txt`, `results/matrix-final.txt`). Typecheck czysty. Android `testDebugUnitTest`:
479 testów, wszystkie przechodzą (po przesunięciu pozycji scen o 3 w `OwnerCheckpointV35410ScenesTest`).

**APK 1348** (`BuildPlan-Model-Preview-1348-arm64-v8a.apk`, sha256 `c959d673…e1324`, z `ceb8a36`, podpis v2 klucza
podglądu, certyfikat `6e48fac4…ca0da`): sceny `alaska-host-v35417`, `alaska-dev-v35417`, `aurora-maxi-trial-v35417` są
pierwsze w indeksie i bajt w bajt równe plikom w repozytorium (sprawdzone po rozpakowaniu APK).

## 9. Co aplikacja buduje, co umie poprawić, czego jeszcze brakuje

- **Buduje**: z rzutu w zmierzonej skali i czterech elewacji — prostą bryłę albo dwie połączone, z dachem dwuspadowym albo
  płaskim, bez modelu LOCAL; każda liczba z proweniencją (nic nie udaje SOURCE_EXACT).
- **Poprawia**: brakujący lub błędny dach bryły (w tym płaski→dwuspad), zasięg bryły wzdłuż strony, brakującą bryłę;
  wiąże wartość drukowaną z właściwą bryłą po miejscu znaku, nie po nazwie.
- **Brakuje danych**: elewacji z linią gruntu (bez niej nic się nie buduje), skali rzutu (bez niej obrys zostaje w pikselach).
- **Brakuje funkcji**: bryły z ≥ 3 prostokątów (Layla), dachu kopertowego/mansardowego, rejestracji przekroju jako strony,
  oddania przez host modelu zbudowanego bez LOCAL (koperta wyniku), sprawdzenia `continues`/`resolved` na żywo,
  sprawdzenia wiarygodności pochylenia w bindzie `SET_ROOF` przed komendą (host: 87°, odrzucone dopiero przez jądro),
  zapisu odpowiedzi konsultanta dla nieudanego zadania hosta (Aurora-midi-ii nieodtwarzalna offline).

## 10. Werdykt

- **Minimum §5 działa** w zadeklarowanym zakresie: utworzenie bryły z pustego modelu, zmiana zasięgu, dach na wskazanej
  bryle (także płaski→dwuspad), z zależnymi (profile ścian, otwory, regiony, obrys dachu, stropy, pomieszczenia),
  atomowo i z bramką źródła; dowody §8 z kontrpróbami przechodzą offline.
- **Host z jednego commita pokazał mechanizm**: Alaska `roofs: []` → dwuspad bryły głównej, oddany przez publiczne
  wejście; powtórka 0 żądań; brak tokenu 0 żądań. MINIATURA: rozpoznawalna (kalenica wzdłuż długości, wysokość
  w tolerancji); METRYKA: nie twierdzimy dokładności (pion z założenia izotropii rysunku, sprawdzany zgodnością widoków);
  WNĘTRZE: bez zmian.
- **Próba**: 2 rodziny Studio Atrium — jedna z modelem bez zatwierdzonej korekty, jedna z awarią po odczycie metrycznym
  (nazwaną); żadnej poprawy w próbie, którą można by przypisać nowemu mechanizmowi. Layla (DEV) — nazwany brak funkcji.
- **Akceptacja**: minimum §5 i dowody §8 — tak; ogólność na nowych rodzinach — niepokazana.
