# Plan shape families — measured (005A)

Eleven made-up houses (`packages/synthetic-drawings/src/shape-families.ts`), one per plan shape. Each is drawn as
PNG sheets and run through the whole pipeline: package, observations, metric evidence, `reconstructV2` and the
plan resolver. Each runs twice, with the footprint a publisher would print and without one. `matrix.json` holds
the 22 rows (re-measured after the post-implementation Council, resolver 1.2.0). The gate is `packages/reconstruction/test/shape-families.test.ts`.

| family | with published footprint | without |
| --- | --- | --- |
| rectangle, one storey | correct (1 body, 0.0 %) | correct |
| rectangle, two storeys | correct (1 body, 0.0 %) | correct |
| L, wing flush with the front | correct (2 bodies, −1.2 %) | correct |
| L, wing flush with the rear | correct (2 bodies, −1.1 %) | correct |
| T-like, wing centred | correct (2 bodies, −1.9 %) | correct |
| narrow wing (2.4 m) | correct (2 bodies, −1.3 %) | correct |
| the same wing at 4.2 m (post-Council) | correct (2 bodies, −2.1 %) | correct |
| garage beside two storeys (2.6 m door) | refused: `PLAN_NO_MASSES` | refused: `PLAN_NO_MASSES` |
| wide door across a wing (3.2 of 3.6 m) | refused: `PLAN_LAYOUT_REJECTED`; the resolver weighs other readings, and the figure that refused the first is spent | **completes 27.7 % smaller, silently** |
| wide glazing (4.8 m of 9.6 m) | refused: `PLAN_NO_DIMENSION_FRAME` | refused: `PLAN_NO_DIMENSION_FRAME` |
| small copy (20 px/m, ~420 px wide) | stopped by the model's validator: `MODEL_EMISSION_FAILED` (`WALLS_OVERLAP`), a listed defect | the same |

The rule is the Council's lattice: a row may move up and never down.
- Correct rows must stay correct.
- A refusal must be named (a `ReconstructionFailure` code).
- A silently smaller building is allowed only where listed, with its reason.
- **(post-Council)** A run the model's own validator stops (`MODEL_EMISSION_FAILED`) is not a refusal the analyzer
  decided on: it is allowed only where listed (`KNOWN_EMISSION_DEFECTS`), like a silent row.
- **(post-Council)** No row reaches the resolver's acceptance: the resolver runs on two rows and resolves neither.
  The families test the first reading and the refusals, not the resolver's choice. The resolver's choice is
  tested on the copy matrix and the decoy-footprint control.
- The families are drawn at 38 px/m, one copy each (the small copy at 20 px/m). They do not reproduce Council
  G's silent −14.4 % wing variant, or the 4.0–4.4 m wing variants that failed in the chain reading. Those differ
  in more than the wing's width, and have no row.

The single listed row: the 3.2 m door leaves a 0.2 m stub of wall. That is too short to read as a piece of wall,
so no gap is found and the wing floods as outside. With no published footprint, nothing contradicts the smaller
building; with one, it is refused by name. **This row is an open generalization risk, not a pass.**

Resolver axis added this stage (`mouths`, resolver 1.1.0), from brief §13:
- **The case it resolves.** When a wide undrawn gap is found between two real pieces of wall, today's reading takes it as the mouth of a
  pocket (a loggia, a carport). The resolver now also weighs it as an opening in the wall (a garage door, a
  glazed wall). A published footprint that counts the room behind it resolves the reading; see
  `plan-resolution.test.ts`, "a wide mouth".
- **Effect on real evidence.** None: the 36-run plan-copy matrix is identical, model hashes included.

Other findings, recorded rather than fixed here:
- The wide-glazing and 4.0–4.4 m wing variants fail at the chain and scale reading (`PLAN_NO_DIMENSION_FRAME`).
  That is the OCR and chain layer, which the Council left out of this stage.
- The small copy reaches the model and is refused by its `WALLS_OVERLAP` validator. The validator holds;
  the reading is wrong.
- **The silhouette audit misfires on correct buildings.** On the correct two-storey rectangle and the T,
  `STRUCTURE_SILHOUETTE_DISAGREES` says the massing is 3.0–3.7 m off every elevation's outline. That is about
  the roof rise for a ridge along z, and the buildings are right, so the audit misfires. It is `BLOCKING` but
  not a refusal code, so the run continues. The model is correct and the gate status reads REJECTED.
