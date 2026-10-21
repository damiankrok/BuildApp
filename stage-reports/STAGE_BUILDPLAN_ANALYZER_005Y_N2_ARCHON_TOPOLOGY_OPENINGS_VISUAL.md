# BUILDPLAN-ANALYZER-005Y-N2 — topologia ścian, wnęki i otwory w pięciu domach ARCHON

**Status: PARTIAL_SOURCE_GROUNDED · OWNER_VISUAL_PENDING · STOP.**
Nie deklaruję OWNER_VISUAL_ACCEPTED — ocena zrzutów należy do OWNER-a. Bez APK, bez wydania, bez CI 41 zadań, bez
emulatora, bez scalania.

| | |
|---|---|
| Repozytorium | `damiankrok/BuildApp` |
| BASE | `4f4116b57cceb4187e219de8f2761053560098cb` (005Y-N1) |
| Gałąź | `analyzer/005y-n2-archon-topology-openings-debug-v1` |
| HEAD | commit zawierający ten raport — patrz `git log` gałęzi (ostatni commit kodu: `936e9e4`) |
| Lustro `claude/new-session-3kzcgh` | nietknięte: `bfaf286e95105c2cdb32df2d298d3cd93bd43449` |
| Zakres | wyłącznie pięć domów rozwojowych: A01, Goździkowce 3, Marcówki, Cieszynianki 12, Rarytasy 5 (m84f). OWNER m3ea nie był podstawiany. |

Wszystkie poprawki są ogólne: żadnych stałych domu, identyfikatorów projektu, współrzędnych z rysunku ani wartości
drukowanych wpisanych w kod. Prywatne rastry ARCHON i wycinki z nich zostały poza repozytorium (prywatny ZIP debug).

## 1. Co zmieniono (ogólnie, z proweniencją)

1. **Front bryły przez cienkie pasy wykuszy** — `packages/reconstruction/src/layout.ts`, `bayStripsOf` + `pocketRecesses`.
   Pas zamknięty (flood fill go nie dosięga), płytszy niż ciało (`minBodySpanM`: dwie ściany i pomieszczenie),
   leżący między licem przyjętej bryły a licem koperty ścian i domknięty wzdłuż zewnętrznej krawędzi
   (zamknięcie ≥ 0,62 w każdej komórce: ściana, okno, drzwi między filarami), jest frontem tej bryły, nie strefą ani
   osobnym ciałem. Pasy muszą pokryć ≥ 50 % boku, a każdy odcinek między nimi musi być kieszenią (komórki
   nieobudowane), zamkniętą od tyłu i po obu końcach — wtedy to wnęka. Odcinek przy narożniku (karb w obrysie) —
   odmowa z nazwą. Bryła sięga lica ścian, kieszeń zostaje `RecessHypothesis`.
2. **Wnęka wewnątrz prostokąta bryły** — `packages/reconstruction/src/v2/reconstruct-v2.ts` (`pocketsOf`, pętla
   „pockets”), `building.ts` (`PocketV2`), `emit.ts`. Usta wnęki to `PASSAGE` (otwór bez wypełnienia) w ścianie
   pierścienia; dwa zwroty i ściana tylna to własne ściany, ustawione licem od strony kieszeni tam, gdzie podaje je
   atrament rzutu (`inkFace` — region bywa cięty po licach albo po osiach ścian); otwory ściany tylnej czytane na jej
   własnej linii (callout, łuk, szerokość szczeliny); pomieszczenia nie „wlewają się” do kieszeni; przegroda leżąca na
   linii zwrotu i biegnąca dalej zachowuje część poza zwrotem (`wall-topology.ts`, `HostBand.keepBeyond`); pod
   stropem kolejnej kondygnacji ściany wnęki kończą się pod płytą. Wnęka sięgająca narożnika — odmowa (karb).
   Wysokość przejścia: z elewacji, jeśli ją czyta; inaczej `ASSUMED_FOR_RENDERING` (strop kondygnacji, pod okapem).
3. **„Szpilka” Cieszynianek** — `packages/geometry/src/compile.ts`. Ściana z `FOLLOW_ROOF_PLANES` kończy się na
   połaci także w obrębie jej otworu (komin, okno dachowe): otwór jest w pokryciu, nie w tym, na czym dach leży.
   Wcześniej `coveringAt` (`architecture-compiler.ts:101`) wyłączał otwory, ścianka pod kominem trzymała nominalne
   7,20 m i przebijała dach (`WALL_NOT_UNDER_ROOF`). Hash modeli bez zmian — zmiana jest w kompilatorze sceny.
4. **Symbol drzwi na rzucie** — `packages/reconstruction/src/v2/openings-v2.ts`, `doorLeafDrawn` + reguła
   `GLAZED_DOOR`. Otwór do podłogi z liniami w szczelinie (szkło albo próg — nazwane jako niepewne) jest drzwiami
   przeszklonymi tylko wtedy, gdy obok narysowano symbol drzwi: skrzydło od lica przy jednym ościeżu, długości
   szczeliny, kończące się (papier za 1,1 szerokości), cienkie (papier po stronie otworu), i łuk o promieniu szerokości
   (≥ 60 % zatuszowany 6°–84°, cienki ≥ 50 % od 30°), z osią w grubości muru; na którejkolwiek stronie ściany. Atrament
   względem tła przed otworem (mediana), nie stałej szarości. Tylko kondygnacja parterowa.
5. **Jeden grunt na dom** — `reconstruct-v2.ts`. Widok zarejestrowany „po pasie ścian”, którego grunt różni się
   o > 0,3 m od mediany gruntu pozostałych (≥ 2) zarejestrowanych widoków, nie jest czytany (odmowa z nazwą).
6. **Proweniencja okien dachowych** — `roof-details.ts` (`withRecognisedHalves`). Odczyt rozpoznawacza podniesiony
   przez pierścień-rodzeństwo z tego samego arkusza mówi to wprost: „supported by a sibling on the same sheet …, not an
   independent reading”; odczyt bezpośredni: „outright, both halves”.
7. **Audyt `|| true`** — `reconstruct-v2.ts:1313` (bazowo). `interior.filter((i) => masses.find((m) => … || true))`:
   predykat zawsze prawdziwy, `find` zawsze zwraca pierwszą bryłę, filtr nic nie odrzucał — kominy dostawały bloki ze
   wszystkich odczytów wnętrza (też brył dołączonych). Martwy warunek usunięty; zachowanie bez zmian (hash bez zmian).

## 2. Macierz rozbieżności

Hash modelu: pierwsze 16 znaków SHA-256 `model.json`. „Przed” = przebieg produkcyjny na BASE (odtworzony bajt w bajt),
„po” = przebieg produkcyjny na HEAD. Zrzuty: `renders-005y-n2.zip`, `<dom>/przed|po/<widok>.png` (te same presety
kamery aplikacji).

| Dom | Zasób + wycinek | Odczyt człowieka | Detektor (przed) | FIRST_BAD plik:linia + bramka | Poprawka / odmowa | Hash przed → po | Zrzut | Pewność + proweniencja |
|---|---|---|---|---|---|---|---|---|
| Cieszynianki | rzut parteru (`asset-rzut-ebb40feeba`), y 560–700 px; `debug/ciesz-front-strips-pocket.png` | Lico frontu y≈678 px (16,60 m = 470+1110+80); wykusz kuchni (okno 200/150 + ściana), filary garażu z bramą 275/225; wiatrołap = wnęka 0,8 m z drzwiami 105/210 w ścianie tylnej | Bryła cięta na y=649 (15,80 m); oba pasy wykuszy odrzucone (ściana na obwodzie 0,18 i 0,06); front: „okno” 3,75 m, drzwi 1,06, „okno” 3,69 m w miejscu garażu | `layout.ts:1797` bramka `MIN_MASS_WALL_FRACTION 0.35` (ściana wykusza stoi tuż wewnątrz linii siatki, brama między krótkimi filarami czyta się jako linia) | **Poprawka 1+2**: bryła 11,70 × 16,60 m; okno kuchni 1,81 m; `PASSAGE` 2,54 m; drzwi 0,88 × 2,10 w ścianie tylnej wnęki; otwór garażu 2,75 m (= szczelina rzutu). Nie hardkodowano 0,8 m ani 275/225. | `f512a136a1d4bd5f` → `2ac1ed37c1af60c0` | `ciesz/przed|po/1-przod.png`, `5-34-przod-prawo.png` | Bryła `SOURCE_DERIVED` (pas + koperta ścian); szerokość bramy `SOURCE_DERIVED` z rzutu; wysokość przejścia `ASSUMED_FOR_RENDERING`; potwierdzenie niezależne: prawa elewacja rejestruje się na 16,60 m |
| Cieszynianki | j.w., brama | Brama garażowa 275/225 | Rodzina: OKNO (założone) | `openings-v2.ts:524` (005U: bez odczytanej wysokości nie ma bramy garażowej) + pierścień „75/25” odrzucony (`callout-recogniser`: zgubiona cyfra wiodąca, niestabilny) | **Odmowa** — rodzina zostaje założona (`ASSUMED_FOR_RENDERING`), UNRESOLVED. Nie wymuszam odczytu i nie robię bramy z samej szerokości. | j.w. | j.w. | rodzina: założona; szerokość 2,75 z rzutu |
| Cieszynianki | elewacja boczna (prawa) | Okna 2,0/0,9/0,9/2,0 z parapetem ≈0,9 m | Po wydłużeniu bryły prawa elewacja zaczęła się rejestrować (po pasie ścian), ale z gruntem +0,79 m (lewa −0,32, front −0,40) → parapety 1,70 m | `frame.ts:407` tolerancja gruntu 0,9 m dla rejestracji po pasie | **Poprawka 5** — widok odrzucony z nazwą; otwory wschodnie jak w bazie (szerokości z rzutu, wysokości założone). UNRESOLVED: rejestracja pionowa tej elewacji. | j.w. | `ciesz/po/4-prawa.png` | `ASSUMED_FOR_RENDERING` (wysokości) |
| Cieszynianki | scena (połać `roof-main-plane-high`) | Komin nad dachem, nic poza nim | Ścianka `main-iwall-0-z-…` (x 8,90) pod otworem komina na 7,20 m → „szpilka” + `WALL_NOT_UNDER_ROOF` | `geometry/src/compile.ts:161` (`holesOfPlane` przekazane do `planeSurface`) + `architecture-compiler.ts:101` | **Poprawka 3** — diagnostyka sceny 0; HIP + 2 kominy zachowane | (scena) | `ciesz/przed|po/5-34-przod-prawo.png` | geometria kompilatora |
| Cieszynianki | — | Brak podcieni/zadaszeń wejścia w modelu | — | brak czytnika podcieni opartego na źródle | **Odmowa** (poza wnęką wiatrołapu, która jest teraz zbudowana) — nic nie dodano bez źródła | — | — | — |
| Goździkowce | rzut parteru (`asset-rzut-01d4b6474c`), x 250–520, y 470–640; `debug/gozd-porch-recess.png` | Wnęka wejściowa: drzwi 105/210 cofnięte, ścianka z 70/210 z boku | Region `RECESS` dekompozycji wewnątrz prostokąta bryły → zbudowany na lito; na licu „okno” 3,14 m | `reconstruct-v2.ts:407` (v2 tylko liczy `layout.recesses`, nie buduje ich) + `reconstruct-v2.ts:1162` (szczelina na licu staje się otworem) | **Poprawka 2** — `PASSAGE` 3,19 m, zwroty, ściana tylna z drzwiami **1,05 × 2,10 (wydrukowane 105/210)**. 70/210 w zwrocie — UNRESOLVED (zwroty nie mają otworów). | `68d6f2e7f57f8794` → `869774d095b76fcb` | `gozd/przed|po/5-34-przod-prawo.png` | drzwi: callout `SOURCE_EXACT`; geometria wnęki `SOURCE_DERIVED`; wysokość przejścia 2,52 m `ASSUMED_FOR_RENDERING` (strop kondygnacji; elewacja jej nie czyta) |
| Goździkowce | brama | 325/225 vs szczelina ≈3,22 m | dwa świadectwa | — | **Zachowane rozdzielnie** (bez zmian) | j.w. | — | — |
| Marcówki | rzut parteru (`asset-rzut-19a11bc745`), x 80–300, y 640–790; `debug/marcowki-entrance-door-symbol.png` | Wejście 105/210: skrzydło przy prawym ościeżu + łuk do lewego; drewniane skrzydło na wizualizacji to drzwi wewnętrzne widziane przez szkło | OKNO do podłogi | `openings-v2.ts:601`/`604` (szkło do podłogi bez łuku → OKNO; szkło + łuk nie trafia w żadną regułę drzwi i spada do OKNA) + `openings-v2.ts:736` (test łuku na ułamku atramentu, nie widzi jasnej linii 176 na tle 236) | **Poprawka 4** — `GLAZED_DOOR` 1,05 × 2,10; szklenie skrzydła nazwane jako niepewne (szkło albo próg). 110/230 przy donicach pozostaje OKNEM (krzewy = plama, nie linia). | `bf80f4556a7c2b74` → `124e5abc5e6959d8` | `marcowki/przed|po/1-przod.png` | rodzina `SOURCE_DERIVED` (symbol), wymiary `SOURCE_EXACT` (callout) |
| Rarytasy | rzut parteru (`asset-rzut-e8520c3ad3`), x 380–520; `debug/rary-entrance-door-symbol.png` | Wejście 105/210 otwierane na zewnątrz | OKNO | j.w. | **Odmowa** — skrzydło na zewnątrz leży na fakturze posadzki i nie przechodzi testu cienkości; zostaje jak w bazie (UNRESOLVED). Kreskowanie nie dało fałszywego łuku. 4 przeszklenia, 230/230 i fantom 471/71 bez zmian. | `3f0f71833f035914` → `3f0f71833f035914` | `rary/przed|po/1-przod.png` | bez zmian |
| A01 | rzut parteru (`asset-rzut-3db285e128`), y 120–260; `debug/a01-rear-wall-band.png` | Ściana tylna y 149–170 px (22 px), okna 120 i 220 | Pas y 149–163,5 = `zone-min_z`; głębokość 8,008 m (wydrukowane 8,30) | `layout.ts:476` okno grubości pasm `≤ round(1,9 × wallPx)` = 21 px przy wallPx 11 → ściana 22 px nie jest pasmem; `layout.ts:2250` (`wallStripsOf`) nie ma pasma do uznania | **Odmowa po dwóch próbach** (szczegóły w §6): pełne poszerzenie okna naprawia A01 (8,30, strefa znika), ale psuje Goździkowce (brama 325/225 traci rodzinę, inne odczyty przegród, +1 komin) — reguła regresji; dokładanie tylko grubych pasm rozbija dekompozycję A01 (`PLAN_RESOLUTION_INCONCLUSIVE`). Głębokość zostaje 8,008 m, nie dociągam do 8,30. | `be796f9fc24a411f` → `2ebcf05b9bdb3120` | `a01/przed|po/2-tyl.png` | `SOURCE_DERIVED`, znana rozbieżność |
| A01 | okna dachowe | 7 w źródle | 6 | brak 7. pierścienia w odczycie | bez zmian (drugorzędne) — nie wstawiam współrzędnej z fikstury | j.w. | `a01/po/7-gora-dach.png` | patrz §3 |

## 3. Okna dachowe — bezpośrednie czy wsparte rodzeństwem

Rodzeństwo = inny pierścień tego samego arkusza (ten sam atrament wydawcy), więc nie jest niezależnym świadkiem.
Model mówi to teraz w interpretacji każdego okna.

| Dom | Okien | Bezpośrednie | Wsparte rodzeństwem | Z szablonu | Uwagi |
|---|---|---|---|---|---|
| A01 | 6 | 5 | 0 | 1 | 6 z 7 źródłowych; 7. nieodczytany (UNRESOLVED) |
| Goździkowce | 7 | 3 | 4 | 0 | 7/7; 4 wsparte rodzeństwem — nie są niezależnymi świadkami |
| Marcówki | 3 | 0 | 0 | 3 | odczyt szablonowy, bez zmian |
| Cieszynianki | 0 | 0 | 0 | 0 | brak okien dachowych w modelu |
| Rarytasy | 0 | 0 | 0 | 0 | brak okien dachowych w modelu |

Każde przyjęte okno leży w połaci (wycięcie `NORMAL_TO_ROOF`/`VERTICAL` w płaszczyźnie dachu; scena bez diagnostyk).

## 4. Wymiary drukowane a odczytane

| Dom | Wielkość | Wydrukowane | Model przed | Model po | Uwagi |
|---|---|---|---|---|---|
| Cieszynianki | głębokość bryły | 1660 (470+1110+80) | 15,80 | **16,60** | lico ścian z koperty rzutu; prawa elewacja potwierdza 16,60 |
| Cieszynianki | szerokość bryły | 1170 | 11,70 | 11,70 | bez zmian |
| Cieszynianki | brama garażowa | 275/225 | 3,69 (okno) | 2,75 (szczelina; rodzina założona) | pierścień czytany „75/25” — odrzucony |
| Cieszynianki | drzwi wejściowe | 105/210 | 1,06 (na złym licu) | 0,88 × 2,10 (ściana tylna wnęki) | szerokość z rzutu, callout 105 nieprzyjęty (wysokość „910” niestabilna) |
| Cieszynianki | okno kuchni | 200/150 | 3,75 | 1,81 | callout poza zasięgiem; UNRESOLVED |
| Goździkowce | drzwi wejściowe | 105/210 | — (zamurowane „oknem” 3,14) | 1,05 × 2,10 | callout |
| Goździkowce | brama | 325/225 | 3,25 | 3,25 | szczelina ≈3,22 — oba świadectwa osobno |
| Marcówki | wejście | 105/210 | 1,05 × 2,10 OKNO | 1,05 × 2,10 GLAZED_DOOR | |
| A01 | głębokość | 830 | 8,008 | 8,008 | znana rozbieżność (§6) |
| Rarytasy | 230/230, 471/71 | — | bez zmian | bez zmian | UNRESOLVED |

## 5. Geometria

`research/analyzer-005y-n2-archon-topology/scene-diagnostics.ts` (walidacja + kompilator produkcyjny + audyt zamknięcia):

| Dom | przed (BASE) | po (HEAD) |
|---|---|---|
| A01 | meshes 157; diagnostics 0; nonManifold 0; closure {"ERROR:INTERSECTION":2,"ERROR:GAP":50,"WARNING:COPLANAR_DUPLICATE":4} | meshes 157; diagnostics 0; nonManifold 0; closure {"ERROR:INTERSECTION":2,"ERROR:GAP":50,"WARNING:COPLANAR_DUPLICATE":4} |
| Goździkowce | meshes 184; diagnostics 0; nonManifold 0; closure {"ERROR:GAP":64} | meshes 189; diagnostics 0; nonManifold 0; closure {"ERROR:GAP":66} |
| Marcówki | meshes 161; diagnostics 0; nonManifold 0; closure {"ERROR:INTERSECTION":7,"ERROR:GAP":35} | meshes 163; diagnostics 0; nonManifold 0; closure {"ERROR:INTERSECTION":7,"ERROR:GAP":35} |
| Cieszynianki | meshes 107; diagnostics 0; nonManifold 0; closure {"ERROR:INTERSECTION":2,"ERROR:GAP":23,"WARNING:COPLANAR_DUPLICATE":2} | meshes 107; diagnostics 0; nonManifold 0; closure {"ERROR:INTERSECTION":2,"ERROR:GAP":24,"WARNING:COPLANAR_DUPLICATE":2} |
| Rarytasy | meshes 113; diagnostics 0; nonManifold 0; closure {"ERROR:GAP":19} | meshes 113; diagnostics 0; nonManifold 0; closure {"ERROR:GAP":19} |

Walidacja modelu: 0 błędów we wszystkich pięciu; NON_MANIFOLD: 0. Uwaga: „przed” liczone już nowym kompilatorem — na starym
kompilatorze Cieszynianki miały 1 ostrzeżenie `WALL_NOT_UNDER_ROOF` (szpilka), widoczne na zrzutach „przed”.

Błędy `GAP`/`INTERSECTION` audytu zamknięcia istniały w bazie (odstęp 0,015 m planera ścianek); nowe klasy nie
powstały (pierwsza wersja wnęki Goździkowców miała 3× `COPLANAR_DUPLICATE` ze stropem — poprawione wysokością ścian
wnęki pod płytą).

## 6. Próby odrzucone i odwrócone

1. `N2_FORCE_BAYS` (wykusze Cieszynianek jako osobne bryły 0,8 m): `MODEL_EMISSION_FAILED` (`WALL_CONSUMED`,
   `WALLS_OVERLAP`) — bryła cieńsza niż dwie ściany. Hack usunięty.
2. A01, pełne okno pasm `max(1,9w, 2w+1)`: A01 8,30 m / strefa znika, ale Goździkowce: brama 325/225 → okno, zmiany
   przegród, kominy 1→2. **Odrzucone** (regresja na drugim domu).
3. A01, dokładanie tylko grubych, długich pasm (≥ 6w, rozłącznych): A01 `PLAN_RESOLUTION_INCONCLUSIVE` (35 m² wobec
   87,5). **Odrzucone**.
4. Reguła drzwi bez cienkości: Marcówki 110/230 przy donicach → fałszywe drzwi (krzewy dają „skrzydło” i „łuk”);
   Rarytasy: krawędź szafki jako skrzydło. **Poprawione** (cienkość, koniec skrzydła).
5. Reguła drzwi na wszystkich kondygnacjach: Goździkowce poddasze — 1 z 3 identycznych 110/220 drzwiami (niespójne).
   **Ograniczone** do parteru.
6. Ściany wnęki na krawędziach regionu: w fikstuze 005N przesunięte o pół ściany (region na osiach). **Poprawione**
   (`inkFace`).
7. Ściany wnęki jako host usuwający całe przegrody: znikały ścianki za wnęką. **Poprawione** (`keepBeyond`).

## 7. Testy, czasy, żywotność

- `tsc -p tsconfig.json`: czysto.
- `vitest run packages/reconstruction packages/geometry packages/model packages/source-metrics`: Test Files 97 passed (97), Tests 1329 passed (1329) — `vitest run packages/reconstruction packages/geometry packages/model packages/source-metrics` na HEAD kodu 936e9e4
- Nowe testy: `bay-strips-005y-n2.test.ts` (6), `door-leaf-005y-n2.test.ts` (6), `plane-hole-wall-005y-n2.test.ts`
  (1, odtwarza „szpilkę”: bez poprawki 6 m i ostrzeżenie, z poprawką 2,3 m), `wall-strip.test.ts` — fikstura wnęki
  005N zaktualizowana świadomie z wersjonowaną deltą `N2_POCKET_WALLS_EXPECTED`.
- Przebiegi produkcyjne (`second-house.ts --package --cache --recogniser`, OFFLINE, telemetria postępu):

| Dom | przed [s] | po [s] | wynik | zdarzeń postępu (po) | najdłuższa przerwa między zdarzeniami (po) |
|---|---|---|---|---|---|
| A01 | 385 | 383 | exit 0 | 354 | 2.0 s (EXTRACTING_OBSERVATIONS/METRIC_FRAMES -> EXTRACTING_OBSERVATIONS/METRIC_FRAMES (HEARTBEAT)) |
| Goździkowce | 355 | 338 | exit 0 | 309 | 1.9 s (EXTRACTING_OBSERVATIONS/METRIC_FRAMES -> EXTRACTING_OBSERVATIONS/METRIC_FRAMES (HEARTBEAT)) |
| Marcówki | 352 | 324 | exit 0 | 300 | 2.6 s (SOLVING_METRICS/SOLVE_METRICS -> BUILDING_MODEL/BUILD_MODEL (PHASE_START)) |
| Cieszynianki | 224 | 210 | exit 0 | 190 | 3.1 s (EXTRACTING_OBSERVATIONS/METRIC_FRAMES -> EXTRACTING_OBSERVATIONS/METRIC_FRAMES (HEARTBEAT)) |
| Rarytasy | 304 | 301 | exit 0 | 271 | 1.9 s (EXTRACTING_OBSERVATIONS/OBSERVE_ASSETS -> EXTRACTING_OBSERVATIONS/OBSERVE_ASSETS (HEARTBEAT)) |

Hashe produkcyjne „po” są identyczne z replayami `FEATURE_DEBUG` na tym samym kodzie; „przed” odtworzone bajt w bajt.

Etapy raportują postęp (`EXTRACTING_OBSERVATIONS — frame k of n` itd.), bieg jest anulowalny; żaden etap nie stał.

## 8. Nierozstrzygnięte (UNRESOLVED)

- A01: ściana tylna poza pasmami (okno grubości), głębokość 8,008 vs 8,30; 7. okno dachowe.
- Cieszynianki: rodzina bramy garażowej (275/225 nieodczytane); wysokość przejścia wiatrołapu (założona); rejestracja
  pionowa prawej elewacji (odrzucona); podcienie — brak źródłowego czytnika.
- Goździkowce: 70/210 w zwrocie wnęki (zwroty nie mają otworów); wysokość przejścia wnęki (założona); 7 objaśnień parteru jak w bazie.
- Rarytasy: drzwi wejściowe otwierane na zewnątrz (symbol na posadzce), 230/230 i fantom 471/71.
- Marcówki: szklenie skrzydła wejścia (szkło albo próg — nazwane w modelu).

## 9. Artefakty

- `renders-005y-n2.zip` — rendery BuildWorld (Three.js, przeglądarka aplikacji) dla pięciu domów, przed/po, 8 widoków.
- `models-005y-n2.zip` — `model.json` po (i przed) dla pięciu domów.
- `debug-005y-n2-private.zip` — prywatne wycinki/nakładki rzutów ARCHON (nie do repozytorium).
- `research/analyzer-005y-n2-archon-topology/ledger.json` — decyzje, polecenia, czasy, próby odrzucone.

**STOP. OWNER_VISUAL_PENDING.**
