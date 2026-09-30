# 005C post-implementation review C — attached bodies and how they become masses

Independent, read-only; synthetic plans through the repository's helpers and the full `reconstructV2` pipeline, and
the development houses from cached bytes only. Dispositions are in the stage report, §W.

## P0

1. **A U-shaped outline becomes one rectangle and its courtyard becomes floor.** The 005C decomposition is right
   (242 m², the courtyard RECESS), but on an outline frame RECESS is tested against the outline's bounding box and
   `planBodies` inflates the body across RECESS cells: one 16 × 17 m mass of 272 m² completes (+12.4 %, only
   degrading against a published figure). The frozen path stopped instead.
2. **The strip re-cut splits the main body, and a one-storey porch rises two storeys.** A two-storey house with a
   1.2 m glazed porch completes as three two-storey masses; at 1.4 m it is right.
3. **Outline frames are massed as largest-first rectangles and the roles follow the strips.** On willa-miranda the
   MAIN body carrying the gable roof and the upper storey is an 8.89 × 1.69 m strip (the upper plan registered onto
   it); the real 12.44 × 7.34 m body is ATTACHED under a flat roof. dom-w-modrzykach is six bodies although its own
   gate says the elevations read as one block.

## P1

4. Party-wall garages are still decided by the reach rule, and drawing the vehicle door removes a garage the blank
   mouth builds in the shut reading (not monotone).
5. A wing joined through an opening of 3.2 m or less is refused: an unjudged weak gap counts as wall.
6. The 0.8 pair guard drops a correct bay whose side walls span 84–90 % of its side.
7. OPEN_MOUTH_GARAGE names walled terraces, a courtyard and a carport (no corner piers, not the only unbridged gap,
   no vehicle evidence); the shut reading builds the terraces.
8. A double garage with a central post is never enclosed (a leaf between a wall jamb and a post falls to exterior).
9. A shallow projection (≲ 1.7 walls) reads its own front as the junction: the read window is not clipped at the
   neighbouring grid line.
10. `groundStoreyOf` picks a registered partial basement (as the frozen code did).
11. A wing `baysOf` shuts is still dropped by the 35 % wall gate on a box frame.

## P2

Fixed thresholds that act like reach rules (the minimum body span, the read window, the 3.2 m junction, `minOut`, the
garage's side-wall share); `baysOf` and the boundary reader disagree on a vehicle door at the outer face; the level
clamp can replace printed values with the convention; `baysOf` pairs a side wall with a central pier (existed before).

## Held up

Projecting wings with an open junction are built to the exact area, flush or inset, blank, leaf or glazed front,
reaches from 1.2 to 8 m, side walls continuing interior walls included; garages with a blank mouth over 3.2 m are
named, open in the first reading and built exactly in the shut reading; covered terraces, pergolas, carports on
posts, a walled terrace in an L's notch and one with a step line stay unbuilt; an L outline gives two correct masses
and the upper storey only over the house; the re-cut conserves area; the 0.8 guard leaves every bay up to 80 %
identical; `groundStoreyOf` skips an unregistered basement and never a storey ≥ 0; no emission failure in any run.
