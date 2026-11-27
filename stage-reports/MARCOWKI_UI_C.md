# BuildPlan — wariant C „Minimalny dok”: nowy układ, matowe szkło, duży dom — APK 1356

Etap: 2026-11-27, decyzja OWNER-a z tego dnia (wybór wariantu C, paczka `BuildPlan-UI-C-START.zip`:
`PROMPT_DLA_CLAUDE.md`, `REFERENCE_C.png`). Gałąź `claude/new-session-3kzcgh`, commity z `[skip ci]`, bez PR i bez
scalenia. Baseline: `d12d0f6c` (APK 1355). Krótko dla OWNER-a: `stage-reports/README_MARCOWKI_UI_C.md`.
Budżet płatnych żądań: **0 USD** — żadnego żądania do API ani hosta; badania analizatora wstrzymane.

**Weryfikacja na ekranie: na emulatorze, nie na telefonie.** Wszystkie zrzuty i nagrania pochodzą z uruchomionej
aplikacji na emulatorze Android 10 (API 29, x86_64, 720 × 1600 px, 280 dpi = 411 × 914 dp), bez akceleracji CPU
(TCG) i z programowym GPU. To prawdziwe UI tej aplikacji, ale płynność, szczypanie dwoma palcami i Android 14/15
trzeba sprawdzić na telefonie (§8).

## 1. Paczka i punkt zamrożony

- `MANIFEST.sha256` z ZIP-a C: wszystkie pliki zgodne. `REFERENCE_C.png` obejrzany (1536 × 1024).
- Model Marcówek `a66428c88135d1ad2d30678943acd0ea4746d4d2977b96a9b37d16f48759a0f5` i plik sceny
  `680a3f4bb731d77430c2c81db968f243076dcc65c2648dcda2348a3023d47166`: **identyczne na początku i na końcu etapu**
  (sprawdzone `sha256sum` i testem `showcase.test.ts`). Geometrii, pomieszczeń, otworów i materiałów nie ruszano.
- Jedyna zmiana zasobów sceny: wpis `marcowki-c-v35414` w `index.json` dostał pole `showcase.short = "Marcówki"`
  (krótka nazwa do pigułki domu; pochodzi z rejestru `scenes.ts`, nie z `if`-a w kodzie aplikacji).

## 2. Plan (krótko, jak poprosiłeś)

1. Tokeny C (mięta, matowe szkło, większe promienie, głębia, ruch) i siatka jako ustawienie widoku.
2. Ekran główny: pigułka domu, Dopasuj, ⋮, dok z dwoma kaflami; dom duży i wyśrodkowany.
3. Morph kafel ↔ panel (Warstwy, Etapy), przerywalny, bez skoku kamery.
4. Pozostałe konteksty (zaznaczenie, status, galeria, menu, arkusz wszystkich narzędzi), poziom, czcionka 1,3.
5. Dwie rundy porównania z `REFERENCE_C.png` i audyt, nagrania, testy, dokumentacja.

## 3. Co zrobiono

**Ekran główny (spoczynek).** Model na pełnym ekranie na spokojnym grafitowym tle (`MODEL_BACKGROUND` #12151A →
#1E2329, plus delikatna winieta rysowana przez Compose). U góry z lewej pigułka „⌂ Marcówki [Demo] ⌄” (otwiera menu
domów; pełna nazwa i opis są w menu), z prawej dwa okrągłe przyciski: Dopasuj i ⋮. U dołu dwa kafle: szerszy
„Cały dom ⌄” (nazywa warstwę widoczną TERAZ: „Bez dachu”, „Parter”…) i „Etapy” (procent tylko, gdy coś zapisano;
w podglądzie: znacznik podglądu, „Podgląd / Fundamenty” i ×, które wraca). Bez szyny bocznej, bez stałego panelu
postępu, bez paska nawigacji, bez osi pionowej, bez siatki CAD na starcie.

**Duży dom.** Kamera kadruje dom w tym, co zostawia chrom W SPOCZYNKU (pod nagłówkiem, nad dokiem). Nowe:
„cały dom” w perspektywie jest dopasowywany do narożników pudełek poszczególnych obiektów, a nie jednego pudełka
całego modelu, i **wyśrodkowany** (ognisko przesuwa się, aż rzut jest symetryczny). Marcówki są w kształcie L: puste
naroże dużego pudełka (taras z tyłu, za skrzydłem garażu) odpychało dom w lewo i zmniejszało go — w 1355 też.
Teraz dom zajmuje ok. 90 % szerokości w pionie i stoi na środku. To reguła ogólna (`OrbitCamera.frameWhole`),
bez wyjątku dla domu; widoki równoległe (elewacje, z góry) bez zmian.

**Warstwy** (kafel „Cały dom” rośnie w panel): cztery karty Cały dom / Bez dachu / Parter / Poddasze (te same filtry
co dotąd; wybrana: miętowa obwódka, poświata, ✓ i pogrubiona nazwa — nie sam kolor), pod nimi zdanie z filtra, co
ukryto („Ukryto dach i okna dachowe”) i „Pokaż wszystko”, dalej wiersz „👁 Widok · Perspektywa ⌄”, który nazywa
widok na ekranie („Własny kąt” po obrocie palcem) i rozwija jeden przewijany w bok rząd: Perspektywa, Z przodu,
Z tyłu, Z lewej, Z prawej, Dach z góry, Aksonometria. Wybór warstwy zostawia panel (zdanie jest odpowiedzią);
wybór widoku zamyka panel, bo odpowiedzią jest dom.

**Etapy** (kafel „Etapy” rośnie w panel): w nagłówku zapisany stan („2% · Zapisano 27 listopada 2026”) albo
„Postęp nieustawiony” — nic nie jest wymyślane; oś budowy (miarka składana, teraz miętowa), przesunięcie po osi to
tylko podgląd („Podgląd: Fundamenty — Tylko podgląd, nic się nie zapisuje” + „Wróć do projektu/teraz”), dalej lista
17 etapów otwieranych w miejscu. **Suwak ukończenia zastąpiłem krokami −5 / +5 i przyciskiem „Zapisz NN%”** (z
„Cofnij” i „Zapisane: X%” obok szkicu) — przewijanie listy nie może już nic przestawić ani zapisać. Menu „Etapy
budowy” i dawny link `STAGES` otwierają ten panel (jedno miejsce zamiast dwóch). Scena z galerii mówi w panelu, że
postępu się tu nie zapisuje.

**Ukryte logicznie, nie usunięte:** Przekrój, „tylko zaznaczony”, lista elementów, rzuty, schody/wejście,
przybliż/oddal, reset i wszystkie wyglądy są w ⋮ → „Wszystkie widoki, warstwy i wygląd” (jeden arkusz). Źródło
modelu w ⋮ i w menu domów. Rysunek domu z dawnego arkusza etapów nie jest już pokazywany (arkusz zastąpił panel).

**Siatka** „Siatka pod domem” w ⋮: wyłączona na starcie, zapamiętywana na telefonie (`ViewerState.grid`, renderer
dodaje/usuwa encję siatki; nic nie jest przesyłane ponownie).

**3D w spoczynku nie rysuje nic nowego** (nowość, poza samym UI, bo brief prosił o ograniczenie ciągłego renderu,
jeśli bezpiecznie): Filament dostaje klatkę tylko, gdy zmieniła się kamera, stan widoku, powierzchnia albo trwa
pick, plus 2 klatki zapasu na pacing. Callback co vsync zostaje (to on wykrywa zmianę); nie ma żadnej podmiany na
statyczny obraz — każda zmiana rysuje się od razu. Na emulatorze CPU aplikacji w spoczynku spadło do ok. 13 %, a
nagranie ekranu w spoczynku nie produkuje klatek (bo nic się nie zmienia). Licznik `framesIdle` w diagnostyce.

## 4. Jak działa szkło (i czego nie robi)

Każdy element nad 3D to `GlassSurface` / `Modifier.matteGlass`: miękki cień rysowany **tylko na zewnątrz** kształtu
(8 pierścieni o malejącej alfie, lekko w dół), półprzezroczysty grafit (`Glass` ~82 %; panel gęstnieje do
`GlassDense` ~92 % w trakcie morfu, żeby krawędzie domu nie biegły pod tekstem), połysk w górnej połowie, stałe
drobne ziarno (jedna kafelkowana bitmapa 96 px, 5 %), które daje mat, i jasna obwódka 1 dp u góry.

**Nie ma rozmycia tła.** Model rysuje Filament na własnym `SurfaceView` — osobnej warstwie składanej przez system pod
oknem. `Modifier.blur` w Compose rozmywa tylko zawartość okna, a okno nie może próbkować powierzchni pod sobą.
Prawdziwe rozmycie wymagałoby drugiego renderu sceny albo odczytu z GPU co klatkę — nie zrobiłem ani jednego.
Szkło jest statyczne: rysuje się tylko, gdy samo się zmienia; w spoczynku nie działa żadna pętla animacji.
Różnica z referencją: tam za szkłem widać rozmyty dom; u nas dom prześwituje jako przyciemniony kształt.

## 5. Morph kafel ↔ panel

Kafel i jego panel to jedna powierzchnia (`MorphSurface`): pozycja, rozmiar, promień narożnika (18 → 22 dp) i
gęstość szkła interpolują się od zmierzonego miejsca kafla do ramki panelu; słowa kafla znikają do 30 % drogi,
treść panelu wchodzi od 30 % (z 8 dp uniesienia) — dwa teksty nigdy nie dzielą szkła. Otwarcie 280 ms (emphasized
decelerate, bez overshoot), zamknięcie 220 ms; każdy krok zaczyna się tam, gdzie jest szkło, i trwa tylko część
czasu, która została — drugie dotknięcie w połowie zawraca od razu. Przełączenie Warstwy → Etapy najpierw zwija
otwarty panel do jego kafla, potem rozwija drugi (nigdy dwie tafle na sobie). Prostokąty są czytane przy każdym
układzie, więc obrót lub zmiana szerokości w trakcie przesuwa szkło, zamiast kończyć na starym prostokącie. Postęp
morfu czyta tylko układ i rysowanie: klatka morfu przelicza jeden węzeł i niczego nie rekomponuje. Panel łapie
dotyk na całej powierzchni; odsłonięte 3D dalej działa. Kamera nie rusza się przy otwarciu panelu (kadr = chrom w
spoczynku). Animacje systemowe wyłączone → wszystko przeskakuje bez ruchu (sprawdzone: otwarcie, przełączenie,
zamknięcie dają identyczne klatki końcowe).

**Przegląd ruchu.** Skill Emila Kowalskiego (`review-animations`) **nie jest dostępny w tej sesji** — nie
twierdzę, że Emil to przejrzał. Przegląd równoważny wykonałem według jego zasad z
https://emilkowal.ski/ui/great-animations i README https://github.com/emilkowalski/skills: wejście ease-out ✓
(emphasized decelerate), krócej niż 300 ms ✓ (280/220), przerywalne ✓ (Animatable, czas proporcjonalny do reszty
drogi), z miejsca pochodzenia ✓ (panel rośnie z kafla, wraca do niego), ograniczony ruch ✓ (przy skali 0 — cięcie;
Emil sugeruje raczej fade niż nic — zostawiłem cięcie, zgodnie z dotychczasową zasadą aplikacji), częstość ✓ (karty
i chipy nie animują się poza zmianą zaznaczenia). Odstępstwo świadome: morf animuje rozmiar (układ), nie tylko
`transform`/`opacity` — to istota container transform; koszt to jeden węzeł układu na klatkę, bez rekompozycji.

## 6. Dwie rundy porównania z `REFERENCE_C.png` i audyt

Referencja to ilustracja wygenerowana przez AI — nie odrysowywałem jej i nie podmieniałem modelu na bitmapę.
Porównanie dotyczy kompozycji, proporcji domu, ilości stałego UI, szkła, hierarchii, ciągłości i czytelności.

**Runda 1 (pierwsza działająca wersja na emulatorze) — usterki i poprawki:**

| # | Usterka (dowód) | Poprawka |
|---|---|---|
| R1-1 | Dom mały i przesunięty w lewo, martwe pole nad nim (r1/01 pierwsza wersja) | kadr po obiektach + centrowanie (`frameWhole`) |
| R1-2 | Szkło panelu za cienkie: krawędzie dachu biegły pod napisami (r1/02) | panel gęstnieje do `GlassDense` w trakcie morfu |
| R1-3 | 3 rzędy chipów widoku zakrywały dom; wybrany widok lądował pod panelem (r1/03, r1/04) | jeden przewijany rząd; wybór widoku zamyka panel |
| R1-4 | Kafel podglądu ucinał nazwę („Podgląd: Funda…”) (r1/08) | dwie linie „Podgląd / Fundamenty”, dok dzieli szerokość |
| R1-5 | W poziomie 4 karty w panelu 400 dp łamały nazwy („C…”, „Parte r”) (r1/15) | 4 w rzędzie tylko gdy panel ≥ 520 dp |
| R1-6 | Rząd chipów nie mówił, że jest dalej | wygaszenie na uciętej krawędzi (`fadePastEnd`) |
| R1-7 | „Siatka pod domem” wyłączona nie miała znaku stanu | słowo „wyłączona” / ✓ |
| R1-8 | Klatka co ~2 s na emulatorze (3D rysowane co vsync) | render na żądanie (§3) |

**Runda 2 (po poprawkach; plansza 06 obok referencji):** kompozycja, wielkość domu i ilość stałego UI są bliskie
referencji. Znalezione i poprawione: R2-1 dwa długie akapity w panelu Etapy przy nieustawionym postępie (skrócone
zdanie o osi), R2-2 martwa przerwa pod „Widać cały dom” (wysokość dotykowa tylko, gdy jest przycisk), R2-3 jeden
kolor wpisany poza `Theme.kt` (wypełnienie kart → `Palette.CardFill`). Audyt według listy Impeccable (native):
dostępność — etykiety i stany przez `stateDescription`, cele ≥ 48 dp, czcionka 1,3 bez ucięć, skala animacji 0 ✓;
wydajność — rekompozycja tylko na zmianę stanu, render na żądanie ✓; motyw — wszystkie kolory z tokenów ✓;
zgodność z platformą — Wstecz zamyka panel → szczegóły → zaznaczenie → wychodzi z aplikacji ✓, insety paska stanu
i nawigacji ✓; adaptacja — pion, poziom (panel obok doku, nigdy przez cały ekran), wąskie okno ✓.

**Odstępstwa od referencji (świadome):** brak rozmycia tła (§4); pigułka bez osobnej ikony domu w kółku; po otwarciu
panelu kafel, z którego wyrósł, zostawia puste miejsce (w referencji też widać tylko „Etapy” pod panelem); karty
mają ikonę obok nazwy, nie nad nią (niższy panel = więcej domu); w poziomie panel stoi obok doku.

## 7. Co sprawdzono na emulatorze (prawdziwa aplikacja)

Zimny start (czyste dane) → Marcówki duże, wyśrodkowane, bez siatki ✓ · aktualizacja z 1355 (`install -r` na
zainstalowanej 1355, ten sam podpis) ✓ · restart ✓ · Warstwy: wszystkie cztery, opis ukrytego, Pokaż wszystko ✓ ·
widoki z przodu, z tyłu, z lewej, z prawej, dach z góry — cały dom w kadrze (plansza 07) ✓ · Dopasuj ✓ · podgląd
etapu nic nie zapisuje, powrót z kafla i z panelu ✓ · jawny zapis (Ściany 40 %) przetrwał restart (plansza 08) ✓ ·
scena z galerii: odznaka „Galeria”, „Wróć do: Dom w marcówkach”, panel mówi, że postępu się nie zapisuje (plansza
09) ✓ · zaznaczenie elementu (pigułka nad dokiem) ✓ · menu ⋮, siatka, arkusz narzędzi, menu domów ✓ · pion i poziom
✓ · czcionka 1,3 ✓ · animacje wyłączone ✓ · Wstecz ✓ · dotyk na panelu nie obraca modelu ✓.
Galerię sprawdziłem na scenie „Mindelo” (nie na jednej z pięciu scen dzielących id modelu Marcówek — przewinięcie
listy 126 scen pod TCG było zbyt wolne); reguła jest wspólna dla wszystkich scen galerii (`developmentOnly` → bez
zapisu) i bez zmian od 1355, gdzie sprawdzono właśnie scenę ze wspólnym id.

**Ograniczenia emulatora:** brak multi-touch (szczypanie i przesuwanie dwoma palcami niesprawdzone); szybkie
`input swipe` zamieniają się w stuknięcia (przewijanie sprawdzone wolnymi gestami); nagranie w prawdziwym tempie ma
2–3 klatki na morf, dlatego dołączam drugie nagranie z animacjami systemowymi spowolnionymi 10× (oznaczone).

## 8. Testy i stan

- Android JVM: **502 testy, 0 błędów, 3 pominięte** (w tym 10 nowych w `MinimalDockTest`: geometria i czas morfu,
  przerwanie, wyłączone animacje, siatka jako ustawienie, `STAGES`/`TOOLS`, dom wyśrodkowany i wypełniający kadr,
  kształt L kadrowany ciaśniej). Dwa istniejące testy kadru mierzą teraz od faktycznego ogniska kamery
  (`ContentFrameTest`, `OrbitCameraTest`) — asercje „cały dom w kadrze, wypełniony do marginesu” bez zmian;
  `PresentationModeTest` przypina nowe tło #1E2329 (jedyna zmiana wyglądu MODEL).
- mobile-scene vitest: **138 / 138** (w tym `showcase.short`).
- `assembleDebugAndroidTest`: kompiluje się. Testy urządzeniowe (`ProductFlowDeviceTest` itd.) celują w UI 1355
  (szyna, oś u dołu) — nie były uruchamiane (`connected*` zabronione przez protokół) i będą wymagać aktualizacji.
- Lint: 1 błąd **sprzed etapu** (`DescribingPanel.kt:88`, fałszywy alarm `ProduceStateDoesNotAssignValue`, jak w
  1355), 38 ostrzeżeń (1355: 39); usunięte nieużywane napisy po starej szynie i osi.
- APK 1356 arm64: versionCode 1356, `0.1356.0-owner`, podpis `6e48fac4…ca0da` (ten sam co 1355), nie testOnly.

## 9. Otwarte

1. Telefon: płynność morfu w 60/120 Hz, szczypanie, Android 14/15 (Wstecz predykcyjny), nawigacja gestami.
2. Brak prawdziwego rozmycia za szkłem (ograniczenie architektury, §4).
3. Fokus TalkBack nie przechodzi sam na otwarty panel (P2).
4. Testy urządzeniowe do przepisania pod nowy układ.
5. Rysunek domu z dawnego arkusza etapów nie jest pokazywany (kod `HouseDrawing` został).
