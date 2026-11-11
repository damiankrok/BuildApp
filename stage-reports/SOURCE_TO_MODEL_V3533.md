# SOURCE-TO-MODEL v3.53.3 — dachy i połączenia brył w analizie lokalnej (raport etapu)

Zlecenie OWNER-a v3.53.3 (2026-11-11). Gałąź `claude/new-session-3kzcgh`, bez merge i PR, commity `[skip ci]`.
Punkt odniesienia: APK 1329 arm64 z kodu `f8cbb1c` (SHA-256 `762ca439…`), HEAD przed etapem `3d7af14`.
**Kod etapu: `d090cf1` (poprawka + testy) i `c5849fd` (wersja solvera 2.35.0). APK 1330 zbudowany z `c5849fd`.**
Żadnego płatnego wywołania; księga bez zmian (2,72807938 USD z 5 USD, 92 wpisy). Bez H2 / prywatnego benchmarku,
bez zmian w ForgeShape, bez obrazów wydawców w repozytorium.

| | stan |
|---|---|
| **Stan wyjściowy (Bakopy G2E, 1329)** | **USTALONY** — dach Bakop zgadza się ze źródłami; błąd „kalenica przybudówki" występuje tylko w ścieżce opisu (§1) |
| **Wybrana rodzina** | pokój, do którego odczyt „wszedł" przez jego własne drzwi balkonowe → dom pocięty na bryłę i płaską przybudówkę obok brakującego narożnika (§2) |
| **Poprawka** | **PASS w zakresie** — ogólna, bez wyjątków po adresie/nazwie; testy przyczyny i 9 kontrprzypadków (§4–§5) |
| **Widoczna poprawa w scenie** | **TAK** — Skalnice (DEV): jedna bryła 16,00 × 9,90 m pod jednym dachem dwuspadowym, jak w rzucie, przekroju i elewacjach; Willa Julia 17: z „brak modelu" na model (§6) |
| **Regresja (33 domy, te same zapieczętowane wejścia)** | 31 identycznych co do skrótu modelu, 2 zmienione (oba na lepsze), 0 pogorszonych |
| **Niezależna próba (9 nowych publicznych domów, pełna analiza od adresu)** | 8 modeli, 1 odmowa; **przed/po identyczne we wszystkich 9** — poprawka ich nie narusza i się w nich nie uaktywnia (§7) |
| **APK 1330** | podpis, wersja, manifest 12/12 **PASS**; pełny przebieg z bundla wyjętego z pliku (produkcyjny launcher, Node 18 bez ICU): Bakopy i Skalnice od `hello` do zapisanej sceny **PASS** (§9) |
| **Android UI** | **NOT_VERIFIED** — brak emulatora (brak `/dev/kvm`) i urządzenia w tym środowisku |
| **CAMPAIGN** | WORK_IN_PROGRESS — następna największa rozbieżność nazwana w §11 |

## 1. Stan wyjściowy: Bakopy G2E na kodzie 1329

Pełna analiza na **zachowanych bajtach** (pamięć podręczna z dostawy 1329; dzisiejsza strona wydawcy daje już inny
skrót pakietu `6d542032…`, więc porównania przed/po biegną na pamięci podręcznej):
`sourcePackageHash b7d5d8d4…`, `modelHash f75f1c5bbcada34c561fe7d71604f36201fe99ee9a5043be5f281ab71e004a84`,
`sceneSha256 a4172e0c…`; 3 bryły, 19 otworów, 163 siatki, 243,8 s.

Co musiało się zgadzać, a co pozostać poprawne (zapisane przed zmianą):

| źródło | model 1329 | zgodność |
|---|---|---|
| przekrój: kalenica +6,28, okap +3,27, 35°, ±0,00, −0,32 | kalenica 6,28, okap 3,27, 35° | TAK |
| rzut: korpus 8,69 × 15,0 m, garaż 6,82 × 6,25 m, skrzydło 6,23 × 8,6 m | te same wymiary | TAK |
| elewacje: garaż pod połacią korpusu, skrzydło z dachem poprzecznym wpiętym w korpus | garaż nakryty dachem korpusu, skrzydło — szczyt poprzeczny | TAK |

Wniosek: **dach Bakop odpowiada źródłom**. Usterka „kalenica dwuspadowej przybudówki na prawie kwadratowym rzucie"
dotyczy wyłącznie ścieżki opisu. Zgodnie ze zleceniem wybrano na podstawie dowodów kolejny istotny błąd geometrii
lokalnej. Pozostałe rozbieżności Bakop (bez zmian w tym etapie): fałszywa płyta „terrace-front" przed skrzydłem, brak
przeszklonego portalu/pergoli przy szczycie skrzydła, brak kominów.

## 2. Jedna rozbieżność prześledzona przez cały przepływ (Skalnice — DEV)

Publiczny dom parterowy. Źródła: rzut — jeden prostokąt 16,00 × 9,90 m (łańcuchy wymiarowe, przerywany obrys dachu);
przekrój — kalenica +6,02, okap +2,59, 30°; elewacje — jeden ciągły dach dwuspadowy.
Model 1329: korpus 12,66 × 9,9 m (dwuspadowy) + „przybudówka" 3,34 × 5,56 m z **płaskim dachem i attyką**, a sypialnia 8
w ogóle niezbudowana („porch or a recess; not built").

| etap | co się stało |
|---|---|
| źródło | drzwi balkonowe sypialni 8 opisane `150/230`; skrzydła i ościeżnica narysowane w świetle otworu |
| rola strony | rzut parteru rozpoznany poprawnie; skala i zasięg poprawne (16,00 × 9,90) |
| odczyt wymiaru | luka między ościeżami **zmierzona 121 cm** (tusz skrzydeł i ramy czytany jako mur); dymek 150 nie „zgadzał się" z żadną luką (tolerancja max(10 cm, 3 %)) — w całym korpusie 657 dymków, 55 związanych, **0** kiedykolwiek wzmocniło lukę |
| **pierwsza błędna decyzja** — dekompozycja rzutu | odcinek muru między drzwiami a narożnikiem jest za krótki na pasmo ściany, więc na liniach siatki tej ściany drzwi czytają się jako „koniec muru"; wypełnienie od zewnątrz wchodzi przez drzwi do pokoju → pokój = teren |
| wiązanie brył | zbudowany obszar ma kształt L → korpus + bryła doklejona (pokoje 9/10) |
| hipoteza dachu | dla bryły doklejonej rodzaj dachu `MISSING` → dach płaski |
| kompilator → scena | wierny model błędnego odczytu: brak narożnika, płaska przybudówka, 2 fantomowe okna na ścianie działowej, „drzwi" 3,53 m w ścianie wspólnej |

Kształt i kierunek a kotwica metryczna: **wysokości były poprawne** przed i po (kalenica, okap, kąt z przekroju).
Błąd leżał wyłącznie w topologii rzutu, nie w skali ani w rejestracji pionowej.

## 3. Hipotezy odrzucone eksperymentem

- **„Drzwi szukane na całej linii siatki"** (zamykanie każdej przerwy między dwoma kawałkami muru na linii): na
  Skalnicach dało jedną bryłę, ale 16 × **9,44** m, z osobnym paskiem 553 × 20 px, 6 zamiast 8 pokoi i 17 zamiast 22
  otworów; przesunęło też komórki w Balsamowcach i Daliach. Przyczyna: odczyt pasm nie odróżnia tu ościeża od
  przekroju ściany poprzecznej, więc „drzwi" powstawały w poprzek kuchni. **Odrzucona i wycofana.**
- **Dołączenie pokoju istniejącą ścieżką domknięć (`BOX_COMPLETION`)**: pokój przyjęty, ale jako trzecia bryła z
  płaskim dachem, a korpus skrócony do 8,96 m (ta ścieżka z założenia nie przelicza brył). **Odrzucona.**

## 4. Zmiana (`d090cf1`, `c5849fd`)

Wspólny model semantyczny, stabilne identyfikatory i droga do sceny bez zmian; żadnej reguły po adresie ani nazwie.

1. `boundary-evidence.ts` — dymek wymiarowy zgadza się z luką **między dwiema ścianami**, która mierzy mniej niż
   wydrukowano, o nie więcej niż tusz skrzydła i ramy przy ościeżach (dwie grubości ściany, `CALLOUT_JAMB_INK_WALLS`).
   Zgodność dokładna ma pierwszeństwo; ten sam otwór czytany na obu licach ściany dostaje dymek na obu liniach; pewny
   pierwszy odczyt (≥ 0,9) rozstrzyga, choć obok wypisano słabsze kandydatury kraty; odczyt niepewny nadal tylko
   potwierdza. Dwa różne otwory pasujące jednakowo → żaden.
2. `boundary-completion.ts` — część wewnątrz obrysu, do której dom ma tylko drzwi, jest **pokojem**, a nie „podwórzem
   za ścianą", gdy ma **własny** otwór między ościeżami murowanymi poparty rysunkiem mocno: przeszklenie albo skrzydło
   nazwane dymkiem (plus dotychczasowe bramki: wejście ≥ 0,7 m, ≥ 50 % obwodu to ściana, < 10 % słupów, w zasięgu, nie
   większa niż połowa domu). Wynik to `QUESTION` z listą tych otworów — nigdy doklejenie do brył wyciętych bez niej.
3. `plan-decomposition.ts` — rzut jest czytany **drugi raz** z tymi otworami zamkniętymi (`rereadEnclosedRooms`);
   drugi odczyt jest brany tylko wtedy, gdy buduje co najmniej połowę pokoju i **nie traci żadnej komórki**
   zbudowanej w pierwszym. W przeciwnym razie zostaje pierwszy odczyt, a zapis mówi, że pokoju nie zbudowano.
4. Proweniencja: `boundary.enclosedRooms` (prostokąt, pole, otwory z identyfikatorem luki i wartością dymka, wynik,
   uzasadnienie) w diagnostyce rzutu; `reread` przy części; odczyt z zamkniętymi otworami ma własny identyfikator.
   `BOUNDARY_EVIDENCE_VERSION 1.3.0`, `SOLVER_V2_VERSION 2.35.0`.

## 5. Testy przyczyny i kontrprzypadki

`packages/reconstruction/test/enclosed-room-v3533.test.ts` (23) i `enclosed-room-plan-v3533.test.ts` (5, rzut
narysowany w kodzie — nie rysunek żadnego realnego domu):

- przyczyna: sam odczyt pudełkowy wchodzi przez drzwi i zostawia pokój jako teren; z poprawką pokój i cały dom są
  zbudowane, bez nadpisania obrysu i bez osobnej bryły; wynik deterministyczny;
- kontrprzypadki: brak dymka nad drzwiami → odrzucenie jak dotąd; część większa niż połowa domu; podwórze bez własnego
  otworu; skrzydło bez dymka; nazwana luka pozostawiona jako słaba; ościeże słupowe (wiata); własne drzwi domu jako
  jedyny otwór; brak wejścia z domu; luka szersza niż wydruk; naddatek większy niż dwie ściany; dwa równorzędne
  otwory; odczyt niepewny; alternatywa pasująca tam, gdzie pierwszy odczyt nie pasuje.

## 6. Baza i zmiana na tych samych wejściach (33 domy, powtórka solvera na zapieczętowanej ekstrakcji)

**31 identycznych** (skrót modelu), **2 zmienione**, 0 nowych błędów kompilacji, 0 utraconych modeli.

**Skalnice (DEV)** — model `9a0eebbf…` → `9b66eacb…`:

| | przed | po | źródło |
|---|---|---|---|
| bryły | korpus + przybudówka | **jedna** | jeden prostokąt |
| dach | dwuspadowy 12,66 × 9,9 + **płaski** 3,34 × 5,56 | **dwuspadowy 16,00 × 9,90** | dwuspadowy, 16,00 × 9,90 |
| kalenica / okap / kąt | 6,02 / 2,59 / 30° | bez zmian | +6,02 / +2,59 / 30° |
| stropy | 143,9 m² | 158,4 m² | 16,00 × 9,90 = 158,4 m² |
| pokoje / ściany | 8 / 15 | 9 / 16 | — |
| otwory | 22 | 19 | — |

Otwory na zmienionych płaszczyznach: zniknęły 2 fantomowe okna z dawnej „ściany wschodniej" (to ściana działowa),
„drzwi" 0,74 m i 3,53 m w ścianie wspólnej oraz 2 błędne okna tylnej ściany przybudówki; doszły drzwi balkonowe
1,50 × 2,30 m sypialni 8 (źródło `150/230`) i 2 drzwi wewnętrzne; okno frontowe 2,00 → 2,40 × 1,40 m (źródło
`240/140`). Garażu ten dom nie ma. Kolizji i szczelin na stykach brak (jedna bryła). Utraconych obserwacji i miar brak.
Zgodność z geometrią: obrys, dach, wysokości i otwory tylnej elewacji — TAK; nadal brak kominów i wnęki wejściowej
jako cechy elewacji.

**Willa Julia 17** — przed: `NO_MODEL` (`PLAN_NO_WALLED_ENVELOPE`, 39 innych odczytów odrzuconych); po: model
`cc4bd369…` (skutek wiązania dymków). Utworzenie sceny: TAK. Zgodność: bryła piętrowa, dach kopertowy 22°, okap +5,66,
kalenica +8,00, balkon z balustradą nad przeszkleniem tarasu — zgodne z przekrojem i elewacją tylną; układ okien
elewacji frontowej i bocznych **niezgodny** (przypisanie stron). To model do obejrzenia, nie model zaakceptowany.

**Muraje** — kandydat na pokój 4,7 m² z własnym nazwanym otworem; drugi odczyt go nie zbudował → pierwszy odczyt stoi,
model bajtowo bez zmian, pozycja zostaje pytaniem w zapisie.

**Bakopy G2E** — `f75f1c5b…` przed i po: bez zmian (dach, garaż, skrzydło jak w §1).

W korpusie: rekordy luk z dymkiem 55 → 233, z tego 36 wzmocnionych do „otwór" przez dymek z narysowanym wypełnieniem.

## 7. Niezależna próba (po zamrożeniu poprawki)

Pełna analiza od adresu strony (pobranie → odczyt → solver) dziewięciu publicznych projektów ARCHON nieużywanych
wcześniej; potem powtórka solvera na tych samych zapieczętowanych wejściach kodem bazowym `3d7af14`.

| projekt | wynik | dach w modelu | czas | przed/po |
|---|---|---|---|---|
| Dom w litodorach | MODEL | kopertowy + **płaska** część | 249 s | identyczny |
| Dom w przebiśniegach 27 (E) | MODEL | dwuspadowy + **płaska** część | 239 s | identyczny |
| Dom w czosnkach 4 (E) | MODEL | dwuspadowy | 223 s | identyczny |
| Dom w roselinach 2 (GE) | MODEL | dwuspadowy | 303 s | identyczny |
| Dom w kruszczykach 14 | MODEL | dwuspadowy | 249 s | identyczny |
| Dom w kruszczykach 22 | MODEL | dwuspadowy | 204 s | identyczny |
| Dom w kosaćcach 44 | MODEL | dwuspadowy | 234 s | identyczny |
| Dom w bakopach 5 (E) | MODEL | dwuspadowy + **płaska** część | 270 s | identyczny |
| Dom w skalnicach 3 (ta sama rodzina co DEV, inny arkusz) | **NO_MODEL** — `PLAN_RESOLUTION_INCONCLUSIVE` | — | 194 s | identyczny |

Wynik opisany uczciwie: **poprawka nie zmienia żadnego z 9 domów** — niczego nie psuje, ale też jej przyczyna w nich
nie występuje (w 42 domach łącznie: 1 dom naprawiony przez drugi odczyt, 1 odblokowany przez dymki, 1 kandydat
niezbudowany). Przeniesienie reguły pokoju na niezależny dom **nie zostało zaobserwowane**; dowodem ogólności są
testy na rzucie narysowanym w kodzie i brak zmian w 40 pozostałych domach.

## 8. Weryfikacja

- `packages/reconstruction`, `apps/local-analyzer`, `tests/architecture`, `packages/analysis-service` na `c5849fd`:
  182 pliki, **2145 testów: 2132 pass, 13 fail**. 13 błędów ma te same nazwy co w bazie (Larchfield — skróty sceny;
  NFD bez ICU; compound-facade „frozen set"; 2 × reference; 4 × research-isolation; 4 × wall-strip) — **0 nowych**.
  `packages/source-metrics` (na `d090cf1`, razem z `analysis-service`): 621/621. Typecheck czysty.
- Testy startu analizatora na **Node 18.20.4** (`LOCAL_ANALYZER_NODE18`) z symulacją braku ICU: MATCH (Larchfield i
  Holloway skrót w skrót z desktopem); kontrprzypadek ścisłego `TextDecoder` i launcher z kodem 4 — pass.
- Parzystość OCR i podgląd źródeł: `source-parity` (2), `SHAPE-LIVE-01`, autotest OCR w bundlu — pass.
- Testy JVM Androida nie były powtarzane: w tym etapie nie zmienił się żaden plik Kotlin ani kontrakt wyniku.

## 9. APK 1330

`-PpreviewVersionCode=1330`, kod `c5849fd`, ten sam keystore i certyfikat `6e48fac4…` (aktualizacja na miejscu).

| plik | SHA-256 |
|---|---|
| `BuildPlan-Model-Preview-arm64-v8a-debug.apk` | `26b71fca64d891d4c9b4f20b4be6fe56e226b3da771ac29fce77c959f55972de` |
| `BuildPlan-Model-Preview-x86_64-debug.apk` | `dc38c13b3074b87960f40fd814e764cbd3bc9f90f9cdc7116e0e92919bd98c0f` |
| `BuildPlan-Model-Preview-universal-debug.apk` | `b1bfdb07f13d22dd27366a87b2ba403f194503dc50d61a557a4a714b80eef95d` |
| `BuildPlan-Model-Preview-armeabi-v7a-debug.apk` | `04c569bbb6308bf71db22c9f66d1badf3f11949b0f865e987279582ae579ff17` |

arm64: `com.buildplan.preview`, versionCode 1330, versionName `0.1330.0-owner`, podpis v2, 1 podpisujący, certyfikat
SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da`, ABI `arm64-v8a`.
`assets/local-analyzer/manifest.json`: **12/12 zgodnych co do bajtu i SHA-256**, brak plików spoza manifestu;
`analyzer.mjs` `3299471308589d582a0e03bf533b3bef49e239fcf9a60991bb23a890dae5e0e3` (3 440 694 B),
`main.mjs` `f8bccb1c513390feb8a908f53510908fe578ea132254e9a1ebcdd3b2064cc52f` (bez zmian od 1329).

**Pełny przebieg z bundla wyjętego z tego pliku** — produkcyjny `main.mjs`, Node 18.20.4 x86-64 Linux + symulacja
braku ICU, strona wydawcy na żywo, od `hello` do zapisanej sceny:

| dom | zdarzenia | wynik | czas | szczyt RSS | scena |
|---|---|---|---|---|---|
| Bakopy G2E | `hello` → 62 progress, 114 source, 309 telemetry → `done`; exit 0, stderr pusty | model, 163 siatki | **330 s** (1329: 416 s) | **1,03 GB** (1329: ok. 1 GB) | `sceneSha256 6a1798e36bab15ed6818a237aa14ba65ce322bcdc68a4165a97632464a97b058`, 443 874 B — **bajtowo ta sama scena co z 1329** |
| Skalnice | `hello` → 59 progress, 110 source, 233 telemetry → `done`; exit 0, stderr pusty | model `9b66eacb…` (ten sam co w regresji), 1 dach dwuspadowy, 19 otworów, 102 siatki | 244 s | 1,05 GB | `sceneSha256 3452743e9cb83f57130f7012f1322e1eff8bbd7ee6ce0e0e4b8c339fbc7274d3`, 287 917 B |

`hello` podaje `node v18.20.4`, `text: embedded-tables`, `collatorLocale: none (no Intl)`, `solver 2.35.0`. Obie sceny
wczytują się (`loadBundle`). Czas i pamięć: te same warunki co próba 1329 (ten sam host, Node, symulacja, strona na
żywo), ale przebieg 1330 biegł bez równoległego obciążenia — różnicy 416 → 330 s nie przypisuję kodowi. Drugi odczyt
rzutu uruchamia się tylko przy kandydacie na pokój (2 z 42 domów); na Skalnicach cała powtórka solvera trwała 17 s
(baza: 19 s).

To nie jest próba w aplikacji: JNI, proces `:analyzer` i przeglądarka 3D nie brały w niej udziału.

## 10. Zdarzenie w trakcie etapu (bez wpływu na wynik)

Przy zwalnianiu miejsca na dysku usunąłem katalog roboczy z zamkniętego etapu, w którym leżała też pamięć podręczna
źródeł ośmiu pierwszych domów DEV. Powtórki tych domów dały wtedy `PLAN_NOT_DECODABLE` — to nie była regresja kodu.
Pamięć odtworzyłem z publicznych stron, sprawdzając każdy plik względem skrótu z zapieczętowanego pakietu: 260 z 267
plików ma identyczne bajty (7 wariantów jednego domu jest dziś niedostępnych u wydawcy); wszystkie 8 domów odtwarza
skróty modeli bazy. Poza tym usunięte zostały tylko dawne wyniki robocze i kopia rewizji odtwarzalna z gita.

## 11. Następna największa rozbieżność w finalnej scenie

**Część domu pod wspólnym dachem modelowana jako przybudówka z płaskim dachem.** Gdy rzut dzieli się na korpus i
bryłę doklejoną, a rodzaj dachu nad nią jest `MISSING`, model kładzie tam płaski dach z attyką. W niezależnej próbie
dotyczy to 3 z 8 modeli (Litodory, Przebiśniegi 27, Bakopy 5), w korpusie ok. 10 z 33 domów. Przykład Litodory:
źródła pokazują **jeden dach kopertowy** nad pełnym prostokątem 15,50 × 12,00 m (skrzydło z pokojami 7–8 i zadaszony
taras na słupie w narożniku), model — kopertę nad 15,50 × 9,13 m i płaski klocek 8,59 × 2,87 m. Dowód w źródle jest
dostępny: łańcuch wymiarowy całości i przerywany obrys dachu.

**Jedna następna akcja:** OWNER instaluje APK 1330 i uruchamia „Analiza na tym telefonie" na Skalnicach
(`https://www.archon.pl/projekty-domow/projekt-dom-w-skalnicach-m91a28365299b4`) — oczekiwany jeden dom pod jednym
dachem dwuspadowym, w proweniencji „solver 2.35.0". Następny etap kodu: dach bryły doklejonej z obrysu dachu i
łańcucha całości (Litodory jako DEV).
