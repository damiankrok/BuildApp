# STAGE BUILDPLAN N7-FIX-04 — precyzja cofnięcia i uczciwy status kompletności

Baza `b870964` (FIX-03, solver 2.8.0, APK 1309), gałąź `claude/new-session-3kzcgh`, kod `49dae30`. Solver **2.9.0**. APK **1310**.

Czego nie robiono:

- Nie zmieniono globalnie rozdzielczości siatki (`minCellM` = 0,45 m).
- Nie wprowadzono reguły „każdy odrzucony wariant ⇒ PARTIAL”.
- Nie dodano AI, odczytu elewacji ani nowej geometrii.
- Brył nie skracano arbitralnie.

**Prywatnego benchmarku OWNER-a nie odtwarzałem i nie deklaruję jego naprawy.**

## Wynik w skrócie

| zadanie | stan |
|---|---|
| A — garaż cofnięty o 0,15–0,60 m | dom ma 10,20 m we wszystkich wariantach. Garaż ma 6,00 m (±0,03) i stoi na własnym licu. Brama jest w jego własnej ścianie frontowej. Brak nakładania. |
| A — przy okazji | przed FIX-04 przy cofnięciu 0,15 / 0,45 / 0,60 m **dom** był za krótki (10,05 / 10,17 / 10,15 m). Przy 0,45 i 0,60 m z bramą **garaż ginął**. Naprawione. |
| B — REJECTED + COMPLETE | przyczyna ustalona (§2). Wybrany układ z nierozwiązanym BLOCKING daje teraz PARTIAL z powodem, model zostaje w całości. |
| C — kompletność | cztery pytania są rozdzielone i wynik ma jeden werdykt: `COMPLETE` / `COMPLETE_WITH_OPEN_QUESTIONS` / `PARTIAL`. Doszła niezależna kontrola ścian rysunku. |
| osiem znanych domów | modele **8/8 bajt w bajt identyczne**. Werdykt: 1 × COMPLETE, 7 × COMPLETE_WITH_OPEN_QUESTIONS (§4). |

## 1. Zadanie A — cofnięcie

### Gdzie ginęła precyzja (przed, `b870964`)

Przypadki są wymyślone (`research/analyzer-n7-fix04/cases.ts`). HOLLOWAY to dom 8,40 × 10,20 m. Garaż ma 3,60 × 6,00 m, a jego front stoi `s` m za frontem domu. Łańcuch wymiarowy drukuje `s`. Każdy przypadek jest z bramą 2,4 m i bez niej.

| s | dom (przed) | garaż (przed) | przyczyna |
|---|---|---|---|
| 0 | 10,20 | 6,00 | — |
| 0,15 | **10,05** | 6,00 | drugi łańcuch nie ma odcinka 15 cm. Jego ostatnia kreska (10,05) leży w tolerancji linii lica domu, a drabina brała **pierwszą** kreskę w tolerancji i statystykę „więcej odcinków wygrywa”. |
| 0,30 | 10,20 | **6,30** | `thinLines` wciąga lico garażu w linię lica domu, więc bryła sięga linii |
| 0,40 | 10,20 | **6,40** | jw. |
| 0,45 z bramą | **10,17** | **zgubiony** | linia 9,75 m odcięta bez sondy, przez co naroże garażu nie było nigdzie czytane. Ostatni odcinek „45” został wyliczony z łańcucha jako 42. |
| 0,45 bez bramy | 10,17 | **6,42** | jw. |
| 0,60 z bramą | **10,15** | **zgubiony** | odcinek „60” wyliczony jako 55. Kieszeń bramy obejmowała pas gruntu przed bramą, który nie ma ścian bocznych. |
| 0,60 bez bramy | 10,15 | 5,95 (0,55..6,55) | ostatnia kreska drugiego łańcucha jest 1,5 px przed licem |

### Poprawki

- **Dwie współrzędne.** Komórki nadal klasyfikuje siatka po swojej linii. `GridLine.thinnedPx` przechowuje pozycje lic, które siatka wcieliła w linię, a geometria bryły korzysta z tych lic:
  - `wallIntervals` czyta mur przecinający linię także na tych licach. Naroże jest doliczane tylko przez **tusz**, nigdy przez czysty papier.
  - `recoverFaces` (layout) przesuwa bok bryły z linii siatki na lico, gdy pasma muru tej bryły leżą na licu, a na linii nie ma żadnego. Kandydatami są lica wcielone w linię i kreski łańcucha w odległości mniejszej niż komórka. Przesunięcie odbywa się **tylko do środka**: lico na zewnątrz linii to pytanie pasa muru 005Q, nie cofnięcia. Bok wspólny z inną bryłą nie jest przesuwany.
- **Drabina wymiarów** (`axisLadder`):
  - bierze **najbliższą** kreskę na każdym końcu;
  - jeden wydrukowany wymiar całkowity, który trafia kreskami w obie linie, ma pierwszeństwo przed sumą odcinków, która kończy się obok nich;
  - stwierdzenie trafiające w linię umieszcza ją przed stwierdzeniem kończącym się obok, ale tylko z linii już ustalonej.
- **Kieszeń bramy**: gdy zalewanie przeszło przez bramę do pasa gruntu przed nią, kieszeń jest przycinana do części obmurowanej z trzech stron.

### Po (garaż z bramą; bez bramy wynik jest identyczny)

| s | dom | front garażu (v2 z0) | głębokość garażu | brama |
|---|---|---|---|---|
| 0 | 10,20 | 0,00 | 6,00 | 2,36 @0,59 |
| 0,15 | 10,20 | 0,12 | 6,03 | 2,36 @0,59 |
| 0,30 | 10,20 | 0,32 | 5,98 | 2,36 @0,59 |
| 0,40 | 10,20 | 0,40 | 6,00 | 2,36 @0,59 |
| 0,45 | 10,20 | 0,44 | 6,01 | 2,36 @0,59 |
| 0,60 | 10,20 | 0,60 | 6,00 | 2,36 @0,59 |

Brama ma 2,36 zamiast 2,40 m, tak jak w FIX-03; to błąd odczytu otworu. Lico odzyskane ze ściany jest umieszczane interpolacją siatki, stąd błąd do 3 cm. Wszystkie warianty są COMPLETE, bez `WALLS_OVERLAP` i bez nakładania pierścieni przed emisją. Ściana frontowa garażu stoi na jego własnym licu.

## 2. Zadanie B — REJECTED + COMPLETE (`g-wide5`, `g-gate34`)

**Która hipoteza.** Był tylko jeden układ: wybrany. Resolver nie ważył alternatyw. `STRUCTURE_SILHOUETTE_DISAGREES` nie jest kodem odmowy (`LAYOUT_REFUSAL_CODES`: `FOOTPRINT_AREA_WRONG`, `MASS_OVERLAP`, `NO_MASS`, `NO_STOREY`). Bramka niesie go jako zdegradowaną korroborację, a nie odmowę (`plan-diagnostics.ts`). Późniejszej poprawnej hipotezy więc nie było.

**Dlaczego COMPLETE.** Wynik `preview.outcome` mówił wyłącznie, czy emiter zbudował wszystko, co wyemitował. Werdykt bramki układu do niego nie trafiał.

**Skąd 2,6 m.** Kontrola profilu (`structural-audit.ts compareProfiles`) próbkuje sylwetkę w 49 punktach z oknem ±(1,5 × nawis + 0,35 m). Wynik:

- W FIX-03 garaż był o **0,05 m za szeroki** (14,45 zamiast 14,40; przesunięcie boku pasma). Przesuwało to siatkę próbek.
- Jedna próbka wypadała 0,03 m za uskokiem dom/garaż (u = 8,43). Model ma tam garaż (2,70 m), a rysunek pokazuje okap dachu domu nad garażem (5,76 m). Okap sięga ok. 0,9 m za ścianę, dalej niż okno próbki.
- Wynik: jedna próbka, 2,60 m (front) i 2,62 m (tył). Wszystkie pozostałe próbki mieszczą się w 0,05 m.

**Po FIX-04.** Drabina daje garażowi wydrukowane 6,00 m (14,40). `g-wide5` i `g-gate34` mają bramkę `ACCEPTED` i są COMPLETE. Tę samą sytuację odtwarza celowo `g-wide5-605`, garaż narysowany 6,05 m: nadal `REJECTED`.

**Czy to naprawić w kontroli?** Sprawdziłem. Ta sama jedna próbka przy uskoku jest jedynym, czym kontrola łapie mutację §26/12 (łańcuch mówi 13 m, rysunek 12 m). Każde poszerzenie okna o nieznany okap ukrywało tę mutację, przy dopuszczeniu 0,6 m i przy 2 × nawis. Kontrola nie odróżnia okapu nad niższą bryłą od uskoku przesuniętego o 0,65 m. Nie zmieniałem jej.

**Reguła.** Gdy **wybrany** układ ma nierozwiązany powód BLOCKING, podgląd jest `PARTIAL_3D_PREVIEW`:

- błąd ma kod `LAYOUT_BLOCKING_UNRESOLVED` i podaje powód;
- telefon pokazuje go w sekcji „Układ konstrukcyjny z nierozstrzygniętym błędem blokującym”;
- model zostaje w całości: nic nie jest pomijane, `missing = []`.

Kody odmowy dalej zatrzymują bieg jak dotąd. Odrzucony wariant resolvera nie ma wpływu na wynik.

**Skutek uboczny, raportowany.** Sześć syntetycznych fikstur z FIX-01/P2R (cienka bryła przy domu, pod jego okapem) miało ten sam BLOCKING przy COMPLETE. Teraz są PARTIAL z tym powodem. Każdy obiekt jest nadal zbudowany: testy sprawdzają `missing = []` i wyłącznie `LAYOUT_BLOCKING_UNRESOLVED`. Modele się nie zmieniły. W ośmiu znanych domach żaden układ nie ma BLOCKING.

## 3. Zadanie C — uczciwa kompletność

`bodyCompleteness` z FIX-03 mierzy pokrycie **regionów BUILT przyjętej dekompozycji**. Jeżeli dekompozycja czegoś nie zamknęła, `coverage = 1,0` tego nie zobaczy. Teraz:

- **Niezależna kontrola ścian.** Każde pasmo muru rzutu o długości ≥ 1 m w obrysie wymiarowanym jest porównywane z bryłami modelu (± 0,6 m na własny mur) i obszarami nazwanymi. Odcinek ≥ 1 m, którego nic nie tłumaczy, to `unexplainedWalls`. Kontrola zaczyna od pasm rysunku, nie od dekompozycji.
- **`modelCompleteness`** rozdziela cztery rzeczy:
  - `decomposition`: pokrycie, z jawnym `basis: ACCEPTED_DECOMPOSITION`;
  - `unresolvedAreas` i `unexplainedWalls`;
  - `conflicts`: BLOCKING i DEGRADING wybranego układu;
  - `modelRefusals`.
- Werdykt:
  - `PARTIAL`: brakująca bryła, obiekt odrzucony przez model albo nierozwiązany BLOCKING;
  - `COMPLETE_WITH_OPEN_QUESTIONS`: zbudowany cały, ale z obszarami nierozstrzygniętymi, ścianami bez wyjaśnienia albo rozbieżnościami;
  - `COMPLETE`: żadnej z tych rzeczy.
- Werdykt jest w wyniku (`modelCompleteness`) i w `preview.completeness`. Telefon pokazuje sekcję „Kompletność modelu” z dopiskiem, że pokrycie liczone jest tylko względem regionów uznanych przez analizator.

## 4. Regresja ośmiu domów

Szczegóły: `stage-reports/artifacts/analyzer-n7-fix04/regression-8-houses.json`.

| dom | model | werdykt | dlaczego |
|---|---|---|---|
| a01, gozd | = | COMPLETE_WITH_OPEN_QUESTIONS | `STOREY_COVERAGE_DISAGREES` (degrading) |
| marcowki | = | COMPLETE_WITH_OPEN_QUESTIONS | `STOREY_COVERAGE_DISAGREES`, oraz **ściana bez wyjaśnienia 9,45 m** (pasmo 0,64 m na wschodnim licu garażu, px 485–514 × 469–826). Na rzucie wschodni mur garażu biegnie dalej, 1,0 m przed jego front (wymiar „100”), jako ścianka przy zadaszeniu przed bramą. Model jej nie ma. To prawdziwa luka, dotąd niewidoczna. |
| ciesz | = | COMPLETE_WITH_OPEN_QUESTIONS | `ROOF_EVIDENCE_DISAGREES` |
| rary | = | COMPLETE | — |
| trytomach, sasankach3 | = | COMPLETE_WITH_OPEN_QUESTIONS | `STOREY_COVERAGE_DISAGREES`, `ROOF_EVIDENCE_DISAGREES` |
| arganiach | = | COMPLETE_WITH_OPEN_QUESTIONS | `NO_MASS_REACHES_UP`, `ROOF_EVIDENCE_DISAGREES` |

Modele 8/8 są bajt w bajt identyczne z FIX-03. Wynik biegu (`COMPLETED`) się nie zmienił. Zmienił się tylko werdykt kompletności: rozbieżności, które dotąd siedziały cicho w bramce, są teraz nazwane.

Pośredni wariant drabiny (stwierdzenia trafiające w linię zawsze przed dłuższymi) przesuwał w Rarytasach złącze dom/garaż o 0,086 m. Ustawiał bowiem linie z krótkich stwierdzeń, zanim długie zakotwiczyły je w wymiarze całkowitym. Odrzuciłem go przed commitem. Podobnie wariant z `extraPx` w drabinie zmieniał 9 zamrożonych odczytów 005Q.

## 5. Testy

| test | wynik |
|---|---|
| `analysis-service/test/setback-n7-fix04.test.ts`: cofnięcia 0 / 0,15 / 0,30 / 0,40 / 0,45 / 0,60 m (dom, garaż, front garażu, brama w jego ścianie, brak nakładania, replay), BLOCKING → PARTIAL z modelem w całości, COMPLETE z jawną podstawą | **8/8** |
| `reconstruction/test/model-completeness-n7-fix04.test.ts`: ściana bez wyjaśnienia przy pokryciu 100 %, własne mury bryły, ściana krótsza niż 1 m, ściana poza obrysem wymiarowanym, werdykty | **6/6** |
| `packages/reconstruction` (cały) | **1091/1091** |
| `packages/analysis-service` (cały) | **142/142**. Zmienione oczekiwania: FIX-01 (4) i P2R (2): `builtWhole` zamiast `COMPLETE` (§2). FIX-03 garaż cofnięty: głębokość 6,00 ± 0,05 (było 5,9–6,4), pokrycie ≥ 0,98 (region siatki obejmuje 0,30 m gruntu przed garażem). |
| `tsc` (root, web) | czyste |
| `tests/architecture` | 351/357. 6 czerwonych jak na bazie: wall-strip ×2 (baza 005Q poza klonem), 005M rozmiar pliku, zapisy IU ×3. |
| Android JVM (`LocalAnalysisTest`, `AnalysisTrackerTest`, `RunProvenanceTest`) | zielone |

Pliki przed/po są w `stage-reports/artifacts/analyzer-n7-fix04/`:

- `setback-gate-cases-*`;
- `setback-models-*`: ściany i otwory garażu;
- `fix03-cases-after.txt`: przypadki FIX-03 bez regresji, `gb-setback` ma teraz 6,00 m.

## 6. Ograniczenia

- Kontrola sylwetki przy uskoku dom/garaż zależy od tego, gdzie wypadnie próbka (§2). Nie odróżnia okapu nad niższą bryłą od uskoku przesuniętego o ~0,65 m. Status jest teraz uczciwy (PARTIAL z powodem), ale kontrola sama w sobie nie jest naprawiona.
- Lico odzyskane ze ściany jest umieszczane interpolacją siatki: błąd do 3 cm (front 0,12 zamiast 0,15 przy s = 0,15).
- Ścianka 1,0 m przed garażem Marcówek jest nazwana, ale niezbudowana.
- Urządzenia ani emulatora nie było w sesji. Nowej sekcji telefonu nie oglądałem.

## 7. APK 1310

| pole | wartość |
|---|---|
| plik | `BuildPlan-owner-preview-1310.apk` (= `BuildPlan-Model-Preview-arm64-v8a-debug.apk`), 39 827 610 B |
| SHA-256 | `32107c57446d472bcc8c7d54244df9d60ce397fb5fc5c8fb3ce067cc5fc6052e` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1310** / `0.1310.0-owner` |
| commit | `49dae3042d14fd5ff61e948062d9ce99f7b523cc` |
| podpis | ten sam klucz podglądu, cert `6e48fac4…a0da`; `verify-preview-signature.sh`: ok dla wszystkich 4 APK |
| analizator w APK | `analyzer.mjs` SHA-256 `996ce6f76e3b865b8273b07bb3c31f9038c25cba740a227141b13ca21ab0a7e5` (= `manifest.json`, 2 811 101 B), `SOLVER_V2_VERSION = "2.9.0"` |
| uprawnienia | tylko `INTERNET` (+ wewnętrzne uprawnienie odbiornika AndroidX) |

**Publikacja.** Sesja nie może tworzyć wydań GitHub: w FIX-02 próba zwróciła 403, a w sesji nie ma narzędzia do wydań. APK jest przekazany bezpośrednio jako plik.
