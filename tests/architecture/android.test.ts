/**
 * Architecture tests for the Android model preview.
 *
 * The danger this stage introduces is a second geometry kernel: a Kotlin
 * renderer that starts "just adjusting" a wall, and a mobile app that drifts
 * away from the model until the phone and the web show different buildings.
 * These tests read the Android sources and the Gradle configuration and fail
 * by name when that starts to happen.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDemoBuilding } from '@buildapp/demo'
import { createMarcowkiReferenceBuilding } from '@buildapp/reference-marcowki'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'

const ROOT = resolve(import.meta.dirname, '../..')
const ANDROID = resolve(ROOT, 'apps/android')
const APP_MAIN = resolve(ANDROID, 'app/src/main')
const KOTLIN_MAIN = resolve(APP_MAIN, 'java/com/buildplan/preview')

function filesUnder(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ext.test(name)) out.push(p)
    }
  }
  walk(dir)
  return out
}

/** Comments and string literals removed: only code is scanned. */
function codeOfSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
}

/** The same, for a whole file. */
function codeOf(file: string): string {
  return codeOfSource(readFileSync(file, 'utf8'))
}

const kotlinMain = filesUnder(KOTLIN_MAIN, /\.kt$/)

describe('the Android viewer is a viewer, not a second compiler', () => {
  it('has Kotlin sources to check', () => {
    expect(kotlinMain.length).toBeGreaterThan(10)
  })

  /**
   * The compiler's construction vocabulary. A renderer that needs any of these
   * is building geometry from semantics — which is the compiler's job, on the
   * TypeScript side, where the tests and the oracles are.
   */
  const banned = (terms: string[], why: string): void => {
    for (const file of kotlinMain) {
      const code = codeOf(file)
      for (const term of terms) {
        expect(
          new RegExp(`\\b${term}\\b`).test(code),
          `${file.replace(ROOT, '')} mentions "${term}" — ${why}`,
        ).toBe(false)
      }
    }
  }

  it('does not reimplement wall geometry', () => {
    banned(
      ['topProfile', 'wallFrame', 'wallPlanPoint', 'compileWall', 'nominalExtent', 'physicalSpan', 'resolveWallTopology'],
      'walls are compiled by @buildapp/geometry and arrive as triangles',
    )
  })

  it('does not reimplement roof geometry', () => {
    banned(
      ['eaveOffset', 'ridgeAxis', 'overhang', 'roofGeometry', 'compileRoof', 'undersideAt', 'roofBreaksAlong'],
      'roofs are compiled by @buildapp/geometry and arrive as triangles',
    )
  })

  it('does not reimplement opening cutting', () => {
    banned(
      ['cutOpening', 'openingLeaves', 'sill', 'frameInset', 'glassThickness', 'mullions', 'hingeSide', 'openAngle', 'triangulate', 'extrude'],
      'openings are cut by @buildapp/geometry; the phone receives the hole already cut',
    )
  })

  it('does not reimplement stair layout', () => {
    banned(['waist', 'risers', 'stairLayout', 'compileStair'], 'stairs are laid out by the model and compiled by @buildapp/geometry')
  })

  it('applies exactly one coordinate conversion, in one file', () => {
    const conversionFile = resolve(KOTLIN_MAIN, 'scene/ModelFrame.kt')
    expect(existsSync(conversionFile)).toBe(true)
    // Only ModelFrame may carry the axis inversion. A sign flip anywhere else
    // is how a viewer quietly starts mirroring a building.
    for (const file of kotlinMain) {
      if (file === conversionFile) continue
      const code = codeOf(file)
      expect(/Z_SIGN/.test(code) && !/ModelFrame\.Z_SIGN/.test(code), `${file.replace(ROOT, '')} uses the axis inversion directly`).toBe(false)
      // A UNARY minus on a z member access — `Vec3(x, y, -p.z)`. A
      // subtraction such as `(b.z - a.z)` is ordinary vector arithmetic and
      // must not trip this, so the minus has to follow a delimiter.
      const negatedZ = /(?:[=(,[:]|\breturn\b)\s*-\s*\w+(?:\.\w+)*\.z\b/
      expect(negatedZ.test(code), `${file.replace(ROOT, '')} negates a z coordinate outside ModelFrame`).toBe(false)
    }
    const frame = readFileSync(conversionFile, 'utf8')
    expect(frame).toMatch(/Z_SIGN\s*=\s*-1\.0/)
  })

  it('applies viewer state to the model it uploaded, never to one a caller supplies', () => {
    // A real owner-device failure: the viewport's frame callback captured the
    // scene that was open when it was installed, so after switching models it
    // kept resolving viewer state against the PREVIOUS building. Visibility
    // answers with object ids, and ids only mean something inside their own
    // model — the two buildings shared exactly one object name, so exactly one
    // entity was ever added to the Filament scene and the viewer drew a bare
    // roof. The renderer therefore OWNS the scene it uploaded.
    const renderer = readFileSync(resolve(KOTLIN_MAIN, 'render/FilamentModelRenderer.kt'), 'utf8')
    expect(renderer, 'the renderer must remember the scene it uploaded').toMatch(/private var uploadedScene: ModelScene\?/)
    expect(renderer).toMatch(/fun setState\(state: ViewerState\)/)
    expect(
      /fun setState\([^)]*ModelScene/.test(renderer),
      'setState must not take a scene: a caller cannot be trusted to pass the one that is on the GPU',
    ).toBe(false)

    // And the frame callback must capture nothing that can go stale. It
    // outlives the composition that installed it, so a scene captured there is
    // the previously opened building for the rest of the session.
    const viewport = readFileSync(resolve(KOTLIN_MAIN, 'ui/Viewport.kt'), 'utf8')
    const callback = /canvas\.onFrame = \{([\s\S]*?)\n {8}\}/.exec(viewport)
    expect(callback, 'the viewport must install a frame callback').not.toBeNull()
    expect(
      /\bscene\b/.test(codeOfSource(callback?.[1] ?? '')),
      'the frame callback captures the scene, which is stale as soon as another model is opened',
    ).toBe(false)
  })

  it('imports no Marcówki-specific coordinate constants', () => {
    // Nothing in the app may name the reference building at all.
    for (const file of kotlinMain) {
      expect(/marc[oó]wki/i.test(readFileSync(file, 'utf8')), `${file.replace(ROOT, '')} names the reference building`).toBe(false)
    }

    // Nor may it carry its dimensions as literals. The values are taken from
    // the model itself, so this keeps working as the model changes.
    const model = createMarcowkiReferenceBuilding()
    const scene = compileBuilding(model)
    const dimensions = new Set<string>()
    const add = (v: number): void => {
      if (Number.isFinite(v) && Math.abs(v) > 1 && !Number.isInteger(v)) dimensions.add(Math.abs(v).toFixed(2))
    }
    if (scene.bounds) {
      for (const p of [scene.bounds.min, scene.bounds.max]) for (const v of [p.x, p.y, p.z]) add(v)
    }
    for (const l of model.levels) {
      add(l.elevation)
      add(l.height)
    }
    for (const r of model.roofs) {
      add(r.eaveOffset)
      add(r.footprint.maxX - r.footprint.minX)
    }
    expect(dimensions.size).toBeGreaterThan(3)

    for (const file of kotlinMain) {
      const code = codeOf(file)
      for (const d of dimensions) {
        expect(new RegExp(`\\b${d.replace('.', '\\.')}\\b`).test(code), `${file.replace(ROOT, '')} contains the literal ${d}, a dimension of the reference building`).toBe(false)
      }
    }
  })

  it('loads the derived scene bundle and nothing else', () => {
    const repository = readFileSync(resolve(KOTLIN_MAIN, 'scene/SceneRepository.kt'), 'utf8')
    expect(repository).toMatch(/AssetManager/)
    expect(repository).toMatch(/BundleParser/)

    const assets = resolve(APP_MAIN, 'assets/scenes')
    expect(existsSync(join(assets, 'index.json')), 'the app must ship exported scene bundles').toBe(true)
    const index = JSON.parse(readFileSync(join(assets, 'index.json'), 'utf8')) as { key: string; asset: string; contentHash: string }[]
    expect(index.length).toBeGreaterThan(0)
    for (const entry of index) expect(existsSync(join(assets, entry.asset))).toBe(true)

    // The only geometry in the app is bundle geometry: no mesh file may ship.
    const meshFiles = filesUnder(APP_MAIN, /\.(glb|gltf|obj|fbx|dae|ply|stl|3ds)$/i)
    expect(meshFiles, 'the building is compiled, never loaded from a mesh file').toEqual([])
  })

  it('ships Filament materials compiled for the Filament it runs', () => {
    // A .filamat built by a different matc is rejected at runtime with "the
    // material was built for a different version", and the app has no
    // materials to draw with. This caught a real mismatch when the pinned
    // Filament was moved, so it is checked rather than remembered.
    const catalog = readFileSync(resolve(ANDROID, 'gradle/libs.versions.toml'), 'utf8')
    const pinned = /^filament\s*=\s*"(\d+)\.(\d+)\.(\d+)"/m.exec(catalog)
    expect(pinned, 'the Filament version must be pinned in the version catalog').not.toBeNull()
    const expectedMaterialVersion = Number(pinned?.[2])

    const materials = filesUnder(resolve(APP_MAIN, 'assets/materials'), /\.filamat$/)
    expect(materials.length, 'the app must ship its own compiled materials').toBeGreaterThan(0)

    for (const file of materials) {
      const bytes = readFileSync(file)
      // Header: the chunk name 'MAT_VERS' stored reversed, a 4-byte chunk
      // size, then the material format version as a little-endian uint32.
      expect(bytes.subarray(0, 8).toString('latin1'), `${file.replace(ROOT, '')} is not a .filamat package`).toBe('SREV_TAM')
      const version = bytes.readUInt32LE(12)
      expect(
        version,
        `${file.replace(ROOT, '')} was compiled by matc ${version}, but the app runs Filament ${pinned?.[1]}.${pinned?.[2]}.${pinned?.[3]} ` +
          '(material version tracks the Filament minor version). Regenerate with apps/android/tools/compile-materials.sh using matc from that release.',
      ).toBe(expectedMaterialVersion)
    }

    // And the sources they were built from are committed, so they can be rebuilt.
    const sources = filesUnder(resolve(APP_MAIN, 'materials'), /\.mat$/)
    expect(sources.map((f) => f.replace(/.*\//, '').replace('.mat', '')).sort())
      .toEqual(materials.map((f) => f.replace(/.*\//, '').replace('.filamat', '')).sort())
  })

  it('has no scraping, OCR or analyzer dependency', () => {
    const gradle = [resolve(ANDROID, 'app/build.gradle.kts'), resolve(ANDROID, 'build.gradle.kts'), resolve(ANDROID, 'gradle/libs.versions.toml')]
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
    for (const forbidden of ['okhttp', 'retrofit', 'jsoup', 'tesseract', 'opencv', 'mlkit', 'ml-kit', 'volley', 'ktor', 'room', 'firebase', 'analytics', 'crashlytics', 'webkit']) {
      expect(gradle.toLowerCase().includes(forbidden), `Android build depends on "${forbidden}"`).toBe(false)
    }
    for (const file of kotlinMain) {
      const code = codeOf(file)
      for (const forbidden of ['HttpURLConnection', 'URLConnection', 'OkHttpClient', 'WebView', 'Socket']) {
        expect(new RegExp(`\\b${forbidden}\\b`).test(code), `${file.replace(ROOT, '')} uses ${forbidden}`).toBe(false)
      }
    }
  })

  it('is not a WebView wrapper around the React app', () => {
    const gradle = readFileSync(resolve(ANDROID, 'app/build.gradle.kts'), 'utf8')
    expect(gradle).toMatch(/filament-android|libs\.filament\.android/)
    expect(filesUnder(APP_MAIN, /\.(html|jsx?|tsx?)$/), 'no web bundle may ship inside the APK').toEqual([])
  })

  it('requests no permissions at all, so the preview works offline', () => {
    const manifest = readFileSync(resolve(APP_MAIN, 'AndroidManifest.xml'), 'utf8')
    expect(manifest).not.toMatch(/<uses-permission/)
    expect(manifest).not.toMatch(/android\.permission\.INTERNET/)
    expect(manifest).not.toMatch(/usesCleartextTraffic/)
  })

  it('uses an application id that can coexist with the owner’s older APK', () => {
    const gradle = readFileSync(resolve(ANDROID, 'app/build.gradle.kts'), 'utf8')
    const match = /applicationId\s*=\s*"([^"]+)"/.exec(gradle)
    expect(match, 'the app must declare an application id').not.toBeNull()
    expect(match?.[1]).not.toBe('com.buildplan.app')
    expect(match?.[1]).toBe('com.buildplan.preview')
    const namespace = /namespace\s*=\s*"([^"]+)"/.exec(gradle)
    expect(namespace?.[1]).not.toBe('com.buildplan.app')
  })

  it('reads the same part palette the web viewer draws with', () => {
    // Mobile follows the web viewer rather than inventing its own look, so the
    // same building is recognisably the same building on both.
    const web = readFileSync(resolve(ROOT, 'apps/web/src/viewport/scene-adapter.ts'), 'utf8')
    const kotlin = readFileSync(resolve(KOTLIN_MAIN, 'render/RenderStyle.kt'), 'utf8')

    const webStyles = new Map<string, { color: string; opacity?: string }>()
    for (const m of web.matchAll(/^\s{2}([A-Z_]+):\s*\{([^}]*)\}/gm)) {
      const color = /color:\s*0x([0-9a-f]{6})/.exec(m[2])?.[1]
      const opacity = /opacity:\s*([0-9.]+)/.exec(m[2])?.[1]
      if (color) webStyles.set(m[1], { color, opacity })
    }
    expect(webStyles.size).toBeGreaterThan(15)

    const kotlinStyles = new Map<string, { color: string; opacity?: string }>()
    for (const m of kotlin.matchAll(/GeometryPart\.([A-Z_]+) to Entry\(hex\(0x([0-9a-f]{6})\)([^)]*)\)/g)) {
      kotlinStyles.set(m[1], { color: m[2], opacity: /alpha = ([0-9.]+)f/.exec(m[3])?.[1] })
    }

    for (const [part, expected] of webStyles) {
      const actual = kotlinStyles.get(part)
      expect(actual, `the mobile palette has no entry for ${part}`).toBeDefined()
      expect(actual?.color, `${part} is a different colour on mobile`).toBe(expected.color)
      expect(Number(actual?.opacity ?? 1), `${part} has a different opacity on mobile`).toBeCloseTo(Number(expected.opacity ?? 1), 6)
    }
  })
})

describe('the mobile scene export stays on the production path', () => {
  const src = filesUnder(resolve(ROOT, 'packages/mobile-scene/src'), /\.ts$/)

  it('compiles geometry with @buildapp/geometry and nothing else', () => {
    const bundle = readFileSync(resolve(ROOT, 'packages/mobile-scene/src/bundle.ts'), 'utf8')
    expect(bundle).toMatch(/from '@buildapp\/geometry'/)
    expect(bundle).toMatch(/compileBuilding\(/)
    // No mesh building of its own.
    for (const file of src) {
      const code = readFileSync(file, 'utf8')
      expect(/three|react/.test(code.split('\n').filter((l) => l.startsWith('import')).join('\n')), `${file} imports a renderer`).toBe(false)
    }
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'packages/mobile-scene/package.json'), 'utf8')) as { dependencies?: Record<string, string> }
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(['@buildapp/geometry', '@buildapp/model'])
  })

  it('is generic: the library names no building', () => {
    for (const file of src) {
      const code = readFileSync(file, 'utf8')
      expect(/marc[oó]wki/i.test(code), `${file.replace(ROOT, '')} names a specific building`).toBe(false)
      expect(/@buildapp\/(demo|reference-marcowki)/.test(code), `${file.replace(ROOT, '')} imports a specific building`).toBe(false)
    }
  })

  it('preserves every semantic object id the compiler produced', () => {
    for (const model of [createDemoBuilding(), createMarcowkiReferenceBuilding()]) {
      const scene = compileBuilding(model)
      const bundle = buildMobileSceneBundle(model, { scene })
      const fromCompiler = scene.meshes.map((m) => m.objectId)
      const fromBundle = bundle.scene.meshes.map((m) => m.objectId)
      expect(fromBundle).toEqual(fromCompiler)
      expect(new Set(bundle.objects.map((o) => o.id))).toEqual(new Set(fromCompiler))
      // And the mesh -> object mapping is mesh for mesh, not just as a set.
      for (let i = 0; i < scene.meshes.length; i++) {
        expect(bundle.scene.meshes[i].objectId).toBe(scene.meshes[i].objectId)
        expect(bundle.scene.meshes[i].part).toBe(scene.meshes[i].part)
        expect(bundle.scene.meshes[i].levelId).toBe(scene.meshes[i].levelId)
        expect(bundle.scene.meshes[i].solidId).toBe(scene.meshes[i].solidId)
      }
    }
  })
})

describe('the web BuildWorld stays clear of the mobile layer', () => {
  it('does not depend on the mobile bundle or on anything Android', () => {
    for (const file of filesUnder(resolve(ROOT, 'apps/web/src'), /\.(ts|tsx)$/)) {
      const code = readFileSync(file, 'utf8')
      expect(/@buildapp\/mobile-scene/.test(code), `${file.replace(ROOT, '')} imports the mobile bundle`).toBe(false)
      expect(/com\.buildplan/.test(code), `${file.replace(ROOT, '')} references the Android app`).toBe(false)
    }
    const webPkg = JSON.parse(readFileSync(resolve(ROOT, 'apps/web/package.json'), 'utf8')) as { dependencies?: Record<string, string> }
    expect(Object.keys(webPkg.dependencies ?? {})).not.toContain('@buildapp/mobile-scene')
  })

  it('still renders the same compiled scene it did before', () => {
    // The mobile stage changed no geometry, so the web viewer's source scene
    // is exactly the compiler's output, as it always was.
    const scene = compileBuilding(createMarcowkiReferenceBuilding())
    expect(scene.diagnostics.filter((d) => d.severity === 'ERROR')).toEqual([])
    expect(scene.stats.meshCount).toBeGreaterThan(0)
    const adapter = readFileSync(resolve(ROOT, 'apps/web/src/viewport/scene-adapter.ts'), 'utf8')
    expect(adapter).toMatch(/CompiledMesh/)
    expect(adapter).toMatch(/meshToObject/)
  })

  // A working-tree check ("apps/web has no uncommitted change") lived here
  // during the mobile stage, when editing the web app WOULD have been outside
  // the brief. It was a stage-local guard wearing an architecture test's
  // clothes: it fails for any later stage that is asked to change BuildWorld,
  // which BUILDAPP-02 was. What it was really protecting — that the web viewer
  // does not acquire a second geometry path — is the rule above, and the rules
  // in `analyzer.test.ts` that keep the browser from scraping or extracting
  // anything of its own.
})
