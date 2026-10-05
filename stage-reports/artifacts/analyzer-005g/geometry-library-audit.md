# 005G — low-level 2D geometry library audit

**Scope.** Low-level operations only (brief §10). A library may return a union or an offset. It never decides which
polygon is the house.

**Where the results are.** Script `research/analyzer-005g/geometry-probe.mjs`; results in
`geometry-library-probe.json`. The probe was run on Node 18.20.4 and on Node 22.22.2: **outputs identical except
timings**.

## 1. What BuildApp computes today (read-only audit at `6b4ab1f`)

**No package uses a third-party geometry library.** `three` is only in `apps/web`, for rendering.

**The reconstruction envelope has no vector boolean or offset at all.** Five mechanisms stand in for them:
- raster masks;
- morphological opening as the only "offset" (`boundary-evidence.ts:77`, `plan-decomposition.ts:2340`);
- 1D interval coverage, written four times (`boundary-outline.ts:71`, `boundary-completion.ts:149`,
  `boundary-bodies.ts:77`, `plan-decomposition.ts:594`);
- grid-cell flood fill (`boundary-outline.ts:132`, `boundary-bodies.ts:97`, `plan-decomposition.ts:1660`);
- greedy rectangle tiling (`plan-decomposition.ts:1893`).

These are deliberate, auditable, integer-pixel operations. There is no fragile float boolean to replace.

**Vector primitives exist in `model`, `geometry`, `verification` and `reconstruction/v2`.** They are all floating
point with absolute epsilons (1e-12 … 1e-6) and `round6`/`round9` snapping:

| function | file:line | what | robustness note |
| --- | --- | --- | --- |
| `polygonIsSimple` / `segmentsCross` | `model/src/geometry-types.ts:57,79` | O(n²) proper-crossing test, eps 1e-9 on an area | **misses touching, vertex-on-edge and collinear overlap**: a self-touching ring passes |
| `clipConvex`, `convexOverlapArea` | `model/src/topology.ts:450,480` | Sutherland–Hodgman for `WALLS_OVERLAP` | correct only for convex input (wall footprints are convex quads by construction) |
| `pointInOrOnPolygon` & co. | `model/src/validate.ts:533–555` | even-odd + 1e-9 on-segment | five point-in-polygon copies with different boundary rules across packages |
| `tessellateRegion` | `geometry/src/region.ts:51` | scanline trapezoidation, outer − holes by **exact string keys** of coincident edges | relies on validation (no overlapping holes) |
| `triangulatePolygon` | `geometry/src/primitives.ts:84` | ear clipping, no holes, returns `null` on collinear/duplicate vertices (caller reports) | — |
| `clipToRect`, `clipPolygon`, `splitStrip` | `geometry/src/surface-regions.ts:31`, `closure.ts:266`, `stair-compiler.ts:88` | convex Sutherland–Hodgman / half-plane splits | convex only, by construction |
| `tracePolygon` | `reconstruction/src/v2/interior.ts:567` | room ring from cell edges | **suspected bug**: edges keyed by start vertex, so a pinch vertex (diagonally touching cells) overwrites one edge; holes are not traced |
| `terracePolygon`, `convexHull`, `simplifyClosed` | `v2/terrace.ts:127`, `v2/camera.ts:185,206` | hand-built unions / hulls | — |

**What must stay custom.** The semantic layer: gap classification, weak-gap judging, body classes, completions,
`planWallTopology`, junction cuts, and the watertight wall/roof tilers (`compileWall`, `tilePlate`) whose shared-vertex
guarantee a generic boolean library would not reproduce.

## 2. Probe

**35 cases.**
- **10 MODEL_WALLS.** Wall rectangles of seven committed canonical models: Marcówki v2, the BUILDAPP demo, Kosaćce,
  Azalia, Tunbergiach, Morelach (two levels) and Helikoniach.
- **17 LAYOUT_REGIONS.** The BUILT regions of every committed Evidence Pack's `14-selected-layout.json`.
- **8 ADVERSARIAL.** Shared edges, a collinear overlap, near-coincident vertices at 1e-9 and 1e-12, a 1e-6 sliver, a
  24-rectangle T-junction pile-up, a self-touching ring, 12 rotated walls.

**The operation** is a union. The **oracle** is JSTS 2.12.1 (the JTS port).

| library | throws | area vs oracle (max relative) | polygon / hole counts vs oracle | same shape when input order reverses | median / max ms |
| --- | --- | --- | --- | --- | --- |
| `polygon-clipping` 0.15.7 | **1 / 35**: "Unable to complete output ring" on 12 rotated walls (its known open bug class) | 2.9e-15 | identical | 34 / 35 | 0.55 / 16.7 |
| `polyclip-ts` 0.16.8 | 0 | 2.9e-15 | identical | **35 / 35** | 3.2 / 43.7 |
| Clipper2 (`clipper2-js` 1.2.4, integer, scale 1e6) | 0 | **1.2e-6** (integer rounding at 1 µm) | identical | **25 / 35**: same area, but the vertex set depends on input order (collinear vertices kept or dropped) | 0.8 / 10.7 |
| JSTS 2.12.1 (oracle) | 0 | — | — | 35 / 35 | 3.9 / 123 |

**Offset.** Each wall axis was inflated by its thickness (square ends, mitre joins) and the results unioned. Clipper2
and the JSTS buffer agree with the wall-rectangle union to ≤ 1e-6 m² on all 10 MODEL_WALLS cases.

**A trap the probe hit.** Clipper2 treats `delta` on an open path as the **full** stroke width, halved internally.
The first run passed half the thickness and got exactly half of every area. A port would need a test that pins this.

## 3. Verdicts

| library | verdict | why |
| --- | --- | --- |
| `polygon-clipping` | **REJECT** | stale since 2024-04, open infinite-loop / output-ring issues, and one reproduced here on ordinary rotated walls |
| `polyclip-ts` | **DEFER** | correct on all 35 cases, order-invariant, pure TS, identical on Node 18 and 22. But no current failure is a vector-boolean failure, the envelope has nothing to replace, and its LICENSE omits upstream notices (issue #27). First candidate if `tracePolygon` or room-polygon work needs a union. |
| Clipper2 (`clipper2-js` / `clipper2-ts`) | **DEFER** | Integer-robust, with offsets. But the JS port is stale (`clipper2-js`, 2024-01) or prerelease (`clipper2-ts`); 1 µm quantisation; order-dependent vertex sets, which would make model hashes depend on input order; and the delta-semantics trap. **`clipper2-js` 1.2.4 declares `@angular/core` and `@angular/common` ^15 as peer dependencies**: npm 7+ installs them, and `npm audit` reports high-severity Angular advisories with no fix through it. If Clipper2 is ever taken, take `clipper2-ts` (no dependencies). |
| JTS / JSTS | **RESEARCH_ONLY** | The best oracle (identical to itself under reordering, exact against the analytic adversarial areas). Worth a test-only dev dependency for verification oracles (`packages/verification`); EDL-1.0 licence option. On Android it adds nothing: no JVM geometry path exists. |

**Answer to decision question 10.** **No. Not now.**
- No library should replace a production geometry operation in the next stage. The envelope is raster by design,
  and the vector primitives are convex-by-construction helpers inside the compiler. None appears in a 005A–005F
  first bad decision.
- Two custom defects deserve their own small hardening task: `polygonIsSimple`'s blindness to touching rings, and
  `tracePolygon`'s pinch-vertex overwrite.
- When either is fixed, JSTS is the oracle for the tests, and `polyclip-ts` is the library to take if a real union is
  needed.
