# v3.54.20 — hand-off

## What stands

- Delivered code: `108611e` (freeze 3). APK 1353 built from `edd4e46` (scenes). Report `stage-reports/SOURCE_TO_MODEL_V35420.md`.
- One typed structure read per house (`form-read/2`) → `agreeStructure` (AGREED / UNWITNESSED / DISPUTED) →
  `buildStructureOf` → `solveMassing` (`wingOnSide`, `roofByStructure`) and the arbitration (`structureAgainstBody`).
- Readback events on every delivered model: `OPENINGS_READBACK`, `STRUCTURE_READBACK`.
- Results: NEW-G whole 1 → 2 of 4; DEV form 13 → 18 of 20, whole 8 → 9; regressions listed in the report §7 (NOT fixed).

## Code map of the stage (`packages/analysis-service/src/consult/`)

| File | What |
|---|---|
| `form-read.ts` (2.0.0) | the request, the wire format (flat main fields), `parseForm`, `formVerdict` |
| `structure.ts` (1.1.0) | witnesses, standings, `buildStructureOf`, `wallToApex`, `structureAgainstBody` |
| `massing/massing.ts` (1.10.0) | `wingOnSide`, `roofByStructure`, `STOREY_WALLS`, the one-storey rule for secondary bodies |
| `readback.ts` (1.0.0) | `readbackOpenings`, `readbackStructure` |
| `consult-analysis.ts` | `structureOf` memo, sides by the read, arbitration 1.5.0, readback events |
| `correct/execute.ts` (1.11.0) | `clearOfWalls` (chimneys) |
| `plan-skeleton.ts` (1.3.0) | wall colour as a filled stroke along the outline |

## How to run

- Replay a recorded run on a tree at 0 USD (new reads live with `--site-live`):
  `research/source-to-model/v35419/replay.sh <tree> <house> <url> <recorded dir> <out dir> <byte cache>`.
- Live, host transport: `research/source-to-model/v35419/run-live.sh <tree> <house> <url> <out> <cache>`.
- Form of a model and readback counts: `npx vite-node research/source-to-model/v35420/form-facts.ts -- --json=<out> <run dir>...`.
- Would arbitration 1.5.0 change a recorded decision: `npx vite-node research/source-to-model/v35420/arbitration-neutral.ts -- <run dir>...`.
- Tables: `v35420/delivery/{manifest,make_delivery,tables,account}.py`. Host: `v35419/host-e2e.mjs`, booked with `v35418/book-host.ts`.
- A tree checked out elsewhere needs `packages/numeric-recogniser-ort/models/*.onnx` (ignored by Git) — without them
  LOCAL fails in 3 s with INTERNAL_ERROR and no request is made.
- `apps/android/app/build` is a symlink into `/dev/shm`; after a container restart recreate the targets before Gradle.

## Private material (never in Git)

`/home/user/rd/v35420/`: `d4` (DEV final, freeze 2), `d5` (spot replays on freeze 3), `newg/{base,final,final2,fonb2,final3}`,
`L4` (merged recordings), `delivery`, `grade`, `keys`, `host`, `host2`, `apk`, `zips`. `/home/user/gr20/` graders' copies.

## Freezes and samples

| | Commit | Why |
|---|---|---|
| freeze 1 | `024e2b7` | before the NEW-G draw; NEW-G arm F ran on it |
| freeze 2 | `10ce107` | DEV batch on freeze 1 lost openings on four houses (two unbatched changes); graded code |
| freeze 3 | `108611e` | the host kept a wrong LOCAL body; neutral on 28 recorded runs, byte-identical on 5 re-run |

NEW-G = Amber IV, Rockville, Basia i Adam, Dom pod jarząbem 25 — now seen; add their families to
`v35419/trial/seen-families.txt` before any further draw.

## Open, in the order I would take them

1. A body hypothesis that needs two drawing scales for one set of elevations is refuted (Ametyst New rotated).
2. Recesses / porches as outline features with a consumer (Novara, Sakura, Fabia, Medulin fail "useful" on them alone).
3. Cross gables without an outline step as roof elements; until then do not turn a ridge for a part that cannot be built (Amarylis).
4. A targeted second read where a property is DISPUTED or the plan's witness of a side ties (G6).
5. Entrance doors drawn by plan and elevation before the contrast gate (Rockville, Ametyst, G6, Eliza, Juliusz).
6. Chimneys slid inside a wall: keep only where a second view agrees (Alberto, Juliusz, Jarzębina gained a wrong one).
7. Perspective "elevations" (Basia i Adam): no structure read is asked; a read from plan + section + page alone would at least give storeys.

## Not verified

- The APK on a device (`ANDROID_UI_NOT_VERIFIED`).
- Freeze 3 on the 19 final runs not re-run (equality argued from `arbitration-neutral.txt`).
- The storeys rule and the roof-kind change on a held-out house (NEW-G drew none that needs them).
