/**
 * 005Y-N4 (E) research driver: build the AI_SECOND_LOOK questions for the ambiguities the deterministic reader flagged
 * on the development houses, and ask them through the production `secondLook` with the live provider.
 *
 * Crops are cut from the private decoded sources (outside the worktree) and written only to `--out` (outside the
 * worktree); this script prints and records hashes, rectangles and readings — never pixels. Without the owner's
 * consent (BUILDAPP_AI_SECOND_LOOK_CONSENT=owner) and credentials, every question records AI_SECOND_LOOK_LIVE_NOT_RUN
 * and nothing leaves the machine.
 *
 *   npx vite-node research/analyzer-005y-n4/second-look-run.ts -- <questions.json> <out-dir>
 *   questions.json: [{ id, ambiguity, house, assetId, assetByteHash, png, ring: {x0,y0,x1,y1}, hypotheses: [{id,text}], cv }]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { createHash } from 'node:crypto'
import { anthropicVisionReasoner, secondLook, secondLookLine } from '@buildapp/source-vision'

type Q = { id: string; ambiguity: string; house: string; assetId: string; assetByteHash: string; png: string; ring: { x0: number; y0: number; x1: number; y1: number }; hypotheses: Array<{ id: string; text: string }>; cv: { hypothesisId: string | null; why: string } }
const [questionsPath, out] = process.argv.slice(2).filter((a) => a !== '--')
mkdirSync(out, { recursive: true })
const questions = JSON.parse(readFileSync(questionsPath, 'utf8')) as Q[]
const consent = process.env.BUILDAPP_AI_SECOND_LOOK_CONSENT === 'owner'
const reasoner = anthropicVisionReasoner()
const records = []
for (const q of questions) {
  const src = PNG.sync.read(readFileSync(q.png))
  const pad = 12
  const x0 = Math.max(0, q.ring.x0 - pad)
  const y0 = Math.max(0, q.ring.y0 - pad)
  const x1 = Math.min(src.width - 1, q.ring.x1 + pad)
  const y1 = Math.min(src.height - 1, q.ring.y1 + pad)
  const crop = new PNG({ width: x1 - x0 + 1, height: y1 - y0 + 1 })
  PNG.bitblt(src, crop, x0, y0, crop.width, crop.height, 0, 0)
  const bytes = PNG.sync.write(crop)
  writeFileSync(join(out, `${q.id}.png`), bytes)
  const record = await secondLook(
    { id: q.id, ambiguity: q.ambiguity, source: { assetId: q.assetId, assetByteHash: q.assetByteHash, cropRectPx: { x0, y0, x1, y1 } }, crop: { bytes, byteHash: createHash('sha256').update(bytes).digest('hex'), mediaType: 'image/png', width: crop.width, height: crop.height }, hypotheses: q.hypotheses, cv: q.cv },
    reasoner,
    { ownerConsent: consent },
  )
  records.push({ house: q.house, ambiguity: q.ambiguity, hypotheses: q.hypotheses, cropRectPx: { x0, y0, x1, y1 }, ...record })
  console.log(`${q.house} ${q.id}: ${secondLookLine(record)}`)
}
writeFileSync(join(out, 'second-look-records.json'), JSON.stringify(records, null, 2))
