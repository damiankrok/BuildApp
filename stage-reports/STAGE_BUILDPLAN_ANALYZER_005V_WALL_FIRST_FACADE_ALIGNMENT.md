# STAGE BUILDPLAN-ANALYZER-005V — WALL-FIRST FACADE ALIGNMENT V1

**Werdykt: `VISUAL_FACADE_FIT_IMPROVED_WITH_EVIDENCE`**

To nie jest akceptacja OWNER-a (`OWNER_VISUAL_NOT_RETESTED`). Poprawa jest udowodniona względem rzutu, przekroju
i elewacji źródła dla dachu A01 i dla jednej skalibrowanej ściany (front parteru). Pozostałe ściany są `NOT_VERIFIED`.

| | |
| --- | --- |
| Baza | `eff66f49c2bbb53a524b893734ea2e74925a0525` (`analyzer/005u-n4-garage-label-callout-first-bad-v1`), bez dryfu |
| Gałąź | `analyzer/005v-wall-first-facade-alignment-v1`, jeden commit |
| Nietknięte | `claude/new-session-3kzcgh` (`bfaf286e…`), `main`, wydania, tagi, stare APK |
| Paczka OWNER-a | `OWNER_ZIP_NOT_AVAILABLE`: na dysku nie ma przesłanego ZIP-a, więc nie twierdzę, że oglądałem przesłane obrazy |
| CI / APK | `NOT_RUN` (zgodnie z poleceniem) |
| Znany czerwony test | `research-isolation`: tracked APK 39 556 682 B > 32 MB (`BASELINE_KNOWN_APK_SIZE_FAILURE`); limitu nie poluzowano, APK nie usunięto |

## Przypadki

- **PRIMARY:** A01 Jarzmianki `m60124f28f071a`.
- **CONTROL:** Goździkowce 3 `m79923e950094d`. Brama garażowa N4, pokój 8, dach i ściany zostają.
- **Kontrole replayu:**
  - Marcówki `m2fa281446a8ca`;
  - Rarytasy G2E `m84f2903cb8e14` (deweloperski);
  - Dom w cieszyniankach `m43d25c0636969`.
- **`NOT_RUN`:**
  - Rarytasy OWNER `m3ea…`: w środowisku nie ma zapieczętowanego wejścia replayu dla tego modelu;
  - dom z dachem kopertowym: żaden z pięciu zapieczętowanych przypadków nie ma dachu kopertowego.

Źródło to cache strony wydawcy, z którego zbudowano zapieczętowany graf N1v (zestaw 005K). Nie pobierano go ponownie.
Obrazy oglądano prywatnie poza repozytorium. Nie obchodzono blokad pobierania ani bramek. W repozytorium są wyłącznie
liczby i opisy.

## A. Rejestr błędów (`SOURCE_VIEW_FACADE_LEDGER`)

Plik: `research/analyzer-005v-facade/ledger.json`.

**Mapowanie frontu.** `frontSide: 'SHEET_BOTTOM'` jest **poprawne**. Elewacja frontowa (z wejściem) pokazuje, od
lewej:
- przeszklenie 250/220;
- wysokie przeszklenie 100/220;
- drzwi wejściowe 105/210;
- przeszklenie 90/210.

To ten sam ciąg co dolna ściana rzutu parteru, w tych samych u/L z dokładnością do 0,01. Rzut nie jest odbity.

### FIRST_BAD po kolei

Łańcuch: źródło → dowód → ściana → otwór → emiter → siatka.

**(a) Mapowanie elewacji: nie jest błędne.** Ale A01 miał **zamienione strony szczytu i okapu**, a przyczyną był dach:
1. Głosowanie wierzchołka na zarejestrowanej elewacji lewej (`apexVotes`) brało pierwszy piksel o lumie < 200 jako
   tuszem. Niebieskie niebo renderu ma lumę ≈ 160, więc każda kolumna zaczynała się na krawędzi kadru.
2. Wierzchołek wyszedł 0,00 m.
3. Zadziałał fallback układu `ridgeAxisFromRise`. Wysokość liczona od okapu +3,60 na nawisie wybrała kalenicę wzdłuż Z.
4. Skutek: front i tył stały się szczytami, a boki okapami, odwrotnie niż na przekroju i elewacjach.

**Poprawka:** `topNeutralInkRow`. Tusz musi być neutralny (rozpiętość kanałów < 40). Elewacja lewa głosuje teraz
szczytem (+1,94 m): kalenica wzdłuż X, ściany okapowe na froncie i z tyłu, 2 kominy.

**(c) `OPENING_ABOVE_WALL_TOP` przy założonych wysokościach: błąd.**
- Przerwy w ściankach kolankowych poddasza (kolanko 1,36 m) dostawały konwencjonalny parapet 0,9 m i nadproże 2,2 m.
- Kompilator geometrii je odrzucał: 7 błędów w A01, 1 w Goździkowcach.
- Otwór po cichu znikał z modelu, choć w raporcie był.

**Poprawka:** `WallHost.eaveTopY`.
- Założone nadproże ponad okapem jest **obniżane** 5 cm pod okap, z zapisem w `unresolved`. Wysokości zostają
  `ASSUMED`. Warunek: zostaje co najmniej 1,0 m okna.
- W przeciwnym razie przerwa jest **odrzucana z nazwy** („ścianka kolankowa”) przez `onRefused` → `gap(REFUSED)`. Nie
  jest emitowana do cichego zrzucenia.
- Wysokości odczytane z opisu (`120/220`) nigdy nie są przesuwane.

**(b) Otwory źródła nieobecne na rzucie: błąd na froncie parteru A01.**
- `planGaps` skanował linię zarejestrowanego lica (wiersz 558).
- Narysowany mur to wiersze 536–556. Mur jest narysowany na ~0,42 m, a odczytany jako 0,152 m.
- Linia nie trafiała w tusz, `bandPieces` = 0 i cała ściana 10,5 m była jedną przerwą.
- Odrzucało ją maksimum 6,5 m, więc ginęły **wszystkie cztery** otwory frontu.

**Poprawka:** tylko gdy zarejestrowana linia nie przecina **żadnego** tuszu muru:
- ściana jest szukana 0,5 m do środka i 0,15 m na zewnątrz;
- bierze się linię z największym pokryciem tuszem, nie mniejszym niż 30 % długości;
- linia, która mur znajduje, nigdy się nie przesuwa.

Dlatego kontrole są bajt w bajt.

**(d) Rzędne: `OPEN`.**
- Kondygnacja 1 stoi na konwencji 2,8 m wobec wydrukowanego +3,06.
- Góra ściany okapowej to 4,435 wobec źródłowego 3,06 + 1,36 = 4,42.
- Nie ruszane, poza zakresem.

**(e) Renderer: nie jest błędny.** Przeglądarka rysuje wynik `compileBuilding` bez zmian, a wszystkie defekty były
przed emiterem. Pasek stanu przed: „7 errors, 7 warnings”, po: „geometry ok”.

## B. Wycinek produkcyjny

Zmiany w `packages/reconstruction/src/v2/`:

| plik | zmiana |
| --- | --- |
| `scan.ts` | `NEUTRAL_INK_CHROMA`, `topNeutralInkRow` |
| `reconstruct-v2.ts` | głos wierzchołka na neutralnym tuszu; `eaveTopY` dla najwyższej kondygnacji pod okapem bryły głównej (nie dla szczytu); `onRefused` → `gap(REFUSED)` |
| `openings-v2.ts` | `eaveTopY`, `EAVE_CLEARANCE_M` 0,05, `MIN_ASSUMED_WINDOW_M` 1,0, obniżenie / odmowa; w `planGaps` szukanie muru (`WALL_SEARCH_INWARD_M` 0,5, `WALL_SEARCH_OUTWARD_M` 0,15, `WALL_SEARCH_MIN_COVER` 0,3) |

Reguły slicu:
- brak slugów, stałych pikselowych i ręcznie wpisanych okien;
- żadne okno nie jest zgadywane z powierzchni;
- nie użyto metrów z perspektywy;
- wejście jest DOOR tylko z symbolu drzwi na rzucie. Model nie ma pola roli „wejście”, więc rola jest
  `UNRESOLVED_ENTRANCE`. Elewacja potwierdza położenie, ale roli nie wymyślono.

## C. Akceptacja wizualna (przed/po, ta sama kamera)

**Renderer:** produkcyjna przeglądarka webowa BuildWorld (`apps/web`, Three.js):
- `vite build` + `vite preview`;
- headless Chromium (SwiftShader);
- presety aplikacji: przód, tył, lewa, prawa, z góry bez dachu, ¾, parter z góry.

To nie jest Filament z telefonu.

**Reprodukcja:** `research/analyzer-005v-facade/capture-preview.mjs` (bez pikseli wydawcy). Skrypt w repo odtworzył
7 ujęć A01-PO **bajt w bajt**.

**PNG:** 2 domy × 2 wersje × 7 widoków + 14 zestawień. Leżą w ZIP-ie poza repozytorium (`/home/user/podglad-005v.zip`).
Prywatna nakładka elewacji ze źródłem nie trafia ani do ZIP-a, ani do repozytorium.

### A01: co się zmieniło

| widok | przed | po | ocena |
| --- | --- | --- | --- |
| przód | pusty szczyt, zero otworów | ściana okapowa z połacią i 2 kominami; parter: przeszklenie 2,58 + 3 otwory 1,00 / 1,06 / 0,89 | **improved** |
| tył | szczyt | ściana okapowa | **improved** (strona dachu) |
| lewa | ściana okapowa | szczyt; na poddaszu drzwi 1,10 i okno 1,00 | **improved** (strona dachu); otwory poddasza unverified |
| prawa | ściana okapowa | szczyt bez otworów na poddaszu | strona dachu **improved**; brak 100/220 ×2 **unchanged** |
| ¾ | dach w złą stronę | dach wzdłuż X, kominy, otwory frontu | **improved** |
| z góry bez dachu / parter | bez zmian rzutu | front parteru ma otwory | **improved** |

### Kalibracja jednej ściany: front parteru A01

Ściana: L = 10,5 m; na elewacji 411–1027 px.

| źródło (elewacja) | u0–u1 źródła | model | u0–u1 modelu | ocena |
| --- | --- | --- | --- | --- |
| duże przeszklenie 250/220 | 0,015–0,255 | WINDOW 2,58 m | 0,013–0,259 | położenie ✓; wysokość `ASSUMED` (0,9 + 1,3 zamiast ~0 + 2,2) |
| wysokie przeszklenie 100/220 | 0,429–0,521 | **DOOR** 1,00 m | 0,427–0,522 | położenie ✓, **rodzaj błędny** (szkło jako drzwi) |
| drzwi wejściowe 105/210 | 0,651–0,726 | DOOR 1,06 m | 0,650–0,751 | ✓ (do 0,75 wlicza się pas drewniany przy ościeżu) |
| przeszklenie boczne 90/210 | 0,807–0,883 | **DOOR** 0,89 m | 0,803–0,888 | położenie ✓, **rodzaj błędny** |

### Brakujące i nadmiarowe

**A01:**
- brakujące okna frontu parteru: 4 → 0 (**improved**);
- nadmiarowe okna fikcyjnego szczytu frontowego na poddaszu: 4 (zrzucane przez geometrię) → 0 (**improved**);
- ściana kolankowa z tyłu: 1 → 0 (**improved**);
- strona dachu: zła → dobra (**improved**);
- wejście: brak → DOOR z symbolu (**improved**), rola `UNRESOLVED_ENTRANCE`;
- brakujące 100/220 ×2 na prawym szczycie: **unchanged**;
- okna dachowe 78/118: niemodelowane, **unchanged**;
- dwa przeszklenia jako DOOR: **nowe, do poprawy** (położenie trafne);
- otwory parteru tył/lewa/prawa: **unverified**.

**Goździkowce:**
- 0,59 m przerwa w ściance kolankowej frontu poddasza (`opening-1-front-4-0`) była emitowana ponad górą ściany i
  zrzucana; teraz jest odmowa z nazwy;
- okna: 10 → 9;
- brama garażowa N4, pokój 8, dach, komin i wszystkie ściany: bez zmian;
- widoki: identyczne poza tym jednym otworem; **brak regresji**.

### Negatywy

- Lustro lewo–prawo rysunku z przesuniętym licem daje lustrzaną przerwę: test, żadna strona nie jest preferowana.
- Ściana bez muru w wąskim pasie nie przenosi lica na odległy tusz: test.
- Przestawienie lica bez dowodu nie zachodzi: linia, która mur trafia, nigdy się nie przesuwa. Kontrole wyszły bajt
  w bajt.

## Liczby (SHA-256)

Pełne dane, w tym listy otworów przed/po: `research/analyzer-005v-facade/before-after.json`.

| | przed | po |
| --- | --- | --- |
| A01 model | `eb7935899e484121e3949a1ac6d1f756ccc93ad0cce432f947222bfb37b902fd` | `d93291577e2d795f19a2ebfab698e1e655ecf007f342e5ba7166c4c886a61be2` |
| A01 scena | `e75e24c8ea6915918f5b03ea0126bdddbbb87af3f7ece74c51187b16958fea44` | `ba514cf5eb2124fc082d07a994ed37ab3bf81af883f2db4feddaa08bfbcb312d` |
| A01 siatki / obiekty / błędy geometrii | 100 / 77 / 7 | 126 / 93 / 0 |
| A01 otwory zewn. | 12 (11 W, 1 D) | 11 (7 W, 4 D) |
| A01 kalenica / kominy | Z / 0 | X / 2 |
| Goździkowce model | `b022b7c703e8223017585969458998e97180bb6e3fbf5f752e6ae822775687ec` | `911456a88b2530c9cf01b348dc7045a7b7bcc6d85e62e58221e5f205d41efbbc` |
| Goździkowce scena | `0f52a4feb8bd7061f2e53836f9619220495d79370b9374c9b2c2f63b1ec35829` | `bbb16ee403340782a3a158dd5bc33d546ad20828592799bdae2cb99586084199` |
| Goździkowce siatki / obiekty / błędy | 161 / 115 / 1 | 161 / 115 / 0 |
| Marcówki | `f607464936c7a13368d7f9307fb004e5bbad8b0da4490981851a33616c573321` | identyczny |
| Rarytasy G2E | `9f5fd342a53edf54f203533f18e21d37805574ea8d1038fa4dbb092d584d21e7` | identyczny |
| Cieszynianki | `e4e562923319084fda0b9ae934bcb1185a7098c53e7727c82f9afdcb592c1f6c` | identyczny |

## Testy

Nowe: `packages/reconstruction/test/roof-apex-eaves.test.ts`, 10 testów.
- Przed poprawkami było 5 czerwonych: 4 dla neutralnego tuszu i okapu, 1 dla szukania muru (test sprawdzony na wersji
  bez szukania).
- Po poprawkach: 10/10.

Pakiety `reconstruction`, `source-cv`, `geometry`, `scene` i `tests/architecture`: **1286 testów: 1245 zielonych, 41 czerwonych** (90 plików: 88 zielonych, 2 czerwone). `tsc`: czysto.

Czerwone, wszystkie sprzed tego etapu:
1. **`research-isolation`, rozmiar APK:** `BASELINE_KNOWN_APK_SIZE_FAILURE`, od `074d6ae`.
2. **`wall-strip.test.ts` 40/63: regresja z 005U-N3 (`d5d14be`), wykryta teraz.**
   - Bisekcja: `074c956` 63/63, `b19960d` 63/63, `d5d14be` 40 czerwonych, `eff66f4` 40 czerwonych.
   - Przyczyna: N3 podniósł próg grubości ścianki działowej do grubości muru zewnętrznego. W fiksturach 005Q ciało
     zarejestrowane jest większe niż narysowany dom (skala 0,026 wobec 0,05 m/px), więc zewnętrzny mur leży wewnątrz
     wnętrza. N3 czyta go jako ściankę działową: 7 ścian zamiast 5.
   - Próbowałem dwóch ogólnych osłon:
     - sonda „mur za ścianką po obu stronach” przy krawędzi ciała: zieleń 63/63 z jednym udokumentowanym wyjątkiem,
       ale zmieniała wnętrza A01, Goździkowców i Cieszynianek;
     - „pusty pas krawędzi ciała”: zostawiała 6 czerwonych.
   - Żadna nie była bezpieczna dla kontroli (ściana pożarowa garażu Goździkowców, która jest powodem N3), więc **obie
     wycofano**. Napraw osobnym etapem.
   - Testów nie wyłączano, rekordów `FROZEN` nie zmieniano.

## Otwarte

- Rzędna kondygnacji: konwencja 2,8 m wobec +3,06.
- Prawy szczyt poddasza: brak 100/220 ×2.
- Okna dachowe 78/118: nie ma elementu dla nich.
- Mur odczytany 0,152 m wobec ~0,42 m narysowanego. Szukanie muru obchodzi skutek, nie przyczynę.
- Dwa wysokie przeszklenia frontu A01 czytane jako DOOR.
- Wysokości otworów frontu: `ASSUMED`.
- Rola wejścia: brak pola w modelu (`UNRESOLVED_ENTRANCE`).
- Błąd `glazingDrawn` (mieszane `min`), opisany w N4.
- Regresja `wall-strip` z N3 (wyżej).
