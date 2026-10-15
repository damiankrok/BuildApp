# STAGE BUILDPLAN-ANALYZER-005R — router zasobów wizualnych i obserwacje zewnętrzne w JSON (badanie)

**Klasa: RESEARCH. Zero zmian produkcyjnych** (zamrożenie IDENTICAL, §M). Bez APK, bez ślepej rundy, bez 005S.
Baza `39061dbed453d7af4e538b1fcbe4584496fa223e` (zamknięcie 005Q-CHAIN). Gałąź
`analyzer/visual-asset-exterior-json-research-v1`, każdy push lustrzany do `claude/new-session-3kzcgh`.

## Podsumowanie dla OWNER-a

| pytanie | odpowiedź z pomiarów |
| --- | --- |
| Czy da się lokalnie i offline odróżnić rzuty, elewacje, przekroje, sytuacje, wizualizacje zewnętrzne i wnętrza? | **Rysunki techniczne tak, wizualizacje zewnętrzne nie.** Na EVAL (14 rodzin ARCHON, 231 grup linii) wszystkie routery trafiają rzuty, przekroje, sytuacje i elewacje prawie bez błędu, ale **żaden nie rozpoznaje poprawnie ani jednej z 20 grup wizualizacji zewnętrznych**. Preregistrowany próg (≥ 70 % pokrycia EXTERIOR_RENDER) nie jest spełniony przez żaden wariant. |
| Który algorytm lokalny jest najlepszy? | Na sumach V1 (deterministyczne cechy CV + reguły z DEV): 90,5 % pokrycia, 1,9 % ryzyka selektywnego. **Ale V1 rozpoznaje format obrazu, nie treść**: po dopełnieniu tych samych pikseli do kwadratu prawie każde rozstrzygnięcie się zmienia (A1), a wszystkie 54 syntetyczne wizualizacje zewnętrzne trafiają do „wnętrz”. V2 (OWL-ViT B/32, lokalnie) jako klasyfikator jest zdegenerowany: osadzenia obrazów mają między sobą kosinus 0,997–1,000 (B1), więc wszystko jest „wnętrzem”. |
| Czy któryś detektor rozpoznaje tarasy, pergole, balustrady, wiaty, daszki? | **Nie.** Nawet na syntetycznej prawdzie, z idealnym routingiem, V2 przy progu 0,20 znajduje 0/33 pergol, 0/19 wiat, 0/41 daszków wejściowych, 0/36 tarasów zadaszonych, 0/43 tarasów na gruncie, 0/64 schodów, 0/254 słupów, 11/40 balkonów i 2/51 balustrad. Dobrze widzi tylko okna (P 0,96, R 0,95) i drzwi. Na prawdziwych obrazach prawdy cech nie ma (**HUMAN_LABELS_NOT_RUN**): wyniki tylko opisowe. |
| Co jest główną przyczyną utraty elementów zewnętrznych dziś? | **Pierwsza zła operacja (KNOWN, audyt §8.2 X):** adapter ARCHON zamienia „wizualizacja” na `PERSPECTIVE_RENDER` bez klasy wnętrza (`archon.ts:98`, `schema.ts:45`), a `analyze.ts:164` puszcza te obrazy przez ekstraktory elewacji. **Zmierzone:** na pełnowymiarowych obrazach każdy obraz, który produkcja nazywa `PERSPECTIVE_RENDER` i ma prawdę strukturalną, jest **wnętrzem** (70 z 70); żadna z 78 pełnowymiarowych wizualizacji zewnętrznych nie dostaje tej roli. |
| Czy wiersz „rarytasy-g2e” to dom OWNER-a? | **Nie.** To „Dom w rarytasach **5** (G2E)” `m84f2903cb8e14`. Kotwica OWNER-a `m3ea28300f9b3e` nie ma w repozytorium żadnego przebiegu. Kotwica dzieli 25 bajtowo identycznych obrazów z e-OZE i tylko 10 z „rarytasy-g2e”; 109 ze 136 par edycji Rarytasów dzieli bajty. |
| Rekomendacja | **`NO_SAFE_VISUAL_CANDIDATE`** (zakres: ARCHON). Bezpieczny kontrakt JSON istnieje i działa, bramki bezpieczeństwa przeszły — ale **przez wstrzymanie się**, nie przez rozpoznanie. Najbardziej obiecujący sygnał routera to **struktura strony wydawcy**, której adapter dziś nie czyta; to zmiana produkcyjna, poza zakresem 005R. |

**Werdykt: `PARTIAL_RESEARCH_BUILDPLAN_ANALYZER_005R_NO_SAFE_VISUAL_CANDIDATE`.** Pytanie o router zmierzone do końca
(odpowiedź negatywna); pytanie o cechy zewnętrzne na prawdziwych obrazach — `NOT_MEASURED` (brak niezależnej prawdy);
drugi wydawca — `SOURCE_NOT_USABLE`; ARM64 — `PENDING`.

## A. Baza, gałąź, zamrożenie, źródła

- Start: upstream, lustro i lokalny HEAD równe `39061db…` (sprawdzone przed rozgałęzieniem).
- Zamrożenie: `research/analyzer-005r/freeze-manifest.mjs` (pakiety, aplikacje, `.github`, manifesty, lockfile,
  `holdout/`, `docs/`, testy poza jednym testem izolacji, **cały śledzony plik poza allowlistą 005R** jednym skrótem,
  wagi OCR, słownik, WASM). Start `0d02e53`, koniec §M: **FREEZE: IDENTICAL**.
- Dotknięte ścieżki: `research/analyzer-005r/`, `stage-reports/artifacts/analyzer-005r/`, ten raport,
  `PROJECT_STATUS.md`, blok 005R w `tests/architecture/research-isolation.test.ts`.
- **Źródła (brief §4):** ARCHON — `USABLE_FOR_LOCAL_RESEARCH` (robots dopuszcza strony produktu, regulamin sklepu nie
  zabrania kopiowania do analizy lokalnej). **DobreDomy — `SOURCE_NOT_USABLE`**: regulamin §7.2 dopuszcza kopiowanie
  i wykorzystanie materiałów wyłącznie za zgodą sprzedawcy; ankieta usunięta, żaden obraz nie pobrany. Zamienniki
  Archipelag i Domy w Stylu mają tę samą klauzulę; Z500 i MG Projekt — regulamin nieczytelny bez JS, nieużyte.
  **Uwaga dla OWNER-a:** wcześniejsze etapy (005C, 005K, D00–D05, aster-viii, galaktyka) przetwarzały DobreDomy; czy
  jest zgoda — pytanie do OWNER-a. `corpus/source-eligibility.json`.
- Piksele wydawcy, HTML, podpisy, wagi i wyniki z pełnymi URL-ami leżą w `/home/user/work005r` (poza Git).
  **Żaden obraz wydawcy nie trafił do zdalnego modelu** — także do mnie: nie otworzyłem żadnego obrazu wydawcy;
  oglądałem wyłącznie własne obrazy syntetyczne. Pisarze pikseli odmawiają zapisu w repozytorium (test).
- OWNER APK `owner-preview-latest` (versionCode 1212) nietknięty.

## B. Audyt (przed eksperymentami)

`research/analyzer-005r/current-pipeline-audit.md` (`c1ab121`): 8 czytelników kodu, po jednym weryfikatorze-adwersarzu,
synteza, krytyk kompletności (13 braków, 10 korekt, 6 zmian znaczników, 9 brakujących wierszy — zastosowane po
ponownym otwarciu cytatów; §11 wymienia, czego nie zastosowano i dlaczego). Surowe wyniki:
`architecture/audit-raw.json`, `architecture/audit-critic.md`. Raport „Work OSS”: **NOT_AVAILABLE**.

Najważniejsze ustalenia (K = kod, M = zmierzone):

- (K) `DocumentRole` nie ma wnętrza, zdjęcia ani „innego”; `ELEVATION` obejmuje także fotorealistyczne elewacje
  ortogonalne. Role to wyłącznie roszczenia z tekstu/kanału, scalane maksimum pewności.
- (K/M) wizualizacje wnętrz idą przez ekstraktory elewacji (`analyze.ts:164`); w g2e 19 klatek wnętrz niesie RIDGE,
  OPENING, LOGGIA; przy rozwiązanej kamerze obserwacje takiej klatki stają się „corroboration” (`reconstruct-v2.ts:1177`).
- (K) z 14 klas 005R produkcja buduje z obrazów tylko fragment balkonu/balustrady (marcowki) i otwory z rzutu;
  pergola, wiata, daszek, schody zewnętrzne, słupy, taras zadaszony — brak producenta na ścieżce produktu.
- (K) przecieki statusu twardego: wartości z rejestrowanej elewacji fotorealistycznej mogą zostać SOURCE_CORROBORATED.
- (M) tekst wydawcy („taras osłonięty pergolą”) nigdy nie jest czytany.

## C. Prerejestracja i addenda

`research/analyzer-005r/preregistration.md`, **`bdd50b8` (2026-10-15T01:36:09Z)** — przed wyprowadzeniem prawdy
i przed jakimkolwiek przebiegiem wariantu (jedyny wcześniejszy przebieg: obraz-zaślepka do sprawdzenia, że kod się
ładuje). Zawiera korpus (manifest `67dd756c…`), podział rodzin, warianty, procedurę prawdy, metryki, bramki twarde,
reguły decyzji, hashe kodu, promptów i wag.

- **Addendum A** (`cfe95ab`, po wynikach V0a/V0b/V1/N1, **przed** odczytem V2): diagnostyki post-hoc A1 (skrót
  formatu obrazu) i A2 (prawda propagowana w grupie linii). Nie zmieniają żadnej reguły.
- **Addendum B** (po V2): B1 (wierność implementacji V2), poprawka błędu w `assemble.py` (wiersze syntetyczne),
  `claims.py` napisany po prerejestracji (metryka była zarejestrowana, kod nie), M10 w mutacjach.
- {{ADDENDUM_C}}

## D. Korpus i prawda

- Uniwersum edycji (reguła, nie wybór): 44 strony z 48 wierszy rozwojowych 005Q-CHAIN + 17 edycji rodziny Rarytasy
  z endpointu „family” kotwicy. 59 stron; po wykluczeniu DobreDomy: **50 edycji ARCHON** (strona przedruku z tym samym
  kodem ARCHON scala się z edycją). Rarytasy to wykluczona rodzina rozwojowa puli — **bez ślepego losowania**.
- Pobrano 1 871 z 1 871 dozwolonych URL-i (robots, 1 żądanie/s). **1 352 unikalne zasoby** (SHA-256), 1 220 punktowanych
  (krótszy bok ≥ 256 px), **761 grup linii** (dHash ≤ 6), 34 rodziny; podział po skrócie rodziny: **DEV 20 rodzin,
  EVAL 14**. Cała rodzina Rarytasy wypadła w DEV — jej liczby są in-sample.
- **Prawda ról = STRUKTURA strony** (pozycja karuzeli `fancybox3Interiors`, zakładka elewacji, fragmenty rzutów,
  oryginał z hotspotu, przekrój), plus „sytuacja” z adresu (SLUG). Wynik: EXTERIOR_RENDER 78, INTERIOR_RENDER 213,
  TECHNICAL_ELEVATION 198, FLOOR_PLAN 154, SECTION 50, SITE_PLAN 50, UNKNOWN 609, konfliktów 0.
- Niezależność: V1, V2 i pikselowa połowa N1 nie widzą metadanych (pliki nazwane skrótem SHA). V0a czyta adres i podpis,
  więc jego zgodność z bazą inną niż STRUCTURE to zgodność metadanych, nie dokładność.
- **HUMAN_LABELS_NOT_RUN.** Prawdy cech na prawdziwych obrazach brak. Korpus syntetyczny (`synth.py`, ziarno 5005,
  185 obrazów, 12 domów, look-alike'i, lustro, kadr, pomniejszenie, 3 pary edycji) ma prawdę z konstrukcji.

## E. Warianty

| id | co | Task A | Task B |
| --- | --- | --- | --- |
| V0a | produkcja `source:acquire`, niezmieniona (cache zasiany bajtami 005R) | roles.document | brak (produkcja nie emituje żadnej z 14 klas) |
| V0b | V0a + najlepszy prosty kikut pikselowy na `PERSPECTIVE_RENDER` (DEV) | metadane + kikut | brak |
| V1 | 20 cech CV (Node, bez zależności) + CART głęb. 4 z DEV; wstrzymanie przy czystości liścia < 0,9 | piksele | wskazówki RAILING/GARAGE_DOOR tylko na elewacjach |
| V2 | **jeden** lokalny detektor: OWL-ViT B/32 `cbc355fb…`, wagi `4dbe0399…` | softmax promptów (klasyfikator, bez ramek) | detekcja z ramkami (lokalizator) |
| N1 | mój: roszczenie wydawcy (V0a) **i** router pikselowy (V1) muszą się zgadzać; inaczej UNKNOWN | fuzja | ramki V2 tylko na zasobach N1-zewnętrznych |
| V3 | **NOT_RUN_PREVIOUS_005M_SAFETY** (decyzja przed wynikami; 005M: 30,9 % pewnie błędnych, ≥ 1,5 GB) | — | — |

## F. Wyniki ról (EVAL, jedna pozycja na grupę linii; DEV in-sample obok w artefakcie)

| wariant | rozstrz. / 231 | pokrycie | ryzyko selekt. (Wilson; bootstrap rodzin) | EXTERIOR_RENDER popr./rozstrz./prawda | INTERIOR | ELEVATION | wnętrze→zewn. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V0a | 104 | 45,0 % | 0 % (0–3,6; 0–0) | 0 / 0 / 20 | 0/0/107 | 53/53/53 | 0 |
| V0b | 158 | 68,4 % | 0 % (0–2,4; 0–0) | 0 / 0 / 20 | 54/54/107 | 53/53/53 | 0 |
| V1 | 209 | 90,5 % | 1,9 % (0,8–4,8; 0–5,4) | **0 / 2 / 20** | 107/107/107 | 49/49/53 | 0 |
| V2 | 16 | 6,9 % | 0 % (0–19,4; 0–0) | 0 / 0 / 20 | 16/16/107 | 0/0/53 | 0 |
| N1 | 152 | 65,8 % | 0 % (0–2,5; 0–0) | 0 / 0 / 20 | 54/54/107 | 49/49/53 | 0 |

- V0a na samej bazie STRUCTURE: 90 rozstrzygnięć z 207, ryzyko 0.
- **V1 — skrót formatu (A1):** po dopełnieniu do kwadratu (białym) elewacje → SITE_PLAN (136/140 DEV, 50/52 EVAL),
  wnętrza → SITE_PLAN/FLOOR_PLAN (103/107 EVAL); szarym — elewacje → INTERIOR_RENDER (140 DEV, 52 EVAL). Reguły V1
  dzielą głównie po `aspect` (`contenders/v1-model.json`). Syntetyczne wizualizacje zewnętrzne (1280×853): 54/54 → wnętrze.
- **V2 — klasyfikator zdegenerowany (B1):** logity zgodne z biblioteką (|Δ| ≤ 2·10⁻⁶), ale osadzenia obrazów są
  praktycznie stałe (kosinus 0,997–1,000). Bez progu wszystko jest INTERIOR_RENDER: pewnie błędnych 53,7 % EVAL,
  72,8 % DEV. Procedura τ z prerejestracji dała τ = 0,95.
- **N1 odrzucony przez własny falsyfikator** (§6 prerejestracji): ryzyko nie niższe niż V0b (0 = 0) i pokrycie
  EXTERIOR_RENDER 0 % < 50 %.
- A2 (prawda propagowana w grupie, wrażliwość): żaden wariant nie ma ani jednego poprawnego EXTERIOR_RENDER na EVAL.
- Korelacja duplikatów: 26 grup z ≥ 2 zasobami na EVAL, 0 z różnymi wyjściami u każdego wariantu.

## G. Obserwacje cech zewnętrznych

**Syntetyczne (prawda z konstrukcji), routing idealny, V2 @ 0,20:** łącznie P 0,910, R 0,465 — niesione przez okna
(P 0,96, R 0,95) i drzwi (P 0,72, R 0,94). Klasy docelowe: PERGOLA 0/33, CARPORT 0/19, CANOPY 0/41, COVERED_TERRACE
0/36, TERRACE 0/43, STEPS 0/64, COLUMN 0/254, BALCONY 11/40 (1 FP), RAILING 2/51, GARAGE_DOOR 0/26 (7 FP), LOGGIA 0/25
(7 FP). Look-alike: 0 przy 0,2 (38 przy 0,05). Kadr: 0 halucynacji przy 0,2 (24 przy 0,05). Lustro: Jaccard rodzajów
0,6–1,0. Pary edycji: zamieniony element nie jest wykrywany w żadnej wersji (f01, f02); f04 — balkon „widziany” na
edycji bez balkonu. Krzywa progów w `features/feature-scores-synthetic.json`.
**V1 (wskazówki na elewacjach):** GARAGE_DOOR P 1,0 R 0,5 (7/14); RAILING P 0,14 (36 FP).

**Prawdziwe (bez prawdy — opisowo):**
- Według własnego routingu: V0a/V0b/V2 nie proponują nic; V1 proponuje **5 037 balustrad** na 49 edycjach (żadna nie
  deklaruje balustrady) — wskazówka okresowości odpala na okładzinach/szprosach; N1 proponuje 978 (okna 717, drzwi 159,
  brama 36, schody 36, pergola 6…) wyłącznie na elewacjach.
- Z routingiem z prawdy strukturalnej (wyrocznia) V2 na wnętrzach daje 153 „drzwi zewnętrzne”, 28 balustrad, 26
  schodów, 8 tarasów, 4 wiaty — bez routera detektor produkowałby twierdzenia wnętrze→zewnątrz.
- Roszczenia wydawcy na poziomie edycji (kategorie + opis): pergola 28 edycji, taras 47, garaż 29, daszek 14, taras
  zadaszony 10, balkon 7. N1 „potwierdza” pergolę na 4/28 i bramę na 16/29; tarasu nie proponuje nikt. To spójność,
  nie dokładność.

## H. Tożsamość edycji

64 zasoby publikowane bajtowo przez ≥ 2 edycje (wszystkie to wnętrza lub obrazy bez prawdy), maksimum 14 edycji
na jeden obraz, 66 grup linii przekracza edycję; 0 zasobów między rodzinami. Kotwica `m3ea…` vs „rarytasy-g2e”
(G2E-5): 10 wspólnych bajtów / 5 grup; vs e-OZE: 25 / 12. Żadna wizualizacja zewnętrzna ani elewacja nie jest
wspólna między edycjami. Kontrakt JSON wymusza tożsamość (EDITION_MIX, CORRELATION — zabite mutacjami).

## I. Kontrakt JSON i bramki twarde

`research/analyzer-005r/schema/` — `research.visual-observations.0.1` i `research.visual-edition-summary.0.1`
(walidator stdlib, przykłady syntetyczne, 16 testów). Powiązania z istniejącymi typami (bez ich zastępowania): audyt §6
i §9. 6 100 dokumentów i 98 podsumowań edycji: **0 naruszeń** u każdego wariantu — 0 twierdzeń autorytatywnych,
0 mieszania edycji, 0 twierdzeń wnętrze→zewnątrz (walidator i prawda), 0 sfabrykowanych ramek, 0 przecieków.
**Bramki przeszły przez wstrzymanie, nie przez rozpoznanie.**

## J. Mutacje — 12/12 zabitych

M1 zamiana prawdy/wyjścia w scorerze, M2 wyciek EVAL do dopasowania, M3 zamiana źródła, M4 zamiana edycji,
M5 sfabrykowana ramka, M6 nazwa projektu w uzasadnieniu, M7 promocja pewności, M8 wymiar metryczny z renderu,
M9 wnętrza routowane jako zewnętrze (licznik prawdy > 0), M10 skorelowani świadkowie liczeni dwa razy, M11 podpis
w manifeście (test izolacji pada), M12 nazwa projektu w promptach (test izolacji pada). `mutations/mutations.json`.

## K. Determinizm, koszt, licencje

- V0: role i warianty identyczne w 51/51 pakietach (online, offline r1, offline r2); r1 = r2 bajtowo w skrócie treści;
  online różni się tylko kodem porażki sond hi-res (HTTP 404 vs brak w cache).
- V1: cechy identyczne bit w bit — Node 22 ×2 i **Node 18.20.4**.
- V2: {{V2_DETERMINISM}}
- Koszt: {{BENCH}}
- Licencje (`research/analyzer-005r/licensing.md`): V1 — zależności już produkcyjne (BSD-3/MIT). V2 — wagi Apache-2.0,
  ale dane treningowe częściowo nieujawnione i częściowo niekomercyjne → **LICENSE_BLOCKED** dla produktu. V3 nie
  pobrany.

## L. Recenzje (A/B/C, każde P0/P1 sprawdzane przez dwóch sceptyków)

{{REVIEWS}}

## M. Testy, zamrożenie, CI

{{GATES}}

## N. Rekomendacja i ograniczenia

**NEXT_RECOMMENDATION: `NO_SAFE_VISUAL_CANDIDATE`** — `stage-reports/artifacts/analyzer-005r/recommendation.md`.
Z reguły §8: żaden router nie osiąga ≥ 70 % pokrycia EXTERIOR_RENDER na EVAL; `NOT_MEASURED` nie zachodzi
(14 rodzin EVAL ≥ 8); `PROPOSE_005S_VISUAL_HANDOFF` nieosiągalne bez niezależnej prawdy cech.

Ograniczenia: jeden wydawca (ARCHON); prawda ról z metadanych strukturalnych, nie od człowieka; brak prawdy cech
na prawdziwych obrazach; rodzina Rarytasy cała w DEV; syntetyczne rozmiary obrazów naśladują ARCHON (skrót formatu
niewidoczny na syntetyce — stąd A1); V2 tylko w Pythonie na x86 (`NOT_RUN_NODE18`), telefon ARM64 `PENDING`;
fotografie (EXTERIOR/INTERIOR_PHOTO) i DETAIL na prawdziwych danych — `NOT_SAMPLED`.

## O. Handoff

{{HANDOFF}}
