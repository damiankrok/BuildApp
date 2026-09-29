# 04 — Hard vs soft constraints (Council A, C, F; E for runtime)

Rule of the stage: **a terminal hard failure is justified only after the plausible candidate
families are exhausted.** A hard validator stays hard; what changes is *what* it refuses — a
candidate, not the run — and *when* — after the bounded alternatives, not after the first reading.

## 1. Stay hard (never softened, never a score)

| Validator | Where | Refuses | Why hard |
| --- | --- | --- | --- |
| URL fence: https, no credentials, default port, named public host; per-hop SSRF checks; byte cap; media types | `source-package/src/security.ts`, `net.ts` | the run, before any fetch | safety (A) |
| decoded pixel size is the truth; size mismatch between package and bytes | `acquire.ts:143-147`, `analyze.ts:135` | the asset / the run | a package sealed wrong (A) |
| phone text shim refuses characters outside its CLDR replica | `apps/local-analyzer/src/text.ts` | the run on the phone | approximating ICU would make phone ≠ desktop silently (A) — the cure is to stop sorting free text with `localeCompare`, not to soften the refusal |
| canonical model: schema, referential integrity (`UNKNOWN_*`, `DUPLICATE_ID`), `WALLS_OVERLAP` at 1e-6 m², `WALL_CONSUMED`, `DEGENERATE_WALL`, `MALFORMED_POLYGON`, junction/ring logic, opening host codes, roof-opening codes, stair codes, assembly honesty (`ASSEMBLY_QUALITY_OVERSTATED`, `UNKNOWN_ASSEMBLY_INVALID`) | `packages/model/src/{validate,validate-architecture,topology}.ts` | the command (emission) | a model that is not a solid (F). The emitter's response to a refused *hosted* object is drop-with-reason, never a softer validator |
| `verifyReplay` byte identity; `serializeModel` refuses an invalid model | `candidate.ts:251`, `serialize.ts:39` | the run | a model that cannot replay is a story (F) |
| per candidate: no world frame / no envelope / no body / degenerate or non-finite geometry / ring outside the sheet / anisotropy > 1.15 / wall thickness outside 0.15–0.7 m | resolver (new), `layout.ts`, `v2/frame.ts`; wall thickness today silently replaced at `reconstruct-v2.ts:230` | the candidate | the candidate does not exist physically (C) |
| per candidate at acceptance: `MASS_OVERLAP` (two bodies in one place) | `layout-gate.ts:124` | the candidate | two bodies cannot occupy one plan (C, F) |
| no plan and no elevation at all → `NO_DRAWINGS` / `SOURCE_INCOMPLETE` | `run.ts` CLASSIFYING_SOURCES | the run | nothing to reconstruct (A) |

## 2. Become candidate scores or late validation

| Today (terminal on the first reading) | New role |
| --- | --- |
| `FOOTPRINT_AREA_WRONG` (> 20 % from the published footprint) → `PLAN_LAYOUT_REJECTED` for the run | refuses **the candidate**; bucket AGREES (≤ 6 %) / NEAR (≤ 20 %) / WRONG / UNKNOWN is the first scoring key among surviving candidates; the run fails only when every candidate is refused, and then as `PLAN_RESOLUTION_INCONCLUSIVE` listing them. It is a *residual*, never a generator: no candidate is solved for the published figure (C: D1, D2). |
| `PLAN_NO_WALLED_ENVELOPE`, `PLAN_GRID_EMPTY`, `PLAN_NO_ENCLOSED_CELLS`, `PLAN_NO_BUILT_REGIONS`, `PLAN_NO_MASSES` (the `planFailureOf` ladder) | invalidate **one decomposition** (one copy × extent × scale); the ladder describes the best failed candidate in the diagnostics. First-link codes stay terminal only when no candidate can be generated at all (`PLAN_NOT_FOUND`, `PLAN_NOT_DECODABLE`, `PLAN_NO_WALL_BANDS` on every copy). |
| `MIN_MASS_WALL_FRACTION` 0.35 cliff dropping a merged region whole | acceptance test of each rectangle in the walled-first merge candidate; the demoted cells are named, not silently removed |
| chain frame as the plan extent, always | one extent hypothesis among two (chain rectangle, wall-mass cluster) |
| the frame's registration as the only scale | one scale hypothesis among ≤ 3 (registration; the overall chains' own lattice readings) |
| `STRUCTURE_SILHOUETTE_DISAGREES` (BLOCKING but already excluded from the refusal codes) | DEGRADING + corroboration term (C) |
| planner drops, opening fits, closure findings, compile diagnostics, source-view residuals | already soft; counted in the result and, for the resolver, available as corroboration / demotion |

## 3. New hard/soft decisions made by this Council

- **Plan-copy completeness is a named source limitation, not a geometry verdict** (A): when a
  discovered FLOOR_PLAN candidate failed to fetch and the storey's surviving copies cannot be
  resolved, the failure says so (`missingEvidence`), instead of `FOOTPRINT_AREA_WRONG`. It does not
  stop the run before the resolver tries the surviving copy: the Kosaćce area-table copy resolves.
- **Acceptance of a non-incumbent candidate needs more than the footprint** (C): bucket AGREES; or
  NEAR with ≥ 1 independent corroboration; or UNKNOWN (no published figure) with ≥ 2. WRONG never.
- **A resolved result is never silent** (C): a NOTED gate reason names the departures from the
  incumbent reading, and a DEGRADING reason is added when only one corroboration held.
- **Cancellation** (E): a cancel is a hard stop honoured at the next checkpoint; a heartbeat never
  influences a result.
