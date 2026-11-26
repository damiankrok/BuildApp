# v3.54.21 — hand-off

## What stands

- Frozen before the fresh trial: `4c1d1a2`. Final code (post-trial fixes found by NEW-H, DEV from then on): `5d5ea2c`; the host defect fix (a refusal by the books answers BUDGET): `174e093`.
  APK 1354 (`7580a8f`). Report `stage-reports/SOURCE_TO_MODEL_V35421.md`, owner note `stage-reports/README_V35421.md`,
  ADR `docs/ADR-V35421-ROOF-SYSTEM-AND-ORIGINALS.md`, protocol `PROTOCOL.md` (here), NEW-H references `references/`.
- One roof system per house: `@buildapp/reconstruction` `v2/roof-system.ts` (`solveRoofSystem`, regions → planes, edges,
  walls under planes), used by the API body builder (`consult/massing`) and available to LOCAL; LOCAL's main body gets
  a flat plate when no pitched roof is evidenced (`v2/reconstruct-v2.ts`, `v2/emit.ts`).
- `form-read/3`: original pictures chosen from the package (one elevation per side, plan, section, ≤ 3 perspectives),
  separate roofs with their own numbers and joins; `form-read/2` answers replay with their own pictures.
- Every bound property has a fate; readback 1.1.x of every bound number and join; the feature trace (omission report)
  per run; the review sees originals + perspectives + model views and its verdicts on measured elements stay open.
- Results: audit counter-trial (Amber, Mindelo, Amarylis valleys — Amarylis's second cross gable lost in binding; Eliza no 72°; Ametyst not rotated; Skagen abutment
  kept; Aletta unchanged). NEW-H (5 houses, 4 publishers, after the freeze): F@B closer 2, B 1, ties 2; first results
  kept; post-trial DEV fixes for Anna II, Debora, Lyon.

## Open, named (in order of what the OWNER sees)

1. A source body does not carry LOCAL's interior or facade openings (Anna II: interior walls 26 → 17, exterior openings
   39 → 9; interior doors 6 → 8).
2. Recesses, terraces, balconies, porches, canopies: `NO_CONSUMER` (88 rows of the omission trace).
3. Cross gables over a LOCAL body have no consumer (Osika's porticos).
4. A side from the read is not checked against the windows the plan draws on every wall (Osika's right windows).
5. Lyon's parapet: the plate sits at the wall head (5.6 m) where the section reads 6.56 m.
6. Compiler wall-top band where a plane vertex falls inside a wall section; attached-body pocket walls under a plate.
7. Chimney / roof-window counts from the read are witnesses only (9 houses disagree).

## Code map (what this stage added or changed)

| Where | What |
|---|---|
| `packages/reconstruction/src/v2/roof-system.ts` | regions, `solveRoofSystem`, edges, kernel pre-check |
| `packages/analysis-service/src/consult/form-read.ts` | `form-read/3`, `answeredBy` (contract, unanswered) |
| `packages/analysis-service/src/consult/structure.ts` | per-property standings (2.0.0) |
| `packages/analysis-service/src/consult/massing/` | regions of a model, `settleRoof`, cross gables, one scale per elevation set |
| `packages/analysis-service/src/consult/consult-analysis.ts` | picture choice, arbitration, weak side labels and one side map, review hold |
| `packages/analysis-service/src/consult/readback.ts` | readback 1.1.x |
| `packages/analysis-service/src/consult/feature-map.ts` | feature map before the model, feature trace |
| `packages/reconstruction/src/v2/{reconstruct-v2,emit}.ts` | main-body flat plate, capped pocket walls |
| `packages/source-metrics/src/specifications.ts` (1.1.0) | roof line anchored, flat fall, inflected forms |

## How to run

- Replay a recorded run at 0 USD: `research/source-to-model/v35419/replay.sh <tree> <house> <url> <recorded dir> <out> <byte cache>`.
- Live: `research/source-to-model/v35419/run-live.sh …`; host end to end: `v35419/host-e2e.mjs`, booked with
  `v35418/book-host.ts`.
- Roof system on recorded hypotheses (seconds): `npx vite-node research/source-to-model/v35421/roof-replay.ts -- <run>`;
  seeded stress through the kernel: `v35421/roof-fuzz.ts`.
- Delivery: `v35421/delivery/{make_delivery,omissions,roof_plan,grader_pack}.py`; seal: `v35421/seal.ts`.
- Recordings of this stage (private, not in Git): NEW-H arms `newh/{B,FB,FB2}`, post-trial `newh-F2`, audit houses on the
  final code `v5`, DEV regression `f1`; each run keeps its structure-read packet, raw answer and agreed structure.

## Budget

Ledger `research/ai-assist/spend-ledger-v35417r3.json`: 56.290453 → **64.693909 USD**; stage **8.403456 USD** (limit 25 USD,
protocol §7a). The OWNER reported about 40 USD on the account when the ledger stood at 60.360809 USD; about 35.7 USD
remain on that basis (the ledger prices requests by list price; the account is the authority).

## Host

Session 2 (`1a00654`): fresh Anna II, repeat of Debora (REUSED, 0 requests, same bytes), Lyon without token (0 requests):
ALL CHECKS PASSED. Session 1 (`5d5ea2c`): fresh Debora completed; Anna II failed at the host ceiling (the defect fixed in
`174e093`). Ceiling check (books already at the ceiling): the job completes with 0 requests. `--first-from` reuses an
earlier fresh run for the repeat check.
