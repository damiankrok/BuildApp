# v3.54.11 — APK z rzeczywistym H, materiały elementów i LOCAL na warstwach obrazu

Gałąź `claude/new-session-3kzcgh`. Baza: kod/host v3.54.10 `62350cc`, uzgodnienie planu `0cbe5c6`. Rewizje tego
etapu: `38592f7` (dwie zapieczętowane sceny v3.54.10 w aplikacji, testy listy scen, Master Plan v3.54.11 w całości),
`caecb9a` (D53: wykończenie na elemencie portalu; scorer v1.1; referencje stref), `84de494` (pas przecięty pod płytą
balkonu; narzędzia eksperymentu warstw, protokół, macierz zdolności), `d88f13c` (trzecia scena „H po naprawie
v3.54.11”; z niej zbudowano **APK 1342**) oraz commit tego raportu.

Trzy wyniki są rozdzielone: **(1) APK** — rozdz. 2, **(2) materiały i scorer portalu** — rozdz. 3–4, **(3) LOCAL na
warstwach obrazu i macierz zdolności** — rozdz. 5–6. Wartości wzorcowe (`research/marcowki-v2/…`, referencje DEV
v3.54.5) służą wyłącznie ocenie. Żadna nazwa, domena ani liczba wzorcowa nie weszła do kodu produkcyjnego.
**Ten etap nie wysłał ani jednego żądania do API: koszt 0 USD**; księgi bez zmian (23,808382 z 24,11036 USD).

## 1. Siedem odpowiedzi

**1. Sceny APK: który model, jak sprawdzone, jak otworzyć.** APK **1342** (arm64-v8a, `versionCode 1342` > 1341 > 1340
— ostatni rzeczywisty przed etapem; podpis podglądowy v2, certyfikat `6e48fac4…0da`; SHA-256
`8cbad72df69bd530bc234ad3da184e4bcab6be8278995af3901fe310ac985242`; zbudowany z `d88f13c`). Pierwsze trzy sceny listy:

| # | tytuł w aplikacji | model (pieczęć SHA-256) | scena (contentHash) | pochodzenie | pomieszczenia / ściany / kominy |
|---|---|---|---|---|---|
| 1 | Marcówki — H po naprawie v3.54.11 | `35602721…` | `a4915b99…` | odtworzenie (0 USD) nagrania v3.54.10 na kodzie `caecb9a` — ten sam odczyt, nowy konsument materiałów | 15 / 29 / 0 |
| 2 | Marcówki — H v3.54.10, kandydat | `826085f5…` | `530a8900…` | dokładnie `H-replay-final-model.json` z `BuildPlan-V35410-Private.zip` | 15 / 29 / 0 |
| 3 | Marcówki — LOCAL oddany przez host | `36f522a4…` | `75f62f77…` | dokładnie `host-live-job1-model.json` (to, co host oddał użytkownikowi) | 13 / 40 / 2 |

Sprawdzone po **wyciągnięciu z instalatora** (`unzip` → `assets/scenes/`): każdy z 13 plików scen i `index.json` jest
bajt w bajt taki jak wygenerowany eksporterem; `generatedFrom.modelContentHash` każdej sceny = pieczęć modelu
w rejestrze (`packages/mobile-scene/scripts/scenes.ts`); liczby elementów jak w tabeli; `apksigner verify` (v2, jeden
podpisujący), `aapt2 dump badging` (pakiet `com.buildplan.preview`, wersja 1342, `native-code: arm64-v8a`),
`zipalign -c -P 16 4` OK, segmenty `LOAD` bibliotek: 0x4000, wyjątki `libnode.so` i `libbuildapp_node_bridge.so` 0x1000
— **tak samo jak w 1340/1341** (nie zmienione tym etapem, nazwane), `GNU_RELRO` w każdej. Skan klucza w całym APK:
0 trafień. Aplikacja jest offline (bez serwera, tokenu, sekretu). Oba checkpointy v3.54.10 są w 1342 bajt w bajt takie
jak w 1341; 1341 (tylko sceny 2 i 3) dostarczono wcześniej w tym etapie. Jak otworzyć: `adb install -r` (aktualizacja
1341 bez odinstalowania), w aplikacji lista scen — trzy pierwsze pozycje; sterowanie obrotem, zoomem, kondygnacjami,
ukrywaniem dachu i wnętrzem jest istniejące, bez zmian. **ANDROID_UI_NOT_VERIFIED**: w tym środowisku nie ma
urządzenia ani emulatora — zweryfikowano wyłącznie pliki APK; obrazy w tym raporcie to rendery desktopowe tych samych
modeli, nie zrzuty z telefonu.

**2. Dlaczego pas był jasny i co naprawiono.** Prześledzone od źródła do siatki (rozdz. 3): odczyt v3.54.10 *miał*
ciemną strefę tynku nad wejściem i garażem (`zone-front-14`, `PLASTER/DARK`), ale konsument stref (v3.54.10) wiązał
strefę **wyłącznie ze ścianami** — rysował `SURFACE_REGION` na licu ściany za pasem. Pas portalu to osobne człony
`FASCIA` (`portal-front-2-1`, `portal-front-2-2`, `portal-rear-1-1`), które stoją **przed** ścianą i zawsze brały
materiał członu `mat-member` (jasny) — strefa była, ale na niewidocznej powierzchni. Naprawa (D53, `caecb9a`): strefa,
która w ramie tej samej elewacji pokrywa ≥ 60 % lica pasa, staje się wykończeniem **tego elementu**
(`portal.finish` → materiał całego członu `styleMaterial(PLASTER, DARK)`), z proweniencją `DERIVED` i śladem w
programie. Rama szczytowa i inne człony zachowują swój materiał (nie przyciemniono `mat-member` globalnie, nie dodano
płaszczyzny-nakładki ani nowej bryły dla koloru). Dwa różne wykończenia, z których każde pokrywa lico →
`ELEMENT_FINISH_CONFLICT`, żadne nie jest wybrane (konflikt niezamalowany pozostaje otwartym konfliktem); strefa
odczytana na jednej bryle, a leżąca na ścianie innej → `ZONE_BODY_SPAN` (powiedziane, nie przyjęte po cichu — `bodyId`
nie jest ignorowany). Wynik na scenach APK (14 punktów referencyjnych zapisanych przed oceną, rzut promienia od strony
patrzącego): **H v3.54.10 11/14 → H po naprawie 14/14**; LOCAL oddany 12/14.

**3. Co mierzyło 2,78, a co 2,261.** Scorer 16 cech v1 brał „pierwszą płaską płytę dachu sięgającą płaszczyzny
frontu” — w H to cienka płyta dachu garażu `roof-garage-flat` (2,781..3,031), nad którą wisi osobny pas; v1 zgłaszał
spód **płyty**, nie pasa. Scorer v1.1 mierzy wszystko, co stoi w płaszczyźnie frontu nad rozpiętością portalu
(≥ 30 % pokrycia), i nazywa obiekty: spód pasa `portal-front-2-2` = **2,261** (prawda 2,28; tolerancja 0,15 → OK),
góra 3,038 (prawda 3,07). Poprawiono **pomiar**, nie model: wiersze v1 zostają obok (H 15/16 z v1), test `--self-test`
scorera przechodzi. Szczegóły: `research/source-to-model/v35411/results/portal-scorer.md`.

**4. Podbitki, słupy, nietypowe formy.** Macierz zdolności (`results/capability-matrix.md`) rozdziela **buduje /
znajduje / potwierdzone**. Krótko: podbitka okapu i podsufitka podcienia **nie istnieją jako osobna powierzchnia** —
to spód płyty dachu/stropu/pasa, jeden materiał na człon (granica reprezentacji: drewnianej podsufitki źródła nie da
się przypisać bez rozdzielenia lic; nie dorobiono); słup/kolumna — jądro buduje (`createColumn`, tylko przekrój
prostokątny), LOCAL znajduje go **wyłącznie na rzutach** (pergola, słup w narożu wnęki, słupy otwartego skrzydła
okapu), nigdy z elewacji; w 13 modelach LOCAL DEV — 0 słupów; ceglany słup Pallas nie jest odczytany ani na oryginałach,
ani na warstwach (rozdz. 5). Belka — tylko z pergolą; element ukośny — jądro umie, czytnika nie ma; kolumna okrągła —
niereprezentowalna. Rama szczytowa, loggia, uskok obrysu — budowane, znajdowane i potwierdzone na Marcówkach.

**5. Czy maski pomagają LOCAL (auto / replay / ręcznie).** **Nie.** Na tych samych źródłach i tej samej rewizji LOCAL (0 USD): **ręczna maska** (MANUAL_MASK_DIAGNOSTIC —
górna granica tego, co dałaby poprawna maska) daje na Marcówkach wynik **identyczny z oryginałami** (16/16, 27/27,
strefy 12/14; tylko przesunięcia centymetrowe), czyli nie odblokowuje niczego, czego LOCAL nie czyta. **Maska
automatyczna** (tło niebo/roślinność połączone z brzegiem → biel) model **psuje** na Marcówkach (16 cech 7/13,
27 wierszy 9/15, strefy 7/14), na Frizeach nie zmienia oceny (drobne przesunięcia parapetów, jedna strefa mniej),
a na Pallas i Oslo daje model **bajt w bajt taki sam** (elewacje tych wydawców są rysunkami — filtr niczego w nich nie
zmienia; zmienił się tylko render, którego LOCAL nie używa do bryły). Próba przyczynowa (to samo tło w płaskim kolorze
nieba zamiast bieli) przywraca ramy szczytowe (7/13 → 12/15, strefy 7 → 12), ale przesuwa odczyt pasa portalu
(spód 2,52) — każde wypełnienie zmienia kontrast, z którego LOCAL czyta pas. „Replay” nie dotyczy LOCAL (deterministyczny:
ten sam wsad → ten sam model, potwierdzone dla Pallas i Oslo). Wniosek: granica leży w czytnikach i reprezentacji LOCAL
(drewno szczytu, panel szczytu tyłu, podsufitka, słupy), nie w tle obrazu. Wariant C nie był potrzebny, odczyt regionu
przez API nie został uruchomiony (warunek: poprawa po masce ręcznej — niespełniony).

**6. Co zniknęło albo zostało fałszywie dodane.** Zmiany zawsze względem A, na tych samych źródłach. **B-auto Marcówki — znikło:** obie ramy szczytowe (dach nie
obejmuje stref 1,0 m), loggia tylna we wnęce (odczytana jako wystająca, `balcony-rear-1-proud`), balustrada tylna,
3 okna połaciowe, drewno parteru frontu i tyłu (front → ciemny tynk), potwierdzenie kominów z renderu; **dodano
fałszywie:** ścianki boczne kondygnacji 1 stojące wolno do korony ściany (dwa „słupy” przy szczycie), płyta frontu
2,58–7,90 (prawda 3,25–7,90), nadproże bramy 2,75 (prawda 2,25), spód pasa 2,13. **B-auto (niebo):** znikła płyta
loggii frontu z balustradą; góra pasa 2,88. **B-mask (niebo):** góra pasa 3,22, spód 2,52, nadproże bramy 2,75.
**B-mask (biel):** nic nie znikło ani nie przybyło. **Frizeach B-auto:** jedna ciemna strefa frontu (0–1,51 m)
znikła; parapety −0,13…−0,15 m (w tolerancji). **Pallas, Oslo:** nic (modele identyczne). Na samych obrazach maska
ma zero zmienionych pikseli w zachowanym obszarze; krawędzie dodane przez granicę maski są policzone
(`record.json`: auto Marcówki 131 206 px, maska ręczna 14 861 px) i nie zostały przez LOCAL wzięte za ściany — fałszywe
ściany w B-auto to skutek utraconej ramy, nie granicy maski. Plansza: `layers-marcowki.png`.

**7. Koszty.** 0 USD w całym etapie: APK, materiały (odtworzenie nagrania v3.54.10 — 0 żądań), scorer, eksperyment
warstw (A, B-auto, B-mask, próba przyczynowa wypełnienia — wszystko lokalnie) i regresja. Odczyt regionu przez API
**nie został uruchomiony**: protokół warunkował go poprawą po masce ręcznej, a ta nic nie poprawiła (rozdz. 5);
rezerwacja z puli 0,301978 USD nie była potrzebna. Pula i limity bez zmian; klucz nie trafił do APK, sceny, Gita,
logów ani ZIP-a.

## 2. Wynik 1 — APK (D52)

- Rejestr: `packages/mobile-scene/scripts/scenes.ts` (`sealedOwnerModel(key, sha256, dir)`), modele w
  `packages/candidates/src/owner-v35410/` i `owner-v35411/`; eksport `npm run mobile:export-scenes` (deterministyczny).
- Testy listy scen czytają dostarczony `index.json` zamiast przestarzałych oczekiwań „5 scen” (od 005T lista była
  dłuższa): `OwnerVisualScenesTest`, `DownloadedScenesTest`, `OwnerCheckpointV35410ScenesTest` (para v3.54.10 na
  pozycjach 2–3, scena 1 to H po naprawie z jej contentHash), `TestScenes.analyzerLineages` nazywa jedną linię
  identyfikatorów LOCAL (w tym H, które importuje wnętrze LOCAL). Testów nie wyłączono. Android unit: 478, 0 błędów.
  `mobile-scene`: 91 testów zielonych (w tym `owner-v35410` i nowy `owner-v35411`).
- Kolejność dostaw: APK 1341 (dwie sceny v3.54.10, z `38592f7`) i APK 1342 (trzy sceny, z `d88f13c`) — oba
  dostarczone jako załączniki; pliki i README z hashami w paczce prywatnej.
- Host, eksport scen, instalator i UI urządzenia mają odrębne statusy: host — bez zmian względem `62350cc` w ścieżce
  serwującej (nowy host nie był budowany ani uruchamiany w tym etapie); eksport — sprawdzony; instalator — sprawdzony
  po wyciągnięciu; UI — **ANDROID_UI_NOT_VERIFIED**.

## 3. Wynik 2 — materiał na właściwym elemencie (D53)

Przepływ (Marcówki GE, front): elewacja `p12` → odczyt `DETAILS.zones` (`PLASTER/DARK`, prostokąt w pikselach
elewacji) → resolver: prostokąt strefy w ramie tej elewacji (`zoneRects`) → (v3.54.10) wyłącznie ściany pod strefą →
`SURFACE_REGION` na licu ściany; (v3.54.11) dodatkowo każdy pas portalu tej strony: część lica pasa pokryta strefą →
≥ 0,6 → `portal.finish {material, tone, coverage, basis: DERIVED, refs}` → program: człony `portal-*` (FASCIA) dostają
`styleMaterial(material, tone)` (materiał zdefiniowany raz) → siatka członu w tym materiale.

| element | v3.54.10 | v3.54.11 | uwagi |
|---|---|---|---|
| pas nad wejściem `portal-front-2-1` | mat-member (jasny) | mat-zone-plaster-dark | pokrycie strefą ≥ 0,6 |
| pas nad garażem `portal-front-2-2` | mat-member | mat-zone-plaster-dark | pas obejmuje 0,82 rozpiętości; ostatnie 0,75 m nad powrotem garażu to krawędź płyty dachu garażu — nazwane |
| pas tylny `portal-rear-1-1` | mat-member | mat-zone-plaster-dark | górne 0,17 m pasa zajmuje krawędź płyty balkonu (`balcony-rear-1`, jasna) — `ELEMENT_FINISH_PARTIAL`, płyta zachowuje swój materiał (jeden na płytę; jej wierzch to podłoga) |
| rama szczytowa (przód/tył) | jasna | jasna | nie jest portalem; test pilnuje, że nie ciemnieje |
| spód pasa / podsufitka, powroty | — | — | niewidoczne na elewacji, nie wymyślone; drewniana podsufitka źródła — granica reprezentacji (jeden materiał na człon) |

Kontrola po zbudowaniu `facade-values-built` mierzy **własne człony pasa** (spód, góra, wykończenie) zamiast „czegokolwiek
z tym prefiksem”. Testy (`packages/analysis-service/test/house-v35411.test.ts`, 5): przyczyna (ciemny pas, jasna rama,
PASS), przeciwpróba bez strefy (pas jasny — żadna reguła nie maluje wszystkich członów), konflikt (żadne wykończenie),
`ZONE_BODY_SPAN`, zapis/odczyt dokumentu i modelu. Wersje: dokument 0.7.0 (czyta 0.6.0), resolver 0.8.0, builder 0.7.0,
ścieżka domu 0.7.0; schemat modelu bez zmian.

Wyniki na trzech scenach APK (jedna miarka; `results/marcowki-apk-scenes-metrics.txt`):

| miara | H v3.54.10 | LOCAL oddany | H po naprawie |
|---|---|---|---|
| strefy w punktach referencyjnych (14) | 11 | 12 | **14** |
| 16 cech, scorer v1 (historyczny) | 15/16 (spód portalu 2,78) | 16/16 | 15/16 (ten sam pomiar płyty) |
| spód/góra portalu, scorer v1.1 | 2,261 / 3,038 OK | 2,321 / 3,06 OK | 2,261 / 3,038 OK |
| 27 wierszy szczegółu | 21/27 | 27/27 | 21/27 |

Naprawa jest **materiałowa**: geometria H nie zmieniła się (21/27 — rama szczytowa przeczytana grubiej, 0,98 vs 0,82,
otwarte od v3.54.10, percepcja). LOCAL oddany nadal ma dwa punkty jasne (drewno szczytu frontu, ciemny panel szczytu
tyłu) — LOCAL nie czyta tych stref (granica czytnika, nie konsumenta). Przed recenzją H miał 13/14 (`ZONE_OVERLAP`
na ścianie wejścia — dwie strefy różnego wykończenia, odcinek niezamalowany i nazwany); po recenzji 14/14.

## 4. Scorer portalu

Patrz odpowiedź 3 i `results/portal-scorer.md`. Referencje stref zapisano **przed** jakąkolwiek oceną
(`research/source-to-model/v35411/zone-refs-marcowki.json`: 14 punktów + spód portalu jako niereprezentowalny), scorer
`zone-refs.py` klasyfikuje kolor trafionego materiału jedną regułą dla wszystkich modeli (DARK / WOOD / LIGHT / GLASS).

## 5. Wynik 3 — LOCAL na oryginałach i warstwach obrazu (D54)

Protokół zapisany przed wynikami: `research/source-to-model/v35411/LAYERS_PROTOCOL.md` (pytanie, domy, warianty,
miary, pułap kosztu). Narzędzie: `layers.ts` (pochodne bezstratne — PNG z odkodowanych pikseli, własny hash, URL
`https://derived.invalid/<tryb>/<hash>.png`, własny cache, maska ważności, licznik dodanych krawędzi; rzuty, przekroje
i sytuacje przepuszczane bajt w bajt; `--fill` dodane dla próby przyczynowej). Maski ręczne Marcówek:
`masks-marcowki-manual.json`. Pełne wyniki: `research/source-to-model/v35411/results/layers-results.md`.

Domy DEV: Marcówki GE i Frizeach G2E (ARCHON), Pallas (dobredomy), Oslo (lipinscy) — trzech wydawców. Odstępstwo od
protokołu, nazwane: filtr auto zdejmuje piksele nieba/roślinności **połączone z brzegiem obrazu** (nie „poza wypukłą
otoczką budynku” — tej bez odczytu nie znamy).

| dom | miara | A | B-auto | B-mask | B-auto (niebo) | B-mask (niebo) |
|---|---|---|---|---|---|---|
| Marcówki | 16 cech | 16/16 | 7/13 | 16/16 | 12/15 | 13/16 |
| Marcówki | 27 wierszy | 27/27 | 9/15 | 27/27 | 23/27 | 26/27 |
| Marcówki | strefy (14) | 12 | 7 | 12 | 12 | 12 |
| Marcówki | spód pasa v1.1 (2,28) | 2,321 | 2,128 | 2,291 | 2,523 | 2,523 |
| Frizeach | score-detail | ext ok, h ok, 4/4 stron, 14/15, fałszywe 0 | to samo | — | — | — |
| Pallas | score-detail | ext NO, h NO, 3/4, 14/15, fałszywe 12 | identyczny model | — | — | — |
| Oslo | score-detail | ext ok, h NO, 4/4, 9/9, fałszywe 0 | identyczny model | — | — | — |

Słupy: 0 we wszystkich przebiegach (ceglany słup Pallas nie jest czytany ani na oryginałach, ani na warstwach). Czas:
Marcówki ~270–290 s na przebieg, Frizeach ~235 s, Oslo ~180 s, Pallas ~115 s, bez różnicy A/B; pamięć (Pallas, osobno):
1042 MB (A) / 1037 MB (B-auto). Koszt 0 USD. Wejście: pochodne PNG są większe od oryginałów JPEG (Marcówki auto
4,7 MB, Frizeach 16,2 MB) — bez wpływu na czas.

Mechanizm (rozdz. 1, odp. 5–6): białe wypełnienie zlewa się z białą ramą szczytu i kasuje jej zewnętrzną krawędź;
płaski kolor nieba ją zachowuje, ale każde wypełnienie zmienia kontrast pod pasem portalu. Decyzja wg protokołu:
**B nie pomaga, nie trafia za flagę do produkcji; C niepotrzebny; API nie uruchomione.** Wynik dotyczy czterech
rodzin DEV i nie jest dowodem transferu.

## 6. Macierz zdolności (D55)

`research/source-to-model/v35411/results/capability-matrix.md` — dla każdej rodziny (podbitka, podsufitka podcienia,
czoło/pas, słup, belka, rama, loggia, pergola, element ukośny, kolumna innego przekroju, nietypowy uskok): reprezentacja
i jądro, kto ją znajduje w LOCAL i w H (z czego), konsument → element/siatka, materiał, potwierdzenie na zwykłej ścieżce.
Próby przyczynowe na poprawnych wejściach adaptera są nazwanymi istniejącymi testami (słup pod daszkiem, wnęka bez
ścian, pas z podsufitką i powrotem, rama o asymetrycznych nogach). Gdzie leży granica: wykończenie podsufitki i kolumny
okrągłe — reprezentacja; słupy i belki — czytnik (tylko rzuty); elementy ukośne — brak czytnika.

## 7. Kontrola resize/padding dostawcy

`results/provider-resize.md`: H wysyła obrazy o dłuższym boku ≤ 1568 px (`PICTURE_LIMITS.detailLongSidePx`), poniżej
limitu dostawcy, więc nie są skalowane; padding do wielokrotności 28 px na dole/prawej nie przesuwa współrzędnych
liczonych od lewego górnego rogu. Dowód na nagraniu v3.54.10: obrys rzutu sięgający y = 1422 px na obrazie 1568 px.
Reguła mapowania zapisana na wypadek przekroczenia limitu; nie zaimplementowana, bo nic takiego nie jest wysyłane.

## 8. Regresja i testy

- Pełna macierz vitest na finalnym kodzie (`d88f13c` + ten commit, który zmienia tylko research i dokumenty):
  **4251 passed, 15 failed, 11 skipped (4277)**; 15 niepowodzeń to dokładnie zestaw środowiska bazowego z v3.54.10
  (`62350cc`: testy architektury wymagające commitów bazowych, skan rozmiaru, zapisujące badania, ICU/hash
  `local-analyzer`) — żadnego nowego. Typecheck: OK. Android unit (`testDebugUnitTest`): 478, 0 błędów.
  `results/matrix-final.txt`.
- Regresja: nagrania DEV i potwierdzenia (`R-DEV` 6, `R-CNEW` 6 + 2 NOT_SENT jak w v3.54.10, `LAr` 1) odtworzone na
  nowym kodzie — 13 modeli **bajt w bajt takich samych** jak w v3.54.10
  (`results/regression-v35410-vs-v35411.txt`); jedyna zamierzona zmiana to materiał pasa w H Marcówek. Odtworzenia
  HM1…HM4 nagrania live v3.54.10 dają ten sam model (deterministyczne); HM4 = scena 1 APK 1342.
- Nowe testy: `house-v35411.test.ts` (5), `mobile-scene/test/owner-v35411.test.ts` (3), testy listy scen Androida
  przepisane na dostarczony indeks; scorer v1.1 `--self-test`.

## 9. Obrazy (pokazane w odpowiedzi, pliki w paczce prywatnej)

- `elevations.png` — ŹRÓDŁO | H v3.54.10 | LOCAL oddany | H po naprawie, cztery strony, w ramie elewacji źródła;
- `portal-closeup.png` — zbliżenie pasa nad wejściem/garażem, te same cztery kolumny;
- `levels-*.png` — wnętrze każdej kondygnacji (dach zdjęty, cięcie 1,20 m), obok rzutu źródła, z obrysami pomieszczeń
  źródła na czerwono;
- `oblique/AROUND-H-po-naprawie-v35411.png` — widok z góry i cztery ukośne;
- `layers-marcowki.png` — oryginał | pochodna auto | maska ręczna | model A | model B-auto | model B-mask, ta sama
  kamera (rama elewacji).
Wszystkie to rendery desktopowe modeli zapieczętowanych w APK, nie zrzuty ekranu telefonu. H v3.54.8 (scena 4) nie jest
pokazywany jako nowszy.

## 10. Otwarte i stopReason

| problem | stan | stopReason |
|---|---|---|
| UI APK na urządzeniu | niezweryfikowane | brak urządzenia/emulatora w środowisku (`ANDROID_UI_NOT_VERIFIED`) |
| osobne wykończenie spodu/podsufitki pasa (drewno w źródle) | nie zbudowane | granica reprezentacji: jeden materiał na człon `LinearSolid`; wymaga materiału per lico albo osobnego elementu wykończenia — decyzja architektoniczna, nie poprawka |
| ostatnie 0,75 m pasa nad powrotem garażu | jasna krawędź płyty dachu garażu | pas obejmuje 0,82 rozpiętości (odczyt), nie przedłużony z konwencji |
| górne 0,17 m pasa tylnego | jasna krawędź płyty balkonu | `ELEMENT_FINISH_PARTIAL`; płyta ma jeden materiał (jej wierzch to podłoga) |
| rama szczytowa H przeczytana grubiej (0,98 vs 0,82) | otwarte od v3.54.10 | percepcja odczytu API; bez nowego odczytu (0 USD w tym etapie) |
| drewno szczytu frontu i ciemny panel szczytu tyłu w LOCAL | jasne | LOCAL nie czyta tych stref (czytnik); warstwy obrazu nie pomagają |
| słupy z elewacji / zdjęć (ceglany słup Pallas) | nie czytane | LOCAL czyta słupy tylko z rzutów; nowego czytnika nie dodano (poza zakresem) |
| kolumny okrągłe, elementy ukośne | brak | reprezentacja / brak czytnika |
| `libnode.so`, `libbuildapp_node_bridge.so` LOAD 0x1000 | jak w 1340/1341 | nie zmieniane w tym etapie; nazwane |
| generatywny szkic (§7.15) | nie badany | brak narzędzia i zgody na nową usługę |
| nowe przetwarzanie obrazu za flagą | nie wprowadzone | B nie pomaga (rozdz. 5) |

## 11. Uzgodnienie z Master Planem v3.54.11

Master Plan v3.54.11 skopiowany w całości do `docs/MASTER_PLAN.md` (`38592f7`). Odbiór v3.54.11 (§8): (1) APK arm64
z rzeczywistym H v35410 i oddanym LOCAL, podpis/wersja/hashe scen sprawdzone po wyciągnięciu, jawny status UI — tak
(1341, 1342; UI niezweryfikowane); (2) przypisanie i granice materiałów fizycznych elementów, czoło/spód portalu,
konflikt scorera rozstrzygnięty — czoło tak, spód jako jawny brak reprezentacji, scorer v1.1 obok v1; (3) porównanie
LOCAL A/B(/C) na tych samych źródłach z kontrolą zachowania geometrii obrazu, fałszywych dodatków i kosztów — tak
(C nie był potrzebny, rozdz. 5). Zdolność prymitywu, odczyt i efekt w modelu rozdzielone (D55). Podbitka i podpory mają
pomiar albo jawny brak. Historyczne wyniki zapisane; poprawiony scorer nie zalicza naprawy modelu. Brak nowej próby
(nowych domów) ogranicza dowód transferu — wyniki warstw dotyczą czterech rodzin DEV. Generatywny szkic (§7.15) nie
był badany: brak dostępnego narzędzia i zgody na nową usługę.
