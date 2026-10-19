# STAGE BUILDPLAN-ANALYZER-005U-OWNER-VISUAL-FIRST-BAD-FIX-V1

**Werdykt: `OWNER_VISUAL_FIRST_BAD_FIXED_PARTIAL`.** Usunięto jedną zmierzoną przyczynę: założony parapet był czytany
jako dowód rodzaju otworu. Druga i trzecia przyczyna — zdublowane bryły A01 i brak garażu w bryle głównej Goździkowców —
są nazwane, ale **nie** naprawione, bo nie ma dla nich wystarczających dowodów. Ocena OWNER-a obu domów pozostaje
`FAIL_UNRECOGNIZABLE`, dopóki nie obejrzy ich ponownie na telefonie. Nowego APK nie ma.

| | |
| --- | --- |
| Repozytorium / gałąź | `damiankrok/BuildApp`, `analyzer/005u-owner-visual-first-bad-fix-v1` |
| Baza | `074d6ae6146c61cc1bc99d124f237b825bff3f8d` (HEAD = origin, czysto) |
| Mirror / `main` / wydania APK / starsze zapieczętowane modele | nietknięte; `packages/candidates/src/owner-005t/*` bez zmian |
| CI / APK / emulator | **NOT_RUN** |

**Zrzuty OWNER-a:** pliki `BUILDPLAN_OWNER_005T_VISUAL_SCREENSHOTS_v3.02.0.zip` i
`BUILDPLAN_005U_OWNER_VISUAL_FORENSIC_FINDINGS_v3.02.0.md` **nie były dostępne w tej sesji**. Nie oglądałem żadnego
zrzutu. Pracowałem na objawach, które zmierzył koordynator, i na zapieczętowanych wejściach.

## 1. Reprodukcja

Wejście to zapieczętowany graf N1v i metryki z 005T. Replay był offline, sam solver, bez OCR i bez sieci
(`research/analyzer-005t-n2/replay-solver.ts`). Oba modele odtworzone **bit w bit** przed zmianą:

| dom | model SHA-256 |
| --- | --- |
| A01 Jarzmianki `m60124f28f071a` | `4ced0179…6b54` |
| Goździkowce 3 `m79923e950094d` | `a612a399…d33f` |

Zakres pracy na źródle: pracowałem na liczbach zapisanych w modelach i kandydatach oraz na tym, co solver sam czyta z
rastrów w cache. Nie generowałem overlayów i nie oglądałem pikseli wydawcy, więc łańcuch śladu kończy się na
„gap → callout NONE → elevation NONE”, bez wycinka rastra.

## 2. Pierwszy zły krok (zakotwiczony w kodzie, zmierzony na obiektach)

Miejsce: `packages/reconstruction/src/v2/openings-v2.ts`, łańcuch wysokości → rodzina otworu.

Mechanizm przed zmianą:
1. Gdy nie ma calloutu ani zarejestrowanej elewacji, kod **ustawia** `sillY = floorY`, `headY = floor + 2.1`, obie
   wartości `ASSUMED_FOR_RENDERING` (dawne linie 284–289).
2. Zaraz potem `reachesFloor = sillY − floorY < 0.12` (dawne linie 309–319) czyta to założenie jako fakt.
3. W efekcie każda nieodczytana przerwa w ścianie była `DOOR`, `GLAZED_DOOR` albo `MULTI_PANEL_GLAZING`. Na bryle
   jednokondygnacyjnej szersza od 2,2 m była `GARAGE_DOOR`, bo `attachedVehicle` też używał założonego parapetu.

Objawy zmierzone na otworach zewnętrznych modeli:
- **A01:** ciemna „brama” to `opening-0-rear-14-0`. Przerwa 3,05 m w tylnej ścianie `attached-1`, bez calloutu i bez
  elewacji, dostała `GARAGE_DOOR` z wypełnieniem PANEL. 5 z 5 drzwi na poddaszu stało wyłącznie na założonym parapecie.
- **Goździkowce:** 6 z 6 drzwi na poddaszu i 6 z 6 drzwi na parterze stało wyłącznie na założonym parapecie; na
  poddaszu było 0 okien.

Ślad: `research/analyzer-005u-owner-visual/trace.ndjson`, 18 wybranych otworów. Każdy wpis ma edycję, SHA źródła, ścianę
i kondygnację, przerwę, callout NONE, elewację NONE, wysokości i rodzaj przed/po, ich proweniencję oraz wypełnienie
przed/po.

## 3. Poprawka (jedna, generyczna)

Gdy wysokości nie odczytano (brak calloutu i elewacji), rodzaj otworu decyduje już tylko symbol z rzutu:
- **Drzwi** powstają, gdy na rzucie jest narysowany łuk otwierania (`SOURCE_DERIVED`) albo gdy jest to pusta przerwa
  ≤ 1,3 m na **parterze**, czyli dotychczasowa konwencja rzutu dla wejścia (`VISUAL_SEMANTIC`, nazwane w `unresolved`).
- **Na wyższych kondygnacjach** potrzebny jest łuk: zewnętrzne drzwi wymagają tam balkonu.
- **Wszystko inne** to placeholder okna. Parapet i nadproże są konwencją (0,9 / 2,2 m), a rodzaj i wysokości mają
  `ASSUMED_FOR_RENDERING` z zapisem „drawn as a window, not read as one”.
- **Nigdy z założenia** nie powstaje `GARAGE_DOOR`, `GLAZED_DOOR` ani `MULTI_PANEL_GLAZING`.

Odczytana wysokość (callout albo elewacja) działa jak dotąd. Żaden otwór nie znika: A01 ma 24/24 otwory, Goździkowce
28/28. Zmienia się wyłącznie rodzaj wypełnienia.

## 4. Przed → po

Liczby dotyczą otworów zewnętrznych.

| | A01 przed | A01 po | Goździkowce przed | Goździkowce po |
| --- | --- | --- | --- | --- |
| parter: okna / drzwi / bramy | 4 / 4 / **1** | 7 / 2 / **0** | 5 / 6 / 0 | 7 / 4 / 0 |
| poddasze: okna / drzwi | 6 / **5** | 10 / **1** | **0 / 6** | **4 / 2** |
| drzwi stojące tylko na założonym parapecie (z symbolem po) | 9 | 2 (łuk albo konwencja rzutu) | 12 | 6 (łuk albo konwencja rzutu) |
| otwory nieodczytane (bez calloutu i elewacji) | 16 | 16 | 17 | 17 |
| nieodczytane przerwy ≥ 3 m | 6 | 6 (teraz okna) | 3 | 3 (teraz okna) |
| bryły / dachy | 3 / GABLE + 2 FLAT | bez zmian | 1 / GABLE | bez zmian |
| model SHA-256 | `4ced0179…` | `3a256604…1a28` | `a612a399…` | `faf56de0…b80a` |
| scena (lokalnie, poza Gitem) | 107 siatek / 78 obiektów | 98 / 76 | 162 / 109 | 153 / 109 |

Round-trip i determinizm są OK dla wszystkich czterech scen. Sceny „po” zostały tylko lokalnie; do APK nic nie trafiło.

## 5. Kontrole

| kontrola | wynik |
| --- | --- |
| `rarytasy-g2e` (`m84f2903cb8e14`) | `9f5fd342…` **bez zmian** (0 otworów z założonym parapetem) |
| `marcowki` | `6152770f…` **bez zmian** |
| `dom-w-cieszyniankach` (HIP) | **zmieniona**: `a96afbb1…` → `5ca09ead…`. Ma 15 nieodczytanych otworów; drzwi z samego założenia 6 → 4. Ten sam błąd, poprawiony tak samo; zmiana jest świadoma i opisana, a nie regresja |

## 6. Testy

- Nowy `packages/reconstruction/test/assumed-sill-family.test.ts` (7), oparty na syntetycznych rzutach:
  - przerwa bez symbolu na poddaszu → okno-placeholder z `ASSUMED`;
  - łuk otwierania → drzwi;
  - pusta przerwa ≤ 1,3 m na parterze → drzwi z konwencji;
  - negatyw: szeroka przerwa na przybudówce nie jest bramą;
  - negatyw: szerokie przeszklenie nie jest ani drzwiami wielopanelowymi, ani bramą;
  - kontrola: odczytany callout 100/220 dalej daje drzwi balkonowe / portfenetr;
  - kontrola: odczytany 250/220 na przybudówce dalej daje bramę.
- Na starym kodzie 4 z pierwszych 6 testów **failują**, 2 kontrole przechodzą. Na nowym 7/7.
- Rodziny dotknięte zmianą: `openings`, `fixtures-v2` (15, w tym syntetyczny Ashby z drzwiami na parterze),
  `storey-emission`, `compound-facade-emission`, `vehicle-door-depth`, `fit-and-levels`, `roof-datum`; do tego
  `mobile-scene/owner-005t`, architektura `generalization` i `analyzer-v2`. Wszystko zielone.
- `npx tsc -p tsconfig.json`: zielono. Pełnego `npm test`, CI, 37 wierszy, emulatora ani APK nie uruchamiano.

## 7. Czego NIE naprawiono (bez dowodu nie zgaduję)

1. **A01: bryły „przybudówek”.** `attached-0` [0, 6,196] × [6,406, 8,008] i `attached-1` [6,436, 10,5] × [6,406, 7,858]
   leżą **wewnątrz** obrysu dachu głównego [0, 10,5] × [0, 8,3]. 10,5 × 8,3 = 87,15 m², a wydawca podaje 87,53 m², więc
   to wygląda na jedną bryłę. Płaskie dachy na 4,5–4,6 m stoją pod połacią; to „białe zęby” widoczne na telefonie.
   Pierwszy zły krok leży w dekompozycji rzutu: jeden budynek przeczytany jako bryła główna plus dwa pasy. Nie znalazłem
   w tym etapie generycznej, sprawdzalnej reguły, która by to rozstrzygała, więc nie zmieniłem nic.
2. **Goździkowce: garaż w bryle głównej.** Parter jest czytany jako jeden region 106 m² (90 lic ścian). Na odczycie rzutu
   nie ma wydzielonego pomieszczenia garażu, a więc nie ma pozytywnego dowodu na bramę. Sama powierzchnia `garage_area`
   25,38 m² nie wystarcza, więc reguły nie dodałem.
3. **Nieodczytane przerwy ≥ 3 m** (A01: 6, Goździkowce: 3) zostają otworami, teraz jako okna. Czy każda z nich jest
   prawdziwym otworem, nie jest rozstrzygnięte.
4. Rendery perspektywiczne nie były używane.

## 8. Znana czerwona bramka (sprzed tego etapu)

`tests/architecture/research-isolation.test.ts` › „no tracked file anywhere is the size of a model” failuje **już na bazie
`074d6ae`** (sprawdzone z odłożonymi zmianami). Limit to 32 MB, a
`stage-reports/artifacts/owner-005t/BuildPlan-005T-two-houses-arm64.apk` z etapu 005T-APK ma 39,6 MB. W tamtym etapie
bramka przeszła tylko dlatego, że uruchomiłem ją, zanim plik był śledzony przez Git; to moje przeoczenie.

Nie poluzowałem bramki i nie usunąłem pliku: link do pobrania dla OWNER-a od niego zależy, a ten etap nie dotyka kanału
APK. Pozostałe 70/71 testów tej bramki przechodzi.

Naprawa do decyzji koordynatora: opublikować APK jako wydanie GitHub (tę sesję blokuje HTTP 403) i usunąć plik z gałęzi.

## Pliki

- `packages/reconstruction/src/v2/openings-v2.ts`: poprawka.
- `packages/reconstruction/test/assumed-sill-family.test.ts`: testy.
- `research/analyzer-005u-owner-visual/trace.ndjson`, `metrics.json`: ślad i miary, bez źródeł i bez pikseli.
