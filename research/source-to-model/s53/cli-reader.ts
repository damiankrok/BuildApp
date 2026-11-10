/**
 * v3.53 S53 research: the session's headless CLI as a `StructuredVision` (the product seam), so the PRODUCT path
 * (`analysis-service` `runDescribedAnalysis` / `analyseLink`) can be measured here, where no API key exists. Every call
 * goes through the cumulative spend ledger. Research only; nothing under packages/ or apps/ imports it.
 */
import type { StructuredVision } from '@buildapp/source-vision'
import type { SpendGuard } from '../../ai-assist/claude-code-reasoner.js'
import { claudeCodeMulti } from './cc-multi.js'

export function cliStructuredVision(opts: { model: string; triageModel: string; effort?: string; guard: SpendGuard; what: string; capUsd?: number; onCall?: (c: unknown) => void }): StructuredVision {
  return {
    provider: { id: 'house-reader.claude-code-cli', model: opts.model, triageModel: opts.triageModel, version: 'research' },
    available: () => true,
    ask: async (request) => {
      const triage = request.purpose === 'HOUSE_TRIAGE'
      const { output, call } = await claudeCodeMulti({ model: triage ? opts.triageModel : opts.model, system: request.system, images: request.pictures, text: request.text, schema: request.schema, capUsd: triage ? 0.08 : (opts.capUsd ?? 0.7), ...(!triage && opts.effort ? { effort: opts.effort } : {}), guard: opts.guard, what: `${request.purpose} ${opts.what}` })
      opts.onCall?.({ purpose: request.purpose, ...call, raw: undefined })
      return { output, usage: { inputTokens: (call.usage.inputTokens ?? 0) + (call.usage.cacheCreationTokens ?? 0) + (call.usage.cacheReadTokens ?? 0), outputTokens: call.usage.outputTokens ?? undefined, estimatedCostUsd: call.estimatedCostUsd ?? undefined, latencyMs: call.latencyMs, model: triage ? opts.triageModel : opts.model } }
    },
  }
}
