# ADR-V3544 — the API may describe the whole house; the analyzer agrees, builds and verifies

Status: accepted (OWNER decision of 2026-11-17, Master Plan v3.54.4 §2, §7, D29–D33). Supersedes the restriction of
v3.54.2–v3.54.3 (D20) that limited the API to local readings and bounded corrections.

## The conflict

- Master Plan v3.54.2/v3.54.3 §7 and the briefs of those stages: the API never describes the house; it reads a label,
  classifies a boundary, or names one difference of a built model. `consultAnalysis` records
  `globalDescription: DISABLED`, and the protocol of v3.54.3 lists "no global generator" as a boundary.
- OWNER brief v3.54.4 §0 and Master Plan v3.54.4 D29: the API may read and describe the WHOLE building from all proper
  sources, give printed dimensions in metres after an explicit conversion, and propose a full semantic hypothesis.

## Decision

The newer instruction wins (repo rule: the latest explicit OWNER instruction determines the authorized scope). Concretely:

1. A whole-house source description by the API is allowed and is the main input of this stage. It has its own
   identifiable contract (`house.json`, `buildapp.house-document`), separate from the free `HouseDescription` of v3.54.1,
   which is NOT restored as an unchecked replacement of LOCAL (D13).
2. What does not change: the analyzer validates, reconciles, recomputes dependents, builds and compiles. An API answer
   is an observation or a hypothesis with provenance per parameter — never the accepted model by itself, never a
   measured quantity by itself. A printed value keeps its literal text and its conversion; an estimate never gets the
   status of a print; UNKNOWN is never a hidden zero.
3. LOCAL has no unconditional priority because it labelled its own scale STRONG, and the API has none because it is
   confident: a disagreement is settled by source evidence of the same meaning (a printed dimension with its ends, a
   datum on a section, an anchor not used for the fit).
4. Order of acceptance (D32): identity/variant → orientation and metric → bodies and levels → roofs → openings →
   dependent features. A known defect of a host holds the features that depend on it, not independent facts.
5. One accepted house: the document is the audit of the analysis and the input of the deterministic builder, bound by
   an adapter to the existing domain (`BuildingV2` → emitter → commands → compiler). It is not a second model of truth.
6. A hand-checked description (MANUAL_DIAGNOSTIC) goes through the same validator, adapter, builder and compiler, on
   the test path only: never a production fallback, never counted as automatic recognition (D30).
7. The pilot stays behind its flag and token, off by default; the key stays on the host.

## Consequences

- `globalDescription: DISABLED` remains true of the v3.54.3 consultant path; the new path records its own contract and
  version. The two do not run side by side on one job.
- Statements of v3.54.3 that rest on the old restriction (protocol §1, report §15.6 "nie pozwalałbym API generować
  domu") are history, not current rules; the report of v3.54.4 says where they were revised.

## Outcome (2026-11-17)

Implemented as decided. The contract is `buildapp.house-document` 0.1.0 with the reading contract
`buildapp.house-reading` 0.1.0; the pilot flag is `ANALYZER_HOUSE_DESCRIPTION=pilot`. The decision between the described
house and LOCAL is made on source facts (`arbitrate`): printed overall dimensions verified on the traced outline, the
published building height, the area and the place of the walled outline. First frozen confirmation: improved whole
exterior on 5 of 8 new houses with no critical regression; a faithful exterior on 1 of 8
(`stage-reports/SOURCE_TO_MODEL_V3544.md`). The kernel build loop lives in the analysis service: the reconstruction
package still only emits commands.

