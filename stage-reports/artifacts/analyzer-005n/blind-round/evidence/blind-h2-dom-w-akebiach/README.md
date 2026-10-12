# Evidence pack — out-2

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-akebiach-5-m44320b977e1a7; package 984194c59a4324b5f831ae71238ec04a5ec67840994ac91892c8f5695072e7d1.
Result: FAILED, PLAN_LAYOUT_REJECTED.
Selected plan frame: frame-asset-rzut-8984f3a30b-4d37f1b2ba — metric REPLACED / STRONG, 2.907284 cm/px.

Everything here is analyzer-owned: SVG primitives drawn in the frame’s own pixel coordinates (wall bands, dimension
lines, crossing marks, OCR boxes with the text the reader read, spans, extents, envelopes, bodies) and JSON. No
publisher drawing, crop, render or page is in this directory; assets are listed by address, SHA-256, size and pixels.

Read in this order: `evidence-summary.svg`, then `18-decision-timeline.json` (every decision, stage by stage, on a
stable object id), then the stage files `03`–`14`, each SVG with its JSON sidecar (ids, decisions, reasons,
alternatives, support and conflict ids). `17-evidence-trace.json` links marks to labels to spans to the scale to the
extent, envelope and masses. `manifest.json` names every version, hash and file.

Colours: tick green, questionable orange, rejected red; primary binding blue, alternative grey (dashed), ambiguous
purple; extent magenta; envelope cyan; built body green, unbuilt body orange.

To find where two runs part: `npm run -s evidence:diverge -- <pack A> <pack B>`.
