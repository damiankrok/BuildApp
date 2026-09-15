/**
 * Debug overlays.
 *
 * An observation graph is a JSON document, and a JSON document is exactly the
 * wrong way to find out that a "roof edge" is really a fence in the
 * foreground. So every analysed drawing gets an SVG with the source image
 * underneath it and every observation drawn on top, colour-coded by what it
 * claims to be, with the evidence in a tooltip. Opening one in a browser and
 * looking at it is the fastest way to disbelieve this pipeline, which is the
 * point.
 *
 * The image is embedded as a data URI so an overlay is one self-contained
 * file that survives being copied out of the repository.
 */
import type { SourceCoordinateFrame, SourceObservation } from '@buildapp/source-observations'
import { pixelPoints } from '@buildapp/source-observations'

const PALETTE: Record<string, string> = {
  SILHOUETTE: '#1d4ed8',
  PROFILE: '#1d4ed8',
  MASS_REGION: '#64748b',
  WALL_REGION: '#0f766e',
  WALL_BAND: '#0f766e',
  WALL_AXIS: '#0f766e',
  ROOF_REGION: '#b45309',
  ROOF_EDGE: '#b45309',
  RIDGE: '#c2410c',
  EAVE: '#b45309',
  OPENING: '#7c3aed',
  OPENING_INTERVAL: '#7c3aed',
  WINDOW: '#7c3aed',
  DOOR: '#6d28d9',
  BALCONY: '#be123c',
  LOGGIA: '#be123c',
  RAILING: '#e11d48',
  LINEAR_VOLUME_CANDIDATE: '#dc2626',
  SURFACE_REGION: '#a1a1aa',
  STAIR: '#047857',
  STAIR_SYMBOL: '#047857',
  PARALLEL_LINE_FAMILY: '#0369a1',
  LEVEL_DATUM: '#0369a1',
  POLYLINE: '#047857',
  DEFAULT: '#334155',
}

const colourOf = (o: SourceObservation): string => PALETTE[o.kind] ?? PALETTE.DEFAULT

const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function shapeOf(o: SourceObservation): string {
  const stroke = colourOf(o)
  const width = o.kind === 'SILHOUETTE' ? 3 : 2
  const dash = o.provenance.extractor === 'VISION_MODEL' ? ' stroke-dasharray="6 4"' : ''
  const opacity = 0.35 + o.confidence * 0.6
  const g = o.pixelGeometry
  const common = `fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity.toFixed(2)}"${dash}`
  switch (g.type) {
    case 'POINT':
      return `<circle cx="${g.point.x}" cy="${g.point.y}" r="5" fill="${stroke}" fill-opacity="${opacity.toFixed(2)}" />`
    case 'SEGMENT':
      return `<line x1="${g.a.x}" y1="${g.a.y}" x2="${g.b.x}" y2="${g.b.y}" ${common} />`
    case 'POLYLINE':
      return `<polyline points="${g.points.map((p) => `${p.x},${p.y}`).join(' ')}" ${common} />`
    case 'POLYGON':
      return `<polygon points="${g.points.map((p) => `${p.x},${p.y}`).join(' ')}" ${common} />`
    case 'RECT':
      return `<rect x="${Math.min(g.rect.x0, g.rect.x1)}" y="${Math.min(g.rect.y0, g.rect.y1)}" width="${Math.abs(g.rect.x1 - g.rect.x0)}" height="${Math.abs(g.rect.y1 - g.rect.y0)}" ${common} />`
    case 'LINE_FAMILY':
      return g.lines.map((l) => `<line x1="${l.a.x}" y1="${l.a.y}" x2="${l.b.x}" y2="${l.b.y}" ${common} />`).join('')
  }
}

export type OverlayOptions = {
  /** The drawing itself, as a data URI. Omitted, the overlay is shapes on white. */
  imageDataUri?: string
  /** Draw only these kinds. */
  kinds?: readonly string[]
  title?: string
}

export function overlaySvg(frame: SourceCoordinateFrame, observations: readonly SourceObservation[], options: OverlayOptions = {}): string {
  const shown = observations.filter((o) => o.frameId === frame.id && (options.kinds === undefined || options.kinds.includes(o.kind)))
  const { width, height } = frame.size
  const legendKinds = [...new Set(shown.map((o) => o.kind))].sort()
  const legendHeight = 18 * legendKinds.length + 34
  const body = shown
    .map((o) => {
      const pts = pixelPoints(o.pixelGeometry)
      const label = `${o.kind}${o.semanticHints.length > 0 ? ` [${o.semanticHints.join(', ')}]` : ''} — confidence ${o.confidence}, ±${o.uncertainty.positionPx}px\n${o.provenance.name}: ${o.provenance.detail}`
      return `<g><title>${escapeXml(label)}</title>${shapeOf(o)}${pts.length > 0 ? `<text x="${pts[0].x + 4}" y="${pts[0].y - 4}" font-size="9" fill="${colourOf(o)}" opacity="0.85">${escapeXml(o.semanticHints[0] ?? o.kind.toLowerCase())}</text>` : ''}</g>`
    })
    .join('\n')

  const legend = legendKinds
    .map((kind, i) => {
      const count = shown.filter((o) => o.kind === kind).length
      return `<g transform="translate(10, ${28 + i * 18})"><rect width="12" height="12" fill="${PALETTE[kind] ?? PALETTE.DEFAULT}" /><text x="18" y="10" font-size="11" fill="#111">${escapeXml(kind)} (${count})</text></g>`
    })
    .join('\n')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + legendHeight}" viewBox="0 0 ${width} ${height + legendHeight}">`,
    `<rect width="${width}" height="${height + legendHeight}" fill="#ffffff" />`,
    options.imageDataUri ? `<image href="${options.imageDataUri}" x="0" y="0" width="${width}" height="${height}" />` : '',
    body,
    `<g transform="translate(0, ${height})"><rect width="${width}" height="${legendHeight}" fill="#f8fafc" stroke="#e2e8f0" />`,
    `<text x="10" y="18" font-size="12" font-weight="600" fill="#111">${escapeXml(options.title ?? `${frame.roles.document} / ${frame.roles.view} / ${frame.roles.storey} — ${shown.length} observations`)}</text>`,
    legend,
    '</g>',
    '<!-- dashed outlines are observations from a vision model; solid outlines are from a deterministic extractor -->',
    '</svg>',
  ]
    .filter((s) => s !== '')
    .join('\n')
}

/** A data URI for a drawing's own bytes, so an overlay is a single self-contained file. */
export const imageDataUri = (bytes: Uint8Array, mediaType: string): string => `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`
