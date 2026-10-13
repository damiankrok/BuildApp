# 005Q Phase A — code / architecture map (key: codemap)

> Phase A working draft by an independent read-only agent, committed as written (scratch paths shown as `$W`, a directory outside the repository; publisher rasters were read there and are not committed). Where it disagrees with `first-bad-boundary.md`, the disagreement is stated there.

Base: `04d5568` (repo HEAD is `d28b755`, which adds only `research/` and `stage-reports/` files;
`git diff --stat 04d5568 HEAD -- packages/` is empty, so every `packages/...:line` below is valid at 04d5568).
Repository was not modified. Scratch: `$W/agents/codemap/` (variant copy `v1/`, reverted to
04d5568 byte-identical after each counterfactual; runs under `runs/<label>/`).

Labels: **KNOWN** = reproduced from code/data (file:line, numbers); **INFERRED** = reasoned, not reproduced;
**UNAVAILABLE** = not determinable from what is here.

---

## 1. The call path, stage by stage

Abbreviations: `PD` = `packages/reconstruction/src/plan-decomposition.ts`, `LY` = `.../layout.ts`,
`PR` = `.../plan-resolution.ts`, `RV2` = `.../v2/reconstruct-v2.ts`, `EM` = `.../v2/emit.ts`,
`BC` = `.../boundary-completion.ts`.

### 1.0 Source acquisition and observations (outside eligible scope)
`packages/analysis-service/src/run.ts:169 runAnalysis`
- `:213-234` `acquireSourcePackage` (URL) or sealed `SourcePackageSchema.parse` (replay) → `pkg`.
- `:246-266` role census; stop when no FLOOR_PLAN and no ELEVATION.
- `:281-305` `analyzeSourcePackage` → observation graph (`coordinateFrames`, roles incl. `ORTHOGRAPHIC_PLAN/FLOOR_PLAN`, `storey`, `annotation`).
- `:312-324` decode every selected variant into `rasterCache`; `raster(frame)` closure `:325`.
- `:369-382` `extractMetricEvidenceAsync` (source-metrics) → `metrics` = chains (ticks, segments with `origin` READ|CHAIN_CORRECTED|DERIVED|UNRESOLVED, `evidenceId`), `coordinateRegistrations` (PLAN_XZ mpp), evidence, `dimensionObservations`, metric solutions.
  - KNOWN: a DERIVED segment (value computed from the scale) is materialised as a `LINEAR_DIMENSION` evidence record (`source-metrics/src/extract.ts:960`, `extractor: 'DERIVED'`; on glogownikach confidence 0.4) and the segment cites it by `evidenceId`. This matters at §1.8.
- `:402-428` `reconstructV2({... graph, metrics, raster, publishedAreas: pkg.publishedFacts ...})`.
- After the solver: `:437-447` `compileBuilding` (geometry) and `:456` `verifyReplay`, `:468-473` `geometryClosureAudit`; `buildMobileSceneBundle` is the renderer bundle. Renderer only compiles the canonical model; it decides nothing about the boundary.

### 1.1 Solver entry and plan pass
`RV2:170 reconstructV2` → `:232` `composeStructuralLayout(structuralOptions)` (`structural.ts:59`) → `structural.ts:60 inferStructuralLayout` (`LY:1669`) → `LY:1672 readPlans` (`LY:355`).
- `structuralOptions` carries `publishedAreas`; `LY:195 layoutOptionsOnly` strips it (only `LAYOUT_OPTION_KEYS`, `LY:194`) — the layout never sees the published figure (KNOWN).

### 1.2 Selected floor-plan frame
`LY:355 readPlans`: plan frames = `ORTHOGRAPHIC_PLAN && FLOOR_PLAN` (`:360`); storey via `planStoreyOf` (`:79`); per storey frames ordered DIMENSIONED first, then raster area, then id (`:376-382`); the first copy that decodes and has an extent is read (`:384-449`, `break` at `:447`). Resolver may force a copy via `options.plan.frameId` (`:375`).
- `LY:463 planSheet`: `adaptiveInkMask` → permissive `runLengthBands` survey → `wallPx = bandWallThickness(survey)` (`:470`) → second band pass with thickness window `[0.45, 1.9]×wallPx`, minLength `1.6×wallPx` (`:471-475`) → `wallWitness(bands, wallPx, mask)` (`plan-extent.ts:67`).
- Base plan: `LY:1683` resolver choice or `chooseBasePlan` (`LY:583`).
- Owned decision: which copy/which storey. Provenance kept: `frameId`. Dropped: the other copies (only the resolver revisits them, `PR:576-584`).

### 1.3 Printed dimension-chain extent / registration
`LY:398-401`: extent = `wallClusterExtent` (resolver WALL_MASS_CLUSTER), the wall witness (resolver WALL_WITNESS), else `planExtent(chains, bands, wallPx, witness, observations)` (`PD:962`).
- `PD:962 planExtent` = `planExtentByWalls` (`PD:1067`) → `planExtentOf` (`PD:1141`, legacy: widest read chain per axis `dimensionedAxis` `PD:801`, widened by `axisBox` of long bands inside it; weak if more wall outside the chain rect than inside, with `cornerJoined` `PD:1197`) → `framingChains`/roles (`plan-extent.ts:184`) → `outspannedByOuterTotal` (`PD:1037`) → `refuteByWalls` (`PD:976`; 2 walls past by >2 wallPx).
- Registration: `metrics.coordinateRegistrations` PLAN_XZ for the frame (`LY:406-411`), else a unit placeholder (`LY:553`) that "may never state a metre".
- Extent provenance per axis kept on `PlanReading.extentProvenance`; extent rect is passed **only as a pixel rectangle** into the decomposition (`LY:418`).
- **extentSides** computed at `LY:418` → `LY:503 extentSidesOf(chains, extent, wallPx)`: a side is SUPPORTED when an EXTERIOR chain covering the witness ends within **one wallPx** of the extent side on a non-REJECTED mark (`:515-521`); STRONG when two such chains on baselines > wallPx apart end within wallPx of each other, or one chain closes with ≥2 READ segments and all READ (`:524-528`). Sides from WALL_GEOMETRY_EXTENT are never stated (`:513`).
  - KNOWN: `extentSides` is consumed **only** by `boundaryExtension → completeBoundary` (`PD:3290`, `sides:` at `PD:3306`); `CoreOptions` explicitly omits it (`PD:360`), so `decomposeCore`, `walledEnvelope`, the flood and the region cut never read it.
- `exteriorTicksOf` (`LY:485`) → `options.exteriorTicks` → shadow lines in `boundaryExtension` only (`PD:3064-3065`).

### 1.4 Wall ink, bands, short blocks
- Bands: `planSheet` (above). In `decomposeCore` (`PD:1832`) only bands whose **axis** is inside the extent and ≥60 % of whose run is inside it are kept (`PD:1846-1854`, `inside`); `wallPx` is re-measured on them (`PD:1855`).
- `longBands` (`PD:876`): length ≥ 2.5×wallPx. Short blocks (piers, facade pieces between openings) never enter `axisBox` (`PD:879`) and therefore never define the envelope; they reach the closure only through `wallIntervals` (`PD:584`) and the boundary's `readWallLine` (`boundary-evidence.ts:304`).
- Probes: `CORE.bands` in `probe.ndjson` reproduce this list.

### 1.5 gridLines / thinLines
`PD:1862` `gridLines(chains, inside, extent, options)` (`PD:441-562`):
- Chains first (`PD:468-490`): every tick of every segment that has a `valueCm` (READ, CHAIN_CORRECTED **or DERIVED**) becomes/joins a raw line within `snapPx`=5 (`:481`); `printed` = READ or CHAIN_CORRECTED (`:478`); `chainSpanPx` = longest chain breaking there.
- Bands next (`PD:493-524`): a band joins a raw line within `window = max(5, 0.75×thickness)` of its axis or `faceWindow = max(5, 0.35×thickness)` of either face (`:505-508`). **Face choice #1**: claimants sorted by `chainSpanPx` desc, then |distance to band axis|, then **lower px first** (`PD:509`). Only the winner gets `bandLength`/`bandCoverage`/`bandSpans`; probes of axis+both faces are added (`:523`).
- Confidence `PD:535`: printed+band .95, printed .8, chain+band .75, chain .5, band-only .6.
- `PD:1863-1864 thinLines(lines, minCellPx, wallPx)` (`PD:564-582`): rank = `confidence×1e9 + chainSpan×1e3 + bandLength` (`:565`); greedy keep in rank order; a line `< minGapPx` from a kept one is **dropped**, handing over probes within `probeGapPx = wallPx` (`:569-575`). `minCellPx = minCellM(0.45 m)/max(mpp)` (`PD:1861`, `DEFAULTS PD:366`). **Face choice #2 / tolerance of the order of one wall**: on these sheets minCellPx ≈ wallPx (glogownikach 17.136 vs 18; krasnokwiatach 17.918 vs 18.03), so the two faces of one wall (17–18 px apart) are always merged into one line and which face survives is decided by rank, not by geometry.

### 1.6 walledEnvelope / sideWallReach / snap
`PD:1865` envelope = `outlineEnvelope(override)` (`PD:2999`, re-cut only) or `walledEnvelope(inside, linesX, linesY, wallPx, registration)` (`PD:1227-1275`):
- `axisBox(longBands)` (`PD:879-891`): min/max band **axis** ± wallPx/2 = assumed outer faces.
- `sideWallReach` (`PD:1302-1357`): extends a side only if **both** outermost parallel walls run ≥2 wallPx past it and end within 2 wallPx of each other, the box ends on a partition (<0.7 wallPx thick), and a pier (≥0.6 wallPx) sits on the far line (`:1321-1337`).
- **Face choice #3 / snap** (`PD:1244-1256`): each side snaps to the nearest **surviving** grid line within `d < wallPx` (strict). Because §1.5 already removed the outer-face line, the snap moves a correct outer face to the inner-face line.
- Envelope `metric` uses the registration (`PD:1261-1270`); `why` says "snapped to the dimension grid". Alternatives (axis face, the thinned line) are not recorded.

### 1.7 Closures, wide openings, flood, cell classes, regions
- Tolerances (`PD:1880-1883`): wall interval probe `max(4, 0.6 wallPx)`, line probe `max(3, 0.35 wallPx)`, `maxOpeningPx = 3.2 m`, `minJambPx = 0.5 wallPx`.
- Opening vs open side: `collinearWideGaps` (`PD:1479`) with compound facade reader (`PD:1555`, `compound-facade.ts:362`), `backWallLines` (`PD:1590`), `baysOf` (`PD:1647`), `closureOf` (`PD:730`); pocket test (`PD:2041-2131`): an OPEN_SIDE gap ≤ 8 m whose pocket > `max(6, 2.5 w²)` m² becomes OPENING_IN_WALL; `shutPocketMouths` (resolver MOUTHS=SHUT) shuts the rest. H0/H1 (`PD:2138-2178`).
- Flood (`PD:2005-2051`): **every cell whose centre lies outside `envelope.rect` is seeded as outside by construction** (`PD:2017-2030`), plus open border edges; closure threshold 0.62 (`DEFAULTS`).
- Classes (`PD:2181-2246`): BUILT = not reached; RECESS = reached, ≥3 shut edges, fully inside envelope, ≥2 non-opposite BUILT neighbours; compound recess override (`PD:2251-2268`).
- `mergeRegions` (`PD:2298`, largest pixel area first); region `rect` = grid-line pixels, `metric` = registration mpp (`PD:2310-2316`). `stableRegions` (`PD:2381`) only with completions.
- `decomposePlan` (`PD:1796-1813`): `boundaryExtension` (`PD:3040`) → re-cut with `override` only if an outline component is accepted or a completion accepted.

### 1.8 boundary outline / completion / bodies
`PD:3040 boundaryExtension`: shadow grid (`PD:3053-3065`, exterior ticks with no line within 0.5 wallPx), `readWallLine` per line, `cornerLegs`, `solveOutline` EXCLUSION and STRICT (`boundary-outline.ts:94`), `adopt` (`PD:3131-3236`: outline may only **widen** the box's built area; components beyond the box accepted only if they continue the box interior across an edge with no wall and no opening), `classifyBodies` (`boundary-bodies.ts:142`: UNKNOWN / FLUSH_ATTACHED / COVERED_TERRACE / SEPARATE_BODY / OPEN_MOUTH_GARAGE — **record only, `built:false` unless adopted/completed**), `completeBoundary` (`BC:167`):
- ENVELOPE_EXTENT_CONFLICT (`BC:231-286`) only when the stated side is **≥ 2 wallPx** past the box (`BC:248`). A sub-two-wall discrepancy (the glogownikach S/E face) is never a conflict.
- ATTACHED_ROOM / BOX_COMPLETION guards (`BC:50-74`): door ≥0.7 m, perimeter ≥50 % wall, <10 % posts, room evidence, two returns, STRICT encloses, **part ≤ 0.5 × what the box builds** (`partShare`) — a box that took the wrong strip makes its own guard too small.
- The published footprint is not read here (KNOWN: no `publishedAreas` in `BC`/`PD`).

### 1.9 Regions → masses (layout)
`LY:1669 inferStructuralLayout`:
- Ladders (`LY:1703-1712`): `tolerancePx = max(2, wallPx/2)`; `axisLadder(linesX/Y, chains, evidence, axis, mpp, origin = envelope.rect.x0/y0, tolerancePx)` (`LY:1121-1260`). World frame origin = envelope corner.
- `statements(from,to)` (`LY:1151-1173`): a chain states a span if a segment starts within `tolerancePx` of `from` and a run of **consecutive segments with any value** ends within `tolerancePx` of `to`; `valueOf` (`LY:1136-1148`) returns the cited evidence value — **including DERIVED evidence** (see §1.0). `span()` `stated=true` for any such statement (`LY:1175-1194`).
- Bodies: `walledFirstRegions` (resolver MERGE) / `planBodies` (`PD:2608`, merges built regions whose shared boundary is < 50 % wall) / `recutSlivers` (outline frames) (`LY:1718-1725`).
- Region admission per body (`LY:1786-1843`): FACES=OUTER_FACE → `toOuterFaces` (`LY:1616-1661`) moves **band-only** sides (no chain support) out by wallPx/2 — a line with a chain tick is never moved; `perimeterWallEvidence ≥ 0.35` (`LY:1793`); outline-only sliver test `minBodySpanM` (`LY:1805`).
- ZONES (`LY:1846` → `LY:2182-2216 zonesOutsideEnvelope`): every strip between the envelope and the extent on each side that is ≥ `max(2, wallPx/2)` px deep (`LY:2184`) becomes a `ZONE` footprint region ("not a part of the building"), no evidence ids, confidence 0.6.
- Masses (`LY:1851-1874`): ring from ladder positions; `widthM/depthM.basis = basisOf(span)` (`LY:1859`): `stated` → MEASURED (DERIVED only if a resolver re-read), else SCALED.
- Recesses (`LY:2373`), roles (`LY:2223`), attachments, facades.

### 1.10 Gate, published footprint, resolver
- `structural.ts:146 evaluateLayoutGate` → `layout-gate.ts:146-151`: published `footprint_area` vs lowest-storey BUILT area: ≤6 % AGREES (NOTED), ≤20 % NEAR (DEGRADING), else WRONG (BLOCKING). **Check only**; it never changes geometry (comment `layout-gate.ts:57`).
- `RV2:278-367`: refusal or weak metric → `challengeFirstReading` (`PR:1159`) / `resolvePlan` (`PR:564`). Readings (`PR:600-700`): copies ≤4 × extent {CHAIN_RECT, WALL_MASS_CLUSTER, WALL_WITNESS if differs by > wallPx} × scale {registration, ≤2 metric hypotheses} × merge {LARGEST_FIRST, WALLED_FIRST} × faces {AS_GRIDDED, OUTER_FACE} (+ mouths SHUT). Each reading re-runs `inferStructuralLayout` with `options.plan` (`PR:684`), so the same `gridLines/thinLines/walledEnvelope` decisions are re-made identically for a given extent (decompositions cached by extent+mpp key `LY:417`). The published figure **scores** readings (`PR:392 bucketOf`, `PR:402 scoreReading`) and is SPENT when it refused the first (`PR:569`).
- KNOWN consequence: none of the resolver's axes changes the face chosen at `PD:509/564/1244`; OUTER_FACE moves only chainless lines.

### 1.11 v2 topology: masses, zones → recesses → terraces, closure
- MASS feature `RV2:399-450`: provenance `m.widthM.basis === 'MEASURED' ? 'SOURCE_EXACT' : 'SOURCE_DERIVED'` (`RV2:406`) — width basis only; depth basis not consulted.
- World frame `v2/frame.ts:55-80`: z = 0 is the max-z of **all** base-storey regions incl. ZONEs; a fake front zone shifts the origin.
- Zones → recesses `RV2:651-720`: each ZONE id side (`:654`) with a mass face within 0.15 m becomes a `RecessTopology` via `scanZoneForReturns` (`v2/recesses.ts:76`), RECESS feature SOURCE_DERIVED/CORROBORATED with `printed: true` (`:687`), and wall-thick ink found in the strip becomes RETURN_WALL (`:692-718`).
- Terraces `RV2:1090-1118`: every ground-storey recess `open` interval becomes a `TerraceV2` floor (+ `readTerraceExtension`), provenance SOURCE_DERIVED, surface PAVED when drawn share ≥ 0.3.
- Closure `RV2:1193-1196`: `snapReturnsToBodyFaces` (6 cm), `alignStackedReturns`, `closeTerraces` (`v2/assembly-closure.ts:66,96,131`, 6 cm snaps) — they align, never question existence.

### 1.12 Emission
`RV2:1276 emitBuilding` (`EM:91`): `createWallRing` polygon = mass rectangle (`EM:185`); the canonical compiler treats ring vertices as the walls' **outer face line**, material inward (`commands/src/apply.ts:287-310`, `geometry/src/closure.ts:727`). Ring evidence: **always `SOURCE_EXACT`** for the measured storey (`EM:191`), regardless of the mass basis. Terraces `EM:440-441` (feature provenance). Returns `EM:215`.

---

## 2. Authority crossings (observation → decision, alternatives dropped)

| # | where | observation | decision | alternatives lost |
|---|---|---|---|---|
| A1 | `PD:509` | two raw lines equidistant from a band axis (the two faces) | band given to the **lower-px** line | the other face loses `bandLength` → confidence .8 vs .95 |
| A2 | `PD:564-582` (`:1863-1864`) | two lines < minCellPx (≈ one wall) apart | lower-ranked dropped | its position (probes kept, line gone); no record |
| A3 | `PD:1244-1256` | axis-box outer face | snapped to nearest surviving line within wallPx | the computed face; `why` claims "snapped to the dimension grid" |
| A4 | `PD:879-891`, `:1302-1357` | long bands only | envelope = long-band axis box (+ both-side-walls reach) | short facade pieces, STRONG extent sides (`extentSides` not consulted) |
| A5 | `PD:2017-2030` | envelope rect | every cell outside it OUTSIDE by construction | the stated extent between envelope and extent |
| A6 | `LY:2182-2216` | envelope–extent gap ≥ wallPx/2 | ZONE region (later recess + PAVED terrace + returns) | "the gap is the wall itself / a misplaced face" |
| A7 | `LY:1136-1194`, `:1859` | any chain run with values (DERIVED included, `extract.ts:960`) | `stated` → MEASURED | the statement's real authority (READ vs CHAIN_CORRECTED vs DERIVED) |
| A8 | `RV2:406` | width basis | MASS SOURCE_EXACT | depth basis ignored |
| A9 | `EM:191` | measured storey ring | SOURCE_EXACT unconditionally | mass basis, extent conflicts, face choice |
| A10 | `BC:248`, `BC:50 partShare` | stated side vs box | conflict only if ≥2 walls; completion capped at ½ of box | sub-two-wall face errors; parts larger than a wrong box |
| A11 | `PR:392-471` | published footprint | scores/refuses readings | (by design a check; it cannot repair A1–A6) |
| A12 | `boundary-bodies.ts:142` | body relations (COVERED_TERRACE etc.) | recorded, `built:false` | not consumed by v2 terraces (v2 terraces come only from ZONEs, §1.11) |

Every place with a tolerance of the order of one wall: `PD:506-507` (0.75/0.35 thickness), `PD:569` (minCellPx ≈ wallPx),
`PD:574` (probeGap wallPx, merge of probes), `PD:883` (±wallPx/2 outer face), `PD:1246-1249` (snap < wallPx), `PD:1308-1309` (side walls within
wallPx), `PD:1336` (2 wallPx), `PD:1880-1883`, `PD:3059` (shadow 0.5 wallPx), `LY:515-528` (extent side within wallPx),
`LY:1703` (ladder tolerance wallPx/2), `LY:1626-1661` (±wallPx/2 outer face), `LY:2184` (zone ≥ wallPx/2),
`BC:248` (2 wallPx conflict), `RV2:663,668` (0.15 m), `assembly-closure.ts:66,131` (6 cm).

---

## 3. Case facts (KNOWN unless marked)

### glogownikach — frame `...0cb0a5c1d9` (B0 = PROBE, model `b7c86aac…`)
- Extent 78..812 × 203..553, mpp 0.026261/0.026207, wallPx 18, minCellPx 17.136 (probe CORE).
- Bands: S wall HORIZONTAL axis 544.5, bounds y 536..553; E wall VERTICAL axis 803.5, bounds x 795..812; N axis 211.5 (203..220); W axis 86.5 (78..95).
- Chains: `chain-vertical-17` 203→553 = **920** (CHAIN_CORRECTED, single segment); `chain-vertical-41` 203→536 = **870** (CHAIN_CORRECTED) + 536→553 = 44.55 (DERIVED); `chain-horizontal-622` ticks 78…795, 812: all DERIVED except 439→645 = 541 (CHAIN_CORRECTED); 795→812 = 44.64 DERIVED. The drawing's chains dimension the wall thickness as its own segment on S and E.
- Y: raw 536 and 553 both printed, both chainSpan 350, both 8.5 px from axis 544.5 → **A1 tie-break by px gives the band to 536** (.95) and 553 stays .8; 553 is 17.000 px from 536 < 17.136 → **A2 drops it**. X: 797.69 (5.81 px from axis 803.5) wins the band over 812 (8.5 px); 812 (.5) dropped (14.31 px). Axis box 77.5..812.5 × 202.5..553.5 is right; **A3 snaps** x1 812.5→797.69 (d 14.81) and y1 553.5→536 (d 17.5).
- Region 78..797.69 × 203..536; width 18.829156 m = **exactly** Σ chain-622 segments 78→795 (7 DERIVED + one 541) = 1882.9156 cm (795 is within tolerancePx 9 of 797.69); depth 8.70 = the 870 statement. Both MEASURED → MASS SOURCE_EXACT, ring SOURCE_EXACT "18.83 × 8.70 m" (EM:191). Pixel outer-to-outer would be 19.276 × 9.172 m; chain-17 states 920.
- **A6**: zone-max_z (536..553, 17 px ≥ 9) and zone-max_x (797.69..812, 14.3 px) → v2 FRONT recess + 2 PAVED terraces (`terrace-front-0`, `terrace-front-1560`, 0.45 m deep) + 2 EXTERIOR "returns" (`return-front-0-0` 0.709 m, `return-front-0-1` 0.289 m, SOURCE_DERIVED "standing in the 0.45 m front zone") + EAST terrace `terrace-east-45` 0.376 m. These are the S and E walls' own outer halves rendered as terraces and walls. World z=0 shifted by 0.4455 m.
- No extent conflict: gap 17 px < 2×18 (`BC:248`); boundary completions all REJECTED (area 0–0.86 m²); bodies FLUSH_ATTACHED/COVERED_TERRACE built:false.
- Gate: FOOTPRINT_AREA_NEAR (163.8 vs 178.13 m², −8 %), DEGRADING → completes.

### krasnokwiatach — frame `...723651b1ff`
- Extent 154.5..535 × 77..718; chain Y ticks 77|248|559|718 (lines conf .8, span 641). Long horizontal bands only at y 252 (x 373..423), 261 (425..515), 358, 550.5 (x 203..302); no long band on the N (77) or S (718) facades (band at 77 is 40 px, < 45 = 2.5 wallPx). Long vertical: 163.5 (y 362..491), 524.5 (y **95..700**), 267.75 (61..177), 235.5 (624..752).
- `axisBox` y 242.98..559.52; `sideWallReach` refuses: side A (163.5) ends 491, side B (524.5) ends 700 → |Δ| = 209 > 2 wallPx (`PD:1336`) → envelope 155..535 × 248..559 (A4).
- Grid only 9 × 5 lines (77, 248, 358, 559, 718). Flood seeds rows 77..248 and 559..718 as OUTSIDE (A5) and leaks through 248/559 (interior lines) → 2 BUILT regions (155..262 × 248..559; 364.5..535 × 248..358) → 1 mass 11.67 m² (INFERRED: the first region failed admission; the failure lists `builtRegions 2`, `masses 1`).
- Boundary: extentConflicts N and S STRONG (gap 9.5 and 8.8 walls), both INCONCLUSIVE "fails the attached-room guards"; bodies: UNKNOWN 38.14 m² (155..514 × 77..248), COVERED_TERRACE 11.32 m² (235.5..364.5 × 559..718), FLUSH_ATTACHED parts — all built:false. Which guard rejected the N part: UNAVAILABLE from the probe (INFERRED: `partShare` 0.5 × box-built ≈ 0.5 × ~33 m² < 38 m²).
- Gate WRONG (11.67 vs 143.18 m²), resolver 47 readings, none composed → RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED.

### akebiach / helikoniach (B0 only, for orientation)
- akebiach: PLAN_LAYOUT_REJECTED 96.93 vs 249.42 m² (−61 %). helikoniach: completes, 1 mass 6.46 × 12.01 m SOURCE_EXACT, a REAR return (0.876 m) and a rear terrace polygon reaching z 17.12 — same zone→recess→terrace path (§1.11); whether that terrace is true is UNAVAILABLE here.

---

## 4. Counterfactuals (single case, variant copy, reverted after each)

| id | change (variant only) | predicted | measured |
|---|---|---|---|
| CF-A | `thinLines(…, wallPx*0.5, …)` both axes | 553 and 812 survive; body to outer faces | glogownikach **RECONSTRUCTION_FAILED** at emission (WALL_CONSUMED/WALLS_OVERLAP): many slivers |
| CF-B | `minCellM 0.45 → 0.44` | 553 survives; Y restored (005P's falsifier) | layout gate **ACCEPTED** (Y restored) with **2 masses**: the 536..553 wall row is its own 0.446 m body (`ring-attached-0-0`), emission fails WALL_CONSUMED |
| CF-C | tie-break at `PD:509` `a.px-b.px` → `b.px-a.px` | 553 gets the band, 536 thinned; front zone gone | front zone/terraces/returns gone (depth 9.146), E terrace remains, but the house is cut into **3 SOURCE_EXACT bodies** (12.36×8.12, 3.94×9.15, 9.48×1.03); gate NEAR |
| CF-D | `axisLadder.valueOf` ignores `origin===DERIVED` (`LY:1136`) | width no longer the DERIVED sum; ring evidence still SOURCE_EXACT | width 18.829 → 18.885 m; ring evidence **still SOURCE_EXACT** (A9 confirmed unconditional) |
| CF-E | after `PD:1865`, widen envelope rect to STRONG `extentSides` | krasna: more built; glog: zones vanish, face unchanged | krasnokwiatach built 11.67 → **85.08 m²** (still WRONG −40.6 %, fails); glogownikach: all 3 terraces and 2 returns **vanish**, ring still 18.83 × 8.70 SOURCE_EXACT |

Reading: A6 (zone from a sub-wall gap) and A1–A3 (face choice) are **separable** defects (CF-E removes A6's artefacts
and leaves A1–A3's −0.45 m per side); simply un-thinning the outer face (CF-A/B) or flipping the tie-break (CF-C) moves
the failure into the cell/body layer (a wall-thick cell row or a re-tiled house), because the grid then has a cell
**inside** the wall. For krasnokwiatach the envelope (A4/A5) is necessary but not sufficient (CF-E 85 m²).

---

## 5. What the eligible scope (packages/reconstruction, primarily plan-decomposition.ts) can change

Without touching source-metrics, the 005P statement contest (`statement-contest.ts`, `PR` statement views), OCR,
Android, canonical schema (`packages/model`, `packages/commands`) or the renderer (`packages/geometry`, `mobile-scene`):

- `PD`: `gridLines` band claim and confidence (`:493-535`), `thinLines` (`:564-582`) — e.g. treat two lines that are the
  two faces of one wall band as one **face pair** carrying both positions instead of dropping one; `axisBox` (`:879`),
  `walledEnvelope` snap (`:1244-1256`), `sideWallReach` (`:1302`), `decomposeCore` envelope/flood seeding
  (`:1865`, `:2017-2030`; `extentSides` is already in `options`, only excluded from `CoreOptions` typing at `:360`),
  `mergeRegions`/`planBodies` (`:2298`, `:2608`), `boundaryExtension` (`:3040`), `outlineEnvelope` (`:2999`).
- `boundary-completion.ts` (`BC:50` bounds, `:238` conflict threshold), `boundary-outline.ts`, `boundary-bodies.ts`,
  `boundary-evidence.ts` (with `BOUNDARY_EVIDENCE_VERSION` bump, `:60`).
- `LY`: `extentSidesOf` (`:503`), `zonesOutsideEnvelope` (`:2182`, A6), `toOuterFaces` (`:1616`), `axisLadder` statement
  authority (`:1133-1194`; can read `evidence.extractor === 'DERIVED'` set upstream at `extract.ts:960` without editing
  source-metrics), `basisOf` (`:1859`).
- `v2/reconstruct-v2.ts:406` (MASS provenance), `v2/emit.ts:191` (ring evidence status), zone→recess/terrace
  admission (`RV2:651-720`, `:1090-1118`) — inside reconstruction, but they change model bytes/evidence labels.
- Versions to bump with any answer change: `PLAN_EXTENT_VERSION` (`PD:63`), `BOUNDARY_EVIDENCE_VERSION`,
  `LAYOUT_INFERENCE_VERSION` (`LY:69`), `SOLVER_V2_VERSION` (`RV2:75`); `PLAN_RESOLVER_VERSION` (`PR:90`) only if the
  resolver changes.

## 6. Disagreement with 005P
- 005P (`first-bad-summary.md` Q2) gives the falsifier "minCellM 0.44 keeps line 553 and restores Y (≈172–173 m²)".
  Measured (CF-B): Y is restored at the layout (gate ACCEPTED) but only by creating a separate 0.446 m attached body
  from the wall row, and the run then **fails at emission** (WALL_CONSUMED). The 005P arithmetic was a scratch
  re-implementation of the grid (INFERRED there); the full replay shows the restore is not a safe fix.
- 005P attributes the 3 terraces to "topology emits the rejected strips"; precisely, they come from
  `zonesOutsideEnvelope` (`LY:2182`, strip ≥ wallPx/2) → `RV2:651-720` → `RV2:1090-1118`; the boundary reviewer's strips
  (`classifyBodies`) are record-only and not the terraces' source (CF-E removes the terraces without touching the boundary).
- Additional KNOWN not stated in 005P: the 18.829 m width is a sum of 7 DERIVED + 1 CHAIN_CORRECTED segments treated as
  MEASURED (A7), and `EM:191` labels the ring SOURCE_EXACT regardless of basis (A9, CF-D).
