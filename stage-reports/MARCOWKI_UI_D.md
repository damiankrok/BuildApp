# BuildPlan — runda D wariantu C: audyt siedmiu soczewek, ruch bez przesunięć, charakter, obrót domu — APK 1357

Polecenie OWNER-a (27 listopada 2026, po APK 1356): zrobić audyt i poprawiać wygląd, aż będzie dobry w użyciu i z sensem;
sprawdzić, czy przy dotknięciu kafle się transformują i czy nie przesuwa to innych elementów; czy jest płynnie i bez
migotania; dodać charakter, przejrzystość i przyjemność; np. włączany obrót domu, gdy go nie dotykamy; „zatrudnić agentów
do różnych audytów i wysnuć wnioski”, także o funkcjach na przyszłość.

Stałe ograniczenia rundy: model i plik sceny Marcówek bez zmian (hashe na początku i na końcu, §8), badania analizatora
wstrzymane, 0 USD płatnych API, żadnego udawanego rozmycia tła, renderer nie jest właścicielem prawdy semantycznej,
polskie napisy w `strings.xml`, cele dotyku ≥ 48 dp, stan nigdy samym kolorem, jedna warstwa szkła, wyłączone animacje
respektowane, w spoczynku żadnej animacji poza świadomie włączonym obrotem.

## 1. Jak pracowałem

1. **Siedem niezależnych audytów** (agenci, tylko do odczytu, na kodzie i prawdziwych zrzutach z emulatora): ruch i
   stabilność układu, charakter wizualny, użyteczność i architektura informacji, dostępność i adaptacja, renderowanie 3D
   i kamera, poprawność kodu, przyszłe funkcje. Razem **115 ustaleń i 80 pomysłów**.
2. **Weryfikacja adwersaryjna** każdego ustalenia P0–P2 przez osobnego agenta na aktualnym drzewie: 82 werdykty —
   32 już naprawione w trakcie, 31 częściowo, 19 otwartych, **żadne nie okazało się zmyślone**; kilka zaleceń poprawiono
   (np. „nie używaj `safeDrawing.exclude(ime)`, bo zeruje pasek nawigacji”, „nie przenoś odtwarzania do VM tylko dla
   jednej linijki”).
3. **Synteza** w plan rundy i mapę drogową, potem **krytyk kompletności**, który znalazł 15 poprawek do planu (m.in.
   wycieki stanu obrotu, spóźnioną wstawkę nagłówka, wyskakującą linię gruntu) — wszystkie rozpatrzone, §6.
4. **Przegląd adwersaryjny różnicy kodu** w czterech wymiarach (stan, Compose, renderer, dostępność), każde ustalenie
   z weryfikacją (§7).
5. Wdrożenie, testy JVM, lint, i sprawdzenie na prawdziwej aplikacji na emulatorze (`emulator-5570`, Android 10, TCG).

## 2. Najważniejsze wnioski z audytu (diagnoza)

C miało dobre kości — duży, wyśrodkowany dom, dwa kafle, prawdziwy morf — ale brakowało mu **sceny**: tło po niejawnej
krzywej ACES wychodziło #0F141A zamiast zamierzonego #1E2329, nie było cienia kontaktowego, więc dom wisiał w granatowej
próżni jak w programie CAD, a ciemne szkło czytało się jak płyty z obwódką. **Przejrzystość** psuły panele: Etapy na
62 % wysokości zasłaniały dom, który miały cofać w czasie; widoki siedziały w panelu „Warstwy” za rozwijanym wierszem;
Dopasuj nie miało drogi do całego domu; kafel nie mówił, na jakim etapie jest budowa. **Przyjemność** zabijały
przesunięcia i migotanie: szkło morfu przechodziło przez drugi kafel, szerokość kafli zależała od etykiet (przy czcionce
1,3 kafel Etapy przesuwał się o 14 px po zmianie warstwy), linia „Ukryto…” podnosiła panel, a pigułka statusu i
klawiatura przesuwały ramkę i kamerę.

## 3. Co zrobiono

### 3.1 Kafle transformują się, nic innego się nie rusza

- **Dok to czysta arytmetyka okna** (`DockLayout.of`): dwa równe pola, ich miejsce zależy wyłącznie od rozmiaru okna —
  nie od etykiety, otwartego panelu, zaznaczenia ani klawiatury. Test JVM sprawdza, że te same dane dają ten sam układ.
- **Morf etapowy LIFT → GROW** na krytycznie tłumionych sprężynach: kafel najpierw unosi się pionowo w swojej kolumnie,
  dopiero potem rośnie w panel; nigdy nie przechodzi przez sąsiedni kafel (test omiata 400 kroków w czterech oknach,
  pion/poziom/tablet). Prędkość przenosi się przy odwróceniu w połowie. Treść panelu pojawia się dopiero przy 93 % wzrostu
  (nigdy nie widać przyciętych słów), dotyk i TalkBack dopiero od 95 %.
- **Wstawki bez klawiatury**: dok, ramka domu i kamera ignorują klawiaturę; tylko otwarty panel unosi się nad nią.
- **Wstawki nagłówka i doku z arytmetyki** (nie z pomiaru po fakcie): poprawny kadr od pierwszej klatki, ujęcie wejścia
  ląduje na właściwym domu, obrót telefonu przelicza kadr raz.
- **Panel szczegółów mierzony rozmiarem**, nie pozycją wysuwanego arkusza: kamera nie goni arkusza klatka po klatce,
  a workspace nie rekomponuje się co klatkę animacji.
- Pigułka zaznaczenia i podpowiedź znikają w 90 ms, zanim urośnie szkło; zanikanie chromu modulowane (bez bufora
  przycinającego cień szkła — źródło mignięcia krawędzi).

### 3.2 Charakter i przejrzystość

- **Scena 3D**: miękki cień kontaktowy pod domem (8 pierścieni obrysu, ok. 45 % przy ścianie, zero 1,4 m dalej; tylko w
  widoku „Model” i tylko gdy coś stoi na ziemi), jawna krzywa tonów (ACES legacy nazwana w `ColorGrading`), tło
  ≈ #222B36, pełna rozdzielczość w spoczynku (wyłączona dynamiczna rozdzielczość — ostatnia klatka nie jest już
  rozmyta), cienie bez „pływania” (LiSPSM wyłączony, mapa 2048), linia gruntu pod elewacjami (wyłania się w ostatnich
  5° do poziomu, bez wyskakiwania).
- **Zaznaczenie miętowe** jak reszta interfejsu: własne krawędzie elementu w mięcie i delikatna poświata, która zostawia
  światłocień (wcześniej niebieska emisja spłaszczała dach w jedną plamę); pudełko tylko dla elementu bez krawędzi.
  Podłogi pokoi z turkusu na neutralny ciepły szary (turkus czytał się jak zaznaczenie).
- **Kafle mówią dwa zdania**: „Widok / Cały dom” (albo „Z tyłu · Bez dachu”) i „Etapy / 40% · Ściany” (liczba
  pierwsza, więc wielokropek tnie nazwę, nie liczbę), „Ostatni: Dach”, „Nieustawione”. Strzałka obok podpisu.
- **Jeden panel „Widok”**: cztery karty warstw i zawsze widoczny rząd widoków (także rzuty parteru i poddasza).
- **Etapy otwierają się nisko, od osi** — cały dom zostaje widoczny; „Odtwórz budowę” (przegląd etapów po 750 ms,
  przerwany dowolnym dotknięciem, nigdy nie zostaje „zawieszony” na etapie), „Ustaw etap budowy”, lista na życzenie.
  W liście: „Zakończ i zacznij: <następny>” jednym ruchem, szybkie 0/25/50/75/100 %, „Anuluj”, krótka podpowiedź tylko
  przy 100 %.
- **Szkło** jaśniejsze, z fazą u góry i linią styku, krycie 88 % (kontrast 4,5:1 nad każdym tłem), jaśniejszy szary
  tekst na szkle kafli; „Demo” jako miętowa plamka zamiast obwódki; zielone znaczniki wyboru w arkuszach; ciemny pasek
  nawigacji pod arkuszami.
- **Dopasuj dwustopniowe**: pierwszy dotyk kadruje to, co widać (także samą widoczną część przy warstwie lub etapie),
  drugi wraca do całego domu (wszystkie warstwy); ikona zmienia się z ramki na domek.

### 3.3 Obrót domu i przyjemność z dotyku

- **„Obracaj dom, gdy go nie dotykam”** (menu ⋮, domyślnie wyłączone, zapamiętane): po 5 s bez dotyku kamera ustawia
  się tak, by cały dom mieścił się przy każdym kącie (wokół środka najmniejszego okręgu obejmującego dom — dom nie
  „ucieka” na bok), i obraca 6°/s z łagodnym startem; po 5 minutach łagodnie staje. Startuje tylko z widoku całego domu
  (nie z przybliżenia czy zaznaczenia — menu mówi wtedy „Ruszy z widoku całego domu”). Nie działa przy otwartym panelu,
  arkuszu, szczegółach, menu, pod palcem, przy wyłączonych animacjach, z TalkBack, w oszczędzaniu baterii, na gorącym
  telefonie i gdy nic nie stoi; wiersz menu mówi dlaczego. Rysuje najwyżej 30 klatek/s i prosi ekran o 30 Hz.
  Dotyk, który go zatrzymuje, tylko zatrzymuje (nie zaznacza i nie jest połową podwójnego dotknięcia).
- **Tryb salonu**: po 6 s obracania chrom przygasa do 20 %; pierwszy dotyk tylko go budzi.
- **Rozpęd** po szybkim przesunięciu: dom obraca się dalej i łagodnie staje (dokładnie, niezależnie od liczby klatek).
- **Szczypanie przybliża do palców** (punkt pod palcami zostaje pod nimi). **Podwójne dotknięcie obok domu** = Dopasuj.
  Pochylenie zatrzymuje się 10° pod poziomem (nigdy spod płyt).
- **Dotyk czuć**: karty i chipy „przysiadają” do 96 % pod palcem (bez ruchu sąsiadów); zapis etapu kończy się krótkim
  potwierdzeniem haptycznym (tylko gdy zapis się udał).
- **TalkBack**: akcje na widoku 3D (obróć w lewo/prawo, spójrz z góry/z boku, przybliż, oddal, Dopasuj, Odznacz),
  grupy wyboru dla kart i chipów, przełączniki w menu jako przełączniki, bez podwójnego czytania.

## 4. Mapa funkcji na przyszłość (wnioski z audytu „przyszłość”)

Teraz (zrobione w tej rundzie): obrót z trybem salonu, rozpęd, przybliżanie do palców, linia gruntu, dwustopniowe
Dopasuj, „Zakończ i zacznij”, odtwarzanie budowy, potwierdzenia haptyczne.

Następne (małe/średnie, w granicach reguł): „Odtwórz budowę” jako moment doku (kafel staje się odtwarzaczem, cały dom
widoczny); „Przytrzymaj, by porównać” (podgląd etapu ↔ teraz); notatki do etapów na istniejącym `setNote`; chipy pory dnia
(Dzień · Ciepło · Zmierzch — istniejące wyglądy COZY/DUSK); „Udostępnij widok” (zdjęcie domu z podpisem z zapisanych
danych); przewidywany gest Wstecz sterujący morfem; pigułka zaznaczenia rosnąca w szczegóły; tryb „Pokaż dom”; wyczuwalne
zatrzaski na elewacjach i kompas fasady; wyróżnienie etapu „w toku”; „Historia budowy” (dziennik zapisów); kopia i
eksport postępu (decyzja OWNER-a); etykiety pokoi w 3D; płynne przejście perspektywa ↔ rzut.

Później: widżet na ekran główny, słońce/pora dnia/północ z „łapaczem cienia” (wymaga kompilatora materiałów), dziennik
zdjęć przypiętych do etapów i elementów, pomiar, spacer po wnętrzu, AR na działce, terminy i przypomnienia, koszty na
etap w przestrzeni „Koszty”, świadomość składanych telefonów.

Czego świadomie nie robimy: rozmycia tła, zmiany modelu, kamery ruszającej się przy otwarciu panelu, zamiany krzywej
tonów (zmieniłaby wygląd całego domu), siatki gruntu jako arkusza, „ducha” pozostałej pracy w domyślnym podglądzie,
nowych zależności, backendu i płatnych API.

## 5. Ruch i migotanie — jak sprawdzone

- **Pomiar pozycji** (uiautomator, prawdziwa aplikacja): przed i po każdej akcji porównałem prostokąty wszystkich
  elementów. Zmiana warstwy w otwartym panelu: zmienia się tylko tekst linii „Widać cały dom” → „Ukryto dach i okna
  dachowe” (ten sam prostokąt) i pojawia się „Pokaż wszystko” w stałym miejscu; karty, chipy, nagłówek i kafel Etapy
  bez zmian co do piksela. Zamknięcie panelu: na kaflu „Cały dom” → „Bez dachu”, ten sam prostokąt [99,1443][332,1478].
  Zaznaczenie elementu: dochodzi tylko pigułka nad dokiem; kafle bez zmian. Podgląd etapu: zmienia się tylko linia w
  panelu; po zamknięciu kafel Etapy pokazuje „Podgląd / Fundamenty” z × w tym samym prostokącie.
- **Klatki morfu spowolnione 20×** (`10-morph-klatki-20x.png`, `morph-spowolniony-20x.mp4`): Widok zamyka się do swojego
  pola (treść znika w pierwszych klatkach), Etapy unosi się w swojej kolumnie, potem rośnie; drugi kafel, nagłówek i dom
  stoją; treść Etap pojawia się dopiero w pełnym szkle — żadnej klatki z dwoma tekstami ani przyciętych słów.
- **Testy JVM** pilnują reguł: ścieżka szkła nie przecina drugiego kafla w czterech oknach (400 kroków), dok jest
  funkcją samego okna, sprężyny nie przestrzeliwują i otwierają się w 200–600 ms, słowa kafla i panelu nigdy razem.
- Usunięte źródła drgań: etykieta zmieniająca szerokość kafli, pomiar nagłówka po fakcie (kadr poprawiany w drugiej
  klatce), klawiatura w ramce, kamera goniąca wysuwany arkusz, rekompozycja nagłówka co klatkę ruchu kamery, cień szkła
  ucinany w trakcie zanikania, karta warstwy zmieniająca wysokość po wyborze (pogrubiona etykieta), dynamiczna
  rozdzielczość (ostatnia klatka miękka), LiSPSM (cienie pełzające przy obrocie).

## 6. Uwagi krytyka i co z nimi zrobiono

Krytyk kompletności (15 punktów) — przyjęte: jedno zakończenie obrotu dla każdej blokady (salon nie zostaje włączony),
przerwanie ruchu „ustawienia” przy otwarciu panelu, dotyk zatrzymujący obrót nie jest połową podwójnego dotknięcia,
wstawki chromu z arytmetyki (ujęcie wejścia i obrót telefonu bez poprawki w drugiej klatce), wstawki podawane przez
`snapshotFlow` (bez rekompozycji co klatkę), linia gruntu wyłaniająca się w ostatnich 5° (bez skoku), ikona Dopasuj
mówiąca, co zrobi, nazwa widoku na kaflu, plan traci nazwę po zmianie warstwy, podłogi pokoi z turkusu na szary,
rozpęd przyjęty (z testami i regułami), ciepły telefon i pusty etap wstrzymują obrót, 30 Hz w czasie obrotu,
pochylenie do −10°. Odłożone: płynne przejście perspektywa ↔ rzut (zmiana `OrbitPose` — następna runda), przewidywany
gest Wstecz sterujący morfem, fokus TalkBack przenoszony na otwarty panel (do sprawdzenia na urządzeniu).

## 7. Przegląd kodu (cztery wymiary, każde ustalenie zweryfikowane)

Potwierdzone i naprawione: zegar obrotu liczony od rzeczywistego startu (po długiej blokadzie obrót nie rusza od razu
pełną prędkością ani nie kończy się natychmiast), `home` przeliczany przy każdej zmianie przestrzeni, stan dotyku i
manipulacji czyszczony, gdy gest zostanie przerwany (obrót telefonu z palcem na domu), poślizg zatrzymywany przy
powrocie do aplikacji i zmianie domu, każda blokada obrotu nazwana w menu (także „telefon jest ciepły” i „widok
równoległy”), szczegóły w poziomie nie ściskają domu (kolumna ustępuje), pigułka statusu nie leży pod wysokim panelem,
oś etapów nie reaguje na niegotowy panel, „przysiad” kart wewnątrz węzła dotyku (cel się nie zmniejsza), Wstecz
listy etapów tylko w aktywnym panelu, cień kontaktowy tylko gdy pokazane obiekty pokrywają ≥ 80 % obrysu (nie ma
„ducha” ukrytych części), dach pod pokryciem zachowuje ramkę zaznaczenia, linia gruntu tylko wzdłuż krawędzi
zwróconej do kamery, grupa wyboru dla szybkich procentów, słowa „włączona/wyłączona” zgodne z rodzajem „Siatka”,
przyciski z dwoma wierszami zamiast obcinania nazwy etapu. Odrzucone przez weryfikatorów: 6 (już naprawione lub
nieprawdziwe). Pozostawione świadomie: cień panelu Etapy nachodzący na górną krawędź kafla Widok (kosmetyka),
zegar ścienny zamiast monotonicznego (spójnie w całej aplikacji).

## 8. Testy, emulator, hashe

- Model Marcówek `a66428c8…59a0f5` i plik sceny `680a3f4b…d47166`: **identyczne na początku i na końcu**; scena w APK
  1357 ma ten sam hash.
- Android JVM: **518 testów, 0 błędów, 3 pominięte** (nowe: `TurntableTest` 4, `ContactShadowTest` 4,
  `OrbitInertiaTest` 2, `PinchZoomTest` 2, `MinimalDockTest` przepisany na ścieżkę etapową i sprężyny, `CameraGestureTest`
  +2 dla rozpędu; `HouseLooksTest` wymusił krycie szkła 88 %, żeby szary tekst miał 4,5:1 nad każdym tłem).
- Lint: 1 błąd **sprzed etapu** (`DescribingPanel.kt:88`, jak w 1355/1356), 38 ostrzeżeń (1356: 38); usunięte napisy,
  których nic już nie używało.
- Emulator (`emulator-5570`, Android 10, TCG, programowe GPU): start, Widok i warstwy, Etapy i podgląd, zaznaczenie,
  elewacja z linią gruntu, poziom (spoczynek, Etapy, lista), czcionka 1,3, obrót domu (start po 5 s, wyśrodkowany,
  tryb salonu, dotyk zatrzymuje bez zaznaczenia), klatki morfu 20×. Sesja emulatora zakończyła się po 2 godzinach
  (limit zadania w tle); **ostatnie poprawki z przeglądu kodu** (zegar obrotu, linia gruntu wzdłuż jednej krawędzi,
  pokrycie cienia, przyciski dwuwierszowe, Wstecz w liście) są sprawdzone testami JVM i przeglądem, nie ponownie na
  emulatorze.
- APK 1357 arm64: versionCode 1357, `0.1357.0-owner`, podpis `6e48fac4…ca0da` (ten sam co 1355/1356), nie testOnly.

## 9. Otwarte

1. Telefon: płynność morfu, obrotu (30 Hz) i rozpędu w 60/120 Hz; szczypanie; Android 14/15 (Wstecz predykcyjny).
2. Płynne przejście perspektywa ↔ rzut (jedna klatka zmiany rzutu w połowie ruchu do elewacji).
3. Fokus TalkBack nie przechodzi sam na otwarty panel; akcje TalkBack na widoku 3D są, opis stanu widoku jeszcze nie.
4. Testy urządzeniowe wciąż celują w UI 1355 i wymagają przepisania (`connected*` zabronione protokołem).
5. Brak prawdziwego rozmycia za szkłem (ograniczenie architektury, bez zmian).
