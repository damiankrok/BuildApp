# Blind holdout round 8 — draw, runs, verdicts and diagnosis (005I)

The protocol is `holdout/README.md`, round 8. This directory records what the draw produced, as text facts only. No
drawing, crop, overlay or render of a publisher drawing is committed. The raw plans were looked at locally for the
diagnosis below and stay outside the repository. The two Evidence Packs written during the runs are committed
unchanged (`evidence/blind-h1-dom-w-gozdzikowcach`, `evidence/blind-h2-dom-w-cyklamenach`): JSON and SVG primitives in
the frame's own pixel coordinates. Neither run completed, so there is no model render.

## Freeze

- **PRE_HOLDOUT_8_SHA** `869cb018cf9debe2e6b1f137a5b3d887d33aa1ee`.
  - Pushed to `analyzer/dimension-topology-boundary-bakeoff-v1` and `claude/new-session-3kzcgh` before the draw.
  - CI run 169 (`37464801271`, push) on it: 39 jobs green, 2 skipped by design (preview and OWNER APK on push).
  - The tree was clean.
- **Production code** is `c0ad2e8`'s. `c0ad2e8..869cb01` touches only `research/` (Track B) and `stage-reports/`.
- **Ledger.** The only commit between the freeze and the runs is the ledger line itself (`0c67728`,
  `holdout/LEDGER.ndjson`, one line). The runs were made from the main worktree at `0c67728`, whose code is the
  freeze's (`git diff 869cb01 0c67728 -- packages apps` is empty).
- **Freeze preconditions** (brief §47), all met at `869cb01`:

| precondition | status |
| --- | --- |
| dimension-topology synthetic corpus | green: 116 / 116 (`dimension-topology-synthetic.json`) |
| mutations | green: M1–M5 caught at `c0ad2e8` (`mutation-results.md`) |
| order invariance | green: 135 sealed frames × 24 shuffles, nothing moved (`order-invariance.json`) |
| blind-7 `dom-pod-jarzabem` old first bad decision | removed (`baseline.md`, `development-matrix.json`) |
| `dom-w-arkadiach` | not regressed: PASS, −0.49 %, model identical |
| OCR hashes | unchanged on all 24 rows (`ocr-regression.json`) |
| development matrix | complete, 24 rows, no verdict changed, four model movements explained |
| current e-OZE | PASS, +1.57 % |
| full CI | run 169 green |
| boundary bake-off | complete; manifests pinned; licensing matrix complete; results recorded; isolation test green; recommendation frozen (NONE) |

## Draw

The ledger line (`holdout/LEDGER.ndjson`, labelled `BUILDPLAN-005I-DIMENSION-TOPOLOGY-BOUNDARY-BAKEOFF-HOLDOUT`) was
written at 13:34:30Z:

| | |
| --- | --- |
| pool | `holdout/pool.txt`, sha256 `800c2a1ed9daee9efd2654c64b061e430094dc38fc459b805af27ff9fad2ed41` |
| exclusions | `excluded-families-round-8.txt`, sha256 `4202abe005e651ba902097b0431e282be4baa89af016d268da4ac8d3c26c43d2` (68 families) |
| seed | `e0ea9a3513328a3c42ee58065e01f8aed646ba014464315e07c5b2a73a1602e4` |
| n / excluded | 2137 drawable / 948 excluded |
| i1, i2 | 609, 444 |
| #1 | `https://www.archon.pl/projekty-domow/projekt-dom-w-gozdzikowcach-3-m79923e950094d` (family `dom-w-gozdzikowcach`) |
| #2 | `https://www.archon.pl/projekty-domow/projekt-dom-w-cyklamenach-3-s-ver-3-m1b323a6595d29` (family `dom-w-cyklamenach`) |

- **Recomputed independently.** `SHA256(PRE_HOLDOUT_8_SHA + "BUILDPLAN-005I-DIMENSION-TOPOLOGY-BOUNDARY-BAKEOFF-HOLDOUT")`
  gives the seed.
- **Unseen.**
  - Neither family is a development house, a bake-off house or in any round's exclusion file.
  - In the repository's history the names occur only in `holdout/pool.txt` and the ledger line.
  - Neither drawn page, nor any of their drawings, was in any byte cache or research directory before the draw. Every
    cache was searched for both addresses.
- **Disclosed: an exclusion gap.** Each family's name occurred before the draw in one place:
  - a cached **round-4** blind page (now a development house) lists `dom-w-gozdzikowcach-g2` among its "similar
    projects";
  - a cached **round-6** blind page lists `dom-w-cyklamenach-3-b-ver-3`.

  Both are other variants of the drawn families, addresses only; neither was ever fetched or opened. Round 8's
  exclusion swept the links of round 7's pages only, not those of the earlier blind pages that are now development
  houses. By round 8's own rule ("their names were on pages the analyzer read during development"), those link lists
  should have been swept too.
  - The draw stands as frozen: re-drawing after seeing the picks would be selection.
  - The next round's exclusion file should sweep the links of every development page.

## Runs

Each address ran **once**, live, with the frozen code: the external recogniser **on** (worker per plan, pinned model
`9ef676d6…`, WASM `3398c10d…`), the Evidence Pack on, one after the other. The command:
`ANALYZER_EVIDENCE=1 TELEMETRY=1 npx vite-node packages/analysis-service/scripts/second-house.ts -- --url <address>
--cache <scratch> --out <scratch> --recogniser`. This is the production analyzer only. The research boundary providers
are not in it and were not run. Cache and output stayed outside the repository, and nothing was re-run.

One launch before run #1 never started the analyzer: it was wrapped in `/usr/bin/time`, which this container lacks
(exit 127). No output directory was created, no byte was fetched and the cache stayed empty. The run below is the
first and only execution.

| # | started (UTC) | wall | metric phase | external OCR | peak RSS | longest telemetry gap | longest tick gap | pack |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 13:38:09 | 279 s | 219.1 s (opening callouts 155.1 s, external OCR 40.6 s) | 283 labels, all read | 949 MB | 2.0 s | 5.6 s | 34 files, 513 decisions, 248 ms |
| 2 | 13:42:55 | 244 s | 201.6 s (callouts 147.0 s, external OCR 33.2 s) | 238 labels, all read | 928 MB | 2.5 s | 4.2 s | 34 files, 529 decisions, 214 ms |

## Verdicts (`holdout/verdict.mjs`, as frozen)

| # | family | outcome | verdict |
| --- | --- | --- | --- |
| 1 | `dom-w-gozdzikowcach` | `RECONSTRUCTION_FAILED / PLAN_RESOLUTION_INCONCLUSIVE`: first reading 3 bodies, 105.47 m² against 132.52 m² (−20.4 %); 23 other readings weighed; the best (1 body, 131.3 m², −0.9 %) has only the spent published figure behind it | **ALGORITHMIC_FAIL** |
| 2 | `dom-w-cyklamenach` | `RECONSTRUCTION_FAILED / PLAN_RESOLUTION_INCONCLUSIVE`: first reading 2 bodies, 49.20 m² against 92.48 m² (−46.8 %); 71 other readings weighed; the best (1 body, 92.3 m², −0.2 %) has only the spent published figure behind it | **ALGORITHMIC_FAIL** |

Neither checklist item for SOURCE_LIMITED_PARTIAL applies: floor plans are present, the overall dimensions are
legible, and the walls are 12–13 px. The verdict files are beside this README (`verdict-*.json`), as the script printed
them, with the scratch path replaced by `<scratch>`. Both refusals are typed. In both, the resolver found the right
reading and was not allowed to choose it on the published figure alone (non-circularity, by design).

## Diagnosis (brief §49)

Read from the sealed Evidence Packs and plan diagnostics. The raw plans were looked at locally. Nothing was changed,
re-run or re-scored.

**Dimension topology and metric were right on both houses.**

| | #1 `gozdzikowcach` | #2 `cyklamenach` |
| --- | --- | --- |
| selected plan copy | `…64bd1e0f2f`, 853 × 853 px, walls 12 px | `…8e7eb2ad66`, 853 × 853 px, walls 13 px |
| scale | CONFIRMED / SUPPORTED: page vote 2.5305, 4 independent readings on 2 chains state 2.5417 cm/px | CONFIRMED / SUPPORTED: page vote 2.0289, 2 independent readings on 2 chains state 2.0290 cm/px |
| side convention | horizontal STATED BEFORE (5 anchors), vertical CONSISTENT | CONSISTENT on both axes |
| label ink | 31 marks rejected or doubted, 2 labels refused (AMBIGUOUS) | 18 marks, none refused |
| extent | dimension-chain extent on both axes: 545 × 377 px ≈ 131.6 m² | dimension-chain extent: 449 × 498.5 px ≈ 92.1 m² |

The extent rectangle alone is within 1 % of the published footprint on both. What went wrong is downstream.

### #1 `dom-w-gozdzikowcach` — FIRST_BAD_DECISION: BODY_RELATION

The house is two full-depth wings with a central column between them: hall, stair and part of the living room. The
column's front is an inner wall carrying the entrance door (105/210) and a narrow door (70/210), about 1 m behind the
wings' front faces. In front of it is a shallow recessed entrance porch, and to its right the garage door (325/225).

1. **First bad decision** (`12-opening-observations.json`, `wideOpenings[opening-1]`). The front line (y = 598 px) is
   open from 284 to 590 px. That run holds the porch mouth and the garage door, with the garage's front pier set back
   between them, and was read as one 7.76 m gap. It was decided **OPEN_SIDE**: "wider than a lintel conventionally spans, only
   39 % drawn across: where the wall stops; behind it lies only a 71.1 m² pocket (a porch, a loggia, a recess)". The
   "pocket" is the hall and stair, closed by the inner front wall with the entrance door.
2. `ENVELOPE_EXTENT_CONFLICT` (`e00510`): POLICIES_DISAGREE on the central 21.8 m².
3. `BODIES` (`e00511`): 3 bodies — the two wings and the top of the central column. The hall and stair column is left
   out: 105.47 m².

This is the class blind-7 #1 (`dom-pod-jarzabem`) was left with after 005I's fix: a **recessed entrance between two
wings**, read as an open pocket rather than a porch in front of a closed wall. The callout reader also returned
nothing usable on this sheet. Every value checked against the sheet is wrong — for example `416/42` for a 180/230,
`460/40` for a 300/230 and `616/400` for a 100/150 — and the two callouts on the hall's front wall were not found. It
did not decide this: vehicle doors and drawn openings are recognised from the drawing, not from callouts.

### #2 `dom-w-cyklamenach` — FIRST_BAD_DECISION: BOUNDARY

The living room (with the stair) is the house's whole north-west block, about 40 m². Its north facade carries a
1.80 m window (180/160) and a 1.80 m double terrace door (180/230), both between wall pieces. A textured terrace fill
runs along the outside of that facade.

1. **First bad decision** (boundary evidence, `plan-diagnostics/digest.json` → completion `weakGaps`). The window's
   glazing, lying against the textured terrace fill, is read as a pattern (`DASHED`, 1.78 m), not glazing. The double
   door reads `LEAF_FACE` (1.66 m). Both are wall-jambed and both stay **UNKNOWN_GAP / WEAK**. The envelope encloses
   9 of 15 cells.
2. `ENVELOPE_EXTENT_CONFLICT` (`e00526`): the 40.44 m² block's box completion is **REJECTED, NO_CONTINUATION**. It
   shares 12.79 m of junction with the built rooms, 5.12 m of it open, and was read as "walled off from them, not their
   end", though its own outer sides are 75 % wall. The junction is interior: the living room opens to the hall and
   kitchen.
3. `BODIES` (`e00527`): 2 bodies — the boiler room and garage strip, and the kitchen and hall strip — 49.20 m².

Also wrong, not decisive: the callout reader missed `180/160` and read `180/230` as `100/230` and `105/210` as
`100/49`. Gap classification does not read callouts, and the door's 1.66 m is outside the callout tolerance of 1.80 m.

### Would a research provider have helped? (recorded after the verdicts were sealed)

No, by the bake-off's own measurements. On both houses the evidence a provider could add is already in BuildPlan's
observations:

- the walls and openings are drawn and found;
- the extent rectangle the MobileSAM box would be prompted with already gives the right footprint.

The failures are interpretation: a recessed porch read as a pocket, glazing on a textured terrace read as a pattern,
and an interior junction read as a separating wall. This is the class the bake-off names as the remaining boundary
work. Production was not re-run with any provider.
