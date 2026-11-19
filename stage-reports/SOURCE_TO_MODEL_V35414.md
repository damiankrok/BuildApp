# v3.54.14 R2 — metryka API, szkice z kontrolą proporcji, Bakopy i nowy prosty dom

Gałąź `claude/new-session-3kzcgh`. Baza `1ba317c` (v3.54.13, APK 1344). Paczka R2 przeczytana w całości
(README_START, pełny Master Plan v3.54.14 — skopiowany do `docs/MASTER_PLAN.md`, prompt R2, zrzuty telefonu).
Commity etapu: `ea1c91d` (trzy defekty z telefonu), `a4e1314` + `5881865` (reguła wyboru i karty źródeł przed
wynikami), **`d2a30a6` (ZAMROŻENIE przed pierwszym biegiem nowego domu)**, `2172581` (pierwszy wynik Ballinej,
zachowany), `b9c5c06` (zmiana PO zamrożeniu: resolver 1.1.0), `1708569` (sceny APK), dalej host E2E, APK 1345
i dokumenty.

**Koszt etapu: 1,065346 USD** z limitu 5 USD (26 żądań; księga 24,919958 USD; § 9).

## 0. Najważniejsze

- **Marcówki — trzy defekty z telefonu usunięte w konsumencie wyglądu 1.1.0** (geometria bez zmian, odcisk
  `0e493584fb4f7203`): jasna linia na +3,06 (styk kondygnacji poza siatką 2 cm), drewno i biała rama ciągłe za
  balkonem i balustradą (komórki zasłonięte dołączają do podziału ściany, nie są ziarnami), plamy za balustradą
  frontu (ziarna w pasie niepewności rejestracji). Śledzenie promieni przed/po: pusty pas na styku 0; odsłonięte za
  przesłoną: front 0; zgodność granic front 0,956 → 0,975, tył 0,953 → 0,958, ciągłość 1, F1 drewno|rama 1.
- **API niezależnie czyta wymiary i sprawdza LOCAL** (`consult/metric-read.ts`): odczyt każdego rzutu i przekroju
  bez podpowiedzi LOCAL → kontrola etykiet LOCAL na ponumerowanych wycinkach → deterministyczny resolver: poprawka
  tylko ze świadkiem (łańcuch, skala z innych etykiet, od 1.1.0 pole zabudowy ze strony), bez świadka
  `UNRESOLVED` i LOCAL zostaje; ten sam czytnik dwa razy nie jest świadkiem.
- **Na Bakopach (DEV) API poprawiło 8 etykiet ze świadkiem skali** (080→690, 088→860, 0051→1500, 014→640,
  049→640, 048→860, 479→625, 401→140), 5 zgodnych, 11 nierozstrzygniętych. To są **realne wymiary w modelu**, ale
  ich wpływ na bryłę jest mały (ścianki wewnętrzne sub-cm…3 cm): skala była już STRONG. Obrys X nadal 14,919 przy
  druku 15,00 — strata w budowie obrysu (nie przypina do wymiaru całkowitego), nie w odczycie.
- **Wzór błędów LOCAL widoczny gołym okiem:** 0051↔1500, 518↔815, 401↔140, 854↔458 — pionowe etykiety czytane
  odwrotnie/do góry nogami. API je prostuje; resolver przyjmuje to tylko ze świadkiem.
- **Szkice (L-MS):** API zwraca typowany JSON konturów, lokalny renderer rysuje płaskie kolory w rozmiarze ramy,
  kontrola proporcji (jedna skala z końców ścian vs rzut, ±0,00 z kalenicy zgodnej dla obu czytników, okap i linia
  terenu jako test anizotropii) przepuszcza tylko spójne. Szkice zasilają **formę** (czytnik kształtu dostaje szkic
  zamiast oryginału) i **wykończenie**. Bakopy: 3/4 przyjęte (front odrzucony — ściśnięty pionowo ~0,17 m),
  forma ACCEPT: **komin dodany** (1 z 2), drewno na szczycie skrzydła, na wnęce dojścia i panelach od zachodu.
- **Wybór per właściwość** (`consult/choose.ts`): geometria z kandydata formy, gdy przeszedł; ton ściany zmieniony
  tylko po stronie, której szkic przeszedł kontrolę. Na Bakopach cofa jasny szczyt garażu, który kandydat formy
  wziął z innych stron mimo odrzuconego frontu.
- **Nowy dom: Lipińscy „Ballina”** (wybrany regułą z commitu przed wynikami). **Pierwszy bieg na zamrożonym kodzie
  (zachowany): L0 odmowa (`METRIC_RESOLUTION_INCONCLUSIVE`), L-M bez zmiany, L-MS nieosiągnięte.** API przeczytało
  oba wymiary całkowite 1365 i 815 (LOCAL: 518), ale nie było świadka. **Po zamrożeniu** (jawnie oznaczone) resolver
  1.1.0 uznał pole zabudowy ze strony (111,25 m² = 13,65 × 8,15) za świadka: odmowa → model na skali SUPPORTED,
  **obrys 13,65 × 8,15 dokładnie**, ściany, 16 otworów, 7 pokoi — **bez dachu** (wysokości ma tylko API, bez
  drugiego świadka); 4 szkice odrzucone z tego samego powodu.
- **Host:** ścieżka konsultanta ma teraz zaakceptowane rewizje (`consult/accepted-consult.ts`): odpowiedzi zapisane
  pod hashem żądania, drugi bieg tego samego URL je odtwarza — bez żądania i bez rezerwacji. E2E na buildzie
  `1708569`: ALL CHECKS PASSED; drugi bieg 0 USD / 0 żądań / te same bajty; bez tokenu 0 żądań (§ 8).

## 1. Marcówki — trzy defekty z telefonu (§2–5 promptu)

Zrzuty OWNER-a (`phone-feedback/`) pokazują: jasną linię na +3,06, przerwane drewno za balkonem, przerwy/plamy za
balustradą. Ślad (`research/source-to-model/v35414/defect-trace.ts`, wyniki `results/defects-*.json`): siatka
widoczności z kompilowanej sceny, promień od widza do każdej komórki 2 cm, przypisanie powierzchni i materiału.

| przyczyna | gdzie | naprawa (konsument 1.1.0) | przed → po |
|---|---|---|---|
| styk kondygnacji 3,07 nie leży na siatce 2 cm → pas komórek bez ziarna | `visibility.ts` | dosunięcie krawędzi o jedną komórkę do nieoznaczonych, przycięcie do prostokąta ściany | pusty pas: 0 |
| balustrada (słupki, pochwyty, szkło) i płyta balkonu zasłaniały ścianę → komórki bez wykończenia | `visibility.ts` (occluder) | komórki zasłonięte (`behind`) należą do podziału ściany, nie są ziarnami; liczone w `inferredUnderOcclusion` | odsłonięte za przesłoną: front 0 (tył 232 = biała rama, jej własny materiał) |
| ciemny pas balkonu narysowany kilka px za wysoko → ciemne ziarna 4–8 cm nad płytą rozlewały się za balustradą | `consumer.ts` | brak ziaren w paśmie niepewności (uncertaintyPx × skala + `toSourceResidualPx`) przy przesłonie | plamy: 0 |

Kontrprzykłady w `appearance-v35414.test.ts` (7): styk poza siatką, słupki/pochwyty/szkło, rezydual + kontrpróba,
prawdziwa granica za balustradą zostaje nieznana, obca ściana z przodu nie jest przesłoną, otwór za balustradą
zostaje otworem. Odcisk geometrii niezmieniony. Scena `marcowki-c-v35414` (ODDANY).

## 2. Karty źródeł przed wynikami (§6)

`refs/bakopy.json` (DEV, dokładne historyczne bajty: zgodne z korpusem) i `refs/ballina.json` — wiersze,
tolerancje i druk spisane przed jakimkolwiek modelem Ballinej (commit `5881865`). Reguła wyboru nowego domu
(`NEW_HOUSE_SELECTION.md`, commit `a4e1314`): ziarno SHA256 nad commitem, indeks startowy 446, 18 kandydatów
otwartych, 17 odrzuconych z powodem, wybrany 18. — Lipińscy Ballina (parterowy, prostokąt 13,65 × 8,15,
dach dwuspadowy 28°, kalenica +5,54).

## 3. Metryka API (§7)

Kontrakt `buildapp.dimension-observation` 1.0.0 (stabilne id, prompt `metric-read/1`, kontrola `metric-verify/1`,
resolver 1.0.0 → 1.1.0). Kolejność: **niezależny odczyt** (rama zmniejszona całkowitym czynnikiem, nic z LOCAL) →
**kontrola LOCAL** (maks. 40 pozycji, magenta numerowane ramki, cyjan linie) → **resolver** → warstwa metryczna
analizatora przebudowuje model z `ConsultedReading`/`ConsultedSpan` → **pomiar sceny** (`measureBuilt`: obrys ścian
zewnętrznych, główny dach = największa powierzchnia górna, okap = jej najniższy punkt, kalenica = najwyższy).

Pełna tabela etykieta → LOCAL → API → przyjęte → zmierzone → werdykt: `research/source-to-model/v35414/results/dimension-tables.md`.
Skrót:

| dom | odczyt API | zgodne | poprawione (świadek) | nierozstrz. | nowe odcinki | efekt w modelu |
|---|---|---|---|---|---|---|
| Bakopy L-M | 48 + 6 obs. | 5 | 8 (SCALE) | 11 | 1 (odrzucony: za krótki) | ścianki wewn. sub-cm…3 cm; skala STRONG→STRONG; obrys X 14,919 (druk 15,00) |
| Ballina L-M (zamrożony) | 2 + 4 | 0 | 0 | 1 (815 vs 518) | 1 (1365, odrzucony: jeden świadek) | odmowa zostaje |
| Ballina L-M+ (po zamrożeniu) | 2 + 4 | 0 | 1 (FOOTPRINT) | 0 | 2 (1365 i 815) | **model**: obrys 13,650 × 8,150, kondygnacja 2,80 |

Wysokości Bakop: kalenica druk +6,28 → model 6,281; okap druk +3,27 → model 3,238; kąt 35° → 35°. (Pomiar okapu
wcześniej brał spód/grubość dachu i wszystkie dachy — 2,896/38,4 — poprawiony na powierzchnię górną dachu głównego.)

**Czy konsultant poprawił realne wymiary?** Tak — na Bakopach 8 etykiet weszło do modelu (każda ze świadkiem
skali), na Ballinie po zamrożeniu jedna etykieta i dwa odcinki zamieniły odmowę w model o dokładnym obrysie. Na
Bakopach wpływ na bryłę jest mały, bo LOCAL miał już skalę STRONG; brakujące 8 cm obrysu to strata w budowie
obrysu, nie w odczycie. Odczyt powtórzony z zapisanych odpowiedzi daje ten sam hash modelu.

## 4. Szkice automatyczne (§8)

Kontrakt `buildapp.elevation-sketch` 1.0.0 (prompt `elevation-sketch/1`, parser v2 przyjmuje goły wielokąt
dachu). Lokalny renderer w stałej palecie i rozmiarze ramy (deterministyczny PNG). Kontrola proporcji v2:
jedna skala z końców ścian vs zasięg z rzutu; ±0,00 z kalenicy zgodnej w obu czytnikach (przekrój API i
`LEVEL_DATUM` LOCAL); testy anizotropii: okap w tej samej skali vs druk, linia terenu w oknie −0,6…+0,1;
tolerancja tolPx·mpp + 0,05. Rejestracja LOCAL zapisana tylko do porównania (v1 jej używała i fałszywie odrzucała
poprawne szkice — rekord `LMS-check1`). Szkic, który przejdzie, zastępuje oryginał w czytniku kształtu (FORMA:
kandydat musi zachować obrys ±5 cm, kondygnacje, ściany zewnętrzne i otwory) i daje konture wykończeń
(WYKOŃCZENIE, przez konsument wyglądu z odciskiem geometrii).

| dom | przyjęte | odrzucone (powód) | forma | wykończenie | koszt |
|---|---|---|---|---|---|
| Bakopy | W, R, E | FRONT (ściśnięty pionowo ~0,17 m: linia okapu poza tolerancją) | ACCEPT: komin (1 z 2), tony ścian | ACCEPT: drewno szczytu skrzydła, wnęki, paneli W | ~0,05 USD |
| Ballina (po zamrożeniu) | — | wszystkie 4 (brak kalenicy uzgodnionej przez dwa czytniki: LOCAL nie odczytał rzędnych) | nie uruchomiona | nie uruchomione | 0,044476 USD |

**Czy szkice pomogły w formie, czy tylko w kolorach?** Na Bakopach w obu: forma — komin (którego L0 i L-M nie mają),
wykończenie — drewno, którego L0 i L-M nie mają wcale. Nie dodały pergoli ani rusztu dojścia (to nie są obiekty,
które czytnik kształtu umie zbudować z elewacji). Na Ballinie nie pomogły: kontrola proporcji słusznie odmówiła,
bo jedyną kalenicę podało samo API. Skutek uboczny na Bakopach: kandydat formy zmienił też ton ścian frontu
(jasny szczyt garażu), choć front był odrzucony — to cofa reguła wyboru (§ 5).

## 5. Warianty i wybór (§9)

L0 = LOCAL; L-M = L0 + metryka API; L-MS = te same fakty metryczne (odpowiedzi L-M odtworzone, nie czytane drugi
raz) + szkice; DELIVERED = L-MS po wyborze per właściwość (`choose.ts` 1.0.0, spisany przed Ballina).
H-recorded nie był potrzebny.

Wynik na kartach (19 wierszy, PASS / PARTIAL / FAIL):

| dom | L0 | L-M | L-MS | DELIVERED |
|---|---|---|---|---|
| Bakopy (DEV) | 12 / 4 / 3 | 12 / 4 / 3 | 12 / 6 / 1 | **12 / 6 / 1** |
| Ballina — zamrożony | brak modelu | brak modelu | nieosiągnięte | brak (odmowa) |
| Ballina — po zamrożeniu | — | **8 / 2 / 9** (L-M+) | = L-M+ (szkice odrzucone) | L-M+ (częściowy) |

Bakopy: różnice L-MS względem L0 — kominy FAIL→PARTIAL, paleta FAIL→PARTIAL; reszta bez zmian (dach główny, skrzydło,
garaż, wejście, otwory). Wciąż FAIL: pergola tarasu. PARTIAL: przeszklony szczyt skrzydła (brak), wnęka dojścia
(ściana zamiast ażuru), otwory od ogrodu, obrys X (14,919). Ręczne werdykty z plansz z powodami:
`manual-bakopy.json`, `manual-ballina.json`; wyniki `results/bakopy/score.json`.

**Dostarczony wariant:** Bakopy — DELIVERED (L-MS + wybór); Ballina — pierwszy wynik zamrożony to odmowa (nic do
dostarczenia); w APK pokazany **częściowy** model po zamrożeniu (L-M+), oznaczony „CZĘŚCIOWY, bez dachu”.

Kontrpróby: jednostkowe (metryka: łańcuch, skala, samokotwica, zła jednostka, ESTIMATED, kolejność; FOOTPRINT: brak
pola, inne pole, dwie skale, LOCAL też pasuje; szkice: anizotropia, linia terenu, przesunięty otwór, paleta; wybór:
wszystkie strony przyjęte nic nie cofają) i w danych (Bakopy: 11 nierozstrzygniętych zostaje LOCAL; front odrzucony
i jego ton cofnięty; Ballina: szkice bez drugiego świadka rzędnych odrzucone).

## 6. Zmiana po zamrożeniu (jawnie)

Nazwana z pierwszego biegu Ballinej: brak świadka dla wymiaru całkowitego na ramie bez ustalonej skali.
Resolver **1.1.0 FOOTPRINT**: wymiar całkowity API jest poświadczony, gdy iloczyn z prostopadłym wymiarem całkowitym
z tego samego rysunku daje pole zabudowy ze strony (0,5 %), obie linie mierzą odczyty w jednej skali obrazu (3 %),
a odczyt LOCAL pola nie daje; taki wymiar idzie też jako odcinek. Pole to tekst strony, którego nie czytał żaden z
czytników. Obrys nieprostokątny nie ma takiego iloczynu, więc nic nie jest poświadczane. Regresja: Bakopy z 1.1.0 —
ten sam hash modelu. Pierwszy wynik zamrożony zostaje w raporcie jako wynik.

## 7. Plansze (§12)

Prywatne (obrazy wydawców poza Git), w ZIP: `boards/board-bakopy-{sides,around,interior}.png`,
`boards/board-ballina-{sides,around,interior}.png`. Wiersze: ORYGINAŁ | SZKIC (JSON API → lokalny rysunek) |
L0 | L-M | L-MS | DELIVERED, kolumny FRONT/EAST/REAR/WEST; widok z góry i cztery aksonometrie; kondygnacje
bez dachu obok rzutu.

## 8. Host E2E (§10)

Serwer zbudowany z commita `1708569` (`apps/analyzer-api/dist/server.mjs`), publiczne wejście `POST /v1/analyses`,
`ANALYZER_CONSULTANT=pilot` + `ANALYZER_METRIC_CONSULTANT=on` + `ANALYZER_SKETCHES=on`, księgi hosta otwarte na
saldzie etapu z pułapem 28,854612. Skrypt `research/source-to-model/v35414/host-e2e.mjs`, zapisy
`results/host-e2e/`. **ALL CHECKS PASSED.**

| zadanie | wynik | żądania | USD | uwagi |
|---|---|---|---|---|
| job-1 (Bakopy, token) | COMPLETED 626 s | 12 | 0,594924 | metryka: 8 poprawek, ale **ROLLBACK** (skala STRONG → SUPPORTED — strażnik zadziałał; odczyt na żywo różni się od badawczego); szkice REAR, EAST przyjęte, W i FRONT odrzucone; forma i wykończenie ACCEPT; rewizja **ACCEPTED_NOW**; source check CHECKED |
| job-1-repeat (ten sam URL) | COMPLETED | **0** | **0** | **REUSED**: 12 odpowiedzi odtworzonych, 0 brakujących, te same bajty modelu i sceny |
| bez tokenu | COMPLETED 165 s | 0 | 0 | ścieżka rysunków, brak konsultacji w wyniku |

Księgi hosta zawierają wyłącznie CONSULTATION (czytnik opisu domu nie był pytany). Klucz tylko w zmiennej
środowiska serwera; w zapisach skan klucza: 0 trafień.

## 9. Koszty (§11)

Jeden limit 5 USD nad księgą 23,854612 (pułap 28,854612); każde żądanie rezerwuje najgorszy przypadek przed
wysłaniem. Nie kupiono żadnej usługi. Księga `research/ai-assist/spend-ledger-v35414.json`:

| faza | dom | model | żądania | USD |
|---|---|---|---|---|
| metryka L-M | Bakopy | Opus 5.5 | 3 | 0,285316 |
| szkice L-MS | Bakopy | Sonnet 5.5 | 4 | 0,051890 |
| metryka L-M | Ballina | Opus 5.5 | 3 | 0,088740 |
| szkice L-MS+ (po zamrożeniu) | Ballina | Sonnet 5.5 | 4 | 0,044476 |
| host E2E | Bakopy | Opus 5.5 / Sonnet 5.5 | 3 / 9 | 0,277760 / 0,317164 |
| **razem** | | | **26** | **1,065346** |

Księga po etapie: **24,919958 USD** (zostaje 3,934654 z limitu etapu). Wszystkie powtórki (L-MS, L-M+, regresja
Bakop, drugi bieg hosta) z zapisanych odpowiedzi: 0 USD. Trzy wiersze powtórzonych odpowiedzi w L-MS+ Ballinej
były najpierw zaksięgowane jako niepowodzenie (powtórka raportuje zerowe zużycie) — przeoznaczone na NOT_SENT, 0 USD.

## 10. Luki

- Bakopy: pergola tarasu, przeszklony szczyt skrzydła, ażur dojścia, drugi komin; obrys X 14,919 (budowa obrysu
  nie przypina do wymiaru całkowitego 15,00).
- Ballina: dach (wysokości tylko z API, bez drugiego świadka — LOCAL nie czyta rzędnych z małego przekroju;
  strona podaje kąt 28°, który mógłby być takim świadkiem: następny krok), wykończenia (tynk/cegła), tarasy,
  9 pokoi (jest 7), okno w zachodnim szczycie.
- LOCAL: pionowe etykiety czytane odwrotnie (0051/1500, 518/815) — przyczyna wielu nierozstrzygniętych.
- Kandydat formy zmienia tony ścian globalnie; wybór per stronę to łata na wyjściu, nie przyczyna.
