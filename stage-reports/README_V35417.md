# v3.54.17 — index

- Raport: `stage-reports/SOURCE_TO_MODEL_V35417.md` (zaczyna się od tabeli operacji: operacja → konsument → źródło →
  efekt → miara → przegląd → luka)
- ADR: `docs/ADR-V35417-MASSING-ROOF-WITNESS.md`; plan: `docs/MASTER_PLAN.md` (v3.54.17)
- Kod: `packages/analysis-service/src/consult/massing/` (`massing.ts`, `ops.ts`), `consult/correct/resolve.ts`,
  `consult/plan-outline.ts`, `consult/correct/{registry,execute,source-gate}.ts`, spięcie `consult/consult-analysis.ts`
- Testy: `packages/analysis-service/test/{massing,resolve,plan-outline}-v35417.test.ts`, zaktualizowany
  `correct-v35416.test.ts` (dwa dachy jednej bryły = jedna bryła), `packages/mobile-scene/test/owner-v35417.test.ts`
- Diagnoza pierwszej straty: `research/source-to-model/v35417/DIAGNOSIS.md` (Layla, Alaska)
- Plan żądań na żywo (przed biegiem): `research/source-to-model/v35417/LIVE_PLAN.md`
- Próba: `research/source-to-model/v35417/trial/` (reguła, poprawki przed analizą, selekcja)
- Wyniki: `research/source-to-model/v35417/results/` — `dev-alaska.json`, `dev-alaska-live-check.json`,
  `dev-layla.json`, `replays.json`, `host-e2e.json`/`.log`, `gate-cpu.json`, `matrix-freeze.txt`, `matrix-final.txt`
- Księga: `research/ai-assist/spend-ledger-v35417.json` (etap 0,7305 USD; księgi 28,542857 / 28,854612)
- Narzędzia: `run.ts` (+ `--outline-live/--outline-replay`), `diagnose.ts`, `host-e2e.mjs`, `book-host.ts`, `ledger.ts`,
  `gate-cpu.ts`
- Sceny APK 1348 (kolejno): `alaska-host-v35417` (ODDANY, host), `alaska-dev-v35417` (ROZWÓJ),
  `aurora-maxi-trial-v35417` (PRÓBA), potem sceny v3.54.16 i starsze
- Prywatny ZIP (poza Gitem): zamrożone bajty rzutów/przekrojów/elewacji, odpowiedzi surowe i kanoniczne, obserwacje,
  hipotezy, komendy, modele i sceny przed/po/oddane, pierwsze wyniki, księga, raporty, APK, szkice 4 stron, galeria,
  plansze, manifest
