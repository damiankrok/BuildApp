# v3.54.9 hand-off

Revisions: `39fec90` (code; final host built from it), then the report commit. Base: `e2b3b58` (v3.54.8 report + APK scenes; v3.54.8 code `86fd69f`, final host `05faa4e`).

## Private data (outside Git, `/home/user/rd/v3549/`)

- `I1`…`I5`: Marcówki replays of the v3.54.8 live read (`/home/user/rd/v3548/LIVE1`) with LOCAL's interior, on
  successive code; `I5` is on the final code. `RI`, `RB`: control replays (Oslo, Lubczyk, Pallas; `RB` = Pallas
  after the recorded-answer rebind).
- `R-DEV`, `R-CNEW`, `LAr`: regression replays on the final code (same answers as v3.54.8's `R-DEV`, `R-CNEW`, `LAr`).
- `diag/`: MANUAL_DIAGNOSTIC patches (`p-heads.json`: all four problematic raked-head ends from the sealed truth in
  each elevation's own rows) and their run `D-heads`.
- `metric/`: `feat.json` (measure-features), `v2.json` / `v2.txt` (scorer v2), `host-*` after the host job.
- `boards/`: per-storey boards (`storeys-*.png`), elevation boards, close-ups, oblique views.
- `inventory-live1.json`: the per-picture source inventory of the live read; `host-obs/`: the v3.54.8 host's
  observations recompiled.
- `host/`, `host-data/`: the final host E2E (journal, records, served models and house documents).

## Commands

- Run / replay: `npx vite-node research/source-to-model/v3549/house-run.ts -- --list <list> --out <dir> --phase dev
  [--replay <run root>] --local <LOCAL root>`; live: prefix
  `BUILDPLAN_ANTHROPIC_API_KEY="$(tr -d '\n' < /root/.config/buildplan/campaign-key)"` (never print it).
- Source inventory: `/usr/bin/python3 -I research/source-to-model/v3549/source-inventory.py <run dir> <out.json>`.
- Metrics: `npx vite-node research/source-to-model/v3548/measure-features.ts -- <feat.json> label=<model.json> …`, then
  `/usr/bin/python3 -I research/source-to-model/v3549/metric-v2.py <feat.json> research/marcowki-v2/marcowki-source-truth-v2.json <out.json> label=<model.json>[,<house.json>] … --inventory <inventory.json>`.
- Storey boards: `/usr/bin/python3 -I research/source-to-model/v3549/plan-board.py <scene.json> <out.png> 0=<ground plan> 1=<attic plan> --title T --truth <truth json>`.
- Edge profile of a raked head: `research/source-to-model/v3549/edge-profile.py`.
- Host: build `apps/analyzer-api` (`npm run build`), then `node research/source-to-model/v3549/host-e2e.mjs --commit
  <sha> --out <dir> --data <dir> --max-usd <c> --spent-usd <books> --default <url> <url> <url>`; book with
  `npx vite-node research/source-to-model/v3549/book-host.ts -- <journal> <sha>`.
- Schema restatement: `npm run candidates:reseal` (+ `--path` for the analyzer-v2 artifact copy).

## Books

23.2994 of 24.11036 USD after this stage (stage 0.361472 USD, 6 requests — the final host job; ledger
`research/ai-assist/spend-ledger-v3549.json`). Private package: `/home/user/BuildPlan-V3549-Private.zip`
(SHA-256 `0913161196dbdb2358a411802f4457cc22703a821c68dbc2c0dd5e81537f744a`).
