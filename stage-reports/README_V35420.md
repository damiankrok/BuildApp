# v3.54.20 — krótko dla OWNER-a

Pełny raport: `stage-reports/SOURCE_TO_MODEL_V35420.md`. Decyzje: `docs/ADR-V35420-STRUCTURE-CONTRACT.md`. Co obiecano
przed biegami i co zmieniałem po drodze: `research/source-to-model/v35420/PROTOCOL.md`. APK: 1353.

**Najkrócej.** Opis struktury z API (kondygnacje, rodzaj dachu, kalenica, bryły, strony elewacji) ma teraz drogę do
geometrii: jest uzgadniany z rzutem, stroną i szkicami, a to, co uzgodnione, buduje solver i egzekwuje arbitraż — także
gdy bryła LOCAL jest błędna. Na czterech nowych domach: cały wynik 1 → 2, zewnętrze 1 → 2, wnętrze 2 → 3, nic się nie
pogorszyło; jedno z czterech oczekiwań zapisanych z góry **nie jest spełnione**. Na 20 znanych domach forma zgodna
13 → 18, ale ocena ślepa nie widzi ogólnej poprawy wyglądu (6 lepiej, 7 gorzej, 7 remis) i **są regresy, których nie
naprawiłem**.

## Co działa (przykłady)

- **Skagen**: strona publikuje rzut piętra i „30°", przekrój +8,77 → odczyt: dwie kondygnacje, garaż po prawej → model:
  ściany 5,71 m (było 3,06), dach 30°, osobna bryła garażu 3,57 × 7,09 m, 16 otworów (było 9), wnętrze 5 ścian (było 0).
  To samo na żywo przez host na finalnej rewizji.
- **Fabia**: żadna z czterech elewacji nie rysuje szczytu → dach czterospadowy (był dwuspadowy), otwory 4 → 11.
- **Amber IV (nowy dom)**: odczyt: skrzydło z tyłu z kalenicą poprzeczną → bryła frontowa 11,55 × 8,23 m i skrzydło
  8,61 × 4,19 m (rzut drukuje 11,55 / 8,55 / 4,10); w 1352 bryła była obrócona. Trzy niezależne biegi dają to samo.
- **Błędny opis, poprawny model**: Juliusz — odczyt mówi „dach czterospadowy", szkice rysują ściany szczytowe →
  własność sporna, nie buduje.
- **Kontrola**: każdy otwór jest po budowie mierzony w układzie swojej ściany (od narożnika + szerokość + do narożnika
  = długość ściany, parapet od podłogi kondygnacji, strona widziana z zewnątrz): 220 związanych otworów, 0 różnic,
  0 błędów sumy.

## Co się nie udało albo pogorszyło

- **Ametyst New: bryła obrócona** (front na dłuższym boku) — regres tego etapu.
- **Amarylis: utracony szczyt frontowy** (otwory 5 → 10 z dawnych 17).
- G6: 3 otwory zamiast 5; Aletta: zbyt płaski dach garażu; Alberto, Juliusz, Jarzębina: nadliczbowy komin; Medulin:
  obrys uproszczony do prostokąta.
- Rockville (nowy): wnętrze jest, ale brak drzwi wejściowych i poprzecznych szczytów. Basia i Adam (nowy): jedno długie
  pudło — wydawca publikuje jako elewacje widoki perspektywiczne, z których nie wyprowadzam metrów.
- Wnęki, podcienie, lukarny, balkony, podbitka, skośne otwory, poziomy pięter: nazwane, **niezbudowane**.
- Dwa razy poprawiałem kod po pierwszym zamrożeniu (opis w protokole §7–8). Modele nowych domów są identyczne co do
  bajta z pierwszym biegiem odłożonym.
- **APK nie był uruchomiony na urządzeniu** (brak telefonu i emulatora w sesji).

## Liczby

| | 1352 | 1353 |
|---|---|---|
| NEW-G (4 nowe domy): cały wynik / zewnętrze / wnętrze | 1 / 1 / 2 | 2 / 2 / 3 |
| DEV (20 domów): forma zgodna w czterech faktach | 13 | 18 |
| DEV: cały wynik / zewnętrze / wnętrze | 8 / 8 / 18 | 9 / 9 / 19 |
| DEV: bliżej źródła | 7 | 6 (remis 7) |

Koszt etapu: 6,611434 USD (plan ≤ 9); księga 56,290453 z 68,542857 USD, nominalnie zostało 12,252404 USD.

## Pliki

- `BuildPlan-Model-Preview-1353-arm64-v8a.apk` — osobno.
- Archiwa `BuildPlan-V35420-*.zip` (prywatne, każde < 30 000 000 B): `01-RAPORT-GALERIA` (raport, galeria offline,
  tablice porównawcze, host, tabele), `02-OCENA-SLEPA-PLANSZE` (plansze, klucze, wyniki), `03…` domy (oryginały, szkice
  PNG/SVG/JSON, surowe odpowiedzi, modele wszystkich wariantów, rendery, nakładki na rzut). Po rozpakowaniu wszystkich
  do jednego katalogu powstaje drzewo `BuildPlan-V35420/`; galerię otwiera `gallery.html`.

## Co dalej (moja rekomendacja)

1. Spójność skali między elewacjami jako bramka hipotezy bryły (naprawia Ametyst).
2. Wnęki i podcienie jako cecha obrysu z konsumentem (najczęstszy powód „bryła dobra, dom nieużyteczny").
3. Poprzeczne szczyty jako element dachu bryły (Amarylis, Juliusz, Rockville).
4. Drzwi wejściowe z rzutu i elewacji przed bramką kontrastu.
