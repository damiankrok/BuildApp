# v3.54.19 — protokół zapisany przed jakimkolwiek biegiem (OWNER 2026-11-24, po audycie APK 1351)

**Cel OWNER-a:** z linku ma powstać rozpoznawalna, spójna miniatura: poprawna bryła zewnętrzna, dach, główne otwory
i ściany wewnętrzne zgodne z rzutem. Podział na piętra, semantyka pomieszczeń, wyposażenie i detale czekają. Poprawa
zewnętrza nie może po cichu usuwać dobrego wnętrza ani ważnych otworów. Wygląd miniatury i pewność wymiarów do ilości
to osobne wyniki.

## 1. Baseline

Kod analizy APK 1351: `58ff26a` (drzewo `9ac25b6`: późniejsze commity to sceny i dokumenty). Baseline biegnie z osobnego
drzewa roboczego tego commita, tym samym poleceniem i transportem co kod końcowy.

## 2. Zbiory

- **DEV:** dziewięć znanych domów (Alaska, Aurora, Ballina, Alberto, Medulin, Jeziorko, Mindelo, Sakura, G6 — G6 to garaż
  ze strychem, nie dom mieszkalny: służy mechanizmowi, nie liczy się do wyników „domów") oraz NEW-D po pierwszym pomiarze.
- **NEW-D (pierwszy pomiar, przed strojeniem):** pierwszy przyjęty kandydat każdej z czterech pul wydawców. Baseline
  biegnie na nich RAZ, zanim zmienię jakikolwiek kod analizy w tym etapie; pierwszy wynik zostaje wynikiem. Po obejrzeniu
  błędów dom jest rozwojowy.
- **NEW-E (odłożona):** drugi przyjęty kandydat każdej puli z tego samego przejścia. Teraz tylko pobranie pakietu
  (potrzebne regule przyjęcia). Żaden rysunek, model ani odczyt tych domów nie jest otwierany przed zamrożeniem kodu.
  Po zamrożeniu: baseline i kod końcowy na tych samych bajtach, każdy raz. Nic nie jest strojone po tym wyniku.

**Losowanie** (`trial/select.py`, reguła jak w v3.54.17/18): seed = sha256(`9ac25b6…:V35419-TRIAL:<wydawca>`), start =
seed mod rozmiar puli, przejście od startu, rodziny widziane wcześniej pomijane (`seen-families.txt` uzupełnione
o rodziny v3.54.18), najwyżej 14 otwartych na pulę. Przyjęcie tylko na pobranym pakiecie: rzut parteru, ≥ 3 podpisane
elewacje, **dom mieszkalny: opublikowana powierzchnia użytkowa ≥ 60 m² i nazwa bez „garaż"** (nowe w tym etapie: G6
przeszedł poprzednią regułę). Gdy pula nie daje dwóch przyjętych, brak jest zapisany, a zbiór jest mniejszy.

## 3. Co jest oceniane (cały wynik)

**E — zewnętrze:** kryterium „użytecznej miniatury" z `v35418/PROTOCOL.md` §3 bez zmian (cechy F/S/O/C/M spisane ze
źródeł przed obejrzeniem modelu; NEW-E po zamrożeniu kodu).

**W — wnętrze na rzucie:** ściany wewnętrzne finalnego modelu nałożone na rzut parteru wydawcy w tej samej skali
i orientacji (nakładka PNG z modelu i z transformacji obrysu; bez ręcznego dopasowania). Oceniający liczy na nakładce
ściany rysowane przez rzut (odcinki ≥ 1 m między pomieszczeniami): obecne na właściwym miejscu / brakujące, oraz ściany
modelu, których rzut nie rysuje (zmyślone). **Wnętrze zgodne**, gdy: obrys bryły modelu pokrywa się z obrysem rzutu
(uproszczenia nazwane), ≥ 70 % rysowanych ścian jest obecnych i zmyślonych jest ≤ 20 % ścian modelu. Model bez ścian
wewnętrznych = wnętrze puste = porażka W (nie „nieoceniane"). Liczba pomocnicza z kodu (udział długości ścian modelu
leżących na tuszu rzutu, udział tuszu ścian pokryty modelem) jest raportowana obok, nie zamiast oceny.

**Cały wynik domu:** E użyteczna ORAZ W zgodne. Brak modelu = porażka obu.

**Utraty:** każda cecha OK w baseline, która nie jest OK w kodzie końcowym (otwór, ściana, materiał, forma), jest
wypisana po imieniu, dom po domu. „W żadnym gorszy" nie zastępuje tej listy.

## 4. Kryterium z góry

Na NEW-E (najwyżej 4 domy mieszkalne): liczba domów z całym wynikiem (E i W) rośnie względem baseline o ≥ 2; żaden dom
nie traci cechy F ani ścian wewnętrznych, które baseline miał dobrze. Na NEW-D i DEV to samo jest raportowane jako wynik
rozwojowy (nie dowód transferu). Ślepa ocena X/Y na znanych domach nie zastępuje NEW-E.

## 5. Dyscyplina

- Jeden bieg na żywo na dom i stan kodu; powtórki z nagrań (0 USD). Nie ponawiam odczytów, aż API zaakceptuje dom.
- Żadnych reguł od nazw domów, żadnych ręcznych współrzędnych; środowisko wykonawcze nie czyta odpowiedzi benchmarku.
- Zmiana reguły odczytu jest najpierw sprawdzana na wszystkich nagranych domach DEV (regresje wypisane).
- Limit kosztu etapu: 14,00 USD z tej samej księgi (stan wejściowy 37,778557 / pułap 68,542857 USD; bez nowej puli).
- Timeout, słaby kandydat, błąd modułu = diagnoza, nie koniec rundy.

## 6. Wynik losowania i poprawka przed analizą (2026-11-24)

Pierwsze przejście: Studio Atrium → Aletta New, Amarylis; Lipińscy → Novara, Oban III; Dobre Domy → Jarzębina, Juliusz
Nowy; ARCHON → nic (pula tekstowa z poprzednich etapów jest wyczerpana wykluczeniami: otwarto 2, garaż i stronę bez
powierzchni użytkowej). **Poprawka zapisana przed jakąkolwiek analizą:** pula ARCHON została zastąpiona adresami
z publicznej mapy strony wydawcy (3288 adresów projektów; po odrzuceniu każdej strony, której nazwa zaczyna się od
rodziny widzianej wcześniej, oraz stron innych niż „projekt-dom-…"/„projekt-willa-…": 356 adresów,
`trial/archon-pool-2.txt`), to samo ziarno i ta sama reguła. Wynik (`trial/selection-archon.json`): 14 otwartych,
1 przyjęty — Willa Eliza 5 G2 (13 odrzuconych: strona nie publikuje powierzchni użytkowej w formie, którą czyta pakiet).

- **NEW-D (pierwszy pomiar):** Aletta New, Novara, Jarzębina, Willa Eliza 5 G2.
- **NEW-E (odłożona, nieotwierana do zamrożenia):** Amarylis, Oban III, Juliusz Nowy (pula ARCHON nie dała drugiego domu).

Cechy referencyjne NEW-D: `references/NEW-D.md` (spisane ze źródeł przed obejrzeniem modeli).
