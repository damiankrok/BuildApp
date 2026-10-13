# 005O — topology / open-source kernel decision (gate T)

**Decision: `NO_KERNEL_BOTTLENECK` — no JSTS / Clipper2 / polygon-clipping A/B was executed, by design (brief §6: "do not execute a contrived A/B").**

Evidence: `akebiach-topology.json` (reproducible: `research/analyzer-005o/akebiach_topology.py` on the sealed blind-10 run and
its cached plan raster, SHA-256 `4180d9fb…f3f9`), and the read-only trace in the stage report §C.

## The first wrong structural relationship on `dom-w-akebiach`

| layer | what happens | kind of decision |
| --- | --- | --- |
| band extraction (source-cv) | the projection's two side piers (16 × 49 px solid ink, `darkShare` 1.0 in the source) are **not** in the 35 accepted wall bands; the rear wall survives as two 32 px pieces | primitive extraction (a short wall-thick block, not a line) |
| incumbent envelope (`plan-decomposition.ts` long bands ≥ 2.5 walls) | the 32 px rear pieces are not "long"; the box's north side is taken from the wing walls (y 227); the 0.96 m projection is outside; the bay rule needs ≥ 64 px depth (projection 33 px) | semantic extent rule |
| 005C opening-aware outline | two incumbent classifiers disagree on the 4.01 m terrace door: the wide-opening reader records it `OPENING_IN_WALL` (score 0.8, sealed digest and `12-opening-observations.json`), while the boundary evidence treats it as a true exterior gap by its width rule (> 3.2 m strong-leaf bound; **inferred from `boundary-evidence.ts:602–610`, not serialized** — only the 20 UNKNOWN_GAP records are); the 400/220 callout printed over it was never read. The outline floods through it and the 6.86 m / 5.90 m junction | semantic gap classification (inferred) + an unread callout |
| 005F completion | only judges parts the outline encloses; the projection and the garage interior are never parts | semantic |

## Would a kernel operation on the SAME accepted line set change it?

| operation | measured result on the accepted bands |
| --- | --- |
| noding / snapping endpoints | between band **axes**: the rear-wall ends are **41.65 px / 41.8 px** (1.21 m) from the core walls and the pergola posts **54.7 px** from the rear wall; between band **rectangles** (post-review T3): 34 px and 47 px (the wing-wall joints are 8 px, inside the 0.6-wall 9.6 px tolerance). Every tolerance in use is ≤ 24 px (0.6 wall 9.6, outline 4, `cornerJoined` 24). The only separating window — [34, 47) px by rectangles, [41.8, 54.7) px by axes, 2.1–3.4 walls — is fitted to one house; the same snap closes the rear terrace under the pergola |
| polygonization | the band axes leave the rear pieces as dangles; no projection face exists |
| union of band rectangles | a 34 px gap (y 209 → 243) on each side; no closed ring |
| any of the above | the face exists only if the **4.01 m door (a 138 px hole in the rear wall)** is a closing segment for the outline — a semantic gap decision (on which the incumbent's two classifiers already disagree) that no geometry kernel makes. The verdict rests on the measured pier/band miss and the snap window; the door argument is supporting |

The grid the decomposition floods is already a fully noded arrangement and its flood is a correct face labelling. The missing
evidence is upstream (two pier blocks never became bands; a callout never read) and the deciding rule is semantic (gap class,
extent margin). Two documented negatives (rear pergola/terrace in this house; the development rows' covered terraces —
dabecjach 74.9 / 41.1 m², marcowki 7.0 / 11.0 m², jarzabem 12.6 m², willa-miranda 10.1 m² — and the synthetic carport /
detached-garage / detached-shed fixtures) are exactly what a naive polygonize-or-union would close: "a mathematically
closed polygon is not evidence of a closed garage".

## Per-candidate disposition (005O)

| candidate | 005O status | why |
| --- | --- | --- |
| JTS / JSTS | **INSPECTED / NOT_RUN** | no noding/polygonization/dangle operation is on the failing path (above); 005G already TESTED it as a union oracle (35/35 order-invariant, RESEARCH_ONLY) |
| Clipper2 / polygon-clipping / polyclip-ts | **DEFER (not run)** | the envelope uses no vector boolean or offset (005G §F); no polygon boolean defect is demonstrated here. Material wall footprint and compartment closure stay separate questions |
| OpenCV / LSD / EDLines / ELSED | **not reopened** | the missing primitive is a short wall-thick pier block (aspect 3.1), not a line segment; 005I measured 0.00 m unique ink-supported wall for ELSED/DeepLSD on 7 houses |
| PDF.js / PDFium | **not on the failing path; DEFER** | post-review T1: 7/44 sealed packages (DobreDomy rows, generic adapter) record 14 fetched PDF + 7 DWG building-outline documents (1:500); 005G already TESTED PDF.js on two of them (PILOT). The ARCHON adapter records no documents, so none of the three failing houses has one recorded; whether their pages offer one is not measured |
| R2V / CubiCasa / Raster2Seq | **INSPECTED (licence) only** | no training or embedding in 005O; licences as 005G (R2V data research-only, CubiCasa CC BY-NC, Raster2Seq data terms) |
| PP-OCRv6 tiny (already shipped) | **TESTED (re-read)** | see the metric bake-off; not an adoption — it is in APK 1212, model / WASM byte-identical |

## What a future stage could do (not recommended as 005O's one next step)

An EXTENT stage would start from the band extractor's handling of short wall-thick blocks and the reading of callouts printed
over wide doors — with its own negative controls (pergola posts, covered terraces, carports) — not from a geometry kernel.
