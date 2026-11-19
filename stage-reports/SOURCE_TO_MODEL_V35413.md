# v3.54.13 — kontury wykończeń, ochrona geometrii i automatyczne cztery elewacje

Gałąź `claude/new-session-3kzcgh`. Baza `2c21ce1` (v3.54.12-REAL, APK 1343). Commity etapu: `10cb387` (schemat 1.9.0,
kontur, migracja, reseal, moduł wyglądu), część 2 (ramy okien w czytniku, miara granic, arbitraż B), `65bcea4` (C
zmierzone i zapieczętowane), commit sceny oddanej i dokumentów. Master Plan v3.54.13 skopiowany w całości do
`docs/MASTER_PLAN.md`. **Koszt etapu: 0,04623 USD** (4 żądania C-live; księga 23,854612 z 24,11036 USD, pułap nie
podniesiony; `research/ai-assist/spend-ledger-v35413.json`).

## 0. Najważniejsze

- **Uskoki kolorów miały jedną przyczynę w trzech miejscach:** czytnik wykończeń LOCAL próbkuje *jeden poziomy pas*
  na kondygnację i składa z niego przebiegi 1-D; kontrakt (`surfaceRegions`) zna tylko prostokąt `along × y`; każda
  kondygnacja jest szacowana osobno. Stąd drewno frontu od 0,65 m na parterze i od 1,42 m na piętrze i brak skosu.
- **Naprawa:** kontur regionu wykończenia (model **1.9.0**, `SurfaceRegion.outline`), jedna źródłowa granica
  rejestrowana raz na elewacji i dopiero potem dzielona między powierzchnie, które model faktycznie pokazuje (mapa
  widoczności z kompilowanej sceny). Geometria użytkowa nietknięta — wymusza to odcisk geometrii.
- **Brama:** traciła 2,20 m, bo jedynym świadkiem rozstrzygającym odczyt „275 albo 220” był pomiar na *oryginalnej*
  elewacji frontu; szkic go zastąpił, otworu na szkicu nie widać, więc wracała wartość 2,75 (UNRESOLVED). W C geometria
  pochodzi z oryginałów (2,20 zachowane z definicji), a dla ścieżki B jest arbitraż per właściwość (RETAINED 2,20).
- **Oddany model (`marcowki-c-v35413`):** geometria LOCAL A bez zmian, wykończenia z konturów — przód i tył ze szkiców
  OWNER-a, boki (bez szkiców) z odczytu API. Rozpoznawalność 14/14, punkty stref 14/14 (A 12/14), 16/16, 27/27, zgodność
  pikseli frontu 0,956 i tyłu 0,953 (A 0,739 / 0,771), ciągłość drewna przez strop 0,992 (A 0).
- **Automatyczne cztery elewacje wykonane:** 4 oryginały → JSON konturów (C-live), 0,04623 USD, kontrola czterech
  stron 7/7. Front tak dobry jak ze szkicu; tył słabszy (szersze trójkąty szkła i węższy pas niż w modelu).

## 1. Ślad: rozpoznanie materiału → widoczna powierzchnia (§3)

| krok | stan przed v3.54.13 | dowód |
|---|---|---|
| czytnik | `readFinishRuns` próbkuje kolumny w paśmie +0,4…+2,0 m (parter) lub +1,1…+2,3 m (piętro, flaga), łączy je w przebiegi 1-D | `reconstruct-v2.ts` (pętla wykończeń), `tones.ts` |
| kontrakt | `surfaceRegions[]`: `along [a0,a1] × y [y0,y1]` — prostokąt; brak konturu, brak znaczenia granicy | `BuildingV2.surfaceRegions` |
| kondygnacje | każda wnęka/kondygnacja osobno; brak wspólnej granicy | B-both: drewno parteru 0,645–3,161, piętra 1,416–5,276 na ścianach z tym samym x 0…7,9 |
| host | ściana z tyłu wnęki (`wallRef`); rama, pas, płyta poza zasięgiem | — |
| kompilator | prostokąt przycięty do wierzchołka ściany, otwory wycięte; geometria nietknięta | `surface-regions.ts` |

Odpowiedzi: (1) tylko pas z wiersza, nie kontur; (2) kontrakt nie przechowywał konturu; (3) każde piętro niezależnie;
(4) tylko ściana tylna wnęki; (5) kompilator był poprawny dla prostokąta. Pierwsza przyczyna: czytnik + kontrakt.

## 2. Kontur i wersjonowanie (§4, §10)

- `SurfaceRegion.outline` (wielobok prosty w `(a, b)` lica, wewnątrz `rect`, tylko OUTER/INNER) — walidacja: wewnątrz
  rect, z polem, bez samoprzecięć, nie na czole. Kompilator tnie kontur pasami pod linią wierzchołka ściany (w pasie
  wierzchołek jest prosty, więc pas jest wypukły), składa kawałki w jeden region (dodatkowe pętle zewnętrzne
  teselatora znoszą wspólne krawędzie) i wycina otwory tam, gdzie zachodzą na kontur.
- **Model 1.9.0.** v3.54.12 zapisał `face: START/END` pod 1.8.0 — czytnik 1.8.0 odrzuca taką wartość, więc to dwa
  znaczenia pod jedną wersją. Migracja 1.8.0→1.9.0 (jak 1.7.0→1.8.0 dla GABLE_FRAME): plik 1.8.0 bez nowych pól —
  jeden zgłoszony krok; plik 1.8.0 z czołem — „restated” z własną notą (tak pisał tylko builder v3.54.12); kontur pod
  1.8.0 albo czoło pod 1.7.0 — odmowa. Kandydaci przepieczętowani (`reseal-log`), modele OWNER-a przepisane wyłącznie w
  napisie wersji, nowe pieczęcie w `scenes.ts`. **Wszystkie 14 scen: siatki i semantyka bajt w bajt te same**, zmieniły
  się tylko `modelSchemaVersion` i hashe. Loader Androida sprawdza wersję *pakietu sceny* (bez zmian), a wersję
  modelu tylko wyświetla — stare APK czytają nowe sceny.

## 3. Brama: przyczyna i naprawa (§5)

Ślad z `facadeAlignment` na odtworzeniu obu biegów (deterministycznym, `results/gate-trace.json`):
- **A:** plan drukuje wysokość czytelną jako „275 albo 220”; front (oryginał, rejestracja SILHOUETTE) mierzy otwór
  na 2,203 m → korekta N7-P2 `head 2.75 → 2.20` z dopasowaniem do wydruku 220, `SOURCE_CORROBORATED`.
- **B-both:** front to szkic; brama jest szara w poziome pasy, czytnik nie widzi otworu (`NOT_OBSERVED`, „glass the
  wall's colour”) → brak świadka → fallback 2,75, `height UNRESOLVED`.

Pierwsza błędna decyzja: wymiana świadka metrycznego (oryginał) na obraz pomocniczy. Naprawy:
1. **C:** wariant wyglądu nie rekonstruuje otworów — geometria i każdy parametr metryczny pochodzą z biegu na
   oryginałach; wykończenia dokłada konsument. Odcisk geometrii C = A.
2. **Arbitraż per właściwość** (`arbitrate.ts`, `ARBITRATION_VERSION 1.0.0`): na fasadzie, której elewacja była obrazem
   pomocniczym, wartość kandydata słabsza niż SOURCE_EXACT nie zastępuje skorelowanej wartości bazy (RETAINED);
   SOURCE_EXACT, którego baza nie miała, poprawia (CORRECTED); skrzydło/assembly drzwi z koloru → UNSUPPORTED;
   przesunięty otwór albo baza innej rewizji źródeł → UNRESOLVED (kandydat zostaje, właściwość nazwana).
   **B-guarded:** brama RETAINED 2,20 (16/16 cech, było 15/16), drzwi wejścia: szkło→drewno i brak `assembly`
   UNSUPPORTED/RETAINED. Kontrpróba „obcy cache” (inny hash rzutu w bazie): baza nie jest świadkiem, wszystko
   UNRESOLVED. Poza zakresem arbitrażu zostają różnice B-both w dachach, balkonach, balustradach i kominach (nazwane).

## 4. Kontrakt obserwacji i konsument (§6–7)

- **`AppearanceObservation` 1.0.0** (`analysis-service/src/appearance/contract.ts`): hash źródłowej elewacji i hash
  faktycznie analizowanego obrazu, ich wymiary, afiniczna transformacja do źródła z opisem dopasowania, regiony:
  klasa (LIGHT_RENDER, DARK_RENDER, TIMBER, GLASS, ROOF, METAL, BACKGROUND, UNKNOWN), kontur, otwory, widoczność,
  niepewność, `hostHint`, ciągłość; producent (LOCAL_SKETCH_SEGMENTATION / API_CONTOUR_READING / MANUAL_DIAGNOSTIC,
  wersja, model i wersja promptu). Kolejność regionów i kluczy nie zmienia wyniku (test).
- **Czytnik szkicu** (lokalny): deterministyczne k-means, klasy po rodzinie barwy *względnie do rysunku* (ciepła
  nasycona = drewno, chłodna = szkło, neutralne wg jasności) — nie po sztywnym RGB; linie rysunku dzielone po środku;
  ciemne listwy przy szkle należą do otworu.
- **Konsument:** kontur mapowany raz do metrów elewacji (transformacja obserwacji + rejestracja LOCAL tej elewacji),
  potem dzielony przez mapę widoczności (ortograficzny z-bufor kompilowanej sceny): część na ścianie parteru i na
  ścianie piętra to *ten sam wielobok*, więc granica przez strop jest jedna; rama, pas, płyta, balustrada zachowują
  swój materiał; szkło balustrady jest przezroczyste. Jedna partycja ściany — dwa wykończenia dzielą krawędź komórek
  (bez szczeliny i bez nakładania). Wynik: regiony `appearance-*` z konturem, ślad (dodane/usunięte/pominięte),
  odcisk geometrii przed = po (inaczej odmowa).

## 5. Warianty i wynik (§6, §8)

Miary (`results/`): karta 14 cech, 14 punktów stref, 16 cech, 27 wierszy, **nowa miara granic** — IoU klas, F1 granicy
przy 0,10 m i ciągłość przez strop, liczone w pikselach oryginału na MANUAL_REFERENCE (5 konturów frontu i tyłu,
odrysowane ręcznie z oryginałów przed oceną C; otwory nieoceniane).

| wariant | pochodzenie | ident. | strefy | 16 | 27 | zgodność F / R | drewno\|ciemny F | drewno\|rama F | ciągłość | pas\|drewno R | szczyt\|rama R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | LOCAL na oryginałach (v3.54.11) | 14/14 | 12/14 | 16/16 | 27/27 | 0,739 / 0,771 | 0,815 | 0,359 | 0 | 1,0 | 0,46 |
| B-both | szkice zamiast elewacji, 2 flagi (v3.54.12) | 14/14 | 14/14 | 15/16 | 27/27 | 0,909 / 0,909 | 0,91 | 0,66 | 0,786 | 1,0 | 0,671 |
| B-guarded | B-both + arbitraż | 14/14 | 14/14 | 16/16 | 27/27 | 0,909 / 0,909 | 0,91 | 0,66 | 0,786 | 1,0 | 0,671 |
| C-offline | geometria A + kontury szkiców (przód, tył) | 14/14 | 14/14 | 16/16 | 27/27 | 0,956 / 0,952 | 0,804 | 0,975 | 0,992 | 1,0 | 0,846 |
| C-live | geometria A + kontury z odczytu API 4 stron | 14/14 | 14/14 | 16/16 | 27/27 | 0,958 / 0,839 | 0,828 | 0,96 | 1,0 | 0 | 0,441 |
| **C (oddany)** | geometria A + szkice (przód, tył) + API (boki) | 14/14 | 14/14 | 16/16 | 27/27 | 0,956 / 0,953 | 0,81 | 0,976 | 0,992 | 1,0 | 0,845 |

Wnętrze: wszystkie warianty C mają odcisk geometrii użytkowej A (`0e493584…`): te same ściany, otwory, pokoje (13),
schody, poziomy, ID i relacje; plansza wnętrza bez dachu identyczna. Deterministyczność: C-offline zbudowany dwukrotnie
od zera i C-live dwukrotnie z zapisanych obserwacji — modele bajt w bajt (`22ef694e…`, `8a6c0cfe…`).

## 6. Co pokazuje pełna granica (§8, kontrpróby)

| kontrpróba | punkty stref | miara granic |
|---|---|---|
| granica drewna przesunięta o 0,5 m | **14/14** (nic nie widzi) | F1 drewno\|ciemny 0,80 → **0,28** |
| odcień +20° / −15° | 14/14 | klasa drewna zachowana; przy −15° szkło szarzeje → ramy okien zostają ciemne (F1 0,51) |
| szkic bez ramy | 14/14 | rama zostaje (geometria z oryginałów), drewno\|rama 0,56 |
| zamiana R↔B | 11/14 | „niebieskie drewno” czytane jako szkło — zmiana klasy, nazwana |
| prawdziwy uskok między piętrami | — | zachowany (test syntetyczny) |
| miękki cień na jasnym tynku | — | nie staje się ciemnym tynkiem (test) |
| dwie powierzchnie o różnym materiale | — | element przed ścianą zachowuje swój materiał (test) |
| zmiana obrazu pomocniczego a brama | — | C: 2,20 we wszystkich kontrpróbach; B-guarded: RETAINED |
| obcy cache tego samego URL | — | arbitraż: UNRESOLVED, nic nie przeniesione |

## 7. Automatyczne cztery elewacje (C-live, §9)

Plan zapisany i scommitowany **przed** wysłaniem (`research/source-to-model/v35413/live-plan.json`): model Claude Sonnet
5.5, prompt `appearance-contours-1`, bez rozszerzonego myślenia, `max_tokens` 4000, 4 żądania + 1 ponowienie łącznie,
najgorszy przypadek 0,24 USD przy 0,301978 USD dostępnych. Każde żądanie rezerwowało najgorszy przypadek przed
wysłaniem. Wynik: **4 żądania, 0 ponowień, 0,04623 USD zmierzone** (1571–1572 tokenów wejścia, 620–1133 wyjścia);
obraz wysłany w rozmiarze źródła (bez skalowania i paddingu), odpowiedź tylko JSON walidowany kontraktem, nic z niej
nie jest wykonywane. Kontrola czterech stron (lokalna, bez kosztu): szerokość przód = tył (0,017 m), grunt, wierzchołek,
głębokość wschód = zachód (0,197 m), okap, kalenica przód = boki — **7/7 w tolerancji rejestracji**. Front tak dobry jak
ze szkicu (0,958); tył słabszy: szersze trójkąty szkła i węższy pas niż model, więc jasne marginesy w szczycie (0,839).
Boki: jedyne źródło konturów dla elewacji bez szkicu — ciemny blok parteru po zachodniej stronie trafia do modelu.

Koszt na dom: **zmierzony 0,0462 USD** (4 strony, bez ponowień) + render podglądu i rekonstrukcja lokalnie (konsument
~2 s na stronę) ; **szacunek z ponowieniem** ≤ 0,06 USD; górna granica planu 0,24 USD. Odczyt jest nowym kandydatem
(nowy prompt/model = nowa rewizja), przyjęta obserwacja z hashami źródeł i wersjami daje ten sam model przy reuse.

## 8. Drugi projekt (§8)

Pallas (inny wydawca): LOCAL zarejestrował tylko elewację tylną. Cokół z uskokiem pod środkowym oknem odrysowany
ręcznie na oryginale (**MANUAL_DIAGNOSTIC**; paleta nie ma cegły, podany jako ciemny tynk) i podany temu samemu
konsumentowi: dwa regiony z konturem (z uskokiem) na właściwych ścianach, odcisk geometrii bez zmian, 0 diagnostyk.
To dowód przenośności konsumenta i ochrony geometrii — **nie** transferu automatycznego odczytu.

## 9. Osiem odpowiedzi

1. **Uskoki kolorów:** czytnik pasowy 1-D + prostokątny kontrakt + niezależne kondygnacje (rozdz. 1).
2. **Kontur dotarł:** tak — 12 skór `appearance-*` w scenie oddanej, materiały drewno/ciemny tynk; wypakowane z APK
   1344 i sparsowane przez parser scen Androida (JVM); rendery w tych samych kamerach.
3. **Brama:** traciła świadka metrycznego (oryginał frontu); teraz 2,20 zachowane (C z definicji, B przez RETAINED).
4. **C poprawił miniaturę bez zmiany geometrii:** tak — odcisk A, te same ID i relacje, wnętrze identyczne; zgodność
   granic 0,74/0,77 → 0,96/0,95.
5. **Pełna granica vs 14 punktów:** przesunięcie granicy o 0,5 m daje 14/14 punktów i F1 0,28; B-both ma 14/14
   punktów, ale ciągłość 0,786 i drewno\|rama 0,66.
6. **Automatyczne 4 elewacje:** wykonane (kontrakt JSON, 0,04623 USD, 7/7 kontroli stron); słabszy tył opisany.
7. **Drugi projekt:** konsument i ochrona geometrii działają (ręczna diagnostyka); automatyczny odczyt tylko Marcówki.
8. **Oddany:** `marcowki-c-v35413` (scena 1 w APK 1344), C-live jako scena 2 (eksperyment). Ograniczenia niżej.

## 10. APK, testy, regresja

APK 1344 (podpis `6e48fac4…`, arm64, zipalign OK, klucz 0 trafień, LOAD 0x1000 w dwóch bibliotekach jak wcześniej):
sceny wypakowane = repozytorium, sceny z 1343 te same siatki. ANDROID_UI_NOT_VERIFIED. Testy: kontur (kompilacja,
walidacja, otwory), migracja 1.9.0, konsument/czytnik/maski/arbitraż (12), sceny (owner-v35413), Android
testDebugUnitTest. Pełna macierz i regresja: `results/matrix-final.txt`, `results/regression.txt`.

## 11. Otwarte

| problem | stan |
|---|---|
| tył C-live: szersze szkło, węższy pas niż model | odczyt API; konsument nie poprawia geometrii z koloru (zgodnie z regułą) |
| pas stropu (cienka jasna linia na 3,06 m) | krawędź płyty widoczna w elewacji, poza zakresem wykończeń |
| boki bez referencji granic | miara granic tylko przód/tył (referencje ręczne) |
| drugi dom automatycznie | nie badany (budżet; ręczna diagnostyka konsumenta wykonana) |
| cegła | brak klasy w palecie produktu |
