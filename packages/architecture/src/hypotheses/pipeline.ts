/**
 * The HYPOTHESIS PIPELINE: observation → hypothesis → fusion → topology →
 * metric solve → Building DSL.
 *
 *   1. OBSERVATION   semantic proposals from any detector (proposals.ts), validated.
 *   2. HYPOTHESIS    proposals grouped into candidate features (group.ts).
 *   3. FUSION        every family scored by its capability's evidence requirements
 *                    and exclusions; ACCEPTED / UNKNOWN / REJECTED (fuse.ts).
 *   4. TOPOLOGY      what stands on, joins or attaches to what (emit.ts).
 *   5. METRIC SOLVE  every value by source authority, conflicts recorded (emit.ts).
 *   6. DSL           Building DSL commands, applied and re-validated by the
 *                    command layer, drawn by the compiler (emit.ts).
 *
 * The pipeline reads its context model and writes nothing: its product is a
 * program. No semantic object exists before stage 6, and nothing here can
 * make a triangle.
 */
import { applyCommands } from '@buildapp/commands'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { parseProposals, type SemanticProposal } from '../proposals.js'
import { EMITTERS, emitUnknown, type EmitContext } from './emit.js'
import { decide } from './fuse.js'
import { groupProposals } from './group.js'
import type { Hypothesis, PipelineInput, PipelineResult } from './types.js'

export function runPipeline(input: PipelineInput): PipelineResult {
  const parsed = parseProposals(input.proposals)
  if (!parsed.ok) throw new Error(`invalid proposals: ${parsed.errors.join('; ')}`)
  const proposals = [...parsed.proposals].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const log: PipelineResult['log'] = []
  const frames = [...new Set(proposals.map((p) => p.sourceFrameId))].sort()
  const detectors = [...new Set(proposals.map((p) => p.detector))].sort()
  log.push({ stage: 'OBSERVATION', message: `${proposals.length} proposals from ${frames.length} frames (${detectors.join(', ')})` })
  const { groups, unused } = groupProposals(proposals)
  if (unused.length > 0) log.push({ stage: 'OBSERVATION', message: `values with no feature to belong to: ${unused.join(', ')}` })
  const byId = new Map(proposals.map((p) => [p.id, p]))
  const members = (ids: readonly string[]): SemanticProposal[] => ids.map((id) => byId.get(id) as SemanticProposal)
  const hypotheses: Hypothesis[] = groups.map((g, i) => {
    const h = decide(g, members(g.proposalIds), i)
    log.push({ stage: 'HYPOTHESIS', hypothesisId: h.id, message: `${g.id}: ${g.proposalIds.length} proposals from ${g.frames.length} frame${g.frames.length === 1 ? '' : 's'}` })
    log.push({ stage: 'FUSION', hypothesisId: h.id, message: `${h.decision}${h.family ? ` ${h.family}` : ''} (${h.confidence}): ${h.reasons.join('; ')}` })
    return h
  })
  const ctx: EmitContext = { model: input.context, prefix: input.idPrefix ?? 'hyp', quantities: [], commands: [], log, defined: new Set() }
  const emitted: PipelineResult['emitted'] = []
  for (const h of hypotheses) {
    const group = groups.find((g) => g.id === h.groupId)
    const ps = members(group?.proposalIds ?? [])
    if (h.decision === 'REJECTED') continue
    if (h.decision === 'ACCEPTED' && h.family) {
      const mark = ctx.commands.length
      const qmark = ctx.quantities.length
      const out = EMITTERS[h.family](ctx, h, ps)
      if (out.ok) {
        emitted.push({ hypothesisId: h.id, assemblyIds: out.assemblyIds, objectIds: out.objectIds })
        continue
      }
      // the family was concluded but the geometry cannot be stated against the context: it stays unknown
      ctx.commands.length = mark
      ctx.quantities.length = qmark
      log.push({ stage: 'TOPOLOGY', hypothesisId: h.id, message: `${h.family.toLowerCase()} cannot be stated: ${out.reason}; kept as unknown` })
      h.alternatives = [{ kind: h.family === 'EXTERIOR_STEPS' ? 'EXTERIOR_STAIR' : h.family, confidence: Math.min(0.95, h.confidence), why: out.reason }, ...h.alternatives]
      h.reasons.push(`${h.family.toLowerCase()} fits the evidence but ${out.reason}`)
      h.decision = 'UNKNOWN'
      h.capability = 'UNKNOWN_ASSEMBLY'
      delete h.family
    }
    const out = emitUnknown(ctx, h, ps)
    if (out.ok) emitted.push({ hypothesisId: h.id, assemblyIds: out.assemblyIds, objectIds: out.objectIds })
  }
  return { proposals, groups, hypotheses, quantities: ctx.quantities, commands: ctx.commands, emitted, log }
}

/** The context model with the pipeline's program applied; throws, naming the command, when one is refused. */
export function applyPipeline(context: CanonicalBuildingModel, result: PipelineResult): CanonicalBuildingModel {
  const r = applyCommands(context, result.commands)
  if (r.failedAt !== undefined) {
    const res = r.results[r.failedAt]
    throw new Error(`pipeline command ${r.failedAt} (${result.commands[r.failedAt]?.type}) refused: ${res && !res.ok ? res.errors.map((e) => `[${e.code}] ${e.message}`).join('; ') : '?'}`)
  }
  return r.model
}
