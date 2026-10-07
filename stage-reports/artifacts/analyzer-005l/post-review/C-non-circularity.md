# Council Reviewer C — non-circularity / provenance — BUILDPLAN-ANALYZER-005L

Reviewed: `/home/user/work005l/council-wt` @ `4ad69fe` (diff `a70047f..HEAD`). Brief §14, §22 M4, §34 C, §36–§38, §43.

## Verdict: **CHANGES_REQUIRED**

At HEAD, no published fact, expected value, verdict or name changes a storey decision or the emitted per-storey
geometry for a fixed base reading. I checked this statically and by running it, on synthetic fixtures and on five
real development rows. So there is **no P0**.

The gate that is supposed to keep it that way (§14 / M4) is a name match over a narrow scope. Three plausible chooser
leaks pass the entire 005L suite (48/48 tests) and each one does change storeys when it fires (C5L-1, **P1**). That
needs fixing before the freeze. Everything else is P2.

| id | sev | one line |
|---|---|---|
| C5L-1 | **P1** | The non-circularity gate is name-based and scoped to layout.ts. Three published-fact choosers survive all 005L tests and change storeys. |
| C5L-2 | P2 | The frozen-literal gate misses `minBodySpanM` (the SUPPORTS/INCIDENTAL span), transitive defaults, v2 literals and any `.5`-style literal. |
| C5L-3 | P2 | The `HOUSES` name gate misses 11 of the 40 development rows. |
| C5L-4 | P2 | `upperStoreysHoldTheirRooms` counts the ground level as "upper" when a basement level exists, and sums across levels. The calibration artifact it cites is not committed. |
| C5L-5 | P2 | The round-9 stratified reader ignores HTTP status and redirects: a transient error page silently burns a candidate. |
| C5L-6 | P2 | The research picture guards compare the raw `--out` string to `/home/user/BuildApp`; a relative path writes into the repo. |
| C5L-7 | P2 (doc/test) | The inherited footprint veto (005A resolver) re-derives every upper storey. "A published figure cannot move a storey" holds only for a fixed base reading, and no 005L test runs that path. |

---

## C5L-1 (P1): the §14/M4 gate would not catch a plausible published-fact chooser

**Where.** `tests/architecture/storey-support.test.ts:34` (`withoutStrings`), `:39` (`REGISTRATION`), `:41` (`supportSection`),
`:47` (`FORBIDDEN`), `:67` (the options test), `:116–145` (executed decoys). Also `packages/reconstruction/src/structural.ts:60`.

**Why the gate is weaker than it claims.**
1. **Strings are removed before the forbidden-name check.** `FORBIDDEN` is matched against `withoutStrings(code)`, so
   `options['publishedAreas']` or `f.key === 'usable_area'` is invisible to it, even inside `storeySupportOf` or the
   guarded support section.
2. **The layout pass is handed published figures at runtime.** `composeStructuralLayout` calls
   `inferStructuralLayout(options)` with the full `StructuralPassOptions` (structural.ts:60), which includes
   `publishedAreas`, `levels` and `resolution`. The test "the layout pass is never handed a published figure" checks
   only the TypeScript type. `architecture.md §6` repeats the claim ("the layout options carry no published figure").
3. **The scope is narrow.** The forbidden-name check covers nine layout.ts functions and one section. It does not cover:
   - the rest of `inferStructuralLayout` (the storey loop and the `alignPlans` call site);
   - `structural.ts`, which holds `publishedAreas` and edits `storeySpan` after the layout pass;
   - `reconstruct-v2.ts`, which holds `publishedRooms` and `publishedAreas` and builds `storeyRects` / pieces;
   - `plan-resolution.ts`, which holds `publishedAreas` and re-runs the whole layout.
4. **The executed decoys only use fixtures whose upper storey is already `STACKED`** (HOUSE_AND_GARAGE, INSET_REAR). A
   leak guarded by "no body reaches up", "AMBIGUOUS" or "NO_SUPPORT" never fires there. That guard is exactly the
   forbidden "candidate that removes NO_MASS_REACHES_UP".
5. **The stage's own M4 is killed only by the name match.** Its patch literally names `publishedRooms`, which is never
   present at runtime (composeStructuralLayout is not given rooms), so it has no runtime effect.
   `/home/user/work005l/mutations/mutation-results.json` M4 fails only
   "…no registration or support code names a published figure…".

**Probe.** Three temporary patches were applied to a private copy of the worktree, never to the shared one or to
BuildApp, and restored with `cmp`. For each, the four suites the stage's own `mutations.mjs` runs were executed:
`packages/reconstruction/test/{storey-support,storey-emission,layout}.test.ts` and `tests/architecture/storey-support.test.ts`.
Then an effect probe was run.

```ts
// MB — layout.ts, inside the guarded support section (replaces the AMBIGUOUS condition line):
const pa = (options as unknown as Record<string, ReadonlyArray<{ key: string; value: number }> | undefined>)['publishedAreas'] ?? []
const told = pa.some((f) => f.key === 'usable_area' && f.value > 2 * masses.reduce((s, m) => s + ringArea(m.ring), 0))
if (!told && rival && margin <= STOREY_TIE && !(alignment.stated && !rival.c.stated)) {

// MA — structural.ts, right after `const draft = inferStructuralLayout(options)`:
//   if the page's usable_area > 2 × ground and no mass reaches up, extend draft.masses[0] to the upper storey

// MC — reconstruct-v2.ts, right after `const first = rects[0]` (storeyRects block):
const told = (options.publishedRooms ?? []).filter((x) => x.storey !== 'GROUND').reduce((a, x) => a + x.area, 0)
if (told > (first.x1 - first.x0) * (first.z1 - first.z0)) continue   // copy the ground ring upstairs
```

**Observed.**

```
MB: suites exit 0; 48 tests, 0 failed      MA: suites exit 0; 48 tests, 0 failed      MC: suites exit 0; 48 tests, 0 failed
effect, fixture 7 (two equal bodies, an upper plan that fits either) through composeStructuralLayout, usable_area decoy:
  unmutated / decoy : spans [mass-0 0..0]  decision AMBIGUOUS  gate [NO_MASS_REACHES_UP, STOREY_COVERAGE_DISAGREES]
  MB        / decoy : spans [mass-0 0..1]  decision STACKED    gate [STOREY_COVERAGE_DISAGREES]   (first-found placement wins)
  MA        / decoy : spans [mass-0 0..1]  decision AMBIGUOUS  gate [STOREY_COVERAGE_DISAGREES]
effect, INSET_REAR through reconstructV2, an 80 m² upper room list:
  unmutated: level 1 ring [0,0,9.6,5.998]    MC: level 1 ring [0,0,9.6,8.4]   (the ground ring copied upstairs: M6 via the room list)
```

MB alone combines three choosers the brief forbids: the published area, the first alignment candidate, and the
candidate that removes NO_MASS_REACHES_UP. It sits inside the very section the gate guards, and it passes the
frozen-literal check because it uses only the numbers 0 and 2.

**Fix.**
- **Make the boundary structural, not nominal.** Have `composeStructuralLayout` and `plan-resolution` call
  `inferStructuralLayout(layoutOptionsOf(options))`, a copy limited to the `StructuralLayoutOptions` keys. Add an
  executed test that the object `inferStructuralLayout` receives has no `publishedAreas`, `publishedRooms`, `levels`
  or `resolution` key. A spy or Proxy on the options works.
- **Run decoys on decisions that are *not* STACKED.** Use fixture 7, 2b, 13, a NO_SUPPORT case and a NOT_REGISTERED
  case. Feed in `usable_area`, `total_area`, `floor_area`, `building_height` and room lists both above and below the
  upper ring area. Go through `reconstructV2`, not only `composeStructuralLayout`. Add MB/MA/MC to `mutations.mjs` as
  M4b/c/d; they must be KILLED.
- **Extend the static scan** to `structural.ts` after the layout call and to the per-storey block of `reconstruct-v2.ts`.
  Also flag string literals matching `/publish|footprint_area|usable_area|room/` inside the guarded regions, so
  bracket access cannot hide a name.
- **Correct the wording** of `architecture.md §6` and of the options test name.

## C5L-2 (P2): frozen-literal gaps

- `minBodySpanM` (layout.ts:295, `Math.max(1, 2 * wallM + 0.2)`) is **the** SUPPORTS/INCIDENTAL criterion, but it is
  neither in `REGISTRATION` nor value-checked. The same goes for the defaults it relies on transitively:
  `planBodies(wallShare = 0.5)` and `perimeterWallEvidence(closureThreshold = 0.62)`.
- `numbersIn`'s lookbehind `(?<![\w.])` skips a literal written with a leading dot.
- The v2 per-storey literals (`1e-6` copy test, `0.05` / `0.1` piece bands) are not frozen.

**Probe.** Changed `+ 0.2` to `+ 2.2` in `minBodySpanM` and added `&& inter / Math.max(1e-9, area) >= .55` to
`supports` in `storeySupportOf`. Result: `vitest run tests/architecture/storey-support.test.ts -t "drawings only|special cases"`
gives **5 passed / 0 failed**.

**Fix.** Freeze `minBodySpanM` and the callee defaults by value. Match `\.\d+` in `numbersIn`. Extend the gate to the
`storeyRects` block of `reconstruct-v2.ts`.

## C5L-3 (P2): the name gate is incomplete

`HOUSES` (test:49) does not match these development-row slugs:

| Row | Slug |
|---|---|
| A00 | `dom-w-goldstarach-2` |
| A02 | `dom-w-czosnkach-e` |
| A04 | `dom-w-ligolach-m` |
| A05 | `dom-we-wrzosach-ver-2` |
| aster-viii | `asterVIII` (`\baster\b` fails before `V`) |
| D00 | `mars` |
| D01 | `faunIII` |
| D02 | `alex` |
| D03 | `meganIV` |
| D04 | `aiko` |
| D05 | `dobry` |

Production is clean today: the grep over the production diff found no house name, slug or frame id. The gate's list
is hand-typed, though.

**Fix.** Derive the list from `research/analyzer-005l/rows.json` plus the round-9 manifest families. Apply it to every
file the gate scans, not only layout.ts.

## C5L-4 (P2): `upperStoreysHoldTheirRooms` — fair in intent, inconsistent with a basement

`holdout/verdict.mjs:76` defines `upperLevels` as every level after the lowest by index. For a model with a basement,
the ground level therefore counts as "upper". Upper rooms exclude GROUND and BASEMENT (verdict.mjs:78), and the archon
adapter drops `piwnica` rooms and maps `pietro` and `poddasze` both to ATTIC.

**Probe.** Synthetic run directories, with 90 m² of ground rooms and 90 m² of attic rooms:

```
basement + ground 10×10 + attic stub 2×2 : PASS            upperRingM2 104 (ground + stub) vs 90
ground 10×10 + attic stub 2×2            : ALGORITHMIC_FAIL upperRingM2 4 vs 90
```

So for basement houses the predicate is blind to the exact failure it exists to catch. The round-9 stratum counts a
basement fragment (index 0) as a plan storey, so such houses are in scope (żurawkach `[0,1,3]`). The predicate also
sums across levels, so a full first floor hides a stub attic, and it is vacuous when the upper plan's role is UNKNOWN.

**Calibration (recomputed by me).** I ran the predicate on the 40 development rows, old and new, with the current
`verdict.mjs`:
- It flips **one** row: willa-miranda NEW goes PASS→ALGORITHMIC_FAIL, with 12.08 m² of upper ring against 99.51 m² of
  rooms (ratio 0.12). It flips no row to PASS.
- Passing rows sit at ratios 1.27–1.72.
- 0.9 is therefore not knife-edge and not tuned to the development set.
- It is a judge only: nothing in `packages/` or `apps/` imports `holdout/`.

The artifact README round 9 cites as the calibration, `stage-reports/artifacts/analyzer-005l/development-matrix.json`,
is **not committed** at HEAD. The existing matrix, `/home/user/work005l/dev/development-matrix.json` at `2244f48`,
predates the predicate (added in `42cfcd7`) and does not record it.

**Fix (cheap, before the freeze).**
- Define upper as levels above the level that carries the GROUND plan, or v2 index > 0.
- Optionally require each upper level to be non-trivial.
- Commit the calibration table.

## C5L-5 (P2): the round-9 stratified reader does not check the transport

At `holdout/select.mjs:281`, `planStoreysOf = async (url) => archonPlanStoreys(await (await fetch(url)).text(), url)`.
It does not check `res.ok`, the status or `res.redirected`/`res.url`.

**Probe.** `archonPlanStoreys('<html>Service Unavailable</html>', url)` returns `[]`. The candidate is then burned and
its family removed, and the ledger shows `planStoreys: []`, which looks the same as a page that publishes no plans. A
network throw aborts with no ledger line. The draw is therefore deterministic only as long as the transport is.

The rest of the protocol held:
- the seed formula matches the brief;
- the CLI refuses unless HEAD equals the declared SHA and the tree is clean, and the ledger append dirties the tree,
  so a second run is refused;
- with a stub reader, the draw is deterministic;
- no excluded family, and not the unstratified pick's family, is ever read;
- a burned family is never re-read;
- only the project's own fragment indices are read, scripts are stripped, and no geometry is touched.

**Fix.** Throw before any ledger write on a non-200 response or a redirected URL. Record the status and the sha256 of
each body read in the ledger line.

## C5L-6 (P2): research picture guards are path-string compares

`research/analyzer-005l/look.ts:21`, `pair.ts:23` and `storey-trace.ts:39` use `out.startsWith('/home/user/BuildApp')`
on the raw argument. A relative `--out x.png` (the usage runs from the repo root), a worktree or a CI checkout writes
publisher-derived pixels into the repository. `research-isolation.test.ts` pins exactly this weak string. `ci-rows.mjs`
already does it right, with `resolve(x).startsWith(REPO)`.

**Fix.** Use `resolve(out).startsWith(REPO)` and assert that form in the test.

## C5L-7 (P2, documentation/test): the inherited footprint veto re-derives the upper storeys

**Probe.** Solver alone on sealed evidence (`second-house.ts --package --graph --metrics`, OFFLINE). Overlays were
deleted unread. Variants per row: plain; footprint ×1.25; footprint ×0.8; nothing published (facts and rooms `[]`);
rooms GROUND↔ATTIC swapped plus every non-footprint fact ×3.

| row | ×1.25 | ×0.8 | nothing published | rooms swapped, facts ×3 |
|---|---|---|---|---|
| A06 | SAME | FAILED PLAN_RESOLUTION_INCONCLUSIVE | SAME | SAME |
| A07 | FAILED PLAN_LAYOUT_REJECTED | FAILED PLAN_LAYOUT_REJECTED | SAME | SAME |
| D00 | FAILED METRIC_RESOLUTION_INCONCLUSIVE | SAME | SAME | SAME |
| willa-miranda | FAILED BOUNDARY_RESOLUTION_INCONCLUSIVE | **DIFFERENT** | SAME | SAME |
| dom-w-tunbergiach | **DIFFERENT** | FAILED PLAN_RESOLUTION_INCONCLUSIVE | SAME | SAME |

In both DIFFERENT cases the decoy refused the first reading (`FOOTPRINT_AREA_WRONG` → PLAN_LAYOUT_REJECTED). The 005A
resolver then chose another base reading, with the figure SPENT and the choice corroborated by ISOTROPY+CROSS_COPY,
and every upper footprint was re-derived:
- willa-miranda: level 1 went from two pieces to one (`[9.19,0,11.79,2.45]` dropped);
- tunbergiach: the attic region went from 2.5×3.5 m to 3.9×5.5 m.

This is by design — the figure only vetoes — and no 005L storey code reads it. But no 005L test runs this path; the
architecture test uses `composeStructuralLayout`, which never resolves.

**Fix.** State the boundary in `architecture.md §6`. Add an executed test that a resolved run's `storeyRegistrations`
equal those of the chosen reading run with no published figure.

---

## What held

- **Imports and inputs.** layout.ts imports only pixel, metric, observation and common modules (gate-pinned). The
  inputs of `alignPlans`, `storeySupportOf`, `wallsBeyond`, `sameSupport` and the support section are:
  - `PlanReading` (decomposition, wall bands, chain-derived registration, frame roles);
  - base masses;
  - `WorldFrame`.

  `publishedAreas` reaches `inferStructuralLayout` only as an untyped extra key, and HEAD never reads it (grep, plus
  the executed decoys below).
- **Storey roles** are document roles (captions, filenames, floor-fragment endpoints in the adapters).
  `storeyIndices` uses only `STOREY_RANK`. No adapter emits a storey-count fact; I enumerated the fact keys of both
  adapters. `levels` come from section `LEVEL_DATUM`s, which are allowed technical evidence.
- **No success loop chooses storeys.**
  - The resolver ranking (`scoreReading`/`compareReadings`) reads lowest-storey footprints and masses only, never
    `storeySpan`, `storeyRegistrations` or NO_MASS_REACHES_UP.
  - `LAYOUT_REFUSAL_CODES` = {FOOTPRINT_AREA_WRONG, MASS_OVERLAP, NO_MASS, NO_STOREY}; NO_MASS_REACHES_UP is DEGRADING
    and never triggers resolution.
  - `repairFromResiduals` edits only opening sills and heads.
  - The registration rival and AMBIGUOUS logic ranks by wall score with a total order on placement values.
- **Executed decoys, synthetic** (my probe):
  - `composeStructuralLayout` on HOUSE_AND_GARAGE, INSET_REAR and HOUSE_AND_WING_UP with seven variants: footprint
    absent, true, ×1.25, ×0.5; every fact including `usable_area`, `total_area`, `floor_area`, `building_height`,
    `room_count` and a fake `storeys:3`; slugs `willa-miranda` and `dom-w-bratkach-26-r2be`. Storeys, spans,
    registrations, footprints, storey alternatives, conflicts and unresolved were byte-identical in all variants.
  - `reconstructV2` on INSET_REAR and HOUSE_AND_GARAGE with room lists all-GROUND, huge ATTIC, and BASEMENT/UPPER/ROOF,
    plus a dev slug. Levels, rings, slabs, masses, `storeyRects` and spans were identical. Only gate notes
    (FOOTPRINT_AREA_AGREES/NEAR) differed. A falsified footprint gave a refusal, not another storey choice.
- **Executed decoys, real rows.** A06, A07, D00, willa-miranda, tunbergiach: with nothing published, or with rooms
  relabelled and facts ×3, the emitted levels, rings and slabs were byte-identical to plain.
- **Not tuned to A06/A07.** Each new constant was moved to both neighbours: FACADE_WALL_SHARE 0.2/0.3,
  OUTER_WALLS_PER_END 3/5, MIN_WALL_PAIR_SPAN_WALLS 3/5, MAX_WALL_PAIR_SCALE 2/4, STATED_HOLDS_SHARE 0.4/0.6,
  SAME_SCALE_OFFSETS_PER_AXIS 4/8, WALL_PAIR_SCALE_AGREEMENT 0.01/0.03. A06 and A07 emitted geometry was SAME in all 14.
- **No development names in production.** No house name, slug, frame id or region id appears in the production diff.
  `research/` and `holdout/` are never imported by `packages/` or `apps/`.
- **The verdict predicate** is a judge only and not tuned (C5L-4 has the calibration).
- **Round-9 exclusions are complete.** Every ARCHON family of the 40 development rows (34 ARCHON rows) is excluded,
  including all eight fresh 005K A-families; D-rows and alt-marcowki are not ARCHON. I swept all nine on-disk caches
  for linked pool families with the manifest's regexes and with looser ones (escaped slashes, links without the
  m-code): **0 missing**. That includes `/home/user/work005l/ci-cache`, which the manifest's `sources` does not list;
  add it for the record.

Probe code lives outside the repository in
`/tmp/claude-0/-home-user/0a26fa63-8500-448a-ba12-4e55a11b6e2f/scratchpad/c/` (`*.mjs`, `probe-out.json`,
`effect*.json`, `real/real-decoys.json`, `sweep/sweep.json`). The shared worktree was left without any of my files,
and its production sources were never modified.
