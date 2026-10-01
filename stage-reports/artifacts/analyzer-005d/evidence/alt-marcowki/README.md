# Evidence pack — alt-marcowki

Source: https://www.projektydomownowoczesnych.pl/p,m2fa281446a8ca,dom-w-marcowkach-ge; package 01f9a8800b8b92a04ffe27212c948075b1512bfa75b2e07a158f55ca33d44c43.
Result: FAILED, METRIC_RESOLUTION_INCONCLUSIVE.
Selected plan frame: frame-asset-dom-w-marcowkach-ge-rzut-parteru-d06c513af-7652519f02 — metric LEGACY_UNCONFIRMED / INCONCLUSIVE, 1.593003 cm/px.

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
