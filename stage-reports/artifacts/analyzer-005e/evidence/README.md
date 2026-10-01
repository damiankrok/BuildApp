# 005E Evidence Packs

What each run saw, weighed, accepted and rejected (`docs/EVIDENCE_PACK.md`), now with the OCR layer: each dimension
label's numeric lattice in `07-ocr-labels.json` (the 005D reading, the as-read string, the image-only sequences with
their probabilities, the per-glyph candidates, the segmentations, the class, the stability bracket, the selection with
the image score and the metric support apart, and the rejection reasons) and the `OCR_SEQUENCE_CANDIDATES` stage of the
decision timeline. Numbers and boxes only: no glyph pixels, no publisher pixels in any SVG.
`npm run -s evidence:verify -- <this directory> --max-packs 16` checks each pack against its own manifest.

| pack | run | why it is here |
| --- | --- | --- |
| `dom-w-dabecjach` | `ebd64eb`, development matrix m3 | round-4 blind #1: a false consensus of two misread overalls (`1501`, `810`) at 2.672 cm/px |
| `dom-w-tunbergiach` | `ebd64eb`, m3 | round-4 blind #2: the overall `1173` misread `1117`, a tie that kept a wrong scale (−12.47 %) |
| `rarytasy-g2e` | `ebd64eb`, m3 | its relation moved from LEGACY_UNCONFIRMED to CONFIRMED/STRONG and its model moved (re-pinned in CI) |
| `rarytasy-eoze` | `ebd64eb`, m3 | current e-OZE, MUST_COMPLETE; its model moved (+1.57 % → +1.51 %) |

The "before" packs are the committed 005D ones: `../../analyzer-005d/evidence/blind-h1-dom-w-dabecjach`,
`blind-h2-dom-w-tunbergiach`, `rarytasy-g2e` and `rarytasy-eoze`. The 005D code re-run offline on the sealed packages
gives packs with no divergence from the committed blind packs (`firstDivergence: NONE`), so the comparison is code
against code. The other development rows are summary rows of `../development-matrix.json`.

## First divergence (§24)

`first-divergence-<house>-005d-to-005e.json` — `npm run -s evidence:diverge -- <005D pack> <005E pack> --json`. On all
four the first divergence is `OCR_SEQUENCE_CANDIDATES`, the lattice's candidate set; the reading, the binding, the
scale and what follows from it come after.

The first computation gave `DIMENSION_TICK_CLASSIFICATION` on all four, and it was investigated before anything was
claimed. Every mark on every chain both runs record has the same class in both (dabecjach 489 chains, tunbergiach 231,
compared mark by mark in `metric-evidence.json`). Tick classification runs before any number is read; the pack records
the marks of the chains the run kept (a chain with a solved segment, labelled or long), and which chains are kept
depends on the readings. A mark recorded by one run only is therefore a difference in what the later stages kept, not
a classification. `firstDivergence` now compares that stage on the marks both runs recorded, and lists the one-sided
ones apart (`recordedByOneRunOnly`: dabecjach 5, tunbergiach 22, G2E 28, e-OZE 25). A mark both runs recorded and
classified differently is still the classification's divergence (`evidence-pack.test.ts`).

## OCR candidates and scale witnesses

`ocr-candidates-and-scale-witnesses.md` — for the selected plan copy of each round-4 house, before and after: the
longest-span label inks with the 005D reading, the as-read string, its class and probability, the lattice's other
values, and each scale hypothesis with its witnesses.

- dabecjach: `1580` and `850` are now the as-read strings (SUPPORTED), `692` too (005D read `643`). The scale is
  REPLACED/STRONG at 2.8116 cm/px on five readings over three chains, against the 2.81 the printed overalls state.
  `1340` is still read `1300` (AMBIGUOUS, the truth in its lattice at 0.07) and `490` is still misread (`420`,
  AMBIGUOUS). Neither is a witness of the selected scale. The run then stops by name at the boundary layer
  (`BOUNDARY_RESOLUTION_INCONCLUSIVE`, outside this stage).
- tunbergiach: the overall `1173` is still not the as-read string: it reads `1171` (AMBIGUOUS, p 0.20), with `1173` in
  the lattice at 0.10. `1000` (SUPPORTED) and `226` corroborate on the other axis, and the scale is REPLACED/WEAK at
  2.0915 cm/px, within 0.2 % of `1173`/560 px. The ground storey is built at −0.54 %; the upper storeys still fail.
