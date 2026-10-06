# 005K baseline

## Start

| | |
| --- | --- |
| repository | `damiankrok/BuildApp` (Legacy untouched) |
| starting branch | `analyzer/floorplan-intelligence-audit-v1` |
| required starting HEAD | `1314df729edc4eb6bb3af5a4e033727b364b4153` — **verified** before any change (`git rev-parse HEAD`) |
| stage branch | `analyzer/gap-evidence-drawn-gap-v1`, created from that HEAD; every push also goes to `claude/new-session-3kzcgh`, as 005A–005J did (the push that triggers BuildApp CI) |
| 005J closing CI | run 37514203211 on `d287aba`: 38 jobs pass, 2 skipped by design, the Android UI evidence gate red on both attempts in `VerticalSliceDeviceTest.openStage` (Kosaćce, then Rarytasy) with Compose's `SnapshotStateObserver` thread check. Run 37527940478 on `1314df7` (the 005J closing commit, documentation only) was green, the UI evidence gate included: the race is intermittent |

## The production code the stage starts from

- The boundary evidence is at 1.1.0 and the Evidence Pack at 1.1.0.
- `classifyGap` decides every gap; it keeps no trace of how.
- Weak gaps have no coordinates in the pack (005J opportunity map, "evidence_pack_crop_support").
- The bare gap id `gap-<axis>-<line>-<from>-<to>` is the only identity.

## Gap ownership, traced in the code (brief §7)

| seam | where | what it decides |
| --- | --- | --- |
| gap candidates | `readWallLine` (`boundary-evidence.ts`) | solid runs of wall-thick ink along a grid line; a break ≤ half a wall is the drawing's; pieces ≥ the opening radius; each adjacent pair of pieces is a gap |
| classification | `classifyGap` | width rules (lintel 3.2 m, widest 8 m), jamb kinds (WALL / POST, along / cross-section), the strokes across (`gapStrokes`), the signature (`gapSignature`), the pattern override (`patternAcross`), the runs-past rule → `DRAWING_BREAK_SUPPORTED` / `OPENING_SUPPORTED` STRONG / `UNKNOWN_GAP` WEAK / `TRUE_EXTERIOR_GAP` NONE |
| callouts | `assignCallouts`, `withCallout` | a printed width agreeing with a gap: drawn + sure → STRONG; otherwise WEAK |
| corner legs | `cornerLegs` | glazing turning a corner → STRONG |
| weak / strong evidence | `solveOutline` (`boundary-outline.ts`) | STRONG bridges; WEAK bridged by what lies behind it (the pocket rule `max(6 m², 2.5·w²)`), at most 48 judged per plan, in id order |
| wide openings | `collinearWideGaps`, `baysOf`, `WideOpeningDecision` (`plan-decomposition.ts`) | the decomposition's own wide-gap decisions (OPENING_IN_WALL / OPEN_SIDE), apart from the boundary's gaps |
| garage mouths | `boundaryExtension` | in the reading that shuts pocket mouths, an open-mouthed garage's mouth gap becomes STRONG |
| boundary record / serialisation | `boundaryExtension` → `BoundaryRecord` → `planDiagnosticsOf` (digest) → Evidence Pack `11`/`12` | gap **counts** by class, bridged counts, policies, bodies, completions — no per-gap record |
| REC-18 / completion policy | `completeBoundary` (`boundary-completion.ts`), `policiesAgree` | a completion is accepted when the strict policy encloses it or a WEAK gap is closed by a vehicle door; WEAK gaps along a completion's sides are counted in `weakGaps` |
| 005I order invariance | `assignCallouts` (sorted by id), `solveOutline` (weak gaps judged in id order) | the boundary's own enumerations were already canonical |

## Reproduction of 005J's finding with the new code (rule OFF)

- `dom-w-gozdzikowcach`, solver alone on its sealed round-8 evidence, reproduces the sealed failure:
  `PLAN_RESOLUTION_INCONCLUSIVE`, 105.47 m² against the published 132.52 m².
- The record of `gap-Y-538-322-338` (0.41 m, `LEAF_FACE`) now says why a tightened drawn-gap rule does not take it.
  Its left "jamb" has wall-thick ink 0.06 on its own axis. The stretch is the end of a perpendicular wall, about 11 px
  short of the gap's edge (development evidence, inspected outside the repository).
- 005J's unrestricted `ALL_DRAWN` upgrade took this gap and completed the footprint. The rule specified by the brief
  does not (`development-matrix.json`).
- Every other development row with the rule OFF reproduces its sealed model hash or failure code: 26 of 26. This
  includes `dom-w-dabecjach` and `dom-w-tunbergiach`, which 005J could not replay; their caches are the 005I matrix's
  own.
