# ADR v3.54.21 — one roof geometry, the description read from the originals, and every omission by cause

Status: accepted for v3.54.21. Extends `ADR-V35420-STRUCTURE-CONTRACT.md` (decisions 1, 3, 5 and 8 are widened, none is
withdrawn). Code: `packages/reconstruction/src/v2/roof-system.ts`, `packages/analysis-service/src/consult/{form-read,
structure,feature-map,readback,consult-analysis}.ts`, `massing/{massing,ops}.ts`, `correct/execute.ts`.
Protocol and scope written before tuning: `research/source-to-model/v35421/PROTOCOL.md`.

## Context

The Council audit of v3.54.20 showed that the consult path built every roof alone: two bodies whose roofs meet got two
independent `createRoof` solids pushed through each other (Amber, Mindelo — no valley), an axis turned after the heights
were agreed produced a 72° roof (Eliza), the main roof's description was bound to the largest rectangle against that
rectangle's own four views (Amarylis), a cross gable with no step of the outline had no consumer, and LOCAL's valley
geometry (`attachedGableLayout`, `valleyCutMainRoof`) was not reachable from a body built from a read. The structure read
was asked only after two sketches succeeded and was shown the elevations a sketch had been made of; perspectives were not
sent; a read property that nothing consumed left no trace. The readback measured four categorical facts of the largest
rectangle.

## Decisions

1. **Roofs are REGIONS solved together (`solveRoofSystem`, roof-system 1.0.0).** A region has its own identity
   (`roof-<body>`, `roof-<body>-cross-<side>`), host body, rectangle, kind (GABLE / HIP), ridge direction, eaves, ridge
   height and — for a hip — its run. A region is not a wall rectangle: a cross gable is a second region `over` another on
   the same walls. One region's surface is the lower envelope of its planes; the house's roof is the upper envelope of the
   regions. A region whose ridge ends on another's side and does not stand above its ridge runs on over that slope to
   where the two surfaces meet: the valleys are the computed intersection lines, both planes at one height along them. A
   lower roof meeting a wall (ABUTMENT), roofs in line (a gable wall between them), roofs the source shows apart (SEPARATE)
   and a roof wider than the side it stands against are **not** joined. The solver returns planes cut to what is seen,
   creases (RIDGE / HIP / VALLEY), free edges (EAVE / VERGE / ABUTMENT / BOUNDARY), relations with their reasons,
   adjustments made within stated tolerances (an eave snapped by ≤ 0.25 m is named) and violations (a pitch outside
   8–62° is a violation with its inputs, never clamped). No condition names a house, a URL, a hash or a dimension.
2. **One geometry for LOCAL and for a body built from a read.** The solver lives in `@buildapp/reconstruction` beside
   `attachedGableLayout` / `valleyCutMainRoof`; a test holds it equal to them on every case they accept, and it also solves
   the cases the cutter refuses (a valley starting above the eave, a wing with lower or higher eaves, a hip main roof,
   several wings, a ridge on the ridge). The body builder states the joined regions through the kernel's existing
   statements — `createRoofPlane`, `connectRoofPlanes` (with the segment), `createRoofEdge`, wall
   `topProfile: FOLLOW_ROOF_PLANES`, one `ROOF` assembly — the same ones LOCAL's solver emits. A single body, or bodies
   whose roofs do not meet, are built with exactly the commands of v3.54.20 (a test holds this byte for byte).
3. **A description is bound to the body its own views draw, and executed whole or not at all.** The main roof's
   description goes to the largest rectangle only while that rectangle's own elevations do not draw another reported
   part's ridge on two more views than the main one's (`BIND_BY_VIEWS`); then the part is that body's description and the
   main roof's is of the bodies beside it. Each body records which description it carries (`BodySpec.describes`). The
   arbitration and the readback hold the main roof's description against **that** body (`mainBodyOf`), not against the
   largest rectangle. Where a reported cross wing cannot be built, the main ridge is not turned for it either (a
   half-executed description is another house); the part is `UNRESOLVED` with its reason.
4. **Pitch, eaves and ridge are agreed again after the LAST change (`settleRoof`).** Whatever turned an axis or changed a
   kind, the roof's numbers are derived again from this body's own span: a stated pitch is binding only for the body the
   description is of (or one that carries the house's top); a ridge is derived from held eaves or eaves from a witnessed
   top; a stated number that disagrees with a drawn one is `RETAINED_WITH_CONFLICT`, never silently replaced; a roof no
   witness can settle is left as read and named `UNRESOLVED`.
5. **Every read property has a fate.** `APPLIED` (with the built value and residual) / `RETAINED_WITH_CONFLICT` /
   `REJECTED` (with the reason) / `UNUSED_UNSUPPORTED` (no function consumes it) / `UNRESOLVED`. Fates travel with the
   body (`BodySpec.fates`), are recorded in `ROOF_SYSTEM`, and joins are held against the solved relations.
6. **The structure read is asked of the publisher's ORIGINALS (`form-read/3`, structure 2.0.0).** It no longer waits for
   two sketches. The pictures are chosen from the package: one elevation per captioned side (the largest; sketched frames
   first, in their order), up to four uncaptioned ones, the section, the ground plan, and up to three perspectives
   (qualitative: "a rendering, NOT to scale"). Thumbnails and byte-duplicates are left out with the reason recorded.
   What was sent is recorded (role, source px, sent px, factor, hash) and the run keeps the exact PNG packet. Above the
   provider's size the picture is resampled by AREA to fit (every source pixel weighs in) — the earlier whole-factor
   decimation sent a 1480 px elevation at 740 px. The contract adds `roofs` (regions R1… with of MAIN / PART / CROSS,
   their own pitch / eaves / ridge with status, where seen, shares along that side, what they meet and how: VALLEY /
   ABUTS_WALL / SAME_PLANE / APART), `covered` for things that are not volumes, and the corner each perspective looks at.
   The prompt keeps its first 40 characters, so recorded `form-read/2` answers replay unchanged (`roofs` optional).
7. **A feature map is fixed from the sources before any model is judged, and traced to the delivered model
   (`feature-map.ts` 1.0.0).** Each feature (storeys, main roof kind / ridge / numbers, every part and roof region, joins,
   cross gables, non-volumes, entrance, garage door, counts) carries its evidence, weight (KEY / MAJOR / MINOR) and what
   was agreed. After the build each is `BUILT_AS_STATED / BUILT_DIFFERENT / NOT_BUILT / NOT_CHECKED` with a cause:
   `NO_READ`, `DISPUTED_BY_WITNESS`, `LOST_IN_BINDING`, `NO_CONSUMER`, `CONFLICT_WITH_DRAWING`, `BUILD_ERROR`,
   `NO_EVIDENCE`, `NOT_ASKED`. The reviewer receives the map and the perspectives with the model's views; an open KEY
   feature excludes `SOURCE_VERIFIED_IN_SCOPE`.
8. **Readback 1.1.0 measures every bound roof and every number.** Kind and ridge from the planes' own falls, pitch,
   eaves, wall top and ridge from their geometry; each bound roof against what the builder took; each relation against
   the model's edges (a valley = two VALLEY edges between the two roofs; an abutment = none); the main roof's numbers
   with tolerances (3°, max(0.35 m; 8 %)). The audit's probe (1° / 100 m / 200 m) no longer passes.
9. **A correction of one roof of a system solves the system again (ops 1.13.0).** `SET_ROOF` on a roof that is a region of
   the roof system measures the proposal as for any roof (registration, source gate), recovers the regions from the
   model's own planes, **proves** the recovery by solving them again (every plane must be the model's), replaces the one
   region, solves, and states the system anew in one transaction; partitions that followed old planes follow the new
   ones. It is refused by name where the solver reports a violation, where the roofs that meet would change
   (`ROOF_SYSTEM_MEMBERSHIP_CHANGES`), where a cross gable or separated roofs make the regions unrecoverable, or where
   roof windows already stand on the planes. Roof windows are hosted on roof planes as on parametric roofs.
10. **The page's building height is a witness in every correction round.** A proposed ridge above it (beyond
    max(0.6 m; 10 %)) that is further from it than the roof it would replace is refused (`ABOVE_PUBLISHED_HEIGHT`): the
    source gate sees one picture and cannot see a wrong scale (a roof the builder had agreed at the printed ridge was
    replaced by one 1.8 m above the stated height).
11. **A body that does not replace LOCAL's stays on the record** (`massing-rejected.json` with its hypothesis, fates and
    model): the refusal is reproducible, and the omission trace names it.

## Addendum after the fresh trial NEW-H (post-trial, DEV from here; code `5d5ea2c`)

The first trial results stay as they came out and were graded blind before any of this. Each change is a general rule
with a test; the houses where the defect was found are DEV from then on.

12. **A weak side label is a hypothesis, not a caption.** Two elevations with an identical caption get WEST/EAST from
    LOCAL only as a guess; a `form-read/3` read (originals and perspectives) that sets each such picture on a side of its
    own decides it, and that one side map then serves openings, chimneys, finishes and roofs alike (no mirrored
    assignment downstream). A weak label still in force keeps its side: no other uncaptioned picture is read onto it.
    A `form-read/2` answer (sketch-era) does not override a weak label — on the recorded Mindelo it set the sides the
    wrong way round.
13. **A measured opening is held against `WRONG_KIND`.** An opening whose built box the source gate measured is not
    removed on a look's word that it is the wrong kind (a garage door judged by its colour); the dispute stays open.
    A roof window is held only against `SHOULD_NOT_EXIST`.
14. **The main body is never left an open box.** A main body with no evidence of a pitched roof (no stated pitch, no
    ridge level, a stated FLAT kind) gets the attached bodies' flat plate: at the slab and parapet the section reads where
    it reads them, otherwise at the wall head as `ASSUMED_FOR_RENDERING`; the pocket walls under it are capped. The
    decision is taken before chimneys and facade bands.
15. **A printed roof angle below 3° on the roof's own line is a flat roof's fall**, not a pitch. The specification reader
    anchors the roof line (not another body's roof, not the covering, not roof windows; a flat TILE is no flat roof),
    reads inflected Polish forms on that line only, and leaves a fall beside a stated pitched kind unread.

16. **A refusal by the books is one request's BUDGET answer, never the job's failure** (found on the host: a structure
    read refused at the host's ceiling failed the whole job as INTERNAL_ERROR). Every reading step takes its reservation
    inside its own `try` (`reserveOrUnavailable`): nothing sent, nothing settled, the step answers BUDGET and the analysis
    goes on without that read; the refusal is written to the exchange log (`RESERVATION_REFUSED`).

Named after the post-trial review, not changed: side decision at registration still takes the `form-read/2` side for a
weak label; the read receives LOCAL's label as the caption of an uncaptioned elevation; a held element with no defect id
leaves no open registry entry; pocket walls of ATTACHED bodies under a plate; the compiler's wall-top band where a plane
vertex falls inside a wall section; a source body does not carry LOCAL's interior (Anna II: 26 → 17 interior walls).

## Not done (named, not guessed)

Eaves overhangs on a joined system; cheeks where a wing's eave stands above the slope (reported as `cheekM`); flat roofs
inside a system; non-rectangular roof regions, mansards, mono-pitch roofs, dormers as regions; a two-storey core with a
one-storey skirt found from the upper floor's outline; porches, recesses, terraces, bays, balconies and canopies as
elements (`NO_CONSUMER`); a body entering or leaving the roof system through a correction; a cross gable changed by a
correction. LOCAL's own emission is unchanged (the solver is available to it; migrating v2's emit is a later step that
must be measured on LOCAL's own benchmarks).

## Consequences

Where two reported roofs meet, the model holds named planes and edges instead of interpenetrating solids; `roofs` may be
empty for such a house (consumers that looked only at `roofs` look at `roofPlanes` too: arbitration, readback, executor,
viewers through the compiler). Stable ids: `roof-<body>-<side it drains to>[-<piece>]`, `roofsys-main`, edge ids from the
planes they join. A model built before this stage is read unchanged.
