# 005G — PDF / vector evidence probe

**Inputs: the PDFs the sealed 005C packages already record, nothing new.**
- Aster VIII's 1:500 building-outline PDF, base (`14189ed5…`) and mirrored (`6cc483df…`).
- Galaktyka I's 1:500 outline PDF (`149b0799…`): a second public technical PDF from the same sealed evidence.

The bytes came from the 005C byte cache, outside the worktree, and each was checked against the SHA-256 its package
recorded. **No PDF byte, page raster or glyph is committed.** The numbers are in `pdf-vector-probe.json`. The
scripts are `research/analyzer-005g/pdf-probe.mjs`, `pdf-outline.mjs` and `pdf-outlined-text.mjs`.

## What PDF.js reads (pdfjs-dist 4.8.69, legacy build, no rendering)

| | Aster VIII base | Aster VIII mirrored | Galaktyka I base |
| --- | --- | --- | --- |
| producer | Ghostscript 8.15 / PScript5 | same | same |
| page | A4 portrait 209.9 × 297 mm, rotate 0 | same | same |
| text items (non-empty) | **28** — real text with positions, font size and direction | 29 | **0** — every glyph is a filled path |
| "1:500" as text | yes, at (502.32, 96.56) pt | yes | no (outlined) |
| scale bar | labels 0 … 30 and "[m]" as text, ticks as strokes | same | outlined labels, ticks as strokes |
| operators | 642 (278 paths, 177 strokes, 99 fills, 19 text runs, 0 images) | similar | 2 033 (1 012 paths, 957 even-odd fills, 0 text) |
| vector segments | 12 644 (1 553 axis-aligned) | similar | 19 401 |
| parse time | 381 ms (Node 18.20.4), 354 ms (Node 22) | similar | 307 ms |

## Can scale, dimensions and outline be read directly?

**Scale: yes when the PDF carries text, through two independent witnesses.**
- *The stated scale.* The text item "1:500".
- *The scale bar measured as geometry.* For each of the seven label centres, find the tick stroke under it and fit
  metres per point by least squares (seven ticks).
  - Fit: **0.176393 m/pt**, i.e. 1:500.0, maximum residual **0.009 m**.
  - Against the stated scale: relative difference **3 × 10⁻⁵**, on both Aster files.
- *Why this is safe evidence.* It is non-circular: neither witness uses the drawing it scales. It is also exact:
  vector coordinates involve no OCR and no pixel rounding. Aster's floor-plan images print no dimension at all, which
  is why Aster stopped `METRIC_RESOLUTION_INCONCLUSIVE` in 005C (§R), so this PDF is the only metric source it has.

**Scale on an outlined-text PDF (Galaktyka): no from PDF.js alone, yes with a recogniser.**
- PDF.js and PDFBox both extract 0 text items.
- Rasterising the filled glyph paths of two regions with a 30-line even-odd scanline (6 px/pt, no PDF renderer, no
  canvas) and reading them with the pinned PP-OCRv6 tiny model gives:
  - **"0 5 10 15 20 25 30 [m]"** (mean char p 0.957);
  - **"1:500"** (0.9998).
- The regions were placed from the shared publisher template. Finding the glyph-path clusters generically is a
  grouping step (the same token rule `ocr.ts` uses on raster ink) that the integration stage would own.

**Dimensions: none to read.** These outline PDFs carry an outline, a scale bar and a title block, not dimension chains.

**Outline: the wall geometry is exact, but closing the envelope is still semantic.**
- Aster's walls are **one filled 40-vertex polygon**: 18.31 × 17.48 m by the scale bar, wall area 33.12 m². It is an
  open U. Every other line (the terrace or overhang double line, the step) is a thin stroke.
- An exterior-flood enclosure of the vector drawing at 8 px/pt gives:

  | lines that close | enclosed area |
  | --- | --- |
  | filled walls only | 33.05 m² (the walls enclose nothing: the U is open) |
  | filled walls and every stroke | 331.66 m² |
  | the page's published footprint, for comparison only | 278.3 m² |

- The truth lies between the two. Which line closes the open side is the resolver's decision, the same
  envelope-closure question 005C–005F answer for raster plans. A PDF gives that resolver **exact vector walls and an
  exact scale**. It does not answer the question.
- Base and mirrored files give the same figures to 0.01 m².

## Engines compared

| engine | result | verdict |
| --- | --- | --- |
| **PDF.js** (`pdfjs-dist` 4.8.69, Apache-2.0) | Text with positions, operator lists and paths, page geometry. Runs in one esbuild bundle (3.08 MB, 0.65 MB deflated, worker in-thread) on Node 18.20.4, including under the no-ICU shim. Outputs identical on Node 18 and Node 22. | **ADOPT_NEXT** (after the OCR stage — see `recommendation.md`) |
| **Apache PDFBox** 3.0.8 | Independent oracle: every Aster text item at the same position to 0.01 pt; Galaktyka also 0 text. On Android only through PdfBox-Android (stale since 2023), which would be a **second PDF pipeline**, JVM-only, that CI's Node analyzer does not run. | **REJECT** for production (parity); keep as a test oracle (**RESEARCH_ONLY**) |
| **PDFium** | Not needed: PDF.js lacked no capability these documents need (text, operators, paths; no rendering required). Native per-ABI binaries or a 4 MB WASM with licence-hygiene problems (`@hyzyla/pdfium`) and a continuous Chromium CVE stream. | **DEFER** |
| DWG / DXF | Not built (brief). Aster and Galaktyka also publish a DWG outline (hashed, `9631e137…`, `1bf2ae24…`). Future options, checked against the registries:
- LibreDWG and its WASM build `@mlightcad/libredwg-web` 0.7.14 are GPL-3.0: **reject**.
- ODA Teigha is commercial.
- For DXF: `dxf-parser` 1.1.2 (MIT, JS) and ezdxf 1.4.4 (MIT, Python, test oracle only).

A DWG reader would need a commercial SDK or a clean-room parser. | **DEFER** |

## Constraints the integration must keep

1. **Node 18 pins the PDF.js line.** 4.8.69 is the last release declaring Node ≥ 18; 4.9+ needs 20+, and 5.7+/6.x need
   22.13+. 4.8.69 has the CVE-2024-4367 fix and predates CVE-2026-16633's range, but it receives no further fixes.
   - Mitigation: parse with `isEvalSupported: false`, no scripting, no rendering, no fonts, and only PDFs that a
     `SourceDocument` claimed and hashed.
   - Upgrading nodejs-mobile's Node line is the lasting fix; that belongs to the runtime owner, not to this stage.
2. **A PDF fact is a document observation, never a model fact.** It carries `SOURCE_EXACT` and the document's
   SHA-256. The stated scale and the bar fit are two observations that must agree. The outline polygon is evidence for
   the envelope resolver, not the envelope.
3. **Install with `--omit=optional`.** `canvas` downloads a native binary at install and is never needed.
