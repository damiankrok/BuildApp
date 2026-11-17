# v3.54.8 — parametry API do finalnej geometrii: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V3548.md`](SOURCE_TO_MODEL_V3548.md). Gałąź `claude/new-session-3kzcgh`; rewizje
`86fd69f` (kontrakt, konsumenci, recenzja, miary), `05faa4e` (pas portalu, dziennik rund; **finalny host**), commit
raportu. Hand-off: `research/source-to-model/v3548/HANDOFF.md`. ADR: `docs/ADR-V3548-API-PARAMETERS-TO-GEOMETRY.md`.
Master Plan v3.54.8 (z promptu, plik planu nie był dołączony): `docs/MASTER_PLAN.md`.

## W pięciu zdaniach

1. Szkło dochodzi do modelu jako szkło, każda noga ramy kończy się na własnej wysokości (Marcówki: 0,00 i +3,06 na
   płycie loggii), rama jest jedną płytą z ciągłym stykiem w kalenicy, pas portalu jest budowany, a płyta loggii ma pełny
   zasięg 3,24–7,91 m; każda z tych strat miała nazwaną pierwszą funkcję (program, resolver, brak pola w kontrakcie).
2. Nowa szczegółowa miara (27 wierszy, tolerancje ustalone z góry, dowód na czterech wstrzykniętych usterkach) stoi
   obok historycznych 16 cech: H z L1 8/27 → 16/27, świeży odczyt live po recenzji 21/27 (15/16), LOCAL 27/27.
3. Recenzja ocenia każdą własność, którą poprawka ustawia (APPLIED i IMPROVED osobno), chroni otwory innych stron i
   zapisuje każdą rundę (model wejściowy, rewizje, hashe); wszystkie `STALE_DEPENDENCY` tego etapu to stare odpowiedzi.
4. Finalny host z `05faa4e` przeszedł E2E: LOCAL oddany (opis odrzucony przez własną kontrolę obrysu), ponowne użycie
   za 0 USD z tym samym modelem, zadanie bez tokenu bez żądań, kontrola granicy danych PASS.
5. Granice: pas ramy i głowice odczytane o kilka pikseli źle (odczyt, nie builder — podstawienie daje 23/27); koszt etapu
   0,890574 USD, księgi 22,937928 z 24,11036.

## Gdzie co jest

| co | gdzie |
|---|---|
| odpowiedzi wprost (szkło, nogi, ciągłość, portal, loggia, głowice, recenzja) | raport rozdz. 1 |
| ślad parametru → pierwsza strata | raport rozdz. 3 (tabela A) |
| kontrakt i konsumenci | raport rozdz. 4; `packages/reconstruction/src/house/{document,resolve,program}.ts` |
| recenzja (własności, dziennik rund, STALE) | raport rozdz. 5; `results/live1-review*.json` |
| miary szczegółowe i historyczne | raport rozdz. 6; `research/source-to-model/v3548/results/marcowki-*` |
| regresja | `research/source-to-model/v3548/results/regression-v3547-vs-v3548.txt` |
| host E2E | raport rozdz. 8; `results/host-05faa4e/`, `results/host-86fd69f/` |
| testy przyczyn | `packages/analysis-service/test/house-v3548.test.ts` (23) |
| tablice: cztery strony, zbliżenia, widok ukośny | pakiet prywatny `BuildPlan-V3548-Private.zip` (`boards/`) |
