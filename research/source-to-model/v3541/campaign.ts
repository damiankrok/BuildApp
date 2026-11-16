/**
 * v3.54.1 campaign constants: where the owner's key is read from, which host is called, which models, and the ceilings.
 * Costs are in USD (the provider's currency), priced from the usage the API reports at the list prices read on
 * 2026-11-16 (platform.claude.com/docs/en/about-claude/pricing; the same as HOUSE_READER_PRICES). The owner's budget
 * is in EUR; every ceiling here converts at 1 EUR = 1.00 USD, below any recent EUR/USD rate, so a ceiling in USD never
 * allows more than the euros it stands for. The usage pricing is not the provider's invoice.
 */
export const CAMPAIGN_KEY_VARIABLE = 'BUILDPLAN_ANTHROPIC_API_KEY'
export const CAMPAIGN_API_HOST = 'https://api.anthropic.com'
export const CAMPAIGN_MODELS = { description: 'claude-sonnet-5-5', triage: 'claude-haiku-5-5' } as const
/** Cumulative ceilings of the books, USD at 1 EUR = 1.00 USD: pilot 5 EUR, strategies and development 20 EUR. */
export const CAMPAIGN_PHASE_CEILING_USD = { pilot: 5, development: 20, acceptance: 45 } as const
export const CAMPAIGN_AUTHORIZED_EUR = 100
export const PRICE_SOURCE = { url: 'https://platform.claude.com/docs/en/about-claude/pricing', readOn: '2026-11-16', currency: 'USD' } as const
