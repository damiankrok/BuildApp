# 005K council — Reviewer D (Android, tests, CI, release)

**Verdict: CHANGES REQUESTED.** There is one blocking finding (D1), and it takes a one-line fix plus a CI run on the final SHA. The Phase-0 fix, the packaging and "no OWNER APK" hold. All numbers below were recomputed from git, the artifacts or the GitHub API (read-only).

## D1 — P0: HEAD 591197d fails a required test and has never been through CI

- **The failing file.** `stage-reports/artifacts/analyzer-005k/gap-set-draw-ledger.ndjson` was added in 70aa0a4.
- **The failing check.** The 005K allowlist in `tests/architecture/research-isolation.test.ts:180` is `/\.(py|ts|mjs|cjs|json|md|txt|sh)$/i`, and it does not match `.ndjson` (checked in node: `false`). The Core job's `npm test` includes `tests/architecture/**` (`vitest.config.ts:17`, `buildapp-ci.yml:66-69`), so Core would be red.
- **No CI run exists for 70aa0a4..591197d.** CI runs on push only for `main`, `claude/**` and `orchestrator/**`, which does not include `analyzer/gap-evidence-drawn-gap-v1`. `claude/new-session-3kzcgh` stops at 892853e.
- **The rest of the check passes.** I re-ran its content checks on all 32 tracked 005K files (base64 and image signatures, numeric arrays of 64 or more, the 4 MiB limit). Only the extension fails.
- **Fix.**
  1. Add `ndjson` to the 005K allowlist. Do not rename a sealed artifact; the content checks still apply to it.
  2. Push the closing SHA to a branch that triggers CI.
  3. Cite that run's ID as proof that the full required CI is green. Run 184 proves the freeze commit, not the stage head.

## D2 — P1: production work started before the Phase-0 gate was green

From `git log --date=iso` and the GitHub API:

| event | time (UTC) |
| --- | --- |
| run 183 created (head_sha b747440) | 21:20:28 |
| **c244ff7 committed (production change)** | **21:45:37** |
| d653b1b committed (freeze protocol) | 21:52:35 |
| cdcd490 committed | 22:10:10 |
| UI gate (job 112507417185) green | 22:15:11 |
| push; run 184 created | 22:16:53 |

Brief §6 requires the gate to be green "before analyzer production changes". The preflight's sentence "committed after this commit and pushed only after this gate was green" is true, but it hides that the change was committed about 30 minutes before the gate was green.

The damage is limited:
- run 183 tested b747440 alone, so the gate evidence is not contaminated;
- nothing was pushed early, so the BLOCKED stop could still have been enforced.

**Fix:** declare this as deviation D2, with these timestamps, in the stage report and in PROJECT_STATUS.

## D3 — P2: the Phase-0 fix is sound; one narrow window remains

**What holds:**
- `apps/android/app/src/main` is unchanged from 1314df7 to 591197d;
- no sleep was added, and no assertion was removed;
- the two slice clicks are now stricter;
- the waits use the existing `NODE_TIMEOUT_MS = 10_000`.

**`awaitExactlyOne` is safe on the instrumentation thread.** It counts through `fetchSemanticsNodes`, the same pattern as `awaitNode`, and never calls `printToString`. It rethrows a timeout as an `AssertionError` with its cause.

**The remaining window.** After the wait, `onNode(m).performClick()` still goes through `fetchOneOrThrow`. If the count changes between the wait and the click, the off-thread diagnostic can still be reached. The window is much narrower, but not closed.

**`stageList()` edge cases** all fail loudly rather than clicking the wrong node:
- **Every stage in progress.** Impossible: `ConstructionProgress.kt:144` allows at most one stage IN_PROGRESS.
- **Empty list, or only the in-progress row composed.** The `LazyColumn` (`StagesScreen.kt:145`) composes only visible items, so the test fails with "found 0".
- **Timeline strip expanded.** The strip (`TimelineRail.kt:252-289`) prints the same status words on clickable stops, so the test fails with "found 2".

No current flow reaches these cases: the rail is collapsed by default (`HouseWorkspace.kt:164`), and `openStage` runs only before any stage is in progress. Document them in the KDoc.

## D4 — P2: ProductFlowDeviceTest still has the same kind of race

It runs twice in the gate (`run-ui-evidence.sh:87,91`). It still uses:
- `list() = onAllNodes(hasScrollAction()).onFirst()` (`ProductFlowDeviceTest.kt:308`, used at `:130` and `:138`), the very pattern the `stageList()` docstring rejects;
- bare clicks at `:124`, `:127`, `:131` and `:139`.

**Fix:** move it to `stageList()` and `clickExactlyOne` in the next change to the harness, or state the risk in the report.

## D5 — P2: two green runs are weak evidence

UI-gate attempts in completed runs since run 160:
- **before the fix:** 8 green and 2 red (both red in run 181), about 0.2 failures per attempt;
- **after the fix:** runs 183 and 184, both green on the first attempt.

With no change at all, two greens in a row would happen with probability 0.8² = 0.64. Keep counting later runs as samples.

## D6 — P2: CI coverage

**Run 184 on 892853e:** 41 jobs, 39 success and 2 skipped by design (the direct-APK jobs, which run only on dispatch), first attempt.

**Covered:**
- typecheck, plus unit and architecture tests, including the gap-evidence and isolation tests;
- 17 development houses, plus the second and third house;
- the Evidence Pack job;
- Node 18 parity, the external recogniser and the APK;
- the emulator, where the live Marcówki modelHash `6152770f…` equals run 183;
- 3D, Playwright and the UI gate.

**Not in CI:** the 192-shuffle order invariance and the rule-ON development matrix. They are research artifacts only.

**Older issue:** in runs 183 and 184 the emulator dies during the advisory shell-screens step. The job stays green.

## D7 — P2: packaging and isolation hold

**What the stage does not touch:** the manifest, gradle, package.json and the workflows. The new production imports are hashing and types only: no network and no fs.

**The rule cannot be reached from the product:**
- no app names `drawnGapRule` (`gap-evidence.test.ts:113`);
- `local.ts:76-93` and `executor.ts:35-48` pass fixed options;
- the rule defaults to OFF (`plan-decomposition.ts:2810`).

**Research assets:** crops stay outside the worktree.

**APK size:** the zipped APK artifact grew by +11,906 B (160,728,985 → 160,740,891) between runs 183 and 184.

**The missing guard:** the 005K block lacks the "Android packages nothing from 005K" check that the 005I and 005J blocks have. **Fix:** add it for symmetry.

## D8 — P2: the performance conclusions hold; the Evidence Pack delta is estimated, not measured

**Recomputed:**
- **Solver time.** The medians of 6 match the `all` arrays. Summed: 19,550 / 19,572 / 19,852 ms (pre-005K / OFF / ON), which is **+0.11 % OFF** and **+1.54 % ON**.
- **Records.** 20.707 ms / 105 = 0.197 ms a record; 181,459 B / 105 = 1,728 B a record.
- **Peak RSS (MB, two passes).** pre-005K 699 / 714; OFF 672 / 705; ON 721 / 703.

**The method is sound:** the files are swapped in place and the tree is checked clean before and after, with separate processes and medians of 6.

**Weaknesses:**
- **Fixed order.** OFF → ON → pre-005K in every pass, so any drift is mixed into the comparison.
- **`|| true` on the pre-005K pass.** It would hide a failure there.
- **Per-row noise is larger than stated.** Cyklamenach shows +7.3 % ON with an unchanged result, so "±5 %" understates it, and zurawkach's +8 % cannot be told apart from noise.

"No measurable cost" is supported; "+0.1 %" is not a precise figure.

**Emulator cross-check (single samples, run 183 → 184):** live Marcówki 238.0 → 224.7 s and 960 → 947 MiB peak; second house 226.7 → 210.2 s and 974 → 1010 MiB.

**The Evidence Pack delta.** `digestBytes` (`perf.ts:93`) measures the top-level records only. The pack's 12b file is bigger:
- it nests each record three levels deeper (6 more spaces per line);
- it adds a `key` to every gap and a wrapper per copy;
- it covers every copy;
- BOUNDARY_GAPS adds timeline events.

So 1.7 KB a record is a lower bound. **Fix:** measure it with `buildEvidencePack`, or label it "estimated, lower bound".

## D9 — No OWNER APK is correct

- The rule is OFF, and the OFF model hash equals the pre-005K hash on all six rows.
- The hashes from the device did not change between runs 183 and 184.
- The OWNER APK job runs only on dispatch.

Note in the report that the next OWNER APK will carry the observational records of boundary evidence 1.2.0 and Evidence Pack 1.2.0.
