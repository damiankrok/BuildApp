# 005C post-implementation review A — boundary correctness

Independent, read-only; synthetic plans (5 cm/px, 0.6 m walls, a 16 × 12 m house = 192 m²); "old" is `d3235bf`
extracted with `git archive`, "new" is the 005C head; B is the opening-aware outline, A the long-band box reading.
Dispositions are in the stage report, §W.

## P0 — a wrong building with no flag

1. **Adoption joins cells across closed edges.** A walled yard with a gate beside an accepted wing is built with it
   (239.78 m² against 215.18); with the gate drawn as a leaf both policies agree on 240.83 and nothing is flagged.
   The component flood in `adopt()` ignores `edge.closed` and the continuation is judged for the merged group.
2. **One thin line bridges 2.2–8 m, even on or outside the outer face,** between any two wall pieces (garden-wall
   cross-sections included): a paving line 5 cm past the walls' ends bridges 7.4 m; a terrace fronted by one step
   line is built with the wing; a blank front door beside a free-standing pier reads exterior, so the box edge counts
   as open there and a terrace in front is adopted as a projecting wing (214.5 against 192). None of the contract's
   leaf tests (inner-face band, not past the jambs, jambs running along the line, side walls reaching in) is applied,
   and any edge that is not closed counts as continuation, a jambed doorway included.
3. **Adoption drops rooms A built, and the only-widen guard checks the wrong area.** The adopted outline is B ∩ A
   plus the extensions, so every A cell B leaks is removed; the guard compares B's raw outline — rejected components
   included — with A's built area. A rejected walled yard pads the outline past 192, the outline is adopted, and a
   36.8 m² back room A built becomes outside (178.38 against 215.18; strict adopts nothing, exclusion 178.38, no
   disagreement).

## P1

1. The gap axis moves with walls crossing elsewhere on the line (a cross-section piece's axis is the line itself),
   which flips a line between "leaf on the axis" and "vehicle door".
2. The sliver rule changes plans where B adopts nothing (an 8 m front step 0.8–1.2 m deep is dropped on a box frame).
3. The 0.8 bay-width guard changes A: a glazed conservatory whose side walls span 84 % of the side loses its bay.
4. `recutSlivers` invents a party wall through the main body where nothing is drawn (area conserved, massing wrong).

## P2

The weak-gap budget fails closed in string order; corner legs capped at 3.2 m while straight glazing goes to 8 m;
glazing broken by two sash joints reads dashed; no corner slack in edge closure; `disagree` needs both policies to
adopt (strict 0 against exclusion 178–215 can never raise the stop); the 16-extension and 16-body caps truncate
silently; a shadow line at an outer face beyond A's edge is always rejected.

## Held up

No gap over 8 m is ever bridged; wall-jambed glazing and inner-face leaves from 5 to 7.9 m hold, as do a 5 m garage
leaf at a face, short free-standing piers with glazing up to 3.2 m and corner windows with legs up to 3.2 m; a yard or
step-line terrace in front of a closed house front is rejected; an integral garage with a blank 3 m door and a
vestibule are kept; a wing inset 0–25 cm is adopted; output identical three times on all 11 read plans of the
development houses; A is unchanged on every non-adopting plan except the two the contract allows (the side-wall reach
and the bay guard); at most 31 floods and 137 ms per plan; area conserved from decomposition to footprint on four
adopted wings; no house or publisher name in added production code.
