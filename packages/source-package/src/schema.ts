/**
 * SourcePackage — the sealed, content-addressed result of acquiring one
 * project's public sources.
 *
 * `buildapp.source-package` is versioned independently of the building model:
 * it describes what was fetched and what each asset IS, never what the
 * building is. Nothing in here is metric and nothing is 3D.
 *
 * The rule the schema exists to enforce:
 *
 *   **Decoded pixel dimensions come from the image bytes, never from an HTML
 *   attribute.**
 *
 * That is not a hypothetical. On the live benchmark page the section is served
 * with `width="400" height="300"` and really is 400x300, while the front
 * elevation is served with `height="213"` and really is 256 pixels tall. A
 * pipeline that believes the markup mis-scales every measurement taken off
 * that drawing, and does so silently. `SourceVariant.declared` keeps whatever
 * the page claimed, `SourceVariant.decoded` is what the bytes say, and
 * `declaredMismatch` records that they disagreed.
 *
 * Roles are multi-dimensional and every dimension may be UNKNOWN. A guessed
 * class is worse than an honest UNKNOWN, because a later stage cannot tell
 * them apart.
 */
import { z } from 'zod'
import { PixelSizeSchema } from '@buildapp/source-common'

export const SOURCE_PACKAGE_SCHEMA = 'buildapp.source-package' as const
export const SOURCE_PACKAGE_SCHEMA_VERSION = '1.1.0' as const
export const SUPPORTED_SOURCE_PACKAGE_VERSIONS = ['1.0.0', '1.1.0'] as const

// ---------------------------------------------------------------------------
// Roles — multi-dimensional, independently UNKNOWN-able
// ---------------------------------------------------------------------------

/** What kind of document an asset is. */
export const DocumentRoleSchema = z.enum(['FLOOR_PLAN', 'SECTION', 'ELEVATION', 'SITE_PLAN', 'PERSPECTIVE_RENDER', 'DETAIL', 'CHROME', 'UNKNOWN'])
export type DocumentRole = z.infer<typeof DocumentRoleSchema>

/** Which storey a plan is of. NOT_APPLICABLE for an elevation or a render; UNKNOWN when a plan's storey could not be read. */
export const StoreyRoleSchema = z.enum(['GROUND', 'UPPER', 'ATTIC', 'BASEMENT', 'ROOF', 'SITE', 'NOT_APPLICABLE', 'UNKNOWN'])
export type StoreyRole = z.infer<typeof StoreyRoleSchema>

/**
 * What a drawing is annotated WITH. This is a role, not a quality: the same
 * storey is published as a dimensioned plan and as an area-table plan, and
 * they are different sources with different authority — the dimensioned one
 * carries the chains, the area one carries the room table. Merging them as
 * "variants of the same picture" loses the chains.
 */
export const AnnotationRoleSchema = z.enum(['DIMENSIONED', 'AREA_TABLE', 'FURNISHED', 'PLAIN', 'UNKNOWN'])
export type AnnotationRole = z.infer<typeof AnnotationRoleSchema>

/** Which way a view looks. SIDE_UNSPECIFIED is the honest answer when a publisher labels both side elevations identically. */
export const ViewRoleSchema = z.enum(['FRONT', 'REAR', 'SIDE_UNSPECIFIED', 'SIDE_LEFT', 'SIDE_RIGHT', 'AERIAL', 'NOT_APPLICABLE', 'UNKNOWN'])
export type ViewRole = z.infer<typeof ViewRoleSchema>

/** How the world was projected onto the asset. Decides which observations are geometrically meaningful on it. */
export const ProjectionRoleSchema = z.enum(['ORTHOGRAPHIC_ELEVATION', 'ORTHOGRAPHIC_PLAN', 'ORTHOGRAPHIC_SECTION', 'PERSPECTIVE', 'UNKNOWN'])
export type ProjectionRole = z.infer<typeof ProjectionRoleSchema>

export const SourceRolesSchema = z
  .object({
    document: DocumentRoleSchema,
    storey: StoreyRoleSchema,
    annotation: AnnotationRoleSchema,
    view: ViewRoleSchema,
    projection: ProjectionRoleSchema,
  })
  .strict()
export type SourceRoles = z.infer<typeof SourceRolesSchema>

/** Why a role was assigned, so a wrong classification can be argued with rather than merely disbelieved. */
export const RoleEvidenceSchema = z
  .object({
    /** Which role dimension this supports. */
    dimension: z.enum(['document', 'storey', 'annotation', 'view', 'projection']),
    /** What was matched: a URL slug, a caption, a discovery endpoint, a decoded property. */
    signal: z.string(),
    detail: z.string(),
    confidence: z.number().min(0).max(1),
  })
  .strict()
export type RoleEvidence = z.infer<typeof RoleEvidenceSchema>

// ---------------------------------------------------------------------------
// Assets and variants
// ---------------------------------------------------------------------------

/** Dimensions a page CLAIMED for an asset. Kept for the record and never used as geometry. */
export const DeclaredSizeSchema = z.object({ width: z.number().int().positive().optional(), height: z.number().int().positive().optional() }).strict()

/**
 * One fetched encoding of a logical asset: specific bytes at a specific URL.
 * A variant is identified by the SHA-256 of its bytes, so the same picture
 * served twice is one variant and two crops are always two.
 */
export const SourceVariantSchema = z
  .object({
    id: z.string().min(1),
    url: z.string().url(),
    /** Where this URL was found: the page itself, or a discovery endpoint that named it. */
    discoveredVia: z.string().min(1),
    mediaType: z.string().min(1),
    byteLength: z.number().int().nonnegative(),
    /** SHA-256 of the exact bytes. */
    byteHash: z.string().regex(/^[0-9a-f]{64}$/),
    /** What the bytes decode to. The only size any measurement may use. */
    decoded: PixelSizeSchema,
    /** What the page said, when it said anything. */
    declared: DeclaredSizeSchema.optional(),
    /** True when `declared` disagreed with `decoded`: the page cannot be trusted for scale on this asset. */
    declaredMismatch: z.boolean(),
    /** Aspect ratio from the decoded size, to 6 places. */
    aspect: z.number().positive(),
  })
  .strict()
export type SourceVariant = z.infer<typeof SourceVariantSchema>

/**
 * A logical asset: one drawing or picture, with every variant of it that was
 * found. Variants are grouped by ROLE plus aspect, never by URL similarity —
 * two encodings of the same drawing at different resolutions belong together,
 * a differently annotated or differently cropped drawing does not.
 */
export const SourceAssetSchema = z
  .object({
    id: z.string().min(1),
    /** Human label from the page, when one was given. */
    caption: z.string().optional(),
    roles: SourceRolesSchema,
    roleEvidence: z.array(RoleEvidenceSchema),
    /** Every variant found, ordered by the selection rule (best first). */
    variants: z.array(SourceVariantSchema).min(1),
    /** The variant chosen for analysis: `variants[0]`, named explicitly so the choice is auditable. */
    selectedVariantId: z.string().min(1),
    /** Why that variant won. */
    selectionReason: z.string().min(1),
  })
  .strict()
export type SourceAsset = z.infer<typeof SourceAssetSchema>

// ---------------------------------------------------------------------------
// Published facts
// ---------------------------------------------------------------------------

/** A published figure scraped from the page. An aggregate, never a dimension: no geometry may be derived from one. */
export const PublishedFactSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    value: z.number().finite(),
    unit: z.enum(['m', 'm2', 'deg', 'count', 'none']),
    raw: z.string(),
  })
  .strict()
export type PublishedFact = z.infer<typeof PublishedFactSchema>

/**
 * A line of the publisher's technical specification, as printed.
 *
 * Distinct from a published FACT, and the distinction matters. A fact is an
 * aggregate — a floor area, a volume — from which no geometry may be derived,
 * because an area is a sum and a sum does not say what it is a sum of. A
 * specification is the opposite: a direct statement about the building's
 * construction, in the publisher's own words. "dach: dwuspadowy, nachylenie 40
 * st." states a roof kind and a roof pitch, and it states them more plainly
 * than any drawing does.
 *
 * The text is kept whole and unparsed. Turning "25 cm + 20 cm" into a wall
 * thickness is a reading, readings belong in the metric layer where they can
 * carry an association and a confidence, and a package that parsed them here
 * would be deciding what they mean before anything has looked at the drawings.
 */
export const PublishedSpecificationSchema = z
  .object({
    /** A stable key for the subject, from the publisher's own label: `roof`, `walls`, `windows`. `UNKNOWN` when the label is not one this adapter recognises. */
    key: z.string().min(1),
    /** The label exactly as printed, in the publisher's language. */
    label: z.string().min(1),
    /** The text after the label, exactly as printed. */
    text: z.string().min(1),
  })
  .strict()
export type PublishedSpecification = z.infer<typeof PublishedSpecificationSchema>

export const PublishedRoomSchema = z
  .object({
    storey: StoreyRoleSchema,
    index: z.number().int().positive(),
    label: z.string().min(1),
    area: z.number().finite().positive(),
    raw: z.string(),
  })
  .strict()
export type PublishedRoom = z.infer<typeof PublishedRoomSchema>

// ---------------------------------------------------------------------------
// Failures — what did NOT work is part of the package
// ---------------------------------------------------------------------------

export const AcquisitionFailureSchema = z
  .object({
    /** What was being attempted. */
    stage: z.enum(['PAGE', 'DISCOVERY', 'ASSET_FETCH', 'DECODE', 'ROLE', 'FACTS']),
    target: z.string(),
    code: z.string().min(1),
    message: z.string(),
  })
  .strict()
export type AcquisitionFailure = z.infer<typeof AcquisitionFailureSchema>

// ---------------------------------------------------------------------------
// The package
// ---------------------------------------------------------------------------

export const SourcePackageSchema = z
  .object({
    schema: z.literal(SOURCE_PACKAGE_SCHEMA),
    schemaVersion: z.enum(SUPPORTED_SOURCE_PACKAGE_VERSIONS),
    /** Deterministic id, derived from the canonical URL. */
    id: z.string().min(1),
    /** The URL after redirects, normalized. */
    canonicalUrl: z.string().url(),
    /** The URL originally requested, when it differed. */
    requestedUrl: z.string().url().optional(),
    /** SHA-256 of the page bytes the assets were discovered from. */
    pageHash: z.string().regex(/^[0-9a-f]{64}$/),
    /** What the publisher calls this project. */
    project: z
      .object({
        /** The publisher's own identifier, when the URL or page carries one. */
        externalId: z.string().optional(),
        name: z.string().optional(),
        publisher: z.string().min(1),
      })
      .strict(),
    adapter: z.object({ id: z.string().min(1), version: z.string().min(1) }).strict(),
    assets: z.array(SourceAssetSchema),
    publishedFacts: z.array(PublishedFactSchema),
    publishedSpecifications: z.array(PublishedSpecificationSchema),
    publishedRooms: z.array(PublishedRoomSchema),
    failures: z.array(AcquisitionFailureSchema),
    /** Hash of everything above that is content. Excludes fetch timings and any wall-clock value. */
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
export type SourcePackage = z.infer<typeof SourcePackageSchema>

/** Every variant of every asset, flattened — the set of distinct byte blobs the package refers to. */
export const allVariants = (pkg: SourcePackage): SourceVariant[] => pkg.assets.flatMap((a) => a.variants)

/** The variant an asset's analysis must use. */
export function selectedVariant(asset: SourceAsset): SourceVariant {
  const v = asset.variants.find((x) => x.id === asset.selectedVariantId)
  if (!v) throw new Error(`asset ${asset.id} selects ${asset.selectedVariantId}, which is not one of its variants`)
  return v
}

export const assetsWithRole = (pkg: SourcePackage, document: DocumentRole): SourceAsset[] => pkg.assets.filter((a) => a.roles.document === document)

/**
 * Pick the one asset a consumer should analyse for a given job.
 *
 * Ranked, in order: every stated role dimension must match; then the
 * annotation preference (a reader of printed dimensions wants the dimensioned
 * copy, and handing it the area-labelled copy silently gives it a drawing
 * with no chains on it); then the largest DECODED raster; then the asset id,
 * so the answer never depends on discovery order. Returns null rather than a
 * near-miss: a stage that gets the wrong drawing is worse off than one that
 * knows it got none.
 */
export type AssetQuery = { document: DocumentRole; storey?: StoreyRole; view?: ViewRole; preferAnnotation?: AnnotationRole }

const ANNOTATION_RANK: Record<AnnotationRole, number> = { DIMENSIONED: 0, PLAIN: 1, FURNISHED: 2, UNKNOWN: 3, AREA_TABLE: 4 }

export function selectAsset(pkg: SourcePackage, query: AssetQuery): SourceAsset | null {
  const matches = pkg.assets.filter(
    (a) => a.roles.document === query.document && (query.storey === undefined || a.roles.storey === query.storey) && (query.view === undefined || a.roles.view === query.view),
  )
  if (matches.length === 0) return null
  const rankOf = (a: SourceAsset): number => (query.preferAnnotation !== undefined ? (a.roles.annotation === query.preferAnnotation ? -1 : ANNOTATION_RANK[a.roles.annotation]) : ANNOTATION_RANK[a.roles.annotation])
  const area = (a: SourceAsset): number => {
    const v = selectedVariant(a)
    return v.decoded.width * v.decoded.height
  }
  return [...matches].sort((a, b) => rankOf(a) - rankOf(b) || area(b) - area(a) || a.id.localeCompare(b.id))[0]
}
