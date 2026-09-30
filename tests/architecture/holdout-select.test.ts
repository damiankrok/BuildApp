/**
 * The blind holdout's draw (BUILDPLAN-ANALYZER-005A, Council G's protocol, post-Council fixes).
 *
 * On a synthetic pool, so that no test prints a real address: the draw is a pure function of the
 * pool and the SHA, never picks an excluded family, never picks the same family twice, and the
 * second pick can land on any address of another family — not only on the first one of each.
 */
import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain ES module with no declarations; only its exports are exercised here
import { family, select } from '../../holdout/select.mjs'

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
