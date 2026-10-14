# 005Q Phase A — negative-control inventory (key: `negatives`)

> Phase A inventory by an independent read-only agent, from the frozen baseline only (no candidate output was read). Scratch paths are shown as `$W`, a directory outside the repository; raster overlays stayed there.

Base: production `packages/reconstruction` at `04d5568` (HEAD `d28b755` changes no file under `packages/`:
`git diff --stat 04d5568 d28b755 -- packages` is empty). Baseline: `$W/B0-score.json` (46 rows,
24 COMPLETED, 19 PASS = 18 on the 44 + `dom-miniaturka`) and `$W/runs/B0/<case>/`.
Scratch: `$W/agents/negatives/` (scripts `extract.py`, `show.py`, `render.py`, `features.py`,
`sides_parse.py`; outputs `inventory-raw.json`, `negative-features.json`, `sides-summary.json`, `img/*.png`,
`runs/{SIDES,NAIVE,NOCOVER}/`). Raster overlays were made in scratch only; nothing was written to the repository.

Labels: **KNOWN** = reproduced from code/data here (file:line at 04d5568, digest/model numbers, or a replay I ran);
**INFERRED** = reasoned, not reproduced; **UNAVAILABLE** = cannot be determined from what is here. "Raster" means I
looked at the decoded plan with the B0 digest rectangles drawn over it (blue = extent, red = box, green = unbuilt body,
magenta = built body, orange = OPEN_SIDE, cyan = OPENING_IN_WALL); a feature read from the raster is KNOWN as to what
is drawn and INFERRED as to roofing (a plan does not show a roof).

Coordinates: plan pixels of the selected frame (`x` east, `y` south, so N = small y). Model metres: `x` east from the
ring's west face, `z` north from the stated S extent (model z grows to the N; "front" = S, "rear" = N in every row
checked).

## 0. Summary (the answer in five lines)

1. 52 legitimate open features / feature records on 25 rows are inventoried below (§3, machine table §7 and
   `negative-features.json`). 27 of them are on 15 of the 19 baseline-PASS rows.
2. Of the 19 PASS rows, **four carry a STRONG extent conflict ≥ 2 walls beyond the box** (KNOWN, digest):
   `rarytasy-g2e` S 15.89 walls (ZONE), `dom-w-modrzykach` S 21.91 (INCONCLUSIVE), `dom-w-zurawkach` S 4.82
   (INCONCLUSIVE), `dom-w-morelach` E 3.16 (ACCEPTED). On three of them the strip beyond the box holds open ground,
   an entrance porch or an entrance niche that must stay unbuilt; the fourth (morelach) is already a correct
   chain-constrained acceptance that must not be duplicated or widened.
3. A fifth PASS row, **`marcowki`, has extent 2.22 / 2.19 walls beyond the box on N / S with no conflict at all**,
   because none of its exterior chains `coversWitness` (KNOWN, instrumented replay, §4.2). Its two covered
   terraces are protected only by that flag. `dom-w-jablonkach` has a SUPPORTED (not STRONG) N side 9.03 walls out
   over a 41.8 m² pergola terrace.
4. Several PASS rows already **build or fabricate** open features (cieszyniankach NW covered terrace built;
   modrzykach NW loggia built; eoze-legacy-every/-area rings cut mid-wall with wall-poché "terraces"; rarytasy-g2e
   55.71 m² "front recess" terrace over open ground). A correct boundary fix may have to change these models, so
   **G1 "model.json byte-identical on 19 PASS rows" is incompatible with fixing the glogownikach class on
   eoze-legacy-*** — the gate needs named exceptions with source evidence, not a silent pass.
5. Removing the room/returns guards from the existing completion (counterfactual NAIVE, §5) changes **nothing** on 11
   rows: the open features are protected upstream (they are never enclosed candidates). A rule that manufactures
   candidates from chain stretches (C2-type) removes that protection; its own tests are then the only guard.

## 1. Method

- `extract.py` reads, for every row, the selected plan's digest (`boundary.{box,bodies,extentConflicts,completions}`,
  `wideOpenings`, `compoundFacades`, `regions`, `masses`, `extent`, `envelope`, `scale`) and the model
  (`levels`, `slabs`, `wallRings`, `terraces`, `balconies`) → `inventory-raw.json`.
- `render.py` decodes the sealed plan image from the case cache (sha256 = the selected variant's `byteHash`) and
  draws the digest rectangles; I looked at every row that has an open feature, a body, a conflict or a terrace.
- `gozdzikowcach` (no digest: fails at emission) is read from the PROBE replay's REGIONS/BOUNDARY records
  (`$W/runs/PROBE/dom-w-gozdzikowcach/probe.ndjson`) and 005N's
  `stage-reports/artifacts/analyzer-005n/compound-facade-evidence.json`.
- Instrumented copy `v1` (production + two `appendFileSync` logs, outputs byte-identical — checked for marcowki:
  `cmp runs/SIDES/marcowki/model.json runs/B0/marcowki/model.json` → identical): `layout.ts:503-532`
  (`extentSidesOf`, every side and every chain that ends within 3 walls of it with role / `coversWitness` / mark
  class) and `boundary-completion.ts:242-290` (every side's gap, free stretches). Run on the 34 rows whose extent
  comes from chains (rows with `WALL_GEOMETRY_EXTENT` are skipped by `layout.ts:516` and can state nothing).
- Counterfactual copies: `v2` = NAIVE (ATTACHED_ROOM parts reaching a STRONG side skip the `!room` and
  `returns < 2` guards, `boundary-completion.ts:568`, `:571`); `v3` = NOCOVER (`layout.ts:518` without
  `!role.coversWitness`). One replay at a time.

## 2. Where a boundary change can reach (KNOWN, code)

- Extent sides are stated only by chains whose role is EXTERIOR **and** `coversWitness`, ending within one wall of
  the side, on a mark not REJECTED (`layout.ts:513-521`); STRONG needs two chains on lines > 1 wall apart ending
  within a wall of each other, or one chain closed by ≥ 2 READ segments and nothing DERIVED/CHAIN_CORRECTED
  (`:523-528`). `WALL_GEOMETRY_EXTENT` sides are never stated (`:516`).
- A conflict exists only when the boundary reviewer has a `box` (`boundary-completion.ts:242`), the stated side
  lies ≥ `conflictWalls` = 2 walls past it (`:52`, `:248`) and a free stretch ≥ `stretchWalls` = 2 walls is left
  (`:54`, `:265`). STRONG ⇒ `ZONE`, SUPPORTED ⇒ `RECORDED` (`:283`); an ATTACHED_ROOM part that reaches a STRONG side
  turns it into ACCEPTED or INCONCLUSIVE (`:601-604`).
- An ATTACHED_ROOM is accepted only through `reaches` (`:509-519`), `room` (open + doorway ≥ doorM, wallShare ≥ 0.5,
  postShare < 0.1, and glazing / chain / non-dashed vehicle door, `:546`), `returns ≥ 2` with `returnCover` 0.75
  (`:494-507`, `:570`), inside the extent, and the size cap (`:574`).
- Rows with no `box` (A03, A06, A07, arkadiach, cieszyniankach, miniaturka, tunbergiach, rarytasy-eoze,
  kosacce-area-alone) never reach the conflict code: their boundary record is the empty reviewer outcome.
- Terraces come from v2 recess zones (`v2/reconstruct-v2.ts:1093-1121`); `surface` PAVED when
  `drawnShareOf ≥ 0.3` (`:1111`, `:1118`; `v2/terrace.ts:107`), which cannot tell wall ink from paving (glog.md §3).
  Every ring is labelled SOURCE_EXACT whatever its basis (`v2/emit.ts:191`).

## 3. Inventory by row

Sizes are px rect × the frame's `scale.mppX/mppY`; areas in the digest (`areaM2`) are cell areas and can differ from
the rect product.

### 3.1 Baseline PASS rows (known-good; G1 applies)

**rarytasy-g2e** (frame `…e8520c3ad3-59a406b738`, PASS −2.75 %, mpp 0.027579, wallPx 14, box 106.5..730.5 ×
167.5..479.5, extent to y 702). KNOWN digest: S `STRONG ZONE`, gap 6.12 m = **15.89 walls**, stretch 106.5..730.5
(the whole side). Raster (KNOWN as drawn): the S strip holds the walled double garage (built, ring 6.17 × 6.20
SOURCE_EXACT, 175.5..402) and, either side of it, **open ground** — W 106.5..175.5 (1.90 × 6.12 m) and E
402..730.5 (9.06 × 6.12 m) — plus a paved entrance path 427..483 × 479.5..585 under a dashed overhead line, a planter
483..530 × 479.5..510 and a lattice/fence element at x≈478..483, y≈585..625. B0 bodies there: UNKNOWN 1.21,
FLUSH_ATTACHED 0.25, UNKNOWN 0.23 m², all unbuilt; ATTACHED_ROOM REJECTED WALLED_OFF; BOX_COMPLETION REJECTED
WALLED_OFF 402..427. Model: `terrace-front-0` UNKNOWN 12.72 m² and `terrace-front-822` UNKNOWN **55.71 m²** "the floor
of the front recess" — an existing semantic defect (ground called a recess floor), not built. Garage door
`wide-Y-702-213-393` OPENING_IN_WALL 4.96 m (callout 500). N terrace door `wide-Y-168-532-677` OPENING_IN_WALL 4.00 m
(callout 410). **A wrong fix** (fill the STRONG S side, or accept every part reaching it) builds 55.5–67 m² of ground:
footprint 184.55 → ≈ 240–252 m², **PASS → FAIL (+27..+33 %)** (INFERRED arithmetic; see §5 for the run).

**dom-w-zurawkach** (`…0dfaf7d6ba-6fe6f9c445`, PASS −0.81 %, mpp 0.022182, wallPx 14, box 260..792 × 95..456,
outline accepted). KNOWN digest: S `STRONG INCONCLUSIVE`, 1.50 m = **4.82 walls**. Raster: entrance porch 327..599.5
× 456..523.5 (6.04 × 1.50 m; body UNKNOWN 6.74 m², mouth 3.22 m, unbuilt) with the entrance door 100/210 in the box
face, **one post** (≈430..445 × 505..520) and planting; SEPARATE_BODY 0.72 m² (414..453.5 × 486.5..523.5, post +
planter, WALLED_OFF). Garage wing PROJECTING_WING **built** 6.39 m² (599.5..792 × 456..523.5, door 260/229).
RECESSED_ATTACHED slivers 0.32 / 1.00 / 0.53 m² unbuilt (the last is the E window 180/130 strip). Storeys (005L): 3/3,
basement and attic by wall pairs, attic set back 0.82 m on the attached body (`ring-attached-0-1` SOURCE_DERIVED
4.30 × 8.68). **Wrong fix**: porch built as an attached room, +6.7..9.0 m² → ≈ +5.8..+8 % (a fabricated room that
may still score PASS by 0.2 pp, adversary.md H-D).

**dom-w-modrzykach** (`…fb7476d8f1-6827e718fe`, PASS +2.03 %, mpp 0.027481, wallPx 16). The long-band box is only
46..719 × 113..184.5; the outline was accepted and the rest of the house is a built PROJECTING_WING 153.35 m²
(46..719 × 184.5..535). KNOWN digest: S `STRONG INCONCLUSIVE` measured against that box: 9.63 m = **21.91 walls**.
Open features: S entrance niche 226..337 × 489..535 (door 105/210 between piers, mouth 0.99 m; body UNKNOWN 3.86 m²,
unbuilt) — raster KNOWN. NW corner terrace/loggia 46..213 × 113..184.5 (table and chairs, door 300/230, pier at the
NW corner): **built** in B0 (region BUILT 66..213 × 113..518 and the 4.56 × 11.13 attached ring cover it) — existing
compensating defect, roofing INFERRED. `innerface-B0.json` (lead's census) puts mass-2's x1 at 476 on the inner face of
band 476..492 (cover 0.98). OPEN_SIDE 7.50 at y=185 (222..495) is the interior line between box and wing.
**Wrong fix**: niche built (+3.9 m²); any rule re-deriving the house from the 113..184.5 box against the 21.9-wall
conflict could rebuild the whole wing differently — the model must stay byte-identical.

**dom-w-morelach** (`…63ae7d4e86-027bb2e82d`, PASS −2.17 %, mpp 0.01996, wallPx 16.75). KNOWN digest: E
`STRONG ACCEPTED` 1.06 m = 3.16 walls; ATTACHED_ROOM ACCEPTED 2.92 m² (618..671 × 415..590: "2.64 m way in, 73 %
walled, glazed, 3 returns") → the 1.06 × 3.50 bay ring SOURCE_EXACT; BOX_COMPLETION ACCEPTED 5.95 m² (61..252 ×
590..667, CONTINUATION). SEPARATE_BODY 0.83 m² (646..671 × 462..544) unbuilt. Open: NE corner 618..671 × 208..415
beside the bay (door 216/230) is outside (raster; INFERRED terrace/ground). 2 storeys; the bay and the W wing's S
part carry no upper slab. **This is the only chain-constrained acceptance in B0 and is correct**; a new completion
rule must leave it identical (not re-accept it under a second reason, not widen it to the full E side 208..739).

**marcowki** (`…19a11bc745-33a5ff46cd`, PASS −0.29 %, mpp 0.026426, wallPx 17.125, box 58..514 × 259..735.5,
extent 221..773). KNOWN digest: **no extent conflict** although N is 38 px = **2.22 walls** and S 37.5 px = **2.19
walls** past the box. Bodies: COVERED_TERRACE 6.99 m² N (94..357 × 221..259) and 11.02 m² S (94..514 × 735.5..773),
FLUSH_ATTACHED 0.96 / 0.94 (wall stubs 58..94), all unbuilt; completions ATTACHED_ROOM REJECTED WALL_SLIVER. Model:
`terrace-rear-66` PAVED 23.26 m² ("rear recess and the platform beyond it"), `terrace-front-66` PAVED 10.68 m²,
`balcony-front-1` and `balcony-rear-1` (VISUAL_INFERRED dark bands), garage ring 4.15 × 7.51 with **no upper slab**,
upper slab `slab-main-1` 6.92 × 11.63 m (005L registration k 1.020, near-tie rival k 1.106 that would stand the
attic on house + garage, kept as a conflict — 005L §D). Why no conflict: §4.2. **Wrong fix**: either covered terrace
built (+7 / +11 m²; +11 m² is +8.4 % → FAIL), the garage gains a storey, or the attic registration flips to the
k 1.106 rival.

**dom-w-jablonkach** (`…a8bdd8cd1d-d80b709d74`, PASS −0.40 %, mpp 0.021195, wallPx 20). KNOWN digest: N
`SUPPORTED RECORDED` 3.81 m = 9.03 walls (one chain, `chain-vertical-…`). Raster: N strip 83.5..602.5 × 56.5..237 is a
pergola / covered terrace on posts (posts at ≈265 and ≈545 on y≈85, ≈265 on y≈210), a spiral stair, a planter strip
(223.5..261: COVERED_TERRACE body 3.03 m², unbuilt) and planting W. Model `terrace-rear-0` PAVED 41.8 m² (11.00 ×
3.80 m). S recessed entrance (door 105/210) and garage door 250/225 are inside the box. **Wrong fix**: a rule that
treats SUPPORTED as STRONG, or fills the N side: +41.8 m² (+42 %).

**kosacce-clean / kosacce-tracked** (same frame `…f530d6ebf2-668d857ed9`, PASS −1.33 %, mpp 0.024058, wallPx 14,
box = extent on N/S/W). No conflicts. Raster + digest: N covered terrace 434..736 × 179.5..333 (7.27 × 3.69 m; dashed
roof edge; RECESS regions 464..520 and 555.5..628.5), E covered terrace 650.5..736 × 333..522.5 (2.06 × 4.56 m;
`wide-X-736-316-531` OPEN_SIDE 5.17), NW ground 46..157.5 × 179.5..333; OPEN_SIDE 3.71 / 5.78 / 6.84 / 3.95; N facade
compound span 304..527 cut by a WALL_RETURN 411..435 (return 4.25 m) into OPENING_IN_WALL 2.48 + OPEN_SIDE 2.21
(005N). No terraces in the model. 005N OWNER checklist item 2: "Zadaszony taras obok okna zostaje otwarty".
**Wrong fix**: the 005N false closure (terrace into a room), +9..27 m².

**eoze-legacy-every / eoze-legacy-area** (`…b747b42ad2-e3a3d0015d` / `…2abfc5825d-e842a14c7f`, PASS −4.21 / −4.37 %,
mpp 0.022236, wallPx 15.5 / 15). KNOWN digest: Y extent from `EXTERIOR_CHAIN_TICKS` (weak), box y 246.5..568.5 sits
**inside** the H wall bands 237..256 (N) and 559..578 (S) (eoze-legacy-area `bands`); extent 230 / 578.5; gaps 1.06–1.10
walls (N) and 0.65–0.67 walls (S) — below `conflictWalls`, so no conflict. Ring 16.01 × 7.30 / 7.29 m against
16.01 × 7.74 for the same house read by `rarytasy-eoze` (outer faces, +1.57 %). Model terraces on the strips:
every — rear 5.54 PAVED, front 1.26 PAVED, 0.22 / 1.69 UNKNOWN; area — rear **51.45** PAVED (to a platform beyond the
N wall), front 1.26 / 0.22 / 1.69 PAVED. These are the glogownikach class (terraces on wall poché, ring off the outer
face) **inside PASS rows**. A correct face fix would move them toward ≈ +1.6 % (still PASS, INFERRED from
rarytasy-eoze) and **must** change their model.json: G1 byte-identity cannot be met by a correct fix here.

**dom-w-cieszyniankach** (`…ebb40feeba-0459d5961d`, PASS −5.10 %, mpp 0.027769, wallPx 16, no box). Raster: NW
covered terrace 193..290 × 81..255 (2.69 × 4.84 m, corner post 193..210 × 81..98, table, doors 100/240 and 220/240) is
**inside the single built mass** 193..614 × 81..649 (digest). Removing it gives ≈ 171.9 m² ≈ −11.7 % (INFERRED
arithmetic) → FAIL: the PASS depends on building it (the publisher's figure likely includes roofed terraces;
UNAVAILABLE). Model `terrace-west-80` UNKNOWN 3.51 m² is a 0.22 m kerb strip 185..193.

**dom-w-arkadiach** (no box). W facade compound span x=138 cut by a FACADE_PIER (516..574): the 2.01 m "OPEN_SIDE"
mouth 407..516 is a window 200/150 between piers (raster, INFERRED); the box stands and the model is one rectangle.
N terrace door `wide-Y-213-236-442` OPENING_IN_WALL 3.80 (callout 400). Trigger-census (lead): C1 face pairs X low
0.472, Y high 0.554, not firing. **Wrong fix**: a consumer of OPEN_SIDE that carves the facade.

**dom-miniaturka** (no box, PASS +1.48 %). E bay 628..676 × 154.5..452.25 (windows 55/140, 150/140, 55/140) built as
ring 1.00 × 6.23; RECESS 628..676 × 452.25..486; OPEN_SIDE 3.86 at x=628 (bay mouth, interior). KNOWN from the lead's
`trigger-census.json`: **C1 fires on its selected frame, side Y low (outer 154.5, inner 177, cover 0.848)** — the
preregistration text ("every known-good row with a face pair has cover ≤ 0.55") is contradicted by the census file.

**A02** (box, no conflict; N/S sides not stated: chains EXTERIOR but `coversWitness` false — §4.1). S entrance recess
RECESS 280..459 × 707..741 (4.46 × 0.85 m, doors 105/210 and 80/210), **inside** the slab (005N residual: v2 carves
recesses only from dimensioned zones). **A06**: porch body 3.88 × 1.44 built, upper slab 2.99 m² over it, 3.96 m²
BEYOND overhang named (005L §D). **A07**: N glazing OPENING_IN_WALL 3.71 / 3.59; interior OPEN_SIDE 6.53 (y=429).
**A03, tunbergiach, rarytasy-eoze**: no open feature; tunbergiach's attic is its own 3.86 × 3.77 ring (005L).

### 3.2 Non-PASS rows (a wrong fix must not complete them with an open feature built)

- **dom-pod-jarzabem** (FAIL −11.88 %, `…cafd34a77a-4813950087`, mpp 0.028009/0.028035, wallPx 16). N covered terrace on
  corner posts COVERED_TERRACE 12.65 m² (602..785 × 116..204; N `SUPPORTED RECORDED` 2.47 m = 5.5 walls). S: the
  UNKNOWN body 14.35 m² (263..785 × 561..596; S `STRONG ZONE` 0.98 m = 2.19 walls) contains **two real rooms**
  (Gabinet 263..413, Kuchnia 635..785, projecting to 596 with windows 200/140) and between them a **recessed open
  entrance porch 413..635 × 561..596** (doors 70/210, 105/210, 70/210 on the inner facade). **Trap (KNOWN digest):
  the porch mouth on y=596 is `wide-Y-596-413-635` OPENING_IN_WALL 6.22 m, "77 % of it spanned by one drawn line"**
  — the drawn line is the porch paving edge. A rule that accepts far-face OPENING_IN_WALL as host wall (C2's "host
  openings" with width ≤ 8 m) would close it. Garage door 300/225 at y≈548..561 (130..237); the apron 103..263 ×
  561..596 is ground (`terrace-front-0` PAVED 4.51). E bay 785..800 × 338..470 (window 260/170, 0.42 m) with ground
  beside it carries three "east recess" terraces 1.18/1.24/1.67 m². OPEN_SIDE 4.40 (x=602) is interior, 4.04 (x=785)
  the bay mouth, 4.68 (y=561, 263..430) the line inside Gabinet.
- **willa-miranda** (FAIL storeys, −1.49 %). S porch with a post COVERED_TERRACE 10.11 m² (378..533 × 519..610.5);
  N terrace with door 110/230, UNKNOWN 5.00 m² enclosed (571.5..699 × 121..176), REJECTED NO_STRONG_EXTENT; NW
  COVERED_TERRACE 0.70 m². N and S `STRONG ZONE` 2.43 m = 7.63 walls each. Garage PROJECTING_WING built 17.02 m²,
  N living-room projection built. Upper plan: no walled body (005L: UPPER_REGION untouched).
- **dom-w-dabecjach** (FAILED outline). W/N/S STRONG 16.0 / 9.86 / 15.82 walls. NW covered terrace on posts
  (≈153..340 × 50.5..260), N ground with shrubs (340..703 × 50.5..159), SW entrance path / garden (153..381 ×
  461..635, labelled COVERED_TERRACE 41.09 m²) must stay open; the dining room 2 (153..329 × 270..452) and the garage
  wing (built) are walled. Compound span x=317 (OUTLINE) cut by a FACADE_PIER into OPEN_SIDE 7.32 + 1.46.
- **dom-w-krasnokwiatach** (FAILED −91.8 %): NW covered terrace 155..262 × 77..248 (11.54 m², post 155..177), S
  porch 262..365 × 559..718 (10.33 m², post 263..284), planting strip ≈226..262 × 559..760 (shrubs read as
  wall-thick bands, KNOWN) — krasno.md §0. Walled: living room 262..535 × 77..248, garage 365..535 × 559..718.
- **dom-w-akebiach** (FAILED): courtyard 303..370 × 611..759, porch 370..487 below the door wall ≈627, SE yard
  605..750 × 611..759 must stay outside (akeb.md table); garage → 759 and bay → 656 are walled.
- **dom-w-helikoniach** (FAIL −18.88 %): S entrance porch 300..428.5 × 710..752 (door 150/210) is a BUILT region in
  the digest (PROJECTING_WING 4.91 built) but not in the model slab; N terrace door OPENING_IN_WALL 4.66 (callout 446)
  and model `terrace-rear-141` PAVED 34.72 m² (platform N of the house).
- **dom-w-glogownikach** (FAIL −8.04 %): real S entrance niche 438..645 × 535..553 (≈0.47 m deep) and garage door
  strip 672..784 (glog.md §6); N terrace doors OPENING_IN_WALL 5.70 (callout 542; the mullion block 525..536 is
  NOT_A_SEPARATOR, 005N). B0's three PAVED terraces (3.27 / 6.63 / 1.31 m²) and the strip bodies are mostly wall
  poché — but about 2.4 m² of `terrace-front-0` (x 438..645) is the floor of the genuine niche above, and one of B0's
  two returns (`return-front-0-0`, x 14.89–15.60 m) is the real garage pier 645..672 read as a recess return
  (correction after review round 1, TOPOLOGY-2: N1a removes both readings; neither code models the niche or the pier).
- **A05** (FAILED): NE recessed covered terrace RECESS 434..758 × 201.5..259.5 (door 360/230), S entrance canopy with a
  post at the 0.99 m "slab edge" mouth (427..474); E STRONG 3.69 / S STRONG 3.62 walls. Room 8 (233.5..392 × 480..634)
  and the E bay (758..806 × 302..480) are walled (positive targets, unbuilt in B0).
- **A00** (FAILED): S recessed entrance porch, mouth OPEN_SIDE 4.61 at y=605 (414..614).
- **dom-w-gozdzikowcach** (FAILED at emission; PROBE REGIONS, KNOWN): RECESS 311..434 × 549.4..598 (mouth 3.09 m
  OPEN_SIDE, back wall 1.22 m, WALL_RETURN 434..465 with 3.86 m return), garage S part BUILT 434..639 × 549.4..598
  (mouth 465..590, decision OPEN_SIDE but cells BUILT), interior OPEN_SIDE 3.88 at x=311. No conflicts (box ≈
  extent). 005N OWNER checklist: "wejście jest wnęką; garaż jest częścią domu i ma bramę; we wnęce nie ma sztucznego
  pokoju".
- **D00** (FAIL −18.71 %, `WALL_GEOMETRY_EXTENT`, no statements possible): terraces east/rear/west 2.09/1.32/1.60 PAVED
  on strips; 2/2 storeys (attic by wall pairs k 1.034, overhang 12.2 m² named).
- Rows with no open feature beyond "do not build": cyklamenach (BOX_COMPLETION REJECTED 40.44 m² NO_CONTINUATION is
  the W half of the real house, a positive target), azaliach, A04 (N part is real house), murajach, kosacce-area-alone
  (same terraces as kosacce, no box). Scale-refused rows (modrzewnicy, alt-marcowki, aster-viii, galaktyka,
  milorzebem, D01–D05, all `WALL_GEOMETRY_EXTENT`) cannot reach a verdict through the boundary; A01 has no digest.

### 3.3 005L storey controls (the upper storey must stay where it is)

From each model's slabs (KNOWN) and 005L §D:

| row | storeys model/plans | upper slab(s) (m) | what must not move |
| --- | --- | --- | --- |
| marcowki | 2/2 | main-1 0.49..7.41 × 1.48..13.11 (80.49 m²) | registration k 1.020 (rival k 1.106 house+garage, margin 0.044, kept as conflict); garage has no upper slab |
| arkadiach | 2/2 | 0.44..6.96 × 0.44..8.96 (55.45) | — |
| morelach | 2/2 | attached-0-1 20.90, main-1 62.44 | own pixel scale k 1.000; the bay has no upper slab |
| jablonkach | 2/2 | 0.45..10.55 × 0.45..8.55 (81.99) | own pixel scale (margin 0.22) |
| zurawkach | 3/3 | basement main/attached; attic attached-0-1 SOURCE_DERIVED 4.30 × 8.68 | wall pairs; attic set back 0.82 m; garage wing not stacked |
| tunbergiach | 3/3 | 105.33 + attic own ring 3.86 × 3.77 SOURCE_DERIVED | — |
| A03 | 2/2 | 91.11 | wall pairs k 1.001 |
| A06 | 2/2 | main-1 64.34, attached-0-1 2.99 (over the porch) | wall pairs k 1.000; 3.96 m² BEYOND overhang named |
| A07 | 2/2 | 121.83 | wall pairs k 1.001 |
| miniaturka | 2/2 | 84.18 | bay has no upper slab |
| D00 (FAIL) | 2/2 | main-1 118.17, attached-0-1 8.00 | wall pairs k 1.034 |
| willa-miranda, helikoniach (FAIL) | 1/2 | — | the failing storey count must not be "fixed" by copying the ground ring |

A ground-boundary change that moves a base mass changes the support/registration input (005L `storeySupportOf`), so
every storey row is a negative control even when no open feature is involved (INFERRED; not run per row).

## 4. The PASS rows and their extent conflicts

### 4.1 Conflicts and stated sides (KNOWN: B0 digest + instrumented `SIDES` replay)

`gap` = (stated side − box face) in walls, from the digest's extent/box; "stated" = `extentSidesOf` emitted the side.

| PASS row | box | W gap / stated | E gap / stated | N gap / stated | S gap / stated | conflicts (digest) | STRONG side ≥ 2 walls past box |
|---|---|---|---|---|---|---|---|
| A02 | yes | 0.31 / STRONG | 0.03 / STRONG | 0.00 / not stated | 0.00 / not stated | — | no |
| A03 | no | 0.06 / STRONG | 0.03 / STRONG | 0.03 / STRONG | 0.01 / STRONG | — | no |
| A06 | no | 0.00 / not stated | 0.00 / not stated | 0.00 / STRONG | 0.00 / STRONG | — | no |
| A07 | no | 0.00 / SUPPORTED | 0.00 / SUPPORTED | 0.00 / not stated | 0.00 / not stated | — | no |
| dom-miniaturka | no | 0.00 / STRONG | 0.00 / STRONG | 0.00 / STRONG | 0.00 / STRONG | — | no |
| dom-w-arkadiach | no | 0.00 / SUPPORTED | 0.00 / SUPPORTED | 0.00 / SUPPORTED | 0.00 / SUPPORTED | — | no |
| dom-w-cieszyniankach | no | 0.50 / SUPPORTED | 0.00 / SUPPORTED | 0.03 / STRONG | 0.00 / STRONG | — | no |
| dom-w-jablonkach | yes | 0.00 / not stated | 0.10 / not stated | 9.03 / SUPPORTED | 0.00 / SUPPORTED | N:SUPPORTED:RECORDED:9.03 | no |
| dom-w-modrzykach | yes | 0.00 / STRONG | 0.00 / STRONG | 0.00 / STRONG | 21.91 / STRONG | S:STRONG:INCONCLUSIVE:21.91 | S 21.91 |
| dom-w-morelach | yes | 0.00 / STRONG | 3.16 / STRONG | 0.00 / STRONG | 0.00 / STRONG | E:STRONG:ACCEPTED:3.16 | E 3.16 |
| dom-w-tunbergiach | no | 0.00 / SUPPORTED | 0.00 / SUPPORTED | 0.00 / SUPPORTED | 0.00 / SUPPORTED | — | no |
| dom-w-zurawkach | yes | 0.21 / STRONG | 0.32 / STRONG | 0.00 / STRONG | 4.82 / STRONG | S:STRONG:INCONCLUSIVE:4.82 | S 4.82 |
| eoze-legacy-area | yes | 0.00 / SUPPORTED | 0.00 / SUPPORTED | 1.10 / SUPPORTED | 0.67 / SUPPORTED | — | no |
| eoze-legacy-every | yes | 0.00 / SUPPORTED | 0.00 / SUPPORTED | 1.06 / SUPPORTED | 0.65 / SUPPORTED | — | no |
| kosacce-clean | yes | 0.00 / STRONG | 0.46 / STRONG | 0.00 / not stated | 0.00 / not stated | — | no |
| kosacce-tracked | yes | 0.00 / STRONG | 0.46 / STRONG | 0.00 / not stated | 0.00 / not stated | — | no |
| marcowki | yes | 0.00 / not stated | 0.00 / not stated | 2.22 / not stated | 2.19 / not stated | — | no |
| rarytasy-eoze | no | 0.00 / SUPPORTED | 0.00 / SUPPORTED | 0.00 / SUPPORTED | 0.00 / SUPPORTED | — | no |
| rarytasy-g2e | yes | 0.00 / SUPPORTED | 0.00 / SUPPORTED | 0.00 / STRONG | 15.89 / STRONG | S:STRONG:ZONE:15.89 | S 15.89 |

The strength shown is that of the side statement (`extentSidesOf`); "not stated" = no EXTERIOR chain with `coversWitness` ends there. Rows with no box in the digest never compute a conflict. Free stretches recorded by the selected reading: rarytasy-g2e S 106.5..175.5 and 402..730.5; zurawkach S 257..621; modrzykach S 46..92 and 213..719; morelach E 208.5..739; jabłonkach N 83.5..604.5. Each lies over a §3.1 negative (N01/N02, N04/N05, N07, N10, N14).

Stated but < 2 walls (no conflict today, KNOWN): eoze-legacy-area N SUPPORTED 1.10, eoze-legacy-every N SUPPORTED 1.06; outside the PASS set glogownikach S STRONG 1.17 and jarzabem E STRONG 1.06.


### 4.2 marcowki: why no conflict (KNOWN)

Instrumented `extentSidesOf` (`v1`, model byte-identical to B0): every chain that ends within a wall of the N, S, E or
W side has `coversWitness = false` (N: `chain-vertical-547-41bf80a9f8` ends at 221, EXTERIOR, mark TICK; S: the same
chain ends at 784.5 with mark REJECTED, `chain-vertical-298` at 799 is > 1 wall away), so `stating` is empty on all
four sides and the conflict code never runs. Counterfactual NOCOVER (§5) tests this.

## 5. Counterfactuals (run, one replay at a time)

All three runs below used the frozen sealed inputs (`replay.mjs`, `--par 1`), scored with `score_005q.py`'s `row()`
against B0 (`cfcompare.py` → `cf-compare.json`).

| id | change (minimal) | rows run | prediction (written before the run) | result (KNOWN) |
| --- | --- | --- | --- | --- |
| CF-SIDES | `v1`: logging only in `extentSidesOf` (`layout.ts:503-532`) and the conflict loop (`boundary-completion.ts:242-290`) | 35 chain-extent rows | outputs identical | marcowki model.json `cmp`-identical; side records give §4.1 |
| CF-NOCOVER | `layout.ts:518`: drop `|| !role.coversWitness` | marcowki, A02, A04, A06, A07, miniaturka | marcowki gains N SUPPORTED (one chain, end 221 TICK; S end REJECTED), gap 2.22 walls → RECORDED, model unchanged | marcowki: `extentConflicts` [] → `["N:SUPPORTED:RECORDED:1.01"]`; **model, verdict, terraces unchanged** on all 6 rows. Falsifier met: the flag is what keeps marcowki conflict-free, and only a STRONG statement would put its terraces at risk |
| CF-NAIVE | `boundary-completion.ts:568` and `:571`: an ATTACHED_ROOM that `reaches` a STRONG side skips the `!room` (posts / walled share / way-in / room evidence) and `returns < 2` guards | rarytasy-g2e, zurawkach, modrzykach, morelach, willa-miranda, jarzabem, dabecjach, krasnokwiatach, akebiach, helikoniach, A05 | some open part reaching a STRONG side gets built (porch / terrace) | **nothing changes on any of the 11 rows** (model, failure, completions, conflicts, bodies identical). Census of every completion reason in every B0 digest (all frames): only WALL_SLIVER, WALLED_OFF, NO_CONTINUATION, NO_STRONG_EXTENT, TOO_LARGE, CONTINUATION, ATTACHED_ROOM occur — **no part on the 46 rows is ever rejected by the room or returns guards** |

What CF-NAIVE shows (KNOWN mechanism, INFERRED generalisation): the open features on these rows are protected
**upstream of the completion guards** — an open terrace, porch or ground strip is not an enclosed outline part, so it
never becomes an ATTACHED_ROOM candidate (`boundary-completion.ts:639` (and `:645` inside the box): candidates are components of
`outline.inside && !inA && !accepted`), and the enclosed bits are WALL_SLIVER / WALLED_OFF. A candidate that
**manufactures** parts from a chain stretch (C2's run-between-returns strips) removes exactly that protection; its
own host / returns tests are then the *only* guard, and they have never been exercised on these rows. So: the
stretches listed in §4.1 (rarytasy-g2e S 106.5..175.5 and 402..730.5; zurawkach S 257..621; modrzykach S 46..92 and
213..719; morelach E 208.5..739; willa-miranda N 234.5..367 and 571.5..794, S 234.5..533; jarzabem S 102.5..802;
dabecjach W/N/S; krasnokwiatach N/S 154.5..535; akebiach N/S 65.5..750.5; helikoniach N 158..463.5 and S 158..300,
428.5..463.5; A05 E 201.5..681, S 113..806) are the regions a strip-making rule will read, and each contains a
negative from §3.

Not run (UNAVAILABLE here, cost): a per-side fill that builds the whole stated strip (arithmetic only: rarytasy-g2e
+55.5..67 m², zurawkach +6.7..9.0, marcowki would need STRONG first); the lead's C2 itself.


## 6. Design implications for a safe boundary fix (evidence-backed)

1. **G1 as written conflicts with a correct fix** (KNOWN geometry): eoze-legacy-every/-area are PASS rows with the
   ring cut inside the wall bands (box y 246.5 in band 237..256, 568.5 in 559..578) and 4 terraces on the strips;
   modrzykach's mass-2 x1 476 is an inner face (lead's census, cover 0.98); miniaturka's N side fires C1 (cover 0.848,
   lead's trigger census). A rule that moves faces correctly must change these models. Either the rule provably does
   not touch them (and then it does not fix the class there), or G1 must name them with source evidence and require
   verdict PASS + semantics no worse (no new built open area, no lost real wall), not byte identity.
2. **A completion that builds from a chain must be per part and must read the part's own walls, never the side.**
   Every STRONG side ≥ 2 walls on a PASS row (rarytasy-g2e, zurawkach, modrzykach) has an open feature inside its
   stretch; morelach's is a correct bay already ACCEPTED and must not be re-accepted or widened (stretch 208.5..739 vs
   bay 415..590).
3. **Far-face OPENING_IN_WALL is not host wall.** jarzabem's porch mouth `wide-Y-596-413-635` is OPENING_IN_WALL 6.22
   ("77 % spanned by one drawn line") — a paving edge; rarytasy-g2e's garage door 4.96 is a real one. A host test
   must require wall-thick jambs that are walls of the strip's own returns plus an opening class from the opening's
   own evidence (leaf / glazing / vehicle-door signature, callout), not a drawn line across.
4. **Posts and planting are not returns.** zurawkach (post ≈430..445), willa-miranda (post 378..395), krasnokwiatach
   (posts 155..177, 263..284; shrubs read as wall-thick bands 229..261), akebiach (tree ink survives 5×5 erosion),
   jabłonkach (pergola posts) — a returns test over bands or ink without a neutrality / length / both-ends rule closes
   them.
5. **SUPPORTED must stay RECORDED and coversWitness must stay a gate** unless a replacement is shown on marcowki
   (CF-NOCOVER: dropping it creates N SUPPORTED 2.22 walls; if it ever became STRONG the 6.99 + 11.02 m² covered
   terraces would be ZONE candidates) and jabłonkach (N SUPPORTED 9.03 walls over a 41.8 m² pergola terrace).
6. **Lowering `conflictWalls` (2) below ≈1.2 creates new conflicts** on eoze-legacy-* (N SUPPORTED 1.06–1.10 walls),
   glogownikach (S STRONG 1.17 walls → ZONE) and jarzabem (E STRONG 1.06 walls over the bay strip) (KNOWN gaps from
   CF-SIDES; consequences not run).
7. **The footprint verdict cannot police this.** cieszyniankach PASSES only because a covered terrace is built
   (≈ −11.7 % without it, INFERRED); zurawkach's porch built would still pass at ≈ +5.8 %. Adoption needs the semantic
   checks per feature (§7 table): no new BUILT cell inside any N-record rect, no wide-opening class change, no
   terrace on a wall band, no new SOURCE_EXACT ring on an inner face.
8. **Storeys are downstream controls.** Any base-mass change on marcowki, morelach, zurawkach, A06, miniaturka must
   leave the upper slabs of §3.3 and "no storey over the garage / bay" unchanged.


## 7. Machine-readable table

`$W/agents/negatives/negative-features.json` (52 records: id, case, frame, knownGoodPass, feature,
truth, truthBasis, b0, rectPx, sizeM, mppXY, wrongFix). Compact copy:

| id | case | PASS | feature | B0 | rect px (x0..x1 × y0..y1) | size | wrong fix → |
|---|---|---|---|---|---|---|---|
| N01 | rarytasy-g2e | Y | S open ground W of garage | unbuilt; model terrace-front-0 UNKNOWN 12.72 m2 "front recess" | 106.5..175.5 × 479.5..702 | 1.90 x 6.12 m = 11.7 m2 | built as part of a chain-stated S strip: +12.7 m2 |
| N02 | rarytasy-g2e | Y | S open ground E of garage (incl. entrance path, canopy line, planter) | unbuilt; bodies UNKNOWN 1.21/FLUSH 0.25/UNKNOWN 0.23; model terrace-front-822 UNKNOWN 55.71 m2 | 402..730.5 × 479.5..702 | 9.06 x 6.12 m = 55.5 m2 | per-side STRONG S fill builds 55.7 m2: +30 % footprint, PASS -> FAIL |
| N03 | rarytasy-g2e | Y | garage door 500/238 on the S face | OPENING_IN_WALL 4.96 m; garage built (ring 6.17 x 6.20 SOURCE_EXACT) | 213..393 × 702..702 | 4.96 m (line) | reclassified OPEN_SIDE -> garage loses its door / becomes a carport |
| N04 | dom-w-zurawkach | Y | S entrance porch with a post | UNKNOWN body unbuilt 6.74 m2, mouth 3.22 m; S STRONG INCONCLUSIVE 4.82 walls | 327..599.5 × 456..523.5 | 6.04 x 1.50 m = 9.0 m2 | built as an attached room: +6.7 m2 (+5.8 %), still a "PASS" with a fabricated room |
| N05 | dom-w-zurawkach | Y | post + planter block in the porch | SEPARATE_BODY 0.72 m2 unbuilt, WALLED_OFF | 414..453.5 × 486.5..523.5 | 0.88 x 0.82 m = 0.7 m2 | a sealed "room" 0.7 m2 |
| N06 | dom-w-zurawkach | Y | garage wing (S projection) | PROJECTING_WING built 6.39 m2 (beyond box), 3 storeys stack on main+attached | 599.5..792 × 456..523.5 | 4.27 x 1.50 m = 6.4 m2 | must stay built; must not gain a second storey |
| N07 | dom-w-modrzykach | Y | S entrance niche (door 105/210 between piers) | UNKNOWN body unbuilt 3.86 m2; S STRONG INCONCLUSIVE 21.91 walls vs long-band box | 226..337 × 489..535 | 3.05 x 1.26 m = 3.9 m2 | niche built: +3.9 m2 |
| N08 | dom-w-modrzykach | Y | NW corner covered terrace / loggia (table, door 300/230, corner pier) | BUILT inside attached ring 4.56 x 11.13 (existing defect, PASS +2.03 %) | 46..213 × 113..184.5 | 4.59 x 1.97 m = 9.0 m2 | a correct un-building moves it to about -2.2 % (still PASS) but changes the model: G1 byte-identity cannot hold for that fix |
| N09 | dom-w-morelach | Y | E bay with window 180/140 (1.06 m projection) | ATTACHED_ROOM ACCEPTED 2.92 m2 (E STRONG 3.16 walls); ring 1.06 x 3.50 SOURCE_EXACT; no upper storey | 618..671 × 415..590 | 1.06 x 3.55 m = 3.8 m2 | the one chain-constrained acceptance in B0: a new rule must keep it, not double it |
| N10 | dom-w-morelach | Y | NE corner beside the bay (door 216/230) | unbuilt, no body | 618..671 × 208..415 | 1.06 x 4.20 m = 4.4 m2 | built if the E conflict were filled per side |
| N11 | marcowki | Y | rear (N) covered terrace between side walls, upper storey above | COVERED_TERRACE 6.99 m2 unbuilt; model terrace-rear-66 PAVED 23.26 m2 + balcony-rear-1 | 94..357 × 221..259 | 6.95 x 1.01 m = 7.0 m2 | built -> +7..23 m2; storey alignment (005L k 1.020) and ring 7.90 x 12.61 move |
| N12 | marcowki | Y | front (S) porch with piers and planters | COVERED_TERRACE 11.02 m2 unbuilt; model terrace-front-66 PAVED 10.68 m2 + balcony-front-1 | 94..514 × 735.5..773 | 11.10 x 0.99 m = 11.0 m2 | built -> +11 m2 (+8 %): PASS -> FAIL |
| N13 | marcowki | Y | garage (E attached body), no storey above | built ring 4.15 x 7.51 SOURCE_EXACT; lvl-1 has no slab over it | 357..514 × 452..735.5 | 4.15 x 7.50 m = 31.1 m2 | garage gains a storey (005L M2) |
| N14 | dom-w-jablonkach | Y | N pergola/covered terrace with posts, planter strip, spiral stair | COVERED_TERRACE 3.03 m2 (planter strip) unbuilt; N SUPPORTED RECORDED 9.03 walls; model terrace-rear-0 PAVED 41.8 m2 | 83.5..602.5 × 56.5..237 | 11.00 x 3.81 m = 41.9 m2 | if N were promoted to STRONG and filled: +41.8 m2 (+42 %) |
| N15 | kosacce-clean | Y | N covered terrace (dashed roof edge, piers) | RECESS regions 464..520 and 555.5..628.5; OPEN_SIDE 5.78/6.84; not built | 434..736 × 179.5..333 | 7.27 x 3.69 m = 26.8 m2 | closed into a room (005N false closure) -> footprint +27 m2 |
| N16 | kosacce-clean | Y | E covered terrace (330/500 glazing into it) | OPEN_SIDE 5.17 at x=736 (316..531); not built | 650.5..736 × 333..522.5 | 2.06 x 4.56 m = 9.4 m2 | built -> +9.3 m2 |
| N17 | kosacce-clean | Y | NW ground W of bedroom 10 | not built (inside the box, outside every mass) | 46..157.5 × 179.5..333 | 2.68 x 3.69 m = 9.9 m2 | built by a box rule |
| N18 | kosacce-clean | Y | N facade compound: WALL_RETURN separator 411..435 (return 4.25 m); 2.48 m opening + 2.21 m OPEN_SIDE mouth | OPENING_IN_WALL 2.48 / OPEN_SIDE 2.21 | 304..527 × 179.5..179.5 | 5.36 m (line) | merged into one gap -> terrace closed (pre-005N) |
| N19 | eoze-legacy-every | Y | N and S strips between the box (mid-wall) and the extent | 4 terraces on the strips: rear 5.54 PAVED, front 1.26 PAVED / 0.22 / 1.69 UNKNOWN; ring 16.01 x 7.30 (outer is 7.74) | 75..795 × 230..246.5 | 16.01 x 0.37 m = 5.9 m2 | existing glogownikach-class defect in a PASS row: an outer-face fix moves it toward +1.6 % (still PASS) but changes the model (G1) |
| N20 | eoze-legacy-area | Y | same strips; rear terrace extends to the platform | rear terrace PAVED 51.45 m2, 3 front PAVED; ring 16.01 x 7.29 | 75..795 × 230..246.5 | 16.01 x 0.37 m = 5.9 m2 | as N19 |
| N21 | dom-w-cieszyniankach | Y | NW covered terrace with corner post (doors 100/240, 220/240) | BUILT inside the single mass 193..614 x 81..649 (PASS -5.1 %) | 193..290 × 81..255 | 2.69 x 4.84 m = 13.0 m2 | un-building it drops to about -12 % (FAIL); keeping it is a compensating error |
| N22 | dom-w-cieszyniankach | Y | W strip 185..193 | model terrace-west-80 UNKNOWN 3.51 m2 (0.22 m wide) | 185..193 × 81..649 | 0.22 x 15.80 m = 3.5 m2 | — |
| N23 | dom-w-arkadiach | Y | W facade compound: FACADE_PIER separator; 2.01 m OPEN_SIDE mouth that is a window 200/150 | OPEN_SIDE 2.01 (x=138, 407..516); box stands, house is one rectangle | 138..138 × 407..516 | 2.01 m (line) | an OPEN_SIDE consumer carving the facade at a window |
| N24 | dom-miniaturka | Y | E bay (windows 55/140,150/140,55/140) | built attached ring 1.00 x 6.23; RECESS 628..676 x 452..486; OPEN_SIDE 3.86 at x=628 (bay mouth) | 628..676 × 154.5..452.25 | 1.00 x 6.22 m = 6.2 m2 | trigger-census C1 fires on its N side (cover 0.848): a face rule could move a known-good ring |
| N25 | A02 | Y | S entrance recess (doors 105/210, 80/210) | RECESS region 280..459 x 707..741 inside the slab (emitter does not carve recesses) | 280..459 × 707..741 | 4.46 x 0.85 m = 3.8 m2 | — |
| N26 | A06 | Y | porch body under the attic (005L) | built attached ring SOURCE_EXACT; lvl-1 slab 2.99 m2 over it; 3.96 m2 BEYOND overhang named | 308..495 × 209..278 | 3.88 x 1.43 m = 5.5 m2 | storey stacking changes |
| N27 | A07 | Y | N facade glazing 3.71 / 3.59; interior OPEN_SIDE 6.53 at y=429 | OPENING_IN_WALL x2; OPEN_SIDE interior | 46..789.5 × 220..220 | 17.22 m (line) | — |
| N28 | dom-pod-jarzabem | N | N covered terrace on corner posts | COVERED_TERRACE 12.65 m2 unbuilt; N SUPPORTED RECORDED 2.47 m | 602..785 × 116..204 | 5.13 x 2.47 m = 12.6 m2 | built -> +12.6 m2 |
| N29 | dom-pod-jarzabem | N | S recessed entrance porch between Gabinet and Kuchnia (doors 70/210,105/210,70/210 on the inner facade) | inside UNKNOWN body 14.35 m2 (263..785 x 561..596) unbuilt; its mouth on y=596 is OPENING_IN_WALL 6.22 ("77 % spanned by one drawn line" = paving edge) | 413..635 × 561..596 | 6.22 x 0.98 m = 6.1 m2 | TRAP: a rule that treats OPENING_IN_WALL on the far face as host wall closes the porch (+7.8 m2 porch built as a room) |
| N30 | dom-pod-jarzabem | N | garage door 300/225 + paved apron | garage built in the box; apron = model terrace-front-0 PAVED 4.51 m2 | 103..263 × 561..596 | 4.48 x 0.98 m = 4.4 m2 | apron built as garage depth |
| N31 | dom-pod-jarzabem | N | E bay window 260/170 (0.42 m) and ground beside it | FLUSH 0.18 / UNKNOWN 1.13 / FLUSH 0.29 unbuilt; model 3 "east recess" terraces 1.18/1.24/1.67 on ground | 785..800.5 × 338.5..470 | 0.43 x 3.69 m = 1.6 m2 | — |
| N32 | willa-miranda | N | S entrance porch with a post | COVERED_TERRACE 10.11 m2 unbuilt; S STRONG ZONE 7.63 walls | 378..533 × 519..610.5 | 4.16 x 2.43 m = 10.1 m2 | built -> +10.1 m2 |
| N33 | willa-miranda | N | N terrace (door 110/230) E of the living-room projection | UNKNOWN 5.0 m2 enclosed, REJECTED NO_STRONG_EXTENT; N STRONG ZONE 7.63 walls | 571.5..699 × 121..176 | 3.42 x 1.46 m = 5.0 m2 | built -> +5 m2 |
| N34 | willa-miranda | N | NW terrace strip (door 240/230) | COVERED_TERRACE 0.70 m2 unbuilt | 252..367 × 167.5..176 | 3.08 x 0.23 m = 0.7 m2 | — |
| N35 | dom-w-dabecjach | N | NW covered terrace on posts (furniture) | part of COVERED_TERRACE 74.86 m2 body (153..703 x 50.5..452) unbuilt; N STRONG ZONE 9.86 walls | 153..340 × 50.5..260 | 5.26 x 5.90 m = 31.0 m2 | built -> +~35 m2 |
| N36 | dom-w-dabecjach | N | SW entrance path / garden | COVERED_TERRACE 41.09 m2 (153..469 x 461..635) unbuilt (mislabelled); S STRONG INCONCLUSIVE 15.82 walls | 153..381 × 461..635 | 6.41 x 4.90 m = 31.4 m2 | built -> +~22 m2 |
| N37 | dom-w-dabecjach | N | N ground with shrubs E of the terrace | in the 74.86 m2 body | 340..703 × 50.5..159 | 10.21 x 3.05 m = 31.2 m2 | built |
| N38 | dom-w-krasnokwiatach | N | NW covered terrace (post 155..177) | merged in UNKNOWN 38.14 m2 body; N STRONG INCONCLUSIVE 9.5 walls | 155..262 × 77..248 | 2.69 x 4.29 m = 11.5 m2 | built -> +11.5 m2 |
| N39 | dom-w-krasnokwiatach | N | S entrance porch (post 263..284) | COVERED_TERRACE 11.32 m2 unbuilt; S STRONG INCONCLUSIVE 8.83 walls | 262..365 × 559..718 | 2.59 x 3.99 m = 10.3 m2 | built -> +10.3 m2 |
| N40 | dom-w-krasnokwiatach | N | S planting strip (shrubs read as wall-thick bands) | SEPARATE_BODY 1.62 m2 unbuilt | 226..262 × 559..760 | 0.90 x 5.05 m = 4.6 m2 | shrubs become wall/returns -> porch closed |
| N41 | dom-w-akebiach | N | S courtyard between garage and porch (trees) | in UNKNOWN 33.13 m2 body; S STRONG INCONCLUSIVE 9.25 walls | 303..370 × 611..759 | 1.95 x 4.30 m = 8.4 m2 | built -> +8.4 m2 |
| N42 | dom-w-akebiach | N | S entrance porch below the door wall (~627) | SEPARATE_BODY 7.7 m2 (389.5..592 x 611..656) unbuilt | 370..487 × 627..656 | 3.40 x 0.84 m = 2.9 m2 | built |
| N43 | dom-w-akebiach | N | SE yard | unbuilt (no body) | 605..750 × 611..759 | 4.22 x 4.30 m = 18.1 m2 | built -> +19.7 m2 |
| N44 | dom-w-helikoniach | N | S entrance porch (door 150/210) | BUILT region 300..428.5 x 710..752 in the digest (PROJECTING_WING 4.91 m2 built) but outside the model slab | 300..428.5 × 710..752 | 2.96 x 0.97 m = 2.9 m2 | emitted as built |
| N45 | dom-w-helikoniach | N | N terrace platform beyond the terrace door 340/230 | model terrace-rear-141 PAVED 34.72 m2; N door OPENING_IN_WALL 4.66 (callout 446) | 181..451 × 162..189 | 6.22 x 0.62 m = 3.9 m2 | — |
| N46 | dom-w-glogownikach | N | S entrance niche 0.47 m deep | in strips 536..553; model terrace-front-0 PAVED (on wall poche) | 438..645 × 535..553 | 5.44 x 0.47 m = 2.6 m2 | niche filled by an outer-face rule that does not read the step |
| N47 | dom-w-glogownikach | N | N terrace doors 5.70 m with a mullion block | OPENING_IN_WALL 5.70 (callout 542); block NOT_A_SEPARATOR | 421..638 × 203..203 | 5.70 m (line) | block read as a separator |
| N48 | A05 | N | NE recessed covered terrace (door 360/230) | RECESS 434..758 x 201.5..259.5; OPENING_IN_WALL 3.76 at y=260 | 434..758 × 201.5..259.5 | 6.84 x 1.22 m = 8.4 m2 | built |
| N49 | A05 | N | S entrance canopy with post / 0.99 m "slab edge" mouth | OPEN_SIDE 0.99 compound interval (427..474); S STRONG INCONCLUSIVE 3.62 walls | 392..474 × 634..681 | 1.73 x 0.99 m = 1.7 m2 | built |
| N50 | A00 | N | S recessed entrance porch (door 150/210, plants) | OPEN_SIDE 4.61 at y=605 (414..614) | 414..614 × 575..605 | 4.61 x 0.69 m = 3.2 m2 | closed |
| N51 | dom-w-gozdzikowcach | N | entrance RECESS (005N): mouth 3.09 m, back wall 1.22 m, WALL_RETURN 434..465 (3.86 m) | RECESS region 311..434 x 549.4..598, mouth OPEN_SIDE | 311..434 × 549.41..598 | 3.12 x 1.22 m = 3.8 m2 | recess filled / merged into one 7.76 m OPEN_SIDE (pre-005N) |
| N52 | dom-w-gozdzikowcach | N | garage S part with door 325 (005N) | BUILT 434..639 x 549.4..598; mouth 465..590 OPEN_SIDE 3.17 but cells built | 434..639 × 549.41..598 | 5.20 x 1.22 m = 6.4 m2 | garage unbuilt / opened |

PASS-row conflict table as JSON: `$W/agents/negatives/pass-conflicts.json`.

