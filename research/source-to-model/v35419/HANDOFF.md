# v3.54.19 — hand-off

## What stands

- Baseline: APK 1351, analysis code `58ff26a` (tree `9ac25b6`). Frozen; every "before" in this stage is that code run
  on the same source bytes.
- Protocol, sets and the pre-registered goal: `PROTOCOL.md`. References written from the sources before a model was
  looked at: `references/NEW-D.md`, `references/NEW-E.md`. First look at NEW-D with the baseline: `FIRST_LOOK_NEW-D.md`.
- Decisions: `docs/ADR-V35419-PLAN-SKELETON.md`. Report: `stage-reports/SOURCE_TO_MODEL_V35419.md`
  (owner's short note: `stage-reports/README_V35419.md`).

## Code map of the stage (`packages/analysis-service/src/consult/`)

| File | What |
|---|---|
| `plan-skeleton.ts` | the plan sheet read inside the outline: wall colour, exterior gaps, partitions, interior doors, objects dropped (`objectsAmong`), the walls' outer line (`outerFaceOutline`) |
| `correct/interior.ts` | the skeleton in the model's frame; `BUILD_INTERIOR`; plan gaps as witnesses |
| `correct/execute.ts` | `ADD_PLAN_OPENING`, door kinds on a plan gap, head cut, end clip, stable ids, `elementExists` |
| `facade-metric.ts` | an elevation's openings as a typed list in metres (prompt `facade-metric/1`) |
| `form-read.ts` | the typed form of the house from all captioned elevations (prompt `form-read/1`): a witness of the body arbitration |
| `site-dimensions.ts` | the building's two printed dimensions on the site plan (prompt `site-dimensions/1`) |
| `massing/massing.ts` | `wingsOf`, the in-line split on the plan's wall, the wing-under-another-roof guard, the fascia line as the wall's top |
| `massing/ops.ts` | the page's building height as the witness of the quarter turn (BUILD_MASSING and `orientationOf`) |
| `consult-analysis.ts` | wiring: `PLAN_SKELETON`, `PLAN_INTERIOR`, `PLAN_GAP_OPENINGS`, arbitration 1.2.0, `OBSERVATION_FATE_TARGETS`, `PLAN_FRAME_OF_MODEL` |

## How to run

All commands from the repository root. The key is read from the host's secret file into the process environment by the
scripts; it is never an argument. Every billed request is booked in the ONE continuing ledger
`research/ai-assist/spend-ledger-v35417r3.json` (ceiling 68.542857 USD) — do not open another.

- One house live, host transport configuration: `research/source-to-model/v35419/run-live.sh <tree> <house> <url> <out> <byte cache>`
- Replay of a recorded run (elevation reads and metric read recorded; `--check-live` for a fresh review; `--site-live`
  for the two small outline-channel reads a recording does not hold): `research/source-to-model/v35419/replay.sh <tree> <house> <url> <recorded dir> <out> <byte cache> [flags]`.
  A replay with no recorded outline read runs with the massing path OFF (no body arbitration) — not a finding about the house.
- The model's ground storey on the publisher's plan: `npx vite-node research/source-to-model/v35419/plan-overlay.ts -- --run <run dir> --cache <byte cache> --out <dir> --name <label>`
- Plan gaps covered by the model's openings: `npx vite-node research/source-to-model/v35419/gap-coverage.ts -- <run dir>...`
- Sketch against typed lists against the plan's gaps: `research/source-to-model/v35419/read-compare.ts` (billed; see its header)
- The typed form of the house against the built model: `research/source-to-model/v35419/form-read.ts` (billed, about 0.014 USD a house)
- Delivery: `delivery/manifest.py <final commit> <final run root> > manifest.json`, then
  `delivery/make_delivery.py manifest.json <out>` (gallery with the interior on the plan), `../v35418/delivery/grader_pack.py`
  (`GRADER_KEYS=baseline1351,final`), `delivery/interior_pack.py`, `../v35418/delivery/pack.py` (`BUILDPLAN_PACK_TOP`).
- Scenes for the phone: `npx vite-node research/source-to-model/v35419/seal.ts -- <model.json> <key>` → pin the printed
  SHA-256 in `packages/mobile-scene/scripts/scenes.ts` (`sealedOwnerModel(key, sha, 'owner-v35419')`).

## Private material (never in Git)

Publisher drawings, byte caches, recorded exchanges and every run directory live under `/home/user/rd/` on the session
host and in the private delivery ZIPs. The repository holds text facts only.

<!-- OPEN -->
