# ADR v3.54.9 — wspólna metryka, wnętrza kondygnacji i przeszklenia

Status: przyjęte (v3.54.9; rewizje w `stage-reports/SOURCE_TO_MODEL_V3549.md`). Kontekst: v3.54.8 oddał na Marcówkach
LOCAL (27/27), bo H z hosta odpadł na 13,52 m wobec wydrukowanego 12,60 m; H nie miał żadnego wnętrza (ani pola,
ani konsumenta), recenzja kończyła się `MATCHES` przy zmierzonych różnicach, a stan `IMPROVED` dla głowic 3,995→4,182
nie mówił, czy cel został osiągnięty. Nowa rola `GABLE_FRAME` weszła przy niezmienionym schemacie modelu 1.7.0.

## Decyzje

1. **Wymiar porównuje się z tym, na czym stoją jego końce.** Wymiar OVERALL, którego oba końce leżą na ścianach
   obrysu w poprzek jego osi, mierzy rozpiętość między tymi ścianami; części obrysu poza końcami (zwroty, ganek) nie są
   w nim. Ale jeśli poza końcami leży w większości **cała bryła** (garaż, skrzydło), to jest wymiar bryły wzięty za cały
   dom — kontrola zostaje FAIL. Działka kalibruje tylko plan sytuacyjny; skala jest jedna dla obu osi.
2. **Wnętrze z LOCAL tylko przez sprawdzoną transformację** (`resolveInterior`): jedna skala (osie różne o ≤ 2 %),
   jedno z czterech odbić wybrane przez pokrycie obrysu (≥ 90 %, przewaga ≥ 3 pkt), a gdy obrys jest symetryczny —
   przez środki otworów zewnętrznych, potem drzwi; poziom źródła trafia na kondygnację o tej samej rzędnej (≤ 0,15 m)
   albo nie trafia wcale; końce ścianek dociągane do lica wewnętrznego (≤ 0,45 m), pomieszczenia zachowują
   identyfikatory. Nigdy wklejenie po prostokącie otaczającym; konflikt metryki, brak rejestracji i nierozstrzygnięte
   odbicie kończą się `NOT_BUILT` z powodem (`INTERIOR_*`).
3. **Umieszczenie wnętrza nie jest poprawnością bryły.** Kontrole wnętrza mają zakres `INTERIOR`: nie liczą się do
   porażek opisu, do statusu zewnętrza ani do oceny poprawek recenzji. Wnętrze, którego nie da się umieścić, nie
   przenosi wyboru na LOCAL.
4. **Builder konsumuje wnętrze**: ścianki `INTERIOR` (pod strop wyżej albo `FOLLOW_ROOF_PLANES` na ostatniej
   kondygnacji), drzwi w ściankach, pomieszczenia z otworami podłogi, schody, otwory stropu (bez podłogi w otworze
   schodów).
5. **Parapet zasłonięty balustradą nie jest odczytywany na górze balustrady**: przeszklenie stoi na płycie balkonu,
   `ESTIMATED`, z `OPENING_SILL_HIDDEN_BY_RAILING`.
6. **Stany recenzji są rozdzielne**: `APPLIED` (zmiana weszła), `IMPROVED` (bliżej celu; wobec braku pomiaru tylko w
   tolerancji), `WITHIN_TOLERANCE` / `OUTSIDE_TOLERANCE` (0,10 m) i `VERIFIED_IN_SCOPE` (końcowy niezależny pomiar na
   oddanej scenie wobec celu recenzenta). Zgodność ze źródłem jest osobną, offline'ową miarą. `MATCHES` przy
   otwartych usterkach jest zapisany w dzienniku rundy (`openAtVerdict`) i ich nie zamyka.
7. **Schemat modelu 1.8.0** dla roli `GABLE_FRAME`, z jawną migracją 1.7.0 → 1.8.0. Plik 1.7.0 z `GABLE_FRAME`
   (zapisany przez ścieżkę v3.54.8) jest jedynym znanym błędnym etykietowaniem i jest czytany jako 1.8.0 z własną
   notatką; plik 1.6.0 z tą rolą jest odrzucany. Kandydaci zapieczętowani i modele OWNER-a przepieczętowane tylko
   zmianą wersji (dziennik `reseal-log.json`, piny w `mobile-scene/scripts/scenes.ts`).
8. **Zapisana odpowiedź recenzji wraca do rewizji tylko przy tym samym odczycie**: gdy jej rewizja równa się
   rewizji bieżącej po zdjęciu balustrad wyprowadzonych z notatki (`legacyRevisionOf`), runda jest powiązana
   (`REBOUND`, `reboundFrom` w dzienniku), a każda poprawka nadal przechodzi własny pomiar. Świeża odpowiedź z inną
   rewizją zostaje `STALE_DEPENDENCY`.

## Konsekwencje

Wersje: dokument domu 0.5.0 (czyta 0.1.0–0.4.0), kontrakt odczytu bez zmian (`reading-0.4.0`), resolver 0.6.0,
builder 0.5.0, ścieżka domu 0.5.0, schemat modelu 1.8.0 — klucze ponownego użycia rewizji zmieniają się razem z nimi.
Głowice skośne pozostają definicyjnie niższe od źródła (odczyt widocznej krawędzi vs otwór konstrukcyjny z opisu
270/320, 234/303) — nie ma pola na opis otworu; to jest zapisane jako otwarte, nie jako naprawione.
