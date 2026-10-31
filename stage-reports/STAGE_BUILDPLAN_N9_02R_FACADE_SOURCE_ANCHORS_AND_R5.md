# STAGE BUILDPLAN N9-02R — kotwice fasady ze źródła i spójność R5

**Wersje i baza:**
- Gałąź: `claude/new-session-3kzcgh`.
- Baza: `10bdce8` (N9-02A, PARTIAL).
- Solver 2.17.0, model 1.7.0 i czytnik wymiarów 1.5.0 pozostały **bez zmian**.
- Usługa analizy: 1.4.0 → **1.5.0**; `assessment`: 1.1.0 → **1.2.0**. Obie zmiany są addytywne.

**Artefakty i ZIP:**
- Artefakty tekstowe: `stage-reports/artifacts/analyzer-n9-02r/`.
- ZIP dla OWNER-a (oryginały ARCHON i nakładki, tylko poza repozytorium): `BuildPlan-N9-02R-Facade-Source-Anchors-Before-After.zip`.

## Werdykt w dwóch częściach, raportowanych osobno

| część | wynik |
|---|---|
| **Spójność R5** (jedna podstawa ważności osi dla R5, `elevationRegistration` i `sourceUnchecked`) | **TAK — naprawiona i wdrożona** |
| **Więcej poprawnie zarejestrowanych źródeł** (ekstraktor kotwic fasady) | **NIE** — ekstraktor przeszedł świeży syntetyczny holdout (18/18 trafnych przyjęć, 0 fałszywych), ale na rzeczywistych renderach ARCHON odmówił 44/44 widoków. Zgodnie z §E.5 **nie jest włączony do produkcji** i zostaje modułem badawczym |

Werdykt etapu: **PARTIAL**.

## 1. FIRST_BAD sprzeczności R5 (`R5_TRACE.md`)

**Kolejność wywołań w bazie:**
- `assessModelDetailed` liczył relacje **przed** `elevationRegistrationOf`.
- `elevationRelation` oceniał każdy widok, który solver zarejestrował, na rezyduach `verifyAgainstViews` zmierzonych w transformacji solvera.
- Do pozycji R5 dopinał tylko etykietę `axes`. Żaden status R5 nie czytał adjudykacji osi.
- `sourceUncheckedOf` brał osie z `use` solvera, a nie z adjudykacji.

**Sprzeczne widoki w bazie:**
- **Trytomach FRONT …7b06:** R5 CONFLICT przy zakwestionowanej osi ALONG. Solver ma 0,016046 m/px, a dwa zgodne pasma 0,014677 i 0,014694 m/px (8,5 %).
- Pion odrzucony przez sam solver (grunt poza pozostałymi widokami), mimo to R5 liczył wysokości:
  - Rarytasy LEFT …1417: CONFLICT;
  - Rarytasy RIGHT …8aba: PASS;
  - Sasanki FRONT …a66b: CONFLICT;
  - Sasanki REAR …e411: CONFLICT.
- **A01 LEFT …7854:** te same wysokości były liczone, ale statusu nie zmieniały.
- **Kontrola szerokości budynku (`SILHOUETTE_WIDTH`) była kołowa** na każdym widoku zarejestrowanym przez rozpiętość z rzutu: transformację zrobiono, przypisując końcom pasma rozpiętość z rzutu, a szerokość modelu to ta sama rozpiętość.

## 2. Poprawka: jedna podstawa ważności

**Adjudykacja osi:**
- `elevationRegistration` liczy się pierwsze.
- `validityOf` daje każdemu widokowi `along` / `vertical` ∈ {VALID, SPAN_ONLY, DISPUTED, UNAVAILABLE} oraz `hand`.
- DISPUTED niesie mierzoną sprzeczność:
  - `SOLVER_REGISTRATION_CONTESTED`;
  - `OPPOSITE_VIEWS_DISAGREE`;
  - `OFF_SHEET_SCALE`;
  - `GROUND_OFF`;
  - `SOLVER_REFUSED_LOW_HEIGHTS`.
- Znaczniki są ustawiane dokładnie tam, gdzie N9-02A już podejmowało te decyzje. **Nie dodano żadnego nowego progu.**

**R5 deklaruje, czego potrzebuje każda kontrola (`checkValidity`):**
- Wysokość (parapet, nadproże, krawędź dachu, pas, wiatrownica) wymaga ALONG i VERTICAL.
- Położenie wzdłuż elewacji (lico uskoku) wymaga ALONG, a VERTICAL nie może być DISPUTED.
- Szerokość jest CIRCULAR na widoku zarejestrowanym rozpiętością.

**Liczenie kontroli:**
- Liczą się tylko kontrole VALID.
- Gdy wymagana oś jest DISPUTED, a nic ważnego nie zostaje: **UNCHECKED / REGISTRATION_DISPUTED**. Zachowane zostają:
  - surowe rezydua (`checks[]`, `measured.rawObserved/rawOutsideTolerance/rawWorst`);
  - hipoteza solvera (`solverMpp`);
  - pomiar sporu (`alongDispute` / `verticalDispute`).
- Każda kontrola ma `requires`, `transform: SOLVER_REGISTRATION`, `sharedWithModel` i `modelAnchored`.

**`sourceUnchecked` opowiada tę samą historię:**
- osie FULL / SPAN_ONLY / DISPUTED / NONE z adjudykacji;
- `extent: NONE` tam, gdzie R5 nie wykonał żadnego porównania.

**Licznik P/E/I** (`elevationRegistration.scorecard`):
- P — potencjalne sloty;
- E — porównania wykonane na ważnych osiach;
- I — porównania niezależne od modelu.
- Web pokazuje licznik w wierszu elewacji i ważność każdej osi. Android pokazuje go w wierszu „Porównania elewacji”.

## 3. Wynik na 8 domach (jedna regresja, produkcyjny `runAnalysis`)

**Stabilność:**
- Hash kandydata, modelu, sceny i metryk jest **identyczny z N9-02A w 8/8** (`model-hashes.json`). Jest też identyczny z zamrożeniem na obu działających kontrolach.
- Poprawność techniczna, kompletność, R1, R3 i R4 bez zmian.
- Klasy 32 elewacji bez zmian: FULL 10 / ALONG_ONLY 12 / VERTICAL_ONLY 0 / UNREGISTERED 10.

**R5 na 32 elewacjach:** PASS 2 / CONFLICT 6 / UNCHECKED 24 → **PASS 2 / CONFLICT 2 / UNCHECKED 28**. Każda zmiana ma uzasadnienie dla konkretnego widoku (`R5-AND-UNCHECKED.md`):

| widok | przed → po | dowód |
|---|---|---|
| Trytomach FRONT …7b06 | CONFLICT → UNCHECKED REGISTRATION_DISPUTED | ALONG zakwestionowany (8,5 %). Zachowane: 7 rezyduów, 4 poza tolerancją, skala solvera i oba pasma |
| Rarytasy LEFT …1417 | CONFLICT → REGISTRATION_DISPUTED | VERTICAL: solver sam odrzucił niskie wysokości (grunt poza pozostałymi widokami) |
| Sasanki FRONT …a66b | CONFLICT → REGISTRATION_DISPUTED | jw. |
| Sasanki REAR …e411 | CONFLICT → REGISTRATION_DISPUTED | jw. |
| Rarytasy RIGHT …8aba | PASS → REGISTRATION_DISPUTED | jw. (PASS stał na krawędzi dachu w odrzuconym pionie i na kołowej szerokości) |
| A01 LEFT …7854 | DISAGREEMENT_NOT_STABLE → REGISTRATION_DISPUTED | jw. |
| Marcówki LEFT …9a66 | DISAGREEMENT_NOT_STABLE → PASS (zakotwiczony w modelu) | jedyna niezgodna kontrola to kołowa szerokość (+0,31 m), a 3 ważne kontrole się zgadzają |

**Prawdziwe konflikty na ważnych osiach zostają:**
- Rarytasy FRONT …5de5: parapet −1,97 m, krawędzie dachu ok. −0,5 m.
- Rarytasy REAR …c383.
- Lipienniki 6 (kontrola): 2 widoki.

Podgląd 3D jest dostępny w każdym przypadku. Nowe e2e otwiera model przy CONFLICT i przy UNCHECKED.

**P/E/I:**
- P = 196 (bez zmian).
- **E = 85** wobec 139 obserwacji liczonych wcześniej. 54 rezydua nie są już traktowane jako dowód o modelu (sporna oś albo kontrola kołowa). To korekta, nie utrata zweryfikowanej architektury.
- **I = 0.** Każda kontrola R5 szuka krawędzi przy przewidywaniu modelu, a skala wzdłuż elewacji pochodzi z rozpiętości z rzutu. Nie nazywam tego niezależnym potwierdzeniem.

## 4. Ekstraktor kotwic fasady (badawczy) — ocena uczciwa

**Holdout zamrożony przed pierwszą linią ekstraktora** (`holdout-manifest.json`, `holdout-freeze.txt`, lokalny commit `ca8ec88`):
- 30 arkuszy z seeda 92021: ACCEPT 18, REFUSE 10, EITHER 2.
- Rodziny:
  - fasady kolorowe i dwumateriałowe;
  - ciemne obok białych;
  - szczyt z kominem;
  - drzewo przed środkiem i nad końcem;
  - pergola wolnostojąca oraz ekran przy okładzinie;
  - balkon wychodzący za ścianę;
  - rysunek kreskowy;
  - dach płaski;
  - biel na białym niebie;
  - arkusz ucięty;
  - perspektywa;
  - zasłonięty dom.
- Dokładna prawda: końce ścian, okap, kalenica, grunt, m/px, otwory.

**Czytnik** (`packages/analysis-service/src/assessment/facade-anchors.ts`, klasyczny, na oryginalnym RGB):
- Tło to kolor marginesu wiersza połączony z brzegiem arkusza. Roślinność zasłania, a nie kończy ścianę.
- Fasada wielomateriałowa jest jednym biegiem zabudowy.
- Koniec ściany musi spełniać cztery warunki:
  - być pionowy (pochylenie oznacza perspektywę);
  - stać na gruncie;
  - mieć nad sobą okap lub dach;
  - nie biec dalej przez dach (to linia cięcia).
- Komin nie jest kalenicą.
- Każda kotwica ma piksele, niepewność, wsparcie i powód. Czytnik nie widzi modelu.
- Rozwój odbywał się wyłącznie na seedach deweloperskich 7, 11 i 23. Holdout oceniono **raz**; po ocenie zmienił się tylko komentarz w nagłówku pliku.

**Wyniki:**

| zbiór | trafne przyjęcia | fałszywe przyjęcia | fałszywe odmowy | trafne odmowy |
|---|---|---|---|---|
| holdout — czytnik N9-02A (pasmo neutralne) | 8 | **3** | 10 | 9 |
| holdout — czytnik N9-02R | **18** | **0** | 0 | 12 |
| 32 elewacje ARCHON + 12 widoków kontroli | 0 | 0 | — | 44 odmowy (37 „zasłonięte przez roślinność”, 7 „brak pionowej krawędzi”) |

**Dlaczego na ARCHON nie działa** (plansze w ZIP, `reader/`):
- Rendery mają drzewa **za** domem, stykające się z końcami ścian. Sam kolor nie odróżnia drzewa za ścianą od drzewa przed nią.
- Białe ściany zlewają się z białymi chmurami.
- Znak wodny przecina krawędzie.
- Holdout tych klas nie zawierał.

Czytnik odmawia uczciwie (0 fałszywych przyjęć), ale niczego nie zyskuje. Włączenie go zamieniłoby rejestracje N9-02A na odmowy. Mierzyłem to na przerwanym przebiegu z czytnikiem w produkcji: A01 traci SPAN_ONLY, a syntetyczny Larchfield (dach rysowany samymi liniami) traci widoki boczne.

**Decyzja (§E.5):** czytnik nie jest wywoływany przez produkcję ani eksportowany z indeksu oceny. Testy i sonda zostają. W produkcji działa pasmo z N9-02A.

## 5. Kontrole ARCHON z N9-02A (`CONTROLS.md`, bez prawdy, nie strojone)

- **Kruszczyki 22:** hashe identyczne z zamrożeniem; R5 bez zmian.
- **Lipienniki 6:** hashe identyczne z zamrożeniem; R5 bez zmian, oba konflikty na osiach FULL zostają.
- **Skalnice 3:** solver nadal pada (RECONSTRUCTION_FAILED); niczego nie dopisano.
- Czytnik badawczy: 12/12 odmów, 0 fałszywych przyjęć.

## 6. Testy (celowane i jedna regresja; bez pełnego CI i bez APK)

**Wyniki celowane:**

| test | wynik |
|---|---|
| `facade-anchors-n9-02r.test.ts`: holdout; wszystkie przypadki z §F (kolor, brak kalenicy, biel na bieli, drzewo, pergola, komin, ręka L/P, myląca skala, sporna transformacja → UNCHECKED, ważna transformacja i realna niezgodność → CONFLICT, brak osi → nic, czytnik nie zna modelu) | 17/17 |
| N9-02A `elevation-axes-n9-02a.test.ts` | 16/16 |
| N9-01 `assessment-n9-01.test.ts` | 24/24 |
| web `apps/web/src/analyzer` | 20/20 |
| kontrakt TS (nowa migawka `analyzer-contract-current/`; migawka legacy 2.3.0 nietknięta; zmiana addytywna) | 3/3 |
| Kotlin: `CurrentServerContractTest` (1.5.0, scorecard) | 1 |
| Kotlin: `RealServerContractTest` | 2 |
| Kotlin: `AnalyzerContractTest` | 12 |
| Kotlin: `ResultHeadlineTest` | 10 |
| Kotlin: wszystkie powyższe łącznie | 25/25 |
| e2e `analyzer.spec.ts`, w tym nowe: model otwiera się przy CONFLICT i przy UNCHECKED | 6/6 |
| typecheck (root i web) | czysty |

**Zestaw `vitest` z katalogu głównego:** 3236 PASS, 15 FAIL.
- **12 to znane, historyczne porażki, identyczne z bazą** (lista w `logs/`):
  - `/health` przypina solver;
  - 005Q wymaga commitu `04d5568`;
  - izolacja badań;
  - reference / compound-facade.
- **2 kolejne odtwarzają się na bazie bez tej zmiany** (`apps/local-analyzer`):
  - `text.test` NFD (losowy przypadek kanonicznego porządku);
  - `program.test` Larchfield hash.
  - Obie są poza zakresem N9-02A, więc wcześniej nie były widoczne. Nie poprawiam ich.
- **1 była nieaktualną migawką kontraktu.** Zebrano ją ponownie dla finalnego kodu i test przechodzi 3/3.

**Wydajność:** czas biegu i pamięć bez istotnej zmiany (`PERFORMANCE.md`). Czytnik badawczy kosztuje ≤ 176 ms na elewację i nie jest uruchamiany w produkcji.

## 7. Ograniczenia (`LIMITS.md`)

- I = 0 wszędzie.
- Sporny pion odkłada wszystkie wysokości.
- Szerokość nie liczy się na widokach rejestrowanych rozpiętością.
- Holdout nie zawiera drzew w tle, chmur, znaków wodnych ani dachów rysowanych liniami.
- Brak prawdy ręcznej na ARCHON.
- Błędy rejestracji własnej solvera (Trytomach FRONT; Larchfield FRONT/REAR −9,5 %) są zgłoszone jako DISPUTED, nie poprawione.

**STOP.** Nie zaczynam N9-02B / R6 ani N9-03. Nie budowałem APK.

Status: **PARTIAL_N9_02R** — spójność R5 naprawiona; liczba poprawnie zarejestrowanych źródeł nie wzrosła.
