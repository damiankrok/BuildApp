/** Council A (research only): every plan frame's metric registration, side by side per storey (same drawing, different copies). */
import { HOUSES, loadHouse } from './corpus.js'
for (const h of process.argv[2] ? [process.argv[2]] : HOUSES) {
  const { graph, metrics } = await loadHouse(h)
  const frames = graph.coordinateFrames.filter((f: any) => f.roles.document === 'FLOOR_PLAN')
  for (const f of frames.sort((a: any, b: any) => a.roles.storey.localeCompare(b.roles.storey) || b.size.width - a.size.width)) {
    const reg = metrics.coordinateRegistrations.find((r: any) => r.frameId === f.id && r.plane === 'PLAN_XZ')
    const sol = (metrics.metricSolutions ?? []).find((s: any) => s.frameId === f.id)
    const cmpp = reg ? (reg.metresPerPixelX * 100).toFixed(3) : '-'
    // the house's width on that sheet in metres if the copies are the same drawing: mpp normalised to the 853 sheet
    const norm = reg ? ((reg.metresPerPixelX * f.size.width) / 853 * 100).toFixed(3) : '-'
    console.log(`${h.padEnd(10)} ${f.roles.storey.padEnd(6)} ${f.roles.annotation.padEnd(11)} ${String(f.size.width).padStart(4)} cm/px=${cmpp.padStart(6)} (as-if-853: ${norm}) anchors=${reg?.anchors.length ?? '-'} rmsM=${reg?.residual.rmsM ?? '-'} conf=${reg?.confidence ?? '-'} chains=${metrics.chains.filter((c: any) => c.frameId === f.id).length} ${f.id.slice(-24)}`)
  }
}
