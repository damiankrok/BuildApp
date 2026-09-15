/**
 * Deterministic ids.
 *
 * Every id in the analyzer is a function of what the thing IS, never of when
 * it was made or what order it was found in. Re-running acquisition or
 * extraction on the same bytes produces the same ids, which is what makes a
 * sealed package replayable and a graph diffable.
 */
import { canonicalJson } from './canonical.js'
import { sha256Hex } from './sha256.js'

/** A lowercase, hyphenated slug of at most `max` characters, for readability inside an id. */
export function slugify(text: string, max = 48): string {
  const s = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.slice(0, max).replace(/-+$/g, '')
}

/**
 * `<prefix>-<slug>-<digest>`: readable at a glance, unique by content. The
 * digest is taken over the canonical JSON of `content`, so two callers that
 * describe the same thing get the same id even if they build the object in a
 * different order.
 */
export function stableId(prefix: string, slug: string, content: unknown, digestLength = 10): string {
  const digest = sha256Hex(canonicalJson(content)).slice(0, digestLength)
  const s = slugify(slug)
  return s ? `${prefix}-${s}-${digest}` : `${prefix}-${digest}`
}
