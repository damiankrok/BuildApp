# STAGE BUILDPLAN-ANALYZER-005V-N1 — WALL-STRIP REGRESSION RECOVERY

**Werdykt: `PARTIAL_REGRESSION_RECOVERY_NOT_ADOPTED`**

Powstały diagnoza i kandydat na poprawkę. Kandydat jest bezpieczny dla pięciu realnych domów (modele bajt w bajt), ale
zamyka 39 z 40 porażek, nie 63/63. Zgodnie z definicją werdyktów **kod produkcyjny nie został zmieniony**.
Kandydat leży jako łatka badawcza: `research/analyzer-005v-n1-wall-strip/candidate-unwalled-side.patch`.

| | |
| --- | --- |
| Baza | `6af3d71659b59764895b2440cebe366eb812774b` (`analyzer/005v-wall-first-facade-alignment-v1`); worktree czysty, bez dryfu |
| Gałąź | `analyzer/005v-n1-wall-strip-regression-recovery-v1`, jeden commit (wyłącznie badania, raport, status) |
| Mirror CI | `claude/new-session-3kzcgh` = `bfaf286e95105c2cdb32df2d298d3cd93bd43449`, nietknięty |
| Nietknięte | `main`, tagi, wydania, APK OWNER-a |
| CI / APK / e2e | `NOT_RUN` |
| Akceptacja OWNER-a | `OWNER_VISUAL_NOT_RETESTED` |

## Zmienione pliki

| plik | co zawiera |
| --- | --- |
| `research/analyzer-005v-n1-wall-strip/preregistration-baseline.json` | 40 porażek bazy zapisanych przed jakąkolwiek edycją produkcji; bisekcja |
| `research/analyzer-005v-n1-wall-strip/first-bad.json` | FIRST_BAD liczbowo; para ze ścianą Goździkowców; konflikt `entrance`; pokrycie boków dla 195 ciał fikstur i 5 domów; grube kawałki realnych domów |
| `research/analyzer-005v-n1-wall-strip/before-after.json` | SHA-256 replayów: baza i kandydat; liczniki `wall-strip` |
| `research/analyzer-005v-n1-wall-strip/candidate-unwalled-side.patch` | kandydat, **nieprzyjęty** |
| ten raport, `PROJECT_STATUS.md` | dopisek na końcu |

Żadnych pikseli ani obrazów wydawcy. Nie pobierano nic nowego i nie obchodzono żadnej bramki. Prywatny cache służył
tylko replayom offline.

## 1. Regresja odtworzona

`wall-strip.test.ts` na bazie: **23/63 zielonych, 40 czerwonych**. Wszystkie 40 to **jedna asercja**:
`expect(o.modelWalls).toBe(f.walls)` w `frameAsFrozen` (`wall-strip.test.ts:177`). Prowadzą do niej `fires`,
`holdsFrozen` i wywołania bezpośrednie. Żadna inna asercja nie pada, więc porażki nie są niezależne: to jedna
przyczyna.

Bisekcja:

| commit | wynik |
| --- | --- |
| `074c956` | 63/63 |
| `b19960d` (N2) | 63/63 |
| `d5d14be` (N3) | 40 czerwonych |
| `eff66f4` | 40 czerwonych |
| `6af3d71` | 40 czerwonych |

## 2. FIRST_BAD liczbowo (fikstura `facePair`, rodzina 1, `id`)

**Rejestracja.** Łańcuchy wymiarowe mówią 0,05 m/px, a ramka rzutu 0,026 m/px (celowo, opis w nagłówku testu).
- Ciało 30 × 17,15 m to w pikselach 1154 × 660, czyli więcej niż arkusz 760 × 600.
- Wnętrze (ciało wcięte o odczytany mur) to `[78, 78, 1118, 624]` px.
- Narysowany dom zajmuje tylko jego północno-zachodnią część: lica zewnętrzne x 60..660, y 60..420.

**Progi.** wallPx 18, minThick 4, bound cienki (0,72) = 13 px, bound N3 (1,0) = 18 px.

**Fałszywe ściany:**

| oś | gdzie | grubość | długość | do krawędzi wnętrza | mur za kawałkiem |
| --- | --- | --- | --- | --- | --- |
| pionowa | środek 573,5 px wnętrza = raster x 651,5 = świat x 15,379 | 18 px | 343 px | 574 / 543 px | po zachodniej stronie 1,0; po wschodniej **0,0** |
| pozioma | raster y 411,5 = świat z 8,466 | 18 px | 583 px | 334 / 289 px | po północnej 1,0; po południowej **0,0** |

To wschodni i południowy **mur zewnętrzny domu**.

**Dlaczego przechodzą.** 18 > 13, więc przed N3 były odrzucane. 18 ≤ 18, więc od N3 są przyjmowane.
`capAcross` trzyma cienki bound tylko w odległości jednego muru (18 px) od krawędzi wnętrza. Te mury stoją 543
i 289 px dalej, więc stają się ściankami działowymi: 7 ścian modelu zamiast zamrożonych 5.

**Pokrycie boków ciała** (udział pozycji wzdłuż boku z tuszem muru w pasie, gdzie ciało stawia mur): W 0,55,
E **0,00**, N 0,52, S **0,00**.

### Para: prawdziwa gruba ściana (Goździkowce 3, parter, ściana pożarowa garażu, x 8,91)

- 12 px przy wallPx 12,03 (bound cienki 9, N3 12).
- Odległość od krawędzi wnętrza: 340 i 181 px, czyli 28 i 15 murów.
- Mur za ścianą: po zachodniej stronie 1,0; po wschodniej 0,443 i 0,865 (dwa kawałki).
- Pokrycie boków ciała: W 0,65, E 0,56, N 0,57, S 0,35. Front ma najniższe pokrycie przez otwarty wjazd garażu.

Ciało stoi na narysowanych murach z każdej strony, więc ściana jest odczytywana.

## 3. Kandydat (nieprzyjęty) i dlaczego nie 63/63

**Reguła (jedna, ogólna):**
- Dla każdego boku ciała mierzone jest pokrycie tuszem muru w pasie od 1,5 muru wewnątrz krawędzi wnętrza do 2 murów
  na zewnątrz.
- Jeśli któryś bok ma mur w mniej niż 5 % pozycji (`UNWALLED_SIDE_COVER`), ciało nie stoi na swoich murach.
  Rejestracja jest wtedy niepewna (`unresolved` z nazwą boku).
- Na tym ciele i kondygnacji grube ścianki N3 nie są czytane; cienkie czyta się jak dotąd.
- Bez slugów, pikseli stałych, numerów pomieszczeń i `publishedArea`.

**Rozkład pokrycia:**

| zbiór | najsłabszy bok |
| --- | --- |
| 165 źle zarejestrowanych ciał fikstur | 0,00–0,015 |
| pozostałe 30 ciał fikstur | ≥ 0,596 (najniższy: `entrance`) |
| realne domy, ciała z grubymi kawałkami | ≥ 0,35 |

Realne ciała z najniższym bokiem 0,06–0,14 to poddasze A01 (bok wschodni), dobudówka Marcówek i dobudówka Rarytasów.
Na żadnym z nich nie ma grubego kawałka, więc reguła nie zmienia tam nic.

| przebieg | wynik |
| --- | --- |
| `wall-strip.test.ts` z kandydatem | **62/63** |
| `wall-strip-unit` 59/59, `interior-wall-thick-partition` 6/6, `garage-label-mouth` 13/13, `roof-apex-eaves` 10/10 | zielone |
| `tsc` | czysto |
| replay 5 domów z kandydatem | **bajt w bajt identyczne** z bazą |

**Jedyny czerwony test to `entrance:id` (005N, rodzina 12), i to jest prawdziwy konflikt, nie usterka reguły.**
- Fikstura jest poprawnie zarejestrowana: boki 1,0 / 1,0 / 1,0 / 0,60.
- Pięć dodatkowych ścian to narysowane mury 12 px, czyli grubości muru zewnętrznego:
  - dwa boki wnęki wejścia;
  - tył wnęki;
  - wschodnia ściana garażu, między garażem a domem;
  - tylna ściana bloku garaż + wiatrołap.
- Dwie z nich dzielą garaż i dom dokładnie jak ściana pożarowa Goździkowców. Żadna ogólna reguła nie usunie ich
  i zarazem nie usunie tamtej.
- Zamrożone „4 ściany” to wynik czytnika sprzed N3, który takich ścian nie widział.
- Polecenie zabrania przepisywania rekordów `FROZEN` i usuwania prawdziwych ścian pod test.

Dlatego kandydat nie spełnia `SAFE` (63/63) i nie wchodzi do produkcji.

**Decyzja potrzebna od OWNER-a / koordynatora (nie podjęta tutaj):**
- (a) przyjąć kandydata i jawnie zaktualizować rekord `entrance:id` o 5 ścian z adnotacją N3; albo
- (b) zostawić 40 czerwonych do osobnego etapu.

## 4. Replay offline (solver, bez OCR i sieci)

| dom | SHA-256 modelu (baza = kandydat) | wynik |
| --- | --- | --- |
| A01 Jarzmianki `m60124f28f071a` | `d93291577e2d795f19a2ebfab698e1e655ecf007f342e5ba7166c4c886a61be2` | identyczny |
| Goździkowce 3 `m79923e950094d` | `911456a88b2530c9cf01b348dc7045a7b7bcc6d85e62e58221e5f205d41efbbc` | identyczny |
| Marcówki `m2fa281446a8ca` | `f607464936c7a13368d7f9307fb004e5bbad8b0da4490981851a33616c573321` | identyczny |
| Rarytasy 5 G2E `m84f2903cb8e14` | `9f5fd342a53edf54f203533f18e21d37805574ea8d1038fa4dbb092d584d21e7` | identyczny |
| Cieszynianki `m43d25c0636969` | `e4e562923319084fda0b9ae934bcb1185a7098c53e7727c82f9afdcb592c1f6c` | identyczny |
| Rarytasy OWNER `m3ea…` | — | `NOT_RUN`: brak wejścia; nie podstawiano m84f… |

Zachowane z 005V/N4 (baza = kandydat):
- **A01:** GABLE, kalenica wzdłuż X, 2 kominy, 4 otwory frontu parteru, 0 `OPENING_ABOVE_WALL_TOP`.
- **Goździkowce:**
  - pokój 26,09 m² nr 8 = Garaż;
  - `opening-0-front-0-2` DOOR 3,22 m, nadproże 2,20 m `ASSUMED`;
  - opis 325/225 `UNRESOLVED`.

**Wpływ geometryczny: zerowy.** Kod produkcyjny jest bez zmian, a kandydat też nie zmienia żadnego z pięciu modeli.
Rendery nie były potrzebne: modele są identyczne, więc obraz jest identyczny z 005V.

### Kontrole negatywne

- **Ściana przy schodach:** `NOT_APPLICABLE`. Żaden z pięciu domów nie ma grubego kawałka przy schodach.
- **Lustra i obroty:** wszystkie 5 transformacji × 35 fikstur zmierzono. Rodziny 13 (lustra i obroty) przechodzą
  z kandydatem.
- **Cieszynianki `main-iwall-0-z-0`** (0,417 m, x 3,07, z 12,35..16,13): kawałek z ery N3, po którego zachodniej
  stronie nie ma żadnego muru (0,0), przy ciele stojącym na murach z każdej strony (najniżej 0,39).
  - Wygląda na lico wnęki lub tarasu wewnątrz prostokąta ciała, czytane jako ścianka.
  - Kandydat go nie zmienia. `NOT_VERIFIED` względem rzutu źródła.

## 5. Testy (stan commitowanego drzewa = baza)

| test | wynik |
| --- | --- |
| `wall-strip.test.ts` | 23/63 (40 czerwonych, regresja N3) |
| `wall-strip-unit.test.ts` | 59/59 |
| `interior-wall-thick-partition.test.ts` | 6/6 |
| `roof-apex-eaves.test.ts` | 10/10 |
| `garage-label-mouth.test.ts` | 13/13 |
| `tests/architecture/research-isolation.test.ts` | 70/71 |
| razem | 6 plików: 222 testy, 181 zielonych, 41 czerwonych |
| `tsc` | czysto |

Czerwony test w `research-isolation` to bramka rozmiaru APK: śledzony
`stage-reports/artifacts/owner-005t/BuildPlan-005T-two-houses-arm64.apk` (39 556 682 B > 32 MB). To
`BASELINE_KNOWN_APK_SIZE_FAILURE`. Bramki nie ruszano, APK nie usunięto. Projekt **nie** jest „zielony”.

## 6. Pozostałe problemy A01 (bez zmian, poza zakresem)

- Dwa wysokie przeszklenia frontu parteru czytane jako DOOR; wysokości otworów `ASSUMED`.
- Prawy szczyt poddasza: brak 100/220 ×2.
- Okna dachowe 78/118: niemodelowane.
- Mur odczytany 0,152 m wobec ~0,42 m narysowanego.
- Kondygnacja na konwencji +2,80 wobec wydrukowanego +3,06.

STOP. Nie zaczęto etapu fasad, APK, pełnego CI ani adaptera Houseplans.
