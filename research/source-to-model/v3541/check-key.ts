/**
 * v3.54.1: is the owner's key usable here, without spending anything and without showing it?
 *
 * Reads the key ONLY from BUILDPLAN_ANTHROPIC_API_KEY (an environment variable the owner sets in the environment's
 * settings — never typed into a chat, a file of the repository or an argument). The default name ANTHROPIC_API_KEY is
 * deliberately not used: the coding agent of this session could pick it up and pay for its own work from the owner's
 * campaign budget. Lists the models the key may call (GET /v1/models, not billed) against the API's own host and
 * prints whether the campaign's models are among them. Prints no part of the key.
 *
 *   npx vite-node research/source-to-model/v3541/check-key.ts
 * Exit: 0 usable, 2 no key in the environment, 3 refused (bad key / no permission), 4 the campaign model is missing.
 */
import Anthropic from '@anthropic-ai/sdk'
import { CAMPAIGN_API_HOST, CAMPAIGN_KEY_VARIABLE, CAMPAIGN_MODELS } from './campaign.js'

const WANTED: string[] = [CAMPAIGN_MODELS.description, CAMPAIGN_MODELS.triage]

async function main(): Promise<number> {
  const key = process.env[CAMPAIGN_KEY_VARIABLE] ?? ''
  if (key.length === 0) {
    console.log(JSON.stringify({ ok: false, why: `${CAMPAIGN_KEY_VARIABLE} is not set in this environment` }))
    return 2
  }
  // explicit key and host: no ambient credential (ANTHROPIC_AUTH_TOKEN, a profile, ANTHROPIC_BASE_URL) can stand in
  const client = new Anthropic({ apiKey: key, authToken: null, baseURL: CAMPAIGN_API_HOST, maxRetries: 0, timeout: 30_000 })
  try {
    const ids: string[] = []
    for await (const m of client.models.list({ limit: 100 })) ids.push(m.id)
    const missing = WANTED.filter((w) => !ids.includes(w))
    console.log(JSON.stringify({ ok: missing.length === 0, host: CAMPAIGN_API_HOST, models: ids.length, campaignModels: WANTED.map((w) => ({ id: w, available: ids.includes(w) })) }))
    return missing.length === 0 ? 0 : 4
  } catch (e) {
    const status = (e as { status?: number }).status
    console.log(JSON.stringify({ ok: false, status: status ?? null, why: String((e as Error).message ?? e).replace(key, '[key]').slice(0, 200) }))
    return 3
  }
}

main().then((code) => process.exit(code))
