/**
 * v3.54.16 — the scenes on top of the index: Ballina delivered by the final host job with the correction executor's
 * patches, the Murcja replay (DEV), the controlled test pair (before/after, labelled TEST) and the trial's first result.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_DIR, sealedOwnerModel } from '../scripts/scenes.js'

const BALLINA = '7f4bb112baeeb76716225cd1434f292143eb4530eb49aaef12fc0f2481230d84'
const MURCJA = '2064fd05ab839e8313111acaec9137f1931d557511b158b871f85687e3a3f5c4'
const AFTER = 'eb82a42262a782756dec04178ef1ce574218faa6032b1fbbb8c0b63e9b7ab265'
const BEFORE = 'a8442715df35e2b798da3cd0b484cb4660fa4e3a4acfd3f5ac729de4227307ee'
const ALASKA = 'cafedeaac44f2f8ea507a535eabdc5ce53c5a1ac74703607b6475f59620625b4'
const KEYS = ['ballina-v35416', 'murcja-v35416', 'ballina-test-after-v35416', 'ballina-test-before-v35416', 'alaska-trial-v35416']

describe('v3.54.16 scenes', () => {
  it('are the sealed models and nothing else', () => {
    for (const k of KEYS) expect(() => sealedOwnerModel(k, '0'.repeat(64), 'owner-v35416')).toThrow(/SHA-256/)
  })
  it('Ballina delivered: the v3.54.15 house plus the executor\'s added left window, same roof', () => {
    const b = sealedOwnerModel('ballina-v35416', BALLINA, 'owner-v35416')
    const v35415 = sealedOwnerModel('ballina-v35415', 'bce37b2b92fc53ef22ee946503186a7b90d9c3b6be50b4512b6c1f94ab959b43', 'owner-v35415')
    expect(b.roofs).toHaveLength(v35415.roofs.length)
    expect(b.openings.length).toBe(v35415.openings.length + 1)
    expect(b.openings.some((o) => o.id.startsWith('op-fix-left-'))).toBe(true)
    // corrections keep the ids of the openings they repair
    for (const id of ['opening-0-front-0-0', 'opening-0-front-0-3', 'opening-0-east-1-0']) expect(b.openings.some((o) => o.id === id)).toBe(true)
  })
  it('the controlled test pair differs only in the repaired opening', () => {
    const a = sealedOwnerModel('ballina-test-after-v35416', AFTER, 'owner-v35416')
    const b = sealedOwnerModel('ballina-test-before-v35416', BEFORE, 'owner-v35416')
    const diff = a.openings.filter((o) => JSON.stringify(o) !== JSON.stringify(b.openings.find((x) => x.id === o.id)))
    expect(diff.map((o) => o.id)).toEqual(['opening-0-front-0-0'])
  })
  it('Murcja replay carries the chimney the source gate admitted; Alaska is kept as its first result (no roof)', () => {
    const m = sealedOwnerModel('murcja-v35416', MURCJA, 'owner-v35416')
    expect(JSON.stringify(m)).toContain('chimney-fix-')
    const al = sealedOwnerModel('alaska-trial-v35416', ALASKA, 'owner-v35416')
    expect(al.roofs).toHaveLength(0)
  })
  it('the five scenes come first, each labelled for what it is', () => {
    const index = JSON.parse(readFileSync(join(ASSET_DIR, 'index.json'), 'utf8')) as Array<{ key: string; subtitle: string }>
    expect(index.slice(1, 6).map((e) => e.key)).toEqual(KEYS)
    expect(index[1].subtitle).toContain('ODDANY')
    expect(index[2].subtitle).toContain('ROZWÓJ')
    expect(index[3].subtitle).toContain('TEST')
    expect(index[4].subtitle).toContain('TEST')
    expect(index[5].subtitle).toContain('PRÓBA')
  })
})
