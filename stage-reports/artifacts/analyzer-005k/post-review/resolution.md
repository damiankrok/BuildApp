# 005K council — resolution

**Who reviewed.** Four independent reviewers, run as blind sub-agents of this session's model. Each was read-only on the
repository, briefed by `briefs.md`, and wrote its own file.

| reviewer | focus | verdict | P0 | P1 |
| --- | --- | --- | --- | --- |
| A | boundary topology | CONDITIONAL PASS | 0 | 5 (A1, A3, A4, A5, A6) |
| B | statistics, generalization | CONDITIONAL PASS | 0 | 2 (B1, B2) |
| C | non-circularity, evidence semantics | CONDITIONAL PASS | 0 | 4 (C1, C2, C3, C4) |
| D | Android, tests, CI, release | CHANGES REQUESTED | 1 (D1) | 1 (D2) |

**Every P0 is fixed. Every P1 is fixed or stated.** No finding changes the verdict on the rule: INSUFFICIENT_EVIDENCE,
rule OFF. Commits: `44f7128` (guards, fixtures, harness) and the closing commit (artifacts, report, status).

## P0

| # | finding | resolution |
| --- | --- | --- |
| D1 (= C1) | `research-isolation.test.ts` failed from the seal commit on: the sealed `gap-set-draw-ledger.ndjson` did not match the 005K extension allowlist. No CI had run past `892853e` | **fixed** (`44f7128`): `ndjson` is allowed (a renamed sealed artifact would break its hash trail). The content checks now run on every 005K file again: 11 / 11 pass. The full local suite is green (`npm test`: 2,197 passed, 11 skipped). The closing commit is pushed to `claude/new-session-3kzcgh` so CI runs on the stage head |

## P1

| # | finding | resolution |
| --- | --- | --- |
| A1 | the rule can close recess, porch and loggia mouths up to 3.2 m: no condition reads what lies behind a gap, upgrades pre-empt the pocket rule, the drawn routes re-admit paving edges, treads and single face lines, and the in-wall-band condition never refuses. "Open sides mostly have a POST or NONE jamb" was not measured | **stated**: `recommendation.md` "The known closure path" and "What a successor rule needs"; the unmeasured claim is withdrawn. **Fixed in tests** (`44f7128`): the 2.0 m paving-edge case asserts the closure under ON, so a successor changes it on purpose. The rule stays OFF |
| A3 | the A05 explanation was wrong | **fixed**: `recommendation.md` "A05, corrected". STRICT 105.51 → 122.47 m² against EXCLUSION 104.99 m²; the two-policy check (> 6 %) gives the new code; X-758 is open in STRICT and an unjudged bridge in EXCLUSION; the rule makes STRICT count its upgrades as drawn |
| A4 | zurawkach's model change is not fully explained: a 0.59 × 1.5 m corner (0.89 m²) leaves while the outline gains 1.85 m² | **stated**: gate item 10 is now "not established" (`recommendation.md`, report). It is not a safety item, and the verdict does not change |
| A5 | `outline` fate wrong for weak gaps past the 48-gap budget (12 of 60 sealed records) and for interior STRONG gaps; records lack pocket numbers, jamb geometry, per-stroke flags, the strict fate | **stated**: `gap-evidence-schema.md` "Known limits of boundary evidence 1.2.0". The descriptive counts in `recommendation.md` are recomputed with the budget: 18 pocket mouths, 12 interior, 10 over budget, 4 bridged weak. Not fixed in 005K: a record-schema change after the sealed evaluation would be a protocol change; a successor bumps to 1.3.0 |
| A6 | no fixture has the along-jamb test as its only refusal, and no mutation removes it, though it did 8 of the 9 refusals on the fresh set | **fixed** (`44f7128`): crossing-wall fixture (along-jamb is the only refusal; jamb ink 0.92 / 1.0); mutation **M6** removes the along-jamb test and is KILLED (2 of 25). The outline-level porch fixtures are stated as successor work |
| B1 | safety items 5 and 7 "hold" without power; "not REJECT" rests on one 2-of-3 AI vote (q049); precedence of item 4 vs a safety item is undefined | **fixed in wording**: items 5 and 7 marked "holds — uninformative"; "no safety evidence either way"; the q049 sensitivity named; the precedence gap and an absolute bound (0 / n < 0.10 only from n ≥ 35) recorded for the next protocol |
| B2 | the FIX_STOREY_COUNT frequency claim was misstated: A01 is storeys-first, D00 co-first; D01–D05 excluded by judgment | **fixed**: `recommendation.md` §2 table and `fresh-set-verdicts.json` corrected (storeys first on 3, 4 with D00, against 3 for plan resolution). The recommendation now rests on the sole-blocker argument: A06 and A07 pass every other predicate |
| C2 | gate item 2 cited only family A of the order check; family B moves the grid on 83 / 192 chain-order shuffles (13 / 24 rows) | **stated**: gate row 2 reads "holds, for the source as enumerated"; `gap-evidence-schema.md` "Order"; keys pinned to the fresh runs' chain order (metric evidence 1.8.0, chain solver 1.4.0). `gridLines` is pre-existing and upstream, and fixing it would move OFF hashes: left for a later stage |
| C3 | the "never ON" guard read only lines saying `'ON'` in three files: a resolver hypothesis in `plan-resolution.ts` or a constant indirection would pass | **fixed** (`44f7128`): every production mention of `drawnGapRule` in every package must be one of a fixed set of forms (type, conditional pass-through, OFF default, record copied), in a fixed set of carrier files. Both bypasses were probed and fail the guard |
| C4 | the manifest's `projects[].run` records each project's live outcome, against protocol §4.4's "no outcome"; the labellers' blindness rested on instructions, with read access to the tree | **stated** (report, deviations): project-level, rule-OFF live outcome, needed for attrition; never sent to a reviewer. Reviewer B checked the 7 labelling transcripts: each read only its listed pictures and wrote one file |
| D2 | production work began before the Phase-0 gate was green | **stated** as deviation D2 with the timeline (`ui-evidence-preflight.md`, report) |

## P2 (noted; the action taken, where any)

| # | note | action |
| --- | --- | --- |
| A2 | per-span counting: 1 / 8 false upgrades; the stratum that moves outlines has 1 negative; "A00 (6), D00 (2)" should read 4 and 4 | recorded in `recommendation.md`; corrected |
| B3 | FREEZE_SHA was not named in advance (no sign of grinding: the draw ran 7 s after the push) | stated; the next protocol names the seed commit |
| B4 | the rule's per-gap decision (`check.eligible`) existed in the frozen records before the label seal; no route reached the labellers | stated in the report |
| B5 | A01 is a third attrition kind (boundary read, records not emitted); "random won't get there" overstated | `fresh-set-verdicts.json` and the recommendation reworded (about 42 drawn projects for 30 negatives; open sides are what random draws do not reach) |
| B6 | effective n smaller (two houses, twin spans) | `recommendation.md` "Effective sample size" |
| B7 | `constant-control.json` lacked the not-human note; κ measures consistency of one model, not independence | the note added (`44f7128`, evaluate.mjs output only; results byte-identical); the κ caveat in the report |
| C5 | literal and vocabulary guards bypassable (leading-dot, hex, single-quoted keys); M3 dies by name, M4 by spelling; a 1.65 m cap would remove the one false upgrade unseen | `mutation-results.md` "Reading, with council C's caveats" |
| C6 | `12b-gap-evidence.json` covers the selected storey only (A04's attic: 8 records, 4 sealed) | schema doc limits |
| C7 | keys unique (313 / 313, 60 / 60); `decompositionId` excludes mode, callouts, raster bytes; `BOUNDARY_GAPS` shifts the timeline | schema doc limits |
| C8 | "observational" means read-only, not decision-free; the resolver picks which reading is recorded | schema doc limits |
| C9 | the layout's decomposition cache key omits the rule mode (safe per run) | schema doc limits |
| D3 | the Phase-0 fix narrows but does not close the window (`performClick` still goes through `fetchOneOrThrow`) | stated in the report |
| D4 | `ProductFlowDeviceTest` kept bare clicks and the first-scrolling-node helper | the four bare clicks now wait for exactly one node (`44f7128`). The helper is kept: after a deep scroll, the stage-row matcher can legitimately find no row |
| D5 | two green UI-gate runs are weak evidence (p ≈ 0.64 under the old failure rate) | stated; the closing run is a third sample |
| D6 | order invariance and the ON matrix are research artifacts, not CI | stated |
| D7 | 005K block lacked the Android-packaging check | added (`44f7128`) |
| D8 | perf method weaknesses (fixed pass order, `|| true`, per-row noise up to 7.3 %); pack size is an estimate (a lower bound) | stated in the report and `performance.json` reading |
| D9 | no OWNER APK is correct; the next OWNER APK will carry boundary evidence 1.2.0 / Evidence Pack 1.2.0 | stated |
