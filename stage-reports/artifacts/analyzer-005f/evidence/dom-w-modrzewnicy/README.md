# Evidence pack — dom-w-modrzewnicy

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-modrzewnicy-10-g2e-oze-m8a12761847734; package 5769fc42b7f1b8f4d7da6c57432b78f6eed41882feb53865c3263bb92309931d.
Result: FAILED, METRIC_RESOLUTION_INCONCLUSIVE.
Selected plan frame: frame-asset-rzut-8d59c92ec1-b1cad0f4fa — metric NO_SCALE / INCONCLUSIVE, ? cm/px.

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
