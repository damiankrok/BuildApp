# STAGE BUILDPLAN-ANALYZER-005W — GOAL-DRIVEN VISUAL ITERATION

**Status: `VISUAL_CANDIDATE_IMPROVED_OWNER_REVIEW_PENDING`.** To nie jest akceptacja OWNER-a. Bramka rozmiaru APK nadal
jest czerwona, więc projekt nie jest w pełni zielony.

| | |
| --- | --- |
| Baza | `d2a6cb383f606337f5edbcdb89a618fe262c4988`; worktree czysty |
| Gałąź | `analyzer/005w-goal-driven-visual-iteration-v1`, jeden commit |
| Mirror CI | `claude/new-session-3kzcgh` = `bfaf286e…`, nietknięty |
| Nietknięte | `main`, wydania, APK |
| Źródło | prywatne rastry z cache zapieczętowanych pakietów N1v (A01, Marcówki, Rarytasy G2E, Cieszynianki), oglądane lokalnie |
| Ograniczenia źródła | bez pobierania i bez OCR; żaden piksel wydawcy nie trafił do repo; ZIP OWNER-a niedostępny |
| Ledger | `research/analyzer-005w-visual-iteration/ledger.json` |

## Co jest widać (A01, front)

Rendery z BuildWorld (Three.js): ten sam preset kamery i ten sam build viewera przed i po. Leżą poza repo, w
`/home/user/work005w/005w-renders.zip` (SHA-256 `850e361f…`). Paczka zawiera:
- A01: przód, tył, lewa, prawa, perspektywa ¾, góra;
- Goździkowce: przód i perspektywa;
- zestawienia przed/po.

| otwór (etykieta do oceny) | przed (model `d9329157`) | po (model `f7375a47`) |
| --- | --- | --- |
| 250/220 | okno 0,90–2,20, `ASSUMED` | szklenie wielopolowe **0,00–2,09**, `VISUAL_INFERRED` |
| 100/220 | drewniane drzwi 0–2,10 | **szkło pełnej wysokości 0,00–2,09** |
| 105/210 | drewniane drzwi 0–2,10 | drzwi (wejście) 0,00–2,02 |
| 90/210 | drewniane drzwi 0–2,10 | **szkło pełnej wysokości 0,00–2,02** |

Kolejność, położenie poziome i u/L się nie zmieniły. Dach z kalenicą X, jedna bryła i dwa kominy zostały bez zmian.

Na innych elewacjach A01:
- **tył:** okno 1,81 m z założonym parapetem 0,90 jest teraz przeszklonymi drzwiami tarasowymi 0–2,12, jak na
  źródle;
- **lewy szczyt, poddasze:** drewniane drzwi stały się szkłem 0–2,20 (wysokość z wydrukowanego 100/220).

## Metoda: otwór jako obiekt na tle ściany

Nie jest to kolejny próg luminancji. Rzut mówi, które odcinki tej ściany są pełne. Na zarejestrowanej elewacji te
odcinki pokazują, jak ściana wygląda w każdym wierszu (tynk, pas, cokół).

Wiersz kolumn otworu należy do otworu, jeśli większość jego pikseli nie przypomina żadnego odcinka ściany. Dotyczy to
tak samo szkła za paskowaną żaluzją, odbicia drzew i ciemnego skrzydła drzwi. Dalsze reguły:
- listwy i ślemiona dłuższe niż 0,3 m są mostkowane;
- przebieg musi mieć ścianę nad nadprożem (0,1 m);
- przebieg nie wychodzi ponad koniec ściany (kondygnacja, okap, połać nad szczytem);
- próg w odległości do 0,15 m od podłogi jest podłogą.

Rodzaj otworu wynika z rzutu. Jasne linie szklenia z N3 są brane pod uwagę **tylko** dla otworu z odczytaną wysokością.
Szeroki otwór do podłogi to szklenie, otwór z liniami szklenia bez własnego łuku to okno pełnej wysokości, a pusty
otwór to drzwi.

Gdzie czytnik obiektowy pracuje:
- tylko tam, gdzie nie ma wydrukowanej wysokości (callout);
- tylko tam, gdzie stary czytnik kontrastu nic nie przeczytał albo przeczytał fragment tego samego otworu;
- poza tym zachowanie jest jak w bazie.

Rejestracja na pasie ścian (N4) zasila **wyłącznie** otwory. Dach, okna dachowe, kominy i wykończenie ścian korzystają
tylko z rejestracji sylwetki. Widok z samego pasa jest przyjmowany dla ściany tylko wtedy, gdy ≥ 2/3 jej przerw z rzutu
(minimum 2) czyta się na nim jako otwory zamknięte nadprożem. Przerwy sprawdzają rejestrację, ale jej nie wybierają.

## Iteracje (szczegóły w ledgerze)

| # | zmiana | efekt | decyzja |
| --- | --- | --- | --- |
| 1 | N4 + N3 w całości, czytnik obiektowy wszędzie | A01: 4 z 4 otworów; ale zmieniły się wszystkie kontrole (szczyt Marcówek, progi Rarytasów, dach i kolor Cieszynianek, drzwi Goździkowców) | odrzucona |
| 2 | nadproże, koniec ściany, wiersze bez ściany, arbitraż „zawiera” | nie ma już przebiegów w szczyt; zostały przesunięcia progów przy calloutach | odrzucona |
| 3 | bez czytnika obiektowego przy calloucie, próg do podłogi | Rarytasy bajt w bajt | dalej |
| 4 | linie N3 tylko przy odczytanej wysokości | Goździkowce bajt w bajt | dalej |
| 5 | widok z pasa tylko dla otworów | dach i kolor Cieszynianek wracają; znikają 2 okna dachowe A01 (z błędnym położeniem na połaci); fałszywy odczyt na froncie Cieszynianek (rejestracja ~2× za mała skala) | dalej |
| 6 | sprawdzenie widoku z pasa na każdej ścianie | Cieszynianki bajt w bajt; front A01 dalej 4 z 4 | **przyjęta** |

Odrzucone w całości: GLAZED_DOOR „z symbolu” przy założonych wysokościach z N3. Zmieniał rodzaj drzwi w Goździkowcach
i Cieszyniankach bez odczytu wysokości.

## Kontrole (offline replay, SHA-256 modeli)

| dom | baza | po |
| --- | --- | --- |
| A01 | `d93291577e2d…` | `f7375a47b982e475efe0d52cfbd30aab0981b154d06ba6c004acdad1c1c37317` |
| Goździkowce 3 | `911456a88b25…` | **identyczny**: garaż nr 8, jego ściana i brama 3,22 m bez zmian; render frontu różni się tylko podpisem |
| Rarytasy G2E `m84f…` | `9f5fd342a53e…` | **identyczny** |
| Cieszynianki | `e4e562923319…` | **identyczny** |
| Marcówki | `f607464936c7…` | `cf7977438b0053903f0398548d0bfb0b569760864d1aa8c258992fc7459faee0`, jedna zmiana (niżej) |
| Rarytasy OWNER `m3ea…` | `NOT_RUN` | bez podmiany na `m84f…` |

Zmiana w Marcówkach: `opening-0-west-3-0` (0,9 m, 0–2,30, wysokości bez zmian) zmienia się z drewnianych drzwi
w szkło. Render boczny źródła pokazuje tam wąskie przeszklenie pełnej wysokości. Czy się otwiera, nie jest
odczytane.

Zmiany są zero w dachu, masach, powierzchniach i liczbie otworów. Prowenancja: progi i nadproża odczytane z elewacji to
`IMAGE_METRIC_REGISTERED`, w modelu `VISUAL_INFERRED`. Nigdzie nie ma `SOURCE_EXACT`, więc przedmiar ani koszt nie
potraktują ich jako pomiaru.

## Testy

| bramka | wynik |
| --- | --- |
| `packages/reconstruction` | 52 pliki, **803/803** |
| nowy `elevation-opening-extent.test.ts` | 11/11 |
| `tsc` | czysto |
| `tests/architecture/research-isolation.test.ts` | 70/71 — `KNOWN_BASELINE_FAIL`: APK 39 556 682 B > 32 MB |
| CI 41 jobów, APK, emulator, e2e | `NOT_RUN` |

Wszystkie obrazy w testach są syntetyczne. Testy obejmują:
- paskowaną żaluzję, odbicie i skrzydło drzwi;
- cegłę, ciemny i biały tynk;
- pustą ścianę;
- przebieg bez nadproża;
- ścianę bez czystego odcinka;
- odrzucony widok z pasa przesunięty o 1,3 m;
- pojedynczą przerwę bez możliwości sprawdzenia;
- brak zmian bez elewacji.

`glazing-symbol.test.ts` z N3 nie wchodzi, bo testował gałąź założonych wysokości, której nie przyjmuję.

## Zmienione ścieżki

- `packages/reconstruction/src/v2/openings-v2.ts`: czytnik obiektowy, arbitraż, bramka widoku z pasa, linie szklenia z N3
  przy odczytanej wysokości
- `packages/reconstruction/src/v2/reconstruct-v2.ts`: rejestracja z pasa (N4), tylko dla otworów
- `packages/reconstruction/src/v2/frame.ts`, `scan.ts`: rejestracja z pasa (z łatki N4)
- `packages/reconstruction/test/elevation-opening-extent.test.ts` (nowy), `elevation-wall-band.test.ts` (z N4)
- `research/analyzer-005w-visual-iteration/ledger.json`, ten raport, `PROJECT_STATUS.md`

## Otwarte

- **Okna dachowe A01 (78/118)** nadal brak. Widok z pasa nie zasila dachu, a położenie odczytane w iteracji 1 było na
  połaci za nisko.
- **Drugie wysokie okno lewego szczytu A01** (100/220) zostaje 1,14/1,22. Bazowa rejestracja lewej elewacji jest tam
  przesunięta o ~100 px.
- **Wejście A01** jest rysowane w drewnie (źródło: ciemny panel). Biały pas górnej kondygnacji i pergola nie są
  modelowane.
- **Cieszynianki, zachodnia ściana:** odczyty pełnowysokich przeszkleń wyglądały dobrze, ale rejestracja z pasa nie
  przechodzi sprawdzenia ściany, więc zostają założone.

STOP.
