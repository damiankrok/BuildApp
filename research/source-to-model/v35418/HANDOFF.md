# v3.54.18 — hand-off

**State.** Three-level arbitration is in the consult path (ADR-V35418): source gate 1.3.0 (claims band, displaced band,
wall clip, colour planes), per-property rule (`crossWitness: PLAN_SPAN`), facade adoption, body arbitration 1.1.0 (the
replacing body must be uncontradicted), one facade consumer with or without LOCAL (roof windows, finishes, palette),
observation-fate 1.0.0, wall top = roof underside (ops 1.6.0, massing 1.2.0), executor 1.6.0 (no transaction may leave
an opening the compiler does not cut), one re-ask of an unreadable review. Measured code `bc57767`; the re-ask came
after the measurement (PROTOCOL §9). Books 34.452762 of 68.542857 USD (stage 4.951829; 34.090095 left; no open reservation). APK 1349 from `ba41dbe`
(build directory in RAM: the session's disk allowance is full of earlier stages' deliveries, which were not touched).

**Result to carry.** Pre-registered goal NOT met (useful miniatures: author 2 → 2 of 6, blind grader 1 → 2; blind set
0 → 0 of 3). Blind grader: final closer to the source in 7 of 9, same in 2, worse in none; large openings DEV-K 4/14 →
12/14, NEW-B 8/17 → 11/17, NEW-C 4/14 → 8/14; one NO_MODEL became a model (Sakura; cross-replay confirms the code, not
the read). Scores: `scores/{author.json,grader-blind-result.json,grader-key.json,grader-decoded.json,runs.json}`.

**Do not undo.** (1) Body arbitration must not replace LOCAL by a body the sources contradict (cycle 4 broke Jeziorko).
(2) Gate thresholds (z ≥ 2, margin 1, ≥ 8 null places) were not changed — do not loosen. (3) `ADOPTED_WITH_FACADE` and
`CROSS_WITNESS_PLAN` are never `SOURCE_VERIFIED`. (4) Outline simplification is a named miniature convention — never a
dimension. (5) A drawn wall top is the roof's underside; `eaveOffset` is the top surface.

**Next, in order (named gaps, first loss in the report §12).** 1) Entrance doors on dark / crowded facades: a second
witness from the plan (door symbol in the wall gap), not a lower threshold. 2) LOCAL phantoms the picture "supports"
(Alberto front, gable ribbons): account for the phantom's box by the elements the reading names there. 3) Source body of
two–three wings with their own roofs (Medulin, Mindelo). 4) Hip roofs (`roofPlanes` exist; operation and witness do
not). 5) Carry LOCAL's interior over when the body is replaced. 6) Turn the model to the source's sides under
TURNED_90. 7) Wall base tone on a body built without LOCAL. 8) Reviewer tool schema small enough for strict mode (the
re-ask treats the symptom). 9) Operations for canopies, porches, covered terraces, PV panels.

**Rerun at 0 USD.** `research/source-to-model/v35418/replay.sh <tree> <house> <url> <recorded dir> <out> <byte cache>`
(recorded dirs: `rd/v35417/r3/live/{alaska-2,aurora-2,ballina-1}`, `rd/v35418/base/{alberto,medulin,jeziorko}`,
`rd/v35418/newc/{mindelo,sakura,g6}`; add `--check-live --check-model claude-sonnet-5-5 --outline-live
--geometry-rounds 2` for a live look). Live: `run-live.sh`. Renders: `render.ts --model <model.json> --out <dir> --name
<n>`. Uncut openings: `compile-check.ts <model.json>`. Delivery: `rd/v35418/delivery/manifest.py <commit>` →
`delivery/make_delivery.py <manifest> <out>`. Host: build `apps/analyzer-api`, `host-e2e.mjs`, then `book-host.ts`.
Proofs: `npx vitest run packages/analysis-service/test/{facade-claims-v35418,massing-v35418,massing-v35417,consult-v3542}.test.ts`.

## R2 (2026-11-24) — continuation after APK 1349

**Code.** `massing.ts` 1.3.0 (`profileOver`: outline width for a hollow verge, ridge ends, apex from the polygon's own
corners, a level top ≥ 1 m is a ridge; eaves from the gable-END wall corners; `HIP`: `hipSpecFrom`, `hipPlaneCommands`,
`hipWallTopM`; true median), `ops.ts` 1.7.0 (`specSilhouette` HIP, `bindSetRoof` HIP, BUILD_MASSING hip, HIP proposals
from a trapezoid, orientation: one-sided tolerance between a gable end and an eaves side, a turn needs both axes,
`OrientationHints.entranceSide` → `TURN_BACK`), `registry.ts` 1.6.0, `execute.ts` 1.8.0 (`sideRidgeM` over planes,
`planGapsOf` / `PLAN_GAP` from R2's first commit), `plan-outline.ts` 1.1.0 (`plan-outline/2`: `entrance`),
`source-analyzer/analyze.ts` (a caption-named orthographic elevation the content classifier vetoes keeps its frame).
All in the accepted-revision key (`outline<version>` added).

**Tools.** `diag-massing.ts <run dir>…` re-solves the massing and the orientation on recorded sketches (0 USD): run it
on every recorded house before changing a reading rule. `delivery/manifest_r2.py <commit>` builds the R2 manifest
(`delivered1349` | `r2`); `pack.py` takes `BUILDPLAN_PACK_TOP`; `grader_pack.py` takes `GRADER_KEYS`, `GRADER_SEED`.
The delivery scripts need Python ≥ 3.12 (`/usr/bin/python3`; `/usr/local/bin/python3` is 3.11).

**Runs (private).** `rd/v35418/r2e/{alberto,sakura,ballina,aurora,medulin,jeziorko,mindelo}`, `rd/v35418/r2d/{alaska,g6}`
(final code; recorded elevation reads, live plan read and review). Kept on the way: `r2/*`, `r2b/*` (PLAN_GAP only),
`r2c/*` (intermediate; `r2c/ballina-fail1` = the lower-median failure: LOCAL stood without a roof).

**Open after R2, most valuable first.** 1) The two SIDE elevations under a turn: a caption that says only "side" twice
gives no left/right — LOCAL's `SIDE_LEFT` guess is still carried as a label (Alaska: the reviewer finds the long sides
swapped). The plan must say it (window count per side from the plan read), or the label must be dropped under a turn.
2) G6: the hip is recognised and proposed, the gate cannot decide on LOCAL's body (11.80 × 7.41 m for the printed
11.32 × 8.02 m); no source body because the plan has no scale (one printed dimension read on the ground plan).
3) Multi-wing bodies (Medulin, Mindelo): unchanged. 4) Entrance doors drawn white-on-white under a porch (Alberto:
z 0.39). 5) LOCAL's interior is not carried to a source body (Alberto lost 69 interior walls for a correct roof and
clean elevations). 6) Hip roofs: no roof windows, no overhang correction, one rectangle only (an L under one hip is
its main rectangle). 7) Finishes on a source body are undone by the reviewer as often as kept.
