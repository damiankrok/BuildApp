# BuildPlan — Marcówki i UI (po APK 1354): jeden dom pokazowy, miejsce na model, czytelny postęp — APK 1355

Etap: 2026-11-26, decyzja OWNER-a z tego dnia („Marcówki i UI; badania analizatora wstrzymane”, paczka
`BuildPlan-MARCOWKI-UI-START.zip`). Gałąź `claude/new-session-3kzcgh`, commity z `[skip ci]`, bez PR i bez scalenia.
Baseline: `ebaae1d2` (APK 1354). Krótko dla OWNER-a: `stage-reports/README_MARCOWKI_UI.md`.
Budżet płatnych żądań: **0 USD** — w tym etapie nie było żadnego żądania do API ani hosta.

**Weryfikacja na ekranie: wykonana na emulatorze, nie na telefonie.** Zrzuty pochodzą z uruchomionej aplikacji na
emulatorze Android 10 (API 29, x86_64, 720 × 1600 px przy 280 dpi = 411 × 914 dp jak Pixel 6), z programowym GPU
(SwiftShader/ANGLE) i bez akceleracji CPU. To jest prawdziwe UI tej aplikacji, ale nie jest to Twój telefon:
płynność, gesty wielopalcowe, wydajność renderowania i Android 14/15 trzeba sprawdzić na urządzeniu (lista w §7).
Test JVM ani render komputerowy nie są tu nazywane testem UI.

## 1. Sprawdzenie paczki startowej i zamrożonego punktu

- `MANIFEST.sha256` z ZIP-a: wszystkie pięć plików zgodne.
- Model `packages/candidates/src/owner-v35414/marcowki-c-v35414.model.json`: SHA-256 `a66428c8…48759a0f5`,
  Git blob `7b5e3c82…` — identyczny z paczką i z `marcowki-freeze.json`.
- Scena `apps/android/app/src/main/assets/scenes/marcowki-c-v35414.scene.json`: SHA-256 `680a3f4b…3a3023d47166`,
  Git blob `6b4ea6b5…`, logiczny `contentHash` `3dc4d3bb…aea0ffb7` — identyczne.
- Po zmianach: `npm run mobile:export-scenes` odtworzył **wszystkie 127 plików scen bajt w bajt**; jedyna zmiana
  zasobów to jedno dodatkowe pole `showcase` we wpisie `marcowki-c-v35414` w `index.json`. Bajty modelu i sceny
  trzymają testy `packages/mobile-scene/test/showcase.test.ts` i `ShowcaseCatalogTest`.
- Geometrii Marcówek nie analizowano ponownie i nie zmieniano; renderera w zakresie wyglądu modelu nie zmieniano.

## 2. Co było źle — wykazane na uruchomionej aplikacji (APK 1354, `ebaae1d2`)

| # | Problem | Dowód |
|---|---|---|
| P-1 | Zimny start otwiera „Anna II (Studio Atrium) — v3.54.21: NEW-H, PO PRÓBIE (DEV)…” — eksperymentalny model ze stratami | `before-01-cold-start` |
| P-2 | 1354 zapamiętuje **każdy** otwarty dom, także swój automatyczny wybór: świeża instalacja ma w `preview.xml` `lastOpenKey=anna-v35421`, więc po aktualizacji też otworzyłaby Annę II | `run-as … shared_prefs/preview.xml` przed aktualizacją |
| P-3 | Menu „Domy na tym telefonie” to 127 scen badawczych opisanych jako „Przykład wbudowany w aplikację · model poglądowy” | `before-02-menu` |
| P-4 | „Postęp nieustawiony” dwa razy naraz (kontekst u góry i nagłówek osi) | `before-01` |
| P-5 | W poziomie kontekst u góry (z wierszem statusu) i oś z pustą miarką zostawiają domowi pas ~215 px (≈ 123 dp) | `before-03-landscape` |
| P-6 | Nagłówek osi przy nieustawionym postępie nie mówi, co pokazuje 3D (cały projekt) | `before-01` |
| P-7 | **Znalezione w trakcie etapu:** „Z prawej” ucina dom z lewej strony (o całe przęsło), „Z lewej” mieści się | `after-11d-right` |

## 3. Co zmieniono

### 3.1 Jeden czytelny dom pokazowy (brief §1)

- **Oznaczenie w rejestrze scen**, nie w kodzie aplikacji (aplikacja nie zna domów z nazwy):
  `packages/mobile-scene/scripts/scenes.ts` daje scenie `marcowki-c-v35414` pole `showcase`
  („Dom w marcówkach”, „Model demonstracyjny — odtworzony z publicznego projektu, nie dokumentacja budowy”);
  eksporter przenosi je do `index.json`. Kolejność 127 scen bez zmian.
- **Start** (`PreviewViewModel`, `StartChoice`): dom ostatnio **wybrany** przez właściciela, gdy lista go ma; inaczej
  dom pokazowy; w buildzie bez domu pokazowego — pierwszy, jak dotąd. Aplikacja zapamiętuje tylko wybór właściciela
  (`lastChosenKey`), nie swój automatyczny start.
- **Migracja z 1354**: stary `lastOpenKey` jest zaufany tylko, gdy wskazuje analizę zrobioną na tym telefonie (tę
  właściciel na pewno wybrał); wpis wskazujący scenę wbudowaną jest usuwany. Sprawdzone na emulatorze: aktualizacja
  1354 → 1355 z `lastOpenKey=anna-v35421` otwiera „Dom w marcówkach”, a `preview.xml` jest pusty.
- **Menu domów**: dom pokazowy i analizy z telefonu; jeśli otwarta jest scena z galerii — też ona, oznaczona.
  Na dole jeden wiersz „Galeria deweloperska · 126 scen z badań analizatora — wersje, porównania, porażki”.
- **Galeria deweloperska** (nowy arkusz `Sheet.GALLERY`): nagłówek i opis poza przewijaniem („materiał roboczy, nie
  model demonstracyjny i nie dom z Twojego linku”), lista leniwa z tytułem i podtytułem technicznym każdej sceny,
  gradient przy ucięciu, otwiera się na bieżącej scenie, przy otwartej scenie z galerii „Wróć do: Dom w marcówkach”.
  Żadnej sceny nie usunięto.
- **Uczciwa etykieta**: pod nazwą w kontekście „Model demonstracyjny”; w menu i w arkuszu źródła pełne zdanie;
  wersja, kod sceny i historia (tytuł/podtytuł z rejestru) w „Dane techniczne” arkusza źródła. Scena z galerii mówi
  w wierszu statusu „Scena z galerii deweloperskiej — wróć do: Dom w marcówkach”.

### 3.2 Miejsce na model (brief §2)

- Kontekst u góry: jedna linia = jeden fakt. Dla domu pokazowego w spoczynku „Model demonstracyjny”; podczas
  podglądu etapu albo przy otwartych szczegółach — rzeczywisty stan (wygrywa); w spoczynku innych domów data zapisu.
  Druga linia jest zawsze układana (stała wysokość — kadr nie skacze). Wiersz statusu „Przykład wbudowany…” zniknął
  z domu pokazowego (dodawanie domu z linku jest w menu).
- **Poziom** (`TimelineRail(compact = true)` przy wysokości okna < 480 dp): nagłówek osi i miarka w jednym rzędzie.
  Wolny pas na dom w poziomie: ~215 px → ~457 px (≈ 123 → 261 dp, ×2,1) — `02-poziom-przed-po`. Pion: +7,5 %.
- **Kadrowanie widoków równoległych** (P-7): elewacje, rzuty, aksonometria i izometria kadrują prostopadłościan domu
  w wolnym polu, tak jak „Cały dom” w perspektywie (`OrbitCamera.frameBoxOrthographic`). Wcześniej kula w kwadracie
  — ucinała długie boki w pionie. Zmienia się wyłącznie kamera (ostrość i oddalenie), nie skala geometrii.
  `ParallelViewFramingTest`: każdy narożnik w wolnym polu w pionie i poziomie, oba boki w tej samej skali.
- Inset u góry rejestrowany tylko w spoczynku; inset osi nie łapie animacji wyjazdu pod szczegóły (audyt F5).

### 3.3 Oglądanie i wnętrze (brief §3)

- Istniejące funkcje bez nowych odpowiedników: Warstwy (Cały dom / Bez dachu / Tylko parter / Tylko poddasze /
  Przekrój / Tylko zaznaczony / Pokaż wszystko), Widok (Cały dom, Przybliż/Oddal, cztery elewacje, Dach z góry,
  Rzut parteru/poddasza, aksonometria, izometria, Schody, Wejście, Przywróć widok), Dopasuj.
- **Co jest ukryte**: gdy warstwa ≠ „Cały dom” i nie ma zaznaczenia ani otwartego panelu, u stopy domu (na szkle osi,
  jak wiersz zaznaczenia) stoi „Tylko parter · Ukryto poddasze i dach nad nim · [Pokaż wszystko]” — to samo „Pokaż
  wszystko” co w panelu Warstwy; zdanie wyliczone z tego, co filtr zdjął (runda 2, F1). Wybór warstwy zamyka panel. Przy izolacji nazwany element („Tylko: Balkon”). W poziomie wiersza nie ma (zasłoniłby dom) —
  stan mówi etykieta szyny („Parter”, „Bez dachu”). Po „Pokaż wszystko” TalkBack mówi „Widać cały dom”.

### 3.4 Postęp budowy (brief §4)

- Trzy pojęcia rozróżnione w nagłówku osi:
  **oglądanie gotowego modelu** — „Projekt docelowy” (to, co pokazuje 3D) + „Ustaw postęp” + jedna linia
  „Postęp nieustawiony · przesuń po osi etapów”; **podgląd etapu** — „Podgląd: Dach · Stan po etapie: Dach” i
  „Wróć do projektu” (gdy postęp nieustawiony; „Wróć do teraz”, gdy ustawiony); **zapisany postęp** — „0% Formalności ›
  Etap w toku · 0%” ze znacznikiem „teraz” na miarce.
- „Postęp nieustawiony” mówione raz: przez oś w spoczynku albo przez linię etapu w szczegółach elementu; u góry tylko,
  gdy żadna z nich nie stoi. TalkBack na miarce mówi „Projekt docelowy”, nie drugi raz „Postęp nieustawiony”.
- Niski nagłówek osi w stanie nieustawionym (jedna linia akcji, jedna linia opisu) — mniej szkła nad domem.
- **Przewijanie podglądu nie zapisuje**: sprawdzone w kodzie (`ProgressSession.preview` zmienia tylko kursor; test
  `previewingNeverWritesAndTerazReturnsToWhatWasSaved`) i na emulatorze: po podglądzie „Dach” katalog
  `files/progress` nie istnieje; zapis powstał dopiero po „Ustaw jako aktualny” w arkuszu etapów.

### 3.5 Wydajność i drobne (z audytu)

- Prezentacja sceny (krawędzie, pokrycie dachu) liczona w tle razem z ładowaniem, nie w pierwszej klatce — dom
  pokazowy jest najcięższą sceną (15 574 trójkątów). Indeks scen parsowany raz.
- Szyna boczna w poziomie, menu i galeria: gradient przy ucięciu listy. Cień paska nawigacji także po lewej (telefon
  obrócony w drugą stronę). Jedna definicja „krótkiego okna”.
- `DESIGN.md` opisuje nową regułę startu, galerię, wiersz warstw, nagłówek nieustawiony i tryb kompaktowy osi.

## 4. Audyt impeccable

**Runda 1** (5 audytorów: dostępność, motyw + zgodność z platformą, adaptacja, wydajność, zgodność z briefem;
każdy zestaw ustaleń sprawdzony przez niezależnego sceptyka). Oceny wymiarów: dostępność 3/4, wydajność 2/4,
motyw 3/4, zgodność z platformą 3/4, adaptacja 2/4 → **13/20**. Potwierdzone i poprawione w tym etapie:
A11Y-01 (P1, etykieta zjadała rzeczywisty stan przy 1,3), F1 (P1, wiersz warstw nad domem w poziomie), A11Y-02/03/04,
BC-01/03/06/13, F2 (poziom), F4–F8, F10, PERF-01/02/03/06/08, A11Y-05/06/07/08/09, F11, BC-10/11, BC-07.
Pozostawione świadomie (poza zakresem albo wcześniejsze): PERF-04 (render co klatkę także w spoczynku — bateria),
PERF-05 (zmiana domu odtwarza silnik), PERF-07 (lista elementów nie-leniwa), PERF-09 (oddawany jest build debug —
jak wszystkie dotychczasowe dostawy, ten sam podpis), F9 (kolory adnotacji w panelu źródła poza `Theme.kt`),
F3 (kontekst u góry liczony jako pas na całą szerokość — po zmniejszeniu kontekstu do jednej linii zysk mały),
F12, BC-05 (nazwa „Cały dom” w dwóch panelach), BC-09 (suwak ukończenia w arkuszu etapów zapisuje po dotknięciu
— to świadoma edycja w arkuszu edycji; do decyzji OWNER-a).

**Na emulatorze** znalazłem jeszcze P-7 (ucięta elewacja) i znikającą etykietę „Model demonstracyjny” po zapisie
postępu — obie poprawione i sprawdzone ponownie na ekranie.

**Runda 2 (potwierdzająca, ze zrzutami przed/po)**: recenzja wykończenia na zrzutach, ponowny audyt poprawek rundy 1
i przegląd logiki stanów, każdy zestaw ustaleń sprawdzony przez sceptyka. Z rundy 1: 37 poprawek potwierdzonych,
dwie częściowe — dokończone. Nowe i potwierdzone, wszystkie poprawione w tym etapie:
- **R2-01 (P2)** w widoku równoległym zoom był zarazem odległością oka: przy dopasowaniu prostopadłościanu w szerokim
  polu oko długiego, niskiego domu widzianego od szczytu stało w środku domu, a płaszczyzna bliska ucinała przód.
  Teraz oko zawsze stoi poza sceną (obraz równoległy bez zmian). Test przyczyny w `ParallelViewFramingTest`:
  bez poprawki pada, z poprawką przechodzi.
- **R2-02** elewacja wybrana w poziomie po obrocie do pionu jest dopasowywana ponownie (sprawdzone na emulatorze).
- **R2-03/F2** inset osi zapisywany po zakończeniu przejścia, pierwszy pomiar zawsze (obrót w trakcie podglądu).
- **R2-04/F5** wybór warstwy zamyka panel Warstwy, a wiersz warstw zostaje przy otwartym panelu — szyna nie skacze pod
  kciukiem ani przy otwieraniu, ani przy zamykaniu (sprawdzone: etykieta „Parter” na tej samej wysokości).
- **F1** „Tylko parter” celowo zostawia dach garażu (stoi na kondygnacji parteru; dach zdejmuje „Przekrój” — tak
  opisuje to `VisibilityTest`), więc zdanie „Ukryto dach i poddasze” było nieprawdziwe. Zdanie jest teraz wyliczane
  z tego, co filtr faktycznie zdjął (`Visibility.hidden`): „Ukryto poddasze i dach nad nim”; test `HiddenLayersWordsTest`.
- **F3** sceny z galerii mają ten sam identyfikator modelu co dom pokazowy, więc zmiana postępu w scenie badawczej
  nadpisałaby zapis Marcówek. Sceny galerii są teraz tylko do podglądu (arkusz etapów mówi dlaczego).
- **F4** usunięcie uszkodzonego domu z ekranu błędu wraca do reguły startu.
- **F6** druga linia pod nazwą nigdy nie jest pusta („Z analizy linku”, „Scena z galerii deweloperskiej”).
- **R2-05** `DESIGN.md` zgodny z kodem.

Obalone: „nic nie stoi” nad pełnym domem po restarcie (zaległa klatka emulatora; po 180 s stan poprawny —
`final-11-restart-180s`), za duża stopka w pionie (w pionie dom jest ograniczony szerokością, stopka go nie zasłania),
etykieta w podglądzie, tytuł sceny galerii, galeria w menu (brief §1 każe ją tam umieścić). Zostaje (P3): dom w pionie
lekko na lewo od środka wolnego pola (dopasowanie środka rzutowanego obrysu — osobna poprawka kamery).

## 5. Weryfikacja

| Sprawdzenie | Wynik |
|---|---|
| Android JVM `testDebugUnitTest` | 492 testy, 0 błędów, 3 pominięte (baseline: 476 + 3 pominięte; nowe: `ShowcaseCatalogTest`, `ParallelViewFramingTest`, `HiddenLayersWordsTest`) |
| `assembleDebug`, `assembleDebugAndroidTest` (testy instrumentacyjne kompilują się; `ProductFlowDeviceTest` dostosowany) | zielone |
| `lintDebug` | 1 błąd i 39 ostrzeżeń, wszystkie sprzed etapu i poza zmienionymi plikami (błąd: fałszywy alarm `ProduceStateDoesNotAssignValue` w `DescribingPanel.kt:88`, którego etap nie dotyka; CI lintu nie uruchamia) |
| vitest `packages/mobile-scene` (parytet 127 scen z dyskiem, nowy `showcase.test.ts`) | 20 plików, 135 testów, zielone |
| `tsc -p tsconfig.json` | zielone |
| Eksport scen: bajty 127 plików | identyczne; zmienił się tylko `index.json` (+1 pole) |

**Przebieg na ekranie (emulator, §0)**: zimny start; aktualizacja z 1354 (migracja zapamiętanego domu); restart;
obrót gestem, zoom („Przybliż”), „Dopasuj”; cztery strony i dach z góry (przed i po poprawce kadrowania); bez dachu,
tylko parter, tylko poddasze i powrót „Pokaż wszystko”; wybór elementu (Balkon), szczegóły, powrót do całości;
podgląd etapu bez zapisu i „Wróć do projektu”; arkusz etapów i zapis „Ustaw jako aktualny”; restart po zapisie;
wybór sceny z galerii i jej przywrócenie po restarcie; pion i poziom; czcionka 1,3 w pionie i w poziomie.
Plansze przed/po: dostarczone osobno (`01-start-przed-po.png` … `07-kadrowanie-z-prawej.png`); spis 49 zrzutów
z SHA-256: `stage-reports/artifacts/marcowki-ui/SCREENS.txt`. Zrzutów nie ma w repozytorium (model odrysowany
z projektu wydawcy — jak w poprzednich dostawach).

Uwaga o emulatorze: Android 14 bez akceleracji CPU nie utrzymał serwera systemowego (watchdog); przebieg zrobiony
na Androidzie 10. Okno ANR „System UI” i pojedyncze białe/czarne klatki zrzutu to skutki emulacji, nie aplikacji.

## 6. APK

`BuildPlan-Model-Preview-1355-arm64-v8a.apk` (dostarczony osobno): versionCode **1355**, versionName `0.1355.0-owner`,
z commita `96173b3e` (`-PpreviewVersionCode=1355`), 56941637 B, SHA-256 `c14b4c393c6efb41aae20bad6642b197ac2052ee47ec0fc6c517765cba73595b`. Podpis: ten sam
certyfikat co 1354, SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (`apksigner verify`),
więc instaluje się jako aktualizacja. W APK: 127 scen; `assets/scenes/marcowki-c-v35414.scene.json` ma SHA-256
`680a3f4b…3a3023d47166` (zamrożone bajty), `index.json` = źródło. Wbudowany analizator jak w 1354 (nodejs-mobile 18.20.4).
Ten sam kod (build x86_64) uruchomiony na emulatorze z czystymi danymi: `final-12-release-build-clean-start`.
Zapis dostawy: `stage-reports/artifacts/marcowki-ui/DELIVERY.txt`.

## 7. Czego nie sprawdzono — do próby OWNER-a na telefonie

1. Aktualizacja 1354 → 1355 na Twoim telefonie: czy otwiera się „Dom w marcówkach” (jeśli wcześniej ręcznie
   wybrałeś inny dom wbudowany, zobaczysz dom pokazowy — tak ma być; dom z Twojej analizy linku zostaje).
2. Płynność obrotu, przesuwania dwoma palcami i szczypania (emulator nie ma wielodotyku).
3. Poziom na prawdziwym telefonie z gestami systemowymi lub trzema przyciskami — nagłówek i miarka w jednym rzędzie.
4. Android 14/15: wcięcia (edge-to-edge) i predictive back z galerii, menu i szczegółów.
5. Suwak ukończenia etapu w arkuszu: czy przewijanie listy etapów nigdy nie zmienia wartości przypadkiem.
6. TalkBack: wiersz warstw i „Pokaż wszystko”, galeria jako lista wyboru.

## 8. Otwarte

- Kominy Marcówek stoją przy „Tylko parter” (należą w modelu do kondygnacji parteru) — cecha modelu, nie UI; model
  zamrożony, bez zmian.
- Wiersz warstw i wiersz zaznaczenia podnoszą szynę narzędzi (szyna stoi nad szkłem osi) — zachowanie jak dotąd dla
  zaznaczenia.
- Kampania analizatora wstrzymana decyzją OWNER-a; kod, sceny i zapisy badań zachowane bez zmian, wznowienie możliwe
  od `ebaae1d2` / v3.54.21 (rekomendacje w `stage-reports/README_V35421.md`).
