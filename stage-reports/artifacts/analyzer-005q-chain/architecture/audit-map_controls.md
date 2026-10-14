**Self-witness at extract.ts:997 — KNOWN, but narrower than suspected.**

- **What the code does.** extract.ts:997 adds every segment that is not `DERIVED` and has confidence > 0 as a registration anchor, so `CHAIN_CORRECTED` segments become anchors. The comment at :992 says "Only a segment whose number was actually READ anchors a registration", and the code does not do that. The derivation text at :973-974 calls the corrected value "never a witness for it".
- **Where the anchors go.**
  - `registerFrame` → `fitAxis` (registration.ts:74, inlier tolerance 3 px at :128) weights them, keeps them as inliers, and counts them in the confidence formula (registration.ts:170, +0.08 per anchor up to 5).
  - The `anchorable` filter (extract.ts:473-481) applies only when the scale stands and the chain was re-read. It then keeps legacy segments that match byte for byte, legacy `CHAIN_CORRECTED` included.
  - The legacy scale vote itself counts substitution readings (chains.ts:259-285 `proposalsOf` over every reading, weight at :278; vote at :576-579).
- **Where the loop does not reach (KNOWN).** `FrameMetricSolution` (relation, confidence, `independentWitnesses`) excludes substitutions (metric-solution.ts:1-40). It only records them as `legacy.correctedAnchors` (:1077, :1461-1462).
- **Two more consumers carry the loop on.**
  - **Derived fill.** The confirmation check before filling gaps counts corrected segments as fitted (chains.ts:768 `fitted += 1`, gate at :778). Blank segments then get `DERIVED` values (:783). `closes` likewise counts them as read (extract.ts:1014).
  - **The model's numbers.** The model takes metres from the registration plus `axisLadder` (layout.ts:1707-1711). `axisLadder.valueOf` (layout.ts:1139-1148) reads the evidence value with no origin filter. Ties between statements of the same span go to the one citing more evidence ids (layout.ts:1181), so a total built from `DERIVED`/`CHAIN_CORRECTED` pieces beats a single `READ` total.
  - So a `CHAIN_CORRECTED` value feeds wall lengths directly, not only through the scale. Its magnitude on the scale is small because it fits by construction; it fixes positions on the ladder.
- **Labelled as source, never gated.**
  - emit.ts:193 labels every body ring `SOURCE_EXACT` unless `outerFacesOpen`, without looking at the span's origin.
  - The HARD constraint at reconstruct.ts:333 needs confidence ≥ 0.45. Every `CHAIN_CORRECTED` in these controls is ≤ 0.42 (MEASURED), so in practice they become SOFT, never HARD.
- **Other consumers that count `CHAIN_CORRECTED` as read.** plan-decomposition.ts:478 (`printedChainIds`), :806 and :820 (`dimensionedAxis`); layout-gate.ts:84; plan-extent.ts:193; solve.ts:191; plan-resolution.ts:202. plan-resolution.ts:206/:218/:228 score a corrected statement by its raw classic token (`firstReadCm`), for example 740 for the 790 twin.

**Verification method (MEASURED).** I ported `axisLadder` and `fitAxis` to Python (scratchpad `ladder.py`, `masses.py`, `anchors.py`, `inkfirst.py`, `ccobs.py`). On today's PROD3 inputs the port reproduces every ring in provenance.json exactly: S5 7.90×12.61 and 4.15×7.51; S6 14.54×8.90, 6.48×3.70, 2.04×4.35; S7 7.50×8.00 and 4.30×9.50; S8 7.34×10.01 and 3.88×1.44.

**Per control (MEASURED; truth from label-records-primary.json).** All four PROD3 runs are COMPLETED with model.json present.

**S5 marcowki** (frame `rzut-19a11bc745`; CONFIRMED / STRONG; scale 2.642489 / 2.64342 cm/px)
- Registration: mpp 0.026426 / 0.026468, 9 anchors.
  - X: 1 `READ` (1205) + 4 `CHAIN_CORRECTED`.
  - Y: 2 `READ` (100, 510) + 2 `CHAIN_CORRECTED`.
  - `READ` 1260 (`b2e52a12fc`, 476.5 px) is not an anchor: its chain is the only re-read one, and `anchorable` drops it.
- `READ`-only refit: X 0.026425, Y 0.026424 (−0.17 %). There is still ≥1 `READ` anchor per axis.
- Corrected values (token → value; truth):

| Evidence | Token → value | Truth | Ink on that span | Model use |
|---|---|---|---|---|
| `4af572f280` | 740→790 | 790, rotation twin | ensemble AGREES 790 | sets line 357 → mass-0 X 7.90 |
| `07b24ca33a` | 115→415 | 415 | AGREES 415 | 2-id overall X total 1205 |
| `c7e4ed94b9` | 151→751 | 750 | LEADS 750 (fits the span) | Y 12.61 and 7.51 |
| `35e54a50f9` | 515→155 | 375 | 375 rejected on this span | interior line 465.5 |
| `bb4af04758` | 701→301 | 700, twin | no observation on span | lines 128.5, 177.5, 327 |
| `710b0e5729` | 147→157 | 265 | no observation on span | anchor only |

- The 12.61 comes from `READ` 510 + `CHAIN_CORRECTED` 751 (2 ids) beating `READ` 1260 (1 id) at layout.ts:1181. Truth is 12.60 and 7.50.
- The metric layer already holds 750 (`dim-obs-151-rotated-cw-e6d6cd4c8d`), but none of its readings of that ink is a primary binding, so the chain was not re-read (`rereadChainIds` = [chain-v-568] only). Mechanism is a HYPOTHESIS; test it by instrumenting `better(c)` / `taken` at metric-solution.ts:1313-1333.
- Attic plan `rzut-117027f690`: Y has 4 `CHAIN_CORRECTED` and 0 `READ`; X has 1 `READ` (141). Its measured anisotropy of 1.008 is entirely self-witnessed. None of the 7 attic `CHAIN_CORRECTED` values is confirmed by ink on its span.
- `CHAIN_CORRECTED` level datums feed the levels: `70deeedf63` +5.06→3.06 (floor) and `c977b973a3` +0.67→4.67 (eaves).

**S6 kosacce-clean** (frame `rzut-f530d6ebf2`; CONFIRMED / STRONG; 2.4058 cm/px)
- Registration: 18 anchors. X: 2 `READ` (204, whose truth is 205; and 86) + 9 `CHAIN_CORRECTED`. Y: 2 `READ` (1260, 370) + 5 `CHAIN_CORRECTED`.
- `READ`-only X refit: 0.023885 vs 0.024058 (−0.72 %). The X scale really rests on the correct corrections 1000→1660, 005→665 and 111→521.
- Truth-correct corrections (ink AGREES or LEADS on the same span): `b8ac0581c4` 1660, `3bc38dcef2` 665, `c52417dcc9` 521, `911f988d1e` 840→890.
- Wrong corrections:
  - Ink right but rejected on this span: `559cec0060` 226→216 (truth 226), `85e88b9dbc` 116→126 (176), `0b47c977a9` 302→202 (342), `3cd80eef82` 130→150 (270), `4005884a2d` 387→381 (387).
  - No observation on the span: `0a3d3f5c18` 156→136 (236), `82140d6d5f` 170→174 (370), `3de2e9d267` 015→315 (518), `b2697ef666` 461→61 (196, bound wrong).
  - Truth unknown: `a08977405d` 170→110.
- Mass-1 X is 6.48 in PROD while the printed 665 says 6.65. Line 157.5 is fixed by the long `DERIVED` chain h-655, whose 3 corrections (136, 174, 110) are truth-wrong, before the 665 statement applies.
- Full X width is 16.58: a 4-id `DERIVED`+`CHAIN_CORRECTED`+`READ`204 total beats the 1-id 1660.
- `CHAIN_CORRECTED` level datum `3fdc3f3028` +3.05→7.05 is the top datum.

**S7 dom-w-zurawkach** (frame `rzut-0dfaf7d6ba`; CONFIRMED / STRONG; 2.2182 cm/px)
- Registration: X 4 `READ` + 2 `CHAIN_CORRECTED`; Y 2 `READ` + 1 `CHAIN_CORRECTED`. `READ`-only refit is unchanged (Y 0.022161).
- Corrections:
  - `18be7714a3` 008→406: truth 408; ink LEADS 408 and fits. Not used in the ladder.
  - `4249e4a0e1` 176→136: truth 176, the token was right. Moves interior line 688.5 by 1 cm.
  - `dcc8e758f3` 450→950: correct, but loses to `READ` 800+150.
- Masses do not depend on any correction.
- Caveat: `READ` is not the same as correct. `c23da7f5de` 212 is bound wrong (b0 and b2 both). `fac6b2a4cd` reads 155 but truth is 335. Both are X anchors and both feed ladder lines. So X has only 2 truth-clean `READ` anchors (1180, 750).

**S8 A06** (frame `rzut-f08001e3c4`; REPLACED / WEAK; 2.0726 cm/px)
- Registration: X 2 `READ` + 1 `CHAIN_CORRECTED`; Y 2 `READ` + 1 `CHAIN_CORRECTED`.
- The `READ` values come from lattice or external readings whose token text differs: 750→734, 40→290, 100→1001, 1115→1145.
  - `06b9bae7f7` (1145) is flagged `dependsOnScale`, so Y has strictly 1 independent `READ` (1001).
- Corrections:
  - `6d41ee905d` 165→185: truth 165, the token was right. Lines 352.5 and 385.5 move by 6 mm.
  - `857729e717` 101→144: correct. Part of the 2-id total Y 1145.
- Masses do not depend on any correction.
- `CHAIN_CORRECTED` level datums feed the levels: `d51a09497b` 2.86 (floor), `16ab3d18b8` 5.8 (eaves), `a9d4a2fdf2` 9.05 (top). Truth not checked.

**Ink-first prediction (HYPOTHESIS, simulated).** Rule: keep a corrected value only when the ensemble or lattice reads that same value on that span; otherwise drop it; refit with `READ`-only anchors.

- **S5:** mass-0 7.90×12.61 → 7.90×12.60 and mass-1 4.15×7.51 → 4.15×7.50, both matching truth. Lines 327 and 465.5 move about 5 cm. The attic registration disappears (1 anchor < 2, extract.ts:793/815-820), which changes the stated storey alignment at layout.ts:809-815.
  - At risk: `4af572f280`, `07b24ca33a`, `c7e4ed94b9`, `bb4af04758`, `35e54a50f9`, plus the 7 attic corrections.
  - b2 left 790 UNRESOLVED. If ink-first does not bind 790, mass-0 X becomes 7.80.
- **S6:** mass-1 6.48 → 6.65 (matches the printed 665). Twelve interior X lines move up to −20 cm and Y lines 549.5 / 655 / 683.5 move +2 to +7 cm. Chains h-391, h-550, v-676 and v-154 lose their "read" status, which affects `printedChainIds` and the extent.
  - At risk: all 14 corrections; highest risk `0a3d3f5c18`, `82140d6d5f`, `a08977405d`, `559cec0060`.
- **S7:** no mass change; line 688.5 moves 1 cm (`4249e4a0e1`).
- **S8:** no mass change; lines move 6 mm (`6d41ee905d`).
- Not simulated (HYPOTHESIS): a vertical ink-first change would move the S5 floor and eaves and the S8 floor, eaves and top through the level-ladder corrections (registration.ts:394; anchors at extract.ts:762).

**Rotation twins and unbound correct readings (005Q-OCR artifacts).**

| Sheet | Rotation twins | Correct but unbound or bound wrong |
|---|---|---|
| S5 | 790 (b0), 700 (b0, ROTATIONAL_TWIN_AMBIGUOUS), 100 (b0), 510 (b1) | Read right, not bound: 414, 446. Correct only from b1: 290, 312, 100 (that 100 is TOKEN_NOT_ON_A_CHAIN) |
| S6 | 269 (b0, not bound), 86 (b0), 890 (b0 and b1) | Read right, not bound: 13, 419, 310. Bound wrong: 196. Ensemble not kept: 387. b1 only: 387 (horizontal) |
| S7 | 800 (b0 and b1), 950 (b1) | Read right, not bound: 430, 257, 453. Bound wrong: 212. b1 only: 254 |
| S8 | none | Read right, not bound: 358, 362, 261, 279. Ensemble not kept: 374. Token not on a chain: 174, 161 |

**Tests to register.**
1. Synthetic chain with one corrected segment that pins a grid line. Assert that `axisLadder` does not prefer a 2-id total that includes it over a 1-id `READ` total, and that `registerFrame` excludes or flags the corrected anchor.
2. S6 replay assertion: mass-1 X equals the 665 span ±1 cm.
3. S5 replay: Y total equals 12.60.
4. Attic guard: a frame whose only anchors on one axis are corrections must register as AMBIGUOUS, not as measured anisotropy.
5. Level ladder: corrected rungs must carry a derivation and not anchor.

Scripts are in `/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/` (`ctl.py`, `chains.py`, `ladder.py`, `anchors.py`, `masses.py`, `ccobs.py`, `inkfirst.py`). Main source files: `/home/user/BuildApp/packages/source-metrics/src/extract.ts`, `registration.ts`, `chains.ts`, `metric-solution.ts`; `/home/user/BuildApp/packages/reconstruction/src/layout.ts`, `reconstruct.ts`, `v2/emit.ts`, `plan-resolution.ts`.