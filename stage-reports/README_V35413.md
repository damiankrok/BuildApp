# v3.54.13 — kontury wykończeń i ochrona geometrii: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V35413.md`](SOURCE_TO_MODEL_V35413.md). ADR: `docs/ADR-V35413-OUTLINES-AND-PROPERTY-ARBITRATION.md`.
Hand-off: `research/source-to-model/v35413/HANDOFF.md`. Koszt: **0,04623 USD** (4 żądania). APK: **1344**.

## W sześciu zdaniach

1. Drewno na froncie jest teraz jednym konturem od parteru do szczytu pod ramą, a ciemny szczyt z tyłu wypełnia
   trójkąt między przeszkleniami — zamiast prostokątów liczonych osobno dla każdego piętra.
2. Przyczyna była w czytniku (jeden pas na piętro) i w kontrakcie (tylko prostokąt); model ma teraz kontur regionu
   (schemat 1.9.0), a jedna granica ze źródła jest dzielona na ściany, które model naprawdę pokazuje.
3. Geometria się nie zmienia: ściany, otwory, pokoje, schody i ID są te same co w LOCAL z oryginałów — brama ma znów
   2,20 m (gubiła ją, bo szkic zastępował jedyny oryginał, który rozstrzygał odczyt „275 albo 220”).
4. Oddana miniatura: przód i tył z konturów Twoich szkiców, boki z automatycznego odczytu elewacji; zgodność granic
   z oryginałem 0,96/0,95 (wcześniej 0,74/0,77), rozpoznawalność 14/14.
5. Automatyczne cztery elewacje działają: 4 oryginały → kontury w JSON za 0,046 USD, cztery strony zgodne ze sobą;
   front tak dobry jak ze szkicu, tył słabszy (szersze szkło, węższy pas).
6. Na drugim domu (inny wydawca) ten sam konsument nałożył ręcznie wskazany kontur bez zmiany geometrii — to test
   konsumenta, nie automatycznego odczytu.

## Co obejrzeć

- APK 1344: scena 1 „Marcówki — kontury wykończeń v3.54.13 (oddany)”, scena 2 „… z odczytu 4 elewacji (eksperyment)”,
  dalej sceny z APK 1343.
- Plansze (paczka `BuildPlan-V35413-Private.zip`, `boards/`): cztery strony ŹRÓDŁO | SZKIC | ODCZYT API | A | B-both |
  C-live | ODDANY, perspektywa, wnętrze bez dachu, zbliżenia drewna, szczytu, pasa i bramy.
