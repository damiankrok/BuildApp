# 005L blind round 9 — draw, runs, sealed verdicts, diagnosis

The protocol is `holdout/README.md` § Round 9, fixed before the freeze. The exclusion manifest is
`exclusion-manifest.json` in this folder.

## Freeze

- `PRE_HOLDOUT_9_SHA = 8f5f3c5903bc8cfe168667f6b5dcfdb995eaf4cd`.
- The draw followed that commit's CI run 37595482179: green on attempt 1, 39 jobs pass, 2 skipped by design.
- Nothing was committed between the freeze and the draw, and nothing in production has been committed since.

## Draw

Ledger line `BUILDPLAN-005L-STOREY-REGISTRATION-HOLDOUT`, 2026-10-07T09:39:14Z.

- **Seed:** `SHA256(8f5f3c59… + "BUILDPLAN-005L-STOREY-REGISTRATION-HOLDOUT")` =
  `24d9826d6f8873c8215f8bb8ed9de34676914e35c9d48233de9b7c6d281922e7`, recomputed independently (`sha256sum`).
- **Pool:** `800c2a1e…2ed41`; 1609 drawable, 1476 excluded.
- **Exclusions:** `excluded-families-round-9.txt`, `fd13e2ca…54b7d11`. Neither drawn family appears in it or anywhere in
  the repository.
- **Holdout 1, multi-storey stratified:** k = 0 →
  `dom-w-murajach` (`https://www.archon.pl/projekty-domow/projekt-dom-w-murajach-mfc224c195bead`). Its page's markup
  exposes plans of storeys `[1, 3]`. It was eligible at the first candidate, so none was burned.
- **Holdout 2, unstratified:** i1 = 349 → `dom-w-cieszyniankach`
  (`https://www.archon.pl/projekty-domow/projekt-dom-w-cieszyniankach-12-ge-m43d25c0636969`).

## Runs

Each address ran **once**, live, with the frozen code, one after the other, with nothing else running:

`ANALYZER_EVIDENCE=1 TELEMETRY=1 npx vite-node packages/analysis-service/scripts/second-house.ts -- --url <address> --cache <scratch> --out <scratch> --recogniser`

- The external numeric recogniser was on (pinned model and WASM), and so was the Evidence Pack.
- The 005K drawn-gap rule was never passed, so it was OFF (the product default; `boundary.drawnGapRule: "OFF"` in the
  digest).
- Cache and output stayed outside the repository.

| # | started (UTC) | wall | peak RSS | longest telemetry gap | outcome | pack |
| --- | --- | --- | --- | --- | --- | --- |
| 1 `dom-w-murajach` | 09:40:46 | 410 s | 924 MB | 3.4 s | `RECONSTRUCTION_FAILED / METRIC_RESOLUTION_INCONCLUSIVE` | 36 files, 571 decisions |
| 2 `dom-w-cieszyniankach` | 09:47:36 | 287 s | 983 MB | 4.3 s | completed: 1 body, 15 openings, model `a96afbb1…` | 37 files, 448 decisions |

## Verdicts (`holdout/verdict.mjs`, as frozen) — sealed 09:52:35Z, before any diagnosis

| # | verdict | conditions | `verdict-*.json` SHA-256 (as printed, before the scratch path was redacted) |
| --- | --- | --- | --- |
| 1 `dom-w-murajach` | **ALGORITHMIC_FAIL** | a typed refusal: no model | `fff3a8d9…c52fa8f2` |
| 2 `dom-w-cieszyniankach` | **PASS** | storeys 1 / 1; footprint 184.86 against 194.79 m² (−5.1 %); every opening built; the first reading held | `6a863c90…49981620e` |

- **No SOURCE_LIMITED_PARTIAL item applies to #1.** Floor plans are present. The overall dimensions are legible (186
  OCR tokens on the ground copies, the tallest 90 px), and the walls are 25 px.
- **#2 is a single-storey house:** all four plan copies are GROUND. The storey registration and support code was not
  exercised on it (`14b-storey-support.json`: no other storey).

**005L has a fresh ALGORITHMIC_FAIL, so the stage is PARTIAL** (brief §38).

## Diagnosis (brief §39) — read from the sealed Evidence Pack and plan diagnostics after the seal

Nothing was changed, re-scored or re-run as a verdict. The raw plan was looked at locally, outside the repository. Two
diagnostic solver-alone replays of #1's sealed evidence were run, at the frozen code and at the 005K starting code
`a70047f`. They are diagnosis only and never a verdict.

**#1 `dom-w-murajach`: FIRST_BAD_DECISION = BODY_RELATION** (the recessed entrance beside the garage door), on the
GROUND plan copy `asset-rzut-36e1e5a39d`.

1. **The ground plan.** The front line carries the recessed entrance vestibule (the 105/210 door set back about
   0.85 m) directly beside the 250/225 garage door. The rear wall carries a 270/230 terrace door and a 100/230 door.
2. **Its boundary is not accepted.**
   - No long-band box (`A_LONG_BAND_BOX` area 0: every facade wall is broken by an opening).
   - The garage mouth is not shut (`shutGarageMouths: 0`), so the garage (x 538–765 px) is left outside the extent
     (`WALL_GEOMETRY_EXTENT`, x 108.5–543).
   - The house body (94 m² at the copy's own scale) is not enclosed. Its mouth on the front line is 6.45 m, where the
     vestibule recess and the garage door stand side by side.
   - This is the class blind-8 #1 (`dom-w-gozdzikowcach`) was left with: the porch mouth and the garage door read as
     one place where the wall stops.
3. **The base falls to the ATTIC plan** (`asset-rzut-44d6d1166d`), a clean 25 px rectangle, by the base rule that
   predates 005L.
4. **005L registers the ground plan below the attic base** (same pixel scale, score 0.670, margin 0.263).
   - The ground copy's own chain registration (2.45 cm/px) disagrees with the page vote (1.52 cm/px). The printed
     1020 cm over 657 px gives about 1.55 cm/px, so the copy's registration is the wrong one, and the k 1.618
     printed-scale hypothesis is correctly REFUTED.
   - Of its walled regions, a 21.7 m² region fails the body test, and a 6.5 m² room stands on the attic body. The
     ground storey's footprint is that room.
5. **The layout gate measures the ground storey: 7.04 m² against the published 75.83 m².** The result is
   FOOTPRINT_AREA_WRONG, then PLAN_LAYOUT_REJECTED. The 005A resolver weighs 12 other readings and none survives. The
   run is typed `METRIC_RESOLUTION_INCONCLUSIVE`: no independent reading settles the scale, because only 4 labels are
   read on 55 dimension lines.

**What 005L changed here.**
- At the 005K code, the same sealed evidence completes a model. The ATTIC outline is copied down as the ground floor:
  65.56 m² on both levels, footprint −13.54 %. The frozen verdict script judges that model ALGORITHMIC_FAIL too.
- So this house failed before 005L. 005L changed the failure from a wrong model (the attic ring standing in for a
  ground floor with a garage) to a typed refusal, because a storey's footprint is now its own plan's.
- The storey code did not cause the failure and could not have fixed it. The ground plan's body relation is upstream
  of every storey decision.

**#2 `dom-w-cieszyniankach`: PASS.** One storey, footprint −5.1 % (inside the 6 % gate), 15 openings built, scale
confirmed on the first reading.

| # | class | owner |
| --- | --- | --- |
| 1 | **BODY_RELATION** (recessed entrance + garage door on the ground plan; boundary not accepted) → STOREY_ROLE consequence (attic as base) → the ground storey's own 7 m² footprint refused at the gate | `FIX_RECESSED_ENTRANCE_BODY_RELATION` |
| 2 | — | — |
