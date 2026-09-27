/**
 * BUILDPLAN-INTEGRATION-003A: the presentation layer the Android viewer took
 * from the donor BuildPlan-PC-Legacy viewer must stay GENERIC.
 *
 * The donor's renderer was proven on one hand-authored reference house, and
 * much of it (its presets, its tile module, its profiles keyed by element id)
 * was that house. What was ported here is the generic part only: feature-edge
 * classification, a facet-generic roof covering, study looks and neutral
 * glass. These tests fail when the ported code starts knowing a project, a
 * benchmark dimension, a coordinate of the donor's reference model, or
 * anything of the donor's own analyzer or domain.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileBuilding } from '@buildapp/geometry'
import { createMarcowkiReferenceBuilding } from '@buildapp/reference-marcowki'

const ROOT = resolve(import.meta.dirname, '../..')
const KOTLIN_MAIN = resolve(ROOT, 'apps/android/app/src/main/java/com/buildplan/preview')
const PRESENTATION = resolve(KOTLIN_MAIN, 'presentation')

function kotlinUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.kt')) out.push(p)
    }
  }
  walk(dir)
  return out
}

/** Comments and string literals removed: only code is scanned for numbers and identifiers. */
const codeOf = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')

/** The ported presentation code: the new package, the renderer that uploads it, and the presets. */
const PORTED = [
  ...kotlinUnder(PRESENTATION),
  ...kotlinUnder(resolve(KOTLIN_MAIN, 'render')),
  resolve(KOTLIN_MAIN, 'camera/ViewPresets.kt'),
  resolve(KOTLIN_MAIN, 'camera/OrbitCamera.kt'),
]
const rel = (f: string): string => relative(ROOT, f)

/**
 * Coordinates of the donor's hand-traced reference house: every non-integer
 * literal above one metre in its plan grid (BuildPlan-PC-Legacy @ b0e79675,
 * app/src/debug/.../reference/visual/MarcowkiPlanGrid.kt), plus its roof
 * area. Recorded here as numbers so this test needs no copy of the donor.
 */
const DONOR_REFERENCE_COORDINATES = [
  1.05, 1.1, 1.17, 1.3, 1.4, 10.06, 10.4, 10.46, 12.05, 12.6, 150.57, 150.4, 2.1, 2.25, 2.28, 2.3, 2.34, 2.38, 2.52, 2.66, 2.7, 2.72,
  2.75, 3.03, 3.06, 3.08, 3.2, 3.35, 3.39, 3.42, 3.67, 3.7, 3.9, 3.93, 3.95, 37.77, 4.1, 4.18, 4.4, 4.56, 4.61, 4.67, 4.7, 4.99, 5.1,
  5.15, 5.18, 5.2, 5.3, 5.35, 5.39, 5.43, 5.45, 5.6, 6.05, 6.16, 6.18, 6.22, 6.39, 6.41, 6.46, 6.47, 6.59, 7.13, 7.31, 7.44, 7.45,
  7.47, 7.74, 7.75, 7.77, 7.89, 7.95, 8.27, 8.53, 8.58, 8.8, 8.82, 8.84, 8.9, 8.95, 8.96, 9.5, 9.73, 9.9, 9.93,
]

/** The second regression house's stated dimensions (as tests/architecture/second-house.test.ts lists them). */
const SECOND_HOUSE_DIMENSIONS = [17.2, 14.74, 6.88, 6.24, 189.77, 5.7, 3.24]

/** Every numeric literal in the code, as a number (Kotlin `f` suffixes and `_` separators accepted). */
function numbersIn(code: string): number[] {
  return [...code.matchAll(/(?<![\w.])(\d[\d_]*\.\d+|\d[\d_]*)(?:[fFdD]|L)?(?![\w.])/g)].map((m) => Number(m[1].replace(/_/g, '')))
}

describe('the ported presentation is generic', () => {
  it('finds the ported files', () => {
    expect(kotlinUnder(PRESENTATION).map((f) => f.replace(/.*\//, '')).sort()).toEqual(['FeatureEdges.kt', 'PresentationMode.kt', 'RoofCover.kt', 'ScenePresentation.kt'])
    for (const f of PORTED) expect(existsSync(f), rel(f)).toBe(true)
  })

  it('names no project, publisher or reference house — in code or comment', () => {
    for (const file of PORTED) {
      const text = readFileSync(file, 'utf8')
      for (const term of [/marc[oó]wk/i, /rarytas/i, /archon/i, /\bG2E\b/, /\bdom w\b/i, /m84f2903cb8e14/, /\bGE\)/]) {
        expect(term.test(text), `${rel(file)} matches ${term}`).toBe(false)
      }
    }
  })

  it('carries none of the donor reference model coordinates', () => {
    for (const file of PORTED) {
      const numbers = new Set(numbersIn(codeOf(file)))
      for (const v of DONOR_REFERENCE_COORDINATES) expect(numbers.has(v), `${rel(file)} contains ${v}, a coordinate of the donor's reference house`).toBe(false)
    }
  })

  it('carries none of the benchmark houses’ dimensions', () => {
    const model = createMarcowkiReferenceBuilding()
    const scene = compileBuilding(model)
    const reference = new Set<number>()
    const add = (v: number): void => {
      if (Number.isFinite(v) && Math.abs(v) > 1 && !Number.isInteger(v)) reference.add(Number(Math.abs(v).toFixed(2)))
    }
    if (scene.bounds) for (const p of [scene.bounds.min, scene.bounds.max]) for (const v of [p.x, p.y, p.z]) add(v)
    for (const l of model.levels) {
      add(l.elevation)
      add(l.height)
    }
    for (const r of model.roofs) {
      add(r.eaveOffset)
      add(r.footprint.maxX - r.footprint.minX)
      add(r.footprint.maxZ - r.footprint.minZ)
      if ('pitchDeg' in r && typeof r.pitchDeg === 'number') add(r.pitchDeg)
    }
    expect(reference.size).toBeGreaterThan(3)
    for (const file of PORTED) {
      const numbers = numbersIn(codeOf(file))
      for (const n of numbers) {
        expect(reference.has(n), `${rel(file)} contains ${n}, a dimension of the reference building`).toBe(false)
        expect(SECOND_HOUSE_DIMENSIONS.includes(n), `${rel(file)} contains ${n}, a dimension of the second regression house`).toBe(false)
      }
    }
  })

  it('depends on nothing of the donor: no legacy package, domain, geometry, analyzer or runtime material compiler', () => {
    const legacy = [
      /com\.buildplan\.app\b/,
      /\bBuildingElementId\b/,
      /\bBuildingElementKind\b/,
      /\bBuildingElementScope\b/,
      /\bBuildingGeometry(Primitive)?\b/,
      /\bRoofFacetGeometry\b/,
      /\bOpeningPanelGeometry\b/,
      /\bWallGeometry\b/,
      /\bDecompositionProfile\b/,
      /\bVisualSurfaceRole\b/,
      /\bRoofCoverProfile\b/,
      /\bOpeningFrameProfile\b/,
      /\bSyntheticDemoHouse\b/,
      /\bPlanGrid\b/,
      /\bfilamat\b/,
      /\bMaterialBuilder\b/,
      /\banalyzer\b/,
    ]
    for (const file of PORTED) {
      const code = codeOf(file)
      for (const term of legacy) expect(term.test(code), `${rel(file)} uses ${term}`).toBe(false)
    }
    // And the Gradle build pulls in no runtime material compiler (the donor used filamat-android).
    const gradle = ['apps/android/app/build.gradle.kts', 'apps/android/gradle/libs.versions.toml'].map((f) => readFileSync(resolve(ROOT, f), 'utf8')).join('\n')
    expect(/filamat-android|com\.google\.android\.filament:filamat/.test(gradle)).toBe(false)
  })

  it('keeps the presentation package pure: no Filament, no Android, no object kinds', () => {
    for (const file of kotlinUnder(PRESENTATION)) {
      const code = codeOf(file)
      const imports = [...readFileSync(file, 'utf8').matchAll(/^import\s+([\w.]+)/gm)].map((m) => m[1])
      for (const i of imports) {
        expect(/^(com\.buildplan\.preview\.(math|scene|render)\.|kotlin\.)/.test(i), `${rel(file)} imports ${i}`).toBe(true)
      }
      expect(/com\.google\.android\.filament|android\./.test(code), `${rel(file)} touches Filament or Android`).toBe(false)
      // A presentation reads parts and palette groups, never what an object IS.
      expect(/\.kind\b/.test(code), `${rel(file)} reads an object kind`).toBe(false)
    }
  })

  it('does not change what the phone receives: the bundle and its exporter know no presentation', () => {
    for (const file of ['packages/mobile-scene/src/types.ts', 'packages/mobile-scene/src/bundle.ts', 'apps/android/app/src/main/java/com/buildplan/preview/scene/Bundle.kt']) {
      const code = readFileSync(resolve(ROOT, file), 'utf8')
      expect(/roofCover|featureEdge|presentationMode|PresentationMode|RoofCover|FeatureEdges/.test(code), `${file} carries presentation`).toBe(false)
    }
  })

  it('draws presentation only from the one derived set, uploaded once per model', () => {
    const renderer = readFileSync(resolve(KOTLIN_MAIN, 'render/FilamentModelRenderer.kt'), 'utf8')
    // Derived exactly once, when the model is uploaded.
    expect(renderer.match(/ScenePresentation\.of\(/g)?.length).toBe(1)
    expect(/fun setModel\(scene: ModelScene\) \{[\s\S]*?ScenePresentation\.of\(scene\)[\s\S]*?\n {4}\}/.test(renderer)).toBe(true)
    // And never in the per-frame state path.
    const setState = /fun setState\(state: ViewerState\) \{([\s\S]*?)\n {4}\}/.exec(renderer)?.[1] ?? ''
    expect(setState.length).toBeGreaterThan(0)
    expect(/ScenePresentation|FeatureEdges\.|RoofCover\.|setBufferAt|Builder\(/.test(setState), 'setState must only toggle and re-parameterise').toBe(false)
  })
})
