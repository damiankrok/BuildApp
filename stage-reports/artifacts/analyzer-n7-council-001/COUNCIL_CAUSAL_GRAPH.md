# N7-COUNCIL-001 — graf przyczyn i skutków

Przyczyny źródłowe (R) prowadzą przez decyzje pośrednie do objawów (S). Naprawa ma celować w R, nie w S.

```
R1  Źródło: kopie jednego rzutu niescalone (A-1), etykiety kondygnacji/stron bez kontroli (A-2, A-5, A-6),
    kopia bazowa po słabej etykiecie (A-3)
      ├─► zła skala kondygnacji (B-4: INCONCLUSIVE → PRINTED_SCALE) ──► S5 zła liczba kondygnacji
      ├─► „dom jednopoziomowy”, który ma piętro (A-1) ──────────────► S5
      └─► METRIC_RESOLUTION_INCONCLUSIVE ────────────────────────────► S1 całkowita odmowa

R2  Grubość ściany: jedna T z mediany pasm, także działowych (B-1); layout bramkuje inną wartością (B-2)
      ├─► ściany i wnętrza złej grubości (gozd −0,127 m) ──────────► S3 złe wymiary
      ├─► dobudowa z cieńszymi ścianami < 2T ──┐
      └─► ramy otworów od T domu (D-3) ──► FILL_TOO_LARGE ──► S2 utracone otwory
                                               │
R3  Dekompozycja rzutu: kafle przez ściany (C-1), flood fill przez bramę (C-2), cięcie regionu (C-3), paski bez wpisu (C-8)
      ├─► garaż wcielony / fantomowa bryła; gate BLOCKING → COMPLETE ──► S4 zła liczba brył, zły dach
      ├─► garaż utracony bez wpisu ────────────────────────────────────► S2 utrata poprawnej bryły
      └─► bryła odczytana za wąsko ─────────┐
                                             ▼
R4  Adjudykator P2R (thin-body.ts): pasmo ściany psute przez otwory (F-R1), „nie-niebo” = zabudowa (E-1),
    SHARED_WALL przy częściowym pokryciu (D-4), pomija storeyRects/pieces/MAIN (D-2)
      ├─► KEEP_PARTIAL ─────────────────────────────► WALLS_OVERLAP w1/w3 przy createWallRing ──► S1'/S2 (sygnatura OWNER-a)
      ├─► bryła znika (F-R1, 4 okna) ───────────────────────────────────────────────────────────► S2 bez wpisu
      ├─► fałszywe WIDEN (E-1) ─────────────────────────────────────────────────────────────────► S3
      └─► otwarta obwiednia (D-4) ──────────────────────────────────────────────────────────────► S6 zła scena

R5  Rekoncyliacja ścian PO P2R (D-1): przesunięcie krawędzi bez warunku ≥ 2t; zapis pierwszej próby gubiony
      └─► pierścień ≥ 2T zwężony < 2T ───► WALLS_OVERLAP w1/w3 ───► S1'/S2, przyczyna niewidoczna

R6  Widoki: wysokości z widoków o odrzuconym gruncie (E-3), boczne elewacje odrzucane (E-4),
    weryfikacja samoodniesiona (E-2), raporty sprzed cięcia (E-7), CONFIRMED_MATCH bez wysokości (E-9)
      └─► otwory 0,4–0,7 m źle; brak 2/4 elewacji; fałszywa zgodność ───► S7 rozbieżność z elewacjami

R7  Identyfikacja wyniku: telefon nie zapisuje wersji solvera z wynikiem (F-2); hash punktu kontrolnego ślepy na bryły
      └─► nie da się odróżnić nowego przebiegu od starego ───► S8 „po poprawce nic się nie zmieniło” bez dowodu
```

**Objawy:**

| symbol | objaw |
|---|---|
| S1 | całkowita odmowa |
| S1' | odmowa po bryle głównej (podgląd częściowy) |
| S2 | utracona bryła, ściany lub otwory |
| S3 | zła skala lub wymiary |
| S4 | zła liczba brył |
| S5 | zła liczba kondygnacji |
| S6 | błędna scena przy poprawnym walidatorze |
| S7 | rozbieżność z elewacjami |
| S8 | niejednoznaczna diagnoza u OWNER-a |

**Wspólne przyczyny różnych objawów.** Nie należy ich naprawiać osobno.

- **WALLS_OVERLAP w1/w3 na `ring-attached-k-0`** ma trzy niezależne źródła:
  - R3 (bryła za wąska), przechodzące przez R4 jako KEEP_PARTIAL;
  - R2 (T większa niż własne ściany bryły), również przez R4;
  - R5 (rekoncyliacja).

  Poprawka tylko w R4 nie usuwa R5. Poprawka tylko w R5 nie usuwa R3/R4. Dlatego poprawki 1 i 2 z
  `COUNCIL_FIX_ORDER.md` idą razem, a 3 usuwa źródło w R3.
- **Utrata bryły bez wpisu** pochodzi z R3 (C-2, C-8) i R4 (F-R1 przy 4 oknach). Ta sama reguła — „obszar zamknięty
  narysowanymi ścianami, który nie stał się bryłą, musi być nazwany” — pokrywa oba źródła.
- **Grubość ściany** pochodzi wyłącznie z R2. D-3 (ramy) i część F-R1 (DRAWN_THIN_WALLS nieosiągalne przy oknach) to
  skutki braku grubości per bryła, nie osobne problemy.
