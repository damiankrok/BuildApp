# SOURCE → MODEL v3.54.9 — wspólna metryka, wnętrza kondygnacji i dokładne przeszklenia

Zlecenie: `BuildPlan_Prompt_Fable_v3.54.9_Metryka_Wnetrza_Przeszklenia.md` z dołączonym Master Planem v3.54.9
(skopiowany w całości do `docs/MASTER_PLAN.md`). Gałąź `claude/new-session-3kzcgh`. Rewizje:

| rewizja | co |
|---|---|
| `e2b3b58` | baza: raport v3.54.8 + sceny APK (kod v3.54.8 `86fd69f`, finalny host v3.54.8 z `05faa4e`) |
| `39fec90` | v3.54.9 (kod): wnętrze z LOCAL przez sprawdzoną transformację + konsument, zakres kontroli `INTERIOR`, wymiar wg własnych końców, parapet zasłonięty balustradą, stany recenzji, rebind zapisanych odpowiedzi, schemat modelu 1.8.0, wersje; **finalny host E2E** |
| (ten commit) | raport, indeks, status, ADR, hand-off |

Wersje: dokument domu **0.5.0** (czyta 0.1.0–0.4.0), kontrakt odczytu `reading-0.4.0` (bez zmian), resolver **0.6.0**,
builder **0.5.0**, ścieżka domu **0.5.0**, schemat modelu **1.8.0** (rola `GABLE_FRAME`, migracja jawna).
Zakresy wyników są rozdzielone wszędzie poniżej: **LOCAL** (27/27, 16/16 — wąska kontrola DEV, nie prawda),
**H-PRZED** = świeży odczyt v3.54.8 (LIVE1) na kodzie v3.54.8 (21/27, bez wnętrza), **H-PO** = te same odpowiedzi na
kodzie `39fec90` (odtworzenie, 0 USD), **ODDANY** = to, co serwuje finalny host. Host H v3.54.8 (17/27) był odrzucony
na 13,52 vs 12,60 i oddał LOCAL; DIAG-all 23/27 był podstawieniem diagnostycznym, nie odczytem.

## 1. Odpowiedzi na siedem pytań (Marcówki GE)

| pytanie | odpowiedź |
|---|---|
| 1. Jakie dane dostało API i które kondygnacje odczytało? | 20 obrazów w pakiecie (tabela A). PLAN dostał rzut parteru 1568 px i oba rzuty poddasza po 800 px; **odczytał tylko parter** (obrysy, wymiary, poziomy). Poddasze: wysłane, nieodczytane — kontrakt odczytu nie ma pola na ścianki/pomieszczenia (pierwsza strata: **brak pola i konsumenta**, nie brak źródła). Przekrój odczytany do poziomów, 4 elewacje do elewacji. Wizualizacje: jedna wysłana do FACADES jako kontekst, nieodczytana. |
| 2. Pas / portal: rzut, szerokość, wysokość — wydrukowane, wyprowadzone czy szacowane? | Szerokość pasa ramy **odczytana** (55 px przód, 57 px tył × 0,0169–0,0170 m/px → 0,927 / 0,966 m, `DERIVED`, ±0,05) — **za szeroko**: źródło 48–49 px = 0,82 m (pierwsza strata: odczyt). Wysunięcie (głębokość) ramy i portalu **z rzutu** (zwroty 0,961 / 1,003 m, `DERIVED`) — elewacja go nie rozstrzyga i nie rozstrzygała. Pas portalu przód: 3,24–12,05 m, podsufitka 2,273, góra 3,048 (`DERIVED` z wierszy elewacji); ciągłość 31/33 próbek. Nic nie jest `DEFAULT` bez nazwy. |
| 3. Tylne przeszklenia skośne: końce, kąt, cel w scenie? | Oba końce i kąt mierzone osobno (scorer v2, rozdz. 4). H-PO: koniec wysoki 5,848 (źródło 6,09, błąd 0,24 — **poza tolerancją**), niski 3,983 (4,13, 0,147 — w tolerancji 0,15), kąt 35,9° (źródło 39,95°, poza 2,5°). Kierunek (który koniec wyżej) poprawny. Cel recenzenta (3,995) został osiągnięty w scenie (3,983, `VERIFIED_IN_SCOPE`), ale **cel recenzenta nie jest źródłem**: to widoczna krawędź, a opis 234/303 podaje otwór konstrukcyjny. Diagnostyka ręczna z czterema końcami z prawdy przez normalny adapter: 25/27, wszystkie sześć końców ≤ 1 mm — **adapter i builder są poprawne**. |
| 4. Wnętrza H: ściany, pokoje, drzwi, otwory — co wzięto z LOCAL? | H-PO: **44 elementy z LOCAL** przez sprawdzoną transformację (skala 0,99627, osie 0,75 %, pokrycie 98,0 % vs następne 78,3 %, bez odbicia, poziomy 0/0 i 1/1 przy 0,00 m): parter 11 ścianek, 5 drzwi, 7 pomieszczeń, schody; poddasze 9 ścianek, 5 drzwi, 6 pomieszczeń, otwór stropu. 0 odrzuceń kernela, 0 błędów kompilacji. Identyfikatory pomieszczeń LOCAL zachowane. Wzgl. rzutów źródła: parter 7/10 dopasowanych (średni błąd kształtu 0,14, pole ±2,8 m²), poddasze 6/9 (0,21, ±1,9 m²), otwór schodów IoU 0,66. |
| 5. Gdzie API źle odczytało, gdzie analizator zgubił, czego brakuje w źródle? | **API**: pas ramy za szeroki (+6–9 px), głowice skośne na widocznej krawędzi (0,18–0,24 m niżej niż otwór z opisu), szerokość skośnych 2,58 vs 2,34 m. **Analizator (przed tym etapem)**: brak pola i konsumenta wnętrza; wymiar 12,60 porównany z obrysem po prostokącie (13,52 z frontowymi zwrotami); parapet odczytany na górze balustrady (stąd 4,182 zamiast 3,995 przy poprawnym celu); `MATCHES` zamykał rundę przy zmierzonych różnicach; zapisana odpowiedź Pallas odrzucona jako `STALE` przy tym samym odczycie. **Źródło**: brak — rzuty poddasza są, opisy otworów są; brakuje pola, które by je czytało. |
| 6. Recenzja: co wykryła, co usunęła, co zmniejszyła, dlaczego stanęła? | Runda 1 `DIFFERS`: tylne skośne przeszklenia brakujące (KEY) → 2 poprawki `APPLIED`, `WITHIN_TOLERANCE` wobec celu recenzenta, końcowy pomiar `VERIFIED_IN_SCOPE`; 2 usterki MINOR (ciemny panel na lewej ścianie — tylko kolor okładziny; dwa kominy) `UNRESOLVED`. Runda 2 `MATCHES` przy otwartych dwóch MINOR — zapisane w dzienniku (`openAtVerdict`), nie zamknięte. Stanęła, bo `MATCHES`. Głowice nadal 0,24 m niżej niż źródło: recenzja zmniejszyła usterkę „brak przeszkleń”, nie usunęła różnicy głowic. |
| 7. Co oddano, co zostaje, co mierzalne? | Rozdz. 9. Host oddał **LOCAL** (27/27, wnętrze LOCAL) — tym razem nie przez porażkę opisu (15/0), tylko przez mniej sprzeczności z elewacjami. Zostaje: pas ramy +0,11 m, głowice −0,24 m, otwarta strefa dzienna jako jedno pomieszczenie, dwie garderoby poddasza bez ścianek, Pallas: jedna ścianka odrzucona przez kernel. |

## 2. Inwentarz źródeł (§2)

**Tabela A — obraz → rola → wysłany → odczytany** (odczyt live v3.54.8 = odpowiedzi odtwarzane w H-PO). Kolumna
„wysłany” podaje krok i szerokość wysłaną (oryginał tam, gdzie znany); hash = pierwsze 10 znaków SHA-256 bajtów.

| obraz | rola | kondygnacja | oryginał | wysłany (krok@szer.) | odczytany do | stan | hash |
|---|---|---|---|---|---|---|---|
| elewacja boczna (p11) | ELEVATION | — | 1280×597 | FACADES@1280, INVENTORY@512, REVIEW-1/2@1280 | elewacje | READ | 93e150872f |
| elewacja boczna (p9) | ELEVATION | — | 1280×598 | j.w. | elewacje | READ | 0015dfde66 |
| elewacja frontowa (p12) | ELEVATION | — | 1280×597 | j.w. | elewacje | READ | 130edece30 |
| elewacja ogrodowa (p10) | ELEVATION | — | 1280×598 | j.w. | elewacje | READ | 84ebf5b306 |
| rzut parteru `rzut-19a11bc745` (p2) | FLOOR_PLAN | parter | 1568×1568 | FACADES@800, INVENTORY@512, PLAN@1568 | wymiary, poziomy, obrysy | READ | abfdb26255 |
| rzut poddasza `rzut-117027f690` (p1) | FLOOR_PLAN | poddasze | 853×853 | INVENTORY@512, PLAN@800 | — | KEPT_NOT_READ | 06af9e9122 |
| rzut poddasza z pow. `rzut-f028d28aba` (p4) | FLOOR_PLAN | poddasze | 853×853 | INVENTORY@512, PLAN@800 | — | KEPT_NOT_READ | a1b96ef3af |
| przekrój (p13) | SECTION | — | 1138×854 | FACADES@1138, INVENTORY@512 | poziomy | READ | 2201a9c118 |
| wizualizacja 1 (p14) | PERSPECTIVE | — | 800×600 | FACADES@800, INVENTORY@512 | — | KEPT_NOT_READ | d32a9a4157 |
| ilustracja (p17) | UNKNOWN | — | 1600×900 | FACADES@800, INVENTORY@512 | — | KEPT_NOT_READ | 685a5d6813 |
| 9 dalszych (kopie rzutów, wizualizacje, sytuacja) | różne | — | — | INVENTORY@400–512 albo wcale | — | SENT_NOT_READ / NOT_SENT | — |

**Dlaczego H nie miał wnętrza** (pierwsza strata per etap): pobrane — tak (oba rzuty poddasza w pakiecie); wysłane —
tak (PLAN@800); pytanie — za wąskie (PLAN pyta o obrys, wymiary, poziomy); **pole — brak** (kontrakt odczytu nie ma
ścianek ani pomieszczeń); konsument — brak (builder nie miał wejścia wnętrza); kompilacja i renderer — nie dotyczy
(niczego nie ukrywały: scena H-PRZED nie ma ani jednej ścianki `INTERIOR`). Na kontroli ≥ 2 kondygnacje (Frizeach,
Pallas, Oslo, Lubczyk, Wena) ta sama pierwsza strata; po zmianie każdy z nich ma nazwany wynik (rozdz. 6).
Brak wnętrza w modelu i ukrywanie przez renderer to w tym raporcie dwie różne rzeczy: tablice pięter rysują przekrój
na +1,2 m bez dachu, więc brak ścianek na tablicy znaczy brak ścianek w modelu.

## 3. Semantyka wymiarów i metryka (§3)

**12,60 i 13,52.** Łańcuch boczny rzutu parteru: 1,00 + 5,10 + 7,50 + 1,00 = 14,60. 12,60 = 5,10 + 7,50 = głębokość
**korpusu między cofniętą ścianą frontową (z = 1,00) a ścianą tylną (z = 13,60)**; 1,00 z każdej strony to zwroty
(front: zwroty ramy, tył: filary tarasu). Obrys hosta v3.54.8 13,52 m = od lica zwrotów frontowych (z = 0) do ściany
tylnej — z frontowymi zwrotami, bez tylnych. Stara kontrola porównywała 12,60 z prostokątem obrysu → FAIL → odrzucenie
H. Nowa kontrola mierzy między ścianami, na których stoją końce wymiaru: **12,52 m** (ściany na 1,005 i 13,521 m;
różnica 0,08 < 0,13) → PASS, „obrys wychodzi 1,01 m poza jego końce”. Ale gdy poza końcami leży w większości cała
bryła, kontrola zostaje FAIL (test v3.54.4 „wymiar bryły wzięty za cały dom” — pierwsza wersja reguły go łamała, co
wykrył pełny przebieg testów; poprawione przed commitem).

**Kalibracja s = D / px** (rzut parteru hosta, długości odcinków wymiarowych w pikselach wysłanego obrazu, niepewność
±1 px na każdym końcu → σ_s ≈ s·√2/px, `DERIVED`):

| wymiar | znaczenie | D [m] | px | s [cm/px] | σ_s [cm/px] |
|---|---|---|---|---|---|
| 1205 | całość, lica zewn. L–P (dom 790 + garaż 415) | 12,05 | 455,9 | 2,643 | 0,008 |
| 790 | korpus | 7,90 | 299,2 | 2,640 | 0,012 |
| 415 | garaż | 4,15 | 156,7 | 2,648 | 0,024 |
| 1260 | korpus między ścianami (bez zwrotów) | 12,60 | 477,6 | 2,638 | 0,008 |
| 510 / 750 | części łańcucha | 5,10 / 7,50 | 192,0 / 285,6 | 2,656 / 2,626 | 0,020 / 0,013 |
| 100 / 100 | zwroty (tył / front) | 1,00 | 39,2 / 36,5 | 2,55 / 2,74 | 0,09 / 0,10 |

Obie osie: 2,6431 i 2,6382 cm/px (stosunek 1,0019) — jedna skala, bez rozciągania anizotropowego. Kotwice
nieużyte do skali (zwroty 100, części łańcucha) służą jako sprawdzenie. Szerokość działki z planu sytuacyjnego nie
kalibruje rzutu (plan sytuacyjny nie był odczytany). Perspektywa — tylko jakościowo.

**Pas / rama / loggia / portal** — rozdz. 1 pyt. 2; każda wartość ma `basis` i `how` w `house.json`
(`geometry.frames[*].bandM/depthM/legM`, `geometry.portals[*]`). Wysunięcie zawsze z rzutu (zwroty), nigdy z elewacji.
Lokalne doprecyzowanie krawędzi w ROI: zbadane profilem luminancji (`edge-profile.py`) na głowicach — piki profilu
leżą w wierszach odczytanych przez API, czyli odczyt jest wierny **widocznej** krawędzi; różnica do źródła jest
definicyjna (krawędź widoczna vs otwór z opisu), więc doprecyzowanie rastra jej nie usunie — nie wprowadzono go.

## 4. Tylne przeszklenia (§4)

**3,995 → 4,182.** Cel recenzenta dla niskiego końca: 3,995 m. Przed zmianą parapet tych okien był odczytywany na
górze balustrady (wiersz 342/343 = +3,89 m), więc trójkąt głowicy „ucinał” narożnik 0,30 m nad parapetem i niski
koniec stawał na 4,182 — poprawka była `APPLIED` i `IMPROVED` (bliżej celu), ale **nie w tolerancji**. Przyczyna:
analizator (parapet), nie API ani builder. Po zmianie (parapet zasłonięty balustradą = podłoga balkonu, `ESTIMATED`,
`OPENING_SILL_HIDDEN_BY_RAILING`) niski koniec staje na 3,983 = cel recenzenta (`WITHIN_TOLERANCE`,
`VERIFIED_IN_SCOPE`). Stan `IMPROVED` bez osiągnięcia celu jest teraz osobno nazwany `OUTSIDE_TOLERANCE`
(test przyczynowy), a końcowy pomiar na oddanej scenie wpisuje `final` do usterki.

**Tabela B — końce i kąt (scorer v2, tolerancje: 0,15 m, 2,5°)**

| okno | źródło (wys./nisk./kąt) | LOCAL | H-PRZED | H-PO | DIAG ręczna (4 końce z prawdy) |
|---|---|---|---|---|---|
| front 270/320 | 6,26 / 4,02 / 39,7° | 6,26 / 3,99 / 40,0° OK | 6,08 / 4,22 / 36,7° NO | 6,08 / 3,92 / 40,9° NO (wys.) | 6,26 / 4,02 OK |
| tył W 234/303 | 6,09 / 4,13 / 39,95° | 6,10 / 4,14 / 40,0° OK | 5,85 / 4,18 / 32,9° NO | 5,85 / 3,98 / 35,9° NO (wys., kąt) | 6,09 / 4,13 OK |
| tył E 234/303 | 6,09 / 4,13 / 39,95° | 6,09 / 4,14 / 39,9° OK | 5,85 / 4,18 / 32,9° NO | 5,85 / 3,98 / 35,9° NO (wys., kąt) | 6,09 / 4,13 OK |

Stabilne ID: `opening-rear-2`, `opening-rear-4`, `opening-front-2` (ściana `wall-1-6` / `wall-1-2`, kondygnacja 1).
Odbicie lewo–prawo na tylnej elewacji (widok z zewnątrz) poprawne: w H-PO wyższy koniec jest przy kalenicy w obu
oknach (`sense` OK). **Nie ma pełnego APPLIED wobec źródła**: wysokie końce są 0,24 m za nisko.

## 5. Wnętrza wszystkich kondygnacji (§5)

**Kontrakt** (`house.json` 0.5.0): `interiorSource` (poza obserwacjami — rewizja recenzji się nie zmienia):
zasięg i obrys LOCAL, grubość ścian zewnętrznych, środki otworów zewnętrznych, na poziom: ścianki (oś, grubość),
drzwi (ściana, offset, szerokość, wysokość), pomieszczenia (wielokąt, otwory, przeznaczenie), schody, otwory stropu.
`geometry.interior`: status `NOT_BUILT | NOT_CHECKED | BUILT | PARTIAL`, transformacja (odbicia, skala, przesunięcie,
stosunek osi, pokrycie, mapa poziomów), poziomy z elementami i listą `dropped` (id, rodzaj, powód).

**Transformacja zamiast prostokąta** — ADR p. 2. Pole powierzchni jest sprawdzeniem, nie kotwicą; między
funkcjami otwartej strefy nie ma ścianki (LOCAL trzyma strefę dzienną jako jedno pomieszczenie i tak zostaje);
ścianka wspólna jest jedna; w otworze schodów nie ma podłogi (otwór stropu + otwór pomieszczenia).

**Tabela C — pokrycie kondygnacji (Marcówki)**

| kondygnacja | rzuty dostępne | wysłane | odczytane przez API | zbudowane w H-PRZED | zbudowane w H-PO (z LOCAL) |
|---|---|---|---|---|---|
| parter | 4 (2 pełne + 2 kopie) | 4 (INVENTORY), 1 (PLAN 1568) | obrys, wymiary, poziomy | 0 ścianek, 0 pomieszczeń | 11 ścianek, 5 drzwi, 7 pomieszczeń, schody |
| poddasze | 4 | 4 (INVENTORY), 2 (PLAN 800) | nic | 0 | 9 ścianek, 5 drzwi, 6 pomieszczeń, otwór stropu |

**Tabela D — miary wnętrza wzgl. rzutów źródła** (scorer v2; prawda `T2-ROOM-*`, rejestracja po licu zachodnim
i froncie; dla H-PO resztka rejestracji z = −1,11 m to brak tylnych zwrotów w obrysie H, nie przesunięcie wnętrza)

| model | kondygnacja | pomieszczenia (model/źródło) | dopasowane | brak | scalone | błąd kształtu | błąd pola | pokrycie podłogi | ścianki / drzwi / przejścia / składowe | otwór schodów IoU |
|---|---|---|---|---|---|---|---|---|---|---|
| LOCAL | parter | 7/10 | 7 | Hol, Kuchnia, szyb schodów | 1 (strefa dzienna = Hol+Kuchnia+Salon) | 0,123 | ±2,80 m² | 0,920 | 11 / 5 / 5 / 2 | — |
| LOCAL | poddasze | 6/9 | 6 | 2 garderoby, Schody | 2 (pokój+garderoba ×2) | 0,197 | ±1,73 m² | 0,871 | 9 / 5 / 5 / 1 | 0,65 |
| H-PRZED | obie | 0/19 | 0 | wszystkie | — | — | — | 0,0 | 0 | — |
| H-PO | parter | 7/10 | 7 | j.w. | 1 | 0,139 | ±2,77 m² | 0,926 | 11 / 5 / 5 / 2 | — |
| H-PO | poddasze | 6/9 | 6 | j.w. | 2 | 0,212 | ±1,88 m² | 0,881 | 9 / 5 / 5 / 1 | 0,66 |

Dwie składowe na parterze = garaż osobno (połączenie garaż–kotłownia to drzwi w ścianie wspólnej, których LOCAL nie
ma). Tablice pięter: `boards/storeys-I4.png` (rzut źródła | przekrój +1,2 m bez dachu z czerwonymi wielokątami
pomieszczeń źródła).

## 6. Kontrole (≥ 2 kondygnacje) i regresja (§8)

| dom | wybór v3.54.8 → v3.54.9 | wnętrze | dlaczego |
|---|---|---|---|
| Frizeach (c4) | LOCAL → LOCAL | **BUILT** 37 el. | rejestracja jednoznaczna |
| Pallas (c4) | DESCRIBED → DESCRIBED | **PARTIAL** 8 el., 2 nie | poziom LOCAL +2,80 vs H +3,04 (> 0,15 m) — piętro nieumieszczone, schody pominięte; 1 ścianka odrzucona przez kernel (`WALLS_OVERLAP` 0,034 m² ze ścianą zewn.) — nazwane |
| Oslo (c4) | LOCAL → LOCAL | NOT_BUILT | obrys symetryczny; otwory 0,12 vs 0,19 m, drzwi 0,00 vs 0,04 m — odbicie nierozstrzygnięte |
| Lubczyk (c4) | DESCRIBED → DESCRIBED | NOT_BUILT | konflikt metryki: skale osi 0,9994 / 1,1544 (H 15,92×10,02 vs LOCAL 15,93×8,68) |
| Wena (c4), Alaska (c5) | DESCRIBED → DESCRIBED | NOT_BUILT | konflikt metryki |
| Pliszka (c5) | DESCRIBED → DESCRIBED | NOT_BUILT | brak rejestracji |
| Dublin, 550029lan, Anodach, Malaxisach, Kardamon | bez zmian | NOT_BUILT | brak źródła wnętrza (LOCAL go nie ma) |
| Mirabelka, Tracja | NOT_SENT | — | jak w bazie |

Regresja geometrii (R-DEV 6, R-CNEW 8, LAr — te same odpowiedzi co v3.54.8): wybór, status, kontrole, odrzucenia,
błędy kompilacji, szerokość, głębokość i wysokość **identyczne** we wszystkich domach poza dwoma nazwanymi:
Pallas +1 odrzucenie kernela (ścianka wnętrza, wyżej) i Malaxisach −1 nieudana kontrola (wymiar 12 m mierzony między
ścianami na 0,524 i 12,455 m — reguła końców; wybór bez zmian, NONE). Pierwszy przebieg regresji wykazał, że
kontrole wnętrza w zakresie `BODIES` przenosiły wybór na LOCAL w 5 domach — poprawione (zakres `INTERIOR`, test).

**Pallas — STALE_DEPENDENCY i poprawka dachu garażu (§7).** Zapisana odpowiedź recenzji nazywała rewizję
`9e19b92fd0e1`, bieżąca to `46823377fb21`; różnica: tylko balustrady wyprowadzone z notatki (v3.54.8,
`railingFrom: NOTE`). `legacyRevisionOf` (te pola zdjęte) = `9e19b92fd0e1` → runda `REBOUND` (`reboundFrom` w
dzienniku), `SET_ROOF roof of garage` znowu `APPLIED` (model 8293d235e8 → 2f7d93bedb, odrzucone/zatrzymane 15 → 13).
Runda 2 analogicznie (`4d871cc7bfb4`). Ochrona nie jest wyłączona: świeża odpowiedź z inną rewizją zostaje `STALE`.

## 7. Recenzja, schemat modelu, wersje (§6, §7)

- Stany: `APPLIED`, `IMPROVED` (wobec braku pomiaru tylko w tolerancji), `WITHIN_TOLERANCE`/`OUTSIDE_TOLERANCE`
  (0,10 m), `VERIFIED_IN_SCOPE` (końcowy pomiar na oddanej scenie wobec celu recenzenta). Zgodność ze źródłem jest
  osobno (scorer v2, offline). `MATCHES` przy otwartych usterkach → `openAtVerdict` w dzienniku rundy.
- **Nie zrobiono**: recenzent nadal dostaje elewacje (źródło | render, 4 strony, widok ukośny); rzutów pięter i
  widoków kondygnacji bez dachu nie dostaje. Powód: wnętrze jest umieszczane deterministycznie i sprawdzane miarą,
  a koszt dodatkowych obrazów w rundzie zjadałby budżet jednego zadania hosta. Otwarte.
- Schemat modelu **1.8.0** (ADR p. 7): migracja 1.7.0 → 1.8.0; 1.7.0 z `GABLE_FRAME` → restatement z notatką; 1.6.0 z
  `GABLE_FRAME` → odrzucony. Testy zapisu/odczytu starego i nowego (`migration.test.ts`), 3 kandydatów + kopia
  artefaktu przepieczętowane (`reseal-log.json`), 4 modele OWNER-a przepieczętowane zmianą wersji (piny 1.7.0 w
  komentarzu `scenes.ts`), sceny APK i fikstury Androida odświeżone (zmieniły się tylko hashe).

## 8. Finalny host E2E (`39fec90`)

Jedno zaplanowane zadanie na Marcówkach (szacunek przed: 8–10 żądań, ≤ 0,45 USD; pułap ksiąg hosta 23,537928 USD),
plus to samo URL drugi raz (ponowne użycie) i zadanie bez tokenu. Prawdziwy publiczny punkt wejścia (`POST
/v1/analyses` → status → wynik, scena, model, dokument domu). **ALL CHECKS PASSED.**

| zadanie | czas | żądania / USD | wybór | wnętrze w dokumencie | uwagi |
|---|---|---|---|---|---|
| job-1 | 320 s | 6 / 0,361472 | `BOTH_CONTRADICT` (PARTIAL PREVIEW) → **LOCAL** | BUILT, 44 el. (skala 0,99717, pokrycie 97,6 %) | dokument 0.5.0; własne kontrole opisu 15/0 (**13,52-vs-12,60 zniknęło**); granica danych PASS (8 wartości); `QUALITY_FEATURES_CHECKED` |
| job-2 (to samo URL) | 165 s | 0 / 0 | ten sam | ten sam | `REVISION_REUSED`: ten sam model, ten sam status |
| bez tokenu | 150 s | 0 / 0 | ścieżka rysunków | brak dokumentu (404) | nic nie zaksięgowano |

Dlaczego LOCAL: opis domu przeszedł wszystkie własne kontrole (w v3.54.8 odpadał na zakresie), więc wybór porównał
oba modele z tymi samymi dowodami elewacji — LOCAL: obrysy pokrywają się w 84 %; opis: rama szczytowa po lewej
stronie (LOCAL ją ma, odczyt opisu nic o niej nie mówi). Mniej sprzeczności → LOCAL, oznaczony jako podgląd
częściowy. Model oddany (`ODDANY`) = LOCAL hosta: 27/27, wnętrze LOCAL (20 ścianek, 13 pomieszczeń — kontrola hosta
„placed interior is in the served model” jest tu spełniona przez wnętrze samego LOCAL, nie przez przeniesienie).
Opis hosta skompilowany lokalnie z jego dokumentu (`H-host`): 16/27 (świeży odczyt: pas 0,98 m — jeszcze szerszy niż
LIVE1), wnętrze przeniesione jak w H-PO. Łańcuch strona → `house.json` → model → scena → zapis → loader sprawdzony
(hashe sceny i modelu, przeładowanie, dokument czytany dwa razy te same bajty).

## 9. Przed / po i co zostaje

**Tabela E — Marcówki, miary (27 starych wierszy v3.54.8 + nowe v2; scorer `buildapp.v3549-marcowki-metric/2`)**

| miara | LOCAL | H-PRZED | H-PO | H-host | ODDANY |
|---|---|---|---|---|---|
| 27 wierszy v3.54.8 | 27/27 | 21/27 | 22/27 | 16/27 | 27/27 |
| końce głowic OK (6) | 6/6 | 2/6 | 3/6 | 1/6 | 6/6 |
| kąt głowic OK (3) | 3/3 | 0/3 | 0/3 | 1/3 | 3/3 |
| pomieszczenia dopasowane (19) | 13 | 0 | 13 | 13 | 13 |
| pokrycie podłogi parter / poddasze | 0,920 / 0,871 | 0 / 0 | 0,926 / 0,881 | 0,928 / 0,882 | 0,920 / 0,871 |
| otwór schodów IoU | 0,65 | — | 0,66 | 0,65 | 0,65 |

Tablice (poza Gitem, pakiet prywatny): `boards/elevations.png` (cztery strony ŹRÓDŁO | LOCAL | H-PRZED | H-PO |
H-host | ODDANY w ramie zarejestrowanej elewacji, ze zbliżeniem korpusu), `boards/closeups.png` (nogi, styk w kalenicy,
balustrada, pas portalu, skośne przeszklenia), `boards/oblique/` (widok ukośny), `boards/storeys-*.png` (rzut źródła |
przekrój +1,2 m bez dachu z wielokątami pomieszczeń źródła), obrazy wysłane recenzentowi (`I5/.../review-*-pair-*.png`).

Zostaje (zmierzone): pas ramy H +0,11 m (odczyt), wysokie końce głowic H −0,24 m (definicja krawędzi; potrzebne pole
opisu otworu), szerokość skośnych H 2,58 vs 2,34 m, strefa dzienna jako jedno pomieszczenie i dwie garderoby bez
ścianek (z LOCAL), brak tylnych zwrotów w obrysie H (−1,11 m), Pallas: ścianka odrzucona i piętro nieumieszczone,
Oslo: odbicie nierozstrzygnięte. Mierzalne: wszystkie powyższe są wierszami scorera v2.

## 10. Testy

- 17 testów przyczynowych `packages/analysis-service/test/house-v3549.test.ts`: wnętrze umieszczone / odbite /
  konflikt metryki / inny poziom / prostokąt bez rozstrzygnięcia / konsument buildera (ścianki, drzwi, pomieszczenia,
  otwór stropu) / zewnętrze identyczne z wnętrzem i bez / wnętrze zachowane po poprawce elewacji / wnętrze
  nieumieszczalne nie psuje zewnętrza / parapet zasłonięty vs widoczny / wymiar między ścianami vs koniec w próżni vs
  bryła poza końcem / IMPROVED+OUTSIDE_TOLERANCE / WITHIN_TOLERANCE i brak pomiaru przed / rebind tylko przy
  balustradzie z notatki. Migracje: `packages/model/test/migration.test.ts` (+3).
- `reconstruction` + `analysis-service`: 2082/2082. Pełna macierz na `39fec90`: 4224 zaliczone, 15 nieudanych —
  **dokładnie ten sam zbiór co baza v3.54.8** (środowiskowe: analyzer-api secret scan, compound-facade, presentation,
  reference ×2, research-isolation ×4, wall-strip ×4, local-analyzer program/text).

## 11. Koszt

| pozycja | żądania | USD |
|---|---|---|
| odtworzenia (I1–I5, RI, RB, R-DEV, R-CNEW, LAr, diag) | 0 | 0 |
| finalny host E2E (Marcówki + ponowne użycie + bez tokenu) | 6 | 0,361472 |
| **razem etap** | **6** | **0,361472** |

Księgi: otwarcie 22,937928 → **23,299400 z 24,11036 USD** (zostaje 0,81096); 6 rezerwacji = 6 rozliczeń, żadna
otwarta; ledger `research/ai-assist/spend-ledger-v3549.json`. Limit projektu 100 USD nie podnosi puli. Klucz użyty
wyłącznie ze zmiennej środowiska; skan bajtów klucza w commitach, logach i artefaktach hosta: czysto.

## 12. Pakiet prywatny

`/home/user/BuildPlan-V3549-Private.zip` (poza Gitem; 6,2 MB, 130 plików, SHA-256 `0913161196dbdb23…`):
inwentarz źródeł z hashami i dostępnością, prawda użyta przez scorer, zapisane odpowiedzi, `house.json` / model /
scena / ślad / recenzja dla LOCAL, H-PRZED, H-PO, H-host i ODDANY, obrazy wysłane recenzentowi, tablice, diagnostyka
ręczna, rebind Pallas, wyniki regresji, pełna macierz testów, ledger i księgi hosta, rekordy hosta, `MANIFEST.sha256`.
Sprawdzone: rozpakowanie + manifest OK, brak bajtów klucza i wzorca klucza.

