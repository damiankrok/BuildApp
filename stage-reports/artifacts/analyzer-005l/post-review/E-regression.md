# BUILDPLAN-ANALYZER-005L — Council Reviewer E (regression / performance / Android)

Code under review: `4ad69fe` (worktree `/home/user/work005l/council-wt`), baseline `a70047f` (`/home/user/work005l/base-wt`).
Brief: §27–§30, §33, §34 E, §40.

## Verdict: **CHANGES_REQUIRED**

One P0 and three P1s. The P0 is on Marcówki, the reference PASS house. Its verdict stays PASS, but its model regresses
against the source in ways the verdict predicates cannot see. The planned re-pin to `8d0b93e9…` would freeze that
regression into CI. Runtime, schema, Evidence Pack, phone bundle and research isolation all hold.

| id | sev | one line |
|---|---|---|
| E5L-1 | **P0** | Marcówki: the upper storey's ring is cut on a walled region whose front and rear sides are not walls (9 % and 13 % wall). The gable walls move 0.91 m and 1.05 m inward, off the drawn walls. The printed 270/320 window is lost, the two printed 234/30x windows lose their callouts (they become 3.50 m and 3.41 m gaps), a phantom 0.62 m exterior door appears upstairs, and the upper portico returns and the garage canopy fascia are lost. Verdict still PASS. |
| E5L-2 | P1 | Marcówki's layout gate goes ACCEPTED → PARTIAL. A rival at 0.039 behind puts the attic over main + garage at scale 1.106, which is DEGRADING `STOREY_COVERAGE_DISAGREES`. In the full CI pipeline this becomes a new user-visible LIMITING warning, `LAYOUT_STOREY_COVERAGE_DISAGREES`. |
| E5L-3 | P1 | willa-miranda (FAIL→FAIL, model moved): the upper plan is placed at scale 1.000 although both plans' own chains state 1.288 (margin 0.002). The upper storey becomes 12.1 m² of walls under a 116.8 m² slab. The attached bay gains a storey, and its flat roof jumps from eave 3.21 m to 6.40 m over a 6.5 m footprint whose storey-1 walls cover only 2.6 m. Reproduced in the CI pipeline. |
| E5L-4 | P1 | The per-storey rectangle is not carried to the roof code. An attached body's flat roof and its front-zone projection still read the whole body and the top storey (`reconstruct-v2.ts:827,857,882`). That is the mechanism behind the floating roof in E5L-3 and the lost canopy in E5L-1. The same holds for the main roof over a smaller upper ring: Marcówki's gable roof now runs 1.9 m and 2.05 m past its gable walls. |
| E5L-5 | P2 | `LAYOUT_INFERENCE_VERSION` 1.1.0 is consumed nowhere. No hash, cache key, provenance record or Evidence-Pack `ANALYZER_VERSIONS` entry carries it, so the bump is a comment. Not bumping `SOLVER_V2_VERSION` is defensible (see below). |
| E5L-6 | P2 | The Evidence Pack records nothing of the decision this stage changed (storey registration, support relations, per-storey footprints). `14-selected-layout.json` covers the base plan only. |
| E5L-7 | P2 | The development matrix says `gitSha 2244f48`, but the snap-band change (42cfcd7) landed after its first batch. The changed rows were re-run before the matrix was written, and I reproduced them at HEAD (see "Determinism"), so the record is right but mislabelled. |
| E5L-8 | P2 | `upperStoreysHoldTheirRooms` sums every upper level, compares gross ring area to 0.9 × net room area, and treats a BASEMENT-lowest model as "ground + attic above". It passed Marcówki's regression (84.15 ≥ 0.9 × 62.44) and tunbergiach's 8.9 m² attic ring (carried by the 117 m² level 1). |

---

## E5L-1 — P0 — Marcówki's upper storey is cut off its own walls

**Where.** `packages/reconstruction/src/layout.ts:1221–1306` (`storeySupportOf`: each support piece is the BUILT region's
bounding rectangle clipped to the body, snapped only within `bandM`). Then `v2/reconstruct-v2.ts:383–401` (`storeyRects`)
and `v2/emit.ts:150–156` (ring polygon = `rectAt`). The opening reader runs on the new planes (`reconstruct-v2.ts:770–778`),
and so do the front-zone recess and returns (`reconstruct-v2.ts:603–606`).

**Scenario.** On the attic plan the BUILT region `region-built-0-0` is px y 238–632.5. The plan's envelope is y 193.5–671.5,
and the ground body is 12.61 m deep. Registered, the region is z 1.05–11.70 m. Its front and rear sides are 0.9–1.05 m
from the body's faces, which is more than `bandM`, so they are not snapped. The emitted storey-1 ring is
z 1.90–12.55 (v2 frame) instead of 0.99–13.60.

**Probe 1 — per-side wall evidence** (`research/council-e/sides.ts`, the decomposition's own `cell.edges[s].wall`
along each outside side of the region):

```
marcowki ATTIC env={"x0":50,"x1":336.5,"y0":193.5,"y1":671.5} wallPx=11
  BUILT region-built-0-0 rect={"x0":50,"y0":238,"x1":336.5,"y1":632.5}
  sides(top,right,bottom,left) = 287px wall 0.09 | 395px wall 1.00 | 287px wall 0.13 | 395px wall 1.00
```

The new gable walls stand on lines the attic plan draws as 9 % and 13 % wall (`wallFraction` 0.627 overall: the two side
walls and almost nothing else).

**Probe 2 — where the source prints the gable windows** (`dev/NEW/marcowki/metric-evidence.json`, OPENING_CALLOUT on
frame `…fed2722c38`, text boxes in attic px):

```
234/303  textBox y 163–189      234/304  textBox y 163–189     (just outside the envelope's top,    y 193.5)
270/320  textBox y 680–706                                     (just outside the envelope's bottom, y 671.5)
```

The callouts sit just outside the envelope's edges, 44.5 px and 39 px outside the region's edges. The old ring, at the
body's faces, read all three, with gap widths of 2.68, 2.31 and 2.31 m against printed 2.70, 2.34 and 2.34.

**The same defect class on the other rows with a per-storey rectangle.** Using the same probe on the upper regions that set
`storeyRects`:
- willa-miranda UPPER `region-built-3-4`: sides at 85 / 54 / **0** / 42 % wall;
- dom-w-tunbergiach ATTIC `region-built-0-0` (the 8.91 m² level-2 ring): **0** / 71 / 100 / 53 %;
- D00 ATTIC `region-built-0-1`: 61 / 87 / **29** / **49** %.

Marcówki's is the clearest case: it is the PASS row, and it is the one with printed callouts to prove where the walls are.
But the cause is generic. A BUILT region's bounding rectangle is taken as the storey's footprint, whatever its sides are
drawn as.

**Observed model movement** (`/home/user/work005k/dev/OFF/marcowki/model.json` against `/home/user/work005l/dev/NEW/marcowki/model.json`;
the same `8d0b93e9` comes out of the full CI pipeline at HEAD, `/home/user/work005l/ci-rows/marcowki`):

| | old `6152770f` | new `8d0b93e9` |
|---|---|---|
| L1 ring | x 0–7.9, z 0.99–13.60 (99.62 m²) | x 0–7.9, z **1.90–12.55** (84.15 m²) |
| L1 exterior walls | 4 ring + 4 returns (front and rear zone, `FOLLOW_ROOF`) | 4 ring, **no returns** |
| L1 front opening | `opening-1-front-4-0` WINDOW 2.70 × 3.20, "printed 270/320" | **none** |
| L1 rear openings | 2 × WINDOW 2.34, "printed 234/304", "234/303" | 2 × WINDOW **3.50 / 3.41**, "no callout read" |
| L1 east wall | — | **DOOR 0.62 m**, "no callout read, not read on an elevation" |
| printed-callout exterior openings | 11 | **8** (the only changed row to lose any; morelach gains 2) |
| `roof-attached-0` (garage) | minZ 0, `edgeMembers.fascia` depth 0.99 over the front recess | minZ **0.99**, **no fascia** |
| layout gate | ACCEPTED | **PARTIAL** (E5L-2) |
| verdict | PASS | PASS (`upperStoreysHoldTheirRooms` 84.15 vs 62.44 holds) |

The canopy goes like this. The garage roof projects over the front zone only when a FRONT recess exists on the top storey
(`reconstruct-v2.ts:857`). The storey-1 rectangle no longer reaches the front face, so no storey-1 recess is made, and
`projects` is false.

**Why P0.** This is a PASS row, and its model regresses against the source. The regression is in a printed opening and in
recognisable features (the portico returns and the canopy), and it is not explained anywhere in the stage records. Brief
§27: "Existing PASS houses should remain PASS unless a source-supported correction is explicitly explained." This change
runs against the source. The planned CI re-pin of Marcówki to `8d0b93e9e214…` would lock it in.

**Suggested fix (generic, no house knowledge).** Never let a side of an upper walled region that is not drawn as wall cut a
storey's face. Per side, use the same `cell.edges[].wall` / closure evidence that `perimeterWallEvidence` already sums. If
a side's wall share is below the closure threshold, take that side from the nearest facade-length band of the same plan
beyond it, within the envelope, or else from the body face it would snap to. Add a fixture: a gable storey whose end walls
carry wide window gaps. Then re-run Marcówki and expect the ring at 0.99–13.60 with the three callouts read. Do not re-pin
Marcówki until then.

## E5L-2 — P1 — a nonsense rival degrades Marcówki's gate and adds a LIMITING warning

**Where.** `layout.ts:1687` (rivals within `STOREY_RIVAL_WINDOW = 0.1`, line 1192) and `layout.ts:1726–1736` (near-tie →
`STOREY_COVERAGE_DISAGREES`, DEGRADING). `packages/analysis-service/src/warnings.ts:102` passes every DEGRADING reason on
as LIMITING.

**Probe.** `storey-trace.ts --only marcowki` at HEAD:

```
chosen region-built-0-1 @1.020246 (10.34, 55.99) score 0.533108
rival  walls @1.105605 (128.1, 214.6) score 0.493862, stands on mass-0, mass-1   margin 0.039246
gate STRUCTURAL_LAYOUT_PARTIAL ['DEGRADING:STOREY_COVERAGE_DISAGREES']   (baseline: ACCEPTED, no DEGRADING reason)
```

In the full pipeline at HEAD (`ci-rows/marcowki/result-summary.json`) the warnings now include
`LIMITING LAYOUT_STOREY_COVERAGE_DISAGREES`.

The rival is a wall-pair hypothesis that slides the attic about 4.5 m east, astride the garage. On the reference house, the
new `shares` score separates it from the true placement by only 0.04, inside a window sized for the old agreement scale.
The same shape appears on tunbergiach (attic margin 0.018), D00 (0.018) and willa-miranda (0.002).

**Fix.** Calibrate the rival window and tie to the resolution of `shares`. Alternatively, do not let a rival whose scale
disagrees with the chosen one (and with both plans' printed scales) by more than `WALL_PAIR_SCALE_AGREEMENT` count as a
coverage contradiction. A conflict that fires on the reference house and costs the user a LIMITING warning needs an
explanation in the report at least.

## E5L-3 — P1 — willa-miranda: a printed scale overridden, a garage-side bay stacked, a roof at 6.4 m

The real-row counterpart of A5L-1, seen from the model side.

**Probe.** `storey-trace.ts --only willa-miranda` at HEAD:

```
base  mpp 0.026808/0.02659 (6 chain anchors, rms 0.019 m)      upper mpp 0.034537/0.034626 (8 anchors, rms 0.035 m) → k = 1.288
chosen walls @1.000 (135, 95.6) score 0.305206        rival walls @1.000 (135, 163.97) 0.303196   margin 0.00201
best candidate at the printed scale 1.295: score 0.1357
region-built-3-4 → 2.60 × 5.75 m; SUPPORTS mass-0 (2.60 × 2.20) and mass-1 (2.60 × 2.45 = 40 % of the bay)
```

**Model** (dev `2646b540…`). The full CI pipeline (`ci-rows/willa-miranda`, model `4bbd7c4d…`) shows the same pattern: `ring-attached-0-1` x 9.19–11.79 and `roof-attached-0` FLAT on `lvl-1`, eaveOffset 3.60, over x 8.31–14.51. In the dev model:

- level 1 has rings of 6.36 and 5.72 m², with slabs of 116.77 and 8.61 m²;
- `ring-attached-0-1` is x 9.19–11.79, but `roof-attached-0` moved from `lvl-0` (eave 3.21 m) to `lvl-1` (eave 2.80 + 3.60 = 6.40 m) over the whole bay, x 8.00–14.51. That leaves 3.9 m of flat roof hovering 3.6 m above the ground storey's wall tops, with no walls under it;
- the main gable roof moved to `lvl-1`, eaveOffset −0.02.

The verdict stays ALGORITHMIC_FAIL (`upperStoreysHoldTheirRooms` 12.08 vs 99.51 fails), and the CI row `footprint:4` still
passes. But the model the phone shows is less plausible than before (old: one storey, bay roof at 3.2 m). Of what the
brief guards against, it shows two:
- a printed scale overruled by a fit (§8);
- a one-storey body gaining an upper floor from an overlap of 2.6 × 2.45 m, one room's span (§13).

**Fix.** See A5L-1 (keep a placement at a strongly chain-registered scale unless the walls refute it), plus E5L-4.

## E5L-4 — P1 — roofs still read the whole body

**Where.** `reconstruct-v2.ts:827` (`levelOf(Math.max(...m.storeys))`), `:857` (the front-zone projection needs a top-storey
recess) and `:882` (the flat-roof footprint is the whole body). For pitched roofs, `mainRoof.footprint` is unchanged by
`storeyRects`.

**Scenario.** A storey whose rectangle is smaller than its body still gets the body's roof at the top storey's height:

| row | roof | over | walls under it at that level |
|---|---|---|---|
| willa-miranda | `roof-attached-0` FLAT | the whole bay | 2.6 m of the bay's 6.5 m |
| Marcówki | gable | z 0–14.6 | gable walls at 1.90 and 12.55 (1.9 m and 2.05 m of roof past each gable) |
| dom-w-zurawkach | `roof-attached-0` FLAT on `lvl-1` | z 0–9.5 | ring from z 0.82 |

**Fix.** An attached flat roof over a body whose top-storey rectangle is smaller than the body should be split: cap the
top-storey rectangle, and keep the rest at the storey below's wall top. Alternatively, do not lift the roof at all unless
the rectangle is the body. The front-zone projection test should ask whether any storey of the main body reaches the
zone, not only the top one.

## E5L-5 — P2 — versions

- `LAYOUT_INFERENCE_VERSION` is defined at `layout.ts:69` and nothing reads it (`grep -rn LAYOUT_INFERENCE_VERSION packages apps` → only the definition; `git log -S` → 03R). The 1.0.0 → 1.1.0 bump changes no hash and no record. Suggest adding `'structural-layout': LAYOUT_INFERENCE_VERSION` to `ANALYZER_VERSIONS` (`packages/analysis-service/scripts/second-house.ts:280`). That is Evidence-Pack provenance only: the pack is not a solver input, and `evidence:verify` checks the manifest, not a fixed key set.
- `SOLVER_V2_VERSION` (2.3.0) stays as it is, and I do not challenge that. It feeds `hypothesesHash` (`reconstruct-v2.ts:1277`) and so every model and candidate hash; bumping it would move every pin and fixture for no information gain. I checked for consumers that key on it: none in `apps/android` (`LocalAnalysis.kt:189` only displays it), `apps/analyzer-api` (health JSON only) or `apps/local-analyzer` (hello event only). No result cache keys on it, and model and candidate hashes are content-addressed. The cost is that two analyzers report the same `solver: 2.3.0`; the Evidence Pack's `gitSha` disambiguates.

## E5L-6 — P2 — the Evidence Pack does not show the storey decision

`packages/evidence-pack/src/pack.ts:713` writes `14-selected-layout.json` for the selected (base) plan only. The registration
(`storeyRegistrations`), the support relations and the per-storey footprint regions are in neither the pack nor the result
summary. Someone reading a pack cannot see why Marcówki's upper ring shrank. Suggestion for a later stage: a pack file with
the storey registration record (it is already deterministic and pixel-free), behind a pack version bump. Not a schema
break; `npx vitest run packages/evidence-pack` → 3/3 pass, and every CI-row replay's `evidence:verify` → OK.

## E5L-7 — P2 — matrix provenance

`dev/development-matrix.json` says `"gitSha": "2244f48…"`. Commit 42cfcd7 (`bandM` snap band, `layout.ts:1240,1272,1279`)
came after the first NEW batch (03:10–03:14). Every row whose model changed was re-run at 03:38–03:39, before the matrix
was written at 03:44. I re-ran the changed rows at HEAD (below) and got the matrix's hashes. Label the matrix with the code
it was actually produced from.

## E5L-8 — P2 — the new verdict predicate is lax

`holdout/verdict.mjs:65–85`:
- It sums gross wall-ring boxes over all levels above the lowest, against 0.9 × the net area of rooms listed outside GROUND and BASEMENT.
- It held for Marcówki's shrunken ring (84.15 ≥ 56.2).
- It held for tunbergiach, whose attic ring is 8.91 m² while level 1's 117.3 m² carries the sum.
- On a model whose lowest level is a basement, "upper" includes the ground storey.

It is a post-hoc check, not a chooser, and that is right. But it should not be cited as evidence that the upper storeys are
source-supported. Suggest a per-level check and a note in the report on what it cannot see.

---

## PASS-row and changed-model assessment (development matrix, 40 rows)

There are 8 model changes, no outcome changes (completed ↔ refused) and no refusal code changes; 19 refusals keep the same
code. Verdict changes: A06, A07 and dom-w-tunbergiach go ALGORITHMIC_FAIL → PASS. No PASS row turned FAIL.

| row | set | verdict old→new | storeys | what moved | assessment |
|---|---|---|---|---|---|
| marcowki | DEV | PASS→PASS | 2→2 | L1 ring 99.62→84.15 m², returns lost, front printed window lost, rear windows lose callouts, phantom upper door, garage fascia lost, gate ACCEPTED→PARTIAL | **regression, not source-supported (E5L-1, E5L-2)** |
| dom-w-morelach | DEV | PASS→PASS | 2→2 | same rings; upper registration moved (envelope-without-attached @0.934 → walls @1.000); L1 openings re-read: rear 2 × 1.40 m now "printed 140/70" (was 2.80/2.93 "no callout"), 3 wide east gaps → 1 | plausible improvement: printed callouts now land on the walls (printed-callout openings 2→4) |
| willa-miranda | DEV | FAIL→FAIL | 1→2 | 12 m² upper ring, bay stacked, bay roof to 6.4 m | **unexplained, implausible (E5L-3, E5L-4)** |
| dom-w-zurawkach | DEV | FAIL→FAIL | 1→2 | upper storey over main and over attached-0 (z from 0.82); attached flat roof to `lvl-1`; 7 exterior doors on L1 | storey count still short (3 plans); whether attached-0 (40.9 m², published garage 23.8 m²) really carries the attic needs a source check (Reviewer B or D) |
| dom-w-tunbergiach | DEV | FAIL→PASS | 1→3 | L1 copies ground (117.3), L2 ring 8.91 m² under a 105 m² slab | storey count fixed; the attic ring's 8.9 m² is not source-checked here (E5L-8) |
| A06 | FRESH | FAIL→PASS | 1→2 | L1 copies both bodies; the 5.6 m² attached body gains a storey and its flat roof moves to `lvl-1` | the stage's target; the attached body's second storey needs a source check |
| A07 | FRESH | FAIL→PASS | 1→2 | L1 copies the body (134.32) | the stage's target; consistent |
| D00 | FRESH | FAIL→FAIL | 1→2 | L1 main x from 0.74; 11 exterior doors and 7 windows on L1, none printed; lvl-0 13.04 m tall (section reading, pre-existing) | FAIL either way; many unprinted upper openings |

## CI predictions (`analyzer-development-houses`; full replay at HEAD 4ad69fe: `/home/user/work005l/ci-rows/`, 19 rows, through `dev-row.mjs` and `evidence:verify`)

| row | expectation | at HEAD | CI action |
|---|---|---|---|
| marcowki | pass, `--same-model 6152770f…` | **FAIL**: model moved to `8d0b93e9…`; verdict PASS; new LIMITING `LAYOUT_STOREY_COVERAGE_DISAGREES` | re-pin is planned. **Recommend: fix E5L-1 first, then re-pin to whatever the fix produces.** |
| kosacce-clean / kosacce-tracked | pass, pin `5b5ffcf1…` | OK, model unchanged | none |
| rarytasy-g2e | footprint:2, pin `9f5fd342…`, OPENINGS_NOT_BUILT, CONFIRMED | OK, unchanged | none |
| rarytasy-eoze | pass, metric | OK | none |
| alt-marcowki | refuse:METRIC_RESOLUTION_INCONCLUSIVE | OK | none |
| dom-w-jablonkach | pass, METRIC_SCALE_WEAK | OK | none |
| willa-miranda | footprint:4 | OK (4 bodies, 161.29 m²), but see E5L-3 | none for CI |
| dom-w-zurawkach | footprint:2 | OK (2 bodies) | none |
| dom-w-modrzykach | pass | OK | none |
| aster-viii, galaktyka | refuse + NO_DIMENSION_EVIDENCE | OK | none |
| dom-w-azaliach | refuse:PLAN_RESOLUTION_INCONCLUSIVE + metric | OK | none |
| dom-w-dabecjach | refuse:BOUNDARY_RESOLUTION_INCONCLUSIVE + metric | OK | none |
| dom-w-tunbergiach | footprint:1, METRIC_SCALE_WEAK, scale 2.092 | OK (1 body; verdict now PASS) | none; the comment "still misses its upper storeys" is stale |
| dom-w-modrzewnicy | refuse + DIMENSION_EVIDENCE_INCONCLUSIVE | OK | none |
| dom-w-morelach | pass, METRIC_SCALE_UNSUPPORTED, CONFIRMED, 1.996 | OK (model `58ee0e7b` = dev matrix) | none |
| dom-pod-jarzabem | complete:1 | OK | none |
| dom-w-arkadiach | refuse + DIMENSION_EVIDENCE_INCONCLUSIVE | OK | none |

**Body counts.** No row produced an extra-piece ATTACHED mass (`<id>-s<k>-<n>`), so every `footprint:<n>` and `complete:<n>`
count is unchanged, in the dev matrix and in the CI replay alike. The pieces path (`reconstruct-v2.ts:395–399`) still feeds
`counts.masses` (`run.ts:529`). A house where it fires changes its CI body count; such a row would need its expectation
updated deliberately.

**Other hash pins.**
- The Android contract fixtures (`result.json` and `status-completed.json`, candidate hash only) match. `npx vitest run apps/analyzer-api/test/android-contract.test.ts` → 1/1 pass; Larchfield's model hash `0f074a7c…` is unchanged.
- `apps/local-analyzer/src/self-test-expected.json` is OCR-only and unaffected.
- The sealed candidates (`packages/candidates/src/*.json`) and the scene assets are static artefacts; their tests never re-solve.
- `apps/web` does not depend on `@buildapp/reconstruction`.
- The author's full `npm test` at 42cfcd7 failed only on the then-stale contract fixture, refreshed in 79e9bbc.

## Schema, Evidence Pack, determinism

- **Schema.** The new footprint regions use the existing `FootprintRegionHypothesis` shape. The new unresolved statuses (`MISSING`, `AMBIGUOUS`) and the conflict kind `STOREY_COVERAGE_DISAGREES` are in the existing enums. `storeyRegistrations` lives on the draft only and is not sealed (`sealStructuralLayout`, `layout-gate.ts:257`, does not copy it). `PlanAlignment.shares` is not sealed. `MassV2.storeyRects` and the piece masses are internal to `BuildingV2`; the model schema never sees them. Real-row validation (`research/council-e/schema.ts`, `reconstructV2` at HEAD on marcowki, willa-miranda, dom-w-zurawkach,
  dom-w-tunbergiach, A06, A07, D00 and dom-w-morelach): `StructuralLayoutHypothesisSetSchema` OK and `ReconstructionCandidateSchema` OK on
  all 8. No duplicate footprint ids; regions sorted; no piece masses.
- **Determinism.** Footprint ids `footprint-<storey>-<mass>[-k]`, with pieces ordered by area then x0, z0 (`layout.ts:1298–1304`). Upper bodies are sorted by region id, and the `considered` sort is a total order on each placement's own numbers. The sealed set sorts regions by id. Re-runs at HEAD:
  - Two `reconstructV2` runs in one process gave the same layout `contentHash` and model hash on all 8 rows.
  - `dev-matrix.mjs run` at HEAD (fresh processes) reproduced the matrix's NEW hashes bit for bit on D00 `70b3ad78…`, willa-miranda `2646b540…`, A07 `f0b04887…` and dom-w-tunbergiach `eab6b832…`.
  - The full CI pipeline reproduced marcowki `8d0b93e9…` and dom-w-morelach `58ee0e7b…`.
  - (Order invariance under permutation is Reviewer A's and the stage's `order.ts`; I did not repeat it.)
- **Evidence Pack.** `npx vitest run packages/evidence-pack` → 3/3. `evidence:verify` → OK on all 19 CI-row replays.

## Runtime (§33)

The machine was shared, with load 5–10 on 4 cores throughout, so every comparison below is base/new interleaved, and the
unchanged single-storey row kosacce-clean is a control (identical code path, identical model hash).

**Registration search alone** (`research/council-e/align-bench.ts`, `alignPlans` per non-base plan, 11 reps, median, two passes):

| row | base ms (considered) | new ms (considered) |
|---|---|---|
| marcowki | 0.6–0.7 (45) | 1.7–1.9 (82) |
| dom-w-morelach | 0.1 (9) | 2.1–3.3 (79) |
| willa-miranda | 0.2–0.3 (48) | 1.5–2.3 (103) |
| dom-w-tunbergiach (2 plans) | 0.0 (0, not registered) | 1.5–2.2 (96 / 108) |
| A07 | 0.0 (0) | 2.7 (113) |
| D00 | 0.0 (0) | 5.4–5.7 (148) |

Bounded. No more than 148 candidates and about 6 ms per plan. The wall-pair product is cut by the 2 % scale agreement and the
dedupe key; the rivals are capped at 24.

**Layout pass** (`storey-trace.ts`, `composeStructuralLayout`, 3 interleaved reps, median ms, base → new):
- marcowki 2438 → 1853
- morelach 3125 → 2167
- jablonkach 1279 → 1318
- willa 1753 → 1827
- tunbergiach 1200 → 1334
- A03 1225 → 1099
- A07 1274 → 1016
- D00 2465 → 2617

The median ratio is **0.96**.

**Whole solver** (`research/council-e/solve-bench.ts`, `reconstructV2` on sealed evidence, warm-up then median of 3–5, base → new):

| row | ratio per pass | median |
|---|---|---|
| kosacce-clean (control) | 1.31, 0.98, 1.05, 1.01 | 1.03 |
| marcowki | 1.06, 1.29, 0.89, 0.89 | **0.97** |
| A07 | 1.23, 1.19, 1.00, 1.15 | **1.17** (1 → 2 storeys built) |
| willa-miranda | 1.23, 1.15 | **1.19** (1 → 2) |
| dom-w-tunbergiach | 1.12, 1.13 | **1.13** (1 → 3) |
| D00 | 1.01, 1.05 | **1.03** (1 → 2) |

The median over the multi-storey sample is **1.13**, against the control's 1.03. That is under the §33 15 % line. The excess
sits only on rows that now build one or two more storeys: their interiors, openings, stairs and rooms are now read. The
search itself costs milliseconds. No P1.

## Android / APK / bundle (§40 pre-checks)

- **Bundle builds.** `node apps/local-analyzer/build.mjs`: `analyzer.mjs` is 2 219 075 B at the base and 2 240 621 B at HEAD (+21.5 KB, +0.97 %). The bundle contains no `research/`, `analyzer-005l` or `storey-trace` string.
- **Runtime APIs.** The new production code (`git diff a70047f..HEAD -- packages/reconstruction/src`) uses `flatMap`, `Set` and `Map`, and `localeCompare` on ASCII ids and on candidate `why` strings. All are available on nodejs-mobile 18.20.4 (no `structuredClone`, `.at()`, `findLast`, `toSorted` or `Intl` added; the one `.at(-1)` in the bundle is pre-existing).
- **Collation on the phone.** The phone's text adapter refuses text outside its verified repertoire (`apps/local-analyzer/src/text.ts:26`). The new tie-break `a.why.localeCompare(b.why)` (`layout.ts:951`) compares strings built only from ASCII, digits and U+2013 EN DASH, and U+2013 is in `TEXT_TABLES.bases`. I checked with `research/council-e/rep.ts`: U+2013 is a base; U+2019, U+00B7 and U+2026 are not, and none of them occurs in an alignment `why`. So this cannot raise `TextNotSupportedError`. Keep curly quotes out of those strings: a `’` added to an alignment `why` later would throw on the phone only.
- **Bundle parity test.** `npx vitest run apps/local-analyzer/test/program.test.ts` → **11 passed, 5 skipped**, in 102 s.
  - Larchfield and Holloway give every hash equal to the desktop `runAnalysis`, both run as the phone runs them and under V8 without ICU, with the text adapter.
  - Cancel and refusal paths pass.
  - The 5 skipped tests are the `LOCAL_ANALYZER_NODE18` block: no Node 18 binary on this machine. CI must run it.
  - The OCR model was missing from this worktree, which had not fetched it; I copied it from `/home/user/BuildApp`, where it is gitignored.
  - `npx vitest run apps/analyzer-api/test/android-contract.test.ts` → 1/1.
- **Research isolation.** `tests/architecture/research-isolation.test.ts` has a 005L block. In the built bundle nothing from `research/` is reachable.
- **APK.** No APK was built in this review (§40 is after the freeze). Nothing in the change touches Gradle, native libraries, permissions, the OCR model or WASM.

## Probes (throwaway, in the council worktree only)

`/home/user/work005l/council-wt/research/council-e/{sides.ts,align-bench.ts,solve-bench.ts,schema.ts,rep.ts}`; copies of
`align-bench.ts` and `solve-bench.ts` in `/home/user/work005l/base-wt/research/council-e/`. Outputs are in
`/tmp/claude-0/-home-user/0a26fa63-8500-448a-ba12-4e55a11b6e2f/scratchpad/`.
