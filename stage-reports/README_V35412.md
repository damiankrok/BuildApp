# v3.54.12 — kolorowy szkic i rozpoznawalna miniatura: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V35412.md`](SOURCE_TO_MODEL_V35412.md). ADR: `docs/ADR-V35412-MINIATURE-AND-METRIC.md`.
Hand-off: `research/source-to-model/v35412/HANDOFF.md`. Koszt: 0 USD. Kod produkcyjny bez zmian.

## W pięciu zdaniach

1. **Czterech obrazów z promptu nie było w sesji** (`1000090696.jpg`, `1000090699.jpg`, `Uproszczona elewacja domu
   z garażem.png`, `Kolorowa tylna elewacja domu z balkonem.png`) — eksperyment ze szkicami nie został uruchomiony
   i niczego nimi nie zastąpiono.
2. Zapisana przed oceną karta tożsamości Marcówek (14 cech, 5 krytycznych) i osobny scorer miniatury: LOCAL i H po
   naprawie są rozpoznawalne 14/14, H v3.54.10 traci tylko ciemny pas, a kontrola z białym tłem z v3.54.11 nie jest
   rozpoznawalna (znikają obie ramy) — ocena wizualna nie dotyka liczb metrycznych.
3. Gotowe na szkice: parowanie po zawartości, rejestracja na punktach budynku (wykrywa odbicie i zmianę proporcji,
   mierzy np. przesunięcie bramy), pakiet B/B1/B2 z podmianą tylko dwóch elewacji i jeden skrypt dla całego biegu.
4. Nowe ustalenie: w H między wejściem a garażem widać jasny pas 0,40 m (czoło ściany `w-main-1`), bo wykończenie
   leży tylko na licach ścian — nazwane, nie naprawione (zmiana reprezentacji).
5. Bez nowego APK (brak nowej sceny); APK 1342 pozostaje aktualne.
