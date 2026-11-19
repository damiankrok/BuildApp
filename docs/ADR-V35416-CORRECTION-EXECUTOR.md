# ADR v3.54.16 — one correction executor on the model that stands

Status: accepted for v3.54.16 (OWNER order after the Council audit of 5d4321c / 24aee28).

## Context

The Council reproduced that the active consultant could see a defect and not change it: the final Ballina host job
had `ISSUE_FOUND → OPENING LEFT → NO_CONSUMER → NO_CHANGE` while `ACCEPTED_NOW` stored the answers. The post-build
check executed only `ROOF_FEATURE` (three dormer kinds). `house/review.ts` and `@buildapp/commands` already had the
wider operations (ADD/REMOVE_OPENING, SET_ELEVATION_SIDE/ROOF/FEATURE/ZONE; cutOpening, placeWindow, placeChimney,
moveFeature, resizeFeature, setProperty, removeFeature), but on another path: `house/review.ts` edits the `house.json`
description (H) and rebuilds the whole house from it, which loses what LOCAL got right (ids, interior, relations,
materials) and has measured worse than LOCAL. Guards compared a candidate with LOCAL (0.30 m per opening, 0.05 m
outline) instead of with the source, so a wrong LOCAL opening could not be corrected.

## Decision

1. **State.** The run's `CanonicalBuildingModel` is the one editable state. No third description is introduced and
   the H document is not used as an intermediate: converting LOCAL to H and back is not lossless. Source observations
   (the reviewer's proposals, the sketches' typed elements) stay outside the model and are bound to it per patch.

2. **Operations.** One versioned registry (`consult/correct/registry.ts`, 1.0.0) declares what may be proposed:
   ASSIGN_VIEW, SET_PARAMETER, ADD/UPDATE/REMOVE_OPENING, ADD/UPDATE_CHIMNEY, SET_FINISH, ROOF_FEATURE. The registry
   generates the reviewer's prompt section and the patch schema; the executor dispatches on the same list. Anything else
   (roof form, outline, balcony, pergola, interior…) is reported as a defect with `UNSUPPORTED`, never offered.
   The vocabulary of `house/review.ts` (ADD_OPENING with the id of a listed opening = correct that opening, SET_ZONE,
   SET_ELEVATION_SIDE) is kept; its consumers are replaced by the ones below.

3. **Consumers (reused, not rewritten).**
   - openings and chimneys: `@buildapp/commands` (`cutOpening` + `placeWindow`/`placeDoor`, `placeChimney`,
     `removeFeature`) — the commands the analyzer itself emits; fill parameters copied from the model's own fills;
   - finishes: `appearance/applyAppearance` (occlusion, openings and obstacles' own materials kept);
   - parameters: `setProperty` with the dependents restated in the same transaction (a level's elevation → the storey
     below's height → its full-height walls);
   - dormers: the reconstruction's roof-feature consumer as before (a rebuild guarded by `compareGeometry`).

4. **Binding.** A proposal names a SOURCE elevation picture (or a sketch's own frame) and a box in its pixels. The
   analyzer's registration of that frame (`facadeAlignment.views[].projection`: px → metres along the side and up) turns
   it into metres; the host is the outermost exterior wall of that side whose span and storey hold it. ASSIGN_VIEW adds
   a registration for an unregistered elevation (axis checked by the eaves row, mirror by the side's own openings).
   The opening's new id is derived from the proposal; an UPDATE keeps the id and the fill id.

5. **Source gate, not LOCAL gate.** `consult/correct/source-gate.ts`: the proposal and the model's element are two
   hypotheses held against the ORIGINAL picture — border steps averaged along each side plus inside/outside contrast,
   scored in standard deviations of same-size boxes on the same wall area of the same picture (z ≥ 2 supported; one
   hypothesis must beat the other by 1). A wrong LOCAL opening can be moved or resized far past 0.30 m when the source
   supports it; a proposal the source does not support is refused even against a model that looks plausible; when the
   picture does not decide, both stay named (NEEDS_EVIDENCE). Fixed before any result; not tuned per house.

6. **Transactions.** `consult/correct/execute.ts`: validate → bind → gate → apply on a copy → compile → measure (the
   built element drawn back into the source picture; exterior joint errors not increased; every object outside the
   transaction's declared dependency set byte for byte the same) → commit or roll back with the reason. Independent
   proposals are independent transactions; proposals sharing a `group` stand or fall together.

7. **Delivery.** The executor's model is delivered through the same analysis run as its base (`AnalysisOptions.patchedModel`,
   applied only when the run rebuilds exactly the executor's base bytes), so compile, assessment, scene and result are
   the product's own; the delivered model's SHA-256 is checked against the executor's. A rebuild of the base (a dormer)
   re-binds the committed proposals in source terms.

8. **Quality apart from completion.** `consult/correct/quality.ts`: REVIEW_COMPLETED is a fact about which revision was
   looked at; SOURCE_VERIFIED_IN_SCOPE / RECOGNIZABLE_PARTIAL / NEEDS_EVIDENCE / UNSUPPORTED_OPERATION /
   NO_IMPROVEMENT / BUDGET_OR_ROUND_LIMIT / NOT_REVIEWED are the quality; CAN_REUSE stays the store's own state. A defect
   closes only when the look at the NEW revision agrees and the source measure does not contradict the built element.

## Derived fields

A patch's metres, host, offset, sill and height are derived from the picture box and the registration and recorded per
patch (`bound.values`); the picture box, frame id and source byte hash are the source record. The model's revision is
the SHA-256 of its serialization (patches and finishes included), not the solver's candidate hash.

## Consequences

- The reviewer's prompt changes (contract 0.3.0, prompt 0.4.0): accepted revisions stored under the old binding are not
  reused (the binding names the registry, executor, gate, sketch-channel and quality versions).
- Opening patches need a registration with heights (sills and heads); a view registered for positions only refuses
  them as NEEDS_EVIDENCE. Chimney tops may use a view anchored at the ridge datum.
- A chimney's depth from one elevation comes from where it meets the roof planes (or a second elevation); otherwise it
  is a recorded DISPLAY_ASSUMPTION.
- The raster form path of the sketches (sketch → PNG → shape reader) is kept for walls and roofs; openings and chimneys
  of a sketch go through the semantic channel and the source gate instead of being guessed again from pixels.
