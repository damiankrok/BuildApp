/**
 * v3.54.21 — the stage's scenes: the fresh trial NEW-H first (three houses as post-trial DEV runs on the final code,
 * two as the first trial result), then the audit's counter-trial and the DEV replays on the final code. Sealed bytes;
 * failures, losses and the trial/DEV status named in each scene's own title or subtitle.
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding } from '@buildapp/geometry'
import { SCENES } from '../scripts/scenes.js'

const NEWH = ['anna', 'debora', 'lyon', 'morwa', 'osika']
const ORDER = [...NEWH, 'mindelo', 'amarylis', 'amber', 'eliza', 'ametyst', 'skagen', 'aletta', 'alaska', 'aurora', 'ballina', 'alberto', 'medulin', 'jeziorko', 'sakura', 'g6', 'novara', 'jarzebina', 'oban', 'juliusz', 'fabia', 'pomarancza', 'rockville', 'basiaiadam', 'jarzab'].map((h) => `${h}-v35421`)
const HOST = ['debora-host-v35421', 'anna-host-v35421']
const of = (key: string): string => { const s = SCENES.find((q) => q.key === key); return `${s?.title} ${s?.subtitle}` }
const model = (key: string) => (SCENES.find((s) => s.key === key) as (typeof SCENES)[number]).build()

describe('v3.54.21 scenes', () => {
  it('come first, NEW-H leading; a post-trial run never passes for a trial result', () => {
    expect(SCENES.slice(0, ORDER.length).map((s) => s.key)).toEqual(ORDER)
    for (const h of ['anna', 'debora', 'lyon']) expect(of(`${h}-v35421`)).toContain('NEW-H, PO PRÓBIE (DEV)')
    for (const h of ['morwa', 'osika']) expect(of(`${h}-v35421`)).toContain('NEW-H (pierwszy wynik próby')
    for (const s of SCENES.slice(NEWH.length, ORDER.length)) expect(s.title).not.toContain('NEW-H')
  })

  it('the two models the host served live follow, each titled as served from the host on its revision', () => {
    expect(SCENES.slice(ORDER.length, ORDER.length + HOST.length).map((s) => s.key)).toEqual(HOST)
    for (const key of HOST) expect(of(key)).toContain('z hosta na rewizji')
    expect(of('anna-host-v35421')).toContain('UTRACONE wnętrze')
    for (const key of HOST) {
      const m = model(key)
      const exterior = new Set(m.walls.filter((w) => w.kind === 'EXTERIOR').map((w) => w.id))
      expect(compileBuilding(m).meshes.length, key).toBeGreaterThan(0)
      expect(of(key)).toContain(`ściany wewnętrzne: ${m.walls.filter((w) => w.kind === 'INTERIOR').length};`)
      expect(of(key)).toContain(`otwory zewnętrzne: ${m.openings.filter((o) => exterior.has(o.wallId)).length};`)
      expect(of(key)).toContain(`kosze ${m.roofEdges.filter((e) => e.kind === 'VALLEY').length},`)
    }
  })

  it('a failed, lossy or regressed result says so in its own title or subtitle', () => {
    expect(of('anna-v35421')).toContain('UTRACONE wnętrze')
    expect(of('osika-v35421')).toContain('BRAK portyków')
    expect(of('osika-v35421')).toContain('ZMIENIONY zestaw okien')
    expect(of('lyon-v35421')).toContain('attyka nieosiągnięta')
    expect(of('eliza-v35421')).toContain('NIEUDANY UKŁAD')
    expect(of('medulin-v35421')).toContain('UTRACONE')
    expect(of('g6-v35421')).toContain('UTRACONE')
    expect(of('rockville-v35421')).toContain('NIEUDANE ZEWNĘTRZE')
    expect(of('basiaiadam-v35421')).toContain('NIEUDANY')
  })

  it('every scene builds from its sealed bytes and compiles; what the subtitle counts is counted from the model', () => {
    for (const key of ORDER) {
      const s = SCENES.find((q) => q.key === key) as (typeof SCENES)[number]
      const m = s.build()
      expect(compileBuilding(m).meshes.length, key).toBeGreaterThan(0)
      const exterior = new Set(m.walls.filter((w) => w.kind === 'EXTERIOR').map((w) => w.id))
      expect(s.subtitle, key).toContain(`ściany wewnętrzne z rzutu: ${m.walls.filter((w) => w.kind === 'INTERIOR').length},`)
      expect(s.subtitle, key).toContain(`otwory zewnętrzne: ${m.openings.filter((o) => exterior.has(o.wallId)).length};`)
      if (m.roofPlanes.length > 0) expect(s.subtitle, key).toContain(`kosze ${m.roofEdges.filter((e) => e.kind === 'VALLEY').length},`)
    }
  })

  it('the roofs the stage reports are in the sealed models: Debora\'s T and Anna II\'s crossing with valleys, Lyon closed flat', () => {
    const valleys = (key: string) => model(key).roofEdges.filter((e) => e.kind === 'VALLEY').length
    expect(valleys('debora-v35421')).toBe(2)
    expect(valleys('anna-v35421')).toBe(4)
    expect(valleys('mindelo-v35421')).toBe(4)
    const lyon = model('lyon-v35421')
    expect(lyon.roofs.map((r) => r.kind)).toContain('FLAT')
    expect(model('osika-v35421').roofEdges.filter((e) => e.kind === 'HIP')).toHaveLength(4)
  })
})
