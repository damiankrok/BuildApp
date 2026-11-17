# SOURCE → MODEL v3.54.5 — kompletne elewacje, dokładne otwory, źródłowy wybór modelu

Kampania v3.54.5, 2026-11-17. Gałąź `claude/new-session-3kzcgh`. Master Plan v3.54.5: `docs/MASTER_PLAN.md`
(sha256 `bc1c6599b7c41182…`, plik zastąpiony w całości). Raport jest jednym dokumentem końcowym; checkpointy i rewizje
nazwane są jawnie w rozdz. 2.

## 1. Werdykt

**Kod v3.54.5 robi to, co miał robić w każdym z trzech miejsc, które wskazała ocena v3.54.4 — ale zamrożona próba na
8 nowych rodzinach nie spełniła progu kampanii.** Pierwszy wynik zostaje bez zmian:

- **dom oddany przez nową ścieżkę poprawiony względem bazowej ścieżki H na 2 z 8 domów** (Anodach — ARCHON; Alaska —
  Lipińscy, spoza ARCHON), **1 regresja krytyczna** (Pliszka — dach), 1 dom bez zmiany na lepsze mimo nowego modelu
  (550029LAN), 2 domy bez modelu w obu ścieżkach, 2 bez zmian. Próg: ≥3/8 u ≥2 wydawców bez nowej regresji krytycznej —
  **NIE SPEŁNIONY** (`TRANSFER_EVIDENCE: NIE`);
- **wszystkie kryteria szczegółowe** spełniają 2 z 8 domów oddanych przez nową ścieżkę (Anodach, Tracja 2) wobec 1 z 8
  w bazie (Tracja 2); historyczny miernik sześciu grup: wierne zewnętrze 3/8 (baza 2/8);
- **kompletność elewacji**: nowa ścieżka opisała 28 z 32 opublikowanych stron i zarejestrowała 21 (baza: 22 i 10);
  4 strony nieopisane to Mirabelka 4, której elewacji czytnik **nie wysłał** (rozdz. 3 — błąd rejestru, nie źródła);
- **otwory po kompilacji** (wszystkie 8 domów, opis H, ten sam miernik): poprawnych 28 wobec 13, dopasowanych 52 wobec
  29 ze 136, fałszywych 15 wobec 1 — więcej zbudowanych i trafionych, ale też więcej fałszywych.

Na DEV (9 znanych domów, w tym dawne potwierdzenie v3.54.4):
- **Oslo naprawione**: LOCAL z kalenicą +16,79 m (znacznik +6,79 odczytany z kreską jako „1") nie przechodzi już wyboru;
  ta sama reguła zadziałała na nowym domu (Alaska: LOCAL +15,98 wobec przekroju +5,98 → opis);
- **Dublin**: tylne przeszklenie narożne 4,99 m — baza 2,16 m (−2,83 m), teraz 4,52 m (−0,47 m, w tolerancji);
- **Lubczyk, Pallas, Wena**: wszystkie cztery elewacje opisane i zarejestrowane (było 1 z 4); poprawnych otworów
  1→4, 1→3, 2→8;
- **Gracja**: kalenica garażu +6,49 (PRINTED, potwierdzona elewacjami +6,29) zamiast +6,17;
- **ciche zwężanie usunięte**: w v3.54.4 builder zwęził 7 ze 140 uzgodnionych otworów (do połowy szerokości) jako
  `ACCEPTED`; teraz każde dopasowanie ma klasę `EXACT / ADJUSTED / APPROXIMATED / NOT_BUILT` i deltę.

**Host z finalnej rewizji przeszedł pełną drogę URL → … → zapis/odczyt** (wszystkie kontrole, 3 przypadki z pilotem
i 1 bez tokena). Android nie był zmieniany i nie był uruchamiany.

| status | wynik |
|---|---|
| IMPLEMENTATION_COMPLETE | **tak** — rejestr widoków, celowane dopytania, otwory bez cichego zwężania, transakcje korekt, wybór na faktach z przekroju, oceniacz szczegółowy, host |
| FACADE_COVERAGE_VERIFIED | **częściowo** — DEV: 36/36 stron rozliczonych; potwierdzenie: 28/32 opisanych, ale Mirabelka 4 zaraportowana jako `NO_SOURCE` zamiast `NOT_SENT` (błąd rejestru, rozdz. 3) |
| OPENING_GEOMETRY_VERIFIED | **tak w zakresie DEV, częściowo na nowych domach** — wycięcia zgodne z programem (kontrola `openings-cut`), błędy otworów w rozkładach (rozdz. 8); na nowych domach 15 fałszywych otworów |
| SELECTION_VERIFIED | **tak dla wysokości (Oslo, Alaska, kontrole), NIE w całości** — Pliszka pokazuje lukę: LOCAL nie jest sprawdzany z elewacjami (forma dachu, otwory) |
| HOST_INTEGRATION_VERIFIED | **tak** — build z `627e4f1`, wszystkie kontrole E2E |
| TRANSFER_EVIDENCE | **NIE** — 2/8 poprawionych, 1 regresja krytyczna |
| ANDROID_VERIFIED | **nie** — aplikacja bez zmian, bez APK |

## 2. Baza, rewizje i co jest czym

| co | rewizja | rola w tej kampanii |
|---|---|---|
| zamrożony kandydat v3.54.4 | `3c531aee…` | **bazowa ścieżka H** potwierdzenia (osobny worktree, jego własny skrypt) |
| dostawa v3.54.4 z późniejszym zbiorczym dopytaniem | `9c65b81` | punkt startu; dopytanie zbiorcze sprawdzone na 3 domach, niepotwierdzone |
| build hosta v3.54.4 | sprzed dwóch ostatnich zmian przeglądu | **nie jest dowodem dla tej dostawy** |
| v3.54.5 checkpoint | `a211929` | rejestr, dopasowanie otworów, wybór, transakcje (praca w toku) |
| **zamrożony kandydat v3.54.5** | `627e4f1` | kod, prompt, schemat, limity; próba potwierdzająca i build hosta |
| pieczęć protokołu | `ce16267` | `stage-reports/artifacts/v3545/PROTOCOL.seal` |

Po `627e4f1` nie zmieniono kodu produkcyjnego (`git diff 627e4f1 HEAD -- packages apps` jest pusty); doszły tylko
skrypty badawcze (plansze, tabele, E2E, księgowanie) i dokumenty.

## 3. Łańcuchy przyczyn (DEV, offline na zapisanych odpowiedziach)

Każdy łańcuch: źródło → wysłany obraz → surowa odpowiedź → interpretacja → przypisanie → konsument → parametr → scena → ocena;
**pogrubione** pierwsze miejsce utraty.

1. **Oslo, wysokość.** Przekrój drukuje kalenicę +6,79 (dwa przekroje). LOCAL: **odczyt numeryczny znacznika jako +16,79
   (kreska symbolu poziomu wzięta za cyfrę 1) — WRONG_READ** → datum kalenicy 16,79 → dach LOCAL do +16,79. Opis API: +6,79
   poprawnie, model 7,09 m nad terenem. Wybór v3.54.4: strona nie publikuje wysokości budynku, więc nie było faktu, wobec
   którego sprawdzić LOCAL → **decyzja nie konsumowała znacznika przekroju (NOT_CONSUMED)** → LOCAL „spełnia wszystkie
   fakty" i zostaje. Naprawa (`describe.ts: supportedRidge`, `arbitrate`): znacznik kalenicy jest faktem, gdy coś poza nim
   go wspiera (drugi przekrój, zarejestrowana elewacja, wydrukowana wysokość całkowita, dach z wydrukowanego spadku nad
   rzutem); rzędna względem ±0,00 jest porównywana osobno od wysokości nad terenem.
2. **Dublin, tylne przeszklenie.** Elewacja: jedno przeszklenie narożne 4,99 m w dwóch skrzydłach. **Odczyt API: dwa
   prostokąty z przerwą 3 px (0,07 m) — WRONG_BINDING (skrzydła jako dwa otwory)**. Builder v3.54.4: drugi „otwór"
   zahaczał o strefę narożnika → przesunięty w całości o 0,52 m → nałożył się na pierwszy → kernel `OPENINGS_OVERLAP` →
   wycięty 2,16 m. Przegląd: para „zwęź istniejący + dodaj sąsiedni" oceniana krok po kroku — pierwszy krok sam koliduje
   → odrzucony (**COMPILE_CONFLICT z powodu kolejności walidacji**). Naprawa: skrzydła tego samego rodzaju na tej samej
   wysokości z przerwą < 0,125 m to jeden otwór (`panes`); krawędź niekonfliktowa nigdy się nie przesuwa; dopasowanie do
   faktycznego rdzenia ściany z kernela; korekty jako transakcje (grupa, baseRevision, walidacja po całości, rollback).
3. **Lubczyk / Pallas / Wena, strony.** 4 elewacje wysłane. **Odpowiedź API: jeden wpis w `elevations` —
   SENT_NOT_ANSWERED dla trzech**. v3.54.4 nazwał wynik zakończonym. Dopytanie zbiorcze v3.54.4 (jedno zapytanie o trzy
   obrazy) dało opis 1–3 z 3. v3.54.5: program porównuje wysłane z opisanymi i pyta o każdy brakujący obraz osobno
   (narzędzie jednej elewacji). **Pierwsza próba na żywo: dostawca odrzucił gramatykę narzędzia („The compiled grammar is
   too large", bez opłaty)** → narzędzie odchudzone, mniejsze narzędzie jako zapas. Lubczyk: po dopytaniu strony prawa
   i lewa przypisane odwrotnie (**WRONG_BINDING — obie elewacje szczytowe pasują do prostokątnego rzutu**) → czytnik
   dostaje z rzutu, które bryły stoją z przodu na każdej stronie, a resolver odrzuca stronę, której przednia bryła nie
   jest na obrazie. Frizea: pierwsza odpowiedź opisała 4 elewacje **bez żadnego otworu i bez stwierdzenia „ślepa ściana"**
   → taki wpis jest częściowy i jest dopytywany.
4. **Gracja, kalenica garażu.** Przekrój drukuje +6,49; **API nadało mu znaczenie OTHER (nie RIDGE)** → resolver wziął
   pomiar z elewacji +6,17 (DERIVED). Naprawa: znacznik przekroju bez znaczenia, stojący tam, gdzie zarejestrowane elewacje
   mierzą wierzch dachu tej bryły (±0,45 m), jest jej kalenicą (PRINTED, z odnośnikami do elewacji).
5. **Ciche zwężanie.** v3.54.4 `houseProgram`: otwór szerszy niż czysta długość ściany cięty „tak szeroko, jak pozwala
   ściana", do 50 % szerokości, stan `ACCEPTED` (7 ze 140 otworów; Lubczyk 1,11 → 0,56 m). Naprawa (`fitOpening`): w
   granicy niepewności odczytu — ADJUSTED z deltą; do 25 % i 0,6 m — APPROXIMATED, nazwane jako wada; więcej — nie cięty,
   z powodem. Wydrukowana szerokość nigdy nie jest przycinana. Ściany wykusza rysowane cieńsze (0,25 m — konwencja, jawna),
   bo przy 0,4 m w boku wykusza 1,3 m nie mieści się okno 0,8 m.
6. **Dolna rzędna otworów.** Wiersz „linii terenu" bywa linią podłogi; v3.54.4 brał go za teren → okna 0,3 m za nisko,
   drzwi o tyle za krótkie (Torenie: 0 poprawnych). Teraz ±0,00 to mediana kotwic obrazu (linia terenu z rzędną terenu,
   wydrukowana kalenica, wiersz podłogi podany przez czytnik, progi drzwi parteru), każda w granicy 0,6 m (Torenie 0→4).
7. **Pliszka (potwierdzenie, rozpoznane po wyniku).** Opis: ridge − teren 6,25 m wobec 6,71 m podanych na stronie (próg
   0,35 m) → **opis odrzuca sam siebie** → LOCAL zostaje (`DESCRIBED_REJECTED_LOCAL_KEPT`), bo wysokość LOCAL zgadza się ze
   stroną. LOCAL ma jednak złą formę dachu i 17 fałszywych otworów, a **wybór nie sprawdza LOCAL z zarejestrowanymi
   elewacjami** (forma dachu, otwory) — tylko z wymiarami, wysokością i obrysem. Baza przyjęła opis, bo jej odczyt nie
   zawierał wysokości całkowitej. To luka reguły wyboru, nie przypadek domu.
8. **Mirabelka 4 (potwierdzenie).** Wydawca nie oznacza elewacji (rola UNKNOWN); pakiet ma 102 obrazy. **Limit 24 obrazów
   na inwentarz odciął elewacje przed wysłaniem (NOT_SENT)**, a rejestr nazwał strony `NO_SOURCE` („strona nie publikuje
   elewacji") — bo liczy tylko obrazy, które wydawca oznaczył. Model oddany to poprawny LOCAL, więc ocena domu się nie
   zmieniła, ale rejestr powiedział nieprawdę o źródle.

## 4. Kompletność elewacji — rejestr widoków

Każda strona domu ma w `house.json` (0.2.0, `verification.views`) stan: `NO_SOURCE / NOT_SENT / SENT_NOT_ANSWERED /
PARTIAL / READ_COMPLETE / UNREADABLE / ASSIGNMENT_UNRESOLVED`, obraz, transformację (m/px, przesunięcie, wiersz ±0,00
i z czego go wzięto, residuum, kotwica kontrolna), ściany i bryły, liczby odczytane / uzgodnione / zbudowane i stan budowy
(`BUILT_COMPLETE / BUILT_PARTIAL / NOT_BUILT / NOTHING_TO_BUILD`). Pusta lista otworów bez `blind: true` jest `PARTIAL`.
Dwa obrazy jednej strony nie są dwiema stronami (`SIDE_CLAIMED_TWICE`). Pięć statusów osobno (`verification.status`):
obliczenia, źródła (`READ_COMPLETE` ≠ `BUILT_COMPLETE`), geometria, zewnętrze, braki.

### Potwierdzenie — nowa ścieżka H

| dom | elewacje w źródle | wysłane do pomiaru | odczytane (opis) | zarejestrowane | zbudowane (otwory+cechy / odczytane) | ocenione stron | powód braku |
|---|---|---|---|---|---|---|---|
| c5-archon-malaxisach-2-e | 4 | 4 | 4 (4 opisów; dopytań 0) | 2 | front 8/8 prawa 0/4 tył 5/9 lewa 0/7 | 2/4 zbud. | prawa: PARTIAL (described, and not placed on the plan: the ridge row gives +4.85 m at the along scale; the); lewa: PARTIAL (described, and not placed on the plan: the ridge row gives +4.87 m at the along scale; the) |
| c5-archon-anodach-3-g2e | 4 | 4 | 4 (4 opisów; dopytań 0) | 4 | front 2/5 prawa 4/6 tył 2/5 lewa 4/6 | 4/4 zbud. | — |
| c5-dobredomy-kardamon | 4 | 4 | 4 (4 opisów; dopytań 0) | 2 | front 5/11 prawa 0/2 tył 0/12 lewa 0/8 | 0/4 zbud. | prawa: PARTIAL (described, and not placed on the plan: its wall ends land 6.93 m off the bodies' ends at o); tył: READ_COMPLETE (described, and not placed on the plan: its wall ends land 3.03 m off the bodies' ends at o) |
| c5-lipinscy-alaska | 4 | 4 | 4 (4 opisów; dopytań 0) | 4 | front 6/8 prawa 0/0 tył 4/4 lewa 1/3 | 4/4 zbud. | lewa: PARTIAL (the reader stated a part of this side is hidden on the picture) |
| c5-studioatrium-pliszka-v-plus | 4 | 4 | 4 (4 opisów; dopytań 0) | 1 | front 0/6 prawa 0/6 tył 1/5 lewa 0/4 | 1/4 zbud. | front: PARTIAL (described, and not placed on the plan: its wall ends land 5.61 m off the bodies' ends at o); prawa: PARTIAL (described, and not placed on the plan: its wall ends land 1.05 m off the bodies' ends at o); tył: PARTIAL (the reader stated a part of this side is hidden on the picture); lewa: PARTIAL (described, and not placed on the plan: its wall ends land 1.05 m off the bodies' ends at o) |
| c5-extradom-tracja-2 | 4 | 4 | 4 (4 opisów; dopytań 0) | 4 | front 9/9 prawa 0/2 tył 4/6 lewa 1/3 | 4/4 zbud. | — |
| c5-extradom-mirabelka-4 | 0 | 0 | 0 (0 opisów; dopytań 0) | 0 | — | 0/4 zbud. | front: NO_SOURCE (the page publishes no elevation); prawa: NO_SOURCE (the page publishes no elevation); tył: NO_SOURCE (the page publishes no elevation); lewa: NO_SOURCE (the page publishes no elevation) |
| c5-architecturaldesigns-550029lan | 8 | 4 | 4 (4 opisów; dopytań 0) | 4 | front 11/18 prawa 3/15 tył 7/15 lewa 5/12 | 0/4 zbud. | prawa: PARTIAL (the reader stated a part of this side is hidden on the picture); tył: PARTIAL (the reader stated a part of this side is hidden on the picture); lewa: PARTIAL (the reader stated a part of this side is hidden on the picture) |

Baza (v3.54.4) na tych samych domach: opisała 22 elewacje, zarejestrowała 10 (Alaska i 550029LAN: 1 z 4 opisów).

### DEV — nowy odczyt na żywo (6 domów)

| dom | elewacje w źródle | wysłane do pomiaru | odczytane (opis) | zarejestrowane | zbudowane (otwory+cechy / odczytane) | ocenione stron | powód braku |
|---|---|---|---|---|---|---|---|
| c4-archon-lubczyku-2 | 4 | 4 | 4 (4 opisów; dopytań 0) | 4 | front 9/12 prawa 4/6 tył 7/10 lewa 5/10 | 4/4 zbud. | prawa: PARTIAL (the reader stated a part of this side is hidden on the picture) |
| c4-archon-frizeach-g2e | 4 | 4 | 4 (4 opisów; dopytań 4) | 3 | front 0/7 prawa 1/4 tył 6/7 lewa 5/8 | 3/4 zbud. | front: READ_COMPLETE (described, and not placed on the plan: its wall ends land 1.45 m off the bodies' ends at o) |
| c4-dobredomy-pallas | 4 | 4 | 4 (4 opisów; dopytań 3) | 4 | front 8/13 prawa 0/3 tył 11/13 lewa 3/3 | 4/4 zbud. | — |
| c4-lipinscy-oslo | 4 | 4 | 4 (4 opisów; dopytań 0) | 4 | front 5/5 prawa 2/4 tył 2/4 lewa 1/2 | 4/4 zbud. | — |
| c4-lipinscy-dublin | 4 | 4 | 4 (4 opisów; dopytań 0) | 4 | front 6/8 prawa 0/1 tył 7/8 lewa 4/4 | 4/4 zbud. | — |
| c4-studioatrium-wena | 4 | 4 | 4 (4 opisów; dopytań 3) | 4 | front 4/4 prawa 5/8 tył 6/8 lewa 3/8 | 4/4 zbud. | prawa: PARTIAL (the reader stated a part of this side is hidden on the picture) |
| confirm-dobredomy-gracja-i-mala-ii | — | — | — | — | — | — | None:  |
| projekt-dom-w-toreniach-3-e-me822857280738 | — | — | — | — | — | — | None:  |
| final-archon-dom-w-kuklikach | — | — | — | — | — | — | None:  |

## 5. Otwory: od odczytu do wycięcia

Każdy uzgodniony otwór ma w `verification.openings`: odnośnik do obserwacji, stronę, ścianę, poziom, typ, wartości
uzgodnione, wartości programu i **wymiar dziury zmierzony w skompilowanej scenie**; kontrola `openings-cut` porównuje
program ze sceną (2 cm). Dopasowania na wszystkich uzgodnionych otworach:

| przebieg | EXACT | ADJUSTED | APPROXIMATED | NOT_BUILT |
|---|---|---|---|---|
| DEV, odtworzenie na nowym konsumencie (9 domów) | 59 | 4 | 7 | 12 |
| DEV, nowy odczyt na żywo (6 domów) | 63 | 2 | 5 | 14 |
| potwierdzenie, nowy H (8 domów) | 60 | 1 | 6 | 20 |

### Tabela otworów — potwierdzenie, nowy H (pełna; DEV w ZIP-ie)

`błąd wobec referencji`: wynik oceniacza szczegółowego dla tej dziury (OK/OFF/PRESENT/brak) i błędy [m]: środka wzdłuż
boku, szerokości, wysokości, dolnej krawędzi. Otwór uzgodniony, który nie odpowiada żadnemu otworowi referencji, ma „—".

| dom | otwór | źródło / region [px] | ściana, poziom | odczyt (typ) | uzgodnione: od / szer. / wys. / parapet [m] | po kompilacji: szer. × wys., dół [m] | dopasowanie | błąd wobec referencji [m] | pochodzenie |
|---|---|---|---|---|---|---|---|---|---|
| c5-archon-malaxisach-2-e | opening-front-1 | p7 [275,345–330,490] | wall-0-6, 0 | WINDOW | 2.87 / 0.84 / 2.21 / 0.00 | 0.84 × 2.21, 0.00 | EXACT | OFF along +0.48, width -0.05, height -0.09, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p7, at the plan's sc |
| c5-archon-malaxisach-2-e | opening-front-2 | p7 [420,345–473,490] | wall-0-6, 0 | WINDOW | 5.08 / 0.81 / 2.21 / 0.00 | 0.81 × 2.21, 0.00 | EXACT | OFF along +0.46, width -0.08, height -0.09, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p7, at the plan's sc |
| c5-archon-malaxisach-2-e | opening-front-3 | p7 [577,345–625,490] | wall-0-6, 0 | WINDOW | 7.48 / 0.73 / 2.21 / 0.00 | 0.73 × 2.21, 0.00 | EXACT | OFF along +0.49, width -0.02, height -0.09, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p7, at the plan's sc |
| c5-archon-malaxisach-2-e | opening-front-4 | p7 [727,345–815,490] | wall-0-6, 0 | DOOR | 9.77 / 1.34 / 2.21 / 0.00 | 1.34 × 2.21, 0.00 | EXACT | OFF along +0.41, width -0.07, height -0.09, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p7, at the plan's sc |
| c5-archon-malaxisach-2-e | opening-front-5 | p7 [925,345–1112,490] | wall-0-8, 0 | GLAZED_DOOR | 0.63 / 2.86 / 2.21 / 0.00 | 2.62 × 2.21, 0.00 | APPROXIMATED: 2.86 m wide as read; trimmed by 0.23 m at the corner of its wall: more than the reading's ±0.10 m — an approxi | OK along +0.27, width -0.38, height -0.06, bottom -0.03 | DERIVED, ±0.05 m; its two sides on elevation el-p7, at the plan's sc |
| c5-archon-malaxisach-2-e | opening-rear-1 | p8 [150,345–370,487] | wall-0-2, 0 | GLAZED_DOOR | 0.96 / 3.35 / 2.21 / 0.00 | 3.35 × 2.21, 0.00 | EXACT | OFF along -0.00, width -0.08, height -2.56, bottom -0.03 | DERIVED, ±0.05 m; its two sides on elevation el-p8, at the plan's sc |
| c5-archon-malaxisach-2-e | opening-rear-2 | p8 [480,345–592,490] | wall-0-2, 0 | GLAZED_DOOR | 5.99 / 1.71 / 2.21 / 0.00 | 1.71 × 2.21, 0.00 | EXACT | OK along -0.03, width -0.08, height -0.10, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p8, at the plan's sc |
| c5-archon-malaxisach-2-e | opening-rear-3 | p8 [757,345–870,490] | wall-0-4, 0 | GLAZED_DOOR | 1.46 / 1.72 / 2.21 / 0.00 | 1.72 × 2.21, 0.00 | EXACT | OK along -0.09, width -0.09, height -0.10, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p8, at the plan's sc |
| c5-archon-malaxisach-2-e | opening-rear-4 | p8 [963,345–1017,488] | wall-0-4, 0 | WINDOW | 4.60 / 0.82 / 2.18 / 0.03 | 0.82 × 2.18, 0.03 | EXACT | OK along -0.10, width -0.05, height -0.13, bottom +0.03 | DERIVED, ±0.05 m; its two sides on elevation el-p8, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-left-1 | p5 [165,372–290,490] | wall-0-3, 0 | WINDOW | 1.04 / 2.28 / 2.15 / 0.03 | 2.28 × 2.15, 0.03 | EXACT | OK along +0.04, width -0.10, height -0.12, bottom +0.03 | DERIVED, ±0.05 m; its two sides on elevation el-p5, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-left-2 | p5 [374,374–415,490] | wall-0-3, 0 | WINDOW | 4.84 / 0.75 / 2.11 / 0.03 | nie wycięto | NOT_BUILT: 0.75 m wide at 4.84 m on a wall whose clear stretch is 0.42..5.22 m: it would lose 0.37 m, more than the readi | — | DERIVED, ±0.05 m; its two sides on elevation el-p5, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-left-3 | p5 [630,370–792,490] | wall-0-5, 0 | WINDOW | 3.87 / 2.95 / 2.19 / 0.03 | 2.95 × 2.19, 0.03 | EXACT | OK along -0.02, width -0.06, height -0.10, bottom +0.04 | DERIVED, ±0.05 m; its two sides on elevation el-p5, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-left-4 | p5 [992,372–1035,492] | wall-0-9, 0 | DOOR | 0.90 / 0.78 / 2.17 / 0.00 | 0.78 × 2.17, 0.00 | EXACT | OK along -0.04, width -0.06, height +0.09, bottom -0.02 | DERIVED, ±0.05 m; its two sides on elevation el-p5, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-right-1 | p6 [242,380–290,497] | wall-0-1, 0 | WINDOW | 2.34 / 0.88 / 2.15 / 0.00 | 0.88 × 2.15, 0.00 | EXACT | OK along +0.01, width +0.04, height +0.04, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p6, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-right-2 | p6 [494,380–541,492] | wall-0-1, 0 | WINDOW | 6.98 / 0.87 / 2.06 / 0.00 | 0.87 × 2.06, 0.00 | EXACT | OK along +0.05, width +0.01, height -0.05, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p6, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-right-3 | p6 [673,370–792,442] | wall-0-1, 0 | WINDOW | 10.28 / 2.19 / 1.33 / 0.82 | 2.19 × 1.33, 0.82 | EXACT | OK along +0.07, width -0.02, height -0.08, bottom -0.15 | DERIVED, ±0.05 m; its two sides on elevation el-p6, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-right-4 | p6 [873,370–992,442] | wall-0-1, 0 | WINDOW | 13.96 / 2.19 / 1.33 / 0.82 | 2.19 × 1.33, 0.82 | EXACT | OK along +0.12, width +0.00, height -0.08, bottom -0.15 | DERIVED, ±0.05 m; its two sides on elevation el-p6, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-front-1 | p7 [308,369–432,445] | wall-0-6, 0 | WINDOW | 1.11 / 2.25 / 1.38 / 0.85 | 2.25 × 1.38, 0.85 | EXACT | OK along -0.02, width -0.00, height +0.02, bottom -0.06 | DERIVED, ±0.05 m; its two sides on elevation el-p7, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-front-2 | p7 [575,370–632,492] | wall-0-8, 0 | DOOR | 0.07 / 1.04 / 2.21 / 0.00 | nie wycięto | NOT_BUILT: 1.04 m wide at 0.07 m on a wall whose clear stretch is 0.42..0.79 m: it would lose 0.67 m, more than the readi | — | DERIVED, ±0.05 m; its two sides on elevation el-p7, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-front-3 | p7 [690,372–962,492] | wall-0-0, 0 | GARAGE_DOOR | 0.95 / 4.95 / 2.18 / 0.00 | 4.95 × 2.18, 0.00 | EXACT | OK along -0.02, width -0.03, height -0.06, bottom -0.02 | DERIVED, ±0.05 m; its two sides on elevation el-p7, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-rear-1 | p8 [550,370–600,495] | wall-0-2, 0 | WINDOW | 4.56 / 0.91 / 2.28 / 0.00 | 0.91 × 2.28, 0.00 | EXACT | OK along -0.03, width -0.04, height -0.01, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p8, at the plan's sc |
| c5-archon-anodach-3-g2e | opening-rear-2 | p8 [822,375–1008,490] | wall-0-4, 0 | GLAZED_DOOR | -0.00 / 3.39 / 2.10 / 0.00 | 2.97 × 2.10, 0.00 | APPROXIMATED: 3.39 m wide as read; trimmed by 0.42 m at the corner of its wall: more than the reading's ±0.10 m — an approxi | OK along +0.14, width -0.47, height -0.17, bottom -0.02 | DERIVED, ±0.05 m; its two sides on elevation el-p8, at the plan's sc |
| c5-dobredomy-kardamon | opening-left-1 | p3 [499,388–546,420] | wall-0-19, 0 | WINDOW | 7.39 / 1.08 / 0.74 / 1.78 | nie wycięto | NOT_BUILT | — | DERIVED, ±0.05 m; its two sides on elevation el-p3, at the plan's sc |
| c5-dobredomy-kardamon | opening-left-2 | p3 [598,388–645,420] | wall-0-19, 0 | WINDOW | 9.68 / 1.08 / 0.74 / 1.78 | nie wycięto | NOT_BUILT | — | DERIVED, ±0.05 m; its two sides on elevation el-p3, at the plan's sc |
| c5-dobredomy-kardamon | opening-left-3 | p3 [697,388–744,420] | wall-0-19, 0 | WINDOW | 11.96 / 1.08 / 0.74 / 1.78 | nie wycięto | NOT_BUILT | — | DERIVED, ±0.05 m; its two sides on elevation el-p3, at the plan's sc |
| c5-dobredomy-kardamon | opening-left-4 | p3 [796,388–843,420] | wall-0-19, 0 | WINDOW | 14.24 / 1.08 / 0.74 / 1.78 | nie wycięto | NOT_BUILT | — | DERIVED, ±0.05 m; its two sides on elevation el-p3, at the plan's sc |
| c5-dobredomy-kardamon | opening-front-1 | p5 [208,195–492,355] | wall-1-0, 1 | GLAZED_DOOR | 0.66 / 6.58 / 3.71 / 0.49 | nie wycięto | NOT_BUILT: host wall wall-1-0 is not a built wall | — | DERIVED, ±0.05 m; its two sides on elevation el-p5, at the plan's sc |
| c5-dobredomy-kardamon | opening-front-2 | p5 [243,390–460,503] | wall-0-2, 0 | GARAGE_DOOR | 0.89 / 5.03 / 2.48 / 0.00 | 5.03 × 2.48, 0.00 | EXACT | OK along +0.30, width +0.31, height +0.06, bottom +0.13 | DERIVED, ±0.05 m; its two sides on elevation el-p5, at the plan's sc |
| c5-dobredomy-kardamon | opening-front-3 | p5 [528,390–592,497] | wall-0-4, 0 | DOOR | 0.17 / 1.48 / 2.48 / 0.00 | 1.24 × 2.48, 0.00 | APPROXIMATED: 1.48 m wide as read; trimmed by 0.25 m at the corner of its wall: more than the reading's ±0.10 m — an approxi | OFF along +0.86, width -0.22, height +0.14, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p5, at the plan's sc |
| c5-dobredomy-kardamon | opening-front-4 | p5 [653,390–683,485] | wall-0-4, 0 | WINDOW | 3.07 / 0.69 / 2.20 / 0.28 | 0.59 × 2.20, 0.28 | APPROXIMATED: 0.69 m wide as read; trimmed by 0.10 m at the corner of its wall: more than the reading's ±0.10 m — an approxi | FALSE | DERIVED, ±0.05 m; its two sides on elevation el-p5, at the plan's sc |
| c5-dobredomy-kardamon | opening-front-5 | p5 [733,392–847,493] | wall-0-6, 0 | GLAZED_DOOR | 0.84 / 2.64 / 2.43 / 0.00 | 2.64 × 2.43, 0.00 | EXACT | PRESENT | DERIVED, ±0.05 m; its two sides on elevation el-p5, at the plan's sc |
| c5-dobredomy-kardamon | opening-front-6 | p5 [875,392–990,493] | wall-0-6, 0 | GLAZED_DOOR | 4.13 / 2.66 / 2.43 / 0.00 | 2.41 × 2.43, 0.00 | APPROXIMATED: 2.66 m wide as read; trimmed by 0.26 m at the corner of its wall: more than the reading's ±0.10 m — an approxi | PRESENT | DERIVED, ±0.05 m; its two sides on elevation el-p5, at the plan's sc |
| c5-lipinscy-alaska | opening-rear-1 | p3 [128,258–222,415] | wall-0-2, 0 | WINDOW | 1.53 / 1.23 / 2.04 / 0.00 | 1.23 × 2.04, 0.00 | EXACT | OFF along -0.37, width -0.17, height -0.27, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p3, at the plan's sc |
| c5-lipinscy-alaska | opening-rear-2 | p3 [355,258–450,415] | wall-0-2, 0 | WINDOW | 4.48 / 1.23 / 2.04 / 0.00 | 1.23 × 2.04, 0.00 | EXACT | OFF along -0.69, width -0.17, height -0.27, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p3, at the plan's sc |
| c5-lipinscy-alaska | opening-rear-3 | p3 [583,258–676,415] | wall-0-2, 0 | WINDOW | 7.43 / 1.20 / 2.04 / 0.00 | 1.20 × 2.04, 0.00 | EXACT | FALSE | DERIVED, ±0.05 m; its two sides on elevation el-p3, at the plan's sc |
| c5-lipinscy-alaska | opening-rear-4 | p3 [842,260–1040,413] | wall-0-2, 0 | GLAZED_DOOR | 10.79 / 2.56 / 1.99 / 0.00 | 2.56 × 1.99, 0.00 | EXACT | OFF along -1.47, width -0.26, height -0.32, bottom +0.00 | DERIVED, ±0.05 m; its two sides on elevation el-p3, at the plan's sc |
| c5-lipinscy-alaska | opening-front-1 | p4 [457,258–593,352] | wall-0-0, 0 | WINDOW | 3.01 / 1.73 / 1.20 / 0.79 | 1.73 × 1.20, 0.79 | EXACT | FALSE | DERIVED, ±0.05 m; its two sides on elevation el-p4, at the plan's sc |
| c5-lipinscy-alaska | opening-front-2 | p4 [715,258–808,414] | wall-0-0, 0 | DOOR | 6.30 / 1.19 / 2.00 / 0.00 | 1.19 × 2.00, 0.00 | EXACT | FALSE | DERIVED, ±0.05 m; its two sides on elevation el-p4, at the plan's sc |
| c5-lipinscy-alaska | opening-front-3 | p4 [899,258–938,352] | wall-0-0, 0 | WINDOW | 8.66 / 0.50 / 1.20 / 0.79 | 0.50 × 1.20, 0.79 | EXACT | FALSE | DERIVED, ±0.05 m; its two sides on elevation el-p4, at the plan's sc |
| c5-lipinscy-alaska | opening-front-4 | p4 [1104,258–1142,352] | wall-0-0, 0 | WINDOW | 11.27 / 0.49 / 1.20 / 0.79 | 0.49 × 1.20, 0.79 | EXACT | OFF along +0.62, width -0.07, height -0.10, bottom -0.19 | DERIVED, ±0.05 m; its two sides on elevation el-p4, at the plan's sc |
| c5-lipinscy-alaska | opening-front-5 | p4 [1224,258–1262,352] | wall-0-0, 0 | WINDOW | 12.81 / 0.49 / 1.20 / 0.79 | 0.49 × 1.20, 0.79 | EXACT | OFF along +0.43, width -0.09, height -0.10, bottom -0.19 | DERIVED, ±0.05 m; its two sides on elevation el-p4, at the plan's sc |
| c5-lipinscy-alaska | opening-front-6 | p4 [1345,258–1439,414] | wall-0-0, 0 | GLAZED_DOOR | 14.36 / 1.20 / 2.00 / 0.00 | 1.20 × 2.00, 0.00 | EXACT | OK along +0.22, width -0.16, height -0.28, bottom -0.01 | DERIVED, ±0.05 m; its two sides on elevation el-p4, at the plan's sc |
| c5-lipinscy-alaska | opening-left-1 | p6 [184,260–380,414] | wall-0-3, 0 | GLAZED_DOOR | 2.45 / 2.78 / 2.18 / 0.00 | 2.78 × 2.18, 0.00 | EXACT | PRESENT | DERIVED, ±0.05 m; its two sides on elevation el-p6, at the plan's sc |
| c5-lipinscy-alaska | opening-left-2 | p6 [186,67–376,250] | wall-0-3, 0 | WINDOW | 2.48 / 2.69 / 2.59 / 2.33 | nie wycięto | NOT_BUILT: it stands above the top of its wall: the dormer or gable it belongs to was not read or is not built — OPENING_ | — | DERIVED, ±0.05 m; its two sides on elevation el-p6, at the plan's sc |
| c5-studioatrium-pliszka-v-plus | opening-rear-1 | p7 [424,437–491,512] | wall-0-2, 0 | GLAZED_DOOR | 3.39 / 1.88 / 2.11 / 0.00 | 1.88 × 2.11, 0.00 | EXACT | OK along -0.03, width +0.01, height +0.05, bottom +0.00 | DERIVED, ±0.056 m; its two sides on elevation el-p7, at the plan's sc |
| c5-studioatrium-pliszka-v-plus | opening-rear-2 | p7 [527,330–688,512] | wall-0-4, 0 | GLAZED_DOOR | 0.06 / 4.51 / 5.11 / 0.00 | nie wycięto | NOT_BUILT: it stands above the top of its wall: the dormer or gable it belongs to was not read or is not built — OPENING_ | — | DERIVED, ±0.056 m; its two sides on elevation el-p7, at the plan's sc |
| c5-extradom-tracja-2 | opening-front-1 | p2 [150,240–248,324] | wall-0-0, 0 | WINDOW | 1.31 / 1.67 / 1.43 / 0.82 | 1.67 × 1.43, 0.82 | EXACT | OK along -0.00, width -0.00, height -0.04, bottom +0.03 | DERIVED, ±0.05 m; its two sides on elevation el-p2, at the plan's sc |
| c5-extradom-tracja-2 | opening-front-2 | p2 [319,240–364,322] | wall-0-0, 0 | WINDOW | 4.20 / 0.77 / 1.40 / 0.85 | 0.77 × 1.40, 0.85 | EXACT | OK along -0.01, width -0.02, height -0.07, bottom +0.07 | DERIVED, ±0.05 m; its two sides on elevation el-p2, at the plan's sc |
| c5-extradom-tracja-2 | opening-front-3 | p2 [430,238–494,372] | wall-0-0, 0 | DOOR | 6.09 / 1.09 / 2.29 / 0.00 | 1.09 × 2.29, 0.00 | EXACT | OK along -0.01, width -0.00, height +0.01, bottom +0.02 | DERIVED, ±0.05 m; its two sides on elevation el-p2, at the plan's sc |
| c5-extradom-tracja-2 | opening-front-4 | p2 [560,240–606,322] | wall-0-0, 0 | WINDOW | 8.31 / 0.79 / 1.40 / 0.85 | 0.79 × 1.40, 0.85 | EXACT | OK along -0.00, width +0.02, height -0.07, bottom +0.07 | DERIVED, ±0.05 m; its two sides on elevation el-p2, at the plan's sc |
| c5-extradom-tracja-2 | opening-front-5 | p2 [697,240–795,324] | wall-0-0, 0 | WINDOW | 10.65 / 1.67 / 1.43 / 0.82 | 1.67 × 1.43, 0.82 | EXACT | OK along -0.01, width -0.04, height -0.04, bottom +0.03 | DERIVED, ±0.05 m; its two sides on elevation el-p2, at the plan's sc |
| c5-extradom-tracja-2 | opening-left-1 | p3 [447,238–545,322] | wall-0-3, 0 | WINDOW | 3.83 / 1.67 / 1.43 / 1.01 | 1.67 × 1.43, 1.01 | EXACT | OK along -0.03, width -0.04, height -0.07, bottom +0.28 | DERIVED, ±0.05 m; its two sides on elevation el-p3, at the plan's sc |
| c5-extradom-tracja-2 | opening-rear-1 | p4 [143,240–208,372] | wall-0-2, 0 | DOOR | 1.20 / 1.11 / 2.25 / 0.00 | 1.11 × 2.25, 0.00 | EXACT | OK along +0.02, width +0.01, height -0.03, bottom +0.02 | DERIVED, ±0.05 m; its two sides on elevation el-p4, at the plan's sc |
| c5-extradom-tracja-2 | opening-rear-2 | p4 [267,240–350,322] | wall-0-2, 0 | WINDOW | 3.31 / 1.42 / 1.40 / 0.85 | 1.42 × 1.40, 0.85 | EXACT | OK along +0.01, width +0.01, height -0.08, bottom +0.06 | DERIVED, ±0.05 m; its two sides on elevation el-p4, at the plan's sc |
| c5-extradom-tracja-2 | opening-rear-3 | p4 [440,240–520,322] | wall-0-2, 0 | WINDOW | 6.26 / 1.36 / 1.40 / 0.85 | 1.36 × 1.40, 0.85 | EXACT | OK along -0.02, width -0.01, height -0.08, bottom +0.06 | DERIVED, ±0.05 m; its two sides on elevation el-p4, at the plan's sc |
| c5-extradom-tracja-2 | opening-rear-4 | p4 [640,240–793,365] | wall-0-2, 0 | GLAZED_DOOR | 9.68 / 2.61 / 2.25 / 0.00 | 2.61 × 2.25, 0.00 | EXACT | OK along -0.01, width -0.06, height -0.03, bottom +0.02 | DERIVED, ±0.05 m; its two sides on elevation el-p4, at the plan's sc |
| c5-architecturaldesigns-550029lan | opening-front-1 | p9 [305,595–430,712] | wall-0-0, 0 | GARAGE_DOOR | 0.83 / 3.48 / 2.50 / 0.00 | 3.48 × 2.50, 0.00 | EXACT | OFF along +0.67, width +0.90, height +0.07, bottom +0.45 | DERIVED, ±0.056 m; its two sides on elevation el-p9, at the plan's sc |
| c5-architecturaldesigns-550029lan | opening-front-2 | p9 [310,428–377,492] | wall-1-0, 1 | WINDOW | 0.97 / 1.86 / 1.78 / 2.56 | 1.86 × 1.78, 5.37 | EXACT | PRESENT | DERIVED, ±0.056 m; its two sides on elevation el-p9, at the plan's sc |
| c5-architecturaldesigns-550029lan | opening-front-3 | p9 [442,428–590,500] | wall-1-0, 1 | WINDOW | 4.64 / 4.11 / 2.00 / 2.34 | 4.11 × 2.00, 5.14 | EXACT | OFF along +1.76, width +1.07, height -0.12, bottom +1.28 | DERIVED, ±0.056 m; its two sides on elevation el-p9, at the plan's sc |
| c5-architecturaldesigns-550029lan | opening-front-4 | p9 [458,595–585,712] | wall-0-0, 0 | GARAGE_DOOR | 5.09 / 3.53 / 2.50 / 0.00 | 3.53 × 2.50, 0.00 | EXACT | FALSE | DERIVED, ±0.056 m; its two sides on elevation el-p9, at the plan's sc |
| c5-architecturaldesigns-550029lan | opening-front-5 | p9 [640,577–688,685] | wall-0-2, 0 | DOOR | 0.61 / 1.33 / 3.00 / 0.00 | 1.33 × 3.00, 0.00 | EXACT | PRESENT | DERIVED, ±0.056 m; its two sides on elevation el-p9, at the plan's sc |
| c5-architecturaldesigns-550029lan | opening-front-6 | p9 [640,408–690,528] | wall-1-2, 1 | GLAZED_DOOR | 0.61 / 1.39 / 3.34 / 1.56 | 1.39 × 3.34, 4.37 | EXACT | PRESENT | DERIVED, ±0.056 m; its two sides on elevation el-p9, at the plan's sc |
| c5-architecturaldesigns-550029lan | opening-front-7 | p9 [787,428–935,528] | wall-1-2, 1 | GLAZED_DOOR | 4.70 / 4.11 / 2.78 / 1.56 | 4.11 × 2.78, 4.37 | ADJUSTED: moved 0.00 m along the wall to stand clear of its corner (the reading is good to ±0.10 m) | FALSE | DERIVED, ±0.056 m; its two sides on elevation el-p9, at the plan's sc |
| c5-architecturaldesigns-550029lan | opening-front-8 | p9 [808,577–912,647] | wall-0-2, 0 | WINDOW | 5.28 / 2.89 / 1.95 / 1.06 | 2.89 × 1.95, 1.06 | EXACT | FALSE | DERIVED, ±0.056 m; its two sides on elevation el-p9, at the plan's sc |
| c5-architecturaldesigns-550029lan | opening-left-1 | p10 [345,575–392,657] | wall-0-9, 0 | WINDOW | -0.48 / 1.38 / 2.41 / 1.32 | nie wycięto | NOT_BUILT: 1.38 m wide at -0.48 m on a wall whose clear stretch is 0.42..17.50 m: it would lose 0.90 m, more than the rea | — | DERIVED, ±0.059 m; its two sides on elevation el-p10, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-left-2 | p10 [385,405–492,498] | wall-1-9, 1 | WINDOW | 0.70 / 3.15 / 2.74 / 3.20 | nie wycięto | NOT_BUILT: it stands above the top of its wall: the dormer or gable it belongs to was not read or is not built — OPENING_ | — | DERIVED, ±0.059 m; its two sides on elevation el-p10, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-left-3 | p10 [505,575–552,657] | wall-0-9, 0 | WINDOW | 4.23 / 1.38 / 2.41 / 1.32 | 1.38 × 2.41, 1.32 | EXACT | FALSE | DERIVED, ±0.059 m; its two sides on elevation el-p10, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-left-4 | p10 [598,405–665,477] | wall-1-9, 1 | WINDOW | 6.97 / 1.97 / 2.12 / 3.82 | nie wycięto | NOT_BUILT: it stands above the top of its wall: the dormer or gable it belongs to was not read or is not built — OPENING_ | — | DERIVED, ±0.059 m; its two sides on elevation el-p10, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-left-5 | p10 [620,605–675,710] | wall-0-9, 0 | DOOR | 7.62 / 1.62 / 2.85 / 0.00 | 1.62 × 2.85, 0.00 | EXACT | OFF along +0.41, width +0.78, height +1.31, bottom -0.76 | DERIVED, ±0.059 m; its two sides on elevation el-p10, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-left-6 | p10 [705,575–750,657] | wall-0-9, 0 | WINDOW | 10.12 / 1.32 / 2.41 / 1.32 | 1.32 × 2.41, 1.32 | EXACT | OFF along +0.19, width +0.50, height +0.87, bottom +0.56 | DERIVED, ±0.059 m; its two sides on elevation el-p10, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-left-7 | p10 [833,575–878,657] | wall-0-9, 0 | WINDOW | 13.88 / 1.32 / 2.41 / 1.32 | 1.32 × 2.41, 1.32 | EXACT | FALSE | DERIVED, ±0.059 m; its two sides on elevation el-p10, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-left-8 | p10 [875,412–950,492] | wall-1-9, 1 | GLAZED_DOOR | 15.12 / 2.21 / 2.35 / 3.38 | nie wycięto | NOT_BUILT: it stands above the top of its wall: the dormer or gable it belongs to was not read or is not built — OPENING_ | — | DERIVED, ±0.059 m; its two sides on elevation el-p10, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-rear-1 | p11 [258,400–413,505] | wall-1-4, 1 | GLAZED_DOOR | 0.47 / 4.08 / 2.77 / 2.29 | 4.08 × 2.77, 5.09 | EXACT | PRESENT | DERIVED, ±0.053 m; its two sides on elevation el-p11, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-rear-2 | p11 [337,592–410,682] | wall-0-4, 0 | GLAZED_DOOR | 2.56 / 1.92 / 2.37 / 0.42 | 1.92 × 2.37, 0.42 | EXACT | PRESENT | DERIVED, ±0.053 m; its two sides on elevation el-p11, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-rear-3 | p11 [462,592–493,668] | wall-0-5, 0 | WINDOW | -0.18 / 1.17 / 2.00 / 0.79 | nie wycięto | NOT_BUILT: 1.17 m wide at -0.18 m on a wall whose clear stretch is 0.42..1.08 m: it would lose 0.60 m, more than the read | — | DERIVED, ±0.053 m; its two sides on elevation el-p11, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-rear-4 | p11 [462,345–722,505] | wall-1-6, 1 | GLAZED_DOOR | -1.17 / 6.85 / 4.22 / 2.29 | nie wycięto | NOT_BUILT: 6.85 m wide at -1.17 m on a wall whose clear stretch is 0.42..4.68 m: it would lose 2.59 m, more than the read | — | DERIVED, ±0.053 m; its two sides on elevation el-p11, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-rear-5 | p11 [513,592–670,698] | wall-0-6, 0 | GLAZED_DOOR | 0.17 / 4.14 / 2.79 / 0.00 | 3.89 × 2.79, 0.00 | APPROXIMATED: 4.14 m wide as read; trimmed by 0.25 m at the corner of its wall: more than the reading's ±0.10 m — an approxi | OFF along +0.02, width +3.33, height +1.30, bottom -0.66 | DERIVED, ±0.053 m; its two sides on elevation el-p11, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-rear-6 | p11 [693,592–724,668] | wall-0-7, 0 | WINDOW | -0.27 / 1.17 / 2.00 / 0.79 | nie wycięto | NOT_BUILT: 1.17 m wide at -0.27 m on a wall whose clear stretch is 0.42..1.08 m: it would lose 0.69 m, more than the read | — | DERIVED, ±0.053 m; its two sides on elevation el-p11, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-rear-7 | p11 [760,400–915,510] | wall-1-8, 1 | GLAZED_DOOR | 0.53 / 4.08 / 2.90 / 2.15 | 4.08 × 2.90, 4.96 | EXACT | FALSE | DERIVED, ±0.053 m; its two sides on elevation el-p11, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-rear-8 | p11 [788,592–918,668] | wall-0-8, 0 | WINDOW | 1.26 / 3.43 / 2.00 / 0.79 | 3.43 × 2.00, 0.79 | EXACT | FALSE | DERIVED, ±0.053 m; its two sides on elevation el-p11, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-right-1 | p12 [293,415–343,498] | wall-1-1, 1 | WINDOW | 0.80 / 1.59 / 2.64 / 3.51 | nie wycięto | NOT_BUILT: 1.59 m wide at 0.80 m on a wall whose clear stretch is 0.42..1.56 m: it would lose 0.82 m, more than the readi | — | DERIVED, ±0.064 m; its two sides on elevation el-p12, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-right-2 | p12 [395,590–440,672] | wall-0-3, 0 | WINDOW | 2.06 / 1.43 / 2.61 / 0.77 | 1.43 × 2.61, 0.77 | EXACT | FALSE | DERIVED, ±0.064 m; its two sides on elevation el-p12, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-right-3 | p12 [553,590–598,672] | wall-0-3, 0 | WINDOW | 7.08 / 1.43 / 2.61 / 0.77 | 1.43 × 2.61, 0.77 | EXACT | FALSE | DERIVED, ±0.064 m; its two sides on elevation el-p12, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-right-4 | p12 [560,418–598,485] | wall-1-3, 1 | WINDOW | 7.30 / 1.21 / 2.13 / 3.92 | nie wycięto | NOT_BUILT: it stands above the top of its wall: the dormer or gable it belongs to was not read or is not built — OPENING_ | — | DERIVED, ±0.064 m; its two sides on elevation el-p12, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-right-5 | p12 [660,590–707,672] | wall-0-3, 0 | WINDOW | 10.48 / 1.50 / 2.61 / 0.77 | 1.50 × 2.61, 0.77 | EXACT | FALSE | DERIVED, ±0.064 m; its two sides on elevation el-p12, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-right-6 | p12 [800,590–845,672] | wall-0-3, 0 | WINDOW | 14.94 / 1.43 / 2.61 / 0.77 | nie wycięto | NOT_BUILT: 1.43 m wide at 14.94 m on a wall whose clear stretch is 0.42..15.52 m: it would lose 0.85 m, more than the rea | — | DERIVED, ±0.064 m; its two sides on elevation el-p12, at the plan's s |
| c5-architecturaldesigns-550029lan | opening-right-7 | p12 [800,418–848,498] | wall-1-3, 1 | WINDOW | 14.94 / 1.53 / 2.54 / 3.51 | nie wycięto | NOT_BUILT: 1.53 m wide at 14.94 m on a wall whose clear stretch is 0.42..15.52 m: it would lose 0.95 m, more than the rea | — | DERIVED, ±0.064 m; its two sides on elevation el-p12, at the plan's s |

## 6. Wybór LOCAL / H

Oba kandydaty są trzymane wobec tych samych faktów źródłowych: wydrukowane wymiary całkowite (sprawdzone na obrysie),
wysokość budynku ze strony (nad terenem), **znacznik kalenicy z przekroju (nad ±0,00, osobno)**, **wydrukowany poziom
stropu kondygnacji, której rzut jest publikowany**, pole i położenie obrysu. Kody: `LOCAL_MEETS_SOURCE`,
`DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS`, `DESCRIBED_ONLY`, `NO_COMMON_FACT_LOCAL_KEPT`, `DESCRIBED_REJECTED_LOCAL_KEPT`,
`DESCRIBED_REJECTED_LOCAL_CONTRADICTS` (podgląd częściowy), `BOTH_CONTRADICT` (podgląd częściowy), `NO_MODEL`.
Niewspierany detal jest „nieznanym", nie decyduje. Wnętrze: gdy opis zastępuje LOCAL z pokojami, LOCAL jest zapisywany
obok jako zastąpiona rewizja (`superseded-local-model.json`, trasa `/v1/analyses/:id/superseded`) i wynik mówi, czego nie
przeniesiono; pokoje nie są dołączane do innego obrysu bez sprawdzenia.

Kontrpróby (`house-v3545.test.ts`): rzeczywiście wysoki dom (3 kondygnacje) — nie odrzucony; brak `publishedHeight` —
znacznik wystarcza, gdy jest wsparty; błędna wysoka liczba z API (+18,13) — opis odrzuca sam siebie, LOCAL zostaje;
poziom górnego stropu zamiast kalenicy — nie jest faktem kalenicy; nieczytelny przekrój — LOCAL zgodny z wymiarami
zostaje; brak górnej kondygnacji w LOCAL — wykryty; rozjazd rzędnej i wysokości nad terenem — nazwany osobno.
Teren ze spadkiem i piwnica: **nie ma osobnego testu** (rzędna terenu jest jedną liczbą; piwnica nie jest
modelowana) — ograniczenie.

### Potwierdzenie — nowy H

| dom | LOCAL | opis H | sprzeczności źródłowe LOCAL | sprzeczności źródłowe H | nieznane | wybrany | kod decyzji | skutek dla wnętrz |
|---|---|---|---|---|---|---|---|---|
| c5-archon-malaxisach-2-e | brak modelu | BUILT 17.043 × 12.455 m | brak modelu | the description fails its own source checks: the outline's width against the printed 1660 (17.04 m); the outline's depth against the printed 1200 (12.45 m) | — | NONE | NO_MODEL | no model stands |
| c5-archon-anodach-3-g2e | brak modelu | BUILT 14 × 19.25 m | brak modelu | — | 6 item(s) read and not built (SOURCE_UNKNOWN); 1 item(s) read and not built (CAPABILITY_MISSING); 3 item(s) read and not built (COMPILE_CONFLICT) | DESCRIBED | DESCRIBED_ONLY | there was no LOCAL model: no interior existed to carry over |
| c5-dobredomy-kardamon | brak modelu | BUILT 19.578 × 19.272 m | brak modelu | the description fails its own source checks: ridge − terrain against the total height printed on the section (8.35 m) | — | NONE | NO_MODEL | no model stands |
| c5-lipinscy-alaska | model 7.20 × 17.24 m, dach +15.98 | BUILT 17.24 × 7.64 m | overall depth: 17.24 m wobec printed "764" = 7.64 m; overall width: 7.20 m wobec printed "1724" = 17.24 m; top of the roof above ±0,00: 15.98 m wobec section mark "+5,98" = 5.98 m (printed on 2 pictures; 2 registered ele; where the walled outline lies: 27 % of the two outlines coincide, each set against its own front-left corner wobec traced outline verified against the printed dimensions | — | 3 item(s) read and not built (SOURCE_UNKNOWN); 2 item(s) read and not built (CAPABILITY_MISSING); 1 item(s) read and not built (HELD_BY_DEPENDENCY) | DESCRIBED | DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS | LOCAL held 7 room(s) and 14 interior wall(s); the described house is an exterior and they are NOT carried into it (their fit to the new outline is not |
| c5-studioatrium-pliszka-v-plus | model 11.32 × 18.42 m, dach +6.069 | BUILT 11.45 × 18.95 m | — | the description fails its own source checks: ridge − terrain against the total height printed on the section (6.25 m) | — | LOCAL | DESCRIBED_REJECTED_LOCAL_KEPT | LOCAL stands with whatever interior it has: nothing is removed |
| c5-extradom-tracja-2 | model 13.95 × 9.26 m, dach +5.474 | BUILT 13.84 × 9.34 m | — | — | 6 item(s) read and not built (SOURCE_UNKNOWN) | LOCAL | LOCAL_MEETS_SOURCE | LOCAL stands with whatever interior it has: nothing is removed |
| c5-extradom-mirabelka-4 | model 11.90 × 8.60 m, dach +5.811 | BUILT 11.9 × 8.65 m | — | — | — | LOCAL | LOCAL_MEETS_SOURCE | LOCAL stands with whatever interior it has: nothing is removed |
| c5-architecturaldesigns-550029lan | brak modelu | BUILT 18.765 × 18.989 m | brak modelu | — | 9 item(s) read and not built (CAPABILITY_MISSING); 12 item(s) read and not built (WRONG_BINDING); 2 item(s) read and not built (SOURCE_UNKNOWN); 1 item(s) read  | DESCRIBED | DESCRIBED_ONLY | there was no LOCAL model: no interior existed to carry over |

### DEV — odtworzenie na nowym konsumencie

| dom | LOCAL | opis H | sprzeczności źródłowe LOCAL | sprzeczności źródłowe H | nieznane | wybrany | kod decyzji | skutek dla wnętrz |
|---|---|---|---|---|---|---|---|---|
| c4-archon-lubczyku-2 | model 15.93 × 8.68 m, dach +8.4 | BUILT 15.92 × 10.02 m | walled ground outline: 115.3 m² wobec traced outline verified against the printed dimensions: 134.9 m²; where the walled outline lies: 75 % of the two outlines coincide, each set against its own front-left corner wobec traced outline verified against the printed dimensions | — | 1 item(s) read and not built (SOURCE_UNKNOWN); 3 item(s) read and not built (COMPILE_CONFLICT); 1 item(s) read and not built (HELD_BY_DEPENDENCY) | DESCRIBED | DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS | LOCAL held 12 room(s) and 19 interior wall(s); the described house is an exterior and they are NOT carried into it (their fit to the new outline is no |
| c4-archon-frizeach-g2e | model 19.49 × 13.50 m, dach +6.78 | BUILT 19.5 × 13.5 m | — | — | 8 item(s) read and not built (HELD_BY_DEPENDENCY); 5 item(s) read and not built (SOURCE_UNKNOWN); 3 item(s) read and not built (CAPABILITY_MISSING) | LOCAL | LOCAL_MEETS_SOURCE | LOCAL stands with whatever interior it has: nothing is removed |
| c4-dobredomy-pallas | model 16.54 × 10.41 m, dach +2.8 | BUILT 16.476 × 10.43 m | building height above the terrain: 3.10 m wobec published 8.5 m; top of the roof above ±0,00: 2.80 m wobec section mark "+7,97" = 7.97 m (1 registered elevation(s) show the ridg | — | 1 item(s) read and not built (COMPILE_CONFLICT) | DESCRIBED | DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS | LOCAL held 3 room(s) and 6 interior wall(s); the described house is an exterior and they are NOT carried into it (their fit to the new outline is not  |
| c4-lipinscy-oslo | model 8.55 × 7.05 m, dach +16.79 | BUILT 8.55 × 7.05 m | top of the roof above ±0,00: 16.79 m wobec section mark "+6,79" = 6.79 m (printed on 2 pictures; 4 registered ele | — | 5 item(s) read and not built (SOURCE_UNKNOWN); 1 item(s) read and not built (COMPILE_CONFLICT); 1 item(s) read and not built (HELD_BY_DEPENDENCY) | DESCRIBED | DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS | LOCAL held 10 room(s) and 15 interior wall(s); the described house is an exterior and they are NOT carried into it (their fit to the new outline is no |
| c4-lipinscy-dublin | brak modelu | BUILT 13 × 10.04 m | brak modelu | — | 2 item(s) read and not built (COMPILE_CONFLICT) | DESCRIBED | DESCRIBED_ONLY | there was no LOCAL model: no interior existed to carry over |
| c4-studioatrium-wena | model 6.49 × 15.20 m, dach +5.6 | BUILT 8.8 × 11.2 m | overall width: 6.49 m wobec printed "8.80" = 8.8 m; overall depth: 15.20 m wobec printed "11.20" = 11.2 m; building height above the terrain: no roof built wobec published 8.46 m; where the walled outline lies: 59 % of the two outlines coincide, each set against its own front-left corner wobec traced outline verified against the printed dimensions | — | 2 item(s) read and not built (SOURCE_UNKNOWN) | DESCRIBED | DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS | LOCAL held 2 room(s) and 0 interior wall(s); the described house is an exterior and they are NOT carried into it (their fit to the new outline is not  |
| confirm-dobredomy-gracja-i-mala-ii | model 12.06 × 13.43 m, dach +2.8 | BUILT 16.82 × 10.12 m | overall width: 12.06 m wobec printed "16,82" = 16.82 m; overall depth: 13.43 m wobec printed "10,12" = 10.12 m; building height above the terrain: 3.10 m wobec published 8.6 m; top of the roof above ±0,00: 2.80 m wobec section mark "+8,13" = 8.13 m (4 registered elevation(s) show the ridg; floor level of storey 1 above ±0,00: no storey above the ground built wobec the floor mark +3,04 = 3.04 m; a plan of that storey is published; where the walled outline lies: 59 % of the two outlines coincide, each set against its own front-left corner wobec traced outline verified against the printed dimensions | — | 2 item(s) read and not built (WRONG_BINDING); 1 item(s) read and not built (SOURCE_UNKNOWN); 3 item(s) read and not built (COMPILE_CONFLICT); 1 item(s) read and | DESCRIBED | DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS | LOCAL held 1 room(s) and 0 interior wall(s); the described house is an exterior and they are NOT carried into it (their fit to the new outline is not  |
| projekt-dom-w-toreniach-3-e-me822857280738 | model 7.39 × 12.50 m, dach +5.72 | BUILT 7.9 × 12.5 m | overall width: 7.39 m wobec printed "790" = 7.9 m; walled ground outline: 81.6 m² wobec traced outline verified against the printed dimensions: 96.3 m²; where the walled outline lies: 84 % of the two outlines coincide, each set against its own front-left corner wobec traced outline verified against the printed dimensions | — | 4 item(s) read and not built (SOURCE_UNKNOWN); 4 item(s) read and not built (CAPABILITY_MISSING); 1 item(s) read and not built (COMPILE_CONFLICT) | DESCRIBED | DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS | LOCAL held 4 room(s) and 6 interior wall(s); the described house is an exterior and they are NOT carried into it (their fit to the new outline is not  |
| final-archon-dom-w-kuklikach | model 7.56 × 8.76 m, dach +4.982 | BUILT 7.56 × 8.76 m | top of the roof above ±0,00: 4.98 m wobec section mark "+5,53" = 5.53 m (4 registered elevation(s) show the ridg | — | 2 item(s) read and not built (CAPABILITY_MISSING); 6 item(s) read and not built (SOURCE_UNKNOWN) | DESCRIBED | DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS | LOCAL held 4 room(s) and 5 interior wall(s); the described house is an exterior and they are NOT carried into it (their fit to the new outline is not  |

## 7. Korekty (przegląd sceny)

Korekta ma `baseRevision` (skrót obserwacji, bez pola `readIn`), grupę i rewizję po zastosowaniu. Grupa jest stosowana na
kopii, cały dom walidowany raz, wszystko albo nic. Korekty otworów odrzucone pojedynczo za kolizję są oceniane ponownie po
pozostałych, a potem razem na elewację. Dodanie w miejscu już odczytanego otworu (IoU > 0,5) koryguje go, nie dubluje.
Brak otworu w opisie nie usuwa otworu LOCAL (opis i LOCAL nie są scalane).

### Potwierdzenie — nowy H (wszystkie propozycje)

| dom | runda | korekta | przedmiot | grupa | wynik | powód / skutek | rewizja przed → po |
|---|---|---|---|---|---|---|---|
| c5-dobredomy-kardamon | 1 | ADD_OPENING | el-p3/o1 (corrected) | — | REJECTED NOT_CONSUMED | the built model is the same with it: the correction reached no geometry | 80b536a83fd4 → — |
| c5-dobredomy-kardamon | 1 | ADD_OPENING | el-p3/o2 (corrected) | — | REJECTED NOT_CONSUMED | the built model is the same with it: the correction reached no geometry | 80b536a83fd4 → — |
| c5-dobredomy-kardamon | 1 | ADD_OPENING | el-p3/o3 (corrected) | — | REJECTED NOT_CONSUMED | the built model is the same with it: the correction reached no geometry | 80b536a83fd4 → — |
| c5-dobredomy-kardamon | 1 | ADD_OPENING | el-p3/o4 (corrected) | — | REJECTED NOT_CONSUMED | the built model is the same with it: the correction reached no geometry | 80b536a83fd4 → — |
| c5-studioatrium-pliszka-v-plus | 1 | SET_ELEVATION_BODY | garage | — | REJECTED WRONG_BINDING | no body garage on the plan, or no wall ends | a1c1c1e24689 → — |
| c5-studioatrium-pliszka-v-plus | 1 | SET_ELEVATION_BODY | main | — | REJECTED WRONG_BINDING | no body main on the plan, or no wall ends | a1c1c1e24689 → — |
| c5-architecturaldesigns-550029lan | 1 | SET_ROOF | roof of main | — | REJECTED NOT_CONSUMED | the built model is the same with it: the correction reached no geometry | 78b4311a1a38 → — |

Na potwierdzeniu przegląd nie zastosował ani jednej korekty (7 propozycji, wszystkie odrzucone z kodem). Na DEV
(nowe odczyty na żywo) — tabela w ZIP-ie (`report/t-corrections-dev.md`); Frizea: 7 dodanych otworów zastosowanych w L4,
co pokazało, że pierwszy odczyt dał elewacje bez otworów (rozdz. 3, p. 3).

## 8. Ocena szczegółowa zamiast liczenia okien

Oceniacz `research/source-to-model/v3545/score-detail.py` (`v3545-detail/1`), samokontrola 10/10
(`score-detail-selfcheck.py`: okno zwężone o połowę jest OFF, dziura na innej stronie lub kondygnacji jest MISSING+FALSE,
lustro nie jest odwracane, strona bez źródła nie jest oceniana, brak skali boku = tylko obecność). Referencje: per strona
i otwór, z pikseli opublikowanych obrazów, odczytane przez czytelników źródeł, którzy nie widzieli wyników
(`refs-detail-dev/`, `refs-detail-confirm/`). **Ograniczenie niezależności:** czytelnicy to osobne sesje agenta (inny model
niż czytnik kandydata, inna procedura — siatka pikseli na powiększonych wycinkach), nie człowiek.

### Rozkłady błędów otworów (dopasowane i mierzalne; mediana / 90. percentyl, m)

| zbiór | przebieg | modele | obrys ok | kalenica ok | strony zbud. | otwory ok | dopasowane | fałszywe | środek wzdłuż | środek w pionie | szerokość | wysokość | dół |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DEV (9) | LOCAL | 8 | 3/8 | 3/8 | 25/36 | 26 | 73/121 | 29 | 0,10 / 0,66 | 0,07 / 0,41 | 0,12 / 1,44 | 0,15 / 0,89 | 0,09 / 0,88 |
| DEV (9) | baza H | 9 | 8/9 | 9/9 | 26/36 | 42 | 72/121 | 0 | 0,05 / 0,37 | 0,17 / 0,34 | 0,03 / 0,27 | 0,05 / 0,41 | 0,05 / 0,32 |
| DEV (9) | odtworzenie, nowy konsument | 9 | 8/9 | 9/9 | 26/36 | **52** | 70/121 | 0 | 0,04 / 0,21 | **0,05 / 0,16** | 0,03 / 0,21 | 0,04 / 0,23 | **0,02 / 0,18** |
| DEV (6 z 9) | nowy odczyt na żywo | 6 | 5/6 | 6/6 | 23/24 | 43 | 69/86 | 1 | 0,05 / 0,49 | 0,04 / 0,23 | 0,04 / 0,29 | 0,04 / 0,22 | 0,03 / 0,42 |
| potw. (8) | LOCAL | 4 | 3/4 | 3/4 | 13/32 | 11 | 29/136 | 33 | 0,14 / 0,57 | 0,07 / 0,43 | 0,20 / 0,27 | 0,23 / 0,98 | 0,14 / 0,92 |
| potw. (8) | baza H, opis | 7 | 6/7 | 6/6 | 9/32 | 13 | 29/136 | 1 | 0,04 / 0,49 | 0,18 / 0,22 | 0,05 / 0,11 | 0,09 / 0,39 | 0,02 / 0,23 |
| potw. (8) | **nowy H, opis** | 8 | 6/8 | 6/6 | **15/32** | **28** | **52/136** | 15 | 0,06 / 0,62 | 0,05 / 0,24 | 0,06 / 0,47 | 0,09 / 0,28 | 0,03 / 0,28 |
| potw. (8) | baza, dom oddany | 5 | 4/5 | 4/5 | 11/32 | 13 | 21/136 | 16 | | | | | |
| potw. (8) | **nowy, dom oddany** | 6 | 5/6 | 5/5 | **20/32** | **23** | **56/136** | 36 | | | | | |
| potw. (8) | odtworzenie odpowiedzi bazy, nowy konsument | 5 | 4/5 | 4/5 | 14/32 | 13 | 31/136 | 33 | | | | | |

Wnioski: (a) **konsument** (te same odpowiedzi): na DEV +10 poprawnych otworów, błąd dolnej krawędzi z 0,32 do 0,18 m
(p90); na potwierdzeniu odtworzenie odpowiedzi bazy nie poprawiło żadnego domu (te odpowiedzi nie zawierały brakujących
elewacji — odtworzenie nie symuluje wiedzy, której nie zebrano); (b) **nowe czytanie** (pełny bieg na żywo): więcej
opisanych i zarejestrowanych stron, więcej trafionych otworów, ale też więcej fałszywych (550029LAN: 10, Alaska: 4) —
to wynik odczytu na żywo i jego wariancji, nie powtórki.

### DEV — per dom (oceniacz szczegółowy)

| dom | LOCAL | baza H | odtworzenie, nowy konsument | nowy odczyt na żywo |
|---|---|---|---|---|
| c4-archon-lubczyku-2 | obrys NIE, kal. tak, strony 4/4, otwory ok 2/17, fałsz. 3 | obrys tak, kal. tak, strony 1/4, otwory ok 1/17, fałsz. 0 | obrys tak, kal. tak, strony 1/4, otwory ok 2/17, fałsz. 0 | obrys tak, kal. tak, strony 4/4, otwory ok 4/17, fałsz. 1 |
| c4-archon-frizeach-g2e | obrys tak, kal. tak, strony 4/4, otwory ok 8/15, fałsz. 0 | obrys tak, kal. tak, strony 3/4, otwory ok 7/15, fałsz. 0 | obrys tak, kal. tak, strony 3/4, otwory ok 8/15, fałsz. 0 | obrys tak, kal. tak, strony 3/4, otwory ok 8/15, fałsz. 0 |
| c4-dobredomy-pallas | obrys NIE, kal. NIE, strony 3/4, otwory ok 1/15, fałsz. 12 | obrys NIE, kal. tak, strony 2/4, otwory ok 1/15, fałsz. 0 | obrys NIE, kal. tak, strony 2/4, otwory ok 1/15, fałsz. 0 | obrys NIE, kal. tak, strony 4/4, otwory ok 3/15, fałsz. 0 |
| c4-lipinscy-oslo | obrys tak, kal. NIE, strony 4/4, otwory ok 7/9, fałsz. 0 | obrys tak, kal. tak, strony 4/4, otwory ok 8/9, fałsz. 0 | obrys tak, kal. tak, strony 4/4, otwory ok 8/9, fałsz. 0 | obrys tak, kal. tak, strony 4/4, otwory ok 8/9, fałsz. 0 |
| c4-lipinscy-dublin | brak modelu | obrys tak, kal. tak, strony 4/4, otwory ok 10/15, fałsz. 0 | obrys tak, kal. tak, strony 4/4, otwory ok 13/15, fałsz. 0 | obrys tak, kal. tak, strony 4/4, otwory ok 12/15, fałsz. 0 |
| c4-studioatrium-wena | obrys NIE, kal. NIE, strony 1/4, otwory ok 0/15, fałsz. 12 | obrys tak, kal. tak, strony 1/4, otwory ok 2/15, fałsz. 0 | obrys tak, kal. tak, strony 1/4, otwory ok 2/15, fałsz. 0 | obrys tak, kal. tak, strony 4/4, otwory ok 8/15, fałsz. 0 |
| confirm-dobredomy-gracja-i-mala-ii | obrys NIE, kal. NIE, strony 1/4, otwory ok 0/21, fałsz. 1 | obrys tak, kal. tak, strony 4/4, otwory ok 7/21, fałsz. 0 | obrys tak, kal. tak, strony 4/4, otwory ok 8/21, fałsz. 0 | — (nie uruchamiano) |
| projekt-dom-w-toreniach-3-e-me822857280738 | obrys NIE, kal. tak, strony 4/4, otwory ok 2/8, fałsz. 1 | obrys tak, kal. tak, strony 3/4, otwory ok 0/8, fałsz. 0 | obrys tak, kal. tak, strony 3/4, otwory ok 4/8, fałsz. 0 | — (nie uruchamiano) |
| final-archon-dom-w-kuklikach | obrys tak, kal. NIE, strony 4/4, otwory ok 6/6, fałsz. 0 | obrys tak, kal. tak, strony 4/4, otwory ok 6/6, fałsz. 0 | obrys tak, kal. tak, strony 4/4, otwory ok 6/6, fałsz. 0 | — (nie uruchamiano) |

## 9. Potwierdzenie na 8 nowych rodzinach (pierwszy wynik, zamrożony protokół)

Protokół: `stage-reports/artifacts/v3545/PROTOCOL_V3545.md`, pieczęć `PROTOCOL.seal` (kod `627e4f1`, skróty referencji
i oceniaczy `research/source-to-model/v3545/refs.sha256`, sprawdzone przed oceną). Wybór domów: `SELECTION.md`.
Domy: Malaxisach 2 E, Anodach 3 G2E (ARCHON); Kardamon (DobreDomy); Alaska (Lipińscy); Pliszka V Plus (Studio Atrium);
Tracja 2, Mirabelka 4 (Extradom); 550029LAN (Architectural Designs, ft/in) — 6 wydawców, 6 spoza ARCHON.

### Dom oddany: baza (v3.54.4) → nowy (v3.54.5), zamrożona reguła `compare.py`

| dom | BASE | NEW | zyski | straty | werdykt |
|---|---|---|---|---|---|
| c5-archon-malaxisach-2-e | brak modelu | brak modelu | — | — | NO_MODEL |
| c5-archon-anodach-3-g2e | obrys tak, wys. tak, dach tak, garaż NIE, lukarny tak, strony 1/4, otwory ok 1 (dopas. 2/13, fałsz. 0) | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 11 (dopas. 11/13, fałsz. 0) | GARAGE; SIDES_BUILT 1→4; OPENINGS_OK 1→11 | — | IMPROVED |
| c5-dobredomy-kardamon | brak modelu | brak modelu | — | — | NO_MODEL |
| c5-lipinscy-alaska | obrys NIE, wys. NIE, dach tak, garaż tak, lukarny tak, strony 1/4, otwory ok 0 (dopas. 1/11, fałsz. 11) | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 1 (dopas. 7/11, fałsz. 4) | EXTENTS; HEIGHT; SIDES_BUILT 1→4 | — | IMPROVED |
| c5-studioatrium-pliszka-v-plus | obrys tak, wys. tak, dach tak, garaż NIE, lukarny tak, strony 1/4, otwory ok 1 (dopas. 1/11, fałsz. 0) | obrys tak, wys. tak, dach NIE, garaż NIE, lukarny tak, strony 4/4, otwory ok 0 (dopas. 11/11, fałsz. 17) | SIDES_BUILT 1→4 | ROOF; FALSE 0→17 | MIXED + REGRESJA KRYTYCZNA |
| c5-extradom-tracja-2 | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 8 (dopas. 10/10, fałsz. 0) | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 8 (dopas. 10/10, fałsz. 0) | — | — | SAME |
| c5-extradom-mirabelka-4 | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 3 (dopas. 7/9, fałsz. 5) | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 3 (dopas. 7/9, fałsz. 5) | — | — | SAME |
| c5-architecturaldesigns-550029lan | brak modelu | obrys NIE, wys. n/o, dach tak, garaż tak, lukarny NIE, strony 0/4, otwory ok 0 (dopas. 10/47, fałsz. 10) | ROOF; GARAGE | — | NOT_IMPROVED |

Poprawione: 2 z 8; regresje krytyczne: 1; pogorszone: 0; mieszane: 1; bez zmiany: 2.

### Opis H bez wyboru: baza H → nowy H (ta sama reguła; uwaga: kolumny dach/garaż/lukarny pochodzą z oceniacza historycznego domu oddanego — ograniczenie zamrożonego skryptu, zostawione bez zmian)

| dom | BASE_H | NEW_H | zyski | straty | werdykt |
|---|---|---|---|---|---|
| c5-archon-malaxisach-2-e | obrys tak, wys. tak, dach NIE, garaż NIE, lukarny NIE, strony 2/4, otwory ok 0 (dopas. 9/12, fałsz. 0) | obrys tak, wys. tak, dach NIE, garaż NIE, lukarny NIE, strony 2/4, otwory ok 4 (dopas. 9/12, fałsz. 0) | OPENINGS_OK 0→4 | — | IMPROVED |
| c5-archon-anodach-3-g2e | obrys tak, wys. tak, dach tak, garaż NIE, lukarny tak, strony 1/4, otwory ok 1 (dopas. 2/13, fałsz. 0) | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 11 (dopas. 11/13, fałsz. 0) | GARAGE; SIDES_BUILT 1→4; OPENINGS_OK 1→11 | — | IMPROVED |
| c5-dobredomy-kardamon | obrys NIE, wys. n/o, dach NIE, garaż NIE, lukarny NIE, strony 0/4, otwory ok 1 (dopas. 7/23, fałsz. 1) | obrys NIE, wys. n/o, dach NIE, garaż NIE, lukarny NIE, strony 0/4, otwory ok 1 (dopas. 4/23, fałsz. 1) | — | — | SAME |
| c5-lipinscy-alaska | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 1/4, otwory ok 0 (dopas. 0/11, fałsz. 0) | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 1 (dopas. 7/11, fałsz. 4) | SIDES_BUILT 1→4 | FALSE 0→4 | MIXED |
| c5-studioatrium-pliszka-v-plus | obrys tak, wys. tak, dach tak, garaż NIE, lukarny tak, strony 1/4, otwory ok 1 (dopas. 1/11, fałsz. 0) | obrys tak, wys. tak, dach NIE, garaż NIE, lukarny tak, strony 1/4, otwory ok 1 (dopas. 1/11, fałsz. 0) | — | ROOF | WORSE + REGRESJA KRYTYCZNA |
| c5-extradom-tracja-2 | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 10 (dopas. 10/10, fałsz. 0) | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 10 (dopas. 10/10, fałsz. 0) | — | — | SAME |
| c5-extradom-mirabelka-4 | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 0/4, otwory ok 0 (dopas. 0/9, fałsz. 0) | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 0/4, otwory ok 0 (dopas. 0/9, fałsz. 0) | — | — | SAME |
| c5-architecturaldesigns-550029lan | brak modelu | obrys NIE, wys. n/o, dach tak, garaż tak, lukarny NIE, strony 0/4, otwory ok 0 (dopas. 10/47, fałsz. 10) | ROOF; GARAGE | — | NOT_IMPROVED |

Poprawione: 2 z 8; regresje krytyczne: 1; pogorszone: 1; mieszane: 1; bez zmiany: 3.

### Odtworzenie: odpowiedzi bazy przez nowego konsumenta

| dom | BASE | REPLAY | zyski | straty | werdykt |
|---|---|---|---|---|---|
| c5-archon-malaxisach-2-e | brak modelu | brak modelu | — | — | NO_MODEL |
| c5-archon-anodach-3-g2e | obrys tak, wys. tak, dach tak, garaż NIE, lukarny tak, strony 1/4, otwory ok 1 (dopas. 2/13, fałsz. 0) | obrys tak, wys. tak, dach tak, garaż NIE, lukarny tak, strony 1/4, otwory ok 2 (dopas. 2/13, fałsz. 0) | — | — | SAME |
| c5-dobredomy-kardamon | brak modelu | brak modelu | — | — | NO_MODEL |
| c5-lipinscy-alaska | obrys NIE, wys. NIE, dach tak, garaż tak, lukarny tak, strony 1/4, otwory ok 0 (dopas. 1/11, fałsz. 11) | obrys NIE, wys. NIE, dach tak, garaż tak, lukarny tak, strony 1/4, otwory ok 0 (dopas. 1/11, fałsz. 11) | — | — | SAME |
| c5-studioatrium-pliszka-v-plus | obrys tak, wys. tak, dach tak, garaż NIE, lukarny tak, strony 1/4, otwory ok 1 (dopas. 1/11, fałsz. 0) | obrys tak, wys. tak, dach NIE, garaż NIE, lukarny tak, strony 4/4, otwory ok 0 (dopas. 11/11, fałsz. 17) | SIDES_BUILT 1→4 | ROOF; FALSE 0→17 | MIXED + REGRESJA KRYTYCZNA |
| c5-extradom-tracja-2 | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 8 (dopas. 10/10, fałsz. 0) | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 8 (dopas. 10/10, fałsz. 0) | — | — | SAME |
| c5-extradom-mirabelka-4 | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 3 (dopas. 7/9, fałsz. 5) | obrys tak, wys. tak, dach tak, garaż tak, lukarny tak, strony 4/4, otwory ok 3 (dopas. 7/9, fałsz. 5) | — | — | SAME |
| c5-architecturaldesigns-550029lan | brak modelu | brak modelu | — | — | NO_MODEL |

Poprawione: 0 z 8; regresje krytyczne: 1; pogorszone: 0; mieszane: 1; bez zmiany: 4.

### Historyczny miernik sześciu grup (v3.54.4, bez zmian; „poprawiony" = względem LOCAL)

| przebieg | wierne zewnętrze (6/6 grup) | poprawione względem LOCAL |
|---|---|---|
| baza H v3.54.4 | 2/8 (Tracja 2, Mirabelka 4 — oba to LOCAL) | 2/8 (Anodach, Pliszka) |
| nowy H v3.54.5 | 3/8 (Alaska, Tracja 2, Mirabelka 4) | 3/8 (Anodach, Alaska, 550029LAN) |

### Wynik wobec kryterium

- POPRAWIONY (zamrożona reguła): **2 z 8** — Anodach (archon.pl), Alaska (lipinscy.pl, spoza ARCHON).
- Regresja krytyczna: **1** — Pliszka (DACH: TAK → NIE; dom oddany zmienił się z opisu na LOCAL, rozdz. 3 p. 7).
- Próg ≥3/8 u ≥2 wydawców bez regresji krytycznej: **niespełniony**. Wynik: ograniczony, za flagą pilota.
- Wszystkie kryteria szczegółowe: nowy 2/8 (Anodach, Tracja 2), baza 1/8 (Tracja 2).
- Znane wady pozostałe: Malaxisach (obrys odczytany z żebrami ścian 17,04 × 12,45 m zamiast 16,60 × 12,00 — opis odrzuca
  sam siebie, LOCAL bez modelu), Kardamon (brak przekroju i wymiarów rzutu; wysokość całkowita sprzeczna), 550029LAN
  (stopy/cale, wieża i 5 brył; obrys 18,8 × 19,0 m wobec 13,9 × 14,0 — model zbudowany, ale NIE wierny), Pliszka (wybór),
  Mirabelka (elewacje nie wysłane).

## 10. Testy, build, host

| test / build / E2E | commit | konfiguracja | wynik | odstępstwo |
|---|---|---|---|---|
| `house-v3544.test.ts` (25) | `627e4f1` | vitest | 25/25 | — |
| `house-v3545.test.ts` (40: przyczyny i kontrpróby) | `627e4f1` | vitest | 40/40 | — |
| typecheck (`tsc -p tsconfig.json`) | `627e4f1` | | czysto | — |
| pełny zestaw | `627e4f1` | vitest, 350 plików | 4097 ok, 17 nie, 11 pominiętych | 16 = te same co w v3.54.4 (porównane po nazwie); 1 nowy: `worker.test.ts` limit czasu pod obciążeniem — osobno 3/3 |
| samokontrola oceniacza | `ce16267` | python | 10/10 | — |
| build hosta (`apps/analyzer-api`, `node build.mjs`) | `627e4f1` (+ tylko skrypty badawcze) | `dist/server.mjs` sha256 `229fa6108931dd34…` | zbudowany | — |
| E2E hosta, job-1 Oslo (pilot) | ten build | URL → pobranie → API → house.json → decyzja → model → scena → zapis/odczyt | COMPLETED 195 s, `DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS`, zastąpiony LOCAL zapisany, wszystkie kontrole ok | — |
| E2E hosta, job-2 Wena (pilot) | ten build | jw. | COMPLETED 170 s, `DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS` (z rekordu; automatyczna kontrola kodu nie zadziałała — adres zawiera przecinek, a lista oczekiwań była dzielona przecinkami) | kontrola kodu sprawdzona ręcznie |
| E2E hosta, job-3 Frizea (kontrola LOCAL) | ten build | jw. | COMPLETED 295 s, `LOCAL_MEETS_SOURCE` | — |
| E2E hosta, Kukliki bez tokena | ten build | bez pilota | COMPLETED 85 s, 0 USD, 0 zapytań, brak `house.json` (404), ścieżka rysunków | — |

Wszystkie artefakty każdego zadania hosta wskazują tę samą rewizję: dokument 0.2.0, analizator
`house-document-0.2.0+builder-0.1.0+reading-0.2.0`, skrót pakietu źródłowego zgodny między wynikiem a `house.json`,
bajty sceny i modelu zgodne ze skrótami z podsumowania, dokument odczytany dwa razy identyczny. Odtworzenie tych samych
zapisanych odpowiedzi na DEV dwukrotnie na zamrożonym kodzie daje te same skróty modelu na 9 z 9 domów; różnice
między biegami na żywo (np. Frizea: pierwszy odczyt bez otworów, drugi z nimi) są wariancją odczytu, nie konsumenta.

**Uruchomienie finalnego hosta** (bez sekretów w poleceniu):

```bash
cd apps/analyzer-api && node build.mjs
# w środowisku hosta (wartości nie trafiają do repozytorium ani logów):
#   BUILDPLAN_ANTHROPIC_API_KEY            klucz dostawcy (sekret środowiska)
#   ANALYZER_HOUSE_DESCRIPTION=pilot       włącza opis całego domu (domyślnie wyłączony)
#   ANALYZER_HOUSE_READER=live
#   ANALYZER_HOUSE_READER_TOKEN            token pilota (sekret); zgłoszenie bez niego idzie ścieżką rysunków
#   ANALYZER_HOUSE_READER_MAX_USD, ANALYZER_HOUSE_READER_SPENT_USD, ANALYZER_HOUSE_READER_MAX_REQUESTS_PER_DAY
#   ANALYZER_DATA_DIR, PORT, HOST
node dist/server.mjs
```

Którą ścieżkę wykonano: `GET /v1/analyses/:id/result` → `analyzer.service` (`house-0.2.0` = opis, inaczej LOCAL);
`GET /v1/analyses/:id/house` → `verification.knownDefects[ACCEPTED_*]` z kodem decyzji, `verification.status` i
`verification.views`; `GET /v1/analyses/:id/superseded` — zastąpiony model LOCAL (gdy miał wnętrze).

**Android:** kontrakt odpowiedzi nie zmienił znaczenia istniejących pól (dodane: część `superseded`, nowe ostrzeżenia
`HOUSE_STATUS`, `HOUSE_INTERIOR`); aplikacji nie zmieniano, APK nie budowano, nie uruchamiano na urządzeniu —
`ANDROID_VERIFIED: nie`. Lokalne APK nie wywołuje API.

## 11. Koszt i czas

Księga narastająco: 14,453496 USD na wejściu → **19,27633 USD** (pułap 24,11036; pozostaje 4,83403). Kampania v3.54.5:
**4,822834 USD, 113 zapytań** (`research/ai-assist/spend-ledger-v3545.json`). To księga usage po cenach katalogowych
(Sonnet 5.5: 2 / 10 USD za MTok, sprawdzone w dokumentacji modeli), nie faktura.

| faza | rodzaj | zapytań | tokeny wej. | tokeny wyj. | koszt USD |
|---|---|---|---|---|---|
| confirm-base | inwentarz obrazów | 8 | 55693 | 13594 | 0.247326 |
| confirm-base | kontrola sceny i korekty (REVIEW) | 6 | 58116 | 18744 | 0.303672 |
| confirm-base | odczyt elewacji i przekroju | 7 | 77221 | 30578 | 0.460222 |
| confirm-base | odczyt rzutu | 8 | 41064 | 17750 | 0.259628 |
| confirm-new | inwentarz obrazów | 8 | 55693 | 13061 | 0.241996 |
| confirm-new | kontrola sceny i korekty (REVIEW) | 7 | 70168 | 17198 | 0.312316 |
| confirm-new | odczyt elewacji i przekroju | 7 | 81143 | 38673 | 0.549016 |
| confirm-new | odczyt rzutu | 8 | 41064 | 18987 | 0.271998 |
| dev-live | celowane uzupełnienia elewacji | 13 | 64380 | 21628 | 0.345040 |
| dev-live | kontrola sceny i korekty (REVIEW) | 18 | 186493 | 55511 | 0.928096 |
| dev-live | odczyt elewacji i przekroju | 4 | 56794 | 19843 | 0.312018 |
| dev-probe | sondy schematu | 7 | 22785 | 28 | 0.045850 |
| host-e2e | inwentarz obrazów | 3 | 20531 | 5234 | 0.093402 |
| host-e2e | kontrola sceny i korekty (REVIEW) | 3 | 31161 | 6496 | 0.127282 |
| host-e2e | odczyt elewacji i przekroju | 3 | 38137 | 14815 | 0.224424 |
| host-e2e | odczyt rzutu | 3 | 16159 | 6823 | 0.100548 |
| **confirm-base razem** | | 29 | | | 1.270848 |
| **confirm-new razem** | | 30 | | | 1.375326 |
| **dev-live razem** | | 35 | | | 1.585154 |
| **dev-probe razem** | | 7 | | | 0.045850 |
| **host-e2e razem** | | 12 | | | 0.545656 |
| **kampania razem** | | 113 | | | 4.822834 |

| pozycja | wartość |
|---|---|
| koszt pojedynczego nowego domu, nowa ścieżka (potwierdzenie, bez rozwoju) | 1,375326 / 8 = **0,172 USD** (0,06–0,23), średnio 87 s |
| koszt pojedynczego domu, baza v3.54.4 (te same domy) | 1,270848 / 8 = 0,159 USD, średnio 85 s |
| koszt domu przez host (z pobraniem i LOCAL) | 0,17–0,19 USD, 170–295 s |
| rozwój (DEV na żywo + sondy schematu) | 1,631 USD |
| odczyty: inwentarz / rzut / elewacje / uzupełnienia / kontrola sceny | w tabeli wyżej, po fazach |
| ponowienia | 1 ponowienie transportowe w ramach limitu; odrzucenia gramatyki dostawcy były niepłatne |
| pamięć | nie mierzona (jak w v3.54.4) |

## 12. Odpowiedzi wprost

- **Czy cztery dostępne elewacje rzeczywiście przeczytano?** Na DEV — tak, na wszystkich 9 domach (36/36 stron rozliczonych,
  w Lubczyku, Pallasie i Wenie opisane 4 z 4 zamiast 1 z 4). Na nowych domach — 28 z 32 opublikowanych stron; 4 strony
  Mirabelki nie zostały wysłane (limit 24 obrazów, elewacje bez etykiety wydawcy), a rejestr błędnie nazwał je brakiem
  źródła.
- **Czy okna mają właściwy host, pozycję i rozmiar?** Tam, gdzie elewacja się rejestruje — w większości tak: mediana
  błędu środka 0,04–0,06 m, szerokości 0,03–0,06 m, dolnej krawędzi 0,02–0,03 m; p90 do 0,2–0,6 m. Fałszywe otwory pojawiają
  się na nowych domach (15 w opisie nowym, 1 w bazie) — głównie 550029LAN i Alaska.
- **Czy builder coś zwęził?** Już nie po cichu: każde dopasowanie jest sklasyfikowane z deltą; zwężenie ponad niepewność
  odczytu jest `APPROXIMATED` (7 na DEV, 6 na potwierdzeniu, do 25 %), większe — otwór nie jest cięty i jest nazwany.
- **Dlaczego wybrano model?** Każda decyzja ma kod i listę faktów (rozdz. 6). Opis zastępuje LOCAL tylko wtedy, gdy LOCAL
  przeczy faktowi źródła, któremu opis odpowiada.
- **Czy Oslo jest naprawione?** Tak — na zapisanych odpowiedziach, na nowym odczycie na żywo i przez finalnego hosta;
  ta sama reguła poprawiła Alaskę w próbie potwierdzającej.
- **Czy Dublin ma poprawione tylne przeszklenia?** Tak — narożne przeszklenie tylne 4,52 m wobec 4,99 m w źródle (było
  2,16 m); pozostałe cztery tylne otwory OK.
- **Czy istniejące wnętrza przetrwały?** Gdy opis zastępuje LOCAL z pokojami, LOCAL jest zapisywany obok jako zastąpiona
  rewizja i wynik mówi, czego nie przeniesiono; gdy LOCAL zostaje — nic nie jest usuwane. Pokoje nie są przenoszone do
  nowego obrysu (to nie jest scalanie).
- **Czy nowy kod działa przez finalnego hosta?** Tak — build z `627e4f1`, 3 przypadki z pilotem i 1 bez tokena,
  wszystkie kontrole.

## 13. Ograniczenia i następne decyzje

1. **Wybór sprawdza LOCAL tylko wymiarami, wysokością i obrysem** — nie formą dachu ani otworami z zarejestrowanych
   elewacji (Pliszka). Następny krok: te same zarejestrowane elewacje jako fakt dla obu kandydatów (sylwetka dachu, liczba
   i położenie otworów na stronę), a progi wysokości opisu obok progów LOCAL, nie jako twarda bramka tylko dla opisu.
2. **Rejestr widoków nie widzi elewacji bez etykiety wydawcy** odciętych limitem obrazów (Mirabelka) — powinien je liczyć
   jako `NOT_SENT`, a inwentarz powinien dzielić limit tak, by nieoznaczone obrazy rysunkowe miały pierwszeństwo przed
   fotografiami.
3. **Fałszywe otwory nowego odczytu** (550029LAN, Alaska) — kontrola przeglądu nie usuwa ich (żadna korekta nie przeszła na
   potwierdzeniu).
4. **Obrys z żebrami ścian** (Malaxisach) i plany bez wymiarów (Kardamon) — bez zmian względem v3.54.4.
5. Referencje nie są odczytem człowieka; teren ze spadkiem i piwnica nie mają osobnych testów.
6. Android i APK — poza tą dostawą.
