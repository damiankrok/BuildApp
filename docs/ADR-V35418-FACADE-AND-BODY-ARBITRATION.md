# ADR v3.54.18 — arbitraż elewacji i bryły: LOCAL jako hipoteza, odczyt API jako obserwacja, obraz źródła jako sędzia

Status: przyjęte (v3.54.18). Poprzedniki: `ADR-V35416-CORRECTION-EXECUTOR.md` (rejestr, wykonawca, bramka źródła),
`ADR-V35417-MASSING-ROOF-WITNESS.md` (bryła, dach, świadek → cel).

## Kontekst

Po R2/R3 kolorowe szkice (odczyt API jednej elewacji do typowanego JSON-a w pikselach oryginału) były wierne, a modele nie:
Alaska bez drzwi, Aurora z pasami okien LOCAL, Ballina bez okapu. Prześledzenie nagrań R3 i trzech nowych domów (baseline
na zamrożonym kodzie `37ad17c`) wskazało dziewięć miejsc pierwszej straty informacji (raport §2). Wspólny mianownik:
**model LOCAL był nienaruszalną bazą**, a odczyt API mógł go zmieniać tylko element po elemencie, przez bramkę, która
sama zależała od błędnego modelu.

## Rozważone warianty

| Wariant | Na czym polega | Za | Przeciw | Decyzja |
|---|---|---|---|---|
| A. Dalsze strojenie pętli R3 | zostawić korekty element po elemencie, dodać operacje | najmniej kodu | nie usuwa zależności bramki od błędów LOCAL (0 wolnych miejsc na ścianie wypełnionej widmami), nie dotyka złej bryły | odrzucony |
| B. Szkic jako jedyna prawda zewnętrza („buduj z API”) | bryła i elewacje wyłącznie z odczytu API, LOCAL tylko do wnętrza | prosty przepływ, ładne miniatury | „pewne stwierdzenie API nie zastępuje dowodu”: halucynacja otworu wchodzi do modelu; traci się wymiary drukowane i szczeliny rzutu, które LOCAL czyta dobrze (ARCHON) | odrzucony jako całość |
| C. Arbitraż hipotez na dowodach niezależnych od obu stron (WYBRANY) | LOCAL i odczyt API to dwie hipotezy; rozstrzyga obraz oryginału (bramka), drugi rysunek (rzut: rozpiętość otworu, wymiar drukowany), fakt strony (wysokość, kąt); decyzja na trzech poziomach: element → elewacja → bryła; czego dowód nie rozstrzyga, zostaje nazwane | usuwa zależność od błędów LOCAL bez oddania władzy API; każdy fakt ma los; działa także bez modelu LOCAL | więcej kodu i stanów; miara obrazu nadal bywa nierozstrzygająca | **przyjęty** |
| D. Dodatkowe żądanie API „sprawdź ten otwór” | drugi odczyt jako świadek | łatwe | dwa odczyty tej samej informacji tym samym modelem nie są niezależnymi świadkami; koszt | odrzucony |

## Decyzja (wariant C)

1. **Poziom elementu — bramka źródła 1.3.0.** Tło („tu nic nie stoi”) nie jest już liczone wyłącznie z miejsc wolnych od
   otworów modelu. Kolejno: pasmo wspólne (jak 1.2.0); gdy za cienkie — ściana, którą odczyt tej elewacji sam nazywa
   gładką (jego własne otwory wyłączone), czytana odpornie (mediana / MAD); gdy i to za cienkie (drzwi, brama) — ten sam
   kształt przesunięty o 15–30 % (reguła znana z brył od 1.2.0). W tym trybie pomiar jest przycięty do ściany (krawędź
   leżąca na końcu ściany nie jest dowodem otworu) i czyta trzy płaszczyzny: jasność oraz dwie różnice barw (czerwone
   drzwi w ciemnym drewnie). Progi (z ≥ 2, margines 1) bez zmian.
2. **Poziom właściwości.** Otwory LOCAL mówią, na czym stoi każda ich właściwość (`offset`/`width` — szczelina rzutu;
   `sill`/`height` najczęściej ASSUMED). Aktualizacja, która zachowuje rozpiętość z rzutu (≥ 70 % wspólnej długości) i
   zmienia tylko to, co model ZAŁOŻYŁ, nie musi „pobić” założenia o margines: obraz ma jej nie obalić
   (`crossWitness: PLAN_SPAN`). Właściwości drukowane lub odczytane z elewacji nigdy nie podlegają tej regule.
3. **Poziom elewacji — przyjęcie odczytu (`FACADE_ADOPTION`).** Gdy obraz wspiera ≥ 60 % otworów, które odczyt rysuje
   na tej stronie (co najmniej 2), i żadnego nie obala, elementy nierozstrzygnięte idą za odczytem; otwór modelu, który
   obraz „wspiera”, znika tylko wtedy, gdy odczyt wyjaśnia te krawędzie (granica stref wykończenia albo inny element
   przechodzący przez jego pole). Elementy przyjęte są oznaczone `ADOPTED_WITH_FACADE` i nigdy `SOURCE_VERIFIED`.
4. **Poziom bryły — `BODY_ARBITRATION` 1.1.0.** Bryła LOCAL (po korekcie dachu, którą sama może przyjąć z elewacji) jest
   zestawiana z tym, co od niej nie pochodzi: rejestracją opisanych elewacji (końce ścian, grunt, okap/kalenica),
   wymiarami całkowitymi wydrukowanymi na rzucie, opublikowaną wysokością budynku. Dopiero gdy te dowody jej przeczą,
   budowana jest bryła z obrysu rzutu i elewacji (ścieżka domu bez modelu LOCAL) i zastępuje bryłę LOCAL wyłącznie, gdy
   te same dowody nie przeczą jej wcale (1.1.0; w 1.0.0 wystarczało „mniej" — cofnięte po regresji) i wspierają co
   najmniej tak samo. Wnętrze LOCAL nie przechodzi (NOT_CHECKED, nazwane).
5. **Jedna ścieżka konsumpcji odczytów**, z modelem LOCAL lub bez: dach (`SET_ROOF`, okap przy ścianie = szczyt
   rysowanych ścian w narożach — ta sama linia w każdym widoku), okap, kominy, otwory, okna połaciowe
   (`ADD_ROOF_WINDOW`, rejestr 1.5.0), strefy wykończenia (`SET_FINISH` z obrysem strefy), paleta miniatury.
6. **Los każdego faktu** — `buildapp.observation-fate` 1.0.0: jeden wiersz na element każdego odczytu (współrzędne w
   pikselach oryginału, producent, strona i jej podstawa, operacja, cel, status weryfikacji, powód).
7. **Nazwane konwencje miniatury** (nigdy status wymiaru): bok bez etykiety przypisany kolejnością źródła, gdy dowody
   nie rozstrzygają; uproszczenie obrysu o małe uskoki (≤ 6 % / krok, ≤ 12 % łącznie); paleta bez odczytu tonu.
8. **Model i widok mówią to samo o otworach** (cykl 5). Narysowany wierzch ściany to spód dachu przy ścianie; górna
   powierzchnia (`eaveOffset`) stoi nad nim o t / cos(kąt). Korekta dachu sprawdza otwory względem wierzchu ściany, który
   zbuduje kompilator; wysokość otworu ZAŁOŻONA ustępuje dachowi ze źródła, odczytana odrzuca poprawkę. Transakcja, która
   zostawiłaby nowy otwór niewycięty przez kompilator, jest wycofywana (`OPENING_NOT_CUT`); niewycięte otwory oddanego
   modelu są nazwane (`DELIVERED_OPENINGS_NOT_CUT`).

## Konsekwencje

- Jedna kanoniczna prawda zostaje: wszystkie zmiany idą przez `@buildapp/commands` w jednym wykonawcy, z transakcją,
  pomiarem i wycofaniem; renderer i aplikacja czytają ten sam model.
- Zmieniają się wersje: bramka 1.3.0, rejestr 1.5.0, wykonawca 1.6.0, propozycje ze szkicu 1.6.0, ops 1.6.0,
  massing 1.2.0, arbitraż bryły 1.1.0 — wszystkie w kluczu przyjętej rewizji (stary cache nie jest odtwarzany).
- Otwarte (nazwane w raporcie §12): drzwi wejściowe na ciemnym lub zatłoczonym tle, widma LOCAL „wspierane" przez
  obraz, bryły o dwóch–trzech skrzydłach, dach czterospadowy, obrót modelu do stron źródła, przeniesienie wnętrza na
  bryłę ze źródeł, ton ściany bazowej, daszki/tarasy/pergole (brak operacji).
- Wynik próby (cel zapisany z góry nieosiągnięty; liczby w raporcie §0 i §7) nie zmienia decyzji: wariant C usuwa
  nazwane straty, a pozostałe blokady leżą w reprezentacji (formy brył i dachów) i w drugim świadku dla drzwi.

## R2 (2026-11-24): forma dachu i strony domu czytane z rysunku, nie z konwencji

Kontynuacja po dostawie 1349. Decyzja C zostaje; dopisane są reguły ODCZYTU, które zasilają arbitraż bryły. Każda ma
przyczynę fizyczną w rysunku, test z kontrpróbą (`packages/analysis-service/test/hip-v35418.test.ts`,
`plan-outline-v35418.test.ts`) i została przeliczona offline na nagraniach wszystkich dziewięciu domów
(`research/source-to-model/v35418/diag-massing.ts`, 0 USD) przed jakimkolwiek żądaniem.

1. **Dach czterospadowy jest formą, nie odmową.** Model nadal zna tylko `GABLE | FLAT` jako dachy parametryczne; dach
   czterospadowy to cztery `roofPlanes` (`createRoofPlane`) o stałych identyfikatorach `roof-<bryła>-{minZ,maxZ,minX,maxX}`.
   Rozpoznanie: trapez na stronach WZDŁUŻ kalenicy (kalenica krótsza od okapu z obu końców), żadna z nich pasem.
   Wysunięcie końców kalenicy czytane z tych widoków przez rejestrację, która położyła końce ścian na rzucie.
   `SET_ROOF` przyjmuje `roofKind: HIP` (rejestr 1.6.0) i przechodzi przez tę samą bramkę źródła co każdy inny dach.
2. **Każdy bok dachu czterospadowego jest okapem.** Żaden widok nie pokazuje naroża ściany pod dachem; każdy rysuje
   okap na KOŃCU wysięgu. Kąt liczy się więc od najniższej narysowanej krawędzi przez wysięg i połowę rozpiętości do
   kalenicy (liczony od lica ściany wychodził o udział wysięgu za stromo: 36° dla dachu rysowanego 30°).
3. **Okap przy ścianie daje widok szczytu.** Widok szczytu pokazuje naroże ściany dochodzące do spodu dachu; widok
   wzdłuż kalenicy rysuje ścianę kończącą się za okapem i podbitką — niżej, najwyżej o spadek wysięgu. Gdzie widok
   szczytu rysuje naroża, one są okapem przy ścianie, o ile żaden widok wzdłuż kalenicy nie rysuje ściany WYŻEJ ani
   niżej, niż wysięg może zasłonić (wtedy zostaje mediana wszystkich, niepotwierdzona — jak dotąd).
4. **Szczyt narysowany samą wiatrownicą jest szczytem.** Liczony kolumnami pokrycia taki dach nie ma „szerokości" przy
   okapie i wychodził pasem. Gdzie dach jest pusty u podstawy, jego szerokość w wierszu to szerokość obrysu.
5. **Obrót o 90° dowodzą tylko widoki na OBU osiach bryły.** Front i tył skalują się tym samym wymiarem rzutu przy
   obu przypisaniach; przy tolerancji w metrach obrót na krótszy bok zmniejsza każdą niezgodność poniżej progu.
6. **KTÓRY obrót rozstrzyga rzut.** Wysokości są takie same dla obu ćwierćobrotów — różnią się tym, który KONIEC domu
   rysuje elewacja frontowa. Odczyt rzutu (`plan-outline/2`) podaje punkt wejścia głównego na obrysie tylko tam, gdzie
   rzut je oznacza; bok bierze się, gdy punkt leży przy jednym boku obrysu. Bez tego pierwszy obrót zostaje konwencją
   (nazwaną). Wskazówka nigdy nie obraca elewacji, których wysokości zgadzają się jak opisano.

Odrzucone w R2: wykorzystanie luk rzutu LOCAL do rozstrzygania stron (na Alasce LOCAL wypełnił całe ściany lukami —
fantomy nie są świadkiem); próg „ściana niższa niż kondygnacja nie jest odczytem" (Jeziorko ma prawdziwe 1,9 m);
poluzowanie tolerancji rejestracji okapu (Aurora: pusty szczyt nadal odłożony, 13 px przy tolerancji 8 px).
