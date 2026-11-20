# v3.54.17 R3 — okap, kominy, wysokości za donicami, pełne wymiary (OWNER 2026-11-20)

Gałąź `claude/new-session-3kzcgh`, baza R2 `9a1a962`. Commity R3: `4ff82a3`, `f912b05`, `7e27215`, `a2d25df` oraz
commit wyników na żywo i dokumentacji. Bez merge i PR. Nie ma reguł od nazw domów. ForgeShape tylko do odczytu, H2 i
benchmark OWNER-a poza zakresem. Klucz jest czytany tylko z pliku sekretu na hoście: nie trafia do Gita, logów, ZIP-a ani
parametrów polecenia (skan przed każdym commitem).

## Pytania OWNER-a i odpowiedzi

> Dlaczego model nie ma dachu wystającego poza bryłę, jak oryginał? Dlaczego nie ma kominów? Skoro AI robi kolorowe
> szkice, niech pominie doniczki, które zasłaniają, i zbuduje poprawną bryłę. Wymiary do analizatora mają być wszystkie:
> co, gdzie i jakie. Mam 70 USD na API, można testować i poprawiać zapytania. Ma działać.

Zgoda budżetowa: **+40 USD** (odpowiedź OWNER-a w AskUserQuestion). Księga R3 otwiera się na 28,542857 USD, pułap
68,542857 USD. Saldo panelu nie jest zgodą ponad ten pułap.

## Werdykt

**Okap i kominy działają na żywo na Aurorze. Alaska ma kominy i zweryfikowaną skalę, ale jej okna nadal są złe. Ballina
na żywo okap straciła (regresja nazwana niżej).** Bramki źródłowej nie poluzowałem w żadnym miejscu, więc część poprawek
okien zostaje NEEDS_EVIDENCE z nazwanym powodem.

Wydano **0,958076 USD** w pięciu biegach na żywo. Księga: 28,542857 → 29,500933 USD, pułap 68,542857 USD.

| Bieg | USD | Wynik |
|---|---|---|
| Aurora 1 (`live/aurora-1`, metric-read/3, prompt 0.7.0) | 0,196 | kominy 2, okap szczytowy, odczyt metryki bez końców linii |
| Aurora 2 (`live/aurora-2`, metric-read/4, prompt 0.8.0, szkic v2) | 0,200 | **3 kominy** (źródło ma 3) zamknięte przez recenzenta jako zweryfikowane, okapy szczytowe ~0,7 m, okap boczny 0,45 m (ograniczony przez daszek przybudówki), RECOGNIZABLE_PARTIAL, 1 różnica otwarta (nie KEY) |
| Alaska 1 (`live/alaska-1`, metric-read/4) | 0,091 | **LOCAL odmówił** (NO_SCALE): odczyt nie podał końców linii wymiarowych → poprawka metric-read/5 |
| Alaska 2 (`live/alaska-2`, metric-read/5) | 0,200 | skala SUPPORTED (13,15 × 7,90 m z końcami linii), **2 kominy** w tych samych miejscach co w powtórce, okap ze szkicu ~0 (źródło go praktycznie nie ma); okna złe: 6 różnic otwartych (2 KEY) |
| Ballina 1 (`live/ballina-1`) | 0,272 | model na skali SUPPORTED, ale **okap 0** (powtórka ze szkicami v1: 0,79 m) — orientacja UNDECIDED, dach ustawił recenzent bez okapu |

Plansze (źródło | szkic z prawdziwego odczytu | LOCAL przed | dostarczony) są w prywatnym ZIP-ie, `boards/<dom>/<dom>-board-r3.png`.
`aurora-maxi-fixed` to powtórka tur Aurory 2 (0 USD) na kodzie z poprawką SET_ROOF poniżej.

## Tabela R3

| Pytanie OWNER-a | Przyczyna | Zmieniony konsument | Dowód | Wynik | Granica |
|---|---|---|---|---|---|
| Brak okapu | Model miał `overhang` 0 na stałe; szkic nie rysował okapu; nie było operacji, która go ustawia | prompt szkicu v2 (dach z okapem, ściana kończy się pod podbitką); `SET_ROOF_OVERHANG` (rejestr 1.3.0): z widoku okapowego wysunięcia szczytów koniec po końcu (kalenica wydłużona), z widoku szczytowego okap; `SET_ROOF` z kątem ze strony; **wykonawca 1.4.0: okap ograniczony do zasięgu, który mija dach i ściany innej bryły** (obie wartości w zapisie) | `sketch-registration-v35417r3` (19): wysunięcia 0,6/0,4 m, okap 0,5 m, przybudówka ogranicza okap, kontr-próby (węższy niż ściany, > 1 m, dwa różne okapy, nie te ściany); Aurora 2 na żywo: szczyty ~0,7 m, okap boczny 0,45 m | DOSTARCZONE (Aurora) | Ballina na żywo: regresja (niżej). `plateInset` jako okap jednostronny odrzucony: ściany idące za dachem wchodzą wtedy w połać (`r3/probe-overhang.ts`) |
| Brak kominów | Kominy ze szkicu stawały w połowie głębokości (model LOCAL nie ma `roofPlanes`, a linia styku z dachem liczyła się tylko z nich); front i tył widzą te same kominy, więc parowanie z widokiem szczytowym było „niejednoznaczne” | `fuseChimneys` 1.1.0 (bliźniaki przód/tył to jeden komin; każdy odczyt zapisany); `roofMeet` czyta też dachy parametryczne; DUPLICATE przy nakładaniu się rzutów kominów | testy: bliźniaki → 2 kominy, 2 duplikaty; komin „za kalenicą” stoi za kalenicą; Aurora 2 na żywo: x 7,70–8,57 i 9,69–10,19 za kalenicą (z 6,30–7,17), x 11,59–11,99 na połaci frontowej — zgodnie ze źródłem (3 kominy) | DOSTARCZONE | Komin widziany tylko z jednego boku, którego nie da się sparować, zostaje pojedynczy (nazwany, nie wybrany) |
| Doniczki zasłaniają, wysokości złe | Rejestracja analizatora bez wysokości (ziemia zasłonięta) | szkic v2: ziemia i ściany prowadzone za donicami; `registerFromSketch` (okap lub kalenica jako kontrola); rejestracje liczone ponownie na modelu roboczym; strony bez etykiety rozstrzygane permutacją (`SIDE_OF_UNLABELLED_ELEVATIONS`) | Aurora: bok bez etykiety → LEFT („jedyne przypisanie, przy którym rejestrują się wszystkie”); kalenica 6,62 m przy kącie strony 35° | DOSTARCZONE | Rejestracja ze szkicu wymaga zgodności okapu albo kalenicy modelu; inaczej odmowa (AXIS_MISMATCH) |
| Wszystkie wymiary: co, gdzie, ile | Prompt prosił o końce linii wymiarowej, ale pole było w narzędziu opcjonalne, więc odczyt na żywo je pomijał (Alaska: brak skali) | metric-read/4 (każdy wymiar: łańcuchy, otwory, pokoje, gdzie stoi) → **metric-read/5: `ends` wymagane** w schemacie narzędzia; wymiar drukowany koryguje obrys (`SET_OUTLINE` z `printed`) | test schematu; Alaska 2: oba wymiary z końcami, skala SUPPORTED; Aurora 15,54 → 15,90 m w powtórce; Ballina/Alaska: OUTLINE_AGREES | DOSTARCZONE | **Strony tych domów drukują tylko wymiary całkowite** (recenzent: „jedyne wymiary na rzucie to 13,15 i 7,90”). Dwie liczby to wszystko, co źródło podaje — reszty nie zmyślam |
| Okna ucinane / zniekształcone | Okno, którego szkic nie ma, zostawało; jedno okno źródła nad dwoma modelu blokowało się kolizją | szkic 1.5.0: REMOVE tylko tam, gdzie szkic widzi ścianę (VISIBLE), decyduje oryginał; okno na dachu to nie otwór ściany; `absorbs` (jedna aktualizacja wchłania okna tej samej ściany w nowym kształcie); relacje usuwanego otworu idą z nim | `correct-v35416` (49): usunięcie, kontr-próba (źródło pokazuje D i E → odmowa), brak widocznej ściany → bez propozycji, wchłonięcie, kontr-próby ABSORB_OTHER_WALL / ABSORB_OUTSIDE_SHAPE; Aurora: 5 okien usuniętych, każde potwierdzone przez oryginał | CZĘŚCIOWO | Front Aurory i elewacje Alaski: bramka ma za mało wolnych miejsc na zatłoczonym pasie → SOURCE_UNDECIDED. Częściowo pokryte okno modelu nie jest wchłaniane (zgadywanie). Progów nie luzuję |
| Model przebity ścianami (wykryte na planszy Aurory 2) | Kaskada usunięcia starego dachu ustawiała ścianom wewnętrznym płaską górę 5,92 m; nowy dach tracił materiał | `ops.ts` 1.3.0: ściany idące za starym dachem idą za nowym; materiał dachu zachowany | test w `massing-v35417` (25); powtórka Aurory 2: wszystkie ściany wewnętrzne FOLLOW_ROOF, `mat-roof` | DOSTARCZONE | — |

## Regresja nazwana: Ballina na żywo

Ballina na żywo dała okap 0, a powtórka ze starymi szkicami v1 daje 0,79 m. Szkic v2 rysuje szczyt jako cienką opaskę
wzdłuż połaci, przedłużoną poza ściany. Kontrola orientacji (`orientationOf`) czyta na widokach szczytowych okap 3,26 /
3,28 m, a na okapowych 2,91 / 2,86 m, czyli rozjazd większy niż tolerancja 0,35 m. Wynik: UNDECIDED, faza dachu ze szkicu
nie startuje, a dach ustawia recenzent (SET_ROOF bez okapu). Przyczyna: na widoku okapowym odczyt bierze dolną krawędź
okapu (niżej o okap × tan spadku), a na szczytowym spód opaski nad narożnikiem ściany. To dwa różne punkty, a rozjazd
0,4 m ≈ 0,6 m × tan 34° pasuje do okapu Balliny. Kontroli nie poluzowałem. Poprawka to porównanie tych samych punktów
(narożnik okapu na obu widokach). Zostaje otwarta. Model Balliny bez LOCAL ma też
dach bez materiału (jasny) i za mało okien na froncie.

## Zapytania do API (co zmieniono)

- **Szkic `elevation-sketch/2`:** pomija donice, rośliny i meble, prowadzi ściany i ziemię za nimi; dach z okapem i
  wysunięciem szczytów; strefa ściany kończy się pod podbitką; komin w całości; rysowana każda ortogonalna elewacja,
  także bez etykiety strony.
- **Metryka `metric-read/5`:** każdy wymiar (łańcuchy, otwory, pokoje, poziomy), gdzie stoi i na czym opierają się jego
  końce; `ends` wymagane w narzędziu.
- **Recenzent `0.8.0`:** zły zestaw okien to REMOVE / UPDATE / ADD z id z indeksu, nigdy UNSUPPORTED / OTHER; wysokości
  porównywane ze źródłem; `absorbs`, gdy jedno okno źródła stoi nad kilkoma w modelu.

## Testy

- Typecheck czysty.
- `correct-v35416` 49, `sketch-registration-v35417r3` 19, `massing-v35417` 25, `metric-read-v35414` 17 oraz
  `resolve-v35417`, `consult-v3543`, `sketch-contract-v35415`, `massing-delivery-v35417`, `exchange-record-v35417`: zielone.
- `analysis-service` + `analyzer-api` (750): 2 porażki w `worker.test.ts` pod obciążeniem (dwie powtórki w tle);
  uruchomione osobno przechodzą (3/3).
- Pełna macierz (4499 testów: 4463 zaliczonych, 16 porażek, 11 pominiętych):
  `stage-reports/artifacts/v35417-r3/matrix-r3-summary.json`. Każda porażka jest w pliku z listy bazowej:
  research-isolation 4, wall-strip 4, reference 2, presentation 2, analyzer-api 1, compound-facade 1, text 1, program 1
  (R2: 18 w tych samych plikach). Jeden nieobsłużony błąd to timeout RPC wątku vitest pod obciążeniem (obok macierzy
  liczyły się trzy powtórki). Nowych porażek nie ma.

## Regresje 0 USD

- Ballina (powtórka v1): okap 0,79 m, rzędne bez zmian.
- Alaska (powtórka tur v3.54.16): 2 kominy w tych samych miejscach, obrys zgodny z wymiarami drukowanymi.
- Aurora (powtórka tur na żywo): 3 kominy, okap boczny 0,53 m, kalenica 6,62 m.

## Otwarte (nazwane)

1. Ballina na żywo: kontrola orientacji przy szczycie rysowanym jako opaska (wyżej).
2. Bramka źródłowa na zatłoczonych elewacjach (front Aurory, Alaska): za mało wolnych miejsc → poprawki okien
   NEEDS_EVIDENCE.
3. Alaska: drzwi wejściowe z daszkiem i drzwi tarasowe brakują (recenzent: 2 KEY).
4. Dach modelu zbudowanego bez LOCAL nie ma materiału.
5. Layla (≥ 3 prostokąty) — bez zmian, NOT_BUILT.

## Dostawa

Prywatny ZIP (< 30 000 000 B, sumy SHA-256 i instrukcja w `MANIFEST-R3.txt`): plansze R3, biegi na żywo (zapisy wymiany,
tury, szkice, korekty, jakość, modele), powtórki, księga, logi. Obrazy wydawcy tylko w ZIP-ie, nigdy w Gicie.
