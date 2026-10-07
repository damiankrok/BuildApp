# Evidence pack — h2-dom-w-cieszyniankach

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-cieszyniankach-12-ge-m43d25c0636969; package 63034b633b353f90f9a7f6dad38f47f993ffba78500f4b803c267a26e22c2324.
Result: COMPLETED, model a96afbb19139b304a126b87dd0949ac1604aaad006973ce0dcddb4472cbb1ad3.
Selected plan frame: frame-asset-rzut-ebb40feeba-0459d5961d — metric REPLACED / STRONG, 2.773458 cm/px.

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
