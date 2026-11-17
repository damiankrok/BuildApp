# SOURCE → MODEL v3.54.7 — wierność elewacji i skuteczna poprawka po recenzji

Kampania v3.54.7, 2026-11-17. Gałąź `claude/new-session-3kzcgh`. Master Plan v3.54.7: `docs/MASTER_PLAN.md`
(plik zastąpiony w całości; nowe §7.9, D40, D41). Start: HEAD `b9b96b2` (raport v3.54.6), host i baza z `f9cb3ef`,
trzy odczyty Marcówek z `54d31f6`, pakiet prywatny `BuildPlan-V3546-Private.zip`. Rewizje tej kampanii: `c973a6a`
(model, recenzja, wybór), `c03b7cd` (ścieżka domu 0.3.0; z niej pierwszy host E2E), `59d115e` (ochrona LOCAL,
jedna definicja obrysu; z niej finalny host E2E) i commit raportu. Raport jest jednym dokumentem końcowym.

Trzy rzeczy są w tym raporcie zawsze nazywane osobno: **model z opisu API** (`house-first`, przed recenzją), **scena
użyta w recenzji** (hash modelu, który był renderowany i wysłany — zapisany przy każdej parze) i **model oddany**
(wynik wyboru, zmierzony ponownie).

## 1. Werdykt

**Rama szczytowa, wnęka z loggią, wypusty ścian i skośne/ostre przeszklenia są teraz osobnymi elementami
skompilowanego modelu H, odczytywanymi ze źródła zwykłym przepływem — a nie tylko w LOCAL.** Na Marcówkach GE, mierzone
po kompilacji tą samą linijką sceny co LOCAL, przeciw zapieczętowanej prawdzie źródłowej (16 cech z §4, tolerancje
ustalone przed porównaniem):

| model | cechy w tolerancji źródła |
|---|---|
| LOCAL | **16/16** |
| H v3.54.6 (trzy odczyty M1/M2/M3) | 2/14, 2/14, 1/12 |
| H v3.54.7 na tych samych starych odpowiedziach (tylko nowy builder) | 7/14, 6/14, 6/13 |
| H v3.54.7, świeży odczyt L1 (FACADES+REVIEW na żywo) | **13/16** przed i po recenzji |
| H v3.54.7, świeży odczyt L2 | 10/16 (pierwsza strata: PLAN z odczytu M2 nie zawiera wnęki frontu) |
| H v3.54.7, host E2E (`c03b7cd`, pełny świeży odczyt) | **13/16** |
| H v3.54.7, host E2E (`59d115e`, kolejny świeży odczyt) | 11/16 — oddany LOCAL 16/16 |
| podstawienie ręczne (diagnostyka, `MANUAL_DIAGNOSTIC`) | 14/16 |

**Model oddany dla Marcówek to LOCAL** — w finalnej rewizji `59d115e` wybór trzyma oba modele przy tych samych cechach
(D41), porównuje obrys tą samą definicją (podłoga za ścianami po obu stronach) i chroni cechy, które LOCAL zbudował ze
źródła. LOCAL spełnia wszystkie fakty źródła i ma lepszą formę (16/16 wobec 13/16), więc nie jest podmieniany. W
pośrednim hoście `c03b7cd` oddano H (13/16) z powodu artefaktu miary obrysu (rozdz. 6.2) — błąd znaleziony, nazwany
i naprawiony; host z `59d115e` powtórzony (rozdz. 8).

**Alaska**: ostre przeszklenie szczytu jest teraz wycięte jako dwa skośne pół-otwory przy słupku (było: prostokąt),
rama szczytu zbudowana, kalenica +5,98 utrzymana; loggia przy szczycie nie ma wnęki w rzucie — wstrzymana
(`SOURCE_UNKNOWN`), status jakości `FEATURES_PARTIAL` z tą cechą nazwaną.

**Pętla recenzji jest teraz danymi**: każda strona idzie jako para źródło/render w tej samej ramie (rejestracja
elewacji, piksel w piksel, hashe obu obrazów i modelu), defekt ma region, cechę, znaczenie, wagę i adresata, poprawka
jest przyjmowana tylko wtedy, gdy region defektu mierzy się lepiej (`NO_IMPROVEMENT` gdy zmienił się sam hash),
dodanie otworu do ściany, która go nie utrzymała, jest odrzucane (`HOST_FIRST`), a `DIFFERS` bez skutecznej poprawki
uruchamia celowane dopytanie elewacji. W odczytach na żywo: L1 — dopytanie tyłu przyjęte (dwa skośne okna tylne
poprawione w regionie, `IMPROVED`); L2 i Alaska — dopytania odrzucone z nazwanym powodem (`NO_IMPROVEMENT`,
`SOURCE_UNKNOWN`). **Recenzent dwukrotnie zgłaszał „brak ramy”, gdy rama była zbudowana** — przyczyna: rzut
prostokątny bez cieniowania głębi (rama 1 m przed ścianą wnęki miała ten sam odcień); naprawione w renderze (rozdz.
5.4), a defekt sprzeczny z linijką sceny jest zapisywany jako `MEASURED_PRESENT`, nie naprawiany drugi raz.

**Statusy**: IMPLEMENTATION_COMPLETE; BUILDER_VERIFIED_IN_SCOPE (rama, wnęka, wypusty, przeszklenia — testy i pomiar
po kompilacji); REVIEW_LOOP_VERIFIED na odczytach na żywo (poprawki z adresatem, pomiar regionu przed/po);
HOST_INTEGRATION_VERIFIED (rozdz. 8); **pełna zgodność formy: NIE** — portal (pas nad wejściem i garażem 0,79 m) nie ma
pola w kontrakcie odczytu, loggia frontu kończy się na wypuście (7,22 zamiast 7,90 m), a jedno tylne okno ma głowicę
0,38 m za nisko; ANDROID NOT_VERIFIED (kod nie zmieniany, APK nie budowany).

## 2. Start i diagnoza (§1 briefu)

Fakty sprawdzone na zapisanych odpowiedziach v3.54.6 (bez API), każdy z pierwszym miejscem straty:

| objaw | pierwsza strata | gdzie |
|---|---|---|
| 5 odpowiedzi REVIEW `DIFFERS`, M1 widzi loggie zastąpione balkonami na słupach, poprawki puste | **builder**: balkon w strefie otwartej dostawał słupy z `over.posts`; wnęka w obrysie nie była rozpoznawana | `resolve.ts` (balkon), `program.ts` (ring ścian po obrysie) |
| M3 runda 2 widzi białe ramy, proponuje tylko pola bryły | **kontrakt**: `SET_FEATURE` nie znał ramy, FACADES nie miał pola ramy | `review.ts`, `read.ts` |
| FACADES bez obserwacji ramy | **kontrakt odczytu**: brak `GABLE_FRAME`, `LOGGIA`, `bandPx`, `legPx`, `posts`, głowic otworów | `read.ts`, `document.ts` |
| LOCAL ma ramę, wnękę, skośne przeszklenie | LOCAL: `createRoof` z `edgeMembers.verge` + ściany `RETURN` 0,61 m; wnęka = przejście w ringu + wypusty + ściana tylna; przeszklenie `RAKED` | `reconstruct-v2/emit.ts` (tylko odczyt, dla porównania) |
| lewa ściana `WALLS_OVERLAP` przy uskoku ~0,65 m i ścianie 0,45 m | **builder**: wypust węższy niż dwie ściany budowany jako trzy ściany pierścienia | `program.ts` → nowe `steps.ts` |
| `WALL_CONSUMED` z przodu w odczycie 2 | **resolver**: uskok 0,36–0,40 m płytszy niż ściana | nowe `straightenJogs` |
| Alaska: przeszklenie szczytu jako przycięty prostokąt | **kontrakt + builder**: brak głowicy ostrej | `read.ts` (`apexX`), `program.ts` (dwie połówki RAKED) |
| Pliszka: podział garażu 6,39 wobec ~5,00 m | **plan** (podział bryły „na oko”) — **nienaprawione**, granica nazwana (rozdz. 10) | — |

**Pierwsza próba (wymaganie §2):** po jednym fragmencie ramy, wnęki i przeszklenia odtworzonych z udokumentowanego
źródła (rejestracje prawdy źródłowej) przez ten sam builder produkcyjny — `research/source-to-model/v3547/diag-substitute.ts`,
wynik oznaczony `MANUAL_DIAGNOSTIC`, nigdy bieg automatyczny. Wynik: rama pas 0,828 m, nogi 0,609 m, głębokość 0,961 /
1,003 m (z wypustów rzutu); przeszklenia skośne wycięte (front 3,18→0,95 m nad parapetem, szer. 2,69 m — prawda
3,20→0,96 / 2,70). Wniosek: **builder umie zbudować te cechy; brakowało ich w odczycie** — kontrakt odczytu i pętla
recenzji musiały je dostarczyć. Bieg końcowy bierze je wyłącznie z prawdziwego odczytu.

## 3. Model (§2 briefu)

Wszystkie reguły przez relacje i cechy, bez nazw projektów i bez wymiarów testowych w kodzie produkcyjnym.

- **Wypust (outline step) → ściana-filar.** Krawędź obrysu węższa niż `2·ściana + 0,30 m`, z antyrównoległymi
  sąsiadami prostopadłymi do niej, głęboka ≤ 3 m, jest jednym murem o grubości równej głębokości wypustu; pierścień ścian
  biegnie linią cofniętą (`steps.ts` `outlineSteps`). Krawędzie obrysu leżące w filarze nie są błędem wiązania.
- **Płytki uskok → wyprostowany i powiedziany** (`straightenJogs`, defekt `OUTLINE_JOG_STRAIGHTENED`), chyba że
  przesuwany odcinek dzieli inna bryła (wtedy zostaje — kontrpróba Lubczyka, rozdz. 7).
- **Wnęka i loggia.** `recessAt` szuka pary wypustów po stronie elewacji; `LOGGIA` i `BALCONY` nad wnęką to płyta we
  wnęce bez słupów (`BALCONY_IN_RECESS`); loggia bez wnęki w rzucie jest wstrzymana (`SOURCE_UNKNOWN`), nie wycinana
  w domu; nieznana głębokość pozostaje nieznana.
- **Rama szczytowa** to osobny element (`geometry.frames`, `createLinearSolid` rola `VERGE_BOARD` na każdej połaci):
  pas z `bandPx` (pionowo) przeliczony na szerokość prostopadłą do połaci, nogi z `legPx`, głębokość z wypustów rzutu
  po stronie ramy, a bez nich `DISPLAY_ASSUMPTION` 0,30 m (`FRAME_DEPTH_ASSUMED`). Szczyt z ramą nie ma okapu
  bocznego; dolny róg pasa stoi na licu ściany bocznej. Rama bez grubości pasa nie jest wymyślana; rama na stronie bez
  szczytu bryły jest wstrzymana.
- **Głowice otworów**: `headLeftY/headRightY` → `RAKED` (jeden trapez), `apexX` → `POINTED` jako dwa skośne pół-otwory
  przy słupku (`<id>--b`, przybliżenie powiedziane); trójkąt (głowica schodzi do parapetu) ma ścięty róg 0,30 m
  (`OPENING_HEAD_CORNER_CUT` z polem dodanym); głowica poza własnym pudełkiem → poziomo, `OPENING_HEAD_INCONSISTENT`;
  drzwi pod głowicą kształtowaną → szklenie stałe (skrzydło przyjmuje tylko poziomą głowicę). Kontrola po kompilacji
  porównuje dziurę z tym, co wycięto.
- **Ochrona LOCAL**: LOCAL jest bazą, gdy jest dobry — jego cechy zbudowane ze źródła, których odczyt opisu nie potwierdza
  ani nie zaprzecza, są trzymane przeciw podmianie (rozdz. 6.1). Wybór LOCAL ma jawny powód i nie liczy się jako
  naprawa H.

Wersje: dokument domu 0.3.0, kontrakt odczytu 0.3.0, resolver 0.4.0, builder 0.3.0, ścieżka domu 0.3.0 (klucze
wiązania przyjętej rewizji — stare rewizje nie są odtwarzane jako bieżące).

## 4. Pętla recenzji (§3 briefu)

- **Pary stron w jednej ramie.** Dla każdej zarejestrowanej elewacji model jest rysowany w ramie tej elewacji (te same
  wymiary w pikselach, `along = mPerPx·kolumna + alongAtPx0`, wiersz zera z rejestracji); niezarejestrowana strona idzie
  z kafelkiem bez wspólnej ramy i z powodem. Zapis pary: strona, elewacja, `sourceSha256`, `renderSha256`, `modelHash`.
  Zbliżenia (`closeUps`) — wycinek źródła i model w tej samej ramie, powiększone.
- **Defekt jako dane**: `side`, `picture`, `box` (region), `feature` (GABLE_FRAME, LOGGIA_OR_RECESS, BALCONY,
  SUPPORTS, GLAZING_SHAPE, OPENING, …), `meaning` (MISSING, EXTRA, WRONG_*), `weight` (KEY/MAJOR/MINOR), `evidence`,
  `fix` (CORRECTION / NEEDS_CLOSE_UP / UNRESOLVED) i indeksy poprawek. Region jest mierzony na scenie przed i po.
- **Poprawka z adresatem**: nowe operacje `SET_OPENING_HEAD`, `SET_FEATURE` z `GABLE_FRAME`/`LOGGIA` (ta sama `id` z
  innym rodzajem zastępuje odczyt — balkon na słupach → loggia, słupy znikają w jednym kroku), rama bez pudełka bierze
  szczyt swojej bryły; poprawki jednego defektu są jedną transakcją.
- **Gospodarz najpierw**: `ADD_OPENING` dla otworu niewyciętego z powodu ściany (odrzuconej lub za niskiej) bez zmiany
  ściany/bryły/głowicy w tej samej transakcji → `HOST_FIRST`.
- **Rzeczywista poprawa**: poprawka odpowiadająca defektowi mierzalnemu stoi tylko, gdy region jest lepszy
  (`IMPROVED`); sam nowy hash → `NO_IMPROVEMENT`. Kształt/rozmiar ramy i kształt przeszklenia nie są mierzalne
  obecnością → `NOT_MEASURABLE` (powiedziane, nie liczone jako poprawa).
- **Akceptacja po wyborze**: `DIFFERS` z otwartymi defektami KEY/MAJOR cech charakterystycznych → jedno celowane
  dopytanie elewacji (`describe_characteristic_features`), przyjmowane według tej samej miary; brak nowego materiału →
  `NOTHING_NEW`, koniec.

Odczyty na żywo (sceny użyte w recenzji i modele oddane w `results/runs-v3547.json`):

| bieg | rundy, werdykty | defekty | poprawki przyjęte | dopytania |
|---|---|---|---|---|
| L1 Marcówki | 2, DIFFERS/DIFFERS | 9 (KEY rama ×2 — w modelu była) | dopytanie tyłu: dwa skośne okna `IMPROVED` | front `NO_IMPROVEMENT`, tył `APPLIED` |
| L2 Marcówki | 1, DIFFERS | 7 | 0 (rama tył: `NO_IMPROVEMENT` na starej mierze) | front `NOT_CONSUMED`, tył `NO_IMPROVEMENT` |
| Alaska | 1, DIFFERS | 3 | 0 | oba `SOURCE_UNKNOWN` (zadaszenie tarasu bez strefy w rzucie) |
| host `c03b7cd` | — | 4 otwarte w statusie | — | — |

## 5. Co zostało zmienione w obrazie dla recenzenta

5.1 Ramy tej samej elewacji źródłowej i modelu (`renderSideInFrame`). 5.2 Hash obrazu źródła i renderu przy każdej
parze. 5.3 Zbliżenia. **5.4 Cieniowanie głębią i kontur skoku głębi** (`SIDE_DEPTH_SHADE` 0,4 na 2,5 m, kontur przy
skoku > 0,15 m): w rzucie prostokątnym rama 1 m przed ścianą wnęki miała dotąd ten sam odcień co ściana — recenzent
nie mógł jej zobaczyć. To wskazówka geometrii, nie kolor ze źródła.

## 6. Wybór i jakość (D40, D41)

6.1 **Cechy charakterystyczne** stają się twierdzeniami o źródle: z odczytu (rama, loggia, balkon bez podpór, głowica
kształtowana) i z defektów recenzji (cecha „brakuje” = źródło ją pokazuje). Oba modele są trzymane przy nich tą samą
linijką sceny (`sideFeatures`: przycinanie wznoszące się przy płaszczyźnie strony, wysunięcie płyt i wolne podpory,
otwory o różnych wysokościach głowicy). Nieobecność cechy nigdy nie jest twierdzona. **Ochrona LOCAL**: cecha
zbudowana przez LOCAL, o której odczyt opisu milczy, jest faktem, który LOCAL spełnia, a opis nie — opis zastępuje
LOCAL tylko spełniając ją albo gdy LOCAL przeczy większej liczbie faktów źródła.

6.2 **Jedna definicja obrysu.** Fakt „gdzie leży obrys” porównywał płytę LOCAL (podłoga za ścianami, z 0,99–13,59)
z obrysem H zawierającym wypusty ramy (z 0–14,49) — dosunięte do narożnika dawały 84–85 % i fałszywie obciążały LOCAL.
Teraz po obu stronach podłoga za ścianami (wypusty zdjęte `outlineSteps`): 100 %. To ta poprawka zmieniła wynik
Marcówek z „oddany H 13/16” (host `c03b7cd`) na „oddany LOCAL 16/16”.

6.3 **Status jakości oddanego modelu** (`QUALITY_*` w dokumencie domu, w przyjętej rewizji i przy ponownym użyciu):
`FEATURES_CHECKED` (każda cecha źródła spełniona, żaden ważny defekt nie otwarty), `FEATURES_PARTIAL` (z listą),
`FEATURES_NOT_CHECKED` (nie odczytano żadnej cechy — nie znaczy „poprawny”). Ponowne użycie przyjętej rewizji mówi,
czy status jakości jest ten sam.

## 7. Pomiar i regresja (§4)

**Marcówki, 16 cech** (`results/marcowki-features-truth.json`, skrypty `measure-features.ts` + `marcowki-features.py`,
tolerancje: położenie 0,30 m, głębokość 0,15 m, rzędne 0,15 m — z precyzji źródła, ustalone przed porównaniem):

| cecha | LOCAL | H v3.54.6 M1 | H v3.54.7 L1 przed | po | host `c03b7cd` H |
|---|---|---|---|---|---|
| rama front: zasięg / głębokość | OK / OK | brak | OK / OK (0,96) | OK / OK | OK / OK (1,03) |
| rama tył: zasięg / głębokość | OK / OK | brak | OK / OK (1,00) | OK / OK | OK / OK |
| loggia front we wnęce / zasięg | OK / OK | 2 słupy / NO | OK / **NO** (do 7,22) | OK / NO | OK / NO |
| loggia tył we wnęce / zasięg | OK / OK | 2,15 m na zewnątrz, 2 słupy / OK | OK / OK | OK / OK | OK / OK |
| portal: wierzch / podsufitka | OK / OK | OK / NO | OK / **NO** (2,79 vs 2,28) | OK / NO | OK / NO |
| brama garażu | OK | NO | OK | OK | OK |
| przeszklenie front (skośne) | OK | prostokąt 0,62 m | OK | OK | OK |
| przeszklenie tył W / E | OK / OK | brak / prostokąt | OK / **NO** (głowica 5,71 vs 6,09) | OK / NO | OK / NO |
| lewa strona: okno salonu / kuchni | OK / OK | brak / brak | OK / OK | OK / OK | OK / OK |

Pierwsze miejsce każdej pozostałej straty H: loggia front — resolver (`recessAt` przycina płytę do wnęki, a płyta
źródła biegnie pod wypustem wschodnim, który zaczyna się od +3,06); portal — kontrakt odczytu (brak pola pasa/podsufitki
dachu płaskiego); głowica tylnego okna E — odczyt (wiersz głowicy 22 px za nisko); L2 — PLAN z odczytu M2 (wypust 1,41 m
nie jest wypustem → brak wnęki → rama z głębokością założoną, balkon nad dachem garażu).

**Regresja na finalnym kodzie, bez API** (`results/regression-v3546-vs-v3547.txt`; te same zapisane odpowiedzi,
ten sam LOCAL): 8 domów potwierdzających i 6 DEV — **11 bez zmian**, decyzje bez zmian we wszystkich 14;
**Kardamon** lepszy (odmowy jądra 5→1, otwory niewycięte 6→2, wstrzymane 19→15); **Pallas** lepszy (odmowy 2→1,
niewycięte 2→1; jedyny niewycięty otwór ma teraz prawdziwy powód — jest w lukarnie odrzuconej przez jądro — dlatego
+1 błąd kompilacji); **Lubczyk** bez zmian co do ścian (ta sama ściana 0,389 m na styku brył jest odrzucona, teraz
jako ściana garażu zamiast domu), niewycięte otwory 4→3. Kontrole na planach bez ramy (Anodach, Oslo, Tracja, Frizea,
Dublin, Wena…): brak ramy, brak twierdzeń, `FEATURES_NOT_CHECKED` — żadna rama ani loggia nie pojawiła się tam, gdzie
jej nie ma. Marcówki na starych odpowiedziach M1–M3: odmowy jądra 3/1/1 → 0/0/0, oddany LOCAL 3/3 (ochrona LOCAL).

**Alaska** (`boards/alaska.png` w pakiecie prywatnym): ostre przeszklenie szczytu: dwie połówki 2,41→5,26 m, głowice
boczne 3,88 m, szczyt 4,98 m (słupek ścina wierzchołek 5,02 m); rama 0–7,64 m do +5,98; loggia przy szczycie wstrzymana;
oddany opis (`BOTH_CONTRADICT`, częściowy: LOCAL ma złą orientację, H nie ma loggii), `FEATURES_PARTIAL`.
**Pliszka**: tylko powtórka (bez zmian względem v3.54.6); podział garażu nienaprawiony.

Przypadki z §4 jako testy (`packages/analysis-service/test/house-v3547.test.ts`, 36 testów): niepełne wejście (defekt
bez regionu mierzy całą stronę; rama bez grubości pasa), zła strona (rama na stronie bez szczytu), brak poprawki po
`DIFFERS` (dopytanie; `NOTHING_NEW`), zmiana hasha bez poprawy (`NO_IMPROVEMENT`), odrzucona ściana z otworem
(`HOST_FIRST`), cecha zmierzona obecna (`MEASURED_PRESENT`), ochrona LOCAL i jej kontrpróba, prosty szczyt bez ramy,
loggia bez wnęki, uskok dzielony z sąsiednią bryłą.

## 8. Host (normalna ścieżka)

Pierwszy host z `c03b7cd` (pełny świeży odczyt, 7 żądań, 0,343466 USD): oddany H, `REVISION_ACCEPTED_NOW`,
`QUALITY_FEATURES_PARTIAL`; drugie zadanie na ten sam adres `REVISION_REUSED` — ten sam model i ten sam status jakości,
0 żądań; zadanie bez tokena 0 USD, bez dokumentu domu. ALL CHECKS PASSED. Wynik tej rewizji (H oddany zamiast LOCAL)
był skutkiem artefaktu z rozdz. 6.2.

**Finalny host z `59d115e`** (`node research/source-to-model/v3547/host-e2e.mjs --commit 59d115e …`, czysty magazyn):
zadanie 1 — świeży odczyt (6 żądań, 0,377276 USD), **oddany LOCAL** (`LOCAL_MEETS_SOURCE`: LOCAL spełnia każdy fakt
źródła, który spełnia opis), `QUALITY_FEATURES_CHECKED` (front: 4 cechy spełnione, tył: 4), `REVISION_ACCEPTED_NOW`;
model oddany `07b91e89…` = LOCAL (16/16 cech wobec prawdy). H z tego (czwartego niezależnego) odczytu: 11/16 — rama
front 1,41 m głęboka, balkon frontu 0,68 m przed licem, przeszklenie frontu poziome: odczyt znów inny niż L1. Zadanie 2
na ten sam adres: `REVISION_REUSED`, 0 żądań, **ten sam model i ten sam status jakości**. Zadanie bez tokena: 0 USD,
ścieżka rysunków, bez dokumentu domu. Wersje w dokumencie: dokument 0.3.0, `house-document-0.4.0+builder-0.3.0+reading-0.3.0`.
**ALL CHECKS PASSED.**

## 9. Koszt

Księgi otwarte na 20,655864 USD (v3.54.6). Ten etap: **1,39149 USD, 26 żądań** (L1, L2, Alaska 0,670748 / 13; host `c03b7cd` 0,343466 / 7; host `59d115e` 0,377276 / 6); księgi **22,047354 z 24,11036 USD** (zostaje 2,063006). Odczyty na żywo L1 0,253748, L2 0,244508,
Alaska 0,172492 (INVENTORY i PLAN z zapisanych odpowiedzi, świeże FACADES i REVIEW); jedno żądanie FACADES odrzucone
przed rozliczeniem (gramatyka za duża — rezerwacja zwolniona, 0 USD; od teraz drugi stopień: pełne narzędzie bez
gramatyki ścisłej). Rezerwacje sprawdzone: jedna otwarta z 2026-11-16 (0,146096) jest wliczona w księgi od v3.54.6.
Klucz używany tylko jako zmienna środowiska jednego polecenia; skan wycieku przed każdym commitem.

## 10. Granice nazwane

1. Portal (pas nad wejściem i garażem, podsufitka 2,28 m) — brak pola w kontrakcie odczytu; LOCAL go ma.
2. Loggia frontu kończy się na wypuście; płyta źródła biegnie pod wypustem zaczynającym się od +3,06.
3. Pliszka: podział bryły garażu z planu bez sprawdzenia dwoma elewacjami bocznymi (6,39 vs ~5,00 m) — nie zrobione.
4. Odczyt nie jest powtarzalny (L1 ≠ L2 ≠ host przy tych samych bajtach); powtarzalne jest oddanie (D39).
5. Pełny bieg vitest: 16 porażek środowiskowych tych samych co w v3.54.5 (brak commitów bazowych w płytkim klonie,
   ICU, plik większy niż model, kontrakt Androida itp.); jedną realną (nazwa projektu w komentarzu `accepted.ts`,
   z v3.54.6) naprawiono.
6. Android: NOT_VERIFIED.

## 11. Artefakty

- Kod: `packages/reconstruction/src/house/{steps,program,resolve,document}.ts`,
  `packages/analysis-service/src/house/{review,describe,measure,read,link,accepted,build}.ts`,
  `packages/analysis-service/src/consult/model-views.ts`.
- Testy: `packages/analysis-service/test/house-v3547.test.ts`.
- Narzędzia: `research/source-to-model/v3547/` (`house-run.ts`, `diag-substitute.ts`, `measure-features.ts`,
  `marcowki-features.py`, `board-frames.ts`, `make-board.py`, `render-pair.ts`, `host-e2e.mjs`, `book-host.ts`).
- Wyniki tekstowe: `research/source-to-model/v3547/results/`. Księga: `research/ai-assist/spend-ledger-v3547.json`.
- Pakiet prywatny (poza Gitem): odczyty, sceny, pary recenzji, tablice ŹRÓDŁO | LOCAL | H v3.54.6 | H PRZED | H PO
  (cztery strony w ramie elewacji, zbliżenia bryły głównej), logi hosta, księgi.
