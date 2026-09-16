# BUILDAPP-03R1 — Image metrology and proportional facade fitting

Branch `claude/buildapp-buildworld-v1-7y6yqh`, from `4505e148` (the sealed
end of BUILDAPP-03R). All of 03R's structural work is intact: two
source-derived bodies, storey-specific footprints, a 40° gable on published
specification, a separate flat garage roof, `STRUCTURAL_LAYOUT_ACCEPTED`.

## What this stage was for

03R measured a 0.329 m median error on the reference project's opening
widths and could not account for it. The brief's conclusion was that the
missing capability is not more OCR but **metric image metrology**: a pixel on
a registered drawing is a known number of millimetres, so an edge found to
within five pixels is an edge found to within nine centimetres, and a
half-metre error on such a drawing is a bug rather than a limit.

That turned out to be exactly right, and the bug was in a place nobody had
reason to look.

## The three findings

### 1. Every elevation was registered against its own picture frame

The ink-silhouette extractor traced all four of the reference project's
elevations as **1279 × 596 px — the entire image**, every time. On a
photo-realistic render it traces the lawn, the trees and the sky along with
the house, and `registerElevations` took that as the building's outline.

The ridge is 485 px tall in a 596 px image. So every height read off those
drawings came out **23% short**, and the outline was reported as five metres
wider than the bodies beneath it, which is why 03R's structural projection
audit could check none of the four. It was invisible because a silhouette
that is wrong is still a silhouette: nothing downstream had any way to ask
whether the outline it was given was a building.

`buildingExtent` now decides between two readings on the evidence. A
silhouette covering 85% or more of the sheet has failed on its own terms —
every drawing has margins — and only then is the outline measured off the
pixels. Neither reading is preferred by decree, because they fail in
opposite directions: on a technical line drawing the dimension chains are as
long, straight and rectilinear as the building, so the measured outline reads
*wider* there where the traced one reads narrower.

| | outline surplus over the bodies beneath it |
| --- | --- |
| before | 4.98, 5.01, 4.45, 4.42 m |
| after | 0.00, 0.00, 1.91, 1.53 m |

### 2. A plan gap is not measured between the ends of two wall bands

A run-length band gives up a few pixels early: the last of a wall beside an
opening is drawn with a reveal, a nib or an antialiased edge, and the
thickness test fails there. On the ground-floor plan the rear glazing read
5.03 m between band ends where the black poché actually stops 4.74 m apart,
against a printed 4.70 — about five pixels of lost wall at each end, and a
third of a metre on the answer.

Those five pixels are not missing from the drawing. The end of a wall is one
of the hardest edges on a sheet — solid ink against an empty opening, running
the full thickness of the wall — so it is now found there directly and
sub-pixel. **Median opening-width error 0.329 m → 0.066 m.**

### 3. A source package can say ELEVATION, and be right, about a render

All four of this project's elevations are genuine orthographic elevations.
They are also photo-realistic renders, and that is not a distinction the
package records. Both register perfectly well for scale and extent. They are
not remotely the same thing to *read*:

- the rectangle detector returned **thirty rectangles across the four
  facades and not one of them was an opening**; its best rectangle over the
  2.25 m garage door is 1.21 m of one of its panels;
- a differential profile — where does this column band stop looking like the
  wall either side of it — reports a 1.40 m window as **0.23 m tall**, having
  locked onto a shadow band with two perfectly crisp edges.

Neither failure announces itself. `drawingCharacter` decides which kind of
drawing this is from the pixels: a line drawing is ink on paper and one tone
covers half the sheet; a render has no background tone at all.

| | flat share | tones covering half the sheet | verdict |
| --- | --- | --- | --- |
| fixture elevations (4) | 0.881 – 0.969 | 1 | LINE_DRAWING |
| fixture plans (2) | 0.895 – 0.908 | 1 | LINE_DRAWING |
| reference elevations (4) | 0.083 – 0.368 | 7 – 43 | RENDERED |

Nothing falls between them. On a line drawing a lone reading is believed. On
a render a height is taken only where two independent readings agree, and
where they do not the opening's height is **declared unmeasured and named as
a hole** — which on these four is all of them. That is a finding about the
sources, not a failure of nerve: what a render does support, the building's
extent and the plan's own reveals, is used exactly as before.

## §23 — the four elevations, proved from content

| view | asset | pixels | content | architectural bounds | mm/px across, up | rms | worst | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REAR | …ewacja-ogro-77ee09534e | 1280×598 | RENDERED | 254, 104 – 971, 586 | 16.49 / 16.49 | 0.0000 | 0.0000 | METRIC_FRAME_VALID |
| FRONT | …ewacja-fron-ee81d52db6 | 1280×597 | RENDERED | 374, 104 – 1089, 589 | 16.39 / 16.39 | 0.0000 | 0.0000 | METRIC_FRAME_VALID |
| LEFT | …ewacja-bocz-2d2de51c62 | 1280×598 | RENDERED | 199, 100 – 1081, 583 | 16.46 / 16.46 | 0.0000 | 0.0000 | METRIC_FRAME_VALID |
| RIGHT | …ewacja-bocz-10833ce28d | 1280×597 | RENDERED | 206, 100 – 1076, 589 | 16.26 / 16.26 | 0.0000 | 0.0000 | METRIC_FRAME_VALID |

**Projection validation.** All four are orthographic: the building's extent
in each is recovered to within 4 px of where it is, and the two independent
scales — 12.05 m across the bounds' width, 7.95 m from the ground line to the
silhouette's own highest point — agree to 2.4%. Across four separate
drawings the recovered scale spans 16.26 to 16.49 mm per pixel, which is a
0.9% spread on four independent measurements of one building.

**03R's "uncheckable" verdict was wrong about the images and right only about
the extractor.** The rms of 0.0000 m is honest and uninformative: these frames
carry exactly two anchors per axis, so the fit is exact and nothing is held
back, which is what each frame's own `why` says in as many words.

**The elevation callouts cannot be read at this resolution, and are not
guessed.** The plans do print them — `470/230`, `300/230`, `110/230`,
`105/210`, `275/225`, `100/210`, `90/230`, `140/140` on the ground floor and
`234/303` twice plus `270/320` on the attic — as a stacked fraction inside a
23 px leader balloon. The digits are about six pixels tall and merge into one
blob. The numeric reader could be made to emit something for them; a wrong
printed dimension is treated as the top authority under §24 and would be
worse than none, so it emits nothing. The single variant the site serves for
each plan is the largest one available.

## §18 — the twelve major facade openings

All four targets met, on a candidate with no reference package in the tree.

| | target | got |
| --- | --- | --- |
| recovered | 12 / 12 | **12 / 12** |
| on the correct facade | ≥ 10 / 12 | **12 / 12** |
| median centre error | ≤ 0.20 m | **0.133 m** |
| median width error | ≤ 0.15 m | **0.066 m** |
| median height error | ≤ 0.15 m | **0.100 m** |

Distribution, as §18 requires: centre p90 0.717 m, worst 0.773 m; width p90
0.507 m, worst 1.634 m; height p90 1.370 m, worst 1.516 m.

| reference opening | printed | ref w × h | auto w × h | width err | height err | centre err | height from |
| --- | --- | --- | --- | --- | --- | --- | --- |
| og-east-garage-door | — | 0.93 × 2.10 | 1.14 × 2.20 | +0.209 | +0.100 | 0.109 | convention, named hole |
| og-east-living-window | 300/230 | 3.00 × 2.30 | 2.98 × 2.20 | −0.020 | −0.100 | 0.052 | convention, named hole |
| og-front-entrance | 105/210 | 1.05 × 2.10 | 1.12 × 2.20 | +0.066 | +0.100 | 0.172 | convention, named hole |
| og-front-gable-glazing | 270/320 | 2.70 × 3.20 | 4.33 × 1.68 | +1.634 | −1.516 | 0.773 | convention, named hole |
| og-front-room-window | 110/230 | 1.10 × 2.30 | 0.82 × 2.20 | −0.280 | −0.100 | 0.133 | convention, named hole |
| og-garage-door | 275/225 | 2.75 × 2.25 | 2.80 × 2.20 | +0.048 | −0.050 | 0.026 | convention, named hole |
| og-garage-side-door | 100/210 | 1.00 × 2.10 | 0.95 × 2.20 | −0.054 | +0.100 | 0.051 | convention, named hole |
| og-rear-gable-east | 234/303 | 2.34 × 1.07 | 2.85 × 1.68 | +0.507 | +0.615 | 0.332 | convention, named hole |
| og-rear-gable-west | 234/303 | 2.34 × 3.03 | 2.66 × 1.66 | +0.320 | −1.370 | 0.717 | convention, named hole |
| og-rear-living-glazing | 470/230 | 4.70 × 2.30 | 4.67 × 2.20 | −0.032 | −0.100 | 0.053 | convention, named hole |
| og-west-kitchen-window | 140/140 | 1.40 × 1.40 | 1.40 × 2.20 | −0.001 | +0.800 | 0.500 | convention, named hole |
| og-west-living-window | 90/230 | 0.90 × 2.30 | 0.90 × 2.20 | −0.002 | −0.100 | 0.050 | convention, named hole |

Seven of the eight **ground-floor** widths are within 0.07 m of the printed
dimension, measured off the plan without reading it. Every height in the table
is a convention with a named hole beside it, for the reason in finding 3.

**The whole tail is the three raked gable windows**, whose heads follow the
roof slope. A sloping head is not a drawn horizontal line, so nothing here
can land on one — §21's mutation 11 asserts that this is refused rather than
reported as a rectangle, and it is. Their plan gaps are also the widest
errors, because the attic plan's gaps run past the raked wall into the roof.
Measuring a raked opening needs the rake line itself, which this stage did not
build.

## The package

`packages/image-metrology` — no React, no Three.js, no knowledge of any
particular building. 104 tests of its own.

- `bounds.ts` — finding the building in the picture. Straightness, with the
  gradient threshold **derived from the image** rather than fixed: a
  threshold of 10/255 sits below these renders' JPEG noise floor, so foliage
  joins into apparently continuous columns and a tree passes for a wall.
  That failure is scale-dependent, which is exactly what §19 forbids. Median
  plus four robust deviations lands at 14/255 at full size and 21/255 at
  0.43x, and at both the building's edges run for hundreds of pixels while
  the trees collapse to runs of nine to twenty-seven.
- `orthographic.ts` — §4's affine fit, per axis, robust, holding one anchor
  back where it can afford to.
- `measure.ts` — §9's arithmetic: edges, scale and registration in
  quadrature, each reported separately.
- `opening.ts` — §15's differential extent, §10's `drawingCharacter`, and
  the silhouette profile that decides which way round an elevation reads.
- `overlay.ts` — §22's visual debugger.
- `homography.ts` — §11A. A facade seen at an angle is a plane, and a pinhole
  camera maps one plane to another by a 3×3 projective transform. Four
  correspondences fix its eight degrees of freedom; more than four say whether
  the wall is really a plane. Hartley normalisation, because the raw system
  mixes pixel coordinates in the hundreds with metric ones in the units and
  the answer is otherwise dominated by rounding; and RANSAC over minimal sets
  **enumerated in a fixed order rather than sampled**, because one
  correspondence on the wrong feature does not bend a homography — eight
  degrees of freedom will contort to pass through a bad point and take the
  other seven with them.
- `camera.ts` — §11B and §12. A homography measures a plane and is useless for
  anything that stands off one: a balcony's depth, an eaves projection, a
  garage's set-back. `solveCamera` resects the 3×4 projection matrix from six
  or more world points, polishes it by minimising **reprojection** error
  rather than the algebraic error the linear solve minimises, and factors the
  left block by RQ into intrinsics, rotation and position. `vanishingPoint`
  and `heightByCrossRatio` are §12's fallback: where a camera cannot be
  solved, a family of parallel lines still meets at a point, and one vertical
  of known height measures any other on the same ground.

- `fuse.ts` — §13 and §24. One semantic quantity observed several times, and
  what to believe. Authority decides the kind of source and precision decides
  between two of the same kind, so the weight is `rank / σ²`; the loss is
  robust because a measurement that has found the wrong feature is not a
  little wrong but a different number about a different thing. Two sources
  that agree produce a value tighter than either; two that disagree produce
  the same value with the disagreement as its error bar, the offending source
  named, and the status saying DISPUTED. A quantity measured once comes back
  marked SINGLE_SOURCE, which is the thing a caller most needs to know.

### The metric frame

One contract covers all three. `MetricImageFrame` carries the anchors it was
fitted to, a residual per anchor, the anchors **held back** as an independent
check, the transform (affine, homography or camera), and an uncertainty with
its parts separated: metres per pixel on each axis, the anchor rms and worst,
and the systematic floor under anything measured from it. A measurement off it
carries its own pixel interval, its metric interval, its role — registration
anchor, independent measurement or corroborating measurement — and an
uncertainty decomposed into edges, scale and registration.

### Perspective, measured

| what | result |
| --- | --- |
| §20 D: scene A's 10 m facade photographed by a stated camera | its three openings measure within **0.08 m** through the homography |
| the camera resected from that picture | within **0.2 m** of where it stood, focal length 900 px recovered |
| a point the solve never saw | reprojects within **1 px** of where that camera would put it |
| nine perfectly measured **coplanar** points | **refused** — six points on one plane do not determine a camera, however well measured |
| a correspondence 60 px out | **named**, not absorbed |
| a height by cross-ratio, no camera at all | 4.5 m measured to within **0.2 m** against a 3 m reference |

A perspective frame measures the same way an orthographic one does, with one
difference a caller has to respect: **the scale varies across the picture**.
`metresPerPixel` on a homography transform is the scale at the middle of the
region and nothing more, so a measurement maps both of its ends and subtracts,
never multiplies a pixel length by a number.

### What the tests establish

- **§20 A/B/C** — a plain 10 m facade, a garage facade and a gable: every
  opening measured to within **0.03 m**, mullions included, from a proposal
  deliberately a dozen pixels wrong.
- **§19, mandatory** — the same facade at 0.5x, 1x, 2x, squashed 0.7 and 1.3,
  cropped with margins and through noise: within **0.08 m** throughout. Past
  the noise where the wall's own outline goes under, it **refuses** rather
  than registering the openings as the building.
- **§21, all twelve** — corrected: the mullion taken for a reveal, the shadow
  eight pixels outside it, the proposal thirty pixels out, the anisotropic
  resize. Reported: the anchor shifted fifteen pixels, the perspective view
  registered as orthographic, the correspondence paired with the wrong
  feature — named as the one that does not fit rather than averaged into the
  scale. Refused or flagged: the crop that removes a building edge, the
  low-contrast opening, the raked head. Distinguished: a line drawing from a
  render of the same aspect, and a building from its own mirror image.

### Three things that were tried and are wrong

Recorded because each looks obviously right and cost real accuracy.

1. **Weighting an edge by its contrast.** A building's weakest edges are the
   ones that matter most — the dark garage wall against dark trees — while
   the foliage is hard black against bright sky. It cost 58 px of building on
   the front elevation and 111 on the side.
2. **Dropping the lightest outlying group of candidates.** A building's
   extreme edges have the *least* evidence behind them by their nature. The
   lightest outlying group on a real elevation is the chimney; dropping it
   cost the same 58 and 111 px.
3. **Deciding an elevation's handedness by matching the plan's gaps to the
   drawing's openings.** A facade has contrast wherever the interesting part
   of the building is, so this points at whichever end has the windows —
   here the house, where the answer is the garage. The drawing's own top
   edge decides it instead, and a tall house beside a low garage cannot be
   mistaken for its mirror image.

## §13, wired

The opening-height decision goes through `fuseQuantity`. Both readings of a
drawing — the differential profile and the rectangle group — are observations
of the same two metres, the head above the floor and the sill, each with its
own uncertainty: 0.04 m for a boundary the refinement could put on a drawn
line, 0.20 m for one the profile only guessed at, 0.08 m for a detector's
rectangle. §24's order weighs them, a robust loss keeps a source that has
found the wrong feature from breaking the answer, and what comes back says
whether they AGREED, DISPUTED each other, or were a SINGLE_SOURCE with
nothing to check against.

A height is taken when they agree, or when there is only one of them and the
drawing is the kind a single reading can be trusted on. Otherwise the opening
is named as a hole.

The sealed candidate's model hash is unchanged by this rewiring —
`2a1bda898e9379de` before and after — which is the strongest evidence
available that it is a faithful re-expression of the rule rather than a change
of behaviour dressed as one.

## Also fixed

- **§24's authority order is enforced.** A printed callout previously lost to
  a detector's rectangle.
- **§7's outer-host-cut rule now applies vertically.** A garage door drawn as
  four stacked panels is one opening, not whichever panel overlapped best.
- **`refineEdge` ranks by coverage, not by longest run.** Finding the building
  wants the unbroken run — that is what a tree has none of. Refining a line
  already known to be there wants coverage, because mullions break a window's
  head into four pieces and none of them is long; the run of glazing, the
  opening whose width matters most, could not be measured at all before.
- **A fit no longer invents a term it cannot see.** Every anchor for an axis
  is normally read off one scanline, which leaves the affine cross term
  unidentifiable; the solver does not report that, it returns an exact fit
  through every anchor. On a four-anchor fixture it produced a scale 17%
  wrong, an rms of 0.000 m and a VALID frame.
- **A height no longer depends on where along the facade it was read.** With
  fewer than three anchors the fit dropped the `v` term on *both* axes.
- **Transform coefficients are kept to twelve decimals**, not six: 0.008333…
  rounds to four significant figures.

## Reconstruction

`marcowki-auto`, 44 commands, model `2a1bda89…`, replays byte-identically.
Geometric accuracy 50.3%, evidence-supported completeness 84.1%, reported
separately. 81 named holes, 16 of them MISSING or REFUSED outright — four
more than 03R, all of them opening heights this stage decided it could not
measure from a render and said so.

## Gates

| gate | result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | **1067 tests, 83 files, all passing** |
| `npm run build` | clean |
| `npm run audit:marcowki` | AUDIT PASS |
| `npm run audit:marcowki:facades` | 47 features: 36 pass, 9 deviation, 2 not modelled, worst 0.185 m |
| `npm run reconstruct:no-reference` | `STRUCTURAL_LAYOUT_ACCEPTED` with the reference package removed from the tree |
| `npm run e2e` | **22 passed** |
| CI | run 21 on `9907dac`, all four jobs green: <https://github.com/damiankrok/BuildApp/actions/runs/35112728261> |
| APK artifact | `buildplan-model-preview-apks`, 46.7 MB, uploaded by the Android job on that run |

The CI run above is the last one over the whole of this stage's code. The only
commit after it is this line and the table it sits in.

### §27's fourteen conditions

| # | condition | where |
| --- | --- | --- |
| 1 | a real image-metrology package exists | `packages/image-metrology`, 104 tests |
| 2 | technical elevations have metric registrations | the four frames above, and `stage-reports/artifacts/image-metrology/` |
| 3 | opening sizes come from pixel-to-metre measurement, not only OCR | every width is measured; **no callout was read at all** on this project |
| 4 | perspective facade planes can be rectified via homography | `registerPerspectivePlane`, §20 D within 0.08 m |
| 5 | camera PnP path exists and is tested | `solveCamera`, resected within 0.2 m and 900 px focal |
| 6 | measurement uncertainty is recorded | `uncertaintyParts`: edges, scale, registration, separately |
| 7 | opening edge refinement exists | `refineEdge`, sub-pixel, with its own sigma from the edge's profile |
| 8 | mullions do not alter structural opening width | §7 and §21.1 |
| 9 | raster scaling does not materially change metric results | §19, mandatory, six variants |
| 10 | median opening width error ≤ 0.15 m | **0.066 m** |
| 11 | median opening height error ≤ 0.15 m | **0.100 m** |
| 12 | median centre error ≤ 0.20 m | **0.133 m** |
| 13 | the 03R structural benchmark stays green | 25 benchmark assertions, all passing |
| 14 | an updated APK is published by CI | `buildplan-model-preview-apks`, 46.7 MB |

## What this stage did not do

Stated plainly, because the brief asks for a great deal and some of it is
untouched.

- **No joint multi-view REGISTRATION.** `fuseQuantity` combines finished
  measurements and the reconstruction routes its opening heights through it;
  what is not done is re-fitting several drawings against each other. Each is
  still registered independently, and the agreement between the four
  elevations — 16.26 to 16.49 mm/px, a 0.9% spread on four independent
  measurements of one building — is reported rather than used as a
  constraint.
- **The perspective path is not wired into the reconstruction.** `homography.ts`
  and `camera.ts` are built and tested against a stated camera, and the
  pipeline does not yet call them: this project's perspective renders are
  still used for nothing metric. What the stage establishes is that the
  capability exists and measures correctly, not that the reconstruction uses
  it.
- **§8's `IMAGE_METRIC_REGISTERED` evidence class** is not added to the
  evidence schema. `metricFrameOf` builds the frame an image-registered
  measurement would cite, and the measurements themselves carry their role,
  their pixel interval and their decomposed uncertainty, but they do not yet
  travel through `MetricEvidenceSet`.
- **§17's characteristic facade members** are not measured. A front elevation
  cannot measure outward depth by itself, and nothing here uses a second view
  to do it.
- **Raked openings** are refused rather than measured, as above.
