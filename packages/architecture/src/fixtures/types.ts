import type { BuildingCommand } from '@buildapp/commands'
import type { AssemblyKind, RoofClassification } from '@buildapp/model'
import type { CapabilityKey } from '../registry/capabilities.js'
import type { PrimitiveType } from '../registry/primitives.js'

/**
 * One synthetic architectural diversity fixture: a generic building stated as
 * Building DSL commands, what it proves, and what its model must hold.
 */
export type ArchitecturalFixture = {
  id: string
  title: string
  capabilities: CapabilityKey[]
  commands: () => BuildingCommand[]
  expect: {
    /** Assemblies by kind, exactly. */
    assemblies: Partial<Record<AssemblyKind, number>>
    /** Primitives by type, exactly. */
    primitives: Partial<Record<PrimitiveType, number>>
    /** The classifications of the model's roof assemblies, sorted by assembly id. */
    roofClassifications?: RoofClassification[]
    minRelationships: number
  }
}
