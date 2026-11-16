# v3.54.3: hand-off (text only; no key, no publisher image)

## State (2026-11-16, end of v3.54.3)

### Revisions
- Checkpoints: `4191ef4` (packages A, B, roof consumer), `d17652d` (boundary family, HTTP test, confirmation references frozen), `195ac56`, **`aabc044` FROZEN candidate** (protocol sealed, `stage-reports/artifacts/v3543/PROTOCOL.seal`).
- Report and delivery on the branch HEAD after it (text, tools and ledger only; no analyzer code changed after the freeze).
- Analyzer: service 1.11.0, solver 2.44.0; consultant contract 0.2.0, prompt 0.3.0.
- Default path: A1 = A0 on the 10 DEV houses (4 models by hash, 6 refusals); the synthetic contract house's scene is byte-identical.

### What exists
- `consultAnalysis`: metric rounds → boundary round (`CLASSIFY_BOUNDARY`) → model looks (≤ 2 corrections + review) with `ROOF_FEATURE`; every decision kept or rolled back; `sourceCheck` (axes, corrections, known defects) and `consultation` in the result an app consumes.
- Consumers: `solveFrameMetric` (`consultedScale`, one metric revision), consulted spans as frame chains, `glazedEndClosure`, `applyRoofFeatures` (dormer on a gable roof's slope; stable id `dormer-<side>-c<centre %>`).
- Host: `ANALYZER_CONSULTANT=pilot` + `ANALYZER_HOUSE_READER=live` + token; off by default.

### Results
- DEV (10): 3 refusals → models (Aksamitki, sp318422, Supertunie); 1 dormer built and reviewed (Aksamitki); 4 models unchanged; 3 refusals stand. Replay of all 10 on `aabc044`: same model hashes.
- CONFIRM8 (first frozen result, kept): dormers detected 5/5, built 3, matched by the scorer 1; 0 houses corrected by the sealed criterion; 0 features on 3 negatives; outline 0 corrected, one refusal → model without its garage and with a falsely favourable outline status. Transfer of quality: NOT_CONFIRMED.
- Host: three jobs + a no-token job through `POST /v1/analyses`, twice (first on `d17652d`, then on `aabc044`).

### Spend
- 77 answered requests, 3.719688 USD (`research/ai-assist/spend-ledger-v3543.json`): DEV 0.670006, host 0.748428 + 0.785486, confirmation 1.515768.
- No reservation of unknown cost in v3.54.3. Six reservations made in error for replayed answers were released by journal (INTERVENTIONS #1).
- Books `/home/user/rd/v3542/books`: 9.963222 cumulative. Remaining within the pilot ceiling (24.11036): 14.15 USD. Within the project's 100 USD: 90.04 USD.

### Key
`/root/.config/buildplan/campaign-key` (outside Git; lost with this container). A new session needs it again as `BUILDPLAN_ANTHROPIC_API_KEY`.

## Artifact index

### In Git
- `stage-reports/SOURCE_TO_MODEL_V3543.md`, `README_V3543.md`
- `stage-reports/artifacts/v3543/`: `PROTOCOL_V3543.md` + seal, `INTERVENTIONS.md`, `CAPABILITY_GAPS.md`, `dev-table.json`, `confirm-table.json`
- `research/source-to-model/v3543/`: `consult-run.ts`, `host-e2e.mjs`, `roof_features.py`, `confirm_score.py`, `tables.py`, `board.py`, `board_plan.py`, `sources/` (8 sealed packages), `refs-confirm/` (+ sha256), `refs-dev/`
- `research/ai-assist/spend-ledger-v3543.json`

### Private, outside Git (`/home/user/rd/v3543/`, packed into `/home/user/BuildPlan-V3543-Private.zip`)
- `C1/`, `C1b/`, `C1c/` (Aksamitki, three live passes), `C2/`, `C3/` (DEV live), `Cdev/` (links to the ten final DEV runs), `Cdev-replay2/` (their replay on the frozen commit)
- `CONFIRM/` (the eight, first result), `host/` (first host run), `host2/` (host run on the frozen build)
- `boards/` (ŹRÓDŁO | PRZED | PO), `src/` and `look/` (publisher pictures), `confirm/cache` (source bytes of the eight)
- books: `/home/user/rd/v3542/books` (cumulative, never reset)

## Next command

The first decision of the report (queue order and holds) is a change in `consult-analysis.ts`: withhold `ROOF_FEATURE` while the same look files a handedness, missing-body or scale-contradiction finding. It can be developed against the recorded CONFIRM8 answers at no API cost — those eight houses are DEV from now on:

```
npx vite-node research/source-to-model/v3543/consult-run.ts -- --list /home/user/rd/v3543/confirm8.txt \
  --out <dir> --variant C --phase dev --replay /home/user/rd/v3543/CONFIRM
```

A new confirmation needs new families.
