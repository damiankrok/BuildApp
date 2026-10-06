# 005I — baseline: blind round 7 #1 (`dom-pod-jarzabem`) at the starting HEAD

- **Starting HEAD:** `29ab643a6e1b8e9e9f07bbdecd8cc12e63860c0e` on `analyzer/external-numeric-recogniser-v1`, verified
  equal to `origin` before any change. New branch `analyzer/dimension-topology-boundary-bakeoff-v1` from it.
- **SINGLE_REPO_AUDIT = PASS.** Only `damiankrok/BuildApp` is written. The Legacy checkout
  (`damiankrok/BuildPlan-PC-Legacy`) stays at `b0e79675c7ebeacf718cd1392f62272fb400418b` with no local change; nothing
  in 005I reads, depends on, branches or pushes it.
- **What the baseline is.** The sealed blind-7 run itself (005H, frozen `5315ff8`, recogniser ON) and 005H's OFF replay
  of the same bytes; the analysis code at `29ab643` is the same (`git diff 5315ff8 29ab643 -- packages apps` touches no
  analysis code). The source package and byte cache stay outside the repository; nothing here reproduces a drawing.

## The selected copy and the margin

Selected plan copy: `frame-asset-rzut-9354eb066f-397808a266` (853 × 853 px, walls 12 px). Its left margin carries two
parallel vertical dimension lines 23.5 px apart:

| line | x (px) | marks (px) | labels printed beside it |
| --- | --- | --- | --- |
| overall (`chain-vertical-32-…`) | 31.5 | 204, **396**, **411**, 596.5 | `1100`, x 12–27, left of the line |
| parts (`chain-vertical-55-…`) | 55 | 116, 205.9, 239, 562.9, 596.5 | `250`, `100`, `900`, `100`, x 35–51, left of the line — i.e. **between** the two lines |

Every number reads bottom to top and is printed with its baseline toward its own line (the ISO 129 convention). The
`900` ink (x 35–51) is 3.5 px right of the overall line and 4 px left of its own.

## The decisions, in timeline order (005H Evidence Pack `blind-h1-dom-pod-jarzabem`)

| # | event | stage | what was decided | why it is wrong |
| --- | --- | --- | --- | --- |
| 1 | `e00038`, `e00039` | DIMENSION_TICK_CLASSIFICATION | marks at 396 and 411 px on the overall line: **TICK**, no reason | the crossing ink is the `1100`'s glyphs on the left and the `900`'s on the right: no stroke crosses the line (label ink as ticks) |
| 2 | (legacy assignment) | — | the page vote's labels handed out nearest first: the top `100`, the `900` and the bottom `100` each a fraction of a pixel nearer the overall line than their own, claim the overall line's three intervals; `1100` is left with no interval | greedy: the overall line's own number is orphaned so that three numbers can sit on a line that is not theirs |
| 3 | `e00276` | LABEL_BINDING | `900` bound PRIMARY to the overall line, 204–596.5 px, residual 247.8 px; `1100` unbound | as 2 |
| 4 | — | (chain solve) | overall line: three UNRESOLVED segments ("no number on this chain could be reconciled"); parts line: `250` CHAIN_CORRECTED, the rest DERIVED | the depth now rests on the parts line alone, read only on its `250` |
| 5 | — | SCALE_HYPOTHESIS / METRIC_RELATION | page vote 2.716 cm/px kept, LEGACY_UNCONFIRMED / WEAK (the drawing's own scale is 2.80: `1960` over 699.5 px) | 3 % short — not the cause, but it is why the `100`s missed by 2.5–3.0 px |
| 6 | `e00398` | EXTENT | south side at 562.9 px: the parts line's unread `100` end segment (33.6 px) is shorter than half its shortest read segment (the `250`, 89.9 px) and is trimmed | the drawn south wall is at 580–597 px; a segment with a number printed on it, between two ticks, is a span of the building |
| 7 | `e00399`… `e00416` | ENVELOPE, BODIES | the envelope stops above the south wall; the main block's southern rooms become unbuilt `RECESSED_ATTACHED` (43.6 m²) and `COVERED_TERRACE` (26.6 m²) | downstream of 6 |
| 8 | — | FINAL | first reading 73.42 m² against 216.76 m² published; best of 95 other readings 191.4 m² with only the spent figure behind it → `BOUNDARY_RESOLUTION_INCONCLUSIVE` | |

The external recogniser read the overalls right (`1960` LEADS, `1100` AGREES) and contested the lattice's `400` with the
right `900`; the OFF replay fails at the same place. **Not an OCR problem: a topology one** — decisions 1, 2 and 6.

## Reproduced

Before any change, the frozen outputs were re-read and the left margin of the selected copy was looked at locally
(outside the repository): two lines, the labels as above. The same three decisions are visible on the other copy the
resolver tried (`frame-asset-rzut-cafd34a77a-4813950087`, the same drawing with room names), where the page vote read the
vertical labels the other way up.

## After (005I, `c150896`) — the same bytes, offline

| | 005H | 005I |
| --- | --- | --- |
| marks at 396 / 411 px on the overall line | TICK, TICK | **REJECTED `TEXT_INK`** (both sides label ink) |
| `1100` | unbound | **bound to the overall line, read over 204–596 px** |
| `900` | bound to the overall line | **bound to the parts line, 239–561 px** |
| parts line | `250` corrected, rest derived | `250` READ, `100` READ, `900` CHAIN_CORRECTED, `100` READ |
| scale | 2.716 cm/px, LEGACY_UNCONFIRMED / WEAK | **2.797 × 2.806 cm/px, REPLACED / STRONG** |
| south side of the frame | 562.9 px | **596 px** (the drawn south wall) |
| outcome | refused, BOUNDARY_RESOLUTION_INCONCLUSIVE | **completes**: 1 body, 14 openings, 191.0 m² (−11.9 % of 216.76) |

The old first bad decision is gone. The run still fails the holdout verdict's footprint condition, and the **new first
bad decision** is downstream of dimension topology: the 1 m strip between the garage's south face (the parts line's
`900`/`100` mark at 561 px) and the main block's south wall (596 px) holds the study, a recessed entrance porch and
the kitchen. It is decomposed as one body (263–785 × 561–596 px) with a 5.3 m mouth — the porch — and left unbuilt as
`UNKNOWN`. Class: **BODY_RELATION** (a recessed entrance within a facade strip). An estimate, not a run: with the
study and kitchen strips built and the porch left out, the lowest storey would be about 200 m² (≈ −8 %). The
publisher's 216.76 m² is larger than the product of the plan's own two overall dimensions (19.60 × 11.00 = 215.6 m²),
so it counts more than the walled outline (covered areas); the 6 % bound may not be reachable by the walls alone. Not
patched here (brief §17: report the new first bad decision; do not weaken downstream validation).
