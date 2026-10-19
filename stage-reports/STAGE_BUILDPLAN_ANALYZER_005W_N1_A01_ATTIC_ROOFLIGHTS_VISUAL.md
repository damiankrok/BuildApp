# STAGE BUILDPLAN-ANALYZER-005W-N1 — A01 ATTIC + ROOFLIGHTS VISUAL GOAL

**Status: `PARTIAL_ATTIC_RECOVERY`.** To nie jest akceptacja OWNER-a. Szczyty poddasza są odtworzone wiarygodnie
(4 z 4 wysokich okien na właściwych ścianach), okna połaciowe tylko częściowo (2 z 7). Bramka rozmiaru APK nadal
czerwona.

| | |
| --- | --- |
| Baza | `224e42963ec29757948734e76e62ab7ef9bb6899` (005W), worktree czysty |
| Gałąź | `analyzer/005w-n1-a01-attic-rooflights-visual-v1`, jeden commit |
| Nietknięte | `main`, mirror `claude/new-session-3kzcgh`, wydania, APK |
| Źródło | prywatne rastry zapieczętowanego pakietu A01 (cache gapset): rzut poddasza, rzut parteru, 4 elewacje, przekrój; oglądane lokalnie, bez pobierania i bez OCR; żaden piksel wydawcy w repo |
| ZIP OWNER-a / `005w-renders.zip` | nie użyte jako wejście; rendery odtworzone z produkcyjnego viewera |
| Ledger | `research/analyzer-005w-n1-attic/ledger.json` |

## Co mówi źródło (sprawdzone na rzutach i elewacjach, nie z raportów)

- **Rzut poddasza:** zachodni szczyt ma 2 otwory `110/220`, wschodni 2 otwory `100/220`. Jest 7 symboli `78/118`:
  4 na połaci tylnej (x ≈ 2,8 / 4,6 / 7,8 / 8,6 m), 3 na przedniej (x ≈ 2,8 / 7,8 / 8,6 m).
- **Elewacje boczne** (obie oznaczone przez wydawcę `SIDE_UNSPECIFIED`):
  - `…4f52` ma dwa wysokie okna blisko siebie, poza osią, i jedno okno parteru — to **wschód**;
  - `…5ec6` ma dwa okna symetryczne względem osi oraz przeszklenia tarasu z pergolą — to **zachód**.
- **Front i tył** pokazują okna połaciowe dokładnie tam, gdzie rzut (front x 2,8 / 7,7 / 8,6; tył 2,6 / 4,6 / 7,7 / 8,6)
  oraz po **3 czapy kominów** (x ≈ 3,4–3,95 / 6,2–6,9 / 9,15–10,24).
- Oba zgłoszenia z 005W były prawdziwe, ale przyczyna była inna. „Przesunięcie lewej elewacji o ~100 px” to w
  rzeczywistości **elewacja wschodnia przypisana do ściany zachodniej**. Brak okien na prawym szczycie wynikał z
  **błędnej rejestracji rzutu poddasza**.

**Tożsamość obiektów między widokami:** przerwa w ścianie na rzucie i otwór nad nią na elewacji, w kolumnie, w którą
wstawia go rejestracja, to ten sam obiekt. Wybór, która elewacja boczna pokazuje którą ścianę, opiera się na tym,
której ściany przerwy widać na danym widoku. Rozstrzygają oba widoki razem, a każdy musi osobno woleć to samo.

## Przyczyny i poprawki (generyczne, bez stałych tego domu)

1. **Rzut poddasza w złej skali** (dopasowanie par ścian o zgodności 8 %, skala 0,923). Lica zewnętrzne odrzucono
   przy 3,7 % anizotropii: świat ma 8,008 m głębokości, a rzut ma 408 px i drukuje 830. Skutek: linia wschodniej
   ściany wypadała 40 px poza rysunkiem ściany.
   **Poprawka** (`frame.ts: planFrameBySameSheet`): jeśli lica kondygnacji obejmują te same piksele co rzut bazowy w
   obu osiach (≤ 1 %), kondygnacja przejmuje ramę bazową przesuniętą na własne lica.
2. **Komin zlany ze ścianką działową** (6 px przy progu grubości 5/6 px). Bazowy „komin-1” był filarem ściany
   wschodniej między oknami, przesuniętym przez złą ramę.
   **Poprawka** (`interior.ts: coreOfRegion`): ze zlanego regionu wydziela się zwarty rdzeń ≥ 0,3 × 0,3 m. Rdzenie
   zasilają **wyłącznie** kominy, nie ścianki, drzwi ani pokoje; dzięki temu Goździkowce zostały bajt w bajt.
3. **Strona elewacji bocznej zgadywana** („first free one”), a druga boczna w ogóle odrzucona (jej sylwetka razem z
   pergolą ma 16,2 m). Poprawki w `side-orientation.ts`:
   - `decideSidesByOpenings`: zamiana tylko wtedy, gdy każdy widok osobno woli drugą ścianę, udział ≥ ½ i przewaga
     ≥ ⅓;
   - `sameSheetSideRegistration`: odrzucona boczna dostaje rejestrację bliźniaczej bocznej, jeśli obrys szczytu ma tę
     samą szerokość w dwóch pasmach wierszy (≤ 2 %; tu 278/278 i 404/402 px).
4. **Skala i pion boków.** Boki były skalowane z sylwetki (0,016179 m/px), a kalenicę postawiono na czubku komina
   (wiersz 111). Do odczytu otworów boki biorą teraz skalę frontu lub tyłu z tego samego arkusza (0,017045, już
   potwierdzoną 4/4 otworami frontu). Warunki:
   - ten sam rozmiar rastra;
   - wiersz kalenicy frontu równy wierzchołkowi szczytu (≤ 1 %);
   - wierzchołek liczony z obrysu połaci (`gableApexRow`; nachylenie obrysu = tan 40° ± 10 %);
   - oś szczytu nad środkiem rysowanego obrysu rzutu bazowego (kontrola ≤ 0,3 m od kalenicy).

   Takie widoki są tylko do otworów (`bandOnly`) i przechodzą kontrolę per ściana.
5. **Callout `100/70`** (pewność 0,24, brak kandydata 220).
   **Poprawka** (`weakPrintedHeight`): słaba wysokość (< 0,3), sprzeczna z elewacją o > 0,5 m i bez pasującego
   kandydata, nie przebija rysunku. Szerokość z calloutu zostaje.
6. **Drugie okno zachodu** jest za żaluzją, której listwy wyglądają jak biała ściana, więc czytnik słusznie go nie
   widzi. Takie okno przejmuje parapet, nadproże i rodzaj od otworu-rodzeństwa o tej samej szerokości (±5 cm) z
   wydrukowanym calloutem na tej samej ścianie. Oznaczenie: `ASSUMED_FOR_RENDERING`.
7. **Okna połaciowe** czyta się także z widoku pasa frontu lub tyłu, ale tylko takiego, który przeszedł kontrolę per
   ściana w `readWallOpenings`.

Rejestracja pasa nadal **nie** zasila dachu, kominów ani wykończenia, z jednym wyjątkiem: okna połaciowe z widoku
potwierdzonego przez otwory.

## Wynik A01 (przed `f7375a47…` → po `fe1a61b6…`)

| element | przed | po | proweniencja |
| --- | --- | --- | --- |
| zachód, poddasze, `110/220` #1 | 0–2,20 | 0–2,20 (pozycja +6 cm, poprawna rama) | `SOURCE_EXACT` (wydruk) |
| zachód, poddasze, `110/220` #2 | 1,14–2,36, odczyt ze **wschodniej** elewacji | **0–2,20** | `ASSUMED_FOR_RENDERING` (rodzeństwo) |
| wschód, poddasze, `100/220` ×2 | **brak** | **1,00 × 2,32 od podłogi**, z ≈ 3,7–4,7 i 5,3–6,3 | `VISUAL_INFERRED` (`IMAGE_METRIC_REGISTERED`) |
| zachód, parter, 1,77 m | okno 0,90/1,30 założone | przeszklone drzwi 0–2,10 | `VISUAL_INFERRED` |
| zachód, parter, 1,26 m | okno 0,90/1,30 założone | przeszklenie 0–2,37 (nadproże prawdopodobnie z belką pergoli) | `VISUAL_INFERRED` |
| okna połaciowe | 0 | **2** (front x 7,41–8,08 i 8,28–8,95; źródło 7,76 i 8,58) | `IMAGE_METRIC_REGISTERED` |
| kominy | 2 (jeden to filar ściany) | **3** (x 3,45–4,02 / 6,03–6,93 / 9,04–10,36) | rzut + render |

**Bez zmian:**
- front: 250/220 0–2,09, 100/220 0–2,09, 105/210 wejście 0–2,02, 90/210 szkło 0–2,02;
- tył;
- jedna bryła MAIN, kalenica X, 40°;
- poziom +2,80, grubość 0,152;
- obrys 10,50 × 8,008.

Wnętrze poddasza (pokoje, ścianki, schody, drzwi wewnętrzne 0,82 → 0,88 m) przesuwa się razem z poprawioną ramą.

**Widoczny skutek uboczny — ton ścian.** Bryła ma teraz `mat-render-mid` (szary) zamiast `mat-wall` (jasny).
Reguła `readMassTones` się nie zmieniła: próbkuje parter (0,3–2,5 m) widoków sylwetkowych. Po poprawnym przypisaniu
`…4f52` do wschodu czyta szary tynk, który na źródle rzeczywiście dominuje na parterze wschodu, frontu i tyłu.
Biały szczyt i pas nad parterem nie mieszczą się w jednym tonie bryły. Wcześniejszy jasny ton wynikał z odczytu
lustrzanego, niepoprawnego widoku. Zostawiam to jako uczciwy wynik, do oceny OWNER-a.

**Odrzucone w tej rundzie:** przestawienie wiersza zera rejestracji sylwetkowej boku na wierzchołek szczytu. Też
zmieniało ton i wysokości kominów, więc z niej zrezygnowałem. Otwory czytają się z osobnych widoków w skali arkusza,
a rejestracja sylwetkowa zostaje jak w bazie.

**Do decyzji OWNER-a: 3 kominy zamiast 2.** Brief wymienia „2 kominy” jako niezmiennik. Zmiana wynika z rzutu
poddasza (3 bloki), frontu i tyłu (po 3 czapy w tych samych x) oraz bocznej (2 czapy, bo dwa kominy pokrywają się
w z). Nie jest to jedna niepewna klatka. Jeśli OWNER ją odrzuci, wycofanie to usunięcie gałęzi rdzenia w `interior.ts`.

**Nierozstrzygnięte okna połaciowe:**
- front, x ≈ 2,8: łata zlewa się ze znakiem wodnym (0,92 × 0,56, wypełnienie 0,64), więc nie została przyjęta;
- tył, 4 okna: widok pasa tyłu nie przechodzi kontroli ściany (1 z 2 przerw), dlatego dachu z niego nie czytam.

Nie dopisałem ich z rzutu na sztywno.

## Kontrole (offline replay, SHA-256 modeli)

| dom | baza | po |
| --- | --- | --- |
| A01 `m60124f28f071a` | `f7375a47b982…` | `fe1a61b6ec0563c1580d524a80b606de4aab0db2b5bebb406f4b3be39c18a960` |
| Goździkowce `m79923e950094d` | `911456a88b25…` | **identyczny**: garaż nr 8 (26,09 m²), ściana 0,303 i brama 3,22 bez zmian |
| Marcówki | `cf7977438b00…` | **identyczny** |
| Cieszynianki | `e4e562923319…` | **identyczny** |
| Rarytasy G2E `m84f2903cb8e14` | `9f5fd342a53e…` | **identyczny** |
| Rarytasy OWNER `m3ea…` | `NOT_RUN` | brak wejścia, bez podmiany na G2E |

## Rendery (BuildWorld web, Three.js, SwiftShader)

Paczka leży poza repo: `/home/user/work005w-n1/005w-n1-renders.zip` (SHA-256 `0ed20537253a8918aa60031d68c8e3a05c9a55533594bdf51260751fe8c1e9c6`).
Zawiera:
- A01 przed/po: przód (niezmiennik), tył, lewy szczyt (zachód), prawy szczyt (wschód), widok z góry z dachem,
  perspektywę ¾;
- Goździkowce przed/po;
- zestawienia obok siebie.

Rysunki wydawcy w paczce nie występują.

## Testy

| bramka | wynik |
| --- | --- |
| nowy `attic-gable-registration.test.ts` | 14/14 (syntetyczne rastry) |
| `packages/reconstruction` | 53 pliki, **817/817** |
| `tsc -p tsconfig.json` | czysto |
| `tests/architecture/research-isolation.test.ts` | 70/71 — `KNOWN_BASELINE_FAIL`: APK 39 556 682 B > 32 MB (bez zmian) |
| viewer (BuildWorld) | `geometry ok` dla wszystkich 4 modeli, 0 błędów strony |
| CI 41 jobów, APK, emulator, e2e | `NOT_RUN` |

## Zmienione ścieżki

- `packages/reconstruction/src/v2/frame.ts`: `planFrameBySameSheet`
- `packages/reconstruction/src/v2/interior.ts`: `coreOfRegion`, rdzenie tylko do kominów
- `packages/reconstruction/src/v2/side-orientation.ts`: `decideSidesByOpenings`, `gableOutline`, `gableApexRow`,
  `sameSheetSideRegistration`
- `packages/reconstruction/src/v2/openings-v2.ts`: `weakPrintedHeight`, rodzeństwo, `onBandViewAccepted`
- `packages/reconstruction/src/v2/reconstruct-v2.ts`: G1c (tożsamość boków, ten sam arkusz), rama kondygnacji, okna
  połaciowe z potwierdzonego pasa
- `packages/reconstruction/test/attic-gable-registration.test.ts`, ledger, ten raport, `PROJECT_STATUS.md`

## Otwarte

- 5 z 7 okien połaciowych (patrz wyżej).
- Głębokość świata 8,008 wobec wydrukowanych 830. Tu jej nie zmieniałem, bo brief tego zabrania bez osobnego
  potwierdzenia. To ona wymusza kotwiczenie osi na rysowanym obrysie, a nie na kalenicy modelu.
- Panel wejścia, pas pod dachem i pergola: nie ruszane.

STOP.
