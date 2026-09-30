# 005C pre-implementation synthesis — the implementation contract

This contract comes from four independent, read-only reviews run on the frozen 005B code (`d3235bf`). Each reviewer
was given only its own question:

- `boundary-geometry-review.md` (A)
- `opening-semantics-review.md` (B)
- `attached-bodies-review.md` (C)
- `source-generality-review.md` (D)

The reviewers measured on the development houses' own bytes. No drawing is committed. Where two reviewers disagree,
the decision and its reason are stated below.

## 1. What the four reviews agree on

1. **One first bad decision on all three failing houses.**
   - `walledEnvelope` takes the envelope as the box of the axes of bands at least 2.5 walls long.
   - The flood then seeds every cell outside that rectangle as outside.
   - A side made of piers and glazing has no long band, so the rectangle stops inside the building (modrzykach:
     2.02 m of 11.60 m). A wing beside it is ground by construction (zurawkach, willa-miranda).
2. **The root is below the envelope: piers and corner blocks are not bands.**
   - The band reader keeps runs at least 1.6 walls long, with an across-run of 0.45–1.9 walls, and drops junction
     pixels.
   - Every garage-door jamb on the three houses is missing from the band set, and so is the whole of modrzykach's
     front.
   - The same blindness breaks `closureOf`'s jamb rule, `alongWallPieces`, `sideWallReach` and `baysOf` (A, B, C).
   - A mask-level scan (wall-thick ink along the line) recovers every pier. On 39 of 39 real openings on five houses,
     its gap width is within 0.04 m of the printed callout (B).
3. **The long-band box is also the only guard against line-closed exterior.**
   - Of 2261 grid edges, 1011 are shut only by the thin-line term.
   - Removing the box with nothing else changed builds modrzykach's terrace and entrance zone, and zurawkach's porch
     (B).
   - **So the new boundary is built from wall-thick ink and classified gaps, never from line work** (A, B).
4. **The new boundary must not replace the old envelope wholesale.**
   - Replacing it moves 4 of the 5 development houses that complete today.
   - Keeping the old envelope (A) byte for byte, and accepting only boundary components that continue A's interior
     across an unsupported stretch of A's own edge, accepted **0** extensions on Marcówki, Kosaćce, G2E, e-OZE and
     dom-w-jablonkach under every jamb policy tested. It fixed zurawkach (100.8 m² against 101.7) and willa-miranda
     (167.2 m² against 169.9, once its extent is fixed) (A).
5. **Posts are told from jambs by connectivity, not by thickness or darkness.**
   - A post is an isolated block of wall-thick ink about 1.5 walls square.
   - A garage jamb is part of a wall 2.8–11.4 walls long (B).
   - willa-miranda's porch post sits 3.5 px off the garage-front line. Any "repeated collinear support" rule without
     this test encloses the porch (B, A).
6. **The existing `infill` does not discriminate.**
   - It scores about 1.0 on glazing, a floor edge, a dashed canopy line, paving and the watermark alike.
   - A signature does discriminate: count the continuous thin lines inside the wall's thickness, where they sit, and
     whether they run on past the jambs (B, A).
7. **Callouts corroborate; they are never required.**
   - No failing garage-door callout was read (`260/229`, `500/225`, `500/238`).
   - Read-and-agreeing rates run from 1/11 to 6/6 (B, C).
8. **Bays.** `baysOf` misses each projecting body for three independent reasons (C):
   - it requires a start at the edge, and a flush side wall runs through it;
   - it measures reach to the band end against a threshold that works out at 84 px (1.86 m) on zurawkach, not 1.5 m;
   - it requires an existing grid line at the mouth.

   The discriminating relation is the **junction**: the wall share of the main boundary between the body's side walls.
   It is 6–16 % on the three failing wings, 85 % on G2E's garage and 100 % on a terrace. Taking the far face from the
   longer side wall loses G2E's garage (−12 cells), measured (C).
9. **Source.** Every Aster defect is generic (D). Each is a structural or vocabulary rule. The prototype:
   - read all 11 figures;
   - read ARCHON's own differently-classed markup (8/8 building heights);
   - left alt-marcowki's package byte-identical;
   - passed 160/160 source-package tests.
10. **Aster reconstruction ends in a typed, source-limited stop (D).**
    - The floor plan prints no dimension. The site plan and the 1:500 outline both state the eaves outline.
    - No wall dimension or overhang is published.
    - A cross-view scale from the roof outline would carry a 6–9 % error, inside the gate's tolerance, so it is not
      honest.

## 2. Decisions

### 2.1 The boundary evidence (new module `boundary-evidence.ts`)

- **Wall-solid layer.**
  - Open the ink mask by `r = round(0.3 × the sheet's wall)`, the operation `wallClusterExtent` already uses. Use the
    sheet's wall, not the decomposition's re-measured one, so erosion does not shrink `r` (A).
  - Label its components. A component whose bounding box is at most 2.5 walls on **both** sides is a **POST**; any
    other is **WALL** (B).
- **Facade line scan.** Along a grid line:
  - a position is *solid* when a wall-thick window within one wall of the line is at least 80 % ink on the raw mask
    (B);
  - solid runs of at least half a wall are *pieces*;
  - each piece takes the kind of its component in the wall-solid layer;
  - breaks of at most half a wall inside solid ink are **drawing breaks** and are merged.
- **Gap signature.** Inside the wall's own thickness (±0.75 wall of the fitted axis) (B):
  - distinct thin lines covering at least 70 % of the gap;
  - each line's offset;
  - continuity: at most 2 runs, otherwise it is dashed;
  - whether the line runs on past both jambs, which makes it paving or a kerb, not infill.
- **Gap classes and boundary strength** (B §3.2, adopted with one change):

  | class | evidence | boundary | occupancy |
  | --- | --- | --- | --- |
  | `DRAWING_BREAK_SUPPORTED` | ≤ 0.5 wall inside solid ink | STRONG | wall |
  | `OPENING_SUPPORTED` | both jambs WALL, width ≤ 8 m, and one of: glazing (2+ continuous lines); a single continuous line (a leaf; above 3.2 m only at a face, i.e. a vehicle door); a callout agreeing within max(10 cm, 3 %). **Or** a glazing signature whose lines end at the jambs, where one jamb may be a POST (a pier between two windows) | STRONG | opening |
  | `UNKNOWN_GAP` | both jambs WALL, width ≤ 3.2 m, nothing drawn | WEAK: bridged only **by exclusion** — when leaving it open lets the outside into more than a pocket, `max(6 m², 2.5 w²)`, the existing pocket rule; a recess mouth stays open | opening if bridged |
  | `TRUE_EXTERIOR_GAP` | a POST jamb with no glazing; no jamb (the wall ends); blank and wider than 3.2 m; wider than 8 m; the only line is dashed, past the jambs, or outside the thickness | NONE | exterior |

  **The change from B.** B makes a blank ≤ 3.2 m gap WEAK and bridgeable only on a ticked line. We bridge it by the
  pocket rule the flood already uses for wide gaps: it is the same question ("what lies behind it?"). It needs no
  chain tick, which is often unread.

### 2.2 The envelope

- **Candidate B (the generator).**
  - Flood the grid's dual from the grid border.
  - An edge stops the flood only when solid pieces and STRONG or accepted-WEAK bridges cover it entirely, after drawing
    breaks are merged. **Line work never stops it.**
  - The unreached cells are the envelope.
  - The grid is the plan's own. A *shadow* grid adds lines at exterior-chain ticks, read or **unread**, with no grid
    line within half a wall (A P1-4; willa-miranda). It is used only for B.
- **Candidate A (the incumbent) stays byte for byte** on every frame where B accepts nothing.
- **Acceptance (A §3.4).**
  - Take the components of B minus (A's rectangle ∪ shut bays).
  - A component is accepted when it continues A's interior across an edge of A that is not closed in the boundary sense.
  - It must lie inside the extent.
  - Every edge of its own boundary must be supported.
- **When something is accepted:**
  - The frame's outline is **B**. A's rectangle is shown to be inconsistent, and keeping it would keep the line-closed
    exterior it holds (modrzykach: 24 of today's 26 built m² are a terrace and a bike shelter).
  - The envelope becomes a cell set with its bounding box. `envelope.rect` changes only on such frames: it is the world
    origin (A P1-8).
  - The boundary's openings are injected into the edge closures as evidenced intervals (opening, never wall).
  - The solid share of a boundary edge counts as wall, so the pier-and-glass bodies survive the 35 % band-wall gates
    (A P1-6).
  - RECESS is tested against the envelope's bounding box.
- **Candidates C and D** (the wall-ink cluster and the printed extent) bound B; they never generate it. The printed
  extent is not a boundary: Marcówki's is 1 m wider than its walls (A).
- **Bounds.**
  - 1 B flood per jamb policy, at most 2 policies.
  - At most 48 WEAK gaps tested by exclusion per frame, and at most 16 extension components.
  - At most 256 classified gaps per frame.
  - Scans are linear in the line length.
- **`BOUNDARY_RESOLUTION_INCONCLUSIVE`** is a typed stop when the strict policy (STRONG only) and the policy that also
  bridges WEAK gaps by exclusion both accept an outline, differ by more than the AGREES band (6 %), and the first
  reading fails. It names the candidates, their support profile and the differing region. The published figure never
  chooses between them.

### 2.3 Attached bodies (C)

- Every extension component, accepted or not, is classified relative to A. The classification uses:
  - its junction (the wall share of the shared edge);
  - its side walls (WALL pieces on the lines bounding it);
  - its mouth (the gap classes on its far side).
- The classes are PROJECTING_WING, FLUSH_ATTACHED, OPEN_MOUTH_GARAGE, COVERED_TERRACE, SEPARATE_BODY and UNKNOWN.
  They are reported in the digest.
- **OPEN_MOUTH_GARAGE** (two WALL side walls, WALL corner piers, a blank vehicle-width mouth) stays outside in the first
  reading. It is recorded as a bay whose mouth is OPEN_SIDE, so the resolver's SHUT reading exists for it.
- **COVERED_TERRACE** never builds.
- **The bay thresholds no longer gate a wing.**
  - Start-at-edge, reach to the band end and an existing mouth line are gone from the new path. A wing is accepted by
    its enclosure and its relations, whatever its reach.
  - `baysOf` stays in A so G2E's bay is byte-identical (`[178,479.5..427,702]`).
  - `baysOf` gains one relational guard, the pair width at most 0.8 of the side. It removes modrzykach's 97.6 %
    "bay", which spends two resolver readings (C F4).
- **`sideWallReach`** returns the front's outer face, `farEnd + wall`, not its axis (A P1-1). Only dom-w-jablonkach
  fires this path. It is the whole −5.25 % there.

### 2.4 The extent (willa-miranda)

- The wall witness is fragmented by openings on every house (A P1-3), and on willa-miranda that lets an interior
  chain frame the depth.
- **Change:** the witness's groups are joined across a collinear gap the gap reader classifies `OPENING_SUPPORTED`,
  with both jambs WALL (B §3.6).
- A planter or a post cannot join: it has no glazing and no leaf between WALL jambs.
- The legacy frame still stands byte for byte unless a chain that framed it is refused. This is to be measured on
  every pinned house.

### 2.5 Source (D, adopted: F1–F5, F9, F10; not F11)

- **Block label/value reader.** A short fact-vocabulary label and the first number-and-unit block after it. It skips
  tooltip prose, stops at any other short block, and excludes tables, ARIA grids and related-project cards. Two
  different block readings of one key leave the key out.
- **Units and new keys.**
  - `<sup>2</sup>` becomes `²`. This fixes a latent P0: an area in a plain table was read as unit `m`, and the gate
    ignored it.
  - New keys: `sloped_roof_area`, `flat_roof_area`, `room_count`, `bathroom_count`, and plot dimensions printed one per
    line.
  - A value must be number-shaped.
- **Technical documents.** Links to `.pdf`, `.dwg` and `.dxf` are routed out of the image pipeline.
  - Their words include the labels of the enclosing list items.
  - Their kind (OUTLINE / ENERGY_CERTIFICATE / COST_ESTIMATE / DRAWING_SET / BROCHURE), variant (BASE / MIRRORED) and
    stated scale are text claims.
  - OUTLINE and DRAWING_SET are fetched under the same safety policy, with a document-only media allowlist, and
    hashed, **never parsed**.
  - They are recorded in an optional `SourcePackage.documents`. That field enters the content hash only when it is
    non-empty, and is sealed as schema 1.3.0 only then. Every sealed package without documents keeps its hash (24 of
    24 measured).
- **Captions and vocabulary.**
  - A figure caption belongs to its own figure only.
  - Add "przód" / "tył" as views.
  - "parterowy" (a house type) is not the ground storey.
  - The description never comes from a form or consent text.
  - The page's h1 names the project when the title adds a suffix to it.
  - An empty drawing heading says so, and keeps its weight.
- `generic.project-page` moves to 1.1.0. `archon.ts` and the shared `discovery.ts` are not touched.
- **Aster.** The typed stop is kept. Its message says the floor plan prints no dimension chain, instead of saying its
  chains could not be read.

## 3. What must not move

- **Model hashes:** Marcówki `6152770f…`, Kosaćce clean and tracked `5b5ffcf1…`, G2E `8fa4a25b…`.
- **Decomposition digests** on the pinned plans: envelope, lines, cells, `wideOpenings` and bays.
- **The 005B metric gates, unchanged:** orientation, self-anchoring, chain roles, the interior chain as extent,
  Kosaćce clean = tracked, dom-w-jablonkach's corrected scale, willa-miranda's scale.
- **Allowed to move, each with a stated reason:**
  - e-OZE, dom-w-jablonkach (the `sideWallReach` face), willa-miranda, zurawkach, modrzykach and Aster;
  - any generic-adapter package re-sealed, whose version changes by design.
