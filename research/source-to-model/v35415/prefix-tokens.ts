/**
 * v3.54.15 — the size of each consultant's stable prefix (tools + system), by the provider's token counter (not billed),
 * so a cache breakpoint that reports no cache tokens can be told apart: a prefix below the model's minimum, or a miss.
 * The key is read from the process environment only and never printed.
 */
import Anthropic from '@anthropic-ai/sdk'
import { ELEVATION_SKETCH_SYSTEM } from '../../../packages/analysis-service/src/appearance/elevation-sketch.js'
import { requestBody } from '../../../packages/analysis-service/src/consult/anthropic.js'
import { TOOL as elevationSketchTool } from '../../../packages/analysis-service/src/appearance/elevation-sketch.js'

const key = process.env.BUILDPLAN_ANTHROPIC_API_KEY
if (!key) throw new Error('no key in this process environment')
const client = new Anthropic({ apiKey: key })
const user = [{ role: 'user', content: [{ type: 'text', text: 'x' }] }]
for (const model of ['claude-sonnet-5-5', 'claude-opus-5-5']) {
  for (const strict of [false, true]) {
    const b = requestBody({ model, maxOutputTokens: 100, system: ELEVATION_SKETCH_SYSTEM, messages: user, tools: [elevationSketchTool], strict })
    const all = await client.messages.countTokens({ model, system: b.system as string, messages: user as never, tools: b.tools as never })
    const bare = await client.messages.countTokens({ model, messages: user as never })
    process.stdout.write(`${model} strict=${strict}: with tools+system ${all.input_tokens}, message alone ${bare.input_tokens}, prefix ≈ ${all.input_tokens - bare.input_tokens}\n`)
  }
}
