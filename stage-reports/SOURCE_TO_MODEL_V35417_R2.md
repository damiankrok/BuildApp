# v3.54.17 R2 — domknięcie audytu (BuildPlan-V35417-AUDYT)

Baza `512caf6`, gałąź `claude/new-session-3kzcgh`, commity `d47a870` (§1), `9c8623b` (§2), `c19d7ce` (§3),
`6b43db5` (§4), `49b2e56` (§5) i commit dokumentacji. Wykonawcy BUILD_MASSING / SET_ROOF / SET_OUTLINE, resolver
świadek → target i poprawki A1–A4 zostały zachowane. Nie ma warunków od nazw domów. Kopertowy, mansardowy i dowolna
liczba brył nadal są poza zakresem (`UNSUPPORTED` z nazwą). ForgeShape tylko do odczytu, H2 i benchmark OWNER-a poza
zakresem. **Żadnego nowego wywołania płatnego API** — księgi bez zmian: 28,542857 / 28,854612 USD.

## Werdykt

Cztery z pięciu dowodów domknięcia dostarczone na prawdziwej ścieżce kodu. Piąty (§3, ścieżka pozytywna: zły istniejący
otwór → poprawne id → UPDATE_OPENING → miara źródłowa → recenzja końcowa na żywo) jest **otwarty**. Indeks trafia do
rzeczywiście wysyłanej wiadomości, a wszystkie kontr-próby są odrzucane przez produkcyjny wykonawca. Natomiast na obu
prawdziwych domach rejestracja widoku blokuje miarę źródłową (powód niżej), a dowód na żywo nie mieści się w pozostałych
0,311755 USD. Nie twierdzę, że „aplikacja buduje bez LOCAL” w ruchu organicznym: dostawa hosta modelu bez LOCAL jest
dowiedziona testem kontrolowanym. Organiczna Layla nadal kończy na NOT_BUILT (obrys 10 narożników, ≥ 3 prostokąty).

## Tabela R2

| Punkt audytu | Przyczyna | Zmieniony konsument | Dowód ścieżki | Wynik | Granica |
|---|---|---|---|---|---|
| §1 Nieodtwarzalna porażka (Aurora Midi: odpowiedzi nieudanego zadania przepadły) | Odpowiedzi zapisywano dopiero przy sukcesie zadania (`recordedAnswers` z wyniku) | `consult/exchange-log.ts` (nowy), `anthropic.ts` (surowa wiadomość SDK / status i ciało błędu), `consultAnalysis` (opakowuje transporty i wydatek, znaczniki etapów), host `executor.ts`/`wiring.ts` (`<ANALYZER_DATA_DIR>/consult-exchanges/<jobId>`), `run.ts` badań | `apps/analyzer-api/test/exchange-record-v35417.test.ts`: publiczny POST z tokenem pilota, kontrolowany wyjątek po rozliczeniu odpowiedzi METRIC_READ → zadanie FAILED, dziennik `OPENED…RECEIVED…SETTLED…FAILED…END`, surowa ≠ kanoniczna, brak klucza i nagłówka Authorization; odtworzenie offline (`replayModel(..., rec.answers)`) daje ten sam hash żądania i tę samą pierwszą stratę | DOSTARCZONE | Utraconej odpowiedzi Aurora Midi nie odtwarzam (zakaz); zapis jest prywatny (dane hosta), poza Gitem |
| §1 Rezerwacja w `ledger.ts` badań nie była atomowa | Odczyt–sprawdzenie–zapis bez blokady; rezerwacje tylko w pamięci procesu | `apps/analyzer-api/src/file-lock.ts` (wyodrębniony istniejący mechanizm blokady hosta, bez zmian), `ledger.ts` 2.0.0 (rezerwacje na dysku `RESERVED`, `settle` idempotentne po `attemptId`), `book-host.ts`, `ledger-client.ts` | `research-ledger-v35417.test.ts`: sonda audytu odrzucona; sześć osobnych procesów nigdy nie przekracza pułapu; ponowienie z tym samym `attemptId` księgowane raz; stojące rezerwacje innych procesów liczone | DOSTARCZONE | Księga hosta i księga badań pozostają osobnymi plikami (ten sam mechanizm blokady) |
| §2 Model zbudowany bez LOCAL nie był zwykłym wynikiem | `ConsultedAnalysis.massing` istniało obok koperty; host dostawał LOCAL albo nic | `programmed-result.ts` (wspólny adapter; `houseResult` przeniesiony na niego bez zmiany 214 testów), `consult/massing-result.ts` 1.0.0, `consultAnalysis` (BUILT → recenzowany wynik, `materialize` przez kopertę, cechy dachu → `ROOF_FEATURE_NEEDS_LOCAL_REBUILD`) | `apps/analyzer-api/test/massing-delivery-v35417.test.ts` (**KONTROLOWANY**: `withholdLocalModel` → LOCAL_MODEL_WITHHELD_TEST): zadanie COMPLETED, `LinkAnalysisResult` z modelem i sceną, `checkedRevision == deliveredRevision`, powtórka bajt w bajt; wnętrze NOT_CHECKED, żadnego SOURCE_EXACT, ilości ≤ LIMITED | DOSTARCZONE (kontrolowane) | Ruch organiczny bez LOCAL nadal zależy od BUILD_MASSING: Layla NOT_BUILT (≥ 3 prostokąty) |
| §3 Recenzent nie mógł nazwać elementu | W wiadomości nie było listy elementów, a operacje wymagały „listed element” | `consult/element-index.ts` 1.0.0, `loop.ts` (`ModelCheckInput.elements`, tekst indeksu w wiadomości, `SENT_MODEL_CHECK.elementIndex`), kontrakt 0.6.0 / prompt 0.7.0, rejestr 1.2.0 (`targetId`, `blocker`), `execute.ts` (`UNKNOWN_TARGET` / `STALE_TARGET`), `quality.ts` 1.2.0 (blokery: brak wiązania ≠ brak prymitywu) | `correct-v35416.test.ts` (43): wiązanie przez tekst → COMMITTED; kontr-próby: wymyślone id, nieaktualne id, dwa podobne elementy (AMBIGUOUS_TARGET), zły host / zła strona; `continues`/`resolved` (SUPERSEDED do nieistniejącego nie zamyka). `r2/index-proof.ts`: indeks w zapisanej wychodzącej wiadomości (Aurora 759d346b, 41 elementów; Alaska f0c3b54b) | CZĘŚCIOWO | Ścieżka pozytywna na prawdziwych domach zablokowana: widoki analizatora mają `heights:false` (VIEW_WITHOUT_HEIGHTS), a ASSIGN_VIEW z liczb szkicu daje AXIS_MISMATCH (Aurora: okap rysunku ≈ 2,76 m vs model 5,92 m). Dowód na żywo nieuruchomiony (budżet) |
| §4 Fałszywy globalny spór okapu (sonda orientacji) | Orientację i pomiar liczono dla całego domu, a zasłonięta niska bryła „głosowała” | `massing.ts` (`exclusiveStretches`, `readableStretch`), `ops.ts` 1.1.0 (`orientationOf` per bryła z przesłonięciem; mapa `sideOf` współdzielona; propozycje tylko dla brył potwierdzonych) | `massing-v35417.test.ts` (24): sonda audytu → AS_LABELLED (niska bryła ukryta tylko na LEFT); dwie bryły obrócone → TURNED_90; niepewna bryła nie blokuje potwierdzonej propozycji. `r2/orientation-probe-r2.json`: stara sonda odtwarza UNDECIDED, produkcja daje AS_LABELLED | DOSTARCZONE | Orientacja to nadal hipoteza (TURNED_90 nigdy nie przesuwa ściany) |
| §4 TURNED_90 tylko w dachu | Mapowanie stron nie trafiało do otworów | `consultAnalysis`: przy TURNED_90 propozycje otworów ze szkiców pomijane z ORIENTATION_TURNED_90 | `r2/alaska-replay-s4-semantic.json`: Alaska TURNED_90, otwory ze szkiców nie lądują na złej ścianie | DOSTARCZONE (pominięcie, nie przemapowanie) | Przemapowanie otworów przez `sideOf` jest następnym krokiem; teraz bezpieczna odmowa z nazwą |
| §4 Dobudówka 87° | Strona widziana przez bryłę z przodu przypisana dobudówce | `bindSetRoof`: BODY_HIDDEN_ON_SIDE, ROOF_NOT_THIS_BODY / ROOF_WIDER_THAN_BODY, REGISTRATION_INCONSISTENT, IMPLAUSIBLE_PITCH (> 85°, z nazwą) przed komendą | Alaska: główny SET_ROOF COMMITTED (okap 3,99, kalenica 7,47, 41,4°; host wcześniej 4,19 / 7,84 / 42,7; publikacja 7,68 / 40°), brak propozycji dla dobudówki; kontr-próba: wymuszona łata dobudówki → BODY_HIDDEN_ON_SIDE; stroma, ale poprawna wieża 70° → COMMITTED | DOSTARCZONE | Bez przycinania wartości (clamp) — tylko odmowa z nazwą |
| §5 Szkice i galeria | Ścieżki galerii Alaski błędne; brak szkiców dla zadań nieudanych | `r2/sketch-delivery.ts` (prawdziwe zachowane odczyty, 0 żądań), `r2/boards-gallery.py` (plansze, `gallery.html`, `--check`) | 4 strony × 4 domy z oryginałem i powodem braku; Aurora Maxi FRONT/REAR PARTIAL (prawdziwe odczyty → PNG/SVG/JSON/raw), RIGHT/LEFT NOT_REQUESTED; Aurora Midi wszystko NOT_REQUESTED (zadanie FAILED); sprawdzenie linków 56 / 0 brakujących, powtórzone po rozpakowaniu ZIP-a | DOSTARCZONE | Obrazy wydawcy tylko w prywatnym ZIP-ie |

## E2E, miniatura, metryka, wnętrze, przeniesienie (osobno)

- **E2E hosta.** Dwa testy przez publiczny POST z prawdziwym hostem: porażka z zapisem (§1) i dostawa bez LOCAL
  (§2, kontrolowana). Ballina, powtórka 10 decyzji: model fa31a591, identyczny jak w v3.54.17. Żadnego nowego biegu
  na żywo.
- **Miniatura / scena.** Sceny APK się nie zmieniły. Kod aplikacji Android nie został dotknięty, więc nowego APK nie ma.
  APK 1348 z v3.54.17 (≈ 52 MB) nie jest ponownie dostarczany, bo przekracza limit 30 MB, a nic w nim się nie zmieniło.
- **Metryka.** Poprawka czytnika metryki: pusty literał i odmowy `safeParse` zamiast wyjątku (`metric-read-v35414.test.ts`).
  Bez zmiany tolerancji.
- **Wnętrze.** Model bez LOCAL ma wnętrze NOT_CHECKED (ostrzeżenie MASSING_INTERIOR_NOT_CHECKED). Nic nie jest
  promowane do SOURCE_EXACT.
- **Przeniesienie.** Korekty działają na modelu, który stoi, przez jednego wykonawcę. TURNED_90 nie przenosi otworów
  (odmowa z nazwą).

## Koszt na żywo (dlaczego nie uruchomiono)

Księgi: 28,542857 USD wydane, pułap 28,854612 USD, nominalnie zostaje 0,311755 USD. Minimalny dowód §3 na żywo w
konfiguracji hosta to 2 spojrzenia × do 3 tur × 1 ponowienie. Rezerwacja wynosi ≈ 0,17–0,19 USD na żądanie recenzji
(Sonnet 5.5, 2 / 10 USD za MTok; dziennik hosta), więc najgorszy przypadek to ≈ 1,5 USD. Nawet 2 spojrzenia po jednej
turze bez ponowienia to ≈ 0,38 USD. Pełne maksimum się nie mieści, więc bieg na żywo nie został uruchomiony. Luka jest
nazwana: **dowód na żywo `continues`/`resolved` i ścieżki pozytywnej §3**.

## Testy

- Typecheck: `npx tsc -p tsconfig.json --noEmit` — czysto.
- Dotknięte testy: `exchange-record-v35417`, `research-ledger-v35417`, `massing-delivery-v35417`,
  `correct-v35416` (43), `massing-v35417` (24), `metric-read-v35414`, `house-reader-spend` (22), testy `house` (214).
  Wszystkie zielone.
- Pełna macierz (4472 testy: 4426 zaliczonych, 18 porażek, 11 pominiętych): `stage-reports/artifacts/v35417-r2/matrix-r2-summary.json`. Porażki są tylko w znanych plikach bazy
  (research-isolation 4, reference 2, analyzer-api 1, wall-strip 4, presentation 2, compound-facade 1, text 1 oraz
  program / worker pod obciążeniem). Każda z nich występuje też w bazie (`rd/v35417/matrix/final.txt`). Nowych porażek
  nie ma.

## Otwarte (nazwane)

1. Ścieżka pozytywna §3 na prawdziwym domu: widoki analizatora bez wysokości oraz niespójna rejestracja szkicu
   (AXIS_MISMATCH). Wymaga rejestracji wysokości widoku, nie poluzowania bramki.
2. Dowód na żywo `continues`/`resolved` — budżet.
3. Obrysy ≥ 3 prostokątów (Layla NOT_BUILT), więc „buduje bez LOCAL” organicznie nadal nie zachodzi.
4. Przemapowanie otworów przy TURNED_90 (dziś odmowa).
5. Dachy kopertowe i mansardowe — poza zakresem.

## Dostawa

Prywatny ZIP (części < 30 000 000 B każda, sumy SHA-256 i instrukcja rozpakowania w `MANIFEST-R2.txt`):

- galeria i plansze §5;
- zapisy wymiany i dowody indeksu;
- powtórki (Alaska, Ballina);
- log macierzy;
- księga.

Po rozpakowaniu `boards-gallery.py --check` daje 0 brakujących odnośników.
