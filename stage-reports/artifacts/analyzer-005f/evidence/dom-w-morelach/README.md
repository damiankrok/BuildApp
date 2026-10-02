# Evidence pack — dom-w-morelach

Source: https://www.archon.pl/projekty-domow/projekt-dom-w-morelach-n-ver-2-m95a1f6e528ef4; package 16fe10e5839cec2d7279f17663eacabb6d2d96b97e46808be9c15553e124137c.
Result: COMPLETED, model c3eb20a9727b5cb15861791c7253ad571f290c6035407cabc227189339b9119b.
Selected plan frame: frame-asset-rzut-63ae7d4e86-027bb2e82d — metric CONFIRMED / INCONCLUSIVE, 1.989028 cm/px.

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
