# v3.54.4: hand-off (WORK_IN_PROGRESS; text only; no key, no publisher image)

## Base
- Base commit pinned: `0d4a057ff1ffe5dec07dd04e543ed39a308c4ee1` (delivery of v3.54.3; candidate `aabc044`; solver 2.44.0). Worktree clean at start (2026-11-17).
- Books at start: `/home/user/rd/v3542/books`, 9.963222 USD cumulative, 134 requests, no open reservation. Ceiling 24.11036.
- Master Plan v3.54.4 installed at `docs/MASTER_PLAN.md` (D29–D33).
- Private work dir: `/home/user/rd/v3544/`. Key: `/root/.config/buildplan/campaign-key` (never printed).

## Findings so far (measured on saved bytes)
### Gracja (confirm-dobredomy-gracja-i-mala-ii), LOCAL re-run `/home/user/rd/v3544/A1/gracja` = saved model hash 4d674d44b4cc
- HEIGHT. The section prints +8,13 (ridge), +6,49 (garage ridge), +3,04 (attic floor), ±0,00, −0,30, −0,45, total 858, clear 276 / 270 / 238, pitch 40°.
  The numeric reader read the level marks as "+18,11", "+16,49", "+11.04" (chain-corrected to 12.04): the marker's stroke before the digits is read as a digit 1.
  `reconstruct-v2.ts` ~l.975: top storey height = ridge datum − floor = 18.11 m (one level "Ground" 18.11 m; walls 18.61 m; attached flat roof at 12.04 m).
  The published building height 8.60 m and the printed 858 on the same sheet did not bound it (`topDatumBelowPublishedHeight` only handles a datum BELOW the published height).
  Not a scale, unit, camera or board-fit effect.
- WIDTH/DEPTH. No dimension chain on the colour plan (only 16,82 and 10,12 overall). `PUBLISHED_FOOTPRINT_SCALE`: the walled outline the reader found (a fragment: 3 regions, no garage) was scaled until its area equals the published 144.5 m²: 4.196 cm/px at the 860 px reading, where the printed 16,82 m spans 656 px → 2.564 cm/px. Lengths ×1.636 on a fragment → 12.06 × 13.43 m.
- v3.54.3 report error to correct: "36 % too short" used `metric.cmPerPixel` (1.649, never the built scale). The built scale was 4.196.
- Also: only one storey built (attic plan not stacked: NO_MASS_REACHES_UP), elevations not registered.
### Gracja source facts for the manual spec (px in the 1883×1600 ground plan; 16,82 m ↔ x 335..1770 → 1.1721 cm/px; 10,12 m ↔ y 523..1387)
- garage right, set back at the rear (top y≈653) and flush with the entrance block at the front (y≈1258); kitchen block projects to y≈1387; bay window on the left (x≈340..425, y≈800..1060); living room top wall y≈523 from x≈553 to 1262.
