/**
 * v3.54.11 (D53) — a finish zone reaches the physical element whose face it covers: a portal band (its FASCIA members)
 * takes the zone's material as a whole member; the light gable frame and the other members keep theirs; two finishes
 * that each cover the face are a conflict, not a choice; the house's check measures the band's own members.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileHouse } from '../src/house/describe.js'
import type { CompiledHouse } from '../src/house/describe.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any
const ROOT = join(__dirname, '..', '..', '..')
const el = (doc: Doc, id: string): Doc => doc.observations.elevations.find((e: Doc) => e.id === id)
function gableFront(): Doc {
  const doc: Doc = JSON.parse(readFileSync(join(ROOT, 'research/source-to-model/v3544/manual/gracja.house.json'), 'utf8'))
  const o = doc.observations
  o.roofs.find((r: Doc) => r.bodyId === 'main').ridge = 'FRONT_TO_BACK'
  for (const e of o.elevations) {
    e.features = []
    e.openings = e.openings.filter((x: Doc) => x.id !== 'bd1')
    e.bodies.find((x: Doc) => x.bodyId === 'main').eavesY = null
  }
  return doc
}
// the front elevation of the fixture: 0.0329 m/px, ground at row 298; a band over the open front at rows 205–228
const PORTAL = { id: 'portal', kind: 'PORTAL_BAND', box: { x0: 316, y0: 205, x1: 603, y1: 228 }, bodyId: 'main' }
const FRAME = { id: 'frame', kind: 'GABLE_FRAME', box: { x0: 126, y0: 45, x1: 424, y1: 298 }, bodyId: 'main', bandPx: 10, legPx: 8 }
const DARK = { id: 'zd', material: 'PLASTER', tone: 'DARK', box: { x0: 300, y0: 200, x1: 610, y1: 298 }, bodyId: 'main', certainty: 'CERTAIN' }
const bandMaterials = (h: CompiledHouse): string[] => [...new Set((h.built?.model.linearSolids ?? []).filter((x) => x.role === 'FASCIA' && x.id.startsWith('portal-')).map((x) => x.materialId))]
const check = (h: CompiledHouse) => h.document.verification.checks.find((c) => c.id === 'facade-values-built')

describe('v3.54.11 a finish zone over a portal band is the band\'s material', () => {
  it('cause: a dark zone over the band\'s face makes the whole band dark; the frame stays light; the check measures the band\'s own members', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push(PORTAL, FRAME)
    el(doc, 'el-front').zones = [DARK]
    const h = compileHouse(doc, 't')
    const p = h.document.geometry?.portals[0]
    expect(p?.finish).toMatchObject({ material: 'PLASTER', tone: 'DARK', basis: 'DERIVED' })
    expect(bandMaterials(h)).toEqual(['mat-zone-plaster-dark'])
    // the gable frame is not a portal: it keeps the light member material
    const frameParts = (h.built?.model.linearSolids ?? []).filter((x) => !x.id.startsWith('portal-'))
    expect(frameParts.every((x) => x.materialId !== 'mat-zone-plaster-dark')).toBe(true)
    expect(check(h)?.status).toBe('PASS')
    expect(check(h)?.what).toContain('soffit, top, finish')
  })
  it('counter: with no zone over its face the band keeps the light member material (no rule paints every member)', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push(PORTAL)
    el(doc, 'el-front').zones = [{ ...DARK, box: { x0: 300, y0: 240, x1: 610, y1: 298 } }]
    const h = compileHouse(doc, 't')
    expect(h.document.geometry?.portals[0]?.finish).toBeUndefined()
    expect(bandMaterials(h)).toEqual(['mat-member'])
  })
  it('counter: two finishes that each cover the band\'s face are a conflict, said; no finish is chosen', () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push(PORTAL)
    el(doc, 'el-front').zones = [DARK, { ...DARK, id: 'zw', material: 'WOOD', tone: 'WARM' }]
    const h = compileHouse(doc, 't')
    expect(h.document.geometry?.portals[0]?.finish).toBeUndefined()
    expect(h.document.verification.knownDefects.some((k) => k.code === 'ELEMENT_FINISH_CONFLICT')).toBe(true)
    expect(bandMaterials(h)).toEqual(['mat-member'])
  })
  it('a zone read on one body that lies on a wall of another body is said (ZONE_BODY_SPAN), never silently taken', () => {
    const doc = gableFront()
    el(doc, 'el-front').zones = [{ ...DARK, bodyId: 'garage', box: { x0: 130, y0: 230, x1: 300, y1: 298 } }]
    const h = compileHouse(doc, 't')
    const z = h.document.geometry?.zones ?? []
    expect(z.length).toBeGreaterThan(0)
    expect(z.every((q) => q.bodyRead === 'garage')).toBe(true)
    expect(z.some((q) => q.bodyOfWall === 'main')).toBe(true)
    expect(h.document.verification.knownDefects.some((k) => k.code === 'ZONE_BODY_SPAN')).toBe(true)
  })
  it('the band\'s finish survives save and load of the house document and of the model', async () => {
    const doc = gableFront()
    el(doc, 'el-front').features.push(PORTAL)
    el(doc, 'el-front').zones = [DARK]
    const h = compileHouse(doc, 't')
    const { parseHouseDocument } = await import('@buildapp/reconstruction')
    const { parseModel, serializeModel } = await import('@buildapp/model')
    const re = parseHouseDocument(JSON.parse(JSON.stringify(h.document)))
    expect(re.ok).toBe(true)
    if (re.ok) expect(re.document.geometry?.portals[0]?.finish).toEqual(h.document.geometry?.portals[0]?.finish)
    const m = parseModel(serializeModel(parseModel(h.modelJson as string)))
    expect([...new Set(m.linearSolids.filter((x) => x.id.startsWith('portal-')).map((x) => x.materialId))]).toEqual(['mat-zone-plaster-dark'])
  })
})
