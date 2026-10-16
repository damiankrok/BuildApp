# STAGE BUILDPLAN-ANALYZER-005R-EXTERIOR-OWNER-TRUTH-PACK — lokalny pakiet recenzji OWNER-a (narzędzie badawcze)

**Klasa: RESEARCH TOOLING / przygotowanie prawdy ludzkiej. Zero zmian produkcyjnych.** Bez detektora, bez 005S, bez
ślepej rundy, bez pełnego CI, bez APK. Baza `47bafa6352df473f79992b7377d14ca1808ce767` (preflight: gałąź badawcza =
baza, brak `BASE_DRIFT`; lustro `claude/new-session-3kzcgh` celowo zostaje na `bfaf286…`, nietknięte). Gałąź
`analyzer/exterior-owner-truth-review-pack-v1`, jeden commit.

**Werdykt: `READY_FOR_OWNER_LOCAL_REVIEW`.** Narzędzie, kotwice i kroki są zademonstrowane na danych syntetycznych;
**prawdziwe etykiety OWNER-a: NOT_RUN**, więc każda trafność klasy i każdy zysk to `NOT_MEASURED`.

## Podsumowanie dla OWNER-a

| pytanie | odpowiedź |
| --- | --- |
| Co dostajesz? | Stronę `review.html` działającą offline w przeglądarce, kolejkę **60 pytań** (34 priorytetowe o 9 obrazach + 26 dodatkowych) o **35 obrazach** z **14 edycji** (35 grup linii), instrukcję `README-owner-review.md`, pusty szablon etykiet i przykład z etykietami wyłącznie **SYNTETYCZNYMI**. |
| Skąd obrazy? | **Nie z repozytorium i nie od agenta.** Kopia z badania leży w zdalnym kontenerze, do którego nie masz dostępu; nie ma uzgodnionego prywatnego kanału na piksele wydawcy, więc ich nie przenoszę. Pobierasz je sam z 14 publicznych stron projektów (lista w README). Strona dopasowuje każdy plik po SHA-256. |
| Czy to realne? | Sprawdzone tylko nagłówkami (0 bajtów obrazu): **27 z 35 obrazów** (52/60 pytań, w tym **wszystkie 34 priorytetowe**) jest nadal podlinkowanych na bieżących stronach pod tym samym adresem i z tą samą długością; 7 (wizualizacje z karuzel, tylko pytania dodatkowe) — adres działa z tą samą długością, ale statyczny HTML ich nie linkuje; 1 (`lg-9c1d12b96d9a`) ma już inną długość. Zgodność bajtów potwierdzi dopiero strona na Twoim komputerze. |
| Co zrobić? | Zapisz obrazy z 7 pierwszych stron z listy, otwórz `review.html`, wskaż folder, odpowiedz na 34 pytania priorytetowe, zapieczętuj, przejdź kontrolę techniczną, wyeksportuj JSON. |
| Czy agent coś oznaczył? | **Nie.** Żadnej odpowiedzi nie wpisał agent ani model; żaden obraz wydawcy nie był otwarty, pokazany ani wysłany do modelu. |

## A. Zakres i zamrożenie

- Dotknięte ścieżki: nowy katalog `research/analyzer-005r-exterior-owner-review/` (siostrzany wobec
  `research/analyzer-005r-exterior/`, który pozostaje **bajt w bajt** jak w bazie), ten raport, `PROJECT_STATUS.md`,
  nowy blok w `tests/architecture/research-isolation.test.ts`.
- `packages/`, `apps/`, `android/`, `.github/`, `holdout/`, `package.json`, `package-lock.json`, wagi, wydania —
  `git diff --stat 47bafa6` pusty.
- Wcześniejsze badanie przyjęte jako `CLOSED / PARTIAL_RESEARCH_INSUFFICIENT_TRUTH`: 15 „potwierdzeń” B1 to nie 15
  niezależnych (ściśle 2 tarasy, 9 garaży = spójność karty wydawcy), 19/19 pytań widoczności wstrzymanych, 0
  niezależnych potwierdzeń 7 klas rozpoznawczych. Strażnik N1 nietknięty.

## B. Preregistracja (przed kodem)

`preregistration.md` spisane przed `build_pack.py` i przed jakimkolwiek kodem strony: słownik pytań i odpowiedzi, reguły
kolejki R1–R5, deduplikacja, warstwy, limit 60, kolejność, schematy plików, fazy, testy T1–T8. **Addendum A** (po
`build_pack.py`, przed logiką strony; żadna odpowiedź nie istniała): faza 2 pytania o scenę to `sourceContext`, nie dowód
techniczny; osobny plik lokalizatora; plik dostępności stron; jeden walidator (JS, także w Node); demo w BMP.
Skrót preregistracji jest zapisany w kolejce (`preregistrationSha256`).

Ponowne użycie: słownik sceny z `research/analyzer-005r-router/spot_review.py` (`sceneScope`) i jego zasada kopii
recenzenta bez etykiet; tożsamość edycji, grupy linii, bajty i role z zatwierdzonych JSON 005R / 005R-EXTERIOR. Bez
nowego crawlera i bez silnika wnioskowania.

## C. Kolejka (`build_pack.py`, deterministyczna)

| reguła | co | pytań |
| --- | --- | --- |
| R1 | każda z 19 wstrzymanych propozycji `FEATURE_VISIBILITY` B1 (5 renderów: `m3ea`, `m493`, `m504`, `ma77`, `md60`) | **19/19** (0 wykluczeń) |
| R2 | partnerzy look-alike na tych klatkach (garaż→wiata, balkon→loggia, taras/daszek→słup) — klasy **nie** z roszczeń | 10 |
| R3 | scena dla grup renderów zewnętrznych, gdzie B1 wstrzymał rolę, + klatka OWNER-a | 9 |
| R4 | wnętrza (7) i kontrole konfliktu struktury (2, podpis „zewnętrzny” w karuzeli wnętrz) | 8 (1 odcięte limitem) |
| R5 | jedna cecha na elewacji każdej edycji (14) | 14 |

- **Warstwy (po addendum B):** PRIORITY 34 = wszystkie pytania o 9 obrazach: 5 klatkach R1 (R1 + ich partnerzy R2),
  pozostałych obrazach `m3ea…` i 2 kontrolach konfliktu; SECONDARY 26. Warstwa jest cechą obrazu, więc nie zdradza,
  które klasy deklaruje wydawca. Limit 60 odciął 1 pytanie o wnętrze (`CAP_60`, w `results/exclusions.json`).
- **Pokrycie:** 43 pytania o cechy + 17 o scenę; 38 na renderach zewnętrznych, 14 na elewacjach, 6 na wnętrzach,
  2 na konfliktach. Klasy: COLUMN 8, CARPORT 7, TERRACE 5, PERGOLA 4, BALCONY 4, GARAGE 4, OPENING_GLAZING 4,
  LOGGIA 3, RAILING 2, ENTRANCE_CANOPY 1, UNKNOWN_ASSEMBLY 1, ROOFCOVER 0 (żadna reguła go nie wybiera — nie
  dopisałem pytania ręcznie). Ok. połowa pytań o cechy dotyczy klasy deklarowanej przez wydawcę, reszta to kontrole (dokładna liczba w fazie 2: `publisherCategory`/`publisherDescriptionKind`).
- **Izolacja:** pytanie przyjmuje tylko bajty opublikowane przez **swoją** edycję (kotwica + warianty tego samego
  pliku wydawcy). Bliźniaczy render `lg-0ec5494a5b15`: pytania `m3ea` przyjmują wyłącznie bajty `m3ea`, nigdy `m84f`.
  Grupa wnętrza wspólna bajtowo dla `m3ea`/`m738`/`m84f`: jedno pytanie pod `m3ea`, jawnie **nie** propagowane
  (`BYTE_SHARED_LINEAGE_NOT_PROPAGATED`). To jedyny, nazwany wyjątek (addendum B): te bajty są identyczne z plikami
  innych edycji, więc ich pochodzenia nie da się odróżnić; faza 2 pokazuje `acceptedBytesAlsoPublishedBy`. Jeden plik bajtów należy w całej kolejce do jednej edycji (sprawdzane w
  Pythonie i w stronie).
- **Liczone po edycji i linii, nie po kopii:** 35 obrazów = 35 grup linii; żadna grupa nie ma pytań pod dwiema
  edycjami.

## D. Narzędzie

- `review.html` + `tool/` (vanilla JS, bez zależności). CSP: `default-src 'none'; script-src 'self'; style-src 'self';
  img-src blob:; connect-src 'none'` + brak `fetch`/XHR/WebSocket w kodzie. Obrazy: wybór folderu/plików lub
  upuszczenie → SHA-256 lokalnie (WebCrypto, zapasowo czysty JS) → `blob:`. Zapasowo `serve_local.py` tylko na
  127.0.0.1 (GET/HEAD, bez listingu).
- **Faza 1 (ślepa):** obraz, neutralne id, pytanie, odpowiedzi `PRESENT / ABSENT / NOT_SHOWN / CANNOT_TELL` (scena:
  `EXTERIOR / INTERIOR / BOTH_VISIBLE / NOT_A_SCENE / CANNOT_TELL`), opcjonalnie zadaszenie
  (`OPEN_MEMBERS / CONTINUOUS_COVER / NO_COVER / UNKNOWN`), rodzaj dobudowy, obszar [0,1], strona, lustro. Kolejka
  ślepa nie zawiera kanału, podpisu, roszczeń, statusów B1 ani adresu. Brak bajtów → `SOURCE_IMAGE_UNAVAILABLE`,
  odpowiedzi zablokowane; świadomy tryb „strona wydawcy” zapisuje `MANUAL_PAGE_FALLBACK_NOT_BLIND`.
- **Pieczęć:** SHA-256 kanonicznych odpowiedzi fazy 1; zamyka okno ślepe dla wszystkich pytań. To kontrola spójności,
  nie podpis: ktoś, kto świadomie zmieni odpowiedź i przeliczy skrót, przejdzie import — dlatego OWNER wysyła skrót
  koordynatorowi przed fazą 2. Po pokazaniu fazy 2 przeglądarka blokuje odpowiadanie ślepe i import niezapieczętowany.
- **Faza 2:** `crosscheck.js` ładowany dopiero po pieczęci (kanał, podpis-klasa, status B1, przeliczenie ścisłe,
  roszczenia, plan, cechy produkcji, pytania tej samej edycji, strona projektu, dostępność). Odpowiedź fazy 1 jest
  tylko do odczytu; niezgodność = `conflict: true`. `TECHNICALLY_CROSSCHECKED` tylko dla cech, gdy rysunek
  pokazuje lub wyklucza cechę (ze źródłem); scena nigdy. `metricAuthority` zawsze `NONE`.
- **Eksport/import:** JSON i CSV deterministyczne (posortowane klucze, kolejność kolejki, czas tylko na życzenie);
  import (strona i `tool/validate-labels.mjs`, ten sam kod) odrzuca: zły schemat/pakiet/skrót kolejki, nieznane lub
  zdublowane pytanie, kotwicę innej edycji/grupy/bajtów, bajty spoza zbioru, słownik, pododpowiedzi bez `PRESENT`,
  zły obszar, adres lub zakodowane dane w notatce, zmianę po pieczęci, fazę 2 bez pieczęci, niezgodny status, konflikt
  albo liczniki, pochodzenie inne niż dozwolone dla rodzaju pakietu. Brak odpowiedzi = `UNREVIEWED`.
- Sesja wznawia się z pamięci przeglądarki (sprawdzana regułami importu) albo z importu eksportu.

## E. Dostępność obrazów dla OWNER-a (`check_page_access.py`, `results/page-access.json`)

Dwa przebiegi, każdy: 14 GET stron projektu (tekst, poza repo), 5 GET stron powiększenia (tekst), 38 HEAD adresów
obrazów — **0 bajtów obrazu pobranych**. Przebieg 1 (z podążaniem za przekierowaniami): 52/60 pytań (27/35 obrazów)
`REFERENCED_SAME_LENGTH`, 8 `UNLINKED_URL_SAME_LENGTH`. Przebieg 2 (po audycie, bez przekierowań, zatwierdzony
plik): 52/60 (27/35) `REFERENCED_SAME_LENGTH`, 7 `UNLINKED_URL_SAME_LENGTH`, 1 `CHANGED_OR_GONE` (`lg-9c1d12b96d9a`,
inna długość). Wszystkie 9 obrazów priorytetowych: `REFERENCED_SAME_LENGTH` w obu. Te same adres i długość to silna przesłanka, **nie dowód** identyczności bajtów.
Nie twierdzę, że OWNER ma dostęp do plików w moim kontenerze — nie ma.

## F. Testy (budżet FAST)

| kontrola | wynik |
| --- | --- |
| `test/test_pack.py` (T1 19/19, T2 izolacja, T4 kolejka ślepa, T5 przetasowane wejścia ×3 bajt w bajt, warstwa per obraz, odtwarzalność, szablon) | 8/8 OK |
| `test/core.test.mjs` (SHA-256, integralność, T3 brak domyślnych odpowiedzi, NOT_SHOWN/CANNOT_TELL, obszar, T2 bajty innej edycji, pieczęć/faza 2, scena, round trip i parytet Python↔JS, 16 mutacji importu, poprawki audytu) | 12/12 pass |
| `test/smoke-browser.mjs` (Chromium, czysty katalog poza repo, tylko obrazy syntetyczne): `SOURCE_IMAGE_UNAVAILABLE` → wczytanie 5 plików (4/5 dopasowane) → 7 odpowiedzi kliknięciem (z obszarem) → brak danych fazy 2 przed pieczęcią → wznowienie po przeładowaniu → pieczęć → konflikt w fazie 2 → eksport JSON/CSV (drugi eksport identyczny) → odrzucenie importu zmienionego i przeniesionego na inną edycję → wyczyszczenie i ponowny import → pakiet prawdziwy bez obrazów (60, 34, wszystko niedostępne) | **OK, 23 żądania `file:`, 0 zewnętrznych, 0 błędów konsoli** |
| `build_pack.py --check` | pakiet odtwarzalny |
| `research-isolation.test.ts` (cały plik, nowy blok 6 testów) | 71/71 passed |
| `npm test`, `npm run e2e`, typecheck, 41 jobów CI, emulator, APK, replay 37×18, ślepa runda, pobieranie OCR/AI | NOT_RUN (poza zakresem etapu) |
| fast-forward lustra CI | nie wykonano (celowo) |

## G. Audyt niezależny (jeden) i poprawka

Jeden niezależny audytor statyczny (bez obrazów, bez zapisu, bez sieci). Testy u niego: 11/11, 8/8, `--check` OK,
30 przetasowań wejść identycznych. Jedna faza poprawek (addendum B), potem powtórzone tylko testy tego katalogu.

| # | waga | ustalenie | dyspozycja |
| --- | --- | --- | --- |
| 1 | **P0** | etykieta „priorytet” w fazie ślepej zdradzała roszczenie wydawcy (R1 = klasy deklarowane, partnerzy R2 = „dodatkowe”) | **naprawione:** warstwa per obraz (26 → 34 priorytetowych); klasa elewacji R5 z puli R1 ∪ R2; test „jedna warstwa na obraz” |
| 2 | P1 | pieczęć to SHA-256 bez klucza — świadome przeliczenie przechodzi import | **przyjęte i opisane** (README, raport, addendum B); skrót do koordynatora przed fazą 2 |
| 3 | P1 | po fazie 2 można było wrócić do edytowalnej fazy 1 (reset / import starego eksportu) | **naprawione:** znacznik „faza 2 pokazana” w przeglądarce blokuje odpowiedzi ślepe i import niezapieczętowany |
| 4 | P1 | pytanie OWNER-a o wnętrze przyjmuje bajty publikowane też przez `m84f`/`m738` | **nazwany wyjątek** (addendum B): bajty identyczne, pochodzenie nierozróżnialne; odpowiedź tylko pod `m3ea`, bez propagacji; `acceptedBytesAlsoPublishedBy` w fazie 2 |
| 5 | P2 | adresy bez schematu w notatkach | naprawione (host-like, rozszerzenia obrazów) + test |
| 6 | P2 | R3 pomija grupy konfliktu bez zapisu | addendum B (4) |
| 7 | P2 | słowniki „ostatni wygrywa” zależne od kolejności | naprawione: sortowanie wejść przed budową |
| 8 | P2 | wykluczenie dedup bez `b1ProposalId` | naprawione |
| 9–10 | P2 | digest przykładu liczony w Pythonie; klucze liczbowe w kanonizacji | opisane; parytet testowany, brak takich kluczy |
| 11 | P2 | README: strona/lustro „tylko przy Widać”, kod — przy każdej | README poprawione |
| 12 | P2 | `TECHNICALLY_CROSSCHECKED` przy `NO_TECHNICAL_EVIDENCE` | naprawione (tylko SHOWS / DOES_NOT_SHOW) + test |
| 13 | P2 | wstrzyknięcie formuły w CSV | naprawione + test |
| 14 | P2 | po przeładowaniu tryb ręczny bez lokalizatora | naprawione (lokalizator ładowany przy wznowieniu) |
| 15 | P2 | `curl -L` bez ponownej kontroli hosta | naprawione (bez przekierowań), przebieg dostępności powtórzony |
| 16 | P2 | wspólna pamięć `file://` | opisane w README |

Bez ustaleń: XSS, dziury CSP, sieć w kodzie strony, fałszywe kotwice międzyedycyjne, UNREVIEWED vs ABSENT.

## H. Bezpieczeństwo i prawa źródła

- Repozytorium: kod, identyfikatory, skróty, adresy **stron** projektów (już zatwierdzone w 005R), nazwy klas.
  Żadnego piksela, adresu obrazu, HTML, podpisu ani tekstu wydawcy (test izolacji to wymusza). Obrazy syntetyczne
  powstają poza repo (`make_synthetic_demo.py` odmawia zapisu w repo).
- Żaden obraz wydawcy nie był otwarty, pokazany ani wysłany do modelu (ani do audytora). Zrzuty ekranu z testu
  pokazują wyłącznie obrazki syntetyczne i pustą stronę pakietu prawdziwego; leżą poza repo.
- OWNER pobiera publiczne obrazy sam, do swojego komputera; narzędzie nic nie wysyła.

## I. Luki prawdy, które zostają

- Ludzka prawda: **NOT_RUN** (0 z 60). Bez niej: widoczność cech na klatkach, pergola/wiata/daszek/słupy/balkon/loggia/
  balustrada, zadaszenie ażurowe vs pełne — wszystko `NOT_MEASURED`.
- Ślepota jest ograniczona: OWNER, pobierając obrazy, widzi stronę wydawcy. Zalecenie w README: pobrać jednego dnia,
  odpowiadać innego. Tryb ręczny jest jawnie „nie ślepy”.
- Jeden recenzent, jeden wydawca, ≤ 60 pytań, 14 edycji z 12 rodzin (warianty skorelowane, Rarytasy ×3) — każda
  przyszła liczba wymaga przedziałów i grupowania po rodzinie/grupie linii.
- ROOFCOVER bez pytania; 8 obrazów dodatkowych może być nieosiągalnych ze stron (1 już zmieniony).
- Pieczęć nie chroni przed świadomym fałszerstwem (skrót bez klucza); pamięć przeglądarki na `file://` jest wspólna
  dla lokalnych stron. Dowodem jest eksport, a skrót pieczęci powinien trafić do koordynatora przed fazą 2.

## J. Jedna decyzja dla koordynatora

Czy OWNER wykonuje teraz partię priorytetową (34 pytania o 9 obrazach, 7 stron) i odsyła eksport — a ocena (np. zgodność ról sceny
B1 i bramka niezależnych potwierdzeń klas) idzie dopiero jako **osobny** etap z własną preregistracją po otrzymaniu
pliku? Bez tej decyzji nic dalej nie startuje.

## K. Handoff

```
STAGE: BUILDPLAN-ANALYZER-005R-EXTERIOR-OWNER-TRUTH-PACK
VERDICT: READY_FOR_OWNER_LOCAL_REVIEW (human labels NOT_RUN; accuracy NOT_MEASURED)
BRANCH: analyzer/exterior-owner-truth-review-pack-v1 (base 47bafa6; mirror untouched at bfaf286)
HEAD: the one commit carrying this report
FULL_REPORT: stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_EXTERIOR_OWNER_TRUTH_PACK.md
PACK: 60 questions (34 priority, 9 images) / 35 images / 35 lineage groups / 14 editions; B1 19/19 represented; OWNER m3ea isolated from G2E-5 m84f
ACCESS: no transfer of private pixels; 9/9 priority images referenced on current public pages (HEAD only, bytes unverified until local SHA-256)
TESTS: pack 8/8, core 12/12, browser smoke OK (0 external requests), isolation 71/71; full CI/e2e/APK NOT_RUN
FREEZE: IDENTICAL
NEXT_DECISION: OWNER runs the 34-question priority batch; evaluation only as a separate preregistered stage
FINAL_TOKEN: BUILDPLAN_ANALYZER_005R_EXTERIOR_OWNER_TRUTH_PACK_READY_FOR_OWNER_LOCAL_REVIEW
```
