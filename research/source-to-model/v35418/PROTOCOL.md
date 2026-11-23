# v3.54.18 — protokół próby, zapisany PRZED pierwszym biegiem (2026-11-23)

Gałąź `claude/new-session-3kzcgh`, kod bazowy `3e395b7` (R3). Ten plik, pule adresów i skrypt selekcji są commitowane
zanim cokolwiek zostanie przeanalizowane; hash tego commita jest ziarnem selekcji i „commitem zamrożenia baseline".

## 1. Zakres wspieranych źródeł

Publiczna strona jednego projektu domu podana jako URL, z której pakiet źródłowy (bez klucza, bez przeglądarki) zawiera:
rzut parteru oraz co najmniej trzy ortogonalne elewacje (FRONT / REAR / boki, także bok nieokreślony). Strony bez rzutu
albo z < 3 elewacjami są POZA zakresem (zapisywane w `selection.json` z powodem — to filtr zakresu, nie wynik jakości).
Wszystko, co przejdzie ten filtr, jest „zadeklarowanym linkiem" i zostaje w mianowniku, także gdy skończy się NO_MODEL
albo awarią zadania.

## 2. Podział danych (rodzinny)

| Zbiór | Domy | Rola |
|---|---|---|
| DEV-K (znane) | Alaska (Studio Atrium), Aurora-maxi-ii-bis-sz (Studio Atrium), Ballina (Lipińscy) | materiał diagnostyczny z R2/R3; wolno iterować; baseline = odtworzenie nagrań R3 na kodzie `3e395b7` |
| NEW-B (nowe, baseline pierwszy) | po 1 rodzinie z pul: Studio Atrium, Lipińscy, ARCHON | pierwszy wynik na ZAMROŻONYM kodzie bazowym (ten commit); po obejrzeniu błędów stają się DEV; pierwszy wynik zachowany |
| NEW-C (nowe, ślepe) | po 1 rodzinie z pul: dobredomy, Lipińscy (druga), ARCHON (druga) | pakiety pobrane teraz i zamrożone, NIE analizowane i nie oglądane do zamrożenia kodu końcowego; pierwszy bieg na kodzie końcowym = ślepy test transferu; baseline na tych samych bajtach liczony dopiero potem |

Reguła wyboru: `trial/select.py <commit zamrożenia> <katalog roboczy>` — dla każdej puli ziarno
`sha256("<commit>:V35418-TRIAL:<wydawca>")`, start = ziarno mod rozmiar puli, przejście po kolei; rodzina obecna w
`trial/seen-families.txt` (wszystkie wcześniejsze etapy + DEV-K) jest pomijana; wariant już przyjętej rodziny pomijany;
przyjęcie wyłącznie na pobranym pakiecie (§1); najwyżej 12 otwartych kandydatów na pulę. Nie wymieniam domów po wyniku:
porażka zostaje w próbie. Jeżeli pula nie da rodziny albo budżet/dysk zmniejszy próbę, raport poda rzeczywiste N.
Prywatny H2/holdout OWNER-a nie jest otwierany. ForgeShape tylko do odczytu.

## 3. Kryterium „użytecznej rozpoznawalnej miniatury" (ustalone przed oceną)

Dla każdego domu lista cech tożsamości jest spisywana ZE ŹRÓDEŁ zanim obejrzę model tego domu (DEV-K: z plansz R3 już
znanych — jawnie nie-ślepe; NEW-B: przed biegiem baseline; NEW-C: po zamrożeniu kodu, przed biegiem). Kategorie:

- **F — forma:** układ brył (liczba członów, proporcje obrysu), forma dachu każdego członu (dwuspad/płaski/inna),
  kierunek kalenicy, liczba kondygnacji / wysokość okapu.
- **S — strony:** każda elewacja źródła na właściwej stronie modelu (dom nie obrócony, front tam gdzie front).
- **O — duże otwory:** drzwi, bramy i przeszklenia ≥ 1,2 m szerokości: jest / rodzaj / położenie w tej samej tercji
  ściany i na tej samej kondygnacji; osobno liczone otwory-widma (duży otwór modelu, którego źródło nie ma).
- **C — cechy charakterystyczne:** drzwi wejściowe, brama garażowa, kominy (liczba ±1 i strona kalenicy), lukarny,
  daszek/podcień, taras/balkon — obecność.
- **M — materiały:** dominujący ton ścian, ton dachu, strefy akcentu (drewno/kamień) na właściwej stronie.

Cecha ma werdykt OK / ZŁA / BRAK / NIEOCENIALNA (źródło nie pokazuje). **Miniatura użyteczna** wtedy i tylko wtedy, gdy:
(1) wszystkie cechy F są OK; (2) S OK dla frontu i co najmniej jednej innej strony; (3) drzwi wejściowe i (jeśli są)
brama garażowa OK; (4) ≥ 60 % dużych otworów frontu i ≥ 50 % dużych otworów wszystkich ocenianych stron OK;
(5) żadna strona nie jest zdominowana przez otwory-widma (widma ≤ liczba otworów poprawnych na tej stronie).
Kominy, okap, materiały i drobne przesunięcia nie blokują „użytecznej", ale są liczone osobno. Tolerancji nie zmieniam
po porażce. Wymiary (metryka) i wnętrze mają osobne tabele i nie wchodzą do tego werdyktu.

Ocena: (a) moja, cecha po cesze, na planszach źródło | szkic | baseline | po zmianie, te same kamery; (b) niezależny
oceniający (osobny agent bez wiedzy, który wariant jest „po", warianty oznaczone losowo X/Y) — rozbieżności raportowane.

## 4. Mierniki raportowane osobno

1. odsetek zadeklarowanych linków z użyteczną miniaturą (mianownik = wszystkie domy zbioru; NO_MODEL = porażka);
2. cechy F / S / O / C / M: OK / wszystkie ocenialne, surowe liczby błędów i braków (bez średniej ważonej jako jedynej liczby);
3. metryka: obrys X/Z względem wymiarów drukowanych lub opublikowanych, pokrycie (ile wymiarów ma świadka);
4. wnętrze: czy są pomieszczenia/ścianki, status (NOT_CHECKED gdy bryła bez LOCAL);
5. koszt USD, liczba żądań / ponowień, czas ścienny, awarie, odtwarzalność (replay 0 USD daje ten sam model).

## 5. Porównanie

Baseline (`3e395b7`) i kod końcowy na TYCH SAMYCH bajtach źródeł i tych samych kamerach renderu. Zmienność odczytu
oddzielona od algorytmu: tam, gdzie prompt odczytu się nie zmienił, kod końcowy dostaje te same nagrane odpowiedzi
(replay); świeży odczyt jest liczony osobno i oznaczony LIVE. Każdy obraz w galerii ma etykietę LIVE / REPLAY / KONTROLA.

## 6. Kryteria zakończenia i limity (z góry)

- **Cel:** na DEV-K + NEW-B (6 domów) liczba miniatur użytecznych rośnie o ≥ 2 względem baseline i żaden dom nie traci
  cechy F, którą miał; na NEW-C wynik końcowy ≥ baseline dom po domu w F i S oraz ≥ 1 miniatura użyteczna więcej łącznie.
- **Limit iteracji:** najwyżej 4 cykle zmiana mechanizmu → pomiar na DEV; potem zamrożenie i bieg NEW-C, bez strojenia po nim.
- **Limit kosztu etapu:** 15,00 USD z nominalnie dostępnych 39,041924 USD (księga 29,500933 / pułap 68,542857 — ta sama
  księga `research/ai-assist/spend-ledger-v35417r3.json`, bez nowej puli); z tego ≥ 3,00 USD rezerwy na końcowy host.
  Plan: baseline NEW-B 3 × ≤ 0,45; iteracje DEV (głównie replay 0 USD, świeże recenzje) ≤ 4,00; NEW-C końcowy 3 × ≤ 0,45
  + baseline 3 × ≤ 0,45; host końcowy + kontrola ≤ 3,00. Każde żądanie rezerwuje najgorszy przypadek w księdze.
- **Stop bez celu:** wyczerpany limit iteracji albo kosztu, albo nazwana granica źródła/reprezentacji — wtedy wynik
  zostaje częściowy lub negatywny i tak jest raportowany; miernika nie podmieniam.

## 7. Poprawki reguły selekcji PRZED jakąkolwiek analizą (zapisane jawnie)

Pierwsze przejście selekcji na commicie zamrożenia `37ad17c` (tylko pobranie pakietów; `trial/selection-pass1.json`):

1. Pula ARCHON dała jako drugą rodzinę projekt garażu (strona nie publikuje powierzchni użytkowej). §1 mówi o projekcie
   DOMU, więc kandydat bez opublikowanej powierzchni użytkowej jest poza zakresem (kryterium z danych strony, nie z nazwy).
2. Klucz „rodzina widziana wcześniej" nie zdejmował tokenu wariantu ze środka nazwy (`agawa-iv-sp` przy widzianej `agawa`);
   teraz sprawdzany jest też rdzeń nazwy. W pierwszym przejściu nie zmieniło to wyniku (kandydat i tak odpadł na elewacjach).

Selekcja powtórzona z TYM SAMYM ziarnem (commit `37ad17c`). Żaden kandydat nie był analizowany ani oglądany jako model.
