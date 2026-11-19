# v3.54.15 — index

- Report: `stage-reports/SOURCE_TO_MODEL_V35415.md`
- ADR: `docs/ADR-V35415-RESPONSE-CONTRACT-LEVELS-CACHE.md`
- Inventory matrix (§3): `research/source-to-model/v35415/INVENTORY.md`
- Cases and selection before results: `research/source-to-model/v35415/CASES.md`, `CONTROL_SELECTION.md`, `control-selection.json`
- Results: `research/source-to-model/v35415/results/` (case traces, control's first result, cache trial, scores, sketch index)
- Hand-off: `research/source-to-model/v35415/HANDOFF.md`
- Ledger: `research/ai-assist/spend-ledger-v35415.json`
- Tools: `run.ts` (L-M / L-MS driver; `--strict`, `--prompt-cache`), `fact-trace.ts`, `sketch-unregistered.ts`,
  `assemble-sketches.py`, `compose-board.py`, `gallery.py`, `host-e2e.mjs`, `book-host.ts`, `strict-probe.ts`,
  `prefix-tokens.ts`, `seal.ts`
- Private ZIP (not in Git): sketches of six houses (4 sides each, PNG/SVG/JSON, raw, normalized, rejected), gallery,
  boards, models and scenes, raw/canonical answers, sources, references, traces, ledger, reports, APK 1346.
