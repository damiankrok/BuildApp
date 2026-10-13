# 005Q Phase A — adversarial review of the 005P boundary hypotheses (key: adversary)

> Phase A working draft by an independent read-only agent, committed as written (scratch paths shown as `$W`, a directory outside the repository; publisher rasters were read there and are not committed). Where it disagrees with `first-bad-boundary.md`, the disagreement is stated there.

Base code: `packages/reconstruction/src` at 04d5568 (HEAD d28b755 only adds research/ + artifacts; `git diff 04d5568 HEAD -- packages` is empty).
Line numbers below are at 04d5568 (`plan-decomposition.ts` = PD).
All counterfactual runs: copy of v-probe at `$W/agents/adversary/v1` with env-gated switches
(`ADV_MINCELL`, `ADV_SNAP`, `ADV_OUTER`, `ADV_NOCC`, `ADV_INJECT`, `ADV_LONG`); outputs in
`$W/agents/adversary/runs/<label>/<case>`. Control runs `ctl` are byte-identical to B0
(glogownikach model/failure sha equal; akebiach failure sha equal). One replay at a time.
Rasters were decoded in scratch only (`agents/adversary/img`), nothing copied into the repo.

Labels: **KNOWN** = reproduced from code/data/replay with numbers; **INFERRED** = reasoned or measured by eye/arith
from the raster but not replayed; **UNAVAILABLE** = cannot be determined from what is here.

---

## H-A glogownikach — verdict PARTLY_SUPPORTED (mechanism partly right; the counterfactual and the X story are wrong)

Frame `…0cb0a5c1d9`, extent 78..812 × 203..553, mpp 0.026261/0.026207, wallPx 18, minCellPx 17.1357 (minCellM 0.45).

**Extent is right (KNOWN + INFERRED).** Outer faces of the long bands: x 78 (band 78..95) and 812 (band 795..812),
y 203 (203..220) and 553 (536..553); the axis box is 77.5..812.5 × 202.5..553.5 (probe `axes`). Overall chain 17
(`chain-vertical-17-…`) states 920 cm over 203..553 (READ on the twin frame `…b0502a47aa`, CHAIN_CORRECTED here);
the raster prints 949 + 541 + 440 = **1930** to x 78..812 (734 px × 2.6295 = 1930; INFERRED from the raster, the
selected frame never reads 1930/440). At the truth scale 2.6286 the outer box is 19.29 × 9.20 = 177.5 m² vs 178.13
published (−0.35 %). B0 ships 163.81 m² (−8.04 %), ring "18.83 × 8.70 m" **SOURCE_EXACT** (KNOWN).

**Y and X fail by different mechanisms (KNOWN).**

| | Y (south wall, band 536..553, axis 544.5) | X (east wall, band 795..812, axis 803.5) |
|---|---|---|
| lines | 536 (chain-41 tick, 870 segment) and 553 (chain-17 + chain-41 tick) | 797.69 and 812 (chain-622 DERIVED tick, 795..812 = 44.6 cm) |
| who gets the band (PD:509) | both claimants: span 350 = 350, distance 8.5 = 8.5 → **tie broken by `a.px - b.px`** → lower px = **inner face 536**. On the min side (203) the same rule picks the outer face: the tie-break is orientation-biased | span 734 = 734, distance **5.81 < 8.5** → 797.69 |
| what the winning line is | inner face | **not a face**: 797.69 is the fitted end tick of chain `481-b5c03be77e` segment `ccbfbc1f91`: rawText **"150"** → valueText **"250"** (CHAIN_CORRECTED, "a value downstream of that scale, never a witness for it"), on the garage's printed **350**; mark class QUESTIONABLE (COLOUR_MISMATCH, WEDGE_NOT_STROKE). It sits 2.69 px *inside* the wall (inner face 795). It holds its position because chain 481 is processed before overall chain 622 and absorbs 622's drawn TICK 795 within snapPx 5 (PD:481) |
| confidences | 536 = 0.95 (printed+band), 553 = 0.8 (printed) | 797.69 = 0.95 (CHAIN_CORRECTED counts as printed, PD:478, + band), 812 = 0.5 (DERIVED chain only) |
| thinLines gap (PD:569) | 17.000 < 17.1357 — **near-tie, 0.136 px** | 14.31 < 17.1357 — **2.83 px, not a near-tie** |
| snap (PD:1246-1249, strict `<`, tol 18) | 553.5 → 536: d = 17.5 — **0.5 px margin** | 812.5 → 797.69: d = 14.81 — 3.19 px margin |

So "0.136 px" is the Y story only. On X a minCellM change must go below 14.31 × 0.026261 = **0.376 m** to keep 812.

**Counterfactuals (all KNOWN, one replay each):**

| label | change | predicted by 005P | result |
|---|---|---|---|
| mc044 | minCellM 0.44 | "keeps 553, restores Y ≈172–173 m²" | keeps 553 (envelope y1 553) but **RECONSTRUCTION_FAILED** (createWallRing: WALL_CONSUMED / WALLS_OVERLAP, "ring-attached-0-0-w1 has no material left … 0.473..-0.027 m of 0.446 m"). Regions: main 78..797.69×203..536 + 0.446 m-deep slivers 78..439×536..553, 646..668×536..553 |
| mc037 | minCellM 0.37 | both faces kept | envelope **exactly right** 78..812 × 203..553, still **RECONSTRUCTION_FAILED** (same refusal; sliver regions incl. 797.69..812×536..553) |
| nosnap | snap tol 0.6 px | outer faces | envelope 78..812.5 × 203..553.5, footprint **unchanged 163.81 (−8.04 %)**, ring unchanged; only the 3 PAVED "recess" terraces (11.21 m²) and all bodies disappear |
| outer1 | claimant tie-break → farther from extent centre | Y fixed | Y line 553 kept, X still 797.69; **−18.00 %** (146.07), split into 3 rings 3.94×9.15, 9.48×1.03, 12.36×8.12 |
| nocc | CHAIN_CORRECTED not "printed" | — | model byte-identical to B0 (797.69 still takes the band by distance → 0.75 vs 812's 0.5) |
| outer1nocc | both | envelope right | envelope **exactly** 78..812 × 203..553, **−17.12 %** (147.64), 3 rings; the cell row 516..553 at x 439..552 becomes RECESS (the short pier bands at y 517..534 lost their probe line when 536 was thinned; INFERRED mechanism) |

Conclusions:
- **No single step is decisive.** Snap alone: no footprint change. Thinning alone (the 005P falsifier): emission
  failure. Face choice alone: −18 %. A correct envelope (mc037, outer1nocc) still fails downstream. The 005P
  falsifier "minCellM 0.44 … restores Y (≈172–173 m²)" is **REFUTED end-to-end**; it was arithmetic from a scratch
  re-implementation (ledger says so).
- Thinning has a real job: two face lines 17 px apart make a wall-thick cell row that the region/ring emitter cannot
  survive. A fix must choose *which* face survives, not keep both — and then the probes/cells must still close.
- A threshold fix on Y alone (minCellM 0.44 or snap tol 17.4) is a threshold artefact: at best it would give
  18.83 × 9.15 ≈ 172.2 m² (−3.3 %, a PASS under the ±6 % verdict, `holdout/verdict.mjs:88`) **with X still one wall
  short** (0.376 m). The verdict cannot see the X error. (INFERRED arithmetic; the real replay of that threshold fails
  earlier anyway.)
- Earliest incorrect operations: Y — PD:509 tie-break `a.px - b.px` on an exact tie; X — PD:478 counts a
  CHAIN_CORRECTED substitution (150→250, printed 350) as a printed statement, and PD:481 lets the first chain fix the
  line position over a drawn TICK. Upstream of X: the chain solver's substitution itself (BINDING_OR_CHAIN class,
  same pattern as murajach 1020→1010).
- B0 already ships fabricated semantics here: 3 PAVED terraces "floor of the east/front recess" 3.27 + 6.63 + 1.31 m²
  that are the wall strips (0.4455 m deep) — KNOWN.

## H-B krasnokwiatach — verdict PARTLY_SUPPORTED

Frame `…723651b1ff`, extent 154.5..535 × 77..718, mpp 0.02511, wallPx 18.03 (long ≥ 45.08 px). Chain ticks
77|248|559|718 (430|780|400 on the raster; 1610 total) — KNOWN. Envelope 155..535 × 248..559 (KNOWN, probe).

- **"Box = middle 780 strip"**: SUPPORTED. axis box y from H long bands 252 (→242.98) and 550.5 (→559.52), snapped to
  248/559. `reach == axes`: sideWallReach (PD:1302) needs a long side wall on both sides; the E wall band 524.5 runs
  y 95..700 through all three strips, the W side has none in the N/S strips (terrace/porch) — PD:1311 `continue`.
- **"N edge snapped to an interior partition merged with the fireplace"**: PARTLY. Band 252 (x 373..423, thickness
  28) is the fireplace + partition, long by only 6 px (51 vs 45.08). But it is **not decisive**: without it band 261
  (x 425..515, thickness 11, length 91) gives y0 = 252 → snaps to 248 too (INFERRED arithmetic). And 248 is not only
  a partition: on the W half it is the dining room's real N facade (door 180/230 to the NW terrace; piers ≈157..180
  and 253..277, INFERRED from raster). The plan is stepped; 248 is a facade on the W and an interior line on the E.
- **"Real facades are a 400 cm window and a 285 cm garage door — piers that leave no long band"**: SUPPORTED for N
  (only band 85.5, x 476..515, length 40 < 45.08). For S the garage-door piers are **not bands at all** (probe band
  list has nothing at y≈700..718 inside x 365..535). Note the bands at x 229..261, y 622..755 (631.5/670.5/708.5/746.5,
  V 235.5 length 129, "long") are **bush symbols**.
- **The box S edge cuts through the garage** (KNOWN from raster + printed 600): garage interior runs y ≈461..700
  (600 cm = 239 px), no wall at y 559 for x 365..535. The boundary record calls 364.5..535 × 559..718 FLUSH_ATTACHED
  5.48 m² **REJECTED WALLED_OFF "no open edge or door reaches it"** — false in the source; the rect is 17.1 m², the
  5.48 m² is the flood fragmented by the car/parking-bay drawing (UNKNOWN 11.2 m² 384..535×559..690; INFERRED).
- **"Walled parts + covered terrace + porch ≈ 142.9 m²"**: not reproduced exactly; INFERRED pixel rects:
  box 74.52 + living room 4 (260..535×77..248) 29.65 + garage (365..535×559..718) 17.05 = **121.2 m² (−15.3 %)**.
  S porch (203..365×559..718) 16.2 → 137.5 (−4.0 %); + NW terrace (155..260×77..248) 11.3 → 148.8 (+3.9 %).
  So **walled rooms alone cannot PASS**; any PASS must count roofed-open area, and the ±6 % verdict cannot tell
  "porch only" from "porch + terrace". Whether the NW terrace is roofed is UNAVAILABLE from the plan (corner posts
  suggest a pergola; needs elevation/roof plan).
- Counterfactual ADV_LONG = 1.6 (piers count as long): envelope becomes the full extent 155..535 × 77..718 — but the
  S edge comes from the **bush band 708.5** (x 229..261) and the N edge from the 40-px N pier. Outcome still FAILED,
  85.08 m² (−40.6 %). KNOWN. A correct-looking envelope built on bushes; and the enclosure still fails.

## H-C akebiach — verdict REFUTED (the 005P falsification is itself wrong in its generalisation)

005P: "Injecting both piers … 344 → 347 … the decisive leak is the core's S face, which carries no wall-thick ink
(row ink 0.08–0.27); no closure rule and no band snapping can shut a face the drawing does not ink as wall."

- The N piers are indeed not decisive: injN (V 370..386 and 589..605 × 194..243, dark share 0.95) → 347 enclosed
  cells, 95.60 m² (KNOWN, reproduces 005P).
- **The S face is inked, wall-thick, and stepped** (KNOWN, raster mask <90): y 620..635 dark runs x 370..405 and
  454..501 with a 48-px gap (= door 140/220); y 640..656 dark runs 487..510 and 580..604 with a 70-px gap (= window
  200/130). Dark share of those rects 0.998 / 1.000 / 1.000 / 0.998. 005P measured rows **580..619** (interior floor,
  ink 0.03–0.07 in my measurement) and injected its "source-unbacked" S band at **y 595..610** — the wrong place.
- None of these pieces is a band (probe band list: only V 592 at 580..604×611..656 near there), there is no X grid line
  at the step (rawX between 380 and 600 = {389.5, 592}), and no Y line at 620/635 in the non-override grid.
- **Counterfactual (KNOWN):** injS / injS2 (only the ≈1.0-ink rects: H 370..405×620..635, H 454..501×620..635,
  H 487..510×641..656, H 580..604×641..656) → enclosed cells **344 → 447**, storey **96.93 → 159.32 m²**; the core
  column x 389.5..592 becomes BUILT 227..611. injNS == injS (N piers add nothing).
- So the root is PRIMITIVE_EXTRACTION of short/L-shaped facade pieces (the "missing piers" class, at the S face, not
  the N), not an un-inked face. Still −36.1 %: the walled garage (≈66..304 × 520..759, ≈48 m², door 485/229 between
  piers) remains outside — the same "piers leave no long band" pattern.

## H-D "strong printed dimensions imply the enclosure" — verdict REFUTED as a general rule (holds on some rows)

Holds (chain extent = walls): morelach E 1.06 m ACCEPTED; modrzykach S 9.63 m and helikoniach N 7.3 m via a built
PROJECTING_WING; glogownikach (no conflict, extent = outer faces). Counterexamples inside a STRONG extent (B0 digests
+ raster reading):

| row (B0) | STRONG side, gap | what is there | cost of filling the chain rectangle |
|---|---|---|---|
| rarytasy-g2e PASS −2.75 % | S 6.12 m (ZONE) | walled double garage (built as ring-attached 6.17×6.20) **and** ≈55.7 m² open ground E of it | +55.7 m² → ≈ +26.6 % FAIL. B0 already emits a 55.71 m² UNKNOWN "front recess" terrace there (KNOWN in model; that it is ground is INFERRED from raster) |
| dom-w-zurawkach PASS −0.81 % | S 1.5 m (INCONCLUSIVE) | open entrance porch with a post (UNKNOWN 6.7 m², 327..599.5×456..523.5) beside the projecting garage | +6.7 → +5.8 %, a "PASS" by 0.2 pp with a fabricated room |
| willa-miranda (footprint −1.49 %) | N 2.43, S 2.43 (ZONE) | S porch with a post (COVERED_TERRACE 10.1); N planter terrace (UNKNOWN 5.0) | +15.1 → ≈ +7.4 % FAIL |
| dom-pod-jarzabem −11.88 % | S 0.98 (ZONE) | **mixed**: Gabinet and Kuchnia project to y≈596 (built rooms, piers 280..310/382..413 and 635..668/740..768 + 200/140 windows) and between them (≈430..618) an open recessed entrance porch with doors 70/210, 105/210, 70/210 on the inner facade (band 556) | per-side fill builds the porch (≈5 m²). Also N SUPPORTED 2.47: covered terrace with posts |
| dom-w-dabecjach | W 4.95, N 3.05, S 4.9 | walled room 2 (W) **and** NW covered terrace with posts + SW garden | per-side fill builds ≈30 + ≈25 m² of terrace/garden |
| dom-w-krasnokwiatach | N 4.29, S 3.99 | E halves walled (living room, garage), W halves terrace/porch | see H-B |
| dom-w-jablonkach PASS −0.4 % | N 3.81 (SUPPORTED, not STRONG) | covered terrace 3.0 | — |

Extra: ADV_LONG = 1.6 turns jarzabem into **PASS −5.2 %** (205.49 m²) with a single rectangular ring 18.61 × 11.04
and a 79.86 m² UNKNOWN "rear recess" terrace — a threshold-artefact PASS that walls in the recessed porch. KNOWN.

## Design implications (evidence-backed)

1. Do not fix glogownikach by a tolerance (minCellM, snap tol): the replays fail (mc044/mc037) or leave X wrong; and a
   Y-only repair would pass the ±6 % gate while X stays one wall short.
2. Face choice must be symmetric (no `a.px - b.px` orientation bias at PD:509) and a line's "printed" status must not
   come from a CHAIN_CORRECTED substitution (PD:478) — but either change alone is destructive (outer1 −18 %,
   outer1nocc −17 %): face choice, probe inheritance in thinLines and cell closure have to move together, and only one
   face line per wall may survive.
3. The envelope is not the only failure: a correct envelope (mc037, outer1nocc, long16 krasnokwiatach) still fails.
   Gate any envelope fix on downstream outcomes and semantics, not on envelope geometry.
4. Facade = pier + opening + pier, piers shorter than 2.5 wallPx, is the shared mechanism of krasnokwiatach (N, S),
   jarzabem (S), akebiach (S face, garage). Fixing it at extraction (short/L-shaped wall pieces with ≈1.0 ink) is
   source-backed (akebiach 344→447 cells); lowering the long-band threshold globally is not (bushes become walls,
   jarzabem gets a fabricated porch PASS).
5. Any chain-constrained completion must be per-part, not per-side: on the same STRONG side the source shows walled
   rooms and open porches/terraces/ground (jarzabem, krasnokwiatach, rarytasy-g2e, dabecjach). It must leave rarytasy-g2e,
   zurawkach, willa-miranda, jablonkach footprints unchanged and must not convert a porch/terrace into a room.
6. The ±6 % footprint verdict cannot discriminate several of these (zurawkach +5.8 %, krasnokwiatach porch vs
   porch+terrace, jarzabem long16 PASS): adoption needs semantic checks (no new built area where the source shows an
   open mouth / posts / ground; no new SOURCE_EXACT ring on an inner face; no new terraces on wall strips).
7. Existing B0 semantic defects a fix should not preserve or extend: glogownikach wall-strip PAVED terraces (11.21 m²),
   ring SOURCE_EXACT on an inner face; krasnokwiatach "WALLED_OFF" on a garage that is open to the box; rarytasy-g2e
   55.71 m² terrace over ground.
