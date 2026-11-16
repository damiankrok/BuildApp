import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { consultantPlan, productionWiring } from '../src/wiring.js'

// v3.54.2 pilot: the consultant is off by default, on only behind its switch with the reader's ceiling and token, and
// never together with the global house reader.
describe('v3.54.2 consultant wiring', () => {
  const dir = mkdtempSync(join(tmpdir(), 'consultant-'))
  const base = { ANALYZER_HOUSE_READER_MAX_USD: '24', ANALYZER_HOUSE_READER_TOKEN: 'x'.repeat(32), ANALYZER_DATA_DIR: dir }
  it('is off by default: the default wiring has neither a consultant nor a house reader', () => {
    const w = productionWiring({})
    expect(consultantPlan({}).on).toBe(false)
    expect(w.consultant).toBeUndefined()
    expect(w.houseReader).toBeUndefined()
  })
  it('needs a ceiling and a token as the reader does', () => {
    expect(consultantPlan({ ANALYZER_CONSULTANT: 'pilot' }).on).toBe(false)
    expect(consultantPlan({ ANALYZER_CONSULTANT: 'pilot', ...base }).on).toBe(true)
  })
  it('replaces the house reader: with both switches on, only the consultant is wired (no global description branch)', () => {
    const w = productionWiring({ ANALYZER_CONSULTANT: 'pilot', ANALYZER_HOUSE_READER: 'live', ...base })
    expect(w.consultant?.variant).toBe('C')
    expect(w.consultant?.model.model).toBe('claude-sonnet-5-5')
    expect(w.houseReader).toBeUndefined()
  })
})
