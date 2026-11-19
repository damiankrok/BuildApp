/**
 * v3.54.15 — recorded elevation answers through the current canonicalization (0 USD): the fate of every element and
 * the completeness, beside the v3.54.14 sketch the same answer gave.
 *   npx vite-node research/source-to-model/v35415/replay-sketch-account.ts -- <sketch-turns.json> <v35414 sketches.json> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { canonicalizeElevationAnswer } from '../../../packages/analysis-service/src/appearance/elevation-sketch.js'

const [turnsPath, oldPath, out] = process.argv.slice(2).filter((a) => a !== '--')
const turns = JSON.parse(readFileSync(turnsPath, 'utf8')) as Array<{ turn: { content: Array<{ type: string; name?: string; input?: unknown }>; stopReason?: string; model: string } }>
const old = JSON.parse(readFileSync(oldPath, 'utf8')) as { reading: { sketches: Array<{ facade: string; frameId: string; sketch?: { source: { width: number; height: number; scale: number; imageSha256: string }; walls: unknown[]; openings: unknown[]; roofs: unknown[] } }> } }
const rows = turns.map((t, i) => {
  const o = old.reading.sketches[i]
  const src = o?.sketch?.source
  if (!src) return { i, facade: o?.facade, skipped: 'no v35414 sketch to take the picture size from' }
  const raw = t.turn.content.find((b) => b.type === 'tool_use' && b.name === 'report_elevation')?.input
  const c = canonicalizeElevationAnswer({ raw, stopReason: t.turn.stopReason, frameId: o.frameId, picture: { width: Math.floor(src.width / src.scale), height: Math.floor(src.height / src.scale), scale: src.scale, sha256: src.imageSha256 }, frame: { width: src.width, height: src.height }, model: t.turn.model })
  return { i, facade: o.facade, before: { walls: o.sketch?.walls.length, openings: o.sketch?.openings.length, roofs: o.sketch?.roofs.length }, after: c.sketch ? { walls: c.sketch.walls.length, openings: c.sketch.openings.length, roofs: c.sketch.roofs.length } : null, completeness: c.account.completeness, reasons: c.account.reasons, fates: c.account.elements.map((e) => `${e.path}:${e.fate}/${e.form}${e.reason ? ` ${e.reason}` : ''}`), failed: c.failed ?? null }
})
writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`)
for (const r of rows) process.stdout.write(`${JSON.stringify({ i: r.i, facade: r.facade, before: (r as { before?: unknown }).before, after: (r as { after?: unknown }).after, completeness: (r as { completeness?: unknown }).completeness, reasons: (r as { reasons?: unknown }).reasons })}\n`)
