/**
 * v3.54.21 (found on the host's end-to-end run, NEW-H Anna II) — a refusal by the books is one request's BUDGET answer,
 * never the job's failure.
 *
 * The host reserves every request in its spend books before sending it; past its ceiling the books refuse. Each reading
 * step took its reservation outside its own `try`, so the refusal of the structure read escaped `readForm` and the whole
 * job ended as ANALYSIS_FAILED / INTERNAL_ERROR after 12 paid requests (exchange log: `FAILED … HouseReaderUnavailable:
 * this host's ceiling … would be passed`). Every step now takes the reservation inside its `try`: a refusal is answered like
 * any unavailable transport — named BUDGET, nothing sent, nothing settled — and the analysis goes on without that read.
 */
import { describe, expect, it } from 'vitest'
import { readForm } from '../src/consult/form-read.js'
import { readPlanOutline } from '../src/consult/plan-outline.js'
import { readSiteDimensions } from '../src/consult/site-dimensions.js'
import { readFacadeMetric } from '../src/consult/facade-metric.js'
import { readDimensions } from '../src/consult/metric-read.js'
import { readElevationSketch } from '../src/appearance/elevation-sketch.js'
import { ConsultantUnavailable, reserveOrUnavailable } from '../src/consult/loop.js'
import type { ConsultSpend, ConsultantModel } from '../src/consult/loop.js'

const raster = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) })
const price = { inputUsdPerMTok: 4, outputUsdPerMTok: 20 }
class Refused extends Error {
  readonly reason = 'BUDGET'
}

/** books past their ceiling (they throw their own error type, as the host's do) and a transport that must not be used */
function setup() {
  const settled: unknown[] = []
  const spend: ConsultSpend = {
    reserve: () => {
      throw new Refused("this host's ceiling of 1 USD would be passed")
    },
    settle: (r, actual) => {
      settled.push({ r, actual })
    },
  }
  let sent = 0
  const model: ConsultantModel = {
    id: 'never',
    model: 'claude-sonnet-5-5',
    maxOutputTokens: 4000,
    send: async () => {
      sent += 1
      throw new Error('a refused request must not be sent')
    },
  }
  return { ctx: { model, price, spend }, settled, sent: () => sent }
}

describe('v3.54.21: the books refuse — the step answers BUDGET, sends nothing, settles nothing, and does not throw', () => {
  it('the shared helper turns any refusal of the books into a BUDGET unavailability (and passes without books)', () => {
    const { ctx } = setup()
    expect(() => reserveOrUnavailable(ctx.spend, 'm', 0.2, 'n')).toThrow(ConsultantUnavailable)
    try {
      reserveOrUnavailable(ctx.spend, 'm', 0.2, 'n')
    } catch (e) {
      expect((e as ConsultantUnavailable).reason).toBe('BUDGET')
      expect((e as Error).message).toMatch(/ceiling of 1 USD/)
    }
    expect(reserveOrUnavailable(undefined, 'm', 0.2, 'n')).toBeUndefined()
  })

  it('the structure read: no answer, named BUDGET_REFUSED (not a transport failure)', async () => {
    const s = setup()
    const r = await readForm(s.ctx, [{ caption: 'FRONT', raster: raster(400, 200) }], { plan: raster(400, 300) })
    expect(r.form).toBeUndefined()
    expect(r.answeredBy?.unanswered).toBe('BUDGET_REFUSED')
    expect(r.refused[0]).toMatch(/^BUDGET: /)
    expect(s.sent()).toBe(0)
    expect(s.settled).toEqual([])
  })

  it('the plan outline, the site dimensions, the facade metric and the elevation sketch: each refused, none sent', async () => {
    const s = setup()
    const outline = await readPlanOutline(s.ctx, { frameId: 'P', raster: raster(400, 300), caption: 'rzut', sourceByteHash: 'h' })
    expect(outline.refused[0]).toMatch(/^BUDGET: /)
    const site = await readSiteDimensions(s.ctx, { frameId: 'S', raster: raster(400, 300), caption: 'działka' })
    expect(site.refused[0]).toMatch(/^BUDGET: /)
    const facade = await readFacadeMetric(s.ctx, { frameId: 'E', raster: raster(400, 200), side: 'FRONT', widthM: 10, caption: 'front' })
    expect(facade.refused[0]).toMatch(/^BUDGET: /)
    expect(facade.openings).toEqual([])
    const sketch = await readElevationSketch(s.ctx, { frameId: 'E', raster: raster(400, 200), caption: 'front' })
    expect(sketch.failed).toMatch(/^BUDGET: /)
    expect(s.sent()).toBe(0)
    expect(s.settled).toEqual([])
  })

  it('the metric read: the frame comes back refused, the analysis keeps its own reading', async () => {
    const s = setup()
    const [r] = await readDimensions(s.ctx, [{ frameId: 'F', kind: 'PLAN', storey: 'GROUND', raster: raster(2000, 1000), caption: 'rzut parteru' }])
    expect(r.observations).toEqual([])
    expect(r.refused.join(' ')).toMatch(/BUDGET: /)
    expect(s.sent()).toBe(0)
    expect(s.settled).toEqual([])
  })
})
