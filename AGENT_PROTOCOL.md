# BuildPlan — engineering protocol

This operational protocol replaces the BUILDAPP-00 bounded-stage procedure when
applied with the post-audit OWNER brief. It does not redefine the product roadmap.

## 1. Establish the current task

Read the files named by `CLAUDE.md`. Record the branch, starting commit, task
mode (bounded slice or campaign), acceptance scope and actual runtime capabilities.
If HEAD changed since the brief, reconcile the affected diff; do not reset work
or repeat the entire audit. Preserve unrelated working-tree changes.

Product requirements live in `APP_SPEC.md` and the OWNER's current Master Plan;
analyzer semantics in `docs/ANALYZER_CONTRACT.md`; execution facts and the current
NEXT in `PROJECT_STATUS.md`. A report is evidence at its revision, not a new
instruction. Update only facts the work changed, without copying full history.

## 2. Implement a vertical result

Reproduce the first wrong decision. Trace its source, meaning, target, consumer
and final output. Implement the smallest general correction that addresses the
class of error, with positive and opposing cases. Do not stop at a new type,
an observation JSON, a wrapper or a test which never reaches the product path.

Separate behavior-preserving extraction from intentional behavior changes.
For the former compare stable output; for the latter verify source-grounded
changes and regressions. Byte identity is not the success criterion of better
recognition. A correct provenance-only repair may legitimately keep geometry.

Existing tests can encode obsolete strategies. Replace such a test with the
underlying product invariant and record why. Never remove a failing behavior
check merely to get green, lower a gate after seeing failure, or change a
reference answer to match the generated model.

## 3. Check proportionately

During small edits run the cause test and relevant consumer/composition checks.
At a coherent checkpoint run typecheck including affected tests, package and
integration checks, then the relevant build/runtime path. Read actual scripts:
root `npm run build` alone is not proof of every API/local/Android bundle.

Use lockfile-consistent installation only when dependencies/environment need it;
do not reinstall or run unrelated full web e2e after every source edit. UI and
packaging changes require their own verification. Full regression belongs to
the coherent candidate, not each one-line experiment. If a timing test fails
under load, rerun the affected case without load and retain both records.

Before quality comparisons freeze source bytes, references, denominators,
capability profiles and scorer revision. Preserve no-model and UNKNOWN cases.
Inspect every changed property in the impact scope, including additions and
omissions. Report unverified changes; a lower total error count is insufficient.

Baseline failures are recorded by identity, not just count. A slice can be
accepted with unchanged unrelated failures; those failures still prevent claims
of whole-product readiness where they affect acceptance.

## 4. Continue within the authorized scope

For a campaign, continue through the next accepted dependency without requesting
permission again. Do not finish just because a cause is known, tests pass, an APK
was built, or an intermediate report was written. Follow the brief's finish gate.
For a bounded slice, finish when its explicit gate is met and record the next step.

A session/context/time limit requires a reproducible checkpoint, not a claim of
completion. Record: current commit/worktree changes; commands and outcomes;
source/cache identities; accepted/rejected experiments; remaining blocker;
one executable NEXT. Never promise background work after the session ends.

Implementation difficulty is work to resolve. An actual external dependency
(unavailable device, credentials or inaccessible required bytes) is a named
limitation; complete useful independent work and avoid a repeated permission
loop. Do not invent verification when the environment cannot provide it.

## 5. Publish and report the actual result

Follow the current brief's branch/push policy. Present authorization for this
campaign is `claude/new-session-3kzcgh`, commits/push with `[skip ci]`, no merge
or PR. Do not apply these defaults to another repository or overwrite user work.

Use three separate statuses: slice acceptance, campaign/product acceptance and
verification coverage. CHECKPOINT and NOT_VERIFIED are explicit states, not PASS.
Explain the before/after behavior, evidence, validation and material limits.

For a meaningful OWNER test delivery, build the actual APK with a higher unused
versionCode, matching versionName and update signature; record source/bundle
hashes and asset manifest. Last audited delivery is1322, so the next code is at
least1323 and must be checked against intervening deliveries. Do not build an APK
for every diagnostic/doc checkpoint or reuse a delivery number for different bits.

Host tests do not verify the Android UI. Verify live sheet space, exact bytes,
overlays, progress and interaction on a device/emulator when available. Otherwise
keep Android UI NOT_VERIFIED and supply a reproducible device checklist.

Keep publisher/private images and large weights outside Git as required by the
project's asset policy. Save sufficient source/program/model/diagnostic identity
to replay the changed scope, including failures, without using evaluation truth
in runtime. ForgeShape remains read-only; any reuse keeps provenance/licenses.
