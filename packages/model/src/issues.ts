/**
 * Validation issue vocabulary, shared by the semantic validator, the wall
 * topology resolver and the schema migration so that every problem a model
 * can have is reported with one named code.
 */
export type ValidationCode =
  | 'SCHEMA'
  | 'SCHEMA_MIGRATED'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'DUPLICATE_ID'
  | 'MISSING_BUILDING'
  | 'UNKNOWN_BUILDING'
  | 'UNKNOWN_LEVEL'
  | 'UNKNOWN_WALL'
  | 'UNKNOWN_JUNCTION'
  | 'UNKNOWN_OPENING'
  | 'UNKNOWN_ROOF'
  | 'UNKNOWN_MATERIAL'
  | 'UNKNOWN_TARGET'
  | 'UNKNOWN_EVIDENCE_SOURCE'
  | 'DUPLICATE_LEVEL_INDEX'
  | 'DEGENERATE_WALL'
  | 'OPENING_OUTSIDE_HOST'
  | 'OPENING_TOUCHES_WALL_EDGE'
  | 'OPENING_IN_JUNCTION_ZONE'
  | 'OPENINGS_OVERLAP'
  | 'FILL_KIND_MISMATCH'
  | 'OPENING_FILLED_TWICE'
  | 'MALFORMED_POLYGON'
  | 'INVALID_RECT'
  | 'INVALID_ROOF'
  | 'DEGENERATE_RAILING'
  | 'FILL_TOO_LARGE'
  | 'FILL_PROFILE_UNSUPPORTED'
  // --- multi-leaf openings ---
  | 'OPENING_LEAF_INVALID'
  | 'OPENING_LEAF_LEVEL_MISMATCH'
  | 'OPENING_LEAF_NOT_PARALLEL'
  // --- roof openings ---
  | 'UNKNOWN_ROOF_OPENING'
  | 'ROOF_OPENING_OUTSIDE_HOST'
  | 'ROOF_OPENING_CROSSES_RIDGE'
  | 'ROOF_OPENINGS_OVERLAP'
  | 'ROOF_OPENING_FILLED_TWICE'
  | 'ROOF_PENETRATION_MISMATCH'
  // --- schema 1.3.0: slab holes, stairs, door assemblies, surface regions ---
  | 'SLAB_HOLE_OUTSIDE'
  | 'SLAB_HOLES_OVERLAP'
  | 'STAIR_RISE_INVALID'
  | 'STAIR_LAYOUT_INVALID'
  | 'STAIR_OUTSIDE_FOOTPRINT'
  | 'DOOR_ASSEMBLY_INVALID'
  | 'SURFACE_REGION_HOST_INVALID'
  | 'SURFACE_REGION_OUTSIDE_HOST'
  // --- schema 1.4.0: linear solids ---
  | 'LINEAR_SOLID_DEGENERATE'
  | 'LINEAR_SOLID_HOST_INVALID'
  // --- wall topology (topology.ts) ---
  | 'JUNCTION_SELF_REFERENCE'
  | 'JUNCTION_OWNER_NOT_PARTICIPANT'
  | 'JUNCTION_LEVEL_MISMATCH'
  | 'JUNCTION_PARALLEL_WALLS'
  | 'JUNCTION_GAP'
  | 'JUNCTION_OVERSHOOT'
  | 'JUNCTION_KIND_MIX'
  | 'ENDPOINT_JUNCTION_CONFLICT'
  | 'BUTT_OFF_HOST'
  | 'T_JUNCTION_POSITION'
  | 'WALL_CONSUMED'
  | 'WALLS_OVERLAP'
  | 'RING_DEGENERATE'
  | 'RING_NOT_CLOSED'
  | 'RING_LEVEL_MISMATCH'

export type ValidationIssue = {
  code: ValidationCode
  severity: 'ERROR' | 'WARNING'
  message: string
  objectId?: string
  path?: string
  /** Measured quantity behind the issue (a gap, an overlap area, ...), in model units. */
  measured?: number
}

export type ValidationResult = { ok: boolean; issues: ValidationIssue[] }

export const fmtNumber = (n: number): string => (Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : n.toFixed(3))
