# STAGE BUILDPLAN-ANALYZER-005U-N4-GARAGE-LABEL-CALLOUT-FIRST-BAD

**Werdykt: `SAFE_INTEGRAL_GARAGE_DOOR_RECOVERED`.** Zakres tego werdyktu:

| odzyskane | stan |
| --- | --- |
| tożsamość garażu (`main-room-0-1`, numer 8 = „Garaż”) | **TAK**: z odczytu numeru na rysunku + listy wydawcy |
| rodzaj otworu wjazdowego (`GARAGE_DOOR`, rodzaj `SOURCE_DERIVED`) | **TAK**: z jedynej otwartej strony rzutu przy tym pokoju |
| wymiary bramy z calloutu 325/225 | **NIE, `UNRESOLVED`** |

Szerokość bramy pochodzi z luki na rzucie (3,22 m, `SOURCE_DERIVED`). Parapet i nadproże to konwencja do renderu
(`ASSUMED_FOR_RENDERING`, 0 / 2,2 m), a nie wymiar do kosztorysu. **OWNER_VISUAL_NOT_RETESTED. CI/APK NOT_RUN.**

| | |
| --- | --- |
| Repozytorium / gałąź | `damiankrok/BuildApp`, `analyzer/005u-n4-garage-label-callout-first-bad-v1` |
| Baza | `d5d14be1708cfc7cc21587a56619a4a65f286b6c`. Na starcie HEAD = origin, worktree czysty, brak drifta |
| HEAD / porównanie | commit z tym raportem; <https://github.com/damiankrok/BuildApp/compare/d5d14be...analyzer/005u-n4-garage-label-callout-first-bad-v1> |
| Mirror `claude/new-session-3kzcgh` | `bfaf286e95105c2cdb32df2d298d3cd93bd43449`, nietknięty. `main`, tagi, wydania i APK nietknięte |
| Ścieżki w diffie | `packages/reconstruction/src/v2/{interior,openings-v2,reconstruct-v2}.ts`, `packages/reconstruction/test/garage-label-mouth.test.ts`, `research/analyzer-005u-n4-garage-ocr/{trace.ndjson,before-after.json}`, ten raport, `PROJECT_STATUS.md` |
| Źródła | piksele rzutów z lokalnego cache: **YES** (prywatnie, poza repo; nic nie zacommitowane). ZIP OWNER-a: **NO**. Nowych pobrań: brak. Nowego biegu OCR: brak (tylko replay solvera na zapieczętowanych danych) |

## 1. Reprodukcja

Replay offline solvera na zapieczętowanym N1v i metrykach z 005T daje `5a828478…fe0a`, czyli bit w bit model z N3.
OCR nie był uruchamiany ponownie: wszystkie odczyty niżej pochodzą z zapieczętowanego `metric-evidence`.

## 2. A. Numer pomieszczenia: FIRST_BAD

Ten sam atrament w px (534–545, 484–501) przeczytany na cztery sposoby (`ocr.ts`, `readNumbers` z hipotezami):

| odczyt | orientacja | wys. px | dopasowanie / glif | pewność | glify | merit | pageVote |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `8` | HORIZONTAL | 17 | 0,333 | 0,547 | 1 | 0,182 | DISCARDED |
| `/13` | ROTATED_CCW | 11 | 0,203 | 0,548 | 3 | **0,333** | **KEPT** |
| `0` | INVERTED | 17 | 0,326 | 0,607 | 1 | 0,198 | DISCARDED |
| `51±` | ROTATED_CW | 11 | 0,133 | 0,507 | 3 | 0,202 | DISCARDED |

**Pierwsza zła decyzja:** `dedupeOrientations` w `packages/source-metrics/src/ocr.ts`.
- Merit liczy się jako `tokenMerit = score × confidence × liczba glifów` (linia 911). Pętla starć (linie 944–953) zachowuje
  odczyt o większym merit.
- Trzyglifowy szum `/13` wygrywa z czystym pionowym `8` tylko dlatego, że ma więcej glifów, choć każdy z nich jest
  dopasowany gorzej.
- Konsument tej decyzji to `reconstruct-v2.ts:809`: odrzucał każdy `DISCARDED` przed numerowaniem pokoi.

**Czego nie zmieniłem:** samego głosowania strony. Ono rozstrzyga orientację wymiarów na całym arkuszu i zmiana by
przestawiła odczyty wymiarów.

**Mieszczenie:**
- token leży w `main-room-0-1` (x 9,0–13,5, z 0,3–6,55, 26,09 m²) i w żadnym innym pokoju;
- inne `8` na arkuszu (px 192/705, 703/403, 651/297) leżą poza obrysem budynku, w liniach wymiarowych.

## 3. B. Callout bramy

| | |
| --- | --- |
| dowód | `metric-callout-ring-fcc74e2d4b`, pierścień 24 px, pole (515–539, 601–625) pod luką |
| czytnik własny (`callouts.ts`, `readOpeningCallouts` → `readHalf`) | górna połówka 4,67 px wys.: 176 / 170 / 476 / 126 / 186 / 175; dolna 3,33 px: 140 / 400 / 40. Pewność 0,143, „halves not read as one coherent pair” |
| PaddleOCR PP-OCRv6 (`ocr.ppocrv6-tiny-rec@9ef676d6`) | **nie ma drogi**: zewnętrzny czytnik dostaje wyłącznie wycinki etykiet wymiarowych z kraty (`extract.ts` 437–454). Pierścienie calloutów do niego nie trafiają. Nie twierdzę, że Paddle cokolwiek tu odczytał |
| wynik | **`UNRESOLVED`** |

Wynik `UNRESOLVED` wynika z dwóch rzeczy:
- żaden kandydat szerokości nie mieści się w 12 % od luki 3,22 m, więc callout nie jest wiązany;
- cyfry o wysokości 3–5 px są poniżej czytelności, a bramek nie luzowałem.

## 4. C. Wiązanie z wjazdem: FIRST_BAD i poprawka

**Pierwsza zła decyzja (brama):** `openings-v2.ts`, dawna linia 328. `attachedVehicle` wymaga `attachedSingleStorey`, czyli
`m.role === 'ATTACHED'` z jedną kondygnacją (`reconstruct-v2.ts:871`). Garaż wbudowany w dwukondygnacyjną MAIN nie miał
żadnej drogi do bramy, więc luka bez odczytanych wysokości zostawała placeholderem okna.

**Poprawka.** Jeden pionowy wycinek, dwa ściśle zależne miejsca: etykieta i wiązanie.

1. **Numer z odłożonego odczytu** (`interior.ts`; `reconstruct-v2.ts` przekazuje odczyty `DISCARDED` jako
   `setAside`). Pokój, którego żaden zachowany odczyt nie numeruje, może przyjąć numer z odłożonego odczytu tylko gdy
   spełnione są wszystkie warunki:
   - odczyt jest **pionowy** (HORIZONTAL);
   - jest **jedynym** odczytem tego atramentu, który nazywa opublikowany pokój tej kondygnacji;
   - ten sam numer nie jest czytany na **żadnej innej** etykiecie w obrysie kondygnacji (w dowolnej orientacji, w
     rozmiarze numeru pokoju);
   - numer nie jest zajęty przez inny pokój;
   - powierzchnia nie odbiega o więcej niż 40 %. To jest sprawdzenie, a nie wybór.

   Każda odmowa trafia do `unresolved`. Powierzchnia nigdy nie wybiera numeru.
2. **Jedyna otwarta strona garażu** (`openings-v2.ts` `garageMouth` + `vehicleMouth`; `reconstruct-v2.ts`). Pokój z
   numerem, który lista wydawcy nazywa garażem (`GARAGE_LABEL = /gara[zżg]/i`, nazwa, nie slug), stykający się ze ścianą
   zewnętrzną w miejscu, gdzie dekompozycja rzutu zdecydowała `OPEN_SIDE`, ma tam bramę:
   - wycinek ma leżeć wzdłuż ściany pokoju (≥ 80 %), w dowolnej bryle;
   - wylot wnęki (`RECESS_MOUTH`) się nie liczy;
   - przy **dwóch** takich stronach brama nie powstaje, a sprawa trafia do `AMBIGUOUS`; przy zerze nie ma nic;
   - luka z narysowanym przeszkleniem albo na piętrze nie jest bramą;
   - gdy callout kiedyś zostanie odczytany, działa ta sama droga z wymiarami odczytanymi.

   W Goździkowcach wschodnia luka 2,87 m na granicy garażu (okno 290/100) nie jest stroną otwartą: dekompozycja czyta tam
   ciągłą ścianę. Strona pasująca jest dokładnie jedna: `wide-Y-598-465-590` (`compound-Y-598-284-590/i1`, przekreślona
   przerywaną).

Bez slugów, bez stałych `8`, `325` ani `225`, bez postprocessingu modelu i renderera.

## 5. Przed → po (Goździkowce)

| | przed (N3) | po |
| --- | --- | --- |
| model SHA-256 | `5a828478…fe0a` | `b022b7c703e8223017585969458998e97180bb6e3fbf5f752e6ae822775687ec` |
| scena SHA-256 (lokalnie, poza Gitem) | `7dfc0ab2…f1e0` | `0f52a4fe…5829` (161 siatek, 115 obiektów; round-trip i determinizm OK) |
| `main-room-0-1` | 26,09 m², bez numeru | numer 8 = **Garaż** 25,38 m² (3 % odchyłki) |
| `opening-0-front-0-2` (ściana `ring-main-0-w0`, offset 9,33 m) | WINDOW 3,22 m, parapet 0,9 m, `kind` ASSUMED | **GARAGE_DOOR** 3,22 m; `kind` SOURCE_DERIVED; parapet 0 m, wysokość 2,2 m ASSUMED; skrzydło PANEL (`…-leaf` zamiast `…-unit`) |
| otwory / okna / drzwi | 29 / 11 / 18 | 29 / 10 / 19 |
| bryła, dach, komin, ściany | — | bez zmian |

## 6. Kontrole (hasz wobec N3 i przyczyna)

| dom | N3 | po | przyczyna |
| --- | --- | --- | --- |
| Rarytasy G2E `m84f2903cb8e14` | `9f5fd342…21e7` | `9f5fd342…21e7` = | Pokój 2,69 m² dostał propozycję „5” (Salon, 92 % odchyłki) i ją odrzucono |
| Marcówki | `f6074649…3321` | `f6074649…3321` = | Dwa odrzucenia, zob. niżej |
| Cieszynianki (HIP) | `e4e56292…1c6f` | `e4e56292…1c6f` = | — |
| A01 `m60124f28f071a` | `2b61ec4a…0445` | `eb793589…02fd` | Wyłącznie rekord pokoju `main-room-0-1`: numer 1 = Wiatrołap 4,49 m² (pokój 5,48 m², 22 %). Pionowe „1” w px 581–587 × 468–487 leży tam, gdzie rzut drukuje „1”. Ściany, otwory, dach bez zmian |

Odrzucenia w Marcówkach:
- **Parter:** pionowe „4” w px 372–381 × 562–578 to w rzeczywistości „9” garażu, przeczytane błędnie. Odrzuciła je
  reguła „numer czytany gdzie indziej w obrysie” (px 143–153 × 562–578). Bez tej reguły w garażu stanąłby „Salon”, co
  zmierzyłem w pierwszej wersji i wycofałem.
- **Poddasze:** „4” w px 117–126 × 498–514 to **prawdziwy** pokój 4 (Łazienka). Reguła odrzuca go zachowawczo, bo inna
  etykieta w obrysie też czyta się jako „4”. To utracony prawdziwy odczyt, a nie błąd.

Precyzja przed zasięgiem.

Negatywy na kontrolach:
- nie powstał nowy komin, masa ani dach;
- żadna inna brama, okno ani wysokość okien i drzwi balkonowych się nie zmieniły;
- brama w `ATTACHED` idzie dotychczasową drogą (`attachedVehicle`, testy `assumed-sill-family`).

## 7. Testy (zmierzone)

- Nowy test `packages/reconstruction/test/garage-label-mouth.test.ts` (13 przypadków):
  - **Numer pokoju:**
    - pozytywny: pionowe „8” obok rotowanego szumu `/13`;
    - negatywy: dwa opublikowane numery z jednego atramentu (np. 8/3) → nie wybiera; odczyt nie pionowy; ten sam numer
      gdzie indziej na kondygnacji; powierzchnia > 40 % odchyłki; numer spoza listy tej kondygnacji (inna edycja,
      pusta lista).
  - **`garageMouth`:**
    - jedna strona → wylot;
    - dwie strony → obie zwrócone, a wywołujący zostawia `AMBIGUOUS`;
    - brak numeru, inna nazwa pokoju, wylot wnęki albo strona poza garażem → `[]`.
  - **Rodzaj otworu:**
    - wylot w MAIN → `GARAGE_DOOR` z proweniencją;
    - ta sama szeroka luka bez garażu → WINDOW;
    - przeszklenie przez wylot → nie brama;
    - piętro → nie brama.
  - **Na starym kodzie:** 10 czerwonych, 3 zielone (to negatywy, które mają trzymać zawsze). **Na nowym:** 13/13.
- Rodziny celowane, 28 plików, **371/372**:
  - `interior-wall-thick-partition`, `plan-bodies-wall-sliver`, `assumed-sill-family`, `attached-bodies`,
    `attached-roof-form`;
  - `fixtures-v2`, `storey-emission`, `wall-topology`, `openings`, `wide-openings`, `plan-decomposition`, `layout`,
    `walled-off`;
  - `roof-datum`, `fit-and-levels`, `vehicle-door-depth`, `compound-facade-*`, `source-metrics/ocr*`;
  - `analysis-service` (`exterior-frame-fit`, `warnings`), `candidates/sealed`, `mobile-scene/owner-005t`, architektura
    `generalization` / `analyzer-v2` / `research-isolation`.
  - Jedyny fail to bramka z §8.
- `npx tsc -p tsconfig.json`: zielono.
- Replaye offline: 5 domów.
- Nie uruchamiano: pełnego `npm test`, 41 jobów CI, e2e, emulatora, APK ani nowego OCR.

Zauważone, nienaprawione (poza wycinkiem): `glazingDrawn` w `openings-v2.ts:379–385` wybiera początek próbkowania przez
mieszane `min` po x i y. Dla ściany frontowej leżącej na wierszu arkusza o numerze mniejszym niż jej kolumny próbkuje zły
odcinek. Na arkuszu Goździkowców (wiersz 598, kolumny 330–480) nie występuje. Fiksturę testu ustawiłem tak, jak leży
prawdziwy rzut.

## 8. BASELINE_KNOWN_APK_SIZE_FAILURE

`tests/architecture/research-isolation.test.ts` › „no tracked file anywhere is the size of a model” failuje od `074d6ae`:
- plik `stage-reports/artifacts/owner-005t/BuildPlan-005T-two-houses-arm64.apk` ma 39 556 682 B;
- limit wynosi 32 MB.

Tego nie naprawiam:
- nie zmieniam limitu;
- nie usuwam pliku;
- nie deklaruję PASS.

## 9. Otwarte

- **Wymiary bramy:** callout 325/225 jest nieczytelny dla obu dróg OCR. Wysokość jest założona, więc model nie nadaje
  się do wyceny bramy.
- **Marcówki:** zachowawcza reguła odrzuca prawdziwy numer 4 na poddaszu.
- **Goździkowce:** wiatrołap 10,56 m² wobec 6,86 m²; poddasze wystaje 33 m²; datum kalenicy przybliżone.
- **A01:** brak wejścia na parterze, poddasze niezweryfikowane.
- **OWNER_VISUAL_NOT_RETESTED; CI/APK NOT_RUN.**

`BUILDPLAN_ANALYZER_005U_N4_GARAGE_LABEL_CALLOUT_FIRST_BAD_SAFE_INTEGRAL_GARAGE_DOOR_RECOVERED`
