# v3.54.2: hand-off (text only; no key, no publisher image)

## State (2026-11-16, end of v3.54.2)

### Revisions
- Protocol sealed `53eec3a`.
- Candidate frozen `d427df8`.
- Report and tests on the branch HEAD.
- Default analyzer path byte-identical to v3.54.1:
  - A = A′ on 6 DEV;
  - the Madera metric evidence hash is unchanged.

### Spend
- 50 answered requests, 1.987078 USD (`research/ai-assist/spend-ledger-v3542.json`).
- One request cut by the operator: its reservation of 0.146096 USD stands.
- Books `/home/user/rd/v3542/books`, opened at 4.11036 and now 6.243534 cumulative.
- Remaining within the pilot ceiling (24.11036): 17.87 USD. Within the project's 100 USD: 93.76 USD.

### Key
`/root/.config/buildplan/campaign-key` (outside Git; it is lost with this container). A new session needs the key again as `BUILDPLAN_ANTHROPIC_API_KEY`.

## Artifact index

### Private, outside Git
- `/home/user/rd/v3542/`, packed into `/home/user/BuildPlan-V3542-Private.zip`.
- Run directories:
  - `A/`, `A2/`, `A-confirm/`: LOCAL and LOCAL+cross-axis.
  - `C1/` (stage B), `C2/` (stage C, live), `C2-final/` (stage C answers consumed by the frozen code), `D/` (confirmation, live).
  - `*-art/`: standard artifacts of the consumed readings.
  - `probe/`: synthetic consumer probes.
- `boards/`: 20 PNG.
- `table-dev.json`, `table-confirm.json`, and the `events.jsonl` of every house.

### Code
- `packages/analysis-service/src/consult/`: contract, problems, tools, loop, consult-analysis, anthropic.
- `packages/source-metrics/src/consulted.ts`, `consulted-spans.ts`.
- `apps/analyzer-api/src/{executor,wiring}.ts`: the `ANALYZER_CONSULTANT=pilot` flag.

### Research tools (`research/source-to-model/v3542/`)
- `consult-run.ts` (live / `--replay`);
- `score.py`, `roof_axis.py`, `tables.py`, `board.py`, `crops-check.ts`, `ev.py`.

## Open problems (for the next stage)
1. The transaction accepts refusal → model on a settled scale without checking the built extent against the consulted overall dimensions (sp318422: depth +67 % accepted).
2. With a verified scale, plan composition fails or over-extends:
   - Supertunie: envelope;
   - Aksamitki: resolution;
   - Madera: 49 % coverage;
   - sp318422: depth.
3. Post-build findings have no consumer: ASSIGN_VIEW, ROOF_FORM, OUTLINE_REGION, OPENING, MISSING_ELEMENT.
4. Readings that cannot be applied:
   - a label read in a direction the analyzer has no lattice for;
   - room-size notes in ft-in (CAPABILITY_MISSING).

## Next step (one)
OWNER/coordinator decisions in report §14. The cheapest concrete step is the extent check in `compareRuns`, re-evaluated on the recorded D answers with `consult-run.ts --replay /home/user/rd/v3542/D` (no API cost).
