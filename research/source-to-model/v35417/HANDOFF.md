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

## R2 (audit closure, 2026-11-20)

**Done.** Exchange record at receipt for every job (host `<ANALYZER_DATA_DIR>/consult-exchanges/<jobId>`, runner
`out/exchanges`); research ledger 2.0.0 atomic on the host's file lock; a body built without LOCAL delivered as an
ordinary `LinkAnalysisResult` (controlled host test); element index 1.0.0 in the reviewer's message (contract 0.6.0 /
prompt 0.7.0, registry 1.2.0); orientation and roof measure per body with occlusion (ops 1.1.0) — gaps 1, 2 and 4 of
the list above are closed, gap 5 stays open. Sketch delivery and gallery from retained reads (`r2/`).

**Still open, in order.** 1) Positive §3 path on a real house: analyzer views carry no heights
(VIEW_WITHOUT_HEIGHTS) and sketch-number registration gives AXIS_MISMATCH — register view heights, do not loosen the
gate. 2) Live `continues`/`resolved` (needs ≥ 1.5 USD worst case at host configuration; 0.311755 left). 3) Outlines of
≥ 3 rectangles. 4) Remap sketch openings under TURNED_90 through `sideOf` (now refused by name).

**Rerun at 0 USD.** `npx vite-node research/source-to-model/v35417/r2/index-proof.ts`, `.../r2/sketch-delivery.ts`
(replays retained answers), `/usr/bin/python3 -I .../r2/boards-gallery.py <delivery dir>`; replay a recorded failed job
with `readExchangeRecord(dir)` → `replayModel(..., rec.answers)`.

## R3 (overhang, chimneys, heights behind pots, dimensions — OWNER 2026-11-20, +40 USD cap)

**Done.** Elevations registered from the sketch (eaves or ridge checked, re-derived on the working model); unlabelled
sides decided or left open; SET_ROOF_OVERHANG (verges end by end, eaves capped to clear another body); chimney fusion
across perpendicular views with front/rear twins; roof meet line on parametric roofs; printed overall dimensions
correct the outline; metric-read/5 (`ends` required); sketch prompt 2; reviewer prompt 0.8.0; REMOVE/`absorbs` from
sketches; SET_ROOF keeps partitions and material. Live: Aurora 3 chimneys verified + overhangs; Alaska scale and 2
chimneys; 0.958076 USD spent (books 29.500933 of 68.542857).

**Still open, in order.** 1) Ballina live: orientation check — gable and eaves views disagree by 0.4 m; reading the
gable at its roof's ends was tried on the live turns, changed nothing and was reverted; look at the gable's
registration by the plan. 2) Source gate on
crowded facades (Aurora front, Alaska) leaves window fixes NEEDS_EVIDENCE — do not loosen. 3) Alaska entrance and
terrace doors. 4) Roof material of a body built without LOCAL. 5) ≥ 3 rectangles.

**Rerun at 0 USD.** `run.ts --replay <live>/turns.json --sketch-replay <live>/sketch-turns.json --sketch-map
<live>/sketches.json --check-replay <live>/check-turns.json` on `rd/v35417/r3/live/{aurora-2,alaska-2,ballina-1}`;
boards: `r3/boards-r3.ts` then `r3/boards-r3.py`.
