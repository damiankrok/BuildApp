# BUILDPLAN-ANALYZER-005Y-N7-P2 — dopasowanie elewacji i otworów rejestrowane na źródle

**Werdykt: jedna poprawka modelu przeszła bramkę, siedem modeli bez zmian; OWNER_TEST_PENDING na APK 1305.**
Zbudowałem trzy rzeczy:

- audyt użycia widoków;
- niezależny odczyt otworów z elewacji, w dwóch czytnikach;
- dopasowanie rzut↔elewacja w metrach, z bramką poprawek.

Na 8 domach korpusu bramkę przeszła **jedna** poprawka: brama garażowa Marcówek, nadproże 2,75 → **2,25 m**. To
wydrukowane 225 wybrane przez zarejestrowaną elewację spośród dwóch odczytów OCR o równym wyniku. Każdą inną
rozbieżność raportuję w metrach i nie poprawiam. Powód jest jeden z trzech:

- model stoi na silniejszym źródle (wymiar z opisu, odczyt elewacji);
- dwa niezależne odczyty obrazu się nie zgadzają;
- widok nie ma kotwicy wysokości.

Tożsamości ukrytego domu nie ustalałem. P3 nie zaczęte.

Baza `4155239` (N7-P1), gałąź `claude/new-session-3kzcgh`. Pełny CI nie był uruchamiany (zgodnie z poleceniem).

## P2-A — które obrazy są naprawdę używane

Nowy `viewAudit` (`packages/reconstruction/src/v2/view-audit.ts`) daje jeden rekord na każdą ramę elewacji
i wizualizacji. Każdy rekord podaje:

- użycie widoku;
- stronę i sposób jej ustalenia (`LABELLED` / `FIRST_READING` / `MOVED`);
- skalę;
- błąd gruntu w m i px;
- czy z widoku czytane są wysokości;
- powód decyzji i listę tego, co tracimy.

Rejestracja wymaga kotwic. Widok bez nich zostaje `NOT_REGISTERED` z powodem — nic nie jest wymuszane.

Plan bazowy jest wspólny dla wszystkich ośmiu domów:

- kondygnacja `GROUND`, rodzaj `DIMENSIONED`;
- rozdzielczość 853×853, jeden wariant;
- skala z łańcuchów wymiarowych i niezależnych świadków; wartości per dom są w tabeli artefaktu.

Każdy dom ma 4 elewacje: FRONT, REAR i dwie `SIDE_UNSPECIFIED`. Lewa i prawa są rozróżniane: strona boczna jest
ustalana i nazwana (LEFT = WEST, RIGHT = EAST), a `sideBasis` mówi, czy przesądziła etykieta, pierwsza rejestracja,
czy późniejsza decyzja.

**Wizualizacja perspektywiczna nigdy nie jest elewacją** — `PERSPECTIVE_CHECK_ONLY` albo `PERSPECTIVE_UNUSED`, bez
strony i bez skali (test).

| dom | elewacje użyte (strona / sposób) | odrzucone i dlaczego | co tracimy |
|---|---|---|---|
| A01 | E sylwetka; W ta sama skala arkusza; REAR, FRONT pasmo ścian — wszystkie **bez wysokości** | — | wysokości otworów z widoków |
| Goździkowce | żadna | 4× `NOT_REGISTERED`: brak datum kalenicy i brak pasma ścian na sylwetce; dwie sylwetki boczne mają szerokość, której nie da się pogodzić z obrysem (np. 41,6 m przy 13,8 m obrysu) | wszystkie 14 otworów `UNREGISTERED_VIEW` |
| Marcówki | 4/4 na sylwetce, z wysokościami | — | — |
| Cieszynianki | REAR, W, FRONT pasmo ścian, z wysokościami | E: grunt 0,79 m wobec −0,19 m z pozostałych widoków | 4 otwory ściany wschodniej |
| Rarytasy | 4/4 na sylwetce; FRONT i REAR z wysokościami, boki tylko pozycje | — | wysokości na bokach |
| Trytomy | FRONT sylwetka; REAR pasmo ścian (tylko pozycje) | W: grunt −0,35 m wobec 0,47 m; E: sylwetka 19,3 m przy 13 m obrysu | 7 otworów boków |
| Arganie | FRONT, REAR sylwetka | oba boki: sylwetka 8,85 m krótsza niż ściana; 16,5 m dłuższa niż obrys | 4 otwory boków |
| Sasanki | FRONT, REAR sylwetka (tylko pozycje) | oba boki: nadwyżka 0,55–0,66 m po jedynej możliwej osi | 3 otwory boków |

Pełna tabela per rama — m/px, błąd gruntu w m i px, powód i straty — jest w
`stage-reports/artifacts/analyzer-005y-n7-p2/tables.md`. Zawiera tylko liczby i tekst, żadnego rastra.

## P2-B — rejestracja

Każdy widok rzutuje do jednego układu planu: oś wzdłuż fasady, znak i odbicie z rejestracji, wiersz zera, jedna
izotropowa skala.

Kotwice są niezależne od modelu:

- rozpiętość ścian z rzutu;
- datum kalenicy z przekroju;
- linia terenu;
- spójność gruntu między widokami.

Bieżący model nie jest kotwicą.

Nowa, słabsza ścieżka `CORNERS_AND_GROUND` rejestruje oba końce pasma ścian i teren, bez kalenicy. Daje tylko
pozycje (`POSITIONS_ONLY`) i **nigdy wysokości**.

Kolejność zaufania przy wyborze widoku fasady:

1. `SILHOUETTE`;
2. `SAME_SHEET`;
3. `WALL_BAND`;
4. `CORNERS_AND_GROUND`.

`heights` jest prawdą tylko na datum kalenicy przy zdrowym gruncie. Projekcja każdego widoku (`mpp`, `alongAtPx0`,
`alongSign`, `zeroRow`) jest zapisana w raporcie, więc nakładki rysuje dokładnie ta sama transformacja, której
użył solver.

## P2-C — niezależny odczyt otworów z elewacji

W `facade-openings.ts` są dwa czytniki.

**`scanFacadeOpenings` — bez rzutu.** Działa pas po pasie kondygnacji:

- materiały ściany uczy się z odcinków, które rzut rysuje jako pełne (kolory zbite w klastry);
- otwór to zamknięta plama tego, co nie jest żadnym z materiałów;
- wiersz obcy na ponad 70 % szerokości fasady jest linią budynku (strop, okap, cokół) i zostaje wycięty.

Odrzucane są:

- lamele i okładzina (dużo skoków jasności na metr przy małym udziale szkła);
- panel balustrady, który model ma w tym miejscu;
- poszarpane plamy (cień, faktura);
- rozmiary spoza widełek otworu.

Każde odrzucenie zostaje zapisane z powodem.

**`measureOpeningOnView` — z ziarnem z rzutu.** Mierzy jeden otwór rzutu na widoku:

- parapet i nadproże czyta istniejącymi czytnikami;
- ościeża znajduje, idąc od środka przerwy przez kolumny „nie-ściany” (wygląd ściany wyuczony wiersz po wierszu
  z sąsiednich pełnych odcinków);
- wynikiem pomiaru jest różnica względem przedziału z rzutu.

Rekord odczytu zawiera:

- fasadę i kondygnację;
- od, do i szerokość wzdłuż fasady;
- parapet i nadproże;
- rodzaj (`WINDOW`, `DOOR`, `GLAZED_DOOR`);
- ramę;
- niepewność wzdłuż i w pionie;
- dowód: kontrast, udział szkła, skoki na metr.

Duże przeszklenia ze słupkiem czytane są jako **jedno** przeszklenie (test). Drzwi tarasowe i przeszklone są
rozpoznawane po progu na podłodze.

Kalibracja czytnika z ziarnem wobec wydrukowanych wymiarów (opisy OCR, które model już miał):

| wielkość | n | mediana | p80 | max |
|---|---|---|---|---|
| szerokość | 23 | 0,029 m | 0,131 m | 1,21 m |
| środek | 23 | 0,04 m | 0,134 m | — |
| nadproże | 19 | 0,159 m | 0,367 m | — |

Nadproże z obrazu jest więc za słabe, żeby samo poprawiało model. Stąd bramka poniżej.

## P2-D — dopasowanie i bramka poprawek

`alignFacades` (`facade-alignment.ts`) paruje otwory modelu z odczytem widoku 1:1. Każdą różnicę nazywa
z rozmiarem w metrach, według tolerancji 0,10 m albo niepewności odczytu, jeśli jest większa:

- `HORIZONTAL_OFFSET`
- `WIDTH_MISMATCH`
- `SILL_MISMATCH`
- `HEAD_MISMATCH`
- `MISSING_IN_MODEL` — plama ze skanu bez przerwy w rzucie;
- `EXTRA_IN_MODEL` — przerwa rzutu, którą widok rysuje materiałem ściany (≤ 3 % obcych pikseli), a skan nie
  widzi tam nic;
- `WRONG_FACADE` — odczyty widoku bocznego leżą tam, gdzie otwory przeciwnej ściany;
- `UNREGISTERED_VIEW`.

Wszystkie kody są **raportowane, nigdy wykonywane**: nie dobudowujemy otworu na słowo renderu i nie zamurowujemy
przerwy z rzutu.

Poprawka powstaje tylko na zgodnym dowodzie. Są dwie drogi.

**1. Wysokość z konwencji (`ASSUMED_FOR_RENDERING` / `UNRESOLVED`).** Musi być spełnione wszystko naraz:

- brak opisu i odczytu elewacji;
- widok zarejestrowany dla wysokości;
- odczyt z ziarnem i niezależny skan bez rzutu zgadzają się w tolerancji;
- wynik mieści się w ścianie kondygnacji.

**2. Wysokość z opisu odczytana na dwa sposoby jednakowo.** OCR daje dwa wydrukowane odczyty o tym samym wyniku.
Zarejestrowany widok wybiera ten, do którego pasuje — i tylko jeden. Wartość jest **wydrukowana**, nie pikselowa;
widok tylko wybiera. Zbieżne odczyty jednej liczby (224/225/229) to jedna liczba i bierzemy z nich najlepiej ocenioną.
Wynik dostaje proweniencję `SOURCE_CORROBORATED`.

Szerokość i przedział nigdy nie są przesuwane przez piksele. Rzut i wymiar są silniejsze. Przy konflikcie model
zostaje, a konflikt trafia do raportu.

Po poprawce zmieniają się:

- `OpeningV2` (sill/head, proweniencja, `callout.heightCm` i `resolvedBy`);
- `BuildingV2`;
- emitowany program (`height`);
- rzeczywiste wycięcie w ścianie;
- `SOLVER_V2_VERSION` 2.3.0 → **2.4.0**.

## Wynik na korpusie (8 domów, zapieczętowane dowody N7)

| dom | model przed → po | widoki fasad | MATCHED | OFFSET | WIDTH | SILL | HEAD | UNREG | poprawki |
|---|---|---|---|---|---|---|---|---|---|
| A01 | `a6849073` = | 4, tylko pozycje | 11 | 4 | 2 | – | – | – | 0 |
| Goździkowce | `852c257a` = | 0 | – | – | – | – | – | 14 | 0 |
| **Marcówki** | `d8ec95cf` → **`8541ca10`** | 4, z wysokościami | 7 | 3 | 3 | – | 4 | – | **1** |
| Cieszynianki | `5394c17c` = | 3 | 6 | 3 | 3 | 2 | 1 | 4 | 0 |
| Rarytasy | `73969751` = | 4 (2 z wysokościami) | 5 | 4 | 3 | 1 | 3 | – | 0 |
| Trytomy | `d2bf0c03` = | 2 | 2 | 1 | 1 | 1 | 1 | 7 | 0 |
| Arganie | `34a95a76` = | 2 | 4 | 1 | 3 | 1 | – | 4 | 0 |
| Sasanki | `090749f4` = | 2, tylko pozycje | 4 | 2 | 2 | – | – | 3 | 0 |

Na 8 domach `MISSING_IN_MODEL`, `EXTRA_IN_MODEL`, `WRONG_FACADE` i `WRONG_STOREY` = 0. Skan ma przeoczać, a nie
zmyślać — nie znalazł niczego, co spełnia próg „silnego” otworu bez przerwy w rzucie.

### BEFORE → AFTER (metry; widok − model)

| dom | otwór | model przed | widok | Δ środek / szer. / par. / nadpr. | po | dlaczego |
|---|---|---|---|---|---|---|
| Marcówki | brama garażowa FRONT (`opening-0-front-8-0`) | 8,55–11,30; 0,00–**2,75** (opis 275/275, wysokość `UNRESOLVED`: OCR 275 = 0,599, 225 = 0,598) | 8,51–11,34; 0,00–2,20 | +0,00 / +0,08 / 0,00 / **−0,55** | 0,00–**2,25** (`SOURCE_CORROBORATED`) → reszta −0,05 m, w tolerancji | widok zarejestrowany na kalenicy pasuje tylko do wydrukowanego 225 |
| Marcówki | drzwi wejściowe FRONT | 0,00–2,10 (opis) | 0,00–1,39 | 0 / +0,01 / 0 / −0,71 | bez zmian | odczyt widoku urwany w połowie drzwi (widać na nakładce); opis silniejszy |
| Marcówki | okno W 3-1 | 6,80–8,20; 0,80–2,20 (parapet z konwencji) | 6,69–7,96; 0,85–2,35 | −0,18 / −0,13 / +0,05 / +0,15 | bez zmian | parapet zgodny w tolerancji, nadproże z opisu |
| Marcówki | okno tarasowe REAR 2-0 | 2,26–6,96; 0–2,30 (opis) | 1,63–7,21; 0–2,50 | −0,19 / +0,88 / 0 / +0,20 | bez zmian | szerokość z opisu silniejsza niż piksele |
| Rarytasy | okno W 7-0 | 4,64–5,64; 0,80–2,20 | 4,76–5,78; 1,38–2,74 | +0,13 / +0,01 / +0,58 / +0,54 | bez zmian | widok boczny bez kotwicy wysokości |
| Rarytasy | FRONT 0-2 | 12,75–15,25; 1,06–2,46 (parapet z elewacji) | 12,58–15,05; 0,70–2,21 | −0,18 / −0,03 / −0,35 / −0,24 | bez zmian | dwa odczyty obrazu niezgodne, model zostaje |
| Cieszynianki | W 3-2 | 4,61–6,92; 0,00–2,17 (elewacja) | 4,58–6,92; 1,28–2,17 | −0,02 / +0,03 / +1,28 / 0 | bez zmian | sprzeczne odczyty obrazu; nierozstrzygnięte, raport |
| Cieszynianki | FRONT 0-0 | 0,41–2,22 | 0,96–2,83 | **+0,58** / +0,07 / 0 / 0 | bez zmian | przedział z rzutu; pikselami nie przesuwamy |
| A01 | FRONT 0-0 | 0,38–2,72 | −0,22–2,71 | −0,31 / +0,59 / 0 / 0 | bez zmian | jw. |

Pełna lista wszystkich par (każda fasada, każdy otwór, z kodami i decyzją) jest
w `stage-reports/artifacts/analyzer-005y-n7-p2/tables.md`.

Zmiana w programie Marcówek ogranicza się do jednego polecenia: `height` 2.75 → 2.25 i proweniencja tego otworu.
Ściany, bryły, garaż i pozostałe otwory są bajt w bajt takie same. **Garaż bez regresji.**

## P2-E — nakładki

Dla każdego zarejestrowanego widoku powstają dwa obrazy w tym samym kadrze i skali, rysowane transformacją solvera:

- **A** — model na elewacji przed poprawką;
- **B** — po poprawce.

Legenda:

| kolor | znaczenie |
|---|---|
| cyjan | ściany |
| żółty | okap i kalenica |
| czerwony | otwory modelu |
| zielony | odczyt widoku |
| magenta | otwór poprawiony |
| pomarańczowy / niebieski | `MISSING` / `EXTRA` |

To nie jest render Three.js. Tło jest rastrem wydawcy, więc nakładki są **poza repozytorium**: przekazane OWNER-owi
jako ZIP i w `research/analyzer-005y-n7-p2/` jest skrypt, który je odtwarza.

Na nakładce B frontu Marcówek magenta pokrywa się z bramą garażową z rysunku. Na A czerwony prostokąt sięgał
0,55 m ponad bramę.

## P2-F — P1 zachowane

- Walidator `WALLS_OVERLAP` nie jest wyłączony.
- Bundel wyjęty z APK 1305 na Slivertonie daje dalej:
  - `PARTIAL_3D_PREVIEW`;
  - odmowę polecenia 21 (`createWallRing ring-attached-0-0`, `WALLS_OVERLAP`);
  - scenę `4ad30210…` i model `988e55bd…` — to samo co 1304.
- Model częściowy nie jest nigdzie oznaczany jako pełny.

Co nie da się pogodzić z odrzuconą bryłą dołączoną: P2 czyta tylko fasady ciał, które model zbudował.
Otwory w ścianach pominiętej bryły nie mają ściany w modelu, więc nie są ani porównywane, ani poprawiane.

## P2-G — testy

`packages/reconstruction/test/facade-alignment-n7-p2.test.ts` ma 13 testów na syntetycznych rastrach o wymyślonych
wymiarach.

**Skan:**

- okna, drzwi przeszklone i przeszklenie ze słupkiem na swoich pozycjach (±0,1 m);
- lamele odrzucone jako lamele;
- panel balustrady odrzucony jako balustrada.

**Pomiar z ziarnem:**

- ościeża przy przerwie rzutu przesuniętej o 0,15 m (±0,06 m);
- pusta ściana daje brak odczytu.

**Bramka:**

- korekta wysokości z konwencji przy zgodnym bliźniaku;
- **nigdy** przy opisie, przy widoku bez wysokości, bez bliźniaka ani gdy ściana nie mieści wyniku;
- offset i szerokość raportowane, przedział nietknięty.

**Kody:**

- `MISSING_IN_MODEL` i `EXTRA_IN_MODEL`;
- przypadek „ani potwierdzone, ani zaprzeczone”;
- `WRONG_FACADE` dla widoku bocznego przypisanego do złej strony;
- `UNREGISTERED_VIEW`.

**Rozstrzygnięcie opisu:**

- 275/225 → 225;
- brak decyzji, gdy pasują dwie różne liczby, gdy widok pasuje do już przyjętej albo gdy widok nie ma wysokości.

**Audyt widoków:** perspektywa nigdy nie jest elewacją, a widok odrzucony podaje powód i straty.

Uruchomione:

| zakres | wynik |
|---|---|
| `packages/reconstruction`, `packages/analysis-service`, `apps/local-analyzer`, `tests/architecture` | 1535 zielonych, 4 czerwone — wszystkie 4 czerwone także na bazie bez P2 (sprawdzone stashem) |
| `apps/analyzer-api` (wersja solvera) | zielone |
| Android `OwnerVisualScenesTest` (JVM) | 2/2 |
| powtórka 8 domów | 7 modeli bajt w bajt, Marcówki zmienione wyłącznie o tę bramę |

Cztery zastane czerwone:

- `wall-strip` ×2 — potrzebują bazy 005Q w klonie;
- `research-isolation` — rozmiar śledzonego pliku;
- `program.test.ts` Larchfield — scena nagrana w 03Y1.

**End-to-end z APK:** `analyzer.mjs` wyjęty z APK 1305, uruchomiony na żywej stronie Marcówek, daje model
**`8541ca10…`** — dokładnie ten z powtórki — wynik `COMPLETE`, solver 2.4.0.

Goździkowce: rejestracji nie odzyskano. Źródło nie daje kotwic: brak datum kalenicy, sylwetki boczne obejmują drzewa,
a pasma ścian nie ma. Dlatego 14 otworów jest `UNREGISTERED_VIEW`, a nie wymuszone.

Cieszynianki: narożnego tarasu P2 nie dotyka; model `5394c17c` bez zmian.

## APK

| | |
|---|---|
| plik | `BuildPlan-Model-Preview-arm64-v8a-debug.apk`, 39 716 626 B |
| SHA-256 | `000ef5f4a88e114aa3034d166676da82f48f18ebde722bde27e62573f0bfcc02` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1305** / `0.1305.0-owner` |
| podpis | ten sam klucz podglądu, cert `6e48fac4…`; `verify-preview-signature.sh`: ok |
| analizator w APK | `assets/local-analyzer/analyzer.mjs` SHA-256 **`0e46961dc8cdbc79427dab76e2cfcc54e3d8f902ce10b60a1f649c1eaf111eac`** (= `manifest.json`), solver 2.4.0; kod identyczny z bundlem zbudowanym z HEAD (różnią się tylko ścieżki esbuild) |

APK instaluje się na 1304: ten sam podpis i wyższy versionCode.

Urządzenia ani emulatora w tej sesji nie było. Test na telefonie należy do OWNER-a:
Projekt → Import projektu → Marcówki. Oczekiwane: brama garażowa niższa, nad nią pełna ściana.

## Ograniczenia, nazwane wprost

- Pikselowa wysokość otworu jest za słaba na samodzielną poprawkę (p80 0,37 m), więc 9 `HEAD_MISMATCH` i 5
  `SILL_MISMATCH` zostaje raportami.
- Szerokości i przesunięcia (17 i 18) wymagają drugiego niezależnego źródła — opisu albo drugiego widoku — zanim
  cokolwiek przesuniemy.
- 32 otwory nie mają zarejestrowanego widoku. Strony boczne bez kalenicy i z sylwetką niezgodną z obrysem pozostają
  nieczytane.
