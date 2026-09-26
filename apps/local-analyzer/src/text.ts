/**
 * ICU text behaviour for a runtime without ICU — a platform adapter.
 *
 * nodejs-mobile builds Node for Android with `--with-intl=none`: there is no
 * `Intl`, V8's `String.prototype.localeCompare` compares UTF-16 code units, and
 * `String.prototype.normalize` returns its input unchanged. The analyzer sorts
 * with `localeCompare` (ids, URLs, OCR tokens, published labels) and strips
 * accents with `normalize('NFD')`; on a real project's inputs a runtime
 * without ICU ordered 5 357 of 50 412 comparisons differently (measured in
 * BUILDAPP-03Y2), and a different order can be a different building.
 *
 * So on such a runtime — and only there — the two methods are replaced by
 * implementations of what ICU does, from tables generated from the desktop's
 * own ICU (`scripts/generate-text-tables.mjs`, verified against ICU by
 * `test/text.test.ts`):
 *
 *  - `normalize('NFD')`: full canonical decomposition of every code point,
 *    Hangul by arithmetic, and canonical ordering of combining marks. Exact.
 *  - `localeCompare` (no locale, no options — how the analyzer calls it): CLDR
 *    root collation, the collation ICU uses for en-US, as three levels over one
 *    collation element per character, for a repertoire verified character by
 *    character against ICU on every string of one and two characters: ASCII,
 *    Latin-1 and Latin Extended letters (through NFD), the Polish letters
 *    including ł, common punctuation and symbols, combining marks.
 *
 * Text outside that repertoire is REFUSED with `TextNotSupportedError`
 * (curly quotes, `…`, `ß`, Greek, CJK, …): a comparison this adapter cannot
 * make exactly as ICU would is never made approximately. The analyzer is not
 * touched; on a runtime with a working ICU nothing is installed.
 */
import { TEXT_TABLES } from './text-tables.js'

export class TextNotSupportedError extends Error {
  constructor(
    readonly codePoint: number,
    readonly operation: 'collation' | 'normalization',
  ) {
    super(`U+${codePoint.toString(16).toUpperCase().padStart(4, '0')} is outside the ${operation} this runtime reproduces`)
    this.name = 'TextNotSupportedError'
  }
}

type Tables = {
  decompositions: Map<number, number[]>
  nonStarter: Map<number, number>
  equivalents: Map<number, number[]>
  primary: Map<number, number>
  tertiary: Map<number, number>
  secondary: Map<number, number>
  ignorable: Set<number>
}

let tables: Tables | null = null

const pairs = (text: string): Array<[number, string]> =>
  text === '' ? [] : text.split(',').map((entry) => {
    const [cp, value] = entry.split(':')
    return [parseInt(cp, 16), value]
  })

function load(): Tables {
  if (tables) return tables
  const seq = (v: string): number[] => v.split('.').map((h) => parseInt(h, 16))
  const primary = new Map<number, number>()
  const tertiary = new Map<number, number>()
  for (const [cp, v] of pairs(TEXT_TABLES.bases)) {
    const [p, t] = v.split('.')
    primary.set(cp, parseInt(p, 36))
    tertiary.set(cp, parseInt(t, 36))
  }
  tables = {
    decompositions: new Map(pairs(TEXT_TABLES.nfd).map(([cp, v]) => [cp, seq(v)])),
    nonStarter: new Map(pairs(TEXT_TABLES.nonStarters).map(([cp, v]) => [cp, parseInt(v, 36)])),
    equivalents: new Map(pairs(TEXT_TABLES.equivalents).map(([cp, v]) => [cp, seq(v)])),
    primary,
    tertiary,
    secondary: new Map(pairs(TEXT_TABLES.marks).map(([cp, v]) => [cp, parseInt(v, 36)])),
    ignorable: new Set(pairs(TEXT_TABLES.ignorable).map(([cp]) => cp)),
  }
  return tables
}

// --- normalization -------------------------------------------------------------

const S_BASE = 0xac00
const L_BASE = 0x1100
const V_BASE = 0x1161
const T_BASE = 0x11a7
const V_COUNT = 21
const T_COUNT = 28
const N_COUNT = V_COUNT * T_COUNT
const S_COUNT = 19 * N_COUNT

function decomposeInto(cp: number, out: number[], t: Tables): void {
  const s = cp - S_BASE
  if (s >= 0 && s < S_COUNT) {
    out.push(L_BASE + Math.floor(s / N_COUNT), V_BASE + Math.floor((s % N_COUNT) / T_COUNT))
    if (s % T_COUNT !== 0) out.push(T_BASE + (s % T_COUNT))
    return
  }
  const d = t.decompositions.get(cp)
  if (d) out.push(...d)
  else out.push(cp)
}

/** Canonical ordering: each run of non-starters stably sorted by combining class. */
function reorder(cps: number[], t: Tables): number[] {
  for (let i = 1; i < cps.length; i++) {
    const rank = t.nonStarter.get(cps[i]) ?? 0
    if (rank === 0) continue
    let j = i
    while (j > 0) {
      const before = t.nonStarter.get(cps[j - 1]) ?? 0
      if (before <= rank) break
      const swap = cps[j - 1]
      cps[j - 1] = cps[j]
      cps[j] = swap
      j -= 1
    }
  }
  return cps
}

function nfdCodePoints(text: string, t: Tables): number[] {
  const out: number[] = []
  for (const ch of text) decomposeInto(ch.codePointAt(0)!, out, t)
  return reorder(out, t)
}

const fromCodePoints = (cps: number[]): string => {
  let s = ''
  for (let i = 0; i < cps.length; i += 4096) s += String.fromCodePoint(...cps.slice(i, i + 4096))
  return s
}

/** `text.normalize('NFD')`, as ICU computes it. */
export function nfd(text: string): string {
  return fromCodePoints(nfdCodePoints(text, load()))
}

// --- collation ---------------------------------------------------------------------

/** One collation element: primary (-1 for a combining mark), secondary (0 = common), tertiary. */
type Element = [number, number, number]

function elements(text: string, t: Tables): Element[] {
  const decomposed: number[] = []
  for (const cp of nfdCodePoints(text, t)) {
    const eq = t.equivalents.get(cp)
    if (eq) decomposed.push(...eq)
    else decomposed.push(cp)
  }
  const out: Element[] = []
  for (const cp of reorder(decomposed, t)) {
    if (t.ignorable.has(cp)) continue
    const s = t.secondary.get(cp)
    if (s !== undefined) {
      out.push([-1, s, 0])
      continue
    }
    const p = t.primary.get(cp)
    if (p === undefined) throw new TextNotSupportedError(cp, 'collation')
    out.push([p, 0, t.tertiary.get(cp)!])
  }
  return out
}

const compareLevel = (x: Element[], y: Element[], level: 0 | 1 | 2): number => {
  const a = level === 0 ? x.filter((e) => e[0] >= 0) : x
  const b = level === 0 ? y.filter((e) => e[0] >= 0) : y
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const d = a[i][level] - b[i][level]
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1
}

let asciiPrimary: Int32Array | null = null
let asciiTertiary: Int32Array | null = null

/** Printable ASCII, tab, LF and CR: every one is a single collation element with a common secondary. */
function asciiTables(t: Tables): [Int32Array, Int32Array] {
  if (!asciiPrimary || !asciiTertiary) {
    asciiPrimary = new Int32Array(128).fill(-1)
    asciiTertiary = new Int32Array(128)
    for (let c = 0; c < 128; c++) {
      const p = t.primary.get(c)
      if (p !== undefined && !t.ignorable.has(c)) {
        asciiPrimary[c] = p
        asciiTertiary[c] = t.tertiary.get(c)!
      }
    }
  }
  return [asciiPrimary, asciiTertiary]
}

function compareAscii(a: string, b: string, P: Int32Array, T: Int32Array): number | null {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < a.length; i++) if (a.charCodeAt(i) >= 128 || P[a.charCodeAt(i)] < 0) return null
  for (let i = 0; i < b.length; i++) if (b.charCodeAt(i) >= 128 || P[b.charCodeAt(i)] < 0) return null
  for (let i = 0; i < n; i++) {
    const d = P[a.charCodeAt(i)] - P[b.charCodeAt(i)]
    if (d !== 0) return d < 0 ? -1 : 1
  }
  if (a.length !== b.length) return a.length < b.length ? -1 : 1
  for (let i = 0; i < n; i++) {
    const d = T[a.charCodeAt(i)] - T[b.charCodeAt(i)]
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return 0
}

/** `a.localeCompare(b)` under CLDR root collation, as ICU computes it for en-US: -1, 0 or 1. */
export function rootCompare(a: string, b: string): number {
  const t = load()
  const [P, T] = asciiTables(t)
  const fast = compareAscii(a, b, P, T)
  if (fast !== null) return fast
  const x = elements(a, t)
  const y = elements(b, t)
  return compareLevel(x, y, 0) || compareLevel(x, y, 1) || compareLevel(x, y, 2)
}

// --- installation --------------------------------------------------------------------

export type TextSupport = 'icu' | 'embedded-tables'

let lastRefusal: TextNotSupportedError | null = null

/** The last text the adapter refused, so the program can name it; null when none was. */
export const textRefusal = (): TextNotSupportedError | null => lastRefusal

/** Does this runtime's own ICU do what the analyzer needs? Probed by behaviour, not by the presence of `Intl`. */
export function runtimeHasIcu(): boolean {
  try {
    return typeof Intl !== 'undefined' && 'a'.localeCompare('B') < 0 && '-'.localeCompare('+') < 0 && 'é'.normalize('NFD') === 'é'
  } catch {
    return false
  }
}

const isAscii = (s: string): boolean => {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 0x7f) return false
  return true
}

/**
 * On a runtime without a working ICU, install the adapter in place of
 * `String.prototype.localeCompare` and `String.prototype.normalize`; on one
 * with ICU, do nothing. Returns which of the two the analyzer will run on.
 */
export function installTextAdapter(): TextSupport {
  if (runtimeHasIcu()) return 'icu'
  load()
  const refuse = (error: TextNotSupportedError): never => {
    lastRefusal = error
    throw error
  }
  Object.defineProperty(String.prototype, 'localeCompare', {
    configurable: true,
    writable: true,
    value: function localeCompare(this: unknown, that: unknown, locales?: unknown, options?: unknown): number {
      if (locales !== undefined || options !== undefined) throw new TypeError('localeCompare with a locale or options needs ICU, which this runtime does not have')
      try {
        return rootCompare(String(this), String(that))
      } catch (error) {
        if (error instanceof TextNotSupportedError) refuse(error)
        throw error
      }
    },
  })
  Object.defineProperty(String.prototype, 'normalize', {
    configurable: true,
    writable: true,
    value: function normalize(this: unknown, form?: unknown): string {
      const text = String(this)
      const f = form === undefined ? 'NFC' : String(form)
      if (!['NFC', 'NFD', 'NFKC', 'NFKD'].includes(f)) throw new RangeError('The normalization form should be one of NFC, NFD, NFKC, NFKD.')
      if (f === 'NFD') return nfd(text)
      if (isAscii(text)) return text
      // only NFD is reproduced; any other form on non-ASCII text is refused, never guessed
      return refuse(new TextNotSupportedError([...text].find((c) => c.codePointAt(0)! > 0x7f)!.codePointAt(0)!, 'normalization'))
    },
  })
  return 'embedded-tables'
}
