/**
 * Architecture tests for the source analyzer.
 *
 * Four boundaries, each of which fails quietly and expensively if it is not
 * enforced mechanically:
 *
 *  1. **No Marcówki in the extractors.** The whole point of a benchmark is
 *     that the thing being measured does not know it is being measured. An
 *     extractor that imports the reference package, matches a project id, or
 *     carries a known coordinate is not an extractor, it is a lookup table
 *     with a good story — and it will produce a perfect benchmark and nothing
 *     on the next project.
 *  2. **Observations are not geometry.** Nothing in the observation layer may
 *     emit a DSL command, a mesh, a triangle or a metre. The vision providers
 *     answer in the observation vocabulary and nothing else.
 *  3. **The observation layer stays pure.** No Node APIs, no DOM, no
 *     Three.js, no model or geometry dependency — so the browser can read a
 *     sealed graph without pulling in an acquisition stack.
 *  4. **The web does not scrape.** BuildWorld reads sealed packages; it does
 *     not fetch a publisher, decode an image, or run an extractor, so "the CLI
 *     and the web app analysed the same sources" is a fact about the code.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')

function filesUnder(dir: string, ext = /\.tsx?$/): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === 'dist') continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ext.test(name)) out.push(p)
    }
  }
  walk(dir)
  return out
}

/** Source with comments stripped but string literals kept: a name in a literal is knowledge, a name in prose is documentation. */
const withoutComments = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')

/** Source with comments and string literals blanked, so prose about a rule never trips the rule. */
const codeOf = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')

const packageSrc = (name: string): string[] => filesUnder(resolve(ROOT, 'packages', name, 'src'))

/** Everything on the production analyzer path: acquisition, CV, observations, vision, extraction. */
const ANALYZER_PACKAGES = ['source-common', 'source-cv', 'source-package', 'source-observations', 'source-vision', 'source-analyzer'] as const
const analyzerFiles = ANALYZER_PACKAGES.flatMap(packageSrc)

describe('the analyzer has source files to check', () => {
  it('finds all six packages', () => {
    for (const name of ANALYZER_PACKAGES) expect(packageSrc(name).length, name).toBeGreaterThan(0)
    expect(analyzerFiles.length).toBeGreaterThan(20)
  })
})

describe('no Marcówki in the production extractors', () => {
  it('never imports the reference package', () => {
    for (const file of analyzerFiles) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('@buildapp/reference-marcowki')
    }
  })

  it('never names the benchmark project, its publisher, or its id', () => {
    for (const file of analyzerFiles) {
      // Comments may explain which benchmark a rule came from; code may not
      // contain the name, in a literal or anywhere else.
      const text = withoutComments(file).toLowerCase()
      // One adapter knows one publisher; the package barrel may name it to
      // export it, and nothing else may mention it at all.
      const isAdapter = file.includes(join('adapters', 'archon')) || file.endsWith(join('source-package', 'src', 'index.ts'))
      for (const term of ['marcowki', 'marcówki', 'm2fa281446a8ca']) {
        expect(text.includes(term), `${file} mentions ${term}`).toBe(false)
      }
      // One adapter knows one publisher; nothing else may.
      if (!isAdapter) expect(text.includes('archon'), `${file} mentions archon`).toBe(false)
    }
  })

  it('never branches on a project id or a project name', () => {
    for (const file of analyzerFiles) {
      const code = codeOf(file)
      for (const pattern of [/\bprojectId\s*===/, /\bproject\.name\s*===/, /\bexternalId\s*===/]) {
        expect(pattern.test(code), `${file} branches on project identity`).toBe(false)
      }
    }
  })

  it('carries no metre-scale constant that could only have come from one building', () => {
    // Known Marcówki dimensions. A literal of any of these in an extractor is
    // a seeded answer, whatever it is called.
    const known = ['12.05', '7.9', '4.15', '12.6', '8.27', '150.57', '131.16', '129.04', '7.95', '4.67', '3.06']
    for (const file of analyzerFiles) {
      const code = codeOf(file)
      for (const value of known) {
        expect(code.includes(value), `${file} contains the known dimension ${value}`).toBe(false)
      }
    }
  })

  it('lets the benchmark, and only the benchmark, read the reference', () => {
    const benchmark = resolve(ROOT, 'packages/source-analyzer/scripts/marcowki.ts')
    expect(readFileSync(benchmark, 'utf8')).toContain('@buildapp/reference-marcowki')
    for (const file of filesUnder(resolve(ROOT, 'packages/source-analyzer/scripts'))) {
      if (file === benchmark) continue
      expect(readFileSync(file, 'utf8'), file).not.toContain('@buildapp/reference-marcowki')
    }
  })
})

describe('an observation is never geometry', () => {
  it('emits no Building DSL command from the observation or vision layers', () => {
    const commands = ['createWall', 'createSlab', 'createRoof', 'createOpening', 'createStair', 'createSurfaceRegion', 'applyCommand', 'BuildingCommand']
    for (const file of [...packageSrc('source-observations'), ...packageSrc('source-vision'), ...packageSrc('source-cv'), ...packageSrc('source-common')]) {
      const code = codeOf(file)
      for (const term of commands) expect(code.includes(term), `${file} mentions ${term}`).toBe(false)
    }
  })

  it('has no 3D vocabulary in the observation schema: no z, no mesh, no triangle, no metres', () => {
    for (const file of packageSrc('source-observations')) {
      const code = codeOf(file)
      for (const term of ['mesh', 'triangle', 'Vector3', 'BufferGeometry', 'metres', 'meters']) {
        expect(code.toLowerCase().includes(term.toLowerCase()), `${file} mentions ${term}`).toBe(false)
      }
      expect(/\bz\s*:\s*(number|z\.number)/.test(code), `${file} declares a z coordinate`).toBe(false)
    }
  })

  it('offers a vision provider no way to return anything but observations', () => {
    const schema = readFileSync(resolve(ROOT, 'packages/source-vision/src/schema.ts'), 'utf8')
    for (const term of ['wall', 'roof', 'slab', 'mesh', 'command']) {
      expect(codeOf(resolve(ROOT, 'packages/source-vision/src/schema.ts')).toLowerCase().includes(term), `the vision response schema mentions ${term}`).toBe(false)
    }
    expect(schema).toContain('VisionObservationResponseSchema')
  })
})

describe('the observation layer is pure', () => {
  const pure = ['source-common', 'source-cv', 'source-observations'] as const

  it('uses no Node API, no filesystem and no network', () => {
    for (const name of pure) {
      for (const file of packageSrc(name)) {
        const code = codeOf(file)
        for (const term of ['node:', 'process.', 'require(', '__dirname', 'fetch(', 'XMLHttpRequest']) {
          expect(code.includes(term), `${file} uses ${term}`).toBe(false)
        }
      }
    }
  })

  it('uses no DOM and no Three.js', () => {
    for (const name of [...pure, 'source-vision'] as const) {
      for (const file of packageSrc(name)) {
        const code = codeOf(file)
        for (const term of ['document.', 'window.', 'three', 'THREE.', 'canvas']) {
          expect(code.toLowerCase().includes(term.toLowerCase()), `${file} uses ${term}`).toBe(false)
        }
      }
    }
  })

  it('depends on no building model and no geometry compiler', () => {
    for (const name of [...pure, 'source-vision', 'source-package'] as const) {
      const manifest = JSON.parse(readFileSync(resolve(ROOT, 'packages', name, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> }
      for (const dep of Object.keys(manifest.dependencies ?? {})) {
        expect(['@buildapp/model', '@buildapp/geometry', '@buildapp/commands', '@buildapp/editor', '@buildapp/reference-marcowki']).not.toContain(dep)
      }
      for (const file of packageSrc(name)) {
        const text = readFileSync(file, 'utf8')
        for (const dep of ['@buildapp/model', '@buildapp/geometry', '@buildapp/commands', '@buildapp/editor']) {
          expect(text.includes(dep), `${file} imports ${dep}`).toBe(false)
        }
      }
    }
  })

  it('declares the observation package dependencies as only the shared primitives and zod', () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'packages/source-observations/package.json'), 'utf8')) as { dependencies: Record<string, string> }
    expect(Object.keys(manifest.dependencies).sort()).toEqual(['@buildapp/source-common', 'zod'])
  })
})

describe('the web reads sealed sources and does not go and get its own', () => {
  const webFiles = filesUnder(resolve(ROOT, 'apps/web/src'))

  it('has web sources to check', () => {
    expect(webFiles.length).toBeGreaterThan(5)
  })

  it('never fetches a publisher, and never decodes an image itself', () => {
    for (const file of webFiles) {
      const code = codeOf(file)
      for (const term of ['fetch(', 'XMLHttpRequest', 'decodeImage', 'acquireSourcePackage', 'safeFetch']) {
        expect(code.includes(term), `${file} uses ${term}`).toBe(false)
      }
    }
  })

  it('never runs an extractor or an acquisition adapter in the browser', () => {
    for (const file of webFiles) {
      const text = readFileSync(file, 'utf8')
      for (const dep of ['@buildapp/source-package', '@buildapp/source-analyzer', '@buildapp/source-cv', '@buildapp/source-vision']) {
        expect(text.includes(dep), `${file} imports ${dep}`).toBe(false)
      }
    }
  })

  it('may read the sealed observation graph, because reading a record is not producing one', () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'apps/web/package.json'), 'utf8')) as { dependencies?: Record<string, string> }
    const deps = Object.keys(manifest.dependencies ?? {})
    expect(deps).not.toContain('@buildapp/source-package')
    expect(deps).not.toContain('@buildapp/source-analyzer')
  })
})

describe('acquisition has one authoritative path', () => {
  it('exposes exactly one function that produces a SourcePackage', () => {
    const producers = analyzerFiles.filter((f) => /export (async )?function acquire/.test(readFileSync(f, 'utf8')))
    expect(producers).toHaveLength(1)
    expect(producers[0]).toContain(join('source-package', 'src', 'acquire.ts'))
  })

  it('keeps publisher knowledge inside adapters', () => {
    const generic = packageSrc('source-package').filter((f) => !f.includes(join('src', 'adapters')))
    for (const file of generic) {
      const code = codeOf(file).toLowerCase()
      for (const term of ['archon', 'fancybox']) expect(code.includes(term), `${file} knows about ${term}`).toBe(false)
    }
  })
})
