# STAGE BUILDPLAN-ANALYZER-005U-N3-INTEGRAL-GARAGE-FIRST-BAD

**Werdykt: `PARTIAL_ROOM_BOUNDARY_FIX_NO_GARAGE_DOOR`.**

Goździkowce 3 (`m79923e950094d`) ma teraz garaż jako osobne pomieszczenie w bryle MAIN: x 9,0–13,5 × z 0,3–6,55,
26,09 m², oddzielone ścianą 0,30 m. Wcześniej był częścią jednego pomieszczenia parteru o powierzchni 106,75 m².

Bramy garażowej **nie** odzyskano:
- wydrukowany callout bramy jest nieczytelny dla OCR;
- numer pomieszczenia „8” odrzuciło głosowanie strony;
- przerwa w ścianie frontowej zostaje więc jawnym placeholderem `ASSUMED`, jak dotąd.

Pomieszczenie nie dostało etykiety „Garaż”, bo sama zgodność powierzchni nie jest identyfikacją. OWNER nie oglądał
wyniku (**OWNER_VISUAL_NOT_RETESTED**).

| | |
| --- | --- |
| Repozytorium / gałąź | `damiankrok/BuildApp`, `analyzer/005u-n3-integral-garage-first-bad-v1` |
| Baza | `b19960d86bdd2aec19a222137133f0b421a858f8` (`analyzer/005u-n2-plan-mass-first-bad-v1`). Na starcie HEAD = origin, worktree czysty, brak drifta |
| HEAD | commit z tym raportem: <https://github.com/damiankrok/BuildApp/commits/analyzer/005u-n3-integral-garage-first-bad-v1> |
| Mirror `claude/new-session-3kzcgh` | `bfaf286e95105c2cdb32df2d298d3cd93bd43449`, nietknięty; `main`, wydania i link APK nietknięte |
| Ścieżki w diffie | `packages/reconstruction/src/v2/interior.ts`, `packages/reconstruction/test/interior-wall-thick-partition.test.ts`, `research/analyzer-005u-n3-garage/{trace.ndjson,before-after.json}`, ten raport, `PROJECT_STATUS.md` |
| CI / APK / emulator / pełne `npm test` | **NOT_RUN** |
| Zrzuty OWNER-a (ZIP) | **NO**: nie dotarły do tej sesji i ich nie oglądałem |
| Piksele źródła | **YES**: rzut parteru i poddasza z lokalnego cache bajtów, obejrzane w prywatnym katalogu poza repozytorium. Nic nie zostało zacommitowane |

## 1. Źródło: co naprawdę jest na rzucie

Wykaz wydawcy (ta sama edycja) podaje na parterze pozycję `8. Garaż | 25,38 | (25,63)`, a w danych `garage_area` = 25,38. To
informacja semantyczna, a nie współrzędna.

Rzut parteru:
- ramka: `frame-asset-rzut-01d4b6474c-64bd1e0f2f`, 853 × 853 px, 0,025344 / 0,025199 m/px;
- obrys: px {96, 221, 639, 598};
- ściana zewnętrzna: 0,304 m = 12 px.

Odczyt lokalny pikseli (liczby w `trace.ndjson`, krok 3):
- **pomieszczenie 8:** prawy dolny róg bryły MAIN, poziom −0,15, etykieta „8” w px (534–544, 484–500);
- **ściana zachodnia garażu:** czarna, 12 px, czyli tak gruba jak zewnętrzna; x 442–453, odcinki y 300–409 i 445–591,
  z przerwą 0,88 m na drzwi do holu w y 410–444;
- **wjazd:** przerwa w ścianie frontowej px 465–590, przekreślona linią przerywaną, z ościeżami po obu stronach;
- **callout bramy:** pod nią wydrukowany `325/225`.

Garaż jest więc **wbudowany** w bryłę MAIN. Nie ma żadnej osobnej bryły `ATTACHED`, i tak zostaje.

## 2. FIRST_BAD

Funkcja: `readInterior`, `packages/reconstruction/src/v2/interior.ts`. Stan przed zmianą:
- **linia 149:** `maxThick = round(wallPx × maxPartitionFraction 0,72)` = round(12,0 × 0,72) = **9 px**;
- **linie 197–200:** `isVerticalWallPixel` przyjmuje piksel tylko przy `h ≤ maxThick`;
- **linia 276:** kawałek grubszy niż `maxThick` jest odrzucany;
- **linia 345:** reguła bloków (`> maxThick` w obu kierunkach).

Działanie:
1. Każdy piksel ściany garażu ma h = 12 > 9, więc nie jest pikselem przegrody.
2. W debugu kondygnacji 0 nie ma pasma Z przy px ≈ 448; są tylko pasma przy 111,5, 236,5, 259, 297, 361 i 625,5.
3. Flood fill przechodzi przez ścianę garażu. Parter wychodzi jako jedno pomieszczenie `main-room-0-0` o powierzchni
   106,75 m² („open plan”).

Kroki dalej w łańcuchu (nie są pierwszym złym krokiem, ale też blokują bramę):
- **Numer pokoju:**
  - token „8” w polu etykiety ma pewność 0,55 i `pageVote = DISCARDED`;
  - głosowanie zachowało w tym miejscu „/13”;
  - pomieszczenie zostaje więc bez numeru. Bramek OCR nie luzowałem.
- **Callout bramy:**
  - `metric-callout-ring-fcc74e2d4b` (pole 515–539 × 601–625, wyśrodkowane pod przerwą) odczytany jako `176/140`,
    z pewnością 0,14;
  - kandydaci szerokości to 176, 170, 476, 126, 186, 175; żaden nie jest w granicy 12 % od 3,22 m;
  - callout nie zostaje przypięty. Ten sam OCR czyta źle wszystkie callouty tego arkusza (np. `300/230` → `460/40`).
- **Rodzaj otworu:** w `openings-v2.ts` rodzaj `GARAGE_DOOR` z samej szerokości wymaga
  `attachedSingleStorey`, czyli bramy w parterowej przybudówce. Garaż wbudowany w dwukondygnacyjną MAIN tej drogi
  nie ma, a jedyna inna droga, odczytany callout, jest tu zablokowana.
  - Nie zmieniłem tego: bez dowodu (etykieta albo callout) byłoby to wnioskowanie bramy z szerokości luki i domyślnej
    wysokości.
  - Otwór `opening-0-front-0-2` (3,22 m, offset 9,33 m, `ring-main-0-w0`) zostaje placeholderem okna z `kind` / `sill` /
    `height` = `ASSUMED`, bez zmian od 005U-V1.

## 3. Poprawka (jedna reguła, jedno miejsce)

`readInterior`:
- **Ściana grubości zewnętrznej:**
  - nowe `maxPartitionFraction = 1,0`: ściana wewnętrzna może być tak gruba jak zewnętrzna (ściana nośna, ściana
    oddzielenia ppoż. garażu);
  - dalej jest to przegroda dzieląca pomieszczenia, a nie blok;
  - grubsza niż zewnętrzna nadal nie jest przegrodą.
- **Dwa ograniczenia, bez których ta sama reguła produkuje fikcję.** Oba zostały zmierzone na kontrolach, zanim je dodałem:
  1. **Bloki (kominy) zostają na dawnym progu 0,72** (`thinPartitionFraction`).
     - Bez tego skrzyżowanie dwóch grubych ścian przy schodach w Goździkowcach oddzielało się jako zwarty „blok”
       0,87 × 0,72 m.
     - Stał w tym samym miejscu na obu kondygnacjach, więc dawał fałszywy `chimney-0` (x 8,92–9,79, z 5,90–6,61).
  2. **W pasie jednej grubości ściany zewnętrznej od krawędzi wnętrza zostaje dawny próg.**
     - Bez tego wewnętrzne 16 px ściany wschodniej poddasza Marcówek (rysowanej grubiej, 18 px, niż została odczytana)
       stawało się drugą ścianą `main-iwall-1-z-7` (x 7,24, 0,34 m, z 8,60–9,92).
     - Reguła działa na klasyfikacji pikseli. Wersja „na grubości kawałka” tego nie łapała, bo kawałek mierzył 9,3 px
       ≤ 10.
- Bez slugów, bez nazw domów, bez postprocessingu modelu i renderera.

## 4. Przed → po (Goździkowce, target)

| | przed (`b19960d`) | po |
| --- | --- | --- |
| model SHA-256 | `faf56de0…b80a` | `5a828478a6e895cfc84f5d80b36596a15856bd692f7acd5aa8130e97aa56fe0a` |
| bryły / dachy / komin | MAIN / GABLE 40° / 1 | bez zmian (bajtowo identyczne `roofs`, `levels`, `chimneys`) |
| ściany zewnętrzne, 17 otworów zewnętrznych | — | bajtowo identyczne |
| ściany wewnętrzne | 35 | 36 (+ `main-iwall-0-z-13`, x 9,06, z 0,32–9,04, 0,303 m: ściana garażu i kotłowni) |
| drzwi | 17 | 18 (+ drzwi 0,88 m garaż–hol, w przerwie y 410–444) |
| pomieszczenia parteru | 1 × 106,75 m² | 4: **26,09 (garaż, bez etykiety)**, 9,77 („7 Kotłownia” 10,21), 10,56 („1 Wiatrołap” 6,86, odchyłka 54 %, istniała wcześniej), 57,16 |
| brama garażowa | brak (placeholder okna 3,22 m) | **brak, bez zmian** (placeholder `ASSUMED`) |

Mapa parteru (z liczb modelu, bez pikseli wydawcy; z = 0 to front):

```
z 9,5 +--------------------------------+---------------+
      |                                | 7 Kotłownia   |
      |   salon / kuchnia / hol        |  9,77 m²      |
 6,56 |   (57,16 m², open plan)        +-------D-------+   D = drzwi 0,99 m (istniały)
      |              +---------+       #               |   # = main-iwall-0-z-13, 0,30 m (NOWA)
      |              | 1 Wiatr.|       D 0,88 (NOWE)   |
      |              | 10,56   |       #   garaż       |
      |              +---------+       #   26,09 m²    |
      |                                #   (bez etykiety)
 0,0  +--------------------------------#=====[3,22]====+
      x 0                            x 9,06          x 13,82
                                     [3,22] = opening-0-front-0-2, placeholder ASSUMED, nie brama
```

## 5. Kontrole

Kontrola: ten sam replay offline. „Przed” = głowa `b19960d`.

| dom | przed | po | zmiana i uzasadnienie (sprawdzone na pikselach z cache) |
| --- | --- | --- | --- |
| Rarytasy G2E `m84f2903cb8e14` | `9f5fd342…21e7` | `9f5fd342…21e7` | **bez zmian** |
| Marcówki | `6152770f…d64f` | `f6074649…3321` | ściany, otwory i pomieszczenia: tyle samo. Na poddaszu przycięcie złącza T: `z-0` kończy się na 4,94 zamiast 4,70, `x-3` zaczyna się na 3,47 zamiast 3,33. Pomieszczenie 7,45 → 7,43 m² |
| Cieszynianki (HIP) | `5ca09ead…edfc` | `e4e56292…1c6f` | +1 ściana i +1 drzwi. Nowa ściana to lewa ściana pokoju 8 (x 289–303 px, 0,42 m, czarna na rzucie). Drzwi 1,00 m siedzą w jej przerwie y 200–230. Ściana 11\|12 przesuwa się na swoje właściwe położenie (0,39 m). Parter: 114,08 → 99,49 + 12,76 m² |
| A01 Jarzmianki `m60124f28f071a` | `5ea8bbca…82e9` | `2b61ec4a…0445` | +11 przegród 0,12 m i +5 drzwi wewnętrznych na parterze. Zewnętrzna ściana A01 czyta się jako 0,152 m (7,5 px), więc dawny próg wynosił 5 px, a przegrody A01 mają 6 px. Nakładka na rzut: wszystkie nowe ściany leżą na narysowanych przegrodach 4\|5, 5\|6, 1, 7, 8, plus 0,28 m stub przy filarze lewej ściany. Parter: 1 × 78,35 → 6 pomieszczeń (w tym „6 Pokój”, 12,1 vs 10,95). **To skutek reguły, a nie zlecona poprawka A01**; zewnętrze, dach i bryła A01 bez zmian |

W żadnej kontroli nie zmieniły się dachy, bryły, kominy, ściany zewnętrzne ani otwory zewnętrzne.

## 6. Testy (zmierzone)

- Nowy test `packages/reconstruction/test/interior-wall-thick-partition.test.ts` (6 przypadków, syntetyczne arkusze):
  - **Pozytywne:**
    - garaż za ścianą grubości zewnętrznej jest osobnym pomieszczeniem;
    - na skrzyżowaniu dwóch grubych przegród nie ma bloku, a pomieszczenia się rozdzielają.
  - **Negatywne i kontrolne:**
    - garaż za cienką przegrodą (było i jest);
    - ściana grubsza niż zewnętrzna dalej nie jest przegrodą;
    - zewnętrzna ściana narysowana grubiej (23 px wobec odczytanych 0,30 m) nie daje drugiej ściany;
    - pełny blok komina 0,9 m dalej jest blokiem.
  - **Na starym kodzie:** 2 czerwone (garaż i skrzyżowanie), 4 zielone. **Na nowym:** 6/6.
- Celowane, 20 plików, **199/199**:
  - nowy test, `plan-bodies-wall-sliver`, `assumed-sill-family`;
  - `attached-bodies`, `attached-roof-form`, `fixtures-v2`, `storey-emission`, `wall-topology`;
  - `openings`, `wide-openings`, `plan-decomposition`, `layout`, `walled-off`;
  - `roof-datum`, `fit-and-levels`, `vehicle-door-depth`, `compound-facade-emission` i pokrewne.
- `analysis-service` (`exterior-frame-fit`, `chimney-height-refusal`, `warnings`), `candidates/sealed`,
  `mobile-scene/owner-005t` i architektura (`generalization`, `analyzer-v2`, `research-isolation`): **136/137**. Jedyny
  fail to bramka z §7.
- `npx tsc -p tsconfig.json`: zielono.
- Replaye offline: 5 domów (target + 4 kontrole), każdy przed i po.
- Nie uruchamiano: pełnego `npm test`, 41 jobów CI, e2e, emulatora, APK, OCR ani nowych pobrań.

## 7. BASELINE_KNOWN_APK_SIZE_FAILURE

`tests/architecture/research-isolation.test.ts` › „no tracked file anywhere is the size of a model” failuje od `074d6ae`:
- plik `stage-reports/artifacts/owner-005t/BuildPlan-005T-two-houses-arm64.apk` ma 39 556 682 B;
- limit wynosi 32 MB.

Tego nie naprawiam:
- nie zmieniam limitu;
- nie usuwam pliku, bo link OWNER-a od niego zależy;
- nie deklaruję PASS.

## 8. Czego brakuje do bramy (jakiego dowodu szukać)

Tożsamość garażu daje jedno z dwóch:
1. **Numer „8” przypięty do pomieszczenia `main-room-0-1`.** Dziś głos strony zachowuje w tym polu „/13”. Potrzebny
   jest poprawny odczyt etykiety, nie dopasowanie po powierzchni.
2. **Odczytany callout `325/225` przy przerwie `opening-0-front-0-2`.** Dziś jest czytany jako `176/140`.

Dopiero z którymś z nich generyczna reguła mogłaby nadać przerwie we wbudowanym garażu rodzaj bramy:
- z etykietą rodzaj byłby `SOURCE_DERIVED`, a wymiary `ASSUMED`;
- z calloutem wymiary byłyby `SOURCE_EXACT`.

Dziś żadnego z tych świadectw nie ma, więc brama pozostaje `UNKNOWN` w sensie źródła, a model rysuje placeholder `ASSUMED`.

## 9. Otwarte długi (bez zmian w tym etapie)

- **Goździkowce:**
  - placeholder okna 3,22 m w miejscu wjazdu;
  - wiatrołap 10,56 m² wobec 6,86 m² (odchyłka 54 %, sprzed etapu);
  - poddasze nadal wystaje 33 m² poza bryłę;
  - datum kalenicy przybliżone.
- **A01:** brak drzwi wejściowych na parterze; rzut poddasza i tylny szczyt niezweryfikowane. Tych długów nie
  ruszałem.
- **OWNER_VISUAL_NOT_RETESTED; CI/APK NOT_RUN.**

`BUILDPLAN_ANALYZER_005U_N3_INTEGRAL_GARAGE_FIRST_BAD_PARTIAL_ROOM_BOUNDARY_FIX_NO_GARAGE_DOOR`
