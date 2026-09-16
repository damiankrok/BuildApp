# Image metrology

*A pixel on a registered drawing is a known number of millimetres. This is the
package that works out how many, and what a measurement made with it is worth.*

`packages/image-metrology` knows about pictures of buildings and about no
particular building. No React, no Three.js, no reference package, no project
constants.

## Why it exists

The reconstruction used to scale an elevation against the outline an
ink-silhouette extractor traced on it. On a technical line drawing that
outline is the building. On a photo-realistic render it is the building, the
lawn, the trees, the sky and the publisher's logo — and on the four elevations
of the reference project it came back as the entire frame, 1279 × 596 px,
every time.

The arithmetic of that is not subtle. The ridge is 485 px tall in a 596 px
image, so every height read off those drawings came out 23% short. It was
invisible because a silhouette that is wrong is still a silhouette: nothing
downstream had any way to ask whether the outline it was given was a building.

## Finding the building: `architecturalBounds`

The distinguishing property of a building in a picture is not colour, or
position, or contrast. It is **straightness**. A building is made of edges
that run straight for hundreds of pixels; a tree has none, a cloud has none, a
lawn has none. That works the same on a line drawing and on a render, because
both draw the building with straight edges and neither draws the foliage with
any.

Three details earn their place, each learnt from a real drawing.

**What counts as an edge is derived from the image, not fixed.** A gradient
threshold of 10/255 sits below these renders' JPEG noise floor, so nearly
every pixel reads as strong, foliage joins into apparently continuous columns,
and a tree passes for a wall. Worse, that failure is scale-dependent — the
same drawing at 0.43x has a different noise floor — which is precisely the
scale invariance this package has to have. The median absolute gradient plus
four robust deviations lands at 14/255 at full size and 21/255 at 0.43x, and
at both the building's edges run for hundreds of pixels while the trees
collapse to runs of nine to twenty-seven. A noiseless line drawing has no
noise floor at all, so a floor keeps the derivation sane.

**The extent comes from the ENDPOINTS of long horizontals as well as from the
positions of long verticals.** A dark garage wall against dark trees produces
no vertical edge at all, but the garage's own roof line stops dead at it.

**An endpoint that lands on the FRAME is not an endpoint of anything.** The
ground line, the horizon and the paving run out of the picture; where they
stop is where the photographer cropped.

Two things were tried here and are wrong, both recorded in the source because
both look obviously right:

- *weighting an edge by its contrast* — a building's weakest edges are the
  ones that matter most, while the foliage is hard black against bright sky;
- *dropping the lightest outlying group of candidates* — a building's extreme
  edges have the least evidence behind them by their nature, and the lightest
  outlying group on a real elevation is the chimney.

Each cost 58 px of building on the front elevation and 111 on the side.

## What kind of drawing this is: `drawingCharacter`

A source package can say ELEVATION, and be right, about an image that is a
render rather than a line drawing. Both are orthographic and both register
perfectly well for scale and extent. They are not remotely the same thing to
read: on a line drawing a rectangle detector returns the openings, and on a
render it returns bands of shadow and strips of cladding that are every bit as
crisp.

A line drawing is ink on paper: most of the sheet is exactly one tone. A
render has no background tone at all. The share of a picture within two levels
of its commonest tone separates them with nothing in between — the fixture's
drawings score 0.88 to 0.97 with one tone covering half the sheet, and the
reference project's four renders 0.08 to 0.37 with seven to forty-three.

This decides how much a LONE reading of a drawing is worth. It does not decide
whether to use the drawing: a render still states the building's extent, and
the extent is what a registration needs.

## Registering: `registerOrthographic`

For an orthographic drawing, do not solve a camera. Fit image coordinates
straight onto facade metric coordinates:

```
x_m = ax·u + bx·v + cx
y_m = ay·u + by·v + cy
```

The two axes are fitted **separately**, because the anchors are separate: a
wall face pins a horizontal and says nothing about height; a ridge pins a
height and says nothing about where along the facade it is.

The fit is robust, and it holds one anchor back where it can afford to — never
an extreme, because dropping an endpoint turns an interpolation into an
extrapolation and tests nothing useful. A least-squares fit always explains
what it was fitted to; the only honest test of a registration is a coordinate
it has never seen.

**It only fits what the anchors can actually see.** The cross terms are
unidentifiable when every anchor for an axis was read off the same scanline,
which is the normal case rather than a corner one. Left to itself the solver
returns a spurious cross term that explains all of those anchors to the
millimetre: on a four-anchor fixture it reported a scale 17% wrong, an rms of
0.000 m and a VALID frame. Silently wrong geometry with maximum confidence is
the one outcome this package must never produce.

## Measuring: `measureHorizontal` / `measureVertical`

A measurement with no uncertainty is a claim nobody can argue with. Three
things go into the bar, and each is reported separately so a total can be
decomposed:

- the two **edges**, each with its own pixel sigma, converted at the frame's
  scale and added in quadrature;
- the **scale** itself, only as good as the anchors that fixed it, whose
  fractional error multiplies the length being measured;
- the **registration**, the residual the anchors left behind, which shifts
  both ends together and so enters once rather than twice.

On a 1280 px render of a 12 m house one pixel is about 17 mm, so an edge found
to within five pixels is an edge found to within nine centimetres. Numbers
like that are worth stating; a half-metre error on the same drawing is a bug,
not a limit, and this package exists partly so the difference is visible.

## Refining a line: `refineEdge`

A detector only has to say "the wall is about here". This says where it
actually is, to a fraction of a pixel, by taking the gradient's centre of mass
across the edge.

Candidate lines are ranked by **coverage** — how much of the search window
they are drawn across, counting every segment long enough to be drawn on
purpose — and not by their longest unbroken run. Finding the building wants
the unbroken run, because that is what a tree has none of. Refining a line
already known to be there wants coverage, because mullions break the head of a
window into four pieces and none of them is long.

An edge's uncertainty comes from the edge: the centroid of a profile of spread
`s` over `n` independent rows is good to `s/√n`, floored at a quarter pixel
for the systematic part that length cannot average away.

## Measuring an opening: `verticalOpeningExtent`

A rectangle detector run over a render does not return windows. Across the
reference project's four facades it returned thirty rectangles and not one of
them was an opening.

So an opening's extent is measured **differentially**: an opening is the
stretch of a column band that stops looking like the wall immediately either
side of it. Comparing a strip against its own neighbours rather than against
an absolute threshold is what makes this survive a render — the glass, the sky
reflected in it, the render tone, the sun and the shadow all move both strips
together, and only a hole in the wall moves one of them.

Three rules keep it honest:

- the reference strips are **narrow** and taken from immediately beside the
  opening, because a facade's piers are as narrow as the builder could make
  them and a strip sized as a fraction of the opening reaches through the pier
  into the next window;
- a row counts as inside the opening only when it differs from the wall on
  **both** sides, each summarised by its median — a hole has wall on both
  sides of it, by definition;
- the run has to **stop inside** the searched range, with wall above and
  below it, because a rendered panel beside a clad one differs from its
  neighbour all the way from the ground to the eaves.

The two classes of row are separated by Otsu's threshold rather than by a
level set from the quiet rows. "The opening is what stands out of the median
row" assumes most of the range is wall, and that is false exactly where it
matters: a tall window fills seventy per cent of its storey.

## Which way round a drawing reads: `silhouetteTop`

There is a convention for this — a wall is traversed with the building on its
left, so an elevation's left-hand edge is the wall's far end — and whether it
is right depends on which way the plan's axes were read and which face the
drawing shows. Getting it wrong is invisible: every opening still lands on the
correct facade at the correct offset, because that comes from the plan. What
breaks is every question put to the elevation, silently, in the mirror.

So it is measured. For each column of the picture, `silhouetteTop` reports the
first row from the top where the picture stops being sky and stays that way.
The composition already knows how tall the building is at every point along a
facade; laying the two against each other both ways round and keeping the
better fit answers the question in metres.

Matching the plan's gaps against the drawing's **openings** was tried first
and is not good enough: a facade has contrast wherever the interesting part of
the building is, so it points at whichever end has the windows. A tall house
beside a low garage cannot be mistaken for its own mirror image in profile.

## Looking at it: `registrationOverlay`

A `MetricImageFrame` is a transform, a list of anchors and a set of residuals,
and a list of residuals is exactly the wrong way to find out that an anchor is
on a downpipe. `npm run overlays` writes one self-contained SVG per registered
elevation, with the drawing underneath and the registration on top.

The metric grid is the reason to open one. A registration a few per cent out
reads perfectly well as a number and is obvious the moment its half-metre
ticks are laid over a building whose storeys are three metres: they drift.

## A facade seen at an angle: `registerPerspectivePlane`

An orthographic elevation collapses to a scale and an offset per axis. A
photograph of the same wall does not, and no affine map can express a far end
that is smaller. A planar homography can, because the wall is a plane and a
pinhole camera maps one plane to another by a 3×3 projective transform.

Two things are not optional, both about conditioning. **Hartley
normalisation**, because solving the raw system mixes pixel coordinates in the
hundreds with metric ones in the units, and the answer is otherwise dominated
by rounding. And **RANSAC**, because a single correspondence on the wrong
feature does not bend a homography, it breaks it: eight degrees of freedom
will contort to pass through a bad point and take the other seven with them.
The minimal sets are enumerated in a fixed order rather than sampled, so the
same correspondences always give the same plane.

A perspective frame measures the same way an orthographic one does, with one
difference a caller has to respect: **the scale varies across the picture**.
`metresPerPixel` on the transform is the scale at the middle of the region and
nothing more, so a measurement maps both of its ends and subtracts, never
multiplies a pixel length by a number.

## Where the camera was: `solveCamera`

A homography measures a plane and is useless for anything that stands off one
— a balcony's depth, an eaves projection, the set-back of a garage. For those
the camera itself has to be solved: the 3×4 projection matrix has eleven
degrees of freedom, six correspondences over-determine it, and its left block
factors by RQ into intrinsics, rotation and position. The linear solve
minimises an algebraic error, so the pose is then polished against the one
that matters — how far each point lands from where it was seen.

The configuration matters more than the count. Six points on **one plane** do
not determine a camera however well they are measured; the system is rank
deficient and a solve would return a confident answer to a question that has
none. That is measured, by how far the points sit from their own best-fitting
plane, and refused.

## Without a camera at all: `vanishingPoint`, `heightByCrossRatio`

A family of parallel lines meets at a point, and that point is a direction in
space. Lines that really are parallel in the picture give a point at infinity,
which is correct rather than a failure, so it comes back in homogeneous form
and is converted to pixels only where that means something.

Given the vertical vanishing point, the ground plane's horizon and one
vertical of known height, the height of any other vertical standing on the
same ground follows from a cross-ratio — no camera, no focal length, no plane
fit. It is a fallback and it is ranked as one: what it must never do is
outrank a printed dimension.

## One quantity, several drawings: `fuseQuantity`

A semantic opening is observed more than once: the plan draws its gap, an
elevation shows its reveals, a callout prints its size, a render shows it
foreshortened. They will not agree.

Two different questions decide the answer. **Authority** is about the kind of
source — a printed dimension is the publisher stating the number, a
measurement off a registered drawing is this pipeline reading it, a convention
is nobody measuring anything — and that order is not negotiable by a source
being very sure of itself. **Precision** is about the individual measurement,
and two readings of the same authority combine by inverse variance, which is
the reason every measurement here carries a computed uncertainty.

The loss is robust because the failure that matters is not noise: a
measurement that has found the wrong feature is a different number about a
different thing, and least squares given one of those moves most of the way
towards it.

What it deliberately does not do is hide the disagreement. Sources that agree
within their own error bars produce a value tighter than any of them; sources
that do not produce the same value with the disagreement stated, the offending
source named, and the status saying so.

## What this package does not do

- **No joint multi-view registration.** `fuseQuantity` combines finished
  measurements; it does not re-fit several drawings against each other. Each
  is registered independently, and where four elevations of one building agree
  to 0.9% on the scale, that agreement is reported rather than used as a
  constraint.
- **No gable apex.** An apex is where two diagonals meet, so there is no long
  horizontal or vertical edge there at all. `rect` reaches it only when
  something rectilinear — usually a chimney — happens to stand as tall, and
  `extremes` is where to look for whatever stood above the eaves.
- **No raked head.** A sloping head is not a drawn horizontal line, so a
  refinement cannot land on one, and an opening under a roof slope is refused
  rather than reported as a rectangle.
