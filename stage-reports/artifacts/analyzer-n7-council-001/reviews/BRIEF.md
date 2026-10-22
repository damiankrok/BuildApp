# N7-COUNCIL-001 — shared brief (read-only audit)

Repo: /home/user/BuildApp (TypeScript monorepo + Android app). Branch claude/new-session-3kzcgh, HEAD 6788e7d. DO NOT commit,
push, change branches, or edit production code (packages/*/src, apps/*/src). Temporary diagnostic harnesses ONLY under
/home/user/BuildApp/research/analyzer-n7-council/<your letter>/ (run with `npx vite-node <file>` from repo root) or tests
under that same folder run with `npx vitest run --root . research/...` is NOT in the vitest include — prefer vite-node scripts
that assert and print. Never write publisher (ARCHON) rasters into the repo. Do not try to identify the owner's private house.
Do not run the full test suite or CI; run only small targeted reproductions. Do not fetch from the network unless essential.

## The problem
The owner's private benchmark (house unknown, do not guess) still shows after stages N7, P1, P2, P2R:
3 masses read, 2 wall rings built, 27 walls, 2 slabs, 2 roofs, 26 openings kept, 10 rooms, 23 unresolved; the refusal is
commandIndex 21, `createWallRing ring-attached-1-0`, WALLS_OVERLAP between w1 and w3, shared area 0.3092 m²; partial-preview
checkpoint 16 commands, model hash prefix 1f9f85c22a83. The same error and checkpoint hash existed before P2R. The screen does
not prove it shows a NEW run of the 1306 bundle (could be a stored older result).

## Pipeline (start points)
- packages/analysis-service/src/run.ts `runAnalysis` → source acquisition (packages/source-package, source-analyzer),
  metric evidence (packages/source-metrics: OCR, dimension chains, scale), packages/reconstruction/src/v2/reconstruct-v2.ts
  `reconstructV2` (layout from packages/reconstruction/src/structural-layout.ts, plan-decomposition, plan-resolution …),
  BuildingV2 (v2/building.ts) → v2/emit.ts `emitBuilding` → packages/reconstruction/src/candidate.ts (`fitPreviewProgram`,
  wall reconciliation v2/wall-reconciliation.ts, `cutFailedObject`) → packages/model + packages/commands (validator,
  WALLS_OVERLAP) → packages/mobile-scene (MobileSceneBundle) → apps/local-analyzer (bundle run on the phone via nodejs-mobile)
  → apps/android (LocalAnalysis.kt, DownloadedScenes, PreviewOutcome.kt, result storage).
- docs/analyzer/CODE_MAP.md (may be stale), stage-reports/STAGE_BUILDPLAN_ANALYZER_005Y_N7_*.md (N7, P1, P2, P2R reports).
- P2R: v2/thin-body.ts (`thinBodies`, `adjudicateThinBody`) wired in reconstruct-v2.ts; `thinBodies()` SKIPS masses with
  `pieceOf` or `storeyRects`; emit.ts builds each storey's ring from `rectAt(m, storey)` (storey rects), thickness `tOf(m)`.
  Mass ids: main, attached-<k> (layout order), pieces `${id}-s${storey}-${k}`; ring id `ring-<massId>-<storey>`.

## Evidence you may use (offline)
- Synthetic fixtures (invented): packages/synthetic-drawings/src/fixture.ts (LARCHFIELD, HOLLOWAY, SLIVERTON,
  SLIVERTON_DIMENSIONED, THINWALL, REDMIRE, …) with `syntheticPublisher` and `runAnalysis` — see
  packages/analysis-service/test/thin-body-n7-p2r.test.ts for how to run one end to end.
- Sealed real corpus (8 houses): replay with research/analyzer-005y-n7-p2/replay.ts; the runner script
  /tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/p2run.sh shows the run dirs and byte caches per house
  (a01 gozd marcowki ciesz rary trytomach arganiach sasankach3). Corpus model hashes (prefix): a6849073 852c257a 8541ca10
  5394c17c 73969751 d2bf0c03 34a95a76 090749f4. research/analyzer-005y-n7-p2r/corpus-demo.ts shows a research-only
  `diagnostics.narrowMass` injection.
- Latest replay outputs (audit.json, model.json, program.json per house) are in
  /tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/r1/<house>/.

## Output
Write your findings, BEFORE seeing anyone else's, to /tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/council/<LETTER>.md.
Classify each: CONFIRMED_DEFECT (reproduced, with evidence) | COVERAGE_GAP (production path skipped by an existing check,
shown) | HIGH_RISK (reasoned, not reproduced) | DESIGN_LIMITATION | NOT_A_DEFECT (suspicion refuted). Never present a
hypothesis as confirmed. For every CONFIRMED_DEFECT/COVERAGE_GAP give: FIRST_BAD → file:function → input → current behaviour
→ correct behaviour → the test that passes wrongly today or is missing, plus the exact command that reproduces it.
Also give, for the functions you reviewed on your path: FILE → FUNCTION → INPUT → ASSUMPTIONS → POSSIBLE FAILURE → EFFECT →
EXISTING TEST → VERDICT (short rows are fine for helpers). Report silent failures (fallbacks/defaults taken as fact, results
that only go to a report and never into geometry). End with your top 3 findings by impact on: total model refusal, lost
correct bodies/walls, wrong scale/dimensions, wrong body/storey count, elevation mismatch, invisible model on Android.
Keep the final message you return short (a summary + the path of your file).
