# BUILDPLAN-ANALYZER-005Y-N7-P2R — dobudowana bryła odczytana na źródle, zanim zostanie porzucona

**Werdykt: OWNER_TEST_PENDING.** Za wąska dobudowana bryła nie kończy się już automatycznie na `WALLS_OVERLAP`.
Przed odczytem jej ścian analizator sprawdza ją na trzech źródłach:

- tuszu rzutu w poprzek bryły;
- łańcuchach wymiarowych kończących się na jej licach;
- zarejestrowanych elewacjach.

Na tej podstawie wybiera jedną z siedmiu interpretacji. Bryła zmienia się tylko wtedy, gdy:

- źródło wskazuje dokładnie jedną budowalną interpretację;
- nic wydrukowanego jej nie przeczy;
- żadna elewacja nie pokazuje w tym miejscu pustki.

W każdym innym przypadku zostaje częściowy podgląd z P1, a wszystkie hipotezy trafiają do diagnostyki.

Prywatnego benchmarku OWNER-a nie odtwarzałem i nie deklaruję jego naprawy — to może sprawdzić tylko OWNER na APK 1306.
Tożsamości domu nie ustalałem. P3 nie zaczęte.

Baza: `f6dd10b` (P2). Kod P2R: `eb2c7ec`. Gałąź `claude/new-session-3kzcgh`. Pełnego CI nie uruchamiałem.

## SOURCE → FIRST_BAD

Ścieżka: `SourcePackage → rzut bazowy → skala/OCR → structural-layout (bryły) → MassV2 → emitBuilding → createWallRing → WALLS_OVERLAP`.

Polecenie 21 to miejsce odmowy, a nie miejsce błędu. Pierścień buduje cztery ściany o grubości T domu wewnątrz
prostokąta bryły. Bryła węższa niż 2T ma `w1` i `w3` (albo `w0` i `w2`) w jednym pasie rzutu. Model zgłasza wtedy
nakładanie równe dokładnie `(2T − szerokość) × (długość − 2T)`. Rekord `predictedOverlapM2` liczy to przed emisją.
Na Slivertonie wynik zgadza się z modelem co do 0,001 m² (0,1994 m², test).

Z kodu wynikają dwa niezależne źródła takiej bryły:

1. **PLAN_DECOMPOSITION.** Komórki planu kończą się przed ścianą, którą rzut naprawdę rysuje dalej. Szerokość bryły
   ma wtedy status `SCALED` („no chain measures this span”), a lico dalekie nie leży na żadnej ścianie.
2. **EMISSION.** Szerokość jest poprawna, ale pierścień dobudowanej bryły zawsze buduje własną ścianę od strony bryły
   głównej. Tymczasem rzut rysuje tam jedną ścianę wspólną: rysownik zaczyna skrzydło od ściany domu. Przy normalnym
   garażu daje to podwójną ścianę na styku; przy wąskiej bryle — kolizję.

Każda bryła węższa niż 2T dostaje rekord (`ReconstructionV2Result.thinBodies`) zawierający:

- prostokąt w metrach i pikselach;
- długość i szerokość;
- grubość T;
- przewidywane nakładanie;
- id rzutu;
- opis bryły z layoutu (`why`, `widthBasis`, `evidenceIds`);
- ścianę wspólną;
- profil tuszu (pasma w metrach od lica wspólnego na zewnątrz);
- każdy łańcuch wymiarowy wraz z rolą;
- każdą elewację wraz z udziałem zabudowy;
- siedem hipotez z uzasadnieniami;
- `firstBad`;
- decyzję w postaci prostokąta przed i po.

## ALTERNATYWY

Hipotezy są oceniane wyłącznie na rysunku (`packages/reconstruction/src/v2/thin-body.ts`), nigdy po nazwie projektu.

| interpretacja | warunek na źródle | co budujemy |
|---|---|---|
| `WIDEN` — prawdziwa bryła odczytana za wąsko | brak ściany na odczytanym licu dalekim, za nim papier aż do ściany narysowanej dalej, oraz łańcuch drukowany od lica wspólnego do tej ściany **albo** elewacja pokazująca zabudowę; bryła nie może wejść w inną | bryłę poszerzoną do narysowanej ściany (wartość z łańcucha, jeśli jest) |
| `SHARED_WALL` — jedna ściana między bryłami | pasmo przy licu wspólnym ma grubość jednej ściany (ściana domu), dalej papier, potem ściana daleka bryły | trzy własne ściany (`createWall` z narożnikami CORNER w kolejności i własności pierścienia), bez pierścienia i bez ściany od strony wspólnej |
| `DRAWN_THIN_WALLS` — ściany rysowane cieniej | po stronie wspólnej narysowana własna ściana, oba lica cieńsze niż 0,85 T, wnętrze między nimi | pierścień o grubości odczytanej z rysunku (nie arbitralnej) |
| `SOLID_WALL` — pogrubienie ściany | tusz na ≥ 85 % szerokości pasa | jedną ścianę o szerokości pasa |
| `CANOPY_ON_POSTS` | lico dalekie narysowane przerywanie, nic dalej | nic — nazwane, zostaje P1 |
| `FALSE_STRIP` — fałszywy pas z segmentacji | na licu dalekim i za nim nic nie narysowano | nic — nazwane, bryła **nie jest usuwana**, zostaje P1 |
| `RECESS_OF_MAIN` — wnęka/fragment bryły głównej | pas leży w bryle głównej | nic — nazwane |

Łańcuchy wymiarowe dzielą się na cztery role:

| rola | kiedy |
|---|---|
| `CORROBORATES` | oba końce leżą na licach pasa, a wartość jest zgodna |
| `WIDENS` | łańcuch biegnie od lica wspólnego do ściany narysowanej dalej |
| `UNRELATED` | drugi koniec łańcucha leży na licu innej bryły, więc mierzy więcej niż ta bryła |
| `CONFLICTS` | jeden koniec leży na licu pasa, a drugi na żadnej narysowanej ścianie, przy wartości innej niż odczytana |

Konflikt zawsze kończy się `KEEP_PARTIAL` z `firstBad: SOURCE_CONFLICT`. Wydrukowany wymiar ma pierwszeństwo przed
pikselem, ale wymiar, który nie trafia w żadną narysowaną ścianę, nie jest wiarygodnym wymiarem tej bryły.

Elewacje są użyte także dla niezbudowanej bryły. Ich rejestracja nie zależy od walidatora modelu: wykonuje się przed
adjudykacją, na zakotwiczeniach z P2. Dla każdego widoku, który widzi pas z boku, liczony jest udział „nie-nieba” w
paśmie kondygnacji nad pasem lub nad częścią poszerzaną. Wynik:

- ≥ 0,6 — `CORROBORATES`;
- ≤ 0,2 — `CONTRADICTS`, co blokuje każdą interpretację;
- pomiędzy — `NOT_DECISIVE`.

Ograniczenie: drzewo tła też jest „nie-niebem”, więc potwierdzenie z elewacji jest słabe. Rozstrzyga rzut z wymiarem.

## DECYZJA I GEOMETRIA PRZED/PO

### Rzeczywisty program z korpusu: Marcówki

`research/analyzer-005y-n7-p2r/corpus-demo.ts` przeprowadza dom przez cały proces na zapieczętowanych dowodach N7.
Błędny odczyt wstrzykuję w miejscu, w którym tworzy go segmentacja: garaż `attached-0` zostaje zwężony do 0,45 m od
ściany wspólnej. Służy do tego opcja diagnostyczna `diagnostics.narrowMass`, wyłącznie dla badań; produkcja jej nie
ustawia.

Żaden z 8 domów korpusu nie ma dziś za wąskiej bryły, a dom OWNER-a jest prywatny. Ten przebieg jest więc mutacją
prawdziwego programu, a nie odtworzeniem domu OWNER-a.

| przebieg | bryła `attached-0` (x) | wynik | model |
|---|---|---|---|
| A — jak odczytany | 7,90–12,05 | `COMPLETE`; 3 pierścienie, 40 ścian, 21 otworów | `8541ca10…` |
| B — błędny odczyt, bez P2R | 7,90–8,35 | `PARTIAL_3D_PREVIEW`: polecenie 21 `createWallRing ring-attached-0-0`, `WALLS_OVERLAP` w1/w3 3,1978 m²; 2 pierścienie, 34 ściany, 19 otworów | `55d3fea7…` |
| C — ten sam błędny odczyt, z P2R | **7,90–12,05** | `COMPLETE`; 3 pierścienie, 40 ścian, 21 otworów | **`8541ca10…`** (bajt w bajt = A) |

Dowody decyzji w przebiegu C (`stage-reports/artifacts/analyzer-005y-n7-p2r/marcowki-demo-thin-body.json`):

- **Profil tuszu:**
  - ściana domu w paśmie −0,46…−0,04 m;
  - papier od lica wspólnego aż do ściany w paśmie 3,69…4,14 m;
  - na odczytanym licu dalekim (0,45 m) nie ma tuszu (0,3 %).
- **Łańcuchy:**
  - `790 cm` — `UNRELATED`, bo mierzy dom;
  - `415 cm` — `WIDENS`, biegnie od lica wspólnego do ściany narysowanej 4,15 m dalej.
- **Elewacje:** przednia i tylna — `CORROBORATES` nad 8,35–12,05.
- **Hipotezy:** WIDEN `SUPPORTED`, pozostałe `REFUTED`.
- **FIRST_BAD:** `PLAN_DECOMPOSITION: the body's width was read as 0.45 m (measured), stopping at a face the plan draws no wall on`.

Obraz rzutu z zaznaczeniem bryły (zielona — jak odczytana, czerwona — błędny pas, niebieska — po odzyskaniu) zawiera
raster wydawcy. Leży więc **poza repozytorium** i został przekazany OWNER-owi. W repozytorium są tylko rendery modelu
3D przed/po: `marcowki-before-after-*.png` w `stage-reports/artifacts/analyzer-005y-n7-p2r/`.

### Fiksury syntetyczne (wymyślone wymiary)

| fiksura | rysunek | interpretacja | wynik |
|---|---|---|---|
| `SLIVERTON_DIMENSIONED` | pas 0,45 m: ściana domu, 0,13 m papieru, ściana daleka 0,30 m; wymiar ogólny zgodny | `SHARED_WALL` | `COMPLETE`; bryła z trzema ścianami `ring-attached-0-0-w0/w1/w2`, bez pierścienia; model przechodzi walidację, kompilację, odtworzenie i paczkę sceny |
| `THINWALL` | pas 0,50 m, ściany 0,15 m, własna ściana przy domu | `DRAWN_THIN_WALLS` | `COMPLETE`; pierścień ze ścianami 0,158 m (odczytanymi) |
| `SLIVERTON` (z P1) | ten sam pas, ale łańcuch drukuje 360 i 1200 cm, a jego drugi koniec nie leży na żadnej ścianie | `SHARED_WALL` na rysunku + `CONFLICTS` w wymiarze | **`PARTIAL_3D_PREVIEW` jak w P1** (polecenie 21, ta sama scena `4ad30210…`); diagnostyka nazywa konflikt |

Rendery: `fixtures-*.png`.

## Wiarygodność P2 (punkt 4)

- Każde porównanie ma teraz `status`: `CONFIRMED_MATCH`, `NOT_OBSERVED`, `CONFLICT` albo `VIEW_NOT_REGISTERED`.
  Otwór nieodczytany jest `NOT_OBSERVED`, nigdy dopasowaniem. Dawny licznik `MATCHED` liczył pary niezależnie od
  zgodności, więc przemianowałem go na `PAIRED`.
- **`WRONG_STOREY` nie miał implementacji.** Odczyt jest parowany tylko z otworem swojej kondygnacji, więc kod nie
  mógł się pojawić. Usunąłem go z kodów, zamiast raportować zero jako wynik zweryfikowany.
- Nowe pole `openingCounts` liczy otwory w czterech miejscach:
  - na rzutach (elewacyjne i przejścia między bryłami);
  - wykrytych niezależnie skanem elewacji;
  - w modelu (łącznie z drzwiami wewnętrznymi);
  - pominiętych przez fallback.

| dom | CONFIRMED_MATCH | NOT_OBSERVED | CONFLICT | VIEW_NOT_REGISTERED | otwory: rzut / elewacje / model / pominięte |
|---|---|---|---|---|---|
| A01 | 7 | 2 | 4 | 0 | 13 / 7 / 21 / 0 |
| Goździkowce | 0 | 0 | 0 | 14 | 14 / 0 / 29 / 0 |
| Marcówki | 1 | 4 | 6 | 0 | 12 / 2 / 21 / 0 |
| Cieszynianki | 0 | 1 | 6 | 4 | 11 / 3 / 20 / 0 |
| Rarytasy | 0 | 7 | 5 | 0 | 13 / 9 / 20 / 0 |
| Trytomy | 1 | 4 | 1 | 7 | 13 / 3 / 18 / 0 |
| Arganie | 1 | 2 | 3 | 4 | 11 / 3 / 16 / 0 |
| Sasanki | 1 | 6 | 3 | 3 | 13 / 2 / 20 / 0 |

Wniosek wprost: niezależnie potwierdzonych otworów jest mało (11 na 8 domów). Większość otworów jest
`NOT_OBSERVED` albo `CONFLICT`. P2 jest dziś raportem rozbieżności, a nie potwierdzeniem zgodności.

## TEST

| zakres | wynik |
|---|---|
| `thin-body-n7-p2r.test.ts` (reconstruction, 12) | zielone — każda interpretacja na własnym rysunku; WIDEN z łańcuchem i z elewacją; bez dowodu → P1; elewacja przecząca → P1; konflikt wymiaru → P1; fałszywy pas i słupy nazwane, nie budowane |
| `thin-body-n7-p2r.test.ts` (analysis-service, 3, end to end do `MobileSceneBundle`) | zielone |
| `partial-preview-n7-p1.test.ts` | zielone (P1 bez zmian) |
| `facade-alignment-n7-p2.test.ts` (14) | zielone, w tym kategorie wiarygodności |
| reconstruction, analysis-service, synthetic-drawings, local-analyzer, analyzer-api, tests/architecture | 1597 zielonych, 5 czerwonych — wszystkie także na bazie bez P2R (sprawdzone stashem) |
| Android `LocalAnalysisTest` (JVM, LOCAL) | 25/25 |
| powtórka 8 domów korpusu | **8/8 modeli bajt w bajt** (`a6849073`, `852c257a`, `8541ca10`, `5394c17c`, `73969751`, `d2bf0c03`, `34a95a76`, `090749f4`); garaż Marcówek bez zmian |

Pięć zastanych czerwonych:

- `wall-strip` ×2 — wymagają bazy 005Q w klonie;
- `research-isolation` — rozmiar śledzonego pliku;
- `program.test.ts` Larchfield — scena nagrana w 03Y1;
- `android-contract` — fiksury kontraktu Larchfield nieaktualne już na bazie.

## APK 1306

| | |
|---|---|
| plik | `BuildPlan-Model-Preview-arm64-v8a-debug.apk`, 39 725 102 B |
| SHA-256 | `b6f8f3466625f9aa8d0fed7d081885839d20705ddc5d757559f096c71b214c2c` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1306** / `0.1306.0-owner` |
| podpis | dotychczasowy klucz podglądu, cert `6e48fac4…`; `verify-preview-signature.sh`: ok |
| analizator w APK | `assets/local-analyzer/analyzer.mjs` SHA-256 **`b67d77fafafb2e91e32c2625edbc9cea3323cc499b4f9fd84f961b2fac20a3d1`** (= `manifest.json`), solver 2.5.0; kod identyczny z bundlem zbudowanym z HEAD (różnią się tylko ścieżki esbuild) |
| `PARTIAL_3D_PREVIEW` z APK | bundel wyjęty z APK na Slivertonie: polecenie 21, `WALLS_OVERLAP`, scena `4ad30210…`, model `988e55bd…` — to samo co 1304/1305, plus nierozstrzygnięta bryła nazwana w `unresolved` |
| live z APK | bundel z APK na żywej stronie Marcówek: model `8541ca10…`, `COMPLETE` |

APK instaluje się na 1305: ten sam podpis i wyższy versionCode.

Urządzenia w sesji nie było. Do sprawdzenia przez OWNER-a: ten sam import co w benchmarku. Możliwe wyniki:

- model pełny — źródło rozstrzygnęło;
- model częściowy z bryłą nazwaną w nierozstrzygniętych wraz z powodem (konflikt wymiaru, brak dowodu albo elewacja
  przecząca) — źródło nie rozstrzygnęło.

## Czego P2R nie robi

- Nie zmniejsza grubości ścian poza `DRAWN_THIN_WALLS`, gdzie grubość pochodzi z odczytu rysunku.
- Nie wyłącza `WALLS_OVERLAP`.
- Nie usuwa bryły (`FALSE_STRIP`) i nie zamienia jej w zadaszenie (`CANOPY_ON_POSTS`). Te hipotezy są tylko nazywane.
- Nie poszerza bryły na podstawie samego rzutu, bez wymiaru ani elewacji.
- Działa wyłącznie na bryłach węższych niż 2T. Normalne bryły i ich podwójna ściana na styku są bez zmian, więc nie
  ma regresji na korpusie.
