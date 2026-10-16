# STAGE BUILDPLAN-ANALYZER-005R-EXTERIOR — źródłowo powiązane dowody zewnętrza w JSON (badanie)

**Klasa: RESEARCH. Zero zmian produkcyjnych** (G7: FREEZE IDENTICAL). Bez APK, bez ślepej rundy, bez BLIND_14, bez 005S,
bez sieci. Baza `bfaf286e95105c2cdb32df2d298d3cd93bd43449` (preflight: `analyzer/visual-source-projection-guard-adoption-v1`
i `claude/new-session-3kzcgh` = baza; brak `BASE_DRIFT`). Gałąź `analyzer/exterior-scene-feature-evidence-v1`, jeden
commit, lustro CI nietknięte.

**Werdykt: `PARTIAL_RESEARCH_INSUFFICIENT_TRUTH`.** Wszystkie 7 twardych bramek przechodzi, kontrakt JSON jest
użyteczny i odrzuca jawnie, ale według zapieczętowanej reguły §6 żadna z 7 klas rozpoznawczych (pergola, wiata, daszek
wejściowy, słupy, balkon, loggia, balustrada) nie ma ani jednej edycji potwierdzonej technicznie — dla pergoli, daszka
i słupów nie istnieje nawet kanał techniczny, więc PASS był praktycznie nieosiągalny (audyt, uwaga 12). Preregistrowany
B1 nazywa „potwierdzonymi” 15 propozycji (GARAŻ 9, TARAS 6); **po audycie (addendum E, post-hoc) ściśle zostają 2**
(taras w `dom-pod-jarzabem` i `dom-w-jablonkach`). Garaż to spójność karty wydawcy, nie niezależny dowód.
`HUMAN_TRUTH: NOT_RUN`.

## Podsumowanie dla OWNER-a

| pytanie | odpowiedź z pomiarów |
| --- | --- |
| Co da się dziś naprawdę ustalić o zewnętrzu z lokalnych, legalnych danych? | **Na poziomie edycji:** garaż zamknięty i jego brak jako **spójność karty wydawcy** (plan pomieszczeń, wydrukowana powierzchnia i specyfikacja bramy z tej samej strony co kategorie: 9 tak / 5 nie — to jeden fakt wydawcy, nie odczyt ortogonalny); taras przy progu wnęki z rzutu (B1: 6, ściśle 2); 10 wnęk / dachów dobudowanych jako `UNKNOWN_ASSEMBLY` z alternatywami. Reszta to roszczenia wydawcy (pergola 6, daszek 5, przeszklenia 7, balkon 2) albo nic. **Na poziomie klatki:** rola sceny z układu strony (33 z 71 klatek; 38 wstrzymań), a widoczność cechy na renderze — **0 z 19 rozstrzygniętych** (żaden czytnik pikseli się nie kwalifikuje, recenzji nie było). |
| Czy wnętrze może zostać „zewnętrzem”? | **Nie w zmierzonym zbiorze.** 12 wybranych wnętrz + 113 par (zasób, edycja) z rozszerzonego zbioru wnętrz: 0 skierowanych do zewnętrza, 0 cech zewnętrznych na wnętrzu. 2 kadry z karuzeli wnętrz z podpisem „stylizacja/segmenty” (błąd wydawcy 005R B-1) → wstrzymanie, nie zgadywanie. |
| Pergola czy pełny dach? Wiata czy garaż? | Pergola: tylko roszczenie (OPEN_COVER z kategorii), 0 potwierdzeń; płyta z przekroju nigdy jej nie potwierdza ani nie obala. Wiata: 0 roszczeń, 0 wpisów; 16 „wiatrołapów” poprawnie **nie** czytanych jako wiata (naiwny regex: 14/14 edycji). Garaż zamknięty: 9 edycji spójnych z kartą wydawcy; czy model produkcyjny ma bramę garażową — `NOT_MEASURED` (pole, które liczyłem, nie istnieje; audyt, uwaga 5). |
| Czy render daje jakąś miarę? | **Nie.** 47 propozycji perspektywicznych, 0 z autorytetem metrycznym, 0 SOURCE_EXACT z perspektywy; strażnik N1 (`tasks.ts`, `apply.ts`) bajt w bajt. |
| Czy Rarytasy 5 (G2E) to dom OWNER-a? | **Nie** i kontrakt to wymusza: `m84f2903cb8e14` i `m3ea28300f9b3e` są osobnymi edycjami; jedna grupa bajtowo wspólna (wnętrze) ma jedną grupę korelacji w trzech edycjach; OWNER-owa edycja dostaje 0 kotwic technicznych z cudzego przebiegu (sama nie ma przebiegu produkcji). Wypranie dowodu G2E-5 do edycji OWNER-a jest odrzucane (F3 po poprawce C; przemianowanie rodzaju kotwicy — dopiero po poprawce E). |
| Rekomendacja | **Następny krok to niezależny dowód, nie detektor:** mała, lokalna recenzja OWNER-a (≈ 60 pozycji) widoczności cech na tych 5 renderach zewnętrznych i 14 elewacjach — pierwsza prawdziwa referencja klatkowa. Bez niej każdy detektor pergoli/daszka byłby mierzony na roszczeniach wydawcy. |

## A. Baza, zakres, zamrożenie

- Dotknięte ścieżki: `research/analyzer-005r-exterior/`, ten raport, `PROJECT_STATUS.md`, nowy blok w
  `tests/architecture/research-isolation.test.ts`. `packages/`, `apps/`, `android/`, `.github/`, `holdout/`,
  lockfile, manifesty — identyczne z bazą (`results/gates.json` → `G7_scope_freeze`).
- Wejścia (wszystkie już lokalne, bez nowego pobrania): katalog roboczy korpusu 005R (bajty po SHA-256, podpisy
  prywatnie), strony ARCHON w cache (tylko tekst), zapieczętowane przebiegi N1v (model kanoniczny, ramki grafu
  obserwacji, graf cech). Prywatny ledger i 228 kopii do kontroli stabilności leżą w prywatnym katalogu etapu, poza Git.
- **Nie otworzyłem żadnego obrazu wydawcy** (ani audytor); żaden piksel nie trafił do zdalnego modelu.

## B. Ledger źródeł i prawdy (`ledger.py`, `results/corpus-manifest.json`)

Reguła (nie wybór): rodziny 005R z modelem N1v, których edycja ma ≥ 1 strukturalny render zewnętrzny i ≥ 1 elewację;
Marcówki i Rarytasy wymuszone; reszta w kolejności `sha256(SEED:rodzina)` do 12.

| | liczba |
| --- | --- |
| rodziny / edycje | **12 / 14** (w tym OWNER-owa `m3ea…` jako kontrola izolacji, bez przebiegu produkcji) |
| unikalne grupy obrazów (linie dHash) | **36** (14 render zewn., 14 elewacja, 7 wnętrze-negatyw, 2 konflikt struktury; 1 grupa pełni dwie role) |
| zasoby bajtowe / pary (zasób, edycja) | 76 / 71 |
| rozszerzony zbiór wnętrz | 159 zasobów, 178 par (113 wnętrz bez podpisu zewnętrznego) |
| zasoby publikowane przez > 1 edycję | 5 (jedna grupa korelacji obejmuje `m3ea`, `m738`, `m84f`) |

Każdy wpis niesie osobno cztery kanały, które nigdy się nie zastępują: `publisherStructureClaim` (galeria / zakładka
elewacji / karuzela wnętrz z KLASĄ podpisu; kategorie produktu; słowa kluczowe opisu), `pixelInterpretation` (odczyt
V1 z 005R, NON_AUTHORITATIVE), `orthographicTechnicalConfirmation` (cechy produkcyjne z rzutu/przekroju/elewacji; plan
pomieszczeń i parametry), `reviewerAdjudication` (**NOT_RUN** wszędzie). Ograniczenia z dokładnymi liczbami:
`research/analyzer-005r-exterior/truth-limitations.md`.

## C. Prerejestracja i addenda

`research/analyzer-005r-exterior/preregistration.md`, zapieczętowana 2026-10-16T09:51:34Z **mechanicznie** (jeden commit
na etap): `gates.py` odmawia startu, gdy którykolwiek zapieczętowany skrypt ma inny SHA-256 niż w §8; dziennik skrótów
pliku poza Git. Przed pieczęcią widziałem zbiory roszczeń i liczby cech produkcyjnych na edycję (ujawnione w §0
prerejestracji); żaden kontender nie był uruchomiony na prawdziwym przypadku.

- **A** (przed jakimkolwiek wynikiem): `refuse_inside_repo` odrzucał sam katalog `results/` — poprawka jednej linii.
- **B** (po przebiegu 1): **G5/S1 FAIL — 0/10 przetasowań bajtowo identycznych.** Przyczyna: w 6 ze 152 propozycji
  kolejność `sourceEvidence` szła za kolejnością wejścia (i zmieniała `proposalId`); decyzje identyczne. Poprawka:
  sortowanie kotwic. Nie ukrywam porażki: przebieg 1 jest opisany tu.
- **C** (po przebiegu 2, wynik falsyfikacji): F3 pokazał, że dowód G2E-5 przepisany na edycję OWNER-a z
  przemianowanymi kotwicami **przechodził** walidator (znał tylko bajty wybranych zasobów). Poprawka: kontekst walidatora
  zna własne ramki i cechy przebiegu każdej edycji; nowy test `m1b`. Wynik przebiegu 2 zachowany
  (`results/gates-run2-before-addendum-c.json`).
- **D** (kosmetyka): klucz manifestu `description` (mapa rodzajów, nie tekst) → `descriptionKinds`, żeby strażnik
  kluczy tekstowych mógł zakazać `description`. Manifest bajtowo równy zapieczętowanemu po odwróceniu nazwy; zbiory
  propozycji B0/B1 mają **identyczny** skrót jak w przebiegu 3.

- **E** (po audycie, post-hoc): utwardzenie walidatora (każda kotwica sprawdzana z manifestem swojej edycji, perspektywa
  i wnętrze po bajtach), zestaw fałszerstw audytu jako test, GARAŻ bez SOURCE_EXACT, etykiety rodzaju kontroli
  look-alike, ścisłe przeliczenie potwierdzeń obok preregistrowanego. Szczegóły w §I.

Żadna reguła decyzji B1 (rola sceny, status cechy), próg ani reguła werdyktu nie zmieniła się po wynikach; jedyna zmiana
wyjścia B1 to `metricAuthority` garażu (E). Werdykt nie zależy od E.

## D. Kontendery

| id | co | wynik |
| --- | --- | --- |
| B0 | produkcja: role ramek adaptera + cechy techniczne produkcji | 90 propozycji; perspektywa = scena nieznana (adapter nie ma klasy wnętrza); 45 klatek produkcja w ogóle nie dostała |
| B1 | B0 + struktura strony + klasa podpisu + kategorie/opis + plan pomieszczeń/parametry; fuzja regułami §4 | 152 propozycje, 0 błędów kontraktu |
| B2 | opcjonalny wąski predykat pikselowy | **NOT_RUN**: zmierzona reszta B1 (9 z 14 grup zewnętrznych wstrzymanych) jest **metadanowa** — te obrazy mają tylko kanał ogólnej karuzeli, który niesie też rzuty i nieznane; 005R oznaczył je jako zewnętrze dopiero po podpisie „widok N”. Predykat pikselowy nie ma tu wiarygodnej referencji, a V1 jest znanym skrótem formatu (S4 niżej). |

## E. Wyniki

**Rola sceny** (zgodność ze strukturą 005R — to SPÓJNOŚĆ, B1 czyta tę samą strukturę; nie dokładność):

| struktura 005R → | B0 | B1 |
| --- | --- | --- |
| elewacja (16 par) | 15 elewacja, 1 nieznane | **16 elewacja** |
| render zewnętrzny (14) | 14 nieznane | 5 zewnętrze, 9 wstrzymane |
| wnętrze (14) | 14 nieznane | 12 wnętrze, 2 wstrzymane (konflikt) |
| nieznane (27) | 27 nieznane | 27 wstrzymane |

Kanał pikselowy V1 (nie decyduje): zgadza się na 16/16 elewacjach i 12/12 wnętrzach, na 5/5 renderach zewnętrznych się
wstrzymuje — dokładnie słabość znana z 005R.

**Cechy na poziomie edycji (B1, 14 edycji):**

| klasa | TECHNICALLY_CORROBORATED | TECHNICAL_ONLY | VISUAL_ONLY | PUBLISHER_CLAIM_ONLY | negatyw | rodziny z potwierdzeniem |
| --- | --- | --- | --- | --- | --- | --- |
| TERRACE | 6 | 0 | 0 | 8 | — | 6 |
| GARAGE_ENCLOSED | 9 | 0 | 0 | 0 | 5 (TECHNICAL_NEGATIVE) | 8 |
| PERGOLA | 0 | 0 | 0 | 6 | — | 0 |
| ENTRANCE_CANOPY | 0 | 0 | 0 | 5 | — | 0 |
| BALCONY | 0 | 0 | 1 | 2 | — | 0 |
| RAILING | 0 | 0 | 1 | 1 | — | 0 |
| LARGE_GLAZING | 0 | 0 | 0 | 7 | — | 0 |
| UNKNOWN_ASSEMBLY | — | 10 (8 wnęk, 2 dachy dobudowane) | — | — | — | — |
| CARPORT, LOGGIA, COLUMNS_SUPPORTS | 0 | 0 | 0 | 0 | — | 0 |

**Ścisłe przeliczenie po audycie (`results/addendum-e-strict.json`, reguły B1 bez zmian):** GARAGE 9 →
PUBLISHER_SPEC_SHEET_CONSISTENCY (0 technicznych); TERRACE 6 → 2 ściśle (widziane na ramce, wnęka nieodrzucona przez
produkcję, roszczenie z kategorii) + 4 słabe (2 wyprowadzone tam, gdzie produkcja sama zaprzeczyła wnęce, 1 MODEL_ONLY
bez ramek, 1 tylko z tokenu opisu `taras`, który jest pozytywny w 14/14 edycjach).

B0 ma tylko TERRACE TECHNICAL_ONLY 6, UNKNOWN_ASSEMBLY 10 i po jednym VISUAL_ONLY balkonu/balustrady: bez roszczeń nie
umie nic potwierdzić ani zaprzeczyć (garaż w ogóle nie istnieje w B0).

**Klatki:** 19 propozycji widoczności cech na 5 renderach zewnętrznych — **19/19 wstrzymanych**
(`FRAME_VISIBILITY_NOT_MEASURABLE`); 1 cecha związana z elewacją po skrócie bajtów (VISUAL_ONLY); 0 regionów pikselowych.

**Falsyfikacja (prerejestrowana):** F1 i F2 (bez wejść technicznych / bez roszczeń → 0 potwierdzeń) to tylko kontrole
sanity — reguła statusu wymaga obu wejść z konstrukcji (audyt, uwaga 7). Właściwa falsyfikacja to F3: wypranie G2E-5 →
OWNER łapane w przebiegu 2 1/1 „jak jest”, **0/1 po przemianowaniu**; po C 1/1. Audyt pokazał jeszcze, że
przemianowanie **rodzaju** kotwicy na TECHNICAL_SCHEDULE przechodziło — zamknięte w E (`schema/test_bypasses.py`).

## F. Bramki twarde (`results/gates.json`)

| bramka | wynik | dowód |
| --- | --- | --- |
| G1 izolacja edycji | **PASS** | 0 EDITION_MIX; edycja OWNER-a: 0 kotwic produkcji (GARAGE potwierdzony z **jej własnej** strony, 2× tylko roszczenie); 1 grupa korelacji w 3 edycjach |
| G2 wnętrza | **PASS** | 0 promocji; 12 wybranych + 113 par (102 zasoby) rozszerzonych wnętrz → INTERIOR, 2 + 2 z podpisem zewnętrznym → wstrzymanie; z 159 zasobów rozszerzonych bramkowane są te 102, reszta to warianty UNKNOWN (wstrzymane) — i to nadal spójność z tą samą strukturą |
| G3 autorytet perspektywy | **PASS** | 47 propozycji perspektywicznych, 0 z autorytetem, 0 SOURCE_EXACT z perspektywy; strażnik N1 bez zmian |
| G4 look-alike | **PASS** (tylko LA1 może tu zawieść na danych; LA3–LA8 to asercje ścieżki kodu, LA2 opisowe — audyt, uwaga 4) | LA1 wiatrołap≠wiata (16 wpisów, 14/14 naiwnych trafień), LA2 nawigacja≠roszczenie (garaż: 14 naiwnie / 9 produkt), LA3 pergola nigdy SOLID, 0 potwierdzeń płytą, LA4 0 technicznych zadaszeń tarasu, LA5 7 „columns” = kolumny skanu, 0 słupów, LA6 0 kotwic między daszkiem a balkonem, LA7 0 potwierdzonych wiat (w korpusie 0 roszczeń wiaty), LA8 taras tylko z cechy TERRACE |
| G5 stabilność | **PASS** (po B) | S1 10/10; S2 76 dokładnych + 36 bliskich duplikatów: propozycje edycji identyczne, 34/34 ta sama rola; S3 228 prawdziwych kopii (50 %, kwadrat biały/szary): dołączone 213/213 ta sama rola, niedołączone 213/213 wstrzymane; S5 kanał V1 nie decyduje |
| G6 ważność dowodu | **PASS** | 0 błędów kontraktu B0/B1 (także po utwardzeniu E); 15/15 „potwierdzeń” ma kotwicę z etykietą techniczną tej samej klasy, bez bajtów renderu — ale 9 z nich to ta sama strona wydawcy (patrz ścisłe przeliczenie) |
| G7 zakres | **PASS** | tylko ścieżki z allowlisty |

S4 (opisowo): ten sam V1 po dopełnieniu do kwadratu zmienia etykietę na 23/26 (białe) i 17/26 (szare) z rozstrzygniętych
zasobów — dlatego kanał pikselowy jest tylko zapisany.

## G. Kontrakt JSON

`research/analyzer-005r-exterior/schema/` — `research.exterior-proposals.0.1` (walidator stdlib, zamknięte klucze na
każdym poziomie, przykłady syntetyczne, **16 testów**). Wymagane pola briefu: `schemaVersion`, `projectEditionId`,
`assetByteHash`, `frameId`, `role`, `projection`, `viewSide`, `sourceKind`, `proposalKind`, `pixelRegion`,
`featureRelation`, `confidenceOrAbstain`, `sourceEvidence`, `correlationGroup`, `metricAuthority`,
`verificationStatus`, `refusalReason`, `alternatives` (+ `scope`, `featureClass`, `featureRelationBasis`, `channels`).
Po E każda kotwica jest sprawdzana z zapisem swojej edycji w manifeście (odnośnik planu, parametru, roszczenia, cechy
produkcji z jej pochodzeniem i bajtami), perspektywa i wnętrze są rozpoznawane po bajtach, nie po etykiecie;
**30 testów** (16 kontraktowych + 14 fałszerstw audytu, wszystkie odrzucone).
Reguły: SOURCE_EXACT tylko z wydrukowanej wartości technicznej i nigdy z perspektywy; wnętrze niesie tylko rolę sceny;
widoczność na perspektywie musi się wstrzymać; potwierdzenie = roszczenie + kotwica techniczna **tej samej klasy**, bez
bajtów renderu; pergola z SOLID_COVER odrzucona; kotwica musi wskazywać bajty i cechy, które ta edycja opublikowała /
rozwiązała. Garaż nie niesie już SOURCE_EXACT (etykieta bez wartości; E). **Nie dotyka** `packages/architecture/src/proposals.ts`; metrów świata z perspektywy nie da się zapisać
(zamknięte klucze).

## H. Koszt (`results/runtime.json`)

B1 na całym manifeście: mediana 7,8 ms (x86_64, Python 3.11, jeden proces), walidacja 2,2 ms, RSS 22,6 MB; kod ≈ 60 kB,
0 wag, 0 nowych zależności, 0 dekodowania pikseli. Pełne `gates.py` ≈ 60 s (głównie zapis 228 kopii PNG). ARM64:
`NOT_MEASURED`.

## I. Audyt niezależny

Jeden niezależny audytor (bez dostępu do obrazów, bez zapisu w repozytorium) sprawdził kod, liczby, prerejestrację i
napisał 14 dokumentów-fałszerstw. **P0: brak** — żadna bramka nie jest nieważna dla faktycznego wyjścia B1, werdykt
PARTIAL uzasadniony („bardziej zachowawczo, niż etap sam argumentuje”).

| # | waga | ustalenie | dyspozycja |
| --- | --- | --- | --- |
| 1 | P1 | 9 potwierdzeń GARAŻU to wydawca vs wydawca (ta sama strona; powierzchnia z planu = parametr) | przyjęte: ścisłe przeliczenie → PUBLISHER_SPEC_SHEET_CONSISTENCY; język raportu poprawiony |
| 2 | P1 | TARAS: 2 z wnęk zaprzeczonych przez produkcję, 1 MODEL_ONLY, token `taras` 14/14 | przyjęte: ściśle 2 z 6 |
| 3 | P1 | walidator przyjmował 10 z 14 fałszerstw | **naprawione** (E): 14/14 odrzucone, zestaw zachowany jako test |
| 4 | P1 | LA3–LA8 prawdziwe z konstrukcji, LA2 na sztywno | przyjęte: każda kontrola ma `testKind` |
| 5 | P2 | `garageDoorsInModel` zawsze 0 (brak pola) | twierdzenie usunięte → NOT_MEASURED |
| 6 | P2 | SOURCE_EXACT garażu bez wartości | naprawione → NONE |
| 7 | P2 | F1/F2 tautologiczne | nazwane kontrolami sanity |
| 8 | P2 | „159” zawyża pokrycie G2 | liczby podane (102 zasoby / 113 par) |
| 9 | P2 | §2: „edycja modelowana na rodzinę” — Rarytasy mają dwie | sformułowanie poprawione |
| 10 | P2 | ścieżki lokalne w tekstach commitowanych | usunięte z plików badania |
| 11 | P2 | znaczniki czasu addendów, `runtime.json` sprzed D | czasy z dziennika pieczęci; gates i runtime wygenerowane na końcu |
| 12 | P2 | PASS strukturalnie prawie nieosiągalny | powiedziane w werdykcie |

## J. Testy i CI (budżet FAST)

| kontrola | wynik |
| --- | --- |
| `schema/test_schema.py` | 16/16 OK |
| `schema/test_bypasses.py` (fałszerstwa audytu) | 14/14 odrzucone (przed E: 4/14) |
| `research-isolation.test.ts` (cały plik, z nowym blokiem 005R-EXTERIOR 5 testów) | 65/65 passed |
| `gates.py` (G1–G7 + falsyfikacja) | PASS |
| `npm run typecheck` | NOT_RUN_NOT_APPLICABLE_RESEARCH (żaden TypeScript produkcyjny się nie zmienił; zmieniony jest tylko plik testu) |
| `npm test`, `npm run e2e`, emulator, pełne CI (41 jobów), APK, ślepa runda | NOT_RUN_NOT_APPLICABLE_RESEARCH |
| fast-forward lustra CI | nie wykonano (etap badawczy) |

## K. Szew produkcyjny i dług higieniczny (do decyzji koordynatora — nic nie przyjęto)

- **Kandydat kwalifikowany: brak.** Gdyby koordynator chciał jednego szwu po recenzji OWNER-a, byłby to: adapter ARCHON
  (`packages/source-package/src/adapters/archon.ts`) zapisuje pozycję w karuzeli wnętrz / galerii jako **osobne roszczenie
  zakresu sceny** obok `DocumentRole` (bez nowej roli, bez wpływu na geometrię), z wstrzymaniem przy konflikcie kanałów w
  grupie linii. Eksperyment akceptacyjny: na zapieczętowanych 37 wierszach DEV modele i odmowy bajt w bajt; na recenzji
  OWNER-a (≥ 60 pozycji, w tym 15 kadrów 005R B-1) 0 wnętrz jako zewnętrze i ≥ 70 % pokrycia renderów zewnętrznych.
- **Dług (bez zmian w tym etapie):** etykieta wersji analizatora `1.1.0` i nieaktualna fikstura
  `apps/web/src/sample-observations.json` (obserwacje fasady na klatce perspektywicznej). Plan: przy najbliższej
  autoryzowanej zmianie produkcyjnej jeden commit podnosi wersję i regeneruje fiksturę narzędziem repozytorium, z testem,
  który porównuje fiksturę z wyjściem bieżącego analizatora i odrzuca obserwację fasady na projekcji PERSPECTIVE.

## L. Ograniczenia

Jeden wydawca; prawda wyłącznie strukturalna i techniczna (plan pomieszczeń to nadal strona wydawcy, cechy produkcyjne
to niezweryfikowany czytnik); ścisłe przeliczenie E jest post-hoc; taras „przy progu wnęki” jest odczytem rzutu, nie potwierdzeniem, że taras widać ani że
jest zadaszony; widoczność cech na klatkach niezmierzona; 9 z 14 grup zewnętrznych wstrzymanych; V1 in-sample dla edycji
DEV 005R; brak ARM64.

## M. Handoff

```
STAGE: BUILDPLAN-ANALYZER-005R-EXTERIOR
VERDICT: PARTIAL_RESEARCH_INSUFFICIENT_TRUTH
BRANCH: analyzer/exterior-scene-feature-evidence-v1 (base bfaf286e95105c2cdb32df2d298d3cd93bd43449; mirror untouched)
HEAD: the one commit carrying this report (SHA in the closing message)
FULL_REPORT: stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_EXTERIOR_TRUTH_JSON.md
CORPUS: 12 families / 14 editions / 36 lineage groups / 76 assets (+159 extended interior negatives); HUMAN_TRUTH NOT_RUN
SUPPORTED (edition level): preregistered B1 TECHNICALLY_CORROBORATED 15 (GARAGE 9, TERRACE 6); strict post-audit 2 (TERRACE only); GARAGE 9 yes / 5 no = publisher spec-sheet consistency; UNKNOWN_ASSEMBLY 10 technical-only
NOT SUPPORTED: PERGOLA, CARPORT, ENTRANCE_CANOPY, COLUMNS_SUPPORTS, BALCONY, LOGGIA, RAILING, LARGE_GLAZING (claims only or nothing); frame visibility 0/19 resolved
GATES: G1–G7 PASS (G5 failed on run 1 → B; F3 residual → C; 10/14 audit forgeries accepted → E, now 14/14 refused); AUDIT: P0 none, P1 4 addressed
FREEZE: IDENTICAL
NEXT_RECOMMENDATION: independent evidence stage — local OWNER spot review of feature visibility (not 005S, not a detector)
FINAL_TOKEN: BUILDPLAN_ANALYZER_005R_EXTERIOR_RESEARCH_CLOSED_PARTIAL_RESEARCH_INSUFFICIENT_TRUTH
```
