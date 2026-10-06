# 005I — dimension topology: what was built (Track A, production)

The contract is the brief's §7 chain, unchanged:

`pixels/source → observations → dimension topology candidates → metric evidence → deterministic resolver → CanonicalBuildingModel → geometry compiler`

Nothing in Track A emits a building dimension, bypasses the resolver or lets reconstruction repair metric evidence. The
OCR (custom lattice and PP-OCRv6 tiny, P2 ensemble) is untouched: the same inks are latticed and read, byte for byte
(`ocr-regression.json`).

## The defect (blind round 7, `dom-pod-jarzabem`)

A left margin with two parallel vertical lines 23.5 px apart: the overall `1100` and, nearer the building, the parts
`250 / 100 / 900 / 100`. Each number is printed left of its own line, reading bottom to top, so the parts' numbers sit
between the two lines — the `900` 3.5 px from the overall line and 4 px from its own. Three decisions went wrong, in
order (`baseline.md`):

1. **Label ink as ticks.** The `1100` (left of the overall line) and the `900` (right of it) put ink on both sides of the
   overall line inside the hit window, which is what a crossing mark is to the hit test: two "ticks" at 396 and 411 px.
2. **Greedy binding.** Labels were handed out one at a time, nearest first, each claiming its interval. The `900` (and
   both `100`s) were half a pixel nearer the overall line and claimed its intervals; the `1100` was left with nothing.
3. **End-stub trim.** With the depth read from the inner chain alone, its unread `100` end segment was trimmed as a
   stub; the frame stopped 0.9 m inside the house.

## What changed

| layer | file | what |
| --- | --- | --- |
| marks | `source-metrics/src/dimension-lines.ts` | `markLabelInk`: a crossing mark's ink on each side of its line is traced to the glyph boxes of printed labels lying wholly on that side. Both sides label ink → REJECTED `TEXT_INK`; one side → at most QUESTIONABLE `TEXT_INK` (a label may hide a real tick: uncertainty kept). Real linework crossing text keeps its class. Boxes only — no reading. `DIMENSION_TOPOLOGY_VERSION` 1.1.0 |
| chains | `source-metrics/src/extract.ts` `dimensionChainsOf` | every line as found (`allChains`, what the lattices are read against: OCR unchanged), the record of every mark (`rawChains`), and the measurement chains the solvers read (`measured`: label-ink marks removed). A line whose every mark is label ink is no chain (`labelInkLines`) |
| binding | `source-metrics/src/axis-topology.ts` `assignLabels` | every label gets every line it could be printed on, with its offset in label heights, the **side of the label the line lies on** (BASELINE / THROUGH / TOP — ISO 129: a number is printed on its line's far side from the text baseline, or across it) and whether a span is centred on it. Labels competing for an interval, directly or transitively, form a neighbourhood solved **exactly** (Hungarian method, O(n²m), one label per interval, unassigned allowed at no cost, bound at `cost − reward`). Canonical order of labels and lines; a label whose binding an alternative within 0.1 text height would change is **AMBIGUOUS and bound to nothing**. Replaces the greedy `assignTokens` everywhere it ran: the page vote, the 005B per-orientation bindings and the final re-read |
| groups | `source-metrics/src/axis-topology.ts` `dimensionAxisGroups` | parallel lines overlapping by half the shorter and within 4 label heights are one group; members stay distinct. Relations from marks alone: `SUBDIVIDES` (marks at both of the other's ends and one between), `CONTAINS`, `OVERLAPS`; roles OVERALL / SUBDIVISION / PARTIAL / INDEPENDENT; whether a neighbour has a mark at each end (`alignedEnds`). Thresholds in label heights (alignment: 0.2 h, at least 2 px) |
| record | `source-metrics/src/schema.ts` | metric evidence **1.7.0** (no recogniser) / **1.8.0** (with): `TEXT_INK` mark reason, `segments[].labelled`, `chains[].topology`, `dimensionTopology[]` per plan frame (label-ink marks and lines, groups with relations, the page vote's and the final assignment with every candidate, cost, side and margin). Reader 1.4.0, independent-scale solver 1.4.0, `metrics.axis-topology` 1.0.0 |
| extent | `reconstruction/src/plan-decomposition.ts` | `dimensionedAxis`: an unread short end segment is kept when the drawing states it — ticks at both ends AND a number bound to it, or a neighbouring line ending at the same mark — and every keep/trim is recorded (`EndSpanDecision`). `refuteByWalls`: two or more witness walls running past a dimension-framed side by more than two walls contradict it; the side moves only to a TICK the drawing prints out there (ALTERNATE_DIMENSION_MARK) or the frame is kept and marked weak (DOWNGRADED). Walls never state a metric value |
| evidence | `evidence-pack` 1.1.0 | stages `DIMENSION_AXIS_GROUPS` (after tick classification) and `LABEL_ASSIGNMENT` (after OCR reading), `16-dimension-topology.{svg,json}`, end spans and refutations in `10-extent-hypotheses.json` and EXTENT events |

## Non-circularity (§8)

`tests/architecture/dimension-topology.test.ts`: the topology module imports pixel types, the reader's token and
grammar, and the chain types only; no topology function names a published figure, an area, a reconstruction, a house
or an answer; the label-ink trace reads boxes, never readings; a candidate's cost reads no value. Behaviour: relabelling
every label with other digits — an arithmetic that does not close, values that would imply another area — moves no
binding. The end-span and refutation rules read chain records and the wall witness, never published facts.

## Bounds (§43)

- An exact solve per neighbourhood; a neighbourhood above 96 labels (none on any development sheet) is checked
  against each label's next-best candidate only and says so (`bounded`).
- The margin check re-solves the neighbourhood once per competing label: O(k·k²·m) per neighbourhood of k labels and
  m slots.
- Stress (40 lines × 12 intervals, 480 labels): assigned in about 0.2 s, identical twice (`axis-topology.test.ts`).
- On development frames: `performance.json`.
