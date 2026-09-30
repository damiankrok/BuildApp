# Council C — Geometry / Constraint Solver Architect (005A post-review)

`PR` = `packages/reconstruction/src/plan-resolution.ts`; `test` = `packages/reconstruction/test/plan-resolution.test.ts`.

## 1. Strongest improvement

Extent and scale are now drawing-generated hypotheses, not single winners. `wallClusterExtent` (`plan-decomposition.ts:1781`) offers the wall-ink box beside the chain box. `latticeScales` (PR:174-200) proposes a scale only from long, uncorrected first readings that outweigh the registration's own support: corrected values cannot vote (PR:160), and one misread span against longer read ones proposes nothing (test:271-274) **[C]**. On e-OZE, `PLAN_NO_WALLED_ENVELOPE` on every copy became one building from either 853 copy: b50b6e59 (116.7 m², −4.4 %) in 5 of 9 subsets and 8376226b (116.9 m²) in 2 more. Matrix 16/36 → 28/36; the three accepted hashes are unchanged **[M]** `resolver/plan-copy-matrix.md`. Re-read spans are `DERIVED` (`layout.ts:1081-1083`), and every resolved layout is DEGRADING with a `SCALE_DISAGREEMENT` conflict (PR:646-669) **[C]**.

## 2. Largest remaining genericity risk

**The corroborations do not corroborate.** Acceptance is effectively "within ±20 % of the published figure P", and without P it is "two labels that are nearly always present" **[C]** PR:313-333:
- `WALL_COVERAGE` is measured in pixels, so it is blind to scale. It counts a band by its midpoint inside a body grown by one wall and never penalises over-inclusion. Without a cluster it falls back to the reading's own extent (PR:316).
- `ISOTROPY` checks a REGISTRATION reading's axes each against its *own* registered scale (PR:490). It tests neither isotropy nor the scale.
- `CROSS_COPY` measures the other copies at *their* registration (PR:466-470). Twin sheets share the misread (e-OZE 853D/853A register at 0.025016/0.025014 m/px), so it can endorse the pooled scale, never the lattice that doubts it.

Measured **[M]** (`resolver/*/analysis-trace.json`):
- Every listed WRONG reading carries `WALL_COVERAGE`, including Kosaćce at 246.6 m² (+49.9 %).
- e-OZE's 12.0 m² reading (−90.2 %) carries `WALL_COVERAGE+ISOTROPY`: what `acceptable()` asks of an UNKNOWN reading (PR:403-404).
- The two Kosaćce readings nearest the truth carry none.
- G2E only-550D/without-853D was accepted on NEAR + `WALL_COVERAGE`: 3 bodies, 156.3 m² (−17.6 %), against the house's accepted 2-body model (8b57681a vs 8fa4a25b). The other four outlines were WRONG: no rival, so the last reading standing won.

Without P, step 4 of the ranking also favours the registration **[I]**. Corrected values count as agreeing with it (PR:252-260), while the lattice pays for every READ span it refutes.

The incumbent is exempt from all of this. "Never second-guessed" means that without P it needs zero corroboration and is sealed ACCEPTED, not PARTIAL **[M]**:
- `wide-door-wing|none` completes 27.7 % small with gate `STRUCTURAL_LAYOUT_ACCEPTED` (`shape-families/matrix.json`).
- Seven transform rows are silently different. Ashby at 0.5× reads 96.0 m² against 48.4 m² (`image-transforms/after.jsonl`).

By construction the resolver cannot see these (`v2/reconstruct-v2.ts:228`).

**Gates: none.**
- `acceptable()` is tested only on hand-set corroboration lists (test:325-334), never on how those lists are computed.
- The shape families' "CORRECT" is body count plus area within 6 % (`shape-families.test.ts:45`), which is the resolver's own AGREES band.
- The matrix counts G2E at −17.6 % as "OK".

## 3. Possible hidden overfit

- **The known-set CI job pins the resolved hashes** (`buildapp-ci.yml:821-823`). e4c7306f (Kosaćce, area copy alone) has its north wing at 157.5–520.5 px against 157.5–434 px in the accepted reading. At 2.4057 cm/px that is about 2.1 m longer: it takes in what the accepted reading leaves as recess or outside **[M]** (both `digest.json`). It was accepted on AGREES (+4.0 %) with **no** corroboration. The gate freezes a development answer; a fix reproducing the accepted ~163 m² would fail it. My pre-audit falsifier (a), withholding a copy moves the outline by more than 3 %, still fires: +4.9 % here, and G2E even changes its body count. *Detect:* gate on `sameBuilding` against the accepted reading, not on a hash.
- **"Every outside side carries some wall"** (`plan-decomposition.ts:1881`) is a sub-heuristic the decision never listed. It matches the synthetic fixture's kerb-only terrace exactly (test:36-44). *Detect:* switch it off and replay the matrix and families; if only the fixture moves, it was fitted.
- **Bucket edges.** e-OZE at the registered scale lands at +20.4 %, 0.4 pp inside WRONG. The `mouths` and walled-first choices are decided by P alone in every test (test:184-202).
- **Checked and clean.** 0.3·wallPx, 8·wallPx, 15 %, ±3 %, 5 % and 0.8 were all in my pre-audit (§2.2, §2.5) before any code existed. New and unlisted: `sameBuilding`'s +0.05 m slack (PR:366).

## 4. One next research item

**Metamorphic replay on P.** Replay the sealed 36-cell matrix and the 20 family rows with P absent and at ×0.85, 0.90, 0.95, 1, 1.05, 1.10 and 1.15.
- Record the accepted outline per cell, and the incumbent's stage-1 score (trace-only).
- Pass: across AGREES ∪ NEAR the accepted reading stays `sameBuilding` whatever P is, and with P absent nothing grossly wrong resolves.

Why it comes first:
- It measures the one assumption the acceptance rule rests on: that something other than P does the selecting.
- Seconds per cell; no hash changes.
- It must precede the blind holdout, which is scored with P present and would reward a resolver that tracks P.

**Verdict on the implementation decision.** Largely yes: bounded counts, incumbent-first byte identity, lexicographic buckets, named ties, `DERIVED` re-reads, and DEGRADING seals (stricter than NOTED).
Departures: EXACT_READING is not a corroboration (PR:63); ISOTROPY is not an isotropy test for registration readings; `STRUCTURE_SILHOUETTE_DISAGREES` was never made a score; and deduplication by exact outline key spent all three e-OZE compositions on what is one building **[I]** (116.7/122.1/122.5 m²).
