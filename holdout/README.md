# Blind ARCHON holdout (BUILDPLAN-ANALYZER-005A)

This is Council G's protocol (`stage-reports/artifacts/analyzer-005a/council/pre/08-test-leakage-audit.md` §6),
adopted as it stands. `select.mjs` is the only code involved: it enumerates, then draws.

1. **Pool (T0).** Done 2026-09-30T00:32Z, before the code freeze.
   - **Source.** The publisher's own `sitemap.xml`; `robots.txt` permits `/projekty-domow/`. No project page
     was opened.
   - **Kept.** Canonical project addresses (`/projekty-domow/projekt-<slug>-m<13 hex>`).
   - **Dropped.** Slugs that name no house (`garaz|wiata|g\d+-|budynek|altana|domek-gospodarczy`), and every
     **development family** derived from the sealed packages in `stage-reports/`: `dom-w-kosaccach`,
     `dom-w-marcowkach` and `dom-w-rarytasach`. A family is the first three slug tokens when the second is a
     preposition, else the first two, so it over-merges, which is the safe direction.
   - **Order.** Sorted by UTF-16 code unit.
   - **Result.** 3951 sitemap addresses, 3258 project addresses, **3085 in the pool** (773 families).
   - **Hashes.** `POOL_SHA256 = 800c2a1ed9daee9efd2654c64b061e430094dc38fc459b805af27ff9fad2ed41`. The fetch
     time and the sitemap and robots hashes are in `pool.meta.json`.
2. **Code freeze (T1).**
   - Every 005A change is committed and pushed, and the local gates are green.
   - `PRE_HOLDOUT_SHA = git rev-parse HEAD` is written into the stage report before the draw.
3. **Draw (T2).**
   - `seed = SHA256(PRE_HOLDOUT_SHA + "BUILDPLAN-005A-BLIND-HOLDOUT")`. The first pick is `i1 = seed mod n`;
     the second, `i2`, is the next index (cyclic) whose family differs.
   - `node holdout/select.mjs select --pool holdout/pool.txt --pool-sha256 <POOL_SHA256> --pre-holdout-sha <sha>`
     refuses unless `HEAD == PRE_HOLDOUT_SHA`, the tree is clean and the pool hash matches.
   - It appends the draw to `LEDGER.ndjson`. A draw is burned once written.
4. **Run once (T3)** with the frozen code, on the desktop: production `runAnalysis`, evidence sealed as text
   facts. No drawing is committed.
5. **Verdict (T4)**, by predicates fixed before the draw:
   - **PASS:** the run completed; the footprint is within 6 % of the published figure when one is published;
     storeys equal the plan's storeys; no emission failure.
   - **SOURCE_LIMITED_PARTIAL:** a typed source reason, **and** the raw copies confirm the evidence is
     insufficient. The checklist: no floor plan, no legible overall dimension, walls under 4 px, or a plan
     asset lost in `pkg.failures`.
   - **ALGORITHMIC_FAIL:** everything else, including a completed but wrong model: footprint more than 20 %
     off, or a storey or mass mismatch.
6. **Burn (T5).** No patch after T2. A drawn family joins the development set, every draw is reported, and a
   re-draw never replaces a bad draw.

Two draws can falsify generality; they cannot establish it. With a true pass rate of 0.6, both pass 36 % of
the time. The holdout is a smoke alarm and is reported as one.
