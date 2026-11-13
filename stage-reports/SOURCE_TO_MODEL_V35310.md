# BuildPlan v3.53.10 — zasięg rzutu przy licu ściany

Baza: APK 1335 z czystego `961fb1f` (solver 2.40.0, usługa 1.11.0), raport `39da59d`. Wynik: solver **2.41.0**, usługa
**1.11.0** (kontrakt bez zmian), kod `7696777`, APK **1336**. Bez płatnych wywołań (księga 2,72807938 USD, 92 wpisy —
bez zmian), bez H2 i prywatnego benchmarku, ForgeShape tylko do odczytu. Źródła wydawcy, plansze i zrzuty — prywatnie,
poza Gitem. Projekty diagnozy **DEV**: Stellarie, Skalnice 3 (przyczyna), Nigelle 4, Torenie 3 (sąsiednie przyczyny),
Wrotycze (przeniesiony z próby do DEV po pierwszym wyniku, §6). Interfejs Android: **NOT_VERIFIED** (brak urządzenia,
brak `/dev/kvm`).

Protokół (zakres, trzy osobne decyzje, metryki, tolerancje, reguła doboru próby) zapisano prywatnie przed zmianą kodu
(`sha256 53cb6415…` z regułą próby); oczekiwania dla świeżych domów spisano z rzutów i zapieczętowano przed odtworzeniem
(`sha256 eeafef2b…`, 2026-11-13 15:18 UTC).

**Ocena: SLICE — PASS w zakresie DEV (dwa domy z potwierdzoną utratą boku odzyskane, regresja i kontrole bez zmian);
przeniesienie NIE wykazane (świeża próba 16/16 identyczna, bez aktywacji). CAMPAIGN — postęp ograniczony: korpus 64/80 →
66/80 modeli, oba nowe modele to DEV.**

---

## 1. Pierwsza błędna decyzja (DEV, na wejściach bazy)

Ta sama w obu domach — **przed** zalewem, przy wyznaczaniu ramki dowodów:

* **Stellarie.** Linia całkowita `1700` pod rzutem (łańcuch y = 757) ma kreski na 109 i 759 px — lico zewnętrzne ściany
  zachodniej i wschodniej (1700 cm = 650 px w ramce analizy; zgodne z 1010 + 690). Linie pomocnicze przecinają ją na 508,
  540 i 737,5 px (znaczniki QUESTIONABLE). Ostatni odcinek 737,5 → 759 (21,5 px) jest nieodczytany i dużo krótszy od
  odczytanych, więc reguła odcinków końcowych 005I uznała go za „stub” (`TRIMMED_STUB`) i ramka stanęła na 737,5 px —
  na **licu wewnętrznym** ściany wschodniej (pas muru 742–759 px, 17,9 px). Pas wypadł z ramki, komórki skrzydła
  wschodniego (pokoje 9–13) i garażu straciły ścianę, zalew je zabrał: najniższa kondygnacja 88,92 / 188,41 m², odmowa.
* **Skalnice 3.** Łańcuch pionowy y: kreski 199 (TICK), 587 i 593,5 (QUESTIONABLE), 612 (TICK) — `930 + 60 = 990`.
  Oba krótkie końcowe odcinki (6,5 i 18,5 px) obcięte, ramka y1 = 587 zamiast 612; pas ściany południowej 594–612 px
  (19 px) poza ramką; cała południowa połowa domu zewnętrzem, odmowa.
* **Co rozstrzygnięto osobno.** (a) obszar szukania dowodów, (b) położenie zweryfikowanego wymiaru, (c) lico ściany
  wynikowej. Łańcuch **prawidłowo** opisuje lico zewnętrzne (kreska końcowa = lico zewnętrzne pasa w obu domach);
  błąd był w (b): odcinek równy grubości ściany wzięto za kreskę świadka. Skala się nie zmienia (odcinek nie jest
  odczytany i nie wchodzi do rejestracji). Lica brył zbudowanych (`toDrawnWall`, 005Q) nie są przesuwane — N1a bez zmian.
* **Brama Stellarii (osobno).** Brama 5,14 m jest rysowana linią przerywaną, opis `500/225` nie jest odczytany na
  arkuszu 853 px. Po odzyskaniu ściany garaż jest zbudowany, ale dowód bramy jest **niewystarczający**: dotychczasowy
  czytnik otworów emituje okno 5,12 × 0,53 m (parapet 1,29 m) z odczytu elewacji (`VISUAL_INFERRED`). Ściana
  odzyskana ≠ brama odzyskana (§3).

## 2. Zmiana

**Odcinek końcowy równy grubości ściany, na której stoi kreska końcowa, zostaje (`KEPT_WALL_FACE`)** —
`dimensionedAxis`/`endSpanWall` w `plan-decomposition.ts`, solver 2.41.0. Wyłącznie na dowodzie danego boku:

1. zewnętrzna kreska odcinka jest kreską końcową łańcucha (TICK; znacznik wątpliwy niczego nie kończy);
2. wzdłuż tego boku biegnie długi pas muru (≥ 2,5 grubości), którego lico zewnętrzne leży na kresce (± ¼ grubości),
   lico wewnętrzne wewnątrz odcinka, a odcinek nie jest dłuższy niż grubość pasa plus pół ściany — odcinek **jest**
   tą ścianą (taras, stopień, dobudówka czy pas zieleni za ścianą — nie);
3. pas spotyka w narożniku długi mur drugiej orientacji (koniec w obrębie ściany od lica wewnętrznego, w zasięgu
   pasa) — tusz obok rzutu (logo, pasek tytułowy, donica) nie spotyka żadnej ściany domu.

Gdy którykolwiek warunek nie zachodzi, odcinek jest obcinany jak dotąd. Każda decyzja trafia do rekordu (`endSpans`,
z uzasadnieniem). Zmiana dotyczy tylko decyzji (b); obszar dowodów rozszerza się wyłącznie o tę jedną ścianę.

## 3. Dowody na scenie finalnej (DEV)

| | 1335 | v3.53.10 |
|---|---|---|
| **Stellarie** — bok | ramka x 109–737,5 (lico wewn.) | x 109–759 (lico zewn., odchyłka 0 px) |
| odmowa → model | odmowa 88,92 / 188,41 m² | model 188,68 / 188,41 m² (MATCHES), skala MEASURED 0,9994 |
| scena | — | 2 bryły (dom pod dwuspadowym, garaż pod stropodachem), 0 błędów i 0 ostrzeżeń kompilacji, 24 otwory |
| **Skalnice 3** — bok | ramka y 199–587 | y 199–612 (lico zewn., 0 px) |
| odmowa → model | odmowa | model 168,37 / 167,15 m² (MATCHES), skala UNVERIFIED (SUPPORTED, 2,391 cm/px = 1700/711 px) |
| scena | — | 1 bryła, 0 błędów i 0 ostrzeżeń, 18 otworów |

* **Skalnice 3, odzyskana ściana południowa niesie swoje otwory:** okna 2,39 × 1,30 ×2 (opis 240/140 — wysokość
  1,30 wobec 1,40 przyjęta), 1,00 × 1,40 ×2 (opis 100/140), drzwi wejściowe 1,05 × 2,10 w podcieniu; podcień
  wejściowy (105/210) zostaje otwartą wnęką (rekord wnęki, czerwona strona otwarta na planszy). Brak brakującej
  i nadmiarowej podłogi poza wnęką wejściową. Ilości: **LIMITED** z powodem `SCALE_UNVERIFIED` — skala jest spójna
  z łańcuchem 1700, ale żaden drugi wymiar jej nie potwierdza; użytkownik obmiaru dostaje to wprost.
* **Stellarie, ocena sceny gotowej — z wadami:** (1) brama garażu jako okno 5,12 × 0,53 m (parapet 1,29) zamiast
  bramy ~5,00 × 2,25 — opis nieodczytany, linia przerywana nie jest dowodem rodzaju; (2) północne przeszklenie
  `230/250` ×2 z filarem pośrodku jako jedno okno 6,14 × 2,01 (przerwa 5,68 m odczytana jako OPEN_SIDE dla zalewu,
  ściana emituje jeden otwór); (3) otwór 3,48 m w ścianie zachodniej garażu (rodzaj i wysokość `ASSUMED`), którego
  rzut nie pokazuje; (4) garaż zbudowany do lica wewnętrznego ściany wschodniej (x 738 wobec 759, pas 0,55 m) —
  rodzina 005Q, bez przesuwania lica w tym etapie. Pole i obrys zgodne, skala zmierzona, ilości `USABLE_IN_SCOPE`
  **bez powodu** — rekord pomiaru nie mówi o wadach otworów; użytkownik widzi je tylko w rodowodzie otworów
  (`VISUAL_INFERRED`/`ASSUMED` na rodzaju i wysokości). To naruszenie wiarygodności obmiaru otworów jest zapisane jako
  ograniczenie (§10), nie zaliczone jako poprawna scena.
* Plansze przed/po w jednej ramie (prywatnie): `look/stellariach-extent-before-after.png`,
  `look/skalnicach-extent-before-after.png`.

**Rozdzielenie wyników:** odzysk boku 2/2 (DEV); przejście odmowa → model 2/2 (DEV); scena gotowa bez istotnych wad
1/2 (Skalnice 3, ze skalą niepotwierdzoną), Stellarie z wadami otworów (brama, przeszklenie, otwór garażu).

## 4. Sąsiednie przyczyny — pierwszy brak (bez zmiany kodu)

* **Nigelle 4** (SHORT 175,35 / 255,91 m², bez zmian). Ramka z „świadka ścian” (x 377–797,5, y 26,5–830,5); łańcuch
  poziomy odrzucony jako wewnętrzny. **Logo nie jest odrzucane:** litery logo wydawcy u dołu arkusza łączą się ze
  świadkiem w obrębie dwóch ścian od ściany południowej garażu i dają dwie bryły (`mass-1` 512–672 × 791–824,5 px,
  `mass-4` 698–714,5 × 791–824,5 px). Lewe skrzydło (salon 5, ściany cienkie/przeszklone, x 233–385) jest „grupą
  odłączoną” i wypada. Donice przy ścianie wschodniej leżą w ramce jako pas zewnętrza (nie bryła). Pierwszy brak:
  łączenie świadka ścian (ink sąsiadujący ≠ ściana) i ramka bez łańcucha zewnętrznego. Osobny mechanizm — następny etap.
* **Torenie 3** (bez zmian, `35146797b474`). Model zbudowany w 3,9815 cm/px z hipotezy rozstrzygnięcia rzutu wobec
  mocnej metryki 3,128 cm/px (+27,3 % liniowo, +62 % pól). Pokrycie 105,0 / 99,16 m² „MATCHES” jest **artefaktem**:
  zawyżona skala kompensuje ucięty obrys (ramka z łańcucha 145–311 px, odcinek 311 → 334 obcięty; reguła v3.53.10
  się nie aktywuje — brak pasa muru z licem na kresce). Rekord mówi wprost: `SCALE_DEPARTS`, ilości `NOT_USABLE`.
  Nie zaliczony jako model poprawny. Pierwszy brak: wybór skali hipotezy wbrew mocnej metryce — §2 priorytet 2.
* **Renklody 15, Mekintosze** — odmowa na skali, bez zmian.

## 5. Kontrpróby i testy

Nowy plik `extent-wall-face-v35310.test.ts` (9 testów): przyczyna w potoku (odcinek równy ścianie zostaje, ramka do
lica zewnętrznego, pokoje za ścianą zbudowane) — **czerwony na 1335, zielony po zmianie**; bez ścian ten sam odcinek
jest obcinany (zachowanie dawne); kontrpróby zielone: łańcuch prawidłowo zakończony na licu zewnętrznym (bez decyzji),
taras za ścianą (koniec na krawędzi tarasu — obcięty), podcień ze słupków (brak długiego muru — obcięty), cienka
dobudówka (odcinek szerszy niż jej ściana — obcięty), fałszywy pas tuszu obok rzutu (nie spotyka ściany — obcięty),
wątpliwa kreska końcowa (nie jest licem), skala nietknięta (odcinek nieodczytany). Dotychczasowe `end-spans.test.ts`
(12) zielone. Sprzeczna kotwica metryczna: Torenie (wyżej) — rekord nadal mówi SCALE_DEPARTS, nic nie maskuje.

## 6. Świeża próba (zamrożona przed oceną)

**Dobór (reguła zapisana przed pobraniem listy):** lista parterowych pc1073, strony 13–15 (nieużywane), rodziny nieużyte
nigdzie wcześniej (korpus, fr10, próby 3534/3535/3539, indep, DEV, rodziny etapów 005), pierwsze 16 w kolejności strony,
pozyskane raz kodem bazy. Oczekiwania z samych rzutów, zapieczętowane przed odtworzeniem; baza i wariant na tych samych
bajtach. Innego wydawcy w porównywalnym formacie w tej próbie nie było.

| Dom | Baza (1335) | v3.53.10 | Aktywacja |
|---|---|---|---|
| Frizee G2E | MATCHES 214,04 / 214,77 | identyczny | nie |
| Wrotycze E | odmowa 48,36 / 159,28 | identyczna | nie (→ DEV, niżej) |
| Amarantusy 8 | NEAR 187,38 | identyczny | nie |
| Rubensy E | odmowa 73,57 / 151,66 | identyczna | nie |
| Peperomie 4 | MATCHES 185,42 | identyczny | nie |
| Pod Lipką 2 | MATCHES 101,26 | identyczny | nie |
| Kokornak 3 E | NEAR 183,95 | identyczny | nie |
| Marzanki 4 | odmowa 248,40 / 149,26 | identyczna | nie |
| Gale | odmowa 19,76 / 162,62 | identyczna | nie |
| Supertunie 2 E | odmowa (ramka ze świadka) | identyczna | nie |
| Malaxisy E | MATCHES 151,70 | identyczny | nie |
| Gipsówki E | odmowa 104,30 / 164,91 | identyczna | nie |
| Alokazje | odmowa 52,54 / 194,31 | identyczna | nie |
| Rotale G2E | odmowa 162,68 / 203,78 | identyczna | nie |
| Czernice 3 G2E | odmowa 34,12 / 197 | identyczna | nie |
| Tiarelle E | NEAR 135,93 | identyczny | nie |

**16/16 bajt w bajt** (7 modeli, 9 odmów w obu) — stabilność, **bez aktywacji**. Przeniesienia **nie wykazano**;
zakres poprawki ograniczony do potwierdzonej rodziny DEV (linia całkowita z kreską na licu zewnętrznym i linią
pomocniczą na licu wewnętrznym). Pierwszy wynik próby zostaje jak wyżej.

**Wrotycze (przeniesione do DEV po pierwszym wyniku):** ramka x 114,5–681 px wobec linii `1620` ~68–745 px — tracone są
oba boki, ale **inny mechanizm**: oś x ramuje łańcuch **wewnętrzny** (wiersz wymiarów pokoi, y = 574 px), którego końce
stoją na osiach/licach wewnętrznych ścian; linia całkowita `1620` nie jest łańcuchem ramującym (nieodczytana). Reguła
v3.53.10 słusznie milczy (kreska końcowa nie leży na licu zewnętrznym pasa). Rodzina „łańcuch wewnętrzny ramuje oś”
— kandydat na następny etap zasięgu.

Uwaga do próby: 9/16 odmów w bazie to wysoki odsetek dla stron 13–15 (w 3539: 5/14). Przyczyn nie badano w tym etapie
poza Wrotyczami; rozkład (najniższa kondygnacja od 12 % do 166 % pola) wskazuje na kilka mechanizmów zasięgu i skali.

## 7. Regresja

Te same paczki bajtów: korpus 80 (33 + indep 4 + 5 + świeże 10 + ext 8 + próba 20), kontrolne 10 z 1334 (fr10)
i 14 z próby 1335 (t14). Zbiory rozłączne (t14 i fr10 nie należą do 80). Odniesienie: końcowe przebiegi 3.53.9.

| Zbiór | domy | bajt w bajt | odmowa → model | zmienione modele |
|---|---|---|---|---|
| korpus 80 | 80 | 78 | **2** (Stellarie, Skalnice 3 — DEV) | 0 |
| fr10 (1334) | 10 | 10 | 0 | 0 |
| t14 (1335) | 14 | 14 | 0 | 0 |

* Modele korpusu **64/80 → 66/80**, odmowy 16 → 14; aktywacja reguły wyłącznie w tych dwóch domach. Żaden wcześniejszy
  model się nie zmienił — kontrole bajt w bajt: portyk Gaurów 5, wnęka Kalandrynii, podjazd Azolli 7, ściana garaż–dom
  Bakop, bramy Jaskrzyn i Liredów, Anodach (nadal 3 × `OPENING_ABOVE_WALL_TOP` + 3 × `FILL_WITHOUT_OPENING` — liczone
  jako scena z błędami, osobne zadanie wysokości ściany), domy rodziny PIER/005Q w regresji (Dalie 5, Akebie 7)
  bez zmian; przypadki 005Q z audytu v3.53.7 §c (nazwany podest, cienki/niepewny tusz, cienka dobudówka — podgląd
  częściowy) sprawdzają testy usługi i rekonstrukcji w macierzy (§9); N1a zachowane.
* Tabela zamrożona pokoi: 12/12 identycznych, **87/169** (OK 75, OPEN_OK 12, AREA_OFF 14, MERGED 53, MISSING 15).
* Powtarzalność: modele wariantu z przebiegu przerwanego restartem kontenera i z przebiegu końcowego są identyczne
  (Stellarie `12c706f3f20b`, Skalnice 3 `55a85cbab428`).

## 8. Pomiar w wyniku

Znaczenie `measurement` bez zmian (schemat 1.0.0, usługa 1.11.0). Stellarie: MATCHES 1,0014 / MEASURED 0,9994 /
USABLE_IN_SCOPE — rekord nie widzi wad otworów (§3). Skalnice 3: MATCHES 1,0073 / UNVERIFIED / LIMITED
(`SCALE_UNVERIFIED`). Torenie: SCALE_DEPARTS / NOT_USABLE (bez zmian). Żadnego nowego powodu ani progu.

## 9. Testy, typy, kontrakt

* `npm run typecheck` (repozytorium i `apps/web`) na `6a899f1`: bez błędów.
* Macierz pakietów objętych zmianą (`packages/reconstruction`, `packages/analysis-service`, `apps/local-analyzer`
  z Node 18.20.4, `apps/analyzer-api`, `tests/architecture`) na **`7696777`** (kod zmiany): **2364 testy, 2350 zielonych,
  14 czerwonych = 13 znanych z listy bazy** (Larchfield, NFD bez ICU, M10, reference 4 i 7, research-isolation ×4,
  wall-strip 005Q ×4) **+ migawka kontraktu Androida** nieaktualna przez wersję solvera. Migawkę odtworzono z bajtów
  serwera (`capture-android-contract.ts`): zmieniają się wyłącznie `solver` 2.40.0 → 2.41.0 i `candidateHash`; test
  kontraktu 4/4 zielony na **`6a899f1`** (jedyna różnica między rewizjami to pliki migawki). Testy wątków
  `analyzer-api/worker` tym razem zielone w macierzy. Żaden nowy czerwony test.
* Testy usługi i rekonstrukcji pilnujące 005Q/N1a (nazwany podest, cienki/niepewny tusz, cienka dobudówka i podgląd
  częściowy, pierścień) — zielone jak w bazie; cztery czerwone `wall-strip 005Q` to znana lista bazy, bez zmian.

## 10. APK 1336 i przebieg z paczki

* Zbudowany z czystego drzewa `6a899f1` (`./gradlew --offline -PpreviewVersionCode=1336 previewApks`), ten sam podpis.
* `BuildPlan-Model-Preview-1336-arm64-v8a-debug.apk`: 50 705 284 B, SHA-256
  `39d0c8e51b7f8981c1e60ff98c724d4fe7062fb0281e396318926a59cb8bf1f5`; `aapt`: `com.buildplan.preview`, versionCode
  1336, versionName `0.1336.0-owner`, minSdk 26, targetSdk 35; `apksigner`: certyfikat SHA-256 `6e48fac4…ca0da` —
  równy 1335.
* Paczka analizatora z APK: manifest 12/12 plików zgodnych ze skrótami, w niej solver 2.41.0 (z regułą
  `KEPT_WALL_FACE`) i usługa 1.11.0.
* **Host z paczki** — produkcyjny `main.mjs` z APK, Node 18.20.4 z symulacją braku ICU, żywe strony wydawcy:

| Strona | wynik | czas | szczyt RSS | model hosta = powtórka | scena zapisana i wczytana |
|---|---|---|---|---|---|
| Stellarie (poprawiony, DEV) | hello → done COMPLETE, pomiar MATCHES 188,68/188,41, MEASURED 0,9994, USABLE_IN_SCOPE | 411 s | 987 MB | `12c706f3f20b` = `12c706f3f20b` | tak (`loadBundle`, 136 siatek) |
| Gaury 5 (kontrpróba: portyk otwarty) | hello → done COMPLETE, pomiar MATCHES 172,71/176,25, MEASURED, USABLE_IN_SCOPE | 244 s | 844 MB | `d4817e71600c` = `d4817e71600c` (= 1335) | tak (133 siatki) |

* Urządzenie / emulator: brak (`/dev/kvm` niedostępne) — interfejs Androida i przebieg LOCAL na telefonie
  **NOT_VERIFIED**. Wyniki hosta i aplikacji podane osobno: aplikacja nie była uruchomiona.
* APK przekazany prywatnie (poza Gitem).

## 11. Zakres uogólnienia i pozostałe rozbieżności

**Zakres:** jedna reguła geometryczna dla jednego boku, potwierdzona na dwóch domach DEV o różnych układach (oś x,
ściana wschodnia ze skrzydłem i garażem; oś y, ściana południowa z oknami i podcieniem) i dwóch grubościach muru
(17,9 i 19 px). Na 120 innych przebiegach (80 + 10 + 14 + 16) nie aktywuje się wcale — nie przeniesiona na niezależny
dom; deklaracja zakresu: ARCHON, rzut parteru 853 px, linia całkowita z kreską na licu zewnętrznym.

**Największe pozostałe rozbieżności:**
1. **Ramka z łańcucha wewnętrznego albo ze świadka ścian** — Wrotycze (oś z wiersza wymiarów pokoi), Nigelle 4
   (świadek ścian wchłania logo, odcina lewe skrzydło), Supertunie 2 (ramka ze świadka). Najczęstsza przyczyna odmów
   w próbie.
2. **Skala z hipotezy wbrew mocnej metryce** — Torenie 3 (+27 %); Renklody 15, Mekintosze (odmowa na skali).
3. **Otwory na odzyskanej ścianie** — brama Stellarii (linia przerywana, opis nieodczytany → okno 0,53 m), scalone
   przeszklenie północne, fałszywy otwór 3,48 m w garażu; rekord pomiaru tego nie zgłasza.
4. **Lico garażu na licu wewnętrznym** (Stellarie, 0,55 m) — decyzja 005Q, osobna.
5. Bez zmian od 3.53.9: garaż Malwiny, wyloty Ofelii 2 / Layli 2 / Lulo 3, wysokość ściany Anodach, zadaszone naroża.

Dowody prywatne (poza Gitem): `/home/user/rd/v35310` — protokół, zapieczętowane oczekiwania (`trial/expectations.md`),
lista stron 13–15 ze skrótami, przebiegi `reg-b` (104), `trial/rep-base`, `trial/rep-var` (16), sondy DEV `p0`/`p1`,
plansze `look/*`, przebiegi hosta `host1336/*`.
