# N7-COUNCIL-001 — Reviewer A (SOURCE / ROUTING)

Scope: acquisition, variants, dedup, resolution choice, document/storey/annotation/view roles, base-plan copy choice,
elevation sides, frame filtering. Read-only on production code. Harnesses (research only, offline, sealed corpus +
pure functions) are in `/home/user/BuildApp/research/analyzer-n7-council/A/`:

| harness | what it proves |
|---|---|
| `roles-dump.ts` | every asset's sealed roles / variants / selection in the 8 corpus packages |
| `plan-copies.ts` | the 400/550/853 plan assets of one storey are the same drawing; each gets its own metric reading |
| `plan-regs.ts` | per-copy plan registrations, side by side (copies of one drawing disagree on scale) |
| `plan-diag.ts <house>` | which plan frame each storey was read from, storey registration digest |
| `attic-copy.ts <house>` | arganiach: hide each attic copy in turn via `frameFilter` and re-run `reconstructV2` |
| `mutate.ts <house> [muts]` | mutate graph frame roles in memory (swap FRONT/REAR, attic copies as UPPER, drop DIMENSIONED) and re-run `reconstructV2` |
| `roles-hazards.ts` | ARCHON role rules on invented, plausible addresses (no real project) |
| `dump-plans.ts <house> <dir>` | writes plan rasters to a scratch dir OUTSIDE the repo for visual checks (refuses repo paths) |

Run all from repo root with `npx vite-node research/analyzer-n7-council/A/<file> [args]`.
I did not run the full test suite. No production file was changed.

---

## Findings

### A1. The same plan drawing is acquired as 3 to 4 independent assets/frames, and nothing reconciles them — CONFIRMED_DEFECT (missing dedup) / COVERAGE_GAP
- **FIRST_BAD** `packages/source-package/src/acquire.ts:buildAssets`. Copies are grouped only by the adapter's `groupKey`
  (ARCHON `variantStem`, i.e. `__n` ↔ `__n+11000`), the discovery `groupKey`, or byte identity.
  For every ARCHON storey the page carries a 400 px copy (`/related?scope=family`), a 550 px copy (`/carousel_images`),
  an 853 px "dimensioned" copy (`__118xx` through `/product_fancybox_floor/<n>`) and an 853 px area-table copy (`__119xx`).
  All of them have different stems and different bytes, so they become **separate assets**, separate frames and separate
  metric readings. `roles-dump.ts` shows this in all 8 houses. Examples: a01 GROUND has DIM 853, DIM 550, DIM 400 and AREA 853;
  arganiach ATTIC has DIM 853, DIM 550, DIM 400 and AREA 853.
- **Proof they are the same drawing:** visual check (`dump-plans.ts marcowki`: 853 DIM, 853 AREA and 550 DIM show one plan with
  identical chains 1205/790/415). `plan-copies.ts` gives a mean abs grey difference of 1.3 to 3.6 between DIM 853 and AREA 853 in
  6 houses.
- **Current behaviour:** each copy is read on its own, and the copies disagree badly on scale (`plan-regs.ts`):
  - marcowki ATTIC: DIM 853 reads 3.697 cm/px, AREA 853 reads 1.039 cm/px. Same sheet, same size, a 3.6x difference.
  - arganiach ATTIC: DIM 853 reads 0.899 cm/px from 2 anchors (rms 0), AREA 853 reads 1.907, DIM 550 reads 2.188.
    The ground floor reads 2.689. By the 474 cm room chain, the true attic scale is about 2.7.

  No stage compares copies of one storey. `relateAcrossViews` skips every plan-plan pair (`identity.ts:78`). `readPlans` takes
  the first DIMENSIONED copy by size. `plan-resolution` uses the other copies only as a `CROSS_COPY` *corroboration*
  (see A4).
- **Effect (corpus):** arganiach loses its attic. The model has one level of 7.94 m (`r1/arganiach/model.json`). The attic is
  registered at k = 0.333 (`PRINTED_SCALE`) and ends `NO_SUPPORT`. `attic-copy.ts arganiach` shows that hiding any single attic
  copy leaves model hash 34a95a76 unchanged, because the 550 copy is also wrong (k = 0.824). The root scale error belongs to the
  metric layer. The routing defect is that **three readings of one drawing disagree by 2 to 3x and nothing notices**. A
  same-drawing consistency check would mark the attic scale as unreliable, so it would not be used as a "printed scale".
- **Correct behaviour:** recognise copies of one drawing as one logical drawing (same storey and roles, same aspect, and an
  ink-structure match after rescale), keep the largest as the analysed variant, and use the others as a scale consistency check.
  Copies whose scales differ by more than a tolerance should make that storey's scale AMBIGUOUS.
- **Missing test:** none asserts that two plan assets of one storey and one drawing get one scale, or that disagreement is
  reported. `variants.test.ts` tests `groupVariants`, which **no production code calls** (see A7).
- **Repro:** `npx vite-node research/analyzer-n7-council/A/plan-regs.ts`; `npx vite-node research/analyzer-n7-council/A/plan-diag.ts arganiach`.

### A2. Storey mis-assignment silently creates a phantom storey or deletes one — CONFIRMED (mechanism, by mutation); trigger on real ARCHON data is HIGH_RISK
- **FIRST_BAD** `packages/source-package/src/adapters/archon.ts:archonRoleClaims` and `storeyForFloorIndex`, then
  `packages/reconstruction/src/layout.ts:readPlans`.
  - The fragment endpoint claim (`/product_fancybox_floor/<code>/3` → ATTIC, confidence 0.86) beats the slug's
    `"piętro"` → UPPER (0.85).
  - For a house with a *piętro* rather than a *poddasze*, the page copies (550/400) would therefore seal as UPPER, while the 853
    fragment copies (DIM and AREA) seal as ATTIC.
  - `roles-hazards.ts` shows this: page copy UPPER, fragment original ATTIC, area copy ATTIC. `planStoreyOf`/`readPlans` then
    read **three storeys** (GROUND, UPPER, ATTIC) from a two-storey house.
  - `storeyForFloorIndex` maps only 1 → GROUND and 3 → ATTIC. That is an untested assumption for piętro and basement houses:
    `rzut-piwnicy-z-powierzchniami` through fragment `/1` seals GROUND.
- **Effect, proven on the sealed corpus by relabelling the ATTIC copies narrower than 853 px as UPPER**
  (`mutate.ts <house> atticAsUpper`):
  - sasankach3: levels change from `[0+2.8, 2.8+5.72]` to `[0+2.8, 2.8+2.8, 5.6+2.92]`, walls 43 → 66, and both upper storeys are
    `STACKED`.
  - trytomach: levels change from `[0+2.46, 2.46+5.16]` to `[0+2.46, 2.46+0.88, 5.26+2.8]`, a 0.88 m storey, walls 28 → 50.
  - marcowki: collapses to a single 7.95 m level, walls 40 → 24, storeys `NO_SUPPORT`/`AMBIGUOUS`.

  No refusal and no audit flag names a duplicated storey: `viewAudit`, `facadeAlignment` and `crossView` are essentially
  unchanged. Each mass's storey list and storey rects (and so an attached body's storey span) come from these storeys, so this is
  exactly the "storeyRects wrong" class.
- **Correct behaviour:**
  - Two plan storeys whose drawings are the same picture must be one storey. Ties A1 here: with copy identity this cannot happen.
  - The endpoint index must not outrank an explicit storey word.
  - A storey set that is not a contiguous stack named consistently across copies should be a reported conflict, not a model.
- **Missing test:** no test covers a "piętro" house, a basement house, or a conflict between endpoint index and slug.
  `archon.test.ts` covers only indices 1, 3 and 2 (→ UNKNOWN).
- **Repro:** `npx vite-node research/analyzer-n7-council/A/roles-hazards.ts`; `npx vite-node research/analyzer-n7-council/A/mutate.ts sasankach3 none,atticAsUpper`.

### A3. Base-plan copy choice hangs on a 0.55/0.6-confidence channel inference; a missed DIMENSIONED label turns a model into a total refusal — CONFIRMED (by mutation); HIGH_RISK for unseen houses
- **FIRST_BAD** `layout.ts:readPlans` (and `plan-resolution.ts` copies order). Both sort `annotation === 'DIMENSIONED'`
  first and size second. The 853 copy's DIMENSIONED role rests only on `channel` (0.6) and `endpoint` (0.55) inferences.
  ARCHON's dimensioned 853 file has no slug.
- **Mutation** `undimension` (853 DIMENSIONED → UNKNOWN; the 550 copy keeps DIMENSIONED):
  - marcowki **THREW** `METRIC_RESOLUTION_INCONCLUSIVE` ("the floor plan's scale cannot be established …") instead of model 8541ca10.
  - sasankach3 **THREW** the same instead of model 090749f4.
  - trytomach builds a different model (walls 28 → 30, openings 18 → 22) from the 550 copy, with no flag.

  The 853 copies with good registrations (9 anchors, rms 0.019) were available in every case and were not used for the base.
- **Correct behaviour:** rank copies of one drawing by measured evidence (registration anchors and residual, resolution), not by
  a role inferred from the channel. The annotation should be a tie-break among comparable copies.
- **Missing test:** no test where the dimensioned role lands on the smaller copy.
- **Repro:** `npx vite-node research/analyzer-n7-council/A/mutate.ts marcowki undimension`.

### A4. `CROSS_COPY` corroboration counts a copy of the same drawing as an independent witness — HIGH_RISK (reasoned, not reproduced)
- `plan-resolution.ts:scoreReading` adds `CROSS_COPY` when another base-storey copy's wall-ink box, at that copy's own
  registration, matches the reading within 5 %.
- Those copies are the same drawing (A1), with the same printed numbers. Their registrations are fitted on the same chains, so
  the agreement is near-tautological. Where copies disagree (A1), a correct reading loses the bonus.
- `acceptable()` lets a `NEAR` footprint pass with **one** corroboration, so one duplicated drawing can admit a reading.
  This path runs only when the first reading stopped, and no corpus house reached it here.

### A5. Elevation FRONT/REAR labels are trusted without check; a swap is silent — CONFIRMED (by mutation)
- `v2/frame.ts:registerElevationV2` places FRONT at plan z0, which is the plan sheet's bottom (`reconstruct-v2.ts:1084` maps
  min_z → REAR). That "plan bottom = front" convention is never tested against the labelled elevation. Only `SIDE_UNSPECIFIED`
  pairs get `decideSideOrientation` / `decideSidesByOpenings`. `viewAudit` reports `sideBasis: 'LABELLED'` and moves on.
- **Mutation** `swapFR` re-runs to completion with a new hash on every house (marcowki 32000cd3, sasankach3 862ddd0b,
  trytomach e85f4c0d). Every view stays `REGISTERED`/`OPENINGS_ONLY` and nothing refuses. `crossView` and `facadeAlignment` do
  move (marcowki FRONT `MIXED 26/29` → `DISAGREES 5/13`), but the baseline itself already reads `DISAGREES` on sasankach3 and
  trytomach, so that signal cannot tell a swap apart. Effect: sill and head heights and elevation openings attach to the wrong
  facade.
- ARCHON's "frontowa"/"ogrodowa" naming is reliable on the corpus, so on today's data this is a robustness gap, not an
  observed error. For the generic adapter (free text: "przód", "wejściowa", "garden") it is HIGH_RISK.
- **Missing test:** a labelled-swap test that expects a stated conflict.

### A6. ARCHON vocabulary misroutes in edge cases the generic adapter already fixed — CONFIRMED (pure-function harness)
- `archon.ts DOCUMENT_RULES`: `\bplan\b` is ordered before `sytuacj`, so `plan-sytuacyjny-…` seals as **FLOOR_PLAN**.
  The generic vocabulary orders the site-plan rule first.
- `STOREY_RULES`: `\bparter\w*` matches "parterowy" and is first, so `rzut-poddasza-projekt-dom-parterowy` seals **GROUND**.
  The generic vocabulary explicitly excludes "parterowy".
- The slug includes the **project name**, so every asset of a project named e.g. "…z poddaszem" carries an ATTIC 0.92 url-slug
  claim. The ground floor's anonymous fragment original (`/1`, 0.86) then seals **ATTIC**.
- The repro is `roles-hazards.ts` (8 BAD rows; the last row, a URL seen through two channels resolving to AREA_TABLE, is a
  design note, not a defect). No corpus house triggers these. HIGH_RISK for the owner's house only if its slug or name contains
  these words.

### A7. `groupVariants` / `selectionOrder` tests do not test the production grouping — COVERAGE_GAP
- `variants.ts:groupVariants` (role key + aspect, largest wins) is exercised only by `test/variants.test.ts`.
- Production grouping is `acquire.ts:buildAssets`: union-find on keys and bytes, with the reference chosen by channel trust and a
  crop rejected against that reference's aspect. That rule is different and is tested only indirectly.
- Within an asset, selection is correct: the largest decoded raster, on header-probed size, re-checked at decode
  (`decodeImage` SIZE_MISMATCH, `analyze.ts` sealed-size check). All corpus elevations select 1280 px over 550 px, and sections
  select 1138 over 400. **NOT_A_DEFECT** for in-asset resolution choice.

### A8. "Corroborated" printed scale is reported true unconditionally — CONFIRMED (code + corpus), reporting only
- `layout.ts` storey `scaleBasis.corroborated = alignment.basis !== 'SAME_PIXEL_SCALE' || corroborated`. Any `PRINTED_SCALE` or
  `WALL_PAIRS` basis reports `corroborated: true` with no witness.
- arganiach storey 1 shows `basis=PRINTED_SCALE corroborated=true` at k = 0.333. That is the wrong scale from A1, and two 853 px
  sheets of one publisher export suggest k ≈ 1.
- This is a silent failure: the report reads as verified.

### A9. Published rooms are matched to storeys by index, not role — HIGH_RISK
- `reconstruct-v2.ts:1197` builds `storeyLabel` from the index (0 → GROUND, >0 → ATTIC) and also admits `UPPER` rooms.
- `archonPublished` maps a "piętro" table heading to ATTIC.
- With 3 storeys (or the phantom storey of A2), every upper storey receives every upper room. Room numbers restart per storey,
  so `interior.ts` `find(number)` can label a room with the other storey's area.

### NOT_A_DEFECT / checked
- Byte-identical copies are counted once, with a `BYTE_IDENTICAL` failure recorded (5 per house).
- Elevation registration registers one frame per asset (`solve.ts registerElevationFrames` `seenAsset`); elevation variants are
  grouped correctly.
- `SIDE_UNSPECIFIED` is never turned into LEFT/RIGHT at acquisition. The v2 assignment is reported as `FIRST_READING`/`MOVED`,
  never `LABELLED` (`view-audit.ts isSide` excludes it).
- Perspective renders are refused as facades (`readsAsFacade`). UNKNOWN or CHROME document roles are skipped and reported.
- An unlabelled plan beside a GROUND-labelled one is skipped as `STOREY_UNKNOWN` and reported (`planStoreyOf`).

---

## Function inventory (FILE → FUNCTION → INPUT → ASSUMPTIONS → POSSIBLE FAILURE → EFFECT → EXISTING TEST → VERDICT)

| File → function | Input | Assumptions | Possible failure | Effect | Existing test | Verdict |
|---|---|---|---|---|---|---|
| source-package/acquire.ts → `acquireSourcePackage` | URL, adapters, cache | the adapter discovers every copy; budget order by trust | budget cut drops copies (recorded) | fewer copies | acquire.test | OK |
| acquire.ts → `buildAssets` | measured candidates | stem, discovery key or bytes identify one drawing | same drawing at other sizes not grouped (A1) | duplicate frames and readings, unreconciled scales | none for cross-size copies | **DEFECT A1** |
| acquire.ts → `makeAsset` | variants, claims | claims merged across variants | claims from the original's slug (project name) join the asset (A6) | wrong storey | archon.test partially | RISK |
| variants.ts → `selectionOrder`/`selectionReason` | variants | most pixels is best | none observed | — | variants.test | OK |
| variants.ts → `groupVariants` | inputs | — | unused in production | tests prove nothing about production | variants.test | **GAP A7** |
| roles.ts → `mergeRoleClaims` | claims | the highest confidence wins; ties → UNKNOWN | 0.86 endpoint beats 0.85 "piętro" (A2) | ATTIC vs UPPER split | roles.test | RISK |
| roles.ts → `normalizeRoles` | roles | fill NOT_APPLICABLE only when UNKNOWN | a stray storey on an elevation is kept | harmless | roles.test | OK |
| image.ts → `probeImage`/`decodeImage` | bytes | header size = pixel size, cross-checked | — | — | image.test | OK |
| adapters/archon.ts → `archonRoleClaims` | candidate | slug, caption, channel, endpoint | site plan as plan; "parterowy"; project-name words; index map (A2, A6) | wrong document or storey | archon.test (indices 1, 3, 2 only) | **DEFECT A6 / RISK A2** |
| archon.ts → `storeyForFloorIndex` | index | 1 = GROUND, 3 = ATTIC | piętro or basement houses | wrong storey | archon.test | RISK |
| archon.ts → `archonPublished` (rooms) | html | "piętro" heading = ATTIC | conflicts with the plan's UPPER | room matching (A9) | archon.test | RISK |
| adapters/generic/vocabulary.ts → `DOCUMENT_WORDS`/`STOREY_WORDS` | text | first match wins | "rzut dachu" → FLOOR_PLAN with no storey (skipped if GROUND exists) | reported skip | generic.test | OK/minor |
| source-analyzer/analyze.ts → `analyzeSourcePackage` | package | selected variant only; size check | — | — | analyzer tests | OK |
| source-analyzer/identity.ts → `relateAcrossViews` | frames | plan-plan pairs are different storeys | same-storey copies are never compared | A1 unnoticed | — | GAP |
| source-metrics/extract.ts → `DEFAULT_FRAME_FILTER` | frame | all orthographic frames are read | each duplicate read independently | A1 | — | GAP |
| reconstruction/layout.ts → `planStoreyOf`/`groundLabelledAmong` | frame | a role storey is truth | duplicate storey labels → extra storey (A2) | phantom or lost storey | layout tests | RISK |
| layout.ts → `readPlans` | plan frames | DIMENSIONED first, then size; one copy per storey | the weak copy is chosen (A3); two labels for one storey (A2) | refusal or wrong model | thin | **CONFIRMED A2/A3 by mutation** |
| layout.ts → `chooseBasePlan` | readings | score on registration, envelope, bands, ground bonus | — | — | layout tests | OK |
| layout.ts → `storeyIndices` | readings | contiguous ranks | UPPER+ATTIC from one storey → 3 levels | phantom storey | — | RISK (A2) |
| layout.ts → storey `scaleBasis` | alignment | — | corroborated always true for PRINTED_SCALE | misleading report (A8) | — | **DEFECT A8** |
| plan-resolution.ts → copies / `scoreReading` CROSS_COPY | base-storey copies | copies are independent | the same drawing counted as a witness | false acceptance (A4) | — | RISK |
| plan-diagnostics.ts → `planDiagnosticsOf` | draft | — | does not list same-drawing duplicates or scale disagreements | silent A1 | — | GAP |
| solve.ts → `registerElevationFrames` | elevation frames | one per asset | — | — | — | OK |
| v2/frame.ts → `registerElevationV2` | registration, side | FRONT = plan z0 (sheet bottom) | label swap or plan drawn upside down | wrong facade heights (A5) | — | RISK |
| v2/side-orientation.ts → `decideSideOrientation`/`decideSidesByOpenings` | unlabelled side views | symmetric → keep | only SIDE_UNSPECIFIED is checked; FRONT/REAR never | A5 | side tests | GAP |
| v2/view-audit.ts → `viewAudit` | registrations | LABELLED = trusted | — | — | — | OK (report) |
| reconstruct-v2.ts:1197 → room ↔ storey | publishedRooms | index 0 = GROUND, else ATTIC/UPPER | 3 storeys → mixed rooms (A9) | wrong room areas or labels | — | RISK |

## Silent failures
- A1: duplicated plan readings disagree by 2 to 3.6x on scale, and nothing in any report says so.
- A2: an extra or missing storey from conflicting labels yields `STACKED` storeys and a model, with no refusal.
- A5: a FRONT/REAR swap produces a model and only shifts `crossView` verdicts, which are already DISAGREES on several clean houses.
- A8: `corroborated: true` with no corroboration.
- A3: on trytomach, a weaker copy is used without any diagnostic saying a larger registered copy of the same drawing existed.

## Relation to the owner's benchmark
I could not tie the WALLS_OVERLAP at `ring-attached-1-0` to a routing error from evidence. My scope's plausible contributors:
- A2 or A1: a wrong storey set or scale gives an attached body a wrong storey span or storey rects.
- A3: a weaker copy is used as the base plan.

A cheap check on the owner's run is the plan diagnostics (`planDiagnostics.plans`): do the read storeys equal the publisher's
storeys, is the base copy the largest registered copy, and do the registrations of same-storey copies agree?

## Top 3 by impact
1. **A1 (same-drawing copies not deduplicated or reconciled):** wrong scale/dimensions and a lost storey (arganiach is
   observed today as a single 7.94 m level). It feeds wrong body/storey count and wrong storey rects.
2. **A2 (storey label conflict across copies → phantom or lost storey):** wrong body/storey count. Proven by mutation on 3 houses:
   +1 storey, a 0.88 m storey, or a collapse to 1 level, all silent.
3. **A3 (base copy chosen by a weak annotation inference):** total model refusal (marcowki and sasankach3 throw
   `METRIC_RESOLUTION_INCONCLUSIVE` when DIMENSIONED lands on the 550 copy), or a silently different model.

Next: A5 (elevation mismatch, silent) and A8 (misleading report).
