# Pre-implementation review — skeptical verifier (truth independence and safety)

Independent read-only reviewer (subagent), run on the audit and the N1 proposal **before** any candidate ran.
Recommendation: **ADOPT_IF_PREREGISTERED_TESTS_PASS**, else NO_SAFE_ADOPTION (SHADOW_ONLY only when just the blind
is missing). Findings and their disposition in `research/analyzer-005r-router/preregistration.md`:

| # | sev | finding | disposition |
| --- | --- | --- | --- |
| S-1 | P1 | "TECHNICALLY_INDEPENDENT" is honest only for the subset claim (N1 = R0 on orthographic frames, ∅ on perspective frames), never for scene claims; any interior count is PUBLISHER_STRUCTURE (B-1 shows it is wrong for 15 exterior views); the brief's label requirement is avoided only if bit-identity is measured on every row | prereg §4 (P1 on all rows), "reported, not vetoing" label rule |
| S-2 | P1 | falsifier §10 row 3 (PERSPECTIVE_RENDER with a non-PERSPECTIVE projection) is vacuous since no adapter claims projection; the real risk is an orthographic photo-real elevation filed as "widok"/"wizualizacja" | prereg P9 `ELEVATION_MISLABELLED_RISK` |
| S-3 | P1 | `analyze.ts:219-221` would add a false "the extractors found nothing" MISSING to every gated frame | patch suppresses it for refused frames; P4 checks it |
| S-4 | P1 | "only these fields change" under-specified: the unresolved list, the ledger diff and summary rows must be enumerated | prereg P4, P5, P6, P8 |
| S-5 | P1 | `--order reverse` does not perturb intra-package order (the analyzer sorts by id) | `--shuffle` in `run-case.ts`; P7 |
| S-6 | P1 | vision still requests FACADE_DECOMPOSITION on perspective renders; FB-3 ledger wording persists | disclosed (prereg §6.7); vision is off in every product path and remote vision cannot be measured without sending pixels |
| S-7 | P1 | cache/version: a cache keyed on an unbumped version would replay old graphs | checked: no production cache keys on analyzer versions (display only: `run.ts:48,552`, `program.ts:308`, Android `AnalyzerScreen.kt:708`) |
| S-8 | P2 | user-visible losses beyond the model (web Sources panel, counts.observations, ledger USED_AS_CORROBORATION rows) | disclosed in the report as invalid-evidence losses |
| S-9 | P1 | the blind is a falsifier of H1, not evidence of benefit; preregister predicates (i)–(viii) incl. coverage | prereg §7 |
| S-10 | P2 | banned wording ("fixes INTERIOR→ELEVATION", "improves 3D", interior accuracy figures) | prereg §6.6 |
| S-11 | P2 | N1 is not shadow; SHADOW_ONLY only if adoption is unsafe | prereg §6 |
