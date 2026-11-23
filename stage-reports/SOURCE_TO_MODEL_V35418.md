# v3.54.18 — arbitraż elewacji i bryły: odczyt API jako obserwacja, LOCAL jako hipoteza, obraz źródła jako sędzia (OWNER 2026-11-23)

Gałąź `claude/new-session-3kzcgh`, baza R3 `3e395b7` (zamrożenie baseline: `37ad17c`). **Kod mierzony w próbie: `bc57767`.**
Po pomiarze doszła jedna poprawka niezawodności recenzenta (`e875ee0`, PROTOCOL §9) i dokumenty; host końcowy biegł
na `e875ee0`, APK jest z `ba41dbe` — ten sam kod analizy, dochodzą sceny aplikacji i testy ich kolejności (różnica
między tymi commitami nie dotyka `packages/analysis-service/src` ani `apps/analyzer-api/src`); późniejsze commity
zmieniają wyłącznie dokumenty. Bez merge i PR. Żadnych reguł od nazw domów (testy czystości przechodzą). ForgeShape tylko
do odczytu, H2 i benchmark OWNER-a nieotwierane. Klucz czytany wyłącznie z pliku sekretu hosta do środowiska procesu:
nie ma go w Gicie, logach, APK, zrzutach ani ZIP-ach (skan przed commitem i przed spakowaniem). Rysunki wydawców nie są
w repozytorium — tylko w prywatnej dostawie.

## 0. Werdykt (uczciwie, najpierw to, co się nie udało)

**Cel zapisany z góry nie został osiągnięty.** Protokół wymagał, żeby liczba „użytecznych rozpoznawalnych miniatur"
(surowa reguła z §3 protokołu) wzrosła na sześciu domach DEV-K + NEW-B o co najmniej 2 i na trzech ślepych domach NEW-C
o co najmniej 1. Wynik:

| Zbiór | Baseline → po zmianie (ocena autora) | Baseline → po zmianie (niezależny ślepy oceniający) | Cel |
|---|---|---|---|
| DEV-K + NEW-B (6 domów) | 2 → 2 | 1 → 2 | +2 — **nie osiągnięty** |
| NEW-C, ślepe (3 domy) | 0 → 0 | 0 → 0 | +1 — **nie osiągnięty** |

**Co się zmieniło mierzalnie** (niezależny oceniający, warianty X/Y bez wiedzy, który jest „po"):

- wariant po zmianie jest **bliższy źródłu w 7 z 9 domów, w 2 bez różnicy, w żadnym gorszy**;
- duże otwory poprawne: DEV-K 4/14 → **12/14**, NEW-B 8/17 → **11/17**, NEW-C (ślepe) 4/14 → **8/14**;
- forma na ślepych domach 3/12 → 5/12, bo **dom, który na kodzie bazowym kończył się NO_MODEL (Dom pod sakurą E), ma
  teraz model** z otworami frontu i tyłu — przyczynowo potwierdzone powtórką krzyżową (kod bazowy na tych samych
  odczytach, na których kod końcowy zbudował model: nadal NO_MODEL, 0 USD);
- otwory-widma na Alasce 13 → 0; na Alberto widm przybyło (4 → 8), bo otwory, których kod bazowy w ogóle nie pokazywał,
  teraz widać — razem z błędami LOCAL;
- znaleziono i usunięto błąd obecny także w baseline: **otwory istniały w modelu, a kompilator ich nie wycinał** (Alberto
  14, Ballina 3, Jeziorko 4, Alaska 2) — żaden widok ich nie pokazywał.

**Dlaczego reguła „użytecznej" nie drgnęła:** blokują ją pojedyncze cechy KEY, których ten etap nie rozwiązał —
drzwi wejściowe Alaski i Aurory (bramka źródła nie potwierdza ich na obrazie), bryła LOCAL z płaskimi przybudówkami
zamiast jednej bryły pod stromym dachem (Medulin, Mindelo), dach czterospadowy (Sakura, G6 — forma poza obsługiwanym
zakresem), zatłoczone elewacje z podcieniem (Alberto). Wszystkie są nazwane w §12 z miejscem pierwszej straty.

Koszt etapu: **4,951829 USD** (księga 29,500933 → 34,452762 USD, pułap 68,542857 USD, ta sama księga,
0 otwartych rezerwacji). Limit własny etapu 15 USD nie został zbliżony.


## 1. Problem

Po R2/R3 aplikacja potrafiła dla linku do projektu domu zrobić cztery wierne, kolorowe szkice elewacji (odczyt Claude API
jednego rysunku do typowanego JSON-a w pikselach oryginału), ale oddawany model 3D często tych szkiców nie przypominał:
Alaska bez drzwi wejściowych i z pasem okien zamiast czterech osobnych, Aurora z pasami okien z rzutu, Ballina bez okapu,
a dom, którego analizator lokalny (LOCAL) nie zbudował, dostawał szarą bryłę bez otworów i bez koloru. Pytanie etapu:
**dlaczego poprawny odczyt nie zamienia się w poprawny model i jak ułożyć współpracę analizatora z API, żeby więcej
poprawnych linków kończyło się rozpoznawalną, spójną, edytowalną kolorową miniaturą** — nie dla trzech znanych domów,
tylko dla nowych stron.

## 2. Rzeczywisty przepływ i miejsca pierwszej straty informacji

Prześledzony przepływ publiczny (host `apps/analyzer-api` → `consultAnalysis`):

```
URL → pakiet źródłowy (HTML + obrazy, role dokumentów) → LOCAL (runAnalysis: skala, rzut, bryła, otwory z rzutu)
    → odczyt metryki (API, metric-read/5: wymiary drukowane z końcami linii) → ponowny LOCAL na skali
    → szkice elewacji (API, elevation-sketch/2: ściany, dach, otwory, kominy, strefy wykończenia w pikselach kadru)
    → rejestracja szkicu na stronie modelu → propozycje (from-sketch) → wykonawca korekt (rejestr operacji,
      bramka źródła = pomiar na obrazie oryginału, transakcja, wycofanie)
    → spojrzenia recenzenta (API ogląda render dokładnie tej rewizji; continues/resolved; księga defektów)
    → stan jakości → przyjęta rewizja (ponowny link: 0 USD) → scena dla aplikacji
```

Dla każdego błędu z nagrań R3 (Alaska, Aurora, Ballina) i z pierwszych biegów trzech nowych domów na zamrożonym kodzie
bazowym znalazłem miejsce, w którym informacja była jeszcze poprawna, i pierwszą funkcję, która ją traciła:

| # | Objaw (dom) | Informacja była poprawna w… | Pierwsza strata (funkcja / dana) | Dowód z nagrania |
|---|---|---|---|---|
| 1 | Okna i drzwi ze szkicu nie wchodzą do modelu (Alaska: 21 z 21 poprawek otworów `SOURCE_UNDECIDED`) | szkic elewacji (prostokąty w pikselach oryginału) | bramka źródła `nullBand`: tło „tu nic nie stoi" liczone wyłącznie z miejsc wolnych od otworów **modelu**; na ścianie wypełnionej widmami LOCAL nie zostaje ≥ 8 miejsc → wynik nierozstrzygnięty z definicji | `corrections.json` R3: `nullBand: null` przy każdej poprawce |
| 2 | Dom bez modelu LOCAL dostaje gołą bryłę | szkice wszystkich stron | ścieżka `NO_LOCAL` nie ustawiała `sketchSummary`, więc konsument elewacji (otwory, kominy, okap) w ogóle nie startował | kod `consult-analysis.ts` @ `3e395b7` |
| 3 | Brak okapu, zły kąt dachu, orientacja `UNDECIDED` (Ballina: 3,26/3,28 m kontra 2,91/2,86 m; Alberto: 35° zamiast 25° ze strony) | szkic: ściany kończą się pod podbitką, dach osobnym wielokątem | okap „przy ścianie" czytany z **najniższej krawędzi wielokąta dachu** (deska czołowa, daszek podcienia), a nie z wierzchu ścian w narożach | `events.json` R3 Ballina: ORIENTATION_UNDECIDED |
| 4 | Okna połaciowe znikają | szkic (okno narysowane na dachu) | `from-sketch`: okno na dachu było pomijane — nie istniała operacja, która umie je postawić | `sketches.json`: `skipped: ROOF_WINDOW` |
| 5 | Dwie strony bez etykiety nadpisują się; perspektywa wśród elewacji blokuje przypisanie stron | rejestracja każdego szkicu z osobna | `decideSides`: brak reguły dla obrazu, który nie rejestruje się na żadnej wolnej stronie; brak nazwanej konwencji, gdy dowody nie rozstrzygają | Medulin, Alberto (baseline) |
| 6 | Zła bryła zostaje (Medulin: 4 człony, front 7,83 m przy drukowanych 9,25 m) | wymiary drukowane na rzucie, elewacje | bryła LOCAL była **nienaruszalną bazą**: żaden dowód spoza LOCAL nie mógł jej podważyć jako całości | `metric-read.json` + model baseline |
| 7 | Miniaturki stron (4 z 8 „elewacji" Medulina) szkicowane jak rysunki | pakiet (rozmiar kadru) | brak progu czytelności kadru przed płatnym odczytem | `sketches.json` baseline |
| 8 | Bryła ze źródeł jest szara | szkic (strefy wykończenia, tony) | `massingCommands` nie definiował materiałów; wypełnienia otworów nie miały czego użyć | model baseline |
| 9 | Granica okładziny albo rura spustowa „jest" otworem (Alaska z = 27), a czerwone drzwi w ciemnym drewnie „nie istnieją" (z = 1,99) | obraz oryginału | miara bramki patrzyła tylko na jasność i na krawędzie, także te leżące na końcu ściany | `corrections.json` R3 |
| 10 | Test lustra obraca elewację pod widma | rejestracja | zwycięzcę lustra wyznaczały otwory-widma modelu | Alaska R3 |
| 11 | Otwory **są w modelu, a nie ma ich w żadnym widoku** (Alberto: 14 otworów frontu i tyłu, tak samo w baseline; Ballina 3, Jeziorko 4, Alaska 2) | model (otwór z rozpiętością z rzutu i wysokością) | korekta dachu ustawiała `eaveOffset` (górna powierzchnia dachu przy ścianie) na narysowany wierzch ściany, a kompilator kończy ścianę na **spodzie** dachu, 0,3 m niżej; otwór sięgający w ten pas nie jest wycinany (`OPENING_ABOVE_WALL_TOP`) i nikt tej diagnostyki nie czytał; do tego naroża ścian szukane na odcinku skróconym o 5 %, gdzie ich nie ma | `compile-check.ts` na modelach baseline i cyklu 4 |

Strata 11 wyszła dopiero na renderze czwartego cyklu (liczby zapisów wyglądały dobrze) i kosztowała jawne odstępstwo od
limitu iteracji — piąty cykl zapisany w `PROTOCOL.md` §8 przed otwarciem ślepej próby.

Wspólny mianownik strat 1, 6, 9 i 10: **model LOCAL był jednocześnie hipotezą i miarą**, którą oceniano konkurencyjną
hipotezę (odczyt API). Stąd wybór architektury niżej.

### Czy poprzednie etapy dopasowały się do przykładów?

Sprawdziłem ukryte dopasowanie do znanych domów: w kodzie produkcyjnym nie ma nazw ani współrzędnych domów (testy czystości
przechodzą), ale dwa zachowania były dopasowane do tego, co akurat działało na Aurorze: (a) okap z najniższej krawędzi
dachu działa tylko tam, gdzie rysunek nie ma daszków ani deski czołowej; (b) pasmo tła z „wolnych miejsc" działa tylko
tam, gdzie LOCAL postawił mało otworów. Oba zostały zastąpione regułami od danych, nie od domu, i oba mają kontrpróby
w testach (§6).

## 3. Rozważone warianty

| Wariant | Na czym polega | Za | Przeciw | Decyzja |
|---|---|---|---|---|
| A. Dalsze strojenie pętli R3 | poprawki element po elemencie, kolejne operacje | najmniej kodu | bramka dalej zależy od błędów LOCAL; zła bryła nietykalna | odrzucony |
| B. „Buduj zewnętrze z API" | bryła i elewacje wyłącznie z odczytu API, LOCAL tylko do wnętrza | prosty przepływ, ładne obrazki | pewne stwierdzenie API nie jest dowodem: halucynacja otworu wchodzi do modelu; traci się wymiary drukowane i szczeliny rzutu, które LOCAL czyta dobrze | odrzucony jako całość |
| **C. Arbitraż hipotez na dowodach niezależnych od obu stron** | LOCAL i odczyt API to dwie hipotezy; rozstrzyga obraz oryginału, drugi rysunek (rzut), fakt strony; trzy poziomy: element → elewacja → bryła; czego dowód nie rozstrzyga, zostaje nazwane | usuwa zależność od błędów LOCAL bez oddawania władzy API; działa także bez modelu LOCAL; każdy fakt ma los | więcej stanów; miara obrazu nadal bywa nierozstrzygająca | **wybrany** |
| D. Drugie żądanie „sprawdź ten otwór" | drugi odczyt jako świadek | łatwe | dwa odczyty tej samej informacji tym samym modelem nie są niezależnymi świadkami; koszt | odrzucony |

Wariant B nie został odrzucony na wiarę: w iteracji 4 bryła Alaski zbudowana wyłącznie ze źródeł wyglądała czyściej niż
LOCAL, ale gubiła wnętrze i nie miała przewagi w dowodach — dlatego w wariancie C bryła ze źródeł wygrywa tylko wtedy,
gdy niezależne dowody przeczą LOCAL bardziej niż jej (§4.4).

## 4. Co wdrożono (wariant C)

Szczegóły decyzji: `docs/ADR-V35418-FACADE-AND-BODY-ARBITRATION.md`.

1. **Poziom elementu — bramka źródła 1.3.0** (`correct/source-gate.ts`). Tło liczone kolejno: pasmo wspólne (jak dotąd);
   gdy za cienkie — ściana, którą sam odczyt tej elewacji nazywa gładką (jego otwory wyłączone), czytana odpornie
   (mediana/MAD); gdy i to za cienkie (drzwi, brama) — ten sam kształt przesunięty o 15–30 %. W tym trybie pomiar jest
   przycięty do ściany i czyta trzy płaszczyzny (jasność i dwie różnice barw). **Progi bez zmian** (z ≥ 2, margines 1,
   co najmniej 8 miejsc tła).
2. **Poziom właściwości** (`correct/execute.ts`, `bindOpening`). Otwór LOCAL niesie proweniencję każdej właściwości.
   Poprawka, która zachowuje rozpiętość z rzutu (≥ 70 % wspólnej długości) i zmienia tylko parapet/wysokość, które model
   **założył**, nie musi pobić założenia o margines — obraz ma jej nie obalić. Zapis: `crossWitness: PLAN_SPAN`.
   Właściwości drukowane albo odczytane z elewacji tej regule nie podlegają.
3. **Poziom elewacji — `FACADE_ADOPTION`** (`correct/from-sketch.ts`). Gdy obraz wspiera ≥ 60 % otworów, które odczyt
   rysuje na danej stronie (min. 2), i żadnego nie obala, nierozstrzygnięte elementy tej strony idą za odczytem; otwór
   modelu „wspierany" przez obraz znika tylko, gdy odczyt wyjaśnia te krawędzie (granica stref wykończenia albo inny
   element w jego polu). Takie elementy mają status `ADOPTED_WITH_FACADE` — **nigdy** `SOURCE_VERIFIED`.
4. **Poziom bryły — `BODY_ARBITRATION` 1.0.0** (`consult-analysis.ts`). Bryła LOCAL (po korekcie dachu, którą sama może
   przyjąć z elewacji) jest zestawiana z dowodami, które od niej nie pochodzą: rejestracją opisanych elewacji, wymiarami
   całkowitymi wydrukowanymi na rzucie, opublikowaną wysokością. Gdy przeczą — budowana jest bryła z obrysu rzutu
   i elewacji i zastępuje LOCAL wyłącznie, gdy te same dowody przeczą jej mniej i wspierają co najmniej tak samo.
   Skala rzutu dla tej bryły może pochodzić z drukowanych linii wymiarowych (końce linii z odczytu metryki).
5. **Jedna ścieżka konsumpcji odczytów** z modelem LOCAL lub bez: dach (`SET_ROOF`, okap przy ścianie = wierzch rysowanych
   ścian w narożach bryły), okap, kominy, otwory, **okna połaciowe** (`ADD_ROOF_WINDOW`, rejestr 1.5.0), **strefy
   wykończenia** (`SET_FINISH` z obrysem strefy), paleta miniatury (`MINIATURE_PALETTE`).
6. **Los każdego faktu** — `buildapp.observation-fate` 1.0.0 (`correct/fates.ts`): jeden wiersz na element każdego
   odczytu: współrzędne w pikselach oryginału, producent, strona i jej podstawa, operacja, cel w modelu, los
   (`BUILT`, `AGREES_WITH_MODEL`, `REFUSED_BY_SOURCE`, `UNDECIDED`, `NOT_BUILT`, `NO_CONSUMER`, `NOT_REGISTERED`,
   `NOT_PROPOSED`) i podstawa (`SOURCE_VERIFIED`, `CROSS_WITNESS_PLAN`, `ADOPTED_WITH_FACADE`, `TWO_READERS_AGREE`,
   `NOT_VERIFIED`, `NONE`).
7. **Nazwane konwencje miniatury** (nigdy status wymiaru): strona bez etykiety przypisana kolejnością źródła
   (`MINIATURE_CONVENTION_SOURCE_ORDER`), uproszczenie obrysu o małe uskoki (≤ 6 % na krok, ≤ 12 % łącznie), paleta bez
   odczytu tonu, kadry-miniaturki niepodlegające szkicowaniu (`ELEVATION_THUMBNAILS_NOT_READ`).
8. **Żaden otwór nie zostaje „w modelu, ale nie na ścianie"** (cykl 5: ops 1.6.0, massing 1.2.0, wykonawca 1.6.0).
   Narysowany wierzch ściany to spód dachu przy ścianie — górna powierzchnia stoi nad nim o grubość połaci mierzoną
   w pionie (t / cos kąta), więc zbudowana ściana kończy się tam, gdzie narysowana. Korekta dachu sprawdza otwory
   względem wierzchu ściany, który zbuduje kompilator; wysokość otworu, którą model tylko **założył**, ustępuje dachowi
   ze źródła (głowa schodzi pod wierzch ściany, zostaje ≥ 0,5 m), wysokość **odczytana** odrzuca poprawkę dachu. Żadna
   transakcja nie może zostawić nowego otworu, którego kompilator nie wytnie (`OPENING_NOT_CUT`, wycofanie); to, co
   zostało niewycięte w oddanym modelu, jest nazwane zdarzeniem `DELIVERED_OPENINGS_NOT_CUT`.
9. **Arbitraż bryły 1.1.0:** bryła, która zastępuje LOCAL, musi być sama niesprzeczna ze źródłami (0 sprzeczności) —
   „mniej sprzeczna" nie wystarcza (cykl 4 zastąpił tak dobry model Jeziorka bryłą, której przeczyła opublikowana wysokość).

Wersje wchodzące do klucza przyjętej rewizji (stary cache nie jest odtwarzany po cichu): bramka 1.3.0, rejestr 1.5.0,
wykonawca 1.6.0, propozycje ze szkicu 1.6.0, operacje bryły 1.6.0, massing 1.2.0, arbitraż bryły 1.1.0.

Czego **nie** zmieniono: progów bramki, promptów odczytu (`metric-read/5`, `elevation-sketch/2` — dzięki temu nagrane
odpowiedzi R3 i baseline dają porównanie algorytmu przy tym samym odczycie), pętli recenzenta (continues/resolved, księga
defektów, wycofanie atomowe), dostawcy API.

## 5. Protokół próby (zapisany przed pierwszym biegiem: `research/source-to-model/v35418/PROTOCOL.md`)

- **Zakres źródeł:** publiczna strona jednego projektu z rzutem parteru i co najmniej trzema elewacjami ortogonalnymi;
  wszystko, co przechodzi ten filtr, zostaje w mianowniku, także NO_MODEL i awaria zadania.
- **Zbiory (podział rodzinny, czterech wydawców):** DEV-K — Alaska, Aurora maxi II bis sz (Studio Atrium), Ballina
  (Lipińscy): materiał diagnostyczny z R2/R3. NEW-B — Alberto (Studio Atrium), Medulin (Lipińscy), Domek letniskowy nad
  jeziorkiem (ARCHON): **pierwszy wynik na zamrożonym kodzie bazowym**, potem materiał rozwojowy. NEW-C — Mindelo
  (Lipińscy), Dom pod sakurą E (ARCHON), G6 (Dobre Domy): pakiety pobrane i zamrożone na początku, **nieotwierane do
  zamrożenia kodu**; pierwszy bieg na kodzie końcowym, baseline na tych samych bajtach dopiero potem.
- **Losowanie:** `trial/select.py`, ziarno = SHA-256 commita zamrożenia i wydawcy; rodziny widziane w poprzednich
  etapach pomijane; domów nie wymieniano po wyniku (dwa z trzech ślepych mają dach czterospadowy — forma poza zakresem —
  i zostały w próbie).
- **Kryterium „użytecznej rozpoznawalnej miniatury"** (§3 protokołu, ustalone przed oceną): wszystkie cechy formy OK;
  front i jeszcze jedna strona na właściwym boku; drzwi wejściowe i brama OK; ≥ 60 % dużych otworów frontu i ≥ 50 %
  wszystkich ocenianych stron OK; żadna strona zdominowana przez otwory-widma. Cechy referencyjne każdego domu spisane
  ze źródeł przed obejrzeniem jego modelu (`references/NEW-B.md`, `references/NEW-C.md`; DEV-K jawnie nie-ślepe).
- **Dwie oceny:** autora (cecha po cesze, nie-ślepa) i niezależnego oceniającego — osobny agent, warianty oznaczone
  losowo X/Y, klucz poza jego zasięgiem (`scores/grader-key.json`, `scores/grader-blind-result.json`).
- **Limity z góry:** 4 cykle zmiana → pomiar; 15 USD na etap. **Odstępstwa zapisane przed ich wykonaniem:** §8 — piąty
  cykl (strata 11 wykryta na renderze po cyklu 4; NEW-C nadal nieotwarte); §9 — poprawka niezawodności recenzenta po
  pomiarze, nieobjęta mierzonym kodem.

## 6. Testy przyczynowe i kontrpróby (każdy mechanizm: odtworzenie błędu + próba, która ma NIE przejść)

| Plik | Co dowodzi | Kontrpróby |
|---|---|---|
| `facade-claims-v35418.test.ts` (22) | odtworzenie blokady z nagrań R3 (ściana wypełniona widmami → `SOURCE_UNDECIDED`), pasmo tła ze ściany gładkiej wg odczytu, okno połaciowe, przyjęcie elewacji, reguła właściwości, los faktów, płaszczyzny barw | propozycja, której obraz nie rysuje — odrzucona; odczyt, który przeoczył prawdziwe okna — nie ukrywa ich przed usunięciem; ściana bez wolnego miejsca — nadal nierozstrzygnięta; elewacja z obalonym otworem — nieprzyjęta; wysokość odczytana (nie założona) — reguła właściwości nie działa |
| `massing-v35418.test.ts` (6) | uproszczenie obrysu o małe uskoki; klucz przyjętej rewizji niesie każdą wersję zmieniającą model | uskok ponad próg — nieupraszczany; inna wersja = inny klucz (stary cache nie jest znajdowany) |
| `massing-v35417.test.ts` (+4, razem 29) | strata 11: wysokość ZAŁOŻONA ustępuje dachowi (otwór wycięty); wierzch ściany z elewacji = spód dachu | wysokość ODCZYTANA — poprawka dachu odrzucona w całości; za mało miejsca pod wierzchem ściany — odrzucona, nic nie ściśnięte |
| `consult-v3542.test.ts` (+2, razem 16) | nieczytelna odpowiedź recenzenta → jedno ponowienie z powodem → czytelna jest recenzją | druga nieczytelna kończy krok odmową; nic nie jest naprawiane ani zgadywane |
| `correct-v35416.test.ts` (zmieniony 1) | okno narysowane na dachu daje propozycję `ADD_ROOF_WINDOW` (było: pominięte) | — (zmiana oczekiwania opisana w komentarzu testu) |

Dwa starsze testy zmieniłem świadomie, z uzasadnieniem w komentarzu: fikstura stromego dachu rysowała dach bez grubości
(niefizyczny po zmianie znaczenia „wierzch ściany = spód dachu") oraz asercja `eavesM` w solverze bryły (teraz: wierzch
ściany + grubość połaci w pionie).

## 7. Pomiary

### 7.1 Tabela na dom: cechy, użyteczność, dowód niezależny

Liczby to „cechy OK / cechy ocenialne" w kategoriach F (forma), S (strony), O (duże otwory), C (charakterystyczne),
M (materiały). Baseline: DEV-K — bieg na żywo R3; NEW-B i NEW-C — bieg na żywo na kodzie bazowym `37ad17c`.

| Dom | Zbiór | Cechy OK — baseline (autor) | Cechy OK — po zmianie (autor) | Baseline (ślepy oceniający) | Po zmianie (ślepy oceniający) | Użyteczna: baseline → po (autor / ślepy) | Bliższy źródłu (ślepy) |
|---|---|---|---|---|---|---|---|
| Alaska (Studio Atrium) | DEV-K | F 4/4 S 0/1 O 0/5 C 1/2 M 0/2 | F 4/4 S 0/1 O 4/5 C 1/2 M 1/2 | F 2/4 S 0/1 O 1/5 C 1/2 M 0/2; widma 13 | F 2/4 S 0/1 O 4/5 C 1/2 M 1/2; widma 0 | nie → nie / nie → nie | po zmianie |
| Aurora maxi II bis sz (Studio Atrium) | DEV-K | F 3/4 S 1/1 O 0/4 C 1/1 M 1/2 | F 4/4 S 1/1 O 1/4 C 1/1 M 2/2 | F 3/4 S 1/1 O 1/4 C 1/1 M 1/2; widma 9 | F 4/4 S 1/1 O 3/4 C 1/1 M 2/2; widma 6 | nie → nie / nie → nie | po zmianie |
| Ballina (Lipińscy) | DEV-K | F 3/4 S 1/1 O 3/5 C 0/0 M 1/2 | F 4/4 S 1/1 O 5/5 C 0/0 M 1/2 | F 3/4 S 1/1 O 2/5 C 0/0 M 1/2; widma 0 | F 4/4 S 1/1 O 5/5 C 0/0 M 1/2; widma 0 | TAK → TAK / nie → TAK | po zmianie |
| Alberto (Studio Atrium) | NEW-B | F 3/4 S 1/1 O 0/6 C 1/2 M 2/2 | F 3/4 S 1/1 O 1/6 C 1/2 M 2/2 | F 3/4 S 1/1 O 0/6 C 1/2 M 2/2; widma 4 | F 3/4 S 1/1 O 3/6 C 1/2 M 2/2; widma 8 | nie → nie / nie → nie | po zmianie |
| Medulin (Lipińscy) | NEW-B | F 1/4 S 1/1 O 1/6 C 0/1 M 2/2 | F 1/4 S 1/1 O 1/6 C 0/1 M 2/2 | F 0/4 S 1/1 O 2/5 C 0/1 M 2/2; widma 5 | F 0/4 S 1/1 O 2/5 C 0/1 M 2/2; widma 5 | nie → nie / nie → nie | po zmianie |
| Domek letniskowy nad jeziorkiem (ARCHON) | NEW-B | F 4/4 S 1/1 O 6/6 C 1/1 M 1/2 | F 4/4 S 1/1 O 6/6 C 1/1 M 1/2 | F 4/4 S 1/1 O 6/6 C 1/1 M 1/2; widma 0 | F 4/4 S 1/1 O 6/6 C 1/1 M 1/2; widma 1 | TAK → TAK / TAK → TAK | bez różnicy |
| Mindelo (Lipińscy) | NEW-C | F 1/4 S 1/1 O 1/6 C 1/2 M 1/2 | F 1/4 S 1/1 O 1/6 C 1/2 M 1/2 | F 1/4 S 1/1 O 2/6 C 2/2 M 1/2; widma 2 | F 1/4 S 1/1 O 3/6 C 2/2 M 1/2; widma 3 | nie → nie / nie → nie | po zmianie |
| Dom pod sakurą E (ARCHON) | NEW-C | F 0/4 S 0/1 O 0/4 C 0/1 M 0/2 | F 2/4 S 1/1 O 3/4 C 0/1 M 1/2 | F 0/4 S 0/1 O 0/4 C 0/1 M 0/2; widma 0 | F 2/4 S 1/1 O 3/4 C 0/1 M 1/2; widma 0 | nie → nie / nie → nie | po zmianie |
| G6 (Dobre Domy) | NEW-C | F 2/4 S 0/1 O 0/3 C 0/1 M 1/2 | F 2/4 S 0/1 O 0/3 C 0/1 M 1/2 | F 2/4 S 1/1 O 2/4 C 0/1 M 1/2; widma 0 | F 2/4 S 1/1 O 2/4 C 0/1 M 1/2; widma 0 | nie → nie / nie → nie | bez różnicy |

Sumy niezależnego oceniającego (baseline → po zmianie): DEV-K F 8/12 → 10/12, S 2/3 → 2/3, **O 4/14 → 12/14**, C 2/3 →
2/3, M 2/6 → 4/6; NEW-B F 7/12 → 7/12, S 3/3 → 3/3, **O 8/17 → 11/17**, C 2/4 → 2/4, M 5/6 → 5/6; NEW-C F 3/12 → 5/12,
S 2/3 → 3/3, **O 4/14 → 8/14**, C 2/4 → 2/4, M 2/6 → 3/6. Sumy autora: DEV-K O 3/14 → 10/14; NEW-B O 7/18 → 8/18;
NEW-C O 1/13 → 4/13. **Rozbieżności ocen (raportowane, nie uzgadniane):** Ballina baseline — autor „użyteczna na
granicy", oceniający „nie"; Alaska — oceniający liczy obróconą bryłę także jako błąd formy (F 2/4), autor tylko jako
błąd stron; Alberto po zmianie — oceniający 3/6 otworów, autor 1/6 (autor surowiej ocenia ciągłe przeszklenie frontu);
G6 — oceniający uznaje front na właściwej stronie, autor nie.

### 7.2 Udział zadeklarowanych linków z użyteczną miniaturą (NO_MODEL w mianowniku)

| Zbiór | N | Model powstał: baseline → po | Użyteczna (autor) | Użyteczna (ślepy oceniający) |
|---|---|---|---|---|
| DEV-K | 3 | 3 → 3 | 1 → 1 | 0 → 1 |
| NEW-B | 3 | 3 → 3 | 1 → 1 | 1 → 1 |
| NEW-C (ślepe) | 3 | **2 → 3** | 0 → 0 | 0 → 0 |
| Razem | 9 | 8 → 9 | 2 → 2 (22 %) | 1 → 2 (11 % → 22 %) |

### 7.3 Biegi: koszt, czas, stany, liczniki modelu

„final" = kod `bc57767`. DEV-K i NEW-B: odczyty **nagrane** (te same odpowiedzi API co baseline — porównanie algorytmu,
0 USD za odczyt) + recenzent **na żywo** oglądający faktyczną rewizję. NEW-C: wszystko **na żywo** w obu wariantach
(świeże odczyty — zmienność odczytu rozdzielona w §7.5). „final+reask" = commit z poprawką §9, oznaczony osobno.

| Dom | Wariant | LOCAL | Wynik | Stan jakości z biegu | Otwory zewn. | Okna poł. | Kominy | Pomieszczenia | Strefy wykończ. | Odpowiedzi API | USD | s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Alaska | baseline | FAILED/METRIC_RESOLUTION_INCONCLUSIVE | model 2e0e83f70728 | NEEDS_EVIDENCE | 29 | 0 | 2 | 3 | 4 | 8 | 0.2003 | 341 |
| Alaska | final | FAILED/METRIC_RESOLUTION_INCONCLUSIVE | model 20b47a72b953 | RECOGNIZABLE_PARTIAL | 10 | 8 | 2 | 0 | 2 | 9 | 0.0739 | 393 |
| Aurora maxi II bis sz | baseline | COMPLETED | model 3c271a7ce354 | RECOGNIZABLE_PARTIAL | 21 | 0 | 3 | 2 | 6 | 6 | 0.1999 | 287 |
| Aurora maxi II bis sz | final | COMPLETED | model 40c8482d15fe | BUDGET_OR_ROUND_LIMIT | 19 | 1 | 3 | 2 | 7 | 7 | 0.0484 | 303 |
| Ballina | baseline | FAILED/METRIC_RESOLUTION_INCONCLUSIVE | model 30e4a7ae8c2b | BUDGET_OR_ROUND_LIMIT | 10 | 0 | 0 | 7 | 3 | 13 | 0.2715 | 430 |
| Ballina | final | FAILED/METRIC_RESOLUTION_INCONCLUSIVE | model 78a0e9791e21 | RECOGNIZABLE_PARTIAL | 10 | 0 | 0 | 0 | 3 | 9 | 0.0625 | 369 |
| Alberto | baseline | FAILED/METRIC_RESOLUTION_INCONCLUSIVE | model 2e1a9f04a9fd | RECOGNIZABLE_PARTIAL | 21 | 0 | 2 | 2 | 8 | 6 | 0.1502 | 384 |
| Alberto | final-try1 | FAILED/METRIC_RESOLUTION_INCONCLUSIVE | model 481efa0d862c | NOT_REVIEWED | 18 | 0 | 2 | 2 | 9 | 6 | 0.0355 | 461 |
| Alberto | final | FAILED/METRIC_RESOLUTION_INCONCLUSIVE | model 481efa0d862c | NOT_REVIEWED | 18 | 0 | 2 | 2 | 9 | 6 | 0.0308 | 458 |
| Alberto | final+reask | FAILED/METRIC_RESOLUTION_INCONCLUSIVE | model 481efa0d862c | RECOGNIZABLE_PARTIAL | 18 | 0 | 2 | 2 | 9 | 7 | 0.0964 | 483 |
| Medulin | baseline | COMPLETED | model 80cfebe17252 | RECOGNIZABLE_PARTIAL | 24 | 0 | 2 | 22 | 12 | 14 | 0.1725 | 526 |
| Medulin | final | COMPLETED | model 79686056feef | RECOGNIZABLE_PARTIAL | 24 | 0 | 1 | 22 | 12 | 12 | 0.0804 | 552 |
| Domek letniskowy nad jeziorkiem | baseline | COMPLETED | model 2e91877677d1 | RECOGNIZABLE_PARTIAL | 7 | 0 | 1 | 3 | 0 | 9 | 0.3522 | 573 |
| Domek letniskowy nad jeziorkiem | final | COMPLETED | model b32f14179789 | RECOGNIZABLE_PARTIAL | 7 | 0 | 1 | 3 | 3 | 9 | 0.0445 | 669 |
| Mindelo | final | COMPLETED | model 9c649ebf2081 | UNSUPPORTED_OPERATION | 18 | 0 | 2 | 10 | 10 | 9 | 0.1776 | 575 |
| Mindelo | baseline | COMPLETED | model 270c1274a2bd | UNSUPPORTED_OPERATION | 18 | 0 | 2 | 10 | 11 | 12 | 0.2033 | 594 |
| Dom pod sakurą E | final | FAILED/PLAN_RESOLUTION_INCONCLUSIVE | model f16755a867b8 | NOT_REVIEWED | 10 | 0 | 3 | 0 | 4 | 9 | 0.3610 | 712 |
| Dom pod sakurą E | baseline | FAILED/PLAN_RESOLUTION_INCONCLUSIVE | NO_MODEL | None | None | None | None | None | None | 8 | 0.3567 | 644 |
| Dom pod sakurą E | final+reask | FAILED/PLAN_RESOLUTION_INCONCLUSIVE | model 48b6bbe1d021 | UNSUPPORTED_OPERATION | 9 | 0 | 2 | 0 | 4 | 10 | 0.0883 | 603 |
| G6 | final | COMPLETED | model 7834fd7893bd | UNSUPPORTED_OPERATION | 4 | 0 | 0 | 1 | 0 | 9 | 0.1418 | 208 |
| G6 | baseline | COMPLETED | model 7834fd7893bd | UNSUPPORTED_OPERATION | 4 | 0 | 0 | 1 | 0 | 8 | 0.1467 | 202 |

Awarie i ponowienia: 3 z 9 spojrzeń recenzenta na żywo na kodzie mierzonym zakończyły się nieczytelną odpowiedzią
narzędzia (Alberto 2×, Sakura) → `NOT_REVIEWED`; z poprawką §9 oba domy mają recenzję dostarczonej rewizji (Alberto:
ponowienie zadziałało w pierwszym spojrzeniu — zdarzenie `REVIEW_REASKED`). Zadanie hosta dla Sakury: FAILED (§9 raportu).
Żadnego błędu transportu ani przekroczenia rezerwacji.

### 7.4 Wymiary i wnętrze (osobno od werdyktu miniatury)

| Dom | Obrys modelu po zmianie (m) | Wymiary drukowane / opublikowane | Zgodność | Dach po zmianie | Wnętrze |
|---|---|---|---|---|---|
| Alaska | 13,25 × 7,90 | 13,15 × 7,90 (druk) | X +0,10 m, Z zgodne | dwuspad 40° (strona: 40°) | **brak** — bryła ze źródeł zastąpiła LOCAL (NOT_CHECKED); baseline miał 3 pomieszczenia |
| Aurora | 15,54 × 10,73 (z dobudówką) | 15,90 × 8,90 (druk) | X −0,36 m; Z nieporównywalne (dobudówka) — arbitraż liczy to jako 1 sprzeczność | dwuspad 35°, kalenica 6,52 m (strona 6,79) | 2 pomieszczenia (bez zmian) |
| Ballina | 13,49 × 8,20 | 13,65 × 8,15 (druk) | X −0,16 m, Z +0,05 m | dwuspad 30,1°, okap 0,81 m (baseline: 34,4°, okap 0) | **brak** — bryła ze źródeł (baseline 7 pomieszczeń) |
| Alberto | 15,40 × 8,15 | 15,40 × 8,15 (druk) | zgodne | dwuspad 30,7° (baseline 35°; strona 25°), kalenica 5,24 m (strona 5,54) | 2 pomieszczenia (bez zmian) |
| Medulin | 8,97 × 17,89 | 9,25 × 18,25 (druk) | −0,28 / −0,36 m (w tolerancji arbitrażu) | 4 człony: dwuspad + 3 płaskie (źródło: jeden dwuspad 45°) — **zła forma** | 22 pomieszczenia |
| Jeziorko | 9,80 × 6,30 | 12,30 × 6,30 (druk, z tarasem pod dachem) | X: model bez zadaszonego tarasu (nazwane) | dwuspad 30° (strona 30°), kalenica 4,94 (strona 4,94) | 3 pomieszczenia |
| Mindelo | 23,75 × 9,37 | 24,44 × 18,34 (druk) | X −0,69 m; Z: brak skrzydeł poprzecznych | dwuspad + 4 płaskie — **zła forma** | 10 pomieszczeń |
| Sakura | 17,55 × 9,89 | 17,60 × 12,30 (druk) | X −0,05 m; **Z −2,41 m: obrys uproszczony (nazwana konwencja miniatury, nie wymiar)** | dwuspad 36,2° zamiast czterospadowego 30° | brak (bryła ze źródeł) |
| G6 | 11,80 × 7,41 | 11,32 × 8,02 (druk) | +0,48 / −0,61 m | dwuspad 35° zamiast czterospadowego 35°; szczyt 6,09 m (strona 6,09) | 1 pomieszczenie |

### 7.5 Świeże odczyty a powtórki; odtwarzalność

- **Powtórki krzyżowe NEW-C (0 USD):** kod bazowy na odczytach biegu końcowego i kod końcowy na odczytach baseline.
  Sakura: kod bazowy na odczytach, na których kod końcowy zbudował model → **NO_MODEL** (`MASSING_UNSUPPORTED_FORM`:
  obrys o 8 narożach); różnicę robi uproszczenie obrysu, nie odczyt. Mindelo i G6: w obu kierunkach ta sama bryła
  (5 członów / 1 człon) — zmiana kodu nie zmienia tu formy, drobne różnice w otworach idą za kodem.
- **Zmienność odczytu jest realna:** Sakura na kodzie końcowym — bieg badawczy (świeży odczyt) dał model, zadanie hosta
  (kolejny świeży odczyt) skończyło się FAILED, bo odczyt metryki nie ustalił skali rzutu (bez metrów nie ma bryły).
  Ballina: na nagranych odczytach R3 bryła LOCAL została zastąpiona bryłą ze źródeł, na świeżym odczycie hosta LOCAL
  został (arbitraż znalazł sprzeczność także w bryle zastępczej). To dwa różne, poprawnie nazwane wyniki.
- **Odtwarzalność przy tych samych odpowiedziach:** dwa biegi ślepe na żywo (G6, Mindelo) odtworzone z własnych nagranych odpowiedzi na tym samym kodzie dają `model.json` identyczny co do bajta (SHA-256 `7834fd78…`, `9c649ebf…`), 0 USD. Host: powtórzony URL → `REUSED`, te same bajty modelu
  i sceny, 0 USD, 0 żądań.

## 8. Dom po domu

**Alaska (DEV-K).** Baseline R3: pasy okien na obu długich bokach, 13 otworów-widm, jasny dach, brak okien
połaciowych. Po zmianie: 4 osobne okna w pasie drewna, przeszklenie tarasowe + 2 okna na drugim boku, 3 + 5 okien
połaciowych jak w źródle, okno w szczycie i drzwi tarasowe w szczycie tylnym, 2 kominy, ciemny dach; 22 poprawki
zamknięte na zweryfikowanej rewizji. Arbitraż zastąpił bryłę LOCAL bryłą ze źródeł (LOCAL 3 sprzeczności, zastępcza 0)
— **koszt: znika wnętrze**. Otwarte: brak drzwi wejściowych w szczycie frontowym (bramka nie potwierdza czerwonych drzwi
w ciemnym drewnie pod daszkiem), strony modelu nazwane o ćwierć obrotu (front źródła na boku modelu), drewno szczytów,
daszek nad wejściem (brak operacji). Koszt biegu końcowego 0,074 USD (recenzja), jakość RECOGNIZABLE_PARTIAL.

**Aurora (DEV-K).** Baseline R3: pas okien na froncie, ściany wewnętrzne przebijające jasny dach. Po zmianie: okna
frontu rozdzielone (3 + 1), dach czysty i ciemny, 3 kominy, okno połaciowe. Otwarte: drzwi wejściowe w podcieniu
(oceniający widzi je przy ganku, autor nie — rozbieżność), pas-widmo na szczycie (LOCAL, strona bez rozstrzygnięcia
źródłem), duże okno na ślepym szczycie. Stan BUDGET_OR_ROUND_LIMIT (18 różnic otwartych, 0 KEY). 0,048 USD.

**Ballina (DEV-K).** Baseline R3: front z jednym oknem i drzwiami, tył z jednym przeszkleniem, bez okapu. Po zmianie:
komplet otworów czterech stron w dobrych miejscach (front: okno, dwa wąskie, drzwi, okno; tył: przesuwne + dwa okna
z panelem cegły; po oknie w szczytach), okap 0,81 m, ciemny dach. Jedyny dom, który według ślepego oceniającego
przeszedł z „nieużytecznej" na „użyteczną". Otwarte: cegła frontu zgubiona przy zmianie bryły (była w baseline),
wnętrze nieprzeniesione. 0,063 USD. Na świeżym odczycie hosta (§9): LOCAL został, 6 poprawek zamkniętych weryfikacją.

**Alberto (NEW-B).** Pierwszy wynik (kod bazowy): elewacja frontowa i tylna bez żadnego widocznego otworu — 14 otworów
w modelu, niewyciętych. Po zmianie: otwory widać, dach 30,7° (było 35°, strona 25°). Ale front to prawie ciągłe
przeszklenie (widma LOCAL, których bramka nie pozwala usunąć: podcień i panele drewna dają „wsparcie" obrazu), drzwi
na skraju, pas-widmo na szczycie. Nieużyteczna w obu ocenach; bliższa źródłu niż baseline. Recenzja: 2 nieczytelne
odpowiedzi (NOT_REVIEWED), z poprawką §9 — RECOGNIZABLE_PARTIAL, 11 zamkniętych weryfikacją. 0,031 + 0,035 + 0,096 USD.

**Medulin (NEW-B).** Pierwszy wynik i końcowy prawie identyczne: LOCAL buduje wąski dwuspad i trzy płaskie człony
zamiast jednej bryły 9,25 × 18,25 pod stromym dachem. Arbitraż zbudował bryłę zastępczą (skala z drukowanych linii
wymiarowych), ale źródła przeczą jej bardziej (6 sprzeczności: odczyt obrysu dał 15,37 × 8,66 m) — LOCAL zostaje, oba
zapisane. Miniaturki elewacji (4 z 8 kadrów) nie są już szkicowane. **Niepowodzenie zachowane.** 0,080 USD.

**Domek letniskowy nad jeziorkiem (NEW-B).** Dobry już na kodzie bazowym (użyteczna w obu ocenach). Po zmianie: te same
otwory, dochodzą strefy wykończenia (drewno; czarny panel na tyle jest błędem — „szary panel betonowy" źródła trafił
w ciemny materiał), dodatkowe skrzydło drzwi przy lewym oknie frontu. Bez różnicy w ocenie ślepej. W cyklu 4 arbitraż
**zepsuł** ten dom (zastąpił LOCAL bryłą sprzeczną z opublikowaną wysokością) — cofnięte regułą 1.1.0; to była
najważniejsza obrona przed regresją w tym etapie. 0,044 USD.

**Mindelo (NEW-C, ślepy).** Oba warianty: bryła LOCAL z 5 członów (długi dwuspad + płaskie przybudówki) zamiast
skrzydeł pod poprzecznymi szczytami — forma poza zakresem („trzy skrzydła"). Po zmianie brama garażowa w prawej części
frontu i ciemny otwór wnęki tylnej (oceniający: bliższy źródłu). Orientacja dachów UNDECIDED, żadna elewacja
nieprzyjęta. Nieużyteczna. 0,178 USD (baseline 0,203).

**Dom pod sakurą E (NEW-C, ślepy).** Kod bazowy: **NO_MODEL** po 0,357 USD (LOCAL odmówił, obrys o 8 narożach poza
zakresem bryły ze źródeł). Kod końcowy: model — obrys uproszczony (nazwana konwencja), 10 otworów zewnętrznych
(22 fakty z elewacji zbudowane, 9 zweryfikowanych źródłem, 1 przyjęty z elewacją), front i tył rozpoznawalne. Otwarte:
dach dwuspadowy zamiast czterospadowego (F2 — forma poza zakresem), komin-widmo przy szczycie, ściany jasne zamiast
grafitowych (paleta bez odczytu tonu), głębokość −2,4 m. Nieużyteczna wg reguły (F2), ale z niczego powstał model.
0,361 USD.

**G6 (NEW-C, ślepy).** Oba warianty identyczne co do piksela: dwuspad zamiast czterospadowego, strony obrócone
(elewacja frontowa na boku), brak bramy i drzwi, ściany czarne (materiał z LOCAL). Wszystkie 4 elewacje
NOT_REGISTERED — 13 faktów bez losu innego niż „nie zarejestrowano". **Niepowodzenie zachowane, bez poprawy.** 0,142 USD.

## 9. Host na commicie końcowym (`apps/analyzer-api`, konfiguracja produktu)

Skrypt `research/source-to-model/v35418/host-e2e.mjs`, zbudowany serwer, klucz tylko w środowisku procesu, token dostępu
losowy w pamięci. Wynik: **ALL CHECKS PASSED** (kontrole integracji), z jednym zadaniem zakończonym FAILED — zachowanym.

| Zadanie | Wynik | Żądania / USD | Co pokazuje |
|---|---|---|---|
| job-1 Ballina (świeży odczyt, token) | COMPLETED, 486 s | 12 / 0,315982 | prawdziwe propozycje ze szkiców (`UPDATE_OPENING` ×4, `REMOVE_OPENING`, `ADD_OPENING`, `SET_ROOF_OVERHANG`) zastosowane do właściwych elementów przez wspólnego wykonawcę; bramka na obrazie oryginału; **drugie spojrzenie obejrzało dokładnie oddaną rewizję** (`checked 9f754fb1fd21 = delivered 9f754fb1fd21`); 6 defektów `CLOSED_VERIFIED`, 1 `APPLIED_REVIEW_DISAGREES` (zastosowane, recenzent się nie zgadza — zostaje otwarty, pętla nie zamyka się na „AI powiedziało OK"), 2 `NO_PROPOSAL`, 1 `UNSUPPORTED_OPERATION` (panele PV); stan własny `RECOGNIZABLE_PARTIAL`; wynik niesie werdykt stron, los faktów i arbitraż bryły (`LOCAL_STANDS`) |
| job-2 Dom pod sakurą E (świeży odczyt, token) | **FAILED** `RECONSTRUCTION_FAILED`, 706 s | 12 / 0,611493 | organiczna odmowa LOCAL; w tym odczycie metryka nie ustaliła skali rzutu, więc bryła ze źródeł nie miała metrów — zadanie nie oddało wyniku (HTTP 410), **dane zachowane**: 12 par żądanie/odpowiedź i dziennik w `consult-exchanges/<jobId>` (surowe ≠ kanoniczne, bez sekretu). Ten sam dom w biegu badawczym na tym samym kodzie dał model — zmienność odczytu (§7.5) |
| job-1 powtórzony (ten sam URL) | COMPLETED, 335 s | **0 / 0** | `REUSED`: 12 odpowiedzi odtworzonych, 0 brakujących, te same bajty modelu i sceny, ten sam stan jakości i lista 10 defektów (ponowne użycie nie poprawia etykiety) |
| job bez tokenu (Jeziorko) | COMPLETED, 80 s | **0 / 0** | ścieżka samych rysunków; brak konsultacji w wyniku; żadnego żądania |
| job-3 Willa Layla G2 A (ARCHON; świeży odczyt, token; **poza ocenianą próbą**) | COMPLETED, 1457 s | 18 / 1,281031 | **organiczna odmowa LOCAL** (`PLAN_LAYOUT_REJECTED`, nie kontrolowane wstrzymanie) oddana przez host: bryła z obrysu rzutu i elewacji, 34 fakty ze szkiców zbudowane przez wspólnego wykonawcę (15 zweryfikowanych źródłem, 1 przyjęty z elewacją; 4 odrzucone źródłem), drugie spojrzenie na oddaną rewizję (`909b7477c611`). Stan `BUDGET_OR_ROUND_LIMIT`: 41 różnic otwartych (1 KEY), w tym **22 zastosowane poprawki, z którymi recenzent się nie zgadza** — nie są przedstawiane jako potwierdzone. Najdroższe zadanie etapu |

`continues` / `resolved` na żywo: w biegach końcowych recenzent domykał defekty z wcześniejszych spojrzeń
(„carried from earlier looks" w stanach jakości — Aurora 17, Ballina 6, Jeziorko 2 przeniesione; „closed on a verified
revision" — Alaska 22, Alberto 11, Sakura 10, host Ballina 6) i osobno liczy zamknięcia „tylko na słowo recenzenta"
(Alaska 5, Alberto 5, Jeziorko 6) — te nie są nigdzie przedstawiane jako zweryfikowane źródłem.

Zmiana wersji danych nie użyje po cichu cache: klucz przyjętej rewizji zawiera wersje bramki, wykonawcy, rejestru,
propozycji ze szkicu, operacji bryły, generatora bryły i arbitrażu (test w `massing-v35418.test.ts`); w tym etapie
doszła do klucza wersja generatora bryły, której brakowało.

Kontrolowane uszkodzenie nie było potrzebne: błędy naturalne wystąpiły (nieczytelne odpowiedzi recenzenta, odmowa
LOCAL, odrzucenia bramki). Żaden wynik w dostawie nie jest oznaczony KONTROLA.

## 10. Los faktów i cztery strony

Każdy element każdego odczytu elewacji ma wiersz w `observation-fates.json` (schemat `buildapp.observation-fate` 1.0.0):
współrzędne w pikselach oryginału, producent (model i wersja promptu), strona i jej podstawa, operacja, cel, los,
podstawa. Podsumowanie biegów końcowych:

| Dom | Fakty | Zbudowane (w tym zweryfikowane źródłem / świadek z rzutu / przyjęte z elewacją / niezweryfikowane) | Zgodne z modelem | Odrzucone źródłem | Nierozstrzygnięte | Brak konsumenta | Niezarejestrowane / niezaproponowane / niezbudowane | Elewacje przypisane |
|---|---|---|---|---|---|---|---|---|
| Alaska | 61 | 28 (22 / 0 / 0 / 6) | 9 | 1 | 1 | 7 | 15 / 0 / 0 | 4 z 5 (piąta to perspektywa — odłożona, nazwana) |
| Aurora | 42 | 15 (13 / 0 / 0 / 2) | 4 | 2 | 2 | 6 | 0 / 11 / 2 | 3 z 3 |
| Ballina | 33 | 18 (11 / 0 / 0 / 7) | 6 | 0 | 0 | 9 | 0 / 0 / 0 | 4 z 4 |
| Alberto | 39 | 12 (6 / 2 / 0 / 4) | 4 | 1 | 5 | 7 | 0 / 10 / 0 | 3 z 3 (bok wg konwencji kolejności — nazwane) |
| Medulin | 56 | 4 (4 / 0 / 0 / 0) | 3 | 6 | 7 | 10 | 0 / 14 / 12 | 4 z 4 |
| Jeziorko | 40 | 10 (2 / 1 / 1 / 6) | 13 | 0 | 0 | 6 | 9 / 2 / 0 | 3 z 4 |
| Mindelo | 52 | 2 (2 / 0 / 0 / 0) | 2 | 5 | 4 | 8 | 10 / 12 / 9 | 3 z 4 |
| Sakura | 46 | 22 (9 / 0 / 1 / 12) | 2 | 0 | 0 | 4 | 18 / 0 / 0 | 2 z 4 |
| G6 | 23 | 0 | 3 | 0 | 0 | 3 | 13 / 4 / 0 | 2 z 4 (żadna nie zarejestrowana wysokościowo) |

„Brak konsumenta" to fakty odczytane, dla których model nie ma dziś operacji (daszki, rynny, tarasy, pergole, panele
PV): są nazwane, nie zgadywane. „Niezweryfikowane" to elementy zbudowane bez potwierdzenia pomiarem na obrazie (np.
strefy wykończenia, elementy z bryły bez LOCAL) — w galerii i w JSON mają osobny status.

**Cztery strony każdego domu** są w galerii dostawy (`gallery.html`): oryginał wydawcy · szkic PNG i SVG ·
semantyczny JSON odczytu · werdykt wykorzystania (ile otworów zweryfikowano / przyjęto / odrzucono / nie
rozstrzygnięto, okna połaciowe, kominy, strefy, decyzja o przyjęciu elewacji) · kafle modelu każdego wariantu z tej
samej kamery. Strona, której źródło nie pokazuje albo której żadna elewacja nie została przypisana, ma wpis „BRAK
ŹRÓDŁA TEJ STRONY" — nic nie jest dorysowane. Szkice są zapisane także dla domu bez modelu (baseline Sakury) i dla
elewacji nieprzypisanych.

## 11. Budżet

Jedna księga: `research/ai-assist/spend-ledger-v35417r3.json` (otwarcie 28,542857 USD, pułap 68,542857 USD; nowej puli
nie ma). Stan przed pierwszym płatnym żądaniem etapu: 29,500933 USD, 0 otwartych rezerwacji (sprawdzone). Każde
żądanie rezerwuje najgorszy przypadek pod blokadą pliku i jest rozliczane z użycia; host prowadzi własny dziennik,
zaksięgowany do tej samej księgi (`book-host.ts`, wpis po identyfikatorze — bez podwójnego liczenia).

| Pozycja | USD |
|---|---|
| Baseline NEW-B na kodzie bazowym (3 biegi na żywo) | 0,6749 |
| Iteracje DEV: odczyty obrysu rzutu przy powtórkach (reszta powtórek 0 USD) | 0,1208 |
| Biegi końcowe DEV: recenzja na żywo (6 domów + drugi bieg Alberto) | 0,3759 |
| NEW-C ślepe: kod końcowy (3) + kod bazowy (3), wszystko na żywo | 1,3870 |
| Ponowne spojrzenia z poprawką §9 (Alberto, Sakura) | 0,1847 |
| Host końcowy (Ballina, Sakura, powtórka, bez tokenu) | 0,9275 |
| Host: Willa Layla (organiczna odmowa LOCAL, poza próbą) | 1,2810 |
| **Razem etap** | **4,951829** |

Księga po etapie: **34,452762 USD** z 68,542857 (pozostaje nominalnie 34,090095 USD), 193
żądań od otwarcia księgi, 0 otwartych rezerwacji. Koszt jednego pełnego linku na żywo na kodzie końcowym: 0,14–0,36 USD
(mediana trzech ślepych: 0,178), czas 208–712 s. Saldo panelu nie było traktowane jako limit.

## 12. Granice i otwarte błędy (nazwane, z miejscem pierwszej straty)

1. **Drzwi wejściowe na zatłoczonym lub ciemnym tle** (Alaska, Aurora, Alberto). Odczyt je rysuje; bramka źródła nie
   potwierdza (drzwi w kolorze okładziny, pod daszkiem, w podcieniu). Trzy płaszczyzny barw pomogły drzwiom tarasowym,
   nie wejściowym. Następny krok: miara tekstury/krawędzi ościeży zamiast kontrastu wnętrza, albo świadek z rzutu
   (szczelina ściany z symbolem drzwi) jako drugi, niezależny dowód — nie obniżanie progu.
2. **Widma LOCAL, które obraz „wspiera"** (Alberto front, szczyty Aurory i Alberto). Usunięcie jest odrzucane
   (`SOURCE_SHOWS_OPENING`), bo w polu widma leży prawdziwy element (podcień, panel). Przyjęcie elewacji tego nie
   rozwiązuje, gdy odczyt sam ma obalony element. Następny krok: rozliczanie pola widma elementami, które odczyt tam
   nazywa (dziś tylko strefy wykończenia i elementy przechodzące na wylot).
3. **Bryły wieloczłonowe LOCAL z płaskimi przybudówkami** (Medulin, Mindelo) — arbitraż uczciwie zostawia LOCAL, bo
   bryła zastępcza (jeden prostokąt z uproszczonego obrysu) jest sprzeczna z wymiarami drukowanymi. Brakuje bryły
   ze źródeł o dwóch–trzech skrzydłach z własnymi dachami; to jest praca nad reprezentacją, nie nad progami.
4. **Dach czterospadowy i naczółki** (Sakura, G6) — `SET_ROOF` nazywa trapez i odmawia; model dostaje dwuspad. Jądro
   modelu ma połacie (`roofPlanes`); brakuje operacji i świadka.
5. **Strony o ćwierć obrotu** (Alaska; G6 wg autora) — orientacja `TURNED_90` jest odczytana i nazwana, ale model nie
   jest obracany do stron źródła, więc „front" aplikacji to bok. Miniatura jest tym samym domem; etykiety stron nie.
6. **Wnętrze przy zastąpieniu bryły** (Alaska, Ballina) — bryła ze źródeł nie przejmuje pomieszczeń LOCAL
   (NOT_CHECKED). To świadomy koszt: zewnętrze zgodne ze źródłem kosztem wnętrza; do rozwiązania przez przeniesienie
   ścian wewnętrznych w układzie rzutu.
7. **Uproszczenie obrysu zmienia wymiar** (Sakura: głębokość −2,4 m) — nazwana konwencja miniatury, nie wymiar; nie
   wolno jej czytać jako metryki.
8. **Paleta bez odczytu tonu na bryle ze źródeł** (Sakura jasna zamiast grafitowej; G6 czarne ściany z LOCAL; czarny
   panel Jeziorka) — tony stref wykończenia są mapowane na kilka materiałów palety; brak odczytu tonu ściany bazowej.
9. **Zmienność odczytu** — ten sam link, ten sam kod: model albo FAILED (Sakura), LOCAL albo bryła ze źródeł
   (Ballina). Przyjęta rewizja stabilizuje wynik po pierwszym sukcesie; pierwszego nie.
10. **Recenzent: nieczytelne wywołanie narzędzia** — 3 z 9 spojrzeń; jedno ponowienie (§9 protokołu) pomogło w obu
    powtórzonych przypadkach, ale przyczyna (tryb ścisły narzędzia recenzji niedostępny dla tak dużego schematu) zostaje.
11. **Brak operacji** dla daszków, podcieni, tarasów zadaszonych, pergoli, paneli PV, słupów — fakty mają los
    `NO_CONSUMER`.

Hipotezy sprawdzone i **niepotwierdzone / cofnięte w tym etapie** (zostają w historii commitów): arbitraż bryły 1.0.0
(„mniej sprzeczna wygrywa" — regresja Jeziorka); bryła wyłącznie ze źródeł jako domyślna (iteracja 4 Alaski: czyściej,
ale bez przewagi w dowodach i bez wnętrza); okap z najniższej krawędzi dachu; wierzch ściany jako górna powierzchnia
dachu.

## 13. Testy na kodzie końcowym

- Typecheck (`tsc -p tsconfig.json`): czysty.
- Testy etapu: `facade-claims-v35418` 22, `massing-v35418` 6, `massing-v35417` 29, `correct-v35416` 49,
  `sketch-registration-v35417r3` 19, `consult-v3542` 16 — zielone.
- Pełna macierz: **4536 testów: 4509 zaliczonych, 16 porażek, 11 pominiętych** (`stage-reports/artifacts/v35418/matrix-final-summary.json`,
kod `ba41dbe`). Porównanie po tożsamości testu z listą bazową R3
(`stage-reports/artifacts/v35417-r3/matrix-r3-summary.json`): **te same 16, żadnej nowej, żadna nie zniknęła**
(research-isolation 4, wall-strip 4, reference 2, presentation 2, analyzer-api 1, compound-facade 1, text 1, program 1 —
wszystkie w plikach spoza tego etapu). Pierwszy przebieg macierzy (obok zadania hosta, przed aktualizacją testów
kolejności scen) miał 27 porażek: te 16, 9 testów kolejności scen w aplikacji (11 nowych scen na początku listy —
testy zaktualizowane świadomie, pozycje przesunięte o 11) i 2 testy wątków hosta pod obciążeniem (osobno 3/3);
zapis: `stage-reports/artifacts/v35418/matrix-summary.json`. Przybyło 37 testów względem R3 (4499 → 4536).

## 14. APK

Nowy APK zbudowany normalnym zadaniem `previewApks` z commita `ba41dbe042ea239677011c249aab0f28f6c560f0` (kod końcowy
i sceny końcowe):

| | |
|---|---|
| Plik | `BuildPlan-Model-Preview-1349-arm64-v8a.apk` (52 932 047 B) |
| SHA-256 | `59a8d8d8af469fd913cf84d5ea4bdfb2c056d4282d6caf0826c58244919b9907` |
| Wersja | `versionCode 1349`, `versionName 0.1349.0-owner`, `com.buildplan.preview` (instaluje się na 1348) |
| Podpis | ten sam certyfikat co 1348: SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (apksigner: zweryfikowany) |
| Sceny | 40 pakietów + indeks; 41 z 41 plików w APK identycznych bajt w bajt z `apps/android/app/src/main/assets/scenes` na tym commicie; 11 nowych scen v3.54.18 na początku listy (host ×2, rozwój ×3, nowe ×3, ślepe ×3 — porażki opisane jako porażki) |
| Klucz API | 0 wystąpień (plik APK i jego rozpakowana zawartość) |
| Urządzenie | **ANDROID_UI_NOT_VERIFIED** — w tej sesji nie ma urządzenia ani emulatora; aplikacji nie uruchomiono |

Kod aplikacji Android nie zmienił się w tym etapie — zmieniły się sceny i indeks. Uwaga techniczna: limit dysku sesji
był wyczerpany (stare paczki z wcześniejszych etapów, których usunięcia mi odmówiono — nie ruszałem ich), więc katalog
roboczy budowy stał w pamięci RAM (`/dev/shm`); pierwsza próba z ograniczeniem do jednej architektury dała APK
oznaczony `testOnly` (nie do instalacji dotknięciem) i została odrzucona — dostarczony plik pochodzi z pełnej,
zwykłej budowy.

## 15. Dostawa

Kod i dokumenty: gałąź `claude/new-session-3kzcgh` (commity z `[skip ci]`, bez merge i PR). Dokumenty etapu:
ten raport, `stage-reports/README_V35418.md` (dla OWNER-a, prostym językiem), `docs/ADR-V35418-FACADE-AND-BODY-ARBITRATION.md`,
`research/source-to-model/v35418/{PROTOCOL.md,HANDOFF.md,references/,scores/}`, `PROJECT_STATUS.md` (podsumowanie),
`docs/MASTER_PLAN.md` (v3.54.18 w całości).

Prywatna dostawa (poza Gitem — zawiera rysunki wydawców):

Pięć zwykłych, niezależnych archiwów ZIP, każde poniżej 30 000 000 B, każde z jednym folderem głównym
`BuildPlan-V35418/`, własnym `README-<część>.txt` (instrukcja łączenia) i `MANIFEST-<część>.sha256`. Po rozpakowaniu
wszystkich do jednego katalogu foldery się łączą, a `gallery.html` działa offline. Sumy SHA-256 samych archiwów są
w pliku `BuildPlan-V35418-SHA256.txt` dostarczonym obok i w odpowiedzi końcowej (raport jest w archiwum 01, więc nie może
zawierać sumy własnego archiwum).

| Archiwum | Zawartość |
|---|---|
| `BuildPlan-V35418-01-RAPORT-GALERIA.zip` | `gallery.html` (legenda LIVE / REPLAY / HOST / KONTROLA, commit, rewizje modeli), plansze `boards/` (źródło \| szkic \| baseline \| po zmianie \| oddany, perspektywa, rzut bez dachu), `host/` (rekordy i wyniki zadań hosta, dzienniki ksiąg, zapis wymiany nieudanego zadania), `grader-packs/` (plansze ślepej oceny), `scores/`, `references/`, `docs/` (ten raport, README dla OWNER-a, ADR, PROTOCOL, HANDOFF, PROJECT_STATUS, księga, podsumowania macierzy, VERSION-1349.txt) |
| `BuildPlan-V35418-02-DEV-K.zip` | `houses/{alaska,aurora,ballina}`: oryginały wydawcy (bajty wydawcy: elewacje, rzuty, przekroje + plansza kontaktowa), wszystkie szkice PNG / SVG / JSON i surowe odpowiedzi, `slots.json` (cztery strony), rendery, a dla każdego wariantu: model, scena, wynik, korekty, zdarzenia, jakość, los faktów, arbitraż bryły, odpowiedzi API surowe i znormalizowane |
| `BuildPlan-V35418-03-NEW-B.zip` | to samo dla `houses/{alberto,medulin,jeziorko}` |
| `BuildPlan-V35418-04-NEW-C.zip` | to samo dla `houses/{mindelo,sakura,g6}` (w tym baseline NO_MODEL Sakury i jej nieudane zadanie hosta) |
| `BuildPlan-V35418-05-KAFLE.zip` | `tiles/<dom>/`: każdy kafel osobno w pełnej rozdzielczości (elewacje modelu każdego wariantu, aksonometrie, rzut kondygnacji, szkice, kopie poglądowe źródeł) — do oceny okien |

APK osobno: `BuildPlan-Model-Preview-1349-arm64-v8a.apk` + `VERSION-1349.txt`.

Wszystkie obrazy modeli w raporcie i galerii to rzeczywiste rendery jednego renderera (`neutral-flat/1`): te same
kamery, skala, paleta i światło dla każdego wariantu. Znaczniki: LIVE (świeże żądania), REPLAY (te same nagrane
odpowiedzi — porównanie algorytmu), HOST (publiczny host), KONTROLA (nie użyto).
