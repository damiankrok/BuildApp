/**
 * Source parity (BUILDPLAN-ANALYZER-005B §25): the same acquired page and
 * drawings make the same SourcePackage on the desktop's Node and on the
 * phone's Node — a runtime without ICU, running the text adapter the local
 * analyzer installs there.
 *
 * 005A saw a phone keep one ground-plan copy of four where the desktop kept
 * all four, and could not observe why. A desktop acquisition of the same page
 * bytes under the phone's text semantics keeps all four (measured in 005B;
 * the stage report has the hashes), so the loss is not in how the acquisition
 * orders, folds or names text. This test holds that property on a page in the
 * publisher's shape built here — several copies of one plan, Polish captions
 * with diacritics — so a future change that makes the two runtimes disagree
 * fails here, not on a phone. Nothing here is a third party's page or drawing.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { acquireSourcePackage, archonAdapter } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { PAGE_URL, assetUrl, gifBytes, pngBytes, projectPage, publicResolver, stubFetch, utf8 } from '../../../packages/source-package/test/helpers.js'
import { installTextAdapter, runtimeHasIcu } from '../src/text.js'

const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
const PLAN_DIMENSIONED = assetUrl('rzut-parteru-projekt-test', 901, HASH, 'gif')
const PLAN_AREAS = assetUrl('rzut-parteru-z-powierzchniami-projekt-test', 915, 'f0e1d2c3b4a5968778695a4b3c2d1e0f', 'gif')
const PLAN_MEDIUM = assetUrl('gotowy-projekt-test-rzut-parteru', 550, '00112233445566778899aabbccddeeff')
const PLAN_SMALL = assetUrl('projekt-test-rzut-parteru', 400, 'ffeeddccbbaa99887766554433221100')
/** A drawing whose address says nothing: only its caption, with its diacritic, says it is a section. */
const SECTION = assetUrl('projekt-test', 256, '0f1e2d3c4b5a69788796a5b4c3d2e1f0', 'jpg')
const ATTIC = assetUrl('rzut-poddasza-projekt-test', 917, '1234567890abcdef1234567890abcdef', 'gif')

function routes(): Parameters<typeof stubFetch>[0] {
  const html = projectPage(
    [
      `<img src="${PLAN_DIMENSIONED}" width="853" height="853" alt="Rzut parteru – wymiary">`,
      `<img src="${PLAN_AREAS}" width="853" height="853" alt="Rzut parteru z powierzchniami">`,
      `<img src="${PLAN_MEDIUM}" width="550" height="550" alt="Gotowy projekt: rzut parteru">`,
      `<img src="${PLAN_SMALL}" width="400" height="400" alt="Rzut parteru">`,
      `<img src="${ATTIC}" width="853" height="853" alt="Rzut poddasza użytkowego">`,
      `<img src="${SECTION}" width="400" height="300" alt="Przekrój budynku">`,
      '<table><tr><th>Powierzchnia zabudowy</th><td>118,36 m²</td></tr><tr><th>Kąt nachylenia dachu</th><td>40°</td></tr></table>',
    ].join('\n'),
    'Projekt domu Testowy Dworek Łąkowy (GE)',
  )
  return {
    [PAGE_URL]: { bytes: utf8(html), mediaType: 'text/html; charset=utf-8' },
    [PLAN_DIMENSIONED]: { bytes: gifBytes(853, 853), mediaType: 'image/gif' },
    [PLAN_AREAS]: { bytes: pngBytes(853, 853, 5), mediaType: 'image/png' },
    [PLAN_MEDIUM]: { bytes: pngBytes(550, 550, 6), mediaType: 'image/png' },
    [PLAN_SMALL]: { bytes: pngBytes(400, 400, 7), mediaType: 'image/png' },
    [ATTIC]: { bytes: pngBytes(853, 853, 8), mediaType: 'image/png' },
    [SECTION]: { bytes: pngBytes(400, 300, 9), mediaType: 'image/png' },
  }
}

const acquire = (): Promise<SourcePackage> => acquireSourcePackage(PAGE_URL, [archonAdapter], { deps: { fetchImpl: stubFetch(routes()).fetchImpl, resolve: publicResolver } })

const floorPlans = (pkg: SourcePackage) =>
  pkg.assets
    .filter((a) => a.roles.document === 'FLOOR_PLAN')
    .map((a) => ({ id: a.id, storey: a.roles.storey, annotation: a.roles.annotation, variants: a.variants.map((v) => v.url).sort() }))

/**
 * The phone's runtime, in this process: no `Intl`, `localeCompare` by code
 * unit and `normalize` as the identity (what V8 built without ICU does, as
 * `test/support/no-icu.cjs` sets it up for a child process), then the text
 * adapter the local analyzer installs on such a runtime. Undone after each test.
 */
function phoneRuntime(): () => void {
  const saved = {
    intl: Object.getOwnPropertyDescriptor(globalThis, 'Intl'),
    localeCompare: Object.getOwnPropertyDescriptor(String.prototype, 'localeCompare'),
    normalize: Object.getOwnPropertyDescriptor(String.prototype, 'normalize'),
  }
  delete (globalThis as { Intl?: unknown }).Intl
  Object.defineProperty(String.prototype, 'localeCompare', {
    configurable: true,
    writable: true,
    value: function localeCompare(this: unknown, that: unknown): number {
      const a = String(this)
      const b = String(that)
      if (a === b) return 0
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const d = a.charCodeAt(i) - b.charCodeAt(i)
        if (d !== 0) return d
      }
      return a.length - b.length
    },
  })
  Object.defineProperty(String.prototype, 'normalize', { configurable: true, writable: true, value: function normalize(this: unknown): string { return String(this) } })
  return () => {
    if (saved.intl) Object.defineProperty(globalThis, 'Intl', saved.intl)
    if (saved.localeCompare) Object.defineProperty(String.prototype, 'localeCompare', saved.localeCompare)
    if (saved.normalize) Object.defineProperty(String.prototype, 'normalize', saved.normalize)
  }
}

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
})

describe('the desktop and the phone make the same SourcePackage from the same bytes', () => {
  it('keeps every copy of the plan, with the same roles, ids and content hash', async () => {
    const desktop = await acquire()
    expect(floorPlans(desktop).flatMap((p) => p.variants)).toHaveLength(5)

    restore = phoneRuntime()
    expect(runtimeHasIcu()).toBe(false)
    expect(installTextAdapter()).toBe('embedded-tables')
    const phone = await acquire()
    restore()
    restore = undefined

    expect(floorPlans(phone)).toEqual(floorPlans(desktop))
    expect(phone.failures).toEqual(desktop.failures)
    expect(phone.publishedFacts).toEqual(desktop.publishedFacts)
    expect(phone.assets.find((a) => a.variants.some((v) => v.url === SECTION))?.roles.document).toBe('SECTION')
    expect(phone.contentHash).toBe(desktop.contentHash)
  })

  it('CONTROL: without the text adapter the phone’s bare runtime does not make the same package — the parity above is the adapter’s', async () => {
    const desktop = await acquire()
    restore = phoneRuntime()
    const bare = await acquire().catch((e: unknown) => e)
    restore()
    restore = undefined
    const same = !(bare instanceof Error) && (bare as SourcePackage).contentHash === desktop.contentHash
    expect(same).toBe(false)
  })
})
