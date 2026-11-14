# BuildPlan v3.53.12 — linie wymiarowe, znaczenie i skala

Baza: APK 1337 z `681f6cf` (kod geometrii `0b93b88`, solver 2.42.0, usługa 1.11.0), raport `36ff6f2`. Wynik: czytnik
topologii wymiarów **1.5.0** (`metrics.dimension-topology`), solver 2.42.0 bez zmian, usługa 1.11.0, kod `2b67a26` (migawka kontraktu `9d8fbca`),
APK **1338** (§11). Bez płatnych wywołań (księga 2,72807938 USD, 92 wpisy — bez zmian), bez H2 i prywatnego benchmarku,
ForgeShape tylko do odczytu. Źródła wydawcy, plansze i paczka — prywatnie, poza Gitem. Projekty diagnozy **DEV**:
Wrotycze E (priorytet), Supertunie 2 E, Torenie 3 — ich pierwsze wyniki (przebiegi 1337) zachowane, poza oceną
niezależną. Interfejs Android: **NOT_VERIFIED** (brak urządzenia, brak `/dev/kvm`).

Protokół zapisano prywatnie przed zmianą kodu (`sha256 30142e1c…`, 06:33 UTC), regułę świeżej próby przed pobraniem
listy (`sha256 ff4940a5…`); oczekiwania próby spisano z samych rzutów i zapieczętowano przed otwarciem wyniku
(`sha256 b5a8dbcd…`, 07:34:27 UTC).

**Werdykt.** Wrotycze E: pierwsza utrata była w **detekcji linii** (linia `1620` przecięta drzewami rozpadała się na
kawałki bez dwóch kresek). Po zmianie łańcuch obraz → linia + kreski → `1620` (siatka CLEAR + czytnik zewnętrzny) →
linia całkowita szerokości → skala 2,409 cm/px z dwóch niezależnych odczytów na dwóch osiach (kotwica niezależna `980`
daje 2,411) → obrys na licach zewnętrznych → **model zamiast odmowy** (150,11 / 159,28 m², MATCHES, MEASURED, 0 błędów
kompilacji), wynik `PARTIAL_3D_PREVIEW` / `LIMITED`. Supertunie 2 E i Torenie 3 to **inne mechanizmy** (odczyt cyfr +
polityka ensemble + znacznik etykiety; arbitraż skali) — prześledzone, nie zmienione, bez pogorszenia. Regresja na tych
samych bajtach: 150 domów przesianych, 69 przeliczonych pełną produkcją na obu rewizjach — **68 identycznych, 1 zmiana
(Wrotycze E)**, 0 nowych odmów, 0 nowych błędów kompilacji. Świeża próba 12 domów: nowe linie w 6, **żadna nie doszła do
modelu** — przeniesienia nie potwierdzono (brak aktywacji), stabilność 12/12. APK **1338** zbudowany, przebiegi z bundla
zgodne co do hasha z produkcją hosta. Ryzyko nazwane: kreska całkowicie zakryta rysunkiem (§8).

---

## 1. Łańcuch decyzji — Wrotycze E (priorytet)

Oryginalny rzut 853 × 853 px (GIF, `sha256 d1d0af46…`), kod ekstrakcji = 1337:

| etap | stan w 1337 | po zmianie |
|---|---|---|
| obraz | linia `1620` na y = 61,5 px, x 62–749; kreski na x 69 i 741,5 = lica zewnętrzne ścian zachodniej i wschodniej; linia jasnoszara (luma 121, antyaliasing na dwa wiersze 61/62); drzewa (wypełnienie luma ~190) zasłaniają x ~155–235 i ~330–470 | bez zmian |
| tusz (maska adaptacyjna) | wiersze 61–62: 0,88 tuszu na długości linii — linia JEST w masce | bez zmian |
| przebiegi | trzy kawałki: 62–161 (kreska 69), 216–334 (bez kreski), 458–749 (kreska 741,5) | bez zmian |
| łączenie przesłonięć | `joinOccludedLines` nie łączy: luki 55 i 124 px > 40 px, końce kawałków nie są znacznikami (bieg kończy się wewnątrz drzewa), środkowy kawałek bez kreski | `joinCoveredRuns`: jedna linia 62–749, kreski 69 i 741,5, obie TICK |
| linia wymiarowa | każdy kawałek ma < 2 kreski → odrzucony (`ticks ≥ 2`): **pierwsza utrata — detekcja** | zachowana |
| łańcuch | brak | `chain-horizontal-62`, segment 672,5 px |
| odczyt dosłowny | etykieta istnieje, ale bez linii nie ma łańcucha, do którego mogłaby należeć (liczba czytelna bez wykrytej linii) | siatka: `1620` CLEAR; czytnik zewnętrzny: `1620` (p 0,999, stabilny w 4 wariantach); wybór `AS_READ` (nie z dopasowania skali) |
| znaczenie | — | linia całkowita szerokości, strona N, parter; kreski na licach zewnętrznych |
| skala | 2,419 cm/px z 5 kotwic; szerokość ramowana przez wewnętrzny rząd wymiarów pokoi (y = 574, x 114,5–681) | 2,4093 cm/px — „2 niezależne odczyty na 2 łańcuchach” (1620/672,5 px i 980/406,5 px, osie X i Y), 7 kotwic; kotwica niezależna od dopasowania: 980 (pion, `AS_READ`) daje 2,411 cm/px, różnica 0,07 % |
| obrys | x 114,5–681 (oba boki utracone), y 222–628,5 | x 69–741,5 (lica zewnętrzne), y 222–628,5 |
| wynik | odmowa: najniższa kondygnacja 48,36 / 159,28 m² | **model** 150,11 / 159,28 m² (MATCHES, −5,8 %), skala MEASURED 2,409 (ratio 1,00003), ilości LIMITED (`READING_PARTIAL`), 0 błędów kompilacji, 20 otworów |

Kontrola drugiego wymiaru: 672,5 px × 2,409 = 1620,0 cm; 406,5 px × 2,411 = 980 cm (= wydrukowane 980). Oba pominięte
boki są zbudowane (pokoje 10–13 na zachodzie, 4–5 na wschodzie). Taras północny z pergolą zostaje otwarty (poza ramą),
przeszklenie salonu `500/230` i drzwi `280/230` na ścianie wschodniej są otworami (szerokie przeszklenie `VISUAL_INFERRED`,
wysokości częściowo `ASSUMED`). **Pozostała wada:** pas po północnej stronie pokoju 12 (≈ 5 m²) przy oknie `180/230`
zostaje otwartą wnęką — stąd −5,8 % pokrycia; nie zaliczam tego jako wiernej sceny.

### 1a. Wrotycze E — pomieszczenia, otwory, dach (model po zmianie)

Tabela z modelu (powierzchnia geometryczna wobec listy wydawcy, numer z odczytu w pomieszczeniu): 7 pomieszczeń modelu
wobec 14 opublikowanych. Zgodne ±5 %: 11 Kotłownia z pralnią 5,99/6,02, 14 Pokój 11,30/11,44. Otwarty plan 2 + 4 + 5
(Korytarz, Salon z jadalnią, Kuchnia) w jednym obszarze 51,92 m² wobec 46,89 m² (+10,7 %, przejście 1/3/6 bez ścianek).
Rozbieżne: 12 Pokój 6,09/12,10 (−50 % — pas północny otwarty, wada z §1), 8 Pokój 16,15/11,09 (+46 %, połączony
z sąsiednim pomieszczeniem bez odczytanej ścianki), 10 Pokój w obszarze 22,76 m² razem z sąsiednim (+105 %). Otwory: 20
(10 okien, 10 drzwi), 0 błędów kompilacji; dach: 2 połacie. W 1337 tego domu nie było (odmowa), więc każdy z tych
wyników jest nowy; pokrycie i skala są po zmianie wiarygodne, układ wnętrza — częściowy (`READING_PARTIAL`).

## 2. Łańcuch decyzji — Supertunie 2 E (osobny mechanizm, bez zmiany)

| etap | ustalenie |
|---|---|
| obraz | etykiety `1350` (pion, x 91–107, y 462–492) i `690` (poziom, x 297–319, y 0–14) czytelne, nieucięte, bez zasłonięcia |
| linia | pion x 111: kreski 160 i 762 (602 px), poprawne; poziom y 20: kreski 159,5 / **307** / 464,5 — środkowy „znacznik” 307 to dolna krawędź cyfr etykiety (QUESTIONABLE, `TEXT_INK`), w pikselach linii nic jej nie przecina |
| odczyt | siatka (czytnik własny): `1150` (AMBIGUOUS) i `640` (SUPPORTED); czytnik zewnętrzny: `1350` (p 0,9999) i `690` (p 0,999), oba stabilne w 4 wariantach; własny czytnik na porównywalnych kadrach (skala 1–3, obroty 0/90/270, margines 4/12 px) nie czyta żadnej z tych liczb poprawnie |
| ensemble | `1350`: zewnętrzny prowadzi (siatka AMBIGUOUS); `690`: „żaden nie wygrywa, bo jest zewnętrzny” (siatka SUPPORTED) — oba zostają kandydatami |
| przypisanie | na wybranej kopii rzutu obserwacja pionowa wybiera **`1150` `SCALE_RANKED`** (pasuje do skali 1,91 z rezydualnym 0,004 px) — skala wybrała odczyt; na drugiej kopii tego samego rzutu `1350` `AS_READ` |
| skala | głos strony 1,910 cm/px (wartości CHAIN_CORRECTED dopasowane do niego) vs 2,2425 z `1350/602 px`; niezależna `690/305 px` = 2,262 (zgodna z 2,2425 na 0,9 %), ale nie wchodzi: odczyt `640` i podział łańcucha w 307 |
| decyzja | 2,2425 „z 1 niezależnego odczytu nie przeważa dwukrotnie” → odmowa (bezpieczna) |

**Wariant S (badawczy, nie wdrożony, osobne drzewo):** zbieżny, stabilny odczyt zewnętrzny prowadzi nad odczytem siatki
SUPPORTED. Wynik: `690` jest czytane (LEADS), ale przypisane do połowy linii (147,5 px, rezydualny 56 px) przez znacznik
etykiety w 307 → nadal 1 niezależny odczyt → ta sama odmowa. Bez zmiany w obu wariantach; wyniki obu zachowane
(`sup-var`, `sup-S`). Supertunie wymaga trzech osobnych zmian (czytnik, polityka ensemble, znacznik `TEXT_INK` dzielący
łańcuch) — to osobny etap arbitrażu z własną regresją.

## 3. Torenie 3 (arbitraż skali, bez zmiany)

1337: model w 3,9815 cm/px z hipotezy rozstrzygnięcia wobec mocnej metryki 3,128 cm/px; rekord `SCALE_DEPARTS`
(ratio 1,2728, „każda długość o 27 % za długa, każde pole o 62 % za duże”), ilości `NOT_USABLE`, `READING_PARTIAL`.
Pokrycie 105,00 / 99,16 m² „MATCHES” jest artefaktem: przy sprawdzonej skali 3,128 cm/px ten sam ucięty zasięg dałby
105,00 × (3,128/3,9815)² ≈ **64,8 m² (65 %)** — ucięty obrys jest wtedy jawny. Zmiana tego etapu Torenii nie dotyka
(przesiew linii: wszystkie ramki Torenii identyczne na obu rewizjach, więc wynik produkcji jest z konstrukcji ten sam co w 1337). Rekord nadal mówi `SCALE_DEPARTS` / `NOT_USABLE`; nie jest pokazywany jako dokładny obmiar.

## 4. Mechanizm (ogólny, bez nazw projektów)

`packages/source-metrics/src/dimension-lines.ts`, topologia wymiarów **1.4.0 → 1.5.0** (`joinCoveredRuns`, po
`joinOccludedLines`, przed filtrem `≥ 2 kreski`). Linia wymiarowa przesłonięta na długich odcinkach rysunkiem położonym
na niej (roślinność, logo, znak wodny) jest jedną linią, gdy:

* kawałki są współliniowe (ta sama oś, linia bazowa ± 1 px, grubość ± 1 px);
* każda luka między kawałkami jest zakryta tuszem co najmniej w 80 % (luma < 230) — **luka na gołym papierze nie
  łączy** (koniec linii to koniec linii);
* końce zwrócone do luki **nie** są znacznikami (kreska w 2 px od końca albo znak klasy TICK w zasięgu znacznika
  zamyka łańcuch — dwa łańcuchy rozdzielone rysunkiem zostają dwoma);
* żaden kawałek nie niesie więcej niż jednej własnej kreski, własne odcinki pokrywają ≥ 60 % rozpiętości, żadna luka
  nie przekracza 25 % rozpiętości;
* po złączeniu: kreski liczone tylko na własnych odcinkach kawałków (trafienia na krawędzi zakrycia odrzucone), ≥ 2,
  sklasyfikowane tym samym `classifyMarks`, **pierwsza i ostatnia muszą być TICK** — linia bez kreski na którymś końcu
  nie jest linią.

Testy (`packages/source-metrics/test/covered-runs-v35312.test.ts`, 8): przyczyna (czerwony na 1337, zielony po);
kontrpróby: luka na gołym papierze nie jest mostkowana; kreska zwrócona do zakrycia rozdziela łańcuchy; dwa poprawne
łańcuchy pod szerokim rysunkiem zostają dwoma; złączona linia bez kreski końcowej nie jest linią; zakrycie > ¼
rozpiętości nie łączy niczego; krótki prawdziwy wymiar wewnętrzny znaleziony jak dotąd; jasny pas znaku wodnego ani
nie dzieli linii, ani nie dodaje kreski. Pozostałe testy `source-metrics` 413/413.

Zmiana nie dotyka odczytu cyfr, ensemble, wyboru obserwacji ani arbitrażu skali: Supertunie 2 E i Torenie 3 to osobne
mechanizmy (§2, §3) i są poza tą poprawką.

## 5. Przesiew linii (wszystkie ramki, te same bajty)

Ta sama maska i ten sam raster, obie rewizje, 150 domów regresji, 2432 ramki: zmiana w **57 domach / 61 ramkach**,
**67 linii dodanych, 1 zastąpiona** (Rarytasy 5: kawałek 118–279 px z dwoma znakami QUESTIONABLE zastąpiony pełną linią
68–479 px z kreskami TICK na obu końcach). Żadna linia nie zniknęła bez zastępstwa. Ramki: 17 planów sytuacyjnych,
9 rzutów (`rzut`), 2 elewacje, 1 przekrój, 1 dach, 31 ramek bez nazwy rodzaju w adresie (w większości plany
sytuacyjne i elewacje). Rzuty z nową linią: milorzębem 21, Aurory 26, Bukszpany, Eliza 4, Szyszkowce 11, Wrotycze E
(2 kopie), Stellarie (2 kopie), Rarytasy 5 (zastąpienie). Świeża próba (12 domów, osobny przesiew): nowe linie w 6
domach — 5 planów sytuacyjnych (Fantazje, Turkusy, Dalbergie, Drosery, Jonagoldy) i 1 ramka `rzut` Turkusów
(H y = 148, 290–378 px).

## 6. Regresja (te same bajty, obie rewizje)

Metoda: dowody metryczne powstają przy akwizycji, a odtworzenie (`--metrics`) używa zapisanych — dlatego zmiany detekcji
nie da się sprawdzić odtworzeniem. (1) przesiew linii na wszystkich ramkach 150 domów (120 regresji + 18 innych
wydawców + 12 próby v3.53.11) i osobno 12 domów świeżej próby; (2) **pełna ścieżka produkcyjna**
(`second-house.ts --package --graph --cache --recogniser`, offline) na rewizji zmienionej dla każdego domu z jakąkolwiek
zmianą linii (57 + 12 próby = 69). Strona PRZED: 14 przebiegów produkcyjnych kodu 1337 na tych samych bajtach — każdy
równy odtworzeniu 1337 (14/14) — a dla pozostałych odtworzenie 1337 lub przebieg akwizycji (próba: kod bazowy).
Domy bez zmiany linii (93 z 150, w tym wszystkie 18 innych wydawców) mają dowody metryczne bajt w bajt te same, więc
wynik jest z konstrukcji ten sam.

| | PRZED | PO |
|---|---|---|
| przeliczone domy (69) | 55 modeli, 14 odmów | **56 modeli, 13 odmów** |
| identyczny model / odmowa | — | **68 / 69** |
| zmiana | — | Wrotycze E: odmowa → model (MATCHES, MEASURED 2,409, LIMITED, 0 błędów, 20 otworów) |
| nowe odmowy / nowe błędy kompilacji | — | 0 / 0 |
| powtórzone przebiegi | — | Wrotycze E 4 × (`w-var`, dwa przebiegi produkcyjne, bundel APK 1338) = `3ca6e769ee60` |

Bilans referencyjny: korpus 80 — **66 modeli / 14 odmów bez zmian** (Wrotycze nie należy do 80); tabela pomieszczeń
96/169 bez zmian (żaden zmieniony dom nie należy do zamrożonej tabeli). Stellarie i Anodach nie są liczone jako wierne.

Aktywacja nowych łańcuchów (w zakończonych przebiegach, `tabele/aktywacja-nowych-lancuchow.txt`): 21 nowych łańcuchów;
przyjęty odczyt tylko na trzech — Wrotycze `1620` (użyty: skala i obrys), Aurory 26 `1200` na **drugiej kopii** rzutu
(388 px, zgodny z drugim niezależnym odczytem na tej kopii; kopia niewybrana do modelu, model bez zmian), Wrotycze `621`
na drugiej kopii (nie przeważył głosu strony). Stellarie: nowa linia bez własnej liczby, przypięty `1010` odrzucony
przez skalę (§8). Pozostałe — plany sytuacyjne bez przypiętego odczytu.

Wpływ na zmieniony dom (Wrotycze E): otwory 20 (10 okien, 10 drzwi; przeszklenie salonu i drzwi tarasowe na ścianie
wschodniej), dach 2 połacie z sygnałem `ROOF_EVIDENCE_DISAGREES`, 1 narysowana bryła poza modelem i 1 nazwany obszar
niezbudowany (`READING_PARTIAL`) — wynik `PARTIAL_3D_PREVIEW`, ilości `LIMITED`. Użyteczność: pokrycie i skala
wiarygodne; układ wnętrza częściowy (§1a).

## 7. Świeża próba (12 nowych rodzin, zamrożona)

Lista pobrana po zapisaniu reguły (`PROTOCOL_V35312.md`, `sha256 ff4940a5…`), oczekiwania spisane z samych rzutów
i zapieczętowane przed otwarciem wyniku (`sha256 b5a8dbcd…`, 07:34:27 UTC). Obie rewizje na tych samych bajtach.

* Cecha (grafika na linii całkowitej): oczekiwano LIKELY 1 (Atolach SE), POSSIBLE 4. Przesiew: nowe linie w 6 domach —
  5 planów sytuacyjnych (Fantazje, Turkusy, Dalbergie, Drosery, Jonagoldy) i ramka `rzut` Turkusów (88 px, bez odczytu);
  Atolach — **brak** nowej linii (przewidywany kontakt nie przerwał linii albo nie dotyczy linii wymiarowej).
* Aktywacja w modelu: **0 / 12** — wszystkie 12 wyników identycznych na obu rewizjach. Brak aktywacji = brak dowodu
  przeniesienia; wynik liczę jako stabilność, nie poprawę.
* Kryterium wymiarów (±6 % od wydrukowanych sum): 9 OK, 1 poza (Wrzosy 2 M: 9,12 wobec 10,12 m — rząd `912+100`, w obu
  rewizjach), 2 odmowy (Dziurawce, Perełkowce 3) — tak samo w obu rewizjach.

## 8. Nazwane ryzyko złączenia (do następnego etapu)

Złączenie nie widzi kreski całkowicie zakrytej rysunkiem. Na rzucie Stellarie górny rząd `1010 | 690` ma środkową
kreskę pod roślinką; dwa kawałki (każdy z jedną własną kreską) złączyły się w linię 2‑kreskową na całą szerokość
(650 px). Najbliższa etykieta `1010` przypięła się do niej jako `UNCENTRED` (przesunięcie 0,21) i została odrzucona
przez skalę arkusza (1,55 wobec 2,706 cm/px); żadna kotwica ani model się nie zmieniły. W 150 + 12 domach to jedyny
taki przypadek wśród nowych linii z przypiętym odczytem. Bezpiecznik, który wystarczyłby w tej klasie: na linii złączonej
przez zakrycie przyjmować wyłącznie etykietę wyśrodkowaną na całej rozpiętości (`PRIMARY`) — wymaga przeniesienia znacznika
„złączona przez zakrycie” z linii do wiązania; nie wprowadzony w tym etapie (zmiana wiązania = osobna regresja).

## 9. Testy, typy, kontrakt

* `npm run typecheck` (repozytorium i `apps/web`) na `9d8fbca`: bez błędów.
* Testy przyczyny i kontrprób: `covered-runs-v35312.test.ts` 8/8; `packages/source-metrics` 413/413.
* Macierz pakietów objętych zmianą (`packages/source-metrics`, `packages/reconstruction`, `packages/analysis-service`,
  `apps/local-analyzer`, `apps/analyzer-api`, `tests/architecture`) na `9d8fbca`, całość pod Node 18.20.4 przy
  równoległej regresji (obciążenie ~9 na 4 CPU): **2784 testy, 2733 zielone, 18 czerwonych, 7 pominiętych**. 18 = **13
  znanych z listy bazy** + 5 środowiskowych, każdy sprawdzony: `worker` ×2 (limit 120 s w harnessie przy obciążeniu —
  identycznie czerwone na drzewie bazowym przy tym samym obciążeniu; zielone 3/3 po regresji), `fixtures-v2` „seals
  every fixture” (limit czasu przy obciążeniu; zielone 15/15 po regresji), 005R „queue rebuilds byte-identically” i NFD
  „for every code point” (oba czerwone pod Node 18 także na drzewie bazowym; zielone pod Node 22). **Żaden czerwony test
  nie wynika ze zmiany.**
* Migawka kontraktu Androida odtworzona z bajtów serwera (`capture-android-contract.ts`): zmieniają się wyłącznie
  `candidateHash` i `metricEvidenceHash` (wersja topologii w dowodach), `modelHash` bez zmian; test kontraktu 4/4 na
  `9d8fbca`.

## 10. API (próba v3.53.11 osobno)

Bez płatnych wywołań: brak dostępnego bezpiecznego sekretu i uzgodnionego rozliczenia w jednej księdze. Księga
`research/ai-assist/spend-ledger.json`: 92 wpisy, 2,72807938 USD, limit 5 USD od E12 — bez zmian. Warianty **B i C nie
zostały zmierzone**; roboczy szacunek B+C 0,151 USD przy rezerwacji 0,856 USD, bez potwierdzenia kosztu. Gotowa
instrukcja i harness: `research/source-to-model/s5311/evidence-questions/README.md` (jedna komenda na hosta). Bez H2,
bez prywatnego benchmarku, ForgeShape tylko do odczytu.

## 11. APK 1338 i przebiegi z bundla

* `BuildPlan-Model-Preview-arm64-v8a-debug.apk`, versionCode **1338** (`0.1338.0-owner`), z `9d8fbca`, podpis
  `6e48fac4…ca0da` (ten sam), `sha256 a1a0303366c022dd3c6faddc4f807c2a014d9441c50d34addbb8469d024cc86b`; manifest bundla
  12/12; w `analyzer.mjs` `DIMENSION_TOPOLOGY_VERSION = "1.5.0"` i `joinCoveredRuns`, solver 2.42.0.
* Launcher produkcyjny z bundla (Node 18.20.4 z symulacją braku ICU, `main.mjs --job --url`), od `hello` do `done`:
  - Wrotycze E: 298 s, 833 MB, `modelHash 3ca6e769ee60` (= produkcja hosta), scena wczytana (114 siatek),
    `PARTIAL_3D_PREVIEW`, MATCHES 150,11/159,28, MEASURED 2,409 (STRONG), `LIMITED`.
  - Gaury 5 (kontrola, podcień): 422 s, 929 MB, `d4817e71600c` (= 1337, `model.json` bajt w bajt), scena wczytana
    (133 siatki), `COMPLETE`, `USABLE_IN_SCOPE`.
* Interfejs Android: **NOT_VERIFIED** (brak urządzenia, brak `/dev/kvm`).

## 12. Odtworzenie i paczka prywatna

Paczka prywatna `BuildPlan-v3.53.12-Prywatny.zip` (poza Gitem): plansze ŹRÓDŁO | PRZED | PO (Wrotycze E, Supertunie 2 E,
Torenie 3, Stellarie — kontrola, Gaury 5 — kontrola; jedna rama pikseli rzutu, wspólna kamera i skala 3D obu wersji,
elewacja/przekrój obok, legenda, odmowa w całości), tabele (regresja 69, przesiew 150 i 12, aktywacja, próba),
zapieczętowane oczekiwania, modele Wrotycz PRZED/PO, `SHA256SUMS`. Narzędzia w repozytorium:
`research/source-to-model/s5312/pair-views.ts` (wspólna kamera), `boards.py` (plansze; obrazy wydawcy zapisuje poza
repozytorium). Przesiew linii: ta sama maska i raster co ekstraktor (`adaptiveInkMask` → `findDimensionLines`) na każdej
ramce obu drzew; regresja: ścieżka produkcyjna offline z cache bajtów.

## 13. Zakres i następna blokada

Zakres: jedna zmiana detekcji (`joinCoveredRuns`, topologia 1.5.0); odczyt cyfr, ensemble, wybór obserwacji, arbitraż
skali i solver bez zmian. Wynik: 1 dom z odmowy do modelu w regresji 150 + 12, bez pogorszeń; przeniesienie na nowe
rodziny niepotwierdzone (0 aktywacji). **Następna blokada:** arbitraż odczytu i skali przy błędnym odczycie siatki
(Supertunie: `1350→1150`, `690→640`, wybór `SCALE_RANKED`, znacznik `TEXT_INK` dzielący łańcuch) oraz arbitraż skali
Torenii — osobny etap z własną regresją; w tym samym etapie bezpiecznik wiązania dla linii złączonej przez zakrycie (§8).
