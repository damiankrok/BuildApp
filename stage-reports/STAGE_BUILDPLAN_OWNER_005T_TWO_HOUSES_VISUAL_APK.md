# STAGE BUILDPLAN-OWNER-005T-TWO-HOUSES-VISUAL-APK

**APK zbudowany lokalnie, zweryfikowany i dołączony do tego commitu** jako
`stage-reports/artifacts/owner-005t/BuildPlan-005T-two-houses-arm64.apk` (+ `VERSION.txt`). Repozytorium ma już
precedens: APK OWNER-a w `stage-reports/artifacts/android-preview/`.

Wydania GitHub `owner-visual-005t` **nie utworzono**. API odmówiło: `POST /releases` zwróciło HTTP 403 „Creating, editing,
or deleting releases is not permitted for this session type”. Wynik pobrania pliku przez HTTP (status, typ, SHA-256)
podaje podsumowanie etapu, bo w chwili commitu ten adres jeszcze nie istnieje. OWNER nie oglądał domów
(**OWNER_VISUAL_NOT_RUN**).

| | |
| --- | --- |
| Repozytorium / gałąź | `damiankrok/BuildApp`, `owner/005t-two-houses-visual-apk-v1` |
| Baza | `c4618749a80a8bbe52608d090db46301f391668e` (HEAD = origin, czysto) |
| Mirror `claude/new-session-3kzcgh` | `bfaf286e…3d43449`, nietknięty |
| `preview-latest`, `owner-preview-latest`, `main` | nietknięte |
| `buildapp-ci.yml`, workflow, CI | **nie uruchamiane**; nie dodano też nowego workflow, bo build był możliwy lokalnie |

## 1. Dwa domy: dokładnie zapieczętowane modele

| klucz | edycja | model SHA-256 (kanoniczny `serializeModel`) | scena SHA-256 = wynik pipeline'u | contentHash | siatki / trójkąty / obiekty |
| --- | --- | --- | --- | --- | --- |
| `jarzmianki-005t-visual` | `m60124f28f071a` | `4ced0179…6b54` | `22871168…87fd` (315 414 B) | `dd759e73…fc51` | 107 / 2 524 / 78 |
| `gozdzikowce-005t-visual` | `m79923e950094d` | `a612a399…d33f` | `50002e00…989c` (423 540 B) | `1f173554…a781` | 162 / 3 736 / 109 |

Skąd pochodzą modele:
- Pliki `model.json` to dokładne wyjścia pełnych biegów 005T-V1 i 005T-N3, zapisane lokalnie poza Gitem. Ich SHA-256 przed
  skopiowaniem zgadzało się z tabelą briefu. Nic nie odtwarzano, nie uruchamiano OCR i niczego nie pobierano.
- Leżą w `packages/candidates/src/owner-005t/`. Ten pakiet nie wchodzi do domknięcia analizatora: bramka
  `generalization.test.ts` sprawdza to wprost.
- Eksporter (`packages/mobile-scene/scripts/scenes.ts`, `sealedOwnerModel`) odmawia pliku, którego kanoniczna
  serializacja ma inny SHA-256 niż przypięty.
- Scena w APK jest **bajt w bajt** sceną, którą wyprodukował pipeline. SHA-256 assetu równa się `sceneSha256` z obu
  biegów, więc to nie jest atrapa ani ręczna imitacja.

Stan modeli (z raportów etapów, bez zmian):
- **Jarzmianki:** 3 bryły, GABLE 40°, 21 otworów, 6 ostrzeżeń LIMITING, 14 uwag złączy zewnętrznych, 2 rezydua poza
  tolerancją, poddasze wystaje 14,2 m² poza bryły, ściana 0,152 m niezweryfikowana.
- **Goździkowce:** 1 bryła, GABLE 40°, 17 otworów, 3 ostrzeżenia LIMITING (w tym `APPROXIMATE_ROOF_DATUM`), podłoga
  poddasza 2,80 m i kalenica 7,936 m są orientacyjne, poddasze wystaje 33 m² poza bryłę.

Źródła: w repozytorium są tylko liczby, identyfikatory, nazwy i podane powierzchnie pomieszczeń. Nie ma pikseli, rzutów,
PDF-ów, HTML, adresów URL ani byte-cache (sprawdzone: brak `http` w obu modelach). Repozytorium jest publiczne i już
dystrybuuje modele pochodne od rysunków ARCHON w tej samej postaci (kandydaci Marcówek), więc te dwa modele mieszczą się
w ustalonym zakresie. Nie deklaruję żadnych praw do obrazów wydawcy.

## 2. Zmiany

- `apps/android/app/src/main/assets/scenes/`: dwie nowe sceny i dwa nowe wpisy w `index.json` na początku listy.
  Pięć dotychczasowych scen nie zmieniło się: te same bajty, hasze i kolejność.
- Podtytuły: „MODEL ORIENTACYJNY — nie do kosztorysu, wymaga weryfikacji…”.
- `packages/mobile-scene/scripts/scenes.ts`: dwa wpisy i loader z przypiętym SHA-256.
- `apps/android/app/build.gradle.kts` + `AndroidManifest.xml`: opt-in `-PvisualReview=005t`.
  - Z przełącznikiem: `applicationId` dostaje sufiks `.visual005t`, etykieta to „BuildPlan 3D – test”, a `VERSION.txt`
    pokazuje pełne id.
  - Bez przełącznika: id, etykieta i versionCode są takie jak dotąd.
  - Dostawca plików ma już `${applicationId}`, więc dwie aplikacje nie kolidują.
- Testy: `packages/mobile-scene/test/owner-005t.test.ts` (5) i `apps/android/app/src/test/.../OwnerVisualScenesTest.kt` (2).
- Nie zmieniono rekonstrukcji, OCR, walidatora geometrii, dachu ani renderera.

## 3. APK (jeden lokalny build, bez poprawek)

Polecenie: `./gradlew --no-daemon previewApks -PvisualReview=005t`. Środowisko: SDK 35, NDK 27.3.13750724, CMake 3.22.1,
JDK 17. Wynik: `BUILD SUCCESSFUL in 2m 18s`.

| | |
| --- | --- |
| plik | `stage-reports/artifacts/owner-005t/BuildPlan-005T-two-houses-arm64.apk` (kopia `app-arm64-v8a-debug.apk`) |
| SHA-256 | `26203a60177460c6be2b5c4895453022927b4fce7f0f3a932a5d7c54db2957dc`, 39 556 682 B |
| package | `com.buildplan.preview.visual005t` (osobna aplikacja obok `com.buildplan.preview`) |
| etykieta | „BuildPlan 3D – test” |
| versionCode / versionName | 479 / `0.479.0-local` (liczba commitów). Bez konfliktu: inna aplikacja, nic nie aktualizuje i nic nie nadpisuje |
| signer (SHA-256 cert.) | `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (stały klucz preview), `verify-preview-signature.sh` ok dla 4 APK |
| podpis / wyrównanie | v2 verified; `zipalign -c -P 16 -v 4` OK |
| assety w APK | `unzip -l`: 7 scen + `index.json`; `index.json` i obie nowe sceny identyczne bajtowo z repozytorium |
| target / min SDK | 35 / 26; native arm64-v8a |

Uwaga: `VERSION.txt` w APK podaje `commit=c4618749…`. Build był zrobiony z drzewa roboczego tej gałęzi przed commitem.
Treść, która trafiła do APK (assety, Gradle, manifest), jest dokładnie treścią tego commitu; commit dodaje ponad nią
tylko testy i dokumenty.

## 4. Testy (zmierzone)

| co | wynik |
| --- | --- |
| `npm run mobile:export-scenes` dwa razy | drugi przebieg bez różnic (`git diff --exit-code`) |
| vitest: `owner-005t`, `parity`, `bundle`, `candidates/sealed` | 70/70 |
| vitest: `tests/architecture/android`, `generalization` | 28/28 |
| JVM: `OwnerVisualScenesTest` | 2/2 (`BundleParser` + `ModelScene` na assetach) |
| JVM: `AnalyzerContractTest` | 12/12 |
| nie uruchamiano | pełne `npm test`, e2e, 41 jobów, emulatory, testy urządzenia |

## 5. Instrukcja dla OWNER-a

Zainstaluj `BuildPlan-005T-two-houses-arm64.apk`. To osobna aplikacja „BuildPlan 3D – test”, która nie nadpisuje
dotychczasowej i nie wymaga jej odinstalowania. Otwórz z listy „Dom w jarzmiankach (005T)” albo „Dom w goździkowcach
(005T)”. Nie trzeba wpisywać linku ani mieć sieci.

Obejrzyj każdy dom od frontu, z tyłu, z lewej, z prawej i z góry. Sprawdź:
- główne bryły;
- kształt i wysokość dachu;
- położenie dużych okien, bramy i wejścia;
- poddasze;
- garaż.

Prześlij 4–5 zrzutów na dom i krótkie uwagi. Drobne różnice proporcji są w porządku. Geometria jest orientacyjna: nie
służy do zamawiania materiałów ani do kosztorysu.

## Werdykt

APK z obiema prawdziwymi scenami jest zbudowany i sprawdzony: pakiet, podpis, assety i parser. Kanał dystrybucji to
plik w gałęzi, a nie wydanie GitHub, bo tworzenie wydań jest w tej sesji zablokowane. Jeżeli koordynator chce wydania
`owner-visual-005t`, musi je utworzyć ktoś z uprawnieniem do releases, z tym samym plikiem (SHA-256 powyżej), jako
prerelease bez „latest”.

Werdykt: `OWNER_005T_TWO_HOUSES_APK_READY_FOR_VISUAL_REVIEW`. Plik jest gotowy do pobrania z gałęzi. Wydania GitHub
nie ma. OWNER_VISUAL_NOT_RUN.
