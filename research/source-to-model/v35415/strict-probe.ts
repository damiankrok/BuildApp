/**
 * v3.54.15 — every consultant tool's schema as the strict transport sends it, put to the provider's token counter (not
 * billed): a schema the provider cannot compile is named with the provider's own message before any paid request.
 * The key is read from the process environment only and never printed.
 */
import Anthropic from '@anthropic-ai/sdk'
import { requestBody } from '../../../packages/analysis-service/src/consult/anthropic.js'
import { CHECK_REGION_TOOL, REVIEW_TOOL, SOURCE_REGION_TOOL } from '../../../packages/analysis-service/src/consult/loop.js'
import { TOOL as SKETCH_TOOL } from '../../../packages/analysis-service/src/appearance/elevation-sketch.js'
import { ELEVATION_TOOL } from '../../../packages/analysis-service/src/house/read.js'
import { REVIEW_TOOL as HOUSE_REVIEW_TOOL, SUPPLEMENT_TOOL } from '../../../packages/analysis-service/src/house/review.js'

const key = process.env.BUILDPLAN_ANTHROPIC_API_KEY
if (!key) throw new Error('no key in this process environment')
const client = new Anthropic({ apiKey: key })
const user = [{ role: 'user', content: [{ type: 'text', text: 'x' }] }]
const tools: Record<string, unknown> = { REVIEW_TOOL, SOURCE_REGION_TOOL, CHECK_REGION_TOOL, SKETCH_TOOL, ELEVATION_TOOL, HOUSE_REVIEW_TOOL, SUPPLEMENT_TOOL }
for (const [name, tool] of Object.entries(tools)) {
  const b = requestBody({ model: 'claude-sonnet-5-5', maxOutputTokens: 16, system: 'S', messages: user, tools: [tool], strict: true })
  try {
    const r = await client.messages.countTokens({ model: 'claude-sonnet-5-5', system: 'S', messages: user as never, tools: b.tools as never })
    process.stdout.write(`${name}: accepted (${r.input_tokens} tokens)\n`)
  } catch (e) {
    process.stdout.write(`${name}: REJECTED ${(e as Error).message.slice(0, 400)}\n`)
  }
}
