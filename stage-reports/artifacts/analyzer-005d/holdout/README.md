# Blind holdout round 4 — draw, runs and verdicts (005D)

The protocol is `holdout/README.md` (Round 4). This directory seals what the draw produced, as text facts only. No
drawing, overlay or render of a drawing is committed. The raw plans were looked at locally, for the diagnosis below,
and stay outside the repository. The two Evidence Packs written during the runs are committed beside the development
packs, unchanged (`../evidence/blind-h1-dom-w-dabecjach`, `../evidence/blind-h2-dom-w-tunbergiach`).

## Draw

- **PRE_HOLDOUT_4_SHA** `286486e6c262afa682c1374a3a8f777a6dcf5cd8`.
  - Pushed to `analyzer/dimension-chain-integrity-v1` and `claude/new-session-3kzcgh` before the draw. CI run 120
    (`36857800150`) on it: every job green, completed 12:43:07Z.
  - The tree was clean. The only commit after the freeze is the ledger line itself (`bbe8172`, `holdout/LEDGER.ndjson`,
    one line): no code changed between the freeze and the runs. The packs' manifests carry `gitSha bbe8172…` for that
    reason.
- **The ledger** (`holdout/LEDGER.ndjson`, the line labelled `BUILDPLAN-005D-DIMENSION-CHAIN-HOLDOUT`, 12:43:41Z):

| | |
| --- | --- |
| pool | `holdout/pool.txt`, sha256 `800c2a1ed9daee9efd2654c64b061e430094dc38fc459b805af27ff9fad2ed41` |
| exclusions | `excluded-families-round-4.txt`, sha256 `8c5a4a971fa5a9d9531ff0a93f793f7054a3e33fcd67e221381747c9f3ad2919` (41 families) |
| seed | `9a6b907da2378dee755be0204bbec684edb46f040018bc7d202d67ef910bd416` |
| n / excluded | 2501 drawable / 584 excluded |
| i1, i2 | 608, 2130 |
| #1 | `https://www.archon.pl/projekty-domow/projekt-dom-w-dabecjach-2-g2-m1d2240bad8ffb` (family `dom-w-dabecjach`) |
| #2 | `https://www.archon.pl/projekty-domow/projekt-dom-w-tunbergiach-7-r2-md842941974a5c` (family `dom-w-tunbergiach`) |

- **Recomputed independently.** `SHA256(PRE_HOLDOUT_4_SHA + "BUILDPLAN-005D-DIMENSION-CHAIN-HOLDOUT")` gives the
  seed; `seed mod n` gives 608; the second pick follows round 1's rule. Neither family is in any exclusion file of any
  round, and neither is a development house.

## Runs

Each address ran **once**, live, with the frozen code and the Evidence Pack on, one after the other:
`ANALYZER_EVIDENCE=1 TELEMETRY=1 analysis:second-house --url <address> --cache <scratch> --out <scratch>`, which is
production `runAnalysis`. Cache and output stayed outside the repository; nothing was re-run.

| # | started (UTC) | wall | analysis | metric phase | peak RSS | longest tick gap (phase) | longest telemetry gap | pack |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 12:43:52 | 229 s | 222.6 s | 177.5 s | 773 MB | 3.4 s (`ACQUIRE_ASSETS`, network) | 1.8 s | 32 files, 468 decisions, 148 ms |
| 2 | 12:47:51 | 205 s | 201.7 s | 156.6 s | 777 MB | 3.6 s (`ACQUIRE_ASSETS`, network) | 1.9 s | 33 files, 248 decisions, 190 ms |

## Verdicts (`holdout/verdict.mjs`, as frozen)

### #1 `dom-w-dabecjach` — ALGORITHMIC_FAIL

Refused by name: `RECONSTRUCTION_FAILED / BOUNDARY_RESOLUTION_INCONCLUSIVE` — the outline is B_STRICT 120.2 m² with
drawn openings only and B_EXCLUSION 150.9 m² bridging blank gaps, more than 6 % apart; the first reading's lowest
storey covered 116.52 m² against the published 168.76 m² (−31.0 %); 95 other readings were weighed, the best
(161.3 m², −4.4 %, at 3.571 cm/px) has only the spent figure behind it and is not adopted. The source checklist
finds nothing source-limiting (an overall dimension is legible: OCR glyphs 12 px; walls 11 px; no plan lost), so a
refusal is an algorithmic fail.

**First bad decision** (`18-decision-timeline.json`, `e00229`): `OCR_READING`,
`label:chain-horizontal-738-810fb47ebb:HORIZONTAL:1501`. The ground copy's overall width is printed `1580` over
153–715 px; it is read `1501` (glyphs 12 px; the third glyph `8` read `0` at 0.16 with no runner-up, the fourth `0`
read `1`), with no bounded alternative — the true figure is two substitutions away and outside the reader's lattice.
Every overall on the copy is read, and five of six are wrong (`1580` above): `888` (right), `692` → `643`, `1340` → `1700`,
`850` → `810` (whose runner-up `850` is at 0.98), `490` → `141`. Then:

1. `e00230` binds `1501` PRIMARY to 153–715 (centred 0.006) — the right span.
2. `e00301`/`e00311` record the conflict as read: total `1501` against parts `888 + 643 = 1531`
   (`CONFLICT_AS_READ`), and `e00302` total `1700` against `810 + 141 = 951`.
3. `e00407` `METRIC_RELATION` CONFIRMED/STRONG at 2.672 cm/px on two independent readings — `1501`/562 px and
   `810`/302 px — two misreads that happen to agree (2.671 and 2.682). The printed figures state 2.81 on four chains
   (`1580`/562, `888`/316, `850`/302, `1340`/476); the rival 2.81 had one counted reading (`888`). The conflict did not
   make the scale undecided because `810`, outside that pair, counted for the selection; `810`'s own runner-up fits
   the rival, but rival neutrality only acts when it would swap or tie the selection, so it kept counting.
4. On the plan at 2.672 cm/px (−4.9 % linear, −9.6 % area) the outline is adopted (`e00458`), the garage is
   classed `COVERED_TERRACE` and not built (`e00459`, 37.21 m²; the publisher prints a 36 m² garage), the plan reads
   116.5 m², the published figure refuses it and is spent, and the boundary layer cannot choose between B_STRICT and
   B_EXCLUSION: the run stops by name.

The scale was wrong before the boundary had a chance: the first bad decision is in the reader, not in 005D's topology
(every tick, binding and hierarchy decision on the overall lines was right).

### #2 `dom-w-tunbergiach` — ALGORITHMIC_FAIL

Completed: 1 body 103.06 m² against 117.74 (−12.47 %, fails the 10 % footprint condition), 8 openings (every printed
one built, holds), storeys 1 of 3 (fails: `PLAN_STOREY_ALIGNMENT_FAILED`, "no scaling of this plan puts its walls on
the walls of the plan below"), model `9d92a2ea…`. Warnings: `LAYOUT_FOOTPRINT_AREA_NEAR`, `LAYOUT_NO_MASS_REACHES_UP`,
`METRIC_SCALE_UNSUPPORTED`, `PLAN_EXTENT_FROM_WALLS`.

**First bad decision** (`e00109`): `OCR_READING`, `label:chain-horizontal-758-e7e091be90:HORIZONTAL:1117`. The
ground copy's overall width is printed `1173` over 132–692 px (560 px); it is read `1117` (glyph height 17 px,
confidence 0.52; the third glyph `1` at 0.485 against `7` at 0.452, the fourth `7` at 0.436 against `3` at 0.405).
Both true glyphs are runners-up at ≥ 0.9 of the winners, but the truth needs both substitutions; the bounded
readings are one substitution away (`1177`, `1113`, `1115`, `1137`), so `1173` is outside them. The same figure is
misread on every copy (`1119` on the 550 px copy, `1177` on the 400 px copy), and `1000` once as `1010`. Then:

1. `e00110` binds `1117` PRIMARY to 132–692 (centred 0.007) — the right span; `e00108` binds `1000` PRIMARY to
   175–653 — right, read right.
2. `e00181`/`e00182`: two scale hypotheses, one independent reading each — 2.092 (`1000`/478 px, Y) and 1.995
   (`1117`/560 px, X). No hierarchy conflict: the line under `1173` carries no read children.
3. `e00187` `METRIC_RELATION` LEGACY_UNCONFIRMED/INCONCLUSIVE: the page vote's 1.994682 (it took `1117` and discarded
   `1000`) is kept, because the drawing's alternative does not outweigh it twice over. INCONCLUSIVE, named — but
   the plan is registered at it (1.9946 × 2.0194).
4. `e00247` `FIRST_SUCCESS_CHALLENGE` KEPT: the trigger fired (scale INCONCLUSIVE, frame from walls); the 2.09205
   reading builds 111.9 m² (−4.9 %, AGREES), but the drawing does not prefer it to the first reading (one reading
   each), and the figure may not choose a scale: `publishedFigure: SCORED`, the first reading kept, completed at
   −12.47 %.

The 005D rules held where they were asked (the figure chose nothing; the tie was named INCONCLUSIVE); what failed is
the reader, and the completion of a plan whose scale the drawing itself leaves undecided between two single readings.

## Holdout quality record (§52)

| | #1 `dom-w-dabecjach` | #2 `dom-w-tunbergiach` |
| --- | --- | --- |
| assets | 23 with roles (34 fetched, 14 failures: 9 guessed variants HTTP 404, 5 byte-identical) | 24 (35 fetched, 16 failures: 11 × 404, 5 byte-identical) |
| plans | 8 copies, GROUND and ATTIC; 853 px dimensioned and area-table, 550 and 400 px dimensioned | 12 copies, GROUND, UPPER, ATTIC; the same four kinds |
| published | footprint 168.76 m², garage 36 m², usable 193.64 m², 10 facts | footprint 117.74 m², usable 162.96 m², 9 facts |
| selected copy | `frame-asset-rzut-1a56066c62-10b0ec4131`, GROUND dimensioned 853 × 853 | `frame-asset-rzut-83377e8ffc-c1a88b7f25`, GROUND dimensioned 853 × 853 |
| dimension lines / marks | 83 lines; 192 tick, 93 questionable, 6 rejected | 62 lines; 140 tick, 55 questionable, 5 rejected |
| bindings | 20 primary, 24 alternative, 2 ambiguous, 15 uncentred | 10 primary, 31 alternative, 6 ambiguous, 1 uncentred |
| hierarchy | 12 totals: 2 `CONFLICT_AS_READ`, 10 incomplete; 3 parallel copies | 10 totals, all incomplete; 1 parallel copy |
| OCR on the overalls | 5 of 6 misread (above); glyphs 12 px; `1580` → `1501` with no alternative | `1173` → `1117` (truth two substitutions away), `1000` right; glyphs 17 px |
| orientation | page upright (`PAGE_UPRIGHT`) | page upright |
| independent witnesses | 2 (`1501`, `810` — both misread) | 1 each side of a tie (`1117` against `1000`) |
| scale | CONFIRMED/STRONG 2.672 cm/px, isotropy MEASURED; printed figures state 2.81 | LEGACY_UNCONFIRMED/INCONCLUSIVE 1.9947, isotropy ASSUMED; printed figures state 2.09 |
| extent | `DIMENSION_CHAIN_EXTENT` 153–718.5 × 158.5–635 | `EXTERIOR_CHAIN_TICKS`, weak, 132–692 × 175–653 |
| model / scene | none (refused) | `9d92a2ea…` / `d2f6ce4c…`, 1 body, 5 rooms, 84 meshes |
| storeys / openings | — | 1 of 3 / 8 of 8 |
| runtime / RSS | 222.6 s / 773 MB | 201.7 s / 777 MB |
| heartbeat gap | 3.4 s (network) | 3.6 s (network) |
| published residual | −31.0 % first reading (refused); best other −4.4 % not adopted | −12.47 % built; −4.9 % at the drawing's other reading, not adopted |
| figure verifier-only | yes: refused the first reading, then spent; chose nothing | yes: scored the two readings, chose neither |
| Evidence Pack manifest sha256 | `2ff92aaed9d8400a50d3c38410633cb66360b86ead9cd7d994fff8247a8adf75` | `1604df48918836137e9c95eb9569bdb46d7d1db763487ce13367749d8b84d019` |

## Files

Per run: `source-package.json`, `observation-graph.json`, `metric-evidence.json`, `analysis-trace.json`,
`performance.json`, `evidence-performance.json`, `telemetry.ndjson`, `plan-diagnostics/digest.json`, `verdict.json`
(`node holdout/verdict.mjs <run dir>`); #1 also `failure.json`, `diagnostics.json`; #2 `model.json`,
`result-summary.json`, `source-hashes.json`. No image. The packs pass `evidence:verify` with the development packs
(16 packs, the stage's bound).
