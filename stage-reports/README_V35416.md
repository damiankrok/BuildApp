# v3.54.16 — index

- Raport: `stage-reports/SOURCE_TO_MODEL_V35416.md` (zaczyna się od tabeli operacji działających od końca do końca)
- ADR: `docs/ADR-V35416-CORRECTION-EXECUTOR.md`; plan: `docs/MASTER_PLAN.md` (v3.54.16)
- Kod: `packages/analysis-service/src/consult/correct/` — `registry.ts`, `source-gate.ts`, `execute.ts`,
  `from-sketch.ts`, `quality.ts`; spięcie w `consult/consult-analysis.ts`; dostawa `run.ts` (`patchedModel`);
  transport `consult/anthropic.ts` (ścieżka zapasowa strict)
- Testy: `packages/analysis-service/test/correct-v35416.test.ts` (dowody, kontrpróby, kanał szkicu, reprodukcje
  Council, jakość, ślad faktów), `transport-cache-v35415.test.ts` (odmowa „too many optional parameters”),
  `packages/mobile-scene/test/owner-v35416.test.ts`
- Próba zamrożona: `research/source-to-model/v35416/trial/` (reguła przed biegiem, pule, selekcja),
  pierwszy wynik `results/trial-first-results.json`
- Wyniki: `research/source-to-model/v35416/results/` — `controlled-proofs.json`, `host-e2e.json`,
  `trial-first-results.json`, `matrix-freeze.txt`, `matrix-final.txt`
- Audyt 20.11.2026 (A1–A4): raport §8–§9, ADR addendum, `research/source-to-model/v35416/audit/` (`rerun-probes.ts`,
  `probe-results-after.json`, `proofs-rerun.json`, `replays.json`)
- Hand-off: `research/source-to-model/v35416/HANDOFF.md`
- Księga: `research/ai-assist/spend-ledger-v35416.json` (etap 1,00064 USD; księgi 27,812357 / 28,854612)
- Narzędzia: `run.ts`, `correct-replay.ts`, `host-e2e.mjs`, `book-host.ts`, `fact-trace.ts`, `ledger.ts`,
  `sketch-only-dir.ts`, `assemble-sketches.py`, `compose-board.py`, `compose-overlay.py`, `decisions.py`, `gallery.py`
- Sceny APK 1347 (kolejno): `ballina-v35416` (ODDANY, host), `murcja-v35416` (ROZWÓJ, odtworzenie),
  `ballina-test-after-v35416` / `ballina-test-before-v35416` (TEST kontrolowany), `alaska-trial-v35416` (PRÓBA)
- Prywatny ZIP (poza Gitem): szkice 7 domów (4 strony, PNG/SVG/JSON, raw, normalized, rejected), źródła, galeria,
  plansze (źródło | szkic | przed | po | oddany, perspektywy, kondygnacje bez dachu, nakładki dowodów), decyzje
  wykonawcy, modele i sceny, nagrania odpowiedzi, rekordy hosta, księga, raporty, APK 1347
