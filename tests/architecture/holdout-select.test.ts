/**
 * The blind holdout's draw (BUILDPLAN-ANALYZER-005A, Council G's protocol, post-Council fixes).
 *
 * On a synthetic pool, so that no test prints a real address: the draw is a pure function of the
 * pool and the SHA, never picks an excluded family, never picks the same family twice, and the
 * second pick can land on any address of another family — not only on the first one of each.
 */
import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain ES module with no declarations; only its exports are exercised here
import { archonGarage, family, select, selectStratified } from '../../holdout/select.mjs'

const url = (slug: string, i: number): string => `https://www.archon.pl/projekty-domow/projekt-${slug}-m${i.toString(16).padStart(13, '0')}`
const POOL = Array.from({ length: 40 }, (_, f) => Array.from({ length: 5 }, (_, k) => url(`dom-w-rodzinie${String.fromCharCode(97 + (f % 26))}${f >= 26 ? 'x' : ''}-${k + 1}`, f * 10 + k)))
  .flat()
  .sort()
const TEXT = `${POOL.join('\n')}\n`
const sha = (i: number): string => i.toString(16).padStart(40, 'a')
const familyOf = (u: string): string => family(u.replace(/^.*\/(projekt-[a-z0-9-]+)-m[0-9a-f]{13}$/, '$1'))

describe('holdout draw', () => {
  it('is a pure function of the pool and the SHA', () => {
    expect(select(TEXT, sha(1))).toEqual(select(TEXT, sha(1)))
    expect(select(TEXT, sha(1)).seed).not.toBe(select(TEXT, sha(2)).seed)
  })

  it('draws two families, never an excluded one', () => {
    const excluded = new Set([familyOf(POOL[0]), familyOf(POOL[100])])
    for (let i = 0; i < 200; i += 1) {
      const r = select(TEXT, sha(i), excluded)
      expect(r.families[0]).not.toBe(r.families[1])
      for (const u of r.urls) expect(excluded.has(familyOf(u))).toBe(false)
      expect(r.excluded).toBe(10)
    }
  })

  it('the second pick reaches every position in a family, not only its first address', () => {
    const positions = new Set<number>()
    for (let i = 0; i < 400; i += 1) {
      const u = select(TEXT, sha(i)).urls[1]
      const f = familyOf(u)
      positions.add(POOL.filter((p) => familyOf(p) === f).indexOf(u))
    }
    expect([...positions].sort()).toEqual([0, 1, 2, 3, 4])
  })

  it('refuses a pool out of canonical order and a SHA that is not one', () => {
    expect(() => select(`${[...POOL].reverse().join('\n')}\n`, sha(1))).toThrow('canonical order')
    expect(() => select(TEXT, 'HEAD')).toThrow('40 lowercase hex')
  })
})

describe('round 10 (005N): the garage stratum, from the page’s own published figures only', () => {
  const item = (resource: string, value: string): string => `<div class="product-data__item" data-resource="${resource}"><div class="product-data__title">t</div><div class="product-data__value">${value}</div></div></div>`
  it('reads a garage-area figure above zero as a garage, and nothing else', () => {
    expect(archonGarage(`<main>${item('powierzchnia-garazu', '18,46 m<sup>2</sup>')}</main>`)).toEqual({ garage: true, garageAreaM2: 18.46 })
    expect(archonGarage(`<main>${item('powierzchnia-garazu', '0 m2')}</main>`)).toEqual({ garage: false, garageAreaM2: 0 })
    expect(archonGarage(`<main>${item('powierzchnia-uzytkowa', '118,36 m2')}</main>`)).toEqual({ garage: false, garageAreaM2: null })
    // a figure inside a script is not the page's
    expect(archonGarage(`<script>var x = '${item('powierzchnia-garazu', '20 m2')}'</script>`)).toEqual({ garage: false, garageAreaM2: null })
  })

  it('keeps the first candidate whose page states a garage, burns the others, and never draws the unstratified pick’s family', async () => {
    const garaged = new Set(POOL.filter((_, i) => i % 3 === 0).map(familyOf))
    const factsOf = async (u: string) => ({ garage: garaged.has(familyOf(u)), garageAreaM2: garaged.has(familyOf(u)) ? 20 : null })
    for (let i = 0; i < 20; i += 1) {
      const r = await selectStratified(TEXT, sha(i), 'BUILDPLAN-005N-COMPOUND-FACADE-HOLDOUT', new Set(), { garage: true, maxDraws: 20 }, factsOf)
      expect(r.stratified.eligible).toBe(true)
      expect(garaged.has(r.stratified.family)).toBe(true)
      expect(r.stratified.family).not.toBe(r.unstratified.family)
      for (const c of r.candidates.slice(0, -1)) expect(c.eligible).toBe(false)
    }
  })

  it('round 9’s plan-storey stratum is read exactly as before', async () => {
    const multi = (u: string): boolean => /[bcd]x?$/.test(familyOf(u))
    const factsOf = async (u: string) => ({ planStoreys: multi(u) ? [1, 3] : [1] })
    for (let i = 0; i < 10; i += 1) {
      const r = await selectStratified(TEXT, sha(i), 'BUILDPLAN-005L-STOREY-REGISTRATION-HOLDOUT', new Set(), { minPlanStoreys: 2, maxDraws: 40 }, factsOf)
      expect(r.stratified.planStoreys).toEqual([1, 3])
      expect(Object.keys(r.stratified).sort()).toEqual(['eligible', 'family', 'index', 'k', 'left', 'planStoreys', 'url'])
    }
  })
})

