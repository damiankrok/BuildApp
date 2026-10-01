# Evidence pack — kosacce-area-copy-alone

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-kosaccach-46-mf6628752fa61f; package 39820e75f62340bf3224e6af9c7e5dac9f489f437847c5d6cb64736182f16079.
Result: FAILED, PLAN_RESOLUTION_INCONCLUSIVE.
Selected plan frame: frame-asset-rzut-94f54ada01-bdf7aa09e8.

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
