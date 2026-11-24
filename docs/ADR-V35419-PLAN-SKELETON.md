# ADR v3.54.19 — the plan skeleton: the interior and the plan's gaps belong to the plan, not to the body's builder

Status: accepted for the consult path (OWNER 2026-11-24, after the audit of APK 1351). Supersedes nothing; extends
ADR-V35418 (facade and body arbitration).

## Context

The audit of v3.54.18 R3 named five losses: a read GLAZED_WALL had no consumer; choosing a body built from the sources
erased the interior; the body grammar was a rectangle or an L; the contrast gate refused doors the plan confirms; a trace
named ids the delivered model did not hold. The first look at four new dwellings on the 1351 code repeated them: one house
without a model (an outline of ten corners), one without a roof (no settled plan scale), one with an empty interior, one
complete only because LOCAL happened to succeed.

Two of these have one root. Partitions, interior doors and the gaps of the exterior walls were read only inside LOCAL's own
reconstruction — so they existed only where that reconstruction succeeded, and went away with it when a better body
replaced LOCAL's. Nothing about a partition depends on who placed the outer walls.

## Decision

1. **Plan skeleton (`consult/plan-skeleton.ts`).** The ground-floor plan is read once, deterministically, inside the
   outline of whichever body stands: the sheet's own wall colour (the commonest drawn colour in the band inside the
   traced outline — black, dark green and mid grey fills are all walls; a paper band is named and nothing is read), the
   exterior gaps, and the partitions and interior doors by the reconstruction's own reader (`readInterior`) on the sheet
   with that colour painted as ink. Stated in the plan frame's pixels; the standing body maps it into its own frame (a
   body built turned against the sheet turns it with its outline).
2. **The body keeps its traced outline.** The skeleton moves a working copy of the outline onto the wall bands to read
   between them; the body is not rebuilt on those bands (a sheet that draws the wall's outer layer in another tone has its
   printed dimension outside the band — measured on the first replay: 0.4 m of a house lost against its own dimensions).
3. **BUILD_INTERIOR (`correct/interior.ts`).** The analyzer's own operation (origin PLAN, never offered to a reviewer):
   interior walls and doors through the executor, for a body built from the sources and for a LOCAL body with no
   partitions. An interior that is there is kept. Heights are ASSUMED and say so. Read pieces never share plan area
   (resolved by geometry: butt, cut, give way).
4. **The plan's gaps are a second drawing's witness.** They are handed to the gate for any body (`planGapsFromSkeleton`).
   For a DOOR, GLAZED_DOOR or GARAGE_DOOR the elevation reading draws on a gap, the contrast score is not asked: a
   door leaf need not stand out of its wall, so "no contrast" is no evidence of absence. A window still must not be
   refuted by the picture.
5. **Plan gaps the model does not cover** are filled where a second, typed reading of that side's elevation — a list IN
   METRES along the facade's known width (`facade-metric.ts`) — puts an opening on the same stretch (ADD_PLAN_OPENING: span
   from the plan, kind and heights from the list; an opening standing where the plan draws wall gives way). Measured
   before it was used: against the plan's gaps the metric list matched as many openings as the contour reading on every
   elevation tried, and more on some.
6. **GLAZED_WALL is consumed** by where it stands (reaching the floor: a glazed door; on a sill: a window).
7. **Bodies for any orthogonal outline** (`wingsOf`): where no small step reduces an outline to a rectangle or an L, it is
   read as up to four bodies, the largest rectangle first; what no body covers is named by area.
8. **Scale from the site plan's printed building dimensions** (`site-dimensions.ts`): one small typed read, used only as a
   pair that must agree over the outline's two extents.
9. **Ids follow the observation, not the re-application**; fate targets are checked against the delivered model.
10. **Objects drawn in the wall's tone are not partitions** (skeleton 1.1.0, `objectsAmong`): a shorter piece alongside
    a longer wall closer than a person passes (a cabinet), pieces closing a ring with no way in (a bed, a table), a group
    too small to hold anything, and a piece neither of whose ends touches a wall, the exterior or a door gap of its own
    line (a car's bumper) are dropped by name, with the "doors" read beside them. An open group of room size (a pantry's
    three walls) stays. Found on the overlays of the development houses, not on a count.
11. **Two bodies in line meet on the plan's wall** (massing 1.7.0): the elevations say that the top steps and only
    roughly where; a partition the plan draws across the body (over half its depth) within 1.25 m of that step is the
    wall the bodies meet at.
12. **The page's building height is a witness of the quarter turn** (ops 1.9.0): the labelled and the turned reading put
    the same drawn tops over different widths; where exactly one puts the top at the published height, it is taken — in
    BUILD_MASSING and in the orientation hypothesis every later consumer reads its sides through. A count of views that
    agree with each other does not outvote it (two views can agree on the wrong width).
13. **A picture that registers on neither body chooses none** (arbitration 1.2.0): it is set aside on both sides, named;
    the body that replaces LOCAL's must still be uncontradicted by everything else.
14. **A roof's lowest drawn edge is the wall's top, not the roof's** (massing 1.7.0), where no gable-end corner is agreed
    and not every wall top is drawn: taken as the roof's top surface at the wall, a steep roof stood in its own walls and
    every door under it went uncut. **A lower body's roof steeper than 60°** is the roof of the body behind it: it takes
    the first body's pitch from its own walls, unconfirmed.
15. **The typed FORM of the house is a witness of the body arbitration** (`form-read.ts`, one request with all captioned
    elevations: storeys, volumes under their own roofs, the main roof's kind and ridge direction, lower parts). Measured
    first, as an experiment, on the thirteen development houses: it named the main roof's kind and ridge direction as the
    drawings show them on every one, where the delivered models had flat-roofed boxes beside a gable on three and two
    steep gables for a low hip on a fourth. It is asked only where it can say what the other witnesses cannot — LOCAL's
    body is a pitched house with flat-roofed volumes beside it — and it only contradicts or supports a body; the body
    that replaces LOCAL's is still built by the same solver from the outline and the silhouettes, and no dimension is
    taken from the typed answer. Not taken (yet): the form as a PRIOR of the solver (hip against gable, two storeys):
    the measured next step.
16. **The outline stands on the walls' outer line where the printed dimensions say so** (skeleton 1.2.0,
    `outerFaceOutline`): a sheet that draws layered walls prints its overall dimensions on the thin outer line; a tracing
    follows the dark core on one side and the outer line on another. Where the plan's two printed overall dimensions
    disagree over the traced outline (more than the 3 % any pair is held to) and agree over the outline moved onto the
    outermost wall line, the moved outline is the body's and the pair its scale. The skeleton still reads along the
    traced outline — the walls' filled core. This is decision 2 (the body keeps the traced outline) with its exception
    stated by evidence, not a reversal of it.
17. **In-line bodies are read where the elevations draw the step and built on the plan's wall**: the taller roof's verge
    overhangs the lower body; read over its plan extent, the lower body took that roof for its own.
18. **A look that omits its verdicts on the applied corrections is asked for them once more** (the field is optional in
    the contract; two of thirteen live looks of one batch left a whole revision "not reviewed").

### Round R2 — after the first held-out measurement (NEW-E: 0 → 0)

19. **An elevation's building width is the walls' extent half-way up the storey** (`wallEndsPx`, massing 1.8.0, ops
    1.10.0): a stone plinth or a terrace wall drawn past the house is a wall polygon too, and the extent of all wall
    polygons gave a width half as large again (825 px for 548), a scale two thirds of the true one and "eaves at 1.59 m:
    not a storey". The row half-way between the ground and the roof's lowest edge crosses only what stands a storey
    high. Used by every registration by the plan — `registerByPlan`, `orientationOf` (which passed no roofs and so kept
    the old width: found on the replay, fixed), the sketch anchors and the overhang proposal. A row that crosses less
    than 40 % of the old extent is refused and the old extent stands.
20. **One oblique bay is squared, not refused** (`squareOblique`, plan-outline 1.5.0): an oblique edge is replaced by the
    corner OUTSIDE the outline (the bay's bounding step), bounded at 2 % of the bounding rectangle per edge and 5 % in
    total, recorded as `squared {edges, addedPx2}`. A house with a canted bay window was "beyond the supported form".
21. **An outline is partitioned exactly before the largest-rectangle fallback** (`partitionOf`): after the small steps
    the convention names are left out (partial simplification), the grid of the remaining corners is covered with at
    most four rectangles, nothing left over. A cover whose every rectangle is a body in its own right comes before one
    that is fewer or has a larger main: the largest rectangle sliced a house, its garage wing and its side wing across
    all three and left a 0.6 m strip. Not accepted when a rectangle is below the body thresholds — then `wingsOf` as before.
22. **Under a gable's eaves a wall ends at the roof's underside** (`cuttableTopM`, executor 1.10.0): a wall that follows
    the roof carries the ridge's height, so `hostWall` accepted a window whose head stood 10 cm above the real wall and
    the compiler left it uncut — the whole opening was rolled back (three front windows of a bungalow). The head is cut
    to the underside when it overshoots by at most a quarter of the opening's height (`HEAD_CUT_MAX_SHARE`, unchanged),
    for windows as for doors, and named in the record (`headCut`).
23. **A printed dimension is held against the traced outline where the body leaves out only convention steps**
    (arbitration 1.3.0): the body is shorter by the named steps, not at another scale. Applies only while the body's
    bounding rectangle keeps all but `OUTLINE_SIMPLIFICATION.totalShare` of the traced outline's — a body that dropped
    a wing is still contradicted. Recorded as `outlineM` beside `modelM`.

## Considered and not taken

- **An API read of the interior walls** (segments in pixels). Not needed where the sheet fills its walls: the
  deterministic reader places them on the ink, at no cost, and a model's pixel coordinates would then need the same ink to
  be trusted. Kept as the fallback for sheets whose walls are not filled (named WALL_STYLE today, nothing built).
- **Rebuilding the body on the wall bands** — see 2.
- **Accepting a scale from one site dimension plus the footprint area** when they disagree by 3.3 % (one new house): the
  agreement bound is 3 % for every pair; it was not moved for a house.
- **One wall ring on the true outline under a roof over the simplified body** (notches and recesses as real walls): the
  right next step for the exterior; it touches every consumer that assumes four-walled bodies and was not started in a
  round that had the interior to deliver.

## Consequences

A body built from the sources is no longer empty, and replacing LOCAL's body no longer costs the interior. The interior is
as good as the sheet's wall fill is readable; furniture drawn in the wall's tone is dropped where its shape gives it away (10), and can still read as a short wall where it does not (a car's rear line that ends at a door-wide gap from the garage wall). Multi-body
source models still have a party wall where their bodies meet, whether or not the plan draws one.
