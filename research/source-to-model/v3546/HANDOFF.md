# v3.54.6: hand-off (final state; text only; no key, no publisher image)

Report: `stage-reports/SOURCE_TO_MODEL_V3546.md`. OWNER index: `stage-reports/README_V3546.md`.

## Revisions
- Start: `14f236b` (v3.54.5 delivery); v3.54.5 frozen candidate `627e4f1`; base H `3c531aee`.
- `54d31f6`: the fixes (height definition, outer-ends registration, gable heads and transoms, picture selection, review
  statuses, choice with elevation evidence, delivered-revision check). The three Marcówki readings ran on it.
- `f9cb3ef`: accepted revisions (D39), the set's scale from its best-registered elevation, Android contract snapshot.
  The final host was built from it. The report commit changes no product code.

## Books
- `/home/user/rd/v3542/books` (continued, never reset): 19.27633 → 20.655864 USD of 24.11036; remaining 3.454496.
  One reservation without a settlement from 2026-11-16 (`b3b6fe35421e89d5`, 0.146096 USD) is counted in the balance.
- Ledger `research/ai-assist/spend-ledger-v3546.json`: 26 requests, 1.379534 USD (Marcówki 3 readings, Mirabelka, Tracja,
  host job 1). Host requests booked from the host journal with `book-host.ts`.
- Key: `/root/.config/buildplan/campaign-key`, given to one command at a time as `BUILDPLAN_ANTHROPIC_API_KEY`; never printed.

## Private work (outside Git): `/home/user/rd/v3546/`
- Replays: `P-*` (Pliszka steps), `C-*`, `D-*`, `E-*`, `F-*` (intermediate consumers), **`H-CBASE`, `H-CNEW`, `H-DEV`
  (final consumer)**, `G-DEV` (Lubczyk check); fresh reads `L-NEW` (Mirabelka, Tracja); delivered links `D-FINAL`.
- Marcówki: `marcowki/` — `cache/` (pinned bytes), `LOCAL/`, `M1..M3` (live), `R1a..R3b` (replays on `54d31f6`),
  `S1..S3` (replays on the final consumer), `compare.json`, `compare-S.json`, `accepted-store*/` and `final-job-*.log` (D39).
- Host: `host/`, `host-data/`, `host.log`. Boards: `boards/`, `marcowki/boards/`. Scores: `score-*.json`.

## Commands
- Run (live or replay): `npx vite-node research/source-to-model/v3546/house-run.ts -- --list <file> --out <dir> --phase <name>
  [--max-usd <books ceiling>] [--local <LOCAL root>] [--replay <dir> | --reuse <dir> --fresh STEP,…] [--date YYYY-MM-DD]`.
- Picture selection without API: `npx vite-node research/source-to-model/v3546/pictures-probe.ts -- <pkg> <cache> [<detail ref>]`.
- Marcówki comparison: `/usr/bin/python3 -I research/source-to-model/v3546/marcowki-compare.py <marcowki dir> research/marcowki-v2/marcowki-source-truth-v2.json <out>`.
- D39 jobs: `npx vite-node research/source-to-model/v3546/accepted-reuse.ts -- --job A|B|C|D --store <dir> --answers <run>/marcowki-ge --package <pkg> --cache <dir>`.
- Host E2E: `node research/source-to-model/v3546/host-e2e.mjs --commit <sha> --out <dir> --data <dir> --max-usd <ceiling> --spent-usd <books> [--default <url>] <url>…`; book with `book-host.ts`.
- Scorer, measure, boards: the v3.54.5 tools (`research/source-to-model/v3545/score-detail.py`, `measure-scene.ts`, `make-boards.sh`).

## Next (named limits, not work in progress)
1. Reader: ask for the wall faces of an elevation separately from roof/terrace extents (Alaska's four false openings).
2. Builder: an outline step narrower than two wall thicknesses as a pier/return (Marcówki portal; the left wall and its openings).
3. Plan body division checked against two registered side elevations (Pliszka garage 6.39 vs 5.00 m).
4. Reading repeatability: the accepted revision makes delivery repeatable; the reading itself is not (4 readings, 4 results).
