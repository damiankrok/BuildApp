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

## 7. Zamrożenie kodu i odstępstwa (2026-11-24, zapisane przed otwarciem NEW-E)

- **Kod zamrożony:** `4c2c73e` (`packages/analysis-service/src` bez zmian w późniejszych commitach: te dodają testy,
  dokumenty i sceny). Ostatnia partia DEV + NEW-D na tym kodzie (odczyty elewacji nagrane, recenzja i małe odczyty kanału
  obrysu na żywo): `dev/a6` na hoście sesji.
- **Odstępstwo 1 (kolejność, bez otwierania):** biegi baseline NEW-E (drzewo `9ac25b6`) zostały uruchomione, zanim kod
  był zamrożony — baseline nie zależy od kodu końcowego. Katalogów wyników nie otwierano.
- **Odstępstwo 2 (kolejność, bez otwierania):** biegi NEW-E na kodzie-kandydacie `4c2c73e` uruchomiono równolegle
  z ostatnią partią DEV + NEW-D na tym samym commicie. Otwarte dopiero po sprawdzeniu, że partia nie wymaga zmiany kodu;
  gdyby wymagała, biegi NEW-E byłyby powtórzone na nowym zamrożeniu, a ten zapis by o tym mówił.
- **Kolejność otwierania NEW-E:** (1) eksport źródeł i spisanie `references/NEW-E.md` wyłącznie z rysunków wydawcy;
  (2) dopiero potem modele, nakładki i ocena. Po otwarciu nic w kodzie analizy nie jest zmieniane.
- **Jeden bieg na dom i stan kodu** — bez ponawiania, cokolwiek wyszło.

## 8. Pierwszy pomiar odłożony (NEW-E) i druga odłożona próba NEW-F (zapisane 2026-11-24, przed losowaniem NEW-F)

**Wynik NEW-E na zamrożeniu 1 (`4c2c73e`): 0 → 0 całych wyników. Cel z §4 NIE został osiągnięty.** Amarylis: bryła LOCAL
z płaskim dachem w obu wariantach; Oban III i Juliusz Nowy: brak modelu w obu wariantach. Ten wynik zostaje w raporcie
jako pierwszy pomiar transferu i nie jest zastępowany niczym, co powstało później.

Po otwarciu NEW-E jest zbiorem **rozwojowym**. Runda R2 naprawia trzy przyczyny ogólnie (szerokość budynku na elewacji,
skośny wykusz w obrysie, podział obrysu na bryły) i dwie znalezione przy tym (nadproże okna pod okapem, wymiar
drukowany a obrys z pominiętymi małymi uskokami). Poprawa na NEW-E po R2 jest wynikiem rozwojowym, nie transferem.

**NEW-F (nowa odłożona próba, jedyny dowód transferu R2):**

- Losowanie tym samym `trial/select.py`, tym samym commitem bazowym `9ac25b6…`, etykietą ziarna `V35419-NEWF`
  (`TRIAL_LABEL`), **jeden** przyjęty dom na pulę (`TRIAL_WANT=1`): Studio Atrium, Lipińscy, Dobre Domy oraz ARCHON
  (pula `archon-pool-2.txt`; jeżeli 14 otwarć nie da domu, brak zostaje zapisany). Rodziny otwarte w pierwszym
  przejściu tego etapu (24) zostały dopisane do `seen-families.txt` przed losowaniem. Reguła przyjęcia bez zmian.
- **Zamrożenie 2** = commit, na którym regresja DEV + NEW-D (powtórka nagrań, 0 USD) nie pokaże pogorszenia; jego skrót
  jest dopisywany niżej **przed** pierwszym biegiem NEW-F. Do tego czasu z NEW-F pobierany jest tylko pakiet (wymaga go
  reguła przyjęcia); żaden rysunek, model ani odczyt nie jest otwierany.
- Po zamrożeniu 2: baseline (`9ac25b6`) i kod zamrożony na tych samych bajtach, każdy **raz**. Cechy referencyjne
  (`references/NEW-F.md`) spisane ze źródeł przed otwarciem modeli. **Nic nie jest strojone po wyniku NEW-F**; jeżeli
  wynik jest słaby, jest raportowany jako słaby, a poprawki należą do następnego etapu.
- Miara ta sama (§3): cały wynik = zewnętrze użyteczne ORAZ wnętrze zgodne z rzutem. Próba ma najwyżej 4 domy, więc
  wynik jest liczbą domów, nie odsetkiem; cel z §4 (≥ +2 całe wyniki, bez pogorszeń) stosuje się do niej bez zmian.

### 8.1 Losowanie NEW-F i zamrożenie 2 (zapisane przed pierwszym biegiem NEW-F, 2026-11-24)

- **NEW-F** (`trial/selection-newf.json`; w każdej puli przyjęty został pierwszy otwarty kandydat): Studio Atrium →
  **Ametyst New**; Lipińscy → **Skagen**; Dobre Domy → **Fabia**; ARCHON → **Dom pod pomarańczą 2**. Cztery domy.
- **Regresja DEV + NEW-D na `af7db0e`** (powtórka nagrań, 0 USD, `dev/a7` wobec biegu końcowego zamrożenia 1 `dev/a6`):
  9 z 13 modeli bez zmiany liczby ścian, otworów i dachów; Aletta New +3 otwory (okna szczytów przycięte do okapu),
  Novara +1; Alberto, Sakura i G6 po −1 otworze, każdy z nich to otwór z przerwy rzutu (`op-plan-…`), którego odczyt
  w tej powtórce nie był odtwarzany (bieg `a6` czytał go na żywo) — nie zmiana kodu; Willa Eliza: inny podział bryły
  (3 korpusy zamiast 2), w obu wariantach nadal niezgodna ze źródłem. Pogorszenia wynikającego z kodu nie znalazłem.
- **Zamrożenie 2 = `af7db0e`** (kod analizy; późniejsze commity do końca etapu zmieniają tylko dokumenty i narzędzia
  dostawy — gdyby było inaczej, ten zapis by o tym mówił).
- Kolejność: baseline (`9ac25b6`) i zamrożenie 2 uruchamiane równolegle, każdy raz; potem eksport źródeł,
  `references/NEW-F.md` z samych rysunków wydawcy, dopiero wtedy otwarcie modeli.
