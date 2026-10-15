# 005R draft audit: corrections from the completeness check

I spot-checked 24 claims in `/home/user/work005r/audit/current-pipeline-audit.draft.md` by reopening their citations at HEAD `80b455d`. 14 checked out (one of those has a weak citation) and 10 need correcting; the confirmed ones are listed at the end. I did not open any image, did not write anything and did not use the network.

## (a) Mandatory items missing, or covered without file:line

1. **`AGENT_PROTOCOL.md` is never mentioned (0 hits in the draft).** KNOWN:
   - `AGENT_PROTOCOL.md:16-17` requires reading APP_SPEC, PROJECT_STATUS and AGENT_PROTOCOL first.
   - `:53-54` says "New geometry features are added to the compiler on the real production path … never as a side experiment".
   - Fix: add a row in §1.2 and a line on why 005R emits no geometry (research-only proposals).
2. **`APP_SPEC.md` is never mentioned (0 hits).** KNOWN:
   - `APP_SPEC.md:22-26`: analyzers act through high-level DSL operations.
   - `:122-124`: "camera solving, LLM/VLM integrations" are out of scope for the foundation.
   - Fix: add it, or mark it NOT_READ.
3. **`PROJECT_STATUS.md` is cited only for unrelated lines (`:545`, `:1317`, `:1349`, `:1577`).** KNOWN: `:54-55` and `:1245,1267` record "005R (visual pilot) unchanged, pending" and the 005Q-OCR and 005Q-CHAIN outcomes. Cite these.
4. **`packages/source-analyzer/src/prepare.ts` (mandatory) is not read.** KNOWN:
   - `prepare.ts:29`: `MAX_WORKING_EDGE = 2200`.
   - `:79-81`: decodes from the bytes.
   - `:92-102`: `inkChannel`/`adaptiveInkMask`, described as "how much this pixel reads as drafting ink rather than as colour" (`:41`).
   - `analyze.ts:153-155` throws if the decoded size differs from the sealed size.
   - Relevance: this ink channel is an existing signal that could separate technical from render images. Add it to §3.3 and §9.
5. **`packages/reconstruction/src/plan-openings.ts` (named in the contract) is missing.** The draft only cites `v2/openings-v2.ts`. KNOWN:
   - `plan-openings.ts:157` `planOpenings` is imported only by v1 `reconstruct.ts:41`; `v2/` has no import (grep), so it is off the product path.
   - The header (`plan-openings.ts:1-25`) states the design rule "openings come from the plan … a rectangle detector over a photo-real elevation returns panes, cladding, shadows".
   - 005P map: "callout width overwrites drawn width (plan-openings.ts:249)" (`current-system-map.md:305`).
6. **`hypotheses/` is only partly covered.** `group.ts` and `geometry.ts` are not cited. KNOWN: `group.ts:4-5,33-36,65-66`: proposals sharing a detector-supplied `featureKey` become one feature across frames with no further check. This bears directly on the contract rule "do not assume identical structures across images" and should be a §9 item.
7. **`packages/source-vision/src/apply.ts`, `validate.ts` and `schema.ts:98` are not cited.** KNOWN:
   - `apply.ts:79`: provider confidence goes into the graph unchanged (uncalibrated).
   - `schema.ts:98`: the response already has `notFound` (named absence), which is relevant to abstention.
   - `anthropic.ts:93-97`: published figures are injected into the prompt. The contract forbids "published-area fields as output hints", so §9 should say this explicitly.
8. **`source-observations/src/hash.ts` is marked NOT_READ, but it matters.** KNOWN: `hash.ts:44` hashes `frame.roles` into the graph content hash. `schema.ts:370` types frame roles as unconstrained `z.string()`, not the enum. Add both to §3.4.
9. **The `docs/ARCHITECTURAL_LANGUAGE.md` coverage cites only `:131-141`.** KNOWN, missing:
   - `:105-108`: balcony, loggia and terrace are distinguished by `readPlatformSemantics` (`model/src/validate-architecture.ts:83,413`). That check runs only on an assembly with `platformId`, and production emits none.
   - `:119-125`: "Representable is not recognized".
   - `:174-180`: the demos are "plumbing … not production recognition".
10. **005M "correlation" (named in the contract) is absent from §10.** KNOWN, `STAGE_…005M_VISUAL_REFEREE_V2.md`:
    - `:166-168`: mirror consistency 90–100 %, "consistently wrong, not noisy".
    - `:171-172`: "requiring all five modes to agree still leaves 28.6 % wrong".
    - Also, InternVL's best mode is C, not D (`:104`).
11. **005P map: only partly read, with no line citations in the body.** KNOWN facts the draft should use:
    - `current-system-map.md:299`: "Not tested: SIDE_LEFT/SIDE_RIGHT in chooseSide".
    - `:290`: chimney is proposed on "≥2 storeys or a render (roof-details.ts:197)".
    - `:298`: `groupVariants` is never called by production.
12. **§1.1 does not identify the base.** KNOWN: `git log -1 39061db` → "005Q-CHAIN: closing — CI 38636571399 green on eaeb6df".
13. **Generic adapter and spec keys.** `generic/published.ts` and the ARCHON `SPEC_KEYS` (`archon.ts:213-225`) are only partly covered. KNOWN: keys `garage_door` (`archon.ts:220`, `published.ts:51`), `stairs` (`archon.ts:222`) and `terrace` (`archon.ts:223`) are produced, but a grep over `packages/apps` finds no consumer. Add this to the §4 GARAGE_DOOR, EXTERIOR_STEPS and TERRACE rows and to §8.1 step 6.

## (b) Spot-checked claims that are wrong or need correcting

1. **§3.6 (R4-17): "perspective-frame observations reach the leftover loop … WINDOW/DOOR … IGNORED".** This holds only when the camera loop skips the frame. KNOWN:
   - `reconstruct-v2.ts:1171`: `if (!raster || !mainRoof) continue`.
   - Otherwise `:1177` records every observation on that perspective frame, and `record` marks it consumed (`:185-190`). The leftover loop then skips it (`:1411`).
   - When a camera is solved, every observation on the frame, interiors included, becomes USED_AS_CORROBORATION with the false text "depth order was checked against it".
2. **§3.4 (R4-19): "none of … COLUMN_POST … is … a SemanticHint".** Misleading. KNOWN: `source-observations/src/schema.ts:108` `'portal'`, `:110` `'parapet'`, `:114` `'column'`, `:115` `'pilaster'`, `:119` `'railing'`, `:120` `'balcony-slab'`. The draft's own §3.3 says LVCs carry the hint `column`.
3. **§9.1: "writing roles back moves contentHash and every downstream id".** Wrong. KNOWN:
   - Asset id is `stableId('asset', captionSlug, {key, byteHashes})` (`acquire.ts:332`).
   - Frame id comes from (assetId, byteHash) (`ids.ts:23`); observation id does not include roles (`ids.ts:48-57`); package id is `acquire.ts:185`.
   - Roles move only the package `contentHash` (`source-package/src/hash.ts:42`) and the graph content hash and graph id (`source-observations/src/hash.ts:44`, `ids.ts:74`).
4. **§5.3 leak 1 is understated.** KNOWN:
   - Any lower-authority candidate within `max(tol)` corroborates (`authority.ts:87`): VISUAL_INFERENCE at 0.4 m and CONVENTION at 1.0 m, not only PERSPECTIVE at 0.25 m (`authority.ts:64-71`).
   - TECHNICAL_GEOMETRY then becomes SOURCE_CORROBORATED (`authority.ts:30-31`).
5. **§5.3 is missing a product-path leak: hard SOURCE_CORROBORATED from registered elevation rasters, which can be photo-real renders (§3.0).** KNOWN:
   - Verge member: `reconstruct-v2.ts:1028-1029`.
   - FACADE_ASSEMBLY: `:1036`.
   - Portal head from a render fascia band: `:1085,1088`.
   - Chimney when seen on a registered render: `:979` (renderFrames from `roof-details.ts:192`).
   - The status is preserved by `v2/emit.ts:55-58` and propagated at `v2/emit.ts:397` (`edgeMembers.fascia`).
   - Therefore "a render cannot become hard itself" (line 380) needs qualifying. Whether this is wrong is a judgement; the code fact is KNOWN.
6. **§4 TERRACE row and §10 row 21: the "17 of 29 production terraces" census is stale for HEAD.** MEASURED:
   - It was taken on the S0/B0 baseline (`STAGE_…005Q_SOURCE_GROUNDED_EXTERIOR_BOUNDARY.md:17`, `04d5568`).
   - Layout 1.2.0 (commit `7eddd7b`, `layout.ts:72`) later removed glogownikach's 3 wall-poché terraces (draft row 17).
   - Fix: label the census with its SHA, or give the number at HEAD as at most 14 of 26.
7. **§4 TERRACE: "room name 'taras' unused (`interior.ts:543-545`)".** The citation does not show this; those lines bind room numbers. Correct evidence: grep for `taras` over `packages/**` (non-test) hits only `archon.ts:223` and `generic/published.ts:54`, which are spec keys with no consumer. Whether a published room called "Taras" becomes `createRoom usage` (`v2/emit.ts:323`) is a HYPOTHESIS; test it with a replay on a package whose room table contains "Taras".
8. **§8.2 C′: `specifications.ts:72` should be `:71`** (the HIP rule).
9. **Every bare `emit.ts` citation is ambiguous.**
   - Lines 281, 321, 368, 382 and leak 1's `emit.ts:321,517,608-609` point to `packages/architecture/src/hypotheses/emit.ts`. Its CROSS_VIEW sites are `:437,485,535-536,611-612,630-631`; the draft omits `:611-612`.
   - §3.8 (`:424-500`, `:435`, `:493-494`, `:53-70`) points to `packages/reconstruction/src/v2/emit.ts`.
   - Fix: give full paths.
10. **§3.6: "first free side at confidence 0.4" is incomplete.** KNOWN: 0.4 applies only when both sides are free; it is 0.65 when one is free (`views.ts:264-265`). Also, an equal-confidence role conflict leaves the dimension UNKNOWN (`roles.ts:50-56`); §3.2 only says "maximum confidence".

**Confirmed at HEAD:**
- `schema.ts:45,63`
- `analyze.ts:126,164,174`
- `views.ts:233,245`
- `solve.ts:312`
- `reconstruct-v2.ts:608,613,689-690,1065-1067,1121,1147-1158,1249`
- `recesses.ts:171-173`
- `capabilities.ts:183,288`
- `fuse.ts:50,124`
- `openings-v2.ts:310-313,320`
- model `schema.ts:208,333,499,725-726,842,895,912,1016-1018`
- `assemblies.test.ts:38-41,115-125`
- `config.ts:30,61`
- `run.ts:154-156,288`
- `tasks.ts:36-38,44`
- `anthropic.ts:88`
- `frame.ts:345`
- 005M `:102,368`
- `hash.ts:17`: correct, but it is a comment; the code is `hash.ts:40-46`.

## (c) Tags that need changing

1. **§3.0 "On the reference project all four elevations are photo-real renders" is tagged KNOWN.** It describes picture content taken from docs. Retag it as *documented claim* under the draft's own legend (§2).
2. **§8.1 step 6 "SPEC_KEYS `/^taras|^balkon/` never fired" sits under a KNOWN-style list but is a run outcome.**
   - Retag as MEASURED with the artifact path, or as HYPOTHESIS. The test is `publishedSpecifications[].key` in the sealed g2e/eoze/jarzabem packages.
   - What is KNOWN instead: the spec reader only handles `roof`, `knee_wall` and `walls` (`specifications.ts:136,176,185`).
3. **§7.3 "KNOWN … R6 unverified, citations not re-opened" (R6-22).** I reopened them and they hold, so this can stay KNOWN with "re-checked":
   - `research/analyzer-005q-chain/cases.json:60`
   - `stage-reports/artifacts/rarytasy-generalization/README.md:3`
   - `PROJECT_STATUS.md:545`
   - `analyzer-005q/recommendation.md:91`
4. **§5.1 "MEASURED: role errors already reach a user-visible failure code path"** cites only code (`run.ts:154-156,252-265`). Retag it KNOWN for the code and keep the outcome as HYPOTHESIS.
5. **§3.7 HYPOTHESIS R2-C15 is partly KNOWN.**
   - The ACCEPTED branch returns at `fuse.ts:141`, before the `realFeature` gate (`:127,:145`).
   - PERGOLA's requirements have no crossView (`capabilities.ts:273-277`).
   - So "single-frame ACCEPTED is possible" is KNOWN. What remains a hypothesis is that a real `demoPergola` remap actually groups and meets the counts.
6. **§4 TERRACE and §10 row 21: the "17 of 29" census is tagged MEASURED for current production.** It is MEASURED at `04d5568`, not at HEAD; see (b6).

## (d) Missing rows or columns in the assembly table (§4)

1. **PARAPET / UPSTAND / SCREEN**, needed for the contract's negative class "parapet ≠ decorative railing". KNOWN: model panel roles at `schema.ts:842`, registry `PARAPET` SUPPORTED/NONE at `capabilities.ts:193-202`, SemanticHint `'parapet'` at `schema.ts:110`.
2. **GARAGE (closed volume)**, needed for "roofed closed volume ≠ carport". KNOWN: `AssemblyKind GARAGE` (`schema.ts:912`), the opening-family rule at `openings-v2.ts:310`, boundary `OPEN_MOUTH_GARAGE` (`boundary-bodies.ts:236-238`).
3. **Main ROOF**, needed for "porch canopy ≠ entire principal roof". KNOWN: registry `ROOF_GABLE` ANALYZER_V2 and `ROOF_HIP` SYNTHETIC_PIPELINE (`capabilities.ts:91-112`), while v2 hard-codes `'GABLE'` (`reconstruct-v2.ts:613`).
4. **BEAM / PERGOLA_BEAM** (horizontal members). KNOWN: `capabilities.ts:297-306`, linearSolid role `PERGOLA_BEAM` (`schema.ts:726`). Also the PERGOLA requirement for an *observed* absence, `NO_COVER_OBSERVED` (`capabilities.ts:276`), which is the only existing "absent if visible" construct.
5. **GLAZED_DOOR / MULTI_PANEL_GLAZING** (terrace doors). KNOWN: `openings-v2.ts:23,314,322`. Also `:321`: a floor-reaching glazed opening 0.75–2.0 m wide on storey 0 with no swing is typed WINDOW by rule. That partly explains HYPOTHESIS R6-23 from code.
6. **Portal head / FACADE_MEMBER** (the existing CANOPY_ENTRANCE evidence). KNOWN: `reconstruct-v2.ts:1085-1089`, SOURCE_CORROBORATED, plus `PORTAL_FRAME` facade assembly `:1089`.
7. **CHIMNEY** (exterior feature emitted from registered renders). KNOWN: `reconstruct-v2.ts:970-979`. It is not a 005R class, but it is a render-derived hard-status precedent.
8. **INTERIOR_RENDER as a negative row** ("interior render ≠ facade evidence"): routing at `analyze.ts:164`, camera at `reconstruct-v2.ts:1169-1177`, and the measured g2e interior observations (R3-12).
9. **Missing columns:**
   - A *view-side / mirror* column: `SIDE_*` is treated as unlabelled at `views.ts:233`, and this is untested (`current-system-map.md:299`).
   - An *existing negative pair / absence construct* column for each row.