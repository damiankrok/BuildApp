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
