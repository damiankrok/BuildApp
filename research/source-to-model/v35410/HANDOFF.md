# v3.54.10 hand-off

Revisions: `397a809` (contract 0.5.0, DETAILS/STOREY, consumers; host of the one live job), `d43eebe` (zone consumer
fixes found on the live read; E2E check scope), `62350cc` (capability inventory; **final host built from it**), then
the report commit. Base: `911ecb1` (v3.54.9 report; code / final host `39fec90`). Master Plan v3.54.10 was not
attached: `docs/MASTER_PLAN.md` stays v3.54.9.

## Private data (outside Git, `/home/user/rd/v35410/`)

- `diagnosis.md`: confirmed coordinator findings and the per-problem traces on `911ecb1`.
- `R0`: the v3.54.8/9 live recording replayed on the new code (model identical to v3.54.9).
- `DIAG-src` + `DIAG`, `DIAG2`, `DIAG3`: MANUAL_DIAGNOSTIC (hand-made DETAILS/STOREY answers through the normal adapter).
- `host/` + `host-data/`: the one live job (397a809); `host2`, `host3`, `host-final`: 0 USD re-runs (reuse).
- `HOST-src`: the live job's records as a replay folder; `HR`, `HR2`: their replays (HR2 = final code).
- `R-DEV`, `R-CNEW`, `LAr` (+`…2` on the final code): regression replays.
- `metric/`: features and scorer v3 outputs; `boards/`: elevation, close-up, oblique and storey boards.
- `pictures/`: the two plan pictures (by byte hash, from the v3.54.6 cache) for the storey boards.

## Commands

- Run / replay: `npx vite-node research/source-to-model/v35410/house-run.ts -- --list <list> --out <dir> --phase dev
  [--replay <root>] --local <LOCAL root> [--no-review]`; live: prefix
  `BUILDPLAN_ANTHROPIC_API_KEY="$(tr -d '\n' < /root/.config/buildplan/campaign-key)"` (never print it).
- Host records → replay folder: one `answers/<STEP>[-<round>].json` per record of the accepted revision file.
- Metrics: `npx vite-node research/source-to-model/v3548/measure-features.ts -- <feat.json> label=<model|house>…`, then
  `/usr/bin/python3 -I research/source-to-model/v35410/metric-v3.py <feat.json> research/marcowki-v2/marcowki-source-truth-v2.json <out.json> label=<model.json>[,<house.json>]…`
  (a house document alone gives zones only).
- Boards: v3548 `board-frames.ts`, `make-board.py`, `make-closeups.py`, `board-oblique.ts`; storeys
  `research/source-to-model/v35410/plan-board.py <scene> <out> 0=<ground plan> 1=<attic plan> --truth <truth>`.
- Host: `npm run build` in `apps/analyzer-api`, then `node research/source-to-model/v35410/host-e2e.mjs --commit <sha>
  --out <dir> --data <dir> --max-usd 24.0994 --spent-usd <books> --default <url> <url> <url>`; book with
  `npx vite-node research/source-to-model/v35410/book-host.ts -- <host-data>/house-reader-spend.journal.jsonl <sha>`.

## Books

23.808382 of 24.11036 USD after this stage (stage 0.508982 USD, 10 requests; ledger
`research/ai-assist/spend-ledger-v35410.json`). 0.301978 USD left: a second job of this size does not fit.
Private package: `/home/user/BuildPlan-V35410-Private.zip` (SHA-256 `43c53997cc3dd6b6afb9009eeb3f79c0bfca15edf678e6145b0f3c009e2bf849`).
