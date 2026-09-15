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

## The ladder of level datums

The same redundancy, in the vertical. Every printed level states a height above
the drawing's zero and is printed against a rule at a known row, so the pairs
(row, height) must fall on ONE straight line. A `+3,06` misread as `+5,06`
survives every check a single reading can be given — clean characters,
plausible value, good association — and does not survive being asked to agree
with the other three heights on the same sheet.

A plus-or-minus sign means "this is the zero", and is written on nothing else.
`±0,08` is not a height eight centimetres up.

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
with its glyphs and their runners-up, every reading, every chain, every
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
