/**
 * Generate `src/text-tables.ts`: the ICU behaviour the analyzer relies on,
 * measured from THIS Node's ICU, as tables the phone's runtime can use.
 *
 *   node apps/local-analyzer/scripts/generate-text-tables.mjs [--check]
 *
 * Why: nodejs-mobile builds Node for Android with `--with-intl=none`. Without
 * ICU, V8's `String.prototype.localeCompare` compares UTF-16 code units and
 * `String.prototype.normalize` returns its input unchanged — and the analyzer
 * sorts by `localeCompare` (ids, URLs, OCR tokens) and strips accents with
 * `normalize('NFD')`. On a real project's inputs that changed the sign of
 * 5 357 of 50 412 comparisons (measured in BUILDAPP-03Y2). The phone must behave as the desktop does.
 *
 * What is generated (from the desktop's ICU, never typed in):
 *
 *  - NFD: the full canonical decomposition of every code point whose NFD
 *    differs from itself (Hangul syllables are decomposed arithmetically), and
 *    a rank per non-starter that orders marks as their canonical combining
 *    classes do — so `nfd()` is exact for any string.
 *  - Collation (CLDR root, the collation `localeCompare` uses for en-US): for
 *    a repertoire of characters — ASCII, Latin, Greek, common punctuation and
 *    symbols, combining marks — one collation element each: a primary rank, a
 *    tertiary rank within its primary class, and for marks a secondary rank.
 *    A character the model cannot reproduce exactly (an expansion like `ß` or
 *    `½`, a contraction like the `l·` of CLDR root, a non-common secondary) is
 *    found by comparing the model with ICU on every string of one and two
 *    characters, and REMOVED from the repertoire. The phone refuses text
 *    outside the repertoire with a named error rather than guess.
 *
 * `--check` regenerates in memory and exits 1 if the committed file differs.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'src', 'text-tables.ts')

const hex = (cp) => cp.toString(16)
const isSurrogate = (cp) => cp >= 0xd800 && cp <= 0xdfff
const HANGUL_FIRST = 0xac00
const HANGUL_LAST = 0xd7a3

// --- NFD ---------------------------------------------------------------------

function decompositions() {
  const out = []
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (isSurrogate(cp) || (cp >= HANGUL_FIRST && cp <= HANGUL_LAST)) continue
    const c = String.fromCodePoint(cp)
    const d = c.normalize('NFD')
    if (d !== c) out.push([cp, [...d].map((x) => x.codePointAt(0))])
  }
  return out
}

/** Non-starters (canonical combining class > 0) and a rank that orders them as their classes do. */
function nonStarterRanks() {
  const LOW = '̴' // ccc 1
  const HIGH = 'ͅ' // ccc 240
  const marks = []
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (isSurrogate(cp)) continue
    const m = String.fromCodePoint(cp)
    if (m.normalize('NFD') !== m) continue // decomposes: its parts are classified instead
    if (m === LOW || m === HIGH) {
      marks.push(m)
      continue
    }
    const a = 'a' + HIGH + m
    const b = 'a' + m + LOW
    if (a.normalize('NFD') !== a || b.normalize('NFD') !== b) marks.push(m)
  }
  // m1 below m2 ⇔ ccc(m1) < ccc(m2) ⇔ "a"+m2+m1 is reordered
  const below = (m1, m2) => ('a' + m2 + m1).normalize('NFD') === 'a' + m1 + m2
  const sorted = [...marks].sort((x, y) => (below(x, y) ? -1 : below(y, x) ? 1 : 0))
  const ranks = []
  let rank = 0
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && below(sorted[i - 1], sorted[i])) rank += 1
    ranks.push([sorted[i].codePointAt(0), rank + 1])
  }
  return ranks
}

// --- collation ------------------------------------------------------------------

const CANDIDATE_RANGES = [
  [0x09, 0x0a], [0x0d, 0x0d],
  [0x20, 0x7e],
  [0xa0, 0x24f], // Latin-1 Supplement, Latin Extended-A and -B
  [0x300, 0x36f], // combining diacritical marks
  [0x370, 0x3ff], // Greek
  [0x1e00, 0x1eff], // Latin Extended Additional
  [0x2010, 0x2027], [0x2030, 0x205e], // general punctuation
  [0x20a0, 0x20c0], // currency
  [0x2116, 0x2116], [0x2190, 0x2193], [0x2212, 0x2212], [0x2248, 0x2248], [0x2260, 0x2265],
]

function candidates() {
  const out = []
  for (const [a, b] of CANDIDATE_RANGES) {
    for (let cp = a; cp <= b; cp++) {
      const c = String.fromCodePoint(cp)
      // only characters that are their own NFD: a precomposed letter is handled through its parts
      if (c.normalize('NFD') === c && /\P{Cn}/u.test(c)) out.push(c)
    }
  }
  return out
}

const full = new Intl.Collator('en').compare
const primaryOnly = new Intl.Collator('en', { sensitivity: 'base' }).compare
const primarySecondary = new Intl.Collator('en', { sensitivity: 'accent' }).compare
const isMarkChar = (c) => /\p{M}/u.test(c)

/** Build the model for a repertoire; returns weights, or null when a character is not single-element. */
function buildModel(repertoire) {
  const ignorable = repertoire.filter((c) => !isMarkChar(c) && full('a' + c + 'b', 'ab') === 0 && full(c, '') === 0)
  const marks = repertoire.filter((c) => isMarkChar(c) && !ignorable.includes(c))
  const bases = repertoire.filter((c) => !isMarkChar(c) && !ignorable.includes(c))
  const byPrimary = [...bases].sort(primaryOnly)
  const primary = new Map()
  let p = -1
  for (let i = 0; i < byPrimary.length; i++) {
    if (i === 0 || primaryOnly(byPrimary[i - 1], byPrimary[i]) !== 0) p += 1
    primary.set(byPrimary[i], p)
  }
  const tertiary = new Map()
  const classes = new Map()
  for (const c of bases) {
    const k = primary.get(c)
    if (!classes.has(k)) classes.set(k, [])
    classes.get(k).push(c)
  }
  for (const members of classes.values()) {
    const sorted = [...members].sort(full)
    let t = 0
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && full(sorted[i - 1], sorted[i]) !== 0) t += 1
      tertiary.set(sorted[i], t)
    }
  }
  const byAccent = [...marks].sort((x, y) => primarySecondary('a' + x, 'a' + y))
  const secondary = new Map()
  let s = 0
  for (let i = 0; i < byAccent.length; i++) {
    if (i > 0 && primarySecondary('a' + byAccent[i - 1], 'a' + byAccent[i]) !== 0) s += 1
    secondary.set(byAccent[i], s + 1)
  }
  return { ignorable, marks, bases, primary, tertiary, secondary }
}

/**
 * Characters CLDR root collates EXACTLY as a base character followed by a
 * combining mark (ICU says equal at full strength): `ł` is `l` + U+0335,
 * `ø` is `o` + U+0338. They are collated through that sequence.
 */
function collationEquivalents(candidatesList) {
  const marks = candidatesList.filter((c) => isMarkChar(c))
  const bases = []
  for (let cp = 0x20; cp <= 0x7e; cp++) bases.push(String.fromCharCode(cp))
  const out = new Map()
  for (const c of candidatesList) {
    if (c.codePointAt(0) <= 0x7e || isMarkChar(c)) continue
    search: for (const b of bases) {
      if (primaryOnly(c, b) !== 0) continue
      for (const m of marks) {
        if (full(c, b + m) === 0) {
          out.set(c, b + m)
          break search
        }
      }
    }
  }
  return out
}

/** The comparator the phone runs, over a model (same algorithm as src/text.ts). */
function comparatorOf(model) {
  const ig = new Set(model.ignorable)
  const eq = model.equivalents ?? new Map()
  const elements = (input) => {
    const ces = []
    const text = [...input].map((c) => eq.get(c) ?? c).join('')
    for (const c of text) {
      if (ig.has(c)) continue
      if (model.secondary.has(c)) ces.push([-1, model.secondary.get(c), 0])
      else ces.push([model.primary.get(c), 0, model.tertiary.get(c)])
    }
    return ces
  }
  const level = (x, y, pick, skip) => {
    const a = x.filter((e) => !skip(e)).map(pick)
    const b = y.filter((e) => !skip(e)).map(pick)
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
    return a.length === b.length ? 0 : a.length < b.length ? -1 : 1
  }
  return (a, b) => {
    const x = elements(a)
    const y = elements(b)
    return level(x, y, (e) => e[0], (e) => e[0] < 0) || level(x, y, (e) => e[1], () => false) || level(x, y, (e) => e[2], () => false)
  }
}

/** Every string of one and two characters over the repertoire, sorted by ICU; count pairs the model orders differently. */
function mismatches(repertoire, model) {
  const cmp = comparatorOf(model)
  const all = [...repertoire, ...(model.equivalents ?? new Map()).keys()]
  const strings = [...all]
  const firsts = all.filter((c) => !model.secondary.has(c)) // a string starting with a bare mark is not text
  for (const a of firsts) for (const b of all) strings.push(a + b)
  const sorted = strings.sort(full)
  const blame = new Map()
  let count = 0
  let asciiOnly = null
  // A disagreement is blamed on the non-ASCII characters in it; ASCII is never dropped.
  // One between ASCII strings alone means the model itself is wrong, and generation stops.
  const note = (x, y) => {
    const suspects = [...(x + y)].filter((c) => c.codePointAt(0) > 0x7e)
    if (suspects.length === 0) asciiOnly = asciiOnly ?? [x, y]
    // a disagreement with one suspect convicts it; one with several only weighs as a tie-breaker
    const unique = [...new Set(suspects)]
    for (const c of unique) blame.set(c, (blame.get(c) ?? 0) + (unique.length === 1 ? 1000 : 1))
  }
  for (let i = 1; i < sorted.length; i++) {
    if (Math.sign(full(sorted[i - 1], sorted[i])) !== Math.sign(cmp(sorted[i - 1], sorted[i]))) {
      count += 1
      note(sorted[i - 1], sorted[i])
    }
  }
  // and a random sample across the whole order, which adjacent pairs alone do not cover
  let seed = 7
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296)
  for (let k = 0; k < 200000; k++) {
    const a = sorted[(rand() * sorted.length) | 0]
    const b = sorted[(rand() * sorted.length) | 0]
    if (Math.sign(full(a, b)) !== Math.sign(cmp(a, b))) {
      count += 1
      note(a, b)
    }
  }
  if (asciiOnly) throw new Error(`the collation model disagrees with ICU on ASCII alone: ${JSON.stringify(asciiOnly)}`)
  return { count, blame }
}

export function generate({ log = () => undefined } = {}) {
  const nfd = decompositions()
  const ranks = nonStarterRanks()
  const all = candidates()
  const equivalents = collationEquivalents(all)
  let repertoire = all.filter((c) => !equivalents.has(c))
  const excluded = []
  const modelOf = () => ({ ...buildModel(repertoire), equivalents })
  let model = modelOf()
  for (;;) {
    const { count, blame } = mismatches(repertoire, model)
    log(`repertoire ${repertoire.length} + ${equivalents.size} equivalents, mismatches ${count}`)
    if (count === 0) break
    // drop every character convicted on its own (else the most-blamed one), and measure again
    const ranked = [...blame].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
    const convicted = ranked.filter(([, n]) => n >= 1000).map(([c]) => c)
    for (const worst of convicted.length > 0 ? convicted : [ranked[0][0]]) {
      excluded.push(worst)
      if (equivalents.has(worst)) equivalents.delete(worst)
      else repertoire = repertoire.filter((c) => c !== worst)
    }
    model = modelOf()
  }
  const cp = (c) => c.codePointAt(0)
  const tables = {
    unicode: process.versions.unicode,
    icu: process.versions.icu,
    nfd: nfd.map(([c, d]) => `${hex(c)}:${d.map(hex).join('.')}`).join(','),
    nonStarters: ranks.map(([c, r]) => `${hex(c)}:${r.toString(36)}`).join(','),
    ignorable: model.ignorable.map((c) => hex(cp(c))).join(','),
    bases: model.bases
      .map((c) => [cp(c), model.primary.get(c), model.tertiary.get(c)])
      .sort((a, b) => a[0] - b[0])
      .map(([c, p, t]) => `${hex(c)}:${p.toString(36)}.${t.toString(36)}`)
      .join(','),
    marks: model.marks
      .map((c) => [cp(c), model.secondary.get(c)])
      .sort((a, b) => a[0] - b[0])
      .map(([c, s]) => `${hex(c)}:${s.toString(36)}`)
      .join(','),
    equivalents: [...equivalents]
      .sort((a, b) => cp(a[0]) - cp(b[0]))
      .map(([c, seq]) => `${hex(cp(c))}:${[...seq].map((x) => hex(cp(x))).join('.')}`)
      .join(','),
    excluded: excluded.map((c) => hex(cp(c))).join(','),
  }
  const text = `/**
 * GENERATED by apps/local-analyzer/scripts/generate-text-tables.mjs from the
 * ICU of Node ${process.version} (ICU ${tables.icu}, Unicode ${tables.unicode}). Do not edit.
 *
 * The ICU behaviour the analyzer relies on, for a runtime that has no ICU (the
 * Android build of nodejs-mobile): canonical decompositions, the ordering of
 * combining marks, and CLDR root collation weights for a verified repertoire.
 * See src/text.ts.
 */
export const TEXT_TABLES = ${JSON.stringify(tables, null, 2)} as const
`
  return { text, tables, excluded }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { text, tables, excluded } = generate({ log: (m) => process.stderr.write(`${m}\n`) })
  if (process.argv.includes('--check')) {
    const committed = readFileSync(OUT, 'utf8')
    if (committed !== text) {
      process.stderr.write('src/text-tables.ts is not what this ICU generates (run the script without --check)\n')
      process.exit(1)
    }
    process.stdout.write('text tables current\n')
  } else {
    writeFileSync(OUT, text)
    process.stdout.write(
      `wrote ${OUT}: ${tables.nfd.split(',').length} decompositions, ${tables.nonStarters.split(',').length} non-starters, ` +
        `${tables.bases.split(',').length} base characters, ${tables.marks.split(',').length} marks, ${tables.equivalents.split(',').filter(Boolean).length} equivalents, ${tables.ignorable.split(',').filter(Boolean).length} ignorable; excluded ${excluded.length}: ${JSON.stringify(excluded)}\n`,
    )
  }
}
