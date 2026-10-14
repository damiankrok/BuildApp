# 005Q — recommendation and the 005R / 005S handoff (design, nothing started)

## 1. One measured next bounded step

**A face-correction stage: one exterior wall = one grid line on its outer face (the C1 idea), on top of the shipped
N1a (layout 1.2.0), with the openings re-validated against the moved face — as its own preregistered stage.**

Measured in 005Q (`candidate-comparison.json`, ablation `C1N1a`, 46 development rows, sealed inputs):

| row | baseline (S0) | N1a (shipped, PROD3) | C1N1a (ablation, not adopted) |
| --- | --- | --- | --- |
| dom-w-glogownikach | −8.04 %, 3 PAVED terraces on the wall strips (mostly wall poché; ≈ 2.4 m² is the real entrance-niche floor), 2 recess returns (one is the real garage pier), ring SOURCE_EXACT "18.83 × 8.70" on two inner faces | −8.04 %, 0 terraces, 0 returns (the niche floor and the pier, which the base modelled as a terrace and a return, are now neither built nor named separately), ring SOURCE_DERIVED, east and front outer faces named unresolved | −5.86 % (threshold PASS), east wall on its outer face (19.28 m), 0 terraces, ring SOURCE_DERIVED, front face unresolved — **but the garage door re-bound "300/225" → "360/225" and an east window appears**, with no new evidence |
| dom-w-helikoniach | −18.88 % (west wall a dropped sliver) | unchanged | −12.23 % (west wall restored) — **but a front door read as a 2.52 m window, a 2.01 m west window as a 0.50 m door, a 6.11 m west window as a 1.80 m door, one west window lost, MASS SOURCE_DERIVED → SOURCE_EXACT** |
| every other row | — | unchanged | unchanged |

C1 as measured is therefore **not safe**, independently of the selection rule: it fails G5 alone, and both C1 and
C1N1a fail the preregistration's §4 disqualification clause (opening changes without new evidence,
`gates.disqualification_prediction`). The footprint gain is real; the opening side effects are why the face fix needs
its own stage. What that stage must add:

1. **Openings re-bound only by evidence.** When a face line moves, every opening on that facade must be re-read
   against its callout; a kind or width change with no new reading is a disqualifying change, gated per opening
   (kind, width, callout) — the comparison 005Q's `compare.py` lacked until review round 2.
2. **A per-stretch face for a stepped facade** (glogownikach S: wall 78..438, entrance niche set back 0.47 m at
   438..645, garage piers and door 645..812). One line per side cannot hold it; two lines make a wall-thick cell row that
   emission refuses (WALL_CONSUMED, four independent replays). The niche and the garage pier, which N1a no longer
   reads at all, belong here.
3. **The verdict is not the arbiter.** A footprint inside 6 % with a wall short (C1 on glogownikach), a porch walled in
   (jarzabem, `ADV_LONG`) or a false N wall compensating a false courtyard (akebiach `cfNSGD`) all PASS the frozen
   predicate. Gate per feature: no new built cell in any negative-feature rectangle (G3, which is blind to what a rule
   suppresses — add a lost-feature check), no SOURCE_EXACT ring on an inner face, no unexplained opening change.
4. **Its own fresh blind round** with `TARGET_CLASS_EXERCISED` read from the face-merge record.

Dependency on 005R / 005S: none for this step — it is plan-only. It should precede 005S, whose openings and elevation
anchors register on body faces (`v2/frame.ts:109-157`): a body cut on an inner face shifts every elevation reading on
that facade (observed: N1's first run moved the frame and flipped an opening, Addendum A; C1 re-binds openings).

## 2. Residuals named, not repaired (with the measured evidence)

- **Sliver terraces are a class** (`architecture/exterior-feature-interface.md` §4.2): 17 of 29 production terraces
  are ≤ 0.48 m deep. N1a removes glogownikach's (the only strip that is a whole wall band; part of it is the floor of a
  real 0.47 m entrance niche, which no code models as a niche yet — the per-stretch face of §1 item 1). The known-good
  eoze-legacy-area / -every (outer half of a wall) and cieszyniankach (blank paper) keep theirs: removing them changes
  known-good models (informational N2: 6 rows, 3 of them known-good; its first marcowki run was killed (exit 137),
  re-run unchanged), which needs an OWNER decision on G1.
- **Ring and MASS labels over-claim** (`architecture/wall-face-and-evidence-contract.md` §5.3): `v2/emit.ts:191` labels
  every ring SOURCE_EXACT; only 7 of 40 masses on the 24 completed rows rest on READ statements on both axes; DERIVED
  segment sums and CHAIN_CORRECTED substitutions count as MEASURED in the layout ladder. A fix changes five known-good
  models' labels (geometry untouched): an OWNER decision on G1 for labels, then a stage.
- **The pier family** (krasnokwiatach N/S, akebiach S, jarzabem S, helikoniach N): facades of piers and openings leave
  no long band, so the box stops short. Source-backed only with a junction-aware solid reader, per sub-stretch, with
  vegetation excluded — C2 showed the chain-strip route recovers krasnokwiatach's right strips (garage 17.1 m², living
  room 29.4 m², terrace/porch/planting rejected) but also builds akebiach's planted courtyard, completes A05 wrongly
  and switches jarzabem's copy. Not before the per-feature gate above exists.
- **krasnokwiatach's conflict text** ("something enclosed reaches the N side … fails the attached-room guards") names
  a wall sliver as if it were a judged room (`boundary-completion.ts:588-591`).
- **rarytasy-g2e** (known-good) ships a 55.71 m² "front recess" terrace over open ground.

## 3. 005R — Visual Asset Router & Local Vision Research (future; not started)

Interface needs that 005Q's evidence settles (`architecture/exterior-feature-interface.md`):

- **Where an observation attaches.** The unit is the exterior *stretch* (frame, axis, line, interval, inward sign,
  face type, evidence state), not a boundary body: a body conflates a walled room with the terrace beside it
  (krasnokwiatach's 38.1 m² UNKNOWN body). Host side exists today only on compound facade spans; `BoundaryGap` and
  `AttachedBody` carry none, and the digest projection drops the ids a join needs (`plan-diagnostics.ts:160`).
- **Independence by content lineage**, not asset or frame id: no near-duplicate check exists (byte-identical images
  across assets: 0 of 45 packages; near-identical: unmeasured).
- **Classes 005R must output as proposals only**: technical plan / elevation / section / orthographic render /
  perspective render / real photo / interior / marketing / unknown; FRONT/REAR/LEFT/RIGHT/UNKNOWN with mirror risk;
  COVER_SURFACE vs NO_COVER_OBSERVED; posts, beams, railings, steps. `SemanticProposal` (packages/architecture) has
  homes for most of these but no railing kind; the v2 feature graph has no CANOPY/CARPORT/PERGOLA/ENTRANCE/COLUMN/BEAM
  family. 005M measured 30.9 % confident-wrong for the best small VLM: a proposal never sets a dimension, a face or a
  SOURCE_* status.
- **No-image baseline first**: what plan evidence alone already says (posts, dashed overhead lines, open mouths) per
  stretch, so that every image proposal is measured as a delta over it.

## 4. 005S — Plan–Elevation Registration & Exterior Assembly Emission (future; not started)

- **Prerequisites 005Q found**: production writes no `evidenceSources` / `Evidence.sourceIds` (0 of 24 models), emits no
  Assembly, LinearSolid, Platform or StepRun, and collapses IMAGE_METRIC_REGISTERED and VISUAL_SEMANTIC into one model
  status (`emit.ts:61-64`). An UNKNOWN assembly cannot validate without an evidence source. These are schema-adjacent
  plumbing an authorised stage must add before emission.
- **Face first**: elevations register on body faces; a face correction (C1) must precede elevation anchoring or be
  re-read with it (§1).
- **Metric accuracy** is a derived reading of existing labels (MEASURED = SOURCE_EXACT/CORROBORATED from READ chain
  statements on outer faces; DERIVED = SOURCE_DERIVED; VISUAL_APPROX = IMAGE_METRIC_REGISTERED / VISUAL_SEMANTIC;
  UNRESOLVED) — never a stored field without an authorised schema change; ASSUMED stays separate.
- **Rarytasy** (the OWNER's anchor) is development material with strict variant identity; never mixed across variants,
  never a blind draw (round 12's exclusion list names `dom-w-rarytasach`).
- Regression set to carry: wrong-side window, swapped variants, false pergola roof, porch made into a room
  (jarzabem's 6.22 m porch mouth is OPENING_IN_WALL "77 % spanned by one drawn line" — a paving edge), roof overhang
  mistaken for a wall (glogownikach's dashed overhead line across the niche), false or omitted railings and steps.
