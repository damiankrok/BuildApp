# STAGE BUILDPLAN N9-02A — systemowa rejestracja elewacji na niezależnych osiach

## Podstawowe dane

**Wersje i baza:**
- Gałąź: `claude/new-session-3kzcgh`.
- Baza: `f113a7b` (N9-01).
- Solver 2.17.0, model 1.7.0 i czytnik 1.5.0 pozostały **bez zmian**.
- Usługa analizy: 1.3.0 → **1.4.0**; `assessment`: 1.0.0 → **1.1.0**. Obie zmiany są addytywne.

**Artefakty i ZIP:**
- Artefakty tekstowe: `stage-reports/artifacts/analyzer-n9-02a/`.
- ZIP dla OWNER-a (plansze na obrazach ARCHON, tylko poza repozytorium): `BuildPlan-N9-02A-Elevation-Registration-Before-After.zip`.

## 1. FIRST_BAD (szczegóły: `FIRST_BAD.md`)

Baseline to regresja N9-01 na tych samych zamrożonych wejściach. Audyt widoków solvera liczy **12/32** elewacji jako `NOT_REGISTERED`. N9-00 podawał 11, ale liczony był na `0d03d60` własną sondą. 11 widoków jest użytych częściowo, 9 to FULL.

Wspólne przyczyny (żadna nie jest wyjątkiem dla Goździkowców):

| klasa | widoki | pierwszy zły etap | gubiony sygnał |
|---|---|---|---|
| F1 strona nieopisanego arkusza z szerokości przy skali liczonej z wysokości | 8 | `views.ts` `chooseSide` | Etykiety FRONT/REAR pozostałych arkuszy już mówią „lewa lub prawa”; pasmo ścian jest narysowane |
| F2 brak rzędnej kalenicy → rezerwowa rejestracja czyta jedną kolumnę | 2 (Goździkowce front, tył) | `reconstruct-v2.ts:813–826` | Ściany w kilku wykończeniach: drewno, drzwi i brama na osi środkowej |
| F3 awaria pionu usuwa poprawny poziom | 2 | `reconstruct-v2.ts:780–795` | Końce pasma na rozpiętości z rzutu nie zależą od gruntu |
| F4 obrys renderu to nie budynek | 2 (+1 w kontroli) | `buildingExtent` → `architecturalBounds` | — (zgłoszone, nienaprawiane: to czytnik) |

## 2. Kontrakt rejestracji (`packages/analysis-service/src/assessment/elevation-axes.ts`)

Każda elewacja ma cztery rozliczalne osie. Każda oś niesie kotwice, alternatywy z miarą i powód odmowy:

- **SIDE:**
  - etykieta wydawcy;
  - **eliminacja etykiet** pozostałych arkuszy: zostaje jedna ściana, albo oś `LEFT_OR_RIGHT` / `FRONT_OR_REAR`;
  - szerokość przy skali arkusza.
  - Dwie nieopisane strony jednej osi zachowują oś z ręką UNKNOWN. Strona nigdy nie jest zamieniana.
- **ALONG:**
  - Końce pasma ściany czytane na **pięciu kolumnach**, nie na jednej. Tło (niebo renderu, papier rysunku) nie jest ścianą. Pasmo **ucięte przez obrys** nie jest końcem ściany.
  - Rozpiętość z łańcuchów rzutu: murowana albo charakterystyczna, a gdy obie się różnią, rozstrzyga skala arkusza. Bez kierunku dostępna jest tylko rozpiętość (`SPAN_ONLY`).
  - Pasmo zabudowy (nie niebo, nie roślinność) jest przyjmowane tylko przy zgodności ≤ 3 % ze skalą arkusza z rejestracji solvera.
  - Obrys o wysokości < 0,6 wysokości domu na arkuszach-rodzeństwie jest odrzucany.
  - Pasma przeciwnych widoków muszą się zgadzać. Ocena odbywa się na migawce stanu, więc kolejność widoków niczego nie rozstrzyga.
- **VERTICAL:**
  - Wydrukowana rzędna kalenicy na **wierzchołku dachu**: plateau górnego obrysu (front/tył) albo przecięcie dwóch połaci (szczyt). Wąskie skoki do 1,5 m, czyli kominy, są wyłączane.
  - Grunt na rysowanym dole: ≤ 0,3 m od wydrukowanego terenu, a bez terenu w cokole −0,9…+0,1 m.
  - **Brak kalenicy daje VERTICAL UNCHECKED, a ALONG zostaje.**
- **SCALE:**
  - `VERIFIED_ISOTROPIC` (jest teren), `ISOTROPY_PLAUSIBLE`, `ALONG_ONLY`, `VERTICAL_ONLY` (sprawdzana wobec skali arkusza, ≤ 5 %) albo `REFUSED`.

**Rejestracja solvera** podlega tym samym testom gruntu. Jest **sporna (UNCHECKED)**, gdy dwa zgodne pasma, tego widoku i widoku przeciwnego, przeczą jej o > 5 %, a pozostałe widoki arkusza nie stoją przy skali solvera.

**Niezależność:** etykiety, wydrukowane rzędne, rysowany wierzchołek i grunt są niezależne od modelu. Rozpiętość z rzutu i rejestracja solvera są oznaczone `shared with model`. Żadna oś nie powstaje z dopasowania do aktualnego modelu.

**Diagnostyka nie zasila solvera.** Nie zmieniają się `facadeAlignment`, `repairFromResiduals` ani R5, więc kandydaci, modele i sceny są nietknięte.

**Integracja jest addytywna:**
- `assessment.elevationRegistration`: widoki, liczniki PRZED/PO, sloty, straty, rzędne.
- `axes` na elementach R5.
- `registration` na pozycjach ELEVATION budżetu niesprawdzonego.
- Panel web: wiersz „elevations registered” i osie każdej pozycji.
- Ekran Androida: wiersz „Elewacje: pełne · tylko poziomo · tylko pionowo · niezarejestrowane” i klasa przy pozycjach.

## 3. PRZED / PO (32 elewacje, produkcyjny `runAnalysis`, pełna tabela: `ELEVATIONS-32.md`)

| | FULL | ALONG_ONLY | VERTICAL_ONLY | UNREGISTERED | sprawdzalne sloty |
|---|---|---|---|---|---|
| PRZED (użycie solvera) | 9 | 11 | 0 | **12** | 198 |
| PO (cztery osie) | 10 | 12 | 0 | **10** | 196 |

**Przybyło:**
- 3 widoki z UNREGISTERED do ALONG_ONLY (rozpiętość i skala, ręka nieznana):
  - A01 `…ad8f`: 0,017029 m/px, 0,09 % od skali arkusza;
  - Cieszynianki `…20f0`;
  - Sasanki `…1c45`.
- 2 widoki z ALONG_ONLY do FULL: Cieszynianki front i tył. Wierzchołek i grunt potwierdzają skalę pasma (grunt −0,25 / −0,28 m bez wydrukowanego terenu).
- Razem **+15 sprawdzalnych slotów** (pozycje i szerokości otworów, końce ścian, wysokości).

**Utracono 1 widok, z miarą:** Trytomach FRONT, FULL → UNREGISTERED (−17 slotów).
- Rejestracja solvera (0,016046 m/px) jest sprzeczna z pasmem frontu (0,014677) i pasmem oraz rejestracją tyłu (0,014694): 8,5 %.
- Inne widoki arkusza niczego nie rozstrzygają, więc żadna skala nie jest brana.
- Na tym widoku N9-01 zgłasza konflikt R5. Może on wynikać z rejestracji, nie z modelu.

**Goździkowce 0/4** (bez wyjątku dla tego domu):
- Front i tył: brak nieobciętego pasma. Pasmo zabudowy frontu jest o 8,6 % za szerokie (balkon i drzewo), a skali arkusza brak.
- Strona `…22c3`: pasmo ucięte przez obrys.
- Strona `…9fc0`: obrys 144 px wobec 536 px na arkuszach-rodzeństwie.
- Bez kalenicy pion jest niemożliwy.

## 4. Kontrole (`CONTROLS.md`)

**Trzy nowe publiczne projekty ARCHON** zostały zamrożone na bazie `f113a7b` przed jakimkolwiek przebiegiem modułu, z sha256 wejść:
- Kruszczyki 22 i Lipienniki 6: **0 zysków, 0 fałszywych przyjęć**. Odmowy są nazwane miarą: obrys 202 vs 402 px; pasmo 7 % od skali arkusza.
- Skalnice 3: bieg kończy się błędem na etapie solvera (`PLAN_LAYOUT_REJECTED`), więc nie ma osi.
- Ponowny przebieg na finalnym kodzie dał te same klasy.

**Jedyna niezależna prawda** to syntetyczny Larchfield, 38 px/m:
- Widoki boczne po N9-02A: −0,15 %.
- Front i tył solvera: **−9,5 %**. N9-02A oznacza je jako sporne.
- Pierwsza wersja modułu bez wykluczenia papieru dawała −12,3 % i została poprawiona przed regresją.

Trafność realna na ARCHON: **NOT_MEASURED** (brak ręcznej prawdy).

## 5. Regresja, testy

**Regresja 8 domów** (produkcyjny `runAnalysis`, zapieczętowane pakiety + grafy):
- Hash kandydata, modelu, sceny (content i sha256) oraz dowodów metrycznych jest **identyczny z N9-01 w 8/8 domach** (`model-hashes.json`).
- Poprawność techniczna, kompletność i statusy R1/R3/R4/R5 bez zmian.

**Testy:**

| test | wynik |
|---|---|
| syntetyczne N9-02A (`elevation-axes-n9-02a.test.ts`, 16 testów): wszystkie 8 wymaganych przypadków + pergola, okap, ucięte pasmo, spór i arbitraż skalą arkusza | 16/16 |
| N9-01 `assessment-n9-01.test.ts` | 24/24 |
| kontrakt TS: nowy snapshot `analyzer-contract-current/`, ścieżki starego 2.3.0 zachowane | 3/3 |
| Kotlin `:app:testDebugUnitTest`: `CurrentServerContractTest` (usługa 1.4.0, `elevationRegistration` sparsowane, rejestracja na pozycjach ELEVATION) | 1/1 |
| Kotlin: `RealServerContractTest` | 2/2 |
| Kotlin: `AnalyzerContractTest` | 12/12 |
| Kotlin: `ResultHeadlineTest` | 10/10 |
| web `apps/web/src/analyzer` | 19/19 |
| e2e `analyzer.spec.ts` (prawdziwy serwer API, nowy wiersz elewacji) | 4/4 |
| typecheck root + web | czysty |
| APK, lint Androida, urządzenie | **NOT_RUN** |

**Zestaw celowany TS:** 512 PASS, 14 FAIL.
- **12 to znane, istniejące porażki, identyczne z bazą** (lista w `logs/`, niepoprawiane):
  - `/health` przypina solver 2.5.0;
  - 005Q wymaga commitu `04d5568` w klonie;
  - testy izolacji badań.
- 2 to limity czasu w `worker.test.ts` przy obciążeniu równoległą regresją. Uruchomione osobno przechodzą 3/3.
- Pełnego CI nie uruchamiałem.

## 6. Ograniczenia (`LIMITS.md`)

- Diagnostyka nie porównuje jeszcze nowych widoków z modelem: to R6 / N9-02B.
- Ręka dwóch nieopisanych boków nie jest rozstrzygana.
- `ISOTROPY_PLAUSIBLE` bez wydrukowanego terenu to konwencja cokołu, nie pomiar.
- Testy brutto tylko odrzucają i mogą odrzucić dobry widok (Goździkowce `…22c3`).
- Błędy własnej rejestracji solvera są zgłoszone, nie naprawione, bo naprawa zmieniłaby modele.

## 7. Werdykt

Mechanizm osobnych osi z kotwicami źródłowymi działa na produkcyjnym wyjściu. Rozdziela poziom od pionu, nie wyłącza ALONG przy braku kalenicy, odrzuca kominy, papier, obcięte pasma i sprzeczne skale, i mówi, co sprawdzono, czego nie, i dlaczego. Modele są nietknięte.

Zysk pokrycia jest jednak skromny:
- niezarejestrowane 12 → 10;
- sprawdzalne sloty 198 → 196, wynik netto z jedną uzasadnioną utratą;
- Goździkowce 0/4;
- kontrole 0 zysków.

Stąd werdykt **PARTIAL**: dostarczona jest bezpieczna część, ale kryterium większego pokrycia nie jest spełnione w slotach.

**STOP.** Nie zaczynam R6 ani N9-02B.

Status: **PARTIAL_N9_02A**
