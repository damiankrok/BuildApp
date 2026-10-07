# Evidence pack — h1-dom-w-murajach

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-murajach-mfc224c195bead; package 7507703249676e45ab5b96a85b6688e5030f2d5c3cb87443330afce5772c2c47.
Result: FAILED, METRIC_RESOLUTION_INCONCLUSIVE.
Selected plan frame: frame-asset-rzut-44d6d1166d-006f85ed53 — metric LEGACY_UNCONFIRMED / INCONCLUSIVE, 1.53235 cm/px.

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
