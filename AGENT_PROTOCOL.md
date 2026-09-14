# BuildApp — agent protocol

> Operational file. Created at the start of STAGE BUILDAPP-00 from the stage
> brief supplied by the external orchestrator.

## Roles

- The **external orchestrator** owns the long-term roadmap, stage ordering and
  strategic decisions. It writes stage briefs.
- The **implementation agent** executes exactly one bounded engineering stage,
  verifies it, documents the actual result, commits and pushes. It is not the
  orchestrator and must not create a master roadmap or master plan.

## Per-stage procedure

1. Read `APP_SPEC.md`, `PROJECT_STATUS.md` and `AGENT_PROTOCOL.md` before
   implementing anything.
2. Study reference material named in the brief. Reference repositories are
   read-only.
3. Work on the branch the brief (or the execution harness) designates. Never
   push to another branch without explicit permission.
4. Implement the stage. Do not silently downgrade requirements to obtain a
   PASS. Do not silently repair invalid data.
5. Run the command gates: `npm install`, `npm run typecheck`, `npm test`,
   `npm run build`, and browser verification (`npm run e2e`) when browser
   automation is available.
6. Update `PROJECT_STATUS.md` with the completed stage, branch, final commit,
   current capabilities, test/build/browser results, known limitations and the
   recommended technical next step. Do not redefine long-term direction there.
7. Write `stage-reports/STAGE_<ID>.md` with measured results: starting and
   final HEAD, branch, architecture, important files, commands run, test /
   typecheck / build / browser results, artefacts, limitations, compromises,
   and one recommended next bounded step.
8. Commit with clear messages and push.
9. Report to the owner in the required final format, ending with
   `PASS_<STAGE>` or `BLOCKED_<STAGE>_<SHORT_REASON>`.

## Failure rule

If an external environmental limitation genuinely blocks completion, complete
every safe useful part, commit it, push it, document the blocker precisely and
return BLOCKED. An implementation difficulty is not an external blocker.

## Architecture rules every stage must keep

- `packages/model`, `packages/commands`, `packages/geometry` never import
  React or Three.js.
- The viewer renders compiled geometry from the CanonicalBuildingModel only.
  UI code never hand-builds building meshes.
- Every semantic object keeps a stable id through save/load.
- Editing a semantic property updates the model first, then recompiles, then
  re-renders. Inspectors never deform Three.js geometry directly.
- New geometry features are added to the compiler on the real production path,
  with measurement-based tests, never as a side experiment.
