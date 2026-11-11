# SOURCE-TO-MODEL v3.53.2 — aktualizacja koordynatora (raport punktu kontrolnego)

Aktualizacja koordynatora v3.53.2 (2026-11-11) w kampanii v3.53. Gałąź `claude/new-session-3kzcgh`.
Punkt odniesienia: kod `a2e2f45`, raport `5ad2dd5`. **Kod tego punktu kontrolnego: `80a866e`** (macierz testów biegła
na `b1159af`; `80a866e` zmienia tylko dwie fikstury Androida o numer wersji budowniczego i hash kandydata, po czym
fikstury i testy Kotlin przeszły ponownie). Poprzedni raport: `stage-reports/SOURCE_TO_MODEL_V3531.md`.
**Żadnego płatnego wywołania; księga bez zmian (2,72807938 USD z 5 USD).** Bez nowego hostingu, bez zmiany limitu,
bez H2 / prywatnego benchmarku, bez zmian w ForgeShape. Ogranicznik kosztów nie był przepisywany — jego testy przechodzą.

| | stan |
|---|---|
| **SLICE 1: semantyka kotwic** | **PASS** — kotwica ma zakres i przesłankę miary; kontrprzypadek koordynatora (8×12 nie zmniejsza poprawnego 10×15) i próby pozytywne (całość, lokalna bryła) mają testy; konsument sprawdzony na liczbach z prawdziwego rzutu DEV |
| **SLICE 2: klient Android z odtwarzanym HTTP** | **PASS na JVM** — token w czasie działania, nagłówek tylko na zgłoszeniu, faza i obrazy, hashe, błędy, anulowanie; 12 testów na odpowiedziach przechwyconych z prawdziwego serwera z atrapą czytnika. **Android UI: NOT_VERIFIED** (bez urządzenia) |
| **SLICE 3: elementy z opisów** | **PASS w zakresie** — wnęka narożna i wnęka w ścianie (model `PocketV2`) oraz okna połaciowe na połaciach szczytowych dachu kopertowego i na dachu poprzecznym; 10 zapisanych opisów: 8 modeli bajtowo bez zmian, 2 zmienione zgodnie z zamiarem |
| **SLICE 4: zapis próby SDK** | **PASS bez kosztu** — model, program, scena, wynik i diagnostyka zapisywane; NO_MODEL = kod wyjścia 2; jedna księga kontynuowana od salda kampanii; determinizm bajtowy sprawdzany; 9 testów z atrapą klienta; suchy przebieg: 401, kod 2, nic nie zaksięgowane |
| **SLICE: płatny odczyt SDK** | **BLOCKED na jednej zależności** — klucz właściciela w jego własnym terminalu (instrukcja PowerShell w `docs/ANALYZER_API.md`) |
| **CAMPAIGN** | **WORK_IN_PROGRESS** — ocena plansz przez OWNER-a i jeden płatny odczyt nadal po stronie OWNER-a |
| **VERIFICATION** | macierz 3779 testów: 3752 pass, 11 skip, 16 fail = 15 historycznych z bazy + 1 nieaktualna fikstura (naprawiona w `80a866e`, test przechodzi); Android JVM 459: 453 pass, 2 skip, 4 fail (sceny 005T w assetach, pliki bez zmian od `5ad2dd5`) |

## 1. Semantyka kotwic (commit `c644260`)

Problem odtworzony przez koordynatora: model z rysunków `PARTIAL_3D_PREVIEW` + `BODY_MISSING_FROM_MODEL` ze
zweryfikowaną skalą i pozostałą bryłą 8×12 m eksportował 8×12 jako cały dom, więc poprawny opis 10×15 m
`PRINTED_ON_DRAWING` był zmniejszany do 8×12. Skala mówi, ile metrów ma piksel, a nie że obrys jest kompletny.

Teraz `DescribedAnchors` rozróżnia:
- `overall` — wymiar całego domu z przesłanką `OVERALL_DIMENSION_LINES` (zasięg rzutu ujęty łańcuchami wymiarowymi,
  ważny także przy modelu częściowym) albo `COMPLETE_OUTLINE` (tylko gdy model nie jest częściowy);
- `bodies` — miara lokalna jednej bryły (MAIN / ATTACHED): ogranicza tę bryłę; przy modelu częściowym z jedną bryłą
  nie jest stosowana jako całość; przy rozmiarze odczytanym z rysunku (`PRINTED_ON_DRAWING`) zgodność
  i niezgodność są nazwane (`DRAWINGS_LOCAL_MEASURE_AGREES` / `…_DISAGREES`), żadna nie przeskalowuje;
- `partial` — model rysunków jest częściowy.

Nie zakazano kotwic z modeli częściowych. Testy: kontrprzypadek 10×15 vs 8×12, prawidłowy wymiar całkowity
z linii wymiarowych przy modelu częściowym, prawidłowy wymiar lokalny głównej bryły, bryła niejednoznaczna.
Konsument na realnym rzucie: `packages/analysis-service/test/fixtures/real-plan-measures-a.json` (liczby z jednego
rzutu korpusu DEV: zasięg, mpp, proweniencja łańcuchów, wymiary brył) i ręcznie napisany opis
`described-real-plan-a.hand-made.json`, jawnie oznaczony jako fikstura DEV, nie wynik AI. Referencji w runtime nie ma.

## 2. Klient Android z odtwarzanym HTTP (commity `7da0b35`, `a48fe67`, `80a866e`)

- **Token pilota** wpisywany w czasie działania (pole hasła), zapisany w ustawieniach aplikacji, pokazywany tylko
  jako cztery ostatnie znaki, 24–200 drukowalnych znaków ASCII (żadne łamanie wiersza nie trafi do nagłówka).
  `Authorization: Bearer …` wyłącznie na `POST /v1/analyses` — nigdy na odpytywaniu, wyniku, scenie, anulowaniu ani
  pobraniu obrazu wydawcy. Brak tokenu = zwykła ścieżka rysunków; zły token = `PilotTokenRefused` z polskim zdaniem.
- **Faza czytania**: `describing` (sortowanie obrazów, opis domu, budowa modelu), powód (odmowa rysunków), dostawca,
  obrazy z hashem oryginału i hashem wysłanej kopii. Miniatura oryginału jest pokazywana tylko wtedy, gdy pobrane
  bajty mają hash zapisany przez serwis; inaczej `HashMismatch` / `NotVerifiable` / `Unavailable`. Żadnych zaznaczeń.
- **Wynik z opisu** jest nagłówkowany jako ograniczony (`LIMITED`), nigdy jako gotowy model mierzony.
- **Anulowanie** w trakcie opisu: rekord zachowuje fazę, nic nie jest zapisywane w telefonie.
- Starszy serwis bez `describing` jest czytany jak dotąd.
- W APK nie ma klucza dostawcy ani wspólnego tokenu. Strażnik architektury `tests/architecture/android.test.ts`
  został świadomie zmieniony: wolno wysłać jeden token wpisany przez człowieka, nagłówek wolno nazwać tylko w
  `HttpTransport.kt` i `PilotAccess.kt`; klucz dostawcy, poświadczenie z czasu budowy ani literał po `Bearer` — nigdzie.
- Fikstury: `apps/android/app/src/test/resources/analyzer-described/` przechwycone po HTTP z prawdziwego serwera
  (`apps/analyzer-api/scripts/capture-android-described-contract.ts`) z atrapą czytnika; strzeżone przez
  `android-described-contract.test.ts`. Obraz testowy to syntetyczny PNG (nazwa `.png`, bo nim jest — strażnik
  wag modeli odrzucał `.bin` o tym rozmiarze). Testy: `DescribedPathClientTest` (12).

Te fikstury pinują KONTRAKT, nie to, co powie żywy czytnik. E2E na urządzeniu i żywy serwis to osobne, późniejsze dowody.

## 3. Elementy już obecne w opisach (commity `554153f`, `b1159af`)

Wybór po efekcie na cały dom, na dziesięciu zapisanych opisach (6 kontroli odłożonej, 4 DEV): stan przed —
otwory 121/124, okna połaciowe 9/13, zadaszenia 13/15. Balkon w okapie (2 uwagi audytu) pozostaje granicą
reprezentacji opisaną w v3.53.1.

**Wnęka w bryle.** Zadaszenie podane wewnątrz ścian bryły, głębokie na ≥ 1 m, w narożniku albo na części ściany, było
„mówione i nie budowane”. Teraz to `PocketV2` modelu na parterze: przejście w ścianie obwodowej nad wylotem pod podaną
wysokością, ściana tylna, słup w otwartym narożniku; otwory podane na tej ścianie w obrębie wnęki stoją w ścianie
tylnej. Obrys bryły i dach bez zmian. Nadal nie budowane (z nazwą): narożnik, o który opiera się inna bryła; wnęka,
która zostawia < 3 m bryły; wnęka przy narożniku, ale do niego nie sięgająca. Źródło sprawdzone na domu DEV
(rzut parteru i elewacja frontowa: narożny ganek ze słupem, drzwi wejściowe w głębi).

**Okna połaciowe.** Okno podane na stronie, której połać nie jest jedną z dwóch długich połaci dachu płaskiego modelu,
było odrzucane: połać szczytowa dachu kopertowego i obie połacie dachu poprzecznego dobudowanej bryły. Teraz wybierana
jest połać opadająca ku podanej stronie; okno cięte pionowo wewnątrz niej, w podanym miejscu albo — gdy zwężająca się
połać nie ma tam miejsca — w jej środku (z adnotacją), albo niebudowane. Długie połacie bez zmian (test bajtowy).

Regresja (`research/source-to-model/s53/closure-findings.ts`, `build-described-cli.ts`, wyniki poza Git):

| | przed (0.6.0) | po (0.7.0) |
|---|---|---|
| modele bajtowo identyczne | — | 8 / 10 |
| zmienione | — | dom DEV z garażem (wnęka + 2 okna połaciowe), jeden dom kontroli (2 okna na połaci szczytowej) |
| uwagi audytu styków (exterior) | 5 | 5 |
| błędy kompilatora | 0 | 0 |
| okna połaciowe podane / zbudowane | 9 / 13 | 13 / 13 |
| zadaszenia podane / zbudowane | 13 / 15 | 14 / 15 |
| otwory podane / zbudowane | 121 / 124 | 121 / 124 |

**Ocenionej kontroli S53-E3 nie zmieniam**: jej zapis i werdykt 5/6 zostają w wersji ocenionej; zmiana jednego domu
kontroli jest efektem poprawki DEV i nie jest ponownie oceniana.

Testy budowniczego: 30 (`packages/reconstruction/test/described-house.test.ts`), w tym wnęka narożna, wnęka w ścianie,
przypadki niebudowane, okna na dachu poprzecznym i na połaciach szczytowych.

## 4. Zapis próby SDK (commit `a48fe67`)

`apps/analyzer-api/scripts/house-reader-trial.ts` (rdzeń) i `research/source-to-model/s53/sdk-live.ts` (wiersz
poleceń, jedyne miejsce tworzenia klienta SDK):
- zapisuje `trial.json` (wynik, kod wyjścia, modele, które odpowiedziały, użycie, saldo przed i po) oraz dla modelu
  `description.json`, `model.json`, `program.json`, `scene.json`, `result.json`, `diagnostics.json` (sprawdzenie opisu
  wobec liczb strony, korekty budowniczego, odmowy modelu, uwagi kompilatora i audytu);
- kod wyjścia: 0 model, **2 brak modelu** (płatny odczyt bez modelu to porażka, nadal zaksięgowana), 3 nic nie zapytano;
  jedna linia JSON na stdout dla automatyzacji;
- **jedna księga**: trwały katalog (`~/.buildplan/house-reader-books`), otwierany od sumy rejestru kampanii
  `research/ai-assist/spend-ledger.json`; katalog z mniejszym saldem jest odrzucany; nowy pusty katalog otwiera się od
  sumy rejestru, nie od zera; limit rejestru (5 USD) jest pułapem niezależnie od `--max`; koszt biegu dopisywany do
  rejestru jako jeden wpis;
- nowy odczyt porównywany ze **źródłami** (liczby strony, strony bez obrazu, kształt), budowa sprawdzana **bajtowo**
  przez dwukrotną przebudowę tego samego opisu;
- katalogi prywatne wewnątrz repozytorium są odrzucane.

9 testów z atrapą klienta (model, odmowa opisu po zapłacie, 401 bez księgowania, błąd transportu z zachowaną
rezerwacją, ciągłość księgi, limit dzienny, księga za rejestrem, pułap kampanii, uszkodzona księga). Suchy przebieg
na zapieczętowanym pakiecie DEV: `NO_MODEL`, `READER_UNAVAILABLE / REJECTED_UNBILLED`, kod 2, zaksięgowano 0.

## 5. Dokumentacja (`docs/ANALYZER_API.md`)

- Limit dostawcy: oficjalnie opisany jest **miesięczny limit wydatków workspace’u**, do którego należy klucz; nie
  obiecuję limitu na kluczu. Skumulowany limit kampanii egzekwuje wyłącznie lokalna księga.
- „0,3–0,4 USD” to **rezerwacja szacowana dla przykładowych wejść**, nie gwarantowany koszt dowolnego linku.
- Fly: 13,39 USD to **sama VM** w najtańszych regionach (Warszawa niekoniecznie); dysk, rootfs zatrzymanej maszyny
  i ruch osobno; 1–2 USD to orientacja dla pilota, nie pułap; plan nie zależy od umorzenia małego rachunku.
  Zewnętrzny hosting nie jest warunkiem klienta ani testów kontraktu. Nic nie zamówiono.
- Instrukcja ustawienia klucza dla **Windows PowerShell** (7: `Read-Host -MaskInput`; 5.1: `-AsSecureString`) i bash.

## 6. APK 1328 — tylko do testów odtwarzania / kontraktu

`-PpreviewVersionCode=1328` (> ostatnio wydany 1327), ten sam keystore `apps/android/keystore/preview.keystore`,
certyfikat SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (bez zmian), z kodu `80a866e`.

| plik | SHA-256 |
|---|---|
| `BuildPlan-Model-Preview-universal-debug.apk` | `1ad1357918d52d6a3e37f940d0877a2f859d21c3ff8b76f4bd5e8cfec5ff91ae` |
| `BuildPlan-Model-Preview-arm64-v8a-debug.apk` | `0e01a5c8be1c2a596f6ce914ac78d824a2f35402a2243f15a8955ecf22f03c7c` |
| `BuildPlan-Model-Preview-armeabi-v7a-debug.apk` | `d323875f9c7f3e8943f8cf6c3446e3960b660aeb894e5c7f16419b0fd505bb65` |
| `BuildPlan-Model-Preview-x86_64-debug.apk` | `27d26cf87b5fb891b16503f03beecfc6d73a6e2f5473b283fb8f769068621323` |

**To nie jest działające płatne API.** Nie ma serwisu z czytnikiem: pole tokenu i panel fazy czytania pojawią się
w działaniu dopiero przy serwisie uruchomionym przez OWNER-a. Wbudowany analizator telefonu (bez czytnika) i
dotychczasowe funkcje działają jak w 1327. Android UI: NOT_VERIFIED.

## 7. Weryfikacja

- Macierz `npx vitest run` na `b1159af`: 3779 testów, 3752 pass, 11 skip, 16 fail. 15 to historyczne błędy bazy
  (snapshot android-contract, `GET /health`, cztery strażniki research-isolation, dwa reference, cztery wall-strip,
  jeden compound-facade, NFD bez ICU, hashe sceny Larchfield); 16. to fikstura opisu nieaktualna po 0.7.0 —
  przechwycona ponownie w `80a866e` (zmienił się tylko numer wersji budowniczego i hash kandydata), test przechodzi.
- `tsc -p tsconfig.json`: czysto.
- Android `testDebugUnitTest` na `80a866e`: 459 testów, 453 pass, 2 skip, 4 fail (`AutoCandidateRenderingTest` ×2,
  `DownloadedScenesTest` ×2 — dwie sceny 005T w `assets/scenes/index.json`; te pliki i testy nie zmieniły się od
  `5ad2dd5`). `DescribedPathClientTest` 12/12.

## 8. Co dalej jest źle (nazwane)

Kalenica dachu dobudowanej bryły na planie zbliżonym do kwadratu; cechy dachu, których czytnik nie podaje; balkon
przez okap; elewacje dwukolorowe; dachy ganków jako płaskie płyty; wnęka na piętrze (budowana tylko na parterze).
Dwanaście stron sześciu wydawców to nie „dowolny link”. Nie zmierzone: kotwice na prawdziwym domu z żywym czytnikiem,
cokolwiek na urządzeniu.

## 9. Zależności po stronie OWNER-a

1. Jeden płatny odczyt w swoim terminalu (§4, polecenie w `docs/ANALYZER_API.md`); szacunkowa rezerwacja 0,3–0,4 USD
   dla przykładowego wejścia, rzeczywisty koszt wg użycia.
2. Decyzja o hoście pilota (propozycja bez zakupu).
3. Ocena plansz kontroli S53-E3 („to ten dom” / nie).

**NEXT (jedno działanie):** OWNER uruchamia jedno polecenie próby SDK na stronie DEV i odsyła `trial.json`
(bez obrazów wydawcy) — to pierwszy pomiar żywego czytnika przez adapter produktu i zamyka zapis próby.
