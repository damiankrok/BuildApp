# Blind ARCHON holdout round 2 — draw, runs and verdicts (005B)

The protocol is `holdout/README.md` (Round 2). This directory seals what the draw produced, as text facts only. No
drawing, overlay or render of a drawing is committed. The two overlays and two raw pixel columns were looked at
once, locally, for the diagnosis below, and stay outside the repository.

## Draw

- **PRE_HOLDOUT_2_SHA** `27274ab8c24a17c484158f5e3a0bf091ce85e961`.
  - Pushed to `analyzer/dimension-evidence-refoundation-v1` and `claude/new-session-3kzcgh` before the draw; CI
    run 101 (`36730839835`) on it was green: 25 jobs succeeded, including all eight development-house rows and the
    dimension-evidence job, and the preview-APK job was skipped as on every push.
  - The tree was clean, and nothing was committed between the freeze (15:36:58Z) and the draw (15:37:05Z).
- **The ledger** (`holdout/LEDGER.ndjson`, the line labelled `BUILDPLAN-005B-BLIND-HOLDOUT-ROUND-2`):
  - exclusion file `excluded-families-round-2.txt`, sha256 `7b36740a…98ce13`; pool sha256 `800c2a1e…2ed41`;
  - seed `1216338c1fddccbdfe3c2c274528cdd6e1ded928620893d6e19e48761800cfd0`
    (= `SHA256(PRE_HOLDOUT_2_SHA + "BUILDPLAN-005B-BLIND-HOLDOUT-ROUND-2")`, recomputed independently);
  - `n = 2534`, with 551 addresses excluded; `i1 = 2394`, `i2 = 1480`.

| # | address | family |
| --- | --- | --- |
| 1 | `https://www.archon.pl/projekty-domow/projekt-dom-w-zurawkach-3-p-md4e2138a2d1a5` | `dom-w-zurawkach` |
| 2 | `https://www.archon.pl/projekty-domow/projekt-dom-w-modrzykach-3-g2-mdf423d61e7247` | `dom-w-modrzykach` |

- **Disclosure checked.** Neither family is one the dummy-SHA draw of round 1 named (`dom-w-nawlociach`,
  `dom-w-renetach`), and neither is in the round-2 exclusion file.

## Runs

Each address ran **once**, live, with the frozen code: `analysis:second-house --url <address> --cache <scratch>
--out <scratch>` with `TELEMETRY=1`, which is production `runAnalysis`. Cache and output stayed outside the
repository.

| # | started (UTC) | wall | peak RSS, process tree | longest telemetry gap | longest tick gap (phase) |
| --- | --- | --- | --- | --- | --- |
| 1 | 15:37:16 | 212.5 s | 810 MB | 1.9 s | 4.8 s (`ACQUIRE_ASSETS`, network) |
| 2 | 15:40:49 | 133.8 s | 764 MB | 2.1 s | 1.3 s (`ACQUIRE_PAGE`, network) |

- **Acquisition.** Both packages were acquired whole, with no floor-plan asset lost.
  - #1: 29 assets, 12 floor-plan copies (GROUND, BASEMENT, ATTIC × 853 / 550 / 400 px, dimensioned and area-table).
  - #2: 16 assets, 4 floor-plan copies (GROUND only; single storey).
  - Failures: #1 11 `HTTP_STATUS` (guessed variant addresses) and 5 `BYTE_IDENTICAL`; #2 7 and 5.

## Verdicts

Computed by `holdout/verdict.mjs`, unchanged since round 1. `verdict.json` in each directory is that output;
re-running it on the sealed files here gives the same verdict (only the `run` path differs). `facts.json` holds
the §43 quality facts, extracted from the run's own files.

### #1 `dom-w-zurawkach` — **ALGORITHMIC_FAIL**

- **Outcome.** `RECONSTRUCTION_FAILED / PLAN_NO_MASSES`: "2 walled regions of the 853×853 px floor plan were found,
  but no building mass could be made from them that places the front of the building"; 8 readings weighed, the
  best 40.1–43.1 m² against the published **101.7 m²** (−58 to −61 %), all `WRONG`.
- **The source checklist.** No item holds: labelled floor plans (GROUND, BASEMENT, ATTIC); walls 14 px on the
  853 px ground copy; OCR tokens up to 48 px tall; no floor-plan asset lost. The stop is not source-limited.
- **Metric — right, and independent.** CONFIRMED / STRONG, 2.2182 × 2.2166 cm/px, isotropy MEASURED, 5 independent
  witnesses on 4 chains, all readings as printed: `1180` over 532 px, `750` over 338 px, `155` over 71 px, and the
  rotated vertical chain `800` + `150` over 361 + 67.5 px, read the right way up (`ROTATED_CW`). No re-read chain,
  no correction among the witnesses.
- **Extent — right.** Framed by the dimension chains on both axes, not weak, nothing refused: 532 × 428.5 px =
  **11.80 × 9.50 m**, exactly the printed overall `1180` and `800 + 150`.
- **Diagnosis, after the verdict, with nothing patched.** The first bad decision is the **garage bay**.
  1. The house is 7.50 × 8.00 m with a garage wing 4.30 m wide beside it that runs 1.50 m further forward (the
     printed `150`), fronted by two piers and a garage door with its callout `260/229`.
  2. The walled envelope stops, as designed, at the house's front wall (the 238 px band at y ≈ 436–455): the
     garage's front has no long band, only piers. The wing is left to the bays.
  3. `baysOf` proposes no bay (`bays: []`); it needs two side walls that start at the envelope edge and reach
     out at least `minOut = max(4 walls, 1.5 m) = 67.6 px`, and it finds none:
     - the left garage wall's band (x 598–620, y 456–503) starts at the edge but ends at the mouth's inner face,
       47 px = **1.04 m** out. The 1.5 m convention is measured to the band's end, the protrusion to the outer
       face, so a garage that projects exactly 1.50 m never qualifies;
     - the right garage wall is one band from y 116 to 503: it runs **through** the envelope edge instead of
       starting at it, so it is not a wall "leaving" the envelope at all (the same shape as `willa-miranda`'s
       garage).
  4. With no bay, the strip beyond the envelope is ground by construction, and the garage floods from it: the
     whole garage room (x 599.5–792, down to y 523.5), ≈ 40 m² of the 101.7, is outside. No composition then
     places the building's front.
- **Bodies.** No model.

### #2 `dom-w-modrzykach` — **ALGORITHMIC_FAIL**

- **Outcome.** `RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED`: the lowest storey covers 14.72 m² against the
  published **181.98 m²** (91.9 % apart); 63 readings weighed, the best 14.7–23.9 m², all `WRONG`; the figure `SPENT`.
- **The source checklist.** No item holds: a labelled floor plan (GROUND); walls 16 px on 853 px; OCR tokens up to
  75 px tall; no floor-plan asset lost.
- **Metric — right, and it replaced the vote.** REPLACED / STRONG, 2.7484 × 2.7455 cm/px, isotropy MEASURED,
  4 independent witnesses; the page vote's 2.6892 cm/px rested on 0 independent readings (−2.2 %). Accepted as
  printed: `1850` over 673 px and the rotated overall `1160` over 422 px, read the right way up. Two misreadings of
  printed spans (`621` for `624`, `684` for `689`) stayed RAW and witnessed nothing.
- **Extent — right.** Framed by the chains, not weak, nothing refused: 673 × 422 px = **18.50 × 11.59 m**, the
  printed `1850` and `1160`.
- **Diagnosis, after the verdict, with nothing patched.** The first bad decision is the **walled envelope's depth**:
  y 113–186.5 px, **2.02 m** of the printed 11.60 m.
  1. The building's front is almost all openings: four windows and the entrance along the house front, a 5.00 m
     garage door (`500/225`), and a 3.00 m window (`300/230`) in the left side wall. Measured on the raw 853 px copy,
     the house front at x = 150 and 400 px and the garage front at x = 600 px are thin glazing and door lines (grey
     86–147 between white), not wall ink; the garage's back wall at x = 600 is 17 px of solid ink (grey 31).
  2. The band reader therefore returns no horizontal band below y = 200 except a 31 px piece; the side walls come as
     pieces (left: 188–300 and 410–467 px; right: 201–418 px).
  3. The envelope is the box the long bands' axes span, so it stops at the one long horizontal band, the garage's
     back wall (y 184–200, 207 px). 005B's side-wall extension does not fire: the two side walls do not run to a
     common end (300/467 against 418).
  4. The bay rule then reads the two side walls as a 12.76 m bay whose mouth at y = 324 (a line through rooms 6, 9,
     11 and the garage, not a wall) is `OPEN_SIDE`, and a 7.51 m collinear gap at y = 186.5 as another open side.
     Everything below y = 186.5 floods; 5 of 99 cells remain.
- **Bodies.** No model.

## The common defect, named for the next stage

Round 1's two defects were metric (the scale on #1, the extent on #2). **Round 2's are not**: on both houses the
orientation, the scale and the printed extent are right, independently witnessed and agree with the published
footprint's box. Both houses fail one step later, where the plan's **walled outline** is taken from long wall
bands:

- a side of the building that is mostly openings (a garage door between piers, a glazed front) leaves no long
  band, so the envelope stops at an interior wall (#2), or at the house front with the garage wing left to a bay
  rule that finds no two walls leaving the envelope — one runs through its edge, the other is measured short of
  the 1.5 m minimum (#1);
- that is the same class as development house `willa-miranda` (005B residual debt: a partial wall witness and a
  garage flooding through its mouth) and as round 1's second miss on `dom-w-jablonkach`.

Per the protocol these are **not patched in 005B**. Both families now join the development set, and the next
stage's input is the walled-outline witness: an outline that the printed extent and the side walls' own reach
can contradict, instead of one taken from long bands alone.

## Files, per house

| file | what |
| --- | --- |
| `verdict.json` | `holdout/verdict.mjs` output |
| `facts.json` | the §43 quality facts (coverage, orientation decisions, observations, metric, extent, resolution, runtime) |
| `source-package.json` | the package: addresses, hashes, the publisher's text facts, the failures |
| `analysis-trace.json`, `failure.json`, `diagnostics.json` | the typed stop and its diagnostics |
| `plan-diagnostics/digest.json` | the plan reads: bands, chains, lines, cells, envelope, bays, the resolver's summary |
| `metric-evidence.json`, `observation-graph.json` | the dimension observations, metric solutions, OCR tokens, frames |
| `performance.json`, `telemetry.ndjson`, `measure.json` | the progress record, the event stream, wall and peak RSS |
