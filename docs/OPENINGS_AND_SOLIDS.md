# Openings, mullions and things that look like volumes

*What counts as a hole in a wall, and what counts as a solid on one.*

## Openings come from the plan

> Since BUILDAPP-03R1 the plan gap is a PROPOSAL and not the answer: a
> run-length band gives up a few pixels before the wall actually stops, so
> each reveal is then found in the drawing itself, sub-pixel. On the reference
> project's ground-floor plan that is the difference between a 5.03 m rear
> glazing and the 4.70 m the publisher prints. See `docs/IMAGE_METROLOGY.md`.


An elevation of a published project is very often a photo-realistic render, and
a rectangle detector run over one returns panes, cladding boards, shadows and
reflections along with the windows. A floor plan is the opposite: it is a
measured drawing, every opening in it is a GAP IN A WALL, and the gap is at the
position and the width the building has.

So an opening's position and width come from the plan:

- which wall of which body it is in, and which storey;
- where along that wall it starts, in the dimension chains' own metres;
- how wide it is.

A gap is the stretch of a wall line that no wall band covers, with two things
counted as masonry: the pieces of the band running ALONG the line, and every
band CROSSING it. The second matters — a wall meeting another wall is solid
there, and the band reader cannot see it, because at a crossing the run across
belongs to the other wall. Without it every junction reads as a hole.

Heights come from elsewhere. A Polish catalogue plan prints a CALLOUT against
each opening — `110/230`, `275/205` — which is its width and height in
centimetres. A callout is matched on POSITION first and then checked on width,
so a callout belonging to a different opening cannot capture this one by being
the nearest number on the sheet; where the callout's width and the gap's width
agree, the opening has been measured twice by two different means. What is left
is the sill, which a plan cannot show: an opening as tall as a door goes to the
floor, and a shorter one hangs from the usual lintel. Both are conventions and
both say so.

## Grouping: a mullion is not another opening

A rectangle detector does not return windows. It returns every closed rectangle
it can see, and a window is usually several of them: the reveal, the frame
inside it, the sashes inside that, and one rectangle per pane.

Grouping is by ADJACENCY IN THE BUILDING, not by appearance:

- one rectangle inside another is the same hole seen twice;
- two rectangles that overlap are the same hole found twice;
- two rectangles that line up along one axis, separated by less than a
  mullion's width (0.16 m) AND comparable in size across the joint, are two
  lights of one window;
- a rectangle belonging to a large, regular field of rectangles of the same
  size is cladding, and is refused outright.

The size test on the third rule is what stops a band running the width of a
facade from swallowing the window it passes over and turning a 1.8 m opening
into a 9.6 m one. The fourth needs the run to be long AND the rhythm even:
three windows at a regular spacing is a house; eleven identical rectangles
0.2 m apart is a wall.

Everything refused is named, because a window the pipeline decided was cladding
is exactly the sort of decision a reviewer has to be able to find.

## The linear solid evidence gate

A facade band that stands proud of the wall is a VOLUME, and a volume needs
evidence of DEPTH. A tone difference is not that evidence: a render's shadow, a
change of material, a reflection and a strip of dark cladding all produce the
same band of darker pixels, and building each of them as a 0.3 m solid produces
the barcode the owner saw on the first Android preview.

So a band becomes a solid only under one of three conditions:

- **A.** two independent technical or source views see it, and agree;
- **B.** one technical elevation sees it and one perspective view shows a depth
  cue for it — a return face, an end, an occlusion;
- **C.** a very high-confidence visible-volume cue with an explicit end, return
  face or occlusion, on a host the geometry is consistent with.

A tone or colour band on one view, with nothing showing it has an end, is
refused, and the refusal is recorded. A hundred plausible but depth-unsupported
stripes on one elevation produce zero solids; that is a test, not a hope.

## Recesses are topology

A loggia, a set-back entrance and a balcony under the roof are all the same
shape of fact: a MOUTH in a facade plane, a BACK plane set behind it, two
RETURN walls joining them, a slab under it, and a depth. Storing one as a
coloured patch on an elevation — or worse as a free-standing box hung off the
facade — loses every one of those and produces a building that reads as flat.

A recess is found on the PLAN, as a cell the flood fill can reach but which the
building wraps on three sides, and it is recorded with its mouth side, its
mouth interval, its back plane, its depth, and whether each return is drawn.
Losing a return changes the reading: the pocket runs on to whatever does close
it, which is a wider loggia and not the one that was drawn.
