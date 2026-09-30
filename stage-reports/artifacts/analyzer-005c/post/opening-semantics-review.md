# 005C post-implementation review B — false closure and gap semantics (red team)

Independent, read-only; synthetic fixtures only (5 cm/px, 0.6 m walls), no network, no house bytes. Most scenarios
use the §36 no. 7 "wing house" (a wing whose front is piers and glazing, so the long-band box stops at the main front
and the wing is an accepted extension: 215.18 m² on its own). Dispositions are in the stage report, §W.

## P0 — exterior built as floor (none trips the strict/exclusion disagreement)

1. **Paving, kerb, slab-edge, step and tile lines across a gap between wall jambs read as a STRONG opening.** One
   continuous line within a face row or just outside it reads LEAF_FACE (a "vehicle door" for 2.2–8 m); two or more
   within ±0.75 wall read GLAZING, whatever their number and whether they run on past the jambs. The contract's
   continuation test was not implemented. A terrace in front of the wing between a garden wall and the wing, with a
   paving line along its front: built 240.0 m² against 215.18 (+24.8, the terrace).
2. **Extension components are grouped by cell adjacency alone:** a part walled off from the house by solid wall
   rides in with an accepted wing and is accepted on the wing's continuation.
3. **Corner legs close a corner on one thin line per leg**, the pier's kind unchecked, and the two legs vouch for
   each other: a platform drawn only as two outline lines beside a wing is built (+8.9 m²).

## P1

4. A POST jamb with two lines reads as glazing between piers, including two free posts and lines running past them:
   a 3 × 3 m corner terrace with a pergola post and two step lines on each side is built, as a PROJECTING_WING.
5. A callout alone lifts a blank gap to STRONG, and the assignment is loose (1 m of slack past a gap, any width
   alternative, first-wins ties, before the corner legs exist): a carport with a blank 5 m mouth is built when a
   neighbouring window's "500" callout sits equidistant from both gaps.
6. The house the parts are named against excludes the accepted extension, so a terrace beside a wing counts the
   wing's walls as its own sides and is named OPEN_MOUTH_GARAGE (the mouth's corner piers unchecked); the reading that
   shuts pocket mouths then builds it (+15.8 m²), and the resolver spends readings on it.
7. The pocket rule judges WEAK gaps one at a time with the others still shut, so a through-passage looks like a
   pocket from each end and is closed (a 1.5 × 6 m side passage built, 4.3 % — inside the agreement band).
8. The wall-witness join accepts any two lines or one on the axis across 2–20 walls: a garden wall 10 m away joined
   by a path line re-frames the extent.
9. A corner pier cut free by openings is a POST, so the glazing beside it reads exterior (a false opening; the
   outline is then lost, not invented).

## P2

10. Continuity is an absolute run count: a dashed overhead line on the axis of a 1 m gap reads as a door.
11. Wall-thick ink within ~0.3 m of a face line (a planter, a bench) fills a 4 m facade gap.
12. A two-line balustrade across a loggia mouth reads as glazing (inherent in the drawing; should be ambiguous).

## Held up

Blank gaps over 3.2 m are exterior and the §38 case adopts nothing; dashed lines over wide gaps are exterior; a
single line on the axis of a gap over 3.2 m is exterior; hatching and diagonal watermark strokes read BLANK; posts
without glazing never act as jambs; the porch case (a post 3.5 px off the facade line, one line on the axis) is not
built; frames where the box is right stay byte for byte; a blank loggia stays an open pocket; a terrace with nothing
drawn is not built in the first reading; a corner leg with nothing drawn is never a leg; a face line does not join a
distant wall into the witness; the disagreement flag fires when WEAK gaps add more than 6 %.
