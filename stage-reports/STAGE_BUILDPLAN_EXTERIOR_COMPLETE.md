# STAGE BUILDPLAN EXTERIOR-COMPLETE — rozpoznawalny cały dom (raport roboczy)

Status: **WORK_IN_PROGRESS.** Kryterium odbioru nie jest spełnione (§3); kampania trwa. Ten raport opisuje stan po
dostawie testowej 1319 i jest aktualizowany przy kolejnych dostawach. Dziennik punktów kontrolnych:
`stage-reports/EXTERIOR_COMPLETE_LOG.md` (E0–E12).

## 1. Zamrożona ocena (przed strojeniem)

- **DEV 13** (każdy w mianowniku, także bez modelu): Arlety 3 E OZE, Jabłonki 22, Miniaturka 2 v3, Willa Maja R2,
  Dalie 5 GE, Azalie 3, Bratki 26 R2BE, Pod Miłorzębem 21 GB, Modrzewnica 10 G2E OZE, Muraje, Lipienniki 5, Aurory 26 G,
  Kostrzewy 4.
- **Regresja 8**: a01, arganiach, ciesz, gozd, marcowki, rary, sasankach3, trytomach.
- **Holdout H2** (zapieczętowany, nieotwarty): 6 domów; **H3** w rezerwie. Nazwy w dzienniku.
- Listy elementów ze źródeł: `stage-reports/artifacts/exterior-complete/source-elements.json` (90 pozycji, 13 domów);
  postać sprawdzalna: `expectations.json`; sprawdzarka: `research/exterior-complete/check.py`.
- Korekta sprawdzarki (E3, jawna): słupek to każdy słupek nośny (`POST`, `COLUMN`, `PERGOLA_POST`), a słupki i zadaszenia
  ocenia się po stronie, jak balkony. Pierwsza wersja nie liczyła pergoli w ogóle. Żadna tolerancja nie została
  poluzowana.

## 2. Co zmieniono (przyczyny, nie domy)

| zmiana | pierwsza zła decyzja | gdzie |
|---|---|---|
| Okno/brama/drzwi po licu otworu na elewacji; brama segmentowa | szeroki otwór na parterze zawsze szkłem | `opening-reading.ts`, `fills.ts` |
| Rolety ≠ płyta: lico zmienia ton co kilka wierszy → nie płyta | szkło za żaluzją czytane jako drzwi | `openingFace` |
| Jedna roleta dachowa na obrys na połaci | dwa odczyty jednego okna dachowego | `reconstruct-v2.ts` |
| Linia wymiarowa przesłonięta (logo) łączona | 1020 wiązane z 412 px zamiast 660 | `dimension-lines.ts` 1.3.0 |
| Najwyższa rzędna odrzucona jako kalenica, gdy publikowana wysokość i rysunek przekroju mówią, że nad nią stoi dach | +5,50 (okap) brane za kalenicę | `roof-datum.ts`, `section-datums.ts` |
| Pionowe etykiety: arkusz ma jeden kierunek tekstu (reguła vii, zależna od skali drugiej osi) | 740 bez kierunku | `metric-solution.ts` 1.5.0 |
| E4: wykończenie ścian per kondygnacja (pasy pod okapem i spadkiem okapu, maski balkonu i niższej bryły) | ton parteru na całą bryłę | `tones.ts`, `emit.ts` |
| E5: elewacja rysuje parę (segment w pełnym kontraście, sąsiad wyblakły) → rejestrowana połowa segmentu | elewacje frontu i tyłu odrzucone, otwory z rzutu | `twin-elevation.ts` |
| E5: skrzydło drzwi z wąską szybą i klamką — kolumny bez zmian w dół = jedno skrzydło | drzwi wejściowe jako okna do podłogi | `opening-reading.ts` |
| Wnęka wejściowa z pustym otworem: cały otwór testowany jako jedna wnęka (zwroty + ściana cofnięta) | ganek zabudowany jako pokój z oknem 4 m | `compound-facade.ts` 1.1.0 |
| Komórki ganku (≤ 2 m głębokości) przed ścianą cofniętą należą do wnęki | ganek obcięty, drzwi zgubione | `plan-decomposition.ts` |
| Otwory ściany cofniętej czytane na elewacji tej ściany | wysokości przyjęte | `reconstruct-v2.ts` |
| Okna balkonowe za balustradą: zarys balkonu w rzucie + balustrada na elewacji | balkon nigdy nie próbowany | `projecting-balcony.ts` |

Wersje: usługa 1.8.0, solver 2.24.0 (E5; dostawa 1315 ma 2.22.0), czytnik metryczny 1.6.0.

## 3. Wynik na zamrożonej ocenie

Sprawdzarka mierzy tylko część listy (kierunek kalenicy, rodzaj dachu, brama, wejście, okno frontowe, balkon, balustrada,
lukarna, zadaszenie, słupki, skrzydło, okna dachowe, kominy); odbiór wymaga całej listy i oceny wzrokowej.

| przebieg | wynik |
|---|---|
| E0 (kod 80d5612) | 25/70, 4/13 bez modelu |
| SHAPE-LIVE-01 (finał, ta sama sprawdzarka) | 26/70 |
| E3, pełna ścieżka produkcyjna, commit `845b13a` (dostawa 1315) | **32/70**, 2/13 bez modelu |
| E4 (wykończenie per kondygnacja, ten sam dowód) | 32/70 (sprawdzarka nie ocenia wykończeń) |
| E5 (para bliźniacza, skrzydło z listwą; korekta balustrady w sprawdzarce) | **35/70** (PRZED 26 i f2 32 bez zmian po korekcie) |

Per dom przy `845b13a`: Miniaturka 5/6 (zadaszenie), Pod Miłorzębem 0/6 (brak modelu), Arlety 4/5 (okna dachowe),
Aurory 1/5, Azalie 3/5, Bratki 1/5, Dalie 2/7, Jabłonki 5/7, Kostrzewy 1/4, Lipienniki 3/4 (kominy), Modrzewnica 0/6
(brak modelu), Muraje 1/4, Willa Maja 6/6.

**Kryterium odbioru: NIE.** Otwarte przyczyny (wszystkie domy w mianowniku):
- Pod Miłorzębem i Modrzewnica — brak modelu (skala rzutu nierozstrzygnięta / brak ramy wymiarowej);
- Muraje — głębokość 6,63 m zamiast 7,40 (740 odrzucone przy założonej izotropii), drzwi i brama w narożnym wcięciu pod
  piętrem nieczytane;
- Bratki — para bliźniacza zarejestrowana (E5), drzwi i balkon są; zostaje cienkie szklane zadaszenie nad drzwiami;
- zadaszenia wejść (Azalie, Bratki, Dalie, Miniaturka, Modrzewnica) — brak czytnika;
- okna dachowe (Arlety, Aurory, Azalie, Dalie) — pierścienie nieodczytane lub błędnie odczytane (bramka OCR);
- Aurory — kierunek kalenicy (wznios pasuje do obu rozpiętości, gdy rzędna okapu jest na krawędzi okapu);
- kominy (Lipienniki, Kostrzewy), skrzydła (Jabłonki, Dalie, Modrzewnica), lukarny (Jabłonki, Miłorząb);
- Kostrzewy — środkowy otwór w ścianie ganku czytany jako szkło (to drzwi);
- paleta ze źródeł — niezaimplementowana (kolory domyślne).

## 4. Testy

Nowe testy przyczyn: `exterior-complete-openings`, `occluded-line-exterior-complete`, `section-top-datum-shape-live-01`
(niska połać i publikowana wysokość), `metric-solution` (kierunek arkusza), `recessed-entrance-exterior-complete`,
`balcony-behind-balustrade-exterior-complete`, `storey-tones-exterior-complete` (E4), `twin-elevation-exterior-complete` (E5). Wyniki pełnego zestawu: §5.

## 5. Regresja, APK, prywatna dostawa

**Regresja 8** (pełna ścieżka przy `845b13a` wobec finału SHAPE-LIVE-01, tablice PRZED/PO obejrzane obok źródła):

| dom | zmiana | ocena |
|---|---|---|
| marcowki, trytomach | identyczne | — |
| ciesz | okap 3,32 → 3,30 | bez znaczenia |
| arganiach | jedno okno → drzwi | do sprawdzenia przy następnej dostawie |
| gozd | 4 okna → drzwi, wysokości z opisów (2,2/2,3 m) | zgodne z opisami |
| rary | front 105/210: drzwi → okno do podłogi | wiarygodne: render pokazuje szklany panel obok drzwi |
| sasankach3 | okap 3,69 → 4,04, brama segmentowa | PO bardzo podobne do PRZED, brama zgodna ze źródłem |
| a01 | okap 4,87 → 4,68; okna szczytu i tyłu jak na elewacjach | lepiej; **ale cały dom szary** → przyczyna E4 |

**E4 — wykończenie per kondygnacja** (pierwsza zła decyzja z tablicy a01): ton parteru był malowany na całą bryłę.
Teraz każda kondygnacja jest czytana w swoim pasie (szczegóły w dzienniku E4); wynik na tym samym dowodzie: a01 białe
poddasze nad szarym parterem, Muraje szare piętro nad białym parterem, Sasanki jasnoszary szczyt (0,75 bieli renderu)
nad białym parterem, pozostałe 18 domów bez zmian w ścianach. Trzy odrzucone wersje pośrednie — w dzienniku.

**Testy** (pełny vitest): poza testami przyczyn wszystkie czerwone są bazowe i wymienione osobno — architektura 11
(compound-facade 1: dodatkowa liczba `4` istniała już przy `357b615`; reference 2; research-isolation 4; wall-strip 4),
analyzer-api 4 (snapshot kontraktu Android, `/health`, worker ×2), local-analyzer 2 (Larchfield, NFD). Sliverton
(`wall-recovery-n7-fix01`) był czerwony od E1 (indeks polecenia 21 → 22 przez materiał bramy) — przeoczony w E3,
poprawiony w E4 z tym uzasadnieniem. Typecheck zielony. Testy jednostkowe Androida nieuruchamiane w tym kontenerze.

**APK 1315** (dostawa testowa, commit `845b13a`):
- `BuildPlan-owner-preview-1315.apk`, `com.buildplan.preview`, versionCode 1315, `0.1315.0-owner`, arm64-v8a,
  49 417 683 B, SHA-256 `1e2a93c7ba8e9789487b186d0b2b9ac810cfcabfb7449ac5aad314c77c969745`;
- podpis `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (ten sam co 1314);
- wbudowany analizator `analyzer.mjs` `6b6b671b97272d8c298e8481f5604f10df7075e6f19a72eca9d9a85dfce7ec0e`, usługa 1.8.0,
  solver 2.22.0, protokół 3; 10/10 plików manifestu zgodnych.
- Próba na żywo na zasobach APK (Muraje, strona na żywo; host Node 22 x64, **nie telefon**): pierwszy arkusz 13,9 s,
  koniec 314 s, 129 zdarzeń, 32 arkusze, 121 kopii zweryfikowanych po SHA-256, 0 niezgodnych, kopie usunięte; hash
  modelu `db38772602a0828a` = bieg desktopowy; szczyt RSS 888 MB (host).
- **Interfejs Androida: NOT_VERIFIED** (brak urządzenia). Czasy telefonu niezmierzone.

**APK 1316** (dostawa testowa z E4–E5, commit `53d49021893580fc92b8603d1ab4f05bd1feb1cf`):
- `BuildPlan-owner-preview-1316.apk`, `com.buildplan.preview`, versionCode 1316, `0.1316.0-owner`, arm64-v8a,
  49 419 503 B, SHA-256 `2feb7e8e5067ecff3dcc4efc5448edc14f3758a9b09b081410f99e77d4d3f72f`; ten sam podpis;
- analizator `analyzer.mjs` `8c275584d5f84193baa998796a6facb34ce83bafdb9a7ea0acf92fbbbb7675e9`, usługa 1.8.0,
  solver 2.24.0; 10/10 plików manifestu zgodnych;
- próba na żywo (Bratki, host Node x64, **nie telefon**): pierwszy arkusz 13,4 s, koniec 281 s, 116 kopii
  zweryfikowanych, 0 niezgodnych, hash modelu = bieg desktopowy; szczyt RSS 868 MB (host);
- sprawdzarka 35/70; prywatny ZIP 1316: 798 plików, SHA-256 `0ec3138e…d5fbfe`.

**Prywatna dostawa 1315** (poza Git i publicznym CI): `BuildPlan-EXTERIOR-COMPLETE-Private-1315.zip`, 792 pliki,
SHA-256 `e3754813cd7d959cea78f676f42e1d0dd6faff0a5874626de548d27bbf328cbe` — oryginały z hashami, listy elementów,
odbiór per dom (PRZED/PO), modele i `program.json` PRZED/PO, rendery wszystkich stron i tablice, manifest, dowody
próby na żywo i ograniczenia.

**Holdout H2**: zapieczętowany, nieotwarty — rozwiązanie jeszcze nie jest stabilne.

## 6. Bakopy (G2E) — przypadek ujawniony przez OWNER-a (DEV, nie ślepy test)

- PRZED odtworzony kodem 1316 z własnego pobrania strony, pełna ścieżka (klasyfikator treści + lokalny OCR): model
  `e2c66cca…f63d`, bajt w bajt jak przebieg koordynatora. Lista cech źródłowych:
  `stage-reports/artifacts/exterior-complete/source-elements-bakopy.json` (spisana z oryginałów przed poprawkami).
- **Pierwsza zła decyzja:** reguła bramy (`shutGateBays`) nie zważyła garażu w ogóle. Ściana tylna garażu stoi za
  rzędem szaf wnękowych, których front jest linią siatki; reguła czytała ścianę tylko na krawędziach komórek (27 %)
  i pomijała garaż bez śladu. Poprawki ogólne (layout 1.4.0, solver 2.25.0): ściana za okładziną szaf (≤ 0,9 m),
  drzwi w tej ścianie jako dowód bramy, symbol pierścienia otworu w wylocie (cyfry nieczytelne — sam symbol), koniec
  dzielenia garażu i skrzydła na pas przez pokoje. Wersja pośrednia (węgary szerokiego wylotu zawsze z tuszu) zmieniła
  wiatę z testu 005F w garaż — odrzucona.
- **Wynik PO:** garaż 6,82 × 6,25 m (drukowane 690 × 625) z bramą segmentową 4,86 m (drukowane 500), drzwi wejściowe
  obok, bryła główna 8,69 × 15,00, skrzydło 6,23 × 8,60 (640 × 860). Regresja: 19 domów bez zmian (hash modelu).
- **Jeszcze nie:** dach główny nad garażem i dojściem, dach dwuspadowy skrzydła ze szklanym szczytem, słup i ekran
  lamelowy dojścia, pergola tarasu, kominy, okładzina drewniana szczytów. Przyczyna dachów ustalona (kotwica dachu
  na widokach bocznych czyta korony drzew za dachem) — następny krok.
- **APK 1317** (`cf6a8d9`): SHA-256 `6388302f…6b97`, analizator `848937d0…b238`; ścieżka osadzona na żywej stronie
  Bakop daje model identyczny z desktopowym PO (`7c1acde7…fa91`). Interfejs Androida: NOT_VERIFIED.
- **E9 / APK 1318** (`a79bcea`, SHA-256 `34bc9bb2…5505`, analizator `faafc789…9ab7`, solver 2.26.0, czytnik 1.7.0):
  - FIRST_BAD dachów: korony drzew (oliwkowe i prawie czarne) i niebo między nimi brane za szczyt bryły na obu widokach
    bocznych; teraz tło = roślinność i niebo za nią (`elevation-background.ts`), ciemny dach, kominy i szczyty zostają.
  - Front i tył Bakop rejestrowane po sylwetce mierzonej na tym tle; dach główny przechodzi nad garaż i zadaszone
    dojście (`UNDER_MAIN`); skrzydło ma dach dwuspadowy poprzeczny; kalenica 6,28 jak na rysunku; brak drugiej bramy.
  - Rozbieżność dwóch czytników cyfr zostaje nazwana (odczyt rozpoznawacza jako równorzędny rywal, nigdy w miejsce);
    brama samochodowa to jeden panel na całej szerokości; garaż przypisany po powierzchni tylko jednoznacznie.
  - Regresja (pełna ścieżka): sprawdzarka 35/70 bez zmian, 10 domów bajt w bajt jak 1317, pozostałe ocenione względem
    arkuszy (Muraje: wykryta i usunięta fałszywa brama na przeszkleniu tarasu).
  - Jeszcze nie: przeszklony szczyt skrzydła, wysokość przeszklenia tylnego (2,9 zamiast 2,3 — rywal nazwany), słup
    i lamele dojścia, pergola, paleta drewno/szary. Bratki/Dalie: +2,96/+3,06 nadal korygowane jak w 1317 (otwarte).
  - Ścieżka osadzona na żywej stronie Bakop: model identyczny z desktopowym PO (`b1099a1d…e031`). Interfejs Androida:
    NOT_VERIFIED. ZIP prywatny 1318: `cd5942b0…849d`, 893 pliki.


## 7. Zefiranty (G2 wer. 2) i Bakopy — dostawa testowa 1319 (DEV, ujawnione przez OWNER-a, nie ślepy test)

- **Przypadek:** dokładnie ta edycja (https://www.archon.pl/projekty-domow/projekt-dom-w-zefirantach-g2-ver-2-m91f1f8409e8e1).
  Lista cech spisana z oryginałów przed porównaniem z modelem (prywatnie, F1–F17). Strona: 170,83 m², 9,02 m, 38°,
  ścianka kolankowa 90 cm; przekrój +8,55 / −0,47 (9,02 liczone od terenu, kalenica przekroju od ±0,00 — nie
  zamienione jedna za drugą).
- **PRZED (kod 1318, zachowany):** RECONSTRUCTION_FAILED / METRIC_RESOLUTION_INCONCLUSIVE, brak modelu; dom zostaje
  w mianowniku. Po użyciu jego błędów do diagnozy żaden kolejny wynik Zefirant nie jest nazywany ślepym.
- **Pierwsze złe decyzje i poprawki ogólne:**
  1. Podwójny łuk tarasu (i krzesła ogrodowe) przecinające linie wymiarowe brane za kreski wymiarowe — ogólny
     „1452” (odczytany poprawnie) wiązany do przedziału łuku. Nowa reguła CROSSING_OUTLINE (dimension-lines 1.4.0):
     kreska ciągnąca się ≥ 2 zasięgi po obu stronach i dryfująca wzdłuż linii od samej linii, w jedną stronę, nadal
     w ruchu na końcu — to obrys, nie znacznik; prosta linia przez znacznik (linia pomocnicza) zostaje znacznikiem;
     znacznik pod etykietą oceniany jako tekst. Kształt reguły ustalony na arkuszach DEV (Zefiranty, Kostrzewy,
     Bratki) i sprawdzony znacznik po znaczniku — to jest strojenie na DEV, więc wyniki DEV nie są niezależnym
     dowodem; H2 pozostaje zapieczętowany.
  2. Dwie etykiety jedna nad drugą łączone w jeden region przez obrócone błędne odczyty (solver metryki 1.6.0):
     dwa tokeny, które jedno przejście odczytało osobno, to dwa atramenty.
  3. Przekrój 400×300 px: cyfry rzędnych ~7 px, poniżej bramki czytelności (nieluzowanej) — brak kalenicy. Reguła
     przybliżonej kalenicy (005T-N3) obejmuje teraz dach kopertowy (połowa krótszej rozpiętości × tan kąta;
     sprawdzenie wysokością ze strony jak dla dwuspadowego): kalenica 8,16 m, ASSUMED_FOR_RENDERING (przekrój rysuje
     +8,55, nieodczytane). Elewacje nadal niezarejestrowane (tylko rzędne drukowane).
  4. Kopertowy trzymany jako dwuspadowy przez okna dachowe z rzutu; teraz okno, którego cały obrys leży w jednej
     połaci kopertowej, przechodzi do tej połaci.
- **PO:** model `82cde3d5…8b97` (desktop = pakiet w APK na żywej stronie); skala 2,5656 cm/px SUPPORTED; zabudowa
  153,3 m² (−10,3 %); dach główny kopertowy 38° z krótką kalenicą i 4 oknami dachowymi. Względem F1–F17: F1 ✓,
  F9 częściowo; NIE MA: garażu z własnym niższym dachem (garaż podzielony liniami domu), niższych dachów na
  poziomie poddasza, trzech lukarn (w tym z balkonem i balustradą), falistego okapu, koszy, kominów, łukowych okien,
  palety. Dodane bez źródła: pas 2,2 m z płaskim dachem przy garażu (kawałek garażu), kalenica 0,39 m niżej niż +8,55.
- **Bakopy:** łańcuch „71” w kuchni nie mierzy już pasa (solver 2.27.0); pas attached-2 = FALSE_STRIP jako jedyny
  odczyt → NOT_A_BODY, nazwany i niebudowany. Wynik COMPLETE_WITH_OPEN_QUESTIONS, 0 odmów (był PARTIAL, 7 obiektów
  pominiętych); geometria bez zmian. „Płaski dach” u OWNER-a: nie odtworzony (scena 1318 z APK ma dach spadzisty);
  potrzebna skopiowana proweniencja przebiegu z telefonu. Żywa strona zmieniła dziś tylko tytuł — model
  `16552727…`, geometria identyczna z `b1099a1d…`.
- **Regresja (pełna ścieżka produkcyjna z zamrożonej kopii drzewa `82878c7`):** modele bajt w bajt jak w 1318:
  8 domów regresji, Arlety, Aurory, Azalie, Bratki, Dalie, Jabłonki, Lipienniki, Willa Maja; Pod Miłorzębem
  i Modrzewnica bez modelu jak wcześniej. Zmienione: Miniaturka (ścianki wewnętrzne ≤ 2,2 cm), Muraje (front cofnięty
  o 0,20 m; balustrada frontowa zgodna z zamrożonym oczekiwaniem, FAIL → PASS; płyta 0,20 m pod nią nie występuje
  w źródle — dodatek MODEL→ŹRÓDŁO). **Kostrzewy — regres:** poprawne odrzucenie ukośnej kreski na łańcuchu
  `chain-horizontal-595` przesuwa drabinę o 10 cm, zachodni koniec wnęki ganku 4,58 → 5,63 m i znikają drzwi wejściowe.
  Sprawdzarka tego nie widzi (wejście Kostrzew było FAIL już w 1318). Przyczyna (zasięg wnęki zależny od jednego końca
  łańcucha) otwarta — następna. **Sprawdzarka 36/70** (1318: 35/70); historyczne 35/70 zachowane; Zefiranty
  w mianowniku jako nowy dom bez zamrożonego zestawu oczekiwań.
- **Dostawa 1319:** commit kodu `82878c7`; APK `0.1319.0-owner`, versionCode 1319, SHA-256 `98253f3c…e671e277`, ten sam
  podpis; analizator `1d76b4f7…56ab2` (solver 2.27.0, czytnik 1.8.0). Ścieżka osadzona na żywych stronach (host, nie
  telefon): Zefiranty model = desktop `82cde3d5…`, Bakopy `16552727…`. Testy: 3398 zielonych, 15 czerwonych — podzbiór
  zapisanej linii bazowej, nic nowego. ZIP prywatny 1319: `621d5072…a1cf`, 921 plików. Interfejs Androida: NOT_VERIFIED;
  H2 zapieczętowany.
- **Następne:** Kostrzewy — zasięg wnęki ganku z narysowanej ściany tylnej, nie z najbliższego końca łańcucha; potem
  Zefiranty ZF-2: garaż jako osobna, niższa bryła z własnym dachem, niższe dachy na poziomie poddasza, trzy lukarny
  (w tym z balkonem i balustradą).

## 8. Po audycie 1319 (E12): regres Kostrzew, płyta Murajów, ewidencja dostawy i pierwsza żywa pomoc AI

- **Kostrzewy — przyczyna i poprawka ogólna:** boki wnęki ganku to krótkie odcinki ścian (34 px przy grubości 22 px),
  które nigdy nie dawały własnej linii siatki, więc wnęka brała boki z najbliższych kresek wymiarowych — w 1318 o 0,56 m
  za szeroko, w 1319 (po poprawnym odrzuceniu kreski) o 0,49 m za wąsko, i drzwi 70/210 wypadły poza ścianę tylną.
  Teraz wylot wnęki z atramentem ościeży po obu stronach stawia linie siatki na licach ościeży (`jambLines`, layout
  1.5.0): wnęka 5,15–9,16 m jak na rzucie, trzy otwory tam, gdzie je rysuje rzut. Test przyczyny + 5 orientacji
  (czerwony na 82878c7).
- **Kostrzewy — otwarte (starsze niż 1319):** drzwi wejściowe 105/210 (skrzydło i łuk na zewnątrz, do ganku) są
  budowane jako okno, bo ich kółko opisu nie zostało znalezione w całości (skrzydło i łuk dotykają pierścienia), więc
  nie zostało zamaskowane. Kontrola wejścia pozostaje FAIL — jak w 1318.
- **Muraje — przyczyna i poprawka ogólna:** bryła cięta na osi ściany frontowej zostawia zewnętrzną połowę muru jako
  pas między bryłą a zasięgiem rysunku. Reguła 005Q uznawała pas za mur tylko, gdy mieścił całe pasmo — a 0,75 px
  przesunięcia linii decydowało, czy pas w ogóle istnieje. W 1319 w połowie muru zbudowano „wnękę 0,20 m” z dwoma
  zwrotami, posadzką, płytą balkonu i balustradą. Teraz pas, którego zewnętrzne lico leży na krawędzi zasięgu, a
  pasmo sięga wewnętrznej krawędzi pasa (lub dalej), jest murem: zwroty, posadzka, płyta i balustrada znikają, bryła
  jak w rysunku. Przypadek 5 testu 005Q, który zamrażał posadzkę w atramencie muru, zmieniony świadomie (uzasadnienie
  w teście); pozostałe granice trzyma nowy test (czerwony na 82878c7 w dwóch przypadkach przyczyny).
- **Muraje — balustrada:** źródło ma francuskie balkony (szklane balustrady przy oknach piętra, bez płyty). Balustrada
  z 1319 pochodziła z fałszywej wnęki, więc kontrola balustrady wraca do FAIL. Francuski balkon wymaga osobnego odczytu.
  Otwarte także (starsze): wejście i brama garażu w ścianie cofniętej ok. 0,8 m pod piętrem (pasmo 606–634 px).
- **Zefiranty — przyczyny znalezione, jeszcze nie poprawione:** 153,28 wobec 170,83 m² to przednie 2,0 m garażu
  (wydrukowane „200”, związane 648–726 px) i trójboczny wykusz od wschodu. Przód garażu jest klasyfikowany jako
  zewnętrze, bo zalanie przecieka przez dwa narożniki z pełnym atramentem (100 %), których nie przypisuje żadne pasmo, a
  bryła frontu garażu w zaakceptowanym obrysie jest „niezamknięta” (sprawdzone: rozszerzenie reguły narożnika na
  własne lico linii niczego nie zmienia — decyduje test zamknięcia bryły w uzupełnianiu obrysu). „Płaski
  pas” przy garażu to odcięta zachodnia część garażu. Kalenica: źródło drukuje +8,55 (z −0,47 zgodne z 9,02 ze strony);
  model ma 8,16 (−0,39 m, −4,6 %) — rozjeżdża się założony poziom okapu, nie kąt. Następne: test zamknięcia bryły w uzupełnianiu
  obrysu na pełnym atramencie narożnika (z przypadkiem przeciwnym: koniec ściany przy papierze zostaje otwarty), potem
  garaż jako niższa bryła z własnym dachem, wykusz, lukarny.
- **F11 (korekta jawna):** zamrożony wiersz „zaokrąglony wykusz z tyłu” zostaje; obok zapisana korekta z dowodem —
  półkole jest tarasem (cienkie linie, leżaki, prosta ściana tylna z trojgiem drzwi). Model słusznie go nie buduje.
- **Ewidencja dostawy:** ZIP1319 nie miał `program.json` PO — pełna ścieżka produkcyjna go nie zapisywała. Teraz zapisuje
  `program.json` i `compile-diagnostics.json` (kompilator produkcyjny na tym samym modelu). „24 domy” w podsumowaniu
  1319 to błąd: regresja to 23 przebiegi (13 DEV z 3 bazami holdoutu, 8 regresyjnych, Bakopy, Zefiranty) i 21 modeli
  (Pod Miłorzębem i Modrzewnica nadal bez modelu, z zapisem porażki).
- **Ocena, która widzi regres:** `research/exterior-complete/regress.py` porównuje PRZED/PO element po elemencie (drzwi i
  otwory per strona, rodzaj i położenie; balkony, balustrady, tarasy, zwroty, pergole, kominy; błędy kompilatora; bryła).
  Na 1318→1319 wskazuje utracone drzwi Kostrzew i sześć dodatków Murajów bez źródła — czego sprawdzarka 70 kontroli nie
  widziała. Historyczne 35/70 i 36/70 zostają jako wyniki ograniczonej sprawdzarki.
- **Pomoc AI (życzenie OWNER-a, badanie):** kontrakt „drugiego spojrzenia” istniał od 005Y-N4, ale nigdy nie działał na
  żywo. Teraz działa przez tryb bezgłowy Claude Code (budżet OWNER-a, za jego zgodą, tylko jawne domy DEV). 7 pytań,
  których analizator nie rozstrzyga albo myli, po 3 powtórzenia: Claude Haiku 5.5 — 20/21 poprawnych, 1 błędna (taras
  jako wykusz, na pytaniu bez niezależnej kontroli — zostałaby pytaniem), koszt 0,014 $; Claude Opus 5.5 — 21/21, 0,47 $.
  15 odpowiedzi potwierdziła niezależna kontrola deterministyczna, żadnej błędnej. Sam analizator miał rację w 1 z 7.
  To nie jest test ślepy (odpowiedzi wzorcowe odczytane przez dewelopera po fakcie). Odpowiedź AI nigdy nie jest
  faktem: jest `AI_SUGGESTED`, a staje się użyteczna dopiero, gdy zgodzi się z nią kontrola z rysunku lub ze strony;
  inaczej zostaje pytaniem do użytkownika. Adapter produkcyjny zaktualizowany do dzisiejszego API (bez `temperature`
  i wymuszonego narzędzia, które dziś dają 400).
- **Regresja E12 (23 przebiegi, 21 modeli):** modele bajt w bajt jak w 1319 poza trzema zamierzonymi (Kostrzewy, Muraje,
  Trytomach — w tym ostatnim zniknęły dwa „tarasy” 0,22 m i sześć „zwrotów” w zewnętrznych połowach ścian bocznych,
  sprawdzone na rzucie poddasza). Sprawdzarka 35/70 (balustrada Murajów wraca do FAIL). Każdy przebieg ma teraz
  `program.json` i diagnostykę kompilatora: błędy tylko Aurory (1), Jabłonki (1), Zefiranty (5). Bez APK w tym punkcie
  kontrolnym — następna dostawa testowa (≥ 1320) razem z garażem i dachem Zefirantów.
- **E12b (nie wdrożone, łata w repozytorium):** jedna przyczyna wejścia Kostrzew i przodu garażu Zefirantów — kółko
  opisu dotknięte linią (drzwi garażu, skrzydło drzwi) było znajdowane jako dwa małe fragmenty i nieczytane, a jego
  atrament na linii ściany udawał słup. Po scaleniu kółek oba odczyty przechodzą bramki („455/220”, „105/210”), a brama
  garażu jest jedną luką 4,52 m z podpisem 455. Regresja pokazała jednak szeroki skutek (13 z 21 modeli: okna 1,5–1,8 m
  zmieniają się w drzwi po odczytaniu wysokości 220, zamiany w Willi Mai, błędy Aurory 1 → 4). Bez sprawdzenia każdej
  zmiany ze źródłem nie wdrażam; łata `research/exterior-complete/e12b-callout-rings.patch` czeka na weryfikację.
