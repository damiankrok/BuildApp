# Metric evidence

*What a drawing STATES about its own measurements, and how BuildApp reads it.*

`@buildapp/source-metrics` sits between the observation graph and the solver.
The graph records what was SEEN — an edge, a band, a rectangle. This records
what was READ: `1205`, `+7,95`, `40°`, `300/230`. They are different kinds of
fact and they get different layers, because only the second can ever put a
number in metres into a building model, and there are never many of them.

The artefact is a versioned, content-addressed **`MetricEvidenceSet`**
(`buildapp.metric-evidence-set`, schema `1.0.0`), sealed against BOTH of its
inputs by hash: the source package's bytes and the observation graph's content.
A set is only valid for the exact bytes it was read from, and the hashes make
that checkable rather than promised.

## Three rules

**The raw recognized text is never discarded.** Every piece of evidence carries
`rawText` — what the reader actually saw, before parsing, before unit
inference, before any chain arithmetic corrected it. A layer that keeps only
the parsed number has thrown away the only thing a human can check.

**A number that is not attached to something is not evidence.** Every reading
names the geometry it measures and the observations that back it. OCR finding
`415` somewhere on a page proves nothing; `415` on a dimension line between two
witness marks 157 pixels apart is a measurement. Readings that could not be
attached are kept, marked `UNATTACHED`, and never used as a constraint.

**Reading and believing are separate.** `confidence` says how sure the reader
is of the characters. Whether that becomes a hard constraint is decided later,
by the solver, from the whole picture.

## The reader

A numeric OCR, built for the alphabet drawings actually print: digits, a
decimal comma or stop, `+ − ±`, a degree sign, a slash.

1. **Ink.** A local-contrast mask. Dimension text on a published sheet is a mid
   grey on a light grey page, often under a watermark, and a global threshold
   either misses it or floods.
2. **Glyph-sized components.** Small, dense, isolated blobs. Anything too
   large, too thin or too sparse is drawing, not text. Punctuation is collected
   separately — a comma is three pixels tall beside a twenty-two-pixel digit —
   and may JOIN a token but never start one.
3. **Tokens.** Glyphs on a common baseline within a gap of their own height.
4. **De-skew.** Drawing text is usually italic, and italic glyphs touch, so
   they arrive as one component. The shear that maximises the number of EMPTY
   COLUMNS between the glyphs is the one that stands the token upright, with
   the packing of the column profile breaking ties. It is deliberately not the
   profile's *variance*: shearing widens the bitmap and the new columns are
   empty, so a mean-based measure rewards the widest shear on offer and every
   token comes back leaning twenty degrees.
5. **Segmentation** at the valleys of the column profile, with the expected
   glyph width taken from the token's own height.
6. **Classification** against the bitmaps in `font.ts`, as SKELETONS.

That last word is the one that matters. Prototypes and cells are both reduced
by Zhang–Suen thinning before matching, because without it the matcher spends
most of its discrimination on STROKE WEIGHT: a thirteen-pixel glyph has
two-pixel strokes, which on the normalised grid is a fifth of its width, and
two fat shapes overlap heavily whatever they are. That is how a `1` comes to
match a `2`. Resampling also preserves the glyph's proportions rather than
stretching it to fill the grid — stretched to twelve columns, a `1` becomes a
solid slab whose chamfer distance to every other digit is tiny.

Each glyph keeps its runners-up and reports two numbers, not one:

- `score` — how well the cell matched.
- `confidence` — how much better the winner was than the runner-up.

A clean `+` matched at 0.36 against nothing else is a certain plus sign; a `1`
matched at 0.52 with a `2` at 0.45 behind it is a coin toss however respectable
0.52 looks. Only the second is a statement about being right.

The page is read three times — as it lies, and a quarter turn each way — because
a vertical dimension chain carries its numbers rotated. The same ink read twice
is one token: the wrong-way pass returns `750` as `057`, and a page-wide vote
decides which turn the sheet uses so that a page never comes back with most of
its vertical dimensions right and one of them reversed.

## Dimension chains

A chain is the most information-dense thing on a drawing and the only place
where a reader can check itself. Three facts hold at once for a chain of *n*
segments: every segment has a printed value; every segment has a pixel length;
they all share one scale. Any two give the third.

Chains are found from the drawing itself, not from a parallel-line detector: a
dimension line is a **long, thin, straight run of ink crossed at intervals by
short marks**. Both halves matter — the run rules out text and hatching, the
crossing marks are where the draughtsman said one measurement ends. A mark is
detected by what ticks, slashes and arrowheads have in common: locally, the ink
STRADDLES the line. Text sits on one side of it.

Solving a chain is a discrete choice, not a fixed partition:

- The **scale** is voted for the whole frame at once, pooling every chain on
  the sheet, because a drawing is printed at one scale and a chain with a
  single readable number cannot check itself but can confirm what the rest of
  the sheet agrees on. The miss is measured in PIXELS, not per cent: tick marks
  are located to about a pixel whether they are forty pixels apart or five
  hundred.
- The **partition** is then found exactly, by dynamic programming over the
  ticks. A span carrying one number the scale endorses is worth a great deal; a
  span carrying a number the scale refuses is worth less than nothing; a span
  carrying two is impossible. Swallowing a tick costs something, and
  substituting a character costs more — otherwise the solver reinterprets `510`
  as `310` to justify a division the draughtsman never drew.
- A span with nothing printed on it is `DERIVED` from the scale and labelled as
  derived, and only on a chain whose own readings sit ON that scale. A span
  whose number cannot be reconciled is `UNRESOLVED`.

What it never does is invent a value to make a chain close.

**A plan's scale must be physically plausible (BUILDAPP-03Y2G).** OCR can
misread an italic face the same wrong way on several chains, and a pixel
tolerance vote then agrees on a wrong scale. That happened on a second test
project: 8.51 cm/px against a true ~2.75. So on a floor plan the vote's winner
must make the heavier drawn walls a thickness an outer wall can have. The upper
quartile of the wall-band thicknesses must fall between 0.15 and 0.8 m
(`PLAN_OUTER_WALL_M`).

A winner that fails this is replaced only by another candidate of the same
vote that passes it, is supported by at least three numbers on at least two
chains, and differs from the winner by at least 3%. Otherwise the plan carries
**no** scale, and its chains are solved with no values. The decision, including
every scale considered and why, is recorded as `scaleDecision`. An unresolved
`gap-scale-implausible-*` names what was refused.

## Dimension-chain integrity (BUILDPLAN-ANALYZER-005D, schema 1.3.0)

A crossing line is not automatically a tick. Since 005D every mark that crosses
a dimension line is measured against the line it sits on
(`metrics.dimension-topology` 1.0.0) and recorded in `chains[].marks` beside
`ticksPx` (which still lists every mark, so nothing that read the old field
moves):

| class | when | what it may do |
| --- | --- | --- |
| `TICK` | as dark as the line, on both sides, a stroke | end a span |
| `QUESTIONABLE` | lighter than the line, one-sided, a duplicate a reach away, unlike the chain's own clean ends, or a wedge of another colour | end a span only as a doubted end (`binding.questionableEnds`) |
| `REJECTED` | lighter than the line AND one-sided or a wedge (a leader end, a hatch boundary) | never end a span |

Every mark carries its reasons (`LIGHTER_THAN_LINE`, `FAINT_SIDE`,
`ONE_SIDED`, `WEDGE_NOT_STROKE`, `COLOUR_MISMATCH`, `DUPLICATE`,
`STYLE_MISMATCH`, `NO_LINE_REFERENCE`) and the measurements behind them. A
rejected mark is skipped, not deleted, and real internal ticks are never
ignored as a class: a chain whose segments are each labelled stays segmented.

**A label measures the span it is centred on.** Each label is bound to every
candidate span between non-rejected marks of its chain and the binding records
its role — centring decides; a doubted end only lets a label take a longer span
that encloses the best-centred one and is centred as well — : `PRIMARY` (centred within 10 % of the span), `ALTERNATIVE` (another
span the same ink could measure, kept, never a witness), `AMBIGUOUS` (two
centred spans of different length tie) or `UNCENTRED`. A total centred across
the whole line stays a total candidate with a spurious mark beneath it
(`binding.skipped.rejected`), and with real ticks beneath it (`skipped.tick`,
at a cost).

**Value hypotheses are bounded and named, never chosen by a scale.** An ink's
as-read value is the witness; up to four one-substitution readings whose glyph
ratio is at least 0.7 are kept beside it (`valueAlternatives`). When the
selected scale rests on one such ink, `topology.valueAmbiguity` records the
interval its alternatives imply and the confidence is at most WEAK. An ink one
of whose alternatives fits another scale decides nothing between the two
(`topology.neutralObservationIds`): against the page vote's scale (V3, asked
whenever the selection would not simply confirm the vote) and against a rival
hypothesis (V3 between rivals, within at most twice the ink's own pixel
tolerance). Neutrality never promotes a rival of lower standing than the
strongest scale's whole evidence: that case is INCONCLUSIVE. A dimension
drawn on twin lines, its value printed on each, is one witness (I5).

**The hierarchy is checked on values as read.** Between parallel lines of the
same family, `TOTAL_OF`/`SEGMENT_OF` (a span of one line whose ends coincide
with marks of a finer line — the whole line, or one segment of a middle line),
`PARALLEL_COPY_OF`, `NESTED_IN` and `CONFLICTS_WITH` are recorded with a check:
`AGREES_AS_READ`, `CONFLICT_AS_READ`, `INCOMPLETE` or
`AGREES_AFTER_CORRECTION` (closed only by the solver's own values; recorded,
never evidence). A total and its children that disagree as read, each stating
one of two distinct scales, with no reading outside the pair to decide, make
the solution `INCONCLUSIVE` (`hierarchy.undecidedConflict`) unless the side
that ranks first also outnumbers the other: the conflict is reported, never
forced consistent. Totals are checked over consecutive marks and over the span
each label on the line is bound to, so one extra crossing cannot hide them.

**The first success is challenged by the drawing, before the published
figure** (resolver 1.4.0). A first reading is challenged when the drawing
contradicts its scale (`AS_READ_REFUTATION`, `PARTIAL_BINDING`,
`OUTER_TOTALS`; `sourceConflictOf`, which is not given any published figure).
The drawing chooses first — its best-supported other scale, ranked with the
figure's own refusal left out — and the published footprint then verifies that
one reading (`REPLACED`, `publishedFigure: VERIFIED`) or vetoes it: then
neither is built, `PLAN_RESOLUTION_INCONCLUSIVE`, `why: SOURCE_CONFLICT`. A
vetoed choice is never followed by the next-best.

What every frame's solution records is in `metricSolutions[].topology` (marks
by class, bindings by role, neutral inks, the hierarchy, any value ambiguity),
and in full in the run's Evidence Pack (`docs/EVIDENCE_PACK.md`).

## The numeric lattice (BUILDPLAN-ANALYZER-005E, schema 1.4.0)

The reader above returns one reading per piece of ink. On the development
houses that reading is right on under a third of the long dimension labels, and
when it is wrong it is often wrong in two places, or in where it cut the ink —
a `0`'s hollow middle cut instead of the junction beside it. Since 005E every
label that lies on a dimension line (the geometric test the label assignment
makes, before any scale) is read again from the very ink field its pass read,
and returns a bounded, **image-only** lattice (`metrics.numeric-lattice`
1.0.0, `numericLattices[]` in the set):

- **ink variants** — the reader's own mask (`DEFAULT`), a stricter one
  (`STRICT`) and a local mean–deviation one (`SAUVOLA`): re-readings of the
  same ink, never independent witnesses;
- **segmentations** — the variant's own cuts (the `ANCHOR`) and re-cuts at
  column-profile valleys (at most two moved boundaries, sixteen hypotheses);
- **per-glyph candidates** — from the grammar's alphabet (digits for
  full-height cells, `, . - °` for short ones), within 0.6 of the cell's best,
  at most four per cell;
- **a beam over them** — at most two non-top glyphs, width 16, at most eight
  sequences (the as-read one among them), a probability floor and mass bound —
  in place of 005D's one-substitution rule. What the cut left out is recorded
  (`mergedCount`, `emittedMass`).

The **as-read** string is the anchor of the variant whose cells match best; a
re-cut never becomes the as-read string. Each sequence records its image score,
its probability among the ink's values, which glyphs left the top choice, and
which paths reached it (the one that decided its score first).

**OCR classes come from the reader alone.** `LOW_QUALITY` (a glyph matched
under the floor, or text under the legible height), `CLEAR` (the reading holds
most of the ink's probability), `SUPPORTED` (a fair share, leading the next
value by a margin — a two-value coin toss is not SUPPORTED), `AMBIGUOUS`. A
reading whose value moves when the stricter masks' thresholds move a tenth
either way (the stability bracket, `asReadStability`) is AMBIGUOUS: the image
did not decide it. A class never changes a value. Calibration, the measured
tables and every constant's sensitivity:
`stage-reports/artifacts/analyzer-005e/calibration/README.md`.

**The metric uses reading quality, never invents a reading** (solver 1.2.0):

- a `LOW_QUALITY` ink never decides; corroboration needs at least one ink of
  the pair read better than `AMBIGUOUS` — two coin tosses that agree are not
  two witnesses; an as-read string with a leading zero keeps its ink on the
  record, never decisive, its lattice values as alternatives;
- an ink's alternatives contest a scale when the ink holds them at least half
  as strongly as its reading (every one, when `AMBIGUOUS`), or when they are
  one glyph away at 005D's runner bound (0.7, measured on the 005E matcher's
  glyphs): a contest withholds a vote, never gives a span a value;
- **false consensus** (`topology.falseConsensus`): when the class-blind verdict
  would be SUPPORTED or better but the selected scale's inks are contested or
  coin tosses, and a rival has an ink read better that stands on its own on a
  substantial share of its axis (`BETTER_CLASS_RIVAL`), or two coin tosses'
  well-held alternatives agree on another scale (`CANDIDATE_CONSENSUS`, every
  such scale recorded with its pair), the confidence drops and the
  first-success challenge is triggered. The rival is never promoted, and a
  doubt never hands the first reading to a page vote with no reading of its
  own. A WEAK set of coin tosses whose own alternatives state another scale
  replaces nothing;
- **structural support**: a total and the children it frames may be reconciled
  through each ink's own plausible lattice values (children from different
  inks only); a total refuted by its own children stops witnessing;
- **non-circular selection**: each observation records the metric's preferred
  value for its span among the image's values and why (`ocr.selected.by`:
  `AS_READ`, `STRUCTURAL`, `SCALE_RANKED`, `UNRESOLVED`), with the image's rank
  and score and the metric residual recorded separately. A scale may rank only
  values the image produced that the ink may plausibly be, on spans long enough
  to measure; a value the image never offered stays missing. A chain read
  again from lattices takes its values from them only. **The legacy
  exemption:** where the page vote's scale is confirmed and its chains are
  kept as they were (byte for byte, so that a confirmed model does not move),
  their values come from 005D's substitution list and may lie outside an ink's
  lattice; they are scale-chosen corrections (`CHAIN_CORRECTED`), never
  witnesses of the scale.

## The ladder of level datums

The same redundancy, in the vertical. Every printed level states a height above
the drawing's zero and is printed against a rule at a known row, so the pairs
(row, height) must fall on ONE straight line. A `+3,06` misread as `+5,06`
survives every check a single reading can be given — clean characters,
plausible value, good association — and does not survive being asked to agree
with the other three heights on the same sheet.

A plus-or-minus sign means "this is the zero", and is written on nothing else.
`±0,08` is not a height eight centimetres up.

Two rules added in BUILDAPP-03Y2G:

- **A level symbol with no rule beside it.** A ridge level is often printed
  above a ▽ whose apex touches the ridge, with no horizontal rule. The reader
  then looks for the apex on the raster itself: a downward-pointing triangle of
  dark ink below the number, tried at three slopes. The association is recorded
  with score 0.5, lower than a rule's.
- **When ±0.00 is missed.** The solver's `levelsFrom` does not take the terrain
  datum, a small negative level such as −0.45, as the floor. When positive
  datums were read and 0 was not, the implicit zero is added back, because every
  positive level on the sheet is measured from it.

## Registration

An axis-aligned affine map and nothing more: a scale per pixel axis, a sign per
axis, and an origin. No rotation, no perspective, no camera. A published
orthographic sheet is axis-aligned by construction, so the extra degrees of
freedom a camera model would add have nothing in the data to constrain them,
and fitting them means fitting noise and calling it a calibration.

- A **plan** is registered from its chain segments.
- A **section** is registered from its ladder: one anchor per rung.
- An **elevation** usually states neither, and this layer says so rather than
  inventing one. Registering it needs a fact from another view, which is a
  claim about the building and therefore the solver's business.

The fit is robust: each anchor is seeded in turn and the largest agreeing set
wins, because fitting everything first and rejecting outliers afterwards fails
exactly when it matters — one badly misread datum drags a least-squares scale
far enough that every honest anchor misses the tolerance, and the frame ends up
with no registration at all rather than the one four of its five anchors agree
on. Rejected anchors are listed with their residuals. One anchor is not a
registration: it produces a residual of exactly zero and no reason to believe
it.

## What is hashed

The package and graph identities, every reader and its version, every OCR token
with its glyphs and their runners-up, every numeric lattice (its sequences,
classes and segmentations; not the cache flag), every reading, every chain, every
registration with its anchors and rejections, every conflict and every named
gap.

Not hashed: prose. A provenance `detail`, a `note`, an association's `why`.
Rewording an explanation is not a different reading. No timestamp or latency
reaches the hash, because nothing carries one into the set.

## Reading it

```ts
import { extractMetricEvidence } from '@buildapp/source-metrics'

const set = extractMetricEvidence({
  sourcePackageId: pkg.id,
  sourcePackageHash: pkg.contentHash,
  graph,
  slug: 'a-project',
  raster: (frame) => decode(bytesFor(frame.variantByteHash)),
})
```

The raster arrives through a callback rather than being fetched. That keeps the
package pure and browser-safe, keeps decoding where it already lives, and — more
usefully — lets the whole pipeline be driven by synthetic drawings in a test,
which is the only way to know that what comes out is a reading of the page
rather than a memory of one project.
