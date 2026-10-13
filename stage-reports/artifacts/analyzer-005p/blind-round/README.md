# 005P blind round 11 — draw, runs, sealed verdicts, diagnosis

The protocol is `holdout/README.md` § Round 11, fixed before the freeze (`e0cb807`, amended before the freeze in
`94782ac`: the target class also reads `conflictCited`). The exclusion manifest is `exclusion-manifest.json`.

## Freeze

- `PRE_HOLDOUT_11_SHA = 6f4d7cadd7ffa69d8a49b7f2079f8ba72388285c`.
- Its CI run 38425412552 (https://github.com/damiankrok/BuildApp/actions/runs/38425412552) was **green on attempt 1**:
  39 jobs pass, 2 skipped by design (the two APK publishing jobs, dispatch-only). The Android UI evidence gate passed
  on that attempt; it had failed on the two runs before it (`761a28d`, and `191b926`, a commit with no production
  change) with a Compose UI-test race (`SnapshotStateObserver` multithreaded access; 1.3× font journey timeout) while the
  on-device analyzer produced byte-identical models and scenes on both — recorded, not used.
- Reviews closed before the freeze (rounds 1–3: 0 P0, 0 open P1).
- Nothing was committed between the freeze and the draw. After it: the ledger line (`fc0f6a6`), the sealed verdicts and
  Evidence Pack layers (`adbeb1c`), these records and the stage report. No production code changed.

## Draw — 2026-10-13T16:48:20Z, ledger line `BUILDPLAN-005P-METRIC-GUARD-HOLDOUT`

- **Seed:** `SHA256(6f4d7cad… + "BUILDPLAN-005P-METRIC-GUARD-HOLDOUT")` =
  `2c369d9f0c790a9ceaa12fd2b7be14fc84296afdfb6c0644efce095f46516313`, recomputed independently with `sha256sum`.
- **Pool:** `800c2a1e…2ed41`; **1518 drawable**, 1567 excluded.
- **Exclusions:** `excluded-families-round-11.txt`, SHA-256 `c7b611db…869d` (141 families). Neither drawn family is in
  it; neither appears in any committed text file except `holdout/pool.txt`; no earlier work directory holds either.
- **Pick 1, unstratified:** i1 = 1 → `dom-miniaturka` (`https://www.archon.pl/projekty-domow/projekt-dom-miniaturka-2-ver-3-m4c723a6c22f61`).
- **Pick 2, unstratified:** i2 = 712 over every other family → `dom-w-krasnokwiatach`
  (`https://www.archon.pl/projekty-domow/projekt-dom-w-krasnokwiatach-md4721b13efcd5`).
- No stratum, so nothing of either page was read for the draw.

## Runs (once each, NEW then OLD, pick 1 then pick 2, nothing else running)

- **NEW**: the frozen code (plan resolver 1.5.0), live:
  `ANALYZER_EVIDENCE=1 TELEMETRY=1 npx vite-node packages/analysis-service/scripts/second-house.ts -- --url <address> --cache <scratch> --out <scratch>/new --recogniser`
  (external recogniser on, Evidence Pack on, 005K drawn-gap rule OFF).
- **OLD**: 5906afa's `packages/reconstruction/src` aliased (`research/analyzer-005p/old-resolver.mjs`), solver only on
  the NEW run's sealed package, graph and metric evidence.
- **A launch that never ran.** Pick 1's first NEW launch (16:48Z) was wrapped in `/usr/bin/time`, which this container
  does not have: the shell exited 127 before any analyzer process started (no page fetched, nothing analysed, the cache
  directory empty). It was relaunched without the wrapper; this is the house's one and only run.

| # | run | started → ended (UTC) | peak RSS | longest telemetry gap | outcome | pack |
| --- | --- | --- | --- | --- | --- | --- |
| 1 `dom-miniaturka` | NEW | 16:49:06 → 16:54:53 (336 s) | 903 MB | 4.3 s | COMPLETED, 2 masses, 15 openings, model `cbe3a5fc…` | 38 files, 735 decisions |
| 1 | OLD | 16:55:03 → 16:55:18 | — | — | COMPLETED, model `cbe3a5fc…` (**byte-identical** `model.json`) | — |
| 2 `dom-w-krasnokwiatach` | NEW | 16:55:22 → 17:02:10 (401 s) | 905 MB | 2.8 s | `RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED` (11.67 m² vs 143.18 m²) | 37 files, 640 decisions |
| 2 | OLD | 17:02:16 → 17:02:31 | — | — | the same; **`failure.json` byte-identical** | — |

Committed of each pack: its JSON layers and `README.md`/`manifest.json` (`evidence/`). SVG layers, the plan overlay,
cached pages and drawings stay outside the repository.

## Verdicts (`holdout/verdict.mjs`, as frozen) — sealed 17:02:36Z (NEW), 17:02:57Z (OLD), before any diagnosis

| # | NEW | OLD | `verdict-*.json` SHA-256 (as printed, before the scratch path was redacted) |
| --- | --- | --- | --- |
| 1 `dom-miniaturka` | **PASS** (2 storeys = 2 plans; footprint 108.34 vs 106.76 m², +1.48 %; first reading held, no challenge) | **PASS** | new `8b5a439f…`, old `7fd91df8…` |
| 2 `dom-w-krasnokwiatach` | **ALGORITHMIC_FAIL** (typed refusal, no model) | **ALGORITHMIC_FAIL** | new `35f64661…`, old `d7fb0987…` |

**The OLD verdicts needed the run's own input graph.** A solver-only run does not write `observation-graph.json` into
its output directory; the frozen verdict reads it for the legibility checklist, and without it returned
`PENDING_RAW_LEGIBILITY_MEASUREMENT` for #2 OLD (`…-old-without-graph.json`, `7a9b3387…`; #1 OLD `71387b88…`, PASS).
The exact file the OLD solver read (`--graph`, byte-identical to NEW's) was copied into each OLD directory and the
unchanged verdict re-run (17:02:57Z). The verdict code and its thresholds were not touched.

**005P has a fresh ALGORITHMIC_FAIL, so the stage is PARTIAL** (brief §5).

**TARGET_CLASS_EXERCISED = NO.** Neither NEW trace records a `SOURCE_CONFLICT_REVIEW`, a source conflict, `conflictDoubted`,
`conflictCited` or `registrationShareMovedBy`, and OLD and NEW decide identically on both houses (#1 model bytes; #2
plan-resolution record and failure bytes). The round is valid whole-house evidence; it does **not** show that the
metric guard generalizes.

## Diagnosis — after the seal, from the sealed Evidence Packs (one forensic reader, one adversarial verifier who agreed)

### #1 `dom-miniaturka`: PASS (no first bad decision that decides the outcome)

The ground plan's scale is CONFIRMED / STRONG (3.243 cm/px, 4 independent witnesses), so the first reading kept the fast path and held; no challenge, no source conflict, so the metric guard had nothing to decide. One LIMITING
warning (`EXTERIOR_JOINTS`) and 14 unresolved items are recorded in the model.

### #2 `dom-w-krasnokwiatach`: FIRST_BAD_DECISION = TOPOLOGY_BOUNDARY

- **Right (KNOWN):**
  - 8 floor-plan frames, storeys GROUND/ATTIC labelled correctly.
  - The dimensioned 853 px ground plan was selected as base.
  - The printed totals were read and bound correctly: 950 and 1610, and 430 / 780 / 400 and 270 / 257 / 423, with the external reader AGREES on 950, 1610 and 400.
  - **The scale is right:** 2.511 × 2.5114 cm/px, from 7 independent readings on 3 chains. It replaced a one-reading page vote of 2.566.
  - **The extent is right:** DIMENSION_CHAIN_EXTENT 9.55 × 16.10 m = 950 × 1610.
- **First bad (KNOWN), envelope decision e00592:**
  - The walled envelope became the box over the long wall bands, `155,248,535,559`. That box is only the middle 780 cm strip of a stepped three-part plan.
  - Its N edge snaps to an interior partition merged with the fireplace symbol. The real N facade is mostly a 400 cm window and the S front a 285 cm garage door: piers that leave no long band (the 005B class).
  - The 28 px fireplace + partition band also makes `sideWallReach` read the box as ending on a facade.
- **Consequences:**
  - The STRONG N and S extent conflicts (4.29 m, 3.99 m) were detected but resolved as "nothing is built". The N strip had merged with the covered terrace, and the window counted as an open mouth; the garage strip was WALLED_OFF.
  - The garage door, outside the envelope, was never read as a wide opening, so the flood leaked into the hall.
  - The result is one mass of about 11.7 m², FOOTPRINT_AREA_WRONG, and 47 all-WRONG resolver readings. The "area_table" copy is only the top of that all-WRONG list, not a cause.
- **After-the-fact area check (INFERRED, the verifier's correction):**
  - The walled parts at this scale (N wing 29.4, middle 74.5, garage 17.1) total 121.1 m².
  - Adding the covered NW terrace (11.5 m²) and the porch (about 10.3 m²) gives about 142.9 m², against the published 143.18 m² (−0.2 %). The scale is consistent.
- **005P:** the conflict review ran (footprint-only path) and found nothing to accuse or withdraw. The registration fits every long printed total. The failure is downstream of a correct metric and orthogonal to the metric seam.

Not reproducible from the repository: the publisher's pages and drawings (not committed, by rule); the live run
depends on the site as it was at 16:49–17:02Z. The sealed inputs' hashes are in the packs' `00-source-summary.json`.
