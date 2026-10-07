# 005L council — resolution of every finding

Five reviewers attacked the storey-registration code at `4ad69fe`. Their reports are next to this file:
- A, topology: `A-topology.md`.
- B, emitted geometry: `B-emitted-geometry.md`.
- C, non-circularity: `C-non-circularity.md`.
- D, generalization: `D-generalization.md`.
- E, regression: `E-regression.md`.

Each finding is resolved one of four ways:
- **FIXED**: production code changed generically, with a test that fails without the change.
- **RECORDED**: the behaviour is kept but now visible on the registration record, as a gap or a conflict.
- **DOCUMENTED**: a stated limit in `architecture.md`, with no behaviour change.
- **ACCEPTED**: the reviewer's own conclusion was that it is correct or pre-existing.

No fix reads a published figure, a house name or an expected answer. Every new rule is phrased in pixels of the plans
themselves. The tests named below are in the following files:
- `packages/reconstruction/test/storey-council.test.ts`: 16 layout fixtures, labelled by finding id.
- `packages/reconstruction/test/storey-council-emission.test.ts`: 5 end-to-end PNG→model fixtures.
- `tests/architecture/storey-support.test.ts`: the static and executed non-circularity gates.

Mutations M1–M10 (`../mutation-results.md`) show the gates catch the regressions they name.

## P0 — all resolved before the freeze

| id | disposition | what changed | test |
|---|---|---|---|
| A5L-1 | FIXED + RECORDED | A printed scale on both plans is now a hypothesis of its own. A fit at another scale (beyond `WALL_PAIR_SCALE_AGREEMENT`) wins only when the printed-scale placement shares less than half the walls, or its largest body leaves the building below. The outcome is on the record either way (`printedScale: HELD / REFUTED`, `scaleBasis`). | A5L-1 ×2 |
| B5L-1 / E5L-1 | FIXED | Upper bodies extend an unshared side where both perpendicular facade storey walls run past it (`reached`). Chain lines that cut a region short of its gables no longer move the gable walls. Marcówki's model is byte-identical to the 005K pin `6152770f`. | B5L-1; CI row `marcowki` |
| B5L-2 | FIXED | v2 takes each plan's storey index from the layout's own ranks (`draft.storeys`), not a role table. UPPER + ATTIC builds storey 1 from the upper plan and storey 2 from the attic plan. | emission B5L-2 (three plans) |
| B5L-3 | FIXED | Pieces merge only when the parts between them are seams (`onlySeams`), never by an area budget. An L-shaped storey is no longer merged into the body rectangle. | storey-support fixtures; emission B5L-5 (L) |
| D5L-1 | RECORDED + DOCUMENTED | Every registration names its scale basis (`STATED / PRINTED_SCALE / FITTED / WALL_PAIRS / SAME_PIXEL_SCALE`) and whether anything else corroborates it. A chain-less upper plan registered only on the same-pixel-scale hypothesis says so (`scaleBasis.corroborated: false`). This is a property of the one supported publisher's exports (architecture.md §3), stated there and not generalized. | storey-registration.json |
| D5L-2 | FIXED | The overhang class is computed by erosion, not by area: WITHIN_TOLERANCE only when the region shrunk by one band all round is fully carried. A cantilever of 1.2–3 m is named BEYOND whichever side it is on. | A5L-3 |

## P1

| id | disposition | what changed | test |
|---|---|---|---|
| A5L-2 / D5L-3 | FIXED | The snap band is half a base wall of jitter plus the upper wall placed, and it is strict. A 1.0 m set-back all round is kept. | A5L-2 |
| A5L-3 | FIXED | Same change as D5L-2 (erosion). | A5L-3 |
| A5L-4 | FIXED | `groundStoreyOf` prefers the storey of index ≥ 0. A partial basement keeps its own footprint and slab, and the gate, frame and datum stay on the ground floor. | A5L-4; emission B5L-6 ×2 |
| A5L-5 | FIXED | The lower guard applies only when the ground plan sits below an upper base. A basement larger than the ground is built under the house and its excess is named. | A5L-5 |
| A5L-6 | FIXED | Contiguity: a body reaches storey k only through k±1. An unresolved storey is not bridged by a higher one; the cut is a named AMBIGUOUS gap. | A5L-6 |
| A5L-7 / D5L-7 | FIXED | A tie is any margin at or below the score's own resolution: one pixel per wall end, from both plans' bands and the envelope (`resolution` on the record). It is no longer `1e-6`. A near tie (< `STOREY_RIVAL_WINDOW`) is a conflict unless the rival only adds bodies; the bodies only the chosen placement stands on are disputed and not stacked. | A5L-7 ×3 |
| A5L-8 / D5L-5 | FIXED (thin parapet) | A walled upper body needs walls of at least `STOREY_WALL_SHARE` (0.75) of the plan's wall thickness on its perimeter. A half-wall parapet is no storey. **Residual:** a parapet drawn collinear with a full wall merges into that wall's band. | A5L-8 |
| B5L-4 / E5L-4 | FIXED | An attached body's roof stands on the body's rectangle at its top storey (`rectAt(top)`), not on the whole body. | emission fixtures; dev matrix |
| B5L-5 | FIXED + RECORDED | Extra pieces get no slab of their own. Pieces that meet (an L, a T) are not built as two rectangles with a wall between them: the largest is built and the meeting piece is a named AMBIGUOUS gap. A set-back side takes the outer face of the wall drawn there. Where a plan's registration states its scale, an outer-face correction of its frame is accepted only within 3 % of it. **Residual:** an L-shaped storey is emitted as its largest rectangle. | emission B5L-5 ×2 |
| B5L-6 | FIXED | The lowest storey's slab is its own footprint. Levels stand on `datumOf(index)` from the ground datum over every mass's storeys. The storey a body was measured on is skipped by its own id, not by `fromIndex`. | emission B5L-6 ×2 |
| C5L-1 | FIXED | `inferStructuralLayout` reads its options only through `layoutOptionsOnly` (an explicit key list). A Proxy test proves no other key is read. `structural.ts`'s published-figure uses are pinned to exactly three lines. The v2 `storeyRects` block has a vocabulary gate. Mutations M8 (layout), M9 (structural.ts) and M10 (v2) are the three choosers C5L-1 named; each is killed. | architecture gate; M4, M8–M10 |
| D5L-4 | FIXED | A set-back with nothing stating its side is AMBIGUOUS in both orientations; it is never the first placement found. | D5L-4 ×2 (plain, mirrored) |
| D5L-6 | FIXED | Same change as A5L-9 (below). | A5L-9 |
| D5L-8 | DOCUMENTED + MEASURED | Two knobs no longer decide: `SAME_SUPPORT_IOU` is removed (support is compared side by side), and `STOREY_TIE` is only a 1e-6 floor under the tie the pixels give. The remaining four 005L knobs are swept ±25 % on the synthetic corpus in `../mutation-results.md` §2, and the development-row margins are in `../storey-registration.json`. A knob the corpus does not pin is named there, not tuned. | knob sweep |
| E5L-2 | RECORDED (kept) | Marcówki's rival at 0.039 stands the attic on house + garage at scale 1.106. That is a real alternative reading of the walls within the window, so the conflict stays and the gate is PARTIAL. The model is unchanged (pin `6152770f`) and the CI row still passes. | CI row `marcowki` |
| E5L-3 | FIXED | willa-miranda's printed scale (1.288 on both plans) now holds (A5L-1 rule). Its model is identical to the 005K baseline again. | dev matrix |

## P2

| id | disposition | note |
|---|---|---|
| A5L-9 | FIXED | A frame drawn beside an upper plan that prints no scale lifts no body (fixture A5L-9). |
| A5L-10 | FIXED | Wording now separates "the same bodies over different footprints" from "different bodies". The A5L-7 fixtures are a true two-body tie at 0 and ±1 px. |
| A5L-11 / D5L-10 | RECORDED | A reading held against a fit (both plans' chains, or the scale both print) now records `held` on the registration: what held it, the fit it was held against (scale, offsets, score, bodies) and whether that fit stands the storey elsewhere. Elsewhere means a side moves by more than one band. The record is in the Evidence Pack storey digest. It is **not** a gate conflict, though the first council fix made it one. That fix turned the §25 fixture C (REDMIRE, a correctly stated set-back) PARTIAL. REDMIRE's walls prefer the storey shifted flush by its 2.2 m set-back, by 0.155, because the loggia shortens the ground front wall. This is the same evidence as A5L-11's misread chain zero: walls plus statement cannot tell the two apart. **Open:** `whole()` still accepts equal spans without tick correspondence, which is what would separate them. |
| A5L-12 | FIXED / DOCUMENTED | Basement fixtures now exist (A5L-4, A5L-5, emission B5L-6), and so does a lower-exceeds test. The real search bound is stated in architecture.md §7. The small upper storeys on the development rows are explained in the stage report. |
| B5L-7 | FIXED | Interior topology hosts use `rectAt`. This removed tunbergiach's WALLS_OVERLAP. |
| B5L-8 | DOCUMENTED (open) | The gable soffit is still computed from the storey rectangle, so it is too low near an inset eave side. This is outside 005L's storey-support scope and named as a residual. |
| B5L-9 | PARTLY | The plan-frame `covers` question is guarded by the 3 % scale agreement. **Open:** whether the main roof stands over the body or over the top storey plus a terrace. Near-tie storeys keep SOURCE_DERIVED rings; the conflict lives on the gate, not on each ring. |
| B5L-10 | ACCEPTED (pre-existing) | D00's levels `[0, 13.04]` and the one-floor-section storey height (`CONVENTIONS.storeyHeight`) predate 005L. D00 stays ALGORITHMIC_FAIL in the matrix. |
| B5L-11 | FIXED | Five emission fixtures cover an inset storey, an L, UPPER + ATTIC, a partial basement and a basement under the garage only. The matrix records each level's rings and whether it copies the ground. |
| C5L-2 | FIXED | Frozen literals now cover `minBodySpanM`, `upperBodiesOf`, `storeySupportOf`, `onlySeams`, `sameSupport`, `wallsBeyond`, `layoutOptionsOnly` and `STOREY_WALL_SHARE`. |
| C5L-3 | FIXED | The house-name gate covers every development and fresh row of `rows.json`. |
| C5L-4 / E5L-8 | FIXED (partly) | `upperStoreysHoldTheirRooms` now counts upper levels as v2 index > 0, so a basement no longer makes the ground "upper". The calibration is in `../development-matrix.json`. **Open:** it still sums levels, and compares gross ring area with net rooms at 0.9. |
| C5L-5 | FIXED | The round-9 stratified reader fetches with `redirect: 'manual'` and throws on any non-200 status, so a transient page cannot burn a candidate. |
| C5L-6 | FIXED | The research picture guards compare resolved paths. |
| C5L-7 | DOCUMENTED | architecture.md §6 explains that the inherited 005A footprint veto can refuse a base reading, and every upper storey is then re-derived from the reading chosen next. The storey code never reads the figure. |
| D5L-9 | DOCUMENTED | Assumption: every storey sheet has the ground plan's orientation, with no rotation or mirror hypothesis (architecture.md). |
| D5L-11 | DOCUMENTED | The real bound is stated: up to (6·6)² wall pairs per axis, and targets = BUILT regions + 2. The worst case D measured is 5361 candidates, about 0.3 s. There is no hard cap. |
| D5L-12 | DOCUMENTED | A ROOF-labelled floor plan would be read as a storey. This is latent, because no adapter emits it. |
| D5L-13 | ACCEPTED | Outline-only or hatched walls give NOT_REGISTERED with a typed gap: a refusal, as D concluded. |
| E5L-5 | FIXED | `LAYOUT_INFERENCE_VERSION` is in the run's `ANALYZER_VERSIONS`. |
| E5L-6 | FIXED | Evidence Pack 1.3.0 adds `14b-storey-support.json` and STOREY_SUPPORT timeline events. |
| E5L-7 | FIXED | The development matrix is rerun once, at the freeze candidate, under one commit. |

## Found while closing the council (full-suite regressions of the first fix commit)

| what | cause | fix |
|---|---|---|
| §25 fixture C (REDMIRE) gate ACCEPTED → PARTIAL | the A5L-11 conflict, above | recorded, not a conflict |
| §25 v2 fixture 5 (Elmbridge) lost its ground-floor door, and side walls read as glazing | The base was the upper plan, and the ground plan was registered by a FITTED stretch (k 1.055) over the placement where both plans' walls coincide (k 1). The stretch won because `matchedLength` counted a landed wall out to the base band's ends **plus the tolerance**: a plan stretched past the walls below gained up to two tolerances per wall, and `shares` reached 1.022. The B5L-5 plan-frame rule then preferred that registration to the outer faces, which agreed with the body to 0.2 %. | `matchedLength` counts only what lies on the base band itself (the tolerance picks the band, not its length), so `shares` is a true Dice ≤ 1. The plan-frame rule lets the registration overrule the outer faces only when its scale is stated (STATED or PRINTED_SCALE). A wall fit states nothing the faces must yield to. |
