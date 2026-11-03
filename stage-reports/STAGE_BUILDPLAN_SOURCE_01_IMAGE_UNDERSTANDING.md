# STAGE BUILDPLAN SOURCE-01 — rozpoznanie obrazów i znaczenia wymiarów przed budowaniem domu

Gałąź `claude/new-session-3kzcgh`. Baza `05eae370db184e01dc3b5146a5459c10b70931fe` (po F1C i APK 1312), czyste drzewo,
HEAD = origin. Prekonfiguracja zamrożona w `748d7cb` (podział domów, etykiety, PRZED) zanim powstał jakikolwiek
klasyfikator. Kod: `38ecc31`; APK z tego commita. Solver bez zmiany wersji (2.20.0; modele 8/8 identyczne), usługa
analizy **1.6.0** (nowe pole wyniku `sources`, nowa decyzja przed ekstraktorami).

## 1. Pierwsza błędna decyzja (jawne przypadki)

**Wnętrza trafiały do kamery zewnętrznej.** Role obrazu powstają wyłącznie z podpisu, nazwy pliku i kanału galerii
(`archonRoleClaims` → `mergeRoleClaims`); nic nie patrzy w piksele (to samo stwierdził audyt IU-01 i nic nie zostało
wdrożone). Wydawca publikuje „strefa dzienna (wizualizacja 1 widok 4)”, „wizualizacja kuchni”, „wizualizacja łazienki”
dokładnie jak widoki zewnętrzne, więc dostają `PERSPECTIVE_RENDER`. `reconstructV2` próbuje na każdej perspektywie
dopasować sylwetkę domu (`solvePerspectiveCamera`) i na wnętrzach mu się to **udaje**: w regresji F1C kamera
„rozwiązana” na wnętrzu — Rarytasy 5, Arganie 3, Goździkowce 1, Sasanki 1 (10 wnętrz). Taka kamera trafia do
`registrations.cameras`, do cechy `CAMERA`, do księgi jako `USED_AS_CORROBORATION` („depth order was checked
against it”) i do oceny jako „perspektywa sprawdzona częściowo”. Na 10 odłożonych domach TEST wszystkie **54/54
wnętrza** szły do kamery zewnętrznej.

**Wartość wyliczona opisana jako drukowana (`thin-body`).** Ślad z polecenia potwierdzony: w pętli „printed chains”
`adjudicateThinBody` brał każdy segment z `valueCm` i `evidenceId`, a segment `DERIVED` (arytmetyka łańcucha nad
pikselami) też ma oba pola — w regresji F1C to ~35 segmentów na dom. Taki segment mógł poszerzyć bryłę (`WIDENS`),
wywołać `SOURCE_CONFLICT` i był opisywany „prints N cm”. Wszystkie inne miejsca (`plan-resolution`, `layout`,
`plan-decomposition`) sprawdzały `origin`; ta pętla jedna nie. W 8 domach regresji żadna bryła nie jest cienka, więc
to wada utajona — **nie mamy dowodu, że dotyczy prywatnego benchmarku**.

## 2. Co zmieniono

| warstwa | zmiana |
|---|---|
| `source-analyzer/content.ts` | treść obrazu z pikseli: tensor 224×224 (cały obraz, uśrednianie powierzchniowe), głowa liniowa nad osadzeniem, 6 klas (rzut, elewacja, przekrój, plan sytuacyjny, widok zewnętrzny, **wnętrze**), projekcja (perspektywa / rysunek ortogonalny). **Weto**: gdy rola wysyła obraz do czytnika (rzut, fasada, przekrój, sytuacja, kamera zewnętrzna), a piksele są pewne, że to coś, czego ten czytnik czytać nie może (dozwolona treść ≤ 0,05 **i** inna klasa ≥ 0,90), obraz zostaje źródłem, nie dostaje ramki i jest pominięty z nazwanym powodem. Piksele **nigdy nie dodają** zastosowania ani nie przepisują ról wydawcy; niepewny odczyt nic nie zmienia i jest nazwany `UNCERTAIN`. Pakiet źródłowy i jego hash bez zmian. |
| `numeric-recogniser-ort` | koder MobileNetV4-conv-small (timm, Apache-2.0) na tym samym ONNX Runtime Web (wasm, 1 wątek), weryfikacja SHA-256 przed każdym wczytaniem, worker na partię (pamięć oddawana po partii), brak sieci; klient bez runtime’u w bundlu analizatora. **Żadna waga nie jest w Git**: `tools/fetch-image-role.mjs` pobiera `model.safetensors` z przypiętej rewizji HF, składa BatchNorm w konwolucje (float32, `Math.fround`), zapisuje ONNX z `models/image-role-spec.json` (sama struktura grafu) i odrzuca wynik o innym SHA-256 niż przypięty — tak jak model OCR. Gradle (`fetchImageRoleEncoder`) i CI wołają go obok `fetch-model.mjs`. |
| `reconstruction/thin-body.ts` | `printedSegment`: tylko `READ` / `CHAIN_CORRECTED` z `evidenceId` jest wymiarem drukowanym; `DERIVED` i segment bez pochodzenia dostają rolę `NOT_PRINTED` („the chain's derived value, not a number printed on the drawing”) i niczego nie potwierdzają, nie poszerzają, nie tworzą konfliktu. Pomiar szczeliny otworu też tylko drukowanym. |
| `analysis-service/sources.ts` | `result.sources` (tylko do odczytu, nie wchodzi do żadnego hasha): dla każdego obrazu — twierdzenie wydawcy (rola i podstawa), co pokazują piksele, wynik (`READ` / `REFUSED_BY_CONTENT` / `NOT_READ` / `NO_READER`), czytnik, strona elewacji i jej podstawa (`LABELLED` / `FIRST_READING` / `MOVED`), zdanie dlaczego; dla każdej liczby: rodzaj (wymiar całkowity, odcinek łańcucha, otwór, rzędna, kąt, powierzchnia), odczyt i wartość przyjęta, jednostka, **wydrukowana czy wyliczona** (`origin`), kadr napisu, linia z końcami, dyspozycja z księgi solvera i element modelu (`featureId`) z powodem. |
| web `SourceSheets.tsx`, Android `SourceSheets.kt` | w podstawowym podglądzie wyniku sekcja „Arkusze źródłowe”: prawdziwy arkusz (pobrany z adresu, z którego czytała analiza; na Androidzie przez jedyny transport aplikacji), przyczyna wyboru/odrzucenia, kadr i linia zaznaczone na arkuszu, wartość odczytana i przyjęta (np. „odczytane „+5.06”, przyjęte 3,06 m (poprawione względem łańcucha)”), zastosowanie lub odmowa, powiązany element. Bez animacji i bez drugiego modelu. |

## 3. Wybór rozwiązania (lokalne AI)

DEV, 5-krotna walidacja grupowana po rodzinach domów (`artifacts/analyzer-source-01/candidates-dev.json`):

| kandydat | licencja | błędy / 818 | wnętrze→zewn. |
|---|---|---|---|
| 24 ręczne cechy pikseli (bez wag) | własny kod | 29 | 11 |
| MobileNetV3-small | Apache-2.0 | 4 | 0 |
| **MobileNetV4-conv-small** | Apache-2.0 | 2 | 0 |
| MobileNetV3-large | Apache-2.0 | 1 | 0 |
| MobileCLIP2-S0 / MobileCLIP-S0 | `apple-amlr` (badawcza) | nie oceniano — licencja wyklucza aplikację bez decyzji OWNER-a | — |
| mały VLM | — | nie oceniano — klasyfikacja już rozdziela klasy; opis swobodny nie jest celem; koszt na telefonie nieproporcjonalny | — |

Wybrany MNv4-conv-small: 2,49 M parametrów, ONNX fp32 9,9 MB, tylko Conv/Relu/Add/GlobalAveragePool. Głowa
dopasowana na osadzeniach liczonych **ścieżką produkcyjną** (dekoder TS → tensor → ONNX Runtime Web): w CV na DEV
0 błędów przy każdym C; reguła wyboru C ustalona przed TEST (0 błędnych wet przy prawdziwym podpisie, potem najwięcej
wet podpisów fałszywych) → C = 1,0 (`head-cv-dev.json`). Koder przebudowany narzędziem fetch względem eksportu torch:
max |różnica osadzenia| 7,1·10⁻⁶, klasa identyczna 1088/1088, żadne prawdopodobieństwo nie przekracza progu weta.

## 4. Dowody: 10 domów TEST (odłożone po rodzinie przed strojeniem; jednorazowa ocena)

Pochodzenie etykiet: etykiety agenta po SHA-256 (IU-01/02/03) i 85 nowych z anonimowych arkuszy (indeks i rozmiar, bez
URL, podpisu, domu, roli produkcyjnej) zrobionych przed klasyfikatorem; ślepa kontrola 40 odziedziczonych: 40/40 zgodnych
(`research/analyzer-source-01/label-audit.json`). Etykiety nie są zweryfikowane przez OWNER-a.

Klasa z pikseli (270 zasobów, prawdziwe strony przez produkcyjny `acquireSourcePackage`): **0 błędów** —
rzuty 80/80, elewacje 40/40, przekroje 10/10, plany sytuacyjne 10/10, widoki zewnętrzne 76/76, wnętrza 54/54.

Kierowanie do czytnika (`routing-test-before-after.json`):

| | PRZED | PO |
|---|---|---|
| prawdziwe podpisy: poprawne użycie | 198 / 270 | **252 / 270** |
| błędnie dopuszczone | 54 (wszystkie wnętrza → kamera) | **0** |
| błędnie odrzucone | 18 | 18 (te same: widoki zewnętrzne bez podpisu, rola `UNKNOWN`; treść nie promuje) |
| pokrycie: rzut / fasada / przekrój / sytuacja | 80/80, 40/40, 10/10, 10/10 | bez zmian |
| pokrycie: kamera zewnętrzna | 58/76 | 58/76 |
| podpisy fałszywe (każdy obraz z każdym cudzym podpisem, 1134 przypadków): błędnie dopuszczone | 1134 | **20** |

20 pozostałych to 5 widoków zewnętrznych, których piksele są niepewne (0,55–0,87 < 0,90): weto nie działa, decyduje
podpis (`UNCERTAIN`) — świadomie, bo fałszywe weto kosztuje informację. Odmowa wszystkiego nie jest tu poprawą:
pokrycie rysunków jest takie samo jak przed.

## 5. Regresja ośmiu domów (produkcyjny `runAnalysis`, świeża ekstrakcja, ten sam kod z koderem i bez)

`artifacts/analyzer-source-01/regression-8-houses.json`. PRZED odtwarza modele F1C (np. Marcówki `28877080…`).

| dom | model / scena | ERROR zewn. | kamery rozwiązane (z tego wnętrza) | obrazy odrzucone po treści | błędne weta | niesprawdzone (ocena) |
|---|---|---|---|---|---|---|
| Jarzmianki | = / = | 1 → 1 | 1 → 1 (0) | 0 | 0 | 17 → 17 |
| Goździkowce | = / = | 0 → 0 | 3 → 2 (1 → 0) | 11 | 0 | 27 → 16 |
| Marcówki | = / = | 2 → 2 | 3 → 3 (0) | 0 | 0 | 14 → 14 |
| Cieszynianki | = / = | 0 → 0 | 1 → 1 (0) | 14 | 0 | 27 → 13 |
| Rarytasy | = / = | 0 → 0 | 11 → 6 (5 → 0) | 19 | 0 | 32 → 13 |
| Trytomy | = / = | 2 → 2 | 2 → 2 (0) | 3 | 0 | 20 → 17 |
| Arganie | = / = | 3 → 3 | 7 → 4 (3 → 0) | 7 | 0 | 27 → 20 |
| Sasanki | = / = | 0 → 0 | 3 → 2 (1 → 0) | 6 | 0 | 22 → 16 |

Wszystkie 8: replay `BYTE_IDENTICAL`, model i scena identyczne bajtowo. Poprawa etykiet **nie jest** poprawą domu:
wnętrza nie wpływały na geometrię, tylko na kamerę „sprawdzającą”, księgę i licznik niesprawdzonych źródeł — te są
teraz prawdziwe. F1C zachowane (żadna liczba z F1C się nie zmieniła). Odrzuconych 60 obrazów; każde odrzucenie zgodne
z etykietą (wnętrze albo nie-widok zewnętrzny pod rolą perspektywy).

Strona elewacji: bez zmian w tym etapie. Bocznej elewacji bez etykiety strona jest już przypisywana przez otwory
(005W-N1: szczeliny rzutu w obu ścianach bocznych, zamiana tylko przy wyraźnym odczycie), nie przez proporcje;
inspekcja pokazuje teraz stronę i jej podstawę (`LABELLED` / `FIRST_READING` / `MOVED`). Nie mierzono jej trafności na
etykietach stron (brak takich etykiet).

## 6. Wymiary: znaczenie i pochodzenie

`result.sources` rozróżnia wymiar całkowity, odcinek łańcucha, otwór, rzędną (wysokość), kąt i powierzchnię; każda liczba
ma kadr, linię z końcami, jednostkę, odczyt i wartość przyjętą, `origin` i dyspozycję z księgi z elementem modelu.
Wartość wyliczona nie ma tekstu odczytu i jest podpisana jako wyliczona. Przykład z Marcówek: rzędna wydrukowana
„+3,06” odczytana jako „+5.06” i przyjęta 3,06 m po korekcie łańcuchem — teraz widać obie wartości. **Grubości ściany
nie wyodrębniono** jako osobnego rodzaju (jest odcinkiem łańcucha); limit.

Testy przyczyny `thin-body` (`thin-body-n7-p2r.test.ts`): na starym kodzie 3 z 4 nowych testów czerwone (DERIVED
poszerza bryłę, DERIVED tworzy `SOURCE_CONFLICT`, segment bez pochodzenia traktowany jak drukowany), na nowym zielone;
kontrola z wartością drukowaną przechodzi w obu. Fikstury dwóch plików testów dostały jawne `origin: 'READ'` (tak jak
każdy wyceniony segment w prawdziwych danych).

## 7. Koszt (host — NIE urządzenie)

Kontener x86-64, 4 rdzenie dzielone z równoległymi biegami, Node 22. Koder w workerze na partię: wczytanie
0,38–0,71 s, osadzenie 20–37 obrazów 0,87–2,30 s (24–62 ms/obraz), RSS +~120 MB na czas partii, oddane po zakończeniu
workera; dekodowanie i tensor ~85–95 ms/obraz w JS. Szczyt RSS całego biegu +36…+122 MB (835→929, 913→982 MB). Czas
całego biegu w granicach szumu obciążenia (±25 %). Model 9,9 MB (build), głowa 106 KB. APK 39,96 → **49,35 MB**.
Na telefonie czas i pamięć **niezmierzone** (brak urządzenia/emulatora w sesji).

## 8. Testy i typecheck

`npx tsc -p tsconfig.json --noEmit` czysty; `apps/web` czysty. Uruchamiane partiami:

| zakres | wynik |
|---|---|
| `packages/source-analyzer`, `packages/numeric-recogniser-ort` (nowe: `content-source-01`, `image-role`) | zielone (95 → po przebudowie 147 w zestawie celowanym) |
| `packages/reconstruction` | 1235: po poprawie fikstury `thin-body-n7-fix01` zielone (2 testy wymagały `origin` w fiksturze) |
| `packages/analysis-service` + `tests/architecture` | 11 czerwonych = te same 11 co w F1C (compound-facade 1, reference 2, research-isolation 4, wall-strip 4); 7 nowych czerwonych spowodowanych tym etapem naprawiono (m.in. ORT w bundlu analizatora, `HttpURLConnection` poza transportem, waga w Git) |
| `apps/local-analyzer` + `apps/analyzer-api` | 6 czerwonych zastanych z F1C (snapshot, `/health`, worker ×2, Larchfield, NFD); 2 nowe naprawione |
| Android `testDebugUnitTest` | 441, 4 czerwone zastane (`AutoCandidateRenderingTest` ×2, `DownloadedScenesTest` ×2, katalog scen) |

## 9. APK

| pole | wartość |
|---|---|
| plik | `BuildPlan-owner-preview-1313.apk`, 49 353 507 B |
| SHA-256 | `455d684d54fe7bce15d223b4f76db055ae4a595123879f9b2473d6c5a077932f` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1313** / `0.1313.0-owner`, commit `38ecc31` |
| ABI / podpis | arm64-v8a; cert SHA-256 `6e48fac4…ca0da` (ten sam co 1312) |
| analizator w APK | 10/10 plików zgodnych z manifestem; `image-role-worker.mjs` i `models/image-role-mnv4s.onnx` (`237c6cef…`); solver 2.20.0, usługa 1.6.0; `analyzer.mjs` bez ONNX Runtime |
| smoke | zasoby z APK, `run-host` na żywej stronie domu TEST (Willa Maja): `done`, 38 obrazów, 14 wnętrz odrzuconych po treści, koder z bundla |

## 10. Dostawa prywatna i ograniczenia

`BuildPlan-SOURCE-01-Inspection-Private.zip` (poza Git): demonstracja inspekcji na prawdziwych arkuszach (Willa Maja
z biegu APK, Rarytasy PRZED/PO, Marcówki), modele PRZED/PO, liczby. Obrazy wydawcy tylko tam.

- Etykiety są agenta, nie OWNER-a. Zbiór to wyłącznie ARCHON; poza tym stylem (IU-01: syntetyki, Commons) głowa
  bywa pewna i błędna — dlatego tylko weto i dlatego progi. Ogólny adapter dostaje to samo weto.
- Prywatny benchmark nieużywany i nieznany; wynik testu OWNER-a nie jest tu deklarowany.
- Odrzucone wnętrze nie poprawia geometrii żadnego z 8 domów; poprawia uczciwość źródeł.
- Ewentualne poprawne zastosowanie widoków bez podpisu (18 na TEST) nie zostało dodane (brak promocji).
- 9,9 MB ONNX był chwilowo w historii gałęzi (`81355c0`–`cc75b5f`), usunięty z drzewa w `38ecc31`; historii nie
  przepisywano.
- Grubość ściany nie jest osobnym rodzajem wymiaru; strona elewacji nie była mierzona na etykietach.
- Telefon/emulator: brak — APK zbudowany i sprawdzony statycznie oraz smoke testem zasobów na hoście.

Następny krok: zmierzyć koder na telefonie OWNER-a (czas partii, RSS) i dodać etykiety stron elewacji, żeby ocenić
przypisanie lewa/prawa na tej samej zasadzie podziału po domach.
