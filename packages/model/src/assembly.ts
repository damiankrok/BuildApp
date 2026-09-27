/**
 * Reading assemblies: which primitives an assembly references, under which
 * role, and which assemblies an object belongs to.
 *
 * An assembly references its components by stable id and owns no geometry,
 * so everything a caller asks of it — "what are its posts", "is this wall
 * part of a dormer", "what does removing this beam leave behind" — is a walk
 * over these references. They are listed here once, per kind, in a fixed
 * order, so the validator, the DSL's removal cascade, the graph exporter and
 * the viewer all see the same membership.
 */
import type { Assembly, CanonicalBuildingModel } from './schema.js'

export type AssemblyReference = {
  /** The field the id sits in: `planeIds`, `postIds`, `landingId`, … */
  field: string
  id: string
}

const many = (field: string, ids: readonly string[] | undefined): AssemblyReference[] => (ids ?? []).map((id) => ({ field, id }))
const one = (field: string, id: string | undefined): AssemblyReference[] => (id === undefined ? [] : [{ field, id }])

/** Every id an assembly references (components and hosts), in a fixed order. `sourceEvidenceIds` are not objects and are not listed. */
export function assemblyReferences(a: Assembly): AssemblyReference[] {
  const hosts = many('hostIds', a.hostIds)
  switch (a.kind) {
    case 'ROOF':
      return [...many('planeIds', a.planeIds), ...many('edgeIds', a.edgeIds), ...many('openingIds', a.openingIds), ...many('dormerIds', a.dormerIds), ...many('chimneyIds', a.chimneyIds), ...many('trimIds', a.trimIds), ...hosts]
    case 'DORMER':
      return [...one('hostRoofAssemblyId', a.hostRoofAssemblyId), ...many('hostPlaneIds', a.hostPlaneIds), ...many('wallIds', a.wallIds), ...one('localRoofAssemblyId', a.localRoofAssemblyId), ...one('cutOpeningId', a.cutOpeningId), ...many('openingIds', a.openingIds), ...hosts]
    case 'BALCONY':
    case 'TERRACE':
      return [...one('platformId', a.platformId), ...many('railingIds', a.railingIds), ...many('supportIds', a.supportIds), ...hosts]
    case 'LOGGIA':
      return [...one('platformId', a.platformId), ...many('railingIds', a.railingIds), ...many('supportIds', a.supportIds), ...many('recessWallIds', a.recessWallIds), ...hosts]
    case 'CANOPY':
    case 'CARPORT':
      return [...many('supportIds', a.supportIds), ...many('beamIds', a.beamIds), ...one('roofAssemblyId', a.roofAssemblyId), ...one('slabId', a.slabId), ...hosts]
    case 'PERGOLA':
      return [...many('postIds', a.postIds), ...many('primaryBeamIds', a.primaryBeamIds), ...many('secondaryBeamIds', a.secondaryBeamIds), ...one('slabOrTerraceId', a.slabOrTerraceId), ...hosts]
    case 'ENTRANCE':
      return [...one('doorId', a.doorId), ...one('landingId', a.landingId), ...many('stepRunIds', a.stepRunIds), ...one('canopyId', a.canopyId), ...many('supportIds', a.supportIds), ...many('railingIds', a.railingIds), ...hosts]
    case 'EXTERIOR_STAIR':
      return [...many('stepRunIds', a.stepRunIds), ...many('landingIds', a.landingIds), ...many('railingIds', a.railingIds), ...hosts]
    case 'FACADE':
      return [...many('wallIds', a.wallIds), ...many('openingIds', a.openingIds), ...many('memberIds', a.memberIds), ...many('regionIds', a.regionIds), ...hosts]
    case 'GARAGE':
      return [...many('wallIds', a.wallIds), ...many('doorIds', a.doorIds), ...one('roofAssemblyId', a.roofAssemblyId), ...many('roofIds', a.roofIds), ...hosts]
    case 'UNKNOWN':
      return hosts
  }
}

/** The components of an assembly: its references without its hosts. */
export const assemblyComponents = (a: Assembly): AssemblyReference[] => assemblyReferences(a).filter((r) => r.field !== 'hostIds')

/** The assemblies that list `id` as a component (not merely as a host), sorted by id. */
export function assembliesContaining(m: CanonicalBuildingModel, id: string): Assembly[] {
  return m.assemblies.filter((a) => assemblyComponents(a).some((r) => r.id === id)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * The same assembly with `ids` taken out of every reference list; optional
 * single references to a removed id are dropped. What the DSL does to an
 * assembly when one of its components is removed: the assembly survives,
 * with less in it.
 */
export function withoutReferences(a: Assembly, ids: ReadonlySet<string>): Assembly {
  const out: Record<string, unknown> = { ...a }
  for (const [k, v] of Object.entries(a)) {
    if (!REFERENCE_FIELDS.has(k)) continue
    if (Array.isArray(v)) out[k] = (v as string[]).filter((x) => !ids.has(x))
    else if (typeof v === 'string' && ids.has(v)) delete out[k]
  }
  return out as Assembly
}

/** Every field, across all assembly kinds, that holds object references. */
export const REFERENCE_FIELDS: ReadonlySet<string> = new Set([
  'hostIds',
  'planeIds',
  'edgeIds',
  'openingIds',
  'dormerIds',
  'chimneyIds',
  'trimIds',
  'hostRoofAssemblyId',
  'hostPlaneIds',
  'wallIds',
  'localRoofAssemblyId',
  'cutOpeningId',
  'platformId',
  'railingIds',
  'supportIds',
  'recessWallIds',
  'beamIds',
  'roofAssemblyId',
  'slabId',
  'postIds',
  'primaryBeamIds',
  'secondaryBeamIds',
  'slabOrTerraceId',
  'doorId',
  'landingId',
  'stepRunIds',
  'canopyId',
  'landingIds',
  'memberIds',
  'regionIds',
  'doorIds',
  'roofIds',
])
