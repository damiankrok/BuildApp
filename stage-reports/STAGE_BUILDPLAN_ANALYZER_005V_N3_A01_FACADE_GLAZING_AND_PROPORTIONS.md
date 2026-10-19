# STAGE BUILDPLAN-ANALYZER-005V-N3 — A01 FACADE GLAZING AND PROPORTIONS

**Werdykt: `PARTIAL_NOT_ADOPTED`**

Rodzaj i materiał dwóch szklanych otworów frontu A01 da się poprawić ogólną, przetestowaną zmianą. Wymaganej mierzalnej
poprawy proporcji pionowych frontu nie da się jednak uzyskać bez rejestracji elewacji frontowej, a jeden z dwóch
docelowych otworów (100/220) traci przy tej zmianie na proporcji. Dlatego kod produkcyjny pozostaje bez zmian.
Kandydat z testami leży jako łatka badawcza: `research/analyzer-005v-n3-facade/candidate-glazing-symbol.patch`.

To nie jest akceptacja OWNER-a (`OWNER_VISUAL_NOT_RETESTED`).

| | |
| --- | --- |
| Baza | `b35372963b3d8a0d7e3d3f487077e66be47905a8`; worktree czysty, bez dryfu |
| Gałąź | `analyzer/005v-n3-a01-facade-glazing-proportions-v1`, jeden commit (raport, status, `research/`) |
| Mirror CI | `claude/new-session-3kzcgh` = `bfaf286e…`, nietknięty |
| Nietknięte | `main`, tagi, wydania, `owner-preview-latest`, APK 39,6 MB |
| CI / APK / e2e / emulator | `NOT_RUN` |
| Model A01 bazy | `d93291577e2d795f19a2ebfab698e1e655ecf007f342e5ba7166c4c886a61be2` (replay offline; to nie jest APK OWNER-a 005T) |

## Źródło i rejestracja

- **Źródło:** cache strony wydawcy, z którego zbudowano zapieczętowany graf N1v (zestaw 005K). Obrazy oglądane
  prywatnie poza repozytorium. Nie pobierano nic nowego i nie obchodzono żadnej bramki.
- **Front:**
  - `frontSide = SHEET_BOTTOM` sprawdzone, a nie przyjęte.
  - Ramka grafu z etykietą FRONT (`…elewacja-b74ed2020b`) pokazuje od lewej cztery otwory dolnej ściany rzutu parteru,
    w tej samej kolejności i u/L z dokładnością do 0,01: 0,015 / 0,429 / 0,651 / 0,807.
  - Nie jest odbita. Ramka ogrodowa (`…-19da37ded6`) to tył.
- **Oś:** u od narożnika zachodniego, L = 10,5 m.

## FIRST_BAD

### 1. Rodzaj 100/220 i 90/210 (DOOR zamiast szklenia): `openings-v2.ts`, `glazingDrawn`

Łańcuch:
1. przerwa na rzucie (`planGaps`, szukanie muru z 005V);
2. brak odczytanego opisu i brak elewacji, więc `heightsAssumed`;
3. `doorBySymbol = szer. ≤ 1,3 && !glazingDrawn && kondygnacja 0`;
4. DOOR z progiem 0 i nadprożem 2,1 (`ASSUMED`);
5. `cutOpening` DOOR + `placeDoor` `mat-timber`;
6. brązowe skrzydło.

Pierwsze błędne rozstrzygnięcie: `glazingDrawn = false`. Dwa powody:

- **Próg jasności.** Liczony był tylko tusz ciemniejszy niż luma 160. Ten rzut rysuje szklenie trzema cienkimi szarymi
  liniami o lumie 181–199 (filar 32, posadzka 231, papier 248–255). Wejście 105/210 ma jedną linię progu i łuk skrzydła.
- **Błąd „mixed min”** (opisany już w N4). Skan wzdłuż ściany startował od mniejszej z czterech współrzędnych. Dla
  90/210 (kolumny 648–682, ściana na wierszu ~557) zaczynał się od kolumny 558 i przechodził przez filar i wejście.

### 2. Proporcje pionowe wszystkich czterech otworów frontu (`ASSUMED`): `reconstruct-v2.ts`, rejestracja elewacji

- Elewacja FRONT jest rejestrowana wyżej z zasięgiem x 210–1071 px. Sylwetka obejmuje pergolę obok domu (kolumny
  210–410). Sam dach to 367–1071 px, ściany około 411–1027 px.
- Kandydat rozpiętości dla FRONT to goła obwiednia 10,5 m: nawis szczytowy wzdłuż x jest nieznany, więc przyjęty jako 0.
- Ani 861 px, ani 704 px dachu nie stawia gruntu na rzędnej terenu: dla dachu wychodzi +0,79 m wobec −0,72 m, błąd
  > 0,9 m.
- Front zostaje odrzucony, więc żaden otwór frontu nie dostaje odczytanej wysokości.
- Próbowałem ponowić rejestrację na rozpiętości dachu. Nie wystarcza: potrzebna jest rozpiętość ścian pod dachem
  i nawis szczytowy. To byłaby trzecia zmiana produkcyjna, więc wycofana.

## Kandydat (nieprzyjęty): jedna zmiana w `openings-v2.ts` + test

- **Wykrywanie szklenia:**
  - poprawiony błąd „mixed min”;
  - drugi dopuszczalny podpis: co najmniej dwie cienkie linie (luma < 215) w poprzek narysowanego pasa ściany
    (środek z miejsca, gdzie przerwa była czytana, ±0,25 m) w ≥ 60 % kolumn;
  - jedna linia, czyli próg drzwi, nie jest szkleniem;
  - stary test ciemnego tuszu zostaje.
- **Rodzaj przy założonych wysokościach:**
  - szklenie + narysowany łuk → `GLAZED_DOOR` (rodzaj `SOURCE_DERIVED`, wysokości drzwi `ASSUMED`);
  - szklenie bez łuku → okno w konwencji 005U (próg 0,9 m, `ASSUMED`; nigdy pełnowysokie bez odczytanej wysokości);
  - pusta przerwa w parterze → drzwi jak dotąd.
- **`glazing-symbol.test.ts`** (6 testów): 3 czerwone na bazie (lekkie szklenie, drzwi szklone, „mixed min”), 3 negatywy
  zielone na obu wersjach (sam próg, łuk bez szklenia, szeroki ekran).

### A01: front przed i po (kandydat)

| źródło (opis, elewacja) | u0–u1 źródła | przed | kandydat | ocena |
| --- | --- | --- | --- | --- |
| 250/220 duże przeszklenie | 0,015–0,255 | WINDOW szkło 0,90–2,20 | bez zmian | położenie ✓, próg założony |
| 100/220 wysokie przeszklenie | 0,429–0,521 | DOOR drewno 0–2,10 | WINDOW szkło 0,90–2,20 | rodzaj i materiał ✓; **proporcja gorsza**: 1,30 m wobec 2,20 (było 2,10) |
| 105/210 wejście | 0,651–0,726 | DOOR drewno 0–2,10 | bez zmian | symbol wejścia zachowany ✓ |
| 90/210 przeszklenie boczne | 0,807–0,883 | DOOR drewno 0–2,10 | GLAZED_DOOR szkło 0–2,10 | materiał ✓, 0,89 × 2,10 = 90/210 ✓; łuk przypisany mu jest łukiem wejścia (istniejący fałszywy odczyt), w źródle to panel stały |

Na szczycie poddasza (lewa ściana) `opening-1-west-7-0` (źródło 110/220, szklenie + łuk) zmienia się z DOOR drewno
0–2,20 na WINDOW szkło 0–2,20. Wysokość odczytana jest z lewej elewacji, więc proporcja pokrywa się ze źródłem.

### Kontrole (replay offline; tylko zmienione otwory, każdy sprawdzony na rzucie)

| dom | otwór | źródło | przed | kandydat | ocena |
| --- | --- | --- | --- | --- | --- |
| Goździkowce | `opening-0-west-3-1` | 110/140 okno | DOOR drewno | WINDOW szkło 0,9–2,2 | ✓ |
| Goździkowce | `opening-1-east-5-0` | 110/220 + łuk | DOOR drewno | GLAZED_DOOR szkło | ✓ |
| Goździkowce | `opening-1-east-5-2` | 110/220 + łuk | DOOR drewno | GLAZED_DOOR szkło | ✓ |
| Marcówki | `opening-0-west-3-0` | 90/230 bez łuku | DOOR drewno 0–2,3 (odczytane) | WINDOW szkło 0–2,3 | ✓ |
| Cieszynianki | `opening-0-east-1-1` | 90/150 okno | DOOR drewno 0–2,1 | GLAZED_DOOR szkło 0–2,1 | materiał bliżej; rodzaj i wysokość nadal złe (istniejący fałszywy łuk od mebli) |
| Cieszynianki | `opening-0-east-1-2` | 90/150 okno | DOOR drewno 0–2,1 | GLAZED_DOOR szkło 0–2,1 | jak wyżej |
| Rarytasy G2E | — | — | — | — | identyczny |

Niezmienniki kandydata:
- **A01:** GABLE, kalenica X, 2 kominy, 4 otwory frontu, 0 błędów geometrii, 0 `OPENING_ABOVE_WALL_TOP`.
- **Goździkowce:** garaż nr 8 (26,09 m²) i brama 3,22 m bez zmian.

### Testy kandydata (łatka zastosowana tymczasowo)

| test | wynik |
| --- | --- |
| `glazing-symbol.test.ts` | 6/6 |
| `wall-strip.test.ts` | 65/65 |
| `interior-unwalled-side.test.ts` | 5/5 |
| `garage-label-mouth.test.ts` | 13/13 |
| `roof-apex-eaves.test.ts` | 10/10 |
| `packages/reconstruction` + `research-isolation` | 864/865 |
| `tsc` | czysto |

Jedyny czerwony test to bramka rozmiaru APK (39 556 682 B > 32 MB, `KNOWN_BASELINE_FAIL`, nieruszona).
Commitowane drzewo produkcyjnie = baza.

## Rendery (prawdziwa przeglądarka BuildWorld, Three.js; ta sama kamera)

- Widoki: przód orto, ¾, lewy bok. Po 3 ujęcia dla bazy i kandydata plus 3 zestawienia.
- Archiwum jest poza repozytorium i przekazane w plikach sesji.
- Kroki odtworzenia: `research/analyzer-005v-n3-facade/render-steps.md`. Liczby: `ledger.json`.

Co widać:
- **Front:** dwa brązowe skrzydła znikają. Jest małe okno 1,0 × 1,3 m na założonym progu 0,9 m oraz szklane drzwi
  0,89 × 2,1 m.
- **Lewy bok:** brązowe drzwi poddasza stają się wysokim przeszkleniem 1,1 × 2,2 m.

## Dlaczego nie przyjęto

Warunki `EVIDENCED_A01_FACADE_VISUAL_IMPROVEMENT` wymagają mierzalnej poprawy proporcji frontu i sensownych proporcji
poprawionych otworów.
- 90/210: materiał ✓, proporcja bez zmian (już zgodna).
- 100/220: materiał ✓, ale wysokość oddala się od źródła z 2,10 do 1,30 m wobec 2,20.

Jedyną drogą do odczytanej wysokości frontu jest rejestracja elewacji frontowej (FIRST_BAD 2).

**Decyzja dla koordynatora (nie podjęta):**
- (a) przyjąć kandydata jako poprawę rodzaju i materiału, z jawnie gorszą proporcją 100/220 do czasu rejestracji frontu;
  albo
- (b) najpierw osobny etap rejestracji elewacji (rozpiętość ścian pod dachem, nawis szczytowy, wykluczenie pergoli),
  potem ten kandydat.

## Dług poza zakresem (bez zmian)

- Prawy szczyt: brak 100/220 ×2.
- Okna połaciowe 78/118.
- Rzędna +3,06 wobec +2,80.
- Grubość muru 0,152 m wobec ~0,42 m.
- Fałszywe łuki `doorSwingDrawn` od mebli i sąsiednich drzwi.
- Rarytasy OWNER `m3ea…`: `NOT_RUN`.

STOP.
