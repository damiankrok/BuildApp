# v3.54.7 — wierność elewacji i skuteczna poprawka po recenzji: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V3547.md`](SOURCE_TO_MODEL_V3547.md). Gałąź `claude/new-session-3kzcgh`; rewizje
`c973a6a` (model, recenzja, wybór), `c03b7cd` (pierwszy host), `59d115e` (finalny host). Hand-off:
`research/source-to-model/v3547/HANDOFF.md`. Master Plan v3.54.7: `docs/MASTER_PLAN.md`.

## W pięciu zdaniach

1. Rama szczytowa, wnęka z loggią bez słupów, wypusty ścian i skośne/ostre przeszklenia są teraz osobnymi elementami
   modelu H, odczytywanymi ze źródła zwykłym przepływem; na Marcówkach H ma 13/16 cech w tolerancji źródła (v3.54.6: 2/14),
   LOCAL 16/16.
2. Recenzja jest danymi: każda strona idzie jako para źródło/render w tej samej ramie z hashami, defekt ma region i wagę,
   a poprawka stoi tylko wtedy, gdy region mierzy się lepiej (sam nowy hash → `NO_IMPROVEMENT`; otwór do ściany, która
   go nie utrzymała → `HOST_FIRST`; `DIFFERS` bez poprawki → celowane dopytanie elewacji).
3. Wybór trzyma LOCAL i opis przy tych samych cechach (D41), chroni cechy, które LOCAL zbudował ze źródła, i porównuje
   obrys tą samą definicją; dlatego dla Marcówek oddawany jest LOCAL (lepszy), a każdy oddany model ma status jakości (D40).
4. Finalny host przeszedł E2E: LOCAL oddany z `QUALITY_FEATURES_CHECKED`, drugie zadanie odtworzone za 0 USD z tym samym
   modelem i statusem jakości; Alaska ma teraz ostre przeszklenie szczytu zamiast prostokąta.
5. Nie zrobione i nazwane: pas portalu nad wejściem i garażem (brak pola w odczycie), płyta loggii pod wypustem, podział
   garażu Pliszki; koszt etapu 1,39149 USD (26 żądań), księgi 22,047354 z 24,11036.

## Gdzie co jest

| co | gdzie |
|---|---|
| tabela 16 cech Marcówek | raport rozdz. 1 i 7; `research/source-to-model/v3547/results/marcowki-features-truth.json` |
| pętla recenzji (pary, defekty, adresaci) | raport rozdz. 4; `packages/analysis-service/src/house/review.ts` |
| wybór i status jakości | raport rozdz. 6; `packages/analysis-service/src/house/describe.ts` |
| builder (rama, wnęka, wypusty, głowice) | raport rozdz. 3; `packages/reconstruction/src/house/{steps,resolve,program}.ts` |
| regresja | `research/source-to-model/v3547/results/regression-v3546-vs-v3547.txt` |
| host E2E | raport rozdz. 8; `research/source-to-model/v3547/results/host/` |
| testy przyczyn i kontrprzykładów | `packages/analysis-service/test/house-v3547.test.ts` (36) |
| tablice ŹRÓDŁO / LOCAL / H v3.54.6 / H PRZED / H PO / ODDANY | pakiet prywatny `BuildPlan-V3547-Private.zip` (`boards/`) |
