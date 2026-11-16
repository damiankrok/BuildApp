# BuildPlan v3.54.3: pełna pętla korekt źródło → analizator → model

Data: 2026-11-16. Gałąź: `claude/new-session-3kzcgh`. Zamrożony kandydat: `aabc044`. Krótki indeks: [README_V3543.md](README_V3543.md).

Raport jest samodzielny. Prywatne ścieżki (`/home/user/rd/...`) są podane tylko jako miejsce dowodów; wszystkie liczby potrzebne do oceny są w tekście.

---

## 1. Werdykt i stan dostawy

**Co się zmieniło jednym zdaniem.** Do tej kampanii API mogło tylko poprawić odczyt wymiarów; teraz może też wskazać różnicę między zbudowanym modelem a rysunkami, a analizator sam tę różnicę wbudowuje, sprawdza i w razie potrzeby cofa.

**Aksamitki.** API obejrzało końcowy model, wskazało brakującą jaskółkę nad wejściem na rysunku elewacji frontowej, analizator zbudował ją jako lukarnę dwuspadową o stałym identyfikatorze `dormer-front-c50`, a drugie spojrzenie API na nową rewizję potwierdziło ją jako przybliżenie zgodne ze źródłem. To samo przeszło przez publiczne wejście serwera ze świeżym pobraniem strony. Brak wykusza (0,90 m) pozostał i jest nazwany w wyniku.

**Potwierdzenie na 8 nowych domach (4 wydawców).** API wykryło wszystkie 5 lukarn widocznych na rysunkach domów, które miały model; analizator zbudował 3; scorer uznał za zgodną 1. Dwie pozostałe stoją dobrze na swojej bryle, ale sama bryła jest w modelu po złej stronie domu albo dom nie ma garażu. Na domach bez lukarny nic nie dobudowano. Poprawa jakości na nowych domach nie jest więc potwierdzona, a najważniejszy wniosek brzmi: pętla musi najpierw rozstrzygać błędy całej bryły, a dopiero potem dokładać szczegóły.

| Status | Wartość | Uzasadnienie |
|---|---|---|
| IMPLEMENTATION_COMPLETE | **TAK** dla pakietów A, B, C i drugiej rodziny | spójna rewizja metryki; przyjęcie według poprawianej cechy; konsument cechy dachu; klasyfikacja granicy; testy |
| HOST_INTEGRATION_VERIFIED | **TAK, lokalnie** | trzy rzeczywiste zadania przez `POST /v1/analyses` zbudowanego serwera plus zadanie bez tokena, na zamrożonej wersji; serwer działał w tym kontenerze, bez wdrożenia (§13) |
| QUALITY_GAIN | **TAK na DEV, w wąskim zakresie** | 3 odmowy → modele (Aksamitki, sp318422, Supertunie), 1 zbudowana cecha dachu; pozostałe 7 domów bez zmiany modelu |
| TRANSFER_EVIDENCE | **NIEPOTWIERDZONY** jako poprawa jakości; mechanizm zadziałał poza ARCHON | 8 nowych rodzin, 4 wydawców: lukarny wykryte 5 z 5, zbudowane 3, zgodne ze scorerem 1; 0 domów poprawionych według kryterium zapisanego przed biegiem (§10) |
| ANDROID_VERIFIED | **NIE** | brak telefonu i emulatora w tym środowisku; APK nie budowano (§13) |

**Czego ta kampania nie zrobiła.** Nie ma konsumenta dla poprzecznego szczytu, zmiany formy dachu, zamiany widoków i korekty otworów — API zgłasza te różnice, wynik je nazywa, model się nie zmienia. Wykusz Aksamitek nie został zbudowany. Madera nadal nie składa się w prawdziwej skali.

---

## 2. Baza, wersje, flagi, budżet, źródła, odtwarzanie

| Pozycja | Wartość |
|---|---|
| Baza (A0) | `258a3a9` — koniec v3.54.2 z dodatkiem; solver 2.43.0 |
| Kandydat (A1, R, C) | `aabc044`; usługa 1.11.0, solver 2.44.0 |
| Kontrakt konsultanta | 0.2.0; prompt 0.3.0 |
| Model API | `claude-sonnet-5-5`, cennik 2 / 10 USD za milion tokenów (sprawdzony z bieżącą dokumentacją API) |
| Flagi hosta | `ANALYZER_CONSULTANT=pilot`, `ANALYZER_HOUSE_READER=live`, token dostępu ≥ 24 znaki, `ANALYZER_HOUSE_READER_MAX_USD` |
| Domyślnie | pilot wyłączony; bez tokena zadanie idzie ścieżką lokalną i nie kosztuje nic (sprawdzone na hoście) |
| Globalny opis domu | wyłączony na ścieżce konsultanta (`globalDescription: DISABLED` w każdym wyniku) |
| Master Plan | v3.54.3 pod `docs/MASTER_PLAN.md` |
| Protokół | `stage-reports/artifacts/v3543/PROTOCOL_V3543.md`, pieczęć `PROTOCOL.seal` |

**Budżet.** Księga na początku kampanii: 6,243534 USD. Pułap pilota: 24,11036 USD. Stan po kampanii: 9,963222 USD, czyli 3,719688 USD wydane w v3.54.3 w 77 zapytaniach. Limit projektu 100 USD nie został zbliżony. Szczegóły w §12.

**Źródła.** Domy DEV: zapieczętowane pakiety i bajty z v3.54.1, bez ponownego pobierania. Zestaw potwierdzający: 8 nowych pakietów (`research/source-to-model/v3543/sources/`), pobrane raz. Rysunki wydawców i plansze z nimi są poza Gitem.

**Odtwarzanie bez sekretów.**

```
# testy przyczyn i kontrpróby
npx vitest run packages/analysis-service/test/consult-v3543.test.ts packages/reconstruction/test/roof-feature-v3543.test.ts \
  packages/source-metrics/test/metric-revision-v3543.test.ts packages/reconstruction/test/glazed-end-v3543.test.ts \
  apps/analyzer-api/test/consultant-loop-v3543.test.ts
# scorery
/usr/bin/python3 -I research/source-to-model/v3543/roof_features.py --selftest
/usr/bin/python3 -I research/source-to-model/v3543/confirm_score.py --selftest
# odtworzenie zapisanych odpowiedzi API offline (bez klucza, bez kosztu)
npx vite-node research/source-to-model/v3543/consult-run.ts -- --list <lista> --out <katalog> --variant C --replay <katalog zapisanego biegu>
```

Bieg na żywo wymaga klucza w zmiennej środowiska `BUILDPLAN_ANTHROPIC_API_KEY`; klucz nie jest argumentem, nie trafia do logów, Gita ani paczki.

---

## 3. Mapa etapów i zależności

Ścieżka jednego domu, z rzeczywistymi funkcjami:

| Etap | Funkcja | Co produkuje | Kto to konsumuje | Pamięć podręczna |
|---|---|---|---|---|
| 1. Pakiet źródeł | `acquire` → `SourcePackage` (hash treści) | strona, obrazy, fakty tekstowe | wszystko dalej | bajty po hashu adresu; tylko odczyt |
| 2. Graf obserwacji | `runAnalysis` → role ram (rzut, elewacja, perspektywa) | ramy i ich rzutowanie | metryka, rejestracje, spojrzenie na model | brak |
| 3. Dowód metryczny | `extractMetricEvidenceAsync` → `solveFrameMetric` | skala na ramę, łańcuchy wymiarowe, rozpiętości z konsultacji | rekonstrukcja | brak; `reuseMetrics` przenosi dowód między rundami **tylko** przy tym samym hashu pakietu |
| 4. Rekonstrukcja | `reconstructV2` (solver 2.44.0) | `BuildingV2`: bryły, ściany, otwory, dach | emisja, cechy dachu | pamięć rozkładu planu z kluczem obejmującym opcje (w tym sklasyfikowane strony) |
| 5. Cechy dachu | `applyRoofFeatures` | lukarny o stabilnym ID | emisja | brak |
| 6. Emisja i pieczęć | `emitBuilding` → `sealCandidate` | model kanoniczny, `modelHash` | kompilator, wynik | brak |
| 7. Kompilacja | `compileBuilding` → pakiet sceny | siatki, `sceneContentHash` | telefon, widoki dla API | brak |
| 8. Widoki | `renderModelViews` (profil `neutral-flat/1`) | SIDES i AROUND z hashem obrazu | spojrzenie API | brak |
| 9. Pętla | `consultAnalysis` | rundy metryczne, runda granicy, spojrzenia na model, decyzje | wynik hosta | zapis odpowiedzi do odtworzenia offline |
| 10. Wynik | `summaryOf` + `sourceCheck` + `consultation` | podsumowanie dla aplikacji | host, telefon | pliki zadania |

W repozytorium nie ma pamięci wyników z kluczem (sprawdzone wyszukiwaniem po `apps/` i `packages/`). Odtworzenie starego wyniku z pamięci po zmianie kodu nie jest więc możliwe; mimo to wersja solvera została podniesiona do 2.44.0, bo zmieniła się odpowiedź.

## 4. Mieszanie starej i nowej metryki: przyczyna i dowód usunięcia

**Diagnoza (potwierdzona na kodzie sprzed kampanii).** Gdy konsultacja podawała nową skalę, `solveFrameMetric` ustalał skalę ramy, ale łańcuchy wymiarowe policzone wcześniej z własnych (błędnych) odczytów zostawały bez zmian. Model dostawał więc nową skalę i stare pochodne.

**Pomiar na zapisanym dowodzie Aksamitek z v3.54.2.** 19 z 19 segmentów łańcuchów z wartością było niespójnych z aktywną skalą (wartość wydrukowana × skala ≠ odległość własnych kresek, tolerancja 3 px).

**Zmiana.**
- `solveFrameMetric` przyjmuje skalę z konsultacji (`consultedScale`). Jeśli własne odczyty ramy nie rozstrzygają skali, relacja staje się `REPLACED` albo `ADDED`, a **wszystkie łańcuchy są rozwiązywane ponownie w tej skali**.
- Jeśli własne odczyty ramy rozstrzygają skalę, skala zewnętrzna nie jest stosowana, a wynik jest bajt w bajt taki sam jak bez niej.
- Przyjęte rozpiętości z konsultacji stają się zwykłymi łańcuchami ramy (dwie kreski, jeden odczytany segment, pole `consulted`). To operacja `BIND_DIMENSION`.
- `metricCoherence()` to sprawdzian własności: dla każdej pochodnej porównuje wartość ze skalą i z rejestracją.

**Po zmianie.** Na tym samym domu: 0 niespójnych segmentów. sp318422 ma dokładnie 14,02 × 9,58 m, czyli wydrukowane 46'-0" × 31'-5". Aksamitki mają 12,32 × 8,82 m i jawnie nazwany brak 0,90 m na osi X (wykusz).

Testy: `metric-revision-v3543.test.ts` (5), w tym test „przed”, który pokazuje błąd na starym zachowaniu.

## 5. Polityka przyjęcia

Przed kampanią `compareRuns` przyjmował korektę tylko wtedy, gdy poprawiała się skala. Poprawka dachu przy dobrej skali nie mogła więc przejść nigdy. Teraz każda rodzina jest oceniana po własnej cesze:

| Korekta | Co musi się poprawić | Co musi zostać nietknięte | Gdzie |
|---|---|---|---|
| Odczyt / skala | skala rozstrzygnięta albo obrys zgodny z wymiarem ramującym | rozstrzygnięta skala nie rusza się o więcej niż 3 % | `compareRuns` |
| Wiązanie wymiaru | łańcuch w aktywnej skali, spójność pochodnych | własne rozstrzygnięte odczyty ramy | `extract.ts`, `metricCoherence` |
| Lokalna granica | plan bez obrysu dostaje obrys na sklasyfikowanej stronie | strony otwarte, mur, niepewne — nic się nie zamyka | `validateBoundary`, `glazedEndClosure` |
| Cecha dachu | analizator zbudował cechę o podanym ID | ściany zewnętrzne, otwory, płyty, kondygnacje, liczba obiektów — bajt w bajt (ściana pod dachem porównywana bez wysokości, bo idzie za dachem) | `compareGeometry` |
| Recenzja po przebudowie | werdykt dla cechy: zgodna / przybliżenie / źle położona | „nie powinna istnieć” albo zły rodzaj cofa zmianę | `reviewOutcome` |

**Semantyka zasięgu.** Wcześniej porównywano prostokąt wszystkich płyt z najdłuższą rozpiętością, z progiem 5 %, potem 10 % dobranym po wyniku. Teraz `outlineOf` porównuje własny obrys ścian planu z wymiarem, który **ramuje** rysunek (rozpiętość ≥ 0,8 boku ramy), na tej samej osi, z tolerancją jednej grubości ściany (min. 3 px). Wynik to `MATCHES`, `SHORT`, `BEYOND` albo `NOT_COMPARABLE`:

- `BEYOND` (model wychodzi poza wymiar całkowity) blokuje przyjęcie. To łapie fałszywą akceptację sp318422 z v3.54.2.
- `SHORT` (modelowi brakuje części) jest przyjmowane z nazwaną wadą w wyniku. Brak wykusza 0,9 m jest więc brakiem geometrii widocznym dla aplikacji, a nie czymś schowanym pod progiem.

Progi 5 % i 10 % (`EXTENT_TOLERANCE`) zostały usunięte.

## 6. Narzędzia API

| Narzędzie logiczne z briefu | Stan | Użyte na żywo | Wynik skonsumowany |
|---|---|---|---|
| list_sources | w treści zapytania: numerowane obrazy z rolą, rzutowaniem i wymiarami | tak | tak (wiązanie odrzuca obraz, który nie jest elewacją ortogonalną) |
| get_source_region | `get_source_region`: kadr oryginału w wyższej rozdzielczości, z zapisaną transformacją; do 4 na rundę | tak | tak |
| get_measurement_context | kadry etykiet z siatką (v3.54.2) | tak, w rundach metrycznych | tak |
| get_model_views | SIDES + AROUND konkretnej rewizji, hash obrazu w zapisie | tak | tak |
| propose_correction | `submit_review.proposedCorrections` z `feature` / `boundary` | tak | tak |
| evaluate_candidate | po stronie pętli: przebudowa, porównanie, następne spojrzenie z listą zastosowanych i odmówionych | tak | tak |
| inspect_analysis_element | **brak** — API nie może zapytać o stan pojedynczego elementu | — | — |

Rodziny operacji:

| Operacja | Konsument | Stan |
|---|---|---|
| READ_DIMENSION | odczyty etykiet → metryka | działa (v3.54.2) |
| BIND_DIMENSION | rozpiętość → łańcuch ramy | działa |
| CLASSIFY_BOUNDARY | strona arkusza → domknięcie przeszklonego końca | działa, bramkowane klasyfikacją |
| ROOF_FEATURE (lukarna dwuspadowa, pulpitowa, płaska) | `applyRoofFeatures` | działa |
| ROOF_FEATURE (poprzeczny szczyt), ROOF_FORM | brak | zapisywane jako nazwany brak |
| ASSIGN_VIEW, OPENING_CORRECTION | brak | zapisywane jako nazwany brak |

---

## 7. Aksamitki: jaskółka od źródła do sceny

### 7.1 Co pokazują źródła

Elewacja frontowa ARCHON pokazuje nad wejściem **lukarnę ścienną z własnym dwuspadowym daszkiem**: jej ściana wychodzi z lica elewacji, ma dwoje drzwi balkonowych, przed nią jest balkon oparty na portyku wejścia, a w szczycie widać dekoracyjne belki. To nie jest poprzeczny szczyt (bryła pod nią nie wychodzi przed dom) ani sam daszek wejściowy. Składniki są rozdzielne: daszek lukarny, jej ściana z drzwiami, balkon, podpory portyku, belki.

### 7.2 Co potrafi model

Model miał już typ „lukarna" (`createDormer`: dwuspadowa, pulpitowa, płaska) stojący na połaci. Nie miał sposobu, żeby postawić ją na domu odtworzonym automatycznie, bo główny dach dwuspadowy był jedną bryłą bez nazwanych połaci. Zmiana minimalna: `applyRoofFeatures` zapisuje główny dach jako dwie połacie ze szczytami i stawia lukarnę na właściwej. Model **nie ma** lukarny ściennej (ze ścianą w licu elewacji), balkonu na portyku ani belek. Zbudowana cecha jest więc jawnym przybliżeniem: lukarna na połaci, cofnięta o grubość ściany.

### 7.3 Przebieg (bieg C1c, na zapieczętowanych bajtach)

| Krok | Co się stało | Dowód |
|---|---|---|
| 1. LOCAL | odmowa `METRIC_RESOLUTION_INCONCLUSIVE` — bez modelu | `local` w zapisie biegu |
| 2. Rundy metryczne | odczyt wymiarów (odtworzony z zapisu v3.54.2) → skala SUPPORTED → model `b9fa2e94f997`, 12,32 × 8,82 m | decyzja `ACCEPT` |
| 3. Co dostało API | 2 rzuty, 4 elewacje ortogonalne z podpisem wydawcy, oraz dwa obrazy **tej rewizji modelu**: cztery strony w jednej skali i widok z góry z czterema aksonometriami; każdy z hashem | zdarzenie `SENT_MODEL_CHECK`, `baseRevision: b9fa2e94f997` |
| 4. Pytanie | „co różni model od rysunków" — bez podania, czego szukać, i bez referencji | prompt 0.3.0 |
| 5. Odpowiedź | „Obraz 4 pokazuje lukarnę dwuspadową z dwojgiem przeszklonych drzwi balkonowych pośrodku frontowej połaci, nad portykiem wejścia. Frontowa połać modelu jest gładka." | `ISSUE_FOUND`, propozycja `ROOF_FEATURE` |
| 6. Wiązanie | cztery liczby w pikselach elewacji → 35–65 % szerokości ściany frontowej, okap lukarny na 30 %, szczyt na 71 % wysokości dachu; strona zgodna z własną rejestracją analizatora; ID `dormer-front-c50` | werdykt `ACCEPTED` |
| 7. Budowa | lukarna dwuspadowa szer. 3,73 m na połaci frontowej; front 0,51 m za licem elewacji; ścianki działowe poddasza docięte do jej frontu | wynik `APPLIED` |
| 8. Przyjęcie | ściany zewnętrzne, otwory, płyty, kondygnacje i pomieszczenia bajt w bajt bez zmian; nowa rewizja `281fad0e8527` | decyzja `ACCEPT` |
| 9. Drugie spojrzenie | API dostaje rendery **nowej** rewizji i listę zastosowanych zmian | `baseRevision: 281fad0e8527` |
| 10. Recenzja | „Źródło ma centralną lukarnę dwuspadową na frontowej połaci, model ma ją w mniej więcej tym miejscu i rozmiarze. Lukarna modelu jest lekko przesunięta w prawo i ma jedno okno, a źródło dwa." | `ACCEPTABLE_APPROXIMATION`, zostaje |
| 11. Wynik dla aplikacji | korekta `APPLIED`; znane wady: `OUTLINE_SHORT_OF_PRINTED_DIMENSION` (wykusz), `ROOF_FEATURE_APPROXIMATE` (żadnych ilości z lukarny) | `sourceCheck` w wyniku |

Koszt dwóch spojrzeń: 0,107 USD. Czas całego biegu: 414 s.

### 7.4 Niezależne sprawdzenie ze źródłem

- Scorer `roof_features.py` na modelu końcowym: lukarna na stronie FRONT, 35,3–65,2 % szerokości; referencja odczytana przeze mnie z elewacji: 35–65 %; pokrycie 0,99; rodzaj zgodny. Uwaga: to referencja DEV, napisana przez tego samego operatora co kod.
- Obejrzałem obie rewizje na planszy (prywatnej): przed — gładka połać; po — lukarna pośrodku frontu, nad drzwiami.
- Różnice wobec źródła, które zostają: lukarna stoi na połaci, a nie w licu ściany; ma jedno okno zamiast dwojga drzwi; nie ma balkonu, portyku ani belek; jest węższa wizualnie, bo jej okap leży wyżej niż okap główny.

### 7.5 Wariancja: pięć niezależnych odczytów na żywo

| Bieg | Wynik wiązania | Co się stało |
|---|---|---|
| C1 | okap lukarny na 1 % wysokości dachu | analizator odmówił (`OUT_OF_RANGE`); doprecyzowano prompt: „okap własny" to początek jej daszku, nie spód ściany |
| C1b | 35–65 %, okap 31 %, szczyt 72 % | zbudowana; cofnięta przez zbyt ostrą regułę ochrony ścian (poprawioną) |
| C1c | 35–65 %, okap 30 %, szczyt 71 % | zbudowana, przyjęta, potwierdzona |
| Host (świeże pobranie) | 35–65 %, okap 29 %, szczyt 71 % | zbudowana, przyjęta, potwierdzona |
| Host na zamrożonej wersji (świeże pobranie) | 35–65 %, okap 31 %, szczyt 72 % | zbudowana, przyjęta, potwierdzona |

Cztery odczyty po poprawce promptu dały ten sam identyfikator i różnice do 2 punktów procentowych. Wykrycie samej cechy było zgodne we wszystkich pięciu.

### 7.6 Co zostaje błędne w Aksamitkach

- **Wykusz.** Obrys ma 12,32 m przy wydrukowanych 13,22 m. Ośmioboczny wykusz jest na rzucie klasyfikowany jako obszar zewnętrzny. Wynik mówi to wprost (`SHORT`, 0,90 m), ilości są ograniczone.
- **Rodzaj lukarny.** Brak prymitywu lukarny ściennej.
- **Podział okna, balkon, portyk, belki.** Brak konsumentów.

---

## 8. Druga rodzina korekty: granica rzutu (Supertunie)

**Pierwszy błąd.** Rzut Supertuni kończy się u góry ścianą w całości przeszkloną: cienka podwójna linia ze słupkami zamiast grubego pasa muru. Analizator nie znajduje zamkniętego obrysu ścian i odmawia (`PLAN_NO_WALLED_ENVELOPE`), mimo że po konsultacji metrycznej skala jest już mocna.

**Operacja.** `CLASSIFY_BOUNDARY`: gdy rzut przy rozstrzygniętej skali nie ma obrysu, API dostaje arkusz i klasyfikuje każdą z czterech stron jako szklenie, mur, otwarte, spoza budynku albo niepewne. API nie podaje żadnej współrzędnej zamknięcia.

**Konsument.** `glazedEndClosure` zamyka koniec tylko wtedy, gdy spełnione są trzy warunki naraz: strona jest sklasyfikowana jako szklenie, obie ściany boczne dochodzą do tego końca, a odczytany łańcuch wymiarowy ma tam kreskę. Miejsce zamknięcia wyznacza kreska wymiaru, nie API.

**Przebieg na żywo.**

| Krok | Wynik |
|---|---|
| LOCAL | odmowa `METRIC_RESOLUTION_INCONCLUSIVE` |
| Runda metryczna | 12 odczytów przyjętych; skala INCONCLUSIVE → STRONG; nadal odmowa, teraz `PLAN_NO_WALLED_ENVELOPE` (decyzja `PARTIAL`) |
| Klasyfikacja granicy | góra: „między dwoma grubymi filarami narożnymi salon zamyka cienka podwójna linia ze słupkami i skrzydłem drzwi; nie ma grubego pasa muru; taras leży powyżej, poza budynkiem" → `GLAZED_WALL`; pozostałe trzy strony: mur |
| Analizator | zamknięcie na kresce wymiaru 1350; model `b0f293801b12`, 2 bryły |
| Przyjęcie | odmowa → model w rozstrzygniętej skali: `ACCEPT` |
| Spojrzenie na model | dach i przypisanie stron zgodne; zgłoszone różnice otworów (przeszklenie tylnego szczytu do kalenicy, okna lewej strony) — brak konsumenta, zapisane jako znane wady |

**Wynik ze źródłem.** Model ma 6,32 × 13,50 m przy wydrukowanych 6,90 × 13,50 m. Głębokość jest dokładna. Szerokość jest o 0,58 m za mała: obrys leży po pół grubości ściany do środka na obu końcach. Scorer daje klasę NEAR (8,4 %), IoU obrysu 0,897. Po tej kampanii wynik sam nazywa tę różnicę (`OUTLINE_WITHIN_A_WALL_OF_PRINTED_DIMENSION`), zamiast pokazywać „zgodny".

**Kontrpróby (testy).** Strona otwarta, mur i niepewna nie zamykają niczego; inna strona niż sklasyfikowana nie jest zamykana; łańcuch nieodczytany albo ściana boczna, która nie dochodzi do końca, nie dają zamknięcia; zadaszony taras nie staje się pokojem.

---

## 9. DEV i regresja

### 9.1 Dziesięć znanych domów

A0 to zapisany wynik bazy. A1 to stan lokalny nowego kodu (konsultant wyłączony). C to nowy kod z korektami. Rundy metryczne odtworzono z zapisu v3.54.2 (bez kosztu); spojrzenia na model i klasyfikacja granicy były na żywo.

| Dom | A0 | A1 | C | Skala | Obrys | Dach / cechy | Otwory | Wnętrze | Ilości | Koszt USD |
|---|---|---|---|---|---|---|---|---|---|---|
| Aksamitki (ARCHON) | odmowa | odmowa | **model** NEAR 6,8 %, IoU 0,88 | SUPPORTED, z wymiarów | SHORT 0,90 m (wykusz) | **lukarna zbudowana**, zgodna | bez zgłoszeń | nie sprawdzane | ograniczone | 0,107 |
| sp318422 (houseplans) | odmowa | odmowa | **model** OK 0,0 %, IoU 0,88 | SUPPORTED, z wymiarów | zgodny | zgłoszone: forma dachu, poprzeczny szczyt — brak konsumenta | bez zgłoszeń | nie sprawdzane | ograniczone | 0,044 |
| Supertunie (ARCHON) | odmowa | odmowa | **model** NEAR 8,4 %, IoU 0,90 | STRONG | w granicy ściany, −0,58 m | zgodny | zgłoszone 2 — brak konsumenta | nie sprawdzane | ograniczone | 0,118 |
| Kukliki (ARCHON) | model OK, IoU 1,00 | ten sam | ten sam | SUPPORTED (potwierdzona, nie zmieniona) | zgodny | zgodny | bez zgłoszeń | nie sprawdzane | ograniczone | 0,132 |
| Torenie (ARCHON) | model NEAR, IoU 0,85 | ten sam | ten sam (kandydat cofnięty) | STRONG | nie porównany | zgodny | zgłoszona zamiana stron — brak konsumenta | nie sprawdzane | ograniczone | 0,066 |
| Madera (domywstylu) | model WRONG, IoU 0,38 | ten sam | ten sam, **oznaczony jako sprzeczny ze skalą** | SPRZECZNA (model o 14 % za duży) | nie porównany | zgłoszone: forma dachu, poprzeczny szczyt — brak konsumenta | bez zgłoszeń | nie sprawdzane | **wyłączone** | 0,058 |
| plan23-504 (monster) | model OK, IoU 0,65 | ten sam | ten sam | nierozstrzygnięta | nie porównany | bez propozycji | bez zgłoszeń | nie sprawdzane | nie oceniane | 0,044 |
| plan5-737 (monster) | odmowa | odmowa | odmowa | — | — | nie sprawdzane | — | — | — | 0 |
| Puszek (domywstylu) | odmowa | odmowa | odmowa | — | — | nie sprawdzane | — | — | — | 0 |
| plan63-411 (monster) | odmowa | odmowa | odmowa | — | — | nie sprawdzane | — | — | — | 0 |

Mianownik: 10 domów. Modele: A0 4, A1 4, C 7. Trzy odmowy pozostają odmowami. Średnie z samych udanych modeli nie są podawane.

**A1 wobec A0.** Na wszystkich dziesięciu domach A1 jest równe A0: cztery modele mają ten sam hash, sześć odmów pozostaje odmowami. Zmiany wspólnych modułów (metryka, składanie planu) działają tylko wtedy, gdy przyjdzie skala albo klasyfikacja z konsultacji, więc cały zysk tej kampanii to C − A1. Dom syntetyczny z testów kontraktu ma scenę bajt w bajt taką jak przed kampanią.

**R (API czyta, nic nie stosuje).** Wariant R jest sprawdzony testem na poziomie hosta: spojrzenie zostaje zapisane, model jest modelem lokalnym. Osobnej partii R na żywo nie uruchamiałem; każdy bieg C zapisuje wszystkie propozycje przed ich zastosowaniem, więc „co API zgłosiło" jest w tabelach §9.3 i §11.

**Odtworzenie zapisu.** Wszystkie dziesięć zapisanych biegów DEV odtworzyłem offline na zamrożonym commicie `aabc044`: **10 z 10 daje ten sam hash modelu końcowego i lokalnego** co bieg na żywo, przy zerowym koszcie. Zmiany wprowadzone po biegach (opisane w `INTERVENTIONS.md`, wpis 6) dotyczą więc tylko tego, co wynik mówi, a nie tego, co jest zbudowane.

### 9.2 Porównanie z fałszywą akceptacją z v3.54.2

W v3.54.2 sp318422 dostał model o złym zasięgu, przyjęty przez transakcję. Teraz ten sam zapis odpowiedzi API daje model 14,02 × 9,58 m, czyli wydrukowane 46'-0" × 31'-5", bo rozpiętości z konsultacji są związane jako łańcuchy ramy, a obrys jest porównywany z wymiarem ramującym. Kandydat wychodzący poza wymiar byłby cofnięty (`BEYOND`); test `consult-v3543` odtwarza tamten przypadek.

### 9.3 Zgłoszenia trafne, które nie zmieniły modelu

| Dom | Zgłoszenie API | Kod przyczyny | Co dalej |
|---|---|---|---|
| Aksamitki (C1) | lukarna z okapem na linii okapu głównego | `VALIDATION_REJECTED` → `OUT_OF_RANGE` (odmowa analizatora) | naprawione promptem; w kolejnych biegach zbudowana |
| Aksamitki (C1b) | lukarna poprawnie związana i zbudowana | `OVERRIDDEN` — cofnięta przez regułę ochrony ścian | reguła poprawiona (ściana idąca za dachem porównywana bez wysokości) |
| sp318422 | forma dachu wszystkich brył; poprzeczny szczyt od frontu | `CAPABILITY_MISSING` (`NO_CONSUMER`, `KIND_WITHOUT_CONSUMER`) | brak konsumenta; znana wada w wyniku |
| Madera | forma dachu; poprzeczny szczyt nad wejściem i garażem | `CAPABILITY_MISSING` | jak wyżej |
| Madera | wymiary 15,98 × 18,71 m | `COMPILE_CONFLICT` — plan nie składa się w tej skali (`PLAN_LAYOUT_REJECTED`) | odczyt zachowany w wyniku; model oznaczony jako podgląd |
| Torenie | model wygląda na obrócony o 180° względem elewacji | `CAPABILITY_MISSING` (`ASSIGN_VIEW`) | brak konsumenta; znana wada |
| Supertunie | przeszklenie tylnego szczytu do kalenicy; okna lewej strony | `CAPABILITY_MISSING` (`OPENING`) | brak konsumenta; znana wada |
| Supertunie (runda 2) | 12 odczytów powtórzonych z rundy 1 | `VALIDATION_REJECTED` (powtórzone) | poprawnie odrzucone |

Kodów `NOT_SENT`, `NOT_SEEN`, `WRONG_BINDING`, `PARSE_REJECTED`, `NOT_CONSUMED` i `STALE_CACHE` w tej partii nie było. `WRONG_READ`: pierwszy odczyt okapu w C1.

### 9.4 Kontrpróby

| Kontrpróba z briefu | Gdzie sprawdzona | Wynik |
|---|---|---|
| poprawna geometria i skala chronione | Kukliki, Torenie (na żywo); test transakcji | model bez zmian |
| dobra cecha dachu przy niezmienionej skali przechodzi | Aksamitki; test „a roof correction needs no better scale" | przyjęta |
| błędna cecha nie przechodzi dzięki pewności | test: `HIGH` wstrzymane; recenzja „nie powinna istnieć" cofa (SYNTETYCZNE, przez HTTP) | cofnięta |
| stara rewizja, lustro, zły kadr | test wiązania: `STALE_REVISION`, lustro czytane w drugą stronę, `OUT_OF_PICTURE` | odrzucone |
| pomylony wymiar korpusu i całego domu | test obrysu: wymiar krótszy niż 0,8 boku nie ramuje niczego | `NOT_COMPARABLE` |
| brak metryki, ft/in, zależność kołowa | testy v3.54.2 i `metric-revision-v3543`: skala zewnętrzna nigdy nie nadpisuje rozstrzygniętej własnej | bez zmian |
| stary cache po poprawce skali | `reuseMetrics` odmawia przy innym hashu pakietu; test spójności pochodnych | odmowa / 0 naruszeń |
| otwarty podcień, zwykły szczyt, okno połaciowe | testy: strona `OPEN` nic nie zamyka; `GABLE_END_SIDE`; rodzaj bez konsumenta | odmowa z kodem |
| powtórzony identyfikator, timeout, zły JSON, brak sieci | testy: `DUPLICATE_PROPOSAL_ID`; jedno ponowienie; brak odpowiedzi kończy krok bez zmyślonej recenzji | bez zmian |
| serializacja i tożsamość elementów | test HTTP: lukarna pod tym samym ID w pobranym modelu i scenie | zgodne |
| perspektywa podpisana jako elewacja | test: `NOT_ORTHOGRAPHIC` | odrzucone |
| obraz modelu podany jako dowód | test: `NOT_AN_ELEVATION` (SYNTETYCZNE, przez HTTP) | odrzucone |

### 9.5 Tabela problemów: od stanu lokalnego do skutku (DEV)

| Problem | LOCAL | API | Operacja | Konsument | Rewizja zależności | Finalna wartość / element | Akceptacja / powód | Skutek |
|---|---|---|---|---|---|---|---|---|
| Aksamitki: skala | nierozstrzygnięta, odmowa | wymiary 1322 / 882 | READ + BIND_DIMENSION | `solveFrameMetric` (skala zewnętrzna), łańcuchy ramy | wszystkie łańcuchy przeliczone w nowej skali; 0 niespójnych (było 19 z 19) | 12,32 × 8,82 m | ACCEPT: odmowa → model w rozstrzygniętej skali; obrys SHORT nazwany | model zamiast odmowy |
| Aksamitki: dach | gładka połać | lukarna nad wejściem, elewacja frontowa | ROOF_FEATURE | `applyRoofFeatures` | dach główny zapisany jako połacie; ścianki poddasza docięte | `dormer-front-c50` | ACCEPT: cecha zbudowana, reszta bajt w bajt | lukarna w modelu i scenie |
| Aksamitki: wykusz | poza obrysem | nie zgłoszony jako operacja | — | brak | — | brak 0,90 m | nazwana wada `OUTLINE_SHORT` | bez zmiany |
| sp318422: skala i zasięg | odmowa | 46'-0" × 31'-5" | READ + BIND_DIMENSION | jak wyżej | łańcuchy z rozpiętości konsultowanych | 14,02 × 9,58 m | ACCEPT: obrys zgodny na obu osiach | model dokładny w rozmiarze |
| sp318422: dach | jeden dach | forma dachu, poprzeczny szczyt | ROOF_FORM, ROOF_FEATURE (CROSS_GABLE) | brak | — | — | CAPABILITY_MISSING | znana wada w wyniku |
| Supertunie: skala | nierozstrzygnięta | 690, 1350 i 10 innych | READ + BIND_DIMENSION | jak wyżej | łańcuchy przeliczone | skala STRONG | PARTIAL: skala lepsza, nadal odmowa | inna, konkretna odmowa |
| Supertunie: obrys | brak obrysu | góra arkusza = szklenie | CLASSIFY_BOUNDARY | `glazedEndClosure` | rozkład planu z kluczem obejmującym stronę | 6,32 × 13,50 m | ACCEPT: odmowa → model | model zamiast odmowy |
| Supertunie: otwory | — | przeszklenie szczytu, okna lewej strony | OPENING | brak | — | — | CAPABILITY_MISSING | znana wada |
| Kukliki: skala | nierozstrzygnięta, model | wymiary całkowite | READ + BIND_DIMENSION | jak wyżej | ten sam model bajt w bajt | 7,56 × 8,76 m | ACCEPT: potwierdzona, nie zmieniona | status skali lepszy |
| Kukliki: model | — | brak różnic | — | — | — | — | NO_CHANGE | model chroniony |
| Torenie: skala | STRONG | 10 odczytów | READ + BIND_DIMENSION | jak wyżej | kandydat: inny model, obrys BEYOND 1,49 m | model sprzed rundy | ROLLBACK | model chroniony |
| Torenie: strony | — | model obrócony o 180° | ASSIGN_VIEW | brak | — | — | CAPABILITY_MISSING | znana wada |
| Madera: skala | nierozstrzygnięta, model | 15,98 × 18,71 m | READ + BIND_DIMENSION | jak wyżej | kandydat odmawia (`PLAN_LAYOUT_REJECTED`) | model sprzed rundy, oznaczony | ROLLBACK; skala SPRZECZNA | ilości wyłączone |
| Madera: dach | — | forma dachu, poprzeczny szczyt | ROOF_FORM, ROOF_FEATURE | brak | — | — | CAPABILITY_MISSING | znana wada |

### 9.6 Tabela modułów: gdzie ginie poprawne wejście

| Moduł | Poprawne wejście dostępne? | Pierwsza strata | Dowód | Zmiana w tej kampanii | Ograniczenie |
|---|---|---|---|---|---|
| Rozwiązanie metryki | tak, po konsultacji | pochodne zostawały w starej skali | 19 z 19 segmentów niespójnych (Aksamitki, zapis v3.54.2) | jedna rewizja: wszystkie łańcuchy w aktywnej skali | skala zewnętrzna tylko tam, gdzie własna nie jest rozstrzygnięta |
| Wiązanie wymiarów | tak | rozpiętość z konsultacji nie była łańcuchem | sp318422: zły zasięg w v3.54.2 | BIND_DIMENSION | potrzebne dwie zgodne rozpiętości na różnych liniach |
| Składanie planu: koniec przeszklony | tak, po klasyfikacji | brak obrysu | Supertunie: `PLAN_NO_WALLED_ENVELOPE` | zamknięcie na sklasyfikowanej stronie | obrys pół ściany do środka na osi X |
| Składanie planu: wykusz | tak (wymiar 1322) | wykusz poza obrysem | Aksamitki: SHORT 0,90 m | brak | brak reprezentacji wykusza |
| Składanie planu: Madera | tak (15,98 × 18,71) | `PLAN_LAYOUT_REJECTED` w prawdziwej skali | bieg C3 | tylko uczciwe oznaczenie wyniku | przyczyna nieusunięta |
| Dach: cechy wtórne | tak (elewacje) | elewacje nie były czytane pod kątem cech | Aksamitki: gładka połać | pętla spojrzeń + konsument lukarny | tylko lukarna na dachu dwuspadowym |
| Dach: forma | tak (elewacje) | jedna forma na dom | sp318422, Madera | brak | brak konsumenta |
| Przypisanie stron | częściowo | strony z własnej rejestracji | Torenie: zgłoszony obrót | brak | brak konsumenta |
| Otwory | tak (elewacje) | otwory tylko z rzutu | Supertunie: szczyt tylny | brak | brak konsumenta |
| Transakcja | — | wymóg lepszej skali; próg udziału | sp318422 fałszywie przyjęty w v3.54.2 | przyjęcie według cechy; obrys wobec wymiaru ramującego | recenzja z tego samego API |
| Wynik dla aplikacji | — | wady tylko w prywatnym śladzie | — | `sourceCheck` z osiami i znanymi wadami w wyniku | aplikacja jeszcze tego nie pokazuje |

### 9.7 Kryteria nowe i zmienione

| Kryterium | Wartość | Znaczenie | Zamrożone |
|---|---|---|---|
| Tolerancja obrysu (decyzja) | max(3 px, grubość ściany) na koniec | nie wiadomo, do którego lica narysowano wymiar | 2026-11-16, pakiet B |
| Luz rastra (komunikat) | 3 px na koniec | różnica większa jest podawana w metrach i ogranicza ilości; decyzji nie zmienia | 2026-11-16, po drugiej partii DEV, przed potwierdzeniem |
| Udział ramujący | rozpiętość ≥ 0,8 boku ramy | wymiar całkowity, nie wymiar pokoju | v3.54.2, bez zmian |
| Spójność metryki | 3 px | wartość × skala wobec odległości kresek | 2026-11-16, pakiet A |
| Sprzeczność skali | 3 % | zachowany model w nierozstrzygniętej skali, różnej od wydrukowanej, jest podglądem | 2026-11-16, po drugiej partii DEV, przed potwierdzeniem |
| Dopasowanie lukarny (scorer) | ta sama strona, pokrycie przedziałów ≥ 0,3 | lukarna modelu odpowiada lukarnie referencji | 2026-11-16, przed pierwszym biegiem |
| Granice lukarny | szer. ≥ 0,8 m; okap ≤ 60 % wysokości dachu; 0,3 m od szczytu; 0,15 m pod kalenicą; spadek 12–70° | co prymityw potrafi zbudować bez zmyślania | 2026-11-16, przed pierwszym biegiem |
| Krok identyfikatora cechy | środek co 5 % strony | ta sama cecha ma to samo ID między rundami | 2026-11-16, przed pierwszym biegiem |
| Bramka niepewności | `HIGH` wstrzymane | własna wątpliwość API zatrzymuje zastosowanie | 2026-11-16 |
| Klasy rozmiaru (scorer) | OK ≤ 3 %, NEAR ≤ 10 % | bez zmian od v3.54.1 | v3.54.1 |

Usunięte: progi zasięgu 5 % i 10 % z v3.54.2 oraz wymóg poprawy skali przy każdej korekcie. Żaden próg nie został dobrany po wyniku potwierdzenia.

---

## 10. Potwierdzenie: pierwszy zamrożony wynik

Kandydat `aabc044` zamrożony przed pierwszym biegiem: kod, prompt 0.3.0, schemat 0.2.0, model API, reguły przyjęcia, limity i scorery. Referencje ośmiu domów napisał osobny czytelnik, który nie uruchamiał analizatora; zostały zapisane i zahashowane w commicie `d17652d`, przed jakimkolwiek wynikiem. Bieg był jeden, w całości na żywo (bez odtwarzania), i to jest jego pierwszy wynik. Niczego potem nie stroiłem.

### 10.1 Zestaw

| Dom | Wydawca | Kategorie | Cecha wybrana przed biegiem |
|---|---|---|---|
| Majeranek 2 (G2) | ARCHON | dach, obrys | lukarny ścienne od frontu i ogrodu; wymiar głębokości z wykuszem |
| 39035st | architecturaldesigns | dach | długa lukarna pulpitowa od frontu; rzut bez wymiarów |
| Gracja mała II | dobredomy | dach, obrys | lukarny ścienne z balkonem od frontu i tyłu |
| 22192sl | architecturaldesigns | obrys, dach | wymiary w stopach i calach z garażem i podcieniem; lukarna pulpitowa od tyłu |
| Lille | lipinscy | obrys, negatyw | wymiary obejmujące garaż i dwa otwarte podcienie; brak lukarny |
| Zagliki (G) | ARCHON | obrys, negatyw | garaż wysunięty przed dom; pergola i daszek na słupie |
| Delta | dobredomy | negatyw | brak lukarny; kratownice w szczytach, okna połaciowe |
| Haga | lipinscy | negatyw, obrys | otwarte ganki pod własnymi daszkami; brak lukarny |

Wydawców: 4. Spoza ARCHON: 6 z 8. Ograniczenia zestawu zapisane przed biegiem: 39035st i Delta nie mają wydrukowanego wymiaru całkowitego; 22192sl nie ma rysunku elewacji frontowej; elewacje ARCHON i dobredomy to rendery ortogonalne, nie rysunki kreskowe.

### 10.2 Wynik na dom

Rozmiar: prostokąt płyt parteru wobec wydrukowanego wymiaru całkowitego. Lukarny: scorer `roof_features.py` w stałej ramie (ta sama strona, pokrycie przedziałów ≥ 0,3).

| Dom | A1 | C | Rozmiar wg scorera | Lukarny: referencja → model | Co zrobiła pętla | Koszt USD |
|---|---|---|---|---|---|---|
| Majeranek | model | model + lukarna | WRONG 10,5 % (19,51 × 8,57 wobec 19,50 × 9,58) | 2 → 1 zbudowana, **0 zgodnych**, 1 fałszywa, 2 brakujące | frontowa zbudowana i potwierdzona; tylna odmówiona (`LAYOUT_REFUSED`); wykusz zgłoszony, brak konsumenta | 0,264 |
| 39035st | odmowa | odmowa | — | 1 → brak modelu | 2 zapytania metryczne; rzut bez wymiarów, skala nierozstrzygnięta | 0,050 |
| Gracja | model | model + 2 lukarny | WRONG 33 % (12,06 × 13,43 wobec 16,82 × 10,12) | 2 → 2 zbudowane, **1 zgodna** (pokrycie 0,30), 1 fałszywa, 1 brakująca | obie zbudowane i potwierdzone; wymiary odczytane, plan nie składa się w tej skali — model oznaczony jako sprzeczny, ilości wyłączone; brak garażu zgłoszony | 0,213 |
| 22192sl | odmowa | **model** | WRONG 33,5 % (13,25 × 13,65 wobec 19,91 × 15,14) | 3 → 0 | 65'-4" × 49'-8" odczytane i związane; odmowa → model; lukarna tylna zgłoszona dwa razy i odmówiona (`OUT_OF_RANGE`, potem `NO_PITCHED_HOST`); forma dachu zgłoszona, brak konsumenta | 0,377 |
| Lille | model | ten sam | WRONG 22,4 % (16,22 × 8,89 wobec 16,45 × 11,45) | 0 → 0 | szczyty nad gankiem i tarasem zgłoszone jako cecha dachu — rodzaj bez konsumenta, nic nie zbudowano | 0,166 |
| Zagliki | model | ten sam | **OK 0,0 %** (14,75 × 14,45) | 0 → 0 | forma dachu zgłoszona, brak konsumenta | 0,180 |
| Delta | odmowa | odmowa | — | 0 → brak modelu | 3 zapytania metryczne; brak linii wymiarowych | 0,103 |
| Haga | model | ten sam | WRONG 26,0 % (13,68 × 9,38 wobec 13,68 × 12,68) | 0 → 0 | forma dachu i 2 otwory zgłoszone, brak konsumenta | 0,163 |

Mianownik: 8 domów. Modele: A1 5, C 6. Dwie odmowy pozostają odmowami. Koszt: 1,516 USD, 30 zapytań, średnio 435 s na dom.

### 10.3 Ocena według kryteriów zapisanych w protokole przed biegiem

**Cecha dachu (4 domy z lukarną na rysunku).**

- Wykrycie: na trzech domach, które miały model, API zgłosiło wszystkie pięć lukarn widocznych na rysunkach elewacji (Majeranek 2, Gracja 2, 22192sl 1) i żadnej, której na rysunku nie ma.
- Zbudowane: 3 z 5. Odmówione przez analizator z kodem: 2.
- Zgodne ze scorerem w ramie całego domu: **1 z 3 zbudowanych**.
- Domów „poprawionych" w sensie protokołu (wszystkie lukarny zgodne, żadnej fałszywej): **0 z 4**.
- Kryterium szkody z protokołu („fałszywa lukarna w dostarczonym modelu") jest spełnione dwa razy: Majeranek (front) i Gracja (tył).

Przyczyna, ustalona po wyniku, bez zmiany kodu ani scorera:

- **Majeranek.** Model bazowy jest odbity lustrzanie: skrzydło garażu stoi po lewej, w źródle po prawej. API napisało to w tym samym spojrzeniu („front modelu jest obecnie odbity"). Lukarna stanęła pośrodku korpusu głównego, tak jak w źródle, ale korpus jest po złej stronie domu, więc w ramie całego domu lukarna wypada na 62–79 % zamiast 24–44 %.
- **Gracja.** Model bazowy nie ma skrzydła garażu i stoi w skali sprzecznej z wymiarami. Lukarny stoją na 31–64 % i 39–67 % ściany korpusu; API w recenzji zmierzyło na rysunkach 33–63 % i 38–65 %. Referencja liczy udziały od całej ściany z garażem, którego model nie ma.

Wniosek: wiązanie cechy z jej bryłą działało; **pętla dobudowała cechy do modeli, o których w tym samym spojrzeniu wiedziała, że mają większy błąd** (lustro, brak bryły, sprzeczna skala). To jest błąd kolejności w pętli i najważniejsze ustalenie tego potwierdzenia.

**Obrys i wiązanie (6 domów z wymiarem całkowitym).**

- Poprawionych względem A1: **0**. Pięć domów ma ten sam model co A1.
- 22192sl: odmowa stała się modelem w poprawnej skali ze stóp i cali, ale model nie zawiera bloku garażu (6,66 m szerokości). Wynik biegu podał przy tym obrys „zgodny", bo porównuje obrys rzutu, a nie to, co faktycznie zbudowano. **To jest fałszywie korzystny komunikat** i wada do naprawy.
- Zagliki: rozmiar dokładny, bez zmian.
- Haga, Lille, Majeranek: wymiar całkowity obejmuje otwarte ganki albo wykusz. Głębokość modelu Hagi (9,38 m) równa się wymiarowi samych ścian z łańcucha na rzucie (938); zamrożony scorer porównuje jednak z wymiarem całkowitym (1268) i daje WRONG. Scorera nie zmieniałem. To jest ograniczenie miernika dla tej kategorii, zauważone przy pierwszym wyniku: na domach z pułapką wymiar całkowity nie jest właściwym odniesieniem dla obrysu ścian.

**Trudne negatywy (4 domy bez lukarny).**

- Z modelem: 3 (Lille, Zagliki, Haga). Na żadnym nie zbudowano cechy dachu. Szczyty nad otwartym gankiem i tarasem (Lille) zostały zgłoszone i poprawnie zatrzymane jako rodzaj bez konsumenta.
- Delta: brak modelu, mechanizm niesprawdzony.

**Regresje.** Żaden dom, który miał model w A1, nie stracił go ani nie zmienił rozmiaru w C.

### 10.4 Status transferu

| Rodzina | Status według protokołu | Dlaczego |
|---|---|---|
| Cecha dachu | **NOT_CONFIRMED** jako poprawa jakości; mechanizm zadziałał na 2 nowych wydawcach | 0 domów „poprawionych"; 2 lukarny w miejscu odrzuconym przez scorer; wykrycie 5 z 5, budowa 3 z 5 |
| Obrys i wiązanie | **NOT_CONFIRMED** | 0 poprawionych; 1 odmowa → model bez garażu z błędnym komunikatem „zgodny" |
| Negatywy | zaliczone 3 z 3 z modelem | żadnej cechy na domu bez lukarny |
| Druga rodzina (granica przeszklona) | **brak aktywacji** | żaden z ośmiu domów nie miał odmowy z powodu przeszklonego końca; brak dowodu transferu, nie dowód porażki |

Kod pozostaje za flagą. Ten wynik nie pozwala włączyć pętli domyślnie.

### 10.5 Rodziny korekt: stan zbiorczy

| Rodzina korekty | Zaimplementowana | Użyta na żywo | Zastosowana | Poprawa sprawdzona ze źródłem | Transfer |
|---|---|---|---|---|---|
| Odczyt i wiązanie wymiaru (READ / BIND_DIMENSION) | tak | 18 domów | odmowa → model na 4 (Aksamitki, sp318422, Supertunie z granicą, 22192sl); skala potwierdzona bez zmiany modelu: Kukliki | sp318422: rozmiar dokładny; Aksamitki: NEAR z nazwanym brakiem | 22192sl (nowy wydawca, stopy i cale): skala poprawna, model niepełny |
| Jedna rewizja metryki | tak | wszędzie, gdzie przyszła skala z konsultacji | tak | 0 niespójnych pochodnych (było 19 z 19) | własność kodu; sprawdzana testem |
| Klasyfikacja granicy (CLASSIFY_BOUNDARY) | tak | 1 dom | 1 (Supertunie) | głębokość dokładna, szerokość −0,58 m | brak aktywacji na nowych domach |
| Cecha dachu: lukarna (ROOF_FEATURE) | tak | 4 domy | 4 lukarny na 3 domach | Aksamitki: zgodna (referencja DEV) | 1 z 3 zgodna na nowych domach; niepotwierdzony |
| Recenzja po przebudowie | tak | 3 domy | 4 lukarny ocenione, wszystkie zostawione | nie jest niezależnym dowodem | nie wychwyciła, że bryła gospodarza stoi po złej stronie |
| Forma dachu, poprzeczny szczyt | nie | zgłoszone na 6 domach | — | — | — |
| Otwory | nie | zgłoszone na 3 domach | — | — | — |
| Zamiana widoków / lustro | nie | zgłoszone na 2 domach | — | — | — |
| Brakująca bryła, region obrysu | nie | zgłoszone na 2 domach | — | — | — |

---

## 11. Autonomia i trzy ślady

**Kto co robił.**

| Czynność | Program (analizator, pętla) | API | Claude Code (operator) |
|---|---|---|---|
| wybór problemu i obrazów do pokazania | tak | — | — |
| odczyt etykiet, wskazanie różnic, klasyfikacja stron | — | tak | — |
| walidacja, wiązanie, budowa, przyjęcie, cofnięcie | tak | — | — |
| ponowne sprawdzenie nowej rewizji | wysyła | ocenia | — |
| zmiany kodu i promptu między biegami DEV | — | — | tak, 7 wpisów w `INTERVENTIONS.md` |
| wybór i odczyt zestawu potwierdzającego | — | — | osobny czytelnik, bez uruchamiania analizatora |
| ręczne wartości w runtime | brak | brak | brak; jedna próba diagnostyczna konsumenta z ręcznymi udziałami, oznaczona `MANUAL_DIAGNOSTIC`, nie liczona jako wynik |

**Ślad 1 — skuteczna korekta po budowie.** Aksamitki, §7.3.

**Ślad 2 — dobra obserwacja zakończona odmową.** Torenie. API porównało cztery elewacje z modelem i stwierdziło: „Rzut ma taras i pergolę po lewej, w przedniej części domu. Model ma ciemną bryłę tarasu po prawej, w tylnej połowie. Model wygląda na obrócony o 180° wokół osi pionowej." Zaproponowało `ASSIGN_VIEW`. Walidator: operacja znana, konsumenta brak → `CAPABILITY_MISSING / NO_CONSUMER`. Model bez zmian; w wyniku dla aplikacji znana wada `SOURCE_DIFFERENCE_NO_CONSUMER` z treścią zgłoszenia. Tej obserwacji nie weryfikowałem niezależnie ze źródłem; jest zapisana jako zgłoszenie, nie jako fakt.

**Ślad 3 — poprawny model chroniony.** Torenie, runda metryczna. Model lokalny ma skalę STRONG. API odczytało 10 wymiarów; wszystkie przeszły walidację. Kandydat zbudowany z nimi miał tę samą skalę (różnica 0,1 %), ale inny model, którego obrys wychodził 1,49 m poza wydrukowane 12,50 m (`BEYOND`). Decyzja: `ROLLBACK` — „inny model bez lepiej rozstrzygniętej skali i bez obrysu lepiej zgodnego z wymiarami". Dostarczony model to model sprzed rundy, hash bez zmian. Dodatkowo, SYNTETYCZNIE przez HTTP: lukarna, którą recenzja nowej rewizji ocenia „nie powinna istnieć", jest usuwana, a dostarczony model ma hash modelu lokalnego.

---

## 12. Koszt, rezerwacje, czas

| Faza | Zapytania | Koszt USD | Uwagi |
|---|---|---|---|
| DEV, pierwsza partia (Aksamitki ×3, Kukliki, sp318422) | 8 | 0,384534 | spojrzenia na model na żywo; rundy metryczne z zapisu |
| DEV, druga partia (7 domów) | 8 | 0,285472 | jak wyżej, plus klasyfikacja granicy |
| Host, pierwszy bieg (`d17652d`) | 15 | 0,748428 | wszystko na żywo, świeże pobranie stron |
| Potwierdzenie (8 domów) | 30 | 1,515768 | wszystko na żywo |
| Host, bieg na zamrożonej wersji (`aabc044`) | 16 | 0,785486 | wszystko na żywo |
| **Razem v3.54.3** | **77** | **3,719688** | 883 tys. tokenów wejścia, 195 tys. wyjścia |

- **Księga:** 6,243534 → **9,963222 USD** narastająco. Pułap pilota 24,11036 USD; zostało 14,15 USD. Limit projektu 100 USD.
- **Pierwsza partia na żywo:** 0,38 USD przy limicie 3 USD.
- **Rezerwacje.** Każde zapytanie jest rezerwowane w pełnej możliwej cenie przed wysłaniem i rozliczane po odpowiedzi. Żadne nie skończyło się timeoutem; nie ma rezerwacji o nieznanym koszcie w v3.54.3. Księga nie była resetowana. Sześć rezerwacji zrobionych omyłkowo dla odpowiedzi odtwarzanych z zapisu (nigdy niewysłanych) zostało zwolnionych wpisem w dzienniku, bez kasowania (`INTERVENTIONS.md`, wpis 1).
- **Koszt na dom.** Jedno spojrzenie na model: 0,04–0,06 USD. Cały dom na żywo z rundami metrycznymi: 0,05–0,44 USD; średnio 0,19 USD w potwierdzeniu.
- **Czas.** 60–660 s na dom; średnio 435 s w potwierdzeniu (cztery procesy naraz na czterech rdzeniach). Większość czasu to ponowna analiza, nie API.
- **Dysk.** Około 5 GB wolne przez całą kampanię; dane kampanii zajmują kilkaset MB.
- **Cache.** Brak pamięci wyników. Bajty źródeł czytane po hashu. Odtworzenie zapisanych odpowiedzi API jest deterministyczne: 10 z 10 domów DEV daje ten sam hash modelu.
- **Wariancja API.** Pięć niezależnych odczytów lukarny Aksamitek (§7.5): cecha wykryta 5 z 5; po poprawce promptu ten sam identyfikator 4 z 4, różnice do 2 punktów procentowych. Dwa biegi hosta na tej samej stronie dały ten sam identyfikator lukarny, ale różne hashe modelu (`3e354c02…`, `fc1aa609…`), bo rundy metryczne na żywo dały nieco inne odczyty; drugi bieg zgłosił dodatkowo dwie różnice otworów. Powtórzenia klasyfikacji granicy (Supertunie) na żywo nie robiłem: jeden bieg.

---

## 13. Testy, host, sceny, Android

### 13.1 Testy

Nowe pliki testów (wszystkie zielone):

| Plik | Testy | Co sprawdza |
|---|---|---|
| `packages/source-metrics/test/metric-revision-v3543.test.ts` | 5 | jedna rewizja metryki; test „przed" pokazuje stary błąd |
| `packages/reconstruction/test/roof-feature-v3543.test.ts` | 6 | budowa lukarny z udziałów, strony, odmowy z kodem, idempotencja |
| `packages/reconstruction/test/glazed-end-v3543.test.ts` | 2 | zamknięcie tylko na sklasyfikowanej stronie |
| `packages/analysis-service/test/consult-v3543.test.ts` | 22 | wiązanie, przyjęcie, obrys, transakcja, granica, sprzeczność skali |
| `apps/analyzer-api/test/consultant-loop-v3543.test.ts` | 5 | cała pętla przez HTTP z konsultantem ze skryptu |

Typecheck całego repozytorium: czysty.

Pełny zestaw na kandydacie: 4060 testów, 4032 zielone przed poprawkami, 17 czerwonych. Te same pliki uruchomiłem na bazie `258a3a9`:

- **14 porażek istnieje na bazie** (strażniki architektury względem dawnych baz, zapis plików badawczych Pythona w tym środowisku, pliki Kotlin z równoległej sesji wyglądów, normalizacja Unicode). Nie pochodzą z tej kampanii i nie były ruszane.
- **1 porażka** (`apps/local-analyzer/test/program.test.ts`) porównuje scenę z migawką z dawnego solvera 2.3.0. Bieżąca migawka sceny jest bajt w bajt bez zmian od v3.53.8, więc ta porażka też nie pochodzi z tej kampanii; na bazie nie dało się jej uruchomić w osobnym katalogu.
- **2 porażki były moje i są naprawione**: nazwa pola w solverze kolidowała ze strażnikiem rozpoznawania (zmieniona na `consultedScale`); migawka kontraktu Androida była nieaktualna po podniesieniu wersji solvera (odświeżona; różni się tylko numerem wersji i hashem kandydata, scena bez zmian).

Po poprawkach dotknięte pakiety: 42 pliki, 494 testy zielone. Pełnego zestawu po poprawkach nie uruchamiałem drugi raz.

### 13.2 Host: publiczne wejście serwera

Zbudowany serwer (`apps/analyzer-api/dist/server.mjs`) uruchomiony lokalnie z włączonym pilotem i losowym tokenem w pamięci. Każde zadanie: `POST /v1/analyses` z adresem strony → pobranie strony i rysunków z sieci → odpytywanie statusu → wynik, scena, model.

Próbę wykonałem dwa razy: najpierw na wersji `d17652d` (15 zapytań), potem na zamrożonej `aabc044` (16 zapytań; plik serwera `sha256 cd64e157…`). Tabela pokazuje bieg na zamrożonej wersji. To jest **test świeżego pobrania**: strony i rysunki przyszły z sieci, więc hashe modeli różnią się od biegów na zapieczętowanych bajtach.

| Zadanie | Adres | Wynik | Co się stało | Czas | Koszt USD |
|---|---|---|---|---|---|
| 1. Korekta po budowie | Aksamitki (ARCHON) | COMPLETED | odmowa → model; spojrzenie → `dormer-front-c50` (35–65 %, okap 31 %, szczyt 72 %) zbudowana, `ACCEPT`; drugie spojrzenie na rewizję `fc1aa609cb6f`: `ACCEPTABLE_APPROXIMATION`; znane wady w wyniku: brak wykusza, lukarna przybliżona, 2 różnice otworów bez konsumenta | 485 s | 0,441 |
| 2. Poprawna kontrola | Kukliki (ARCHON) | COMPLETED | skala potwierdzona; spojrzenie: bez różnic; model `99a3d762fd5d` taki sam jak w zadaniu bez tokena | 275 s | 0,278 |
| 3. Odmowa | plan5-737 (monsterhouseplans) | FAILED `RECONSTRUCTION_FAILED` | 2 zapytania metryczne, skala nierozstrzygnięta; serwer nie wydaje wyniku (HTTP 410) i podaje powód | 140 s | 0,067 |
| 4. Bez tokena | Kukliki | COMPLETED | ścieżka lokalna; brak `consultation` i `sourceCheck` w wyniku; **0 zapytań, 0 USD** | 70 s | 0 |

Sprawdzone automatycznie (27 kontroli, wszystkie zaliczone):

- serwer odpowiada, przyjmuje zadanie, podaje status etapami;
- bajty sceny i modelu mają hashe z podsumowania i z nagłówka odpowiedzi; scena wczytuje się ponownie z tym samym hashem treści;
- wynik przyszedł ścieżką konsultanta, `globalDescription: DISABLED`;
- czytnik domu nie był wywołany: w księdze hosta 16 rezerwacji i 16 rozliczeń, wszystkie `CONSULTATION`, `descriptions: 0`;
- wynik zawiera `sourceCheck` ze znanymi wadami;
- model pobrany z serwera zawiera lukarnę pod tym samym identyfikatorem (scorer: strona FRONT, 34,8–64,8 %).

W pierwszym biegu jedna kontrola wypadła negatywnie przez błąd samego skryptu sprawdzającego (liczył wiersz otwarcia księgi jako zapytanie); skrypt poprawiony, wpis 7 w `INTERVENTIONS.md`.

**Czego to nie dowodzi.** Serwer działał lokalnie w tym kontenerze. Nie ma wdrożenia, z którym połączyłby się telefon, i aplikacja nie czyta jeszcze nowych pól.

### 13.3 Android

- APK nie był budowany w tej kampanii. Kontrakt wyniku dostał dwa nowe, opcjonalne pola (`sourceCheck`, `consultation`); aplikacja ich jeszcze nie czyta, więc nowy APK nie pokazałby nic nowego.
- Klucz dostawcy pozostaje na hoście; nie ma go w APK ani w repozytorium.
- Brak telefonu i emulatora: **Android UI NOT_VERIFIED**.
- Ostatni wydany numer pozostaje 1339.

---

## 14. Ograniczenia, odrzucone podejścia, następne decyzje

**Ograniczenia.**

- Zbudowana lukarna jest przybliżeniem wizualnym. Nie wolno z niej brać ilości; wynik to mówi.
- Jedyną cechą dachu z konsumentem jest lukarna na połaci dachu dwuspadowego. Dach czterospadowy i wielopołaciowy jako gospodarz: odmowa `NO_PITCHED_HOST` / `REPRESENTATION_LIMIT`.
- Referencje DEV dla cech dachu napisał ten sam operator co kod.
- Recenzja po przebudowie pochodzi z tego samego API, które zgłosiło cechę. Niezależnym dowodem są scorer i oględziny ze źródłem, nie sama recenzja.
- Wnętrza nikt nie sprawdza: oś „wnętrze" ma zawsze `NOT_CHECKED`.
- Host był uruchomiony lokalnie; nie ma wdrożenia dostępnego dla telefonu.
- Pętla nie ma kolejności blokującej: dobudowuje cechę także do modelu, o którym wie, że jest odbity albo niepełny (potwierdzenie, §10.3).
- Status obrysu porównuje obrys rzutu, nie zbudowany model (22192sl).
- Na stronach, które pokazują miniatury innych projektów, obraz innego domu może zostać sklasyfikowany jako elewacja (sp318422). W tej kampanii nic z takiego obrazu nie zbudowano.

**Odrzucone podejścia.**

- Próg udziału (5 %, 10 %) do oceny zasięgu — usunięty; ukrywał brak wykusza.
- Wymóg lepszej skali przy każdej korekcie — usunięty; blokował korekty dachu.
- Lukarna z frontem dokładnie w licu ściany — model odmawia (dwie ściany w jednym miejscu); front stoi tuż za ścianą i wynik to mówi.
- Zamykanie przeszklonego końca bez klasyfikacji strony (poprawka „Fix 2" z dodatku v3.54.2) — włączone tylko za klasyfikacją, bo samo zamykałoby też zadaszone tarasy.

**Trzy następne decyzje.**

1. **Kolejność w pętli i wstrzymania.** Żadna cecha dachu nie powinna być budowana, dopóki to samo spojrzenie zgłasza lustro, brak bryły albo sprzeczną skalę. To wstrzymałoby obie lukarny odrzucone przez scorer w potwierdzeniu. Razem z tym: status obrysu ma porównywać to, co zbudowano, a nie obrys rzutu (22192sl).
2. **Rejestracja elewacji jako osobny krok** (§15.3), a na niej konsument otworów oraz formy dachu i poprzecznego szczytu. API zgłosiło formę dachu na 5 z 18 domów; dziś każde takie zgłoszenie kończy się nazwanym brakiem.
3. **Składanie planu w prawdziwej skali i brakujące bryły** (Madera, Gracja, garaż 22192sl, wykusz Aksamitek). To praca w analizatorze: API już podaje poprawne wymiary i samo zgłasza brakującą bryłę.

---

## 15. Przemyślenia: jak rozwijać analizator i API, żeby dom wyszedł tak dopracowany jak Marcówki

To jest rozdział na prośbę OWNER-a. Zawiera moją ocenę, nie wynik pomiaru; tam, gdzie opieram się na liczbach z tej kampanii, podaję je.

### 15.1 Czym naprawdę różni się model Marcówek od modelu z analizatora

Model Marcówek ma 127 obiektów, a automatyczny model tego samego domu z analizatora 119. Liczba obiektów jest więc prawie taka sama. Różnica leży gdzie indziej:

- **Marcówki mają cechy rozpoznawcze jako osobne, nazwane elementy**: rama podcienia szczytowego z głębokością i skosem, opaska międzykondygnacyjna, pas okapowy, kominy ponad dachem, balustrady, balkony kończące się tam, gdzie kończy je rzut, pokrycie dachu.
- **Każdy otwór jest dziurą w ścianie plus osobnym elementem**, a okno ma podział zgodny z elewacją.
- **Wnętrze ma obieg**: 18 pomieszczeń, 15 drzwi, schody odrysowane z rzutu.
- **Każda liczba ma klasyfikację** (dokładna ze źródła, odrysowana, założenie wizualne).

Ten model powstał ręcznie: człowiek patrzył na rzuty, przekrój i **elewacje**, i przenosił to, co widział. Analizator czyta dziś głównie rzut i wymiary. Elewacji używa do wysokości i ogólnej bryły, ale nie do tego, co na ścianie i na dachu jest. Stąd brała się jaskółka, której nie było.

Wniosek: droga do „domu jak Marcówki” nie prowadzi przez lepszy odczyt skali. Prowadzi przez **systematyczne przeniesienie tego, co widać na elewacjach, do modelu** — rodzina cech po rodzinie.

Jest jeden warunek wstępny, który pokazało potwierdzenie na nowych domach: **bryła musi być najpierw prawdziwa**. Marcówki mają dopracowane detale na poprawnym korpusie. Na 8 nowych domach rozmiar korpusu zgadza się z wymiarami ścian w dwóch (Zagliki dokładnie, Haga w wymiarze samych ścian); w pozostałych brakowało garażu lub wykusza, model był odbity, stał w złej skali albo nie powstał. Detale dołożone do takiego korpusu nie zbliżają domu do źródła. Dlatego pierwsze miejsce w kolejności ma wciąż składanie brył i orientacja, a API jest tu przydatne jako ten, kto błąd bryły **zauważa i nazywa** — robiło to trafnie w każdym takim przypadku.

### 15.2 Podział ról, który się w tej kampanii sprawdził

| Kto | Co robi dobrze | Czego nie powinien robić |
|---|---|---|
| Analizator | mierzy, składa geometrię, pilnuje spójności, zna pochodzenie każdej liczby, odmawia z kodem | zgadywać, co „pewnie tam jest” |
| API | widzi, **co** jest na obrazie i **gdzie** (która elewacja, który prostokąt), porównuje zbudowany model ze źródłem, nazywa różnicę | podawać metry, współrzędne modelu, siatki, cały dom |
| Człowiek | rozstrzyga to, czego źródło nie mówi, i potwierdza korzenie | odhaczać setki wierszy |

Najważniejsza zasada kontraktu: **API odpowiada w pikselach obrazu, analizator przelicza na model**. Jaskółka w Aksamitkach przyszła jako cztery liczby na rysunku elewacji frontowej. Analizator sam zamienił je na udział w szerokości ściany i w wysokości dachu, sam zbudował lukarnę swoją regułą, sam odmówił, gdy za pierwszym razem okap wypadł na 1 % wysokości dachu. Dzięki temu błąd API kończy się odmową z kodem, a nie krzywym domem.

Druga zasada: **API ogląda model, który analizator naprawdę zbudował**, a nie opis. Wcześniejsze kampanie pytały API „opisz dom” i dostawały drugi, konkurencyjny dom. Pytanie „co różni ten model od tych rysunków” daje listę braków, a każdy brak da się związać z konkretnym miejscem.

### 15.3 Brakujące ogniwo: rejestracja elewacji

Dziś każda propozycja cechy niesie własną ramkę fasady (lewy i prawy koniec ściany, okap, kalenica). To działa dla jednej cechy. Dla dwudziestu okien i pięciu detali na czterech elewacjach to za mało: każda propozycja mierzyłaby fasadę od nowa i każda trochę inaczej.

Proponuję zrobić z tego osobny, jednorazowy krok dla każdej elewacji:

1. Analizator (z pomocą API tam, gdzie sam nie widzi) wyznacza na obrazie elewacji cztery kotwice: linię terenu, linię okapu, kalenicę i oba końce ściany.
2. Wynik jest **rejestracją**: przekształceniem „piksel elewacji → miejsce na konkretnej ścianie modelu”, z zapisaną niepewnością.
3. Od tej chwili każdy element na tej elewacji — okno, drzwi, lukarna, opaska, balkon — jest przeliczany tą samą rejestracją.

To jest dokładny odpowiednik tego, co człowiek zrobił przy Marcówkach, przykładając elewację do rzutu. Daje też tani test poprawności: okna, które analizator już ma z rzutu, muszą po rejestracji trafić w okna widoczne na elewacji. Jeśli nie trafiają, błędna jest rejestracja albo przypisanie strony — i wiadomo to przed dodaniem czegokolwiek.

Uważam ten krok za największą pojedynczą dźwignię. Bez niego każda nowa rodzina cech będzie osobną prowizorką.

### 15.4 Rodziny cech w kolejności, w jakiej bym je wdrażał

Każda rodzina potrzebuje tych samych pięciu rzeczy, które w tej kampanii powstały dla lukarny: prymitywu w modelu, typowanej operacji w kontrakcie, wiązania z obrazu do modelu, walidacji z kodami odmowy i ponownego spojrzenia po przebudowie.

| Kolejność | Rodzina | Dlaczego tu | Co już jest | Czego brakuje |
|---|---|---|---|---|
| 1 | Otwory z elewacji: brakujące, zbędne, zła wysokość, podział okna | najwięcej obiektów, każdy widoczny; recenzent Aksamitek sam zauważył „jedno okno zamiast dwóch” | otwory z rzutu, wysokości rodzin | operacja OPENING, rejestracja elewacji |
| 2 | Formy dachu: poprzeczny szczyt, skrzydło z własnym dachem, lukarna ścienna (ze ścianą wychodzącą z elewacji) | zmieniają sylwetkę; API zgłosiło je w sp318422 i Maderze, analizator nie ma konsumenta | lukarna na połaci, dachy z połaci | CROSS_GABLE, ROOF_FORM |
| 3 | Wykusz i lokalna granica obrysu | brakujące 0,9 m w Aksamitkach to brak geometrii, nie tolerancja | klasyfikacja granicy (szklenie / mur / otwarte) | bryła wykusza wspólna dla ściany, płyty i dachu |
| 4 | Ganek, podcień, balkon z balustradą | cechy rozpoznawcze frontu | balkony w modelu | słupy, daszek, zasięg balkonu z rzutu |
| 5 | Kominy, okna połaciowe — położenie | tanie, widoczne | oba typy istnieją | położenie z elewacji i rzutu poddasza |
| 6 | Detale: opaska, pas okapowy, rama szczytu, cokół | to one robią „to jest mój dom” | w starym repo jako elementy Marcówek | prymitywy prezentacyjne, bez udziału w obmiarze |
| 7 | Wnętrze: nazwy pomieszczeń, drzwi, schody | obieg; API nie widzi go na elewacjach | pomieszczenia i drzwi z rzutu | osobne spojrzenie: rzut źródłowy obok rzutu modelu na każdej kondygnacji |

Pozycje 1–3 zmieniają bryłę i obmiar. Pozycje 4–6 to wygląd i powinny być w modelu oznaczone jako przybliżenie wizualne, z którego nie wolno brać ilości. Tak właśnie oznaczona jest dziś lukarna.

### 15.5 Jak powinna wyglądać pętla, gdy rodzin będzie więcej

- **Od ogółu do szczegółu, w ustalonej kolejności.** Najpierw skala i obrys, potem forma dachu, potem otwory, na końcu detale. Poprawka dachu unieważnia stare uwagi o otworach, więc po każdej przyjętej zmianie następne spojrzenie dostaje nowy render.
  Potwierdzenie pokazało, co się dzieje bez tej kolejności: na dwóch nowych domach pętla poprawnie postawiła lukarnę na jej bryle, ale bryła stała po złej stronie domu (model odbity lustrzanie) albo dom nie miał skrzydła garażu. Szczegół był dobry, a całość zła. Dlatego kolejność musi być **blokująca**: dopóki otwarte jest zgłoszenie o tożsamości, lustrze, skali albo brakującej bryle, cech niższego poziomu się nie buduje.
- **Jedno spojrzenie na jedną elewację.** Elewacja źródłowa obok tej samej strony modelu, w tej samej skali i kadrze. W tej kampanii API dostawało cały dom naraz i znajdowało duże braki; na drobne (podział okna) potrzebne jest zbliżenie.
- **Lista kontrolna zamiast pytania otwartego.** „Sprawdź kolejno: liczba okien na piętrze, drzwi, lukarny, kominy, balkon” daje mniej przeoczeń niż „co się różni”.
- **Odmowa analizatora wraca do API jako informacja.** Tak było z pierwszą propozycją jaskółki: analizator odmówił z powodem, API w następnej rundzie podało poprawny okap. To tani i skuteczny mechanizm.
- **Budżet na dom zamiast na pytanie.** Jedno spojrzenie kosztowało w tej kampanii około 0,05 USD. Cztery elewacje po dwa spojrzenia plus rzut to rząd 0,5 USD na dom. Przy takim koszcie nie warto oszczędzać na kontroli; warto oszczędzać na powtórkach, przechowując obrazy źródeł w pamięci podręcznej zapytań.

### 15.6 Czego bym nie robił

- **Nie pozwalałbym API generować domu.** Kampania v3.54.1 pokazała, że globalny opis daje drugi, niespójny model. Setki drobnych propozycji odtwarzających dom od zera to ten sam błąd inną drogą.
- **Nie brałbym wymiarów z renderów perspektywicznych.** Render mówi, że cecha istnieje, nic więcej.
- **Nie liczyłbym ilości z cech dodanych „na oko”.** Lukarna z udziałów elewacji jest dobra do podglądu, nie do zamówienia dachówki.
- **Nie łączyłbym oceny w jedną liczbę.** Dom może mieć poprawną skalę, brakujący wykusz i zgodny dach jednocześnie — i tak powinien być pokazany.

### 15.7 Rola człowieka

Część pytań nie ma odpowiedzi w źródle: wysokość parapetu, której nie ma na rysunku, wariant lustrzany, zasięg balkonu przy sprzecznych rysunkach. Tu pętla powinna kończyć się pytaniem do użytkownika, zadanym raz, o korzeń (np. „okna tej rodziny mają parapet na 90 cm?”), a nie o każdy wiersz. Poprawki API powinny być w aplikacji widoczne jako „dodane po kontroli ze źródłem, przybliżone”, z możliwością cofnięcia. Stabilne identyfikatory cech, które ta kampania wprowadziła, są warunkiem, żeby takie decyzje przetrwały ponowną analizę.

### 15.8 Jak mierzyć postęp w stronę Marcówek

Marcówki są jedynym domem, dla którego istnieje ręcznie zrobiony wzorzec o tej szczegółowości. Proponuję użyć go jako stałego sprawdzianu końcowego: po każdej nowej rodzinie cech uruchomić pełną pętlę na stronie Marcówek i policzyć, ile cech wzorca model odtworzył, w podziale na rodziny (otwory, formy dachu, detale, wnętrze). Ponieważ jeden dom nie dowodzi niczego o innych, każda rodzina potrzebuje też własnego małego zestawu potwierdzającego z kilku wydawców — tak jak lukarna w tej kampanii.

Miarą nie powinna być liczba obiektów ani jedna ocena, tylko tabela: rodzina cech | we wzorcu | wykryte przez API | związane | zbudowane | potwierdzone ponownym spojrzeniem | zgodne ze wzorcem.

---

## Dostawa

| Rzecz | Gdzie |
|---|---|
| Kod, testy, narzędzia | gałąź `claude/new-session-3kzcgh`; punkty kontrolne `4191ef4`, `d17652d`, `195ac56`, zamrożony kandydat `aabc044`; po zamrożeniu zmieniały się tylko raporty, narzędzia pomiaru i księga |
| Raport i indeks | `stage-reports/SOURCE_TO_MODEL_V3543.md`, `stage-reports/README_V3543.md` |
| Protokół, interwencje, braki możliwości, tabele | `stage-reports/artifacts/v3543/` |
| Referencje potwierdzenia | `research/source-to-model/v3543/refs-confirm/` z `refs-confirm.sha256` |
| Księga wydatków | `research/ai-assist/spend-ledger-v3543.json` |
| Notatka przekazania | `research/source-to-model/v3543/HANDOFF.md` |
| Paczka prywatna (poza Gitem) | `/home/user/BuildPlan-V3543-Private.zip`, 74 MB, 1054 pliki, `sha256 82224719…f34e`; `INDEX.md` i `MANIFEST.sha256` w środku; rozpakowanie i sumy sprawdzone; klucza w paczce nie ma; kopia raportu w paczce pochodzi sprzed dopisania tego rozdziału — obowiązuje wersja z Gita |

Plansze prywatne (w paczce, `runs/boards/`), układ ŹRÓDŁO | PRZED | PO, te same kamery przed i po:

- `aksamitki-dormer.png` — cztery elewacje, cztery strony modelu przed i po, powiększenie lukarny;
- `aksamitki-plan.png` — rzut z obrysem zbudowanym i wymiarem wydrukowanym, powiększenie wykusza, widok z góry i aksonometrie przed i po;
- `supertunie-boundary.png`, `supertunie-plan.png` — odmowa (kod i powód słownie) → model; zamknięty koniec przeszklony;
- `sp318422-plan.png` — rzut z obrysem równym wymiarom; ta strona nie ma rysunków elewacji tego domu;
- `confirm-majeranek.png`, `confirm-gracja.png` — dwa domy potwierdzające, na których zbudowano lukarny.

Rendery modelu na planszach to dokładnie te obrazy, które dostało API (nazwa pliku zawiera numer rewizji modelu).

---

## Odpowiedzi wprost

| Pytanie | Odpowiedź |
|---|---|
| Czy usunięto zależność przyjęcia korekty dachu od poprawy skali? | **Tak.** Korekta dachu jest przyjmowana, gdy analizator zbudował cechę, a wszystko poza nią jest bajt w bajt bez zmian. Aksamitki: skala i rewizja metryki te same przed i po. |
| Czy API oglądało końcowy model? | **Tak.** Dostało rendery konkretnej rewizji (`b9fa2e94f997`), a po przebudowie rendery nowej (`281fad0e8527`); hashe obrazów są w zapisie. |
| Czy wykryta jaskółka faktycznie została zbudowana? | **Tak, jako przybliżenie.** Lukarna dwuspadowa na połaci frontowej, 35–65 % szerokości. Nie jest to lukarna ścienna z balkonem jak w źródle. |
| Czy nowa cecha zachowała ID i przeszła serializację? | **Tak.** `dormer-front-c50` w czterech niezależnych biegach, w tym dwóch przez host; model pobrany z serwera ma ją pod tym ID, hash bajtów zgodny z podsumowaniem. |
| Czy mechanizm zadziałał poza ARCHON? | **Mechanizm tak, jakość nie.** Na domu dobredomy (Gracja) pętla wykryła, związała, zbudowała i sprawdziła dwie lukarny; na domu architecturaldesigns odczytała wymiary w stopach i calach i zamieniła odmowę w model. Ale scorer w ramie całego domu uznał tylko 1 z 3 lukarn zbudowanych na nowych domach, bo modele bazowe miały większe błędy. Transfer jakości: niepotwierdzony. |
