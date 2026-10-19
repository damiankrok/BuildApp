# STAGE BUILDPLAN-ANALYZER-005V-N2 — WALL CONTRACT ADOPTION

**Werdykt: `ADOPTED_WALL_GUARD_AND_VERSIONED_ENTRANCE_CONTRACT`**

To nie jest akceptacja OWNER-a (`OWNER_VISUAL_NOT_RETESTED`). Projekt **nie** jest w pełni zielony: znana bramka
rozmiaru APK zostaje czerwona.

| | |
| --- | --- |
| Baza | `2b3f6cae2826055d886e2c124e4af7e1390c63ff` (rodzic `6af3d71`); worktree czysty, bez dryfu |
| Gałąź | `analyzer/005v-n2-wall-contract-adoption-v1`, jeden commit |
| Mirror CI | `claude/new-session-3kzcgh` = `bfaf286e95105c2cdb32df2d298d3cd93bd43449`, nietknięty |
| Nietknięte | `main`, wydania, tagi, APK OWNER-a |
| CI / APK / e2e / emulator | `NOT_RUN` |

## Co się zmieniło

| plik | zmiana |
| --- | --- |
| `packages/reconstruction/src/v2/interior.ts` | **jedyna zmiana produkcyjna**: kandydat z N1 (`UNWALLED_SIDE_COVER = 0.05`) zastosowany bez poprawek |
| `packages/reconstruction/test/wall-strip.test.ts` | wersjonowany kontrakt `N3_THICK_INTERIOR_WALLS_EXPECTED` + 2 testy |
| `packages/reconstruction/test/interior-unwalled-side.test.ts` | nowy, 5 testów: kontrola pozytywna i negatywne |
| `research/analyzer-005v-n2-wall-contract/ledger.json` | dowody liczbowe |
| ten raport, `PROJECT_STATUS.md` | dopisek na końcu |

Kandydat w `interior.ts`:
- Każdy bok ciała jest mierzony w pasie, gdzie ciało stawia mur. Jeśli tusz muru jest na mniej niż 5 % długości boku,
  rejestracja jest niepewna i trafia do `unresolved` z nazwą boku.
- Wtedy grube ścianki działowe z N3 nie są czytane na tym ciele i kondygnacji. Cienkie czyta się jak dotąd.
- Reguła komina (bloki na cienkim progu) bez zmian.
- Brak nazw projektów, identyfikatorów, numerów pomieszczeń i `publishedArea`.

## Kontrakt `entrance:id`

- **`FROZEN['entrance:id'].walls` zostaje `4`.** Ani rekord, ani inne pola `FROZEN`, ani rysunek fikstury nie zostały
  zmienione.
- **`N3_THICK_INTERIOR_WALLS_EXPECTED`** ma dokładnie jeden wpis: `'entrance:id' → 9` (z powodem).
  - `frameAsFrozen` bierze licznik z wyjątku tylko wtedy, gdy rekord jest dokładnie obiektem `FROZEN['entrance:id']`.
    Mapa idzie po obiekcie rekordu, więc dotyczy jednej fikstury i jednej transformacji.
  - Wszystkie pozostałe własności sprawdza nadal z orakla.
  - Osobny test pilnuje, że wyjątek ma jeden klucz, że `FROZEN['entrance:id'].walls === 4` i że `entrance:` w lustrach
    i obrotach oraz `entranceFacePair:*` wyjątku nie mają.
- **Niezależna asercja strukturalna.** Pięć ścian narysowanych w `entrance()` (12 px, 5 cm/px; świat
  x = (kolumna − 40)·0,05, z = (280 − wiersz)·0,05):

  | ściana | prostokąt w px | orientacja |
  | --- | --- | --- |
  | zachodni bok wnęki | 108–119 × 150–279 | pionowa |
  | wschodni bok wnęki = ściana wnęka/garaż | 180–191 × 150–279 | pionowa |
  | ściana garaż/dom | 252–263 × 150–279 | pionowa |
  | tylna ściana wnęki (z drzwiami 135–155) | 108–191 × 228–239 | pozioma |
  | tylna ściana bloku garaż + wiatrołap (z drzwiami 210–225) | 108–263 × 150–161 | pozioma |

  - Każdy piksel każdej ściany poza otworami drzwiowymi jest tuszem na wyrenderowanej fiksturze.
  - Każdej odpowiada **dokładnie jedna** ściana wewnętrzna modelu o tej samej orientacji:
    - linia w paśmie tuszu ± 0,05 m;
    - w obrębie rozpiętości ± 0,60 m;
    - pokrycie ≥ 50 %;
    - grubość 0,60 m.
  - Żadna ściana modelu nie odpowiada dwóm narysowanym. Ścian wewnętrznych jest dokładnie 5.
  - Liczba 9 wynika z tej asercji, a nie odwrotnie.
- **Rejestracja.** `entrance:id` nie ma notatki o niepewnej rejestracji: boki 1,00 / 1,00 / 1,00 / 0,60, wszystkie
  stoją na narysowanym murze. `facePair:id` taką notatkę ma.
  - 165 źle zarejestrowanych ciał fikstur ma bok z pokryciem 0,00–0,015.
  - Wszystkie 30 poprawnie zarejestrowanych ma każdy bok ≥ 0,596.
  - Dane: `research/analyzer-005v-n1-wall-strip/first-bad.json`.

## Kontrole (`interior-unwalled-side.test.ts`)

Rysunek: dom 12 × 9 m, mur 12 px, 2,5 cm/px. Dowody są wyłącznie na rysunku.

| test | warunek | wynik oczekiwany | bez zmiany |
| --- | --- | --- | --- |
| pozytywna | ciało na narysowanych murach | ściana pożarowa garażu 12 px (x 8) czytana, brak notatki | zielony |
| negatywna | ciało zarejestrowane 6 m poza narysowany mur wschodni | ten mur (wewnątrz wnętrza) nie jest ścianką, notatka nazywa bok wschodni | czerwony |
| lustro | 6 m poza mur zachodni | to samo, bok zachodni | czerwony |
| cienka ścianka | niepewna rejestracja | gruba ściana nie jest czytana, cienka ścianka 6 px (x 4) jest | czerwony |
| próg | — | `UNWALLED_SIDE_COVER === 0.05` | czerwony |

## Bramki

| bramka | przed | po |
| --- | --- | --- |
| `wall-strip.test.ts` | 23/63 | **65/65** (63/63 oryginalnych + 2 nowe) |
| `wall-strip-unit.test.ts` | 59/59 | 59/59 |
| `interior-wall-thick-partition.test.ts` | 6/6 | 6/6 |
| `interior-unwalled-side.test.ts` (nowy) | 1/5 | 5/5 |
| `garage-label-mouth.test.ts` | 13/13 | 13/13 |
| `roof-apex-eaves.test.ts` | 10/10 | 10/10 |
| `tests/architecture/research-isolation.test.ts` | 70/71 | 70/71 — `KNOWN_BASELINE_FAIL`: APK 39 556 682 B > 32 MB, nieruszony |
| `tsc` | czysto | czysto |

Razem po: 229 testów, 228 zielonych, 1 czerwony (APK).

Z 40 dawnych czerwonych:
- 39 to fałszywy odczyt muru zewnętrznego jako ścianki przy ciele zarejestrowanym poza rysunkiem. Wszystkie te ciała
  mają teraz notatkę o niepewnej rejestracji.
- 1 (`entrance:id`) przechodzi na wersjonowanym kontrakcie potwierdzonym strukturalnie.

Żadnej innej asercji nie poluzowano.

Polecenia:

```
npx vitest run packages/reconstruction/test/wall-strip.test.ts packages/reconstruction/test/wall-strip-unit.test.ts \
  packages/reconstruction/test/interior-wall-thick-partition.test.ts packages/reconstruction/test/interior-unwalled-side.test.ts \
  packages/reconstruction/test/roof-apex-eaves.test.ts packages/reconstruction/test/garage-label-mouth.test.ts \
  tests/architecture/research-isolation.test.ts
npx tsc -p tsconfig.json
```

## Replay offline (solver, bez OCR i sieci): 5/5 identyczne z N1

| dom | SHA-256 modelu |
| --- | --- |
| A01 Jarzmianki | `d93291577e2d795f19a2ebfab698e1e655ecf007f342e5ba7166c4c886a61be2` |
| Goździkowce 3 | `911456a88b2530c9cf01b348dc7045a7b7bcc6d85e62e58221e5f205d41efbbc` |
| Marcówki | `f607464936c7a13368d7f9307fb004e5bbad8b0da4490981851a33616c573321` |
| Rarytasy 5 G2E `m84f…` | `9f5fd342a53edf54f203533f18e21d37805574ea8d1038fa4dbb092d584d21e7` |
| Cieszynianki | `e4e562923319084fda0b9ae934bcb1185a7098c53e7727c82f9afdcb592c1f6c` |
| Rarytasy OWNER `m3ea…` | `NOT_RUN`, bez podmiany na `m84f…` |

Kontrola strukturalna na modelach po zmianie:
- **Goździkowce:**
  - pokój 26,09 m² nr 8 = Garaż;
  - ściana pożarowa `main-iwall-0-z-13` 0,303 m;
  - brama `opening-0-front-0-2` DOOR 3,22 m, nadproże 2,20 m `ASSUMED`;
  - opis 325/225 `UNRESOLVED`.
- **A01:** GABLE z kalenicą X, 2 kominy, 4 otwory frontu parteru.

Wpływ geometryczny na realne domy: zerowy.

## Otwarte

- Cieszynianki `main-iwall-0-z-0` (0,417 m, x 3,07, z 12,35..16,13, brak muru na zachód od niego): `NOT_VERIFIED`, bez
  zmian.
- A01:
  - dwa wysokie przeszklenia frontu czytane jako DOOR;
  - wysokości otworów `ASSUMED`;
  - brak 100/220 ×2 na prawym szczycie;
  - okna dachowe 78/118;
  - mur 0,152 m wobec ~0,42 m narysowanego;
  - rzędna +2,80 wobec +3,06.
  To osobny etap do decyzji koordynatora.

STOP.
