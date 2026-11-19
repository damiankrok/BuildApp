# v3.54.14 R2 — hand-off

STAGE v3.54.14 R2 · BRANCH `claude/new-session-3kzcgh` · CI `[skip ci]` (bez merge i PR) · FULL_REPORT
`stage-reports/SOURCE_TO_MODEL_V35414.md` · ADR `docs/ADR-V35414-METRIC-CONSULTANT-SKETCHES-CHOICE.md`.

## Co jest w kodzie

- `analysis-service/src/appearance/` — konsument 1.1.0 (styk poza siatką, komórki zasłonięte w podziale ściany,
  pasmo niepewności bez ziaren, wchłanianie małych części, klasa BRICK), kontrakt 1.1.0 (`toSourceResidualPx`),
  `elevation-sketch.ts` (kontrakt szkicu, renderer, kontrola proporcji v2, szkic → obserwacja wyglądu).
- `analysis-service/src/consult/metric-read.ts` — odczyt niezależny, kontrola LOCAL, resolver 1.1.0
  (CHAIN/SCALE/FOOTPRINT), `measureBuilt`.
- `consult/sketch-step.ts` (odczyt + kontrola + `judgeForm`), `consult/choose.ts` (wybór per właściwość),
  `consult/accepted-consult.ts` (zaakceptowane rewizje konsultanta), `consult/consult-analysis.ts` (spięcie:
  `metricRead`, `sketches`, `accepted`), `run.ts` (`elevationSketches`, `appearance`, `wallTonesFrom`).
- Host `apps/analyzer-api/src/wiring.ts`: `ANALYZER_CONSULTANT=pilot` + `ANALYZER_METRIC_CONSULTANT=on`
  (domyślnie Opus 5.5) + `ANALYZER_SKETCHES=on` (Sonnet 5.5); magazyn `accepted-consulted-revisions/` w katalogu
  danych hosta; `executor.ts` przekazuje `reanalyse`.

## Jak powtórzyć (0 USD, z zapisanych odpowiedzi w prywatnym katalogu)

```
OFFLINE=1 npx vite-node research/source-to-model/v35414/metric-run.ts -- --url <strona> --cache <cache> --out <dir> \
  --house <nazwa> --content --recogniser --replay <LM>/turns.json [--sketch-replay <LMS>/sketch-turns.json]
npx vite-node research/source-to-model/v35414/score.ts -- refs/<dom>.json <out.json> manual-<dom>.json L0=… L-M=…
/usr/bin/python3 -I research/source-to-model/v35414/compose-board.py <run> <cache> <sketches> <views> <prefix> - <etykiety…>
node research/source-to-model/v35414/host-e2e.mjs --commit <sha> --out <dir> --data <dir> --max-usd 28.854612 \
  --spent-usd <księga> --repeat --default <url> <url>      # klucz tylko z sekretu środowiska
```

## Następny krok (NEXT_STEP)

1. Drugi świadek rzędnych: kąt dachu ze strony (Ballina 28°) albo czytelny przekrój — bez niego szkice i dach
   nowych domów małej rozdzielczości stoją.
2. Budowa obrysu przypięta do wydrukowanego wymiaru całkowitego (Bakopy 14,919 vs 15,00).
3. Orientacja pionowych etykiet w LOCAL (0051/1500, 518/815) — przyczyna większości `UNRESOLVED`.
4. Kandydat formy nie powinien zmieniać tonów ścian stron bez przyjętego szkicu (dziś łata w `choose.ts`).

Prywatne: modele, sceny, odpowiedzi API (`turns.json`, `sketch-turns.json`), plansze — w prywatnym ZIP; obrazy
wydawców nigdy w Git.
