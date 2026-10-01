# Evidence pack — dom-w-azaliach-005c

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-azaliach-3-ma6726144fab3e; package 349a08e9a6b85332cbdd4644422602e989f9dde172ccd0827e9d12bfde82e6ef.
Result: COMPLETED, model 2cfcc6e97af3d4b47f18200779fc86923b82297072c0d592dc35b4d7ff67ece0.
Selected plan frame: frame-asset-rzut-cbf8168d6d-79ba9b7966 — metric LEGACY_UNCONFIRMED / WEAK, 2.467836 cm/px.

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
