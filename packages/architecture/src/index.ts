/**
 * @buildapp/architecture — the architectural language over the
 * CanonicalBuildingModel (stage 03G).
 *
 * - registry/     the primitive, assembly, relationship and capability registries
 * - authority.ts  source authority and quantity resolution
 * - proposals.ts  the SemanticProposal interface every detector speaks
 * - hypotheses/   observation → hypothesis → fusion → topology → metric solve → DSL
 * - graphs/       roof graph and assembly graph exports (JSON, SVG, text)
 *
 * The synthetic diversity fixtures and the pipeline demonstrations are test
 * and artifact material, exported separately from `@buildapp/architecture/fixtures`
 * so no production path picks them up by accident.
 */
export * from './registry/primitives.js'
export * from './registry/assemblies.js'
export * from './registry/capabilities.js'
export * from './authority.js'
export * from './proposals.js'
export * from './hypotheses/types.js'
export { groupProposals } from './hypotheses/group.js'
export { AMBIGUITY_MARGIN, ASSEMBLY_OF, decide, scoreFamily } from './hypotheses/fuse.js'
export { applyPipeline, runPipeline } from './hypotheses/pipeline.js'
export * from './graphs/roof-graph.js'
export * from './graphs/assembly-graph.js'
export * from './graphs/svg.js'
