# Post-implementation Council (BUILDPLAN-ANALYZER-005A)

The same seven roles as the pre-audit (`../pre/`) reviewed the implementation after the known regression set
was green (brief §37).
- **What they read.** `git diff 7cd8e0c..f1901e9`, the committed artifacts, and the uncommitted after-run
  records. Each reviewer read on their own, and none edited the repository.
- **What each answered.** The four questions, and a verdict on the implementation decision. None of them
  answered "the tests pass": each finding is tagged with how it is known: `[C]` code, `[M]` measured,
  `[I]` inferred.
- The full reviews are in `reviewers/`, and the control four of them asked for is in `decoy-footprint/`.

## The four answers

| | strongest improvement | largest remaining genericity risk | possible hidden overfit | next research item |
| --- | --- | --- | --- | --- |
| **A** source | logical identity: clean and tracked links seal one id and one content hash | an unlabelled plan (`UNKNOWN` storey) is read as the ground floor next to the labelled one | a guess failure is INFO whatever the code; a template canonical could merge two houses | replay Marcówki with the attic's storey claim removed |
| **B** plan/OCR | lattice scales from unedited long readings, and a wall-ink extent: e-OZE 0/9 → 7/9 | one scale per sheet from one vote; corroborations reuse the readings they check | the lattice unit fixture was e-OZE digit for digit; the shut-mouths axis is selected by the answer | the 36-row matrix and the families with the footprint withheld |
| **C** geometry | extent and scale are hypotheses from the drawing, and the corrections cannot vote | the corroborations do not corroborate: WALL_COVERAGE is on every WRONG reading, ISOTROPY is circular for the registration | the CI known set pinned development hashes; the walled-first "some wall" rule | a metamorphic replay on the published figure, absent and ×0.85–1.15 |
| **D** red team | a bounded resolver that keeps its alternatives; the wall-ink extent | acceptance is the published footprint in disguise | axes one per development failure; the 5 % refuted bucket rewards silence; the opening drop is uncapped | the matrix and the families withheld, ×0.9 and ×1.1 |
| **E** runtime | a write-only checkpoint with the cancel poll inside `tick`: silence 77–193 s → 1.8–3.3 s, RSS halved | silent stretches grow with a plan's pixels (the callout preamble had no tick) | ticks placed where the development sheets were slow | the tick gap against raster size |
| **F** model | openings the model cannot take are dropped with a reason; no validator weakened | the validator is asked once, after the resolver commits; the resolver version is in no hash | the lattice fixture; single-anchor lattice scales | make "resolved" reach the phone, and measure it |
| **G** verification | gates judge content against a declared truth; the purity registry is derived | a first reading that completes is never questioned (7 of 60 image cells, silently) | the footprint is both selector and oracle; the holdout was only procedurally blind | a decoy-footprint control before `PRE_HOLDOUT_SHA` |

## Where they agree

Four reviewers (B, C, D, G) found the same thing independently: the published footprint was choosing the
building. They asked for the same control.
- **The control.** `decoy-footprint/`: 288 runs per rule set.
- **The finding.** With a figure scaled ×1.25 or ×0.8, the resolver built a house to match it on two
  development projects of three. With no figure, it accepted a wrong one on labels that are nearly always present.
- **The count.** 27 of 216 decoy cells completed as another building under 1.1.0; 8 under 1.2.0.

## Acted on before the freeze

| finding | who | what changed | where it is tested |
| --- | --- | --- | --- |
| The figure chose the building; the corroborations were not witnesses | B C D G | resolver 1.2.0: WALL_COVERAGE ranks but does not corroborate; ISOTROPY only for a lattice scale; a figure that refused the first reading is spent (veto only) | `plan-resolution.test.ts` (acceptance, spent figure, fresh structural-stop fixture); `decoy-footprint/` |
| Known-set CI pinned development hashes; a fetch failure skipped green; `\| tail` swallowed the exit code; the new jobs were not in the release's `needs` | C G | rows judged by rule (`scripts/known-row.mjs`: bodies, figure not spent, ±6 %, refusal only where allowed and only by name); `set -o pipefail`; only an unreachable publisher is a warning; the three jobs added to `owner-preview-release` | `.github/workflows/buildapp-ci.yml` |
| The lattice fixture was e-OZE transcribed | B C F G | two fresh misreads: width, 560 px, "1372"→"1872"; depth, 480 px, "1296"→"1796" | `plan-resolution.test.ts` "scale readings" |
| The resolver cancel test never reached the resolver | E G | a cancel thrown from the resolver's own progress (stage 1 and stage 2) on a sheet that reaches it; the plan-read test renamed | `plan-resolution.test.ts`; `telemetry.test.ts` |
| A throwing telemetry sink or memory probe could change the result (a dropped asset) | E | the checkpoint catches it, never asks again, and counts it in the phase record | `telemetry.test.ts` "a listener that fails" |
| The callout preamble and the chain steps had no tick | E | ticks after each mask, per component in `findRings`, and between the chain steps (write-only) | the write-only test; the known-set gaps in the performance record |
| A guess failure was INFO whatever the code | A | INFO only for a definite absence (HTTP 404/410, or offline); otherwise `GUESSED_ADDRESS_UNREAD_*`, LIMITING; the package failure records the HTTP status (not hashed) | `warnings.test.ts`; `acquire.test.ts`; `logical-identity.test.ts` |
| "Resolved" never reached the phone; a dropped opening was never LIMITING | D F | every DEGRADING gate reason on the sealed building is a LIMITING `LAYOUT_<code>` warning; `OPENINGS_NOT_BUILT` is LIMITING | `warnings.test.ts` |
| An unlabelled plan was read as the ground floor next to a labelled one | A | it is the ground floor only when no plan is labelled GROUND; otherwise skipped by name (`STOREY_UNKNOWN`), with a MISSING hole. Measured on Marcówki with its attic unlabelled: before, 1 body instead of 2, silent; after, 2 bodies, the hole named | `plan-resolution.test.ts` "an unlabelled plan" (mutation-checked) |
| The resolver version was in no hash | F | a resolved candidate's solver version reads `2.2.0+resolver.1.2.0`; a first reading that held is unchanged byte for byte | `plan-resolution.test.ts` |
| Numbers only in prose | C | the resolution record carries `chosenAreaM2`, `chosenBucket`, `chosenResidualPct`, `chosenMasses`, `chosenCorroborations` and `publishedFigure` | used by `known-row.mjs` |
| Lazy thin strokes were re-mapped on every read above 2200 px, and readers tell treads apart by identity | B | mapped once, then kept | `prepare.test.ts` (mutation-checked) |
| The holdout was only procedurally blind | G | `holdout/README.md`, amendments marked (post); see the note below the table | `tests/architecture/holdout-select.test.ts` |
| Shape families: a claim the rows did not support; emission failures counted as refusals | B G | the header corrected; a 4.2 m wing row (reads correctly); `MODEL_EMISSION_FAILED` allowed only where listed | `shape-families.test.ts`; `../../shape-families/` |

The holdout amendments:
- the SHA goes in the ledger, not a tracked file before the draw;
- the second pick is uniform over the other families;
- no check-skipping flag;
- the pool hash is checked against `pool.meta.json` as well as the operator's argument;
- the 25 families the development pages link to are excluded;
- the predicates are pinned:
  - a resolution needs a non-figure corroboration to PASS;
  - no unbuilt openings;
  - legibility is glyphs 10 px tall or more;
  - `PLAN_RESOLUTION_INCONCLUSIVE` is algorithmic unless the checklist holds;
  - the body count is not assessed.

## Measured, not changed

- **Image transforms re-run at 1.2.0.** All 60 cells are identical: the same model hash or failure code
  (`../../image-transforms/`). Of the 46 "equivalent" cells, 8 differ in roof or openings, which the definition
  does not look at.
- **The copy matrix on the true figure: 28 → 24.** Three of the four rows lost were wrong buildings.
- **A figure 10–12 % low** now gives a named refusal on e-OZE and Marcówki `without-853D`, not the right house.
- **What the figure still decides.** After a structural stop, the figure still chooses among drawing-supported
  readings. 8 decoy completions remain (`decoy-footprint/README.md`).

## Recorded as debt (named, not done in 005A)

- **A first reading that completes is never questioned** (G, C). The silent wide-door row and the 7 silent
  image cells need an independent reference; this stage does not have one.
- **Emission is terminal** (F). No fallback to the next acceptable reading when the model refuses the chosen
  one. The mass-overlap check at acceptance is the gate's 0.5 m² box, not the model's own check.
- **One scale vote per sheet** (B). A per-token page-turn vote; CROSS_COPY against the siblings' own lattice
  hypotheses; ISOTROPY only from READ overall chains. The wide-glazing refusal does not say which of three
  causes fired.
- **Asset URLs and failure targets are still in the content hash** (A). A signed CDN would bring a per-fetch
  nonce back. The `basis` behind a logical name is not persisted. A template canonical could merge two houses
  that have no publisher id.
- **The tick gap against raster size** (E). Measured only on 400–853 px development sheets; the next research
  item. Also: an IO_WAIT heartbeat can hide a hung DNS await, and the render cache has no hit or miss counters.
- **Opening drops are uncapped** (D). They are now LIMITING, and the holdout PASS requires none.
- **Constants D and C listed.** The 5 % refuted-share bucket that rewards silence; the walled-first "some
  wall" exemption; the 24-decomposition budget, beyond which the `mouths` axis is off; deduplication of
  outlines by exact key (C: e-OZE spent three compositions on one building).
- **Evidence status at `emit.ts:177`** (F). It is hard-coded `SOURCE_EXACT`; correcting it needs a version bump.

## Where the Council did not agree

- **The acceptance rule.** B, C and D would take the figure out of acceptance altogether. G would keep it and
  change the holdout predicate instead.
  - **Adopted:** both halves of the narrower version. Honest corroborations plus a spent figure in the
    resolver, and a figure-only resolution cannot PASS the holdout.
  - **Not adopted:** removing AGREES-alone acceptance, which would make e-OZE, the OWNER's own case, a named
    refusal again.
  - **Named consequence:** after a structural stop, the published figure still selects.
- **The opening drop.** F accepts it with its two visible costs; D calls it uncapped. It is LIMITING now, and
  counts against a PASS.
