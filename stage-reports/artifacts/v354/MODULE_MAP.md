# v3.54 module map — code reading (226c9ac = code 5240d7e + contract 459cc2d); confirmed by the v3.54 runs

Prefixes: AS packages/analysis-service/src, SP source-package/src, SA source-analyzer/src, SM source-metrics/src,
RC reconstruction/src, PD RC/plan-decomposition.ts, V2 RC/v2/reconstruct-v2.ts, LA apps/local-analyzer/src.

Entry: runAnalysis AS/run.ts:205 (retry once with measure WALL_LONG_BANDS run.ts:212-214). analyseLink
AS/analyse-link.ts:140 = runAnalysis + described path. API uses analyseLink (apps/analyzer-api/src/executor.ts:38);
the phone (local analyzer) uses runAnalysis directly (LA/local.ts:86) — no AI on the phone.

| # | active function | in → out | limits | consumed |
|---|---|---|---|---|
| 1 source | acquireSourcePackage SP/acquire.ts:68, routeSourceAcquisition, buildAssets, selectionOrder SP/variants.ts, selectedVariant SP/schema.ts:322 | URL → SourcePackage | maxAssets cut in trust/URL order; byte-identical = one variant; aspect >2% = own asset; mirror tagging only for PDF/DWG links (generic/index.ts:222-231), never parsed; no image mirror handling | run.ts:285→371 |
| 2 classification | adapter.roleClaims → mergeRoleClaims/normalizeRoles; content embedder promotes UNKNOWN (SA/analyze.ts:209-218) | → SourceAsset.roles | DETAIL, SITE_PLAN no extractor; table only annotation AREA_TABLE; CHROME/UNKNOWN skipped; NO_DRAWINGS/SOURCE_INCOMPLETE run.ts:334-345 | analyze.ts:295-303 |
| 3 registration | registerFrame SM/registration.ts:127; planStoreyOf RC/layout.ts:666; chooseBasePlan layout.ts:924; alignPlans layout.ts:1101/2554; worldFrameFrom RC/v2/frame.ts:55; registerElevationFrames V2:1039; decideSideOrientation side-orientation.ts:157 | → CoordinateRegistration, PlanFrameV2, ElevationRegistrationV2 | one-axis frame assumed square px (registration.ts:137-142); FRONT = SHEET_BOTTOM (frame.ts:77); side swap only if every view prefers it | V2:1075 |
| 4 observations | extractPlan SA/extractors/plan.ts:142..255; extractElevation elevation.ts:103-301; extractSection; readEaveOutline RC/eave-outline.ts; inferRoofSystems RC/structural.ts:130 | → SourceObservationGraph | plan observations are corroboration only (V2:3562-3566) — solver re-reads plan pixels (layout.ts:800-811); no logo detector; plants only a silhouette note | run.ts:396 |
| 5 metrics | extractMetricEvidenceAsync SM/extract.ts:347; readNumbers :434; dimensionChainsOf :451; solveFrameChains :455; solveFrameMetric :541 | → MetricEvidenceSet | per-frame scale, no pooling across copies; unit rules by digit count (SM/parse.ts) | run.ts:477; layout.ts:698-717 |
| 6 boundaries/rooms | readPlans layout.ts:659 → planExtent PD:1268 → decomposePlan PD:2359 → decomposeCore PD:2486 (grid :535, envelope :2519, wide gaps :2546, edges :2601, flood :2695, classify :2884, merge :3025); boundaryExtension PD:4671; rereadEnclosedRooms :2425; readInterior RC/v2/interior.ts:215 | → PlanDecomposition (cells BUILT/RECESS/OUTSIDE, WalledEnvelope or null) | closure 0.62, maxOpening 3.2 m, maxWide 8 m, minCell 0.45 m; pocket ≤ max(6, 2.5w²) m² | layout.ts:722 |
| 7 assembly | inferStructuralLayout layout.ts:2437; composeStructuralLayout structural.ts:61; reconstructV2 V2:489 (TOPOLOGY :1210, METRICS :1945, readWallOpenings openings-v2.ts:539, MODEL :3059); emitBuilding RC/v2/emit.ts:151; sealCandidate V2:3524 | → layout hypotheses → candidate + CanonicalBuildingModel | plan decides footprint; elevations decide ridge axis/heights/opening sizes; openings placed from plan gaps | run.ts:524 |
| 8 compile | compileBuilding geometry/src/compile.ts:148 | model → CompiledScene | invalid model → empty scene MODEL_INVALID | run.ts:589 |
| 9 verification | verifyReplay RC/candidate.ts:258; bundle round trip run.ts:614; geometryClosureAudit geometry/src/closure.ts:620; assessModel run.ts:660; footprint arbiter layout-gate.ts:158-166 (≤6 % AGREES, ≤20 % NEAR, else FOOTPRINT_AREA_WRONG blocking) | → ClosureReport, assessment | closure errors only DEGRADE; published footprint used both as arbiter and as check (circular for scoring) | run.ts:673 |
| 10 product | buildMobileSceneBundle mobile-scene/src/bundle.ts:322; runLocalAnalysis LA/local.ts:83 (ARCHON + generic adapters, ORT recogniser, embedder) | → MobileSceneBundle | — | APK assets |

(a) longBands PD:1182 `length >= wallPx*2.5`; axisBox PD:1185-1196 null unless both orientations; walledEnvelope PD:1709-1753:
axisBox → sideWallReach PD:1784 → snap to nearest grid line within wallPx → null if a side < 4·wallPx (1742). One long band
on an axis gives zero thickness → null. A null envelope switches off: outside seeding of the flood (2711), RECESS cells (2898),
compound-facade reader (2040), and the opening-aware outline adoption (`if (env)`, 4777); base-plan score −2 (layout.ts:927).
(b) classify PD:2890-2904: reached==0 → BUILT; else ≥3 shut edges inside envelope → RECESS; else OUTSIDE. One open edge
lets the flood through every open interior edge beyond — a multi-cell room becomes OUTSIDE.
(c) flood PD:2695-2738, stack walk through passV/passH (closure < 0.62 and no doorway).
(d) scale per frame; readPlans orders copies DIMENSIONED, largest, id, first copy with an extent wins (layout.ts:683-741);
resolver ≤4 copies × 3 extents × scales × tilings × faces ≤ 24 decompositions, CROSS_COPY within 5 %, TIE refused.
(e) publisher knowledge only in SP/adapters/archon.ts; front = sheet bottom everywhere; assets sorted by id.
(f) PLAN_NO_WALLED_ENVELOPE plan-diagnostics.ts:229/247; PLAN_LAYOUT_REJECTED :271-283; METRIC_RESOLUTION_INCONCLUSIVE V2:544-557, 718.
(g) no option/env injects an outline, envelope or plan element; `--metrics` injects metric evidence (second-house.ts:130-152);
OutlineOverride PD:2469 internal only; elevations cannot rescue an unclosed plan (registration needs masses, V2:1039).
(h) glazing lines count toward closure (closureOf PD:791); collinearWideGaps PD:1963-2014; boundary-evidence.ts:525 GLAZING
signature → OPENING_SUPPORTED STRONG; but the opening-aware outline is adopted only when a walled envelope exists (PD:4777).

## AI described path
Gate AS/analyse-link.ts:176-191: after refusal (DESCRIBABLE_AFTER = RECONSTRUCTION_FAILED, NO_DRAWINGS, SOURCE_INCOMPLETE,
:112) or a self-reported weak model (drawingsWeaknesses :61-70: NO_METRIC_ANCHOR, PARTIAL_MODEL, BODY_MISSING, NO_ROOF_BUILT).
A complete, anchored, wrong model skips the reader (comment :59; test generic-source.test.ts:241-249). The gate reads no
source-fidelity check (assessment not referenced in analyse-link.ts).
Output: HouseDescription 0.2.0 (source-vision/src/house-description.ts:148-195), checker checkHouseDescription :278-368
(schema, internal consistency, published figures — nothing against drawings); builder reconstructFromHouseDescription 0.7.0
(RC/v2/described-house.ts:31,1001); separate model MODEL_FROM_SOURCE_DESCRIPTION (described.ts:246), local model attached as
`alternative`. Only sizes cross local→AI (DescribedAnchors described-house.ts:156-161). Nothing crosses AI→local.
Coordinates: product reader states metres, never pixels; pictures resized ≤1568 px; `mirrored`/`frontIsPlanEdge` read by
neither builder nor checker. s5311 harness maps scale+offset only (harness.ts:178,204-206), no rotation/mirror.
B/C harness: 7 sealed questions, synthetic fixtures only, never run live, no consumer.
Ledger research/ai-assist/spend-ledger.json: 2.72807938 / 5 USD, 92 entries, CLI_TOKEN_ESTIMATE, billing UNCONFIRMED,
all session CLI (no API key entry). Recorded descriptions: the private S53 pilot (E1, -1 pages) and held-back (E3, -2 pages) folders;
references beside them (private, outside Git).
