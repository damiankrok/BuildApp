# 005K council briefs (sent after the sealed set is evaluated)

Common context for every reviewer:
- Repository: /home/user/BuildApp, branch analyzer/gap-evidence-drawn-gap-v1. Read code with Read/Grep only; do not
  edit the repository.
- Brief: /root/.claude/uploads/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/4034ec27-PROMPT_CLAUDE_BUILDPLAN_ANALYZER_005K_GAP_EVIDENCE_DRAWN_GAP.md
- Production change: packages/reconstruction/src/boundary-evidence.ts (classifyGap trace, drawnGapCheck, rule behind
  drawnGapRule), gap-evidence.ts (records), plan-decomposition.ts (wiring), plan-diagnostics.ts / failure.ts (digest),
  layout.ts / v2/reconstruct-v2.ts / analysis-service/src/run.ts (option plumbing), evidence-pack (12b, BOUNDARY_GAPS).
- Tests: packages/reconstruction/test/gap-evidence.test.ts, tests/architecture/gap-evidence.test.ts,
  tests/architecture/research-isolation.test.ts (005K block).
- Artifacts: stage-reports/artifacts/analyzer-005k/ (protocol, schema, exclusion manifest, gap-set manifest, labels,
  results, constant control, development matrix, mutation results, order invariance, performance).
- Outside the repository (may be read, never copied into it): /home/user/work005k (runs, crops in gapset/label/img,
  key in gapset/label/key.json, reviewer answers in gapset/label/answers).
- Write your review to /home/user/work005k/council/<letter>.md: verdict (PASS / CONDITIONAL PASS / CHANGES REQUESTED),
  findings numbered <letter>1.., each with severity P0 (blocks the stage), P1 (must be fixed or stated before the freeze),
  P2 (note), the evidence (file:line or artifact field) and the fix you propose. Recompute any number you cite.

Stage state at review (HEAD 591197d on analyzer/gap-evidence-drawn-gap-v1):
- Phase 0: b747440 (harness), CI run 37533180890 green incl. UI evidence gate.
- Production change c244ff7; freeze 892853e (FREEZE_SHA); manifest seal 70aa0a4; deviation D1 439531c; labels seal 6672a89;
  evaluation 591197d. Verdict drafted in stage-reports/artifacts/analyzer-005k/recommendation.md: INSUFFICIENT_EVIDENCE
  (rule OFF), next FIX_STOREY_COUNT.
- Do NOT run research/analyzer-005k/perf.sh or mutations.mjs (they patch the tree in place), do not run git commands that
  change anything, do not edit any file except your own review file.
