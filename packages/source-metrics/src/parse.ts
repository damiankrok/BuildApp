/**
 * Turning a run of recognized characters into a metric claim.
 *
 * The grammar is small because drawings print a small grammar. What matters is
 * that every rule here is a statement about DRAWING CONVENTION and not about
 * any particular building, and that a string which does not fit one of them
 * produces nothing rather than a guess.
 *
 * The convention this reader assumes, stated so it can be argued with:
 *
 * - A number carrying a SIGN — `+`, `-`, `±` — is a level against the
 *   drawing's zero, in metres. Nothing else on a set of drawings is printed
 *   with a leading plus.
 * - A number carrying a DECIMAL SEPARATOR and no sign is a length in metres.
 *   Comma and full stop are the same separator; which one a sheet uses is a
 *   typesetting choice, and at thirteen pixels the reader cannot reliably tell
 *   them apart anyway.
 * - A WHOLE number of two to four digits is a length in centimetres. This is
 *   the form dimension chains use, and it is why `1205` and `12,05` are the
 *   same length written two ways.
 * - `a/b` is an opening callout: width over height, in centimetres.
 * - A number followed by a degree sign is an angle.
 *
 * Anything else — a page number, a room number, a fragment of a title block —
 * parses to nothing and is kept as an unattached token.
 */
import type { MetricEvidenceKind, MetricUnit } from './schema.js'
import type { TextToken } from './ocr.js'

/** One admissible interpretation of a string. A string may have several; that is the point. */
export type ParsedNumber = {
  kind: MetricEvidenceKind
  value: number
  unit: MetricUnit
  /** The text this came from, exactly. */
  rawText: string
  /** A second value, for the forms that carry two: an opening's height after its width. */
  secondValue?: number
  /** Why this parse, in a sentence: the rule that fired. */
  why: string
}

const DIGITS = /^[0-9]+$/

/** Comma and full stop are one separator: which a sheet uses is typography, not meaning. */
const normalizeSeparator = (text: string): string => text.replace(/,/g, '.')

/**
 * Parse one recognized string into every interpretation the drawing
 * conventions admit, best first. An empty result means the string is not a
 * measurement, which is a perfectly good answer.
 */
export function parseNumber(rawText: string): ParsedNumber[] {
  const out: ParsedNumber[] = []
  const text = rawText.trim()
  if (text.length === 0) return out

  // --- angle: a number with a degree sign ---
  const angle = /^([0-9]{1,3})([.,][0-9]{1,2})?°$/.exec(text)
  if (angle) {
    const value = Number(normalizeSeparator(angle[1] + (angle[2] ?? '')))
    if (Number.isFinite(value) && value > 0 && value < 180) out.push({ kind: 'ANGLE', value, unit: 'deg', rawText, why: 'a number carrying a degree sign is an angle' })
    return out
  }

  // --- opening callout: width over height, in centimetres ---
  const callout = /^([0-9]{2,4})\/([0-9]{2,4})$/.exec(text)
  if (callout) {
    const w = Number(callout[1])
    const h = Number(callout[2])
    if (w > 0 && h > 0) out.push({ kind: 'OPENING_CALLOUT', value: w, secondValue: h, unit: 'cm', rawText, why: '`width/height` is the standard opening callout, in centimetres' })
    return out
  }

  // --- level datum: a signed decimal, in metres ---
  const level = /^([+\-±])([0-9]{1,2})[.,]([0-9]{2})$/.exec(text)
  if (level) {
    const magnitude = Number(`${level[2]}.${level[3]}`)
    const sign = level[1] === '-' ? -1 : 1
    // A PLUS-OR-MINUS sign means "this is the zero", and it is written on
    // nothing else. `±0,08` is not a height eight centimetres up — it is a
    // misreading of `±0,00`, and admitting it lets a ladder of heights choose
    // a reading that moves the datum the whole drawing is measured from.
    if (level[1] === '±') {
      if (magnitude === 0) out.push({ kind: 'LEVEL_DATUM', value: 0, unit: 'm', rawText, why: 'a plus-or-minus sign marks the drawing zero' })
      return out
    }
    const value = sign * magnitude
    if (Number.isFinite(value)) out.push({ kind: 'LEVEL_DATUM', value, unit: 'm', rawText, why: 'a signed decimal is a level against the drawing zero, in metres' })
    return out
  }

  // --- length with a separator: metres ---
  const decimal = /^([0-9]{1,3})[.,]([0-9]{1,3})$/.exec(text)
  if (decimal) {
    const value = Number(`${decimal[1]}.${decimal[2]}`)
    if (Number.isFinite(value) && value > 0) {
      out.push({ kind: 'LINEAR_DIMENSION', value, unit: 'm', rawText, why: 'a decimal length without a sign is metres' })
      // A three-decimal form is millimetres written as metres on some sheets;
      // the value is the same either way, so no second parse is needed.
    }
    return out
  }

  // --- whole number: centimetres ---
  if (DIGITS.test(text)) {
    const value = Number(text)
    if (text.length >= 2 && text.length <= 4 && value > 0) {
      out.push({ kind: 'LINEAR_DIMENSION', value, unit: 'cm', rawText, why: 'a whole number of two to four digits on a dimension line is centimetres' })
    }
    return out
  }

  return out
}

/**
 * Every string the reader might have meant, best first.
 *
 * A thirteen-pixel italic digit is often a coin toss between two characters,
 * and the reader says so: each glyph keeps its runners-up. Enumerating the
 * substitutions gives the chain solver a lattice to search — and it searches
 * it against arithmetic, which is a far better judge of a small digit than any
 * amount of template matching.
 *
 * The enumeration is bounded and ordered: substitutions are tried on the least
 * confident glyph first, and at most `limit` strings come back, so a five-digit
 * token with three alternatives each cannot produce a combinatorial explosion.
 */
export function readingLattice(token: TextToken, limit = 24): Array<{ text: string; confidence: number; substitutions: number }> {
  type Candidate = { chars: string[]; confidence: number; substitutions: number }
  const base: Candidate = { chars: token.glyphs.map((g) => g.char), confidence: 1, substitutions: 0 }
  const results = new Map<string, Candidate>()
  results.set(base.chars.join(''), base)

  // Glyph indices, least decided first: that is where a misread most likely is.
  const order = token.glyphs.map((g, i) => ({ i, confidence: g.confidence })).sort((a, b) => a.confidence - b.confidence || a.i - b.i)

  // Single substitutions on every glyph, then pairs on the two least decided.
  const singles: Candidate[] = []
  for (const { i } of order) {
    const g = token.glyphs[i]
    for (const alt of g.alternatives) {
      const chars = [...base.chars]
      chars[i] = alt.char
      // How much worse this reading is than the winner, as a ratio of scores.
      const penalty = g.score <= 0 ? 0 : Math.min(1, alt.score / g.score)
      singles.push({ chars, confidence: penalty, substitutions: 1 })
    }
  }
  singles.sort((a, b) => b.confidence - a.confidence)
  for (const c of singles) {
    if (results.size >= limit) break
    const key = c.chars.join('')
    if (!results.has(key)) results.set(key, c)
  }

  if (results.size < limit && order.length >= 2) {
    const [a, b] = order
    for (const altA of token.glyphs[a.i].alternatives) {
      for (const altB of token.glyphs[b.i].alternatives) {
        if (results.size >= limit) break
        const chars = [...base.chars]
        chars[a.i] = altA.char
        chars[b.i] = altB.char
        const ga = token.glyphs[a.i]
        const gb = token.glyphs[b.i]
        const penalty = Math.min(ga.score <= 0 ? 0 : altA.score / ga.score, gb.score <= 0 ? 0 : altB.score / gb.score)
        const key = chars.join('')
        if (!results.has(key)) results.set(key, { chars, confidence: Math.min(1, penalty) * 0.9, substitutions: 2 })
      }
    }
  }

  return [...results.values()]
    .map((c) => ({ text: c.chars.join(''), confidence: c.confidence, substitutions: c.substitutions }))
    .sort((x, y) => y.confidence - x.confidence || x.substitutions - y.substitutions || x.text.localeCompare(y.text))
}
