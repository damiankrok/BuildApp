# 005H — recommendation

## Keep

- **The external recogniser, as integrated.** It is a second witness on the same pixels, with no fallback, and the
  custom reader stays. On both blind plans it made no confident-wrong reading. It led 9 labels the custom reader
  could not read, all right, and contested 4 confident custom misreads, all right. It turned one blind refusal into a
  PASS (`dom-w-arkadiach`: the overalls `740`/`940`). The OFF path is byte-identical on 22 of 22 development rows.
- **The P2 rule as bound, with the post-review narrowing.** Corroboration needs posterior ≥ 0.90, greedy mean p ≥ 0.90,
  a stable bracket and the model's own greedy reading. Agreement needs the same reading, separators included. A
  different digit count never contests a scale. Do not tune any of its bounds toward a house.
  - modrzewnicy's `2590` misses the mean-p bound by 0.0045 and stays NOT_CORROBORATING. That is the bound working,
    not a target.
- **The two owner decisions (A2, A4)** stay as recorded in `post-review/resolution.md`. On blind 7, every doubt raised
  without a confident external reading (7) fell on unbound ink or on a label the external reader had right.

## OWNER action (closes a verdict)

- **ARM64_DEVICE_PARITY is PENDING.** On the OWNER APK, open "Dodaj dom z linku" → "Test zgodności odczytu wymiarów"
  → "Uruchom test" on the arm64 phone and copy the result ("Kopiuj wynik").
- **MATCH** with corpus `734300d2…`, output `396c9f54…`, 92 of 96 closes it.
- **Anything else** (NIEZGODNY, a different corpus, a failure) is a finding for the next stage, not a reason to change
  a threshold. The checklist and expected values are in `parity-arm64-device.json`.

## Next analyzer stage — dimension topology on parallel chains (input: blind round 7 #1)

The first bad decision on `dom-pod-jarzabem` is upstream of any reading (`blind-round/README.md`):

1. **Label to line binding between two parallel lines.** A rotated label between an overall line and its inner chain
   23.5 px apart was bound to the overall line on centring alone; the overall's own label was left unbound. The drawing
   convention to test is generic: which side of its line a rotated label sits on, and one label per span. It should
   be checked on every development house's double margins, not tuned on this one.
2. **Label ink taken for ticks.** Two "ticks" on the overall line sit inside the neighbouring label's own extent.
3. **The extent's end-stub trim.** An end segment is unread when its own label was read the same by both readers but
   did not reconcile at a 3 % low kept scale (residual 2.5 px on 33.6 px). The trim then cut 0.9 m off the house. Look
   at the order, not the bound: the scale was kept WEAK against three independent readings of the right one.

Both round-7 families join the development set. A further claim needs a fresh blind draw on a new frozen SHA.

## Then — PDF.js document evidence (PILOT), as 005G recommended

- The brief kept it for after 005H ("DO NOT START PDF.JS YET").
- 005G's probe stands: PDF.js 4.8.69, the last Node-18 line, read Aster VIII's scale text and scale bar as geometry.
- It is independent of the topology work above, and the two can be sequenced either way.

## Residual risks to carry (from `post-review/resolution.md`, unchanged by the blind round)

| risk | detail |
| --- | --- |
| production-path confident-wrong | 3 of 672 on the realistic synthetic page (two on dimension values), one over the drawn-box bound. Not gated |
| orientation | both readers inherit the page's orientation vote |
| bracket | blind to truncation and to neighbouring ink |
| per-plan worker | re-verifies about 19 MB and recompiles the WASM per plan: +24 to +36 s per analysis on desktop; arm64 phone timing pending |
| RSS after a worker exits | stays 60–75 MB above where it started. Whole-run peak +112 to +217 MB on desktop; 981 MiB on the emulator's second house |
| PaddleOCR training data | undisclosed (Apache-2.0 code and weights) |
