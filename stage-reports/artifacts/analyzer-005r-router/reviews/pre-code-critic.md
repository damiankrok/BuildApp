# Pre-implementation review — code critic

Independent read-only reviewer (subagent) on the audit and the N1 proposal, before any candidate ran. Verdict: FB-2
survives once narrowed to the first unsafe *deterministic* assertion; §4's conclusion (no consumer turns perspective-
frame observations into the model, the mobile scene, quality levels or warnings) survives; the falsifiers as first
written would have fired on every row because several hashes embed the graph identity. Dispositions: addendum A.

| # | sev | finding | disposition |
| --- | --- | --- | --- |
| C-1 | P1 | metric evidence, structural layout, feature graph and hypothesis set embed the graph id/hash (`extract.ts:857-858`, `structural.ts:163-164`, `v2/graph.ts:229`, `reconstruct-v2.ts:1357-1358`); the model is built from `program` only (`candidate.ts:204`) and the scene from the model only (`mobile-scene/src/bundle.ts:313-335`) | A-1: content comparison after blanking identity fields |
| C-2 | P1 | vision routing is also by document (`analyze.ts:178`, `tasks.ts:38`); live vision would re-open the channel and FB-3 | A-2: N1 closes the deterministic channel only; disclosed |
| C-3 | P2 | the MISSING exclusion never fires in production (null reasoner sets `visionAttempted`) | A-3: disclosed; N1 is additive in `graph.unresolved` |
| C-4 | P2 | the extractor list can shrink on a renders-only package | A-4 / P4 |
| C-5 | P2 | no version moves; a replayed R0 graph is indistinguishable | A-4: PROPOSE_NEXT routing version |
| C-6 | P2 | Android shows hash prefixes and observation count | A-4: disclosed |
| C-7 | P1 | `mutations-02.test.ts:112` goes red (old behaviour, not a requirement); no "005R" in production code | A-5 |
| C-8 | P2 | a mislabelled orthographic image (generic `widok`, OG_IMAGE fallback, ARCHON `widok`) already has PERSPECTIVE projection, so every consumer already drops it; the loss is latent | A-5; P9 measures it |
| C-9 | P2 | stale citations (`acquire.ts:255`, `Sources.tsx:234`, `frame.ts:313-350`) | A-6: corrected in the audit |
