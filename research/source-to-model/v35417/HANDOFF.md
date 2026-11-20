# v3.54.17 — hand-off

**State.** Body/roof operations (BUILD_MASSING, SET_ROOF, SET_OUTLINE) and the witness resolver are in the registry
(1.1.0) and run through the one executor (1.2.0) on the model that stands or on the empty one. Host on `14a34bf`
delivered Alaska's source roof; the trial's first results are kept (`results/host-e2e.json`). Books 28.542857 /
28.854612 USD (0.311755 left under the shared cap; no new pool).

**Decisions to carry.** Tolerances fixed before results: `MASSING_TOLERANCES` (heights agree within 0.35 m or 8 %,
flat below 0.4 m rise, triangle < 0.35 / band > 0.6 width ratio, body ≥ 2 m, wing ≥ 12 % of the outline),
`REGION_BUILDING_SHARE 0.6`, `REGION_BACKGROUND_SHARE 0.25`, proofs ±0.15 m plan / ±0.25 m height. Do not tune them per
house. The vertical scale is the horizontal one (isotropic drawing) until two views agree; orientation is a hypothesis
of its own (TURNED_90 is read, named, never moves a wall).

**Next, in order (named gaps).** 1) Binder plausibility for SET_ROOF (pitch ≤ 75°, eaves within the storey band)
before the command — the host's annex proposal (87°) was caught only by the kernel. 2) Record the consultant's answers
of a failed host job (Aurora-midi-ii could not be replayed). 3) Outlines of ≥ 3 rectangles (Layla). 4) Host delivery of
a model built without LOCAL (a `LinkAnalysisResult` envelope for `ConsultedAnalysis.massing`). 5) A live two-look run to
show `continues`/`resolved`.

**How to rerun at 0 USD.** `run.ts --replay <turns.json> --sketch-replay <sketch-turns.json> --sketch-map <sketches.json>
[--outline-replay <outline-turns.json>]`; Ballina's frozen bytes are `rd/v35414/ballina-cache`. Proofs: `npx vitest run
packages/analysis-service/test/{massing,resolve,plan-outline}-v35417.test.ts`. Gate CPU: `gate-cpu.ts`. Live runs only
one at a time (the ledger now merges on write, but the host books are separate). Recorded answers in the private ZIP.
