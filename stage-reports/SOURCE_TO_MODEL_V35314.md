# BuildPlan v3.53.14 — niezależne dowody skali i granice obrysu

Baza: APK 1339 z `459cc2d` (kod `5240d7e`: solver 2.43.0, topologia wymiarów 1.6.0, solver metryczny 1.8.0, resolver
planu 1.6.0, usługa 1.11.0). Bez płatnych wywołań (księga 2,72807938 USD, 92 wpisy — bez zmian), bez H2 i prywatnego
benchmarku, ForgeShape tylko do odczytu; eksperyment API B/C osobno. Źródła, plansze, diagnostyki i paczka — prywatnie,
poza Gitem. Interfejs Android: **NOT_VERIFIED**.

Protokół zapisano prywatnie przed jakąkolwiek zmianą (`sha256 0b5406141b2c5921…`, 2026-11-15 06:07 UTC).

**Werdykt: bez zmiany produkcyjnej i bez APK 1340.** Kryterium wydania z §0 (poprawa ścieżki normalnej na domu
odłożonym albo usunięcie konkretnego błędu gotowej sceny) nie jest spełnione przez żaden zbadany mechanizm:

* **Supertunie 2 E — pierwsza przyczyna to obrys, nie skala.** Przy ręcznie potwierdzonej metryce obu osi (diagnostyka
  D2) odmowa zostaje ta sama co w produkcji: `PLAN_NO_WALLED_ENVELOPE`. Nawet z ręcznie zadaną obwiednią (D2b) układ
  jest odrzucany: 66,4 / 93,56 m² (−29 %), `PLAN_LAYOUT_REJECTED`. Za obwiednią stoją jeszcze co najmniej trzy decyzje
  obrysu, więc przyjęcie odczytu 690 nie zmieniłoby sceny. Zmiana dopuszczenia nie ma zatem uzasadnienia. Wycinek
  geometrii odłożony z konkretną przyczyną (§3).
* **Calandivy — odczyt kopii niewybranej nie zmienia sceny.** Kopia poprawiona w 1339 to kopia z tabelą powierzchni
  (ten sam druk). Scena powstaje z kopii z wymiarami, która była CONFIRMED STRONG 2,680 już w 1338. Model jest bajt
  w bajt ten sam (`bdd1e562ccd66ceb`).
* **Nolany 2 — garaż 6,49 vs ≈ 7,00 m to dekompozycja.** Wymiar 700 jest przypisany poprawnie, a położenie ramy
  i skala są poprawne. Pas prawej ściany garażu (z drzwiami bocznymi) trafia na zewnątrz. Przyczyna nie jest wspólna
  z Supertuniami, więc dowód zostaje na później, bez zmiany.
* **Torenie 3 — kontrola.** Skala MEASURED 3,1277 i jawnie brakujące pomieszczenia 1 i 7 bez zmian (kod bez zmian).

Odtworzono 8 rekordów dowodów 1339 utraconych przy pełnym dysku, z pełnymi hashami (§6).

---

## 0. Korekta raportu v3.53.13

* **Supertunie: „690 nie jest potwierdzające na ramie głównej” — nieprawda.** Na ramie `…d7b5041aad` czytnik zewnętrzny
  czyta `690` z posterior 0,998965, meanP 0,999706, stabilnie. Ensemble podejmuje decyzję **CONTESTS z rywalem 690**,
  a rywal jest ustawiany tylko wtedy, gdy odczyt zewnętrzny jest potwierdzający. Odmowa nie wynika z braku
  potwierdzenia. Wynika z tego, że obserwacja metryczna powstaje tylko dla odczytu siatki (`640`). Rywal `690` jest
  alternatywą (`altCost`, wybór SCALE_RANKED przy danej skali), a nie świadkiem własnej hipotezy (§2).

## 1. §0 Q0 — czy poprawa znika w LOCAL

Bundle z wydanego APK 1339, uruchomiony na żywych stronach (Node 18.20.4, symulacja bez ICU), daje dowody metryczne
identyczne z produkcją na zapieczętowanych bajtach:

| dom | contentHash dowodów | model | rozpoznawacz / ekstraktory |
| --- | --- | --- | --- |
| Torenie 3 | `1020fbe257166f11` = produkcja | `4ab60f2816` = produkcja | `ocr.ppocrv6-tiny-rec@9ef676d6`, onnxruntime-web 1.30.0; numeric-ocr 1.13.0, topology 1.6.0, independent-scale 1.8.0, ocr-ensemble 1.0.0; solver 2.43.0 |
| Wrotycze E | `840e3dbe2bacf4e4` = produkcja | `3ca6e769ee` = produkcja | jw. |

Wejście OCR czyta piksele (rozpoznawacz z bundla, nie cache). **Poprawa z 1339 nie znika w LOCAL.**

## 2. Łańcuchy odczyt → dopuszczenie → wiązanie → kopia → skala → obrys → scena

Wszystkie dane pochodzą z przebiegów 1339 z pełnym przejściem OCR. Supertunie, Calandivy i Torenie to `dev-var`,
Nolany 2 to dowód z `keep-evidence/var`. Narzędzie `chain.py` jest prywatne, a pełne listy odczytów są w paczce.

### Supertunie 2 E (odmowa)

* **Odczyt.** Szerokość leży na linii `chain-horizontal-20-96cdc667f6` z kreskami 159,5 (TICK), 307 (QUESTIONABLE —
  tusz etykiety) i 464,5 (TICK), na rozpiętości 305 px. Etykieta stoi w x 297–319, y 0–14.
  * Siatka czyta `640` (SUPPORTED). Czytnik zewnętrzny czyta `690` (0,998965).
  * Wysokość leży na linii `chain-vertical-111-e21b861847`, 160–762 px (602 px). Siatka czyta `1150` (AMBIGUOUS),
    czytnik zewnętrzny `1350` (0,9999).
* **Dopuszczenie.** `640`/`690`: CONTESTS — oba zostają kandydatami. `1350`: LEADS, INDEPENDENT.
* **Wiązanie.** Obie liny PRIMARY na pełnej rozpiętości (przesunięcie 0,013). Obserwacja `…641-horizontal-ae8c754532`
  = `640`, AS_READ, **REJECTED** (rezyduum 30 px przy 1,91). `690` nie tworzy obserwacji, tylko alternatywę.
* **Skala ramy.**
  * Hipoteza 2,098 (`640`/305, 1 świadek). Hipoteza 2,2425 (`1350`/602, 1 świadek). Głos strony 1,91 bez własnego
    odczytu.
  * V-SEL nazywa spór „dwa odczyty tego samego tuszu”, więc wynik to LEGACY_UNCONFIRMED INCONCLUSIVE.
  * `690`/305 = 2,262 cm/px wobec 2,2425: zgodność 0,9 %. Na tej skali `690` leży 2,7 px od kresek.
* **Kopie.**
  * `…af966a5fc9`: inna rozdzielczość tego samego druku. Tam `690`/196,5 i `1350`/388 liczą się obie (ADDED STRONG
    3,48). Kopie jednego druku liczą się raz.
  * `…4307e`: NO_SCALE (2,2425 vs 2,098).
  * Najlepszy odczyt resolvera: kopia `af966a5fc9`, zasięg łańcuchów, skala zarejestrowana.
* **Obrys.** `PLAN_NO_WALLED_ENVELOPE`. **Scena:** odmowa `METRIC_RESOLUTION_INCONCLUSIVE` (z obrysem w nawiasie).

### Calandivy (próba 1339: poprawiona kopia)

* **Odczyty na kopii z wymiarami `…9d55a6c7b9`.** Oba czytniki zgodne (AGREES):
  * `1680`/626,5 px: PRIMARY, ACCEPTED, INDEPENDENT.
  * `1160`/433,5 px: INDEPENDENT.
  * `850`/317,5 px: ACCEPTED.
  * Odczyty odwrócone (`0841`, `0411`, `048`) mają NO_VALUE i nie wchodzą.
* **Skala.** CONFIRMED STRONG 2,680 w 1338 i w 1339.
* **Kopia z tabelą powierzchni `…ded9bd11a2`** (ten sam druk, te same rozpiętości w px): LEGACY 2,554 → **REPLACED
  STRONG 2,680** (`1160` przestaje być neutralny — V-SEL).
* **Wybór kopii.** Resolver buduje z `…9d55a6c7b9` w obu wersjach.
* **Scena.** Model `bdd1e562ccd66ceb` jest identyczny w obu wersjach.
* **Pozostała różnica.** Głębokość 15,59 m wobec 16,80 m (−7,2 %, T-DIM) — obrys, poza zakresem.

### Torenie 3 (próba 1339: poprawiona skala)

* **Odczyty na ramie `…1e294dfcda`.**
  * Świadkowie:
    * `1160`/371: AGREES.
    * `1250`/399: siatka `1790` → zewnętrzny `1250`, LEADS.
    * `520`/166: siatka `110` → `520`, LEADS.
    * `308`/99,5: NOT_CORROBORATING, a odczyt siatki przyjęty.
  * Wszystkie cztery: INDEPENDENT, SUPPORT.
  * Rywal: `430`/108 (siatka `470` → `430`, LEADS) — CONFLICT, wymiar pomieszczenia we wnętrzu.
* **Skala.** REPLACED STRONG 3,128 (4 niezależne, rywal 7 %).
* **Inne kopie.** `…173d6c8bab` CONFIRMED STRONG 2,019 (`1250`/619, `1160`/574,5 — inna rozdzielczość). `…b25938bca2`
  LEGACY 1,90.
* **Arbitraż.** V-TOR zatrzymuje 3,128 wobec rywala 3,98.
* **Obrys.** Pierwszy odczyt `PLAN_NO_WALLED_ENVELOPE`. „Largest-first” daje 81,6 / 99,16 m² (NEAR), 2 bryły.
* **Scena.** Model MEASURED 3,1277, ilości LIMITED. Pomieszczenia 1 i 7 (≈ 18 m², prawy dół) jawnie brakujące, taras
  otwarty.

### Nolany 2 G2E (odzyskany model 1339)

* **Odczyty na ramie `…830ba06b87`.**
  * `1820`/659,5: oba czytniki zgodne. Wiązanie AMBIGUOUS — linia o kreskach 85,5 | 446 | 696 | 745. Mimo to SUPPORT.
  * `1820`/610,5: ALTERNATIVE.
  * `1470`/532,5: siatka `1170` → zewnętrzny `1470`, LEADS, PRIMARY, ACCEPTED.
  * Dalej `470`/170, `100`/36,5, `150`/54, `130`/48.
* **Skala.** 1338: LEGACY 2,270 (głos 2,197, 5 niezależnych „nie przeważa dwukrotnie”). 1339 (V-SEL): **REPLACED
  STRONG 2,769 / 2,761**.
* **Kopie.** Kopia z tabelą `…955fe116e9`: WEAK → STRONG 2,775 (ten sam druk).
* **Obrys.** 206,3 / 215,56 m² (MATCHES). **Scena:** model, ilości USABLE_IN_SCOPE.
* **Pozostały błąd sceny.** Szerokość garażu — §4.

## 3. Supertunie — skala oddzielona od obrysu (diagnostyki, nie produkt)

**D1** (potwierdzony odczyt przekazany samemu rozstrzyganiu skali) nie był uruchamiany osobno. D2 wstawia silniejszą
interwencję: metrykę potwierdzoną drukiem na obu osiach. Obrys liczy się w pikselach, niezależnie od skali. Skoro D2
kończy się na obrysie, D1 — co najwyżej z tą samą skalą — nie może dać więcej.

**D2 — metryka ręczna.**
* Rejestracja ramy `…d7b5041aad` podmieniona na mpp X 0,022439 / Y 0,022425 (REPLACED STRONG, 2,2439 / 2,2425 cm/px).
* Proweniencja zamrożona: `sup-confirmed-metric.json`, sha256 `763d6469…`, dopisek „DIAGNOSTIC v3.53.14 … not a
  product result”.
* Wynik: `RECONSTRUCTION_FAILED / PLAN_NO_WALLED_ENVELOPE`: „18 wall bands … do not span a box on both axes”.

**Pierwsza utrata dowodu obrysu** (oryginalny rzut, 853 px, ściana 20 px):

* Długie pasma (≥ 2,5 × ściana): lewa ściana V 157–177 / y 172–700, prawa V 435–469 / y 37–741, dolna elewacja
  H 255–444 / y 742–762. Na osi poziomej jest **jedno** długie pasmo, więc `axisBox` ma wysokość jednej ściany i
  `walledEnvelope` zwraca null.
* **Górna elewacja** to przeszklenie 530/405 między dwoma filarami narożnymi o szerokości ~35 px (krótszymi niż
  50 px). Nie daje żadnego pasma poziomego.
* **Prawa ściana boczna** jest scalona z żaluzją tarasu i drzewami (pasmo zaczyna się przy y 37, a lewe przy y 172).
  Reguła 005B („obie ściany boczne kończą się razem”) nie zachodzi. 005B wymaga też filara na linii frontu i pudła
  zakończonego na ściance działowej. Nie zachodzi żaden z trzech warunków.
* Zamknięcie szerokich przeszkleń z v3.53.9: **brak przypadków, a nie zbyt wczesne odrzucenie.**
  * `collinearWideGaps` szuka przerwy między dwoma kawałkami ściany na linii elewacji.
  * Filary narożne istnieją tylko jako końce pasm bocznych, więc na linii y 160 nie ma żadnego kawałka.
  * To samo dotyczy okna 200/140 w dolnej elewacji.
* Granica z obu stron: część zamknięta (y 160–762) jest do odzyskania, a taras (y 20–160, słupki, drzewa, żaluzje)
  ma zostać otwarty.

**D2b — metryka ręczna i ręczna obwiednia** 157,160–465,762 px. Łatka diagnostyczna nigdy nie trafiła do commitu
(`DIAG-envelope-override.patch`, sha256 `7bca7d88…`).
* Siatka obejmuje cały dom, taras zostaje na zewnątrz.
* Obwiednia przyciąga się do linii 168 / 453,5, czyli do lic wewnętrznych. Linie zewnętrzne 159,5 / 464,5 z łańcucha
  690 są wycięte przy przerzedzaniu.
* Dolny pas 1,1 m wychodzi jako osobna bryła, bo okno 200/140 nie jest zamknięte. Szerokie otwory: 0.
* Odczyty przy skali zarejestrowanej: 66,4 i 65,7 m² (−29 %, WRONG, DEGENERATE_GEOMETRY). Najlepszy, przy 2,098:
  69,5 m² (−25,7 %).
* Wynik: `PLAN_LAYOUT_REJECTED` (sha256 `513b784f…`).

**Wniosek.** Obwiednia jest pierwszą z co najmniej czterech decyzji obrysu: obwiednia, lica zewnętrzne, okno w dolnej
elewacji, podział bryły. Mechanizm „przeszklony front między wspólnymi końcami ścian bocznych” występuje w korpusie
jeszcze raz, w Nad Rzeczką 2 E. Tam oba długie fronty to przeszklenia między krótkimi odcinkami. To również
`PLAN_NO_WALLED_ENVELOPE`, ale w nawiasie odmowy skali — dom nie ma rozstrzygniętej skali. Mechanizm da się ocenić
niezależnie od metryki, bo obwiednia liczy się w pikselach. Żaden z dwóch domów nie dostałby jednak sceny po samej
zmianie obwiedni. Każde rozluźnienie 005B osłabia też ochronę otwartej loggii i tarasu: „ściany boczne bez niczego
w poprzek” to dziś definicja otwartego wylotu. **Wycinek odłożony.** Przyczyna: górny front bez pasma i prawe pasmo
scalone z tarasem, a za obwiednią kolejne blokady wykazane w D2b. Nie wymuszano wyniku powierzchnią katalogową,
domknięciem wszystkich luk ani wyłączeniem odmowy.

**Przyjęcie 690 jako świadka** (§1.2 polecenia) nie było więc wdrażane. Według D2 żadna zmiana dopuszczenia nie
zmienia sceny. Wariant środka szerokiej kreski (V-MARK) nie był badany ponownie: nie wpływa na decyzję, bo skala nie
jest blokadą, a 0,9 % między 690 i 1350 już mieści się w zgodności. Globalny V-MARK nie wrócił. Ochrona V-JOIN została
nietknięta.

## 4. Kontrole

* **Nolany 2 — wymiar 700, prawa strona garażu i sąsiednie lico** (plansza `03-nolany-garaz`).
  * 700 na linii y 739 między kreskami 445 i 697 (252 px × 2,762 = 6,96 m), PRIMARY ACCEPTED — przypisanie poprawne.
  * Prawa ściana garażu: pasmo V 682–698 (y 510–611), niżej drzwi 90/210. Jej lico zewnętrzne 697–698 = koniec
    wymiaru 700.
  * Bryła garażu `mass-1` = x 441–680, czyli kończy się na licu **wewnętrznym**. Pas 680–697 sklasyfikowany jako
    zewnętrze, a lewa ściana wliczona. Różnica 0,47 m (grubość ściany) plus zaokrąglenie wyjaśnia 6,49 vs 7,00 m.
  * Przyczyna: **dekompozycja** — przynależność pasa ściany z drzwiami. Nie jest to przypisanie wymiaru ani położenie
    ramy, a przyczyna nie jest wspólna z Supertuniami.
* **Torenie 3, Wrotycze E, Stellarie G2E (wiersz 1010 | 690), otwarty portyk Gaury 5.** Kod produkcyjny bez zmian, więc
  wyniki są identyczne z 1339 z definicji (hashe modeli w raporcie v3.53.13). Bez nowych przebiegów.

## 5. Tabela przyczyn

| dom | pierwsza przyczyna | automat (1339) | diagnostyka | skutek dla zmiany |
| --- | --- | --- | --- | --- |
| Supertunie 2 E | **obrys**: brak pasma górnego frontu (przeszklenie między filarami), prawe pasmo scalone z tarasem → brak obwiedni | odmowa (skala INCONCLUSIVE; obrys PLAN_NO_WALLED_ENVELOPE) | D2 metryka ręczna: ta sama odmowa obrysu; D2b + obwiednia ręczna: 66,4/93,56 m² (−29 %), PLAN_LAYOUT_REJECTED | odłożone z przyczyną; dopuszczenie 690 bez wpływu na scenę |
| Calandivy | brak — kopia poprawiona to kopia z tabelą powierzchni tego samego druku | model `bdd1e562ccd66ceb` | nie trzeba: odczyt kopii niewybranej jest już w produkcji, model identyczny | brak |
| Torenie 3 | obrys: pomieszczenia 1 i 7 brakujące (jawnie) | model MEASURED 3,1277, 81,6/99,16 m², LIMITED | — | kontrola |
| Nolany 2 G2E | dekompozycja: pas prawej ściany garażu na zewnątrz | model 206,3/215,56 m², garaż 6,49 m | — (bez zmiany) | dowód zostawiony na później |

Liczniki osobno: poprawiony odczyt 0, wiązanie 0, dopuszczony niezależny dowód 0, wybrana kopia 0, skala 0, obrys 0,
gotowa scena 0, zmiana pewności 0. Diagnostyki: 2 (D2, D2b), obie oznaczone.

## 6. Odtworzone rekordy 1339

W 1339 zabrakło miejsca na dysku i 8 rekordów `keep-evidence` nie zostało zapisanych. Produkcja par istniała, brakowało
dowodów metrycznych.

Odtworzono na tych samych bajtach (`metrics.ts`, produkcyjne przejście metryczne z rozpoznawaczem; jeden cache odczytów
dla obu drzew). Kod 1339 = `06fc6dd`, kod 1338 = `9d8fbca`. Supertunie i Wrotycze pochodzą z przebiegów DEV z pełnym
przejściem OCR. Pełne hashe plików są w `rebuild-compare.txt` w paczce. **Odtwarzalność:** dla dwóch domów zachował się
oryginalny dowód 1338 (Pod Jodłami 5, Jałowce 3) i odtworzenie jest z nim **bajt w bajt identyczne** (sha256
`8ec541ef…0b85`, `e3c0cf94…8108`). Dowód 1339 Wrotycz (`contentHash 840e3dbe…`) = przebieg z bundla APK 1339 (§1).

| dom | sha256 dowodu 1338 | sha256 dowodu 1339 | zmiana w dowodzie | produkcja 1338 → 1339 |
| --- | --- | --- | --- | --- |
| Gały | `e8e4d165…70eb` | `efb3a213…91c8` | rama `…8eb7872cfe`: REPLACED SUPPORTED → **STRONG** 3,0734 (skala ta sama) | odmowa PLAN_RESOLUTION_INCONCLUSIVE = ta sama |
| Peperomie 4 | `c22c8116…b2a3` | `a740068c…311d` | tylko treść rozwiązań (listy/uzasadnienia), relacja, pewność i skala bez zmian | model `76a16add7c24` = ten sam |
| Pod Jodłami 5 | `8ec541ef…0b85` | `8aaff273…570b` | jw. | model `9e98d601fd2f` = ten sam |
| Goldstary 2 | `d2f3b0bc…9e2b` | `1bd3d905…a2d7` | jw. | odmowa PLAN_RESOLUTION_INCONCLUSIVE = ta sama |
| Itea G2 | `edb029b6…dcfc` | `5a51e60a…daac` | jw. | model `b567d7e15bad` = ten sam |
| Jałowce 3 G2 | `e3c0cf94…8108` | `99f76223…6a29` | jw. | model `8918d0ed7b79` = ten sam |
| Supertunie 2 E | `076080cf…12ac` | `016dafc0…b516` | jw. (spór nazwany w uzasadnieniu) | odmowa = ta sama |
| Wrotycze E | `eed95aa6…0e59` | `35d81680…dacf` | jw. | model `3ca6e769ee60` = ten sam |

Wynik zgadza się z bilansem raportu v3.53.13: w tych 8 domach nie ma zmiany modelu ani odmowy. Jedyną zmianą pewności
jest Gały (SUPPORTED → STRONG), jak podano wtedy.

## 7. Czego nie zrobiono i dlaczego

* Nie ma zmiany produkcyjnej, więc nie ma macierzy, sprawdzenia typów ani nowego kontraktu. Nie powstał APK 1340 ani
  przebieg bundla 1340. Obowiązuje APK 1339.
* Nie było regresji na korpusie 162 ani nowych rodzin świeżej próby. Bez wariantu nie ma czego porównywać: reguła
  doboru świeżych rodzin była zapisana w protokole, ale żaden wariant nie powstał.
* Referencje bez zmian: korpus 80 — 67 modeli i 13 odmów, tabela pomieszczeń 99/169.

## 8. Dalej

1. Obrys przeszklonego frontu, wspólnie dla Supertunie i Nad Rzeczką 2. Potrzeby:
   * dowód frontu inny niż filar (kreska szklenia i opis okna między wspólnymi końcami ścian bocznych), z ochroną loggii
     i tarasu;
   * rozdzielenie pasma ściany bocznej od żaluzji i drzew tarasu;
   * lica zewnętrzne zamiast wewnętrznych przy przyciąganiu obwiedni;
   * okno w elewacji z obwiedni.
   Oceniać przy skali automatycznej i ręcznej, na obu domach i na kontrprzykładach z otwartą loggią.
2. Garaż Nolany 2: przynależność pasa ściany z drzwiami bocznymi do bryły, której jest ścianą.
3. Calandivy: głębokość −7,2 % (T-DIM).
