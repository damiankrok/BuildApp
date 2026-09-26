/**
 * BUILDAPP-03Y2G: the second real project is evaluation, never input.
 *
 * Dom w rarytasach 5 (G2E) is now a regression project beside Marcówki. The
 * generic fixes this stage made had to come from what its drawings showed
 * about a CLASS of plans — a sheet scale OCR can misread, a projecting double
 * garage, a level symbol with no rule — and not from the project itself. So:
 * no production file names it, carries its publisher id, or reads the sealed
 * artifacts saved from it; and the solver carries none of its dimensions.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')

/** Every production source: the packages the analyzer, the service and the apps run, and the Android app. */
const PRODUCTION = [
  ...['analysis-service', 'commands', 'geometry', 'image-metrology', 'mobile-scene', 'model', 'reconstruction', 'source-analyzer', 'source-common', 'source-cv', 'source-metrics', 'source-observations', 'source-package', 'source-vision', 'verification'].map((p) => `packages/${p}/src`),
  'apps/local-analyzer/src',
  'apps/analyzer-api/src',
  'apps/android/app/src/main',
]

function files(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const full = join(d, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|tsx|mjs|js|kt|xml|json)$/.test(name)) out.push(full)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

const all = PRODUCTION.flatMap((d) => files(join(ROOT, d)))
const rel = (f: string): string => relative(ROOT, f)
const codeOf = (f: string): string => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('the second house is evaluation, never input', () => {
  it('finds the production sources it checks', () => {
    expect(all.length).toBeGreaterThan(150)
  })

  it('no production file — code or comment — names the project or carries its publisher id', () => {
    for (const file of all) {
      const text = readFileSync(file, 'utf8').toLowerCase()
      for (const term of ['rarytas', 'm84f2903cb8e14']) expect(text.includes(term), `${rel(file)} mentions ${term}`).toBe(false)
    }
  })

  it('no production file reads the sealed second-house artifacts, research or evaluation material', () => {
    for (const file of all) {
      const code = codeOf(file)
      for (const path of ['rarytasy-generalization', 'stage-reports/artifacts', 'research/', 'tests/benchmark', 'reference-marcowki']) {
        expect(code.includes(path), `${rel(file)} refers to ${path}`).toBe(false)
      }
    }
  })

  it('the solver and the readers this stage changed carry none of the project’s dimensions', () => {
    // The drawing's own chains: 17.20 × 8.50 m, a 6.88 × 6.24 m garage, 14.74 m deep,
    // 189.77 m² built, a 5.00 m door, ridge +5.70 and eaves +3.24.
    const known = ['17.2', '14.74', '6.88', '6.24', '189.77', '1474', '1720', '688', '624']
    const changed = ['packages/reconstruction/src', 'packages/source-metrics/src', 'packages/source-cv/src', 'packages/analysis-service/src'].flatMap((d) => files(join(ROOT, d)))
    for (const file of changed) {
      const code = codeOf(file)
      for (const value of known) {
        const pattern = new RegExp(`(?<![0-9.])${value.replace('.', '\\.')}(?![0-9])`)
        expect(pattern.test(code), `${rel(file)} carries ${value}`).toBe(false)
      }
    }
  })
})
