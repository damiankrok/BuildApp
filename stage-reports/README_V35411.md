# v3.54.11 — APK z rzeczywistym H, materiały elementów, LOCAL na warstwach obrazu: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V35411.md`](SOURCE_TO_MODEL_V35411.md). Gałąź `claude/new-session-3kzcgh`; rewizje
`38592f7` (sceny v3.54.10 w aplikacji, Master Plan v3.54.11), `caecb9a` (wykończenie na elemencie, scorer v1.1),
`84de494` (pas pod płytą balkonu, narzędzia warstw), `d88f13c` (trzecia scena; **APK 1342**) i commit raportu.
Hand-off: `research/source-to-model/v35411/HANDOFF.md`. ADR: `docs/ADR-V35411-ELEMENT-FINISH-APK-IMAGE-LAYERS.md`.
Master Plan v3.54.11 w całości: `docs/MASTER_PLAN.md`. **Koszt etapu: 0 USD** (bez żądań API).

## W pięciu zdaniach

1. **APK 1342** (arm64, podpis podglądowy v2, `versionCode 1342`, SHA-256 `8cbad72d…5242`) ma na górze listy trzy
   zapieczętowane sceny: „H po naprawie v3.54.11”, „H v3.54.10, kandydat” (dokładny model z ZIP-a) i „LOCAL oddany
   przez host” — sprawdzone po wyciągnięciu z instalatora (hashe, liczby elementów, podpis, wersja, brak klucza);
   UI na telefonie niezweryfikowane (brak urządzenia).
2. Pas nad wejściem i garażem był jasny, bo ciemna strefa trafiała tylko na lico ściany za pasem; teraz strefa
   pokrywająca ≥ 60 % lica pasa jest wykończeniem tego elementu (cały człon), rama zostaje jasna, konflikt dwóch
   wykończeń jest nazwany i niezamalowany — strefy na scenach H: 11/14 → **14/14**.
3. 2,78 to spód cienkiej płyty dachu garażu, który stary scorer brał za portal; pas ma spód **2,261** (prawda 2,28);
   scorer v1.1 stoi obok v1, poprawka pomiaru nie jest naprawą modelu.
4. Podbitka/podsufitka nie istnieje jako osobna powierzchnia (jeden materiał na człon), słupy LOCAL znajduje tylko
   na rzutach — macierz rozdziela „buduje / znajduje / potwierdzone”.
5. Warstwy obrazu nie pomagają LOCAL: ręczna maska = oryginały, automatyczna psuje Marcówki (biel kasuje białą ramę
   szczytu), na Pallas/Oslo model identyczny — granica jest w czytnikach LOCAL; C i API nie były potrzebne.

## Gdzie co jest

| co | gdzie |
|---|---|
| siedem odpowiedzi | raport rozdz. 1 |
| APK: sceny, weryfikacja | raport rozdz. 2; `packages/mobile-scene/scripts/scenes.ts`; testy `apps/android/.../OwnerCheckpointV35410ScenesTest.kt` |
| materiał pasa: przepływ, tabela, testy | raport rozdz. 3; `packages/analysis-service/test/house-v35411.test.ts` |
| scorer portalu | `research/source-to-model/v35411/results/portal-scorer.md` |
| pomiary trzech scen APK | `research/source-to-model/v35411/results/marcowki-apk-scenes-metrics.txt` |
| warstwy obrazu A/B | raport rozdz. 5; `results/layers-results.md`; protokół `LAYERS_PROTOCOL.md` |
| macierz zdolności | `results/capability-matrix.md` |
| resize/padding dostawcy | `results/provider-resize.md` |
| otwarte | raport rozdz. 10 |
