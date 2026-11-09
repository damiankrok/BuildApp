# SOURCE-TO-MODEL — kampania po audycie v3.51.0 (raport roboczy)

Gałąź `claude/new-session-3kzcgh`, baza audytu `14ecb73` (produkcja jak `572b875`, APK 1322).
Zasady: `CLAUDE.md`, `AGENT_PROTOCOL.md`, `APP_SPEC.md`, `docs/ANALYZER_CONTRACT.md` (przyjęte z paczki audytu, `c0a35d3`).

| | stan |
|---|---|
| **SLICE C1a** (pochodzenie per właściwość) | **PASS** |
| **SLICE C1b** (konsument pionowej relacji przekroju) | **PASS** w zadeklarowanym zakresie (jedna rodzina: wysokość parteru w świetle); jeden wpis kontrolny zamrożony błędnie — patrz niżej |
| **SLICE C2** (jedna polityka korekt, typowane znaczenie, finalny ślad) | **PASS** dla polityki, typów i śladu; relacja balkon/podest bez płyty — **PARTIAL** (typ i zapis są, brak przypadku w korpusie i testu kompozycji z odmową płyty) |
| **SLICE ANY-LINK** (zlecenie OWNER-a z 2026-11-09: dowolny link → model) | **PARTIAL** — z 0 modeli na kodzie 1322 do modeli częściowych na 2 z 4 zmierzonych stron innych wydawców i na Bukszpanach; „dowolny link z dowolnej strony” **niespełnione** |
| **CAMPAIGN** | **WORK_IN_PROGRESS** |
| **VERIFICATION** | host: testy i replaye — tak; bundle APK — w toku (APK 1324 z rewizji `6ce867c`; wersje i manifest sprawdzane po budowie, uruchomienie bundla na hoście nie wykonane); Android UI — **NOT_VERIFIED** (brak urządzenia); live API — nie uruchamiane (0 płatnych wywołań) |
| **NEXT** | dokończyć końcowy przebieg na `6ce867c` (próbka ANY-LINK + pełna ścieżka 33 domów), wpisać wyniki, dostarczyć APK 1324 i ZIP; potem dach i wysokości bez przekroju (z opublikowanego kąta, wysokości budynku i elewacji), bo to najsilniejsze ograniczenie nowych modeli |

## 1. Baseline i sposób porównania

- Ekstrakcja zamrożona: pełna ścieżka `572b875` na 33 projektach (ta sama, co dostawa 1322). C1a/C1b/C2 zmieniają tylko
  reguły solvera, więc baza i kandydaci to **replay solvera na tych samych zamrożonych dowodach**; baza odtwarza modele
  1322 bajt w bajt (27/27). Zmiana formatu czytnika (typowane role alternatyw, czytnik 1.13.0) jest sprawdzona osobno
  świeżą pełną ścieżką kandydata (§5).
- **Błąd metody, wykryty i naprawiony w trakcie:** pierwsze „zamrożone drzewa” dzieliły `node_modules` z głównym
  checkoutem, więc wykonywały kod roboczy. Oba dotknięte przebiegi unieważniono i powtórzono na drzewach z własnymi
  dowiązaniami pakietów (`mk-nm.sh`); wszystkie liczby poniżej pochodzą z powtórzonych przebiegów.
- Zestawy zamrożone przed wynikami kandydata: `research/source-to-model/FROZEN-C1.json`, `FROZEN-C2.json`,
  `ANYLINK-SET.json`. Wszystkie domy są znane z wcześniejszych etapów (nie-ślepe); Balsamowce to CONTROL z otwartego EVAL.
  H2 nieużyte.

## 2. C1a — pochodzenie każdej właściwości poziomu

Przyczyna (potwierdzona): `levelsFrom` zwracał dla całej drabiny jedno `measured: true`, a konsument nadawał z niego
`SOURCE_EXACT`/L2 każdej elewacji i każdej wysokości — także konwencjonalnym 2,80 m między ±0,00 a kalenicą, powtórzonej
wysokości kondygnacji i podłodze dopisanej z konwencji. Druga przyczyna, znaleziona przez miernik: `amend()` zmieniał
wartość parametru, zostawiając stare pochodzenie.

Zmiana: `levelsFrom` podaje podstawę każdej podłogi i każdej wysokości; cecha LEVEL ma pochodzenie per parametr
(wydrukowana rzędna = `SOURCE_EXACT`, różnica dwóch wydrukowanych = `SOURCE_DERIVED`, konwencja/powtórzenie =
`ASSUMED_FOR_RENDERING` i nazwane nierozstrzygnięte); cecha z parametrem przyjętym nie dostaje L2; poprawiana wartość
podaje własne pochodzenie; `heights.measured` w wyniku produktu liczy się z każdej kondygnacji osobno.

Miernik niezależny od czytnika (`scoring/score_c1a.py`: znaki naniesione z oryginalnych przekrojów), 47 cech poziomów
w 27 modelach (6 projektów bez modelu policzone osobno, 2 cechy bez referencji):

| | baza 1322 | kandydat |
|---|---|---|
| wysokość: autorytet źródłowy bez pokrycia w źródle | 45 / 45 (wszystkie przy L2) | **0 / 45** |
| rzędna: autorytet źródłowy bez pokrycia | 2 / 45 | **0 / 45** |

Geometria: C1a nie zmienia żadnego modelu (27/27 bajt w bajt). Testy: 9 (7 padają na starym kodzie, 2 przypadki
przeciwne przechodzą na obu).

## 3. C1b — wysokość parteru w świetle z przekroju dochodzi do modelu

Przyczyna: pionowe wymiary przekroju (czytnik 1.12.0) trafiały do księgi jako `IGNORED_WITH_REASON`; pas stropu liczono
z **ukrytej stałej 2,72 m** (wartość pierwszego domu referencyjnego).

Zmiana (`v2/section-clear-height.ts`): wymiar jest wiązany **geometrią**, nie nazwą czytnika ani prozą — dolny koniec na
wierszu wydrukowanej podłogi (host), rozpiętość w skali drabiny równa wartości (zła linia odpada), pas do wydrukowanej
podłogi wyżej fizycznie możliwy (0,15–0,50 m). Skutek w finalnym modelu: wysokość ścianek pod stropem = wydruk, grubość
stropu = wydrukowana podłoga − wydruk; na cesze parteru `clearHeight: SOURCE_EXACT`, `slabBand: SOURCE_DERIVED`, wymiar
w księdze `USED_IN_MODEL`. Bez odczytu 2,72 m zostaje — nazwane jako `ASSUMED`. Dwa niezgodne odczyty: oba nazwane,
żaden niezastosowany. Bez wydrukowanej podłogi wyżej (parterówka, znak okapu) pasa nie ma.

Zamrożony zestaw (`scoring/score_c1b.py`, sprawdza końce/hosta/efekt w modelu osobno od równości liczby):

| rola | projekt | oczekiwane | baza | kandydat | ablacja (bez wymiarów przekroju) |
|---|---|---|---|---|---|
| DEV | Marcówki 272 | skonsumowane | FAIL | **PASS** (2,72; 0,34) | FAIL |
| DEV | Arletach 264 | skonsumowane | FAIL | **PASS** (2,72 → 2,64; strop 0,24 → 0,32) | FAIL |
| DEV | Dalie 273 | skonsumowane | FAIL | **PASS** (2,72 → 2,73; 0,34 → 0,33) | FAIL |
| DEV | a01 274 | jeśli odczytane | NOT_READ | NOT_READ | NOT_READ |
| CONTROL | Bratki 260 | jeśli odczytane | FAIL | **PASS** (2,72 → 2,60; 0,24 → 0,36) | NOT_READ |
| CONTROL | Balsamowce 263 | jeśli odczytane | NOT_READ | NOT_READ | NOT_READ |
| NEGATIVE | Renklody, Kostrzewy, Ciesz | nieskonsumowane | PASS | PASS | PASS |
| DEV-COUNTER | Sasanki | nieskonsumowane | PASS | **FAIL (jak zamrożono)** | PASS |

- **Sasanki — wpis zamrożony błędnie, niezmieniony:** przekrój drukuje dwie wysokości parteru: 273 (przy znakach ±0,00
  i +3,06 — pominięte we wpisie) i 278. Kandydat odrzuca odczyt łańcuchowy 278 (zła linia — zamierzony kontrprzypadek
  działa) i konsumuje 273 odczytane na własnej linii. Ograniczenie nazwane: solver nie widzi niezgodności 273/278
  w samym źródle, bo 278 nie jest związane z linią. Sprostowanie zapisane jako `amendments`, werdykt zostaje FAIL.
- Poza zestawem konsument zadziałał też w Aurorach, Jabłonkach i Murajach (zgodnie ze znakami 264/265/261).
- Pełny zakres skutku (regress element po elemencie, baza → kandydat): zmieniają się wyłącznie stropy, ścianki pod
  stropem i otwory sięgające stropu w tych domach; żaden otwór ani bryła nie znika.
- Testy: 10 (przyjęcie + zła linia, zły host, brak podłogi wyżej, podłoga z konwencji, znak okapu, konflikt, duplikat).

## 4. C2 — jedna polityka korekt, typowane znaczenie, finalny ślad

Przyczyny (potwierdzone w kodzie): repair miał ochronę „drzwi sięgają podłogi”, alignment nie; repair przycinał próg do
globalnego 0, alignment do podłogi kondygnacji; `FRENCH_WINDOW_NOTE` w `unresolved` oraz prefiksy `why` („width
candidate…”) sterowały rodziną i kandydatami wymiaru; cecha OPENING powstawała przed alignment/repair/fit i nie była
aktualizowana.

Zmiana:
- `v2/opening-correction.ts`: jedna funkcja dopuszczenia dla obu ścieżek, odmowy kodem (m.in. `DOOR_OFF_ITS_ACCESS`,
  `BELOW_ITS_FLOOR`); próg drzwi odnosi się do **własnej powierzchni dostępu** (podłoga kondygnacji albo typowane
  `access`: podest / stopień / podłoga split-level), nigdy do globalnego 0.
- Typy zamiast prozy: `glazingToFloor: 'FRENCH_WINDOW'` na otworze; `role`/`gate` na alternatywach opisu (czytnik
  1.13.0); `stepsOnto` — relacja otworu z balkonem/tarasem zapisana osobno od tego, czy płyta powstała.
- `v2/opening-final.ts`: po ostatniej korekcie i emisji cecha otworu niesie decyzję **przyjętą** (parametry
  z własnym pochodzeniem) i osobno **zastosowaną** (`application`: `AS_ACCEPTED` / `FITTED` z wartościami i kodem /
  `NOT_BUILT`). Źródłowy wymiar nie jest nadpisywany tym, co zmieścił model.

Miary zamrożone (`FROZEN-C2.json`, `scoring/score_c2.py`), 354 cechy otworów w 27 modelach:

| | baza 1322 | kandydat |
|---|---|---|
| ślad: wartość w grafie, której model nie ma, bez informacji (STALE) | 41 | **0** |
| ślad zgodny / jawna różnica przyjęte–zastosowane / bez stanu | 0 / 0 / 313 | **326 / 28 / 0** |
| rodzaj przyjęty = zbudowany | brak zapisu | 351 / 351 |
| drzwi zewnętrzne nad własną podłogą | 0 / 130 | 0 / 130 |

- Uczciwie: **luka w alignment nie dawała błędu w tym korpusie** (0/130 przed i po) — zysk tej części to spójność
  uprawnień i testy, nie zmiana modeli. C2 nie zmienia geometrii żadnego domu.
- Ślad ujawnia znane wady geometrii, których nie naprawia (np. Dalie: przeszklenie poddasza „drzwi” o wysokości 0,30 m
  po dopasowaniu do ścianki kolankowej — teraz jawnie `FITTED`, nie ukryte).
- Testy: 15 nowych (własny poziom, kondygnacja wyżej, stopień, split-level, zwykłe okno, wydruk, dopasowanie do
  ściany; ten sam kandydat w alignment i repair = ten sam kod; zmiana tekstu notatki nie zmienia modelu; kompozycja
  przyjęcie → korekta → emit/fit/odmowa → finalny zapis) + 2 w teście okna francuskiego. Siedem testów dawnej formy
  zastąpiono niezmiennikiem, który chroniły (kod odmowy zamiast zdania, typowane role w fiksturach, polecenie po id).

## 5. ANY-LINK — dowolny link → model (zlecenie z 2026-11-09)

Pomiar bazowy na kodzie 1322, pełna ścieżka od samego adresu, próbka zamrożona przed uruchomieniem (pierwszy link
projektu z listingu każdego wydawcy):

| wydawca | kod 1322 (baza) | po poprawkach |
|---|---|---|
| dobredomy.pl | brak modelu: skala rzutu | **model częściowy**: obrys 93,2 m² = opublikowana zabudowa (2,46 cm/px), 8 otworów; bez dachu i poddasza |
| lipinscy.pl | brak modelu: skala rzutu | **model częściowy** (replay na zebranych dowodach): trzy bryły parterowe z otworami; bez dachu głównego |
| extradom.pl | brak modelu: brak rysunków | brak modelu — 97 obrazów bez podpisów; piksele widzą rzuty z pewnością 0,51–0,83 (< 0,9); 99 adresów poza budżetem pobrań |
| domoweklimaty.pl | brak modelu: brak rzutu | brak modelu — rzuty nie występują w statycznym kodzie strony |
| houseplans.com | brak modelu: skala rzutu | w toku |
| architecturaldesigns.com | w toku (przebieg bazowy nie wystartował przez błąd skryptu; powtarzany) | w toku |
| ARCHON: Bukszpany | brak modelu: skala rzutu | **model** (replay): obrys 68,95 m² = opublikowana zabudowa, dach dwuspadowy, brama, wejście, okna dachowe, 0 błędów kompilatora |
| ARCHON: Modrzewnica, Santany, Eliza, Julia, Ofelia | brak modelu | do potwierdzenia w końcowym przebiegu |

Przyczyny i poprawki ogólne (bez wyjątków po stronie, hoście czy domu):
1. **Brak skali rzutu** (cztery przypadki: dwie obce strony, Bukszpany, Modrzewnica — ta sama postać: żadna wydrukowana
   miara nie ustala skali, strona publikuje powierzchnię zabudowy). `v2/published-scale.ts`: skala, przy której obrys
   ścian z rzutu ma opublikowaną powierzchnię zabudowy (iteracyjnie), pytana **tylko tam, gdzie bieg i tak by stanął**;
   jawnie przybliżona — rejestracja bez kotwic, luka `AMBIGUOUS`, skala w wyniku niezweryfikowana („proporcje, nie
   obmiar”). Opublikowana liczba jest tym samym zużyta i nie weryfikuje już układu.
2. **Brak ról przy stronie bez podpisów**: gdy żaden obraz nie jest opisany jako rzut, nieopisany obraz dostaje rolę,
   którą pokazują jego piksele (rzut/elewacja/przekrój, ortogonalny, pewność ≥ 0,9 — ta sama, której wymaga weto
   treści); zatrzymanie „brak rysunków” czeka na ten odczyt. Strony z opisanymi rzutami są nietknięte.

3. **Relacja do niezbudowanego otworu** odmawiała całego domu (lipinscy): dopasowanie usuwa teraz relację razem
   z otworem, a emiter stwierdza relację narożną tylko między otworami, które wyciął.

Uczciwie o wyniku: nowe modele to **częściowe podglądy** (`PARTIAL_3D_PREVIEW`) — poprawny obrys i otwory, skala
i wysokości oznaczone jako przyjęte, na obcych stronach bez dachu (brak przekroju; układ zgłasza
`STRUCTURE_SILHOUETTE_DISAGREES`). To jest „jakiś model zamiast odmowy”, nie „należycie odtworzony dom”.

## 6. Świeża pełna ścieżka kandydata, testy, dostawa

**W toku (checkpoint):** świeża pełna ścieżka rewizji `6ce867c` (czytnik 1.13.0, solver 2.32.0) na 33 projektach korpusu — wynik i porównanie z replayem zostaną dopisane.

Testy: zestawy pakietów po C2 — 2088 testów, 7 dawnej formy przepisanych na niezmienniki (wszystkie 7 przechodzą po zmianie); typecheck z testami 0 błędów. Pełna macierz na końcowej rewizji `6ce867c`: **do wykonania po przebiegach** (pod obciążeniem daje fałszywe timeouty).

APK: **1324 w budowie** z `6ce867c` (ten sam podpis). Plik 1323 zbudowany z `68f2ead` nie został dostarczony i jest porzucony (rewizja zmieniła się o poprawkę relacji).

Prywatna paczka dowodów (poza Git): po zakończeniu przebiegów — replaye baza/C1a/C1b/ablacja/C2, pełna ścieżka, próbka ANY-LINK, wyniki, zamrożone zestawy, dzienniki; bez obrazów wydawców.

## 7. Nierozwiązane, nazwane

- ANY-LINK: dach, poddasze i wysokości przy braku przekroju; odkrywanie rzutów ładowanych skryptem (domoweklimaty); pewność klasyfikatora pikseli na rysunkach innych wydawców i budżet pobrań na stronach z galerią cudzych projektów (extradom); strony bez opublikowanej powierzchni zabudowy nie mają skali awaryjnej; z500.pl i mgprojekt.com.pl odmawiają klientowi (HTTP 403); próbka to 6 stron, nie statystyka.
- Sasanki: źródło drukuje dwie wysokości parteru (273/278); zastosowano jedną, konflikt niewidoczny dla solvera.
- C1b obejmuje jedną rodzinę (wysokość w świetle parteru); ścianki kolankowe, wysokości wyższych kondygnacji i stropy
  nad nimi nadal nie mają konsumenta. a01 i Balsamowce: wymiar nieodczytany przez czytnik.
- C2: relacja balkonu obserwowanego bez płyty ma typ i zapis, bez przypadku w korpusie; `access` (podest/stopień) nie
  ma jeszcze czytnika — politykę sprawdzają testy.
- Znane z 1322 i nietknięte: poziom poddasza Ciesz (+2,93 zamiast +3,34), wysokości dwóch okien Ciesz, lewe okno tylne
  Bakop z konwencji; bramki przypisania opisów, kątów i pokrycia wymiarów pionowych niespełnione.
- 0 płatnych wywołań; księga bez zmian (0,60838938 USD z 5 USD, estymata, rozliczenie niepotwierdzone).
