# STAGE BUILDPLAN N9-00 — audyt systemowy po N8-03D2

| | |
|---|---|
| Baza | `0d03d60e01083a5a597e1487cd9cf8d5206f04cf` (zweryfikowany pełny SHA, czyste drzewo) |
| Wersje | solver 2.17.0, schemat `CanonicalBuildingModel` 1.7.0, czytnik metryk 1.5.0 |
| Gałąź | `claude/new-session-3kzcgh` |
| Charakter | **Audyt.** Bez zmian w solverze, analizatorze, rendererach, kontraktach, schemacie, fixture, kandydatach i wersjach. Bez reseal, APK i pełnego CI. Bez dotykania tajnego domu OWNER-a. Obrazy ARCHON nie trafiły do repozytorium. |
| Dodane do repo | Wyłącznie dokumenty, JSON i trzy sondy tylko do odczytu w `research/analyzer-n9-00/`. |

## Klasyfikacja i metoda

Każda teza ma jedną klasę:
- **CV** (CODE_VERIFIED): linia kodu przeczytana;
- **RV** (REPLAY_VERIFIED): offline replay na zapieczętowanych wejściach;
- **RO** (REPORT_ONLY): z raportów etapów;
- **H** (HYPOTHESIS).

Przegląd kodu zrobiły trzy niezależne przeglądy tylko do odczytu: mapa ścieżki, semantyka bramek i streszczenie raportów N7/N8/IU. Ich kluczowe twierdzenia sprawdziłem ponownie w kodzie:
- `body-completeness.ts:248-261` i wywołanie w `reconstruct-v2.ts:2700`;
- `structural-audit.ts:172-179` z wagą NOTED;
- `emit.ts:592`;
- `AnalyzerScreen.kt:680-696`;
- `job.ts:126-130`;
- odczyt `emitted.*`.

Replay objął 8 zamrożonych domów, uruchomionych przez `reconstructV2` w wersji 2.17.0 (`coverage-probe.ts`). Zestawu kontrolnego spoza korpusu lokalnie nie ma: **`NOT_AVAILABLE`**.

## Odpowiedź w jednym zdaniu

BuildPlan liczy porównania ze źródłem (rezydua elewacji, zgodność fasad, audyt widoków, diagnostyka kompilatora), ale **żadne z nich nie wchodzi do werdyktu**. Werdykt porównuje model z własną dekompozycją analizatora, z bramką układu i z odmowami poleceń (CV). Do tego relacje, które złapałyby klasy błędów z N8, w ogóle nie istnieją:
- dach w dachu;
- ściana na pustym papierze;
- obrys kondygnacji;
- strop w przekroju;
- numery pokoi.

Dlatego każdy błąd N8 znalazł człowiek patrzący na planszę ARCHON, a nie potok.

## 1. Co naprawdę sprawdzamy

Pełna tabela jest w `artifacts/analyzer-n9-00/validation-gap-matrix.md`.

- **`geometry ok`, `WALLS_OVERLAP`, poprawność 3D.** To spójność modelu ze sobą: schemat, odwołania, otwory w gospodarzu, triangulacja, brak nachodzących ścian (CV, `validate.ts`, `topology.ts:494-533`, `compile.ts`). „geometry ok” = 0 diagnostyk kompilatora (`StatusBar.tsx:9-10`).
  - Nie ma relacji dach↔dach, ściana↔rysunek, strop↔rzut ani pokój↔pokój.
  - `run.ts` w ogóle nie czyta `scene.diagnostics` (CV).
- **`COMPLETE` / `COMPLETE_WITH_OPEN_QUESTIONS` / `PARTIAL`.** Werdykt ma trzy wejścia: `bodyCompleteness` (bryły wobec **własnej przyjętej dekompozycji**, `basis: 'ACCEPTED_DECOMPOSITION'`), powody bramki układu i liczbę odmów modelu (CV).
  - **To kompletność odczytu, a nie wierność ARCHON.** Kod mówi to sam: „proves nothing about what the decomposition never enclosed” (`body-completeness.ts:46-49`).
- **`viewAudit`, `crossViewResiduals`, `quality`, `ledger`, `facadeAlignment`.** Wszystkie są liczone, ale nic z nich nie trafia do werdyktu:
  - `viewAudit`, `crossViewResiduals` i `facadeAlignment` nie mają w produkcji żadnego czytelnika (grep, CV);
  - `quality` to poziom proweniencji, a nie poprawności;
  - `ledger` sprawdza, że każdy dowód ma dyspozycję, a nie że jest ona trafna.
- **Wiarygodność wobec rzutów i czterech elewacji** (RV, 8 domów):
  - 32 elewacje: zarejestrowane w pełni 14, częściowo 7, **niezarejestrowane 11**;
  - kontrola krzyżowa zarejestrowanych widoków: **DISAGREES 10**, MIXED 3, AGREES 1;
  - przekrój nigdy nie jest rejestrowany jako widok (8/8);
  - **żaden dom nie jest PARTIAL**, a Rarytasy mają **COMPLETE** przy 4/4 widokach DISAGREES.
- **Sześć przypadków, które nie obniżają werdyktu** (CV):
  - niezarejestrowana elewacja (NOTED);
  - brak otworu (elewacyjny MISSING_IN_MODEL „reported, not built”; drzwi wewnętrzne < 0,5 m pominięte bez śladu w `emit.ts:592`);
  - brak pustki (nieczytana albo cicho odrzucona w `emit.ts:366-372`);
  - dach w dachu (brak relacji);
  - scalony pokój (pokoje nie są wejściem werdyktu);
  - złe przejście (brak relacji przejście↔rzut).

## 2. Dlaczego dane ginęły

Pełna macierz jest w `artifacts/analyzer-n9-00/root-cause-matrix.md`: 12 klas N8 i klasy N7, z FIRST_BAD, utratą informacji, fałszywą geometrią, bramką, poprawką i testem.

Wspólny kształt wszystkich klas (RO dla FIRST_BAD, CV dla bramek):
1. **FIRST_BAD zawsze leży w odczycie**: dekompozycja rzutu, rejestracja skali, składanie drzwi, czytanie pustki, emisja dachu. Nigdy w modelu ani w kompilatorze.
2. **Żadna istniejąca kontrola, która mogłaby oblać bieg, nie porównuje wyniku ze źródłem.**
   - Kontrole, które porównują (`verifyAgainstViews`, `alignFacades`, `viewAudit.lost`), często widzą problem, ale nie są wejściami werdyktu.
   - Kontrole, które są wejściami, porównują model z odczytem albo z samym sobą.

Każdy z 10 testów N8 jest niezależny od nazwy domu (pliki wymienione w macierzy). Chronią one jednak *poprawkę*, a nie *wykrywanie* klasy błędu w nowym domu.

## 3. Ile źródeł faktycznie użyto

Pełne dane per dom są w `artifacts/analyzer-n9-00/source-coverage-8.json` (RV).

| rola | obrazy (8 domów) | użycie |
|---|---|---|
| PLAN | 56 ramek (4–8 na dom) | Czytany jeden rzut na kondygnację: 2 na dom, Cieszynianka i Rarytasy po 1. Reszta to kopie, inne wydania i warianty lustrzane. |
| ELEVATION | 32 | FULL 14, PARTIAL 7, UNREGISTERED 11. Goździkowce: 4/4 niezarejestrowane, bo brak rzędnej kalenicy. |
| SECTION | 8 | Tylko rzędne poziomów, kalenica i okap. Nigdy rejestrowany ani sprawdzany jako widok (CV, RV). |
| PERSPECTIVE | 101 | 30 rozwiązanych kamer służy tylko porządkowi głębokości. 71 nieużytych. Żadna perspektywa nie zmienia geometrii (CV). |
| SITE_PLAN | 8 | Brak ekstraktora (CV). |

**Dowody metryczne:** 1074. Z tego **498 (46 %) jest UNATTACHED**, czyli odczytanych na arkuszu, ale niepodpiętych pod żadną mierzalną cechę. Najczęściej są to wywołania otworów: np. w Arganiach 60 z 71.

**Otwory:**
- odczytane z rzutu: 105;
- niezależne odczyty z elewacji: 29;
- otwory w modelach: 189 (w tym drzwi wewnętrzne), z czego **36 ma wysokości ASSUMED**;
- zgodność fasad: CONFIRMED_MATCH 11 na 102 sklasyfikowane otwory planu, przy czym dopasowanie nie jest niezależne od planu (CV).

**Obiekty modelu bez dowodu:**
- `doors`, `windows`, `wallJunctions` i `levels` nie niosą własnego `evidence` (NO_EVIDENCE, RV), a dowód mają tylko otwory, które je niosą;
- schody są UNRESOLVED.

**`NOT_MEASURED`:**
- trafność wobec niezależnie oznaczonej prawdy (nie istnieje);
- liczba pomieszczeń i stref widocznych a modelowanych na kondygnację (oznaczone ręcznie tylko dwa poddasza z N8-03D2);
- kominy i okna dachowe widoczne a modelowane.

## 4. Ryzyko N8-03D2: schemat i Android

Pełny opis jest w `artifacts/analyzer-n9-00/schema-android-contract-audit.md`.

| ryzyko | ocena | podstawa |
|---|---|---|
| MODEL_SCHEMA_COMPATIBILITY | **LOW** | RV. 14 fixture (1.0.0–1.7.0) i 8 modeli 1.6.0 wczytuje się z migracją. Ponowny zapis i odczyt jest **idempotentny** (22/22). 0 błędów kompilacji. Stary czytnik odrzuca plik 1.7.0 po nazwie wersji, nie czyta go źle. |
| CANDIDATE_REPLAY | **LOW** | RV. 3/3 kandydatów odtwarza się do swojego `modelHash`; łańcuch reseal jest bajt w bajt. |
| MOBILE_SCENE_CONTRACT | **LOW** | CV. Paczka sceny 1.0.0 bez zmian, parser z `ignoreUnknownKeys`. `modelSchemaVersion` jest tylko wyświetlany. Otwory pokoju dochodzą jako trójkąty. Testy Kotlin i APK **NOT_RUN**. |
| MOBILE_SCENE_CONTENT (005T) | **LOW-MEDIUM** | RV, niezależnie od N8-03D2. Dwie sceny OWNER-a mają błędy kompilacji (8 + 1 × `OPENING_ABOVE_WALL_TOP`), a eksport ich nie blokuje. |
| ANALYZER_API_CONTRACT | **MEDIUM** | Szczegóły niżej. |
| VIEWER_RUNTIME | **LOW** | RO i CV. Przeglądarka po przebudowie renderuje modele 1.6.0 i 1.7.0. Przeglądarka sprzed 1.7.0 nie otworzy nowych modeli (zgodnie z założeniem). |

**ANALYZER_API_CONTRACT, czyli nieprzechodzący test** `apps/analyzer-api/test/android-contract.test.ts`:
- Fixture `result.json` pochodzi z solvera **2.3.0** (005L, `79e9bbc`, 2026-10-07). Test jest czerwony od pierwszego podniesienia solvera (≤ `f6d1532`, 2.4.0, 2026-10-22), a nie od N8-03D2.
- Różnica jest **wyłącznie addytywna** (RV):
  - 52 nowe ścieżki, 0 usuniętych;
  - kształt `scene.json` i `status-completed.json` się nie zmienił;
  - zmieniły się wartości: hashe, liczniki, wersje i inny budynek dla syntetycznego zlecenia.
- DTO Androida są tolerancyjne (CV).
- Fixture **nie** zostały odświeżone, bo odświeżenie dla zielonego testu jest zabronione. Ich przechwycenie i przegląd to osobny, świadomy krok.

## 5. Geometria a semantyka pomieszczeń

Pełna analiza jest w `artifacts/analyzer-n9-00/semantic-space-room-analysis.md`.

| dom | regiony | pomieszczenia w tabeli ARCHON | co się łączy |
|---|---|---|---|
| Arganiach | 6 | 8 | 2+3 oraz 1+8 |
| Trytomach | 8 | 9 | 1+2 |

Rzut nie rysuje między tymi pomieszczeniami granicy. Jako geometria to jest **poprawne**, jako semantyka **niepełne**: znikają nazwane pomieszczenia (Garderoba, Schody).

Propozycja, tylko w projekcie:
- **SpaceRegion**: geometria wyłącznie z rysunku, z opisanymi granicami.
- **FunctionalRoom**: istnienie, nazwa i powierzchnia z opublikowanej tabeli; położenie wyłącznie z pionowo odczytanego numeru (LOCATED / LOCATED_SHARED / UNLOCATED).

Zasady:
- Tabela jest niezależnym dowodem **istnienia**, a nigdy geometrii. Niczego nie dzieli i nie łączy.
- Powierzchnia sprawdza przypisanie, nigdy go nie wybiera.

Etykiety zgubione w N8-03D2 przez regułę „tylko pionowy odczyt” były w części fałszywe. „Hol” na łazience pochodził z cyfry wymiaru. Część była trafna tylko przypadkiem, np. „Łazienka” ze znaku wodnego. Reguła jest poprawna, a słaby jest sam odczyt numerów. Odczyt pionowy i obrócony tego samego tuszu to **jeden** dowód, nie dwa.

## 6. Dlaczego image→sketch pogarszało analizę

Projekt jest w `artifacts/analyzer-n9-00/target-architecture.md` §4.

Zmierzone wyniki (RO, IU-02 §7.2, 5 domów DEV):

| | surowe | po czyszczeniu |
|---|---|---|
| odczyty otworów | 36 | 21 |
| zarejestrowane widoki | 15 | 11 (9 z linią gruntu) |
| A01: odczyty / widoki | 14 / 4 | 0 / 0 |

Przyczyny (RO z IU-03A, odwzorowane na kod, CV). Czyszczenie **zastąpiło** obraz, na którym czytniki działały, i każda zmiana usunęła wskazówkę, od której zależał któryś czytnik:
- białe tło czyta się jako pasmo ściany, co daje złą skalę;
- zniknęła linia gruntu, więc pada rejestracja;
- jasne szkło jest niewidoczne dla czytnika szkła;
- komin wziął się za kalenicę.

Kontrakt równoległy:
- Oryginalny RGB jest niezmienny i tylko on służy do pomiaru.
- Obok niego powstają warstwy w pikselach źródła: OUTLINE, OPENING, GLASS, GROUND_LINE, TERRAIN, EAVES, RIDGE, CHIMNEY, OCCLUDER, UNCERTAIN.
- Każda warstwa ma nazwę semantyczną, confidence i provenance (metoda i wersja) oraz trafia do klucza cache.
- Warstwa może **zawężać** obszar czytania albo **podsuwać kandydata** sprawdzanego potem na RGB. Nie może podmieniać pikseli.
- Warstwę wolno przyjąć tylko po A/B na relacjach ze źródłem, mierzonych trafnymi odczytami, a nie liczbą odczytów.

## 7. Co wdrożyć jako pierwsze

Docelowa architektura jest w `artifacts/analyzer-n9-00/target-architecture.md`, propozycja etapu w `artifacts/analyzer-n9-00/first-systemic-stage-proposal.md`.

**Architektura (H).** Trzy wyniki zamiast jednego:
- `TECHNICAL_PASS`;
- `SOURCE_FIDELITY` per relacja;
- budżet `SOURCE_UNCHECKED`.

Nad nimi rejestr relacji SOURCE→MODEL i MODEL→SOURCE (R1–R10), liczony na **wyemitowanym** modelu. Do tego rejestracja elewacji częściowa per oś (wzdłuż / wysokość / skala), żeby widok bez kalenicy nadal mógł sprawdzić pozycje otworów.

**Pierwszy etap (N9-01, do decyzji OWNER-a).** Niczego nie czyta na nowo i nie zmienia geometrii ani schematu:
- A. diagnostyka kompilatora jako część `TECHNICAL_PASS`;
- B. budżet `SOURCE_UNCHECKED` z już liczonych `viewAudit` i rejestracji;
- C. kontrola krzyżowa DISAGREES na zarejestrowanym widoku jako FAIL;
- D. R1: najwyżej jedna warstwa dachu;
- E. R3: ściana stoi na tuszu rzutu;
- F. R4: obrys kondygnacji wobec narysowanych ścian zewnętrznych.

**Dlaczego ten etap:**
- Jest najtańszy, bo dane już istnieją.
- Wykryłby na kodzie z tamtego czasu co najmniej 7 z 10 klas N8, a do tego F-R1 i E-4 z N7 (H).
- Nie jest dobrany pod dwa znane domy: każda relacja jest niezmiennikiem budynku albo rysunku.

**Dowód dla R1** (RV): na modelach sprzed N8-03C daje 15,60 m² (Sasanki) i 11,45 m² (Rarytasy) podwójnego dachu, a na dzisiejszych 0 (`r1-roof-layer-replay.json`). Oba złe modele były COMPLETE lub COMPLETE_WITH_OPEN_QUESTIONS, z „geometry ok”.

**Testy akceptacyjne:** syntetyczne rysunki i modele, które z konstrukcji naruszają dokładnie jedną relację, bez nazw domów. Fałszywe alarmy trzeba mierzyć na zestawie kontrolnym z niezależną anotacją. Takiego zestawu brak (`NOT_AVAILABLE`), musiałby go dostarczyć OWNER.

**Pozyskanie niezależnej prawdy:** ręczna anotacja rysunków w pikselach źródła (ściany per kondygnacja, otwory per elewacja, punkty numerów pokoi, krawędzie stropu w przekroju) na zbiorze nieużywanym do strojenia. Opis ARCHON, OCR i model nie są trzema potwierdzeniami tej samej obserwacji.

## Artefakty

W `stage-reports/artifacts/analyzer-n9-00/`:
- `module-map.md`;
- `root-cause-matrix.md`;
- `source-coverage-8.json`;
- `validation-gap-matrix.md`;
- `schema-android-contract-audit.md`;
- `semantic-space-room-analysis.md`;
- `target-architecture.md`;
- `first-systemic-stage-proposal.md`;
- wyniki sond: `schema-probe-result.json`, `contract-diff-result.json`, `r1-roof-layer-replay.json`.

Sondy tylko do odczytu:
- `research/analyzer-n9-00/coverage-probe.ts`;
- `research/analyzer-n9-00/schema-probe.ts`;
- `research/analyzer-n9-00/contract-diff.ts`.

## Czego nie zrobiono

- Nie wdrożono żadnej rekomendacji.
- Nie zaczęto N9-01, N8-03E ani N8-03F.
- Nie odświeżono fixture kontraktu.
- Nie uruchomiono pełnego CI, testów Kotlin ani APK.
- Nie dotknięto tajnego domu OWNER-a.

## Status

**PASS** — audyt jest poparty dowodami: kod (CV), replay (RV) i raporty (RO).

Zastrzeżenia, każde nazwane w treści:
- brak zestawu kontrolnego (`NOT_AVAILABLE`);
- brak niezależnie oznaczonej prawdy (`NOT_MEASURED`);
- testy Kotlin i APK nieuruchomione.
