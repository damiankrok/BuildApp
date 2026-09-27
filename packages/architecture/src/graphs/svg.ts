/**
 * A plan-view SVG of roof graphs: a developer artifact, not a viewer.
 *
 * Planes are filled by pitch (paler is flatter), edges are drawn by kind in
 * a fixed, legible colour each, dormer cuts and roof openings are dashed,
 * and every plane and edge is labelled with its id. The output is
 * deterministic text: the same model always writes the same bytes.
 */
import type { RoofGraph, RoofGraphEdge } from './roof-graph.js'

const EDGE_STYLE: Record<string, { color: string; width: number; dash?: string }> = {
  RIDGE: { color: '#b3261e', width: 3 },
  HIP: { color: '#d9822b', width: 2.5 },
  VALLEY: { color: '#1f5fbf', width: 3 },
  VERGE: { color: '#2e7d32', width: 2 },
  EAVE: { color: '#212121', width: 2 },
  ROOF_STEP: { color: '#6a1b9a', width: 3, dash: '6 3' },
  BOUNDARY: { color: '#757575', width: 1.5 },
  ABUTMENT: { color: '#8d6e63', width: 2, dash: '4 2' },
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const n = (v: number): string => (Math.round(v * 100) / 100).toFixed(2)

/** One SVG for a set of roof graphs (one model). */
export function roofGraphSvg(title: string, graphs: readonly RoofGraph[]): string {
  const pts = graphs.flatMap((g) => [...g.planes.flatMap((p) => p.boundary), ...g.openings.flatMap((o) => o.outline)])
  if (pts.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80"><text x="10" y="40" font-family="sans-serif" font-size="14">${esc(title)}: no roof</text></svg>\n`
  const minX = Math.min(...pts.map((p) => p.x))
  const maxX = Math.max(...pts.map((p) => p.x))
  const minZ = Math.min(...pts.map((p) => p.z))
  const maxZ = Math.max(...pts.map((p) => p.z))
  const scale = 560 / Math.max(maxX - minX, maxZ - minZ, 1)
  const pad = 30
  const legendH = 110
  const W = (maxX - minX) * scale + pad * 2
  const H = (maxZ - minZ) * scale + pad * 2 + legendH
  // plan with the front facade at the bottom: z grows up the page
  const X = (x: number): string => n(pad + (x - minX) * scale)
  const Y = (z: number): string => n(pad + (maxZ - z) * scale)
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}" height="${n(H)}" viewBox="0 0 ${n(W)} ${n(H)}" font-family="sans-serif">`)
  out.push(`<rect width="100%" height="100%" fill="#fbfaf8"/>`)
  out.push(`<text x="${pad}" y="18" font-size="13" font-weight="bold">${esc(title)}</text>`)
  // a dormer's own roof stands over its host's: draw host roofs first, local roofs over them, edges over every plane
  const ordered = [...graphs.filter((g) => !g.localRoofOf), ...graphs.filter((g) => g.localRoofOf)]
  for (const g of ordered) {
    for (const p of g.planes) {
      const shade = Math.round(235 - Math.min(60, p.pitchDeg) * 1.6)
      const fill = `rgb(${shade},${shade - 4},${shade - 10})`
      out.push(`<polygon points="${p.boundary.map((q) => `${X(q.x)},${Y(q.z)}`).join(' ')}" fill="${fill}" stroke="#9e9e9e" stroke-width="0.8"><title>${esc(`${p.id} ${p.pitchDeg}°`)}</title></polygon>`)
      const cx = p.boundary.reduce((s, q) => s + q.x, 0) / p.boundary.length
      const cz = p.boundary.reduce((s, q) => s + q.z, 0) / p.boundary.length
      out.push(`<text x="${X(cx)}" y="${Y(cz)}" font-size="9" text-anchor="middle" fill="#37474f">${esc(p.id)} · ${n(p.pitchDeg)}°</text>`)
      // fall arrow
      if (p.pitchDeg > 0) out.push(`<line x1="${X(cx)}" y1="${Y(cz) }" x2="${X(cx + p.downslope.x * 0.6)}" y2="${Y(cz + p.downslope.z * 0.6)}" stroke="#37474f" stroke-width="1" marker-end="url(#fall)"/>`)
    }
  }
  for (const g of ordered) {
    for (const o of g.openings) out.push(`<polygon points="${o.outline.map((q) => `${X(q.x)},${Y(q.z)}`).join(' ')}" fill="none" stroke="${o.kind === 'DORMER' ? '#1f5fbf' : '#424242'}" stroke-width="1.2" stroke-dasharray="4 2"><title>${esc(`${o.id} ${o.kind}`)}</title></polygon>`)
    const edges: RoofGraphEdge[] = [...g.ridges, ...g.hips, ...g.valleys, ...g.verges, ...g.eaves, ...g.steps, ...g.boundaries]
    for (const e of edges) {
      const st = EDGE_STYLE[e.kind] ?? EDGE_STYLE.BOUNDARY
      out.push(`<line x1="${X(e.start.x)}" y1="${Y(e.start.z)}" x2="${X(e.end.x)}" y2="${Y(e.end.z)}" stroke="${st.color}" stroke-width="${st.width}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}><title>${esc(`${e.id} ${e.kind} ${e.planeIds.join('/')}`)}</title></line>`)
    }
  }
  out.push(`<defs><marker id="fall" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#37474f"/></marker></defs>`)
  const ly = H - legendH + 16
  const kinds = Object.keys(EDGE_STYLE)
  kinds.forEach((k, i) => {
    const x = pad + (i % 4) * 140
    const y = ly + Math.floor(i / 4) * 20
    const st = EDGE_STYLE[k]
    out.push(`<line x1="${x}" y1="${y}" x2="${x + 28}" y2="${y}" stroke="${st.color}" stroke-width="${st.width}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/><text x="${x + 34}" y="${y + 4}" font-size="10">${k.toLowerCase().replace('_', ' ')}</text>`)
  })
  const summary = graphs.map((g) => `${g.id}: ${g.classification}${g.derivedClassification !== g.classification ? ` (reads as ${g.derivedClassification})` : ''}, ${g.planes.length} planes, ${g.ridges.length} ridges, ${g.hips.length} hips, ${g.valleys.length} valleys, ${g.dormers.length} dormers`).join(' | ')
  out.push(`<text x="${pad}" y="${n(H - 20)}" font-size="10" fill="#37474f">${esc(summary)}</text>`)
  out.push('</svg>')
  return `${out.join('\n')}\n`
}
