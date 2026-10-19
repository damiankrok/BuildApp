# STAGE BUILDPLAN-ANALYZER-005V-N4 — A01 FRONT WALL REGISTRATION

**Werdykt: `PARTIAL_FRONT_REGISTRATION_RESEARCH_ONLY`**

Rejestracja elewacji frontowej A01 na pasie ścian działa i jest niezależnie potwierdzona. Czytnik wysokości otworów na
tym renderze czyta jednak źle (jeden fałszywy odczyt, trzy puste), więc przyjęcie pogorszyłoby 100/220. Kod produkcyjny
pozostaje bez zmian. Kandydat z testem leży w
`research/analyzer-005v-n4-front-wall/candidate-wall-band-registration.patch`.

`OWNER_VISUAL_NOT_RETESTED`.

| | |
| --- | --- |
| Baza | `83c41421f6217d6a94ea07689d8f68b4548ec6cc`; worktree czysty |
| Gałąź | `analyzer/005v-n4-a01-front-wall-registration-v1`, jeden commit |
| Mirror CI | `claude/new-session-3kzcgh` = `bfaf286e…`, nietknięty |
| Nietknięte | `main`, `owner-preview-latest`, tagi, wydania |
| Model A01 bazy | `d93291577e2d795f19a2ebfab698e1e655ecf007f342e5ba7166c4c886a61be2` |
| CI / APK / e2e | `NOT_RUN` |
| Łatka szklenia z N3 | niezastosowana: warunek wstępny (odczytane, sensowne progi i nadproża frontu) niespełniony |

**Zmienione ścieżki:**
- `stage-reports/STAGE_BUILDPLAN_ANALYZER_005V_N4_A01_FRONT_WALL_REGISTRATION.md`
- `research/analyzer-005v-n4-front-wall/preregistration.md`
- `research/analyzer-005v-n4-front-wall/ledger.json`
- `research/analyzer-005v-n4-front-wall/candidate-wall-band-registration.patch`
- `PROJECT_STATUS.md` (dopisek)

## Źródło i tożsamość ramki

- **Źródło:** prywatne rastry z cache zapieczętowanego źródła N1v (zestaw 005K). Oglądane lokalnie, nic nie
  commitowane ani publikowane, nic nie pobierane.
- **Ramka FRONT:** `…elewacja-b74ed2020b`. Cztery przerwy dolnej ściany rzutu rzutują po rejestracji na cztery otwory
  tej elewacji, w tej samej kolejności i bez odbicia (tabela niżej).
- **Tył** (`…-19da37ded6`) rejestruje się osobno, na własnym pasie ściany.

## Pomiary prywatne na elewacji FRONT (piksele 1280 × 630; obserwacje, nie stałe)

| element | x [px] | wiersze [px] | uwaga |
| --- | --- | --- | --- |
| sylwetka | 210–1071 | 122–616 | — |
| pergola | ~190–410 | ~460–610 | beżowa, rozpiętość kanałów > 40, nie jest neutralna |
| dach | 365–1071 | 123–377 | pas neutralny w 169 wierszach |
| ściana pod okapem | 411–1027 | 378–475 | 47 wierszy |
| kalenica | — | 123 | — |
| okap | — | 377 | — |
| dół sylwetki | — | 616 | — |
| tył: pas ściany | 286–903 | — | 617 px, tyle samo co front, dla tej samej ściany 10,5 m |

## FIRST_BAD

### 1. Rejestracja: `registerElevationFrames` → `registerElevationV2` (`v2/frame.ts`, wołane z `v2/reconstruct-v2.ts` ~560)

- Sylwetka FRONT obejmuje pergolę.
- Kandydat rozpiętości dla FRONT to goła obwiednia 10,5 m (nawis boczny 0).
- Grunt wypada na +1,9 m (cała sylwetka) albo +0,79 m (sam dach) wobec rzędnej terenu −0,72. Błąd > 0,9, odmowa.

### 2. Wysokości otworów: `elevationExtent` → `verticalOpeningExtent`

Po rejestracji:
- dla 250/220, 105/210 i 90/210 czytnik nie znajduje zakresu;
- 100/220 czyta jako wiersze 542–597 (0,06–1,00 m).

Na szkle render rysuje paskowane żaluzje i odbicia: luma 50–217, rozpiętość kanałów 30–64. Ich średnia luma jest bliska
ścianie (~150, rozpiętość 6). Kontrast średniej lumy nie widzi górnej części szyby.

To jest pozostały FIRST_BAD dla wysokości. Leży we wspólnym czytniku elewacji, którego używa każda zarejestrowana
elewacja wszystkich domów, więc jego zmiana wykracza poza ten etap.

## Kandydat (nieprzyjęty)

**Reguła** (ogólna, bez slugów, współrzędnych i wymiarów):
- działa wyłącznie, gdy rejestracja sylwetki odmawia;
- powtarzalne pasy neutralnych pikseli przez sylwetkę (≥ 10 % wierszy, ≥ 40 % szerokości) są skalowane samą
  szerokością ścian z planu (jedna skala X = Y);
- wierzchołek zostaje rzędną kalenicy;
- pas jest przyjęty tylko, gdy grunt trafia w teren w niezmienionej tolerancji 0,9 m; wygrywa najbliższy;
- otwory nie biorą udziału w wyborze.

Odstępstwo od preregistracji: próg 25 % wierszy wybrałby dach. Zmiana na 10 % + selekcja kontrolą pionu jest zapisana
jawnie w `preregistration.md`.

| elewacja | pas [px] | m/px | grunt | błąd wobec terenu −0,72 |
| --- | --- | --- | --- | --- |
| FRONT | 411–1027 | 0,017045 | −0,26 | 0,46 (wobec −0,32 z przekroju: 0,06) |
| REAR | 286–903 | 0,017018 | −0,30 | 0,42 |

**Niezależna kontrola: otwory** (nie są kotwicą).

| źródło | kolumny na elewacji (prywatnie) | rzut przerwy | rezydual u/L |
| --- | --- | --- | --- |
| 250/220 | 420–568 | 419,1–570,7 | 0,003 |
| 100/220 | 675–732 | 674,3–732,7 | 0,001 |
| 105/210 (+ pas drewna) | 812–873 | 811,4–873,3 | 0,001 |
| 90/210 | 908–955 | 905,5–957,9 | 0,004 |

Kolejność ta sama, bez odbicia.

### Skutek kandydata dla otworów frontu A01

| otwór | przed (baza) | z kandydatem | źródło (opis, odczyt prywatny) |
| --- | --- | --- | --- |
| 250/220 | WINDOW szkło 0,90–2,20 `ASSUMED` | bez zmian | ~0–2,20 |
| 100/220 | DOOR drewno 0–2,10 `ASSUMED` | DOOR drewno **0,06–0,99** `VISUAL_INFERRED` | ~0–2,20 → **pogorszenie** |
| 105/210 | DOOR drewno 0–2,10 | bez zmian | 0–2,10 |
| 90/210 | DOOR drewno 0–2,10 | bez zmian | 0–2,10, szkło |

Inne skutki (nieweryfikowane w tym etapie):
- A01 dostaje 2 okna dachowe odczytane z nowo zarejestrowanych renderów przodu i tyłu (`rooflights` 0 → 2). Źródło ma
  okna dachowe 78/118.
- W Cieszyniankach pas rejestruje nową elewację:
  - okno 4,23 m `opening-0-west-3-0` zmienia się z 0,90/1,30 `ASSUMED` na 1,15/1,33 `VISUAL_INFERRED`;
  - zmienia się dach i dochodzi jeden region powierzchni.
- Goździkowce, Marcówki, Rarytasy G2E: bajt w bajt identyczne.

### Testy kandydata (łatka zastosowana tymczasowo)

| test | wynik |
| --- | --- |
| `elevation-wall-band.test.ts` | 4/4, 2 czerwone na bazie |
| `wall-strip.test.ts` | 65/65 |
| `interior-unwalled-side.test.ts` | 5/5 |
| `garage-label-mouth.test.ts` | 13/13 |
| `roof-apex-eaves.test.ts` | 10/10 |
| `tsc` | czysto |

## Replaye offline (SHA-256 modeli)

| dom | baza (= commitowane drzewo) | kandydat |
| --- | --- | --- |
| A01 | `d93291577e2d795f19a2ebfab698e1e655ecf007f342e5ba7166c4c886a61be2` | `82c5d02e80d844f9634031b0d9ecbe394d75f47703840da1d837e6fc09c47101` |
| Goździkowce | `911456a88b2530c9cf01b348dc7045a7b7bcc6d85e62e58221e5f205d41efbbc` | identyczny (garaż nr 8, brama 3,22 m) |
| Marcówki | `f607464936c7a13368d7f9307fb004e5bbad8b0da4490981851a33616c573321` | identyczny |
| Rarytasy G2E `m84f…` | `9f5fd342a53edf54f203533f18e21d37805574ea8d1038fa4dbb092d584d21e7` | identyczny |
| Cieszynianki | `e4e562923319084fda0b9ae934bcb1185a7098c53e7727c82f9afdcb592c1f6c` | `69f790d507753c04335f2cc583261bb0cb6c3180c179ae9977fadcf0b8cc80ec` (zmieniony, wyżej) |
| Rarytasy OWNER `m3ea…` | `NOT_RUN` | — |

## Rendery

`RENDER_NOT_RUN`: kandydat nie jest przyjęty i pogarsza 100/220. Nie ogłaszam żadnej poprawy wizualnej.

## Bramka APK

`research-isolation` nadal FAIL: śledzony APK 39 556 682 B > 32 MB (`KNOWN_BASELINE_FAIL`). Nieruszona, bez
`ALL_GREEN`.

## Następny minimalny krok (do decyzji koordynatora; nie rozpoczęty)

1. Czytnik wysokości otworu na zarejestrowanym renderze: kontrast barwy i wariancji zamiast średniej lumy, z regresją na
   wszystkich elewacjach już czytanych w kontrolach.
2. Dopiero potem kandydat rejestracji i łatka szklenia z N3.
3. Weryfikacja okien dachowych A01 i zmian w Cieszyniankach.

STOP.
