/**
 * Deterministic id generation.
 *
 * Commands may state the id of the object they create; when they do not, the
 * id is `<prefix>-<n>` with the smallest positive `n` not yet used anywhere in
 * the model. No clock, no randomness, no global counter: the same command
 * sequence always yields the same ids, which is what makes the demo building
 * and every test reproducible.
 */
import type { CanonicalBuildingModel, SemanticKind } from './schema.js'
import { allObjectIds } from './query.js'

export const ID_PREFIX: Record<SemanticKind, string> = {
  building: 'building',
  level: 'level',
  room: 'room',
  wall: 'wall',
  wallJunction: 'junction',
  wallRing: 'ring',
  opening: 'opening',
  window: 'window',
  door: 'door',
  slab: 'slab',
  roof: 'roof',
  roofOpening: 'roof-opening',
  rooflight: 'rooflight',
  balcony: 'balcony',
  railing: 'railing',
  chimney: 'chimney',
  stair: 'stair',
  surfaceRegion: 'region',
  linearSolid: 'solid',
  terrace: 'terrace',
  material: 'material',
  constraint: 'constraint',
  evidenceSource: 'source',
}

export function nextId(model: CanonicalBuildingModel, kind: SemanticKind, requested?: string): string {
  if (requested !== undefined) return requested
  const used = new Set(allObjectIds(model))
  const prefix = ID_PREFIX[kind]
  for (let n = 1; ; n++) {
    const candidate = `${prefix}-${n}`
    if (!used.has(candidate)) return candidate
  }
}
