/**
 * Variant grouping and selection — the one place a resolution choice is made.
 *
 * The bug this exists to make impossible: one consumer analysing a 1138x854
 * drawing while another analyses a 400x300 one, because each scraped the page
 * its own way and each picked "the image" by its own rule. Every consumer now
 * reads the same sealed package, and inside it every asset names the one
 * variant analysis must use and says why it won.
 *
 * Two decisions, and they are different:
 *
 * 1. **Grouping** — are these bytes two encodings of the same drawing, or two
 *    different drawings? Grouped by role plus shape. Same roles and the same
 *    aspect ratio means the same picture at another size. A different aspect
 *    ratio means a different crop and stays a separate asset, because
 *    measuring a crop as if it were the whole drawing puts every coordinate
 *    in the wrong place. A different ANNOTATION role also stays separate: a
 *    dimensioned plan and an area-table plan of the same storey are different
 *    sources with different authority, and merging them loses the chains.
 *
 * 2. **Selection** — within a group, the most pixels win, because a drawing
 *    carries more readable evidence at higher resolution. Ties are broken
 *    deterministically (byte length, then byte hash) so the choice never
 *    depends on fetch order.
 */
import { round6 } from '@buildapp/source-common'
import type { SourceRoles, SourceVariant } from './schema.js'

/** Relative tolerance on the aspect ratio within which two encodings are "the same shape". */
export const ASPECT_TOLERANCE = 0.02

export const aspectOf = (width: number, height: number): number => round6(width / height)

/** True when two aspect ratios are the same shape within tolerance. */
export function sameShape(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false
  return Math.abs(a - b) / Math.max(a, b) <= ASPECT_TOLERANCE
}

/**
 * The part of the grouping key that does not depend on shape. Assets differing
 * in any role dimension are different assets.
 */
export const roleKey = (roles: SourceRoles): string => [roles.document, roles.storey, roles.annotation, roles.view, roles.projection].join('|')

export type GroupInput = { roles: SourceRoles; variant: SourceVariant; captionKey?: string }
export type VariantGroup = { roles: SourceRoles; captionKey?: string; variants: SourceVariant[] }

/**
 * Group candidates into logical assets. Within one role key, candidates join an
 * existing group only when their aspect matches that group's; otherwise they
 * start a new group (a different crop of the same kind of drawing).
 */
export function groupVariants(inputs: readonly GroupInput[]): VariantGroup[] {
  const groups: VariantGroup[] = []
  // deterministic: sort by role key, then caption, then largest first, then byte hash
  const ordered = [...inputs].sort(
    (a, b) =>
      roleKey(a.roles).localeCompare(roleKey(b.roles)) ||
      (a.captionKey ?? '').localeCompare(b.captionKey ?? '') ||
      pixelArea(b.variant) - pixelArea(a.variant) ||
      a.variant.byteHash.localeCompare(b.variant.byteHash),
  )
  for (const input of ordered) {
    const key = roleKey(input.roles)
    const home = groups.find((g) => roleKey(g.roles) === key && (g.captionKey ?? '') === (input.captionKey ?? '') && g.variants.some((v) => sameShape(v.aspect, input.variant.aspect)))
    if (home) {
      // the same bytes twice is one variant
      if (!home.variants.some((v) => v.byteHash === input.variant.byteHash)) home.variants.push(input.variant)
    } else {
      groups.push({ roles: input.roles, captionKey: input.captionKey, variants: [input.variant] })
    }
  }
  for (const g of groups) g.variants = selectionOrder(g.variants)
  return groups
}

export const pixelArea = (v: SourceVariant): number => v.decoded.width * v.decoded.height

/** Best first: most pixels, then most bytes, then byte hash. Total and deterministic. */
export function selectionOrder(variants: readonly SourceVariant[]): SourceVariant[] {
  return [...variants].sort((a, b) => pixelArea(b) - pixelArea(a) || b.byteLength - a.byteLength || a.byteHash.localeCompare(b.byteHash))
}

/** Why the winner won, in a sentence an auditor can check against the variant list. */
export function selectionReason(variants: readonly SourceVariant[]): string {
  const ordered = selectionOrder(variants)
  const best = ordered[0]
  const size = `${best.decoded.width}x${best.decoded.height}`
  if (ordered.length === 1) return `only variant (${size}, decoded from bytes)`
  const runnerUp = ordered[1]
  if (pixelArea(best) !== pixelArea(runnerUp)) {
    return `largest decoded raster of ${ordered.length} variants: ${size} over ${runnerUp.decoded.width}x${runnerUp.decoded.height}`
  }
  return `${ordered.length} variants tie at ${size}; broken by byte length then byte hash`
}
