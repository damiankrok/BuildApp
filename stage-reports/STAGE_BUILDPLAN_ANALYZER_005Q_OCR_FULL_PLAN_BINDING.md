# STAGE BUILDPLAN-ANALYZER-005Q-OCR — pełnostronicowe wykrywanie tekstu (PaddleOCR) + wiązanie liczb z liniami wymiarowymi

**Klasa: RESEARCH (LEAN). Zero zmian produkcyjnych** (zamrożenie IDENTICAL, §J). Bez APK, bez ślepej rundy, bez 005R/005S.
Etap pomostowy po zamkniętym 005Q, przed nierozpoczętym 005R. **005R (pilotaż wizualny) pozostaje bez zmian i nierozpoczęty.**

## Podsumowanie dla OWNER-a

Wszystkie liczby po addendum C (poprawki obu recenzji). PRIMARY = prawda niezależna od kandydatów albo z transkrypcji 005O;
MAIN = 8 arkuszy bez arkusza smoke S5.

| pytanie | odpowiedź z pomiarów |
| --- | --- |
| Czy pełnostronicowy detektor (B1) znajduje etykiety, których incumbent (B0) nie zaproponował? | **Praktycznie nie.** Na jedynym poziomie prawdy niezależnym od obu kandydatów (`LOCAL_DOUBLE_READ`, 51 etykiet) B0 wykrywa **45**, B1 **46**. Na całym PRIMARY MAIN (110) B1 dokłada **3 wykrycia i 1 nową poprawną wartość** (S3 `326`); 4 etykiety (3,6 %) to `NEVER_PROPOSED`. Poziom 59 etykiet z transkrypcji 005O to wycinki B0 — nie mierzy recall B0. |
| A wariant „wrażliwości”? | Z prawdą `R1_CONFIDENT` (PP‑OCRv6 medium — ta sama rodzina co kandydaci, 13 % „konfliktów” z poziomem A) B1 dokłada 29 wykryć i 11 poprawnych wartości z 152. **Niezweryfikowane niezależnie** — nie opieram na tym żadnego wniosku. |
| Czy B1 czyta lepiej? | Ten sam rozpoznawacz, inne pudełko: B0 84 poprawne / 0 błędnych, B1 67 / 0 (bliźniaki obrotu wyłączone). B1 pokrywa mniej (scala sąsiednie napisy, tnie liczby z kreską). |
| Gdzie naprawdę giną liczby (B0, PRIMARY MAIN, 110)? | **Za odczytem.** `READ_RIGHT_NOT_BOUND` **33**, `STATEMENT_VALUE_REWRITTEN` **26** (23 `CHAIN_CORRECTED`; **5 wbrew poprawnemu tokenowi i PP‑OCR**: 1385→1382, 1020→1010, 226→216, 176→136, 165→185), `READ_RIGHT_ENSEMBLE_NOT_KEPT` 6, `READ_RIGHT_BOUND_WRONG` 2, `READ_NOT_CORROBORATED` 13, `ROTATIONAL_TWIN_AMBIGUOUS` 3, `TOKEN_NOT_ON_A_CHAIN` 2, **`NEVER_PROPOSED` 4**, bez utraty 21. |
| Czy ślepe wiązanie geometryczne (B2) pomaga? | Na 19 etykietach MAIN z prawdą wiązania: **B2 17 poprawnych / 1 błędne / 1 zajęty odcinek**, B0 13 / 2 / 4 niepowiązane. Kierunkowo lepiej, ale próba mała, z czego 2 prawdy wiązania odbiegają > 3 % od skali transkrypcji (audyt), a na Murajach (S2, S3) prawdy wiązania nie ma wcale. |
| Fałszywie pewna skala? | **Żadna.** B2 nie dał skali spójnej na obu osiach na żadnym arkuszu (brak niezależnej skali, ale i brak fałszywej); skala jednej osi na S4/S6/S7 w granicy 0,3 % od TRUE_SCALE. |
| Samokotwiczenie | Kotwice rejestracji B0 na 8 arkuszach z rejestracją: **49 `CHAIN_CORRECTED` vs 18 `READ` (73 %)**; Muraje (S2, S3) i Goździkowce (S4): **100 %** kotwic to wartości dobrane do skali, którą „potwierdzają” (`extract.ts:997`). |
| Muraje — 5 etykiet klasy (a) z 005O | `314` — B1 ma pudełko, czyta źle (tusz w rysunku auta); `160` — B1 czyta dobrze tylko przy prawdzie SENSITIVITY; `256`, `209`, `95` — **NOT_MEASURED**: żaden proponent ani okno linii ich nie objął (linia niewyodrębniona / znak wodny). |
| Rekomendacja | **Nie wdrażać detektora pełnej strony.** Osobny wąski eksperyment integracyjny na granicy łańcuch/decyzja (§N), do autoryzacji OWNER-a. |

**Werdykt: `PASS_RESEARCH_BUILDPLAN_ANALYZER_005Q_OCR`** — dopasowane porównanie wykrycie/odczyt/wiązanie przebiegło na tych
samych arkuszach i tej samej prawdzie; wynik dla odkrywania tekstu to **NO_GAIN**, a miejsce utraty jest zmierzone.

## A. Baza, gałąź, zamrożenie

- Repozytorium `damiankrok/BuildApp`, baza **`0aaa31f5af3e98fa9d9ca51887e5185333de267b`** (`analyzer/source-grounded-exterior-boundary-v1`); `origin/claude/new-session-3kzcgh` na tym samym SHA na starcie (brak dryfu), drzewo czyste.
- Gałąź: `analyzer/paddleocr-full-plan-binding-research-v1` od tej bazy; każdy push lustrzany do `claude/new-session-3kzcgh` (konwencja CI repozytorium: workflow uruchamia się na `claude/**`).
- Zamrożenie produkcji: `research/analyzer-005q-ocr/freeze-manifest.mjs` (`packages/`, `apps/`, `.github/`, manifesty i lockfile, model `.onnx`, słownik, WASM, bundle lokalnego analizatora) → `production-freeze-start.json`; kontrola końcowa §J.
- Dotknięte ścieżki: wyłącznie `research/analyzer-005q-ocr/`, `stage-reports/artifacts/analyzer-005q-ocr/`, ten raport, `PROJECT_STATUS.md` oraz blok 005Q-OCR w `tests/architecture/research-isolation.test.ts`.

## B. Detektor — inwentarz, licencja, dostępność

| element | wartość |
| --- | --- |
| detektor B1 | `PaddlePaddle/PP-OCRv6_tiny_det_onnx@2ba1506c0380b8f0b03dd142459aac66d4421f6c`, `inference.onnx` 1 780 590 B, sha256 `193bab7a…f8`, **Apache‑2.0**, ostatnia zmiana 2026‑06‑18 |
| rozpoznawacz B0/B1 | wdrożony `PP-OCRv6_tiny_rec` (`9ef676d6…`), WASM `onnxruntime-web 1.30.0` — **ten sam** dla B0 i B1 |
| czytnik prawdy R1 | `PaddlePaddle/PP-OCRv6_medium_rec_onnx@50c7eaca…`, 76,6 MB, sha256 `9c09abf0…`, Apache‑2.0 (natywny ORT 1.22.0 w scratch; wersja WASM: ~20 min/arkusz, porzucona) |
| czytnik prawdy R2 | Tesseract 5.3.4 (pakiet systemowy w kontenerze, nie zależność repo) |
| gdzie | wszystkie wagi, strony, wycinki i odczyty: `/home/user/work005q-ocr` (poza Git). Brak chmurowego OCR, brak zdalnego AI. |

Detektor był dostępny — **nie** zachodzi `NOT_RUN_DETECTOR_UNAVAILABLE`. Model „recognition-only” nie był traktowany jak detektor;
tokeny legacy nie są nigdzie przemianowane na „niezależną detekcję” (B1 to wyłącznie pudełka DB).

## C. Próba i prawda (przed porównaniem)

**Korpus** (`research/analyzer-005q-ocr/corpus.json`, `artifacts/…/corpus-manifest.json`): 9 arkuszy rzutów, **7 niezależnych rodzin**
(S2 i S3 to dwie kopie jednego rysunku Murajów — jedna linia pochodzenia). Porażki: S1 glogownikach, S2/S3 murajach, S4 gozdzikowcach.
Kontrole: S5 marcowki (**arkusz smoke/strojenia, raportowany osobno**), S6 kosacce‑clean (gęste etykiety, powierzchnie pomieszczeń
przy liniach), S7 zurawkach, S8 A06, S9 D02 (DobreDomy, większa strona 962×1202 — testuje kafle). Wszystko developerskie; brak ślepej rundy.

**Prawda bez zdalnego modelu** (reguła OWNER-a; `truth.ts`, `r1_server.py`, `score.py`):
- **Rama próbkowania szersza niż propozycje B0:** każdy klasyczny token ≥ 2 glify (odkrycie incumbenta *przed* testem linii), każde pudełko B1,
  oraz **okna linii** po obu stronach każdego odcinka każdej zamrożonej linii wymiarowej, na którym nie leży żadna propozycja (3 694 lokalizacje).
- Poziom A `PRIOR_TRANSCRIPTION`: podwójna ślepa transkrypcja 005O tego samego tuszu (59 etykiet). Poziom B `LOCAL_DOUBLE_READ`: R1 = R2 po
  zdjęciu separatorów na końcach (51 etykiet). Razem **PRIMARY = 110 etykiet wymiarowych** (8 arkuszy głównych) + 17 na S5.
- Poziom C `R1_CONFIDENT` (addendum A, przed pierwszym scoringiem): R1 ≥ 0,98 bez sprzeczności R2 tej samej długości — **SENSITIVITY = 152** (MAIN).
  R1 to rodzina PaddleOCR jak kandydaci: **ten poziom jest skorelowany** i nie wspiera żadnego wniosku o dokładności B1.
- Jakość prawdy: na tych samych ciasnych lokalizacjach poziom A i odczyt lokalny zgadzają się **46/46**; 5 „konfliktów” to przypięcie
  innej lokalizacji (scalone pudełko `9210`, fragment `3`, okno linii `999`, odwrócone `008`, fragment `115`) — nie błąd odczytu tuszu.
  R1_CONFIDENT vs poziom A: 20 zgodnych, 3 „konflikty” tego samego typu (przypięcia).
- Klasy: `DIMENSION` = liczba całkowita 2–5 cyfr na zamrożonej linii albo na prostym przebiegu z ≥ 2 kreskami (test `onDimensionLine`);
  `NOT_A_DIMENSION:OFF_LINE / DECIMAL_OR_AREA / TEXT`; `AMBIGUOUS_READ`, `UNREADABLE` osobno.
- **Prawda wiązania (po addendum C):** tylko znaczniki klasy `TICK` (jak produkcja); spośród **wszystkich** odcinków każdej linii, na
  której leży etykieta, ten jedyny, na którym jej wartość jest proporcjonalna (±3 %) do innej etykiety z prawdą na tej samej linii
  (mierzonej na odcinku pod jej własną pozycją). Bez skali strony, rejestracji czy powierzchni. Równe odcinki rozstrzyga pozycja (3 razy,
  oznaczone). Wynik: **19 etykiet MAIN + 6 na S5**; reszta `NO_LINE_TRUTH`. Audyt (nie wybór): 2 z 19 prawd wiązania MAIN leżą > 3 % od
  skali transkrypcji 005O — możliwe błędy prawdy. Na S2/S3 (Muraje) prawdy wiązania brak.
- **Przegląd przez człowieka: NOT_RUN** — w sesji nie było recenzenta, a obrazów nie wolno było pokazać modelowi. Przygotowano
  `spot-review-request.json` (20 etykiet: niezgodności, bliźniaki obrotu, nowe z B1; hash wariantu + pudełko strony) do lokalnej weryfikacji przez OWNER-a.

## D. Kandydaci (zamrożone parametry, `preregistration.md`)

- **B0**: zapieczętowany przebieg incumbenta (klasyczny token → kratka numeryczna → crop PP‑OCRv6 → zespół). Harness odtwarza zestaw z tych
  samych bajtów zamrożonym kodem: **`b0Reproduced = true` na 9/9 arkuszach** (każde zapieczętowane pudełko odtworzone).
- **B1**: detektor DB tiny w pełnej rozdzielczości, kafle 640 px / zakładka 160, DBPostProcess 0,2/0,4/1,4, deduplikacja na granicach kafli,
  odczyt tym samym rozpoznawaczem i tym samym nawiasem stabilności na `labelCrop` z tego samego pola przebiegu, oba obroty osi pudełka.
  Skala 2× sprawdzona tylko na arkuszu smoke (40 vs 42 z 59 pudełek B0, 3,4× wolniej) — zamrożono 1×.
- **B2**: ślepe wiązanie geometryczne na sumie potwierdzonych kandydatów B0 ∪ B1 (**jeden tusz = jeden kandydat**, nigdy dwóch świadków),
  koszt = odległość w poprzek / wysokość + przesunięcie od środka odcinka / długość, zachłannie globalnie, margines < 0,25 → `UNRESOLVED`.
  Ślepe na wartości, skalę, obrys, powierzchnię i tożsamość domu (test `test_blind_to_values`).

## E. Wyniki — wykrycie i odczyt (`label-chain-score-primary.json`, `…-sensitivity.json`)

**Wykrycie według poziomu prawdy (MAIN):**

| poziom prawdy | n | B0 wykrył | B1 wykrył | B0 wartość ✓ | B1 wartość ✓ |
| --- | --- | --- | --- | --- | --- |
| `PRIOR_TRANSCRIPTION` (wycinki B0 z 005O — nie mierzy recall B0) | 59 | 59 | 55 | 47 | 36 |
| **`LOCAL_DOUBLE_READ` (niezależny od kandydatów)** | **51** | **45** | **46** | 37 | 31 |
| `R1_CONFIDENT` (tylko SENSITIVITY, skorelowany) | 42 | 9 | 31 | 4 | 13 |

**MAIN razem:**

| | PRIMARY (n = 110) | SENSITIVITY (n = 152) |
| --- | --- | --- |
| B0 / B1 wykryte | 104 / 101 | 113 / 132 |
| tylko B1 / tylko B0 | 3 / 6 | 29 / 10 |
| B0 wartość poprawna / błędna | 84 / 0 | 88 / 0 |
| B1 wartość poprawna / błędna | 67 / 0 | 80 / 3 |
| **B1 nowe poprawne wartości (B0 nie wykrył)** | **1** | 11 (skorelowana prawda) |
| bliźniaki obrotu (oba obroty potwierdzone, różne wartości; wyłączone z ✓/✗) | B0 7, B1 3 | B0 8, B1 3 |

- **Fałszywe wykrycia B1** (potwierdzone liczby całkowite, nie na etykiecie wymiarowej): PRIMARY MAIN **6 potwierdzonych**
  (`NOT_A_DIMENSION:OFF_LINE` — liczby pomieszczeń/opisów), **49 `UNVERIFIED`** (prawda nierozstrzygnięta — nie liczone jako fałsz).
  Pełny detektor widzi też nazwy i powierzchnie pomieszczeń; do B2 wchodzą tylko liczby całkowite 2–5 cyfr.
- **Bliźniaki obrotu**: `870`/`028`, `790`/`062`, `700`/`002`, `800`/`008`, `890`/`068` — oba obroty p ≈ 1 i stabilne. To nie błąd
  rozpoznawacza, tylko decyzja o orientacji (max‑p wybiera źle np. `068` 0,99906 > `890` 0,99738).
- **S9 (DobreDomy):** 0 etykiet wymiarowych w PRIMARY (1 w SENSITIVITY); pudełka B1 to nazwy pomieszczeń i powierzchnie.
  **Drugi wydawca ani nakładanie kafli nie zostały sprawdzone na etykietach** — arkusz nieinformatywny.
- Historia scorera: run1 (`*-run1.json`) → addendum B (bliźniaki B0 wg max‑p) → addendum C (recenzje). Progi B1/B2 nigdy się nie zmieniły.

## F. Gdzie incumbent traci etykietę (`b0Loss`, PRIMARY MAIN, n = 110)

| pierwsza utrata | liczba | znaczenie |
| --- | --- | --- |
| `NEVER_PROPOSED` | 4 | ani token klasyczny, ani kratka — prawdziwa utrata odkrycia |
| `TOKEN_NOT_ON_A_CHAIN` | 2 | token był, test linii go odrzucił |
| `READ_NOT_CORROBORATED` | 13 | zaproponowany, PP‑OCR nie potwierdził (2–5 cyfr) |
| `ROTATIONAL_TWIN_AMBIGUOUS` | 3 | oba obroty potwierdzone, wypowiedź nie rozstrzyga |
| `READ_RIGHT_ENSEMBLE_NOT_KEPT` | 6 | odczyt cropu dobry, zespół zatrzymał inną wartość (`1930`→`1410`, `387`→`187`, `374`→`510`, …) |
| **`READ_RIGHT_NOT_BOUND`** | **33** | przeczytane dobrze, w zapieczętowanym dowodzie bez odcinka |
| `READ_RIGHT_BOUND_WRONG` | 2 | |
| **`STATEMENT_VALUE_REWRITTEN`** | **26** | wartość w dowodzie ≠ tusz: 23 `CHAIN_CORRECTED`, 3 `READ` z błędnym tokenem klasycznym |
| `NONE` | 21 | odczyt, wiązanie i wartość zgodne |

Pięć przepisań **wbrew poprawnemu tokenowi klasycznemu i PP‑OCR**: `1385→1382` (S4), `1020→1010` (S2), `226→216` (S6),
`176→136` (S7), `165→185` (S8). Lista: `false-binding-examples.json` → `b0StatementRewritten`.

## G. Wiązanie i skala

| na etykietach z prawdą wiązania | poprawne | błędne | inne |
| --- | --- | --- | --- |
| B0 (zapieczętowane), MAIN n = 19 | 13 | 2 | 4 niepowiązane |
| **B2 (ślepe, geometria), MAIN n = 19** | **17** | **1** | 1 `SEGMENT_TAKEN` |
| B0 / B2 na S5 (smoke), n = 6 | 5 / 5 | 0 / 0 | 1 niepowiązane / 1 `UNRESOLVED` |

- Prawda wiązania jest na S1 (2), S4 (3), S6 (7), S7 (5), S8 (2) — **nie ma jej na Murajach**; tam o wiązaniu nic nie zmierzono.
- B2 ogółem (PRIMARY MAIN): 17 poprawnych, 1 błędne, 61 powiązanych bez prawdy, 2 `UNRESOLVED`, 7 `SEGMENT_TAKEN`, 7 `NO_LINE`,
  13 powiązań kandydatów o nierozstrzygniętej prawdzie (`UNVERIFIED`, 0 potwierdzonych fałszywych).
- **Niezależna skala B2:** żadnej dwuosiowej; jednoosiowa S4 2,5487 (−0,29 %), S6 2,4058 (−0,03 %), S7 2,2181 (−0,04 %). **0 fałszywie pewnych.**
- **B0 metric solution** (zapieczętowana): kontrole w granicach 0,1 %, glogownikach −0,1 % (STRONG), Muraje `LEGACY_UNCONFIRMED`
  2,451 (S2) i 1,532 (S3) — odmowa poprawna; Goździkowce −0,88 % (SUPPORTED).
- **Kotwice rejestracji B0:** `CHAIN_CORRECTED` 49 / `READ` 18; S2 3/3, S3 6/6, S4 6/6 `CHAIN_CORRECTED`.

## H. Odtworzenie solvera (read-only)

**NOT_RUN — reguła stopu z preregistracji.** B1 nie wniósł dodatkowej etykiety ani łańcucha na arkuszach porażek, który przeszedłby
prawdę PRIMARY (S1: 0, S2: 0, S3: 1 — `326`, bez prawdy wiązania; S4: 0), a B2 nie dał żadnej skali dwuosiowej. Nie ma dodanego dowodu,
którego wpływ na model 3D byłoby czym sprawdzać. Żadna zmiana kopii, okna/drzwi, tarasu, obrysu ani kondygnacji nie była testowana.

## I. Zasoby i wykonalność mobilna (`performance.json`)

| | x86, 4 vCPU, Node 22, WASM 1 wątek |
| --- | --- |
| detektor na arkusz 853 px (4 kafle) | 1,6–2,8 s (mediana 1,8 s; pierwszy z tworzeniem sesji) |
| odczyt pudełek B1 (oba obroty, 4 warianty nawiasu) | mediana 194 ms/crop, 58–160 cropów/arkusz → 10–31 s/arkusz |
| szczyt RSS | 523 MB |
| model | +1,78 MB (obok 4,46 MB rozpoznawacza), ten sam runtime WASM |

Android offline: **tylko szacunek, nie test** — telefon zwykle 2–4× wolniej, czyli ~40–120 s dodatkowo na arkusz przy czytaniu wszystkich
pudełek. Czytanie tylko pudełek leżących na zamrożonej linii zmniejszyłoby to kilkukrotnie — niezmierzone. Partia S1–S4, S6–S9 szła
równolegle z czytnikami prawdy S5 (rywalizacja o CPU); S5 sam: 189,8 ms/crop.

## J. Bramki, zamrożenie, CI

(uzupełnione w commicie zamykającym — §P)

## K. Recenzje (2, LEAN; `artifacts/…/review/reviews-round1.json`)

Dwie skupione recenzje tylko‑do‑odczytu (źródło/metryki; prawda/przeciek). Zgłoszone **P0: 3, P1: 13**; wszystkie rozpatrzone w addendum C:

| zgłoszenie | rozstrzygnięcie |
| --- | --- |
| P0 prawda wiązania dzieliła linie na znacznikach `QUESTIONABLE`/`REJECTED`; na S5 trzy „prawdy” 19–24 % od skali, a dwa „błędy B0” były błędem prawdy | naprawione: tylko `TICK`; `b0BoundWrong` przeliczone (teraz 2 na MAIN, 0 na S5) |
| P0 prawda wiązania = reguła środka odcinka B2 (cyrkularność) | naprawione: prawda sprawdza wszystkie odcinki linii; B2 może się mylić (1 błąd) |
| P0 (metryki) odwrócenie B0 vs B2 po korekcie S5 | po obu poprawkach: MAIN B2 17/1, B0 13/2/4; S5 B0 5, B2 5 — przewaga B2 wynika z niepowiązanych B0, nie z błędów |
| P1 recall B0 zawyżony przez poziom A | raport per poziom; porównanie na `LOCAL_DOUBLE_READ`: 45 vs 46 |
| P1 „błędne” odczyty B0 to bliźniaki obrotu / fragment `6` | `ROTATIONAL_TWIN_AMBIGUOUS`, wartości 2–5 cyfr; B0 0 błędnych |
| P1 część utrat to zespół, nie wiązanie | nowa klasa `READ_RIGHT_ENSEMBLE_NOT_KEPT` (6) |
| P1 B2 nie scalał bliźniaków B0 | scalone (jeden kandydat na tusz) |
| P1 „fałszywe wykrycia” na nierozstrzygniętej prawdzie | `UNVERIFIED` (49); potwierdzone fałszywe: 6 |
| P1 orientacja bez reguły luki 0,1; R2 czyta tylko obrót R1; wiodące zera | reguła luki stosowana; wiodące zero → `NOT_A_DIMENSION:LEADING_ZERO`; ograniczenie R2 jawne (§M) |
| P1 rama próbkowania zależy od proponenta; inwentarz Murajów | etykiety bez prawdy = `NOT_MEASURED`; inwentarz z PRIMARY i SENSITIVITY osobno; wniosek NO_GAIN tylko dla zmierzonych |
| P1 R1_CONFIDENT zawyża też odkrywanie | żaden wniosek o odkrywaniu nie opiera się na SENSITIVITY; 13 % konfliktów podane |
| P1 S9 niesprawdzony | zapisane (§E) |
| P2 nieujawnione osłony dzielenia przez zero | ujawnione w addendum C; bez wpływu liczbowego |

Druga runda recenzji nie była uruchamiana (limit LEAN).

## L. Rekordy obserwacji

`observation-records.json` (7 rekordów, źródło: hash wariantu + id ramki + pudełko strony): poprawnie ugruntowana; ugruntowana i przepisana
(1385); niejednoznaczna orientacja (870/028); pominięta przez B0, znaleziona przez B1; pominięta przez obu (okno linii); przeczytana,
niepowiązana (S2); B1 w złym obrocie. Katalog utraconych etykiet: `missed-label-catalogue.json` (z kontrolą inwentarza Murajów).

## M. Ograniczenia (jawnie)

- **Prawda jest lokalna i częściowo wnioskowana.** Poziom A to transkrypcje 005O tego samego tuszu (wykonane wtedy przez
  transkrybentów‑modele; w tym etapie nie pokazano żadnego obrazu nikomu); poziom B to zgodność dwóch lokalnych czytników; poziom C jest
  skorelowany z kandydatami. Bez recenzji człowieka. R2 (Tesseract) czyta tylko obrót wybrany przez R1, więc orientacja w prawdzie
  pochodzi od czytnika z rodziny PaddleOCR.
- **Rama próbkowania** nadal zależy od proponenta albo od wyodrębnionej linii (okna linii są tylko na łańcuchach produkcji i pomijane,
  gdy na odcinku leży jakakolwiek propozycja). Etykiety na niewyodrębnionych liniach (Muraje `256`, `209`, `95`) są poza zasięgiem —
  NO_GAIN dotyczy etykiet zmierzonych.
- **Prawda wiązania** istnieje dla 19 etykiet MAIN (2 z nich podejrzane w audycie skali) i wcale na Murajach — wynik B2 jest kierunkowy.
- Wiązanie B0 to zapieczętowane `chains[].segments[].evidenceId` → token.
- Mała próba (7 rodzin), dominuje jeden wydawca (ARCHON); arkusz DobreDomy nie dał etykiet wymiarowych.
- Okna linii w przebiegu prawdy cięto jeszcze na wszystkich znacznikach (sprzed addendum C) — szersza, nie węższa rama; nie powtórzono.

## N. Rekomendacja (jedna)

**Nie wdrażać pełnostronicowego detektora PaddleOCR.** Odkrywanie tekstu nie jest wąskim gardłem (4/110 `NEVER_PROPOSED`), a koszt na
telefonie byłby istotny. Zamiast tego **osobny, wąsko zakreślony eksperyment integracyjny — do autoryzacji OWNER-a — na granicy
łańcuch/decyzja**, na istniejących kandydatach:
1. wartość wypowiedzi = potwierdzony odczyt tuszu, gdy taki istnieje; `CHAIN_CORRECTED` nigdy nie nadpisuje potwierdzonego odczytu
   i **nigdy nie jest kotwicą rejestracji** (dziś 49/67 kotwic; 5 przepisań wbrew poprawnemu tokenowi);
2. wiązanie potwierdzonych odczytów ślepą geometrią (B2) z jawnym `UNRESOLVED`, zamiast utraty 33 poprawnie przeczytanych etykiet
   (plus 6 odczytów, których zespół nie zatrzymał);
3. orientacja bliźniaków obrotu jako jawna niejednoznaczność, rozstrzygana tylko dowodem linii (nie max‑p);
4. z negatywnymi kontrolami (Muraje musi nadal odmawiać, dopóki niezależny łańcuch nie powstanie) i regresją na kontrolach.
Detektor może wrócić jako wąski proponent tylko dla odcinków bez etykiety — po tym eksperymencie, nie zamiast niego.
**005R (pilotaż wizualny) pozostaje zaplanowany i nierozpoczęty; ta rekomendacja go nie odkłada.**

## O. Lista NOT_RUN

- `NOT_RUN_HUMAN_SPOT_REVIEW` — brak recenzenta‑człowieka; lista do weryfikacji: `spot-review-request.json`.
- `NOT_RUN_SOLVER_REPLAY` — reguła stopu (§H).
- `NOT_RUN_ANDROID_DEVICE` — wykonalność mobilna tylko szacowana.
- Detektor `small` pobrany i przypięty (`d73e0058…`), **nieużyty** (bez eksplozji wariantów).
- Brak ślepej rundy, brak APK, brak 005R/005S.

## P. Polecenia, SHA, CI

(uzupełnione w commicie zamykającym)
