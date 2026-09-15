/**
 * Architecture tests for the reconstruction boundary (STAGE BUILDAPP-03).
 *
 * §2 of this stage draws a line that no amount of care in review can hold on
 * its own, because the cheat is always plausible at the point where it is
 * written: one constant, one special case, one "just to get the massing
 * right". So the line is enforced by reading the source tree.
 *
 * The rule: **nothing that produces a candidate may know which project it is
 * reconstructing.** Not its name, not its id, not a number taken from its
 * reference model, and not the reference package itself. Evaluation may know
 * all of it, and runs afterwards, on the sealed artefact.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCommands } from '@buildapp/commands'
import { createEmptyModel, serializeModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { SEALED_CANDIDATES, candidateStatus, modelOf } from '@buildapp/candidates'
import { ReconstructionCandidateSchema, detectContradictions, solveQuantity, verifyReplay } from '@buildapp/reconstruction'
import type { Constraint } from '@buildapp/reconstruction'
import { sha256Hex } from '@buildapp/source-common'

const ROOT = resolve(import.meta.dirname, '../..')

function sourceFiles(dir: string, opts: { includeTests?: boolean } = {}): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'build') continue
      const full = join(d, entry)
      if (statSync(full).isDirectory()) {
        if (!opts.includeTests && (entry === 'test' || entry === '__tests__')) continue
        walk(full)
        continue
      }
      if (/\.(ts|tsx)$/.test(entry)) out.push(full)
    }
  }
  walk(dir)
  return out.sort()
}

/**
 * Everything that runs BEFORE a candidate is sealed.
 *
 * The acquisition layer, the analyzer, the metric reader and the solver. The
 * evaluation scripts are deliberately outside it: they exist to compare a
 * sealed candidate with a reference and cannot reach anything upstream.
 */
const PRODUCTION_DIRS = ['packages/source-package/src', 'packages/source-cv/src', 'packages/source-observations/src', 'packages/source-analyzer/src', 'packages/source-metrics/src', 'packages/reconstruction/src']

const productionFiles = (): string[] => PRODUCTION_DIRS.flatMap((d) => sourceFiles(join(ROOT, d)))

const read = (file: string): string => readFileSync(file, 'utf8')
const relative = (file: string): string => file.slice(ROOT.length + 1)

describe('1. no production reconstruction source imports the reference package', () => {
  it('holds for every file that runs before a candidate is sealed', () => {
    const offenders = productionFiles().filter((f) => /@buildapp\/reference-/.test(read(f)))
    expect(offenders.map(relative)).toEqual([])
  })

  it('and the solver package does not even declare it as a runtime dependency', () => {
    const pkg = JSON.parse(read(join(ROOT, 'packages/reconstruction/package.json'))) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    expect(Object.keys(pkg.dependencies ?? {}).filter((d) => d.startsWith('@buildapp/reference-'))).toEqual([])
    // It may be a DEV dependency: the evaluation script is shipped beside the
    // solver and needs it, and a dev dependency cannot reach a browser bundle.
    expect(Object.keys(pkg.devDependencies ?? {})).toContain('@buildapp/reference-marcowki')
  })
})

describe('2. no production source names the project it is reconstructing', () => {
  const FORBIDDEN = ['marcowki', 'marcówki', 'm2fa281446a8ca']
  it('holds, case-insensitively, in every production file', () => {
    const offenders: string[] = []
    for (const file of productionFiles()) {
      const text = read(file).toLowerCase()
      for (const needle of FORBIDDEN) if (text.includes(needle)) offenders.push(`${relative(file)} contains "${needle}"`)
    }
    expect(offenders).toEqual([])
  })

  it('and the test that would catch a cheat actually catches one', () => {
    // The guard is only worth having if it fires. This is the same scan run
    // against a string that a cheating file would contain.
    const pretend = 'const MARCOWKI_WIDTH = 12.05'
    expect(FORBIDDEN.some((n) => pretend.toLowerCase().includes(n))).toBe(true)
  })
})

describe('3. no production source reads a frozen model or a stage artefact', () => {
  it('holds for every production file', () => {
    const offenders: string[] = []
    for (const file of productionFiles()) {
      const text = read(file)
      if (/stage-reports\//.test(text)) offenders.push(`${relative(file)} reads a stage artefact`)
      if (/fixtures\/[a-z-]*\.json/.test(text)) offenders.push(`${relative(file)} reads a frozen fixture`)
      if (/createMarcowki|MARCOWKI_/.test(text)) offenders.push(`${relative(file)} reaches for the reference model`)
    }
    expect(offenders).toEqual([])
  })
})

describe('4. a sealed candidate replays to the model it was sealed with', () => {
  it('holds for every candidate committed to the repository', () => {
    expect(SEALED_CANDIDATES.length).toBeGreaterThan(0)
    for (const sealed of SEALED_CANDIDATES) {
      expect(ReconstructionCandidateSchema.safeParse(sealed.candidate).success, sealed.id).toBe(true)
      const replay = verifyReplay(sealed.candidate)
      expect(replay.ok, `${sealed.id}: ${replay.ok ? '' : replay.reason}`).toBe(true)
      if (!replay.ok) continue
      expect(sha256Hex(serializeModel(replay.model))).toBe(sealed.candidate.modelHash)
    }
  })

  it('and the model a viewer gets is the one the program builds, not a copy', () => {
    for (const sealed of SEALED_CANDIDATES) {
      const viaLoader = modelOf(sealed.id)
      const viaProgram = runCommands(createEmptyModel(sealed.candidate.modelId, sealed.candidate.label), sealed.candidate.program)
      expect(serializeModel(viaLoader)).toBe(serializeModel(viaProgram))
    }
  })
})

describe('5. a candidate reaches geometry only through the Building DSL', () => {
  it('the solver emits commands and never constructs a model object', () => {
    const solverFiles = sourceFiles(join(ROOT, 'packages/reconstruction/src'))
    const offenders: string[] = []
    for (const file of solverFiles) {
      const text = read(file)
      // `createEmptyModel` is allowed exactly once, in the one place that runs
      // the program; nothing else may make a model, and nothing at all may
      // reach into one and add to a collection.
      if (/model\.(walls|openings|roofs|slabs|linearSolids|levels)\.push/.test(text)) offenders.push(`${relative(file)} mutates a model collection directly`)
      if (/createEmptyModel/.test(text) && !file.endsWith('candidate.ts')) offenders.push(`${relative(file)} builds a model outside the replay path`)
    }
    expect(offenders).toEqual([])
  })

  it('and every candidate’s model compiles to geometry like any other', () => {
    for (const sealed of SEALED_CANDIDATES) {
      const compiled = compileBuilding(modelOf(sealed.id))
      expect(compiled.diagnostics.filter((d) => d.severity === 'ERROR'), sealed.id).toEqual([])
      expect(compiled.meshes.length).toBeGreaterThan(0)
    }
  })
})

describe('6. every artefact is sealed against the exact inputs it was made from', () => {
  it('a candidate names four hashes and a solver version', () => {
    for (const sealed of SEALED_CANDIDATES) {
      const c = sealed.candidate
      for (const hash of [c.sourcePackageHash, c.observationGraphHash, c.metricEvidenceHash, c.hypothesisSetHash, c.modelHash]) expect(hash).toMatch(/^[0-9a-f]{64}$/)
      expect(c.solver.name.length).toBeGreaterThan(0)
      expect(c.solver.version).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })

  it('and a viewer can show all of them without running a solver', () => {
    for (const sealed of SEALED_CANDIDATES) {
      const status = candidateStatus(sealed)
      expect(status.candidateHash).toBe(sealed.candidate.contentHash)
      expect(status.sourcePackageHash).toBe(sealed.candidate.sourcePackageHash)
      expect(status.commands).toBe(sealed.candidate.program.length)
    }
  })
})

describe('7. the layers run one way', () => {
  it('nothing upstream of the solver imports it', () => {
    const upstream = ['packages/source-package/src', 'packages/source-cv/src', 'packages/source-observations/src', 'packages/source-analyzer/src', 'packages/source-metrics/src'].flatMap((d) => sourceFiles(join(ROOT, d)))
    const offenders = upstream.filter((f) => /@buildapp\/reconstruction/.test(read(f)))
    expect(offenders.map(relative)).toEqual([])
  })

  it('and the metric reader does not import the analyzer, which sits beside it', () => {
    const offenders = sourceFiles(join(ROOT, 'packages/source-metrics/src')).filter((f) => /@buildapp\/source-analyzer/.test(read(f)))
    expect(offenders.map(relative)).toEqual([])
  })
})

describe('8. the solver is pure: it fetches nothing and reads nothing', () => {
  it('no production source in the solver touches the network or the filesystem', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(join(ROOT, 'packages/reconstruction/src'))) {
      const text = read(file)
      if (/\bfetch\(|node:fs|node:https?|XMLHttpRequest/.test(text)) offenders.push(relative(file))
    }
    expect(offenders).toEqual([])
  })

  it('and neither does the metric reader', () => {
    const offenders = sourceFiles(join(ROOT, 'packages/source-metrics/src')).filter((f) => /\bfetch\(|node:fs|node:https?/.test(read(f)))
    expect(offenders.map(relative)).toEqual([])
  })
})

describe('9. every primitive a candidate builds is traceable to its evidence', () => {
  it('holds for every committed candidate', () => {
    for (const sealed of SEALED_CANDIDATES) {
      const model = modelOf(sealed.id)
      const traced = new Set(sealed.candidate.traces.map((t) => t.objectId))
      const untraced: string[] = []
      for (const o of [...model.openings, ...model.linearSolids, ...model.roofs, ...model.wallRings]) if (!traced.has(o.id)) untraced.push(o.id)
      expect(untraced, sealed.id).toEqual([])
      for (const trace of sealed.candidate.traces) {
        expect(trace.hypothesisId.length).toBeGreaterThan(0)
        expect(trace.why.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('10. two exact statements that disagree are reported, never averaged', () => {
  const constraint = (id: string, value: number): Constraint => ({
    id,
    class: 'HARD',
    subject: { hypothesisId: 'h', parameter: 'width' },
    value,
    tolerance: 0.01,
    weight: 1,
    unit: 'm',
    evidenceIds: [`e-${id}`],
    observationIds: [],
    why: `stated as ${value}`,
  })

  it('a contradiction is named and the solved value is one of the two, never the middle', () => {
    const constraints = [constraint('a', 12.05), constraint('b', 12.6)]
    const contradictions = detectContradictions(constraints)
    expect(contradictions).toHaveLength(1)
    expect(contradictions[0].values).toEqual([12.05, 12.6])
    expect(contradictions[0].gap).toBeCloseTo(0.55, 6)
    const solved = solveQuantity({ hypothesisId: 'h', parameter: 'width' }, constraints)
    expect([12.05, 12.6]).toContain(solved.value)
    expect(solved.value).not.toBeCloseTo(12.325, 3)
    expect(solved.class).toBe('HARD')
  })

  it('and a hard statement is never weighed against a soft one', () => {
    const soft: Constraint = { ...constraint('soft', 9), class: 'SOFT', tolerance: 0.5, weight: 100 }
    const solved = solveQuantity({ hypothesisId: 'h', parameter: 'width' }, [constraint('hard', 12.05), soft])
    expect(solved.value).toBe(12.05)
    expect(solved.class).toBe('HARD')
    expect(solved.residual).toBe(0)
  })

  it('and a quantity nothing constrains is UNRESOLVED rather than silently defaulted', () => {
    const solved = solveQuantity({ hypothesisId: 'h', parameter: 'nothing' }, [], { value: 0.38, low: 0.25, high: 0.5 })
    expect(solved.class).toBe('UNRESOLVED')
    expect(solved.value).toBe(0.38)
    expect(solved.why).toMatch(/no constraint/)
  })
})
