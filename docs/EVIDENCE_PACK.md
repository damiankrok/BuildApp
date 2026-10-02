# The Analyzer Evidence Pack

BUILDPLAN-ANALYZER-005D. What one analyzer run saw, inferred, weighed, accepted
and rejected — as analyzer-owned SVG primitives with JSON sidecars, a decision
timeline and a manifest — so that the first wrong decision of a run can be
found by opening a directory instead of reading a log.

## Turning it on

```bash
ANALYZER_EVIDENCE=1 npm run -s analysis:second-house -- --url <page> --out <run dir>
# or: --evidence <pack dir>
npm run -s evidence:pack -- --run <run dir> --out <pack dir>      # after the fact
npm run -s evidence:diverge -- <pack A> <pack B>                    # the first divergence
npm run -s evidence:verify -- <dir>                                 # every pack under <dir>
```

Off by default. The pack is built **after** the run, from the files the run
wrote; the run never learns whether it will be. No production package depends
on `@buildapp/evidence-pack` (`tests/architecture/generalization.test.ts`), and
a run with evidence on decides exactly what a run with it off decides — the
same hashes, the same traced decisions, and writing the pack changes no file
of the run (`packages/analysis-service/test/evidence-pack.test.ts`). Its own
cost is recorded apart (`evidence-performance.json`).

## What is in it

| file | what |
| --- | --- |
| `00-source-summary.json` | page, adapter, published facts, failures |
| `01-page-classification.json` | each asset's roles |
| `02-asset-inventory.json` | each asset variant: URL, SHA-256, bytes, pixel size, media type, crop, role — never its pixels |
| `03`–`14` `.svg` + `.json` | the selected plan copy (frame, wall bands, dimension lines, tick candidates, OCR labels, span hypotheses, scale hypotheses, extent, envelope, openings, bodies, selected layout), each drawn in the frame's pixel coordinates as primitives, each with a sidecar of stable ids, accepted/rejected, reason codes, confidence, alternatives, support and conflict ids |
| `15-canonical-model-summary.json` | levels, slabs, walls, openings of the model |
| `16-final-model-preview.png` | the analyzer's own render of its model, at most 800 px wide (the only picture) |
| `17-evidence-trace.json` | the run's trace entries |
| `18-decision-timeline.json` | every decision, stage by stage in analyzer order, on stable object ids |
| `evidence-summary.svg` | one page: walls, dimensions, ticks, OCR, scale, extent, envelope, bodies, final — counts, winners, rejected, first warning |
| `README.md`, `manifest.json` | how to read it; every version, hash and file with its SHA-256 |

**The OCR layer (005E).** `07-ocr-labels.svg` colours each dimension label by
its OCR class (CLEAR, SUPPORTED, AMBIGUOUS, LOW_QUALITY) and prints the
as-read string beside the 005D reading when they differ. Its sidecar carries
one record per numeric lattice: the raw top read (005D), the as-read string
and the ink variant that gave it, the class with its probability and margins,
the top-K sequences (image score, probability, ink variants, segmentation, and
why each one was not selected), the per-glyph candidates with runner ratios,
holes and touching/broken flags, every segmentation tried, the span the ink
measures, the value the span was finally given (`selected.by`, the image's
rank and score, and the metric residual — recorded apart), and any refutation.
Readings and boxes only; the glyphs themselves are never reproduced. In the
timeline the candidate set is its own stage, `OCR_SEQUENCE_CANDIDATES`, before
`OCR_READING`: a change in what the image offers is a first divergence ahead
of the reading and the scale it changes.

**The glyph-count and extent-conflict layers (005F).** Each lattice record in
`07-ocr-labels.json` also carries the glyph counts the ink was cut into
(`countHypotheses`: the as-read count, the others kept, whether the width fits
another as well, and the share another count holds), the plan's dimension-font
style it was judged against, what the segmentation tried (per variant: the
reader's count, the anchor's, the others; counter cuts moved and pruned; caps
reached), and the ambiguity tail — each value marked `AMBIGUITY_TAIL`, never
a reading. In the timeline `GLYPH_COUNT_HYPOTHESES` comes before
`OCR_SEQUENCE_CANDIDATES`, and an ink appears there only where the plan's style
changed the reader's count or another count was kept. `11-envelope-candidates`
draws each extent conflict as the strip between the long-band box and the side
the chains state, coloured by what was decided there, and its sidecar carries
`extentConflicts` (strength, chains, gap in metres and walls, the stretches no
built cell explains, the decision and why). `13-body-candidates` draws each
completion before and after its clip, and its sidecar carries `completions`
(kind, decision, the guard that decided it, junction, sides, evidence and the
gaps the two jamb policies may disagree on). In the timeline
`ENVELOPE_EXTENT_CONFLICT` lies between `ENVELOPE` and `BODIES`, with one
event per side and per completion.

**No publisher pixels.** No SVG may contain `<image`, a `data:` URI,
`xlink:href`, base64 or `<foreignObject` (the writer refuses, and
`evidence:verify` checks committed packs). Source assets are recorded by
address, hash, size, pixel dimensions, content type, crop, id and role only.
Plan overlays, which draw over the publisher's raster, are never read.

**Bounded.** At most 3000 elements per SVG, the top 200 items per layer (the
rest counted as omitted), 4 plan copies drawn and 8 solved, 1.5 MB per JSON
file.

## First divergence

`firstDivergence(before, after)` compares two timelines object by object and
returns the first stage, in analyzer order, where any object's decision
differs — for example, Azalia before and after 005D:

```
FIRST_DIVERGENCE = DIMENSION_TICK_CLASSIFICATION
object = tick:chain-horizontal-646-750b25df33:204.5
before = ACCEPTED
after  = REJECTED
```

A doubt named on the same decision (`ACCEPTED` vs `ACCEPTED_QUESTIONABLE`) is
not a divergence; every later stage that differs is listed after the first.
Every crossing mark is classified before any number is read, but the pack
records only the marks of the chains the run kept, and which chains are kept
depends on the readings. So the tick stage is compared on the marks both runs
recorded; a mark one run recorded and the other did not is what a later stage
kept, and is listed apart (`recordedByOneRunOnly`), not as a divergence (005E).
Use it on frozen code against new code, a clean link against a tracked one,
evidence on against off, or an accepted reading against a refused one.
