# NEW-H v3.54.21 — opisy referencyjne (z oryginałów wydawcy, przed jakąkolwiek analizą)

Spisane 2026-11-25 przez czytelnika, który widział wyłącznie obrazy wydawcy danego pakietu (elewacje, rzuty, przekroje, perspektywy); drugi, niezależny czytelnik sklasyfikował sam układ dachu. Bez modelu, bez sieci. Obrazy nie są w repozytorium.

## anna — „Anna II”, Studio Atrium (https://www.studioatrium.pl/projekty-domow/Anna-ii,1341.html)

- **Nagłówek:** Parter + poddasze użytkowe (także nad garażem); obrys parteru z rzutu 13,35 × 11,30 m (0,83+4,60+4,17+3,75; 2,55+3,90+4,85 = 1,90+6,50+1,90+1,00). Wysokości nie podano. Kąta dachu nie podano: z elewacji wychodzi ok. 40°, kalenica ok. 8 m nad terenem (tylko szacunek z rysunku).
- **Warstwy (czytelnik 1):** KRZYŻUJĄCE — KRZYŻUJĄCE: w dach dwuspadowy bryły głównej (kalenica od frontu do tyłu) wcinają się koszami dwa poprzeczne dachy dwuspadowe o niższych kalenicach równoległych do frontu: dach garażu z prawej i szczyt ryzalitu z lewej. PROSTY nie pasuje, bo żaden dach nie przykrywa sam swojej bryły bez przecięć. HIP: nie ma żadnej połaci kopertowej, wszystkie końce są szczytami. NIŻSZY_PRZY_ŚCIANIE: nie ma osobnego niższego dachu opartego o wyższą ścianę. Nad wejściem jest płyta balkonu, a podcień tarasu leży pod poddaszem. Jedyny styk połaci ze ścianą to dolny fragment połaci głównej wzdłuż ścian ryzalitu, ale jest on częścią połączenia krzyżowego z koszem. To nie jest osobna warstwa „niższy dach przy ścianie”, choć model musi go odtworzyć, bo ściany ryzalitu wychodzą ponad okap główny.
- **Warstwy (czytelnik 2, niezależnie):** KRZYŻUJĄCE — ZGODNE; Dach domu tworzą jeden wysoki dach dwuspadowy i dwa niższe, poprzeczne dachy dwuspadowe. Te dwa dachy przenikają główną połać wzdłuż koszy. Żadna połać nie jest czterospadowa i żaden niższy dach nie kończy się na ścianie. Klasa: KRZYŻUJĄCE.

Orientacja:
- FRONT to elewacja podpisana „frontowa” (ELEVATION-FRONT-na-cc7e8e8f). Jest na niej wejście, nad nim balkon, a po prawej garaż.
- LEWA strona to ELEVATION-SIDE_UNSPECIFIED-na-592292ce. Samochód stoi przy prawej krawędzi, czyli od frontu. Tu jest ryzalit od strony ogrodu.
- PRAWA strona to ELEVATION-SIDE_UNSPECIFIED-na-dc9d7716. Samochód jest po lewej, a ściana szczytowa skrzydła garażowego wypada w środku.
- TYŁ to ELEVATION-REAR-na-bfd3f5c0.

1) Dach główny: dwuspadowy, kalenica biegnie od frontu do tyłu.
- Na obu elewacjach bocznych (592292ce, dc9d7716) widać pełną połać. Długa pozioma kalenica jest na wysokości około 440 px nad terenem i biegnie przez całą głębokość domu. Krawędzie po bokach są pionowe, bo szczyty widać z boku.
- Na froncie (cc7e8e8f) i na tyle (bfd3f5c0) ten dach kończy się dużymi trójkątnymi szczytami. Ich wierzchołek jest na tej samej wysokości co kalenica. Mają drewniane podbitki, a w nich są balkony.
- Te same szczyty widać na perspektywach: 08b2312e (front), b64e1ce2 (front z garażem), a8457873 i 7c0340e7 (tył).

2) Poprzeczne skrzydło po PRAWEJ (garaż i pokój na poddaszu nad nim).
- Ma dach dwuspadowy z kalenicą biegnącą lewo–prawo, prostopadle do głównej. Kalenica jest niższa: na froncie około y=195 wobec y=145 szczytu głównego.
- Na froncie (cc7e8e8f) i na tyle (bfd3f5c0) widać jego połać. Są w niej dwa okna połaciowe, okap jest na wysokości okapu głównego, a górna krawędź pozioma.
- Na prawej elewacji (dc9d7716) kończy się własnym szczytem. Ten szczyt stoi przed połacią dachu głównego.
- Kalenica skrzydła dochodzi do połaci głównej w punkcie, gdzie ta połać ma tę samą wysokość (około x=500–510 na froncie). Połacie przecinają się więc koszem.
- Kosz widać na perspektywie b64e1ce2: dach garażu zaczyna się na prawej połaci dachu głównego, tuż za okapem szczytu frontowego. Widać go też na 08b2312e.
- Ściana garażu jest cofnięta względem frontu o około 1,9 m (rzut FLOOR_PLAN-na-GROUND-da44a854).
- Rzut poddasza (FLOOR_PLAN-na-ATTIC-cd474336) pokazuje pokój 6 wysunięty w prawo, z oknami połaciowymi na obu stronach dachu.

3) Poprzeczny ryzalit po LEWEJ: dwukondygnacyjny wykusz z własnym, mniejszym szczytem.
- Kalenica biegnie lewo–prawo, około y=185. Okap jest wyżej niż okap główny: około y=290 wobec y=390.
- Na lewej elewacji (592292ce) to szczyt w środku połaci dachu głównego.
- Na froncie i na tyle (cc7e8e8f, bfd3f5c0) widać go jako niewielką połać nad okapem głównym.
- Na perspektywach 7c0340e7 (podpis „oryginalny ryzalit”), a8457873 i 9d86a79f jego połać wchodzi w lewą połać dachu głównego. Przecięcie to kosz, na nim leży płotek śniegowy.

4) Czego nie ma:
- HIP: nie widać czterospadowości. Wszystkie zakończenia dachów to szczyty: front, tył, ryzalit i skrzydło garażowe. Na elewacjach bocznych krawędzie połaci są pionowe, bez narożników czterospadowych.
- NIŻSZY_PRZY_ŚCIANIE: nie znalazłem żadnego niższego daszku, który kończy się na wyższej ścianie bez kosza.
  - Wejście jest wnęką pod płytą balkonu.
  - Część tarasu z tyłu (a8457873) jest zadaszona samą bryłą piętra i okapem dachu głównego, z pojedynczym słupem (patrz też rzut parteru).
  - Garaż leży pod dachem poprzecznego skrzydła, a nie pod przybudówką.
  - Szary pas na ryzalicie na wysokości stropu (7c0340e7, 592292ce) wygląda na gzyms lub opaskę, nie na połać.
- PROSTY: nie przypisałem tej klasy. Dom nie ma jednego dachu nad jedną bryłą, tylko trzy przenikające się dachy dwuspadowe.
- **W próbie NEW-H:** TAK

| dach | nad | rodzaj | kalenica |
|---|---|---|---|
| R1 | Bryła główna (parter + poddasze, ok. 8,77 × 11,30 m), łącznie z wysuniętym blokiem kuchni, wnęką wejścia i podcieniem tarasu. Szczyty: front i tył. | GABLE | PERPENDICULAR_TO_FRONT |
| R2 | Skrzydło garażowe po prawej (garaż 3,75 × 6,50 m z pokojem na poddaszu). Szczyt w prawo, kalenica niższa od R1, okap na poziomie okapu R1. Po 2 okna połaciowe w każdej połaci. | GABLE | PARALLEL_TO_FRONT |
| R3 | Ryzalit po lewej (jadalnia + część sypialni 3, 0,83 × 3,90 m). Szczyt w lewo, kalenica niższa od R1, okap wyżej niż okap R1. | GABLE | PARALLEL_TO_FRONT |

| A | B | połączenie | dowód |
|---|---|---|---|
| R1 | R2 | VALLEY | Dwa kosze: przedni i tylny. Kalenica R2 jest niższa i kończy się w prawej połaci R1. Okapy obu dachów spotykają się w narożniku na tej samej wysokości. Widać to tak: PERSPECTIVE b64e1ce2 pokazuje przedni kosz od narożnika okapów w górę do końca kalenicy garażu. Na ELEVATION-FRONT przednia połać R2 kończy się na krawędzi szczytu R1 na wysokości swojej kalenicy, a na ELEVATION-REAR tak samo tylna połać. Na ELEVATION-SIDE dc9d7716 wierzchołek szczytu garażu leży poniżej kalenicy R1, a okapy są wspólne. Na rzucie poddasza przy pokoju 6 widać ukośne linie przerywane. |
| R1 | R3 | VALLEY | Mały szczyt krzyżowy z koszami w lewej połaci R1. Kalenica R3 jest niższa od R1, a okap R3 leży ok. 1,9 m (szacunek) wyżej niż okap R1. Ściany ryzalitu przecinają więc linię okapu głównego, a dolne fragmenty R1 biegną wzdłuż przedniej i tylnej ściany ryzalitu bez kosza. Kosz zaczyna się dopiero od narożnika okapu R3. Widać to tak: na PERSPECTIVE-REAR 7c0340e7 tylna połać R3 z płotkiem śniegowym schodzi na połać R1, a pod nią ściana ryzalitu wyrasta z połaci głównej. Na PERSPECTIVE 9d86a79f to samo widać z przodu. ELEVATION-SIDE 592292ce pokazuje szczyt ryzalitu z okapem ok. y=292 przy okapie głównym y=395 i kalenicy głównej y=143. Na ELEVATION-FRONT i ELEVATION-REAR połać R3 kończy się na krawędzi szczytu R1. |
| R2 | R3 | APART | Stoją po przeciwnych stronach bryły głównej i nigdzie się nie stykają. ELEVATION-FRONT i ELEVATION-REAR pokazują je po obu stronach szczytu R1. |

| id | kat. | KEY | cecha |
|---|---|---|---|
| F1 | F | KEY | Dom z poddaszem użytkowym. Parter i poddasze ze ściankami kolankowymi. Główny okap leży mniej więcej na wysokości stropu nad parterem (elewacje). Poddasze zajmuje bryłę główną, ryzalit i przestrzeń nad garażem (pokój 6 na rzucie poddasza). |
| F2 | F | KEY | Bryła główna to prostokąt ok. 8,77 × 11,30 m (4,60+4,17 wszerz). Ma dach dwuspadowy, symetryczny, z kalenicą prostopadłą do frontu (biegnie od przodu do tyłu). Szczyt stoi od frontu nad wejściem i drugi od ogrodu. Na elewacjach bocznych widać połać z poziomą kalenicą na całą głębokość domu. |
| F3 | F | KEY | Skrzydło garażowe po PRAWEJ ma 3,75 × 6,50 m. Garaż jest jednostanowiskowy, a nad nim jest poddasze (pokój 6). Dach dwuspadowy ma kalenicę równoległą do frontu i niższą od głównej (z elewacji ok. 1 m). Szczyt garażu patrzy w prawo. Okapy leżą na tej samej wysokości co okap główny, a dach wcina się w prawą połać główną koszami. |
| F4 | F | KEY | Ryzalit po LEWEJ wystaje 0,83 m i ma 3,90 m długości. Jest dwukondygnacyjny: jego ściany wychodzą ok. 1,9 m ponad główny okap (szacunek z elewacji). Ma własny mały dach dwuspadowy z kalenicą równoległą do frontu, niższą od głównej, i szczytem zwróconym w lewo. Jego okap leży wyżej niż okap główny. Pod okapem ryzalitu dolna część połaci głównej biegnie wzdłuż ścian ryzalitu (przedniej i tylnej). |
| F5 | F |  | Front bryły głównej jest schodkowy. Blok kuchni z łazienką 6 (lewa część) wysuwa się o 1,00 m przed lico holu. Wejście leży w narożnej wnęce między tym blokiem a ścianą holu. Na poddaszu ściana szczytu ma ten sam uskok (pokój 4 wysunięty, łazienka 5 cofnięta), widoczny jako pionowy uskok w trójkącie szczytu. Krawędź dachu jest jedna, więc nad cofniętą częścią okap jest głębszy i podpiera go drewniany słup stojący na balkonie. |
| F6 | F |  | Lico garażu jest cofnięte o 1,90 m za lico holu, czyli 2,90 m za lico kuchni. Z tyłu ściana salonu wystaje 1,90 m poza tylną ścianę garażu. Po prawej widać więc dwa krótkie odcinki prawej ściany bryły głównej: przed garażem i za nim. |
| F7 | F |  | W tylnym lewym narożniku bryły głównej jest zadaszony taras (podcień, ok. 4,6 × 2,55 m z rzutu). Leży pod poddaszem, ma słup narożny i nie ma osobnego dachu. Taras otwarty, z szerokimi stopniami, ciągnie się przed nim od tyłu i od lewej. |
| F8 | F |  | Dwa balkony na poddaszu, oba z balustradą szklaną. Frontowy, w kształcie L, leży nad wejściem i częścią bloku kuchni, a jego narożnik nad schodami podpiera słup. Tylny, wspornikowy, jest w szczycie ogrodowym. Nad wejściem nie ma osobnego daszku: osłania je płyta balkonu. |
| F9 | F |  | Szczyty mają duże drewniane okapy: widoczne krokwie i deskowanie podbitki, wystające belki (kroksztyny) i cienkie poziome cięgno przez trójkąt szczytu (front i tył). Na dachu bryły głównej nie ma okien połaciowych. Na wszystkich dachach są płotki śniegowe. |
| S1 | S | KEY | FRONT to elewacja podpisana „frontowa” (ELEVATION-FRONT). Stoi tam szczyt główny z balkonem i drzwiami wejściowymi w środkowej wnęce, a brama garażowa w skrzydle po prawej. Na rzucie parteru front to dół arkusza: wejście do pomieszczenia 1 przez schody i podjazd do garażu 8. |
| S2 | S |  | LEWA to elewacja boczna 592292ce (tam, gdzie car stoi z prawej, czyli z przodu). Widać ryzalit jadalni z małym szczytem, narożne okno kuchni bliżej frontu i podcień tarasowy z tyłu. |
| S3 | S |  | PRAWA to elewacja boczna dc9d7716 (samochód stoi z lewej, czyli z przodu). Widać ślepy szczyt garażu na tle prawej połaci głównej oraz wystające końce obu balkonów. |
| S4 | S |  | TYŁ (ELEVATION-REAR) to szczyt ogrodowy z balkonem. Po lewej stronie rysunku jest tylna połać i ściana garażu, po prawej zadaszony narożnik tarasu i tylna połać ryzalitu. Obie perspektywy oznaczone REAR to widoki z tyłu i z lewej. |
| O1 | O | KEY | Drzwi wejściowe: front, oś szczytu głównego, pod balkonem, we wnęce cofniętej o 1,00 m. Pojedyncze, grafitowe, z wąskim pionowym przeszkleniem. Przed nimi podest i 3 stopnie, z prawej słup balkonu. |
| O2 | O | KEY | Brama garażowa: front, w skrzydle po prawej, pojedyncza segmentowa, szara, w cofniętej ścianie garażu. |
| O3 | O |  | Front, parter, lewa strona: szerokie 2-dzielne okno kuchni. To część dużego narożnego okna, które zawija na lewą elewację jako okno 3-dzielne (perspektywa 9d86a79f). |
| O4 | O |  | Front, poddasze, wyjścia na balkon: szerokie przeszklenie (drzwi z fixem z pokoju 4) i pojedyncze drzwi balkonowe nad wejściem (z łazienki 5, według rzutu poddasza). |
| O5 | O |  | Front: 2 okna połaciowe obok siebie w przedniej połaci dachu garażu. Z tyłu są 2 kolejne, w tylnej połaci garażu. Oświetlają pokój 6. |
| O6 | O |  | Małe okno łazienki 6 w bocznej ścianie wnęki wejściowej. Patrzy w prawo i widać je na elewacji prawej oraz na perspektywie b64e1ce2. |
| O7 | O |  | Lewa strona, ryzalit: na parterze duże 3-dzielne przeszklenie jadalni prawie do podłogi, na poddaszu 3-dzielne okno w szczycie ryzalitu. Pod oknem poddasza biegnie szary gzyms. |
| O8 | O |  | Narożnik tył-lewo, w podcieniu: narożne przeszklenie salonu (od tyłu i od strony podcienia) i drzwi tarasowe z jadalni. |
| O9 | O |  | Tył, poddasze: dwoje drzwi balkonowych na balkon tylny, z pokojów 2 i 3. |
| O10 | O |  | Tył, parter: duże 3-dzielne okno salonu. Na ścianie tylnej skrzydła garażowego są 2 małe okna. |
| O11 | O |  | Prawa: ściana szczytowa garażu bez otworów. Odcinki prawej ściany bryły głównej przed garażem i za nim też nie mają widocznych okien, poza oknem łazienki we wnęce. |
| C1 | C |  | Komin 1 stoi przy kalenicy dachu głównego, tuż po prawej od niej, w przedniej części dachu, nad trzonem między łazienkami a holem. Tynkowany, z metalową czapą. Najwyższy punkt domu. |
| C2 | C |  | Komin 2 stoi na dachu garażu tuż pod jego kalenicą, blisko kosza przy połaci głównej. Leży w linii ściany salon/garaż, przy której stoi kominek. Jest niższy od komina 1, tynkowany, z czapą. |
| M1 | M |  | Ściany z białego tynku, cokół szary. Szary gzyms na ryzalicie i szara opaska wokół narożnego okna kuchni. |
| M2 | M |  | Pokrycie: grafitowa dachówka płaska o prostokątnym rysunku. Na dachach płotki śniegowe i ławy kominiarskie. Rynny i rury spustowe szaro-grafitowe. |
| M3 | M |  | Jasne drewno w szczytach: podbitka z desek, krokwie, wystające belki i słup w szczycie frontowym. Szczyty garażu i ryzalitu mają te same drewniane okapy. |
| M4 | M |  | Stolarka grafitowa (antracyt) z roletami zewnętrznymi, parapety szare. Brama segmentowa szara, drzwi wejściowe grafitowe. |
| M5 | M |  | Balustrady z tafli szkła na stalowych słupkach. Taras i podest wejściowy z szarych desek ze stopniami. Przed domem podjazd z kostki (otoczenie). |

- **Wnętrze:** Rzut parteru, pomieszczenia tylko numerowane, nazwy i powierzchnie niepodane (funkcje odczytane z wyposażenia): 1 wiatrołap/hol za drzwiami wejściowymi; 2 hol komunikacyjny ze schodami zabiegowymi (ćwierćzwrot) przy ścianie garażu; 3 salon z kominkiem przy ścianie garażu i narożnym przeszkleniem do tyłu i do podcienia; 4 jadalnia w strefie ryzalitu (przeszklenie w lewo, drzwi do podcienia); 5 kuchnia w wysuniętym bloku z narożnym oknem front/lewo; 6 łazienka (umywalka, WC, urządzenie, prawdopodobnie kocioł lub pralka) z okienkiem do wnęki wejścia; 7 WC; 8 garaż jednostanowiskowy z 2 oknami w tylnej ścianie. Rzut poddasza: 1 hol ze schodami; 2 pokój (tył-prawo, drzwi na balkon tylny); 3 sypialnia z podwójnym łóżkiem i szafami (tył-lewo, przeszklenie w ryzalicie, drzwi na balkon tylny); 4 pokój (przód-lewo, drzwi z fixem na balkon frontowy); 5 łazienka z wanną narożną (drzwi na balkon frontowy); 6 pokój nad garażem (okna połaciowe). Styl rysunku: ściany wypełnione jednolitym szarym kolorem, podłogi tonowane z rastrem płytek, meble i armatura kolorowe, okna jako cienkie niebieskie linie, drzwi z łukami otwierania, numery w kółkach. Na rzucie poddasza linie przerywane pokazują obrys okapów, okna połaciowe i ukośne linie przy pokoju 6 (zgodne z koszami garażu). Balkony mają podwójny kontur, słup balkonu frontowego zaznaczono kwadratem. Wymiary w metrach, z dwoma miejscami po przecinku, tylko na rzucie parteru, łańcuchy zewnętrzne. Wszerz: 0,83 / 4,60 / 4,17 / 3,75 = 13,35. Głębokość z prawej: 1,90 / 6,50 / 1,90 / 1,00 = 11,30. Głębokość z lewej: 2,55 / 3,90 / 4,85 = 11,30. Rzut poddasza nie ma wymiarów.
- **Braki źródła:** Rysunki nie podają kilku rzeczy. Nie ma przekroju, rzutu dachu, sytuacji ani żadnych rzędnych, wysokości (okap, kalenica, kolanko, parapety, nadproża) czy kątów dachu: elewacje to barwione rysunki bez wymiarów, więc nachylenie (ok. 40°) i wysokości są tylko szacunkiem z pikseli. Rzuty nie mają nazw ani powierzchni pomieszczeń (same numery), a rzut poddasza nie ma wymiarów. Elewacje boczne mają podpis „boczna” (SIDE_UNSPECIFIED): przypisanie dc9d7716 = PRAWA (garaż) i 592292ce = LEWA (ryzalit) jest wnioskiem z treści rysunku. Perspektywy: obie oznaczone REAR (a8457873, 7c0340e7) to widoki skośne z tyłu i z lewej. „unk” 08b2312e to front prawie na wprost (mimo etykiety storey=ATTIC), b64e1ce2 to przód-prawo, 9d86a79f to przód-lewo. Narożnika tył-prawo (tylny kosz garażu) nie pokazuje żadna perspektywa, tylko elewacja tylna i rzut poddasza. Nie widać, czy jest piwnica, ani jak wygląda fundament. Pliki elewacji i perspektyw to JPG, nie PNG.

## lyon (Lipińscy, https://lipinscy.pl/projekt/lyon)

- **Nagłówek:** Dom piętrowy (parter i pełne piętro, bez poddasza) na jednej zwartej bryle prawie kwadratowej 9,05 × 8,85 m (wymiary wydrukowane na rzucie parteru). Dach płaski (stropodach) schowany za attyką, krawędź attyki na +6,56 (przekrój). Rzędne z przekroju: parter ±0,00, teren -0,30, spód stropu parteru +2,66, posadzka piętra +3,02, strop piętra +5,70. Kąta dachu nie podano, bo dach jest płaski. Do bryły dostawione są trzy niskie drewniane konstrukcje: z prawej wiata garażowa o szerokości 3,70 m, z przodu pergola wejściowa o głębokości 2,20 m, z tyłu pergola tarasowa o głębokości 3,70 m.
- **Warstwy (czytelnik 1):** PROSTY, NIŻSZY_PRZY_ŚCIANIE — PROSTY: jeden dach płaski (stropodach za attyką) nad jedną, niepodzieloną bryłą dwukondygnacyjną. NIŻSZY_PRZY_ŚCIANIE: wiata garażowa z prawej, pergola wejściowa z przodu i pergola tarasowa z tyłu to niskie (ok. +2,7–3,0), płaskie konstrukcje dochodzące do wyższych ścian bryły bez kosza. KRZYŻUJĄCE nie występuje: brak kalenic, przenikających się dachów i szczytu poprzecznego. HIP nie występuje: brak połaci.
- **Warstwy (czytelnik 2, niezależnie):** PROSTY, NIŻSZY_PRZY_ŚCIANIE — ZGODNE; Lyon to jedna dwukondygnacyjna bryła kostki o wymiarach 9,05 × 8,85 m z płaskim dachem schowanym za attyką. Wokół niej stoją trzy niskie, płaskie drewniane zadaszenia dostawione do ściany.

Kłopot ze źródłem: w index.json nie ma żadnej perspektywy (PERSPECTIVE). Są tylko 4 elewacje, 2 przekroje i rzuty; miniatury oznaczone „skipped” nie mają plików.

1) PROSTY (dach główny): jeden dach nad jedną bryłą.
- Na wszystkich czterech elewacjach górna krawędź bryły jest jedną poziomą linią na tej samej wysokości. Ponad nią wystaje tylko komin. Nie ma szczytu, kalenicy ani skośnej połaci. Dotyczy to plików ELEVATION-FRONT-na-e79441c3.jpg, ELEVATION-SIDE_LEFT-na-014b0535.jpg, ELEVATION-SIDE_RIGHT-na-7cd3d61f.jpg i ELEVATION-REAR-na-c6ed274e.jpg.
- Oba przekroje (SECTION-na-na-811abd33.png i SECTION-na-na-5fe0fd7e.png) pokazują płaski stropodach nad piętrem. Jest na nim cienka warstwa spadkowa między ściankami attyki. Wierzch attyki ma rzędną +6,56 na całej szerokości, bez uskoku.
- Rzuty (FLOOR_PLAN-na-GROUND-222d9f47.png / -6f83b9e9.png oraz UPPER-307a1a6d.png / -e2a1bd18.png) pokazują jeden prostokątny obrys. Nie ma skrzydła, które mogłoby nieść drugi dach.
- KRZYŻUJĄCE nie występuje: nie ma kalenicy krzyżowej, koszy ani szczytu nad częścią elewacji.
- HIP nie występuje: na żadnej stronie nie ma połaci kopertowej ani naroża.

2) NIŻSZY_PRZY_ŚCIANIE: niższe, płaskie zadaszenia kończą się na wyższej ścianie bryły, bez kosza. Są trzy, wszystkie na około +2,6–2,9 m, czyli dużo poniżej attyki:
- FRONT (strona z wejściem; na rzucie parteru wskazuje ją strzałka przy 1.1/1.8): zadaszenie wejścia nad 1.8, głębokie na 220. Na elewacji FRONT to belka na dwóch słupach, przylegająca do ściany pod okładziną piętra.
- PRAWA strona: wiata garażowa o szerokości 370, oparta o ścianę wschodnią. Na elewacji FRONT widać ją z boku (po prawej). Na SIDE_RIGHT widać ją od czoła, przed ścianą, na trzech słupach. W przekroju jest to płyta biegnąca od ściany do słupa, z odgięciem na wolnej krawędzi.
- TYŁ: pergola lub zadaszenie tarasu 1.9, głębokie na 370. Przy ścianie tylnej i na SIDE_RIGHT stoi jako rama wystająca poza bryłę.

Za tym, że są to zadaszenia, a nie same belki, przemawia kilka rzeczy. Na elewacjach FRONT i SIDE_RIGHT pod nimi i obok nich na ścianie leży cień. Rzut piętra pokazuje je z góry jako panele z poprzeczkami. W przekroju wiata ma ciągłą płytę. Niepewność: z obrazów nie da się rozstrzygnąć, czy pokrycie jest pełne, czy to ażurowe lamele. Jeżeli protokół nie liczy otwartej pergoli jako dachu, NIŻSZY_PRZY_ŚCIANIE opiera się głównie na wiacie i daszku wejścia.

Uwaga do etykiet: na podstawie rzutu pliki REAR i SIDE_LEFT wyglądają na zamienione.
- Plik REAR ma szerokość bryły odpowiadającą 885. Jego otwory zgadzają się ze ścianą zachodnią: przesuwne drzwi salonu na około 3,2–6,4 m od frontu, okno 2.4 i kuchenne okienko przy froncie.
- Plik SIDE_LEFT pasuje do ściany tylnej: okna 1.4 i salonu oraz taras 1.9 z deskowaniem, a z lewej wiata o szerokości 370.

Ta zamiana nie zmienia klasyfikacji, bo na każdej stronie dach główny jest płaski, a zadaszenia są niższe od bryły.
- **W próbie NEW-H:** TAK

| dach | nad | rodzaj | kalenica |
|---|---|---|---|
| R1 | cała bryła główna 9,05 × 8,85 m (obie kondygnacje); stropodach za attyką, góra attyki +6,56 | FLAT | NONE |
| R2 | wiata garażowa przy prawej ścianie, 3,70 × ok. 5 m; płaskie przekrycie na drewnianej ramie, ok. +2,7 m (pokrycie nieznane) | FLAT | NONE |
| R3 | pergola wejściowa (ganek 1.8) przed drzwiami na froncie, ok. 3,8 × 2,20 m; drewniana rama z rusztem listew, ok. +2,7–3,0 m (czy jest kryta, nieznane) | OTHER | NONE |
| R4 | pergola tarasowa (taras 1.9) przy tylnej ścianie w lewej części domu, ok. 3,70 × 3,70 m; drewniana rama z rusztem listew, wysokość podobna do R3 (czy jest kryta, nieznane) | OTHER | NONE |

| A | B | połączenie | dowód |
|---|---|---|---|
| R1 | R2 | LOWER_ROOF_AT_WALL | ELEVATION-SIDE_RIGHT: wiata (3 słupy) dostawiona do prawej ściany, belka na wysokości styku tynku i okładziny, ok. 4 m poniżej attyki. SECTION-na-na-811abd33 / 5fe0fd7e: płyta wiaty dochodzi do prawej ściany na ok. +2,7 przy attyce +6,56. FLOOR_PLAN GROUND: przerywany obrys wiaty zaczyna się od lica prawej ściany. Brak kosza i brak przenikania dachów. |
| R1 | R3 | LOWER_ROOF_AT_WALL | ELEVATION-FRONT: rama pergoli 1.8 przylega do ściany frontowej, belka tuż pod dolną krawędzią okładziny piętra. Obrazy opisane jako REAR (lewy bok) i SIDE_RIGHT: słup pergoli stoi przy narożniku bryły od strony frontu. FLOOR_PLAN GROUND: 1.8 przylega do ściany frontowej. |
| R1 | R4 | LOWER_ROOF_AT_WALL | Obraz opisany jako SIDE_LEFT (faktycznie tył): rama pergoli 1.9 przy tylnej ścianie nad drzwiami tarasowymi, belka na styku tynku i okładziny. Obraz opisany jako REAR (lewy bok): pergola wychodzi 3,70 m za tylny narożnik. FLOOR_PLAN GROUND: 1.9 przylega do ściany tylnej. |
| R2 | R3 | APART | FLOOR_PLAN GROUND i ELEVATION-FRONT: ganek stoi na środku frontu, wiata przy prawej ścianie, a między nimi jest odcinek ściany z oknem łazienki 1.2. Konstrukcje się nie stykają. |
| R2 | R4 | APART | FLOOR_PLAN GROUND: wiata przy prawej ścianie, pergola 1.9 za tylną ścianą po lewej. Obraz opisany jako SIDE_LEFT (tył): wiata na skrajnej lewej, pergola po prawej, rozdzielone ścianą z oknem sypialni 1.4. |
| R3 | R4 | APART | FLOOR_PLAN GROUND oraz obrazy boczne (REAR=lewy bok, SIDE_RIGHT): ganek z przodu i pergola z tyłu wystają po przeciwnych stronach bryły. |

| id | kat. | KEY | cecha |
|---|---|---|---|
| F1 | F | KEY | Jedna bryła, prostopadłościan na planie prawie kwadratu 9,05 (szerokość frontu) × 8,85 m (głębokość). Dwie pełne kondygnacje: parter ±0,00 i piętro +3,02. Brak poddasza, uskoków, wykuszy, ryzalitów i balkonów. Ściany są pionowe, od cokołu do attyki w jednej płaszczyźnie. |
| F2 | F | KEY | Dach płaski (stropodach) całkowicie schowany za attyką. Na wszystkich czterech elewacjach górna krawędź jest pozioma i równa z licem ścian: bez okapu, bez połaci, bez kalenicy. Przekrój pokazuje attykę do +6,56 nad stropem +5,70, pod attyką warstwę spadkową o lekko pochylonej górze i grzybek wywiewki na środku dachu. Rzutu dachu w źródle nie ma. |
| F3 | F | KEY | Wiata garażowa (miejsce postojowe z narysowanym samochodem na rzucie parteru) przy prawej ścianie bryły. Szerokość 3,70 m jest wydrukowana. Głębokość ok. 5 m odczytałem z rzutu i z elewacji prawej, nie jest wydrukowana. Przednia krawędź wiaty leży ok. 0,3 m za linią frontu. Konstrukcja to drewniana rama: zewnętrzna linia na 3 słupach (elewacja prawa), od strony domu wiata opiera się o ścianę. Przekrycie jest płaskie: na rzucie parteru przerywany obrys nad samochodem, w przekroju cienka płyta dochodząca do prawej ściany na wysokości ok. +2,7 m (odczyt, nie wydrukowano). Z czego jest zrobione przekrycie, źródło nie mówi. |
| F4 | F | KEY | Pergola wejściowa (1.8) przed drzwiami, na środku frontu (zajmuje ok. 30–70 % szerokości elewacji). Głębokość 2,20 m jest wydrukowana, szerokość ok. 3,7–3,9 m odczytałem. Rama z jasnego drewna na 4 słupach dostawiona do ściany frontowej. Belka górna leży tuż pod dolną krawędzią okładziny piętra, ok. +2,7–3,0 m (odczyt). Na rzucie piętra widać poprzeczne listwy rusztu. |
| F5 | F | KEY | Pergola tarasowa (taras 1.9) przy ścianie tylnej, w lewej części domu (patrząc od frontu), przed salonem. Wymiary ok. 3,70 × 3,70 m: głębokość 3,70 jest wydrukowana, szerokość odczytałem. Drewniana rama na 4 słupach z listwami rusztu (rzut piętra), belka na wysokości styku tynku z okładziną. Na prawo od niej leży niezadaszony pas utwardzenia o głębokości ok. 1,2 m. |
| F6 | F |  | Przy lewej ścianie, przed przesuwnymi drzwiami salonu, jest mały podest ze stopniem (rzut parteru: szary prostokąt poza ścianą; przekrój: stopień na -0,30). Wokół bryły biegnie niski szary cokół. |
| F7 | F |  | Schody wewnętrzne zabiegowe, dwubiegowe, w środkowo-prawej części domu (1.3 na parterze, 2.1 na piętrze). W przekroju widać biegi i zabiegi. |
| S1 | S | KEY | FRONT to elewacja z wejściem: obraz ELEVATION-FRONT, a na rzucie parteru strzałka wejścia u dołu. Wejście jest pod pergolą 1.8, wiata stoi po prawej stronie frontu. |
| S2 | S | KEY | Strony patrząc od frontu: LEWA to ściana salonu i kuchni (drzwi przesuwne z podestem, okno pasmowe kuchni). PRAWA to ściana bez okien na parterze, do której dostawiona jest wiata. TYŁ to strona ogrodowa z pergolą tarasową 1.9 po lewej i oknem sypialni parterowej 1.4 po prawej. |
| S3 | S |  | Przypisanie obrazów do stron według rzutu (zgodne położenie okien, pergoli, wiaty, komina i stopnia): obraz opisany jako SIDE_LEFT pokazuje TYŁ, obraz opisany jako REAR pokazuje LEWY bok, SIDE_RIGHT pokazuje prawy bok, FRONT pokazuje front. Szczegóły w sourceProblems. |
| O1 | O | KEY | Drzwi wejściowe na froncie, nieco na prawo od osi elewacji, pod pergolą 1.8: jednoskrzydłowe, pełne, ciemne (prawie czarne/ciemnobrązowe), po prawej wąskie szare naświetle lub panel. Prowadzą do wiatrołapu 1.1. |
| O2 | O | KEY | Bramy garażowej nie ma: wiata jest otwarta z trzech stron, garażu w bryle brak. |
| O3 | O |  | FRONT, parter (od lewej): poziome, wąskie okno pasmowe kuchni przy lewym narożniku; małe pionowe okno pomieszczenia 1.7 na lewo od drzwi; drzwi wejściowe; pionowe okno łazienki 1.2 na prawo od drzwi. FRONT, piętro: po lewej szerokie, dwudzielne okno pokoju 2.5 do posadzki; po prawej wysokie, wąskie okno łazienki 2.6. Oba okna piętra mają balustradę francuską z poziomych listew. |
| O4 | O |  | LEWY bok (obraz opisany jako REAR), parter: duże przesuwne przeszklenie salonu 1.5 w środkowej części, bliżej tyłu, z podestem i stopniem przed nim; poziome okno pasmowe kuchni 1.6 bliżej frontu. Piętro: jedno duże okno pokoju 2.4 bliżej tyłu, z balustradą z listew. |
| O5 | O |  | PRAWY bok (SIDE_RIGHT): parter bez okien, gładka ściana, przy której stoi wiata. Piętro: jedno wysokie, wąskie okno klatki schodowej 2.1 w środku szerokości, z balustradą z listew. |
| O6 | O |  | TYŁ (obraz opisany jako SIDE_LEFT; z tyłu prawa część domu jest po lewej ręce): parter, duże okno do posadzki sypialni 1.4 w prawej części domu i duże przesuwne drzwi tarasowe salonu 1.5 pod pergolą 1.9 w lewej części domu. Piętro: dwa duże dwudzielne okna (2.3 i 2.4) w osiach okien parteru, oba z balustradą francuską z listew. |
| O7 | O |  | Cecha powtarzalna: każde okno piętra na wszystkich czterech elewacjach ma przed sobą balustradę francuską z 3 poziomych listew w kolorze okładziny. |
| C1 | C |  | Jeden niski, prostokątny komin z czapą i rurką wylotową wystaje ponad attykę. Stoi mniej więcej w połowie szerokości (nieco na lewo od osi, patrząc od frontu) i ok. 1/3 głębokości od frontu, nad pomieszczeniem 1.7 z kotłem CO (na rzucie parteru przy symbolu CO widać przewody). Jest widoczny na wszystkich czterech elewacjach i jego położenie się zgadza. Wysokość ponad attyką to ok. 0,3–0,4 m (odczyt, nie wydrukowano). W przekroju widać też grzybek wywiewki na dachu. |
| M1 | M | KEY | Dwa materiały elewacji dzielone poziomo. Parter: biały, gładki tynk. Piętro: na wszystkich czterech elewacjach pozioma okładzina z desek w szaro-brązowym, postarzanym odcieniu, od ok. poziomu stropu parteru (~+2,7) aż po górę attyki, bez obróbki attyki odróżniającej się kolorem. |
| M2 | M |  | Pergola wejściowa, pergola tarasowa i wiata są drewniane, z belek i słupów. Na rysunkach mają jasny, ciepły brąz, a elementy dalsze lub zacienione ciemny brąz (np. wiata na froncie, pergola 1.9 na elewacji prawej). |
| M3 | M |  | Stolarka okienna grafitowa lub antracytowa. Drzwi wejściowe ciemne. Cokół, stopnie i utwardzenie tarasów szare (beton lub kamień). |

- **Wnętrze:** Rzut parteru (9,05 × 8,85 m). Przy froncie, od lewej: kuchnia 1.6 z zabudową w kształcie L (Z, L), pomieszczenie gospodarcze/kotłownia 1.7 (CO, R), wiatrołap 1.1 z drzwiami wejściowymi, łazienka 1.2 z WC, umywalką i prysznicem. W środku hol 1.3 ze schodami zabiegowymi przy prawej ścianie. Z tyłu po lewej salon z jadalnią 1.5 (narożny, wyjście na taras 1.9 i drzwi przesuwne w lewej ścianie), z tyłu po prawej sypialnia 1.4 (łóżko podwójne, szafa). Na zewnątrz: ganek 1.8 z przodu, taras 1.9 z tyłu, wiata z samochodem z prawej. Rzut piętra: hol 2.2 w środku, schody 2.1 przy prawej ścianie, z tyłu po prawej pokój 2.3 (łóżko pojedyncze, biurko), z tyłu po lewej sypialnia 2.4 (łóżko podwójne, biurko, szafa wnękowa), z przodu po lewej pokój 2.5 (łóżko pojedyncze, biurko), z przodu po prawej łazienka 2.6 (wanna, prysznic, WC, umywalka). Nazw i powierzchni pomieszczeń rysunki nie podają, są tylko numery; funkcje wnioskuję z umeblowania. Sposób rysowania: ściany zewnętrzne grube, wypełnione grafitem; działowe cieńsze, też wypełnione; okna jako jasne przerwy z ramą w ścianie; drzwi z łukiem otwierania; posadzki w kolorze (beż, łazienki w niebieskiej kratce); meble; wiata i pergole na rzucie piętra jako ruszt listew. Wymiary wydrukowane: 905 (szerokość bryły), 370 (szerokość wiaty), 885 (głębokość bryły), 370 (głębokość pergoli 1.9), 220 (głębokość ganku 1.8). Rzędne w przekroju: -0,30, ±0,00, +2,66, +3,02, +5,70, +6,56. Wymiarów otworów, szerokości ganku i pergoli 1.9 ani głębokości wiaty nie wydrukowano.
- **Braki źródła:** 1) Podpisy elewacji bocznej i tylnej są zamienione względem rzutu. Obraz ELEVATION-SIDE_LEFT-na-014b0535.jpg pokazuje TYŁ (ogrodowy): po dwa duże okna na każdej kondygnacji w osiach okien 1.4/1.5 i 2.3/2.4, pergolę 1.9 po prawej, wiatę na skrajnej lewej i stopień podestu po prawej, czyli lustrzane odbicie tylnej ściany z rzutu. Obraz ELEVATION-REAR-na-c6ed274e.jpg pokazuje LEWY bok: drzwi przesuwne salonu, okno pasmowe kuchni, jedno okno piętra, pergolę 1.9 wystającą 3,70 m po lewej i ganek 2,20 m po prawej. Proporcje miniaturek wydawcy (elewacja-lewa 119×61 ≈ 1,95 jak obraz SIDE_LEFT; elewacja-tył 120×55 ≈ 2,18 jak obraz REAR) sugerują, że zamiana pochodzi z podpisów wydawcy. Samych miniaturek nie widziałem (pominięte). FRONT i SIDE_RIGHT są zgodne z rzutem. 2) Miniaturki czterech elewacji i przekroju (assety „skipped: thumbnail”) nie mają plików. Rzuty FLOOR_PLAN-na-GROUND-91648fbb i UPPER-7ce5b58b to nieczytelne miniatury 120×138, duplikaty dużych rzutów. Pary FLOOR_PLAN GROUND 6f83b9e9/222d9f47, UPPER e2a1bd18/307a1a6d i SECTION 811abd33/5fe0fd7e to te same rysunki. 3) Brak wizualizacji perspektywicznych, planu sytuacyjnego, rzutu dachu i oznaczenia linii przekroju na rzutach. Brak kierunku północy. 4) Źródło nie pokazuje: czy wiata i pergole są kryte (szkło, poliwęglan, blacha) czy ażurowe; spadku i odwodnienia dachu płaskiego; materiału pokrycia stropodachu i obróbki attyki; wymiarów i wysokości otworów; wysokości wiaty, pergoli i komina (są tylko odczyty z rysunku); głębokości wiaty, szerokości ganku i pergoli 1.9; nazw i powierzchni pomieszczeń, powierzchni zabudowy i użytkowej; terenu i ogrodzenia.

## Debora (Dobre Domy, https://www.dobredomy.pl/projekt/debora)

- **Nagłówek:** Dwie bryły, obie z parterem i poddaszem użytkowym. Gabarytu nie podano (na rzutach nie ma linii wymiarowych). Wysokość 8,11 m (od terenu −0,30 do kalenicy głównej +7,81, przekrój), kalenica skrzydła +6,66. Kąta dachu nie podano; odczytany z rysunku wynosi ok. 45° w obu bryłach (DISPLAY/odczyt, nie liczba ze źródła).
- **Warstwy (czytelnik 1):** PROSTY, KRZYŻUJĄCE — KRZYŻUJĄCE to klasa rozstrzygająca. Skrzydło ma kalenicę prostopadłą do kalenicy głównej i niższą od niej (+6,66 wobec +7,81), a jego dach przenika prawą połać bryły głównej wzdłuż dwóch koszy (przekrój, elewacje przód i tył). PROSTY: każda z dwóch brył ma własny, zwykły dach dwuspadowy nad jedną prostokątną bryłą. Nie zaznaczam tu, że cały dom to jeden dach. HIP: brak, na żadnym obrazie nie ma połaci trójkątnej ani naroża kopertowego. NIŻSZY_PRZY_ŚCIANIE: nie, bo dach skrzydła nie kończy się na ścianie, tylko jego kalenica wchodzi w połać. Ewentualny krótki styk dolnych pasów połaci skrzydła ze ścianą bryły głównej pod jej okapem jest niewidoczny i wynika tylko z różnicy okapów. Daszków nad wejściem i tarasem nie ma: wejście i taras przykrywa nadwieszona bryła poddasza.
- **Warstwy (czytelnik 2, niezależnie):** KRZYŻUJĄCE — NIEZGODNE (nazwane, nie rozstrzygane); Dach to układ krzyżujący w kształcie litery T. Składa się z dwóch dachów dwuspadowych, które przenikają się wzdłuż koszy. Nie ma tu dachu kopertowego ani niższego dachu dochodzącego do ściany.

1) Bryła główna (po lewej patrząc od frontu, z piętrem na poddaszu) ma kalenicę prostopadłą do frontu, na rzędnej +7,81 według przekroju SECTION-na-na-23d13d63. Szczyt jest od frontu: ELEVATION-FRONT-na-58e7b957, po lewej, z dwoma oknami z balustradami. Drugi szczyt jest od tyłu: ELEVATION-REAR-na-b6999315, po prawej, z dużymi przeszkleniami. Lewa połać jest ciągła, z dwoma oknami połaciowymi (ELEVATION-SIDE_UNSPECIFIED-na-deab0d1a, elewacja lewa). Prawą połać widać w całości za szczytem skrzydła (ELEVATION-SIDE_UNSPECIFIED-na-9d125a40, elewacja prawa).

2) Niższe skrzydło po prawej (garaż, a nad nim pokój 20,2 m² na poddaszu) ma własny dach dwuspadowy. Jego kalenica biegnie równolegle do frontu, na rzędnej +6,66 (pozioma linia na SECTION). Na froncie i z tyłu widać jego połacie. Po prawej stronie kończy się szczytem z oknem (9d125a40). Na FRONT i REAR jego wiatrownica jest widoczna z boku jako pionowy jasny pas na skraju połaci.

3) Połączenie: kalenica skrzydła (+6,66) jest niżej od kalenicy głównej (+7,81), ale wyraźnie wyżej od okapu bryły głównej. Na 9d125a40 wierzchołek szczytu skrzydła (y≈70) wypada w środku prawej połaci głównej, między kalenicą (y≈25) a okapem (y≈150). Na SECTION linia +6,66 dochodzi do lewej połaci bryły głównej przy kominie. Na FRONT i REAR połać skrzydła dobiega do skośnego obrysu głównego szczytu. Na PERSPECTIVE-unk-na-e250ab59 (widok z przodu i z lewej strony) połać skrzydła z oknem połaciowym chowa się za prawą wiatrownicą głównego szczytu. Obie połacie skrzydła muszą więc przecinać prawą połać główną wzdłuż dwóch koszy. To jest kalenica krzyżowa, a więc KRZYŻUJĄCE. Na rzucie poddasza (FLOOR_PLAN-na-ATTIC-9c1f13a4) zakreskowany dach skrzydła ma poziomą kalenicę i dochodzi do bryły głównej, której kalenica jest pionowa.

Dlaczego nie pozostałe klasy:
- HIP nie: wszystkie zakończenia to pełne szczyty. Bryła główna ma szczyt od frontu i od tyłu, skrzydło ma szczyt po prawej. Na żadnej elewacji ani na perspektywie nie ma połaci narożnej.
- NIŻSZY_PRZY_ŚCIANIE nie: dach skrzydła nie kończy się na pionowej ścianie, tylko wchodzi w połać i tworzy kosze. Narożnik tarasu z tyłu po lewej oraz cofnięte wejście (FLOOR_PLAN-na-GROUND-2cfd0762, PERSPECTIVE) leżą pod bryłą główną i nie mają osobnego dachu. Nad drzwiami wejściowymi na PERSPECTIVE widać cienki płaski element, ale to nadproże albo daszek wnęki, a nie osobna warstwa dachu. Na FRONT nie widać go jako dachu.
- PROSTY nie: są dwie bryły i dwa dachy, a nie jeden dach nad jedną bryłą.
- **W próbie NEW-H:** TAK

| dach | nad | rodzaj | kalenica |
|---|---|---|---|
| R1 | bryła główna: parter (salon z jadalnią, kuchnia, spiżarnia, hall, WC, wiatrołap) i poddasze (pokoje 11,1, 8,7, 13,0, łazienka 9,1, hall); kalenica +7,81, szczyty do frontu i do tyłu | GABLE | PERPENDICULAR_TO_FRONT |
| R2 | skrzydło prawe: parter (garaż 2-stanowiskowy 32,4, pom. gosp. 4,9, korytarz 5,1) i poddasze (pokój 20,2, łazienka 3,4); kalenica +6,66, szczyt na elewacji prawej | GABLE | PARALLEL_TO_FRONT |

| A | B | połączenie | dowód |
|---|---|---|---|
| R1 | R2 | VALLEY | Na SECTION 23d13d63 połać skrzydła (kalenica +6,66) dochodzi do lewej, w widoku przekroju, połaci bryły głównej na ok. +5 m, czyli powyżej okapu głównego (ok. +4,2), a połać główna biegnie dalej do +7,81. Na ELEVATION-FRONT 58e7b957 i ELEVATION-REAR b6999315 kalenica skrzydła zaczyna się dokładnie na linii połaci szczytu głównego. Na ELEVATION-SIDE 9d125a40 niższy szczyt skrzydła stoi na tle wyższej połaci głównej. Wynika z tego kalenica niższa wbiegająca w połać wyższej, czyli dwa kosze (układ T). Linii koszy nie narysowano, bo brak rzutu dachu. Okap skrzydła (ok. +3,0) leży niżej niż okap główny (ok. +4,1), oba z odczytu rysunku. Krótkie dolne pasy połaci skrzydła przylegają więc najpewniej do bocznej ściany bryły głównej, ale ten detal jest na wszystkich obrazach zasłonięty i jest tylko wnioskiem. |

| id | kat. | KEY | cecha |
|---|---|---|---|
| F1 | F | KEY | Bryła główna to prostokąt wydłużony w głąb działki (krótszy bok we froncie). Ma parter i poddasze użytkowe z wysoką ścianką kolankową: strop poddasza jest na +3,04, a okap bocznych połaci na ok. +4,1–4,2 (odczyt z przekroju i elewacji, wartość niepodana). Dach dwuspadowy z kalenicą prostopadłą do frontu na +7,81, szczytami do frontu i do tyłu, w formie stodoły. Widać to na ELEVATION-FRONT 58e7b957, REAR b6999315, SECTION 23d13d63 i PERSPECTIVE e250ab59. |
| F2 | F | KEY | Po prawej stronie dostawione jest niższe skrzydło: prostokąt z dłuższym bokiem równoległym do frontu. Na parterze ma garaż dwustanowiskowy 32,4 m², pomieszczenie gospodarcze 4,9 i korytarz 5,1, a na poddaszu pokój 20,2 i łazienkę 3,4 (strop poddasza +2,85). Dach dwuspadowy z kalenicą równoległą do frontu na +6,66, okapem od frontu i od tyłu oraz szczytem na elewacji prawej. Widać to na ELEVATION-FRONT 58e7b957, SIDE 9d125a40, REAR b6999315 i rzutach. |
| F3 | F | KEY | Układ T: kalenica skrzydła (+6,66) jest o 1,15 m niższa od głównej (+7,81) i wbiega w prawą połać bryły głównej, co tworzy dwa kosze. Na przekroju połać skrzydła dochodzi do połaci głównej powyżej jej okapu. Na elewacji przód i tył kalenica skrzydła zaczyna się na linii połaci szczytu głównego. Linie koszy nie są nigdzie narysowane wprost, bo brak rzutu dachu. |
| F4 | F |  | Skrzydło nie dochodzi do lica żadnego szczytu bryły głównej. Z przodu bryła główna wysunięta jest przed skrzydło o ok. 1 m, z tyłu wystaje za nie o ok. 3 m (odczyt z rzutu parteru i elewacji prawej, wymiary niepodane). Na elewacji tylnej przy styku brył widać tylną ścianę skrzydła cofniętą względem szczytu głównego. |
| F5 | F |  | Wnęka wejściowa: parter w prawym przednim narożniku bryły głównej (wiatrołap 3,3) jest cofnięty, a poddasze nad nim (łazienka 9,1) zostaje w licu frontu i nadwiesza się nad wejściem. Widać to na rzutach parteru i poddasza oraz w PERSPECTIVE e250ab59. |
| F6 | F |  | Tylny lewy narożnik parteru jest podcięty: przeszklenie salonu cofnięte jest od lewej ściany o ok. 1,5 m (rzut parteru, słupki w narożnikach), a poddasze wisi nad nim w pełnym obrysie (rzut poddasza). Przed narożnikiem jest taras z płyty podniesionej o 2 stopnie (PERSPECTIVE). Obrys tarasu na rzucie obejmuje tył i lewy bok. |
| F7 | F |  | Szczyty obu brył nie mają wysięgu. Krawędź połaci jest zlicowana ze ścianą szczytową i wykończona wąską jasną obróbką, która na elewacjach bocznych i w rzucie z boku daje jasne pionowe pasy na krańcach dachu. Okapy boczne są krótkie, z rynną (PERSPECTIVE, SIDE deab0d1a, SIDE 9d125a40). |
| F8 | F |  | Rzędne i wysokości: parter obu brył ±0,00, teren −0,30. Wysokość w świetle parteru bryły głównej 274, garażu 252. Poddasze bryły głównej +3,04, poddasze skrzydła +2,85 (19 cm niżej), wysokość w świetle poddaszy 260. Całość 811 (SECTION 23d13d63). |
| S1 | S | KEY | FRONT to elewacja podpisana przez wydawcę „Elewacja przód” (58e7b957). Po lewej stoi szczyt bryły głównej, po prawej skrzydło garażowe okapem do frontu, z drzwiami wejściowymi i bramą garażu. Na obu rzutach front jest na dole kartki. |
| S2 | S |  | LEWA to deab0d1a („Elewacja boczna”, bez wskazania strony). Widać na niej samą bryłę główną od strony okapu, lewą połać z 2 oknami połaciowymi i przeszklenia salonu. Front jest po prawej stronie rysunku. Strona przypisana z treści i zgodna z rzutem parteru. |
| S3 | S |  | PRAWA to 9d125a40 („Elewacja boczna”, bez wskazania strony). Na pierwszym planie jest szczyt skrzydła, a nad nim wyższa prawa połać bryły głównej z kominem. Front jest po lewej stronie rysunku. Strona przypisana z treści. |
| S4 | S |  | TYŁ to b6999315 („Elewacja tył”): szczyt bryły głównej po prawej stronie rysunku, skrzydło okapem po lewej. Wizualizacja e250ab59 pokazuje dom od przedniego lewego narożnika. |
| O1 | O | KEY | Drzwi wejściowe na froncie: drewniane, z wąskim pionowym przeszkleniem bocznym, cofnięte we wnęce pod prawą częścią szczytu głównego. Otacza je pionowa okładzina drewniana z numerem „19” (numer to aranżacja). Obok, między drzwiami a bramą, jest wąskie pionowe okno korytarza i lampy ścienne (ELEVATION-FRONT, PERSPECTIVE, rzut parteru: wiatrołap). |
| O2 | O | KEY | Brama garażowa na froncie skrzydła: jedna szeroka brama segmentowa na dwa stanowiska, wykończona pionowymi deskami jak okładzina (ELEVATION-FRONT, PERSPECTIVE). Na rzucie parteru przerywaną linią zaznaczono tor bramy. |
| O3 | O |  | Front, szczyt główny: na poddaszu dwa wysokie okna z balkonami francuskimi (szklane balustrady, pokój 13,0 i łazienka 9,1). Na parterze poziome okno narożne kuchni, zawinięte na lewy bok. Na przedniej połaci skrzydła 2 okna połaciowe (w PERSPECTIVE widać jedno, drugie zasłania szczyt). |
| O4 | O |  | Tył, bryła główna: na parterze duże przesuwne przeszklenie tarasowe (2 pola) i dodatkowe pole w podciętym narożniku. Na poddaszu dwa wysokie okna z balkonami francuskimi (pokoje 11,1 i 8,7). Tył skrzydła: drzwi do pomieszczenia gospodarczego przy styku z bryłą główną i 2 wąskie pionowe okna garażu w okładzinie drewnianej. Na tylnej połaci skrzydła nie ma okien połaciowych. |
| O5 | O |  | Lewy bok: na parterze pas przeszkleń w 3 polach (salon pod nadwieszeniem i jadalnia) oraz okno kuchni przy froncie, będące zawinięciem okna narożnego. W lewej połaci głównej 2 okna połaciowe nad pokojami 11,1 i 13,0, zaznaczone przerywanymi prostokątami na rzucie poddasza. |
| O6 | O |  | Prawy bok: w szczycie skrzydła jedno okno poddasza z balkonem francuskim (pokój 20,2). Ściana szczytowa garażu na parterze jest bez otworów. Prawa połać bryły głównej, widoczna nad skrzydłem, nie ma okien połaciowych. |
| C1 | C |  | Wysoki komin na prawej połaci bryły głównej (od strony skrzydła), blisko kalenicy, z wylotem nieco ponad +7,81. Widać go na elewacjach przód, tył i prawa oraz w przekroju. Na rzucie poddasza to kwadrat z przewodami w hallu 3,6. Biały, z czapą. |
| C2 | C |  | Niższy komin na tylnej połaci skrzydła, z wylotem poniżej kalenicy skrzydła. Widać go na elewacjach tył i prawa oraz na rzucie poddasza w zakreskowanej tylnej połaci. Z frontu go nie widać. W przekroju przy kalenicy głównej jest też mała rura wywiewna. |
| M1 | M |  | Ściany z białego gładkiego tynku, cokół jasnoszary. Parter frontu od wnęki wejściowej przez skrzydło, tylna ściana skrzydła i tylna część prawej ściany bryły głównej mają okładzinę z pionowych jasnych desek (kolor miodowy). Brama garażu ma to samo wykończenie. |
| M2 | M |  | Dach z grafitowych płaskich dachówek. Obróbki krawędzi szczytów, rynny i rury spustowe są jasnoszare (srebrne). Stolarka okienna w kolorze drewna (złoty dąb). Balkony francuskie to szklane tafle mocowane punktowo. |

- **Wnętrze:** Parter. W bryle głównej są: salon z jadalnią 31,4 m² (tył i środek lewego boku, wyjście na taras przez podcięty tylny lewy narożnik), kuchnia 10,3 w przednim lewym narożniku z oknem narożnym, spiżarnia 1,6, hall 4,2 ze schodami z zabiegami, WC 2,4 oraz wiatrołap 3,3 we wnęce w przednim prawym narożniku. W skrzydle są: korytarz 5,1 (wąskie okno na front), pomieszczenie gospodarcze 4,9 z drzwiami na tył i garaż 32,4 na dwa auta z bramą od frontu i 2 wąskimi oknami w tylnej ścianie.

Poddasze. W bryle głównej są: pokój 11,1 (tył-lewo), pokój 8,7 (tył-prawo), pokój 13,0 (przód-lewo), łazienka 9,1 z wanną narożną (przód-prawo) i hall 3,6 ze schodami i kominem. W skrzydle są: pokój 20,2 z oknem w prawym szczycie i łazienka 3,4. Strefy niskie skrzydła są zakreskowane jako połacie: z przodu 2 okna połaciowe, z tyłu komin. Wzdłuż ścianek kolankowych narysowano zabudowę.

Styl rysunku. Ściany zewnętrzne i nośne mają pełne ciemnoszare wypełnienie, działowe są cieńsze. Pomieszczenia mają barwne tła (beż, niebieskie kafle w łazienkach, szary garaż), narysowano meble i samochody. Na rzutach nie ma linii wymiarowych, osi, grubości ścian ani gabarytu; podane są tylko nazwy i powierzchnie w m².

Przekrój (jeden). Podaje rzędne −0,30, ±0,00, +2,85, +3,04, +6,66, +7,81 oraz wysokości 252, 274, 260, 260 i 811.
- **Braki źródła:** 1. Pliki to JPG, a nie PNG (index.json to opisuje).
2. Obie elewacje boczne mają podpis „Elewacja boczna” bez wskazania strony. Przypisałem je z treści: 9d125a40 to PRAWA (szczyt skrzydła garażowego), deab0d1a to LEWA.
3. Elewacje są małe (700×305 px), więc drzwi, wąskie okna i obróbki są na granicy czytelności. Ciemny drewniany element na parterze przy lewej krawędzi elewacji prawej (strona frontu) to prawdopodobnie boczna ściana wnęki wejściowej, ale nie mam pewności.
4. Źródło nie pokazuje:
   - rzutu dachu, więc przebieg koszy i styk okapu skrzydła z bryłą główną nie jest narysowany;
   - żadnych wymiarów poziomych ani gabarytu;
   - kąta nachylenia dachu;
   - rzędnych okapów (podane są tylko kalenice);
   - planu sytuacyjnego;
   - widoku z tyłu ani z prawej strony (jest tylko jedna wizualizacja, od przedniego lewego narożnika, z aranżacją: numer „19”, samochód, zieleń);
   - linii cięcia przekroju (na rzutach jej nie zaznaczono; z treści wynika cięcie wzdłuż skrzydła i w poprzek bryły głównej).
5. Na rzucie parteru za tarasem jest niezidentyfikowany mały prostokąt, którego nie widać na żadnej elewacji.

## morwa — ARCHON „Dom pod morwą (ver. 2)”, https://www.archon.pl/projekty-domow/projekt-dom-pod-morwa-ver-2-m2361f70577cab

- **Nagłówek:** Dom parterowy, 1 kondygnacja nadziemna, poddasze nieużytkowe, bez piwnicy. Bryła prostokątna 15,60 × 9,60 m (wymiary zewnętrzne 1560 i 960 z rzutu). Kalenica +5,89 m, okap +2,54 m, ±0,00 = 0,32 m nad terenem. Dach dwuspadowy 30° (z przekroju).
- **Warstwy (czytelnik 1):** PROSTY, NIŻSZY_PRZY_ŚCIANIE — PROSTY: jedna bryła prostokątna i jeden dach dwuspadowy 30° nad nią, z kalenicą równoległą do frontu. Obie elewacje boczne to czyste trójkątne szczyty. KRZYŻUJĄCE nie ma: brak szczytu poprzecznego, koszy i drugiej kalenicy na żadnej elewacji ani w przekroju. HIP nie ma: oba krótkie boki to pełne szczyty, bez naczółków. NIŻSZY_PRZY_ŚCIANIE daje tylko akcesorium, nie druga bryła. To płaski daszek nad wejściem, który kończy się na ścianie frontowej pod okapem (przekrój, front). Dochodzi do niego pergola przy lewej ścianie szczytowej, jeśli jej przezierne przekrycie liczyć jako dach.
- **Warstwy (czytelnik 2, niezależnie):** PROSTY, NIŻSZY_PRZY_ŚCIANIE — ZGODNE; PROSTY (główny dach): parterowa bryła na prostokątnym rzucie (FLOOR_PLAN-na-GROUND-8f78efff.png / -8bcde98a.png / -da2c4a10.png / -6d346ed0.png: jeden prostokąt bez skrzydeł, przerywany obrys dachu też prostokątny) przykryta jednym dachem dwuspadowym. FRONT = ELEVATION-FRONT-na-3a9a6ea4.jpg („elewacja frontowa”, wejście z wiatrołapem): połać ma tam kształt prostokąta, kalenica biegnie przez całą szerokość, a oba boczne brzegi to pionowe wiatrownice, bez trójkątów naroży. Tak samo jest na ELEVATION-REAR-na-ce7c1efb.jpg („elewacja ogrodowa”). Obie elewacje boczne, ELEVATION-SIDE_UNSPECIFIED-na-d65c2c92.jpg (LEWA: szczyt salonu z dużym przeszkleniem 350/220 i tarasem) i ELEVATION-SIDE_UNSPECIFIED-na-a9a21a97.jpg (PRAWA: szczyt sypialni z dwoma oknami 90/140), pokazują pełny trójkąt szczytu aż do kalenicy. Przekrój SECTION-na-na-96bf60a5.jpg ma jeden symetryczny dach 30°, kalenicę na +5,89 i okap na +2,54. Perspektywy PERSPECTIVE-unk-na-fe680c54.jpg i -45cfb54f.jpg (front i lewy szczyt) oraz -1aeb5201.jpg i -a05fc3c0.jpg (tył i lewy szczyt) pokazują jedną kalenicę i dwa kominy.
HIP: nie. Na żadnej z czterech stron nie ma połaci trójkątnej: front i tył mają prostokątne połacie, a boki pełne szczyty.
KRZYŻUJĄCE: nie. Nie ma kalenicy poprzecznej, szczytu nad częścią elewacji ani koszy. Rzut nie ma wysuniętego skrzydła, a perspektywy pokazują ciągłą okapową krawędź frontu i tyłu.
NIŻSZY_PRZY_ŚCIANIE: tak, ale chodzi o lekkie zadaszenie, nie o pełny dach. Przy LEWYM szczycie, nad tarasem przed salonem, jest pergola z drewnianych belek wspornikowych przykryta płaską taflą (wygląda na szkło lub poliwęglan). Widać ją na PERSPECTIVE-unk-na-fe680c54.jpg i -1aeb5201.jpg (po powiększeniu widać jasną płytę na belkach). Jej brzeg widać też na FRONT 3a9a6ea4 po lewej i na REAR ce7c1efb po prawej, jako krótki brązowy pas z jasnym wierzchem wystający poza wiatrownicę. Na LEWEJ elewacji d65c2c92 widać czoła belek na górnej krawędzi okładziny drewnianej. Zadaszenie jest przymocowane do ściany szczytowej poniżej trójkąta szczytu, a ściana szczytowa wznosi się nad nim aż do kalenicy. Jest to więc niższe, prawie płaskie zadaszenie kończące się na wyższej ścianie, bez kosza.
Uwaga, nie liczone jako osobna warstwa: przy wejściu na FRONCIE stoi szary portal-rama z płaskim wierzchem (PERSPECTIVE fe680c54, FRONT 3a9a6ea4: pas pod rynną nad wejściem; boczne elewacje: szary wysięg przy froncie; SECTION 96bf60a5: płyta wysunięta z wieńca). Wierzch portalu leży tuż pod okapem głównego dachu, który go nakrywa. Portal nie kończy się na ścianie wznoszącej się ponad niego, więc uznaję go za element wejścia pod okapem, a nie za dach niższy przy ścianie. Jeśli protokół liczy taki portal jako zadaszenie, wzmacnia on tylko klasę NIŻSZY_PRZY_ŚCIANIE i nie dodaje nowej.
- **W próbie NEW-H:** TAK

| dach | nad | rodzaj | kalenica |
|---|---|---|---|
| R1 | cała bryła 15,60 × 9,60 m (dach główny, szczyty na lewym i prawym boku, okapy na froncie i tyle) | GABLE | PARALLEL_TO_FRONT |
| R2 | strefa wejścia na froncie: podest przed kotłownią i wiatrołapem, ok. 3,9–8,4 m od lewego narożnika, wysięg ok. 1,45 m (płaski daszek wsparty na pylonie) | FLAT | NONE |
| R3 | część tarasu przy lewym szczycie przed przeszkleniem 350/220, ok. 4 × 1,7 m (pergola z prawdopodobnie przeziernym przekryciem) | OTHER | NONE |

| A | B | połączenie | dowód |
|---|---|---|---|
| R1 | R2 | LOWER_ROOF_AT_WALL | Przekrój 96bf60a5: płyta daszku jest zamocowana przy wieńcu ściany frontowej, z wierzchem ok. +2,54 tuż pod końcem okapu dachu głównego, bez kosza; wysięg ok. 1,45 m wobec okapu ok. 0,6 m. Elewacja frontowa 3a9a6ea4: szara płyta leży bezpośrednio pod linią okapu nad polem kamienia. Perspektywa fe680c54. |
| R1 | R3 | LOWER_ROOF_AT_WALL | Elewacja d65c2c92: czoła belek pergoli wychodzą z lewej ściany szczytowej na ok. +2,8–3,0, a ściana szczytu wznosi się nad nimi do kalenicy, bez kosza. Na 3a9a6ea4 i ce7c1efb belka pergoli wystaje poniżej wiatrownicy i poza nią. Perspektywy 1aeb5201 i fe680c54. |
| R2 | R3 | APART | Daszek R2 jest na froncie (ok. 3,9–8,4 m od lewego narożnika), pergola R3 na lewym szczycie. Dzieli je narożnik front‑lewy i ok. 4 m frontu: rzut 8f78efff, elewacja 3a9a6ea4, perspektywa fe680c54. |

| id | kat. | KEY | cecha |
|---|---|---|---|
| F1 | F | KEY | Jedna bryła na rzucie prostokąta 15,60 × 9,60 m. Na rzucie 8f78efff/8bcde98a wymiar 1560 biegnie wzdłuż frontu, 960 w głąb. Proporcję 1,62 potwierdzają elewacje 3a9a6ea4 (front) oraz d65c2c92/a9a21a97 (boki). Nie ma ryzalitów, wykuszy, lukarn, garażu ani dobudówek. |
| F2 | F | KEY | Jedna kondygnacja: parter o wysokości w świetle 260. Nad nim płaski strop i nieużytkowe poddasze. Przekrój 96bf60a5 pokazuje tam tylko płatwie na słupkach, bez podłogi użytkowej i bez schodów. Piwnicy nie ma, w przekroju widać ławy fundamentowe. ±0,00 leży na +0,32 nad terenem (rzędna −0,32). |
| F3 | F | KEY | Dach główny dwuspadowy, symetryczny, 30°, nad całą bryłą. Kalenica jest równoległa do frontu i biegnie przez całą długość 15,60 m w połowie głębokości budynku. Kalenica na +5,89, okap na +2,54. Lewy i prawy bok to pełne trójkątne ściany szczytowe (d65c2c92, a9a21a97). Front i tył to połacie z okapem na całą długość (3a9a6ea4, ce7c1efb). Na połaciach nie ma okien połaciowych, lukarn, uskoków ani naczółków. |
| F4 | F |  | Wysunięcia dachu: okap frontowy i tylny ok. 0,6 m (przekrój, odrys). Wiatrownice na obu szczytach ok. 0,75–0,9 m (kropkowany obrys okapu na rzucie, elewacja frontowa). Pod wiatrownicami widać białe kostki, prawdopodobnie końce płatwi (TRACE_UNCERTAIN). |
| F5 | F |  | Płaski daszek nad wejściem: szara płyta, w przekroju wspornikowa płyta przy wieńcu ściany frontowej. Spód ok. +2,23, wierzch ok. +2,54, czyli tuż pod krawędzią okapu dachu głównego. Wzdłuż frontu sięga od ok. 3,9 do 8,4 m od lewego narożnika. Wysięg według rzutu i przekroju ok. 1,45 m, więc daszek wychodzi poza linię okapu. Obie elewacje boczne pokazują tylko ok. 0,85–0,9 m. To sprzeczność; przyjmuję rzut i przekrój. |
| F6 | F |  | Szara ściana‑pylon prostopadła do frontu, na prawej krawędzi strefy wejścia: ok. 8,1–8,4 m od lewego narożnika, grubość ok. 0,3 m. Biegnie od podestu do daszku i go podpiera. Na rzucie to czarny odcinek ściany wysunięty ok. 1,45 m. Widać go na 3a9a6ea4 i fe680c54 oraz jako szary blok na obu elewacjach bocznych. |
| F7 | F |  | Podniesiony, utwardzony podest wejściowy przed kotłownią i wiatrołapem: ok. 3,9–8,4 m od lewego narożnika, głębokość ok. 1,8 m (kropkowane wypełnienie na rzucie). Stopień widać u dołu elewacji frontowej. |
| F8 | F |  | Pergola na lewej ścianie szczytowej, nad przeszkleniem 350/220. Brązowe belki: na d65c2c92 widać czoła 4 krokwi, na 1aeb5201 i fe680c54 krokwie z belką czołową. Przekrycie wygląda na przezierne, białe/szklane panele na 1aeb5201 (TRACE_UNCERTAIN). Wysięg ok. 1,7 m: końce belek wystają poza wiatrownicę na 3a9a6ea4 i ce7c1efb. Szerokość ok. 4 m, od ok. 1,0 do 5,0 m od tylnego narożnika. Wysokość ok. +2,7–3,0, czyli nad poziomem okapu, a pod wiatrownicą szczytu. Na rzucie nie jest narysowana; podpór nie widać. |
| F9 | F |  | Taras w kształcie L wzdłuż lewego boku (ok. 3,8 m) i tyłu (ok. 3,6 m). Na rzucie: nawierzchnia, meble, donice z roślinnością, murek przy lewej krawędzi. Na 1aeb5201 taras jest podniesiony, z betonowym obrzeżem. Zadaszenia nad tarasem nie ma, poza pergolą. |
| S1 | S | KEY | FRONT to długi bok 15,60 m z drzwiami wejściowymi, podpisany „elewacja frontowa” (3a9a6ea4). Na rzucie to dolna krawędź: wiatrołap 1, drzwi 100/210, podest, pylon. Lewa połowa frontu to kuchnia, kotłownia i wejście; prawa to pokoje 11 i 10. |
| S2 | S |  | TYŁ to długi bok podpisany „elewacja ogrodowa” (ce7c1efb). Na rzucie to górna krawędź, z wyjściami na taras z salonu i z pokoju 8. Na obrazie ce7c1efb lewy koniec domu (salon, pergola) jest po prawej stronie. |
| S3 | S |  | LEWY bok (patrząc na front) to szczyt od salonu i kuchni, z przeszkleniem 350/220 w drewnie i z pergolą. Odpowiada mu „elewacja boczna” d65c2c92; identyfikacja z rzutu, bo podpis nie mówi, która to strona. Na tym obrazie tył jest po lewej, a front po prawej. |
| S4 | S |  | PRAWY bok to szczyt strefy sypialnej (pokoje 8 i 10), z dwoma oknami 90/140 w drewnianym panelu. Odpowiada mu „elewacja boczna” a9a21a97 (front po lewej, tył po prawej). |
| S5 | S |  | Perspektywy: fe680c54 to widok z narożnika front‑lewy (front i lewy szczyt z pergolą), 1aeb5201 to widok z narożnika tył‑lewy (tył i lewy szczyt). Pliki 45cfb54f i a05fc3c0 to ich miniatury. Prawego boku nie pokazuje żadna perspektywa. |
| O1 | O | KEY | Drzwi wejściowe 100/210 na froncie, ok. 5,8–6,8 m od lewego narożnika, czyli na lewo od środka. Drewniane (brązowe), jednoskrzydłowe, z wąskim pionowym przeszkleniem. Stoją w polu okładziny kamiennej pod płaskim daszkiem; tuż na prawo od nich jest szary pylon. Prowadzą do wiatrołapu 1. |
| O2 | O |  | Pozostałe otwory frontu, od lewej:
- okno kuchni 150/130, 2‑dzielne, w tynku, ok. 0,9–2,3 m;
- okno kotłowni 80/120, 1‑dzielne, w kamieniu, ok. 4,4–5,2 m;
- okno pokoju 11 150/140, 2‑dzielne, ok. 9,2–10,7 m;
- okno pokoju 10 150/140, 2‑dzielne, ok. 12,4–13,9 m, a obok niego drewniany panel do narożnika.
Garażu i bramy nie ma. |
| O3 | O |  | Tył, odległości od prawego narożnika:
- drzwi tarasowe pokoju 8, 200/220, 2‑skrzydłowe, ok. 1,5–3,4 m;
- okno łazienki 100/150, ok. 5,6–6,6 m;
- drzwi tarasowe salonu z jadalnią, 200/220, 2‑skrzydłowe, ok. 8,7–10,7 m, czyli ok. 4,9–6,9 m od lewego narożnika.
Wszystkie trzy stoją w okładzinie kamiennej, a duże drzwi sięgają do cokołu. |
| O4 | O |  | Lewy szczyt: największy otwór domu, przeszklenie 350/220 do salonu. Składa się z części stałej przy tyle i drzwi dwuskrzydłowych bliżej frontu; na elewacji ma 3 pola. Zajmuje ok. 1,3–4,8 m od tylnego narożnika, w drewnianej okładzinie, pod pergolą. Innych otworów na tym boku nie ma. |
| O5 | O |  | Prawy szczyt: dwa okna 90/140, oba 1‑dzielne, w drewnianym panelu. Okno pokoju 10 jest ok. 2,9–3,7 m od frontu, okno pokoju 8 ok. 5,9–6,7 m od frontu. |
| C1 | C |  | Komin kotłowni na połaci frontowej, ok. 3,5 m od lewej ściany szczytowej i ok. 3,4 m od ściany frontowej (ok. 1,3 m przed kalenicą). Przekrój ok. 0,7 × 0,7 m, wylot ok. 0,4 m ponad kalenicą (ok. +6,3), szary i gładki. W całości widać go na 3a9a6ea4, na ce7c1efb tylko wierzchołek, a na obu szczytach po stronie frontu. |
| C2 | C |  | Komin kominka na połaci tylnej, ok. 7,3 m od lewej ściany szczytowej i ok. 3,3 m od ściany tylnej (ok. 1,5 m za kalenicą). Kominek widać na rzucie w ścianie między salonem a WC 6. Przekrój ok. 0,7 × 0,7 m, wylot ok. +6,33 (przekrój), szary. W całości widać go na ce7c1efb i w przekroju, na 3a9a6ea4 tylko wierzchołek. |
| M1 | M |  | Ściany w przeważającej części z białego tynku. Wzdłuż podstawy ciemnoszary cokół. |
| M2 | M |  | Okładzina kamienna z jasnego piaskowca w poziomych płytkach, na pełną wysokość ściany. Na froncie od ok. 2,4 do 8,1 m od lewego narożnika: wokół okna kotłowni i drzwi, aż do pylonu. Na tyle pas od drzwi salonu do drzwi pokoju 8, ok. 4,8–14,2 m od lewego narożnika. |
| M3 | M |  | Okładzina drewniana z brązowych poziomych desek:
- lewy szczyt: pole ok. 5,8 m od tylnego narożnika, do ok. +3,0, z przeszkleniem 350/220; zawija się ok. 1 m na tył jako pionowy pas przy narożniku (ce7c1efb);
- prawy szczyt: prostokątny panel centralny ok. 2,2–7,3 m od frontu, z dwoma oknami;
- front: panel na wysokości okna, przy oknie pokoju 10, do prawego narożnika; ciągnie się dalej ok. 0,7 m na prawym szczycie (a9a21a97). |
| M4 | M |  | Dach z grafitowej blachy na rąbek stojący. Wiatrownice, rynny i rury spustowe szare, kominy szare. |
| M5 | M |  | Stolarka okien i drzwi brązowa (drewnopodobna). Drzwi wejściowe drewniane, z przeszkleniem. |
| M6 | M |  | Daszek wejściowy i pylon szare (tynk lub beton). Pergola z brązowego drewna, z przekryciem przeziernym (TRACE_UNCERTAIN). |

- **Wnętrze:** Parter, numeracja z rzutu 8bcde98a, nazwy i powierzchnie z 8f78efff:
1 Wiatrołap 7 m²; 2 Kotłownia 6,09 m²; 3 Kuchnia 9,47 m²; 4 Salon + Jadalnia 35,35 m²; 5 Korytarz 6,95 m²; 6 bez nazwy, 1,78 m² (WC z umywalką); 7 Łazienka 9,34 m²; 8 Pokój 14,05 m²; 9 bez nazwy, 2,07 m² (schowek/garderoba z półkami, drzwi harmonijkowe); 10 Pokój 12,07 m²; 11 Pokój 12,07 m².

Układ: wejście z frontu, na lewo od środka, prowadzi do wiatrołapu 1. Na lewo od niego przy froncie są kotłownia 2 i kuchnia 3. Kuchnia jest otwarta na salon z jadalnią 4, który zajmuje lewy‑tylny narożnik; ma wyjścia na lewy szczyt (350/220) i na tył (200/220) oraz kominek w ścianie od strony WC 6. Poprzeczny korytarz 5 prowadzi do strefy nocnej po prawej: pokoje 11 i 10 przy froncie, łazienka 7 i pokój 8 przy tyle, WC 6 i schowek 9 przy korytarzu. Szafy wnękowe (oznaczone X) stoją między pokojami 11 i 10, przy pokoju 8 i przy wiatrołapie.

Sposób rysunku: ściany zewnętrzne i nośne to grube czarne wypełnienie bez warstw, działowe cieńsze czarne. Okna to cienkie linie z opisem szer./wys. w kółku. Obrys okapu jest linią przerywaną ok. 0,6–0,75 m od ścian. Narysowane są meble, kominek (żółty symbol), taras z roślinnością i kropkowany podest wejściowy. Numery i wymiary są czerwone.

Wydrukowane wymiary:
- obrys: 1560 × 960 (zewnętrzne);
- pomieszczenia: 714 i 505 (salon), 320 (łazienka), 390 × 368 (pokój 8), 126 (pom. 9), 342 (pokój 10), 284 / 195 / 211 (kuchnia / kotłownia / wiatrołap), 361 i 361 (pokoje 11 i 10);
- otwory: front 150/130, 80/120, 100/210, 150/140, 150/140; lewy 350/220; tył 200/220, 100/150, 200/220; prawy 90/140, 90/140;
- przekrój: ±0,00; −0,32; +2,54; +5,89; 260; 30°.
- **Braki źródła:** Problemy z obrazami źródła:
- Obie elewacje boczne (d65c2c92, a9a21a97) mają podpis tylko „elewacja boczna”. Lewą od prawej odróżniłem po otworach z rzutu: 350/220 kontra 2 × 90/140.
- Perspektywy pokazują tylko lewą stronę domu (narożnik front‑lewy fe680c54 i tył‑lewy 1aeb5201). Pliki 45cfb54f (200×150) i a05fc3c0 (400×300) to ich miniatury, a prawego boku nie pokazuje żadna perspektywa.
- Rzut parteru występuje w 4 plikach jednego rysunku: da2c4a10 (550 px) i 6d346ed0 (400 px) to miniatury, 8bcde98a ma numery i wymiary, 8f78efff nazwy i powierzchnie. Pomieszczenia 6 i 9 mają tylko powierzchnię, bez nazwy.
- Wszystkie obrazy mają znak wodny.
- Elewacje to fotorealistyczne rzuty prostokątne, bez wymiarów i rzędnych.

Wewnętrzna sprzeczność: wysięg daszku i pylonu na rzucie i w przekroju wynosi ok. 1,45 m, a na obu elewacjach bocznych ok. 0,85–0,9 m.

Czego źródło nie pokazuje:
- rzutu dachu, rzutu poddasza, dostępu na poddasze (włazu/schodów), planu sytuacyjnego i kierunku północy;
- przekroju podłużnego (jest tylko jeden poprzeczny);
- grubości ścian, wysokości parapetów, wymiarów wysięgu okapów i wiatrownic, wymiarów i wysokości kominów;
- wymiarów daszku wejściowego i pergoli; pergoli nie ma na rzucie, a jej podpory i materiał przekrycia są nieczytelne;
- wysokości pasów okładziny drewnianej i kamiennej (odczytane z elewacji jako odrys).

Budynek nie ma garażu, piwnicy, lukarn ani okien połaciowych.

## argos (Studio Atrium, https://www.studioatrium.pl/projekty-domow/Argos,1270.html)

- **Nagłówek:** Dom parterowy z poddaszem użytkowym (2 kondygnacje nadziemne) z dostawionym jednostanowiskowym garażem z dachem płaskim. Wymiary wydrukowane na rzucie parteru: całość 11,60 × 12,80 m, bryła główna 7,75 × 10,80 m, garaż 3,85 m szerokości, ramy z przodu i z tyłu po 1,00 m. Wysokości nie podano. Kąta dachu nie podano; z elewacji odmierzyłem ok. 35°, a kalenica wypada ok. 7,6 m nad terenem (oba odczyty niepewne).
- **Warstwy (czytelnik 1):** PROSTY, NIŻSZY_PRZY_ŚCIANIE — PROSTY: jeden symetryczny dach dwuspadowy nad jedną prostokątną bryłą główną, z kalenicą od frontu do ogrodu. NIŻSZY_PRZY_ŚCIANIE: płaski dach garażu, rama frontowa i płyta balkonu na ramie ogrodowej to niższe dachy płaskie, które kończą się na ścianach bryły głównej (prawej, frontowej i tylnej) poniżej okapu albo szczytu. Nie KRZYŻUJĄCE: nie ma kalenicy poprzecznej, szczytu poprzecznego ani koszy. Nie HIP: nie ma połaci kopertowych.
- **Warstwy (czytelnik 2, niezależnie):** PROSTY, NIŻSZY_PRZY_ŚCIANIE — ZGODNE; Opis z 10 obrazów z katalogu studioatrium-argos. Strony: FRONT to elewacja podpisana „frontowa”, z wejściem i bramą garażu. Garaż stoi po PRAWEJ stronie, patrząc na front.

1) PROSTY: korpus domu z poddaszem ma jeden dach dwuspadowy. Kalenica biegnie od frontu do ogrodu.
- ELEVATION-FRONT-na-0c21afe8.jpg i ELEVATION-REAR-na-6224a142.jpg pokazują pełne, symetryczne trójkątne szczyty sięgające kalenicy. Na obu są drewniane deski wiatrowe i dwa okna w ścianie szczytowej.
- Elewacje boczne pokazują po jednej prostokątnej, nieprzerwanej połaci. ELEVATION-SIDE_UNSPECIFIED-na-002f203d.jpg to strona LEWA: samochód po prawej, taras po lewej. Na połaci są 3 okna połaciowe, 2 kominy i płotek śniegowy. ELEVATION-SIDE_UNSPECIFIED-na-04178e25.jpg to strona PRAWA, garażowa: samochód po lewej, taras po prawej. Na połaci jest 1 okno połaciowe i 2 kominy.
- Perspektywy potwierdzają ten sam dach: PERSPECTIVE-unk-na-c914bbf8.jpg (front i lewy bok), PERSPECTIVE-unk-ATTIC-554ccd8b.jpg (front i prawy bok) oraz ELEVATION-FRONT-na-6d2f2874.jpg (w rzeczywistości perspektywa ogrodu i prawego boku).

2) NIŻSZY_PRZY_ŚCIANIE: jednostanowiskowy garaż i rama nad wejściem tworzą jedną niższą bryłę z płaskim dachem, czyli stropodachem z attyką.
- Na rzucie FLOOR_PLAN-na-GROUND-0f40db98.png garaż (pomieszczenie 8) stoi przy prawej ścianie korpusu. Ma 3,85 m szerokości i sięga mniej więcej 2/3 głębokości domu. Rama nad wejściem wysuwa się przed front o 1,00 m.
- Na ELEVATION-FRONT-na-0c21afe8.jpg i PERSPECTIVE-unk-ATTIC-554ccd8b.jpg płaska górna krawędź ramy biegnie poziomo przez ścianę szczytu. Dochodzi do lica wyższej ściany szczytowej, która wznosi się nad nią.
- Na ELEVATION-SIDE_UNSPECIFIED-na-04178e25.jpg i ELEVATION-REAR-na-6224a142.jpg (garaż po lewej) płaski dach garażu kończy się na prawej ścianie bocznej korpusu. Leży poniżej okapu dachu głównego i nad nim widać jeszcze pas tej ściany. Okap dachu głównego wisi nad garażem, ale połacie się nie przenikają.
- Na ELEVATION-SIDE_UNSPECIFIED-na-002f203d.jpg (strona lewa) garaż widać tylko w tle po prawej, jako płaską bryłę.
- Nie ma tu kosza ani zlewki dachu do dachu. To niższy dach oparty o wyższą ścianę.
- Balkon z balustradą szklaną nad tarasem od strony ogrodu (ELEVATION-REAR-na-6224a142.jpg, ELEVATION-FRONT-na-6d2f2874.jpg, PERSPECTIVE-REAR-na-e684b741.jpg, rzut FLOOR_PLAN-na-ATTIC-8418f4ba.png) to płyta wysunięta o 1,00 m. Ona też kończy się płasko na tylnej ścianie szczytowej. To pomost balkonu, a nie osobny dach. Nawet liczony jako dach niczego by nie zmienił, bo ta klasa już obowiązuje.

3) KRZYŻUJĄCE nie występuje. Na żadnej elewacji ani perspektywie nie ma kalenicy poprzecznej, szczytu poprzecznego nad częścią elewacji, lukarny ani koszy. Obie połacie boczne są ciągłymi prostokątami, przerwanymi tylko oknami połaciowymi i kominami.

4) HIP nie występuje. Oba końce kalenicy zamykają pełne ściany szczytowe na froncie i od ogrodu. Na elewacjach bocznych połacie są prostokątne, nie trapezowe, i nie widać żadnej połaci kopertowej ani naczółka.
- **W próbie NEW-H:** nie (poza limitem czterech domów, §5)

| dach | nad | rodzaj | kalenica |
|---|---|---|---|
| R1 | bryła główna (parter + poddasze użytkowe), 7,75 × 10,80 m | GABLE | PERPENDICULAR_TO_FRONT |
| R2 | garaż jednostanowiskowy przy prawym boku bryły głównej (szer. 3,85 m) | FLAT | NONE |
| R3 | rama frontowa: pas 1,00 m przed ścianą frontową, od ok. 1,8 m od lewego narożnika do garażu (podcień wejścia i zadaszenie wjazdu); jedna ciągła płaska bryła z R2 | FLAT | NONE |
| R4 | rama ogrodowa: zadaszenie tarasu 1,00 m przed tylną ścianą (ok. 0,45–6,65 m od lewego narożnika), na wierzchu balkon poddasza | FLAT | NONE |

| A | B | połączenie | dowód |
|---|---|---|---|
| R1 | R2 | LOWER_ROOF_AT_WALL | Płaski dach garażu z attyką kończy się na prawej ścianie bryły głównej, tuż pod prawym okapem dachu dwuspadowego; koszy nie ma. Widać to na elewacji frontowej 0c21afe8 (góra garażu ok. y=392, rynna okapu ok. y=385), na elewacji prawej 04178e25 (nad attyką garażu, pod okapem, odsłonięty pas szarej ścianki kolankowej) i na perspektywie 554ccd8b (okap z rynną nad dachem garażu). |
| R1 | R3 | LOWER_ROOF_AT_WALL | Płaska rama frontowa kończy się na ścianie szczytu frontowego, a szczyt z dwoma oknami poddasza wznosi się nad nią. Widać to na elewacji 0c21afe8 i na perspektywach 554ccd8b i c914bbf8. |
| R2 | R3 | IN_LINE | Ta sama wysokość i ciągła attyka. Pas ramy przechodzi bez uskoku w dach garażu i razem tworzą bryłę w kształcie L. Widać to na elewacji 0c21afe8 (ciągła góra od x=290 do x=878), na perspektywie 554ccd8b i na rzucie poddasza 8418f4ba (jeden podwójny obrys attyki wokół garażu i pasa frontowego). |
| R1 | R4 | LOWER_ROOF_AT_WALL | Płyta ramy ogrodowej (balkon) kończy się na ścianie szczytu ogrodowego, w której są drzwi balkonowe. Dach dwuspadowy jest nad nią, bez koszy. Widać to na elewacji 6224a142 i na perspektywach e684b741 i 6d2f2874. |
| R2 | R4 | APART | Garaż leży z przodu po prawej, a jego tylna ściana jest ok. 2,9 m przed tylną ścianą domu. Balkon z ramą ogrodową jest z tyłu, na odcinku 0,45–6,65 m od lewego narożnika. Te dachy się nie stykają. Widać to na rzucie parteru 0f40db98 i na elewacji prawej 04178e25. |
| R3 | R4 | APART | Rama frontowa jest z przodu, ogrodowa z tyłu, a rozdziela je cała głębokość bryły głównej (10,80 m). Widać to na rzucie parteru 0f40db98. |

| id | kat. | KEY | cecha |
|---|---|---|---|
| F1 | F | KEY | Bryła główna to prostokąt 7,75 × 10,80 m (wymiary z rzutu parteru). Krótszy bok jest szczytem zwróconym do frontu i do ogrodu. Ma dwie kondygnacje nadziemne: parter i poddasze użytkowe pod dachem ze ściankami kolankowymi. Rzutu piwnicy brak. |
| F2 | F | KEY | Dach główny dwuspadowy, symetryczny. Kalenica biegnie prostopadle do frontu (od frontu do ogrodu), ściany szczytowe są na elewacji frontowej i ogrodowej, okapy na bocznych. Kąta nie wydrukowano: z elewacji frontowej i ogrodowej odmierzyłem ok. 35° (niepewne). Okap wysunięty ok. 1,0 m poza ściany boczne (odmierzone z elewacji frontowej). Na rzucie poddasza widać nieopisane linie przerywane; mogą oznaczać obrys okapu, który wtedy wychodzi ok. 0,7 m przed szczyty (niepewne). |
| F3 | F | KEY | Garaż jednostanowiskowy, parterowy, dostawiony do prawego boku bryły głównej i z nią dzielący ścianę. Szerokość 3,85 m (wydrukowane). Dach płaski z attyką; górna krawędź ok. 3,7 m nad terenem (odmierzone z elewacji), czyli tuż pod prawym okapem dachu głównego. Tylna ściana garażu jest cofnięta ok. 2,9 m względem tylnej ściany domu (odmierzone z rzutu), więc garaż nie dochodzi do elewacji ogrodowej. Prawa ściana garażu jest przedłużona o 1,00 m do przodu i tworzy prawą nogę ramy frontowej. |
| F4 | F | KEY | Rama frontowa: gruby biały pas z płaskim dachem i attyką, wysunięty 1,00 m przed ścianę frontową (wymiar 1,00 na rzucie). Zaczyna się ok. 1,8 m od lewego narożnika, biegnie przed szczytem nad oknem pomieszczenia gospodarczego, nad wejściem i nad bramą, a w garażu przechodzi w jego dach. Razem z garażem tworzy jedną płaską bryłę w kształcie litery L; na rzucie poddasza zaznaczono ją podwójną linią attyki. Pod ramą jest podcień wejścia z drewnianym podestem, a brama garażowa jest cofnięta w głąb ramy. To główna cecha rozpoznawcza frontu. |
| F5 | F | KEY | Rama ogrodowa: biały pas z płaskim wierzchem wysunięty 1,00 m od tylnej ściany (wymiar 1,00 na rzucie). Sięga od ok. 0,45 m do ok. 6,65 m od lewego narożnika (odmierzone z rzutu poddasza i elewacji ogrodowej). Zadasza taras przed przeszkleniami parteru, a jej wierzch jest balkonem poddasza ze szklaną balustradą. Z lewej strony opiera się na murowanym filarze lub ściance, widocznej na rzucie parteru. Jej górna krawędź (ok. 3,25 m) leży niżej niż góra ramy frontowej i garażu (ok. 3,7 m); oba odczyty odmierzone z elewacji. |
| F6 | F |  | Na wysokości stropu nad parterem (ok. 3,3 m, odmierzone) biegnie wokół bryły głównej gzyms. Oddziela biały parter od szarego poddasza: ścianek kolankowych na bokach i ścian szczytowych. |
| F7 | F |  | Na szczycie frontowym i ogrodowym wysunięte okapy z drewnianą podbitką i widocznymi końcami płatwi lub wspornikami. |
| F8 | F |  | Drewniany taras od strony ogrodu, ok. 2,7 m głębokości (odmierzone, nie wydrukowane), częściowo pod ramą ogrodową. Przed wejściem drewniany podest pod ramą frontową. Podjazd z kostki prowadzi do garażu. |
| F9 | F |  | Okna dachowe: trzy na lewej połaci (dwa niżej, jedno wyżej, bliżej kalenicy) i jedno na prawej, mniej więcej w połowie długości. Na obu połaciach płotki przeciwśniegowe wzdłuż okapu. |
| S1 | S | KEY | FRONT to elewacja podpisana „elewacja frontowa” (0c21afe8). Widać na niej szczyt bryły głównej z dwoma oknami poddasza, ramę frontową, drzwi wejściowe i bramę garażową. Patrząc na front, garaż jest po prawej stronie. |
| S2 | S |  | LEWA to plik 002f203d (podpis „elewacja boczna”; front jest po prawej stronie obrazu). Pokazuje ścianę boczną bryły głównej z trzema oknami parteru i drewnianymi panelami oraz połać z trzema oknami dachowymi i dwoma kominami. Garaż wystaje w głębi przy prawej krawędzi obrazu, a koniec ramy ogrodowej z balustradą przy lewej. |
| S3 | S |  | PRAWA to plik 04178e25 (podpis „elewacja boczna”; front jest po lewej stronie obrazu). Na pierwszym planie pełna ściana garażu, za nią cofnięta boczna ściana domu i koniec ramy ogrodowej. Połać ma jedno okno dachowe i dwa kominy. |
| S4 | S |  | TYŁ to plik 6224a142 (podpis „elewacja ogrodowa”). Widać szczyt z balkonem na ramie, taras z przeszkleniami i garaż przy lewej krawędzi obrazu (z tyłu jest odwrócony). |
| O1 | O | KEY | Drzwi wejściowe na froncie, ok. 5,7 m od lewego narożnika. Pełne skrzydło z wąskim pionowym przeszkleniem w szarym obramowaniu, osadzone między dwoma polami okładziny z drewnianych lameli. Leżą w podcieniu pod ramą frontową, z drewnianym podestem, i prowadzą do wiatrołapu (1). |
| O2 | O | KEY | Brama garażowa na froncie, po prawej stronie: segmentowa, na wszystkich obrazach otwarta. Szerokość ok. 3,0 m (odmierzone z rzutu). Cofnięta w głąb ramy frontowej, tak że góra ramy tworzy nad nią nadproże i zadaszenie wjazdu. |
| O3 | O |  | Front, parter, na lewo od wejścia: okno pomieszczenia gospodarczego (5) z parapetem, a obok małe okno łazienki (3) osadzone wysoko w okładzinie drewnianej. Fragment ściany przy lewym narożniku jest pełny. |
| O4 | O |  | Front, poddasze: dwa jednakowe okna w szczycie, dla sypialni 3 i łazienki 2. |
| O5 | O |  | Tył, parter: dwa duże przesuwne przeszklenia, jedno w salonie (6), drugie w pokoju (7). Dzieli je pole okładziny z drewnianych lameli z kinkietami. Oba wychodzą na taras pod ramą ogrodową. |
| O6 | O |  | Tył, poddasze: dwa wysokie drzwi balkonowe z pokojów 4 i 5 na balkon ze szklaną balustradą, który leży na ramie ogrodowej. |
| O7 | O |  | Lewy bok, parter: trzy okna (licząc od frontu: kuchnia, jadalnia, salon), a między nimi dwa panele z poziomych drewnianych lameli. Na poddaszu tego boku nie ma okien w ścianie, światło dają okna dachowe. |
| O8 | O |  | Prawy bok: pełne ściany garażu i domu bez otworów. Z rzutu wynika jedynie, że przejście z garażu do wiatrołapu jest wewnątrz budynku. |
| C1 | C |  | Dwa tynkowane kominy na kalenicy dachu głównego, oba z jasną czapą. Większy, z wylotem stalowego wkładu, stoi ok. 20% długości dachu od frontu, mniejszy ok. 60% (odmierzone z obu elewacji bocznych). Na elewacji frontowej i ogrodowej widać tylko jeden, bo drugi się za nim chowa. |
| M1 | M |  | Parter, garaż i obie ramy wykończone białym tynkiem. Ściany szczytowe i kolankowe poddasza w szarym tynku o wyraźnej fakturze: na froncie jaśniejszym, na tyle ciemniejszym, co może wynikać z oświetlenia. |
| M2 | M |  | Okładzina z poziomych drewnianych lameli: na froncie wokół wejścia (pod ramą), z tyłu między przeszkleniami i na lewym boku między oknami. |
| M3 | M |  | Pokrycie dachu głównego: płaska dachówka, ciemnoszara lub grafitowa (na elewacjach niebieskoszara). Podbitka okapów drewniana. Rynny i rury spustowe szare, metalowe. |
| M4 | M |  | Stolarka okienna i drzwiowa grafitowa/szara. Balustrada balkonu ze szkła na słupkach ze stali nierdzewnej. Attyki garażu i ram mają szarą obróbkę. |

- **Wnętrze:** Parter (0f40db98): pomieszczenia są tylko ponumerowane, bez nazw i bez powierzchni. Funkcje podaję po wyposażeniu:
1 – wiatrołap: wejście z frontu i drzwi do garażu;
2 – hol ze schodami na poddasze;
3 – łazienka z prysznicem, umywalką i WC, okno na front;
4 – zamknięta kuchnia przy lewej ścianie, z oknem w boku;
5 – pomieszczenie gospodarcze/techniczne z pralką, zlewem i urządzeniem, wejście z kuchni, okno na front;
6 – salon z jadalnią w lewej tylnej części, z prawdopodobnym kominkiem przy ściance działowej, dwoma oknami w lewym boku i przeszkleniem na taras;
7 – pokój/gabinet w prawej tylnej części, z przeszkleniem na taras;
8 – garaż jednostanowiskowy.

Poddasze (8418f4ba):
1 – korytarz;
2 – łazienka z wanną narożną, prysznicem, dwiema umywalkami, WC i bidetem, prawy przód;
3 – sypialnia z łóżkiem podwójnym, lewy przód;
4 – pokój, lewy tył, wyjście na balkon;
5 – pokój, prawy tył, wyjście na balkon;
schody zabiegowe w prawej środkowej części.

Sposób rysowania: ściany jako szare wypełnienie z otworami i łukami skrzydeł, posadzki kolorowe z rysunkiem płytek i desek, meble. Na poddaszu cienkie linie ciągłe pokazują obrys płaskiego dachu garażu i ramy frontowej (podwójna linia attyki) oraz balkonu. Linie przerywane są nieopisane: zapewne obrys okapu i linia obniżonej wysokości.

Wymiary wydrukowane tylko na rzucie parteru: 11,60 (całość), 7,75 (bryła główna) i 3,85 (garaż) w poprzek; 12,80 (całość), 10,80 (bryła) oraz 1,00 i 1,00 (wysunięcia ram z tyłu i z przodu) w głąb. Rzut poddasza nie ma żadnych wymiarów.
- **Braki źródła:** Błędne etykiety w index.json:
- ELEVATION-FRONT-na-6d2f2874.jpg to nie elewacja frontowa. To perspektywa z bliska tarasu ogrodowego i balkonu na ramie, zrobiona od prawego tylnego narożnika, i tak brzmi też podpis.
- PERSPECTIVE-unk-ATTIC-554ccd8b.jpg ma storey ATTIC, a to perspektywa frontu prawie na wprost, bez związku z poddaszem.
- PERSPECTIVE-unk-na-c914bbf8.jpg to perspektywa od lewego przedniego narożnika.
- PERSPECTIVE-REAR-na-e684b741.jpg to perspektywa od lewego tylnego narożnika.
- Obie elewacje boczne mają widok SIDE_UNSPECIFIED: 04178e25 to strona prawa (garaż), 002f203d to strona lewa.

Elewacje są renderami bez wymiarów i bez rzędnych.

Źródło nie pokazuje:
- przekroju, więc brak wysokości kondygnacji, ścianki kolankowej, kalenicy i kąta dachu;
- rzutu dachu i planu sytuacyjnego;
- legendy pomieszczeń i ich powierzchni (są tylko numery);
- wymiarów poddasza;
- informacji o piwnicy;
- podparcia prawego końca ramy ogrodowej (jest niejasne);
- drugiego komina na elewacji frontowej i ogrodowej (zasłonięty);
- znaczenia linii przerywanych na rzucie poddasza.

## newcastle — Lipińscy „Newcastle II” (https://lipinscy.pl/projekt/newcastle-ii)

- **Nagłówek:** Parter + poddasze użytkowe (bryła główna), garaż dwustanowiskowy parterowy; bez piwnicy. Drukowany obrys całości 944 × 1844 cm (rzut parteru: 944 = od ściany tylnej bryły głównej do ściany frontowej garażu, 1844 = długość bryły głównej razem z garażem). Wysokości drukowane tylko na przekroju: kalenica +7,88 m, teren −0,45 m (ok. 8,3 m nad terenem), strop parteru +3,02, wysokość parteru +2,65, jętka +6,12, sufit poddasza +5,77. Kąt dachu NIEDRUKOWANY (z przekroju i elewacji bocznych ok. 40–42°, odczyt niepewny).
- **Warstwy (czytelnik 1):** PROSTY, NIŻSZY_PRZY_ŚCIANIE — Bryła główna to jeden prostokątny korpus pod jednym dachem dwuspadowym z kalenicą równoległą do frontu (PROSTY). Trzy niższe dachy płaskie — garaż, daszek wejścia (ciągła płyta z garażem) i daszek tarasu — kończą się na ścianach bryły głównej poniżej jej okapu, bez kosza (NIŻSZY_PRZY_ŚCIANIE). Żadna druga kalenica nie przecina dachu głównego i nie ma koszy (więc nie KRZYŻUJĄCE). Nigdzie nie ma połaci kopertowej (więc nie HIP).
- **Warstwy (czytelnik 2, niezależnie):** PROSTY, NIŻSZY_PRZY_ŚCIANIE — ZGODNE; Obejrzane obrazy: wszystkie cztery elewacje, oba przekroje i cztery rzuty (parter i poddasze, w tym dwie miniatury). Wizualizacji perspektywicznych w index.json nie ma. Pozycje z flagą "skipped: thumbnail" nie mają pliku, więc ich nie otwierałem.

PROSTY (tak): bryła główna jest prostokątna i stoi pod jednym dwuspadowym dachem. Kalenica biegnie równolegle do frontu. Widać to na ELEVATION-FRONT-na-3740c48a.jpg i ELEVATION-REAR-na-bab06068.jpg: jedna ciągła połać z prostą linią okapu, bez przerw i bez szczytów poprzecznych, a na krańcach pionowe krawędzie dachu. Na połaciach są tylko płaskie okna połaciowe (3 z przodu, 4 z tyłu) i kolektory z tyłu, bez lukarn. Obie elewacje boczne, ELEVATION-SIDE_LEFT-na-294d0a7a.jpg i ELEVATION-SIDE_RIGHT-na-8045cecf.jpg, pokazują pełny, symetryczny trójkąt szczytu. Przekroje SECTION-na-na-bbd9acf4.png i SECTION-na-na-01b0e627.png pokazują symetryczny dach dwuspadowy z kalenicą na +7,88 (jętka +6,12) nad jedną bryłą.

KRZYŻUJĄCE (nie): nigdzie nie ma kosza ani drugiej kalenicy. Linia okapu z przodu i z tyłu jest nieprzerwana. Obrys poddasza na FLOOR_PLAN-na-ATTIC-d9ac4b71.png i FLOOR_PLAN-na-ATTIC-f4452c31.png to czysty prostokąt bez wystającego skrzydła ze skośnym dachem.

HIP (nie): oba boki kończą się szczytem murowanym do samej kalenicy (elewacja lewa i prawa). Na elewacjach przedniej i tylnej nie ma trójkątnych połaci bocznych.

NIŻSZY_PRZY_ŚCIANIE (tak): po lewej stronie frontu stoi parterowy garaż (1.8 na FLOOR_PLAN-na-GROUND-ae2b05c6.png i FLOOR_PLAN-na-GROUND-188a61c6.png) z płaskim dachem i białym obramieniem attyki. Ten dach jest ciągły z daszkiem nad wejściem (1.9) i kończy się na wyższej ścianie bryły głównej, poniżej jej okapu, bez kosza. Widać to w kilku miejscach:
- ELEVATION-FRONT: biała płyta na wysokości około parteru dochodzi do ściany frontowej pod linią okapu.
- ELEVATION-SIDE_LEFT: płaski dach garażu z bramą stoi przed szczytem i opiera się o niego poniżej okapu.
- Rzuty poddasza: szara płaszczyzna płaskiego dachu garażu i daszku wejścia przylega do obrysu bryły głównej (do ściany szczytowej i frontowej).
- Przekroje: niskie płaskie przybudówki z attyką po obu stronach dochodzą do ścian zewnętrznych poniżej okapu.

Tak samo działa płaski daszek-rama nad tarasem 1.10 od strony tylnej. Widać go na ELEVATION-REAR, na ELEVATION-SIDE_LEFT i ELEVATION-SIDE_RIGHT (biała rama z boku) oraz jako szarą płaszczyznę po lewej stronie rzutu poddasza. Ten daszek również kończy się na ścianie poniżej okapu.

Klasyfikacja: PROSTY oraz NIŻSZY_PRZY_ŚCIANIE.
- **W próbie NEW-H:** nie (poza limitem czterech domów, §5)

| dach | nad | rodzaj | kalenica |
|---|---|---|---|
| R1 | bryła główna (parter + poddasze, ok. 12,0 × 7,4 m) | GABLE | PARALLEL_TO_FRONT |
| R2 | garaż dwustanowiskowy 1.8 przy lewym szczycie | FLAT | NONE |
| R3 | ganek wejściowy 1.9 wzdłuż frontu bryły głównej (przedłużenie płyty garażu, słup w narożniku) | FLAT | NONE |
| R4 | część tarasu tylnego 1.10 przy ścianie REAR (biała rama na dwóch słupach) | FLAT | NONE |

| A | B | połączenie | dowód |
|---|---|---|---|
| R1 | R2 | LOWER_ROOF_AT_WALL | ELEVATION-SIDE_LEFT-na-294d0a7a.jpg: biała opaska stropodachu garażu biegnie na tle lewej ściany szczytowej, wyraźnie poniżej okapu bryły głównej, bez kosza; FLOOR_PLAN-na-ATTIC-f4452c31.png: szare pole dachu płaskiego przylega do dolnej (szczytowej) ściany poddasza; ELEVATION-REAR-na-bab06068.jpg: garaż po prawej, niższy, przy ścianie bryły głównej. |
| R1 | R3 | LOWER_ROOF_AT_WALL | ELEVATION-FRONT-na-3740c48a.jpg: biała opaska daszku nad wejściem kończy się na ścianie frontowej poniżej okapu (okap wyżej, tynk/cegła między nimi); FLOOR_PLAN-na-ATTIC-f4452c31.png: szare pole wzdłuż prawej ściany poddasza; przekroje SECTION-na-na-bbd9acf4.png / 01b0e627.png: rama ganku po lewej stronie przekroju poniżej okapu. |
| R2 | R3 | IN_LINE | ELEVATION-FRONT-na-3740c48a.jpg: jedna ciągła biała opaska na tej samej wysokości nad garażem i nad gankiem aż do słupa; FLOOR_PLAN-na-ATTIC-f4452c31.png: jedno ciągłe szare pole w kształcie L; ELEVATION-SIDE_LEFT-na-294d0a7a.jpg: opaska garażu przechodzi poza ścianę garażu do białego słupa ganku. |
| R1 | R4 | LOWER_ROOF_AT_WALL | ELEVATION-REAR-na-bab06068.jpg: biała rama tarasu z płytą przylega do ściany tylnej poniżej okapu; FLOOR_PLAN-na-ATTIC-f4452c31.png: szary prostokąt dachu płaskiego przy lewej (tylnej) ścianie poddasza; ELEVATION-SIDE_LEFT i SIDE_RIGHT: rama przy tylnym narożniku poniżej okapu. |
| R2 | R4 | APART | FLOOR_PLAN-na-ATTIC-f4452c31.png i FLOOR_PLAN-na-GROUND-ae2b05c6.png: dach tarasu kończy się przed dolnym narożnikiem bryły, garaż jest cofnięty od lica tylnego o ok. 2,2 m — dachy rozdziela narożnik bryły głównej. |
| R3 | R4 | APART | FLOOR_PLAN-na-ATTIC-f4452c31.png: daszek wejścia przy ścianie frontowej, dach tarasu przy ścianie tylnej — po przeciwnych stronach bryły głównej. |

| id | kat. | KEY | cecha |
|---|---|---|---|
| F1 | F | KEY | Bryła główna: jeden prostokątny korpus ok. 12,0 × 7,4 m (odrys z rzutu, niedrukowane), parter + poddasze użytkowe ze ścianką kolankową ok. 1,5 m (przekrój: okap ok. +4,5, strop +3,02). Dach dwuspadowy symetryczny, kalenica równoległa do frontu (wzdłuż dłuższego boku, +7,88), ściany szczytowe na bokach LEFT i RIGHT, okapy z rynnami na FRONT i REAR, prawie bez nawisu na szczytach. |
| F2 | F | KEY | Garaż dwustanowiskowy (1.8): parterowa przybudówka z dachem płaskim (stropodach z białą opaską), dostawiona do LEWEJ ściany szczytowej bryły głównej. Ok. 6,5 m wzdłuż frontu × ok. 7,0 m w głąb (odrys); wysunięta przed lico frontu bryły głównej o ok. 1,8 m i cofnięta od lica tylnego o ok. 2,2 m (rzut parteru, elewacja LEFT). Górna krawędź opaski ok. +3,0 (odczyt z przekroju, niedrukowane), wyraźnie poniżej okapu bryły głównej. |
| F3 | F | KEY | Zadaszenie wejścia (ganek 1.9): płaski daszek w formie białej ramy, ciągłe przedłużenie stropodachu garażu wzdłuż frontu bryły głównej (dach płaski w kształcie L na rzucie poddasza), oparty na jednym słupie w narożniku przy prawym końcu ganku; ok. 2,7 m głębokości od ściany frontowej i ok. 1 m nawisu przed ścianą frontową garażu (linia przerywana na rzucie parteru). Wejście jest cofnięte pod daszek. Na tej płycie rzut poddasza ma niewyjaśnioną ukośną linię od narożnika daszku do narożnika bryły głównej (TRACE_UNCERTAIN: linia spadku/załamania lub inny element — źródło tego nie objaśnia). |
| F4 | F |  | Zadaszenie tarasu tylnego (1.10): biała rama portalowa z płaską płytą dachową przy ścianie REAR, na dwóch słupach, ok. 2,2 m głębokości × ok. 5,3 m (odrys), na tej samej wysokości co opaska garażu; obejmuje środkową część elewacji tylnej z przeszkleniem przesuwnym. Na rzucie poddasza narysowana jako szare pole dachu płaskiego. |
| F5 | F | KEY | Kondygnacje: parter (±0,00) i poddasze użytkowe (strop +3,02); posadzka na gruncie, ławy fundamentowe, bez piwnicy (przekrój). Garaż jednokondygnacyjny. |
| F6 | F |  | Poddasze doświetlone wyłącznie oknami połaciowymi w połaciach (3 na froncie, 4 z tyłu) i oknami w obu szczytach — brak lukarn i wystawek. Na rzucie poddasza okna połaciowe zaznaczone przerywanymi prostokątami przy ścianach kolankowych (front: 2.6, 2.7, 2.8; tył: 2.5, 2.4, 2.3, 2.2). |
| F7 | F |  | Na połaci tylnej, w górnej części, dwa panele kolektorów słonecznych obok siebie (elewacja REAR). |
| F8 | F |  | Taras tylny 1.10 jako dwuczęściowa posadzka przed ścianą REAR ze stopniami; przed wejściem stopnie w poprzek ganku; ciemny cokół wokół całego budynku. |
| S1 | S | KEY | FRONT = elewacja podpisana „przód” (zasób elewacja-przod): dłuższa ściana okapowa bryły głównej z wejściem pod białym daszkiem i garażem po lewej. Na rzucie parteru to PRAWA krawędź rysunku (strzałka wejścia przy 1.9). |
| S2 | S | KEY | LEFT = ściana szczytowa od strony garażu (na rzucie dolna krawędź). Przed nią stoi garaż z bramą — brama garażowa jest na elewacji LEFT, a nie na froncie. Na elewacji LEFT front jest po prawej stronie obrazu. |
| S3 | S |  | RIGHT = ściana szczytowa od strony salonu 1.4 (na rzucie górna krawędź); na elewacji RIGHT front jest po lewej stronie obrazu (widać tam ramę ganku), rama tarasu tylnego po prawej. |
| S4 | S |  | REAR = dłuższa ściana okapowa od ogrodu z tarasem 1.10 i białą ramą (na rzucie lewa krawędź); na elewacji REAR garaż jest po prawej stronie obrazu. |
| O1 | O | KEY | Drzwi wejściowe (FRONT): drewniane, jednoskrzydłowe, z długim pionowym pochwytem i przeszklonym naświetlem bocznym po lewej, w cofniętej ścianie frontowej bryły głównej pod daszkiem, mniej więcej w środku ganku; prowadzą do 1.1; przed nimi stopnie. |
| O2 | O | KEY | Brama garażowa (LEFT): jedna szeroka biała brama segmentowa na dwa stanowiska w ścianie LEFT garażu, przesunięta ku przodowi. Dodatkowo drewniane drzwi z ganku 1.9 do garażu w ścianie garażu od strony ganku (widoczne na elewacji RIGHT przez ramę ganku i na przekroju). |
| O3 | O |  | FRONT, pozostałe: pod daszkiem na lewo od drzwi małe pionowe okno (1.7); na prawo od daszku wysokie wąskie okno klatki schodowej przecinające poziom stropu; przy prawym narożniku duże okno salonu 1.4 obok panelu z pionowego deskowania; w ścianie frontowej garażu wysoko umieszczone poziome okno-pas; w połaci 3 okna połaciowe. |
| O4 | O |  | REAR: przy lewym narożniku (strona salonu) duże dwudzielne przeszklenie do podłogi; dalej panel deskowania, wąskie wysokie okno/drzwi, panel deskowania; w białej ramie tarasu potrójne przeszklenie przesuwne do podłogi (strefa 1.2/1.3); w tylnej ścianie garażu poziome okno-pas; w połaci 4 okna połaciowe i 2 kolektory. |
| O5 | O |  | LEFT: w szczycie poddasza dwuskrzydłowe okno do podłogi (2.2, bliżej tyłu) i jednoskrzydłowe (2.8, bliżej frontu), oba z dolnym pasem szkła — prawdopodobnie balkon francuski (TRACE_UNCERTAIN); w parterze bryły głównej jedno okno kuchni 1.3 przy tylnym narożniku; poniżej brama garażowa O2. |
| O6 | O |  | RIGHT: w szczycie dwa jednakowe wysokie okna do podłogi (2.5, 2.6) z dolnym pasem szkła; w parterze dwa przeszklenia salonu do podłogi — węższe przy froncie, szersze dwudzielne od tyłu — rozdzielone panelem pionowego deskowania. |
| C1 | C |  | Jeden komin: murowany z jasnej cegły, z metalową rurą na szczycie, na połaci FRONTOWEJ tuż przy kalenicy (wystaje ponad kalenicę), ok. 2 m od lewego szczytu (strona garażu); na rzutach szacht przy kotłowni 1.7 (CO) i łazience 2.8. Wysokość komina niedrukowana. |
| C2 | C |  | Na stropodachu garażu, przy krawędzi frontowej, dwa małe okrągłe elementy (rzut poddasza; na rzucie parteru w ścianie garażu przy ganku) — prawdopodobnie kanały wentylacyjne; na elewacjach niewidoczne. To nie jest komin (TRACE_UNCERTAIN). |
| M1 | M |  | Ściany: jasna, kremowo-biała cegła licowa na wszystkich elewacjach, także na szczytach i garażu. |
| M2 | M |  | Cokół: ciemnoszary kamień lub klinkier wokół budynku, łącznie z tarasem i stopniami. |
| M3 | M |  | Dach główny: ciemnografitowa dachówka płaska; jasne obróbki krawędzi szczytowych; szare metalowe rynny i rury spustowe (jedna rura na froncie przy narożniku daszku). |
| M4 | M |  | Pionowe deskowanie z jasnego drewna jako panele ścienne: FRONT (obok okna salonu), RIGHT (między przeszkleniami parteru), REAR (między oknami). |
| M5 | M |  | Białe gładkie (tynkowane) opaski i ramy: opaska stropodachu garażu, rama daszku wejścia ze słupem, rama tarasu tylnego ze słupami. |
| M6 | M |  | Stolarka okienna drewniana w kolorze miodowo-brązowym; drzwi wejściowe drewniane w kolorze miodowym; brama garażowa biała. |

- **Wnętrze:** Parter (FLOOR_PLAN GROUND 188a61c6 / ae2b05c6): numery bez nazw i bez powierzchni; funkcje odczytane z symboli. 1.1 wiatrołap/hol za drzwiami wejściowymi; 1.2 strefa dzienna i jadalnia (stół na 8 osób) ze schodami dwubiegowymi; 1.3 kuchnia z wyspą, oznaczenia L i Z, przy ścianie LEFT; 1.4 salon w szczycie RIGHT (narożnik, stolik), częściowo oddzielony ścianką; 1.5 WC; 1.6 spiżarnia/schowek; 1.7 kotłownia/pom. techniczne (CO, W, R); 1.8 garaż dwustanowiskowy (dwa samochody); 1.9 zadaszony ganek wejściowy ze strzałką wejścia; 1.10 taras tylny. Poddasze (ATTIC f4452c31 / d9ac4b71): 2.1 korytarz; 2.2 sypialnia z łóżkiem podwójnym i oknem do podłogi w szczycie LEFT; 2.3 garderoba; 2.4 mały pokój; 2.5 i 2.6 pokoje z łóżkiem pojedynczym i biurkiem przy szczycie RIGHT; 2.7 łazienka z wanną; 2.8 łazienka; 2.9 klatka schodowa. Styl rysunku: grube ściany zewnętrzne z ciemnografitowym wypełnieniem i jasną cienką warstwą ocieplenia, cienkie ciemne działówki, kolorowane podłogi (kremowe, niebieska glazura w łazienkach i 1.7, paski w kuchni i 1.6), meble i samochody jako symbole. Linie przerywane na parterze to obrysy daszków i dachów; szare pola na poddaszu to dachy płaskie niższych części; przerywane prostokąty na poddaszu to okna połaciowe. Wymiary drukowane: tylko 944 i 1844 (cm) na rzucie parteru; na poddaszu brak wymiarów. Przekrój poprzeczny przez bryłę główną (widok w stronę garażu, front po lewej) podaje rzędne: −0,45, ±0,00, +2,65, +3,02, +5,77, +6,12, +7,88.
- **Braki źródła:** Wszystkie cztery elewacje są renderowanymi kolorowymi widokami ortogonalnymi z rzuconymi cieniami — nie perspektywami — ale mają niską rozdzielczość (wys. 400 px) i nie mają wymiarów ani rzędnych. Cztery miniatury elewacji i jedna przekroju (ok. 120 px) pominięto. Dwa rzuty-miniatury (GROUND 4b72c9e8, ATTIC 374a3d85) są duplikatami 120 px. Pary GROUND 188a61c6/ae2b05c6, ATTIC f4452c31/d9ac4b71 oraz oba przekroje to prawie identyczne duplikaty. W zestawie nie ma żadnej wizualizacji (PERSPECTIVE) ani planu sytuacyjnego (SITE_PLAN). Czego źródło nie pokazuje: kąta dachu (brak liczby), wysokości okapu i dachów płaskich (tylko odczyt z przekroju), wysokości komina, nazw i powierzchni pomieszczeń (są tylko numery), wymiarów poszczególnych ścian, otworów i garażu (są tylko dwa wymiary całkowite), położenia linii przekroju na rzutach, budowy i odwodnienia stropodachów (attyka/spadek). Nie wiadomo, czym jest ukośna linia na płycie daszku wejścia ani dwa okrągłe elementy na dachu garażu. Nie ma też jednoznacznego potwierdzenia, że dolne pasy okien szczytowych to barierki szklane.

## elsa — Dobre Domy, projekt „Elsa III” (https://www.dobredomy.pl/projekt/elsaIII); opis tylko z 7 obrazów wydawcy (4 elewacje, rzut parteru, rzut poddasza, 1 perspektywa bez podpisu)

- **Nagłówek:** Parter + poddasze użytkowe (2 kondygnacje nadziemne), garaż jednostanowiskowy w bryle. Dach dwuspadowy na rzucie w kształcie T/L: dach główny z kalenicą prostopadłą do frontu plus skrzydło garażowe z kalenicą równoległą do frontu, obie kalenice na tej samej wysokości. Na obrazach NIE ma wydrukowanych wymiarów gabarytowych, wysokości budynku ani kąta dachu. Z proporcji elewacji oba dachy mają ok. 40°, ale to szacunek z rysunku, nie wartość źródłowa. Powierzchnie z etykiet: parter mieszkalny 65,5 m², garaż 20,9 m², pom. gosp. 6,7 m², poddasze 76,6 m² (sumy policzone z etykiet, na obrazach ich nie ma).
- **Warstwy (czytelnik 1):** KRZYŻUJĄCE — KRZYŻUJĄCE: dwa dachy dwuspadowe o prostopadłych kalenicach (R1 prostopadle do frontu, R2 równolegle) przenikają się wzdłuż dwóch koszy na wschodniej połaci R1, z kalenicami na tej samej wysokości. Nie PROSTY, bo nad domem nie ma jednego dachu nad jedną bryłą: są dwie bryły i dwa kierunki kalenic. Nie HIP, bo wszystkie zakończenia są szczytami: trójkątne szczyty R1 od frontu i od tyłu, trójkątny szczyt R2 na prawym boku, pionowa krawędź R2 na elewacji przód i tył. Nie NIŻSZY_PRZY_ŚCIANIE, bo żaden niższy dach nie kończy się na wyższej ścianie. Okap R2 jest wprawdzie niżej, ale R2 łączy się z R1 koszami i wspólną wysokością kalenicy. Loggia frontowa i balkon tylny leżą pod okapem R1, nie pod osobnymi dachami.
- **Warstwy (czytelnik 2, niezależnie):** KRZYŻUJĄCE — ZGODNE; Dach Elsy to dwa dachy dwuspadowe o kalenicach na tej samej wysokości, które przenikają się wzdłuż koszy (układ T/L). Opis oparłem wyłącznie na 7 obrazach z katalogu dobredomy-elsa.

Przyjęte strony: FRONT to ELEVATION-FRONT-na-495d5ccd.jpg (podpis „Elewacja przód”, wejście, garaż po prawej). Dwie elewacje są w indeksie opisane jako SIDE_UNSPECIFIED, więc strony ustaliłem sam. eb4cb92d to strona LEWA: taras jest po lewej (tył), a drewniany pokój po prawej (przód). fd74812d to strona PRAWA, od garażu: wejście jest po lewej (przód), a taras po prawej (tył). Zgadza się to z rzutem parteru (FLOOR_PLAN-na-GROUND), gdzie garaż stoi po prawej, a taras z tyłu.

1) Bryła główna (lewa część, pokój dzienny, kuchnia, pokój). Ma dach dwuspadowy z kalenicą biegnącą przód–tył.
- Front: duży szczyt z trójkątnym oknem; wierzchołek ok. x=460, okapy na y≈235.
- Tył (ELEVATION-REAR-na-24fb6753.jpg): taki sam szczyt po prawej stronie obrazu; wierzchołek ok. x=535, ta sama szerokość.
- Lewa elewacja (eb4cb92d): jedna ciągła połać na całą głębokość domu. Obrys jest prostokątem z pionowymi krawędziami po obu stronach, więc to strona okapowa bez szczytu i bez narożnika czterospadowego.

2) Skrzydło prawe (garaż i pom. gosp.; na poddaszu pralnia, łazienka 7,0 i pokój 9,5). Ma własny dach dwuspadowy z kalenicą lewo–prawo.
- Front: połać z oknem dachowym wznosi się do górnej linii y≈45, czyli do wysokości wierzchołka szczytu głównego.
- Tył: połać z kominem i oknem dachowym, również do y≈45.
- Prawa elewacja (fd74812d): skrzydło kończy się białą ścianą szczytową z oknami poddasza. Jej wierzchołek (x≈360, y≈48) leży na wysokości poziomej kalenicy bryły głównej, którą widać za nią na całą głębokość (x 40–740).
- Okapy skrzydła są niżej (y≈262 wobec y≈235), ale kalenica jest równa głównej. Połacie skrzydła (przednia i tylna) schodzą się więc z prawą połacią dachu głównego w koszach.
- Same linie koszy na elewacjach chowa krawędź szczytu głównego. Wnioskuję je z równej wysokości kalenic. Na wizualizacji PERSPECTIVE-unk-na-87606758.jpg połać nad garażem wchodzi wysoko pod prawą krawędź szczytu frontowego. Na rzucie poddasza (FLOOR_PLAN-na-ATTIC) zakreskowane fragmenty połaci leżą przy styku brył z przodu i z tyłu.

To spełnia definicję KRZYŻUJĄCE: dwa dachy przenikające się wzdłuż koszy, z poprzecznym szczytem.

Dlaczego nie inne klasy:
- PROSTY: dom nie ma jednego dachu nad jedną bryłą.
- HIP: wszystkie zakończenia to szczyty, nigdzie nie ma połaci bocznej czterospadowej. Przód i tył bryły głównej to szczyty, prawy koniec skrzydła to szczyt w fd74812d. Na froncie prawa krawędź połaci skrzydła jest pionowa (x≈860), a na elewacji tylnej jego krawędź (x≈140) też jest pionowa. Krawędzie na lewej elewacji są pionowe. Ukośna krawędź połaci garażu na wizualizacji to krawędź szczytu (wiatrownica) widziana w skrócie perspektywicznym.
- NIŻSZY_PRZY_ŚCIANIE: żaden niższy dach nie kończy się na wyższej ścianie. Skrzydło sięga kalenicą do kalenicy głównej i łączy się koszami. Nad wejściem z przodu i nad tarasem z tyłu są tylko płaskie płyty balkonów w loggiach pod szczytami (front x≈525–600; tył x≈575–710), nie połacie. Taras nie ma zadaszenia (elewacja tylna, eb4cb92d, fd74812d).

Na wszystkich połaciach są tylko okna dachowe, bez lukarn.
- **W próbie NEW-H:** nie (poza limitem czterech domów, §5)

| dach | nad | rodzaj | kalenica |
|---|---|---|---|
| R1 | Bryła główna mieszkalna (lewa część od frontu, na całą głębokość domu). Na parterze: pokój 10,5, wnęka wejściowa i wiatrołap, hall, łazienka 2,8, kuchnia, spiżarnia, pokój dzienny + jadalnia. Na poddaszu: pokoje 15,6, 12,3 i 15,7, garderoba, hall 4,1. Pod jej okapami leżą też frontowa loggia nad wejściem i tylny balkon nad jadalnią. Szczyty od frontu (biały) i od tyłu (kamienny). | GABLE | PERPENDICULAR_TO_FRONT |
| R2 | Skrzydło garażowe (prawa część od frontu). Na parterze: garaż 20,9 i pom. gosp. 6,7. Na poddaszu: pralnia 2,6, łazienka 7,0, pokój 9,5 i część hallu 3,9. Szczyt na elewacji prawej, połacie opadają do frontu i do tyłu. Okapy leżą niżej niż okapy R1. | GABLE | PARALLEL_TO_FRONT |

| A | B | połączenie | dowód |
|---|---|---|---|
| R1 | R2 | VALLEY | Dachy krzyżują się w układzie T/L: kalenica R2 dochodzi do kalenicy R1 na tej samej wysokości, bez uskoku kalenicy, a dwie połacie R2 przecinają wschodnią połać R1 wzdłuż dwóch koszy. Elewacja przód (495d5ccd): górna krawędź połaci R2 leży na wysokości wierzchołka szczytu R1, prawy koniec R2 kończy się pionową krawędzią (szczyt), a okap R2 jest niżej niż koniec okapu R1. Elewacja tył (24fb6753): to samo w odbiciu, komin stoi na połaci R2 tuż przy wiatrownicy R1. Elewacja prawa (fd74812d): wierzchołek szczytu R2 jest na linii kalenicy R1, a wschodnia połać R1 jest widoczna po obu stronach szczytu R2, z wyższym okapem. Elewacja lewa (eb4cb92d): R2 nie przechodzi na drugą stronę, jest tam jedna ciągła połać R1. Rzut poddasza: szare pasy okapów biegną wzdłuż R1 po całej lewej stronie, po prawej stronie R1 tylko przy froncie i przy tyle, a wzdłuż R2 przy ściankach kolankowych pralni/łazienki i pokoju 9,5. Same kosze nie są narysowane na żadnym obrazie: w elewacjach widać je krawędziowo, a w perspektywie zasłania je szczyt frontowy. Ich istnienie wynika z tej geometrii. |

| id | kat. | KEY | cecha |
|---|---|---|---|
| F1 | F | KEY | Dwie kondygnacje nadziemne: parter i poddasze użytkowe. Poddasze obejmuje cały dom, łącznie z częścią nad garażem i pom. gosp. (pralnia, łazienka 7,0, pokój 9,5). Brak rzutu piwnicy i brak przekroju, więc istnienia piwnicy źródło nie pokazuje. |
| F2 | F | KEY | Bryła główna mieszkalna to lewa część od frontu: wąska i głęboka, sięga przez całą głębokość domu. Przykrywa ją dach dwuspadowy R1 z kalenicą prostopadłą do frontu. Szczyt od frontu jest w białym tynku, szczyt od tyłu w okładzinie kamiennej. Na elewacji lewej widać jedną ciągłą połać od frontu do tyłu, bez żadnego szczytu poprzecznego. |
| F3 | F | KEY | Skrzydło garażowe to prawa część: na parterze garaż 20,9 i pom. gosp. 6,7, na poddaszu pokoje. Przykrywa je dach dwuspadowy R2 z kalenicą równoległą do frontu i szczytem na elewacji prawej. Kalenica R2 jest na tej samej wysokości co kalenica R1 (front, tył, prawa). Okap R2 leży wyraźnie niżej niż okap R1, bo skrzydło jest szersze przy podobnym kącie dachu. |
| F4 | F |  | Skrzydło garażowe jest cofnięte względem frontu bryły głównej (do przodu wysuwa się szczyt R1 z pokojem 10,5 i pilastrem). Z tyłu jest krótsze niż bryła główna: wysuwa się za nie część salonu z kamiennym szczytem i kamienną ścianą boczną widoczną na elewacji prawej. |
| F5 | F |  | Szczyt frontowy R1 składa się z dwóch części. Lewa jest pełna: parter obity deskami z dużym oknem, wyżej biały szczyt z dużym oknem trapezowym. Prawa jest cofnięta: na parterze wnęka wejściowa, nad nią loggia na poddaszu z balustradą, pod głębokim okapem szczytu z drewnianą podbitką. Wnękę zamyka z prawej wąski biały pilaster z numerem „44” i lampą. Ten szczyt jest główną cechą rozpoznawczą. |
| F6 | F |  | Szczyt tylny R1 też ma dwie części. Wschodnia, nad salonem, jest wysunięta, w kamieniu, z oknem trapezowym w szczycie, drewnianym panelem i drzwiami tarasowymi. Zachodnia, nad jadalnią, jest cofnięta: na parterze przeszklenie, na poddaszu balkon z balustradą pod okapem R1, na narożu kamienny filar podpierający płytę balkonu. |
| F7 | F |  | Ściana kuchni po lewej stronie (od zachodu) wystaje nieznacznie, mniej więcej o grubość muru, poza lico pokoju 10,5. Na froncie widać to jako wąski kamienny pas przy lewym narożu, z donicą przed nim. Ta ścianka mieści się pod lewym okapem R1. |
| F8 | F |  | Szczyty mają wysunięte okapy z wiatrownicami z jasnych desek drewnianych (front, tył, szczyt prawy R2). Pod okapem szczytu frontowego jest drewniana podbitka (perspektywa). |
| F9 | F |  | Z tyłu i częściowo od lewej jest taras z drewnianym podestem i meblami, bez zadaszenia i bez pergoli na żadnej elewacji. Na rzucie parteru zaznaczono go cienką linią, razem z donicą i przesłoną. |
| S1 | S | KEY | FRONT to elewacja podpisana „Elewacja przód” (495d5ccd), a na rzutach strona dolna. Są na niej drzwi wejściowe we wnęce i brama garażowa. Patrząc na front: szczyt bryły głównej R1 jest po lewej, skrzydło garażowe R2 po prawej. |
| S2 | S |  | Elewacja LEWA (zachód) to „Elewacja boczna” eb4cb92d. Stronę ustalono z treści, bo podpis mówi tylko „boczna”: po lewej obrazu jest taras i tył, po prawej front (deski pokoju 10,5). Widać pełną zachodnią połać R1 od frontu do tyłu. |
| S3 | S |  | Elewacja PRAWA (wschód) to „Elewacja boczna” fd74812d. Stronę ustalono z treści: po lewej obrazu jest wnęka wejściowa i pilaster (front), po prawej taras (tył). Na pierwszym planie biały szczyt R2, a za nim wschodnia połać R1, widoczna po obu stronach szczytu. |
| S4 | S |  | TYŁ to „Elewacja tył” (24fb6753). Po prawej obrazu (zachód) stoi kamienny szczyt R1, po lewej (wschód) widać północną połać R2 z kominem oraz ścianę pom. gosp. z drzwiami. |
| S5 | S |  | Perspektywa 87606758 nie ma podpisu. To ujęcie 3/4 z przodu od lewej: widać front i fragment strony lewej, garaż jest po prawej. Strony prawej i tyłu ta perspektywa nie pokazuje. |
| O1 | O | KEY | Drzwi wejściowe na FRONCIE, w cofniętej wnęce w prawej części szczytu R1, między pokojem 10,5 a garażem. Są ciemne, z pionowym przeszkleniem, przed nimi stopnie. Za nimi wiatrołap 6,0 m². Nad wnęką jest loggia poddasza. |
| O2 | O | KEY | Brama garażowa na FRONCIE, w ścianie skrzydła R2 (prawa część frontu): segmentowa, szara, jednostanowiskowa, nad nią lampa. |
| O3 | O |  | FRONT, poddasze: duże okno trapezowe w białym szczycie R1, ze skośnym bokiem równoległym do połaci i szprosami, w pokoju 15,6. |
| O4 | O |  | FRONT, parter: duże poziome okno dwudzielne w ścianie obitej deskami, w pokoju 10,5. |
| O5 | O |  | FRONT, poddasze: loggia z balustradą linkową i drewnianym pochwytem nad wnęką wejściową (według rzutu wyjście z garderoby), w głębi przeszklenie. |
| O6 | O |  | FRONT, dach: jedno okno połaciowe w południowej połaci R2, nad pokojem 9,5. Ściana kolankowa skrzydła od frontu nie ma okien. |
| O7 | O |  | TYŁ, wysunięta część salonu w kamieniu: na parterze duże przeszklone drzwi tarasowe, nad nimi drewniany panel, w szczycie trójkątne/trapezowe okno pokoju 15,7. |
| O8 | O |  | TYŁ, cofnięta część zachodnia: na parterze duże przeszklenie jadalni, na poddaszu balkon z balustradą i wąskie, wysokie okno lub drzwi balkonowe pokoju 12,3. |
| O9 | O |  | TYŁ, skrzydło R2: drzwi zewnętrzne do pom. gosp. w białej ścianie pod okapem i jedno okno połaciowe w północnej połaci R2. |
| O10 | O |  | LEWA: duża przeszklona ściana jadalni (drzwi tarasowe) przy tarasie i kwadratowe okno kuchni w ścianie kamiennej. Ściana pokoju 10,5 w deskach nie ma okien. Przy tylnym narożu, nad płytą balkonu, jest mały otwór (niepewny; może to boczne przeszklenie balustrady). W zachodniej połaci R1 są dwa okna połaciowe obok siebie. |
| O11 | O |  | PRAWA: w szczycie R2 dwa wąskie portfenetry z balustradkami (łazienka 7,0 i pokój 9,5), rozdzielone drewnianym panelem. Parter ściany garażu jest bez otworów. We wschodniej połaci R1, za skrzydłem, jest jedno okno połaciowe nad pokojem 15,7. Kamienna ściana wysuniętej części salonu nie ma otworów, tylko lampę. |
| C1 | C |  | Jeden komin murowany w okładzinie kamiennej, z białą czapą i nasadami. Stoi w północnej połaci R2, tuż przy styku z wschodnią połacią R1 (przy koszu), a jego wierzch sięga mniej więcej kalenicy. Widać go na tyle i na prawym boku. Na froncie i lewym boku wystaje ponad kalenicę tylko czapa. Na rzucie parteru odpowiadają mu przewody przy styku salonu (kominek) i pom. gosp. (kocioł). |
| C2 | C |  | Kilka wywiewek wentylacyjnych (rurek): dwie na zachodniej połaci R1 (front, perspektywa, lewa) i jedna na południowej połaci R2 (front, prawa). Nie są to kominy murowane. |
| M1 | M |  | Pokrycie obu dachów: ciemnografitowa (antracytowa) dachówka płaska o drobnym rastrze. |
| M2 | M |  | Biały tynk: szczyt frontowy R1 nad parterem, cały szczyt R2, ściany garażu, pilaster z numerem, pas pod okapem po lewej. |
| M3 | M |  | Okładzina z kamienia łamanego, na elewacjach jasnoszarego: szczyt tylny i wysunięta część salonu (z tyłu i od prawej), ściana kuchni od lewej, wąski pas przy lewym narożu frontu, filar balkonu, komin. W perspektywie ten kamień wygląda jak ciemny łupek. |
| M4 | M |  | Poziome jasne deski drewniane (miodowe): parter pokoju 10,5 od frontu i od lewej, panel między portfenetrami w szczycie R2, panel nad drzwiami tarasowymi z tyłu, ściana boczna wnęki wejściowej. |
| M5 | M |  | Wiatrownice i podbitka okapów szczytowych z drewnianych desek. Krawędzie płyt loggii i balkonu są ciemnoszare. |
| M6 | M |  | Pozostałe materiały: stolarka grafitowa, brama garażowa jasnoszara, balustrady stalowe linkowe z drewnianym pochwytem, rynny i rury spustowe szare, cokół szary. |

- **Wnętrze:** Parter (rzut „parter”): wiatrołap 6,0; hall 6,6; pokój 10,5 (lewy narożnik frontu); spiżarnia 2,1; kuchnia 9,3 (lewa strona); pokój dzienny + jadalnia 28,2 (tył, z kominkiem i wyjściem na taras, jadalnia przeszklona od lewej i od tyłu); łazienka 2,8; pom. gosp. 6,7 (kocioł, drzwi na tył); garaż 20,9 (prawa strona, wjazd od frontu, przejście do wiatrołapu). Schody na poddasze w strefie dziennej: dwa biegi z zabiegiem/spocznikiem. Poddasze (rzut „poddasze”): hall 4,1 i hall 3,9; pokój 12,3 (lewy tył, wyjście na balkon tylny); pokój 15,7 (tył, nad wysuniętym salonem); pokój 15,6 (lewy front, z oknem trapezowym w szczycie); garderoba 5,9 (wyjście na loggię frontową); pralnia 2,6; łazienka 7,0 (z wanną); pokój 9,5 (nad garażem, front-prawo). Sposób rysowania: ściany jako lite ciemnoszare wypełnienia (zewnętrzne grubsze, działowe cieńsze), pomieszczenia barwione (beż/piasek, garaż szary, łazienki w siatce płytek), meble, samochód i symbol kominka. Na poddaszu szare zakreskowane pasy oznaczają połacie i okapy poza ściankami kolankowymi. Taras i elementy ogrodu narysowano cienką linią. Wydrukowane są wyłącznie powierzchnie pomieszczeń w m²: brak linii wymiarowych, osi, rzędnych, wysokości pomieszczeń i podziałki.
- **Braki źródła:** (1) Obie elewacje boczne mają ten sam podpis „Elewacja boczna” (SIDE_UNSPECIFIED). Strony ustalono z treści: eb4cb92d to LEWA (zachód), fd74812d to PRAWA (wschód). (2) Perspektywa 87606758 nie ma podpisu (widok UNKNOWN). To ujęcie z przodu od lewej; nie pokazuje tyłu ani strony prawej. Rozbiega się z elewacjami: kamień ma kolor ciemnego łupku zamiast jasnego kamienia łamanego, a w kamiennym bloku przy lewym narożu frontu widać wąskie okienko, którego nie ma na elewacji przód. Rozstrzygają elewacje. (3) Brak przekroju, planu sytuacyjnego, rzutu dachu i rzutu piwnicy. (4) Brak jakichkolwiek wymiarów, podziałki i rzędnych: nie podano wysokości kalenicy ani okapów, poziomów kondygnacji, kąta dachu ani wymiarów gabarytowych. Kąt ok. 40° i równa wysokość kalenic to odczyt proporcji z obrazów, nie liczby źródłowe. (5) Kosze na styku R1 i R2 nie są narysowane na żadnym obrazie, tylko wynikają z geometrii elewacji i rzutu poddasza. (6) Pliki są w formacie JPG, nie PNG; mają rozmiar 1000×436 (elewacje) i około 672×803 (rzuty), czytelny. Etykiety pomieszczeń i powierzchnie dały się odczytać.

## osika — ARCHON „Dom pod osiką" (https://www.archon.pl/projekty-domow/projekt-dom-pod-osika-m471766e658605)

- **Nagłówek:** Parterowy z nieużytkowym strychem; obrys ścian 18,72 × 10,12 m (11,66 m z portykiem frontowym, wysunięcie 1,54 m); kalenica +6,95 m; dach 35°; ±0,00 = 0,47 m nad terenem
- **Warstwy (czytelnik 1):** HIP, KRZYŻUJĄCE — HIP: dach główny R1 to dach czterospadowy z kalenicą równoległą do frontu (trapez na frontowej i ogrodowej elewacji, trójkąt na bocznych, linie naroży na rzucie strychu). KRZYŻUJĄCE: na froncie (R2) i z tyłu (R3) dwuspadowe dachy portyków z frontonami przecinają R1. Ich kalenice są prostopadłe do frontu i niższe od głównej, a z połaciami łączą się koszami. To przypadek „cross gable nad częścią fasady”, tu niesiony na kolumnach przed licem ściany. To nie jest PROSTY, bo poza R1 są jeszcze dwa przenikające dachy. To nie jest NIŻSZY_PRZY_ŚCIANIE: żaden niższy dach nie kończy się przy wyższej ścianie, oba portyki łączą się koszami, a nie ścianą. Lukarny „wole oko” R4 i R5 są wtopione falą w połać tylną bez koszy i ścian. Żaden typ złącza do nich nie pasuje, więc nie dodałem złączy R1–R4 ani R1–R5, a do klas warstw wnoszą tylko tyle, że należą do połaci R1.
- **Warstwy (czytelnik 2, niezależnie):** HIP, KRZYŻUJĄCE — ZGODNE; Obejrzałem wszystkie 13 obrazów z index.json: 4 elewacje, przekrój, 6 rzutów i 3 perspektywy. Dom jest parterowy, ma nieużytkowy strych i jedną prostokątną bryłę główną. Od frontu i od ogrodu dostawiono do niej dwa portyki kolumnowe zwieńczone trójkątnymi frontonami.

1) HIP: dach główny jest czterospadowy i wszystkie strony to potwierdzają.
- Na elewacji frontowej (ELEVATION-FRONT-98058811, podpis „elewacja frontowa", wejście główne) i ogrodowej (ELEVATION-REAR-4ee8ab29) kalenica jest krótsza od okapu, a skrajne połacie schodzą narożami biodrowymi do okapu. Szczytu ściany nie ma.
- Na obu elewacjach bocznych dach główny widać jako trójkątną połać biodrową bez ściany szczytowej. W lewej (b1280a47, dwa okna, zgodna z pokojami 12/13 na rzucie) i w prawej (be49f8f7, potrójne okno, zgodna z salonem i jadalnią) okap biegnie poziomo na całej szerokości.
- Na rzutach poddasza (350eb62c, 6d5a190b, eb7d94ef) widać obrys połaci 1545×685 z przekątnymi liniami naroży biodrowych.
- Perspektywy 1b713ad9 (front), 74561be7 (ogród) i 0a963fc2 pokazują to samo.
- Przekrój (SECTION-267f0ae6) podaje nachylenie 35° i kalenicę na +6,95.

2) KRZYŻUJĄCE: dachy obu portyków to poprzeczne daszki dwuspadowe, które wchodzą w połać główną przez kosze.
- Front: szeroki fronton z lukarną półokrągłą (lunetą) na czterech kolumnach. Jego kalenica jest prostopadła do kalenicy głównej, a połacie wnikają w przednią połać dachu głównego (elewacja frontowa, perspektywa 1b713ad9).
- Ogród: węższy fronton z okulusem na dwóch kolumnach, w ten sam sposób wnika w tylną połać (elewacja ogrodowa, perspektywa 74561be7).
- Na elewacjach bocznych oba daszki widać z boku jako prostokątne połacie wysunięte za lico ściany aż do kolumn. Przy połaci głównej mają klinowe dojście (kosz). Daszek frontowy jest wyższy (krawędź górna ok. y=242) od ogrodowego (ok. y=268).
- Na rzutach poddasza czerwony obrys dachu ma dwa występy, a przerywane kalenice portyków dochodzą do połaci głównej.
- W przekroju poziome kalenice obu portyków kończą się na połaci 35°, a połać główna biegnie dalej pod nimi (linia przerywana).

3) NIŻSZY_PRZY_ŚCIANIE nie występuje. Dom ma jedną kondygnację nadziemną i nad okapem nie ma żadnej wyższej ściany. Oba niższe daszki portyków kończą się na połaci dachu głównego przez kosze, a nie przy ścianie.

4) PROSTY nie występuje. Bryła główna ma wprawdzie jeden dach czterospadowy, ale na całym domu dwa poprzeczne dachy portyków przenikają się z nim, więc nie jest to jeden dach nad jedną bryłą.

Uwaga: na tylnej połaci są dwa „wole oczka" (lukarny łukowe, elewacja ogrodowa i perspektywa 74561be7, łuki na rzutach poddasza). Są wtopione płynnie w połać, bez koszy i bez własnej kalenicy, więc nie przypisałem ich do żadnej z czterech klas. Kominy (trzy lub cztery) nie wpływają na klasyfikację.
- **W próbie NEW-H:** nie (poza limitem czterech domów, §5)

| dach | nad | rodzaj | kalenica |
|---|---|---|---|
| R1 | cała bryła parteru (prostokąt 18,72 × 10,12 m) — dach główny, kalenica +6,95, 35° | HIP | PARALLEL_TO_FRONT |
| R2 | portyk frontowy na 4 kolumnach przed wejściem, środkowa część frontu (szer. ok. 6,5 m, wysunięcie ok. 1,5–2 m poza lico z okapem); fronton z lunetą | GABLE | PERPENDICULAR_TO_FRONT |
| R3 | portyk ogrodowy na 2 kolumnach, środkowa część elewacji tylnej (szer. ok. 5,5 m); fronton z okulusem | GABLE | PERPENDICULAR_TO_FRONT |
| R4 | lukarna „wole oko” 140/60 na połaci tylnej R1, po lewej stronie portyku ogrodowego (patrząc od frontu) | OTHER | NONE |
| R5 | lukarna „wole oko” 140/60 na połaci tylnej R1, po prawej stronie portyku ogrodowego (patrząc od frontu) | OTHER | NONE |

| A | B | połączenie | dowód |
|---|---|---|---|
| R1 | R2 | VALLEY | ELEVATION-FRONT-98058811 i PERSPECTIVE-1b713ad9: dwuspadowy dach frontonu wcina się w połać frontową R1 dwoma koszami, a jego kalenica kończy się na połaci wyraźnie poniżej kalenicy głównej. ELEVATION-SIDE-b1280a47 (prawa strona obrazu) i be49f8f7 (lewa strona): boczna połać portyku wystaje poza trójkąt połaci bocznej R1, ma mały trójkąt kosza przy wejściu w R1, a okap jest w jednej linii z okapem głównym. SECTION-267f0ae6: kalenica portyku (prawa strona) leży poziomo na ok. +5,4 i wchodzi w połać 35°. FLOOR_PLAN-ATTIC-6d5a190b: obrys dachu ma u dołu prostokątny występ. Ściana pod portykiem nie ma uskoku, występ niosą kolumny. |
| R1 | R3 | VALLEY | ELEVATION-REAR-4ee8ab29 i PERSPECTIVE-74561be7: fronton ogrodowy z dachem dwuspadowym wcina się koszami w połać tylną, kalenica niższa od głównej. ELEVATION-SIDE-b1280a47 (lewa strona obrazu, x≈420–440) i be49f8f7 (prawa strona, x≈890–905): widoczny trójkąt kosza, okap w linii z głównym. FLOOR_PLAN-ATTIC-6d5a190b: u góry występ obrysu dachu z ukośnymi liniami koszy zbiegającymi się wewnątrz połaci. SECTION-267f0ae6: kalenica portyku (lewa strona) poziomo na ok. +5,0. |
| R2 | R3 | APART | Portyki stoją po przeciwnych stronach bryły (front i ogród), rozdziela je kalenica główna R1. Na SECTION-267f0ae6 oba dachy dochodzą do R1 osobno, z dwóch stron kalenicy, i mają różne wysokości kalenic. |

| id | kat. | KEY | cecha |
|---|---|---|---|
| F1 | F | KEY | Jedna bryła mieszkalna: parterowy prostokąt ok. 18,72 × 10,12 m. Dłuższy bok to front. Ściany bez uskoków (rzut parteru). Bez piwnicy: przekrój pokazuje tylko ławy i ściany fundamentowe. Nad parterem nieużytkowy strych (rzut poddasza: „Strych 52,13 (162,37) m²”). |
| F2 | F | KEY | Dach główny czterospadowy (kopertowy z kalenicą) nad całą bryłą. Kalenica równoległa do frontu, +6,95, nachylenie 35° (przekrój). Na elewacjach frontowej i ogrodowej ma kształt trapezu, na bocznych trójkąta (połać boczna). Okap ok. +2,80, z wyraźnym wysięgiem i brązową drewnianą podbitką. |
| F3 | F | KEY | Portyk frontowy: otwarty, na 4 kolumnach (po dwie z każdej strony drzwi). Wysunięty ok. 1,54 m przed lico ściany (wymiar 154 = 1166 − 1012). Nakryty dachem dwuspadowym z trójkątnym frontonem (tympanonem) od frontu. Kalenica prostopadła do frontu i niższa od głównej: ok. +5,2–5,4 m, wartość odrysowana z przekroju i elewacji, niewymiarowana. Okapy boczne w linii z okapem głównym. Dach portyku wcina się w połać frontową koszami. Ściana pod portykiem nie ma uskoku: wysunięcie tworzą tylko kolumny i dach. |
| F4 | F | KEY | Portyk ogrodowy (z tyłu), na 2 kolumnach, węższy i niższy niż frontowy: fronton ok. 5,5 m szerokości wobec ok. 6,5 m z przodu (odrys elewacji i rzutu strychu). Dach dwuspadowy z kalenicą prostopadłą do frontu, ok. +5,0 m (odrys przekroju). Wcina się koszami w połać tylną. |
| F5 | F |  | Na połaci tylnej dwie lukarny typu „wole oko” (140/60 na rzucie strychu), symetrycznie po obu stronach portyku ogrodowego. Są wtopione falą w połać, bez koszy i ścianek. |
| F6 | F |  | Symetryczna kompozycja dworkowa, klasycyzująca. Na wszystkich czterech narożach boniowane pilastry narożne. Fronton frontowy i ogrodowy osadzone na belkowaniu nad kolumnami. |
| F7 | F |  | Od frontu szerokie schody przez całą szerokość portyku, z łukowymi policzkami. Z tyłu taras z półokrągłym zakończeniem przed portykiem ogrodowym, ciągnący się w prawo wzdłuż elewacji ogrodowej (rzut parteru, perspektywa ogrodowa). Poziom posadzki 0,47 m nad terenem. |
| S1 | S | KEY | FRONT = elewacja podpisana „frontowa” (ELEVATION-FRONT-98058811): wejście główne pod 4-kolumnowym portykiem z lunetą w tympanonie. Na wszystkich rzutach front jest na dole (wiatrołap 1, drzwi 180/220). |
| S2 | S |  | TYŁ = elewacja „ogrodowa” (ELEVATION-REAR-4ee8ab29), na rzutach u góry: portyk na 2 kolumnach z okulusem i dwa „wole oczka”. |
| S3 | S |  | LEWA = ELEVATION-SIDE-b1280a47. Podpis mówi tylko „boczna”, stronę ustaliłem z rysunków. Po prawej stronie obrazu stoi wyższy dach portyku, czyli frontowego, więc front jest po prawej. Dwa okna odpowiadają lewej ścianie rzutu (180/150 w pokojach 13 i 12). Komin kominka leży na lewo od środka, czyli ku tyłowi. |
| S4 | S |  | PRAWA = ELEVATION-SIDE-be49f8f7, ustalona tak samo. Wyższy, frontowy portyk jest po lewej stronie obrazu. Zestaw trzech okien odpowiada prawej ścianie rzutu (jadalnia 8: 90/150 + 180/150 + 90/150). |
| O1 | O | KEY | FRONT: drzwi wejściowe 180/220 w osi, pod portykiem: drewniane, przeszklone, z doświetleniami bocznymi. Po obu stronach drzwi, wewnątrz portyku, po jednym wąskim oknie 60/110. |
| O2 | O |  | FRONT, pozostałe otwory (symetrycznie): skrajnie 2 okna 150/120, bliżej portyku 2 okna 90/120. W tympanonie półokrągła luneta 160/80 (rzut strychu). |
| O3 | O |  | TYŁ: dwuskrzydłowe przeszklone drzwi tarasowe 180/230 w osi, pod portykiem ogrodowym, z holu i salonu. Do tego 4 okna 150/150, symetrycznie po dwa z każdej strony. W tympanonie okrągły okulus. Na połaci 2 lukarny „wole oko” 140/60. |
| O4 | O |  | LEWA: 2 okna 180/150 (pokoje 13 i 12). |
| O5 | O |  | PRAWA: jeden zestaw trzech okien we wspólnej opasce, 90/150 + 180/150 + 90/150 (jadalnia). |
| O6 | O | KEY | Brak garażu i bramy garażowej: dom ma jedną bryłę mieszkalną. |
| C1 | C |  | C1: komin na połaci tylnej, tuż za kalenicą, nieco na prawo od osi. Na froncie widać go zza kalenicy (x≈780 na elewacji frontowej). Leży nad kominkiem w salonie 9. Najwyższy z trzech. |
| C2 | C |  | C2: komin na połaci frontowej, po lewej stronie (x≈455 na elewacji frontowej, nad strefą łazienki i pomieszczenia 2). |
| C3 | C |  | C3: komin na połaci frontowej, po prawej, blisko naroża (x≈925, nad kuchnią). Z tyłu widać go nad połacią narożną. Na widokach bocznych C2 i C3 nakładają się w jeden szeroki „podwójny” komin z ceramicznymi nasadami. Rzut strychu pokazuje 3 przejścia kominowe. Wszystkie kominy mają okładzinę kamienną i czapy. |
| M1 | M |  | Dach: dachówka ceramiczna czerwono-brązowa o wzorze łuskowym, z wyglądu karpiówka; rodzaj nie jest podpisany. Gąsiory na kalenicy i narożach. Lukarny „wole oko” kryte tą samą dachówką. |
| M2 | M |  | Ściany w białym gładkim tynku. Cokół w jasnobeżowej okładzinie kamiennej, także na schodach i tarasach. Boniowane narożniki i szerokie opaski okienne w kolorze kremowym. |
| M3 | M |  | Stolarka drewniana brązowa, ze szprosami. Drewniana brązowa podbitka i deska okapowa. Rury spustowe białe, na narożach frontu i tyłu. |
| M4 | M |  | Gładkie białe kolumny toskańskie. Tympanony białe, z kremowym gzymsem i brązową deską czołową na krawędzi dachu portyku. |

- **Wnętrze:** Parter (numery i powierzchnie z planszy): 1 Wiatrołap 9,63 m²; 2 pomieszczenie bez nazwy 3,78 m² (na rysunku WC i umywalka); 3 Hol 11,9 m², z którego prowadzą schody na strych; 4 schowek pod schodami 0,4 (2,77) m²; 5 pomieszczenie bez nazwy 2,67 m² (WC); 6 pomieszczenie bez nazwy 2,25 m²; 7 Kuchnia 9,39 m²; 8 Jadalnia 16,54 m²; 9 Salon 39,4 m² z kominkiem w środku domu; 10 Przedpokój 7,75 m²; 11 Łazienka 6,76 m²; 12 Pokój 10,14 m²; 13 Pokój 16,7 m²; 14 Pokój 14,27 m². Strefa sypialna jest po lewej, część dzienna (salon, jadalnia, kuchnia) po prawej, a wejście i hol w osi. Strych: jedno nieużytkowe pomieszczenie „Strych 52,13 (162,37) m²”, wysokości strefowane 140/220/220/140. Styl rysunku: ściany w pełnym czarnym zaczernieniu, z umeblowaniem i oknami w kółkach (szerokość/wysokość). Są dwa warianty plansz: z numerami i wymiarami oraz z nazwami i powierzchniami. Obrys dachu na rzucie strychu jest zaznaczony na czerwono, linie naroży i koszy przerywane, a obrys okapu na parterze przerywany. Wymiary wydrukowane: 1872, 1012, 1166, 154; pomieszczenia 348, 343, 1041, 497, 425, 671, 400, 288, 229, 239, 251, 260, 242, 172, 119, 114, 378; strych 1545 × 685. Okna: 150/120, 90/120, 60/110, drzwi 180/220 (front); 150/150, drzwi 180/230 (tył); 180/150 ×2 (lewa); 90/150 + 180/150 + 90/150 (prawa); 160/80 i 150/80 (szczyty portyków); 140/60 ×2 (wole oczka). Przekrój: ±0,00, teren −0,47, +2,80, +3,47, +6,95; parter 300; strych 206 i 312; 35°.
- **Braki źródła:** 1) Obie elewacje boczne mają podpis „elewacja boczna” bez strony. Lewą i prawą ustaliłem z wysokości portyków, układu okien zgodnego z rzutem i położenia kominów. 2) Brak rzutu dachu. Obrys dachu, naroża i kosze są tylko na rzucie strychu. 3) Wysokości kalenic portyków, wysięg okapów i wysunięcie dachów portyków nie są zwymiarowane. Ok. +5,4 i +5,0 to odrys z przekroju. Głębokość portyku ogrodowego nie jest zwymiarowana, frontowy ma 154. 4) Przekrój nie ma linii cięcia na rzucie. To, że front jest po prawej, wynika ze schodów i wyższego portyku. 5) Niespójność okna w szczycie portyku ogrodowego: rzut strychu podaje 150/80, a elewacja i perspektywa pokazują okrągły okulus o średnicy ok. 0,7 m. 6) Perspektywy (1b713ad9 front, 74561be7 ogród) są prawie frontalne. Nie ma widoku skośnego ani widoku boków w 3D, a dachy portyków od boku widać tylko na elewacjach. Plik 0a963fc2 to miniatura 200×150 perspektywy frontowej. 7) Perspektywy są zainscenizowane (skrzynki z kwiatami, zieleń, meble). Materiały odczytuję z obrazu, nie z opisu. 8) Źródło nie pokazuje: garażu (nie ma go), piwnicy (nie ma), kształtu i konstrukcji lukarn „wole oko” poza wymiarem 140/60, rodzaju dachówki, wysokości kominów oraz otoczenia i działki.
