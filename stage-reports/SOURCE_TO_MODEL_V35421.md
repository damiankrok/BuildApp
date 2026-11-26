# BuildPlan v3.54.21 — oryginały jako wzorzec, jeden układ dachów, weryfikacja na planszach (po APK 1353)

Etap: 2026-11-25. Gałąź `claude/new-session-3kzcgh`, commity z `[skip ci]`, bez PR i bez scalenia. Baseline: kod
v3.54.20 `108611e` (APK 1353). Kod zamrożony przed świeżą próbą: `4c1d1a2`. Kod ostateczny po poprawkach usterek,
które próba znalazła: `5d5ea2c`; poprawka usterki znalezionej na hoście: `174e093` (ścieżka odmowy księgi). APK: **1354**. Protokół zapisany przed zamrożeniem kodu i losowaniem próby NEW-H (pierwszy wpis
po pierwszym biegu DEV, który sam wymienia w §8), uzupełniany przed kolejnymi krokami; §10 dopisany po poprawkach po
próbie i pierwszej sesji hosta, przed drugą: `research/source-to-model/v35421/PROTOCOL.md`. Decyzje: `docs/ADR-V35421-ROOF-SYSTEM-AND-ORIGINALS.md`.
Krótko dla OWNER-a: `stage-reports/README_V35421.md`. Hand-off: `research/source-to-model/v35421/HANDOFF.md`.

Renderów z komputera nie nazywam zrzutami z telefonu. W tej sesji nie było telefonu ani emulatora: APK jest zbudowany
i podpisany, **na urządzeniu niesprawdzony** (`ANDROID_UI_NOT_VERIFIED`).

## Werdykt

1. **Dachy są jednym układem.** Wspólny solver liczy kosze z przecięcia połaci, zostawia dojście niższego dachu do
   ściany i nie skleja dachów, które źródło pokazuje osobno. Buduje dachy bryły z odczytu API (i rozwiązuje układ
   ponownie po każdej poprawce dachu); emisja LOCAL-a jest bez zmian — dla niej solver jest na razie tylko biblioteką,
   równoważną z jej funkcjami tam, gdzie te przyjmują. Na kontrpróbach audytu: Amber IV, Mindelo i Amarylis mają kosze
   zamiast przenikających się dachów (2, 4 i 4 kosze; szczyt poprzeczny bez uskoku rzutu — Mindelo; szczyt frontowy
   Amarylis powstał z wiązania opisu po własnych widokach bryły, a jej drugi szczyt poprzeczny nie powstał), Eliza nie ma już elementu 72° (maks. 22°), Ametyst nie jest już obrócony, Skagen
   zachował dojście do ściany bez kosza. Aletta nadal ma za płaski dach garażu.
2. **Na świeżej próbie (5 nieoglądanych domów, 4 wydawców, losowane po zamrożeniu) kod zamrożony był bliżej oryginałów
   w 2 domach, baseline w 1, dwa remisy; ani razu „wyraźnie gorzej".** Debora dostała układ T z dwoma koszami
   (3 z 3 oceniających: dach TAK; baseline: dwa osobne dachy), Dom pod morwą — dwa kominy jak w źródle zamiast czterech.
   Baseline wygrał w Domu pod osiką: świeży odczyt postawił elewację boczną po złej stronie i przebudował okna. W dwóch
   domach (Anna II, Lyon) oba ramiona dały ten sam model — i oba były złe (płaskie pudła, otwarte pudło bez dachu).
3. **Pierwsze wyniki próby są zachowane i ocenione ślepo.** Dopiero potem poprawiłem cztery usterki kodu, które próba
   znalazła (boki dwóch elewacji o identycznym podpisie, zmierzona brama garażowa usuwana za kolor, brak dachu płaskiego
   bryły głównej, czytnik specyfikacji). Anna II, Debora i Lyon są od tej chwili **DEV** i tak są podpisane. Po
   poprawkach: Anna II ma bryłę ze źródeł z 4 koszami, Lyon dach płaski, Debora bramę garażową (także w świeżym biegu
   na żywo przez host).
4. **Jest strata, której nie naprawiłem: Anna II po poprawce straciła wnętrze i okna LOCAL-a** — ściany wewnętrzne
   26 → 17, otwory elewacji 39 → 9 (okna 28 → 7; drzwi wewnętrzne 6 → 8). Bryła ze źródeł nie przenosi ścian ani
   otworów LOCAL-a. Lepsze są dach i bryła (10 połaci, 4 kosze wobec płaskich pudeł), uboższe elewacje i wnętrze.
   Nazwane i niepoprawione są też: brak portyków Osiki, attyka Lyonu (płyta na głowicy ściany 5,6 m zamiast 6,56 m),
   szczyt garażu Anny II z kalenicą w złą stronę, pylon wejścia Morwy liczony w szerokość widoku szczytowego.
5. **Host na ostatecznej rewizji przechodzi wszystkie kontrole** (sesja 2, `1a00654`): świeży bieg na żywo Anny II,
   powtórka zaakceptowanej Debory bez żadnego żądania i z tymi samymi bajtami, bieg bez tokenu bez żądań. Świeży bieg
   Debory, który ta powtórka odtwarza, był w sesji 1 na `5d5ea2c` (kod analizy różni się tylko ścieżką odmowy księgi). Po drodze host znalazł
   usterkę: odmowa księgi na pułapie kończyła całe zadanie błędem wewnętrznym (Anna II w pierwszej sesji) — poprawiona
   z testem i sprawdzona na hoście z księgą już na pułapie (zadanie kończy się bez żądań).
6. **Aplikacja: z 16 zmierzonych czerwonych testów vitest zostało 5, a wszystkie porażki kodu są naprawione u przyczyny**
   (13 z dziedziczonej listy 18 i 5 porażek JVM Androida); web e2e 49/49, typecheck czysty, Android 476 zielonych
   i 3 pominięte (479), sceny 135/135. Pięć czerwonych w pełnej macierzy (4766 zielonych): 3 środowiskowe (Python bez numpy;
   z systemowym 85/85) i 2 testy `WorkerExecutor`, które przekraczają limit czasu tylko w pełnej równoległej macierzy
   (osobno i w swoim pakiecie zielone). Nie ogłaszam pełnej zieleni.
7. To nadal **mała próba**: pięć domów nie jest podstawą do procentu skuteczności. Odczyt z oryginałów nie jest
   jednostronnie lepszy od odczytu wspomaganego szkicem (§3, §6).

## 1. Co się zmieniło — w jednym akapicie

Dachy przestały być budowane każdy z osobna nad swoim prostokątem. Dom ma teraz **jeden układ dachów**: każdy dach jest
obszarem z własną tożsamością i własnymi liczbami, a wspólny solver rozstrzyga, jak obszary się spotykają — liczy kosz
tam, gdzie kalenica skrzydła wchodzi w połać dachu wyższego, zostawia dojście do ściany tam, gdzie niższy dach tylko do
niej dochodzi, i niczego nie łączy tam, gdzie źródło pokazuje dachy osobno. Solver buduje dachy bryły zbudowanej z odczytu API i rozwiązuje układ ponownie po każdej
poprawce dachu; dla LOCAL jest na razie biblioteką (test równoważności z jego funkcjami), a emisja LOCAL-a się nie zmieniła. Opis struktury jest czytany z **oryginalnych** elewacji, rzutu, przekroju
i perspektyw wydawcy (nie ze szkiców i nie dopiero po dwóch udanych szkicach), ma osobne dachy z własnymi parametrami
i relacjami, a każda odczytana własność ma zapisany los. Po budowie model jest mierzony z powrotem liczba po liczbie
i relacja po relacji, a raport pominięć podaje dla każdej cechy źródła, w którym kroku i dlaczego jej nie ma.

## 2. Ustalenia audytu — wynik każdego

| # | Ustalenie audytu v3.54.20 | Sprawdzenie na repo (baseline `108611e`) | Co zrobiono | Wynik |
|---|---|---|---|---|
| 2 | Osobne dachy nad prostokątami zamiast jednego układu | Potwierdzone: `bodyCommands` wydawało `createRoof` na bryłę; dwa dachy przenikały się bez kosza | `solveRoofSystem` (obszary, relacje, kosze z przecięcia połaci), `roofSystemCommands` (połacie, krawędzie, ściany pod połaciami, jeden zespół `ROOF`) | NAPRAWIONE w zadeklarowanym zakresie (PROTOCOL §2); poza zakresem nazwane |
| 3.1 | Eliza: 72° powstaje po wcześniejszym sprawdzeniu stromizny | Potwierdzone: `roofByStructure` obracało oś, zachowując wysokości czytane w poprzek długiego boku | `settleRoof` — kąt, okap i kalenica uzgadniane ponownie po OSTATNIEJ zmianie; kąt poza 8–62° jest naruszeniem z wejściami, nigdy przycięciem | NAPRAWIONE (przyczyna usunięta; test „72°"); podział brył Elizy z rzutu piętra — poza zakresem, nazwany |
| 3.2 | Amarylis: poprawny opis poprzecznego szczytu nie ma wykonawcy | Potwierdzone: opis dachu głównego trafiał do największego prostokąta wbrew jego czterem widokom; szczyt bez uskoku rzutu nie miał konsumenta | wiązanie opisu po własnych widokach bryły; szczyt poprzeczny jako drugi obszar dachu na tych samych ścianach; „opis w całości albo wcale"; arbitraż i readback trzymają opis przy bryle, do której go związano | CZĘŚCIOWO: mechanizm szczytu poprzecznego bez uskoku działa (Mindelo, Anna II po próbie); w Amarylis szczyt frontowy powstał z wiązania opisu po widokach bryły, drugi szczyt poprzeczny (R3) utracony w wiązaniu (§5) |
| 3.3 | Amber: istniejący solver LOCAL potrafi więcej niż ścieżka API | Potwierdzone: `attachedGableLayout` / `valleyCutMainRoof` nie były osiągalne z bryły z odczytu | wspólny solver w `@buildapp/reconstruction`; test równoważności z funkcjami LOCAL tam, gdzie tamte przyjmują | NAPRAWIONE |
| 3.4 | Mindelo: kosz zaczyna się 0,16 m nad okapem — przycinacz odmawia; Skagen: dojście do ściany, nie kosz | Potwierdzone oba | solver liczy kosz także przy okapach skrzydła wyżej / niżej (nazwana korekta ≤ 0,25 m albo policzek); `ABUTMENT` / `IN_LINE` / `SEPARATE` nie są łączone | NAPRAWIONE; Skagen bez zmiany modelu (kontrpróba) |
| 4.1 | Brak tożsamości i położenia poszczególnych dachów w opisie | Potwierdzone (`form-read/2` miał jeden dach główny i „części") | `form-read/3`: `roofs` R1… (MAIN / PART / CROSS), własny kąt / okap / kalenica ze statusem, gdzie widziany, udziały, z czym się styka i jak | NAPRAWIONE |
| 4.2 | Nie wszystkie przyjęte liczby są używane lub sprawdzane | Potwierdzone (sonda 1° / 100 m / 200 m przechodziła) | los każdej własności (`APPLIED / RETAINED_WITH_CONFLICT / REJECTED / UNUSED_UNSUPPORTED / UNRESOLVED`), readback 1.1.0 każdej liczby i relacji | NAPRAWIONE (test sondy) |
| 4.3 | Błąd współrzędnych w odczycie zwrotnym (początek ściany w obrysie L) | Potwierdzone | ręka początku ściany liczona po własnym pierścieniu ściany | NAPRAWIONE (test obrysu L) |
| 5 | „Forma 4/4" i „220 otworów bez różnic" nie mówią o wyglądzie | Zasadne | kryteria A / B / C rozliczane osobno; mapa cech przed oceną; otwarta cecha KEY wyklucza pełny odbiór; ocena ślepa na planszach | ZMIENIONE KRYTERIA (PROTOCOL §3) |
| API | Odczyt struktury zależał od ≥ 2 szkiców; oglądał elewacje „po szkicu"; perspektywy nie były wysyłane | Potwierdzone | dobór oryginałów z pakietu (jedna elewacja na stronę, przekrój, rzut, do 3 perspektyw), zapis obrazów wysłanych i pominiętych z przyczyną, paczka wysłanych PNG | NAPRAWIONE; dodatkowo znaleziono i usunięto dwa ubytki w wysyłanych obrazach (§3) |

## 3. Obrazy, które naprawdę dostaje API

Sprawdzone na bajtach wysłanych żądań (dziennik wymian transportu, plik obrazu nazwany jego SHA-256), nie na treści
promptu. Każdy bieg zapisuje pakiet odczytu struktury (`structure-read/`: PNG-i w kolejności, `request.json`
z rozdzielczościami i podpisami, `answer-raw.json`, `agreed.json`). W biegu na żywo to dokładnie wysłane bajty;
w biegu odtworzonym z nagrania (F@B/2, odtworzenia audytu) to obrazy, które **ten kod wybrałby** — nagrana odpowiedź
widziała obrazy swojego żądania (zapis `STRUCTURE_READ` mówi to wprost). Żądanie kupione leży przy biegu, w którym je
kupiono: F@B i po próbie — paczka biegu F@B; F@B/2 — dziennik wymian biegu B; odtworzenia audytu — `request-bought.json`. Ślad pominięć każdego domu ma wykaz obrazów **każdego etapu** (odczyt struktury, szkice
elewacji, odczyt metryczny, recenzja): rola, oryginał czy pochodna, wynik albo przyczyna pominięcia; piksele źródła
i wysłane oraz skalę zapisuje odczyt struktury, rozmiary — szkice i recenzja, odczyt metryczny pikseli nie zapisuje
(`houses/<dom>/omissions.md` §1).

| Etap | Przed (baseline `108611e`) | Po |
|---|---|---|
| Odczyt struktury | ruszał dopiero po ≥ 2 udanych szkicach; obrazy wybierane przez listę udanych szkiców; bez perspektyw | `form-read/3`: dobór oryginałów z pakietu niezależnie od szkiców — jedna elewacja na stronę (duplikaty i warianty lustrzane odrzucone z przyczyną), rzut parteru, przekrój, do 3 największych, różniących się perspektyw **oznaczonych jako perspektywa, nie w skali** (różne narożniki dobiera recenzja); brak czterech elewacji nazwany |
| Rozdzielczość | zmniejszanie przez decymację (co n-ty piksel) | przeskalowanie po polu (każdy piksel źródła waży) do 1400 px dłuższego boku; mniejsze obrazy w rozdzielczości własnej |
| Recenzja | oryginały bez perspektyw | oryginały + perspektywy + 4 widoki modelu w jednej skali + dach z góry + ukośne + wnętrze bez dachu; mapa cech z oryginałów **przed** modelem |

Inwentarz znalazł dwa ubytki, których treść promptu nie pokazywała, oba usunięte z zapisaną przyczyną:
**zastępczy obrazek 32 × 32 px (ikona ładowania strony)** wysyłany jako „przekrój" do odczytu metrycznego i recenzji
oraz **miniatura elewacji** (podgląd strony zamiast rysunku) wśród obrazów recenzji (`667382c`, `47d8242`). Miniatura
strony nie jest już nigdzie traktowana jak elewacja.

Szkice (kolorowe PNG/SVG + JSON) **nie są bramką**: odczyt struktury rusza bez nich. Nadal są generowane, oddawane
obok oryginałów i oznaczone, czym są (wejście odczytu elewacji, pomoc, wizualizacja opisu). Mały pomiar ich wpływu na
tych samych bajtach (NEW-H, §6): ramię **F@B/2** to kod zamrożony z dawnym odczytem `form-read/2` (zależnym od
szkiców), ramię **F@B** — ten sam kod ze świeżym odczytem `form-read/3` z oryginałów i perspektyw. Debora dostaje układ T
z koszami w obu ramionach (to zasługa kodu, nie odczytu); w Morwie dwa zmyślone kominy usunęła recenzja na żywo
(oba odczyty struktury podają 2 kominy, a etap szkiców w obu ramionach buduje 4 — Morwa nie świadczy o wpływie odczytu);
w Osice ten sam odczyt postawił niepodpisaną elewację boczną po złej stronie (błąd odczytu, §6). Wniosek: odczyt
z oryginałów nie jest jednostronnie lepszy; szkic jako bramka nic nie dawał, a jako pomoc bywa przydatny, więc
zostaje opcjonalny.

## 4. Wybrana architektura — krótko

Pełne uzasadnienie: `docs/ADR-V35421-ROOF-SYSTEM-AND-ORIGINALS.md`.

1. **Jeden układ dachów** (`@buildapp/reconstruction` `v2/roof-system.ts`). Dach to obszar z tożsamością (id, bryła-host,
   prostokąt, rodzaj, oś, okap, kalenica / kąt, proweniencja każdej własności), a nie atrybut prostokąta ścian. Wspólny
   solver rozwiązuje wszystkie obszary razem — górna obwiednia połaci, kosz z przecięcia płaszczyzn (także przy okapie
   skrzydła wyżej / niżej), dojście do ściany bez kosza, dachy w linii i osobne nietknięte — i oddaje połacie,
   krawędzie (`VALLEY / RIDGE / HIP / ABUTMENT`) i ściany pod połaciami. Solver buduje dachy bryły z odczytu API
   i rozwiązuje układ ponownie po każdej poprawce dachu. Emisja LOCAL-a jest bez zmian: dla niej solver jest na razie
   biblioteką, a test sprawdza jego równoważność z dotychczasowymi `attachedGableLayout` / `valleyCutMainRoof` tam, gdzie
   tamte przyjmują (przeniesienie LOCAL-a na solver to osobny, późniejszy krok). Przed wydaniem poleceń układ jest pytany w jądrze geometrii; odmowa = dachy budowane osobno
   z nazwanym `BUILD_ERROR`, nigdy cicho.
2. **Kąt, okap i kalenica uzgadniane po ostatniej zmianie** (`settleRoof`): obrót osi, zmiana rodzaju, rozpiętości
   albo wysokości wymusza ponowne uzgodnienie; kąt poza 8–62° jest naruszeniem z wejściami, nie przycięciem.
3. **Kontrakt `form-read/3`**: osobne dachy R1… (`MAIN / PART / CROSS`) z własnym kątem, okapem, kalenicą, statusem
   liczby (wydrukowana / wyliczona / oszacowana / nieznana), miejscem, gdzie dach widać, i relacją z innym dachem
   lub ścianą. Wiązanie opisu do bryły po jej własnych widokach (nie do największego prostokąta). Szczyt poprzeczny
   bez uskoku rzutu = drugi obszar dachu na tych samych ścianach. „Opis w całości albo wcale": dach główny nie jest
   obracany, jeżeli wymagany szczyt poprzeczny nie powstał.
4. **Los każdej własności** (`APPLIED / RETAINED_WITH_CONFLICT / REJECTED / UNUSED_UNSUPPORTED / UNRESOLVED`)
   i **readback 1.1.x** — każda związana liczba i relacja zmierzona z powrotem na oddanym modelu.
5. **Pętla recenzji** ogląda oddaną rewizję: oryginały + perspektywy + widoki modelu; poprawka jednego dachu układu
   rozwiązuje cały układ ponownie; elementy z rzutu i otwory zmierzone przez bramkę źródłową nie znikają na samo słowo
   recenzji (`SHOULD_NOT_EXIST` / `WRONG_KIND`; okno połaciowe tylko wobec `SHOULD_NOT_EXIST`), werdykt zostaje otwarty —
   inne elementy zmierzone przez bramkę, np. kominy, recenzja nadal może usunąć (Amarylis: 2 z 4); otwarta cecha KEY wyklucza pełny odbiór.
6. **Ślad pominięć** z zapisów biegu: cecha → dowód w oryginale → odczyt API → uzgodnienie i host → operacja → element
   → pomiar / recenzja → wynik i przyczyna (`NOT_ASKED`, `DISPUTED_BY_WITNESS`, `CONFLICT_WITH_DRAWING`,
   `NO_CONSUMER`, `BUILD_ERROR`, …).

## 5. Kontrpróby audytu na kodzie ostatecznym (DEV)

Te same bajty źródeł i nagrane odczyty co APK 1353; odczyt struktury `form-read/3` kupiony raz w etapie i odtwarzany.
„Przed" = model oddany w v3.54.20, „po" = kod ostateczny `5d5ea2c`.

| Dom | Przed (1353) | Po (`5d5ea2c`) | Co wykazuje |
|---|---|---|---|
| Amber IV | dwa dachy dwuspadowe 30° / 33° przenikające się | układ 6 połaci, **2 kosze**, 2 dojścia; wnętrze 12 ścian, otwory 10 + 7 bez zmian | kosz z przecięcia zamiast przenikania |
| Mindelo | dwa dachy 27° / 37°, kosz odmówiony (zaczynał się 0,16 m nad okapem) | układ 8 połaci, **4 kosze**, bryła ze źródeł; wnętrze 15 bez zmian, otwory zewn. 13 → 14 | kosz przy okapie skrzydła wyżej niż okap główny, bez luzowania progu |
| Skagen | dach garażu dochodzi do ściany | **bez zmiany modelu** (dojście, bez kosza) | kontrpróba: kosz nie jest wymuszany |
| Willa Eliza | 12 połaci, **72°** (element nieistniejący w źródle) | 12 połaci, maks. **22°**; otwory zewn. 11 → 15 | przyczyna 72° usunięta (uzgodnienie po obrocie osi) |
| Amarylis | trzy osobne dachy, utracony szczyt frontowy | układ 10 połaci, **4 kosze**, 4 dojścia; szczyt frontowy wrócił: opis związany z bryłą, której własne elewacje rysują tę kalenicę (bryła środkowa, wysunięta); otwory zewn. 10 → 12 | wiązanie opisu po widokach bryły; **drugi szczyt poprzeczny (R3) niezbudowany** — utrata w wiązaniu, 2 otwarte cechy KEY |
| Ametyst New | **bryła obrócona**: front 12,93 m, kalenica wzdłuż krótszego boku, 35° | front 9,67 m, kalenica wzdłuż boku 12,93 m (źródło 12,95 m) jak w źródle, 34°; wnętrze 12 ścian, otwory 9 + 6 | hipoteza wymagająca dwóch skal jednego kompletu elewacji obalona (jedna skala, `5d06c28`); liczby wiązane do właściwego dachu |
| Aletta | dach garażu 20,6° | bez zmiany geometrii | **niepoprawione**: dach garażu nadal zbyt płaski |

Pozostałe straty tych domów są w podpisach scen i w śladzie pominięć (np. Eliza: podział brył z rzutu piętra poza
zakresem, jedno okno lewej elewacji odrzucone przez jądro geometrii — trafiło w strefę złącza ścian; Amarylis: 2 z 4
kominów usunięte przez recenzję na żywo mimo pomiaru bramką). Szczyt poprzeczny **bez** uskoku rzutu jako drugi
obszar dachu na ścianach tej samej bryły pokazują Mindelo (szczyt tylny) i Anna II po próbie (szczyt lewy).

## 6. Świeża próba NEW-H — co przeniosło się na domy, których kod nie widział

**Dobór (PROTOKÓŁ §5, §9–§9c), po zamrożeniu kodu `4c1d1a2`:** to samo narzędzie i pule co dotąd, ziarno `V35421-NEWH`.
Pierwsze dwa losowania przyjęły rodziny już widziane (Amber XII i XIV, Ametyst, DunkanII) — trzy usterki reguły rodzin
w narzędziu, poprawione **przed jakąkolwiek analizą** (liczby rzymskie > X, oznaczenia wydania, porównanie listy
widzianych tą samą normalizacją) i zapisane (§9a, oba wcześniejsze wyniki zachowane). Osiem przyjętych pakietów
opisano z samych obrazów wydawcy, zanim powstał jakikolwiek model (`references/NEWH-REFERENCES.md`; drugi, niezależny
czytelnik układu dachu — zgodność warstw 7 z 8). Próba: **Anna II** (Studio Atrium; dachy krzyżujące), **Lyon**
(Lipińscy; płaski za attyką + niższe dachy przy ścianie), **Debora** (Dobre Domy; T z koszami), **Dom pod morwą v2**
(ARCHON; dwuspadowy + niższe przy ścianie), **Dom pod osiką** (ARCHON; czterospadowy + portyki — piąty dom dopuszczony
przez §5, bo w czterech nie było warstwy HIP, a budżet po informacji OWNER-a na to pozwolił).

**Ramiona:** B = baseline `108611e` na żywo (pierwszy wynik zachowany); F@B = kod zamrożony na nagraniach B, na żywo
tylko świeży odczyt struktury `form-read/3` (oryginały + perspektywy) i recenzja nowej rewizji; F@B/2 = kod zamrożony na
nagraniach B ze starym odczytem `form-read/2` (0 USD) — rozdziela wpływ kodu od wpływu odczytu.

### Ocena ślepa (3 oceniających na dom, X/Y losowane osobno dla każdego domu, klucz poza paczką)

| Dom | Bliżej oryginałów | Dach B → F@B | Bryła | Wnętrze | Wyraźnie gorszy |
|---|---|---|---|---|---|
| Debora | **F@B 3/3** | CZĘŚCIOWO, CZĘŚCIOWO, NIE → **TAK, TAK, TAK** | CZĘŚCIOWO = | TAK = | B (2 z 3) |
| Dom pod morwą v2 | **F@B 3/3** | CZĘŚCIOWO = | TAK = | TAK = | żaden |
| Anna II | remis 3/3 (modele identyczne) | NIE = NIE | NIE = NIE | NIE / CZĘŚCIOWO = | żaden |
| Lyon | remis 3/3 (modele identyczne) | NIE = NIE | CZĘŚCIOWO = | TAK = | żaden |
| Dom pod osiką | **B 3/3** | CZĘŚCIOWO = | CZĘŚCIOWO = | TAK = | żaden |

Oczekiwania zapisane z góry (§6): (b) dom KRZYŻUJĄCE z koszem zbudowanym i potwierdzonym odczytem zwrotnym, którego w B
nie ma — **spełnione w Deborze** (układ dachów: 2 obszary, 2 kosze, readback 11/14), **niespełnione w Annie II**;
(c) dom NIŻSZY_PRZY_ŚCIANIE bez kosza — **spełnione tylko formalnie**: w Lyonie i Morwie żaden niższy dach przy ścianie
nie powstał (Lyon w F@B nie ma dachu w ogóle, Morwa ma jeden dach dwuspadowy bez daszku i pergoli), więc próba nie
pokazuje, że solver zostawia dojście bez kosza na nowym domu — pokazuje to tylko kontrpróba DEV (Skagen); (d) F@B bliżej w większej liczbie domów niż B,
bez domu „wyraźnie gorzej" — **spełnione** (2 : 1, dwa remisy; F@B ani razu „wyraźnie gorszy"); (a) żadnej utraty bez
nazwanej przyczyny — **dwie utraty, obie z przyczyną** (niżej).

### Przyczyna każdego wyniku (Anna II, Debora, Morwa, Lyon: diagnoza + niezależna próba obalenia, `newh/diagnoses.json`; Osika: z zapisów biegów, bez osobnej diagnozy)

| Dom | Wynik w F@B | Przyczyna | Rodzaj | Co zrobiono |
|---|---|---|---|---|
| Debora | układ T z dwoma koszami (B: dwa osobne dachy) | wspólny solver układu dachów — działa także na F@B/2, więc to kod, nie odczyt | — | — |
| Debora | **utracona brama garażowa** | recenzja na żywo dała bramie zmierzonej przez bramkę źródłową werdykt WRONG_KIND za **kolor** („ciemna, w źródle drewno"); WRONG_KIND usuwał otwór | błąd kodu (reguła recenzji) | po próbie: otwór zmierzony przez bramkę trzymany także przeciw WRONG_KIND |
| Morwa | 2 kominy (B: 4) | F@B ma rację: źródło ma dwa; B dostawił te same dwa kominy widziane ponownie na elewacji szczytowej z wymyśloną głębokością; usunęła je recenzja | — (B błędny) | nazwane: widoki szczytowe liczą pylon wejścia w szerokość (skala ok. 9 % za mała) |
| Anna II | bryła ze źródeł zbudowana i **wycofana** (błąd złącza), LOCAL zostaje | dwie elewacje boczne z identycznym podpisem trafiły do bryły odwrotnie — słaba etykieta WEST/EAST z LOCAL potraktowana jak podpis; szczyt garażu zbudowany jako szczyt poprzeczny po drugiej stronie, róg 0,21 m przy ścianie, którego kompilator nie domknął | błąd kodu (boki) + wtórny błąd kompilatora | po próbie: słaba etykieta = hipoteza, boki z odczytu; kompilator — nazwany |
| Lyon | **otwarte pudło bez dachu** w obu ramionach | LOCAL nie miał ścieżki do dachu płaskiego bryły **głównej** (płyta istniała tylko dla dobudówek); kąt 1,15° ze strony wyrzucany jako „nie kąt"; „z płaskim dachem" nierozpoznane | błąd kodu | po próbie: bryła główna bez dachu spadzistego dostaje płytę; spadek < 3° = dach płaski |
| Osika | **zmieniony zestaw okien** prawej elewacji | świeży odczyt `form-read/3` umieścił niepodpisaną elewację boczną po PRAWEJ (stary odczyt: po LEWEJ, zgodnie z rzutem); jedyny świadek boku, więc kanał szkiców przebudował dwa okna prawej ściany do szerokości okien lewej (0,90/0,95 → 1,75 m) | błąd odczytu API przyjęty bez kontroli rzutem | otwarte, nazwane: bok z odczytu nie jest sprawdzany oknami, które rzut rysuje na każdej ścianie |
| Osika | portyki (dwa szczyty z koszami) brak w obu ramionach | LOCAL buduje czterospadowy z połaci; bryła ze źródeł sprzeczna raz, więc LOCAL zostaje; szczytów poprzecznych nad LOCAL-em nikt nie dodaje | brak konsumenta | otwarte |

## 7. Po próbie: poprawki usterek, które próba znalazła (od tej chwili te domy są DEV)

Pierwsze wyniki NEW-H są zachowane i ocenione ślepo powyżej. Dopiero po ocenie i po diagnozie każdego wyniku poprawiono
cztery usterki kodu, każdą ogólną regułą (bez warunku po domu), z testem; domy, na których je znaleziono, przestają
być próbą i są oddawane jako DEV z oznaczeniem.

| Usterka (dom, na którym znaleziona) | Przyczyna | Poprawka | Test / dowód |
|---|---|---|---|
| bryła ze źródeł zbudowana odwrotnie i wycofana (Anna II) | słaba etykieta WEST/EAST z LOCAL dla dwóch elewacji o identycznym podpisie traktowana jak podpis | taka etykieta to hipoteza; boki daje odczyt `form-read/3` (oryginały + perspektywy), gdy rozstawia wszystkie takie obrazy na osobne boki; potem ten sam bok dla otworów, kominów, wykończeń i dachów | Anna II (0 USD z nagrań F@B): bryła ze źródeł zastępuje LOCAL, 4 obszary dachu, 4 kosze, 0 błędów złączy, readback 25/26 |
| zmierzona brama garażowa usunięta za kolor (Debora) | WRONG_KIND usuwał otwór zmierzony przez bramkę źródłową | otwór zmierzony przez bramkę trzymany przeciw WRONG_KIND (spór zostaje otwarty); okno połaciowe — tylko przeciw SHOULD_NOT_EXIST | test `feature-map-v35421`; Debora: brama zostaje |
| otwarte pudło bez dachu (Lyon) | LOCAL nie miał ścieżki do dachu płaskiego bryły głównej; spadek 1,15° wyrzucany | bryła główna bez dowodu dachu spadzistego dostaje płytę (przekrój, gdy czyta płytę i attykę; inaczej głowica ściany, `ASSUMED_FOR_RENDERING`); spadek < 3° z linii dachu = dach płaski | test `main-flat-roof-v35421` (płyta, zamknięcie, attyka, czytnik); Lyon: `roof-main FLAT` |
| — | czytnik specyfikacji czytał tylko polskie formy podstawowe | „płaskim dachem", „dach płaski" na linii samego dachu | jw. |

**Regresja DEV (24 nagrane domy, 0 USD):** pierwsza wersja poprawek zmieniła pięć domów. Każda zmiana rozłożona do
przyczyny, dwie reguły zawężone, jedna moja usterka poprawiona (słaba etykieta, która zostaje w mocy, nadal trzyma swój
bok), aż zostało: **22 domy bajt w bajt jak kod zamrożony, 2 zmienione zgodnie z zamiarem** (Eliza, Jarzębina: po
jednym zmierzonym otworze zatrzymanym wbrew WRONG_KIND). Po niezależnej recenzji poprawek wszystkie 24 domy odtworzone jeszcze raz na kodzie ostatecznym
`5d5ea2c` (0 USD): **ten sam wynik — 22 bajt w bajt, Eliza i Jarzębina po +1 otworze**; Jarzębina jest oddawana z modelu
kodu ostatecznego (scena i plansza podpisane „jeden otwór więcej wobec 1353"). 18 z 24 domów DEV (w tym kontrpróby Skagen i Aletta) ma oddany model bajt w bajt
taki jak w APK 1353 — układ dachów zmienia tylko domy, w których dachy się spotykają. Mindelo z nagranym starym odczytem `form-read/2` dostało boki
odwrotnie (błąd tamtego odczytu znany z audytu) — dlatego słaba etykieta ustępuje wyłącznie odczytowi `form-read/3`;
z kupionym odczytem `form-read/3` Mindelo jest takie jak na kodzie zamrożonym.

**Niezależna recenzja poprawek (z drugim czytelnikiem każdego ustalenia):** 15 ustaleń potwierdzonych; poprawione:
boki słabych etykiet przenoszone do jednej mapy boków (bez lustrzanego przypisania otworów), linia dachu w czytniku
zakotwiczona (nie dach garażu, nie pokrycie, nie okna dachowe; płaska DACHÓWKA to nie płaski dach; kąt po spadku na tej
samej linii nie znika), płyta tylko bez dowodu dachu spadzistego i decydowana przed kominami i pasami elewacji, ściany
wnęki pod płytą. Czytnik po poprawkach różni się od zamrożonego na 31 nagranych pakietach wyłącznie na Lyonie.
Nazwane, niepoprawione: decyzja boków przy rejestracji nadal przyjmuje bok z `form-read/2` dla słabych etykiet (jak przed
etapem); odczyt dostaje etykietę LOCAL jako „podpis" niepodpisanej elewacji; utrzymany element bez identyfikatora wady
nie zostawia otwartego wpisu w rejestrze; ściany wnęk w DOBUDÓWKACH pod płytą; pas szczytu ściany w kompilatorze przy
wierzchołku połaci w przekroju ściany (wtórny dla Anny II).

## 8. Cała aplikacja BuildApp — działa zgodnie z zamierzeniem (polecenie OWNER-a w trakcie etapu)

Polecenie: „zrób tak, aby działała jak zamierzone cała aplikacja BuildApp". Stan przed: 18 znanych czerwonych testów
w macierzy TypeScript (lista v3.54.18–v3.54.20, przenoszona z etapu na etap jako „środowiskowe") i 5 czerwonych testów
JVM Androida (od scen v3.54.20). Każde niepowodzenie rozłożone do przyczyny; żadne nie zostało wyłączone ani pominięte.

| Część | Przed | Po | Co było przyczyną |
|---|---|---|---|
| typecheck (`tsc` repo + web) | czysto | czysto | — |
| vitest (macierz, 4763 testy w chwili polecenia) | **16 czerwonych zmierzonych** (lista dziedziczona: 18, w tym 2 `WorkerExecutor`, które w tej macierzy przeszły) | **13 z 18 naprawionych u przyczyny w kodzie**; 3 testy IU środowiskowe (zielone tylko z systemowym Pythonem 3.13, w macierzy czerwone); 2 testy `WorkerExecutor` przekraczają limit czasu w pełnej macierzy (patrz niżej) | tabela niżej |
| web: build produkcyjny + e2e (Playwright) | 1 czerwony z 49 | **49 / 49** | zamrożony plik 1.6.0 porównywany ze schematem 1.9.0; brak ikony strony → 404 `/favicon.ico` w konsoli |
| host analizatora (`apps/analyzer-api`, bundel server + worker) | buduje | buduje | — |
| analizator lokalny telefonu (`apps/local-analyzer`, bundel + wasm + model ONNX) | buduje | buduje; parzystość z komputerem: Larchfield, Holloway, Sliverton | — |
| Android JVM (`testDebugUnitTest`, 479) | 5 czerwonych | **476 zielonych, 0 czerwonych, 3 pominięte** (jak dotąd) | tabela niżej |

Naprawione u przyczyny (commit `8cc0d47`, web `efdab37`):

| Test | Przyczyna | Naprawa |
|---|---|---|
| `analyzer-api` „nie zwraca sekretu" | transport konsultanta w `analysis-service` czytał zmienną klucza sam, wbrew regule „klucz czyta tylko pakiet dostawcy" | `providerKeyFromEnvironment()` w `source-vision` (ta sama kolejność zmiennych); usługa i API nie nazywają zmiennej |
| analizator lokalny: Larchfield = scena serwera | porównanie z migawką **historyczną** (solver 2.3.0), którą decyzja N9-01 zostawia nietkniętą | porównanie z migawką **bieżącą** (`analyzer-contract-current`), którą test kontraktu odświeża |
| NFD jak ICU | tablice wygenerowane z ICU 78.3 / Unicode 17 (komputer OWNER-a); tu Node ma ICU 77.1 / Unicode 16 i nie zna najnowszych znaków łączących | porządek znaków łączących sprawdzany tylko na znakach, które zna uruchomione ICU (≥ 90 % tablicy) |
| `reference` 4 i 7 | schemat modelu przeszedł 1.6.0 → 1.9.0 (N8-03D2, v3.54.9, v3.54.13); testy zakładały, że bieżący to 1.6.0 | zamrożone pliki porównywane **po migracji** do bieżącego schematu (różnią się tylko notatkami migracji) |
| `presentation` (2) | dwa pliki etapu „wyglądy domu" nie dopisane do listy; literał `1,05` (5 % zapasu przycięcia) to przypadkiem współrzędna domu-dawcy | lista uzupełniona; zapas jako nazwana stała `TRIM_ALLOWANCE` |
| `compound-facade` | N8-02A dodał regułę „4 grubości ściany" bez aktualizacji zamrożonego zbioru liczb | zbiór uzupełniony z nazwaną regułą (liczba ścian, nie wymiar arkusza) |
| `research-isolation` 005M | APK OWNER-a z 005T (39,6 MB, podpisany pakiet Androida) w repo, ponad próg 32 MB „wagi modelu" | jedyny przejrzany duży plik przypięty po SHA-256 (podmiana treści = czerwono) |
| `research-isolation` IU-01/02/03A | `python3` z PATH w tym kontenerze to 3.11 bez numpy/PIL | środowisko, nie kod: z systemowym Pythonem 3.13 — 85 / 85 |
| `wall-strip` 005Q (4) | porównania z bazą 005Q liczone dla **dzisiejszego** drzewa, więc każdy późniejszy zamierzony etap je łamał | porównania czytają **dostawę 005Q** (`7eddd7b`) wobec jej bazy; bieżący kod trzymany ogólną regułą N1 (otwarta ściana nigdy nie podnosi proweniencji) |
| Android `FeatureEdges` | narożniki obiektów zgrzewane do 0,1 mm (zamierzone, dla szwów); test sprawdzał koniec linii parametrycznie (1e-6 długości boku) | test mierzy odległość od **odcinka** boku z tolerancją zgrzewu |
| Android `RoofCover` (1 test, 2 warunki) | budżet trójkątów sprawdzany szacunkiem; 40 320 > 40 000 na domu z wieloma szczytami; „≤ 8 partii" z czasów jednego obiektu na dach, a układ dachów ma obiekt na połać | pokrycie mierzy to, co ułożyło, i powiększa moduł o zmierzony nadmiar; test: dachówki ≤ pojemność połaci, partie ≤ liczba pokrytych dachów |
| Android `OwnerCheckpoint` (1), `AutoCandidateRendering` (2) | rejestr etapów nie znał v3.54.18+ | rozpoznawanie etapu i linii analizatora po etapie |
| e2e „zapis = zamrożony plik" | jak `reference` 4 | bajty różnią się wyłącznie wersją schematu — sprawdzane dokładnie tak |
| e2e: błąd w konsoli | strona nie deklarowała ikony, przeglądarka pytała o `/favicon.ico` (404) | `<link rel="icon" href="data:,">` |

Pozostaje: dwa testy `WorkerExecutor` (dwa zadania w dwóch wątkach; anulowanie zadania w wątku) mają limit 120 s
i padają, gdy maszyna jest zajęta przez równoległe odtworzenia (4 rdzenie, 3 biegi DEV); w pierwszej macierzy tego
etapu przy mniejszym obciążeniu przechodziły. Na spokojnej maszynie (§11): w izolacji i w swoim pakiecie zielone,
w pełnej macierzy 410 plików nadal przekraczają 120 s.

## 9. Które informacje pominięto i dlaczego (z automatycznego śladu pominięć)

Każdy oddany dom ma `houses/<dom>/omissions.md`: wykaz obrazów każdego etapu (§3), potem cecha → odczyt API →
uzgodnienie → model → wynik i przyczyna, a na końcu otwarte cechy kluczowe. Zestawienie po 29 oddanych modelach
(157 wierszy cech z przyczyną):

| Przyczyna | Wierszy | Co to jest | Główne cechy |
|---|---|---|---|
| `NO_CONSUMER` — brak funkcji | 89 | API zgłosiło cechę, nie ma operacji, która zbuduje ją jako to, czym jest (cofnięta ściana w obrysie, dach na słupach, płyta wysunięta) — **celowo nie budowana jako pudło z płaskim dachem** | tarasy 36, wnęki 20, balkony 11, podcienie / ganki 9, daszki 5, wykusze 3, lukarny 3, wiata 1 |
| `NOT_ASKED` — nie zadane jako własność | 41 | liczba podana przez API jest tylko świadkiem; element budowany z odczytu elewacji po kolei (z własnym losem) | kominy 9, okna dachowe 8, drzwi wejściowe 5, okap 5, lukarny 3, brama garażu 2 |
| `CONFLICT_WITH_DRAWING` — odrzucone przez bramkę | 14 | liczba API sprzeczna z rysunkiem; zostaje wartość z rysunku, konflikt zapisany (`RETAINED_WITH_CONFLICT`) | okap dachu głównego 8, kąt 3 |
| `LOST_IN_BINDING` — utrata w wiązaniu | 7 | opis dachu / części nie znalazł bryły, do której da się go związać po jej własnych widokach | trzeci dach (R3) i jego styk 4 (Amarylis, Anna II), skrzydło Elizy |
| `DISPUTED_BY_WITNESS` — spór z niezależnym świadkiem | 4 | np. „dwie pełne kondygnacje" przy stronie, która nazywa piętro poddaszem; kalenica sprzeczna z elewacją bez ściany szczytowej | kondygnacje, kierunek kalenicy |
| `BUILD_ERROR` — błąd budowy | 1 | Willa Eliza: kalenica z opisu nie zbudowała się (podział brył z rzutu piętra poza zakresem) | — |
| `NO_EVIDENCE` — brak dowodu | 1 | Dom pod osiką: kondygnacje bez świadka | — |

Wnioski dla dalszego rozwoju (to, co ślad pokazuje, a czego ten etap nie zbudował):

1. **Wnęki, tarasy, balkony, podcienie, daszki, wykusze, lukarny, wiata (88 wierszy; same wnęki, tarasy, balkony
   i podcienie — 76)** — najczęstsza przyczyna „bryła dobra, dom
   nierozpoznawalny". Brakuje reprezentacji cofniętej / wysuniętej powierzchni obrysu z konsumentem.
2. **Kominy i okna dachowe** są budowane z odczytów elewacji, a liczba z API jest tylko świadkiem. Liczba kominów nie
   zgadza się w 9 domach, okien dachowych w 8 (razem 14 domów; np. 3 kominy tam, gdzie źródło podaje 2) — następny krok: liczba z API jako ograniczenie
   doboru odczytów elewacji, nie jako osobny element.
3. **Trzeci dach i jego styk** gubią się w wiązaniu, gdy nie ma bryły z własnymi widokami — szczyt poprzeczny
   nad LOCAL-em nie ma konsumenta (Osika: portyki).
4. **Okap dachu głównego** jest najczęściej sprzeczny z rysunkiem (8) — zostaje rysunek; to poprawne zachowanie.

## 10. Host na ostatecznej rewizji

Rzeczywisty host (`apps/analyzer-api`, bundel serwera, konsultant pilotażowy, odczyt metryczny i szkice włączone,
narzędzia strict, cache promptu 5 min, własna księga hosta z pułapem), publiczny punkt wejścia `POST /v1/analyses`,
klucz wyłącznie ze środowiska procesu. Harness: `research/source-to-model/v35419/host-e2e.mjs`.

| Sesja | Rewizja | Zadanie | Wynik | Czas | Koszt | Żądania |
|---|---|---|---|---|---|---|
| 1 | `5d5ea2c` | Debora — świeży bieg | **COMPLETED**: układ T, 6 połaci, 2 kosze, 2 dojścia, brama garażowa 4,7 m, 11 ścian wewn., 15 otworów zewn.; jakość `BUDGET_OR_ROUND_LIMIT` (0 otwartych cech kluczowych) | 686 s | 0,978251 USD | 20 |
| 1 | `5d5ea2c` | Anna II — świeży bieg | **ANALYSIS_FAILED / INTERNAL_ERROR** — przyczyna niżej | 536 s | 0,371605 USD | 12 |
| 1 | — | powtórka, bez tokenu | przerwane restartem procesu roboczego (nic nie zaksięgowane) | — | 0 | 0 |
| 2 | `1a00654` | Anna II — świeży bieg | **COMPLETED**: 8 połaci, 4 kosze, 2 dojścia, 9 ścian wewn., 13 otworów zewn.; jakość `RECOGNIZABLE_PARTIAL` (0 otwartych cech kluczowych, 9 innych) | 856 s | 0,868897 USD | 18 |
| 2 | `1a00654` | Debora — powtórka zaakceptowanego linku | **REUSED**: 20 odpowiedzi odtworzonych, 0 brakujących, **te same bajty modelu i sceny**, ten sam stan jakości i lista wad | 285 s | **0** | **0** |
| 2 | `1a00654` | Lyon — bez tokenu | **COMPLETED** wyłącznie ścieżką rysunków, bez konsultacji | 165 s | **0** | **0** |
| kontrola | `1a00654` | Anna II na hoście z księgą już na pułapie | **COMPLETED** bez żadnego żądania: 12 rezerwacji odmówionych i zapisanych (`RESERVATION_REFUSED`: 4 odczytu metrycznego, 4 szkiców, 2 rund, struktura, obrys), model z rysunków dostarczony, jakość `NOT_REVIEWED`; dwie kontrole harnessu (zatwierdzona łatka, ocena rewizji) czerwone z definicji — nie było o co zapytać | 180 s | 0 | 0 |

Sesja 2: **ALL CHECKS PASSED** (każdy zapis wyniku, sceny i modelu zgodny z sumami SHA-256 podsumowania i nagłówka;
księga hosta zawiera wyłącznie żądania konsultacji; czytnik domów nigdy nie był pytany).

**Usterka znaleziona na hoście i poprawiona** (`174e093`): w sesji 1 ustawiłem pułap hosta na księgę + 1,5 USD. Po
12 żądaniach Anny II rezerwacja odczytu struktury przekroczyłaby pułap (63,8250 + 0,1790 > 63,975156 USD) i księga
odmówiła — co jest poprawne — ale odmowa wydostała się z kroku czytającego i całe zadanie skończyło się
`INTERNAL_ERROR` (dziennik wymian: `FAILED … STRUCTURE_READ … HouseReaderUnavailable: this host's ceiling … would be
passed`, ramki `refuse → reserve → readForm`). Każdy z sześciu kroków czytających i wspólna wysyłka rund (7 miejsc) brały rezerwację poza własnym `try`.
Poprawka: rezerwacja w `try`, odmowa księgi = BUDGET tego jednego żądania (nic nie wysłane, nic nie rozliczone),
analiza idzie dalej bez tego odczytu, a odmowa jest w dzienniku wymian (`RESERVATION_REFUSED`). Test przyczynowy
`budget-refusal-v35421` (4 z 4 czerwone na kodzie sprzed poprawki, zielone po); odtworzenia (bez księgi) bez zmian.
Nie odtworzyłem lokalnie dokładnej ścieżki hosta (bajty strony z tamtego zadania usunął host po porażce, a harness
badawczy nie prowadził rund etykiet z nagrania — dodałem `--loop-replay`); przyczyna jest udokumentowana dziennikiem
wymian hosta, a poprawkę sprawdza test i kontrola na hoście z księgą na pułapie.

Kod analizy w sesji 2 różni się od `5d5ea2c` wyłącznie tą poprawką (ścieżka odmowy); harness hosta — opcją
`--first-from` (powtórka sprawdzana wobec świeżego biegu Debory z sesji 1, bez ponownego kupowania).

## 11. Testy — macierz wobec baseline

Ostateczne drzewo `10079ee` (kod analizy = `174e093`; późniejszy `7580a8f` zmienia tylko podpisy trzech scen — testy scen i Androida powtórzone na nim: 135/135, 476 + 3 pominięte), kontener 4 rdzenie, nic innego nie biegło w tle.

| Część | Baseline `108611e` | Po | Uwagi |
|---|---|---|---|
| typecheck (`tsc` repo + web) | czysto | **czysto** | |
| vitest — pełna macierz (410 plików, 4782 testy) | 16 czerwonych zmierzonych w pierwszej macierzy etapu (lista dziedziczona: 18) | **4766 zielonych, 5 czerwonych, 11 pominiętych** | rozbicie niżej |
| — `research-isolation` IU-01/02/03A (3) | czerwone | czerwone w macierzy, **85/85 z systemowym Pythonem** | `python3` z PATH to 3.11 bez numpy/PIL (środowisko, jak w baseline) |
| — `WorkerExecutor` (2) | czerwone na liście baseline (v3.54.18–20, „środowiskowe”); zielone w pierwszej macierzy tego etapu | **przekraczają 120 s w pełnej macierzy**; w izolacji 3/3 (19 s), cały pakiet `analyzer-api` 107/107 | kod i testy `apps/analyzer-api` bez zmian od baseline; wątki workera głodzone przez pulę 410 plików na 4 rdzeniach — nie naprawiam limitu czasu, nazywam |
| web: build produkcyjny + e2e (Playwright) | 1 czerwony z 49 | **49 / 49** | przeglądarka kontenera (`/opt/pw-browsers/chromium`) przez lokalny, niecommitowany config |
| host analizatora (bundel server + worker) | buduje | **buduje**; end-to-end: ALL CHECKS PASSED (§10) | |
| analizator lokalny telefonu (bundel + wasm + ONNX) | buduje | **buduje** | |
| Android JVM (`testDebugUnitTest`, 479) | 5 czerwonych | **476 zielonych, 0 czerwonych, 3 pominięte** (jak dotąd) | |
| sceny telefonu (`packages/mobile-scene`) | — | **135 / 135** (20 plików) | 31 nowych scen, starsze testy przesunięte o 31 pozycji |

Nowe testy przyczynowe etapu (wybór): układ dachów (kosz i poprawny brak kosza, różne wysokości okapów, zmiana osi
po walidacji, szczyt poprzeczny bez uskoku rzutu, błędna sugestia API przy poprawnym modelu, etykieta początku ściany
w obrysie L), `feature-map-v35421`, `main-flat-roof-v35421`, `budget-refusal-v35421` (4/4 czerwone przed poprawką),
`owner-v35421` (sceny). Regresja DEV na nagraniach (24 domy, 0 USD) — §7.

## 12. APK

`BuildPlan-Model-Preview-arm64-v8a-debug.apk` → oddany jako **`BuildPlan-Model-Preview-1354-arm64-v8a.apk`**, versionCode
**1354** (`0.1354.0-owner`), z commita `7580a8f`, podpisany kluczem podglądu (SHA-256 certyfikatu `6e48fac4…ca0da`, ten
sam co dotąd). Rozmiar 56 223 473 B, SHA-256 `67057db2…2b796` (pełna suma w `stage-reports/artifacts/v35421/DELIVERY.txt`).

- 127 scen; **31 nowych na początku listy**: pięć domów NEW-H (Anna II, Debora, Lyon jako biegi DEV po próbie — tak
  podpisane; Dom pod morwą i Dom pod osiką jako pierwszy wynik próby), kontrpróby audytu i domy DEV na kodzie
  ostatecznym, potem dwa modele z hosta (Debora, Anna II). Każdy tytuł i podtytuł podaje stan (próba / DEV / host),
  liczby policzone z samego modelu (połacie, kosze, dojścia, ściany wewnętrzne, otwory) i nazwane straty.
- Sceny są zapieczętowanymi bajtami modeli (SHA-256 przypięte w rejestrze); test `owner-v35421` sprawdza kolejność,
  podpisy strat, kompilację każdej sceny i to, że liczby w podpisie są liczbami modelu.
- **Weryfikacja, że APK pokazuje te same modele**: 128 plików `assets/scenes` wyjętych z APK jest **bajt w bajt**
  równych eksportowi z repozytorium (127 pakietów scen + indeks), a eksport powstaje z zapieczętowanych modeli
  (`mobile:export-scenes`; testy pakietów sprawdzają hash każdego pakietu). Testy JVM Androida: 476 zielonych, 0 porażek,
  3 pominięte (479, jak dotąd).
- Rendery w dostawie są renderami z komputera (ten sam kompilator geometrii, renderer programowy), **nie zrzutami
  z telefonu**. W sesji nie było urządzenia ani emulatora: **`ANDROID_UI_NOT_VERIFIED`**.

## 13. Dostawa

Prywatna, poza Git (obrazy wydawców i dane projektu — nie publikować). Archiwa `BuildPlan-V35421-*.zip`, **każde
poniżej 30 000 000 B**, każde zwykłym niezależnym ZIP-em z jednym folderem `BuildPlan-V35421/`, własnym README
i manifestem SHA-256 każdego pliku; po rozpakowaniu wszystkich do jednego katalogu galerię otwiera
`BuildPlan-V35421/gallery.html` (offline, odsyłacze względne, sprawdzone: 0 brakujących). Nazwy, rozmiary i sumy
archiwów oraz APK, wynik sprawdzenia po rozpakowaniu i skan klucza: `stage-reports/artifacts/v35421/DELIVERY.txt`.

| Część | Zawartość |
|---|---|
| `01-RAPORT-GALERIA` | `gallery.html` (29 domów: oryginały, szkice PNG/SVG/JSON, cztery strony każdego wariantu, perspektywy, dach z góry ze złączami, wnętrze na rzucie, ślad pominięć), raport, notka, ADR, protokół, hand-off, opisy referencyjne NEW-H, oceny ślepe z kluczem, diagnozy, recenzja poprawek |
| `02-PLANSZE` | plansze porównawcze: oryginał / szkic / baseline / F@B/2 / F@B / po próbie (NEW-H), oryginał / szkic / baseline / zamrożony / ostateczny (DEV) |
| `03-HOST` | obie sesje hosta i kontrola na pułapie: rekordy zadań, modele i sceny, dzienniki, księga hosta, dzienniki wymian (żądania i odpowiedzi), rendery dwóch modeli z hosta |
| `04-OCENA-SLEPA` | paczka dla oceniających (warianty X/Y, bez nazw wariantów; klucz w części 01) |
| `05…` `DOMY` | po domu: oryginały wydawcy, **dokładnie wysłane pakiety obrazów** odczytu struktury (PNG w kolejności wysłania + `request.json`), surowe i kanoniczne odpowiedzi, uzgodniona struktura, szkice, modele wszystkich wariantów, rendery, nakładki na rzut, ślad pominięć (`omissions.md` / `.json`) — wystarczy, by następna sesja nie kupowała odczytów ponownie |

APK osobno (§12).

## 14. Koszty

Ta sama, istniejąca pula API (klucz ze środowiska, bez nowej puli i bez nowego dostawcy). Księga
`research/ai-assist/spend-ledger-v35417r3.json` przed etapem: **56,290453 USD**; po etapie: **64,693909 USD**. Koszt
etapu: **8,403456 USD** (184 żądania faktycznie wysłane; księga ma też 351 wpisów 0 USD — odpowiedzi odtworzone
z nagrań, bez żądania) — w limicie etapu 25 USD z §7a protokołu; OWNER podał ok. 40 USD na koncie przy stanie księgi
60,360809 USD; od tamtej chwili księga wzrosła o 4,333100 USD, więc zostaje ok. 35,7 USD (księga wycenia żądania
cennikiem; dokładny stan konta OWNER widzi u dostawcy).

| Na co | USD | Żądań wysłanych | (odtworzonych, 0 USD) |
|---|---|---|---|
| recenzje i rundy poprawek na żywo (kontrpróby audytu, ramię F@B, poprawki po próbie) | 3,365245 | 64 | 1 |
| host na ostatecznej rewizji (sesje 1 i 2; w sesji 1 Anna II padła na pułapie po 12 żądaniach, 0,371605 USD) | 2,218753 | 50 | 0 |
| odczyty struktury `form-read/3` z oryginałów i perspektyw | 1,402451 | 18 | 24 |
| odczyt metryczny (ramię B NEW-H na żywo) | 1,107202 | 27 | 141 |
| szkice elewacji (ramię B) | 0,218219 | 20 | 148 |
| obrys rzutu i pozostałe | 0,091586 | 5 | 37 |

Po domach (bez hosta): Osika 0,73, Debora 0,67, Eliza 0,65, Ametyst 0,64, Amber 0,61, Anna II 0,59, Morwa 0,52,
Amarylis 0,51, Lyon 0,38, Aletta 0,30, Mindelo 0,29, Skagen 0,29 USD. Wszystko inne (24 domy DEV, F@B/2, regresje,
odtworzenie po recenzji poprawek, kontrola hosta na pułapie) — 0 USD z nagrań.

## 15. Co nadal jest złe (w kolejności tego, co OWNER zobaczy)

1. **Anna II: wnętrze i okna utracone przez bryłę ze źródeł** — ściany wewnętrzne 26 → 17, otwory elewacji 39 → 9
   (okna 28 → 7; drzwi wewnętrzne 6 → 8). Bryła ze źródeł buduje ściany zewnętrzne i dachy, ale nie przenosi ścian
   i otworów, które LOCAL miał. To jest dokładnie strata,
   przed którą prompt ostrzega („naprawa dachu nie ma po cichu usuwać poprawnego wnętrza") — tu nie po cichu, ale
   nadal strata. Szczyt garażu Anny II ma kalenicę wzdłuż głębokości (w źródle równoległa do frontu). Świeży bieg tego
   domu przez host (sesja 2) potwierdza oba fakty niezależnie od nagrań: dachy krzyżujące z 4 koszami, ale 9 ścian
   wewnętrznych.
2. **Wnęki, tarasy, balkony, podcienie, daszki, wykusze, lukarny, wiata** — 88 zgłoszeń API w śladzie pominięć bez
   wykonawcy. Są nazywane
   i nie są budowane jako pudła; dom bez nich jest mniej rozpoznawalny.
3. **Dom pod osiką**: portyków (dwa szczyty poprzeczne z koszami) nie ma; okna prawej elewacji przebudowane według
   elewacji postawionej po złej stronie (świeży odczyt API, przyjęty bez kontroli rzutem).
4. **Lyon**: płyta dachu na głowicy ściany (5,6 m), attyka 6,56 m z przekroju nieosiągnięta; wiata i pergole bez
   przekrycia.
5. **Debora**: drugi komin wycofany (kolizja ze ścianą tylną skrzydła); kąt 40,9° wobec 44° z odczytu.
6. **Dom pod morwą**: brak daszku wejściowego i pergoli; widoki szczytowe liczą pylon wejścia w szerokość (skala
   o ok. 9 % za mała).
7. **Aletta**: dach garażu 20,6° (za płaski). **Eliza**: podział brył z rzutu piętra poza zakresem.
   **Amarylis**: 2 z 4 kominów utracone w recenzji na żywo. **Medulin, G6, Rockville, Basia i Adam**: straty z 1353
   bez zmiany (podpisy scen).
8. Kod: decyzja boków przy rejestracji nadal przyjmuje bok z `form-read/2` dla słabych etykiet; odczyt dostaje
   etykietę LOCAL jako „podpis" niepodpisanej elewacji; ściany wnęk dobudówek pod płytą; pas szczytu ściany
   w kompilatorze przy wierzchołku połaci w przekroju ściany.

## 16. Ograniczenia

- **Pięć nowych domów to mała próba.** Wynik 2 : 1 : 2 nie jest procentem skuteczności. Trzy domy próby po poprawkach
  są DEV i nie świadczą już o przenoszeniu.
- **Ocena ślepa jest oceną modeli AI** (3 niezależne konteksty na dom, warianty X/Y losowane, klucz poza paczką), nie
  oceną OWNER-a. Plansze są w dostawie, żeby OWNER ocenił sam.
- **Recenzja na żywo jest zmienna**: ten sam kod na tych samych nagraniach daje różne zestawy kominów i okien
  (Amarylis, Eliza). Pierwszy wynik jest zachowany; nie powtarzałem biegów do „lepszego".
- **APK niesprawdzony na urządzeniu** (`ANDROID_UI_NOT_VERIFIED`): sceny są tymi samymi zapieczętowanymi bajtami
  (SHA-256 w rejestrze), sprawdzonymi testami JVM i testem scen, nie zrzutem z telefonu.

## 17. Rekomendacja następnego kroku

1. **Bryła ze źródeł przenosi wnętrze z rzutu**: ściany i drzwi LOCAL-a przeniesione w ramę nowej bryły (rejestracja
   rzutu już istnieje), z rozliczeniem każdej ściany, która nie mieści się w nowym obrysie (Anna II).
2. **Wnęki, tarasy i podcienie jako cecha obrysu z wykonawcą** (cofnięta ściana, dach na słupach, płyta wysunięta) —
   najczęstsza pozycja śladu pominięć.
3. **Bok elewacji z odczytu sprawdzany rzutem**: okna, które rzut rysuje na każdej ścianie, jako świadek boku (Osika).
4. **Szczyty poprzeczne nad bryłą LOCAL** (portyki Osiki, szczyty Rockville).
