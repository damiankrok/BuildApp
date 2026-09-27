/**
 * BUILDAPP-03G guards: the architectural language is general, evidence-led
 * and on the production geometry path.
 *
 * - The new modules (packages/architecture and the 1.6.0 model, command and
 *   compiler files) name no project, carry no project's dimensions, and read
 *   no research, reference, benchmark or sealed-candidate material.
 * - Feature readers do not make geometry: the registries, the proposal
 *   interface and the hypothesis pipeline import no geometry module, so what
 *   they produce is a DSL program the compiler draws — never triangles, and
 *   never a second mesh path.
 * - The fixtures and the pipeline demonstrations are test material: nothing
 *   the phone or the service runs imports them.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const rel = (f: string): string => relative(ROOT, f)
const codeOf = (f: string): string => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

function files(dir: string, re = /\.(ts|tsx|mjs|kt)$/): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === 'dist') continue
      const full = join(d, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (re.test(name)) out.push(full)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

const importsOf = (f: string): string[] => {
  const src = readFileSync(f, 'utf8')
  return [...src.matchAll(/^\s*(?:import|export)\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm), ...src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
}

const ARCH = join(ROOT, 'packages/architecture/src')
/** The files this stage added to the production packages. */
const NEW_PRODUCTION = [
  ...files(ARCH),
  ...['packages/model/src/roof-plane.ts', 'packages/model/src/assembly.ts', 'packages/model/src/dormer.ts', 'packages/model/src/validate-architecture.ts', 'packages/commands/src/apply-architecture.ts', 'packages/geometry/src/architecture-compiler.ts'].map((p) => join(ROOT, p)),
]
const TEST_MATERIAL = /packages\/architecture\/src\/(fixtures\/|hypotheses\/demos\.ts$)/

describe('the architectural language is general', () => {
  it('finds the modules it guards', () => {
    expect(NEW_PRODUCTION.length).toBeGreaterThan(20)
    for (const f of NEW_PRODUCTION) expect(existsSync(f), rel(f)).toBe(true)
  })

  it('no new module — code or comment — names a project or carries a publisher id', () => {
    for (const f of NEW_PRODUCTION) {
      const text = readFileSync(f, 'utf8').toLowerCase()
      for (const term of ['marcow', 'marców', 'rarytas', 'm84f2903cb8e14', 'archon']) expect(text.includes(term), `${rel(f)} mentions ${term}`).toBe(false)
    }
  })

  it('no new module carries a known project dimension', () => {
    const known = ['12.05', '7.9', '4.15', '12.6', '8.27', '150.57', '131.16', '129.04', '7.95', '4.67', '3.06', '17.2', '14.74', '6.88', '6.24', '189.77', '3.24', '5.7']
    for (const f of NEW_PRODUCTION) {
      const code = codeOf(f)
      for (const value of known) {
        const pattern = new RegExp(`(?<![0-9.])${value.replace('.', '\\.')}(?![0-9])`)
        expect(pattern.test(code), `${rel(f)} carries ${value}`).toBe(false)
      }
    }
  })

  it('no new module reads research, reference, benchmark, candidate or stage material', () => {
    for (const f of NEW_PRODUCTION) {
      for (const spec of importsOf(f)) expect(/@buildapp\/(candidates|reference-|synthetic-drawings|demo)|research\/|tests\/benchmark|stage-reports/.test(spec), `${rel(f)} imports ${spec}`).toBe(false)
      const code = codeOf(f)
      for (const path of ['research/', 'stage-reports/', 'tests/benchmark', 'reference-marcowki', 'rarytasy-generalization']) expect(code.includes(path), `${rel(f)} refers to ${path}`).toBe(false)
    }
  })

  it('the architecture package depends on the model, the DSL and the compiler only', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages/architecture/package.json'), 'utf8')) as { dependencies: Record<string, string> }
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['@buildapp/commands', '@buildapp/geometry', '@buildapp/model', '@buildapp/source-common', 'zod'])
  })
})

describe('feature readers make no geometry', () => {
  it('the registries, the proposal interface and the hypothesis pipeline import no geometry module', () => {
    const readers = files(ARCH).filter((f) => !TEST_MATERIAL.test(rel(f)) && !/graphs\//.test(rel(f)))
    expect(readers.some((f) => rel(f).includes('hypotheses/emit.ts'))).toBe(true)
    for (const f of readers) for (const spec of importsOf(f)) expect(/@buildapp\/(geometry|mobile-scene)|^three/.test(spec), `${rel(f)} imports ${spec}`).toBe(false)
  })

  it('nothing in the pipeline writes a triangle or a mesh', () => {
    for (const f of files(join(ARCH, 'hypotheses')).filter((x) => !TEST_MATERIAL.test(rel(x)))) {
      const code = codeOf(f)
      expect(code, rel(f)).not.toMatch(/\bTriangle\b|triangles\s*[:=]|\bmeshes\b|CompiledMesh|quadOut|triOut|frameBox/)
    }
  })

  it('its only product is a Building DSL program: every emitted command is a command the DSL validates', async () => {
    const { BuildingCommandSchema } = await import('@buildapp/commands')
    const { ALL_DEMOS } = await import('@buildapp/architecture/fixtures')
    const { runPipeline } = await import('@buildapp/architecture')
    const { applyCommands } = await import('@buildapp/commands')
    const { createEmptyModel } = await import('@buildapp/model')
    for (const d of ALL_DEMOS) {
      const context = applyCommands(createEmptyModel('ctx', 'ctx'), d.context()).model
      for (const c of runPipeline({ proposals: d.proposals(), context }).commands) expect(BuildingCommandSchema.safeParse(c).success, `${d.id}: ${c.type}`).toBe(true)
    }
  })
})

describe('fixtures and demonstrations are test material', () => {
  it('no production package or app imports them', () => {
    const production = [
      ...['analysis-service', 'commands', 'geometry', 'mobile-scene', 'model', 'reconstruction', 'source-analyzer', 'source-cv', 'source-metrics', 'source-observations', 'source-package', 'editor'].map((p) => join(ROOT, `packages/${p}/src`)),
      join(ROOT, 'apps/local-analyzer/src'),
      join(ROOT, 'apps/analyzer-api/src'),
      join(ROOT, 'apps/web/src'),
    ].flatMap((d) => files(d))
    for (const f of production) for (const spec of importsOf(f)) expect(spec.startsWith('@buildapp/architecture'), `${rel(f)} imports ${spec}`).toBe(false)
    for (const f of files(ARCH).filter((x) => !TEST_MATERIAL.test(rel(x)))) for (const spec of importsOf(f)) expect(/fixtures\/|demos\.js/.test(spec), `${rel(f)} imports ${spec}`).toBe(false)
  })
})
