# v3.54.12 — kolorowy szkic i rozpoznawalna miniatura: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V35412.md`](SOURCE_TO_MODEL_V35412.md) — wyniki na szkicach w dopisku
**REAL_OWNER_INPUTS** (rozdz. 8–15); rozdz. 0–7 to historia etapu bez obrazów. ADR:
`docs/ADR-V35412-MINIATURE-AND-METRIC.md`. Hand-off: `research/source-to-model/v35412/HANDOFF.md`. Koszt: **0 USD**.
APK: **1343** (`a40528a5…`).

## W sześciu zdaniach

1. Szkice przeszły przez rzeczywisty LOCAL (B, B1, B2): **bez zmian pogorszyły front** — szkic jest o 8,9 % wyższy
   względem szerokości, więc rejestracja elewacji położyła +3,06 o 0,45 m za wysoko i loggia z balustradą zniknęły
   (miniatura 13/14, obmiar 11/15); tył jest obojętny.
2. Dwie potwierdzone bariery naprawione **za flagami, domyślnie wyłączonymi** (bez flag wynik bajt w bajt jak
   wcześniej): osobna skala pionu z rzędnych kalenicy i terenu oraz odczyt wykończeń także na wyższych kondygnacjach.
3. Ze szkicami i obiema flagami (B-both) dom jest tak samo rozpoznawalny jak z oryginałów (14/14) i ma **lepszą
   paletę** (drewno szczytu frontu, ciemny panel szczytu tyłu: strefy 14/14 vs 12/14); gorsze jest tylko nadproże
   bramy (2,75 vs 2,25 m).
4. Kontrpróby: inna paleta zmienia tylko materiały, a szkic bez ramy daje dom bez ramy — **kolor nie tworzy
   architektury**, więc automatyczny szkic potrzebuje stałej palety i bramek.
5. Jasny pas 0,40 m między wejściem a garażem w H jest naprawiony (wykończenie odsłoniętego czoła ściany);
   H v3.54.12 różni się od v3.54.11 tylko tym.
6. Automatyzacja (cel OWNER-a): propozycja, nie zakup — edycja z oryginału albo odczyt do SVG z lokalnym renderem,
   stała paleta, bramka rejestracji i tożsamości, spójność czterech stron; **ok. 0,3–0,9 USD na dom** (rozdz. 14).

## Co obejrzeć

- APK 1343: scena 1 „Marcówki — H v3.54.12 (czoło ściany)”, scena 2 „Marcówki — LOCAL + szkice OWNER-a
  (eksperyment)”, dalej sceny z APK 1342 bez zmian. Domyślnym modelem pozostaje LOCAL A.
- Plansze (paczka prywatna `BuildPlan-V35412-REAL-Private.zip`, katalog `boards/`): cztery strony
  ŹRÓDŁO | SZKIC | A | B | B-both | WYBRANY, widoki skośne, wnętrze bez dachu, zbliżenia pasa i loggii.
