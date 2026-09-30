# Blind ARCHON holdout (BUILDPLAN-ANALYZER-005A)

This is Council G's protocol (`stage-reports/artifacts/analyzer-005a/council/pre/08-test-leakage-audit.md` §6).
The post-implementation Council amended it before any draw; each amendment is marked **(post)**.
`select.mjs` is the only code involved: it enumerates, then draws.

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
   - **Excluded families (post).** `excluded-families.txt` lists the 25 families the development pages link
     to ("similar projects"). Their names and thumbnails were on pages read during development, so they
     cannot count as unseen. The list covers 320 pool addresses, and the draw is made from the remaining 2765.
     - **Source.** Taken from the development pages' cached HTML, addresses only; no candidate page was opened.
     - **Hash.** `EXCLUDED_FAMILIES_SHA256 = c186e89fdf26585fcd95400f5ae021c5769db6c1809b5c750d768a5ca3f3c8b4`.
2. **Code freeze (T1).**
   - Every 005A change is committed, the local gates are green, and HEAD is **pushed** to the remote branch
     before the draw. That push is the public timestamp of the frozen code.
   - `PRE_HOLDOUT_SHA = git rev-parse HEAD` of that pushed commit. **(post)** Nothing is committed between T1
     and T2: the draw records the SHA in the ledger itself, and the stage report quotes it from there. Writing
     it into a tracked file first would move HEAD away from it.
3. **Draw (T2).**
   - `seed = SHA256(PRE_HOLDOUT_SHA + "BUILDPLAN-005A-BLIND-HOLDOUT")`, drawn from the pool less the excluded
     families, in pool order. The first pick is `i1 = seed mod n`.
   - **(post)** The second pick is `i2 = SHA256(seed + ":second") mod m`, over the `m` addresses of every
     other family. It used to be "the next index of another family", which could only ever land on the
     first address of a family.
   - `node holdout/select.mjs select --pool holdout/pool.txt --pool-sha256 <POOL_SHA256> --pre-holdout-sha <sha>`
     refuses unless:
     - `HEAD == PRE_HOLDOUT_SHA` and the tree is clean;
     - the pool is the tracked `holdout/pool.txt`;
     - its hash equals both the operator's argument and `pool.meta.json`.

     **(post)** There is no flag that skips these checks.
   - The draw is appended to `LEDGER.ndjson` with the SHA, the pool hash and the exclusion hash. A draw is
     burned once written. The ledger is committed with the run evidence (T3), never before.
4. **Run once (T3)** with the frozen code, on the desktop, live, with the cache and output outside the repository.
   It is production `runAnalysis`, and the evidence is sealed as text facts. No drawing is committed, and no
   overlay or render of one.
   - Run: `npm run -s analysis:second-house -- --url <url> --cache <dir> --out <dir>`.
   - Verdict: `node holdout/verdict.mjs <out dir>`.
5. **Verdict (T4)**, by predicates fixed before the draw, per project and never averaged.
   - **PASS:** every condition below holds.
     - The run completed.
     - The model's storey count equals the number of distinct storeys among the package's floor plans (the
       `UNKNOWN` storey not counted).
     - No opening the drawings print was left unbuilt: no `OPENINGS_NOT_BUILT` warning. **(post)**
     - When a footprint is published, the built lowest-storey footprint is within 6 % of it.
     - **(post)** When the plan was resolved by hypothesis (`LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS`), the chosen
       reading carries at least one corroboration that is not the published figure (`chosenCorroborations`
       not empty). Otherwise the 6 % check is met by construction, since the figure chose the reading, and it
       proves nothing.
   - **SOURCE_LIMITED_PARTIAL:** the run stopped with a typed reason, **and** one item of this checklist is
     confirmed on the raw copies (measured, not assumed):
     - the package has no floor plan;
     - no ground-floor copy prints an overall dimension with glyphs 10 px tall or more (legibility);
     - every ground-floor copy draws its walls under 4 px thick;
     - a floor-plan asset is lost in `pkg.failures`.

     `PLAN_RESOLUTION_INCONCLUSIVE` is **algorithmic** unless one of those holds. The analyzer weighed
     readings of an adequate drawing and could not decide between them.
   - **ALGORITHMIC_FAIL:** everything else, including a completed model that misses a PASS condition.
   - **Not assessed (post).** The body count has no reference independent of the analyzer, so a body mismatch
     is not a verdict condition. The body count is reported beside the verdict.
   - **As code (post).** `verdict.mjs` computes all of the above from the run's own files.
     - The footprint is the model's lowest-level slabs.
     - The storeys are the model's levels against the package's labelled floor-plan storeys.
     - Legibility is nominated from the OCR's tokens, and needs a raw measurement before it can count.
   - **Calibrated on the development set, before any draw.** The final-code runs give 2 PASS of 5:
     - PASS: Marcówki and Kosaćce.
     - G2E fails on one opening not built.
     - e-OZE fails because it was resolved on the figure alone, with no witness.
     - The alternate Marcówki page fails.

     The predicates are strict enough that the OWNER's own resolved case would not pass them.
6. **Burn (T5).** No patch after T2. A drawn family joins the development set, every draw is reported, and a
   re-draw never replaces a bad draw.

Two draws can falsify generality; they cannot establish it. With a true pass rate of 0.6, both pass 36 % of
the time. The holdout is a smoke alarm and is reported as one.

**Disclosure (post).** While testing the selector, one draw was computed for the dummy SHA `0^40`, which no
commit can have. It named the families `dom-w-nawlociach` and `dom-w-renetach`. If the real draw lands on
either family, that is reported with the verdict. The families were not excluded afterwards: excluding
families after seeing a draw would itself be a selection.

## Round 2 (BUILDPLAN-ANALYZER-005B)

The same protocol, steps 1–6, with these differences only. Everything here is fixed before the freeze.

1. **Pool.** The committed round-1 pool (`holdout/pool.txt`, `POOL_SHA256 = 800c2a1e…2ed41`, 3085
   addresses, enumerated 2026-09-30T00:32Z). No project page is opened to build it.
2. **Excluded families** (`excluded-families-round-2.txt`, 38 families, 551 pool addresses; 2534 drawable):
   - every round-1 exclusion (the 25 families the development pages link to);
   - the three development families (`dom-w-kosaccach`, `dom-w-marcowkach`, `dom-w-rarytasach`; already
     outside the pool);
   - the two round-1 draws, now development houses: `dom-w-jablonkach` and `willa-miranda`;
   - every family any development page links to, the two round-1 draws' pages included — taken from those
     pages' cached HTML, addresses only (13 families not in the round-1 list).
   - `EXCLUDED_FAMILIES_ROUND_2_SHA256 = 7b36740a85f41b2c766d306eacfb377c471592f7a945f09345efbe45c798ce13`.
   - **Disclosure.** The round-1 dummy draw named `dom-w-nawlociach` and `dom-w-renetach`; they were never
     opened and stay in the pool, as in round 1.
3. **Freeze.** `PRE_HOLDOUT_2_SHA` is the pushed HEAD whose full CI is green. Nothing is committed between the
   freeze and the draw.
4. **Draw.** `seed = SHA256(PRE_HOLDOUT_2_SHA + "BUILDPLAN-005B-BLIND-HOLDOUT-ROUND-2")`; the picks are made as
   in round 1 (`i1 = seed mod n`; `i2 = SHA256(seed + ":second") mod m` over the other families):
   `node holdout/select.mjs select --round 2 --pool holdout/pool.txt --pool-sha256 800c2a1ed9daee9efd2654c64b061e430094dc38fc459b805af27ff9fad2ed41 --pre-holdout-sha <sha>`.
   The ledger line records the label and the exclusion file.
5. **Run once, verdict, burn** as in round 1, with `holdout/verdict.mjs` unchanged. A typed
   `METRIC_RESOLUTION_INCONCLUSIVE` is algorithmic unless a checklist item is confirmed, exactly like
   `PLAN_RESOLUTION_INCONCLUSIVE`. An `ALGORITHMIC_FAIL` is not patched in 005B: its first bad evidence
   decision is recorded and becomes the next stage's input.
