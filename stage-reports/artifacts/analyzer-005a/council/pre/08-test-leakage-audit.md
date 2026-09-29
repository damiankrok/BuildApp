# 08 — Test leakage and verification audit

Sources: Council D (red team, §2 and §5), Council G (verification / holdout), and the orchestrator's
own grep at `7cd8e0c`. Evidence tags: **[M]** measured, **[C]** read in code.

## 1. Literal leakage into production: none

Production `src/` of `source-package, source-analyzer, source-cv, source-metrics, source-vision,
source-observations, source-common, image-metrology, reconstruction, analysis-service`,
`apps/local-analyzer/src`, `apps/analyzer-api/src`, `apps/android/app/src/main/java` [M grep]:

| probe | hits |
| --- | --- |
| slugs `marcow, marcówk, rarytas, kosac, kosać, g2e` | 0 |
| publisher ids `m2fa281446a8ca, m84f2903cb8e14, mf6628752fa61f, m738275b7537b0` | 0 |
| Kosaćce published figures `164.47 128.16 124.14 216.91 807.96 6.49` | 0 |
| e-OZE published figures `122.07 94.41 89.85 140.41 560.88 5.71` | 0 |
| `oze` | 2, both inside ordinary words (`dozens`, `froze`) — false positives |

Marcówki's scenes and candidates are in `apps/android/app/src/main/assets/scenes/` and
`packages/candidates/src/*.json` by product design (the reference house the workspace ships); they are
not on the analyzer path, and no analyzer package imports them.

## 2. What the existing guards prove and what they miss

| guard | proves | misses |
| --- | --- | --- |
| `tests/architecture/analyzer.test.ts:71-122` | no `marcowki`/id in six source packages; no project-id branching; no Marcówki metre constants there | not `reconstruction`, `analysis-service`, `image-metrology`, apps; not Kosaćce/e-OZE |
| `tests/architecture/reconstruction.test.ts:74-91,197-233` | same names in six packages incl. reconstruction; Marcówki dimensions in 10 structural files | not Kosaćce/e-OZE/G2E figures; only 10 files |
| `tests/architecture/second-house.test.ts` | no `rarytas`/G2E id anywhere in production; G2E figures absent from the solver | nothing for Kosaćce or e-OZE |
| `analyzer.test.ts:249-260` | the generic adapter names no publisher and no house | the rest of `source-package` |
| `reconstruct:no-reference` / `no-benchmark` scripts | the candidate path runs with reference packages renamed away | their pass criterion (≥ 2 bodies, ≥ 2 roof kinds, a recess, …) is Marcówki's structure: a one-body house cannot pass |

**What no string guard can prove:** that a threshold was not fitted by iterating against the development
houses. Council D lists the comments that say so (`chains.ts:601-607`, `views.ts:105-136`,
`opening.ts:326-370`, `plan-openings.ts:117-125`, `reconstruct.ts:656-923`,
`scale-plausibility.test.ts:26-34`). That is why the defence this stage adds is *behavioural* —
metamorphic and shape-family tests and a blind holdout — rather than a longer forbidden-word list.

## 3. Which tests assert development-house values

- Marcówki: sealed artifact consistency (`tests/benchmark/structural.test.ts`,
  `analyzer-v2.test.ts:72-238`, `candidates/test/sealed.test.ts`) — hashes and invariants of committed
  artifacts; they do not re-run the reader.
- G2E: `tests/benchmark/second-house-roof.test.ts` is `skipIf(!BUILDAPP_SECOND_HOUSE_DIR)` — not run in CI.
- Kosaćce, e-OZE: **no test at all.** The two houses that expose the failures have no regression.
- Every vitest that executes `runAnalysis`, `reconstructV2`, `inferStructuralLayout` or
  `extractMetricEvidence` feeds it synthetic sheets drawn to the pipeline's own conventions (chains top
  and left only, 38 px/m ≈ the tuned 2.6 cm/px, one plan per storey, no AREA_TABLE copy, GABLE only,
  no ATTIC label) [C].

## 4. Decisions for this stage

1. **One production-wide purity test** (`tests/architecture/generalization.test.ts`): every
   production directory above; no development slug, publisher id or published figure of **any** of the
   four development houses (the list lives in the test, not in production); no `projectId ===`,
   `canonicalUrl ===`, `externalId ===` or URL-substring branching outside the adapter; the resolver
   files carry no reference dimension. The development list is data of the test and grows with each
   new development house.
2. **Metamorphic source tests** (network-free, fixture server): tracking keys (`gclid`, `gbraid`,
   `wbraid`, `fbclid`, `msclkid`, `_gl`, `utm_*`, `mc_*`), query order, fragment, trailing slash,
   letter case of the host, and a canonical redirect all give the same logical project id, canonical URL
   and evidence hash; a different project page gives a different one; asset order in the page does not
   change the package's evidence hash.
3. **Sealed-evidence replays that compare the model**, not only candidate hashes: Marcówki, G2E and
   Kosaćce clean must reproduce their model and scene hashes; Kosaćce with the area-table copy alone
   and e-OZE (both copy subsets) must not end in a single-method failure. They run from committed
   metric evidence (JSON of observations and readings, no drawings).
4. **Shape-family tests through the resolver** on generated plans: rectangle, L (both sides), T, U /
   recess, attached garage (side and forward), wide glazing, one storey, two storeys, AREA_TABLE-only
   copy, a small copy (400–550 px), mis-scaled chain reading. Each must either produce a valid body set
   or `PLAN_RESOLUTION_INCONCLUSIVE` with its candidates — never a silent wrong footprint.
5. **Image robustness** is measured and reported (resize, JPEG re-encode, 1-px shift), not gated, this
   stage: the OCR is known to be pixel-density bound (ASSUMP-IMAGE-001) and fixing it is out of scope.
6. **Blind holdout** per the brief's protocol (§6 below).

## 5. What Council G measured on today's code (read-only replays)

| gate | measured today | consequence for this stage |
| --- | --- | --- |
| source invariance (7 URL spellings, synthetic publisher, full `runAnalysis`) | model/scene 7/7 equal; package identity 5/7 (the two tracked spellings keep the query) | HARD after the logical identity lands |
| harmless ordering (seeded permutations of graph, metrics and package asset order) | 21/21 identical graph, metrics, candidate and model hashes | HARD, kept |
| image transforms (5 synthetic houses × ≤ 12 transforms, 43 cells) | 12 violations of architectural equivalence, **9 of them COMPLETE silently with a different building** (a garage lost at 0.75×, a wing lost at JPEG q40); `MODEL_EMISSION_FAILED` reachable from image noise | reported as a measured matrix, not gated this stage: the pixel-density coupling (ASSUMP-IMAGE-001) is out of 005A's scope; recorded as an open generalization risk |
| plan-copy subsets on sealed evidence (4 projects × 9 subsets, 36 solver runs) | the 853 DIMENSIONED copy is the single point of failure of all three solvable projects; 0 of 8 small-copy-alone runs solve; the AREA_TABLE-alone Kosaćce run reproduces the phone's 33.15 m² to the digit | HARD for the rows the resolver must fix (area-table-alone Kosaćce, e-OZE); the rest reported as a matrix before/after |
| twin-copy consistency (853 D vs 853 A of the same drawing) | 1 of 4 equivalent | reported before/after |
| shape families derived from the generator (L flush, T-like wing, wide garage door, narrow wing) | a 3.2 m door in a 3.6 m wing, or a 2.4 m wing, **drops the wing and completes with no code** | the resolver's shape-family tests include both; they must end valid or inconclusive, never silently smaller |

"No regression" is a lattice, not a hash (G §6): a row may move up (failure → typed limit → limited
model → model), never down; hash equality is demanded only where the solver's rules did not change.
An intended hash change of a development house is recorded as a reseal row (project, old → new,
architectural diff, reason). This stage expects **no** reseal of the three accepted houses, because the
resolver does not run when today's pipeline would continue.

## 6. Blind holdout protocol (Council G §5, adopted)

1. **Pool (T0).** Enumerate the publisher's own `sitemap.xml` (robots.txt permits `/projekty-domow/`),
   keep canonical project URLs (`/projekty-domow/projekt-<slug>-m<13 hex>`), drop non-house slugs
   (`garaz|wiata|g\d+-|budynek|altana|domek-gospodarczy`), drop every **development family** derived
   from the sealed packages already in `stage-reports/` (family = first three slug tokens when the
   second is a preposition, else first two — over-merging is the safe direction), sort by UTF-16 code
   units. Commit `holdout/pool.txt` + `pool.meta.json` (fetch time, sitemap and robots hashes,
   `POOL_SHA256`). No project page is opened.
2. **Code freeze (T1).** Every 005A change committed and pushed, local gates green;
   `PRE_HOLDOUT_SHA = git rev-parse HEAD` written into the report before selection.
3. **Select (T2).** `seed = SHA256(PRE_HOLDOUT_SHA + "BUILDPLAN-005A-BLIND-HOLDOUT")`,
   `i1 = seed mod n`, `i2` = the next index (cyclic) whose family differs. The script refuses unless
   `HEAD == PRE_HOLDOUT_SHA`, the tree is clean and the pool hash matches; it appends the draw to
   `holdout/LEDGER.ndjson`.
4. **Run once (T3)** with the frozen code: production `runAnalysis` on the desktop, evidence sealed.
5. **Verdict (T4)** by pre-registered predicates: PASS (completed; footprint within 6 % of the published
   figure when one is published; storeys equal to the plan storeys; no emission failure), 
   SOURCE_LIMITED_PARTIAL (a typed source reason **and** the raw copies confirm insufficient evidence
   by the checklist: no floor plan, no legible overall dimension, walls under 4 px, a plan asset lost in
   `pkg.failures`), ALGORITHMIC_FAIL (everything else, including a completed but wrong model — footprint
   more than 20 % off, a storey or mass mismatch).
6. **Burn (T5).** No patch after T2. A drawn family joins the development set; every draw is reported;
   a re-draw never replaces a bad draw.

Two draws can falsify generality; they cannot establish it (with a true pass rate of 0.6, both pass
36 % of the time). The holdout is a smoke alarm, reported as such.
