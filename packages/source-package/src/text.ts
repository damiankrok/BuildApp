/**
 * Text helpers shared by every adapter: reading a number the way a Polish
 * page prints it, flattening markup to words, and folding diacritics so one
 * rule matches `przekrój` and `przekroj` alike.
 *
 * Nothing here knows a publisher. `normalize('NFD')` is the one dependency on
 * the runtime's Unicode tables; on the phone the local analyzer installs an
 * adapter for it where ICU is missing (`apps/local-analyzer/src/text.ts`).
 */
import { decodeEntities } from './discovery.js'

/**
 * Strip diacritics and lowercase: `Przekrój` → `przekroj`, `Podłóg` → `podlog`.
 * NFD decomposes the accented vowels and consonants; `ł`, `ø`, `đ` and `ß`
 * are letters of their own and are mapped by hand, so a rule written in
 * plain ASCII matches the word as printed.
 */
export const deaccent = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/ø/g, 'o')
    .replace(/Ø/g, 'O')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/ß/g, 'ss')
    .toLowerCase()

/** Markup to words: tags gone, entities decoded, whitespace folded. */
export const stripTags = (html: string): string => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

/**
 * `118,36`, `1 205,5` and `1,205.50` are numbers here. The decimal comma, the
 * thin space and the non-breaking space are a locale's, not noise. The first
 * number in the text is returned; null when there is none.
 */
export function parseLocaleNumber(text: string): number | null {
  const cleaned = text.replace(/[  ]/g, ' ')
  const m = /-?\d[\d ]*(?:[.,]\d+)?/.exec(cleaned)
  if (!m) return null
  let token = m[0].replace(/ /g, '')
  // `1,205.50`: a comma used as a thousands separator ahead of a decimal point.
  if (/,\d{3}\./.test(token)) token = token.replace(/,/g, '')
  const n = Number(token.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Ordering by UTF-16 code units: the same on every runtime, including the
 * phone's Node without ICU, whose `localeCompare` replica refuses characters
 * outside its verified repertoire. Free-form page text (labels, descriptions,
 * captions) is ordered with this, never with `localeCompare`.
 */
/** A percent-escaped address part, decoded; malformed escapes (a Latin-2 byte, a bare "%") are left as printed, never thrown. */
export function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text.replace(/%([0-9a-f]{2})/gi, (whole, hex: string) => {
      const code = parseInt(hex, 16)
      return code < 0x80 ? String.fromCharCode(code) : whole
    })
  }
}

export const compareCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
