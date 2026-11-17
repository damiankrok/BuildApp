# v3.54.5: hand-off (final state; text only; no key, no publisher image)

Report: `stage-reports/SOURCE_TO_MODEL_V3545.md`. OWNER index: `stage-reports/README_V3545.md`.
Protocol and seal: `stage-reports/artifacts/v3545/PROTOCOL_V3545.md`, `PROTOCOL.seal`; selection `SELECTION.md`.

## Revisions
- Start: `9c65b81` (v3.54.4 delivery). Base path of the confirmation: `3c531aee` (v3.54.4 frozen candidate), run in a
  separate worktree (`/home/user/rd/v3545/base-wt`) with its own script.
- Frozen v3.54.5 candidate: `627e4f1`; seal `ce16267`. No product code changed after it; the final host was built from it.

## Books
- `/home/user/rd/v3542/books` (continued, never reset): 14.453496 → 19.27633 USD of 24.11036; remaining 4.83403.
- Ledger in Git: `research/ai-assist/spend-ledger-v3545.json` — 113 requests, 4.822834 USD (dev-live 1.585154, dev-probe
  0.04585, confirm-base 1.270848, confirm-new 1.375326, host-e2e 0.545656). Base-path entries copied from the worktree's
  v3544 ledger (they were booked when they ran); host entries booked from the host's journal (`book-host.ts`).
- Key: `/root/.config/buildplan/campaign-key`, given to one command at a time as `BUILDPLAN_ANTHROPIC_API_KEY`; never printed.

## Private work (outside Git): `/home/user/rd/v3545/`
- `refs-dev/`, `refs-confirm/` detailed references (copied into Git as text: `research/source-to-model/v3545/refs-detail-*`).
- DEV: `R1…R8` replays (R7/R8 = frozen code, identical), `L1…L5` live (`LIVE/` = the latest per house), `LOC`/`BASE` links.
- Confirmation: `CLOCAL` (LOCAL), `CBASE` (base path, live), `CNEW` (new path, live), `CREPLAY` (base answers, new consumer),
  `D-*` delivered-house links, `confirm-detail.json`, `confirm-compare*.md`, `hist-*.json`.
- Host: `host/`, `host-data/`, `host.log`. Boards: `boards/` (confirmation) and `boards/dev/`. Tables: `report/`.
- Pictures exported for the readers: `pictures/`; tools `tools/`.

## Commands
- Run (live or replay): `npx vite-node research/source-to-model/v3545/house-run.ts -- --list <file> --out <dir> --phase <name>
  [--max-usd <ceiling>] [--local <LOCAL root>] [--replay <dir> | --reuse <dir> --fresh STEP,…] [--date YYYY-MM-DD]`.
- LOCAL: `npx vite-node packages/analysis-service/scripts/second-house.ts -- --package <pkg> --cache <dir> --recogniser --out <dir>`.
- Measure any saved scene: `npx vite-node research/source-to-model/v3545/measure-scene.ts -- <run dir>…`.
- Detailed score: `/usr/bin/python3 -I research/source-to-model/v3545/score-detail.py --list <f> --refs <dir> --runs NAME=<root>… --out <json>`;
  self-check `score-detail-selfcheck.py`; comparison `compare.py`; tables `tables.py`; boards `make-boards.sh`.
- Host E2E: `node research/source-to-model/v3545/host-e2e.mjs --commit <sha> --out <dir> --data <dir> --max-usd <ceiling> --spent-usd <books> [--expect url=CODE,…] [--default <url>] <url>…`
  (a URL with a comma cannot be named in `--expect`).

## Open, in order of value
1. Hold LOCAL against registered elevations too (roof silhouette, openings per side) and treat the description's height
   check as a fact compared for both, not a gate for the description only (Pliszka).
2. Count unlabelled elevation pictures cut by the inventory limit as NOT_SENT; give drawing-like unlabelled pictures
   priority over photographs in the 24-picture limit (Mirabelka).
3. False openings of the new reading on new houses (550029LAN, Alaska): a check against the other side's registration.
4. Outline traced to wall fins (Malaxisach); plans without dimensions (Kardamon).
5. Then one more frozen confirmation on 8 new families (~3 USD).
