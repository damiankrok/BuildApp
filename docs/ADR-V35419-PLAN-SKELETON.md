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
