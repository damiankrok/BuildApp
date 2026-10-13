# BUILDPLAN-ANALYZER-005P — hypothesis workshop (written after the Phase A audit, before any challenger ran)

Every hypothesis below acts — if at all — on ONE seam: how plan resolution (`packages/reconstruction/src/plan-resolution.ts`)
reads a dimension statement "as printed". OCR, the ensemble, binding, chains, the metric solution, registration,
topology, emission and every published-figure rule are out of scope for a production change in 005P (brief §2 A4).

## 0. What the audit established (inputs to the workshop, not challenger results)

1. `statementsOn` (`plan-resolution.ts:187`) turns a chain segment's `READ` / `CHAIN_CORRECTED` evidence into a
   statement whose "printed" value is the **classic template token's text** (`firstReadCm`, `:200`) or the evidence
   value (`READ`). Nothing in `packages/reconstruction/src` reads `numericLattices`, `ensemble` or `external`, although
   the metric evidence carries them (schema 1.6.0, `source-metrics/src/schema.ts:1032-1065`) and the metric solution on
   the dimension-observation path already uses the ensemble.
2. That one value reaches **seven** consumers, not five (005O counted five):

   | # | consumer | call site (5906afa) | list read | decision it feeds |
   | --- | --- | --- | --- | --- |
   | C1 | T1 AS_READ_REFUTATION, registration side | `:840` `refutedShareAsRead` | `asRead` | accuse the registration |
   | C1' | T1, the offered rival scales | `:842` (+ `:841` `latticeScales` for pre-1.2 evidence) | `asRead`, `zeroSubstitution` | the margin an accusation needs |
   | C3 | T3 OUTER_TOTALS, seeds / accusers and the registration's defence | `:868-883` | `asRead` | accuse the registration |
   | C2 | ranking: `metricsAtScale.refutedShare` (`:345`), `refutedShareAtRegistration` (`:350`) | `asRead` | `compareReadings` / `evidenceTuple` / `drawingTuple`, challenge `drawingChoice`, REFUSED vs KEPT |
   | C4 | `latticeScales` (`:253`, only for evidence without a metric solution) | `zeroSubstitution` | which scales are tried |
   | C5 | isotropy both-axes support (`:590`, `:997`) | `zeroSubstitution` | the ISOTROPY corroboration → acceptance |
   | C6 | `metricsAtScale` re-read options (`:330`) | `firstReadCm`, then the reader's `alternatives` | the layout's values at another scale |
   | C7 | T2 PARTIAL_BINDING (`:851-864`) | `evidence.rawText` (READ only) | accuse the registration |

   C6 and C7 are not "as-printed view" consumers in the 005O sense and stay frozen in every variant below; they are
   listed so that no variant can claim to scope a reading it does not reach.
3. A "contest" in 005O's M1 is `|K| ≥ 2` for K = {TOKEN, LATTICE (CLEAR/SUPPORTED), EXTERNAL (corroborating)}. On the 44
   development cases 284 statements are contested (reproduced exactly from 005O's M1 view: 0 mismatching cases).
4. **TOKEN and LATTICE are correlated readers** (the lattice uses the classic template bitmaps); EXTERNAL (PP-OCRv6) is
   a different model of the same crop. Agreement of any of them is agreement of estimators of ONE raster, never two
   witnesses.
5. **A contest is not always a disagreement about the scale.** On the known-good `rarytasy-eoze`, the correct
   OUTER_TOTALS accusation (1601/720 px and 760/342 px → 2.222222 cm/px, the transcription scale) rests on a statement
   whose readers say 1601 (TOKEN) vs 1600 (LATTICE, EXTERNAL): contested by M1's definition, metrically identical (both
   inside the 3 % agreement band). M1 drops it, the accusation's T3 support falls to one statement, and the conflict
   re-surfaces through T1 only because dropping contested statements shrank the denominator of the registration's
   refuted share (0.371 → 0.820, 005O §F). That is a mechanism, not noise: **dropping a statement can raise another
   scale's refuted share.**
6. On `dom-w-glogownikach` the contest IS about the scale: 501/541 and 810/870 (TOKEN vs EXTERNAL) imply 2.432 vs 2.626
   cm/px over the same spans.

## 1. Hypotheses

### H0 — no change (conservative abstain)

- **Bug it removes:** none. **Mechanism:** keep plan resolution's view; record the contest only as a diagnostic.
- **Why it might be right:** the 18 known-good rows and every negative control are untouched by construction.
- **Cost:** none. **Semantic risk:** none new; the illegitimate Głogowniki conflict stays.
- **Falsifier:** any admissible variant below that removes an illegitimate accusation with zero gate violations.

### H1 — M1 scoped (P1, P2, P3)

- **Bug:** an accusation or ranking built on one reader's contested misread (Głogowniki 501/810).
- **Mechanism:** a contested statement states nothing (`DROP`). P1: only the conflict consumers (C1, C1', C3).
  P2: those plus the ranking (C2), i.e. every refutation measurement. P3: every view consumer (C1–C5), 005O's M1.
- **Functions touched:** `zeroSubstitution` / `asRead` / `refutedShareAsRead` / `latticeScales` / `sourceConflictOf` via a
  consumer argument.
- **Why it might fail:** (i) dropping changes denominators, so a scale's refuted share can RISE (fact 5) — a new
  accusation (T1) or a different ranking (P2/P3: 005O's jarzabem copy switch); (ii) a metrically irrelevant contest
  (fact 5) removes a correct accuser.
- **Falsifying experiment:** the 44-case replay; P1's `rarytasy-eoze` trigger path and P2/P3's `dom-pod-jarzabem` copy.
- **Data:** sealed evidence only. **CPU/memory:** a set lookup per statement (image-free). **Fits 005P:** yes.

### H2 — N1, accusation-monotone conflict policy (independently designed)

- **Bug:** contested readings that disagree about the scale create or carry an accusation against the registration.
- **Mechanism (one rule, three places, conflict only):** a contested statement is read as the SET of its confident
  readings, never as one of them, and doubt never helps the accuser:
  - it refutes the **registration** only if NO confident reading fits it (T1 registration side: `KSET_ANY`);
  - it refutes an **offered rival** unless EVERY confident reading fits the rival (T1 rival side: `KSET_ALL`);
  - it joins an **OUTER_TOTALS accusation** only if EVERY confident reading fits the accused scale (`KSET_ALL`), the
    accusation's seeds stay the incumbent's own readings, and it **defends** the registration if ANY confident reading
    fits it (`KSET_ANY`);
  - ranking, lattice scales, isotropy, re-read options and PARTIAL_BINDING are frozen.
- **Provable property (verified by test, not only argued):** with the same evidence, every source-conflict trigger N1
  raises, the incumbent raises too (N1's accusations ⊆ P0's). Proof sketch: for an uncontested statement every mode is
  the frozen list; for a contested one the frozen value is a member of its K-set, so "every reading fits" ⇒ "the frozen
  reading fits" (accusers and rivals shrink) and "no reading fits" ⇒ "the frozen reading does not fit" (the
  registration's refutation shrinks, its defence grows), and the seeds and the offered rivals are the incumbent's.
  The denominators are unchanged, so no refuted share can rise. **N1 can withdraw an accusation; it cannot make one.**
- **Why it is not M1 renamed:** M1 removes evidence (changes denominators, changes ranking, drops metrically irrelevant
  contests); N1 removes only the *benefit of the doubt to the accuser*, keeps every statement in every denominator,
  and a contest between readings that fit the same scale (1600/1601) changes nothing.
- **Why it is not a promotion:** EXTERNAL's value never states a scale, seeds no accusation, adds no support, no
  corroboration and no re-read option. It can only prevent a statement from accusing. With every external reading
  removed, a statement whose only confident reader is the token is uncontested and read exactly as frozen.
- **Why it might fail:** (i) it leaves the ranking's own refuted shares frozen, so a house that loses its conflict goes
  down the incumbent's no-conflict path — which may itself be wrong (it is the 005D path); (ii) a correct accusation
  carried by a statement whose readers genuinely disagree about the scale is withdrawn (a house with a wrong
  registration then keeps it — a false-confident scale); (iii) T1 rivals can become *harder* to beat than in P0 only
  for contested statements, never easier.
- **Falsifying experiment:** the 44-case replay: any trigger N1 raises that P0 did not (the property), any known-good
  path or model change, any new completion at a wrong scale; the unit property test over generated cases.
- **Data:** sealed evidence (lattices, ensemble decisions). **CPU/memory:** as M1. **Fits 005P:** yes (one seam).

### H3 — orientation safeguard by the reader's posterior (M4, 005O addendum A)

- **Bug:** murajach's v49 orientation decided by the UNDECIDED legacy fallback against a 740 read at p 0.99991.
- **Mechanism:** corroborating readings in exactly one quarter-turn decide the orientation.
- **Functions:** `source-metrics` orientation / chain binding — **upstream of plan resolution**.
- **Fits 005P:** **no** — it changes source-metrics' binding and the metric solution, outside the authorised seam.
  Recorded as a bounded next-stage candidate, not run.

### H4 — provenance-corrected scale votes (dependency-aware witness grouping)

- **Bug:** a scale "supported" by several statements read by one reader family.
- **Mechanism:** count support per independent source group, not per statement.
- **Fits 005P:** **no** as a production change: the metric solution already groups witnesses (`independentGroups`),
  and plan resolution's own T3 already requires two chains on two axes. On the 44 rows no failure is traced to a
  double-counted witness in plan resolution (the first-bad ledger finds none). Not run; a diagnostic only.

### H5 — diagnostic-only contest ledger (D1)

- **Mechanism:** record, in the challenge record, which conflict evidence ids are contested and their K-sets, without
  influencing any decision. **Fits 005P:** yes. It is a component of whichever variant is adopted (Phase C item 3);
  alone, it is the fallback if no interpretation change is admissible.

## 2. Two decompositions compared

| | single resolver, one view (005O M1, P3) | evidence view + consumer policies (P1, P2, N1) |
| --- | --- | --- |
| what changes | what a statement "is" for every consumer | how each decision is allowed to USE a contested statement |
| failure mode | a fix for an accusation silently re-ranks copies (jarzabem) and re-routes known-good conflicts (eoze) | a consumer left out of the policy keeps the old behaviour — explicit, testable |
| proof obligations | none possible: ratio effects go both ways | per consumer: monotone (N1) or explicitly frozen |
| code shape | one function changed, five consumers move | one pure contest classifier + one argument per consumer call |

**Chosen boundary:** evidence view (a pure, typed contest record per statement, computed once from the metric evidence)
+ explicit consumer policy at each call site. It is the smallest shape in which "the conflict test changed" cannot mean
"the ranking changed too" without the code saying so.

## 3. What the workshop does NOT claim

- No variant can repair murajach (upstream orientation / binding, H3), akebiach (EXTENT, missing piers), gozdzikowcach
  (MODEL_EMISSION, chimney) or Głogowniki's −8.04 % footprint (a separate EXTENT/topology decision downstream of the
  scale). Each is in the first-bad ledger with its own root.
- Agreement between TOKEN and LATTICE never counts as two witnesses in any variant.
