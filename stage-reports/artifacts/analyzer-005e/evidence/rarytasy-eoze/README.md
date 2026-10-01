# Evidence pack — rarytasy-eoze

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-e-oze-m738275b7537b0; package 95b42a613df30dd1b95d1f566f004872d93eb1be0dcd8fde99e6df4d00004aad.
Result: COMPLETED, model 75c4ea224908e9af59bf9790aacb4135b5809efc31714a9772f163bde3be16c1.
Selected plan frame: frame-asset-rzut-b747b42ad2-e3a3d0015d — metric REPLACED / STRONG, 2.222222 cm/px.

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
