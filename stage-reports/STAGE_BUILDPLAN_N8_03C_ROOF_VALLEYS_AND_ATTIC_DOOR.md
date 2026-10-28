# STAGE BUILDPLAN N8-03C — Sasanki 3: kosze dachowe i drzwi poddasza

Projekt: Dom w sasankach 3 (G) — https://www.archon.pl/projekty-domow/projekt-dom-w-sasankach-3-g-mb292397cb1840

Baza: `842cbf9` (N8-03B, solver 2.14.0). Wynik: solver **2.15.0**. Czytnik metryk bez zmian (1.5.0).
Gałąź `claude/new-session-3kzcgh`.

## Problem

- Dach krzyżowy z N8-01 wyglądał z zewnątrz poprawnie.
- Fizycznie dach główny nie był przecięty z dachem skrzydła:
  - jego połać wschodnia biegła w całości pod połaciami skrzydła, wewnątrz poddasza skrzydła;
  - powstał drugi dach w środku domu.
- Ściana wspólna poddasza (dom / skrzydło) była ścięta do spodu tej ukrytej połaci: około 1,65 m przy drzwiach.
- Drzwi z holu 2 do pokoju 8 (0,94 m, skrzydło narysowane na rzucie) solver odczytał, ale odrzucił.

## FIRST_BAD — od źródła do kompilatora

| # | Etap | Źródło / stan | Pierwszy błąd? |
|---|---|---|---|
| 1 | Elewacje ARCHON (ogrodowa i frontowa) | Szczyt skrzydła wchodzi w połać główną.<br>Kalenica skrzydła dochodzi do kalenicy głównej.<br>Okapy skrzydła są niżej, więc widać dwa kosze. | nie |
| 2 | Przekrój ARCHON | Kalenica +8,52, kąt 45°. | nie |
| 3 | Rzut poddasza ARCHON | Drzwi z holu 2 do pokoju 8 w ścianie między domem a skrzydłem, z łukiem. | nie |
| 4 | Hipoteza połaci (`attachedGableLayout`, N8-01) | Dwie połacie skrzydła dochodzą do linii przecięcia z połacią główną.<br>Kosze od (7,75; 1,30) i (7,75; 9,05) schodzą się na kalenicy głównej w (3,875; 5,175). | nie, kosze są poprawne |
| 5 | Dach główny | Wynik 2.14.0: `createRoof GABLE roof-main` na całym obrysie 7,75 × 10,45.<br>Dach legacy przyjmuje tylko prostokątne otwory, więc trójkąta pod skrzydłem nie da się z niego wyciąć.<br>Między koszami połać główna (15,6 m²) stoi pod połaciami skrzydła. | **TAK, FIRST_BAD** |
| 6 | Góra ścian | Ściany domu na poddaszu, w tym ściana wspólna i ścianki działowe pod skrzydłem, dostają `FOLLOW_ROOF roof-main`.<br>Kompilator ścina je więc do spodu ukrytej połaci: 1,65 m przy drzwiach. | skutek #5 |
| 7 | Bramka drzwi w ścianie wspólnej (`reconstruct-v2.ts`) | Liczy wysokość ściany wyłącznie od połaci głównej.<br>Działa **przed** wyznaczeniem dachu skrzydła, więc z konieczności nie widziała, co naprawdę leży nad ścianą.<br>Wynik: 1,64 m < 2,10 m, odrzucone. | drugi błąd, kolejność |
| 8 | Kompilator BuildWorld | „geometry ok”, 22/22 otworów wyciętych.<br>Prawda formalna: brakujących drzwi nie było w modelu, a płyta dachu w płycie nie jest błędem walidacji. | „geometry ok” ≠ poprawna geometria |

Tę samą przyczynę ma Rarytasy 5 (G2E): dach garażu wchodzi koszami w połać frontową, a pod nim leżało 11,45 m²
ukrytej połaci głównej. Reguła jest ogólna, więc objęła oba domy. W korpusie tylko te dwa mają skrzydło łączone
koszami.

## Poprawka (reguły ogólne)

1. **Dach główny jako połacie, wycięty po koszach skrzydła** (`v2/valley-cut.ts`, `emit.ts`).
   - **Kiedy:** skrzydło łączy się z dachem głównym przez kosze (`join VALLEY`).
   - **Kształt:**
     - gable jest emitowany jako połacie: dwie połacie z tymi samymi wierzchami co legacy (`eaveY + (halfSpan − |u − kalenica|)·tan`);
     - połać, po której biegnie skrzydło, jest obcięta trójkątem kosz – wierzchołek – kosz;
     - wierzchołek na kalenicy dzieli połać na dwie części, wierzchołek na połaci daje jedną połać z wcięciem.
   - **Krawędzie:**
     - RIDGE między połaciami;
     - dwa **VALLEY** między połacią główną a połaciami skrzydła, z jawnym odcinkiem, bo połać skrzydła przylega też do ściany pod okapem;
     - EAVE i VERGE.
   - **Źródło liczb:** współrzędne koszy pochodzą z układu skrzydła. Nic nie jest mierzone na nowo ani utrzymywane drugi raz.
   - **Odmowa (gable zostaje cały, z nazwanym powodem), gdy:**
     - okap ma nawis;
     - gable ma elementy krawędziowe;
     - kosz nie zaczyna się na okapie albo nie kończy na połaci;
     - wcięcia na siebie nachodzą;
     - wierzchy obu połaci rozjeżdżają się na końcu kosza o więcej niż 1 cm. Tolerancja okapu w `attachedGableLayout` (≤ 0,25 m) dopuszcza takie kosze, a walidator słusznie odrzuciłby wtedy VALLEY.
2. **Ściany pod dachem głównym.**
   - `FOLLOW_ROOF_PLANES` na połaciach głównych, ustawiane przez `setProperty` z walidacją schematu.
   - Ściana, której oś przechodzi przez wnętrze wcięcia, umiera w połaciach skrzydła.
   - Ściany nie są podnoszone sztucznie: każda kończy się pod dachem, który rzeczywiście nad nią stoi.
   - Ściana poza wcięciem, np. wschodnia przy okapie, ma góry bez zmian: 1,46–1,87 m.
3. **Drzwi w ścianie wspólnej decydowane wobec dachu, jaki powstanie** (`reconstruct-v2.ts`).
   - Drzwi, dla których połać główna była za niska, czekają na wyznaczenie dachów.
   - Potem sprawdzam spód rzeczywistego dachu (ta sama funkcja co w emisji) w 11 punktach na obu licach ściany wzdłuż drzwi.
   - Wymiary drzwi są bez zmian (odczyt rzutu 0,94 m, wysokość jak dotąd 2,10 m).
   - Gdy dachu jest za mało, drzwi są nadal odrzucane, z nazwaniem przyczyny.
4. Okna dachowe i kominy na dachu głównym trafiają do połaci, która je mieści, z cięciem pionowym. Połać przyjmuje
   tylko takie, tak samo jak okno dachowe skrzydła.

Renderer bez zmian. W rendererze nic nie jest ukrywane.

Wersja `SOLVER_V2_VERSION` 2.14.0 → 2.15.0, z wpisem w changelogu.

## Wynik — pomiar na skompilowanej geometrii

Narzędzie: `research/analyzer-n8-03c/roof-probe.ts`. Mierzy:
- promienie pionowe przez płyty dachu (siatka 0,1 m);
- wierzchy obu stron każdej krawędzi;
- górę ścian z trójkątów;
- promień przez środek każdego otworu.

| | PRZED (2.14.0) | PO (2.15.0) |
|---|---|---|
| Sasanki: dach podwójny (płyta w płycie) | **15,60 m²** | **0** |
| Sasanki: dach główny | legacy GABLE, cały | 3 połacie (zachodnia; wschodnia w 2 częściach) |
| Sasanki: kosze w modelu | 0 krawędzi | 2 × VALLEY; wierzchy obu stron zgodne do 0,014 m (rozdzielczość próbkowania ±2 cm przy 45°) |
| Sasanki: ściana wspólna poddasza przy drzwiach (z 5,4..6,8) | 1,65–1,87 m | 3,82–5,07 m, pod połacią skrzydła |
| Sasanki: drzwi hol 2 → pokój 8 | odczytane, odrzucone | **wycięte 0,94 × 2,10**; nad drzwiami 3,95 m ściany |
| Sasanki: otwory wycięte | 22/22 | **23/23** |
| Sasanki: ściana wschodnia poza wcięciem | 1,46–1,87 m | 1,46–1,87 m (bez zmian) |
| Rarytasy: dach podwójny | 11,45 m² | 0 |
| Rarytasy: ściana wspólna dom / garaż | góra 3,03–3,18 m (ścięta ukrytą połacią) | 3,21–4,87 m, pod dachem garażu nad nią |
| Rarytasy: otwory wycięte | 20/20 | 20/20 |

Z zewnątrz oba dachy wyglądają tak samo jak przed zmianą (9 kamer review-shots). Różnicę widać bez dachu i
w zbliżeniach diagnostycznych:
- PRZED pod połaciami skrzydła leży cała połać główna;
- PO jest wcięcie, a ściana wspólna wznosi się pod dach skrzydła z wyciętymi drzwiami.

## Ochrona wcześniej naprawionych elementów Sasanek

- **Dach krzyżowy (N8-01):**
  - połacie skrzydła, kalenica, okapy i kosze bez zmian, bajt w bajt w `roofPlanes` skrzydła;
  - dach główny ma te same wierzchy co legacy, co sprawdza test płaszczyzny.
- **Ściana wspólna (N8-02B):** to samo pasmo 0,234 m, to samo położenie. Zmieniła się wyłącznie góra, teraz pod
  rzeczywistym dachem.
- **Okna dachowe:**
  - obrys na wierzchu połaci identyczny;
  - cięcie zmienione z prostopadłego do połaci na pionowe (ograniczenie połaci w kompilatorze, jak dla okna
    skrzydła). Odnotowane jako zmiana szczegółu.

## Regresja 8 domów

Wejścia: zapieczętowany dowód metryczny N8-03B.

| dom | wynik |
|---|---|
| A01, Goździkowce, Marcówki, Cieszynianka, Trytomach, Arganiach | **bajt w bajt** |
| Sasanki 3 | zmienione: dach, ściany (góry), relacje, otwory (+1 drzwi) |
| Rarytasy 5 | zmienione: dach, góry ścian, relacje. Położenie i grubość wszystkich ścian bez zmian, otwory bez zmian. Okna i drzwi tarasowe z N8-03B nietknięte. |

Wszystkie 8 modeli:
- walidacja `ok`;
- **0 WALLS_OVERLAP**;
- 0 diagnostyk kompilatora;
- wszystkie otwory wycięte (`regression-8-houses.json`).

Bez zmian pozostały:
- poddasza Trytomach i Arganiach;
- brama i otwarty styk Arganiach;
- ściany wspólne Marcówek.

Walidacji nie osłabiałem.

## Testy (tylko celowane)

- Nowy `reconstruction/test/valley-cut-n8-03c.test.ts` (14 testów). Sprawdza:
  - kosze na kalenicy: dwie części połaci;
  - kosze na połaci: jedno wcięcie;
  - wierzchy jak legacy;
  - odmowy: nawis, elementy krawędziowe, brak kosza, kosz, którego końce się nie spotykają;
  - spód zbudowanego dachu;
  - przez emiter, komendy i kompilator: brak błędów, brak dachu w dachu i brak dziur, dwie krawędzie VALLEY,
    ściana pod wcięciem pod połaciami skrzydła, ściana poza nim tylko pod połaciami głównymi, nawis → gable cały.
- 19 plików / 209 testów zielone: dachy, okna dachowe, skrzydła, ściana wspólna, styk otwarty, poddasza, otwory.
  Dziennik: `artifacts/analyzer-n8-03c/tests.txt`.
- `tsc` czysto.
- Bez pełnego CI i bez APK, zgodnie ze zleceniem.

## Co jest nadal niepewne

- Okna dachowe na połaci głównej są cięte pionowo zamiast prostopadle do połaci. Kompilator połaci nie zna cięcia
  prostopadłego.
- Dach główny z nawisem albo z deskami czołowymi nadal nie jest cięty przy koszach. Odmowa jest nazwana w notatkach
  emisji. W korpusie żaden taki dom nie ma skrzydła z koszami.
- Wysokość drzwi poddasza 2,10 m to dotychczasowa konwencja, nie odczyt. Szerokość pochodzi z rzutu.

## Materiały

- Prywatny ZIP `BuildPlan-N8-03C-Sasanki-Roof-Valleys-Attic-Door-Before-After.zip`. Zawiera:
  - modele przed i po (Sasanki, Rarytasy);
  - 9 widoków review-shots przed i po;
  - planszę ARCHON / PRZED / PO;
  - zbliżenia koszy, przestrzeni pod dachem skrzydła i drzwi poddasza;
  - tabelę pomiarów;
  - oryginalne obrazy ARCHON, wyłącznie w ZIP-ie;
  - regresję 8 domów.
- W repozytorium:
  - ten raport;
  - `stage-reports/artifacts/analyzer-n8-03c/` (wyłącznie liczby i teksty);
  - sonda `research/analyzer-n8-03c/roof-probe.ts`.

Zielone testy i „geometry ok” nie oznaczają, że dach jest poprawny. Ocena należy do recenzenta.
