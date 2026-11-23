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
