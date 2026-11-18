# v3.54.9 — wspólna metryka, wnętrza kondygnacji i przeszklenia: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V3549.md`](SOURCE_TO_MODEL_V3549.md). Gałąź `claude/new-session-3kzcgh`; rewizje
`39fec90` (kod; **finalny host**) i commit raportu. Hand-off: `research/source-to-model/v3549/HANDOFF.md`. ADR:
`docs/ADR-V3549-METRIC-INTERIOR-GLAZING.md`. Master Plan v3.54.9 (dołączony, skopiowany w całości): `docs/MASTER_PLAN.md`.

## W pięciu zdaniach

1. Opis domu (H) ma teraz wnętrze każdej udokumentowanej kondygnacji: ścianki, drzwi, pomieszczenia, schody i otwory
   stropu z LOCAL, umieszczone przez sprawdzoną transformację (jedna skala, odbicie rozstrzygnięte, poziomy po
   rzędnej) — Marcówki: 44 elementy, 0 odrzuceń, parter 7/10 i poddasze 6/9 pomieszczeń źródła dopasowanych; gdzie
   transformacji nie da się sprawdzić (Lubczyk, Wena, Alaska, Oslo, Pliszka), wnętrze nie jest wklejane i wynik mówi
   dlaczego.
2. Wymiar 12,60 m to korpus między cofniętymi ścianami (łańcuch 1,00 + 5,10 + 7,50 + 1,00), a nie cały obrys z
   zwrotami; kontrola porównuje teraz wymiar ze ścianami, na których stoją jego końce (12,52 m → PASS), ale nadal
   odrzuca wymiar bryły wzięty za cały dom.
3. Tylne skośne przeszklenia: oba końce i kąt są mierzone osobno; adapter i builder są poprawne (diagnostyka ręczna:
   wszystkie końce ≤ 1 mm), a 3,995 → 4,182 było parapetem odczytanym na górze balustrady — naprawione; wysokie końce
   H są nadal 0,24 m za nisko (odczyt widocznej krawędzi vs otwór z opisu 234/303) i jest to zapisane jako otwarte.
4. Recenzja rozróżnia `APPLIED`, `IMPROVED`, `WITHIN_TOLERANCE` i `VERIFIED_IN_SCOPE`, a `MATCHES` przy otwartych
   usterkach ich nie zamyka; Pallas odzyskał poprawkę dachu garażu (zapisana odpowiedź powiązana z rewizją tylko przy
   tym samym odczycie); `GABLE_FRAME` dostał schemat modelu 1.8.0 z jawną migracją.
5. Finalny host z `39fec90`: ALL CHECKS PASSED, opis przeszedł wszystkie własne kontrole (15/0), host oddał LOCAL
   (27/27, mniej sprzeczności z elewacjami), ponowne użycie 0 USD, bez tokenu bez żądań; koszt etapu 0,361472 USD,
   księgi 23,2994 z 24,11036.

## Gdzie co jest

| co | gdzie |
|---|---|
| siedem odpowiedzi | raport rozdz. 1 |
| inwentarz źródeł, dlaczego H nie miał wnętrza | raport rozdz. 2; `research/source-to-model/v3549/results/marcowki-source-inventory.json` |
| semantyka wymiarów, s = D/px | raport rozdz. 3 |
| końce i kąt głowic, 3,995 → 4,182 | raport rozdz. 4; `results/diag-patch-heads.json` |
| wnętrza: kontrakt, pokrycie kondygnacji, miary | raport rozdz. 5; `packages/reconstruction/src/house/interior.ts` |
| kontrole i regresja | raport rozdz. 6; `results/regression-v3548-vs-v3549.txt`, `results/pallas-rebind-*.json` |
| recenzja, schemat modelu | raport rozdz. 7; `results/marcowki-H-PO-review.json` |
| host E2E | raport rozdz. 8; `results/host-39fec90/` |
| przed / po (scorer v2) | raport rozdz. 9; `results/marcowki-metric-v2.{json,txt}` |
| testy przyczyn | `packages/analysis-service/test/house-v3549.test.ts` (17), `packages/model/test/migration.test.ts` |
| tablice: elewacje, zbliżenia, widok ukośny, kondygnacje | pakiet prywatny `BuildPlan-V3549-Private.zip` (`boards/`) |
