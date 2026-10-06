# research/analyzer-005k — gap evidence, the sealed fresh-sheet gap set, the drawn-gap rule

Research harness of BUILDPLAN-ANALYZER-005K. It holds code and text only. It is:
- not a workspace;
- not typechecked or tested by the repository gates;
- never imported by production (`tests/architecture/research-isolation.test.ts`, 005K block).

**What stays outside the repository** (`$W`, default `/home/user/work005k`, recorded here by SHA-256 only):
- every publisher byte (pages, plan rasters);
- every composed crop;
- every run directory and every label sheet.

**What enters the repository** (`stage-reports/artifacts/analyzer-005k/`):
- gap ids, coordinates, crop rectangles and hashes;
- labels and their sources;
- results.

| file | what |
| --- | --- |
| `dev-rows.json` | the development rows: 005I's 24-row matrix and the two blind-round-8 houses; sealed inputs and byte caches, outside the repository |
| `dev-matrix.mjs` | replays every row with the solver alone on its sealed evidence, OFF / ON / ON_DECOY (published footprint × 1.25), and reports hashes, outcomes, upgraded gaps, the first changed decision and the decoy control |
| `exclusions.mjs` | the exclusion manifest, built before the draw: committed exclusion lists, blind draws, sealed packages, and every project linked from any cached development page |
| `draw.mjs` | the draw by lot from the frozen commit: 8 ARCHON + 6 DobreDomy projects, one per family (`gap-set-protocol.md` §3) |
| `extract.mjs` | from the frozen live runs, the population (WEAK, WALL/WALL, drawn) on every sheet whose boundary was read, frozen into `gap-set-manifest.json` with neutral question ids |
| `compose.py` | the pictures a reviewer labels: the crop beside the same crop with brackets outside the wall band and a 1 m bar; neutral names; key apart |
| `constant-replay.mjs` | the CONSTANT control as a replay-only copy of `boundary-evidence.ts` swapped in through a Vite alias (005J's method) |
| `evaluate.mjs` | BASELINE / CONSTANT / DRAWN_RULE on the sealed set, with Wilson intervals, the protocol's splits and outcome-critical false bridges |
| `mutations.mjs` | M1–M5: temporary in-place patches, the 005K suites, restore and check clean |
| `perf.ts` | the cost of the trace, the records and the rule: the solver on sealed evidence, the record builder alone, the records' size |

## Reproduce (from the BuildApp root)

```bash
W=/home/user/work005k
node research/analyzer-005k/dev-matrix.mjs run --work $W/dev --modes OFF,ON,ON_DECOY --par 3
node research/analyzer-005k/dev-matrix.mjs report --work $W/dev --out stage-reports/artifacts/analyzer-005k/development-matrix.json
node research/analyzer-005k/exclusions.mjs --caches <development byte caches> --runs <development run roots> \
     --out stage-reports/artifacts/analyzer-005k/gap-set-exclusion-manifest.json
# at the pushed freeze commit, clean tree:
node research/analyzer-005k/draw.mjs --freeze-sha <FREEZE_SHA> --ledger $W/gapset/draw-ledger.ndjson
# each kept draw, once, live (ids A<k>, D<k>):
npm run -s analysis:second-house -- --url <url> --cache $W/gapset/cache --out $W/gapset/runs/<id> --recogniser
node research/analyzer-005k/extract.mjs --runs $W/gapset/runs --ledger $W/gapset/draw-ledger.ndjson --freeze-sha <FREEZE_SHA> \
     --out stage-reports/artifacts/analyzer-005k/gap-set-manifest.json      # commit + push: the seal
python3 -I research/analyzer-005k/compose.py --manifest stage-reports/artifacts/analyzer-005k/gap-set-manifest.json \
     --runs $W/gapset/runs --cache $W/gapset/cache --out $W/gapset/label
# blind reviewers label $W/gapset/label/img/q###.png; labels committed + pushed before any evaluation
# replays per project (solver alone on the live run's sealed evidence): OFF, ON, CONSTANT
node research/analyzer-005k/constant-replay.mjs setup --work $W/constant
node research/analyzer-005k/evaluate.mjs --manifest ... --labels ... --runs $W/gapset/runs --replay $W/gapset/replay
node research/analyzer-005k/mutations.mjs --out $W/mutations
npx vite-node research/analyzer-005k/perf.ts -- --rows <rows> --repeat 3 --mode OFF --out $W/perf-off.json
```
