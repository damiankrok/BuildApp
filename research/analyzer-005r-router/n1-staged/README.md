# N1 as staged (NOT adopted)

The projection-consumer gate exactly as it was measured, with the tests it would ship with, kept for a successor
stage. **Not applied to production**: the preregistered decision rule (`../preregistration.md` §6.1) makes any
failed predicate NO_SAFE_ADOPTION, and P4 and P5 failed as written (see the stage report §F).

- `production-gate-with-tests.patch` — `git apply`-able at base `8d41456`: the gate in `analyze.ts`, the amended
  `mutations-02.test.ts` §2, and the new `projection-gate.test.ts` (also here as a plain file).
- With it applied: `packages/source-analyzer` 52/52 tests, and the gate's 6 mutants all killed
  (`stage-reports/artifacts/analyzer-005r-router/mutations/gate-mutations.json`).
