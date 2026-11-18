# v3.54.10 — precyzyjny kontrakt API, właściwe okna i spójne elewacje (Marcówki GE)

Gałąź `claude/new-session-3kzcgh`. Baza: kod / finalny host v3.54.9 `39fec90`, raport `911ecb1`. Rewizje tego etapu:
`397a809` (kontrakt 0.5.0, nowe kroki i konsumenty; host jedynego joba live), `d43eebe` (dwie poprawki konsumenta stref
znalezione na odczycie live), `62350cc` (inwentarz zdolności bez nieistniejących operacji) — **finalny host zbudowany
z `62350cc`**, oraz commit tego raportu.

**Master Plan v3.54.10 nie został dołączony** — przesłano tylko prompt. Prompt zabrania odtwarzania planu ze skrótu,
więc `docs/MASTER_PLAN.md` pozostaje w wersji v3.54.9 (pełna kopia z poprzedniego etapu). To jest jawna rozbieżność do
uzupełnienia przez OWNER-a, nie decyzja.

Wartości wzorcowe (`research/marcowki-v2/marcowki-source-truth-v2.json`) służą wyłącznie ocenie (DEV). Żadna liczba,
nazwa ani domena projektu nie weszła do kodu produkcyjnego ani do pytań API (`AnalyzerPurityTest`, przegląd diffu).

## 1. Osiem odpowiedzi

**1. Co było formatem, co zmiennością percepcji, co semantyką konturu, a co stratą konsumenta — dla każdego okna i pasa.**

| element | v3.54.9 (H) | przyczyna | co zmieniono | live v3.54.10 |
|---|---|---|---|---|
| tylne skośne W/E — szerokość | 2,577 vs 2,34 | **semantyka konturu**: ramka czytana z elewacji obejmowała to, co widać nad balustradą, nie otwór z opisu 234/303 | opis z rzutu (`STOREY.labels`) wiązany z otworem tej ściany → szerokość `PRINTED`; skrajnia przy wysokim końcu (pełna krawędź) zostaje | 2,34 / 2,34 (PRINTED), ościeża ≤ 0,05 m |
| tylne skośne — wysoki koniec | 5,848 vs 6,09 | **semantyka**: widoczna krawędź vs najwyższy punkt otworu w opisie (303 = 6,09 − 3,06) | wysokość z opisu `PRINTED` | 6,09 (PRINTED) |
| tylne skośne — niski koniec | 3,983 (= góra balustrady) | **okluzja**: wiersz końca to krawędź tego, co zasłania | `contour EXPOSED`, `hiddenBelowY`, `hiddenBy` → koniec `ESTIMATED`, nie „widziany” | przed recenzją 0,83 m `ESTIMATED` (W 3,89 vs 4,13 — NO); po celowanym ponownym odczycie elewacji tylnej 1,068 `DERIVED` (źródło 1,07) — OK |
| przednie skośne 270/320 (kontrola) | 2,494 × 6,082 | jak wyżej | opis z rzutu | 2,70 × 3,20 PRINTED — OK |
| przeszklenie tarasowe 470/230 | 4,543 × 2,373, 5 skrzydeł | **percepcja** (ramka ~9 px za wąska) + **konsument** (5 = round(4,54/0,9), konwencja) | `mullionsX` czytane → podział z odczytu; konwencja tylko bez odczytu i nazwana | 4,628 × 2,398, **2 skrzydła** (słupek przy 0,498) — szerokość −0,07, nadproże +0,10; opis 470/230 odczytany, ale **niepowiązany** (rzut parteru nie zarejestrowany, rozdz. 7) |
| rama szczytowa — pas | 0,927 / 0,966 vs 0,82 | **zmienność percepcji** | nic (brak nowego pola) | 0,979 / 0,983 — gorzej; R0 (odpowiedzi v3.54.9 na nowym kodzie) daje model bajt w bajt jak v3.54.9, więc różnica to nowy odczyt, nie kod |
| kominy | 0 z 2 | **konsument**: komin z widoku szczytowego nie ma położenia wzdłuż kalenicy | fuzja widoku szczytowego z bocznym | 0 z 2 — na widoku bocznym oba kominy odczytano jako `OTHER` (element dachu), więc nie ma czego łączyć: **percepcja**; recenzent w rundzie 2 sam napisał „prawdopodobnie kominy”, ale nie ma operacji, którą mógłby to poprawić |

**2. Jakie pola i operacje dodano i które miały skutek na live.** Kontrakt `buildapp.house-reading@0.5.0`: nowe kroki
`DETAILS` (kontur otworu FRAME/GLASS/EXPOSED, `hiddenBelowY`, `hiddenBy`, `mullionsX`, `transomsY`, `doorLeaves`,
strefy wykończenia, kominy) i `STOREY` (obrys kondygnacji, ścianki, drzwi, pomieszczenia z nazwą/numerem/powierzchnią
osobno, schody, otwory stropu, opisy otworów). Operacje recenzji `SET_OPENING_DETAIL`, `SET_ZONE`, `REMOVE_ZONE`.
Skutek na live: opisy (3 powiązane: oba 234/303 i 270/320 — największa zmiana), `contour EXPOSED`+`hiddenBelowY`
(niski koniec ESTIMATED zamiast fałszywie zmierzonego), `mullionsX` (2 skrzydła tarasu), strefy (15 przed / 16 po
recenzji), `STOREY` poddasza (+1 ścianka, +2 pomieszczenia), `SET_ZONE` ×2 (APPLIED). Bez skutku: `transomsY`
(jądro nie ma ślemienia w oknie — zapis `REPRESENTATION_LIMIT`), `doorLeaves` (zapisane), kominy z `DETAILS` (tylko
widoki szczytowe), `STOREY` parteru (nie zarejestrowany), `SET_OPENING_DETAIL` ×2 (`NOT_CONSUMED`: jądro rozstawia
szyby okna równo, ta sama liczba szyb), `SET_ZONE` ściany garażu (`NOT_CONSUMED` — błąd konsumenta, naprawiony po
jobie, rozdz. 6). Pełny inwentarz: `research/source-to-model/v35410/results/reading-capabilities.md`.

**3. Górne tylne okna: kontury, kąty; taras: rozmiar, położenie, podział — błędy surowe.**

| | źródło | v3.54.9 H | live PRZED recenzją | live PO recenzji |
|---|---|---|---|---|
| tylne W: szerokość / ościeża | 2,34; 0,95–3,29 | 2,577; 0,048 / 0,285 | 2,34; ≤ 0,05 | 2,34; ≤ 0,05 |
| tylne W: wysoki / niski / kąt | 6,09 / 4,13 / 39,95° | 5,848 / 3,983 / 35,9° | 6,09 / 3,89 / 43,2° | 6,09 / 4,128 / 39,98° |
| tylne E: wysoki / niski / kąt | 6,09 / 4,13 / 39,95° | 5,848 / 3,983 / 35,9° | 6,09 / 3,89 / 41,96° (w tolerancji 2,5°) | 6,09 / 4,128 / 38,72° |
| przednie: szer. / wys. / kąt | 2,70 / 6,26 / 39,8° | 2,494 / 6,082 / 40,87° | 2,70 / 6,26 / 40,97° | to samo |
| taras: od–do wzdłuż ściany | ≈5,08–9,78 (ościeża wzorca w ramie modelu) | 5,214–9,757 | 5,130–9,758 | to samo |
| taras: szer. × wys. / próg | 4,70 × 2,30 / 0 | 4,543 × 2,373 / 0 | 4,628 × 2,398 / 0 | to samo |
| taras: podział | 2 skrzydła | 5 (konwencja) | 2 (słupek 0,498, odczyt) | 2 |

Kąty liczone z obu końców w ich miejscach (scorer v3 dziedziczy v2). Przeszklenie tarasu nie przeszło przez opis
470/230: szerokość i wysokość pozostały z elewacji (`DERIVED`) — pierwsza strata to obrys kondygnacji parteru
(rozdz. 7).

**4. Strefy i materiały na czterech stronach; rama i portal zachowane.** Live: FRONT 5 (drewno w szczycie i na lewo
od portalu, ciemny tynk pod pasem portalu i garaż), REAR 5 (ciemny garaż, drewno ×2, ciemny panel między skośnymi
przeszkleniami), LEFT 2, RIGHT 4 (ciemna ściana garażu, ciemny panel, pas przy okapie). Paleta `low-poly@1`: jeden
materiał na parę (materiał, ton) — `mat-zone-wood-warm`, `mat-zone-plaster-dark`; jasny tynk = kolor ściany
(strefa niepotrzebna). Strefy są wyłącznie `createSurfaceRegion OUTER`: nie tworzą bryły, ściany ani pomieszczenia;
obrysy, otwory, ramy i portale są identyczne ze strefami i bez nich (test). Strefa `UNSURE` (cień, odbicie) nie jest
rysowana. Wzorzec nie zawiera stref, więc ich zgodności ze źródłem nie oceniam liczbowo — tablica elewacji pokazuje je
obok źródła.

**5. Wnętrze odczytane przez API z rzutów, na kondygnację, wobec LOCAL.** Parter: `STOREY` odczytał 8 ścianek, 6 drzwi,
9 pomieszczeń (nazwy i numery osobno, powierzchni nie odczytano), 8 opisów otworów — **NOT_PLACED**: obrys
kondygnacji odczytano brutto (bez cofnięcia portalu 1,0 m z przodu i 1,03 m z tyłu), więc pokrywa obrys domu w 87,6 %
przy stałym progu 90 %; progu nie podniesiono. Poddasze: 9 ścianek, 9 drzwi, 9 pomieszczeń, schody i otwór stropu —
**PLACED** (94,8 %, skala 1,0000), scalone z importem LOCAL bez usuwania czegokolwiek: +1 ścianka, +2 pomieszczenia
(garderoby). Miara względem pomieszczeń źródła: poddasze 8/9 dopasowanych (LOCAL 6/9), 0 scalonych (LOCAL 2); parter
bez zmian 7/10. Spójność przejść poddasza spadła (4 składowe zamiast 1): drzwi z rzutu nie zostały dodane (+0 drzwi),
więc nowe pomieszczenia nie mają przejścia — otwarte.

**6. Co widział recenzent, co poprawił, co zamknął.** Runda 1: 4 pary strona↔model w ramie elewacji, 2 zbliżenia
(tył, przód), **rzuty obu kondygnacji obok przekroju modelu na 1,2 m bez dachu**, **3 wycinki rzutu wokół opisów**
(oba 234/303, 270/320) z nazwą otworu, z którym je powiązano. Runda 2: 6 par. Usterki: 6 + 5. Zastosowane:
`SET_ZONE` ×2 (drewno tylko na lewo od portalu i w całym szczycie — zamknęło d1 „drewno na portalu”), uzupełnienie
elewacji tylnej (runda 2: niski koniec obu skośnych 1,068 DERIVED). Odrzucone z kodem: uzupełnienie z rundy 1
(`COMPILE_CONFLICT`: scena traciła obiekty), `SET_ZONE` ściany garażu ×2 i `SET_OPENING_DETAIL` ×2 (`NOT_CONSUMED`).
Otwarte: ściana garażu (naprawione w kodzie po jobie; na odtworzeniu tego samego odczytu jest już rysowana od
początku), zwroty ramy widoczne na bocznym dachu, kominy jako `OTHER`, ciemne wypełnienie i słupki tylnych skośnych
(`NOT_MEASURABLE`), przesunięcie otworów lewej elewacji o 7–12 px. Werdykt obu rund `DIFFERS`.

**7. Zmiany kolejności kluczy i list vs zmienność percepcji.** Kolejność kluczy, permutacja listy otworów, odpowiedź
jako tekst JSON zamiast tablicy — wynik identyczny (testy: `canonicalJson`, `stableOpeningOrder`, migracja
`JSON_TEXT@1`); identyfikatory otworów z porządku programu (poziom, x0, y0, x1, rodzaj), dla starych nagrań porządek
odpowiedzi (ich recenzje nazywają te id). Odtworzenie nagrania v3.54.9 na nowym kodzie (R0) daje model bajt w bajt
jak v3.54.9 (`eb7103421a…`). Zmienność percepcji to osobna rzecz: nowy odczyt dał pas ramy 0,98 zamiast 0,93/0,97
i obrys parteru brutto — tego nie maskuje żadna normalizacja.

**8. Co nadal odstaje, co oddano, co sprawdzono niezależnie.** Oddano **LOCAL** (`LOCAL_MEETS_SOURCE`: LOCAL spełnia
każdy fakt źródła, który spełnia opis; 27/27; jakość `QUALITY_FEATURES_CHECKED`). H-PO 21/27 w starej skali 27
wierszy (v3.54.9 22/27): okna skośne — wszystkie końce i kąty w tolerancji (pierwszy raz z odczytu API), taras 2
skrzydła; spadek o 1 wiersz to pas ramy (percepcja). Odstaje: pas ramy (6 wierszy), kominy (0/2), wiązanie opisu
tarasu i całe wnętrze parteru z rzutu (obrys brutto), drzwi poddasza z rzutu, przesunięcia na lewej elewacji.
Niezależnie (bez celu z API) zweryfikowane: liczby względem zapieczętowanego wzorca (scorer v1/v2/v3), regresja na 15
odtworzeniach, host E2E. Weryfikowane tylko wobec celu API: strefy (brak wzorca stref).

## 2. Ustalenia koordynatora — potwierdzone na `911ecb1`

1. Otwór = `kind/box/bodyId/level` (+`headLeftY/headRightY/apexX`); pudełko opisane jako „otwór w ścianie (rama)” —
   potwierdzone; nie było pola konturu.
2. `PlanAnswer` bez pomieszczeń i ścianek (front, wymiary, bryły, strefy otwarte); rzuty górne wysyłane tylko do
   rozróżnienia kondygnacji — potwierdzone.
3. Id `o1..` z kolejności odpowiedzi — potwierdzone (`describe.ts`).
4. FULL/SLIM × STRICT/NON_STRICT zapisywane jako `toolVariant`; parsowanie tekstu→tablicy na najwyższym poziomie
   nadpisywało `call.input`, który *był* `record.answer` (historia surowa nadpisana) — potwierdzone i naprawione
   (`rawAnswer` = głęboka kopia przed normalizacją).
5. Stałe materiały w programie (9) — potwierdzone; teraz paleta stylu dla stref.
6. Szyby = `round(width/0.9)` bez odczytu — potwierdzone; teraz konwencja tylko bez odczytu i nazwana w śladzie.
7. RAKED/POINTED + diagnostyka ręczna 25/27 (v3.54.9) — potwierdzone.

Wyniki rozdzielone: LOCAL i ODDANY v3.54.9 27/27, odtworzenie H-PO 22/27, świeży H-host 16/27; H 15/0, lecz
`BOTH_CONTRADICT` → LOCAL. Wnętrze v3.54.9 = 44 elementy z LOCAL (7/10, 6/9, schody IoU 0,66) — nie odczyt API.

## 3. Przepływ parametrów (źródło → surowe → zwalidowane → znormalizowane → uzgodnione → polecenie → otwór → siatka)

| problem | źródło / opis | surowe (live) | zwalidowane / znormalizowane | uzgodnione (house 0.6.0) | polecenie | po zapisie/odczycie | pierwsza strata |
|---|---|---|---|---|---|---|---|
| tylne skośne W | 234/303 na rzucie poddasza; trapez na elewacji | FACADES o: box 560..695 × 228..342, głowice 342/228; DETAILS: EXPOSED, hidden <342 przez `balc-r`, słupki 648/697, ślemię 270 | bez zmian (schemat zgodny); `JSON_TEXT` nie użyte | szer. 2,34 PRINTED, wysoki 3,03 PRINTED (6,09), niski 0,83 ESTIMATED → po recenzji 1,068 DERIVED; rama 2,577 obok | `cutOpening` trapez + `placeWindow` 2 szyby | ten sam dokument bajt w bajt (`house read twice`) | brak (słupek 697 poza pudełkiem: 2 szyby zamiast 3 — przybliżenie) |
| tylne skośne E | jw. | lustrzane | jw. | jw. (38,72°) | jw. | jw. | jw. |
| przeszklenie tarasowe | 470/230 na rzucie parteru | box 563..836 × 430..572; DETAILS FRAME, słupek 699, `doorLeaves` 1 | jw. | 4,628 × 2,398 DERIVED, podział [0,498] READ; opis `LABEL_NOT_PLACED` | `placeDoor` 2× GLAZED 0,498/0,502 | jw. | rejestracja rzutu parteru (obrys brutto) |
| przednie skośne (kontrola) | 270/320 | box 610..762, głowice 212/340; DETAILS EXPOSED <342 | jw. | 2,70 / 3,20 PRINTED, niski 0,855 ESTIMATED | `cutOpening` trapez | jw. | brak |
| rama szczytowa / portal | elewacje | pas ~58 px | jw. | pas 0,979 / 0,983 | `createGableFrame`, `PORTAL_BAND` | jw. | percepcja (pas) |
| strefy | elewacje (kolor/materiał) | 12 stref na 4 elewacjach | jw.; `UNSURE` nierysowane | 15 → 16 po recenzji; nakładanie różnych wykończeń → `ZONE_OVERLAP` (kod `d43eebe`) | `createSurfaceRegion` | jw. | ściana garażu: konsument (naprawione) |
| wnętrze | rzuty parteru i poddasza | STOREY ×2 | jw. | parter NOT_PLACED (87,6 %), poddasze PLACED (+1/+2) | `createWall INTERIOR`, `createRoom` | jw. | obrys parteru (percepcja) |

Znaczenie opisów (DEV): **234/303** = szerokość otworu 2,34 / wysokość najwyższego punktu nad podłogą poddasza
(6,09 − 3,06 = 3,03); **270/320** = 2,70 / 3,20 (6,26 − 3,06); niski koniec nie jest w opisie. Wartości v3.54.9
(5,85/3,98, 35,9° wobec 6,09/4,13, 39,95°): wzorzec mierzy otwór, odczyt — widoczną krawędź nad balustradą; kąt
dachu nie był użyty do kąta głowicy.

## 4. Kontrakt (§3)

Jeden wersjonowany kontrakt `packages/analysis-service/src/house/contract.ts` + narzędzia w `read.ts`:

| element | stan |
|---|---|
| wersja / hash narzędzia | `contract 0.5.0`, `toolSha256`, `fields`, `absentFields`, `toolVariant` (FULL/SLIM × STRICT/NON_STRICT) w każdym nagraniu |
| walidacja lokalna | `conformAnswer` (reguły `conform@1`): kolejność kluczy ze schematu, nieznane pole usunięte i nazwane (`UNKNOWN_FIELD`), brak wymaganego pola = pozycja odrzucona (`ITEM_REJECTED`) albo `null`, gdy typ dopuszcza `null`; liczby, enumy, typy; zagnieżdżenie — także dla NON_STRICT i odtworzeń |
| migracje | jedna: `JSON_TEXT@1` (lista podana jako tekst JSON — znana reguła, zapisana); nagrania starsze niż 0.5.0: łagodnie (zachowane nieznane pola, brak wymaganego = „nie powiedziano”) |
| historia | `rawAnswer` = głęboka kopia odpowiedzi przed normalizacją; `answer` = znormalizowana; odtworzenie waliduje wobec wariantu, w którym nagrano (SLIM wobec SLIM) |
| identyfikatory | otwory z porządku programu (`stableOpeningOrder`); obrazy po `picture.id`, nie po numerze w wiadomości; nowe kolekcje emitowane tylko, gdy niepuste — stare nagrania zachowują rewizję |
| układy współrzędnych | piksele obrazu wysłanego (`× scale` → piksele opublikowane), rzut zorientowany przez `frontEdge`, metry domu (XZ, Y w górę); transformacja rzutu kondygnacji sprawdzana (jedna skala, pokrycie ≥ 90 %) |
| prowenencja | `PRINTED / DERIVED / ESTIMATED / DEFAULT / UNKNOWN` na każdej wartości; opis z rzutu = PRINTED, ukryty koniec = ESTIMATED, szkło widziane bez ramy = ESTIMATED (+0,07 m profilu, domyślne) |
| notatki | `note`, `unknowns` = `NOTE_ONLY`: nie mają konsumenta |
| nowa rewizja | odczyt nie nadpisuje przyjętej rewizji (`accepted-house-revisions`, ponowny job 0 USD) |

Inwentarz cecha → pole → pole dokumentu → operacja korekty → konsument: `results/reading-capabilities.md`. Uczciwie:
ścianki, pomieszczenia i opisy z rzutu **nie mają operacji korekty** (poprawia się je ponownym odczytem rzutu),
komin nie ma rodzaju w `SET_FEATURE`, powierzchnia z rzutu i schody z rzutu są tylko zapisywane.

## 5. Okna i przeszklenia — parametry przed → po

| parametr | v3.54.9 H-PO | live PRZED | live PO | źródło | stan |
|---|---|---|---|---|---|
| przednie skośne szer. | 2,494 | 2,700 P | 2,700 P | 2,70 | OK |
| przednie wysoki / niski | 6,082 / 3,924 | 6,26 / 3,915 E | jw. | 6,26 / 4,02 | OK (niski w tol.) |
| tylne W szer. | 2,577 | 2,340 P | 2,340 P | 2,34 | OK |
| tylne W wysoki / niski | 5,848 / 3,983 | 6,09 P / 3,89 E | 6,09 P / 4,128 D | 6,09 / 4,13 | OK po recenzji |
| tylne E kąt | 35,89° | 41,96° | 38,72° | 39,95° | OK |
| taras szer. × wys. | 4,543 × 2,373 | 4,628 × 2,398 | jw. | 4,70 × 2,30 | szer. −0,07 OK; wys. +0,10 OK (tol. 0,15) |
| taras skrzydła | 5 | 2 | 2 | 2 | OK |
| rama pas pionowy F / R | 0,927 / 0,966 | 0,979 / 0,983 | jw. | 0,82 | NO |

P = PRINTED, D = DERIVED, E = ESTIMATED. Scorer v3: `research/source-to-model/v35410/metric-v3.py`, wynik
`results/marcowki-metric-v3.{json,txt}`; 27 wierszy v3.54.8 i v2 importowane bez zmian (16 i 27 historyczne
zachowane obok).

## 6. Strefy wykończenia (§5)

- Odczyt: `DETAILS.zones[]` = materiał (PLASTER/WOOD/BOARD_CLADDING/METAL/STONE/BRICK/GLASS/OTHER/UNKNOWN), ton,
  pudełko, bryła, pewność; resolver rzutuje pudełko na ściany tej strony i kondygnacji najbliższe widzowi, dzieli na
  fizyczne ściany i przycina do wysokości ściany.
- Styl `low-poly@1` deterministyczny: jeden kolor na rolę, ten sam na każdej stronie; `UNKNOWN` = neutralny.
- Po jobie znaleziono w odtworzeniu dwa błędy konsumenta i naprawiono je (`d43eebe`, testy przyczynowe):
  (a) krawędź obrysu zaczynająca się tam, gdzie nie stoi ściana (zwrot przy portalu) zatrzymywała strefę → teraz
  przechodzi dalej (ściana garażu i pas boczny są rysowane); (b) dwie strefy różnego wykończenia na tym samym odcinku
  ściany rysowały się w jednej płaszczyźnie (migotanie na tablicy H-PRZED) → odcinek wspólny nie jest rysowany
  przez żadną i jest nazwany `ZONE_OVERLAP` (nie wybieram wykończenia za czytającego).
- Geometria w neutralnym świetle a strefy: obrysy, otwory, ramy, portale identyczne ze strefami i bez (test „zone
  never changes outline/openings/rooms”); strefy liczone osobno w scorerze v3 (opisowo: brak wzorca stref).

## 7. Wnętrze z rzutów (§6)

| kondygnacja | rzut dostępny | wysłany | odczytano | stan | dodano do LOCAL |
|---|---|---|---|---|---|
| parter | tak (p2) | `STOREY` (detail) | 8 ścianek, 6 drzwi, 9 pomieszczeń, 8 opisów | NOT_PLACED — pokrycie 87,6 % < 90 % (obrys brutto) | 0 |
| poddasze | tak (p1) | `STOREY-1` (detail) | 9 ścianek, 9 drzwi, 9 pomieszczeń, schody, 1 otwór, 6 opisów | PLACED 94,8 % | +1 ścianka, +2 pomieszczenia |

Scalanie (`mergePlanLevel`): import LOCAL nigdy nie jest usuwany; ścianka z rzutu dublująca ściankę LOCAL nie powstaje
drugi raz; ścianka dochodząca do innej jest docinana do jej lica; pomieszczenie dzielone zachowuje id LOCAL dla
większej części; strefa otwarta nie dodaje ściany; schody budowane wyłącznie z LOCAL. Wybór elementów do widoku jest
oddzielony od dopuszczenia użycia (kontrole wnętrza mają zakres `INTERIOR` i nie ruszają wyboru zewnętrza). Dublin
i pozostałe domy regresji: nagrania sprzed 0.5.0 nie mają kroku `STOREY` — stan „nie odczytano (nagranie sprzed
kroku)”, zapisany w `extras.absent`.

## 8. Testy przyczynowe, iniekcja błędów, eksperymenty offline (§8)

`packages/analysis-service/test/house-v35410.test.ts` — 25 testów: zgodność/kolejność kluczy/`JSON_TEXT`/odrzucenie
pozycji/`null`; surowa kopia odpowiedzi; permutacja → te same id; reguła id dla starych nagrań; każde pole nowych
kroków ma zadeklarowany los; JSON kanoniczny (kolejność wielokąta zachowana); opis z rzutu: przyczyna, opis w złym
miejscu nie jest wciskany sąsiadowi, konflikt > dwóch definicji nie jest poprawką, skośne: skrajnia przy wysokim
końcu (i lustrzanie); podział z odczytu vs konwencja nazwana; strefa → regiony bez zmiany obrysu/otworów; strefa
`UNSURE` nierysowana; nakładanie stref; **iniekcje**: szkło wzięte za otwór (otwór szerszy o profil, ESTIMATED,
`OPENING_GLASS_CONTOUR`), cień/balustrada przedłużające zakres (`EXPOSED` → niski koniec ESTIMATED), brakujące
skrzydło (jedno skrzydło zostaje jednym — liczba nie jest wymyślana), zamienione końce głowicy (lustrzany test
skrajni), kolor cienia jako materiał (`UNSURE`); scalanie wnętrza (dodanie z docięciem, brak dublowania, strefa
otwarta). Odtworzenia offline: R0 (nagranie v3.54.9 → model identyczny), DIAG/DIAG2/DIAG3 (`MANUAL_DIAGNOSTIC`:
ręczne odpowiedzi DETAILS/STOREY przez normalny adapter; ręczne, nie odczyt API — DIAG2: 24/27, taras 2 skrzydła,
okna OK poza niskim końcem W), HR/HR2 (odpowiedzi joba live przez obecny kod).

## 9. Regresja geometrii i materiałów

15 odtworzeń (6 DEV, 8 potwierdzających, Alaska) tych samych nagrań co v3.54.9: status, kontrole, odrzucenia jądra,
błędy kompilacji, wymiary — bez zmian; hash modelu różny w 8 z 15 i w każdym jedyną różnicą geometrii są kominy
(fuzja widoku szczytowego z bocznym; wcześniej `SOURCE_UNKNOWN`) — położenia bez wzorca dla tych domów, więc
niezweryfikowane. `results/regression-v3549-vs-v35410.txt`. Materiały: nagrania sprzed 0.5.0 nie mają stref → palety
bez zmian. Pallas, Alaska, Lubczyk i Dublin są w tym zestawie. Osobnych przebiegów kontrolnych „dom bez ramy”,
„inna paleta” i „prawdziwa balustrada prętowa” nie wyznaczałem i nie uruchamiałem live (brak budżetu na drugi job);
na odtworzeniach strefy i nowe pola nie występują, więc te kontrole są **niezweryfikowane** dla nowych konsumentów.

## 10. Job live, koszty, rezerwacje (§9)

Plan zapisany przed jobem: `results/live-plan.md`. Strop hosta 24,0994 na księgach 23,2994 (maks. 0,80 USD;
pozostało w puli 0,81096). Host odmawia żądania, którego rezerwacja przekroczyłaby strop; odmowa `DETAILS`/`STOREY`
= „nieodczytane z powodem”, odmowa rundy recenzji = koniec recenzji.

| żądanie | zarezerwowano | koszt | wejście / wyjście |
|---|---|---|---|
| INVENTORY | 0,043046 | 0,032626 | 6993 / 1864 |
| PLAN | 0,074906 | 0,051880 | 7385 / 3711 |
| FACADES | 0,146312 | 0,086358 | 13774 / 5881 |
| DETAILS | 0,093342 | 0,037560 | 7075 / 2341 |
| STOREY (parter) | 0,091146 | 0,046436 | 5648 / 3514 |
| STOREY (poddasze) | 0,091154 | 0,034654 | 5652 / 2335 |
| REVIEW 1 | 0,129844 | 0,104802 | 25461 / 5388 |
| REVIEW 1 (uzupełnienie) | 0,087630 | 0,023246 | 4148 / 1495 |
| REVIEW 2 | 0,119180 | 0,068282 | 20071 / 2814 |
| REVIEW 2 (uzupełnienie) | 0,087622 | 0,023138 | 4144 / 1485 |
| **razem** | | **0,508982** | 10 żądań |

Księgi: 23,808382 z 24,11036 USD (`research/ai-assist/spend-ledger-v35410.json`). Powtórzenia: job 2 (0 USD), dwa
pełne przebiegi E2E na `d43eebe` i `62350cc` — każdy job `REVISION_REUSED`, 0 żądań, 0 USD; job bez tokenu: brak
dokumentu, brak żądań. Pilot domyślnie wyłączony, host za tokenem. Klucz tylko ze środowiska; skan wycieku przed
każdym commitem.

## 11. Wersje i testy

| element | wersja |
|---|---|
| kontrakt odczytu | `buildapp.house-reading` 0.5.0 (conform@1) |
| dokument domu | 0.6.0 (czyta 0.5.0) |
| resolver / builder / ścieżka | 0.7.0 / 0.6.0 / 0.6.0 |
| schemat modelu | 1.8.0 (bez zmian) |
| scorer | v3 (`buildapp.v35410-marcowki-metric/3`), v2 i 27 wierszy obok |

Typecheck czysty. Pakiety dotknięte (reconstruction, analysis-service, analyzer-api, architecture, model,
candidates) na `d43eebe`: 2340/2340. Pełna macierz na `62350cc`: `results/matrix-final.txt` (rozdz. 15). Finalny host
E2E na `62350cc`: ALL CHECKS PASSED (`results/host-62350cc/`); job live na `397a809` (`results/host-397a809/`) — dwie
kontrole FAIL, obie z tej samej przyczyny w skrypcie E2E (porównywał wnętrze opisu z modelem LOCAL, kiedy stał
LOCAL), poprawione w `d43eebe`, nie w produkcie.

## 12. Otwarte usterki i stopReason

| usterka | stopReason |
|---|---|
| pas ramy szczytowej 0,98 vs 0,82 | percepcja; brak operacji, która by ją przebiła poza `SET_FEATURE` (recenzent jej nie zaproponował) |
| kominy 0/2 | widok boczny czyta kominy jako `OTHER`; `SET_FEATURE` nie ma rodzaju CHIMNEY |
| opis 470/230 i wnętrze parteru z rzutu | obrys kondygnacji brutto → rejestracja 87,6 % < 90 % (próg nie podniesiony) |
| drzwi poddasza z rzutu (+0) | drzwi z rzutu nie trafiły na ściankę w ≤ 0,4 m po scaleniu; nowe pomieszczenia bez przejścia (4 składowe) |
| słupki tylnych skośnych | jądro rozstawia szyby okna równo; słupek poza pudełkiem pominięty — przybliżenie |
| przesunięcie otworów lewej elewacji 7–12 px | percepcja; recenzja `UNRESOLVED` |
| `LIMIT_BUDGET` | nie wystąpił; po etapie zostaje 0,301978 USD — kolejny job live tej wielkości (≈0,51) się nie zmieści |

## 13. Wiązanie opisów: odtworzenie / live / ręcznie

| źródło | opisów | powiązane | nie umieszczone | nie powiązane |
|---|---|---|---|---|
| R0 (nagranie v3.54.9) | 0 (brak kroku) | — | — | — |
| DIAG (`MANUAL_DIAGNOSTIC`) | 4 | 4 (234/303 ×2, 270/320, 470/230) | 0 | 0 |
| live / HR2 | 14 | 3 (234/303 ×2, 270/320) | 8 (parter) | 3 (78/118 — okna dachowe, nie ściana: słusznie) |

## 14. Tablice i pakiet prywatny

Poza Gitem (`/home/user/rd/v35410/boards/`, w ZIP): `elevations.png` — ŹRÓDŁO | LOCAL | H-v3549 | H-nowy PRZED
RECENZJĄ | H-PO | ODDANY, ta sama rama, skala i światło, 4 strony; `oblique/` — widok ukośny każdego; `closeups.png`
— rama, nogi, pas portalu, tylne skośne przeszklenia z wartościami; `storeys-{H-PO,ODDANY,H-v3549}.png` — rzut
kondygnacji | nakładka wzorca | kondygnacja bez dachu. Przeszklenie tarasu widać w wierszu REAR tablicy elewacji
w tej samej skali (osobnego zbliżenia nie wykonano). Pakiet `BuildPlan-V35410-Private.zip`: indeks, źródła z hashami,
odpowiedzi surowe/zwalidowane/znormalizowane, schematy, house/model/scene/trace, operacje recenzji, dokładne wejścia
recenzenta (rendery, wycinki opisów), tablice, metryki, logi testów, księga — manifest, rozpakowanie i skan sekretów
sprawdzone.

## 15. Macierz pełna na finalnej rewizji

`62350cc`: typecheck czysty; vitest 4238 zaliczonych, 11 pominiętych, **15 niezaliczonych — ten sam zbiór co
w bazie w tym środowisku** (testy architektury wymagające commitów bazowych w klonie, skan rozmiaru plików, zapis do
repozytorium, ICU/hash local-analyzer; przebieg bazowy v3.54.9 miał 19, jego 4 dodatkowe porażki fixture Android są
od tamtej pory naprawione). Nowych porażek brak. `results/matrix-final.txt`.
