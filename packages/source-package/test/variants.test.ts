import { sha256Hex } from '@buildapp/source-common'
import { describe, expect, it } from 'vitest'
import {
  ASPECT_TOLERANCE,
  SOURCE_PACKAGE_SCHEMA,
  SOURCE_PACKAGE_SCHEMA_VERSION,
  SourcePackageSchema,
  UNKNOWN_ROLES,
  aspectOf,
  groupVariants,
  normalizeRoles,
  roleKey,
  sameShape,
  selectAsset,
  selectedVariant,
  selectionOrder,
  selectionReason,
  sourcePackageContentHash,
  type AnnotationRole,
  type SourceAsset,
  type SourcePackage,
  type SourceRoles,
  type SourceVariant,
} from '../src/index.js'
import { PAGE_URL, assetUrl } from './helpers.js'

/**
 * The bug this file guards against: one consumer analysing a 1138x854 drawing
 * while another analyses the 400x300 copy of it, because each picked "the
 * image" by its own rule. Grouping decides what is the same drawing; selection
 * decides which copy of it wins; and both must be functions of measured pixels
 * and stated roles, never of fetch order.
 */

const variantOf = (name: string, width: number, height: number, extra: Partial<SourceVariant> = {}): SourceVariant => ({
  id: `var-${name}`,
  url: assetUrl(name, 915),
  discoveredVia: 'IMG_SRC:img[src]@page',
  mediaType: 'image/png',
  byteLength: width * height,
  byteHash: sha256Hex(name),
  decoded: { width, height },
  declaredMismatch: false,
  aspect: aspectOf(width, height),
  ...extra,
})

const rolesOf = (partial: Partial<SourceRoles>): SourceRoles => normalizeRoles({ ...UNKNOWN_ROLES, ...partial })

describe('selection — most measured pixels wins, and the reason is checkable', () => {
  it('orders variants by decoded area regardless of the order they were fetched in', () => {
    const small = variantOf('small', 400, 300)
    const big = variantOf('big', 1600, 1200)
    const middle = variantOf('middle', 800, 600)
    // a drawing carries more readable evidence at higher resolution; nothing about the
    // URL, the channel or the arrival order may change this ranking
    expect(selectionOrder([small, big, middle]).map((v) => v.id)).toEqual(['var-big', 'var-middle', 'var-small'])
    expect(selectionOrder([big, small, middle]).map((v) => v.id)).toEqual(['var-big', 'var-middle', 'var-small'])
  })

  it('states the winner’s size AND the runner-up’s, so the choice can be audited against the variant list', () => {
    const reason = selectionReason([variantOf('small', 400, 300), variantOf('big', 1600, 1200), variantOf('middle', 800, 600)])
    expect(reason).toContain('1600x1200')
    // naming the runner-up is what makes the sentence falsifiable: an auditor can check
    // that nothing bigger than the winner and nothing between the two was passed over
    expect(reason).toContain('800x600')
    expect(reason).toContain('3 variants')
    expect(reason).not.toContain('400x300')
  })

  it('says so plainly when there was nothing to choose between, rather than implying a contest', () => {
    expect(selectionReason([variantOf('only', 800, 600)])).toBe('only variant (800x600, decoded from bytes)')
  })

  it('breaks an exact tie on byte length then byte hash, so two equal-sized copies never flip between runs', () => {
    const fat = variantOf('fat', 800, 600, { byteLength: 90_000 })
    const thin = variantOf('thin', 800, 600, { byteLength: 40_000 })
    expect(selectionOrder([thin, fat])[0].id).toBe('var-fat')
    expect(selectionReason([thin, fat])).toContain('tie at 800x600')
    expect(selectionReason([thin, fat])).toContain('byte length then byte hash')
  })
})

describe('grouping — same drawing at another size, or a different drawing', () => {
  it('treats copies of the same shape and the same roles as one asset', () => {
    const roles = rolesOf({ document: 'ELEVATION', view: 'FRONT' })
    const groups = groupVariants([
      { roles, variant: variantOf('page-copy', 400, 256) },
      { roles, variant: variantOf('original', 1280, 819) },
    ])
    // 400/256 = 1.5625 and 1280/819 = 1.56288: the same picture, scaled
    expect(groups).toHaveLength(1)
    expect(groups[0].variants.map((v) => v.decoded.width)).toEqual([1280, 400])
  })

  it('keeps a materially different aspect as its OWN asset, because measuring a crop as the whole drawing misplaces every coordinate', () => {
    const roles = rolesOf({ document: 'FLOOR_PLAN', storey: 'GROUND' })
    const groups = groupVariants([
      { roles, variant: variantOf('four-three', 800, 600) },
      { roles, variant: variantOf('sixteen-nine', 800, 450) },
    ])
    expect(groups).toHaveLength(2)
    // and the tolerance is a ratio, not an absolute: a 2% difference is still one shape
    expect(sameShape(aspectOf(800, 600), aspectOf(800, 600 * (1 + ASPECT_TOLERANCE / 2)))).toBe(true)
    expect(sameShape(aspectOf(800, 600), aspectOf(800, 450))).toBe(false)
  })

  it('counts the same bytes published twice as ONE variant, not as corroborating resolutions', () => {
    const roles = rolesOf({ document: 'SECTION' })
    const twin = variantOf('same-bytes', 1138, 854)
    const groups = groupVariants([
      { roles, variant: twin },
      { roles, variant: { ...twin, id: 'var-elsewhere', url: assetUrl('same-bytes', 11915) } },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].variants).toHaveLength(1)
  })

  it('never merges drawings whose ROLES differ, however alike their shapes are', () => {
    // the dimensioned plan and the area-table plan of one storey are the same size and
    // the same shape and are NOT the same source: merging them loses the dimension chains
    const dimensioned = rolesOf({ document: 'FLOOR_PLAN', storey: 'GROUND', annotation: 'DIMENSIONED' })
    const areas = rolesOf({ document: 'FLOOR_PLAN', storey: 'GROUND', annotation: 'AREA_TABLE' })
    expect(roleKey(dimensioned)).not.toBe(roleKey(areas))
    const groups = groupVariants([
      { roles: dimensioned, variant: variantOf('dim', 800, 600) },
      { roles: areas, variant: variantOf('area', 800, 600) },
    ])
    expect(groups).toHaveLength(2)
  })

  it('produces the same groups whatever order the candidates arrived in', () => {
    const roles = rolesOf({ document: 'ELEVATION', view: 'REAR' })
    const inputs = [
      { roles, variant: variantOf('a', 400, 256) },
      { roles, variant: variantOf('b', 1280, 819) },
      { roles, variant: variantOf('c', 800, 450) },
    ]
    const forwards = groupVariants(inputs)
    const backwards = groupVariants([...inputs].reverse())
    expect(forwards.map((g) => g.variants.map((v) => v.id))).toEqual(backwards.map((g) => g.variants.map((v) => v.id)))
  })
})

// ---------------------------------------------------------------------------
// selectAsset
// ---------------------------------------------------------------------------

function assetOf(name: string, annotation: AnnotationRole, width: number, height: number, document: SourceRoles['document'] = 'FLOOR_PLAN'): SourceAsset {
  const variant = variantOf(name, width, height)
  return {
    id: `asset-${name}`,
    caption: name,
    roles: rolesOf({ document, storey: document === 'FLOOR_PLAN' ? 'GROUND' : 'UNKNOWN', annotation }),
    roleEvidence: [],
    variants: [variant],
    selectedVariantId: variant.id,
    selectionReason: `only variant (${width}x${height}, decoded from bytes)`,
  }
}

function packageOf(assets: SourceAsset[]): SourcePackage {
  const draft = {
    schema: SOURCE_PACKAGE_SCHEMA,
    schemaVersion: SOURCE_PACKAGE_SCHEMA_VERSION,
    id: 'src-test-0000000000',
    canonicalUrl: PAGE_URL,
    pageHash: sha256Hex('page'),
    project: { externalId: 'm1234abcd5678', name: 'Projekt Test', publisher: 'archon.pl' },
    adapter: { id: 'archon.pl', version: '1.0.0' },
    assets,
    publishedFacts: [],
    publishedSpecifications: [],
    publishedRooms: [],
    failures: [],
  }
  // parse, so a hand-built package cannot drift away from the schema the real one obeys
  return SourcePackageSchema.parse({ ...draft, contentHash: sourcePackageContentHash(draft) })
}

describe('selectAsset — the requested annotation outranks the bigger picture', () => {
  // The same storey is published twice: an AREA_TABLE copy (here the larger raster) and a
  // DIMENSIONED copy. They are different sources with different authority, and handing a
  // reader of printed dimensions the area copy gives it a drawing with no chains on it.
  const pkg = packageOf([assetOf('rzut-parteru-z-powierzchniami', 'AREA_TABLE', 1600, 1200), assetOf('rzut-parteru', 'DIMENSIONED', 800, 600)])

  it('returns the asked-for annotation even when another copy of the same drawing has four times the pixels', () => {
    const chosen = selectAsset(pkg, { document: 'FLOOR_PLAN', storey: 'GROUND', preferAnnotation: 'DIMENSIONED' })
    expect(chosen?.roles.annotation).toBe('DIMENSIONED')
    expect(selectedVariant(chosen!).decoded).toEqual({ width: 800, height: 600 })
  })

  it('returns the area copy when THAT is what was asked for, so the preference is a preference and not a ranking in disguise', () => {
    const chosen = selectAsset(pkg, { document: 'FLOOR_PLAN', storey: 'GROUND', preferAnnotation: 'AREA_TABLE' })
    expect(chosen?.roles.annotation).toBe('AREA_TABLE')
    expect(selectedVariant(chosen!).decoded).toEqual({ width: 1600, height: 1200 })
  })

  it('falls back to the largest decoded raster only among assets the annotation rule cannot separate', () => {
    // two renders, neither annotated: nothing but measured pixels distinguishes them
    const renders = packageOf([assetOf('widok-1', 'UNKNOWN', 600, 400, 'PERSPECTIVE_RENDER'), assetOf('widok-2', 'UNKNOWN', 1200, 800, 'PERSPECTIVE_RENDER')])
    const chosen = selectAsset(renders, { document: 'PERSPECTIVE_RENDER' })
    expect(selectedVariant(chosen!).decoded).toEqual({ width: 1200, height: 800 })
  })

  it('returns null rather than a near-miss when no asset matches every stated dimension', () => {
    // a stage that gets the wrong drawing is worse off than one that knows it got none
    expect(selectAsset(pkg, { document: 'FLOOR_PLAN', storey: 'ATTIC' })).toBeNull()
    expect(selectAsset(pkg, { document: 'SITE_PLAN' })).toBeNull()
  })

  it('names a variant its asset actually holds, or refuses to answer at all', () => {
    const broken: SourceAsset = { ...pkg.assets[0], selectedVariantId: 'var-not-here' }
    expect(() => selectedVariant(broken)).toThrow(/not one of its variants/)
  })
})
