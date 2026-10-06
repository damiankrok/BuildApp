# 005K council — reviewer C (non-circularity and evidence semantics)

Reviewed at HEAD 591197d, read-only. I ran the two architecture suites, the gap unit tests and the versions test with vitest, and a few node one-liners over the artifacts and `work005k/gapset/runs`. I edited nothing else.

## Verdict: CONDITIONAL PASS

There is no P0. On question 1, nothing the drawn-gap rule or the records read comes from a published figure, an area, a refusal, a failure code, a house or publisher, a label or an outcome. `classifyGap`, `drawnGapCheck`, `solidShare`, `inkShare`, `gapEvidenceRecords` and `decompositionIdOf` read only these inputs:
- the mask and the solid layer;
- the wall-line pieces and the strokes;
- `wallPx`, and `mppAlong` from the registration;
- `maxOpeningM` 3.2 and `maxWideOpeningM` 8;
- the extent and grid lines, and the shut-mouths bit.

The rule cannot be switched ON by production:
- `apps/` never names it.
- run.ts, reconstruct-v2.ts and layout.ts pass ON only when their caller asked for it.
- plan-decomposition defaults to OFF.
- CI's `analysis:second-house` call passes no flag.
- Only research scripts and tests ask for ON.

No decision reads `gapEvidence` or the trace. Only plan-diagnostics and evidence-pack name `gapEvidence`.

Four P1 items must be fixed or stated before closing.

## Findings

**C1 — P1 (fix): `research-isolation.test.ts` has been red since the manifest seal.** The test only accepts files ending in `py|ts|mjs|cjs|json|md|txt|sh`. `gap-set-draw-ledger.ndjson`, committed in 70aa0a4, fails that check: 1 failed / 17 passed in my run.
- The extension assertion throws first, so the content checks (base64, long numeric arrays, 4 MiB) have not run on any 005K artifact since the seal.
- I ran them by hand: 32 tracked files, 0 violations.
- During this review an uncommitted working-tree edit adding `ndjson` appeared. It is not mine.
- Fix: commit that edit and re-run CI. Recommendation gate item 11 ("non-circularity green") should cite both suites.

**C2 — P1 (state): the order-invariance claim leaves out family B.** Recomputed from `order-invariance.json`:
- Family A: 0 of 192 shuffles moved anything (24 rows × 8). 4 of those rows have 0 records. Rows `eoze-legacy-area` and `kosacce-area-alone` (2 of the 26 development rows) are skipped.
- Family B: 83 of 192 chain-order shuffles moved the `decompositionId`, on 13 of 24 rows. No shuffle moved records on an unchanged grid.
- That last result holds per permutation only. On dom-w-arkadiach and dom-w-cyklamenach both plans moved, so per-plan attribution is not established.
- Gate row 2 of `recommendation.md` cites family A alone.

Leaving `gridLines` untouched is defensible. It is upstream, it predates 005K, and making it order-invariant would move decisions and hashes with the rule OFF on 13 of 24 rows, breaking "nothing a decision reads changed". Proposed wording for the report:
> "Records and decisions are a deterministic function of the source as enumerated: invariant to the order of copies, callouts, observations and registrations (0/192), not to the order of dimension chains (83/192 shuffles on 13/24 rows move the grid, and with it the decomposition id, gap ids and records). The sealed keys are pinned to the chain order of metric-evidence 1.7.0 / chain-solver 1.4.0. `gridLines` order dependence is pre-existing and out of scope."

Also queue a follow-up task for it.

**C3 — P1 (fix or state): the §19 "never ON" guard does not cover the resolver.**
- The guard checks lines containing `'ON'` in three files only.
- `plan-resolution.ts` holds the published footprint and reads plans through `{ ...shared }`. A reading hypothesis `{ ...shared, drawnGapRule: 'ON' }`, kept when "no worse against the figure", is exactly the outcome-circular route. It passes all 8 architecture tests.
- An indirection also escapes, because lines without the literal are never inspected: `const MODE = 'ON' as const` … `drawnGapRule: MODE`.
- Fix:
  - scan every `packages/*/src` file for `drawnGapRule` against an allowlist;
  - forbid it in any file that names `publishedAreas`;
  - add a test that no production module other than plan-diagnostics and evidence-pack reads `gapEvidence` or `.trace`.

**C4 — P1 (state): the manifest carries outcomes that the protocol says it does not.**
- Protocol §4.4 and the `extract.mjs` header say "no outcome".
- `projects[].run` holds `COMPLETED` + modelHash, or `FAILED` + code, for all 14 projects.
- In substance this is acceptable:
  - it is project-level and comes from the live run with the rule OFF;
  - §4.5 attrition needs it (D01–D05 stop at METRIC_RESOLUTION; A01 has no digest);
  - labellers never received the manifest.
- But the committed manifest maps qid → project → outcome. It was in the working tree while sub-agents with Read access labelled, so blindness rested on the prompt line "Open ONLY the picture files listed".
- State both points as a clarification. Do not alter the sealed file.

Otherwise the manifest is clean. `listSha256` recomputes (a37f0d72…), and the manifest and labels are unchanged since their seals. Gap rows carry no rule condition beyond WEAK, WALL/WALL and drawn. κ recomputes to 0.8451 (56/60 agree).

**C5 — P2: the vocabulary and literal guards can be bypassed.** These must be closed before any stage proposes ON.
- `numbersIn` cannot see leading-dot, hex or exponent literals:
  - `0x80` already sits invisibly in `inkCropHash`;
  - `1e-9` is recorded as `'9'`;
  - `Math.min(maxOpeningM, 1 + .65)` in `drawnGapCheck` leaves its frozen set `['0','1']` unchanged.
- `withoutStrings` erases single-quoted keys, so `options['footprintM2']` escapes the FORBIDDEN vocabulary check.
- The rule's inputs are unguarded: `gapSignature`, `readWallLine` (`along` at 1.25·t), `lineOptions`, and `DEFAULTS.maxOpeningM` in plan-decomposition.
- Concrete benchmark fit that no gate catches: a 1.65 m drawn-gap cap passed as a neutrally named option. It removes q049 (1.685 m), the only false upgrade, and keeps 13 of the 24 true upgrades.
- Fix: tokenise numbers properly, freeze the consts and thresholds the rule reads, and guard `gapSignature` and `readWallLine` too.

**C6 — P2: Evidence Pack 12b covers the selected storey only.**
- `framesOf` keeps same-storey copies, at most 4.
- For A04 the ATTIC sheet is missing. That is 8 of 313 weak records, including 4 of the 60 sealed gaps (recomputed against each run's 12b).
- pack.ts still says "every gap a reading left WEAK".
- Fix: include every digest plan that has records, or state "selected storey" and list the omitted frames with their counts.

**C7 — P2: keys and versions are consistent.**
- The key `frameId/decompositionId/gapId` is unique: 313/313 in the 8 runs and 60/60 in the manifest, which also prefixes the project.
- `decompositionId` deliberately excludes the rule mode. It also excludes callouts and recogniser and the raster bytes, so cross-pack joins must add `variantByteHash` (present per copy), the recogniser and the mode.
- Boundary evidence 1.2.0 and pack 1.2.0 match additive content. `PACK_FILES_SINCE` is right and the versions test is green.
- Inserting `BOUNDARY_GAPS` changes `downstreamOf('EXTENT')` from [ENVELOPE, ENVELOPE_EXTENT_CONFLICT] to [BOUNDARY_GAPS, ENVELOPE]. The schema doc should say so.
- The crop is stored as a rectangle plus the SHA-256 of a 1-bit mask, never pixels.

**C8 — P2: "observational" overstates what the records are.**
- `classified`, `final`, `outline`, `reasons` and `upgraded` are the pipeline's own decisions. `outline` weighs a drawn pocket area.
- The records hold no published figure, refusal, failure code or run outcome.
- Which reading reaches the digest is chosen by the resolver, which can score readings against the published footprint.
- In this set all 9 sheets are first readings: none of the 313 records has a SHUT_GARAGE_MOUTH or callout reason, A00/A04/A05 are INCONCLUSIVE and A06/D00 are KEPT. The population is therefore free of the published figure.
- Fix: reword the header, and record the reading's provenance in 12b.

**C9 — P2: the layout.ts decomposition cache key omits the rule mode.** It carries `|mouths-shut` but not ON. This is safe today because every `sheetCache` lives for one run, but a shared cache would serve OFF records to an ON caller. Add `|drawn-gap-on`.

## Mutations (read, not run)

The suites and the files under mutation are unchanged since c244ff7, so the results hold at HEAD.

| # | caught by the named gate? | detail |
| --- | --- | --- |
| M1 | yes | 2 of 23 tests fail: the blank-door safety fixture and the record test |
| M2 | yes | the phantom fixture fails; the frozen-literal guard also fails, incidentally, on the `2` in `length === 2` |
| M3 | by name only | the patch is inert, since no caller passes the new parameters; it dies only because they are spelled `publishedFootprintM2`. A renamed variant threaded through a neutral option survives (C3, C5) |
| M4 | yes | killed by the frozen literals, but `.41` / `.01` spellings survive |
| M5 | yes | the order-invariance unit test fails |
