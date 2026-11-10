# SOURCE-TO-MODEL v3.53 — dom czytany w całości (raport punktu kontrolnego)

Zlecenie OWNER-a v3.53.0 (2026-11-10). Gałąź `claude/new-session-3kzcgh`, punkt odniesienia `1370a1d` (APK 1327 z kodu
`0fe410a`). Kod tego punktu kontrolnego: **`e223cb2`**. Wcześniejszy raport kampanii: `stage-reports/SOURCE_TO_MODEL.md`.

| | stan |
|---|---|
| **SLICE S53** (ścieżka „model z opisu źródeł": czytnik całego domu → opis w zamkniętym słowniku → deterministyczna budowa → istniejący emiter, walidator, kompilator; podłączona w `analysis-service` i w serwisie HTTP) | **PASS w zadeklarowanym zakresie**: na 6 stronach odłożonych przed rozwojem model powstaje w 6/6, rozpoznawalny kandydat wg zamrożonej reguły w 5/6 (kaskada 1327: 2/6 „modeli", oba bez kotwicy metrycznej). **Nie jest to akceptacja OWNER-a** — plansze wysłane, ocena „to ten dom" należy do OWNER-a. |
| **CAMPAIGN** | **WORK_IN_PROGRESS** |
| **VERIFICATION** | host: testy pakietów dotkniętych zmianą (§6), 12 stron sześciu wydawców przez produktową funkcję `runDescribedAnalysis`, zadanie przez prawdziwe gniazdo HTTP serwisu z odtwarzanym czytnikiem. **Adapter SDK do płatnego API: NOT_VERIFIED na żywo** (brak bezpiecznie skonfigurowanego klucza). **Serwis: niewdrożony.** **Android UI: NOT_VERIFIED.** APK nie zbudowano — zachowanie telefonu bez serwisu się nie zmienia. |
| **NEXT** (jedna czynność) | Po decyzji OWNER-a o hostingu i kluczu (§7): wdrożyć `apps/analyzer-api` z `ANALYZER_HOUSE_READER=live`, wykonać jedno płatne zadanie przez SDK na stronie DEV i porównać z zapisanym wynikiem CLI; dopiero wtedy APK ≥ 1328 z adresem serwisu. Bez tej decyzji: kalenica dachu dwuspadowego dobudówki z obserwowalnego szczytu (§5 pkt 1), na zamrożonym podziale DEV/CONTROL. |

## 1. Diagnoza, od której zaczęto

Kaskada 1327 wymaga rzutu z obrysem ścian i skalą; elewacje i wizualizacje nie ustalają bryły. Na stronach nieoglądanych
wcześniej dawała model w 6 z 18 przypadków, a zbudowane modele obcych wydawców były parterowymi przybliżeniami. Dowody
1327 zabezpieczone: `research/source-to-model/evidence-1327/` (indeks i sumy w Git, bajty wydawców poza Git).

Hipoteza H1: wąskim gardłem jest obowiązkowa kaskada rzutu, nie rdzeń semantyczny. Dom opisany w całości przez model
wizyjny i zbudowany istniejącym emiterem/kompilatorem da rozpoznawalnego kandydata tam, gdzie kaskada odmawia.

## 2. Co zbudowano

- `packages/source-vision`: `HouseDescription` 0.2.0 (zamknięty słownik: bryły z rolą, kondygnacjami, dachem; otwory
  liczone i wymieniane osobno dla każdej strony; lukarny, okna połaciowe, kominy, balkony, tarasy, zadaszenia, paleta;
  jawne „nie wiem" i strony hipotetyczne) z deterministycznym `checkHouseDescription`; szew `StructuredVision`
  (sortowanie obrazów strony, potem jedno pytanie o dom) z adapterem SDK (wynik strukturalny, klucz wyłącznie w
  środowisku hosta) i odtwarzaczem zapisanych odpowiedzi do testów.
- `packages/reconstruction/src/v2/described-house.ts`: opis → `BuildingV2` → **ten sam** emiter, walidator i kompilator.
  Każda naprawa jest typowanym wpisem (`OPENING_MOVED_TO_WALL`, `SCALED_TO_PUBLISHED_FIGURE`, `ROOF_KIND_STOOD_IN`, …).
  AI nie wydaje kodu, poleceń, identyfikatorów ani siatki.
- `packages/analysis-service`: `runDescribedAnalysis` (wynik w kontrakcie ścieżki rysunkowej) i `analyseLink`:
  najpierw rysunki; opis wchodzi, gdy rysunki odmawiają z powodu, który zostawia obrazy nieprzeczytane
  (`RECONSTRUCTION_FAILED`, `NO_DRAWINGS`, `SOURCE_INCOMPLETE`), albo gdy model z rysunków nie ma ani zweryfikowanej
  skali, ani zmierzonej wysokości (wtedy zostaje obok jako alternatywa). Postęp nigdy się nie cofa.
- `apps/analyzer-api`: `ANALYZER_HOUSE_READER=live` + klucz hosta; dzienny limit płatnych opisów dla całego hosta
  (`ANALYZER_HOUSE_READER_MAX_PER_DAY`, domyślnie 20, liczony przed żądaniem). Wbudowany analizator telefonu bez zmian.
- Model z opisu mówi, czym jest: `MODEL_FROM_SOURCE_DESCRIPTION` (LIMITING), statusy `VISUAL_SEMANTIC` /
  `ASSUMED_FOR_RENDERING`, jakość wyłącznie L0, zgodność ze źródłem UNCHECKED, skala i wysokości prowizoryczne, etykieta
  „(model z opisu źródeł)". Zasady zapisane w `docs/ANALYZER_CONTRACT.md` §6.1.
- Reguł po wydawcy, adresie, nazwie ani hashu domu nie ma. Czytnik dostaje ponumerowane obrazy, instrukcję i liczby
  opublikowane na stronie; referencje istnieją wyłącznie w ocenie.

## 3. Eksperymenty (zestawy i kryteria zamrożone przed wynikami)

Checklisty referencyjne pisał osobny anotator, który nie widział żadnego wyniku kandydata; zatwierdzone w Git przed
przebiegami (`s53/reference/`, `s53/reference-heldback/`). Reguła RECOGNISABLE_CANDIDATE: bryły, kondygnacje, rodzaj
dachu głównego i kierunek kalenicy — wszystkie cztery poprawne.

**S53-E1, pilot (6 stron, pierwsza strona każdego z sześciu wydawców CONTROL-2).** `S53-E1.json`, `S53-E1-RESULT.json`.

| | modele | rozpoznawalny kandydat |
|---|---|---|
| kaskada 1327 | 1/6 (dwie wieże 18 m w złej skali) | 0/6 |
| opis, pierwszy ślepy przebieg | 4/6 (dwie odmowy własnego ograniczenia schematu: głębokość balkonu) | — |
| opis po ogólnej poprawce (te same zapisane opisy, bez nowych wywołań) | 6/6, 0 błędów kompilacji | 5/6 |

Pierwszy ślepy wynik zostaje w historii. Po diagnozie sześć stron jest DEV. Na nich poprawiono (opis 0.2): liczenie
otworów osobno na każdej stronie, reguły kalenicy i wysokiej strony dachu jednospadowego, wysyłanie planu sytuacyjnego,
szczyt poprzeczny wtapiany w połać sąsiada, skala z liczb opublikowanych, gdy wymiaru nie wydrukowano.

**S53-E3, kontrola odłożona (6 stron — druga strona każdego wydawcy, nieotwierane przed zamrożeniem; kod `9069ec7`;
jedno uruchomienie na stronę przez `runDescribedAnalysis`).** `S53-E3.json`, `S53-E3-RESULT.json`.

| strona | model | rozpoznawalny | uwagi wg checklisty |
|---|---|---|---|
| architecturaldesigns-com-2 | tak | tak | bryły, garaż z pokojem, ganek na 7 słupach; liczby otworów każdej strony w granicy 1; dwie lukarny nieopisane |
| dobredomy-pl-2 | tak | **nie** | wymiary wydrukowane odczytane; kierunek krótkiej kalenicy dachu kopertowego i dachu garażu odwrotnie; 1 błąd kompilacji (wada budowniczego, naprawiona po ocenie) |
| domoweklimaty-pl-2 | tak | tak | lukarna z balkonem, 2 kominy, taras pod dachem pulpitowym; kalenica garażu odwrotnie |
| extradom-pl-2 | tak | tak | wymiary wydrukowane; kominy 1 z 2 |
| houseplans-com-2 | tak | tak | dom i warsztat pod jednym dachem, ganek w L; front 7 otworów w kolejności |
| lipinscy-pl-2 | tak | tak | wąski blok dwuspadowy; front 3 i tył 5 otworów, ściany szczytowe ślepe jak w źródle |

Razem: **modele 6/6, rozpoznawalne 5/6**; SKALA 6/6, OTWORY FRONTU 6/6, OTWORY POZOSTAŁYCH STRON 6/6 (w pilocie przed
poprawką 2/6), DACHY DOBUDÓWEK błędne 2/6; cechy dachu niedoczytane (lukarny 0 z 2 na jednym domu, okna połaciowe 2 z 5,
drugie kominy). Kaskada 1327 na tych samych stronach: 2 modele (oba `SCALE_NOT_VERIFIED` + `HEIGHT_ASSUMED_FOR_PREVIEW`;
jeden to dwa otwarte pudełka z płaskim dachem dla parterówki z dachem kopertowym), 4 odmowy.

Po ocenie E3 (strony są od tej chwili DEV; wynik oceniony to ten sprzed poprawek): okap dachu kopertowego na wszystkich
czterech stronach albo na żadnej (usuwa błąd kompilacji — sprawdzone odtworzeniem zapisanego opisu, bez nowego
wywołania); ślepa ściana nie jest już zgłaszana jako „pokazana, ale pusta"; polityka `DRAWINGS_MODEL_UNANCHORED`.

Granice wniosku: 12 stron sześciu wydawców w dwóch zestawach. To nie „dowolny link": wydawcy odmawiający klientowi są
nadal poza zasięgiem, w żadnym zestawie nie było strony nieznanego wydawcy, oceniała sesja (nie OWNER), a audyt styków
zgłasza 3–7 uwag zewnętrznych na każdym modelu z opisu — niezbadane, raportowane jako błędy techniczne.

## 4. Koszt i czas

Czytnik: `claude-sonnet-5-5` (wysiłek medium) dla opisu, `claude-haiku-5-5` dla sortowania obrazów. E3: 0,089–0,178 USD
i 48–115 s na dom, razem 0,744 USD. Rejestr `research/ai-assist/spend-ledger.json`: **2,7281 USD z limitu 5 USD od E12**
(92 wpisy, w tym historyczne 0,60838938), szacunek z tokenów CLI, billing UNCONFIRMED. Licznika nie zerowano; każde
wywołanie rezerwowane przed startem; wywołania sekwencyjne. Klucz ujawniony wcześniej w czacie nie był użyty; żadnego
klucza nie ma w repo, APK ani logach. H2 i prywatny benchmark nieotwierane i niewysyłane. Ramion Opus/Haiku jako
czytnika opisu nie mierzono (budżet).

## 5. Pierwsze błędne decyzje, które zostają

1. **Kierunek kalenicy dachu dobudówki** — błąd czytnika; jedyny powtarzalny powód utraty rozpoznawalności.
   Część rozstrzygnięta bez czytnika (budowniczy 0.2.0, po ocenie E3): dach kopertowy o jednym spadku ma kalenicę wzdłuż
   dłuższego boku — to geometria, nie odczyt; kalenica podana w poprzek jest obracana i nazwana
   (`HIP_RIDGE_ALONG_LONGER_SIDE`; bryła bliska kwadratu i dach dwuspadowy zostają jak odczytane). Odtworzenie 10
   zapisanych opisów bez nowych wywołań: 10 modeli, 0 błędów kompilacji, zmienia się tylko dom z E3 oceniony jako
   nierozpoznawalny — jego dach główny jest teraz zgodny z referencją (to poprawka DEV, nie wynik kontroli).
   Zostają dwa garaże na rzucie kwadratowym (kopertowy 6,35 × 6,10 i dwuspadowy 6,75 × 6,75), gdzie proporcje nic nie
   mówią. Hipoteza: pytać o obserwowalne („na której elewacji tej bryły widać trójkąt szczytu") i wyprowadzać kalenicę
   deterministycznie — wymaga płatnych przebiegów i świeżej kontroli.
2. Cechy dachu: lukarny, okna połaciowe, drugie kominy — niedoliczone.
3. Słownik budowniczego: elewacje dwutonowe i okładziny nie powstają; dachy ganków to płaskie płyty.
4. Uwagi audytu styków na modelach z opisu — niezbadane.
5. Bliźniak: jedna połowa czy para — decyzja produktowa OWNER-a.
6. Istniejący `anthropicVisionReasoner` (starsza ścieżka `ANALYZER_VISION=live`) używa wymuszonego `tool_choice`, którego
   bieżące modele nie przyjmują — zanotowane, nienaprawione (poza zakresem tego wycinka).
   **Sprostowanie (v3.53.1):** to zdanie było błędne — adapter używa `tool_choice: auto` od E12; patrz
   `SOURCE_TO_MODEL_V3531.md` §5.

## 6. Testy na drzewie `e223cb2`

Nowe: `packages/reconstruction/test/described-house.test.ts` (lustro, kalenica/rodzaj, dach jednospadowy, zablokowane
otwory, przycinanie, kosz szczytu poprzecznego, reguły skali), `packages/source-vision/test/house-description.test.ts`,
`packages/analysis-service/test/generic-source.test.ts` (ścieżka opisu, odmowy, determinizm bajt w bajt, predykat braku
kotwicy), `apps/analyzer-api/test/described.test.ts` (zadanie przez gniazdo HTTP, limit dzienny). `tsc --noEmit` czysto.
Paczka serwisu (`node build.mjs`) zawiera ścieżkę opisu i SDK, bez danych referencyjnych; uruchomiona lokalnie z
`ANALYZER_HOUSE_READER=live` i bez klucza odpowiada jak dotąd.

Macierz pakietów dotkniętych zmianą (`packages/{reconstruction,source-vision,source-package,analysis-service,
mobile-scene}`, `apps/{analyzer-api,local-analyzer}`, `tests/architecture`; pozostałych pakietów nie uruchamiano)
biegła w całości na `7e0f563`: 2511 testów — 2487 przechodzi, **17 pada**, 7 pominiętych. Piętnaście z nich to co do
nazwy zestaw z `0fe410a` (snapshot kontraktu Android, `/health`, cztery strażniki izolacji badań, dwa testy modelu
referencyjnego, cztery `wall-strip`, jeden `compound-facade`, NFD bez ICU, scena Larchfield). Dwa pozostałe to
strażniki architektury serwisu naruszone przez tę pracę (nazwa zmiennej klucza w komentarzu `wiring.ts`; wejście
serwisu zmienione z `runAnalysis` na `analyseLink`) — pierwszy poprawiony w kodzie, drugi świadomie zaktualizowany
(sprawdza łańcuch `executor → analyseLink → runAnalysis` i brak własnych kroków potoku w obu); oba uruchomione
ponownie i zielone. Na końcowym drzewie `e223cb2` uruchomiono ponownie 8 plików testów ścieżki opisu i strażnika
serwisu: 95/95; pełnej macierzy na `e223cb2` nie powtarzano.
W szczególności: `apps/analyzer-api/test/android-contract.test.ts` (snapshot), `apps/analyzer-api/test/api.test.ts`
(GET /health), `apps/local-analyzer/test/program.test.ts` (hashe Larchfield), `apps/local-analyzer/test/text.test.ts`
(NFD).

## 7. Dokładna blokada uruchomienia w aplikacji

Ścieżka opisu działa na hoście z czytnikiem. Telefon ma jej użyć przez serwis (pole „Adres serwisu" w aplikacji albo
zmienna budowania `ANALYZER_API_BASE_URL`). Brakuje dwóch rzeczy, obie wymagają decyzji OWNER-a (brief: bez nowego
płatnego hostingu i bez nieskonfigurowanych sekretów):

1. **host dla `apps/analyzer-api`** (przepis w `docs/ANALYZER_API.md`: obraz Docker, `fly.toml`; dowolny host kontenerów);
2. **klucz API ustawiony jako sekret hosta** (`ANTHROPIC_API_KEY`), nigdy w czacie, repo ani APK.

Przygotowane i sprawdzone bez nich: kod, paczka, kontrakt zadania, limit dzienny, zachowanie bez klucza. Niesprawdzone:
jedno prawdziwe żądanie adaptera SDK (ten sam prompt i schemat przeszły przez CLI na 12 stronach).

## 8. Plansze dla OWNER-a

Sześć plansz kontroli odłożonej (źródła strony · model z opisu · wynik kaskady 1327) wysłane prywatnie w sesji; obrazy
wydawców nie są w repozytorium. Pytanie: „czy to ten dom?" — odpowiedź OWNER-a jest niezależną oceną, której ten raport
nie zastępuje.
