# Blind holdout round 5 — draw, runs and verdicts (005E)

The protocol is `holdout/README.md` (Round 5). This directory seals what the draw produced, as text facts only. No
drawing, overlay or render of a drawing is committed. The raw plans were looked at locally for the diagnosis below and
stay outside the repository. The two Evidence Packs written during the runs are committed beside the development packs,
unchanged (`../evidence/blind-h1-dom-w-modrzewnicy`, `../evidence/blind-h2-dom-w-morelach`).

## Draw

- **PRE_HOLDOUT_5_SHA** `9f7423d90b84fc7ff3d6bb976332539390d25879`.
  - Pushed to `analyzer/numeric-ocr-lattice-v1` and `claude/new-session-3kzcgh` before the draw.
  - CI run 131 (`36912397814`, push) on it: 35 jobs, 34 green and `preview-latest` skipped by design (push), completed
    20:00:48Z.
  - The tree was clean.
  - The only commit between the freeze and the runs is the ledger line itself (`0afd751`, `holdout/LEDGER.ndjson`, one
    line), so the packs' manifests carry `gitSha 0afd751…`.
- **The ledger** (`holdout/LEDGER.ndjson`, the line labelled `BUILDPLAN-005E-NUMERIC-OCR-HOLDOUT`, 20:05:23Z):

| | |
| --- | --- |
| pool | `holdout/pool.txt`, sha256 `800c2a1ed9daee9efd2654c64b061e430094dc38fc459b805af27ff9fad2ed41` |
| exclusions | `excluded-families-round-5.txt`, sha256 `d33caf40eeb8fb08af88978ab4838ec45b23824981cd81efc7be12e37bb94340` (43 families) |
| seed | `c5fecae193c47617aa4abf9af150f6b7345b0a671edcc442cfbbb7f9e9ee64a1` |
| n / excluded | 2480 drawable / 605 excluded |
| i1, i2 | 1457, 1476 |
| #1 | `https://www.archon.pl/projekty-domow/projekt-dom-w-modrzewnicy-10-g2e-oze-m8a12761847734` (family `dom-w-modrzewnicy`) |
| #2 | `https://www.archon.pl/projekty-domow/projekt-dom-w-morelach-n-ver-2-m95a1f6e528ef4` (family `dom-w-morelach`) |

- **Recomputed independently.** `SHA256(PRE_HOLDOUT_5_SHA + "BUILDPLAN-005E-NUMERIC-OCR-HOLDOUT")` gives the seed, and
  `seed mod 2480` gives 1457. Neither family appears in any exclusion file of any round or anywhere under
  `stage-reports/`, and neither is a development house (`dom-w-modrzewnicy` is not `dom-w-modrzykach`).

## Runs

Each address ran **once**, live, with the frozen code and the Evidence Pack on, one after the other:
`ANALYZER_EVIDENCE=1 TELEMETRY=1 analysis:second-house --url <address> --cache <scratch> --out <scratch>`, which is
production `runAnalysis`. Cache and output stayed outside the repository, and nothing was re-run.

| # | started (UTC) | wall | analysis | metric phase | of it, the lattice | peak RSS | longest tick gap | longest telemetry gap | pack |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 20:05:48 | 204 s | 198.0 s | 165.0 s | 4.3 s | 757 MB | 3.4 s (`OBSERVE_ASSETS`) | 4.2 s | 32 files, 243 decisions, 188 ms |
| 2 | 20:09:12 | 161 s | 154.1 s | 122.9 s | 5.9 s | 789 MB | 2.4 s (`ACQUIRE_ASSETS`, network) | 2.2 s | 33 files, 433 decisions, 344 ms |

## Verdicts (`holdout/verdict.mjs`, as frozen)

### #1 `dom-w-modrzewnicy` — ALGORITHMIC_FAIL (numeric reader)

The run refused by name: `RECONSTRUCTION_FAILED / METRIC_RESOLUTION_INCONCLUSIVE`. No scale was adopted, so no wrong
building was built. The source checklist finds nothing source-limiting: the selected ground copy
(`rzut-8d59c92ec1`, 853×853) prints its overall dimensions legibly, and walls are 12 px. A refusal is therefore an
algorithmic fail.

The printed overalls are `2590` (= 1950 + 640) on the vertical and `1000` (= 210 + 730 + 60) on the horizontal. Both
state about 4.0 cm/px. They are set in a condensed face: four glyphs in about 20 px along the line, at a cap height of
11 px.

**First bad decision:** `e00013`, `OCR_SEQUENCE_CANDIDATES`, `ink:text-region-105-426-e60ff2d1a1:ROTATED_CW`.

- The vertical overall `2590` is cut into three cells, because the segmenter's expected glyph width (0.55 × cap
  height ≈ 6 px) fits three glyphs into 21 px.
- Its lattice is `140|100,200,220,230,240,540,740`, LOW_QUALITY (p 0.12). No four-glyph value is in it. The contract
  keeps the cell count fixed (pre-review A P1-5), so the truth was unreachable.

Then:

1. `e00015`: `1950` (four cells) is read `1410` and classed **SUPPORTED** (p 0.47, stable under the bracket). The
   candidates are `1410|1010,1430,1440,1450,1451,1470,1910`: two substitutions (`9`→`4`, `5`→`1`, the corpus's most
   frequent confusion).
   - Both true glyphs are cell candidates: `9` at p 0.04 (score ratio 0.66), `5` at p 0.08 (0.71).
   - Their joint path is about 0.005 of the best, under the beam's 0.01 floor, and emission ends on the count bound
     (18 values merged, mass 0.86). The truth is not among the eight.
   - This is a confident misread, a declared limit of the class (calibration README).
2. `640` is read `600` (AMBIGUOUS, `640` in its lattice), and `1417` is read `1117` (AMBIGUOUS, `1417` the lattice's
   top value).
3. The horizontal `1000` is read as printed (SUPPORTED), but it binds UNCENTRED to a 28 px span of its line (one
   rejected mark skipped), not to the overall of about 250 px, so it states no usable scale. `730` is read `150`
   (`730` not in its lattice).
4. `e00209` `METRIC_RELATION` NO_SCALE/INCONCLUSIVE: the as-read total `1410` (2.895 cm/px) and its as-read child
   `600` (3.75) disagree, and no reading outside them decides.

The run stops by name. The refusal's "what is missing" text says the plan prints no dimension, which is wrong: it does,
and they were misread (a message defect, §AG of the report).

### #2 `dom-w-morelach` — ALGORITHMIC_FAIL (envelope, downstream of a right scale)

The run completed with 2 bodies, 101.31 m² against the published 114.53 m² (**−11.54 %**, which fails the 10 %
footprint condition). Storeys are 2 of 2 and every printed opening is built (both hold). The challenge KEPT the first
reading. Limits: `LAYOUT_STRUCTURE_READS_AS_ONE_BLOCK`, `LAYOUT_FOOTPRINT_AREA_NEAR`, `METRIC_SCALE_WEAK`,
`EXTERIOR_JOINTS`.

**The scale is right.** The printed overalls are `1212` (= 380 + 732 + 100) and `1062` (= 415 + 350 + 297), about 2.0
cm/px. `e00374` `METRIC_RELATION` is CONFIRMED/WEAK at 1.9956 (`1062`/532 px = 1.9962) on three readings over three
chains: `1062`, `380` and `350`. All three are AMBIGUOUS, hence WEAK. How the reader did, against the 005D reading:

| label | 005D read | 005E as-read | class | how it entered |
| --- | --- | --- | --- | --- |
| `350` | `750` | `350` (right) | AMBIGUOUS | as read |
| `1212` | — | `1212` (right) | SUPPORTED | as read |
| `415` | `015` | — | — | SCALE_RANKED from its own lattice (derived) |
| `297` | — | — | — | SCALE_RANKED from its own lattice (derived) |
| `732` | — | `737` | — | truth in the lattice |
| `642` | — | `602` | — | truth in the lattice |

**First bad decision:** `e00427`, `ENVELOPE`, `envelope:frame-asset-rzut-63ae7d4e86-027bb2e82d`, `BOX:61,208.5,609.5,739`
(33 of 49 cells enclosed), inside a chain extent that reaches 670.

- The east kitchen bay is left outside. `e00429` then classes it `NOT_BUILT`: 4.2 m², `FLUSH_ATTACHED`, junction wall
  0.55, its candidate drawn 609.5–670 × 323–716, taller than the bay.
- The garage mass stops at y 590, leaving its south end (with the garage door) unbuilt (`e00431`).

The first bad decision is in the 005C boundary layer, not in the numeric reader or the metric. Boundary refoundation is
outside this stage (brief §48).
