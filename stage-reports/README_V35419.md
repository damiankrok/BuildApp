# v3.54.19 — krótko dla OWNER-a

Pełny raport: `stage-reports/SOURCE_TO_MODEL_V35419.md`. Decyzje: `docs/ADR-V35419-PLAN-SKELETON.md`. Co obiecano przed
biegami: `research/source-to-model/v35419/PROTOCOL.md`.

**Najkrócej:** cel, który sam zapisałem przed biegami (+2 „całe wyniki" na nowych, odłożonych domach), **nie został
osiągnięty** — ani na pierwszej próbie odłożonej (0 → 0), ani na drugiej po rundzie poprawek (0 → 1, i ten jeden zysk
jest kruchy). Na nowe projekty przenosi się **wnętrze z rzutu**; **bryła i dach — nie**. Na wszystkich 20 domach cały
wynik to 2 → 9, ale większość tego zysku jest na domach, na których wolno było stroić.

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

- **Otwory** (11 elewacji, miarą są przerwy narysowane na rzucie): szkic kolorowy trafia 38 z 42, lista JSON w metrach
  40 z 42 (dwa warianty polecenia, ten sam wynik). JSON jest odrobinę lepszy i tańszy w użyciu, ale nie zastępuje
  szkicu: szkic niesie też dach, kominy, materiały i jest czytelny dla człowieka. W kodzie: szkic zostaje pierwszym
  odczytem, lista JSON uzupełnia przerwy rzutu, których szkic nie pokrył.
- **Forma domu** (13 domów): rodzaj dachu i kierunek kalenicy z jednego typowanego opisu JSON są poprawne w 13 z 13;
  ścieżka przez sylwetki ze szkiców myli się w 4. To jest najmocniejszy wynik etapu — i **nie został jeszcze w pełni
  wykorzystany**: opis formy jest dziś tylko świadkiem przy wyborze między dwiema gotowymi bryłami, a nie wejściem
  budowy. Porażki na nowych domach (dach czterospadowy zbudowany jako dwuspadowy, piętro jako parter) to dokładnie ten
  brak.

## Wynik

Ocena ślepa (oceniający nie wie, który wariant jest nowszy), osobno zewnętrze i wnętrze na rzucie:

| Zbiór | Domów | Zewnętrze użyteczne | Wnętrze zgodne z rzutem | Cały wynik |
|---|---|---|---|---|
| DEV (9 znanych — tu wolno było stroić) | 9 | 5 → 6 | 4 → 9 | 1 → 6 |
| NEW-D (nowe, potem rozwojowe) | 4 | 1 → 1 | 1 → 4 | 1 → 1 |
| NEW-E (odłożone; po otwarciu rozwojowe) | 3 | 0 → 1 | 0 → 2 | 0 → 1 (na pierwszym pomiarze 0 → 0) |
| **NEW-F (odłożone, jedyny dowód transferu po poprawkach)** | 4 | 0 → 1 | 1 → 3 | **0 → 1** |

Bliżej źródła jako całość: kod końcowy w 15 domach, 1351 w 2, remis w 3. Dwa domy, które w 1351 nie dawały żadnego
modelu (Oban III, Juliusz Nowy), i jeden z płaskim pudełkiem (Amarylis) mają teraz bryłę z dachem i wnętrzem.

## Co nadal zawodzi

- **Rodzaj dachu i liczba kondygnacji** są wyprowadzane z sylwetek elewacji: Fabia (czterospadowy → dwuspadowy), Skagen
  (piętro z garażem → parter ze stromym dachem), Willa Eliza.
- **Medulin i Mindelo** bez zmiany: bryła z płaskimi przybudówkami.
- **Okna o słabym kontraście** (Juliusz Nowy: 4 otwory zewnętrzne) i **otwory na bryłach z kilku korpusów** (Amarylis).
- **Wnęki, podcienie, wykusze, lukarny** nie istnieją w bryle.
- **Rzut nieczytelny dla szkieletu** w jednym z czterech nowych domów (Skagen: wnętrze puste).
- **Recenzja jest zmienna**: ten sam model w dwóch biegach dostaje inne wykończenia i inny werdykt.

## Co zostało utracone

- **Novara**: w ocenie ślepej przestała być „użyteczna" (brak wnęki wejściowej po zastąpieniu trzech pudełek jedną
  bryłą), choć oceniona jako bliższa źródłu.
- **Amarylis**: 17 → 5 otworów zewnętrznych (tył i boki ślepe).
- **Ametyst New, Fabia**: komin 1 → 0.
- **Medulin, Domek nad jeziorkiem**: ocenione bliżej źródła w wariancie 1351 (kominy-słupki; brak panelu na ścianie).
- Żaden dom nie stracił ścian wewnętrznych ani modelu, który miał.

## APK i paczki

- **APK 1352** (`BuildPlan-Model-Preview-1352-arm64-v8a.apk`, 54 009 346 B, ten sam podpis co 1349–1351): 22 nowe sceny
  jako pierwsze — NEW-F, NEW-E, NEW-D, dziewięć znanych domów, dwa modele oddane przez host. **Nie był uruchamiany na
  telefonie** (w sesji nie ma urządzenia); obrazy w raporcie to rendery z komputera.
- **Host** zbudowany z finalnej rewizji przeszedł sprawdzenie end-to-end (53 kontrole): Alberto, Oban III, powtórka bez
  kosztu.
- **Budżet**: 49,679019 z 68,542857 USD; ten etap 11,90 USD. Bez nowej puli, bez otwartych rezerwacji.
- **Paczki**: lista, rozmiary i sumy w `stage-reports/artifacts/v35419/DELIVERY.txt`.
