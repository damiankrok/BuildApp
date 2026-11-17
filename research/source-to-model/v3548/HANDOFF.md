# v3.54.8 hand-off

Revisions: `86fd69f` (contract 0.4.0, consumers, data boundary, review per property, round log, metrics, boards; first
host E2E), `05faa4e` (portal band only over the open front, round-log input hash, quality wording; **final host E2E**),
then the report commit. Base: `65d8a06` (v3.54.7 report; v3.54.7 final host from `59d115e`).

## Where things are (private, outside Git: `/home/user/rd/v3548/`)

- `B-L1`, `B-H2`: base replays on `65d8a06` of L1 (`/home/user/rd/v3547/mk/L1`) and of the v3.54.7 final host's
  accepted records (`H2src`). `NFa-*`, `NFb-*`: the same on the final code (twice, same hashes).
- `LIVE1`: the live targeted read (FACADES + REVIEW fresh, INVENTORY + PLAN reused from L1); `LIVE1rc`, `LIVE1rd`:
  its replays on the final code.
- `diag/`: MANUAL_DIAGNOSTIC substitutions (`p-*.json` patches, `D-*` builds).
- `metric/`: `final.json` (features), `detail-final.*`, `hist-final.*`, host metrics.
- `R-DEV`, `R-CNEW`, `LAr`: regression replays. `host/` + `host-data/` (`86fd69f`), `hostF/` + `hostF-data/` (`05faa4e`).
- `boards/`: `marcowki-ge.png` (four sides), `marcowki-closeups.png`, `marcowki-oblique.png`.

## Commands

- Run / replay: `npx vite-node research/source-to-model/v3548/house-run.ts -- --list <list> --out <dir> --phase dev
  [--replay <run root>] [--reuse <root> --fresh FACADES,REVIEW --max-usd <books ceiling>] --local <LOCAL root>`;
  live: prefix `BUILDPLAN_ANTHROPIC_API_KEY="$(tr -d '\n' < /root/.config/buildplan/campaign-key)"`.
- Substitution: `diag-substitute.ts -- <observations.json> <patch.json> <out>`.
- Metrics: `measure-features.ts -- <out.json> label=<model.json|house.json> …` (labels: letters, digits, `-`), then
  `marcowki-detail.py <out.json> research/marcowki-v2/marcowki-source-truth-v2.json <res.json> [--faults]` and
  `marcowki-features.py` (historical 16).
- Boards: `board-frames.ts -- --frames <house.json> --out <dir> label=…`, `make-board.py`, `make-closeups.py`,
  `board-oblique.ts`.
- Host: build `apps/analyzer-api` (`npm run build`), then `node research/source-to-model/v3548/host-e2e.mjs --commit
  <sha> --out <dir> --data <dir> --max-usd <c> --spent-usd <books> --default <url> <url> <url>`; book with
  `book-host.ts -- <journal> <sha>`.

## Books

22.937928 of 24.11036 USD after this stage (stage 0.890574 USD, 15 requests; ledger `research/ai-assist/spend-ledger-v3548.json`).
