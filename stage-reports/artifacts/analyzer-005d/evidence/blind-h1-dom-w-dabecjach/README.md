# Evidence pack — h1-dom-w-dabecjach

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-dabecjach-2-g2-m1d2240bad8ffb; package 6402321e688d3716987ab8053beced8f8f21abc1fa8f80e8526a43550b41f8bd.
Result: FAILED, BOUNDARY_RESOLUTION_INCONCLUSIVE.
Selected plan frame: frame-asset-rzut-1a56066c62-10b0ec4131 — metric CONFIRMED / STRONG, 2.672148 cm/px.

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
