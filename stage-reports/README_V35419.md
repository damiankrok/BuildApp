# v3.54.19 — krótko dla OWNER-a

Pełny raport: `stage-reports/SOURCE_TO_MODEL_V35419.md`. Decyzje: `docs/ADR-V35419-PLAN-SKELETON.md`. Co obiecano przed
biegami: `research/source-to-model/v35419/PROTOCOL.md`.

<!-- HEADLINE -->

## Co było nie tak (potwierdzone w kodzie, nie tylko w audycie)

1. **Wnętrze należało do budowniczego bryły.** Gdy źródła obalały bryłę LOCAL i wygrywała bryła zbudowana z obrysu
   i elewacji, model zaczynał od zera — bez ani jednej ściany wewnętrznej. Lepsze zewnętrze kosztowało całe wnętrze.
2. **Przeszklenie ścienne (`GLAZED_WALL`) z odczytu API nie miało odbiorcy** — trafiało do „pominiętych".
3. **Drzwi przegrywały z kontrastem.** Bramka mierzyła różnicę jasności na elewacji; drzwi w kolorze ściany dawały
   „brak dowodu", traktowany jak „dowód braku" — mimo że rzut rysuje w tym miejscu otwór.
4. **Bryła znała prostokąt, L i dwa korpusy w linii.** Każdy inny obrys kończył się brakiem modelu.
5. **Forma domu nigdy nie była pytaniem zadanym obrazom jako całości.** Rodzaj dachu, kierunek kalenicy, liczba brył
   wynikały z sylwetek czytanych elewacja po elewacji — i tu informacja ginęła (Pana wskazówka o opisach JSON).

## Co zmieniłem

- **Szkielet rzutu** (bez kosztu API): arkusz rzutu jest czytany wprost — kolor ścian tego arkusza, ściany działowe,
  drzwi wewnętrzne, przerwy w ścianach zewnętrznych — i wbudowywany w tę bryłę, która wygrała. Meble narysowane
  w kolorze ścian (łóżko, szafka, zderzak auta) są odrzucane po kształcie.
- **Rzut jest świadkiem otworów**: drzwi stojące na przerwie narysowanej przez rzut przechodzą niezależnie od kontrastu;
  przerwa rzutu bez otworu w modelu jest uzupełniana z drugiego odczytu elewacji — **listy JSON w metrach**.
- **Typowany opis JSON formy domu** (jedno tanie żądanie, wszystkie elewacje) jest świadkiem przy wyborze bryły.
- **Bryła**: dowolny obrys prostokątny w rzucie (do 4 korpusów), podział dom/garaż na ścianie z rzutu, wysokość budynku
  ze strony rozstrzyga, czy elewacje są obrócone o 90°, obrys na zewnętrznej linii ścian tam, gdzie każą wymiary drukowane.
- **Ślad**: identyfikatory nie zmieniają się przy ponownym nałożeniu poprawek; każdy element, o którym ślad mówi
  „zbudowany", jest sprawdzany w modelu oddanym.

## Szkic czy JSON? (Pana pytanie)

Zmierzyłem oba, nie zakładając odpowiedzi:

<!-- JSONVSSKETCH -->

## Wynik

<!-- RESULT -->

## Co nadal zawodzi

<!-- FAILS -->

## Co zostało utracone

<!-- LOST -->

## APK i paczki

<!-- APK -->
