# BuildPlan v3.54.20 — opis struktury z API steruje budową modelu (po APK 1352)

Etap: 2026-11-24/25. Gałąź `claude/new-session-3kzcgh`. Baseline: kod APK 1352 (`af7db0e`). Kod oddawany: `108611e`
(zamrożenie 3), APK 1353. Protokół zapisany przed biegami i uzupełniany przed każdym kolejnym krokiem:
`research/source-to-model/v35420/PROTOCOL.md`. Decyzje: `docs/ADR-V35420-STRUCTURE-CONTRACT.md`. Krótko dla OWNER-a:
`stage-reports/README_V35420.md`.

Renderów z komputera nie nazywam zrzutami z telefonu. W tej sesji nie było telefonu ani emulatora: APK jest zbudowany
i podpisany, **na urządzeniu niesprawdzony** (`ANDROID_UI_NOT_VERIFIED`).

## Werdykt

1. **Droga od opisu API do geometrii istnieje i działa tam, gdzie opis ma niezależnego świadka.** Jeden typowany odczyt
   struktury na dom (kondygnacje, rodzaj dachu, kalenica, bryły, strony elewacji; każda liczba ze statusem
   wydrukowana / wyliczona / oszacowana / nieznana) jest uzgadniany z rzutem, stroną i szkicami, a to, co uzgodnione,
   wykonuje solver brył i sprawdza arbitraż. Po budowie analizator mierzy oddany model: na 24 domach 84 z 86 przyjętych
   własności struktury jest w modelu, 220 otworów zewnętrznych związanych przez wykonawcę stoi dokładnie tam, gdzie je
   związano (0 różnic, 0 błędów sumy odcinków ściany).
2. **Na nowych domach (NEW-G, 4 domy, 4 wydawców, losowane po zamrożeniu): cały wynik 1 → 2, zewnętrze użyteczne 1 → 2,
   wnętrze zgodne 2 → 3; żaden dom się nie pogorszył.** Amber IV dostał właściwy układ: bryła frontowa i poprzeczne
   skrzydło tylne (w 1352: bryła obrócona, dach rozpięty na całą głębokość). Rockville dostał wnętrze z rzutu (0 → 14
   ścian). Trzy z czterech oczekiwań zapisanych z góry są spełnione; **czwarte nie**: liczba domów z formą zgodną
   w czterech faktach została 3 → 3, bo jedyny niezgodny dom (Basia i Adam — „elewacje" wydawcy są widokami
   perspektywicznymi) nie dostał odczytu struktury i jest identyczny w obu wersjach.
3. **To mała próba i skromny zysk.** Jeden dom zyskał bryłę, jeden wnętrze, dwa się nie zmieniły. Rockville nadal nie
   ma drzwi wejściowych ani poprzecznych szczytów; Basia i Adam jest jednym długim pudłem.
4. **Na 20 domach DEV forma poprawiła się mierzalnie, ale ocena ślepa nie wskazuje na ogólną poprawę wyglądu.** Forma
   zgodna w czterech faktach: 13 → 18 domów (Skagen: dwie kondygnacje i garaż; Fabia i Willa Eliza: dachy czterospadowe;
   Medulin i Mindelo: dachy spadziste zamiast płaskich przybudówek). Zewnętrze użyteczne 8 → 9, cały wynik 8 → 9
   (Skagen). Ale oceniający uznał wariant końcowy za bliższy źródłu w 6 domach, wariant 1352 w 7, remis w 7.
5. **Są regresy, których nie naprawiłem** (§7): Ametyst New ma bryłę obróconą (front na dłuższym boku), Amarylis stracił
   duży szczyt frontowy (odzyskując otwory 5 → 10), G6 ma 3 otwory zamiast 5, garaż Aletty ma zbyt płaski dach, trzy
   domy dostały nadliczbowy komin, Medulin stracił obrys zgodny z rzutem. Wszystkie pochodzą z tego etapu.
6. **Popełniłem błąd procesu i dwa razy poprawiałem kod po pierwszym zamrożeniu** — raz po końcowym przebiegu DEV
   (zamrożenie bez pełnego przebiegu), raz po biegu hosta, który pokazał, że przy błędnej bryle LOCAL uzgodnione
   kondygnacje nie były w ogóle egzekwowane. Obie poprawki są opisane w protokole przed kolejnym krokiem; modele NEW-G
   kodu oddawanego są **identyczne co do bajta** z pierwszym biegiem odłożonym (§5.1), więc wynik z punktu 2 jest
   wynikiem pierwszego spojrzenia.

## 1. Cel i punkt wyjścia

Cel OWNER-a: rozpoznawalna kolorowa miniatura z poprawną bryłą zewnętrzną, dachem, głównymi otworami i ścianami
wewnętrznymi zgodnymi z rzutem. Zadanie etapu: informacja, którą API potrafi dostarczyć — opis brył, dachów, wymiarów
i położeń — ma **rzeczywiście sterować budową modelu**, wspólnie z rzutami, także gdy bryły LOCAL nie ma albo jest błędna.

Punkt wejścia: v3.54.19, APK 1352, kod `af7db0e` (dostawa `cd1b53a`). Sprawdzone przed startem: po `cd1b53a` nie było
nowszych zmian. W tamtym etapie wnętrze z rzutu przenosiło się na nowe domy, forma nie: dom piętrowy z garażem powstawał
jako parterowy pod stromym dachem (Skagen), dach czterospadowy jako dwuspadowy (Fabia), bryła LOCAL z płaskimi
przybudówkami stała, bo konkurentka miała przeciw sobie jedną rejestrację (Medulin, Mindelo), a Amarylis miał 5 otworów
zewnętrznych zamiast 17.

## 2. Przyczyny — sprawdzone na nagraniach, zanim powstał kod

Te same nagrane odczyty (szkice elewacji, odczyt metryczny), kod 1352, 0 USD:

| Dom | Co było w źródle i w odczytach | Dlaczego nie trafiło do modelu |
|---|---|---|
| Skagen | strona publikuje rzut piętra; przekrój drukuje +8,77; obrys ma dwa uskoki garażu 3,56 m | odczyt formy nie był w ogóle pytany (pytany tylko przy płaskich bryłach obok dachu spadzistego); dwa uskoki obrysu były „małe" i konwencja je wygładzała, zanim cokolwiek mogło nazwać garaż; ściany 3,06 m pod stromym dachem |
| Fabia | cztery elewacje pokazują połać, żadna szczytu; strona: 25° | dach kopertowy widziany z krótkiego boku **jest** trójkątem — sylwetki czytały szczyt; odczyt formy nie był pytany |
| Medulin, Mindelo | odczyt formy mówił: jedna bryła / bryła + garaż, dachy dwuspadowe | `formVerdict` sprawdzał tylko, czy dach jest spadzisty; bryła ze źródeł przegrywała z LOCAL jedną rejestracją elewacji |
| Amarylis | 17 otworów w bryle LOCAL | po zamianie bryły trzy z czterech elewacji nie rejestrowały się na źle zbudowanym modelu wielobryłowym (wysokości ścian z szacunku, elewacje boczne po złych stronach), więc ich otwory nie miały gospodarza |
| HIP w opisie, GABLE w modelu | — | `formVerdict` zwracał `AGREES` (oba „spadziste") |

Wniosek: informacja istniała i nie miała drogi do geometrii. Etap buduje tę drogę, nie nowy detektor.

## 3. Co wdrożono

Decyzje: `docs/ADR-V35420-STRUCTURE-CONTRACT.md`. Kod: `packages/analysis-service/src/consult/{form-read,structure,readback}.ts`,
`massing/massing.ts`, `correct/execute.ts`, `plan-skeleton.ts`, `consult-analysis.ts`. Bez nowej usługi, DSL ani jądra:
istniejące żądanie odczytu formy, istniejący solver brył i istniejący wykonawca korekt.

### 3.1 Jeden typowany odczyt struktury ze wszystkich arkuszy (`form-read/2`, forma 2.0.0)

Jedno żądanie na dom (0,02–0,06 USD): wszystkie naszkicowane elewacje z podpisami wydawcy, rzut parteru, przekrój
(gdy strona go ma) i fakty strony jako tekst. Odpowiedź (narzędzie `report_structure`, ścisły schemat):

- **kondygnacje** bryły głównej i arkusz, który je rozstrzyga;
- **dach bryły głównej**: rodzaj, kierunek kalenicy; kąt, okap i kalenica — każda liczba ze **statusem**
  `PRINTED` (wydrukowana) / `DERIVED` (wyliczona z podanej podstawy) / `ESTIMATED` (oszacowana) / `UNKNOWN` (bez liczby);
- **pozostałe bryły pod własnym dachem** (`parts`): co, po której stronie, kondygnacje, dach, kalenica;
- **to, co bryłą nie jest** (`notVolumes`): wnęka, podcień, wykusz, lukarna, balkon, daszek, wiata, taras;
- dla **każdej elewacji**: którą stronę pokazuje i jak widać na niej dach główny (połać / szczyt).

Strony mają jedną definicję: LEWA i PRAWA to strony osoby stojącej **na zewnątrz przed frontem**. Odpowiedź sprzeczna
sama ze sobą (dach płaski z kalenicą, liczba ze statusem UNKNOWN, kalenica poniżej okapu, obraz, którego nie wysłano)
jest odrzucana z nazwą powodu.

### 3.2 Uzgodnienie: nic z odczytu nie trafia do budowy jako gołe twierdzenie (`structure.ts` 1.0.0)

Każda własność dostaje stan: **AGREED** (niezależny świadek mówi to samo), **UNWITNESSED** (nikt inny się nie wypowiada —
przyjęta, z nazwaniem, że tylko na słowo odczytu) albo **DISPUTED** (świadek mówi inaczej — **nie jest brana**, oba
stwierdzenia zostają w zapisie). Świadkowie: kondygnacje, dla których strona publikuje rzuty; wysokość budynku i kąt
dachu ze strony; części nazwane przez odczyt rzutu; oraz wielokąty samych szkiców elewacji — ściana narysowana aż do
szczytu dachu to ściana szczytowa, której dach kopertowy nie ma. Kąt trafia do budowy tylko, gdy jest AGREED albo ma
status PRINTED / DERIVED; kierunek kalenicy tylko, gdy rodzaj dachu nie jest sporny.

To jest też odpowiedź na „błędny opis API i poprawny model": Juliusz — odczyt powiedział „dach czterospadowy", szkice
rysują ściany szczytowe do kalenicy; własność jest DISPUTED, model zostaje dwuspadowy (test przyczynowy §6).

### 3.3 Budowa wykonuje to, co uzgodnione (bryły 1.9.0)

- **Część zgłoszona po stronie, po której obrys ma uskok, staje się własną bryłą** — wycinaną z obrysu, zanim
  zadziała konwencja wygładzania małych uskoków (`wingOnSide`, najmniej 2,8 m). Bez uskoku po tej stronie: bez bryły,
  z nazwą powodu (zgłoszony garaż, który nie ma gdzie stać, nie jest wymyślany).
- **Rodzaj dachu**: kopertowy odczytany z sylwetek jako dwuspadowy jest budowany jako kopertowy (jeden kąt dookoła;
  długość kalenicy = `DISPLAY_ASSUMPTION`, nazwane); dwuspadowy odczytany jako kopertowy — jako dwuspadowy.
- **Kierunek kalenicy** dachu dwuspadowego; wysokości zostają z rysunków, kąt idzie za nową rozpiętością.
- **Kondygnacje**: ściany poniżej dwóch kondygnacji pod dachem nad dwiema pełnymi są podnoszone tam, gdzie stawia je
  uzgodniony kąt od narysowanej kalenicy; w drugiej kolejności do okapu podanego jako PRINTED / DERIVED — nigdy ESTIMATED.
- Sylwetka bez dachu (ściana szczytowa naszkicowana do kalenicy) pod zgłoszonym dachem spadzistym: narysowany szczyt
  jest kalenicą, kąt jest uzgodniony.

Wysokości i rozpiętości pozostają z rysunków; odczyt wnosi rodzaj, kierunek, liczbę kondygnacji i — wyłącznie ze
statusem PRINTED / DERIVED — okap.

### 3.4 Forma rozstrzyga między dwiema bryłami (arbitraż 1.4.0)

Odczyt struktury jest pytany dla **każdego** domu z co najmniej dwiema naszkicowanymi elewacjami (dotąd: tylko przy
płaskich bryłach obok dachu spadzistego). Gdy przeczy bryle LOCAL i zgadza się z bryłą zbudowaną ze źródeł, ta druga
staje, o ile obrazy nie przeczą jej bardziej niż LOCAL, jej wymiary drukowane nie są gorsze, a wysokość ze strony jej
nie obala. `formVerdict` 2.0.0: inny rodzaj dachu to `CONTRADICTS`.

### 3.5 Strony elewacji bez podpisu

Kolejność dowodu: rejestracja na bryle → otwory rzutu → **przerwy w ścianach na samym arkuszu rzutu** → strona podana
przez odczyt struktury → konwencja kolejności źródła (nigdy wbrew odczytowi). Elewacje bez podpisu wchodzą do pomiaru
wysokości bryły po stronie z odczytu; lista otworów elewacji jest pytana dla obrazu, który odczyt widział po stronie
bez przypisanego szkicu.

### 3.6 Otwory: gospodarz, oś ściany, kontrola sumy — odczytane z oddanego modelu (`readback.ts` 1.0.0)

Po budowie analizator **mierzy oddany model**, nie przepisuje poleceń:

- `OPENINGS_READBACK` — każdy otwór zewnętrzny w układzie swojej ściany: od narożnika początkowego, szerokość, do
  narożnika końcowego (**trzy liczby sumują się do długości ściany — sprawdzane**), po której ręce jest narożnik
  początkowy **widziany z zewnątrz** (przeciwległe elewacje nie odwracają osi po cichu), parapet **od podłogi kondygnacji
  ściany** i osobno nad ±0,00, rozmiar konstrukcyjny — obok wartości związanych przez wykonawcę, z różnicą na własność.
- `STRUCTURE_READBACK` — bryły, rodzaj dachu, kalenica, wierzch ścian wobec przyjętej struktury.

Słownik znaczeń (co jest otworem konstrukcyjnym, co parapetem, czym okap różni się od wysięgu po połaci) jest w ADR,
tabela „What a number means".

### 3.7 Dwie poprawki, bez których powyższe nie dawało modelu

- **Komin stoi wewnątrz ścian swojej bryły** (wykonawca 1.11.0): zamiast odrzucać całość, gdy głębokość z jednej elewacji
  stawia go w płaszczyźnie ściany, komin jest dosuwany tuż za jej lico.
- **Ściany wypełnione jako kreska wzdłuż obrysu** (szkielet rzutu 1.3.0): dom, którego obrys jest w połowie przeszkleniem,
  był odrzucany przy 24 % wobec progu 25 %; ta sama ćwiartka jest teraz mierzona jako wypełniona kreska w zasięgu obrysu.

### 3.8 Nazwane i niezbudowane (brak konsumenta — jawnie)

- wnęki, podcienie, wykusze, lukarny, balkony, daszki, wiaty, tarasy: zgłaszane w `notVolumes`, zapisywane, **nie budowane**;
- **podbitka / podsufitka** (spód okapu albo zadaszenia), jej zasięg i materiał: brak pola w odczycie i brak konsumenta;
- otwór ze **skośną głowicą** (przeszklenie szczytu): budowany prostokątem ograniczającym, przyciętym do wierzchu ściany;
- kondygnacje jako osobne poziomy: bryła piętrowa to jeden pierścień ścian do okapu; wnętrze jest wnętrzem parteru;
- długość kalenicy dachu kopertowego, gdy żaden widok nie rysuje trapezu: jeden kąt dookoła (`DISPLAY_ASSUMPTION`);
- ukierunkowany drugi odczyt fragmentu przy sporze: właściwy następny krok tam, gdzie spór kosztuje dom; nie zaczęty.

### 3.9 Zmiany po pierwszym zamrożeniu (wersje końcowe: bryły 1.10.0, struktura 1.1.0, arbitraż 1.5.0)

- **Przerwy na arkuszu rzutu przed słowem odczytu o stronie** (zamrożenie 1) — §3.5.
- **Elewacje ustawione stroną z odczytu zostają zarejestrowane także dla otworów** (zamrożenie 2).
- **Żadna bryła nie jest wyższa o kondygnację od jednokondygnacyjnej bryły głównej**, chyba że odczyt zgłasza część
  dwukondygnacyjną (zamrożenie 2); obok bryły dwukondygnacyjnej skrzydło zostaje takie, jak rysują je jego elewacje.
- **Uzgodnione kondygnacje i kierunek kalenicy są trzymane wobec każdej bryły w arbitrażu** (zamrożenie 3):
  `structureAgainstBody` mierzy bryłę główną (wierzch ścian, oś kalenicy) wobec własności o stanie AGREED. Bez tego
  błędna bryła LOCAL o dachach „właściwego rodzaju" stała mimo uzgodnionych dwóch kondygnacji.

Powody i dowody każdej z tych zmian: PROTOCOL §5–8.

## 4. Pełne ścieżki: liczba ze źródła → pole JSON → zbudowany element

Każda ścieżka poniżej jest przepisana z zapisu biegu (`STRUCTURE_READ`, noty `STRUCTURE …` solvera brył,
`STRUCTURE_READBACK`, `OPENINGS_READBACK` w `events.json` wariantu końcowego), nie z poleceń. Wartości „zbudowano" są
zmierzone na oddanym modelu.

### 4.1 Skagen (Lipińscy, DEV; w 1352: parterowy pod dachem 48°, bez garażu, bez wnętrza)

| Źródło | Pole odczytu (`form-read/2`) | Uzgodnienie | Polecenie / nota budowy | Element oddanego modelu (odczyt zwrotny) |
|---|---|---|---|---|
| strona publikuje rzuty: PARTER, PIĘTRO; przekrój | `storeys: TWO`, `storeysBasis: SECTION` | **AGREED** — świadek `PLAN_STOREYS` | reguła kondygnacji bryły głównej | ściany `ring-mass-main` do **5,71 m** (1352: 3,06 m) |
| strona: „kąt dachu 30°" | `pitchDeg: 30`, `pitchStatus: PRINTED` | **AGREED** — `PAGE_ROOF_PITCH` | „narysowany szczyt 8,91 m jest kalenicą, ściany kończą się tam, gdzie stawia je uzgodnione 30° w dół" | `roof-mass-main`: dwuspadowy **30°**, kalenica **8,91 m** |
| przekrój drukuje +8,77 | `ridgeM: 8.77`, `ridgeStatus: PRINTED` | UNWITNESSED (strona nie podaje wysokości) | nie steruje — kalenica zostaje z rysunku elewacji (8,91 m); różnica 0,14 m zapisana | kalenica 8,91 m |
| elewacja frontowa: połać nad ścianą | `mainRidgeAlong: FRONT` | **AGREED** — `SKETCH_GABLE_WALL` (szkic frontu nie rysuje ściany do szczytu) | oś kalenicy X | `ridgeAxis: X` |
| rzut: garaż w obrysie; elewacje: niższa część po prawej | `parts: [{ what: GARAGE, where: RIGHT, storeys: ONE, roof: GABLE }]` | **AGREED** — `PLAN_PARTS` | „garaż zgłoszony po prawej stoi tam, gdzie obrys ma uskok po tej stronie (3,57 × 7,09 m): własna bryła" | `ring-mass-wing-1` 3,57 × 7,09 m, ściany 2,95 m, dach 30°, kalenica 5,29 m |
| szkic frontu: brama garażowa | (szkic) `opening-gate-21-14` | host = ściana frontowa **garażu** | `ADD_OPENING` offset 0,847, szer. 2,488, wys. 2,157 | `op-fix-front-c877bd` w `ring-mass-wing-1-w0` (dł. 3,572 m): 0,847 + 2,488 + 0,237 = 3,572 ✓, początek ściany po LEWEJ (z zewnątrz), parapet 0,00 |
| szkic frontu: drzwi wejściowe | (szkic) `opening-door-11-14` | host = ściana frontowa bryły głównej | `ADD_OPENING` offset 5,309, szer. 1,635, parapet 0,047, wys. 2,299 | `op-fix-front-f1a315` w `ring-mass-main-w0` (9,391 m): 5,309 + 1,635 + 2,447 = 9,391 ✓ |

Wynik: 4 z 4 przyjętych własności struktury są w modelu; 16 z 16 otworów zewnętrznych stoi tak, jak je związano
(różnica 0 mm), 0 błędów sumy. Wymiar drukowany na rzucie (9,44 + 3,56 m) nie pochodzi z odczytu struktury — bryły mają
9,39 i 3,57 m z własnej skali rzutu (różnica 5 i 1 cm).

### 4.2 Fabia (Dobre Domy, DEV; w 1352: dach dwuspadowy, 4 otwory, 0 kominów)

| Źródło | Pole odczytu | Uzgodnienie | Budowa | Element modelu |
|---|---|---|---|---|
| cztery elewacje: wszędzie połać | `mainRoofKind: HIP`; `pictures[*].roofSeenAs: SLOPE` | **AGREED** — żaden z 4 szkiców nie rysuje ściany do szczytu dachu | „dach kopertowy (bez ściany szczytowej), jeden kąt dookoła — kalenica kończy się pół rozpiętości (5,56 m) od ścian: DISPLAY_ASSUMPTION" | 4 połacie nad `ring-mass-main` 12,48 × 11,12 m; ściany 2,91 m |
| strona: 25° | `pitchDeg: 25`, `PRINTED` | **AGREED** — `PAGE_ROOF_PITCH` | kąt wszystkich połaci | 25° |
| przekrój: +6,24; strona: wysokość 6,6 m | `ridgeM: 6.24`, `PRINTED` | **AGREED** — `PAGE_BUILDING_HEIGHT` (od terenu, w granicy cokołu) | nie steruje (wysokości z rysunków) | — |
| (brak liczby) | `eavesM: 3`, `ESTIMATED` | UNWITNESSED | **nie jest używana** (szacunek nie buduje) | ściany 2,91 m z elewacji |
| szkic frontu: okno | `opening-window-18-18` | host = ściana frontowa | `ADD_OPENING` offset 1,036, szer. 2,470, parapet 0,948, wys. 1,301 | `op-fix-front-e2471a`: 1,036 + 2,470 + 8,975 = 12,481 ✓; parapet 0,948 m od podłogi parteru |

Otwory zewnętrzne 4 → 11 i kominy 0 → 2: elewacje, które na dachu dwuspadowym o złej osi nie rejestrowały się, na
właściwej bryle rejestrują się i ich otwory mają gospodarza.

### 4.3 Amber IV (Studio Atrium, **NEW-G — dom nowy**, kod oddawany na odczytach biegu F)

| Źródło | Pole odczytu | Uzgodnienie | Budowa | Element modelu |
|---|---|---|---|---|
| strona: szerokość 11,55 m, długość 12,65 m; rzut drukuje 3,00 + 8,55 i 4,10 + 8,55 | — (wymiary z rzutu i strony) | — | obrys w skali rzutu | bryła główna **11,55** × 8,23 m; skrzydło 8,61 × 4,19 m (druk: 8,55 × 4,10) |
| elewacje: z tyłu szczyt, od frontu połać | `parts: [{ what: WING, where: REAR, storeys: ONE, roof: { kind: GABLE, ridgeAlong: SIDE } }]` | UNWITNESSED (odczyt rzutu nazywa tylko MAIN) — przyjęte na słowo odczytu, **bo obrys ma uskok po tej stronie** | „skrzydło zgłoszone z tyłu stoi tam, gdzie obrys ma uskok": własna bryła, oś kalenicy Z | `ring-mass-wing-1`, dwuspadowy, **kalenica prostopadła do frontu**, 33,2°, kalenica 5,88 m |
| strona: 30° | `pitchDeg: 30`, `PRINTED` | **AGREED** | kąt bryły głównej | `roof-mass-main` 30°, kalenica 5,98 m |
| strona: wysokość 6,25 m | `ridgeM: 6.25`, `PRINTED` | **AGREED** — `PAGE_BUILDING_HEIGHT` | nie steruje | kalenica 5,98 m z elewacji (0,27 m poniżej wysokości od terenu) |
| elewacje boczne bez podpisu strony | `pictures: [3 → LEFT, 4 → RIGHT]` | strona z odczytu | `ELEVATION_SIDES_BY_STRUCTURE_READ` | elewacje zarejestrowane po tych stronach; ich otwory mają gospodarza |
| szkic frontu: drzwi wejściowe | `opening-door-22-21` | host = ściana frontowa | `ADD_OPENING` offset 6,001, szer. 0,793, parapet 0,198, wys. 1,925 | `op-fix-front-741880`: 6,001 + 0,793 + 4,756 = 11,550 ✓ |

W kodzie 1352 ten sam dom miał bryłę główną 8,60 × 12,49 m (krótszym bokiem do frontu) i boczną przybudówkę 2,91 m
z kalenicami równoległymi — odwrotnie niż źródło. Ramię pomocnicze (kod oddawany na odczytach biegu baseline) daje
11,51 × 8,34 m + skrzydło z kalenicą Z: zmiana jest skutkiem kodu, nie świeżych szkiców.

### 4.4 Błędny opis API, poprawny model: Juliusz Nowy (Dobre Domy, DEV)

Odczyt struktury: `mainRoofKind: HIP`, wszystkie cztery obrazy `roofSeenAs: SLOPE`. Świadek: dwa szkice elewacji rysują
ścianę aż do szczytu dachu — ścianę szczytową, której dach kopertowy nie ma. Stan własności: **DISPUTED**; do budowy
nie trafia ani rodzaj dachu, ani (od zamrożenia 1) kierunek kalenicy związany z rodzajem. `taken` zawiera wyłącznie
`fullStoreys: 1`, `pitchDeg: 40` (AGREED ze stroną) i liczby wysokości. Model pozostaje dwuspadowy 37,4°, jak w 1352.
W pierwszym przebiegu etapu (przed związaniem kalenicy z rodzajem) ten sam błędny odczyt obracał kalenicę — to była
strata wprowadzona przez nowy kod i została usunięta na dowodzie DEV.

Granica tej ochrony jest nazwana w ADR: błędna odpowiedź, której **żaden** świadek nie przeczy, buduje.

## 5. Próba odłożona NEW-G — skuteczność na nowych domach

Losowanie po zamrożeniu 1 (`v35419/trial/select.py`, etykieta ziarna `V35420-NEWG`, rodziny widziane wcześniej
wykluczone), po jednym domu z każdej puli: **Amber IV** (Studio Atrium — przyjęty czwarty otwarty wariant rodziny, trzy
wcześniejsze miały 0 podpisanych elewacji), **Rockville** (Lipińscy), **Basia i Adam** (Dobre Domy), **Dom pod jarząbem
25** (ARCHON). Cechy referencyjne i cztery fakty formy spisane ze źródeł i wypchnięte do repozytorium przed otwarciem
jakiegokolwiek modelu (`v35420/references/NEW-G.md`, `form-NEWG.json`).

### 5.1 Ramiona i co jest oceniane

| Ramię | Kod | Odczyty | Rola |
|---|---|---|---|
| B | 1352 (`af7db0e`) | na żywo, jedyny bieg | baseline |
| F | zamrożenie 1 (`024e2b7`) | na żywo, jedyny bieg | pierwszy wynik odłożony |
| F2 | zamrożenie 2 (`10ce107`) | nagrane odczyty biegu F | kod oceniany |
| F2@B | zamrożenie 2 | nagrane odczyty biegu B | rozdzielenie kodu od odczytów |

Pierwsza próba biegu B skończyła się w 3 s bez żądania (0 USD): w drzewie baseline brakowało plików modeli
rozpoznawania — błąd mojego środowiska, nie wynik; katalog zachowany jako `base-env-failure-0usd`.

**F i F2 dały na wszystkich czterech domach modele identyczne co do bajta** (te same SHA-256 `model.json`). Poprawka
zamrożenia 2 niczego na NEW-G nie zmieniła, więc ocena ślepa (B kontra F2) jest oceną pierwszego wyniku odłożonego.
Kod oddawany (zamrożenie 3) sprawdzono na Domu pod jarząbem: ten sam bajt w bajt model (PROTOCOL §8).

### 5.2 Wynik

| Dom | Forma 4/4 (B → F2) | Zewnętrze użyteczne | Wnętrze zgodne | Cały wynik | Bliżej źródła | Co się zmieniło |
|---|---|---|---|---|---|---|
| Amber IV | 4/4 → 4/4 (*) | NIE → **TAK** | TAK → TAK | NIE → **TAK** | końcowy | bryła frontowa 11,55 × 8,23 m z kalenicą wzdłuż frontu + skrzydło tylne z kalenicą poprzeczną; w B: 8,60 × 12,49 m, oba dachy równolegle |
| Rockville | 4/4 → 4/4 | NIE → NIE | NIE → **TAK** | NIE → NIE | 1352 (**) | wnętrze 0 → 14 ścian (13 z 13 ścian rzutu); zewnętrze bez zmiany geometrii |
| Basia i Adam | 3/4 → 3/4 | NIE → NIE | NIE → NIE | NIE → NIE | remis | nic: modele identyczne; odczyt struktury nie został zadany |
| Dom pod jarząbem 25 | 4/4 → 4/4 | TAK → TAK | TAK → TAK | TAK → TAK | końcowy (marginalnie) | bryła LOCAL w obu; różni się jedno przeszklenie |
| **Razem** | **3 → 3** | **1 → 2** | **2 → 3** | **1 → 2** | końcowy 2, 1352 1, remis 1 | |

(*) Cztery fakty (liczba brył, rodzaj dachu, kierunek kalenicy, kondygnacje) są zbyt zgrubne, żeby odróżnić Amber IV
w 1352 od poprawnego: liczba brył i kierunek się zgadzały, układ nie. Różnicę złapała ocena ślepa (cecha F2). To
ograniczenie miernika zapisanego z góry — nie zmieniałem go po ocenie.

(**) Rockville: obie wersje mają tę samą bryłę i te same 9 otworów; oceniający wskazał 1352 z powodu barwy szczytu
(drewno), czyli wykończenia z recenzji świeżych szkiców. Zgodnie z protokołem §2 to **zmienność recenzji, nie kod**.

Oczekiwania zapisane z góry (PROTOCOL §3):

| | Oczekiwanie | Wynik |
|---|---|---|
| (a) | liczba domów z formą zgodną 4/4 rośnie albo jest pełna w baseline | **NIESPEŁNIONE**: 3 → 3 z 4 |
| (b) | zewnętrze użyteczne nie spada na żadnym domu i rośnie o ≥ 1 | spełnione: 1 → 2, żaden nie spadł |
| (c) | wnętrze zgodne nie spada na żadnym domu | spełnione: 2 → 3 |
| (d) | przyjęte własności struktury w modelu w ≥ 90 % | spełnione: 12 z 12 |

### 5.3 Kod czy odczyty? (ramię F2@B)

| Dom | B | F2@B (ten sam odczyt co B, nowy kod) | F2 (świeże odczyty, nowy kod) | Wniosek |
|---|---|---|---|---|
| Amber IV | 8,60 × 12,49 + 2,91 × 8,34, kalenice X/X | 11,51 × 8,34 + 8,60 × 4,14, kalenice X/Z | 11,55 × 8,23 + 8,61 × 4,19, kalenice X/Z | dekompozycja jest skutkiem **kodu**; różnica 4–11 cm między F2@B i F2 to odczyty |
| Rockville | 0 ścian wewn. | 14 ścian wewn. | 14 ścian wewn. | wnętrze jest skutkiem **kodu** (reguła pokrycia obrysu, szkielet rzutu 1.3.0) |
| Basia i Adam | identyczne | identyczne | identyczne | brak wpływu |
| Dom pod jarząbem | identyczne liczby | identyczne liczby | identyczne liczby | brak wpływu |

Trzeci niezależny bieg Amber IV — na żywo, przez publiczny punkt wejścia hosta — dał tę samą dekompozycję
(bryła główna z kalenicą X, skrzydło z kalenicą Z; §10).

### 5.4 Czego NEW-G nie pokazuje

- Żaden z czterech domów nie jest piętrowy ani nie ma dachu czterospadowego: reguła kondygnacji i zamiana rodzaju dachu
  **nie były na NEW-G wystawione na próbę**. Ich dowód to DEV (Skagen, Fabia, Eliza) i host — nie transfer.
- Basia i Adam pokazuje granicę wejścia: wydawca publikuje jako elewacje widoki perspektywiczne; nie powstają z nich
  szkice, więc nie ma odczytu struktury ani korekty. Zgodnie ze zleceniem nie wyprowadzam metrów z perspektywy.
  Wynik: pudło 32,2 × 9,0 m ze ścianami 4,44 m, wnętrze z 1 z 15 ścian rzutu.
- Cztery domy to za mało na twierdzenie o odsetku.

## 6. Wyniki na 20 domach DEV (te same nagrane szkice i odczyt metryczny co APK 1352)

Pełne tabele: załącznik A (co powstało, ocena ślepa zewnętrza i wnętrza) i załącznik B (forma, zastosowanie danych,
liczby niższe niż w baseline).

| Miara | 1352 | Kod końcowy |
|---|---|---|
| Forma zgodna w czterech faktach | 13 / 20 | **18 / 20** |
| Zewnętrze użyteczne (ocena ślepa) | 8 / 20 | 9 / 20 |
| Wnętrze zgodne z rzutem (ocena ślepa) | 18 / 20 | 19 / 20 |
| Cały wynik | 8 / 20 | 9 / 20 |
| Bliżej źródła jako całość | 7 | 6 (remis: 7) |
| Przyjęte własności struktury w modelu | — | 72 / 74 (97 %) |
| Otwory zewnętrzne: zbudowane / związane i zgodne ≤ 5 mm / różne / błąd sumy / poza ścianą | — | 210 / 197 / 0 / 0 / 0 (13 bez związania: własne otwory bryły LOCAL) |

Domy, w których forma przeszła z niezgodnej na zgodną: **Medulin**, **Mindelo**, **Willa Eliza**, **Skagen**, **Fabia**.
Niezgodne pozostały Aurora (brak osobnej dobudówki) i Amarylis (trzy bryły zamiast dwóch). Dwa niezgodne sprawdzenia
odczytu zwrotnego to właśnie liczba brył: Eliza (przyjęto bryłę główną + garaż, zbudowano 3) i Amarylis (skrzydło
frontowe zgłoszone, a obrys nie ma tam uskoku — nie zbudowane, nazwane).

Co ocena ślepa mówi o zyskach z formy: Skagen jest jedynym domem, który przeszedł na „użyteczny". Fabia ma poprawny
dach czterospadowy i 8 z 11 przerw rzutu pokrytych otworem (było 2), ale pozostaje nieużyteczna, bo cecha F1 wymaga
wnęk wejścia i tarasu, których nie buduję. Medulin i Mindelo oceniono bliżej źródła, lecz nie jako użyteczne
(brak wcięcia tarasu, brak poprzecznego szczytu od ogrodu). Eliza: dachy i kondygnacje poprawne, układ brył nie.

**Amarylis** (strata 17 → 5 otworów z poprzedniego etapu): przyczyna potwierdzona na nagraniach — trzy z czterech
elewacji nie rejestrowały się na bryle o złych wysokościach i złych stronach. Po etapie: 10 otworów (6 z 7 przerw rzutu
pokrytych; było 1 z 7), ściany brył bocznych w granicach kondygnacji. Pełnych 17 nie odzyskałem, a kalenica bryły
głównej została obrócona (§7.2).

## 7. Regresy i straty — nienaprawione

Po zamrożeniu 2 nie stroiłem kodu pod wynik oceny (PROTOCOL §7), więc poniższe zostają w APK 1353.

### 7.1 Ametyst New (Studio Atrium) — bryła obrócona

W 1352 front był krótszym bokiem szczytowym (9,67 m), kalenica wzdłuż 12,93 m — jak w źródle. Po etapie front jest
bokiem 12,93 m, a kalenica biegnie wzdłuż krótszego. Przyczyna: dwie elewacje boczne bez podpisu weszły do solvera brył
po stronach podanych przez odczyt struktury i hipoteza z czterema zarejestrowanymi widokami wygrała z hipotezą z dwoma —
mimo że wymagała dwóch różnych skal rysunku (front 2,50 cm/px, boki 1,39 cm/px), czego jeden komplet elewacji wydawcy
mieć nie może. Otwory: 9 w obu, ale przerw rzutu pokrytych 9/10 → 5/10, a 3 otwory stoją na pełnej ścianie.
Reguła naprawcza jest oczywista (hipoteza wymagająca dwóch skal jest obalona) i nie została wprowadzona.

### 7.2 Amarylis (Studio Atrium) — utracony szczyt frontowy

Odczyt opisał dom jako bryłę główną z kalenicą wzdłuż frontu i skrzydło frontowe z kalenicą poprzeczną. Skrzydła nie
dało się zbudować (obrys nie ma uskoku), a kalenica bryły głównej została obrócona zgodnie z odczytem — duży szczyt
frontowy, który 1352 miał, zniknął. To przypadek „opis API poprawny w swoim języku, model po nim gorszy": dachy
krzyżujące się bez uskoku obrysu nie mają jeszcze konsumenta, a obrót kalenicy powinien być od niego uzależniony.

### 7.3 Pozostałe

| Dom | Strata | Przyczyna |
|---|---|---|
| G6 (garaż) | otwory 5 → 3 | odczyt struktury zamienił strony dwóch elewacji bocznych; świadectwo przerw rzutu remisowe (2,5 : 2,5) |
| Aletta New | dach garażu 35° → 20,6°, brak okna poddasza w szczycie; otwory 15 → 14; oceniona bliżej 1352 | kalenica skrzydła obrócona zgodnie z odczytem przy zachowanej wysokości |
| Alberto, Juliusz, Jarzębina | nadliczbowy komin (2 → 3; źródło Alberto: 2) | komin dosuwany za lico ściany zamiast odrzucany — reguła zachowała też kominy błędne |
| Willa Eliza | 6 kominów, garaż w bryle piętrowej, brak drzwi wejściowych | układ trzech brył nadal nie odpowiada źródłu |
| Aurora | okap niżej (ściany 3,27 → 2,99 m) przecina górę okien — oceniona marginalnie bliżej 1352 | elewacje boczne weszły do pomiaru wysokości po stronach z odczytu |
| Medulin | obrys uproszczony do prostokąta; przerwy rzutu pokryte 11/11 → 6/11; ściany wewn. 25 → 10, otwory 24 → 15, kominy 2 → 1 | bryła LOCAL (z płaskimi przybudówkami, ale z obrysem zgodnym z rzutem) zastąpiona bryłą ze źródeł |
| Mindelo | otwory 19 → 13 | jak wyżej |
| Amber IV (NEW-G) | ściany wewnętrzne 17 → 12, otwory 11 → 10 | inna bryła; ocena ślepa: 10/10 → 9/10 ścian rzutu, zmyślone 2/12 → 1/10 |

### 7.4 Błędy procesu

1. **Zamrożenie 1 bez pełnego przebiegu DEV.** Dwie zmiany sprawdziłem na pojedynczych domach; końcowy przebieg
   pokazał utratę otworów w czterech domach. Naprawione na dowodzie DEV (zamrożenie 2), zanim otworzyłem jakikolwiek
   render NEW-G; modele NEW-G nie zmieniły się o bajt.
2. **Luka wykryta dopiero przez host.** W odtworzeniach DEV bryła LOCAL dla Skagen nie powstawała, więc ścieżka
   „LOCAL błędny, struktura uzgodniona" nie była ćwiczona. Host ją odsłonił; poprawka (zamrożenie 3) jest obojętna dla
   28 nagranych biegów i potwierdzona drugim biegiem hosta.
3. Restart kontenera w trakcie przebiegów (bez utraty danych; przerwane biegi powtórzone, zapis w protokole roboczym).

## 8. Co nadal nie ma drogi do geometrii

Wymienione w ADR jako „nazwane i niezbudowane": wnęki, podcienie, wykusze, lukarny, balkony, daszki, wiaty, tarasy
(zgłaszane w `notVolumes`); **podbitka / podsufitka** (brak pola i konsumenta); otwór ze skośną głowicą (prostokąt
ograniczający); kondygnacje jako osobne poziomy z własnymi rzutami; długość kalenicy dachu kopertowego; dachy
krzyżujące się bez uskoku obrysu; ukierunkowany drugi odczyt fragmentu przy sporze. Wnęki są dziś najczęstszym
pojedynczym powodem, dla którego dom o poprawnej bryle nie jest „użyteczny" (Novara, Sakura, Fabia, Medulin).

Odczyt struktury podaje wysokości okapu i kalenicy ze statusem; do budowy trafia tylko kąt (uzgodniony albo
wydrukowany / wyliczony) i okap wydrukowany / wyliczony. Kotwy obrazu i skala dla wartości wyliczonych są zapisywane
dla otworów (szkic → skala rzutu → metry) — dla liczb odczytu struktury nie ma jeszcze kotew, jest sam status.

## 9. Budżet

Ta sama księga (`research/ai-assist/spend-ledger-v35417r3.json`), bez nowej puli, pułap 68,542857 USD.

| | USD | Żądań |
|---|---|---|
| Stan na początku etapu (zweryfikowany: po v3.54.19 nie było późniejszych kosztów) | 49,679019 | |
| Próba odczytu struktury na nagraniach (diagnoza) | 0,5289 | 21 |
| Odczyty brakujące w odtworzeniach DEV (odczyt struktury, listy otworów; przebiegi d1–d5) | 1,2971 | 37 |
| NEW-G: B i F na żywo (8 biegów) | 2,2702 | 79 |
| NEW-G: odtworzenia F2, F2@B, F3 | 0,2701 | 6 |
| Host: dwa biegi (Skagen + Amber IV; Skagen ponownie) | 2,2451 | 52 |
| **Etap razem** | **6,611434** | 195 |
| Stan po etapie | 56,290453 | |
| Nominalnie pozostało | 12,252404 | |

Plan etapu (≤ 9 USD) dotrzymany. Koszt odczytu struktury: 0,02–0,06 USD na dom. Host kosztował więcej niż planowane
1,5 USD, bo powtórzyłem go po poprawce arbitrażu.

## 10. Host na finalnej rewizji

Dwa biegi `v35419/host-e2e.mjs` przez publiczny punkt wejścia, pilot z odczytem metrycznym i szkicami.

| Bieg | Budowa | Wynik |
|---|---|---|
| 1 | `c153739` (kod zamrożenia 2) | 53 kontrole OK. Skagen: 0,542 USD / 14 żądań — **bryła LOCAL, parterowa** (luka z §7.4.2). Amber IV: 1,013 USD / 21 żądań — bryła główna + skrzydło z kalenicą poprzeczną. Ponowienie: te same bajty, **0 żądań, 0 USD**. Bez tokenu: **0 żądań**. |
| 2 | `108611e` (kod oddawany) | wszystkie kontrole OK. Skagen: 0,690 USD / 17 żądań — LOCAL zakwestionowany przez uzgodnioną strukturę, bryła ze źródeł: dwie bryły, okap bryły głównej 6,0 m, dach 30°, kalenica wzdłuż frontu, 16 otworów, 5 ścian wewnętrznych. Ponowienie: te same bajty, **0 żądań, 0 USD**. Bez tokenu: **0 żądań**. |

Oba modele hosta są w APK jako sceny `skagen-host-v35420` i `amber-host-v35420`.

## 11. Testy

- Nowe: `structure-v35420.test.ts` (25 testów: typowana odpowiedź i jej sprzeczności, werdykt wobec dachów, uzgodnienie
  ze świadkami, budowa wg struktury z kontrpróbami, reguła jednej kondygnacji, struktura trzymana wobec bryły),
  `readback-v35420.test.ts` (7), `plan-skeleton-v35419.test.ts` (+1), `owner-v35420.test.ts` (4: kolejność scen,
  nazwane regresy, pieczęcie, struktura w zapieczętowanych modelach).
- Pakiet analizatora i macierz całego repozytorium: wynik w §11.1 poniżej.

### 11.1 Wynik

- `packages/analysis-service`: 59 plików, **815 / 815**.
- `packages/mobile-scene`: 19 plików, **130 / 130** (pozycje starszych scen przesunięte o 26; nowy `owner-v35420.test.ts`).
- Pełna macierz na finalnej rewizji: 403 pliki, **4658 przeszło, 18 nie przeszło, 11 pominiętych**. Te 18 to dokładnie
  ta sama lista co w v3.54.19 (porównane nazwa po nazwie): 14 testów `tests/architecture/*` i 2 `apps/local-analyzer/*`
  (zastane, zależne od historii repozytorium i od zasobów spoza sesji) oraz 2 testy czasowe
  `apps/analyzer-api/test/worker.test.ts`. Żaden nie dotyczy kodu zmienionego w tym etapie. Nie naprawiałem ich
  i nie wyłączałem.
- `tsc -p tsconfig.json --noEmit`: czysto.
- Pod obciążeniem (równoległe odtworzenia) pakiet analizatora dwukrotnie kończył się błędem czasu workera vitest bez
  czerwonego testu; wynik powyżej pochodzi z biegu na wolnej maszynie.

## 12. APK

`BuildPlan-Model-Preview-1353-arm64-v8a.apk`, 54 966 896 B, SHA-256
`371c7721cd3f14f946f74df5345f6ab0dbec1eb9484c5fa90d6c42e76c3900da`, wersja 1353 (`0.1353.0-owner`), ten sam podpis co
1349–1352 (instaluje się na nich). 96 scen; pierwsze 26 to ten etap: cztery domy NEW-G, 20 domów DEV (najpierw te,
które zmieniła uzgodniona struktura; regresy nazwane w tytułach), dwa modele z hosta. Klucz dostawcy: 0 wystąpień
w pliku i w rozpakowanej zawartości. **Na urządzeniu niesprawdzony.** Zapis: `stage-reports/artifacts/v35420/VERSION-1353.txt`.

## 13. Dostawa

Prywatne archiwa (rysunki wydawców — nie do publikacji), każde poniżej 30 000 000 B, z manifestem SHA-256 i instrukcją
łączenia: raport i galeria, plansze oceny ślepej z kluczami i wynikami, domy (oryginały, szkice PNG/SVG/JSON, surowe
odpowiedzi, modele każdego wariantu, rendery, nakładki ścian na rzut, tablice porównawcze źródło / 1352 / końcowy).
Dla NEW-G także wariant „zamrożenie 1" (pierwszy bieg) obok kodu oddawanego. Lista plików: `README_V35420.md`.

## 14. Rekomendacja następnego kroku

1. **Spójność skali między elewacjami jako bramka hipotezy bryły** — usuwa regres Ametystu i tę klasę błędu „stron
   z odczytu"; hipoteza wymagająca dwóch skal dla jednego kompletu elewacji jest obalona.
2. **Wnęki i podcienie jako cecha obrysu z konsumentem** — dziś najczęstszy powód „bryła dobra, dom nieużyteczny".
3. **Dachy krzyżujące się bez uskoku obrysu** (Amarylis, Juliusz, Rockville, Mindelo od ogrodu): poprzeczny szczyt jako
   element dachu bryły, nie jako osobna bryła; do tego czasu nie obracać kalenicy na podstawie części, której nie da
   się zbudować.
4. **Ukierunkowany drugi odczyt przy sporze** (rodzaj dachu DISPUTED, strony elewacji przy remisie rzutu) zamiast
   konwencji.
5. Drzwi wejściowe: Rockville, Ametyst, G6, Eliza i Juliusz nadal ich nie mają — otwór rysowany w rzucie i w elewacji
   powinien mieć pierwszeństwo przed bramką kontrastu.

## Załącznik A. Co powstało i ocena ślepa (generowane: `v35420/delivery/tables.py`)

Wariant „końcowy" = kod zamrożenia 2 (oceniany); na NEW-G identyczny co do bajta z pierwszym biegiem odłożonym.

| Dom | Zbiór | Kod 1352 (baseline) | Kod końcowy | Przerwy rzutu pokryte otworem (1352 → końcowy) |
|---|---|---|---|---|
| Alaska (Studio Atrium) | DEV | ze źródeł; dach: dwusp. 38.2°; ściany wewn. 11 (drzwi 6); otwory zewn. 11; okna poł. 8; kominy 2 | ze źródeł; dach: dwusp. 38.2°; ściany wewn. 11 (drzwi 6); otwory zewn. 11; okna poł. 8; kominy 2 | 8/8 (+1 na pełnej ścianie) → 8/8 (+1 na pełnej ścianie) |
| Aurora maxi II bis sz (Studio Atrium) | DEV | ze źródeł; dach: dwusp. 35°; ściany wewn. 15 (drzwi 7); otwory zewn. 10; okna poł. 1; kominy 3 | ze źródeł; dach: dwusp. 37°; ściany wewn. 15 (drzwi 7); otwory zewn. 10; okna poł. 1; kominy 3 | 8/9 (+2 na pełnej ścianie) → 8/9 (+2 na pełnej ścianie) |
| Ballina (Lipińscy) | DEV | ze źródeł; dach: dwusp. 30.8°; ściany wewn. 10 (drzwi 7); otwory zewn. 10; okna poł. 0; kominy 0 | ze źródeł; dach: dwusp. 30.8°; ściany wewn. 10 (drzwi 7); otwory zewn. 10; okna poł. 0; kominy 0 | 11/11 → 11/11 |
| Alberto (Studio Atrium) | DEV | ze źródeł; dach: dwusp. 25.2°; ściany wewn. 16 (drzwi 8); otwory zewn. 9; okna poł. 0; kominy 2 | ze źródeł; dach: dwusp. 25.2°; ściany wewn. 16 (drzwi 8); otwory zewn. 9; okna poł. 0; kominy 3 | 9/9 → 9/9 |
| Medulin (Lipińscy) | DEV | LOCAL; dach: płaski, płaski, płaski, dwusp. 45°; ściany wewn. 25 (drzwi 9); otwory zewn. 24; okna poł. 0; kominy 2 | ze źródeł; dach: dwusp. 46.6°; ściany wewn. 10 (drzwi 6); otwory zewn. 15; okna poł. 7; kominy 1 | — → 6/6 (+6 na pełnej ścianie) |
| Domek letniskowy nad jeziorkiem (ARCHON) | DEV | LOCAL; dach: dwusp. 30°; ściany wewn. 5 (drzwi 2); otwory zewn. 7; okna poł. 0; kominy 1 | LOCAL; dach: dwusp. 30°; ściany wewn. 5 (drzwi 2); otwory zewn. 7; okna poł. 0; kominy 1 | — → — |
| Mindelo (Lipińscy) | DEV | LOCAL; dach: płaski, płaski, płaski, płaski, dwusp. 30°; ściany wewn. 15 (drzwi 11); otwory zewn. 19; okna poł. 0; kominy 2 | ze źródeł; dach: dwusp. 37°, dwusp. 27.3°; ściany wewn. 15 (drzwi 11); otwory zewn. 13; okna poł. 0; kominy 2 | — → 7/11 (+6 na pełnej ścianie) |
| Dom pod sakurą E (ARCHON) | DEV | ze źródeł; dach: 4 połaci; ściany wewn. 20 (drzwi 11); otwory zewn. 11; okna poł. 0; kominy 3 | ze źródeł; dach: 4 połaci; ściany wewn. 20 (drzwi 11); otwory zewn. 11; okna poł. 0; kominy 3 | 7/8 (+4 na pełnej ścianie) → 7/8 (+4 na pełnej ścianie) |
| G6 (garaż ze strychem — nie dom mieszkalny) (Dobre Domy) | DEV | ze źródeł; dach: 4 połaci; ściany wewn. 0 (drzwi 0); otwory zewn. 5; okna poł. 0; kominy 0 | ze źródeł; dach: 4 połaci; ściany wewn. 0 (drzwi 0); otwory zewn. 3; okna poł. 0; kominy 0 | 4/4 (+1 na pełnej ścianie) → 3/4 |
| Aletta New (Studio Atrium) | DEV | ze źródeł; dach: dwusp. 42.7°, dwusp. 35°; ściany wewn. 10 (drzwi 3); otwory zewn. 15; okna poł. 8; kominy 2 | ze źródeł; dach: dwusp. 37.6°, dwusp. 20.6°; ściany wewn. 11 (drzwi 3); otwory zewn. 14; okna poł. 8; kominy 2 | 9/11 (+3 na pełnej ścianie) → 10/12 (+2 na pełnej ścianie) |
| Novara (Lipińscy) | DEV | ze źródeł; dach: dwusp. 30°; ściany wewn. 10 (drzwi 8); otwory zewn. 13; okna poł. 0; kominy 0 | ze źródeł; dach: dwusp. 27.8°; ściany wewn. 10 (drzwi 8); otwory zewn. 13; okna poł. 0; kominy 0 | 11/11 (+2 na pełnej ścianie) → 11/11 (+2 na pełnej ścianie) |
| Jarzębina (Dobre Domy) | DEV | ze źródeł; dach: dwusp. 46.3°; ściany wewn. 15 (drzwi 4); otwory zewn. 12; okna poł. 3; kominy 2 | ze źródeł; dach: dwusp. 46.3°; ściany wewn. 15 (drzwi 4); otwory zewn. 14; okna poł. 3; kominy 3 | 9/12 (+1 na pełnej ścianie) → 10/12 (+1 na pełnej ścianie) |
| Willa Eliza 5 G2 (ARCHON) | DEV | ze źródeł; dach: dwusp. 28.3°, dwusp. 41.7°, dwusp. 28.3°; ściany wewn. 10 (drzwi 4); otwory zewn. 10; okna poł. 0; kominy 4 | ze źródeł; dach: 12 połaci; ściany wewn. 10 (drzwi 4); otwory zewn. 11; okna poł. 0; kominy 6 | 5/7 (+2 na pełnej ścianie) → 6/7 (+1 na pełnej ścianie) |
| Amarylis (Studio Atrium) | DEV | ze źródeł; dach: dwusp. 33.9°, dwusp. 42°, dwusp. 25°; ściany wewn. 12 (drzwi 8); otwory zewn. 5; okna poł. 1; kominy 0 | ze źródeł; dach: dwusp. 46.1°, dwusp. 44.7°, dwusp. 36.5°; ściany wewn. 12 (drzwi 8); otwory zewn. 10; okna poł. 2; kominy 3 | 1/7 (+2 na pełnej ścianie) → 6/7 (+3 na pełnej ścianie) |
| Oban III (Lipińscy) | DEV | ze źródeł; dach: dwusp. 31.5°; ściany wewn. 8 (drzwi 3); otwory zewn. 8; okna poł. 0; kominy 1 | ze źródeł; dach: dwusp. 31.5°; ściany wewn. 8 (drzwi 3); otwory zewn. 8; okna poł. 0; kominy 1 | 8/8 (+1 na pełnej ścianie) → 8/8 (+1 na pełnej ścianie) |
| Juliusz Nowy (Dobre Domy) | DEV | ze źródeł; dach: dwusp. 37.4°; ściany wewn. 11 (drzwi 7); otwory zewn. 4; okna poł. 0; kominy 2 | ze źródeł; dach: dwusp. 37.4°; ściany wewn. 11 (drzwi 7); otwory zewn. 4; okna poł. 0; kominy 3 | 3/9 → 3/9 |
| Ametyst New (Studio Atrium) | DEV | ze źródeł; dach: dwusp. 32.4°; ściany wewn. 12 (drzwi 6); otwory zewn. 9; okna poł. 1; kominy 0 | ze źródeł; dach: dwusp. 35.2°; ściany wewn. 12 (drzwi 6); otwory zewn. 9; okna poł. 1; kominy 1 | 1/3 (+8 na pełnej ścianie) → 4/9 (+3 na pełnej ścianie) |
| Skagen (Lipińscy) | DEV | ze źródeł; dach: dwusp. 48.2°; ściany wewn. 0 (drzwi 0); otwory zewn. 9; okna poł. 2; kominy 0 | ze źródeł; dach: dwusp. 30°, dwusp. 30°; ściany wewn. 5 (drzwi 2); otwory zewn. 16; okna poł. 2; kominy 0 | 4/5 (+4 na pełnej ścianie) → 5/5 (+4 na pełnej ścianie) |
| Fabia (Dobre Domy) | DEV | ze źródeł; dach: dwusp. 28.8°; ściany wewn. 18 (drzwi 9); otwory zewn. 4; okna poł. 0; kominy 0 | ze źródeł; dach: 4 połaci; ściany wewn. 18 (drzwi 9); otwory zewn. 11; okna poł. 0; kominy 2 | 2/11 (+2 na pełnej ścianie) → 8/11 (+4 na pełnej ścianie) |
| Dom pod pomarańczą 2 (ARCHON) | DEV | LOCAL; dach: dwusp. 30°; ściany wewn. 16 (drzwi 10); otwory zewn. 11; okna poł. 1; kominy 3 | LOCAL; dach: dwusp. 30°; ściany wewn. 16 (drzwi 10); otwory zewn. 11; okna poł. 1; kominy 3 | — → — |
| Amber IV (Studio Atrium) | NEW-G | ze źródeł; dach: dwusp. 24.7°, dwusp. 33°; ściany wewn. 17 (drzwi 9); otwory zewn. 11; okna poł. 1; kominy 3 | ze źródeł; dach: dwusp. 30°, dwusp. 33.2°; ściany wewn. 12 (drzwi 7); otwory zewn. 10; okna poł. 1; kominy 3 | 11/14 → 10/14 |
| Rockville (Lipińscy) | NEW-G | ze źródeł; dach: dwusp. 33.1°; ściany wewn. 0 (drzwi 0); otwory zewn. 9; okna poł. 2; kominy 1 | ze źródeł; dach: dwusp. 29.8°; ściany wewn. 14 (drzwi 8); otwory zewn. 9; okna poł. 2; kominy 1 | — → 5/5 (+4 na pełnej ścianie) |
| Basia i Adam (Dobre Domy) | NEW-G | LOCAL; dach: dwusp. 30°; ściany wewn. 36 (drzwi 4); otwory zewn. 20; okna poł. 0; kominy 0 | LOCAL; dach: dwusp. 30°; ściany wewn. 36 (drzwi 4); otwory zewn. 20; okna poł. 0; kominy 0 | — → — |
| Dom pod jarząbem 25 (ARCHON) | NEW-G | LOCAL; dach: dwusp. 30°; ściany wewn. 12 (drzwi 7); otwory zewn. 11; okna poł. 0; kominy 5 | LOCAL; dach: dwusp. 30°; ściany wewn. 12 (drzwi 7); otwory zewn. 11; okna poł. 0; kominy 5 | — → — |

| Zbiór | Domów | Model (1352 → końcowy) | Model ze ścianami wewnętrznymi (1352 → końcowy) |
|---|---|---|---|
| DEV | 20 | 20 → 20 | 18 → 19 |
| NEW-G | 4 | 4 → 4 | 3 → 4 |

| Dom | Zbiór | Użyteczna: 1352 | Użyteczna: końcowy | Bliżej źródła | Uwaga oceniającego |
|---|---|---|---|---|---|


| Alaska | DEV | TAK | TAK | REMIS | Oba warianty są piksel w piksel identyczne. Bryła, dach, otwory i okna połaciowe zgodne ze źródłem; brak daszku nad wejściem i ciemnego drewna w białej ramie na szczytach (szczyty są gładkie). |
| Aurora maxi II bis sz | DEV | TAK | TAK | 1352 | Warianty niemal identyczne; różnica minimalna: w X okap schodzi na górę okien (małe okno frontu prawie znika, ściana niższa niż w źródle), w Y okna są całe i proporcja ściany do dachu bliższa. W obu brak pasów drewna między oknami, w szczycie zamiast okna naro |
| Ballina | DEV | TAK | TAK | REMIS | Warianty są wizualnie identyczne (różnica pikseli tylko w podpisie). Model zgodny ze źródłem w bryle i otworach wszystkich stron; odstępstwa drobne: strefa cegły na froncie jest wąskim pasem przy cokole z lewej zamiast prawej połowy ściany, okna podciągnięte p |
| Alberto | DEV | TAK | TAK | 1352 | Oba warianty niemal identyczne i zgodne ze źródłem w bryle i otworach; brak podcienia ze słupami i przedłużonej połaci. Jedyna różnica: Y ma trzeci, nadmiarowy komin na lewym końcu kalenicy (źródło: 2). |
| Medulin | DEV | NIE | NIE | końcowy | X to czytelny Medulin: wąska bryła ze stromym dwuspadem, brama i drzwi w szczycie, narożne przeszklenie od tyłu; brakuje tylko wcięcia tarasu, a dwa wysokie okna lewego boku są narysowane jako drzwi. Y rozpada się na bryłę z dachem i płaskie pudła z attykami,  |
| Domek letniskowy nad jeziorkiem | DEV | TAK | TAK | REMIS | Oba warianty identyczne. Bryła, dach nad otwartym tarasem i otwory wszystkich stron zgodne; brak ażurowej osłony tarasu, pasa drewna i szarego panelu betonowego. |
| Mindelo | DEV | NIE | NIE | końcowy | Y ma rzut „T” z wysuniętym skrzydłem garażu pod poprzecznym szczytem w drewnie, podwójną bramę, wejście obok niej i pas dużych przeszkleń od tyłu – brakuje mu tylnego szczytu nad tarasem i przeszkleń w szczytach bocznych. X to jedna długa ciemna bryła z płaski |
| Dom pod sakurą E | DEV | NIE | NIE | REMIS | Oba warianty identyczne. Dach kopertowy, proporcje i otwory zgodne ze źródłem; brak wnęk wejścia i tarasu, trzy kominy zamiast jednego–dwóch, ściany bez grafitu i drewna. |
| G6 (garaż ze strychem — nie dom mieszkalny) | DEV | NIE | NIE | 1352 | Oba warianty: poprawny dach czterospadowy, cegła, brama z lewej, ślepy tył – ale bez drzwi wejściowych, słupów podcienia i szczycika nad oknem. X ma podwójne okno na obu bokach (jak źródło), Y tylko na jednym – drugi bok jest ślepy. |
| Aletta New | DEV | TAK | TAK | 1352 | X: skrzydło garażu ma tę samą głębokość co bryła główna (w źródle jest węższe), brak zastrzałów i tarasu. Y: dach garażu zbyt płaski i niski, w szczycie od strony garażu brak okna poddasza i drewna, komin przesunięty na koniec kalenicy; za to skrzydło jest węż |
| Novara | DEV | NIE | NIE | REMIS | Warianty różnią się tylko o włos proporcją dachu do ściany (X ma nieco stromszy dach i niższą ścianę, Y odwrotnie) — żaden nie jest wyraźnie bliżej. W obu brak wnęki wejściowej i pasa drewna na froncie; otwory wszystkich stron trafione. |
| Jarzębina | DEV | NIE | NIE | końcowy | Front i tył obu wariantów dobrze oddają parter źródła (okno, drzwi, brama; drzwi tarasowe i trzy okna połaciowe), ale brakuje wystawki ze szczytem i balkonem nad wejściem oraz wysuniętego garażu. Y ma okna poddasza w obu szczytach (X ma jeden szczyt ślepy), za |
| Willa Eliza 5 G2 | DEV | NIE | NIE | końcowy | Y ma dachy kopertowe, dwie kondygnacje i szeroką bramę garażową po prawej stronie frontu, ale garaż siedzi w piętrowej bryle, front nie ma drzwi ani okien piętra, a między bryłami sterczy stromy klin dachu i ok. 7 wysokich kominów. X to parterowo-poddaszowa br |
| Amarylis | DEV | NIE | NIE | 1352 | X oddaje tożsamość bryły (skrzydło garażu z lewej, duży szczyt frontowy z dwoma otworami poddasza, wejście z grafitową płytą), ale trzy pozostałe elewacje są ślepe i nie ma kominów. Y ma otwory na wszystkich stronach, lecz zgubił krzyżujące się kalenice (brak  |
| Oban III | DEV | TAK | TAK | REMIS | Warianty są wizualnie identyczne (różnica pikseli tylko w podpisie). Model zgodny ze źródłem: prostokąt pod dachem dwuspadowym, drzwi pośrodku frontu z oknami po bokach, trzy przeszklenia do podłogi od tyłu, okno w jednym szczycie, komin, cokół; brakuje tylko  |
| Juliusz Nowy | DEV | NIE | NIE | 1352 | Oba warianty to ten sam prosty „domek” ze szczytem od frontu: jedno okno poddasza, jedno okno parteru, dwa okienka z boku, bez drzwi, bramy, garażu, balkonów i lukarny – daleko od źródła. Jedyna różnica: X ma trzeci, nadmiarowy komin (źródło i Y: 2), stąd mini |
| Ametyst New | DEV | NIE | NIE | 1352 | W obu wariantach na froncie-szczycie nie ma drzwi wejściowych, a szczyty nie mają drewna. Y ma poprawny układ (kalenica wzdłuż 12,95 m, szczyty na krótszych bokach), X ma wymiary zamienione – szczyt na dłuższym boku i przez to ogromny dach; X ma 1 komin, Y żad |
| Skagen | DEV | NIE | TAK | końcowy | Y odtwarza piętrową bryłę główną z niższym skrzydłem garażu po prawej i komplet otworów obu kondygnacji na froncie, tyle i lewym szczycie; brakuje okładziny piętra, okien połaciowych i paneli od tyłu. X spłaszcza dom do parteru pod jednym ogromnym dachem dwusp |
| Fabia | DEV | NIE | NIE | końcowy | X ma dach dwuspadowy i puste trzy elewacje. Y ma poprawny dach kopertowy, dwa kominy oraz otwory tyłu i boku z trzema oknami; brakuje wnęki wejściowej i wnęki tarasu (w ich miejscu płaskie pola okładziny) oraz dużego przeszklenia tarasowego na boku. |
| Dom pod pomarańczą 2 | DEV | TAK | TAK | REMIS | Oba warianty identyczne. Wąska długa bryła i otwory boków zgodne; od ogrodu zamiast przeszklenia do podłogi jest poziome okno w polu drewna, bez wnęki zadaszonego tarasu, a drzwi frontu nie odróżniają się od okładziny. |
| Amber IV | NEW-G | NIE | TAK | końcowy | X: obrys L jest, ale dach to jedna ogromna połać bez tylnego szczytu, a przy lewym narożniku stoi od ziemi wielki słup-komin. Y: poprawny układ dachów (połać od frontu, szczyt skrzydła od tyłu), ale na boku tarasowym zamiast dużego przeszklenia jest jedno wąsk |
| Rockville | NEW-G | NIE | NIE | 1352 | Oba warianty to prosty prostokąt pod jednym dachem dwuspadowym: okna frontu i tyłu oraz boki zgadzają się ze źródłem, ale nie ma drzwi wejściowych, podcienia ani poprzecznych szczytów (front, ogród) i jest 1 komin zamiast 2. Różnice drobne: Y ma lewy szczyt w  |
| Basia i Adam | NEW-G | NIE | NIE | REMIS | Oba warianty identyczne. Model to parterowy prostopadłościan z jednym dachem; z rezydencji o wielu szczytach zostały tylko długość, jedna brama garażowa po prawej (w źródle dwie) i wejście pośrodku. |
| Dom pod jarząbem 25 | NEW-G | TAK | TAK | końcowy | Warianty różnią się tylko prawym przeszkleniem tarasowym od tyłu: w X jest szerokie i wysokie jak w źródle, w Y węższe i niższe. W obu środkowe przeszklenie tyłu jest zwykłym oknem, a w szczycie zamiast wąskiego wysokiego okna są drzwi. |

| Dom | Zbiór | 1352: ściany rzutu obecne / rysowane; zmyślone / ścian modelu; obrys | Końcowy: to samo | Wnętrze zgodne (1352 → końcowy) |
|---|---|---|---|---|


| Alaska | DEV | 10/10; 0/10; TAK | 10/10; 0/10; TAK | TAK → TAK |
| Aurora maxi II bis sz | DEV | 13/14; 0/13; TAK | 13/14; 0/13; TAK | TAK → TAK |
| Ballina | DEV | 9/10; 1/10; TAK | 9/10; 1/10; TAK | TAK → TAK |
| Alberto | DEV | 14/15; 1/15; TAK | 14/15; 1/15; TAK | TAK → TAK |
| Medulin | DEV | 7/10; 1/9; TAK | 10/10; 0/10; UPROSZCZONY | TAK → TAK |
| Domek letniskowy nad jeziorkiem | DEV | 5/5; 0/5; TAK | 5/5; 0/5; TAK | TAK → TAK |
| Mindelo | DEV | 14/19; 0/14; UPROSZCZONY | 15/19; 0/15; UPROSZCZONY | TAK → TAK |
| Dom pod sakurą E | DEV | 16/17; 0/17; UPROSZCZONY | 16/17; 0/17; UPROSZCZONY | TAK → TAK |
| G6 (garaż ze strychem — nie dom mieszkalny) | DEV | 0/0; 0/0; UPROSZCZONY | 0/0; 0/0; UPROSZCZONY | TAK → TAK |
| Aletta New | DEV | 8/10; 1/10; UPROSZCZONY | 8/10; 2/11; TAK | TAK → TAK |
| Novara | DEV | 8/10; 0/8; TAK | 8/10; 0/8; TAK | TAK → TAK |
| Jarzębina | DEV | 11/11; 1/12; UPROSZCZONY | 11/11; 1/12; UPROSZCZONY | TAK → TAK |
| Willa Eliza 5 G2 | DEV | 10/11; 0/10; UPROSZCZONY | 10/11; 0/10; UPROSZCZONY | TAK → TAK |
| Amarylis | DEV | 9/12; 3/12; UPROSZCZONY | 9/12; 3/12; UPROSZCZONY | NIE → NIE |
| Oban III | DEV | 8/8; 0/8; UPROSZCZONY | 8/8; 0/8; UPROSZCZONY | TAK → TAK |
| Juliusz Nowy | DEV | 10/10; 2/12; UPROSZCZONY | 10/10; 2/12; UPROSZCZONY | TAK → TAK |
| Ametyst New | DEV | 11/12; 0/11; UPROSZCZONY | 11/12; 0/11; UPROSZCZONY | TAK → TAK |
| Skagen | DEV | 0/8; 0/0; UPROSZCZONY | 6/8; 0/6; UPROSZCZONY | NIE → TAK |
| Fabia | DEV | 13/13; 1/14; UPROSZCZONY | 13/13; 1/14; UPROSZCZONY | TAK → TAK |
| Dom pod pomarańczą 2 | DEV | 14/14; 0/14; TAK | 14/14; 0/14; TAK | TAK → TAK |
| Amber IV | NEW-G | 10/10; 2/12; TAK | 9/10; 1/10; TAK | TAK → TAK |
| Rockville | NEW-G | 0/13; 0/0; UPROSZCZONY | 13/13; 0/13; UPROSZCZONY | NIE → TAK |
| Basia i Adam | NEW-G | 1/15; 9/10; UPROSZCZONY | 1/15; 9/10; UPROSZCZONY | NIE → NIE |
| Dom pod jarząbem 25 | NEW-G | 12/14; 0/12; TAK | 12/14; 0/12; TAK | TAK → TAK |

## Załącznik B. Forma, zastosowanie danych, liczby niższe niż w baseline (generowane: `v35420/delivery/account.py`)

Kierunek kalenicy i front są liczone w układzie modelu: dom obrócony w całości (Ametyst New) ma tu zgodny kierunek
kalenicy względem własnego frontu — błąd frontu łapie cecha S oceny ślepej, nie ta tabela.

### A. Forma oddanego modelu wobec czterech faktów ze źródeł

| Dom | Zbiór | Źródło: bryły / dach / kalenica / kondygnacje | Kod 1352 (baseline) | Kod oddawany (zamrożenie 2) | Zamrożenie 1 — pierwszy wynik (F) | Kod oddawany na odczytach biegu baseline (F2@B) |
|---|---|---|---|---|---|---|
| Alaska | DEV | 1 / dwuspadowy / prostopadła do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica prostopadła do frontu ✓; ściany do 3.84 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica prostopadła do frontu ✓; ściany do 3.84 m = 1 kond. ✓ **4/4** | — | — |
| Aurora maxi II bis sz | DEV | 2 / dwuspadowy / równoległa do frontu / 1 | brył 1 ✗; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.27 m = 1 kond. ✓ | brył 1 ✗; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.99 m = 1 kond. ✓ | — | — |
| Ballina | DEV | 1 / dwuspadowy / równoległa do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.87 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.87 m = 1 kond. ✓ **4/4** | — | — |
| Alberto | DEV | 1 / dwuspadowy / równoległa do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.17 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.17 m = 1 kond. ✓ **4/4** | — | — |
| Medulin | DEV | 1 / dwuspadowy / prostopadła do frontu / 1 | brył 3 ✗; płaski ✗; kalenica — ✗; ściany do 2.80 m = 1 kond. ✓ | brył 1 ✓; dwuspadowy ✓; kalenica prostopadła do frontu ✓; ściany do 3.37 m = 1 kond. ✓ **4/4** | — | — |
| Domek letniskowy nad jeziorkiem | DEV | 1 / dwuspadowy / równoległa do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.80 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.80 m = 1 kond. ✓ **4/4** | — | — |
| Mindelo | DEV | 2 / dwuspadowy / równoległa do frontu / 1 | brył 2 ✓; płaski ✗; kalenica — ✗; ściany do 2.80 m = 1 kond. ✓ | brył 2 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.42 m = 1 kond. ✓ **4/4** | — | — |
| Dom pod sakurą E | DEV | 1 / czterospadowy / równoległa do frontu / 1 | brył 1 ✓; czterospadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.64 m = 1 kond. ✓ **4/4** | brył 1 ✓; czterospadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.64 m = 1 kond. ✓ **4/4** | — | — |
| G6 (garaż ze strychem — nie dom mieszkalny) | DEV | 1 / czterospadowy / — / 1 | brył 1 ✓; czterospadowy ✓; kalenica równoległa do frontu —; ściany do 2.86 m = 1 kond. ✓ **4/4** | brył 1 ✓; czterospadowy ✓; kalenica równoległa do frontu —; ściany do 2.87 m = 1 kond. ✓ **4/4** | — | — |
| Aletta New | DEV | 2 / dwuspadowy / równoległa do frontu / 1 | brył 2 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.51 m = 1 kond. ✓ **4/4** | brył 2 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 4.14 m = 1 kond. ✓ **4/4** | — | — |
| Novara | DEV | 1 / dwuspadowy / równoległa do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.85 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.09 m = 1 kond. ✓ **4/4** | — | — |
| Jarzębina | DEV | 1 / dwuspadowy / równoległa do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.65 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.65 m = 1 kond. ✓ **4/4** | — | — |
| Willa Eliza 5 G2 | DEV | 2/3 / czterospadowy / — / 2 | brył 3 ✓; dwuspadowy ✗; kalenica równoległa do frontu —; ściany do 4.44 m = 2 kond. ✓ | brył 3 ✓; czterospadowy ✓; kalenica prostopadła do frontu —; ściany do 5.92 m = 2 kond. ✓ **4/4** | — | — |
| Amarylis | DEV | 2 / dwuspadowy / — / 1 | brył 3 ✗; dwuspadowy ✓; kalenica prostopadła do frontu —; ściany do 6.05 m = 2 kond. ✗ | brył 3 ✗; dwuspadowy ✓; kalenica równoległa do frontu —; ściany do 3.19 m = 1 kond. ✓ | — | — |
| Oban III | DEV | 1 / dwuspadowy / równoległa do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.76 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.76 m = 1 kond. ✓ **4/4** | — | — |
| Juliusz Nowy | DEV | 1/2 / dwuspadowy / — / 1 | brył 1 ✓; dwuspadowy ✓; kalenica prostopadła do frontu —; ściany do 2.97 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica prostopadła do frontu —; ściany do 2.97 m = 1 kond. ✓ **4/4** | — | — |
| Ametyst New | DEV | 1 / dwuspadowy / prostopadła do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica prostopadła do frontu ✓; ściany do 2.79 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica prostopadła do frontu ✓; ściany do 3.42 m = 1 kond. ✓ **4/4** | — | — |
| Skagen | DEV | 2 / dwuspadowy / równoległa do frontu / 2 | brył 1 ✗; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.06 m = 1 kond. ✗ | brył 2 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 5.71 m = 2 kond. ✓ **4/4** | — | — |
| Fabia | DEV | 1 / czterospadowy / — / 1 | brył 1 ✓; dwuspadowy ✗; kalenica prostopadła do frontu —; ściany do 2.62 m = 1 kond. ✓ | brył 1 ✓; czterospadowy ✓; kalenica równoległa do frontu —; ściany do 2.91 m = 1 kond. ✓ **4/4** | — | — |
| Dom pod pomarańczą 2 | DEV | 1 / dwuspadowy / prostopadła do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica prostopadła do frontu ✓; ściany do 3.10 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica prostopadła do frontu ✓; ściany do 3.10 m = 1 kond. ✓ **4/4** | — | — |
| Amber IV | NEW-G | 1/2 / dwuspadowy / równoległa do frontu / 1 | brył 2 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.81 m = 1 kond. ✓ **4/4** | brył 2 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.31 m = 1 kond. ✓ **4/4** | brył 2 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.31 m = 1 kond. ✓ **4/4** | brył 2 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.26 m = 1 kond. ✓ **4/4** |
| Rockville | NEW-G | 1/2 / dwuspadowy / równoległa do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.52 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.77 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.77 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 2.52 m = 1 kond. ✓ **4/4** |
| Basia i Adam | NEW-G | 2/3/4 / dwuspadowy / równoległa do frontu / 1 | brył 4 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 4.44 m = 2 kond. ✗ | brył 4 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 4.44 m = 2 kond. ✗ | brył 4 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 4.44 m = 2 kond. ✗ | brył 4 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 4.44 m = 2 kond. ✗ |
| Dom pod jarząbem 25 | NEW-G | 1 / dwuspadowy / równoległa do frontu / 1 | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.29 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.29 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.29 m = 1 kond. ✓ **4/4** | brył 1 ✓; dwuspadowy ✓; kalenica równoległa do frontu ✓; ściany do 3.29 m = 1 kond. ✓ **4/4** |

| Zbiór | Domów | Kod 1352 (baseline): forma zgodna 4/4 (modeli) | Kod oddawany (zamrożenie 2): forma zgodna 4/4 (modeli) | Zamrożenie 1 — pierwszy wynik (F): forma zgodna 4/4 (modeli) | Kod oddawany na odczytach biegu baseline (F2@B): forma zgodna 4/4 (modeli) |
|---|---|---|---|---|---|
| DEV | 20 | 13 (20) | 18 (20) | 0 (0) | 0 (0) |
| NEW-G | 4 | 3 (4) | 3 (4) | 3 (4) | 3 (4) |

### B. Zastosowanie danych w kodzie końcowym (odczyt zwrotny z oddanego modelu)

| Dom | Zbiór | Stan własności odczytu struktury | Przyjęte własności struktury w modelu | Otwory zewn.: zbudowane / związane / zgodne ≤ 5 mm / różne / błąd sumy / poza ścianą |
|---|---|---|---|---|
| Alaska | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 4/4 | 11 / 11 / 11 / 0 / 0 / 0 |
| Aurora maxi II bis sz | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 4/4 | 10 / 10 / 10 / 0 / 0 / 0 |
| Ballina | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM UNWITNESSED | 4/4 | 10 / 10 / 10 / 0 / 0 / 0 |
| Alberto | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 4/4 | 9 / 9 / 9 / 0 / 0 / 0 |
| Medulin | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM UNWITNESSED | 4/4 | 15 / 15 / 15 / 0 / 0 / 0 |
| Domek letniskowy nad jeziorkiem | DEV | storeys AGREED, mainRoof UNWITNESSED, mainRidge AGREED, pitchDeg UNWITNESSED, eavesM UNWITNESSED, ridgeM AGREED | 4/4 | 7 / 2 / 2 / 0 / 0 / 0 |
| Mindelo | DEV | storeys AGREED, mainRoof UNWITNESSED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM UNWITNESSED | 4/4 | 13 / 13 / 13 / 0 / 0 / 0 |
| Dom pod sakurą E | DEV | storeys AGREED, mainRoof AGREED, mainRidge UNWITNESSED, pitchDeg UNWITNESSED, eavesM UNWITNESSED, ridgeM AGREED | 3/3 | 11 / 11 / 11 / 0 / 0 / 0 |
| G6 (garaż ze strychem — nie dom mieszkalny) | DEV | storeys AGREED, mainRoof AGREED, mainRidge UNWITNESSED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 3/3 | 3 / 3 / 3 / 0 / 0 / 0 |
| Aletta New | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 4/4 | 14 / 14 / 14 / 0 / 0 / 0 |
| Novara | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM UNWITNESSED | 4/4 | 13 / 13 / 13 / 0 / 0 / 0 |
| Jarzębina | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 4/4 | 14 / 14 / 14 / 0 / 0 / 0 |
| Willa Eliza 5 G2 | DEV | storeys AGREED, mainRoof AGREED, mainRidge UNWITNESSED, pitchDeg UNWITNESSED, eavesM UNWITNESSED, ridgeM AGREED | 2/3 — bodies: przyjęto main + 1 part(s) (GARAGE@RIGHT), zbudowano 3 body/bodies | 11 / 11 / 11 / 0 / 0 / 0 |
| Amarylis | DEV | storeys AGREED, mainRoof UNWITNESSED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 3/4 — bodies: przyjęto main + 1 part(s) (WING@FRONT), zbudowano 3 body/bodies | 10 / 10 / 10 / 0 / 0 / 0 |
| Oban III | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM UNWITNESSED | 4/4 | 8 / 8 / 8 / 0 / 0 / 0 |
| Juliusz Nowy | DEV | storeys AGREED, mainRoof DISPUTED, mainRidge UNWITNESSED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 2/2 | 4 / 4 / 4 / 0 / 0 / 0 |
| Ametyst New | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 4/4 | 9 / 9 / 9 / 0 / 0 / 0 |
| Skagen | DEV | storeys AGREED, mainRoof UNWITNESSED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM UNWITNESSED | 4/4 | 16 / 16 / 16 / 0 / 0 / 0 |
| Fabia | DEV | storeys AGREED, mainRoof AGREED, mainRidge UNWITNESSED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 3/3 | 11 / 11 / 11 / 0 / 0 / 0 |
| Dom pod pomarańczą 2 | DEV | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg UNWITNESSED, eavesM UNWITNESSED, ridgeM AGREED | 4/4 | 11 / 3 / 3 / 0 / 0 / 0 |
| Amber IV | NEW-G | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM AGREED | 4/4 | 10 / 10 / 10 / 0 / 0 / 0 |
| Rockville | NEW-G | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg AGREED, eavesM UNWITNESSED, ridgeM UNWITNESSED | 4/4 | 9 / 9 / 9 / 0 / 0 / 0 |
| Basia i Adam | NEW-G | odczytu nie było | 0/0 | 20 / 0 / 0 / 0 / 0 / 0 |
| Dom pod jarząbem 25 | NEW-G | storeys AGREED, mainRoof AGREED, mainRidge AGREED, pitchDeg UNWITNESSED, eavesM UNWITNESSED, ridgeM AGREED | 4/4 | 11 / 4 / 4 / 0 / 0 / 0 |

| Zbiór | Własności struktury w modelu | Otwory zbudowane | zgodne ze związaniem | różne | bez związania | błąd sumy | poza ścianą |
|---|---|---|---|---|---|---|---|
| DEV | 72/74 (97 %) | 210 | 197 | 0 | 13 | 0 | 0 |
| NEW-G | 12/12 (100 %) | 50 | 23 | 0 | 27 | 0 | 0 |

### C. Liczby niższe w kodzie końcowym niż w baseline

| Dom | Zbiór | Ściany wewn. | Otwory zewn. | Okna połaciowe | Kominy | Niższe |
|---|---|---|---|---|---|---|
| Alaska | DEV | 11 → 11 | 11 → 11 | 8 → 8 | 2 → 2 | — |
| Aurora maxi II bis sz | DEV | 15 → 15 | 10 → 10 | 1 → 1 | 3 → 3 | — |
| Ballina | DEV | 10 → 10 | 10 → 10 | 0 → 0 | 0 → 0 | — |
| Alberto | DEV | 16 → 16 | 9 → 9 | 0 → 0 | 2 → 3 | — |
| Medulin | DEV | 25 → 10 | 24 → 15 | 0 → 7 | 2 → 1 | interiorWalls, exteriorOpenings, chimneys |
| Domek letniskowy nad jeziorkiem | DEV | 5 → 5 | 7 → 7 | 0 → 0 | 1 → 1 | — |
| Mindelo | DEV | 15 → 15 | 19 → 13 | 0 → 0 | 2 → 2 | exteriorOpenings |
| Dom pod sakurą E | DEV | 20 → 20 | 11 → 11 | 0 → 0 | 3 → 3 | — |
| G6 (garaż ze strychem — nie dom mieszkalny) | DEV | 0 → 0 | 5 → 3 | 0 → 0 | 0 → 0 | exteriorOpenings |
| Aletta New | DEV | 10 → 11 | 15 → 14 | 8 → 8 | 2 → 2 | exteriorOpenings |
| Novara | DEV | 10 → 10 | 13 → 13 | 0 → 0 | 0 → 0 | — |
| Jarzębina | DEV | 15 → 15 | 12 → 14 | 3 → 3 | 2 → 3 | — |
| Willa Eliza 5 G2 | DEV | 10 → 10 | 10 → 11 | 0 → 0 | 4 → 6 | — |
| Amarylis | DEV | 12 → 12 | 5 → 10 | 1 → 2 | 0 → 3 | — |
| Oban III | DEV | 8 → 8 | 8 → 8 | 0 → 0 | 1 → 1 | — |
| Juliusz Nowy | DEV | 11 → 11 | 4 → 4 | 0 → 0 | 2 → 3 | — |
| Ametyst New | DEV | 12 → 12 | 9 → 9 | 1 → 1 | 0 → 1 | — |
| Skagen | DEV | 0 → 5 | 9 → 16 | 2 → 2 | 0 → 0 | — |
| Fabia | DEV | 18 → 18 | 4 → 11 | 0 → 0 | 0 → 2 | — |
| Dom pod pomarańczą 2 | DEV | 16 → 16 | 11 → 11 | 1 → 1 | 3 → 3 | — |
| Amber IV | NEW-G | 17 → 12 | 11 → 10 | 1 → 1 | 3 → 3 | interiorWalls, exteriorOpenings |
| Rockville | NEW-G | 0 → 14 | 9 → 9 | 2 → 2 | 1 → 1 | — |
| Basia i Adam | NEW-G | 36 → 36 | 20 → 20 | 0 → 0 | 0 → 0 | — |
| Dom pod jarząbem 25 | NEW-G | 12 → 12 | 11 → 11 | 0 → 0 | 5 → 5 | — |
