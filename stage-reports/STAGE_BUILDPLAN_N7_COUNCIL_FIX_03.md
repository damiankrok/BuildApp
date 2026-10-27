# STAGE BUILDPLAN N7-COUNCIL-FIX-03 — odzyskanie garaży i brył dołączonych

Baza `e810555` (FIX-02), gałąź `claude/new-session-3kzcgh`, kod `4705033`. Solver **2.8.0**. APK **1309**.

Naprawiono Council C-1 i C-2 oraz to, co z nimi bezpośrednio związane z C-3 i C-8. Garaże i bryły dołączone ginęły podczas dekompozycji rzutu, a bieg i tak kończył się wynikiem COMPLETE. Poprawki są tam, gdzie bryła faktycznie ginęła, a nie w emiterze ani w komunikacie.

Czego nie robiono:

- Walidatora `WALLS_OVERLAP` nie rozluźniono.
- Żadnego statusu nie ustawiono na siłę na COMPLETE.
- Brył nie rozciągano, żeby coś domknąć.
- Nie dodano nowego systemu AI ani rekonstrukcji.

**Prywatnego benchmarku OWNER-a nie odtwarzałem i nie deklaruję jego naprawy.**

## Wynik w skrócie

| Kryterium | Stan |
|---|---|
| 1. Bryła nie znika | Garaż cofnięty, zrównany z licem, z oknami, z czterema otworami, z bramą 3,4 m i 5 m oraz WING25 — wszystkie są budowane. Wcześniej w 5 z 10 przypadków bryła ginęła lub była scalana z domem. |
| 2. Szeroka brama ≠ otwarty bok | Brama szersza od drzwi zamyka garaż, gdy rysunek mówi, że to brama. Ganek, wiata, otwarta wnęka i „pusta dziura” zostają otwarte i są nazwane jako `UNRESOLVED`. |
| 3. Brak potwierdzonej bryły ≠ COMPLETE | `bodyCompleteness` po dekompozycji. Brakująca bryła oznacza `PARTIAL_3D_PREVIEW` / `BODY_MISSING_FROM_MODEL` z przyczyną. Telefon pokazuje ją w osobnej sekcji. |
| 4. Zdrowe części widoczne | Brak bryły nie zabiera modelu: wszystko, co zbudowano, zostaje. |
| 5. Bez degradacji | Osiem znanych domów: modele **bajt w bajt identyczne**. Testy FIX-01 i FIX-02 zielone. Jeden zamrożony odczyt 005Q (`bodyBehind`) zapisany na nowo, uzasadnienie w §5. |

## 1. FIRST_BAD — gdzie ginęła bryła

Harnessy:

- `research/analyzer-n7-fix03/probe-decomp.ts`: siatka, klasy komórek, regiony, bryły layoutu i v2, wynik;
- `probe-edges.ts`: domknięcie każdej krawędzi (ściana / linia / otwór) i sondy linii;
- `probe-house.ts`: zapieczętowane biegi;
- Council `C/probe-merge.ts` i `C/probe-tiling.ts`.

Wszystkie domy są wymyślone (`HOLLOWAY`: dom 8,40 × 10,20 m, dwie kondygnacje; garaż 3,60 m).

| przypadek | krok, na którym ginie bryła (przed, `e810555`) | skutek przed |
|---|---|---|
| garaż cofnięty o 0,30 m, brama 2,4 m (`gb-setback-door`) | **siatka → domknięcie krawędzi.** `thinLines` (minCellM 0,45) wciąga lico garażu (9,90 m) w linię lica domu (10,20 m). Słup narożny garażu kończy się 11,5 px przed tą linią, więc `wallIntervals` go nie widzi. Brama ma jeden węgar i nie jest otworem: domknięcie 0,34. Zalewanie wchodzi do garażu. | garaż = OUTSIDE, brak bryły, COMPLETE |
| ten sam garaż bez bramy | — | zbudowany, ale głębokość 6,30 zamiast 6,00 (C-3, patrz §7) |
| garaż cofnięty o 0,40 m za magazynkiem (`t-two-strip`) | jak wyżej: prawy węgar przy narożu nie jest pasmem | garaż = RECESS, zgubiony |
| garaż 1,2 m za frontem (`t-strip120`), garaż 6 m (`m-wide6`) | **`mergeRegions`**: kafelkowanie „największy prostokąt najpierw” bierze dom + garaż (12 × 9 m) przez ciągły mur domu | bryła główna 12 × 9 z dachem nad garażem, fantomowy dwukondygnacyjny pasek 8,4 × 1,2; bramka `REJECTED`, a mimo to COMPLETE |
| garaż na pełną głębokość (`m-full`), garaż 0,45 m za tyłem (`t-strip045`) | **`mergeRegions` / masowanie**: na samym parterze nic ich nie rozdziela (linia 0,45 znika w siatce). Piętro kończy się na 8,42 m, ale layout tego nie używa. | jedna bryła 12 × 10,2 pod jednym dachem, `REJECTED` → COMPLETE |
| brama 3,4 m i 5,0 m (`g-gate34`, `g-wide5`) | **`decomposeCore`**: `closureOf` liczy dziurę tylko do 3,2 m. Szeroka przerwa trafia do testu kieszeni (limit 2,5·w²) i zostaje otwarta. Z łańcuchem wymiarowym bramy siatka tnie węgar na pasek 0,5 m. | garaż zgubiony albo zbudowany jako pasek 0,5 m (`WALLS_OVERLAP` → PARTIAL) |
| WING25 (dom 0,44 m, garaż z własnymi murami 0,25 m) | **domknięcie krawędzi**: krótkie węgary cienkiego muru nie są pasmami. Wylot czyta się jako 3,11 m z węgarami poniżej `minJambPx`. | garaż zgubiony, COMPLETE |
| ganek 2,4 m otwarty na całą szerokość, otwarta wnęka, „pusta” dziura 5 m | (słusznie otwarte) | nic nie zapisane |

## 2. Poprawki

### 2.1 Domknięcie krawędzi: naroże przy licu wciągniętym w linię (C-2)

`GridLine.mergedPx` przechowuje pozycje linii, które `thinLines` wcielił w daną linię, czyli lico innej bryły leżące bliżej niż komórka.

`wallIntervals` czyta mur przecinający linię także na tych licach. Gdy mur kończy się jedną grubość przed takim licem, a odcinek między nimi jest **tuszem** (blok narożny, którego czytnik pasm nie oddaje żadnemu murowi), mur sięga dalej o własną grubość. Nigdy nie sięga przez czysty papier za końcem muru.

Własne lica linii czytane są jak dotąd. Wcześniejsza, szersza wersja (wszystkie sondy) zmieniała na Cieszyńskiej kieszeń wejścia: drzwi 1,055 → 0,85 m. Odrzuciłem ją, zanim trafiła do kodu.

### 2.2 `mergeRegions`: nie przez szew elewacji (C-1)

`facadeSeams` wyznacza szwy. Krawędź między dwiema komórkami BUILT jest szwem, gdy spełnia wszystkie warunki:

- ciągły mur: pasmo na ≥ 50 % krawędzi, domknięcie ≥ 90 % z drzwiami;
- połączony wzdłuż tej samej linii z licem, przy którym druga strona jest na zewnątrz;
- **co najmniej 0,75 grubości** muru tego lica (ścianka działowa współliniowa z licem sąsiada nie jest szwem);
- po obu stronach jest rozpiętość bryły (pas grubości muru nie jest bryłą);
- odcinek szwu ma co najmniej rozpiętość bryły.

Żaden prostokąt BUILT nie przecina szwu. Linia bez lica zewnętrznego, czyli ściana nośna wewnątrz domu, nigdy nie jest szwem.

### 2.3 Layout: bryła, na której piętro kończy się na murze (C-1, inny dach)

`splitAtUpperSeams` tnie bryłę parteru na linii siatki tylko wtedy, gdy spełnione są wszystkie warunki:

- każda kondygnacja nad nią kończy się w tolerancji rejestracji na tej linii;
- ta linia przecina całą bryłę ciągłym murem (krawędź po krawędzi);
- obie części mieszczą dwie ściany i pomieszczenie.

Powstają dom i jednokondygnacyjna bryła z własnym dachem. Cięcie trafia do śladu jako `layout.seamSplits` i krok `massing`.

### 2.4 `decomposeCore`: brama szersza niż drzwi (C-2, §3)

`shutGateBays` waży każdą kieszeń z komórek OUTSIDE/RECESS (wraz z paskami BUILT węższymi niż bryła, które siatka odcięła na węgarach). Kieszeń jest zamykana jako garaż dopiero, gdy spełnione są **wszystkie** warunki:

- prostokąt komórek;
- dwie ściany boczne i tylna o ciągłości ≥ 85 %;
- węgar z każdej strony wylotu, w jego linii, **dłuższy niż koniec ściany bocznej**. Koniec ściany to nie węgar: to odróżnia wiatę i pustą dziurę 005N od bramy. Przy dziurze wielkości drzwi węgar wolno odczytać z tuszu, gdy czytnik pasm go zgubił (krótki węgar cienkiego muru);
- wylot ≤ 8 m, głębokość ≥ 4,5 m (stoi tam samochód), szerokość ≥ 2,2 m;
- **rysunek mówi, że to brama**: łańcuch wymiarowy z kreskami na obu węgarach (wydrukowana szerokość bramy), skrzydło narysowane w poprzek albo drzwi z kieszeni do budynku. Dla dziury wielkości drzwi wystarcza zasada `closureOf`.

Kieszeń, która nie spełnia warunków, zostaje otwarta. `GateBay` z decyzją `LEFT_OPEN` nazywa wtedy brak, na przykład:

- „brak węgara poza końcami ścian bocznych”;
- „2,40 m głębokości, mniej niż 4,5 m”;
- „nic nie mówi, że wylot to brama”.

### 2.5 Kontrola kompletności (§4)

`v2/body-completeness.ts` działa między dekompozycją a modelem. Każdy region BUILT rzutu jest ważony przeciw bryłom modelu po **powierzchni**, nie po liczbie:

| decyzja | znaczenie |
|---|---|
| `REPRESENTED` | bryła modelu stoi na regionie |
| `JOINED` | jedna bryła stoi na regionie i na innym regionie |
| `OMITTED` | pominięty jawnie: luka layoutu (pasek grubości muru, region obwiedziony linią) albo decyzja cienkiej bryły |
| `UNRESOLVED` | kieszeń `LEFT_OPEN` |
| `MISSING` | żadna bryła nie stoi na regionie; podana jest przyczyna |

`MISSING` daje `PARTIAL_3D_PREVIEW` z błędem `BODY_MISSING_FROM_MODEL` i listą `missingBodies`. Wszystko, co zbudowano, zostaje: brak bryły nie odrzuca modelu. Wynik ma `drawnBuiltM2`, `representedM2` i `coverage`.

Zmiany po stronie usługi i telefonu:

- usługa dodaje ostrzeżenie `BODY_MISSING_FROM_MODEL`;
- telefon pokazuje sekcję „Bryły narysowane na rzucie, których brakuje w modelu”: id, m², położenie, obwód w ścianie, pokrycie i przyczynę.

## 3. Model widoczny (§5)

Na wszystkich przypadkach:

- dom ma 8,40 × 10,20 m i dwie kondygnacje;
- dach główny kończy się na 8,40 m i nie przykrywa garażu;
- garaż ma jedną kondygnację, własny pierścień i własny dach.

`WALLS_OVERLAP` niezmieniony. Żadnego przesunięcia ani rozciągnięcia nie dodano: bryły stoją na liniach siatki rysunku.

## 4. Testy (§6)

| test | wynik |
|---|---|
| `analysis-service/test/garages-n7-fix03.test.ts` — przez usługę produkcyjną, każdy z replay `BYTE_IDENTICAL`, `verifyReplay`, hashem modelu i sceną | **9/9** |
| — garaż z szeroką bramą (5,0 m, wydrukowana szerokość) | zbudowany 6,00 × 6,00, `GATE_SHUT` |
| — ta sama dziura bez żadnego znaku bramy | nie zbudowany, `LEFT_OPEN`, nazwany |
| — garaż cofnięty (0,30 m, brama 2,4 m) | zbudowany, 1 kondygnacja, własny dach |
| — garaż na wspólnym licu (na pełną głębokość domu) | rozcięty na murze, na którym kończy się piętro; dwa dachy; bramka `ACCEPTED` |
| — garaż 1,2 m za frontem | dom 8,40 × 10,20, garaż 3,60 × 9,00, bez fantomowego paska |
| — bryła z cienką ścianą (składzik 1,6 m, mury 0,15 m) | zbudowana z własnymi murami, bez nakładania |
| — WING25 (garaż z murami 0,25 m przy domu 0,44 m) | zbudowany z murami 0,26 m |
| — portyk/ganek 2,4 m otwarty na całą szerokość | **nie** staje się garażem: `UNRESOLVED` z powodem |
| — garaż z bramą i czterema oknami w jednej ścianie | wszystkie 5 otworów na pierścieniu garażu |
| `reconstruction/test/body-completeness-n7-fix03.test.ts` — czyste: szwy (lico / ściana nośna / szyba) i decyzje kompletności (`MISSING` z przyczyną, `OMITTED`, `JOINED`, bryła layoutu niezbudowana) | **7/7** |
| ochrona pierścieni FIX-02 (`wall-thickness-ring-guard-n7-fix02`, `wall-thickness-n7-fix02`) | zielone |
| `packages/reconstruction` (cały pakiet) | **1085/1085** |
| `packages/analysis-service` (cały pakiet) | **134/134** |
| `tsc -p tsconfig.json`, `tsc -p apps/web/tsconfig.json` | czyste |
| `tests/architecture` | 351/357. 6 czerwonych jak na bazie: wall-strip ×2 (baza 005Q poza klonem), 005M rozmiar pliku, zapisy IU ×3 (brak numpy). |
| Android JVM: `LocalAnalysisTest`, `AnalysisTrackerTest`, `RunProvenanceTest` | zielone |

Testy porządkowane po drodze (żaden nie wyłączony):

- `extent-envelope §19`, `§29/§30` (wiata): przeszły po zaostrzeniu odczytu naroża i węgara;
- `plan-resolution`: kieszeń z szerokim wylotem bez znaku bramy;
- `compound-facade §21`: pusty wylot garażu 005N nie jest fabrykowany;
- `layout`: ścianka działowa współliniowa z licem skrzydła nie tnie domu.

## 5. Regresja ośmiu znanych domów

Zapieczętowane źródła odtworzone offline przez `second-house.ts`. Wyniki:

- **Modele 8/8 bajt w bajt identyczne** z FIX-02: a01, gozd, marcowki, ciesz, rary, trytomach, arganiach, sasankach3.
- Bryły, kondygnacje, ściany, okna/drzwi, dachy i COMPLETE/PARTIAL są bez zmian.
- Kompletność: pokrycie 1,000 we wszystkich ośmiu. Brak `MISSING`, brak kieszeni bramowych, brak cięć szwem.

Szczegóły są w `stage-reports/artifacts/analyzer-n7-fix03/regression-8-houses.json`.

Dwa pośrednie warianty dawały różnice na korpusie i **odrzuciłem je** przed commitem:

- Rarytasy: szew na pasie grubości muru dzielił front na trzy paski 0,37 m i dawał `WALLS_OVERLAP`. Poprawka: minimalna rozpiętość i długość szwu.
- Cieszyńska: naroże czytane na wszystkich sondach dzieliło kieszeń wejścia; wbrew rysunkowi (wnęka 258, drzwi 105) drzwi spadały z 1,055 do 0,85 m. Poprawka: naroże tylko na licach wciągniętych (`mergedPx`).

Zamrożony odczyt 005Q `bodyBehind` (`wall-strip.test.ts`) zapisano na nowo. Fikstura rysuje dwa pierścienie: dom 60..400 × 60..420 oraz garaż 382..660 × 200..402, przy czym wschodni mur domu jest zachodnim murem garażu.

- Przed: płyta frontowa 30 × 10,15 m przez oba pierścienie, „tył domu” jako druga bryła i „taras” 0,35 m przed garażem.
- Po: dom 17,00 × 17,15 m i garaż 13,00 × 10,15 m, tak jak są narysowane (jak fikstura `twoBodies`).

## 6. Harnessy Council przed i po

Pliki są w `stage-reports/artifacts/analyzer-n7-fix03/`: `council-c-*`, `synthetic-cases-*` i `fix02-synthetic-*`.

| przypadek | przed | po |
|---|---|---|
| m-full | main 12 × 10,2, dach nad garażem, `REJECTED` | main 8,4 × 10,2 + garaż 3,6 × 10,2, dwa dachy, `ACCEPTED` |
| m-deep9 / t-strip120 | main 12 × 9 + fantomowy pasek 8,4 × 1,2 (2 kondygnacje), `REJECTED` | main 8,4 × 10,2 + garaż 3,6 × 9,0, `ACCEPTED` |
| m-wide6 | main 14,4 × 8, brak dachu głównego, `REJECTED` | main 8,4 × 10,2 + garaż 6,0 × 8,0, `ACCEPTED` |
| gb-setback-door | garaż zgubiony | garaż 3,6 × 6,3 |
| t-strip045 | jedna bryła 12 × 10,2 | dom + garaż 3,6 × 10,2 |
| WING25 | garaż zgubiony | garaż 3,6 × 6,0 z murami 0,26 m |

## 7. Ograniczenia i to, co zostaje otwarte

- **C-3, rozdzielczość siatki.** Lico cofnięte o mniej niż `minCellM` (0,45 m) jest wciągane w linię lica domu. Garaż jest wtedy budowany do linii domu: przy cofnięciu 0,30 m głębokość 6,30 zamiast 6,00, a w t-strip045 i t-strip030-rear o 0,45 i 0,30 m za głęboko. To nie jest rozciąganie przez emiter, ale wynik jest o cofnięcie za długi. Nie zmieniałem `minCellM`, bo zmieniłoby to siatkę każdego domu.
- **t-two-strip.** Rysunek obwodzi murem całą wschodnią kolumnę: magazynek, komórkę między nim a garażem i garaż. Powstaje jedna jednokondygnacyjna bryła 3,6 × 12 m ze ściankami w środku, a nie trzy.
- **Bramka sylwetki na dwóch fiksturach z wydrukowaną szerokością bramy** (g-wide5, g-gate34): `STRUCTURAL_LAYOUT_REJECTED` (2,6 m na elewacji frontowej i tylnej), a wynik COMPLETE. Przyczyny nie badałem, to audyt elewacji, a nie dekompozycja. Reguła „BLOCKING nie daje COMPLETE” nie jest wprowadzona: zmieniłaby wynik domów, które dziś są COMPLETE. FIX-03 wprowadza bramkę tylko dla potwierdzonej brakującej bryły (§4 briefu).
- `toOuterFaces` przesuwa bok garażu z wydrukowaną bramą o 0,05 m (14,45 zamiast 14,40). To zachowanie sprzed FIX-03.
- Urządzenia ani emulatora nie było w sesji. Nowej sekcji telefonu nie oglądałem na ekranie.

## 8. APK 1309

| pole | wartość |
|---|---|
| plik | `BuildPlan-owner-preview-1309.apk` (= `BuildPlan-Model-Preview-arm64-v8a-debug.apk`), 40 676 031 B |
| SHA-256 | `c6929a4fa53ad09f3bb99fc3f1dfcdb7edd76b268810a5103b8e4dca3cd9ee41` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1309** / `0.1309.0-owner` |
| commit | `4705033fbc4d63544288c501013041615b5d488c` |
| podpis | ten sam klucz podglądu, cert `6e48fac4…a0da`; `verify-preview-signature.sh`: ok dla wszystkich 4 APK; instaluje się na 1308 jako aktualizacja |
| analizator w APK | `assets/local-analyzer/analyzer.mjs` SHA-256 `e044ff4a954b0775efe38c242ff7edd8b44aeef848ecd9b2b28fdc45c25a320b` (= `manifest.json`, 2 799 338 B), `SOLVER_V2_VERSION = "2.8.0"` |
| uprawnienia | tylko `INTERNET` (+ wewnętrzne uprawnienie odbiornika AndroidX) |

**Publikacja.** Sesja nie może tworzyć wydań GitHub. W FIX-02 próba zwróciła HTTP 403 „Creating, editing, or deleting releases is not permitted for this session type”, a w tej sesji nie ma narzędzia do wydań. APK jest przekazany bezpośrednio jako plik. Linku do wydania nie ma.

## Czego FIX-03 nie robi

- Nie zmienia `minCellM` ani siatki (C-3 jak w §7).
- Nie wprowadza reguły „BLOCKING ⇒ nie COMPLETE” dla bramki sylwetki.
- Nie twierdzi, że naprawił benchmark OWNER-a.
- Nie rozpoczyna następnych etapów.
