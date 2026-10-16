# N1-ADOPT lean review — dispositions (one round)

Reviewers (read-only, concurrent, started during the last Tier C leg — disclosed in `audit.md` INC-3):
**R-A** source/semantics + provenance, **R-B** adversarial gates/harness + vision path. **No P0 from either.**

| id | sev | finding (short) | disposition |
| --- | --- | --- | --- |
| R-B 1 | **P1** | blind runner did not enforce run-once, did not pin harness hashes, ignored non-zero exits; `blind.mjs` absent from §0 | **FIXED (harness only, before PRE_HOLDOUT_13_SHA):** `blind.mjs` refuses an existing house directory, asserts sha256 of `compare_n1.py`, `p8_n1.py`, `run-case.ts`, `ledger.ts`, `variant.mjs` against pins, stops fail-closed on any non-zero step. Addendum C records `blind.mjs`'s own hash. No predicate touched. |
| R-B 2 | P2 | `select.mjs` would accept a second round-13 draw (seed grinding) | **FIXED:** from round 13 on, a label already in `LEDGER.ndjson` is refused. |
| R-B 3 | P2 | apply-guard mutant "projection-only" survived (no test applies to an ELEVATION sealed PERSPECTIVE) | **FIXED (test-only):** `vision.test.ts` asserts the apply boundary lands an answer on an ELEVATION sealed `PERSPECTIVE` (`not.toThrow`, 2 observations); new mutant **M9** killed behaviourally (9/9). Production source bytes unchanged (verified identical to the DEV variant). |
| R-B 4 / R-A F5 | P3 | apply guard throws a plain `Error` (would abort a run) | Kept: unreachable through `analyze.ts`; same fail-loud convention as the existing byte-hash guard. Disclosed. |
| R-B 5 | P3 | P8's "perspective" (`projection === PERSPECTIVE`) ≠ P4′'s definition | Disclosed; identical on DEV (403/403 refused frames are `PERSPECTIVE_RENDER`/`PERSPECTIVE`); P4′ would catch the divergent case. |
| R-B 6 | P3 | T3 accepts any non-pre-gate gap of a refused asset | As preregistered; DEV recount: only 1 887 recess-side-wall `MISSING` + 403 vision-facade gaps. Disclosed. |
| R-B 7 | P3 | comparator self-test covers 5 graph mutants; T5/T6 and ortho-render branch unexercised on DEV | Disclosed (0 orthographic renders on DEV; synthetic tests cover the branch). |
| R-B 8 | P3 | `ledger-prior` not in the sealed digest | Disclosed; files are hard links of the 005R-ROUTER dumps (identical inode content), and `R0ctl` + model hashes in P8 agree. |
| R-B 9 | P3 | `REPLAYED_GRAPH` mode reuses an old graph with perspective claims | Disclosed: dev scripts only (`--graph`), not API/Android. |
| R-A F1 | P2 | same version labels (`ANALYSIS_SERVICE_VERSION 1.1.0`, `cv.*`) now give a different graph/hashes on pages with renders | **Disclosed, not changed**: a version bump would change shipped strings the DEV/blind gates did not measure; no cache or acceptance keys on these labels. Recommended as a follow-up decision. |
| R-A F2 | P2 | `apps/web/src/sample-observations.json` holds a perspective frame with 49 facade observations — stale vs the analyzer; regenerating would break an e2e that clicks its last frame | **Disclosed, not changed** (UI/sample frozen in this stage). |
| R-A F3, F4, F6, F8, F9 | P3 | dev benchmark script counts render LVCs; live `vision.attempted` drops by perspective assets; `FACADE_DECOMPOSITION.documents` still lists `PERSPECTIVE_RENDER` and `tasksForDocument` is now unused in production; `fusion.ts` perspective depth authority; refused asset in both `skipped` and `assets` | Disclosed. |
| R-A F7 | P3 (+) | second false-provenance site `reconstruct-v2.ts:1418` (perspective RIDGE/ROOF_EDGE `USED_AS_CORROBORATION` when no camera/roof) also removed | Added to the audit; included in P8's measured removals. |

Verdicts: R-A "no P0/P1; adoptable with F1/F2 disclosed". R-B "no P0; DEV gates and V hold; fix #1 before PRE_HOLDOUT_13_SHA; await P7′ N1vshuf" — P7′ N1v = N1vshuf 37/37 is now in.
No fix changed code that a sealed predicate measured (production `src` byte-identical to the DEV variant).
