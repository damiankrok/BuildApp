# ADR v3.54.12 — rozpoznawalna miniatura i dowód metryczny to dwa wyniki

Status: przyjęte w etapie v3.54.12 (narzędzia badawcze; kod produkcyjny bez zmian). Baza: `8119d85` (v3.54.11,
APK 1342).

## Kontekst

OWNER doprecyzował cel (prompt v3.54.12 §0): rozpoznawalna, spójna, docelowo interaktywna miniatura konkretnego domu,
bez wymogu fotograficznej ani milimetrowej zgodności. Przykład dopuszczalnego uproszczenia: brama garażowa Marcówek
zaczynająca się prawie na przedłużeniu krawędzi ściany. Zarazem podobny kolor i szerokość nie wystarczą przy
brakującym skrzydle, lustrzanym odbiciu albo innym dachu. Master Plan nie został dołączony do v3.54.12:
`docs/MASTER_PLAN.md` zostaje v3.54.11 (bez skracania katalogu §3), decyzja jest zapisana tutaj i w statusie.

## Decyzje

1. **Dwa wyniki.** `VISUAL_MINIATURE` (czy to rozpoznawalnie ten dom, spójny z czterech stron) i `METRIC_EVIDENCE`
   (które liczby są z druku/pomiaru, które proporcjonalnym przybliżeniem, które nieznane). Wynik wizualny nigdy nie
   ustawia EXACT/MEASURED ani `quantities-usable`, nie zamyka usterek metrycznych, a wartość wywnioskowana ze szkicu
   nie trafia do kosztów/ilości jako zmierzona. Kontroli jednostek, skali i geometrii użytkowej nie rozluźnia się.
2. **Karta tożsamości przed oceną.** Stały zestaw cech domu ze źródła (`research/source-to-model/v35412/
   identity-marcowki.json`: bryły, strona garażu, dach i kierunek kalenicy, ramy, loggie, duże przeszklenia, brama,
   pas, paleta, brak nowych dużych otworów), oceniany jako PRESERVED / APPROXIMATE / MISSING / CONTRADICTORY; mianownik
   się nie zmniejsza. Krytyczne: brak/odbicie skrzydła, zły dach, zanik ramy, nowe duże otwory bez źródła. Tolerancje
   są propozycją wykonawcy dobraną do wielkości i znaczenia elementu, nie wymaganiem OWNER-a.
3. **Historyczne scorery zostają diagnostyką** (16 cech v1/v1.1, 27 wierszy, punkty stref); ich dawnych wyników nie
   przepisuje się na sukces, a kilkanaście centymetrów w dopuszczalnym uproszczeniu nie jest krytyczną regresją.
4. **Szkic OWNER-a to wejście o niezmierzonej wierności**, nie wynik API: parowany z oryginałem po zawartości,
   rejestrowany na punktach budynku (podobieństwo i afiniczne, reszty na punkt, wykrycie odbicia i zmiany proporcji),
   podstawiany tylko w dwóch właściwych elewacjach (bieg MIESZANY), z osobnym cache. Brak pliku = brak biegu i nazwany
   brak, nigdy inny obraz pod tą nazwą.
5. **Nowe przetwarzanie i pilot domyślnie wyłączone.** Selektor nie przyjmuje zasady „szkic zawsze wygrywa”;
   kandydat o gorszej tożsamości nie zastępuje dobrej miniatury.

## Konsekwencje

Gotowe: karta, scorer (`visual-miniature.py`, self-test), parowanie (`match-picture.py`), rejestracja
(`register-sketch.py`), pakiet B/B1/B2 (`sketch-package.ts`), jeden przebieg (`run-sketch.sh`) i protokół
(`SKETCH_PROTOCOL.md`). Linia bazowa miniatury: LOCAL A, LOCAL oddany i H v3.54.11 — RECOGNISABLE 14/14; H v3.54.10 —
RECOGNISABLE z brakującym pasem; kontrola v3.54.11 z białym tłem — NOT_RECOGNISABLE (obie ramy). Eksperyment B czeka na
cztery pliki wejściowe OWNER-a, których nie było w sesji.

## Dopisek v3.54.12-REAL (po wyniku na rzeczywistych szkicach)

6. **Szkic jest kanałem klas wykończeń, nie źródłem geometrii.** Na Marcówkach szkice bez zmian pogorszyły LOCAL
   (inna proporcja pionu frontu → zgubiona loggia), a z poprawioną rejestracją dały tę samą tożsamość co oryginały
   i lepsze klasy materiału (strefy 14/14 vs 12/14). Kontrpróby: zmiana palety zmienia tylko materiały, brak ramy
   usuwa ramę. Dlatego automatyczny szkic, jeśli powstanie, wchodzi jako dodatkowa, zarejestrowana warstwa klas ze
   stałą paletą i bramkami (rejestracja, karta tożsamości, spójność czterech stron), a geometrię dalej czyta
   analizator z oryginału.
7. **Adaptery za flagą, domyślnie wyłączone.** `elevationVerticalFromDatums` (osobna skala pionu z kalenicy
   i terenu, gdy grunt mija o > 0,3 m; granica 15 %) i `upperStoreyFinishes` (wykończenia wnęk kondygnacji wyższych).
   Bez flag wynik jest bajt w bajt taki jak wcześniej. Włączenie domyślne wymaga osobnej decyzji (fałszywy ciemny pas
   na fotografii szczytu przy drugiej fladze).
8. **Czoło ściany jest hostem wykończenia** (`SurfaceRegion.face: START | END`, addytywnie); budowniczy H wykańcza
   tylko czoła odsłonięte, objęte strefą. Domyślne malowanie domów bez stref się nie zmienia.
9. **Domyślny model produktu pozostaje A**; B-both jest sceną eksperymentu w APK 1343. Automatyzacja szkiców jest
   propozycją z kosztem (SOURCE_TO_MODEL_V35412, rozdz. 14), nie zakupem ani zgodą.
