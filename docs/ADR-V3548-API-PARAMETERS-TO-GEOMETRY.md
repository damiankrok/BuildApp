# ADR v3.54.8 — parametry odczytu API do finalnej geometrii

Status: przyjęte (v3.54.8, `86fd69f`, `05faa4e`). Kontekst: v3.54.7 zbudował ramę, loggię i skośne przeszklenia, ale
wartości, które odczyt podawał, gubiły się po drodze: szkło stawało się prętami, jeden wiersz nóg służył obu nogom,
rama była dwiema belkami krzyżującymi się w kalenicy, pas portalu nie miał pola, płyta loggii była przycięta.

## Decyzje

1. **Każda przyjęta wartość ma zbudowaną wartość albo jawny brak.** Kontrola `facade-values-built` porównuje
   uzgodnione wypełnienie balustrady, końce nóg i pasy portalu ze skompilowaną sceną; rozjazd blokuje ilości.
2. **Nieznane zostaje nieznane.** `railingInfill` ma `basis` READ/NOTE/DEFAULT/UNKNOWN; konwencja kernela (pręty) jest
   nazwana (`RAILING_INFILL_ASSUMED`), nigdy zapisana jako odczyt. Notatka odpowiedzi przechodzi jawnie jako NOTE.
3. **Rama to jedna płyta**, nogi niezależne. Podstawa nogi: zwrot z rzutu → grunt; własny wiersz; płyta sięgająca
   nogi (przedłużona pod nią); dach niższej bryły; inaczej `SOURCE_UNKNOWN`. Wiersz nad konturem pasa → `WRONG_READ`.
4. **Pas portalu jest głowicą otwartego frontu**: kończy się pod płytą i płaskim dachem tylko tam, gdzie przykrywają
   jego ślad, i nie wchodzi w ścianę rzutu. Jedna bryła w jednym miejscu.
5. **Domyślny okap nie wystaje poza ramę**: przy ramie na szczycie i okapie DEFAULT okap = 0, nazwane; odczytany zostaje.
6. **Poprawka recenzji jest oceniana per własność** (APPLIED ≠ IMPROVED), z ochroną otworów innych stron dla poprawek
   cech i głowic; runda jest zapisana (model wejściowy, rewizje, hashe), `STALE_DEPENDENCY` mówi, czy odpowiedź jest
   stara, czy rewizja się rozjechała.
7. **Miara szczegółowa obok historycznej**, z tolerancjami ustalonymi przed porównaniem i dowodem na wstrzykniętych
   usterkach; LOCAL jest kontrolą zdolności, prawdą jest źródło.

## Konsekwencje

Zapisane odpowiedzi recenzji sprzed kontraktu 0.4.0 są przy odtworzeniu stare (rewizja obserwacji się zmienia).
Schemat modelu 1.7.0 przyjmuje addytywną rolę `WallPanel.GABLE_FRAME`. Wersje: dokument 0.4.0, odczyt 0.4.0,
resolver 0.5.0, builder 0.4.0, ścieżka domu 0.4.0 — klucze ponownego użycia rewizji zmieniają się razem z nimi.
