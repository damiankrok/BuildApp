# STAGE BUILDPLAN LINK-F1C — spójny model po imporcie, bez regresji F1B

| pole | wartość |
|---|---|
| gałąź | `claude/new-session-3kzcgh` |
| baza | `d9bc4ef9b2077c602622dfeb28f9cbf97b1d6912` (LINK-F1B); zdalny HEAD = baza, drzewo czyste, brak późniejszych zmian |
| wersje | solver v2 `2.19.0 → 2.20.0`; kompilator geometrii (bez numeru wersji) zmieniony w dwóch regułach; layout 1.3.0, model 1.7.0, usługa analizy 1.5.0, `assessment` bez zmian |
| zakres kodu | `packages/geometry/src/architecture-compiler.ts` (szczyt ściany pod koszem), `packages/geometry/src/roof-compiler.ts` (spawanie linii cięcia), `packages/reconstruction/src/v2/openings-v2.ts` (węgarek przy licu sąsiedniej ściany), `reconstruct-v2.ts` (wersja), test kontraktu `apps/analyzer-api/test/support/contract-shape.ts` |
| testy nowe | `geometry/test/valley-wall-top-link-f1c.test.ts`, `geometry/test/roof-cut-weld-link-f1c.test.ts`, `reconstruction/test/end-jambs-link-f1c.test.ts`, `reconstruction/test/wall-strip-source-link-f1c.test.ts`, `analyzer-api/test/contract-shape.test.ts` |
| poza zakresem | F2, N9-02S, APK/Android, ML, renderer, finanse, UI, nowe rodziny budynków, odświeżanie snapshotów |
| artefakty tekstowe | `stage-reports/artifacts/analyzer-link-f1c/` |
| ZIP prywatny | `BuildPlan-LINK-F1C-Source-Before-After.zip` — poza Git; § 8 |
| werdykt | **PASS** (z nazwanymi ograniczeniami, § 9) |

## 0. Wynik w jednym akapicie

Korzyści F1B zostały (brama Sasanek, drzwi poddasza Jarzmianek, przednie drzwi Rarytasów, szczeliny ściana wspólna ↔
strop, usunięte fantomy) — rodziny, hosty i liczby ścian identyczne z F1B w 8/8. Oba nowe ERROR F1B zniknęły, nowe
defekty siatki dachu Jarzmianek także, i przy okazji tej samej przyczyny zniknęły cztery starsze ERROR (Rarytasy ×2,
Sasanki ×1 — ten sam mechanizm kosza; Trytomy — ostrzeżenia dachu tego samego mechanizmu co Jarzmianki). ERROR
zewnętrzne: **F1 15 → F1B 13 → F1C 8**; żadnego nowego względem F1 ani F1B; wszystkie 8 pozostałych istnieją od F1.
Uwaga korygująca: raport F1B podał dla F1 liczbę 17 — prawidłowo jest 15 (`closure-exterior-f1-f1b-f1c.txt`).

## 1. FIRST_BAD i rozwiązania

### 1a. Cieszynianki — `COPLANAR_DUPLICATE pocket-main-0-1-back + pocket-main-0-2-back` 0,5793 m²

Łańcuch: rzut → szczelina okna w tylnej ścianie kieszeni narożnej → odczyt przerwy → emisja otworu → kompilacja → closure.

- Rzut (`…0459d5961d`): ściana tylna ma tusz w kolumnach 195–209, potem nic aż do lica ściany bocznej w kolumnie 289.
  Okno **rzeczywiście sięga lica ściany bocznej** (profil wierszy 250–262: tusz tylko w kolumnach 195–209 i od 289).
- Ściana tylna kieszeni biegnie między licami ścian, do których przylega (`endsAtFaces`), więc okno odczytu kończy się
  dokładnie na licu; piksel 289 przez wspólną mapę wraca jako 0,12 mm przed końcem ściany. **Pierwsza błędna decyzja:**
  emisja otworu 0,000121 m od końca ściany — model wymaga muru po obu stronach otworu (`OPENING_TOUCHES_WALL_EDGE`),
  więc kompilator zostawia pasek muru 0,12 mm, a jego ościeże leży w płaszczyźnie lica ściany sąsiedniej (0,596 m²
  `WALL_REVEAL` w płaszczyźnie x = 2,593). W F1 ten sam otwór zaczynał się 5 cm od końca — przypadkiem liniowej ramy.
- Rozwiązanie (`endJambs`): na ścianie między licami otwór narysowany do lica zachowuje węgarek
  `OPENING_END_JAMB_M = 0,05 m` własnej ściany (`ASSUMED_FOR_RENDERING`, z powodem w evidence). Szerokość odczytana
  z rzutu jest zwężana od strony lica; **szerokość wydrukowana jest zachowana** — otwór przesuwa się z lica, gdy drugi
  koniec ma miejsce (Rarytasy: drzwi w ścianie wspólnej, opis 100/210, przesunięte 4,3 cm, szerokość 1,00 bez zmian).
- Wynik: Cieszynianki bez znalezisk zewnętrznych; okno 2,034 m (odczyt 2,121 m), węgarek 5 cm z obu stron.
  Goździkowce: ta sama geometria co w F1B (stara reguła wnęki już dawała 5 cm), teraz z jawną proweniencją.

### 1b. Rarytasy — `INTERSECTION ring-main-0-w0-party-attached-0 + roof-attached-0-plane-high` 0,0028 m³

- Geometria: dach garażu to dwuspad, którego połać wysoka wchodzi koszem w połać główną (linia kosza x + z = 15,02).
  Ściana wspólna (od F1B na narysowanym paśmie z 6,456–6,725) przecina kosz przy wschodnim końcu: kosz wchodzi przez
  lico (x 8,295) i wychodzi przez czoło ściany (x 8,381).
- **Pierwsza błędna decyzja (kompilator):** szczyt ściany `FOLLOW_ROOF_PLANES` liczony był tylko na dwóch licach
  i prowadzony prosto między nimi. Nad koszem (najniższa linia powierzchni) taki szczyt wychodzi ponad połać — do
  8,7 cm w teście syntetycznym. Ten sam mechanizm dawał dwa starsze ERROR na `ring-main-0-w0-1` (F1) i
  `ring-main-1-w1-party-attached-0 + roof-main-plane-high-1` w Sasankach.
- Rozwiązanie (`wallTopUnderPlanes`): na odcinku, na którym krawędź połaci przecina grubość ściany (także gdy wychodzi
  przez czoło), każdy przekrój ma szczyt równy najniższemu spodowi nad nim (lica i kosz); próbki co ¼ pasma. Poza
  pasmem szczyt bez zmian. Test: lustrzana para koszy, kosz wychodzący przez czoło, kontrola bez kosza (szczyt dokładnie
  na połaci). Stary kompilator nie przechodzi 3 z 6 przypadków.

### 1c. Jarzmianki (i Trytomy) — SLIVER_TRIANGLES / NON_MANIFOLD dachu

- Okna dachowe jednego rzędu liczą krawędź każde osobno: 1,157612 vs 1,157613 (Jarzmianki), 6,052314 vs 6,052315
  (Trytomy). `uniqueSorted` kompilatora dachu z EPS 1e-9 zostawiał obie linie: pas 1,3 µm na całej połaci.
- Rozwiązanie: linie cięcia jednego dachu bliższe niż `ROOF_CUT_WELD_M = 0,1 mm` są jedną linią, krawędzie otworów
  dociągane do niej (wspólne krawędzie komórek i ościeży bez zmian). Jarzmianki 112/45 → 0/0, Trytomy 76/21 → 0/0.
  Test: rząd okien 1 µm (stary kompilator: 26 otwartych krawędzi, 48 sliverów), kontrola 1 mm (dwie linie, zamknięty).

### 1d. Marcówki — `balcony-front-1 + roof-attached-0:fascia-min-z` większa miara (0,0372 → 0,0451 m², 0,0157 → 0,0191 m³)

Balkon kończy się na obrysie bryły x = 7,9, a pas okapowy dachu garażu zaczyna się na dalszym licu ściany wspólnej:
7,8785 (F1) → 7,8740 (F1B, ściana na narysowanym paśmie). Zakładka 21,5 → 26,0 mm; obie miary są jej dokładnymi
wielokrotnościami (0,0372/0,0215 = 0,0451/0,0260 = 1,73 m wysokości pasa; 0,73 m² przekroju). To istniejący od F1
defekt (balkon za licem niosącym dach garażu); F1B przesunęło lico o 4,6 mm. **Nie naprawiony w F1C** — zakres.

## 2. Hipotezy fazowe Jarzmianek — wpływ na finalne otwory

`artifacts/analyzer-link-f1c/phase-hypotheses-jarzmianki.json`. Każdy odczyt z 49 faz przeliczono z powrotem na piksel
zawiasu ramą tej fazy:

| drzwi | odczyt | piksel zawiasu | promień px | fazy |
|---|---|---|---|---|
| door-1-1 | krótkie skrzydło | 508 | 40 | 48 |
| door-1-1 | pełna szerokość (zastępczy zawias = dolne ościeże) | 549 | 44 | 1 |
| door-1-5 | krótkie skrzydło | 401 | 42 | 48 |
| door-1-5 | pełna szerokość | 361 | 47 | 1 |
| door-1-2 | krótkie / pełna | 516–520 | 44 / 46 | 34 / 15 |
| door-1-3 | krótkie skrzydło | 419 | 39 | 49 |

„3,736856 m” i „3,639312 m” to **dolne ościeża szczelin** — `doorSwingInGap` zwraca je jako zawias zastępczy, gdy
`swingDrawn` znajduje skrzydło długości szczeliny. Łuk krótkiego skrzydła z zawiasem 508 px i promieniem 40 px sięga
548 px, czyli drugiego ościeża — to ten sam narysowany symbol. Drzwi wewnętrzne biorą `from/to/at` i gospodarza
**wyłącznie ze szczeliny** (`interior.ts`, `doors.push`); zawias i promień trafiają tylko do zdania w evidence („a 0.85 m
leaf, shorter than the gap”). Wpływ na otwór, rodzinę i gospodarza: brak; dowód wystarcza, przyczyny nie usuwano.

## 3. Kontrakt `quality.byFamily`

`byFamily` (oraz `counts.assetsByDocument`, `assessment.sourceUnchecked.counts.byKind`) to na telefonie
`Map<String, …>`: klucze są danymi. Test „legacy members” wymagał klucza `INTERIOR_WALL`, którego Larchfield (dom
syntetyczny bez ścianek) nie ma od usunięcia fantomów. Zmiana: członek-słownik pozostaje wymagany, jego klucze nie są
członkami, a wartości muszą mieć typ parsowany przez telefon (`dictionaryViolations`). `links` zostaje zwykłym obiektem —
jego klucze (`self`, `result`, `scene`, `model`) telefon śledzi. Testy `contract-shape.test.ts`: brak rodziny, pusty
słownik, nowy klucz (OK); brak całego `byFamily`, brak `levels`, brak `links.scene`, wartość nie-słownik, ułamek,
`null`, napis zamiast liczby (odrzucone). Snapshot `status-completed.json` był przestarzały już w bazie F1 (wersja
solvera) i nie został odświeżony (zakaz automatycznego odświeżania goldenów).

## 4. Wall-strip — zgodność ze źródłem syntetycznym

`reconstruction/test/wall-strip-source-link-f1c.test.ts` liczy oczekiwania **z pikseli rysunku fikstury** (lica
60..660 × 60..420, łańcuchy 5 cm/px), nie z zapisu czytnika:

- wiata: zwroty dokładnie na narysowanych ścianach (kolumny 400–417 → x 17,0–17,9; 560–577 → 25,0–25,9), 5 m w głąb;
- filar 40 px: jeden zwrot pokrywający filar (12,0–14,0);
- słupki: trzy zwroty, każdy na swoim słupku;
- ścianka (kolumny 300–307) w swoim paśmie, w dwóch kawałkach po obu stronach drzwi z wierszy 200–240 (z 8,95–11,0).

Tolerancja: 1 px w skali łańcuchów. Ograniczenie: grubość ścianek w tych fiksturach liczona jest skalą rejestracji
(0,026 m/px), sprzeczną z łańcuchami (0,05) — sprzeczność samej fikstury; pozycje i przerwy odpowiadają rysunkowi.

## 5. Kontrole źródłowe

`artifacts/analyzer-link-f1c/source-controls.json` — trzy wyniki trzymane osobno: ABSENT / NOT_CONFIRMED / NOT_CHECKED.

| cecha | klasyfikacja | dowód |
|---|---|---|
| Rarytasy komin 2 → 1 | **NOT_CONFIRMED** | blok na rzucie (wiersze 445–459, na ścianie wspólnej) jest odczytany; komin wymaga słupa ≥ 0,4 m nad połacią na renderze — 3/26 i 3/27 kolumn ma długie biegi, reszta 2–4 px (prawdziwy komin: 36 px prawie wszędzie). F1 przyjął go na jednej kolumnie obok błędnego środka. Nie przywrócony. |
| Arganie `rear-2-1` | **NOT_CONFIRMED** | drzwi w tych samych pikselach rzutu (kolumny 327–368) w F1 i F1B/F1C; metry przesunięte o 4 cm przez mapę łańcuchów; elewacja tylna zarejestrowana liniowo między końcami ścian trafia teraz na ciemne pasmo 0,73–1,35 m i R5 je paruje (CONFLICT). Model niezmieniony. |
| Rarytasy `east-5-0` | **NOT_CHECKED** | elewacja prawa ma sporną rejestrację pionową we wszystkich biegach — żadne sprawdzenie nie liczy się ani przed, ani po. Drzwi w tych samych pikselach (513–549); metry +11 cm (drabina Y ~2 % ściśnięta), więc liniowo zarejestrowana elewacja nie widzi już otworu ≥ 0,5 m nad nowym przedziałem i nie zapisuje nawet surowej rezyduy. |

**Pierwsza nierozwiązana przyczyna obu zmian R5:** elewacje są rejestrowane wzdłuż liniowo między końcami ścian, a rzut
od F1B mapą łańcuchów; ta sama ściana ma w nich różną skalę wewnątrz. Nie zmieniano rejestracji elewacji w F1C.

## 6. Regresja ośmiu domów (jedno przejście na kodzie końcowym)

Produkcyjny `runAnalysis` (`second-house.ts`), te same zapieczętowane wejścia DEV i cache bajtowy co F1 i F1B;
Rarytasy to DEV `m84f2903cb8e14`, nie holdout. 8 × exit 0, 190–356 s. `artifacts/analyzer-link-f1c/regression-8-houses.json`.

| dom | rodziny / hosty / ściany vs F1B | model | scena | replay | odmowy | ERROR F1 / F1B / F1C |
|---|---|---|---|---|---|---|
| Jarzmianki | bez zmian | = | ≠ (spawanie dachu) | BYTE_IDENTICAL | 0 | 1 / 1 / 1 |
| Goździkowce | bez zmian | ≠ (proweniencja okna kieszeni) | ≠ | BYTE_IDENTICAL | 0 | 0 / 0 / 0 |
| Marcówki | bez zmian | = | = | BYTE_IDENTICAL | 0 | 4 / 2 / 2 |
| Cieszynianki | bez zmian; okno kieszeni 2,121 → 2,034 m (węgarki) | ≠ | ≠ | BYTE_IDENTICAL | 0 | 0 / 1 / **0** |
| Rarytasy | bez zmian; drzwi wspólne przesunięte 4,3 cm (szerokość 1,00) | ≠ | ≠ | BYTE_IDENTICAL | 0 | 2 / 3 / **0** |
| Trytomy | bez zmian | = | ≠ | BYTE_IDENTICAL | 0 | 2 / 2 / 2 |
| Arganie | bez zmian | = | = | BYTE_IDENTICAL | 0 | 3 / 3 / 3 |
| Sasanki | bez zmian | = | ≠ | BYTE_IDENTICAL | 0 | 3 / 1 / **0** |

Pozostałe 8 ERROR (wszystkie istnieją od F1): Jarzmianki pergola ↔ ściana; Marcówki balkon ↔ pas okapowy ×2 (§ 1d);
Trytomy pergola ×2; Arganie ściany garażu ↔ dach ×3. Ostrzeżenia dachu: Jarzmianki 0, Trytomy 0 (wcześniej 76 + 21).
Nieporównane pozycje źródła i konflikty R5 jak w F1B (Arganie 1 CONFLICT, Rarytasy 2 CONFLICT — § 5).

## 7. Testy

Uruchamiane osobno (bez równoległego obciążenia; jeden bieg wszystkich pakietów naraz został przerwany restartem
kontenera i powtórzony partiami). `npx tsc -p tsconfig.json --noEmit` czysty.

| pakiet | pliki | testy | czerwone | stan bazy |
|---|---|---|---|---|
| `packages/geometry` | 17 | 117 | **0** | — (2 nowe pliki testów) |
| `packages/reconstruction` | 102 | 1231 | **0** | 0 |
| `packages/analysis-service` + `tests/architecture` | 43 | 556 | 11 | te same 11 architektury (compound-facade 1, reference 2, research-isolation 4, wall-strip 4) |
| `apps/local-analyzer` + `apps/analyzer-api` | 9 | 108 (7 pominiętych) | 6 | wszystkie istniały w bazie F1: przestarzały snapshot `status-completed.json`, `/health` (wersja), worker ×2, Larchfield program, NFD |

Nowy czerwony test F1B (legacy members, `INTERIOR_WALL`) jest zielony. Testy przyczyn nie przechodzą na starym kodzie:
kosz — 3/6 czerwonych (przewyższenie do 8,7 cm), spawanie — 26 otwartych krawędzi i 48 sliverów; kontrole negatywne
(ściana bez kosza, linie 1 mm, otwór z dala od lica, szczelina węższa niż dwa węgarki) przechodzą w obu wersjach.

Polecenia: `npx vitest run packages/geometry`, `… packages/reconstruction`, `… packages/analysis-service tests/architecture`,
`… apps/local-analyzer apps/analyzer-api`; regresja `research`-owym `regress.sh` = `packages/analysis-service/scripts/second-house.ts`
dla 8 domów; closure `research/analyzer-link-f1/closure-findings.ts`; sondy `research/analyzer-link-f1/roof-defects.ts`,
`research/analyzer-link-f1b/coplanar-pieces.ts`.

## 8. Dostawa

| element | wartość |
|---|---|
| baza | `d9bc4ef9b2077c602622dfeb28f9cbf97b1d6912` |
| commit 1 (zmiana zachowania + testy przyczyn) | `fd14f2b0323d36426942a0dfba39078f3cc1cf97` — kompilator geometrii, czytnik otworów, solver 2.20.0 |
| commit 2 (kontrakt testowy) | `23f742e13432a6aa7205dd92fa9882c15585d70d` — słowniki kontraktu Androida |
| commit 3 (raport) | commit niosący ten raport, artefakty, sondę `coplanar-pieces.ts` i `PROJECT_STATUS.md` (końcowy HEAD) |
| push | wyłącznie `claude/new-session-3kzcgh`, każdy commit z `[skip ci]`; bez merge, bez workflow |
| nie uruchamiano | pełnego CI, APK, Androida, ML, F2, N9-02S, odświeżania snapshotów |
| ZIP | `BuildPlan-LINK-F1C-Source-Before-After.zip` (poza Git: `.git/info/exclude`), udostępniony OWNER-owi jako załącznik w sesji; rozmiar i SHA-256 w odpowiedzi końcowej i w `MANIFEST.json`/`HASHES.txt` |

ZIP: oryginały ARCHON z adresami i SHA-256; modele, `result-summary` i `program.json` F1, F1B i F1C dla 8 domów (24/24
programów z hashem modelu równym `runAnalysis`); rendery 9 kamer F1/F1B/F1C dla wszystkich 8 domów (F1C zbudowany
nowym kompilatorem); wycinki FIRST_BAD; plansze rzutów; mapy F1C z punktami kontrolnymi; odziedziczone dowody F1B
(raport, artefakty, sondy, plansze, wycinki); `MANIFEST.json`, `HASHES.txt`.

## 9. Werdykt

**PASS.** Kryteria odbioru spełnione na końcowym kodzie, jednym przejściem ośmiu domów: oba nowe ERROR F1B i nowe defekty
siatki dachu Jarzmianek usunięte rozwiązaniami ogólnymi (kompilator: kosz pod szczytem ściany, spawanie linii cięcia;
czytnik: węgarek przy licu), bez podnoszenia tolerancji, zmiany severity ani usuwania elementów; korzyści F1B
zachowane (rodziny, hosty, ściany jak w F1B w 8/8); brak nowych ERROR względem F1 i F1B (15 → 13 → 8); hipotezy
fazowe Jarzmianek bez wpływu na otwory (dowód w pikselach); kontrakt słowników naprawiony i pokryty testami.

Ograniczenia (nie ukrywane, nie blokują przyjęcia):
1. **Elewacje rejestrowane liniowo, rzut mapą łańcuchów** — pierwsza nierozwiązana przyczyna zmian R5 (Arganie
   `rear-2-1` NOT_CONFIRMED, Rarytasy `east-5-0` NOT_CHECKED). Kolejny krok, jeśli OWNER go wybierze: rejestracja
   elewacji wzdłuż przez tę samą mapę.
2. **Cieszynianki:** plan drukuje 220/240 przy oknie kieszeni; czytnik nie dopasowuje tego opisu w żadnym z biegów;
   z węgarkami okno ma 2,034 m (F1 2,090, F1B 2,121) — założenie jawne w evidence.
3. **Marcówki balkon ↔ pas okapowy** (2 ERROR od F1) — wyjaśnione w § 1d, nienaprawione.
4. Komin Rarytasów pozostaje niepotwierdzony renderem (NOT_CONFIRMED) — nie przywracany.
