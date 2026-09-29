# G — Verification / Holdout Scientist: pre-audit report (BUILDPLAN-ANALYZER-005A)

Repo `/home/user/BuildApp` @ `7cd8e0c` (`analyzer/generalization-council-v1`). Everything below is either read in code (`path:line`) or **measured by me with read-only runs** whose scripts and raw output are in
`/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/council/g-work/` (Appendix A). No file of either repository was modified.
One side effect to disclose: importing `packages/analysis-service/scripts/second-house.ts` under `vite-node` runs that script's CLI `main` (guard `!process.env.VITEST`, `second-house.ts:196`), which created an empty, gitignored `.cache/second-house/`; I removed it (`git status` clean).

---------------------------------------------------------------------------------------------------

## 0. Role answer

**Can the test/CI machinery tell "the analyzer generalizes" from "the analyzer was fitted to these four URLs"? No.** The seven facts that decide it:

1. **Leakage is zero today, and only luck-plus-discipline keeps it so.** 0 project names/codes and 0 evaluation numbers in 227 production TS files + 70 Kotlin files (checked, §1.1). But the guard is a patchwork of 11 hand-typed lists in 7 test files; **Kosaćce (`mf6628752fa61f`, 164.47, 216.91, 128.16, 6.49) and e-OZE (`m738275b7537b0`, 122.07) are protected by no test at all**, although 004A §K (l.195) claims "Nothing names Kosaćce … or the evaluation figures … in production code" (`stage-reports/…004A….md`, §K). The bundle-level scans (`analyzer-api.test.ts:25`, `local-analyzer.test.ts:37`) know only Marcówki.
2. **"Sealed evidence replays to the same hash" proves determinism and runtime parity on the tuning set — not generalization**, and it actively discourages improvement (004A §AA, l.493: `SOLVER_V2_VERSION` left unchanged "although the emitter's rule set grew … declined for the byte-identity gate"). Its byte-cache dependency turns it into a vacuous pass whenever the publisher is unreachable (`buildapp-ci.yml:631,636,640,729`).
3. **The synthetic corpus is easier than the real world in exactly the dimensions that failed on the phone.** Measured on the existing generator: 43 transformed-drawing cells (5 houses × ≤12 transforms) → **12 violate architectural equivalence, 9 of them COMPLETE silently with a different building** (Holloway loses its garage at 0.5×/0.6×/0.75×/1.5×; Marlow loses its wing at JPEG q40; Redmire *fails* at 1.25×; two more fail with `MODEL_EMISSION_FAILED`). The wing is also lost at native scale when its door is 3.2 m of a 3.6 m wing or the wing is 2.4 m wide.
4. **Plan-copy loss is deterministic, reproducible, and was predicted in 03Y2G.** On sealed evidence with frames withheld (36 solver-alone runs): the 853 px DIMENSIONED copy is the **single point of failure of all three solvable projects**; e-OZE fails with all four copies; no 550 px or 400 px copy solves any project alone (0/8). The 853 px AREA_TABLE copy — *geometrically identical* to its DIMENSIONED twin (I looked at both images) — solves Marcówki only, fails Kosaćce (`FOOTPRINT_AREA_WRONG` 33.15 vs 164.47 m², every number equal to the OWNER's phone), Rarytasy-G2E (0 chains) and e-OZE. 03Y2G already recorded this exact hypothesis and closed it as "PARTIAL … named code, not a model" (`03Y2G.md:42, :729-740`); no gate was ever built for it.
5. **The only independent constraint that saves the analyzer from a wrong model — the publisher's printed footprint — is absent from every synthetic fixture** (`pipeline.ts:74 publishedFacts: []`) and is *silenced by the same perturbation* that causes the error (Holloway 0.75×: wing lost, gate `STRUCTURAL_LAYOUT_ACCEPTED` with `NOTED:NO_SECOND_VIEW`, front/rear elevation registrations unresolved).
6. **Blind holdout is feasible, deterministic and cheap to enumerate**: one `sitemap.xml` lists 3,257 canonical project URLs; after excluding non-houses and the three development families the pool is **n = 3,084 URLs in 773 families** (sha256 `b5419c12…a9495`, §5). Two draws can *falsify* generality; they cannot *establish* it.
7. **CI structure:** the OWNER APK (`owner-preview-release`) and `preview-release` do **not** depend on `core` (vitest, architecture tests, `no-benchmark`, `evaluate:v2`) — `needs:` at `buildapp-ci.yml:821, 876` — and every live-URL result on a device is advisory (`run-device-tests.sh:66-79` sets a status text; only the synthetic-fixture hashes decide the exit code, `:85-88`).

---------------------------------------------------------------------------------------------------

## 1. Test leakage (Q1)

### 1.1 What is in production `src/` today (measured)

Scanned: `packages/*/src` for the 16 analyzer/service/model packages + `apps/{analyzer-api,local-analyzer}/src` (227 TS/MJS files) + `apps/android/app/src/main/java` (70 Kotlin files), comments stripped.

| probe | result |
|---|---|
| slugs/codes `marcowk|marcówk|rarytas|kosac|kosać|m2fa281446a8ca|m84f2903cb8e14|mf6628752fa61f|m738275b7537b0` | **0 hits** (only `packages/{candidates,demo,reference-marcowki}` and Android `assets/scenes/*.json` name Marcówki — data packages / bundled demo content, not analyzer code) |
| `(^|[^A-Za-z0-9])m[0-9a-f]{13}([^A-Za-z0-9]|$)` in TS + Kotlin + res + cpp | 0 hits |
| synthetic fixture names (`larchfield|holloway|redmire|…`) | 0 hits outside `packages/synthetic-drawings` |
| evaluation values 13.60, 14.60, 128.16, 164.47, 216.91, 6.49, 131.16, 122.07 (+33.15, 19.56, 50.48), decimal and cm-integer forms | 0 hits |
| ≥2-decimal numeric literals in production | 1,664 (1,450 TS + 214 Kotlin) |

Publisher knowledge that *is* present is confined to `packages/source-package/src/adapters/archon.ts` (`PROJECT_CODE_IN_ASSETS = /assets\.archon\.pl\/images\/products\/(m[0-9a-f]{8,})\//`, `:44`; `ANNOTATION_RULES` `z-powierzchniami|\bpowierzchni\w*` → `AREA_TABLE`, `:116`; `ENDPOINT = product_fancybox_*`, `:46`) — publisher convention, legitimately in an adapter (`analyzer.test.ts:240-246` enforces that).

### 1.2 What existing tests forbid, and the gap

| guard | scope (what it scans) | forbids | does NOT |
|---|---|---|---|
| `analyzer.test.ts:79-93` | 6 packages (`ANALYZER_PACKAGES`, `:62`) | `marcowki|marcówki|m2fa281446a8ca` (comments exempt); `archon` outside adapters | Rarytasy, Kosaćce, e-OZE; `source-metrics`, `reconstruction`, `image-metrology`, `analysis-service`, apps, Kotlin |
| `analyzer.test.ts:104-113` | same 6 packages, string literals **blanked** (`codeOf`, `:56-62`) | 12 Marcówki numbers via `code.includes('7.9')` (substring: false positives on `17.95`, false negatives inside strings) | anything else |
| `analyzer.test.ts:248-257` | `adapters/generic` only | `archon fancybox projektydomow marcow kosac rarytas larchfield .pl/` | the only place `kosac` appears in any guard |
| `analyzer-v2.test.ts:92-105, 165-176` | `productionFiles()` + `v2Files()` | `/marc[oó]wk/i`; Marcówki package ids/hashes from the reference package; Marcówki figures (regex, `:167`) in **v2 files only** | other projects |
| `reconstruction.test.ts:74-90, 197-232` | 6 dirs (`:52`); numbers only in `STRUCTURAL_FILES` | `marcowki` + code; Marcówki figures (`:206`) | other projects; non-structural files |
| `second-house.test.ts:18-21, 47-73` | 16 packages + 2 apps + `apps/android/app/src/main` | `rarytas`, `m84f2903cb8e14` (code **and** comments), artifact paths; 5-G2E dims `17.2 14.74 6.88 6.24 189.77 1474 1720 688 624` in **4 packages only** (`:67`) | Kosaćce, e-OZE, Marcówki in this scan |
| `assemblies.test.ts:64` | `NEW_PRODUCTION` (03G modules) | Marcówki + 5-G2E dims | everything else |
| `analyzer-api.test.ts:25,77` / `local-analyzer.test.ts:37,130` | the **shipped bundles** + `apps/local-analyzer/src` | `/marc[oó]wk|m2fa281446a8ca/i` **only**; no JSON in bundle; no `reference-*|candidates|synthetic-drawings` module | Rarytasy, Kosaćce, e-OZE — at the one place that sees everything the phone runs |

**Gaps, ranked:** (1) three of four development projects unguarded at bundle level (and Kosaćce/e-OZE at source level, contradicting 004A §K); (2) six independently hand-typed name lists and five hand-typed number lists (`analyzer.test.ts:107`, `analyzer-v2.test.ts:167`, `reconstruction.test.ts:206`, `second-house.test.ts:66`, `assemblies.test.ts:64`) — every new project needs edits in up to 7 files, so it will not happen for the next one; (3) scan roots differ per test (`PRODUCTION_DIRS` in 4 different spellings) and are allow-lists of packages, so a new package is invisible by default; (4) numbers are matched only in code, only for the lists' owner project; (5) **nothing detects calibration leakage** — a threshold written as a generic constant but tuned on a house (`layout-gate.ts:146-149` 6 %/20 % bands; 03Y2G "8 m widest opening, 0.7 infill, pocket at 2.5 × width²", `03Y2G.md:311, :744-745`, are "conventions, named and tested, not measured laws"). Text tests cannot see Level-2 leaks; only §4(f) and §5 can.

### 1.3 Design — the §27 architecture test (`tests/architecture/no-evaluation-leakage.test.ts`)

**One registry, derived from data, fail-closed scan roots, three rules + self-test + bundle scan.**

*Registry* (`tests/architecture/support/evaluation-registry.ts`), built at test time from every sealed package under `stage-reports/artifacts/**/source-package.json` and `holdout/**/source-package.json` (glob → a new sealed project extends the guard with zero edits) plus a committed snapshot `tests/architecture/evaluation-registry.snapshot.json` (names, codes, numbers only — no drawings) so that deleting sealed evidence cannot shrink the guard (`registry ⊇ snapshot`):
- **families**: slug stem of `canonicalUrl` (`dom-w-kosaccach`, `dom-w-rarytasach`, `dom-w-marcowkach`, + every holdout ever drawn) → regexes on diacritic-folded lowercase text (`kosa.?c`, `rarytas`, `marc.?wk`), plus the 15 synthetic fixture names;
- **codes**: `(?<![A-Za-z0-9])m[0-9a-f]{13}(?![A-Za-z0-9])` (the ARCHON code form, generic — catches the *next* project too) and every `pkg.id`, `contentHash`, `pageHash`, asset id and ≥16-hex `byteHash` of a sealed package (generalises `analyzer-v2.test.ts:79 referenceIdentifiers`);
- **numbers**: `publishedFacts[*].value` where value ≥ 10 or has ≥ 2 decimals, `publishedRooms[*].area`, and printed chain values ≥ 10 m (`metric-evidence.json chains[].segments[].valueCm ≥ 1000`) → 92 entries today.

*Rules*
- **R1 names/codes** — production text **including comments and string literals** must match none of families/codes (mirrors `second-house.test.ts:50`, which is right to include comments; the name of a project in a comment is how the next fix is justified "by project").
- **R2 numbers** — production **code and string literals, comments stripped**, must contain no numeric literal that (a) is written with ≥ 2 decimals (`(?<![\w.])\d[\d_]*\.\d{2,}[fFdD]?(?![\w.])` — covers Kotlin `164.47f`, `1_64.47`) and (b) equals a registry value (compare `toFixed(2)`), unless listed in `tests/architecture/generic-number-allowlist.json` with a written justification (entry = `{value, why, ownerAckedIn}`).
- **R3 paths/imports** — no reference to `stage-reports/`, `research/`, `holdout/`, `tests/`, `.cache/`, `fixtures/`, or `@buildapp/(reference-*|candidates|synthetic-drawings|demo)` (union of the existing `second-house.test.ts:57`, `reconstruction.test.ts:98-100,228-231`, `analyzer-api.test.ts:98`).
- **R4 self-test** — planted cheats must fire: `const FOOTPRINT_M2 = 164.47`, Kotlin `val H = 6.49f`, `// tuned on Kosaćce 46`, `'mf6628752fa61f'`; and a benign control (`1.15`, `112.057`, `HTTP 400`) must not.
- **R5 bundle** — apply R1+R2 to the text of the two bundles the existing tests already build (`analyzer-api.test.ts` `bundled`, `local-analyzer.test.ts` `bundled`); replace their `PROJECT_WORDS` by the registry.
- **R6 inverse** — `packages/synthetic-drawings` dimensions must not collide with the registry ("chosen to share nothing", `fixture.ts:1-13`).

*Globs scanned* (fail-closed: enumerate, then subtract an explicit data allow-list):
`packages/*/src/**/*.{ts,tsx,mjs,js,json}` **minus** `{candidates, demo, reference-marcowki, synthetic-drawings}` (a new package is scanned by default); `apps/{analyzer-api,local-analyzer}/{src,runtime}/**`; `apps/web/src/**` minus `sample-observations.json`; `apps/android/app/src/main/{java,cpp,res}/**` + `AndroidManifest.xml` (Kotlin, `strings.xml`); the two bundles. *Not* scanned (evaluation data IS allowed): `tests/**`, `packages/*/test/**`, `packages/*/scripts/**`, `apps/*/{test,scripts}/**`, `apps/android/{tools,app/src/androidTest,app/src/test}/**`, `apps/android/app/src/main/assets/scenes/**` (bundled demo content), `stage-reports/**`, `research/**`, `holdout/**`, `.github/**`, `packages/{reference-marcowki,candidates,demo,synthetic-drawings}/**`.

*Skeleton*
```ts
const ALLOWED = [/^tests\//, /\/test\//, /\/scripts\//, /^stage-reports\//, /^research\//, /^holdout\//, /^\.github\//, /^packages\/(reference-marcowki|candidates|demo|synthetic-drawings)\//, /assets\/scenes\//, /androidTest|\/tools\//]
const scanned = walk(ROOT, /\.(ts|tsx|mjs|js|json|kt|xml)$/).filter(f => !ALLOWED.some(a => a.test(f)) && /^(packages\/[^/]+\/src|apps\/[^/]+\/(src|runtime)|apps\/android\/app\/src\/main\/(java|cpp|res))/.test(f))
const reg = buildRegistry(ROOT)                      // families, codes, numbers, identifiers ⊇ snapshot
it('R1', () => expect(scanned.flatMap(f => hits(read(f), reg.names, reg.codes, reg.identifiers).map(h => `${f}: ${h}`))).toEqual([]))
it('R2', () => expect(scanned.flatMap(f => numericHits(stripComments(read(f)), reg.numbers, ALLOW).map(h => `${f}: ${h}`))).toEqual([]))
```

*False positives — measured, and why the rule looks the way it does*
- Registry of **published facts + room areas + ≥10 m chain values**, literals with ≥ 2 written decimals: **0 collisions in 1,664 literals** (TS + Kotlin). The rule is satisfiable today without an allow-list entry.
- Naive registry (every read dimension) → **8 collisions** — 1.13, 2.13, 1.15 (×4), 1.95 (×2): door/sill conventions. Hence opening-size readings are excluded.
- **Integer cm forms are unusable**: the 43 chain values ≥ 2.5 m that are unique to one project produce **48 collisions** (`400`, `600` in HTTP/limit constants and in `apps/local-analyzer/src/text-tables.ts`). Do not add cm-integer matching; the existing `1474 1720 688 624` entries (`second-house.test.ts:66`) are the only ones that happen to be safe.
- `analyzer.test.ts:107` uses `includes` (substring). Replace by the boundary regex used at `second-house.test.ts:70`.

*What R1–R6 cannot catch* (declared, not hidden): calibration leakage (§4f) and behaviour keyed on publisher filenames that are not project-specific. Those need §4(f) and §5.

---------------------------------------------------------------------------------------------------

## 2. Do sealed replays prove generalization? Which CI jobs are advisory? (Q2)

**What `--same-as` proves** (`second-house.ts:157-166`, keys `candidateHash modelHash sceneContentHash sceneSha256`, `:194`): same code + same bytes → same output; Node 18 without ICU = Node 22 (`buildapp-ci.yml:655-669`); pre-fix evidence is still refused *by name* (`:638-648`). It is a regression and parity instrument.

**Why it is not evidence of generalization** (each point verified):
1. *The sealed set is the tuning set.* Every fix since 03Y2G was derived from Rarytasy 5-G2E / Kosaćce 46 / Marcówki; a hash gate on the fitting set measures fit. 03Y2G says so itself: "Two houses are not generality" (`03Y2G.md:729`).
2. *Hash equality cannot tell improvement from drift.* An improvement changes the hash and must be resealed; 004A §AA (`:493-495`) records the declined version bump. The gate biases engineering toward "change nothing on the known houses", which is the opposite of what an analyzer that must handle unseen houses needs. It also says nothing about *content*: a stable wrong model passes; there is no assertion on roof kind, mass count or footprint (only `second-house-roof.test.ts`, skipped unless `BUILDAPP_SECOND_HOUSE_DIR` is set, `:26,38`).
3. *`--metrics` replays bypass acquisition and metric extraction* (`second-house.ts:96-127` takes `metric-evidence.json` as given). The three phone failures were upstream of that: `planFrames 1` where the desktop has 4.
4. *Vacuous on outage / missing cache:* replay steps `exit 0` with `::warning::` when no live result or no byte cache exists (`buildapp-ci.yml:631, 636, 640, 729, 735`); the byte cache is filled only by the live fetch of the same job (`.cache/` is gitignored, `.gitignore:23`; the plan images are "not committed").
5. *One URL spelling per project, all clean:* `SECOND_HOUSE_URL`, `THIRD_HOUSE_URL`, `MARCOWKI_URL` (`buildapp-ci.yml:609, 710`, `ui-evidence.yml:39-41`). The tracked Kosaćce URL and e-OZE never enter CI; they arrive only through the OWNER's phone.
6. *CI egress ≠ phone egress.* The emulator job runs on GitHub network; a partial fetch (the phone's actual failure) is not an outage and is not detected — `run-ui-evidence.sh:125,144` treats only `SOURCE_UNREACHABLE|Offline` as a warning; everything else is PASS or FAILED.
7. *`no-reference` / `no-benchmark` prove absence of a runtime import, not generality*, and both are Marcówki-shaped: they replay the sealed Marcówki package (`no-benchmark.ts:75-90`, `no-reference.ts:40-55`) and then **require** ≥ 2 masses, a recess with a return, a stair, a callout, two roof kinds (`no-benchmark.ts:139-147`, `no-reference.ts:91-97`) — a one-mass house would be reported as "collapsed".
8. *`evaluate:v2` in `core` is a report, not a gate:* it prints MATCH/PARTIAL/MISSING per family and `process.exitCode = 1` only on a thrown error (`evaluate-v2.ts:1503`).
9. The ten "holdout" page fixtures of 004A §13 (`generic.test.ts:4`) are **acquisition-shape** fixtures written by the same authors after seeing the failures; they are not holdout in the §38 sense and involve no drawing.

**CI gating map** (`.github/workflows/buildapp-ci.yml`, `ui-evidence.yml`)

| job | HARD | ADVISORY / vacuous-on-outage |
|---|---|---|
| `core` (`:40-115`) | typecheck; `npm test` (1,540; 3 env failures in `worker.test.ts`); API bundle + smoke; web build; `audit:marcowki(+facades)`; `no-reference`; `audit:analyzer-v2`; `no-benchmark`; `audit:exterior` | `evaluate:v2` = report (see 8). **Not in `needs:` of any release job** (`:821`, `:876`). |
| `analyzer-image` (`:116-152`) | build, start, HTTP smoke | real Marcówki through the container: `continue-on-error` (`:135`) |
| `local-analyzer-host` (`:315-377`) | vitest parity Node 18/22; LARCHFIELD fixture parity desktop = Node 18 = Node 22; text-tables `--check` | real Marcówki on Node 18 ± ICU: `continue-on-error` (`:364`) |
| `local-analyzer-device` (`:379-514`) | APK size; **fixture** hashes on the emulator (`FIXTURE_OK`, `run-device-tests.sh:85-88`) | live Marcówki + second house on device: status file only (`:66-79`); desktop-live (`:446`), before-APK (`:453`), device-vs-desktop (`:500`): `continue-on-error` |
| `second-house-generalization` (`:595-693`) | live must COMPLETE (with `--tolerate-source-outage`); Node 18 no-ICU = desktop hashes; garage-gable test; pre-fix refused by name | 3 replay steps `exit 0` on no cache/no live result (`:631,636,640`); "committed post-fix replay" `continue-on-error` (`:649`); Node 18 step tolerant of `SOURCE_UNREACHABLE` (`:663`). **Not** a `needs:` of the OWNER APK. |
| `third-house-kosacce` (`:695-761`) | sealed replay through today's solver = sealed hashes **iff the plan images were fetched** (`:729`); gates OWNER APK (`:876`) | live run `continue-on-error` (`:723`); live = sealed `continue-on-error` (`:733`) |
| `architectural-assemblies` | fixtures/demos | second-house model optional (`:789`) |
| `android-ui-evidence` (`ui-evidence.yml`) | 3 clean-URL slices + alternate publisher: `FAILED` fails the gate | `SOURCE_UNREACHABLE|Offline` → warning (`run-ui-evidence.sh:125,144`); the alternate slice "passes on the path, not on the page" |
| `dependency-security` (`:938-955`) | — | advisory (`:942`) |

---------------------------------------------------------------------------------------------------

## 3. What the known projects share; what shares none (Q3)

**Measured from the four acquired packages** (`scratchpad/acq/*.pkg.json`, `scratchpad/before/*/model.json`):

| | Marcówki GE | Rarytasy 5 G2E | Kosaćce 46 | Rarytasy e-OZE |
|---|---|---|---|---|
| publisher / adapter | ARCHON / `archon.pl` | same | same | same |
| assets / plan assets | 20 / 8 | 37 / 4 | 31 / 4 | 38 / 4 |
| plan copies per storey | 853 D, 550 D, 400 D, 853 A(rea table) — **all GIF** | same set | same | same |
| storeys (plan roles) | GROUND + ATTIC | GROUND only (1 level in model) | GROUND only | GROUND only |
| other sheets | 4 elevations (front, rear, 2 sides), 1 section, 1 site plan, 4–25 renders | same | same | same |
| published fact keys | footprint_area, total_area, building_height, roof_area, volume, house_net_area, … | same | same | same |
| main roof | GABLE 40° ridge Z + FLAT attached | GABLE 30° X | GABLE 35° X + 2 FLAT | — |
| masses / rooms | 2 / 12 | 2 / 9 | 3 / 10 | — |
| model footprint vs published | 130.79 / 131.16 (−0.3 %) | 184.22 / 189.77 (−2.9 %) | 162.28 / 164.47 (−1.3 %) | fails |
| plan drawing | solid grey wall bands, orthogonal, chains in cm top + left, "archon" watermark, area-table twin | same | same | same |

**What they share and the test corpus never varies:** one publisher and one CMS; one page/markup family (fancybox endpoints, `__NNNN` filename ladder); GIF only; a fixed 4-copy ladder with an AREA_TABLE twin; identical sheet set; identical fact-key vocabulary; a single-gable main roof; orthogonal walls only; ≤ 3 masses; a published footprint that the layout gate can check against; the same solid-wall drawing style at 853 px.

**A house that shares none of it** — and what the code does with it (each verified, none is exercised by any current test):
- *Other publisher, markup, language*: generic adapter path; `generic-source.test.ts:94-115` proves only the *synthetic* house on an unknown site.
- *Plans as PDF/SVG*: `IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)/` (`discovery.ts:114`) → no candidates, no plan (`PLAN_NOT_FOUND`); *WebP plans*: probed (`image.ts:54-66`) but `decodeByFormat` has no decoder → `NOT_DECODABLE` (unimplemented, not source-limited).
- *A single plan copy, JPEG/PNG, one size*: no fallback exists; the whole run rests on that copy (§4e).
- *Plan with no dimension chains at all* (areas or scale bar only): `PLAN_NO_DIMENSION_FRAME` (Rarytasy-G2E 853 A and 400 D give exactly this, chains 0/0).
- *Hatched/outlined walls instead of solid poché, coloured rooms, furniture, watermark*: the 550 px copy already shows light-grey walls with thin outlines and drops the opening callouts (image inspected); synthetic clutter (`fixtures.test.ts:52`) is names + areas on a clean solid-wall sheet.
- *Hip, mono-pitch, flat main roof*: model `RoofKindSchema = ['GABLE','FLAT']` (`schema.ts:360`); an unknown roof with rise > 0.4 m becomes **GABLE by convention** (`roof-systems.ts:208-209`).
- *Non-orthogonal walls, bays, curved walls*: decomposition needs bands along both axes (`failure.ts:27-28`, `plan-diagnostics.ts:79`).
- *L/T/U footprints, wings on the left/rear, integrated garage, courtyard*: the generator draws wings on the right only (`house.ts` `SyntheticWing`: "shares the main body's right-hand wall") — §4d.
- *No published footprint*: the only independent check disappears (`layout-gate.ts:146 if (published && builtArea > 0)`).
- *Basement, three storeys, split levels, detached annex, multi-family*: none drawn.
- *Mirrored variants ("odbicie lustrzane")*, rotated sheets: no test; the analyzer assumes chains top + left.

---------------------------------------------------------------------------------------------------

## 4. Metamorphic gates (Q4) — designed, and run against today's code where the existing seams allow

Common helper `architecturalSummary(result)` → `{outcome, storeys, masses, roof:{kind,ridgeAxis,pitchDeg}, footprintM2, widthM, depthM, openings, rooms}` and `equivalent(a,b,{pxM}) → string[]` (violations): masses/storeys equal; roof kind + ridge axis equal; pitch ±2°; footprint ±3 %; overall W/D ±(0.05 m + 2 px at the transformed copy's scale); openings ±1. **Hash equality is never required across a transform.** Outcome lattice for all gates: `COMPLETED_FULL > COMPLETED_LIMITED > TYPED_SOURCE_LIMITED > TYPED_ALGORITHMIC > UNTYPED (ANALYSIS_FAILED, MODEL_EMISSION_FAILED, INTERNAL_ERROR, timeout, OOM) > SILENT_WRONG`. `SILENT_WRONG` (completed, contradicts an independent constraint or the un-transformed run) ranks **below** a failure.

### (a) Source invariance over the publisher seam

Seam: `syntheticPublisher({projects, redirects, beforeRespond})` → `{adapter, deps:{fetchImpl,resolve}}`, `memoryByteCache()`, `runAnalysis({kind:'URL',url},{adapters:[publisher.adapter], deps: publisher.deps, cache, now})` (as `service.test.ts:30-37`). The fake server routes by `url.pathname` (`publisher.ts:106`), so query and fragment are ignored server-side.

Variants: base; tracking `?utm_source=…&gclid=…&_gl=1*2x916*_up*MQ..`; the same in a different key order; `#plans`; trailing-slash → 302 to canonical (`redirects`); tracked → 302 to canonical; upper-case host; **plus seeded harmless ordering** (shuffle `<a class="sheet">` order in the page, jitter `beforeRespond` per asset so responses complete in random order), asset-fetch concurrency.

**Measured today** (`meta-a.ts`, LARCHFIELD through full `runAnalysis`):
| variant | model | scene | `pkg.id` | `canonicalUrl` |
|---|---|---|---|---|
| base / `#frag` / trailing-slash redirect / tracked-redirect / upper-case host | `0f074a7c84` | `0c1ba245a2` | `src-larchfield-lf01-26…` | canonical |
| tracked | same | same | `…-b9…` | **keeps the whole query** |
| tracked, keys reordered | same | same | `…-d7…` | **keeps the whole query, other order** |

`security.ts:89 url.hash = ''` handles fragments; the query is preserved verbatim (`acquire.ts:170-171 id: stableId('src', externalId, {canonicalUrl: pageUrl})`). Model/scene identity comes from `externalId` (`identity.ts`), so on the desktop the tracked Kosaćce URL yields the same model (as the brief's acquisitions show) but **three different package identities for one page**. Gate: HARD `modelHash`, `sceneContentHash`, `identityOf(pkg).modelId` equal across all variants (passes today); HARD `logicalSourceKey = adapter.id + ':' + externalId` equal (passes); SOFT→HARD after a canonicalizer exists: `pkg.canonicalUrl` equal and `requestedUrl` retains the original (fails today for the two tracked variants). A canonicalizer must drop only a documented tracking list (`utm_*`, `gclid`, `fbclid`, `_gl`, `_ga`, `msclkid`, `mc_*`) and sort what remains — never drop unknown keys blindly. Because the desktop is invariant, this gate would **not** have caught the phone failure; it closes the identity hole and the header/markup variation still needs the fault injector of (e).

### (b) Image transforms over the synthetic drawings

Transforms on the *encoded sheets* (test-only `packages/synthetic-drawings/src/transforms.ts`: bilinear resize, `jpeg-js` round-trip, linear contrast compression, grayscale, crop/pad, threshold, and a GIF quantizer — extend `gifBytes` in `source-package/test/helpers.ts:52` to an n-colour palette, since ARCHON is all GIF and no solver-level test uses GIF). Classes: **MILD** (0.75×, 1.25×, JPEG q70, contrast 40–215, grayscale, crop 2 px, binarize) must be equivalent; **STRONG** (0.5×, 0.6×, 1.5×, JPEG q40) equivalent *or* `TYPED_SOURCE_LIMITED`; never `SILENT_WRONG`, never `MODEL_EMISSION_FAILED`.

Note the existing perturbations (`fixtures.test.ts:49-54`) **re-render the vector spec** at 30 px/m (×0.79), heavier lines, tighter margin, clutter 0.8; they never resample a raster and never go below 30 px/m, whereas the real copies are ~41 (853), ~27 (550) and ~20 (400) px/m.

**Measured today** (`meta-b.ts`; 5 fixtures; baseline = untransformed run; tolerances above): 43 cells, **12 violations (9 silent)**.
- MILD class (32 cells): **4 violations** — Ashby 0.75× (depth 6.20 → 5.81, footprint −6.2 %); Redmire 0.75× (pitch 32.0 → 29.9°); **Redmire 1.25× → `PLAN_NO_ENCLOSED_CELLS`** (the same drawing 25 % larger fails); **Holloway 0.75× → 1 mass instead of 2, footprint 107.28 → 85.52 m² (−20.3 %), openings 7 → 6, COMPLETED**.
- STRONG class (11 cells): **8 violations** — Holloway 0.5×/0.6×/1.5× lose the garage (−19…−20 %); Larchfield 1.5× pitch 35.0 → 32.8°; JPEG q40: Ashby loses its roof (`mainRoof` undefined, width 7.80 → 7.48), **Marlow loses its wing (2 → 1 mass, −21 %, 8 → 6 openings, roof lost) and COMPLETES**, Redmire and Larchfield → `MODEL_EMISSION_FAILED` (an internal-contract failure reachable from image noise).
- Invariant today: crop 2 px, grayscale, binarize and contrast leave every architecture unchanged (and, for grayscale/crop, the model hash identical on Marlow/Holloway/Larchfield/Redmire); JPEG q70 keeps every architecture.
- Cost: 4–14 s per cell → the 43-cell matrix ran in ≈ 5.5 min; a CI subset (3 fixtures × 8 transforms) ≈ 2.5 min.

Predicted gate state today: MILD hard gate **fails 4/32**; therefore land it as `xfail(strict)` cells that must be promoted as the algorithm improves (§6).

### (c) Deterministic candidate ordering

Seeded Fisher–Yates over `graph.observations/coordinateFrames/relations` and `metrics.chains/evidence/coordinateRegistrations/ocrTokens`, and over the **sheet/asset order of the package** (rebuilding graph and metrics from it), plus publisher response-order jitter (a). **Measured today** (`meta-c.ts`, `meta-c2.ts`): 3 houses × 3 seeds at solver level and 2 houses × 3 seeds at package-order level → **graph hash, metrics hash, candidate hash and model hash identical in 21/21**. HARD gate, cheap (33 s + 46 s), keep. The 132 `localeCompare` sites in `packages/*/src` depend on the phone's text adapter for ICU-free parity; that is already gated (`local-analyzer.test.ts:228-250`, `generate-text-tables.mjs --check`).

### (d) §33 shape families — what exists through the analyzer (drawing → model), what must be drawn

Ran variants of HOLLOWAY at native 38 px/m through sheets → package → observations → metrics → v2 (`meta-d.ts`):

| family | drawn today? | measured through the analyzer |
|---|---|---|
| rectangle, 1 storey | ASHBY, DUNMORE, HATHERLEIGH | ok |
| rectangle, 2 storeys; attic | LARCHFIELD, BRACKENHOLT…; IVYBANK (`attic` 1.8 m, `fixtures-v2.ts:303`) | ok (fixtures-v2 tests) |
| L (wing flush with front) | derived variant | 2/2 masses, footprint exact |
| T-like (wing centred) | derived variant | 2/2, exact |
| attached garage, flat / gable; 2-storey gable wing | HOLLOWAY / MARLOW / derived | ok |
| recess / loggia / upper inset / balcony | REDMIRE, DUNMORE, KELSALL, LINDALE | ok at 38 px/m; REDMIRE fails at 1.25× |
| **large glazing** | only decomposition-level (`wide-openings.test.ts`, hand-drawn 460×480 at 5 cm/px, 12 px walls) | 4.2 m glazing in a house sheet: ok |
| **wide garage door (3.2 of 3.6 m) / narrow wing (2.4 m)** | derived variants | **wing dropped: 1/2 masses, −20.1 % / −14.4 %, COMPLETED, no code** |
| U / courtyard (two wings), wings on left/rear, integrated garage | **cannot be drawn** (wings attach right-hand only) | — |
| hip, mono-pitch, flat main roof | **cannot be drawn** (`roof.ridgeAxis` gable only; wings `FLAT|GABLE`) and **cannot be represented** by the model (`RoofKindSchema`) | — |
| non-orthogonal / bay / curved | **cannot be drawn** | expect `PLAN_NO_WALLED_ENVELOPE`, must not be a wrong model |

Must be drawn (generator work): wings on any side and in pairs (U, T proper), integrated garage, hip/mono-pitch/flat main roof on the elevations, 45° bay, wide sliding glazing 4–6 m inside a house sheet, a basement/half level, a rotated and a mirrored sheet, hatched-wall drawing style, AREA_TABLE-style clutter at real font size (10–12 px, m² glyph, multi-word names). Expected: for every family the analyzer returns an equivalent architecture or a typed limit — **hip/mono-pitch may not return `GABLE` as READ**; `ROOF_BY_CONVENTION` must cap the result class.

### (e) Plan-copy-loss gate

*Real-data version (runs today, seconds each):* `second-house.ts --package … --graph … --metrics … --drop-frames <ids>` on the sealed evidence. **Measured** (`copy-matrix.ts`, 36 runs, solver alone 4–20 s each; sealed desktop evidence of all four projects; ground-storey copies varied, upper storey untouched):

| copies available (ground) | Kosaćce 46 | e-OZE | Rarytasy 5-G2E | Marcówki |
|---|---|---|---|---|
| all four | OK `5b5ffcf1` | **NO_WALLED_ENVELOPE** (chains 81/9) | OK `8fa4a25b` | OK `6152770f` |
| only 853 D | OK | NO_WALLED_ENVELOPE | OK | OK |
| only 853 A | **LAYOUT_REJECTED / FOOTPRINT_AREA_WRONG** (70/4 chains, 2.4057 cm/px, 2 masses) | NO_WALLED_ENVELOPE (62/3) | **NO_DIMENSION_FRAME** (0/0) | OK but **different model** `67c0bbeb` (41 walls / 20 openings / 11 rooms vs 40 / 21 / 12) |
| only 550 D | NO_WALLED_ENVELOPE (45/2, **2.527 cm/px**) | LAYOUT_REJECTED/FOOTPRINT_AREA_WRONG (2.222) | NO_WALLED_ENVELOPE (3.717) | NO_MASSES |
| only 400 D | NO_WALLED_ENVELOPE (**1.677**) | NO_WALLED_ENVELOPE (**1.525**) | NO_DIMENSION_FRAME | NO_MASSES |
| all but 853 D | **NO_WALLED_ENVELOPE** | LAYOUT_REJECTED | **NO_WALLED_ENVELOPE** | **NO_MASSES** (though 853 A alone succeeds) |
| all but 550 D / 400 D / 853 A | OK | (fails as always) | OK | OK |

Reading: (i) the 853 D copy is the single point of failure of 3/3 solvable projects; (ii) **no 550 or 400 copy solves any project alone (0/8)**; (iii) the scales read from the small copies are physically inconsistent with the 853 copy — a 550 px copy of the same drawing at 0.645× must read ≈ 1.55× the cm/px (≈ 3.7), it reads 2.53 (Kosaćce) and 2.22 (e-OZE); the 400 copy reads **less** than the 853 copy (1.68, 1.53) — the chain OCR is wrong on small copies; (iv) `layout.ts:194-246` orders `DIMENSIONED` first then larger area, reads the first copy that yields an extent and `break`s (`:245-246`): it never tries the next copy when the first one fails later, which is why Marcówki "all but 853 D" fails although 853 A alone succeeds; (v) the phone's `planFrames 1` case is exactly row "only 853 A" and reproduces the OWNER's numbers to the digit for Kosaćce.

*Gate (hard once green):* for every project with sealed evidence, for every non-empty subset S of its plan copies: `outcome(S) ∈ {equivalent(architecture, outcome(all))} ∪ {TYPED_SOURCE_LIMITED with reason PLAN_COPIES_INSUFFICIENT}`; **forbidden**: `PLAN_LAYOUT_REJECTED/FOOTPRINT_AREA_WRONG` or `NO_WALLED_ENVELOPE` when S contains a copy the oracle calls *sufficient* (oracle = a copy that solves the project alone in the sealed baseline, or ≥ 8 px cap-height chain digits + ≥ 4 px walls per the pre-registered checklist). Typed reasons that do not exist yet and must be added to `RECONSTRUCTION_FAILURE_CODES` (`failure.ts:16-58` has none): `PLAN_COPIES_INSUFFICIENT`, `PLAN_ROLE_ASSETS_LOST` (acquisition failures on plan-role candidates, from `pkg.failures`, surfaced by `run.ts`/`acquire.ts`).

*Synthetic version (closes the fixture gap):* extend `syntheticPublisher` to publish a ladder of copies per storey — D853-like (38 px/m), D550-like (0.645×), D400-like (0.47×) and an **AREA_TABLE twin** (same geometry, chains removed/replaced by area labels; needs `SheetOptions.chains: 'NONE'|'ALL'` and real-size clutter) — as **GIF** with `annotation` per copy (`publisher.ts:160` hard-codes `DIMENSIONED`). Add a **fault injector** on `fetchImpl`/`beforeRespond`: fail chosen URLs (404/5xx/timeout/abort), truncate bodies, drop the endpoint page, throttle. Expected: fault on `k` plan-role assets → result carries `PLAN_ROLE_ASSETS_LOST` in its diagnostics and any layout failure is labelled source-limited; never a bare `FOOTPRINT_AREA_WRONG`.

### (f) Threshold cliff detector (new, cheap, catches calibration leakage)

Solver-alone replays cost 4–20 s. For each sealed dev project, sweep each named numeric constant of the plan/layout/roof/opening passes by ±20 % (one at a time, via an injectable `options.constants` override) and record the outcome class. A constant that flips any dev project's class inside ±20 % sits on a cliff and is a calibration candidate; the report lists `constant × project → flip`. Advisory first, then a ratchet ("no new flips").

### (g) Twin-copy consistency on real evidence (new)

For each project with both an 853 D and an 853 A copy, `equivalent(outcome(D), outcome(A))` — same geometry, different text. **Measured today: 1 of 4 equivalent-ish (Marcówki, with 1 wall / 1 opening / 1 room difference), 3 of 4 not** (Kosaćce and e-OZE fail on A, Rarytasy-G2E 0 chains). This is a real-data metamorphic relation that needs no new fixture and directly measures clutter sensitivity of the chain reader.

---------------------------------------------------------------------------------------------------

## 5. BLIND HOLDOUT protocol §38 (Q5)

### 5.1 Enumeration (read-only, verified 2026-09-29T21:18Z)

- `https://www.archon.pl/robots.txt` (200; sha256 `f193203a09b767915b794ea5b8b1edce684cfbcdcd89c2b61cd099831b5fa1d0`): `Sitemap: https://www.archon.pl/sitemap.xml`; `/projekty-domow/` is **not** disallowed (only `/projekty-domow/filtr/` and `*/filtr?`).
- `https://www.archon.pl/sitemap.xml` (200; 397,367 B; sha256 `772bd9d050210c2ac8bd5febc158c3e3e7107101e28ba77807321e20b3338237`; `Last-Modified: 2026-09-29 11:30:09 GMT` → **it changes daily, so the pool must be snapshotted**): a single flat `urlset` (no sitemap index, no pagination), 3,950 `<loc>`, of which **3,257** match the canonical project form `https://www.archon.pl/projekty-domow/projekt-<slug>-m<13 hex>` (no query, fragment, or trailing slash; every `/projekty-domow/…` URL is of this form). No `lastmod` on project entries.
- Cross-check by listing: `https://www.archon.pl/projekty-domow` shows "3258 projekt", 36 cards per page, `?page=N` pagination (96 page links), each card carries `data-webid="m<13hex>"`, name, "powierzchnia domu", "jednorodzinny parterowy"; category pages (`…-pc1073?page=N`) paginate the same way. The listing exposes area and storey type but **no drawing metadata**, so "page lacks drawings" cannot be decided before fetching; only product type can be decided from the slug.
- Slug prefix distribution: `dom-*` 3,080; `willa-*` 111; `garaz-*` 38; `domek-letniskowy` 16; `wiata-*` 6; `rezydencja-*` 2; `g10|g17|g36|g38-budynek…` 4.

### 5.2 Family de-duplication (over-merge is the safe direction for an exclusion)

`slug = basename − "-m<13hex>" − "projekt-"`, tokens split on `-`; if `tokens[1] ∈ {w,we,pod,przy,na,nad,u,za,przed,obok,ze,z,do,o,po}` and there are > 2 tokens → **family = first 3 tokens** (`dom-w-rarytasach`), else first 2 (`willa-julia`). This maps `dom-w-rarytasach-5-g2e`, `…-e-oze`, `…-2` and `dom-w-kosaccach-46`, `…-46-g2` to the same family. Variant vocabulary observed after the stem (informational only): `ver 483, g2 381, oze 339, e 320, g 195, g2e 159, ge 141, b 111, p 77, r2 69, a 53, n 49, t 42, gb 40, r2b 39, s 28, g2p 28, w 25, gr2 24, g2n 23, …` — a suffix vocabulary is open-ended, hence the first-3-tokens rule, not a suffix strip. Verified: the rule excludes all 3 `marcowk`, all 15 `rarytas`, all 107 `kosacc` URLs; the pool contains none of the four development codes.

### 5.3 Pool, exclusions, hash

Pool = canonical URLs from the frozen sitemap, **minus** non-house slugs (`^(garaz|wiata|g\d+-|budynek|altana|domek-gospodarczy)`: 48), **minus** every development family — derived, not typed: the family of every `canonicalUrl` in any sealed `source-package.json` under `stage-reports/` or `holdout/` (today `dom-w-marcowkach` 3, `dom-w-rarytasach` 15, `dom-w-kosaccach` 107 = 125 URLs; e-OZE is inside the Rarytasy family; benchmark families = the same set; the alternate-Marcówki publisher is another site) — sorted by default JS string order (UTF-16 code units; ASCII only, so no ICU and no `localeCompare`).
Snapshot on 2026-09-29: **n = 3,084**, **773 families**, `POOL_SHA256 = b5419c1213692110ba218ab49db6ad3a22eea8da78e54789d389f276ea0a9495` (over `url + "\n"` lines). Largest family: `dom-w-malinowkach`, 128 URLs = 4.15 % of a URL-uniform draw (411 singleton families). The pool grows daily; freeze it in the repo at the freeze commit.

### 5.4 Selection (exact)

```
seed  = SHA256_hex( utf8( PRE_HOLDOUT_SHA + "BUILDPLAN-005A-BLIND-HOLDOUT" ) )      // 40-hex lowercase SHA, no separator
i1    = BigInt("0x"+seed) mod n ;  U1 = pool[i1]
i2    = first j = (i1+k) mod n, k = 1..n-1, with family(pool[j]) ≠ family(U1) ;  U2 = pool[j]
```
Self-test with a dummy SHA (all zeros / all ones — **not a real draw, no URL is recorded here**): n = 3084, deterministic across calls, different SHAs give different indices, families of the two picks differ.

### 5.5 Freeze order and anti-grinding

1. **T0 pool freeze**: commit `holdout/pool.txt`, `holdout/pool.meta.json` (sitemap/robots hashes, fetch time, `POOL_SHA256`). 2. **T1 code freeze**: all 005A changes merged, all dev gates green; `PRE_HOLDOUT_SHA = git rev-parse HEAD` is written into the stage report header *before* selection is run. 3. **T2 select** (script below): refuses unless `HEAD == PRE_HOLDOUT_SHA`, tree clean, pool hash equals the committed `POOL_SHA256`; appends the draw to the append-only `holdout/LEDGER.ndjson`; prints two URLs. 4. **T3 acquire once** with the frozen build; run production `runAnalysis` on Node 22 **and** the shipped bundle on Node 18 no-ICU; store sealed evidence. 5. **T4 verdict** per §5.6. 6. **T5 burn**: any code change after T2 voids the holdout — its two families join the development set (excluded next time, registry updated, R1–R2 guard them), the results stay in the ledger, and a new draw needs a new `PRE_HOLDOUT_SHA`. **Every draw ever made is reported; a re-draw never replaces a bad draw** (empty commits to fish for an easy URL are visible in the ledger). If the publisher is unreachable, retry ≤ 3 times over 24 h; if still unreachable after 7 days take the next index with a different family and record it — no other ground for skipping. Do not open the pages before T3.

### 5.6 Verdicts (pre-registered predicates)

Per URL, artifacts of the production run: `result-summary.json | failure.json`, `analysis-trace.json`, `source-package.json`, `metric-evidence.json`, overlays.
- **PASS** — `COMPLETED`; hash-replay byte-identical; Node 18 no-ICU = desktop model hash; `verifyReplay` ok; **independent checks hold**: footprint within 6 % of `footprint_area` when published (`layout-gate.ts:147`, the existing `FOOTPRINT_AREA_AGREES` band), storey count = distinct plan storeys in the package, mass count and overall W/D consistent with the plan overlay and with the elevation spans; no `MODEL_EMISSION_FAILED`/`INTERNAL_ERROR`; within the resource budget (≤ 8 min desktop, ≤ 2.5 GB RSS). Named `unresolved` items are allowed; they are reported, not hidden.
- **SOURCE_LIMITED_PARTIAL** — failure or limited completion **and both**: the analyzer itself emitted a typed source-limited reason (`SOURCE_INCOMPLETE`, `NO_DRAWINGS`, `SOURCE_REQUIRES_RENDERING`, `PLAN_NOT_FOUND`, `PLAN_COPIES_INSUFFICIENT`, `PLAN_ROLE_ASSETS_LOST`) **and** a reviewer who did not write the fix confirms from the raw acquired copies with a pre-registered checklist that the evidence is insufficient (no floor plan; no legible overall dimension ≥ 8 px cap height on any copy; walls < 4 px; asset lost in `pkg.failures`). A format nobody decodes (WebP/PDF) is *unimplemented*, not source-limited.
- **ALGORITHMIC_FAIL** — anything else: an untyped failure/crash/timeout/OOM; any solver-level failure (`PLAN_NO_WALLED_ENVELOPE`, `PLAN_LAYOUT_REJECTED`, `PLAN_NO_MASSES`, `PLAN_NO_ENCLOSED_CELLS`, `MODEL_EMISSION_FAILED`, …) while the checklist says a sufficient copy exists; and **COMPLETED but wrong** (footprint > 20 % off the published one, storey/mass mismatch against the plan overlay, Node 18 ≠ desktop). Silent wrongness is the worst outcome.
- **Statistics, stated honestly:** with two draws, one `ALGORITHMIC_FAIL` rejects "the analyzer is generic"; two `PASS` do not establish it (if the true pass rate were 0.6, P(both pass) = 0.36; the 95 % upper bound on the failure rate after 0 failures in *n* draws is ≈ 3/n = 150 % for n = 2). Treat the holdout as a smoke alarm, accumulate the ledger stage after stage, and never present 2/2 as a generalization rate.

### 5.7 Script sketch

Working sketch (parses, self-tested on the frozen sitemap with a dummy SHA; never fetches a project page): `.../council/g-work/holdout-select.mjs`. Core:

```js
const URL_RE = /^https:\/\/www\.archon\.pl\/projekty-domow\/(projekt-[a-z0-9-]+)-(m[0-9a-f]{13})$/
const PREP = new Set(['w','we','pod','przy','na','nad','u','za','przed','obok','ze','z','do','o','po'])
const NOT_A_HOUSE = /^(garaz|wiata|g\d+-|budynek|altana|domek-gospodarczy)/
export const family = (slug) => { const t = slug.replace(/^projekt-/, '').split('-'); return (t.length > 2 && PREP.has(t[1]) ? t.slice(0,3) : t.slice(0,2)).join('-') }
// enumerate: GET robots.txt (assert /projekty-domow/ allowed) + sitemap.xml → <loc> → URL_RE → drop NOT_A_HOUSE → drop developmentFamilies() → sort() → pool.txt + meta(sha256s)
export function select(poolText, preHoldoutSha) {
  const pool = poolText.split('\n').filter(Boolean)                                      // must equal its own sort()
  const seed = sha256(preHoldoutSha + 'BUILDPLAN-005A-BLIND-HOLDOUT')
  const i1 = Number(BigInt('0x' + seed) % BigInt(pool.length)), f1 = family(URL_RE.exec(pool[i1])[1])
  for (let k = 1; k < pool.length; k++) { const j = (i1 + k) % pool.length; if (family(URL_RE.exec(pool[j])[1]) !== f1) return { seed, n: pool.length, i1, i2: j, urls: [pool[i1], pool[j]] } }
}
// select mode: HEAD === --pre-holdout-sha, `git status --porcelain` empty, sha256(pool.txt) === --pool-sha256, then append to holdout/LEDGER.ndjson
```

---------------------------------------------------------------------------------------------------

## 6. Known-development regression matrix §25 (Q6)

**"No regression" is a lattice, not a hash.** For each row the current class and architecture are the floor; a change may move a row up, never down; a `COMPLETED` row must keep `architecturalSummary` within tolerance (footprint ±1 % of baseline, masses/storeys/roof kind+axis equal, openings and rooms ≥ baseline, L2 count not lower, `unresolved` ⊆ baseline ∪ explicitly-new). Hash equality is demanded only under `--frozen` (same `SOLVER_V2_VERSION`, no rule change). An intended hash change needs a **reseal record** — `(project, old hash → new hash, architectural diff, reason)` — reviewed by the OWNER; resealing to turn CI green without that record is forbidden. Rows currently failing are `xfail(strict)`: fixing one must promote it and may not lower another.

| # | case | input | expected today (measured) | target / what "no regression" means |
|---|---|---|---|---|
| 1 | Marcówki (specialist) | live URL / sealed pkg | COMPLETED, model `6152770f43f4970a`, scene `8c7d43956d74d252`, 205 cmds, 2 masses, 12 openings (21 in model), 12 rooms, footprint 130.79 vs 131.16 m² (−0.3 %), 2 unresolved, 4 warnings; 249 s, 1,890 MB | class ≥ COMPLETED_LIMITED; architecture equal; unresolved ⊆ `marcowki-limitations-audit.md` |
| 2 | Rarytasy 5 G2E | live / sealed | COMPLETED, model `8fa4a25bcd587248`, scene `d4e7249bb1bda4b8`, 151 cmds, 2 masses, 14 openings, 9 rooms, 184.22 vs 189.77 m² (−2.9 %), 11 unresolved; 338 s, 2,114 MB; Node 18 no-ICU = desktop (CI) | same; garage gable test |
| 3 | Kosaćce 46 clean | live / sealed | COMPLETED, model `5b5ffcf1afcd2511`, scene `50217b856dfc3d05`, 169 cmds, 3 masses, 13 openings, 10 rooms, 162.28 vs 164.47 m² (−1.3 %), 13 unresolved; 315 s, 2,159 MB | same |
| 4 | Kosaćce 46 **tracked** | `?_gl=…&gclid=…` | COMPLETED, **same** model/scene as row 3; different `pkg.id`, `pageHash`, candidate hash | same model; add: same `logicalSourceKey`, canonical URL (§4a); on the phone it must equal row 3 |
| 5 | Rarytasy e-OZE | live / sealed | **FAILED** `PLAN_NO_WALLED_ENVELOPE` (853 D: 45 bands, chains 81/9, extent = a 720×68 px strip; all four copies fail, §4e) — 307 s, 2,034 MB | `xfail(strict)`; target: COMPLETED with footprint within 6 % of **122.07** m², *or* a typed source-limit that a reviewer confirms; **not** a `FOOTPRINT_AREA_WRONG` |
| 6 | alternate Marcówki (generic publisher, 550 px only) | `projektydomownowoczesnych.pl/…` | FAILED `PLAN_LAYOUT_REJECTED/FOOTPRINT_AREA_WRONG` 19.56 vs 131.16 m² (scale read 1.5915 cm/px, wrong); 112 s | `xfail(strict)`; target `TYPED_SOURCE_LIMITED: PLAN_COPIES_INSUFFICIENT` |
| 7 | plan-copy matrix (§4e) | 4 projects × 9 subsets = 36 runs, 4–20 s each | see §4e table | outcome(S) equivalent-or-typed; today: 853-D withheld → 3/3 fail, 0/8 small copies solve |
| 8 | twin-copy consistency (§4g) | 853 D vs 853 A per project | 1/4 equivalent-ish | equivalent, or A typed-limited when A truly has no chains |
| 9 | synthetic families | 3 v1 + 12 v2 fixtures (`fixtures*.test.ts`) | all pass at native scale | unchanged |
| 10 | metamorphic image matrix (§4b) | 5 fixtures × transforms | MILD 4/32 violate, STRONG 8/11 violate | ratchet down; MILD → 0 |
| 11 | ordering (§4c) | seeded permutations | 21/21 identical | HARD, stays 21/21 |
| 12 | source invariance (§4a) | 7 URL spellings | model 7/7; identity 5/7 | model HARD; identity HARD after canonicalizer |
| 13 | suites | `npx vitest run` | 1,540 pass, 3 env failures (`worker.test.ts`) | no new failures |
| 14 | blind holdout (§5) | 2 drawn URLs | — | no `ALGORITHMIC_FAIL` |

Cost: rows 1–6 ≈ 27 min sequential on the desktop (249 + 315 + 317 + 307 + 338 + 112 s); rows 7, 8, 10, 11 are solver-level (minutes). Node 18 no-ICU parity should extend from {G2E, LARCHFIELD fixture} to all of rows 1–4 (the phone's runtime, ~400 s each).

---------------------------------------------------------------------------------------------------

## 7. Function/capability inventory — the test and CI machinery

| file : symbol | input → output | det. | assumptions / thresholds | evidence consumed / ignored | failure it triggers | alt. hypotheses? | cost | genericity risk | rec. |
|---|---|---|---|---|---|---|---|---|---|
| `tests/architecture/second-house.test.ts` (4 tests) | source text → pass/fail | yes | 16 pkgs + 2 apps + Kotlin; names `rarytas`,`m84f…`; 5-G2E dims in 4 pkgs | comments+strings (names) / Kosaćce, e-OZE, Marcówki | red test | n/a | <1 s | MEDIUM (one project) | REFACTOR into §1.3 |
| `tests/architecture/analyzer.test.ts:72-124,240-257` | text of 6 pkgs | yes | Marcówki 12 numbers by substring (`:107`); strings blanked (`:56`) | code / strings, other projects, 10 pkgs | red test | n/a | <1 s | MEDIUM | REFACTOR |
| `tests/architecture/analyzer-v2.test.ts:85-190` | text of v2 + prod | yes | Marcówki regex; reference ids | code+prose / other projects | red test | n/a | <1 s | MEDIUM | REFACTOR |
| `tests/architecture/reconstruction.test.ts:59-100,197-245` | text of 6 dirs | yes | Marcówki list `:206` in `STRUCTURAL_FILES` only | — | red test | n/a | <1 s | MEDIUM | REFACTOR |
| `tests/architecture/analyzer-api.test.ts:61-88`, `local-analyzer.test.ts:83-141` | esbuild bundle text | yes | `PROJECT_WORDS = /marc[oó]wk|m2fa…/i` (`:25`, `:37`); no JSON inputs | bundle / other projects | red test | n/a | seconds | HIGH (best scan point, one project) | KEEP + widen |
| `packages/synthetic-drawings/src/publisher.ts:65 syntheticPublisher` | projects → `{adapter, deps}` | yes | one PNG DIMENSIONED copy per sheet (`:160`); pathname routing (`:106`); fixed HTML | 1 copy, no GIF, no size ladder, no AREA_TABLE, no fault | `404` only | none | rendering ≈ seconds | HIGH | REFACTOR (multi-copy, GIF, fault injector) |
| `packages/synthetic-drawings/src/house.ts:274 renderGroundPlan` etc. | `SyntheticHouse` → sheets | yes | rect main body; wings right-hand; gable only; 38 px/m default | — | — | none | ms | HIGH | REFACTOR (§4d list) |
| `packages/reconstruction/test/pipeline.ts:41-95 buildFixtureFrom` | sheets → pkg/graph/metrics | yes | every plan `DIMENSIONED` (`:58`), PNG, `publishedFacts: []` (`:74`), one variant | — | — | none | 3–7 s | HIGH | REFACTOR |
| `packages/reconstruction/test/fixtures.test.ts:49-54` | perturbed re-render → topology string | yes | ppm 30, weight 2, margin 92, clutter 0.8 | vector re-render / raster resample | red test | none | tens of s | HIGH | replace by §4b |
| `fixtures-v2.test.ts` (15) | 12 fixtures → per-family asserts | yes | native scale, PNG | — | red test | none | ≈ 1 min | MEDIUM | KEEP |
| `mutations.test.ts` (15), `structural-mutations.test.ts` (14) | source mutations → candidate moves | yes | Larchfield/Marcówki-shaped | — | red test | none | s | MEDIUM | KEEP |
| `wide-openings.test.ts` (15) | hand-drawn 460×480 raster, 5 cm/px, 12 px walls → decomposition | yes | decomposition level only | not full pipeline, not real scale (real 2.4 cm/px, 12 px wall) | red test | none | s | MEDIUM | KEEP + lift to house sheets |
| `wall-topology.test.ts` (17), `failure-codes.test.ts` (8) | synthetic runs → typed code | yes | `publishedFootprintM2` optional (`failure-codes.test.ts:37`) | — | red test | none | s | LOW | KEEP |
| `packages/source-package/test/generic.test.ts` (33) | page HTML shapes → package | yes | "ten holdout fixtures" authored after the failures | markup only, no drawings | red test | none | s | MEDIUM | KEEP; do not call it holdout |
| `analysis-service/test/service.test.ts` (16), `generic-source.test.ts` (7) | URL → hashed building | yes | LARCHFIELD only | — | red test | none | ≈ 40 s | MEDIUM | KEEP + §4a |
| `analysis-service/scripts/second-house.ts:70 secondHouse` | url/package (+graph, +metrics, `--drop-frames`) → artifacts, `--same-as` | yes | `--metrics` bypasses acquisition+metrics; SAME_AS_KEYS (`:194`) | hashes / content | exit≠0 | none | 4–340 s | HIGH | KEEP as driver; add architecture-lattice compare |
| `reconstruction/scripts/no-reference.ts`, `no-benchmark.ts` | sealed Marcówki → structure | yes | ≥2 masses, recess+return, stair, callout, 2 roof kinds | Marcówki-shaped | exit≠0 | none | ≈ 30 s | HIGH | REFACTOR (structure from fixtures) |
| `reconstruction/scripts/evaluate-v2.ts` | building+truth → per-family counts | yes | no score; exit≠0 only on throw (`:1503`) | truth items / — | none | none | s | HIGH | INSTRUMENT (thresholds) |
| `tests/benchmark/structural.test.ts` (22), `second-house-roof.test.ts` (4) | sealed candidate / live dir → asserts | yes | Marcówki expectations; roof test `skipIf(!ready)` | — | red / skipped | none | s | HIGH | KEEP; un-skip in CI job |
| `buildapp-ci.yml` (955 lines, 12 jobs) | — | — | see §2 | — | job red | — | ≈ 2 h device jobs | HIGH | INSTRUMENT: needs, ratchet, partial-fetch class |
| `vitest.config.ts:10-19` | include globs | yes | new dir `tests/metamorphic/**` not included | — | — | — | — | LOW | extend include |

---------------------------------------------------------------------------------------------------

## 8. ASSUMP-TEST register

| ID | current behaviour | why it exists | evidence basis | families that violate | hard/soft | decision |
|---|---|---|---|---|---|---|
| ASSUMP-TEST-001 | a byte-identical sealed replay = no regression (`second-house.ts:157-166,194`; `buildapp-ci.yml:632-633,729-731`) | determinism + Node 18 parity | 3 sealed projects | any improvement; any unseen house; a stable wrong model | soft | soften: architecture lattice + reseal record; hash only under `--frozen` |
| ASSUMP-TEST-002 | three clean URLs represent ARCHON's URL space (`buildapp-ci.yml:609,710`, `ui-evidence.yml:39-41`) | one URL per regression project | the three CI URLs | tracked Kosaćce; variant siblings (e-OZE); mirrored variants | soft | remove; URL-variant matrix (§4a) |
| ASSUMP-TEST-003 | the synthetic publisher models a publisher (`publisher.ts:65-171`) | in-memory determinism | LARCHFIELD end-to-end | all ARCHON: GIF, 4-copy ladder, AREA_TABLE twin, fancybox endpoints, query, fault | soft | branch: multi-copy + GIF + fault injector |
| ASSUMP-TEST-004 | scale robustness = one re-render at 30 px/m (`fixtures.test.ts:50`) | cheap perturbation | LARCH/HOLL/RED | 0.75× resample of Ashby/Holloway/Redmire; real copies at 20–27 px/m | hard | replace by raster resample matrix (§4b) |
| ASSUMP-TEST-005 | re-rendering ≡ resampling (`fixtures.test.ts:49-54`) | no raster transform code | — | Holloway 0.75×: garage lost; Redmire 1.25×: `PLAN_NO_ENCLOSED_CELLS` | hard | remove |
| ASSUMP-TEST-006 | fixtures are `DIMENSIONED`, PNG, no published footprint (`pipeline.ts:58,74`) | simplicity | all fixtures | AREA_TABLE copies; footprint gate untested at fixture level | soft | branch: fixture publishes facts + AREA_TABLE twin |
| ASSUMP-TEST-007 | shape families = rect main body + right-hand wings + gable (`house.ts` `SyntheticWing`, roof) | generator scope | 15 fixtures | hip, mono, flat main, left/rear wings, U, bays, integrated garage | soft | branch: extend generator (§4d) |
| ASSUMP-TEST-008 | Marcówki structure = the proof of "no benchmark" (`no-benchmark.ts:139-147`, `no-reference.ts:91-97`) | prove no runtime reference | sealed Marcówki | any single-mass or stair-less house | soft | soften: structure expected per fixture |
| ASSUMP-TEST-009 | a green `core` means the v2 output matches truth (`evaluate-v2.ts:1503`) | a report exists | Marcówki truth v2 | — | soft | remove: threshold or label as report |
| ASSUMP-TEST-010 | leakage = names + hand-typed numbers (7 files, 11 lists) | incremental history | Marcówki, 5-G2E | Kosaćce, e-OZE, every future project | hard | replace by §1.3 |
| ASSUMP-TEST-011 | publisher outage = pass-with-warning (`buildapp-ci.yml:631-640,729,735`; `run-ui-evidence.sh:125,144`) | third-party dependency | outages | **partial fetch** (phone: planFrames 1) is not an outage | soft | branch: partial-fetch class (`PLAN_ROLE_ASSETS_LOST`), fail on it |
| ASSUMP-TEST-012 | CI network/emulator ≈ owner's phone; one run suffices | cost | CI green on 3 URLs | phone failures on tracked Kosaćce, e-OZE | soft | branch: fault injector + on-device live status in the gate |
| ASSUMP-TEST-013 | live device results are advisory (`run-device-tests.sh:66-79,85-88`) | flaky network | fixture gates | any real house on the phone | soft | soften: make the OWNER's URL set a tracked, non-blocking ratchet |
| ASSUMP-TEST-014 | solver replay on sealed evidence stands in for the pipeline (`second-house.ts:96-127`) | speed | 3 projects | acquisition- and metric-level failures | soft | keep for speed; never as the only gate |
| ASSUMP-TEST-015 | `core` need not gate the APK (`buildapp-ci.yml:821,876`) | parallel jobs | — | a red architecture/leakage test ships an APK | soft | branch: add `core` (or its analyzer subset) to `needs:` of owner APK |
| ASSUMP-TEST-016 | roof-kind conventions are safe defaults (`roof-systems.ts:208-209`; `schema.ts:360`) | model supports GABLE/FLAT | 4 gable houses | hip, mono-pitch | hard | branch candidate: `UNKNOWN`/unsupported, never READ GABLE |
| ASSUMP-TEST-017 | two/three houses evidence generality | — | 03Y2G says it does not (`:729`) | every unseen house | soft | remove; holdout ledger |
| ASSUMP-TEST-018 | vitest run = the analyzer suites (`vitest.config.ts:10-19`) | one command | 1,540 tests | metamorphic/holdout not included; `second-house-roof` silently skipped | soft | extend include; un-skip |

---------------------------------------------------------------------------------------------------

## 9. Single-hypothesis lock-in points seen through the tests

| point | evidence | retain top-N cheaply? |
|---|---|---|
| **plan copy** | `layout.ts:194-246`: sort (DIMENSIONED, area), first copy with an extent wins, `break`; Marcówki "all but 853 D" fails though 853 A alone succeeds | **yes** — solver alone is 4–20 s vs 249–338 s per run (3–6 %); try the ranked copies until the layout gate accepts |
| **scale** | per-copy chain OCR; 550/400 copies read 2.53/1.68 (Kosaćce), 2.22/1.53 (e-OZE) against 2.41/2.50 on 853 — physically inconsistent | yes — cross-copy scale transfer (same drawing, 0.645× / 0.47×) is a free independent constraint |
| **extent from chains** | e-OZE 853 D: extent = 720×68 px strip from the only READ vertical chain; AREA_TABLE Kosaćce 70/4 chains → 33.15 m² (brief) | yes — extent candidates (chains, longest walls, ink bbox) scored by the layout gate |
| **wing existence** | Holloway 0.75×/0.5×/0.6×/1.5× and wide-door / narrow-wing variants drop the wing silently | yes — keep the dropped body as a scored alternative; elevation span contradicts it |
| **independent corroboration** | gate `STRUCTURAL_LAYOUT_ACCEPTED` with `NOTED:NO_SECOND_VIEW` while the front/rear elevation registrations are `unresolved` | n/a — promote to a class cap |
| **roof kind** | unknown + rise > 0.4 m → GABLE (`roof-systems.ts:208-209`) | yes — `UNKNOWN` alternative |

## 10. Hard vs soft

| gate audited | now | recommendation |
|---|---|---|
| `FOOTPRINT_AREA_WRONG` (BLOCKING > 20 %, `layout-gate.ts:147-151`) | terminal | keep as "do not emit as COMPLETED"; make it the **selector** in the plan-copy loop; terminal only when no copy/extent hypothesis passes, and then typed source-limited or algorithmic |
| `FOOTPRINT_AREA_NEAR` (6–20 %) | DEGRADING | soft score |
| `NO_SECOND_VIEW`, `WIDTH_CORROBORATED` | NOTED | DEGRADING; an uncorroborated result gets a visible class cap and a user-facing "uncorroborated" (partial beats invalid) |
| `WALLS_OVERLAP` and the model validators | hard | **stay hard** (`packages/model`); nothing in my evidence argues for softening |
| `MODEL_EMISSION_FAILED` | untyped-ish, reachable from JPEG noise | must be unreachable from image quality; degrade upstream |
| metamorphic MILD cells | — | hard once green (xfail-strict until then); STRONG soft |
| holdout `ALGORITHMIC_FAIL` | — | hard for the *claim*, never for a release |
| architecture leakage R1–R6 | hard | hard |

## 11. Failure-taxonomy contributions

| code | where met | class | note |
|---|---|---|---|
| `PLAN_LAYOUT_REJECTED / FOOTPRINT_AREA_WRONG` | Kosaćce 853 A; alt-Marcówki; e-OZE 550 | **algorithm assumption** (extent + single copy) reported as a layout verdict; **source limit** only when no legible dimensioned copy exists | needs `PLAN_COPIES_INSUFFICIENT` to separate |
| `PLAN_NO_WALLED_ENVELOPE` | e-OZE 853 D; Kosaćce/G2E 550, 400 | algorithm assumption on 853 D (walls exist, extent wrong); plausible source limit on 400/550 (2–6 of 28–45 chains read) | — |
| `PLAN_NO_MASSES` | Marcówki 550/400 | algorithm | — |
| `PLAN_NO_DIMENSION_FRAME` | G2E 853 A, 400 D (0/0 chains) | 853 A: algorithm (same geometry as the readable twin); 400 D: source limit | — |
| `PLAN_NO_ENCLOSED_CELLS` | Redmire 1.25× | algorithm (scale dependence) | must never fire for an enlarged copy |
| `MODEL_EMISSION_FAILED` | Redmire/Larchfield JPEG q40 | algorithm / unimplemented semantics: image noise reaching the model contract | must be unreachable |
| *(no code)* silent wrong model | Holloway wing, Marlow wing, Ashby roof | **missing taxonomy**: `COMPLETED` while contradicting an independent constraint | worst class |
| `SOURCE_UNREACHABLE` | CI handling | source limitation (outage) — but CI conflates it with partial fetch | add `PLAN_ROLE_ASSETS_LOST` |
| `NOT_DECODABLE` (predicted) | WebP plans | **unimplemented** | not source-limited |

## 12. Top 5 findings

1. **No gate separates fit from generalization; the strongest ones reward standing still.** *Severity: critical.* Evidence: §2 items 1–9; 004A §AA l.493 ("declined for the byte-identity gate"); e-OZE and tracked Kosaćce never in CI; `owner-preview-release` needs no `core`. *Smallest generic change:* replace hash equality by the architecture lattice + reseal record, add leave-one-copy-out (§4e) and the holdout ledger (§5), and put `core` in the APK's `needs:`.
2. **Silent wrong models under benign image perturbation.** *Severity: critical.* Evidence: 9 silent violations of 43 (§4b); Holloway garage lost at 4 of 5 scale transforms; wing lost at native scale for a 3.2 m door or a 2.4 m wing; the gate accepts with `NOTED:NO_SECOND_VIEW` (§9). *Change:* promote uncorroborated results to a visible class cap and keep the dropped body as a scored alternative; land §4b as `xfail(strict)`.
3. **Plan-copy dependence: one of four copies decides, the ranking never tries the next, and small-copy scales are wrong.** *Severity: high.* Evidence: §4e matrix (853 D = single point of failure 3/3, small copies 0/8, e-OZE 0/4; `layout.ts:194-246`); the 853 A twin of identical geometry fails 3/4. *Change:* ranked-copy loop with the layout gate as selector, cross-copy scale transfer, typed `PLAN_COPIES_INSUFFICIENT` / `PLAN_ROLE_ASSETS_LOST`.
4. **The leakage guard is per-project, hand-typed, and misses two of four projects — including a claim the stage report makes.** *Severity: medium (no leak today).* Evidence: §1.2. *Change:* the registry-driven §27 test; measured 0 false positives on 1,664 literals; do not add integer-cm matching (48 false positives).
5. **The synthetic corpus and publisher are structurally easier than the real one.** *Severity: high.* Evidence: one DIMENSIONED PNG copy, no published footprint, ≥ 30 px/m, gable-only, right-hand wings only, model cannot represent hip/mono (`schema.ts:360`), "holdout" fixtures are acquisition-only. *Change:* multi-copy GIF publisher with AREA_TABLE twin, fault injector, generator extensions of §4d.

**What would falsify "the analyzer is becoming generic"** (for the frozen 005A commit): (F1) any blind-holdout draw is `ALGORITHMIC_FAIL`; (F2) any MILD metamorphic cell violates architectural equivalence (today: 4 of 32); (F3) any known project, with one plan copy withheld while a sufficient copy remains, ends in a solver-level failure (today: 3 of 3 solvable projects without their 853 D copy; e-OZE with all four); (F4) the fix for e-OZE lowers the outcome class of any development row, or can only be expressed as a constant that sits within ±20 % of a development project's value (cliff detector, §4f); (F5) the next URL the OWNER pastes fails for a reason the analyzer did not itself type as source-limited.

---------------------------------------------------------------------------------------------------

## Appendix A — reproduction (all read-only; outputs in `…/council/g-work/`)

| artifact | what | run |
|---|---|---|
| `leak-experiment.mjs`, `leak2.mjs`, `leak3.mjs` | registry-vs-literal collision experiments (§1.3) | `node …/leak3.mjs` |
| `meta-a.ts` | source-invariance, 7 URL spellings (§4a) | `cd /home/user/BuildApp && npx vite-node …/meta-a.ts` |
| `meta-b.ts` (+ `meta-b-1.jsonl`, `meta-b-2.jsonl`) | image-transform matrix (§4b) | `HOUSES=HOLLOWAY ONLY=identity,resize0.75 npx vite-node …/meta-b.ts` |
| `meta-c.ts`, `meta-c2.ts` | ordering permutations (§4c) | `npx vite-node …/meta-c.ts` |
| `meta-d.ts` | shape-family variants (§4d) | `npx vite-node …/meta-d.ts` |
| `meta-gate.ts` | layout-gate reasons when the wing is lost (§9) | `npx vite-node …/meta-gate.ts` |
| `copy-matrix.ts` (+ `copy-matrix.jsonl`, `copy-out/`) | plan-copy matrix on sealed evidence (§4e) | `PROJECTS=kosacce-clean npx vite-node …/copy-matrix.ts` (imports `second-house.ts`: creates an empty `.cache/second-house/`, gitignored) |
| `holdout-select.mjs`, `pool.js`, `fam2.js`, `sitemap.xml`, `robots.txt` | enumeration + selection sketch, frozen sitemap snapshot | `node …/fam2.js` |

Images inspected for §3/§4e: Kosaćce 853 D and 853 A overlays (same geometry, same chains `1660/269/665/521/205`, `370/1260/890`; the A copy replaces room numbers with names + m² text) and the 550 px copy (0.645× of the same drawing, light-grey thin-outline walls, opening callouts absent, watermark present).

## Appendix B — items I could not verify

- Whether `core`'s `no-benchmark`/`audit:marcowki` steps see rasters on a cold CI checkout (the byte cache `.cache/source-bytes` is gitignored and no `core` step populates it); the stage reports call CI green. Cross-check: run `reconstruct:no-benchmark` with an empty cache directory.
- Why the phone lost three plan copies (candidates: endpoint or asset fetch failures on the phone network). §4e shows the *consequence* is exactly reproducible; the *cause* needs the phone's `source.failures`.
- Whether the 550/400 copies' chain scales are misread by OCR or the copies are re-framed: the 550 image shows the same framing as 853 (so the read scale 2.53 vs the expected ≈ 3.7 is a misread), but I did not re-derive the OCR trace.
