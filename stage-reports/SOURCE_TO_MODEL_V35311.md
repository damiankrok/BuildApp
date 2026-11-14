# BuildPlan v3.53.11 — pełny obrys domu, grafika arkusza i próba API

Baza: APK 1336 z czystego `6a899f1` (solver 2.41.0, usługa 1.11.0), raport `1e41324`. Wynik: solver **2.42.0**,
usługa **1.11.0** (kontrakt bez zmian poza wersją solvera), kod `0b93b88`, APK **1337** (§10). Bez płatnych wywołań
(księga 2,72807938 USD, 92 wpisy — bez zmian), bez H2 i prywatnego benchmarku, ForgeShape tylko do odczytu. Źródła
wydawcy, plansze i paczka dla właściciela — prywatnie, poza Gitem. Projekty diagnozy **DEV**: Nigelle 4 G2, Wrotycze E,
Supertunie 2 E. Interfejs Android: **NOT_VERIFIED** (brak urządzenia, brak `/dev/kvm`).

Protokół (zakres, trzy rozdzielone decyzje, kontrolki, reguła doboru próby) zapisano prywatnie przed zmianą kodu
(`sha256 46a02f4e…`); oczekiwania dla świeżej próby spisano z samych rzutów i zapieczętowano przed odtworzeniem
(`sha256 d94af4df…`, 2026-11-14 02:42:04 UTC); lista stron 16–18 pobrana raz i zahashowana.

**Ocena (rozdzielnie):**
* **SLICE (poprawa lokalna) — PASS w zakresie DEV dla 1 z 3 domów:** Nigelle 4 ma pełny obrys (zachodnie skrzydło
  zbudowane, logo i pas zieleni usunięte, podjazd i tarasy otwarte), regresja 119/120 bajt w bajt, kontrolki bez zmian.
  Wrotycze i Supertunie 2 — inne mechanizmy, **nie naprawione**. Przeniesienie **NIE wykazane** (świeża próba 12/12
  identyczna, bez aktywacji). „Model się otworzył i ma cały obrys" ≠ „wierny dom": wady Nigelle wymienione w §3.
* **Próba API — NIE ZMIERZONA:** brak sekretu i uzgodnionego rozliczenia; przygotowane payloady, odtworzenia, szacunek
  i jedna komenda na hosta (§8). Warianty B i C nie zmierzone, D niedostępny.
* **CAMPAIGN — bez postępu w liczbie modeli:** korpus 66/80 modeli, 14 odmów (bez zmian; Nigelle była już modelem);
  tabela pokoi 87/169 → **96/169**.

---

## 1. Dysk i ciągłość

* Zapis przekazania (prywatny, `/home/user/rd/v35311/HANDOFF.md`): HEAD, APK, ścieżki dowodów, manifest zachowanych
  wejść (`sealed-inputs.sha256`), następny krok; uzupełniony stanem końcowym.
* Usunięte stare, udokumentowane i odtwarzalne artefakty robocze — **3073 MB** (lista z rozmiarami i sposobem
  odtworzenia w `deleted.txt`): katalog budowy Androida (1008 MB, odtwarzalny z drzewa), stare przekazania 1334/1335
  (APK 1336 i jego dowody zostają), rozpakowane paczki APK 1333/1336, przebiegi pośrednie `reg-h`, `reg-f`, `e4`, `f3`,
  `g3*`, `final/trace`. Zachowane: zapieczętowane wejścia regresji, bajty źródeł niedostępnych ponownie, odniesienia,
  pierwsze ślepe wyniki, bieżący podpis i wydany APK, dowody przekazań, księga, niezatwierdzone zmiany. Po sprzątaniu
  ~4,9 GB wolne.

## 2. Pierwsza błędna decyzja (DEV, na wejściach bazy) — trzy decyzje osobno

Rozdzielono: (1) wybór łańcucha zewnętrznego / zasięg zastępczy, (2) klasyfikację pasm rysunku (ściana vs logo /
podjazd / grafika), (3) łączenie dowodów w ciągły obrys. Wszystkie trzy domy mają **różne** pierwsze braki.

* **Nigelle 4 G2.** Rzut 853 px oryginalny (wariant 550 px nie ma opisów; wariant wektorowy nie istnieje na stronie).
  Linie całkowite pod rzutem (y = 760 i 791 px, kreski 233 … 642,5/644 px, opisy `474`, `926`, `1400` nieodczytane)
  oraz odczytany pionowy łańcuch całkowity `2180` (y 48,5 → 700,5 px).
  Sprawdzenie: `474 + 926 = 1400` cm; 409,5 px × 3,4205 cm/px = 1400,7 cm; 652 px × 3,3436 cm/px = 2180 cm — oba
  wymiary całkowite zgodne z rejestracją strony.
  - (3) **łączenie — pierwsza błędna decyzja:** świadek ścian (największa grupa pasm grubości ściany łączonych
    w obrębie dwóch ścian) wchłonął litery logo wydawcy u dołu arkusza i niskie murki podjazdu biegnące za bramą
    garażu; świadek sięgnął y 830,5 px.
  - (1) wobec takiego świadka linie całkowite pod rzutem „spotkały ściany" po obu stronach i zostały ocenione jako
    linie przez pokój (INTERIOR); ramka poszła ze świadka (x 377–797,5, y 26,5–830,5, `WALL_GEOMETRY_EXTENT` na obu
    osiach). Odczytany `2180` mówił, że dom kończy się na y 700,5 — nikt tego nie zapytał.
  - (2) skutki: logo → dwie bryły (`mass-1` 512–672 × 791–824,5 px, `mass-4` 698,5–714,5 × 791–824,5), pas donic przy
    ścianie wschodniej → bryła (`mass-2` 645,5–698,5 × 446–509,5); zachodnie skrzydło (salon 5, kuchnia 3, x 233–385,
    ściany cieńsze i przeszklone) poza ramką → brak. Wynik 1336: SHORT 175,35 / 255,91 m², 4 bryły.
* **Wrotycze E.** (1) linia `1620` (~68–745 px) **nie jest wykrywana jako łańcuch**; oś x ramuje wiersz wymiarów
  pokoi (y = 574 px, 114,5–681) — łańcuch wewnętrzny, którego końce stoją na licach wewnętrznych. Nowa reguła
  słusznie milczy (brak w pełni odczytanej linii całkowitej). Pierwszy brak: detekcja linii całkowitej. Bez zmiany.
* **Supertunie 2 E.** Obszar dowodów sięga pod logo (y 825,8 px), ale bryły kończą się na domu — logo nie jest
  budowane, dekompozycja jest poprawna. Odmowa wynika ze **skali**: pionowy wymiar `1350` odczytany jako `1150`
  (głos strony 1,91 vs niezależne 2,24 cm/px; +18,7 %). Pierwszy brak: OCR/skala. Bez zmiany. (Wcześniejsze
  sformułowanie w v3.53.10 „ramka ze świadka" było nieprecyzyjne — ramka nie odcina domu.)

## 3. Zmiana i scena finalna

**Ramka, którą mówi w pełni odczytana linia całkowita, gdy świadek ścian biegnie dalej** (`statedFrameOverWitness`
w `plan-decomposition.ts`, solver 2.42.0). Działa wyłącznie, gdy ramka odczytana spoczywa na `WALL_GEOMETRY_EXTENT`:

1. łańcuch w pełni odczytany (każdy segment `READ`/`CHAIN_CORRECTED`), zewnętrzny wobec świadka, rozpięty na ≥ 75 %
   świadka na swojej osi; świadek wystaje poza jego kreski o więcej niż dwie ściany;
2. tusz poza kreskami (± ściana) jest odcinany od świadka; role łańcuchów drugiej osi ocenia się na przyciętym
   świadku; musi istnieć łańcuch zewnętrzny drugiej osi narysowany **poza** podanym końcem i nie zewnętrzny wobec
   pełnego świadka (inaczej prawdziwe skrzydło za wymiarem korpusu zostałoby obcięte);
3. ramka = odczytany łańcuch na jego osi i kreski łańcucha zewnętrznego na drugiej; bok przesuwa się **tylko na
   zewnątrz**, do lica zewnętrznego długiego pasa muru, w który wpada kreska (`EXTERIOR_CHAIN_TICKS` /
   `DIMENSION_CHAIN_EXTENT`, uzasadnienie w rekordzie).

Bez nazw domów, położeń logo i wyjątków wydawcy; bez stałego filtra „utnij dół". Znak wodny nachodzący na ścianę nie
jest usuwany — reguła nie klasyfikuje tuszu, tylko przycina świadka do zasięgu podanego wymiarem. 005I z 1336, N1a
i niezależna kotwica skali nietknięte (rejestracja nie zmienia się: 6 kotwic, rms 0,0113 m).

Pierwsza wersja była za szeroka (Bakopy i Marcówki zmieniały ramkę, Willa Julia 17 model → odmowa przez zmianę kopii
rzutu); ograniczenie do ramek na `WALL_GEOMETRY_EXTENT` i warunek linii drugiej osi przywróciły wszystkie kontrolki
bajt w bajt.

| Nigelle 4 G2 | 1336 | v3.53.11 |
|---|---|---|
| ramka | x 377–797,5, y 26,5–830,5 (świadek) | x 233–652, y 48,5–700,5 (`EXTERIOR_CHAIN_TICKS` / `DIMENSION_CHAIN_EXTENT`) |
| pokrycie | SHORT 175,35 / 255,91 m² | NEAR 237,58 / 255,91 m² (−7,2 %) |
| skala | MEASURED 1,02298 | MEASURED 1,02298 (bez zmian) |
| ilości | LIMITED (`COVERAGE_SHORT`, `READING_PARTIAL`) | LIMITED (`COVERAGE_NEAR`) |
| bryły | 4 (w tym logo, pas donic) | 3 (korpus, skrzydło sypialni, garaż) |
| kompilacja | 0 błędów, 0 ostrzeżeń, 32 otwory | 0 błędów, 0 ostrzeżeń, 30 otworów |
| model | `0bb1fcbd8769` | `06e8d1ff0582` |

* **Zbudowane:** zachodnie skrzydło — salon + jadalnia 5, kuchnia 3, hol 2, korytarz 15 (jedna otwarta strefa
  OPEN_OK, jak na rzucie), spiżarnia 4, łazienka 7, garderoba 8, pokój 9; garaż ze stroną bramy (brama 5,13 × 2,20,
  `SOURCE_DERIVED`).
* **Zniknęło:** dwie bryły logo, bryła pasa donic. **Otwarte:** przedpole garażu (podjazd), taras SW, zadaszony taras
  NW (wnęka otwarta).
* **Tabela pokoi domu:** MISSING 8 → 0, OK 3 → 8, OPEN_OK 0 → 4, MERGED 5 → 2, AREA_OFF 1 → 3, nadmiarowe 6 → 0.
* **Pozostałe błędy (jawne, nie zaliczone):** garaż −11,0 % pow. (32,13 / 36,11), toaleta 6 −37 % (1,29 / 2,04),
  pokój 9 −10,5 %; wiatrołap 1 scalony z kotłownią 16; pokrycie −7,2 % (NEAR); okna z wysokością `ASSUMED` 1,30 m,
  szerokie przeszklenia salonu `VISUAL_INFERRED` (2,63 × 2,85, 4,20 × 2,30, 2,58 × 2,03); ilości LIMITED. Nowe
  błędy względem 1336: żadne poza tym, że pokoje 6 i 9 są teraz zbudowane (wcześniej brak / scalenie) z odchyłką pola.
* Plansze ŹRÓDŁO/PRZED/PO (rzut i obrys w tych samych pikselach, identyczny kadr 3D pod spodem, zoomy: lewe skrzydło,
  garaż, dolne logo) — w paczce prywatnej.

## 4. Testy przyczyny i kontrpróby

Nowy plik `packages/reconstruction/test/stated-frame-v35311.test.ts` (7 testów, fikstura rysowana w teście):
przyczyna (murki podjazdu i logo pod rzutem zostają poza ramką, dom zbudowany, logo i podjazd nie są bryłą) —
**czerwony na 1336, zielony po zmianie**; kontrpróby zielone: brak tuszu za linią (ramka jak dotąd), łańcuch pokoju
nierozpięty na budynku, łańcuch z nieodczytanym segmentem, kreska wewnątrz pasa muru (bok na lico zewnętrzne, tylko
na zewnątrz), brak linii zewnętrznej drugiej osi, prawdziwe skrzydło za wymiarem korpusu (nic nie jest cięte).
Kontrolki z protokołu na prawdziwych arkuszach (bajt w bajt, §6): logo tuż pod rzutem (Supertunie 2 — obszar
dowodów sięga pod logo, nic tam nie jest budowane), ukośny znak wodny wydawcy nachodzący na ściany (każdy arkusz
ARCHON w regresji), inna grafika obok rzutu (Marcówki), cienka ściana z przeszkleniem (Stellarie), prawdziwy otwarty
portyk (Gaury 5), taras i podjazd (Azolle 7), mylący łańcuch wewnętrzny (Wrotycze), poprawny łańcuch zewnętrzny
(pozostałe modele korpusu). Dotychczasowe
`extent-wall-face-v35310.test.ts` i `end-spans.test.ts` zielone.

## 5. Świeża próba (zamrożona przed oceną)

Reguła doboru zapisana przed pobraniem listy: lista parterowych pc1073, strony 16–18 (nieużywane), rodziny nieużyte
nigdzie wcześniej, pierwsze 12 w kolejności strony, pozyskane raz kodem bazy; oczekiwania z samych rzutów,
zapieczętowane; baza i wariant na tych samych bajtach.

| Dom | Baza (1336) | v3.53.11 | Aktywacja |
|---|---|---|---|
| Goldstary 2 | odmowa 30,65 / 147,01 | identyczna | nie |
| Bazylie 5 | odmowa 3,73 / 165,04 | identyczna | nie |
| Pod Krzewuszką 2 G2E | odmowa 86,65 / 196,68 | identyczna | nie |
| Nad Rzeczką 2 E | odmowa (skala) | identyczna | nie |
| Stelle G2 | MATCHES 189,67 / 200,86 | identyczny | nie |
| Perowskie E | NEAR 160,70 / 173,69 | identyczny | nie |
| Kliwie 10 G2 | odmowa (obrys B_STRICT) | identyczna | nie |
| Pod Jodłami 5 E | MATCHES 180,00 / 180,58 | identyczny | nie |
| Plumerie 2 | odmowa 17,17 / 112,93 | identyczna | nie |
| Kruszyny | NEAR 174,90 / 150,18 (nadmiar +16,5 %, nie badano) | identyczny | nie |
| Itea G2 | MATCHES 243,23 / 237,39 | identyczny | nie |
| Modrzewie 7 G2E | MATCHES 200,10 / 209,08 | identyczny | nie |

**12/12 bajt w bajt** (6 modeli, 6 odmów) — stabilność, **bez aktywacji**: przeniesienia nie wykazano. Pierwszy wynik
próby zostaje jak wyżej. Odmowy próby mają co najmniej trzy różne przyczyny (pokrycie najniższej kondygnacji 2–59 %,
skala, obrys); nie badano ich w tym etapie.

## 6. Regresja

Te same paczki bajtów, obie rewizje (1336 = `6a899f1`, v3.53.11 = `0b93b88`):

| Zbiór | domy | bajt w bajt | modele 1336 → po | odmowy | zmienione |
|---|---|---|---|---|---|
| korpus 80 (33 + indep 9 + świeże 10 + ext 8 + próba 20) | 80 | 79 | 66 → 66 | 14 → 14 | Nigelle 4 (SHORT → NEAR) |
| fr10 (1334) | 10 | 10 | 9 → 9 | 1 | — |
| t14 (1335) | 14 | 14 | 9 → 9 | 5 | — |
| t16 (próba 1336, z Wrotyczami i Supertuniami) | 16 | 16 | 7 → 7 | 9 | — |
| inni wydawcy (anylink, osobna grupa) | 18 | 18 | — | — | — |
| świeża próba t12 | 12 | 12 | 6 → 6 | 6 | — |

* Razem 120 + 18 + 12: jedyna zmiana to Nigelle 4. Brakujący / nadmiarowy obrys, odchyłki lic, skala, strefy otwarte,
  otwory, błędy kompilacji i odmowy — identyczne we wszystkich pozostałych przebiegach (porównanie hashy modelu
  i rekordów pomiaru).
* Kontrolki bajt w bajt: Gaury 5 (portyk), Azolle 7 (podjazd), Bakopy (ściana garaż–dom), Jaskrzyny i Liredy (bramy),
  Stellarie i Skalnice 3 (boki odzyskane w 1336), Torenie 3 (`SCALE_DEPARTS`, `NOT_USABLE` — fałszywa skala, nie
  zaliczona), Stellarie/Anodach (znane wady otworów: nadal 3 × `OPENING_ABOVE_WALL_TOP` + 3 × `FILL_WITHOUT_OPENING`
  w Anodach). Podgląd częściowy 005Q — testy usługi w macierzy (§9).
* Tabela zamrożona pokoi (12 domów): 11 identycznych, Nigelle 4 IMPROVED; **87/169 → 96/169** (OK 75 → 80,
  OPEN_OK 12 → 16, AREA_OFF 14 → 16, MERGED 53 → 50, MISSING 15 → 7).

## 7. Pomiar w wyniku

Znaczenie `measurement` bez zmian (schemat 1.0.0, usługa 1.11.0). Nigelle 4: NEAR / MEASURED 1,02298 / LIMITED
(`COVERAGE_NEAR`). Żadnego nowego powodu ani progu.

## 8. Próba API — przygotowana, nie uruchomiona

* **Warunki płatnego wywołania nie spełnione:** brak klucza w bezpiecznym formularzu sekretów, rozliczenie nie
  uzgodnione (księga: limit 5 USD od E12, 2,72807938 USD, 92 wpisy, billing UNCONFIRMED — punkt wyjścia do
  uzgodnienia, nie nowe saldo). Ujawnionego klucza, H2, prywatnego benchmarku ani prób na projektach kontrolnych nie
  użyto. Pomoc API w APK nieaktywna, bez nowego hostingu.
* **Warianty:** A (lokalna baza/kandydat) = wyniki §3; **B** (oryginał + pytania) i **C** (oryginał + kadr
  z prostokątem / maska; ta sama treść, schemat i model) — **NIE ZMIERZONE**; **D** (szkic) — niedostępny (Messages API
  zwraca tylko tekst/JSON).
* **Przygotowane** (`research/source-to-model/s5311/evidence-questions/`): 7 zamrożonych pytań (`sha256 0794ae9e…`)
  o ścianę zachodnią Nigelle, logo, odczyt `1400`/`2180`, `1620` Wrotycz, opis otworu Stellarii, `1350` Supertunii;
  payloady (prywatnie, oryginały 853 px — warianty 550 px nie mają opisów); adapter przypina sha256, rozdzielczość
  i transformację każdego obrazu; `verifiedOnOriginal` liczone lokalnie na oryginale; odtworzenia offline:
  wszystko poprawne (7/7 CORRECT, w tym CONTRADICTED na `1350` — rejestracja strony przeczy odczytowi), błędna
  podpowiedź (2 WRONG: błędny wymiar `1100` wykryty lokalnie jako CONTRADICTED; błędna klasa ściany „przerwa"
  zostaje UNVERIFIED — klasy nie da się sprawdzić na oryginale, więc nie może być przyjęta bez innego dowodu), brak dowodu (7 UNKNOWN, nic nie liczone jako
  poprawne). Testy 9/9.
* **Szacunek kosztu** (bez `count_tokens`): zapytanie ≈ 0,010–0,012 USD (sonnet-5-5), ≈ 0,0005–0,0006 USD (haiku-5-5);
  B+C razem 0,151 USD sonnet, rezerwacja 0,856 USD; kaskada najlepszy/najgorszy przypadek sonnet 0,052/0,131 USD,
  haiku 0,003/0,007 USD na scenę. Rezerwacja przed wywołaniem, timeout zatrzymuje całą rezerwację, bez ponowień.
* **Jedna komenda na hosta** (bash i PowerShell) — w README katalogu; klucz wpisywany bez echa, nigdy argumentem ani
  w logu; wynik dopisuje jeden wpis do jedynej księgi.

## 9. Testy, typy, kontrakt

* `npm run typecheck` (repozytorium i `apps/web`) na `681f6cf`: bez błędów.
* Macierz pakietów objętych zmianą (`packages/reconstruction`, `packages/analysis-service`, `apps/local-analyzer`
  z Node 18.20.4, `apps/analyzer-api`, `tests/architecture`) na **`0b93b88`** (kod zmiany): **2371 testów, 2357 zielonych,
  14 czerwonych = 13 znanych z listy bazy** (Larchfield, NFD bez ICU, M10, reference 4 i 7, research-isolation ×4,
  wall-strip 005Q ×4) **+ migawka kontraktu Androida** nieaktualna przez wersję solvera. Migawkę odtworzono z bajtów
  serwera (`capture-android-contract.ts`): zmieniają się wyłącznie `solver` 2.41.0 → 2.42.0 i `candidateHash`; test
  kontraktu 4/4 zielony na **`681f6cf`** (jedyna różnica między rewizjami to pliki migawki). Żaden nowy czerwony test;
  7 nowych testów przyczyny i kontrprób zielonych.
* Testy usługi i rekonstrukcji pilnujące 005Q/N1a (nazwany podest, cienki/niepewny tusz, cienka dobudówka i podgląd
  częściowy, pierścień) — zielone jak w bazie; cztery czerwone `wall-strip 005Q` to znana lista bazy, bez zmian.
* Testy harnessu API (`research/source-to-model/s5311/evidence-questions`, własna konfiguracja): 9/9.

## 10. APK 1337 i przebieg z paczki

* Zbudowany z drzewa `681f6cf` (kod `0b93b88` + migawka kontraktu; `./gradlew --offline -PpreviewVersionCode=1337
  previewApks`, pełna przebudowa — katalog budowy usunięty przy sprzątaniu), ten sam podpis.
* `BuildPlan-Model-Preview-1337-arm64-v8a-debug.apk`: 50 705 632 B, SHA-256
  `f2b4b78ef26c67b801c1f9653fa741243050deed943702f763eb572baf6ba75d`; `aapt`: `com.buildplan.preview`, versionCode
  1337, versionName `0.1337.0-owner`, minSdk 26, targetSdk 35; `apksigner`: certyfikat SHA-256 `6e48fac4…ca0da` —
  równy 1336.
* Paczka analizatora z APK: manifest 12/12 plików zgodnych ze skrótami, w niej solver 2.42.0 (z regułą ramki
  podanej odczytanym wymiarem) i usługa 1.11.0.
* **Host z paczki** — produkcyjny `main.mjs` z APK, Node 18.20.4 z symulacją braku ICU, żywe strony wydawcy:

| Strona | wynik | czas | szczyt RSS | model hosta = powtórka | scena zapisana i wczytana |
|---|---|---|---|---|---|
| Nigelle 4 G2 (poprawiony, DEV) | hello → done COMPLETE, pomiar NEAR 237,58/255,91, MEASURED 1,02298, LIMITED (`COVERAGE_NEAR`) | 330 s | 994 MB | `06e8d1ff0582` = `06e8d1ff0582` | tak (`loadBundle`, 170 siatek) |
| Gaury 5 (kontrpróba: portyk otwarty) | hello → done COMPLETE, pomiar MATCHES 172,71/176,25, MEASURED, USABLE_IN_SCOPE | 201 s | 799 MB | `d4817e71600c` = `d4817e71600c` (= 1336) | tak (133 siatki) |

* Urządzenie / emulator: brak (`/dev/kvm` niedostępne) — interfejs Androida i przebieg LOCAL na telefonie
  **NOT_VERIFIED**. Wyniki hosta i aplikacji podane osobno: aplikacja nie była uruchomiona.
* APK przekazany prywatnie (poza Gitem).

## 11. Zakres uogólnienia i pozostałe rozbieżności

**Zakres:** jedna reguła ramki na jednym domu DEV (oś y z odczytanym `2180`, oś x z kreskami linii całkowitej);
na 149 innych przebiegach nie aktywuje się — nie przeniesiona na niezależny dom. Deklaracja zakresu: ARCHON, rzut
parteru 853 px, ramka na świadku ścian, w pełni odczytana linia całkowita jednej osi.

**Największe pozostałe rozbieżności:**
1. **Linia całkowita niewykryta / łańcuch wewnętrzny ramuje oś** — Wrotycze (`1620`).
2. **Skala z odczytu wbrew niezależnej metryce** — Supertunie 2 (`1350` → `1150`), Torenie 3 (+27 %), Nad Rzeczką 2.
3. **Pokrycie najniższej kondygnacji 2–59 %** w odmowach świeżej próby (Goldstary 2, Bazylie 5, Pod Krzewuszką 2,
   Plumerie 2) — nie badane.
4. Nigelle 4: pola garażu, toalety i pokoju 9, wiatrołap scalony z kotłownią, wysokości okien przyjęte.
5. Bez zmian od 3.53.10: brama i przeszklenie Stellarii, lico garażu 005Q, wysokość ściany Anodach.

Dowody prywatne (poza Gitem): `/home/user/rd/v35311` — protokół, zapieczętowane oczekiwania (`trial/expectations.md`),
lista stron 16–18 ze skrótami, przebiegi `reg-b` (120), `other/*` (18), `trial/rep-base`, `trial/rep-var` (12),
sondy DEV `p0`–`p3`, plansze `boards/*`, payloady i odtworzenia API `api/*`, przebiegi hosta `host1337/*`.
Generator plansz: `research/source-to-model/s5311/boards.py` (odtworzenie: §12).

## 12. Odtworzenie plansz i paczki

Plansze (prywatne, zawierają rysunki wydawcy — zapisywać poza repozytorium):
`python3.12 -I research/source-to-model/s5311/boards.py --source <run>/plan-diagnostics/<asset>-source.png
--before <przebieg 1336> --after <przebieg v3.53.11> --asset <asset> --title "<dom>" --out <plansza.png>
[--zoom x0,y0,x1,y1:etykieta]`; zasób planu = `selectedPlanFrameId` z `plan-diagnostics/digest.json` bez prefiksu
`frame-`. Manifest publiczny paczki: `research/source-to-model/s5311/OWNER_PACKAGE_MANIFEST.md` (nazwy, rozmiary
i SHA-256 plików, bez treści).
