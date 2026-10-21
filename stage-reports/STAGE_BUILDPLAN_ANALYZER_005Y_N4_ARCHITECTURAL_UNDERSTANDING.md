# BUILDPLAN-ANALYZER-005Y-N4 — rozumienie architektoniczne oparte na źródłach, nie poprawki pod projekt

**Status: PARTIAL_SOURCE_GROUNDED · OWNER_VISUAL_PENDING · STOP.**
Nie deklaruję ALL_GREEN ani OWNER_ACCEPTED — ocena zrzutów należy do OWNER-a. Bez APK, bez wydania, bez CI 41 zadań,
bez emulatora, bez scalania, bez PR. Projekt OWNER m3ea: **NOT_RUN** (brak wejścia; nie podstawiany pod Rarytasy 5
(G2E) DEV m84f).

| | |
|---|---|
| Repozytorium | `damiankrok/BuildApp` |
| BASE | `02cda69c6dbe4d94baf0db1bf22044606a91a0f8` (005Y-N3) |
| Gałąź | `analyzer/005y-n4-general-architectural-understanding-v1` |
| Lustro `claude/new-session-3kzcgh` | nietknięte: `bfaf286e95105c2cdb32df2d298d3cd93bd43449` |
| Domy | A01 (jarzmianki), Goździkowce 3, Marcówki (GE), Cieszynianki 12 (GE), Rarytasy 5 (G2E) DEV m84f |
| Analogi ARCHON | Dom w trytomach (G), Dom w arganiach (G2E), Dom w sasankach 3 (G) — te same co w N3 (Melisa 2 nie liczy się do schodów); żadnych nowych pobrań |

Wszystkie zmiany są ogólne: w kodzie nie ma nazw projektów, identyfikatorów `m…`, współrzędnych, liczby otworów ani
układu ścian konkretnego domu; żaden `model.json` nie był poprawiany ręcznie. Bitmapy wydawcy i wycinki leżą wyłącznie
poza repozytorium (`/home/user/work005yn4/src`, `…/ai/out`) i w prywatnym ZIP-ie.

## 0. Krok 0 — odtworzenie N3 i macierz dowodów

* Replay N3 na kodzie BASE odtwarza końcowe skróty N3 bit w bit: a01 `d67a026f8cf93dff`, gozd `b0eb6d82ae56b327`,
  marcowki `124e5abc5e6959d8`, ciesz `4de216ed46550423`, rary `f6886fd278755ee5`.
* Macierz dowodów (per objaw): `assetByteHash`, `frameId`, prostokąt w obrazie, prymitywy, kandydaci OCR, odrzucone
  hipotezy, transformacja, bryła/lico/połać‑gospodarz, id obiektów sceny, bbox 3D, proweniencja, FIRST_BAD, kontrfakt —
  w `research/analyzer-005y-n4/ledger.json` (`symptoms[]`). Dowody pikselowe (wycinki, nakładki) tylko w prywatnym ZIP.

## 1. Co zmieniono

### D — schody (Marcówki): spocznik o jedną głębokość stopnia za daleko, bieg w ścianie, ścianki pod biegiem

FIRST_BAD były trzy, w tej kolejności:

1. **Semantyka spocznika** (`packages/model/src/stair-layout.ts`). Model kładł po ostatnim podniesieniu biegu własny
   stopień o głębokości `going`, a dopiero za nim spocznik. Czytnik rzutu (`stair-topology.ts`) liczy krawędź spocznika
   jako ostatnie podniesienie biegu (tak rysuje rzut), więc każdy spocznik lądował o jeden stopień za daleko: schody U
   w Marcówkach miały 3,887 m głębokości w szybie 3,627 m — to jest „spocznik ~0,30 m za duży” (0,263 m = jeden
   stopień). Nowe, opcjonalne pole `LANDING.onRiser`: ostatnie podniesienie wchodzi wprost na spocznik, spocznik
   zaczyna się na tej linii podniesienia i podniesienie nie ma własnego stopnia. Domyślnie bez zmian (żaden istniejący
   model ani fiksura się nie zmienia); emiter ustawia je, bo kwadrat spocznika czytnika zaczyna się na ostatniej linii
   biegu. Liczba podniesień i ich wysokość bez zmian (17 × 0,180 m).
2. **Bieg w ścianach klatki** (`packages/reconstruction/src/v2/stair-fit.ts`, `fitStairToBoundingWalls`). Schody czytane
   z rzutu poddasza, ściany z rzutu parteru — każdy odczyt ma kilka pikseli niepewności rejestracji. Gdy obrys schodów
   wchodzi kilka centymetrów w ścianę lub komin **wzdłuż boku biegu**, schody są przesuwane z niego (≤ 0,15 m =
   niepewność odczytu) razem z otworem w stropie. Ściana, w którą stopnie *wchodzą* (pod startem lub wyjściem biegu),
   nie jest ścianą boczną — jest pod schodami. Gdy ściany po obu stronach zostawiają mniej miejsca niż schody zajmują,
   nic się nie rusza i konflikt jest nazwany; do 3 cm resztka jest dzielona po połowie i nazwana.
   Marcówki: przesunięcie (−0,037; +0,082) m od ściany zewnętrznej, `x-5` i komina; resztka 1,9 cm między kominem
   `chimney-1` a ścianą `x-0` po drugiej stronie szybu (nazwana, nie ukryta).
3. **Ścianki pod biegiem** (`followStairSoffits`). Pomieszczenie 5 i schowek `**` leżą pod biegami (rzut). Ścianki
   wewnętrzne stojące pod biegiem kończą się teraz na spodzie biegu, schodkowo jak go buduje kompilator (profil
   `POLYLINE`, bez zmian w schemacie). Nic nie jest usuwane. Ściana przecinająca najniższe stopnie (< 0,30 m), ściana
   z innym profilem albo taka, której otwory nie zmieszczą się pod obniżonym wierzchem, zachowuje wysokość i jest
   nazwana; ściana, którą schody tylko muskają (≤ 3 cm w grubość), nie jest obniżana.

Wynik Marcówki: INTERSECTION 7 → 1 (nazwana resztka 2 cm komin↔ściana), NON_MANIFOLD 0, COPLANAR 0, GAP bez zmian (35).
Testy: `stair-fit-005y-n4.test.ts` (10) — U z `onRiser` (2 szerokości + 6 stopni; bez `onRiser` 7), ściana boczna,
ściana pod startem/wyjściem, konflikt obustronny, rozdzielenie resztki, limit niepewności, profil schodkowy, ścianka na
najniższych stopniach (konflikt), ścianka muskana, i end‑to‑end przez kompilator (0 INTERSECTION).

**Analogi (schody):** Trytomach i Sasanki 3 mają schody zabiegowe (diagonalne linie w narożu). Czytnik drabinek gubi
je wcześniej niż jakakolwiek reguła N4: Trytomach — jedna drabinka (4 podniesienia, brak strzałki) → placeholder;
Sasanki 3 — żadnej drabinki → `MISSING`. `winderRegions` zostaje `[]`; zabiegów nie zmyślam. Arganie (G2E) jest
parterowy. **Test ≥3 różnych schodów na analogach: NIE SPEŁNIONY** — w danych wejściowych jest jeden zestaw biegów
odczytywalny end‑to‑end (Marcówki); pozostałe to nazwane odmowy z FIRST_BAD w `findTreadLadders`.

### C — wejście Rarytasów: drzwi zamiast okna, otwierane na zewnątrz

FIRST_BAD: `doorLeafDrawn` (`openings-v2.ts`). Rzut drukuje rozmiar drzwi w kółku obok — tu kółko „105/210” leży na
łuku skrzydła i tuż przy samym skrzydle. Test „łuk zatuszowany w ≥60 %” widział pod kółkiem papier, test „papier o dłoń
obok skrzydła” trafiał w okrąg opisu → brak symbolu drzwi → szczelina 1,05 × 2,10 do podłogi stawała się oknem.
Poprawka (`doorLeafFound`): próbki pod pudełkiem opisu są **niewidoczne** (ani tusz, ani papier); łuk ocenia się na
tym, co widać — połowa jak dotąd, albo co najmniej trzecia część zatuszowana prawie w całości (≥ 90 %). Bez
przesłonięcia test jest identyczny z 005Y‑N2 (eksperyment N3 „swing po licu zewnętrznym”, który zrobił z narożnika A01
drzwi, nie wraca: próg łuku nie zmienił się globalnie). Skrzydło mówi też, po której stronie ściany jest narysowane i
przy którym ościeżu wisi: otwór niesie `leaf {swing, hingeAt}`, emiter ustawia `swing`/`hingeSide` drzwi **wyłącznie**
z niego (`OUT` tylko z łuku + osi zawiasu).

Wynik: Rarytasy `opening-0-front-0-1` WINDOW → GLAZED_DOOR, `swing OUT`, zawias przy ościeżu o mniejszym x (lewym,
patrząc z zewnątrz — zgodnie z rzutem). Marcówki: wejście (do środka) dostało zawias prawy z rysunku zamiast
domyślnego lewego (sprawdzone na rzucie). A01, Goździkowce, Cieszynianki i analogi bez zmian. Testy:
`door-leaf-occluded-005y-n4.test.ts` (5) + niezmienione `door-leaf-005y-n2` (6).

Pozostaje (C): szkło skrzydła (rzut nie rozstrzyga szyby od progu — nazwane), doświetle i daszek/słup (widoczne na
elewacji, nie czytane — elewacja nie zwraca dla tego otworu odczytu), drzwi 100/210 w bocznej ścianie garażu: FIRST_BAD
to **zasięg bryły garażu** (ściana wschodnia garażu w modelu ~0,6 m za blisko), przez co czytnik widzi 3,8‑metrową
„przerwę” i kółko „471/71” (OCR) bierze za okno 4,21 × 0,71 — to jest fantom, nie poprawiany w N4. Kominy i dach
garażu bez zmian (2 kominy).

### A — okna połaciowe: pierścień ≠ środek okna, symbol rysunkowy

Hipoteza potwierdzona na Goździkowcach (prywatne nakładki): pierścień opisu leży przy okapowym końcu prostokąta okna;
wzdłuż kalenicy pierścień i prostokąt się zgadzają. `drawnRooflightSymbol` (`roof-details.ts`) szuka prostokąta
przerywanych linii o wymiarach z opisu (szerokość wzdłuż kalenicy, rzut długości w spadku ±20 %), ze środkiem pierścienia
wewnątrz i bokami na drukowanej szerokości; przyjmuje go tylko, gdy wyraźnie wygrywa z każdym innym kandydatem
(`SYMBOL_MARGIN`). Na pięciu domach **żaden** symbol nie przechodzi: krawędź od strony okapu pokrywa się z krawędzią
pasa przy okapie / tarczą pierścienia i nie da się jej oddzielić od mebli i kreskowania. Pozycje zostają z pierścienia,
niepewność jest jawna w `ROOFLIGHT_RING.why` i w manifeście. Liczby: A01 6/7 (7. pierścień w (328,485) na
`asset-rzut-cdc1c4ebd8` nadal niewykryty przez czytnik pierścieni), Goździkowce 7/7 — bez zmian. Testy:
`rooflight-symbol-005y-n4.test.ts` (prostokąt czytany, bliźniak = niejednoznaczność, brak/lity/poza = nic).

### E — AI_SECOND_LOOK

`packages/source-vision/src/second-look.ts`: na istniejącym `VisionReasoner` (zadanie `PLAN_INTERPRETATION`), tylko dla
oznaczonej niejednoznaczności: wycinek (hash bajtów wycinka) + `assetByteHash` źródła + 2–3 hipotezy **z czytnika
deterministycznego**. Odpowiedź to tekst w słowniku obserwacji (bez metrów, bez DSL), walidowany jak każda odpowiedź
wizji; wynik to rekord `AI_SAYS_X / CV_SAYS_Y` z trzema trybami obok siebie (CV only / CV+AI sugestia / CV+AI
zwalidowane własnym sprawdzeniem czytnika), proweniencja `AI_SUGGESTED`, nic nie jest stosowane do kandydata.
Dostawca zewnętrzny jest pytany tylko przy zgodzie OWNER-a (`BUILDAPP_AI_SECOND_LOOK_CONSENT=owner`) i kluczu; inaczej
`AI_SECOND_LOOK_LIVE_NOT_RUN` i nic nie opuszcza maszyny. Produkcja (`analysis-service`) bez zmian: `DETERMINISTIC_ONLY`.

Pytania z tego etapu (prawdziwe niejednoznaczności, wycinki prywatnie):

| Dom | Pytanie | CV | Hipotezy (z czytnika) | Wynik |
|---|---|---|---|---|
| Goździkowce | kółko przy narożnym oknie kuchni (pr. `metric-callout-ring-ba1359980c`) | odrzucone (700/40 nie pasuje do szczeliny) | 700/40, 200/40, 100/48 | `AI_SECOND_LOOK_LIVE_NOT_RUN` |
| Goździkowce | kółko przy bocznym kawałku narożnika (`…-dbb97112bf`) | odrzucone (416/147) | 416/147, 616/140, 46/142 | `AI_SECOND_LOOK_LIVE_NOT_RUN` |
| Rarytasy | kółko „471/71” przy fantomowej przerwie w ścianie garażu (`…-0fc852e6de`) | 421/71 (w 12 % szczeliny) | 471/71, 421/71, 571/71 | `AI_SECOND_LOOK_LIVE_NOT_RUN` |

W tym środowisku nie ma klucza i nie ma zgody — **AI nie dało żadnej odpowiedzi**. Ścieżka jest pokazana na replay
(fiksury ręcznie pisane dla syntetycznego wycinka, `second-look-005y-n4.test.ts`, 6 testów): zgoda/brak zgody, brak
klucza, AGREE, DISAGREE z walidacją i bez, AI_UNMATCHED, odpowiedź spoza słownika → REJECTED. Brak obietnic
multimodalnej AI offline na Androidzie; DETR nadal odrzucony.

### B — przeszklenie narożne bez słupa (Goździkowce): diagnoza, bez zmiany kodu

Nie zmieniałem kodu B. Ustalone FIRST_BAD dla narożnika kuchni Goździkowców (260/140 + 110/140), w kolejności:

1. **OCR szarych kółek**: „260/140” czytane jako `700/40` (pewność 0,26), „110/140” jako `416/147` (0,23); obie
   odrzucone przez bramkę szerokości — stąd domyślne parapet 0,9 / nadproże 2,2 zamiast wysokości 1,40. Bramek OCR nie
   luzowałem (reguła projektu); to jest przypadek dla AI_SECOND_LOOK (pytania wyżej), ale bez zgody nie ma odpowiedzi.
2. **Zasięg przerwy frontowej** 4,29 m zamiast 2,60: ściana pomieszczenia 3 narysowana jaśniejszym kreskowaniem nie
   przechodzi progu atramentu ściany, więc szczelina się przedłuża.
3. **Kontrakt narożnika bez słupa**: model wymaga materiału przy krawędzi otworu (`OPENING_TOUCHES_WALL_EDGE`), więc
   kwadrat narożnika zostaje słupkiem; relacja `CORNER_GLAZING` (N3) jest tylko adnotacją. Projekt (nie wdrożony):
   `cornerOpeningId` na złączu dwóch prostopadłych ścian — oba otwory deklarują wspólny narożnik, walidator zwalnia
   `OPENING_TOUCHES_WALL_EDGE` **tylko** przy tym końcu i tylko gdy oba otwory sięgają złącza, mają ten sam parapet
   i nadproże (±1 cm), a kwadrat złącza nie ma filaru w rzucie; kompilator wycina kwadrat złącza na wysokości otworu
   i stawia słupek tylko, gdy źródło go rysuje. Bez tej decyzji schematu każda „poprawka” byłaby wizualną sztuczką.

Rozdział kuchni od 70/210 na powrocie wnęki: w N4 nie ma zamiany (70/210 na powrocie wnęki nadal nie jest budowane —
jak w N2/N3); powrót wnęki może mieć własne otwory dopiero, gdy czytnik będzie czytał powroty.

## 2. Wyniki na pięciu domach (pełna ścieżka źródło→model→scena, offline)

| Dom | model przed → po | czas [s] | max przerwa heartbeat [s] | domknięcie przed → po | zmiana |
|---|---|---|---|---|---|
| A01 | `d67a026f8cf93dff` → `b740fc7d3697fa9e` | 367 | 1.95 | GAP 50, COPLANAR_DUPLICATE 4 → GAP 50, COPLANAR_DUPLICATE 4 | tylko tekst `why` okien połaciowych |
| Goździkowce | `b0eb6d82ae56b327` → `2e7c5ba6429bcd90` | 338 | 2.08 | GAP 66 → GAP 66 | tylko tekst `why` okien połaciowych |
| Marcówki | `124e5abc5e6959d8` → `2980cc9c19403b31` | 333 | 2.79 | INTERSECTION 7, GAP 35 → GAP 35, INTERSECTION 1 | schody (onRiser, dosunięcie), 4 ścianki pod biegiem, zawias wejścia |
| Cieszynianki | `4de216ed46550423` → `4de216ed46550423` | 199 | 2.14 | INTERSECTION 2, GAP 24, COPLANAR_DUPLICATE 2 → INTERSECTION 2, GAP 24, COPLANAR_DUPLICATE 2 | bez zmian (ten sam skrót) |
| Rarytasy DEV | `f6886fd278755ee5` → `c308cd0e2d47f87a` | 288 | 2.15 | GAP 19 → GAP 19 | wejście: drzwi OUT zamiast okna |

Okna połaciowe A01 6, Goździkowce 7; kominy, rodzaje dachu i liczby otworów bez zmian; NON_MANIFOLD 0 i diagnostyki kompilacji 0 wszędzie; żadnego nowego GAP ani INTERSECTION. Rarytasy: 116 → 118 siatek (skrzydło drzwi z ramą). Analogi (replay): Trytomach `047b0f1c27b1b2ce`, Arganie `34a95a766d169f39`, Sasanki 3 `947ea52be264d686` — bez zmian względem replay N3 na BASE.

## 3. Co dalej jest niepewne

* B w całości (OCR szarych kółek, zasięg szczeliny, kontrakt narożnika) — patrz wyżej.
* Okna połaciowe: pozycja wzdłuż spadku z pierścienia, nie z symbolu (rezyduum 0,13–0,17 m względem symbolu na
  Goździkowcach w odczycie ręcznym, prywatnie); 7. okno A01 nie wykryte.
* Schody: zabiegi nie są czytane; analogi z zabiegami odmawiają wcześniej (drabinki); resztka 2 cm w Marcówkach.
* Rarytasy: zasięg bryły garażu i fantom 471/71; doświetle, daszek i słup wejścia; szyba skrzydła.
* GAP z audytu domknięcia (a01 50, gozd 66, marcowki 35, ciesz 24, rary 19) — wcześniejsze, nie nowe; nie twierdzę
  „watertight”.

## 4. Odrzucone eksperymenty

* A — test linii po kontraście (linia ciemniejsza od otoczenia o 18): gubił krawędzie przy okapie, 0/13 symboli.
* A — wybór pary z najlepszym pokryciem bez wymogu środka pierścienia wewnątrz: na Goździkowcach wybierał meble
  (rezyduum −0,77 m) — odrzucone; teraz środek pierścienia musi leżeć w prostokącie.
* D — obniżanie każdej ściany zachodzącej na obrys: obniżało ścianę `x-0` na całej długości z powodu 2 cm resztki —
  zastąpione progiem „muskania” 3 cm.
* D — przesuwanie także przez ściany pod startem/wyjściem biegu: dawało sprzeczne ograniczenia (`z-3` pod wyjściem
  górnego biegu) — ściana, w którą stopnie wchodzą, nie jest boczna.

## 5. Bramki

* `tsc` (cały monorepo): 0 błędów.
* Testy zmienionych pakietów: `model`, `commands`, `geometry` 189/189; `reconstruction`, `architecture`, `reference-marcowki`, `editor` 1060/1060 (w tym nowe: stair-fit 10, door-leaf-occluded 5, rooflight-symbol 3); `source-vision` 42/42 (w tym second-look 6).
* 5 pełnych przebiegów produkcyjnych źródło→model→scena offline (OFFLINE=1, cache zapieczętowany, rozpoznawacz ORT): skróty identyczne z replay; max przerwa heartbeat 2,79 s.
* Bez CI 41 zadań, bez APK, bez emulatora (zgodnie z poleceniem).

## 6. Dysk

`/dev/vda` 252 G, użyte 37 G, dostępne < 1 G (limit sesji, nie awaria). Unikalne wejścia, których nie wolno usuwać:
`work005k`, `work005i-a`, `work005l/blind`, `work005r/corpus`, `work005yn3` (cache analogów, finały N3), `work005yn2/final`,
`work005y/src`. Wyjścia starszych etapów (`work005f` 2,9 G, `work005n` 2,1 G, `work005g`/`work005h` po 1,1 G, `/tmp/claude-0`
2,1 G scratchpadów) mogłyby zwolnić miejsce wyłącznie decyzją OWNER-a — niczego nie usuwałem. Własne artefakty N4
(`/home/user/work005yn4/replay/*` ~6 MB, `…/dist` 1,8 MB) są odtwarzalne i mogą zostać usunięte po przejęciu ZIP-ów.

## 7. Artefakty

* `renders-005y-n4.zip` — 5 domów × 8 widoków przed/po/porównanie (produkcyjny BuildWorld) + zbliżenia A–D przed/po.
* `models-005y-n4.zip` — `model.json` przed (N3) / po (N4) dla pięciu domów + README z mapą kamer.
* `debug-005y-n4-PRIVATE.zip` — tylko dla OWNER-a: wycinki źródeł, nakładki, wycinki pytań AI, manifest okien
  połaciowych, ślady FEATURE_DEBUG. Nie publikować.
* `research/analyzer-005y-n4/ledger.json`, `research/analyzer-005y-n4/second-look-run.ts`.
