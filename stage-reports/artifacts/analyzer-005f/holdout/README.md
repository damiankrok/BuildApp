# Blind holdout round 6 — draw, runs and verdicts (005F)

The protocol is `holdout/README.md` (Round 6). This directory seals what the draw produced, as text facts only. No
drawing, overlay or render of a drawing is committed. The raw plans were looked at locally for the diagnosis below and
stay outside the repository. The two Evidence Packs written during the runs are committed beside the development packs,
unchanged (`../evidence/blind-h1-dom-pod-milorzebem`, `../evidence/blind-h2-dom-w-helikoniach`).

## Draw

- **PRE_HOLDOUT_6_SHA** `65ae015fd1e32e6e0de312b0d78301d9a4d07f03`.
  - Pushed to `analyzer/adaptive-segmentation-envelope-v1` and `claude/new-session-3kzcgh` before the draw.
  - CI run 145 (`37018192503`, push) on it: 37 jobs, 36 green and `preview-latest` skipped by design (push),
    completed 15:01:28Z.
  - The tree was clean.
  - The only commit between the freeze and the runs is the ledger line itself (`951a4d0`, `holdout/LEDGER.ndjson`, one
    line). The runs were made from the worktree at `951a4d0`, whose code is the freeze's.
- **The ledger** (`holdout/LEDGER.ndjson`, the line labelled `BUILDPLAN-005F-ADAPTIVE-SEGMENTATION-ENVELOPE-HOLDOUT`,
  15:08:37Z):

| | |
| --- | --- |
| pool | `holdout/pool.txt`, sha256 `800c2a1ed9daee9efd2654c64b061e430094dc38fc459b805af27ff9fad2ed41` |
| exclusions | `excluded-families-round-6.txt`, sha256 `0f9bb150919df03c789df55366124985c76f09433dc6bcc2f099ae2f4a28ae9d` (45 families) |
| seed | `7d572d71218e0acaaa3a39de61e25456b2444933359f8aae5c40699c253eea2c` |
| n / excluded | 2462 drawable / 623 excluded |
| i1, i2 | 164, 802 |
| #1 | `https://www.archon.pl/projekty-domow/projekt-dom-pod-milorzebem-21-gb-mdab2497c5cb47` (family `dom-pod-milorzebem`) |
| #2 | `https://www.archon.pl/projekty-domow/projekt-dom-w-helikoniach-3-e-oze-md6026d579e43f` (family `dom-w-helikoniach`) |

- **Recomputed independently.** `SHA256(PRE_HOLDOUT_6_SHA + "BUILDPLAN-005F-ADAPTIVE-SEGMENTATION-ENVELOPE-HOLDOUT")`
  gives the seed, and `seed mod 2462` gives 164. Neither family appears in any exclusion file of any round, anywhere
  under `stage-reports/`, `packages/`, `apps/`, `tests/` or `.github/`, and neither is a development house.

## Runs

Each address ran **once**, live, with the frozen code and the Evidence Pack on, one after the other:
`ANALYZER_EVIDENCE=1 TELEMETRY=1 analysis:second-house --url <address> --cache <scratch> --out <scratch>`, which is
production `runAnalysis`. Cache and output stayed outside the repository, and nothing was re-run.

| # | started (UTC) | wall | analysis | metric phase | of it, the lattice | peak RSS | longest tick gap | longest telemetry gap | pack |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 15:10:08 | 171 s | 165.7 s | 132.0 s | 4.3 s | 734 MB | 2.6 s (`ACQUIRE_ASSETS`, network) | 2.3 s | 32 files, 184 decisions, 148 ms |
| 2 | 15:13:05 | 188 s | 180.5 s | 145.1 s | 4.3 s | 790 MB | 4.6 s (`ACQUIRE_ASSETS`, network) | 2.0 s | 33 files, 352 decisions, 284 ms |

## Verdicts (`holdout/verdict.mjs`, as frozen)

### #1 `dom-pod-milorzebem` — ALGORITHMIC_FAIL (numeric reader: a confident misread)

The run refused by name: `RECONSTRUCTION_FAILED / METRIC_RESOLUTION_INCONCLUSIVE`, typed
`DIMENSION_EVIDENCE_INCONCLUSIVE` (4 witnessing labels on 4 lines). No scale was adopted, so no wrong building was built.
The source checklist finds nothing source-limiting: the selected ground copy (`rzut-ebe6069a09`, 853×853) prints its
overall dimensions legibly (cap 49 px tallest), and walls are 11 px. A refusal is therefore an algorithmic fail.

The plan is a narrow terraced house: `1270` on the vertical overall, `648` and `650` on two horizontal lines below it —
6.5 × 12.7 m against the published 82.81 m². Both overalls state about 2.445 cm/px.

| label | 005D read | 005F as-read | class | in the lattice |
| --- | --- | --- | --- | --- |
| `1270` (vertical overall, 519.5 px) | `1770` | `1270` (right) | SUPPORTED | — |
| `650` (horizontal overall, 265.5 px) | `610` | `650` (right) | AMBIGUOUS | `610` at 0.52 of it |
| `648` (horizontal, 265.5 px) | `008` | **`608`** | **SUPPORTED** | `648` at 0.22 of it |

**First bad decision:** `e00047`, `OCR_SEQUENCE_CANDIDATES`, `ink:text-region-280-734-c61c6f0d9b:HORIZONTAL` — the
`648` ink's lattice `608|000,008,048,108,600,648,808`, as-read `608` SUPPORTED (p 0.487), the truth `648` its next value
at 0.22 of it. Its twin copy (`e00053`) reads the same. The digit count is right (three cells); the `4` is read `0` — a
confident single-glyph misread, the class's declared limit (`../calibration/README.md`).

Then `e00058` `READ:608`, bound PRIMARY, states 2.290 cm/px against the 2.445 the right overalls state (`1270`
SUPPORTED with `650` AMBIGUOUS, counted as one independent group). The metric refuses (`NO_SCALE/INCONCLUSIVE`,
hypotheses 2.445 and 2.290 at one independent group each); the `608` reading is recorded as contested, its own `648`
fitting the true scale. The refusal says which evidence is there and why it does not decide; it does not say the plan
prints no dimension.

### #2 `dom-w-helikoniach` — ALGORITHMIC_FAIL (upper-plan metric and envelope; ground outline faces)

The run completed with 1 body, 77.56 m² against the published 95.61 m² (**−18.88 %**, which fails the 10 % footprint
condition), and **1 storey of the 2 the plans show** (fails). Every printed opening is built (holds). Limits:
`LAYOUT_FOOTPRINT_AREA_NEAR`, `NO_MASS_REACHES_UP`, elevation registration failed.

**The ground scale is right.** The plan prints `1360` (= 1263 + 97) on the vertical and `700` (= 326 + 374) on the
horizontal: 7.00 × 13.60 m. `e00287` is CONFIRMED/INCONCLUSIVE at 2.305 cm/px (one independent reading); 590 px × 2.305 =
13.60 m and 305.5 px × 2.305 = 7.04 m.

**First bad decision:** `e00319`, `METRIC_RELATION`, the attic plan (`rzut-f6160738fd`): the page vote's 3.08 cm/px is
kept as LEGACY_UNCONFIRMED — no reading that owes nothing to it supports it. The attic plan prints no overall; its room
chains (`300` + `300` across, `416`, `477`, `357`) and its drawn outline (about 307 px across the walls) state about
2.3 cm/px, the ground plan's scale. Its chain extent is read as a 3.2 m strip (x 187.7–290 of a plan whose walls span
x 133–440), so its registered envelope covers too little of the ground body for any mass to reach the upper storey
(`NO_MASS_REACHES_UP`): 1 storey of 2.

**Second, independent failure:** `e00335`, `ENVELOPE`, the ground plan: the box (`e00334`, x 158–459 × y 189–752, about
90 m²) is right, but the opening-aware outline is adopted and "the plan is cut on the outline". The mass (`e00350`) is
x 181–459 × y 189–710. It leaves out:

- the west wall band, which is mostly glazing (the body ends at the wall's inner face there and at the outer face on
  the east);
- below y 710, the lower end of the west room as far as its outer wall, and the recessed entrance on the east, which
  the 97 cm segment of the `1360` chain states.

The 005F extent conflicts were raised on both sides (`e00336` N STRONG, `e00337` S STRONG) and judged INCONCLUSIVE: the
parts the outline left there are wall-thick ink (`WALL_SLIVER`, `e00338`–`e00344`). Nothing was invented. What was
lost is wall and floor the box already held, given up when the plan was cut on the outline — the 005C boundary layer,
not this stage's completion rules.

Neither failure is patched in 005F. Both first bad decisions are the next stage's input (report §AH).
