# BUILDPLAN-ANALYZER-005Y-N7-P1 — pierwszy prawidłowy podgląd 3D

**Werdykt: OWNER_TEST_PENDING.** Mechanizm „ostatni prawidłowy model” działa na całej ścieżce aż do magazynu scen
telefonu i jest sprawdzony na dokładnie tym samym podpisie błędu, który zatrzymał dom OWNER-a (`WALLS_OVERLAP` między
`ring-…-w1` i `ring-…-w3` tego samego pierścienia, polecenie 21). Ukrytego domu OWNER-a nie odtworzono (nie był
dostępny) — o wyniku na nim rozstrzyga test OWNER-a na APK 1304. P2 i P3 nie zaczęte.

Baza `89c88ce` (N7), gałąź `claude/new-session-3kzcgh`.

## Co zatrzymało dom OWNER-a

Odtworzyłem podpis błędu wprost na walidatorze: pierścień ścian węższy niż dwie grubości ściany ma swoją ścianę
wschodnią (`w1`) i zachodnią (`w3`) w jednym paśmie rzutu, a model odmawia go jako `WALLS_OVERLAP`
(`walls ring-attached-0-0-w1 and ring-attached-0-0-w3 share … m²`). To bryła dołączona odczytana jako **drzazga** —
para nie dotyczy żadnej innej ściany, więc rekoncyliacja z N7 (która rusza słabszą ścianę na lico mocniejszej) nie
miała czego przesunąć i cała rekonstrukcja była odrzucana, razem z poprawną bryłą główną zbudowaną przed poleceniem 21.

Dowód, że to ten sam mechanizm, a nie podobny:

- **SLIVERTON** (syntetyczny, `packages/synthetic-drawings`): Holloway z garażem 0,45 m przy ścianach 0,30 m. Przez
  pełny `runAnalysis` (rzuty, OCR, solver) daje **commandIndex 21, `createWallRing ring-attached-0-0`,
  `WALLS_OVERLAP` w1/w3** — przed P1 odmowa, po P1 model częściowy.
- **Marcówki** (prawdziwy program N7): `ring-attached-0-0` stoi pod indeksem **21**, za `ring-main-0` (16) i
  `ring-main-1` (18) — ten sam układ co u OWNER-a. Zwężony do 1,5 T daje ten sam błąd w tym samym miejscu.

Przed poleceniem 21 **istnieje prawidłowa bryła główna** (oba stropy i oba pierścienie, prefiks 19 poleceń) — to jest
punkt kontrolny, który podgląd zachowuje.

## 1. Źródło ścian

Sprawdzone w kodzie (stan zastany, nie zmieniany w P1):

- ściany i bryły czyta wyłącznie rzut techniczny: ramy `FLOOR_PLAN` z rzutowaniem `ORTHOGRAPHIC_PLAN`
  (`planDiagnosticsOf`); wizualizacja perspektywiczna nie jest nigdy ramą rzutu;
- rzut bazowy wybiera `chooseBasePlan` (rejestracja metryczna, obwiednia, pasma ścian, kondygnacja `GROUND`), więc w
  praktyce kopia z wymiarami — tylko ona daje rejestrację z łańcuchów;
- z kilku kopii tego samego rysunku czytana jest **największa zdekodowana** (`selectionOrder`: pole pikseli, bajty,
  hash);
- skala wynika z łańcuchów wymiarowych (OCR + kratownica liczb) i niezależnych świadków (`metricSolutions`).

**Nowe: `sourceBasis`** w wyniku (i w `diagnostics.json` porażki): rola (`FLOOR_PLAN`, `ORTHOGRAPHIC_PLAN`),
kondygnacja, adnotacja (`DIMENSIONED` …), rozdzielczość, bajty, typ, **SHA-256 obrazu**, liczba wariantów i czy
wybrano największy, liczba łańcuchów i odczytanych odcinków, klasa dowodu wymiarów, m/px, kotwice, RMS, pewność skali
(`STRONG/SUPPORTED/WEAK/INCONCLUSIVE`), relacja i `verified`. Wyłącznie hashe i liczby — bez adresu, bez piksela.
Przykład (Sliverton): `FLOOR_PLAN / ORTHOGRAPHIC_PLAN / GROUND / DIMENSIONED`, 576×628, `824ecb51…`, 4 łańcuchy,
6 odcinków, 0,02636 m/px, 6 kotwic, `STRONG/CONFIRMED`, `verified: true`.

## 2. Minimalny model przed dodatkami

Bazą (punktem kontrolnym) jest: nagłówek, kondygnacje, stropy i pierścienie ścian **bryły głównej**. Dach, balkony,
okna, bryły dołączone i detale nie są warunkiem pokazania modelu.

- **`HEIGHT_ASSUMED_FOR_PREVIEW`**: gdy żaden przekrój nie drukuje rzędnych, kondygnacje mają konwencjonalne 2,80 m —
  teraz nazwane w wyniku (`preview.provisional`, ostrzeżenie LIMITING) i na telefonie. Test: Sliverton bez przekroju.
- **`SCALE_NOT_VERIFIED`**: gdy skali nie potwierdzają niezależne wymiary (pewność inna niż STRONG/SUPPORTED albo brak
  rejestracji) — w `preview.provisional`; wymiary są wtedy proporcjami, nie do kosztorysu.
- Obrys pochodzi z rozpoznanych ścian (bryły z pasm rzutu i łańcuchów), jak dotąd. **Nie dodano** żadnego zastępczego
  prostokąta ograniczającego.

## 3. Model zachowany po późniejszym błędzie

`packages/reconstruction/src/candidate.ts` — jedyne miejsce, gdzie program staje się modelem:

- **`fitPreviewProgram`** (woła go `reconstructV2` zamiast zwykłego dopasowania): najpierw dokładnie dotychczasowa
  ścieżka (dopasowanie otworów, rekoncyliacja N7). Gdy model nadal odmawia polecenia **po bazie**:
- **`cutFailedObject`** wycina odrzucony obiekt **atomowo** z tym, czego jest częścią: bryła dołączona — wszystkie jej
  stropy, pierścienie, dach (`roof-<bryła>*`) i wnętrze (`<bryła>-*`); kondygnacja bryły głównej — ta i wyższe; każdy
  inny obiekt — sam. Potem każde późniejsze polecenie, które nazywa coś pominiętego (otwór w ścianie bryły, drzwi,
  dowód, relacja, przebicie komina), idzie jako `DEPENDENT` (`rewriteReferences`). Ściana zewnętrzna (powrót wnęki),
  która stała przy wyciętej bryle i po cięciu nie styka się z żadną stojącą ścianą, idzie z nią — nazwana; ściana
  wolnostojąca już na rysunku zostaje. Reszta jest dopasowywana od nowa, maks. `PREVIEW_MAX_CUTS` = 12 cięć.
- Odmowa **w bazie** (nagłówek, kondygnacje, najniższy strop/pierścień bryły głównej) nigdy nie jest omijana:
  `minimalPreviewProgram` próbuje samych stropów i ścian bryły głównej na wysokości kondygnacji (`MINIMAL_BASE`);
  gdy i to odmawia — **odmowa jak dotąd**. Bez ścian bryły głównej nie ma podglądu.
- Każda odmowa zostaje zapisana tak, jak padła (`failures`: indeks w programie, typ, id, kody, zdanie walidatora,
  obiekty), każde pominięte polecenie z przyczyną (`FAILED / SAME_BODY / DEPENDENT / NOT_IN_MINIMAL_PREVIEW`).
- **Punkt kontrolny** (`previewCheckpoint`): prefiks programu do ostatniego stropu/pierścienia bryły głównej i
  SHA-256 modelu, który buduje — sprawdzalny powtórką prefiksu (testy to robią).
- Walidator nietknięty; `WALLS_OVERLAP` nie poluzowany; program, który model przyjmuje w całości, idzie bajt w bajt
  dawną ścieżką (8/8 modeli korpusu identyczne; test „preview fit = plain fit”).

`reconstructV2` dokłada: kroki solvera `PARTIAL_3D_PREVIEW`, luki `REFUSED`/`MISSING` dla każdego pominiętego
obiektu, cechy bez żadnego zbudowanego obiektu na L0/`UNRESOLVED` (graf cech bez naruszeń), wynik `partialPreview`
i `heights`.

## 4. Telefon

Łańcuch sprawdzony od końca do końca:
`reconstructV2 → runAnalysis → MobileSceneBundle → local-analyzer (done) → LocalAnalysis.kt → DownloadedScenes → ekran 3D`.

- **Usługa** (`analysis-service/src/preview.ts`, wersja 1.2.0): `preview.outcome` = `COMPLETE` /
  `PARTIAL_3D_PREVIEW`, `built` (pierścienie, ściany, stropy, dachy, otwory, pomieszczenia), `partial` (odmowa,
  brakujące, punkt kontrolny), `provisional`; ostrzeżenie LIMITING `PARTIAL_3D_PREVIEW` („partial 3D preview, not a
  complete reconstruction …”). Model częściowy przechodzi te same kroki co pełny: walidacja, kompilacja sceny,
  serializacja paczki, ponowny odczyt (`loadBundle`, contentHash), powtórka zapieczętowanego kandydata
  (`BYTE_IDENTICAL`), audyt złączy.
- **Android**: `scene/PreviewOutcome.kt` zapisywany razem ze sceną (przeżywa restart). Karta wyniku:
  **„Model częściowy 3D”** (nigdy „Model gotowy”), przycisk **„Otwórz model częściowy 3D”**, a obok sekcje
  „Co udało się odtworzyć”, „Czego brakuje”, „Na którym elemencie wystąpił błąd” (polecenie, typ, id, kody, zdanie
  walidatora), „Wymiary i wysokości tymczasowe”. W otwartym modelu wiersz stanu „Model częściowy 3D — zobacz, czego
  brakuje i dlaczego” (nie znika jak powiadomienie) prowadzi do arkusza źródła z tymi samymi sekcjami.

## 5. Testy (celowane, bez pełnego CI)

| zakres | wynik |
|---|---|
| `reconstruction/test/partial-preview-n7-p1.test.ts` — poprawny obrys + błędny pierścień dodatkowy → model częściowy; punkt kontrolny = powtórka prefiksu; złe okno / zły dach / zła kondygnacja górna → ściany zostają; powrót przy wyciętej bryle idzie z nią, ściana wolnostojąca zostaje; brak obrysu / brak ścian bryły głównej / błąd w nagłówku → brak domu; `MINIMAL_BASE`; poprawny program = zwykłe dopasowanie | **14/14** |
| `analysis-service/test/partial-preview-n7-p1.test.ts` — Sliverton przez `runAnalysis`: `PARTIAL_3D_PREVIEW`, odmowa 21 jak u OWNER-a, bryła główna, replay, round-trip sceny, `sourceBasis`; bez przekroju `HEIGHT_ASSUMED_FOR_PREVIEW`; Holloway `COMPLETE` bez nowego ostrzeżenia; strona bez rzutu → odmowa | **7/7** |
| `local-analyzer/test/program.test.ts` — **zbudowany bundel** jako proces (jak na telefonie, z OCR): Sliverton częściowy, hashe = desktop | **zielony** |
| Android `LocalAnalysisTest` (+2: prawdziwe pliki bundla Sliverton trafiają do magazynu scen, otwierają się, po restarcie nadal częściowe z tą samą odmową; wynik sprzed P1 = kompletny), `AnalysisTrackerTest`, `RealServerContractTest` | **40/40** |
| Stres na prawdziwych programach 8 domów (`research/analyzer-005y-n7-p1/partial-preview-stress.ts`): drzazga dołączona (2 warianty), złe okno, zły dach, zła kondygnacja górna, zła kondygnacja parteru (musi odmówić), bez zmian (musi być identyczne) | **47/47** zgodnie z oczekiwaniem; każdy model częściowy: kompilacja, paczka, odczyt, powtórka, prefiks punktu kontrolnego |
| Powtórki solvera 8 domów korpusu (dowody N7) | **8/8 bajt w bajt** jak N7 (A01 `a6849073`, Goździkowce `852c257a`, Marcówki `d8ec95cf`, Cieszynianki `5394c17c`, Rarytasy `73969751`, Trytomy `d2bf0c03`, Arganie `34a95a76`, Sasanki 3 `090749f4`) |
| `packages/reconstruction` + `analysis-service` + `synthetic-drawings` + `apps/local-analyzer` | 1180 zielonych, **1 czerwony zastany** (patrz niżej); `npm run typecheck` czysty |

Czerwone zastane (identyczne na bazie `89c88ce`, sprawdzone): `program.test.ts` „Larchfield … scene the analyzer API
served” (scena nagrana w 03Y1 ≠ dzisiejszej); Android `DownloadedScenesTest` ×2 (lista scen wbudowanych sprzed 005T);
bramki architektury ×3 (znane z N7: rozmiar pliku > limit modelu, dwie historyczne bramki 005Q). Pełnego CI (41
zadań) nie uruchamiano — zgodnie z poleceniem.

## 6. APK

| | |
|---|---|
| plik | `BuildPlan-Model-Preview-arm64-v8a-debug.apk`, 39 701 142 B |
| SHA-256 | `e61f50edfac753e9f178a222783d75d2c2764d94fc324d6ad642b3267d9a2022` |
| commit | `d300810759b7d62e7d5f9bcd8a83d24c1b80b88b` (kod; raport w commicie po nim) |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1304** / `0.1304.0-owner` |
| podpis | ten sam klucz podglądu, cert SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da`; `verify-preview-signature.sh`: ok |
| analizator w APK | `assets/local-analyzer/analyzer.mjs` SHA-256 **`3d57e65a2cfb82f49441494fe027ce785de3b588ee6f6f00af934b3a9a2dc357`** (= `manifest.json`); usługa 1.2.0; kod identyczny z bundlem zbudowanym z HEAD (różnią się tylko komentarze ze ścieżkami esbuild); **ten plik wyjęty z APK** uruchomiony na Slivertonie daje `PARTIAL_3D_PREVIEW`, odmowę 21 i scenę `4ad30210…` = plik w teście Androida |

Instaluje się na 1303 (ten sam podpis, wyższy versionCode). Urządzenia ani emulatora w tej sesji nie było:
**ANDROID_3D_NOT_DEVICE_VERIFIED** — scena Filamenta na telefonie nie była oglądana; geometrię modelu częściowego
obejrzano w przeglądarce (BuildWorld web, Three.js).

## Zrzuty modelu częściowego z testu

`stage-reports/artifacts/analyzer-005y-n7-p1/sliverton-partial-34-front-right.png`, `…-34-rear-left.png`: model
`988e55bd…`, ten, który wyprodukował bundel z APK — bryła główna z dachem, oknami i drzwiami; garaż-drzazga pominięty
i nazwany. Marcówki (prawdziwy program, przypadek stresowy) renderowane poza repozytorium.

## Na jakim etapie zachowano geometrię

| przypadek | odmowa | punkt kontrolny | zbudowane |
|---|---|---|---|
| Sliverton (end to end, APK) | 21 `createWallRing ring-attached-0-0` `WALLS_OVERLAP` | 19 poleceń: oba stropy i oba pierścienie bryły głównej, model `7add56b2…` | pierścienie 2, ściany 12, stropy 2, dach 1, otwory 7, pomieszczenia 2; pominięte: `slab-attached-0-0`, `ring-attached-0-0`, `roof-attached-0` |
| Marcówki, drzazga od strony bryły głównej | 21 `ring-attached-0-0` | 19 poleceń, `ring-main-0` + `ring-main-1` | 34 ściany, 19 otworów, dach główny, kominy, balkony; pominięte też wnętrze bryły, 2 drzwi w jej ścianach i powrót `return-front-0-1` |
| Rarytasy / Arganie, drzazga | 20 / 18 `ring-attached-0-0` | 16 poleceń, `ring-main-0` | bryła główna z dachem; pominięte z bryłą: Rarytasy — dwuspadowy dach garażu z krawędziami, jego relacje i przebicie komina; Arganie — płaski dach bryły i 2 otwory w jej ścianach |
| zła kondygnacja parteru (8 domów) | `ring-main-0` | — | **odmowa** (brak fałszywego domu) |

## Ograniczenia

- Taras przed wyciętą bryłą zachowuje swój zasięg z rzutu (Marcówki: pas przed garażem zostaje) — to element
  terenu, nie oparty na bryle; nazwane, nie usuwane.
- Kanoniczna kolejność emisji: pierścień bryły dołączonej jest za bazą, więc u OWNER-a podgląd powinien powstać z
  punktu kontrolnego; jeżeli w jego domu odmówi już `ring-main-0`, wynik będzie `MINIMAL_BASE` albo odmową z tą samą
  diagnostyką co dziś.
- Ukryty dom OWNER-a: nieuruchomiony. Bez urządzenia: brak zrzutu z ekranu telefonu.

## Jak OWNER sprawdzi swój dom

Zainstaluj APK 1304 → Projekt → Import projektu → ten sam adres (tryb LOCAL). Oczekiwane: „Model częściowy 3D”,
przycisk „Otwórz model częściowy 3D”, w „Na którym elemencie wystąpił błąd” — `Polecenie 21 · createWallRing
ring-attached-1-0 · WALLS_OVERLAP` ze zdaniem walidatora; w modelu pionowe ściany bryły głównej. Jeżeli zamiast tego
pojawi się odmowa, „Udostępnij diagnostykę” — `diagnostics.json` zawiera teraz `sourceBasis` (hashe i liczby; pole
`canonicalUrl` usuń, jeżeli adres ma zostać prywatny).

## Poufność

Rysunki ARCHON czytane lokalnie, poza repozytorium; w repozytorium tylko kod, testy syntetyczne, liczby i zrzuty
syntetycznego domu. Bez zewnętrznej AI.
