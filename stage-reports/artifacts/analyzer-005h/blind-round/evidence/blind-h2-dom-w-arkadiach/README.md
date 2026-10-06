# Evidence pack — h2-dom-w-arkadiach

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-arkadiach-6-m168264238cc55; package 1c5051d47f28789e15bad1c8f7caa6db4b6d7adbbe1701779882e39464b6af03.
Result: COMPLETED, model a1ac7a1b67b195839e7150e1da7a508b4b583d266a96d10b9c9322deae1f10b7.
Selected plan frame: frame-asset-rzut-16680ee739-bb2ced8b98 — metric CONFIRMED / STRONG, 1.8454 cm/px.

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
