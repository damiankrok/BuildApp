/**
 * The text adapter against the desktop's own ICU.
 *
 * Android's embedded Node has no ICU (nodejs-mobile builds `--with-intl=none`),
 * so the phone sorts and normalises through `src/text.ts`. These tests hold
 * that adapter to ICU on this machine: NFD for every code point and for mark
 * sequences that need canonical reordering; CLDR root collation for every
 * string of one and two characters over the verified repertoire and for random
 * longer strings; a named refusal for anything outside it. And the end-to-end
 * proof: under V8's no-ICU behaviour the analyzer without the adapter builds a
 * DIFFERENT building, and with it the desktop's, hash for hash.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { hashesOf, runAnalysis } from '@buildapp/analysis-service'
import { memoryByteCache } from '@buildapp/source-package'
import { TEXT_TABLES } from '../src/text-tables.js'
import { TextNotSupportedError, installTextAdapter, nfd, rootCompare, runtimeHasIcu } from '../src/text.js'
import { runLocalAnalysis } from '../src/local.js'
import { FIXTURE_PROJECTS, fixturePageUrl, fixtureWiring } from '../fixture/fixture.js'

const icu = new Intl.Collator('en').compare
const sign = (n: number): number => Math.sign(n)
const chars = (list: string): string[] => (list === '' ? [] : list.split(',').map((e) => String.fromCodePoint(parseInt(e.split(':')[0], 16))))
const bases = chars(TEXT_TABLES.bases)
const marks = chars(TEXT_TABLES.marks)
const equivalents = chars(TEXT_TABLES.equivalents)

let seed = 12345
const rand = (): number => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296)
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]

describe('NFD: exactly what ICU computes', () => {
  it('for every code point', () => {
    const wrong: string[] = []
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue
      const c = String.fromCodePoint(cp)
      if (nfd(c) !== c.normalize('NFD')) wrong.push(cp.toString(16))
    }
    expect(wrong).toEqual([])
  })

  it('for strings whose combining marks need canonical reordering', () => {
    const nonStarters = chars(TEXT_TABLES.nonStarters)
    const starters = ['a', 'e', 'o', 'ó', 'ą', 'ł', 'Ż', '한', 'ệ', 'x']
    for (let k = 0; k < 20000; k++) {
      let s = ''
      const n = 1 + Math.floor(rand() * 6)
      for (let i = 0; i < n; i++) s += rand() < 0.4 ? pick(starters) : pick(nonStarters)
      expect(nfd(s), JSON.stringify(s)).toBe(s.normalize('NFD'))
    }
  })

  it('for the Polish text the analyzer deaccents', () => {
    for (const s of ['Dom w marcówkach (GE)', 'płyta żelbetowa', 'HÖRMANN', 'Powierzchnia użytkowa', 'ŻÓŁĆ gęślą jaźń', 'Kotłownia, spiżarka, łazienka']) expect(nfd(s)).toBe(s.normalize('NFD'))
  })
})

describe('collation: CLDR root, exactly as ICU orders it, over the verified repertoire', () => {
  it('covers ASCII, every Polish letter, and the symbols printed on drawings', () => {
    for (let c = 0x20; c <= 0x7e; c++) expect(bases).toContain(String.fromCharCode(c))
    for (const c of 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ°±×÷–—²³€§µ'.replace('µ', '')) expect(() => rootCompare(c, 'a')).not.toThrow()
  })

  it('orders every string of one and two characters as ICU does', () => {
    const all = [...bases, ...equivalents, ...marks]
    const firsts = [...bases, ...equivalents]
    const strings: string[] = [...all]
    for (const a of firsts) for (const b of all) strings.push(a + b)
    const sorted = strings.sort(icu)
    const bad: string[] = []
    for (let i = 1; i < sorted.length; i++) {
      if (sign(icu(sorted[i - 1], sorted[i])) !== sign(rootCompare(sorted[i - 1], sorted[i]))) bad.push(JSON.stringify([sorted[i - 1], sorted[i]]))
    }
    for (let k = 0; k < 100000; k++) {
      const a = pick(sorted)
      const b = pick(sorted)
      if (sign(icu(a, b)) !== sign(rootCompare(a, b))) bad.push(JSON.stringify([a, b]))
    }
    expect(bad.slice(0, 10)).toEqual([])
  }, 300_000)

  it('orders random longer strings as ICU does', () => {
    const ascii = bases.filter((c) => c.codePointAt(0)! < 0x7f)
    const polish = [...'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ']
    const strings: string[] = []
    for (let k = 0; k < 20000; k++) {
      let s = ''
      const n = 1 + Math.floor(rand() * 12)
      for (let i = 0; i < n; i++) {
        const r = rand()
        s += r < 0.7 ? pick(ascii) : r < 0.85 ? pick(polish) : r < 0.95 ? pick(bases) : pick(marks)
      }
      strings.push(s)
    }
    const bad: string[] = []
    for (let k = 0; k < 200000; k++) {
      const a = pick(strings)
      const b = rand() < 0.3 ? a.slice(0, -1) + pick(ascii) : pick(strings)
      if (sign(icu(a, b)) !== sign(rootCompare(a, b))) bad.push(JSON.stringify([a, b]))
    }
    expect(bad.slice(0, 10)).toEqual([])
  })

  it('orders what the analyzer actually compares as ICU does: OCR tokens, ids, URLs, Polish labels', () => {
    const real = ['±0,80', '±8,00', '°', '±', '+', '-', ',', '.', '/', '0', '1', '2,10', '240', 'A', 'a', 'obs-frame-3', 'obs_frame_3', 'Obs-Frame-3', 'https://www.archon.pl/projekty-domow/x', 'https://static.archon.pl/a.png', 'ELEVATION', 'elevation', 'Łazienka', 'Pokój', 'Kuchnia z jadalnią', 'Garaż', 'Kotłownia', 'Salon', 'Spiżarnia', 'Taras', 'płyta żelbetowa', 'Płyta', 'Dom w marcówkach (GE)']
    for (const a of real) for (const b of real) expect(sign(rootCompare(a, b)), JSON.stringify([a, b])).toBe(sign(icu(a, b)))
  })

  it('refuses, by name, text it cannot order exactly as ICU does', () => {
    for (const c of ['„', '”', '…', 'ß', 'α', '中', '·']) {
      expect(() => rootCompare('a' + c, 'ab'), c).toThrow(TextNotSupportedError)
    }
  })
})

describe('installation', () => {
  it('installs nothing where ICU works (the desktop, the server)', () => {
    const before = String.prototype.localeCompare
    expect(runtimeHasIcu()).toBe(true)
    expect(installTextAdapter()).toBe('icu')
    expect(String.prototype.localeCompare).toBe(before)
  })

  /**
   * Run `body` as V8 without ICU runs it (what Android's nodejs-mobile is), then
   * put everything back. `disagreements` counts the comparisons whose sign
   * differs from what ICU would have answered — the orderings the analyzer
   * would get wrong.
   */
  const withoutIcu = async <T>(body: () => Promise<T> | T): Promise<{ value: T; disagreements: number; comparisons: number }> => {
    const saved = { compare: String.prototype.localeCompare, normalize: String.prototype.normalize, intl: globalThis.Intl }
    const define = (name: string, value: unknown): void => void Object.defineProperty(String.prototype, name, { configurable: true, writable: true, value })
    const reference = new Intl.Collator('en').compare
    const tally = { disagreements: 0, comparisons: 0 }
    define('localeCompare', function (this: string, that: string) {
      const a = String(this)
      const b = String(that)
      let d = 0
      for (let i = 0; i < Math.min(a.length, b.length) && d === 0; i++) d = a.charCodeAt(i) - b.charCodeAt(i)
      if (d === 0) d = a.length - b.length
      tally.comparisons += 1
      if (Math.sign(d) !== Math.sign(reference(a, b))) tally.disagreements += 1
      return d
    })
    define('normalize', function (this: string) {
      return String(this)
    })
    delete (globalThis as { Intl?: unknown }).Intl
    try {
      const value = await body()
      return { value, ...tally }
    } finally {
      define('localeCompare', saved.compare)
      define('normalize', saved.normalize)
      ;(globalThis as { Intl?: unknown }).Intl = saved.intl
    }
  }

  it('where ICU is missing, installs the adapter, which then orders and normalises as ICU would', async () => {
    const expected = ['b', 'A', 'a', '-', '+', '±1', '1', 'ł', 'm', 'l'].sort(icu)
    await withoutIcu(() => {
      expect(runtimeHasIcu()).toBe(false)
      expect(['b', 'A', 'a', '-', '+', '±1', '1', 'ł', 'm', 'l'].sort((x, y) => x.localeCompare(y))).not.toEqual(expected)
      expect(installTextAdapter()).toBe('embedded-tables')
      expect(['b', 'A', 'a', '-', '+', '±1', '1', 'ł', 'm', 'l'].sort((x, y) => x.localeCompare(y))).toEqual(expected)
      expect('marcówkach'.normalize('NFD')).toBe('marcówkach')
      expect('ascii'.normalize('NFC')).toBe('ascii')
      expect(() => 'ó'.normalize('NFC')).toThrow(TextNotSupportedError)
    })
  })

  describe('the analyzer under V8 without ICU', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'text-adapter-'))
    afterAll(() => rmSync(scratch, { recursive: true, force: true }))

    it('WITHOUT the adapter the analyzer is handed wrong orderings; WITH it, none, and the desktop’s building hash for hash', async () => {
      const url = fixturePageUrl(FIXTURE_PROJECTS.larchfield)
      const wiring = fixtureWiring()
      const desktop = hashesOf((await runAnalysis({ kind: 'URL', url }, { adapters: wiring.adapters, deps: wiring.deps, cache: memoryByteCache() })).result)
      const bare = await withoutIcu(() => runLocalAnalysis({ url, workDir: join(scratch, 'bare'), wiring: fixtureWiring() }))
      // V8 without ICU orders a large share of what the analyzer compares differently from ICU
      expect(bare.comparisons).toBeGreaterThan(1000)
      expect(bare.disagreements / bare.comparisons).toBeGreaterThan(0.05)
      const adapted = await withoutIcu(() => {
        expect(installTextAdapter()).toBe('embedded-tables')
        return runLocalAnalysis({ url, workDir: join(scratch, 'adapted'), wiring: fixtureWiring() })
      })
      // the adapter replaced the no-ICU comparison: nothing reached the counting stand-in
      expect(adapted.comparisons).toBe(0)
      expect(hashesOf(adapted.value.run.result)).toEqual(desktop)
    })
  })
})
