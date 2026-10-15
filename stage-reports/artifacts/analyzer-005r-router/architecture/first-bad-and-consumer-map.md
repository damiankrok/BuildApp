# BUILDPLAN-ANALYZER-005R-ROUTER — first bad decision and consumer map

Base `8d414567e16e9a790bcf56cbebc10d778c6eb268`. Every line reference below is to that commit and was re-opened for
this stage; nothing is taken from a report's wording alone. Tags: **KNOWN** (read in code), **MEASURED** (counted
in data, with the artefact named), **HYPOTHESIS** (with its test). No publisher pixel, caption or prose is quoted.

## 1. The graph, end to end

| step | code | what it carries about an image | what it drops |
| --- | --- | --- | --- |
| 1. page discovery | `discovery.ts:142-208` (`discoverImages`), `:233-254` (`discoverEndpoints`); ARCHON `adapters/archon.ts:355-372` | `url`, `channel` (`ANCHOR_HREF`, `IMG_SRC`, `OG_IMAGE`, `LIGHTBOX_ENDPOINT`, …), `exposedBy` (page or fragment URL), `locator`, `caption` = `data-caption` ?? `title` (`:155`) or `alt` ?? `title` (`:203`); a fragment image inherits the endpoint's caption (`archon.ts:370`) | **`data-fancybox-position`** (0 hits in `archon.ts` and `discovery.ts`), so the carousel the image sits in (`fancybox3Interiors`, `fancybox3ProdBigImg*`, `fancybox3Elevations`) is never read (KNOWN). The `data-fancybox` group id is not read either. |
| 2. role claims | `archon.ts:118-161` | slug and caption words → `document`/`storey`/`view`/`annotation`; floor fragment index → storey (`:152-160`) | `widok`/`wizualizacj` → `PERSPECTIVE_RENDER` (`:98`) carries no scene scope: the schema has none (`schema.ts:45,49-79`). The claim `detail` is cut to 80 characters (`:126`). |
| 3. merge | `roles.ts:43-63` (`mergeRoleClaims`), `:92-100` (`normalizeRoles`) | per dimension the highest-confidence claim; a tie → `UNKNOWN` plus a `conflict` evidence row | `projection` is derived from `document` (`roles.ts:69-83`) unless an adapter claims it; **no adapter claims `projection`** (grep of `packages/source-package/src`: only `schema.ts`, `roles.ts`, `variants.ts:44`), so in production `PERSPECTIVE_RENDER ⇔ PERSPECTIVE` (KNOWN; MEASURED on 38 ARCHON packages, §5). |
| 4. asset | `acquire.ts:255-331` (`makeAsset`) | group by `groupKey` (variant stem) and identical bytes; caption = the first non-empty caption in selection order (`:330`) | `roleEvidence` is excluded from the package hash (`hash.ts:17,40-46`); edition identity is per package only (no edition field). |
| 5. package | `hash.ts:38-60` (`sourcePackageContentHash`, `:49`) | caption, roles, selected variant, variants are hashed | — |
| 6. analyzer routing | `source-analyzer/src/analyze.ts:122-176` | `CHROME`/`UNKNOWN` skipped before fetch (`:125-129`); every other asset is decoded, its frame declared with a **copy** of the roles (`:154-160`) | **`ELEVATION` and `PERSPECTIVE_RENDER` go to the same five orthographic facade extractors** (`:164-166`, `extractors/elevation.ts:33-39`). The routing never reads `projection`. |
| 7. observation graph | `source-observations/src/builder.ts:122-129`; schema `:370` | frame roles as five free strings | the validator never reads frame roles (005R audit R4-22). |
| 8. metric evidence | `source-metrics/src/extract.ts:88-96,353-356` | **only `ORTHOGRAPHIC_*` frames** (default `frameFilter`; `analysis-service/src/run.ts` passes none) | perspective frames are not read at all. |
| 9. cross-view relations | `source-analyzer/src/identity.ts:67-70` | **only `ORTHOGRAPHIC*` frames** | perspective observations are never related across views. |
| 10. registration | `reconstruction/src/solve.ts:310-313`; v2 `frame.ts:313-350` | **only `ORTHOGRAPHIC_ELEVATION`** frames become metric views | — |
| 11. perspective cameras | `reconstruct-v2.ts:1166-1179`; `camera.ts:835-845` | the solve reads the **raster** (`detectSilhouette(raster)`), never the frame's observations | — |
| 12. ledger | `reconstruct-v2.ts:1148-1152` (LVC on an unregistered view → IGNORED), `:1177` (every observation of a perspective frame → `USED_AS_CORROBORATION` "depth order was checked against it" when the camera solved, else IGNORED), `:1410-1425` (leftovers) | — | **no code checks depth order against those observations** (the solve does not read them, step 11): the ledger asserts a use that did not happen (KNOWN). |
| 13. candidate → model → scene | `reconstruct-v2.ts` emission; `emit.ts` | `CAMERA` features stay in the feature graph; `emit.ts` has no `CAMERA` case (grep) | — |

## 2. Four layers kept apart

1. **Page construction** — the carousel an anchor sits in, the hotspot fragment, the elevation tab, the floor
   fragment. Today: endpoints and floor fragments are read (`archon.ts:152`); carousel position is not.
2. **The image** — its projection (orthographic facade, plan, section, perspective) and its scene (interior,
   exterior, unknown). Today: projection is inferred from words; scene is not represented anywhere in production.
3. **Semantic inference** — `RoleClaim` → merged `SourceRoles`. Today: claims from slug, caption, channel, endpoint.
4. **Hand-off to geometry** — which frames a solver may measure. Today, every geometric consumer (steps 8–11)
   decides by `projection`, and only the analyzer's extractor routing (step 6) decides by `document`.

## 3. The first bad decision

| # | where | what | judgement |
| --- | --- | --- | --- |
| FB-0 | `archon.ts:355-372`, `discovery.ts:155,203` | the structural scene signal (carousel position) is dropped at discovery | **information loss**, not a wrong assertion. It is also the publisher's *filing*, which 005R showed is wrong for 15 exterior views (B-1); reading it would give a hint, not a truth. |
| FB-1 | `archon.ts:98` | "widok"/"wizualizacja" → `PERSPECTIVE_RENDER`, no scene | **correct on its own axis.** An interior visualisation *is* a perspective render. The role is incomplete (no scene), not wrong. |
| **FB-2** | **`analyze.ts:164-166`** | a `PERSPECTIVE` frame is routed into the orthographic facade extractors, which write `SILHOUETTE`, `ROOF_EDGE`, `RIDGE`, `OPENING`, `LOGGIA`, `LINEAR_VOLUME_CANDIDATE`, `WALL_REGION`, `SURFACE_REGION` as facts about the building's facade on it | **the first unsafe evidence assertion.** MEASURED (005R audit §3.3, R3-12): the bathroom render `l3` of g2e carries RIDGE 4 and OPENING 118. It is wrong whatever the scene: every downstream consumer of facade observations refuses non-orthographic frames (steps 8, 9, 10), so the producer is the only component that ignores the projection the role already states. |
| FB-3 | `reconstruct-v2.ts:1177` | the ledger marks those observations `USED_AS_CORROBORATION` | **a false provenance assertion**, made possible by FB-2. |

So the routing defect is a **producer–consumer contract mismatch on projection**, not a missing interior/exterior
classifier. Whether a perspective image is an interior or an exterior decides nothing on the geometric path today,
because no geometric path reads a perspective frame's observations (§4). This is what makes a scene-agnostic gate
possible without scene truth (N1, §7). It also bounds what such a gate can claim: it removes the leak *channel*; it
does not classify anything.

## 4. Consumers of observations on a `PERSPECTIVE` frame (exhaustive over `packages/*/src`, `apps/*/src`)

Found by `grep -rn "\.observations\b"` and `graph.relations` over non-test sources, then read one by one.

| consumer | reads perspective-frame observations? | effect on the canonical model |
| --- | --- | --- |
| `source-metrics/src/extract.ts:353-364` | no (frame filter is orthographic, `:88-89`) | none |
| `source-analyzer/src/identity.ts:67-70` | no (orthographic only) | none |
| `reconstruction/src/solve.ts:321,351` (`registerElevationFrames`, `candidatesFrom`) | no (registered frames only, which are `ORTHOGRAPHIC_ELEVATION`, `:312`) | none |
| `reconstruction/src/audit.ts:110`, `structural-audit.ts:122,151` | registered / orthographic frames only | none |
| `reconstruct-v2.ts:542` | registered frames only | none |
| `reconstruct-v2.ts:744` | section frames only | none |
| `reconstruct-v2.ts:1148-1152` | **yes** — `LINEAR_VOLUME_CANDIDATE` on an unregistered view → `IGNORED_WITH_REASON` | ledger only |
| `reconstruct-v2.ts:1177` | **yes** — every observation → `USED_AS_CORROBORATION` / `IGNORED_WITH_REASON` | ledger only |
| `reconstruct-v2.ts:1410-1425` | yes, for any not consumed above | ledger only |
| `reconstruct-v2.ts:1458` (`ledgerViolations`) | checks every observation id has a disposition | a violation count; none expected either way |
| `analysis-service/src/run.ts:309,524` | counts only | `counts.observations` in the summary |
| `apps/web/src/components/Sources.tsx:117,198,234` | displays them (developer web app, not the APK) | none |
| `image-metrology/src/fuse.ts:103` | takes an observation list from its caller; no production caller passes perspective frames (v1 path, off the product path per 005R audit §3.6) | none |
| vision (`analyze.ts:179-226`) | not observations: `tasksForDocument('PERSPECTIVE_RENDER')` = `FACADE_DECOMPOSITION` (`source-vision/src/tasks.ts:38`) | off in every product path (`nullVisionReasoner`, `run.ts:288`; local analyzer has no provider) |

**HYPOTHESIS H1 (falsifiable, §7):** the canonical model is a function of the orthographic frames' observations,
the metric evidence and the rasters, and not of the observations on perspective frames. Test: model bytes with and
without those observations on every development row.

## 5. Blast radius of changing `PERSPECTIVE_RENDER`, `ELEVATION`, `projection` or `roles.document`

| consumer | depends on | would an enum change (e.g. adding `INTERIOR_RENDER`) break it? |
| --- | --- | --- |
| `source-package/src/schema.ts:45,67,72-79` | the enums; `.strict()` | a new value is unreadable by every client built before it (`z.enum`), and the package `schemaVersion` would have to move (`SUPPORTED_SOURCE_PACKAGE_VERSIONS`, `:38`) |
| `source-package/src/roles.ts:69-90` | `projectionForDocument`, `viewApplies`, `storeyApplies` | a new value falls to `UNKNOWN` projection → the asset becomes non-analysable (`isAnalysable`, `:103`) unless every switch is extended |
| `source-package/src/variants.ts:44` | `roleKey` joins all five roles | variant grouping by role would split |
| `source-package/src/hash.ts:42` | roles are hashed | every package hash moves |
| `source-analyzer/src/analyze.ts:125,164-176` | `document` | routing |
| `source-observations` frame roles `schema.ts:370` | free strings | graph content hash moves (`hash.ts:44`), graph id moves (`ids.ts:74`) |
| `source-metrics/src/extract.ts:88-96,368,388` | `projection`, `document === 'FLOOR_PLAN'` | none for a perspective-only change |
| `reconstruction` `reconstruct-v2.ts:169,230,627,744,1166`, `solve.ts:312`, `layout.ts:364`, `plan-resolution.ts:573,1177`, `structural*.ts`, `views.ts:233-245` | `projection`, `document`, `view` | `viewFamilyOf` maps unknown projections to `PAGE` |
| `analysis-service/src/run.ts:154,253-265` | `DRAWING_DOCUMENTS` includes `PERSPECTIVE_RENDER`; `NO_DRAWINGS` vs `SOURCE_INCOMPLETE` | a re-labelled interior leaves `drawings` counts and the typed failure text |
| `analysis-service/src/cross-source.ts:160-164` | coverage rows per document | descriptive rows change |
| `analysis-service/src/diagnostics.ts:75` | failure claims (`FLOOR_PLAN`) | none |
| `source-vision/src/tasks.ts:38` | `documents: ['ELEVATION', 'PERSPECTIVE_RENDER']` | vision tasks |
| `apps/web` Sources panel | displays | none |
| Android (`apps/android/app/src/main`) | no match for `PERSPECTIVE_RENDER` or `roles.document` | none |

**Offline cache.** A sealed package from the base re-read by new code parses (no enum change). A package sealed by
new code with a new enum value would be **refused by an older APK's bundle**: the reason this stage must not migrate
the enum (brief §6). **Two Node versions.** The local-analyzer bundle runs on the phone's Node 18 build and on
Node 22 on the desktop (005H parity); a routing change that uses only string comparisons and existing builder calls
has no version-specific API. Measured for the adopted change in §8 of the stage report.

## 6. Where provenance is lost (complete list for the image path)

1. Carousel position never read (FB-0).
2. One caption per asset: the first non-empty in selection order (`acquire.ts:330`); a carousel caption can lose to
   an `OG_IMAGE` or `IMG_SRC` caption of a byte-identical copy.
3. Claim `detail` truncated to 80 characters (`archon.ts:126`) and `roleEvidence` excluded from the package hash
   (`hash.ts:17`): editing evidence cannot be detected by the hash.
4. Frame roles are a free-string copy that no validator checks against the package (005R audit R4-22).
5. No edition field: the package id carries the project code; byte-identical interiors across editions are separate
   assets in separate packages (MEASURED 005R: 64 assets byte-shared by ≥ 2 editions). A production run reads one
   package, so production cannot mix editions; research must (005R identity rules).
6. The ledger reason at `reconstruct-v2.ts:1177` claims a check that is not performed (FB-3).

## 7. The 005R research JSON (research-only use)

`research.visual-observations.0.1` and `research.visual-edition-summary.0.1` (`research/analyzer-005r/schema/`) may be
read by research harnesses only. Shipping code may not import or name them: `tests/architecture/research-isolation.test.ts:763-768`
fails on any production import of `research/` and on the names. Typed defects to carry into any successor:
- **publisher filing error** — 15 exterior styling views in the interiors carousel (005R B-1, Addendum C1);
- **competing claims** — a `widok` slug or caption on an image filed under interiors (C1 cases);
- **unlabelled copies** — 150 `widok-N` copies without structural truth (C2);
- **post-hoc truth** — C12 combines C1 and C2 after the reviews; it is DEV / prior exposure, never a new blind.

## 8. 005R numbers re-derived from its artefacts (not from its prose)

`stage-reports/artifacts/analyzer-005r/addenda/addendum-c.json`: `C3_V0a_lineage.EVAL.interiorToExteriorRoutes_perspectiveConsumer`
= 107 interior lineage groups (10 families) reach the facade extractors; DEV 97 assets / 92 groups. Byte-only
matching gave 54 (EVAL). Under C12, V0a resolves 0 of 46 exterior renders (it never resolves a render's scene) and
53/53 technical elevations; N1(005R) 28/46. V1 under C12: 46/46 exterior, risk upper bound 6.15 % > 5 % (§8 bar not
met), and its exterior routes flip under letterboxing (`addenda/a1-v1-c12.json`). These are DEV / prior exposure for
this stage: correlated, publisher-structured, not independent.

## 9. Legality and scope

ARCHON is `USABLE_FOR_LOCAL_RESEARCH` (005R `corpus/source-eligibility.json`): local processing, no redistribution,
no remote model, no claim of a sublicence. DobreDomy, Archipelag and Domy w Stylu are `SOURCE_NOT_USABLE`. Earlier
stages processed DobreDomy (005C, 005K, 005Q-CHAIN rows D00–D05, aster-viii, galaktyka): **OWNER_DECISION_PENDING**,
no legal conclusion drawn here. This stage's replay harness refuses those rows although their bytes are cached
(`research/analyzer-005r-router/replay.mjs`, `USABLE_HOSTS`).

## 10. Three hypotheses for the scene-agnostic gate (N1), each with its falsifier

| | statement | falsified by |
| --- | --- | --- |
| **Why it should work** | Facade extractors assume an orthographic facade; every consumer of their output already refuses non-orthographic frames (§4). Routing them by `projection === 'ORTHOGRAPHIC_ELEVATION'` aligns the producer with its consumers, so the leak channel closes and nothing geometric moves. | Any development row whose `model.json` bytes differ between R0 and N1; any orthographic frame whose observation set (ids and content) differs; a different metric-evidence hash. |
| **Why it might fail** | A consumer missed by §4 reads perspective observations indirectly: the ledger completeness check, the LVC loop, a quality level, a warning, a camera feature, or a test that pins the old behaviour. | `ledgerViolations > 0`; any changed field of the summary other than `observationGraphHash`, `candidateHash`, `counts.observations`; a difference in the `perspective cameras` step detail; any red test other than the one asserting that a render carries observations. |
| **What would refute the safety claim outright** | The gate drops evidence that a correct model needs: a technical elevation or an orthographic render filed as `PERSPECTIVE_RENDER`, or a perspective frame whose projection an adapter set to orthographic. | Any `PERSPECTIVE_RENDER` asset with a non-`PERSPECTIVE` projection in a sealed package; any orthographic frame losing observations; non-determinism of R0 or N1 across two input orders. |
