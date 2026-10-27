# STAGE BUILDPLAN N7-PATCH-04A — kompletność na każdym wyniku, APK 1311

| pole | wartość |
|---|---|
| gałąź | `claude/new-session-3kzcgh` |
| baza | `ca84d35` (follow-up FIX-04: sekcja kompletności w wyniku, `bandLengthM` / `unexplainedLengthM` / `fragments`) |
| zmiana arkusza | `331af1f` |
| solver | `SOLVER_V2_VERSION = "2.9.0"` (bez zmian) |

## Zmiany

- `ca84d35` (zatwierdzone):
  - ekran wyniku pokazuje „Kompletność modelu” przy każdym wyniku z `preview.completeness`;
  - nagłówek uwzględnia `COMPLETE_WITH_OPEN_QUESTIONS`;
  - `body-completeness` rozdziela długość pasma, długość niewyjaśnioną i fragmenty ze współrzędnymi (m i px).
- `331af1f` (`HouseSheets.kt`):
  - arkusz źródła używa tego samego warunku `PreviewOutcome.hasDetails` co ekran wyniku;
  - nagłówek sekcji wynika z werdyktu zapisanego rekordu (`outcomeHeadline`): „Model częściowy 3D” tylko dla rekordu częściowego, „Model zbudowany, z otwartymi pytaniami” dla `COMPLETE_WITH_OPEN_QUESTIONS`, „Model gotowy” dla `COMPLETE`, „Stan modelu” dla starszego rekordu bez `completeness`, który ma tylko wartości prowizoryczne;
  - starszy rekord bez `preview` albo bez `completeness` i bez wartości prowizorycznych nie pokazuje sekcji, jak dotąd.
- Bez zmian: widok 3D, rekonstrukcja, werdykt kompletności, `OWN_WALL_REACH_M = 0.6`, ekstrakcja pasm.

## Testy (celowane)

| test | wynik |
|---|---|
| `ResultHeadlineTest` (nagłówek wyniku, warunek i nagłówek arkusza, starszy rekord) | **7/7** |
| `DownloadedScenesTest`: nowy test rekordów zapisanych przez APK 1310, sprzed FIX-04 i sprzed N7-P1 | nowy test zielony; klasa 20/22 |
| `DownloadedScenesTest`: 2 czerwone (lista scen wbudowanych bez `jarzmianki-005t-visual`, `gozdzikowce-005t-visual`) | czerwone **także na bazie `ca84d35`** (sprawdzone na czystym drzewie); nieaktualne oczekiwanie od 005T, niezwiązane z tą zmianą, nie ruszane |
| `LocalAnalysisTest`, `AnalysisTrackerTest`, `AnalyzerContractTest` | 27/27, 13/13, 12/12 |
| `reconstruction/test/model-completeness-n7-fix04.test.ts` | **8/8** |
| `analysis-service/test/setback-n7-fix04.test.ts` | **8/8** |
| `tsc -p tsconfig.json` (przy `ca84d35`) | czysto |

## Regresja ośmiu domów

Zapieczętowane biegi z FIX-04 odtworzone offline (`second-house.ts`). Porównanie: SHA-256 `model.json` z `stage-reports/artifacts/analyzer-n7-fix04/regression-8-houses.json`.

| dom | model.json | werdykt |
|---|---|---|
| a01, gozd, ciesz, trytomach, arganiach, sasankach3 | identyczny | COMPLETE_WITH_OPEN_QUESTIONS (bez zmian) |
| rary | identyczny | COMPLETE (bez zmian) |
| marcowki | identyczny (`8541ca10…7dcb`) | COMPLETE_WITH_OPEN_QUESTIONS; ściana: `lengthM` 1,794 (niewyjaśnione), `bandLengthM` 9,454 |

Marcówki: fragment niewyjaśniony z = 13,21–15,00 m (px y 758–826). Na rzucie mur garażu kończy się na px 773, około 1,0 m za frontem (zgadza się z wymiarem „100”). Około 1,37 m fragmentu to donica, którą pasmo obejmuje już przy ekstrakcji. Zgodnie z poleceniem nie jest wycinana.

## APK 1311

| pole | wartość |
|---|---|
| plik | `BuildPlan-owner-preview-1311.apk` (= `app-arm64-v8a-debug.apk`), 39 831 846 B |
| SHA-256 | `d964c16e5a732d87d272227ef8f09a2b6d81a034108bf9dffd97ad136b4c4725` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1311** / `0.1311.0-owner` |
| commit | `331af1f` |
| podpis | cert SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da`, ten sam co w 1310; `verify-preview-signature.sh`: ok |
| analizator w APK | `analyzer.mjs` 2 812 647 B, SHA-256 `7e912ddaa1db74a1f8828342bbfc8fcb8445cf68df268139fee693df5be26d16`; `manifest.json` zgodny dla 8/8 plików; `SOLVER_V2_VERSION = "2.9.0"`; zawiera `unexplainedLengthM` |
| uprawnienia | tylko `INTERNET` (+ wewnętrzne uprawnienie odbiornika AndroidX) |

**Publikacja.** Sesja nie ma narzędzia do tworzenia wydań GitHub (FIX-02: 403). APK przekazany bezpośrednio jako plik, bez linku.

## Ograniczenia

- Urządzenia ani emulatora nie było w sesji. Ekranu na telefonie nie oglądałem. Odczyt starszych rekordów jest sprawdzony testem JVM.
- Pasmo przed garażem Marcówek obejmuje donicę; ekstrakcja pasm bez zmian.
