# Evidence pack — willa-miranda

Source: https://www.archon.pl/projekty-domow/projekt-willa-miranda-11-g2-m49324d69ef143; package 787dca045663163e4bbfc519320f51068c48111a8ed59c16db197a257738cf01.
Result: COMPLETED, model 1ce47cfbbdb50393ddc47b2a15bdf76701b9130d82469964634aed72c636821d.
Selected plan frame: frame-asset-rzut-73ee27c4b6-7102a805c6 — metric CONFIRMED / SUPPORTED, 2.680947 cm/px.

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
