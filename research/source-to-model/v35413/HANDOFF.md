# v3.54.13 hand-off

Base `2c21ce1` → `10cb387` (schema 1.9.0, outline, migration, reseal, appearance module) → part 2 (frame bars, boundary
measure, B arbitration) → `65bcea4` (C measured, sealed) → delivered scene + docs. Books 23.854612 / 24.11036 USD.

## Where things are

- Code: `packages/model` (schema 1.9.0, outline validation, migration), `packages/geometry/src/surface-regions.ts`
  (outline compile), `packages/analysis-service/src/appearance/` (contract, sketch reader, visibility, consumer,
  arbitration, masks). Scenes: `marcowki-c-v35413` (delivered), `marcowki-c-live-v35413` (experiment).
- Drivers: `research/source-to-model/v35413/c-offline.ts` (sketches or `--observations`), `c-live.ts` (API, plan first),
  `b-guard.ts`, `boundary-metric.ts` + `refs-marcowki-boundaries.json`, `four-sides-check.py`, `render-observations.py`,
  `make-board.py`, `compare-models.ts`, `seal.ts`.
- Private (`/home/user/rd/v35413/`): trace-A / trace-Bboth / trace-pallas (solver replays with facade alignment),
  C-offline, C-live (+ `live/raw-*.json`, `live/observations.json`), C-combined, B-guarded(-foreign), counter/, metric/,
  boards/, det/ (determinism), pallas-C-manual.

## Next (OWNER)

1. Second house with the automatic four-side reading (pool left: 0.255748 USD; one house ≈ 0.05 USD).
2. A brick class in the product palette, if wanted.
3. Rear reading: the API's glazed triangles wider than the model's openings — a geometry hypothesis to check, not apply.
