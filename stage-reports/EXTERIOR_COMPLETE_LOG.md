# EXTERIOR-COMPLETE — campaign log (checkpoint)

Status: **WORK_IN_PROGRESS**. Main report: `stage-reports/STAGE_BUILDPLAN_EXTERIOR_COMPLETE.md` (written at the end).
This file is the durable checkpoint: after a context loss, read it top to bottom and continue from "Next action".

## Frozen evaluation (decided before any tuning, 2026-11-03)

- **DEV (13, every one counts, failures stay in the denominator):** the ten SOURCE-01 test houses (Arlety 3 E OZE,
  Jabłonki 22, Miniaturka 2 v3, Willa Maja R2, Dalie 5 GE, Azalie 3, Bratki 26 R2BE, Pod Miłorzębem 21 GB, Modrzewnica 10
  G2E OZE, Muraje) + the three SHAPE-LIVE-01 holdouts now used for diagnosis (Lipienniki 5, Aurory 26 G, Kostrzewy 4).
  Packages: `/home/user/work-s01/test-pkgs` (cache `/home/user/work-s01/cache`), `/home/user/work-sl/hold-base`
  (cache `/home/user/work-sl/hold-cache`).
- **Regression (8):** a01, arganiach, ciesz, gozd, marcowki, rary, sasankach3, trytomach (`/home/user/workfix02/base`,
  cache `/home/user/workfix02/cache`). Byte identity not required where geometry/palette improves for a stated reason.
- **Holdout H2 (blind, first evaluation after stabilising; sealed 2026-11-03, not opened):** jaskrzynach-7-g2e,
  renklodach-15-g2, zielistkach-23-a, kanzanach-3-g2e, narcyzach-14-b, wisteriach-15 (`/home/user/work-ec/h2`, cache
  `/home/user/work-ec/hcache`).
- **Holdout H3 (reserve for a re-holdout if H2 is used for a fix):** telimach-4-g2e-oze, balsamowcach-20-g2,
  skalnicach-3, wiesiolkach-3-ae, willa-edyta-r2be, modrakach-r2 (`/home/user/work-ec/h3`).
- Private work dirs are outside the repo (`/home/user/work-ec`); no publisher picture is committed.

## Acceptance (unchanged during the campaign)

Per house, from its own sources: a model exists; each characteristic element on the house's source list is present with
the right kind, side, size and relation (body/wing/garage/bay, roof orientation and parts, openings incl. gate and
entrance, balconies/railings, canopies on posts, dormers, rooflights, chimneys, facade bands/frames); no spike, no floating
wall, no refusal removing an element, no ERROR in the final compile; palette approximate and stated.

## Results log

(entries appended below, newest last)

## Next action

See the last entry.

### E0 — baseline on the frozen checks (code 80d5612, runs `/home/user/work-sl/po-test`, `po-hold`)

Checker `research/exterior-complete/check.py` against `stage-reports/artifacts/exterior-complete/expectations.json`
(derived from `source-elements.json`, written from the sources before any model was judged): **25/70 checks, 4/13
houses without a model** (Kostrzewy, Pod Miłorzębem, Muraje: PLAN_RESOLUTION_INCONCLUSIVE; Modrzewnica:
PLAN_NO_DIMENSION_FRAME). Failing classes: gate kind/entrance doors (Arlety, Dalie, Lipienniki, Bratki), rooflights missing
or refused as overlapping (Arlety, Aurory, Azalie, Dalie; Miniaturka/Jabłonki refusals), balconies/railings (Willa Maja,
Bratki), canopies/posts (Azalie, Aurory, Kostrzewy, Modrzewnica, Bratki, Miniaturka, Dalie), dormers (Jabłonki), wings
(Jabłonki rear, Dalie front), ridge axis (Aurory), chimneys (Lipienniki).

### E1 — rooflight dedupe, gate and door by their elevation face (solver-only loop, `/home/user/work-ec/it4`)

- Rooflights: two readings whose footprints meet on one slope are one rooflight (and none shares the roof with a chimney):
  the render-read duplicates that were refused as `ROOF_OPENINGS_OVERLAP` (Miniaturka 1, Jabłonki 2) are no longer emitted.
- `openingFace` (opening-reading.ts): neutral share, luma spread along a row, saturation, warmth inside an opening on a
  registered elevation (measured: gate 0.98/1.8/8, glass 0.51–0.58/13–26/19–26 warmth −20, timber sat 55 warmth +54).
  GARAGE_DOOR when ground storey, to the floor, ≥ 2.2 m, ≤ 3.2 m tall, OPAQUE_PANEL face and a published garage area;
  DOOR when door-sized and the face is an opaque or timber leaf. Views refused for opening heights still give the face.
- Gate geometry: a GARAGE door is a stack of 0.55 m sections with grooves over a backing plate, `usage: GARAGE`, `mat-gate`.
- Checks: 25 → 26/70 (Arlety gate). Bratki's front doors: no front view registers (semi-detached elevation) — open.
- Running: `/home/user/work-ec/rec1` = Muraje, Pod Miłorzębem, Modrzewnica with the phone's OCR recogniser (`--recogniser`),
  to see whether the APK path reads the plans the desktop path refused.

Next action: read rec1; then the four failed plans; then balconies (Willa Maja, Bratki), canopies/posts, dormers, wings.
