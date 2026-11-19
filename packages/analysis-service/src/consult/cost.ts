/**
 * v3.54.15 — one price and one cost for every consultant request (metric read, check, sketches, label rounds, looks).
 *
 * Four token counts, each at its own rate (provider's list prices, platform.claude.com pricing / prompt caching,
 * checked 2026-11-19 through the claude-api reference): regular input, cache writes (5-minute entries at 1.25× input,
 * 1-hour entries at 2× input), cache reads (model-specific: 0.05× on Opus 5.5 and Sonnet 5.5) and output. A usage that
 * reports cache writes without the TTL split is priced as 1-hour writes (the dearer rate: never under-booked).
 * The reservation before a request assumes the whole prompt is written to the cache at the dearest TTL in use — the
 * cold write — so a cache never lets a request pass the ceiling it would otherwise have been refused at.
 */
export type Price = {
  inputUsdPerMTok: number
  outputUsdPerMTok: number
  /** Absent: the model's cache rates are unknown and caching is not requested for it. */
  cacheReadUsdPerMTok?: number
  cacheWrite5mUsdPerMTok?: number
  cacheWrite1hUsdPerMTok?: number
}

export const COST_VERSION = '1.0.0' as const

/** List prices per million tokens (2026-11-19). A model that is not here is not priced and not asked. */
export const CONSULT_PRICES: Record<string, Price> = {
  'claude-opus-5-5': { inputUsdPerMTok: 4, outputUsdPerMTok: 20, cacheReadUsdPerMTok: 0.2, cacheWrite5mUsdPerMTok: 5, cacheWrite1hUsdPerMTok: 8 },
  'claude-sonnet-5-5': { inputUsdPerMTok: 2, outputUsdPerMTok: 10, cacheReadUsdPerMTok: 0.1, cacheWrite5mUsdPerMTok: 2.5, cacheWrite1hUsdPerMTok: 4 },
}

export type TurnUsage = { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number; cacheCreation5mInputTokens?: number; cacheCreation1hInputTokens?: number }
export type CostBreakdown = { usd: number; inputUsd: number; cacheWriteUsd: number; cacheReadUsd: number; outputUsd: number; tokens: { input: number; cacheWrite5m: number; cacheWrite1h: number; cacheRead: number; output: number } }

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6

export function costOf(price: Price, u: TurnUsage): CostBreakdown {
  const input = u.inputTokens ?? 0
  const output = u.outputTokens ?? 0
  const read = u.cacheReadInputTokens ?? 0
  const total = u.cacheCreationInputTokens ?? 0
  const w5 = u.cacheCreation5mInputTokens ?? 0
  const w1 = u.cacheCreation1hInputTokens ?? (u.cacheCreation5mInputTokens === undefined ? total : Math.max(0, total - w5))
  const writeRate5 = price.cacheWrite5mUsdPerMTok ?? price.inputUsdPerMTok * 1.25
  const writeRate1 = price.cacheWrite1hUsdPerMTok ?? price.inputUsdPerMTok * 2
  const readRate = price.cacheReadUsdPerMTok ?? price.inputUsdPerMTok
  const inputUsd = (input * price.inputUsdPerMTok) / 1e6
  const cacheWriteUsd = (w5 * writeRate5 + w1 * writeRate1) / 1e6
  const cacheReadUsd = (read * readRate) / 1e6
  const outputUsd = (output * price.outputUsdPerMTok) / 1e6
  return { usd: r6(inputUsd + cacheWriteUsd + cacheReadUsd + outputUsd), inputUsd: r6(inputUsd), cacheWriteUsd: r6(cacheWriteUsd), cacheReadUsd: r6(cacheReadUsd), outputUsd: r6(outputUsd), tokens: { input, cacheWrite5m: w5, cacheWrite1h: w1, cacheRead: read, output } }
}

/** The worst case of one request: every prompt token written to the cache at the dearest rate in use, full output. */
export function reserveOf(price: Price, promptTokens: number, maxOutputTokens: number, cache?: { ttl: '5m' | '1h' }): number {
  const inRate = !cache ? price.inputUsdPerMTok : Math.max(price.inputUsdPerMTok, cache.ttl === '1h' ? price.cacheWrite1hUsdPerMTok ?? price.inputUsdPerMTok * 2 : price.cacheWrite5mUsdPerMTok ?? price.inputUsdPerMTok * 1.25)
  return r6((promptTokens * inRate + maxOutputTokens * price.outputUsdPerMTok) / 1e6)
}
