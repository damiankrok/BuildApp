# v3.54.16 — hand-off

**State.** Branch `claude/new-session-3kzcgh`; frozen for the trial `fae7624`; final code `f75d205` (host E2E and APK
1347 built from it; later commits are scenes and documents). Report `stage-reports/SOURCE_TO_MODEL_V35416.md`; ADR
`docs/ADR-V35416-CORRECTION-EXECUTOR.md`. Ledger `research/ai-assist/spend-ledger-v35416.json`: 1.00064 USD of the
2.042895 stage pool; books 27.812357 of 28.854612.

**What works now.** One correction executor on the run's canonical model: registry 1.0.0 (ASSIGN_VIEW, SET_PARAMETER,
ADD/UPDATE/REMOVE_OPENING, ADD/UPDATE_CHIMNEY, SET_FINISH, ROOF_FEATURE) → binding through the view registration →
source gate on the original picture (two hypotheses, z over same-size boxes) → transaction with measure, commit or
rollback → delivery through the same analysis run → review of the delivered revision → quality state apart from
completion and reuse. Openings are end to end on the host (7 corrections CLOSED_VERIFIED on Ballina); chimneys work on
recorded answers (Murcja, Bakopy); the rest is proven on controlled data only.

**Open, named.** Roof form, outline/region, balcony, pergola, solar panels, interior: reported UNSUPPORTED, never
executed. Positions-only views refuse opening patches (Alaska; Ballina's rear). The reviewer often names a defect
without an executable proposal (rear sliding door, brick plinth). Houses without dimension lines build no model
(sketches only). Live answers are not deterministic: only an accepted revision is reused. `presentation.test.ts`
"donor coordinate 1.05" and the other 15 known base failures are untouched.

**Decisions to carry.** The source gate's constants (SUPPORT_Z_MIN 2, margin 1, reject below 1) were fixed before
results; do not tune them per house. The strict fallback now also takes "too many optional parameters"; a smaller
patch schema (required + nullable fields) would let strict stay on — measure before changing. The DEV runs and the trial
went non-strict while the host is strict: run one strict DEV job before the next freeze.

**How to rerun at 0 USD.** `run.ts --replay <turns.json> --sketch-replay <sketch-turns.json> --sketch-map
<sketches.json>`; executor proofs: `correct-replay.ts`; recorded answers in the private ZIP (`runs/`). Host: build
`apps/analyzer-api`, then `host-e2e.mjs --commit … --repeat --default <url> <url>` with the key in the environment only.
