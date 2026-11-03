# SHAPE-LIVE-01 — PRZED (baseline c6b9a60, solver 2.20.0, service 1.6.0)

Production `runAnalysis` with the content encoder, on the sealed public packages from SOURCE-01 (test-pkgs). Each error
is described against the publisher's own sheets (section, elevations, renders).

## DEV (used for diagnosis)

### D1 — dom w Arletach 3 (E) OZE — attic house, 40° gable
- Source section: ±0.00, attic floor +2.96, eaves +3.34, ridge +8.29, terrain −0.32, garage step −0.15.
- The reader kept only ±0.00, −0.15 and +3.34. The OCR misread +8,29 as "±8,24", +2,96 as "+2146" and −0,32 as
  "−0132", and the gates refused all three, which is correct.
- First wrong decision (`levelsFrom`): the highest datum read is taken for the ridge, so the ridge = +3.34 (the eaves).
- Consequence: roof eave at −0.48 m (eaveOffset −3.28 on the 2.80 level), so the roof is sunk below the walls. The
  attic storey is a 2.80 m box, and the house reads as a flat box with roof slabs.

### D2 — dom w Jabłonkach 22 — attic house, 40° gable with a lower flat-roofed part
- Source section: ±0.00, +2.96, eaves +3.27, ridge +8.26.
- The reader kept ±0.00 and +3.27.
- Same first wrong decision: ridge = +3.27, roof eave −3.31 below the attic level, and the attic is a box.

### D3 — dom Miniaturka 2 (ver. 3) — attic house, 40° gable
- Source section: ±0.00, attic floor +2.85, eaves +2.68, ridge +7.33, terrain −0.32.
- The reader kept ±0.00, +2.85 and −0.32.
- Same first wrong decision: ridge = +2.85 (here the attic FLOOR), roof eave −3.61, and the roof is inverted.

### D4 — Willa Maja (R2) — semi-detached, two full storeys, 22° hip roof
- The section was read correctly (ridge +7.98 printed).
- The main hip roof is built with its ridge along the short (7.8 m) side of a 17.2 × 7.8 m body. The hips then run in
  by 3.9 m from both ends of a 7.8 m ridge, so the roof is a pyramid.
- Eaves at 4.50, while the upper-storey walls rise to 7.98: the walls stand through the roof.

### D5 — dom w Daliach 5 (GE) — gable with an attached garage and a dark entrance frame (garage–gate–canopy)
- Front elevation: a dark frame/canopy over the entrance, the entrance door with timber cladding, a window on the
  left and the garage gate on the right.
- Model:
  - the only front opening is the 3.52 m gate, emitted as a DOOR;
  - the entrance door and the window are missing;
  - the frame is built as two 0.85 m thick "return" walls 0.64 m deep (grey posts) around a recess.
- Relation check: gate PRESENT; entrance canopy NOT modelled as a canopy; posts are walls.

## Failed outright (no model; out of scope for the roof fix)
- Pod Miłorzębem 21 (GB): RECONSTRUCTION_FAILED / PLAN_RESOLUTION_INCONCLUSIVE.
- Modrzewnica 10 (G2E) OZE: RECONSTRUCTION_FAILED / PLAN_NO_DIMENSION_FRAME. This house has the double garage with a
  flat roof and the open canopy on posts, so the garage/canopy relation could not be checked on it.
- Muraje: RECONSTRUCTION_FAILED / PLAN_RESOLUTION_INCONCLUSIVE.

## Acceptable at baseline (controls)
- Azalie 3, Bratki 26 (R2BE).
