# v3.54.7 — hand-off

Report `stage-reports/SOURCE_TO_MODEL_V3547.md`; OWNER index `stage-reports/README_V3547.md`; Master Plan v3.54.7
`docs/MASTER_PLAN.md`. Branch `claude/new-session-3kzcgh`. Revisions: `c973a6a` (model, review, choice), `c03b7cd`
(house path 0.3.0; first host E2E), `59d115e` (LOCAL protected, one outline definition; final host E2E), report commit.

## What exists (code)
- `packages/reconstruction/src/house/steps.ts` — `outlineSteps` (a step narrower than two walls → one return wall of its
  depth; the ring runs on the recessed line), `straightenJogs` (a jog shallower than a wall, unless another body stands on
  the stretch that would move).
- `resolve.ts` — jogs straightened (said), `recessAt` (a recess between two returns on a side), LOGGIA / BALCONY over a
  recess = slab without supports, GABLE_FRAME → `geometry.frames` (band, legs, depth from the returns or 0.30 m assumed),
  shaped heads (RAKED, POINTED, a triangle's corner cut at 0.30 m, an inconsistent head drawn level and said).
- `program.ts` — returns as walls, frames as `createLinearSolid` VERGE_BOARD on each plane (no verge overhang on a
  framed gable), RAKED / POINTED (two halves) cuts, a door under a shaped head glazed.
- `measure.ts` — `sideFeatures`: frame, balconies (projection, free supports), shaped holes per side, for any model.
- `review.ts` — pairs in the elevation's frame (`renderSideInFrame`), defects as data, close-ups, `SET_OPENING_HEAD`,
  frame/loggia `SET_FEATURE`, `HOST_FIRST`, `NO_IMPROVEMENT` (`judgeDefect` on `regionMeasure`), `MEASURED_PRESENT`,
  the targeted re-reading (`SUPPLEMENT_TOOL`).
- `describe.ts` — `featureClaims` / `claimMet` (D41), LOCAL protection, walled-floor outline overlap, `deliveredQuality`
  (D40); `link.ts` writes `QUALITY_*`; `accepted.ts` keeps the quality status with the accepted revision.
- `read.ts` — reading contract 0.3.0 (frames, loggias, heads); a grammar refused twice → the whole tool without strict.

## Private work (outside Git): `/home/user/rd/v3547/`
- `mk/`: `DIAG1` (manual substitution, MANUAL_DIAGNOSTIC), `L1`, `L2` (live), `L1r`, `L2r` (replays on the final code),
  `T1..T3` (v3.54.6 answers on the final code), `features-final*.json`, `boards/`, `chk/` (pairs).
- `LA` (Alaska live), `LAr`; `R-CNEW`, `R-DEV` (regression); `host/`, `host-data/` (`c03b7cd`), `host2/`, `host2-data/`
  (`59d115e`); `boards/alaska.png`.

## Commands
- Run: `npx vite-node research/source-to-model/v3547/house-run.ts -- --list <file> --out <dir> --phase <name>
  [--max-usd <ceiling>] [--local <LOCAL root>] [--replay <dir> | --reuse <dir> --fresh FACADES,REVIEW]`.
- Features against the Marcówki truth: `measure-features.ts -- <out> label=<model|house.json> …` then
  `/usr/bin/python3 -I research/source-to-model/v3547/marcowki-features.py <out> research/marcowki-v2/marcowki-source-truth-v2.json <res>`.
- Boards: `board-frames.ts -- --frames <house.json> --out <dir> label=…` then `make-board.py <dir> <house.json> <pictures dir> <png> <labels>`.
- Host E2E: `node research/source-to-model/v3547/host-e2e.mjs --commit <sha> --out <dir> --data <dir> --max-usd <c> --spent-usd <books> [--default <url>] <url>…`; book with `book-host.ts`.

## Next (named limits, not work in progress)
1. A portal band / flat-roof fascia depth in the reading contract (the dark band over entrance and garage).
2. A slab that runs under a return starting above it (front loggia 7.22 → 7.90 m).
3. Plan body division checked against two registered side elevations (Pliszka garage).
4. Reading repeatability (three readings, three houses); delivery is repeatable (D39).
