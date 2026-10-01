# Evidence pack — dom-w-modrzykach

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-modrzykach-3-g2-mdf423d61e7247; package ef8d5c6e7d5e09ed6c4df154a4c64d7e9115022755eafa97901e419d0132ada2.
Result: COMPLETED, model d4accc9d3e6a0675495c131dd46ef29b8faaaee92656ea2de53cad8894073301.
Selected plan frame: frame-asset-rzut-fb7476d8f1-6827e718fe — metric REPLACED / STRONG, 2.748392 cm/px.

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
