# STAGE BUILDPLAN N8-03B / FIX-06B — Duże przeszklenia i otwory ogrodowe

Projekty:
- Dom w rarytasach 5 (G2E) — https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-5-g2e-m84f2903cb8e14
- Dom w goździkowcach 3 — https://www.archon.pl/projekty-domow/projekt-dom-w-gozdzikowcach-3-m79923e950094d

Baza: `2e14fec` (N8-03A, solver 2.13.0, czytnik metryk 1.4.0). Wynik: solver **2.14.0**, czytnik metryk **1.5.0**.
Gałąź `claude/new-session-3kzcgh`.

## Zgłoszenie i co pokazało porównanie z ARCHON

Porównanie rzutów parteru, opisów otworów (pierścienie szer./wys.) i elewacji ogrodowych z modelami 2.13.0.

**Rarytasy.** Szerokości i położenia wszystkich otworów ogrodowych były poprawne: 230, 150, 150 i 400 cm na
właściwych osiach, ±0,2 m względem elewacji. Błędne były rodzaje i wypełnienia:
- 230/230 (pokój 8) był oknem do posadzki z jedną taflą. Rzut rysuje skrzydło ≈0,8 m przy ościeżu wschodnim
  i doświetle, czyli drzwi tarasowe.
- Oba 150/230 (pokoje 7 i 6) miały jedno szklane skrzydło na całą szerokość. Rzut rysuje skrzydło ≈0,8 m
  i stałe doświetle.
- 400/230 jest poprawnie przeszkleniem wielopanelowym do posadzki, ale ma jedną taflę. Elewacja pokazuje dwie.

**Goździkowce.** Błędy w samej geometrii:
- 300/230 (salon) był oknem 2,97 × 1,30 na parapecie 0,90. Wysokość i parapet były założone, bo opis nie wszedł
  do modelu.
- 180/230 (pokój 6) był jednym skrzydłem. Rzut rysuje dwa łuki od obu ościeży, czyli drzwi dwuskrzydłowe.
- 100/150 (pom. 7) był drzwiami 0,99 × 2,10.

## FIRST_BAD — każdy błędny otwór osobno

Pełny łańcuch jest w `stage-reports/artifacts/analyzer-n8-03b/first-bad.json`, ślady w
`research/analyzer-n8-03b/steps.ts`.

| dom | otwór | ARCHON | 2.13.0 | gdzie pierwszy błąd | poprawione |
|---|---|---|---|---|---|
| Rarytasy | `rear-2-0` | 230/230, skrzydło + doświetle | WINDOW 2,30 × 2,30, 1 tafla | **rodzina** (`classifyOpeningFamily`): ≥ 2,0 m do posadzki to od razu MULTI_PANEL_GLAZING; skrzydła na rzucie nikt nie pytał, a `doorLeafFound` umie tylko łuk o promieniu całej przerwy | tak |
| Rarytasy | `rear-2-1`, `rear-2-2` | 150/230, skrzydło ≈0,8 + doświetle | GLAZED_DOOR, 1 skrzydło 1,50 | **odczyt skrzydła**: ten sam test łuku o promieniu przerwy; GLAZED_DOOR tylko z reguły szerokości | tak |
| Rarytasy | `rear-2-3` | 400/230, 2 tafle | WINDOW 4,00 × 2,30, 1 tafla | **podział tafli**: rzut nie rysuje słupka w przerwie; odczyt elewacji (1,00..2,05 m) odrzucony wobec opisu 2,30, bez słupków | **nie** (niżej) |
| Goździkowce | `rear-2-0` | 300/230 | WINDOW 2,97 × 1,30, parapet 0,90 | **czytnik metryk** (`extract.ts`): rozpoznawacz przeczytał 300 (p 0,998) i 230 (p 0,993, średnia 0,862 < 0,9); połówka wysokości odpadła na średniej, szablon dał szerokość 460 ≠ 300, więc jego wysokości też odpadły — pierścień nie został opublikowany. Elewacje tego domu nie są zarejestrowane (brak rzędnej kalenicy w przekroju), więc wysokości założono | tak |
| Goździkowce | `rear-2-1` | 180/230, 2 skrzydła | GLAZED_DOOR, 1 skrzydło 1,80 | **odczyt skrzydła** (jak w Rarytasach) | tak |
| Goździkowce | `rear-2-2` | 100/150, okno | DOOR 0,99 × 2,10 | czytnik: szerokość „10” (zgubiona cyfra), wysokość 150 odrzucona na średniej, szablon 616/400 (0,10) odrzucony; potem linie szklenia na rzucie mają jasność 211–216 przy progu `< 215`, więc „pusta przerwa na parterze = drzwi” | **nie** |
| Goździkowce | `west-3-0` (bok) | 200/230 | okno 1,97 × 1,30 na 0,90 | czytnik: linia odniesienia przecina pierścień, 4 glify na 3 cyfry — bramka słusznie odrzuca | **nie** |
| Goździkowce | `east-1-1` (bok, garaż) | 290/100 | okno 2,87 × 1,30 na 0,90 | czytnik: wysokość odczytana jako 700 (p 0,46) | **nie** |

**Przyczyny w obu domach są różne** i dostały dwie osobne poprawki:
- Rarytasy: odczyt symbolu drzwi na rzucie (reguła solvera).
- Goździkowce: połówka pierścienia gubiona przez czytnik (reguła czytnika), a do tego ta sama reguła skrzydeł dla
  180/230.

Żadna z poprawek nie zna nazwy domu.

## Poprawki (reguły ogólne)

### 1. Czytnik metryk 1.5.0: połówka pierścienia potwierdzona przez pierścień siostrzany

Pliki: `source-metrics/src/callout-recogniser.ts` (`corroborateHalfBySibling`), `extract.ts`.

Połówka przechodzi, gdy łącznie:
- druga połówka tego pierścienia przeszła bramkę samodzielnie;
- ta połówka odpadła **wyłącznie** na stabilności albo na średniej pewności znaków, a posterior ≥ 0,9, własna
  odpowiedź modelu, 2–3 cyfry, wszystkie glify przeczytane i zakres się zgadzają;
- inny pierścień tego samego arkusza ma tę samą połówkę (szerokość albo wysokość) przyjętą wprost, z tym samym
  tekstem.

Połówka podniesiona w ten sposób nie podnosi kolejnej. Bramka glifów, posteriora i zakresu się nie zmienia.
W Goździkowcach 300/230 dostaje wysokość od 180/230, którego 230 przeszło wprost. 200/230 zostaje nieodczytane,
bo 4 glify na 3 cyfry.

### 2. Solver 2.14.0: skrzydła krótsze niż przerwa

Pliki: `reconstruction/src/v2/openings-v2.ts` (`drawnLeaves`, `leafProbe`), `opening-reading.ts`, `emit.ts`
(`drawnLeafAssembly`).

- **Test skrzydła z łukiem** dla długości od 0,55 m do (szerokość − 0,25 m), przy każdym ościeżu i po każdej stronie
  muru. To ten sam test co w `doorLeafFound`: linia skrzydła, papier za końcem i obok, cienki tuszowany łuk.
  Oś skrzydła może leżeć przy licu albo w grubości muru. Wtedy za licem widać tylko promień minus głębokość osi.
- **Jedno skrzydło**: skrzydło + stałe doświetle. Długość to promień okręgu dopasowanego metodą najmniejszych
  kwadratów do tuszu łuku; musi mieścić się w przebiegu długości, które przeszły test.
- **Dwa skrzydła** po tej samej stronie, których przechodzące długości mogą się sumować do szerokości (±12 %):
  para skrzydeł. Łuki pary się stykają, więc okręgu nie dopasowuję.
- Wszystko inne nie jest odczytem: skrzydła po dwóch stronach, luka między skrzydłami, linia bez łuku.
- **Reguła rodziny**: na parterze otwór do posadzki szerszy niż jedne drzwi, z takimi skrzydłami, to GLAZED_DOOR
  (drzwi tarasowe), niezależnie od szerokości. Bez skrzydeł nic się nie zmienia.
- **Wypełnienie**: panele `LEAF` i `GLAZED` w kolejności od bliższego ościeża ściany, z udziałami z rysunku.
  Skrzydło ma zawias przy własnym ościeżu, a orientacja ściany jest uwzględniona.
- **Jeden otwór zostaje jednym otworem**: liczba szyb dzieli otwór, nie mnoży go.
- `doorLeafFound` (skrzydło na całą przerwę) działa bajt w bajt jak przedtem: refaktoryzacja do `leafProbe`
  z promieniem równym szerokości.

`SOLVER_V2_VERSION` 2.13.0 → 2.14.0, `METRIC_READER_VERSION` 1.4.0 → 1.5.0, oba z wpisem.

### Czego świadomie nie zrobiłem

- **Podział tafli przeszkleń wielopanelowych** (Rarytasy 400, Goździkowce 300: na elewacji po dwie tafle,
  w modelu jedna). Rzut nie rysuje słupków, a czytnik elewacji ich nie podaje. Sprawdziłem regułę „tafla ≤ X m” na
  elewacjach całego korpusu i nie trzyma się jednego progu: Cieszynianka 2,31 m to jedna tafla, Marcówki 4,70 m to
  dwie, Arganiach 3,28 m to dwie. Próg dobrany pod te elewacje byłby dopasowaniem do benchmarku.
- **100/150 w Goździkowcach** zostaje drzwiami. Naprawienie tego wymagałoby przesunięcia progu linii szklenia
  o 1–2 poziomy szarości albo przyjęcia szerokości ze zgubioną cyfrą. Jedno i drugie to strojenie pod ten arkusz.
- **200/230 i 290/100** (boki Goździkowców): bramka czytnika odrzuca je słusznie.
- **Rejestracja elewacji Goździkowców** (brak rzędnej kalenicy) to osobna przyczyna, poza zakresem.

## Wynik

| | PRZED (2.13.0) | PO (2.14.0) | ARCHON |
|---|---|---|---|
| Rarytasy `rear-2-0` | WINDOW 2,30 × 2,30, 1 tafla | **GLAZED_DOOR** 2,30 × 2,30: skrzydło 0,78 m + doświetle 1,52 m, do wewnątrz | 230/230, skrzydło ≈0,8 + doświetle |
| Rarytasy `rear-2-1` | 1 skrzydło 1,50 | skrzydło 0,81 m (ościeże wsch.) + doświetle 0,69 m | 150/230, skrzydło ≈0,8 wsch. |
| Rarytasy `rear-2-2` | 1 skrzydło 1,50 | skrzydło 0,79 m (ościeże zach.) + doświetle 0,71 m | 150/230, skrzydło ≈0,8 zach. |
| Rarytasy `rear-2-3` | 4,00 × 2,30, 1 tafla | bez zmian | 400/230, 2 tafle — **otwarte** |
| Goździkowce `rear-2-0` | okno 2,97 × 1,30, parapet 0,90 (założone) | **przeszklenie 3,00 × 2,30 od posadzki** (opis SOURCE_EXACT) | 300/230 |
| Goździkowce `rear-2-1` | 1 skrzydło 1,80 | **2 skrzydła** 0,88 + 0,92 m | 180/230, 2 skrzydła |
| Goździkowce `rear-2-2` | DOOR 0,99 × 2,10 | bez zmian | 100/150, okno — **otwarte** |

Wszystkie poprawione otwory:
- są fizycznie wycięte w murze: ledger pięciu stanów, promień przez środek otworu nie trafia w trójkąt ściany;
- mają wypełnienie odpowiadające rodzajowi.

| ledger (N8-03A) | zaobserwowane | wybrane | wyemitowane | wycięte | pominięte z powodem |
|---|---|---|---|---|---|
| Rarytasy PRZED / PO | 21 / 21 | 20 / 20 | 20 / 20 | 20 / 20 | 2 / 2 (bez zmian) |
| Goździkowce PRZED / PO | 28 / 28 | 28 / 28 | 28 / 28 | 28 / 28 | 3 / 3 (bez zmian) |
| A01 PRZED / PO | 21 / 21 | 21 / 21 | 21 / 21 | 21 / 21 | 0 / 0 |

Pełna tabela otworów ze źródłowymi opisami (21 wierszy: ogród, wejście, boki) jest w
`artifacts/analyzer-n8-03b/opening-table.md`.

Kompletność bez zmian: Rarytasy COMPLETE, Goździkowce i A01 COMPLETE_WITH_OPEN_QUESTIONS. Ściany, pomieszczenia,
dach i stropy obu domów są nietknięte; zmieniły się wyłącznie `openings`, `doors` i `windows`.

Modele:
- Rarytasy `9657ddad9448…` → `6a23ba6ee0fd…`;
- Goździkowce `1a96c20f088e…` → `f3a0ee783d3a…`.

## Regresja 8 domów

Wejścia zapieczętowane (pakiet źródłowy i graf obserwacji). Dowód metryczny **ponownie odczytany** tym checkoutem
(czytnik 1.5.0, rozpoznawacz), solver 2.14.0. Kontrola deterministyczności: ponowny odczyt Goździkowców checkoutem
N8-03A odtworzył zapieczętowany dowód (`c652969b…`) i model bajt w bajt.

| dom | model | dowód metryczny |
|---|---|---|
| Marcówki, Cieszynianka, Trytomach, Arganiach | **bajt w bajt** | bez zmian (poza wersją czytnika) |
| Sasanki 3 | **bajt w bajt** | +1 pierścień 120/140 (podniesiona wysokość), bez wpływu na model |
| Rarytasy | zmieniony (wyżej) | bez zmian |
| Goździkowce | zmieniony (wyżej) | +300/230; 110/220 na poddaszu podniesione, bez wpływu na model |
| A01 (Dom w jarzmiankach) | zmieniony: oba 180/220 (pokój 6 i zachodnia ściana pokoju 3) to teraz **drzwi dwuskrzydłowe**; rzut ARCHON rysuje przy każdym dwa łuki | bez zmian |

Bezpieczeństwo:
- dach krzyżowy Sasanek, poddasza Trytomach i Arganiach, ściany wspólne Sasanek, Marcówek i Rarytasów oraz brama
  i otwarty styk garażu Arganiach są nietknięte. Cztery z tych domów są bajt w bajt, a w Rarytasach ściany są
  identyczne;
- wszystkie 8 modeli: walidacja `ok`, **0 WALLS_OVERLAP**, 0 diagnostyk kompilatora, wszystkie otwory wycięte
  (`regression-8-houses.json`).

Walidacji `WALLS_OVERLAP` nie ruszałem.

## Testy (tylko celowane)

- nowy `reconstruction/test/glazing-leaves-n8-03b.test.ts` (16 testów). Na syntetycznym rzucie:
  - skrzydło z doświetlem, w tym z osią w murze;
  - skrzydło na zewnątrz;
  - para skrzydeł;
  - odmowy: luka, dwie strony, linia bez łuku, skrzydło na całą przerwę, samo szklenie;
  - reguła rodziny;
  - kolejność, zawiasy i udziały paneli;
- nowy `source-metrics/test/callout-half-sibling-n8-03b.test.ts` (6 testów):
  - podniesienie na średniej i na stabilności;
  - brak siostry, inna wartość, inna rola połówki;
  - odmowy: glif, posterior, pierścień bez żadnej połówki;
  - brak łańcucha podniesień;
- `opening-reading.test.ts`: fikstura symboli dostała `leaves`;
- 25 plików / 262 testy zielone. Objęte: otwory, drzwi, garaż, fasady, ściana wspólna, styk otwarty, poddasza,
  kalenica skrzydła, czytnik pierścieni, ekstrakcja. Dziennik: `artifacts/analyzer-n8-03b/tests.txt`;
- `tsc -p tsconfig.json` czysto;
- bez pełnego CI, bez APK, bez zmian systemu IU — zgodnie ze zleceniem.

## Materiały

- Prywatny ZIP `BuildPlan-N8-03B-Glazing-Rarytasy-Gozdzikowce-Before-After.zip`. Zawiera:
  - modele przed i po z hashami;
  - oryginalne obrazy ARCHON, wyłącznie w ZIP-ie;
  - 9 widoków review-shots przed i po dla Rarytasów, Goździkowców i A01;
  - plansze ARCHON / PRZED / PO dla elewacji ogrodowych i wejściowych;
  - zbliżenia przeszkleń;
  - tabelę otworów;
  - FIRST_BAD;
  - ledgery;
  - regresję 8 domów z modelami.
- W repozytorium:
  - ten raport;
  - `stage-reports/artifacts/analyzer-n8-03b/` (wyłącznie liczby i teksty);
  - narzędzie śladu `research/analyzer-n8-03b/steps.ts`.

Zielone testy i stan COMPLETE nie oznaczają, że przeszklenia są poprawne. Ocena należy do recenzenta: plansze
ARCHON / PRZED / PO są w ZIP-ie.
