# SOURCE-TO-MODEL v3.53.4 — zasięg dachu i połączenia połaci w analizie lokalnej (raport etapu)

Zlecenie OWNER-a v3.53.4 (2026-11-11). Gałąź `claude/new-session-3kzcgh`, bez merge i PR, commity `[skip ci]`.
Punkt odniesienia: APK 1330 z kodu `c5849fd`, raport `SOURCE_TO_MODEL_V3533.md`, HEAD przed etapem `2a1bf53`.
**Kod etapu: `35eef39` + `3ea0b18` (solver 2.36.0, czytnik okapu 1.1.0), strażnik importów `3a8fe09`. APK 1331 zbudowany z `3ea0b18`.**
Żadnego płatnego wywołania; księga bez zmian (2,72807938 USD z 5 USD, 92 wpisy). Bez H2 / prywatnego benchmarku,
bez zmian w ForgeShape, bez obrazów wydawców w repozytorium (plansze dowodowe są prywatne, poza Gitem).

| | stan |
|---|---|
| **Baza 1330 na zapisanych arkuszach** | **ODTWORZONA** — trzy domy DEV dają na kodzie `c5849fd`, w powtórce na zapieczętowanej ekstrakcji, te same skróty modeli co w pełnym przebiegu próby niezależnej 1330 (§1) |
| **Pierwsza zła decyzja** | **USTALONA** dla każdego z trzech domów DEV (§3): podział rzutu wyłącznie po ścianach (Litodory, Przebiśniegi 27) i odrzucony widok boczny, który jako jedyny pokazuje dach poprzeczny (Bakopy 5) |
| **Poprawka** | **PASS w zakresie** — ogólna, bez wyjątków po adresie/nazwie; test przyczyny zawodzi na kodzie 1330 (3 testy), 16 kontrprób (§6) |
| **DEV po kompilacji** | **3/3 zgodne ze źródłem w zasięgu dachu, liczbie dachów, kierunku kalenic i połączeniach połaci** (§7); otwory: żadnego nie ubyło, dwa okna Przebiśniegów straciły wysokość z elewacji (§7.2) |
| **Regresja (33 domy korpusu, te same zapieczętowane wejścia)** | **33/33 identyczne** co do skrótu modelu; 0 nowych błędów kompilacji (§8) |
| **Próba niezależna z 1330 (9 domów)** | 5 identycznych, 4 zmienione — 3 domy DEV i Kruszczyki 14 (dach czterospadowy zamiast dwuspadowego, zgodnie ze źródłem) (§8) |
| **Świeża próba (zamrożona przed oceną)** | pierwsze 10 domów (nowe rodziny): **10/10 identyczne**, reguła nie zmieniła żadnego wyniku — wynik zachowany; rozszerzenie o 8 domów parterowych: 7 identycznych, **1 zmieniony zgodnie ze źródłem** (Lipienniki 6), po naprawie regresji otworów znalezionej w tej próbie (§9) |
| **APK 1331** | podpis, wersja, manifest 12/12 **PASS**; HOST: bundle wyjęty z pliku, produkcyjny launcher, Node 18 bez ICU — Przebiśniegi 27 E, Bakopy 5 E i Lipienniki 6 od `hello` do zapisanej i wczytanej sceny **PASS**, modele identyczne z powtórkami (§11) |
| **Android UI** | **NOT_VERIFIED** — brak emulatora (brak `/dev/kvm`) i urządzenia w tym środowisku |
| **CAMPAIGN** | WORK_IN_PROGRESS — największa pozostała rozbieżność nazwana w §12 |

## 1. Stan wyjściowy

HEAD `2a1bf53` (kod `c5849fd`). Trzy domy DEV powtórzone na zapieczętowanej ekstrakcji z próby niezależnej 1330
(te same `source-package.json`, `observation-graph.json`, `metric-evidence.json` i bajty wydawcy z pamięci podręcznej).
Skróty modeli powtórki są równe skrótom z pełnego przebiegu od adresu wykonanego na 1330:

| dom (DEV) | model 1330 | bryły 1330 | dachy 1330 |
|---|---|---|---|
| Litodory | `00ed5ff5234d` | główna 15,50 × 9,13 + przybudówka 8,59 × 2,89 | kopertowy nad główną + **płaski** nad przybudówką |
| Przebiśniegi 27 E | `4df65aa4a61d` | 7,45 × 13,40 + 8,35 × 4,88 + 3,15 × 2,80 (salon niezbudowany, 149,4 m² z 197,7 m²) | **dwuspadowy** 7,45 × 13,40 (kalenica wzdłuż z) + **płaski** nad „podcieniem" |
| Bakopy 5 E | `26593987f363` | główna 15,13 × 8,80 + dwie dobudówki 8,73 × 4,40 i 7,05 × 2,60 | dwuspadowy nad główną + **dwa płaskie** |

## 2. Co mówią źródła (sprawdzone na arkuszach przed zmianą)

**Litodory.** Wymiary całkowite 1550 × 1200 kończą się na licach ścian zewnętrznych skrajnych brył; wymiar 913
to głębokość części zamkniętej własną ścianą. Wokół całego prostokąta 15,50 × 12,00 biegnie cienka linia przerywana
0,69 m poza licem ścian — okap. Zamyka się w jeden prostokąt. Narożnik 6,9 × 2,9 m pod tym dachem nie ma ścian: to
zadaszony taras ze słupem w narożniku; druga linia przerywana, na licu, to podciąg nad nim, nie okap. Przekrój jest
podłużny (kalenica 3,5 m na +7,00, okap +2,85, 30°), arkusz sytuacji pokazuje **jeden** dach kopertowy.

**Przebiśniegi 27 E.** Linia okapu (0,9 m od ścian) zamyka obrys w kształcie L: prostokąt 15,77 × 10,43 i skrzydło
frontowe szerokości 10,58 m wysunięte o 2,75 m. Lewe 3,15 m skrzydła to otwarty podcień wejściowy na słupie
(0,73 × 0,55 m), przed własną ścianą bryły głównej z drzwiami 150/210; reszta skrzydła jest obmurowana, a pokój 7
przechodzi przez linię cięcia bez ściany. Narożnik tylny 3,9 × 2,7 m to zadaszony taras ze słupem. Arkusz sytuacji:
dach kopertowy z kopertowym skrzydłem, połączone koszami; obie kalenice na jednej wysokości.

**Bakopy 5 E.** Rzut **nie rysuje** okapu wokół domu (dach bez okapów); linie przerywane to pergola, krzyże pustek
i krawędzie tarasów — rzeczywista kontrpróba dla czytnika okapu. Dowód jest na elewacji bocznej: zamiast szczytu dachu
głównego widać jedną poziomą linię kalenicy nad całą głębokością domu, czyli dach o kalenicy poprzecznej do głównej,
na tej samej wysokości, nad obiema dobudówkami. Arkusz sytuacji potwierdza: długi dach dwuspadowy 8,8 × 15,8 m
(kalenica wzdłuż z) i dach bryły głównej wchodzący w niego koszami.

## 3. Pierwsza zła decyzja

| dom | kreska na arkuszu | pierwsza decyzja, która gubi fragment spod wspólnego dachu |
|---|---|---|
| Litodory | linia okapu wokół 15,50 × 12,00 | **podział rzutu** (`planBodies` na samych ścianach): część za ścianą wewnętrzną staje się przybudówką; czytnik formy dachu nie widzi jej „na tle nieba" → `FLAT` z konwencji |
| Przebiśniegi 27 E | linia okapu w kształcie L | **podział rzutu**: odczyt „wchodzi" do salonu przez przeszklenie tarasu (salon = grunt), podcień na słupie zostaje obmurowaną bryłą z płaskim dachem, a bryłą główną jest prawy blok 7,45 × 13,40 z kalenicą w złym kierunku |
| Bakopy 5 E | pozioma linia kalenicy na elewacji bocznej | **czytnik formy dachu dobudówki** (`readBodyTop`): widok patrzący wzdłuż kalenicy głównej zostaje odrzucony, bo „dach główny nie stoi tam, gdzie go stawia rejestracja" (2,00 m) — a to właśnie ta niezgodność jest dowodem dachu poprzecznego; pozostałe widoki zasłania bryła główna → `UNREAD` → `FLAT` z konwencji |

Emisja i kompilacja są w tych trzech domach poprawne względem decyzji, które dostają.

## 4. Hipotezy odrzucone eksperymentem

- **Bryły zawsze po linii okapu, ściana wspólna jak dotąd.** Po cięciu po okapie linia styku skrzydła i bryły głównej
  nie leży na ścianie; czytnik ściany wspólnej postawił tam jedną cienką ścianę przez cały styk, a podcień został
  obmurowany. Zmienione: skrzydło jest przycinane do części obmurowanej, podcień zostaje pod dachem skrzydła jako
  zadaszenie na słupie (§5).
- **Odczyt linii szczytu od góry obrazu.** Kominy i korony drzew dawały 73–83 % kolumn na linii; odczyt idzie teraz
  od wnętrza ściany w górę, jak istniejący czytnik (100 % / 83 % kolumn).
- **„Przekrój ma jedną skalę, więc sam wskaże rozpiętość dla wczesnego odczytu okapu".** Sprawdzone na Przebiśniegach:
  przekrój jest podłużny i wczesny odczyt (0,89 m okapu) był poprawny; elewacja frontowa rejestrowała się na 1330
  wyłącznie dzięki zbiegowi dwóch błędów (zła rozpiętość 7,45 m → okap 0,42 m, a komin ponad kalenicą w obrysie).
  Zmiana wycofana; skutek opisany w §7.2.
- **Dach skrzydła przy stykach po obu stronach jako dwa osobne dachy z koszami.** Dałby ścianę szczytową bryły głównej
  między dwiema połaciami; źródło pokazuje ciągłą połać. Zbudowane jako jeden dach nad oboma bryłami.

## 5. Zmiana (`35eef39`, `3ea0b18`)

Zasięg dachu jest czytany **niezależnie od podziału ścian**, z trzech źródeł:

1. **Linia okapu na rzucie** (`eave-outline.ts`, nowy czytnik, 1.1.0). Cienkie linie przerywane równoległe do
   zewnętrznych lic brył, poza bryłami, 0,25–1,2 m od lica na długości ≥ 1 m; z dwóch równoległych wygrywa bliższa.
   Odcinki na tej samej prostej, przerwy pod opisami i dojścia do narożników są łączone; linia, która odchodzi od
   ścian, żeby obejść zadaszoną część bez ścian (podcień), jest okapem, gdy oba jej końce stoją na liniach już
   odczytanych jako okap. Obrys zamknięty wokół **wszystkich** obmurowanych brył daje „zadaszony obrys" — obrys
   cofnięty do lic — i jego maksymalne prostokąty. Stany: `CLOSED`, `NO_EAVES_LINE`, `NOT_CLOSED`,
   `NOT_AROUND_THE_BODIES`. Koszt: ok. 30 ms na rzut.
2. **Bryły pod okapem** (`bodiesUnderTheEaves`, `layout.ts`; tylko rzut jednokondygnacyjny). Największy prostokąt
   to bryła główna; to, co okap obejmuje poza nim, to skrzydło pod tym samym dachem. Koniec skrzydła, którego własny
   odczyt ścian nie buduje albo który jest zamknięty samą kreską (bez ściany na licach zewnętrznych, ze ścianą w
   poprzek skrzydła i zamkniętą bryłą główną za nim), jest **pod dachem i poza ścianami**; słup czytany jest jako
   lity blok w narożniku. Cięcie nie jest brane, gdy bok obrysu nie leży na linii siatki rzutu, gdy prostokąty nie
   układają się w bryłę i skrzydła, gdy obmurowana komórka leży poza obrysem albo gdy bryła jest obmurowana w mniej
   niż połowie. Zapis `RoofExtent` (stan, okap, bryły, końce otwarte, słupy, powód) idzie do `StructuralLayoutDraft`.
   To, czego odczyt ścian nie buduje **wewnątrz** prostokąta bryły głównej, na jednym jej licu i z dala od naroży,
   jest wnęką w tym licu (wejście cofnięte pod okapem): bryła zachowuje prostokąt, a wnęka jest z niej wycinana
   istniejącą ścieżką (`pocketRecesses`: wlot jako przejście, ściana tylna z własnymi otworami). W narożniku zostaje
   zadaszonym narożnikiem dla czytnika naroży. (`3ea0b18`, regresja znaleziona na rozszerzeniu świeżej próby — §9.)
3. **Dachy** (`reconstruct-v2.ts`, solver 2.36.0):
   - skrzydło pod okapem dostaje dach prostokąta, który okap obejmuje razem z nim przez bryłę główną, na okapie
     i spadku dachu głównego: przy dachu kopertowym — kopertowy (dwa dachy płaszczyznowe spotykają się w koszach),
     przy dwuspadowym — dwuspadowy połączony koszami istniejącym mechanizmem. Forma końca przejęta z dachu głównego
     jest nazwana jako konwencja (`AMBIGUOUS`), a nie odczyt;
   - otwarty koniec skrzydła to `CanopyV2` bez własnej płyty, na słupie o przekroju z rzutu, pod połacią skrzydła;
   - **dach poprzeczny**: gdy widok wzdłuż kalenicy głównej pokazuje jedną poziomą linię szczytu nad bryłą główną
     i nad bryłą po **każdej** jej stronie (`readTopWithMain`: porównanie w wierszach obrazu, ≥ 75 % kolumn na linii,
     różnica ≤ 0,15 m), nad oboma bryłami i pasem bryły głównej staje jeden dach o rozpiętości dachu głównego
     (ten sam okap, spadek i kalenica); koniec dachu głównego leżący na jego okapie jest wkopertowany w jego połać,
     wolne końce to szczyty (`PlaneRoofV2.coversMassIds`; ściany i ścianki brył przykrytych dochodzą do jego połaci);
   - kopertowy dach podany przez wydawcę jest zamieniany na szczyt tylko wtedy, gdy **każdy** widok czytający jego
     koniec czyta szczyt (dotąd wystarczał jeden; w Litodorach i Kruszczykach 14 jednym były drzewa w obrysie).

Bez wyjątków po adresie, nazwie ani skrócie; progi są w metrach, pikselach arkusza albo udziałach własnej geometrii.
Dach przyjęty z konwencji pozostaje oznaczony (luka `MISSING`/`AMBIGUOUS` z przyczyną), jak dotąd.

## 6. Testy przyczyny i kontrpróby

`roof-extent-v3534.test.ts` (14) i `cross-roof-v3534.test.ts` (5), rzuty i elewacje rysowane w kodzie.

**Na kodzie 1330 (`c5849fd`) zawodzą 3 testy** (uruchomione na tym kodzie, dziennik prywatny):
„z linią okapu oba są jedną bryłą pod jednym dachem" (1330: 2 bryły, brak `roofExtent`), „skrzydło pod tym samym
okapem; jego otwarty koniec jest pod dachem i poza ścianami" oraz „jedna pozioma linia szczytu nad bryłą główną i bryłą
obok to kalenica poprzeczna" (1330: brak odczytu). Test samej przyczyny („cięty po ścianach — przybudówka obok") przechodzi
na obu, bo opisuje stan bez linii okapu.

| kontrpróba | wynik |
|---|---|
| wspólny dach nad kilkoma bryłami (okap w L: bryła główna + skrzydło) | dwie bryły pod jednym okapem, dach skrzydła na prostokącie okapu |
| otwarty podcień (koniec skrzydła bez ścian, słup w narożniku) | poza ścianami, pod dachem, 1 słup |
| osobny, niższy dach garażu (garaż poza linią okapu domu) | cięcie ścian zostaje, garaż osobną bryłą |
| dach skrzydła połączony z głównym (kalenica poprzeczna na wysokości głównej) | odczyt `crossMainTop`, oś poprzeczna |
| linia przerywana, która nie jest okapem: pergola obok domu | nie okap |
| … obrys wewnątrz ścian (pustka, podciąg) | nie okap |
| … linia dalej niż sięga okap (granica, krawędź nawierzchni) | nie okap |
| okap urwany w połowie boku | `NOT_CLOSED`, cięcie ścian zostaje |
| brak linii przerywanej | `NO_EAVES_LINE` |
| widok pokazuje szczyt dachu głównego i płaską bryłę obok | `FLAT`, bez dachu poprzecznego |
| pozioma linia tylko nad bryłą główną, bryła obok niska | brak odczytu |
| poziomy szczyt bryły poniżej linii bryły głównej (niższy własny dach) | brak odczytu |
| szczyt nad bryłą na tym widoku | brak odczytu |
| słup: lity blok w narożniku; ściana od narożnika albo pusty papier | słup / brak |
| wejście cofnięte w licu bryły, pod okapem | jedna bryła 20 × 12 i jedna wnęka (bryła nie jest cięta po ścianie tylnej wnęki) |
| ten sam rzut dwa razy | te same bryły i zapis co do bajtu |

Podreguła „wnęka wewnątrz prostokąta po cięciu po okapie" (`3ea0b18`) ma dowód na prawdziwym domu (Lipienniki 6, §9);
rzut rysowany w kodzie do niej nie dochodzi, bo tam odczyt ścian sam daje jedną bryłę z wnęką — test powyżej pilnuje
wyniku, nie tej ścieżki.

## 7. DEV: PRZED i PO na tych samych wejściach (po kompilacji)

Plansze (źródła + PO + PRZED z tych samych kamer) i zaznaczone dowody na arkuszach są prywatne (poza Gitem).

| dom | model PRZED → PO | zasięg dachu | niezależne dachy | kalenica | połączenia połaci |
|---|---|---|---|---|---|
| Litodory | `00ed5ff5234d` → `3cfb9eb7897b` | 15,5 × 9,13 + płaski 8,59 × 2,89 → **15,5 × 12,0** | 2 → **1** | wzdłuż x (bez zmian), 4 połacie | naroża koperty nad pełnym prostokątem |
| Przebiśniegi 27 E | `4df65aa4a61d` → `3579d45da273` | 7,45 × 13,4 + płaski → **L: 15,77 × 10,43 + skrzydło 10,58 m** | 2 → **1 (dwa prostokąty jednego dachu)** | z → **x** (główna) i **z** (skrzydło) | **kosze** między dachem głównym a skrzydłem, 8 połaci |
| Bakopy 5 E | `26593987f363` → `3ca47126caf0` | dwuspadowy + 2 płaskie → **dach poprzeczny 8,80 × 15,80 + główny** | 3 → **1 (dwa prostokąty)** | x (główna) + **z** (poprzeczny) | **kosze**; koniec dachu głównego w połaci poprzecznego; szczyty na 3 wolnych końcach |

### 7.1 Litodory
Bryły 2 → 1 (20,0 m² płyty więcej: 166,0 → 186,0); zadaszony taras narożny wycięty z bryły, słup 0,46 × 0,46 m,
dwa przejścia (2,90 i 6,85 m) w miejscu dawnych „drzwi" 2,97 i 4,56 m. Otwory zewnętrzne 12 → 12: dwoje drzwi
balkonowych 160/230 w ścianie tylnej zbudowane jako drzwi 1,57 × 2,16 (1330: jedne drzwi i jedno okno 1,57 × 1,30 —
błędnie). Okna połaciowe: 0 przed i po (źródło pokazuje jedno — odczyt z rzutu go nie daje, bez zmian).
Pomieszczenia 11 → 10 (taras przestał być „pokojem").

### 7.2 Przebiśniegi 27 E
Salon (brakujące 48 m²) jest zbudowany: płyty 149,4 → 188,3 m². Podcień wejściowy: otwarty, słup 0,73 × 0,55 m,
drzwi 150/210 w ścianie bryły głównej (1330: obmurowana bryła z płaskim dachem). Taras narożny: wycięty, słup.
Otwory zewnętrzne 13 → 15, żadnego nie ubyło. **Pogorszenie do odnotowania:** dwa okna frontu skrzydła
(300/150 i 90/150 na rzucie, opisy nieodczytane) miały na 1330 wysokość 1,60 m z elewacji, teraz 1,30 m z konwencji —
elewacja frontowa nie rejestruje się (komin ponad kalenicą w obrysie; na 1330 rejestrowała się przez zbieg dwóch błędów,
§4). **Nowo widoczne błędy starych czytników:** przeszklenie salonu 300/240 odczytane przez OCR jako „300/40"
(okno 3,00 × 0,40 m); trzy przeszklenia tarasu i ściany bocznej mają wysokość z konwencji (1,30 m zamiast 2,40 m).
Pomieszczenia 12 → 9: salon, kuchnia i hol są jedną przestrzenią (zgodnie z rzutem), ale spiżarnia i wiatrołap
zlały się z nią. Na linii cięcia bryła–skrzydło stoi ścianka 0,125 m z „drzwiami" 3,68 m tam, gdzie pokój 7 przechodzi
bez ściany. Okap zbudowany 0,60 m; rzut i przekrój podłużny mówią ok. 0,9 m.

### 7.3 Bakopy 5 E
Dachy 3 → 5 połaci jednego układu; rzut z góry zgodny z arkuszem sytuacji, sylwetka zgodna z czterema elewacjami.
Otwory 16 → 16, ściany, pomieszczenia i płyty bez zmian. Wejście pod szczytem południowym: dach ma tam pełną
szerokość 8,80 m, ściana szczytowa 7,05 m — nad wnęką wejściową (1,75 m) szczyt jest otwarty.

## 8. Regresja

Te same zapieczętowane wejścia, sam solver, baza = powtórki na kodzie `c5849fd`.

| zbiór | identyczne | zmienione | uwagi |
|---|---|---|---|
| korpus 33 domów | **33** | 0 | 29 modeli + 4 odmowy, jak w powtórce na 1330; 0 nowych błędów kompilacji |
| próba niezależna 1330 (9) | 5 | 4 | Litodory, Przebiśniegi 27 E, Bakopy 5 E (DEV) i **Kruszczyki 14** |

**Kruszczyki 14** (`e5a9f476529e` → `0360be911d8f`): dach dwuspadowy 13,15 × 9,00 → kopertowy (4 połacie). Źródło:
wydawca podaje dach czterospadowy, wszystkie cztery elewacje i przekrój go pokazują. Sprawdzone na arkuszu: zgodne.
Otwory 10 → 10, ściany i pomieszczenia bez zmian.

Przebiegi bez identycznych plików wydawcy: Arganiach (7 wariantów jednego obrazu niedostępnych po odtworzeniu pamięci
podręcznej w etapie 1330, raport V3533 §10) — dom daje ten sam skrót modelu co baza.
Regresja powtórzona na ostatecznym kodzie (`3ea0b18`): korpus 33/33 identyczne z 1330; próba niezależna — te same
cztery zmiany i te same skróty co wyżej; żaden element nie zniknął (ściany, pomieszczenia, płyty i otwory policzone dla
każdego zmienionego domu w §7–§9), 0 błędów kompilacji przed i po we wszystkich zmienionych domach.

## 9. Świeża próba (lista i kryteria zamrożone przed uruchomieniem)

Reguła wyboru, lista, kryteria K1–K6 i skróty SHA-256 list wydawcy oraz zapieczętowanej ekstrakcji zapisane przed oceną
(prywatnie). Oba kody uruchomione na **tej samej** zapieczętowanej ekstrakcji i tych samych bajtach.

**Pierwsze dziesięć** (rodziny nieobecne w korpusie, DEV ani próbie 1330; pierwsze 6 z listy „dach czterospadowy"
i pierwsze 4 z listy „garaż dwustanowiskowy", w kolejności strony): Willa Layla 2 E, Willa Edyta R2BE, Macierzanki 4 G2,
Anody G2E, Willa Malwina G2E, Leszczynowce 12, Telimy 4 G2E OZE, Szyszkowce 11 G2, Narcyzy 6 R2 ver. 2, Jaskrzyny G2E OZE.

| | 1330 | nowy kod |
|---|---|---|
| modele / odmowy | 6 / 4 | 6 / 4 (te same; odmowy to rozstrzygnięcie rzutu, bez związku z etapem) |
| skróty modeli identyczne | — | **10/10** |
| domy, w których reguły zmieniły wynik | — | **0** |

Czytnik okapu uruchomił się na trzech rzutach jednokondygnacyjnych: Leszczynowce 12 — `CLOSED`, jeden prostokąt równy
bryle (bez zmiany); Macierzanki 4 G2 — `NOT_AROUND_THE_BODIES`; Anody G2E — `NOT_CLOSED`. Siedem domów ma więcej niż
jeden rzut i jest poza zasięgiem reguły. Odczyt dachu poprzecznego: 0 razy. Ocena K1–K3 sześciu modeli (taka sama dla
obu kodów): zgodne 4 (Leszczynowce 12, Narcyzy 6, Willa Edyta, Szyszkowce 11 — tu garaż ma **rzeczywiście osobny, niższy
dach płaski** i tak jest zbudowany), niezgodne 2: Telimy 4 (wspólny dach nad garażem zbudowany jako płaskie bryły;
dom z poddaszem) i Macierzanki 4 G2 (części pod drugim dachem kopertowym są płaskie — okap nie obejmuje wszystkich brył,
bo jedna ma własny dach płaski, i czytnik odmawia całego rzutu).

Żaden dom nie uruchomił reguły, więc — zgodnie ze zleceniem — wynik zostaje, a próba została **rozszerzona** listą
zamrożoną przed uruchomieniem: pierwsze osiem nieużytych domów z listy „parterowe" w kolejności strony (bez wariantu
domu DEV). Ograniczenie do nowych rodzin nie dało się tu utrzymać (lista to warianty kilku rodzin) — niezależność
rozszerzenia jest słabsza i jest to powiedziane wprost.

**Rozszerzenie (8):** Renklody 15 G2, Lipienniki 6, Lipienniki 18 E, Lipienniki 8, Rarytasy 5 G2AE, Kruszczyki 20 AE,
Kruszczyki 17, Lipienniki 2.

| | 1330 | nowy kod |
|---|---|---|
| modele / odmowy | 5 / 3 | 5 / 3 (te same) |
| skróty modeli identyczne | — | 7/8 |
| domy, w których reguły zmieniły wynik | — | **1** (Lipienniki 6) |
| zmiany zgodne ze źródłem | — | **1 z 1** — po poprawce `3ea0b18`; pierwszy wynik miał regresję otworów |

Czytnik okapu: `CLOSED` na czterech rzutach (Kruszczyki 17, Kruszczyki 20 AE, Lipienniki 8 — jeden prostokąt równy
bryle, bez zmiany; Lipienniki 6 — cięcie wzięte), `NOT_CLOSED` na Rarytasach 5.

**Lipienniki 6** (`059822c03f` → `1dc748b8e1`). Źródło: prostokąt 14,90 × 10,10 (wymiar 1010 = 940 + 70), linia okapu
0,69 m wokół całości, front w jednej płaszczyźnie z wnęką wejściową 4,2 × 0,7 m pośrodku. 1330: bryła 14,8 × 9,3 cięta
po ścianie tylnej wnęki, lewy pas frontu jako „przybudówka" 6,0 × 0,7 m z „drzwiami" 5,0 m do bryły, prawy pas nie
zbudowany, okno 220/140 jako 3,80 m. Nowy kod: **jedna bryła 14,8 × 10,0 pod jednym dachem dwuspadowym** (płyta
137,6 → 148,0 m²), wnęka wejściowa z dwiema ścianami bocznymi i ścianą tylną, w niej otwory 1,05 × 2,10 i 0,80 × 2,10
(105/210 i 80/210), okna frontu 2,40 × 1,40 i 2,20 × 1,40 (240/140 i 220/140). K1–K6 spełnione.
**Regresja znaleziona i naprawiona w trakcie próby:** pierwszy wynik nowego kodu (`35eef39`) wchłonął wnękę do bryły
i odczytał jej wlot jako przeszklenie 4,28 m — drzwi wejściowe znikły (K5 niespełnione). Przyczyna i poprawka: §5 pkt 2,
commit `3ea0b18`; po niej powtórzono regresję wszystkich zbiorów (§8) i obie części świeżej próby.

**Razem świeża próba (18 domów):** reguły zmieniły wynik w **1** domu; ta zmiana jest zgodna ze źródłem. W 17 pozostałych
wynik jest identyczny co do skrótu modelu.

## 10. Weryfikacja

| zakres | wynik |
|---|---|
| `tsc --noEmit` (całe repozytorium) | czysto |
| `packages/reconstruction` | 132 pliki testów, wszystkie przechodzą (19 nowych testów etapu) |
| macierz: `packages/reconstruction`, `packages/analysis-service`, `apps/local-analyzer`, `tests/architecture` z `LOCAL_ANALYZER_NODE18` (Node 18.20.4) | 184 pliki, 2164 testy, przebieg na `fe47630`: **2151 przechodzi, 13 nie — te same 13 co w bazie, po nazwach** (skróty scen Larchfield, NFD bez ICU, „frozen set" elewacji złożonych, testy referencyjne 4 i 7, cztery strażniki izolacji badań, cztery testy wall-strip); **0 nowych** |
| strażnik importów warstwy układu (`storey-support.test.ts`) | pierwszy przebieg macierzy pokazał go jako 14. błąd: lista dozwolonych importów `layout.ts` nie znała `./eave-outline.js`. Strażnik został **rozszerzony, nie osłabiony** (`3a8fe09`): nowy czytnik jest na liście i podlega tym samym warunkom co czytnik ścian zewnętrznych — importuje tylko typy pikseli i wspólne pomocniki, nie nazywa żadnej opublikowanej liczby ani domu |
| test przyczyny na kodzie 1330 | 3 z 18 ówczesnych testów etapu zawodzą na `c5849fd` (§6) |

**Czas i pamięć na zmienionej ścieżce.** Sam czytnik okapu: ok. 30 ms na rzut (24–32 ms na czterech prawdziwych rzutach),
wywoływany raz na każde rozważane odczytanie rzutu. Sam solver, powtórka pojedynczo na zapieczętowanych wejściach
(z uruchomieniem środowiska i renderem widoków), kod 1330 → nowy: Przebiśniegi 27 E 20 → 17 s, Litodory 25 → 31 s
(jedna większa bryła z wycięciem i słupem), Bakopy 5 E 21 → 20 s, Kosaćce 44 (bez zmiany wyniku) 19 → 21 s — bez
systematycznej różnicy ponad rozrzut ±2 s. Pełna analiza z bundla APK 1331 (§11): 371–423 s i 0,96–1,01 GB pamięci
szczytowej (VmHWM); 1330 dawał 1,03–1,05 GB. Czasy pełnej analizy mierzono przy równolegle biegnących testach, więc
nie nadają się do porównania z 244–330 s z raportu 1330; pamięć od obciążenia nie zależy.

## 11. APK 1331

| | |
|---|---|
| plik | `BuildPlan-Model-Preview-1331-arm64-v8a-debug.apk`, 51 764 142 B (prywatnie, poza Gitem) |
| SHA-256 | `6b9a04f0060f1d6ae49d3f39221044c773621cf9f07619019000f43d983b1f3d` |
| podpis | ten sam certyfikat co 1324–1330: SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` — **PASS** |
| wersja | `versionCode 1331`, `versionName 0.1331.0-owner`, pakiet `com.buildplan.preview`, minSdk 26 — **PASS** |
| manifest analizatora | protokół 3, `nodejs-mobile` 18.20.4; **12/12** plików zgodnych co do SHA-256 i rozmiaru; `analyzer.mjs` `516bfa830ee23830…` (3 489 494 B) — **PASS** |
| kod | `3ea0b18` (drzewo czyste w chwili budowania; `3a8fe09` zmienia tylko test) |

**HOST (bundle wyjęty z ostatecznego pliku APK, produkcyjny `main.mjs`, Node 18.20.4 z symulacją braku ICU, żywe strony
wydawcy, od `hello` do zapisanej i wczytanej sceny):**

| dom | wynik | zdarzenia | model | scena (wczytana `loadBundle`) | czas* | pamięć szczytowa |
|---|---|---|---|---|---|---|
| Przebiśniegi 27 E | `done`, exit 0 | 522 (`hello` … `done`) | `3579d45da273` — ten sam co w powtórce | `5c7efd032938`, 132 siatki — **wczytana** | 389 s | 1,01 GB |
| Bakopy 5 E | `done`, exit 0 | 555 | `3ca47126caf0` — ten sam co w powtórce | `4139abeaf3dd`, 150 siatek — **wczytana** | 423 s | 1,01 GB |
| Lipienniki 6 | `done`, exit 0 | 535 | `1dc748b8e195` — ten sam co w powtórce | `74962981bf2a`, 76 siatek — **wczytana** | 371 s | 0,96 GB |

\* przy równolegle biegnącej macierzy testów.

**Node 18 bez ICU:** test zgodności powtórzony — trzy przebiegi powyżej idą pod `--require no-icu.cjs` (ścisły `TextDecoder`
i `normalize` jak w nodejs-mobile bez ICU), `hello` raportuje tekst z tablic wbudowanych; testy `apps/local-analyzer`
i `tests/architecture` z `LOCAL_ANALYZER_NODE18` — jak w §10.

**ANDROID:** nie uruchomiono. W tym środowisku nie ma emulatora (brak `/dev/kvm`) ani urządzenia. Interfejs i przebieg
LOCAL w aplikacji: **NOT_VERIFIED**. Wyniki HOST nie są wynikami z telefonu.

## 12. Największa pozostała rozbieżność

**Część domu pod wspólnym dachem nadal budowana jako płaska bryła, gdy (a) obok stoi bryła z rzeczywiście osobnym
dachem albo (b) dom ma więcej niż jedną kondygnację.**

- (a) Czytnik okapu wymaga dziś, żeby linia okapu obejmowała **wszystkie** obmurowane bryły. Gdy jedna ma własny dach
  płaski poza okapem, odmawia całego rzutu (`NOT_AROUND_THE_BODIES`) i skrzydła pod okapem dostają dach z konwencji.
  Świeża próba: Macierzanki 4 G2 (części pod drugim dachem kopertowym płaskie). Kierunek: bryły w całości poza
  zamkniętym obrysem okapu zostają jak je tną ściany (osobny dach), cięcie po okapie dotyczy tylko tego, co obrys
  obejmuje.
- (b) Reguła okapu działa tylko na rzucie jednokondygnacyjnym. Świeża próba: Telimy 4 (wspólny dach nad garażem jako
  płaskie bryły). W korpusie 8 z 29 modeli ma jeszcze płaskie dachy dobudówek, 7 z nich to domy z poddaszem lub
  piętrem — część tych garaży ma naprawdę dach płaski (Szyszkowce 11: zgodnie ze źródłem), część nie; nie rozstrzygano
  ich w tym etapie. W próbie niezależnej z 1330 rodzina jest zamknięta: 3 z 8 modeli → 0 z 8.

Mniejsze, nazwane w §7: wysokości otworów w Przebiśniegach 27 E (elewacja frontowa nie rejestruje się, gdy komin
wystaje ponad kalenicę w obrysie; opis 300/240 odczytany jako 300/40; dwa okna 1,60 → 1,30 m względem 1330), okap
zbudowany 0,60 m przy ok. 0,9 m na rzucie i przekroju podłużnym (czytnik okapu z przekroju zakłada przekrój poprzeczny;
linia okapu z rzutu nie jest jeszcze źródłem wysięgu), ścianka z „drzwiami" 3,68 m na linii cięcia bryła–skrzydło tam,
gdzie pokój przechodzi bez ściany, otwarty szczyt nad wnęką wejściową w Bakopach 5 E, zlane małe pomieszczenia.
Arkusz sytuacji (rzut dachu z góry) nadal nie jest czytany — byłby niezależnym potwierdzeniem obrysu i kalenic.
