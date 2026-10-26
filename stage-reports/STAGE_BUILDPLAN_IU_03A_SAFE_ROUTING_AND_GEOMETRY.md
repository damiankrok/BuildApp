# STAGE BUILDPLAN IU-03A — SAFE IMAGE ROUTING + ARCHITECTURAL GEOMETRY PRESERVATION (badanie)

**Klasa: RESEARCH.** Produkcyjny `SourcePackage`, solver, rekonstrukcja i Android — bez zmian. Bez APK, bez pełnego CI
(tylko testy celowane). Baza `cf7ac80` (IU-02). Kod: `research/image-understanding/iu3/`. Liczby:
`stage-reports/artifacts/iu-03a/`. Rejestracja wstępna: `stage-reports/artifacts/iu-03a/preregistration.md`, zamrożona
commitem `f468d04` **przed** powstaniem zbioru testowego. Etykiety testowe ARCHON: `8338c8f`, przed uruchomieniem
jakiegokolwiek modelu na tych obrazach. 890 obrazów oceny końcowej IU-02 służyło tu wyłącznie jako dane
rozwojowe i nie są przedstawiane jako nowy ślepy zbiór.

**Werdykt: `RESEARCH_PARTIAL`.** VETO_ONLY jest pierwszym routerem, który zachowuje trasę produkcyjną i zatrzymuje
prawie wszystkie błędnie podpisane obrazy, ale na niezależnym teście **przepuścił 2 perspektywy niemal frontalne**
(1 syntetyczną w zbiorze testowym i 1 w negatywach). Wymóg „0 nie-elewacji” nie jest więc spełniony. Jawne kotwice
geometryczne nie poprawiły odczytu ekstraktora na domach testowych.

## Odpowiedź dla OWNER-a w pięciu zdaniach

1. Na 6 nowych domach ARCHON przepuszczonych przez produkcyjny pipeline podpisy wydawcy były poprawne dla wszystkich
   124 zasobów: LEGACY i VETO_ONLY kierują do ekstraktora 24/24 elewacje i 0 nie-elewacji. STRICT_IU02 tylko 6/24.
2. Gdy podpis jest celowo błędny (każdy obraz nazwany „elewacją”), LEGACY wpuszcza do ekstraktora wszystkie 227
   nie-elewacje testowe. VETO_ONLY zatrzymuje 226 z 227 i zachowuje 84/114 elewacje (74 %, CI 65–81 %).
3. Jedyna przepuszczona nie-elewacja i jedna z negatywów to perspektywy niemal frontalne. Test rzutu bez maski
   budynku dał w nich wynik „nierozstrzygnięty”, a w masce wykazałby perspektywę. Ten tańszy wariant wybrałem na danych
   rozwojowych i okazał się błędny.
4. Czysta fasada psuje ekstraktor z konkretnych powodów. Białe tło ma dla niego chromę < 40, więc „pas ściany”
   przebiega przez tło. Linia gruntu znika. Szkło jest jaśniejsze od ściany, a detektor otworów szuka szkła ciemnego.
   Ekstraktor oczekuje faktów zakodowanych w pikselach, a nie jawnych obserwacji.
5. Jawna sylwetka podana solverowi (adapter badawczy) poprawiła DEV (40 vs 31 poprawnych odczytów, 17 vs 15 widoków,
   0 fałszywych), ale na domach testowych nie (12 vs 15 poprawnych, 2 fałszywe). Obrys obejmował kominy, a solver
   bierze szczyt sylwetki za kalenicę. Rejestracja wymaga więc obserwacji z nazwą (kalenica ≠ komin), nie samego obrysu.

## A. Router oparty na pewnych sprzecznościach

### Reguły (zamrożone, `iu3/route.py`)

| strategia | definicja |
| --- | --- |
| LEGACY | produkcyjne `archonRoleClaims → mergeRoleClaims → normalizeRoles → readsAsFacade`, bez pikseli (`iu3/legacy_roles.ts`); na domach testowych role z prawdziwego `SourcePackage` |
| STRICT_IU02 | bramka IU-02 bez zmian: klasyfikator = ELEWACJA z p ≥ 0,60 **i** test rzutu w masce = ORTHOGRAPHIC_SUPPORTED; podpis ignorowany |
| VETO_ONLY | zachowuje trasę LEGACY, chyba że: (a) test rzutu bez maski = PERSPECTIVE_EVIDENT → STOP przed ekstraktorem ortogonalnym; (b) NOT_SINGLE_FACADE → REVIEW; (c) P(nie-elewacja) ≥ 0,60 → REVIEW z nazwą najbardziej prawdopodobnej klasy (wnętrze, arkusz/inne, przekrój, perspektywa, rzut, sytuacja) |

- INCONCLUSIVE nigdy nie odmawia. Jest tylko diagnostyką `INCONCLUSIVE_NO_ACTION`.
- Zgodność klasyfikatora z podpisem nie jest ACCEPT: trasa po prostu zostaje, jaka była.
- VETO_ONLY **nigdy nie dodaje** trasy do ekstraktora. Niezgodność, na którą nie działa, raportuje (`DISAGREES_NOT_ACTED`,
  `WEAK_DISAGREEMENT`), a brak danych zgłasza jako `EVIDENCE_MISSING`.
- Role (kondygnacja, strona elewacji) przechodzą bez zmian. Pilnuje tego asercja `d.roles is roles` w `evaluate.py` oraz test.
- Próg 0,60 wybrany na danych rozwojowych regułą z rejestracji: największy t, przy którym żadna nie-elewacja ze
  scenariusza ADVERSE dev nie trafia do ekstraktora.
- Wariant „jedna pewna klasa” (rodzina A) odrzuciłem na dev: przy 2 % straty elewacji przepuszczał 95 nie-elewacji.

### Wyniki — dane rozwojowe (890 obrazów IU-02, etykiety agenta)

| scenariusz | strategia | elewacje zachowane | nie-elewacje do ekstraktora |
| --- | --- | --- | --- |
| REAL (268 zasobów ARCHON w pakietach) | LEGACY | 96/96 | 0 |
| | STRICT_IU02 | 29/96 | 0 |
| | VETO_ONLY | 93/96 (3 × STOP_PERSPECTIVE) | 0 |
| ADVERSE (890, każdy podpisany „elewacja-frontowa”) | LEGACY | 216/216 | **674** |
| | STRICT_IU02 | 107/216 (49,5 %) | 0 |
| | VETO_ONLY | 173/216 (80,1 %) | 0 |

### Wyniki — niezależny test (po zamrożeniu)

TEST_ARCHON to 6 nowych rodzin z puli (124 zasoby `SourcePackage`). TEST_SYNTH to 30 nowych domów (217 obrazów).

| scenariusz | strategia | elewacje zachowane (Wilson 95 %) | nie-elewacje do ekstraktora (Wilson 95 %) |
| --- | --- | --- | --- |
| REAL — TEST_ARCHON | LEGACY | 24/24 (86–100 %) | 0/100 (0–3,7 %) |
| | STRICT_IU02 | 6/24 (12–45 %) | 0/100 |
| | **VETO_ONLY** | **24/24** (86–100 %) | **0/100** |
| ADVERSE — TEST_ARCHON + TEST_SYNTH | LEGACY | 114/114 | **227/227** |
| | STRICT_IU02 | 64/114 = 56 % (47–65 %) | 0/227 (0–1,7 %) |
| | **VETO_ONLY** | **84/114 = 74 %** (65–81 %) | **1/227** (0,1–2,5 %) — perspektywa niemal frontalna |

W rozbiciu:
- ARCHON ADVERSE: VETO_ONLY 24/24 elewacje, 0/100 nie-elewacji; STRICT 6/24.
- SYNTH ADVERSE: VETO_ONLY 60/90 elewacji, 1 przepuszczona nie-elewacja (`NEAR_FRONTAL`); STRICT 58/90, 0.
- Stracone elewacje syntetyczne VETO_ONLY oddaje do REVIEW (26 jako „arkusz/inne”, 3 jako wnętrze, 1 jako sytuacja), a
  nie odrzuca w ciszy.
- Odsetek prawidłowych elewacji zachowanych przez VETO_ONLY: 100 % przy prawdziwych podpisach, 74 % przy błędnych.
- Odsetek błędnych obrazów przepuszczonych jako elewacje: 0 % przy prawdziwych podpisach, 0,44 % (1/227) przy błędnych.

### Podpis celowo błędny + perspektywa niemal frontalna

| przypadek | LEGACY | STRICT_IU02 | VETO_ONLY |
| --- | --- | --- | --- |
| dev N7-0/N7-1 (synt.) | FACADE | UNKNOWN | STOP_PERSPECTIVE ×2 |
| test N7-0 (płaski) | FACADE | UNKNOWN | STOP_PERSPECTIVE |
| **test N7-1 (render z drzewami)** | FACADE | UNKNOWN | **FACADE** — rzut bez maski INCONCLUSIVE, w masce PERSPECTIVE_EVIDENT, p(elewacja) = 0,50 |
| 2 perspektywy niemal frontalne TEST_ARCHON (`hard`) | FACADE | nie | STOP_PERSPECTIVE (punkt zbiegu) |
| TEST_SYNTH NEAR_FRONTAL (30) | 30 × FACADE | 0 | 1 × FACADE |

## B. Zachowanie geometrii podczas uproszczenia

### Dlaczego `clean.py` niszczy informacje, których potrzebuje `views.ts` i `v2/`

Mapę przyczyn z odwołaniami do kodu potwierdzają uzasadnienia, które solver sam zapisuje przy każdym widoku:

| sygnał solvera | gdzie | czego wymaga od pikseli | co robi z nim czysta fasada | ślad w przebiegu |
| --- | --- | --- | --- | --- |
| obrys budynku | `views.ts:138 buildingExtent` → `image-metrology/bounds.ts architecturalBounds` (gdy sylwetka obserwacji pokrywa ≥ 85 % kadru, jak w każdym renderze ARCHON) | długie prostoliniowe krawędzie, punkty odcięte 1 % od ramki | pas nawierzchni do krawędzi kadru i białe tło zmieniają x/y obrysu | „the silhouette is 12.65 m across … both walls on that axis are already assigned” (A01, Rarytasy) |
| pas ściany (WALL_BAND) | `v2/scan.ts neutralBands` (chroma < 40) | niebo/zieleń zatrzymują bieg na krawędzi ściany | **białe tło jest neutralne** — pas biegnie przez tło | t3: „414 px across is the 14.41 m walled width, 0.0348 m/px” (zamiast 0,0169) |
| grunt | `frame.ts:470` (różnica > 0,9 m → odmowa), konsensus gruntu widoków | dolna krawędź obrysu na linii terenu | bez terenu dół obrysu „pływa” | „puts the ground at 0.52 m against 0.01 m from the house's other views” (Cieszynianki) |
| otwory | `image-metrology/opening.ts` (kontrast ≥ 8), `facade-openings.ts` (szkło = luma < ściana − 10) | szkło **ciemniejsze** od ściany | szkło jednolicie **jasne** (luma ≈ 211) | A01: 14 → 0 odczytów |
| kalenica / dach | `topNeutralInkRow`, kominy po tonie | neutralny ciemny dach | kolory klastrów zmieniają ton | — |

Wniosek: ograniczenie nie leży w samym obrazie. Wynika z tego, że ekstraktor przechowuje założenia jako własności
pikseli („tło nie jest szare”, „szkło jest ciemne”, „dół obrysu to grunt”, „szczyt obrysu to kalenica”). Czyszczenie
łamie te założenia, a nie usuwa informacji. Drugą połowę odpowiedzi daje adapter niżej: jawna obserwacja pomaga tylko
wtedy, gdy ma **znaczenie**, a nie tylko kształt.

### `FacadeGeometryEvidence` (`iu3/evidence.py`, schemat `iu03.facade-geometry-evidence/1`)

Każda pozycja ma współrzędne w pikselach oryginału (transformacja tożsamościowa, zapisana), `confidence`, `source`
i stan. Pozycje:

- **obrys:** poligon maski budynku z odciętymi cienkimi pasami nawierzchni, wraz z `solidity` i `coverage`;
- **linia gruntu:** wiersz i zakres. Stan OBSERVED tylko przy niezależnym potwierdzeniu narysowaną ciemną linią terenu
  albo krawędzią poziomą *wewnątrz* kadru. Podstawa na krawędzi ramki daje UNCERTAIN, rozbieżne podstawy MISSING,
  zasłonięta podstawa UNCERTAIN;
- **narożniki podstawy;**
- **kontur dachu, kalenica** (APEX / RIDGE_LINE) **i okapy** — okap ma UNCERTAIN, gdy dach i ściana różnią się o < 10 ΔE;
- **otwory:** prostokąt, rodzaj (okno/przeszklenie, drzwi/brama, brama garażowa), `reachesGround`, `occludedShare`,
  `reflectionSuspected` i `independentlyDetected`. Każda zieleń na otworze, przed nim albo w odbiciu, czyni otwór
  niezweryfikowanym, bo sam kolor ich nie rozróżni. Odrzucone „otwory” (cała ściana, pas/listwa) mają podany powód;
- **kominy;**
- **maska niepewności:** przesłony segmentatora, liście (detektor koloru, niezależny od segmentatora) i odbicia.

Moduł nie tworzy żadnego wymiaru w metrach. Metry powstają wyłącznie z rejestracji solvera.

### Trzy warianty + adapter, ten sam ekstraktor (`iu3/extractor_variants.ts`, solver bez zmian)

„Poprawny” = odczyt pokrywający otwór umieszczony z rzutu na tej samej elewacji i kondygnacji (≥ 50 % krótszego
przedziału, `score_readings.py`). Liczba otworów modelu jest identyczna we wszystkich wariantach.

| wariant | DEV (5 domów): poprawne / odczyty, niedopasowane, widoki | TEST (4 domy): poprawne / odczyty, niedopasowane, widoki |
| --- | --- | --- |
| 1. RAW — oryginał (baseline) | 31/36, 0, **15** | **15/19**, 1, 5 |
| 2. CLEAN — `clean-facade.png` | 20/21, 1, 10 | 10/10, 0, **7** |
| 3. ANCHORED — czysty + przywrócone kotwice (obrys, grunt OBSERVED, otwory, kominy jako tusz) | 20/21, 0, 11 | 10/12, 1, **7** |
| RAW_FGE — adapter: oryginał + sylwetka z FGE | **40/44**, 0, **17** | 12/16, 2, 6 |
| ANCHORED_FGE — adapter: wariant 3 + sylwetka z FGE | 34/37, 0, **17** | 11/11, 0, 6 |

Odsetek poprawnych odczytów względem 66 otworów zliczonych na elewacjach DEV:
RAW 31 (47 %), CLEAN 20 (30 %), ANCHORED 20 (30 %), RAW_FGE 40 (61 %), ANCHORED_FGE 34 (52 %).

Na teście żaden wariant nie poprawił naraz odczytu i rejestracji: CLEAN i ANCHORED dają więcej widoków (7 vs 5) i
mniej poprawnych odczytów (10 vs 15). Domy t2 i t4 produkcyjna rekonstrukcja odrzuciła już na rzucie
(`RECONSTRUCTION_FAILED`), więc część B testu ma 4 domy.

### Przykłady utraconych i odzyskanych kotwic (uzasadnienia solvera, skrócone)

| dom / elewacja | RAW | wariant | co się stało |
| --- | --- | --- | --- |
| A01 bok 4f52… | REGISTERED („513 px = 8,30 m”) | CLEAN: NOT_REGISTERED | **utracona** — sylwetka 12,65 m po zniknięciu tła; obie ściany osi „zajęte” |
| Cieszynianki e229… | NOT_REGISTERED (grunt +0,79 m) | RAW_FGE: REGISTERED („1162 px = 16,60 m + 0,90 m okapu”) | **odzyskana** — jawna sylwetka z gruntem OBSERVED |
| Gozd 0237… | NOT_REGISTERED (sylwetka 41,6 m) | RAW_FGE: POSITIONS_ONLY | **odzyskana** (tylko położenia) |
| t3 1a53… | NOT_REGISTERED | RAW_FGE: REGISTERED („776 px = 11,32 m”) | **odzyskana** |
| t3 eabd… | REGISTERED (0,0168 m/px) | CLEAN: OPENINGS_ONLY (0,0262 m/px) | **zła skala** — pas ściany przez białe tło |
| t5 a112… | OPENINGS_ONLY | wszystkie inne: NOT_REGISTERED | **utracona** — jedyny widok domu, 4 poprawne odczyty |
| Rarytasy 5dba…, t3 7ab6… | wierzchołek w rzędzie 169 / 180 | RAW_FGE: 128 / 145 | **zła kotwica** — szczyt obrysu FGE to górna krawędź komina (prostokąt komina zaczyna się w rzędzie 128 / 145), a solver bierze go za kalenicę (skala 0,0150 zamiast 0,0164) |

### Negatywy obowiązkowe (`iu3/negatives.py`, prawda z generatora)

Każdy przypadek ma 2 obrazy. „Wynik” to zachowanie FGE na elewacjach i decyzja VETO_ONLY na nie-elewacjach.

| przypadek | wymaganie | dev | **test** |
| --- | --- | --- | --- |
| N1 biały tynk na białym tle | brak wymyślonych otworów | 2/2 | 2/2 |
| N2 drzewo przed oknem | to okno nigdy „niezależnie wykryte” | 2/2 | 2/2 |
| N3 odbicie drzewa w przeszkleniu | jeden otwór, nie rozbity | 2/2 | 2/2 (raz okno przeoczone, `missed`) |
| N4 brama garażowa do gruntu | brama/drzwi, nie szkło | 2/2 | **1/2** (brama nie znaleziona) |
| N5 ciemny dach i ciemna elewacja | kalenica ≤ 6 px, okap zgodny albo UNCERTAIN, brak dodanych | 1/2 | **0/2** (okap 357 px; jeden dodany otwór) |
| N6 balkon z balustradą | balustrada nie jest oknem | 2/2 | **1/2** |
| N7 perspektywa niemal frontalna z podpisem „elewacja” | nie do ekstraktora | 2/2 | **1/2** |
| N8 arkusz z przekrojem i elewacją | nie jako jedna fasada | 2/2 | 2/2 (REVIEW) |
| N9 niepewna / brakująca linia gruntu | grunt nie OBSERVED, adapter nic nie dodaje | 2/2 | 2/2 |
| **razem** | | **17/18** | **13/18** |

(Rejestracja podaje dev 16/18. Przy zamrożeniu źle odczytałem N6-1: dodał jeden otwór, ale spełnia swoje kryterium.)
We wszystkich elewacjach negatywów VETO_ONLY zachował trasę, a żadne przesłonięte okno nie zostało oznaczone jako
niezależnie wykryte.

## Koszt, zasoby, licencje (CPU x86-64 kontenera, 4 wątki; telefon — tylko prognoza)

| element | model | rozmiar | czas | RAM procesu | licencja |
| --- | --- | --- | --- | --- | --- |
| VETO_ONLY: klasyfikator | OpenCLIP ViT-B/32 (wieża obrazu 87,8 M param.) + głowa IU-02 (8 klas × 536) | ~350 MB fp32 | 30 ms/obraz | ~1,6 GB z wieżą tekstu | MIT (wagi); dane LAION-2B — pytanie o proweniencję |
| VETO_ONLY: rzut bez maski + 24 cechy | własny kod (LSD, OpenCV) | — | 0,10 s/obraz | ~0,5 GB | własny |
| FGE: segmentacja | UperNet ConvNeXt-T ADE20K | 230 MB | mediana 3,5 s, max 8,7 s | ~1,7 GB | MIT; ADE20K ma własne warunki |
| FGE: czyszczenie + dowody | własny kod | — | 3,2 s + 0,1 s | — | własny |

VETO_ONLY nie potrzebuje segmentatora. Na Androida offline (prognoza) wieża CLIP w int8 to ~90 MB i jest wykonalna,
ale nie mierzyłem jej. UperNet jest za duży. SegFormer-B0 (tylko badania) nie był używany w IU-03A.

## Kryteria integracji

| kryterium | wynik | status |
| --- | --- | --- |
| brak potwierdzonych nie-elewacji kierowanych do ekstraktora | REAL: 0/100; ADVERSE: 1/227 + 1 negatyw (perspektywy niemal frontalne) | ❌ |
| ≥ 70 % prawidłowych elewacji | REAL 100 %; ADVERSE 74 % (CI 65–81 %) | ✅ (dolna granica CI < 70 %) |
| brak pogorszenia rejestracji i wykrywania otworów | test: każdy wariant pogarsza odczyt albo rejestrację względem RAW | ❌ |
| licencje i zasoby offline Android | klasyfikator: do sprawdzenia (rozmiar, LAION); UperNet: nie | ❌ / ? |
| etykiety zweryfikowane przez człowieka | nie — próbka gotowa | ❌ |

→ **`RESEARCH_PARTIAL`. Walidacja nie jest zakończona** do czasu przeglądu etykiet.

## Próbka do niezależnego przeglądu

`stage-reports/artifacts/iu-03a/human-review-sample.csv` zawiera 124 zasoby TEST_ARCHON: hash, etykietę agenta, rolę
produkcyjną, decyzję VETO_ONLY oraz puste kolumny `humanLabel` i `humanNote`. Numer wiersza odpowiada kafelkowi na
anonimowych arkuszach w `/home/user/workiu03/test-archon/sheets/` (lokalnie — piksele wydawcy nie trafiają do repo).
Etykiety DEV (ARCHON, LoC, Commons) także są etykietami agenta.

## Odstępstwa (jawne)

1. `evaluate.py test` nie liczył początkowo testu rzutu w masce dla STRICT_IU02 (wszystko „NOT_MEASURED”, 0 %). Dodałem
   liczenie dokładnie wg IU-02 i powtórzyłem przebieg. VETO_ONLY i jego próg bez zmian.
2. `negatives_eval.py` dostał parametr `--tag`, żeby czytać cechy zbioru testowego. To harness, nie reguła.
3. Wynik dev negatywów w rejestracji (16/18) był źle odczytany; poprawnie 17/18.
4. TEST_ARCHON: 2 z 6 domów nie przeszły produkcyjnej rekonstrukcji (rzut), więc część B ma 4 domy.

## Rekomendacja i następny krok (nie rozpoczęty — decyzja OWNER-a)

- **Nie integrować** niczego z IU-03A w obecnym kształcie.
- VETO_ONLY jest najbliżej integracji. Przy prawdziwych podpisach niczego nie traci i nie myli się, a przy błędnych
  zatrzymuje 226/227. Jedyna znana luka to perspektywa niemal frontalna z drzewami. Kandydatem jest weto z testu rzutu
  **w masce** budynku (koszt: segmentator), ale to wymaga nowego zbioru testowego, bo wybór padłby po obejrzeniu
  tego testu.
- W części B kierunkiem jest **obserwacja z nazwą**, nie repaint. Solver powinien dostać kalenicę, okapy, grunt i
  otwory jako osobne, nazwane obserwacje z pewnością, a nie poligon, którego szczyt musi zgadywać. Wymaga to zmiany
  w produkcji (`views.ts`, `frame.ts`), więc to decyzja OWNER-a.
- Czyszczenia fasady nie używać jako wejścia ekstraktora.

## Pliki i reprodukcja (offline poza pobraniem stron ARCHON przez produkcyjny pipeline)

```
PY=<venv>/bin/python; cd research/image-understanding
$PY iu3/dev_inputs.py; npx vite-node iu3/legacy_roles.ts -- <in> <out>      # LEGACY
$PY iu3/evaluate.py dev --out <json>                                        # dev + wybór t_veto
$PY iu3/negatives.py --out <dir> [--seed N]; $PY iu3/negatives_eval.py --neg <dir> --tag <t> --t-veto 0.6 --out <json>
$PY iu3/facade_variants.py --house <h> --assets <json> --out <dir>         # FGE + warianty 2/3
npx vite-node iu3/extractor_variants.ts -- --house <h> --run <dir> --package <json> --cache <dir> --variants <dir> --out <json>
python3 -I iu3/score_readings.py <extract-*.json>
$PY iu3/test_inputs.py {synth|archon} ...; $PY iu3/evaluate.py test --t-veto 0.6 --rows ... --out <json>
```

Testy celowane: `npx vitest run tests/architecture/research-isolation.test.ts -t "IU-0"` (11/11). Produkcja nie
importuje `iu3`. Każdy zapis odmawia ścieżek w repo. VETO_ONLY nie dodaje tras i nie przepisuje ról. Adapter nie
zapisuje zapieczętowanego grafu.
