# 005N geometry-kernel decision (EXTRA BINDING 005N-OSS)

**Outcome: `NO_NEW_KERNEL`.** No library is added to production.

The independent Work report `BUILDPLAN_OPEN_SOURCE_ANALYZER_TECHNOLOGY_AUDIT.md` was not found in this environment
(searched `/home/user` and `/root`); its explicit candidate list from the brief was used. As the brief notes, it did not
open BuildApp and ran none of its libraries.

## What the traced failures are

Before any technology was weighed, the existing surface was inspected: `packages/reconstruction/src/plan-decomposition.ts`
(bands → grid → cells → flood; `collinearWideGaps`, `baysOf`, the pocket rule), the boundary layer
(`boundary-evidence.ts` solid layer and `readWallLine`, `boundary-outline.ts`, `boundary-bodies.ts`,
`boundary-completion.ts`), `packages/source-cv` (bands, masks, segments) and the ring helpers. The analyzer has no
polygon boolean, offset or noding operation anywhere: the envelope is raster masks, 1-D interval cover, a grid flood
and rectangle tiling (005G §F, re-checked).

| development target | `FIRST_BAD_OPERATION` | kind |
| --- | --- | --- |
| dom-w-gozdzikowcach | `collinearWideGaps` reads along-pieces from bands only, so a wall-thick pier and its return do not split the span; no grid line at the set-back wall | **structural/source topology missing** (separator, return, back wall) |
| dom-w-murajach | `planExtentOf` drops a long wall corner-joined to the frame's own walls | **structural/source topology missing** (attached-body relation at the extent) |
| dom-pod-jarzabem | a step line read as infill on a single mouth | source perception of a non-wall line (not 005N's class) |
| dom-w-cyklamenach | glazing read as DASHED; REC-17 | source perception / completion rule (control) |

Every wall, pier, return and back wall involved is already present in the existing primitives: as an ink `LinePiece`
of `readWallLine` (gozdzikowcach's pier 434–465, its return 445–592 on x 434, the vestibule wall's pieces on y 550) or
as a long band (murajach's garage wall, axis 753). Nothing a raster primitive missed, and nothing a robust
intersection, polygonization or boolean would compute, is on the path.

## Candidates

| candidate | root fit | incumbent evidence | challenger evidence | licence | mobile cost | decision |
| --- | --- | --- | --- | --- | --- | --- |
| JTS (EDL-1.0 / EPL-1.0; JS port `jsts` 2.12.1 in `research/analyzer-005g` only) | none: no noding, polygonization or validity failure on any traced path; dangles/cut edges are not where the relation is lost | 1-D interval cover and grid flood decide closure; the failures are which ink counts as a separator, not how segments intersect | not run: no failing kernel operation to compare on the same fixtures | EDL/EPL (weak copyleft, Eclipse) | Java/ART bridge or a 7 MB JS bundle into `analyzer.mjs`; Node 18 OK | **DEFER** |
| Clipper2 (`clipper2-js` 1.2.4) | none: no polygon boolean or offset is computed, so none can be wrong | no production polygon boolean exists | not run; `clipper2-js` declares Angular peer dependencies | BSL-1.0 | native `.so` (16 KB page size, ABI) for C++; the JS port drags Angular peers | **REJECT** for this stage |
| polygon-clipping 0.15.7 (MIT, research only) | none | as above | not run | MIT | 372 KB JS | **REJECT** (no use) |
| OpenCV (existing bridge) | none: the primitives needed (wall-thick ink pieces, long bands) are found by the existing reader | `readWallLine` already finds the pier and return gozdzikowcach needs | not run | Apache-2.0 | 13 MB `opencv.js` or a native `.so`; Android has no OpenCV bridge | **REJECT** |
| ELSED | none: no wall line is missed by the raster reader on these targets | 005I measured 0 m unique wall-line coverage on seven real sheets | not rerun (brief: DEFER without a new source-perception first-bad decision) | — | native C++ | **DEFER** |
| PDF.js | none: both targets are raster plans with legible walls | — | — | Apache-2.0 | latest engine requirement newer than embedded Node 18.20.4 | **OUT OF SCOPE** (brief) |

## Packaging consequence

No new `.so`, no dependency, no licence notice, no APK growth from a library. The only production change is in
`packages/reconstruction` TypeScript, bundled into `analyzer.mjs` as before.
