# Evidence pack — new

Source: https://www.archon.pl/projekty-domow/projekt-dom-miniaturka-2-ver-3-m4c723a6c22f61; package 657962ffa4acfdbc71f5f3517f218b2c4ea4e8f35bb6042732f7c25b9c8ac37a.
Result: COMPLETED, model cbe3a5fca94b15427d9db34968060678d4b821a92fde62fbfb49431dbf68d8e0.
Selected plan frame: frame-asset-rzut-3da149ce7e-6d4f61a890 — metric CONFIRMED / STRONG, 2.088965 cm/px.

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
