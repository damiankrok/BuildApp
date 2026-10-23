# STAGE BUILDPLAN IU-01 — IMAGE UNDERSTANDING: automatyczne rozpoznawanie rodzaju obrazów źródłowych (badanie)

**Klasa: RESEARCH. Kod produkcyjny analizatora, `SourcePackage`, jego hashe i rekonstrukcja — bez zmian.** Bez APK,
bez pełnego CI, bez FIX-02/FIX-03/P3. Baza `d94b1c1` (N7-COUNCIL-FIX-01) na `claude/new-session-3kzcgh`.
Kod: `research/image-understanding/`. Wyniki liczbowe: `stage-reports/artifacts/iu-01/`.

**Werdykt: `RESEARCH_PARTIAL` — moduł NIE jest gotowy do integracji.**

## Odpowiedź dla OWNER-a w pięciu zdaniach

1. Dziś BuildPlan **w ogóle nie patrzy na piksele**, zanim nada obrazowi rolę: decydują słowa w adresie i podpisie.
   Na brief §9 ścieżka produkcyjna jest niebezpieczna w **8 z 11** przypadków (wnętrze podpisane „elewacja” idzie do
   ekstraktora fasad; każde wnętrze idzie do solvera kamery zewnętrznej).
2. Na obrazach **ARCHON** z 7 domów, których model nie widział, klasyfikator z pikseli (MobileNetV3 + głowa liniowa)
   rozpoznaje **210/210** obrazów (C2: 208 ACCEPT poprawnie, 2 UNKNOWN, 0 błędów) i rozdziela wnętrza od widoków
   zewnętrznych, czego produkcja nie robi wcale (69/69 wnętrz u niej to „perspektywa zewnętrzna” albo brak).
3. **Poza stylem ARCHON to się rozsypuje**: na syntetycznych, płasko cieniowanych rysunkach (005R) każdy wytrenowany
   model myli się w 44–60 % zaakceptowanych przypadków, często z pewnością 0,8–1,0; **31 z 54 perspektyw** z podpisem
   „elewacja” przeszłoby do ekstraktora fasad. Model nauczył się stylu wydawcy („fotorealistyczny render = perspektywa”,
   „kreska na białym = rzut”), a nie rzutowania.
4. Kalibracja i progi z danych ARCHON nie przenoszą się na inny styl. Na ślepym zbiorze 170 obrazów z Wikimedia
   Commons C2 nie wpuszcza perspektyw ani wnętrz do fasad, ale akceptuje tylko 46 % obrazów i myli się w 33 % akceptacji
   (3 przekroje skierowane do fasad); na płaskich syntetykach bramka nowości nie łapie nic.
5. Zalecenie: nie integrować; najpierw prawdziwy drugi wydawca/styl w danych (z licencją), detektor rzutu oparty na
   punktach zbiegu po segmentacji budynku (IU-02) i dopiero potem decyzja o fine-tuningu.

## 1. Audyt istniejącej klasyfikacji

Pełny opis: `research/image-understanding/audit/AUDIT.md`. Role nadaje wyłącznie `archonRoleClaims()` (slug, podpis,
kanał, ścieżka fragmentu piętra) → `mergeRoleClaims()` (najwyższa pewność wygrywa) → `normalizeRoles()` (projekcja
wyprowadzona z roli dokumentu). `router.ts` wybiera adapter strony, nie klasyfikuje obrazów. Konsumenci:
`readsAsFacade()` (fasada dla `ELEVATION`), `analyze.ts` (routing ekstraktorów), `reconstruct-v2.ts:1950` (solver kamery
dla każdego `PERSPECTIVE`), `views.ts chooseSide()` (FRONT/REAR wierzone bez kontroli), `layout.ts` (kondygnacja
i kopia bazowa z etykiet).

| Council | odtworzenie na `d94b1c1` | wynik |
| --- | --- | --- |
| A-1 | `research/analyzer-n7-council/A/plan-regs.ts marcowki` | dwie kopie 853 px tego samego rzutu poddasza: 3,697 vs 1,039 cm/px — **odtworzone** |
| A-2 / A-6 | `research/analyzer-n7-council/A/roles-hazards.ts` | 8/11 BAD (sytuacja→rzut, „parterowy” w nazwie → GROUND, fragment /3 → ATTIC dla piętra, /1 → GROUND dla piwnicy) — **odtworzone** |
| A-5 | `research/analyzer-n7-council/A/mutate.ts marcowki none,swapFR` | zamiana FRONT/REAR → inny model (`8541ca10`→`32000cd3`), wszystkie widoki REGISTERED, zero odmów — **odtworzone** |
| brief §9 na metadanych | `research/image-understanding/audit/metadata-hazards.ts` | **8/11 UNSAFE** |

## 2–4. Moduł, podejścia, dane

**Klasy:** `FLOOR_PLAN`, `ORTHOGRAPHIC_ELEVATION` (także kolorowa elewacja renderowana), `TECHNICAL_SECTION`,
`EXTERIOR_PERSPECTIVE`, `INTERIOR_PERSPECTIVE`, `SITE_PLAN`, `ARCHITECTURAL_DETAIL`, `OTHER`; `UNKNOWN` jest decyzją, nie
etykietą. Osobno: adnotacja rzutu (wymiarowany / bez widocznych łańcuchów), styl elewacji (renderowana / uproszczona),
rzut (ortogonalny / perspektywiczny), kondygnacja i strona — **z pikseli nie są ustalane** (brak niezależnego dowodu
na pojedynczym obrazie), prototyp przenosi roszczenie wydawcy jako `CLAIMED_UNVERIFIED`.

**Dane.** Korpus 005R: 1352 unikalne obrazy, 50 edycji ARCHON, 34 rodziny projektów (bajty poza repo). **Etykiety
niezależne od metadanych:** każdy obraz oznaczyłem na anonimowych arkuszach (tylko indeks i rozmiar; bez adresu,
podpisu, sluga, kanału) — 46 arkuszy. Dopiero potem porównanie z prawdą strukturalną 005R: 728 zgodnych, 609 bez prawdy
005R, **15 rozbieżnych — wszystkie to znane z 005R widoki zewnętrzne w karuzeli wnętrz** (`CONFIRMED_PUBLISHER_MISLABEL`).
36 obrazów oznaczonych jako trudne. Rozkład: E 396, I 328, X 327, P 154, S 97, T 50; **ARCHON nie ma detali ani „innych”**.
To są etykiety agenta, nie OWNER-a — nie były zweryfikowane przez człowieka. Plik: `data/labels-archon.json` (tylko SHA-256).

**Podział po projektach** (`iu/corpus.py`, ustalony przed jakimkolwiek modelem): rodzina Rarytasy (17 edycji, 426
obrazów) zawsze TRAIN; pozostałe rodziny po skrócie soli `IU01-split-v1` → **TRAIN 17 / VAL 10 / TEST 7 projektów**
(944 / 282 / 210 obrazów). Skrypt sprawdza brak wspólnego projektu między częściami; dodatkowo żaden obraz TEST nie ma
sąsiada w TRAIN o kosinusie ≥ 0,95 (MobileNet). Marcówki są w VAL.

**Syntetyki** (z obrazów tego samego splitu): kolaże 2×2 / 1×2 (`OTHER`), uproszczone elewacje (krawędzie, posteryzacja),
kopie 400 / 1200 px (tylko TEST). **OOD:** (a) 177 unikalnych obrazów generatora 005R (prawda z konstrukcji, sprawdzona
na próbce) — płaskie elewacje podobne do przykładów OWNER-a, rzuty, przekroje, sytuacje, perspektywy, wnętrza, 2 detale;
(b) Wikimedia Commons, wolne licencje — patrz §8.3.

**Podejścia (na identycznym TEST):**

| | co | trening |
| --- | --- | --- |
| A | produkcja bez zmian (`V0a` z 005R; kod ról identyczny) | — |
| B0 | OpenCLIP ViT-B/32 zero-shot, zestawy promptów | tylko temperatura (OOF-TRAIN+VAL) |
| B | zamrożony backbone + regresja logistyczna (MobileNetV3-L, DINOv2-S/14, CLIP ViT-B/32) | TRAIN (+ szare/białe dopełnienie), C i temperatura z VAL / OOF |
| C | B (najlepszy na VAL: MobileNetV3) + metadane wydawcy + niezależne sprawdzenie geometryczne; metadane i geometria mogą tylko **obniżyć** decyzję (ACCEPT→REVIEW) | progi geometryczne z TRAIN |
| C2 | C + bramka nowości (typowość = średni kosinus do 5 najbliższych obrazów TRAIN, próg = 1. percentyl VAL) — **dodane post-hoc** po pierwszym przebiegu OOD | próg z VAL |

Fine-tuningu nie robiłem: 17 projektów TRAIN jednego wydawcy, a liniowa głowa już daje 0 błędów na VAL — dalsze
dopasowanie do ARCHON tylko pogłębi skrót stylu (§8.2). **Brak podstaw do fine-tuningu do czasu, aż dane obejmą inne
style.** MobileSAM nie jest klasyfikatorem i nie był tu używany (należy do IU-02).

## 5. Kalibracja i decyzje

Każdy rekord (`per-image.json` / `.csv`, prototyp `classification.json`): hash, klasa, 4 najlepsze wyniki, id i wersja
modelu, skalibrowana pewność, typowość, metadane wydawcy, werdykt geometryczny z liczbami, rzut, `ACCEPT / REVIEW /
UNKNOWN`, przyczyna(y), czy obraz trafia do ekstraktora fasad.

- Na samym VAL wszystkie głowy są separowalne (0 błędów), więc temperatura dopasowana na VAL uciekała do brzegu siatki.
  Kalibracja idzie więc na predykcjach **out-of-fold po projektach na TRAIN + VAL** (MobileNet: 3 błędy OOF, T = 0,51).
  ECE na TEST 0,018 → 0,001.
- Progi: τ = najmniejsza pewność z ryzykiem ≤ 2 %; τ_elew = najmniejsza, przy której żadna perspektywa nie jest
  zaakceptowana jako elewacja (oba na OOF-TRAIN+VAL). Wynik: **τ = τ_elew = 0,30 — w rozkładzie ARCHON próg nic nie
  wnosi.** Żadnej reguły „95 % = racja”: tam, gdzie model się myli (OOD), myli się z pewnością 0,4–1,0.
- Kierowanie do ekstraktora fasad wyłącznie przy `ACCEPT` + `ORTHOGRAPHIC_ELEVATION`. Obraz nigdy nie jest usuwany.

## 6. Weryfikacja zestawu dokumentów (`iu/setcheck.py`)

Na pakiecie Cieszynianek (projekt TEST, z cache, offline, 30 obrazów w 0,8 s): grupy kopii (rzut 853/853/550/400 px
jako jeden rysunek — warianty wymiarowy i z powierzchniami są z dHash nieodróżnialne, więc A-1 wymaga porównania skal,
nie tylko grupowania), 4 różne elewacje, 0 perspektyw w slocie elewacji, brakujące widoki raportowane (nigdy tworzone).
Test lustra: lewa/prawa ściana szczytowa syntetycznego domu f01 → para lustrzana (0,968) — strony nie da się przypisać
z pikseli. **„Te same budynek na 4 elewacjach” i „kontur pasuje do rzutu” — `NOT_MEASURED`**: wymagają maski budynku
(IU-02); podobieństwo osadzeń nie jest dowodem jednego budynku.

## 7. Prototyp offline

`research/image-understanding/iu_classify.py` — folder albo zapieczętowany `SourcePackage` z cache; JSON/CSV,
`set-checks.json`, arkusz kontaktowy z rolą, decyzją i flagami; A obok B i C. Jednorazowe przygotowanie (wagi z SHA-256)
jest oddzielone; inferencja działa pod `offline_guard()` (każdy `connect`/DNS rzuca wyjątek — sprawdzone). Pakiet i jego
hashe są tylko czytane. Bez integracji z Androidem.

## 8. Wyniki

### 8.1 TEST — 210 obrazów ARCHON z 7 nieznanych projektów

| podejście | pokrycie | ryzyko selekt. (Wilson 95 %; bootstrap projektów) | UNKNOWN | wnętrze/perspektywa → elewacja (ACCEPT) |
| --- | --- | --- | --- | --- |
| A produkcja | 79,0 % | **26,5 %** (20,4–33,7; 11,2–38,5) | 44 | 0 (na tych podpisach; zob. §9) |
| B0 CLIP zero-shot | 16,7 % | 20,0 % (10,0–35,9) | 175 | 0 |
| B MobileNetV3 | 100 % | 0 % (0–1,8) | 0 | 0 |
| B DINOv2-S/14 | 100 % | 0,5 % (0,1–2,7) | 0 | 0 |
| B CLIP ViT-B/32 | 100 % | 0,5 % (0,1–2,7) | 0 | 0 |
| C fuzja | 100 % | 0 % (0–1,8) | 0 | 0 |
| **C2 fuzja + bramka nowości** | 99,0 % | 0 % (0–1,8; 0–0) | 2 | 0 |

Per klasa (C2): rzut 26/26, elewacja 56/56, przekrój 12/12, perspektywa zewn. 40/40, wnętrze 67/69 (2 UNKNOWN — widoki
łazienek z góry), sytuacja 7/7; precyzja 1,0 we wszystkich klasach (dolne granice Wilsona 0,65–0,95 zależnie od
liczności). Produkcja A: wnętrza 0/69 (44 jako „perspektywa zewn.”, 25 nieobecne w pakiecie), perspektywy zewn. 21/40.
Macierze pomyłek: `artifacts/iu-01/results.json`. Atrybuty: adnotacja rzutu 23/26 (3 rzuty wymiarowe jako „bez
łańcuchów”), styl elewacji 90/90 (56 renderowanych + 34 syntetycznie uproszczone).
Metamorfozy na TEST: szare vs białe dopełnienie — 0/210 zmian decyzji; kopie 400 i 1200 px — 420/420 decyzji jak oryginał.
Pewne błędy modelu (≥ 0,8) na TEST: brak.

**Te liczby mówią o jednym wydawcy.** 7 projektów to mała próba; przedział dla ryzyka 0–1,8 % jest przedziałem obrazu,
nie gwarancją.

### 8.2 OOD syntetyczne (005R, 177 obrazów, 12 domów) — pierwszy przebieg, przed jakąkolwiek zmianą

| podejście | pokrycie | ryzyko selekt. | perspektywa → elewacja (ACCEPT) |
| --- | --- | --- | --- |
| A | 0 % (brak metadanych) | — | 0 |
| B0 CLIP zero-shot | 19,2 % | 0 % | 0 |
| B MobileNetV3 | 98,3 % | **46,6 %** | **35** |
| B DINOv2 | 99,4 % | 44,3 % | 60 |
| B CLIP | 100 % | 60,5 % | 66 |
| C / C2 | 96,1 % | 45,3 % | **31** (z 54) |

Pomyłki C2: elewacje uproszczone → rzut 18, → przekrój 6; perspektywy → elewacja 31; sytuacje → rzut 13/13; detale →
elewacja / rzut. 14 z 84 błędów ma pewność ≥ 0,9. Sprawdzenie geometryczne (punkt zbiegu przybliżony udziałem krawędzi
3–20° od poziomu) uznało 32/54 płaskich perspektyw za zgodne z rzutem ortogonalnym — linia horyzontu dominuje, a płaskie
ściany dają mało krawędzi. Bramka nowości (C2) nie zmieniła tu nic: cechy ImageNet uznają te obrazy za „typowe”.
C2 dodałem **po** obejrzeniu tych wyników, więc ten zbiór nie jest już dla C2 ślepy (`results-run1-before-novelty-gate.json`
zachowuje przebieg 1).

Jedyne podejście bezpieczne na OOD to zero-shot B0 — bo prawie zawsze mówi UNKNOWN.

### 8.3 OOD Commons (ślepe dla C2)

170 obrazów z Wikimedia Commons na wolnych licencjach (domena publiczna 90, CC0 19, CC BY/BY-SA reszta; miniatury
500 px poza repozytorium, w repozytorium tylko SHA-256, licencja i adres strony opisu w `data/labels-commons.json`).
Zbiór zamrożony **przed** pierwszym uruchomieniem modelu; etykiety nadałem z pikseli (agent, nie OWNER): 137
`CONFIRMED`, 33 `DISPUTED` (np. arkusz „rzut + elewacja” na jednej kartce, rysunek historyczny na granicy klas).
Ani progi, ani bramka nowości nie były na tym zbiorze strojone — to jedyny naprawdę ślepy test C2.
Skład: wnętrza 33, inne 31, rzuty 31, perspektywy zewn. 31, elewacje 12, sytuacje 11, przekroje 11, detale 10.

| podejście | pokrycie | ryzyko selekt. (Wilson 95 %) | perspektywa/wnętrze → elewacja (ACCEPT) |
| --- | --- | --- | --- |
| A | 0 % (brak metadanych wydawcy) | — | 0 |
| B0 CLIP zero-shot | 8,8 % | 6,7 % (1,2–29,8) | 0 |
| B MobileNetV3 | 88,8 % | **50,3 %** (42,5–58,2) | **15** |
| B DINOv2 | 95,3 % | 63,6 % | 28 |
| B CLIP | 87,6 % | 84,6 % | 52 |
| C | 69,4 % | 38,1 % (29,9–47,1) | 0 |
| C2 | 45,9 % | **33,3 %** (23,9–44,4) | 0 |

C2 per klasa (zaakceptowane poprawnie / n; precyzja): rzut 24/31 (P 0,57), elewacja 5/12 (P 0,42), przekrój 0/11,
perspektywa zewn. 12/31 (P 1,0), wnętrze 10/33 (P 1,0), sytuacja 1/11, detal 0/10, inne 0/31 (21 UNKNOWN).
26 z 78 akceptacji jest błędnych, **14 z nich z pewnością ≥ 0,9**. Wzór: wszystko, co jest kreską na białym tle
(detale, rysunki historyczne, „inne”), staje się rzutem; przekroje i arkusze mieszane — elewacją.

Do ekstraktora fasad C2 skierowałby 12 obrazów, z czego 7 to nie elewacje: 3 przekroje i 1 rzut (`CONFIRMED`), 2 „inne”
i 1 sytuacja (`DISPUTED`). **Perspektyw ani wnętrz w tej trasie nie ma** — geometria i bramka nowości złapały tu
widoki z punktem zbiegu (13 × `GEOMETRY_PERSPECTIVE_CONFLICT`, 55 × `OUT_OF_DISTRIBUTION`), ale za cenę pokrycia
46 %: 23/33 wnętrz i 10/31 perspektyw kończy jako UNKNOWN. Na samych `CONFIRMED`: 63 akceptacje, 13 błędnych
(ryzyko 20,6 %); na `DISPUTED` 13/15 akceptacji nie zgadza się z etykietą — tych liczb nie należy czytać jako
błędu modelu, tylko jako miejsca, gdzie klasa jest sporna.

Wniosek dla werdyktu: na ślepym zbiorze innego stylu bramka nowości działa (w przeciwieństwie do 005R — tam style
były „typowe” dla cech ImageNet), ale klasyfikator **nie jest wiarygodny**: co trzecia akceptacja błędna, a przekroje
w trasie fasad. Kryterium z §12.6 (0 perspektyw jako elewacja przy pokryciu ≥ 70 %) nie jest spełnione — pokrycie
46 %. `RESEARCH_PARTIAL` potwierdzony.

### 8.4 Rozmiar, czas, RAM (zmierzone na CPU x86-64 kontenera, nie na telefonie)

| backbone | parametry obrazu | fp32 | batch 1, 1 wątek | batch 1, 4 wątki | szczyt RSS procesu |
| --- | --- | --- | --- | --- | --- |
| MobileNetV3-L (224) | 4,2 M | 16,8 MB | 24 ms (torch) / **6,0 ms (ONNX Runtime)** | 19 ms | 388 MB |
| DINOv2-S/14 (518) | 22,1 M | 88 MB | 994 ms | 441 ms | 510 MB |
| CLIP ViT-B/32 (224) | 87,8 M | 351 MB | 126 ms | 59 ms | 1 523 MB |

Eksport MobileNetV3 do ONNX: 16,8 MB, różnica wyjść vs PyTorch ≤ 5·10⁻⁶ (zmierzone). **Prognoza, nie pomiar:** na
średnim telefonie arm64 ONNX Runtime (już w APK dla OCR) ~20–60 ms na obraz i ~50–100 MB RAM — do sprawdzenia
na urządzeniu w następnym etapie. Głowa liniowa: 8×1280 liczb.

## 9. Testy negatywne (brief §9) — trasa do ekstraktora fasad A / B / C2

| przypadek | n | A | B | C2 | wynik C2 |
| --- | --- | --- | --- | --- | --- |
| wnętrze podpisane „elewacja” (TEST, wymuszony podpis) | 69 | **69** | 0 | 0 | 67 REVIEW (METADATA_CONFLICT), 2 UNKNOWN |
| elewacja renderowana z drzewami | 56 | 56 | 56 | 56 | 56 ACCEPT elewacja ✔ |
| perspektywa prawie od frontu (trudne) | 9 | 0 | 0 | 0 | 9 ACCEPT perspektywa ✔ |
| wszystkie perspektywy zewn. podpisane „elewacja” | 40 | **40** | 0 | 0 | 40 REVIEW ✔ |
| przekrój podpisany „elewacja” | 12 | **12** | 0 | 0 | 12 REVIEW ✔ |
| kolaż 2×2 / 1×2 | 24 | 0 | 0 | 0 | 24 UNKNOWN ✔ |
| ta sama elewacja po uproszczeniu (TEST) | 34 | 0 | 34 | 21 | 21 ACCEPT elewacja, 13 REVIEW (geometria) ✔ |
| kopie 400 / 1200 px | 420 | — | — | — | 420/420 jak oryginał ✔ |
| brak podpisu, nieznana strona | 56 | — | — | — | klasa z pikseli; strona UNKNOWN ✔ |
| rzut poddasza podpisany „parter” | 26 | — | — | — | **ograniczenie**: kondygnacji z pikseli nie czytam; roszczenie zostaje CLAIMED_UNVERIFIED |
| OOD: uproszczone elewacje 005R | 70 | 0 | 45 | 45 | 18 → rzut, 6 → przekrój (nie trafiają do fasady, ale są błędne) |
| **OOD: perspektywy 005R podpisane „elewacja”** | 54 | 54 | 35 | **31** | ✘ **31 ACCEPT jako elewacja** |
| OOD: wnętrza 005R podpisane „elewacja” | 12 | 12 | 0 | 0 | 12 REVIEW ✔ |
| OOD: detal (klasy brak w treningu) | 2 | 0 | 1 | 1 | ✘ ACCEPT jako elewacja / rzut zamiast UNKNOWN |

## 10. Ograniczenia (nieukryte)

- Jeden wydawca w danych uczących; wszystkie dobre liczby są ARCHON-scoped. Drugi wydawca z zezwoleniem — brak (005R:
  DobreDomy i podobni `SOURCE_NOT_USABLE`).
- Etykiety: agent na anonimowych arkuszach, nie OWNER. Żadna etykieta nie jest „zweryfikowana przez człowieka”.
- Prawdziwych zdjęć (nie renderów) wnętrz/zewnętrza i detali konstrukcyjnych w treningu nie ma.
- Kondygnacja i strona budynku nie są ustalane z pikseli.
- Sprawdzenie geometryczne jest dopasowane do fotorealizmu ARCHON i zawodzi na płaskim stylu.
- Pomiary czasu — x86, nie telefon.

## 11. Rekomendacja

**Nie integrować.** Na ARCHON moduł jest lepszy od produkcji w każdej mierze i usuwa jej najgroźniejszy błąd (wnętrza
jako perspektywy zewnętrzne, podpis „elewacja” bez kontroli). Ale brief wymaga rozpoznawania także projektów spoza
zbioru treningowego, a na innym stylu ten sam model z wysoką pewnością kieruje perspektywy do ekstraktora fasad.
To dokładnie błąd, którego ma nie popełniać. Etap: `RESEARCH_PARTIAL`.

Jeśli OWNER chce wartości już teraz: jedyne bezpieczne użycie to **alarm, nie router** — rozbieżność „wydawca mówi
elewacja, piksele mówią wnętrze/perspektywa” → REVIEW, bez zmiany trasy przy zgodności. Na TEST zatrzymałoby to
100 % wymuszonych podpisów. To wymaga osobnej decyzji i osobnego etapu.

## 12. Plan IU-02 — segmentacja, usuwanie tła, czyste elewacje

1. **Maska budynku** na elewacjach i perspektywach: MobileSAM (Apache-2.0) z podpowiedziami z dolnej linii terenu
   i górnej krawędzi dachu + własna morfologia; ocena IoU na ręcznie obrysowanych maskach (≥ 60 elewacji, ≥ 3 style).
2. **Usunięcie nieba, drzew, odbić**: klasyfikacja pikseli poza maską; elewacja „czysta” = maska + krawędzie
   architektoniczne. Test: syntetyczne drzewa wklejone na znane elewacje (005R synth) — różnica obrysu przed/po.
3. **Detektor rzutu po segmentacji**: odcinki linii (LSD/ELSED, licencje sprawdzone w 005I) wewnątrz maski;
   zbieżność rodzin poziomych odcinków → punkt zbiegu → `PERSPECTIVE_EVIDENT` z niezależnym od stylu dowodem. To ma
   zastąpić obecny wskaźnik 3–20°, który zawodzi na płaskich renderach.
4. **Uproszczenie elewacji** do obrysu, linii okapu, otworów — wejście dla istniejącego ekstraktora fasad; porównanie
   z ekstraktorem na tych samych obrazach (bez zmiany produkcji).
5. **Dane**: drugi styl z jasną licencją (Commons/HABS, generator syntetyczny z większą różnorodnością, ewentualnie
   materiały za zgodą wydawcy) i etykiety OWNER-a na próbce ≥ 100 obrazów; dopiero wtedy decyzja o fine-tuningu
   MobileNetV3/EfficientNet-Lite.
6. Kryterium przejścia IU-02 → integracja klasyfikatora: na zbiorze innego stylu 0 perspektyw zaakceptowanych jako
   elewacja przy pokryciu ≥ 70 %, ze ślepym zbiorem ocenionym raz.

## Pliki i reprodukcja

`research/image-understanding/README.md` (kroki), `MODELS.md` (modele i licencje), `audit/`, `iu/`, `evaluate.py`,
`iu_classify.py`, `bench.py`, `uncertain_sheet.py`, `data/labels-archon.json`, `data/fetch_commons.py`.
`tests/architecture/research-isolation.test.ts` — blok IU-01 (produkcja nie sięga, brak pikseli/wag w repo, pisarze
odmawiają ścieżek w repo, inferencja za `offline_guard`).
Poza repo (`/home/user/workiu01`): obrazy, osadzenia, wagi, głowa, arkusze kontaktowe niepewnych przypadków
(`results/uncertain/*.jpg`), wyniki prototypu (`proto-ciesz/`, `proto-synth-f01/`).
