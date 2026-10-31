# N9-02R — why R5 kept a CONFLICT on a registration the four-axis diagnostic disputed (FIRST_BAD of the contradiction)

Base: `10bdce8` (service 1.4.0, assessment 1.1.0), the N9-02A regression on the eight sealed houses.

## How R5 was computed at the base

1. The solver registers each elevation (`views.ts registerElevations`). On the views it registers it measures the
   residuals `verifyAgainstViews` (`reconstruction/src/v2/verify.ts`). Every check is located by the solver's own
   transform: the column from `pxOf(along)`, the row from `pyOf(y)`. The check then looks for the strongest tone edge
   near the model's prediction (MODEL_ANCHORED).
2. `assessModelDetailed` (`assessment/index.ts`) built the relations FIRST:
   `elevationRelation({ viewAudit, residuals, crossView, … })`. R5 judged every view with `use === 'REGISTERED'` that was
   in `crossView.views`, from those residuals alone:
   - CONFLICT: at least 2 features outside tolerance, and at least a third of the observed checks;
   - PASS: every observed check within tolerance;
   - UNCHECKED: otherwise.
3. Only AFTER that did it compute `elevationRegistrationOf(input)`, the N9-02A four axes. From them it attached a
   summary `axes` to each R5 item, as a label. **No R5 status read the axes.** The diagnostic could dispute the very
   transform the residuals were measured in, and R5 still counted those residuals as evidence about the model.
4. `sourceUncheckedOf` took each view's axes from the solver's `use` (`REGISTERED → along FULL, height FULL`), not from
   the adjudication. It skipped every view whose R5 item was not UNCHECKED, so a disputed view with an R5 CONFLICT did
   not appear in the budget at all.

## Contradictory frames at the base (N9-02A regression)

| house | view | R5 at the base | four axes at the base | what the R5 status rested on |
|---|---|---|---|---|
| Trytomach | FRONT …7b061554b1 | **CONFLICT** ELEVATION_DISAGREES (4 of 7 outside: ROOF_EDGE −0.60/−0.58/−0.46 m, SILHOUETTE_WIDTH +0.33 m) | UNREGISTERED. ALONG contested: solver 0.016046 m/px against the view's band 0.014677 and the opposite view's 0.014694 (8.5 %). VERTICAL not stated | Heights and a width measured in a transform whose scale two independent band readings contradict by 8.5 % |
| Rarytasy | LEFT …1417866f23 | **CONFLICT** (sill −0.68, head −0.39, width +0.18) | ALONG_ONLY. VERTICAL UNCHECKED: the solver's own check put its ground off the house's other views (opening heights REFUSED) | Heights in a vertical frame the solver itself refused |
| Rarytasy | RIGHT …8abaf52877 | **PASS** (ROOF_EDGE, SILHOUETTE_WIDTH) | ALONG_ONLY. VERTICAL UNCHECKED (same refusal) | A roof-edge height in a refused vertical frame, plus a width that is the registration itself |
| Sasanki | FRONT …a66bd73cb2 | **CONFLICT** (8 of 11: ROOF_EDGE, BAND_TOP/SOFFIT) | ALONG_ONLY. VERTICAL UNCHECKED (same refusal) | Heights in a refused vertical frame |
| Sasanki | REAR …e411b09da9 | **CONFLICT** (8 of 18: ROOF_EDGE, OPENING_SILL/HEAD) | ALONG_ONLY. VERTICAL UNCHECKED (same refusal) | Heights in a refused vertical frame |
| Jarzmianki (A01) | LEFT …7854cc828b | UNCHECKED DISAGREEMENT_NOT_STABLE (1 of 4 outside) | ALONG_ONLY. VERTICAL UNCHECKED (same refusal) | No status contradiction, but the heights were counted |

On every solver-registered view the `SILHOUETTE_WIDTH` check is **circular**:
- The view was registered by setting its wall-band ends to the plan's walled span.
- The model's width is that span (plus returns).
- So the check tests the registration, not the model. It was counted as a model check.

The remaining views had no contradiction. Their R5 status rested only on views the four axes call FULL:
- Marcówki: 4 views.
- Arganiach: FRONT and REAR.
- Rarytasy: FRONT and REAR.

Every other elevation was already UNCHECKED in R5 (not solver-registered).

## The correction (N9-02R)

- `elevationRegistration` is computed first. Its adjudication (`validityOf`) gives each view `along` and `vertical` as
  VALID, SPAN_ONLY, DISPUTED or UNAVAILABLE, plus `hand`. A DISPUTED axis carries the contradicting measurement:
  - SOLVER_REGISTRATION_CONTESTED;
  - OPPOSITE_VIEWS_DISAGREE;
  - OFF_SHEET_SCALE;
  - GROUND_OFF;
  - SOLVER_REFUSED_LOW_HEIGHTS.
- R5 (`elevationRelation`, given `adjudication`) declares, per check, the axes it needs (`checkValidity`):
  - Heights (sill, head, roof edge, fascia band, verge) need ALONG and VERTICAL.
  - A position along the facade (a return face) needs ALONG, with a VERTICAL that is not disputed.
  - The width is CIRCULAR on a span-registered view.
  - Only VALID checks count.
- If a needed axis is DISPUTED and nothing valid remains, the item is `UNCHECKED / REGISTRATION_DISPUTED`. It keeps:
  - the raw residuals (`checks[]`, `measured.raw*`);
  - the solver's scale (`solverMpp`);
  - the dispute (`alongDispute` / `verticalDispute`).
- A view whose axes are valid keeps its genuine conflict.
- `sourceUncheckedOf` reads the same adjudication:
  - axes FULL / SPAN_ONLY / DISPUTED / NONE;
  - extent NONE where R5 executed nothing.
- The scorecard counts, per view:
  - P: potential slots;
  - E: comparisons executed on valid axes;
  - I: independent comparisons.
