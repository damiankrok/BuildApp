# Evidence pack — new

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-tymianku-5-t-m82a207b1b6d72; package 3c79178fdaf459eb756d555e4fbd9e59855fc744532dd75a446f76461428cb17.
Result: COMPLETED, model 681a38257d7eedf5341b6211f1dbbb9643ce1487bb839a8f8f0bd2bb6cda19c9.
Selected plan frame: frame-asset-rzut-360da4c58d-2b0ad412cf — metric REPLACED / STRONG, 2.376336 cm/px.

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
