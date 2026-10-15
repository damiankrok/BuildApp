# STAGE BUILDPLAN-ANALYZER-005R — router zasobów wizualnych i obserwacje zewnętrzne w JSON (badanie)

**Klasa: RESEARCH. Zero zmian produkcyjnych** (zamrożenie IDENTICAL, §M). Bez APK, bez ślepej rundy, bez 005S.
Baza `39061dbed453d7af4e538b1fcbe4584496fa223e` (zamknięcie 005Q-CHAIN). Gałąź
`analyzer/visual-asset-exterior-json-research-v1`, każdy push lustrzany do `claude/new-session-3kzcgh`.

## Podsumowanie dla OWNER-a

| pytanie | odpowiedź z pomiarów |
| --- | --- |
| Czy da się lokalnie i offline odróżnić rzuty, elewacje, przekroje, sytuacje, wizualizacje zewnętrzne i wnętrza? | **Rysunki techniczne tak, wizualizacje zewnętrzne nie bezpiecznie.** Na EVAL (14 rodzin ARCHON, 231 grup linii) routery trafiają rzuty, przekroje, sytuacje i elewacje prawie bez błędu. Na preregistrowanej prawdzie **żaden nie rozpoznaje poprawnie ani jednej z 20 grup wizualizacji zewnętrznych**. Recenzja B znalazła dwa błędy prawdy. Po ich poprawieniu (Addendum C, post-hoc) V1 trafia 46/46 grup zewnętrznych. Mimo to nie przechodzi progu §8: górna granica ryzyka wynosi 6,15 % przy dopuszczalnych 5 %, a trafienia biorą się z formatu obrazu (patrz niżej). |
| Który algorytm lokalny jest najlepszy? | Na sumach wygrywa V1 (deterministyczne cechy CV + reguły z DEV): 90,5 % pokrycia przy 1,9 % ryzyka selektywnego. **V1 rozpoznaje jednak częściowo format obrazu, nie treść.** Po dopełnieniu tych samych pikseli do kwadratu zmienia się 58,6 % rozstrzygnięć (tło białe) albo 29,9 % (tło szare). Dotyczy to elewacji i wnętrz; rzuty, przekroje i sytuacje nie zmieniają się nigdy (A1). U V1 dopasowanego na poprawionej prawdzie zmienia się 97,7 % rozstrzygnięć, w tym **wszystkie** 93 trafione wizualizacje zewnętrzne. Wszystkie 54 syntetyczne wizualizacje zewnętrzne trafiają do „wnętrz”. V2 (OWL-ViT B/32, lokalnie) jako router jest bezużyteczny: na DEV wszystko jest „wnętrzem” aż do τ = 0,85, a na 20 obrazach syntetycznych osadzenia obrazów mają między sobą kosinus 0,997–1,000 (B1). |
| Czy któryś detektor rozpoznaje tarasy, pergole, balustrady, wiaty, daszki? | **Nie.** Nawet na syntetycznej prawdzie, z idealnym routingiem, V2 przy progu 0,20 znajduje 0/33 pergol, 0/19 wiat, 0/41 daszków wejściowych, 0/36 tarasów zadaszonych, 0/43 tarasów na gruncie, 0/64 schodów, 0/254 słupów, 11/40 balkonów i 2/51 balustrad. Dobrze widzi tylko okna (P 0,96, R 0,95) i drzwi, ale **także na wnętrzach**: 12 okien na 12 syntetycznych wnętrzach, a na prawdziwych wnętrzach 253 okna i 153 „drzwi zewnętrzne”. Na prawdziwych obrazach prawdy cech nie ma (**HUMAN_LABELS_NOT_RUN**), więc te wyniki są tylko opisowe. |
| Co jest główną przyczyną utraty elementów zewnętrznych dziś? | **Pierwsza zła operacja (KNOWN, audyt §8.2 X):** adapter ARCHON zamienia „wizualizacja” na `PERSPECTIVE_RENDER` bez klasy wnętrza (`archon.ts:98`, `schema.ts:45`), a `analyze.ts:164` puszcza te obrazy przez ekstraktory elewacji. **Zmierzone przez kotwice karuzeli (Addendum C3):** produkcja daje `PERSPECTIVE_RENDER` 134 wnętrzom i 39 wizualizacjom zewnętrznym bez rozróżnienia. Do ekstraktorów fasady trafia **każda ze 107 grup wnętrz EVAL**. Wcześniejsze „70 z 70 to wnętrza, 0 z 78 zewnętrznych” było artefaktem dopasowania po bajtach i zostało wycofane. |
| Czy wiersz „rarytasy-g2e” to dom OWNER-a? | **Nie.** To „Dom w rarytasach **5** (G2E)” `m84f2903cb8e14`. Kotwica OWNER-a `m3ea28300f9b3e` nie ma w repozytorium żadnego przebiegu. Kotwica dzieli 25 bajtowo identycznych obrazów z e-OZE i tylko 10 z „rarytasy-g2e”; 109 ze 136 par edycji Rarytasów dzieli bajty. |
| Rekomendacja | **`NO_SAFE_VISUAL_CANDIDATE`** (zakres: ARCHON). Bezpieczny kontrakt JSON istnieje i wytrzymał red team. Bramki bezpieczeństwa przeszły, ale **przez wstrzymanie się**, nie przez rozpoznanie. Najbardziej obiecujący sygnał routera to **struktura strony wydawcy**, której adapter dziś nie czyta. To jednak zmiana produkcyjna, poza zakresem 005R. Ten sam kanał ma błędy wydawcy: w karuzeli wnętrz leży 15 widoków zewnętrznych. |

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
- **Addendum C** (po recenzjach, w całości post-hoc). Erratum czasów A i B (A 01:54:14Z, B 02:41:05Z). Wrażliwość prawdy: C1 to 15 widoków zewnętrznych w karuzeli wnętrz, C2 to 150 kopii `widok-N` bez prawdy, C12 łączy obie poprawki. V1 i V0b są przy tym ponownie dopasowane na DEV. C3 to mapowanie V0a przez kotwice karuzeli. Poprawki narzędzi po recenzjach: walidator, assembler, scorery i mutacje. Odstępstwo od kolejności z §9 jest jawne. Na końcu tabela SHA-256 wszystkich plików badawczych zmienionych po `bdd50b8`. Żadna reguła §8 się nie zmienia. Wyniki: `addenda/addendum-c.json`, `addenda/a1-v1-c12.json`.

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
| V0a (zgodność metadanych¹) | 104 | 45,0 % | 0 % (0–3,6; 0–0) | 0 / 0 / 20 | 0/0/107 | 53/53/53 | 0 (konsument: **54**; przez kotwice **107**)² |
| V0b | 158 | 68,4 % | 0 % (0–2,4; 0–0) | 0 / 0 / 20 | 54/54/107 | 53/53/53 | 0 |
| V1 | 209 | 90,5 % | 1,9 % (0,8–4,8; 0–5,4) | **0 / 2 / 20** | 107/107/107 | 49/49/53 | 0 |
| V2 | 16 | 6,9 % | 0 % (0–19,4; 0–0) | 0 / 0 / 20 | 16/16/107 | 0/0/53 | 0 |
| N1 | 152 | 65,8 % | 0 % (0–2,5; 0–0) | 0 / 0 / 20 | 54/54/107 | 49/49/53 | 0 |

¹ Wiersz V0a liczy też 14 grup SITE_PLAN, których prawda pochodzi z tego samego slugu „sytuacja”, który czyta V0a
(recenzja B-8). Właściwa dokładność V0a liczy się na samej bazie STRUCTURE: **90 rozstrzygnięć z 207, ryzyko 0**.
² Router V0a nie rozstrzyga wnętrza jako zewnętrza, ale produkcja przekazuje każde `PERSPECTIVE_RENDER` do
ekstraktorów fasady. Takich grup wnętrz EVAL jest 54 przy dopasowaniu po bajtach i 107 ze 107 przy dopasowaniu przez
kotwice karuzeli (A-3, C-2, C3). Na DEV odpowiednio 16 i wszystkie.
- **V1, skrót formatu (A1).** Na zasobach rozstrzygniętych i z prawdą dopełnienie do kwadratu zmienia **58,6 %**
  wyjść (tło białe, 380/648) albo **29,9 %** (tło szare, 194/648). Przy tle białym elewacje przechodzą w SITE_PLAN, a
  wnętrza w SITE_PLAN lub FLOOR_PLAN (186 ze 198). Przy tle szarym elewacje przechodzą w INTERIOR_RENDER (194/194), a
  wnętrza się nie zmieniają. Rzuty, przekroje i sytuacje (218 zasobów) nie zmieniają się nigdy. Reguły V1 dzielą
  głównie po `aspect` (`contenders/v1-model.json`). Syntetyczne wizualizacje zewnętrzne (1280×853) trafiają do
  wnętrz w 54 na 54 przypadki.
- **V2, router bezużyteczny.** Na prawdziwych obrazach DEV wszystkie rozstrzygnięte grupy są INTERIOR_RENDER aż do
  τ = 0,85 (ryzyko DEV 72,8 %, EVAL 53,7 %). Procedura τ z prerejestracji dała więc τ = 0,95 i 6,9 % pokrycia. Na
  20 obrazach **syntetycznych** logity zgadzają się z biblioteką (|Δ| ≤ 2·10⁻⁶), a osadzenia obrazów są praktycznie
  stałe (kosinus 0,997–1,000; B1, zakres tylko syntetyczny, recenzja B-10). **A1 dla V2 (uruchomione po recenzjach, C-8):** dla
  wszystkich 743 obrazów z prawdą najwyższą klasą routingu jest INTERIOR_RENDER, zarówno przy szarym dopełnieniu
  (własne przetwarzanie V2), jak i przy białym. „Niezmienniczość” wynika tu ze stałości, nie z rozpoznania. Przy
  τ = 0,95 rozstrzyga się 29 (szare) albo 8 (białe) wnętrz, a 21 z tych rozstrzygnięć zmienia się z formatem
  (`addenda/a1-v2.json`).
- **Wrażliwość prawdy (Addendum C, post-hoc).** Tabela pokazuje V1 na EVAL po ponownym dopasowaniu na DEV:

  | prawda | EXTERIOR_RENDER popr./prawda | ELEVATION popr./prawda | pokrycie | ryzyko | górna granica bootstrap | §8 |
  | --- | --- | --- | --- | --- | --- | --- |
  | preregistrowana | 0/20 | 49/53 | 90,5 % | 1,9 % | 5,43 % | nie |
  | C1 (15 widoków zewn. z karuzeli wnętrz) | 18/20 | 49/53 | 84,0 % | 3,1 % | 8,81 % | nie |
  | C2 (150 kopii `widok-N`) | 28/46 | 49/53 | 75,1 % | 0 % | 0 % | nie (EXT 60,9 % < 70 %) |
  | C12 (obie) | **46/46** | 49/53 | 83,7 % | 1,9 % | **6,15 %** | **nie** (ryzyko > 5 %) |

  Na każdej prawdzie N1 i V0b mają 0/20 albo 28/46 grup zewnętrznych, a V2 zawsze 0. Pod C12 V1 nie rozstrzyga
  żadnego rzutu ani sytuacji. Kontrola A1 na modelu C12 zmienia 97,7 % jego wyjść (białe tło) albo 63,6 % (szare), w
  tym wszystkie 93 trafione wizualizacje zewnętrzne (`addenda/a1-v1-c12.json`). Poprawka prawdy post-hoc nie zmienia
  werdyktu preregistrowanego. Pokazuje natomiast, że „0 z 20” nie znaczy „V1 nie widzi zewnętrza”. Znaczy tyle, że
  V1 widzi je na formatach jednego wydawcy, ale nie dość bezpiecznie i nie z właściwego powodu.
- **N1 odrzucony przez własny falsyfikator** (§6 prerejestracji): ryzyko nie niższe niż V0b (0 = 0) i pokrycie
  EXTERIOR_RENDER 0 % < 50 %.
- A2 (prawda propagowana w grupie, wrażliwość): żaden wariant nie ma ani jednego poprawnego EXTERIOR_RENDER na EVAL.
- Korelacja duplikatów: 26 grup z ≥ 2 zasobami na EVAL, 0 z różnymi wyjściami u każdego wariantu.

## G. Obserwacje cech zewnętrznych

**Syntetyczne (prawda z konstrukcji), routing idealny, V2 @ 0,20:** łącznie P 0,910, R 0,465 — niesione przez okna
(P 0,96, R 0,95) i drzwi (P 0,72, R 0,94). Klasy docelowe: PERGOLA 0/33, CARPORT 0/19, CANOPY 0/41, COVERED_TERRACE
0/36, TERRACE 0/43, STEPS 0/64, COLUMN 0/254, BALCONY 11/40 (1 FP), RAILING 2/51, GARAGE_DOOR 0/26 (7 FP), LOGGIA 0/25
(7 FP). Look-alike: 0 przy 0,2 (38 przy 0,05). Kadr: 0 halucynacji przy 0,2 (24 przy 0,05). Lustro: Jaccard rodzajów
0,6–1,0. Pary edycji: f01 (pergola) daje wynik pusty, bo pergoli V2 nie wykrywa w żadnej wersji. W f02 (wiata ↔ zamknięty
garaż, poprawka B-7: garaż sprawdzany jako GARAGE_DOOR) brama jest wykryta na edycji bez garażu, a nie na edycji z
garażem. W f04 balkon jest „widziany” na edycji bez balkonu. **Kontrola wnętrz (poprawka B-3, liczona bez bramki
routingu):** V2 znajduje na 12 syntetycznych wnętrzach 12 okien przy progu 0,2 i 38 detekcji przy 0,05, a wskazówki
V1 odpalają tam 31 razy. Krzywa progów jest w `features/feature-scores-synthetic.json`.
**V1 (wskazówki na elewacjach):** GARAGE_DOOR P 1,0 R 0,5 (7/14); RAILING P 0,14 (36 FP).
**Kontrole negatywne briefu, których nie zmierzono (B-4):** daszek wejściowy → dach główny, balustrada → ściana i
belki pergoli → dach zadaszony są mierzone tylko w odwrotnym kierunku (okap → daszek, attyka → balustrada, daszek
pełny → pergola) albo pustym wynikiem (V2 nie widzi pergol). Przemianowania strony lustrzanej elewacji nie
testowano, bo żaden wariant nie wnioskuje strony z pikseli (`mirrorAmbiguous: true` zawsze). Pary edycji A→B istnieją
tylko syntetycznie, a na prawdziwych bliźniaczych edycjach nie.

**Prawdziwe (bez prawdy — opisowo):**
- Według własnego routingu V0a, V0b i V2 nie proponują nic. V1 proponuje **5 038 obserwacji**, prawie same
  balustrady, na 49 edycjach, z których żadna nie deklaruje balustrady. Wskazówka okresowości odpala na okładzinach
  i szprosach. Pozostałe **16 221** wskazówek V1 na zasobach, których V1 nie kieruje do elewacji, jest teraz zapisane
  jako REJECTED (recenzja A-4); wcześniej po cichu je pomijano. N1 proponuje 978 obserwacji (okna 717, drzwi 159,
  brama 36, schody 36, pergola 6…), wyłącznie na elewacjach.
- Przy routingu z prawdy strukturalnej (wyrocznia) V2 daje na wnętrzach 253 okna, 153 „drzwi zewnętrzne”,
  28 balustrad, 26 schodów, 8 tarasów i 4 wiaty. Bez routera detektor produkowałby twierdzenia wnętrze→zewnątrz.
- Roszczenia wydawcy na poziomie edycji (kategorie + opis): pergola 28 edycji, taras 47, garaż 29, daszek 14, taras
  zadaszony 10, balkon 7. N1 „potwierdza” pergolę na 4/28 i bramę na 16/29; tarasu nie proponuje nikt. To spójność,
  nie dokładność.

## H. Tożsamość edycji

64 zasoby publikowane bajtowo przez ≥ 2 edycje (wszystkie to wnętrza lub obrazy bez prawdy), maksimum 14 edycji
na jeden obraz, 66 grup linii przekracza edycję; 0 zasobów między rodzinami. Kotwica `m3ea…` vs „rarytasy-g2e”
(G2E-5): 10 wspólnych bajtów / 5 grup; vs e-OZE: 25 / 12. Żadna wizualizacja zewnętrzna ani elewacja nie jest
**bajtowo** wspólna między edycjami. **13 grup linii** (bliskie duplikaty) z prawdą zewnętrzną lub elewacją przekracza
jednak edycję (recenzja B-6). Jedna z nich obejmuje cztery edycje, w tym kotwicę. Bliski duplikat nie dowodzi więc ani
różnicy, ani zgodności edycji. Kontrakt JSON wymusza tożsamość (EDITION_MIX, CORRELATION i DANGLING_SUPPORT, każda
zabita mutacją). Sześć grup linii przekracza też podział DEV/EVAL, bo dHash łączy łańcuchowo rysunki różnych rodzin
(B-5). Żadna nie należy do klasy bramkującej.

## I. Kontrakt JSON i bramki twarde

`research/analyzer-005r/schema/` — `research.visual-observations.0.1` i `research.visual-edition-summary.0.1`
(walidator stdlib, przykłady syntetyczne, **18 testów**). Powiązania z istniejącymi typami, bez ich zastępowania,
opisuje audyt §6 i §9. **Red team (recenzja A-2):** recenzent napisał 25 dokumentów, które pierwsza wersja walidatora
przyjmowała. Szukały luk w listach, wielkości liter, synonimach kluczy, nieznanych kluczach i obejściach edycji
i linii. Walidator ma teraz zamknięte zbiory kluczy na każdym poziomie i sprawdza wartości w listach oraz zakres
pewności. Twierdzenie o zewnętrzu przyjmuje wyłącznie na zasobie skierowanym do dowodu zewnętrznego. Rozmiar i grupę
linii bierze z manifestu jako wiążące. 24 z tych dokumentów są testami jednostkowymi. Dwudziesty piąty (wiersz wsparcia
wskazujący nieistniejącą obserwację) sprawdza assembler (DANGLING_SUPPORT, mutacja M13). Wynik ponownej walidacji:
6 100 dokumentów (V1: 21 259 obserwacji, w tym 16 221 REJECTED) i 98 podsumowań edycji, **0 naruszeń** u każdego
wariantu. To 0 twierdzeń autorytatywnych, 0 mieszania edycji, 0 twierdzeń wnętrze→zewnątrz (walidator i prawda),
0 sfabrykowanych ramek i 0 przecieków.
**Bramki przeszły przez wstrzymanie, nie przez rozpoznanie.**

## J. Mutacje — 13/13 zabitych

M1 zamiana prawdy/wyjścia w scorerze, M2 wyciek EVAL do dopasowania, M3 zamiana źródła, M4 zamiana edycji,
M5 sfabrykowana ramka, M6 nazwa projektu w uzasadnieniu, M7 promocja pewności, M8 wymiar metryczny z renderu,
M9 wnętrza routowane jako zewnętrze (licznik prawdy > 0), M10 skorelowani świadkowie liczeni dwa razy, M11 podpis
w manifeście (test izolacji pada), M12 nazwa projektu w promptach (test izolacji pada), M13 wsparcie wskazujące
nieistniejącą obserwację (DANGLING_SUPPORT). M11 i M12 liczą się tylko wtedy, gdy przebieg bez mutacji uruchamia
dokładnie jeden test i ten test przechodzi (recenzja C-10). `mutations/mutations.json`.

## K. Determinizm, koszt, licencje

- V0: role i warianty identyczne w 51/51 pakietach (online, offline r1, offline r2); r1 = r2 bajtowo w skrócie treści;
  online różni się tylko kodem porażki sond hi-res (HTTP 404 vs brak w cache).
- V1: **treść cech** (szerokość, wysokość, cechy) jest identyczna na 1 537/1 537 obrazach w przebiegach Node 22 ×2
  i **Node 18.20.4**. Same pliki różnią się polem czasu `ms` (recenzja C-7). Model i predykcje są identyczne bajtowo
  niezależnie od tego, z którego przebiegu pochodzą.
- V2: dwa pełne przebiegi (3 wątki, te same wagi, prompty i torch 2.11.0+cpu) dają **1 537/1 537 identycznych
  wierszy**: prawdopodobieństwa routingu oraz każdą ramkę i jej wynik, bez pól czasu. Skrót treści obu przebiegów to
  `6c61e141…`. Czas ścienny 3 087 s i 3 540 s, szczytowy RSS 1 009 MB (`determinism/v2-determinism.json`).
- Koszt (`runtime/bench.json`). Próbka warstwowa: 60 obrazów, po 10 na klasę. Maszyna x86_64, 4 rdzenie, bez
  innych obciążeń; to nie telefon. **V1**: mediana 149 ms na obraz, p95 313 ms (Node 22); 147 / 282 ms na
  **Node 18.20.4**; szczytowy RSS 212 / 175 MB; kod 24,8 kB, bez wag. **V2** (PyTorch CPU, 3 wątki): zimny start
  2,5 s, routing 0,83 s, detekcja 0,90 s na obraz (p50), łącznie około 1,7 s; RSS 1 012 MB; wagi 613 MB;
  `NOT_RUN_NODE18`, bo nie zbudowano portu ONNX/Node. ARM64: `PENDING`.
- Licencje (`research/analyzer-005r/licensing.md`): V1 korzysta wyłącznie z zależności już produkcyjnych (BSD-3/MIT).
  V2 jest **LICENSE_BLOCKED** dla produktu. Wagi są na Apache-2.0, ale karta modelu sama mówi „intended as a research
  output for research communities … primary intended users … AI researchers”. Do tego crawl jest nieujawniony, a
  licencje zbiorów karta pomija; to, że część z nich jest niekomercyjna, wiadomo spoza karty (C-9). Rewizja pochodzi
  z URL-a `resolve/cbc355fb…`. V3 nie został pobrany.

## L. Recenzje (A/B/C, każde P0/P1 sprawdzane przez dwóch sceptyków)

Trzech niezależnych recenzentów: A (schemat, źródła, tożsamość wydawcy, prywatność, izolacja), B (semantyka
negatywna na prawdziwych obrazach, przecieki, prawda) i C (środowisko, licencje, odtwarzalność). Każde P0/P1
odtwarzało dwóch weryfikatorów-adwersarzy, każdy we własnym katalogu. **P0: brak.** Surowe wyniki leżą w
`/home/user/work005r/reviews.json` (poza Git, bo cytują podpisy).

| id | waga po weryfikacji | ustalenie | dyspozycja |
| --- | --- | --- | --- |
| A-1 / C-1 | P1 → P2 (nie odtwarza się na HEAD) | blok izolacji 005R czerwony przez `a1-v1.jsonl` | naprawione w `fa090be` (plik `.json`) |
| A-2 | **P1** (2×) | walidator przepuszcza 25 dokumentów-obejść | **naprawione**: zamknięte klucze, listy, wielkość liter, ROUTING, manifest wiążący; 24 obejścia jako testy, 25. w assemblerze (M13) |
| A-3 / B-8 | P1 → P2 (2×) | brak licznika „konsument PERSPECTIVE_RENDER” dla V0a; V0a na wierszach SLUG w tabeli | naprawione: pole w `role-scores.json` (54 EVAL/16 DEV; 107 przez kotwice), przypis w §F |
| A-4 | P1 → P2 (2×) | assembler gubi 16 221 wskazówek V1 | naprawione: zapisywane jako REJECTED |
| **B-1** | **P1** (2×) | prawda STRUCTURE: 15 widoków zewnętrznych w karuzeli wnętrz | prawda preregistrowana **bez zmian**; wrażliwość C1x/C1r w Addendum C, wynik w §F |
| **B-2** | **P1** (2×) | 150 kopii `widok-N` bez prawdy, które routery kierują do wnętrz | wrażliwość C2 i C12 w Addendum C, wynik w §F |
| **B-3** | **P1** (2×) | kontrola wnętrz w syntetyce nie mogła odpalić | naprawione: liczona bez bramki (V2: 12 okien na 12 wnętrzach; V1: 31) |
| **C-2** | **P1** (1× potw., 1× P2) | V0a dopasowany tylko po bajtach; miniatury vs oryginały | C3 przez kotwice karuzeli; **wycofane** „0 z 78” i „70 z 70”; ujawnione ~1 100 pobrań produkcji przy zasiewaniu |
| C-3 | P1 → P2 (1×) / P1 (1×) | „prawie każde rozstrzygnięcie się zmienia” — przesadzone | przeformułowane: 58,6 % / 29,9 %, per klasa |
| A-5 | P2 | konflikty prawdy w grupach bliskich duplikatów nieoznaczane | ujawnione (§N) |
| A-6 / B-5 | P2 | 6 grup linii przekracza DEV/EVAL | ujawnione (§H, Addendum C) |
| A-7 | P2 | robots „fail open”, przekierowania przed allowlistą | naprawione w `acquire.py`; w przebiegu 005R 0 przekierowań między hostami |
| A-8 | P2 | resztki ankiety DobreDomy w katalogu roboczym | usunięte (8 rekordów → editionKey + powód) |
| A-9 / A-11 | P2 | szablonowe pola tożsamości; świadkowie rysunek+render liczeni jako dwaj | ujawnione (§N) |
| A-10 | P2 | testy izolacji pilnują mniej, niż mówią tytuły | wzmocnione: zamknięte klucze manifestu, skan kluczy tekstowych we wszystkich JSON 005R, `run.mjs` i A1 w skanie „tylko bajty”; sprawdzone podłożeniem błędu |
| B-4 | P2 | kontrole negatywne briefu częściowo niezmierzone | ujawnione (§G) |
| B-6 | P2 | przesadzone „flips almost every”, „nic zewnętrznego nie jest wspólne” | przeformułowane (13 grup linii między edycjami) |
| B-7 | P2 | para f02 sprawdzała nieistniejący rodzaj | naprawione (GARAGE_DOOR) |
| B-9 / C-4 | P2 | błędne czasy Addendów A/B | erratum w Addendum C |
| B-10 | P2 | B1 tylko na syntetyce, cytowane ogólnie | zakres dopisany; dowód z prawdziwych obrazów to krzywa τ na DEV |
| C-5 | P2 | kod po prerejestracji bez skrótów | tabela SHA-256 w Addendum C |
| C-6 | P2 | kolejność §9 niezachowana | ujawnione z czasami plików; bench na 3 wątkach jak przebiegi |
| C-7 | P2 | „bit w bit” dla V1 przesadzone | przeformułowane (§K) |
| C-8 | P2 | A1 dla V2 obiecane, nieuruchomione | uruchomione (§F) |
| C-9 | P2 | uzasadnienie licencji wykracza poza kartę | `licensing.md` poprawione |
| C-10 | P2 | M11/M12 bez przebiegu bazowego | naprawione |

Werdykt `NO_SAFE_VISUAL_CANDIDATE` przetrwał recenzje, ale **z innego powodu niż w szkicu**. Nie wynika już z
„0 z 20” na wizualizacjach zewnętrznych. Wynika z granicy ryzyka po poprawce prawdy i ze skrótu formatu.

## M. Testy, zamrożenie, CI

{{GATES}}

## N. Rekomendacja i ograniczenia

**NEXT_RECOMMENDATION: `NO_SAFE_VISUAL_CANDIDATE`** — `stage-reports/artifacts/analyzer-005r/recommendation.md`.
Wynika z reguły §8. Na preregistrowanej prawdzie żaden router nie osiąga ≥ 70 % pokrycia EXTERIOR_RENDER na EVAL.
Na poprawionej prawdzie (post-hoc) V1 osiąga pokrycie, ale przekracza granicę ryzyka (6,15 % > 5 %) i ma skrót
formatu. `NOT_MEASURED` nie zachodzi, bo rodzin EVAL jest 14 ≥ 8. `PROPOSE_005S_VISUAL_HANDOFF` jest nieosiągalne bez
niezależnej prawdy cech.

Ograniczenia: jeden wydawca (ARCHON). Prawda ról pochodzi z metadanych strukturalnych, nie od człowieka, i ma
błędy wydawcy (B-1, B-2). Konflikty prawdy wewnątrz grup bliskich duplikatów (A-5) nie są oznaczane, a pola
tożsamości w złożonych dokumentach (op linii, canonicalUrl przedruku) są szablonowe (A-9). Świadkowie z rysunku
technicznego i z renderu liczą się jako dwaj (A-11): to ukryte ryzyko, które dziś niczego nie zmienia, bo V1
proponuje tylko z rysunków, a N1 tylko z elewacji. Brak prawdy cech na prawdziwych obrazach; rodzina Rarytasy cała w DEV; syntetyczne rozmiary obrazów naśladują ARCHON (skrót formatu
niewidoczny na syntetyce — stąd A1); V2 tylko w Pythonie na x86 (`NOT_RUN_NODE18`), telefon ARM64 `PENDING`;
fotografie (EXTERIOR/INTERIOR_PHOTO) i DETAIL na prawdziwych danych — `NOT_SAMPLED`.

## O. Handoff

{{HANDOFF}}
