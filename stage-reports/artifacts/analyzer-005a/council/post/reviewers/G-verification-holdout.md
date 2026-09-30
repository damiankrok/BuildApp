# Council G — Verification / Holdout Scientist (005A post-review)

## 1. Strongest improvement

Gates now judge **content against a declared truth**, not a hash. `shape-families.test.ts:44-46` scores each family by body count and footprint within 6 %, with and without a published footprint (`:76`) [C]. The matrix shows its silent row, `wide-door-wing|none` at 1 body, −27.7 % (`shape-families/matrix.json`) [M]. The purity registry is now derived from the data (`generalization.test.ts:70-79`, 10 sealed packages) [C/M], so Kosaćce and e-OZE, unguarded in my pre-audit, are covered.

## 2. Largest remaining genericity risk

**A first reading that completes is never questioned** (`reconstruct-v2.ts:226`) [C]. The resolver runs only on failure, so a lost wing ships whenever the gate does not refuse it: no footprint, or under 20 % off. Measured: 7 of 60 transform cells complete as a different building, and Holloway loses its garage at 0.5, 0.6, 0.75 and 1.5× (`image-transforms/README.md`) [M]. That is about a real 550 px copy's density [I].

**No gate catches this:**
- The transform matrix is ungated.
- Shape families run at 38 px/m, plus one 20 px/m row that refuses.
- `KNOWN_SILENT` whitelists the case (`shape-families.test.ts:69-72`), against 08 §4.4, "never a silent wrong footprint" [C].
- Without a published footprint, the holdout's PASS reduces to "completed + storeys". "Mass mismatch" has no defined reference (`holdout/README.md:30-36`) [C].

**Gates weaker than their names:**
- The known-set job skips green when the page fetch fails before the first cache write (`buildapp-ci.yml:799,812`; `cache.ts:36`) [C].
- `| tail -n 3` (`:814`) drops the exit code: GitHub's default `bash -e` has no pipefail. Only the `require` at `:816` keeps a failure loud [C].
- Rasters are loaded by URL, never checked against the sealed `byteHash` (`second-house.ts:81-89`) [C].
- None of the three new jobs is in `owner-preview-release` `needs:` (`:1006`) [C].
- `program.test.ts:198` accepts a cancel landing anywhere up to BUILDING_MODEL, so stage-boundary polling would pass [C].
- The "resolver" cancel test (`telemetry.test.ts:106`) runs LARCHFIELD, which never reaches the resolver (`plan-resolution.test.ts:94-100`) [C/I].
- The silence between ticks is measured but never bounded (`telemetry.test.ts:74-77`) [C].
- `shape-families.test.ts:47-50` counts `MODEL_EMISSION_FAILED` as a named refusal [C].
- The image matrix redefined "equivalent" as bodies plus footprint, so Ashby's lost roof at JPEG q40 counts as equivalent. `after.jsonl` predates 4c07986, which touches its three emission-failure cells [M].

## 3. Possible hidden overfit

**(a) The published footprint is both the selector and the oracle.**
- `acceptable` takes AGREES with zero corroborations (`plan-resolution.ts:399-400`, pinned at `plan-resolution.test.ts:326`) [C].
- WALL_COVERAGE is pixel-level (`plan-resolution.ts:313-326`): it cannot choose a scale, and for a wall-ink extent it is near-tautological [I].
- e-OZE's resolved model rests on one first-read string on one axis, plus footprint agreement: no ISOTROPY, no CROSS_COPY [M].
- G2E with its 550 px copy alone was accepted as NEAR: −17.6 %, 3 bodies against the real 2. It is counted as a success in 16→28/36 (`plan-copy-matrix.md:22`) [M].
- The holdout PASS test, "within 6 %" (`README:30`), is therefore met by construction on the resolver path [I].

**(b) Expectations fitted to today's output.**
- The known-set gate pins `e4c7306f` for Kosaćce with the area copy alone (`buildapp-ci.yml:821`): a 3-body, 171.0 m² reading, not the accepted `5b5ffcf1`. A fix that recovered the right house would fail CI [C/M].
- `plan-resolution.test.ts:247` reproduces e-OZE's configuration digit for digit (720 px, "1601"→"1801", 2.5 cm/px), although `:8` says it carries no real figures [C/M].

**(c) The holdout is deterministic, but only procedurally blind.**
- Deterministic [M]: pool hash `800c2a1e…` as committed, 773 contiguous families, 0 development-family URLs.
- `--no-git-check` (`select.mjs:67`) is not in the README [C].
- The pool hash is compared with an operator-supplied argument, and `--pool` may point outside the tree (`:72-73`) [C].
- The ledger is an untracked append (`:75`) [C].
- `select` is a pure export: any SHA's draw is computable without trace [I].
- README `:20` and `:25` cannot both hold: writing the SHA into a tracked report moves HEAD (a flaw from my own pre-audit §5.5).
- i2 is always the first URL of the alphabetically next family, so only 773 of 3,085 URLs can be drawn second [M].
- 19 families that the development pages link to (202 pool URLs, 6.5 %) are not excluded [M, local gitignored cache].
- The predicates are fixed and seeded with the tree, but three things stay open: "legible" has no threshold, the source codes are not listed (is `PLAN_RESOLUTION_INCONCLUSIVE` one?), and a model the code calls "a partial result until someone confirms it" (`plan-resolution.ts:666`) can PASS.

## 4. One next research item

**Before PRE_HOLDOUT_SHA: a decoy-footprint control.**
- Replay the 12 newly completed matrix rows and the 10 families, solver-only (seconds each), with the footprint withheld and with decoys at ×0.80, 0.88, 1.12 and 1.25. Count decoys that come back RESOLVED/AGREES.
- If that count is not zero, the footprint generates the answer. The PASS predicate must then require a corroboration not derived from the published figure, and a mechanical mass reference.
- It comes first: it decides whether the one-shot holdout can mean anything, and nothing may change after T2.

**Verdict on the implementation decision.** Largely kept: derived purity, metamorphic and order tests, shape families, three known-set rows, three CI jobs, T0.
Departures: a whitelisted silent row, any refusal code accepted, and four 08 §4.4 families missing. Resolver cancel is untested (§10). The known-set rows need a live fetch, although 08 §4.3 said committed evidence.
